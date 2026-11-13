// Alun-alun v32 "Pojok Wahana": jadwal (panggung 8 acara, arak-arakan, lomba mancing, kereta, bianglala, malam) sebagai
// fungsi murni, wahana panjang (naik dulu, hadiah setelah selesai), jatah main bersama, acara malam, & paket konten v14.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config';
import {
  ALUN_D, ALUN_ITEMS, ALUN_LAYOUT, ALUN_W, BIANGLALA, DEFAULT_SETTINGS, KERETA, LOMBA, PARADE, PARADE_LEN, PARADE_ROUTE, POND, SQUARE_SHOWS, pondSeats,
  gondolaAngle, gondolaBottomAt, gondolaQueue, houseLayout, keretaAt, keretaCars, lombaAt, localHM, occupied, paradeAt, paradePoint, ringLen, ringPoint, squareNight, squareShow, tzOf,
} from '@kb/shared';

config.paymentProvider = 'mock';
config.adminEmail = 'owner@test.local';
config.adminPassword = 'rahasia-sekali-123';
const { buildApp } = await import('../src/app');
const { resetSquares, setSquareClock, resetSquareActGap } = await import('../src/routes/square');
const { seedPackV14 } = await import('../src/db/seed-alun');
const { getCatalog, coinMultiplier } = await import('../src/lib/core');
/** koin setelah pengali event (bila ada event berjalan) */
const coinsOf = async (n: number) => Math.round(n * coinMultiplier(await getCatalog(db)));
let app: any;
let db: any;
before(async () => { ({ app, db } = await buildApp({ memoryDb: true, logger: false, rateLimit: false, worker: false })); });
after(async () => { setSquareClock(() => Date.now()); await app?.close(); });

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
  return { call, get: (u: string) => call('GET', u), post: (u: string, b?: unknown) => call('POST', u, b ?? {}) };
}
async function player(name: string) {
  const c = client();
  await c.post('/api/auth/guest');
  const p = await c.post('/api/pet', { name, color: '#F6B7A8', ear: 'tunas' });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  return { c, id: p.body.state.user.id as string, name };
}
const sync = (p: any, body: any = {}) => p.c.post('/api/square/sync', { x: 10, y: 18, ...body });
const setSquare = async (patch: Record<string, unknown>) => {
  const row = await db.one(`select value from settings where key = 'game'`);
  const v = row?.value ?? {};
  v.square = { ...(v.square ?? {}), ...patch };
  await db.query(`insert into settings (key, value) values ('game', $1::text::jsonb) on conflict (key) do update set value = excluded.value`, [JSON.stringify(v)]);
  (await import('../src/lib/core')).invalidateCaches();
};
/** 13 Nov 2026 pukul hh:mm WIB (ms) */
const wib = (h: number, m = 0, s = 0) => Date.UTC(2026, 10, 13, h - 7, m, s);

/* ---------------- fungsi murni ---------------- */

test('jadwal panggung: 8 acara bergiliran (2,5 mnt per acara), musik & non-musik selang-seling', () => {
  assert.equal(SQUARE_SHOWS.length, 8);
  const seen: string[] = [];
  for (let k = 0; k < 8; k++) seen.push(squareShow(k * 150_000 + 1000).key);
  assert.deepEqual(seen, ['orkes', 'wayang', 'tari', 'sulap', 'angklung', 'silat', 'kudalumping', 'lawak']);
  assert.equal(squareShow(8 * 150_000 + 1000).key, 'orkes', 'satu putaran 20 menit');
  assert.deepEqual(SQUARE_SHOWS.map((s) => s.music), [true, false, true, false, true, false, true, false]);
  // jeda 30 detik: tidak ada musik, acara berikutnya diumumkan
  const brk = squareShow(4 * 150_000 + 125_000);
  assert.equal(brk.playing, false); assert.equal(brk.music, false); assert.equal(brk.next.key, 'silat');
  assert.equal(squareShow(4 * 150_000 + 5000).music, true, 'angklung: bisa joget');
});

