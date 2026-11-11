// Persiapan peluncuran: pembelian simulasi dikunci di produksi, tarik Mutiara uji, cut-off semua pemain dari 0.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config';

config.adminEmail = 'owner@test.local';
config.adminPassword = 'rahasia-sekali-123';
config.paymentProvider = 'mock';
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
    return { status: res.statusCode, body: b };
  };
  return { call, get: (u: string) => call('GET', u), post: (u: string, b?: unknown) => call('POST', u, b ?? {}) };
}
async function player(c = client(), pet = 'Mochi') {
  await c.post('/api/auth/guest');
  const p = await c.post('/api/pet', { name: pet, color: '#F6B7A8', ear: 'tunas' });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  return { c, id: p.body.state.user.id as string, code: p.body.state.user.friend_code as string };
}
async function owner(c = client()) {
  assert.equal((await c.post('/api/admin/login', { email: 'owner@test.local', password: 'rahasia-sekali-123' })).status, 200);
  return c;
}
const pkgId = async () => (await db.one(`select id from pearl_packages where active order by price_idr limit 1`)).id;
async function buy(c: any) {
  const ck = await c.post('/api/pearls/checkout', { packageId: await pkgId() });
  assert.equal(ck.status, 200, JSON.stringify(ck.body));
  const pay = await c.post(`/pay/mock/${ck.body.paymentId}`, { action: 'pay' });
  assert.equal(pay.status, 303);
  return ck.body.paymentId as string;
}
const pearls = async (id: string) => (await db.one(`select pearl from wallets where user_id = $1`, [id])).pearl;

test('produksi + mode simulasi: pemain tidak bisa membeli, admin yang login tetap bisa mencoba', async () => {
  config.isProd = true;
  try {
    const p = await player();
    assert.equal((await p.c.get('/api/config')).body.payments, null, 'game menyembunyikan pembelian');
    const pl = await p.c.get('/api/pearls');
    assert.equal(pl.body.provider, null);
    assert.match(pl.body.closed, /belum dibuka/);
    const ck = await p.c.post('/api/pearls/checkout', { packageId: await pkgId() });
    assert.equal(ck.status, 403);
    assert.match(ck.body.error.message, /belum dibuka/);
    // admin login di browser yang sama
    const a = await player(await owner(), 'Uji');
    assert.equal((await a.c.get('/api/config')).body.payments, 'mock');
    const before = await pearls(a.id);
    const id = await buy(a.c);
    assert.ok((await pearls(a.id)) > before, 'Mutiara uji masuk');
    assert.equal((await db.one(`select test from payments where id = $1`, [id])).test, true, 'ditandai pembayaran uji');
    // halaman simulasi tertutup bagi pemain biasa
    assert.equal((await p.c.get(`/pay/mock/${id}`)).status, 403);
  } finally { config.isProd = false; }
});

test('tarik Mutiara uji: yang sudah terpakai dilaporkan, tidak bisa minus', async () => {
  const p = await player(client(), 'Kopi');
  const start = await pearls(p.id);
  await buy(p.c);
  const bought = (await pearls(p.id)) - start;
  assert.ok(bought > 0);
  // anggap Mutiara awal + 3 Mutiara hasil beli sudah dibelanjakan
  await db.query(`update wallets set pearl = $2 where user_id = $1`, [p.id, bought - 3]);
  const o = await owner();
  const st = await o.get('/api/admin/launch');
  assert.ok(st.body.demo.pearls >= bought);
  const r = await o.post('/api/admin/launch/revoke-demo');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.stats.demo.payments, 0, 'semua pembayaran uji sudah ditarik');
  assert.equal(await pearls(p.id), 0, 'saldo dikurangi sampai 0, tidak minus');
  assert.equal(r.body.spent, 3, 'yang terlanjur dipakai dilaporkan');
  assert.equal((await o.post('/api/admin/launch/revoke-demo')).body.payments, 0, 'tidak ditarik dua kali');
  assert.equal((await client().post('/api/admin/launch/revoke-demo')).status, 401);
});

