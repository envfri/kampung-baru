// Sesi Catur Kilat 5+3 di main bareng (rumah & Pos Ronda alun-alun). Jam catur dihitung server: jam pihak yang jalan
// berjalan sejak animasi langkah lawan selesai (runFrom), dengan kelonggaran jaringan 300 ms per langkah. Langkah pertama
// tiap pihak paling lama 30 dtk (lewat = batal tanpa hadiah), diam 90 dtk satu langkah = kalah waktu, batas 25 menit = remis.
// Dipanggil dari routes/bareng.ts (sesi, sinkron, hadiah).
import { randomInt } from 'node:crypto';
import {
  DEFAULT_SETTINGS, CATUR_PROMOS, caturStart, caturFind, caturApply, caturSAN, caturStatus, caturKey, caturFrames, caturCanMate, caturIdx, caturSq, caturOther,
  framesMs, type CaturColor, type CaturState, type CaturPromo,
} from '@kb/shared';
import { bad } from './core';

export type CaturCfg = typeof DEFAULT_SETTINGS.catur;
/** kelonggaran jaringan per langkah (ms): tidak dipotong dari jam */
export const CATUR_GRACE_MS = 300;
/** alasan akhir permainan (dipakai kartu hasil) */
export type CaturReason = 'mat' | 'menyerah' | 'waktu' | 'diam' | 'pergi' | 'pat' | 'bidak' | 'ulang' | '50' | 'sepakat' | 'batas' | 'waktu-remis' | 'batal';
export interface CaturGame {
  cfg: CaturCfg;
  st: CaturState;
  white: string;
  black: string;
  startedAt: number;
  /** sisa waktu tiap warna (ms) saat jam pihak yang jalan mulai berjalan */
  clocks: { w: number; b: number };
  /** jam pihak yang jalan mulai berjalan (sesudah animasi langkah sebelumnya) */
  runFrom: number;
  /** jumlah kemunculan tiap posisi (pengulangan 3×) */
  reps: Record<string, number>;
  /** paruh langkah yang sudah dimainkan */
  plies: number;
  /** daftar langkah (SAN), 300 terakhir */
  san: string[];
  /** bidak lawan yang dimakan oleh Putih (w) / Hitam (b) */
  captured: { w: string[]; b: string[] };
  drawOffer: { by: string; ply: number } | null;
  offers: Record<string, number>;
  result: { winner: CaturColor | null; reason: CaturReason } | null;
}
/** bagian sesi main bareng yang dipakai catur */
export interface CaturHost {
  place: string;
  players: { id: string; name: string }[];
  left: Set<string>;
  catur?: CaturGame | null;
  moves: number;
  last: any;
  turn: number;
  turnUntil: number;
}
export interface CaturOps { now: number; end(why: string): void; note(line: string): void; bump(): void }

const clampN = (v: unknown, lo: number, hi: number, def: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def; };
/** pengaturan catur dari admin, dibatasi ke nilai yang masuk akal */
export function caturCfg(raw: any): CaturCfg {
  const d = DEFAULT_SETTINGS.catur, r = raw ?? {};
  return {
    baseMs: clampN(r.baseMs, 30_000, 3_600_000, d.baseMs),
    incMs: clampN(r.incMs, 0, 60_000, d.incMs),
    firstMoveMs: clampN(r.firstMoveMs, 10_000, 300_000, d.firstMoveMs),
    idleMs: clampN(r.idleMs, 20_000, 600_000, d.idleMs),
    idleWarnMs: clampN(r.idleWarnMs, 5_000, 600_000, d.idleWarnMs),
    maxMs: clampN(r.maxMs, 120_000, 7_200_000, d.maxMs),
    minPlies: clampN(r.minPlies, 0, 200, d.minPlies),
    drawOfferFromPly: clampN(r.drawOfferFromPly, 0, 200, d.drawOfferFromPly),
    drawOffers: clampN(r.drawOffers, 0, 20, d.drawOffers),
    promoAutoMs: clampN(r.promoAutoMs, 3_000, 60_000, d.promoAutoMs),
    auto50: clampN(r.auto50, 0, 300, d.auto50),
  };
}
/** Pemeriksaan admin (PUT pengaturan): tolak nilai di luar batas, seperti pengaturan lain. */
export function checkCaturSettings(v: any, no: (msg: string) => never) {
  const c = v.catur, rng = (k: string, lo: number, hi: number, name: string) => { const n = Number(c[k]); if (!(Number.isFinite(n) && n >= lo && n <= hi)) no(`Catur: ${name} harus ${lo}–${hi}.`); c[k] = Math.round(n); };
  rng('baseMs', 30_000, 3_600_000, 'waktu awal (ms)');
  rng('incMs', 0, 60_000, 'tambahan per langkah (ms)');
  rng('firstMoveMs', 10_000, 300_000, 'batas langkah pertama (ms)');
  rng('idleMs', 20_000, 600_000, 'batas diam (ms)');
  rng('idleWarnMs', 5_000, c.idleMs, 'peringatan diam (ms, ≤ batas diam)');
  rng('maxMs', 120_000, 7_200_000, 'batas lama permainan (ms)');
  rng('minPlies', 0, 200, 'paruh langkah minimal untuk hadiah');
  rng('drawOfferFromPly', 0, 200, 'tawar remis mulai paruh langkah');
  rng('drawOffers', 0, 20, 'tawaran remis per pemain');
  rng('promoAutoMs', 3_000, 60_000, 'promosi otomatis (ms)');
  if (Number(c.auto50) !== 0) rng('auto50', 20, 300, 'remis 50 langkah (paruh langkah, 0 = mati)');
  const m = Number(v.bareng?.longMult);
  if (!(Number.isFinite(m) && m >= 1 && m <= 3)) no('Main bareng: longMult harus 1–3.');
}
/** pengali hadiah game panjang (Catur, Ludo), dibatasi 1–3 */
export const longMult = (raw: unknown) => { const n = Number(raw); return Number.isFinite(n) ? Math.max(1, Math.min(3, n)) : DEFAULT_SETTINGS.bareng.longMult; };

