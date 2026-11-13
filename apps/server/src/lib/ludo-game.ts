// Sesi Ludo main bareng (rumah & alun-alun, 2–4 pemain). Dipanggil dari routes/bareng.ts: semua dadu, langkah,
// waktu habis (lempar / pilih otomatis), batas 15 menit, peringkat, dan syarat hadiah dihitung di sini (server).
import { randomInt } from 'node:crypto';
import {
  DEFAULT_SETTINGS, LUDO_BASE, LUDO_DICE_MS, LUDO_HOME, LUDO_JOIN_SEAT, ULAR_RANK, framesMs, ludoAgain, ludoApply, ludoAutoPick, ludoDistinct, ludoFrames,
  ludoHomeCount, ludoOptions, ludoPlan, ludoProgress, ludoRollRule, ludoTokensFor, type LudoMove, type LudoStep, type LudoTokens,
} from '@kb/shared';
import { bad } from './core';

export type LudoCfg = { tokensByPlayers: Record<string, number>; rollMs: number; pickMs: number; maxMs: number; captureBonus: boolean; minMs: number; stepMs: number };
export interface LudoState {
  /** kursi (warna) tiap pemain: 0 hijau, 1 kuning, 2 biru, 3 merah */
  seat: Record<string, number>;
  perSeat: number;
  /** kemajuan bidak tiap pemain (-1 kandang · 0..50 jalur · 51..55 lajur pulang · 56 rumah); pemain yang keluar dihapus */
  tok: LudoTokens;
  phase: 'roll' | 'pick';
  roll: number | null;
  /** 6 berturut-turut di giliran ini */
  sixes: number;
  /** urutan pemain yang semua bidaknya sudah pulang */
  finished: string[];
  cfg: LudoCfg;
}
type P = { id: string; name: string };
/** bagian sesi main bareng yang dipakai Ludo */
export interface LudoHost<T extends P = P> {
  players: T[]; left: Set<string>; turn: number; turnUntil: number; last: any; moves: number;
  startedAt: number; endedAt: number; why: string; ludo?: LudoState;
}
/** alat dari routes/bareng.ts (jam server, catatan, seq, akhir permainan) */
export interface LudoIO { now(): number; note(line: string): void; bump(): void; end(why: string): void }

let dice = () => randomInt(1, 7);
/** Untuk uji: dadu tetap (null = acak lagi). */
export function setLudoDice(fn: (() => number) | null) { dice = fn ?? (() => randomInt(1, 7)); }

const num = (v: unknown, def: number, min: number, max: number) => { const n = Number(v); return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : def; };
/** pengaturan Ludo dari admin (dengan batas aman) */
export function ludoCfg(settings: any): LudoCfg {
  const d = DEFAULT_SETTINGS.ludo, s = settings?.ludo ?? {};
  const maxMs = num(s.maxMs, d.maxMs, 60_000, 3_600_000);
  return {
    tokensByPlayers: { ...d.tokensByPlayers, ...(s.tokensByPlayers ?? {}) },
    rollMs: num(s.rollMs, d.rollMs, 3000, 60_000), pickMs: num(s.pickMs, d.pickMs, 3000, 60_000), maxMs,
    captureBonus: s.captureBonus !== false, minMs: num(s.minMs, d.minMs, 0, maxMs), stepMs: num(s.stepMs, d.stepMs, 60, 600),
  };
}
/** keadaan awal (sebelum mulai) saat ajakan dibuat */
export const ludoNew = (settings: any): LudoState => ({ seat: {}, perSeat: 0, tok: {}, phase: 'roll', roll: null, sixes: 0, finished: [], cfg: ludoCfg(settings) });

/** Mulai: kursi menurut urutan ikut (berdua berseberangan), giliran searah jarum jam, bidak per pemain menurut jumlah pemain. */
export function ludoBegin(s: LudoHost, io: LudoIO) {
  const L = s.ludo!;
  s.players.forEach((p, i) => { L.seat[p.id] = LUDO_JOIN_SEAT[i]; });
  s.players.sort((a, b) => L.seat[a.id] - L.seat[b.id]);
  L.perSeat = ludoTokensFor(s.players.length, L.cfg.tokensByPlayers);
  for (const p of s.players) L.tok[p.id] = Array(L.perSeat).fill(LUDO_BASE);
  L.phase = 'roll'; L.roll = null; L.sixes = 0; L.finished = [];
  s.turn = 0;
  io.note(`${s.players[0].name} melempar dadu duluan. ${L.perSeat} bidak tiap pemain.`);
}

