// Paket konten 20: perabot dapur & kamar mandi (Mebel Jati) dan benda taman (Toko Bangunan) — item di toko yang benar
// dengan harga koin yang wajar, paket hanya sekali & tidak menimpa ubahan admin, gambar sah di 4 arah (tampak belakang
// tanpa hiasan sisi depan), dinding & lantai baru, aktivitas & tiga animasi baru (ayun, sikat, cuci) beserta
// propertinya, lalu beli-pasang-pakai satu barang dapur, satu kamar mandi, dan satu taman (di halaman).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { config } from '../src/config';
import { ACTIVITY_ANIMS, PERABOT3_ART, PERABOT3_AYUN, PERABOT3_SURFACES, activityFits, builtinCatalog, footprint, itemIcon, petMarkup, renderRoom, rotSteps, houseDraws, houseLayout } from '@kb/shared';

config.paymentProvider = 'mock';
config.adminEmail = 'owner@test.local';
config.adminPassword = 'rahasia-sekali-123';
const { buildApp } = await import('../src/app');
const { SEED_ITEMS_V20, SEED_ACTIVITIES_V20, seedPackV20 } = await import('../src/db/seed-perabot3');
const { invalidateCaches } = await import('../src/lib/core');
let app: any;
let db: any;
before(async () => { ({ app, db } = await buildApp({ memoryDb: true, logger: false, rateLimit: false, worker: false })); });
after(async () => { await app?.close(); });

const ITEMS: Record<string, any> = Object.fromEntries(SEED_ITEMS_V20.map((i) => [i.id, i]));
const FURN = SEED_ITEMS_V20.filter((i) => i.kind === 'furniture');
const KEY = (id: string) => ITEMS[id].art.key;
const DAPUR = ['dandang-kukusan', 'penanak-nasi', 'galon-dispenser', 'blender-jus', 'rak-bumbu', 'bak-cuci-piring', 'tempat-sampah-pilah', 'meja-makan-taplak'];
const MANDI = ['wastafel-cermin', 'baskom-bebek', 'ember-gilas', 'mesin-cuci', 'timbangan-badan', 'gantungan-handuk', 'keset-kaki'];
const TAMAN = ['ayunan-kayu', 'hamak-taman', 'meja-piknik', 'bedeng-sayur', 'sangkar-burung', 'bak-pasir', 'tempat-minum-burung', 'gerobak-bunga', 'pagar-tanaman'];

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

