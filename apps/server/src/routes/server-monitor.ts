// Admin → Server: pemakaian CPU, memori, penyimpanan, database, aplikasi, pemain live, riwayat & peringatan.
import os from 'node:os';
import { readFile } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import { APP_VERSION, diffPaths } from '@kb/shared';
import type { Db } from '../db/index';
import { config } from '../config';
import { audit, requireAdmin } from '../lib/auth';
import { HttpError } from '../lib/core';
import { BUILD } from '../lib/version';
import { mailEnabled } from '../lib/mail';
import { waEnabled } from '../lib/klikflow';
import { getTemplate } from '../lib/notify-config';
import {
  activeAlerts, cgroupLimits, cleanMonitor, cores, getMonitor, onlineCount, ownerEmails, perMinute, recent, recentErrors,
  requestStats, saveMonitor, sendOwner, slowRoutes, takeSample, pushSample,
} from '../lib/monitor';
import { houseStats } from './house';
import { squareStats } from './square';
import { barengStats } from './bareng';

let distro: string | null | undefined;
async function osName() {
  if (distro === undefined) {
    try { distro = /^PRETTY_NAME="?([^"\n]+)"?/m.exec(await readFile('/etc/os-release', 'utf8'))?.[1] ?? null; } catch { distro = null; }
  }
  return distro;
}
const one = async <T = any>(db: Db, sql: string, params: any[] = []) => { try { return await db.one<T>(sql, params); } catch { return null; } };
const many = async <T = any>(db: Db, sql: string, params: any[] = []) => { try { return await db.query<T>(sql, params); } catch { return [] as T[]; } };

async function dbInfo(db: Db) {
  const [ver, size, conns, max, hit, media, tables] = await Promise.all([
    one<{ v: string }>(db, `select current_setting('server_version') as v`),
    one<{ b: string }>(db, `select pg_database_size(current_database())::text as b`),
    one<{ n: number }>(db, `select count(*)::int as n from pg_stat_activity where datname = current_database()`),
    one<{ n: number }>(db, `select current_setting('max_connections')::int as n`),
    one<{ r: number }>(db, `select sum(blks_hit)::float / nullif(sum(blks_hit) + sum(blks_read), 0) as r from pg_stat_database where datname = current_database()`),
    one<{ b: string }>(db, `select pg_total_relation_size('media')::text as b`),
    many<{ name: string; bytes: string; rows: string }>(db, `select c.relname as name, pg_total_relation_size(c.oid)::text as bytes,
        greatest(c.reltuples::bigint, coalesce(st.n_live_tup, 0), 0)::text as rows
      from pg_class c join pg_namespace n on n.oid = c.relnamespace left join pg_stat_user_tables st on st.relid = c.oid
      where c.relkind = 'r' and n.nspname = 'public' order by pg_total_relation_size(c.oid) desc limit 6`),
  ]);
  return {
    kind: db.kind === 'pg' ? 'PostgreSQL' : 'PGlite', version: ver?.v ?? null,
    size: size ? Number(size.b) : null, conns: conns?.n ?? null, maxConns: max?.n ?? null, cacheHit: hit?.r ?? null,
    media: media ? Number(media.b) : null,
    tables: tables.map((t) => ({ name: t.name, bytes: Number(t.bytes), rows: Number(t.rows) })),
  };
}

/** perkiraan berapa hari lagi disk penuh, dari laju 7 hari terakhir */
async function diskDaysLeft(db: Db, used: number, total: number) {
  const old = await one<{ used: string; at: string }>(db, `select disk_used::text as used, extract(epoch from at)::text as at from server_metrics where at > now() - interval '7 days' and disk_used is not null order by at limit 1`);
  if (!old || !total) return null;
  const days = (Date.now() / 1000 - Number(old.at)) / 86400;
  const rate = (used - Number(old.used)) / Math.max(days, 1e-6);
  if (days < 0.5 || rate <= 0) return null;
  return Math.round((total - used) / rate);
}

