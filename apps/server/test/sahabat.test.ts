// Sahabat Mungil (paket konten 23): anak ayam pertama (gratis, diberi nama, sekali), adopsi dengan koin & Mutiara lewat
// jalur beli toko (aman requestId), satu sahabat aktif, Camilan Sahabat (sekali sehari), main (3× sehari), tingkat
// keakraban Kenal → Akrab → Sahabat Sejati (lencana), oleh-oleh sekali sehari, syarat kura-kura (Kolam Pancing, langka,
// sekali), burung pipit (Halaman + tempat minum burung), kunang-kunang (malam), jalan-jalan bareng (kunjung, alun-alun,
// peta; sekali sehari), sahabat terlihat pemain lain (kunjungan, rumah live, alun-alun), pengaturan admin, tugas harian &
// lencana Kawan Satwa, paket konten 23 & letak Pondok Sahabat di peta.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config';

config.paymentProvider = 'mock';
config.adminEmail = 'owner@test.local';
config.adminPassword = 'rahasia-sekali-123';
const { buildApp } = await import('../src/app');
const { invalidateCaches } = await import('../src/lib/core');
const { setSahabatClock, setSahabatRandom } = await import('../src/lib/sahabat');
const { seedPackV23, SAHABAT_ITEMS, SAHABAT_LOCATION } = await import('../src/db/seed-sahabat');
const { DEFAULT_SETTINGS, SAHABAT_SPECIES, SAHABAT_INFO } = await import('@kb/shared');
let app: any;
let db: any;
before(async () => { ({ app, db } = await buildApp({ memoryDb: true, logger: false, rateLimit: false, worker: false })); });
after(async () => app?.close());
beforeEach(async () => { setSahabatClock(() => Date.now()); setSahabatRandom(() => Math.random()); await setGame({}); });

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
type P = { c: ReturnType<typeof client>; id: string; code: string; room: string; pet: string };
async function player(pet: string, coins = 0, pearls = 0): Promise<P> {
  const c = client();
  await c.post('/api/auth/guest');
  const p = await c.post('/api/pet', { name: pet, color: '#F6B7A8', ear: 'kucing' });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  const id = p.body.state.user.id as string;
  await db.query(`update wallets set coin = $2, pearl = $3 where user_id = $1`, [id, coins, pearls]);
  return { c, id, code: p.body.state.user.friend_code, room: p.body.state.rooms[0].id, pet };
}
/** pengaturan game: bawaan + perubahan bagian sahabat & lainnya (langsung di database) */
async function setGame(patch: { sahabat?: Record<string, unknown>; [k: string]: any }) {
  if (!db) return;
  const row = await db.one(`select value from settings where key = 'game'`);
  const v = row?.value ?? {};
  v.sahabat = { ...structuredClone(DEFAULT_SETTINGS.sahabat), ...(patch.sahabat ?? {}) };
  for (const [k, p] of Object.entries(patch)) if (k !== 'sahabat') v[k] = { ...(v[k] ?? {}), ...p };
  await db.query(`insert into settings (key, value) values ('game', $1::text::jsonb) on conflict (key) do update set value = excluded.value`, [JSON.stringify(v)]);
  invalidateCaches();
}
const rid = () => 'r-' + Math.random().toString(36).slice(2, 12);
const coins = async (p: P) => (await db.one(`select coin from wallets where user_id = $1`, [p.id])).coin as number;
const pearls = async (p: P) => (await db.one(`select pearl from wallets where user_id = $1`, [p.id])).pearl as number;
const qty = async (p: P, item: string) => (await db.one(`select qty from inventory where user_id = $1 and item_id = $2`, [p.id, item]))?.qty ?? 0;
const state = async (p: P) => (await p.c.get('/api/sahabat')).body.sahabat;
const buddy = async (p: P, sp: string) => (await state(p)).list.find((b: any) => b.sp === sp);
const ayam = async (p: P, name = 'Ciko') => { const r = await p.c.post('/api/sahabat/ayam', { name, requestId: rid() }); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body.buddy; };
const buy = (p: P, itemId: string, currency = 'coin', extra: Record<string, unknown> = {}) => p.c.post('/api/shop/buy', { itemId, currency, requestId: rid(), ...extra });
const WIB = (h: number, m = 0) => Date.UTC(2026, 10, 20, h - 7, m);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('paket 23: sembilan sahabat, Camilan Sahabat, Kerang Hias, Pondok Sahabat, tugas & lencana', async () => {
  const cat = (await client().get('/api/catalog')).body;
  const by = Object.fromEntries(cat.items.map((i: any) => [i.id, i]));
  for (const sp of SAHABAT_SPECIES) assert.equal(by[SAHABAT_INFO[sp].item]?.kind, 'sahabat', `item ${sp}`);
  assert.deepEqual([by['sahabat-umang'].price_coin, by['sahabat-umang'].shop], [250, 'pondok']);
  assert.deepEqual([by['sahabat-bebek'].price_coin, by['sahabat-bebek'].shop], [400, 'pondok']);
  assert.deepEqual([by['sahabat-kelinci'].price_pearl, by['sahabat-hamster'].price_pearl, by['sahabat-landak'].price_pearl], [12, 12, 15]);
  assert.ok(['kelinci', 'hamster', 'landak'].every((sp) => by[`sahabat-${sp}`].shop === 'mutiara'), 'sahabat Mutiara dijual di Toko Mutiara');
  assert.ok(['ayam', 'kura', 'pipit', 'kunang'].every((sp) => !by[`sahabat-${sp}`].shop && !by[`sahabat-${sp}`].price_coin && !by[`sahabat-${sp}`].price_pearl), 'sahabat syarat khusus tidak dijual');
  assert.deepEqual([by['camilan-sahabat'].price_coin, by['camilan-sahabat'].shop], [5, 'pondok']);
  assert.ok(by['kerang-hias'].sell_coin > 0 && !by['kerang-hias'].shop);
  const loc = cat.locations.find((l: any) => l.id === 'pondok');
  assert.deepEqual([loc?.kind, loc?.name], ['sahabat', 'Pondok Sahabat']);
  assert.equal(cat.settings.sahabat.on, true);
  assert.equal(cat.settings.sahabat.mainPerDay, 3);
  const qs = await db.query(`select id, kind, event, target from quests where id like '%sahabat%' order by id`);
  assert.deepEqual(qs.map((q: any) => [q.id, q.kind, q.event, q.target]), [
    ['b-sahabat-3', 'badge', 'sahabat_baru', 3], ['b-sahabat-6', 'badge', 'sahabat_baru', 6], ['b-sahabat-9', 'badge', 'sahabat_baru', 9],
    ['b-sahabat-sejati', 'badge', 'sahabat_sejati', 1], ['h-sahabat', 'daily', 'sahabat_makan', 1]]);
  // sekali saja; ubahan admin tidak ditimpa
  assert.equal(await seedPackV23(db), false);
  await db.query(`update items set price_coin = 300 where id = 'sahabat-umang'`);
  await db.query(`delete from settings where key = 'pack_sahabat'`);
  assert.equal(await seedPackV23(db), true);
  assert.equal((await db.one(`select price_coin from items where id = 'sahabat-umang'`)).price_coin, 300);
  await db.query(`update items set price_coin = 250 where id = 'sahabat-umang'`);
  assert.equal(SAHABAT_ITEMS.length, 11);
  assert.ok(Number((await db.one(`select value from settings where key = 'content_pack'`)).value) >= 23);
  invalidateCaches();
});

