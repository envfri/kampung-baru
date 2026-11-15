// Putar perabot (2 arah): ukuran petak ditukar & gambar dicerminkan; geser ≤ 1 petak bila tidak muat;
// server menyimpan r = 1, menolak r tidak valid / tabrakan karena putar; perabot "tidak bisa diputar" dari admin.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config';
import { canBack, canRotate, fits, footprint, houseDraws, houseLayout, occupied, renderRoom, rotatePlaced, rotOf, rotSteps, shade } from '@kb/shared';

config.paymentProvider = 'mock';
config.adminEmail = 'owner@test.local';
config.adminPassword = 'rahasia-sekali-123';
const { buildApp } = await import('../src/app');
const { invalidateCaches } = await import('../src/lib/core');
let app: any;
let db: any;
before(async () => { ({ app, db } = await buildApp({ memoryDb: true, logger: false, rateLimit: false, worker: false })); });
after(async () => { await app?.close(); });

const SOFA: any = { id: 'sofa', kind: 'furniture', name: 'Sofa', art: { type: 'builtin', key: 'sofa' }, data: { w: 2, d: 1 } };
const KURSI: any = { id: 'kursi', kind: 'furniture', name: 'Kursi', art: { type: 'builtin', key: 'kursi' }, data: { w: 1, d: 1 } };
const POSTER: any = { id: 'poster', kind: 'furniture', name: 'Poster', art: { type: 'builtin', key: 'kotak' }, data: { w: 2, d: 1, noRotate: true } };
const KOLAM: any = { id: 'kolam', kind: 'furniture', name: 'Kolam', art: { type: 'builtin', key: 'kotak' }, data: { w: 2, d: 2, mask: [[0, 0]] } };
const FOTO: any = { id: 'foto', kind: 'furniture', name: 'Foto', art: { type: 'image', url: 'https://contoh.test/a.png' }, data: { w: 2, d: 1 } };
const RAK: any = { id: 'rak', kind: 'furniture', name: 'Rak', art: { type: 'builtin', key: 'rak' }, data: { w: 1, d: 2, noBack: true } };
const TV: any = { id: 'tv', kind: 'furniture', name: 'TV', art: { type: 'builtin', key: 'tv' }, data: { w: 1, d: 1 } };
const KASUR: any = { id: 'kasur', kind: 'furniture', name: 'Kasur', art: { type: 'builtin', key: 'kasur' }, data: { w: 2, d: 1 } };
const ITEMS: Record<string, any> = { sofa: SOFA, kursi: KURSI, poster: POSTER, kolam: KOLAM, foto: FOTO, rak: RAK, tv: TV, kasur: KASUR };

/* ---------------- fungsi murni ---------------- */

test('putar: ukuran petak ditukar; tidak bisa diputar bila admin mematikan atau benda bermasker', () => {
  assert.deepEqual(footprint(SOFA), { w: 2, d: 1, flat: false });
  assert.deepEqual(footprint(SOFA, 1), { w: 1, d: 2, flat: false });
  assert.deepEqual(footprint(SOFA, 0), { w: 2, d: 1, flat: false });
  assert.equal(canRotate(SOFA), true);
  assert.equal(canRotate(POSTER), false);
  assert.equal(canRotate(KOLAM), false);
  assert.deepEqual(footprint(POSTER, 1), { w: 2, d: 1, flat: false }, 'r diabaikan bila tidak bisa diputar');
  assert.equal(rotOf(SOFA, 1), 1);
  assert.equal(rotOf(POSTER, 1), 0);
  // 4 arah: gambar bawaan; gambar unggahan & "tanpa tampak belakang" 2 arah; tidak bisa diputar 1 arah
  assert.deepEqual([rotSteps(SOFA), rotSteps(FOTO), rotSteps(RAK), rotSteps(POSTER), rotSteps(KOLAM)], [4, 2, 2, 1, 1]);
  assert.equal(canBack(SOFA), true);
  assert.equal(canBack(FOTO), false);
  assert.deepEqual([0, 1, 2, 3, 4, -1, 1.5].map((r) => rotOf(SOFA, r)), [0, 1, 2, 3, 0, 0, 0]);
  assert.deepEqual([0, 1, 2, 3].map((r) => rotOf(FOTO, r)), [0, 1, 0, 0]);
  // ukuran petak: arah 1 & 3 ditukar, arah 2 sama dengan awal
  assert.deepEqual([0, 1, 2, 3].map((r) => { const f = footprint(SOFA, r); return `${f.w}x${f.d}`; }), ['2x1', '1x2', '2x1', '1x2']);
});

