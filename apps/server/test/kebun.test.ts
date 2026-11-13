import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { config } from '../src/config';

config.adminEmail = 'owner@test.local';
config.adminPassword = 'rahasia-sekali-123';

const { buildApp } = await import('../src/app');
const { openDb } = await import('../src/db/index');
const { invalidateCaches } = await import('../src/lib/core');
let app: any;
let db: any;

before(async () => {
  ({ app, db } = await buildApp({ memoryDb: true, logger: false, rateLimit: false, worker: false }));
});
after(async () => app?.close());

function client(a = () => app) {
  let cookie = '';
  const call = async (method: string, url: string, body?: unknown) => {
    const res = await a().inject({ method, url, payload: body as any, headers: cookie ? { cookie } : {} });
    const set = res.headers['set-cookie'];
    if (set) {
      const list = Array.isArray(set) ? set : [set];
      const jar = new Map(cookie ? cookie.split('; ').map((c: string) => c.split('=') as [string, string]) : []);
      for (const c of list) { const [kv] = c.split(';'); const [k, v] = kv.split('='); if (v) jar.set(k, v); else jar.delete(k); }
      cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    }
    return { status: res.statusCode, body: res.body ? (() => { try { return JSON.parse(res.body); } catch { return res.body; } })() : null };
  };
  return { call, get: (u: string) => call('GET', u), post: (u: string, b?: unknown) => call('POST', u, b ?? {}), put: (u: string, b?: unknown) => call('PUT', u, b ?? {}) };
}

async function player(a = () => app) {
  const c = client(a);
  assert.equal((await c.post('/api/auth/guest')).status, 200);
  const p = await c.post('/api/pet', { name: 'Kebo', color: '#F6B7A8', ear: 'tunas' });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  return { c, id: p.body.state.user.id as string, state: p.body.state };
}
const setPet = (id: string, level: number) => db.query(`update pets set level = $2 where user_id = $1`, [id, level]);
const setCoin = (id: string, coin: number) => db.query(`update wallets set coin = $2 where user_id = $1`, [id, coin]);
const setLevel = (id: string, lv: number) => db.query(`update users set garden_level = $2 where id = $1`, [id, lv]);
const give = (id: string, item: string, qty: number) => db.query(`insert into inventory (user_id, item_id, qty) values ($1,$2,$3) on conflict (user_id, item_id) do update set qty = excluded.qty`, [id, item, qty]);
const plotRow = (id: string, slot: number) => db.one(`select *, extract(epoch from ready_at - now())::float8 as left_sec from garden_plots where user_id = $1 and slot = $2`, [id, slot]);
const ripen = (id: string) => db.query(`update garden_plots set ready_at = now() - interval '1 second' where user_id = $1`, [id]);

test('pemain baru: Kebun Lv1 dengan 6 petak, petak ke-7 ditolak', async () => {
  const { c, state } = await player();
  assert.equal(state.gardenLevel, 1);
  assert.equal((await c.post('/api/garden/plant', { slot: 5, seedId: 'bibit-tomat' })).status, 200);
  const r = await c.post('/api/garden/plant', { slot: 6, seedId: 'bibit-tomat' });
  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, 'invalid');
});

