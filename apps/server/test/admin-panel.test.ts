// Panel admin v0.26: daftar pemain dengan filter/urut/total, CSV, aksi massal (notifikasi admin, hadiah owner),
// bisukan obrolan, pembayaran & log audit dengan filter, laporan selesai massal, dasbor, dan angka menu samping.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config';

config.paymentProvider = 'mock';
config.adminEmail = 'owner@test.local';
config.adminPassword = 'rahasia-sekali-123';
const { buildApp } = await import('../src/app');
let app: any;
let db: any;
before(async () => { ({ app, db } = await buildApp({ memoryDb: true, logger: false, rateLimit: false, worker: false })); });
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
  return { call, get: (u: string) => call('GET', u), post: (u: string, b?: unknown) => call('POST', u, b ?? {}), put: (u: string, b?: unknown) => call('PUT', u, b ?? {}) };
}
async function owner() {
  const o = client();
  assert.equal((await o.post('/api/admin/login', { email: 'owner@test.local', password: 'rahasia-sekali-123' })).status, 200);
  return o;
}
async function staff(o: ReturnType<typeof client>, role: 'admin' | 'moderator') {
  const email = `${role}${Date.now()}@test.local`;
  assert.equal((await o.post('/api/admin/admins', { email, name: role, password: 'rahasia-sekali-123', role })).status, 200);
  const c = client();
  assert.equal((await c.post('/api/admin/login', { email, password: 'rahasia-sekali-123' })).status, 200);
  return c;
}
async function player(name: string, level = 1) {
  const c = client();
  await c.post('/api/auth/guest', {});
  const st = (await c.post('/api/pet', { name, color: '#F6B7A8', ear: 'kucing' })).body.state;
  if (level > 1) await db.query(`update pets set level = $2 where user_id = $1`, [st.user.id, level]);
  return { c, id: st.user.id as string, code: st.user.friend_code as string };
}

test('pemain: filter, urut, total, cari, ringkasan, CSV', async () => {
  const o = await owner();
  const a = await player('Apem', 3), b = await player('Bika', 7), c = await player('Cucur', 5);
  await db.query(`update users set banned_at = now(), ban_reason = 'uji' where id = $1`, [c.id]);
  await db.query(`update wallets set coin = 5000 where user_id = $1`, [b.id]);
  // level ≥ 4, urut level naik
  let r = await o.get('/api/admin/players?lvMin=4&sort=level&dir=asc&size=25');
  assert.equal(r.status, 200);
  const names = r.body.players.map((p: any) => p.pet_name);
  assert.deepEqual(names.filter((n: string) => ['Apem', 'Bika', 'Cucur'].includes(n)), ['Cucur', 'Bika']);
  assert.ok(r.body.total >= 2);
  // diblokir
  r = await o.get('/api/admin/players?status=banned');
  assert.ok(r.body.players.every((p: any) => p.banned_at) && r.body.players.some((p: any) => p.id === c.id));
  // urut koin turun: Bika di atas
  r = await o.get('/api/admin/players?sort=coin&dir=desc&size=5');
  assert.equal(r.body.players[0].id, b.id);
  // cari kode teman, halaman & ukuran
  r = await o.get(`/api/admin/players?q=${a.code}`);
  assert.equal(r.body.total, 1);
  assert.equal(r.body.players[0].pet_name, 'Apem');
  r = await o.get('/api/admin/players?size=5&page=0');
  assert.ok(r.body.players.length <= 5);
  // kolom urut tidak dikenal → bawaan, tidak error
  assert.equal((await o.get('/api/admin/players?sort=drop%20table&dir=asc')).status, 200);
  // ringkasan & CSV
  const sum = (await o.get('/api/admin/players-summary')).body.summary;
  assert.ok(sum.total >= 3 && sum.banned >= 1);
  const csv = await o.get('/api/admin/export/players.csv?status=banned');
  assert.equal(csv.status, 200);
  assert.match(String(csv.headers['content-type']), /text\/csv/);
  assert.ok(csv.text.includes('Cucur') && !csv.text.includes('Apem'));
});

