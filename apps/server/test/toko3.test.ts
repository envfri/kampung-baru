// Paket konten 18: barang baru di tiga toko koin (Pasar Pagi, Mebel Jati, Toko Bangunan) — item di toko yang benar
// dengan harga koin yang wajar, paket hanya sekali & tidak menimpa ubahan admin, gambar sah di 4 arah (tampak
// belakang tanpa hiasan sisi depan), ikon makanan, dinding & lantai baru, aktivitas baru, beli-pasang-pakai.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config';
import { ACTIVITY_ANIMS, TOKO3_ART, builtinCatalog, footprint, itemIcon, renderRoom, rotSteps, houseDraws, houseLayout } from '@kb/shared';

config.paymentProvider = 'mock';
config.adminEmail = 'owner@test.local';
config.adminPassword = 'rahasia-sekali-123';
const { buildApp } = await import('../src/app');
const { SEED_ITEMS_V18, SEED_ACTIVITIES_V18, seedPackV18 } = await import('../src/db/seed-toko3');
const { invalidateCaches } = await import('../src/lib/core');
let app: any;
let db: any;
before(async () => { ({ app, db } = await buildApp({ memoryDb: true, logger: false, rateLimit: false, worker: false })); });
after(async () => { await app?.close(); });

const ITEMS: Record<string, any> = Object.fromEntries(SEED_ITEMS_V18.map((i) => [i.id, i]));
const FURN = SEED_ITEMS_V18.filter((i) => i.kind === 'furniture');

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
  return { get: (u: string) => call('GET', u), post: (u: string, b?: unknown) => call('POST', u, b ?? {}) };
}

/** semua tag SVG tertutup rapi dan tidak ada nilai rusak */
function wellFormed(svg: string) {
  const stack: string[] = [];
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g)) {
    const [, close, name, , self] = m;
    if (self) continue;
    if (close) { if (stack.pop() !== name) return false; } else stack.push(name);
  }
  return stack.length === 0 && !/undefined|NaN|Infinity|\[object/.test(svg);
}
/** gambar satu mebel di ruang 3×3 (halaman untuk barang Toko Bangunan), arah r */
const draw = (id: string, r: number, size = 3) => {
  const f = footprint(ITEMS[id], r);
  return renderRoom({ size, layout: [{ i: id, x: Math.floor((size - f.w) / 2), y: Math.floor((size - f.d) / 2), r }], items: ITEMS, theme: ITEMS[id].shop === 'bangunan' ? 'luar' : undefined } as any);
};
/** bagian gambar mebelnya saja (tanpa dinding & lantai) */
const furnOnly = (svg: string) => svg.slice(svg.indexOf('class="furn'));

