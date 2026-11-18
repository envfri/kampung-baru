// Paket konten 18: barang baru di tiga toko koin.
// - Pasar Pagi: 8 jajanan & makanan kampung (gado-gado, soto ayam, nasi uduk, onde-onde, ...), efek & harga
//   seimbang dengan makanan lama (± 2 poin kebutuhan per koin).
// - Mebel Jati: 8 mebel (kursi goyang, meja belajar, cermin, jam bandul, lemari kaca, kipas angin, radio, dipan),
//   2 dinding, 1 lantai.
// - Toko Bangunan: 9 benda halaman (saung, sumur, kolam ikan, pot kembang, lampu taman, batu pijakan, kurungan ayam,
//   jemuran, pagar bambu) & 2 lantai luar.
// Plus aktivitas untuk mebel & benda halaman yang bisa dipakai pet. Item, aktivitas, dan ubahan admin yang sudah ada
// tidak ditimpa (on conflict do nothing).
import type { Db } from './index';

type Shop = 'pasar' | 'mebel' | 'bangunan';
type SeedItem = {
  id: string; kind: 'food' | 'furniture' | 'wallpaper' | 'floor'; name: string; description: string;
  price_coin: number; sell_coin: number; shop: Shop; art: { type: 'builtin'; key: string }; data: Record<string, unknown>;
};
const I = (shop: Shop, id: string, kind: SeedItem['kind'], name: string, description: string, price: number, sell: number, key: string, data: Record<string, unknown> = {}): SeedItem =>
  ({ id, kind, name, description, price_coin: price, sell_coin: sell, shop, art: { type: 'builtin', key }, data });
const food = (id: string, name: string, description: string, price: number, sell: number, key: string, effects: Record<string, number>) => I('pasar', id, 'food', name, description, price, sell, key, { effects });

