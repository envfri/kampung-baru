import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index';
import { addItem, bad, bumpCounter, coinMultiplier, credit, forbidden, getCatalog, getSettings, notFound, today, track, weekKey } from '../lib/core';
import { requireUser } from '../lib/auth';
import { loadRooms, petView } from '../lib/state';
import { str } from '../lib/validate';
import { grantXp, patch } from './game';
import { eventOn, notifyEvent } from '../lib/notify';
import { presenceOf, guestsAt, forgetFriend, metInHouse } from './house';
import { metInSquare } from './square';
import { ping } from '../lib/pings';

const UUID = /^[0-9a-f-]{36}$/i;

export default async function socialRoutes(app: FastifyInstance, { db }: { db: Db }) {
  const auth = { preHandler: requireUser(db) };

  async function isFriend(a: string, b: string) {
    return !!(await db.one(`select 1 from friendships where user_id = $1 and friend_id = $2`, [a, b]));
  }

  async function cleanMessage(msg: string) {
    const words = (await db.query<{ word: string }>('select word from banned_words')).map((r) => r.word);
    let out = msg;
    for (const w of words) out = out.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '*'.repeat(w.length));
    return out;
  }

  app.get('/api/friends', auth, async (req) => {
    const s = await getSettings(db);
    const rows = await db.query(
      `select u.id, u.display_name, p.name as pet_name, p.color, p.ear, p.pattern, p.eyes, p.tail, p.wear, p.level, u.last_seen_at, u.show_online, u.live_visits,
              exists(select 1 from visits v where v.visitor_id = $1 and v.host_id = u.id and v.day = $2) as visited_today
         from friendships f join users u on u.id = f.friend_id left join pets p on p.user_id = u.id
        where f.user_id = $1 and u.banned_at is null
        order by u.last_seen_at desc limit $3`,
      [req.user!.id, today(), s.social.maxFriends],
    );
    // status online (bila tidak disembunyikan) & tamu yang sedang main di rumahnya
    const names = new Map(rows.map((r: any) => [r.id, r.display_name]));
    names.set(req.user!.id, 'kamu');
    const friends = rows.map((r: any) => {
      const p = r.show_online ? presenceOf(r.id, r.last_seen_at) : null;
      const { show_online, live_visits, ...rest } = r;
      return { ...rest, online: !!p, where: p?.where ?? null, at: p?.where === 'visit' && p.host ? names.get(p.host) ?? 'teman' : null, alun: p?.where === 'alun' ? Number(p.host) || 1 : null, guests: live_visits ? guestsAt(r.id) : 0 };
    });
    friends.sort((a: any, b: any) => Number(b.online) - Number(a.online) || b.guests - a.guests);
    return { friends };
  });

  app.post('/api/friends', { ...auth, config: { rateLimit: { max: 30, timeWindow: '10 minutes' } } }, async (req: any) => {
    const me = req.user!;
    const code = str(req.body?.code, 'Kode teman', { max: 16 })!.toUpperCase().replace(/\s/g, '');
    const norm = code.startsWith('KB-') ? code : 'KB-' + code;
    const other = await db.one<{ id: string; display_name: string }>(`select id, display_name from users where friend_code = $1 and banned_at is null`, [norm]);
    if (!other) throw notFound('Kode teman tidak ditemukan.');
    if (other.id === me.id) throw bad('self', 'Itu kode teman kamu sendiri.');
    // pemain yang memblokir / diblokir tidak bisa berteman lagi
    if (await db.one(`select 1 from blocks where (user_id = $1 and blocked_id = $2) or (user_id = $2 and blocked_id = $1)`, [me.id, other.id])) throw forbidden('Tidak bisa berteman dengan pemain ini.');
    const s = await getSettings(db);
    const n = (await db.one<{ c: number }>(`select count(*)::int as c from friendships where user_id = $1`, [me.id]))!.c;
    if (n >= s.social.maxFriends) throw bad('max_friends', `Maksimal ${s.social.maxFriends} teman.`);
    await db.tx(async (t) => {
      await t.query(`insert into friendships (user_id, friend_id) values ($1,$2),($2,$1) on conflict do nothing`, [me.id, other.id]);
    });
    await track(db, me.id, 'friend_added');
    void notifyEvent(db, other.id, 'friend_added', { teman: me.display_name }, { log: req.log });
    return { ok: true, friend: other };
  });

  /* ---------------- ajakan berteman (bertemu di alun-alun / rumah teman) ---------------- */
  // Kode teman = persetujuan (langsung berteman). Orang yang hanya ditemui belum memberi kodenya, jadi
  // ajakannya harus diterima dulu. Penolakan tidak diberitahukan ke pengajak.
  const ASK_DAYS = 14, DECLINE_DAYS = 7, ASKS_PER_DAY = 30;
  const PLACE: Record<string, string> = { alun: 'alun-alun', visit: 'rumah teman' };
  const blockedEither = async (a: string, b: string) =>
    !!(await db.one(`select 1 from blocks where (user_id = $1 and blocked_id = $2) or (user_id = $2 and blocked_id = $1)`, [a, b]));
  const friendCount = async (q: Db, uid: string) => (await q.one<{ c: number }>(`select count(*)::int c from friendships where user_id = $1`, [uid]))!.c;
  /** Nama untuk ajakan: nama pemain, atau "Pemilik <pet>" untuk akun tamu yang belum memberi nama. */
  async function nameOf(uid: string) {
    const r = await db.one<{ display_name: string; pet: string | null }>(`select u.display_name, p.name as pet from users u left join pets p on p.user_id = u.id where u.id = $1`, [uid]);
    return r?.display_name && r.display_name !== 'Tamu' ? r.display_name : r?.pet ? `Pemilik ${r.pet}` : 'Pemain';
  }
  async function petLook(uid: string) {
    return db.one<any>(`select name, color, ear, pattern, eyes, tail from pets where user_id = $1`, [uid]);
  }
  /** Jadikan berteman (dua arah) dari ajakan; dipakai saat diterima atau saat dua orang saling mengajak. */
  async function befriend(reqId: string, fromId: string, toId: string, log: any) {
    const s = await getSettings(db);
    const [nf, nt] = await Promise.all([friendCount(db, fromId), friendCount(db, toId)]);
    if (nt >= s.social.maxFriends) throw bad('max_friends', `Temanmu sudah ${s.social.maxFriends}, batas maksimal.`);
    if (nf >= s.social.maxFriends) throw bad('max_friends', 'Teman pemain itu sudah penuh.');
    await db.tx(async (t) => {
      await t.query(`insert into friendships (user_id, friend_id) values ($1,$2),($2,$1) on conflict do nothing`, [fromId, toId]);
      await t.query(`update friend_requests set status = 'accepted', answered_at = now() where status = 'pending' and ((from_id = $1 and to_id = $2) or (from_id = $2 and to_id = $1))`, [fromId, toId]);
    });
    forgetFriend(fromId, toId);
    await track(db, fromId, 'friend_added');
    await track(db, toId, 'friend_added');
    const toName = await nameOf(toId);
    ping(fromId, { kind: 'friend_ok', id: reqId, from: toId, name: toName });
    void notifyEvent(db, fromId, 'friend_accepted', { teman: toName }, { log });
  }

  /** Ajak berteman pemain yang sedang (atau baru saja) ditemui di alun-alun / rumah yang sama. */
  app.post('/api/friends/requests', { ...auth, config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async (req: any) => {
    const me = req.user!;
    const to = String(req.body?.userId ?? '').toLowerCase();
    if (!UUID.test(to) || to === me.id) throw bad('invalid', 'Pemain tidak valid.');
    const place = metInSquare(me.id, to) ? 'alun' : metInHouse(me.id, to) ? 'visit' : null;
    if (!place) throw bad('not_met', 'Ajak berteman saat kalian sedang di tempat yang sama, ya.');
    const other = await db.one<{ id: string; display_name: string; friend_requests: boolean }>(
      `select id, display_name, friend_requests from users where id = $1 and banned_at is null`, [to]);
    if (!other) throw notFound('Pemain tidak ditemukan.');
    if (await isFriend(me.id, to)) return { ok: true, status: 'friends' };
    if (await blockedEither(me.id, to)) throw forbidden('Tidak bisa berteman dengan pemain ini.');
    // dia sudah lebih dulu mengajak: langsung berteman
    const back = await db.one<{ id: string }>(
      `select id from friend_requests where from_id = $1 and to_id = $2 and status = 'pending' and created_at > now() - interval '${ASK_DAYS} days'`, [to, me.id]);
    if (back) {
      await befriend(back.id, to, me.id, req.log);
      return { ok: true, status: 'friends', friend: { id: other.id, display_name: other.display_name } };
    }
    if (other.friend_requests === false) throw forbidden(`${other.display_name} sedang tidak menerima ajakan berteman.`);
    const s = await getSettings(db);
    if ((await friendCount(db, me.id)) >= s.social.maxFriends) throw bad('max_friends', `Maksimal ${s.social.maxFriends} teman.`);
    const pending = await db.one(
      `select 1 from friend_requests where from_id = $1 and to_id = $2 and status = 'pending' and created_at > now() - interval '${ASK_DAYS} days'`, [me.id, to]);
    if (pending) return { ok: true, status: 'sent' };
    // baru ditolak: tetap terlihat "terkirim" bagi pengajak, tetapi tidak mengganggu yang menolak lagi
    const declined = await db.one(
      `select 1 from friend_requests where from_id = $1 and to_id = $2 and status = 'declined' and answered_at > now() - interval '${DECLINE_DAYS} days'`, [me.id, to]);
    if (declined) return { ok: true, status: 'sent' };
    const id = await db.tx(async (t) => {
      await bumpCounter(t, me.id, 'friend_ask', ASKS_PER_DAY);
      // ajakan lama yang kedaluwarsa tidak menghalangi ajakan baru
      await t.query(`update friend_requests set status = 'expired', answered_at = now() where from_id = $1 and to_id = $2 and status = 'pending'`, [me.id, to]);
      return (await t.one<{ id: string }>(`insert into friend_requests (from_id, to_id, place) values ($1,$2,$3) returning id`, [me.id, to, place]))!.id;
    });
    const myName = await nameOf(me.id);
    ping(to, { kind: 'friend_ask', id, from: me.id, name: myName, pet: await petLook(me.id) });
    void notifyEvent(db, to, 'friend_request', { teman: myName, tempat: PLACE[place] }, { log: req.log });
    await track(db, me.id, 'friend_ask', { place });
    return { ok: true, status: 'sent' };
  });

  /** Ajakan masuk yang menunggu jawaban & ajakan yang kukirim (masih menunggu). */
  app.get('/api/friends/requests', auth, async (req: any) => {
    const uid = req.user!.id;
    const [incoming, sent] = await Promise.all([
      db.query<any>(
        `select r.id, r.place, r.created_at, u.id as user_id, u.display_name, p.name as pet_name, p.color, p.ear, p.pattern, p.eyes, p.tail
           from friend_requests r join users u on u.id = r.from_id left join pets p on p.user_id = u.id
          where r.to_id = $1 and r.status = 'pending' and r.created_at > now() - interval '${ASK_DAYS} days' and u.banned_at is null
            and not exists (select 1 from blocks b where (b.user_id = r.to_id and b.blocked_id = r.from_id) or (b.user_id = r.from_id and b.blocked_id = r.to_id))
          order by r.created_at desc limit 50`, [uid]),
      db.query<{ to_id: string }>(`select to_id from friend_requests where from_id = $1 and status = 'pending' and created_at > now() - interval '${ASK_DAYS} days'`, [uid]),
    ]);
    return {
      incoming: incoming.map((r) => ({ id: r.id, place: r.place, created_at: r.created_at, from: { id: r.user_id, name: r.display_name && r.display_name !== 'Tamu' ? r.display_name : r.pet_name ? `Pemilik ${r.pet_name}` : 'Pemain', pet: r.pet_name ? { name: r.pet_name, color: r.color, ear: r.ear, pattern: r.pattern, eyes: r.eyes, tail: r.tail } : null } })),
      sent: sent.map((r) => r.to_id),
    };
  });

  /** Hubungan dengan pemain-pemain yang sedang terlihat (untuk tombol Ajak berteman / Teman / Menunggu). */
  app.get('/api/friends/relations', auth, async (req: any) => {
    const uid = req.user!.id;
    const ids = String(req.query?.ids ?? '').split(',').map((x) => x.trim().toLowerCase()).filter((x) => UUID.test(x)).slice(0, 40);
    if (!ids.length) return { friends: [], sent: [], incoming: [] };
    const [f, s2, inc] = await Promise.all([
      db.query<{ friend_id: string }>(`select friend_id from friendships where user_id = $1 and friend_id = any($2::uuid[])`, [uid, ids]),
      db.query<{ to_id: string }>(`select to_id from friend_requests where from_id = $1 and to_id = any($2::uuid[]) and status in ('pending','declined') and coalesce(answered_at, created_at) > now() - interval '${DECLINE_DAYS} days'`, [uid, ids]),
      db.query<{ id: string; from_id: string }>(`select id, from_id from friend_requests where to_id = $1 and from_id = any($2::uuid[]) and status = 'pending' and created_at > now() - interval '${ASK_DAYS} days'`, [uid, ids]),
    ]);
    return { friends: f.map((r) => r.friend_id), sent: s2.map((r) => r.to_id), incoming: inc.map((r) => ({ id: r.id, from: r.from_id })) };
  });

  async function myAsk(uid: string, id: string) {
    if (!UUID.test(id)) throw bad('invalid', 'Ajakan tidak valid.');
    const r = await db.one<{ id: string; from_id: string; to_id: string }>(
      `select id, from_id, to_id from friend_requests where id = $1 and to_id = $2 and status = 'pending' and created_at > now() - interval '${ASK_DAYS} days'`, [id, uid]);
    if (!r) throw notFound('Ajakan sudah tidak berlaku.');
    return r;
  }
  app.post('/api/friends/requests/:id/accept', auth, async (req: any) => {
    const me = req.user!;
    const r = await myAsk(me.id, String(req.params.id));
    if (await blockedEither(r.from_id, me.id)) throw forbidden('Tidak bisa berteman dengan pemain ini.');
    await befriend(r.id, r.from_id, me.id, req.log);
    const friend = await db.one<{ id: string; display_name: string }>(`select id, display_name from users where id = $1`, [r.from_id]);
    return { ok: true, friend };
  });
  app.post('/api/friends/requests/:id/decline', auth, async (req: any) => {
    const r = await myAsk(req.user!.id, String(req.params.id));
    await db.query(`update friend_requests set status = 'declined', answered_at = now() where id = $1`, [r.id]);
    return { ok: true };
  });

  app.delete('/api/friends/:id', auth, async (req: any) => {
    const id = String(req.params.id);
    if (!UUID.test(id)) throw bad('invalid', 'ID tidak valid.');
    await db.query(`delete from friendships where (user_id = $1 and friend_id = $2) or (user_id = $2 and friend_id = $1)`, [req.user!.id, id]);
    forgetFriend(req.user!.id, id);
    return { ok: true };
  });

  /* ---------------- kunjungan ---------------- */

  app.get('/api/visit/:id', auth, async (req: any) => {
    const id = String(req.params.id);
    if (!UUID.test(id)) throw bad('invalid', 'ID tidak valid.');
    if (id !== req.user!.id && !(await isFriend(req.user!.id, id))) throw forbidden('Kamu hanya bisa berkunjung ke rumah teman.');
    const [s, cat] = await Promise.all([getSettings(db), getCatalog(db)]);
    const [owner, pet, rooms, visited, likes, photo, book, used] = await Promise.all([
      db.one<any>(`select id, display_name, live_visits, show_online, last_seen_at from users where id = $1 and banned_at is null`, [id]),
      db.one(`select * from pets where user_id = $1`, [id]),
      loadRooms(db, id, cat, s, false),
      db.one(`select 1 from visits where visitor_id = $1 and host_id = $2 and day = $3`, [req.user!.id, id, today()]),
      db.one<{ c: number; mine: boolean }>(`select count(*)::int c, bool_or(liker_id = $2) mine from house_likes where host_id = $1 and week = $3`, [id, req.user!.id, weekKey()]),
      db.one<any>(`select p.id, p.pose, p.members, p.scene from users u join photos p on p.id = u.featured_photo where u.id = $1`, [id]),
      db.query<any>(
        `select a.kind, a.item_id, a.created_at, u.display_name as name from visit_acts a join users u on u.id = a.visitor_id
          where a.host_id = $1 order by a.created_at desc limit 6`, [id]),
      db.one<{ count: number }>(`select count from daily_counters where user_id = $1 and key = $2 and day = $3`, [req.user!.id, `vact:${id}`, today()]),
    ]);
    if (!owner) throw notFound('Rumah tidak ditemukan.');
    const sv: any = s;
    const online = owner.show_online ? presenceOf(id, owner.last_seen_at) : null;
    return {
      owner: { id: owner.id, display_name: owner.display_name }, pet: pet ? petView(pet, s) : null, rooms, room: rooms[0], claimed: !!visited,
      likes: { count: likes?.c ?? 0, liked: !!likes?.mine },
      photo: photo ? { id: photo.id, pose: photo.pose, members: photo.members, scene: photo.scene } : null,
      guestbook: book.map((b: any) => ({ ...b, created_at: new Date(b.created_at).getTime() })),
      together: { on: !!sv.visit?.together, live: owner.live_visits !== false, online: !!online, left: Math.max(0, (sv.visit?.actsPerFriend ?? 0) - (used?.count ?? 0)), phrases: sv.visit?.phrases ?? [], freeChat: !!sv.visit?.freeChat },
    };
  });

  /* ---------------- suka rumah teman & rumah terfavorit ---------------- */

  app.post('/api/visit/:id/like', auth, async (req: any) => {
    const me = req.user!;
    const id = String(req.params.id);
    if (!UUID.test(id) || id === me.id) throw bad('invalid', 'Tidak bisa menyukai rumah sendiri.');
    if (!(await isFriend(me.id, id))) throw forbidden('Kamu hanya bisa menyukai rumah teman.');
    const week = weekKey();
    const r = await db.one(`insert into house_likes (liker_id, host_id, week) values ($1,$2,$3) on conflict do nothing returning 1 as ok`, [me.id, id, week]);
    const n = (await db.one<{ c: number }>(`select count(*)::int c from house_likes where host_id = $1 and week = $2`, [id, week]))!.c;
    if (r) {
      await track(db, me.id, 'like', { host: id });
      await track(db, id, 'liked', { from: me.id });
      void notifyEvent(db, id, 'house_liked', { teman: me.display_name, jumlah: n }, { log: req.log });
    }
    return { ok: true, likes: { count: n, liked: true }, already: !r };
  });

  app.get('/api/houses/top', auth, async (req: any) => {
    const me = req.user!.id;
    const week = weekKey();
    const s = await getSettings(db);
    const rows = await db.query<any>(
      `select h.host_id as id, count(*)::int as likes, u.display_name, p.name as pet_name, p.level, p.color, p.ear, p.pattern, p.eyes, p.tail, p.wear,
              exists (select 1 from friendships f where f.user_id = $2 and f.friend_id = h.host_id) as friend
         from house_likes h join users u on u.id = h.host_id and u.banned_at is null left join pets p on p.user_id = h.host_id
        where h.week = $1 group by h.host_id, u.display_name, p.name, p.level, p.color, p.ear, p.pattern, p.eyes, p.tail, p.wear
        order by likes desc, min(h.created_at) limit 10`,
      [week, me],
    );
    const mine = await db.one<{ c: number }>(`select count(*)::int c from house_likes where host_id = $1 and week = $2`, [me, week]);
    void s;
    return { week, top: rows.map((r, i) => ({ rank: i + 1, ...r, me: r.id === me })), mine: mine?.c ?? 0 };
  });

  app.post('/api/visit/:id/claim', auth, async (req: any) => {
    const me = req.user!;
    const id = String(req.params.id);
    if (!UUID.test(id) || id === me.id) throw bad('invalid', 'Kunjungan tidak valid.');
    if (!(await isFriend(me.id, id))) throw forbidden('Kamu hanya bisa berkunjung ke rumah teman.');
    const [s, cat] = await Promise.all([getSettings(db), getCatalog(db)]);
    return db.tx(async (t) => {
      const r = await t.one(`insert into visits (visitor_id, host_id, day) values ($1,$2,$3) on conflict do nothing returning 1 as ok`, [me.id, id, today()]);
      if (!r) throw bad('claimed', 'Hadiah kunjungan ke rumah ini sudah diambil hari ini.');
      const coins = Math.round(s.social.visitCoins * coinMultiplier(cat));
      await credit(t, me.id, 'coin', coins, 'visit', id);
      const pet = await t.one(`select level, xp from pets where user_id = $1 for update`, [me.id]);
      if (pet && s.social.visitXp) {
        const lv = await grantXp(t, me.id, pet, s.social.visitXp);
        await t.query(`update pets set level = $2, xp = $3 where user_id = $1`, [me.id, lv.level, lv.xp]);
      }
      await track(t, me.id, 'visit', { host: id });
      return { ok: true, coins, xp: s.social.visitXp, ...(await patch(t, me.id, ['wallet', 'pet'])) };
    }).then(async (res) => {
      if (await eventOn(db, 'visit')) {
        // maksimal satu notifikasi kunjungan per jeda waktu per tuan rumah
        const ok = await db.one(
          `insert into cooldowns (user_id, key, until) values ($1, 'notif_visit', now() + ($2::int * interval '1 minute'))
           on conflict (user_id, key) do update set until = excluded.until where cooldowns.until < now() returning 1 as ok`,
          [id, s.notify.visitThrottleMin],
        );
        if (ok) void notifyEvent(db, id, 'visit', { teman: me.display_name }, { log: req.log });
      }
      return res;
    });
  });

  /* ---------------- hadiah antar teman ---------------- */

  app.get('/api/gifts', auth, async (req) => {
    const rows = await db.query(
      `select g.id, g.item_id, g.qty, g.message, g.created_at, g.opened_at, u.display_name as from_name
         from gifts g left join users u on u.id = g.from_id
        where g.to_id = $1 and (g.opened_at is null or g.opened_at > now() - interval '7 days')
        order by g.opened_at nulls first, g.created_at desc limit 40`,
      [req.user!.id],
    );
    return { gifts: rows };
  });

  app.post('/api/gifts', { ...auth, config: { rateLimit: { max: 30, timeWindow: '10 minutes' } } }, async (req: any) => {
    const me = req.user!;
    const s = await getSettings(db);
    if (!s.features.gifts) throw forbidden('Fitur kirim hadiah sedang tidak tersedia.');
    const to = String(req.body?.to ?? '');
    if (!UUID.test(to) || to === me.id) throw bad('invalid', 'Penerima tidak valid.');
    if (!(await isFriend(me.id, to))) throw forbidden('Hadiah hanya bisa dikirim ke teman.');
    const itemId = str(req.body?.itemId, 'Barang', { max: 64 })!;
    const cat = await getCatalog(db);
    if (!cat.byId.get(itemId)?.active) throw bad('invalid_item', 'Barang tidak valid.');
    const message = await cleanMessage(str(req.body?.message, 'Pesan', { max: 80, optional: true }) ?? '');
    return db.tx(async (t) => {
      await bumpCounter(t, me.id, 'gifts', s.social.giftsPerDay);
      await addItem(t, me.id, itemId, -1);
      await t.query(`insert into gifts (from_id, to_id, item_id, qty, message) values ($1,$2,$3,1,$4)`, [me.id, to, itemId, message]);
      await track(t, me.id, 'gift_sent', { itemId });
      return { ok: true, ...(await patch(t, me.id, ['inventory'])) };
    }).then((res) => {
      void notifyEvent(db, to, 'gift', { teman: me.display_name, pesan: message ? `: “${message}”` : '' }, { log: req.log });
      return res;
    });
  });

  app.post('/api/gifts/:id/open', auth, async (req: any) => {
    const me = req.user!;
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw bad('invalid', 'Hadiah tidak valid.');
    return db.tx(async (t) => {
      const g = await t.one<{ item_id: string; qty: number }>(`update gifts set opened_at = now() where id = $1 and to_id = $2 and opened_at is null returning item_id, qty`, [id, me.id]);
      if (!g) throw bad('opened', 'Hadiah sudah dibuka.');
      await addItem(t, me.id, g.item_id, g.qty);
      return { ok: true, itemId: g.item_id, qty: g.qty, ...(await patch(t, me.id, ['inventory'])) };
    });
  });
}