test('perluas kebun: syarat level pet, koin, tingkat maksimal, dan atomik', async () => {
  const { c, id } = await player();
  // pet masih Lv1, Lv2 butuh pet Lv3
  let r = await c.post('/api/garden/expand', { to: 2 });
  assert.equal(r.body.error.code, 'pet_level');
  await setPet(id, 3);
  await setCoin(id, 399);
  r = await c.post('/api/garden/expand', { to: 2 });
  assert.equal(r.body.error.code, 'insufficient_funds');
  assert.equal((await db.one(`select garden_level from users where id = $1`, [id])).garden_level, 1, 'gagal bayar → tingkat tidak berubah');
  await setCoin(id, 1000);
  // dua ketukan bersamaan ke Lv2: hanya satu yang membayar
  const [a, b] = await Promise.all([c.post('/api/garden/expand', { to: 2 }), c.post('/api/garden/expand', { to: 2 })]);
  const ok = [a, b].filter((x) => x.status === 200);
  assert.equal(ok.length, 1, JSON.stringify([a.body, b.body]));
  assert.equal([a, b].find((x) => x.status !== 200)!.body.error.code, 'stale');
  assert.equal(ok[0].body.gardenLevel, 2);
  assert.equal(ok[0].body.wallet.coin, 600);
  const led = await db.one(`select delta, reason from wallet_ledger where user_id = $1 and reason = 'garden_expand'`, [id]);
  assert.equal(led.delta, -400);
  // Lv2 = 9 petak
  assert.equal((await c.post('/api/garden/plant', { slot: 8, seedId: 'bibit-tomat' })).status, 200);
  assert.equal((await c.post('/api/garden/plant', { slot: 9, seedId: 'bibit-tomat' })).status, 400);
  // Lv3 butuh pet Lv6
  r = await c.post('/api/garden/expand', { to: 3 });
  assert.equal(r.body.error.code, 'pet_level');
  // tingkat maksimal
  await setLevel(id, 5);
  r = await c.post('/api/garden/expand');
  assert.equal(r.body.error.code, 'max_level');
  const me = (await c.get('/api/me')).body;
  assert.equal(me.gardenLevel, 5);
  assert.equal(me.user.garden_level, undefined);
});

test('tanam: bibit terkunci level pet, beli & tanam, Tanam semua (Kebun Lv4)', async () => {
  const { c, id } = await player();
  let r = await c.post('/api/garden/plant', { slot: 0, seedId: 'bibit-anggrek', buy: true });
  assert.equal(r.body.error.code, 'locked');
  r = await c.post('/api/shop/buy', { itemId: 'bibit-anggrek' });
  assert.equal(r.body.error.code, 'locked', 'bibit terkunci juga tidak bisa dibeli di Pasar');
  // tidak punya bibit kangkung: tanpa buy ditolak, dengan buy langsung dibeli
  r = await c.post('/api/garden/plant', { slot: 0, seedId: 'bibit-kangkung' });
  assert.equal(r.body.error.code, 'not_owned');
  await setCoin(id, 100);
  r = await c.post('/api/garden/plant', { slot: 0, seedId: 'bibit-kangkung', buy: true });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.wallet.coin, 96);
  assert.equal(r.body.bought, 1);
  // Tanam semua belum terbuka
  r = await c.post('/api/garden/plant', { seedId: 'bibit-tomat', all: true });
  assert.equal(r.body.error.code, 'locked');
  await setLevel(id, 4);
  await give(id, 'bibit-tomat', 2);
  // tanpa buy: hanya sebanyak bibit di tas (petak yang diketuk duluan)
  r = await c.post('/api/garden/plant', { slot: 7, seedId: 'bibit-tomat', all: true });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.slots, [7, 1]);
  assert.equal(r.body.inventory['bibit-tomat'], undefined);
  // dengan buy: sisa 12 petak kosong (15 − 3) dibeli semua
  await setCoin(id, 1000);
  r = await c.post('/api/garden/plant', { seedId: 'bibit-tomat', all: true, buy: true });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.planted, 12);
  assert.equal(r.body.bought, 12);
  assert.equal(r.body.wallet.coin, 1000 - 12 * 10);
  assert.equal(r.body.garden.length, 15);
  r = await c.post('/api/garden/plant', { seedId: 'bibit-tomat', all: true, buy: true });
  assert.equal(r.body.error.code, 'full');
});

