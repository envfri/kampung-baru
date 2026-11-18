// Paket konten 19: "Edisi Spesial" pertama di Toko Mutiara — 8 mebel + 1 dinding + 1 lantai dengan efek bergerak
// (kelopak tabebuya berguguran, ubur-ubur bercahaya, kincir bambu, air mancur kristal, gramofon, lampu lava,
// teleskop & bintang, wayang golek menari, dinding aurora, lantai kolam kaca berisi ikan).
// Item ditandai data.edisi = 1 (tab "✦ Edisi Spesial"), dibeli satuan dengan Mutiara (sedikit di atas item set premium),
// tanpa batas waktu jual (admin bisa mengatur "Berhenti dijual" per item). Aktivitas untuk mebelnya ikut ditambahkan.
// Item, aktivitas, dan ubahan admin yang sudah ada tidak ditimpa (on conflict do nothing).
import type { Db } from './index';

type SeedItem = {
  id: string; kind: 'furniture' | 'wallpaper' | 'floor'; name: string; description: string;
  price_pearl: number; shop: 'mutiara'; art: { type: 'builtin'; key: string }; data: Record<string, unknown>;
};
const E = (id: string, kind: SeedItem['kind'], name: string, description: string, price: number, key: string, data: Record<string, unknown> = {}): SeedItem =>
  ({ id, kind, name, description, price_pearl: price, shop: 'mutiara', art: { type: 'builtin', key }, data: { ...data, edisi: 1 } });

export const SEED_ITEMS_V19: SeedItem[] = [
  E('es-tabebuya', 'furniture', 'Pohon Tabebuya Mekar', 'Pohon tabebuya berbunga merah muda di pot batu. Kelopaknya berguguran pelan-pelan.', 20, 'tabebuya', { w: 1, d: 1 }),
  E('es-uburubur', 'furniture', 'Akuarium Ubur-ubur Bercahaya', 'Akuarium gelap berisi tiga ubur-ubur yang melayang naik-turun dan berpendar lembut.', 22, 'akuariumubur', { w: 2, d: 1 }),
  E('es-kincir', 'furniture', 'Kincir Angin Bambu', 'Kincir bambu di atas tiang, baling-balingnya berputar ditiup angin.', 14, 'kincir', { w: 1, d: 1 }),
  E('es-airmancur', 'furniture', 'Air Mancur Kristal', 'Air mancur marmer dengan kristal bening; airnya memancar dan berkilauan.', 25, 'airmancurkristal', { w: 2, d: 2 }),
  E('es-gramofon', 'furniture', 'Gramofon Antik', 'Gramofon bercorong kuningan. Piringannya berputar dan not musik melayang keluar.', 16, 'gramofon', { w: 1, d: 1 }),
  E('es-lampulava', 'furniture', 'Lampu Lava Pelangi', 'Lampu lava di atas bangku kecil; gumpalannya naik-turun sambil berganti warna.', 12, 'lampulava', { w: 1, d: 1 }),
  E('es-teleskop', 'furniture', 'Teleskop Bintang', 'Teleskop kuningan di atas kaki tiga. Bintang-bintang berkelip di arah bidikannya.', 18, 'teleskop', { w: 1, d: 1 }),
  E('es-wayanggolek', 'furniture', 'Wayang Golek Menari', 'Wayang golek kayu di atas dudukan, bergoyang dan menari pelan.', 15, 'wayanggolek', { w: 1, d: 1 }),
  E('wp-aurora', 'wallpaper', 'Dinding Aurora', 'Dinding biru malam bertabur bintang dengan pita cahaya aurora yang berganti warna pelan.', 15, 'aurora'),
  E('fl-kolamkaca', 'floor', 'Lantai Kolam Kaca', 'Lantai kaca di atas kolam; ikan-ikan kecil berenang di bawah kakimu.', 18, 'kolamkaca'),
];

