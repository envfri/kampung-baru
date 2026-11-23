// Paket konten 22: kamar mandi 2 & enam ruangan Mutiara.
// - Mebel Jati (koin): 10 mebel kamar mandi (bak mandi keramik & gayung, shower & tirai ikan, pengering bulu, mesin
//   gelembung sabun, rak mainan mandi, ember rendam kaki, rak sabun & sampo, lampu ubur-ubur, keranjang cucian rotan,
//   pot lidah mertua), dinding ubin perahu layar, lantai batu kali kecil.
// - Toko Mutiara: bak mandi kaki kucing & pancuran gajah, dan enam ruangan (Ruang Main Anak, Rumah Pohon, Studio Karaoke,
//   Rumah Kaca Anggrek, Pemandian Air Panas, Ruang Akuarium). Tiap ruangan punya dinding & lantai khusus (dinding/lantai
//   awal ruangan itu) dan satu mebel khas; ketiganya tidak dijual di toko mana pun dan masuk Tas saat ruangan dibeli
//   (data.bonusItems, lihat /api/shop/buy). Mebel khas tidak bisa dibeli maupun dijual kembali (seperti seragam paket 21).
// - Aktivitas untuk semua mebel baru, termasuk tiga animasi baru (gayung, shower, kering).
// Item, aktivitas, dan ubahan admin yang sudah ada tidak ditimpa (on conflict do nothing).
import type { Db } from './index';

type Kind = 'furniture' | 'wallpaper' | 'floor' | 'room';
type SeedItem = {
  id: string; kind: Kind; name: string; description: string; price_coin: number; price_pearl: number; sell_coin: number;
  shop: 'mebel' | 'mutiara' | null; art: { type: 'builtin'; key: string; colors?: Record<string, string> }; data: Record<string, unknown>;
};
/** barang koin Mebel Jati */
const C = (id: string, kind: Kind, name: string, description: string, price: number, sell: number, key: string, data: Record<string, unknown> = {}): SeedItem =>
  ({ id, kind, name, description, price_coin: price, price_pearl: 0, sell_coin: sell, shop: 'mebel', art: { type: 'builtin', key }, data });
/** barang Mutiara (Toko Mutiara) */
const M = (id: string, kind: Kind, name: string, description: string, price: number, key: string, data: Record<string, unknown> = {}, colors?: Record<string, string>): SeedItem =>
  ({ id, kind, name, description, price_coin: 0, price_pearl: price, sell_coin: 0, shop: 'mutiara', art: { type: 'builtin', key, ...(colors ? { colors } : {}) }, data });
/** barang khusus ruangan: tidak dijual di toko (tanpa harga, tidak bisa dijual kembali) */
const X = (id: string, kind: Kind, name: string, description: string, key: string, room: string, data: Record<string, unknown> = {}): SeedItem =>
  ({ id, kind, name, description, price_coin: 0, price_pearl: 0, sell_coin: 0, shop: null, art: { type: 'builtin', key }, data: { ...data, room } });

/** enam ruangan Mutiara: ukuran, harga, dinding & lantai khusus, mebel khas */
export const MANDI2_ROOMS = [
  { id: 'ruang-main', name: 'Ruang Main Anak', size: 5, price: 12, key: 'ruangmain', wall: 'wp-balonpastel', floor: 'fl-puzzlebusa', bonus: 'kolam-bola', colors: { main: '#FDEAF2', accent: '#F7C548' },
    description: 'Ruangan 5×5 yang ceria: dinding balon pastel, lantai tikar busa puzzle, dan Kolam Bola untuk nyemplung sepuasnya.' },
  { id: 'rumah-pohon', name: 'Rumah Pohon', size: 5, price: 15, key: 'rumahpohon', wall: 'wp-papanpohon', floor: 'fl-papandaun', bonus: 'ayunan-ban', colors: { main: '#C8955A', accent: '#B98552' },
    description: 'Rumah papan 5×5 di antara dahan dan daun rimbun, lengkap dengan Ayunan Ban untuk berayun tinggi-tinggi.' },
  { id: 'studio-karaoke', name: 'Studio Karaoke', size: 5, price: 15, key: 'karaoke', wall: 'wp-busawarna', floor: 'fl-lantaidisko', bonus: 'mesin-karaoke', colors: { main: '#3B2F5E', accent: '#2E2546' },
    description: 'Studio 5×5 berdinding busa peredam warna-warni dan lantai disko. Mesin Karaoke sudah siap untuk nyanyi dangdut!' },
  { id: 'rumah-kaca', name: 'Rumah Kaca Anggrek', size: 6, price: 15, key: 'rumahkaca', wall: 'wp-kacaanggrek', floor: 'fl-batutapak', bonus: 'rak-anggrek', colors: { main: '#D6EFE4', accent: '#C3C2B4' },
    description: 'Rumah kaca 6×6 yang terang dan sejuk, berlantai batu pijakan. Rak Anggrek bertingkat sudah penuh bunga.' },
  { id: 'air-panas', name: 'Pemandian Air Panas', size: 5, price: 18, key: 'airpanas', wall: 'wp-batubambu', floor: 'fl-batusungai', bonus: 'kolam-air-panas', colors: { main: '#B9B2A2', accent: '#7E8790' },
    description: 'Pemandian 5×5 berdinding batu alam & bambu, berlantai batu sungai. Kolam Air Panas berbatu siap untuk berendam.' },
  { id: 'ruang-akuarium', name: 'Ruang Akuarium', size: 6, price: 20, key: 'ruangakuarium', wall: 'wp-kacaakuarium', floor: 'fl-pasirlaut', bonus: 'sofa-kerang', colors: { main: '#2F6FA8', accent: '#F2DEB0' },
    description: 'Ruangan 6×6 berdinding kaca akuarium dengan ikan berenang dan lantai pasir laut. Bersantai di Sofa Kerang!' },
] as const;

