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

// Paket konten v3: Balai Main, hadiah event musiman.
export const SEED_ITEMS_V3: SeedItem[] = [
  { id: 'ketupat', kind: 'food', name: 'Ketupat', description: 'Teman makan di hari raya.', price_coin: 10, sell_coin: 4, shop: 'pasar', art: b('ketupat'), data: { effects: { kenyang: 22 } } },
  { id: 'lampion-merah', kind: 'furniture', name: 'Lampion Merah', description: 'Hadiah event. Bercahaya hangat.', sell_coin: 40, shop: null, art: b('lampion'), data: { w: 1, d: 1 } },
  { id: 'payung-taman', kind: 'furniture', name: 'Payung Taman', description: 'Hadiah event musim hujan.', sell_coin: 40, shop: null, art: b('payung'), data: { w: 1, d: 1 } },
  { id: 'peci-lebaran', kind: 'wear', name: 'Peci Hijau Lebaran', description: 'Hadiah event hari raya.', sell_coin: 20, shop: null, art: b('peci', { main: '#2F7F55' }), data: { slot: 'head' } },
  { id: 'topi-tahunbaru', kind: 'wear', name: 'Topi Pesta Emas', description: 'Hadiah event tahun baru.', sell_coin: 20, shop: null, art: b('topipesta', { main: '#F2B632', accent: '#3F5FBF' }), data: { slot: 'head' } },
];

export async function seedPackV3(db: Db) {
  const row = await db.one<{ value: any }>(`select value from settings where key = 'content_pack'`);
  if (Number(row?.value ?? 1) >= 3) return false;
  let sort = (await db.one<{ m: number }>('select coalesce(max(sort), 0)::int m from items'))!.m;
  for (const it of SEED_ITEMS_V3) {
    await db.query(
      `insert into items (id, kind, name, description, price_coin, price_pearl, sell_coin, shop, art, data, sort)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::text::jsonb,$10::text::jsonb,$11) on conflict (id) do nothing`,
      [it.id, it.kind, it.name, it.description ?? '', it.price_coin ?? 0, it.price_pearl ?? 0, it.sell_coin ?? 0, it.shop ?? null, JSON.stringify(it.art), JSON.stringify(it.data ?? {}), (sort += 10)],
    );
  }
  await db.query(
    `insert into locations (id, name, kind, x, y, style, sort) values ('balai', 'Balai Main', 'games', 860, 205, '{"body":"#E3F1DA","roof":"#E0583F","w":100}'::jsonb, 10) on conflict (id) do nothing`,
  );
  // Pekan Ceria contoh: pakai dekorasi, poin, dan hadiah bertingkat
  await db.query(
    `update events set decor = 'bendera', token_name = 'Bendera',
            points = '{"game_finish":10,"game_event_drop":2,"race":8,"visit":5,"daily_claim":10}'::jsonb,
            milestones = '[{"points":50,"coin":100},{"points":150,"item":"kupluk-merahputih"},{"points":300,"item":"karpet-merahputih"},{"points":500,"pearl":5}]'::jsonb
      where id = 'pekan-ceria' and decor = ''`,
  );
  await db.query(`insert into settings (key, value) values ('content_pack', '3'::jsonb) on conflict (key) do update set value = excluded.value`);
  return true;
}

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
      'Selamat datang di Kampung Bupi!',
      'Rawat pet-mu, hias rumah, dan kunjungi teman. Pekan Ceria Kampung sedang berlangsung: hadiah koin dari aktivitas +20%.',
    ]);
  });
  return true;
}

