import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './config';
import { openDb, migrate, type Db } from './db/index';
import { seed } from './db/seed';
import { HttpError, sha256, setTrackHook } from './lib/core';
import { questEvent, seedQuests } from './lib/quests';
import authRoutes from './routes/auth';
import gameRoutes from './routes/game';
import socialRoutes from './routes/social';
import activityRoutes from './routes/activities';
import paymentRoutes from './routes/payments';
import adminRoutes, { ensureAdmin } from './routes/admin';
import notifyRoutes from './routes/notify';
import { initPush } from './lib/push';
import { startWorker } from './lib/worker';

export interface AppOpts {
  db?: Db;
  memoryDb?: boolean;
  logger?: boolean;
  rateLimit?: boolean;
  worker?: boolean;
}

export async function buildApp(opts: AppOpts = {}): Promise<{ app: FastifyInstance; db: Db }> {
  const app = Fastify({
    logger: opts.logger === false ? false : { level: config.isProd ? 'info' : 'info', redact: ['req.headers.cookie', 'req.headers.authorization'] },
    trustProxy: config.trustProxy,
    bodyLimit: 256 * 1024,
  });

  const db = opts.db ?? (await openDb({ url: config.databaseUrl, dir: config.pgliteDir, memory: opts.memoryDb }));
  await migrate(db);
  if (await seed(db)) app.log.info('Data awal (katalog, lokasi, event) dibuat');
  if (await seedQuests(db)) app.log.info('Tugas pemula & harian dibuat');
  setTrackHook(questEvent);
  await ensureAdmin(db, app.log);
  await initPush(db);

  await app.register(cookie);
  if (opts.rateLimit !== false) {
    let redis: any;
    if (config.redisUrl) {
      const { Redis } = await import('ioredis');
      redis = new Redis(config.redisUrl, { maxRetriesPerRequest: 1, enableOfflineQueue: false });
    }
    // banyak pemain seluler berbagi IP (CGNAT), jadi batas dihitung per sesi bila ada
    await app.register(rateLimit, {
      max: 240,
      timeWindow: '1 minute',
      redis,
      keyGenerator: (req) => {
        const s = (req.cookies as Record<string, string | undefined>)?.kb_s;
        return s ? 's:' + sha256(s).slice(0, 24) : 'ip:' + req.ip;
      },
    });
  }

  // form HTML biasa (halaman simulasi pembayaran)
  app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_req, body, done) => {
    done(null, Object.fromEntries(new URLSearchParams(String(body))));
  });

  app.setErrorHandler((err: any, req, reply) => {
    if (err instanceof HttpError) return reply.code(err.status).send({ error: { code: err.code, message: err.message, ...(err.extra ?? {}) } });
    if (err.statusCode === 429) return reply.code(429).send({ error: { code: 'rate_limited', message: 'Terlalu banyak permintaan. Tunggu sebentar.' } });
    if (err.validation || err.statusCode === 400 || err.statusCode === 413 || err.statusCode === 415) {
      return reply.code(err.statusCode ?? 400).send({ error: { code: 'bad_request', message: 'Permintaan tidak valid.' } });
    }
    req.log.error(err);
    return reply.code(500).send({ error: { code: 'server_error', message: 'Terjadi kesalahan di server. Coba lagi.' } });
  });

  app.addHook('onSend', async (req, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (req.url.startsWith('/api/')) reply.header('Cache-Control', reply.getHeader('Cache-Control') ?? 'no-store');
    return payload;
  });

  app.get('/healthz', async () => {
    await db.one('select 1');
    return { ok: true };
  });

  await app.register(authRoutes, { db });
  await app.register(gameRoutes, { db });
  await app.register(socialRoutes, { db });
  await app.register(activityRoutes, { db });
  await app.register(paymentRoutes, { db });
  await app.register(adminRoutes, { db });
  await app.register(notifyRoutes, { db });

  // gambar upload dari admin
  app.get('/media/:id', async (req: any, reply) => {
    const m = await db.one<{ mime: string; bytes: Buffer }>(`select mime, bytes from media where id = $1`, [String(req.params.id)]);
    if (!m) return reply.code(404).send('Not found');
    reply.header('Cache-Control', 'public, max-age=31536000, immutable');
    reply.header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    return reply.type(m.mime).send(Buffer.from(m.bytes));
  });

  // aplikasi web (hasil build Vite)
  const gameIndex = join(config.gameDist, 'index.html');
  const adminIndex = join(config.adminDist, 'index.html');
  const csp = [
    "default-src 'self'",
    "script-src 'self' https://accounts.google.com https://connect.facebook.net https://app.midtrans.com https://app.sandbox.midtrans.com",
    "style-src 'self' 'unsafe-inline' https://accounts.google.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://accounts.google.com https://graph.facebook.com",
    "frame-src https://accounts.google.com https://www.facebook.com https://app.midtrans.com https://app.sandbox.midtrans.com",
    "worker-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  const sendIndex = (file: string, reply: any) => {
    reply.header('Cache-Control', 'no-cache').header('Content-Security-Policy', csp).type('text/html; charset=utf-8');
    return reply.send(readFileSync(file));
  };
  if (existsSync(config.adminDist)) {
    await app.register(fastifyStatic, {
      root: config.adminDist, prefix: '/admin/', decorateReply: false, index: false, wildcard: false,
      setHeaders: (res, path) => (res as any).header('Cache-Control', path.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache'),
    });
    app.get('/admin', (_req, reply) => reply.redirect('/admin/'));
    app.get('/admin/*', (_req, reply) => sendIndex(adminIndex, reply));
  }
  if (existsSync(config.gameDist)) {
    await app.register(fastifyStatic, {
      root: config.gameDist, prefix: '/', index: false, wildcard: false,
      setHeaders: (res, path) => {
        if (path.includes('/assets/')) (res as any).header('Cache-Control', 'public, max-age=31536000, immutable');
        else (res as any).header('Cache-Control', 'no-cache');
        if (path.endsWith('sw.js')) (res as any).header('Service-Worker-Allowed', '/');
      },
    });
    app.get('/', (_req, reply) => sendIndex(gameIndex, reply));
  }
  app.setNotFoundHandler((req, reply) => {
    if (req.method === 'GET' && !req.url.startsWith('/api/') && !req.url.startsWith('/media/') && existsSync(gameIndex) && !/\.\w{2,5}(\?|$)/.test(req.url)) {
      return sendIndex(gameIndex, reply);
    }
    reply.code(404).send({ error: { code: 'not_found', message: 'Tidak ditemukan' } });
  });

  const stopWorker = opts.worker === false ? () => {} : startWorker(db, app.log);
  app.addHook('onClose', async () => {
    stopWorker();
    if (!opts.db) await db.close();
  });
  return { app, db };
}
