// Data awal (katalog, lokasi, event, paket Mutiara). Hanya diisi jika tabel masih kosong,
// setelah itu semuanya dikelola dari halaman admin.
import type { Db } from './index';

type SeedItem = {
  id: string; kind: string; name: string; description?: string;
  price_coin?: number; price_pearl?: number; sell_coin?: number; shop?: string | null;
  art: any; data?: any; event_id?: string | null; sort?: number;
};

const b = (key: string, colors?: Record<string, string>, params?: Record<string, number>) => ({ type: 'builtin', key, ...(colors ? { colors } : {}), ...(params ? { params } : {}) });

export const SEED_ITEMS: SeedItem[] = [
  // Pasar Pagi: makanan
  { id: 'pisang-goreng', kind: 'food', name: 'Pisang Goreng', description: 'Renyah di luar, manis di dalam.', price_coin: 8, sell_coin: 3, shop: 'pasar', art: b('pisang'), data: { effects: { kenyang: 15 } } },
  { id: 'tumpeng-mini', kind: 'food', name: 'Tumpeng Mini', description: 'Nasi kuning kecil untuk hari baik.', price_coin: 15, sell_coin: 6, shop: 'pasar', art: b('tumpeng'), data: { effects: { kenyang: 30 } } },
  { id: 'es-cendol', kind: 'food', name: 'Es Cendol', description: 'Segar dan bikin senang.', price_coin: 10, sell_coin: 4, shop: 'pasar', art: b('gelas'), data: { effects: { kenyang: 10, ceria: 10 } } },
  { id: 'klepon', kind: 'food', name: 'Klepon', description: 'Isi gula merah yang meletus di mulut.', price_coin: 6, sell_coin: 2, shop: 'pasar', art: b('bola3'), data: { effects: { kenyang: 8, ceria: 4 } } },
  { id: 'bakso', kind: 'food', name: 'Bakso Hangat', description: 'Kuah panas untuk hari hujan.', price_coin: 18, sell_coin: 7, shop: 'pasar', art: b('mangkuk', { main: '#C98A4B', accent: '#FFFFFF' }), data: { effects: { kenyang: 35, energi: 5 } } },
  { id: 'es-teh', kind: 'food', name: 'Es Teh Manis', description: 'Pelepas dahaga siang hari.', price_coin: 5, sell_coin: 2, shop: 'pasar', art: b('gelas', { main: '#D9A066', accent: '#A8622C' }), data: { effects: { ceria: 6, energi: 4 } } },
  { id: 'jeruk', kind: 'food', name: 'Jeruk Manis', description: 'Vitamin untuk si bulu.', price_coin: 7, sell_coin: 3, shop: 'pasar', art: b('buah', { main: '#F2994A', accent: '#3FA06A' }), data: { effects: { kenyang: 8, ceria: 6 } } },
  { id: 'kue-lapis', kind: 'food', name: 'Kue Lapis', description: 'Dimakan lapis demi lapis.', price_coin: 12, sell_coin: 5, shop: 'pasar', art: b('kue', { main: '#F7DCE4', accent: '#9A6FC0' }), data: { effects: { kenyang: 14, ceria: 8 } } },
  // hasil kebun
  { id: 'tomat', kind: 'food', name: 'Tomat Kebun', description: 'Dipetik sendiri dari kebun.', sell_coin: 6, shop: null, art: b('buah', { main: '#E0583F', accent: '#3FA06A' }), data: { effects: { kenyang: 10 } } },
  { id: 'jagung', kind: 'food', name: 'Jagung Manis', description: 'Hasil kebun, enak dibakar.', sell_coin: 8, shop: null, art: b('jagung'), data: { effects: { kenyang: 14 } } },
  { id: 'melati', kind: 'material', name: 'Bunga Melati', description: 'Harum. Bisa dijual di Pasar Pagi.', sell_coin: 12, shop: null, art: b('bunga'), data: {} },
  // bibit
  { id: 'bibit-tomat', kind: 'seed', name: 'Bibit Tomat', description: 'Panen 3 tomat dalam 30 menit.', price_coin: 10, shop: 'pasar', art: b('bibit', { main: '#E0583F', accent: '#3FA06A' }), data: { growMinutes: 30, yieldItem: 'tomat', yieldQty: 3 } },
  { id: 'bibit-jagung', kind: 'seed', name: 'Bibit Jagung', description: 'Panen 3 jagung dalam 1 jam.', price_coin: 14, shop: 'pasar', art: b('bibit', { main: '#F2C94C', accent: '#3FA06A' }), data: { growMinutes: 60, yieldItem: 'jagung', yieldQty: 3 } },
  { id: 'bibit-melati', kind: 'seed', name: 'Bibit Melati', description: 'Panen 2 melati dalam 2 jam.', price_coin: 20, shop: 'pasar', art: b('bibit', { main: '#F2EEE3', accent: '#3FA06A' }), data: { growMinutes: 120, yieldItem: 'melati', yieldQty: 2 } },
  // ikan (didapat dari Kolam Pancing)
  { id: 'ikan-mas', kind: 'fish', name: 'Ikan Mas', sell_coin: 8, art: b('ikan', { main: '#F2994A', accent: '#E0583F' }), data: { fishWeight: 40, minCm: 12, maxCm: 30 } },
  { id: 'ikan-nila', kind: 'fish', name: 'Ikan Nila', sell_coin: 10, art: b('ikan', { main: '#9AA7B8', accent: '#5E6E85' }, { stripes: 1 }), data: { fishWeight: 30, minCm: 15, maxCm: 35 } },
  { id: 'ikan-lele', kind: 'fish', name: 'Ikan Lele', sell_coin: 14, art: b('ikan', { main: '#6B6255', accent: '#4A4339' }), data: { fishWeight: 18, minCm: 20, maxCm: 45 } },
  { id: 'ikan-gurame', kind: 'fish', name: 'Ikan Gurame', sell_coin: 25, art: b('ikan', { main: '#C9B48A', accent: '#8C7A55' }, { stripes: 1 }), data: { fishWeight: 8, minCm: 25, maxCm: 50 } },
  { id: 'ikan-cupang', kind: 'fish', name: 'Ikan Cupang', description: 'Langka! Siripnya berkibar.', sell_coin: 60, art: b('ikan', { main: '#3F5FBF', accent: '#E0583F' }), data: { fishWeight: 3, minCm: 4, maxCm: 7 } },
  { id: 'sandal-jepit', kind: 'material', name: 'Sandal Jepit', description: 'Siapa yang buang sandal ke kolam?', sell_coin: 1, art: b('sandal'), data: { fishWeight: 6, minCm: 22, maxCm: 26 } },
  // Mebel Jati: furnitur
  { id: 'kasur-rotan', kind: 'furniture', name: 'Kasur Rotan', price_coin: 120, sell_coin: 50, shop: 'mebel', art: b('kasur'), data: { w: 2, d: 1 } },
  { id: 'rak-jati', kind: 'furniture', name: 'Rak Jati', price_coin: 150, sell_coin: 60, shop: 'mebel', art: b('rak'), data: { w: 1, d: 2 } },
  { id: 'pot-monstera', kind: 'furniture', name: 'Pot Monstera', price_coin: 45, sell_coin: 18, shop: 'mebel', art: b('tanaman'), data: { w: 1, d: 1 } },
  { id: 'lampu-anyaman', kind: 'furniture', name: 'Lampu Anyaman', price_coin: 60, sell_coin: 24, shop: 'mebel', art: b('lampu'), data: { w: 1, d: 1 } },
  { id: 'meja-bambu', kind: 'furniture', name: 'Meja Bambu', price_coin: 70, sell_coin: 28, shop: 'mebel', art: b('meja'), data: { w: 1, d: 1 } },
  { id: 'kursi-kayu', kind: 'furniture', name: 'Kursi Kayu', price_coin: 50, sell_coin: 20, shop: 'mebel', art: b('kursi'), data: { w: 1, d: 1 } },
  { id: 'sofa-santai', kind: 'furniture', name: 'Sofa Santai', price_coin: 180, sell_coin: 70, shop: 'mebel', art: b('sofa'), data: { w: 2, d: 1 } },
  { id: 'lemari-jati', kind: 'furniture', name: 'Lemari Jati', price_coin: 160, sell_coin: 64, shop: 'mebel', art: b('lemari'), data: { w: 1, d: 1 } },
  { id: 'karpet-kawung', kind: 'furniture', name: 'Karpet Kawung', price_coin: 80, sell_coin: 30, shop: 'mebel', art: b('karpet'), data: { w: 2, d: 2, flat: true } },
  { id: 'karpet-daun', kind: 'furniture', name: 'Karpet Daun', price_coin: 60, sell_coin: 24, shop: 'mebel', art: b('karpet', { main: '#3FA06A', accent: '#DDF3D2' }), data: { w: 2, d: 1, flat: true } },
  { id: 'peti-mainan', kind: 'furniture', name: 'Peti Mainan', price_coin: 40, sell_coin: 16, shop: 'mebel', art: b('kotak', { main: '#E9B23A' }, { height: 22 }), data: { w: 1, d: 1 } },
  { id: 'wp-garis', kind: 'wallpaper', name: 'Dinding Garis Krem', price_coin: 60, shop: 'mebel', art: b('garis'), data: {} },
  { id: 'wp-titik', kind: 'wallpaper', name: 'Dinding Titik Biru', price_coin: 90, shop: 'mebel', art: b('titik'), data: {} },
  { id: 'wp-pandan', kind: 'wallpaper', name: 'Dinding Hijau Pandan', price_coin: 90, shop: 'mebel', art: b('polos', { main: '#E3F1DA', accent: '#D6E9CB' }), data: {} },
  { id: 'fl-papan', kind: 'floor', name: 'Lantai Papan Jati', price_coin: 80, shop: 'mebel', art: b('papan'), data: {} },
  { id: 'fl-tegel', kind: 'floor', name: 'Lantai Tegel Kunci', price_coin: 110, shop: 'mebel', art: b('tegel'), data: {} },
  // Butik Benang: pakaian
  { id: 'syal-nila', kind: 'wear', name: 'Syal Motif Nila', price_coin: 40, sell_coin: 15, shop: 'butik', art: b('syal'), data: { slot: 'neck' } },
  { id: 'topi-caping', kind: 'wear', name: 'Topi Caping', price_coin: 35, sell_coin: 14, shop: 'butik', art: b('caping'), data: { slot: 'head' } },
  { id: 'kacamata-bulat', kind: 'wear', name: 'Kacamata Bulat', price_coin: 30, sell_coin: 12, shop: 'butik', art: b('kacamata'), data: { slot: 'face' } },
  { id: 'peci-hitam', kind: 'wear', name: 'Peci Hitam', price_coin: 45, sell_coin: 18, shop: 'butik', art: b('peci'), data: { slot: 'head' } },
  { id: 'dasi-kupu', kind: 'wear', name: 'Dasi Kupu-kupu', price_coin: 25, sell_coin: 10, shop: 'butik', art: b('dasikupu'), data: { slot: 'neck' } },
  { id: 'kupluk-merah', kind: 'wear', name: 'Kupluk Merah', price_coin: 30, sell_coin: 12, shop: 'butik', art: b('kupluk'), data: { slot: 'head' } },
  { id: 'kalung-manik', kind: 'wear', name: 'Kalung Manik', price_coin: 35, sell_coin: 14, shop: 'butik', art: b('kalung'), data: { slot: 'neck' } },
  // Toko Mutiara: kosmetik premium
  { id: 'mahkota-melati', kind: 'wear', name: 'Mahkota Melati', price_pearl: 5, shop: 'mutiara', art: b('mahkota'), data: { slot: 'head' } },
  { id: 'kacamata-keren', kind: 'wear', name: 'Kacamata Hitam Keren', price_pearl: 4, shop: 'mutiara', art: b('kacamatahitam'), data: { slot: 'face' } },
  { id: 'sofa-kunyit', kind: 'furniture', name: 'Sofa Kunyit', price_pearl: 8, shop: 'mutiara', art: b('sofa', { main: '#F2B632', accent: '#FFFDF7' }), data: { w: 2, d: 1 } },
  { id: 'lampu-pelangi', kind: 'furniture', name: 'Lampu Pelangi', price_pearl: 3, shop: 'mutiara', art: b('lampu', { main: '#9A6FC0' }), data: { w: 1, d: 1 } },
  // Event: Pekan Ceria Kampung
  { id: 'kupluk-merahputih', kind: 'wear', name: 'Kupluk Merah Putih', price_coin: 50, shop: 'butik', event_id: 'pekan-ceria', art: b('kupluk', { main: '#E0583F', accent: '#FFFFFF' }), data: { slot: 'head' } },
  { id: 'karpet-merahputih', kind: 'furniture', name: 'Karpet Merah Putih', price_coin: 90, shop: 'mebel', event_id: 'pekan-ceria', art: b('karpet', { main: '#E0583F', accent: '#FFFFFF' }), data: { w: 2, d: 2, flat: true } },
];

