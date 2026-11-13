// Alun-alun kampung: lapangan luas tempat semua pemain berkumpul (bukan hanya teman).
// Tata letak, properti, aksi, dan jadwal (panggung, arak-arakan, kereta, bianglala, lomba, malam) dibuat tetap di sini
// supaya server & semua HP melihat hal yang sama. Semua jadwal = fungsi murni dari jam (ms).
import type { ItemLike, Placed } from './art';

/** lebar (sumbu x) & panjang (sumbu y) lapangan, petak: 20×20 lama + sayap timur Pojok Wahana + jalur depan */
export const ALUN_W = 28;
export const ALUN_D = 22;
/** id "ruangan" alun-alun pada denah & sinkron live */
export const ALUN_ROOM = 'alun';

type PropDef = { key: string; name: string; w: number; d: number; flat?: boolean; colors?: Record<string, string>; params?: Record<string, number>; mask?: [number, number][] };
const PROPS: Record<string, PropDef> = {
  'alun-panggung': { key: 'panggung', name: 'Panggung Hiburan', w: 4, d: 2 },
  'alun-beringin': { key: 'beringin', name: 'Beringin Kembar', w: 2, d: 2 },
  'alun-airmancur': { key: 'airmancur', name: 'Air Mancur', w: 2, d: 2 },
  'alun-komidi': { key: 'komidi', name: 'Komidi Putar', w: 3, d: 3 },
  'alun-ayunan': { key: 'ayunan', name: 'Ayunan', w: 2, d: 1 },
  'alun-dawet': { key: 'gerobak', name: 'Gerobak Es Dawet', w: 2, d: 1, colors: { main: '#3FA06A', accent: '#FFFDF7' }, params: { kind: 0 } },
  'alun-bakso': { key: 'gerobak', name: 'Gerobak Bakso', w: 2, d: 1, colors: { main: '#C0392B', accent: '#FFF4D6' }, params: { kind: 1 } },
  'alun-arummanis': { key: 'gerobak', name: 'Gerobak Arum Manis', w: 2, d: 1, colors: { main: '#D97BA6', accent: '#FFFDF7' }, params: { kind: 2 } },
  'alun-bangku': { key: 'bangku', name: 'Bangku Taman', w: 2, d: 1 },
  'alun-lampu': { key: 'lampujalan', name: 'Lampu Taman', w: 1, d: 1 },
  'alun-pohon': { key: 'pohon', name: 'Pohon', w: 1, d: 1 },
  'alun-payung': { key: 'payung', name: 'Payung Taman', w: 1, d: 1, colors: { main: '#E0583F', accent: '#FFFFFF' } },
  'alun-tikarular': { key: 'tikarular', name: 'Tikar Ular Tangga', w: 3, d: 3, flat: true },
  'alun-garisstart': { key: 'garisstart', name: 'Garis Start Balap Karung', w: 3, d: 1 },
  // Pojok Wahana & malam (v32)
  'alun-kolam': { key: 'kolampancing', name: 'Kolam Pemancingan Bareng', w: 6, d: 5, flat: true, mask: maskAll(6, 5) },
  'alun-papanlomba': { key: 'papanlomba', name: 'Papan Lomba Mancing', w: 1, d: 1 },
  'alun-bianglala': { key: 'bianglala', name: 'Bianglala', w: 3, d: 3 },
  'alun-gelang': { key: 'lempargelang', name: 'Lempar Gelang', w: 2, d: 2 },
  'alun-halte': { key: 'halte', name: 'Halte Kereta Kelinci', w: 1, d: 3 },
  // gapura: hanya dua tiangnya yang menghalangi, tengahnya jalan
  'alun-gapura': { key: 'gapura', name: 'Gapura Pojok Wahana', w: 1, d: 4, mask: [[0, 0], [0, 3]] },
  'alun-layar': { key: 'layartancap', name: 'Layar Tancap', w: 3, d: 1 },
  // proyektor & tikar nonton hanya tampil malam (siang: tidak tergambar & tidak menghalangi, lihat ALUN_NIGHT_ITEMS)
  'alun-proyektor': { key: 'proyektor', name: 'Proyektor Film', w: 1, d: 1, flat: true, mask: [] },
  'alun-tikarnonton': { key: 'tikarnonton', name: 'Tikar Nonton', w: 3, d: 2, flat: true },
  'alun-ondel': { key: 'ondel', name: 'Ondel-ondel Abang', w: 1, d: 1, params: { v: 0 } },
  'alun-ondelnone': { key: 'ondel', name: 'Ondel-ondel None', w: 1, d: 1, params: { v: 1 } },
};
function maskAll(w: number, d: number) { const m: [number, number][] = []; for (let a = 0; a < w; a++) for (let b = 0; b < d; b++) m.push([a, b]); return m; }
// jalan batu: satu item per ukuran (1×1 sampai 4×4) karena ukuran mebel ikut item
for (let w = 1; w <= 4; w++) for (let d = 1; d <= 4; d++) PROPS[`alun-jalan-${w}x${d}`] = { key: 'paving', name: 'Jalan Batu', w, d, flat: true };

