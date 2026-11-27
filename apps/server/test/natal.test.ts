// Sahabat Edisi Natal (paket konten 24): Beruang Es & Rusa Kutup — item jenis sahabat 25 Mutiara di Toko Mutiara (tab
// Edisi Spesial, data.edisi = 2 "Edisi Natal") & Pondok Sahabat; masa jual = jadwal jual item (bawaan sampai 6 Januari
// 2027 23.59 WIB, diatur admin); beli di dalam masa jual (aman requestId), ditolak di luarnya dengan pesan ramah, pemilik
// tetap menyimpannya; satu sahabat aktif; sahabat besar tidak pernah naik ke kepala pet (bantal / di samping); aturan Album;
// oleh-oleh; lencana Kawan Satwa; terlihat pemain lain; gambar & CSS efek ringan yang diam saat gerak dikurangi.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { config } from '../src/config';

config.paymentProvider = 'mock';
config.adminEmail = 'owner@test.local';
config.adminPassword = 'rahasia-sekali-123';
const { buildApp } = await import('../src/app');
const { invalidateCaches, getCatalog, purchasable } = await import('../src/lib/core');
const { setSahabatRandom } = await import('../src/lib/sahabat');
const { SAHABAT_ITEMS } = await import('../src/db/seed-sahabat');
const { seedPackV24, NATAL_ITEMS } = await import('../src/db/seed-natal');
const {
  DEFAULT_SETTINGS, SAHABAT_SPECIES, SAHABAT_INFO, SAHABAT_NATAL, SAHABAT_BIASA, EDISI_NATAL, SAHABAT_GIFTS, albumSections, buddyRestPose,
  buddyMarkup, buddyIcon, itemIcon, buddyScale, isEdisi, edisiBadge, edisiLabel, levelSub, tanggalWIB, checkSahabat,
} = await import('@kb/shared');
let app: any;
let db: any;
before(async () => { ({ app, db } = await buildApp({ memoryDb: true, logger: false, rateLimit: false, worker: false })); });
after(async () => app?.close());
beforeEach(async () => { setSahabatRandom(() => Math.random()); await setWindow(null, EDISI_NATAL.until); });

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
  return { call, get: (u: string) => call('GET', u), post: (u: string, b?: unknown) => call('POST', u, b ?? {}), put: (u: string, b?: unknown) => call('PUT', u, b ?? {}) };
}
type P = { c: ReturnType<typeof client>; id: string; code: string };
async function player(pet: string, coins = 0, pearls = 0): Promise<P> {
  const c = client();
  await c.post('/api/auth/guest');
  const p = await c.post('/api/pet', { name: pet, color: '#F6B7A8', ear: 'kucing' });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  const id = p.body.state.user.id as string;
  await db.query(`update wallets set coin = $2, pearl = $3 where user_id = $1`, [id, coins, pearls]);
  return { c, id, code: p.body.state.user.friend_code };
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
/** masa jual kedua sahabat Edisi Natal (langsung di database) */
async function setWindow(from: string | null, to: string | null) {
  if (!db) return;
  await db.query(`update items set available_from = $1, available_to = $2 where id = any($3::text[])`, [from, to, NATAL_ITEMS.map((i) => i.id)]);
  invalidateCaches();
}
const rid = () => 'r-' + Math.random().toString(36).slice(2, 12);
const pearls = async (p: P) => (await db.one(`select pearl from wallets where user_id = $1`, [p.id])).pearl as number;
const qty = async (p: P, item: string) => (await db.one(`select qty from inventory where user_id = $1 and item_id = $2`, [p.id, item]))?.qty ?? 0;
const state = async (p: P) => (await p.c.get('/api/sahabat')).body.sahabat;
const buy = (p: P, itemId: string, currency = 'pearl', extra: Record<string, unknown> = {}) => p.c.post('/api/shop/buy', { itemId, currency, requestId: rid(), ...extra });
const ayam = async (p: P, name = 'Ciko') => { const r = await p.c.post('/api/sahabat/ayam', { name, requestId: rid() }); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body.buddy; };
const past = () => new Date(Date.now() - 60_000).toISOString();
const later = (days = 3) => new Date(Date.now() + days * 86_400_000).toISOString();
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
const count = (s: string, sub: string) => s.split(sub).length - 1;
/** gambar yang tampil (tanpa frame trik tersembunyi: elemen di dalam display none tidak dianimasikan) */
function shown(svg: string) {
  const at = svg.indexOf('<g class="b-t" display="none">');
  if (at < 0) return svg;
  let depth = 0;
  for (const m of svg.slice(at).matchAll(/<(\/?)g\b[^>]*?(\/?)>/g)) {
    if (m[2]) continue;
    depth += m[1] ? -1 : 1;
    if (!depth) return svg.slice(0, at) + svg.slice(at + m.index! + m[0].length);
  }
  return svg;
}

test('paket 24: dua sahabat Edisi Natal di Toko Mutiara, 25 Mutiara, dijual sampai 6 Januari 2027 23.59 WIB', async () => {
  assert.deepEqual(SAHABAT_NATAL, ['beruang', 'rusa']);
  assert.equal(SAHABAT_BIASA.length, 9);
  assert.equal(SAHABAT_SPECIES.length, 11);
  assert.equal(SAHABAT_ITEMS.length, 11, 'paket 23 tetap 9 sahabat + camilan + kerang');
  const cat = (await client().get('/api/catalog')).body;
  for (const sp of SAHABAT_NATAL) {
    const it = cat.items.find((i: any) => i.id === SAHABAT_INFO[sp].item);
    assert.ok(it, sp);
    assert.deepEqual([it.kind, it.price_pearl, it.price_coin, it.shop], ['sahabat', 25, 0, 'mutiara'], sp);
    assert.deepEqual([it.data.sp, it.data.how, it.data.edisi, it.data.edisiNama], [sp, 'edisi', 2, 'Edisi Natal'], sp);
    assert.ok(isEdisi(it) && edisiBadge(it) === '✦ Edisi Natal' && edisiLabel(it) === 'Edisi Natal');
    assert.equal(new Date(it.available_to).toISOString(), '2027-01-06T16:59:59.000Z', `${sp}: sampai 6 Januari 2027 23.59.59 WIB`);
    assert.equal(it.available_from, null, `${sp}: dijual sejak dipasang`);
    assert.ok(SAHABAT_INFO[sp].big! >= 1.5 && SAHABAT_INFO[sp].big! <= 1.7, `${sp}: ±1,6× sahabat biasa`);
  }
  assert.equal(tanggalWIB(EDISI_NATAL.until), '6 Januari');
  assert.equal(tanggalWIB(EDISI_NATAL.until, true), '6 Januari 2027');
  assert.ok(Number((await db.one(`select value from settings where key = 'content_pack'`)).value) >= 24);
  assert.ok(await db.one(`select 1 from settings where key = 'pack_natal'`));
  assert.equal((await db.one(`select description from quests where id = 'b-sahabat-9'`)).description, 'Punya 9 sahabat mungil.');
  // sekali saja; ubahan admin tidak ditimpa
  assert.equal(await seedPackV24(db), false);
  await db.query(`update items set price_pearl = 30, name = 'Beruang Salju' where id = 'sahabat-beruang'`);
  await db.query(`update quests set description = 'Kumpulkan sembilan!' where id = 'b-sahabat-9'`);
  await db.query(`delete from settings where key = 'pack_natal'`);
  assert.equal(await seedPackV24(db), true);
  const b = await db.one(`select price_pearl, name from items where id = 'sahabat-beruang'`);
  assert.deepEqual([b.price_pearl, b.name], [30, 'Beruang Salju']);
  assert.equal((await db.one(`select description from quests where id = 'b-sahabat-9'`)).description, 'Kumpulkan sembilan!');
  await db.query(`update items set price_pearl = 25, name = 'Beruang Es' where id = 'sahabat-beruang'`);
  await db.query(`update quests set description = 'Punya 9 sahabat mungil.' where id = 'b-sahabat-9'`);
  invalidateCaches();
});

test('beli di dalam masa jual: 25 Mutiara, aman klik ganda (requestId), satu per jenis, hanya dengan Mutiara', async () => {
  const a = await player('Salju', 500, 60);
  await ayam(a);
  const req = rid();
  const r1 = await a.c.post('/api/shop/buy', { itemId: 'sahabat-beruang', currency: 'pearl', requestId: req });
  assert.equal(r1.status, 200, JSON.stringify(r1.body));
  assert.deepEqual([r1.body.buddy.sp, r1.body.buddy.name, r1.body.buddy.active], ['beruang', SAHABAT_INFO.beruang.nama[0], false], 'anak ayam masih aktif');
  assert.equal(await pearls(a), 35);
  const r2 = await a.c.post('/api/shop/buy', { itemId: 'sahabat-beruang', currency: 'pearl', requestId: req });
  assert.equal(r2.status, 200, 'requestId sama: hasil pertama');
  assert.equal(await pearls(a), 35, 'tidak dipotong dua kali');
  assert.equal((await buy(a, 'sahabat-beruang')).body.error.code, 'owned');
  assert.equal((await buy(a, 'sahabat-rusa', 'coin')).body.error.code, 'wrong_currency');
  assert.equal((await buy(a, 'sahabat-rusa', 'pearl', { qty: 2 })).body.error.code, 'invalid');
  const r3 = await buy(a, 'sahabat-rusa', 'pearl', { name: 'Kerlip' });
  assert.equal(r3.status, 200, JSON.stringify(r3.body));
  assert.equal(await pearls(a), 10);
  // Mutiara kurang: ditolak, tidak terpotong
  const b = await player('Tipis', 0, 20);
  assert.equal((await buy(b, 'sahabat-rusa')).body.error.code, 'insufficient_funds');
  assert.equal(await pearls(b), 20);
  // sahabat tidak masuk Tas; tercatat sebagai pembelian
  assert.equal(await qty(a, 'sahabat-rusa'), 0);
  const s = await state(a);
  assert.deepEqual(s.list.map((x: any) => x.sp).sort(), ['ayam', 'beruang', 'rusa']);
  assert.equal((await db.one(`select source from pet_buddies where user_id = $1 and species = 'rusa'`, [a.id])).source, 'beli');
});

test('di luar masa jual: ditolak dengan pesan ramah; pemilik tetap menyimpannya dengan semua kegiatannya', async () => {
  const a = await player('Kerlip', 300, 100);
  assert.equal((await buy(a, 'sahabat-rusa')).status, 200);
  const rusa = (await state(a)).list.find((x: any) => x.sp === 'rusa');
  assert.equal(rusa.active, true, 'sahabat pertama langsung aktif');
  // masa jual berakhir
  await setWindow(null, past());
  const cat = (await client().get('/api/catalog')).body;
  assert.ok(cat.items.some((i: any) => i.id === 'sahabat-beruang'), 'katalog tetap memuat item (gambar & nama untuk pemilik)');
  const r = await buy(a, 'sahabat-beruang');
  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, 'not_for_sale');
  assert.match(r.body.error.message, /Masa jual Beruang Es \(Edisi Natal\) sudah berakhir pada \d+ \w+ \d{4}\. Nantikan edisi berikutnya, ya!/);
  assert.equal(await pearls(a), 75, 'Mutiara tidak berkurang');
  // belum mulai dijual
  await setWindow(later(2), later(30));
  const r2 = await buy(a, 'sahabat-beruang');
  assert.equal(r2.body.error.code, 'not_for_sale');
  assert.match(r2.body.error.message, /Beruang Es \(Edisi Natal\) baru dijual mulai/);
  // pemilik: tetap punya, bisa diajak, main, diberi camilan, membawa oleh-oleh, terlihat pemain lain
  await setWindow(null, past());
  let s = await state(a);
  assert.ok(s.list.some((x: any) => x.sp === 'rusa'));
  assert.equal((await a.c.post('/api/sahabat/aktif', { id: null, requestId: rid() })).status, 200);
  assert.equal((await a.c.post('/api/sahabat/aktif', { id: rusa.id, requestId: rid() })).status, 200);
  const m = await a.c.post('/api/sahabat/main', { id: rusa.id, requestId: rid() });
  assert.equal(m.body.result.counted, true);
  assert.equal((await buy(a, 'camilan-sahabat', 'coin')).status, 200);
  assert.equal((await a.c.post('/api/sahabat/makan', { id: rusa.id, requestId: rid() })).status, 200);
  assert.equal((await a.c.post('/api/sahabat/oleh', { requestId: rid() })).status, 200);
  const b = await player('Teman');
  assert.equal((await b.c.post('/api/friends', { code: a.code })).status, 200);
  const v = await b.c.get(`/api/visit/${a.id}`);
  assert.equal(v.status, 200);
  assert.equal(v.body.pet.buddy?.sp, 'rusa', 'pemain lain melihat Rusa Kutup sesudah masa jual');
  s = await state(a);
  assert.ok(s.list.find((x: any) => x.sp === 'rusa').points > 0);
});