// Paket konten v4: rumah dengan banyak ruangan (Toko Bangunan), mebel dapur/kamar mandi/halaman,
// dan aktivitas di rumah (tidur di kasur, lihat jendela, siram tanaman, ...).
export const SEED_ITEMS_V4: SeedItem[] = [
  { id: 'fl-rumput', kind: 'floor', name: 'Hamparan Rumput', price_coin: 70, shop: 'bangunan', art: b('rumput'), data: {} },
  { id: 'fl-batu', kind: 'floor', name: 'Lantai Batu Paving', price_coin: 90, shop: 'bangunan', art: b('batu'), data: {} },
  { id: 'kompor-dapur', kind: 'furniture', name: 'Kompor Dapur', description: 'Bisa dipakai memasak roti.', price_coin: 140, sell_coin: 56, shop: 'mebel', art: b('kompor'), data: { w: 1, d: 1 } },
  { id: 'bak-mandi', kind: 'furniture', name: 'Bak Mandi', description: 'Berendam bikin wangi.', price_coin: 180, sell_coin: 72, shop: 'mebel', art: b('bakmandi'), data: { w: 2, d: 1 } },
  { id: 'bangku-taman', kind: 'furniture', name: 'Bangku Taman', price_coin: 90, sell_coin: 36, shop: 'bangunan', art: b('bangku'), data: { w: 2, d: 1 } },
  { id: 'pohon-mangga', kind: 'furniture', name: 'Pohon Mangga', description: 'Teduh untuk halaman.', price_coin: 160, sell_coin: 64, shop: 'bangunan', art: b('pohon'), data: { w: 1, d: 1 } },
  { id: 'ruang-tamu', kind: 'room', name: 'Ruang Tamu', description: 'Ruangan 6×6 untuk menerima teman.', price_coin: 600, shop: 'bangunan', art: b('dalam', { main: '#E3F1DA', accent: '#C48A55' }), data: { size: 6, theme: 'dalam', wall: 'wp-pandan', floor: 'fl-papan' } },
  { id: 'dapur', kind: 'room', name: 'Dapur', description: 'Ruangan 5×5. Pasang kompor untuk memasak.', price_coin: 450, shop: 'bangunan', art: b('dalam', { main: '#FBE3D3', accent: '#E9E4D6' }), data: { size: 5, theme: 'dalam', wall: 'wp-kotak', floor: 'fl-tegel' } },
  { id: 'kamar-mandi', kind: 'room', name: 'Kamar Mandi', description: 'Ruangan 4×4. Pasang bak mandi untuk berendam.', price_coin: 400, shop: 'bangunan', art: b('dalam', { main: '#DCE9F5', accent: '#E6E1D8' }), data: { size: 4, theme: 'dalam', wall: 'wp-titik', floor: 'fl-teraso' } },
  { id: 'halaman', kind: 'room', name: 'Halaman Rumput', description: 'Halaman terbuka 7×7 berpagar bambu.', price_coin: 750, shop: 'bangunan', art: b('luar'), data: { size: 7, theme: 'luar', floor: 'fl-rumput' } },
  { id: 'loteng', kind: 'room', name: 'Loteng Bintang', description: 'Ruangan rahasia 5×5 di atas rumah.', price_pearl: 12, shop: 'mutiara', art: b('dalam', { main: '#EEE8FA', accent: '#9FB8D9' }), data: { size: 5, theme: 'dalam', wall: 'wp-titik', floor: 'fl-karpet' } },
];

export const SEED_ACTIVITIES = [
  { id: 'tidur-kasur', name: 'Tidur', targets: ['art:kasur'], anim: 'tidur', effects: { energi: 35 }, xp: 3, cooldown_sec: 900, message: '{pet} tidur nyenyak di {item}.' },
  { id: 'duduk-santai', name: 'Duduk santai', targets: ['art:sofa', 'art:kursi', 'art:beanbag', 'art:bangku'], anim: 'duduk', effects: { ceria: 6, energi: 6 }, xp: 1, cooldown_sec: 180, message: '{pet} duduk santai di {item}.' },
  { id: 'lihat-jendela', name: 'Lihat ke luar', targets: ['spot:jendela'], anim: 'lihat', effects: { ceria: 6 }, xp: 1, cooldown_sec: 240, message: '{pet} melihat awan dari jendela.' },
  { id: 'lihat-lukisan', name: 'Lihat lukisan', targets: ['spot:lukisan'], anim: 'lihat', effects: { ceria: 5 }, xp: 2, cooldown_sec: 300, message: '{pet} mengagumi lukisan gunung.' },
  { id: 'siram-tanaman', name: 'Siram', targets: ['art:tanaman', 'art:kaktus', 'art:pohon'], anim: 'siram', effects: { ceria: 5 }, xp: 2, coins: 2, cooldown_sec: 600, message: '{pet} menyiram {item}. Segar!' },
  { id: 'baca-buku', name: 'Baca buku', targets: ['art:rak'], anim: 'baca', effects: { ceria: 8 }, xp: 3, cooldown_sec: 300, message: '{pet} membaca buku dongeng.' },
  { id: 'nonton-tv', name: 'Nonton TV', targets: ['art:tv'], anim: 'lihat', effects: { ceria: 12, energi: -3 }, xp: 1, cooldown_sec: 300, message: '{pet} nonton kartun di TV.' },
  { id: 'lihat-ikan', name: 'Lihat ikan', targets: ['art:akuarium'], anim: 'lihat', effects: { ceria: 8 }, xp: 1, cooldown_sec: 300, message: '{pet} menghitung ikan di akuarium.' },
  { id: 'main-mainan', name: 'Main bola', targets: ['item:peti-mainan'], anim: 'main', effects: { ceria: 14, energi: -6, kenyang: -3 }, xp: 3, coins: 3, cooldown_sec: 300, message: '{pet} bermain bola dari peti mainan.' },
  { id: 'ambil-camilan', name: 'Ambil camilan', targets: ['art:kulkas'], anim: 'lihat', effects: { kenyang: 10 }, xp: 1, cooldown_sec: 1200, daily_limit: 3, message: '{pet} mengambil camilan dingin dari kulkas.' },
  { id: 'masak-roti', name: 'Masak', targets: ['art:kompor'], anim: 'masak', effects: { kenyang: 4 }, xp: 3, reward_item: 'roti', cooldown_sec: 1800, daily_limit: 3, message: '{pet} memasak di {item}.' },
  { id: 'berendam', name: 'Berendam', targets: ['art:bakmandi'], anim: 'mandi', effects: { bersih: 45, ceria: 4 }, xp: 2, cooldown_sec: 600, message: '{pet} berendam sampai wangi.' },
  { id: 'berteduh', name: 'Berteduh', targets: ['art:pohon', 'art:payung'], anim: 'lihat', effects: { energi: 4, ceria: 4 }, xp: 1, cooldown_sec: 300, message: '{pet} berteduh di bawah {item}.' },
];