test('putar: petak terpakai & cek muat memakai ukuran yang ditukar', () => {
  assert.deepEqual([...occupied([{ i: 'sofa', x: 0, y: 0 }], ITEMS)].sort(), ['0,0', '1,0']);
  assert.deepEqual([...occupied([{ i: 'sofa', x: 0, y: 0, r: 1 }], ITEMS)].sort(), ['0,0', '0,1']);
  // 6×6: diputar di baris terakhir keluar ruangan
  assert.equal(fits(SOFA, 0, 5, [], ITEMS, 6), true);
  assert.equal(fits(SOFA, 0, 5, [], ITEMS, 6, -1, 1), false);
  assert.equal(fits(SOFA, 5, 0, [], ITEMS, 6), false);
  assert.equal(fits(SOFA, 5, 0, [], ITEMS, 6, -1, 1), true);
  // kursi di (0,1): sofa diputar di (0,0) menabrak, arah awal tidak
  const lay = [{ i: 'kursi', x: 0, y: 1 }];
  assert.equal(fits(SOFA, 0, 0, lay, ITEMS, 6), true);
  assert.equal(fits(SOFA, 0, 0, lay, ITEMS, 6, -1, 1), false);
});

test('putar: tetap di tempat bila muat, geser ≤ 1 petak bila tidak, null bila tidak ada tempat; putar lagi = arah awal', () => {
  const lay: any[] = [{ i: 'sofa', x: 2, y: 2 }];
  const a = rotatePlaced(lay, 0, ITEMS, 6)!;
  assert.deepEqual(a, { i: 'sofa', x: 2, y: 2, r: 1 });
  const a2 = rotatePlaced([a], 0, ITEMS, 6)!, a3 = rotatePlaced([a2], 0, ITEMS, 6)!;
  assert.deepEqual([a2.r, a3.r], [2, 3], 'seperempat putaran tiap ketukan');
  const b = rotatePlaced([a3], 0, ITEMS, 6)!;
  assert.deepEqual(b, { i: 'sofa', x: 2, y: 2 }, '4 ketukan: kembali ke arah awal tanpa r');
  // 2 arah (gambar unggahan): awal <-> 1
  const f1 = rotatePlaced([{ i: 'foto', x: 0, y: 0 }], 0, ITEMS, 6)!;
  assert.equal(f1.r, 1);
  assert.equal(rotatePlaced([f1], 0, ITEMS, 6)!.r, undefined);
  // di baris terakhir: diputar butuh 2 baris → geser 1 petak ke atas
  const c = rotatePlaced([{ i: 'sofa', x: 0, y: 5 }], 0, ITEMS, 6)!;
  assert.deepEqual([c.x, c.y, c.r], [0, 4, 1]);
  // terkepung kursi: tidak ada tempat dalam 1 petak
  const boxed: any[] = [{ i: 'sofa', x: 0, y: 4 }, { i: 'kursi', x: 0, y: 5 }, { i: 'kursi', x: 1, y: 5 }, { i: 'kursi', x: 1, y: 3 }, { i: 'kursi', x: 0, y: 3 }, { i: 'kursi', x: 2, y: 3 }, { i: 'kursi', x: 2, y: 5 }, { i: 'kursi', x: 2, y: 4 }];
  assert.equal(rotatePlaced(boxed, 0, ITEMS, 6), null);
  assert.equal(rotatePlaced([{ i: 'poster', x: 0, y: 0 }], 0, ITEMS, 6), null, 'tidak bisa diputar');
});