test('admin mengubah masa jual (Item & harga): berlaku langsung, tanda Edisi Natal tidak hilang', async () => {
  const adm = await adminClient();
  const a = await player('Penguji', 0, 100);
  let r = await adminEdit(adm, 'sahabat-beruang', { available_to: past() });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.item.data.edisi, r.body.item.data.edisiNama, r.body.item.data.sp], [2, 'Edisi Natal', 'beruang'], 'data edisi tetap');
  assert.equal((await buy(a, 'sahabat-beruang')).body.error.code, 'not_for_sale');
  // diperpanjang admin: bisa dibeli lagi, katalog membawa batas barunya (hitung mundur kartu)
  const until = later(10);
  r = await adminEdit(adm, 'sahabat-beruang', { available_to: until });
  assert.equal(r.status, 200);
  const cat = (await client().get('/api/catalog')).body;
  assert.equal(new Date(cat.items.find((i: any) => i.id === 'sahabat-beruang').available_to).toISOString(), until);
  assert.equal((await buy(a, 'sahabat-beruang')).status, 200);
  // nama edisi bisa diubah admin; kosong = Edisi Spesial
  r = await adminEdit(adm, 'sahabat-rusa', { data: { sp: 'rusa', how: 'edisi', edisi: 2, edisiNama: '  Edisi Musim Dingin ' } });
  assert.equal(r.body.item.data.edisiNama, 'Edisi Musim Dingin');
  r = await adminEdit(adm, 'sahabat-rusa', { data: { sp: 'rusa', how: 'edisi', edisi: 2, edisiNama: 'x'.repeat(40) } });
  assert.equal(r.status, 400);
  r = await adminEdit(adm, 'sahabat-rusa', { data: { sp: 'rusa', how: 'edisi', edisi: 2, edisiNama: 'Edisi Natal' } });
  assert.equal(r.status, 200);
  assert.equal(edisiBadge(r.body.item), '✦ Edisi Natal');
  // kembali ke bawaan
  await adminEdit(adm, 'sahabat-beruang', { available_to: EDISI_NATAL.until });
});