test('paket 20: barang baru masuk ke toko yang benar dengan harga koin sekelas barang lama', async () => {
  assert.equal(SEED_ITEMS_V20.length, 29);
  assert.equal(new Set(SEED_ITEMS_V20.map((i) => i.id)).size, SEED_ITEMS_V20.length, 'id unik');
  for (const id of [...DAPUR, ...MANDI]) assert.equal(ITEMS[id]?.shop, 'mebel', `${id} di Mebel Jati`);
  for (const id of TAMAN) assert.equal(ITEMS[id]?.shop, 'bangunan', `${id} di Toko Bangunan`);
  assert.deepEqual(FURN.map((i) => i.id).sort(), [...DAPUR, ...MANDI, ...TAMAN].sort(), '24 mebel');
  const walls = SEED_ITEMS_V20.filter((i) => i.kind === 'wallpaper'), floors = SEED_ITEMS_V20.filter((i) => i.kind === 'floor');
  assert.deepEqual(walls.map((i) => [i.id, i.shop]), [['wp-keramikdapur', 'mebel'], ['wp-keramikbiru', 'mebel']]);
  assert.deepEqual(floors.map((i) => [i.id, i.shop]), [['fl-tegelcatur', 'mebel'], ['fl-mozaik', 'mebel'], ['fl-rumputbunga', 'bangunan']]);
  const rows = await db.query(`select id, kind, shop, price_coin, price_pearl, sell_coin, data, art from items where id = any($1::text[])`, [SEED_ITEMS_V20.map((i) => i.id)]);
  assert.equal(rows.length, SEED_ITEMS_V20.length, 'semua item ada di katalog');
  for (const r of rows) {
    const it = ITEMS[r.id];
    assert.equal(r.shop, it.shop, `${r.id}: toko ${r.shop}`);
    assert.equal(Number(r.price_pearl), 0, `${r.id}: dibeli dengan koin`);
    const p = Number(r.price_coin);
    if (r.kind === 'furniture') {
      assert.ok(p >= 15 && p <= 250, `${r.id}: harga mebel ${p}`);
      assert.ok(r.sell_coin > 0 && r.sell_coin <= Math.ceil(p * 0.4), `${r.id}: harga jual ${r.sell_coin} ≤ 40% harga`);
      assert.ok(r.data.w >= 1 && r.data.w <= 2 && r.data.d >= 1 && r.data.d <= 2, `${r.id}: ukuran ${r.data.w}×${r.data.d}`);
      assert.ok(!r.data.set && !r.data.edisi, `${r.id}: bukan item set premium / edisi`);
    } else assert.ok(p >= 60 && p <= 120 && r.sell_coin === 0, `${r.id}: harga dinding/lantai ${p}`);
  }
  // ukuran yang disetujui: meja makan, meja piknik & bak pasir 2×2; hamak, bedeng & pagar 2×1; keset datar
  for (const id of ['meja-makan-taplak', 'meja-piknik', 'bak-pasir']) assert.deepEqual([ITEMS[id].data.w, ITEMS[id].data.d], [2, 2], id);
  for (const id of ['hamak-taman', 'bedeng-sayur', 'pagar-tanaman']) assert.deepEqual([ITEMS[id].data.w, ITEMS[id].data.d], [2, 1], id);
  assert.deepEqual(FURN.filter((i) => i.data.flat).map((i) => i.id), ['keset-kaki'], 'hanya keset yang bisa dilewati');
  // katalog pemain memuat semuanya
  const cat = JSON.parse((await app.inject({ method: 'GET', url: '/api/catalog' })).body);
  for (const id of Object.keys(ITEMS)) assert.ok(cat.items.some((i: any) => i.id === id && i.shop === ITEMS[id].shop), `${id} di /api/catalog`);
  for (const a of SEED_ACTIVITIES_V20) assert.ok(cat.activities.some((x: any) => x.id === a.id), `${a.id} di /api/catalog`);
});

test('paket 20: aktivitas memakai animasi yang ada, menunjuk mebel baru, hadiah & jeda wajar', async () => {
  const acts = await db.query(`select id, targets, anim, effects, xp, coins, reward_item, cooldown_sec, daily_limit from activities where id = any($1::text[])`, [SEED_ACTIVITIES_V20.map((a) => a.id)]);
  assert.equal(acts.length, SEED_ACTIVITIES_V20.length);
  const keys = new Set(FURN.map((i) => 'art:' + i.art.key));
  for (const a of acts) {
    assert.ok(ACTIVITY_ANIMS[a.anim], `${a.id}: animasi ${a.anim} ada`);
    assert.ok(a.targets.length === 1 && keys.has(a.targets[0]), `${a.id}: target ${a.targets} = mebel baru`);
    const it = FURN.find((i) => 'art:' + i.art.key === a.targets[0])!;
    assert.ok(activityFits(a.targets, it as any), `${a.id}: cocok dengan ${it.id}`);
    assert.ok(a.xp >= 1 && a.xp <= 4, `${a.id}: XP ${a.xp}`);
    assert.ok(a.cooldown_sec >= 300 && a.cooldown_sec <= 1800, `${a.id}: jeda ${a.cooldown_sec}`);
    for (const v of Object.values(a.effects as Record<string, number>)) assert.ok(Math.abs(v) <= 15 && v !== 0, `${a.id}: efek wajar`);
    assert.ok(a.coins >= 0 && a.coins <= 2, `${a.id}: koin ${a.coins}`);
    // batas harian hanya untuk aktivitas yang memberi barang / mengenyangkan
    if (a.daily_limit) assert.ok(a.reward_item || (a.effects.kenyang ?? 0) > 0, `${a.id}: batas harian ${a.daily_limit}`);
  }
  const by = Object.fromEntries(acts.map((a: any) => [a.targets[0].slice(4), a]));
  const anim = (id: string) => by[KEY(id)].anim;
  assert.deepEqual(['dandang-kukusan', 'penanak-nasi', 'galon-dispenser', 'blender-jus', 'rak-bumbu', 'bak-cuci-piring', 'tempat-sampah-pilah', 'meja-makan-taplak'].map(anim), ['masak', 'lihat', 'kopi', 'masak', 'masak', 'cuci', 'lihat', 'duduk']);
  assert.deepEqual(['wastafel-cermin', 'baskom-bebek', 'ember-gilas', 'mesin-cuci', 'timbangan-badan', 'gantungan-handuk', 'keset-kaki'].map(anim), ['sikat', 'mandi', 'cuci', 'lihat', 'lihat', 'lihat', 'lihat']);
  assert.deepEqual(['ayunan-kayu', 'hamak-taman', 'meja-piknik', 'bedeng-sayur', 'sangkar-burung', 'bak-pasir', 'tempat-minum-burung', 'gerobak-bunga'].map(anim), ['ayun', 'tidur', 'duduk', 'siram', 'musik', 'main', 'lihat', 'siram']);
  // kukus kue lapis: hadiah kue lapis (makanan lama), 30 menit, 3× sehari
  const kk = by.dandang;
  assert.deepEqual([kk.reward_item, kk.cooldown_sec, kk.daily_limit], ['kue-lapis', 1800, 3]);
  assert.ok(await db.one(`select 1 from items where id = 'kue-lapis' and kind = 'food'`), 'kue lapis ada');
  // main pasir: ceria besar tapi jadi kotor
  assert.ok(by.bakpasir.effects.ceria >= 12 && by.bakpasir.effects.bersih < 0);
  // hanya pagar tanaman yang tanpa aktivitas (hiasan)
  const without = FURN.filter((i) => !acts.some((a: any) => a.targets.includes('art:' + i.art.key))).map((i) => i.id);
  assert.deepEqual(without, ['pagar-tanaman']);
  const all = await db.query(`select id from activities`);
  assert.equal(new Set(all.map((a: any) => a.id)).size, all.length, 'id aktivitas unik');
});