test('peta: Pondok Sahabat tidak menimpa jalan, tempat lain, atau labelnya', async () => {
  const L = (await client().get('/api/catalog')).body.locations as any[];
  const box = (l: any): number[] => {
    const { x, y } = l;
    if (l.kind === 'sahabat') return [x - 66, y - 84, x + 71, y + 31];
    if (l.kind === 'square') return [x - 96, y - 140, x + 96, y + 14];
    if (l.kind === 'race') return [x - 82, y - 106, x + 82, y + 14];
    if (l.kind === 'garden') return [x - 57, y - 84, x + 43, y + 14];
    if (l.kind === 'pond') return [x - 78, y - 86, x + 78, y + 14];
    if (l.kind === 'jobs') return [x - 75, y - 100, x + 75, y + 14];
    if (l.kind === 'ronda') return [x - 58, y - 96, x + 58, y + 14];
    const w = Number(l.style?.w ?? 100);
    return [x - w / 2 - 6, y - 100, x + w / 2 + 6, y + 14];
  };
  const hit = (a: number[], b: number[]) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  const me = L.find((l) => l.id === 'pondok');
  assert.deepEqual([me.x, me.y], [SAHABAT_LOCATION.x, SAHABAT_LOCATION.y]);
  const b = box(me);
  for (const r of [[-20, 221, 1280, 259], [401, 240, 439, 470]]) assert.ok(!hit(b, r), `Pondok Sahabat menimpa jalan ${JSON.stringify(r)}`);
  for (const o of L) if (o.id !== 'pondok') assert.ok(!hit(b, box(o)), `Pondok Sahabat menimpa ${o.id}`);
  assert.ok(b[0] >= 0 && b[2] <= 1260 && b[1] >= -40, 'di dalam peta');
  // jalan setapak dari jalan utama ke pintunya lewat celah antara Toko Mutiara & Balai Main (pet ±42 lebar)
  const mut = box(L.find((l) => l.id === 'mutiara')), bal = box(L.find((l) => l.id === 'balai'));
  assert.ok(me.x - 21 >= mut[2] && me.x + 21 <= bal[0], 'celah jalan setapak cukup');
});