test('satu sahabat aktif: sahabat Edisi Natal ikut aturan yang sama', async () => {
  const a = await player('Aktif', 0, 100);
  const ay = await ayam(a);
  assert.equal((await buy(a, 'sahabat-rusa')).status, 200);
  assert.equal((await buy(a, 'sahabat-beruang')).status, 200);
  let s = await state(a);
  assert.deepEqual(s.list.filter((x: any) => x.active).map((x: any) => x.sp), ['ayam'], 'sahabat baru istirahat bila sudah ada yang aktif');
  const be = s.list.find((x: any) => x.sp === 'beruang');
  assert.equal((await a.c.post('/api/sahabat/aktif', { id: be.id, requestId: rid() })).status, 200);
  s = await state(a);
  assert.deepEqual(s.list.filter((x: any) => x.active).map((x: any) => x.sp), ['beruang']);
  assert.equal(s.list.find((x: any) => x.id === ay.id).active, false);
  assert.equal((await db.one(`select count(*)::int c from pet_buddies where user_id = $1 and active`, [a.id])).c, 1);
  // pemain lain melihat sahabat aktifnya; yang istirahat tampil di rumahnya
  const b = await player('Tamu');
  await b.c.post('/api/friends', { code: a.code });
  const v = await b.c.get(`/api/visit/${a.id}`);
  assert.deepEqual([v.body.pet.buddy?.sp, v.body.pet.buddy?.lvl], ['beruang', 0]);
  assert.deepEqual(v.body.resting.map((x: any) => x.sp).sort(), ['ayam', 'rusa']);
});