test('pemain: detail tambahan, bisukan obrolan, hak akses aksi massal', async () => {
  const o = await owner();
  const p = await player('Dodol', 2), q = await player('Enting', 2);
  const x = (await o.get(`/api/admin/players/${p.id}/extra`)).body;
  assert.ok(x.xpNext > 0 && Array.isArray(x.counters));
  // bisukan 30 menit lalu buka
  const m = await o.post(`/api/admin/players/${p.id}/mute`, { minutes: 30, reason: 'kata kasar' });
  assert.equal(m.status, 200);
  assert.equal((await o.get('/api/admin/players?status=muted')).body.players.some((r: any) => r.id === p.id), true);
  assert.equal((await o.post(`/api/admin/players/${p.id}/mute`, { minutes: 1, reason: 'x' })).status, 400, 'lama & alasan divalidasi');
  // moderator tidak boleh notifikasi massal; admin boleh tapi tidak boleh hadiah massal
  const mod = await staff(o, 'moderator'), adm = await staff(o, 'admin');
  assert.equal((await mod.post('/api/admin/players/bulk-notify', { ids: [p.id], title: 'Halo', body: 'Uji' })).status, 403);
  const n = await adm.post('/api/admin/players/bulk-notify', { ids: [p.id, q.id], title: 'Halo', body: 'Pesan uji' });
  assert.equal(n.status, 200);
  assert.equal(n.body.sent, 2);
  assert.equal((await adm.post('/api/admin/players/bulk-gift', { ids: [p.id], kind: 'coin', amount: 50, reason: 'kompensasi' })).status, 403);
  // owner: hadiah koin massal masuk ke dompet & ledger
  const before = Number((await db.one(`select coin from wallets where user_id = $1`, [q.id])).coin);
  const g = await o.post('/api/admin/players/bulk-gift', { ids: [p.id, q.id], kind: 'coin', amount: 50, reason: 'kompensasi gangguan' });
  assert.equal(g.status, 200, JSON.stringify(g.body));
  assert.equal(g.body.count, 2);
  assert.equal(Number((await db.one(`select coin from wallets where user_id = $1`, [q.id])).coin), before + 50);
  assert.equal((await o.post('/api/admin/players/bulk-gift', { ids: [], kind: 'coin', amount: 50, reason: 'kosong' })).status, 400);
  // tercatat di log audit dan bisa difilter per jenis
  const au = (await o.get('/api/admin/audit?cat=uang')).body;
  assert.ok(au.audit.some((r: any) => r.action === 'player_bulk_gift'));
  assert.ok(au.audit.every((r: any) => !r.action.startsWith('login')));
});

test('pengaturan: log audit menyimpan Sebelum → Sesudah', async () => {
  const o = await owner();
  const cur = (await o.get('/api/admin/settings')).body.value;
  cur.karung.energiCost = cur.karung.energiCost + 2;
  assert.equal((await o.put('/api/admin/settings', { value: cur })).status, 200);
  const au = (await o.get('/api/admin/audit?q=settings_update')).body.audit[0];
  assert.equal(au.action, 'settings_update');
  const ch = au.detail.changes.find((c: any) => c.path === 'karung.energiCost');
  assert.ok(ch && ch.after === ch.before + 2);
});

test('pembayaran: filter status & paket, ringkasan, CSV', async () => {
  const o = await owner();
  const c = client();
  await c.post('/api/auth/guest', {});
  await c.post('/api/pet', { name: 'Gemblong', color: '#F6B7A8', ear: 'kucing' });
  const st = await c.post('/api/auth/email/start', { email: 'bayar@contoh.id' });
  await c.post('/api/auth/email/verify', { email: 'bayar@contoh.id', code: st.body.devCode });
  const paid = (await c.post('/api/pearls/checkout', { packageId: 'p-kecil' })).body;
  await app.inject({ method: 'POST', url: paid.redirectUrl, payload: 'action=pay', headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  await c.post('/api/pearls/checkout', { packageId: 'p-sedang' });
  let r = await o.get('/api/admin/payments?status=pending');
  assert.equal(r.status, 200);
  assert.ok(r.body.payments.length >= 1 && r.body.payments.every((p: any) => p.status === 'pending'));
  r = await o.get('/api/admin/payments?status=paid,pending&pkg=p-kecil');
  assert.ok(r.body.payments.every((p: any) => p.package_id === 'p-kecil'));
  assert.ok(r.body.amount > 0 && r.body.total >= 1);
  assert.ok(r.body.summary && Array.isArray(r.body.packages));
  r = await o.get('/api/admin/payments?q=Gemblong&sort=amount&dir=asc');
  assert.ok(r.body.payments.length >= 2 && r.body.payments[0].amount_idr <= r.body.payments[1].amount_idr);
  const csv = await o.get('/api/admin/export/payments.csv?status=paid');
  assert.equal(csv.status, 200);
  assert.ok(csv.text.split('\n').length >= 2);
  const mod = await staff(o, 'moderator');
  assert.equal((await mod.get('/api/admin/payments')).status, 403);
});

test('laporan selesai massal, dasbor, angka menu samping', async () => {
  const o = await owner();
  const t = await player('Gethuk'), r1 = await player('Lapis'), r2 = await player('Lumpia');
  const ins = async (rep: string) => (await db.one(`insert into reports (reporter_id, target_id, place, reason, evidence) values ($1, $2, 'alun:1', 'kasar', '[]') returning id`, [rep, t.id])).id;
  const ids = [await ins(r1.id), await ins(r2.id)];
  let b = (await o.get('/api/admin/badges')).body.badges;
  assert.ok(b.reports >= 2 && 'payments' in b);
  const mod = await staff(o, 'moderator');
  assert.equal('payments' in (await mod.get('/api/admin/badges')).body.badges, false, 'moderator tidak melihat angka pembayaran');
  const h = await mod.post('/api/admin/reports/handle', { ids });
  assert.equal(h.body.count, 2);
  assert.equal((await mod.post('/api/admin/reports/handle', { ids })).body.count, 0, 'tidak ditangani dua kali');
  const done = (await o.get('/api/admin/reports?status=done&q=Gethuk')).body.reports;
  assert.equal(done.length, 2);
  const d = (await o.get('/api/admin/dashboard?days=7')).body;
  assert.equal(d.days, 7);
  assert.equal(d.series.length, 7);
  assert.ok(d.k.users >= 3 && d.server.version && d.attention && Array.isArray(d.played));
  assert.equal((await o.get('/api/admin/dashboard?days=999')).body.days, 14, 'rentang tidak dikenal → 14 hari');
});