test('anak ayam pertama: gratis, diberi nama, langsung aktif, sekali saja', async () => {
  const a = await player('Mochi');
  const me = (await a.c.get('/api/me')).body;
  assert.equal(me.sahabat.ayam, true, 'anak ayam menunggu di pintu');
  assert.deepEqual(me.sahabat.list, []);
  // nama diperiksa seperti nama pet
  assert.equal((await a.c.post('/api/sahabat/ayam', { name: 'a', requestId: rid() })).body.error.code, 'name_length');
  assert.equal((await a.c.post('/api/sahabat/ayam', { name: 'Admin Bupi', requestId: rid() })).body.error.code, 'name_reserved');
  assert.equal((await a.c.post('/api/sahabat/ayam', { name: 'Nama Yang Sangat Pnjang', requestId: rid() })).status, 400);
  const b = await ayam(a, 'Ciko');
  assert.deepEqual([b.sp, b.name, b.active, b.lvl, b.level], ['ayam', 'Ciko', true, 0, 'Kenal']);
  const s = await state(a);
  assert.equal(s.ayam, false);
  assert.equal(s.gift, true, 'oleh-oleh hari ini menunggu');
  const again = await a.c.post('/api/sahabat/ayam', { name: 'Lagi', requestId: rid() });
  assert.equal(again.body.error.code, 'owned');
  assert.equal((await db.one(`select count(*)::int c from pet_buddies where user_id = $1`, [a.id])).c, 1);
  // ganti nama
  assert.equal((await a.c.post('/api/sahabat/nama', { id: b.id, name: 'Piyik', requestId: rid() })).status, 200);
  assert.equal((await buddy(a, 'ayam')).name, 'Piyik');
  assert.equal((await a.c.post('/api/sahabat/nama', { id: b.id, name: '', requestId: rid() })).body.error.code, 'name_length');
});

test('adopsi: koin di Pondok Sahabat, Mutiara lewat jalur Toko Mutiara; satu per jenis; aman klik ganda', async () => {
  const a = await player('Kopi', 1000, 20);
  await ayam(a);
  // koin: umang-umang 250, belum aktif (anak ayam masih aktif), rumah kerang warna bawaan
  const req = rid();
  const r1 = await a.c.post('/api/shop/buy', { itemId: 'sahabat-umang', currency: 'coin', requestId: req, name: 'Umi' });
  assert.equal(r1.status, 200, JSON.stringify(r1.body));
  assert.deepEqual([r1.body.buddy.name, r1.body.buddy.active, r1.body.buddy.variant], ['Umi', false, 'merah']);
  assert.equal(await coins(a), 750);
  // requestId sama: hasil pertama, tidak dipotong lagi
  const r2 = await a.c.post('/api/shop/buy', { itemId: 'sahabat-umang', currency: 'coin', requestId: req, name: 'Umi' });
  assert.equal(r2.status, 200);
  assert.equal(await coins(a), 750);
  assert.equal((await buy(a, 'sahabat-umang')).body.error.code, 'owned');
  // mata uang salah, jumlah lebih dari satu, sahabat yang tidak dijual
  assert.equal((await buy(a, 'sahabat-bebek', 'pearl')).body.error.code, 'wrong_currency');
  assert.equal((await buy(a, 'sahabat-bebek', 'coin', { qty: 2 })).body.error.code, 'invalid');
  for (const sp of ['ayam', 'kura', 'pipit', 'kunang']) assert.equal((await buy(a, `sahabat-${sp}`)).body.error.code, 'not_for_sale', sp);
  // Mutiara: kelinci 12, hamster 12 → Mutiara kurang untuk landak (15)
  assert.equal((await buy(a, 'sahabat-kelinci', 'pearl')).status, 200);
  assert.equal(await pearls(a), 8);
  const short = await buy(a, 'sahabat-landak', 'pearl');
  assert.equal(short.body.error.code, 'insufficient_funds');
  assert.equal(await pearls(a), 8, 'gagal = tidak terpotong');
  assert.equal((await db.one(`select count(*)::int c from pet_buddies where user_id = $1 and species = 'landak'`, [a.id])).c, 0);
  // sahabat tidak masuk Tas
  assert.equal(await qty(a, 'sahabat-kelinci'), 0);
  const s = await state(a);
  assert.deepEqual(s.list.map((b: any) => b.sp).sort(), ['ayam', 'kelinci', 'umang']);
  assert.equal(s.list.filter((b: any) => b.active).length, 1);
  // Pondok ditutup admin: adopsi ditolak
  await setGame({ sahabat: { on: false } });
  assert.equal((await buy(a, 'sahabat-bebek')).body.error.code, 'sahabat_off');
});

