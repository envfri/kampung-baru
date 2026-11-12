// Pemantauan server (admin → Server): CPU, memori, penyimpanan, database, permintaan HTTP & event loop.
// Ringan: satu sampel tiap 10 detik (riwayat 1 jam di memori), rata-rata per menit (24 jam di memori),
// rata-rata 5 menit di database (30 hari). Peringatan ke owner bila ambang terlewati, jeda 30 menit per jenis.
import os from 'node:os';
import { readFile, statfs } from 'node:fs/promises';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import type { FastifyInstance } from 'fastify';
import { APP_VERSION } from '@kb/shared';
import type { Db } from '../db/index';
import { config } from '../config';
import { mailEnabled, noteEmail } from './mail';
import { waEnabled, waPayload } from './klikflow';
import { deliver, enqueue } from './outbox';
import { getChannels, getTemplate } from './notify-config';

/* ================= permintaan HTTP: ember per menit, 60 menit terakhir ================= */
type RouteAgg = { n: number; err: number; d: number[] };
type Minute = { t: number; n: number; err: number; d: number[]; routes: Map<string, RouteAgg> };
const MINUTES: Minute[] = [];
const RES = 300, RRES = 60;
/** reservoir sampling: simpan paling banyak `cap` angka acak dari `n` yang masuk */
const keep = (arr: number[], v: number, cap: number, n: number) => {
  if (arr.length < cap) arr.push(v);
  else { const i = Math.floor(Math.random() * n); if (i < cap) arr[i] = v; }
};
function bucket(now: number) {
  const t = Math.floor(now / 60_000) * 60_000;
  let m = MINUTES[MINUTES.length - 1];
  if (!m || m.t !== t) { m = { t, n: 0, err: 0, d: [], routes: new Map() }; MINUTES.push(m); while (MINUTES.length > 61) MINUTES.shift(); }
  return m;
}
const ERRORS: { at: number; method: string; route: string; status: number; msg: string }[] = [];
export function recordRequest(method: string, route: string, status: number, ms: number, msg = '', now = Date.now()) {
  const m = bucket(now);
  m.n++;
  const bad = status >= 500;
  if (bad) m.err++;
  keep(m.d, ms, RES, m.n);
  const key = `${method} ${route}`;
  let r = m.routes.get(key);
  if (!r) { r = { n: 0, err: 0, d: [] }; m.routes.set(key, r); }
  r.n++; if (bad) r.err++;
  keep(r.d, ms, RRES, r.n);
  if (bad) { ERRORS.push({ at: now, method, route, status, msg: msg.slice(0, 160) }); while (ERRORS.length > 20) ERRORS.shift(); }
}
const pct = (arr: number[], p: number) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};
/** ringkasan permintaan `mins` menit terakhir (tanpa menit yang sedang berjalan bila mins > 1) */
export function requestStats(mins: number, now = Date.now()) {
  const from = Math.floor(now / 60_000) * 60_000 - (mins - 1) * 60_000;
  const list = MINUTES.filter((m) => m.t >= from);
  let n = 0, err = 0; const d: number[] = [];
  for (const m of list) { n += m.n; err += m.err; d.push(...m.d); }
  const span = Math.max(1, Math.min(mins, (now - (list[0]?.t ?? now)) / 60_000 || 1));
  return { n, err, rpm: n / span, errPct: n ? (err / n) * 100 : 0, p50: pct(d, 50), p95: pct(d, 95) };
}
export function slowRoutes(mins = 60, limit = 6, now = Date.now()) {
  const from = now - mins * 60_000;
  const agg = new Map<string, RouteAgg>();
  for (const m of MINUTES) if (m.t >= from) for (const [k, r] of m.routes) {
    const a = agg.get(k) ?? { n: 0, err: 0, d: [] };
    a.n += r.n; a.err += r.err; a.d.push(...r.d); agg.set(k, a);
  }
  return [...agg.entries()].map(([route, a]) => ({ route, n: a.n, err: a.err, p95: Math.round(pct(a.d, 95)) }))
    .sort((a, b) => b.p95 - a.p95).slice(0, limit);
}
export const recentErrors = () => [...ERRORS].reverse();

/* ================= event loop ================= */
const LOOP_RES = 20;
const loop = monitorEventLoopDelay({ resolution: LOOP_RES });
let loopOn = false;

