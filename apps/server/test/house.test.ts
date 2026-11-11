// Rumah multi-ruangan (beli di Toko Bangunan) dan aktivitas di rumah (pakai mebel, lihat jendela).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config';

config.adminEmail = 'owner@test.local';
config.adminPassword = 'rahasia-sekali-123';
config.paymentProvider = 'mock';

const { buildApp } = await import('../src/app');
let app: any;
let db: any;

before(async () => {
  ({ app, db } = await buildApp({ memoryDb: true, logger: false, rateLimit: false, worker: false }));
});
after(async () => app?.close());

function client() {
  let cookie = '';
  const call = async (method: string, url: string, body?: unknown) => {
    const res = await app.inject({ method, url, payload: body as any, headers: cookie ? { cookie } : {} });
    const set = res.headers['set-cookie'];
    if (set) {
      const list = Array.isArray(set) ? set : [set];
      const jar = new Map(cookie ? cookie.split('; ').map((c: string) => c.split('=') as [string, string]) : []);
      for (const c of list) { const [kv] = c.split(';'); const [k, v] = kv.split('='); if (v) jar.set(k, v); else jar.delete(k); }
      cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    }
    return { status: res.statusCode, body: res.body ? (() => { try { return JSON.parse(res.body); } catch { return res.body; } })() : null };
  };
  return { call, get: (u: string) => call('GET', u), post: (u: string, b?: unknown) => call('POST', u, b ?? {}) };
}

async function rich(coins = 5000) {
  const c = client();
  const g = await c.post('/api/auth/guest');
  assert.equal(g.status, 200);
  const p = await c.post('/api/pet', { name: 'Gembul', color: '#F6B7A8', ear: 'tunas' });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  const id = p.body.state.user.id;
  await db.query(`update wallets set coin = $2 where user_id = $1`, [id, coins]);
  return { c, id, state: p.body.state };
}

test('pemain baru punya satu kamar; katalog memuat ruangan, Toko Bangunan, dan aktivitas', async () => {
  const { c, state } = await rich();
  assert.equal(state.rooms.length, 1);
  assert.equal(state.rooms[0].name, 'Kamar');
  assert.equal(state.rooms[0].size, 6);
  assert.equal(state.rooms[0].theme, 'dalam');
  const cat = (await c.get('/api/catalog')).body;
  assert.ok(cat.locations.some((l: any) => l.id === 'bangunan' && l.kind === 'shop'));
  assert.ok(cat.items.some((i: any) => i.id === 'halaman' && i.kind === 'room' && i.data.theme === 'luar'));
  assert.ok(cat.activities.some((a: any) => a.id === 'tidur-kasur' && a.targets.includes('art:kasur')));
});

