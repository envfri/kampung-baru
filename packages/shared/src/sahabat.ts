// Sahabat Mungil: hewan kecil yang menemani pet ke mana pun (rumah, rumah teman, peta, alun-alun, foto Jepret).
// Aturan bersama server (sumber kebenaran) & game (tampilan). Semua angka ada di pengaturan admin `sahabat`
// (lihat settings.ts); harga sahabat & Camilan Sahabat diatur sebagai item (Item & harga, jenis Sahabat).
import { rondaOpen } from './kerja';

export const SAHABAT_SPECIES = ['ayam', 'umang', 'bebek', 'kura', 'pipit', 'kunang', 'kelinci', 'hamster', 'landak', 'beruang', 'rusa'] as const;
export type SahabatSp = (typeof SAHABAT_SPECIES)[number];
export const isSahabatSp = (v: unknown): v is SahabatSp => typeof v === 'string' && (SAHABAT_SPECIES as readonly string[]).includes(v);

/** cara mendapat: gratis (anak ayam pertama), dibeli (koin / Mutiara), syarat khusus, atau edisi terbatas (Mutiara, masa jual) */
export type SahabatHow = 'gratis' | 'koin' | 'mutiara' | 'mancing' | 'pipit' | 'kunang' | 'edisi';
/** pose Akrab sahabat besar saat pemiliknya tidur / duduk: bantal (berbaring di samping pet) atau berdiri di sampingnya */
export type SahabatRest = 'head' | 'pillow' | 'side';

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
  /** sahabat edisi terbatas (Toko Mutiara, masa jual = jadwal jual item): 'natal' = Edisi Natal (paket konten 24) */
  edisi?: 'natal';
  /** sahabat besar (± kali ukuran sahabat biasa): tidak pernah duduk di kepala pet, punya pose Akrab sendiri */
  big?: number;
  /** pose Akrab sahabat besar per pose pemilik (tidur / duduk); tanpa ini sahabat Akrab duduk di kepala pet */
  akrab?: Partial<Record<'tidur' | 'duduk', 'pillow' | 'side'>>;
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
  // Edisi Natal (paket konten 24): lebih besar (±1,6×), dijual terbatas di Toko Mutiara; pemiliknya menyimpannya selamanya
  beruang: { name: 'Beruang Es', item: 'sahabat-beruang', how: 'edisi', edisi: 'natal', sifat: 'Butiran salju menari di sekitarnya. Suka meluncur di perut!', trick: 'Meluncur di perut', say: 'Brrr… hangat!', nama: ['Salju', 'Embun', 'Kristal', 'Gembul'], homes: ['kolam-ikan'], lag: 1.3, speed: 2.2, big: 1.6, akrab: { tidur: 'pillow' } },
  rusa: { name: 'Rusa Kutup', item: 'sahabat-rusa', how: 'edisi', edisi: 'natal', sifat: 'Tanduknya berhias lampu kerlap-kerlip, loncengnya berdenting.', trick: 'Lompat bintang', say: 'Kring-kring!', nama: ['Kerlip', 'Lonceng', 'Cemara', 'Bintang'], homes: [], lag: 1.35, speed: 2.8, big: 1.6, akrab: { tidur: 'side', duduk: 'side' } },
};

export const SAHABAT_BY_ITEM: Record<string, SahabatSp> = Object.fromEntries(SAHABAT_SPECIES.map((sp) => [SAHABAT_INFO[sp].item, sp]));
/** sahabat yang dibeli lewat toko (Pondok Sahabat / Toko Mutiara, termasuk edisi terbatas) */
export const SAHABAT_BELI = SAHABAT_SPECIES.filter((sp) => ['koin', 'mutiara', 'edisi'].includes(SAHABAT_INFO[sp].how));
/** sahabat biasa (Album utama, paket konten 23) & sahabat Edisi Natal (bagian Album sendiri, paket konten 24) */
export const SAHABAT_BIASA = SAHABAT_SPECIES.filter((sp) => !SAHABAT_INFO[sp].edisi);
export const SAHABAT_NATAL = SAHABAT_SPECIES.filter((sp) => SAHABAT_INFO[sp].edisi === 'natal');
/** ukuran relatif sahabat (1 = sahabat biasa) */
export const buddyScale = (sp: SahabatSp) => SAHABAT_INFO[sp].big ?? 1;

