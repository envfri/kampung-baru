// Cerdas Cermat Kampung: kuis bersama Pak Kancil (Balai Main). Kontrak bank soal (lihat kuis-soal.json di server),
// validator yang dipakai uji, seed & simpan admin, tampilan soal untuk pemain (TANPA kunci jawaban), pemeriksaan jawaban,
// dan angka skor. Server = sumber kebenaran; game hanya menampilkan.
//
// Urutan tampil pilihan / butir / sisi kanan diacak secara tetap dari sebuah kunci (mis. "<run>:<nomor>") supaya
// memuat ulang menampilkan urutan yang sama, dan server bisa menghitung ulang pemetaannya saat memeriksa jawaban.
import { mulberry32 } from './economy';

export const KUIS_CATEGORIES = {
  budaya: { name: 'Budaya Nusantara', prefix: 'bud', short: 'Budaya', color: '#E0583F' },
  makanan: { name: 'Makanan Khas', prefix: 'mak', short: 'Makanan', color: '#F2994A' },
  geografi: { name: 'Geografi Indonesia', prefix: 'geo', short: 'Geografi', color: '#3F7FBF' },
  alam: { name: 'Alam & Hewan', prefix: 'alm', short: 'Alam', color: '#3FA06A' },
  sains: { name: 'Sains', prefix: 'sai', short: 'Sains', color: '#2E9C9C' },
  bahasa: { name: 'Bahasa & Peribahasa', prefix: 'bhs', short: 'Bahasa', color: '#9A6FC0' },
  matematika: { name: 'Matematika', prefix: 'mtk', short: 'Matematika', color: '#D9A21B' },
  sejarah: { name: 'Sejarah & Pahlawan', prefix: 'sej', short: 'Sejarah', color: '#B5543A' },
} as const;
export type KuisCat = keyof typeof KUIS_CATEGORIES;
export const KUIS_CAT_IDS = Object.keys(KUIS_CATEGORIES) as KuisCat[];
export const isKuisCat = (v: unknown): v is KuisCat => typeof v === 'string' && Object.hasOwn(KUIS_CATEGORIES, v);

export const KUIS_TYPES = {
  pilihan: { name: 'Pilihan ganda', hint: 'Pilih satu jawaban yang benar.' },
  benarsalah: { name: 'Benar atau salah', hint: 'Benar atau salah?' },
  gambar: { name: 'Tebak gambar', hint: 'Lihat gambarnya, lalu pilih jawabannya.' },
  urutkan: { name: 'Urutkan', hint: 'Ketuk sesuai urutan yang benar, lalu Kirim.' },
  cocokkan: { name: 'Cocokkan', hint: 'Ketuk kiri lalu kanan untuk memasangkan, lalu Kirim.' },
  peribahasa: { name: 'Lengkapi peribahasa', hint: 'Pilih kata untuk mengisi bagian yang kosong.' },
  hitung: { name: 'Hitung cepat', hint: 'Hitung, lalu pilih angkanya.' },
} as const;
export type KuisType = keyof typeof KUIS_TYPES;
export const KUIS_TYPE_IDS = Object.keys(KUIS_TYPES) as KuisType[];
export const isKuisType = (v: unknown): v is KuisType => typeof v === 'string' && Object.hasOwn(KUIS_TYPES, v);
/** tipe cepat (sekali ketuk) untuk Cerdas Cermat Bareng */
export const KUIS_QUICK: KuisType[] = ['pilihan', 'benarsalah', 'gambar', 'peribahasa', 'hitung'];
/** tipe yang waktunya dua kali lipat */
export const KUIS_SLOW: KuisType[] = ['urutkan', 'cocokkan'];
export const KUIS_LEVELS: Record<number, string> = { 1: 'Mudah', 2: 'Sedang', 3: 'Sulit' };

