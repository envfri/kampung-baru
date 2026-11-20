// Paket konten 20: perabot dapur, kamar mandi, dan taman di dua toko koin.
// - Mebel Jati, dapur: 8 mebel (dandang & kukusan, penanak nasi, galon & dispenser, blender jus, rak bumbu & cobek,
//   bak cuci piring, tempat sampah pilah, meja makan taplak kotak 2×2), dinding keramik dapur, lantai tegel catur.
// - Mebel Jati, kamar mandi: 7 mebel (wastafel & cermin, baskom bebek karet, ember & papan gilas, mesin cuci dengan
//   drum berputar, timbangan badan, gantungan handuk bambu, keset kaki yang bisa dilewati), dinding keramik biru laut,
//   lantai mozaik.
// - Toko Bangunan, taman: 9 benda (ayunan kayu, hamak, meja piknik, bedeng cabai & tomat, sangkar burung, bak pasir,
//   tempat minum burung, gerobak bunga, pagar tanaman) & lantai rumput berbunga.
// Plus aktivitas untuk mebel & benda taman, termasuk tiga animasi baru (ayun, sikat, cuci). Item, aktivitas, dan
// ubahan admin yang sudah ada tidak ditimpa (on conflict do nothing).
import type { Db } from './index';

type Shop = 'mebel' | 'bangunan';
type SeedItem = {
  id: string; kind: 'furniture' | 'wallpaper' | 'floor'; name: string; description: string;
  price_coin: number; sell_coin: number; shop: Shop; art: { type: 'builtin'; key: string }; data: Record<string, unknown>;
};
const I = (shop: Shop, id: string, kind: SeedItem['kind'], name: string, description: string, price: number, sell: number, key: string, data: Record<string, unknown> = {}): SeedItem =>
  ({ id, kind, name, description, price_coin: price, sell_coin: sell, shop, art: { type: 'builtin', key }, data });