export async function seedPackV4(db: Db) {
  const row = await db.one<{ value: any }>(`select value from settings where key = 'content_pack'`);
  if (Number(row?.value ?? 1) >= 4) return false;
  await db.query(
    `insert into locations (id, name, kind, x, y, style, sort) values ('bangunan', 'Toko Bangunan', 'shop', 880, 384, '{"body":"#F4E1B0","roof":"#C0603A","w":104}'::jsonb, 11) on conflict (id) do nothing`,
  );
  let sort = (await db.one<{ m: number }>('select coalesce(max(sort), 0)::int m from items'))!.m;
  for (const it of SEED_ITEMS_V4) {
    await db.query(
      `insert into items (id, kind, name, description, price_coin, price_pearl, sell_coin, shop, art, data, sort)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::text::jsonb,$10::text::jsonb,$11) on conflict (id) do nothing`,
      [it.id, it.kind, it.name, it.description ?? '', it.price_coin ?? 0, it.price_pearl ?? 0, it.sell_coin ?? 0, it.shop ?? null, JSON.stringify(it.art), JSON.stringify(it.data ?? {}), (sort += 10)],
    );
  }
  let asort = 0;
  for (const a of SEED_ACTIVITIES) {
    await db.query(
      `insert into activities (id, name, targets, anim, effects, xp, coins, reward_item, cooldown_sec, daily_limit, message, sort)
       values ($1,$2,$3::text::jsonb,$4,$5::text::jsonb,$6,$7,$8,$9,$10,$11,$12) on conflict (id) do nothing`,
      [a.id, a.name, JSON.stringify(a.targets), a.anim, JSON.stringify(a.effects), a.xp ?? 0, (a as any).coins ?? 0, (a as any).reward_item ?? null, a.cooldown_sec, (a as any).daily_limit ?? 0, a.message, (asort += 10)],
    );
  }
  await db.query(
    `insert into quests (id, kind, title, description, event, filter, target, reward_coin, reward_xp, url, sort)
     values ('h-aktivitas', 'daily', 'Betah di rumah', 'Lakukan 2 aktivitas di rumah (ketuk mebel, jendela, atau lukisan).', 'activity', '{}'::jsonb, 2, 20, 4, '/', 130) on conflict (id) do nothing`,
  ).catch(() => {});
  await db.query(`insert into settings (key, value) values ('content_pack', '4'::jsonb) on conflict (key) do update set value = excluded.value`);
  return true;
}

// Paket konten v5: Warung Jamu (pet sakit), olahraga (berat badan), lencana, tugas harian baru.
export const SEED_ITEMS_V5: SeedItem[] = [
  { id: 'jamu-kunyit', kind: 'food', name: 'Jamu Kunyit Asam', description: 'Menyembuhkan pet yang sakit. Segar!', price_coin: 15, sell_coin: 5, shop: 'jamu', art: b('gelas', { main: '#F2B632', accent: '#E9A23B' }), data: { effects: { ceria: 6, kenyang: 4 }, cure: true } },
  { id: 'jamu-beras-kencur', kind: 'food', name: 'Jamu Beras Kencur', description: 'Menyembuhkan sakit dan menambah tenaga.', price_coin: 18, sell_coin: 6, shop: 'jamu', art: b('gelas', { main: '#F4EEE2', accent: '#E3D3A8' }), data: { effects: { energi: 15 }, cure: true } },
  { id: 'wedang-jahe', kind: 'food', name: 'Wedang Jahe', description: 'Hangat di badan, mengusir masuk angin.', price_coin: 12, sell_coin: 4, shop: 'jamu', art: b('mangkuk', { main: '#C98A4B', accent: '#FFFDF7' }), data: { effects: { ceria: 8, energi: 5 }, cure: true } },
  { id: 'jamu-temulawak', kind: 'food', name: 'Jamu Temulawak', description: 'Menyembuhkan dan bikin nafsu makan.', price_coin: 20, sell_coin: 7, shop: 'jamu', art: b('gelas', { main: '#E07A2F', accent: '#B85A1F' }), data: { effects: { kenyang: 12 }, cure: true } },
  { id: 'sepeda-statis', kind: 'furniture', name: 'Sepeda Statis', description: 'Gowes di rumah supaya tidak gembul.', price_coin: 200, sell_coin: 80, shop: 'mebel', art: b('sepeda'), data: { w: 1, d: 1 } },
  { id: 'matras-senam', kind: 'furniture', name: 'Matras Senam', description: 'Tempat lompat tali. Bisa dilewati.', price_coin: 70, sell_coin: 28, shop: 'mebel', art: b('matras'), data: { w: 2, d: 1, flat: true } },
];