test('panen semua dalam satu transaksi dan melapor hasilnya', async () => {
  const { c, id } = await player();
  await give(id, 'bibit-tomat', 3);
  await give(id, 'bibit-jagung', 2);
  for (const [slot, seedId] of [[0, 'bibit-tomat'], [1, 'bibit-tomat'], [2, 'bibit-jagung'], [3, 'bibit-jagung'], [4, 'bibit-tomat']] as const) {
    assert.equal((await c.post('/api/garden/plant', { slot, seedId })).status, 200);
  }
  let r = await c.post('/api/garden/harvest-all');
  assert.equal(r.body.error.code, 'nothing_ready');
  await db.query(`update garden_plots set ready_at = now() - interval '1 second' where user_id = $1 and slot <> 4`, [id]);
  const before = (await c.get('/api/me')).body;
  r = await c.post('/api/garden/harvest-all');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.count, 4);
  const got = Object.fromEntries(r.body.items.map((x: any) => [x.itemId, x.qty]));
  assert.equal(got.tomat, 6);
  assert.equal(got.jagung, 6);
  assert.equal(r.body.bonus, 0, 'Lv1 belum punya orang-orangan sawah');
  assert.equal(r.body.inventory.tomat, 6);
  assert.deepEqual(r.body.garden.map((p: any) => p.slot), [4], 'yang belum siap tetap di petaknya');
  assert.equal(r.body.xp, 12, 'XP per bibit (tomat & jagung 3)');
  assert.ok(r.body.pet.xp + r.body.pet.level * 1000 > before.pet.xp + before.pet.level * 1000);
  const quest = await db.one(`select count(*)::int n from analytics_events where user_id = $1 and name = 'harvest'`, [id]);
  assert.equal(quest.n, 4, 'satu peristiwa panen per petak (tugas & poin event)');
});

test('XP panen per bibit dibatasi per hari', async () => {
  const { c, id } = await player();
  const { today } = await import('../src/lib/core');
  await db.query(`insert into daily_counters (user_id, key, day, count) values ($1, 'garden_xp', $2, 148) on conflict (user_id, key, day) do update set count = 148`, [id, today()]);
  await give(id, 'bibit-tomat', 1);
  await c.post('/api/garden/plant', { slot: 0, seedId: 'bibit-tomat' });
  await ripen(id);
  const r = await c.post('/api/garden/harvest', { slot: 0 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.xp, 2, 'sisa jatah XP hari ini');
  assert.equal(r.body.harvested.itemId, 'tomat');
  assert.equal(r.body.harvested.qty, 3);
});

test('orang-orangan sawah (Lv2+) memberi hasil +1 sesuai peluang', async () => {
  const { c, id } = await player();
  await setLevel(id, 2);
  const before = (await db.one(`select value from settings where key = 'game'`))?.value ?? {};
  await db.query(`insert into settings (key, value) values ('game', $1::text::jsonb) on conflict (key) do update set value = excluded.value`, [JSON.stringify({ ...before, garden: { ...(before.garden ?? {}), scarecrowPct: 100 } })]);
  invalidateCaches();
  try {
    await give(id, 'bibit-tomat', 2);
    await c.post('/api/garden/plant', { slot: 0, seedId: 'bibit-tomat' });
    await c.post('/api/garden/plant', { slot: 1, seedId: 'bibit-tomat' });
    await ripen(id);
    const r = await c.post('/api/garden/harvest-all');
    assert.equal(r.body.bonus, 2);
    assert.equal(r.body.items[0].qty, 8);
  } finally {
    await db.query(`update settings set value = $1::text::jsonb where key = 'game'`, [JSON.stringify(before)]);
    invalidateCaches();
  }
});

test('siram −10% & pupuk −25% dari lama tumbuh, sekali per tanam, tidak melewati sekarang', async () => {
  const { c, id } = await player();
  await give(id, 'bibit-tomat', 3);
  await c.post('/api/garden/plant', { slot: 0, seedId: 'bibit-tomat' });
  let p = await plotRow(id, 0);
  assert.equal(p.grow_sec, 1800);
  assert.ok(Math.abs(p.left_sec - 1800) < 5);
  let r = await c.post('/api/garden/water', { slot: 0 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.body.garden[0].watered_at);
  p = await plotRow(id, 0);
  assert.ok(Math.abs(p.left_sec - 1620) < 5, `sisa ${p.left_sec}`);
  r = await c.post('/api/garden/water', { slot: 0 });
  assert.equal(r.body.error.code, 'watered');
  // pupuk: tidak punya → ditolak; beli & pakai sekali ketuk
  r = await c.post('/api/garden/fertilize', { slot: 0 });
  assert.equal(r.body.error.code, 'not_owned');
  const coin = (await c.get('/api/me')).body.wallet.coin;
  r = await c.post('/api/garden/fertilize', { slot: 0, buy: true });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.wallet.coin, coin - 15);
  p = await plotRow(id, 0);
  assert.ok(Math.abs(p.left_sec - 1170) < 5, `siram + pupuk = −35%, sisa ${p.left_sec}`);
  r = await c.post('/api/garden/fertilize', { slot: 0, buy: true });
  assert.equal(r.body.error.code, 'fertilized');
  // pupuk dari tas
  await give(id, 'pupuk', 2);
  await c.post('/api/garden/plant', { slot: 1, seedId: 'bibit-tomat' });
  r = await c.post('/api/garden/fertilize', { slot: 1 });
  assert.equal(r.body.inventory.pupuk, 1);
  // hampir siap: siram tidak membuat waktu siap jatuh sebelum sekarang
  await c.post('/api/garden/plant', { slot: 2, seedId: 'bibit-tomat' });
  await db.query(`update garden_plots set ready_at = now() + interval '20 seconds' where user_id = $1 and slot = 2`, [id]);
  r = await c.post('/api/garden/water', { slot: 2 });
  assert.equal(r.status, 200);
  p = await plotRow(id, 2);
  assert.ok(p.left_sec <= 0.5 && p.left_sec > -5, `sisa ${p.left_sec}`);
  assert.equal((await c.post('/api/garden/harvest', { slot: 2 })).status, 200);
  // tanaman yang sudah siap tidak disiram; petak kosong
  assert.equal((await c.post('/api/garden/water', { slot: 2 })).body.error.code, 'not_found');
});

test('siram semua butuh gentong (Lv3); tanah subur (Lv5) mempercepat 10%', async () => {
  const { c, id } = await player();
  await give(id, 'bibit-tomat', 5);
  for (const slot of [0, 1, 2]) await c.post('/api/garden/plant', { slot, seedId: 'bibit-tomat' });
  let r = await c.post('/api/garden/water', { all: true });
  assert.equal(r.body.error.code, 'locked');
  await setLevel(id, 3);
  await c.post('/api/garden/water', { slot: 1 });
  r = await c.post('/api/garden/water', { all: true });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.watered, 2);
  r = await c.post('/api/garden/water', { all: true });
  assert.equal(r.body.error.code, 'nothing');
  assert.equal((await db.one(`select count(*)::int n from analytics_events where user_id = $1 and name = 'water'`, [id])).n, 3);
  await setLevel(id, 5);
  await c.post('/api/garden/plant', { slot: 3, seedId: 'bibit-tomat' });
  assert.equal((await plotRow(id, 3)).grow_sec, 1620);
});

