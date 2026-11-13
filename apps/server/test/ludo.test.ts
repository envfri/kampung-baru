// Ludo main bareng: aturan murni (papan, keluar kandang, 6 ketiga hangus, makan + lempar lagi, kotak aman, pulang harus pas,
// pilihan otomatis, jumlah bidak) & sesi di server (waktu habis, batas 15 menit, syarat hadiah 5 menit, pemain keluar).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config';
import {
  BARENG_GAMES, LUDO_BASES, LUDO_HOME, LUDO_LANES, LUDO_PATH, LUDO_SAFE, framesMs, ludoAbs, ludoAgain, ludoApply, ludoAutoPick, ludoCell, ludoDistinct,
  ludoFrames, ludoOptions, ludoPlan, ludoProgress, ludoRollRule, ludoSafe, ludoSeats, ludoTarget, ludoTokensFor, type LudoMove,
} from '@kb/shared';

config.paymentProvider = 'mock';
config.adminEmail = 'owner@test.local';
config.adminPassword = 'rahasia-sekali-123';
const { buildApp } = await import('../src/app');
const { resetSquares } = await import('../src/routes/square');
const { resetHouses } = await import('../src/routes/house');
const { resetBareng, setBarengClock, barengTick } = await import('../src/routes/bareng');
const { setLudoDice } = await import('../src/lib/ludo-game');
let app: any;
let db: any;
before(async () => {
  ({ app, db } = await buildApp({ memoryDb: true, logger: false, rateLimit: false, worker: false }));
  // tanpa event berpengali koin supaya angka hadiah pasti
  await db.query(`update events set active = false`);
  (await import('../src/lib/core')).invalidateCaches();
});
after(async () => { setBarengClock(() => Date.now()); setLudoDice(null); await app?.close(); });

let now = Date.now();
setBarengClock(() => now);
const later = (ms: number) => { now += ms; };
/** dadu berurutan (untuk uji); habis = 1 */
const diceSeq = (...xs: number[]) => setLudoDice(() => xs.shift() ?? 1);

/* ---------------- aturan murni ---------------- */

test('papan ludo: jalur 52 kotak, lajur pulang 5 kotak, 8 kotak aman, start tiap warna', () => {
  assert.equal(LUDO_PATH.length, 52);
  const key = ([c, r]: number[]) => `${c},${r}`;
  assert.equal(new Set(LUDO_PATH.map(key)).size, 52, 'kotak jalur tidak berulang');
  const inBase = (c: number, r: number) => LUDO_BASES.some(([x, y]) => c >= x && c < x + 6 && r >= y && r < y + 6);
  for (const [c, r] of LUDO_PATH) {
    assert.ok(c >= 0 && c < 15 && r >= 0 && r < 15 && !inBase(c, r), `jalur di luar kandang (${c},${r})`);
    assert.ok(!(c >= 6 && c <= 8 && r >= 6 && r <= 8), 'jalur tidak masuk rumah');
  }
  // kotak berurutan selalu bersebelahan (termasuk 51 → 0); di 4 pojok dalam jalur berbelok serong
  let diag = 0;
  for (let i = 0; i < 52; i++) {
    const [a, b] = [LUDO_PATH[i], LUDO_PATH[(i + 1) % 52]];
    assert.equal(Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])), 1, `kotak ${i} → ${i + 1}`);
    if (a[0] !== b[0] && a[1] !== b[1]) diag++;
  }
  assert.equal(diag, 4);
  assert.deepEqual(LUDO_SAFE, [0, 8, 13, 21, 26, 34, 39, 47]);
  for (let s = 0; s < 4; s++) {
    assert.equal(ludoAbs(s, 0), 13 * s, 'kotak start');
    assert.ok(ludoSafe(s, 0) && ludoSafe(s, 8), 'start & bintang aman');
    // kotak terakhir di jalur bersebelahan dengan lajur pulang, lajur menuju rumah di tengah
    const last = ludoCell(s, 50)!, lane0 = ludoCell(s, 51)!, lane4 = ludoCell(s, 55)!;
    assert.equal(Math.abs(last[0] - lane0[0]) + Math.abs(last[1] - lane0[1]), 1);
    assert.deepEqual(lane0, LUDO_LANES[s][0]);
    assert.equal(Math.abs(lane4[0] - 7) + Math.abs(lane4[1] - 7), 2, 'ujung lajur bersebelahan dengan rumah (3×3 di tengah)');
    assert.ok(ludoSafe(s, 53), 'lajur pulang aman');
    assert.equal(ludoCell(s, -1), null); assert.equal(ludoCell(s, LUDO_HOME), null);
  }
  // kotak start tiap warna di sebelah kandangnya
  assert.deepEqual([0, 1, 2, 3].map((s) => ludoCell(s, 0)), [[1, 6], [8, 1], [13, 8], [6, 13]]);
});

