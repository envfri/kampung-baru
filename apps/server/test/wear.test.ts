// Aksesori v0.27: paket konten 10 (aksesori baru & warna baru), slot "Dibawa" (hand) bisa dipakai bersama 4 slot lain.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config';
import { builtinCatalog, itemIcon, petSVG } from '@kb/shared';

config.paymentProvider = 'mock';
const { buildApp } = await import('../src/app');
const { SEED_ITEMS_V10 } = await import('../src/db/seed');
let app: any;
let db: any;
before(async () => { ({ app, db } = await buildApp({ memoryDb: true, logger: false, rateLimit: false, worker: false })); });
after(async () => app?.close());

function client() {
  let cookie = '';
  const call = async (method: string, url: string, body?: unknown) => {
    const res = await app.inject({ method, url, payload: body as any, headers: cookie ? { cookie } : {} });
    const set = res.headers['set-cookie'];
    if (set) for (const c of Array.isArray(set) ? set : [set]) { const [kv] = c.split(';'); if (kv.split('=')[1]) cookie = kv; }
    let b: any = res.body;
    try { b = JSON.parse(res.body); } catch { /* bukan JSON */ }
    return { status: res.statusCode, body: b };
  };
  return { get: (u: string) => call('GET', u), post: (u: string, b?: unknown) => call('POST', u, b ?? {}) };
}

test('paket konten 10: semua aksesori baru ada di katalog, punya gambar & slot yang sah', async () => {
  const keys = new Map(builtinCatalog().wear.map((w: any) => [w.key, w.slot]));
  for (const it of SEED_ITEMS_V10) {
    const row = await db.one(`select id, kind, shop, data, art from items where id = $1`, [it.id]);
    assert.ok(row, `${it.id} ada di katalog`);
    assert.equal(row.kind, 'wear');
    assert.ok(['head', 'face', 'neck', 'back', 'hand'].includes(row.data.slot), `${it.id} slot sah`);
    assert.ok(keys.has(row.art.key), `${it.id} memakai gambar yang dikenal (${row.art.key})`);
    assert.equal(keys.get(row.art.key), row.data.slot, `${it.id} slot sama dengan gambarnya`);
    assert.ok(itemIcon(row as any).length > 80, `${it.id} punya ikon toko`);
    assert.ok(it.shop === 'butik' ? (it.price_coin ?? 0) > 0 : (it.price_pearl ?? 0) > 0, `${it.id} punya harga`);
  }
  assert.ok(SEED_ITEMS_V10.length >= 36);
});

test('slot Dibawa: beli balon lalu pakai bersama jubah; slot salah ditolak', async () => {
  const c = client();
  await c.post('/api/auth/guest', {});
  await c.post('/api/pet', { name: 'Gendis', color: '#F6B7A8', ear: 'kucing' });
  const me = (await c.get('/api/me')).body;
  await db.query(`update wallets set coin = 1000 where user_id = $1`, [me.user.id]);
  for (const id of ['balon-kuning', 'jubah-biru']) assert.equal((await c.post('/api/shop/buy', { itemId: id })).status, 200, `beli ${id}`);
  const r = await c.post('/api/pet/look', { wear: { hand: 'balon-kuning', back: 'jubah-biru' } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const pet = (await c.get('/api/me')).body.pet;
  assert.equal(pet.wear.hand, 'balon-kuning');
  assert.equal(pet.wear.back, 'jubah-biru');
  assert.equal((await c.post('/api/pet/look', { wear: { head: 'balon-kuning' } })).status, 400, 'balon tidak bisa dipakai di kepala');
  assert.equal((await c.post('/api/pet/look', { wear: { hand: 'lampion' } })).status, 400, 'belum punya lampion');
  // lepas
  assert.equal((await c.post('/api/pet/look', { wear: { hand: null } })).status, 200);
  assert.equal((await c.get('/api/me')).body.pet.wear.hand, undefined);
  // gambar pet memuat balon di depan badan
  const svg = petSVG(pet, [{ art: { type: 'builtin', key: 'balon', colors: { main: '#F2C230' } }, data: { slot: 'hand' } } as any]);
  assert.ok(svg.includes('#F2C230'));
});