test('satu sahabat aktif; warna kerang umang-umang; sahabat orang lain tidak bisa diatur', async () => {
  const a = await player('Bolu', 600);
  const b0 = await ayam(a);
  const um = (await buy(a, 'sahabat-umang')).body.buddy;
  let r = await a.c.post('/api/sahabat/aktif', { id: um.id, requestId: rid() });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.sahabat.list.filter((b: any) => b.active).map((b: any) => b.sp), ['umang']);
  // istirahatkan semua: tidak ada yang aktif, tidak ada oleh-oleh
  r = await a.c.post('/api/sahabat/aktif', { id: null, requestId: rid() });
  assert.equal(r.body.sahabat.list.filter((b: any) => b.active).length, 0);
  assert.equal(r.body.sahabat.gift, false);
  await a.c.post('/api/sahabat/aktif', { id: b0.id, requestId: rid() });
  // warna kerang
  assert.equal((await a.c.post('/api/sahabat/warna', { id: um.id, variant: 'biru', requestId: rid() })).status, 200);
  assert.equal((await buddy(a, 'umang')).variant, 'biru');
  assert.equal((await a.c.post('/api/sahabat/warna', { id: um.id, variant: 'emas', requestId: rid() })).body.error.code, 'invalid');
  assert.equal((await a.c.post('/api/sahabat/warna', { id: b0.id, variant: 'biru', requestId: rid() })).body.error.code, 'invalid');
  // milik orang lain
  const o = await player('Lain');
  assert.equal((await o.c.post('/api/sahabat/aktif', { id: um.id, requestId: rid() })).status, 404);
  assert.equal((await o.c.post('/api/sahabat/nama', { id: um.id, name: 'Curian', requestId: rid() })).status, 404);
  assert.equal((await o.c.post('/api/sahabat/aktif', { id: 'bukan-uuid', requestId: rid() })).status, 400);
  // unik di database: dua aktif tidak mungkin
  await assert.rejects(db.query(`update pet_buddies set active = true where user_id = $1`, [a.id]));
});

test('Camilan Sahabat: dibeli di Pondok, keakraban sekali sehari per sahabat, camilan dipakai hanya bila dihitung', async () => {
  const a = await player('Tahu', 600);
  const b = await ayam(a);
  assert.equal((await a.c.post('/api/sahabat/makan', { id: b.id, requestId: rid() })).body.error.code, 'no_snack');
  assert.equal((await buy(a, 'camilan-sahabat', 'coin', { qty: 3 })).status, 200);
  assert.equal(await coins(a), 585);
  assert.equal(await qty(a, 'camilan-sahabat'), 3);
  const r = await a.c.post('/api/sahabat/makan', { id: b.id, requestId: rid() });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.result.gain, r.body.result.points], [DEFAULT_SETTINGS.sahabat.points.makan, 10]);
  assert.equal(await qty(a, 'camilan-sahabat'), 2);
  const again = await a.c.post('/api/sahabat/makan', { id: b.id, requestId: rid() });
  assert.equal(again.body.error.code, 'fed_today');
  assert.equal(await qty(a, 'camilan-sahabat'), 2, 'camilan tidak terpakai bila tidak dihitung');
  assert.equal((await buddy(a, 'ayam')).fedToday, true);
  // sahabat lain hari yang sama tetap boleh
  const um = (await buy(a, 'sahabat-umang')).body.buddy;
  assert.equal((await a.c.post('/api/sahabat/makan', { id: um.id, requestId: rid() })).status, 200);
  // besok boleh lagi (penghitung harian per hari WIB)
  await db.query(`update daily_counters set day = day - 1 where user_id = $1 and key like 'sb_makan:%'`, [a.id]);
  assert.equal((await a.c.post('/api/sahabat/makan', { id: b.id, requestId: rid() })).status, 200);
  assert.equal((await buddy(a, 'ayam')).points, 20);
});

