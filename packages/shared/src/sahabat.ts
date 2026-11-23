// Sahabat Mungil: hewan kecil yang menemani pet ke mana pun (rumah, rumah teman, peta, alun-alun, foto Jepret).
// Aturan bersama server (sumber kebenaran) & game (tampilan). Semua angka ada di pengaturan admin `sahabat`
// (lihat settings.ts); harga sahabat & Camilan Sahabat diatur sebagai item (Item & harga, jenis Sahabat).
import { rondaOpen } from './kerja';

export const SAHABAT_SPECIES = ['ayam', 'umang', 'bebek', 'kura', 'pipit', 'kunang', 'kelinci', 'hamster', 'landak'] as const;
export type SahabatSp = (typeof SAHABAT_SPECIES)[number];
export const isSahabatSp = (v: unknown): v is SahabatSp => typeof v === 'string' && (SAHABAT_SPECIES as readonly string[]).includes(v);

/** cara mendapat: gratis (anak ayam pertama), dibeli (koin / Mutiara), atau syarat khusus */
export type SahabatHow = 'gratis' | 'koin' | 'mutiara' | 'mancing' | 'pipit' | 'kunang';

export interface SahabatInfo {
  /** nama jenis ("Anak Ayam") */
  name: string;
  /** id item katalog (jenis 'sahabat'): harga, nama & keterangan bisa diatur admin */
  item: string;
  how: SahabatHow;
  /** sifat singkat (kartu & Album) */
  sifat: string;
  /** nama trik saat diketuk */
  trick: string;
  /** bunyi / celetukan saat diketuk */
  say: string;
  /** nama awal yang disarankan */
  nama: string[];
  /** "rumah" sahabat yang sedang istirahat: id mebel tempat ia nongkrong bila dipasang pemain */
  homes: string[];
  /** jarak ikut di belakang pet (petak) & kecepatan (petak/detik) */
  lag: number;
  speed: number;
  /** terbang (pipit, kunang-kunang): melayang di atas lantai */
  fly?: number;
}

export const SAHABAT_INFO: Record<SahabatSp, SahabatInfo> = {
  ayam: { name: 'Anak Ayam', item: 'sahabat-ayam', how: 'gratis', sifat: 'Suka mematuk-matuk lantai. Ciap!', trick: 'Patuk-patuk', say: 'Ciap! Ciap!', nama: ['Ciko', 'Piyik', 'Kuning', 'Ciap'], homes: ['kurungan-ayam'], lag: 0.95, speed: 2.4 },
  umang: { name: 'Umang-umang', item: 'sahabat-umang', how: 'koin', sifat: 'Rumah kerangnya bisa kamu ganti warna.', trick: 'Ngumpet di kerang', say: 'Krik-krik!', nama: ['Umi', 'Kerang', 'Capit', 'Mumu'], homes: ['bak-pasir', 'kolam-ikan'], lag: 1, speed: 2.2 },
  bebek: { name: 'Anak Bebek', item: 'sahabat-bebek', how: 'koin', sifat: 'Berjalan megal-megol di belakang pet-mu.', trick: 'Kepak sayap', say: 'Kwek kwek!', nama: ['Kwek', 'Dudu', 'Bebi', 'Megol'], homes: ['kolam-ikan', 'kurungan-ayam'], lag: 0.85, speed: 2.4 },
  kura: { name: 'Kura-kura', item: 'sahabat-kura', how: 'mancing', sifat: 'Pelan tapi setia, suka tertinggal di belakang.', trick: 'Julurkan leher', say: 'Pelan-pelan saja…', nama: ['Tuktuk', 'Lumut', 'Batok', 'Santai'], homes: ['kolam-ikan'], lag: 1.4, speed: 0.95 },
  pipit: { name: 'Burung Pipit', item: 'sahabat-pipit', how: 'pipit', sifat: 'Terbang lalu hinggap di kepala pet-mu.', trick: 'Terbang berputar', say: 'Cuit cuit!', nama: ['Cuit', 'Pipi', 'Siul', 'Tiwi'], homes: ['sangkar-burung', 'tempat-minum-burung'], lag: 0.7, speed: 3.2, fly: 30 },
  kunang: { name: 'Kunang-kunang', item: 'sahabat-kunang', how: 'kunang', sifat: 'Bercahaya lembut di sekitar pet-mu saat malam.', trick: 'Kedip terang', say: 'Wuuung…', nama: ['Nyala', 'Bintik', 'Sinar', 'Lilin'], homes: ['lampu-taman', 'pot-kembang-sepatu'], lag: 0.75, speed: 2.8, fly: 46 },
  kelinci: { name: 'Kelinci Mini', item: 'sahabat-kelinci', how: 'mutiara', sifat: 'Melompat-lompat riang di sekitar pet-mu.', trick: 'Lompat salto', say: 'Hop hop!', nama: ['Kapas', 'Lompi', 'Salju', 'Wortel'], homes: [], lag: 1, speed: 2.6 },
  hamster: { name: 'Hamster Pipi Tembam', item: 'sahabat-hamster', how: 'mutiara', sifat: 'Pipinya menggembung kalau diberi makan.', trick: 'Pipi gembung', say: 'Cit cit!', nama: ['Bakpao', 'Tembam', 'Kacang', 'Biji'], homes: [], lag: 0.85, speed: 2.4 },
  landak: { name: 'Landak Mini', item: 'sahabat-landak', how: 'mutiara', sifat: 'Menggulung jadi bola kalau diketuk.', trick: 'Menggulung', say: 'Hmph!', nama: ['Duri', 'Bulat', 'Kiko', 'Sisir'], homes: [], lag: 0.95, speed: 2.2 },
};

