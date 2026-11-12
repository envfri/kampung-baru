// Panel admin: aksi konten tambahan untuk halaman Item & harga —
// aktifkan / nonaktifkan banyak item sekaligus, dan atur set premium (data.set) satu item.
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index';
import { PREMIUM_SET_BY_KEY } from '@kb/shared';
import { bad, bumpCatalog, notFound } from '../lib/core';
import { audit, requireAdmin } from '../lib/auth';
import { J } from '../lib/state';

const ID = /^[a-z0-9][a-z0-9-]{1,47}$/;

/** daftar ID item dari body (unik, valid, maks 500) */
function itemIds(v: unknown) {
  if (!Array.isArray(v) || !v.length) throw bad('invalid_ids', 'Pilih minimal satu item.');
  const ids = [...new Set(v.map((x) => String(x ?? '').toLowerCase()))].filter((x) => ID.test(x));
  if (!ids.length) throw bad('invalid_ids', 'ID item tidak valid.');
  if (ids.length > 500) throw bad('too_many', 'Maksimal 500 item sekali ubah.');
  return ids;
}

export default async function adminContentRoutes(app: FastifyInstance, { db }: { db: Db }) {
  const adm = { preHandler: requireAdmin(db, 'admin') };

  /* ---------------- item: aktif / nonaktif massal ---------------- */
  app.post('/api/admin/items/bulk-active', adm, async (req: any) => {
    const ids = itemIds(req.body?.ids);
    if (typeof req.body?.active !== 'boolean') throw bad('invalid', 'Status aktif tidak valid.');
    const active: boolean = req.body.active;
    // hanya yang statusnya benar-benar berubah (supaya "Urungkan" tidak ikut mengubah item lain)
    const changed = await db.query<{ id: string }>(
      `update items set active = $2, updated_at = now() where id = any($1::text[]) and active <> $2 returning id`,
      [ids, active],
    );
    if (changed.length) await bumpCatalog(db);
    await audit(db, req, 'item_bulk_active', `${changed.length} item`, { active, ids: changed.slice(0, 100).map((r) => r.id) });
    return { ok: true, count: changed.length, ids: changed.map((r) => r.id) };
  });

  /* ---------------- item: set premium (data.set) ---------------- */
  // Penyimpanan item biasa membersihkan isi data per jenis, jadi set premium diatur lewat endpoint ini.
  app.put('/api/admin/items/:id/set', adm, async (req: any) => {
    const id = String(req.params.id ?? '').toLowerCase();
    if (!ID.test(id)) throw bad('invalid_id', 'ID item tidak valid.');
    const raw = req.body?.set;
    const set = raw === null || raw === undefined || raw === '' ? null : String(raw);
    if (set && !PREMIUM_SET_BY_KEY[set]) throw bad('invalid_set', 'Set premium tidak dikenal.');
    const it = await db.one<{ data: any }>(`select data from items where id = $1`, [id]);
    if (!it) throw notFound('Item tidak ditemukan.');
    const data = { ...(it.data ?? {}) };
    const before = data.set ?? null;
    if (before === set) return { ok: true, set, changed: false };
    if (set) data.set = set; else delete data.set;
    await db.query(`update items set data = $2::text::jsonb, updated_at = now() where id = $1`, [id, J(data)]);
    await bumpCatalog(db);
    await audit(db, req, 'item_set_premium', id, { before, after: set });
    return { ok: true, set, changed: true };
  });
}