test('animasi baru ayun, sikat, cuci: lengkap dengan properti & efek; ayunan sejajar dengan palang', () => {
  const FX = ['hearts', 'bubbles', 'coins', 'zz', 'food', 'sparkle', 'drops', 'notes', 'steam'];
  for (const k of ['ayun', 'sikat', 'cuci']) {
    const a = ACTIVITY_ANIMS[k];
    assert.ok(a && a.label && a.ms >= 2000 && a.ms <= 4000 && FX.includes(a.fx), `${k}: label, durasi, efek`);
    assert.equal(a.prop, k, `${k}: properti sendiri`);
    const m = petMarkup({ look: { color: '#F6B7A8', ear: 'kucing' } as any, wear: [], prop: k });
    assert.ok(wellFormed(m) && m.includes(`class="p-${k}"`), `${k}: properti digambar (p-${k})`);
  }
  assert.equal(ACTIVITY_ANIMS.ayun.on, true);
  assert.equal(ACTIVITY_ANIMS.sikat.fx, 'bubbles');
  assert.equal(ACTIVITY_ANIMS.cuci.fx, 'bubbles');
  // pet duduk tepat di dudukan Ayunan Kayu; titik putar pose ayun = palang (px lokal pet = px petak × 34/32 ÷ 0,82)
  assert.equal(ACTIVITY_ANIMS.ayun.lift, PERABOT3_AYUN.seat);
  assert.equal(PERABOT3_AYUN.pivot, Math.round(((PERABOT3_AYUN.bar - PERABOT3_AYUN.seat) * 34) / 32 / 0.82));
  assert.equal(PERABOT3_AYUN.pivot, 109);
  const css = readFileSync(new URL('../../game/src/app.css', import.meta.url), 'utf8');
  assert.ok(css.includes(`.pose-ayun:has(.p-ayun) > .pet-hop { transform-box: view-box; transform-origin: 0px -${PERABOT3_AYUN.pivot}px;`), 'CSS game memakai titik putar yang sama');
  for (const k of ['ayun', 'sikat', 'gosok', 'busa', 'cuci', 'spons']) assert.ok(css.includes(`@keyframes p3-${k} `), `CSS: keyframes p3-${k}`);
  const reduceBlock = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
  const kurangi = css.slice(css.lastIndexOf('/* Pengaturan › Kurangi animasi'));
  for (const sel of ['> .pet-hop', '.ayk-ayun', '.pose-sikat', '.pose-cuci']) {
    assert.ok(reduceBlock.includes(sel), `CSS: ${sel} diam dengan prefers-reduced-motion`);
    assert.ok(kurangi.includes(`:root.reduce-motion`) && kurangi.includes(sel), `CSS: ${sel} diam dengan Kurangi animasi`);
  }
  // tali & dudukan milik mebel (di belakang pet) ikut berayun dari titik tengah palang, di keempat arah
  const ac = renderRoom({ size: 3, layout: [{ i: 'ayunan-kayu', x: 0, y: 1 }], items: ITEMS, theme: 'luar' } as any);
  const bar = /class="ayk-ayun" style="transform-origin:([\d.-]+)px ([\d.-]+)px"/.exec(ac);
  assert.ok(bar, 'dudukan ayunan punya titik putar');
  const t = Math.round((34 * 6) / 3), iso = [400 + (1 - 1.5) * t, 150 + (1 + 1.5) * (t / 2) - PERABOT3_AYUN.bar * (t / 32)];
  assert.ok(Math.abs(Number(bar![1]) - iso[0]) < 0.2 && Math.abs(Number(bar![2]) - iso[1]) < 0.2, `titik putar = tengah palang (${bar![1]}, ${bar![2]})`);
  for (const r of [0, 1, 2, 3]) assert.ok(/class="ayk-ayun" style="transform-origin:/.test(furnOnly(draw('ayunan-kayu', r))), `ayunan arah ${r}`);
  // animasi lama tidak berubah
  assert.deepEqual([ACTIVITY_ANIMS.duduk.lift, ACTIVITY_ANIMS.tidur.lift, ACTIVITY_ANIMS.mandi.lift, ACTIVITY_ANIMS.kopi.prop], [14, 22, 6, 'cangkir']);
});

test('paket 20: hanya sekali, dan tidak menimpa ubahan admin bila dijalankan ulang', async () => {
  assert.equal(await seedPackV20(db), false, 'sudah dijalankan saat server mulai');
  assert.ok(Number((await db.one(`select value from settings where key = 'content_pack'`)).value) >= 20);
  assert.ok(await db.one(`select 1 from settings where key = 'pack_perabot3'`));
  await db.query(`update items set price_coin = 999, name = 'Mesin Admin' where id = 'mesin-cuci'`);
  await db.query(`update activities set xp = 9, anim = 'lihat' where id = 'main-ayunan-kayu'`);
  await db.query(`delete from items where id = 'pagar-tanaman'`);
  await db.query(`delete from settings where key = 'pack_perabot3'`);
  const ver = Number((await db.one(`select value from settings where key = 'catalog_version'`))?.value ?? 0);
  assert.equal(await seedPackV20(db), true);
  const it = await db.one(`select price_coin, name from items where id = 'mesin-cuci'`);
  assert.deepEqual([it.price_coin, it.name], [999, 'Mesin Admin'], 'ubahan admin tetap');
  const a = await db.one(`select xp, anim from activities where id = 'main-ayunan-kayu'`);
  assert.deepEqual([a.xp, a.anim], [9, 'lihat']);
  assert.ok(await db.one(`select 1 from items where id = 'pagar-tanaman'`), 'item yang hilang ditambahkan lagi');
  assert.ok(Number((await db.one(`select value from settings where key = 'catalog_version'`)).value) > ver, 'versi katalog naik');
  assert.equal(await seedPackV20(db), false);
  // angka content_pack tidak turun bila paket yang lebih baru sudah jalan
  await db.query(`update settings set value = '21'::jsonb where key = 'content_pack'`);
  await db.query(`delete from settings where key = 'pack_perabot3'`);
  await seedPackV20(db);
  assert.equal(Number((await db.one(`select value from settings where key = 'content_pack'`)).value), 21);
  await db.query(`update settings set value = '20'::jsonb where key = 'content_pack'`);
  await db.query(`update items set price_coin = 190, name = 'Mesin Cuci' where id = 'mesin-cuci'`);
  await db.query(`update activities set xp = 2, anim = 'ayun' where id = 'main-ayunan-kayu'`);
  invalidateCaches();
});

test('gambar: semua mebel baru sah di 4 arah (tanpa NaN), dua arah dicerminkan, dua arah tampak belakang', () => {
  const art = [...PERABOT3_ART.dapur, ...PERABOT3_ART.mandi, ...PERABOT3_ART.taman];
  assert.deepEqual(art.slice().sort(), FURN.map((i) => i.art.key).sort(), 'tiap mebel punya gambar sendiri');
  assert.deepEqual(PERABOT3_ART.dapur, DAPUR.map(KEY));
  assert.deepEqual(PERABOT3_ART.mandi, MANDI.map(KEY));
  assert.deepEqual(PERABOT3_ART.taman, TAMAN.map(KEY));
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
    // ruang besar, mode atur
    assert.ok(wellFormed(renderRoom({ size: 8, layout: [{ i: it.id, x: 2, y: 2, r: 3 }], items: ITEMS } as any)), `${it.id}: ruang 8×8`);
    assert.ok(wellFormed(renderRoom({ size: 4, layout: [{ i: it.id, x: 0, y: 0, r: 2 }], items: ITEMS, edit: true, sel: 0 } as any)), `${it.id}: mode atur`);
  }
  // rumah tersambung (dapur + kamar mandi + halaman): urutan gambar tetap sah
  const plan = houseLayout([{ id: 'r1', size: 5 }, { id: 'r2', size: 4 }, { id: 'r3', size: 7, theme: 'luar' }] as any);
  const parts = houseDraws(plan, {
    r1: { layout: [{ i: 'meja-makan-taplak', x: 1, y: 1, r: 2 }, { i: 'bak-cuci-piring', x: 0, y: 4, r: 3 }, { i: 'dandang-kukusan', x: 4, y: 0 }], wall: ITEMS['wp-keramikdapur'], floor: ITEMS['fl-tegelcatur'] },
    r2: { layout: [{ i: 'mesin-cuci', x: 0, y: 0, r: 1 }, { i: 'keset-kaki', x: 2, y: 2 }, { i: 'wastafel-cermin', x: 3, y: 0, r: 2 }], wall: ITEMS['wp-keramikbiru'], floor: ITEMS['fl-mozaik'] },
    r3: { layout: [{ i: 'ayunan-kayu', x: 0, y: 0, r: 1 }, { i: 'bak-pasir', x: 3, y: 3, r: 2 }, { i: 'pagar-tanaman', x: 5, y: 6 }], floor: ITEMS['fl-rumputbunga'] },
  } as any, ITEMS);
  assert.ok(parts.filter((p) => p.key.startsWith('f:')).length >= 8 && parts.every((p) => wellFormed(p.h)), 'rumah tersambung: gambar sah');
});