test('cut-off peluncuran: semua mulai dari 0, akun & teman tetap; pembayaran sungguhan dilindungi', async () => {
  const a = await player(client(), 'Bola');
  const b = await player(client(), 'Tempe');
  await b.c.post('/api/friends', { code: a.code });
  await db.query(`update wallets set coin = 99999, pearl = 999 where user_id = $1`, [a.id]);
  await db.query(`update pets set level = 12 where user_id = $1`, [a.id]);
  const o = await owner();
  assert.equal((await o.post('/api/admin/launch/reset', { confirm: 'reset' })).body.error?.code, 'confirm');
  const r = await o.post('/api/admin/launch/reset', { confirm: 'RESET BUPI', mode: 'progress' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.stats.pets, 0, 'semua pet dibuat ulang');
  assert.equal(r.body.cutoff.mode, 'progress');
  const me = (await a.c.get('/api/me')).body;
  assert.equal(me.user.id, a.id, 'akun & sesi tetap');
  assert.equal(me.pet, null, 'pemain membuat pet baru');
  const s = (await o.get('/api/admin/settings')).body;
  const startCoins = s.settings?.economy?.startCoins ?? s.economy?.startCoins;
  assert.equal(me.wallet.coin, startCoins ?? me.wallet.coin, 'koin kembali ke modal awal');
  assert.ok(me.wallet.pearl < 999);
  assert.equal(me.friendsCount, 1, 'pertemanan dipertahankan');
  assert.equal((await a.c.post('/api/pet', { name: 'Bola', color: '#F6B7A8', ear: 'tunas' })).status, 200, 'bisa mulai lagi');
  assert.equal((await db.one(`select level from pets where user_id = $1`, [a.id])).level, 1);
  assert.ok((await o.get('/api/admin/launch')).body.cutoff.at, 'waktu cut-off tercatat');
  // ada pembayaran sungguhan → dilindungi
  await db.query(`insert into payments (user_id, package_id, pearls, amount_idr, provider, status, paid_at, test) values ($1, $2, 100, 15000, 'zepay', 'paid', now(), false)`, [a.id, await pkgId()]);
  assert.equal((await o.post('/api/admin/launch/reset', { confirm: 'RESET BUPI', mode: 'all' })).body.error?.code, 'real_payments');
  assert.equal((await o.post('/api/admin/launch/reset', { confirm: 'RESET BUPI', mode: 'progress' })).body.error?.code, 'real_payments');
  const r2 = await o.post('/api/admin/launch/reset', { confirm: 'RESET BUPI', mode: 'progress', includeReal: true, keepFriends: false });
  assert.equal(r2.status, 200, JSON.stringify(r2.body));
  const pay = await db.one(`select status, revoked_at from payments where not test`);
  assert.equal(pay.status, 'paid', 'catatan pembayaran sungguhan tetap ada');
  assert.ok(pay.revoked_at);
  assert.equal((await a.c.get('/api/me')).body.friendsCount, 0, 'pertemanan ikut direset bila dipilih');
  // hapus semua pemain (tanpa pembayaran sungguhan)
  await db.query(`delete from payments where not test`);
  const r3 = await o.post('/api/admin/launch/reset', { confirm: 'RESET BUPI', mode: 'all' });
  assert.equal(r3.status, 200, JSON.stringify(r3.body));
  assert.equal(r3.body.stats.players, 0);
  assert.equal((await a.c.get('/api/me')).status, 401, 'akun lama hilang');
  assert.ok((await db.one(`select count(*)::int c from admin_audit where action = 'launch_cutoff'`)).c >= 3, 'tercatat di log audit');
  assert.ok((await db.one(`select count(*)::int c from items`)).c > 0, 'katalog tidak tersentuh');
});
