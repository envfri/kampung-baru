// Admin → Server (v0.30): pemakaian CPU/memori/disk/database, permintaan & error, riwayat, peringatan ke owner.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config';

config.paymentProvider = 'mock';
config.adminEmail = 'owner@test.local';
config.adminPassword = 'rahasia-sekali-123';
const { buildApp } = await import('../src/app');
const M = await import('../src/lib/monitor');
let app: any;
let db: any;
before(async () => { M.resetMonitor(); ({ app, db } = await buildApp({ memoryDb: true, logger: false, rateLimit: false, worker: false })); });
after(async () => app?.close());

function client() {
  let cookie = '';
  const call = async (method: string, url: string, body?: unknown) => {
    const res = await app.inject({ method, url, payload: body as any, headers: cookie ? { cookie } : {} });
    const set = res.headers['set-cookie'];
    if (set) {
      const jar = new Map(cookie ? cookie.split('; ').map((c: string) => c.split('=') as [string, string]) : []);
      for (const c of Array.isArray(set) ? set : [set]) { const [kv] = c.split(';'); const [k, v] = kv.split('='); if (v) jar.set(k, v); else jar.delete(k); }
      cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    }
    let b: any = res.body;
    try { b = JSON.parse(res.body); } catch { /* bukan JSON */ }
    return { status: res.statusCode, headers: res.headers, body: b, text: res.body as string };
  };
  return { get: (u: string) => call('GET', u), post: (u: string, b?: unknown) => call('POST', u, b ?? {}), put: (u: string, b?: unknown) => call('PUT', u, b ?? {}) };
}
async function owner() {
  const o = client();
  assert.equal((await o.post('/api/admin/login', { email: 'owner@test.local', password: 'rahasia-sekali-123' })).status, 200);
  return o;
}
async function staff(o: ReturnType<typeof client>, role: 'admin' | 'moderator') {
  const email = `${role}${Date.now()}${Math.random().toString(36).slice(2, 6)}@test.local`;
  assert.equal((await o.post('/api/admin/admins', { email, name: role, password: 'rahasia-sekali-123', role })).status, 200);
  const c = client();
  assert.equal((await c.post('/api/admin/login', { email, password: 'rahasia-sekali-123' })).status, 200);
  return c;
}

test('halaman Server: data CPU, memori, disk, database, aplikasi & pemain; hanya owner/admin', async () => {
  const o = await owner();
  const r = await o.get('/api/admin/server');
  assert.equal(r.status, 200);
  const s = r.body;
  assert.equal(s.status, 'ok');
  assert.ok(s.cpu.pct >= 0 && s.cpu.pct <= 100 && s.cpu.cores >= 1 && s.cpu.load.length === 3);
  assert.ok(s.mem.total > 0 && s.mem.used > 0 && s.mem.rss > 0 && s.mem.pct > 0 && s.mem.pct <= 100);
  assert.ok(s.disk.total > 0 && s.disk.used > 0, 'disk terbaca');
  assert.equal(s.db.kind, 'PGlite');
  assert.ok(s.db.ms >= 0 && Array.isArray(s.db.tables) && s.db.tables.length > 0);
  assert.ok(s.app.uptimeSec >= 0 && typeof s.app.version === 'string');
  assert.deepEqual(Object.keys(s.players.where).sort(), ['alun', 'game', 'home', 'map', 'visit']);
  assert.ok(s.settings.rules.cpu.pct === 85 && s.settings.rules.mem.pct === 90 && s.settings.rules.disk.pct === 85 && s.settings.rules.db.ms === 200 && s.settings.rules.err.pct === 2);
  assert.deepEqual(s.recipients.owners, ['owner@test.local']);
  assert.ok(s.sys.host && s.sys.node.startsWith('v'));
  // admin boleh, moderator tidak
  const a = await staff(o, 'admin');
  assert.equal((await a.get('/api/admin/server')).status, 200);
  const m = await staff(o, 'moderator');
  assert.equal((await m.get('/api/admin/server')).status, 403);
  assert.equal((await m.get('/api/admin/server/history?range=24j')).status, 403);
});

test('permintaan /api/ tercatat: jumlah, waktu respons, endpoint paling lambat, error 5xx', async () => {
  M.resetMonitor();
  const now = Date.now();
  for (let i = 0; i < 30; i++) M.recordRequest('GET', '/api/me', 200, 10 + i, '', now);
  for (let i = 0; i < 5; i++) M.recordRequest('POST', '/api/visit/:id/photo', 200, 400 + i * 10, '', now);
  M.recordRequest('POST', '/api/payments', 502, 90, 'ZePay tidak menjawab', now);
  const q = M.requestStats(5, now);
  assert.equal(q.n, 36);
  assert.equal(q.err, 1);
  assert.ok(q.p95 >= 40);
  const slow = M.slowRoutes(60, 6, now);
  assert.equal(slow[0].route, 'POST /api/visit/:id/photo');
  assert.ok(slow[0].p95 >= 400);
  assert.equal(M.recentErrors()[0].msg, 'ZePay tidak menjawab');
  // permintaan sungguhan lewat hook juga tercatat (rute berpola, bukan URL mentah)
  const o = await owner();
  await o.get('/api/admin/server');
  const r = await o.get('/api/admin/server');
  assert.ok(r.body.slow.some((x: any) => x.route === 'GET /api/admin/server'));
});