/** 24 kunci gambar tebak gambar (digambar orisinal di art-kuis.ts) */
export const KUIS_IMAGES = [
  'komodo', 'orangutan', 'gajah', 'badak', 'cenderawasih', 'tarsius', 'anoa', 'penyu', 'babirusa', 'harimau',
  'rumah-gadang', 'joglo', 'honai', 'tongkonan',
  'angklung', 'sasando', 'gong', 'kendang', 'kolintang', 'tifa',
  'keris', 'gunungan', 'becak', 'bedug',
] as const;
export type KuisImage = (typeof KUIS_IMAGES)[number];
export const isKuisImage = (v: unknown): v is KuisImage => typeof v === 'string' && (KUIS_IMAGES as readonly string[]).includes(v);
/** nama gambar (hanya untuk admin; tidak pernah dikirim ke pemain bersama soal) */
export const KUIS_IMAGE_NAMES: Record<KuisImage, string> = {
  komodo: 'Komodo', orangutan: 'Orangutan', gajah: 'Gajah', badak: 'Badak bercula satu', cenderawasih: 'Cenderawasih', tarsius: 'Tarsius',
  anoa: 'Anoa', penyu: 'Penyu', babirusa: 'Babirusa', harimau: 'Harimau', 'rumah-gadang': 'Rumah Gadang', joglo: 'Joglo', honai: 'Honai',
  tongkonan: 'Tongkonan', angklung: 'Angklung', sasando: 'Sasando', gong: 'Gong', kendang: 'Kendang', kolintang: 'Kolintang', tifa: 'Tifa',
  keris: 'Keris', gunungan: 'Gunungan wayang', becak: 'Becak', bedug: 'Bedug',
};

/** Satu soal di bank (bentuk JSON kuis-soal.json; field yang tidak dipakai tipenya tidak ditulis). */
export interface KuisQuestion {
  id: string;
  cat: KuisCat;
  level: 1 | 2 | 3;
  type: KuisType;
  q: string;
  options?: string[];
  answer?: number;
  order?: string[];
  pairs?: [string, string][];
  image?: KuisImage;
  explain: string;
  source: string;
}

/* ---------------- validasi (uji, seed, simpan admin) ---------------- */