test('sahabat besar tidak pernah naik ke kepala pet: Beruang Es jadi bantal, Rusa Kutup berdiri di samping', () => {
  for (const sp of SAHABAT_NATAL) {
    for (const lvl of [0, 1, 2]) for (const pose of [null, 'tidur', 'duduk', 'mandi', 'makan']) for (const moving of [false, true]) {
      assert.notEqual(buddyRestPose(sp, lvl, pose, moving), 'head', `${sp} lvl ${lvl} pose ${pose}`);
    }
    // Kenal: tetap di lantai
    assert.equal(buddyRestPose(sp, 0, 'tidur'), null);
    assert.equal(buddyScale(sp), 1.6);
  }
  assert.equal(buddyRestPose('beruang', 1, 'tidur'), 'pillow');
  assert.equal(buddyRestPose('beruang', 2, 'tidur'), 'pillow');
  assert.equal(buddyRestPose('beruang', 1, 'duduk'), null);
  assert.equal(buddyRestPose('rusa', 1, 'tidur'), 'side');
  assert.equal(buddyRestPose('rusa', 1, 'duduk'), 'side');
  assert.equal(buddyRestPose('rusa', 1, null), null);
  // sahabat biasa tidak berubah: Akrab duduk di kepala saat pet duduk/tidur, pipit hinggap saat pet diam
  for (const sp of SAHABAT_BIASA) {
    assert.equal(buddyRestPose(sp, 1, 'tidur'), 'head', sp);
    assert.equal(buddyRestPose(sp, 0, 'tidur'), null, sp);
    assert.equal(buddyScale(sp), 1, sp);
  }
  assert.equal(buddyRestPose('pipit', 0, null, false), 'head');
  assert.equal(buddyRestPose('pipit', 0, null, true), null);
  assert.equal(buddyRestPose('ayam', 0, null, false), null);
  // keterangan tingkat Akrab menyebut pose besarnya, bukan kepala
  assert.match(levelSub('beruang', 1), /bantal/);
  assert.match(levelSub('rusa', 1), /samping/);
  for (const sp of SAHABAT_NATAL) assert.doesNotMatch(levelSub(sp, 1), /kepala/);
  assert.match(levelSub('ayam', 1), /kepala/);
  // Room.svelte memakai aturan bersama ini (tidak ada aturan kepala sendiri)
  const room = readFileSync(new URL('../../game/src/scenes/Room.svelte', import.meta.url), 'utf8');
  assert.ok(room.includes('buddyRestPose(b.sp, b.lvl, o.pose, o.moving)'));
  assert.ok(!room.includes('HEAD_POSES'));
});