test('ludo: keluar kandang perlu 6; 6 ketiga berturut-turut hangus', () => {
  for (let r = 1; r <= 5; r++) assert.equal(ludoTarget(-1, r), null);
  assert.equal(ludoTarget(-1, 6), 0);
  const seat = { a: 0, b: 2 };
  assert.deepEqual(ludoOptions({ a: [-1, -1], b: [-1, -1] }, seat, 'a', 5), [], 'semua di kandang & bukan 6: tidak bisa jalan');
  const six = ludoOptions({ a: [-1, -1], b: [-1, -1] }, seat, 'a', 6);
  assert.equal(six.length, 2); assert.equal(ludoDistinct(six).length, 1, 'dua bidak di kandang = satu pilihan');
  assert.deepEqual(ludoRollRule(0, 6), { sixes: 1, void: false });
  assert.deepEqual(ludoRollRule(1, 6), { sixes: 2, void: false });
  assert.deepEqual(ludoRollRule(2, 6), { sixes: 3, void: true });
  assert.deepEqual(ludoRollRule(2, 5), { sixes: 0, void: false });
  assert.equal(ludoAgain(6, 1, null), true, '6 = lempar lagi');
  assert.equal(ludoAgain(6, 3, null), false, '6 ketiga: giliran selesai');
  assert.equal(ludoAgain(4, 0, null), false);
});

test('ludo: makan bidak lawan → kembali ke kandang + lempar lagi; kotak aman tidak bisa dimakan; tanpa benteng', () => {
  const seat = { a: 0, b: 2, c: 1 };
  // b (biru, start di 26) di r 36 = kotak jalur 10; a dari 5 dapat 5 → kotak 10
  assert.equal(ludoAbs(2, 36), 10);
  const m = ludoPlan({ a: [5, -1], b: [36, 36], c: [-1, -1] }, seat, 'a', 0, 5)!;
  assert.equal(m.to, 10);
  assert.deepEqual(m.capture.map((c) => `${c.id}:${c.k}`), ['b:0', 'b:1'], 'dua bidak lawan di kotak itu ikut dimakan (tanpa benteng)');
  const after = ludoApply({ a: [5, -1], b: [36, 36], c: [-1, -1] }, 'a', m);
  assert.deepEqual(after, { a: [10, -1], b: [-1, -1], c: [-1, -1] });
  assert.equal(ludoAgain(5, 0, m, { captureBonus: true }), true, 'makan = lempar lagi');
  assert.equal(ludoAgain(5, 0, m, { captureBonus: false }), false, 'bonus makan bisa dimatikan admin');
  // kotak bintang (8) dan kotak start lawan (26) aman: berbagi kotak, tidak dimakan
  assert.equal(ludoAbs(2, 34), 8);
  const star = ludoPlan({ a: [3], b: [34], c: [] }, seat, 'a', 0, 5)!;
  assert.equal(star.to, 8); assert.equal(star.safe, true); assert.deepEqual(star.capture, []);
  const start = ludoPlan({ a: [22], b: [0], c: [] }, seat, 'a', 0, 4)!;
  assert.equal(ludoAbs(0, start.to), 26); assert.deepEqual(start.capture, []);
  // bidak sendiri boleh bertumpuk; bidak lawan di kandang tidak tersentuh
  const own = ludoPlan({ a: [4, 9], b: [-1], c: [] }, seat, 'a', 0, 5)!;
  assert.equal(own.to, 9); assert.deepEqual(own.capture, []);
  // lajur pulang tidak pernah bertemu bidak lawan
  assert.deepEqual(ludoPlan({ a: [49], b: [25], c: [] }, seat, 'a', 0, 3)!.capture, []);
});