/** pasang pencatat permintaan (hanya /api/, bukan file statis) */
export function installMonitor(app: FastifyInstance) {
  if (!loopOn) { loop.enable(); loopOn = true; }
  const errMsg = new WeakMap<object, string>();
  app.addHook('onError', async (req, _reply, err) => { errMsg.set(req, String(err?.message ?? '')); });
  app.addHook('onResponse', async (req, reply) => {
    const url = req.url;
    if (!url.startsWith('/api/')) return;
    const route = (req as any).routeOptions?.url ?? '(tidak dikenal)';
    recordRequest(req.method, route, reply.statusCode, reply.elapsedTime, errMsg.get(req) ?? '');
  });
}

/* ================= sistem: CPU, memori (memperhitungkan batas container), disk ================= */
const readNum = async (p: string) => { try { const v = (await readFile(p, 'utf8')).trim(); return v === 'max' ? null : Number(v); } catch { return undefined; } };
async function cgroup() {
  // cgroup v2 (Docker modern); v1 sebagai cadangan
  const max = await readNum('/sys/fs/cgroup/memory.max');
  const cur = await readNum('/sys/fs/cgroup/memory.current');
  let memLimit: number | null = null, memUsed: number | null = null;
  if (max !== undefined && cur !== undefined) {
    memLimit = max; memUsed = cur ?? null;
    try { const st = await readFile('/sys/fs/cgroup/memory.stat', 'utf8'); const inact = Number(/inactive_file (\d+)/.exec(st)?.[1] ?? 0); if (memUsed != null) memUsed -= inact; } catch { /* abaikan */ }
  } else {
    const l1 = await readNum('/sys/fs/cgroup/memory/memory.limit_in_bytes');
    const u1 = await readNum('/sys/fs/cgroup/memory/memory.usage_in_bytes');
    if (l1 && u1 != null && l1 < 2 ** 60) { memLimit = l1; memUsed = u1; }
  }
  let cpuLimit: number | null = null, cpuUsec: number | null = null;
  try {
    const [q, p] = (await readFile('/sys/fs/cgroup/cpu.max', 'utf8')).trim().split(/\s+/);
    if (q !== 'max') cpuLimit = Number(q) / Number(p);
    const st = await readFile('/sys/fs/cgroup/cpu.stat', 'utf8');
    cpuUsec = Number(/usage_usec (\d+)/.exec(st)?.[1] ?? NaN);
    if (!Number.isFinite(cpuUsec)) cpuUsec = null;
  } catch { /* bukan cgroup v2 */ }
  return { memLimit, memUsed, cpuLimit, cpuUsec };
}
/** batas container (bila ada): jumlah CPU & memori (byte) */
export async function cgroupLimits() { const c = await cgroup(); return { cpu: c.cpuLimit, mem: c.memLimit && c.memLimit < os.totalmem() * 4 ? c.memLimit : null }; }
async function meminfo() {
  try {
    const t = await readFile('/proc/meminfo', 'utf8');
    const kb = (k: string) => Number(new RegExp(`^${k}:\\s+(\\d+)`, 'm').exec(t)?.[1] ?? NaN) * 1024;
    const total = kb('MemTotal'), avail = kb('MemAvailable');
    if (Number.isFinite(total) && Number.isFinite(avail)) return { total, avail };
  } catch { /* bukan Linux */ }
  return { total: os.totalmem(), avail: os.freemem() };
}
const cpuTimes = () => os.cpus().reduce((a, c) => { const t = c.times; a.idle += t.idle; a.total += t.user + t.nice + t.sys + t.idle + t.irq; return a; }, { idle: 0, total: 0 });
let prevCpu = { at: performance.now(), sys: cpuTimes(), proc: process.cpuUsage(), cg: null as number | null };
export const cores = () => (typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length) || 1;