test('Album: bagian Edisi Natal — siluet selama dijual, tersembunyi sesudahnya, yang dimiliki selalu tampil', async () => {
  const cat = await getCatalog(db);
  const sale = (now: number) => (sp: any) => purchasable(cat, cat.byId.get(SAHABAT_INFO[sp as 'rusa'].item), now);
  const during = new Date('2026-12-20T05:00:00Z').getTime(), last = new Date('2027-01-06T16:58:00Z').getTime(), afterEnd = new Date('2027-01-06T17:00:00Z').getTime();
  const none = () => false;
  // selama masa jual: dua siluet di bagian Edisi Natal; sahabat biasa tetap 9
  let al = albumSections(none, sale(during));
  assert.equal(al.biasa.length, 9);
  assert.deepEqual(al.natal, [{ sp: 'beruang', own: false }, { sp: 'rusa', own: false }]);
  assert.equal(albumSections(none, sale(last)).natal.length, 2, '23.58 WIB 6 Januari masih dijual');
  // sesudah masa jual: yang belum dimiliki disembunyikan
  al = albumSections(none, sale(afterEnd));
  assert.deepEqual(al.natal, []);
  assert.equal(al.biasa.length, 9, 'sahabat biasa tetap tampil (siluet)');
  // yang dimiliki selalu tampil
  const ownsRusa = (sp: any) => sp === 'rusa';
  assert.deepEqual(albumSections(ownsRusa, sale(afterEnd)).natal, [{ sp: 'rusa', own: true }]);
  assert.deepEqual(albumSections(ownsRusa, sale(during)).natal, [{ sp: 'beruang', own: false }, { sp: 'rusa', own: true }]);
  // teks siluet (game): "Edisi terbatas di Toko Mutiara sampai 6 Januari"
  const game = readFileSync(new URL('../../game/src/lib/sahabat.svelte.ts', import.meta.url), 'utf8');
  assert.ok(game.includes("`Edisi terbatas di Toko Mutiara${until ? ` sampai ${until}` : ''}.`"));
  assert.equal(tanggalWIB(cat.byId.get('sahabat-rusa')!.available_to!), '6 Januari');
});

