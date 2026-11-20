// Paket konten 21: Kerja Sambilan.
// - Peta: Papan Lowongan (jenis 'jobs', di ujung kanan deret toko, di tepi jalan) & Pos Ronda (jenis 'ronda', di antara
//   Toko Bangunan dan Lapangan Lomba). Letaknya tidak menimpa jalan / tempat lain (lihat test/peta.test.ts).
// - 8 pakaian seragam (6 tempat kerja; Kolam & Ronda dua bagian), tidak dijual di toko: didapat saat naik ke Karyawan.
// - Tugas harian "Kerja sambilan" dan lencana Pekerja Keras I–III (10 / 50 / 100 shift) & Kepala.
// Item, lokasi, tugas, dan ubahan admin yang sudah ada tidak ditimpa (on conflict do nothing).
import type { Db } from './index';
import { invalidateQuests } from '../lib/quests';

type Uniform = { id: string; name: string; description: string; slot: 'head' | 'neck' | 'hand' | 'body'; key: string; place: string };
export const KERJA_UNIFORMS: Uniform[] = [
  { id: 'celemek-warung', name: 'Celemek Warung', slot: 'body', key: 'celemekwarung', place: 'Pasar Pagi', description: 'Celemek oranye bersaku nota, dengan lap belang di bahu. Seragam karyawan warung Pasar Pagi.' },
  { id: 'caping-kebun', name: 'Caping Kebun', slot: 'head', key: 'capingkebun', place: 'Kebun', description: 'Caping anyaman bambu berpita hijau dengan tunas terselip. Seragam karyawan Kebun.' },
  { id: 'topi-kolam', name: 'Topi Kolam', slot: 'head', key: 'topikolam', place: 'Kolam Pancing', description: 'Topi rimba hijau dengan pelampung dan lencana ikan. Seragam karyawan Kolam Pancing.' },
  { id: 'bot-kolam', name: 'Celana Kodok & Sepatu Bot', slot: 'body', key: 'botkolam', place: 'Kolam Pancing', description: 'Celana kodok anti air dan sepatu bot kuning untuk turun ke kolam. Seragam karyawan Kolam Pancing.' },
  { id: 'rompi-bengkel', name: 'Rompi Bengkel Kayu', slot: 'body', key: 'rompibengkel', place: 'Mebel Jati', description: 'Rompi kanvas dengan penggaris lipat, pensil tukang, dan amplas. Seragam karyawan Mebel Jati.' },
  { id: 'pita-meteran', name: 'Pita Meteran', slot: 'neck', key: 'pitameteran', place: 'Butik Benang', description: 'Pita meteran kuning dan bantalan jarum tomat. Seragam karyawan Butik Benang.' },
  { id: 'sarung-ronda', name: 'Sarung Ronda', slot: 'body', key: 'sarungronda', place: 'Pos Ronda', description: 'Jaket gelap dengan sarung kotak diselempangkan dan peluit. Seragam petugas Pos Ronda.' },
  { id: 'kentongan-ronda', name: 'Kentongan Ronda', slot: 'hand', key: 'kentonganronda', place: 'Pos Ronda', description: 'Kentongan bambu dan pemukulnya. Tong, tong, tong! Seragam petugas Pos Ronda.' },
];

/** letak bawaan (koordinat peta: label di x,y) */
export const KERJA_LOCATIONS = [
  { id: 'lowongan', name: 'Papan Lowongan', kind: 'jobs', x: 1160, y: 205, sort: 14 },
  { id: 'ronda', name: 'Pos Ronda', kind: 'ronda', x: 1003, y: 384, sort: 15 },
] as const;