export const SEED_ACTIVITIES_V5 = [
  { id: 'bersepeda', name: 'Gowes', targets: ['art:sepeda'], anim: 'gowes', effects: { energi: -12, ceria: 6, berat: -8 }, xp: 3, cooldown_sec: 600, message: '{pet} gowes sampai berkeringat.' },
  { id: 'lompat-tali', name: 'Lompat tali', targets: ['art:matras'], anim: 'olahraga', effects: { energi: -10, ceria: 8, berat: -6 }, xp: 3, cooldown_sec: 600, message: '{pet} lompat tali seratus kali!' },
];

export const SEED_BADGES = [
  { id: 'b-tidur', title: 'Tukang Tidur', description: 'Tidurkan pet dengan lampu mati sampai bangun, 10 kali.', event: 'sleep', filter: {}, target: 10, reward_coin: 60, reward_pearl: 0, reward_xp: 10 },
  { id: 'b-mandi', title: 'Wangi Selalu', description: 'Mandikan pet 25 kali.', event: 'action', filter: { type: 'mandi' }, target: 25, reward_coin: 60, reward_pearl: 0, reward_xp: 10 },
  { id: 'b-makan', title: 'Doyan Makan', description: 'Beri makan pet 50 kali.', event: 'action', filter: { type: 'makan' }, target: 50, reward_coin: 80, reward_pearl: 0, reward_xp: 10 },
  { id: 'b-koki', title: 'Koki Kampung', description: 'Masak di kompor 10 kali.', event: 'activity', filter: { id: 'masak-roti' }, target: 10, reward_coin: 80, reward_pearl: 0, reward_xp: 10 },
  { id: 'b-atlet', title: 'Atlet Kampung', description: 'Olahraga 15 kali (gowes atau lompat tali).', event: 'exercise', filter: {}, target: 15, reward_coin: 100, reward_pearl: 0, reward_xp: 15 },
  { id: 'b-sapu', title: 'Rajin Menyapu', description: 'Sapu 30 remah atau bulu rontok.', event: 'sweep', filter: {}, target: 30, reward_coin: 60, reward_pearl: 0, reward_xp: 10 },
  { id: 'b-sehat', title: 'Dokter Kecil', description: 'Sembuhkan pet yang sakit dengan jamu, 3 kali.', event: 'cure', filter: {}, target: 3, reward_coin: 50, reward_pearl: 0, reward_xp: 10 },
  { id: 'b-rumah', title: 'Juragan Rumah', description: 'Bangun 3 ruangan baru.', event: 'purchase', filter: { kind: 'room' }, target: 3, reward_coin: 0, reward_pearl: 2, reward_xp: 20 },
  { id: 'b-teman', title: 'Ramah Tamah', description: 'Kunjungi rumah teman 20 kali.', event: 'visit', filter: {}, target: 20, reward_coin: 80, reward_pearl: 0, reward_xp: 15 },
  { id: 'b-jempol', title: 'Pemberi Jempol', description: 'Sukai rumah teman 10 kali.', event: 'like', filter: {}, target: 10, reward_coin: 50, reward_pearl: 0, reward_xp: 10 },
  { id: 'b-favorit', title: 'Rumah Idaman', description: 'Rumahmu disukai teman 25 kali.', event: 'liked', filter: {}, target: 25, reward_coin: 0, reward_pearl: 2, reward_xp: 20 },
  { id: 'b-pemain', title: 'Jago Balai Main', description: 'Selesaikan 30 mini-game di Balai Main.', event: 'game_finish', filter: {}, target: 30, reward_coin: 100, reward_pearl: 0, reward_xp: 15 },
  { id: 'b-panen', title: 'Petani Ulet', description: 'Panen kebun 30 kali.', event: 'harvest', filter: {}, target: 30, reward_coin: 80, reward_pearl: 0, reward_xp: 15 },
  { id: 'b-pancing', title: 'Raja Kolam', description: 'Tangkap 40 ikan.', event: 'fish', filter: {}, target: 40, reward_coin: 80, reward_pearl: 0, reward_xp: 15 },
  { id: 'b-pinang', title: 'Juara Pinang', description: 'Sampai ke puncak Panjat Pinang.', event: 'pinang_top', filter: {}, target: 1, reward_coin: 0, reward_pearl: 3, reward_xp: 20 },
];

