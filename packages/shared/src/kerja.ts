// Kerja Sambilan: pet kerja paruh waktu di tempat-tempat kampung (1, 3, atau 8 jam) lalu pulang membawa gaji, XP,
// kadang barang bonus, dan cerita lucu. Aturan bersama server (sumber kebenaran) & game (tampilan papan lowongan).
// Semua angka ada di pengaturan admin `kerja` (lihat settings.ts); di sini hanya bentuk & hitungannya.
import type { Needs } from './economy';

export const KERJA_JOBS = ['warung', 'kebun', 'kolam', 'mebel', 'butik', 'ronda'] as const;
export type KerjaJob = (typeof KERJA_JOBS)[number];
export const isKerjaJob = (v: unknown): v is KerjaJob => typeof v === 'string' && (KERJA_JOBS as readonly string[]).includes(v);

export interface KerjaInfo {
  /** nama tempat di peta */
  place: string;
  /** id lokasi di peta tempat pet bekerja */
  loc: string;
  /** judul pekerjaan di kartu papan lowongan */
  title: string;
  /** "Mochi sedang <doing>" */
  doing: string;
  /** "Sedang kerja di <short>" (daftar teman) */
  short: string;
  /** seragam (item pakaian) yang didapat saat naik ke Karyawan; tidak dijual di toko */
  uniform: string[];
}

export const KERJA_INFO: Record<KerjaJob, KerjaInfo> = {
  warung: { place: 'Pasar Pagi', loc: 'pasar', title: 'Jaga warung', doing: 'jaga warung', short: 'Warung', uniform: ['celemek-warung'] },
  kebun: { place: 'Kebun', loc: 'kebun', title: 'Bantu panen', doing: 'bantu panen di kebun', short: 'Kebun', uniform: ['caping-kebun'] },
  kolam: { place: 'Kolam Pancing', loc: 'kolam', title: 'Bersihkan kolam & kasih makan ikan', doing: 'bersih-bersih kolam', short: 'Kolam Pancing', uniform: ['topi-kolam', 'bot-kolam'] },
  mebel: { place: 'Mebel Jati', loc: 'mebel', title: 'Amplas & pernis kayu', doing: 'mengamplas kayu', short: 'Mebel Jati', uniform: ['rompi-bengkel'] },
  butik: { place: 'Butik Benang', loc: 'butik', title: 'Lipat & jahit baju', doing: 'melipat & menjahit baju', short: 'Butik Benang', uniform: ['pita-meteran'] },
  ronda: { place: 'Pos Ronda', loc: 'ronda', title: 'Ronda malam', doing: 'ronda malam', short: 'Pos Ronda', uniform: ['sarung-ronda', 'kentongan-ronda'] },
};

/** lokasi peta khusus Kerja Sambilan (jenis lokasi baru) */
export const KERJA_LOC_KINDS = ['jobs', 'ronda'] as const;

export const KERJA_RANKS = ['magang', 'karyawan', 'senior', 'kepala'] as const;
export type KerjaRank = (typeof KERJA_RANKS)[number];
export const KERJA_RANK_LABEL: Record<KerjaRank, string> = { magang: 'Magang', karyawan: 'Karyawan', senior: 'Senior', kepala: 'Kepala' };