const playing = (s: LudoHost) => s.players.filter((p) => !s.left.has(p.id) && !s.ludo!.finished.includes(p.id));
/** giliran pindah ke pemain berikutnya yang masih main (searah jarum jam) */
function passTurn(s: LudoHost, io: LudoIO, anim: number) {
  const L = s.ludo!, n = s.players.length;
  L.phase = 'roll'; L.roll = null; L.sixes = 0;
  for (let k = 1; k <= n; k++) {
    const i = (s.turn + k) % n, p = s.players[i];
    if (s.left.has(p.id) || L.finished.includes(p.id)) continue;
    s.turn = i;
    break;
  }
  s.turnUntil = io.now() + anim + L.cfg.rollMs;
}

function roll(s: LudoHost, io: LudoIO, auto: boolean) {
  const L = s.ludo!, me = s.players[s.turn], now = io.now();
  const n = dice();
  const rr = ludoRollRule(L.sixes, n);
  L.sixes = rr.sixes; s.moves++;
  const opts = rr.void ? [] : ludoOptions(L.tok, L.seat, me.id, n);
  const choices = ludoDistinct(opts);
  // satu pilihan saja (atau semua bidak di kotak yang sama): langsung jalan setelah jeda singkat
  if (choices.length === 1) return move(s, io, choices[0], n, auto, true);
  if (!choices.length) {
    // 6 ketiga = hangus; tidak ada bidak yang bisa jalan = giliran lewat (dapat 6 tetap lempar lagi)
    const st: LudoStep = { roll: n, token: null, from: LUDO_BASE, to: LUDO_BASE, capture: [], home: false, pass: !rr.void, void: rr.void };
    const anim = framesMs(ludoFrames(st, { dice: true }));
    const again = !rr.void && ludoAgain(n, L.sixes, null);
    s.last = { by: me.id, seat: L.seat[me.id], ...st, again, auto, at: now, anim };
    io.note(rr.void ? `${me.name} dapat 6 tiga kali berturut-turut, lemparannya hangus.` : `${me.name} dapat ${n}, tidak ada bidak yang bisa jalan.`);
    if (again) { L.phase = 'roll'; s.turnUntil = now + anim + L.cfg.rollMs; }
    else passTurn(s, io, anim);
    io.bump();
    return;
  }
  L.phase = 'pick'; L.roll = n;
  const anim = LUDO_DICE_MS;
  s.last = { by: me.id, seat: L.seat[me.id], roll: n, token: null, from: null, to: null, capture: [], home: false, pick: true, again: false, auto, at: now, anim };
  s.turnUntil = now + anim + L.cfg.pickMs;
  io.bump();
}

function move(s: LudoHost, io: LudoIO, m: LudoMove, n: number, auto: boolean, withDice = false) {
  const L = s.ludo!, me = s.players[s.turn], now = io.now();
  L.tok = ludoApply(L.tok, me.id, m);
  s.moves++;
  const done = L.tok[me.id].every((r) => r >= LUDO_HOME);
  if (done) L.finished.push(me.id);
  const again = ludoAgain(n, L.sixes, m, { captureBonus: L.cfg.captureBonus, done });
  const st: LudoStep = { roll: n, token: m.token, from: m.from, to: m.to, capture: m.capture, home: m.home };
  const anim = framesMs(ludoFrames(st, { dice: withDice, wait: withDice, stepMs: L.cfg.stepMs }));
  s.last = { by: me.id, seat: L.seat[me.id], ...st, again, auto, at: now, anim };
  const name = (id: string) => s.players.find((p) => p.id === id)?.name ?? 'Teman';
  if (m.capture.length) io.note(`${me.name} memakan bidak ${[...new Set(m.capture.map((c) => name(c.id)))].join(' & ')}!`);
  if (done) io.note(`Semua bidak ${me.name} pulang! Juara ${L.finished.length}.`);
  else if (m.home) io.note(`Bidak ${me.name} pulang (${ludoHomeCount(L.tok[me.id])}/${L.perSeat}).`);
  L.phase = 'roll'; L.roll = null;
  if (playing(s).length <= 1) { io.end('selesai'); return; }
  if (again) { s.turnUntil = now + anim + L.cfg.rollMs; io.note(`${me.name} lempar lagi.`); }
  else passTurn(s, io, anim);
  io.bump();
}