type SeedActivity = {
  id: string; name: string; targets: string[]; anim: string; effects: Record<string, number>;
  xp: number; coins?: number; reward_item?: string; cooldown_sec: number; daily_limit?: number; message: string;
};
export const SEED_ACTIVITIES_V19: SeedActivity[] = [
  { id: 'tangkap-kelopak', name: 'Tangkap kelopak', targets: ['art:tabebuya'], anim: 'lihat', effects: { ceria: 10 }, xp: 2, cooldown_sec: 600, message: '{pet} menangkap kelopak tabebuya yang berguguran. Cantiknya!' },
  { id: 'lihat-uburubur', name: 'Lihat ubur-ubur', targets: ['art:akuariumubur'], anim: 'lihat', effects: { energi: 8, ceria: 6 }, xp: 2, cooldown_sec: 900, message: '{pet} terpukau melihat ubur-ubur bercahaya. Tenang sekali...' },
  { id: 'tiup-kincir', name: 'Tiup kincir', targets: ['art:kincir'], anim: 'lihat', effects: { ceria: 8 }, xp: 1, cooldown_sec: 600, message: '{pet} meniup kincir bambu. Wuung, berputar kencang!' },
  { id: 'buat-permohonan', name: 'Buat permohonan', targets: ['art:airmancurkristal'], anim: 'lihat', effects: { ceria: 12 }, xp: 3, cooldown_sec: 1800, daily_limit: 3, message: '{pet} membuat permohonan di air mancur kristal. Semoga terkabul!' },
  { id: 'putar-piringan', name: 'Putar piringan hitam', targets: ['art:gramofon'], anim: 'musik', effects: { ceria: 12, energi: -2 }, xp: 3, cooldown_sec: 900, message: '{pet} memutar piringan hitam dan ikut bersenandung.' },
  { id: 'pandangi-lava', name: 'Pandangi lampu lava', targets: ['art:lampulava'], anim: 'lihat', effects: { energi: 6, ceria: 4 }, xp: 1, cooldown_sec: 600, message: '{pet} memandangi lampu lava. Warnanya berganti-ganti!' },
  { id: 'intip-bintang', name: 'Intip bintang', targets: ['art:teleskop'], anim: 'lihat', effects: { ceria: 10 }, xp: 3, cooldown_sec: 1200, message: '{pet} mengintip bintang lewat teleskop. Ada bintang jatuh!' },
  { id: 'jadi-dalang', name: 'Jadi dalang', targets: ['art:wayanggolek'], anim: 'musik', effects: { ceria: 12, energi: -3 }, xp: 3, cooldown_sec: 900, message: '{pet} jadi dalang wayang golek. Wayangnya menari-nari!' },
];

export async function seedPackV19(db: Db) {
  // penanda sendiri per paket (bukan hanya angka content_pack), seperti paket 11–17
  if (await db.one(`select 1 from settings where key = 'pack_edisi1'`)) return false;
  await db.tx(async (t) => {
    let sort = (await t.one<{ m: number }>('select coalesce(max(sort), 0)::int m from items'))!.m;
    for (const it of SEED_ITEMS_V19) {
      await t.query(
        `insert into items (id, kind, name, description, price_coin, price_pearl, sell_coin, shop, art, data, sort)
         values ($1,$2,$3,$4,0,$5,0,$6,$7::text::jsonb,$8::text::jsonb,$9) on conflict (id) do nothing`,
        [it.id, it.kind, it.name, it.description, it.price_pearl, it.shop, JSON.stringify(it.art), JSON.stringify(it.data), (sort += 10)],
      );
    }
    let asort = (await t.one<{ m: number }>('select coalesce(max(sort), 0)::int m from activities'))!.m;
    for (const a of SEED_ACTIVITIES_V19) {
      await t.query(
        `insert into activities (id, name, targets, anim, effects, xp, coins, reward_item, cooldown_sec, daily_limit, message, sort)
         values ($1,$2,$3::text::jsonb,$4,$5::text::jsonb,$6,$7,$8,$9,$10,$11,$12) on conflict (id) do nothing`,
        [a.id, a.name, JSON.stringify(a.targets), a.anim, JSON.stringify(a.effects), a.xp, a.coins ?? 0, a.reward_item ?? null, a.cooldown_sec, a.daily_limit ?? 0, a.message, (asort += 10)],
      );
    }
    // katalog berubah: PWA yang menyimpan katalog lama memuat ulang
    await t.query(`insert into settings (key, value) values ('catalog_version', to_jsonb(1)) on conflict (key) do update set value = to_jsonb((settings.value)::text::int + 1), updated_at = now()`);
    await t.query(`insert into settings (key, value) values ('pack_edisi1', 'true'::jsonb) on conflict (key) do nothing`);
    await t.query(`insert into settings (key, value) values ('content_pack', '19'::jsonb) on conflict (key) do update set value = to_jsonb(greatest((settings.value)::text::int, 19))`);
  });
  return true;
}