const toItem = (id: string, p: PropDef, extra: Record<string, number> = {}): ItemLike => ({
  id, kind: 'furniture', name: p.name,
  art: { type: 'builtin', key: p.key, colors: p.colors, params: { ...p.params, ...extra } },
  data: { w: p.w, d: p.d, flat: !!p.flat, tap: p.key === 'tikarular' || p.key === 'tikarnonton', ...(p.mask ? { mask: p.mask } : {}) },
} as ItemLike);
/** Benda di alun-alun dalam bentuk item mebel (digambar dengan art builtin). */
export const ALUN_ITEMS: Record<string, ItemLike> = Object.fromEntries(Object.entries(PROPS).map(([id, p]) => [id, toItem(id, p)]));
/** Pengganti item saat malam: layar terbentang, proyektor & tikar nonton muncul. */
export const ALUN_NIGHT_ITEMS: Record<string, ItemLike> = {
  'alun-layar': toItem('alun-layar', PROPS['alun-layar'], { night: 1 }),
  'alun-proyektor': toItem('alun-proyektor', { ...PROPS['alun-proyektor'], flat: false, mask: undefined }, { night: 1 }),
  'alun-tikarnonton': toItem('alun-tikarnonton', PROPS['alun-tikarnonton'], { night: 1 }),
};

const path = (x: number, y: number, w: number, d: number): Placed[] => {
  // jalan batu dipotong-potong per 4 petak (ukuran mebel maksimal 4×4)
  const out: Placed[] = [];
  for (let a = 0; a < w; a += 4) for (let b = 0; b < d; b += 4) out.push({ i: `alun-jalan-${Math.min(4, w - a)}x${Math.min(4, d - b)}`, x: x + a, y: y + b });
  return out;
};

/**
 * Susunan alun-alun: panggung di belakang, beringin kembar & air mancur di tengah, wahana di kiri, jajanan di kanan;
 * sayap timur Pojok Wahana (kolam pancing, bianglala, lempar gelang, halte kereta) di balik gapura. Benda baru selalu
 * ditambah di akhir supaya indeks benda lama (dipakai daftar Main & uji) tetap.
 */