// Paket konten v2: aksesori, mebel, dekor, makanan, bibit, ikan baru.
export const SEED_ITEMS_V2: SeedItem[] = [
  { id: 'blangkon', kind: 'wear', name: 'Blangkon Cokelat', price_coin: 45, sell_coin: 18, shop: 'butik', art: b('blangkon'), data: { slot: 'head' } },
  { id: 'topi-koki', kind: 'wear', name: 'Topi Koki', price_coin: 40, sell_coin: 16, shop: 'butik', art: b('topikoki'), data: { slot: 'head' } },
  { id: 'topi-pesta', kind: 'wear', name: 'Topi Pesta', price_coin: 30, sell_coin: 12, shop: 'butik', art: b('topipesta'), data: { slot: 'head' } },
  { id: 'pita-rambut', kind: 'wear', name: 'Pita Merah Jambu', price_coin: 25, sell_coin: 10, shop: 'butik', art: b('pita'), data: { slot: 'head' } },
  { id: 'headphone', kind: 'wear', name: 'Headphone Biru', price_coin: 60, sell_coin: 24, shop: 'butik', art: b('headphone'), data: { slot: 'head' } },
  { id: 'baret-merah', kind: 'wear', name: 'Baret Merah', price_coin: 40, sell_coin: 16, shop: 'butik', art: b('baret'), data: { slot: 'head' } },
  { id: 'kumis-tebal', kind: 'wear', name: 'Kumis Tebal', price_coin: 20, sell_coin: 8, shop: 'butik', art: b('kumis'), data: { slot: 'face' } },
  { id: 'kacamata-renang', kind: 'wear', name: 'Kacamata Renang', price_coin: 35, sell_coin: 14, shop: 'butik', art: b('kacamatarenang'), data: { slot: 'face' } },
  { id: 'kalung-bunga', kind: 'wear', name: 'Kalung Bunga', price_coin: 40, sell_coin: 16, shop: 'butik', art: b('kalungbunga'), data: { slot: 'neck' } },
  { id: 'dasi-panjang', kind: 'wear', name: 'Dasi Panjang', price_coin: 30, sell_coin: 12, shop: 'butik', art: b('dasi'), data: { slot: 'neck' } },
  { id: 'kerah-lonceng', kind: 'wear', name: 'Kerah Lonceng', price_coin: 35, sell_coin: 14, shop: 'butik', art: b('lonceng'), data: { slot: 'neck' } },
  { id: 'ransel-jalan', kind: 'wear', name: 'Ransel Jalan-jalan', price_coin: 70, sell_coin: 28, shop: 'butik', art: b('ransel'), data: { slot: 'back' } },
  { id: 'jubah-merah', kind: 'wear', name: 'Jubah Pahlawan', price_coin: 90, sell_coin: 36, shop: 'butik', art: b('jubah'), data: { slot: 'back' } },
  { id: 'sayap-kupu', kind: 'wear', name: 'Sayap Kupu-kupu', price_pearl: 6, shop: 'mutiara', art: b('sayapkupu'), data: { slot: 'back' } },
  { id: 'mahkota-emas', kind: 'wear', name: 'Mahkota Emas', price_pearl: 8, shop: 'mutiara', art: b('mahkotaemas'), data: { slot: 'head' } },
  { id: 'kacamata-bintang', kind: 'wear', name: 'Kacamata Bintang', price_pearl: 3, shop: 'mutiara', art: b('kacamatabintang'), data: { slot: 'face' } },
  { id: 'tv-tabung', kind: 'furniture', name: 'TV Tabung', price_coin: 140, sell_coin: 56, shop: 'mebel', art: b('tv'), data: { w: 1, d: 1 } },
  { id: 'kulkas-mini', kind: 'furniture', name: 'Kulkas', price_coin: 160, sell_coin: 64, shop: 'mebel', art: b('kulkas'), data: { w: 1, d: 1 } },
  { id: 'beanbag-oranye', kind: 'furniture', name: 'Bean Bag Oranye', price_coin: 75, sell_coin: 30, shop: 'mebel', art: b('beanbag'), data: { w: 1, d: 1 } },
  { id: 'kaktus-pot', kind: 'furniture', name: 'Kaktus Berbunga', price_coin: 40, sell_coin: 16, shop: 'mebel', art: b('kaktus'), data: { w: 1, d: 1 } },
  { id: 'akuarium', kind: 'furniture', name: 'Akuarium Ikan Hias', price_coin: 220, sell_coin: 88, shop: 'mebel', art: b('akuarium'), data: { w: 2, d: 1 } },
  { id: 'wp-kotak', kind: 'wallpaper', name: 'Dinding Kotak Persik', price_coin: 90, shop: 'mebel', art: b('kotak'), data: {} },
  { id: 'wp-bata', kind: 'wallpaper', name: 'Dinding Bata Ekspos', price_coin: 110, shop: 'mebel', art: b('bata'), data: {} },
  { id: 'fl-teraso', kind: 'floor', name: 'Lantai Teraso', price_coin: 120, shop: 'mebel', art: b('teraso'), data: {} },
  { id: 'fl-karpet', kind: 'floor', name: 'Karpet Biru Lembut', price_coin: 100, shop: 'mebel', art: b('karpet'), data: {} },
  { id: 'es-krim', kind: 'food', name: 'Es Krim Dua Rasa', description: 'Manis dan dingin.', price_coin: 12, sell_coin: 5, shop: 'pasar', art: b('eskrim'), data: { effects: { ceria: 15, kenyang: 5 } } },
  { id: 'donat', kind: 'food', name: 'Donat Meses', price_coin: 9, sell_coin: 4, shop: 'pasar', art: b('donat'), data: { effects: { kenyang: 10, ceria: 6 } } },
  { id: 'sate', kind: 'food', name: 'Sate Bumbu Kacang', price_coin: 20, sell_coin: 8, shop: 'pasar', art: b('sate'), data: { effects: { kenyang: 30, energi: 5 } } },
  { id: 'martabak', kind: 'food', name: 'Martabak Manis', price_coin: 25, sell_coin: 10, shop: 'pasar', art: b('martabak'), data: { effects: { kenyang: 40 } } },
  { id: 'roti', kind: 'food', name: 'Roti Sobek', price_coin: 7, sell_coin: 3, shop: 'pasar', art: b('roti'), data: { effects: { kenyang: 12 } } },
  { id: 'stroberi', kind: 'food', name: 'Stroberi Kebun', description: 'Dipetik sendiri dari kebun.', sell_coin: 7, shop: null, art: b('stroberi'), data: { effects: { kenyang: 6, ceria: 8 } } },
  { id: 'bibit-stroberi', kind: 'seed', name: 'Bibit Stroberi', description: 'Panen 3 stroberi dalam 45 menit.', price_coin: 18, shop: 'pasar', art: b('bibit', { main: '#E0583F', accent: '#5DB36A' }), data: { growMinutes: 45, yieldItem: 'stroberi', yieldQty: 3 } },
  { id: 'ikan-koi', kind: 'fish', name: 'Ikan Koi', description: 'Langka! Bercak jingga di sisik putih.', sell_coin: 45, art: b('ikan', { main: '#FFFDF7', accent: '#F2994A' }, { spots: 1 }), data: { fishWeight: 4, minCm: 20, maxCm: 40 } },
  { id: 'ikan-sapu', kind: 'fish', name: 'Ikan Sapu-sapu', sell_coin: 5, art: b('ikan', { main: '#6B6255', accent: '#3B382F' }, { stripes: 1 }), data: { fishWeight: 10, minCm: 10, maxCm: 25 } },
];

