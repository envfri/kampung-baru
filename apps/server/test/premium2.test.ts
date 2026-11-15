// Paket konten 17: tiga set premium baru (Dapur Nenek, Sanggar Seni, Spa Bali) — item, harga, set, aktivitas,
// paket hanya sekali & tidak menimpa ubahan admin, gambar sah di 4 arah (tampak belakang tanpa hiasan sisi depan),
// beli paket set, aktivitas baru, dan efek suasana.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config';
import { ACTIVITY_ANIMS, PREMIUM_SETS, PREMIUM_SET_BY_KEY, bundlePrice, footprint, itemIcon, premiumMoodSVG, renderRoom, roomMood, rotSteps, shade } from '@kb/shared';

config.paymentProvider = 'mock';
config.adminEmail = 'owner@test.local';
config.adminPassword = 'rahasia-sekali-123';
const { buildApp } = await import('../src/app');
const { SEED_ITEMS_V17, SEED_ACTIVITIES_V17, seedPackV17 } = await import('../src/db/seed-premium2');
const { invalidateCaches } = await import('../src/lib/core');
let app: any;
let db: any;
before(async () => { ({ app, db } = await buildApp({ memoryDb: true, logger: false, rateLimit: false, worker: false })); });
after(async () => { await app?.close(); });

const NEW_SETS = ['dapurnenek', 'sanggar', 'spabali'];
const ITEMS: Record<string, any> = Object.fromEntries(SEED_ITEMS_V17.map((i) => [i.id, i]));

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
/** gambar satu mebel di ruang 3×3, arah r */
const draw = (id: string, r: number) => {
  const f = footprint(ITEMS[id], r);
  return renderRoom({ size: 3, layout: [{ i: id, x: Math.floor((3 - f.w) / 2), y: Math.floor((3 - f.d) / 2), r }], items: ITEMS } as any);
};
/** bagian gambar mebelnya saja (tanpa dinding & lantai) */
const furnOnly = (svg: string) => svg.slice(svg.indexOf('class="furn'));