test('ludo: masuk rumah harus pas (kelebihan = bidak itu tidak bisa jalan), bidak di rumah diam', () => {
  assert.equal(ludoTarget(54, 2), 56);
  assert.equal(ludoTarget(54, 3), null);
  assert.equal(ludoTarget(50, 6), 56);
  assert.equal(ludoTarget(56, 1), null);
  const seat = { a: 0, b: 2 };
  const opts = ludoOptions({ a: [54, 56, 30], b: [] }, seat, 'a', 5);
  assert.deepEqual(opts.map((o) => o.token), [2], 'butuh 2: dadu 5 hanya untuk bidak lain');
  assert.deepEqual(ludoOptions({ a: [54, 56], b: [] }, seat, 'a', 5), [], 'tidak ada yang bisa jalan → giliran lewat');
  const home = ludoPlan({ a: [54, 56], b: [] }, seat, 'a', 0, 2)!;
  assert.equal(home.home, true);
  assert.equal(ludoAgain(2, 0, home, { done: true }), false);
  assert.equal(ludoAgain(6, 1, home, { done: true }), false, 'semua bidak pulang: giliran selesai walau dapat 6');
});

test('ludo: pilihan otomatis = makan > pulang > keluar kandang > kotak aman > bidak terdepan', () => {
  const mk = (o: Partial<LudoMove>): LudoMove => ({ token: 0, from: 10, to: 14, capture: [], home: false, safe: false, ...o });
  const cap = mk({ token: 0, from: 3, capture: [{ id: 'b', k: 0, from: 9 }] }), home = mk({ token: 1, from: 52, to: 56, home: true });
  const out = mk({ token: 2, from: -1, to: 0, safe: true }), safe = mk({ token: 3, from: 4, to: 8, safe: true });
  const far = mk({ token: 4, from: 30, to: 34 }), near = mk({ token: 5, from: 12, to: 16 });
  const list = [near, far, safe, out, home, cap];
  const order: number[] = [];
  while (list.length) { const m = ludoAutoPick(list)!; order.push(m.token); list.splice(list.indexOf(m), 1); }
  assert.deepEqual(order, [0, 1, 2, 3, 4, 5]);
  assert.equal(ludoAutoPick([]), null);
});

test('ludo: bidak per jumlah pemain (berdua 4, bertiga/berempat 2), kursi berseberangan, langkah untuk peringkat, animasi', () => {
  assert.deepEqual([2, 3, 4].map((n) => ludoTokensFor(n)), [4, 2, 2]);
  assert.equal(ludoTokensFor(3, { 2: 4, 3: 3, 4: 2 }), 3, 'diatur admin');
  assert.deepEqual(ludoSeats(2), [0, 2]); assert.deepEqual(ludoSeats(3), [0, 1, 2]); assert.deepEqual(ludoSeats(4), [0, 1, 2, 3]);
  assert.equal(ludoProgress([56, 48]), 104); assert.equal(ludoProgress([-1, 0]), 0);
  const st = { roll: 4, token: 0, from: 10, to: 14, capture: [{ id: 'b', k: 0, from: 30 }], home: false };
  assert.deepEqual(ludoFrames(st).map((f) => `${f.kind}:${f.r}`), ['step:11', 'step:12', 'step:13', 'step:14', 'capture:14']);
  assert.equal(framesMs(ludoFrames(st, { dice: true, wait: true })), 700 + 300 + 4 * 190 + 700);
  assert.deepEqual(ludoFrames({ roll: 6, token: 1, from: -1, to: 0, capture: [], home: false }).map((f) => f.kind), ['out']);
  assert.deepEqual(ludoFrames({ roll: 2, token: 1, from: 54, to: 56, capture: [], home: true }).map((f) => f.kind), ['step', 'step', 'home']);
  assert.equal(framesMs(ludoFrames({ roll: 5, token: null, from: -1, to: -1, capture: [], home: false, pass: true }, { dice: true })), 1500);
  assert.deepEqual(BARENG_GAMES.ludo, { name: 'Ludo', min: 2, max: 4, places: ['house', 'alun'], inviteMs: 20_000, turnMs: 10_000, maxMs: 15 * 60_000, long: true });
});