test('gambar: tampak belakang tidak menampilkan hiasan sisi depan, isi atas tetap terlihat', () => {
  const has = (id: string, r: number, s: string) => furnOnly(draw(id, r)).includes(s);
  const frontOnly = (id: string, sig: string) => {
    assert.ok(has(id, 0, sig) && has(id, 1, sig), `${id}: ${sig} terlihat dari depan`);
    assert.ok(!has(id, 2, sig) && !has(id, 3, sig), `${id}: ${sig} tidak terlihat dari belakang`);
  };
  // mesin cuci: pintu & drum berputar hanya dari depan; dari belakang selang
  frontOnly('mesin-cuci', 'class="swim"');
  assert.ok(has('mesin-cuci', 2, '#5E6878') && has('mesin-cuci', 2, 'stroke-linecap="round"'), 'mesin cuci: selang & kisi dari belakang');
  // wastafel: kaca cermin dari depan, papan polos dari belakang; mangkuk wastafel terlihat dari dua sisi
  frontOnly('wastafel-cermin', '#BFE3F5');
  assert.ok(has('wastafel-cermin', 2, '#DDEFF5'));
  // dispenser: keran merah & gelas dari depan; galon biru terlihat dari dua sisi
  frontOnly('galon-dispenser', '#E0583F');
  assert.ok(has('galon-dispenser', 2, '#5BB6E8'));
  // tempat sampah: lambang daun & botol hanya di depan
  frontOnly('tempat-sampah-pilah', '#FFFDF7');
  // timbangan: pita warna pengukur tinggi hanya di depan; jendela jarum di atas timbangan terlihat dari dua sisi
  frontOnly('timbangan-badan', '#F7D038');
  assert.ok(has('timbangan-badan', 2, '#FFFDF7'));
  // penanak nasi & blender: lampu / tombol di muka depan
  frontOnly('penanak-nasi', '#6BCB77');
  frontOnly('blender-jus', '#6BCB77');
  // papan gilas: seng bergerigi dari depan, punggung papan dari belakang
  frontOnly('ember-gilas', '#AEB7C4');
  // gantungan handuk & jemuran handuk: terlihat dari dua sisi
  for (const r of [0, 2]) assert.ok(has('gantungan-handuk', r, '#7FC4E8') && has('gantungan-handuk', r, '#F7A8C4'), `gantungan handuk arah ${r}`);
  // meja makan: taplak kotak-kotak terlihat dari semua arah
  for (const r of [0, 1, 2, 3]) assert.ok(has('meja-makan-taplak', r, '#D6402E'), `taplak arah ${r}`);
});