export async function seedPackV5(db: Db) {
  const row = await db.one<{ value: any }>(`select value from settings where key = 'content_pack'`);
  if (Number(row?.value ?? 1) >= 5) return false;
  await db.query(
    `insert into locations (id, name, kind, x, y, style, sort) values ('jamu', 'Warung Jamu', 'shop', 1010, 205, '{"body":"#FFF0C2","roof":"#2F7F55","w":100}'::jsonb, 12) on conflict (id) do nothing`,
  );
  let sort = (await db.one<{ m: number }>('select coalesce(max(sort), 0)::int m from items'))!.m;
  for (const it of SEED_ITEMS_V5) {
    await db.query(
      `insert into items (id, kind, name, description, price_coin, price_pearl, sell_coin, shop, art, data, sort)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::text::jsonb,$10::text::jsonb,$11) on conflict (id) do nothing`,
      [it.id, it.kind, it.name, it.description ?? '', it.price_coin ?? 0, it.price_pearl ?? 0, it.sell_coin ?? 0, it.shop ?? null, JSON.stringify(it.art), JSON.stringify(it.data ?? {}), (sort += 10)],
    );
  }
  let asort = 200;
  for (const a of SEED_ACTIVITIES_V5) {
    await db.query(
      `insert into activities (id, name, targets, anim, effects, xp, cooldown_sec, message, sort)
       values ($1,$2,$3::text::jsonb,$4,$5::text::jsonb,$6,$7,$8,$9) on conflict (id) do nothing`,
      [a.id, a.name, JSON.stringify(a.targets), a.anim, JSON.stringify(a.effects), a.xp, a.cooldown_sec, a.message, (asort += 10)],
    );
  }
  // tidur sungguhan kini lewat lampu: aktivitas kasur bawaan jadi "Rebahan" sebentar (bila belum diubah admin)
  await db.query(
    `update activities set name = 'Rebahan', effects = '{"energi":15}'::jsonb, cooldown_sec = 600, message = '{pet} rebahan sebentar di {item}.'
      where id = 'tidur-kasur' and name = 'Tidur' and effects = '{"energi":35}'::jsonb`,
  );
  let qsort = 500;
  for (const q of SEED_BADGES) {
    await db.query(
      `insert into quests (id, kind, title, description, event, filter, target, reward_coin, reward_pearl, reward_xp, url, sort)
       values ($1, 'badge', $2, $3, $4, $5::text::jsonb, $6, $7, $8, $9, '/', $10) on conflict (id) do nothing`,
      [q.id, q.title, q.description, q.event, JSON.stringify(q.filter), q.target, q.reward_coin, q.reward_pearl, q.reward_xp, (qsort += 10)],
    );
  }
  for (const [id, title, desc, event, filter, target, coin] of [
    ['h-sapu', 'Lantai kinclong', 'Sapu 2 remah atau bulu rontok di lantai rumah.', 'sweep', {}, 2, 15],
    ['h-tidur', 'Tidur nyenyak', 'Tidurkan pet dengan lampu mati sampai bangun.', 'sleep', {}, 1, 20],
    ['h-balai', 'Main di Balai', 'Selesaikan 2 mini-game di Balai Main.', 'game_finish', {}, 2, 20],
  ] as const) {
    await db.query(
      `insert into quests (id, kind, title, description, event, filter, target, reward_coin, reward_xp, url, sort)
       values ($1, 'daily', $2, $3, $4, $5::text::jsonb, $6, $7, 4, '/', 140) on conflict (id) do nothing`,
      [id, title, desc, event, JSON.stringify(filter), target, coin],
    ).catch(() => {});
  }
  await db.query(`insert into settings (key, value) values ('content_pack', '5'::jsonb) on conflict (key) do update set value = excluded.value`);
  return true;
}

// Paket konten v6: duel dengan teman (lencana & tugas harian).
export async function seedPackV6(db: Db) {
  const row = await db.one<{ value: any }>(`select value from settings where key = 'content_pack'`);
  if (Number(row?.value ?? 1) >= 6) return false;
  await db.query(
    `insert into quests (id, kind, title, description, event, filter, target, reward_coin, reward_pearl, reward_xp, url, sort)
     values ('b-duel', 'badge', 'Jagoan Duel', 'Menang duel melawan teman 10 kali.', 'duel_win', '{}'::jsonb, 10, 0, 2, 20, '/#duels', 660) on conflict (id) do nothing`,
  );
  await db.query(
    `insert into quests (id, kind, title, description, event, filter, target, reward_coin, reward_xp, url, sort)
     values ('h-duel', 'daily', 'Adu seru', 'Selesaikan 1 duel dengan teman (main bareng atau balas tantangan).', 'duel', '{}'::jsonb, 1, 20, 4, '/#duels', 150) on conflict (id) do nothing`,
  ).catch(() => {});
  await db.query(`insert into settings (key, value) values ('content_pack', '6'::jsonb) on conflict (key) do update set value = excluded.value`);
  return true;
}

/** Paket konten v7: kunjungan bareng (tugas harian & lencana main di rumah teman, masak bareng, foto bareng). */
/** v8: Alun-alun di peta kampung + tugas & lencana. */
// Paket konten v9: set item premium (Mutiara) — Taman Malam, Keraton, Kafe Kopi Kampung, Pantai, Kamar Bintang.
const P = (id: string, kind: SeedItem['kind'], name: string, description: string, price: number, key: string, set: string, data: Record<string, unknown> = {}): SeedItem =>
  ({ id, kind, name, description, price_pearl: price, shop: 'mutiara', art: b(key), data: { ...data, set } });