export const SEED_ITEMS_V22: SeedItem[] = [
  // Mebel Jati: kamar mandi
  C('bak-gayung', 'furniture', 'Bak Mandi Keramik & Gayung', 'Bak mandi berlapis ubin biru, penuh air jernih, dengan gayung yang mengapung. Mandi gayung ala kampung!', 180, 72, 'bakgayung', { w: 1, d: 1 }),
  C('shower-tirai-ikan', 'furniture', 'Shower & Tirai Ikan', 'Pancuran di atas alas shower, dengan tirai bermotif ikan warna-warni. Pet berdiri di bawahnya.', 230, 92, 'showertirai', { w: 1, d: 1 }),
  C('pengering-bulu', 'furniture', 'Pengering Bulu', 'Pengering bulu berdiri bertelinga kucing. Hembusan hangatnya bikin bulu mekar dan halus.', 140, 56, 'pengeringbulu', { w: 1, d: 1 }),
  C('mesin-gelembung', 'furniture', 'Mesin Gelembung Sabun', 'Mesin kipas mungil di atas dingklik yang meniupkan gelembung sabun tanpa henti.', 160, 64, 'mesingelembung', { w: 1, d: 1 }),
  C('rak-mainan-mandi', 'furniture', 'Rak Mainan Mandi', 'Rak kecil berisi kapal-kapalan berlayar, ikan karet, bola, dan ember mainan.', 90, 36, 'rakmainan', { w: 1, d: 1 }),
  C('ember-rendam-kaki', 'furniture', 'Ember Rendam Kaki', 'Bak kayu berisi air hangat berkelopak bunga, ditemani teko dan handuk gulung.', 100, 40, 'emberrendam', { w: 1, d: 1 }),
  C('rak-sabun-sampo', 'furniture', 'Rak Sabun & Sampo', 'Rak bambu tiga susun penuh botol sampo, sabun batang, spons, dan sikat punggung.', 60, 24, 'raksabun', { w: 1, d: 1 }),
  C('lampu-ubur-ubur', 'furniture', 'Lampu Ubur-ubur', 'Tabung kaca berisi ubur-ubur yang bercahaya lembut dan naik-turun pelan.', 120, 48, 'lampuubur', { w: 1, d: 1 }),
  C('keranjang-cucian', 'furniture', 'Keranjang Cucian Rotan', 'Keranjang rotan anyaman dengan handuk dan kaus kaki yang menyembul.', 50, 20, 'keranjangcucian', { w: 1, d: 1 }),
  C('pot-lidah-mertua', 'furniture', 'Pot Lidah Mertua', 'Tanaman lidah mertua berdaun tegak belang kuning di pot tanah liat.', 45, 18, 'lidahmertua', { w: 1, d: 1 }),
  C('wp-ubinperahu', 'wallpaper', 'Dinding Ubin Perahu Layar', 'Ubin putih dan biru muda bergambar perahu layar kecil, dengan lis ombak.', 70, 0, 'ubinperahu'),
  C('fl-batukalikecil', 'floor', 'Lantai Batu Kali Kecil', 'Kerikil kali kecil abu-abu kebiruan, sejuk di kaki setelah mandi.', 70, 0, 'batukalikecil'),
  // Toko Mutiara: kamar mandi istimewa
  M('bak-kaki-kucing', 'furniture', 'Bak Mandi Kaki Kucing', 'Bak mandi merah muda berbusa tebal yang berdiri di atas empat kaki kucing. Berendam busa!', 12, 'bakkakikucing', { w: 2, d: 1 }),
  M('pancuran-gajah', 'furniture', 'Pancuran Gajah', 'Kolam bundar dengan patung gajah kecil yang menyemprotkan air dari belalainya.', 15, 'pancurangajah', { w: 2, d: 2 }),
  // Toko Mutiara: enam ruangan (dinding & lantai awal = dinding & lantai khususnya)
  ...MANDI2_ROOMS.map((r) => M(r.id, 'room', r.name, r.description, r.price, r.key, { size: r.size, theme: 'dalam', wall: r.wall, floor: r.floor, bonusItems: [r.bonus, r.wall, r.floor] }, r.colors)),
  // khusus ruangan: dinding, lantai & mebel khas (tidak dijual)
  X('wp-balonpastel', 'wallpaper', 'Dinding Balon Pastel', 'Dinding merah muda pastel dengan balon warna-warni dan untaian bendera. Khusus Ruang Main Anak.', 'balonpastel', 'ruang-main'),
  X('fl-puzzlebusa', 'floor', 'Lantai Tikar Busa Puzzle', 'Tikar busa empuk empat warna yang saling mengunci. Khusus Ruang Main Anak.', 'puzzlebusa', 'ruang-main'),
  X('kolam-bola', 'furniture', 'Kolam Bola', 'Kolam tiup penuh bola warna-warni. Bonus Ruang Main Anak.', 'kolambola', 'ruang-main', { w: 2, d: 2 }),
  X('wp-papanpohon', 'wallpaper', 'Dinding Papan Rumah Pohon', 'Papan kayu tegak dengan dahan dan daun yang menjalar. Khusus Rumah Pohon.', 'papanpohon', 'rumah-pohon'),
  X('fl-papandaun', 'floor', 'Lantai Papan Daun Gugur', 'Lantai papan kayu dengan daun-daun yang jatuh dari dahan. Khusus Rumah Pohon.', 'papandaun', 'rumah-pohon'),
  X('ayunan-ban', 'furniture', 'Ayunan Ban', 'Ban bekas bertali di rangka kayu berlilit daun. Bonus Rumah Pohon.', 'ayunanban', 'rumah-pohon', { w: 2, d: 1 }),
  X('wp-busawarna', 'wallpaper', 'Dinding Busa Peredam', 'Panel busa peredam warna-warni dan lampu neon. Khusus Studio Karaoke.', 'busawarna', 'studio-karaoke'),
  X('fl-lantaidisko', 'floor', 'Lantai Disko', 'Lantai gelap mengilap dengan bercak lampu disko yang berkedip. Khusus Studio Karaoke.', 'lantaidisko', 'studio-karaoke'),
  X('mesin-karaoke', 'furniture', 'Mesin Karaoke', 'Speaker besar, layar lirik warna-warni, bola disko, dan mikrofon bertiang. Bonus Studio Karaoke.', 'mesinkaraoke', 'studio-karaoke', { w: 1, d: 1 }),
  X('wp-kacaanggrek', 'wallpaper', 'Dinding Kaca Rumah Kaca', 'Panel kaca berbingkai putih di atas dinding bata rendah. Khusus Rumah Kaca Anggrek.', 'kacaanggrek', 'rumah-kaca'),
  X('fl-batutapak', 'floor', 'Lantai Batu Pijakan', 'Batu pijakan pipih di antara lumut hijau. Khusus Rumah Kaca Anggrek.', 'batutapak', 'rumah-kaca'),
  X('rak-anggrek', 'furniture', 'Rak Anggrek', 'Rak bertingkat penuh anggrek bulan ungu, putih, dan merah muda. Bonus Rumah Kaca Anggrek.', 'rakanggrek', 'rumah-kaca', { w: 2, d: 1 }),
  X('wp-batubambu', 'wallpaper', 'Dinding Batu & Bambu', 'Batu alam di bawah, deretan bambu di atas. Khusus Pemandian Air Panas.', 'batubambu', 'air-panas'),
  X('fl-batusungai', 'floor', 'Lantai Batu Sungai', 'Batu sungai besar yang licin mengilap. Khusus Pemandian Air Panas.', 'batusungai', 'air-panas'),
  X('kolam-air-panas', 'furniture', 'Kolam Air Panas', 'Kolam berbatu berair hangat yang mengepul, dengan pancuran bambu. Bonus Pemandian Air Panas.', 'kolamairpanas', 'air-panas', { w: 2, d: 2 }),
  X('wp-kacaakuarium', 'wallpaper', 'Dinding Kaca Akuarium', 'Dinding akuarium raksasa dengan rumput laut dan ikan yang berenang. Khusus Ruang Akuarium.', 'kacaakuarium', 'ruang-akuarium'),
  X('fl-pasirlaut', 'floor', 'Lantai Pasir Dasar Laut', 'Pasir dasar laut beriak dengan kerang dan bintang laut. Khusus Ruang Akuarium.', 'pasirlaut', 'ruang-akuarium'),
  X('sofa-kerang', 'furniture', 'Sofa Kerang', 'Sofa bersandaran kerang merah muda dengan bantal mutiara. Bonus Ruang Akuarium.', 'sofakerang', 'ruang-akuarium', { w: 2, d: 1 }),
];