test('pengaturan peringatan: divalidasi, disimpan, tercatat di log audit', async () => {
  const o = await owner();
  assert.equal((await o.put('/api/admin/server/settings', { to: { wa: '12' } })).status, 400);
  assert.equal((await o.put('/api/admin/server/settings', { to: { email: 'bukan-email' } })).status, 400);
  const r = await o.put('/api/admin/server/settings', { rules: { cpu: { on: true, pct: 150, mins: 3 }, restart: { on: true } }, send: { whatsapp: false }, to: { wa: '0812-3456-7890' } });
  assert.equal(r.status, 200);
  assert.equal(r.body.settings.rules.cpu.pct, 100, 'ambang dibatasi 100%');
  assert.equal(r.body.settings.rules.cpu.mins, 3);
  assert.equal(r.body.settings.rules.restart.on, true);
  assert.equal(r.body.settings.send.whatsapp, false);
  assert.equal(r.body.settings.to.wa, '6281234567890');
  assert.equal((await o.get('/api/admin/server')).body.settings.to.wa, '6281234567890');
  const log = await db.one(`select detail from admin_audit where action = 'server.alerts' order by id desc limit 1`).catch(() => null)
    ?? await db.one(`select detail from audit_log where action = 'server.alerts' order by id desc limit 1`).catch(() => null);
  assert.ok(log, 'tercatat di log audit');
  // kembalikan bawaan untuk uji berikutnya
  await o.put('/api/admin/server/settings', {});
});

test('peringatan menyala saat ambang terlewati, muncul di lonceng admin, dan selesai saat pulih', async () => {
  M.resetMonitor();
  const o = await owner();
  const base = { cpuProc: 5, memUsed: 1e9, memTotal: 4e9, rss: 1e8, heapUsed: 5e7, heapTotal: 8e7, disk: 40, diskUsed: 16e9, diskTotal: 40e9, loop50: 2, loop99: 9, rpm: 50, err: 0, rt50: 10, rt95: 40, online: 3, dbMs: 2 };
  const now = Date.now();
  // CPU 95% selama 5 menit (30 sampel tiap 10 detik)
  for (let i = 30; i >= 0; i--) M.pushSample({ ...base, t: now - i * 10_000, cpu: 95, mem: 40 });
  const fresh = await M.checkAlerts(db, undefined, now);
  assert.deepEqual(fresh, ['cpu']);
  const row = await db.one(`select kind, message, ended_at from server_alerts order by id desc limit 1`);
  assert.equal(row.kind, 'cpu');
  assert.match(row.message, /CPU 95% selama 5 menit \(batas 85%\)/);
  assert.equal(row.ended_at, null);
  const snap = (await o.get('/api/admin/server')).body;
  assert.equal(snap.status, 'warn');
  assert.equal(snap.active[0].kind, 'cpu');
  assert.equal((await o.get('/api/admin/badges')).body.badges.server, 1, 'lonceng admin');
  // tidak dobel selama masih menyala
  assert.deepEqual(await M.checkAlerts(db, undefined, now + 60_000), []);
  // pulih
  for (let i = 30; i >= 0; i--) M.pushSample({ ...base, t: now + 120_000 - i * 10_000, cpu: 20, mem: 40 });
  await M.checkAlerts(db, undefined, now + 120_000);
  const done = await db.one(`select ended_at from server_alerts where kind = 'cpu' order by id desc limit 1`);
  assert.ok(done.ended_at, 'peringatan selesai saat pulih');
  assert.equal((await o.get('/api/admin/badges')).body.badges.server, 0);
  // memori & disk
  // memori memakai rata-rata 3 sampel terakhir (lonjakan sesaat tidak memicu peringatan)
  for (let i = 1; i <= 3; i++) M.pushSample({ ...base, t: now + 120_000 + i * 10_000, cpu: 10, mem: 96, disk: 91 });
  const f2 = await M.checkAlerts(db, undefined, now + 150_000);
  assert.ok(f2.includes('mem') && f2.includes('disk'));
});

test('riwayat (1 jam / 24 jam / 7 & 30 hari), laporan unduhan, dan kirim tes', async () => {
  const o = await owner();
  for (const range of ['1j', '24j', '7h', '30h']) {
    const r = await o.get(`/api/admin/server/history?range=${range}`);
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body.points));
  }
  await db.query(`insert into server_metrics (at, cpu, mem, disk, disk_used, disk_total, loop_p99, rpm, err, rt_p95, online, db_ms) values (now() - interval '2 days', 30, 50, 40, 1, 2, 5, 10, 0, 30, 4, 2)`);
  assert.equal((await o.get('/api/admin/server/history?range=7h')).body.points.length, 1);
  const rep = await o.get('/api/admin/server/report');
  assert.equal(rep.status, 200);
  assert.match(String(rep.headers['content-disposition']), /attachment; filename="bupi-server-/);
  assert.ok(rep.body.cpu && Array.isArray(rep.body.history24h));
  const t = await o.post('/api/admin/server/test');
  assert.equal(t.status, 200);
  assert.equal(t.body.email, 0, 'email belum diatur di uji');
});

test('nomor WhatsApp penerima dinormalkan', () => {
  assert.equal(M.normPhone('0812 3456 7890'), '6281234567890');
  assert.equal(M.normPhone('+62 812-3456-7890'), '6281234567890');
  assert.equal(M.normPhone('81234567890'), '6281234567890');
  assert.equal(M.normPhone('123'), '');
});