export const KUIS_LIMITS = { q: 160, qShort: 100, explain: 220, option: 200 };
const KEYS = ['id', 'cat', 'level', 'type', 'q', 'options', 'answer', 'order', 'pairs', 'image', 'explain', 'source'];
/** kunci yang boleh ada per tipe (selain kunci umum) */
const TYPE_KEYS: Record<KuisType, string[]> = {
  pilihan: ['options', 'answer'], benarsalah: ['options', 'answer'], gambar: ['options', 'answer', 'image'],
  urutkan: ['order'], cocokkan: ['pairs'], peribahasa: ['options', 'answer'], hitung: ['options', 'answer'],
};
const COMMON = ['id', 'cat', 'level', 'type', 'q', 'explain', 'source'];
/** normalisasi untuk membandingkan teks: spasi di ujung, huruf besar/kecil, spasi ganda */
export const normKuis = (s: unknown) => String(s ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/** Periksa satu soal; kembalikan daftar pesan galat berbahasa Indonesia (kosong = sah). */
export function validateQuestion(q: any): string[] {
  const out: string[] = [];
  if (!q || typeof q !== 'object' || Array.isArray(q)) return ['Soal harus berupa objek.'];
  for (const k of Object.keys(q)) if (!KEYS.includes(k)) out.push(`Kunci "${k}" tidak dikenal.`);
  if (!isKuisCat(q.cat)) out.push(`Kategori "${q.cat}" tidak dikenal (pilih: ${KUIS_CAT_IDS.join(', ')}).`);
  if (typeof q.id !== 'string' || !/^[a-z]{3}-\d{3}$/.test(q.id)) out.push('ID harus prefiks kategori + nomor 3 digit, mis. "bud-001".');
  else if (isKuisCat(q.cat) && !q.id.startsWith(KUIS_CATEGORIES[q.cat].prefix + '-')) out.push(`ID untuk kategori ${q.cat} harus diawali "${KUIS_CATEGORIES[q.cat].prefix}-".`);
  if (![1, 2, 3].includes(q.level)) out.push('Level harus 1 (mudah), 2 (sedang), atau 3 (sulit).');
  if (!isKuisType(q.type)) { out.push(`Tipe "${q.type}" tidak dikenal (pilih: ${KUIS_TYPE_IDS.join(', ')}).`); return out; }
  const t = q.type as KuisType;
  // field yang tidak dipakai tipe ini tidak boleh ditulis
  for (const k of Object.keys(q)) if (KEYS.includes(k) && !COMMON.includes(k) && !TYPE_KEYS[t].includes(k)) out.push(`Soal ${KUIS_TYPES[t].name.toLowerCase()} tidak memakai "${k}"; hapus kunci itu.`);
  const maxQ = KUIS_SLOW.includes(t) ? KUIS_LIMITS.qShort : KUIS_LIMITS.q;
  if (!isStr(q.q)) out.push('Teks soal wajib diisi.');
  else if (q.q.length > maxQ) out.push(`Teks soal paling panjang ${maxQ} karakter (sekarang ${q.q.length}).`);
  if (TYPE_KEYS[t].includes('options')) {
    const o = q.options;
    if (t === 'benarsalah') {
      if (!Array.isArray(o) || o.length !== 2 || o[0] !== 'Benar' || o[1] !== 'Salah') out.push('Pilihan benar/salah harus tepat ["Benar","Salah"].');
    } else if (!Array.isArray(o) || o.length !== 4) out.push('Harus ada tepat 4 pilihan jawaban.');
    if (Array.isArray(o)) {
      if (o.some((x) => !isStr(x))) out.push('Setiap pilihan jawaban wajib diisi (teks).');
      else {
        if (o.some((x: string) => x.length > KUIS_LIMITS.option)) out.push(`Pilihan jawaban paling panjang ${KUIS_LIMITS.option} karakter.`);
        if (new Set(o.map(normKuis)).size !== o.length) out.push('Pilihan jawaban tidak boleh kembar.');
        if (t === 'hitung' && o.some((x: string) => !/\d/.test(x))) out.push('Soal hitung: setiap pilihan harus berupa angka.');
      }
    }
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= (Array.isArray(o) ? o.length : t === 'benarsalah' ? 2 : 4)) out.push('Kunci jawaban (answer) harus nomor pilihan yang ada (mulai dari 0).');
  }
  if (t === 'urutkan') {
    const o = q.order;
    if (!Array.isArray(o) || o.length < 3 || o.length > 5) out.push('Soal urutkan butuh 3–5 butir dalam urutan yang benar.');
    else if (o.some((x) => !isStr(x))) out.push('Setiap butir urutan wajib diisi (teks).');
    else if (new Set(o.map(normKuis)).size !== o.length) out.push('Butir urutan tidak boleh kembar.');
  }
  if (t === 'cocokkan') {
    const p = q.pairs;
    if (!Array.isArray(p) || p.length < 3 || p.length > 4) out.push('Soal cocokkan butuh 3–4 pasangan.');
    else if (p.some((x) => !Array.isArray(x) || x.length !== 2 || !isStr(x[0]) || !isStr(x[1]))) out.push('Setiap pasangan harus ["kiri", "kanan"] dan keduanya wajib diisi.');
    else {
      if (new Set(p.map((x: string[]) => normKuis(x[0]))).size !== p.length) out.push('Sisi kiri pasangan tidak boleh kembar.');
      if (new Set(p.map((x: string[]) => normKuis(x[1]))).size !== p.length) out.push('Sisi kanan pasangan tidak boleh kembar.');
    }
  }
  if (t === 'gambar' && !isKuisImage(q.image)) out.push(`Gambar "${q.image ?? ''}" tidak dikenal (pilih salah satu dari ${KUIS_IMAGES.length} kunci gambar).`);
  if (t === 'peribahasa' && isStr(q.q) && !q.q.includes('___')) out.push('Soal peribahasa harus memuat "___" di tempat kata yang hilang.');
  if (!isStr(q.explain)) out.push('Penjelasan (explain) wajib diisi.');
  else {
    if (q.explain.length > KUIS_LIMITS.explain) out.push(`Penjelasan paling panjang ${KUIS_LIMITS.explain} karakter (sekarang ${q.explain.length}).`);
    if (/^\s*tahukah kamu/i.test(q.explain)) out.push('Penjelasan jangan diawali "Tahukah kamu" (game sudah menambahkannya).');
  }
  if (!isStr(q.source)) out.push('Sumber (source) wajib diisi.');
  return out;
}