test('paket 18: barang baru masuk ke toko yang benar dengan harga koin sekelas barang lama', async () => {
  const by = (shop: string, kind?: string) => SEED_ITEMS_V18.filter((i) => i.shop === shop && (!kind || i.kind === kind));
  assert.equal(by('pasar', 'food').length, 8);
  assert.equal(by('mebel', 'furniture').length, 8);
  assert.equal(by('mebel', 'wallpaper').length, 2);
  assert.equal(by('mebel', 'floor').length, 1);
  assert.equal(by('bangunan', 'furniture').length, 9);
  assert.equal(by('bangunan', 'floor').length, 2);
  assert.equal(new Set(SEED_ITEMS_V18.map((i) => i.id)).size, SEED_ITEMS_V18.length, 'id unik');
  const rows = await db.query(`select id, kind, shop, price_coin, price_pearl, sell_coin, data, art from items where id = any($1::text[])`, [SEED_ITEMS_V18.map((i) => i.id)]);
  assert.equal(rows.length, SEED_ITEMS_V18.length, 'semua item ada di katalog');
  for (const r of rows) {
    const it = ITEMS[r.id];
    assert.equal(r.shop, it.shop, `${r.id}: toko ${r.shop}`);
    assert.equal(Number(r.price_pearl), 0, `${r.id}: dibeli dengan koin`);
    const p = Number(r.price_coin);
    if (r.kind === 'food') assert.ok(p >= 5 && p <= 25, `${r.id}: harga makanan ${p}`);
    else if (r.kind === 'furniture') assert.ok(p >= 15 && p <= 240, `${r.id}: harga mebel ${p}`);
    else assert.ok(p >= 60 && p <= 120, `${r.id}: harga dinding/lantai ${p}`);
    if (r.kind === 'food' || r.kind === 'furniture') assert.ok(r.sell_coin > 0 && r.sell_coin < p / 2 + 1, `${r.id}: harga jual ${r.sell_coin} < setengah harga`);
    if (r.kind === 'furniture') {
      assert.ok(r.data.w >= 1 && r.data.w <= 2 && r.data.d >= 1 && r.data.d <= 2, `${r.id}: ukuran ${r.data.w}×${r.data.d}`);
      assert.ok(!r.data.set, `${r.id}: bukan item set premium`);
    }
  }
  // makanan: efek seimbang dengan makanan lama (± 2 poin kebutuhan per koin), tidak ada yang menyembuhkan
  for (const f of by('pasar')) {
    const eff = f.data.effects as Record<string, number>;
    const sum = Object.values(eff).reduce((a, v) => a + v, 0);
    assert.ok(Object.keys(eff).length >= 1 && Object.keys(eff).every((k) => ['kenyang', 'ceria', 'energi', 'bersih'].includes(k)), `${f.id}: efek ${JSON.stringify(eff)}`);
    assert.ok(sum / f.price_coin >= 1.8 && sum / f.price_coin <= 2.3, `${f.id}: ${sum} poin untuk ${f.price_coin} koin`);
    assert.ok(!f.data.cure);
  }
  // batu pijakan datar (bisa dilewati), lainnya menghalangi
  assert.equal(ITEMS['batu-pijakan'].data.flat, true);
  assert.equal(FURN.filter((i) => i.data.flat).length, 1);
  // katalog pemain memuat semuanya, dan "Baru" tidak memecah apa pun
  const cat = JSON.parse((await app.inject({ method: 'GET', url: '/api/catalog' })).body);
  for (const id of Object.keys(ITEMS)) assert.ok(cat.items.some((i: any) => i.id === id && i.shop === ITEMS[id].shop), `${id} di /api/catalog`);
});

test('paket 18: aktivitas baru memakai animasi yang ada dan menunjuk mebel baru', async () => {
  const acts = await db.query(`select id, targets, anim, effects, cooldown_sec from activities where id = any($1::text[])`, [SEED_ACTIVITIES_V18.map((a) => a.id)]);
  assert.equal(acts.length, SEED_ACTIVITIES_V18.length);
  const keys = new Set(FURN.map((i) => 'art:' + i.art.key));
  for (const a of acts) {
    assert.ok(ACTIVITY_ANIMS[a.anim], `${a.id}: animasi ${a.anim} ada`);
    assert.ok(a.targets.length && a.targets.every((t: string) => keys.has(t)), `${a.id}: target ${a.targets} = mebel baru`);
    assert.ok(a.cooldown_sec >= 300, `${a.id}: jeda ${a.cooldown_sec}`);
    for (const v of Object.values(a.effects as Record<string, number>)) assert.ok(Math.abs(v) <= 15, `${a.id}: efek wajar`);
  }
  const anim = Object.fromEntries(acts.map((a: any) => [a.targets[0], a.anim]));
  assert.equal(anim['art:kursigoyang'], 'duduk');
  assert.equal(anim['art:saung'], 'duduk');
  assert.equal(anim['art:dipan'], 'tidur');
  assert.equal(anim['art:mejabelajar'], 'baca');
  assert.equal(anim['art:radiotua'], 'musik');
  assert.equal(anim['art:potkembang'], 'siram');
  // hanya pagar, lampu taman & batu pijakan yang tanpa aktivitas (hiasan)
  const without = FURN.filter((i) => !acts.some((a: any) => a.targets.includes('art:' + i.art.key))).map((i) => i.id).sort();
  assert.deepEqual(without, ['batu-pijakan', 'lampu-taman', 'pagar-bambu']);
  // id aktivitas tidak bertabrakan dengan aktivitas lama
  const all = await db.query(`select id from activities`);
  assert.equal(new Set(all.map((a: any) => a.id)).size, all.length);
});

