// Mini-game Balai Main. Urutan & tata letak ditentukan dari seed, sehingga server bisa
// menghitung ulang skor dari langkah pemain (client tidak bisa mengarang skor).
import { mulberry32 } from './economy';

export const GAMES = {
  panen: { name: 'Panen Buah', desc: 'Geser keranjang untuk menangkap buah yang jatuh. Hindari kerikil!' },
  memori: { name: 'Ingat Jajanan', desc: 'Buka dua kartu, cari pasangan jajanan yang sama secepatnya.' },
  bakiak: { name: 'Balap Bakiak', desc: 'Ketuk kaki kiri dan kanan sesuai aba-aba. Salah langkah, timmu tersandung!' },
  gasing: { name: 'Gasing', desc: 'Lepas gasing saat tenaganya pas di zona hijau supaya berputar lama.' },
  layangan: { name: 'Tangkap Layangan', desc: 'Ketuk layangan putus sebelum jatuh. Layangan emas +3, layangan sobek jangan diambil!' },
  pinang: { name: 'Panjat Pinang', desc: 'Ketuk berirama untuk memanjat tiang licin. Terlalu cepat malah melorot!', event: 'bendera' },
} as const;
export type GameId = keyof typeof GAMES;

/* ---------------- Panen Buah ---------------- */

export const PANEN_LANES = 5;
export interface Drop {
  t: number; // ms sejak mulai
  lane: number;
  kind: 'buah' | 'emas' | 'kerikil' | 'event';
  value: number; // poin (negatif untuk kerikil)
}

/** Jadwal benda jatuh. `eventDrops` true bila ada event aktif yang punya benda khusus. */
export function panenSchedule(seed: number, durationMs = 30_000, eventDrops = false): Drop[] {
  const r = mulberry32(seed);
  const out: Drop[] = [];
  let t = 900;
  while (t < durationMs - 1200) {
    const prog = t / durationMs; // makin lama makin cepat
    const x = r();
    const kind: Drop['kind'] = x < 0.16 ? 'kerikil' : x < 0.24 ? 'emas' : eventDrops && x < 0.36 ? 'event' : 'buah';
    const value = kind === 'kerikil' ? -2 : kind === 'emas' ? 3 : kind === 'event' ? 2 : 1;
    out.push({ t: Math.round(t), lane: Math.floor(r() * PANEN_LANES), kind, value });
    t += 720 - prog * 360 + r() * 260;
  }
  return out;
}

/** Waktu jatuh dari atas sampai keranjang. */
export const PANEN_FALL_MS = 1900;

export function panenScore(schedule: Drop[], caught: number[]) {
  const seen = new Set<number>();
  let score = 0, events = 0;
  for (const i of caught) {
    if (!Number.isInteger(i) || i < 0 || i >= schedule.length || seen.has(i)) return null;
    seen.add(i);
    score += schedule[i].value;
    if (schedule[i].kind === 'event') events++;
  }
  return { score: Math.max(0, score), events };
}

/* ---------------- Ingat Jajanan ---------------- */

export const MEMORI_PAIRS = 8;
export const MEMORI_FACES = ['pisang', 'tumpeng', 'bola3', 'mangkuk', 'jagung', 'kue', 'eskrim', 'donat', 'sate', 'martabak', 'roti', 'stroberi', 'buah', 'gelas'];

/** Acak di tempat dengan Fisher–Yates: hasilnya sama di browser mana pun dan di server. */
function shuffle<T>(arr: T[], r: () => number) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Tata letak 16 kartu: setiap angka muncul dua kali; nilainya indeks ke MEMORI_FACES. */
export function memoriLayout(seed: number) {
  const r = mulberry32(seed);
  const pick = shuffle([...MEMORI_FACES.keys()], r).slice(0, MEMORI_PAIRS);
  return shuffle([...pick, ...pick], r);
}

/** Putar ulang langkah pemain. Sah bila semua pasangan ketemu. */
export function memoriReplay(layout: number[], flips: [number, number][]) {
  const done = new Set<number>();
  for (const f of flips) {
    if (!Array.isArray(f) || f.length !== 2) return null;
    const [a, b] = f;
    if (![a, b].every((x) => Number.isInteger(x) && x >= 0 && x < layout.length) || a === b || done.has(a) || done.has(b)) return null;
    if (layout[a] === layout[b]) { done.add(a); done.add(b); }
  }
  if (done.size !== layout.length) return null;
  return { moves: flips.length };
}

export function memoriStars(moves: number) {
  return moves <= 12 ? 3 : moves <= 18 ? 2 : 1;
}

/* ---------------- Balap Bakiak ---------------- */

export const BAKIAK = { stumbleMs: 700, minGapMs: 70, finish: 60 };
export type Foot = 'L' | 'R';

