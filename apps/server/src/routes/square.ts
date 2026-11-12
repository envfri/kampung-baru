// Alun-alun: tempat berkumpul semua pemain (bukan hanya teman), maksimal 20 orang per alun-alun;
// bila penuh otomatis dibuka Alun-alun 2, 3, ... Polling seperti rumah live (±1 detik), keadaan di memori.
//  - obrolan tersaring (frasa siap pakai + ketik bebas bila diizinkan admin), dicatat untuk moderasi;
//  - pemain yang saling memblokir tidak saling melihat sama sekali;
//  - laporan hanya dari orang yang benar-benar bertemu di alun-alun; 3 pelapor berbeda dalam 1 jam membisukan obrolan
//    30 menit (tersimpan di users.chat_muted_until, tidak diperpanjang terus, bisa dibuka moderator);
//  - hiburan: panggung terjadwal, komidi putar, ayunan, beringin, bangku, joget bareng saat musik, jajanan, foto bareng.
import type { FastifyInstance } from 'fastify';
import { ALUN_ROOM, ALUN_SIZE, applyNeedDelta, petLookState, SQUARE_PLAY, SQUARE_SNACKS, squareShow, type Needs } from '@kb/shared';
import type { Db } from '../db/index';
import { bad, bumpCounter, checkChat, coinMultiplier, counter, credit, forbidden, getCatalog, getSettings, track } from '../lib/core';
import { requireUser } from '../lib/auth';
import { currentNeeds, isAsleep, lockPet, petView, savePet } from '../lib/state';
import { grantXp, patch } from './game';
import { EMOTES, markPresence } from './house';
import { takePings } from '../lib/pings';
import { barengViews } from './bareng';