export const SEED_ITEMS_V20: SeedItem[] = [
  // Mebel Jati: dapur
  I('mebel', 'dandang-kukusan', 'furniture', 'Dandang & Kukusan', 'Dandang aluminium dan kukusan bambu di atas kompor minyak. Pet bisa mengukus kue lapis di sini.', 140, 56, 'dandang', { w: 1, d: 1 }),
  I('mebel', 'penanak-nasi', 'furniture', 'Penanak Nasi', 'Penanak nasi bermotif kembang di atas lemari kecil, lengkap dengan semangkuk nasi hangat.', 90, 36, 'penanaknasi', { w: 1, d: 1 }),
  I('mebel', 'galon-dispenser', 'furniture', 'Galon & Dispenser', 'Dispenser air dengan galon biru terbalik dan dua keran: panas & dingin.', 85, 34, 'dispenser', { w: 1, d: 1 }),
  I('mebel', 'blender-jus', 'furniture', 'Blender Jus', 'Blender berisi jus jeruk di meja kecil, dengan jeruk, alpukat, dan segelas jus bersedotan.', 75, 30, 'blender', { w: 1, d: 1 }),
  I('mebel', 'rak-bumbu', 'furniture', 'Rak Bumbu & Cobek', 'Rak stoples bumbu warna-warni dan cobek batu berisi sambal, lengkap dengan cabai dan bawang.', 70, 28, 'rakbumbu', { w: 1, d: 1 }),
  I('mebel', 'bak-cuci-piring', 'furniture', 'Bak Cuci Piring', 'Lemari dapur dengan bak cuci, keran leher angsa, dan rak piring.', 150, 60, 'bakcuci', { w: 2, d: 1 }),
  I('mebel', 'tempat-sampah-pilah', 'furniture', 'Tempat Sampah Pilah', 'Dua tempat sampah berpedal: hijau untuk organik, kuning untuk anorganik.', 50, 20, 'sampahpilah', { w: 1, d: 1 }),
  I('mebel', 'meja-makan-taplak', 'furniture', 'Meja Makan Taplak Kotak', 'Meja makan berempat bertaplak kotak-kotak merah, dengan bakul nasi, ayam goreng, sayur, dan es teh.', 220, 88, 'mejataplak', { w: 2, d: 2 }),
  I('mebel', 'wp-keramikdapur', 'wallpaper', 'Dinding Keramik Dapur', 'Keramik putih setinggi pinggang dengan lis bermotif belah ketupat.', 110, 0, 'keramikdapur'),
  I('mebel', 'fl-tegelcatur', 'floor', 'Lantai Tegel Catur', 'Tegel hitam-putih berselang-seling seperti papan catur.', 120, 0, 'tegelcatur'),
  // Mebel Jati: kamar mandi
  I('mebel', 'wastafel-cermin', 'furniture', 'Wastafel & Cermin', 'Wastafel berkaki dengan cermin, rak kecil, gelas sikat gigi, dan sabun.', 130, 52, 'wastafel', { w: 1, d: 1 }),
  I('mebel', 'baskom-bebek', 'furniture', 'Baskom Bebek Karet', 'Baskom besar berisi air berbusa dan bebek karet kuning. Pet bisa berendam sambil main.', 60, 24, 'baskombebek', { w: 1, d: 1 }),
  I('mebel', 'ember-gilas', 'furniture', 'Ember & Papan Gilas', 'Ember berbusa, papan gilas kayu, dan dingklik dengan sabun batang.', 45, 18, 'embergilas', { w: 1, d: 1 }),
  I('mebel', 'mesin-cuci', 'furniture', 'Mesin Cuci', 'Mesin cuci pintu depan. Drumnya berputar pelan membawa cucian warna-warni.', 190, 76, 'mesincuci', { w: 1, d: 1 }),
  I('mebel', 'timbangan-badan', 'furniture', 'Timbangan Badan', 'Timbangan jarum dan papan pengukur tinggi badan berwarna-warni.', 55, 22, 'timbangan', { w: 1, d: 1 }),
  I('mebel', 'gantungan-handuk', 'furniture', 'Gantungan Handuk Bambu', 'Gantungan bambu berkaki dengan tiga palang dan handuk-handuk bergaris.', 65, 26, 'gantunganhanduk', { w: 1, d: 1 }),
  I('mebel', 'keset-kaki', 'furniture', 'Keset Kaki', 'Keset kain perca bundar warna-warni. Bisa dilewati, taruh di depan pintu!', 20, 8, 'keset', { w: 1, d: 1, flat: true }),
  I('mebel', 'wp-keramikbiru', 'wallpaper', 'Dinding Keramik Biru Laut', 'Keramik biru tua dengan lis ombak putih dan keramik biru muda di atasnya.', 110, 0, 'keramikbiru'),
  I('mebel', 'fl-mozaik', 'floor', 'Lantai Mozaik', 'Keramik mozaik kecil biru, toska, dan putih.', 120, 0, 'mozaik'),
  // Toko Bangunan: taman
  I('bangunan', 'ayunan-kayu', 'furniture', 'Ayunan Kayu', 'Ayunan kayu berkaki segitiga dengan dudukan papan bertali. Pet bisa main ayunan.', 180, 72, 'ayunankayu', { w: 2, d: 1 }),
  I('bangunan', 'hamak-taman', 'furniture', 'Hamak', 'Hamak kain bergaris pelangi di rangka kayu lengkung. Rebahan sambil berayun pelan.', 160, 64, 'hamak', { w: 2, d: 1 }),
  I('bangunan', 'meja-piknik', 'furniture', 'Meja Piknik', 'Meja piknik kayu dengan bangku menyatu, keranjang rotan, semangka, dan teko es.', 210, 84, 'mejapiknik', { w: 2, d: 2 }),
  I('bangunan', 'bedeng-sayur', 'furniture', 'Bedeng Cabai & Tomat', 'Bedeng papan berisi tanaman cabai dan tomat berajir bambu.', 90, 36, 'bedengsayur', { w: 2, d: 1 }),
  I('bangunan', 'sangkar-burung', 'furniture', 'Sangkar Burung', 'Sangkar bambu di atas tiang dengan burung kuning yang suka bersiul.', 120, 48, 'sangkarburung', { w: 1, d: 1 }),
  I('bangunan', 'bak-pasir', 'furniture', 'Bak Pasir', 'Bak pasir berbingkai kayu dengan istana pasir, ember, dan sekop mainan.', 130, 52, 'bakpasir', { w: 2, d: 2 }),
  I('bangunan', 'tempat-minum-burung', 'furniture', 'Tempat Minum Burung', 'Mangkuk batu berkaki berisi air jernih. Burung pipit suka mampir mandi.', 75, 30, 'minumburung', { w: 1, d: 1 }),
  I('bangunan', 'gerobak-bunga', 'furniture', 'Gerobak Bunga', 'Gerobak kayu beroda penuh pot bunga warna-warni.', 110, 44, 'gerobakbunga', { w: 1, d: 1 }),
  I('bangunan', 'pagar-tanaman', 'furniture', 'Pagar Tanaman', 'Pagar tanaman hijau yang dipangkas rapi di bak kayu, dengan bunga putih kecil.', 45, 18, 'pagartanaman', { w: 2, d: 1 }),
  I('bangunan', 'fl-rumputbunga', 'floor', 'Lantai Rumput Berbunga', 'Rumput hijau bertabur bunga kecil putih, kuning, merah muda, dan ungu.', 90, 0, 'rumputbunga'),
];