/** Cerita pulang kerja bawaan: {pet} = nama pet. Admin bisa mengubahnya di pengaturan kerja › stories. */
export const KERJA_STORIES: Record<KerjaJob, string[]> = {
  warung: [
    '{pet} menggoreng 40 pisang goreng… tapi diam-diam makan 3.',
    'Pembeli minta es teh manis, {pet} malah bikin es teh asin. Untung pembelinya tertawa.',
    '{pet} hafal semua harga gorengan dan menghitung kembalian secepat kilat.',
    'Ada pelanggan yang cuma mau ngobrol. Sekarang {pet} tahu semua kabar kampung hari ini.',
    '{pet} menata kerupuk di toples sampai rapi banget. Pemilik warung sampai terharu.',
    'Kucing tetangga mencoba mencuri ikan asin. {pet} mengusirnya dengan sopan.',
    '{pet} belajar membungkus nasi dengan daun pisang. Bungkus ke-12 akhirnya rapi!',
  ],
  kebun: [
    '{pet} memanen 30 tomat dan cuma menginjak satu. Lumayan!',
    'Seekor belalang hinggap di kepala {pet} selama sejam. Sekarang mereka berteman.',
    '{pet} mencabut wortel paling besar sekebun sampai jatuh terduduk.',
    'Waktu menyiram, {pet} ikut menyiram pak tani. Katanya sih segar.',
    '{pet} memindahkan cacing ke tanah yang lebih gembur. Baik hati sekali.',
    'Orang-orangan sawah dikira petani baru. {pet} sempat menyapanya dua kali.',
    '{pet} pulang dengan kaki berlumpur dan senyum lebar.',
  ],
  kolam: [
    '{pet} menyerok daun dari kolam sampai airnya bening seperti kaca.',
    'Ikan-ikan berebut pelet dari {pet}. Satu ikan mas sampai melompat tinggi!',
    '{pet} hampir tercebur, tapi sempat berpegangan di dermaga. Fiuh.',
    'Seekor katak menemani {pet} bekerja sambil bernyanyi kuak-kuak.',
    '{pet} menemukan sandal jepit di dasar kolam. Pemiliknya belum ketemu sampai sekarang.',
    'Kata para pemancing, sejak dirawat {pet} ikannya jadi lebih rajin makan umpan.',
    '{pet} menghitung ikan di kolam. Hasilnya 47… atau 48. Ikannya susah diam.',
  ],
  mebel: [
    '{pet} mengamplas kursi sampai halus, tapi bulunya jadi penuh serbuk kayu.',
    'Meja yang dipernis {pet} mengilap sampai bisa dipakai bercermin. Wajahnya kelihatan bangga.',
    '{pet} membantu memasang kaki lemari. Satu kaki sempat terpasang terbalik.',
    'Tukang kayu mengajari {pet} menyerut kayu. Serutannya keriting seperti mi.',
    '{pet} menemukan potongan kayu jati berbentuk hati dan menyimpannya di saku.',
    'Bunyi gergaji bikin {pet} ikut bersenandung seharian.',
    '{pet} mengecat kursi kecil warna biru. Ujung ekornya ikut sedikit biru.',
  ],
  butik: [
    '{pet} melipat 25 kaos dengan rapi. Kaos ke-26 malah dipakai sendiri.',
    'Jarum jahit sempat hilang… ternyata menempel di bulu {pet}.',
    '{pet} mengukur badan pelanggan dengan pita meteran. Hasilnya pas!',
    'Pembeli bingung memilih warna. {pet} menyarankan kuning, dan pembelinya senang sekali.',
    '{pet} menjahit kancing yang lepas. Sekarang kancingnya tidak akan lepas lagi.',
    'Gulungan benang menggelinding, {pet} mengejarnya keliling toko.',
    '{pet} menata manekin dengan gaya lucu. Pemilik butik tertawa dan membiarkannya.',
  ],
  ronda: [
    '{pet} memukul kentongan tepat tengah malam. Tong, tong, tong!',
    'Semalaman {pet} keliling kampung. Yang paling mencurigakan cuma kucing yang mengeong.',
    '{pet} dan bapak-bapak ronda makan singkong rebus sambil bercerita.',
    'Ada suara aneh di kebun… ternyata ayam yang mengigau. {pet} lega.',
    '{pet} mengingatkan tetangga yang lupa mengunci pintu. Warga jadi tenang.',
    'Menjelang subuh {pet} hampir tertidur di pos, untung ada wedang jahe hangat.',
    '{pet} melihat bintang jatuh waktu berjaga dan sudah membuat permintaan. Rahasia, katanya.',
  ],
};

/** Bentuk pengaturan admin `kerja` (nilai bawaan di settings.ts). */
export interface KerjaJobSettings { minLevel: number; bonusPct: number; bonusItems: string[]; kotor: boolean }
export interface KerjaSettings {
  on: boolean;
  minutes: number[];
  pay: number[];
  xp: number[];
  energi: number[];
  kenyang: number[];
  bersih: number[];
  minEnergi: number;
  minKenyang: number;
  maxHoursPerDay: number;
  rankAt: { karyawan: number; senior: number; kepala: number };
  rankBonusPct: number;
  ronda: { fromHour: number; toHour: number; minutes: number; pay: number; xp: number; energi: number; kenyang: number };
  jobs: Record<KerjaJob, KerjaJobSettings>;
  stories: Record<KerjaJob, string[]>;
}

