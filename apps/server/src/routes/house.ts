// Kunjungan bareng: pet tamu ikut ke rumah teman.
//  - interaksi dengan pet tuan rumah (sapa, peluk, kasih camilan, kejar-kejaran, duduk bareng) + buku tamu;
//  - rumah "live": semua yang sedang di rumah itu, di ruangan mana pun (tuan rumah + beberapa tamu), saling melihat pet,
//    ekspresi, dan obrolan (polling ±1 detik, keadaan di memori server seperti main bareng Duel);
//  - main bareng di rumah: Masak bareng & Lempar bola; foto bareng masuk album semua yang ada di foto.
import type { FastifyInstance } from 'fastify';
import { randomInt, randomUUID } from 'node:crypto';
import { applyNeedDelta, mulberry32, NEED_KEYS, petLookState, type Needs } from '@kb/shared';
import type { Db } from '../db/index';
import { addItem, bad, bumpCounter, checkChat, coinMultiplier, counter, credit, forbidden, getCatalog, getSettings, notFound, track } from '../lib/core';
import { requireUser } from '../lib/auth';
import { currentNeeds, isAsleep, loadRooms, lockPet, petView, roomMeta, savePet } from '../lib/state';
import { notifyEvent } from '../lib/notify';
import { grantXp, patch } from './game';

const UUID = /^[0-9a-f-]{36}$/i;
// HP yang sedang sibuk / sinyal lemah bisa telat beberapa kali sinkron: jangan langsung dianggap pulang
const LIVE_MS = 10_000;
const PRESENCE_MS = 90_000;
export const VISIT_ACTS = ['sapa', 'peluk', 'camilan', 'kejar', 'duduk'] as const;
export const EMOTES = ['lambai', 'tawa', 'hati', 'kaget'] as const;
const ACTS_LIVE = new Set(['jalan', 'duduk', 'sapa', 'peluk', 'kejar', 'makan', 'lompat']);
/** bahan Masak bareng & hidangannya (hidangan = item makanan yang dibagikan bila berhasil) */
export const COOK_INGREDIENTS = ['bawang', 'cabai', 'telur', 'tomat', 'kecap', 'garam', 'nasi', 'daun'] as const;
const DISHES = ['pisang-goreng', 'bakso', 'sate', 'martabak', 'klepon'];
const COOK_STEPS = 6, BALL_GOAL = 15, BALL_OK = 5, COOP_MS = 60_000, INVITE_MS = 15_000, COOP_MAX = 5;

type Member = { id: string; name: string; pet: any; roomId: string; x: number; y: number; flip: boolean; act: string | null; seenAt: number; joinedAt: number; petAt: number; host: boolean; emoteAt: number };
type Ev = { seq: number; at: number; kind: string; from?: string; [k: string]: unknown };
type Coop = {
  id: string; hostId: string; game: 'masak' | 'bola'; roomId: string; players: string[]; names: Record<string, string>;
  /** ajak: menunggu pemain lain menekan Ikut (tidak ada yang ditarik otomatis); main: permainan berjalan */
  phase: 'ajak' | 'main'; starter: string; inviteUntil: number;
  /** pemain yang berhenti sendiri (permainan tetap jalan untuk yang lain) */
  quit: Set<string>; moves: number; settled: boolean;
  seed: number; startedAt: number; endsAt: number; endedAt: number; done: boolean; ok: boolean | null; results: any[] | null;
  // masak
  dish: string; recipe: string[]; options: string[][]; step: number; mistakes: number;
  // bola
  passes: number; lives: number; holder: string; lastPassAt: number;
};
/** rooms: id & ukuran ruangan tuan rumah (cache ±1 menit) untuk memeriksa posisi yang dikirim tamu */
type House = { members: Map<string, Member>; events: Ev[]; seq: number; coop: Coop | null; kicked: Map<string, number>; rooms?: { at: number; size: Map<string, number>; first: string } };

const HOUSES = new Map<string, House>();
const PRESENCE = new Map<string, { at: number; where: string; host?: string }>();
const FRIENDS = new Map<string, number>();
const HOSTPREF = new Map<string, { at: number; live: boolean }>();
const SAID = new Map<string, number>();

const fresh = (m: Member, now = Date.now()) => now - m.seenAt < LIVE_MS;
/** id proses: berubah setelah server restart supaya client mengulang nomor urut kejadian */
const BOOT = Math.random().toString(36).slice(2, 10);
const ACT_GAP_MS = 4000, ACT_HARD_CAP = 30;
const LAST_ACT = new Map<string, number>();
/** Ruangan tuan rumah berubah (dibeli / diperluas): muat ulang daftar ruangan untuk memeriksa posisi tamu. */
export function forgetHouseRooms(hostId: string) { const h = HOUSES.get(hostId); if (h) h.rooms = undefined; }
/** Lupakan cache pertemanan (dipanggil saat berhenti berteman / memblokir). */
export function forgetFriend(a: string, b: string) { FRIENDS.delete(`${a}:${b}`); FRIENDS.delete(`${b}:${a}`); }
// sapu berkala: rumah kosong, status online lama, cache & catatan sementara
setInterval(() => {
  const now = Date.now();
  for (const [id, h] of HOUSES) {
    prune(h);
    for (const [u, until] of h.kicked) if (until < now) h.kicked.delete(u);
    if (!h.members.size && !h.coop && !h.kicked.size) HOUSES.delete(id);
  }
  for (const [k, v] of PRESENCE) if (now - v.at > PRESENCE_MS) PRESENCE.delete(k);
  for (const [k, v] of FRIENDS) if (v < now) FRIENDS.delete(k);
  for (const [k, v] of HOSTPREF) if (now - v.at > 60_000) HOSTPREF.delete(k);
  for (const [k, v] of SAID) if (now - v > 60_000) SAID.delete(k);
  for (const [k, v] of LAST_ACT) if (now - v > 60_000) LAST_ACT.delete(k);
}, 60_000).unref?.();
function houseOf(hostId: string) {
  let h = HOUSES.get(hostId);
  if (!h) { h = { members: new Map(), events: [], seq: 0, coop: null, kicked: new Map() }; HOUSES.set(hostId, h); }
  return h;
}
function push(h: House, ev: Omit<Ev, 'seq' | 'at'>) {
  h.seq++;
  h.events.push({ ...ev, seq: h.seq, at: Date.now() } as Ev);
  const cut = Date.now() - 60_000;
  while (h.events.length > 120 || (h.events.length && h.events[0].at < cut)) h.events.shift();
}
function prune(h: House) {
  const now = Date.now();
  for (const m of h.members.values()) if (!fresh(m, now)) { h.members.delete(m.id); push(h, { kind: 'leave', from: m.id, name: m.name }); }
}