export const ALUN_LAYOUT: Placed[] = [
  // jalan: depan panggung, jalan utama dari gerbang depan ke panggung, jalan melintang
  ...path(7, 2, 6, 3), ...path(9, 5, 2, 4), ...path(9, 11, 2, 9), ...path(2, 13, 7, 2), ...path(11, 13, 7, 2),
  { i: 'alun-panggung', x: 8, y: 0 },
  { i: 'alun-airmancur', x: 9, y: 9 },
  { i: 'alun-beringin', x: 6, y: 9 }, { i: 'alun-beringin', x: 12, y: 9 },
  { i: 'alun-komidi', x: 2, y: 3 },
  { i: 'alun-ayunan', x: 3, y: 9 },
  { i: 'alun-dawet', x: 16, y: 3 }, { i: 'alun-bakso', x: 16, y: 6 }, { i: 'alun-arummanis', x: 16, y: 9 },
  { i: 'alun-payung', x: 15, y: 11 },
  { i: 'alun-bangku', x: 3, y: 16 }, { i: 'alun-bangku', x: 13, y: 17 }, { i: 'alun-bangku', x: 5, y: 6 }, { i: 'alun-bangku', x: 13, y: 5 },
  { i: 'alun-lampu', x: 8, y: 12 }, { i: 'alun-lampu', x: 12, y: 12 }, { i: 'alun-lampu', x: 8, y: 16 }, { i: 'alun-lampu', x: 12, y: 16 },
  { i: 'alun-pohon', x: 0, y: 8 }, { i: 'alun-pohon', x: 0, y: 17 }, { i: 'alun-pohon', x: 18, y: 17 }, { i: 'alun-pohon', x: 19, y: 13 }, { i: 'alun-pohon', x: 1, y: 0 },
  // game main bareng (ditaruh paling akhir supaya urutan benda lama tetap)
  { i: 'alun-tikarular', x: 5, y: 16 }, { i: 'alun-garisstart', x: 14, y: 15 },
  // v32 Pojok Wahana: jalan penyambung, Jalan Wahana, jalan belakang sayap, ke halte, jalan utama sampai tepi depan
  ...path(18, 13, 1, 2), ...path(19, 14, 1, 1), ...path(20, 13, 8, 2), ...path(21, 4, 7, 1), ...path(27, 5, 1, 8), ...path(21, 3, 2, 1), ...path(26, 15, 1, 5), ...path(9, 20, 2, 2),
  { i: 'alun-kolam', x: 20, y: 6 },
  { i: 'alun-papanlomba', x: 26, y: 5 },
  { i: 'alun-bianglala', x: 24, y: 1 },
  { i: 'alun-gelang', x: 21, y: 1 },
  { i: 'alun-halte', x: 27, y: 18 },
  { i: 'alun-gapura', x: 20, y: 12 },
  { i: 'alun-layar', x: 13, y: 0 },
  { i: 'alun-proyektor', x: 14, y: 4 },
  { i: 'alun-tikarnonton', x: 13, y: 2 },
  { i: 'alun-ondel', x: 8, y: 21 }, { i: 'alun-ondelnone', x: 11, y: 21 },
  { i: 'alun-lampu', x: 21, y: 12 }, { i: 'alun-lampu', x: 25, y: 12 }, { i: 'alun-lampu', x: 24, y: 16 }, { i: 'alun-lampu', x: 6, y: 20 }, { i: 'alun-lampu', x: 13, y: 20 },
  { i: 'alun-pohon', x: 20, y: 0 }, { i: 'alun-pohon', x: 21, y: 20 }, { i: 'alun-pohon', x: 24, y: 20 }, { i: 'alun-pohon', x: 2, y: 21 }, { i: 'alun-pohon', x: 17, y: 21 },
  { i: 'alun-bangku', x: 22, y: 12 }, { i: 'alun-bangku', x: 22, y: 17 }, { i: 'alun-payung', x: 24, y: 18 },
];

/** Aksi yang bisa dilakukan di tiap benda (diketuk). anim: pose pet (lihat ACTIVITY_ANIMS); ride: wahana panjang */
export const SQUARE_ACTS: Record<string, { id: string; name: string; anim: string; note?: string; ride?: boolean; night?: boolean }[]> = {
  panggung: [{ id: 'nonton', name: 'Nonton pertunjukan', anim: 'lihat' }],
  komidi: [{ id: 'naik', name: 'Naik komidi putar', anim: 'duduk' }],
  ayunan: [{ id: 'ayun', name: 'Main ayunan', anim: 'duduk' }],
  beringin: [{ id: 'teduh', name: 'Berteduh di bawah beringin', anim: 'lihat' }, { id: 'foto', name: 'Foto bareng di beringin', anim: 'lihat' }],
  airmancur: [{ id: 'foto', name: 'Foto bareng di air mancur', anim: 'lihat' }],
  bangku: [{ id: 'duduk', name: 'Duduk santai', anim: 'duduk' }],
  gerobak: [{ id: 'jajan', name: 'Jajan', anim: 'lihat' }],
  tikarular: [{ id: 'ular', name: 'Main Ular Tangga (2–4 orang)', anim: 'lihat' }],
  garisstart: [{ id: 'karung', name: 'Balap Karung Live (2–5 orang)', anim: 'lihat' }],
  bianglala: [{ id: 'bianglala', name: 'Naik bianglala', anim: 'duduk', ride: true }],
  halte: [{ id: 'kereta', name: 'Naik Kereta Kelinci', anim: 'duduk', ride: true }],
  ondel: [{ id: 'arak', name: 'Ikut arak-arakan', anim: 'lihat', ride: true }],
  lempargelang: [{ id: 'gelang', name: 'Lempar gelang (3 gelang)', anim: 'lihat' }],
  kolampancing: [{ id: 'mancing', name: 'Mancing bareng', anim: 'duduk' }],
  layartancap: [{ id: 'layar', name: 'Nonton layar tancap', anim: 'lihat', night: true }],
  tikarnonton: [{ id: 'layar', name: 'Nonton layar tancap', anim: 'duduk', night: true }],
};
/** aksi singkat alun-alun yang memberi hadiah harian (koin, XP, ceria) */
export const SQUARE_PLAY = ['nonton', 'naik', 'ayun', 'teduh', 'duduk', 'joget', 'gelang', 'layar'] as const;
/** wahana panjang: naik dulu, hadiah (lebih besar) setelah selesai; sama-sama memakai jatah main harian */
export const SQUARE_RIDES = ['bianglala', 'kereta', 'arak'] as const;
export type SquareRide = (typeof SQUARE_RIDES)[number];

