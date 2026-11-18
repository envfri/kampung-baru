// Paket konten 19: Edisi Spesial di Toko Mutiara — 8 mebel + dinding + lantai dengan efek bergerak.
// Paket hanya sekali & tidak menimpa ubahan admin; item Mutiara (data.edisi) di Toko Mutiara; gambar sah di 4 arah
// dan membawa kelas efeknya (juga di tampak belakang & ikon toko); CSS efek punya versi prefers-reduced-motion;
// admin bisa menandai Edisi Spesial & memberi batas jual (yang sudah lewat tidak bisa dibeli); beli, pasang, aktivitas.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { config } from '../src/config';
import { ACTIVITY_ANIMS, EDISI_EFEK, footprint, isEdisi, itemIcon, renderRoom, rotSteps, sisaWaktu } from '@kb/shared';

config.paymentProvider = 'mock';
config.adminEmail = 'owner@test.local';
config.adminPassword = 'rahasia-sekali-123';
const { buildApp } = await import('../src/app');
const { SEED_ITEMS_V19, SEED_ACTIVITIES_V19, seedPackV19 } = await import('../src/db/seed-edisi1');
const { invalidateCaches } = await import('../src/lib/core');
let app: any;
let db: any;
before(async () => { ({ app, db } = await buildApp({ memoryDb: true, logger: false, rateLimit: false, worker: false })); });
after(async () => { await app?.close(); });