/* ---------------- sesi di server ---------------- */

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
async function player(name: string) {
  const c = client();
  await c.post('/api/auth/guest');
  const p = await c.post('/api/pet', { name, color: '#F6B7A8', ear: 'tunas', ownerName: name });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  return { c, id: p.body.state.user.id as string, code: p.body.state.user.friend_code as string, room: p.body.state.rooms[0].id as string, name };
}
const square = (p: any) => p.c.post('/api/square/sync', { x: 10, y: 18 });
const gameOf = async (p: any, id: string) => (await square(p)).body.games.find((g: any) => g.id === id);
const coopCount = async (uid: string) => (await db.one(`select count from daily_counters where user_id = $1 and key = 'coop'`, [uid]))?.count ?? 0;
async function setGame(patch: Record<string, unknown>) {
  const row = await db.one(`select value from settings where key = 'game'`);
  const v = { ...(row?.value ?? {}), ...patch };
  await db.query(`insert into settings (key, value) values ('game', $1::text::jsonb) on conflict (key) do update set value = excluded.value`, [JSON.stringify(v)]);
  (await import('../src/lib/core')).invalidateCaches();
}
/** n pemain di alun-alun, ajakan Ludo dimulai oleh pemain pertama */
async function ludoIn(names: string[]) {
  resetSquares(); resetBareng();
  const ps = [];
  for (const n of names) { const p = await player(n); await square(p); ps.push(p); }
  const id = (await ps[0].c.post('/api/bareng/start', { game: 'ludo' })).body.game.id;
  for (const p of ps.slice(1)) assert.equal((await p.c.post(`/api/bareng/${id}/join`)).status, 200);
  let g = await gameOf(ps[0], id);
  if (g.phase === 'ajak') g = (await ps[0].c.post(`/api/bareng/${id}/go`)).body.game;
  assert.equal(g.phase, 'main');
  const by: Record<string, any> = Object.fromEntries(ps.map((p) => [p.id, p]));
  return { ps, id, g, by };
}