/** Jajanan di gerobak: harga (koin) & efek pada pet. */
export const SQUARE_SNACKS: Record<string, { name: string; coins: number; kenyang: number; ceria: number }> = {
  'alun-dawet': { name: 'Es Dawet', coins: 12, kenyang: 10, ceria: 8 },
  'alun-bakso': { name: 'Bakso', coins: 18, kenyang: 22, ceria: 4 },
  'alun-arummanis': { name: 'Arum Manis', coins: 10, kenyang: 6, ceria: 10 },
};

/* ---------------- panggung ---------------- */

/** Pertunjukan di panggung, bergiliran menurut jam server (semua orang melihat acara yang sama); musik & non-musik selang-seling. */
export const SQUARE_SHOWS = [
  { key: 'orkes', name: 'Orkes Kampung', music: true },
  { key: 'wayang', name: 'Wayang Kardus', music: false },
  { key: 'tari', name: 'Tari Payung', music: true },
  { key: 'sulap', name: 'Sulap Pak Badut', music: false },
  { key: 'angklung', name: 'Angklung Kampung', music: true },
  { key: 'silat', name: 'Pencak Silat', music: false },
  { key: 'kudalumping', name: 'Kuda Lumping', music: true },
  { key: 'lawak', name: 'Lawak Kampung', music: false },
] as const;
const SLOT_MS = 150_000, PLAY_MS = 120_000;
/** Acara panggung pada waktu `now` (ms): sedang tampil atau jeda, kapan selesai, acara berikutnya. */
export function squareShow(now: number) {
  const slot = Math.floor(now / SLOT_MS), t = now - slot * SLOT_MS;
  const cur = SQUARE_SHOWS[slot % SQUARE_SHOWS.length], next = SQUARE_SHOWS[(slot + 1) % SQUARE_SHOWS.length];
  const playing = t < PLAY_MS;
  return {
    key: cur.key, name: cur.name, music: cur.music && playing, playing,
    /** akhir pertunjukan (bila tampil) atau awal pertunjukan berikutnya (bila jeda) */
    until: playing ? slot * SLOT_MS + PLAY_MS : (slot + 1) * SLOT_MS,
    next: playing ? { key: cur.key, name: cur.name } : { key: next.key, name: next.name },
  };
}

/* ---------------- jadwal berulang (arak-arakan, lomba mancing) ---------------- */

/** Acara berulang tiap `every` ms mulai `offset`, lama `dur`: sedang berlangsung?, mulai & selesai yang sekarang/berikutnya. */
export function cycleAt(now: number, every: number, offset: number, dur: number) {
  const start = Math.floor((now - offset) / every) * every + offset;
  const on = now - start < dur;
  return { on, start: on ? start : start + every, end: (on ? start : start + every) + dur, t: on ? now - start : 0 };
}

/** Arak-arakan ondel-ondel: tiap 10 menit mulai menit :05 (:05, :15, :25, ...), ±2,5 menit; pet boleh ikut (maks. 8). */
export const PARADE = { everyMs: 600_000, offsetMs: 300_000, durMs: 150_000, max: 8, joinBeforeMs: 120_000, joinAfterMs: 45_000 };
/**
 * Rute arak-arakan (petak): gerbang depan → jalan utama → Jalan Wahana → putar balik → jalan melintang barat →
 * kembali ke jalan utama → gerbang. Jalur pergi & pulang selisih 0,8 petak supaya rombongan tidak bertabrakan.
 */