test('paket 17: 15 mebel + dinding + 2 lantai di Toko Mutiara, harga Mutiara sekelas set lama, data.set benar', async () => {
  assert.equal(SEED_ITEMS_V17.length, 18);
  for (const key of NEW_SETS) {
    const st = PREMIUM_SET_BY_KEY[key];
    assert.ok(st, `set ${key} terdaftar`);
    assert.equal(st.items.length, 6);
    assert.match(st.color, /^#[0-9A-Fa-f]{6}$/);
    const rows = await db.query(`select id, kind, shop, price_pearl, price_coin, data, art from items where id = any($1::text[])`, [st.items]);
    assert.equal(rows.length, 6, `${key}: semua item ada di katalog`);
    assert.equal(rows.filter((r: any) => r.kind === 'furniture').length, 5);
    assert.equal(rows.filter((r: any) => r.kind === 'wallpaper' || r.kind === 'floor').length, 1);
    for (const r of rows) {
      assert.equal(r.shop, 'mutiara');
      assert.equal(r.data.set, key, `${r.id} masuk set ${key}`);
      assert.equal(Number(r.price_coin), 0);
      assert.ok(r.price_pearl >= 4 && r.price_pearl <= 20, `${r.id}: harga ${r.price_pearl} Mutiara`);
      if (r.kind === 'furniture') assert.ok(r.data.w >= 1 && r.data.w <= 4 && r.data.d >= 1 && r.data.d <= 4, `${r.id}: ukuran ≤ 4×4`);
    }
    // total sekelas set lama (46–62 Mutiara), paket diskon 20%
    const total = rows.reduce((a: number, r: any) => a + r.price_pearl, 0);
    assert.ok(total >= 45 && total <= 65, `${key}: total ${total}`);
  }
  assert.deepEqual(NEW_SETS.map((k) => bundlePrice(PREMIUM_SET_BY_KEY[k].items.map((id) => ITEMS[id].price_pearl), 20).price), [41, 44, 42]);
  assert.equal(PREMIUM_SETS.length, 8);
  // katalog untuk pemain memuat item & set baru
  const cat = JSON.parse((await app.inject({ method: 'GET', url: '/api/catalog' })).body);
  for (const id of Object.keys(ITEMS)) assert.ok(cat.items.some((i: any) => i.id === id), `${id} di /api/catalog`);
});

test('paket 17: aktivitas untuk mebel baru (masak, musik, mandi, duduk, ...) memakai animasi yang ada', async () => {
  const acts = await db.query(`select id, targets, anim, effects from activities where id = any($1::text[])`, [SEED_ACTIVITIES_V17.map((a) => a.id)]);
  assert.equal(acts.length, SEED_ACTIVITIES_V17.length);
  const keys = new Set(SEED_ITEMS_V17.filter((i) => i.kind === 'furniture').map((i) => 'art:' + i.art.key));
  for (const a of acts) {
    assert.ok(ACTIVITY_ANIMS[a.anim], `${a.id}: animasi ${a.anim} ada`);
    assert.ok(a.targets.every((t: string) => keys.has(t)), `${a.id}: target ${a.targets} = mebel set baru`);
  }
  const anim = Object.fromEntries(acts.map((a: any) => [a.targets[0], a.anim]));
  assert.equal(anim['art:tungku'], 'masak');
  assert.equal(anim['art:bakkayu'], 'mandi');
  assert.equal(anim['art:mejamakan'], 'duduk');
  for (const k of ['art:rakangklung', 'art:kecapi', 'art:gendang']) assert.equal(anim[k], 'musik');
  // setiap mebel set baru punya minimal satu aktivitas
  for (const k of keys) assert.ok(acts.some((a: any) => a.targets.includes(k)), `${k} punya aktivitas`);
});

test('paket 17: hanya sekali, dan tidak menimpa ubahan admin bila dijalankan ulang', async () => {
  assert.equal(await seedPackV17(db), false, 'sudah dijalankan saat server mulai');
  assert.ok(Number((await db.one(`select value from settings where key = 'content_pack'`)).value) >= 17);
  await db.query(`update items set price_pearl = 99, name = 'Tungku Admin' where id = 'dn-tungku'`);
  await db.query(`update activities set xp = 9 where id = 'masak-tungku'`);
  await db.query(`delete from settings where key = 'pack_premium2'`);
  const ver = Number((await db.one(`select value from settings where key = 'catalog_version'`))?.value ?? 0);
  assert.equal(await seedPackV17(db), true);
  const it = await db.one(`select price_pearl, name from items where id = 'dn-tungku'`);
  assert.deepEqual([it.price_pearl, it.name], [99, 'Tungku Admin']);
  assert.equal((await db.one(`select xp from activities where id = 'masak-tungku'`)).xp, 9);
  assert.ok(Number((await db.one(`select value from settings where key = 'catalog_version'`)).value) > ver, 'versi katalog naik');
  assert.equal(await seedPackV17(db), false);
  await db.query(`update items set price_pearl = 15, name = 'Tungku Tanah Liat' where id = 'dn-tungku'`);
  await db.query(`update activities set xp = 3 where id = 'masak-tungku'`);
  invalidateCaches();
});

test('gambar: semua mebel baru sah di 4 arah (tanpa NaN), ikon toko sah, dinding & lantai sah', () => {
  for (const it of SEED_ITEMS_V17) {
    if (it.kind !== 'furniture') {
      const room = renderRoom({ size: 6, layout: [], items: {}, ...(it.kind === 'floor' ? { floor: it } : { wall: it }) } as any);
      assert.ok(wellFormed(room), `${it.id}: ruangan sah`);
      assert.ok(wellFormed(itemIcon(it as any)), `${it.id}: ikon sah`);
      continue;
    }
    assert.equal(rotSteps(it as any), 4, `${it.id}: bisa diputar 4 arah`);
    const out = [0, 1, 2, 3].map((r) => draw(it.id, r));
    out.forEach((svg, r) => assert.ok(wellFormed(svg), `${it.id} arah ${r}: SVG sah`));
    assert.ok(!out[0].includes('class="rot"') && out[1].includes('class="rot"') && out[3].includes('class="rot"'), `${it.id}: arah 1 & 3 dicerminkan`);
    assert.ok(out[2].includes('class="back"') && out[3].includes('class="back"') && !out[0].includes('class="back"'), `${it.id}: arah 2 & 3 tampak belakang`);
    assert.ok(furnOnly(out[0]).length > 600 && furnOnly(out[2]).length > 400, `${it.id}: gambar tidak kosong`);
    assert.ok(wellFormed(itemIcon(it as any)), `${it.id}: ikon sah`);
    // di ruangan 6×6 & rumah ukuran lain juga sah
    assert.ok(wellFormed(renderRoom({ size: 8, layout: [{ i: it.id, x: 2, y: 2, r: 3 }], items: ITEMS } as any)), `${it.id}: ruang 8×8`);
  }
});

test('gambar: tampak belakang tidak menampilkan hiasan sisi depan', () => {
  const has = (id: string, r: number, s: string) => furnOnly(draw(id, r)).includes(s);
  // tungku: api di lubang tungku (kelas flicker) hanya dari depan; wajan & dandang di atas tetap terlihat
  assert.ok(has('dn-tungku', 0, 'flicker') && !has('dn-tungku', 2, 'flicker') && !has('dn-tungku', 3, 'flicker'));
  assert.ok(has('dn-tungku', 2, '#C9CED6'), 'dandang tetap terlihat dari belakang');
  // rak piring: ruang rak (gelap) & piring hanya dari depan; teko di atas tetap terlihat
  const rakIn = shade('#B5703F', -0.45);
  assert.ok(has('dn-rakpiring', 0, rakIn) && !has('dn-rakpiring', 2, rakIn) && !has('dn-rakpiring', 3, rakIn));
  assert.ok(has('dn-rakpiring', 2, '#F2F5EE'), 'teko blirik di atas rak terlihat dari belakang');
  // kelir: dari depan wayang berwarna, dari belakang hanya bayangannya di layar
  assert.ok(has('sg-kelir', 0, '#3F5E8F') && !has('sg-kelir', 2, '#3F5E8F'));
  assert.ok(has('sg-kelir', 2, '#3B2F2F') && has('sg-kelir', 2, '#FFE6AE'), 'sisi bayangan: layar terang & bayangan wayang');
  // meja membatik: motif batik (dasar sogan) hanya di sisi depan kain
  assert.ok(has('sg-membatik', 0, '#E2BC86') && !has('sg-membatik', 2, '#E2BC86'));
  // pancuran: pancuran bambu & air jatuh hanya dari depan
  assert.ok(has('sp-pancuran', 0, 'class="water"') && !has('sp-pancuran', 2, 'class="water"') && !has('sp-pancuran', 2, '#8FD3E8'));
  // kendang: muka kendang yang terlihat berganti (besar dari depan, kecil dari belakang) tapi tetap ada
  assert.ok(has('sg-kendang', 0, '#F3E3B5') && has('sg-kendang', 2, '#F3E3B5'));
});

test('efek suasana: set baru terdeteksi dengan ≥ 3 item dan efeknya digambar', () => {
  const setOf = (id: string) => ITEMS[id]?.data?.set as string | undefined;
  assert.equal(roomMood(['dn-tungku', 'dn-gentong'], setOf), null);
  assert.equal(roomMood(['dn-tungku', 'dn-gentong', 'wp-gedek'], setOf), 'dapurnenek');
  assert.equal(roomMood(['sg-kecapi', 'sg-kendang', 'fl-papanjati', 'sp-lilin'], setOf), 'sanggar');
  const at = (u: number, v: number, up = 0) => [400 + (u - v) * 204, 150 + (u + v) * 102 - up];
  const sigs: Record<string, string> = { dapurnenek: '#FFB347', sanggar: '#FFF1C4', spabali: '#F7C548' };
  for (const key of NEW_SETS) {
    const svg = premiumMoodSVG(key, at, { wallH: 150 });
    assert.ok(wellFormed(svg), `${key}: efek sah`);
    assert.ok(svg.includes(sigs[key]), `${key}: efek khas digambar`);
    assert.ok(svg.includes('class="blink"'), `${key}: efek bergerak`);
    assert.ok(svg.includes(`Suasana ${PREMIUM_SET_BY_KEY[key].name.replace(/^Set /, '')}`) && svg.includes(PREMIUM_SET_BY_KEY[key].color), `${key}: label suasana`);
  }
  // set lama tetap sama (efek dipindah ke @kb/shared)
  assert.ok(premiumMoodSVG('tamanmalam', at, { wallH: 150 }).includes('#EFFF7A'));
});

test('beli paket Set Spa Bali dengan Mutiara, pasang 3 item, berendam air kembang; aktivitas mebel lain ditolak', async () => {
  const c = client();
  await c.post('/api/auth/guest');
  assert.equal((await c.post('/api/pet', { name: 'Kamboja', color: '#F6B7A8', ear: 'kucing' })).status, 200);
  let me = (await c.get('/api/me')).body;
  await db.query(`update wallets set pearl = 100 where user_id = $1`, [me.user.id]);
  const wrong = await c.post('/api/shop/bundle', { set: 'spabali', price: 53 });
  assert.equal(wrong.body.error.code, 'price_changed');
  const r = await c.post('/api/shop/bundle', { set: 'spabali', price: 42 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.items.length, 6);
  assert.equal(r.body.wallet.pearl, 58);
  // pasang 3 mebel set di kamar (bak berendam diputar)
  me = (await c.get('/api/me')).body;
  const room = (me.rooms ?? [me.room])[0];
  // kamar awal: kasur (4,0), karpet (2,2) datar, pot (0,4)
  const layout = [...room.layout, { i: 'sp-bakkayu', x: 2, y: 1, r: 1 }, { i: 'sp-kamboja', x: 0, y: 0 }, { i: 'sp-lilin', x: 1, y: 0, r: 2 }];
  const s = await c.post('/api/room', { roomId: room.id || undefined, version: room.version, layout });
  assert.equal(s.status, 200, JSON.stringify(s.body));
  me = (await c.get('/api/me')).body;
  const lay = (me.rooms ?? [me.room])[0].layout;
  assert.ok(lay.some((p: any) => p.i === 'sp-bakkayu' && p.r === 1));
  assert.equal(roomMood(lay.map((p: any) => p.i), (id) => ITEMS[id]?.data?.set), 'spabali');
  // berendam air kembang di bak kayu
  const idx = lay.findIndex((p: any) => p.i === 'sp-bakkayu');
  const act = await c.post('/api/activity', { activityId: 'mandi-kembang', roomId: (me.rooms ?? [me.room])[0].id || undefined, index: idx });
  assert.equal(act.status, 200, JSON.stringify(act.body));
  assert.match(act.body.result.message, /berendam air kembang/);
  // aktivitas tidak cocok dengan mebel lain
  const no = await c.post('/api/activity', { activityId: 'masak-tungku', roomId: (me.rooms ?? [me.room])[0].id || undefined, index: idx });
  assert.equal(no.status, 400);
  assert.equal((await c.post('/api/shop/bundle', { set: 'spabali' })).body.error.code, 'owned');
});