type SeedActivity = {
  id: string; name: string; targets: string[]; anim: string; effects: Record<string, number>;
  xp: number; coins?: number; reward_item?: string; cooldown_sec: number; daily_limit?: number; message: string;
};
export const SEED_ACTIVITIES_V20: SeedActivity[] = [
  // dapur
  { id: 'kukus-kue-lapis', name: 'Kukus kue lapis', targets: ['art:dandang'], anim: 'masak', effects: { kenyang: 4 }, xp: 3, reward_item: 'kue-lapis', cooldown_sec: 1800, daily_limit: 3, message: '{pet} mengukus kue lapis selapis demi selapis. Harum!' },
  { id: 'cicip-nasi', name: 'Cicip nasi hangat', targets: ['art:penanaknasi'], anim: 'lihat', effects: { kenyang: 8, ceria: 2 }, xp: 1, cooldown_sec: 1200, daily_limit: 3, message: '{pet} mencicip nasi hangat dari penanak nasi. Pulen!' },
  { id: 'minum-air-putih', name: 'Minum air putih', targets: ['art:dispenser'], anim: 'kopi', effects: { energi: 6, ceria: 4 }, xp: 1, cooldown_sec: 600, message: '{pet} minum segelas air putih. Segar!' },
  { id: 'bikin-jus', name: 'Bikin jus', targets: ['art:blender'], anim: 'masak', effects: { ceria: 6, energi: 5 }, xp: 2, cooldown_sec: 900, message: '{pet} memblender jus jeruk. Ngeeeng... segar!' },
  { id: 'ulek-sambal', name: 'Ulek sambal', targets: ['art:rakbumbu'], anim: 'masak', effects: { ceria: 4 }, xp: 3, cooldown_sec: 900, message: '{pet} mengulek sambal di cobek. Huh-hah, pedas!' },
  { id: 'cuci-piring', name: 'Cuci piring', targets: ['art:bakcuci'], anim: 'cuci', effects: { ceria: 5 }, xp: 2, coins: 2, cooldown_sec: 900, message: '{pet} mencuci piring sampai kinclong. Rajin!' },
  { id: 'buang-sampah', name: 'Buang sampah', targets: ['art:sampahpilah'], anim: 'lihat', effects: { bersih: 5 }, xp: 2, coins: 1, cooldown_sec: 900, message: '{pet} membuang sampah ke tempat yang benar: organik dan anorganik.' },
  { id: 'makan-siang', name: 'Makan siang', targets: ['art:mejataplak'], anim: 'duduk', effects: { kenyang: 8, ceria: 4 }, xp: 2, cooldown_sec: 1200, daily_limit: 3, message: '{pet} makan siang di meja bertaplak kotak-kotak. Nikmat!' },
  // kamar mandi
  { id: 'sikat-gigi', name: 'Sikat gigi', targets: ['art:wastafel'], anim: 'sikat', effects: { bersih: 8, ceria: 4 }, xp: 2, cooldown_sec: 900, message: '{pet} sikat gigi di wastafel. Gigi bersih, senyum cerah!' },
  { id: 'main-bebek-karet', name: 'Main bebek karet', targets: ['art:baskombebek'], anim: 'mandi', effects: { bersih: 15, ceria: 8 }, xp: 2, cooldown_sec: 900, message: '{pet} berendam di baskom sambil main bebek karet. Kwek-kwek!' },
  { id: 'cuci-baju', name: 'Cuci baju', targets: ['art:embergilas'], anim: 'cuci', effects: { bersih: 5 }, xp: 2, coins: 2, cooldown_sec: 900, message: '{pet} mencuci baju di papan gilas. Srek-srek, bersih!' },
  { id: 'tunggu-cucian', name: 'Tunggu cucian berputar', targets: ['art:mesincuci'], anim: 'lihat', effects: { ceria: 7 }, xp: 1, cooldown_sec: 600, message: '{pet} menonton cucian berputar di mesin cuci. Muter-muter...' },
  { id: 'timbang-badan', name: 'Timbang badan', targets: ['art:timbangan'], anim: 'lihat', effects: { ceria: 3 }, xp: 1, cooldown_sec: 600, message: '{pet} menimbang badan dan mengukur tinggi. Makin besar!' },
  { id: 'keringkan-badan', name: 'Keringkan badan', targets: ['art:gantunganhanduk'], anim: 'lihat', effects: { bersih: 5, ceria: 4 }, xp: 1, cooldown_sec: 600, message: '{pet} mengeringkan badan dengan handuk bergaris. Hangat!' },
  { id: 'lap-kaki', name: 'Lap kaki', targets: ['art:keset'], anim: 'lihat', effects: { bersih: 3 }, xp: 1, cooldown_sec: 300, message: '{pet} mengelap kaki di keset. Lantai tetap bersih!' },
  // taman
  { id: 'main-ayunan-kayu', name: 'Main ayunan', targets: ['art:ayunankayu'], anim: 'ayun', effects: { ceria: 10, energi: -3 }, xp: 2, cooldown_sec: 600, message: '{pet} main ayunan tinggi-tinggi. Wiii!' },
  { id: 'rebahan-hamak', name: 'Rebahan di hamak', targets: ['art:hamak'], anim: 'tidur', effects: { energi: 12, ceria: 5 }, xp: 2, cooldown_sec: 900, message: '{pet} rebahan di hamak sambil berayun pelan.' },
  { id: 'piknik-taman', name: 'Piknik', targets: ['art:mejapiknik'], anim: 'duduk', effects: { kenyang: 8, ceria: 6 }, xp: 2, cooldown_sec: 1200, daily_limit: 3, message: '{pet} piknik di taman makan semangka. Manis!' },
  { id: 'siram-sayur', name: 'Siram sayur', targets: ['art:bedengsayur'], anim: 'siram', effects: { ceria: 5 }, xp: 2, coins: 2, cooldown_sec: 900, message: '{pet} menyiram cabai dan tomat. Cepat berbuah, ya!' },
  { id: 'siul-burung', name: 'Siul bareng burung', targets: ['art:sangkarburung'], anim: 'musik', effects: { ceria: 9 }, xp: 2, cooldown_sec: 600, message: '{pet} bersiul bareng burung kenari. Cuit-cuit!' },
  { id: 'main-pasir', name: 'Main pasir', targets: ['art:bakpasir'], anim: 'main', effects: { ceria: 14, bersih: -6 }, xp: 3, cooldown_sec: 900, message: '{pet} membangun istana pasir. Seru, tapi jadi berpasir!' },
  { id: 'lihat-burung-mandi', name: 'Lihat burung mandi', targets: ['art:minumburung'], anim: 'lihat', effects: { ceria: 7 }, xp: 1, cooldown_sec: 600, message: '{pet} melihat burung pipit mandi di tempat minum. Byur-byur!' },
  { id: 'rapikan-bunga', name: 'Rapikan bunga', targets: ['art:gerobakbunga'], anim: 'siram', effects: { ceria: 6 }, xp: 2, cooldown_sec: 600, message: '{pet} merapikan dan menyiram pot-pot di gerobak bunga.' },
];