export interface Sample {
  t: number; cpu: number; cpuProc: number; mem: number; memUsed: number; memTotal: number; rss: number; heapUsed: number; heapTotal: number;
  disk: number; diskUsed: number; diskTotal: number; loop50: number; loop99: number; rpm: number; err: number; rt50: number; rt95: number; online: number; dbMs: number;
}
/** satu sampel (CPU dihitung dari selisih sejak sampel sebelumnya) */
export async function takeSample(db: Db, online: number): Promise<Sample> {
  const now = performance.now(), el = Math.max(1, now - prevCpu.at);
  const sys = cpuTimes(), proc = process.cpuUsage(), cg = await cgroup();
  const n = cores();
  const dIdle = sys.idle - prevCpu.sys.idle, dTot = sys.total - prevCpu.sys.total;
  let cpu = dTot > 0 ? (1 - dIdle / dTot) * 100 : 0;
  // di container dengan batas CPU: pemakaian dibanding batasnya
  if (cg.cpuLimit && cg.cpuUsec != null && prevCpu.cg != null) cpu = ((cg.cpuUsec - prevCpu.cg) / 1000 / el / cg.cpuLimit) * 100;
  const cpuProc = (((proc.user - prevCpu.proc.user) + (proc.system - prevCpu.proc.system)) / 1000 / el / (cg.cpuLimit ?? n)) * 100;
  prevCpu = { at: now, sys, proc, cg: cg.cpuUsec };
  const mi = await meminfo();
  let memTotal = mi.total, memUsed = mi.total - mi.avail;
  if (cg.memLimit && cg.memLimit < mi.total && cg.memUsed != null) { memTotal = cg.memLimit; memUsed = cg.memUsed; }
  const mu = process.memoryUsage();
  let diskUsed = 0, diskTotal = 0;
  for (const dir of db.kind !== 'pg' && config.pgliteDir ? [config.pgliteDir, process.cwd()] : [process.cwd()]) {
    try { const s = await statfs(dir); const avail = s.bavail * s.bsize; diskUsed = (s.blocks - s.bfree) * s.bsize; diskTotal = diskUsed + avail; break; } catch { /* coba direktori berikutnya */ }
  }
  let dbMs = 0;
  try { const t0 = performance.now(); await db.one('select 1'); dbMs = performance.now() - t0; } catch { dbMs = -1; }
  const rq = requestStats(1);
  // histogram mencatat jarak antar-detak (termasuk resolusi 20 ms): yang dilaporkan hanya keterlambatannya
  const loop50 = Math.max(0, loop.percentile(50) / 1e6 - LOOP_RES), loop99 = Math.max(0, loop.percentile(99) / 1e6 - LOOP_RES);
  loop.reset();
  const r1 = (v: number) => Math.round(v * 10) / 10;
  return {
    t: Date.now(), cpu: r1(Math.max(0, Math.min(100, cpu))), cpuProc: r1(Math.max(0, Math.min(100, cpuProc))),
    mem: r1((memUsed / memTotal) * 100), memUsed, memTotal, rss: mu.rss, heapUsed: mu.heapUsed, heapTotal: mu.heapTotal,
    disk: diskTotal ? r1((diskUsed / diskTotal) * 100) : 0, diskUsed, diskTotal,
    loop50: r1(loop50), loop99: r1(loop99), rpm: Math.round(rq.rpm), err: r1(rq.errPct), rt50: Math.round(rq.p50), rt95: Math.round(rq.p95), online, dbMs: r1(dbMs),
  };
}

/* ================= riwayat di memori ================= */
const RECENT: Sample[] = []; // tiap 10 detik, 1 jam
type Point = { t: number; cpu: number; mem: number; disk: number; online: number; rpm: number; loop99: number; err: number; rt95: number; dbMs: number };
const PERMIN: Point[] = []; // rata-rata per menit, 24 jam
export const recent = () => RECENT;
export const perMinute = () => PERMIN;
const avg = (xs: Sample[], k: keyof Sample) => (xs.length ? xs.reduce((a, s) => a + (s[k] as number), 0) / xs.length : 0);
function toPoint(xs: Sample[], t: number): Point {
  const r = (v: number) => Math.round(v * 10) / 10;
  return { t, cpu: r(avg(xs, 'cpu')), mem: r(avg(xs, 'mem')), disk: r(avg(xs, 'disk')), online: Math.round(avg(xs, 'online')), rpm: Math.round(avg(xs, 'rpm')), loop99: r(avg(xs, 'loop99')), err: r(avg(xs, 'err')), rt95: Math.round(avg(xs, 'rt95')), dbMs: r(avg(xs, 'dbMs')) };
}
export function pushSample(s: Sample) {
  RECENT.push(s);
  while (RECENT.length > 360) RECENT.shift();
  const minute = Math.floor(s.t / 60_000) * 60_000;
  const inMin = RECENT.filter((x) => Math.floor(x.t / 60_000) * 60_000 === minute);
  const last = PERMIN[PERMIN.length - 1];
  const p = toPoint(inMin, minute);
  if (last && last.t === minute) PERMIN[PERMIN.length - 1] = p; else PERMIN.push(p);
  while (PERMIN.length > 1440) PERMIN.shift();
}