test('arak-arakan: tiap 10 menit mulai menit :05, ±2,5 menit, bisa ikut 2 menit sebelum s.d. 45 detik sesudah mulai', () => {
  const p0 = paradeAt(wib(20, 2, 30));
  assert.equal(p0.on, false); assert.equal(p0.start, wib(20, 5)); assert.equal(p0.joinable, false, '2,5 menit sebelum mulai');
  assert.equal(paradeAt(wib(20, 3, 30)).joinable, true, '90 detik sebelum mulai');
  const on = paradeAt(wib(20, 6));
  assert.equal(on.on, true); assert.equal(on.start, wib(20, 5)); assert.equal(on.end, wib(20, 7, 30));
  assert.equal(on.joinable, false, '60 detik setelah mulai: rombongan sudah jauh');
  assert.equal(paradeAt(wib(20, 5, 30)).joinable, true);
  assert.equal(paradeAt(wib(20, 15, 10)).on, true, ':15 berikutnya');
  assert.equal(paradeAt(wib(20, 12)).start, wib(20, 15));
  // pemimpin di depan, pengikut berurutan di belakang; pengikut terakhir sampai gerbang tepat di akhir
  const mid = paradeAt(wib(20, 6, 10));
  assert.ok(mid.lead > mid.second && mid.second > mid.slot(0) && mid.slot(0) > mid.slot(7));
  const end = paradeAt(wib(20, 7, 29) + 999);
  assert.ok(Math.abs(end.slot(PARADE.max - 1) - PARADE_LEN) < 0.1, 'pengikut ke-8 sampai di gerbang');
  // rute di jalan batu & di dalam lapangan, mulai & selesai di gerbang depan
  const a = paradePoint(0), z = paradePoint(PARADE_LEN);
  assert.ok(a.y > 21 && z.y > 21 && Math.abs(a.x - 10) < 1 && Math.abs(z.x - 10) < 1);
  for (const [x, y] of PARADE_ROUTE) assert.ok(x > 0 && x < ALUN_W && y > 0 && y < ALUN_D);
});

test('lomba mancing: tiap 20 menit (:00, :20, :40) selama 3 menit, pendaftaran 1 menit sebelumnya', () => {
  assert.equal(LOMBA.everyMs, 20 * 60_000);
  const w = lombaAt(wib(9, 15));
  assert.equal(w.phase, 'tunggu'); assert.equal(w.start, wib(9, 20)); assert.equal(w.inMs, 5 * 60_000);
  assert.equal(lombaAt(wib(9, 19, 10)).phase, 'daftar');
  const on = lombaAt(wib(9, 21));
  assert.equal(on.phase, 'lomba'); assert.equal(on.leftMs, 120_000); assert.equal(on.end, wib(9, 23));
  assert.equal(lombaAt(wib(9, 23, 5)).phase, 'hasil');
  assert.equal(lombaAt(wib(9, 23, 20)).phase, 'tunggu');
  assert.equal(lombaAt(wib(9, 40, 30)).phase, 'lomba');
});

test('kereta kelinci: berhenti 15 detik di halte, satu putaran rel ±105 detik, tiap 2 menit; rel di luar lapangan', () => {
  const lap = Math.floor(wib(10) / KERETA.lapMs) * KERETA.lapMs;
  const st = keretaAt(lap + 5000);
  assert.equal(st.stopped, true); assert.equal(st.u, KERETA.halteU); assert.equal(st.arriveAt, lap + KERETA.lapMs);
  const head = ringPoint(KERETA.halteU);
  assert.ok(head.x > ALUN_W && Math.abs(head.y - 20.35) < 0.01, 'hidung lokomotif di depan halte (27, 18–20)');
  const mv = keretaAt(lap + 15_000 + 52_500);
  assert.equal(mv.stopped, false);
  assert.ok(Math.abs(mv.u - (KERETA.halteU + ringLen() / 2)) < 0.01, 'setengah putaran di tengah perjalanan');
  assert.ok(Math.abs(ringLen() - 104.5) < 0.1);
  for (let u = 0; u < ringLen(); u += 0.7) { const p = ringPoint(u); assert.ok(p.x < 0 || p.y < 0 || p.x > ALUN_W || p.y > ALUN_D, `rel di luar lapangan (${p.x}, ${p.y})`); }
  assert.equal(keretaCars(KERETA.halteU).length, 4, 'lokomotif + 3 gerbong');
});

test('bianglala: tiap gondola tiba di bawah sekali per menit, berselang 10 detik', () => {
  const now = wib(11, 0, 3);
  const q = gondolaQueue(now);
  assert.equal(q.length, BIANGLALA.gondolas);
  for (let i = 1; i < q.length; i++) assert.equal(q[i].at - q[i - 1].at, 10_000);
  assert.ok(q[0].at >= now && q[0].at - now <= 10_000, 'paling lama menunggu 10 detik');
  for (let k = 0; k < 6; k++) { const t = gondolaBottomAt(now, k); assert.equal(Math.round(gondolaAngle(t, k)) % 360, 90, 'di bawah'); assert.equal(gondolaBottomAt(t + 1, k), t + BIANGLALA.periodMs); }
});