test('oleh-oleh Edisi Natal: daftar per jenis (diatur admin), barang yang ada & bukan sahabat', async () => {
  const cat = await getCatalog(db);
  for (const sp of SAHABAT_NATAL) {
    const g = DEFAULT_SETTINGS.sahabat.gifts[sp];
    assert.deepEqual(g, SAHABAT_GIFTS[sp]);
    assert.ok(g.length >= 3 && g.includes('koin'), sp);
    for (const id of g.filter((x: string) => x !== 'koin')) {
      const it = cat.byId.get(id);
      assert.ok(it && it.active && it.kind !== 'sahabat', `${sp}: ${id} ada di katalog`);
    }
  }
  assert.ok(DEFAULT_SETTINGS.sahabat.gifts.beruang.includes('ikan-wader') && DEFAULT_SETTINGS.sahabat.gifts.rusa.includes('wortel'));
  // admin wajib mengisi daftar untuk jenis baru
  const errs: string[] = [];
  const { beruang: _b, ...rest } = DEFAULT_SETTINGS.sahabat.gifts;
  void _b;
  checkSahabat({ ...DEFAULT_SETTINGS.sahabat, gifts: rest }, (m) => errs.push(m));
  assert.ok(errs.some((m) => /gifts › beruang/.test(m)));
  // pemain: Beruang Es aktif membawa barang dari daftarnya
  const a = await player('Oleh', 0, 30);
  assert.equal((await buy(a, 'sahabat-beruang')).status, 200);
  setSahabatRandom(() => 0.5);
  const r = await a.c.post('/api/sahabat/oleh', { requestId: rid() });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const pick = DEFAULT_SETTINGS.sahabat.gifts.beruang[Math.floor(0.5 * DEFAULT_SETTINGS.sahabat.gifts.beruang.length)];
  assert.equal(r.body.result.item, pick);
  assert.equal(await qty(a, pick), 1);
  // admin mengubah daftar lewat pengaturan: diterima & dipakai
  const adm = await adminClient();
  const cur = (await adm.get('/api/admin/settings')).body;
  assert.match(cur.help.sahabat, /Edisi Natal/);
  const put = await adm.put('/api/admin/settings', { value: { ...cur.value, sahabat: { ...cur.value.sahabat, gifts: { ...cur.value.sahabat.gifts, rusa: ['jeruk'] } } } });
  assert.equal(put.status, 200, JSON.stringify(put.body));
  const bad = await adm.put('/api/admin/settings', { value: { ...cur.value, sahabat: { ...cur.value.sahabat, gifts: { ...cur.value.sahabat.gifts, rusa: ['sahabat-beruang'] } } } });
  assert.equal(bad.status, 400);
  assert.equal((await adm.put('/api/admin/settings', { value: cur.value })).status, 200);
});