test('jatah tanam harian', async () => {
  const { c, id } = await player();
  const { today } = await import('../src/lib/core');
  await db.query(`insert into daily_counters (user_id, key, day, count) values ($1, 'garden_plant', $2, 300)`, [id, today()]);
  const r = await c.post('/api/garden/plant', { slot: 0, seedId: 'bibit-tomat' });
  assert.equal(r.body.error.code, 'daily_limit');
});

test('admin: tabel tingkat kebun divalidasi', async () => {
  const o = client();
  assert.equal((await o.post('/api/admin/login', { email: 'owner@test.local', password: 'rahasia-sekali-123' })).status, 200);
  const cur = (await o.get('/api/admin/settings')).body.value;
  assert.equal(cur.garden.levels.length, 5);
  assert.deepEqual(cur.garden.levels.map((l: any) => l.slots), [6, 9, 12, 15, 18]);
  const put = (garden: any) => o.put('/api/admin/settings', { value: { ...cur, garden: { ...cur.garden, ...garden } } });
  assert.equal((await put({ levels: [{ slots: 6 }, { slots: 10, coins: 100, petLevel: 2 }] })).status, 400, 'bukan kelipatan 3');
  assert.equal((await put({ levels: [{ slots: 6 }, { slots: 21, coins: 100, petLevel: 2 }] })).status, 400, 'lebih dari 18');
  assert.equal((await put({ levels: [{ slots: 9 }, { slots: 6, coins: 100, petLevel: 2 }] })).status, 400, 'harus naik');
  assert.equal((await put({ fertilizerPct: 95 })).status, 400);
  const ok = await put({ levels: [{ slots: 6, coins: 50, petLevel: 9 }, { slots: 9, coins: '500', petLevel: 4 }], fertilizerPct: 30 });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.deepEqual(ok.body.value.garden.levels, [{ slots: 6, coins: 0, petLevel: 1 }, { slots: 9, coins: 500, petLevel: 4 }]);
  // seorang pemain di Lv5 tetap dibatasi ke tingkat yang ada
  const { c, id } = await player();
  await setLevel(id, 5);
  assert.equal((await c.post('/api/garden/plant', { slot: 9, seedId: 'bibit-tomat' })).status, 400);
  assert.equal((await c.post('/api/garden/expand')).body.error.code, 'max_level');
  assert.equal((await o.put('/api/admin/settings', { value: cur })).status, 200);
  // data bibit baru tetap utuh saat disimpan dari editor item
  const it = (await o.get('/api/admin/items')).body.items.find((i: any) => i.id === 'bibit-wortel');
  const save = await o.put('/api/admin/items/bibit-wortel', { ...it, price_coin: 13 });
  assert.equal(save.status, 200, JSON.stringify(save.body));
  const after = (await o.get('/api/admin/items')).body.items.find((i: any) => i.id === 'bibit-wortel');
  assert.equal(after.data.crop, 'wortel');
  assert.equal(after.data.minLevel, 3);
  assert.equal(after.data.harvestXp, 3);
  assert.equal(after.data.cat, 'sayur');
  assert.equal(after.art.params.pic, 7);
});