/* ================= pengaturan peringatan ================= */
export interface MonitorSettings {
  rules: { cpu: { on: boolean; pct: number; mins: number }; mem: { on: boolean; pct: number }; disk: { on: boolean; pct: number }; db: { on: boolean; ms: number }; err: { on: boolean; pct: number; mins: number }; restart: { on: boolean } };
  send: { email: boolean; whatsapp: boolean; bell: boolean };
  /** email kosong = semua owner; wa = nomor WhatsApp penerima (62…) */
  to: { email: string; wa: string };
}
export const MONITOR_DEFAULTS: MonitorSettings = {
  rules: { cpu: { on: true, pct: 85, mins: 5 }, mem: { on: true, pct: 90 }, disk: { on: true, pct: 85 }, db: { on: true, ms: 200 }, err: { on: true, pct: 2, mins: 5 }, restart: { on: false } },
  send: { email: true, whatsapp: true, bell: true },
  to: { email: '', wa: '' },
};
const clamp = (v: unknown, lo: number, hi: number, d: number) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n * 10) / 10)) : d; };
/** nomor HP Indonesia → 62… (hanya angka); kosong bila tidak sah */
export function normPhone(v: unknown) {
  let d = String(v ?? '').replace(/\D/g, '');
  if (d.startsWith('0')) d = '62' + d.slice(1); else if (d.startsWith('8')) d = '62' + d;
  return /^\d{10,15}$/.test(d) ? d : '';
}
export function cleanMonitor(v: any): MonitorSettings {
  const D = MONITOR_DEFAULTS, r = v?.rules ?? {};
  const on = (x: any, d: boolean) => (typeof x === 'boolean' ? x : d);
  const email = String(v?.to?.email ?? '').trim().toLowerCase();
  return {
    rules: {
      cpu: { on: on(r.cpu?.on, D.rules.cpu.on), pct: clamp(r.cpu?.pct, 30, 100, D.rules.cpu.pct), mins: clamp(r.cpu?.mins, 1, 60, D.rules.cpu.mins) },
      mem: { on: on(r.mem?.on, D.rules.mem.on), pct: clamp(r.mem?.pct, 30, 100, D.rules.mem.pct) },
      disk: { on: on(r.disk?.on, D.rules.disk.on), pct: clamp(r.disk?.pct, 30, 100, D.rules.disk.pct) },
      db: { on: on(r.db?.on, D.rules.db.on), ms: clamp(r.db?.ms, 20, 10_000, D.rules.db.ms) },
      err: { on: on(r.err?.on, D.rules.err.on), pct: clamp(r.err?.pct, 0.1, 100, D.rules.err.pct), mins: clamp(r.err?.mins, 1, 60, D.rules.err.mins) },
      restart: { on: on(r.restart?.on, D.rules.restart.on) },
    },
    send: { email: on(v?.send?.email, true), whatsapp: on(v?.send?.whatsapp, true), bell: on(v?.send?.bell, true) },
    to: { email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '', wa: normPhone(v?.to?.wa) },
  };
}
export async function getMonitor(db: Db): Promise<MonitorSettings> {
  const row = await db.one<{ value: any }>(`select value from settings where key = 'monitor'`);
  return cleanMonitor(row?.value ?? {});
}
export async function saveMonitor(db: Db, v: MonitorSettings) {
  await db.query(`insert into settings (key, value) values ('monitor', $1::text::jsonb) on conflict (key) do update set value = excluded.value, updated_at = now()`, [JSON.stringify(v)]);
}