/** Periksa seluruh bank: tiap soal + ID kembar + teks soal kembar (setelah dinormalkan). */
export function validateBank(list: unknown): string[] {
  if (!Array.isArray(list)) return ['Bank soal harus berupa daftar (array).'];
  const out: string[] = [];
  const ids = new Map<string, number>(), texts = new Map<string, string>();
  list.forEach((q: any, i) => {
    const tag = `[${typeof q?.id === 'string' ? q.id : `#${i + 1}`}]`;
    for (const e of validateQuestion(q)) out.push(`${tag} ${e}`);
    if (typeof q?.id === 'string') {
      if (ids.has(q.id)) out.push(`${tag} ID kembar dengan soal #${ids.get(q.id)! + 1}.`);
      else ids.set(q.id, i);
    }
    if (typeof q?.q === 'string') {
      const n = normKuis(q.q);
      if (texts.has(n)) out.push(`${tag} Teks soal sama dengan ${texts.get(n)}.`);
      else texts.set(n, String(q.id));
    }
  });
  return out;
}

/** Pisahkan soal sah & tidak sah (untuk seed: yang tidak sah dilewati & dicatat). Soal kembar kedua ikut ditolak. */
export function splitBank(list: unknown) {
  const ok: KuisQuestion[] = [], bad: { id: string; errors: string[] }[] = [];
  if (!Array.isArray(list)) return { ok, bad: [{ id: '-', errors: ['Bank soal harus berupa daftar (array).'] }] };
  const ids = new Set<string>(), texts = new Set<string>();
  list.forEach((q: any, i) => {
    const errors = validateQuestion(q);
    if (!errors.length && ids.has(q.id)) errors.push('ID kembar.');
    if (!errors.length && texts.has(normKuis(q.q))) errors.push('Teks soal kembar.');
    if (errors.length) { bad.push({ id: typeof q?.id === 'string' ? q.id : `#${i + 1}`, errors }); return; }
    ids.add(q.id); texts.add(normKuis(q.q));
    ok.push(q as KuisQuestion);
  });
  return { ok, bad };
}

/** Rapikan soal dari form admin: hanya kunci yang dipakai tipenya, teks dirapikan (sebelum validateQuestion). */
export function cleanQuestion(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  const t = raw.type as KuisType;
  const keep = isKuisType(t) ? [...COMMON, ...TYPE_KEYS[t]] : KEYS;
  const tidy = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/[ \t]+/g, ' ') : v);
  const out: any = {};
  for (const k of keep) {
    if (raw[k] === undefined) continue;
    let v = raw[k];
    if (k === 'options' || k === 'order') v = Array.isArray(v) ? v.map(tidy) : v;
    else if (k === 'pairs') v = Array.isArray(v) ? v.map((p: any) => (Array.isArray(p) ? p.map(tidy) : p)) : v;
    else if (k === 'level' || k === 'answer') v = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
    else v = tidy(v);
    out[k] = v;
  }
  if (t === 'benarsalah' && !Array.isArray(out.options)) out.options = ['Benar', 'Salah'];
  return out;
}

/* ---------------- urutan tampil (tetap per kunci) ---------------- */

export function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
/** permutasi 0..n-1 yang tetap untuk kunci yang sama; noIdentity = jangan sama dengan urutan asli (geser satu) */
export function kuisPerm(key: string, n: number, noIdentity = false) {
  const r = mulberry32(hashStr(key));
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  if (noIdentity && n > 1 && a.every((v, i) => v === i)) a.push(a.shift()!);
  return a;
}
const numOf = (s: string) => { const m = /-?\d+(?:[.,]\d+)?/.exec(s.replace(/\.(?=\d{3}\b)/g, '')); return m ? Number(m[0].replace(',', '.')) : NaN; };
/** urutan tampil pilihan: indeks tampil → indeks asli. Benar/Salah tetap; hitung diurutkan dari kecil bila semuanya angka. */
export function optionOrder(q: Pick<KuisQuestion, 'type' | 'options'>, key: string) {
  const n = q.options?.length ?? 0;
  if (q.type === 'benarsalah') return Array.from({ length: n }, (_, i) => i);
  if (q.type === 'hitung') {
    const v = (q.options ?? []).map(numOf);
    if (v.every((x) => Number.isFinite(x)) && new Set(v).size === v.length) return v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
  }
  return kuisPerm(key + ':o', n);
}
/** urutkan: butir tampil → indeks di order (tidak pernah sudah urut) */
export const itemOrder = (q: Pick<KuisQuestion, 'order'>, key: string) => kuisPerm(key + ':u', q.order?.length ?? 0, true);
/** cocokkan: sisi kanan tampil → indeks pasangan asli (tidak pernah sudah berpasangan lurus) */
export const rightOrder = (q: Pick<KuisQuestion, 'pairs'>, key: string) => kuisPerm(key + ':c', q.pairs?.length ?? 0, true);