test('main: keakraban dihitung 3× sehari, sesudahnya tetap boleh main tanpa poin', async () => {
  const a = await player('Gethuk');
  const b = await ayam(a);
  const got: boolean[] = [];
  for (let i = 0; i < 4; i++) got.push((await a.c.post('/api/sahabat/main', { id: b.id, requestId: rid() })).body.result.counted);
  assert.deepEqual(got, [true, true, true, false]);
  const now = await buddy(a, 'ayam');
  assert.deepEqual([now.points, now.playsLeft], [3 * DEFAULT_SETTINGS.sahabat.points.main, 0]);
  // requestId sama = satu kali
  const req = rid();
  await db.query(`delete from daily_counters where user_id = $1`, [a.id]);
  await a.c.post('/api/sahabat/main', { id: b.id, requestId: req });
  await a.c.post('/api/sahabat/main', { id: b.id, requestId: req });
  assert.equal((await buddy(a, 'ayam')).playsLeft, 2);
});

test('tingkat keakraban: Kenal → Akrab → Sahabat Sejati (lencana), tidak pernah turun', async () => {
  const a = await player('Serabi', 100);
  const b = await ayam(a);
  const K = DEFAULT_SETTINGS.sahabat;
  assert.ok(K.akrabAt < K.sejatiAt);
  // ±26 keakraban per hari main teratur (makan + 3× main + 1 jalan-jalan): Akrab beberapa hari, Sejati ±2 minggu
  const perDay = K.points.makan + K.mainPerDay * K.points.main + K.points.jalan;
  assert.ok(K.akrabAt / perDay >= 2 && K.akrabAt / perDay <= 5, `Akrab ${K.akrabAt / perDay} hari`);
  assert.ok(K.sejatiAt / perDay >= 11 && K.sejatiAt / perDay <= 17, `Sejati ${K.sejatiAt / perDay} hari`);
  await db.query(`update pet_buddies set points = $2 where id = $1`, [b.id, K.akrabAt - 1]);
  let r = await a.c.post('/api/sahabat/main', { id: b.id, requestId: rid() });
  assert.deepEqual([r.body.result.lvl, r.body.result.up, r.body.result.level], [1, 1, 'Akrab']);
  r = await a.c.post('/api/sahabat/main', { id: b.id, requestId: rid() });
  assert.equal(r.body.result.up, null, 'naik tingkat dicatat sekali');
  await db.query(`update pet_buddies set points = $2 where id = $1`, [b.id, K.sejatiAt - 2]);
  r = await a.c.post('/api/sahabat/main', { id: b.id, requestId: rid() });
  assert.deepEqual([r.body.result.lvl, r.body.result.up], [2, 2]);
  const q = (await a.c.get('/api/quests')).body.badges.find((x: any) => x.id === 'b-sahabat-sejati');
  assert.deepEqual([q.progress, q.done], [1, true]);
  // tidak ada hukuman: keakraban & tingkat tidak berkurang walau lama dibiarkan
  await db.query(`update pet_buddies set created_at = now() - interval '60 days' where id = $1`, [b.id]);
  assert.equal((await buddy(a, 'ayam')).lvl, 2);
});

test('oleh-oleh: sahabat aktif membawa temuan sekali sehari, sesuai jenisnya', async () => {
  const a = await player('Klepon');
  assert.equal((await a.c.post('/api/sahabat/oleh', { requestId: rid() })).body.error.code, 'no_buddy');
  await ayam(a);
  // baris pertama daftar ayam = koin: koin acak di antara giftCoins
  setSahabatRandom(() => 0);
  const before = await coins(a);
  const r = await a.c.post('/api/sahabat/oleh', { requestId: rid() });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.result.coins, DEFAULT_SETTINGS.sahabat.giftCoins[0]);
  assert.equal(await coins(a), before + r.body.result.coins);
  assert.equal(r.body.sahabat.gift, false);
  assert.equal((await a.c.post('/api/sahabat/oleh', { requestId: rid() })).body.error.code, 'gift_taken');
  // hari berikutnya: barang dari daftar jenisnya (admin mengatur daftar)
  await setGame({ sahabat: { gifts: { ...DEFAULT_SETTINGS.sahabat.gifts, ayam: ['bibit-jagung'] } } });
  await db.query(`update daily_counters set day = day - 1 where user_id = $1 and key = 'sb_oleh'`, [a.id]);
  assert.equal((await state(a)).gift, true);
  const r2 = await a.c.post('/api/sahabat/oleh', { requestId: rid() });
  assert.deepEqual([r2.body.result.item, r2.body.result.coins], ['bibit-jagung', 0]);
  assert.equal(await qty(a, 'bibit-jagung'), 1 + (DEFAULT_SETTINGS.starter.inventory['bibit-jagung'] ?? 0));
});

