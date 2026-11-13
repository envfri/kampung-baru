// Persiapan peluncuran (admin › Peluncuran):
//  - tarik Mutiara dari pembayaran uji (simulasi / kunci uji ZePay);
//  - cut-off: semua pemain mulai dari 0 supaya setara saat produksi dibuka. Konten & pengaturan admin tetap.
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index';
import { config } from '../config';
import { bad, credit, getSettings, invalidateCaches } from '../lib/core';
import { audit, grantStarter, requireAdmin } from '../lib/auth';
import { zepayMode } from '../lib/zepay';
import { mockLocked } from './payments';
import { APP_VERSION } from '@kb/shared';

export const CUTOFF_PHRASE = 'RESET BUPI';
/** Data progres pemain yang dikosongkan saat cut-off "akun tetap". Akun, login, sesi, notifikasi push & pertemanan tidak disentuh. */
const PROGRESS_TABLES = [
  'pets', 'inventory', 'rooms', 'wallets', 'wallet_ledger', 'cooldowns', 'daily_counters', 'daily_claims', 'visits', 'gifts',
  'garden_plots', 'races', 'fishing_casts', 'fish_collection', 'notifications', 'quest_progress', 'event_progress', 'game_runs',
  'house_likes', 'duels', 'transfer_codes', 'idempotency',
];

export default async function launchRoutes(app: FastifyInstance, { db }: { db: Db }) {
  const adm = { preHandler: requireAdmin(db, 'admin') };
  const own = { preHandler: requireAdmin(db, 'owner') };

  async function stats(q: Db = db) {
    const one = async (sql: string) => (await q.one<any>(sql)) ?? {};
    const [p, w, demo, real, cut] = await Promise.all([
      one(`select count(*)::int players, count(*) filter (where is_guest)::int guests, (select count(*)::int from pets) pets from users`),
      one(`select coalesce(sum(coin),0)::float8 coins, coalesce(sum(pearl),0)::float8 pearls from wallets`),
      one(`select count(*)::int payments, count(distinct user_id)::int users, coalesce(sum(pearls),0)::int pearls from payments where test and status = 'paid' and revoked_at is null`),
      one(`select count(*)::int payments, coalesce(sum(amount_idr),0)::float8 amount, coalesce(sum(pearls),0)::int pearls from payments where not test and status = 'paid'`),
      q.one<{ value: any }>(`select value from settings where key = 'launch_cutoff'`),
    ]);
    return {
      ...p, ...w, demo, real,
      payment: { provider: config.paymentProvider, mode: zepayMode(), production: config.isProd, locked: mockLocked() },
      cutoff: cut?.value ?? null,
    };
  }

  app.get('/api/admin/launch', adm, async () => stats());

  /** Tarik Mutiara dari pembayaran uji yang sudah "lunas". Yang sudah terpakai tidak bisa ditarik (dilaporkan sebagai kekurangan). */
  app.post('/api/admin/launch/revoke-demo', own, async (req: any) => {
    const res = await db.tx(async (t) => {
      const rows = await t.query<{ user_id: string; due: number; ids: string[] }>(
        `select user_id, sum(pearls)::int due, array_agg(id) ids from payments
          where test and status = 'paid' and revoked_at is null group by user_id`);
      let revoked = 0, due = 0, payments = 0;
      for (const r of rows) {
        const w = await t.one<{ pearl: number }>(`select pearl from wallets where user_id = $1 for update`, [r.user_id]);
        const take = Math.min(r.due, w?.pearl ?? 0);
        if (take > 0) await credit(t, r.user_id, 'pearl', -take, 'revoke_demo');
        await t.query(`update payments set revoked_at = now() where id = any($1::uuid[])`, [r.ids]);
        revoked += take; due += r.due; payments += r.ids.length;
      }
      return { users: rows.length, payments, pearls: due, revoked, spent: due - revoked };
    });
    await audit(db, req, 'launch_revoke_demo', undefined, res);
    return { ok: true, ...res, stats: await stats() };
  });

  /**
   * Cut-off peluncuran. mode "progress" (disarankan): akun & cara masuk tetap, semua progres kembali ke awal
   * (pet dibuat ulang, dompet & barang awal). mode "all": semua akun pemain dihapus.
   */
  app.post('/api/admin/launch/reset', own, async (req: any) => {
    const b = req.body ?? {};
    if (String(b.confirm ?? '').trim() !== CUTOFF_PHRASE) throw bad('confirm', `Ketik ${CUTOFF_PHRASE} untuk konfirmasi.`);
    const mode = b.mode === 'all' ? 'all' : 'progress';
    const keepFriends = b.keepFriends !== false;
    const analytics = b.analytics !== false;
    const before = await stats();
    if (before.real.payments > 0) {
      // pembayaran sungguhan: data keuangan tidak boleh ikut terhapus
      if (mode === 'all') throw bad('real_payments', `Sudah ada ${before.real.payments} pembayaran sungguhan. "Hapus semua pemain" tidak bisa dipakai karena catatan pembayaran ikut terhapus; pakai "Reset progres, akun tetap".`);
      if (b.includeReal !== true) throw bad('real_payments', `Sudah ada ${before.real.payments} pembayaran sungguhan. Centang konfirmasi pembayaran sungguhan bila Mutiara itu memang ikut direset.`);
    }
    const s: any = await getSettings(db);
    const result = await db.tx(async (t) => {
      let players = 0;
      if (mode === 'all') {
        players = (await t.query(`delete from users returning id`)).length; // semua tabel pemain ikut terhapus (on delete cascade)
        await t.query(`delete from idempotency`);
        await t.query(`delete from email_otps`);
      } else {
        // catatan pembayaran disimpan (laporan keuangan); pembayaran uji dihapus
        await t.query(`delete from payments where test`);
        await t.query(`update payments set revoked_at = coalesce(revoked_at, now()) where status = 'paid'`);
        for (const tb of PROGRESS_TABLES) await t.query(`delete from ${tb}`);
        await t.query(`update users set garden_level = 1`); // tingkat kebun ikut progres
        // pesan email/WA yang belum terkirim (mis. kabar progres lama) dibatalkan; riwayat kiriman tetap
        await t.query(`delete from outbox where status in ('queued','sending')`);
        if (!keepFriends) await t.query(`delete from friendships`);
        const ids = await t.query<{ id: string }>(`select id from users`);
        const known = new Set((await t.query<{ id: string }>('select id from items')).map((r) => r.id));
        for (const u of ids) await grantStarter(t, u.id, s, known);
        players = ids.length;
      }
      if (analytics) await t.query(`delete from analytics_events`);
      const cut = { at: new Date().toISOString(), mode, by: req.admin!.email, players, keepFriends: mode === 'progress' ? keepFriends : false, analytics, version: APP_VERSION };
      await t.query(`insert into settings (key, value) values ('launch_cutoff', $1::text::jsonb) on conflict (key) do update set value = excluded.value, updated_at = now()`, [JSON.stringify(cut)]);
      return cut;
    });
    invalidateCaches();
    await audit(db, req, 'launch_cutoff', undefined, { ...result, before: { players: before.players, pearls: before.pearls, coins: before.coins } });
    req.log.warn({ cutoff: result }, 'cut-off peluncuran dijalankan');
    return { ok: true, cutoff: result, stats: await stats() };
  });
}