/** waktu menjawab (ms): urutkan & cocokkan dua kali lipat */
export const kuisTimeMs = (type: KuisType, timerSec: number) => Math.round(Math.max(3, timerSec) * 1000 * (KUIS_SLOW.includes(type) ? 2 : 1));

/** Soal untuk pemain: TANPA answer / order / pairs / explain / source. */
export interface KuisPublic {
  id: string; cat: KuisCat; level: number; type: KuisType; q: string;
  options?: string[]; image?: KuisImage; items?: string[]; left?: string[]; right?: string[];
}
export function kuisPublic(q: KuisQuestion, key: string): KuisPublic {
  const base: KuisPublic = { id: q.id, cat: q.cat, level: q.level, type: q.type, q: q.q };
  if (q.options) { const ord = optionOrder(q, key); base.options = ord.map((i) => q.options![i]); }
  if (q.type === 'gambar') base.image = q.image;
  if (q.type === 'urutkan') base.items = itemOrder(q, key).map((i) => q.order![i]);
  if (q.type === 'cocokkan') { base.left = q.pairs!.map((p) => p[0]); base.right = rightOrder(q, key).map((i) => q.pairs![i][1]); }
  return base;
}

/**
 * Jawaban pemain (indeks tampil): pilihan = angka; urutkan = daftar indeks butir sesuai urutan yang dipilih;
 * cocokkan = untuk tiap kiri (urutan asli), indeks sisi kanan tampil. null = bentuk tidak sah.
 */
export function parsePick(q: KuisQuestion, pick: unknown): number | number[] | null {
  const intIn = (v: unknown, n: number) => Number.isInteger(v) && (v as number) >= 0 && (v as number) < n;
  if (q.type === 'urutkan' || q.type === 'cocokkan') {
    const n = q.type === 'urutkan' ? q.order!.length : q.pairs!.length;
    if (!Array.isArray(pick) || pick.length !== n || !pick.every((v) => intIn(v, n)) || new Set(pick).size !== n) return null;
    return pick as number[];
  }
  const n = q.options?.length ?? 0;
  return intIn(pick, n) ? (pick as number) : null;
}
/** benar? (pick sudah lewat parsePick) */
export function kuisCheck(q: KuisQuestion, key: string, pick: number | number[]): boolean {
  if (q.type === 'urutkan') { const ord = itemOrder(q, key); return (pick as number[]).every((d, k) => ord[d] === k); }
  if (q.type === 'cocokkan') { const ord = rightOrder(q, key); return (pick as number[]).every((d, k) => ord[d] === k); }
  return optionOrder(q, key)[pick as number] === q.answer;
}
/** kunci jawaban dalam indeks tampil + penjelasan (dikirim SESUDAH pemain menjawab / waktu habis) */
export function kuisReveal(q: KuisQuestion, key: string) {
  if (q.type === 'urutkan') { const ord = itemOrder(q, key); return { order: q.order!.map((_, k) => ord.indexOf(k)), explain: q.explain }; }
  if (q.type === 'cocokkan') { const ord = rightOrder(q, key); return { pairs: q.pairs!.map((_, k) => ord.indexOf(k)), explain: q.explain }; }
  return { answer: optionOrder(q, key).indexOf(q.answer!), explain: q.explain };
}
export type KuisRevealed = ReturnType<typeof kuisReveal>;

/* ---------------- pilih soal harian ---------------- */

export interface KuisPoolItem { id: string; cat: string; level: number; type: string }
/** target jumlah per level (mis. 10 soal & [4,4,2] → 4/4/2), dibulatkan supaya jumlahnya pas */
export function levelTargets(n: number, mix: number[]) {
  const m = [0, 1, 2].map((i) => Math.max(0, Number(mix?.[i]) || 0));
  const sum = m.reduce((a, b) => a + b, 0) || 1;
  const raw = m.map((x) => (x * n) / sum);
  const t = raw.map(Math.floor);
  let left = n - t.reduce((a, b) => a + b, 0);
  const order = raw.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; left > 0; k = (k + 1) % 3, left--) t[order[k][1]]++;
  return t;
}
/**
 * Pilih n soal (tetap untuk kunci yang sama): kira-kira mengikuti campuran level, kategori sebanyak mungkin berbeda,
 * soal yang belum pernah dilihat lebih dulu; bila bank tipis, kekurangan level diisi level lain. Hasil urut mudah → sulit.
 */
