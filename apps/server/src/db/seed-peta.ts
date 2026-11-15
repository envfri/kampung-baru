// Paket konten 16: letak Alun-alun & Lapangan Lomba di peta kampung ditukar. Alun-alun pindah ke kiri bawah
// (di samping Kebun, dekat Rumahku), Lapangan Lomba ke ujung kanan. Hanya bila keduanya masih di letak bawaan:
// letak yang sudah diubah admin tidak disentuh.
import type { Db } from './index';
import { bumpCatalog } from '../lib/core';

/** letak bawaan lama & baru (koordinat peta: label di x,y) */
export const PETA_TUKAR = {
  alun: { from: { x: 1150, y: 412 }, to: { x: 300, y: 412 } },
  lapangan: { from: { x: 304, y: 384 }, to: { x: 1150, y: 384 } },
} as const;

export async function seedPackV16(db: Db) {
  if (await db.one(`select 1 from settings where key = 'pack_peta_tukar'`)) return false;
  let moved = false;
  await db.tx(async (t) => {
    const rows = await t.query<{ id: string; x: number; y: number }>(`select id, x, y from locations where id in ('alun', 'lapangan')`);
    const at = (id: keyof typeof PETA_TUKAR) => rows.find((r) => r.id === id);
    const def = (id: keyof typeof PETA_TUKAR) => { const r = at(id); return !!r && Number(r.x) === PETA_TUKAR[id].from.x && Number(r.y) === PETA_TUKAR[id].from.y; };
    if (def('alun') && def('lapangan')) {
      for (const id of ['alun', 'lapangan'] as const) await t.query(`update locations set x = $2, y = $3 where id = $1`, [id, PETA_TUKAR[id].to.x, PETA_TUKAR[id].to.y]);
      moved = true;
    }
    await t.query(`insert into settings (key, value) values ('pack_peta_tukar', 'true'::jsonb) on conflict (key) do nothing`);
    await t.query(`insert into settings (key, value) values ('content_pack', '16'::jsonb) on conflict (key) do update set value = to_jsonb(greatest((settings.value)::text::int, 16))`);
  });
  // peta di HP pemain dimuat ulang (katalog berversi)
  if (moved) await bumpCatalog(db);
  return moved;
}