test('kura-kura: hanya dari Kolam Pancing, langka, sekali seumur akun', async () => {
  const a = await player('Mancing');
  await db.query(`update pets set energi = 100, needs_at = now() where user_id = $1`, [a.id]);
  const FAST = { castsPerDay: 500, waitMs: { dekat: [100, 100], sedang: [100, 100], jauh: [100, 100] }, nibbleMax: 0, fightMs: { biasa: [300, 300], jarang: [300, 300], langka: [300, 300], legenda: [300, 300], sampah: [300, 300], harta: [300, 300] } };
  const pond = await db.query(`select id, active from items where (data->>'fishWeight') is not null`);
  await db.query(`update items set active = (id = 'ikan-mas') where (data->>'fishWeight') is not null`);
  const land = async () => {
    await db.query(`update pets set energi = 100, needs_at = now() where user_id = $1`, [a.id]);
    const c = await a.c.post('/api/fish/cast', { distance: 'dekat' });
    assert.equal(c.status, 200, JSON.stringify(c.body));
    await sleep(c.body.biteInMs + 40);
    const h = await a.c.post('/api/fish/hook', { castId: c.body.castId });
    assert.equal(h.body.result, 'hooked', JSON.stringify(h.body));
    await sleep(c.body.fight.minMs + 40);
    const l = await a.c.post('/api/fish/land', { castId: c.body.castId });
    assert.equal(l.status, 200, JSON.stringify(l.body));
    return l.body;
  };
  try {
    await setGame({ fishing: FAST, sahabat: { kuraPct: 0 } });
    assert.equal((await land()).kura, undefined, 'peluang 0%: tidak pernah');
    await setGame({ fishing: FAST, sahabat: { kuraPct: 100 } });
    const l = await land();
    assert.equal(l.result, 'caught');
    assert.deepEqual([l.kura?.sp, l.kura?.active], ['kura', true], 'kura-kura ikut tersangkut & jadi sahabat aktif (belum ada yang aktif)');
    assert.ok(l.sahabat.list.some((b: any) => b.sp === 'kura'));
    assert.equal((await land()).kura, undefined, 'sekali seumur akun');
    assert.equal((await db.one(`select count(*)::int c from pet_buddies where user_id = $1 and species = 'kura'`, [a.id])).c, 1);
  } finally {
    for (const r of pond) await db.query(`update items set active = $2 where id = $1`, [r.id, r.active]);
    await setGame({ fishing: structuredClone(DEFAULT_SETTINGS.fishing) });
  }
});

test('burung pipit: mampir bila Tempat Minum Burung dipasang di Halaman', async () => {
  const a = await player('Pipi', 2000);
  assert.equal((await a.c.post('/api/sahabat/pipit', { requestId: rid() })).body.error.code, 'no_pipit');
  // dipasang di kamar (bukan Halaman): belum datang
  await db.query(`insert into inventory (user_id, item_id, qty) values ($1, 'tempat-minum-burung', 2)`, [a.id]);
  const room = async (id: string) => (await a.c.get('/api/me')).body.rooms.find((r: any) => r.id === id);
  let k = await room(a.room);
  assert.equal((await a.c.post('/api/room', { roomId: a.room, layout: [...k.layout, { i: 'tempat-minum-burung', x: 5, y: 5 }], version: k.version })).status, 200);
  assert.equal((await state(a)).pipit, false);
  assert.equal((await a.c.post('/api/sahabat/pipit', { requestId: rid() })).body.error.code, 'no_pipit');
  // Halaman + tempat minum burung
  const h = await buy(a, 'halaman');
  assert.equal(h.status, 200, JSON.stringify(h.body));
  k = await room(h.body.roomId);
  assert.equal((await a.c.post('/api/room', { roomId: k.id, layout: [{ i: 'tempat-minum-burung', x: 2, y: 2 }], version: k.version })).status, 200);
  assert.equal((await state(a)).pipit, true);
  const r = await a.c.post('/api/sahabat/pipit', { name: 'Cuit', requestId: rid() });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.buddy.sp, r.body.buddy.name], ['pipit', 'Cuit']);
  assert.equal(r.body.sahabat.pipit, false);
  assert.equal((await a.c.post('/api/sahabat/pipit', { requestId: rid() })).body.error.code, 'owned');
});