export const SAHABAT_BY_ITEM: Record<string, SahabatSp> = Object.fromEntries(SAHABAT_SPECIES.map((sp) => [SAHABAT_INFO[sp].item, sp]));
/** sahabat yang dibeli lewat toko (Pondok Sahabat / Toko Mutiara) */
export const SAHABAT_BELI = SAHABAT_SPECIES.filter((sp) => SAHABAT_INFO[sp].how === 'koin' || SAHABAT_INFO[sp].how === 'mutiara');

/** id item Camilan Sahabat & lokasi Pondok Sahabat di peta */
export const SAHABAT_CAMILAN = 'camilan-sahabat';
export const SAHABAT_LOC = 'pondok';
/** mebel di Halaman yang didatangi burung pipit */
export const PIPIT_SPOTS = ['tempat-minum-burung', 'sangkar-burung'];

/** warna rumah kerang umang-umang (dipilih pemain) */
export const UMANG_COLORS: Record<string, { label: string; main: string }> = {
  merah: { label: 'Merah bata', main: '#E0583F' },
  kuning: { label: 'Kuning', main: '#F2B632' },
  biru: { label: 'Biru laut', main: '#5B9BD5' },
  hijau: { label: 'Hijau lumut', main: '#5DB36A' },
  ungu: { label: 'Ungu', main: '#9A6FC0' },
  pink: { label: 'Merah muda', main: '#F49AB6' },
};
export const UMANG_DEFAULT = 'merah';
export const isUmangColor = (v: unknown): v is string => typeof v === 'string' && Object.hasOwn(UMANG_COLORS, v);

/** Tingkat keakraban: 0 Kenal, 1 Akrab, 2 Sahabat Sejati */
export const SAHABAT_LEVELS = ['Kenal', 'Akrab', 'Sahabat Sejati'] as const;
export const SAHABAT_LEVEL_SUB = [
  'Mengikuti pet-mu ke mana pun.',
  'Punya trik, dan duduk di kepala pet-mu saat pet duduk atau tidur.',
  'Kalung emas bernama & tampil di kartu profil pet-mu.',
];

/** Bentuk pengaturan admin `sahabat` (nilai bawaan di settings.ts). */
export interface SahabatSettings {
  on: boolean;
  points: { makan: number; main: number; jalan: number };
  mainPerDay: number;
  akrabAt: number;
  sejatiAt: number;
  kuraPct: number;
  kunang: { fromHour: number; toHour: number };
  maxResting: number;
  giftCoins: number[];
  gifts: Record<string, string[]>;
}