test('gambar: dinding & lantai baru sah, berpola, dan terdaftar', () => {
  const plain = renderRoom({ size: 6, layout: [], items: {} } as any) + renderRoom({ size: 6, layout: [], items: {}, theme: 'luar' } as any);
  const SIG: Record<string, string> = { 'wp-keramikdapur': '#F7E7B4', 'wp-keramikbiru': '#FFFFFF" stroke-width="2" stroke-linecap="round"', 'fl-tegelcatur': '#2E3242', 'fl-mozaik': '#F4F8FA', 'fl-rumputbunga': '#C9A0E8' };
  for (const it of SEED_ITEMS_V20.filter((i) => i.kind !== 'furniture')) {
    const icon = itemIcon(it as any);
    assert.ok(wellFormed(icon) && icon.length > 400, `${it.id}: ikon sah`);
    for (const size of [3, 4, 5, 6, 7]) {
      const room = renderRoom({ size, layout: [], items: {}, ...(it.kind === 'floor' ? { floor: it } : { wall: it }), theme: it.shop === 'bangunan' ? 'luar' : undefined } as any);
      assert.ok(wellFormed(room), `${it.id}: ruang ${size}×${size} sah`);
      if (size === 6) assert.ok(room.includes(SIG[it.id]) && !plain.includes(SIG[it.id]), `${it.id}: pola digambar`);
    }
    assert.ok(wellFormed(renderRoom({ size: 5, layout: [], items: {}, edit: true, ...(it.kind === 'floor' ? { floor: it } : { wall: it }) } as any)), `${it.id}: mode atur sah`);
  }
  const cat = builtinCatalog();
  for (const k of PERABOT3_SURFACES.wallpaper) assert.ok(cat.wallpaper.some((w) => w.key === k), `dinding ${k} terdaftar`);
  for (const k of PERABOT3_SURFACES.floor) assert.ok(cat.floor.some((w) => w.key === k), `lantai ${k} terdaftar`);
  // pola lama tidak berubah: dinding & lantai lain tidak memakai warna pola baru
  assert.ok(!renderRoom({ size: 6, layout: [], items: {}, floor: { art: { type: 'builtin', key: 'tegel' } } } as any).includes('#2E3242'));
});