/** warna terakhir per pasangan pemain di satu tempat: "Main lagi" = warna ditukar */
const LAST_PAIR = new Map<string, { white: string; black: string; at: number }>();

const colorOfUid = (g: CaturGame, uid: string): CaturColor | null => (uid === g.white ? 'w' : uid === g.black ? 'b' : null);
const uidOf = (g: CaturGame, c: CaturColor) => (c === 'w' ? g.white : g.black);
const nameOf = (h: CaturHost, uid: string) => h.players.find((p) => p.id === uid)?.name ?? 'Teman';
/** jam yang sedang berjalan (null: langkah pertama tiap pihak belum dibuat, atau sudah selesai) */
const running = (g: CaturGame): CaturColor | null => (g.result || g.plies < 2 ? null : g.st.turn);
/** sisa waktu warna c pada `now` */
export function caturLeft(g: CaturGame, c: CaturColor, now: number) {
  return running(g) === c ? g.clocks[c] - Math.max(0, now - g.runFrom - CATUR_GRACE_MS) : g.clocks[c];
}
/** batas giliran sekarang (untuk tampilan giliran umum): langkah pertama, habis waktu, atau batas diam — yang paling awal */
function deadline(g: CaturGame) {
  if (g.plies < 2) return g.runFrom + g.cfg.firstMoveMs;
  return Math.min(g.runFrom + CATUR_GRACE_MS + g.clocks[g.st.turn], g.runFrom + g.cfg.idleMs);
}
function syncTurn(h: CaturHost) {
  const g = h.catur!;
  h.turn = Math.max(0, h.players.findIndex((p) => p.id === uidOf(g, g.st.turn)));
  h.turnUntil = deadline(g);
}

/** Mulai permainan: warna diundi (main lagi dengan pasangan yang sama = warna ditukar). */
export function caturBegin(h: CaturHost, cfg: CaturCfg, now: number) {
  const [a, b] = h.players;
  const key = `${h.place}|${[a.id, b.id].sort().join('|')}`, prev = LAST_PAIR.get(key);
  let white = randomInt(0, 2) ? b.id : a.id;
  if (prev && now - prev.at < 30 * 60_000) white = prev.black;
  const black = white === a.id ? b.id : a.id;
  LAST_PAIR.set(key, { white, black, at: now });
  if (LAST_PAIR.size > 2000) for (const [k, v] of LAST_PAIR) if (now - v.at > 30 * 60_000) LAST_PAIR.delete(k);
  const st = caturStart();
  h.catur = {
    cfg, st, white, black, startedAt: now, clocks: { w: cfg.baseMs, b: cfg.baseMs }, runFrom: now, reps: { [caturKey(st)]: 1 }, plies: 0,
    san: [], captured: { w: [], b: [] }, drawOffer: null, offers: {}, result: null,
  };
  syncTurn(h);
  return `${nameOf(h, white)} main Putih dan jalan duluan.`;
}

