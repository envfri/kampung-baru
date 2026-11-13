// Butik Benang v0.32: paket konten 12 (28 baju + 12 aksesori), slot "Baju" (body), Kaca Pas (beli sekaligus),
// lencana barang baru, dan gambar pet berbaju di semua telinga/keadaan.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config';
import { builtinCatalog, itemIcon, mannequinSVG, petMarkup, PET_PARTS, WEAR_SLOTS } from '@kb/shared';

config.adminEmail = 'owner@test.local';
config.adminPassword = 'rahasia-sekali-123';
config.paymentProvider = 'mock';
const { buildApp } = await import('../src/app');
const { SEED_ITEMS_V12, SEED_ITEMS_BAJU, SEED_ITEMS_AKSESORI } = await import('../src/db/seed-butik');
const { invalidateCaches } = await import('../src/lib/core');
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
async function player(coin = 2000, pearl = 0) {
  const c = client();
  await c.post('/api/auth/guest', {});
  await c.post('/api/pet', { name: 'Benang', color: '#F6B7A8', ear: 'kucing' });
  const me = (await c.get('/api/me')).body;
  await db.query(`update wallets set coin = $2, pearl = $3 where user_id = $1`, [me.user.id, coin, pearl]);
  return { c, id: me.user.id as string };
}
const wallet = async (c: any) => (await c.get('/api/me')).body.wallet;
const BODY = 'M0 -78C30 -78 46 -56 46 -34C46 -14 28 -6 0 -6C-28 -6 -46 -14 -46 -34C-46 -56 -30 -78 0 -78Z';

/** cek sederhana: semua tag SVG tertutup rapi dan tidak ada nilai rusak */
function wellFormed(svg: string) {
  const stack: string[] = [];
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g)) {
    const [, close, name, , self] = m;
    if (self) continue;
    if (close) { if (stack.pop() !== name) return false; } else stack.push(name);
  }
  return stack.length === 0 && !/undefined|NaN|\[object/.test(svg);
}

test('paket konten 12: 28 baju + 12 aksesori, gambar & slot sah, harga jual ±40%, premium hanya di Toko Mutiara', async () => {
  assert.equal(SEED_ITEMS_BAJU.length, 28);
  assert.equal(SEED_ITEMS_AKSESORI.length, 12);
  assert.ok(WEAR_SLOTS.includes('body' as any));
  const keys = new Map(builtinCatalog().wear.map((w: any) => [w.key, w.slot]));
  for (const it of SEED_ITEMS_V12) {
    const row = await db.one(`select id, kind, shop, data, art, price_coin, price_pearl, sell_coin from items where id = $1`, [it.id]);
    assert.ok(row, `${it.id} ada di katalog`);
    assert.equal(row.kind, 'wear');
    assert.equal(keys.get(row.art.key), row.data.slot, `${it.id} slot sama dengan gambarnya (${row.art.key})`);
    assert.ok(itemIcon(row as any).length > 80, `${it.id} punya ikon toko`);
    if (row.shop === 'butik') {
      assert.ok(row.price_coin >= 15 && row.price_coin <= 200 && row.price_pearl === 0, `${it.id} harga koin`);
      assert.equal(row.sell_coin, Math.round(row.price_coin * 0.4), `${it.id} harga jual 40%`);
    } else {
      assert.equal(row.shop, 'mutiara', `${it.id} premium di Toko Mutiara`);
      assert.ok(row.price_pearl > 0 && row.price_coin === 0 && row.sell_coin === 0, `${it.id} hanya Mutiara`);
    }
  }
  const butik = await db.query(`select data->>'slot' slot, count(*)::int n from items where shop = 'butik' and active group by 1`);
  const n = Object.fromEntries(butik.map((r: any) => [r.slot, r.n]));
  assert.equal(n.body, 25, '25 baju koin di Butik');
  assert.equal((await db.one(`select count(*)::int n from items where shop = 'mutiara' and data->>'slot' = 'body'`)).n, 3);
  assert.equal((await db.one(`select count(*)::int n from items where shop = 'butik' and price_pearl > 0`)).n, 0, 'Butik tidak menjual barang Mutiara');
  // topi lama diberi label set, paket tidak dijalankan dua kali
  assert.equal((await db.one(`select data->>'outfit' o from items where id = 'topi-koki'`)).o, 'Koki Cilik');
  assert.ok(Number((await db.one(`select value from settings where key = 'content_pack'`)).value) >= 12);
  assert.ok(await db.one(`select 1 from settings where key = 'pack_butik'`), 'penanda paket butik tercatat');
});