/* ================= kirim ke owner ================= */
export async function ownerEmails(db: Db) {
  return (await db.query<{ email: string }>(`select email from admins where role = 'owner' order by created_at`)).map((r) => r.email);
}
/** Antrekan email / WhatsApp ke owner lewat outbox (jenis notifikasi "server_alert" di Pusat notifikasi). */
export async function sendOwner(db: Db, judul: string, isi: string, log?: any) {
  const m = await getMonitor(db);
  const tpl = await getTemplate(db, 'server_alert');
  const out = { email: 0, whatsapp: 0, note: '' as string };
  if (!tpl?.enabled) { out.note = 'Notifikasi "Peringatan server" dimatikan di Pusat notifikasi.'; return out; }
  const vars = { judul, isi, host: os.hostname(), link: `${config.publicUrl}/admin/#/server`, nama: 'Owner', pet: '' };
  const fill = (s: string) => s.replace(/\{(\w+)\}/g, (_, k) => String((vars as any)[k] ?? ''));
  const ids: number[] = [];
  if (m.send.email && tpl.channels.email && mailEnabled()) {
    const to = m.to.email ? [m.to.email] : await ownerEmails(db);
    const mail = noteEmail(fill(tpl.title), fill(tpl.body), vars.link);
    for (const addr of to) ids.push(await enqueue(db, { channel: 'email', userId: null, to: addr, kind: 'server_alert', subject: mail.subject, body: mail.html }));
    out.email = to.length;
  }
  if (m.send.whatsapp && tpl.channels.whatsapp && waEnabled() && m.to.wa) {
    const ch = await getChannels(db);
    const p = waPayload(ch.whatsapp, m.to.wa, tpl, vars);
    if ('payload' in p) { ids.push(await enqueue(db, { channel: 'whatsapp', userId: null, to: m.to.wa, kind: 'server_alert', subject: fill(tpl.title), body: JSON.stringify(p.payload) })); out.whatsapp = 1; }
    else out.note = p.error;
  }
  if (ids.length) await deliver(db, { ids, log }).catch((e) => log?.warn?.({ err: e }, 'kirim peringatan server gagal'));
  return out;
}

/* ================= peringatan ================= */
type Kind = 'cpu' | 'mem' | 'disk' | 'db' | 'err' | 'restart';
const ACTIVE = new Map<Kind, { id: number; since: number; message: string }>();
const LAST_SENT = new Map<Kind, number>();
const COOLDOWN = 30 * 60_000;
export const activeAlerts = () => [...ACTIVE.entries()].map(([kind, a]) => ({ kind, ...a }));
const TITLE: Record<Kind, string> = { cpu: 'CPU tinggi', mem: 'Memori hampir penuh', disk: 'Penyimpanan hampir penuh', db: 'Database lambat', err: 'Banyak error', restart: 'Server menyala ulang' };
const gb = (b: number) => `${(b / 1e9).toFixed(1).replace('.', ',')} GB`;

/** periksa ambang (dipanggil tiap menit); kembalikan jenis yang baru menyala */
export async function checkAlerts(db: Db, log?: any, now = Date.now()) {
  const m = await getMonitor(db), R = m.rules;
  const last = RECENT[RECENT.length - 1];
  if (!last) return [];
  const within = (mins: number) => RECENT.filter((s) => s.t > now - mins * 60_000);
  const hits = new Map<Kind, { v: number; msg: string }>();
  { const xs = within(R.cpu.mins), v = avg(xs, 'cpu'); if (R.cpu.on && xs.length >= R.cpu.mins * 6 * 0.8 && v >= R.cpu.pct) hits.set('cpu', { v, msg: `CPU ${Math.round(v)}% selama ${R.cpu.mins} menit (batas ${R.cpu.pct}%)` }); }
  { const v = avg(RECENT.slice(-3), 'mem'); if (R.mem.on && v >= R.mem.pct) hits.set('mem', { v, msg: `Memori ${Math.round(v)}% terpakai (${gb(last.memUsed)} dari ${gb(last.memTotal)}, batas ${R.mem.pct}%)` }); }
  { const v = last.disk; if (R.disk.on && last.diskTotal && v >= R.disk.pct) hits.set('disk', { v, msg: `Penyimpanan ${Math.round(v)}% terpakai, sisa ${gb(last.diskTotal - last.diskUsed)} (batas ${R.disk.pct}%)` }); }
  { const xs = RECENT.slice(-6).filter((s) => s.dbMs >= 0), v = avg(xs, 'dbMs'); if (R.db.on && xs.length >= 3 && v >= R.db.ms) hits.set('db', { v, msg: `Kueri database rata-rata ${Math.round(v)} ms (batas ${R.db.ms} ms)` }); }
  { const q = requestStats(R.err.mins, now); if (R.err.on && q.n >= 20 && q.errPct >= R.err.pct) hits.set('err', { v: q.errPct, msg: `Error 5xx ${q.errPct.toFixed(1).replace('.', ',')}% dalam ${R.err.mins} menit (${q.err} dari ${q.n} permintaan)` }); }
  const fresh: Kind[] = [];
  for (const [kind, h] of hits) {
    if (ACTIVE.has(kind)) continue;
    const row = await db.one<{ id: string }>(`insert into server_alerts (kind, message, value) values ($1, $2, $3) returning id`, [kind, h.msg, h.v]);
    ACTIVE.set(kind, { id: Number(row!.id), since: now, message: h.msg });
    fresh.push(kind);
    if (now - (LAST_SENT.get(kind) ?? 0) >= COOLDOWN) {
      LAST_SENT.set(kind, now);
      const r = await sendOwner(db, TITLE[kind], h.msg, log).catch((e) => { log?.warn?.({ err: e }, 'peringatan server gagal dikirim'); return null; });
      if (r && (r.email || r.whatsapp)) await db.query(`update server_alerts set notified = true where id = $1`, [row!.id]);
    }
  }
  for (const [kind, a] of ACTIVE) if (!hits.has(kind)) { await db.query(`update server_alerts set ended_at = now() where id = $1`, [a.id]); ACTIVE.delete(kind); }
  return fresh;
}

