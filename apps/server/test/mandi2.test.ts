// Paket konten 22: kamar mandi 2 (Mebel Jati & Toko Mutiara) dan enam ruangan Mutiara bertema — item di toko yang benar
// dengan harga wajar, paket hanya sekali & tidak menimpa ubahan admin, barang khusus ruangan tidak bisa dibeli / dijual,
// tiga animasi baru (gayung, shower, kering) lengkap dengan properti & CSS (diam saat gerak dikurangi), gambar sah di
// 4 arah, dinding & lantai baru, ikon ruangan bertema; membeli tiap ruangan Mutiara memotong Mutiara, memasang dinding &
// lantai khususnya, dan memberi mebel khas + dinding + lantai tepat sekali (aman dengan requestId); batas 12 ruangan
// (bawaan baru, migrasi 031 menaikkan nilai lama 6 saja); aktivitas baru bisa dipakai.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { config } from '../src/config';
import {
  ACTIVITY_ANIMS, DEFAULT_SETTINGS, MANDI2_ART, MANDI2_ROOM_KEYS as ROOM_KEYS, MANDI2_SHOWER, MANDI2_SURFACES, PERABOT3_AYUN, activityFits, builtinCatalog,
  footprint, houseDraws, houseLayout, itemIcon, petMarkup, renderRoom, rotSteps,
} from '@kb/shared';

config.paymentProvider = 'mock';
config.adminEmail = 'owner@test.local';
config.adminPassword = 'rahasia-sekali-123';
const { buildApp } = await import('../src/app');
const { SEED_ITEMS_V22, SEED_ACTIVITIES_V22, MANDI2_ROOMS, seedPackV22 } = await import('../src/db/seed-mandi2');
const { invalidateCaches } = await import('../src/lib/core');
let app: any;
let db: any;
before(async () => { ({ app, db } = await buildApp({ memoryDb: true, logger: false, rateLimit: false, worker: false })); });
after(async () => { await app?.close(); });