export const SEED_ITEMS_V18: SeedItem[] = [
  // Pasar Pagi
  food('gado-gado', 'Gado-gado', 'Sayur rebus, lontong, dan telur bersiram bumbu kacang. Lengkap dengan kerupuk!', 16, 6, 'gadogado', { kenyang: 28, ceria: 4 }),
  food('soto-ayam', 'Soto Ayam', 'Kuah kuning hangat dengan suwiran ayam dan perasan jeruk nipis.', 17, 7, 'soto', { kenyang: 26, energi: 8 }),
  food('nasi-uduk', 'Nasi Uduk', 'Nasi gurih santan dibungkus daun pisang, dengan telur dadar dan tempe orek.', 14, 6, 'nasiuduk', { kenyang: 26, energi: 3 }),
  food('onde-onde', 'Onde-onde', 'Bola wijen isi kacang hijau. Renyah di luar, lembut di dalam.', 7, 3, 'ondeonde', { kenyang: 8, ceria: 6 }),
  food('pisang-molen', 'Pisang Molen', 'Pisang berbalut kulit pastri yang dililit, digoreng keemasan.', 8, 3, 'molen', { kenyang: 12, ceria: 4 }),
  food('es-buah', 'Es Buah', 'Potongan buah segar, kolang-kaling, dan sirup merah dengan es serut.', 11, 4, 'esbuah', { ceria: 14, kenyang: 8 }),
  food('serabi', 'Serabi', 'Serabi kelapa dan serabi pandan dengan kuah kinca gula merah.', 9, 4, 'serabi', { kenyang: 12, ceria: 6 }),
  food('wedang-ronde', 'Wedang Ronde', 'Minuman jahe hangat berisi bola ketan warna-warni dan kacang sangrai.', 9, 4, 'ronde', { energi: 10, ceria: 8 }),
  // Mebel Jati
  I('mebel', 'kursi-goyang', 'furniture', 'Kursi Goyang Rotan', 'Kursi rotan beranyam yang bisa bergoyang pelan. Pet bisa duduk santai di sini.', 120, 48, 'kursigoyang', { w: 1, d: 1 }),
  I('mebel', 'meja-belajar', 'furniture', 'Meja Belajar', 'Meja kayu dengan lampu belajar, rak buku kecil, dan celengan ayam. Pet bisa belajar di sini.', 150, 60, 'mejabelajar', { w: 2, d: 1 }),
  I('mebel', 'cermin-berdiri', 'furniture', 'Cermin Berdiri', 'Cermin tinggi berbingkai kayu. Putar ke belakang untuk melihat papan punggungnya.', 70, 28, 'cermin', { w: 1, d: 1 }),
  I('mebel', 'jam-bandul', 'furniture', 'Jam Bandul', 'Jam kayu tinggi dengan bandul kuningan yang berayun. Teng, teng!', 180, 72, 'jambandul', { w: 1, d: 1 }),
  I('mebel', 'lemari-kaca', 'furniture', 'Lemari Kaca Pajangan', 'Bufet kayu berkaca berisi piring, gelas, teko, dan toples kue. Ada vas bunga di atasnya.', 200, 80, 'lemarikaca', { w: 2, d: 1 }),
  I('mebel', 'kipas-angin', 'furniture', 'Kipas Angin Berdiri', 'Kipas angin tinggi untuk siang yang gerah. Baling-balingnya berputar pelan.', 65, 26, 'kipasangin', { w: 1, d: 1 }),
  I('mebel', 'radio-tua', 'furniture', 'Radio Tua', 'Radio kayu di atas meja kecil, lengkap dengan antena dan kaset di rak bawah.', 95, 38, 'radiotua', { w: 1, d: 1 }),
  I('mebel', 'dipan-kayu', 'furniture', 'Dipan Kayu', 'Dipan kayu berukir dengan tikar pandan, bantal, guling, dan kain batik.', 170, 68, 'dipan', { w: 2, d: 1 }),
  I('mebel', 'wp-lambri', 'wallpaper', 'Dinding Lis Kayu', 'Dinding krem dengan papan kayu (lambrisering) di bagian bawah, seperti rumah lama.', 100, 0, 'lambri'),
  I('mebel', 'wp-kembang', 'wallpaper', 'Dinding Kembang Kecil', 'Dinding persik bermotif kembang kecil berdaun.', 90, 0, 'kembang'),
  I('mebel', 'fl-tegelkembang', 'floor', 'Lantai Tegel Kembang', 'Tegel semen bermotif kembang dan bulatan hijau, khas rumah kampung.', 120, 0, 'tegelkembang'),
  // Toko Bangunan
  I('bangunan', 'saung-bambu', 'furniture', 'Saung Bambu', 'Saung beratap ijuk dengan lantai bilah bambu. Tempat ngaso di halaman.', 240, 96, 'saung', { w: 2, d: 2 }),
  I('bangunan', 'sumur-timba', 'furniture', 'Sumur Timba', 'Sumur batu beratap genteng dengan kerekan dan timba.', 150, 60, 'sumur', { w: 1, d: 1 }),
  I('bangunan', 'kolam-ikan', 'furniture', 'Kolam Ikan', 'Kolam batu dengan ikan mas, teratai, dan pancuran bambu yang gemericik.', 200, 80, 'kolamikan', { w: 2, d: 2 }),
  I('bangunan', 'pot-kembang-sepatu', 'furniture', 'Pot Kembang Sepatu', 'Pot tanah liat besar berisi kembang sepatu merah.', 60, 24, 'potkembang', { w: 1, d: 1 }),
  I('bangunan', 'lampu-taman', 'furniture', 'Lampu Taman Joglo', 'Lampu taman beratap joglo dengan cahaya hangat.', 70, 28, 'lampujoglo', { w: 1, d: 1 }),
  I('bangunan', 'batu-pijakan', 'furniture', 'Batu Pijakan', 'Tiga batu pipih untuk jalan setapak. Bisa dilewati, pasang berderet!', 15, 6, 'batupijak', { w: 1, d: 1, flat: true }),
  I('bangunan', 'kurungan-ayam', 'furniture', 'Kurungan Ayam', 'Kurungan bambu dengan induk ayam di dalamnya.', 110, 44, 'kurungan', { w: 1, d: 1 }),
  I('bangunan', 'jemuran-bambu', 'furniture', 'Jemuran Bambu', 'Galah bambu dengan kaos, sarung, dan handuk yang sedang dijemur.', 80, 32, 'jemuran', { w: 2, d: 1 }),
  I('bangunan', 'pagar-bambu', 'furniture', 'Pagar Bambu', 'Pagar bambu runcing sepanjang dua petak, diikat tali ijuk.', 40, 16, 'pagarbambu', { w: 2, d: 1 }),
  I('bangunan', 'fl-kerikil', 'floor', 'Hamparan Kerikil', 'Kerikil kecil warna-warni untuk halaman.', 60, 0, 'kerikil'),
  I('bangunan', 'fl-batamerah', 'floor', 'Lantai Bata Merah', 'Bata merah tersusun rapi untuk teras dan halaman.', 100, 0, 'batamerah'),
];

