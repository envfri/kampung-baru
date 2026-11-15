// Paket konten 17: tiga set premium baru di Toko Mutiara — Dapur Nenek, Sanggar Seni, Spa Bali.
// Tiap set 5 mebel + 1 dinding/lantai (data.set = kunci set, lihat PREMIUM_SETS), harga Mutiara sekelas set lama,
// plus aktivitas untuk mebelnya (memasak di tungku, main angklung, berendam air kembang, ...).
// Item, aktivitas, dan ubahan admin yang sudah ada tidak ditimpa (on conflict do nothing).
import type { Db } from './index';

type SeedItem = {
  id: string; kind: 'furniture' | 'wallpaper' | 'floor'; name: string; description: string;
  price_pearl: number; shop: 'mutiara'; art: { type: 'builtin'; key: string }; data: Record<string, unknown>;
};
const P = (id: string, kind: SeedItem['kind'], name: string, description: string, price: number, key: string, set: string, data: Record<string, unknown> = {}): SeedItem =>
  ({ id, kind, name, description, price_pearl: price, shop: 'mutiara', art: { type: 'builtin', key }, data: { ...data, set } });

export const SEED_ITEMS_V17: SeedItem[] = [
  P('dn-tungku', 'furniture', 'Tungku Tanah Liat', 'Tungku kayu bakar dengan wajan gorengan dan dandang nasi. Pet bisa memasak di sini.', 15, 'tungku', 'dapurnenek', { w: 2, d: 1 }),
  P('dn-rakpiring', 'furniture', 'Rak Piring Kayu', 'Rak kayu berisi piring, cangkir blirik, teko, dan cething nasi.', 6, 'rakpiring', 'dapurnenek', { w: 1, d: 1 }),
  P('dn-gentong', 'furniture', 'Gentong Air', 'Gentong tanah liat berisi air sejuk, lengkap dengan gayung batok.', 5, 'gentongair', 'dapurnenek', { w: 1, d: 1 }),
  P('dn-mejamakan', 'furniture', 'Meja Makan & Bangku Panjang', 'Meja kayu panjang dengan tudung saji dan kendi. Duduk, makan bareng!', 12, 'mejamakan', 'dapurnenek', { w: 2, d: 1 }),
  P('dn-petromaks', 'furniture', 'Lampu Petromaks', 'Lampu petromaks yang terang di atas dingklik kayu.', 5, 'petromaks', 'dapurnenek', { w: 1, d: 1 }),
  P('wp-gedek', 'wallpaper', 'Dinding Anyaman Bambu', 'Dinding gedek dari anyaman bambu, adem seperti rumah nenek.', 8, 'gedek', 'dapurnenek'),
  P('sg-angklung', 'furniture', 'Rak Angklung', 'Empat angklung bergantung di rak kayu. Pet bisa memainkannya.', 10, 'rakangklung', 'sanggar', { w: 2, d: 1 }),
  P('sg-kecapi', 'furniture', 'Kecapi', 'Kecapi kayu bersenar dengan ukiran emas di kedua ujungnya.', 11, 'kecapi', 'sanggar', { w: 2, d: 1 }),
  P('sg-kelir', 'furniture', 'Kelir Wayang Mini', 'Layar wayang dengan gunungan dan blencong. Putar ke belakang untuk melihat bayangannya!', 10, 'kelir', 'sanggar', { w: 2, d: 1 }),
  P('sg-membatik', 'furniture', 'Meja Membatik', 'Gawangan dengan kain batik setengah jadi, dingklik, canting, dan malam hangat.', 10, 'membatik', 'sanggar', { w: 2, d: 1 }),
  P('sg-kendang', 'furniture', 'Kendang', 'Kendang kayu bertali di atas dudukannya.', 6, 'gendang', 'sanggar', { w: 1, d: 1 }),
  P('fl-papanjati', 'floor', 'Lantai Parket Jati', 'Lantai kayu jati berpola anyaman, hangat untuk sanggar.', 8, 'papanjati', 'sanggar'),
  P('sp-bakkayu', 'furniture', 'Bak Berendam Kayu', 'Bak kayu berisi air hangat dan kelopak bunga. Pet bisa berendam.', 18, 'bakkayu', 'spabali', { w: 2, d: 1 }),
  P('sp-pancuran', 'furniture', 'Pancuran Batu', 'Pancuran bambu dari dinding batu berukir, airnya gemericik.', 12, 'pancuran', 'spabali', { w: 1, d: 1 }),
  P('sp-kamboja', 'furniture', 'Pot Kamboja', 'Pohon kamboja berbunga putih di pot batu.', 6, 'kamboja', 'spabali', { w: 1, d: 1 }),
  P('sp-rakhanduk', 'furniture', 'Rak Handuk Bambu', 'Tangga bambu dengan handuk-handuk lembut.', 5, 'rakhanduk', 'spabali', { w: 1, d: 1 }),
  P('sp-lilin', 'furniture', 'Lilin Aroma', 'Lilin-lilin kecil yang wangi dan bunga kamboja di nampan batu.', 4, 'lilinaroma', 'spabali', { w: 1, d: 1 }),
  P('fl-batukali', 'floor', 'Lantai Batu Kali', 'Lantai batu sungai yang bulat dan sejuk.', 8, 'batukali', 'spabali'),
];