const LIVE_MS = 10_000;
/** jeda antaraksi di alun-alun per pemain */
const ACT_GAP_MS = 3000;
/** pemain baru di alun-alun belum bisa melapor (mencegah akun sekali pakai) */
const REPORT_AFTER_MS = 60_000;
const ACTS_LIVE = new Set(['jalan', 'duduk', 'lihat', 'joget', 'naik', 'ayun']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
type Member = { id: string; name: string; pet: any; x: number; y: number; flip: boolean; act: string | null; seenAt: number; joinedAt: number; petAt: number; emoteAt: number; jogetAt: number };
type Ev = { seq: number; at: number; kind: string; from?: string; [k: string]: unknown };
type Square = { id: number; members: Map<string, Member>; events: Ev[]; seq: number };

const SQUARES = new Map<number, Square>();
/** alun-alun tempat tiap pemain berada */
const WHERE = new Map<string, number>();
/** terakhir terlihat di alun-alun mana (untuk memeriksa laporan: pelapor & yang dilaporkan harus pernah bertemu) */
const SEEN = new Map<string, { inst: number; at: number }>();
const SAID = new Map<string, number>();
const LAST_ACT = new Map<string, number>();
/** kapan terakhir pemain "datang" (kabar masuk tidak diulang bila keluar-masuk cepat) */
const JOINED = new Map<string, number>();
/** cache status bisu (dari database) */
const MUTE_CACHE = new Map<string, { at: number; until: number }>();
/** cache daftar blokir per pemain (dua arah) */
const BLOCKS = new Map<string, { at: number; ids: Set<string> }>();
const BOOT = Math.random().toString(36).slice(2, 10);
/** nomor urut kejadian bersama untuk semua alun-alun: alun-alun yang dibuat ulang tidak mulai dari 0 lagi */
let SEQ = 0;
const fresh = (m: Member, now = Date.now()) => now - m.seenAt < LIVE_MS;
/** jam alun-alun (bisa diganti di uji supaya jadwal panggung pasti) */
let clock = () => Date.now();
export function setSquareClock(fn: () => number) { clock = fn; }
/** angka pengaturan: 0 dihormati (tidak dianggap kosong) */
const numOr = (v: unknown, def: number) => (typeof v === 'number' && Number.isFinite(v) ? v : def);

function squareOf(id: number) {
  let q = SQUARES.get(id);
  if (!q) { q = { id, members: new Map(), events: [], seq: SEQ }; SQUARES.set(id, q); }
  return q;
}
function push(q: Square, ev: Omit<Ev, 'seq' | 'at'>) {
  q.seq = ++SEQ;
  q.events.push({ ...ev, seq: q.seq, at: Date.now() } as Ev);
  const cut = Date.now() - 60_000;
  while (q.events.length > 200 || (q.events.length && q.events[0].at < cut)) q.events.shift();
}
function prune(q: Square) {
  const now = Date.now();
  for (const m of q.members.values()) if (!fresh(m, now)) { q.members.delete(m.id); if (WHERE.get(m.id) === q.id) WHERE.delete(m.id); push(q, { kind: 'leave', from: m.id, name: m.name }); }
}
const count = (q: Square) => { const now = Date.now(); let n = 0; for (const m of q.members.values()) if (fresh(m, now)) n++; return n; };
setInterval(() => {
  const now = Date.now();
  for (const [id, q] of SQUARES) { prune(q); if (!q.members.size) SQUARES.delete(id); }
  for (const [k, v] of SAID) if (now - v > 60_000) SAID.delete(k);
  for (const [k, v] of LAST_ACT) if (now - v > 60_000) LAST_ACT.delete(k);
  for (const [k, v] of JOINED) if (now - v > 60_000) JOINED.delete(k);
  for (const [k, v] of SEEN) if (now - v.at > 15 * 60_000) SEEN.delete(k);
  for (const [k, v] of MUTE_CACHE) if (now - v.at > 120_000) MUTE_CACHE.delete(k);
  for (const [k, v] of BLOCKS) if (now - v.at > 120_000) BLOCKS.delete(k);
}, 60_000).unref?.();

/** Jumlah orang di tiap alun-alun (untuk peta & daftar teman). */
export function squareCounts() {
  return [...SQUARES.values()].map((q) => ({ id: q.id, count: count(q) })).filter((x) => x.count > 0).sort((a, b) => a.id - b.id);
}
/** Daftar blokir berubah: lupakan cache supaya langsung berlaku di alun-alun. */
export function forgetBlocks(a: string, b: string) { BLOCKS.delete(a); BLOCKS.delete(b); }
/** Status bisu diubah admin: berlaku langsung. */
export function forgetMute(uid: string) { MUTE_CACHE.delete(uid); }
/** uji: hapus jeda antaraksi */
export function resetSquareActGap() { LAST_ACT.clear(); }
/** Dua pemain sedang/baru saja (10 menit) berada di alun-alun yang sama (data dari sinkron, tidak bisa dipalsukan). */
export function metInSquare(a: string, b: string, ms = 10 * 60_000) {
  const x = SEEN.get(a), y = SEEN.get(b), now = Date.now();
  return !!x && !!y && x.inst === y.inst && now - x.at < ms && now - y.at < ms;
}
/** Pemain yang sedang live di alun-alun nomor inst. */
export function squareMembers(inst: number) {
  const q = SQUARES.get(inst);
  const now = Date.now();
  return q ? [...q.members.values()].filter((m) => fresh(m, now)).map((m) => ({ id: m.id, name: m.name, pet: m.pet })) : [];
}
/** Alun-alun tempat pemain sedang live & siapa saja di sana (untuk game main bareng). */
export function squareLiveOf(uid: string) {
  const id = WHERE.get(uid);
  const q = id ? SQUARES.get(id) : undefined;
  const now = Date.now();
  if (!q || !q.members.get(uid) || !fresh(q.members.get(uid)!, now)) return null;
  return { inst: q.id, members: [...q.members.values()].filter((m) => fresh(m, now)).map((m) => ({ id: m.id, name: m.name, pet: m.pet })) };
}
export function resetSquares() { SQUARES.clear(); WHERE.clear(); SEEN.clear(); SAID.clear(); LAST_ACT.clear(); JOINED.clear(); MUTE_CACHE.clear(); BLOCKS.clear(); }

export default async function squareRoutes(app: FastifyInstance, { db }: { db: Db }) {
  const auth = { preHandler: requireUser(db) };
  const fast = { ...auth, config: { rateLimit: { max: 400, timeWindow: '1 minute' } } };

  async function settings() {
    const s: any = await getSettings(db);
    const a = s.square ?? {};
    return { s, a, open: a.enabled !== false, max: Math.max(2, Math.min(50, numOr(a.max, 20))) };
  }
  async function blocksOf(uid: string) {
    const c = BLOCKS.get(uid);
    if (c && Date.now() - c.at < 60_000) return c.ids;
    const rows = await db.query<{ other: string }>(`select case when user_id = $1 then blocked_id else user_id end as other from blocks where user_id = $1 or blocked_id = $1`, [uid]);
    const ids = new Set(rows.map((r) => r.other));
    BLOCKS.set(uid, { at: Date.now(), ids });
    return ids;
  }
  /** dibisukan sampai kapan (0 = tidak) */
  async function mutedUntil(uid: string) {
    const c = MUTE_CACHE.get(uid);
    if (c && Date.now() - c.at < 30_000) return c.until;
    const r = await db.one<{ until: string | null }>(`select chat_muted_until as until from users where id = $1`, [uid]);
    const until = r?.until ? new Date(r.until).getTime() : 0;
    MUTE_CACHE.set(uid, { at: Date.now(), until });
    return until;
  }
  async function memberInfo(uid: string) {
    const s = await getSettings(db);
    const r = await db.one<any>(`select u.display_name, p.* from users u left join pets p on p.user_id = u.id where u.id = $1`, [uid]);
    if (!r?.name) return { name: r?.display_name ?? 'Pemain', pet: null, asleep: false };
    const v = petView({ ...r, user_id: uid }, s);
    return { name: r.display_name, asleep: !!v.sleep, pet: { name: v.name, color: v.color, ear: v.ear, pattern: v.pattern, eyes: v.eyes, tail: v.tail, wear: v.wear, level: v.level, state: petLookState(v.needs, { sleeping: !!v.sleep, sick: v.sick, chub: v.chub }) } };
  }
  const view = (m: Member) => ({ id: m.id, name: m.name, pet: m.pet, roomId: ALUN_ROOM, x: m.x, y: m.y, flip: m.flip, act: m.act, host: false });
  /** alun-alun pemain ini sekarang (atau null bila belum masuk) */
  const here = (uid: string) => { const id = WHERE.get(uid); const q = id ? SQUARES.get(id) : undefined; const m = q?.members.get(uid); return q && m && fresh(m) ? { q, m } : null; };
  const closed = () => forbidden('Alun-alun sedang ditutup.');

  /** Pilih alun-alun: tetap di tempat sekarang, susul teman (want) bila masih muat, selain itu yang terisi paling awal & belum penuh. */
  function assign(uid: string, want: number, max: number) {
    const cur = WHERE.get(uid);
    if (cur && SQUARES.get(cur)?.members.has(uid)) return cur;
    if (want && SQUARES.has(want) && count(SQUARES.get(want)!) < max) return want;
    const ids = [...SQUARES.keys()].sort((a, b) => a - b);
    for (const id of ids) if (count(SQUARES.get(id)!) < max) return id;
    let id = 1;
    while (SQUARES.has(id)) id++;
    return id;
  }

  app.post('/api/square/sync', fast, async (req: any) => {
    const { a, open, max } = await settings();
    const uid = req.user!.id;
    if (!open) return { live: false, reason: 'off' };
    const b = req.body ?? {};
    const since = Math.max(0, Number(b.since) || 0);
    const num = (v: unknown) => Math.max(0.5, Math.min(ALUN_SIZE - 0.5, Number(v) || 0));
    const now0 = clock();
    let id = assign(uid, Number(b.inst) || 0, max);
    let q = squareOf(id);
    prune(q);
    let m = q.members.get(uid);
    let joined = false;
    if (!m) {
      const info = await memberInfo(uid);
      if (!info.pet) throw bad('no_pet', 'Buat pet dulu, ya.');
      if (info.asleep) return { live: false, reason: 'asleep' };
      // permintaan lain bisa sudah mengisi alun-alun ini selama menunggu data pet
      id = assign(uid, id, max);
      q = squareOf(id);
      m = q.members.get(uid);
      if (!m) {
        m = { id: uid, name: info.name, pet: info.pet, x: num(b.x), y: num(b.y), flip: !!b.flip, act: null, seenAt: Date.now(), joinedAt: Date.now(), petAt: Date.now(), emoteAt: 0, jogetAt: 0 };
        q.members.set(uid, m);
        // pindah dari alun-alun lain
        const old = WHERE.get(uid);
        if (old && old !== id) { const oq = SQUARES.get(old); const om = oq?.members.get(uid); if (oq && om) { oq.members.delete(uid); push(oq, { kind: 'leave', from: uid, name: om.name }); } }
        WHERE.set(uid, id);
        // keluar-masuk cepat tidak membanjiri kabar "datang"
        if (Date.now() - (JOINED.get(uid) ?? 0) > 15_000) push(q, { kind: 'join', from: uid, name: m.name });
        JOINED.set(uid, Date.now());
        joined = true;
      }
    }
    m.x = num(b.x); m.y = num(b.y); m.flip = !!b.flip; m.seenAt = Date.now();
    // joget hanya tampil saat musik main (bonus joget bareng dihitung dari aksi joget, bukan dari sinkron)
    m.act = typeof b.act === 'string' && ACTS_LIVE.has(b.act) && (b.act !== 'joget' || squareShow(now0).music) ? b.act : null;
    SEEN.set(uid, { inst: id, at: Date.now() });
    if (typeof b.emote === 'string' && (EMOTES as readonly string[]).includes(b.emote) && Date.now() - m.emoteAt > 600) {
      m.emoteAt = Date.now();
      push(q, { kind: 'emote', from: uid, emote: b.emote });
    }
    if (Date.now() - m.petAt > 45_000) { m.petAt = Date.now(); const info = await memberInfo(uid); if (info.pet) m.pet = info.pet; m.name = info.name; }
    markPresence(uid, 'alun', String(id));
    // hadiah kunjungan pertama hari ini
    let welcome: any = null;
    const daily = numOr(a.dailyCoins, 15);
    if (joined && daily > 0) {
      // katalog dimuat di luar transaksi (PGlite: query lewat db di dalam tx = macet)
      const cat = await getCatalog(db);
      welcome = await db.tx(async (t) => {
        const used = await counter(t, uid, 'square_visit');
        if (used >= 1) return null;
        await bumpCounter(t, uid, 'square_visit', 1);
        const coins = Math.round(daily * coinMultiplier(cat));
        await credit(t, uid, 'coin', coins, 'square', 'kunjungan');
        await track(t, uid, 'square_visit', {});
        return { coins, ...(await patch(t, uid, ['wallet'])) };
      }).catch(() => null);
    }
    const now = Date.now();
    const blocked = await blocksOf(uid);
    const all = [...q.members.values()].filter((x) => fresh(x, now) && x.id !== uid && !blocked.has(x.id));
    return {
      live: true, me: uid, inst: id, count: count(q), max, boot: BOOT, seq: q.seq,
      members: all.map(view), elsewhere: [],
      // kejadian dari pemain yang saling memblokir tidak dikirim
      events: q.events.filter((e) => e.seq > since && !(e.from && blocked.has(e.from))),
      show: squareShow(now0), coop: null, welcome, serverNow: now,
      others: squareCounts().filter((x) => x.id !== id),
      mutedUntil: (await mutedUntil(uid)) || null,
      pings: takePings(uid),
      games: barengViews(`a:${id}`),
    };
  });

  app.post('/api/square/leave', { ...auth, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req: any) => {
    const uid = req.user!.id;
    const h = here(uid);
    if (h) { h.q.members.delete(uid); push(h.q, { kind: 'leave', from: uid, name: h.m.name }); }
    WHERE.delete(uid);
    return { ok: true };
  });

  app.post('/api/square/say', { ...auth, config: { rateLimit: { max: 40, timeWindow: '1 minute' } } }, async (req: any) => {
    const { a, open } = await settings();
    if (!open) throw closed();
    const uid = req.user!.id;
    const h = here(uid);
    if (!h) throw bad('not_here', 'Masuk ke alun-alun dulu.');
    const until = await mutedUntil(uid);
    if (until > Date.now()) throw forbidden(`Obrolanmu sedang dibatasi sampai pukul ${new Date(until).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })} karena laporan pemain lain.`);
    if (Date.now() - (SAID.get(uid) ?? 0) < 1500) throw bad('too_fast', 'Pelan-pelan, ya.');
    const raw = String(req.body?.text ?? '').replace(/\s+/g, ' ').trim();
    const max = Math.max(10, Math.min(200, numOr(a.chatMax, 80)));
    if (!raw) throw bad('empty', 'Tulis pesan dulu.');
    if (raw.length > max) throw bad('too_long', `Pesan maksimal ${max} huruf.`);
    const preset = (a.phrases ?? []).includes(raw);
    let text = raw;
    if (!preset) {
      if (a.freeChat === false) throw bad('preset_only', 'Di alun-alun pilih salah satu frasa yang tersedia.');
      // simpan & siarkan teks yang sudah dibersihkan filter (bukan teks mentah)
      text = await checkChat(db, raw, uid);
      if (!text) throw bad('empty', 'Tulis pesan dulu.');
    }
    SAID.set(uid, Date.now());
    await db.query(`insert into square_chat (inst, user_id, text) values ($1,$2,$3)`, [h.q.id, uid, text]);
    push(h.q, { kind: 'say', from: uid, text });
    return { ok: true, seq: h.q.seq };
  });

  /** Main di alun-alun: nonton, naik komidi putar, ayunan, berteduh, duduk, joget (hadiah harian terbatas) dan jajan. */
  app.post('/api/square/act', { ...auth, config: { rateLimit: { max: 40, timeWindow: '1 minute' } } }, async (req: any) => {
    const { s, a, open } = await settings();
    if (!open) throw closed();
    const uid = req.user!.id;
    const h = here(uid);
    if (!h) throw bad('not_here', 'Masuk ke alun-alun dulu.');
    if (Date.now() - (LAST_ACT.get(uid) ?? 0) < ACT_GAP_MS) throw bad('too_fast', 'Sebentar, ya. Pet-mu masih asyik.');
    const kind = String(req.body?.kind ?? '');
    const cat = await getCatalog(db);
    if (kind === 'jajan') {
      const snackId = String(req.body?.item ?? '');
      const snack = SQUARE_SNACKS[snackId];
      if (!snack) throw bad('invalid', 'Jajanan tidak dikenal.');
      LAST_ACT.set(uid, Date.now());
      return db.tx(async (t) => {
        await bumpCounter(t, uid, 'square_snack', Math.max(0, numOr(a.snacksPerDay, 5)));
        await credit(t, uid, 'coin', -snack.coins, 'square_snack', snackId);
        const pet = await lockPet(t, uid);
        if (!pet) throw bad('no_pet', 'Buat pet dulu.');
        if (isAsleep(pet, s)) throw bad('asleep', 'Pet sedang tidur.');
        await savePet(t, uid, { needs: applyNeedDelta(currentNeeds(pet, s), { kenyang: snack.kenyang, ceria: snack.ceria } as Partial<Needs>) });
        await track(t, uid, 'square_act', { kind: 'jajan', item: snackId });
        return { ok: true, kind, snack: snack.name, ...(await patch(t, uid, ['pet', 'wallet'])) };
      });
    }
    if (!(SQUARE_PLAY as readonly string[]).includes(kind)) throw bad('invalid', 'Aksi tidak dikenal.');
    const show = squareShow(clock());
    if (kind === 'nonton' && !show.playing) throw bad('show_break', `Pertunjukan berikutnya, ${show.next.name}, mulai sebentar lagi.`);
    if (kind === 'joget' && !show.music) throw bad('no_music', 'Joget saat ada musik di panggung, ya.');
    LAST_ACT.set(uid, Date.now());
    if (kind === 'joget') h.m.jogetAt = Date.now();
    // joget bareng: makin ramai yang joget (dari aksi joget sungguhan), makin ceria
    const blocked = kind === 'joget' ? await blocksOf(uid) : new Set<string>();
    const dancers = kind === 'joget' ? [...h.q.members.values()].filter((m) => fresh(m) && !blocked.has(m.id) && Date.now() - m.jogetAt < 8000).length : 0;
    const cap = Math.max(0, numOr(a.actsPerDay, 10));
    const res = await db.tx(async (t) => {
      let rewarded = (await counter(t, uid, 'square_play')) < cap;
      if (rewarded) {
        // dua aksi bersamaan di ujung batas: yang kalah tetap jalan, hanya tanpa hadiah
        try { await bumpCounter(t, uid, 'square_play', cap); } catch (e: any) { if (e?.code === 'daily_limit') rewarded = false; else throw e; }
      }
      const pet = await lockPet(t, uid);
      if (!pet) throw bad('no_pet', 'Buat pet dulu.');
      if (isAsleep(pet, s)) throw bad('asleep', 'Pet sedang tidur.');
      // lewat batas harian: tetap boleh main (seru bareng), tapi tanpa koin, XP, ceria, atau kemajuan tugas
      if (!rewarded) return { rewarded, coins: 0, xp: 0, levelUp: null, ceria: 0, left: 0, out: null };
      const ceria = numOr(a.ceria, 6) + (dancers >= 3 ? 4 : 0);
      const coins = Math.round(numOr(a.actCoins, 3) * coinMultiplier(cat));
      if (coins) await credit(t, uid, 'coin', coins, 'square_play', kind);
      const xp = numOr(a.actXp, 2);
      const lv = xp ? await grantXp(t, uid, pet, xp) : null;
      await savePet(t, uid, { needs: applyNeedDelta(currentNeeds(pet, s), { ceria } as Partial<Needs>), ...(lv ? { level: lv.level, xp: lv.xp } : {}) });
      await track(t, uid, 'square_act', { kind });
      const used = await counter(t, uid, 'square_play');
      return { rewarded, coins, xp, levelUp: lv && lv.levelsGained > 0 ? lv.level : null, ceria, left: Math.max(0, cap - used), out: await patch(t, uid, ['pet', 'wallet']) };
    });
    push(h.q, { kind: 'act', from: uid, act: kind });
    return { ok: true, kind, rewarded: res.rewarded, coins: res.coins, xp: res.xp, levelUp: res.levelUp, ceria: res.ceria, left: res.left, crowd: dancers, ...(res.out ?? {}) };
  });

  /**
   * Foto bareng di alun-alun: pet di sekitar yang memotret (radius 4 petak), tanpa pemain yang saling memblokir.
   * Foto masuk album yang memotret & temannya yang ikut difoto saja (orang asing tidak dikirimi foto).
   */
  app.post('/api/square/photo', auth, async (req: any) => {
    const { s, open } = await settings();
    if (!open) throw closed();
    const uid = req.user!.id;
    const h = here(uid);
    if (!h) throw bad('not_here', 'Masuk ke alun-alun dulu.');
    const pose = ['senyum', 'lompat', 'peluk'].includes(req.body?.pose) ? req.body.pose : 'senyum';
    // posisi terbaru dari HP (sinkron bisa tertinggal ±1 detik); tidak boleh melompat jauh dari posisi terakhir
    const bx = Number(req.body?.x), by = Number(req.body?.y);
    if (Number.isFinite(bx) && Number.isFinite(by) && Math.hypot(bx - h.m.x, by - h.m.y) <= 3) { h.m.x = Math.max(0.5, Math.min(ALUN_SIZE - 0.5, bx)); h.m.y = Math.max(0.5, Math.min(ALUN_SIZE - 0.5, by)); }
    const blocked = await blocksOf(uid);
    const near = [...h.q.members.values()]
      .filter((m) => m.id !== uid && fresh(m) && !blocked.has(m.id) && Math.hypot(m.x - h.m.x, m.y - h.m.y) <= 4)
      .sort((p, q2) => Math.hypot(p.x - h.m.x, p.y - h.m.y) - Math.hypot(q2.x - h.m.x, q2.y - h.m.y));
    const ids = [uid];
    for (const m of near) {
      if (ids.length >= 6) break;
      // dua orang lain yang saling memblokir tidak difoto bersama
      if ([...(await blocksOf(m.id))].some((o) => ids.includes(o))) continue;
      ids.push(m.id);
    }
    if (ids.length < 2) throw bad('photo_alone', 'Ajak pet lain mendekat dulu supaya bisa foto bareng.');
    const members: any[] = [];
    for (const id of ids) { const info = await memberInfo(id); if (info.pet) members.push({ id, name: info.name, pet: info.pet }); }
    const friends = new Set((await db.query<{ friend_id: string }>(`select friend_id from friendships where user_id = $1 and friend_id = any($2::uuid[])`, [uid, ids])).map((r) => r.friend_id));
    const photo = await db.tx(async (t) => {
      await bumpCounter(t, uid, 'photo', numOr((s as any).visit?.photoPerDay, 6));
      const p = (await t.one<any>(
        `insert into photos (host_id, taken_by, pose, members, scene) values ($1,$2,$3,$4::text::jsonb,$5::text::jsonb) returning id, host_id, pose, members, scene, created_at`,
        [uid, uid, pose, JSON.stringify(members), JSON.stringify({ theme: 'alun', floor: null, wall: null })],
      ))!;
      for (const m of members) if (m.id === uid || friends.has(m.id)) await t.query(`insert into photo_members (photo_id, user_id) values ($1,$2) on conflict do nothing`, [p.id, m.id]);
      // tidak dihitung sebagai foto di rumah teman (lencana Kenangan Bareng)
      await track(t, uid, 'square_act', { kind: 'foto' });
      return p;
    });
    push(h.q, { kind: 'photo', from: uid, photoId: photo.id, members: members.map((m) => m.id) });
    return { ok: true, photo };
  });

  /**
   * Laporkan pemain (obrolan / perilaku). Pelapor harus sedang di alun-alun minimal 1 menit dan yang dilaporkan harus
   * sedang/baru saja (10 menit) di alun-alun yang sama. Tiga pelapor berbeda dalam 1 jam membisukan obrolannya 30 menit,
   * sekali saja (laporan sebelum bisu berakhir tidak dihitung lagi).
   */
  app.post('/api/square/report', { ...auth, config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (req: any) => {
    const uid = req.user!.id;
    const target = String(req.body?.userId ?? '').toLowerCase();
    const reason = String(req.body?.reason ?? '').normalize('NFKC').replace(/\p{Cf}/gu, '').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!UUID.test(target) || target === uid) throw bad('invalid', 'Pemain tidak valid.');
    const h = here(uid);
    if (!h) throw bad('not_here', 'Laporkan dari dalam alun-alun, ya.');
    const seen = SEEN.get(target);
    if (!seen || seen.inst !== h.q.id || Date.now() - seen.at > 10 * 60_000) throw bad('not_met', 'Pemain itu tidak sedang di alun-alun ini.');
    if (clock() - h.m.joinedAt < REPORT_AFTER_MS) throw bad('too_soon', 'Tunggu sebentar di alun-alun sebelum melapor, ya.');
    const muted = await db.tx(async (t) => {
      await bumpCounter(t, uid, 'report', 20);
      // bukti: obrolannya di alun-alun ini 30 menit terakhir
      const said = await t.query<{ text: string; created_at: string }>(
        `select text, created_at from square_chat where user_id = $1 and inst = $2 and created_at > now() - interval '30 minutes' order by created_at desc limit 5`, [target, h.q.id]);
      await t.query(`insert into reports (reporter_id, target_id, place, reason, evidence) values ($1,$2,'alun',$3,$4::text::jsonb)`, [uid, target, reason || null, JSON.stringify(said)]);
      const n = await t.one<{ c: number }>(
        `select count(distinct r.reporter_id)::int c from reports r join users u on u.id = r.target_id
          where r.target_id = $1 and r.created_at > greatest(now() - interval '1 hour', coalesce(u.chat_muted_until, '-infinity'::timestamptz))`, [target]);
      if ((n?.c ?? 0) < 3) return false;
      const m = await t.one(`update users set chat_muted_until = now() + interval '30 minutes' where id = $1 and (chat_muted_until is null or chat_muted_until < now()) returning id`, [target]);
      return !!m;
    });
    if (muted) MUTE_CACHE.delete(target);
    return { ok: true };
  });

  /** Ketersediaan alun-alun untuk peta (jumlah orang). */
  app.get('/api/square', auth, async () => {
    const { open, max } = await settings();
    return { enabled: open, max, squares: squareCounts(), show: squareShow(clock()) };
  });
}