export function pickKuis(key: string, pool: KuisPoolItem[], n: number, mix: number[], seen: Set<string> = new Set(), types?: string[]) {
  const cands = pool.filter((q) => !types || types.includes(q.type)).map((q) => ({ q, h: hashStr(key + '|' + q.id), seen: seen.has(q.id) }));
  cands.sort((a, b) => Number(a.seen) - Number(b.seen) || a.h - b.h);
  const want = levelTargets(Math.min(n, cands.length), mix);
  const used = new Set<string>(), catN = new Map<string, number>(), typeN = new Map<string, number>(), out: KuisPoolItem[] = [];
  const take = (lvl: number | null) => {
    let best: (typeof cands)[number] | null = null, score = Infinity;
    for (const c of cands) {
      if (used.has(c.q.id) || (lvl !== null && c.q.level !== lvl)) continue;
      // belum dilihat dulu, lalu kategori & tipe yang paling jarang, lalu urutan acak tetap
      const s = (c.seen ? 1e6 : 0) + (catN.get(c.q.cat) ?? 0) * 1000 + (typeN.get(c.q.type) ?? 0) * 10;
      if (s < score) { score = s; best = c; }
    }
    if (!best) return false;
    used.add(best.q.id); out.push(best.q);
    catN.set(best.q.cat, (catN.get(best.q.cat) ?? 0) + 1);
    typeN.set(best.q.type, (typeN.get(best.q.type) ?? 0) + 1);
    return true;
  };
  let short = 0;
  for (let l = 0; l < 3; l++) for (let k = 0; k < want[l]; k++) if (!take(l + 1)) short++;
  // bank tipis: isi dari level terdekat
  for (; short > 0 && out.length < n; short--) if (!take(null)) break;
  return out.sort((a, b) => a.level - b.level || hashStr(key + a.id) - hashStr(key + b.id));
}

/* ---------------- skor ---------------- */

/** poin papan peringkat untuk satu jawaban benar: poin per level + bonus cepat (menjawab di paruh pertama waktu) */
export function kuisPoints(level: number, ms: number, limitMs: number, cfg: { points: number[]; fastBonus: number }) {
  const base = Number(cfg.points?.[Math.max(0, Math.min(2, level - 1))]) || 0;
  return base + (ms <= limitMs / 2 ? Math.max(0, cfg.fastBonus || 0) : 0);
}
/** Tantang Teman: skor duel = benar × 1.000.000 + (999.999 − total waktu ms) → lebih banyak benar menang, seri dipecah waktu */
export const tantangScore = (correct: number, totalMs: number) => correct * 1_000_000 + (999_999 - Math.max(0, Math.min(999_999, Math.round(totalMs))));
export const tantangParts = (score: number) => ({ correct: Math.floor(score / 1_000_000), totalMs: 999_999 - (score % 1_000_000) });
export function tantangLabel(score: number | null | undefined) {
  if (score === null || score === undefined) return '—';
  const p = tantangParts(score);
  return `${p.correct} benar · ${(p.totalMs / 1000).toFixed(1).replace('.', ',')} dtk`;
}

/** Pak Kancil berkomentar menurut hasil (benar dari total) */
export function kancilLine(correct: number, total: number) {
  const r = total ? correct / total : 0;
  if (total && correct === total) return 'Sempurna! Kamu juara kampung hari ini!';
  if (r >= 0.8) return 'Hebat sekali! Sedikit lagi sempurna.';
  if (r >= 0.5) return 'Bagus! Besok pasti lebih banyak yang benar.';
  if (correct > 0) return 'Tidak apa-apa, kita belajar bareng. Coba lagi besok, ya!';
  return 'Hmm, soal hari ini memang sulit. Baca "Tahukah kamu?"-nya, ya!';
}

/* ---------------- pengaturan admin `kuis` ---------------- */

