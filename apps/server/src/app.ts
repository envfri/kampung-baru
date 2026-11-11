import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './config';
import { openDb, migrate, type Db } from './db/index';
import { seed, seedPacks, seedPackV3, seedPackV4, seedPackV5, seedPackV6, seedPackV7, seedPackV8 } from './db/seed';
import { HttpError, sha256, setTrackHook } from './lib/core';
import { loadAdmin } from './lib/auth';
import { getSite, indexStatus, maintenanceInfo, maintenanceOpen, maintenanceResponse, ogImage, renderIndex, retryAfter, seoHead, type Invite } from './lib/site';
import { questEvent, seedQuests } from './lib/quests';
import authRoutes from './routes/auth';
import gameRoutes from './routes/game';
import socialRoutes from './routes/social';
import activityRoutes from './routes/activities';
import paymentRoutes from './routes/payments';
import adminRoutes, { ensureAdmin } from './routes/admin';
import notifyRoutes from './routes/notify';
import minigameRoutes from './routes/minigames';
import emailRoutes from './routes/email';
import waRoutes from './routes/wa';
import notifyCenterRoutes from './routes/notify-center';
import systemRoutes from './routes/system';
import duelRoutes from './routes/duels';
import launchRoutes from './routes/launch';
import houseRoutes from './routes/house';
import squareRoutes from './routes/square';
import siteRoutes from './routes/site';
import { BUILD, recordDeploy } from './lib/version';
import { migrateNotifySettings } from './lib/notify-config';
import { eventPoints } from './lib/events';
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
  if (await seedPacks(db)) app.log.info('Paket konten v2 (aksesori, mebel, makanan, ikan) ditambahkan');
  if (await seedPackV3(db)) app.log.info('Paket konten v3 (Balai Main, hadiah event) ditambahkan');
  if (await seedPackV4(db)) app.log.info('Paket konten v4 (Toko Bangunan, ruangan, aktivitas di rumah) ditambahkan');
  if (await seedPackV5(db)) app.log.info('Paket konten v5 (Warung Jamu, olahraga, lencana) ditambahkan');
  if (await seedPackV6(db)) app.log.info('Paket konten v6 (duel dengan teman) ditambahkan');
  if (await seedPackV7(db)) app.log.info('Paket konten v7 (kunjungan bareng) ditambahkan');
  if (await seedPackV8(db)) app.log.info('Paket konten v8 (alun-alun) ditambahkan');
  await migrateNotifySettings(db);
  if (await recordDeploy(db)) app.log.info({ version: BUILD.version, commit: BUILD.commit }, 'versi baru berjalan');
  setTrackHook(async (d, u, n, p) => { await questEvent(d, u, n, p); await eventPoints(d, u, n, p); });
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
    // API, panel admin, dan halaman bayar tidak untuk mesin pencari
    if (/^\/(api\/|admin|pay\/)/.test(req.url)) reply.header('X-Robots-Tag', 'noindex, nofollow');
    return payload;
  });

  // Mode perawatan (admin › Situs & SEO): pemain melihat halaman perawatan (HTTP 503 + Retry-After supaya
  // Google tidak menghapus halaman dari indeks). Panel admin, webhook, file statis, dan cek kesehatan tetap jalan;
  // admin yang sedang masuk di browser yang sama tetap bisa main (bila adminBypass).
  app.addHook('onRequest', async (req, reply) => {
    const s = await getSite(db);
    if (!s.maintenance.on) return;
    const path = req.url.split('?')[0];
    if (maintenanceOpen(path)) return;
    if (s.maintenance.adminBypass !== false && (await loadAdmin(db, req))) return;
    reply.header('Retry-After', String(retryAfter(s))).header('Cache-Control', 'no-store');
    const info = maintenanceInfo(s);
    if (!path.startsWith('/api/') && (req.method === 'GET' || req.method === 'HEAD')) {
      const { html, csp } = maintenanceResponse(s);
      return reply.code(503).header('Content-Security-Policy', csp).type('text/html; charset=utf-8').send(html);
    }
    return reply.code(503).send({ error: { code: 'maintenance', message: info.title, maintenance: info } });
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
  await app.register(minigameRoutes, { db });
  await app.register(emailRoutes, { db });
  await app.register(waRoutes, { db });
  await app.register(notifyCenterRoutes, { db });
  await app.register(systemRoutes, { db });
  await app.register(duelRoutes, { db });
  await app.register(launchRoutes, { db });
  await app.register(houseRoutes, { db });
  await app.register(squareRoutes, { db });
  await app.register(siteRoutes, { db });

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
  // Pengundang dari tautan ?undang=KODE untuk pratinjau tautan ("Mochi ngajak kamu main BUPI!"), disimpan sebentar
  const invites = new Map<string, { at: number; v: Invite | null }>();
  async function inviteOf(raw: unknown): Promise<Invite | null> {
    const code = String(raw ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9-]{4,16}$/.test(code)) return null;
    const hit = invites.get(code);
    if (hit && Date.now() - hit.at < 10 * 60_000) return hit.v;
    const u = await db.one<{ display_name: string; pet: string | null }>(
      `select u.display_name, (select p.name from pets p where p.user_id = u.id limit 1) pet from users u where u.friend_code = $1 and u.banned_at is null`, [code]);
    const name = u ? (u.display_name && u.display_name !== 'Tamu' ? u.display_name : u.pet) : null;
    const v = name ? { name, code } : null;
    if (invites.size > 5000) invites.clear();
    invites.set(code, { at: Date.now(), v });
    return v;
  }
  /** index.html game + tag SEO/pratinjau tautan dari pengaturan Situs & SEO. */
  const sendGame = async (req: any, reply: any) => {
    const s = await getSite(db);
    const ix = indexStatus(s);
    const path = req.url.split('?')[0];
    const invite = req.query?.undang ? await inviteOf(req.query.undang).catch(() => null) : null;
    const head = seoHead(s, await ogImage(db, s), { path, invite, indexable: ix.indexable });
    reply.header('Cache-Control', 'no-cache').header('Content-Security-Policy', csp).type('text/html; charset=utf-8');
    if (!ix.indexable || path !== '/') reply.header('X-Robots-Tag', 'noindex');
    return reply.send(renderIndex(gameIndex, head));
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
    app.get('/', sendGame);
  }
  app.setNotFoundHandler((req, reply) => {
    if (req.method === 'GET' && !req.url.startsWith('/api/') && !req.url.startsWith('/media/') && existsSync(gameIndex) && !/\.\w{2,5}(\?|$)/.test(req.url)) {
      return sendGame(req, reply);
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