type Q = { id: string; kind: 'daily' | 'badge'; title: string; description: string; event: string; filter: Record<string, string>; target: number; coin: number; pearl: number; xp: number; sort: number };
export const KERJA_QUESTS: Q[] = [
  { id: 'h-kerja', kind: 'daily', title: 'Kerja sambilan', description: 'Selesaikan 1 kerja sambilan sampai pulang, lalu terima gajinya.', event: 'kerja', filter: {}, target: 1, coin: 20, pearl: 0, xp: 4, sort: 160 },
  { id: 'b-kerja-10', kind: 'badge', title: 'Pekerja Keras I', description: 'Selesaikan 10 kerja sambilan.', event: 'kerja', filter: {}, target: 10, coin: 60, pearl: 0, xp: 10, sort: 730 },
  { id: 'b-kerja-50', kind: 'badge', title: 'Pekerja Keras II', description: 'Selesaikan 50 kerja sambilan.', event: 'kerja', filter: {}, target: 50, coin: 0, pearl: 2, xp: 20, sort: 731 },
  { id: 'b-kerja-100', kind: 'badge', title: 'Pekerja Keras III', description: 'Selesaikan 100 kerja sambilan.', event: 'kerja', filter: {}, target: 100, coin: 0, pearl: 3, xp: 30, sort: 732 },
  { id: 'b-kepala', kind: 'badge', title: 'Kepala', description: 'Naik pangkat sampai Kepala di salah satu tempat kerja sambilan.', event: 'kerja_rank', filter: { rank: 'kepala' }, target: 1, coin: 0, pearl: 3, xp: 25, sort: 740 },
];

export async function seedPackV21(db: Db) {
  // penanda sendiri per paket (bukan hanya angka content_pack), seperti paket 11–20
  if (await db.one(`select 1 from settings where key = 'pack_kerja'`)) return false;
  await db.tx(async (t) => {
    let sort = (await t.one<{ m: number }>('select coalesce(max(sort), 0)::int m from items'))!.m;
    for (const u of KERJA_UNIFORMS) {
      // seragam: tidak dijual di toko (shop kosong, tanpa harga) & tidak bisa dijual kembali
      await t.query(
        `insert into items (id, kind, name, description, price_coin, price_pearl, sell_coin, shop, art, data, sort)
         values ($1,'wear',$2,$3,0,0,0,null,$4::text::jsonb,$5::text::jsonb,$6) on conflict (id) do nothing`,
        [u.id, u.name, u.description, JSON.stringify({ type: 'builtin', key: u.key }), JSON.stringify({ slot: u.slot, outfit: `Seragam ${u.place}`, uniform: true }), (sort += 10)],
      );
    }
    for (const l of KERJA_LOCATIONS) {
      await t.query(`insert into locations (id, name, kind, x, y, style, sort) values ($1,$2,$3,$4,$5,'{}'::jsonb,$6) on conflict (id) do nothing`, [l.id, l.name, l.kind, l.x, l.y, l.sort]);
    }
    for (const q of KERJA_QUESTS) {
      await t.query(
        `insert into quests (id, kind, title, description, event, filter, target, reward_coin, reward_pearl, reward_xp, url, sort)
         values ($1,$2,$3,$4,$5,$6::text::jsonb,$7,$8,$9,$10,'/#kerja',$11) on conflict (id) do nothing`,
        [q.id, q.kind, q.title, q.description, q.event, JSON.stringify(q.filter), q.target, q.coin, q.pearl, q.xp, q.sort],
      );
    }
    // katalog berubah (seragam & tempat baru di peta): PWA yang menyimpan katalog lama memuat ulang
    await t.query(`insert into settings (key, value) values ('catalog_version', to_jsonb(1)) on conflict (key) do update set value = to_jsonb((settings.value)::text::int + 1), updated_at = now()`);
    await t.query(`insert into settings (key, value) values ('pack_kerja', 'true'::jsonb) on conflict (key) do nothing`);
    await t.query(`insert into settings (key, value) values ('content_pack', '21'::jsonb) on conflict (key) do update set value = to_jsonb(greatest((settings.value)::text::int, 21))`);
  });
  invalidateQuests();
  return true;
}