/** Aba-aba kaki: kebanyakan bergantian, kadang kaki yang sama dua kali. */
export function bakiakPrompts(seed: number, n = 240): Foot[] {
  const r = mulberry32(seed);
  const out: Foot[] = [];
  let f: Foot = r() < 0.5 ? 'L' : 'R';
  for (let i = 0; i < n; i++) {
    out.push(f);
    if (r() > 0.22) f = f === 'L' ? 'R' : 'L';
  }
  return out;
}

/** Putar ulang ketukan [ms, kaki]. Langkah benar maju 1; salah = tersandung (ketukan diabaikan sebentar). */
export function bakiakReplay(seed: number, taps: [number, Foot][], durationMs: number) {
  const prompts = bakiakPrompts(seed);
  let steps = 0, stumbles = 0, lockUntil = -1, last = -Infinity;
  for (const tap of taps) {
    if (!Array.isArray(tap) || tap.length !== 2) return null;
    const [t, f] = tap;
    if (!Number.isFinite(t) || t < 0 || t > durationMs + 300 || (f !== 'L' && f !== 'R') || t - last < BAKIAK.minGapMs) return null;
    last = t;
    if (t < lockUntil || steps >= prompts.length) continue;
    if (f === prompts[steps]) steps++;
    else { stumbles++; lockUntil = t + BAKIAK.stumbleMs; }
  }
  return { steps, stumbles };
}

/* ---------------- Gasing ---------------- */

export interface GasingRound { speed: number; zone: number; width: number }
export function gasingRounds(seed: number, rounds = 5): GasingRound[] {
  const r = mulberry32(seed);
  return Array.from({ length: rounds }, (_, i) => ({
    speed: Math.round(1300 - i * 90 - r() * 260), // ms dari kosong ke penuh; makin lama makin cepat
    zone: Math.round((0.55 + r() * 0.3) * 100) / 100,
    width: Math.round((0.11 - i * 0.008) * 1000) / 1000,
  }));
}
/** Tenaga 0..1 naik-turun (gelombang segitiga). */
export const gasingMeter = (t: number, speed: number) => { const p = (Math.max(0, t) % (2 * speed)) / speed; return p <= 1 ? p : 2 - p; };

/** Lama putaran satu ronde (detik, satu desimal) bila dilepas pada t ms. */
export function gasingSpin(r: GasingRound, t: number) {
  const dist = Math.abs(gasingMeter(t, r.speed) - r.zone);
  const quality = Math.max(0, 1 - dist / (r.width * 3));
  return Math.round((2 + quality * 8 + (dist <= r.width ? 2 : 0)) * 10) / 10;
}

/** Lama putaran (detik, satu desimal) dari waktu lepas tiap ronde. */
export function gasingScore(seed: number, releases: number[], rounds = 5) {
  if (!Array.isArray(releases) || releases.length !== rounds) return null;
  const rs = gasingRounds(seed, rounds);
  const spins: number[] = [];
  for (let i = 0; i < rounds; i++) {
    const t = releases[i];
    if (!Number.isFinite(t) || t < 150 || t > 20_000) return null;
    spins.push(gasingSpin(rs[i], t));
  }
  return { spins, total: Math.round(spins.reduce((a, b) => a + b, 0) * 10) / 10 };
}

/* ---------------- Tangkap Layangan ---------------- */

export const LAYANGAN_FALL_MS = 3600;
export interface Kite { t: number; x: number; sway: number; kind: 'biasa' | 'emas' | 'sobek'; value: number; color: number }
export function layanganSchedule(seed: number, durationMs = 25_000): Kite[] {
  const r = mulberry32(seed);
  const out: Kite[] = [];
  let t = 700;
  while (t < durationMs - LAYANGAN_FALL_MS * 0.6) {
    const x = r();
    const kind: Kite['kind'] = x < 0.14 ? 'sobek' : x < 0.24 ? 'emas' : 'biasa';
    out.push({ t: Math.round(t), x: Math.round((0.12 + r() * 0.76) * 1000) / 1000, sway: Math.round((0.03 + r() * 0.08) * 1000) / 1000, kind, value: kind === 'emas' ? 3 : kind === 'sobek' ? -1 : 1, color: Math.floor(r() * 5) });
    t += 650 + r() * 520 - (t / durationMs) * 220;
  }
  return out;
}
/** Posisi layangan (0..1) pada waktu t: turun sambil meliuk. */
export function kitePos(k: Kite, t: number) {
  const a = (t - k.t) / LAYANGAN_FALL_MS;
  return { x: k.x + Math.sin((t - k.t) / 650) * k.sway, y: -0.08 + a * 1.06 };
}
export function layanganScore(sched: Kite[], caught: [number, number][], durationMs: number) {
  const seen = new Set<number>();
  let score = 0;
  for (const c of caught) {
    if (!Array.isArray(c) || c.length !== 2) return null;
    const [i, t] = c;
    if (!Number.isInteger(i) || i < 0 || i >= sched.length || seen.has(i)) return null;
    const k = sched[i];
    if (!Number.isFinite(t) || t < k.t || t > k.t + LAYANGAN_FALL_MS + 150 || t > durationMs + 300) return null;
    seen.add(i);
    score += k.value;
  }
  return { score: Math.max(0, score) };
}