type SeedActivity = {
  id: string; name: string; targets: string[]; anim: string; effects: Record<string, number>;
  xp: number; coins?: number; reward_item?: string; cooldown_sec: number; daily_limit?: number; message: string;
};
export const SEED_ACTIVITIES_V22: SeedActivity[] = [
  // Mebel Jati
  { id: 'mandi-gayung', name: 'Mandi gayung', targets: ['art:bakgayung'], anim: 'gayung', effects: { bersih: 45, ceria: 4 }, xp: 2, cooldown_sec: 900, message: '{pet} mandi pakai gayung. Byur, byur! Segarnya!' },
  { id: 'mandi-shower', name: 'Mandi shower', targets: ['art:showertirai'], anim: 'shower', effects: { bersih: 35, ceria: 6 }, xp: 2, cooldown_sec: 900, message: '{pet} mandi di bawah shower. Airnya turun seperti hujan!' },
  { id: 'keringkan-bulu', name: 'Keringkan bulu', targets: ['art:pengeringbulu'], anim: 'kering', effects: { ceria: 8 }, xp: 1, cooldown_sec: 600, message: '{pet} mengeringkan bulu. Wuus, bulunya jadi mekar dan halus!' },
  { id: 'main-gelembung', name: 'Main gelembung', targets: ['art:mesingelembung'], anim: 'lihat', effects: { ceria: 12 }, xp: 2, cooldown_sec: 900, message: '{pet} main gelembung sabun. Pop, pop, pop!' },
  { id: 'main-kapal-kapalan', name: 'Main kapal-kapalan', targets: ['art:rakmainan'], anim: 'lihat', effects: { ceria: 8 }, xp: 1, cooldown_sec: 600, message: '{pet} main kapal-kapalan dan ikan karet. Berlayar!' },
  { id: 'rendam-kaki', name: 'Rendam kaki air hangat', targets: ['art:emberrendam'], anim: 'duduk', effects: { energi: 10, ceria: 4 }, xp: 2, cooldown_sec: 900, message: '{pet} merendam kaki di air hangat. Ahh, pegalnya hilang.' },
  { id: 'pilih-sabun', name: 'Pilih sabun wangi', targets: ['art:raksabun'], anim: 'lihat', effects: { bersih: 4, ceria: 3 }, xp: 1, cooldown_sec: 600, message: '{pet} memilih sabun paling wangi. Hmm, wangi stroberi!' },
  { id: 'lihat-lampu-ubur', name: 'Lihat ubur-ubur', targets: ['art:lampuubur'], anim: 'lihat', effects: { ceria: 5 }, xp: 1, cooldown_sec: 600, message: '{pet} memandangi ubur-ubur yang bercahaya lembut.' },
  { id: 'siram-lidah-mertua', name: 'Siram', targets: ['art:lidahmertua'], anim: 'siram', effects: { ceria: 3 }, xp: 1, cooldown_sec: 600, message: '{pet} menyiram lidah mertua. Daunnya tegak dan segar!' },
  // Toko Mutiara
  { id: 'berendam-busa', name: 'Berendam busa', targets: ['art:bakkakikucing'], anim: 'mandi', effects: { bersih: 50, ceria: 10 }, xp: 3, cooldown_sec: 900, message: '{pet} berendam busa di bak kaki kucing. Busanya menggunung!' },
  { id: 'mandi-pancuran-gajah', name: 'Mandi di pancuran gajah', targets: ['art:pancurangajah'], anim: 'shower', effects: { bersih: 40, ceria: 8 }, xp: 3, cooldown_sec: 900, message: '{pet} mandi disemprot belalai gajah. Hihi, geli!' },
  // mebel khas ruangan Mutiara
  { id: 'nyemplung-kolam-bola', name: 'Nyemplung kolam bola', targets: ['art:kolambola'], anim: 'duduk', effects: { ceria: 15 }, xp: 2, cooldown_sec: 900, message: '{pet} nyemplung ke kolam bola. Bolanya berhamburan!' },
  { id: 'main-ayunan-ban', name: 'Main ayunan ban', targets: ['art:ayunanban'], anim: 'ayun', effects: { ceria: 12 }, xp: 2, cooldown_sec: 600, message: '{pet} main ayunan ban di rumah pohon. Wiii, tinggi sekali!' },
  { id: 'nyanyi-dangdut', name: 'Nyanyi dangdut', targets: ['art:mesinkaraoke'], anim: 'musik', effects: { ceria: 14 }, xp: 3, cooldown_sec: 900, message: '{pet} nyanyi dangdut di depan mesin karaoke. Goyang terus!' },
  { id: 'siram-anggrek', name: 'Siram anggrek', targets: ['art:rakanggrek'], anim: 'siram', effects: { ceria: 8 }, xp: 2, cooldown_sec: 900, message: '{pet} menyiram anggrek pelan-pelan. Bunganya mekar cantik!' },
  { id: 'berendam-air-panas', name: 'Berendam air panas', targets: ['art:kolamairpanas'], anim: 'mandi', effects: { bersih: 40, energi: 15 }, xp: 3, cooldown_sec: 900, message: '{pet} berendam di kolam air panas. Hangat, badan jadi segar!' },
  { id: 'duduk-sofa-kerang', name: 'Duduk di sofa kerang', targets: ['art:sofakerang'], anim: 'duduk', effects: { ceria: 6, energi: 6 }, xp: 1, cooldown_sec: 600, message: '{pet} duduk di sofa kerang sambil melihat ikan berenang.' },
];