export const PARADE_ROUTE: [number, number][] = [[10.4, 21.3], [10.4, 13.6], [26.4, 13.6], [26.4, 14.4], [2.6, 14.4], [2.6, 13.6], [9.6, 13.6], [9.6, 21.3]];
const segLen = (a: [number, number], b: [number, number]) => Math.hypot(b[0] - a[0], b[1] - a[1]);
export const PARADE_LEN = PARADE_ROUTE.slice(1).reduce((s, p, i) => s + segLen(PARADE_ROUTE[i], p), 0);
/** jarak (petak) ondel kedua & tiap pengikut di belakang pemimpin */
export const PARADE_GAP = { ondel: 1.4, first: 2.7, each: 1.15 };
const PARADE_TAIL = PARADE_GAP.first + (PARADE.max - 1) * PARADE_GAP.each;
/** titik pada rute di jarak u (petak), dengan arah jalan */
export function paradePoint(u: number) {
  let t = Math.max(0, Math.min(PARADE_LEN, u));
  for (let i = 1; i < PARADE_ROUTE.length; i++) {
    const a = PARADE_ROUTE[i - 1], b = PARADE_ROUTE[i], L = segLen(a, b);
    if (t <= L || i === PARADE_ROUTE.length - 1) { const k = L ? Math.min(1, t / L) : 0; return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, dx: (b[0] - a[0]) / (L || 1), dy: (b[1] - a[1]) / (L || 1) }; }
    t -= L;
  }
  const e = PARADE_ROUTE[PARADE_ROUTE.length - 1];
  return { x: e[0], y: e[1], dx: 0, dy: 1 };
}
/** Keadaan arak-arakan pada `now`: lead = jarak pemimpin di rute; slot(k) = jarak pengikut ke-k (negatif = belum mulai jalan). */
export function paradeAt(now: number) {
  const c = cycleAt(now, PARADE.everyMs, PARADE.offsetMs, PARADE.durMs);
  // pemimpin sampai di gerbang lebih dulu; pengikut terakhir sampai tepat saat arak-arakan selesai
  const speed = (PARADE_LEN + PARADE_TAIL) / PARADE.durMs;
  const lead = c.on ? Math.min(PARADE_LEN, c.t * speed) : 0;
  return {
    on: c.on, start: c.start, end: c.end, lead,
    /** ondel kedua */
    second: c.on ? Math.min(PARADE_LEN, c.t * speed - PARADE_GAP.ondel) : 0,
    slot: (k: number) => (c.on ? Math.min(PARADE_LEN, c.t * speed - PARADE_GAP.first - k * PARADE_GAP.each) : -1),
    /** boleh ikut: dari 2 menit sebelum mulai sampai 45 detik setelah mulai */
    joinable: c.on ? c.t <= PARADE.joinAfterMs : c.start - now <= PARADE.joinBeforeMs,
  };
}

/** Lomba Mancing di Kolam Pemancingan Bareng: tiap 20 menit (:00, :20, :40), 3 menit; pendaftaran dibuka 1 menit sebelumnya. */
export const LOMBA = { everyMs: 20 * 60_000, offsetMs: 0, durMs: 180_000, registerMs: 60_000, resultMs: 10_000 };
/** alur mancing bareng sudah tersambung: papan & bar mengumumkan lomba */
export const LOMBA_SIAP = true;
/** skor lomba: berat ikan (gram) dari panjangnya — gram = 0,013 × cm³ */
export const lombaGrams = (cm: number) => Math.round(0.013 * Math.max(0, cm) ** 3);
/** tulisan berat: 351 g / 1,28 kg */
export const fmtGrams = (g: number) => (g >= 1000 ? `${(g / 1000).toFixed(2).replace('.', ',')} kg` : `${Math.round(g)} g`);
/** Keadaan lomba mancing: phase = daftar (1 mnt sebelum) | lomba | hasil (10 dtk sesudah) | tunggu. */
export function lombaAt(now: number, o: { everyMs?: number; durMs?: number } = {}) {
  const every = o.everyMs ?? LOMBA.everyMs, dur = o.durMs ?? LOMBA.durMs;
  const c = cycleAt(now, every, LOMBA.offsetMs, dur);
  const prevEnd = c.on ? c.end - every : c.start - every + dur;
  const phase = c.on ? 'lomba' : now - prevEnd < LOMBA.resultMs && now >= prevEnd ? 'hasil' : c.start - now <= LOMBA.registerMs ? 'daftar' : 'tunggu';
  return { phase: phase as 'daftar' | 'lomba' | 'hasil' | 'tunggu', start: c.start, end: c.end, inMs: c.on ? 0 : c.start - now, leftMs: c.on ? c.end - now : 0 };
}