/* ---------------- Panjat Pinang (event Agustusan) ---------------- */

export const PINANG = { top: 100, climb: 3.2, slipFast: 5, rhythmMs: 140, slipPerSec: 6, prizes: [25, 50, 75, 100], minGapMs: 55 };
/** Licinnya tiang dari seed (0,85–1,2). */
export const pinangGrease = (seed: number) => Math.round((0.85 + mulberry32(seed)() * 0.35) * 100) / 100;

/** Putar ulang ketukan (ms). Berirama = naik; terlalu cepat = melorot; diam = melorot pelan. */
export function pinangReplay(seed: number, taps: number[], durationMs: number) {
  const grease = pinangGrease(seed);
  let h = 0, maxH = 0, prev = 0, last = -Infinity;
  for (const t of taps) {
    if (!Number.isFinite(t) || t < 0 || t > durationMs + 300 || t - last < PINANG.minGapMs) return null;
    h = Math.max(0, h - (PINANG.slipPerSec * grease * (t - prev)) / 1000);
    h = t - last < PINANG.rhythmMs ? Math.max(0, h - PINANG.slipFast * grease) : Math.min(PINANG.top, h + PINANG.climb);
    prev = t; last = t;
    maxH = Math.max(maxH, h);
    if (h >= PINANG.top) break;
  }
  const height = Math.round(maxH);
  return { height, tiers: PINANG.prizes.filter((p) => height >= p).length };
}

/* ---------------- Duel dengan teman ---------------- */

/** Mini-game yang bisa dipakai duel (seed sama untuk kedua pemain). */
export const DUEL_GAMES = ['bakiak', 'gasing', 'layangan'] as const;
export type DuelGame = (typeof DUEL_GAMES)[number];
export const GASING_SPIN_MS = 1700; // jeda animasi putaran antar ronde Gasing

/** Skor duel (bilangan bulat, makin besar makin baik) dari langkah pemain. null = tidak sah. */
export function duelScore(game: string, seed: number, meta: any, inputs: any): number | null {
  if (game === 'bakiak') {
    const r = bakiakReplay(seed, Array.isArray(inputs?.taps) ? inputs.taps.slice(0, 600) : [], Number(meta?.durationMs) || 20_000);
    // langkah lebih banyak menang; bila sama, yang lebih jarang tersandung
    return r ? Math.min(BAKIAK.finish, r.steps) * 100 + (99 - Math.min(99, r.stumbles)) : null;
  }
  if (game === 'gasing') {
    const r = gasingScore(seed, Array.isArray(inputs?.releases) ? inputs.releases.map(Number) : [], Number(meta?.rounds) || 5);
    return r ? Math.round(r.total * 10) : null;
  }
  if (game === 'layangan') {
    const d = Number(meta?.durationMs) || 25_000;
    const r = layanganScore(layanganSchedule(seed, d), Array.isArray(inputs?.caught) ? inputs.caught.slice(0, 300) : [], d);
    return r ? r.score : null;
  }
  return null;
}

/** Skor duel untuk dibaca pemain. */
export function duelLabel(game: string, score: number | null | undefined) {
  if (score === null || score === undefined) return '—';
  if (game === 'bakiak') return `${Math.floor(score / 100)} langkah`;
  if (game === 'gasing') return `${(score / 10).toFixed(1)} detik`;
  return `${score} poin`;
}

/**
 * Progres lawan "bayangan" pada waktu t (ms sejak mulai), dari langkah yang tersimpan:
 * Bakiak = langkah, Gasing = total detik ×10 sejauh ini, Layangan = poin.
 */
export function ghostAt(game: string, seed: number, meta: any, inputs: any, t: number): number {
  if (!inputs) return 0;
  if (game === 'bakiak') {
    const taps = (inputs.taps ?? []).filter((x: any) => Array.isArray(x) && x[0] <= t);
    return Math.min(BAKIAK.finish, bakiakReplay(seed, taps, Number(meta?.durationMs) || 20_000)?.steps ?? 0);
  }
  if (game === 'gasing') {
    const rs = gasingRounds(seed, Number(meta?.rounds) || 5);
    let at = 0, total = 0;
    (inputs.releases ?? []).forEach((r: number, i: number) => { at += Number(r); if (at <= t && rs[i]) total += gasingSpin(rs[i], Number(r)); at += GASING_SPIN_MS; });
    return Math.round(total * 10);
  }
  if (game === 'layangan') {
    const sched = layanganSchedule(seed, Number(meta?.durationMs) || 25_000);
    return Math.max(0, (inputs.caught ?? []).filter((c: any) => Array.isArray(c) && c[1] <= t && sched[c[0]]).reduce((a: number, c: any) => a + sched[c[0]].value, 0));
  }
  return 0;
}