export async function seedPackV22(db: Db) {
  // penanda sendiri per paket (bukan hanya angka content_pack), seperti paket 11–21
  if (await db.one(`select 1 from settings where key = 'pack_mandi2'`)) return false;
  await db.tx(async (t) => {
    let sort = (await t.one<{ m: number }>('select coalesce(max(sort), 0)::int m from items'))!.m;
    for (const it of SEED_ITEMS_V22) {
      await t.query(
        `insert into items (id, kind, name, description, price_coin, price_pearl, sell_coin, shop, art, data, sort)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9::text::jsonb,$10::text::jsonb,$11) on conflict (id) do nothing`,
        [it.id, it.kind, it.name, it.description, it.price_coin, it.price_pearl, it.sell_coin, it.shop, JSON.stringify(it.art), JSON.stringify(it.data), (sort += 10)],
      );
    }
    let asort = (await t.one<{ m: number }>('select coalesce(max(sort), 0)::int m from activities'))!.m;
    for (const a of SEED_ACTIVITIES_V22) {
      await t.query(
        `insert into activities (id, name, targets, anim, effects, xp, coins, reward_item, cooldown_sec, daily_limit, message, sort)
         values ($1,$2,$3::text::jsonb,$4,$5::text::jsonb,$6,$7,$8,$9,$10,$11,$12) on conflict (id) do nothing`,
        [a.id, a.name, JSON.stringify(a.targets), a.anim, JSON.stringify(a.effects), a.xp, a.coins ?? 0, a.reward_item ?? null, a.cooldown_sec, a.daily_limit ?? 0, a.message, (asort += 10)],
      );
    }
    // katalog berubah: PWA yang menyimpan katalog lama memuat ulang
    await t.query(`insert into settings (key, value) values ('catalog_version', to_jsonb(1)) on conflict (key) do update set value = to_jsonb((settings.value)::text::int + 1), updated_at = now()`);
    await t.query(`insert into settings (key, value) values ('pack_mandi2', 'true'::jsonb) on conflict (key) do nothing`);
    await t.query(`insert into settings (key, value) values ('content_pack', '22'::jsonb) on conflict (key) do update set value = to_jsonb(greatest((settings.value)::text::int, 22))`);
  });
  return true;
}