test('beli, pasang & pakai: wastafel (sikat gigi), dandang (kue lapis), ayunan di halaman (main ayunan)', async () => {
  const c = client();
  await c.post('/api/auth/guest');
  assert.equal((await c.post('/api/pet', { name: 'Lapis', color: '#F6B7A8', ear: 'kucing' })).status, 200);
  let me = (await c.get('/api/me')).body;
  await db.query(`update wallets set coin = 4000 where user_id = $1`, [me.user.id]);
  // salah mata uang ditolak
  assert.equal((await c.post('/api/shop/buy', { itemId: 'mesin-cuci', currency: 'pearl' })).body.error.code, 'wrong_currency');
  // Mebel Jati: wastafel, dandang, keset, lantai mozaik
  let coin = 4000;
  for (const id of ['wastafel-cermin', 'dandang-kukusan', 'keset-kaki', 'fl-mozaik']) {
    const r = await c.post('/api/shop/buy', { itemId: id, currency: 'coin' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    coin -= ITEMS[id].price_coin;
    assert.equal(r.body.wallet.coin, coin, `${id}: −${ITEMS[id].price_coin} koin`);
  }
  me = (await c.get('/api/me')).body;
  let room = (me.rooms ?? [me.room])[0];
  // keset datar boleh di depan wastafel (petak yang dilalui pet); wastafel diputar membelakangi
  const lay = [...room.layout, { i: 'wastafel-cermin', x: 1, y: 0, r: 2 }, { i: 'dandang-kukusan', x: 3, y: 0, r: 1 }, { i: 'keset-kaki', x: 1, y: 1 }];
  const s = await c.post('/api/room', { roomId: room.id || undefined, version: room.version, floor: 'fl-mozaik', layout: lay });
  assert.equal(s.status, 200, JSON.stringify(s.body));
  me = (await c.get('/api/me')).body;
  room = (me.rooms ?? [me.room])[0];
  assert.equal(room.floor, 'fl-mozaik');
  const wi = room.layout.findIndex((p: any) => p.i === 'wastafel-cermin'), di = room.layout.findIndex((p: any) => p.i === 'dandang-kukusan');
  assert.equal(room.layout[wi].r, 2);
  let act = await c.post('/api/activity', { activityId: 'sikat-gigi', roomId: room.id || undefined, index: wi });
  assert.equal(act.status, 200, JSON.stringify(act.body));
  assert.match(act.body.result.message, /sikat gigi/);
  // aktivitas mebel lain ditolak di wastafel
  assert.equal((await c.post('/api/activity', { activityId: 'cuci-baju', roomId: room.id || undefined, index: wi })).status, 400);
  // kukus kue lapis: dapat Kue Lapis di Tas
  const before = me.inventory?.['kue-lapis'] ?? 0;
  act = await c.post('/api/activity', { activityId: 'kukus-kue-lapis', roomId: room.id || undefined, index: di });
  assert.equal(act.status, 200, JSON.stringify(act.body));
  me = (await c.get('/api/me')).body;
  assert.equal(me.inventory?.['kue-lapis'] ?? 0, before + 1, 'kue lapis masuk Tas');
  // jeda: langsung mengukus lagi ditolak
  assert.ok((await c.post('/api/activity', { activityId: 'kukus-kue-lapis', roomId: room.id || undefined, index: di })).status >= 400);
  // Toko Bangunan: halaman, ayunan kayu, lantai rumput berbunga; main ayunan
  let r = await c.post('/api/shop/buy', { itemId: 'halaman', currency: 'coin' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  for (const id of ['ayunan-kayu', 'pagar-tanaman', 'fl-rumputbunga']) assert.equal((await c.post('/api/shop/buy', { itemId: id, currency: 'coin' })).status, 200, id);
  me = (await c.get('/api/me')).body;
  const yard = me.rooms.find((x: any) => x.item === 'halaman');
  assert.ok(yard, 'halaman dibangun');
  const ys = await c.post('/api/room', { roomId: yard.id, version: yard.version, floor: 'fl-rumputbunga', layout: [{ i: 'ayunan-kayu', x: 2, y: 2, r: 3 }, { i: 'pagar-tanaman', x: 0, y: 6 }] });
  assert.equal(ys.status, 200, JSON.stringify(ys.body));
  me = (await c.get('/api/me')).body;
  const y2 = me.rooms.find((x: any) => x.item === 'halaman');
  assert.equal(y2.floor, 'fl-rumputbunga');
  assert.deepEqual(y2.layout[0], { i: 'ayunan-kayu', x: 2, y: 2, r: 3 });
  act = await c.post('/api/activity', { activityId: 'main-ayunan-kayu', roomId: y2.id, index: 0 });
  assert.equal(act.status, 200, JSON.stringify(act.body));
  assert.match(act.body.result.message, /main ayunan/);
  // pagar tanaman: hiasan, tanpa aktivitas
  assert.equal((await c.post('/api/activity', { activityId: 'main-ayunan-kayu', roomId: y2.id, index: 1 })).status, 400);
  // ayunan 2×1 diputar = 1×2: tidak boleh bertabrakan dengan mebel lain
  assert.equal((await c.post('/api/room', { roomId: y2.id, version: y2.version, layout: [...y2.layout, { i: 'pagar-tanaman', x: 2, y: 3 }] })).status, 400);
});