test('lencana Kawan Satwa: sahabat Edisi Natal ikut dihitung', async () => {
  const a = await player('Kawan', 0, 60);
  await ayam(a);
  assert.equal((await buy(a, 'sahabat-beruang')).status, 200);
  assert.equal((await buy(a, 'sahabat-rusa')).status, 200);
  const badges = (await a.c.get('/api/quests')).body.badges;
  assert.equal(badges.find((q: any) => q.id === 'b-sahabat-3').done, true);
  assert.equal(badges.find((q: any) => q.id === 'b-sahabat-6').progress, 3);
});

test('gambar: orisinal & ringan — sahabat besar, efek sedikit, frame diam pas, tanpa hidung merah', () => {
  const be = buddyMarkup('beruang'), ru = buddyMarkup('rusa');
  for (const [sp, m] of [['beruang', be], ['rusa', ru]] as const) {
    assert.ok(wellFormed(m), sp);
    assert.ok(wellFormed(buddyMarkup(sp, { lvl: 2, flip: true, gift: true })), `${sp}: Sejati, menghadap kiri, oleh-oleh`);
    assert.ok(m.includes('class="b-t"'), `${sp}: frame trik`);
    assert.ok(buddyMarkup(sp, { lvl: 2 }).includes('class="b-collar"'), `${sp}: kalung emas Sahabat Sejati`);
    for (const cls of ['nt-flake', 'nt-light', 'nt-frost', 'nt-trail', 'nt-arc', 'nt-jingle', 'nt-breath', 'nt-halo']) assert.ok(count(shown(m), `class="${cls}"`) <= 6, `${sp}: ${cls} paling banyak 6`);
    const icon = buddyIcon(sp);
    assert.match(icon, /viewBox="-40 -72 80 78\.4"/, `${sp}: ikon Album/kartu profil berbingkai lebih besar`);
    assert.ok(wellFormed(icon) && wellFormed(buddyIcon(sp, { sil: true })) && wellFormed(buddyIcon(sp, { lvl: 2 })));
    assert.ok(!buddyIcon(sp, { sil: true }).includes('nt-'), `${sp}: siluet tanpa efek`);
    const ii = itemIcon({ id: SAHABAT_INFO[sp].item, kind: 'sahabat', name: sp, art: { type: 'builtin', key: `sahabat${sp}` }, data: {} } as any);
    assert.ok(wellFormed(ii) && ii.length > 2000, `${sp}: ikon toko`);
  }
  // Beruang Es: 5 butir salju selalu tampil (frame dasar), napas & kilau es tersembunyi sampai CSS menyalakannya
  assert.equal(count(be, 'class="nt-flake"'), 5);
  assert.ok(!/class="nt-flake"[^>]*opacity="0"/.test(be), 'salju terlihat di frame diam');
  assert.equal(count(be, 'class="nt-frost"'), 4);
  assert.ok([...be.matchAll(/class="nt-(frost|breath)"[^>]*>/g)].every((m) => m[0].includes('opacity="0"')));
  // bantal: gambar berbaring tanpa frame trik
  const pil = buddyMarkup('beruang', { pose: 'pillow', perch: true });
  assert.ok(wellFormed(pil) && !pil.includes('class="b-t"') && !pil.includes('opacity=".13"'), 'berbaring, tanpa bayangan');
  // Rusa Kutup: 5 lampu tanduk, lonceng emas, lengkung 5 bintang trik tersembunyi; cahaya lembut hanya saat di samping pet
  assert.equal(count(shown(ru), 'class="nt-light"'), 5);
  assert.equal(count(shown(ru), 'class="nt-arc"'), 5);
  assert.equal(count(ru, 'class="nt-halo"'), 0);
  assert.equal(count(buddyMarkup('rusa', { pose: 'side' }), 'class="nt-halo"'), 5);
  assert.ok(ru.includes('class="nt-bell"'));
  // hidung rusa cokelat tua (bukan merah, tidak bercahaya)
  const nose = /<ellipse cx="34\.6" cy="-41\.4" rx="2\.5" ry="2\.1" fill="([^"]+)"/.exec(ru);
  assert.equal(nose?.[1], '#4A3428');
  // ukuran: ±1,6× sahabat biasa, tetap jauh lebih kecil dari pet (±110 tinggi)
  const h = (sp: string) => Math.max(...[...buddyMarkup(sp as any).matchAll(/cy="(-[\d.]+)"/g)].map((m) => -Number(m[1])));
  assert.ok(h('beruang') > 1.3 * h('kelinci') - 20 && h('rusa') < 80, 'besar tapi di bawah pet');
});