/* ---------------- Kolam Pemancingan Bareng (6×5 di 20,6) ---------------- */

/** letak kolam di ALUN_LAYOUT (air menghalangi; pemancing duduk di dermaga) */
export const POND = { x: 20, y: 6, w: 6, d: 5 };
/** dermaga (relatif pojok kolam): 3 di tepi belakang (sepanjang x), 3 di tepi kiri (sepanjang y) — pemancing tidak menutupi air */
export const POND_PIERS = { back: [1.5, 3.1, 4.7], left: [1.3, 2.85, 4.4] };
/**
 * Tempat duduk 6 pemancing (petak alun-alun) & petak tempat berdiri sebelum naik dermaga (from, di luar kolam).
 * Disiapkan untuk alur mancing bareng: pet berjalan ke `from`, lalu didudukkan di (x, y) seperti naik komidi putar.
 */
export function pondSeats() {
  return [
    ...POND_PIERS.back.map((u, i) => ({ n: i + 1, x: POND.x + u, y: POND.y + 0.48, from: [Math.floor(POND.x + u), POND.y - 1] as [number, number], side: 'back' as const })),
    ...POND_PIERS.left.map((u, i) => ({ n: i + 4, x: POND.x + 0.48, y: POND.y + u, from: [POND.x - 1, Math.floor(POND.y + u)] as [number, number], side: 'left' as const })),
  ];
}

/* ---------------- Kereta Kelinci: rel keliling di luar pagar ---------------- */

/** rel: pita kerikil 1,7 petak di luar lapangan, garis tengah rel 0,85 petak dari tepi */
export const RING = { band: 1.7, mid: 0.85 };
/** titik di garis tengah rel (u = jarak sepanjang rel; searah jarum jam di petak: belakang +x, kanan +y, depan −x, kiri −y) */
export function ringPoint(u: number, W = ALUN_W, D = ALUN_D) {
  const m = RING.mid, R = 0.5 + m, q = (Math.PI * R) / 2;
  const segs: ({ k: 'L'; x: number; y: number; dx: number; dy: number; len: number } | { k: 'A'; cx: number; cy: number; a0: number; len: number })[] = [
    { k: 'L', x: 0.5, y: -m, dx: 1, dy: 0, len: W - 1 }, { k: 'A', cx: W - 0.5, cy: 0.5, a0: -90, len: q },
    { k: 'L', x: W + m, y: 0.5, dx: 0, dy: 1, len: D - 1 }, { k: 'A', cx: W - 0.5, cy: D - 0.5, a0: 0, len: q },
    { k: 'L', x: W - 0.5, y: D + m, dx: -1, dy: 0, len: W - 1 }, { k: 'A', cx: 0.5, cy: D - 0.5, a0: 90, len: q },
    { k: 'L', x: -m, y: D - 0.5, dx: 0, dy: -1, len: D - 1 }, { k: 'A', cx: 0.5, cy: 0.5, a0: 180, len: q },
  ];
  const total = segs.reduce((a, s) => a + s.len, 0);
  let t = ((u % total) + total) % total;
  for (const s of segs) {
    if (t <= s.len) {
      if (s.k === 'L') return { x: s.x + s.dx * t, y: s.y + s.dy * t, dx: s.dx, dy: s.dy };
      const a = ((s.a0 + (t / s.len) * 90) * Math.PI) / 180;
      return { x: s.cx + R * Math.cos(a), y: s.cy + R * Math.sin(a), dx: -Math.sin(a), dy: Math.cos(a) };
    }
    t -= s.len;
  }
  return { x: 0.5, y: -m, dx: 1, dy: 0 };
}
export const ringLen = (W = ALUN_W, D = ALUN_D) => 2 * (W - 1) + 2 * (D - 1) + Math.PI * (0.5 + RING.mid) * 2;
/** Halte (1×3) di tepi timur y 18–20: kereta berhenti dengan hidung lokomotif di y ≈ 20,35 */
export const KERETA = { lapMs: 120_000, stopMs: 15_000, seats: 6, halteU: ALUN_W - 1 + (Math.PI * (0.5 + RING.mid)) / 2 + (20.35 - 0.5) };
/** gerbong: lokomotif lalu 3 gerbong penumpang (panjang petak), jarak antargerbong */
export const KERETA_CARS = [{ k: 'engine', L: 1.7 }, { k: 'car', L: 1.45, c: '#E0583F' }, { k: 'car', L: 1.45, c: '#3F7FBF' }, { k: 'car', L: 1.45, c: '#F2B632' }] as const;
export const KERETA_GAP = 0.18;
/** Kereta pada `now`: posisi kepala di rel, berhenti di halte (15 dtk) atau berjalan satu putaran (±105 dtk). */
export function keretaAt(now: number) {
  const lap = Math.floor(now / KERETA.lapMs) * KERETA.lapMs, t = now - lap;
  const stopped = t < KERETA.stopMs;
  const u = stopped ? KERETA.halteU : KERETA.halteU + ((t - KERETA.stopMs) / (KERETA.lapMs - KERETA.stopMs)) * ringLen();
  return {
    u, stopped, lap,
    /** berangkat dari halte (bila berhenti) / tiba lagi di halte (= akhir putaran) */
    departAt: lap + KERETA.stopMs, arriveAt: lap + KERETA.lapMs,
  };
}
/** pusat tiap gerbong (petak) bila kepala lokomotif di u; i = 0 lokomotif, 1–3 gerbong */
export function keretaCars(u: number) {
  let at = u;
  return KERETA_CARS.map((car, i) => {
    const uc = at - car.L / 2;
    at -= car.L + KERETA_GAP;
    const p = ringPoint(uc);
    return { i, L: car.L, x: p.x, y: p.y, dx: p.dx, dy: p.dy, alongY: Math.abs(p.dy) >= Math.abs(p.dx) };
  });
}
/** tempat duduk penumpang (0–5: gerbong 1–3, dua kursi per gerbong) */
export function keretaSeat(u: number, seat: number) {
  const c = keretaCars(u)[1 + Math.floor(Math.max(0, Math.min(5, seat)) / 2)];
  const f = (seat % 2 ? -0.22 : 0.22) * c.L;
  return { x: c.x + f * c.dx, y: c.y + f * c.dy, car: c };
}

