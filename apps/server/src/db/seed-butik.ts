// Paket konten 12 (v0.32 Butik Benang): slot baru "Baju" (body) + aksesori tambahan untuk slot lama.
// Harga jual ±40% harga beli. Item Mutiara hanya dijual di Toko Mutiara.
// data.outfit = nama set padu-padan (hanya label di kartu toko, tanpa bonus).
import type { Db } from './index';

type SeedItem = {
  id: string; kind: 'wear'; name: string; description: string;
  price_coin?: number; price_pearl?: number; sell_coin?: number; shop: 'butik' | 'mutiara';
  art: any; data: { slot: string; outfit?: string };
};

const b = (key: string, colors?: Record<string, string>) => ({ type: 'builtin', key, ...(colors ? { colors } : {}) });
const sell = (p: number) => Math.round(p * 0.4);
const SET = { koki: 'Koki Cilik', silat: 'Pendekar Silat', tidur: 'Tidur Nyenyak', kondangan: 'Kondangan', petani: 'Petani Kebun', pantai: 'Liburan Pantai', lebaran: 'Hari Raya', suporter: 'Suporter 17-an', jelajah: 'Penjelajah', panggung: 'Bintang Panggung', dino: 'Dino Kecil', raja: 'Raja Sehari' } as const;
type SetKey = keyof typeof SET;

function w(id: string, name: string, slot: string, art: any, price: { coin?: number; pearl?: number }, description: string, set?: SetKey): SeedItem {
  const data = { slot, ...(set ? { outfit: SET[set] } : {}) };
  return price.coin
    ? { id, kind: 'wear', name, description, price_coin: price.coin, sell_coin: sell(price.coin), shop: 'butik', art, data }
    : { id, kind: 'wear', name, description, price_pearl: price.pearl, shop: 'mutiara', art, data };
}
const baju = (id: string, name: string, art: any, price: { coin?: number; pearl?: number }, description: string, set?: SetKey) => w(id, name, 'body', art, price, description, set);

/** 28 baju: 25 koin di Butik Benang, 3 premium di Toko Mutiara. */
export const SEED_ITEMS_BAJU: SeedItem[] = [
  baju('kaos-merah', 'Kaos Polos Merah', b('kaos', { main: '#E0583F' }), { coin: 40 }, 'Kaos katun adem untuk main seharian.'),
  baju('kaos-kuning', 'Kaos Polos Kuning', b('kaos', { main: '#F2C230' }), { coin: 40 }, 'Kuning cerah seperti pisang goreng.'),
  baju('kaos-biru', 'Kaos Polos Biru', b('kaos', { main: '#3F7FBF' }), { coin: 40 }, 'Biru langit kampung.'),
  baju('kaos-hijau', 'Kaos Polos Hijau', b('kaos', { main: '#3FA06A' }), { coin: 40 }, 'Hijau daun pandan.'),
  baju('kaos-garis', 'Kaos Garis Pelaut', b('kaosgaris'), { coin: 55 }, 'Belang biru-putih, siap berlayar.'),
  baju('daster-bunga', 'Daster Bunga', b('daster'), { coin: 60 }, 'Daster longgar bermotif bunga. Paling nyaman di rumah.'),
  baju('celemek-koki', 'Celemek Koki', b('celemek'), { coin: 50 }, 'Saku kotak-kotak untuk menyimpan resep.', 'koki'),
  baju('piyama-bintang', 'Piyama Bintang', b('piyama'), { coin: 70 }, 'Bertabur bintang, bikin cepat ngantuk.', 'tidur'),
  baju('sarung-kotak', 'Sarung Kotak-kotak', b('sarung'), { coin: 70 }, 'Dikemulkan biar hangat waktu ronda malam.'),
  baju('rompi-rajut', 'Rompi Rajut', b('rompi'), { coin: 80 }, 'Rompi rajut motif wajik di atas kemeja putih.'),
  baju('baju-lurik', 'Baju Lurik', b('lurik'), { coin: 85 }, 'Kain lurik bergaris tenunan tangan.'),
  baju('jersey-merahputih', 'Jersey Merah Putih', b('jersey'), { coin: 85 }, 'Nomor punggung 17, untuk lomba Agustusan.', 'suporter'),
  baju('kemeja-pantai', 'Kemeja Pantai', b('pantai'), { coin: 85 }, 'Bunga sepatu dan daun, wangi angin laut.', 'pantai'),
  baju('baju-koko', 'Baju Koko', b('koko'), { coin: 90 }, 'Koko putih berbordir hijau.', 'lebaran'),
  baju('seragam-jelajah', 'Seragam Penjelajah', b('seragam'), { coin: 90 }, 'Dua saku, siap berkemah di Kebun.', 'jelajah'),
  baju('kemeja-flanel', 'Kemeja Flanel', b('flanel'), { coin: 95 }, 'Kotak-kotak merah, hangat waktu hujan.'),
  baju('overall-jeans', 'Overall Jeans', b('overall'), { coin: 100 }, 'Celana kodok jins, cocok untuk berkebun.', 'petani'),
  baju('baju-silat', 'Baju Silat', b('silat'), { coin: 100 }, 'Baju hitam longgar dengan sabuk merah.', 'silat'),
  baju('hoodie-abu', 'Hoodie Abu-abu', b('hoodie'), { coin: 110 }, 'Bertudung, bertali, bersaku kanguru.'),
  baju('batik-parang', 'Kemeja Batik Parang', b('batikparang'), { coin: 120 }, 'Motif parang cokelat-emas.'),
  baju('batik-kawung', 'Kemeja Batik Kawung', b('batikkawung'), { coin: 120 }, 'Motif kawung, bulat-bulat rapi.'),
  baju('batik-megamendung', 'Kemeja Batik Mega Mendung', b('batikmega'), { coin: 140 }, 'Awan berlapis biru dari pesisir.'),
  baju('jaket-varsity', 'Jaket Varsity', b('varsity'), { coin: 160 }, 'Lengan krem dan huruf B untuk Bupi.'),
  baju('kebaya-kutubaru', 'Kebaya Kutu Baru', b('kebaya'), { coin: 200 }, 'Kebaya renda dengan bros dan kain jarik.', 'kondangan'),
  baju('beskap-jarik', 'Beskap & Jarik', b('beskap'), { coin: 200 }, 'Beskap gelap berkancing emas dan kain jarik.', 'kondangan'),
  baju('kostum-dino', 'Kostum Dino', b('dino'), { pearl: 6 }, 'Lengkap dengan duri dan ekor. Rawr!', 'dino'),
  baju('jaket-payet', 'Jaket Payet Panggung', b('payet'), { pearl: 5 }, 'Berkilau di bawah lampu panggung.', 'panggung'),
  baju('baju-songket', 'Baju Songket Emas', b('songket'), { pearl: 8 }, 'Tenun songket merah dengan kalung susun emas.', 'raja'),
];