export interface KerjaOption { minutes: number; pay: number; xp: number; cost: Partial<Needs> }

/** Pilihan lama kerja (menit) beserta gaji dasar (Magang), XP, dan biaya kebutuhan saat pulang. Ronda: satu pilihan tetap. */
export function kerjaOptions(k: KerjaSettings, job: KerjaJob): KerjaOption[] {
  if (job === 'ronda') {
    const r = k.ronda;
    return [{ minutes: r.minutes, pay: r.pay, xp: r.xp, cost: { energi: -r.energi, kenyang: -r.kenyang } }];
  }
  const dirty = !!k.jobs?.[job]?.kotor;
  return (k.minutes ?? []).map((m, i) => ({
    minutes: m, pay: k.pay?.[i] ?? 0, xp: k.xp?.[i] ?? 0,
    cost: { energi: -(k.energi?.[i] ?? 0), kenyang: -(k.kenyang?.[i] ?? 0), ...(dirty ? { bersih: -(k.bersih?.[i] ?? 0) } : {}) },
  }));
}

/** Pangkat dari jumlah shift selesai di satu tempat: 0 Magang, 1 Karyawan, 2 Senior, 3 Kepala. */
export function kerjaRankIdx(shifts: number, at: KerjaSettings['rankAt']) {
  if (shifts >= at.kepala) return 3;
  if (shifts >= at.senior) return 2;
  if (shifts >= at.karyawan) return 1;
  return 0;
}
/** Pangkat sekarang, pangkat berikutnya, dan kemajuan menuju ke sana (0–1). */
export function kerjaRank(shifts: number, at: KerjaSettings['rankAt']) {
  const idx = kerjaRankIdx(shifts, at);
  const marks = [0, at.karyawan, at.senior, at.kepala];
  const key = KERJA_RANKS[idx];
  const next = idx < 3 ? { key: KERJA_RANKS[idx + 1], label: KERJA_RANK_LABEL[KERJA_RANKS[idx + 1]], at: marks[idx + 1] } : null;
  const from = marks[idx];
  const pct = next ? Math.max(0, Math.min(1, (shifts - from) / Math.max(1, next.at - from))) : 1;
  return { idx, key, label: KERJA_RANK_LABEL[key], next, pct, shifts };
}

/** Gaji dengan bonus pangkat: +bonusPct% per pangkat di atas Magang. */
export const kerjaPay = (base: number, rankIdx: number, bonusPct: number) => Math.max(0, Math.round(base * (1 + (rankIdx * bonusPct) / 100)));

/** Dipanggil pulang lebih awal: gaji sebanding lama kerja (dibulatkan ke bawah). */
export const kerjaProRata = (pay: number, workedMs: number, totalMs: number) => Math.max(0, Math.floor(pay * Math.max(0, Math.min(1, workedMs / Math.max(1, totalMs)))));

/** Ronda hanya bisa dimulai di jendela jam setempat [fromHour, toHour) — boleh melewati tengah malam (mis. 22 → 2). */
export function rondaOpen(hm: { h: number; m: number }, fromHour: number, toHour: number) {
  const t = hm.h * 60 + hm.m, a = fromHour * 60, b = toHour * 60;
  return a <= b ? t >= a && t < b : t >= a || t < b;
}

/** "1 jam", "3 jam", "1 jam 30 mnt", "2 mnt" */
export function kerjaDur(minutes: number) {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} mnt`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} jam ${r} mnt` : `${h} jam`;
}

/** Biaya kebutuhan yang benar-benar dikenakan (dipanggil pulang: sebanding lama kerja). */
export function kerjaCostScaled(cost: Partial<Needs> | null | undefined, frac = 1): Partial<Needs> {
  const out: Partial<Needs> = {};
  const f = Math.max(0, Math.min(1, frac));
  for (const [k, v] of Object.entries(cost ?? {})) { const n = Math.round(Number(v) * f); if (n) (out as any)[k] = n; }
  return out;
}