export const SEED_LOCATIONS = [
  { id: 'rumah', name: 'Rumahku', kind: 'home', x: 80, y: 205, style: { body: '#F8EBCF', roof: '#C0603A', w: 96 }, sort: 1 },
  { id: 'pasar', name: 'Pasar Pagi', kind: 'shop', x: 225, y: 205, style: { body: '#FDF1D6', roof: '#3FA06A', w: 104 }, sort: 2, sells_back: true },
  { id: 'mebel', name: 'Mebel Jati', kind: 'shop', x: 375, y: 205, style: { body: '#E9D5B5', roof: '#8A5A36', w: 104 }, sort: 3 },
  { id: 'butik', name: 'Butik Benang', kind: 'shop', x: 530, y: 205, style: { body: '#F7DCE4', roof: '#9A6FC0', w: 100 }, sort: 4 },
  { id: 'mutiara', name: 'Toko Mutiara', kind: 'pearl', x: 690, y: 205, style: { body: '#EEE8FA', roof: '#6E5594', w: 96 }, sort: 5 },
  { id: 'kebun', name: 'Kebun', kind: 'garden', x: 103, y: 376, style: {}, sort: 6 },
  { id: 'lapangan', name: 'Lapangan Lomba', kind: 'race', x: 304, y: 384, style: {}, sort: 7 },
  { id: 'warung', name: 'Warung Kopi', kind: 'social', x: 540, y: 380, style: { body: '#FFF4DA', roof: '#2F5D7C', w: 104 }, sort: 8 },
  { id: 'kolam', name: 'Kolam Pancing', kind: 'pond', x: 705, y: 396, style: {}, sort: 9 },
];