export async function seedPackV20(db: Db) {
  // penanda sendiri per paket (bukan hanya angka content_pack), seperti paket 11–19
  if (await db.one(`select 1 from settings where key = 'pack_perabot3'`)) return false;
  await db.tx(async (t) => {
    let sort = (await t.one<{ m: number }>('select coalesce(max(sort), 0)::int m from items'))!.m;
    for (const it of SEED_ITEMS_V20) {
      await t.query(
        `insert into items (id, kind, name, description, price_coin, price_pearl, sell_coin, shop, art, data, sort)
         values ($1,$2,$3,$4,$5,0,$6,$7,$8::text::jsonb,$9::text::jsonb,$10) on conflict (id) do nothing`,
        [it.id, it.kind, it.name, it.description, it.price_coin, it.sell_coin, it.shop, JSON.stringify(it.art), JSON.stringify(it.data), (sort += 10)],
      );
    }
    let asort = (await t.one<{ m: number }>('select coalesce(max(sort), 0)::int m from activities'))!.m;
    for (const a of SEED_ACTIVITIES_V20) {
      await t.query(
        `insert into activities (id, name, targets, anim, effects, xp, coins, reward_item, cooldown_sec, daily_limit, message, sort)
         values ($1,$2,$3::text::jsonb,$4,$5::text::jsonb,$6,$7,$8,$9,$10,$11,$12) on conflict (id) do nothing`,
        [a.id, a.name, JSON.stringify(a.targets), a.anim, JSON.stringify(a.effects), a.xp, a.coins ?? 0, a.reward_item ?? null, a.cooldown_sec, a.daily_limit ?? 0, a.message, (asort += 10)],
      );
    }
    // katalog berubah: PWA yang menyimpan katalog lama memuat ulang
    await t.query(`insert into settings (key, value) values ('catalog_version', to_jsonb(1)) on conflict (key) do update set value = to_jsonb((settings.value)::text::int + 1), updated_at = now()`);
    await t.query(`insert into settings (key, value) values ('pack_perabot3', 'true'::jsonb) on conflict (key) do nothing`);
    await t.query(`insert into settings (key, value) values ('content_pack', '20'::jsonb) on conflict (key) do update set value = to_jsonb(greatest((settings.value)::text::int, 20))`);
  });
  return true;
}