/** Langkah pemain yang sedang giliran: {roll:true} atau {token:k}. */
export function ludoAct(s: LudoHost, b: any, io: LudoIO) {
  const L = s.ludo!;
  if (b?.roll === true) {
    if (L.phase !== 'roll') throw bad('invalid_move', 'Pilih bidak dulu.');
    return roll(s, io, false);
  }
  if (b?.token === undefined || L.phase !== 'pick' || L.roll === null) throw bad('invalid_move', 'Lempar dadu dulu.');
  const m = ludoPlan(L.tok, L.seat, s.players[s.turn].id, Number(b.token), L.roll);
  if (!m) throw bad('invalid_move', 'Bidak itu tidak bisa jalan. Pilih bidak yang menyala.');
  move(s, io, m, L.roll, false);
}

/** Pemeriksaan berkala selama main: bidak pemain yang keluar diangkat, giliran kosong dilewati, waktu habis = server bertindak. */
export function ludoTick(s: LudoHost, now: number, io: LudoIO) {
  const L = s.ludo;
  if (!L) return;
  let changed = false;
  for (const id of s.left) if (L.tok[id] && !L.finished.includes(id)) { delete L.tok[id]; changed = true; }
  if (playing(s).length <= 1) { io.end('pergi'); return; }
  const cur = s.players[s.turn];
  if (s.left.has(cur.id) || L.finished.includes(cur.id)) { passTurn(s, io, 0); io.bump(); return; }
  if (changed) io.bump();
  if (now < s.turnUntil) return;
  if (L.phase === 'roll') return roll(s, io, true);
  const m = ludoAutoPick(ludoOptions(L.tok, L.seat, cur.id, L.roll ?? 0));
  if (m) move(s, io, m, L.roll!, true);
  else { passTurn(s, io, 0); io.bump(); }
}

/** data Ludo untuk sinkron (tok tanpa pemain yang keluar; movable = bidak yang bisa dipilih pemain yang giliran) */
export function ludoView(s: LudoHost) {
  const L = s.ludo;
  if (!L) return null;
  const cur = s.players[s.turn];
  const movable = L.phase === 'pick' && L.roll !== null && cur ? ludoOptions(L.tok, L.seat, cur.id, L.roll).map((m) => m.token) : [];
  const { rollMs, pickMs, maxMs, minMs, stepMs } = L.cfg;
  return { seat: L.seat, perSeat: L.perSeat, tok: L.tok, phase: L.phase, roll: L.roll, movable, finished: L.finished, sixes: L.sixes, cfg: { rollMs, pickMs, maxMs, minMs, stepMs }, paid: ludoPaid(s) };
}

/** syarat hadiah: selesai normal atau sudah main paling tidak minMs (5 menit) */
export function ludoPaid(s: LudoHost) {
  if (!s.ludo || !s.endedAt) return true;
  return s.why === 'selesai' || s.endedAt - s.startedAt >= s.ludo.cfg.minMs;
}

/** Peringkat: yang pulang semua menurut urutan, lalu menurut langkah total bidak; yang keluar terakhir tanpa hadiah. */
export function ludoRanked<T extends P>(s: LudoHost<T>) {
  const L = s.ludo!;
  const steps = (id: string) => ludoProgress(L.tok[id] ?? []);
  const rest = s.players.filter((p) => !s.left.has(p.id) && !L.finished.includes(p.id)).sort((a, b) => steps(b.id) - steps(a.id) || L.seat[a.id] - L.seat[b.id]);
  const order = [...L.finished.map((id) => s.players.find((p) => p.id === id)!).filter(Boolean), ...rest];
  const paid = ludoPaid(s);
  const out = order.map((p, k) => ({ p, rank: k + 1, score: steps(p.id), factor: paid ? ULAR_RANK[k] ?? 0.2 : 0, left: false }));
  for (const p of s.players) if (!order.includes(p)) out.push({ p, rank: order.length + 1, score: 0, factor: 0, left: true });
  return out;
}