type SeedActivity = {
  id: string; name: string; targets: string[]; anim: string; effects: Record<string, number>;
  xp: number; coins?: number; reward_item?: string; cooldown_sec: number; daily_limit?: number; message: string;
};
export const SEED_ACTIVITIES_V18: SeedActivity[] = [
  // Mebel Jati
  { id: 'goyang-kursi', name: 'Bergoyang santai', targets: ['art:kursigoyang'], anim: 'duduk', effects: { ceria: 7, energi: 6 }, xp: 1, cooldown_sec: 300, message: '{pet} bergoyang pelan di kursi rotan. Enaknya...' },
  { id: 'belajar-meja', name: 'Belajar', targets: ['art:mejabelajar'], anim: 'baca', effects: { ceria: 6, energi: -3 }, xp: 4, cooldown_sec: 600, message: '{pet} belajar di bawah lampu meja. Pintar!' },
  { id: 'bercermin', name: 'Bercermin', targets: ['art:cermin'], anim: 'lihat', effects: { ceria: 6 }, xp: 1, cooldown_sec: 300, message: '{pet} bercermin sambil merapikan bulu. Cakep!' },
  { id: 'tunggu-dentang', name: 'Tunggu dentang', targets: ['art:jambandul'], anim: 'lihat', effects: { ceria: 5 }, xp: 1, cooldown_sec: 300, message: '{pet} menunggu jam bandul berdentang. Teng... teng!' },
  { id: 'lihat-pajangan', name: 'Lihat pajangan', targets: ['art:lemarikaca'], anim: 'lihat', effects: { ceria: 6 }, xp: 2, cooldown_sec: 300, message: '{pet} mengagumi piring dan teko di lemari kaca.' },
  { id: 'ngadem-kipas', name: 'Ngadem', targets: ['art:kipasangin'], anim: 'lihat', effects: { energi: 6, ceria: 4 }, xp: 1, cooldown_sec: 600, message: '{pet} ngadem di depan kipas angin. Aaah, sejuk!' },
  { id: 'dengar-radio', name: 'Dengar radio', targets: ['art:radiotua'], anim: 'musik', effects: { ceria: 10, energi: -2 }, xp: 2, cooldown_sec: 600, message: '{pet} mendengarkan lagu keroncong dari radio tua.' },
  { id: 'leyeh-dipan', name: 'Leyeh-leyeh', targets: ['art:dipan'], anim: 'tidur', effects: { energi: 15, ceria: 3 }, xp: 2, cooldown_sec: 600, message: '{pet} leyeh-leyeh di dipan kayu sambil memeluk guling.' },
  // Toko Bangunan
  { id: 'ngaso-saung', name: 'Ngaso di saung', targets: ['art:saung'], anim: 'duduk', effects: { energi: 8, ceria: 6 }, xp: 1, cooldown_sec: 300, message: '{pet} ngaso di saung bambu. Anginnya sepoi-sepoi.' },
  { id: 'timba-sumur', name: 'Timba air', targets: ['art:sumur'], anim: 'lihat', effects: { bersih: 12, ceria: 3 }, xp: 2, cooldown_sec: 600, message: '{pet} menimba air sumur lalu cuci muka. Segar!' },
  { id: 'beri-makan-ikan', name: 'Kasih makan ikan', targets: ['art:kolamikan'], anim: 'lihat', effects: { ceria: 8 }, xp: 2, cooldown_sec: 600, message: '{pet} menabur pelet. Ikan mas berebut!' },
  { id: 'siram-kembang', name: 'Siram', targets: ['art:potkembang'], anim: 'siram', effects: { ceria: 5 }, xp: 2, coins: 2, cooldown_sec: 600, message: '{pet} menyiram kembang sepatu. Merahnya merekah!' },
  { id: 'kasih-makan-ayam', name: 'Kasih makan ayam', targets: ['art:kurungan'], anim: 'lihat', effects: { ceria: 6 }, xp: 2, coins: 2, cooldown_sec: 900, message: '{pet} menebar jagung. Petok-petok!' },
  { id: 'angkat-jemuran', name: 'Angkat jemuran', targets: ['art:jemuran'], anim: 'lihat', effects: { ceria: 4, bersih: 3 }, xp: 2, coins: 1, cooldown_sec: 900, message: '{pet} mengangkat jemuran sebelum hujan. Rajin!' },
];

