import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config';

config.adminEmail = 'owner@test.local';
config.adminPassword = 'rahasia-sekali-123';
config.paymentProvider = 'mock';

const { buildApp } = await import('../src/app');
let app: any;

before(async () => {
  ({ app } = await buildApp({ memoryDb: true, logger: false, rateLimit: false, worker: false }));
});
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
    return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null };
  };
  return { call, get: (u: string) => call('GET', u), post: (u: string, b?: unknown) => call('POST', u, b ?? {}) };
}

test('admin: aktif/nonaktif massal item & set premium', async () => {
  const owner = client();
  assert.equal((await owner.post('/api/admin/login', { email: 'owner@test.local', password: 'rahasia-sekali-123' })).status, 200);
  const items = (await owner.get('/api/admin/items')).body.items;
  const ids = items.filter((i: any) => i.active).slice(0, 3).map((i: any) => i.id);
  assert.equal(ids.length, 3);

  // nonaktifkan 3 item: semuanya berubah, hilang dari katalog pemain
  const off = await owner.post('/api/admin/items/bulk-active', { ids, active: false });
  assert.equal(off.status, 200, JSON.stringify(off.body));
  assert.equal(off.body.count, 3);
  const cat = (await client().get('/api/catalog')).body;
  for (const id of ids) assert.equal(cat.items.find((i: any) => i.id === id), undefined);
  // ulangi: tidak ada yang berubah lagi
  assert.equal((await owner.post('/api/admin/items/bulk-active', { ids, active: false })).body.count, 0);
  // aktifkan kembali
  const on = await owner.post('/api/admin/items/bulk-active', { ids, active: true });
  assert.deepEqual([...on.body.ids].sort(), [...ids].sort());
  // isian salah ditolak
  assert.equal((await owner.post('/api/admin/items/bulk-active', { ids: [], active: true })).status, 400);
  assert.equal((await owner.post('/api/admin/items/bulk-active', { ids, active: 'ya' })).status, 400);

  // set premium: diatur, tetap ada setelah item disimpan lewat set lagi, bisa dihapus
  const furn = items.find((i: any) => i.kind === 'furniture');
  assert.equal((await owner.call('PUT', `/api/admin/items/${furn.id}/set`, { set: 'keraton' })).status, 200);
  let it = (await owner.get('/api/admin/items')).body.items.find((i: any) => i.id === furn.id);
  assert.equal(it.data.set, 'keraton');
  assert.equal((await owner.call('PUT', `/api/admin/items/${furn.id}/set`, { set: 'tidak-ada' })).status, 400);
  assert.equal((await owner.call('PUT', '/api/admin/items/tidak-ada-item/set', { set: 'keraton' })).status, 404);
  assert.equal((await owner.call('PUT', `/api/admin/items/${furn.id}/set`, { set: null })).status, 200);
  it = (await owner.get('/api/admin/items')).body.items.find((i: any) => i.id === furn.id);
  assert.equal(it.data.set, undefined);

  // moderator tidak boleh
  assert.equal((await owner.post('/api/admin/admins', { email: 'mod2@test.local', password: 'moderator-123', role: 'moderator' })).status, 200);
  const mod = client();
  await mod.post('/api/admin/login', { email: 'mod2@test.local', password: 'moderator-123' });
  assert.equal((await mod.post('/api/admin/items/bulk-active', { ids, active: false })).status, 403);
  assert.equal((await mod.call('PUT', `/api/admin/items/${furn.id}/set`, { set: 'keraton' })).status, 403);
});