test('putar: gambar dicerminkan terhadap titik iso (0,0) ruangan, juga di rumah tersambung', () => {
  const normal = renderRoom({ size: 6, layout: [{ i: 'sofa', x: 1, y: 1 }], items: ITEMS } as any);
  const rot = renderRoom({ size: 6, layout: [{ i: 'sofa', x: 1, y: 1, r: 1 }], items: ITEMS } as any);
  assert.ok(!normal.includes('class="rot"'));
  assert.match(rot, /<g class="rot" transform="translate\(800 0\) scale\(-1 1\)">/);
  // tampak belakang (arah 2) & belakang dicerminkan (arah 3)
  const back = renderRoom({ size: 6, layout: [{ i: 'sofa', x: 1, y: 1, r: 2 }], items: ITEMS } as any);
  const back3 = renderRoom({ size: 6, layout: [{ i: 'sofa', x: 1, y: 1, r: 3 }], items: ITEMS } as any);
  assert.ok(back.includes('class="back"') && !back.includes('class="rot"'));
  assert.ok(back3.includes('class="back"') && back3.includes('class="rot"'));
  // layar TV (panel depan) tidak terlihat dari belakang
  const tv0 = renderRoom({ size: 3, layout: [{ i: 'tv', x: 0, y: 0 }], items: ITEMS } as any);
  const tv2 = renderRoom({ size: 3, layout: [{ i: 'tv', x: 0, y: 0, r: 2 }], items: ITEMS } as any);
  assert.ok(tv0.includes('#7FC4E8') && !tv2.includes('#7FC4E8'), 'layar TV hilang dari belakang');
  // urutan balok dari belakang: selimut kasur digambar setelah kasurnya (tidak tertutup)
  const bed = renderRoom({ size: 3, layout: [{ i: 'kasur', x: 0, y: 0, r: 2 }], items: ITEMS } as any);
  const gb = bed.slice(bed.indexOf('class="back"'));
  // warna atas balok = shade(warna, 0.14): kasur #F4EEE2, selimut #5E8FC7
  const top = (hex: string) => shade(hex, 0.14);
  assert.ok(gb.indexOf(top('#F4EEE2')) >= 0 && gb.indexOf(top('#5E8FC7')) > gb.indexOf(top('#F4EEE2')), 'selimut di atas kasur');
  const plan = houseLayout([{ id: 'a', size: 6 }, { id: 'b', size: 6 }] as any);
  const art: any = Object.fromEntries(plan.rooms.map((r: any) => [r.id, { layout: r.id === 'b' ? [{ i: 'sofa', x: 1, y: 1, r: 1 }] : [{ i: 'sofa', x: 1, y: 1 }] }]));
  const draws = houseDraws(plan, art, ITEMS);
  const fb = draws.find((d: any) => d.key === 'f:b:0')!, fa = draws.find((d: any) => d.key === 'f:a:0')!;
  assert.ok(fb.h.includes('class="rot"') && !fa.h.includes('class="rot"'));
  // kotak petak (untuk tembus pandang) ikut ditukar
  const rb = plan.rooms.find((r: any) => r.id === 'b')!;
  assert.deepEqual((fb as any).b, [rb.gx + 1, rb.gy + 1, rb.gx + 2, rb.gy + 3]);
});

/* ---------------- server ---------------- */

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
    return { status: res.statusCode, body: res.body ? (() => { try { return JSON.parse(res.body); } catch { return res.body; } })() : null };
  };
  return { get: (u: string) => call('GET', u), post: (u: string, b?: unknown) => call('POST', u, b ?? {}), put: (u: string, b?: unknown) => call('PUT', u, b ?? {}) };
}