test('kunang-kunang: hanya malam hari (19.00–04.00 jam setempat, bawaan WIB)', async () => {
  const a = await player('Malam');
  setSahabatClock(() => WIB(12));
  const r0 = await a.c.post('/api/sahabat/kunang', { requestId: rid() });
  assert.equal(r0.body.error.code, 'not_night');
  assert.match(r0.body.error.message, /19\.00–04\.00/);
  setSahabatClock(() => WIB(18, 59));
  assert.equal((await a.c.post('/api/sahabat/kunang', { requestId: rid() })).body.error.code, 'not_night');
  // 18.30 WIB = 19.30 WITA: pemain di WITA sudah malam
  setSahabatClock(() => WIB(18, 30));
  const b = await player('Wita');
  assert.equal((await b.c.post('/api/sahabat/kunang', { tz: 480, requestId: rid() })).status, 200);
  // lewat tengah malam: 03.30 WIB masih malam, 04.00 sudah pagi
  setSahabatClock(() => WIB(4, 0));
  assert.equal((await a.c.post('/api/sahabat/kunang', { requestId: rid() })).body.error.code, 'not_night');
  setSahabatClock(() => WIB(3, 30));
  const r = await a.c.post('/api/sahabat/kunang', { name: 'Nyala', requestId: rid() });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.buddy.sp, 'kunang');
  assert.equal((await a.c.post('/api/sahabat/kunang', { requestId: rid() })).body.error.code, 'owned');
  // jam admin bisa diubah
  await setGame({ sahabat: { kunang: { fromHour: 10, toHour: 14 } } });
  setSahabatClock(() => WIB(12));
  const c = await player('Siang');
  assert.equal((await c.c.post('/api/sahabat/kunang', { requestId: rid() })).status, 200);
});

test('jalan-jalan bareng: berkunjung, alun-alun & peta masing-masing sekali sehari; sahabat terlihat pemain lain', async () => {
  const a = await player('Tuan', 300), b = await player('Tamu');
  await ayam(a, 'Kiko');
  const bb = await ayam(b, 'Ciko');
  // sahabat istirahat tuan rumah
  await db.query(`update wallets set coin = 1000 where user_id = $1`, [a.id]);
  assert.equal((await buy(a, 'sahabat-umang', 'coin', { name: 'Umi' })).status, 200);
  assert.equal((await b.c.post('/api/friends', { code: a.code })).status, 200);
  // kunjungan: sahabat aktif tuan rumah & yang istirahat
  const v = await b.c.get(`/api/visit/${a.id}`);
  assert.equal(v.status, 200);
  assert.deepEqual([v.body.pet.buddy?.sp, v.body.pet.buddy?.name, v.body.pet.buddy?.lvl], ['ayam', 'Kiko', 0]);
  assert.deepEqual(v.body.resting.map((x: any) => [x.sp, x.name]), [['umang', 'Umi']]);
  // rumah live: tamu datang bareng sahabat → keakraban; tuan rumah melihat sahabat tamu
  await a.c.post(`/api/house/${a.id}/sync`, { roomId: a.room, x: 2, y: 2 });
  const s1 = await b.c.post(`/api/house/${a.id}/sync`, { roomId: a.room, x: 3, y: 3 });
  assert.equal(s1.body.live, true, JSON.stringify(s1.body));
  assert.equal(s1.body.jalanSahabat?.kind, 'kunjung');
  assert.equal(s1.body.jalanSahabat?.gain, DEFAULT_SETTINGS.sahabat.points.jalan);
  assert.equal(s1.body.members.find((m: any) => m.id === a.id)?.pet?.buddy?.name, 'Kiko');
  const h = await a.c.post(`/api/house/${a.id}/sync`, { roomId: a.room, x: 2, y: 2 });
  assert.equal(h.body.members.find((m: any) => m.id === b.id)?.pet?.buddy?.name, 'Ciko');
  // keluar-masuk lagi: tidak dihitung dua kali hari ini
  await b.c.post(`/api/house/${a.id}/leave`);
  assert.equal((await b.c.post(`/api/house/${a.id}/sync`, { roomId: a.room, x: 3, y: 3 })).body.jalanSahabat, undefined);
  // alun-alun
  const q1 = await b.c.post('/api/square/sync', { x: 10, y: 12 });
  assert.equal(q1.body.live, true, JSON.stringify(q1.body));
  assert.equal(q1.body.jalanSahabat?.kind, 'alun');
  const qa = await a.c.post('/api/square/sync', { x: 11, y: 12 });
  assert.equal(qa.body.members.find((m: any) => m.id === b.id)?.pet?.buddy?.sp, 'ayam');
  // peta
  const p1 = await b.c.post('/api/sahabat/jalan', { kind: 'peta' });
  assert.equal(p1.body.result?.kind, 'peta');
  assert.equal((await b.c.post('/api/sahabat/jalan', { kind: 'peta' })).body.result, null);
  const st = await state(b);
  assert.deepEqual(st.jalan, { kunjung: true, alun: true, peta: true });
  assert.equal(st.list.find((x: any) => x.id === bb.id).points, 3 * DEFAULT_SETTINGS.sahabat.points.jalan);
  // tanpa sahabat aktif: tidak ada keakraban
  await a.c.post('/api/sahabat/aktif', { id: null, requestId: rid() });
  assert.equal((await a.c.post('/api/sahabat/jalan')).body.result, null);
});

