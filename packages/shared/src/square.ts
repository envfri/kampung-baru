// Alun-alun kampung: lapangan luas tempat semua pemain berkumpul (bukan hanya teman).
// Tata letak, properti, aksi, dan jadwal panggung dibuat tetap di sini supaya server & semua HP melihat hal yang sama.
import type { ItemLike, Placed } from './art';

/** sisi lapangan (petak) */
export const ALUN_SIZE = 20;
/** id "ruangan" alun-alun pada denah & sinkron live */
export const ALUN_ROOM = 'alun';

type PropDef = { key: string; name: string; w: number; d: number; flat?: boolean; colors?: Record<string, string>; params?: Record<string, number> };
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
};
// jalan batu: satu item per ukuran (1×1 sampai 4×4) karena ukuran mebel ikut item
for (let w = 1; w <= 4; w++) for (let d = 1; d <= 4; d++) PROPS[`alun-jalan-${w}x${d}`] = { key: 'paving', name: 'Jalan Batu', w, d, flat: true };

/** Benda di alun-alun dalam bentuk item mebel (digambar dengan art builtin). */
export const ALUN_ITEMS: Record<string, ItemLike> = Object.fromEntries(
  Object.entries(PROPS).map(([id, p]) => [id, { id, kind: 'furniture', name: p.name, art: { type: 'builtin', key: p.key, colors: p.colors, params: p.params }, data: { w: p.w, d: p.d, flat: !!p.flat, tap: p.key === 'tikarular' } } as ItemLike]),
);

const path = (x: number, y: number, w: number, d: number): Placed[] => {
  // jalan batu dipotong-potong per 4 petak (ukuran mebel maksimal 4×4)
  const out: Placed[] = [];
  for (let a = 0; a < w; a += 4) for (let b = 0; b < d; b += 4) out.push({ i: `alun-jalan-${Math.min(4, w - a)}x${Math.min(4, d - b)}`, x: x + a, y: y + b });
  return out;
};

/** Susunan alun-alun: panggung di belakang, beringin kembar & air mancur di tengah, wahana di kiri, jajanan di kanan. */
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
];

/** Aksi yang bisa dilakukan di tiap benda (diketuk). anim: pose pet (lihat ACTIVITY_ANIMS) */
export const SQUARE_ACTS: Record<string, { id: string; name: string; anim: string; note?: string }[]> = {
  panggung: [{ id: 'nonton', name: 'Nonton pertunjukan', anim: 'lihat' }],
  komidi: [{ id: 'naik', name: 'Naik komidi putar', anim: 'duduk' }],
  ayunan: [{ id: 'ayun', name: 'Main ayunan', anim: 'duduk' }],
  beringin: [{ id: 'teduh', name: 'Berteduh di bawah beringin', anim: 'lihat' }, { id: 'foto', name: 'Foto bareng di beringin', anim: 'lihat' }],
  airmancur: [{ id: 'foto', name: 'Foto bareng di air mancur', anim: 'lihat' }],
  bangku: [{ id: 'duduk', name: 'Duduk santai', anim: 'duduk' }],
  gerobak: [{ id: 'jajan', name: 'Jajan', anim: 'lihat' }],
  tikarular: [{ id: 'ular', name: 'Main Ular Tangga (2–4 orang)', anim: 'lihat' }],
  garisstart: [{ id: 'karung', name: 'Balap Karung Live (2–5 orang)', anim: 'lihat' }],
};
/** aksi alun-alun yang memberi hadiah harian (koin, XP, ceria) */
export const SQUARE_PLAY = ['nonton', 'naik', 'ayun', 'teduh', 'duduk', 'joget'] as const;

/** Jajanan di gerobak: harga (koin) & efek pada pet. */
export const SQUARE_SNACKS: Record<string, { name: string; coins: number; kenyang: number; ceria: number }> = {
  'alun-dawet': { name: 'Es Dawet', coins: 12, kenyang: 10, ceria: 8 },
  'alun-bakso': { name: 'Bakso', coins: 18, kenyang: 22, ceria: 4 },
  'alun-arummanis': { name: 'Arum Manis', coins: 10, kenyang: 6, ceria: 10 },
};

/** Pertunjukan di panggung, bergiliran menurut jam server (semua orang melihat acara yang sama). */
export const SQUARE_SHOWS = [
  { key: 'orkes', name: 'Orkes Kampung', music: true },
  { key: 'wayang', name: 'Wayang Kardus', music: false },
  { key: 'tari', name: 'Tari Payung', music: true },
  { key: 'sulap', name: 'Sulap Pak Badut', music: false },
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