/* ---------------- Bianglala: 6 gondola, satu putaran 60 detik ---------------- */

export const BIANGLALA = { x: 24, y: 1, periodMs: 60_000, gondolas: 6, seats: 2 };
/** sudut gondola k (derajat di layar: 0 = kanan, 90 = bawah) pada `now` */
export const gondolaAngle = (now: number, k: number) => ((((now % BIANGLALA.periodMs) + BIANGLALA.periodMs) % BIANGLALA.periodMs) / BIANGLALA.periodMs) * 360 + k * 60;
/** saat gondola k berikutnya tiba di bawah (tempat naik), tidak sebelum `now` */
export function gondolaBottomAt(now: number, k: number) {
  const P = BIANGLALA.periodMs;
  const phase = ((((90 - k * 60) % 360) + 360) % 360) / 360 * P;
  let t = Math.floor(now / P) * P + phase;
  while (t < now) t += P;
  return t;
}
/** gondola yang tiba di bawah berikutnya (urut waktu) dalam satu putaran */
export function gondolaQueue(now: number) {
  return Array.from({ length: BIANGLALA.gondolas }, (_, k) => ({ k, at: gondolaBottomAt(now, k) })).sort((a, b) => a.at - b.at);
}

/* ---------------- malam: layar tancap & kembang api (jam setempat pemain) ---------------- */

/** zona waktu Indonesia yang diterima (menit dari UTC); selain itu dianggap WIB */
export const ID_ZONES = [420, 480, 540];
export const tzOf = (min: unknown) => (ID_ZONES.includes(Number(min)) ? Number(min) : 420);
/** jam & menit setempat untuk zona `tzMin` (menit dari UTC) */
export function localHM(now: number, tzMin: number) {
  const d = new Date(now + tzMin * 60_000);
  return { h: d.getUTCHours(), m: d.getUTCMinutes(), s: d.getUTCSeconds() };
}
/** Acara malam menurut jam setempat: Layar Tancap 19.00–22.00, Kembang Api 20.00 & 21.00 (2 menit). */
export function squareNight(h: number, m: number) {
  return { layar: h >= 19 && h < 22, kembangApi: (h === 20 || h === 21) && m < 2, malam: h >= 18 || h < 5 };
}
/** film layar tancap yang sedang diputar (bergiliran tiap ±4 menit menurut jam server) */
export const FILMS = ['Bupi & Balon Bulan', 'Layangan Putus', 'Ikan Ajaib'] as const;
export const filmAt = (now: number) => Math.floor(now / 240_000) % FILMS.length;