const ITEMS: Record<string, any> = Object.fromEntries(SEED_ITEMS_V22.map((i) => [i.id, i]));
const FURN = SEED_ITEMS_V22.filter((i) => i.kind === 'furniture');
const MEBEL = ['bak-gayung', 'shower-tirai-ikan', 'pengering-bulu', 'mesin-gelembung', 'rak-mainan-mandi', 'ember-rendam-kaki', 'rak-sabun-sampo', 'lampu-ubur-ubur', 'keranjang-cucian', 'pot-lidah-mertua'];
const PRICE: Record<string, number> = { 'bak-gayung': 180, 'shower-tirai-ikan': 230, 'pengering-bulu': 140, 'mesin-gelembung': 160, 'rak-mainan-mandi': 90, 'ember-rendam-kaki': 100, 'rak-sabun-sampo': 60, 'lampu-ubur-ubur': 120, 'keranjang-cucian': 50, 'pot-lidah-mertua': 45, 'wp-ubinperahu': 70, 'fl-batukalikecil': 70 };
const PEARL = { 'bak-kaki-kucing': 12, 'pancuran-gajah': 15 } as Record<string, number>;
const ROOMS: Record<string, { size: number; price: number; bonus: string }> = {
  'ruang-main': { size: 5, price: 12, bonus: 'kolam-bola' }, 'rumah-pohon': { size: 5, price: 15, bonus: 'ayunan-ban' }, 'studio-karaoke': { size: 5, price: 15, bonus: 'mesin-karaoke' },
  'rumah-kaca': { size: 6, price: 15, bonus: 'rak-anggrek' }, 'air-panas': { size: 5, price: 18, bonus: 'kolam-air-panas' }, 'ruang-akuarium': { size: 6, price: 20, bonus: 'sofa-kerang' },
};
const SIGNATURE = Object.values(ROOMS).map((r) => r.bonus);

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
async function player(name: string, coin = 0, pearl = 0) {
  const c = client();
  await c.post('/api/auth/guest');
  assert.equal((await c.post('/api/pet', { name, color: '#F6B7A8', ear: 'kucing' })).status, 200);
  const me = (await c.get('/api/me')).body;
  await db.query(`update wallets set coin = $2, pearl = $3 where user_id = $1`, [me.user.id, coin, pearl]);
  return { c, id: me.user.id as string };
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
const draw = (id: string, r: number, size = 4) => {
  const f = footprint(ITEMS[id], r);
  return renderRoom({ size, layout: [{ i: id, x: Math.floor((size - f.w) / 2), y: Math.floor((size - f.d) / 2), r }], items: ITEMS } as any);
};
const furnOnly = (svg: string) => svg.slice(svg.indexOf('class="furn'));

test('paket 22: barang baru di toko yang benar dengan harga sesuai', async () => {
  assert.equal(new Set(SEED_ITEMS_V22.map((i) => i.id)).size, SEED_ITEMS_V22.length, 'id unik');
  for (const [id, p] of Object.entries(PRICE)) assert.deepEqual([ITEMS[id]?.shop, ITEMS[id]?.price_coin, ITEMS[id]?.price_pearl], ['mebel', p, 0], `${id}: Mebel Jati ${p} koin`);
  for (const [id, p] of Object.entries(PEARL)) assert.deepEqual([ITEMS[id]?.shop, ITEMS[id]?.price_pearl, ITEMS[id]?.price_coin, ITEMS[id]?.kind], ['mutiara', p, 0, 'furniture'], `${id}: Toko Mutiara ${p} Mutiara`);
  assert.equal(ITEMS['wp-ubinperahu'].kind, 'wallpaper');
  assert.equal(ITEMS['fl-batukalikecil'].kind, 'floor');
  for (const id of MEBEL) {
    const it = ITEMS[id];
    assert.equal(it.kind, 'furniture');
    assert.ok(it.sell_coin > 0 && it.sell_coin <= Math.ceil(it.price_coin * 0.4), `${id}: harga jual ${it.sell_coin}`);
    assert.deepEqual([it.data.w, it.data.d], [1, 1], `${id}: 1×1`);
  }
  assert.deepEqual([ITEMS['bak-kaki-kucing'].data.w, ITEMS['bak-kaki-kucing'].data.d, ITEMS['pancuran-gajah'].data.w, ITEMS['pancuran-gajah'].data.d], [2, 1, 2, 2]);
  // enam ruangan Mutiara: ukuran, harga, ruangan dalam, dinding & lantai awal khusus, barang bonus
  for (const [id, r] of Object.entries(ROOMS)) {
    const it = ITEMS[id];
    assert.deepEqual([it.kind, it.shop, it.price_pearl, it.price_coin, it.data.size, it.data.theme], ['room', 'mutiara', r.price, 0, r.size, 'dalam'], id);
    assert.deepEqual(it.data.bonusItems, [r.bonus, it.data.wall, it.data.floor], `${id}: bonus mebel khas + dinding + lantai`);
    assert.equal(ITEMS[it.data.wall].kind, 'wallpaper');
    assert.equal(ITEMS[it.data.floor].kind, 'floor');
    assert.ok(it.description.length > 40 && /[a-z]/.test(it.description), `${id}: deskripsi`);
  }
  // barang khusus ruangan: tidak dijual, tanpa harga, tidak bisa dijual kembali
  const exclusive = SEED_ITEMS_V22.filter((i) => i.shop === null);
  assert.equal(exclusive.length, 18, '6 mebel khas + 6 dinding + 6 lantai');
  for (const it of exclusive) assert.deepEqual([it.price_coin, it.price_pearl, it.sell_coin], [0, 0, 0], it.id);
  assert.deepEqual(exclusive.filter((i) => i.kind === 'furniture').map((i) => i.id).sort(), [...SIGNATURE].sort());
  // katalog pemain memuat semuanya
  const cat = (await client().get('/api/catalog')).body;
  for (const id of Object.keys(ITEMS)) assert.ok(cat.items.some((i: any) => i.id === id), `${id} di /api/catalog`);
  for (const a of SEED_ACTIVITIES_V22) assert.ok(cat.activities.some((x: any) => x.id === a.id), `${a.id} di /api/catalog`);
  assert.equal(cat.settings.house?.maxRooms ?? DEFAULT_SETTINGS.house.maxRooms, 12);
});

test('paket 22: aktivitas memakai animasi yang ada, menunjuk mebel baru, jeda & XP sekelas kamar mandi', async () => {
  const acts = await db.query(`select id, targets, anim, effects, xp, coins, cooldown_sec, daily_limit from activities where id = any($1::text[])`, [SEED_ACTIVITIES_V22.map((a) => a.id)]);
  assert.equal(acts.length, SEED_ACTIVITIES_V22.length);
  const keys = new Set(FURN.map((i) => 'art:' + i.art.key));
  for (const a of acts) {
    assert.ok(ACTIVITY_ANIMS[a.anim], `${a.id}: animasi ${a.anim}`);
    assert.ok(a.targets.length === 1 && keys.has(a.targets[0]), `${a.id}: target mebel baru`);
    assert.ok(activityFits(a.targets, FURN.find((i) => 'art:' + i.art.key === a.targets[0]) as any));
    assert.ok(a.xp >= 1 && a.xp <= 3, `${a.id}: XP ${a.xp}`);
    assert.ok(a.cooldown_sec >= 600 && a.cooldown_sec <= 900, `${a.id}: jeda ${a.cooldown_sec}`);
    assert.equal(a.coins, 0);
    assert.equal(a.daily_limit, 0);
  }
  const by = Object.fromEntries(acts.map((a: any) => [a.targets[0].slice(4), a]));
  const of = (id: string) => by[ITEMS[id].art.key];
  const expect: Record<string, [string, Record<string, number>]> = {
    'bak-gayung': ['gayung', { bersih: 45, ceria: 4 }], 'shower-tirai-ikan': ['shower', { bersih: 35, ceria: 6 }], 'pengering-bulu': ['kering', { ceria: 8 }],
    'mesin-gelembung': ['lihat', { ceria: 12 }], 'rak-mainan-mandi': ['lihat', { ceria: 8 }], 'ember-rendam-kaki': ['duduk', { energi: 10, ceria: 4 }],
    'rak-sabun-sampo': ['lihat', { bersih: 4, ceria: 3 }], 'lampu-ubur-ubur': ['lihat', { ceria: 5 }], 'pot-lidah-mertua': ['siram', { ceria: 3 }],
    'bak-kaki-kucing': ['mandi', { bersih: 50, ceria: 10 }], 'pancuran-gajah': ['shower', { bersih: 40, ceria: 8 }],
    'kolam-bola': ['duduk', { ceria: 15 }], 'ayunan-ban': ['ayun', { ceria: 12 }], 'mesin-karaoke': ['musik', { ceria: 14 }],
    'rak-anggrek': ['siram', { ceria: 8 }], 'kolam-air-panas': ['mandi', { bersih: 40, energi: 15 }], 'sofa-kerang': ['duduk', { ceria: 6, energi: 6 }],
  };
  for (const [id, [anim, eff]] of Object.entries(expect)) assert.deepEqual([of(id)?.anim, of(id)?.effects], [anim, eff], id);
  // hanya keranjang cucian yang hiasan
  assert.deepEqual(FURN.filter((i) => !by[i.art.key]).map((i) => i.id), ['keranjang-cucian']);
  const all = await db.query(`select id from activities`);
  assert.equal(new Set(all.map((a: any) => a.id)).size, all.length, 'id aktivitas unik');
});

test('animasi baru gayung, shower, kering: properti, efek, CSS bergerak & diam saat gerak dikurangi', () => {
  const FX = ['hearts', 'bubbles', 'coins', 'zz', 'food', 'sparkle', 'drops', 'notes', 'steam'];
  const props: Record<string, string[]> = { gayung: ['p-gayung', 'p-guyur'], shower: ['p-shower', 'p-busa', 'p-cipr'], kering: ['p-angin', 'p-bulu'] };
  for (const [k, cls] of Object.entries(props)) {
    const a = ACTIVITY_ANIMS[k];
    assert.ok(a && a.label && a.ms >= 2000 && a.ms <= 4000 && FX.includes(a.fx), `${k}: label, durasi, efek`);
    assert.equal(a.prop, k);
    const m = petMarkup({ look: { color: '#F6B7A8', ear: 'kucing' } as any, wear: [], prop: k });
    assert.ok(wellFormed(m), `${k}: properti sah`);
    for (const c of cls) assert.ok(m.includes(`class="${c}"`), `${k}: properti ${c}`);
  }
  assert.deepEqual([ACTIVITY_ANIMS.gayung.on, ACTIVITY_ANIMS.shower.on, ACTIVITY_ANIMS.kering.on], [false, true, false]);
  // pet berdiri tepat di atas alas shower
  assert.equal(ACTIVITY_ANIMS.shower.lift, MANDI2_SHOWER.tray);
  const css = readFileSync(new URL('../../game/src/app.css', import.meta.url), 'utf8');
  const sec = css.slice(css.indexOf('/* ---------- Paket konten 22'), css.indexOf('/* ---------- Paket konten 20'));
  assert.ok(sec.length > 500, 'bagian CSS paket 22 ada');
  for (const k of ['guyur', 'tuang', 'aliran', 'bilas', 'hujan', 'kembang', 'angin', 'bulu']) assert.ok(sec.includes(`@keyframes p22-${k} `), `CSS: keyframes p22-${k}`);
  for (const sel of ['.pose-gayung .pet-bob', '.pose-gayung .p-gayung', '.pose-shower .p-shower path', '.pose-kering .pet-bob', '.pose-kering .p-bulu']) assert.ok(sec.includes(sel), `CSS: ${sel}`);
  const reduce = sec.slice(sec.indexOf('@media (prefers-reduced-motion: reduce)'));
  const kurangi = sec.slice(sec.indexOf('/* Pengaturan › Kurangi animasi'));
  for (const sel of ['.pose-gayung :is(.pet-bob, .p-gayung, .p-guyur)', '.pose-shower :is(.pet-bob, .p-shower path, .p-busa, .p-cipr)', '.pose-kering :is(.pet-bob, .p-angin path, .p-bulu)']) {
    assert.ok(reduce.includes(sel), `CSS: ${sel} diam dengan prefers-reduced-motion`);
    assert.ok(kurangi.includes(`:root.reduce-motion :is(.pet, .opet)${sel}`), `CSS: ${sel} diam dengan Kurangi animasi`);
  }
  // animasi paket 20 tetap terakhir (uji paket 20 membaca blok terakhir) dan animasi lama tidak berubah
  assert.ok(css.lastIndexOf('.ayk-ayun') > css.indexOf('/* ---------- Paket konten 22'));
  assert.deepEqual([ACTIVITY_ANIMS.duduk.lift, ACTIVITY_ANIMS.mandi.lift, ACTIVITY_ANIMS.ayun.lift], [14, 6, 24]);
  // ayunan ban: tali & ban berayun dari titik tengah palang setinggi palang Ayunan Kayu (lift & titik putar pose ayun sama)
  const svg = renderRoom({ size: 3, layout: [{ i: 'ayunan-ban', x: 0, y: 1 }], items: ITEMS } as any);
  const bar = /class="ayk-ayun" style="transform-origin:([\d.-]+)px ([\d.-]+)px"/.exec(svg);
  assert.ok(bar, 'ayunan ban punya titik putar');
  const t = Math.round((34 * 6) / 3), iso = [400 + (1 - 1.5) * t, 150 + (1 + 1.5) * (t / 2) - PERABOT3_AYUN.bar * (t / 32)];
  assert.ok(Math.abs(Number(bar![1]) - iso[0]) < 0.2 && Math.abs(Number(bar![2]) - iso[1]) < 0.2, `titik putar = tengah palang (${bar![1]}, ${bar![2]})`);
  for (const r of [0, 1, 2, 3]) assert.ok(/class="ayk-ayun"/.test(furnOnly(draw('ayunan-ban', r))), `ayunan ban arah ${r}`);
});

test('paket 22: hanya sekali, dan tidak menimpa ubahan admin bila dijalankan ulang', async () => {
  assert.equal(await seedPackV22(db), false, 'sudah dijalankan saat server mulai');
  assert.ok(Number((await db.one(`select value from settings where key = 'content_pack'`)).value) >= 22);
  await db.query(`update items set price_pearl = 99, name = 'Ruang Admin' where id = 'ruang-main'`);
  await db.query(`update items set price_coin = 999 where id = 'bak-gayung'`);
  await db.query(`update activities set xp = 9, anim = 'lihat' where id = 'mandi-gayung'`);
  await db.query(`delete from items where id = 'keranjang-cucian'`);
  await db.query(`delete from settings where key = 'pack_mandi2'`);
  const ver = Number((await db.one(`select value from settings where key = 'catalog_version'`))?.value ?? 0);
  assert.equal(await seedPackV22(db), true);
  assert.deepEqual(Object.values(await db.one(`select price_pearl, name from items where id = 'ruang-main'`)), [99, 'Ruang Admin'], 'ubahan admin tetap');
  assert.equal((await db.one(`select price_coin from items where id = 'bak-gayung'`)).price_coin, 999);
  assert.deepEqual(Object.values(await db.one(`select xp, anim from activities where id = 'mandi-gayung'`)), [9, 'lihat']);
  assert.ok(await db.one(`select 1 from items where id = 'keranjang-cucian'`), 'item yang hilang ditambahkan lagi');
  assert.ok(Number((await db.one(`select value from settings where key = 'catalog_version'`)).value) > ver, 'versi katalog naik');
  assert.equal(await seedPackV22(db), false);
  await db.query(`update settings set value = '23'::jsonb where key = 'content_pack'`);
  await db.query(`delete from settings where key = 'pack_mandi2'`);
  await seedPackV22(db);
  assert.equal(Number((await db.one(`select value from settings where key = 'content_pack'`)).value), 23, 'content_pack tidak turun');
  await db.query(`update settings set value = '22'::jsonb where key = 'content_pack'`);
  await db.query(`update items set price_pearl = 12, name = 'Ruang Main Anak' where id = 'ruang-main'`);
  await db.query(`update items set price_coin = 180 where id = 'bak-gayung'`);
  await db.query(`update activities set xp = 2, anim = 'gayung' where id = 'mandi-gayung'`);
  invalidateCaches();
});

test('gambar: 18 mebel baru sah di 4 arah (dua dicerminkan, dua tampak belakang) dengan ikon toko', () => {
  const art = [...MANDI2_ART.mandi, ...MANDI2_ART.mutiara, ...MANDI2_ART.khas];
  assert.deepEqual(art.slice().sort(), FURN.map((i) => i.art.key).sort(), 'tiap mebel punya gambar sendiri');
  const cat = builtinCatalog();
  for (const it of FURN) {
    assert.ok(cat.furniture.some((f) => f.key === it.art.key), `${it.art.key} terdaftar untuk admin`);
    assert.equal(rotSteps(it as any), 4, `${it.id}: 4 arah`);
    const out = [0, 1, 2, 3].map((r) => draw(it.id, r));
    out.forEach((svg, r) => assert.ok(wellFormed(svg), `${it.id} arah ${r}: SVG sah`));
    assert.ok(!out[0].includes('class="rot"') && out[1].includes('class="rot"') && out[3].includes('class="rot"'), `${it.id}: arah 1 & 3 dicerminkan`);
    assert.ok(out[2].includes('class="back"') && out[3].includes('class="back"'), `${it.id}: arah 2 & 3 tampak belakang`);
    assert.ok(furnOnly(out[0]).length > 800 && furnOnly(out[2]).length > 600, `${it.id}: gambar tidak kosong`);
    const icon = itemIcon(it as any);
    assert.ok(wellFormed(icon) && icon.length > 500, `${it.id}: ikon toko`);
    assert.ok(wellFormed(renderRoom({ size: 8, layout: [{ i: it.id, x: 2, y: 2, r: 3 }], items: ITEMS } as any)), `${it.id}: ruang 8×8`);
    assert.ok(wellFormed(renderRoom({ size: 4, layout: [{ i: it.id, x: 0, y: 0, r: 2 }], items: ITEMS, edit: true, sel: 0 } as any)), `${it.id}: mode atur`);
  }
  // hiasan sisi depan karaoke (corong speaker berwarna aksen) tidak terlihat dari belakang, layar lirik juga
  const kar = [0, 2].map((r) => furnOnly(draw('mesin-karaoke', r)));
  assert.ok(kar[0].includes('#28307A') && !kar[1].includes('#28307A'), 'layar karaoke hanya dari depan');
});

test('gambar: dinding & lantai baru sah, berpola, terdaftar; ikon ruangan bertema', () => {
  const plain = renderRoom({ size: 6, layout: [], items: {} } as any);
  const decos = SEED_ITEMS_V22.filter((i) => i.kind === 'wallpaper' || i.kind === 'floor');
  assert.equal(decos.length, 14);
  const cat = builtinCatalog();
  for (const it of decos) {
    const key = it.art.key, isWall = it.kind === 'wallpaper';
    assert.ok((isWall ? MANDI2_SURFACES.wallpaper : MANDI2_SURFACES.floor).includes(key), `${key} terdaftar di paket`);
    assert.ok((isWall ? cat.wallpaper : cat.floor).some((w) => w.key === key), `${key} terdaftar untuk admin`);
    const icon = itemIcon(it as any);
    assert.ok(wellFormed(icon) && icon.length > 400, `${it.id}: ikon sah`);
    for (const size of [3, 4, 5, 6, 8]) {
      const room = renderRoom({ size, layout: [], items: {}, ...(isWall ? { wall: it } : { floor: it }) } as any);
      assert.ok(wellFormed(room), `${it.id}: ruang ${size}×${size} sah`);
      if (size === 6) assert.ok(room.length > plain.length + 400, `${it.id}: pola digambar`);
    }
    assert.ok(wellFormed(renderRoom({ size: 5, layout: [], items: {}, edit: true, ...(isWall ? { wall: it } : { floor: it }) } as any)), `${it.id}: mode atur`);
  }
  // dinding akuarium: ikan berenang (ed-swim), lantai disko: bercak lampu berkedip
  assert.ok(renderRoom({ size: 6, layout: [], items: {}, wall: ITEMS['wp-kacaakuarium'] } as any).includes('class="ed-swim"'));
  assert.ok(renderRoom({ size: 6, layout: [], items: {}, floor: ITEMS['fl-lantaidisko'] } as any).includes('class="blink"'));
  // ikon ruangan Mutiara: dinding, lantai & mebel khasnya sendiri (bukan dinding polos bawaan)
  const loteng = itemIcon({ id: 'loteng', kind: 'room', name: 'Loteng', art: { type: 'builtin', key: 'dalam' }, data: { size: 5, theme: 'dalam' } } as any);
  for (const [id] of Object.entries(ROOMS)) {
    const it = ITEMS[id];
    assert.ok(ROOM_KEYS.includes(it.art.key), `${id}: bentuk ikon ${it.art.key}`);
    assert.ok(cat.room.some((r) => r.key === it.art.key), `${id}: bentuk ruangan terdaftar untuk admin`);
    const icon = itemIcon(it as any);
    assert.ok(wellFormed(icon) && icon.length > loteng.length + 2000 && icon !== loteng, `${id}: ikon bertema`);
  }
  // rumah dengan ruangan bertema & mebel khas: urutan gambar sah
  const plan = houseLayout(MANDI2_ROOMS.map((r) => ({ id: r.id, size: r.size })) as any);
  const parts = houseDraws(plan, Object.fromEntries(MANDI2_ROOMS.map((r) => [r.id, { layout: [{ i: r.bonus, x: 1, y: 1 }], wall: ITEMS[r.wall], floor: ITEMS[r.floor] }])) as any, ITEMS);
  assert.ok(parts.filter((p) => p.key.startsWith('f:')).length === 6 && parts.every((p) => wellFormed(p.h)), 'rumah bertema: gambar sah');
});

test('beli enam ruangan Mutiara: Mutiara terpotong, dinding & lantai khusus terpasang, bonus masuk Tas tepat sekali', async () => {
  const { c } = await player('Ruangan', 0, 200);
  let pearl = 200;
  for (const [id, r] of Object.entries(ROOMS)) {
    const it = ITEMS[id];
    // salah mata uang ditolak
    assert.equal((await c.post('/api/shop/buy', { itemId: id, currency: 'coin' })).body.error.code, 'wrong_currency');
    const reqId = `beli-${id}-0001`;
    const res = await c.post('/api/shop/buy', { itemId: id, currency: 'pearl', requestId: reqId });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    pearl -= r.price;
    assert.equal(res.body.wallet.pearl, pearl, `${id}: −${r.price} Mutiara`);
    assert.deepEqual(res.body.bonus, [r.bonus, it.data.wall, it.data.floor], `${id}: bonus di respons`);
    const room = res.body.rooms.find((x: any) => x.item === id);
    assert.ok(room, `${id}: ruangan dibangun`);
    assert.deepEqual([room.size, room.theme, room.wall, room.floor, room.layout.length], [r.size, 'dalam', it.data.wall, it.data.floor, 0], `${id}: ukuran, dinding & lantai khusus`);
    for (const b of [r.bonus, it.data.wall, it.data.floor]) assert.equal(res.body.inventory[b], 1, `${id}: ${b} ×1 di Tas`);
    // requestId sama (klik ganda / sinyal lemah): hasil yang sama, tidak memotong / memberi dua kali
    const again = await c.post('/api/shop/buy', { itemId: id, currency: 'pearl', requestId: reqId });
    assert.equal(again.status, 200);
    assert.deepEqual(again.body.bonus, res.body.bonus);
    // beli lagi (permintaan baru): sudah punya
    const dup = await c.post('/api/shop/buy', { itemId: id, currency: 'pearl', requestId: `beli-${id}-0002` });
    assert.equal(dup.body.error.code, 'owned', `${id}: hanya sekali`);
    const me = (await c.get('/api/me')).body;
    assert.equal(me.wallet.pearl, pearl, `${id}: Mutiara tidak terpotong lagi`);
    for (const b of [r.bonus, it.data.wall, it.data.floor]) assert.equal(me.inventory[b], 1, `${id}: ${b} tetap ×1`);
    assert.equal(me.rooms.filter((x: any) => x.item === id).length, 1);
  }
  const me = (await c.get('/api/me')).body;
  assert.equal(me.rooms.length, 7, 'kamar + 6 ruangan Mutiara');
  // dinding khusus bisa dipasang lagi di ruangan lain setelah diganti (ada di Tas); kembali ke dinding semula juga bisa
  const kamar = me.rooms[0];
  const set = await c.post('/api/room', { roomId: kamar.id, version: kamar.version, layout: kamar.layout, wall: 'wp-balonpastel', floor: 'fl-pasirlaut' });
  assert.equal(set.status, 200, JSON.stringify(set.body));
  const k2 = set.body.rooms[0];
  assert.deepEqual([k2.wall, k2.floor], ['wp-balonpastel', 'fl-pasirlaut']);
  const main = set.body.rooms.find((x: any) => x.item === 'ruang-main');
  const back = await c.post('/api/room', { roomId: main.id, version: main.version, layout: [], wall: 'wp-ubinperahu' });
  assert.equal(back.body.error.code, 'not_owned', 'dinding yang belum dimiliki ditolak');
  const ok = await c.post('/api/room', { roomId: main.id, version: main.version, layout: [], wall: 'wp-balonpastel', floor: 'fl-puzzlebusa' });
  assert.equal(ok.status, 200);
});

test('barang khusus ruangan tidak bisa dibeli, dijual, atau didapat tanpa ruangannya', async () => {
  const { c } = await player('Khusus', 5000, 100);
  for (const id of [...SIGNATURE, 'wp-balonpastel', 'fl-pasirlaut', 'wp-kacaakuarium']) {
    for (const currency of ['coin', 'pearl']) {
      const r = await c.post('/api/shop/buy', { itemId: id, currency });
      assert.equal(r.body.error?.code, 'not_for_sale', `${id} (${currency}): tidak dijual`);
    }
  }
  // dapat lewat ruangan, lalu coba dijual: ditolak
  assert.equal((await c.post('/api/shop/buy', { itemId: 'studio-karaoke', currency: 'pearl' })).status, 200);
  for (const id of ['mesin-karaoke', 'wp-busawarna', 'fl-lantaidisko']) assert.equal((await c.post('/api/shop/sell', { itemId: id })).body.error.code, 'not_sellable', `${id}: tidak bisa dijual`);
  const me = (await c.get('/api/me')).body;
  assert.equal(me.inventory['mesin-karaoke'], 1);
  // barang koin kamar mandi bisa dijual kembali seperti barang lain
  assert.equal((await c.post('/api/shop/buy', { itemId: 'rak-sabun-sampo', currency: 'coin' })).status, 200);
  const sold = await c.post('/api/shop/sell', { itemId: 'rak-sabun-sampo' });
  assert.equal(sold.body.earned, 24);
});

test('batas rumah: bawaan 12 ruangan (semua jenis ruangan), batas admin tetap berlaku; migrasi 031 hanya mengganti nilai lama 6', async () => {
  assert.equal(DEFAULT_SETTINGS.house.maxRooms, 12);
  const types = (await db.query(`select id from items where kind = 'room' and shop is not null and active`)).length;
  assert.equal(types + 1, 12, 'kamar + 11 jenis ruangan = 12');
  const { c } = await player('Rumah Penuh', 10000, 200);
  const rooms = await db.query(`select id, price_coin, price_pearl from items where kind = 'room' and shop is not null order by sort`);
  for (const r of rooms) {
    const res = await c.post('/api/shop/buy', { itemId: r.id, currency: r.price_coin > 0 ? 'coin' : 'pearl' });
    assert.equal(res.status, 200, `${r.id}: ${JSON.stringify(res.body)}`);
  }
  let me = (await c.get('/api/me')).body;
  assert.equal(me.rooms.length, 12, 'rumah 12 ruangan');
  // denah 12 ruangan: tersambung, tidak bertumpuk
  const plan = houseLayout(me.rooms.map((r: any) => ({ id: r.id, size: r.size, theme: r.theme, gx: r.gx, gy: r.gy })));
  assert.equal(plan.rooms.length, 12);
  // batas yang diatur admin (lebih kecil) tetap berlaku
  const { c: c2 } = await player('Rumah Kecil', 10000, 200);
  await db.query(`insert into settings (key, value) values ('game', '{"house":{"maxRooms":3}}'::jsonb) on conflict (key) do update set value = excluded.value`);
  invalidateCaches();
  try {
    assert.equal((await c2.post('/api/shop/buy', { itemId: 'ruang-main', currency: 'pearl' })).status, 200);
    assert.equal((await c2.post('/api/shop/buy', { itemId: 'rumah-pohon', currency: 'pearl' })).status, 200);
    const r = await c2.post('/api/shop/buy', { itemId: 'air-panas', currency: 'pearl' });
    assert.equal(r.body.error.code, 'max_rooms');
    me = (await c2.get('/api/me')).body;
    assert.equal(me.inventory['kolam-air-panas'], undefined, 'ruangan yang ditolak tidak memberi bonus');
    assert.equal(me.wallet.pearl, 200 - 12 - 15, 'Mutiara tidak terpotong untuk ruangan yang ditolak');
    // migrasi 031: 6 (bawaan lama) → 12; angka admin lain tetap
    const sql = readFileSync(new URL('../src/db/migrations/031_rumah_12_ruangan.sql', import.meta.url), 'utf8');
    await db.query(`update settings set value = '{"house":{"maxRooms":6,"maxSize":12}}'::jsonb where key = 'game'`);
    await db.exec(sql);
    assert.deepEqual((await db.one(`select value from settings where key = 'game'`)).value.house, { maxRooms: 12, maxSize: 12 });
    await db.query(`update settings set value = '{"house":{"maxRooms":9}}'::jsonb where key = 'game'`);
    await db.exec(sql);
    assert.equal((await db.one(`select value from settings where key = 'game'`)).value.house.maxRooms, 9);
  } finally {
    await db.query(`delete from settings where key = 'game'`);
    invalidateCaches();
  }
});

test('pakai mebel baru: mandi gayung, shower, keringkan bulu, nyemplung kolam bola, main ayunan ban', async () => {
  const { c } = await player('Mandi', 3000, 100);
  for (const id of ['bak-gayung', 'shower-tirai-ikan', 'pengering-bulu']) assert.equal((await c.post('/api/shop/buy', { itemId: id, currency: 'coin' })).status, 200, id);
  let me = (await c.get('/api/me')).body;
  const room = me.rooms[0];
  // perabot awal kembali ke Tas; ruangan diisi tiga mebel kamar mandi baru (ada yang diputar)
  const lay = [{ i: 'bak-gayung', x: 0, y: 0, r: 2 }, { i: 'shower-tirai-ikan', x: 2, y: 0 }, { i: 'pengering-bulu', x: 4, y: 0, r: 1 }];
  const s = await c.post('/api/room', { roomId: room.id, version: room.version, layout: lay });
  assert.equal(s.status, 200, JSON.stringify(s.body));
  const lay2 = s.body.rooms[0].layout;
  const idx = (id: string) => lay2.findIndex((p: any) => p.i === id);
  await db.query(`update pets set bersih = 20 where user_id = (select user_id from pets where name = 'Mandi')`);
  for (const [act, id, re] of [['mandi-gayung', 'bak-gayung', /gayung/], ['mandi-shower', 'shower-tirai-ikan', /shower/], ['keringkan-bulu', 'pengering-bulu', /bulu/]] as [string, string, RegExp][]) {
    const r = await c.post('/api/activity', { activityId: act, roomId: room.id, index: idx(id) });
    assert.equal(r.status, 200, `${act}: ${JSON.stringify(r.body)}`);
    assert.match(r.body.result.message, re);
    // jeda: langsung lagi ditolak
    assert.ok((await c.post('/api/activity', { activityId: act, roomId: room.id, index: idx(id) })).status >= 400, `${act}: jeda`);
  }
  // aktivitas mebel lain ditolak di bak gayung
  assert.equal((await c.post('/api/activity', { activityId: 'mandi-shower', roomId: room.id, index: idx('bak-gayung') })).status, 400);
  // ruangan Mutiara: mebel khas dari Tas dipasang & dipakai
  const rm = await c.post('/api/shop/buy', { itemId: 'ruang-main', currency: 'pearl' });
  const main = rm.body.rooms.find((x: any) => x.item === 'ruang-main');
  assert.equal((await c.post('/api/room', { roomId: main.id, version: main.version, layout: [{ i: 'kolam-bola', x: 1, y: 1 }] })).status, 200);
  let r = await c.post('/api/activity', { activityId: 'nyemplung-kolam-bola', roomId: main.id, index: 0 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  me = (await c.get('/api/me')).body;
  assert.equal(me.inventory['kolam-bola'] ?? 0, 0, 'kolam bola terpasang (keluar dari Tas)');
  const rp = await c.post('/api/shop/buy', { itemId: 'rumah-pohon', currency: 'pearl' });
  const pohon = rp.body.rooms.find((x: any) => x.item === 'rumah-pohon');
  assert.equal((await c.post('/api/room', { roomId: pohon.id, version: pohon.version, layout: [{ i: 'ayunan-ban', x: 1, y: 2, r: 1 }] })).status, 200);
  r = await c.post('/api/activity', { activityId: 'main-ayunan-ban', roomId: pohon.id, index: 0 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.match(r.body.result.message, /ayunan ban/);
});

test('admin: ubah ruangan Mutiara tetap menyimpan barang bonus; bonus tak dikenal ditolak', async () => {
  const owner = client();
  assert.equal((await owner.post('/api/admin/login', { email: 'owner@test.local', password: 'rahasia-sekali-123' })).status, 200);
  const it = (await owner.get('/api/admin/items')).body.items.find((i: any) => i.id === 'air-panas');
  const body = { ...it, data: { ...it.data } };
  const r = await owner.call('PUT', '/api/admin/items/air-panas', body);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.item.data.bonusItems, ['kolam-air-panas', 'wp-batubambu', 'fl-batusungai']);
  const bad = await owner.call('PUT', '/api/admin/items/air-panas', { ...body, data: { ...body.data, bonusItems: ['tidak-ada'] } });
  assert.equal(bad.body.error.code, 'invalid_bonus');
  const room = await owner.call('PUT', '/api/admin/items/air-panas', { ...body, data: { ...body.data, bonusItems: ['loteng'] } });
  assert.equal(room.body.error.code, 'invalid_bonus', 'ruangan tidak bisa jadi bonus');
  // teks koma dari isian admin juga diterima
  const txt = await owner.call('PUT', '/api/admin/items/air-panas', { ...body, data: { ...body.data, bonusItems: 'kolam-air-panas, wp-batubambu,fl-batusungai' } });
  assert.deepEqual(txt.body.item.data.bonusItems, ['kolam-air-panas', 'wp-batubambu', 'fl-batusungai']);
  invalidateCaches();
});