export const SEED_ITEMS_V9: SeedItem[] = [
  P('tm-kolamkoi', 'furniture', 'Kolam Koi Bercahaya', 'Kolam batu dengan ikan koi yang berenang dan cahaya lembut di malam hari.', 20, 'kolamkoi', 'tamanmalam', { w: 2, d: 2 }),
  P('tm-pohonlampu', 'furniture', 'Pohon Lampu Kelip', 'Pohon rindang berhias lampu warna-warni yang berkelip.', 8, 'pohonlampu', 'tamanmalam', { w: 1, d: 1 }),
  P('tm-lenterastupa', 'furniture', 'Lentera Stupa', 'Lentera batu berbentuk stupa dengan cahaya hangat.', 4, 'lenterastupa', 'tamanmalam', { w: 1, d: 1 }),
  P('tm-jembatan', 'furniture', 'Jembatan Kayu', 'Jembatan kayu merah melengkung, enak untuk duduk-duduk.', 10, 'jembatan', 'tamanmalam', { w: 2, d: 1 }),
  P('tm-topleskunang', 'furniture', 'Toples Kunang-kunang', 'Kunang-kunang yang menyala di dalam toples kaca.', 5, 'topleskunang', 'tamanmalam', { w: 1, d: 1 }),
  P('fl-batutaman', 'floor', 'Lantai Batu Taman', 'Rumput dengan batu pijakan, cocok untuk halaman.', 6, 'batutaman', 'tamanmalam'),
  P('kr-gamelan', 'furniture', 'Gamelan Mini', 'Saron kecil berukir emas. Pet bisa memainkannya.', 18, 'gamelan', 'keraton', { w: 2, d: 1 }),
  P('kr-kursiraja', 'furniture', 'Kursi Raja Ukir', 'Kursi kayu berukir dengan bantal beludru merah.', 10, 'kursiraja', 'keraton', { w: 1, d: 1 }),
  P('kr-gebyok', 'furniture', 'Sekat Gebyok Ukir', 'Sekat kayu berukir motif kawung dengan mahkota emas.', 12, 'gebyok', 'keraton', { w: 2, d: 1 }),
  P('kr-lampukuningan', 'furniture', 'Lampu Kuningan', 'Lampu berdiri dari kuningan dengan cahaya hangat.', 6, 'lampukuningan', 'keraton', { w: 1, d: 1 }),
  P('kr-karpetparang', 'furniture', 'Karpet Batik Parang', 'Karpet bermotif parang, 2×2.', 8, 'karpetparang', 'keraton', { w: 2, d: 2, flat: true }),
  P('wp-kawung', 'wallpaper', 'Dinding Batik Kawung', 'Dinding bermotif batik kawung.', 8, 'kawung', 'keraton'),
  P('kf-mesinkopi', 'furniture', 'Mesin Kopi', 'Mesin kopi di atas lemari. Pet bisa bikin kopi.', 15, 'mesinkopi', 'kafe', { w: 1, d: 1 }),
  P('kf-mejabar', 'furniture', 'Meja Bar Kayu', 'Meja bar tinggi lengkap dengan cangkir dan toples kue.', 8, 'mejabar', 'kafe', { w: 2, d: 1 }),
  P('kf-raktoples', 'furniture', 'Rak Toples Kerupuk', 'Rak berisi toples kerupuk warna-warni.', 6, 'raktoples', 'kafe', { w: 1, d: 1 }),
  P('kf-papanmenu', 'furniture', 'Papan Menu Kapur', 'Papan tulis kapur berisi menu hari ini.', 4, 'papanmenu', 'kafe', { w: 1, d: 1 }),
  P('kf-lampuedison', 'furniture', 'Lampu Edison', 'Tiang lampu dengan bohlam edison yang berpendar.', 5, 'lampuedison', 'kafe', { w: 1, d: 1 }),
  P('fl-terasoemas', 'floor', 'Lantai Teraso Emas', 'Lantai teraso krem berbintik emas.', 8, 'terasoemas', 'kafe'),
  P('pt-hammock', 'furniture', 'Hammock', 'Ayunan jaring untuk tidur siang. Berayun pelan.', 15, 'hammock', 'pantai', { w: 2, d: 1 }),
  P('pt-kursipantai', 'furniture', 'Kursi Pantai', 'Kursi lipat bergaris untuk bersantai.', 6, 'kursipantai', 'pantai', { w: 1, d: 1 }),
  P('pt-papanselancar', 'furniture', 'Papan Selancar', 'Papan selancar biru untuk hiasan.', 5, 'papanselancar', 'pantai', { w: 1, d: 1 }),
  P('pt-oborbambu', 'furniture', 'Obor Bambu', 'Obor bambu dengan api yang menari.', 4, 'oborbambu', 'pantai', { w: 1, d: 1 }),
  P('pt-akuariumombak', 'furniture', 'Akuarium Ombak', 'Akuarium lebar dengan ombak, karang, dan ikan.', 12, 'akuariumombak', 'pantai', { w: 2, d: 1 }),
  P('fl-pasir', 'floor', 'Lantai Pasir Pantai', 'Pasir pantai dengan kerang kecil.', 6, 'pasir', 'pantai'),
  P('kb-kasurroket', 'furniture', 'Kasur Roket', 'Kasur berbentuk roket untuk penjelajah angkasa.', 15, 'kasurroket', 'bintang', { w: 2, d: 1 }),
  P('kb-proyektor', 'furniture', 'Proyektor Bintang', 'Lampu tidur yang memancarkan bintang berkelip.', 12, 'proyektorbintang', 'bintang', { w: 1, d: 1 }),
  P('kb-tenda', 'furniture', 'Tenda Kemah', 'Tenda kemah dengan bendera dan umbul-umbul kecil.', 10, 'tendakemah', 'bintang', { w: 2, d: 2 }),
  P('kb-karpetawan', 'furniture', 'Karpet Awan', 'Karpet empuk berbentuk awan, 2×2.', 6, 'karpetawan', 'bintang', { w: 2, d: 2, flat: true }),
  P('kb-rakpelangi', 'furniture', 'Rak Buku Pelangi', 'Rak buku dengan buku warna-warni dan pelangi di atasnya.', 8, 'rakpelangi', 'bintang', { w: 1, d: 1 }),
  P('wp-langit', 'wallpaper', 'Dinding Langit Malam', 'Dinding biru malam dengan bulan dan bintang berkelip.', 10, 'langit', 'bintang'),
];
export const SEED_ACTIVITIES_V9 = [
  { id: 'kasih-makan-koi', name: 'Kasih makan koi', targets: ['art:kolamkoi'], anim: 'lihat', effects: { ceria: 10 }, xp: 3, cooldown_sec: 900, message: '{pet} memberi makan ikan koi. Ikannya berebut!' },
  { id: 'duduk-jembatan', name: 'Duduk di jembatan', targets: ['art:jembatan'], anim: 'duduk', effects: { ceria: 6, energi: 4 }, xp: 1, cooldown_sec: 300, message: '{pet} duduk di jembatan sambil melihat kunang-kunang.' },
  { id: 'main-gamelan', name: 'Main gamelan', targets: ['art:gamelan'], anim: 'musik', effects: { ceria: 12, energi: -4 }, xp: 3, cooldown_sec: 900, message: '{pet} memainkan gamelan. Ning-nong-ning-gung!' },
  { id: 'duduk-raja', name: 'Duduk bak raja', targets: ['art:kursiraja'], anim: 'duduk', effects: { ceria: 8, energi: 4 }, xp: 1, cooldown_sec: 300, message: '{pet} duduk di kursi raja. Gagah sekali!' },
  { id: 'bikin-kopi', name: 'Bikin kopi', targets: ['art:mesinkopi'], anim: 'kopi', effects: { ceria: 10, energi: 8 }, xp: 3, cooldown_sec: 1200, daily_limit: 4, message: '{pet} bikin kopi tubruk. Harumnya sampai ke tetangga!' },
  { id: 'tidur-hammock', name: 'Tidur siang', targets: ['art:hammock'], anim: 'tidur', effects: { energi: 15, ceria: 6 }, xp: 2, cooldown_sec: 900, message: '{pet} tidur siang di hammock, berayun pelan.' },
  { id: 'duduk-pantai', name: 'Santai di kursi pantai', targets: ['art:kursipantai'], anim: 'duduk', effects: { ceria: 6, energi: 6 }, xp: 1, cooldown_sec: 300, message: '{pet} bersantai di kursi pantai.' },
  { id: 'lihat-ombak', name: 'Lihat ombak', targets: ['art:akuariumombak'], anim: 'lihat', effects: { ceria: 8 }, xp: 1, cooldown_sec: 300, message: '{pet} melihat ombak dan ikan di akuarium.' },
  { id: 'tidur-roket', name: 'Rebahan di roket', targets: ['art:kasurroket'], anim: 'tidur', effects: { energi: 15 }, xp: 2, cooldown_sec: 600, message: '{pet} rebahan di kasur roket. Meluncur ke alam mimpi!' },
  { id: 'lihat-bintang', name: 'Lihat bintang', targets: ['art:proyektorbintang'], anim: 'lihat', effects: { ceria: 8, energi: 3 }, xp: 2, cooldown_sec: 300, message: '{pet} menghitung bintang dari proyektor.' },
  { id: 'main-kemah', name: 'Main kemah-kemahan', targets: ['art:tendakemah'], anim: 'lihat', effects: { ceria: 10, energi: -3 }, xp: 2, cooldown_sec: 600, message: '{pet} ngumpet di tenda. Ssst!' },
  { id: 'baca-pelangi', name: 'Baca buku', targets: ['art:rakpelangi'], anim: 'baca', effects: { ceria: 8 }, xp: 3, cooldown_sec: 300, message: '{pet} membaca buku cerita angkasa.' },
];