test('slot Baju: pakai bersama punggung & leher, satu per slot, slot salah ditolak, bisa dilepas', async () => {
  const { c } = await player();
  for (const id of ['kaos-merah', 'kaos-biru', 'jubah-biru', 'syal-hijau']) assert.equal((await c.post('/api/shop/buy', { itemId: id })).status, 200, `beli ${id}`);
  let r = await c.post('/api/pet/look', { wear: { body: 'kaos-merah', back: 'jubah-biru', neck: 'syal-hijau' } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  let pet = (await c.get('/api/me')).body.pet;
  assert.deepEqual({ body: pet.wear.body, back: pet.wear.back, neck: pet.wear.neck }, { body: 'kaos-merah', back: 'jubah-biru', neck: 'syal-hijau' });
  // satu baju saja: yang baru menggantikan yang lama
  assert.equal((await c.post('/api/pet/look', { wear: { body: 'kaos-biru' } })).status, 200);
  pet = (await c.get('/api/me')).body.pet;
  assert.equal(pet.wear.body, 'kaos-biru');
  assert.equal(pet.wear.back, 'jubah-biru');
  assert.equal(Object.values(pet.wear).filter((id) => String(id).startsWith('kaos-')).length, 1);
  // baju bukan topi, topi bukan baju, belum punya ditolak
  assert.equal((await c.post('/api/pet/look', { wear: { head: 'kaos-merah' } })).status, 400);
  assert.equal((await c.post('/api/pet/look', { wear: { body: 'syal-hijau' } })).status, 400);
  assert.equal((await c.post('/api/pet/look', { wear: { body: 'kaos-hijau' } })).body.error.code, 'not_owned');
  // lepas
  assert.equal((await c.post('/api/pet/look', { wear: { body: null } })).status, 200);
  pet = (await c.get('/api/me')).body.pet;
  assert.equal(pet.wear.body, undefined);
  assert.equal(pet.wear.back, 'jubah-biru');
});

test('baju premium hanya lewat Mutiara', async () => {
  const { c } = await player(5000, 10);
  const r = await c.post('/api/shop/buy', { itemId: 'kostum-dino', currency: 'coin' });
  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, 'wrong_currency');
  assert.equal((await c.post('/api/shop/buy', { itemId: 'kostum-dino', currency: 'pearl' })).status, 200);
  const w = await wallet(c);
  assert.equal(w.pearl, 4);
  assert.equal(w.coin, 5000);
  assert.equal((await c.post('/api/pet/look', { wear: { body: 'kostum-dino' } })).status, 200);
});

test('Kaca Pas: beli banyak sekaligus, koin dicek untuk total keranjang secara atomik', async () => {
  // kurang koin untuk total (40 + 200 + 20 = 260): tidak ada yang terbeli
  const poor = await player(250);
  const basket = ['kaos-kuning', 'kebaya-kutubaru', 'ikat-merahputih'];
  let r = await poor.c.post('/api/shop/buy-many', { items: basket, total: { coin: 260, pearl: 0 } });
  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, 'insufficient_funds');
  let me = (await poor.c.get('/api/me')).body;
  assert.equal(me.wallet.coin, 250, 'koin tidak berkurang');
  for (const id of basket) assert.equal(me.inventory[id], undefined, `${id} tidak masuk tas`);

  // cukup: semua masuk tas, total dipotong sekali
  const rich = await player(1000);
  r = await rich.c.post('/api/shop/buy-many', { items: basket, total: { coin: 260, pearl: 0 }, requestId: 'kacapas-0001' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.wallet.coin, 740);
  for (const id of basket) assert.equal(r.body.inventory[id], 1);
  // klik ganda (requestId sama) tidak memotong lagi
  r = await rich.c.post('/api/shop/buy-many', { items: basket, total: { coin: 260, pearl: 0 }, requestId: 'kacapas-0001' });
  assert.equal(r.status, 200);
  assert.equal((await wallet(rich.c)).coin, 740);
  // pakaian yang sudah dimiliki tidak dibeli lagi
  r = await rich.c.post('/api/shop/buy-many', { items: ['kaos-kuning', 'kaos-hijau'] });
  assert.equal(r.body.error.code, 'owned');
  assert.equal((await wallet(rich.c)).coin, 740);
  // harga berubah sejak dilihat, dobel, bukan pakaian, tidak dijual, kosong
  assert.equal((await rich.c.post('/api/shop/buy-many', { items: ['kaos-hijau'], total: { coin: 10 } })).body.error.code, 'price_changed');
  assert.equal((await rich.c.post('/api/shop/buy-many', { items: ['kaos-hijau', 'kaos-hijau'] })).status, 400);
  assert.equal((await rich.c.post('/api/shop/buy-many', { items: ['meja-bambu'] })).body.error.code, 'not_for_sale');
  assert.equal((await rich.c.post('/api/shop/buy-many', { items: ['tidak-ada'] })).body.error.code, 'not_for_sale');
  assert.equal((await rich.c.post('/api/shop/buy-many', { items: [] })).status, 400);
  assert.equal((await wallet(rich.c)).coin, 740);

  // campuran koin + Mutiara: keduanya dicek
  const mix = await player(500, 2);
  r = await mix.c.post('/api/shop/buy-many', { items: ['kaos-merah', 'jaket-payet'] });
  assert.equal(r.body.error.code, 'insufficient_funds', 'Mutiara kurang (5 > 2)');
  assert.equal((await wallet(mix.c)).coin, 500, 'koin tidak terpotong walau koin cukup');
  await db.query(`update wallets set pearl = 9 where user_id = $1`, [mix.id]);
  r = await mix.c.post('/api/shop/buy-many', { items: ['kaos-merah', 'jaket-payet'] });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.wallet, { coin: 460, pearl: 4 });
  // tercatat sebagai pembelian per barang (tugas & event membaca "purchase")
  const n = await db.one(`select count(*)::int n from analytics_events where user_id = $1 and name = 'purchase'`, [mix.id]);
  assert.equal(n.n, 2);
});