test('katalog: 18 bibit, hasil panen, dan pupuk', async () => {
  const cat = (await client().get('/api/catalog')).body;
  const seeds = cat.items.filter((i: any) => i.kind === 'seed');
  assert.equal(seeds.length, 18);
  for (const s of seeds) {
    assert.ok(cat.items.find((i: any) => i.id === s.data.yieldItem), `hasil ${s.id}`);
    assert.ok(s.data.crop, `gambar tanaman ${s.id}`);
    assert.ok(s.art.params?.pic > 0, `gambar bungkus ${s.id}`);
  }
  assert.ok(cat.items.find((i: any) => i.id === 'pupuk' && i.shop === 'pasar' && i.price_coin === 15));
  assert.ok(Array.isArray(cat.settings.garden.levels));
});

test('naik dari database content_pack 10: petak & bibit pemain tetap ada', async () => {
  // database "lama": dibuat lengkap, lalu dikembalikan ke bentuk sebelum migrasi 025 & paket 13
  const old = await openDb({ memory: true });
  let A = (await buildApp({ db: old, logger: false, rateLimit: false, worker: false })).app;
  let cur = A;
  const c = client(() => cur);
  assert.equal((await c.post('/api/auth/guest')).status, 200);
  const st = (await c.post('/api/pet', { name: 'Lama', color: '#F6B7A8', ear: 'tunas' })).body.state;
  const uid = st.user.id;
  await c.post('/api/garden/plant', { slot: 0, seedId: 'bibit-tomat' });
  await old.query(`insert into inventory (user_id, item_id, qty) values ($1, 'bibit-jagung', 4) on conflict (user_id, item_id) do update set qty = 4`, [uid]);
  await old.query(`insert into garden_plots (user_id, slot, seed_id, planted_at, ready_at) values ($1, 5, 'bibit-jagung', now() - interval '20 minutes', now() + interval '40 minutes')`, [uid]);
  await A.close();
  const newIds = ['bibit-kangkung', 'bibit-cabai', 'bibit-wortel', 'bibit-terong', 'bibit-matahari', 'bibit-singkong', 'bibit-labu', 'bibit-mawar', 'bibit-semangka', 'bibit-padi', 'bibit-nanas', 'bibit-anggrek', 'bibit-timunsuri', 'bibit-merahputih',
    'kangkung', 'cabai', 'wortel', 'terong', 'bunga-matahari', 'singkong', 'labu', 'mawar', 'semangka', 'padi-ketan', 'nanas', 'anggrek-bulan', 'timun-suri', 'kembang-merahputih', 'pupuk'];
  await old.exec(`
    alter table users drop column garden_level;
    alter table garden_plots drop column grow_sec, drop column watered_at, drop column fertilized_at;
    delete from schema_migrations where name = '025_kebun.sql';
    delete from items where id in (${newIds.map((i) => `'${i}'`).join(',')});
    delete from quests where id in ('h-siram', 'b-kebun');
    delete from events where id = 'ramadan';
    update items set data = data - 'crop' - 'cat' - 'harvestXp', art = art - 'params' where id in ('bibit-tomat', 'bibit-jagung', 'bibit-melati', 'bibit-stroberi');
    update items set price_coin = 11 where id = 'bibit-tomat';
    insert into settings (key, value) values ('game', '{"garden":{"slots":6,"harvestXp":3}}'::jsonb) on conflict (key) do update set value = excluded.value;
    update settings set value = '10'::jsonb where key = 'content_pack';
    delete from settings where key like 'pack\_%';
  `);
  invalidateCaches();
  const plotsBefore = await old.query(`select slot, seed_id, planted_at, ready_at from garden_plots where user_id = $1 order by slot`, [uid]);
  assert.equal(plotsBefore.length, 2);
  // server versi baru dijalankan di atas database lama
  const B = (await buildApp({ db: old, logger: false, rateLimit: false, worker: false })).app;
  cur = B;
  try {
    assert.equal((await old.one(`select value from settings where key = 'content_pack'`)).value, 13);
    const me = (await c.get('/api/me')).body;
    assert.equal(me.gardenLevel, 1, 'pemain lama mulai di Kebun Lv1');
    assert.deepEqual(me.garden.map((p: any) => [p.slot, p.seed_id]), [[0, 'bibit-tomat'], [5, 'bibit-jagung']]);
    assert.equal(new Date(me.garden[1].ready_at).getTime(), new Date(plotsBefore[1].ready_at).getTime(), 'waktu siap tidak berubah');
    assert.equal(me.inventory['bibit-jagung'], 4, 'bibit di tas tetap');
    const p5 = await old.one(`select grow_sec from garden_plots where user_id = $1 and slot = 5`, [uid]);
    assert.equal(p5.grow_sec, 3600, 'lama tumbuh tanaman lama diisi dari waktu tanam');
    // bibit lama dapat data baru tanpa mengubah harga buatan admin
    const tomat = await old.one(`select price_coin, data, art from items where id = 'bibit-tomat'`);
    assert.equal(tomat.price_coin, 11);
    assert.equal(tomat.data.growMinutes, 30);
    assert.equal(tomat.data.crop, 'tomat');
    assert.equal(tomat.art.params.pic, 1);
    const g = await old.one(`select value from settings where key = 'game'`);
    assert.equal(g.value.garden.slots, undefined, 'pengaturan lama garden.slots dibersihkan');
    // siram tanaman lama memakai lama tumbuh hasil migrasi (−10% dari 60 menit = 6 menit)
    const w = await c.post('/api/garden/water', { slot: 5 });
    assert.equal(w.status, 200, JSON.stringify(w.body));
    const after = await old.one(`select ready_at from garden_plots where user_id = $1 and slot = 5`, [uid]);
    assert.equal(new Date(plotsBefore[1].ready_at).getTime() - new Date(after.ready_at).getTime(), 360_000);
    // panen tanaman lama tetap jalan
    await old.query(`update garden_plots set ready_at = now() - interval '1 second' where user_id = $1`, [uid]);
    const h = await c.post('/api/garden/harvest-all');
    assert.equal(h.status, 200, JSON.stringify(h.body));
    assert.equal(h.body.count, 2);
    // menjalankan ulang tidak menambah apa-apa
    const { seedPackV13 } = await import('../src/db/seed-kebun');
    assert.equal(await seedPackV13(old), false);
  } finally {
    await B.close();
    await old.close();
    invalidateCaches();
  }
});

test('migrasi 025 aman dijalankan ulang', async () => {
  const sql = readFileSync(new URL('../src/db/migrations/025_kebun.sql', import.meta.url), 'utf8');
  await db.exec(sql);
  await db.exec(sql);
  assert.ok(true);
});
