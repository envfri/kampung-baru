// Mini-game Balai Main. Urutan & tata letak ditentukan dari seed, sehingga server bisa
// menghitung ulang skor dari langkah pemain (client tidak bisa mengarang skor).
import { mulberry32 } from './economy';

export const GAMES = {
  panen: { name: 'Panen Buah', desc: 'Geser keranjang untuk menangkap buah yang jatuh. Hindari kerikil!' },
  memori: { name: 'Ingat Jajanan', desc: 'Buka dua kartu, cari pasangan jajanan yang sama secepatnya.' },
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
