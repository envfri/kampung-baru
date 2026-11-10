// Versi yang terpasang (publik) dan info sistem untuk admin → Versi & changelog.
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index';
import { config } from '../config';
import { requireAdmin } from '../lib/auth';
import { BUILD } from '../lib/version';
import { mailEnabled } from '../lib/mail';
import { klikflowMode, waEnabled } from '../lib/klikflow';
import { zepayMode } from '../lib/zepay';
import { vapidPublicKey } from '../lib/push';

export default async function systemRoutes(app: FastifyInstance, { db }: { db: Db }) {
  app.get('/api/version', async (_req, reply) => {
    reply.header('Cache-Control', 'no-store');
    return BUILD;
  });

  app.get('/api/admin/system', { preHandler: requireAdmin(db, 'moderator') }, async () => {
    const [ver, migrations, deploys] = await Promise.all([
      db.one<{ v: string }>(`select current_setting('server_version') as v`),
      db.query(`select name, applied_at from schema_migrations order by name`),
      db.query(`select id, version, commit, built_at, started_at from deploys order by id desc limit 30`),
    ]);
    return {
      build: BUILD,
      uptimeSec: Math.round(process.uptime()),
      node: process.version,
      env: config.env,
      publicUrl: config.publicUrl,
      database: { kind: db.kind === 'pg' ? 'PostgreSQL' : 'PGlite', version: ver?.v ?? null },
      migrations,
      deploys,
      providers: {
        payments: config.paymentProvider + (config.paymentProvider === 'zepay' && zepayMode() ? ` (${zepayMode()})` : ''),
        email: mailEnabled() ? 'Mailketing' : null,
        whatsapp: waEnabled() ? `Klik Flow${klikflowMode() ? ` (${klikflowMode()})` : ''}` : null,
        push: !!vapidPublicKey(),
      },
    };
  });
}