test('ludo di rumah: berdua 4 bidak di kursi berseberangan, 6 keluar kandang + lempar lagi, pilih bidak, 6 ketiga hangus, giliran', async () => {
  resetHouses(); resetBareng();
  const host = await player('Ludo1'), guest = await player('Ludo2');
  await guest.c.post('/api/friends', { code: host.code });
  const sync = (p: any) => p.c.post(`/api/house/${host.id}/sync`, { roomId: host.room, x: 2, y: 2 });
  await sync(host); await sync(guest);
  const st = await host.c.post('/api/bareng/start', { game: 'ludo', hostId: host.id });
  assert.equal(st.status, 200, JSON.stringify(st.body));
  const id = st.body.game.id;
  let g = (await guest.c.post(`/api/bareng/${id}/join`)).body.game;
  assert.equal(g.phase, 'ajak', '2 dari 4 kursi: masih menunggu');
  g = (await host.c.post(`/api/bareng/${id}/go`)).body.game;
  assert.equal(g.phase, 'main');
  assert.equal(g.ludo.perSeat, 4, 'berdua: 4 bidak');
  assert.deepEqual(g.ludo.seat, { [host.id]: 0, [guest.id]: 2 }, 'hijau & biru berseberangan');
  assert.deepEqual(g.ludo.tok[host.id], [-1, -1, -1, -1]);
  assert.equal(g.turn, host.id);
  assert.ok(g.turnUntil - g.serverNow >= 9_900, '10 detik untuk melempar');
  assert.equal((await guest.c.post(`/api/bareng/${id}/move`, { roll: true })).body.error.code, 'not_turn');
  assert.equal((await host.c.post(`/api/bareng/${id}/move`, { token: 0 })).body.error.code, 'invalid_move', 'lempar dulu');
  // 6: semua bidak di kandang = satu pilihan → langsung keluar, lalu lempar lagi
  diceSeq(6, 6, 6);
  g = (await host.c.post(`/api/bareng/${id}/move`, { roll: true })).body.game;
  assert.deepEqual(g.ludo.tok[host.id], [0, -1, -1, -1]);
  assert.equal(g.last.token, 0); assert.equal(g.last.again, true); assert.equal(g.turn, host.id);
  assert.equal(g.last.anim, 700 + 300 + 400, 'dadu + jeda + keluar kandang');
  // 6 kedua: dua pilihan (jalan 6 atau keluarkan bidak lain) → pilih bidak
  g = (await host.c.post(`/api/bareng/${id}/move`, { roll: true })).body.game;
  assert.equal(g.ludo.phase, 'pick'); assert.equal(g.ludo.roll, 6);
  assert.deepEqual(g.ludo.movable, [0, 1, 2, 3]);
  assert.ok(g.turnUntil - g.last.at >= 700 + 8000, '8 detik memilih setelah dadu berhenti');
  assert.equal((await host.c.post(`/api/bareng/${id}/move`, { roll: true })).body.error.code, 'invalid_move');
  assert.equal((await host.c.post(`/api/bareng/${id}/move`, { token: 9 })).body.error.code, 'invalid_move');
  g = (await host.c.post(`/api/bareng/${id}/move`, { token: 0 })).body.game;
  assert.deepEqual(g.ludo.tok[host.id], [6, -1, -1, -1]);
  assert.equal(g.last.again, true);
  // 6 ketiga: hangus, giliran pindah
  g = (await host.c.post(`/api/bareng/${id}/move`, { roll: true })).body.game;
  assert.equal(g.last.void, true); assert.equal(g.turn, guest.id);
  assert.deepEqual(g.ludo.tok[host.id], [6, -1, -1, -1], 'bidak tidak bergerak');
  // tamu dapat 3: semua di kandang → giliran lewat
  diceSeq(3);
  g = (await guest.c.post(`/api/bareng/${id}/move`, { roll: true })).body.game;
  assert.equal(g.last.pass, true); assert.equal(g.turn, host.id);
  assert.equal(g.last.anim, 1500);
});

test('ludo: waktu habis → server melempar sendiri, lalu memilih bidak (urutan otomatis)', async () => {
  const { ps, id, by } = await ludoIn(['Auto1', 'Auto2']);
  const [a] = ps;
  diceSeq(6, 6, 2);
  later(10_001);
  let g = await gameOf(a, id);
  assert.equal(g.last.auto, true, 'lempar otomatis');
  assert.deepEqual(g.ludo.tok[a.id], [0, -1, -1, -1]);
  assert.equal(g.turn, a.id, 'dapat 6: lempar lagi');
  later(g.turnUntil - g.serverNow + 1);
  g = await gameOf(a, id);
  assert.equal(g.ludo.phase, 'pick', 'dua pilihan: menunggu dipilih');
  later(700 + 8000 + 1);
  g = await gameOf(a, id);
  assert.equal(g.last.auto, true);
  assert.deepEqual(g.ludo.tok[a.id], [0, 0, -1, -1], 'pilihan otomatis: keluar kandang didahulukan');
  // dadu 2 (bukan 6): dua bidak di kotak start = satu pilihan → jalan sendiri; giliran pindah
  g = (await by[a.id].c.post(`/api/bareng/${id}/move`, { roll: true })).body.game;
  assert.deepEqual(g.ludo.tok[a.id], [2, 0, -1, -1]);
  assert.notEqual(g.turn, a.id);
  setLudoDice(null);
});