export function sahabatLevel(points: number, s: Pick<SahabatSettings, 'akrabAt' | 'sejatiAt'>) {
  const p = Math.max(0, Math.round(points) || 0);
  return p >= s.sejatiAt ? 2 : p >= s.akrabAt ? 1 : 0;
}
/** tingkat sekarang + kemajuan menuju tingkat berikutnya (0–1) */
export function sahabatProgress(points: number, s: Pick<SahabatSettings, 'akrabAt' | 'sejatiAt'>) {
  const lvl = sahabatLevel(points, s);
  const from = [0, s.akrabAt, s.sejatiAt][lvl];
  const to = lvl < 2 ? [s.akrabAt, s.sejatiAt][lvl] : s.sejatiAt;
  return { lvl, label: SAHABAT_LEVELS[lvl], next: lvl < 2 ? SAHABAT_LEVELS[lvl + 1] : null, need: lvl < 2 ? Math.max(0, to - points) : 0, pct: lvl < 2 ? Math.max(0, Math.min(1, (points - from) / Math.max(1, to - from))) : 1 };
}

/** Kunang-kunang muncul di jendela jam setempat [fromHour, toHour) — boleh melewati tengah malam (19 → 4). */
export const kunangOpen = (hm: { h: number; m: number }, k: { fromHour: number; toHour: number }) => rondaOpen(hm, k.fromHour, k.toHour);

/** oleh-oleh harian bawaan per jenis: id item (yang sama boleh diulang = lebih sering), 'koin' = koin acak giftCoins */
export const SAHABAT_GIFTS: Record<SahabatSp, string[]> = {
  ayam: ['koin', 'bibit-jagung', 'bibit-padi', 'jagung'],
  umang: ['koin', 'kerang-hias', 'kerang-hias', 'bibit-nanas'],
  bebek: ['koin', 'kangkung', 'bibit-kangkung', 'kerang-hias'],
  kura: ['koin', 'kerang-hias', 'bibit-semangka', 'tomat'],
  pipit: ['koin', 'bibit-melati', 'bibit-matahari', 'melati'],
  kunang: ['koin', 'koin', 'bibit-melati', 'melati'],
  kelinci: ['koin', 'wortel', 'bibit-wortel', 'bibit-stroberi'],
  hamster: ['koin', 'jagung', 'bibit-jagung', 'padi-ketan'],
  landak: ['koin', 'stroberi', 'tomat', 'bibit-labu'],
};

/** Nama sahabat: 2–14 huruf (dicek kata terlarang di server seperti nama pet). */
export const SAHABAT_NAME_MAX = 14;

/** Cek pengaturan `sahabat` dari admin; `fail` dipanggil dengan pesan yang bisa dibaca admin. */
export function checkSahabat(k: any, fail: (msg: string) => void, itemExists?: (id: string) => boolean) {
  const no = (msg: string) => fail(`Sahabat Mungil: ${msg}`);
  const int = (v: unknown, lo: number, hi: number) => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;
  if (!k || typeof k !== 'object') return no('pengaturan tidak valid.');
  const p = k.points ?? {};
  for (const key of ['makan', 'main', 'jalan']) if (!int(p[key], 0, 1000)) no(`points › ${key} harus bilangan bulat 0–1000.`);
  if (!int(k.mainPerDay, 0, 20)) no('mainPerDay harus 0–20.');
  if (!int(k.akrabAt, 1, 100000) || !int(k.sejatiAt, 1, 100000) || !(k.akrabAt < k.sejatiAt)) no('akrabAt & sejatiAt harus naik (akrabAt < sejatiAt, 1–100000).');
  if (!(typeof k.kuraPct === 'number' && k.kuraPct >= 0 && k.kuraPct <= 100)) no('kuraPct harus 0–100 (%).');
  const kn = k.kunang ?? {};
  if (!int(kn.fromHour, 0, 23) || !int(kn.toHour, 0, 24) || kn.fromHour === kn.toHour) no('kunang: fromHour 0–23 & toHour 0–24, tidak boleh sama.');
  if (!int(k.maxResting, 0, 8)) no('maxResting harus 0–8.');
  const gc = k.giftCoins;
  if (!Array.isArray(gc) || gc.length !== 2 || !gc.every((x: unknown) => int(x, 0, 10000)) || gc[0] > gc[1]) no('giftCoins harus 2 angka 0–10000 (min, maks).');
  for (const sp of SAHABAT_SPECIES) {
    const g = k.gifts?.[sp];
    if (!Array.isArray(g) || g.length < 1 || g.length > 20) { no(`gifts › ${sp}: 1–20 baris (id item atau "koin").`); continue; }
    if (itemExists) { const miss = g.filter((id: string) => id !== 'koin' && !itemExists(id)); if (miss.length) no(`gifts › ${sp}: item tidak dikenal (${miss.join(', ')}).`); }
  }
}