test('lencana Baru: hanya barang yang ditambahkan sesudah katalog awal, selama 14 hari', async () => {
  let cat = (await client().get('/api/catalog')).body;
  assert.equal(cat.items.filter((i: any) => i.new_until).length, 0, 'katalog awal tidak ditandai baru');
  await db.query(`update items set created_at = now() - interval '90 days'`);
  await db.query(`update items set created_at = now() - interval '3 days' where id = any($1::text[])`, [['kaos-merah', 'kipas-batik']]);
  await db.query(`update items set created_at = now() - interval '20 days' where id = 'kaos-biru'`);
  invalidateCaches();
  cat = (await client().get('/api/catalog')).body;
  const fresh = cat.items.filter((i: any) => i.new_until).map((i: any) => i.id).sort();
  assert.deepEqual(fresh, ['kaos-merah', 'kipas-batik']);
  const it = cat.items.find((i: any) => i.id === 'kaos-merah');
  assert.ok(it.new_until > Date.now() + 10 * 86_400_000 && it.new_until < Date.now() + 12 * 86_400_000);
});

test('admin: item baju bisa dibuat & disimpan dengan slot body dan nama set', async () => {
  const owner = client();
  assert.equal((await owner.post('/api/admin/login', { email: 'owner@test.local', password: 'rahasia-sekali-123' })).status, 200);
  const body = { id: 'kaos-ungu', kind: 'wear', name: 'Kaos Ungu', description: '', price_coin: 40, price_pearl: 0, sell_coin: 16, shop: 'butik', art: { type: 'builtin', key: 'kaos', colors: { main: '#9A6FC0' } }, data: { slot: 'body', outfit: 'Ungu Ceria' }, active: true, sort: 9999 };
  const r = await owner.post('/api/admin/items', body);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const row = await db.one(`select data from items where id = 'kaos-ungu'`);
  assert.deepEqual(row.data, { slot: 'body', outfit: 'Ungu Ceria' });
  assert.equal((await owner.call('PUT', '/api/admin/items/kaos-ungu', { ...body, data: { slot: 'perut' } })).status, 400);
  assert.equal((await owner.call('PUT', '/api/admin/items/kaos-ungu', { ...body, data: { slot: 'body', outfit: 'x'.repeat(40) } })).status, 400);
});

