// Paket konten 23: Sahabat Mungil.
// - 9 sahabat sebagai item jenis 'sahabat' (nama, keterangan & harga bisa diatur admin di Item & harga):
//   Anak Ayam (gratis, sahabat pertama), Umang-umang (250 koin) & Anak Bebek (400 koin) di Pondok Sahabat, Kura-kura
//   (tangkapan langka Kolam Pancing), Burung Pipit (datang ke Tempat Minum Burung / Sangkar Burung di Halaman),
//   Kunang-kunang (halaman malam hari), Kelinci Mini & Hamster Pipi Tembam (12 Mutiara) & Landak Mini (15 Mutiara) di
//   Toko Mutiara (juga ditawarkan di Pondok Sahabat).
// - Camilan Sahabat (5 koin, Pondok Sahabat) & Kerang Hias (oleh-oleh, bisa dijual di Pasar Pagi).
// - Peta: Pondok Sahabat (jenis 'sahabat', di atas deret toko di antara Toko Mutiara & Balai Main; tidak menimpa jalan,
//   tempat lain, atau labelnya — lihat test/peta.test.ts & sahabat.test.ts).
// - Tugas harian "Beri makan sahabat", lencana Kawan Satwa I–III (3 / 6 / 9 sahabat) & Sahabat Sejati.
// Item, lokasi, tugas, dan ubahan admin yang sudah ada tidak ditimpa (on conflict do nothing).
import type { Db } from './index';
import { SAHABAT_INFO, SAHABAT_BIASA, SAHABAT_CAMILAN, SAHABAT_LOC, UMANG_COLORS, UMANG_DEFAULT, type SahabatSp } from '@kb/shared';
import { invalidateQuests } from '../lib/quests';

type SeedItem = { id: string; kind: 'sahabat' | 'material'; name: string; description: string; price_coin: number; price_pearl: number; sell_coin: number; shop: string | null; art: any; data: Record<string, unknown> };

const DESC: Partial<Record<SahabatSp, string>> = {
  ayam: 'Anak ayam kuning yang suka mematuk-matuk lantai. Sahabat pertama, gratis: cari di depan pintu rumahmu.',
  umang: 'Umang-umang mungil dengan rumah kerang yang bisa kamu ganti warnanya. Suka bersembunyi kalau diketuk.',
  bebek: 'Anak bebek yang berjalan megal-megol di belakang pet-mu. Kwek!',
  kura: 'Kura-kura kecil yang pelan tapi setia. Kadang ikut tersangkut kail di Kolam Pancing.',
  pipit: 'Burung pipit yang suka terbang lalu hinggap di kepala pet-mu. Datang sendiri ke Tempat Minum Burung atau Sangkar Burung di Halaman.',
  kunang: 'Kunang-kunang yang bercahaya lembut di sekitar pet-mu. Muncul di halaman saat malam.',
  kelinci: 'Kelinci mini berbulu putih yang melompat-lompat riang.',
  hamster: 'Hamster bulat yang pipinya menggembung setiap diberi camilan.',
  landak: 'Landak mini yang menggulung jadi bola berduri kalau diketuk. Tenang, tidak menusuk!',
};
/** harga bawaan: koin di Pondok Sahabat, Mutiara di Toko Mutiara */
const PRICE: Partial<Record<SahabatSp, { coin?: number; pearl?: number }>> = { umang: { coin: 250 }, bebek: { coin: 400 }, kelinci: { pearl: 12 }, hamster: { pearl: 12 }, landak: { pearl: 15 } };

// sahabat biasa saja: sahabat Edisi Natal ditambahkan paket konten 24 (seed-natal.ts)
export const SAHABAT_ITEMS: SeedItem[] = [
  ...SAHABAT_BIASA.map((sp): SeedItem => {
    const p = PRICE[sp];
    return {
      id: SAHABAT_INFO[sp].item, kind: 'sahabat', name: SAHABAT_INFO[sp].name, description: DESC[sp] ?? SAHABAT_INFO[sp].sifat,
      price_coin: p?.coin ?? 0, price_pearl: p?.pearl ?? 0, sell_coin: 0,
      shop: p?.coin ? SAHABAT_LOC : p?.pearl ? 'mutiara' : null,
      art: { type: 'builtin', key: `sahabat${sp}`, ...(sp === 'umang' ? { colors: { main: UMANG_COLORS[UMANG_DEFAULT].main } } : {}) },
      data: { sp, how: SAHABAT_INFO[sp].how },
    };
  }),
  { id: SAHABAT_CAMILAN, kind: 'material', name: 'Camilan Sahabat', description: 'Biji-bijian, sayur kering & buah mungil untuk sahabat. Beri sekali sehari supaya makin akrab.', price_coin: 5, price_pearl: 0, sell_coin: 0, shop: SAHABAT_LOC, art: { type: 'builtin', key: 'camilansahabat' }, data: { sahabatSnack: true } },
  { id: 'kerang-hias', kind: 'material', name: 'Kerang Hias', description: 'Kerang merah muda yang berkilau, oleh-oleh dari sahabat. Bisa dijual di Pasar Pagi.', price_coin: 0, price_pearl: 0, sell_coin: 8, shop: null, art: { type: 'builtin', key: 'keranghias' }, data: {} },
];

