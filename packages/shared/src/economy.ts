// Aturan ekonomi & kebutuhan yang dipakai bersama oleh server (sumber kebenaran)
// dan client (untuk tampilan yang mulus di antara respons server).

export const NEED_KEYS = ['kenyang', 'bersih', 'ceria', 'energi'] as const;
export type NeedKey = (typeof NEED_KEYS)[number];
export type Needs = Record<NeedKey, number>;

export const NEED_LABEL: Record<NeedKey, string> = {
  kenyang: 'Kenyang',
  bersih: 'Bersih',
  ceria: 'Ceria',
  energi: 'Energi',
};

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Kebutuhan turun seiring waktu; dihitung saat dibaca, bukan di-tick oleh server. */
export function decayNeeds(needs: Needs, fromMs: number, toMs: number, perHour: Partial<Needs>): Needs {
  const hours = Math.max(0, toMs - fromMs) / 3_600_000;
  const out = { ...needs };
  for (const k of NEED_KEYS) out[k] = clamp(needs[k] - (perHour[k] ?? 0) * hours, 0, 100);
  return out;
}

export function applyNeedDelta(needs: Needs, delta: Partial<Needs>): Needs {
  const out = { ...needs };
  for (const k of NEED_KEYS) if (delta[k]) out[k] = clamp(out[k] + (delta[k] as number), 0, 100);
  return out;
}

export function xpToNext(level: number, s: { xpBase: number; xpStep: number }) {
  return s.xpBase + level * s.xpStep;
}

export function addXp(level: number, xp: number, gain: number, s: { xpBase: number; xpStep: number }) {
  let lv = level;
  let x = xp + gain;
  let gained = 0;
  while (x >= xpToNext(lv, s)) {
    x -= xpToNext(lv, s);
    lv++;
    gained++;
  }
  return { level: lv, xp: x, levelsGained: gained };
}

export function mood(name: string, n: Needs) {
  const [k, v] = (Object.entries(n) as [NeedKey, number][]).sort((a, b) => a[1] - b[1])[0];
  const low: Record<NeedKey, string> = { kenyang: 'lapar sekali', bersih: 'perlu mandi', ceria: 'lagi bosan', energi: 'ngantuk berat' };
  const mid: Record<NeedKey, string> = { kenyang: 'mulai lapar', bersih: 'agak kotor', ceria: 'ingin main', energi: 'mulai capek' };
  return `${name} ${v < 25 ? low[k] : v < 50 ? mid[k] : 'lagi senang'}`;
}

/** Tanggal lokal (WIB, UTC+7) sebagai YYYY-MM-DD — dipakai untuk batas harian. */
export function dayKey(ms: number, tzOffsetMin = 420) {
  return new Date(ms + tzOffsetMin * 60_000).toISOString().slice(0, 10);
}

/* ---------------- RNG & Lomba Karung ---------------- */

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const KARUNG_RIVALS = [
  { name: 'Kopi', color: '#B98A64', ear: 'anjing', pattern: 'totol', eyes: 'senyum' },
  { name: 'Gendhis', color: '#C9B6E8', ear: 'kelinci', pattern: 'bintang', eyes: 'berbinar' },
  { name: 'Tempe', color: '#A8D8A0', ear: 'tunas', pattern: 'belang', eyes: 'bulat' },
  { name: 'Onde', color: '#F4D58D', ear: 'kucing', pattern: 'topeng', eyes: 'sayu' },
  { name: 'Serabi', color: '#F2EEE3', ear: 'rubah', pattern: 'ujung', eyes: 'bulat' },
  { name: 'Cilok', color: '#9FD0E8', ear: 'antena', pattern: 'polos', eyes: 'bintang' },
];

/** Lawan & waktu finish mereka ditentukan dari seed, sehingga server bisa menghitung ulang peringkat. */
export function karungRace(seed: number, difficulty = 1) {
  const r = mulberry32(seed);
  const pool = [...KARUNG_RIVALS];
  const rivals = [];
  for (let i = 0; i < 3; i++) {
    const idx = Math.floor(r() * pool.length);
    const p = pool.splice(idx, 1)[0];
    // waktu finish 6,2–11 detik, makin sulit makin cepat
    const timeMs = Math.round((6200 + r() * 4800) / difficulty);
    rivals.push({ ...p, timeMs });
  }
  return rivals.sort((a, b) => a.timeMs - b.timeMs);
}

export const KARUNG_HOPS = 40; // lompatan untuk mencapai garis finish
export const KARUNG_MAX_TAPS_PER_SEC = 14;