export async function seedPackV9(db: Db) {
  const row = await db.one<{ value: any }>(`select value from settings where key = 'content_pack'`);
  if (Number(row?.value ?? 1) >= 9) return false;
  let sort = (await db.one<{ m: number }>('select coalesce(max(sort), 0)::int m from items'))!.m;
  for (const it of SEED_ITEMS_V9) {
    await db.query(
      `insert into items (id, kind, name, description, price_coin, price_pearl, sell_coin, shop, art, data, sort)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::text::jsonb,$10::text::jsonb,$11) on conflict (id) do nothing`,
      [it.id, it.kind, it.name, it.description ?? '', it.price_coin ?? 0, it.price_pearl ?? 0, it.sell_coin ?? 0, it.shop ?? null, JSON.stringify(it.art), JSON.stringify(it.data ?? {}), (sort += 10)],
    );
  }
  let asort = (await db.one<{ m: number }>('select coalesce(max(sort), 0)::int m from activities'))!.m;
  for (const a of SEED_ACTIVITIES_V9) {
    await db.query(
      `insert into activities (id, name, targets, anim, effects, xp, cooldown_sec, daily_limit, message, sort)
       values ($1,$2,$3::text::jsonb,$4,$5::text::jsonb,$6,$7,$8,$9,$10) on conflict (id) do nothing`,
      [a.id, a.name, JSON.stringify(a.targets), a.anim, JSON.stringify(a.effects), a.xp, a.cooldown_sec, (a as any).daily_limit ?? 0, a.message, (asort += 10)],
    );
  }
  await db.query(`insert into settings (key, value) values ('content_pack', '9'::jsonb) on conflict (key) do update set value = excluded.value`);
  return true;
}