async function snapshot(db: Db) {
  let s = recent().at(-1);
  if (!s) { s = await takeSample(db, await onlineCount(db)); pushSample(s); } // sampler belum jalan (mis. baru menyala)
  const [dbi, lim, osn, alerts, mon, owners, tpl, queue, days] = await Promise.all([
    dbInfo(db), cgroupLimits(), osName(),
    many(db, `select id::int, kind, message, value, started_at, ended_at, notified from server_alerts order by started_at desc limit 20`),
    getMonitor(db), ownerEmails(db), getTemplate(db, 'server_alert'),
    many<{ channel: string; n: number }>(db, `select channel, count(*)::int as n from outbox where status in ('queued', 'sending') group by channel`),
    diskDaysLeft(db, s.diskUsed, s.diskTotal),
  ]);
  const pm = perMinute();
  const h = houseStats(), sq = squareStats(), bg = barengStats();
  const rq5 = requestStats(5), rq60 = requestStats(60);
  const active = activeAlerts();
  return {
    at: Date.now(),
    status: active.length ? 'warn' : 'ok',
    active,
    cpu: { pct: s.cpu, proc: s.cpuProc, cores: lim.cpu ?? cores(), load: os.loadavg().map((x) => Math.round(x * 100) / 100), limited: !!lim.cpu },
    mem: { pct: s.mem, used: s.memUsed, total: s.memTotal, rss: s.rss, heapUsed: s.heapUsed, heapTotal: s.heapTotal, limited: !!lim.mem },
    disk: { pct: s.disk, used: s.diskUsed, total: s.diskTotal, daysLeft: days },
    db: { ...dbi, ms: s.dbMs },
    app: {
      loop50: s.loop50, loop99: s.loop99, rpm: Math.round(rq5.rpm), rpmPeak: Math.max(0, ...pm.map((p) => p.rpm)),
      rt50: Math.round(rq5.p50), rt95: Math.round(rq5.p95), errPct: Math.round(rq60.errPct * 100) / 100, err1h: rq60.err, req1h: rq60.n,
      uptimeSec: Math.round(process.uptime()), startedAt: Date.now() - Math.round(process.uptime() * 1000),
      version: APP_VERSION, commit: (BUILD as any)?.commit ?? null,
    },
    players: {
      online: Math.max(s.online, Object.values(h.where).reduce((a, n) => a + n, 0) + sq.people),
      peak: Math.max(s.online, Object.values(h.where).reduce((a, n) => a + n, 0) + sq.people, ...pm.map((p) => p.online)),
      where: { ...h.where, alun: sq.people }, live: h.people + sq.people, houses: h.houses, squares: sq.instances, bareng: bg,
      queue: Object.fromEntries(queue.map((q) => [q.channel, q.n])),
    },
    recent: recent().map((x) => ({ t: x.t, cpu: x.cpu, mem: x.mem, disk: x.disk, online: x.online, rpm: x.rpm, loop99: x.loop99, dbMs: x.dbMs })),
    slow: slowRoutes(60, 6),
    errors: recentErrors().slice(0, 8),
    alerts,
    settings: mon,
    recipients: { owners, emailReady: mailEnabled(), waReady: waEnabled(), templateOn: !!tpl?.enabled, waTemplate: tpl?.waTemplate ?? '' },
    sys: {
      host: os.hostname(), os: osn ?? `${os.type()} ${os.release()}`, kernel: `${os.type()} ${os.release()}`, arch: os.arch(),
      node: process.version, pid: process.pid, cores: cores(), memTotalHost: os.totalmem(), limits: lim,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone, time: new Date().toISOString(), sysUptimeSec: Math.round(os.uptime()),
      dataDir: db.kind === 'pg' ? null : config.pgliteDir, env: config.env,
    },
  };
}

const RANGES: Record<string, { secs: number; bucket: number }> = { '7h': { secs: 7 * 86400, bucket: 20 * 60 }, '30h': { secs: 30 * 86400, bucket: 3600 } };
async function history(db: Db, range: string) {
  if (range === '1j') return recent().map((x) => ({ t: x.t, cpu: x.cpu, mem: x.mem, disk: x.disk, online: x.online, rpm: x.rpm, loop99: x.loop99, err: x.err, rt95: x.rt95, dbMs: x.dbMs }));
  if (range === '24j') { const pm = perMinute(), step = Math.max(1, Math.ceil(pm.length / 480)); return pm.filter((_, i) => i % step === 0 || i === pm.length - 1); }
  const r = RANGES[range] ?? RANGES['7h'];
  const rows = await many<any>(db, `select (floor(extract(epoch from at) / $1) * $1 * 1000)::bigint::text as t, avg(cpu) as cpu, avg(mem) as mem, avg(disk) as disk, max(online) as online,
      avg(rpm) as rpm, avg(loop_p99) as loop99, avg(err) as err, avg(rt_p95) as rt95, avg(db_ms) as db_ms
    from server_metrics where at > now() - ($2 || ' seconds')::interval group by 1 order by 1`, [r.bucket, String(r.secs)]);
  const n = (v: any, d = 1) => (v == null ? 0 : Math.round(Number(v) * 10 ** d) / 10 ** d);
  return rows.map((x) => ({ t: Number(x.t), cpu: n(x.cpu), mem: n(x.mem), disk: n(x.disk), online: n(x.online, 0), rpm: n(x.rpm, 0), loop99: n(x.loop99), err: n(x.err, 2), rt95: n(x.rt95, 0), dbMs: n(x.db_ms) }));
}

export default async function serverMonitorRoutes(app: FastifyInstance, { db }: { db: Db }) {
  const admin = { preHandler: requireAdmin(db, 'admin') };
  app.get('/api/admin/server', admin, async () => snapshot(db));
  app.get('/api/admin/server/history', admin, async (req: any) => {
    const range = ['1j', '24j', '7h', '30h'].includes(req.query?.range) ? req.query.range : '24j';
    return { range, points: await history(db, range) };
  });
  app.put('/api/admin/server/settings', admin, async (req: any) => {
    const before = await getMonitor(db);
    const next = cleanMonitor(req.body ?? {});
    if (req.body?.to?.wa && !next.to.wa) throw new HttpError(400, 'bad_phone', 'Nomor WhatsApp tidak sah. Contoh: 0812xxxx atau 62812xxxx.');
    if (req.body?.to?.email && !next.to.email) throw new HttpError(400, 'bad_email', 'Alamat email tidak sah.');
    await saveMonitor(db, next);
    await audit(db, req, 'server.alerts', 'monitor', { changes: diffPaths(before, next) });
    return { settings: next };
  });
  app.post('/api/admin/server/test', { preHandler: requireAdmin(db, 'admin'), config: { rateLimit: { max: 5, timeWindow: '10 minutes' } } }, async (req: any) => {
    const r = await sendOwner(db, 'Tes peringatan', `Ini pesan uji dari admin → Server, dikirim oleh ${req.admin?.email ?? 'admin'}. Peringatan sungguhan akan terlihat seperti ini.`, req.log);
    await audit(db, req, 'server.alert_test', 'monitor', r);
    return r;
  });
  app.get('/api/admin/server/report', admin, async (_req, reply) => {
    const [snap, day] = await Promise.all([snapshot(db), history(db, '24j')]);
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    reply.header('Content-Disposition', `attachment; filename="bupi-server-${stamp}.json"`).type('application/json');
    return JSON.stringify({ ...snap, history24h: day }, null, 2);
  });
}