test('server: arah putar disimpan (r: 1), r tidak valid & tabrakan karena putar ditolak, teman melihat arah yang sama', async () => {
  const c = client();
  await c.post('/api/auth/guest');
  const pet = await c.post('/api/pet', { name: 'Lupis', color: '#F6B7A8', ear: 'tunas' });
  assert.equal(pet.status, 200);
  const me = (await c.get('/api/me')).body;
  const room = (me.rooms ?? [me.room])[0];
  const kasur = room.layout.find((p: any) => p.i === 'kasur-rotan');
  assert.ok(kasur, 'kasur awal ada');
  const others = room.layout.filter((p: any) => p.i !== 'kasur-rotan');
  const save = (layout: any[], version: number) => c.post('/api/room', { roomId: room.id || undefined, version, layout });
  // kasur 2×1 diputar jadi 1×2 di pojok kiri (0,0): petak (0,0) & (0,1)
  let r = await save([{ i: 'kasur-rotan', x: 0, y: 0, r: 1 }, ...others], room.version);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  let now = (await c.get('/api/me')).body;
  let lay = (now.rooms ?? [now.room])[0];
  assert.deepEqual(lay.layout.find((p: any) => p.i === 'kasur-rotan'), { i: 'kasur-rotan', x: 0, y: 0, r: 1 });
  // r tidak valid
  r = await save([{ i: 'kasur-rotan', x: 0, y: 0, r: 4 }, ...others], lay.version);
  assert.equal(r.status, 400);
  r = await save([{ i: 'kasur-rotan', x: 0, y: 0, r: 'dua' }, ...others], lay.version);
  assert.equal(r.status, 400);
  // diputar di baris terakhir: keluar ruangan
  const size = lay.size ?? 6;
  r = await save([{ i: 'kasur-rotan', x: 0, y: size - 1, r: 1 }, ...others.filter((p: any) => !(p.x === 0 && p.y >= size - 2))], lay.version);
  assert.equal(r.status, 400);
  assert.match(JSON.stringify(r.body), /bertumpuk atau keluar/);
  // membelakangi kamera (arah 2): ukuran petak sama dengan awal
  r = await save([{ i: 'kasur-rotan', x: 4, y: 0, r: 2 }, ...others], lay.version);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  now = (await c.get('/api/me')).body; lay = (now.rooms ?? [now.room])[0];
  assert.deepEqual(lay.layout.find((p: any) => p.i === 'kasur-rotan'), { i: 'kasur-rotan', x: 4, y: 0, r: 2 });
  // "tanpa tampak belakang": arah 2 kembali ke awal saat disimpan
  await db.query(`update items set data = data || '{"noBack": true}'::jsonb where id = 'kasur-rotan'`);
  invalidateCaches();
  r = await save([{ i: 'kasur-rotan', x: 4, y: 0, r: 2 }, ...others], lay.version);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  now = (await c.get('/api/me')).body; lay = (now.rooms ?? [now.room])[0];
  assert.deepEqual(lay.layout.find((p: any) => p.i === 'kasur-rotan'), { i: 'kasur-rotan', x: 4, y: 0 });
  await db.query(`update items set data = data - 'noBack' where id = 'kasur-rotan'`);
  invalidateCaches();
  // r: 0 tidak disimpan
  r = await save([{ i: 'kasur-rotan', x: 4, y: 0, r: 0 }, ...others], lay.version);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  now = (await c.get('/api/me')).body; lay = (now.rooms ?? [now.room])[0];
  assert.deepEqual(lay.layout.find((p: any) => p.i === 'kasur-rotan'), { i: 'kasur-rotan', x: 4, y: 0 });
  // diputar lagi, lalu teman berkunjung
  r = await save([{ i: 'kasur-rotan', x: 0, y: 0, r: 1 }, ...others], lay.version);
  assert.equal(r.status, 200);
  const f = client();
  await f.post('/api/auth/guest');
  await f.post('/api/pet', { name: 'Wajik', color: '#F6B7A8', ear: 'tunas' });
  await f.post('/api/friends', { code: me.user.friend_code });
  const v = await f.get(`/api/visit/${me.user.id}`);
  assert.equal(v.status, 200, JSON.stringify(v.body).slice(0, 200));
  const vr = (v.body.rooms ?? [v.body.room]).flatMap((x: any) => x?.layout ?? []);
  assert.ok(vr.some((p: any) => p.i === 'kasur-rotan' && p.r === 1), 'tamu melihat kasur diputar');
  // admin mematikan putar untuk kasur: r diabaikan saat disimpan
  await db.query(`update items set data = data || '{"noRotate": true}'::jsonb where id = 'kasur-rotan'`);
  invalidateCaches();
  now = (await c.get('/api/me')).body; lay = (now.rooms ?? [now.room])[0];
  r = await save([{ i: 'kasur-rotan', x: 4, y: 0, r: 1 }, ...others], lay.version);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  now = (await c.get('/api/me')).body; lay = (now.rooms ?? [now.room])[0];
  assert.deepEqual(lay.layout.find((p: any) => p.i === 'kasur-rotan'), { i: 'kasur-rotan', x: 4, y: 0 });
  await db.query(`update items set data = data - 'noRotate' where id = 'kasur-rotan'`);
  invalidateCaches();
});

test('admin: centang "Tidak bisa diputar" tersimpan di data barang (dan bisa dilepas lagi)', async () => {
  const adm = client();
  assert.equal((await adm.post('/api/admin/login', { email: 'owner@test.local', password: 'rahasia-sekali-123' })).status, 200);
  const list = (await adm.get('/api/admin/items')).body;
  const it = (list.items ?? list).find((x: any) => x.id === 'sofa-santai');
  assert.ok(it, 'sofa ada di katalog admin');
  const put = (data: any) => adm.put(`/api/admin/items/${it.id}`, { ...it, data });
  let r = await put({ ...it.data, noRotate: true });
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  let row = await db.one(`select data from items where id = 'sofa-santai'`);
  assert.equal(row.data.noRotate, true);
  r = await put({ ...it.data, noRotate: false });
  assert.equal(r.status, 200);
  row = await db.one(`select data from items where id = 'sofa-santai'`);
  assert.equal(row.data.noRotate, undefined);
});