test('gambar: setiap baju rapi di semua telinga, ekor, gembul, kotor, sakit, dan lapisan sesuai urutan', () => {
  const wear = (key: string, slot: string, colors?: Record<string, string>) => ({ id: key, kind: 'wear', name: key, art: { type: 'builtin', key, ...(colors ? { colors } : {}) }, data: { slot } }) as any;
  const ears = PET_PARTS.ear.map((e) => e[0]);
  const tails = PET_PARTS.tail.map((e) => e[0]);
  const states = [{}, { chub: 1 }, { dirt: 1 }, { mood: 'sakit' }, { mood: 'tidur', chub: 0.5, dirt: 0.4 }];
  SEED_ITEMS_BAJU.forEach((it, i) => {
    const look = { color: '#F6B7A8', ear: ears[i % ears.length], pattern: ['polos', 'totol', 'belang', 'ujung'][i % 4], eyes: 'bulat', tail: tails[i % tails.length] };
    const extra = [wear('jubah', 'back'), wear('syal', 'neck'), wear('kupluk', 'head'), wear('balon', 'hand')];
    for (const st of states) {
      const svg = petMarkup({ look, wear: [wear(it.art.key, 'body', it.art.colors), ...extra], state: st, flip: i % 2 === 1 });
      assert.ok(wellFormed(svg), `${it.id} markup rapi (${look.ear}, ${JSON.stringify(st)})`);
      const at = (s: string) => svg.indexOf(s);
      const fill = at(`<path d="${BODY}" fill="#F6B7A8"/>`), outline = at(`<path d="${BODY}" fill="none" stroke="#2B2F4A" stroke-width="3.5"/>`);
      assert.ok(fill > 0 && at('class="w-body-back"') > 0 && at('class="w-body-back"') < fill, `${it.id}: lengan di belakang badan`);
      assert.ok(at('class="w-body"') > fill && at('class="w-body"') < outline, `${it.id}: baju di atas bulu, di bawah garis tepi`);
      assert.ok(outline < at('class="eyes') && outline < at('#E0583F" stroke="#2B2F4A" stroke-width="3" stroke-linejoin="round"/><rect x="-40" y="-72"'), `${it.id}: wajah & topi di atas baju`);
      if (it.art.colors?.main) assert.ok(svg.includes(it.art.colors.main), `${it.id}: warna dari katalog`);
    }
    assert.ok(wellFormed(mannequinSVG(wear(it.art.key, 'body', it.art.colors))), `${it.id}: manekin`);
  });
  // tanpa baju: sorotan perut tetap ada; dengan baju diganti kain
  const plain = petMarkup({ look: { color: '#F6B7A8', ear: 'kucing' }, wear: [] });
  assert.ok(plain.includes('cy="-23" rx="24"') && !plain.includes('w-body'));
  // aksesori tambahan juga rapi
  for (const it of SEED_ITEMS_AKSESORI) assert.ok(wellFormed(petMarkup({ look: { color: '#9FD0E8', ear: 'anjing' }, wear: [wear(it.art.key, it.data.slot)] })), it.id);
  // baju upload gambar ikut dipotong bentuk badan
  const img = petMarkup({ look: { color: '#F6B7A8', ear: 'kucing' }, wear: [{ id: 'x', kind: 'wear', name: 'x', art: { type: 'image', url: '/media/abc.png' }, data: { slot: 'body' } } as any] });
  assert.ok(/class="w-body" clip-path="url\(#kb-body\)"><image href="\/media\/abc.png"/.test(img));
});