/** Status online untuk daftar teman (null = disembunyikan / offline). */
export function presenceOf(userId: string, lastSeen?: Date | string | null) {
  const p = PRESENCE.get(userId);
  if (p && Date.now() - p.at < PRESENCE_MS) return { where: p.where, host: p.host ?? null };
  if (lastSeen && Date.now() - new Date(lastSeen).getTime() < 150_000) return { where: 'game', host: null };
  return null;
}
/** Tamu yang sedang live di rumah seseorang (tanpa tuan rumah). */
export function guestsAt(hostId: string) {
  const h = HOUSES.get(hostId);
  if (!h) return 0;
  const now = Date.now();
  let n = 0;
  for (const m of h.members.values()) if (!m.host && fresh(m, now)) n++;
  return n;
}

export default async function houseRoutes(app: FastifyInstance, { db }: { db: Db }) {
  const auth = { preHandler: requireUser(db) };
  const fast = { ...auth, config: { rateLimit: { max: 400, timeWindow: '1 minute' } } };

  async function isFriend(a: string, b: string) {
    if (a === b) return true;
    const k = `${a}:${b}`, c = FRIENDS.get(k);
    if (c && c > Date.now()) return true;
    const ok = !!(await db.one(`select 1 from friendships where user_id = $1 and friend_id = $2`, [a, b]));
    if (ok) FRIENDS.set(k, Date.now() + 60_000);
    return ok;
  }
  async function hostLive(hostId: string) {
    const c = HOSTPREF.get(hostId);
    if (c && Date.now() - c.at < 30_000) return c.live;
    const r = await db.one<{ live_visits: boolean }>(`select live_visits from users where id = $1`, [hostId]);
    const live = r?.live_visits !== false;
    HOSTPREF.set(hostId, { at: Date.now(), live });
    return live;
  }
  async function enter(req: any) {
    const hostId = String(req.params.hostId ?? req.params.id);
    if (!UUID.test(hostId)) throw bad('invalid', 'Rumah tidak valid.');
    if (!(await isFriend(req.user!.id, hostId))) throw forbidden('Kamu hanya bisa berkunjung ke rumah teman.');
    return hostId;
  }
  /** tamu yang diantar pulang tidak bisa beraksi di rumah itu sampai waktunya habis */
  function assertNotKicked(hostId: string, uid: string) {
    const until = HOUSES.get(hostId)?.kicked.get(uid);
    if (until && until > Date.now()) throw forbidden('Tuan rumah sedang tidak menerima kamu. Coba lagi nanti.');
  }
  async function memberInfo(uid: string) {
    const s = await getSettings(db);
    const r = await db.one<any>(`select u.display_name, p.* from users u left join pets p on p.user_id = u.id where u.id = $1`, [uid]);
    if (!r?.name) return { name: r?.display_name ?? 'Teman', pet: null };
    const v = petView({ ...r, user_id: uid }, s);
    return { name: r.display_name, pet: { name: v.name, color: v.color, ear: v.ear, pattern: v.pattern, eyes: v.eyes, tail: v.tail, wear: v.wear, level: v.level, state: petLookState(v.needs, { sleeping: !!v.sleep, sick: v.sick, chub: v.chub }) } };
  }
  // posisi dikirim per ruangan (roomId + x, y di dalamnya); layar rumah memetakannya ke denah rumah tersambung
  const view = (m: Member) => ({ id: m.id, name: m.name, pet: m.pet, roomId: m.roomId, x: m.x, y: m.y, flip: m.flip, act: m.act, host: m.host });

  /** id & ukuran ruangan tuan rumah (cache ±1 menit per rumah) */
  async function hostRooms(hostId: string, h: House) {
    if (h.rooms && Date.now() - h.rooms.at < 60_000) return h.rooms;
    const [s, cat]: [any, any] = await Promise.all([getSettings(db), getCatalog(db)]);
    const rows = await db.query<{ id: string; room_item: string | null; size: number | null }>(`select id, room_item, size from rooms where user_id = $1 order by sort, id`, [hostId]);
    h.rooms = { at: Date.now(), size: new Map(rows.map((r) => [r.id, roomMeta(r.room_item, cat, s, r.size).size])), first: rows[0]?.id ?? '' };
    return h.rooms;
  }

  /* ---------------- rumah live ---------------- */

  app.post('/api/house/:hostId/sync', fast, async (req: any) => {
    const s: any = await getSettings(db);
    const uid = req.user!.id;
    const hostId = await enter(req);
    if (!s.visit.together) return { live: false, reason: 'off' };
    if (uid !== hostId && !(await hostLive(hostId))) return { live: false, reason: 'host_off' };
    const h = houseOf(hostId);
    const b = req.body ?? {};
    const since = Math.max(0, Number(b.since) || 0);
    const kickedUntil = h.kicked.get(uid);
    if (kickedUntil && kickedUntil > Date.now()) return { live: false, reason: 'kicked' };
    prune(h);
    await settleCoop(hostId, h, s);
    // posisi dikirim per ruangan: ruangan harus milik tuan rumah, posisi dibatasi ukuran ruangan itu
    const hr = await hostRooms(hostId, h);
    const roomId = hr.size.has(String(b.roomId ?? '')) ? String(b.roomId) : hr.first;
    const lim = hr.size.get(roomId) ?? 16;
    const num = (v: unknown) => Math.max(0, Math.min(lim, Number(v) || 0));
    let m = h.members.get(uid);
    let full = false;
    if (!m) {
      const guests = [...h.members.values()].filter((x) => !x.host && fresh(x)).length;
      if (uid !== hostId && guests >= s.visit.maxLive) full = true;
      else {
        const info = await memberInfo(uid);
        // permintaan lain bisa sudah menambahkan pemain ini / memenuhi rumah selama menunggu data pet
        const again = h.members.get(uid);
        const guestsNow = [...h.members.values()].filter((x) => !x.host && fresh(x)).length;
        if (again) m = again;
        else if (uid !== hostId && guestsNow >= s.visit.maxLive) full = true;
        else {
        m = { id: uid, name: info.name, pet: info.pet, roomId, x: num(b.x), y: num(b.y), flip: !!b.flip, act: null, seenAt: Date.now(), joinedAt: Date.now(), petAt: Date.now(), host: uid === hostId, emoteAt: 0 };
        h.members.set(uid, m);
        push(h, { kind: 'join', from: uid, name: m.name, host: m.host });
        }
      }
    }
    if (m) {
      m.roomId = roomId; m.x = num(b.x); m.y = num(b.y); m.flip = !!b.flip; m.seenAt = Date.now();
      m.act = typeof b.act === 'string' && ACTS_LIVE.has(b.act) ? b.act : null;
      if (typeof b.emote === 'string' && (EMOTES as readonly string[]).includes(b.emote) && Date.now() - m.emoteAt > 600) {
        m.emoteAt = Date.now();
        push(h, { kind: 'emote', from: uid, emote: b.emote });
      }
      // segarkan data pet (pakaian, wajah) tiap ±1 menit
      if (Date.now() - m.petAt > 45_000) { m.petAt = Date.now(); const info = await memberInfo(uid); m.pet = info.pet; m.name = info.name; }
    }
    PRESENCE.set(uid, { at: Date.now(), where: uid === hostId ? 'home' : 'visit', host: hostId });
    const now = Date.now();
    const all = [...h.members.values()].filter((x) => fresh(x, now));
    return {
      live: true, full, me: uid, seq: h.seq, boot: BOOT,
      // semua ruangan tampil sekaligus: semua yang ada di rumah saling terlihat
      members: all.filter((x) => x.id !== uid).map(view),
      elsewhere: [],
      events: h.events.filter((e) => e.seq > since),
      coop: coopView(h.coop),
      serverNow: now,
    };
  });

  app.post('/api/house/:hostId/leave', auth, async (req: any) => {
    const hostId = String(req.params.hostId);
    const h = HOUSES.get(hostId);
    const m = h?.members.get(req.user!.id);
    if (h && m) { h.members.delete(m.id); push(h, { kind: 'leave', from: m.id, name: m.name }); }
    return { ok: true };
  });

  app.post('/api/house/:hostId/say', { ...auth, config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req: any) => {
    const s: any = await getSettings(db);
    const uid = req.user!.id;
    const hostId = await enter(req);
    assertNotKicked(hostId, uid);
    const h = HOUSES.get(hostId);
    const m = h?.members.get(uid);
    if (!h || !m || !fresh(m)) throw bad('not_here', 'Kamu belum ada di rumah ini.');
    if (Date.now() - (SAID.get(uid) ?? 0) < 1200) throw bad('too_fast', 'Pelan-pelan, ya.');
    const text = String(req.body?.text ?? '').replace(/\s+/g, ' ').trim();
    const max = Math.max(10, Math.min(200, Number(s.visit.chatMax) || 80));
    if (!text) throw bad('empty', 'Tulis pesan dulu.');
    if (text.length > max) throw bad('too_long', `Pesan maksimal ${max} huruf.`);
    const preset = (s.visit.phrases ?? []).includes(text);
    if (!preset) {
      if (!s.visit.freeChat) throw bad('preset_only', 'Pilih salah satu frasa yang tersedia.');
      await checkChat(db, text);
    }
    SAID.set(uid, Date.now());
    await db.query(`insert into house_chat (host_id, user_id, text) values ($1,$2,$3)`, [hostId, uid, text]);
    push(h, { kind: 'say', from: uid, text });
    return { ok: true, seq: h.seq };
  });

  app.post('/api/house/:hostId/kick', auth, async (req: any) => {
    const uid = req.user!.id;
    const hostId = String(req.params.hostId);
    if (uid !== hostId) throw forbidden('Hanya tuan rumah yang bisa mengantar tamu pulang.');
    const target = String(req.body?.userId ?? '');
    const h = HOUSES.get(hostId);
    if (!h || !UUID.test(target) || target === uid) throw bad('invalid', 'Tamu tidak ditemukan.');
    h.kicked.set(target, Date.now() + 10 * 60_000);
    const m = h.members.get(target);
    h.members.delete(target);
    push(h, { kind: 'kick', target, name: m?.name ?? 'Tamu' });
    return { ok: true };
  });

  /* ---------------- interaksi dengan pet tuan rumah ---------------- */

  app.post('/api/visit/:id/act', auth, async (req: any) => {
    const u = req.user!;
    const hostId = await enter(req);
    if (hostId === u.id) throw bad('own_house', 'Ini rumahmu sendiri.');
    const kind = String(req.body?.kind ?? '');
    if (!(VISIT_ACTS as readonly string[]).includes(kind)) throw bad('invalid', 'Aksi tidak dikenal.');
    assertNotKicked(hostId, u.id);
    const [s, cat]: [any, any] = await Promise.all([getSettings(db), getCatalog(db)]);
    if (!s.visit.together) throw forbidden('Main bareng saat berkunjung sedang ditutup.');
    // jeda antaraksi supaya tidak bisa membanjiri buku tamu / layar pemain lain
    const pair = `${u.id}:${hostId}`;
    if (Date.now() - (LAST_ACT.get(pair) ?? 0) < ACT_GAP_MS) throw bad('too_fast', 'Pelan-pelan, pet-mu masih beraksi.');
    LAST_ACT.set(pair, Date.now());
    const res = await db.tx(async (t) => {
      // kunci baris pet selalu berurutan menurut id supaya dua pemain yang saling berkunjung tidak saling menunggu (deadlock)
      const [first, second] = [u.id, hostId].sort();
      const locked = { [first]: await lockPet(t, first), [second]: await lockPet(t, second) };
      const mine = locked[u.id], host = locked[hostId];
      if (!mine) throw bad('no_pet', 'Buat pet dulu.');
      if (!host) throw notFound(`Teman ini belum punya pet.`);
      await bumpCounter(t, u.id, `vact_all:${hostId}`, ACT_HARD_CAP).catch(() => { throw bad('daily_limit', `Sudah banyak main dengan ${host.name} hari ini. Besok lagi, ya!`); });
      const key = `vact:${hostId}`;
      const used = await counter(t, u.id, key);
      const rewarded = used < s.visit.actsPerFriend;
      let itemId: string | null = null;
      let hostDelta: Partial<Needs> = {};
      if (kind === 'camilan') {
        const it = cat.byId.get(String(req.body?.itemId ?? ''));
        if (!it || it.kind !== 'food') throw bad('invalid_item', 'Pilih makanan dari tasmu.');
        if (isAsleep(host, s)) throw bad('asleep', `${host.name} sedang tidur. Camilannya nanti saja, ya.`);
        const hn = currentNeeds(host, s);
        if (hn.kenyang >= 99) throw bad('full', `${host.name} masih kenyang.`);
        await addItem(t, u.id, it.id, -1);
        itemId = it.id;
        hostDelta = { ...(it.data?.effects ?? {}) };
        hostDelta.ceria = Number(hostDelta.ceria ?? 0) + s.visit.hostCeria;
      } else if (rewarded) hostDelta = { ceria: s.visit.hostCeria };
      for (const k of Object.keys(hostDelta)) if (!(NEED_KEYS as readonly string[]).includes(k)) delete (hostDelta as any)[k];
      // pet yang tidur tetap dielus/disapa, tapi kebutuhannya tidak berubah
      if (Object.keys(hostDelta).length && !isAsleep(host, s)) await savePet(t, hostId, { needs: applyNeedDelta(currentNeeds(host, s), hostDelta) });
      let coins = 0, xp = 0, levelUp: number | null = null;
      if (rewarded) {
        await bumpCounter(t, u.id, key, Number.MAX_SAFE_INTEGER);
        const lv = s.visit.xp ? await grantXp(t, u.id, mine, s.visit.xp) : null;
        await savePet(t, u.id, { needs: applyNeedDelta(currentNeeds(mine, s), { ceria: s.visit.ceria }), ...(lv ? { level: lv.level, xp: lv.xp } : {}) });
        if (lv?.levelsGained) levelUp = lv.level;
        xp = s.visit.xp;
        coins = Math.round(s.visit.coins * coinMultiplier(cat));
        if (coins) await credit(t, u.id, 'coin', coins, 'visit_play', hostId);
        await track(t, u.id, 'visit_play', { kind });
      }
      if (rewarded || itemId) await t.query(`insert into visit_acts (host_id, visitor_id, kind, item_id, rewarded) values ($1,$2,$3,$4,$5)`, [hostId, u.id, kind, itemId, rewarded]);
      const hostAfter = await t.one<any>(`select * from pets where user_id = $1`, [hostId]);
      return { rewarded, coins, xp, levelUp, left: Math.max(0, s.visit.actsPerFriend - used - (rewarded ? 1 : 0)), hostName: host.name, itemName: itemId ? cat.byId.get(itemId)?.name : null, hostPet: petView(hostAfter, s), out: await patch(t, u.id, ['pet', 'wallet', 'inventory']) };
    });
    // tamu lain yang sedang live melihat animasinya
    const h = HOUSES.get(hostId);
    if (h) push(h, { kind: 'act', from: u.id, act: kind, item: res.itemName });
    // tuan rumah: notifikasi maksimal sekali per tamu per jam
    const ok = await db.one(
      `insert into cooldowns (user_id, key, until) values ($1, $2, now() + interval '1 hour')
       on conflict (user_id, key) do update set until = excluded.until where cooldowns.until < now() returning 1 as ok`,
      [hostId, `notif_vplay:${u.id}`],
    );
    const aksi: Record<string, string> = { sapa: 'menyapa', peluk: 'memeluk', camilan: `memberi ${res.itemName ?? 'camilan'} untuk`, kejar: 'main kejar-kejaran dengan', duduk: 'duduk santai bareng' };
    if (ok) void notifyEvent(db, hostId, 'visit_play', { teman: u.display_name, pet: res.hostName, aksi: aksi[kind] }, { log: req.log, url: '/#bukutamu' });
    return { ok: true, kind, rewarded: res.rewarded, coins: res.coins, xp: res.xp, levelUp: res.levelUp, left: res.left, hostPet: res.hostPet, ...res.out };
  });

  /* ---------------- main bareng di rumah ---------------- */

  function coopView(c: Coop | null) {
    if (!c) return null;
    const base = { id: c.id, game: c.game, roomId: c.roomId, players: c.players.map((id) => ({ id, name: c.names[id] })), endsAt: c.endsAt, done: c.done, ok: c.ok, results: c.results, phase: c.phase, starter: c.starter, starterName: c.names[c.starter], inviteUntil: c.inviteUntil, max: COOP_MAX };
    if (c.game === 'masak') return { ...base, dish: c.dish, steps: c.recipe.length, step: c.step, recipe: c.recipe, done_steps: c.recipe.slice(0, c.step), options: c.options[c.step] ?? [], active: c.done ? null : activeCook(c), mistakes: c.mistakes };
    return { ...base, passes: c.passes, goal: BALL_GOAL, lives: c.lives, holder: c.done ? null : c.holder };
  }
  /** pemain yang masih ada (yang keluar / berhenti dilewati gilirannya) */
  function alive(c: Coop) {
    const h = HOUSES.get(c.hostId);
    const now = Date.now();
    return c.players.filter((id) => { if (c.quit.has(id)) return false; const m = h?.members.get(id); return !!m && fresh(m, now); });
  }
  function activeCook(c: Coop) {
    const a = alive(c);
    return a.length ? a[c.step % a.length] : null;
  }

  async function settleCoop(hostId: string, h: House, s: any) {
    const c = h.coop;
    // hasil permainan yang sudah selesai cukup tampil sebentar
    if (c?.done && Date.now() - c.endedAt > 20_000) { h.coop = null; return; }
    if (!c || c.done) return;
    if (c.phase === 'ajak') {
      // waktu ajakan habis: mulai bila ada yang ikut, selain itu batal (tanpa memakai jatah siapa pun)
      if (!alive(c).includes(c.starter)) return endCoop(hostId, h, s, false, 'batal');
      if (Date.now() >= c.inviteUntil) return alive(c).length >= 2 ? beginCoop(h, c) : endCoop(hostId, h, s, false, 'sepi');
      return;
    }
    const left = alive(c).length;
    if (Date.now() > c.endsAt) return endCoop(hostId, h, s, c.game === 'bola' ? c.passes >= BALL_OK : false, 'waktu');
    if (left < 2) return endCoop(hostId, h, s, c.game === 'bola' ? c.passes >= BALL_OK : false, 'bubar');
    // pemegang bola keluar: bola pindah ke pemain lain supaya permainan tidak macet
    if (c.game === 'bola' && !alive(c).includes(c.holder)) c.holder = alive(c)[0];
  }

  function beginCoop(h: House, c: Coop) {
    c.players = alive(c);
    c.phase = 'main';
    c.startedAt = Date.now(); c.endsAt = Date.now() + COOP_MS; c.lastPassAt = Date.now();
    c.holder = c.players.includes(c.starter) ? c.starter : c.players[0];
    push(h, { kind: 'coop_go', game: c.game, coopId: c.id });
  }
  /** salah satu memblokir yang lain */
  async function blockedWith(a: string, others: string[]) {
    const list = others.filter((o) => o !== a);
    if (!list.length) return new Set<string>();
    const rows = await db.query<{ other: string }>(
      `select case when user_id = $1 then blocked_id else user_id end as other from blocks
        where (user_id = $1 and blocked_id = any($2::uuid[])) or (blocked_id = $1 and user_id = any($2::uuid[]))`, [a, list]);
    return new Set(rows.map((r) => r.other));
  }

  async function endCoop(hostId: string, h: House, s: any, ok: boolean, why: string) {
    const c = h.coop!;
    if (c.done || c.settled) return;
    c.settled = true;
    c.done = true; c.ok = ok; c.endedAt = Date.now();
    // langsung dihentikan tanpa satu langkah pun: tidak ada hadiah (dan tidak memakai jatah harian)
    if (!c.moves) {
      c.results = c.players.map((id) => ({ id, name: c.names[id], coins: 0, item: null, capped: false, none: true }));
      push(h, { kind: 'coop_end', game: c.game, ok: false, why, results: c.results, coopId: c.id });
      return;
    }
    const cat = await getCatalog(db);
    const dish = c.game === 'masak' && ok && cat.byId.get(c.dish) ? c.dish : null;
    const results: any[] = [];
    for (const uid of c.players) {
      const r = await db.tx(async (t) => {
        // batas harian atomik (melempar error bila sudah habis)
        await bumpCounter(t, uid, 'coop', s.visit.coopPerDay);
        const base = c.game === 'bola' ? Math.min(1, c.passes / BALL_GOAL) : ok ? 1 : 0.3;
        const coins = Math.round(s.visit.coopCoins * Math.max(0.3, base) * coinMultiplier(cat));
        if (coins) await credit(t, uid, 'coin', coins, `coop:${c.game}`, c.id);
        if (dish) await addItem(t, uid, dish, 1);
        const pet = await lockPet(t, uid);
        if (pet) {
          const lv = s.visit.coopXp ? await grantXp(t, uid, pet, s.visit.coopXp) : null;
          await savePet(t, uid, { needs: isAsleep(pet, s) ? undefined : applyNeedDelta(currentNeeds(pet, s), { ceria: 10 }), ...(lv ? { level: lv.level, xp: lv.xp } : {}) });
        }
        if (ok) await track(t, uid, 'coop', { game: c.game });
        return { id: uid, coins, item: dish, capped: false };
      }).catch((e: any) => ({ id: uid, coins: 0, item: null, capped: e?.code === 'daily_limit' }));
      results.push({ ...r, name: c.names[uid] });
    }
    c.results = results;
    push(h, { kind: 'coop_end', game: c.game, ok, why, results, coopId: c.id });
    void hostId;
  }

  app.post('/api/house/:hostId/coop', fast, async (req: any) => {
    const s: any = await getSettings(db);
    const uid = req.user!.id;
    const hostId = await enter(req);
    const h = HOUSES.get(hostId);
    const me = h?.members.get(uid);
    if (!h || !me || !fresh(me)) throw bad('not_here', 'Masuk ke rumah dulu.');
    const b = req.body ?? {};
    await settleCoop(hostId, h, s);
    if (b.action === 'start') {
      if (h.coop && !h.coop.done) throw bad('coop_busy', 'Masih ada permainan yang berjalan di rumah ini.');
      const game = b.game === 'bola' ? 'bola' : 'masak';
      const others = [...h.members.values()].filter((m) => m.id !== uid && fresh(m));
      if (!others.length) throw bad('coop_alone', 'Butuh minimal 2 pet di rumah ini. Ajak teman main ke sini dulu!');
      const seed = randomInt(1, 2_000_000_000);
      const r = mulberry32(seed);
      const recipe: string[] = [], options: string[][] = [];
      for (let i = 0; i < COOK_STEPS; i++) {
        const want = COOK_INGREDIENTS[Math.floor(r() * COOK_INGREDIENTS.length)];
        recipe.push(want);
        const opts = new Set<string>([want]);
        while (opts.size < 4) opts.add(COOK_INGREDIENTS[Math.floor(r() * COOK_INGREDIENTS.length)]);
        options.push([...opts].sort(() => r() - 0.5));
      }
      // hanya yang memulai yang langsung ikut; yang lain diajak & memilih sendiri (jatah harian hanya terpakai bila ikut)
      h.coop = {
        id: randomUUID(), hostId, quit: new Set(), moves: 0, settled: false, game, roomId: me.roomId, players: [uid], names: { [uid]: me.name },
        phase: 'ajak', starter: uid, inviteUntil: Date.now() + INVITE_MS,
        seed, startedAt: Date.now(), endsAt: Date.now() + INVITE_MS + COOP_MS, endedAt: 0, done: false, ok: null, results: null,
        dish: DISHES[Math.floor(r() * DISHES.length)], recipe, options, step: 0, mistakes: 0,
        passes: 0, lives: 3, holder: uid, lastPassAt: Date.now(),
      };
      push(h, { kind: 'coop_start', game, from: uid, coopId: h.coop.id });
      return { ok: true, coop: coopView(h.coop) };
    }
    const c = h.coop;
    if (!c || c.done || c.id !== b.coopId) throw bad('coop_over', 'Permainan ini sudah selesai.');
    if (b.action === 'join') {
      if (c.phase !== 'ajak') throw bad('coop_started', 'Permainannya sudah dimulai.');
      if (c.players.includes(uid)) return { ok: true, coop: coopView(c) };
      if (alive(c).length >= COOP_MAX) throw bad('coop_full', 'Pemainnya sudah penuh.');
      // tidak bisa main bareng dengan pemain yang memblokir / diblokir
      if ((await blockedWith(uid, alive(c))).size) throw bad('coop_blocked', 'Kamu tidak bisa ikut permainan ini.');
      c.players.push(uid); c.names[uid] = me.name; c.quit.delete(uid);
      push(h, { kind: 'coop_join', from: uid, name: me.name, coopId: c.id });
      if (alive(c).length >= COOP_MAX) beginCoop(h, c);
      return { ok: true, coop: coopView(h.coop) };
    }
    if (!c.players.includes(uid)) throw bad('coop_not_player', 'Kamu tidak ikut permainan ini.');
    if (b.action === 'begin') {
      if (c.phase !== 'ajak') return { ok: true, coop: coopView(c) };
      if (uid !== c.starter) throw bad('not_starter', 'Hanya yang mengajak yang bisa memulai.');
      if (alive(c).length < 2) throw bad('coop_alone', 'Tunggu ada yang ikut dulu.');
      beginCoop(h, c);
      return { ok: true, coop: coopView(h.coop) };
    }
    if (c.phase === 'ajak' && b.action !== 'quit') throw bad('coop_waiting', 'Tunggu permainannya dimulai.');
    if (b.action === 'pick' && c.game === 'masak') {
      if (activeCook(c) !== uid) throw bad('not_turn', 'Belum giliranmu.');
      const good = String(b.pick) === c.recipe[c.step];
      c.moves++;
      if (good) c.step++; else c.mistakes++;
      push(h, { kind: 'coop_move', from: uid, good, pick: String(b.pick).slice(0, 12) });
      if (c.step >= c.recipe.length) await endCoop(hostId, h, s, true, 'selesai');
      else if (c.mistakes >= 3) await endCoop(hostId, h, s, false, 'salah');
    } else if (b.action === 'pass' && c.game === 'bola') {
      if (c.holder !== uid) throw bad('not_turn', 'Bola sedang dipegang pemain lain.');
      if (Date.now() - c.lastPassAt < 500) throw bad('too_fast', 'Tunggu bolanya sampai dulu.');
      const hit = b.hit === true;
      c.lastPassAt = Date.now();
      c.moves++;
      if (hit) {
        c.passes++;
        const others = alive(c).filter((id) => id !== uid);
        c.holder = others.length ? others[randomInt(0, others.length)] : uid;
      } else c.lives--;
      push(h, { kind: 'coop_move', from: uid, good: hit, to: c.holder });
      if (c.passes >= BALL_GOAL) await endCoop(hostId, h, s, true, 'selesai');
      else if (c.lives <= 0) await endCoop(hostId, h, s, c.passes >= BALL_OK, 'jatuh');
    } else if (b.action === 'quit') {
      // berhenti untuk diri sendiri; permainan selesai bila tinggal satu pemain (yang mengajak batal: ajakan selesai)
      c.quit.add(uid);
      push(h, { kind: 'coop_move', from: uid, quit: true });
      if (c.phase === 'ajak') { if (uid === c.starter) await endCoop(hostId, h, s, false, 'batal'); }
      else if (alive(c).length < 2) await endCoop(hostId, h, s, c.game === 'bola' ? c.passes >= BALL_OK : false, 'berhenti');
      else if (c.game === 'bola' && c.holder === uid) c.holder = alive(c)[0];
    } else throw bad('invalid', 'Aksi tidak dikenal.');
    return { ok: true, coop: coopView(h.coop) };
  });

  /* ---------------- foto bareng & album ---------------- */

  app.post('/api/house/:hostId/photo', auth, async (req: any) => {
    const s: any = await getSettings(db);
    const u = req.user!;
    const hostId = await enter(req);
    const roomId = String(req.body?.roomId ?? '');
    const pose = ['senyum', 'lompat', 'peluk'].includes(req.body?.pose) ? req.body.pose : 'senyum';
    if (!s.visit.together) throw forbidden('Foto bareng sedang ditutup.');
    assertNotKicked(hostId, u.id);
    const h = HOUSES.get(hostId);
    const me = h?.members.get(u.id);
    const inHouse = !!me && fresh(me);
    // yang memotret harus sedang ada di rumah itu (supaya tidak bisa memotret tamu lain dari jauh);
    // bila tuan rumah mematikan main bareng langsung, foto hanya berisi tuan rumah & yang memotret
    if (!inHouse && u.id !== hostId && (await hostLive(hostId))) throw bad('not_here', 'Masuk ke rumah temanmu dulu untuk berfoto.');
    // yang ikut berfoto: yang sedang satu ruangan dengan pemotret
    const here = h && inHouse ? [...h.members.values()].filter((m) => fresh(m) && m.roomId === me!.roomId).map((m) => m.id) : [];
    // tuan rumah selalu ikut (pet-nya ada di rumahnya sendiri), lalu yang memotret, lalu yang seruangan;
    // pemain yang saling memblokir tidak pernah ada di foto yang sama
    const ids: string[] = [];
    for (const id of [...new Set([hostId, u.id, ...here])]) {
      if (ids.length >= 6) break;
      if (ids.length && (await blockedWith(id, ids)).size) continue;
      ids.push(id);
    }
    if (ids.length < 2) throw bad('photo_alone', 'Foto bareng butuh minimal 2 pet. Berkunjunglah ke rumah teman!');
    const cat = await getCatalog(db);
    const rooms = await loadRooms(db, hostId, cat, s, false);
    const room = rooms.find((r: any) => r.id === roomId) ?? rooms[0];
    const members: any[] = [];
    for (const id of ids) { const info = await memberInfo(id); if (info.pet) members.push({ id, name: info.name, pet: info.pet }); }
    if (members.length < 2) throw bad('photo_alone', 'Foto bareng butuh minimal 2 pet.');
    const photo = await db.tx(async (t) => {
      await bumpCounter(t, u.id, 'photo', s.visit.photoPerDay);
      const p = (await t.one<any>(
        `insert into photos (host_id, taken_by, pose, members, scene) values ($1,$2,$3,$4::text::jsonb,$5::text::jsonb) returning id, host_id, pose, members, scene, created_at`,
        [hostId, u.id, pose, JSON.stringify(members), JSON.stringify({ wall: room?.wall ?? null, floor: room?.floor ?? null, theme: room?.theme ?? 'dalam' })],
      ))!;
      for (const m of members) {
        await t.query(`insert into photo_members (photo_id, user_id) values ($1,$2) on conflict do nothing`, [p.id, m.id]);
        // foto pertama langsung dipajang di lukisan rumah (kecuali pemain memilih tidak memajang foto)
        await t.query(`update users set featured_photo = $2 where id = $1 and featured_photo is null and not photo_off`, [m.id, p.id]);
      }
      await track(t, u.id, 'photo', {});
      return p;
    });
    if (h) push(h, { kind: 'photo', from: u.id, photoId: photo.id });
    // notifikasi maksimal sekali per pemotret per jam untuk tiap pemain di foto
    for (const m of members) {
      if (m.id === u.id) continue;
      const ok = await db.one(
        `insert into cooldowns (user_id, key, until) values ($1, $2, now() + interval '1 hour')
         on conflict (user_id, key) do update set until = excluded.until where cooldowns.until < now() returning 1 as ok`, [m.id, `notif_photo:${u.id}`]);
      if (ok) void notifyEvent(db, m.id, 'house_photo', { teman: u.display_name, jumlah: members.length }, { log: req.log, url: '/#album' });
    }
    return { ok: true, photo: photoView(photo) };
  });

  const photoView = (p: any) => ({ id: p.id, hostId: p.host_id, pose: p.pose, members: p.members, scene: p.scene, createdAt: new Date(p.created_at).getTime() });

  app.get('/api/photos', auth, async (req: any) => {
    const uid = req.user!.id;
    const [rows, me] = await Promise.all([
      db.query<any>(`select p.* from photos p join photo_members m on m.photo_id = p.id where m.user_id = $1 order by p.created_at desc limit 60`, [uid]),
      db.one<{ featured_photo: string | null }>(`select featured_photo from users where id = $1`, [uid]),
    ]);
    return { photos: rows.map(photoView), featured: me?.featured_photo ?? null };
  });

  app.post('/api/photos/:id/feature', auth, async (req: any) => {
    const uid = req.user!.id;
    const id = String(req.params.id);
    // "off" diingat supaya foto berikutnya tidak otomatis dipajang lagi
    if (req.body?.off === true) { await db.query(`update users set featured_photo = null, photo_off = true where id = $1`, [uid]); return { ok: true, featured: null }; }
    if (!UUID.test(id) || !(await db.one(`select 1 from photo_members where photo_id = $1 and user_id = $2`, [id, uid]))) throw notFound('Foto tidak ditemukan.');
    await db.query(`update users set featured_photo = $2, photo_off = false where id = $1`, [uid, id]);
    return { ok: true, featured: id };
  });

  /** Hapus foto dari albumku (foto tetap ada di album pemain lain). */
  app.delete('/api/photos/:id', auth, async (req: any) => {
    const uid = req.user!.id;
    const id = String(req.params.id);
    if (!UUID.test(id)) throw notFound('Foto tidak ditemukan.');
    await db.query(`delete from photo_members where photo_id = $1 and user_id = $2`, [id, uid]);
    await db.query(`update users set featured_photo = null where id = $1 and featured_photo = $2`, [uid, id]);
    return { ok: true };
  });

  /* ---------------- blokir ---------------- */

  /** Blokir: putus pertemanan dua arah, tidak bisa saling menambah teman / berkunjung lagi, langsung dikeluarkan dari rumah. */
  app.post('/api/blocks', auth, async (req: any) => {
    const uid = req.user!.id;
    const other = String(req.body?.userId ?? '');
    if (!UUID.test(other) || other === uid) throw bad('invalid', 'Pemain tidak valid.');
    await db.tx(async (t) => {
      await t.query(`insert into blocks (user_id, blocked_id) values ($1,$2) on conflict do nothing`, [uid, other]);
      await t.query(`delete from friendships where (user_id = $1 and friend_id = $2) or (user_id = $2 and friend_id = $1)`, [uid, other]);
    });
    forgetFriend(uid, other);
    const h = HOUSES.get(uid);
    if (h?.members.has(other)) { const m = h.members.get(other)!; h.members.delete(other); push(h, { kind: 'kick', target: other, name: m.name }); }
    return { ok: true };
  });
  app.get('/api/blocks', auth, async (req: any) => ({
    blocks: await db.query(`select b.blocked_id as id, u.display_name as name, b.created_at from blocks b join users u on u.id = b.blocked_id where b.user_id = $1 order by b.created_at desc`, [req.user!.id]),
  }));
  app.delete('/api/blocks/:id', auth, async (req: any) => {
    await db.query(`delete from blocks where user_id = $1 and blocked_id = $2`, [req.user!.id, String(req.params.id)]);
    return { ok: true };
  });

  /* ---------------- buku tamu, status online & privasi ---------------- */

  app.get('/api/guestbook', auth, async (req: any) => {
    const uid = req.user!.id;
    const [rows, me] = await Promise.all([
      db.query<any>(
        `select a.kind, a.item_id, a.created_at, u.id as visitor_id, u.display_name as name, p.name as pet_name, p.color, p.ear, p.pattern, p.eyes, p.tail, p.wear
           from visit_acts a join users u on u.id = a.visitor_id left join pets p on p.user_id = a.visitor_id
          where a.host_id = $1 order by a.created_at desc limit 50`, [uid]),
      db.one<{ guestbook_seen_at: Date }>(`select guestbook_seen_at from users where id = $1`, [uid]),
    ]);
    await db.query(`update users set guestbook_seen_at = now() where id = $1`, [uid]);
    const seen = me ? new Date(me.guestbook_seen_at).getTime() : 0;
    return { entries: rows.map((r) => ({ ...r, created_at: new Date(r.created_at).getTime(), unread: new Date(r.created_at).getTime() > seen })) };
  });

  app.post('/api/presence', { ...auth, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req: any) => {
    const where = ['home', 'map', 'game', 'visit'].includes(req.body?.where) ? req.body.where : 'game';
    const host = UUID.test(String(req.body?.host ?? '')) ? String(req.body.host) : undefined;
    PRESENCE.set(req.user!.id, { at: Date.now(), where, host });
    return { ok: true };
  });

  app.post('/api/me/privacy', auth, async (req: any) => {
    const uid = req.user!.id;
    const b = req.body ?? {};
    if (typeof b.showOnline === 'boolean') await db.query(`update users set show_online = $2 where id = $1`, [uid, b.showOnline]);
    if (typeof b.liveVisits === 'boolean') { await db.query(`update users set live_visits = $2 where id = $1`, [uid, b.liveVisits]); HOSTPREF.delete(uid); }
    if (b.showOnline === false) PRESENCE.delete(uid);
    const r = await db.one<{ show_online: boolean; live_visits: boolean }>(`select show_online, live_visits from users where id = $1`, [uid]);
    return { ok: true, showOnline: r?.show_online ?? true, liveVisits: r?.live_visits ?? true };
  });
}

/** Untuk uji: kosongkan keadaan live. */
export function resetHouses() { HOUSES.clear(); PRESENCE.clear(); FRIENDS.clear(); HOSTPREF.clear(); SAID.clear(); LAST_ACT.clear(); }
/** Untuk uji: lewati jeda antaraksi. */
export function resetActGap() { LAST_ACT.clear(); }