export async function seedPackV18(db: Db) {
  // penanda sendiri per paket (bukan hanya angka content_pack), seperti paket 11–17
  if (await db.one(`select 1 from settings where key = 'pack_toko3'`)) return false;
  await db.tx(async (t) => {
    let sort = (await t.one<{ m: number }>('select coalesce(max(sort), 0)::int m from items'))!.m;
    for (const it of SEED_ITEMS_V18) {
      await t.query(
        `insert into items (id, kind, name, description, price_coin, price_pearl, sell_coin, shop, art, data, sort)
         values ($1,$2,$3,$4,$5,0,$6,$7,$8::text::jsonb,$9::text::jsonb,$10) on conflict (id) do nothing`,
        [it.id, it.kind, it.name, it.description, it.price_coin, it.sell_coin, it.shop, JSON.stringify(it.art), JSON.stringify(it.data), (sort += 10)],
      );
    }
    let asort = (await t.one<{ m: number }>('select coalesce(max(sort), 0)::int m from activities'))!.m;
    for (const a of SEED_ACTIVITIES_V18) {
      await t.query(
        `insert into activities (id, name, targets, anim, effects, xp, coins, reward_item, cooldown_sec, daily_limit, message, sort)
         values ($1,$2,$3::text::jsonb,$4,$5::text::jsonb,$6,$7,$8,$9,$10,$11,$12) on conflict (id) do nothing`,
        [a.id, a.name, JSON.stringify(a.targets), a.anim, JSON.stringify(a.effects), a.xp, a.coins ?? 0, a.reward_item ?? null, a.cooldown_sec, a.daily_limit ?? 0, a.message, (asort += 10)],
      );
    }
    // katalog berubah: PWA yang menyimpan katalog lama memuat ulang
    await t.query(`insert into settings (key, value) values ('catalog_version', to_jsonb(1)) on conflict (key) do update set value = to_jsonb((settings.value)::text::int + 1), updated_at = now()`);
    await t.query(`insert into settings (key, value) values ('pack_toko3', 'true'::jsonb) on conflict (key) do nothing`);
    await t.query(`insert into settings (key, value) values ('content_pack', '18'::jsonb) on conflict (key) do update set value = to_jsonb(greatest((settings.value)::text::int, 18))`);
  });
  return true;
}