export const SEED_PACKAGES = [
  { id: 'p-kecil', name: 'Segenggam Mutiara', pearls: 10, bonus: 0, price_idr: 15000, sort: 1 },
  { id: 'p-sedang', name: 'Sekantong Mutiara', pearls: 30, bonus: 3, price_idr: 39000, sort: 2 },
  { id: 'p-besar', name: 'Peti Mutiara', pearls: 70, bonus: 10, price_idr: 79000, sort: 3 },
];

export const SEED_BANNED = ['bangsat', 'kontol', 'memek', 'ngentot', 'jancok', 'goblok', 'tolol', 'fuck', 'shit', 'bitch'];

/** Paket konten tambahan: masuk sekali ke database baru maupun lama (tanpa menimpa ubahan admin). */
export async function seedPacks(db: Db) {
  const row = await db.one<{ value: any }>(`select value from settings where key = 'content_pack'`);
  const ver = Number(row?.value ?? 1);
  if (ver >= 2) return false;
  let sort = (await db.one<{ m: number }>('select coalesce(max(sort), 0)::int m from items'))!.m;
  for (const it of SEED_ITEMS_V2) {
    await db.query(
      `insert into items (id, kind, name, description, price_coin, price_pearl, sell_coin, shop, art, data, event_id, sort)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::text::jsonb,$10::text::jsonb,$11,$12) on conflict (id) do nothing`,
      [it.id, it.kind, it.name, it.description ?? '', it.price_coin ?? 0, it.price_pearl ?? 0, it.sell_coin ?? 0, it.shop ?? null, JSON.stringify(it.art), JSON.stringify(it.data ?? {}), it.event_id ?? null, (sort += 10)],
    );
  }
  await db.query(
    `insert into quests (id, kind, title, description, event, filter, target, reward_coin, reward_xp, url, sort)
     values ('h-gaya', 'daily', 'Tampil beda', 'Ganti aksesori pet sekali.', 'wear', '{}'::jsonb, 1, 15, 3, '/#bag', 120) on conflict (id) do nothing`,
  ).catch(() => {});
  await db.query(`insert into settings (key, value) values ('content_pack', '2'::jsonb) on conflict (key) do update set value = excluded.value`);
  return true;
}