/** letak bawaan (label di x,y): di atas deret toko, di celah antara Toko Mutiara & Balai Main (jalan setapak ke atas) */
export const SAHABAT_LOCATION = { id: SAHABAT_LOC, name: 'Pondok Sahabat', kind: 'sahabat', x: 774, y: 72, sort: 16 } as const;

type Q = { id: string; kind: 'daily' | 'badge'; title: string; description: string; event: string; filter: Record<string, string>; target: number; coin: number; pearl: number; xp: number; sort: number };
export const SAHABAT_QUESTS: Q[] = [
  { id: 'h-sahabat', kind: 'daily', title: 'Beri makan sahabat', description: 'Beri Camilan Sahabat ke salah satu sahabatmu.', event: 'sahabat_makan', filter: {}, target: 1, coin: 15, pearl: 0, xp: 4, sort: 170 },
  { id: 'b-sahabat-3', kind: 'badge', title: 'Kawan Satwa I', description: 'Punya 3 sahabat mungil.', event: 'sahabat_baru', filter: {}, target: 3, coin: 60, pearl: 0, xp: 10, sort: 750 },
  { id: 'b-sahabat-6', kind: 'badge', title: 'Kawan Satwa II', description: 'Punya 6 sahabat mungil.', event: 'sahabat_baru', filter: {}, target: 6, coin: 0, pearl: 2, xp: 20, sort: 751 },
  { id: 'b-sahabat-9', kind: 'badge', title: 'Kawan Satwa III', description: 'Punya 9 sahabat mungil.', event: 'sahabat_baru', filter: {}, target: 9, coin: 0, pearl: 5, xp: 30, sort: 752 },
  { id: 'b-sahabat-sejati', kind: 'badge', title: 'Sahabat Sejati', description: 'Satu sahabat naik ke Sahabat Sejati.', event: 'sahabat_sejati', filter: {}, target: 1, coin: 0, pearl: 3, xp: 25, sort: 753 },
];

export async function seedPackV23(db: Db) {
  if (await db.one(`select 1 from settings where key = 'pack_sahabat'`)) return false;
  await db.tx(async (t) => {
    let sort = (await t.one<{ m: number }>('select coalesce(max(sort), 0)::int m from items'))!.m;
    for (const it of SAHABAT_ITEMS) {
      await t.query(
        `insert into items (id, kind, name, description, price_coin, price_pearl, sell_coin, shop, art, data, sort)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9::text::jsonb,$10::text::jsonb,$11) on conflict (id) do nothing`,
        [it.id, it.kind, it.name, it.description, it.price_coin, it.price_pearl, it.sell_coin, it.shop, JSON.stringify(it.art), JSON.stringify(it.data), (sort += 10)],
      );
    }
    const l = SAHABAT_LOCATION;
    await t.query(`insert into locations (id, name, kind, x, y, style, sort) values ($1,$2,$3,$4,$5,'{}'::jsonb,$6) on conflict (id) do nothing`, [l.id, l.name, l.kind, l.x, l.y, l.sort]);
    for (const q of SAHABAT_QUESTS) {
      await t.query(
        `insert into quests (id, kind, title, description, event, filter, target, reward_coin, reward_pearl, reward_xp, url, sort)
         values ($1,$2,$3,$4,$5,$6::text::jsonb,$7,$8,$9,$10,'/#sahabat',$11) on conflict (id) do nothing`,
        [q.id, q.kind, q.title, q.description, q.event, JSON.stringify(q.filter), q.target, q.coin, q.pearl, q.xp, q.sort],
      );
    }
    // katalog berubah (sahabat, camilan & tempat baru di peta): PWA yang menyimpan katalog lama memuat ulang
    await t.query(`insert into settings (key, value) values ('catalog_version', to_jsonb(1)) on conflict (key) do update set value = to_jsonb((settings.value)::text::int + 1), updated_at = now()`);
    await t.query(`insert into settings (key, value) values ('pack_sahabat', 'true'::jsonb) on conflict (key) do nothing`);
    await t.query(`insert into settings (key, value) values ('content_pack', '23'::jsonb) on conflict (key) do update set value = to_jsonb(greatest((settings.value)::text::int, 23))`);
  });
  invalidateQuests();
  return true;
}