test('malam: layar tancap 19.00–22.00, kembang api 20.00 & 21.00 (2 menit), jam setempat WIB/WITA/WIT', () => {
  assert.equal(squareNight(18, 59).layar, false); assert.equal(squareNight(19, 0).layar, true); assert.equal(squareNight(21, 59).layar, true); assert.equal(squareNight(22, 0).layar, false);
  assert.equal(squareNight(20, 0).kembangApi, true); assert.equal(squareNight(20, 1).kembangApi, true); assert.equal(squareNight(20, 2).kembangApi, false);
  assert.equal(squareNight(21, 1).kembangApi, true); assert.equal(squareNight(19, 0).kembangApi, false);
  const t = Date.UTC(2026, 10, 13, 12, 30);
  assert.deepEqual([localHM(t, 420).h, localHM(t, 480).h, localHM(t, 540).h], [19, 20, 21]);
  assert.equal(tzOf(480), 480); assert.equal(tzOf(-300), 420, 'zona lain dianggap WIB'); assert.equal(tzOf('x'), 420);
});

test('lapangan 28×22: denah persegi panjang, kolam & gapura menghalangi seperlunya, benda lama tidak bergeser', () => {
  const plan = houseLayout([{ id: 'alun', size: ALUN_W, w: ALUN_W, d: ALUN_D, theme: 'luar' }]);
  assert.equal(plan.W, 28); assert.equal(plan.D, 22);
  assert.equal(plan.rooms[0].L.length, 22); assert.equal(plan.rooms[0].R.length, 28);
  assert.ok(plan.at(27.5, 21.5) && !plan.at(28.2, 5) && !plan.at(5, 22.2));
  assert.ok(plan.pass(26, 21, 27, 21));
  const occ = occupied(ALUN_LAYOUT, ALUN_ITEMS);
  assert.ok(occ.has('22,8') && occ.has('25,10'), 'air kolam menghalangi');
  assert.ok(occ.has('20,12') && occ.has('20,15') && !occ.has('20,13') && !occ.has('20,14'), 'gapura: tengahnya jalan');
  assert.ok(!occ.has('14,4'), 'proyektor siang tidak menghalangi');
  // kolam: 6 dermaga, tempat berdiri sebelum naik dermaga bisa dicapai (untuk alur mancing bareng nanti)
  const seats = pondSeats();
  assert.equal(seats.length, 6);
  for (const st of seats) {
    assert.ok(st.x > POND.x && st.x < POND.x + POND.w && st.y > POND.y && st.y < POND.y + POND.d, `dermaga ${st.n} di kolam`);
    assert.ok(!occ.has(st.from.join(',')), `petak naik dermaga ${st.n} kosong`);
  }
  // benda lama (v0.31) tetap di tempat & urutannya sama
  assert.deepEqual(ALUN_LAYOUT[10], { i: 'alun-panggung', x: 8, y: 0 });
  assert.deepEqual(ALUN_LAYOUT[34], { i: 'alun-garisstart', x: 14, y: 15 }, 'benda baru ditambah di akhir');
  for (const p of ALUN_LAYOUT) { const f = ALUN_ITEMS[p.i].data; assert.ok(p.x >= 0 && p.y >= 0 && p.x + f.w <= ALUN_W && p.y + f.d <= ALUN_D, `${p.i} di dalam lapangan`); }
});

/* ---------------- server ---------------- */

