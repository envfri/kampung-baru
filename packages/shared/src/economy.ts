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

/* ---------------- tidur, sakit, berat badan ---------------- */

export interface SleepRule { energiPerHour: number; otherDecayMult: number }

/** Saat pet bangun sendiri: energi penuh. `from` = waktu mulai tidur (= saat kebutuhan terakhir disimpan). */
export function wakeAt(energiAtStart: number, from: number, rule: SleepRule) {
  return from + (Math.max(0, 100 - energiAtStart) / Math.max(1, rule.energiPerHour)) * 3_600_000;
}

/** Kebutuhan pada waktu `to`. Selama tidur energi naik dan kebutuhan lain turun lebih lambat; setelah bangun normal lagi. */
export function needsWithSleep(needs: Needs, from: number, to: number, perHour: Partial<Needs>, sleep?: SleepRule | null): Needs {
  if (!sleep) return decayNeeds(needs, from, to, perHour);
  const wake = wakeAt(needs.energi, from, sleep);
  const h = Math.max(0, Math.min(to, wake) - from) / 3_600_000;
  const out = { ...needs };
  for (const k of NEED_KEYS)
    out[k] = k === 'energi' ? clamp(needs.energi + sleep.energiPerHour * h, 0, 100) : clamp(needs[k] - (perHour[k] ?? 0) * sleep.otherDecayMult * h, 0, 100);
  return to > wake ? decayNeeds(out, wake, to, perHour) : out;
}

export interface HealthRule { enabled: boolean; lowThreshold: number; lowCount: number; sickAfterHours: number }

/** Kapan pet mulai sakit bila dibiarkan: `lowCount` kebutuhan di bawah ambang selama `sickAfterHours` jam. */
export function sickOnset(needs: Needs, from: number, perHour: Partial<Needs>, rule: HealthRule) {
  if (!rule.enabled) return Infinity;
  const cross = NEED_KEYS.map((k) => {
    if (needs[k] < rule.lowThreshold) return from;
    const r = perHour[k] ?? 0;
    return r > 0 ? from + ((needs[k] - rule.lowThreshold) / r) * 3_600_000 : Infinity;
  }).sort((a, b) => a - b);
  const t = cross[Math.max(0, Math.min(NEED_KEYS.length, rule.lowCount) - 1)];
  return Number.isFinite(t) ? t + rule.sickAfterHours * 3_600_000 : Infinity;
}

export interface WeightRule { perExcess: number; lossPerDay: number; chubbyAt: number }
export const weightNow = (w: number, from: number, to: number, rule: WeightRule) => clamp(w - rule.lossPerDay * (Math.max(0, to - from) / 86_400_000), 0, 100);
/** Seberapa gembul tampilannya (0 = biasa, 1 = gembul sekali). */
export const chubOf = (w: number, rule: Pick<WeightRule, 'chubbyAt'>) => clamp((w - rule.chubbyAt * 0.6) / (100 - rule.chubbyAt * 0.6), 0, 1);

export type PetMood = 'tidur' | 'sakit' | 'lapar' | 'capek' | 'kotor' | 'bosan' | 'senang' | 'biasa';
/** Suasana hati yang tampak di wajah pet (urut prioritas). */
export function petMood(n: Needs, o: { sleeping?: boolean; sick?: boolean } = {}): PetMood {
  if (o.sleeping) return 'tidur';
  if (o.sick) return 'sakit';
  if (n.kenyang < 30) return 'lapar';
  if (n.energi < 30) return 'capek';
  if (n.bersih < 35) return 'kotor';
  if (n.ceria < 30) return 'bosan';
  if (Math.min(n.kenyang, n.bersih, n.ceria, n.energi) >= 70) return 'senang';
  return 'biasa';
}
/** Keadaan tubuh untuk gambar pet: wajah, noda kotor, gembul. */
export function petLookState(n: Needs, o: { sleeping?: boolean; sick?: boolean; chub?: number } = {}) {
  return { mood: petMood(n, o), dirt: clamp((55 - n.bersih) / 55, 0, 1), chub: o.chub ?? 0 };
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

export function mood(name: string, n: Needs, o: { sleeping?: boolean; sick?: boolean; chubby?: boolean } = {}) {
  if (o.sleeping) return `${name} lagi tidur nyenyak`;
  if (o.sick) return `${name} kurang enak badan`;
  const [k, v] = (Object.entries(n) as [NeedKey, number][]).sort((a, b) => a[1] - b[1])[0];
  if (v >= 50 && o.chubby) return `${name} lagi gembul`;
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