test('beli ruangan: muncul di rumah dengan ukuran & tema dari item, tidak bisa dibeli dua kali', async () => {
  const { c } = await rich();
  const r = await c.post('/api/shop/buy', { itemId: 'halaman', currency: 'coin' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.wallet.coin, 5000 - 750);
  const yard = r.body.rooms.find((x: any) => x.id === r.body.roomId);
  assert.equal(yard.name, 'Halaman Rumput');
  assert.equal(yard.size, 7);
  assert.equal(yard.theme, 'luar');
  assert.equal(yard.floor, 'fl-rumput');
  const again = await c.post('/api/shop/buy', { itemId: 'halaman', currency: 'coin' });
  assert.equal(again.status, 400);
  assert.equal(again.body.error.code, 'owned');
  // ruangan tidak masuk tas
  assert.equal(r.body.inventory?.halaman, undefined);
});

test('susunan tiap ruangan disimpan terpisah, batas petak mengikuti ukuran ruangannya', async () => {
  const { c, state } = await rich();
  const buy = await c.post('/api/shop/buy', { itemId: 'kamar-mandi', currency: 'coin' });
  assert.equal(buy.status, 200);
  const bath = buy.body.rooms.find((x: any) => x.id === buy.body.roomId);
  assert.equal(bath.size, 4);
  await c.post('/api/shop/buy', { itemId: 'pot-monstera', currency: 'coin' });
  // petak (5,0) keluar dari kamar mandi 4×4
  const out = await c.post('/api/room', { roomId: bath.id, version: bath.version, layout: [{ i: 'pot-monstera', x: 5, y: 0 }] });
  assert.equal(out.status, 400);
  const ok = await c.post('/api/room', { roomId: bath.id, version: bath.version, layout: [{ i: 'pot-monstera', x: 3, y: 3 }] });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  const rooms = ok.body.rooms;
  assert.deepEqual(rooms.find((x: any) => x.id === bath.id).layout, [{ i: 'pot-monstera', x: 3, y: 3 }]);
  // kamar awal tidak berubah
  assert.equal(rooms[0].layout.length, state.rooms[0].layout.length);
  assert.equal(ok.body.inventory['pot-monstera'], undefined);
});

test('batas jumlah ruangan dari pengaturan rumah', async () => {
  const { c } = await rich(10000);
  await db.query(`insert into settings (key, value) values ('game', '{"house":{"maxRooms":2}}'::jsonb) on conflict (key) do update set value = excluded.value`);
  const { invalidateCaches } = await import('../src/lib/core');
  invalidateCaches();
  try {
    assert.equal((await c.post('/api/shop/buy', { itemId: 'dapur', currency: 'coin' })).status, 200);
    const r = await c.post('/api/shop/buy', { itemId: 'ruang-tamu', currency: 'coin' });
    assert.equal(r.status, 400);
    assert.equal(r.body.error.code, 'max_rooms');
  } finally {
    await db.query(`delete from settings where key = 'game'`);
    invalidateCaches();
  }
});

test('aktivitas: tidur di kasur menambah energi, lalu kena jeda; mebel yang salah ditolak', async () => {
  const { c, state } = await rich();
  const room = state.rooms[0];
  const bed = room.layout.findIndex((p: any) => p.i === 'kasur-rotan');
  const plant = room.layout.findIndex((p: any) => p.i === 'pot-monstera');
  assert.ok(bed >= 0 && plant >= 0);
  await db.query(`update pets set energi = 30, needs_at = now() where user_id = $1`, [state.user.id]);
  const r = await c.post('/api/activity', { activityId: 'tidur-kasur', roomId: room.id, index: bed, requestId: 'a1-' + Date.now() });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.body.pet.needs.energi >= 44, String(r.body.pet.needs.energi));
  assert.match(r.body.result.message, /Gembul rebahan sebentar di Kasur Rotan/);
  const again = await c.post('/api/activity', { activityId: 'tidur-kasur', roomId: room.id, index: bed });
  assert.equal(again.status, 400);
  assert.equal(again.body.error.code, 'cooldown');
  const wrong = await c.post('/api/activity', { activityId: 'tidur-kasur', roomId: room.id, index: plant });
  assert.equal(wrong.status, 400);
  assert.equal(wrong.body.error.code, 'invalid_target');
  const water = await c.post('/api/activity', { activityId: 'siram-tanaman', roomId: room.id, index: plant });
  assert.equal(water.status, 200, JSON.stringify(water.body));
  assert.ok(water.body.result.coins >= 2);
});

test('aktivitas jendela hanya di ruangan dalam; masak memberi barang hadiah', async () => {
  const { c, state } = await rich();
  const win = await c.post('/api/activity', { activityId: 'lihat-jendela', roomId: state.rooms[0].id, spot: 'jendela' });
  assert.equal(win.status, 200, JSON.stringify(win.body));
  const yard = await c.post('/api/shop/buy', { itemId: 'halaman', currency: 'coin' });
  const no = await c.post('/api/activity', { activityId: 'lihat-lukisan', roomId: yard.body.roomId, spot: 'lukisan' });
  assert.equal(no.status, 400);
  assert.equal(no.body.error.code, 'invalid_target');
  await c.post('/api/shop/buy', { itemId: 'kompor-dapur', currency: 'coin' });
  const yardRoom = yard.body.rooms.find((x: any) => x.id === yard.body.roomId);
  const put = await c.post('/api/room', { roomId: yardRoom.id, version: yardRoom.version, layout: [{ i: 'kompor-dapur', x: 1, y: 1 }] });
  assert.equal(put.status, 200);
  const cook = await c.post('/api/activity', { activityId: 'masak-roti', roomId: yardRoom.id, index: 0 });
  assert.equal(cook.status, 200, JSON.stringify(cook.body));
  assert.equal(cook.body.result.item, 'roti');
  assert.equal(cook.body.inventory.roti, 1);
});

test('kunjungan teman menampilkan semua ruangan', async () => {
  const a = await rich();
  const b = await rich();
  await a.c.post('/api/shop/buy', { itemId: 'dapur', currency: 'coin' });
  const add = await b.c.post('/api/friends', { code: a.state.user.friend_code });
  assert.equal(add.status, 200, JSON.stringify(add.body));
  const v = await b.c.get(`/api/visit/${a.id}`);
  assert.equal(v.status, 200);
  assert.deepEqual(v.body.rooms.map((r: any) => r.name), ['Kamar', 'Dapur']);
  assert.equal(v.body.rooms[1].size, 5);
  assert.equal(v.body.rooms[0].version, undefined);
});