test('ludo bertiga: 2 bidak, batas 15 menit → urut menurut langkah; hadiah × 1,5 (38/23/15) & jatah main bareng', async () => {
  const { ps, id, by } = await ludoIn(['Cap1', 'Cap2', 'Cap3']);
  let g = await gameOf(ps[0], id);
  assert.equal(g.ludo.perSeat, 2, 'bertiga: 2 bidak');
  assert.deepEqual(Object.values(g.ludo.seat).sort(), [0, 1, 2]);
  const order = g.players.map((p: any) => p.id);
  assert.equal(order[0], ps[0].id, 'yang mengajak (hijau) melempar duluan');
  // pemain 1: 6 → keluar, 4 → kotak 4 · pemain 2: 6 → keluar, 2 → kotak 2 · pemain 3: 1 → lewat
  diceSeq(6, 4, 6, 2, 1);
  for (let k = 0; k < 5; k++) { g = (await by[g.turn].c.post(`/api/bareng/${id}/move`, { roll: true })).body.game; assert.equal(g.phase, 'main'); }
  assert.deepEqual(order.map((pid: string) => g.ludo.tok[pid][0]), [4, 2, -1]);
  later(15 * 60_000 + 1000);
  for (const p of ps) await square(p);
  await barengTick();
  g = await gameOf(ps[0], id);
  assert.equal(g.why, 'waktu');
  assert.deepEqual(g.results.map((r: any) => r.id), order, 'urut menurut langkah bidak');
  assert.deepEqual(g.results.map((r: any) => r.score), [4, 2, 0]);
  assert.deepEqual(g.results.map((r: any) => r.coins), [38, 23, 15], '25 × (1 · 0,6 · 0,4) × 1,5');
  assert.deepEqual(g.results.map((r: any) => r.xp), [9, 7, 6]);
  for (const p of ps) assert.equal(await coopCount(p.id), 1, 'memakai jatah main bareng');
  setLudoDice(null);
});

test('ludo: syarat hadiah — pergi sebelum 5 menit tanpa hadiah & tanpa jatah; selesai normal / ≥ 5 menit berhadiah; yang keluar 0', async () => {
  // pergi di menit pertama: tidak ada yang dapat hadiah
  let { ps, id } = await ludoIn(['Gate1', 'Gate2']);
  later(60_000);
  for (const p of ps) await square(p);
  await ps[1].c.post(`/api/bareng/${id}/leave`);
  await barengTick();
  let g = await gameOf(ps[0], id);
  assert.equal(g.why, 'pergi');
  assert.equal(g.ludo.paid, false);
  assert.deepEqual(g.results.map((r: any) => [r.rank, r.coins, !!r.left]), [[1, 0, false], [2, 0, true]]);
  assert.equal(await coopCount(ps[0].id), 0, 'tidak memakai jatah');
  // lebih dari 5 menit lalu lawan pergi: yang bertahan juara 1 berhadiah, yang keluar 0
  ({ ps, id } = await ludoIn(['Gate3', 'Gate4']));
  later(5 * 60_000 + 1000);
  for (const p of ps) await square(p);
  await ps[1].c.post(`/api/bareng/${id}/leave`);
  await barengTick();
  g = await gameOf(ps[0], id);
  assert.equal(g.ludo.paid, true);
  assert.deepEqual(g.results.map((r: any) => [r.id, r.coins]), [[ps[0].id, 38], [ps[1].id, 0]]);
  // selesai normal dalam 2 menit (1 bidak per pemain lewat pengaturan): tetap berhadiah
  await setGame({ ludo: { tokensByPlayers: { 2: 1, 3: 2, 4: 2 } } });
  let by: Record<string, any>;
  ({ ps, id, by } = await ludoIn(['Fin1', 'Fin2']));
  g = await gameOf(ps[0], id);
  assert.equal(g.ludo.perSeat, 1);
  // pemain 1: 6 (keluar) lalu 5 × 11 = 55 lalu 1 = 56 (pulang); pemain 2 selalu 1 (di kandang = lewat)
  diceSeq(6, 5, ...Array.from({ length: 10 }, () => [1, 5]).flat(), 1, 1);
  for (let k = 0; k < 40 && g.phase === 'main'; k++) { later(1000); g = (await by[g.turn].c.post(`/api/bareng/${id}/move`, { roll: true })).body.game; }
  assert.equal(g.phase, 'selesai');
  assert.equal(g.why, 'selesai');
  assert.equal(g.last.home, true);
  assert.deepEqual(g.ludo.finished, [ps[0].id]);
  await barengTick();
  g = await gameOf(ps[0], id);
  assert.deepEqual(g.results.map((r: any) => r.coins), [38, 23]);
  await setGame({ ludo: { tokensByPlayers: { 2: 4, 3: 2, 4: 2 } } });
  setLudoDice(null);
});