test('paket 18: hanya sekali, dan tidak menimpa ubahan admin bila dijalankan ulang', async () => {
  assert.equal(await seedPackV18(db), false, 'sudah dijalankan saat server mulai');
  assert.ok(Number((await db.one(`select value from settings where key = 'content_pack'`)).value) >= 18);
  await db.query(`update items set price_coin = 999, name = 'Saung Admin' where id = 'saung-bambu'`);
  await db.query(`update items set data = '{"effects":{"kenyang":1}}'::jsonb where id = 'gado-gado'`);
  await db.query(`update activities set xp = 9 where id = 'ngaso-saung'`);
  await db.query(`delete from items where id = 'pagar-bambu'`);
  await db.query(`delete from settings where key = 'pack_toko3'`);
  const ver = Number((await db.one(`select value from settings where key = 'catalog_version'`))?.value ?? 0);
  assert.equal(await seedPackV18(db), true);
  const it = await db.one(`select price_coin, name from items where id = 'saung-bambu'`);
  assert.deepEqual([it.price_coin, it.name], [999, 'Saung Admin']);
  assert.deepEqual((await db.one(`select data from items where id = 'gado-gado'`)).data, { effects: { kenyang: 1 } });
  assert.equal((await db.one(`select xp from activities where id = 'ngaso-saung'`)).xp, 9);
  assert.ok(await db.one(`select 1 from items where id = 'pagar-bambu'`), 'item yang hilang ditambahkan lagi');
  assert.ok(Number((await db.one(`select value from settings where key = 'catalog_version'`)).value) > ver, 'versi katalog naik');
  assert.equal(await seedPackV18(db), false);
  // angka content_pack tidak turun bila paket yang lebih baru sudah jalan
  await db.query(`update settings set value = '19'::jsonb where key = 'content_pack'`);
  await db.query(`delete from settings where key = 'pack_toko3'`);
  await seedPackV18(db);
  assert.equal(Number((await db.one(`select value from settings where key = 'content_pack'`)).value), 19);
  await db.query(`update items set price_coin = 240, name = 'Saung Bambu' where id = 'saung-bambu'`);
  await db.query(`update items set data = $1::text::jsonb where id = 'gado-gado'`, [JSON.stringify(ITEMS['gado-gado'].data)]);
  await db.query(`update activities set xp = 1 where id = 'ngaso-saung'`);
  invalidateCaches();
});