const REASON_TEXT: Record<CaturReason, string> = {
  mat: 'Skakmat', menyerah: 'menyerah', waktu: 'waktu habis', diam: 'kelamaan diam', pergi: 'pergi', pat: 'Pat', bidak: 'bidak tidak cukup untuk skakmat',
  ulang: 'posisi sama 3×', '50': '50 langkah tanpa makan', sepakat: 'sepakat remis', batas: 'batas waktu permainan', 'waktu-remis': 'waktu habis, tapi lawan tidak bisa skakmat', batal: 'batal',
};
function finish(h: CaturHost, ops: CaturOps, winner: CaturColor | null, reason: CaturReason) {
  const g = h.catur!;
  if (g.result) return;
  // jam dibekukan pada saat permainan berakhir
  const c = g.st.turn;
  g.clocks[c] = Math.max(0, caturLeft(g, c, ops.now));
  g.runFrom = ops.now;
  g.result = { winner, reason };
  g.drawOffer = null;
  if (reason === 'batal') { ops.note('Langkah pertama tidak dibuat. Permainan batal.'); ops.end('batal'); return; }
  ops.note(winner ? `${nameOf(h, uidOf(g, winner))} menang (${REASON_TEXT[reason]}).` : `Remis: ${REASON_TEXT[reason]}.`);
  ops.end('selesai');
}
/** waktu habis: kalah, kecuali lawan hanya punya Raja / Raja + Gajah / Raja + Kuda (tidak bisa skakmat) = remis */
function timeOut(h: CaturHost, ops: CaturOps, c: CaturColor, reason: 'waktu' | 'diam') {
  const g = h.catur!, o = caturOther(c);
  if (reason === 'waktu') g.clocks[c] = 0;
  if (!caturCanMate(g.st.b, o)) return finish(h, ops, null, 'waktu-remis');
  finish(h, ops, o, reason);
}

/** Pemeriksaan berkala: pemain pergi, langkah pertama, jam habis, diam terlalu lama, batas lama permainan. */
export function caturTick(h: CaturHost, ops: CaturOps) {
  const g = h.catur;
  if (!g || g.result) return;
  const now = ops.now;
  const gone = [g.white, g.black].filter((id) => h.left.has(id));
  if (gone.length) return finish(h, ops, gone.length === 2 ? null : caturOther(colorOfUid(g, gone[0])!), 'pergi');
  if (g.plies < 2) { if (now - g.runFrom > g.cfg.firstMoveMs) finish(h, ops, null, 'batal'); return; }
  const c = g.st.turn, flagAt = g.runFrom + CATUR_GRACE_MS + g.clocks[c], idleAt = g.runFrom + g.cfg.idleMs;
  if (now >= Math.min(flagAt, idleAt)) return timeOut(h, ops, c, flagAt <= idleAt ? 'waktu' : 'diam');
  if (now - g.startedAt > g.cfg.maxMs) finish(h, ops, null, 'batas');
}