test('pengaturan admin: divalidasi, angka & buka/tutup berlaku, tugas harian ikut', async () => {
  const adm = client();
  assert.equal((await adm.post('/api/admin/login', { email: 'owner@test.local', password: 'rahasia-sekali-123' })).status, 200);
  const cur = (await adm.get('/api/admin/settings')).body;
  assert.ok(cur.value.sahabat && cur.help.sahabat.includes('Sahabat Mungil'));
  const put = (k: Record<string, unknown>) => adm.put('/api/admin/settings', { value: { ...cur.value, sahabat: { ...cur.value.sahabat, ...k } } });
  for (const bad of [{ akrabAt: 500, sejatiAt: 100 }, { mainPerDay: 99 }, { kuraPct: 150 }, { kunang: { fromHour: 19, toHour: 19 } }, { giftCoins: [20, 5] }, { gifts: { ...cur.value.sahabat.gifts, ayam: ['barang-gaib'] } }, { gifts: { ...cur.value.sahabat.gifts, ayam: ['sahabat-landak'] } }, { points: { makan: -1, main: 4, jalan: 4 } }]) {
    const r = await put(bad);
    assert.equal(r.status, 400, JSON.stringify(bad));
    assert.match(r.body.error.message, /Sahabat Mungil/);
  }
  assert.equal((await put({ mainPerDay: 5, points: { makan: 20, main: 2, jalan: 6 } })).status, 200);
  const cat = (await client().get('/api/catalog')).body;
  assert.deepEqual([cat.settings.sahabat.mainPerDay, cat.settings.sahabat.points.makan], [5, 20]);
  const a = await player('Penguji', 100);
  const b = await ayam(a);
  for (let i = 0; i < 5; i++) assert.equal((await a.c.post('/api/sahabat/main', { id: b.id, requestId: rid() })).body.result.counted, true);
  assert.equal((await a.c.post('/api/sahabat/main', { id: b.id, requestId: rid() })).body.result.counted, false);
  // ditutup: kegiatan ditolak, tugas harian sahabat tidak terpilih
  assert.equal((await put({ on: false })).status, 200);
  assert.equal((await a.c.post('/api/sahabat/main', { id: b.id, requestId: rid() })).body.error.code, 'sahabat_off');
  assert.equal((await a.c.get('/api/me')).body.sahabat.on, false);
  const { dailyPool } = await import('../src/lib/quests');
  const qs = await db.query(`select * from quests where active`);
  assert.ok(!dailyPool(qs, { features: {}, sahabat: { on: false } } as any).some((q: any) => q.id === 'h-sahabat'));
  assert.ok(dailyPool(qs, { features: {}, sahabat: { on: true } } as any).some((q: any) => q.id === 'h-sahabat'));
  assert.equal((await adm.put('/api/admin/settings', { value: cur.value })).status, 200);
  // jenis item & lokasi baru tersedia untuk admin
  const meta = (await adm.get('/api/admin/me')).body;
  assert.ok(meta.kinds.includes('sahabat') && meta.locationKinds.includes('sahabat'));
});

test('tugas harian "Beri makan sahabat" & lencana Kawan Satwa', async () => {
  await setGame({ quests: { dailyCount: 99 } });
  const a = await player('Rajin', 5000, 50);
  const b = await ayam(a);
  assert.equal((await buy(a, 'camilan-sahabat')).status, 200);
  await a.c.post('/api/sahabat/makan', { id: b.id, requestId: rid() });
  const ql = (await a.c.get('/api/quests')).body;
  assert.equal(ql.daily.find((q: any) => q.id === 'h-sahabat')?.done, true);
  for (const sp of ['umang', 'bebek']) assert.equal((await buy(a, `sahabat-${sp}`)).status, 200);
  let badges = (await a.c.get('/api/quests')).body.badges;
  assert.equal(badges.find((q: any) => q.id === 'b-sahabat-3').done, true);
  assert.equal(badges.find((q: any) => q.id === 'b-sahabat-6').progress, 3);
  for (const sp of ['kelinci', 'hamster', 'landak']) assert.equal((await buy(a, `sahabat-${sp}`, 'pearl')).status, 200);
  badges = (await a.c.get('/api/quests')).body.badges;
  assert.equal(badges.find((q: any) => q.id === 'b-sahabat-6').done, true);
  await setGame({ quests: { dailyCount: DEFAULT_SETTINGS.quests.dailyCount } });
});