test('gambar: semua mebel baru sah di 4 arah (tanpa NaN), dua arah dicerminkan, dua arah tampak belakang', () => {
  assert.deepEqual([...TOKO3_ART.mebel, ...TOKO3_ART.bangunan].sort(), FURN.map((i) => i.art.key).sort(), 'tiap mebel punya gambar sendiri');
  const cat = builtinCatalog();
  for (const it of FURN) {
    assert.ok(cat.furniture.some((f) => f.key === it.art.key), `${it.art.key} terdaftar untuk admin`);
    assert.equal(rotSteps(it as any), 4, `${it.id}: bisa diputar 4 arah`);
    const out = [0, 1, 2, 3].map((r) => draw(it.id, r));
    out.forEach((svg, r) => assert.ok(wellFormed(svg), `${it.id} arah ${r}: SVG sah`));
    assert.ok(!out[0].includes('class="rot"') && out[1].includes('class="rot"') && out[3].includes('class="rot"'), `${it.id}: arah 1 & 3 dicerminkan`);
    assert.ok(out[2].includes('class="back"') && out[3].includes('class="back"') && !out[0].includes('class="back"'), `${it.id}: arah 2 & 3 tampak belakang`);
    assert.ok(furnOnly(out[0]).length > 500 && furnOnly(out[2]).length > 400, `${it.id}: gambar tidak kosong`);
    assert.ok(wellFormed(itemIcon(it as any)) && itemIcon(it as any).length > 300, `${it.id}: ikon toko sah`);
    // ruang besar, ruang kecil, mode atur, rumah tersambung
    assert.ok(wellFormed(renderRoom({ size: 8, layout: [{ i: it.id, x: 2, y: 2, r: 3 }], items: ITEMS } as any)), `${it.id}: ruang 8×8`);
    assert.ok(wellFormed(renderRoom({ size: 4, layout: [{ i: it.id, x: 0, y: 0, r: 2 }], items: ITEMS, edit: true, sel: 0 } as any)), `${it.id}: mode atur`);
  }
  // rumah tersambung (kamar + halaman): urutan gambar tetap sah
  const plan = houseLayout([{ id: 'r1', size: 6 }, { id: 'r2', size: 7, theme: 'luar' }] as any);
  const parts = houseDraws(plan, {
    r1: { layout: [{ i: 'lemari-kaca', x: 0, y: 4, r: 3 }, { i: 'jam-bandul', x: 0, y: 0, r: 2 }, { i: 'dipan-kayu', x: 3, y: 0, r: 1 }], wall: ITEMS['wp-kembang'], floor: ITEMS['fl-tegelkembang'] },
    r2: { layout: [{ i: 'saung-bambu', x: 0, y: 0, r: 2 }, { i: 'kolam-ikan', x: 3, y: 3, r: 1 }, { i: 'batu-pijakan', x: 6, y: 6 }], floor: ITEMS['fl-kerikil'] },
  } as any, ITEMS);
  assert.ok(parts.filter((p) => p.key.startsWith('f:')).length >= 5 && parts.every((p) => wellFormed(p.h)), 'rumah tersambung: gambar sah');
});

test('gambar: tampak belakang tidak menampilkan hiasan sisi depan, isi atas tetap terlihat', () => {
  const has = (id: string, r: number, s: string) => furnOnly(draw(id, r)).includes(s);
  // jam bandul: muka jam & bandul berayun hanya dari depan
  assert.ok(has('jam-bandul', 0, '#FFF8E6') && has('jam-bandul', 0, 'class="swing"'));
  assert.ok(!has('jam-bandul', 2, '#FFF8E6') && !has('jam-bandul', 3, 'class="swing"'));
  // lemari kaca: kaca & pajangan dari depan; vas bunga di atas terlihat dari dua sisi
  assert.ok(has('lemari-kaca', 0, '#D6EEF5') && !has('lemari-kaca', 2, '#D6EEF5') && !has('lemari-kaca', 3, '#D6EEF5'));
  assert.ok(has('lemari-kaca', 2, '#3F7FBF'), 'vas biru di atas lemari terlihat dari belakang');
  // cermin: kaca dari depan, papan punggung dari belakang
  assert.ok(has('cermin-berdiri', 0, '#BFE3F5') && !has('cermin-berdiri', 2, '#BFE3F5'));
  // meja belajar: tombol laci hanya dari depan; lampu tetap ada
  assert.ok(has('meja-belajar', 0, '#F2D16B') && !has('meja-belajar', 2, '#F2D16B') && has('meja-belajar', 2, '#3F8F6E'));
  // radio: kain pengeras suara dari depan, celah udara dari belakang
  assert.ok(has('radio-tua', 0, '#E9DDBF') && !has('radio-tua', 2, '#E9DDBF') && has('radio-tua', 2, 'stroke-linecap="round"'));
  // kipas angin: baling-baling berputar terlihat dari dua sisi, tombol di kaki hanya dari depan
  assert.ok(has('kipas-angin', 0, 'class="swim"') && has('kipas-angin', 2, 'class="swim"'));
  assert.ok(has('kipas-angin', 0, '#3FA06A') && !has('kipas-angin', 2, '#3FA06A'));
  // saung: atap tembus pandang (canopy) di semua arah
  for (const r of [0, 1, 2, 3]) assert.ok(has('saung-bambu', r, 'class="canopy"'), `saung arah ${r}: canopy`);
  // kurungan: induk ayam menghadap arah lain dari belakang
  assert.ok(/scale\(0\.86 \.86\)/.test(furnOnly(draw('kurungan-ayam', 0))) && /scale\(-0\.86 \.86\)/.test(furnOnly(draw('kurungan-ayam', 2))));
});