test('wahana: bianglala naik dulu, hadiah wahana panjang setelah satu putaran; pemain lain melihat gondolanya', async () => {
  resetSquares();
  const base = wib(15, 0, 1);
  let now = base;
  setSquareClock(() => now);
  try {
    const a = await player('Biang1'), b = await player('Biang2');
    await sync(a); await sync(b);
    const coin0 = (await a.c.get('/api/me')).body.wallet.coin;
    const r = await a.c.post('/api/square/ride', { kind: 'bianglala' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const ride = r.body.ride;
    assert.ok(ride.from >= base && ride.from - base <= 10_400 && ride.until === ride.from + 60_000);
    assert.equal(r.body.wallet, undefined, 'naik belum memberi hadiah');
    resetSquareActGap();
    assert.equal((await a.c.post('/api/square/ride', { kind: 'bianglala', done: true })).body.error?.code, 'too_soon', 'belum satu putaran');
    assert.equal((await a.c.post('/api/square/act', { kind: 'duduk' })).body.error?.code, 'riding', 'tidak bisa main lain saat di wahana');
    // gondola berikutnya: 2 kursi per gondola
    resetSquareActGap();
    const r2 = await b.c.post('/api/square/ride', { kind: 'bianglala' });
    assert.equal(r2.body.ride.seat, ride.seat, 'gondola yang sama masih ada kursi');
    now = ride.from + 1000;
    const seen = (await sync(b)).body.members.find((m: any) => m.name === 'Biang1');
    assert.equal(seen.act, `bianglala:${ride.seat}`, 'pemain lain melihat di gondola mana');
    now = ride.until;
    const done = await a.c.post('/api/square/ride', { kind: 'bianglala', done: true });
    assert.equal(done.status, 200, JSON.stringify(done.body));
    assert.equal(done.body.rewarded, true);
    assert.equal(done.body.coins, await coinsOf(DEFAULT_SETTINGS.square.rideCoins));
    assert.equal(done.body.xp, DEFAULT_SETTINGS.square.rideXp);
    assert.equal(done.body.ceria, DEFAULT_SETTINGS.square.rideCeria);
    assert.equal(done.body.wallet.coin, coin0 + done.body.coins);
    assert.equal((await a.c.post('/api/square/ride', { kind: 'bianglala', done: true })).body.error?.code, 'no_ride', 'hadiah hanya sekali');
  } finally { setSquareClock(() => Date.now()); }
});

test('wahana: kereta hanya bisa dinaiki saat di halte, 6 kursi; arak-arakan maks. 8 pengikut', async () => {
  resetSquares();
  const lap = Math.floor(wib(16, 1) / KERETA.lapMs) * KERETA.lapMs;
  let now = lap + 40_000;
  setSquareClock(() => now);
  try {
    const ps = [];
    for (let i = 0; i < 9; i++) { const p = await player(`Kr${i}`); await sync(p); ps.push(p); }
    const moving = await ps[0].c.post('/api/square/ride', { kind: 'kereta' });
    assert.equal(moving.body.error?.code, 'not_yet', 'kereta sedang berjalan');
    assert.ok(moving.body.error.message.includes('detik'));
    now = lap + KERETA.lapMs + 3000; // kereta berikutnya berhenti di halte
    const seats = [];
    for (const p of ps.slice(0, 7)) { resetSquareActGap(); seats.push(await p.c.post('/api/square/ride', { kind: 'kereta' })); }
    assert.deepEqual(seats.slice(0, 6).map((r) => r.body.ride.seat).sort(), [0, 1, 2, 3, 4, 5]);
    assert.equal(seats[6].body.error?.code, 'full', 'kursi ke-7: tunggu kereta berikutnya');
    assert.equal(seats[0].body.ride.until, lap + 2 * KERETA.lapMs, 'turun saat kereta tiba lagi di halte');
    // arak-arakan
    now = wib(16, 1);
    resetSquareActGap();
    assert.equal((await ps[8].c.post('/api/square/ride', { kind: 'arak' })).body.error?.code, 'no_parade');
    now = wib(16, 4, 30);
    const joined = [];
    for (const p of [...ps.slice(6, 9), ...ps.slice(0, 6)]) { resetSquareActGap(); await p.c.post('/api/square/ride', { kind: 'kereta', cancel: true }); joined.push(await p.c.post('/api/square/ride', { kind: 'arak' })); }
    assert.equal(joined.filter((r) => r.status === 200).length, 8);
    assert.equal(joined[8].body.error?.code, 'full', 'maksimal 8 pet');
    assert.equal(joined[0].body.ride.from, wib(16, 5)); assert.equal(joined[0].body.ride.until, wib(16, 7, 30));
  } finally { setSquareClock(() => Date.now()); }
});

test('jatah main bersama: aksi singkat 3/2/6, wahana panjang 5/3/8; lewat jatah tetap jalan tanpa hadiah', async () => {
  resetSquares();
  await setSquare({ actsPerDay: 2 });
  const base = wib(13, 0, 1);
  let now = base;
  setSquareClock(() => now);
  try {
    const a = await player('Jatah1');
    await sync(a);
    const s1 = await a.c.post('/api/square/act', { kind: 'duduk' });
    assert.equal(s1.body.rewarded, true); assert.equal(s1.body.coins, await coinsOf(3)); assert.equal(s1.body.xp, 2); assert.equal(s1.body.ceria, 6); assert.equal(s1.body.left, 1);
    resetSquareActGap();
    const r = (await a.c.post('/api/square/ride', { kind: 'bianglala' })).body.ride;
    now = r.until;
    const d1 = await a.c.post('/api/square/ride', { kind: 'bianglala', done: true });
    assert.equal(d1.body.rewarded, true); assert.equal(d1.body.coins, await coinsOf(5)); assert.equal(d1.body.xp, 3); assert.equal(d1.body.ceria, 8); assert.equal(d1.body.left, 0);
    resetSquareActGap();
    const r2 = (await a.c.post('/api/square/ride', { kind: 'bianglala' })).body.ride;
    now = r2.until;
    const coin = (await a.c.get('/api/me')).body.wallet.coin;
    const d2 = await a.c.post('/api/square/ride', { kind: 'bianglala', done: true });
    assert.equal(d2.status, 200);
    assert.equal(d2.body.rewarded, false, 'lewat jatah: wahana tetap jalan');
    assert.equal(d2.body.coins, 0); assert.equal(d2.body.ceria, 0);
    assert.equal((await a.c.get('/api/me')).body.wallet.coin, coin);
    resetSquareActGap();
    const g = await a.c.post('/api/square/act', { kind: 'gelang' });
    assert.equal(g.status, 200); assert.equal(g.body.hits.length, 3, 'tiga lemparan diundi server'); assert.equal(g.body.rewarded, false); assert.equal(g.body.bonus, 0);
  } finally { setSquareClock(() => Date.now()); await setSquare({ actsPerDay: 14 }); }
});

test('malam: layar tancap & kembang api memakai jam setempat pemain; kembang api +ceria sekali sehari tanpa koin', async () => {
  resetSquares();
  let now = wib(12);
  setSquareClock(() => now);
  try {
    const a = await player('Malam1');
    await sync(a);
    assert.equal((await a.c.post('/api/square/act', { kind: 'layar', tz: 420 })).body.error?.code, 'not_night', 'siang WIB');
    // 12.30 UTC = 19.30 WIB, 20.30 WITA
    now = Date.UTC(2026, 10, 13, 12, 30);
    resetSquareActGap();
    const l = await a.c.post('/api/square/act', { kind: 'layar', tz: 420 });
    assert.equal(l.status, 200, JSON.stringify(l.body)); assert.equal(l.body.rewarded, true);
    assert.equal((await a.c.post('/api/square/act', { kind: 'kembangapi', tz: 420 })).body.error?.code, 'not_now', '19.30 WIB: belum ada kembang api');
    // 13.01 UTC = 20.01 WIB
    now = Date.UTC(2026, 10, 13, 13, 1);
    await db.query(`update pets set ceria = 40 where user_id = $1`, [a.id]);
    const coin = (await a.c.get('/api/me')).body.wallet.coin;
    const fw = await a.c.post('/api/square/act', { kind: 'kembangapi', tz: 420 });
    assert.equal(fw.status, 200, JSON.stringify(fw.body)); assert.equal(fw.body.rewarded, true); assert.equal(fw.body.ceria, 6);
    assert.ok(fw.body.pet.needs.ceria > 40);
    assert.equal((await a.c.get('/api/me')).body.wallet.coin, coin, 'tanpa koin');
    const again = await a.c.post('/api/square/act', { kind: 'kembangapi', tz: 420 });
    assert.equal(again.body.rewarded, false, 'sekali sehari');
    // zona lain: 12.00 UTC = 20.00 WITA
    now = Date.UTC(2026, 10, 13, 12, 0, 30);
    const b = await player('Malam2');
    await sync(b);
    assert.equal((await b.c.post('/api/square/act', { kind: 'kembangapi', tz: 480 })).body.rewarded, true, 'WITA');
  } finally { setSquareClock(() => Date.now()); }
});

test('pengaturan alun-alun: nilai wahana bawaan & validasi admin', async () => {
  const sq = DEFAULT_SETTINGS.square;
  assert.equal(sq.actsPerDay, 14); assert.equal(sq.rideCoins, 5); assert.equal(sq.rideXp, 3); assert.equal(sq.rideCeria, 8); assert.equal(sq.actCoins, 3); assert.equal(sq.actXp, 2); assert.equal(sq.ceria, 6);
  const adm = client();
  assert.equal((await adm.post('/api/admin/login', { email: 'owner@test.local', password: 'rahasia-sekali-123' })).status, 200);
  const cur = (await adm.get('/api/admin/settings')).body.value;
  const bad = await adm.call('PUT', '/api/admin/settings', { value: { ...cur, square: { ...cur.square, actsPerDay: 500 } } });
  assert.equal(bad.status, 400);
  assert.equal((await adm.call('PUT', '/api/admin/settings', { value: { ...cur, square: { ...cur.square, rideCoins: -1 } } })).status, 400);
  const ok = await adm.call('PUT', '/api/admin/settings', { value: { ...cur, square: { ...cur.square, rideCoins: 7 } } });
  assert.equal(ok.status, 200); assert.equal(ok.body.value.square.rideCoins, 7);
  await adm.call('PUT', '/api/admin/settings', { value: cur });
});

test('paket konten v14: jatah main tersimpan 10 → 14, nilai yang diubah admin dibiarkan', async () => {
  const put = async (sq: any) => {
    await db.query(`insert into settings (key, value) values ('game', $1::text::jsonb) on conflict (key) do update set value = excluded.value`, [JSON.stringify({ square: sq })]);
    // DB lama: belum ada penanda paket
    await db.query(`update settings set value = '10'::jsonb where key = 'content_pack'`);
    await db.query(`delete from settings where key like 'pack\\_%'`);
  };
  const actsNow = async () => (await db.one(`select value from settings where key = 'game'`)).value.square.actsPerDay;
  await put({ actsPerDay: 10, max: 20 });
  assert.equal(await seedPackV14(db), true);
  assert.equal(await actsNow(), 14);
  assert.ok(Number((await db.one(`select value from settings where key = 'content_pack'`)).value) >= 14);
  assert.ok(await db.one(`select 1 from settings where key = 'pack_alun'`), 'penanda paket alun tercatat');
  assert.equal(await seedPackV14(db), false, 'sekali saja');
  await put({ actsPerDay: 12 });
  await seedPackV14(db);
  assert.equal(await actsNow(), 12, 'nilai admin dibiarkan');
  await db.query(`delete from settings where key = 'game'`);
  (await import('../src/lib/core')).invalidateCaches();
});

/* ---------------- Kolam Pemancingan Bareng & Lomba Mancing ---------------- */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const FAST = { castsPerDay: 500, waitMs: { dekat: [100, 100], sedang: [100, 100], jauh: [100, 100] }, nibbleMax: 0, fightMs: { biasa: [300, 300], jarang: [300, 300], langka: [300, 300], legenda: [300, 300], sampah: [300, 300], harta: [300, 300] } };
const setGame = async (patch: Record<string, any>) => {
  const row = await db.one(`select value from settings where key = 'game'`);
  const v = row?.value ?? {};
  for (const [k, p] of Object.entries(patch)) v[k] = { ...(v[k] ?? {}), ...p };
  await db.query(`insert into settings (key, value) values ('game', $1::text::jsonb) on conflict (key) do update set value = excluded.value`, [JSON.stringify(v)]);
  (await import('../src/lib/core')).invalidateCaches();
};
/** kolam hanya berisi Ikan Mas (dipulihkan sesudahnya) */
async function onlyMas() {
  const pond = await db.query(`select id, active from items where (data->>'fishWeight') is not null`);
  await db.query(`update items set active = (id = 'ikan-mas') where (data->>'fishWeight') is not null`);
  (await import('../src/lib/core')).invalidateCaches();
  return async () => { for (const r of pond) await db.query(`update items set active = $2 where id = $1`, [r.id, r.active]); (await import('../src/lib/core')).invalidateCaches(); };
}
/** satu lemparan sampai mendarat lewat API alun-alun */
async function catchAlun(p: any, dist = 'dekat') {
  const c = await p.c.post('/api/square/fish/cast', { distance: dist });
  assert.equal(c.status, 200, JSON.stringify(c.body));
  await sleep(c.body.biteInMs + 40);
  const h = await p.c.post('/api/square/fish/hook', { castId: c.body.castId });
  assert.equal(h.body.result, 'hooked', JSON.stringify(h.body));
  await sleep(c.body.fight.minMs + 40);
  const l = await p.c.post('/api/square/fish/land', { castId: c.body.castId });
  assert.equal(l.status, 200, JSON.stringify(l.body));
  return { cast: c.body, land: l.body };
}

test('kolam alun-alun: dermaga diduduki bergantian, mancing santai memakai jatah kolam & masuk Tas', async () => {
  resetSquares();
  await setGame({ fishing: FAST });
  const restore = await onlyMas();
  // di luar jam lomba (menit :10)
  setSquareClock(() => wib(14, 10));
  try {
    const a = await player('Pancing1'), b = await player('Pancing2');
    await sync(a); await sync(b);
    assert.equal((await a.c.post('/api/square/fish/cast', { distance: 'dekat' })).body.error?.code, 'no_pier', 'harus duduk di dermaga');
    const pa = await a.c.post('/api/square/pier', { n: 3 });
    assert.equal(pa.body.pier, 3);
    assert.equal((await b.c.post('/api/square/pier', { n: 3 })).body.pier, 1, 'dermaga terisi: dapat yang kosong');
    const seen = (await sync(b)).body.members.find((m: any) => m.name === 'Pancing1');
    assert.equal(seen.act, 'kolam:3', 'pemain lain melihat siapa di dermaga mana');
    const left0 = (await a.c.get('/api/me')).body.limits.fishingLeft;
    const { cast, land } = await catchAlun(a);
    assert.equal(cast.mode, 'santai');
    assert.equal(land.result, 'caught');
    assert.equal(land.item.id, 'ikan-mas');
    assert.equal(land.inventory['ikan-mas'], 1, 'masuk Tas seperti kolam di rumah');
    assert.equal(land.limits.fishingLeft, left0 - 1, 'jatah lempar harian bersama');
    // berdiri: dermaga kosong lagi
    await a.c.post('/api/square/pier', { leave: true });
    assert.equal((await b.c.post('/api/square/pier', { n: 3 })).body.pier, 1, 'tetap di dermaganya sendiri');
    const seen2 = (await sync(b)).body.members.find((m: any) => m.name === 'Pancing1');
    assert.equal(seen2.act, null);
  } finally { setSquareClock(() => Date.now()); await restore(); }
});

test('Lomba Mancing: jatah lomba sendiri, energi masuk sekali, tangkap-lepas, papan skor, hadiah sekali dari server', async () => {
  resetSquares();
  await setGame({ fishing: FAST, square: { max: 2 } });
  const restore = await onlyMas();
  const start = wib(15, 20);
  let now = start + 5000;
  setSquareClock(() => now);
  try {
    const a = await player('Lomba1'), b = await player('Lomba2'), c = await player('Lomba3');
    await sync(a); await sync(b);
    const rc = await sync(c);
    assert.equal(rc.body.inst, 2, 'alun-alun 1 penuh');
    for (const p of [a, b, c]) await p.c.post('/api/square/pier', {});
    await db.query(`update pets set energi = 80 where user_id = any($1::uuid[])`, [[a.id, b.id, c.id]]);
    const me0 = (await a.c.get('/api/me')).body;
    const r1 = await catchAlun(a);
    assert.equal(r1.cast.mode, 'lomba');
    assert.equal(r1.cast.contest.id, `1:${start}`, 'lomba per alun-alun');
    assert.equal(r1.cast.lombaLeft, 11);
    assert.equal(r1.land.released, true); assert.equal(r1.land.lomba, true);
    assert.ok(r1.land.grams > 0);
    assert.equal(r1.land.inventory, undefined, 'ikan lomba tidak masuk Tas');
    assert.equal(r1.land.limits.fishingLeft, me0.limits.fishingLeft, 'jatah kolam tidak terpakai');
    assert.ok(Math.abs(r1.cast.pet.needs.energi - (80 - 6)) < 1, 'energi masuk lomba');
    const r2 = await catchAlun(a);
    assert.ok(Math.abs(r2.cast.pet.needs.energi - r1.cast.pet.needs.energi) < 1, 'lemparan berikutnya tanpa energi');
    assert.equal(r2.cast.lombaLeft, 10);
    // lemparan lomba tidak bisa diambil lewat Kolam Pancing (hadiah kolam)
    const rb = await b.c.post('/api/square/fish/cast', { distance: 'dekat' });
    await sleep(rb.body.biteInMs + 40);
    await b.c.post('/api/square/fish/hook', { castId: rb.body.castId });
    await sleep(rb.body.fight.minMs + 40);
    assert.equal((await b.c.post('/api/fish/land', { castId: rb.body.castId })).status, 400);
    const lb = await b.c.post('/api/square/fish/land', { castId: rb.body.castId });
    assert.equal(lb.body.result, 'caught');
    // alun-alun 2 punya lombanya sendiri
    const rcc = await catchAlun(c);
    assert.equal(rcc.cast.contest.id, `2:${start}`);
    // papan skor langsung
    const live = (await a.c.get('/api/square/lomba')).body.lomba;
    assert.equal(live.phase, 'lomba');
    assert.deepEqual(live.board.map((r: any) => r.name).sort(), ['Lomba1', 'Lomba2']);
    assert.equal(live.me.grams, r1.land.grams + r2.land.grams);
    // lomba selesai + masa tarik-ulur → hasil dihitung server (tanpa panggilan dari pemenang)
    now = start + 180_000 + 13_000;
    const coin0 = (await a.c.get('/api/me')).body.wallet.coin, coinB0 = (await b.c.get('/api/me')).body.wallet.coin;
    const res = (await c.c.get('/api/square/lomba')).body.lomba;
    assert.equal(res.phase, 'hasil');
    const done = await db.one(`select settled_at, results from square_contests where id = $1`, [`1:${start}`]);
    assert.ok(done.settled_at, 'lomba alun-alun 1 diselesaikan');
    const win = done.results.find((r: any) => r.name === live.board[0].name);
    assert.equal(win.rank, 1);
    assert.equal(win.coins, await coinsOf(40));
    const second = done.results.find((r: any) => r.rank === 2);
    assert.equal(second.coins, await coinsOf(25));
    const coin1 = (await a.c.get('/api/me')).body.wallet.coin, coinB1 = (await b.c.get('/api/me')).body.wallet.coin;
    assert.equal(coin1 + coinB1 - coin0 - coinB0, (await coinsOf(40)) + (await coinsOf(25)), 'hadiah juara dibayar');
    // satu peserta saja di alun-alun 2: tanpa peringkat, hadiah ikut serta
    const solo = await db.one(`select results from square_contests where id = $1`, [`2:${start}`]);
    assert.equal(solo.results[0].rank, 0); assert.equal(solo.results[0].coins, await coinsOf(5));
    // tidak dibayar dua kali
    await a.c.get('/api/square/lomba');
    assert.equal((await a.c.get('/api/me')).body.wallet.coin, coin1);
    const mine = (await sync(a)).body.lomba;
    assert.equal(mine.phase, 'hasil'); assert.ok(mine.results.length === 2 && mine.mine);
  } finally { setSquareClock(() => Date.now()); await restore(); await setGame({ square: { max: 20 } }); }
});

test('Lomba Mancing: seri → yang lebih dulu menang; jatah lomba habis → mancing santai; hadiah lomba berbatas per hari', async () => {
  resetSquares();
  await setGame({ fishing: FAST, square: { lomba: { castsPerDay: 1, entryEnergi: 6, prizes: [40, 25, 15], prizeXp: [10, 6, 4], joinCoins: 5, joinXp: 3, perDay: 1 } } });
  const restore = await onlyMas();
  try {
    const a = await player('Seri1'), b = await player('Seri2');
    // dua lomba buatan: skor sama, Seri2 lebih dulu
    for (const st of [wib(9, 0), wib(9, 20)]) {
      const id = `7:${st}`;
      await db.query(`insert into square_contests (id, inst, starts_at, ends_at) values ($1, 7, $2, $3)`, [id, new Date(st), new Date(st + 180_000)]);
      for (const [p, at] of [[a, st + 60_000], [b, st + 30_000]] as [any, number][])
        await db.query(`insert into fishing_casts (user_id, fish_id, cast_at, bite_at, window_ms, place, catch_kind, cm, result, resolved_at, contest) values ($1, 'ikan-mas', $2, $2, 1000, 'alun', 'fish', 30, 'caught', $3, $4)`, [p.id, new Date(at - 5000), new Date(at), id]);
    }
    setSquareClock(() => wib(9, 45));
    await sync(a);
    await a.c.get('/api/square/lomba');
    const r1 = (await db.one(`select results from square_contests where id = $1`, [`7:${wib(9, 0)}`])).results;
    assert.deepEqual(r1.map((r: any) => [r.name, r.rank]), [['Seri2', 1], ['Seri1', 2]], 'skor sama: yang lebih dulu juara');
    const r2 = (await db.one(`select results from square_contests where id = $1`, [`7:${wib(9, 20)}`])).results;
    assert.ok(r2.every((r: any) => r.coins === 0 && r.xp === 0), 'lomba berhadiah per hari dibatasi (perDay 1)');
    // jatah lomba 1: lemparan kedua saat lomba = mancing santai
    setSquareClock(() => wib(10, 0, 30));
    await sync(a);
    await a.c.post('/api/square/pier', {});
    const x1 = await catchAlun(a);
    assert.equal(x1.cast.mode, 'lomba');
    const x2 = await catchAlun(a);
    assert.equal(x2.cast.mode, 'santai');
    assert.ok(x2.land.inventory['ikan-mas'] >= 1);
  } finally {
    setSquareClock(() => Date.now()); await restore();
    await setGame({ square: { lomba: DEFAULT_SETTINGS.square.lomba } });
  }
});