type SeedActivity = {
  id: string; name: string; targets: string[]; anim: string; effects: Record<string, number>;
  xp: number; coins?: number; reward_item?: string; cooldown_sec: number; daily_limit?: number; message: string;
};
export const SEED_ACTIVITIES_V17: SeedActivity[] = [
  // Dapur Nenek
  { id: 'masak-tungku', name: 'Goreng pisang', targets: ['art:tungku'], anim: 'masak', effects: { kenyang: 4 }, xp: 3, reward_item: 'pisang-goreng', cooldown_sec: 1800, daily_limit: 3, message: '{pet} menggoreng pisang di tungku. Kriuk!' },
  { id: 'cuci-muka-gentong', name: 'Cuci muka', targets: ['art:gentongair'], anim: 'lihat', effects: { bersih: 10, ceria: 3 }, xp: 1, cooldown_sec: 600, message: '{pet} cuci muka pakai air gentong. Segarnya!' },
  { id: 'makan-bareng', name: 'Makan bareng', targets: ['art:mejamakan'], anim: 'duduk', effects: { kenyang: 8, ceria: 6 }, xp: 2, cooldown_sec: 1200, daily_limit: 3, message: '{pet} makan di meja panjang. Masakan nenek paling enak!' },
  { id: 'tata-piring', name: 'Tata piring', targets: ['art:rakpiring'], anim: 'lihat', effects: { ceria: 5 }, xp: 2, coins: 2, cooldown_sec: 900, message: '{pet} menata piring di rak. Rajin!' },
  { id: 'pompa-petromaks', name: 'Pompa petromaks', targets: ['art:petromaks'], anim: 'lihat', effects: { ceria: 5 }, xp: 1, cooldown_sec: 600, message: '{pet} memompa petromaks. Terang benderang!' },
  // Sanggar Seni
  { id: 'main-angklung', name: 'Main angklung', targets: ['art:rakangklung'], anim: 'musik', effects: { ceria: 12, energi: -4 }, xp: 3, cooldown_sec: 900, message: '{pet} menggoyang angklung. Klung-klung-klung!' },
  { id: 'petik-kecapi', name: 'Petik kecapi', targets: ['art:kecapi'], anim: 'musik', effects: { ceria: 12, energi: -3 }, xp: 3, cooldown_sec: 900, message: '{pet} memetik kecapi. Merdu sekali!' },
  { id: 'tabuh-kendang', name: 'Tabuh kendang', targets: ['art:gendang'], anim: 'musik', effects: { ceria: 10, energi: -5 }, xp: 3, cooldown_sec: 900, message: '{pet} menabuh kendang. Tak-dung-tak-dung!' },
  { id: 'main-wayang', name: 'Main wayang', targets: ['art:kelir'], anim: 'lihat', effects: { ceria: 10 }, xp: 2, cooldown_sec: 600, message: '{pet} jadi dalang cilik di depan kelir.' },
  { id: 'membatik', name: 'Membatik', targets: ['art:membatik'], anim: 'lihat', effects: { ceria: 10, energi: -3 }, xp: 3, cooldown_sec: 900, message: '{pet} membatik pakai canting. Malamnya menetes pelan-pelan.' },
  // Spa Bali
  { id: 'mandi-kembang', name: 'Berendam air kembang', targets: ['art:bakkayu'], anim: 'mandi', effects: { bersih: 45, ceria: 8 }, xp: 2, cooldown_sec: 600, message: '{pet} berendam air kembang. Wanginya!' },
  { id: 'basuh-pancuran', name: 'Basuh di pancuran', targets: ['art:pancuran'], anim: 'lihat', effects: { bersih: 12, ceria: 4 }, xp: 1, cooldown_sec: 600, message: '{pet} membasuh muka di pancuran. Sejuk!' },
  { id: 'siram-kamboja', name: 'Siram kamboja', targets: ['art:kamboja'], anim: 'siram', effects: { ceria: 5 }, xp: 2, coins: 2, cooldown_sec: 600, message: '{pet} menyiram pohon kamboja. Bunganya wangi!' },
  { id: 'handukan', name: 'Handukan', targets: ['art:rakhanduk'], anim: 'lihat', effects: { bersih: 5, ceria: 3 }, xp: 1, cooldown_sec: 600, message: '{pet} mengeringkan bulu dengan handuk lembut.' },
  { id: 'hirup-aroma', name: 'Hirup aroma', targets: ['art:lilinaroma'], anim: 'lihat', effects: { energi: 6, ceria: 4 }, xp: 1, cooldown_sec: 900, message: '{pet} menghirup wangi lilin aroma. Tenang sekali...' },
];