const ITEMS: Record<string, any> = Object.fromEntries(SEED_ITEMS_V19.map((i) => [i.id, i]));
const FURN = SEED_ITEMS_V19.filter((i) => i.kind === 'furniture');
/** kelas efek khas tiap bentuk (harus ada di semua arah) */
const FX: Record<string, string[]> = {
  tabebuya: ['ed-fall', 'ed-flutter'], akuariumubur: ['ed-bob', 'ed-glow', 'ed-rise'], kincir: ['ed-spin'], airmancurkristal: ['ed-flow', 'ed-ripple', 'ed-twinkle'],
  gramofon: ['ed-spin', 'ed-rise'], lampulava: ['ed-blob', 'ed-halo'], teleskop: ['ed-twinkle', 'ed-shoot'], wayanggolek: ['ed-sway', 'ed-wave'],
  aurora: ['ed-aurora'], kolamkaca: ['ed-swim'],
};

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
  return { get: (u: string) => call('GET', u), post: (u: string, b?: unknown) => call('POST', u, b ?? {}), put: (u: string, b?: unknown) => call('PUT', u, b ?? {}) };
}
async function adminClient() {
  const a = client();
  assert.equal((await a.post('/api/admin/login', { email: 'owner@test.local', password: 'rahasia-sekali-123' })).status, 200);
  return a;
}
/** ubah item lewat admin (PUT memakai seluruh isian item) */
async function adminEdit(a: any, id: string, patch: Record<string, unknown>) {
  const it = (await a.get('/api/admin/items')).body.items.find((i: any) => i.id === id);
  return a.put(`/api/admin/items/${id}`, { ...it, ...patch });
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
/** gambar satu mebel di ruang 3×3, arah r (seluruh ruangan) */
const room = (id: string, r: number, size = 3) => {
  const f = footprint(ITEMS[id], r);
  return renderRoom({ size, layout: [{ i: id, x: Math.floor((size - f.w) / 2), y: Math.floor((size - f.d) / 2), r }], items: ITEMS } as any);
};
/** bagian gambar mebelnya saja (tanpa dinding & lantai) */
const draw = (id: string, r: number) => { const svg = room(id, r); return svg.slice(svg.indexOf('class="furn')); };
const count = (s: string, sub: string) => s.split(sub).length - 1;

test('paket 19: 8 mebel + dinding + lantai Edisi Spesial di Toko Mutiara, harga Mutiara di atas item premium biasa', async () => {
  assert.equal(SEED_ITEMS_V19.length, 10);
  assert.equal(FURN.length, 8);
  const rows = await db.query(`select id, kind, shop, price_pearl, price_coin, data, art, active from items where id = any($1::text[])`, [SEED_ITEMS_V19.map((i) => i.id)]);
  assert.equal(rows.length, 10);
  // harga item set premium lama (pembanding): Edisi Spesial rata-rata lebih mahal
  const prem = await db.query(`select avg(price_pearl)::float avg, max(price_pearl)::int mx from items where shop = 'mutiara' and data ? 'set'`);
  for (const r of rows) {
    assert.equal(r.shop, 'mutiara', `${r.id} di Toko Mutiara`);
    assert.equal(r.active, true);
    assert.equal(Number(r.price_coin), 0, `${r.id}: tidak dijual dengan koin`);
    assert.ok(r.price_pearl >= 12 && r.price_pearl <= 25, `${r.id}: harga ${r.price_pearl} Mutiara`);
    assert.equal(r.data.edisi, 1, `${r.id}: ditandai Edisi Spesial`);
    assert.ok(isEdisi(r), `${r.id}: isEdisi`);
    assert.ok(!r.data.set, `${r.id}: dibeli satuan, bukan bagian set`);
    assert.ok(EDISI_EFEK[r.art.key], `${r.id}: efek tercatat untuk kartu toko`);
    if (r.kind === 'furniture') assert.ok(r.data.w >= 1 && r.data.w <= 4 && r.data.d >= 1 && r.data.d <= 4, `${r.id}: ukuran ≤ 4×4`);
  }
  const avg = rows.reduce((a: number, r: any) => a + r.price_pearl, 0) / rows.length;
  assert.ok(avg > prem[0].avg + 4, `rata-rata ${avg} > rata-rata item set premium ${prem[0].avg}`);
  // katalog pemain memuat semuanya (dengan data.edisi), tanpa batas waktu bawaan
  const cat = JSON.parse((await app.inject({ method: 'GET', url: '/api/catalog' })).body);
  for (const id of Object.keys(ITEMS)) {
    const it = cat.items.find((i: any) => i.id === id);
    assert.ok(it && it.data.edisi === 1 && it.available_to === null, `${id} di /api/catalog`);
  }
  assert.ok(Number((await db.one(`select value from settings where key = 'content_pack'`)).value) >= 19);
});

test('paket 19: aktivitas untuk tiap mebel Edisi Spesial memakai animasi yang ada', async () => {
  const acts = await db.query(`select id, targets, anim from activities where id = any($1::text[])`, [SEED_ACTIVITIES_V19.map((a) => a.id)]);
  assert.equal(acts.length, SEED_ACTIVITIES_V19.length);
  for (const a of acts) assert.ok(ACTIVITY_ANIMS[a.anim], `${a.id}: animasi ${a.anim} ada`);
  for (const it of FURN) assert.ok(acts.some((a: any) => a.targets.includes('art:' + it.art.key)), `${it.id} punya aktivitas`);
  const anim = Object.fromEntries(acts.map((a: any) => [a.targets[0], a.anim]));
  assert.equal(anim['art:gramofon'], 'musik');
  assert.equal(anim['art:teleskop'], 'lihat');
});

test('paket 19: hanya sekali, dan tidak menimpa ubahan admin bila dijalankan ulang', async () => {
  assert.equal(await seedPackV19(db), false, 'sudah dijalankan saat server mulai');
  await db.query(`update items set price_pearl = 99, name = 'Tabebuya Admin' where id = 'es-tabebuya'`);
  await db.query(`update activities set xp = 9 where id = 'intip-bintang'`);
  await db.query(`delete from items where id = 'es-kincir'`);
  await db.query(`delete from settings where key = 'pack_edisi1'`);
  const ver = Number((await db.one(`select value from settings where key = 'catalog_version'`))?.value ?? 0);
  assert.equal(await seedPackV19(db), true);
  const it = await db.one(`select price_pearl, name from items where id = 'es-tabebuya'`);
  assert.deepEqual([it.price_pearl, it.name], [99, 'Tabebuya Admin'], 'ubahan admin tetap');
  assert.equal((await db.one(`select xp from activities where id = 'intip-bintang'`)).xp, 9);
  assert.ok(await db.one(`select 1 from items where id = 'es-kincir'`), 'item yang hilang ditambahkan lagi');
  assert.ok(Number((await db.one(`select value from settings where key = 'catalog_version'`)).value) > ver, 'versi katalog naik');
  assert.equal(await seedPackV19(db), false);
  await db.query(`update items set price_pearl = 20, name = 'Pohon Tabebuya Mekar' where id = 'es-tabebuya'`);
  await db.query(`update activities set xp = 3 where id = 'intip-bintang'`);
  invalidateCaches();
});

test('gambar: tiap mebel sah di 4 arah (tanpa NaN) dan membawa kelas efeknya, juga tampak belakang & ikon', () => {
  for (const it of FURN) {
    assert.equal(rotSteps(it as any), 4, `${it.id}: bisa diputar 4 arah`);
    const out = [0, 1, 2, 3].map((r) => draw(it.id, r));
    out.forEach((svg, r) => {
      assert.ok(wellFormed(room(it.id, r)), `${it.id} arah ${r}: SVG sah`);
      for (const cls of FX[it.art.key]) assert.ok(svg.includes(cls), `${it.id} arah ${r}: efek ${cls}`);
      // sedikit elemen bergerak per mebel (ringan di HP)
      const n = count(svg, 'class="ed-');
      assert.ok(n >= 1 && n <= 14, `${it.id} arah ${r}: ${n} elemen efek`);
      // frame dasar terlihat (reduced-motion & foto Jepret tanpa CSS): tidak ada elemen efek yang disembunyikan
      assert.ok(!/opacity="0"/.test(svg), `${it.id} arah ${r}: tidak ada elemen tersembunyi`);
    });
    assert.ok(!out[0].includes('class="rot"') && out[1].includes('class="rot"') && out[3].includes('class="rot"'), `${it.id}: arah 1 & 3 dicerminkan`);
    assert.ok(out[2].includes('class="back"') && out[3].includes('class="back"') && !out[0].includes('class="back"'), `${it.id}: arah 2 & 3 tampak belakang`);
    assert.ok(out[0].length > 1500 && out[2].length > 1000, `${it.id}: gambar tidak kosong`);
    const icon = itemIcon(it as any);
    assert.ok(wellFormed(icon) && FX[it.art.key].every((c) => icon.includes(c)), `${it.id}: ikon toko sah & bergerak`);
    assert.ok(wellFormed(renderRoom({ size: 8, layout: [{ i: it.id, x: 2, y: 2, r: 3 }], items: ITEMS } as any)), `${it.id}: ruang 8×8`);
  }
});

test('gambar: tampak belakang menyembunyikan sisi depan, efek ikut berbalik', () => {
  const has = (id: string, r: number, s: string) => draw(id, r).includes(s);
  // gramofon: lubang corong (gelap) hanya dari depan; dari belakang punggung corong + not tetap melayang
  assert.ok(has('es-gramofon', 0, '#3B2A1A') && !has('es-gramofon', 2, '#3B2A1A') && has('es-gramofon', 2, 'ed-rise'));
  // teleskop: lensa objektif kaca terlihat bila tabungnya mengarah ke kamera (tampak belakang)
  assert.ok(!has('es-teleskop', 0, '#9FD8F5') && has('es-teleskop', 2, '#9FD8F5'));
  // wayang golek: wajah (bibir merah) hanya dari depan
  assert.ok(has('es-wayanggolek', 0, 'q1.6 1 3.2 0') && !has('es-wayanggolek', 2, 'q1.6 1 3.2 0'));
  // akuarium: gagang laci di depan saja; ubur-ubur di kaca terlihat dari dua sisi
  assert.ok(count(draw('es-uburubur', 0), 'ed-bob') === 3 && count(draw('es-uburubur', 2), 'ed-bob') === 3);
  // kincir: baling-baling di ujung lain poros → letak layarnya berbeda dari depan & belakang
  const spinAt = (r: number) => draw('es-kincir', r).match(/matrix\(([^)]*)\)/)?.[1];
  assert.notEqual(spinAt(0), spinAt(2));
});