export async function seed(db: Db) {
  const n = (await db.one<{ c: number }>('select count(*)::int as c from items'))!.c;
  if (n > 0) return false;
  await db.tx(async (t) => {
    const now = Date.now();
    await t.query(
      `insert into events (id, name, description, starts_at, ends_at, theme, bonus) values ($1,$2,$3,$4,$5,$6,$7)`,
      ['pekan-ceria', 'Pekan Ceria Kampung', 'Semua hadiah koin dari aktivitas +20%. Ada kupluk dan karpet merah putih edisi terbatas.', new Date(now - 86_400_000), new Date(now + 30 * 86_400_000), { color: '#E0583F' }, { coinMultiplier: 1.2 }],
    );
    let sort = 0;
    for (const it of SEED_ITEMS) {
      await t.query(
        `insert into items (id, kind, name, description, price_coin, price_pearl, sell_coin, shop, art, data, event_id, sort)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [it.id, it.kind, it.name, it.description ?? '', it.price_coin ?? 0, it.price_pearl ?? 0, it.sell_coin ?? 0, it.shop ?? null, it.art, it.data ?? {}, it.event_id ?? null, (sort += 10)],
      );
    }
    for (const l of SEED_LOCATIONS) {
      await t.query(`insert into locations (id, name, kind, x, y, style, sort, sells_back) values ($1,$2,$3,$4,$5,$6,$7,$8)`, [l.id, l.name, l.kind, l.x, l.y, l.style, l.sort, !!l.sells_back]);
    }
    for (const p of SEED_PACKAGES) {
      await t.query(`insert into pearl_packages (id, name, pearls, bonus, price_idr, sort) values ($1,$2,$3,$4,$5,$6)`, [p.id, p.name, p.pearls, p.bonus, p.price_idr, p.sort]);
    }
    for (const w of SEED_BANNED) await t.query('insert into banned_words (word) values ($1) on conflict do nothing', [w]);
    await t.query(`insert into announcements (title, body) values ($1, $2)`, [
      'Selamat datang di Kampung Bulu!',
      'Rawat pet-mu, hias rumah, dan kunjungi teman. Pekan Ceria Kampung sedang berlangsung: hadiah koin dari aktivitas +20%.',
    ]);
  });
  return true;
}