/** Edisi Natal: label, teks toko & Album (masa jual tiap sahabat = jadwal jual item-nya, diatur admin di Item & harga) */
export const EDISI_NATAL = {
  name: 'Edisi Natal',
  badge: '✦ Edisi Natal',
  desc: 'Sahabat musim dingin yang lebih besar, dengan salju & lampu kerlap-kerlip. Dijual terbatas; yang sudah diadopsi tetap menemanimu selamanya.',
  /** batas jual bawaan (paket konten 24): 6 Januari 2027 pukul 23.59 WIB */
  until: '2027-01-06T23:59:59+07:00',
};
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
/** tanggal (WIB) untuk teks pemain: "6 Januari", atau "6 Januari 2027" dengan tahun */
export function tanggalWIB(t: string | number | Date, year = false) {
  const d = new Date(new Date(t).getTime() + 7 * 3_600_000);
  return `${d.getUTCDate()} ${BULAN[d.getUTCMonth()]}${year ? ` ${d.getUTCFullYear()}` : ''}`;
}

/**
 * Pose sahabat saat pemiliknya diam / duduk / tidur: 'head' = duduk di kepala pet (Akrab saat pet duduk/tidur, burung
 * pipit saat pet diam), 'pillow' = berbaring di samping pet yang tidur (Beruang Es), 'side' = berdiri di samping pet
 * (Rusa Kutup). Sahabat besar tidak pernah duduk di kepala pet. null = tetap di lantai mengikuti pet.
 */
export function buddyRestPose(sp: SahabatSp, lvl: number, ownerPose: string | null | undefined, ownerMoving = false): SahabatRest | null {
  const I = SAHABAT_INFO[sp];
  const pose = ownerPose === 'tidur' || ownerPose === 'duduk' ? ownerPose : null;
  if (I.big) return pose && lvl >= 1 ? I.akrab?.[pose] ?? null : null;
  if (pose && lvl >= 1) return 'head';
  if (sp === 'pipit' && !ownerMoving && !ownerPose) return 'head';
  return null;
}

/**
 * Album Sahabat: sahabat biasa selalu tampil (yang belum dimiliki sebagai siluet); bagian Edisi Natal hanya menampilkan
 * yang dimiliki, plus siluet yang masih dijual (sesudah masa jual, yang belum dimiliki disembunyikan).
 */
export function albumSections(owned: (sp: SahabatSp) => boolean, onSale: (sp: SahabatSp) => boolean) {
  return {
    biasa: SAHABAT_BIASA.map((sp) => ({ sp, own: owned(sp) })),
    natal: SAHABAT_NATAL.filter((sp) => owned(sp) || onSale(sp)).map((sp) => ({ sp, own: owned(sp) })),
  };
}

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
/** keterangan tingkat per jenis (sahabat besar Edisi Natal punya pose Akrab sendiri, tidak duduk di kepala pet) */
export function levelSub(sp: SahabatSp, lvl: number) {
  const l = Math.max(0, Math.min(2, lvl | 0));
  if (l === 1 && sp === 'beruang') return 'Punya trik, dan berbaring jadi bantal empuk saat pet-mu tidur.';
  if (l === 1 && sp === 'rusa') return 'Punya trik, dan berdiri di samping pet-mu saat duduk atau tidur, lampu tanduknya menyala lembut.';
  return SAHABAT_LEVEL_SUB[l];
}

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
  beruang: ['koin', 'koin', 'ikan-wader', 'es-krim', 'wedang-jahe'],
  rusa: ['koin', 'koin', 'wortel', 'jeruk', 'bibit-wortel'],
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