test('dinding aurora & lantai kolam kaca: efek di ruangan dan ikon, mati di mode Atur (lantai)', () => {
  const wall = renderRoom({ size: 6, layout: [], items: {}, wall: ITEMS['wp-aurora'] } as any);
  assert.ok(wellFormed(wall) && count(wall, 'ed-aurora') >= 4, 'dua pita aurora di tiap dinding');
  const floor = renderRoom({ size: 6, layout: [], items: {}, floor: ITEMS['fl-kolamkaca'] } as any);
  assert.ok(wellFormed(floor), 'lantai sah');
  const fish = count(floor, 'class="ed-swim"');
  assert.ok(fish >= 2 && fish <= 5, `${fish} ikan di 6×6`);
  assert.ok(/--tx:-?\d/.test(floor) && /--ty:-?\d/.test(floor), 'jalur ikan lewat variabel CSS');
  const edit = renderRoom({ size: 6, layout: [], items: {}, floor: ITEMS['fl-kolamkaca'], edit: true } as any);
  assert.ok(!edit.includes('ed-swim'), 'mode Atur: petak polos tanpa ikan');
  for (const id of ['wp-aurora', 'fl-kolamkaca']) assert.ok(wellFormed(itemIcon(ITEMS[id])) && FX[ITEMS[id].art.key].every((c) => itemIcon(ITEMS[id]).includes(c)), `${id}: ikon bergerak`);
  // rumah: ruangan tidak persegi tetap sah
  assert.ok(wellFormed(renderRoom({ size: 9, layout: [], items: {}, floor: ITEMS['fl-kolamkaca'], wall: ITEMS['wp-aurora'] } as any)));
});