export const kerjaStory = (line: string, pet: string) => String(line ?? '').replace(/\{pet\}/g, pet).replace(/\s+/g, ' ').trim();

/** Cek pengaturan `kerja` dari admin; `fail` dipanggil dengan pesan yang bisa dibaca admin. Angka dibulatkan di tempat. */
export function checkKerja(k: any, fail: (msg: string) => void, itemExists?: (id: string) => boolean) {
  const no = (msg: string) => fail(`Kerja sambilan: ${msg}`);
  const int = (v: unknown, lo: number, hi: number) => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;
  if (!k || typeof k !== 'object') return no('pengaturan tidak valid.');
  const list = (key: string, lo: number, hi: number, name: string) => {
    const v = k[key];
    if (!Array.isArray(v) || v.length !== 3 || !v.every((x: unknown) => int(x, lo, hi))) no(`${name} harus 3 bilangan bulat ${lo}–${hi} (untuk lama kerja pendek, sedang, panjang).`);
  };
  list('minutes', 1, 1440, 'minutes (lama kerja, menit)');
  if (Array.isArray(k.minutes) && !(k.minutes[0] < k.minutes[1] && k.minutes[1] < k.minutes[2])) no('minutes harus naik (mis. 60, 180, 480).');
  list('pay', 0, 100000, 'pay (gaji koin)');
  list('xp', 0, 1000, 'xp');
  list('energi', 0, 100, 'energi (biaya energi)');
  list('kenyang', 0, 100, 'kenyang (biaya kenyang)');
  list('bersih', 0, 100, 'bersih (biaya bersih untuk kebun & kolam)');
  if (!int(k.minEnergi, 0, 100)) no('minEnergi harus 0–100.');
  if (!int(k.minKenyang, 0, 100)) no('minKenyang harus 0–100.');
  if (!int(k.maxHoursPerDay, 1, 24)) no('maxHoursPerDay harus 1–24 jam.');
  const ra = k.rankAt ?? {};
  if (!int(ra.karyawan, 1, 10000) || !int(ra.senior, 1, 10000) || !int(ra.kepala, 1, 10000) || !(ra.karyawan < ra.senior && ra.senior < ra.kepala)) no('rankAt harus naik: karyawan < senior < kepala (1–10000 shift).');
  if (!int(k.rankBonusPct, 0, 100)) no('rankBonusPct harus 0–100 (%).');
  const r = k.ronda ?? {};
  if (!int(r.fromHour, 0, 23) || !int(r.toHour, 0, 24) || r.fromHour === r.toHour) no('ronda: fromHour 0–23 & toHour 0–24, tidak boleh sama.');
  if (!int(r.minutes, 1, 1440)) no('ronda: minutes harus 1–1440.');
  if (!int(r.pay, 0, 100000)) no('ronda: pay harus 0–100000.');
  if (!int(r.xp, 0, 1000)) no('ronda: xp harus 0–1000.');
  if (!int(r.energi, 0, 100) || !int(r.kenyang, 0, 100)) no('ronda: energi & kenyang harus 0–100.');
  for (const j of KERJA_JOBS) {
    const s = k.jobs?.[j];
    if (!s) { no(`jobs › ${j} tidak ada.`); continue; }
    if (!int(s.minLevel, 1, 100)) no(`jobs › ${j} › minLevel harus 1–100.`);
    if (!int(s.bonusPct, 0, 100)) no(`jobs › ${j} › bonusPct harus 0–100 (%).`);
    if (!Array.isArray(s.bonusItems) || s.bonusItems.length > 12) no(`jobs › ${j} › bonusItems maks 12 ID item.`);
    else if (itemExists) { const miss = s.bonusItems.filter((id: string) => !itemExists(id)); if (miss.length) no(`jobs › ${j} › bonusItems: item tidak dikenal (${miss.join(', ')}).`); }
    const st = k.stories?.[j];
    if (!Array.isArray(st) || st.length < 1 || st.length > 20 || st.some((x: unknown) => typeof x !== 'string' || !x.trim() || x.length > 160)) no(`stories › ${j}: 1–20 baris, tiap baris maks 160 huruf.`);
  }
}
