// Alun-alun: tempat berkumpul semua pemain (bukan hanya teman), maksimal 20 orang per alun-alun;
// bila penuh otomatis dibuka Alun-alun 2, 3, ... Polling seperti rumah live (±1 detik), keadaan di memori.
//  - obrolan tersaring (frasa siap pakai + ketik bebas bila diizinkan admin), dicatat untuk moderasi;
//  - pemain yang saling memblokir tidak saling melihat sama sekali;
//  - laporan hanya dari orang yang benar-benar bertemu di alun-alun; 3 pelapor berbeda dalam 1 jam membisukan obrolan
//    30 menit (tersimpan di users.chat_muted_until, tidak diperpanjang terus, bisa dibuka moderator);
//  - hiburan: panggung terjadwal (8 acara), komidi putar, ayunan, beringin, bangku, joget bareng saat musik, jajanan, foto bareng;
//  - Pojok Wahana (v32): bianglala, kereta kelinci, arak-arakan ondel-ondel (wahana panjang: naik dulu, hadiah setelah selesai),
//    lempar gelang, layar tancap & kembang api malam (jam setempat pemain, zona WIB/WITA/WIT);
//  - Kolam Pemancingan Bareng: 6 dermaga, mancing santai (jatah harian kolam) & Lomba Mancing tiap 20 menit (tangkap-lepas).
import type { FastifyInstance } from 'fastify';
import { ALUN_D, ALUN_ROOM, ALUN_W, BIANGLALA, LOMBA, PARADE, applyNeedDelta, gondolaQueue, keretaAt, localHM, lombaAt, lombaGrams, paradeAt, petLookState, pondKind, SQUARE_PLAY, SQUARE_RIDES, SQUARE_SNACKS, squareNight, squareShow, tzOf, type Needs, type SquareRide } from '@kb/shared';
import type { Db } from '../db/index';
import { bad, bumpCounter, checkChat, coinMultiplier, counter, credit, forbidden, getCatalog, getSettings, track } from '../lib/core';
import { requireUser } from '../lib/auth';
import { currentNeeds, isAsleep, lockPet, petView, publicItem, savePet } from '../lib/state';
import { bookProgress, castFish, hookFish, kolamReward, landFish, loseFish, type LandCtx } from '../lib/fishing';
import { grantXp, patch } from './game';
import { EMOTES, markPresence } from './house';
import { takePings } from '../lib/pings';
import { barengAct, barengSeat, barengViews } from './bareng';

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
/** wahana panjang yang sedang dinaiki: kursi/gondola/urutan, mulai (naik) & selesai (hadiah boleh diambil) */
type Ride = { kind: SquareRide; seat: number; from: number; until: number; inst: number };
const RIDES = new Map<string, Ride>();
/** dermaga Kolam Pemancingan Bareng yang diduduki: alun-alun → nomor dermaga (1–6) → pemain */
const PIERS = new Map<number, Map<number, string>>();
const POND_SEATS = 6;
function pierOf(uid: string) { for (const [inst, m] of PIERS) for (const [n, u] of m) if (u === uid) return { inst, n }; return null; }
function leavePier(uid: string) { for (const m of PIERS.values()) for (const [n, u] of m) if (u === uid) m.delete(n); }
/** pemancing yang sedang duduk di dermaga alun-alun `q` (masih di sana) — untuk bonus Ramai-ramai */
function anglersAt(q: Square) {
  const m = PIERS.get(q.id);
  let n = 0;
  if (m) for (const u of m.values()) { const mb = q.members.get(u); if (mb && fresh(mb) && WHERE.get(u) === q.id) n++; }
  return n;
}
type BoardRow = { id: string; name: string; grams: number; fish: number; best: number; at: number };
type LombaResult = { id: string; name: string; grams: number; fish: number; best: number; rank: number; coins: number; xp: number };
/** papan skor lomba (dihitung dari lemparan, disimpan sebentar) */
const BOARD = new Map<string, { at: number; rows: BoardRow[] }>();
/** ikan yang sudah tersangkut saat lomba berakhir masih dihitung selama masa ini; hasil ditampilkan ±75 detik */
const LOMBA_GRACE_MS = 12_000, LOMBA_SHOW_MS = 75_000;
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
  for (const m of q.members.values()) if (!fresh(m, now)) { q.members.delete(m.id); if (WHERE.get(m.id) === q.id) WHERE.delete(m.id); leavePier(m.id); push(q, { kind: 'leave', from: m.id, name: m.name }); }
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
  for (const [k, v] of RIDES) if (clock() - v.until > 5 * 60_000) RIDES.delete(k);
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
/** Ringkasan alun-alun live untuk dasbor admin. */
export function squareStats() {
  const now = Date.now();
  let instances = 0, people = 0;
  for (const q of SQUARES.values()) { const n = [...q.members.values()].filter((m) => fresh(m, now)).length; if (n) { instances++; people += n; } }
  return { instances, people };
}
export function resetSquares() { SQUARES.clear(); WHERE.clear(); SEEN.clear(); SAID.clear(); LAST_ACT.clear(); JOINED.clear(); MUTE_CACHE.clear(); BLOCKS.clear(); RIDES.clear(); PIERS.clear(); BOARD.clear(); }
/** kursi wahana yang terisi di satu alun-alun untuk satu keberangkatan (from) */
const seatsTaken = (inst: number, kind: SquareRide, from: number, seat?: number) => [...RIDES.values()].filter((r) => r.inst === inst && r.kind === kind && r.from === from && (seat === undefined || r.seat === seat)).map((r) => r.seat);
/** gerak wahana yang terlihat pemain lain (dipasang server, bukan dari HP) */
function rideAct(uid: string, now: number) {
  // duduk memancing di dermaga
  const pier = pierOf(uid);
  if (pier && WHERE.get(uid) === pier.inst) return `kolam:${pier.n}`;
  const r = RIDES.get(uid);
  if (!r || now >= r.until) return null;
  return r.kind === 'arak' || now >= r.from ? `${r.kind}:${r.seat}` : null;
}

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
  // kursi wahana / dermaga / Pos Ronda (catur) / pojok Tikar Ludo dipasang server, selain itu gerak dari HP
  const view = (m: Member) => ({ id: m.id, name: m.name, pet: m.pet, roomId: ALUN_ROOM, x: m.x, y: m.y, flip: m.flip, act: rideAct(m.id, clock()) ?? barengSeat(`a:${WHERE.get(m.id)}`, m.id) ?? barengAct(m.id) ?? m.act, host: false });
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
    const numX = (v: unknown) => Math.max(0.5, Math.min(ALUN_W - 0.5, Number(v) || 0));
    const numY = (v: unknown) => Math.max(0.5, Math.min(ALUN_D - 0.5, Number(v) || 0));
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
        m = { id: uid, name: info.name, pet: info.pet, x: numX(b.x), y: numY(b.y), flip: !!b.flip, act: null, seenAt: Date.now(), joinedAt: Date.now(), petAt: Date.now(), emoteAt: 0, jogetAt: 0 };
        q.members.set(uid, m);
        // pindah dari alun-alun lain
        const old = WHERE.get(uid);
        if (old && old !== id) { const oq = SQUARES.get(old); const om = oq?.members.get(uid); if (oq && om) { oq.members.delete(uid); push(oq, { kind: 'leave', from: uid, name: om.name }); } leavePier(uid); }
        WHERE.set(uid, id);
        // keluar-masuk cepat tidak membanjiri kabar "datang"
        if (Date.now() - (JOINED.get(uid) ?? 0) > 15_000) push(q, { kind: 'join', from: uid, name: m.name });
        JOINED.set(uid, Date.now());
        joined = true;
      }
    }
    m.x = numX(b.x); m.y = numY(b.y); m.flip = !!b.flip; m.seenAt = Date.now();
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
    // Lomba Mancing: papan skor saat lomba, hasil sesudahnya, atau keadaan untuk yang sedang di dermaga
    await settleDue().catch(() => {});
    const lp = lombaAt(now0).phase;
    const lomba = lp === 'lomba' || now0 - (lombaAt(now0).start - LOMBA.everyMs + LOMBA.durMs) < LOMBA_SHOW_MS || pierOf(uid) ? await lombaView(uid, id, a) : null;
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
      lomba, pier: pierOf(uid)?.n ?? null,
      // Ramai-ramai: berapa pemancing di dermaga & berapa yang dibutuhkan (untuk panel mancing)
      ...(pierOf(uid) ? { ramai: { anglers: anglersAt(q), need: ramaiCfg(a).anglers, xp: ramaiCfg(a).xp } } : {}),
    };
  });

  app.post('/api/square/leave', { ...auth, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req: any) => {
    const uid = req.user!.id;
    const h = here(uid);
    if (h) { h.q.members.delete(uid); push(h.q, { kind: 'leave', from: uid, name: h.m.name }); }
    WHERE.delete(uid);
    RIDES.delete(uid);
    leavePier(uid);
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

  /**
   * Hadiah main di alun-alun (jatah harian bersama untuk aksi singkat & wahana panjang). Lewat batas: tetap boleh main,
   * tanpa koin, XP, ceria, atau kemajuan tugas. amt: koin/XP/ceria dasar (wahana panjang lebih besar).
   */
  async function reward(uid: string, kind: string, amt: { coins: number; xp: number; ceria: number; bonus?: number }, s: any, a: any) {
    // katalog dimuat di luar transaksi (PGlite: query lewat db di dalam tx = macet)
    const cat = await getCatalog(db);
    const cap = Math.max(0, numOr(a.actsPerDay, 14));
    return db.tx(async (t) => {
      let rewarded = (await counter(t, uid, 'square_play')) < cap;
      if (rewarded) {
        // dua aksi bersamaan di ujung batas: yang kalah tetap jalan, hanya tanpa hadiah
        try { await bumpCounter(t, uid, 'square_play', cap); } catch (e: any) { if (e?.code === 'daily_limit') rewarded = false; else throw e; }
      }
      const pet = await lockPet(t, uid);
      if (!pet) throw bad('no_pet', 'Buat pet dulu.');
      if (isAsleep(pet, s)) throw bad('asleep', 'Pet sedang tidur.');
      if (!rewarded) return { rewarded, coins: 0, xp: 0, levelUp: null as number | null, ceria: 0, bonus: 0, left: 0, out: null as any };
      // bonus (lempar gelang 3 dari 3) sekali sehari
      let bonus = 0;
      if (amt.bonus) { try { await bumpCounter(t, uid, 'square_gelang', 1); bonus = Math.round(amt.bonus * coinMultiplier(cat)); } catch (e: any) { if (e?.code !== 'daily_limit') throw e; } }
      const coins = Math.round(Math.max(0, amt.coins) * coinMultiplier(cat));
      if (coins + bonus) await credit(t, uid, 'coin', coins + bonus, 'square_play', kind);
      const xp = Math.max(0, amt.xp);
      const lv = xp ? await grantXp(t, uid, pet, xp) : null;
      await savePet(t, uid, { needs: applyNeedDelta(currentNeeds(pet, s), { ceria: amt.ceria } as Partial<Needs>), ...(lv ? { level: lv.level, xp: lv.xp } : {}) });
      await track(t, uid, 'square_act', { kind });
      const used = await counter(t, uid, 'square_play');
      return { rewarded, coins, xp, levelUp: lv && lv.levelsGained > 0 ? lv.level : null, ceria: amt.ceria, bonus, left: Math.max(0, cap - used), out: await patch(t, uid, ['pet', 'wallet']) };
    });
  }
  /** acara malam menurut jam setempat pemain (zona dari HP: WIB/WITA/WIT; selain itu WIB) */
  const nightOf = (tz: unknown) => { const hm = localHM(clock(), tzOf(tz)); return squareNight(hm.h, hm.m); };

  /** Main di alun-alun: nonton, naik komidi putar, ayunan, berteduh, duduk, joget, lempar gelang, layar tancap (hadiah harian terbatas), jajan, kembang api. */
  app.post('/api/square/act', { ...auth, config: { rateLimit: { max: 40, timeWindow: '1 minute' } } }, async (req: any) => {
    const { s, a, open } = await settings();
    if (!open) throw closed();
    const uid = req.user!.id;
    const h = here(uid);
    if (!h) throw bad('not_here', 'Masuk ke alun-alun dulu.');
    const kind = String(req.body?.kind ?? '');
    const ride = RIDES.get(uid);
    if (ride && clock() < ride.until && kind !== 'kembangapi') throw bad('riding', 'Pet-mu masih di wahana.');
    // kembang api: semua yang ada di alun-alun dapat ceria sekali per malam (tanpa koin, tidak memakai jatah main)
    if (kind === 'kembangapi') {
      if (!nightOf(req.body?.tz).kembangApi) throw bad('not_now', 'Kembang api dinyalakan pukul 20.00 & 21.00.');
      const ceria = Math.max(0, numOr(a.fireworkCeria, 6));
      return db.tx(async (t) => {
        try { await bumpCounter(t, uid, 'square_fw', 1); } catch (e: any) { if (e?.code === 'daily_limit') return { ok: true, kind, rewarded: false, ceria: 0 }; throw e; }
        const pet = await lockPet(t, uid);
        if (!pet) throw bad('no_pet', 'Buat pet dulu.');
        await savePet(t, uid, { needs: applyNeedDelta(currentNeeds(pet, s), { ceria } as Partial<Needs>) });
        return { ok: true, kind, rewarded: true, ceria, ...(await patch(t, uid, ['pet'])) };
      });
    }
    if (Date.now() - (LAST_ACT.get(uid) ?? 0) < ACT_GAP_MS) throw bad('too_fast', 'Sebentar, ya. Pet-mu masih asyik.');
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
    if (kind === 'layar' && !nightOf(req.body?.tz).layar) throw bad('not_night', 'Layar tancap diputar pukul 19.00–22.00.');
    LAST_ACT.set(uid, Date.now());
    if (kind === 'joget') h.m.jogetAt = Date.now();
    // joget bareng: makin ramai yang joget (dari aksi joget sungguhan), makin ceria
    const blocked = kind === 'joget' ? await blocksOf(uid) : new Set<string>();
    const dancers = kind === 'joget' ? [...h.q.members.values()].filter((m) => fresh(m) && !blocked.has(m.id) && Date.now() - m.jogetAt < 8000).length : 0;
    // lempar gelang: tiga lemparan diundi server; 3 dari 3 = bonus koin sekali sehari
    const hits = kind === 'gelang' ? [0, 1, 2].map(() => Math.random() < 0.55) : null;
    const allIn = !!hits && hits.every(Boolean);
    const res = await reward(uid, kind, { coins: numOr(a.actCoins, 3), xp: numOr(a.actXp, 2), ceria: numOr(a.ceria, 6) + (dancers >= 3 ? 4 : 0), bonus: allIn ? Math.max(0, numOr(a.gelangBonus, 10)) : 0 }, s, a);
    push(h.q, { kind: 'act', from: uid, act: kind });
    return { ok: true, kind, rewarded: res.rewarded, coins: res.coins, xp: res.xp, levelUp: res.levelUp, ceria: res.ceria, left: res.left, crowd: dancers, ...(hits ? { hits, bonus: res.bonus } : {}), ...(res.out ?? {}) };
  });

  /**
   * Wahana panjang: bianglala (1 putaran 60 dtk), kereta kelinci (1 putaran rel dari halte), arak-arakan ondel-ondel.
   * Naik dulu (server memilih gondola / kursi / urutan dan mencatat kapan selesai), hadiah diambil setelah selesai
   * (done): HP yang melewati animasi tidak mendapat apa-apa lebih cepat. cancel = turun tanpa hadiah.
   */
  app.post('/api/square/ride', { ...auth, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req: any) => {
    const { s, a, open } = await settings();
    if (!open) throw closed();
    const uid = req.user!.id;
    const h = here(uid);
    if (!h) throw bad('not_here', 'Masuk ke alun-alun dulu.');
    const kind = String(req.body?.kind ?? '') as SquareRide;
    if (!(SQUARE_RIDES as readonly string[]).includes(kind)) throw bad('invalid', 'Wahana tidak dikenal.');
    const now = clock();
    const cur = RIDES.get(uid);
    if (req.body?.cancel) { if (cur?.kind === kind) RIDES.delete(uid); return { ok: true }; }
    if (req.body?.done) {
      if (!cur || cur.kind !== kind) throw bad('no_ride', 'Pet-mu belum naik wahana ini.');
      if (now < cur.until - 2000) throw bad('too_soon', 'Wahananya belum selesai.', { leftMs: cur.until - now });
      RIDES.delete(uid);
      const res = await reward(uid, kind, { coins: numOr(a.rideCoins, 5), xp: numOr(a.rideXp, 3), ceria: numOr(a.rideCeria, 8) }, s, a);
      push(h.q, { kind: 'act', from: uid, act: kind });
      return { ok: true, kind, rewarded: res.rewarded, coins: res.coins, xp: res.xp, levelUp: res.levelUp, ceria: res.ceria, left: res.left, ...(res.out ?? {}) };
    }
    if (cur && now < cur.until) throw bad('riding', 'Pet-mu masih di wahana.');
    if (Date.now() - (LAST_ACT.get(uid) ?? 0) < ACT_GAP_MS) throw bad('too_fast', 'Sebentar, ya. Pet-mu masih asyik.');
    let ride: Ride | null = null;
    if (kind === 'bianglala') {
      // gondola berikutnya yang tiba di bawah & masih ada kursi (2 per gondola); paling lama menunggu satu putaran
      for (const q of gondolaQueue(now + 400)) {
        if (seatsTaken(h.q.id, kind, q.at, q.k).length < BIANGLALA.seats) { ride = { kind, seat: q.k, from: q.at, until: q.at + BIANGLALA.periodMs, inst: h.q.id }; break; }
      }
      if (!ride) throw bad('full', 'Semua gondola penuh. Tunggu putaran berikutnya, ya.');
    } else if (kind === 'kereta') {
      const k = keretaAt(now);
      if (!k.stopped) throw bad('not_yet', `Kereta datang ${Math.ceil((k.arriveAt - now) / 1000)} detik lagi.`, { inMs: k.arriveAt - now });
      const taken = seatsTaken(h.q.id, kind, k.lap);
      const seat = [0, 1, 2, 3, 4, 5].find((x) => !taken.includes(x));
      if (seat === undefined) throw bad('full', 'Kereta penuh. Tunggu kereta berikutnya, ya.');
      ride = { kind, seat, from: k.lap, until: k.arriveAt, inst: h.q.id };
    } else {
      const p = paradeAt(now);
      if (!p.joinable) throw bad('no_parade', p.on ? 'Rombongan sudah jauh. Ikut arak-arakan berikutnya, ya.' : `Arak-arakan berikutnya mulai ${Math.max(1, Math.ceil((p.start - now) / 60_000))} menit lagi.`, { inMs: p.on ? p.end - now : p.start - now });
      const taken = seatsTaken(h.q.id, kind, p.start);
      const seat = Array.from({ length: PARADE.max }, (_, i) => i).find((x) => !taken.includes(x));
      if (seat === undefined) throw bad('full', 'Barisan arak-arakan sudah penuh (8 pet).');
      ride = { kind, seat, from: p.start, until: p.end, inst: h.q.id };
    }
    LAST_ACT.set(uid, Date.now());
    RIDES.set(uid, ride);
    return { ok: true, ride: { kind: ride.kind, seat: ride.seat, from: ride.from, until: ride.until }, serverNow: now };
  });

  /* ---------------- Kolam Pemancingan Bareng: mancing santai & Lomba Mancing ---------------- */
  // Duduk di salah satu dari 6 dermaga, lalu alur mancing yang sama dengan Kolam Pancing (lib/fishing.ts, place 'alun').
  // Di luar lomba: jatah lempar harian bersama (fishing.castsPerDay) & hadiah kolam. Saat Lomba Mancing (tiap 20 menit,
  // 3 menit): jatah lomba sendiri, energi masuk sekali, tangkap-lepas (dicatat di Buku Ikan, tidak masuk Tas, tanpa koin),
  // skor = total berat (gram = 0,013 × cm³), seri → yang lebih dulu. Hadiah dibayar server sekali saat lomba diselesaikan
  // (otomatis tiap 15 detik / saat ada permintaan berikutnya), hanya untuk pemain di alun-alun yang sama.
  const DISTS = ['dekat', 'sedang', 'jauh'] as const;
  const castIdOf = (req: any) => { const id = String(req.body?.castId ?? ''); if (!UUID.test(id)) throw bad('invalid', 'Lemparan tidak valid.'); return id; };
  /** bonus Ramai-ramai (mancing santai di kolam alun-alun) */
  const ramaiCfg = (a: any) => {
    const R = a?.ramai ?? {};
    return { anglers: Math.max(2, numOr(R.anglers, 3)), waitPct: Math.min(100, Math.max(30, numOr(R.waitPct, 70))), xp: Math.max(0, numOr(R.xp, 1)) };
  };
  const lombaCfg = (a: any) => {
    const L = a?.lomba ?? {};
    const arr = (v: unknown, d: number[]) => (Array.isArray(v) ? v : d).map((x) => Math.max(0, Number(x) || 0));
    return {
      castsPerDay: Math.max(0, numOr(L.castsPerDay, 12)), entryEnergi: Math.max(0, numOr(L.entryEnergi, 6)),
      prizes: arr(L.prizes, [40, 25, 15]), prizeXp: arr(L.prizeXp, [10, 6, 4]), joinCoins: Math.max(0, numOr(L.joinCoins, 5)), joinXp: Math.max(0, numOr(L.joinXp, 3)), perDay: Math.max(0, numOr(L.perDay, 3)),
    };
  };
  const lombaLeftOf = async (q: Db, uid: string, a: any) => Math.max(0, lombaCfg(a).castsPerDay - (await counter(q, uid, 'lomba_cast')));

  /** Papan skor satu lomba dari lemparan yang tercatat (ikan tertangkap saja). */
  async function boardRows(q: Db, id: string): Promise<BoardRow[]> {
    const people = await q.query<{ user_id: string; name: string }>(
      `select distinct c.user_id, coalesce(p.name, u.display_name, 'Pemain') as name from fishing_casts c join users u on u.id = c.user_id left join pets p on p.user_id = c.user_id where c.contest = $1`, [id]);
    const fish = await q.query<{ user_id: string; cm: number; resolved_at: string }>(
      `select user_id, cm, resolved_at from fishing_casts where contest = $1 and result = 'caught' and catch_kind = 'fish' order by resolved_at`, [id]);
    const by = new Map<string, BoardRow>(people.map((p) => [p.user_id, { id: p.user_id, name: p.name, grams: 0, fish: 0, best: 0, at: Infinity }]));
    for (const f of fish) {
      const r = by.get(f.user_id);
      if (!r) continue;
      const cm = Number(f.cm) || 0;
      r.grams += lombaGrams(cm); r.fish++; r.best = Math.max(r.best, cm); r.at = new Date(f.resolved_at).getTime();
    }
    // skor terbesar dulu; seri → yang lebih dulu mencapai skornya
    return [...by.values()].sort((x, y) => y.grams - x.grams || x.at - y.at);
  }
  async function boardOf(id: string) {
    const c = BOARD.get(id);
    if (c && Date.now() - c.at < 1500) return c.rows;
    const rows = await boardRows(db, id);
    BOARD.set(id, { at: Date.now(), rows });
    return rows;
  }

  /** Selesaikan satu lomba sekali saja: peringkat, hadiah (berbatas per hari), simpan hasil. */
  async function settle(id: string) {
    const [s, cat] = await Promise.all([getSettings(db), getCatalog(db)]);
    const L = lombaCfg((s as any).square), mult = coinMultiplier(cat);
    const res = await db.tx(async (t) => {
      const c = await t.one<{ settled_at: string | null; results: any }>(`select settled_at, results from square_contests where id = $1 for update`, [id]);
      if (!c) return null;
      if (c.settled_at) return c.results as LombaResult[];
      const rows = await boardRows(t, id);
      // peringkat butuh paling tidak 2 peserta; hadiah ikut serta untuk yang dapat ikan
      const ranked = rows.length >= 2;
      const out: LombaResult[] = [];
      let place = 0;
      for (const r of rows) {
        const rank = ranked && r.grams > 0 && place < 3 ? ++place : 0;
        let coins = rank ? L.prizes[rank - 1] ?? 0 : r.fish > 0 ? L.joinCoins : 0;
        let xp = rank ? L.prizeXp[rank - 1] ?? 0 : r.fish > 0 ? L.joinXp : 0;
        if (coins + xp > 0) {
          let ok = true;
          try { await bumpCounter(t, r.id, 'lomba_reward', L.perDay); } catch (e: any) { if (e?.code === 'daily_limit') ok = false; else throw e; }
          if (!ok) { coins = 0; xp = 0; }
          coins = Math.round(coins * mult);
          if (coins) await credit(t, r.id, 'coin', coins, 'lomba_mancing', id);
          if (xp) { const pet = await lockPet(t, r.id); if (pet) { const lv = await grantXp(t, r.id, pet, xp); await savePet(t, r.id, { level: lv.level, xp: lv.xp }); } }
          if (ok) await track(t, r.id, 'square_act', { kind: 'lomba', rank });
        }
        out.push({ id: r.id, name: r.name, grams: r.grams, fish: r.fish, best: r.best, rank, coins, xp });
      }
      await t.query(`update square_contests set settled_at = now(), results = $2::text::jsonb where id = $1`, [id, JSON.stringify(out)]);
      return out;
    });
    BOARD.delete(id);
    return res;
  }
  /** lomba yang sudah lewat masa tarik-ulurnya diselesaikan (dipanggil berkala & saat ada permintaan) */
  let settleCheck = 0;
  async function settleDue(force = false) {
    if (!force && Date.now() - settleCheck < 5000) return;
    settleCheck = Date.now();
    const due = await db.query<{ id: string }>(`select id from square_contests where settled_at is null and ends_at < $1`, [new Date(clock() - LOMBA_GRACE_MS)]);
    for (const r of due) await settle(r.id).catch((e) => app.log.warn({ err: e, id: r.id }, 'lomba mancing: gagal menyelesaikan'));
  }
  const settleTimer = setInterval(() => { settleDue(true).catch(() => {}); }, 15_000);
  settleTimer.unref?.();
  app.addHook('onClose', async () => clearInterval(settleTimer));

  /** Keadaan lomba untuk satu pemain di satu alun-alun: papan skor langsung, hasil lomba terakhir, jatah lomba. */
  async function lombaView(uid: string, inst: number, a: any) {
    const now = clock(), L = lombaAt(now);
    const blocked = await blocksOf(uid);
    const view = (rows: BoardRow[]) => rows.filter((r) => r.id === uid || !blocked.has(r.id)).slice(0, 8).map((r) => ({ name: r.name, grams: r.grams, fish: r.fish, me: r.id === uid }));
    const meOf = (rows: BoardRow[]) => { const k = rows.findIndex((r) => r.id === uid); return k < 0 ? null : { pos: k + 1, grams: rows[k].grams, fish: rows[k].fish }; };
    const left = await lombaLeftOf(db, uid, a);
    if (L.phase === 'lomba') {
      const id = `${inst}:${L.start}`, rows = await boardOf(id);
      return { phase: 'lomba' as const, id, start: L.start, end: L.end, board: view(rows), me: meOf(rows), count: rows.length, left };
    }
    // lomba terakhir: menghitung (masa tarik-ulur) lalu hasil selama ±1 menit
    const prevStart = L.start - LOMBA.everyMs, prevEnd = prevStart + LOMBA.durMs, id = `${inst}:${prevStart}`;
    if (now - prevEnd < LOMBA_SHOW_MS) {
      const c = await db.one<{ settled_at: string | null; results: any }>(`select settled_at, results from square_contests where id = $1`, [id]);
      if (c) {
        if (!c.settled_at && now - prevEnd >= LOMBA_GRACE_MS) { await settle(id).catch(() => null); return lombaView(uid, inst, a); }
        const results: LombaResult[] | null = c.settled_at ? c.results : null;
        const rows = results ? results.map((r) => ({ ...r, at: 0 })) : await boardOf(id);
        const mine = results?.find((r) => r.id === uid) ?? null;
        return { phase: 'hasil' as const, id, start: prevStart, end: prevEnd, next: L.start, board: view(rows as BoardRow[]), me: meOf(rows as BoardRow[]), count: rows.length, left,
          results: results ? results.filter((r) => r.id === uid || !blocked.has(r.id)).slice(0, 8).map((r) => ({ name: r.name, grams: r.grams, fish: r.fish, rank: r.rank, coins: r.coins, me: r.id === uid })) : null,
          mine: mine ? { rank: mine.rank, coins: mine.coins, xp: mine.xp, grams: mine.grams } : null };
      }
    }
    return { phase: L.phase, next: L.start, start: L.start, end: L.end, left };
  }

  /** Duduk di dermaga (n: dermaga yang dipilih; kosong = yang pertama kosong) atau berdiri (leave). */
  app.post('/api/square/pier', { ...auth, config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req: any) => {
    const { open } = await settings();
    if (!open) throw closed();
    const uid = req.user!.id;
    if (req.body?.leave) { leavePier(uid); return { ok: true }; }
    const h = here(uid);
    if (!h) throw bad('not_here', 'Masuk ke alun-alun dulu.');
    const ride = RIDES.get(uid);
    if (ride && clock() < ride.until) throw bad('riding', 'Pet-mu masih di wahana.');
    const mine = pierOf(uid);
    if (mine && mine.inst === h.q.id) return { ok: true, pier: mine.n };
    leavePier(uid);
    let m = PIERS.get(h.q.id);
    if (!m) { m = new Map(); PIERS.set(h.q.id, m); }
    // kursi orang yang sudah pergi dibebaskan
    for (const [n, u] of m) if (!h.q.members.get(u) || !fresh(h.q.members.get(u)!)) m.delete(n);
    const want = Math.round(Number(req.body?.n));
    const n = want >= 1 && want <= POND_SEATS && !m.has(want) ? want : Array.from({ length: POND_SEATS }, (_, i) => i + 1).find((k) => !m!.has(k));
    if (!n) throw bad('full', 'Semua dermaga terisi. Tunggu sebentar, ya.');
    m.set(n, uid);
    return { ok: true, pier: n };
  });

  app.post('/api/square/fish/cast', { ...auth, config: { rateLimit: { max: 40, timeWindow: '1 minute' } } }, async (req: any) => {
    const { s, a, open } = await settings();
    if (!open) throw closed();
    if (!s.features.fishing) throw forbidden('Kolam Pancing sedang ditutup.');
    const uid = req.user!.id;
    const h = here(uid);
    if (!h) throw bad('not_here', 'Masuk ke alun-alun dulu.');
    const p = pierOf(uid);
    if (!p || p.inst !== h.q.id) throw bad('no_pier', 'Duduk di dermaga dulu, ya.');
    const dist = String(req.body?.distance ?? '') as (typeof DISTS)[number];
    if (!DISTS.includes(dist)) throw bad('invalid', 'Jarak lempar tidak valid.');
    const cat = await getCatalog(db);
    const L = lombaAt(clock()), cfg = lombaCfg(a);
    // saat lomba: lemparan lomba selama jatah lomba masih ada; habis → mancing santai (jatah harian biasa)
    if (L.phase === 'lomba' && (await lombaLeftOf(db, uid, a)) > 0) {
      const id = `${h.q.id}:${L.start}`;
      await db.query(`insert into square_contests (id, inst, starts_at, ends_at) values ($1,$2,$3,$4) on conflict (id) do nothing`, [id, h.q.id, new Date(L.start), new Date(L.end)]);
      const first = !(await db.one(`select 1 from fishing_casts where contest = $1 and user_id = $2 limit 1`, [id, uid]));
      // lomba hanya ikan (tanpa botol/peti), semuanya dilepas lagi
      const fishOnly = { ...cat, items: cat.items.filter((i) => pondKind(i) === 'fish') } as typeof cat;
      return db.tx(async (t) => {
        const c = await castFish(t, uid, { place: 'alun', dist, s, cat: fishOnly, energi: first ? cfg.entryEnergi : 0, quota: { key: 'lomba_cast', limit: cfg.castsPerDay } });
        await t.query(`update fishing_casts set contest = $2 where id = $1`, [c.castId, id]);
        BOARD.delete(id);
        return { ok: true, ...c, mode: 'lomba', contest: { id, end: L.end }, lombaLeft: await lombaLeftOf(t, uid, a), ...(await patch(t, uid, ['pet', 'limits'])) };
      });
    }
    const energi = Math.max(0, Math.round(Number((s.fishing.energi as any)?.[dist]) || 0));
    // Ramai-ramai: cukup banyak pemancing di dermaga → ikan lebih cepat datang & XP tambahan (diputuskan server saat melempar)
    const rc = ramaiCfg(a), anglers = anglersAt(h.q);
    const ramai = anglers >= rc.anglers ? { waitPct: rc.waitPct, xp: rc.xp } : undefined;
    return db.tx(async (t) => {
      const c = await castFish(t, uid, { place: 'alun', dist, s, cat, energi, quota: { key: 'fishing', limit: s.fishing.castsPerDay }, ramai });
      return { ok: true, ...c, mode: 'santai', anglers, ...(await patch(t, uid, ['pet', 'limits'])) };
    });
  });

  app.post('/api/square/fish/hook', { ...auth, config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req: any) => {
    const uid = req.user!.id, castId = castIdOf(req);
    return db.tx(async (t) => ({ ok: true, ...(await hookFish(t, uid, castId)) }));
  });

  app.post('/api/square/fish/lost', { ...auth, config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req: any) => {
    const uid = req.user!.id, castId = castIdOf(req);
    const reason = ['putus', 'kendur', 'batal'].includes(req.body?.reason) ? req.body.reason : 'batal';
    return db.tx(async (t) => ({ ok: true, ...(await loseFish(t, uid, castId, reason)) }));
  });

  app.post('/api/square/fish/land', { ...auth, config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req: any) => {
    const uid = req.user!.id, castId = castIdOf(req);
    const [{ s, a }, cat] = await Promise.all([settings(), getCatalog(db)]);
    const row = await db.one<{ place: string; contest: string | null }>(`select place, contest from fishing_casts where id = $1 and user_id = $2`, [castId, uid]);
    if (!row || row.place !== 'alun') throw bad('invalid', 'Lemparan tidak ditemukan.');
    const end = row.contest ? await db.one<{ ends_at: string; settled_at: string | null }>(`select ends_at, settled_at from square_contests where id = $1`, [row.contest]) : null;
    return db.tx(async (t) => {
      const reward = row.contest
        ? lombaReward(t, uid, cat, row.contest, end ? new Date(end.ends_at).getTime() : 0, !!end?.settled_at)
        : kolamReward(t, uid, s, cat);
      const r: any = await landFish(t, uid, castId, cat, reward);
      if (r.suspicious) req.log.warn({ userId: uid, castId, elapsed: r.elapsed, min: r.min }, 'mancing alun-alun: tarik-ulur terlalu cepat');
      delete r.suspicious; delete r.elapsed; delete r.min;
      if (row.contest) BOARD.delete(row.contest);
      const parts: ('inventory' | 'pet' | 'wallet' | 'limits')[] = r.result === 'caught' && !row.contest ? ['inventory', 'pet', 'wallet', 'limits'] : ['limits'];
      return { ok: true, ...r, ...(row.contest ? { lombaLeft: await lombaLeftOf(t, uid, a) } : {}), ...(await patch(t, uid, parts)) };
    });
  });

  /** Hadiah lemparan lomba: tangkap-lepas — dicatat di Buku Ikan & papan skor, tidak masuk Tas, tanpa koin/XP. */
  function lombaReward(t: Db, uid: string, cat: Awaited<ReturnType<typeof getCatalog>>, contest: string, endMs: number, settled: boolean) {
    return async ({ cast, item, kind, tier, cm }: LandCtx) => {
      const fishy = kind === 'fish';
      const out: Record<string, any> = { kind, tier: fishy ? tier : null, cm, item: publicItem(item), coins: 0, pearl: 0, xp: 0, released: true, lomba: true, grams: 0 };
      if (!fishy || settled || clock() > endMs + LOMBA_GRACE_MS) {
        // waktu lomba (dan masa tarik-ulurnya) sudah habis: tetap dilepas, tidak dihitung
        await t.query(`update fishing_casts set result = 'lepas', reason = 'waktu' where id = $1`, [cast.id]);
        out.late = true;
        return out;
      }
      const prev = await t.one<{ best_cm: number; count: number }>(`select best_cm, count from fish_collection where user_id = $1 and fish_id = $2`, [uid, item.id]);
      await t.query(
        `insert into fish_collection (user_id, fish_id, count, best_cm) values ($1,$2,1,$3)
         on conflict (user_id, fish_id) do update set count = fish_collection.count + 1, best_cm = greatest(fish_collection.best_cm, excluded.best_cm)`,
        [uid, item.id, cm ?? 0],
      );
      out.firstCatch = !prev || !(prev.count > 0);
      out.newRecord = !!prev && prev.count > 0 && (cm ?? 0) > prev.best_cm;
      out.bestCm = Math.max(prev?.best_cm ?? 0, cm ?? 0);
      out.secret = !!item.data?.secret;
      out.grams = lombaGrams(cm ?? 0);
      out.book = await bookProgress(t, uid, cat);
      return out;
    };
  }

  /** Papan Lomba Mancing: papan skor langsung / hasil lomba terakhir / jadwal berikutnya. */
  app.get('/api/square/lomba', auth, async (req: any) => {
    const { a } = await settings();
    await settleDue(true);
    const uid = req.user!.id;
    const h = here(uid);
    return { ok: true, lomba: await lombaView(uid, h?.q.id ?? WHERE.get(uid) ?? 1, a), pier: pierOf(uid)?.n ?? null };
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
    if (Number.isFinite(bx) && Number.isFinite(by) && Math.hypot(bx - h.m.x, by - h.m.y) <= 3) { h.m.x = Math.max(0.5, Math.min(ALUN_W - 0.5, bx)); h.m.y = Math.max(0.5, Math.min(ALUN_D - 0.5, by)); }
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