test('CSS efek: semua kelas ed-* dianimasikan di ruangan & pratinjau toko, dan diam saat prefers-reduced-motion', () => {
  const css = readFileSync(new URL('../../game/src/app.css', import.meta.url), 'utf8');
  const all = new Set(Object.values(FX).flat());
  for (const it of SEED_ITEMS_V19) {
    const svg = it.kind === 'furniture' ? draw(it.id, 0) : renderRoom({ size: 6, layout: [], items: {}, [it.kind === 'floor' ? 'floor' : 'wall']: it } as any);
    for (const m of svg.matchAll(/class="(ed-[\w-]+)/g)) all.add(m[1]);
  }
  const reduce = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce) {\n  :is(svg.room, .edfx)'));
  assert.ok(reduce.length > 0, 'blok reduced-motion Edisi Spesial ada');
  const block = reduce.slice(0, reduce.indexOf('}') + 1);
  assert.match(block, /animation: none/);
  for (const cls of all) {
    assert.ok(new RegExp(`:is\\(svg\\.room, \\.edfx\\) \\.${cls} \\{ animation`).test(css), `${cls}: dianimasikan`);
    assert.ok(cls === 'ed-aurora2' || block.includes('.' + cls), `${cls}: diam saat reduced-motion`);
  }
});

test('sisa waktu jual (hitung mundur kartu Edisi Spesial)', () => {
  const now = Date.UTC(2026, 10, 18, 8);
  assert.equal(sisaWaktu(null, now), '');
  assert.equal(sisaWaktu(new Date(now - 1000).toISOString(), now), '');
  assert.equal(sisaWaktu(now + 3 * 86_400_000 + 5000, now), 'Sisa 3 hari');
  assert.equal(sisaWaktu(now + 30 * 3_600_000, now), 'Sisa 30 jam');
  assert.equal(sisaWaktu(now + 12 * 60_000 - 1, now), 'Sisa 12 mnt');
});

test('admin: tanda Edisi Spesial bertahan saat item diubah, jadwal jual divalidasi, item lewat batas tidak bisa dibeli', async () => {
  const a = await adminClient();
  // ubah harga lewat admin: data.edisi tidak hilang
  let r = await adminEdit(a, 'es-lampulava', { price_pearl: 13 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.item.data.edisi, 1);
  // centang di admin (true) → edisi 1; nilai ngawur ditolak; bukan Edisi → hilang
  const base = (await a.get('/api/admin/items')).body.items.find((i: any) => i.id === 'es-lampulava');
  r = await adminEdit(a, 'es-lampulava', { data: { ...base.data, edisi: true } });
  assert.equal(r.body.item.data.edisi, 1);
  r = await adminEdit(a, 'es-lampulava', { data: { ...base.data, edisi: 500 } });
  assert.equal(r.status, 400);
  r = await adminEdit(a, 'es-lampulava', { data: { ...base.data, edisi: false } });
  assert.equal(r.status, 200);
  assert.ok(!('edisi' in r.body.item.data));
  r = await adminEdit(a, 'es-lampulava', { data: { ...base.data, edisi: 1 }, price_pearl: 12 });
  assert.equal(r.body.item.data.edisi, 1);
  // jadwal jual: berhenti harus sesudah mulai
  r = await adminEdit(a, 'es-teleskop', { available_from: '2026-12-10T00:00:00Z', available_to: '2026-12-01T00:00:00Z' });
  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, 'invalid_schedule');

  // pemain dengan Mutiara
  const c = client();
  await c.post('/api/auth/guest');
  assert.equal((await c.post('/api/pet', { name: 'Kelopak', color: '#F6B7A8', ear: 'kucing' })).status, 200);
  const me = (await c.get('/api/me')).body;
  await db.query(`update wallets set pearl = 100 where user_id = $1`, [me.user.id]);
  // batas jual di masa depan: masih bisa dibeli, katalog membawa tanggalnya (untuk hitung mundur)
  const soon = new Date(Date.now() + 3 * 86_400_000).toISOString();
  r = await adminEdit(a, 'es-teleskop', { available_from: null, available_to: soon });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const cat = JSON.parse((await app.inject({ method: 'GET', url: '/api/catalog' })).body);
  assert.equal(new Date(cat.items.find((i: any) => i.id === 'es-teleskop').available_to).toISOString(), soon);
  r = await c.post('/api/shop/buy', { itemId: 'es-teleskop', currency: 'pearl' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.wallet.pearl, 82);
  // sudah lewat batas: ditolak, Mutiara tidak berkurang
  r = await adminEdit(a, 'es-teleskop', { available_to: new Date(Date.now() - 60_000).toISOString() });
  assert.equal(r.status, 200);
  r = await c.post('/api/shop/buy', { itemId: 'es-teleskop', currency: 'pearl' });
  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, 'not_for_sale');
  assert.equal((await c.get('/api/me')).body.wallet.pearl, 82);
  // tidak bisa dibeli dengan koin
  assert.equal((await c.post('/api/shop/buy', { itemId: 'es-gramofon', currency: 'coin' })).body.error.code, 'wrong_currency');
  await adminEdit(a, 'es-teleskop', { available_to: null });
});

test('beli Gramofon Antik dengan Mutiara, pasang membelakangi kamera, putar piringan hitam', async () => {
  const c = client();
  await c.post('/api/auth/guest');
  assert.equal((await c.post('/api/pet', { name: 'Piringan', color: '#9FD0E8', ear: 'anjing' })).status, 200);
  let me = (await c.get('/api/me')).body;
  await db.query(`update wallets set pearl = 40 where user_id = $1`, [me.user.id]);
  let r = await c.post('/api/shop/buy', { itemId: 'es-gramofon', currency: 'pearl' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.wallet.pearl, 24);
  r = await c.post('/api/shop/buy', { itemId: 'fl-kolamkaca', currency: 'pearl' });
  assert.equal(r.status, 200);
  me = (await c.get('/api/me')).body;
  const room = (me.rooms ?? [me.room])[0];
  // kamar awal: kasur (4,0), karpet (2,2) datar, pot (0,4)
  const s = await c.post('/api/room', { roomId: room.id || undefined, version: room.version, floor: 'fl-kolamkaca', layout: [...room.layout, { i: 'es-gramofon', x: 1, y: 1, r: 3 }] });
  assert.equal(s.status, 200, JSON.stringify(s.body));
  me = (await c.get('/api/me')).body;
  const rm = (me.rooms ?? [me.room])[0];
  assert.equal(rm.floor, 'fl-kolamkaca');
  const idx = rm.layout.findIndex((p: any) => p.i === 'es-gramofon' && p.r === 3);
  assert.ok(idx >= 0, 'gramofon tersimpan diputar 3×');
  const act = await c.post('/api/activity', { activityId: 'putar-piringan', roomId: rm.id || undefined, index: idx });
  assert.equal(act.status, 200, JSON.stringify(act.body));
  assert.match(act.body.result.message, /piringan hitam/);
  assert.equal((await c.post('/api/activity', { activityId: 'intip-bintang', roomId: rm.id || undefined, index: idx })).status, 400, 'aktivitas mebel lain ditolak');
});
