// Paket konten 15: Jepret & Bagikan ke Story. Satu tugas harian kecil di kumpulan tugas harian ("Bagikan 1 foto",
// 10 koin + 2 XP; Ke sana = buka Jepret). Tugas yang sudah ada & ubahan admin tidak disentuh.
import type { Db } from './index';

export async function seedPackV15(db: Db) {
  // penanda sendiri per paket (bukan hanya angka content_pack), seperti paket 11–14
  if (await db.one(`select 1 from settings where key = 'pack_jepret'`)) return false;
  await db.tx(async (t) => {
    await t.query(
      `insert into quests (id, kind, title, description, event, filter, target, reward_coin, reward_pearl, reward_xp, url, sort)
       values ('h-bagikan', 'daily', 'Bagikan 1 foto', 'Jepret atau Foto bareng, lalu Bagikan atau simpan ke galeri.', 'share', '{}'::jsonb, 1, 10, 0, 2, '/#jepret', 160)
       on conflict (id) do nothing`,
    );
    await t.query(`insert into settings (key, value) values ('pack_jepret', 'true'::jsonb) on conflict (key) do nothing`);
    await t.query(`insert into settings (key, value) values ('content_pack', '15'::jsonb) on conflict (key) do update set value = to_jsonb(greatest((settings.value)::text::int, 15))`);
  });
  return true;
}