test('gambar: ikon makanan, dinding & lantai baru sah dan berbeda dari bawaan', () => {
  const plain = renderRoom({ size: 6, layout: [], items: {} } as any) + renderRoom({ size: 6, layout: [], items: {}, theme: 'luar' } as any);
  // warna khas pola tiap dinding / lantai
  const SIG: Record<string, string> = { 'wp-lambri': '#A0673C', 'wp-kembang': '#8DBF7E', 'fl-tegelkembang': '#4E8378', 'fl-kerikil': '#F4F0E6', 'fl-batamerah': '#EBDCC2' };
  for (const it of SEED_ITEMS_V18.filter((i) => i.kind !== 'furniture')) {
    const icon = itemIcon(it as any);
    assert.ok(wellFormed(icon) && icon.length > 400, `${it.id}: ikon sah`);
    if (it.kind === 'food') { assert.ok(TOKO3_ART.pasar.includes(it.art.key), `${it.id}: ikon makanan baru`); continue; }
    for (const size of [3, 6, 7]) {
      const room = renderRoom({ size, layout: [], items: {}, ...(it.kind === 'floor' ? { floor: it } : { wall: it }), theme: it.shop === 'bangunan' ? 'luar' : undefined } as any);
      assert.ok(wellFormed(room), `${it.id}: ruang ${size}×${size} sah`);
      if (size === 6) assert.ok(room.includes(SIG[it.id]) && !plain.includes(SIG[it.id]), `${it.id}: pola digambar`);
    }
    assert.ok(wellFormed(renderRoom({ size: 5, layout: [], items: {}, edit: true, ...(it.kind === 'floor' ? { floor: it } : { wall: it }) } as any)), `${it.id}: mode atur sah`);
  }
  const cat = builtinCatalog();
  for (const k of ['lambri', 'kembang']) assert.ok(cat.wallpaper.some((w) => w.key === k), `dinding ${k} terdaftar`);
  for (const k of ['tegelkembang', 'kerikil', 'batamerah']) assert.ok(cat.floor.some((w) => w.key === k), `lantai ${k} terdaftar`);
  for (const k of TOKO3_ART.pasar) assert.ok(cat.food.some((w) => w.key === k), `ikon ${k} terdaftar`);
});