export interface KuisSettings {
  on: boolean;
  dailyCount: number; levelMix: number[]; timerSec: number; graceSec: number; seenDays: number; energi: number;
  coins: number; xp: number; perfectCoins: number; perfectXp: number; dailyCoinCap: number; points: number[]; fastBonus: number;
  streak3Coins: number; streak7Coins: number; streak7Pearls: number;
  barengCount: number; barengRevealSec: number;
  tantangCount: number; tantangPerDay: number; tantangExpireHours: number;
  reportsPerDay: number; badgeAt: number;
}
/** angka kuis untuk tampilan pemain (katalog & beranda Kuis; tanpa kunci jawaban apa pun) */
export function kuisPublicCfg(s: { kuis?: Partial<KuisSettings>; features?: Record<string, unknown> }) {
  const k = (s.kuis ?? {}) as KuisSettings;
  return {
    on: k.on !== false && s.features?.minigames !== false, dailyCount: k.dailyCount, timerSec: k.timerSec, energi: k.energi, coins: k.coins, xp: k.xp, perfectCoins: k.perfectCoins,
    dailyCoinCap: k.dailyCoinCap, streak3Coins: k.streak3Coins, streak7Coins: k.streak7Coins, streak7Pearls: k.streak7Pearls,
    barengCount: k.barengCount, tantangCount: k.tantangCount, tantangPerDay: k.tantangPerDay, tantangExpireHours: k.tantangExpireHours, reportsPerDay: k.reportsPerDay, badgeAt: k.badgeAt,
  };
}

/** Cek pengaturan `kuis` dari admin; `fail` dipanggil dengan pesan yang bisa dibaca admin. */
export function checkKuis(k: any, fail: (msg: string) => void) {
  const no = (msg: string) => fail(`Kuis: ${msg}`);
  const int = (v: unknown, lo: number, hi: number) => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;
  if (!k || typeof k !== 'object') return no('pengaturan tidak valid.');
  if (!int(k.dailyCount, 1, 30)) no('dailyCount harus 1–30.');
  if (!Array.isArray(k.levelMix) || k.levelMix.length !== 3 || !k.levelMix.every((x: unknown) => int(x, 0, 30)) || !k.levelMix.some((x: number) => x > 0)) no('levelMix harus 3 angka 0–30 (mudah, sedang, sulit), tidak semuanya 0.');
  if (!int(k.timerSec, 5, 120)) no('timerSec harus 5–120 detik.');
  if (!int(k.graceSec, 0, 10)) no('graceSec harus 0–10 detik.');
  if (!int(k.seenDays, 0, 365)) no('seenDays harus 0–365 hari.');
  if (!int(k.energi, 0, 50)) no('energi harus 0–50.');
  for (const key of ['coins', 'perfectCoins', 'streak3Coins', 'streak7Coins']) if (!int(k[key], 0, 1000)) no(`${key} harus 0–1000 koin.`);
  for (const key of ['xp', 'perfectXp']) if (!int(k[key], 0, 200)) no(`${key} harus 0–200 XP.`);
  if (!int(k.dailyCoinCap, 0, 10000)) no('dailyCoinCap harus 0–10000 koin.');
  if (!Array.isArray(k.points) || k.points.length !== 3 || !k.points.every((x: unknown) => int(x, 0, 1000))) no('points harus 3 angka 0–1000 (mudah, sedang, sulit).');
  if (!int(k.fastBonus, 0, 1000)) no('fastBonus harus 0–1000.');
  if (!int(k.streak7Pearls, 0, 20)) no('streak7Pearls harus 0–20 Mutiara.');
  if (!int(k.barengCount, 3, 15)) no('barengCount harus 3–15 soal.');
  if (!int(k.barengRevealSec, 2, 20)) no('barengRevealSec harus 2–20 detik.');
  if (!int(k.tantangCount, 3, 10)) no('tantangCount harus 3–10 soal.');
  if (!int(k.tantangPerDay, 0, 50)) no('tantangPerDay harus 0–50.');
  if (!int(k.tantangExpireHours, 1, 168)) no('tantangExpireHours harus 1–168 jam.');
  if (!int(k.reportsPerDay, 0, 100)) no('reportsPerDay harus 0–100.');
  if (!int(k.badgeAt, 1, 1000)) no('badgeAt harus 1–1000 jawaban benar.');
}
