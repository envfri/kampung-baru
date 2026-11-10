import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index';
import { bad, notFound } from '../lib/core';
import { audit, requireAdmin, requireUser } from '../lib/auth';
import { PREF_KINDS, vapidPublicKey } from '../lib/push';
import { notifyEvent } from '../lib/notify';
import { emailableUsers, mailEnabled } from '../lib/mail';
import { waEnabled } from '../lib/klikflow';
import { runJobs } from '../lib/worker';
import { isoDate, obj, oneOf, str } from '../lib/validate';

const URLS = ['/', '/#map', '/#shop', '/#friends', '/#daily', '/#news', '/#pearls', '/#garden'];
const SEGMENTS = ['all', 'active7', 'inactive7', 'payers', 'guests'] as const;

export default async function notifyRoutes(app: FastifyInstance, { db }: { db: Db }) {
  const auth = { preHandler: requireUser(db) };

  app.get('/api/push/key', async () => ({ publicKey: vapidPublicKey() }));

  app.post('/api/push/subscribe', { ...auth, config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async (req: any) => {
    const sub = obj(req.body?.subscription, 'Langganan');
    const endpoint = str(sub.endpoint, 'Endpoint', { max: 1000 })!;
    if (!/^https:\/\//.test(endpoint)) throw bad('invalid', 'Endpoint push tidak valid.');
    const keys = obj(sub.keys, 'Kunci');
    const p256dh = str(keys.p256dh, 'p256dh', { max: 200 })!;
    const auth2 = str(keys.auth, 'auth', { max: 100 })!;
    await db.query(
      `insert into push_subscriptions (user_id, endpoint, p256dh, auth, user_agent) values ($1,$2,$3,$4,$5)
       on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, fail_count = 0`,
      [req.user!.id, endpoint, p256dh, auth2, String(req.headers['user-agent'] ?? '').slice(0, 200)],
    );
    return { ok: true };
  });

  app.post('/api/push/unsubscribe', auth, async (req: any) => {
    await db.query(`delete from push_subscriptions where user_id = $1 and endpoint = $2`, [req.user!.id, String(req.body?.endpoint ?? '')]);
    return { ok: true };
  });

  app.post('/api/push/test', { ...auth, config: { rateLimit: { max: 5, timeWindow: '10 minutes' } } }, async (req: any) => {
    const n = (await db.one<{ c: number }>(`select count(*)::int c from push_subscriptions where user_id = $1`, [req.user!.id]))!.c;
    await notifyEvent(db, req.user!.id, 'push_test', {}, { log: req.log });
    return { ok: true, devices: n };
  });

  app.get('/api/notifications', auth, async (req) => {
    const items = await db.query(`select id, kind, title, body, url, created_at, read_at from notifications where user_id = $1 order by id desc limit 50`, [req.user!.id]);
    return { items, unread: items.filter((i: any) => !i.read_at).length };
  });

  app.post('/api/notifications/read', auth, async (req) => {
    await db.query(`update notifications set read_at = now() where user_id = $1 and read_at is null`, [req.user!.id]);
    return { ok: true };
  });

  app.post('/api/notify/prefs', auth, async (req: any) => {
    const b = obj(req.body?.prefs, 'Preferensi');
    const prefs: Record<string, boolean> = {};
    for (const k of [...PREF_KINDS, 'email', 'whatsapp']) if (k in b) prefs[k] = b[k] === true;
    const r = await db.one<{ notify_prefs: any }>(`update users set notify_prefs = notify_prefs || $2::text::jsonb where id = $1 returning notify_prefs`, [req.user!.id, JSON.stringify(prefs)]);
    return { ok: true, prefs: r?.notify_prefs ?? {} };
  });

  /* ---------------- admin ---------------- */

  app.get('/api/admin/broadcasts', { preHandler: requireAdmin(db, 'admin') }, async () => {
    const [list, devices, users, sent7, emailUsers, waUsers] = await Promise.all([
      db.query(`select * from broadcasts order by id desc limit 100`),
      db.one<{ c: number }>(`select count(*)::int c from push_subscriptions`),
      db.one<{ c: number }>(`select count(distinct user_id)::int c from push_subscriptions`),
      db.one<{ c: number }>(`select coalesce(sum(pushed),0)::int c from broadcasts where sent_at > now() - interval '7 days'`),
      mailEnabled() ? emailableUsers(db) : Promise.resolve(0),
      db.one<{ c: number }>(`select count(*)::int c from users where wa_verified_at is not null and banned_at is null and coalesce((notify_prefs->>'whatsapp')::boolean, true)`),
    ]);
    return {
      broadcasts: list,
      stats: { devices: devices?.c ?? 0, users: users?.c ?? 0, sent7: sent7?.c ?? 0, emailUsers, emailEnabled: mailEnabled(), waUsers: waUsers?.c ?? 0, waEnabled: waEnabled() },
    };
  });

  app.post('/api/admin/broadcasts', { preHandler: requireAdmin(db, 'admin') }, async (req: any) => {
    const title = str(req.body?.title, 'Judul', { min: 2, max: 60 })!;
    const body = str(req.body?.body, 'Isi', { min: 2, max: 160 })!;
    const url = oneOf(req.body?.url ?? '/', 'Tujuan', URLS);
    const segment = oneOf(req.body?.segment ?? 'all', 'Penerima', SEGMENTS);
    const sendAt = isoDate(req.body?.sendAt, 'Jadwal', true) ?? new Date();
    const email = req.body?.email === true && mailEnabled();
    const whatsapp = req.body?.whatsapp === true && waEnabled();
    const r = await db.one<{ id: number }>(
      `insert into broadcasts (title, body, url, segment, send_at, created_by, email, whatsapp) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [title, body, url, segment, sendAt, req.admin!.email, email, whatsapp],
    );
    await audit(db, req, 'broadcast_create', String(r!.id), { title, segment, sendAt, email, whatsapp });
    if (sendAt.getTime() <= Date.now() + 1000) void runJobs(db, req.log).catch((e) => req.log.error(e));
    return { ok: true, id: r!.id };
  });

  app.delete('/api/admin/broadcasts/:id', { preHandler: requireAdmin(db, 'admin') }, async (req: any) => {
    const r = await db.one(`update broadcasts set status = 'cancelled' where id = $1 and status = 'scheduled' returning id`, [Number(req.params.id)]);
    if (!r) throw notFound('Broadcast tidak ditemukan atau sudah dikirim.');
    await audit(db, req, 'broadcast_cancel', String(req.params.id));
    return { ok: true };
  });

  app.post('/api/admin/players/:id/notify', { preHandler: requireAdmin(db, 'admin') }, async (req: any) => {
    const id = String(req.params.id);
    const title = str(req.body?.title, 'Judul', { min: 2, max: 60 })!;
    const body = str(req.body?.body, 'Isi', { min: 2, max: 160 })!;
    await notifyEvent(db, id, 'admin_message', { judul: title, isi: body }, { log: req.log });
    await audit(db, req, 'player_notify', id, { title });
    return { ok: true };
  });
}