test('ludo: pemain keluar → bidaknya diangkat, giliran melewatinya, permainan lanjut selama ≥ 2 pemain; kehadiran ludo:k di alun-alun', async () => {
  const { ps, id, by } = await ludoIn(['Out1', 'Out2', 'Out3']);
  let g = await gameOf(ps[0], id);
  const seats = g.ludo.seat;
  // pemain lain di alun-alun melihat pemain Ludo berdiri di pojok tikar sesuai warna kursinya
  const seen = (await square(ps[0])).body.members;
  for (const p of ps.slice(1)) assert.equal(seen.find((m: any) => m.id === p.id)?.act, `ludo:${seats[p.id]}`);
  diceSeq(6, 3);
  g = (await by[g.turn].c.post(`/api/bareng/${id}/move`, { roll: true })).body.game;
  g = (await by[g.turn].c.post(`/api/bareng/${id}/move`, { roll: true })).body.game;
  const second = g.turn;
  const third = g.players.map((p: any) => p.id).find((x: string) => x !== second && x !== ps[0].id);
  await by[third].c.post(`/api/bareng/${id}/leave`);
  g = await gameOf(ps[0], id);
  assert.equal(g.phase, 'main', 'masih 2 pemain: lanjut');
  assert.equal(g.ludo.tok[third], undefined, 'bidak yang keluar diangkat dari papan');
  assert.ok(g.players.find((p: any) => p.id === third).left);
  // giliran: pemain kedua → (yang keluar dilewati) → pemain pertama
  diceSeq(1);
  g = (await by[second].c.post(`/api/bareng/${id}/move`, { roll: true })).body.game;
  assert.equal(g.turn, ps[0].id);
  assert.equal((await square(ps[0])).body.members.find((m: any) => m.id === third)?.act ?? null, null, 'yang keluar tidak lagi di tikar');
  setLudoDice(null);
});

test('ludo: fitur bisa dimatikan admin; pengaturan divalidasi', async () => {
  const o = client();
  assert.equal((await o.post('/api/admin/login', { email: 'owner@test.local', password: 'rahasia-sekali-123' })).status, 200);
  const cur = (await o.get('/api/admin/settings')).body.value;
  assert.deepEqual(cur.ludo.tokensByPlayers, { 2: 4, 3: 2, 4: 2 });
  const bad = await o.put('/api/admin/settings', { value: { ...cur, ludo: { ...cur.ludo, tokensByPlayers: { 2: 6, 3: 2, 4: 2 } } } });
  assert.equal(bad.status, 400);
  assert.match(bad.body.error.message, /Ludo/);
  assert.equal((await o.put('/api/admin/settings', { value: { ...cur, ludo: { ...cur.ludo, pickMs: 500 } } })).status, 400);
  assert.equal((await o.put('/api/admin/settings', { value: { ...cur, features: { ...cur.features, ludo: false } } })).status, 200);
  resetSquares(); resetBareng();
  const p = await player('Tutup1');
  await square(p);
  assert.equal((await p.c.post('/api/bareng/start', { game: 'ludo' })).status, 403);
  assert.equal((await o.put('/api/admin/settings', { value: { ...cur, features: { ...cur.features, ludo: true } } })).status, 200);
  assert.equal((await p.c.post('/api/bareng/start', { game: 'ludo' })).status, 200);
});