test('CSS efek Edisi Natal: transform/opacity, bertahap (tidak tiap frame), diam saat gerak dikurangi', () => {
  const css = readFileSync(new URL('../../game/src/app.css', import.meta.url), 'utf8');
  const start = css.indexOf('/* ---------- Paket konten 24'), end = css.indexOf('/* ---------- Paket konten 20');
  assert.ok(start > 0 && end > start, 'bagian paket 24 ada sebelum paket 20 (uji paket 20 membaca blok terakhir)');
  const sec = css.slice(start, end);
  for (const k of ['flake', 'blink', 'halo', 'plod', 'trot', 'slide', 'leap', 'star', 'frost', 'trail', 'breath', 'bell', 'jingle']) assert.ok(sec.includes(`@keyframes nt-${k} `), `keyframes nt-${k}`);
  // efek terus-menerus bergerak per langkah 0,2 dtk
  assert.match(sec, /\.nt-flake \{ animation: nt-flake 4s infinite; \}/);
  assert.ok(/0% \{[^}]*steps\(4, end\)/.test(sec) && /20% \{[^}]*steps\(12, end\)/.test(sec), 'salju: 20 langkah × 0,2 dtk');
  assert.match(sec, /\.nt-light \{ animation: nt-blink 1\.6s steps\(1, end\) infinite; \}/);
  // jeda salju & lampu kelipatan 0,2 dtk (berubah bersamaan)
  for (const m of buddyMarkup('beruang').matchAll(/class="nt-flake" style="animation-delay:(-?[\d.]+)s"/g)) assert.ok(Math.abs(Number(m[1]) * 5 - Math.round(Number(m[1]) * 5)) < 1e-9, `jeda ${m[1]}`);
  for (const m of buddyMarkup('rusa').matchAll(/class="nt-light" style="animation-delay:(-?[\d.]+)s"/g)) assert.ok(Math.abs(Number(m[1]) * 5 - Math.round(Number(m[1]) * 5)) < 1e-9, `jeda ${m[1]}`);
  // hanya transform / translate / scale / rotate / opacity
  for (const kf of sec.matchAll(/@keyframes nt-[\w-]+ \{([\s\S]*?)\}\n/g)) {
    const props = [...kf[1].matchAll(/([a-z-]+):/g)].map((m) => m[1]).filter((p) => p !== 'animation-timing-function');
    assert.ok(props.every((p) => ['transform', 'translate', 'scale', 'rotate', 'opacity'].includes(p)), `properti: ${props.join(', ')}`);
  }
  // sahabat besar tidak menyembunyikan gambar berbaringnya saat diketuk
  assert.ok(sec.includes('.bud.trk:is(.sp-beruang, .sp-rusa):not(.pillow) .b-n { display: none; }'));
  const all = ['.nt-flake', '.nt-light', '.nt-halo', '.nt-frost', '.nt-trail', '.nt-arc', '.nt-jingle', '.nt-breath', '.nt-bell'];
  const reduce = sec.slice(sec.indexOf('@media (prefers-reduced-motion: reduce)'));
  const kurangi = sec.slice(sec.indexOf('/* Pengaturan › Kurangi animasi'));
  for (const c of all) {
    assert.ok(reduce.includes(c) && /animation: none !important/.test(reduce), `${c} diam (prefers-reduced-motion)`);
    assert.ok(kurangi.includes(':root.reduce-motion') && kurangi.includes(c), `${c} diam (Kurangi animasi)`);
  }
  // badan sahabat (goyang & trik) ikut diam lewat blok paket 23
  assert.ok(css.includes(':root.reduce-motion .bud :is(.bud-bob, .bud-hop, .b-pk, .b-glow) { animation: none !important; }'));
});
