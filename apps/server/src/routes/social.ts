import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index';
import { addItem, bad, bumpCounter, coinMultiplier, credit, forbidden, getCatalog, getSettings, notFound, today, track, weekKey } from '../lib/core';
import { requireUser } from '../lib/auth';
import { loadRooms, petView } from '../lib/state';
import { str } from '../lib/validate';
import { grantXp, patch } from './game';
import { eventOn, notifyEvent } from '../lib/notify';

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
      `select u.id, u.display_name, p.name as pet_name, p.color, p.ear, p.pattern, p.eyes, p.tail, p.wear, p.level, u.last_seen_at,
              exists(select 1 from visits v where v.visitor_id = $1 and v.host_id = u.id and v.day = $2) as visited_today
         from friendships f join users u on u.id = f.friend_id left join pets p on p.user_id = u.id
        where f.user_id = $1 and u.banned_at is null
        order by u.last_seen_at desc limit $3`,
      [req.user!.id, today(), s.social.maxFriends],
    );
    return { friends: rows };
  });

  app.post('/api/friends', { ...auth, config: { rateLimit: { max: 30, timeWindow: '10 minutes' } } }, async (req: any) => {
    const me = req.user!;
    const code = str(req.body?.code, 'Kode teman', { max: 16 })!.toUpperCase().replace(/\s/g, '');
    const norm = code.startsWith('KB-') ? code : 'KB-' + code;
    const other = await db.one<{ id: string; display_name: string }>(`select id, display_name from users where friend_code = $1 and banned_at is null`, [norm]);
    if (!other) throw notFound('Kode teman tidak ditemukan.');
    if (other.id === me.id) throw bad('self', 'Itu kode teman kamu sendiri.');
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

  app.delete('/api/friends/:id', auth, async (req: any) => {
    const id = String(req.params.id);
    if (!UUID.test(id)) throw bad('invalid', 'ID tidak valid.');
    await db.query(`delete from friendships where (user_id = $1 and friend_id = $2) or (user_id = $2 and friend_id = $1)`, [req.user!.id, id]);
    return { ok: true };
  });

  /* ---------------- kunjungan ---------------- */

  app.get('/api/visit/:id', auth, async (req: any) => {
    const id = String(req.params.id);
    if (!UUID.test(id)) throw bad('invalid', 'ID tidak valid.');
    if (id !== req.user!.id && !(await isFriend(req.user!.id, id))) throw forbidden('Kamu hanya bisa berkunjung ke rumah teman.');
    const [s, cat] = await Promise.all([getSettings(db), getCatalog(db)]);
    const [owner, pet, rooms, visited, likes] = await Promise.all([
      db.one(`select id, display_name from users where id = $1 and banned_at is null`, [id]),
      db.one(`select * from pets where user_id = $1`, [id]),
      loadRooms(db, id, cat, s, false),
      db.one(`select 1 from visits where visitor_id = $1 and host_id = $2 and day = $3`, [req.user!.id, id, today()]),
      db.one<{ c: number; mine: boolean }>(`select count(*)::int c, bool_or(liker_id = $2) mine from house_likes where host_id = $1 and week = $3`, [id, req.user!.id, weekKey()]),
    ]);
    if (!owner) throw notFound('Rumah tidak ditemukan.');
    return { owner, pet: pet ? petView(pet, s) : null, rooms, room: rooms[0], claimed: !!visited, likes: { count: likes?.c ?? 0, liked: !!likes?.mine } };
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