export async function seedPackV8(db: Db) {
  const row = await db.one<{ value: any }>(`select value from settings where key = 'content_pack'`);
  if (Number(row?.value ?? 1) >= 8) return false;
  await db.query(
    `insert into locations (id, name, kind, x, y, style, sort) values ('alun', 'Alun-alun', 'square', 1150, 412, '{}'::jsonb, 13) on conflict (id) do nothing`,
  );
  const q = (id: string, kind: string, title: string, desc: string, event: string, filter: object, target: number, coin: number, pearl: number, xp: number, url: string, sort: number) =>
    db.query(
      `insert into quests (id, kind, title, description, event, filter, target, reward_coin, reward_pearl, reward_xp, url, sort)
       values ($1,$2,$3,$4,$5,$6::text::jsonb,$7,$8,$9,$10,$11,$12) on conflict (id) do nothing`,
      [id, kind, title, desc, event, JSON.stringify(filter), target, coin, pearl, xp, url, sort],
    ).catch(() => {});
  await q('h-alun', 'daily', 'Jalan-jalan ke Alun-alun', 'Main 3 kali di Alun-alun: nonton, naik komidi putar, ayunan, joget, ...', 'square_act', {}, 3, 20, 0, 4, '/#alun', 157);
  await q('b-alun', 'badge', 'Anak Alun-alun', 'Main 30 kali di Alun-alun.', 'square_act', {}, 30, 0, 2, 20, '/#alun', 700);
  await q('b-joget', 'badge', 'Raja Joget', 'Joget bareng di depan panggung 15 kali.', 'square_act', { kind: 'joget' }, 15, 0, 2, 20, '/#alun', 710);
  await db.query(`insert into settings (key, value) values ('content_pack', '8'::jsonb) on conflict (key) do update set value = excluded.value`);
  return true;
}

export async function seedPackV7(db: Db) {
  const row = await db.one<{ value: any }>(`select value from settings where key = 'content_pack'`);
  if (Number(row?.value ?? 1) >= 7) return false;
  const q = (id: string, kind: string, title: string, desc: string, event: string, filter: object, target: number, coin: number, pearl: number, xp: number, url: string, sort: number) =>
    db.query(
      `insert into quests (id, kind, title, description, event, filter, target, reward_coin, reward_pearl, reward_xp, url, sort)
       values ($1,$2,$3,$4,$5,$6::text::jsonb,$7,$8,$9,$10,$11,$12) on conflict (id) do nothing`,
      [id, kind, title, desc, event, JSON.stringify(filter), target, coin, pearl, xp, url, sort],
    ).catch(() => {});
  await q('h-tamu', 'daily', 'Main ke rumah teman', 'Berkunjung dan main 2 kali dengan pet teman (sapa, peluk, kasih camilan, ...).', 'visit_play', {}, 2, 20, 0, 4, '/#friends', 155);
  await q('b-tetangga', 'badge', 'Tetangga Akrab', 'Main dengan pet teman saat berkunjung 20 kali.', 'visit_play', {}, 20, 0, 2, 20, '/#friends', 670);
  await q('b-koki', 'badge', 'Koki Kampung', 'Berhasil Masak bareng 5 kali.', 'coop', { game: 'masak' }, 5, 0, 2, 20, '/#friends', 680);
  await q('b-foto', 'badge', 'Kenangan Bareng', 'Ambil 10 foto bareng di rumah teman.', 'photo', {}, 10, 0, 2, 20, '/#album', 690);
  await db.query(`insert into settings (key, value) values ('content_pack', '7'::jsonb) on conflict (key) do update set value = excluded.value`);
  return true;
}