test('beli makanan baru & beri makan, beli & pasang mebel baru lalu pakai, beli & pasang benda halaman', async () => {
  const c = client();
  await c.post('/api/auth/guest');
  assert.equal((await c.post('/api/pet', { name: 'Gado', color: '#F6B7A8', ear: 'kucing' })).status, 200);
  let me = (await c.get('/api/me')).body;
  await db.query(`update wallets set coin = 3000 where user_id = $1`, [me.user.id]);
  // Pasar Pagi: soto ayam, beri makan
  let r = await c.post('/api/shop/buy', { itemId: 'soto-ayam', currency: 'coin' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.wallet.coin, 3000 - 17);
  await db.query(`update pets set kenyang = 40 where user_id = $1`, [me.user.id]).catch(() => {});
  const ate = await c.post('/api/action', { type: 'makan', itemId: 'soto-ayam' });
  assert.equal(ate.status, 200, JSON.stringify(ate.body));
  me = (await c.get('/api/me')).body;
  assert.equal(me.inventory?.['soto-ayam'] ?? 0, 0, 'soto habis dimakan');
  // salah mata uang ditolak
  assert.equal((await c.post('/api/shop/buy', { itemId: 'kursi-goyang', currency: 'pearl' })).body.error.code, 'wrong_currency');
  // Mebel Jati: kursi goyang & lantai tegel; pasang di kamar (diputar membelakangi) lalu bergoyang
  for (const id of ['kursi-goyang', 'fl-tegelkembang']) assert.equal((await c.post('/api/shop/buy', { itemId: id, currency: 'coin' })).status, 200);
  me = (await c.get('/api/me')).body;
  let room = (me.rooms ?? [me.room])[0];
  const s = await c.post('/api/room', { roomId: room.id || undefined, version: room.version, floor: 'fl-tegelkembang', layout: [...room.layout, { i: 'kursi-goyang', x: 1, y: 0, r: 2 }] });
  assert.equal(s.status, 200, JSON.stringify(s.body));
  me = (await c.get('/api/me')).body;
  room = (me.rooms ?? [me.room])[0];
  assert.equal(room.floor, 'fl-tegelkembang');
  const idx = room.layout.findIndex((p: any) => p.i === 'kursi-goyang');
  assert.equal(room.layout[idx].r, 2);
  const act = await c.post('/api/activity', { activityId: 'goyang-kursi', roomId: room.id || undefined, index: idx });
  assert.equal(act.status, 200, JSON.stringify(act.body));
  assert.match(act.body.result.message, /bergoyang pelan/);
  // aktivitas mebel lain ditolak di kursi goyang
  assert.equal((await c.post('/api/activity', { activityId: 'leyeh-dipan', roomId: room.id || undefined, index: idx })).status, 400);
  // Toko Bangunan: halaman, saung, batu pijakan; ngaso di saung
  r = await c.post('/api/shop/buy', { itemId: 'halaman', currency: 'coin' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  for (const id of ['saung-bambu', 'batu-pijakan', 'batu-pijakan', 'fl-kerikil']) assert.equal((await c.post('/api/shop/buy', { itemId: id, currency: 'coin' })).status, 200);
  me = (await c.get('/api/me')).body;
  const yard = me.rooms.find((x: any) => x.item === 'halaman');
  assert.ok(yard, 'halaman dibangun');
  const ys = await c.post('/api/room', { roomId: yard.id, version: yard.version, floor: 'fl-kerikil', layout: [{ i: 'saung-bambu', x: 0, y: 0 }, { i: 'batu-pijakan', x: 3, y: 3 }, { i: 'batu-pijakan', x: 3, y: 4, r: 1 }] });
  assert.equal(ys.status, 200, JSON.stringify(ys.body));
  me = (await c.get('/api/me')).body;
  const y2 = me.rooms.find((x: any) => x.item === 'halaman');
  assert.equal(y2.floor, 'fl-kerikil');
  const sa = await c.post('/api/activity', { activityId: 'ngaso-saung', roomId: y2.id, index: 0 });
  assert.equal(sa.status, 200, JSON.stringify(sa.body));
  assert.match(sa.body.result.message, /ngaso di saung/);
  // batu pijakan datar: mebel lain boleh di atasnya? tidak perlu; tapi saung tidak boleh menabrak saung lain
  assert.equal((await c.post('/api/room', { roomId: y2.id, version: y2.version, layout: [...y2.layout, { i: 'saung-bambu', x: 1, y: 1 }] })).status, 400);
});