export async function seedPackV17(db: Db) {
  // penanda sendiri per paket (bukan hanya angka content_pack), seperti paket 11–16
  if (await db.one(`select 1 from settings where key = 'pack_premium2'`)) return false;
  await db.tx(async (t) => {
    let sort = (await t.one<{ m: number }>('select coalesce(max(sort), 0)::int m from items'))!.m;
    for (const it of SEED_ITEMS_V17) {
      await t.query(
        `insert into items (id, kind, name, description, price_coin, price_pearl, sell_coin, shop, art, data, sort)
         values ($1,$2,$3,$4,0,$5,0,$6,$7::text::jsonb,$8::text::jsonb,$9) on conflict (id) do nothing`,
        [it.id, it.kind, it.name, it.description, it.price_pearl, it.shop, JSON.stringify(it.art), JSON.stringify(it.data), (sort += 10)],
      );
    }
    let asort = (await t.one<{ m: number }>('select coalesce(max(sort), 0)::int m from activities'))!.m;
    for (const a of SEED_ACTIVITIES_V17) {
      await t.query(
        `insert into activities (id, name, targets, anim, effects, xp, coins, reward_item, cooldown_sec, daily_limit, message, sort)
         values ($1,$2,$3::text::jsonb,$4,$5::text::jsonb,$6,$7,$8,$9,$10,$11,$12) on conflict (id) do nothing`,
        [a.id, a.name, JSON.stringify(a.targets), a.anim, JSON.stringify(a.effects), a.xp, a.coins ?? 0, a.reward_item ?? null, a.cooldown_sec, a.daily_limit ?? 0, a.message, (asort += 10)],
      );
    }
    // katalog berubah: PWA yang menyimpan katalog lama memuat ulang
    await t.query(`insert into settings (key, value) values ('catalog_version', to_jsonb(1)) on conflict (key) do update set value = to_jsonb((settings.value)::text::int + 1), updated_at = now()`);
    await t.query(`insert into settings (key, value) values ('pack_premium2', 'true'::jsonb) on conflict (key) do nothing`);
    await t.query(`insert into settings (key, value) values ('content_pack', '17'::jsonb) on conflict (key) do update set value = to_jsonb(greatest((settings.value)::text::int, 17))`);
  });
  return true;
}