/** Langkah {from,to,promo?}, {resign:true}, {draw:'offer'|'accept'|'decline'}. Langkah tidak sah / bukan giliran = invalid_move. */
export function caturPlay(h: CaturHost, uid: string, body: any, ops: CaturOps) {
  const g = h.catur;
  if (!g || g.result) throw bad('invalid_move', 'Permainan sudah selesai.');
  const me = colorOfUid(g, uid);
  if (!me) throw bad('not_player', 'Kamu tidak ikut permainan ini.');
  const name = nameOf(h, uid);
  if (body?.resign === true) { finish(h, ops, caturOther(me), 'menyerah'); return; }
  if (body?.draw !== undefined) {
    const d = String(body.draw), off = g.drawOffer;
    if (d === 'offer') {
      if (g.plies < g.cfg.drawOfferFromPly) throw bad('invalid_move', `Tawar remis boleh setelah ${g.cfg.drawOfferFromPly} paruh langkah.`);
      if (off) throw bad('invalid_move', 'Masih ada tawaran remis.');
      if ((g.offers[uid] ?? 0) >= g.cfg.drawOffers) throw bad('invalid_move', 'Jatah tawar remis sudah habis.');
      g.offers[uid] = (g.offers[uid] ?? 0) + 1;
      g.drawOffer = { by: uid, ply: g.plies };
      ops.note(`${name} menawarkan remis.`);
      ops.bump();
      return;
    }
    if (!off || off.by === uid || (d !== 'accept' && d !== 'decline')) throw bad('invalid_move', 'Tidak ada tawaran remis untukmu.');
    if (d === 'accept') { finish(h, ops, null, 'sepakat'); return; }
    g.drawOffer = null;
    ops.note(`${name} menolak remis.`);
    ops.bump();
    return;
  }
  if (g.st.turn !== me) throw bad('invalid_move', 'Belum giliranmu.');
  const from = caturIdx(String(body?.from ?? '')), to = caturIdx(String(body?.to ?? ''));
  const promo = body?.promo === undefined || body?.promo === null ? undefined : String(body.promo);
  if (promo !== undefined && !CATUR_PROMOS.includes(promo as CaturPromo)) throw bad('invalid_move', 'Pilihan bidak promosi tidak dikenal.');
  const m = from >= 0 && to >= 0 ? caturFind(g.st, from, to, promo) : null;
  if (!m) throw bad('invalid_move', 'Langkah itu tidak boleh.');
  const now = ops.now;
  // jam: sisa waktu dipotong (tanpa kelonggaran) lalu ditambah 3 dtk; langkah pertama tiap pihak tidak memakai jam
  if (g.plies >= 2) g.clocks[me] = Math.max(0, caturLeft(g, me, now)) + g.cfg.incMs;
  const san = caturSAN(g.st, m), anim = framesMs(caturFrames(g.st, m));
  const { st, cap } = caturApply(g.st, m);
  g.st = st;
  g.plies++;
  h.moves++;
  if (cap) g.captured[me].push(cap);
  g.san.push(san);
  if (g.san.length > 300) g.san.shift();
  // tawaran remis gugur bila yang ditawari malah jalan
  if (g.drawOffer && g.drawOffer.by !== uid) g.drawOffer = null;
  // jam lawan mulai berjalan setelah animasi langkah selesai
  g.runFrom = now + anim;
  const key = caturKey(st);
  g.reps[key] = (g.reps[key] ?? 0) + 1;
  const status = caturStatus(st, g.cfg.auto50);
  h.last = { by: uid, from: caturSq(m.from), to: caturSq(m.to), promo: m.promo ?? null, flag: m.flag ?? null, san, cap, check: status.check, at: now, anim };
  syncTurn(h);
  if (status.end === 'mat') return finish(h, ops, me, 'mat');
  if (status.end) return finish(h, ops, null, status.end);
  if (g.reps[key] >= 3) return finish(h, ops, null, 'ulang');
  ops.bump();
}

/** data papan untuk HP (penonton & pemain) */
export function caturView(h: CaturHost, now: number) {
  const g = h.catur;
  if (!g) return {};
  const run = running(g);
  return {
    turn: g.result ? null : uidOf(g, g.st.turn),
    catur: {
      board: g.st.b.join(''), turn: g.st.turn, cast: g.st.cast, ep: g.st.ep, half: g.st.half, full: g.st.full,
      white: g.white, black: g.black, clocks: g.clocks, runFrom: g.runFrom, running: run, grace: CATUR_GRACE_MS,
      firstUntil: g.plies < 2 && !g.result ? g.runFrom + g.cfg.firstMoveMs : null,
      idleWarnAt: run ? g.runFrom + g.cfg.idleWarnMs : null, idleUntil: run ? g.runFrom + g.cfg.idleMs : null,
      plies: g.plies, moves: g.san, captured: g.captured, drawOffer: g.drawOffer, drawFrom: g.cfg.drawOfferFromPly,
      offersLeft: Object.fromEntries([g.white, g.black].map((id) => [id, Math.max(0, g.cfg.drawOffers - (g.offers[id] ?? 0))])),
      promoAutoMs: g.cfg.promoAutoMs, minPlies: g.cfg.minPlies, result: g.result, startedAt: g.startedAt, now,
    },
  };
}

/** peringkat & faktor hadiah: menang 1, remis 0,6, kalah 0,4; yang pergi 0. Batal = tanpa peringkat. */
export function caturRank(h: CaturHost): { id: string; rank: number; factor: number }[] {
  const g = h.catur;
  if (!g?.result || g.result.reason === 'batal') return [];
  const w = g.result.winner;
  return [g.white, g.black].map((id) => {
    const c = colorOfUid(g, id)!;
    if (h.left.has(id)) return { id, rank: 2, factor: 0 };
    if (!w) return { id, rank: 1, factor: 0.6 };
    return w === c ? { id, rank: 1, factor: 1 } : { id, rank: 2, factor: 0.4 };
  }).sort((a, b) => a.rank - b.rank);
}
/** syarat hadiah: paling tidak `minPlies` paruh langkah (kurang = tanpa hadiah & tanpa memakai jatah) */
export const caturGate = (h: CaturHost) => !!h.catur && h.catur.plies >= h.catur.cfg.minPlies;
/** kursi di Pos Ronda selama bermain: 1 = Putih (kiri), 2 = Hitam (kanan) */
export function caturSeat(h: CaturHost, uid: string) {
  const g = h.catur;
  if (!g || g.result) return null;
  return uid === g.white ? 1 : uid === g.black ? 2 : null;
}
