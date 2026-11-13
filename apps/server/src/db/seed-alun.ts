// Paket konten 14: Alun-alun Pojok Wahana (v0.32+). Benda alun-alun ada di kode (@kb/shared ALUN_ITEMS), bukan katalog,
// jadi paket ini hanya menyesuaikan pengaturan yang sudah tersimpan: jatah main berhadiah 10 → 14 (wahana baru).
// Nilai yang sudah diubah admin (bukan 10) dibiarkan. Data pemain tidak disentuh.
import type { Db } from './index';

export async function seedPackV14(db: Db) {
  // penanda sendiri per paket (bukan hanya angka content_pack), jadi urutan rilis paket 11–14 tidak saling melewatkan
  if (await db.one(`select 1 from settings where key = 'pack_alun'`)) return false;
  const game = await db.one<{ value: any }>(`select value from settings where key = 'game'`);
  const sq = game?.value?.square;
  if (sq && typeof sq === 'object' && sq.actsPerDay === 10) {
    await db.query(`update settings set value = jsonb_set(value, '{square,actsPerDay}', '14'::jsonb), updated_at = now() where key = 'game'`);
  }
  await db.query(`insert into settings (key, value) values ('pack_alun', 'true'::jsonb) on conflict (key) do nothing`);
  await db.query(`insert into settings (key, value) values ('content_pack', '14'::jsonb) on conflict (key) do update set value = to_jsonb(greatest((settings.value)::text::int, 14))`);
  return true;
}