/* ================= sampler ================= */
let onlineCache = { at: 0, n: 0 };
async function onlineNow(db: Db) {
  if (Date.now() - onlineCache.at < 55_000) return onlineCache.n;
  try { onlineCache = { at: Date.now(), n: (await db.one<{ c: number }>(`select count(*)::int c from users where last_seen_at > now() - interval '150 seconds'`))?.c ?? 0 }; } catch { /* abaikan */ }
  return onlineCache.n;
}
export const onlineCount = onlineNow;
let lastSaved = 0;
/** Jalankan pemantauan: sampel tiap 10 detik, cek peringatan tiap menit, simpan rata-rata 5 menit ke database. */
export function startMonitor(db: Db, log?: any) {
  let busy = false, ticks = 0, stopped = false;
  const boot = (async () => {
    // peringatan yang masih menyala dari proses sebelumnya dianggap selesai saat server menyala ulang
    await db.query(`update server_alerts set ended_at = now() where ended_at is null`).catch(() => {});
    const m = await getMonitor(db).catch(() => MONITOR_DEFAULTS);
    if (m.rules.restart.on) {
      const msg = `Server menyala ulang (v${APP_VERSION}, ${os.hostname()})`;
      const row = await db.one<{ id: string }>(`insert into server_alerts (kind, message, ended_at) values ('restart', $1, now()) returning id`, [msg]).catch(() => null);
      const r = await sendOwner(db, TITLE.restart, msg, log).catch(() => null);
      if (row && r && (r.email || r.whatsapp)) await db.query(`update server_alerts set notified = true where id = $1`, [row.id]).catch(() => {});
    }
  })().catch((e) => log?.warn?.({ err: e }, 'monitor: boot'));
  const tick = async () => {
    if (busy || stopped) return;
    busy = true;
    try {
      await boot;
      const s = await takeSample(db, await onlineNow(db));
      pushSample(s);
      if (++ticks % 6 === 0) await checkAlerts(db, log);
      if (s.t - lastSaved >= 5 * 60_000 && RECENT.length >= 6) {
        lastSaved = s.t;
        const p = toPoint(RECENT.filter((x) => x.t > s.t - 5 * 60_000), Math.floor(s.t / 60_000) * 60_000);
        await db.query(
          `insert into server_metrics (at, cpu, mem, disk, disk_used, disk_total, loop_p99, rpm, err, rt_p95, online, db_ms) values (to_timestamp($1 / 1000.0), $2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) on conflict (at) do nothing`,
          [p.t, p.cpu, p.mem, p.disk, s.diskUsed, s.diskTotal, p.loop99, p.rpm, p.err, p.rt95, p.online, p.dbMs],
        );
        if (Math.floor(s.t / 3_600_000) !== Math.floor((s.t - 5 * 60_000) / 3_600_000)) {
          await db.query(`delete from server_metrics where at < now() - interval '30 days'`);
          await db.query(`delete from server_alerts where started_at < now() - interval '90 days'`);
        }
      }
    } catch (e) { log?.warn?.({ err: e }, 'monitor: sampel gagal'); }
    finally { busy = false; }
  };
  setTimeout(tick, 1500).unref?.();
  const t = setInterval(tick, 10_000);
  t.unref?.();
  return () => { stopped = true; clearInterval(t); };
}
/** untuk uji: kosongkan semua riwayat di memori */
export function resetMonitor() { MINUTES.length = 0; ERRORS.length = 0; RECENT.length = 0; PERMIN.length = 0; ACTIVE.clear(); LAST_SENT.clear(); lastSaved = 0; onlineCache = { at: 0, n: 0 }; }