test('admin bisa menambah aktivitas baru dan langsung dipakai pemain', async () => {
  const adm = client();
  const login = await adm.post('/api/admin/login', { email: 'owner@test.local', password: 'rahasia-sekali-123' });
  assert.equal(login.status, 200);
  const bad = await adm.post('/api/admin/activities', { id: 'goyang', name: 'Goyang', targets: ['spot:atap'], anim: 'main', effects: {} });
  assert.equal(bad.status, 400);
  const mk = await adm.post('/api/admin/activities', {
    id: 'peluk-lampu', name: 'Nyalakan lampu', targets: ['art:lampu'], anim: 'lihat', effects: { ceria: 3 }, xp: 1, cooldown_sec: 60, message: '{pet} menyalakan {item}.',
  });
  assert.equal(mk.status, 200, JSON.stringify(mk.body));
  const list = await adm.get('/api/admin/activities');
  assert.ok(list.body.activities.some((x: any) => x.id === 'peluk-lampu'));
  assert.ok(list.body.anims.tidur);
  const { c, state } = await rich();
  await c.post('/api/shop/buy', { itemId: 'lampu-anyaman', currency: 'coin' });
  const room = state.rooms[0];
  const lay = [...room.layout, { i: 'lampu-anyaman', x: 0, y: 0 }];
  const put = await c.post('/api/room', { roomId: room.id, version: room.version, layout: lay });
  assert.equal(put.status, 200, JSON.stringify(put.body));
  const r = await c.post('/api/activity', { activityId: 'peluk-lampu', roomId: room.id, index: lay.length - 1 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.result.message, 'Gembul menyalakan Lampu Anyaman.');
});

test('perluas ruangan: lantai bertambah bertahap, mebel tetap, harga bertingkat, batas barang ikut membesar', async () => {
  const { c } = await rich(0);
  let me = (await c.get('/api/me')).body;
  const room = me.rooms[0];
  assert.equal(room.size, 6);
  assert.deepEqual(room.expand, { size: 8, coins: 1500 });
  assert.equal((await c.post('/api/room/expand', { roomId: room.id })).body.error?.code, 'insufficient_funds', 'koin belum cukup');
  await db.query(`update wallets set coin = 30000 where user_id = (select user_id from rooms where id = $1)`, [room.id]);
  const before = room.layout;
  const r1 = await c.post('/api/room/expand', { roomId: room.id });
  assert.equal(r1.status, 200, JSON.stringify(r1.body));
  assert.equal(r1.body.size, 8);
  assert.equal(r1.body.wallet.coin, 30000 - 1500);
  const after = r1.body.rooms.find((x: any) => x.id === room.id);
  assert.equal(after.size, 8);
  assert.deepEqual(after.layout, before, 'mebel yang ada tidak bergeser');
  assert.deepEqual(after.expand, { size: 10, coins: 3500 }, 'perluasan berikutnya lebih mahal');
  assert.ok(after.maxItems > room.maxItems, 'batas barang ikut membesar');
  // petak baru di sisi depan bisa dipakai
  await db.query(`insert into inventory (user_id, item_id, qty) values ((select user_id from rooms where id = $1), 'meja-bambu', 1) on conflict (user_id, item_id) do update set qty = inventory.qty + 1`, [room.id]);
  const save = await c.post('/api/room', { roomId: room.id, version: after.version, layout: [...after.layout, { i: 'meja-bambu', x: 7, y: 7 }] });
  assert.equal(save.status, 200, JSON.stringify(save.body));
  await c.post('/api/room/expand', { roomId: room.id });
  const r3 = await c.post('/api/room/expand', { roomId: room.id });
  assert.equal(r3.body.size, 12);
  assert.equal(r3.body.rooms.find((x: any) => x.id === room.id).expand, null, 'sudah paling luas');
  assert.equal((await c.post('/api/room/expand', { roomId: room.id })).body.error?.code, 'max_size');
  me = (await c.get('/api/me')).body;
  assert.equal(me.wallet.coin, 30000 - 1500 - 3500 - 7000);
});

test('atur denah: letak ruangan disimpan, ditolak bila bertumpuk/terpisah, kembali otomatis saat perluasan menabrak', async () => {
  const { c } = await rich(30000);
  for (const id of ['ruang-tamu', 'halaman']) assert.equal((await c.post('/api/shop/buy', { itemId: id })).status, 200);
  let me = (await c.get('/api/me')).body;
  const [k, rt, hal] = me.rooms;
  assert.equal(k.gx, null, 'awalnya disusun otomatis');
  // kamar 6×6 di (0,0), ruang tamu 6×6 di depan-kiri kamar, halaman 7×7 di kanan kamar
  const ok = await c.post('/api/room/plan', { rooms: [{ id: k.id, gx: 10, gy: 10 }, { id: rt.id, gx: 10, gy: 16 }, { id: hal.id, gx: 16, gy: 10 }] });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  const saved = Object.fromEntries(ok.body.rooms.map((r: any) => [r.id, [r.gx, r.gy]]));
  assert.deepEqual(saved, { [k.id]: [0, 0], [rt.id]: [0, 6], [hal.id]: [6, 0] }, 'disimpan relatif ke pojok belakang');
  // bertumpuk, terpisah, tidak lengkap, ruangan orang lain
  assert.equal((await c.post('/api/room/plan', { rooms: [{ id: k.id, gx: 0, gy: 0 }, { id: rt.id, gx: 3, gy: 3 }, { id: hal.id, gx: 6, gy: 0 }] })).body.error?.code, 'plan_overlap');
  assert.equal((await c.post('/api/room/plan', { rooms: [{ id: k.id, gx: 0, gy: 0 }, { id: rt.id, gx: 0, gy: 6 }, { id: hal.id, gx: 9, gy: 0 }] })).body.error?.code, 'plan_apart');
  assert.equal((await c.post('/api/room/plan', { rooms: [{ id: k.id, gx: 0, gy: 0 }] })).body.error?.code, 'invalid');
  const other = await rich();
  const theirs = other.state.rooms[0].id;
  assert.equal((await c.post('/api/room/plan', { rooms: [{ id: k.id, gx: 0, gy: 0 }, { id: rt.id, gx: 0, gy: 6 }, { id: theirs, gx: 6, gy: 0 }] })).body.error?.code, 'invalid');
  assert.equal((await c.post('/api/room/plan', { rooms: [{ id: k.id, gx: 0.5, gy: 0 }, { id: rt.id, gx: 0, gy: 6 }, { id: hal.id, gx: 6, gy: 0 }] })).body.error?.code, 'invalid');
  // ruangan baru tanpa letak tetap ikut tampil (disusun otomatis di client); denah lama tetap tersimpan
  assert.equal((await c.post('/api/shop/buy', { itemId: 'dapur' })).status, 200);
  me = (await c.get('/api/me')).body;
  assert.equal(me.rooms.find((r: any) => r.item === 'dapur').gx, null);
  assert.equal(me.rooms.find((r: any) => r.id === hal.id).gx, 6);
  // perluas halaman (ke depan-kanan, tidak menabrak) → denah tetap
  const e1 = await c.post('/api/room/expand', { roomId: hal.id });
  assert.equal(e1.status, 200, JSON.stringify(e1.body));
  assert.equal(e1.body.planReset, false);
  // perluas kamar sampai menabrak halaman di kanannya → denah kembali otomatis
  const e2 = await c.post('/api/room/expand', { roomId: k.id });
  assert.equal(e2.status, 200, JSON.stringify(e2.body));
  assert.equal(e2.body.planReset, true);
  assert.ok(e2.body.rooms.every((r: any) => r.gx === null && r.gy === null));
  // denah sah disimpan lagi, lalu kembali otomatis atas permintaan
  const sizes = Object.fromEntries(e2.body.rooms.map((r: any) => [r.id, r.size]));
  let x = 0;
  const row = e2.body.rooms.map((r: any) => { const p = { id: r.id, gx: x, gy: 0 }; x += sizes[r.id]; return p; });
  const again = await c.post('/api/room/plan', { rooms: row });
  assert.equal(again.status, 200, JSON.stringify(again.body));
  assert.ok(again.body.rooms.every((r: any) => r.gx !== null), 'denah berderet tersimpan');
  assert.equal((await c.post('/api/room/plan', { rooms: row.map((r: any, i: number) => (i ? r : { ...r, id: row[1].id })) })).body.error?.code, 'invalid', 'id ganda ditolak');
  assert.equal((await c.post('/api/room/plan', { rooms: row.map((r: any) => ({ ...r, gx: r.gx + 5000 })) })).body.error?.code, 'invalid', 'koordinat terlalu jauh ditolak');
  const auto = await c.post('/api/room/plan', { auto: true });
  assert.equal(auto.status, 200);
  assert.ok(auto.body.rooms.every((r: any) => r.gx === null));
});