/** 12 aksesori tambahan untuk slot lama (Kepala, Wajah, Leher, Dibawa). */
export const SEED_ITEMS_AKSESORI: SeedItem[] = [
  w('kopiah-putih', 'Kopiah Rajut Putih', 'head', b('kopiah'), { coin: 40 }, 'Kopiah rajut putih yang adem.', 'lebaran'),
  w('konde-melati', 'Konde Melati', 'head', b('konde'), { coin: 55 }, 'Sanggul kecil berhias untaian melati.', 'kondangan'),
  w('topi-pet', 'Topi Pet Kuning', 'head', b('topipet'), { coin: 35 }, 'Topi berlidah untuk hari terik.'),
  w('ikat-merahputih', 'Ikat Kepala Merah Putih', 'head', b('ikatmp'), { coin: 20 }, 'Semangat lomba tujuh belasan!', 'suporter'),
  w('tudung-dino', 'Tudung Dino', 'head', b('tudungdino'), { pearl: 3 }, 'Tudung berduri dengan mata bulat.', 'dino'),
  w('plester-lucu', 'Plester Lucu', 'face', b('plester'), { coin: 15 }, 'Habis jatuh dari sepeda, tetap ceria.'),
  w('kacu-merahputih', 'Kacu Merah Putih', 'neck', b('kacu'), { coin: 25 }, 'Setangan leher dengan cincin kayu.', 'jelajah'),
  w('kalung-mutiara', 'Kalung Mutiara', 'neck', b('kalungmutiara'), { pearl: 4 }, 'Untaian mutiara dengan liontin ungu.'),
  w('kipas-batik', 'Kipas Batik', 'hand', b('kipas'), { coin: 30 }, 'Kipas lipat bermotif parang.', 'kondangan'),
  w('sutil-kayu', 'Sutil Kayu', 'hand', b('sutil'), { coin: 25 }, 'Untuk membalik tempe di wajan.', 'koki'),
  w('mikrofon', 'Mikrofon Panggung', 'hand', b('mikrofon'), { coin: 45 }, 'Satu, dua, tiga, dicoba!', 'panggung'),
  w('raket', 'Raket Bulu Tangkis', 'hand', b('raket'), { coin: 45 }, 'Smes! Siap tanding di Alun-alun.'),
];

export const SEED_ITEMS_V12: SeedItem[] = [...SEED_ITEMS_BAJU, ...SEED_ITEMS_AKSESORI];

/** Topi lama yang melengkapi set baju baru (label saja; tidak menimpa set yang sudah diatur admin). */
const OUTFIT_OF_EXISTING: Record<string, SetKey> = { 'topi-koki': 'koki', udeng: 'silat', 'kupluk-biru': 'tidur', blangkon: 'kondangan', 'topi-caping': 'petani' };

export async function seedPackV12(db: Db) {
  // penanda sendiri per paket (bukan hanya angka content_pack), jadi urutan rilis paket 11–14 tidak saling melewatkan
  if (await db.one(`select 1 from settings where key = 'pack_butik'`)) return false;
  let sort = (await db.one<{ m: number }>('select coalesce(max(sort), 0)::int m from items'))!.m;
  for (const it of SEED_ITEMS_V12) {
    await db.query(
      `insert into items (id, kind, name, description, price_coin, price_pearl, sell_coin, shop, art, data, sort)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::text::jsonb,$10::text::jsonb,$11) on conflict (id) do nothing`,
      [it.id, it.kind, it.name, it.description, it.price_coin ?? 0, it.price_pearl ?? 0, it.sell_coin ?? 0, it.shop, JSON.stringify(it.art), JSON.stringify(it.data), (sort += 10)],
    );
  }
  for (const [id, set] of Object.entries(OUTFIT_OF_EXISTING)) {
    await db.query(`update items set data = data || $2::text::jsonb where id = $1 and kind = 'wear' and not (data ? 'outfit')`, [id, JSON.stringify({ outfit: SET[set] })]);
  }
  await db.query(`insert into settings (key, value) values ('pack_butik', 'true'::jsonb) on conflict (key) do nothing`);
  await db.query(`insert into settings (key, value) values ('content_pack', '12'::jsonb) on conflict (key) do update set value = to_jsonb(greatest((settings.value)::text::int, 12))`);
  // katalog berubah: naikkan versi supaya PWA yang menyimpan katalog lama memuat ulang
  await db.query(`insert into settings (key, value) values ('catalog_version', to_jsonb(1)) on conflict (key) do update set value = to_jsonb((settings.value)::text::int + 1), updated_at = now()`);
  return true;
}
