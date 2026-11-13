// Sesi Catur Kilat 5+3 (main bareng): jam dari server (habis waktu lewat setBarengClock), diam 90 dtk = kalah,
// langkah pertama 30 dtk (batal tanpa hadiah), syarat 20 paruh langkah untuk hadiah, remis sepakat, menyerah,
// hadiah × longMult, kursi Pos Ronda di sinkron alun-alun, dan syarat minimal Ular Tangga.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config';
import { caturFromFEN, caturFind, caturIdx, caturStart, caturApply } from '@kb/shared';

config.paymentProvider = 'mock';
const { buildApp } = await import('../src/app');
const { resetSquares } = await import('../src/routes/square');
const { resetHouses } = await import('../src/routes/house');
const { resetBareng, setBarengClock, barengTick } = await import('../src/routes/bareng');
const { caturBegin, caturCfg, caturPlay, caturTick, caturRank, caturGate } = await import('../src/lib/catur-game');
let app: any;
let db: any;
before(async () => {
  ({ app, db } = await buildApp({ memoryDb: true, logger: false, rateLimit: false, worker: false }));
  await db.query(`update events set active = false`);
  (await import('../src/lib/core')).invalidateCaches();
});
after(async () => { setBarengClock(() => Date.now()); await app?.close(); });

let now = Date.now();
setBarengClock(() => now);
const later = (ms: number) => { now += ms; };

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
  const p = await c.post('/api/pet', { name, color: '#F6B7A8', ear: 'tunas', ownerName: name });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  return { c, id: p.body.state.user.id as string, code: p.body.state.user.friend_code as string, room: p.body.state.rooms[0].id as string, name };
}
const coop = async (id: string) => (await db.one(`select count from daily_counters where user_id = $1 and key = 'coop'`, [id]))?.count ?? 0;
const setGame = async (patch: Record<string, unknown>) => {
  const row = await db.one(`select value from settings where key = 'game'`);
  const v = { ...(row?.value ?? {}), ...patch };
  await db.query(`insert into settings (key, value) values ('game', $1::text::jsonb) on conflict (key) do update set value = excluded.value`, [JSON.stringify(v)]);
  (await import('../src/lib/core')).invalidateCaches();
};
// 20 paruh langkah tanpa pengulangan (Ruy Lopez)
const LINE = 'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3 c6a5 b3c2 c7c5'.split(' ');

/** dua pemain di satu rumah, catur dimulai; mengembalikan pemain Putih & Hitam */
async function house(n: string) {
  resetHouses(); resetBareng();
  const host = await player(`${n}A`), guest = await player(`${n}B`);
  await guest.c.post('/api/friends', { code: host.code });
  const sync = (p: any) => p.c.post(`/api/house/${host.id}/sync`, { roomId: host.room, x: 2, y: 2 });
  await sync(host); await sync(guest);
  const st = await host.c.post('/api/bareng/start', { game: 'catur', hostId: host.id });
  assert.equal(st.status, 200, JSON.stringify(st.body));
  const id = st.body.game.id;
  const j = await guest.c.post(`/api/bareng/${id}/join`);
  const g = j.body.game;
  assert.equal(g.phase, 'main');
  const white = g.catur.white === host.id ? host : guest, black = white === host ? guest : host;
  const view = async () => (await sync(host)).body.games.find((x: any) => x.id === id);
  const keep = async () => { await sync(host); await sync(guest); };
  return { id, host, guest, white, black, g, view, keep, sync };
}
async function moves(h: any, list: string[], startPly = 0) {
  let g: any = null;
  for (let k = 0; k < list.length; k++) {
    const p = (startPly + k) % 2 === 0 ? h.white : h.black, u = list[k];
    const r = await p.c.post(`/api/bareng/${h.id}/move`, { from: u.slice(0, 2), to: u.slice(2, 4), ...(u[4] ? { promo: u[4] } : {}) });
    assert.equal(r.status, 200, `${u}: ${JSON.stringify(r.body)}`);
    g = r.body.game;
  }
  return g;
}

test('catur di rumah: warna diundi, papan awal, langkah sah dari server, bukan giliran / tidak sah = invalid_move, SAN & bidak termakan', async () => {
  const h = await house('Kuda');
  assert.equal(h.g.catur.board, 'RNBQKBNRPPPPPPPP' + '.'.repeat(32) + 'pppppppprnbqkbnr');
  assert.equal(h.g.turn, h.white.id);
  assert.equal(h.g.catur.clocks.w, 300_000);
  assert.ok(h.g.catur.firstUntil > 0, 'batas langkah pertama');
  // bukan giliran
  assert.equal((await h.black.c.post(`/api/bareng/${h.id}/move`, { from: 'e7', to: 'e5' })).body.error.code, 'invalid_move');
  // tidak sah
  assert.equal((await h.white.c.post(`/api/bareng/${h.id}/move`, { from: 'e2', to: 'e5' })).body.error.code, 'invalid_move');
  assert.equal((await h.white.c.post(`/api/bareng/${h.id}/move`, { from: 'z9', to: 'e4' })).body.error.code, 'invalid_move');
  // penonton / orang lain tidak bisa melangkah
  const other = await player('Tamu');
  assert.notEqual((await other.c.post(`/api/bareng/${h.id}/move`, { from: 'e2', to: 'e4' })).status, 200);
  let g = await moves(h, ['e2e4', 'd7d5', 'e4d5']);
  assert.deepEqual(g.catur.moves, ['e4', 'd5', 'exd5']);
  assert.deepEqual(g.catur.captured.w, ['p']);
  assert.equal(g.last.san, 'exd5'); assert.equal(g.last.from, 'e4'); assert.equal(g.last.cap, 'p');
  assert.ok(g.last.anim > 0 && g.last.anim <= 600);
  assert.equal(g.catur.runFrom, g.last.at + g.last.anim, 'jam lawan mulai setelah animasi');
  assert.equal(g.catur.running, 'b');
  // tambahan 3 dtk per langkah setelah langkah pertama tiap pihak
  later(10_000);
  await h.keep();
  g = await moves(h, ['d8d5'], 3);
  assert.equal(g.catur.clocks.b, 300_000 - (10_000 - g.catur.grace - 220) + 3000);
  assert.equal(g.last.check, false);
});

test('catur: langkah pertama tidak dibuat dalam 30 dtk = batal, tanpa hadiah & tanpa jatah', async () => {
  const h = await house('Batal');
  await moves(h, ['e2e4']);
  later(31_000);
  await h.keep();
  let g = await h.view();
  assert.equal(g.phase, 'selesai'); assert.equal(g.why, 'batal'); assert.equal(g.catur.result.reason, 'batal');
  await barengTick();
  g = await h.view();
  assert.deepEqual(g.results, []);
  assert.equal(await coop(h.white.id), 0); assert.equal(await coop(h.black.id), 0);
});

test('catur: diam 90 dtk dalam satu langkah = kalah waktu (peringatan dari 60 dtk)', async () => {
  const h = await house('Diam');
  let g = await moves(h, LINE.slice(0, 4));
  assert.equal(g.catur.idleWarnAt, g.catur.runFrom + 60_000);
  assert.equal(g.catur.idleUntil, g.catur.runFrom + 90_000);
  for (let t = 0; t < 3; t++) { later(29_000); await h.keep(); }
  g = await h.view();
  assert.equal(g.phase, 'main', 'belum 90 dtk');
  later(4_000); await h.keep();
  g = await h.view();
  assert.equal(g.phase, 'selesai');
  assert.deepEqual(g.catur.result, { winner: 'b', reason: 'diam' });
  // kurang dari 20 paruh langkah: tanpa hadiah & tanpa jatah
  await barengTick();
  g = await h.view();
  assert.ok(g.results.every((r: any) => r.coins === 0 && r.short));
  assert.equal(await coop(h.black.id), 0);
});

test('catur: jam habis (pengaturan admin baseMs 30 dtk) = kalah waktu; hadiah setelah ≥ 20 paruh langkah, menang 38 / kalah 15 koin (× longMult 1,5)', async () => {
  await setGame({ catur: { baseMs: 30_000 } });
  const h = await house('Jam');
  let g = await moves(h, LINE);
  assert.equal(g.catur.plies, 20);
  assert.equal(g.catur.clocks.w, 30_000 + 9 * 3000, 'tambahan 3 dtk tiap langkah Putih setelah yang pertama');
  // giliran Putih: 57 dtk + kelonggaran 0,3 dtk (+ animasi langkah Hitam): belum habis pada 57 dtk
  for (let t = 0; t < 3; t++) { later(19_000); await h.keep(); }
  assert.equal((await h.view()).phase, 'main');
  later(1_000); await h.keep();
  g = await h.view();
  assert.equal(g.phase, 'selesai');
  assert.deepEqual(g.catur.result, { winner: 'b', reason: 'waktu' });
  assert.equal(g.catur.clocks.w, 0);
  await barengTick();
  g = await h.view();
  const byId = Object.fromEntries(g.results.map((r: any) => [r.id, r]));
  assert.equal(byId[h.black.id].coins, 38); assert.equal(byId[h.black.id].xp, 9); assert.equal(byId[h.black.id].rank, 1);
  assert.equal(byId[h.white.id].coins, 15); assert.equal(byId[h.white.id].xp, 6);
  assert.equal(await coop(h.white.id), 1);
  await setGame({ catur: {} });
});

test('catur: tawar remis mulai paruh langkah 20, sepakat = remis 23 koin; menyerah sebelum 20 = tanpa hadiah', async () => {
  let h = await house('Remis');
  await moves(h, LINE.slice(0, 18));
  assert.equal((await h.white.c.post(`/api/bareng/${h.id}/move`, { draw: 'offer' })).body.error.code, 'invalid_move', 'belum paruh langkah 20');
  await moves(h, LINE.slice(18), 18);
  let r = await h.white.c.post(`/api/bareng/${h.id}/move`, { draw: 'offer' });
  assert.equal(r.status, 200);
  assert.equal(r.body.game.catur.drawOffer.by, h.white.id);
  assert.equal((await h.white.c.post(`/api/bareng/${h.id}/move`, { draw: 'accept' })).body.error.code, 'invalid_move', 'tidak bisa menerima tawaran sendiri');
  // ditolak, lalu ditawarkan lagi; yang ditawari jalan = tawaran gugur
  await h.black.c.post(`/api/bareng/${h.id}/move`, { draw: 'decline' });
  r = await h.white.c.post(`/api/bareng/${h.id}/move`, { draw: 'offer' });
  assert.equal(r.body.game.catur.offersLeft[h.white.id], 1);
  let g = await moves(h, ['d2d4'], 20);
  assert.ok(g.catur.drawOffer, 'yang menawarkan jalan: tawaran tetap');
  g = await moves(h, ['d8c7'], 21);
  assert.equal(g.catur.drawOffer, null, 'yang ditawari jalan: gugur');
  await h.black.c.post(`/api/bareng/${h.id}/move`, { draw: 'offer' });
  r = await h.white.c.post(`/api/bareng/${h.id}/move`, { draw: 'accept' });
  g = r.body.game;
  assert.equal(g.phase, 'selesai');
  assert.deepEqual(g.catur.result, { winner: null, reason: 'sepakat' });
  await barengTick();
  g = await h.view();
  assert.deepEqual(g.results.map((x: any) => [x.rank, x.coins, x.xp]), [[1, 23, 7], [1, 23, 7]]);
  // menyerah pada paruh langkah 4: tanpa hadiah untuk siapa pun & tanpa jatah
  h = await house('Nyerah');
  await moves(h, LINE.slice(0, 4));
  g = (await h.white.c.post(`/api/bareng/${h.id}/move`, { resign: true })).body.game;
  assert.deepEqual(g.catur.result, { winner: 'b', reason: 'menyerah' });
  await barengTick();
  g = await h.view();
  assert.ok(g.results.every((x: any) => x.coins === 0 && x.xp === 0 && x.short));
  assert.equal(await coop(h.black.id), 0);
});

test('catur: main lagi = warna ditukar; skakmat dari server; yang pergi kalah', async () => {
  const h = await house('Mat');
  const w0 = h.white.id;
  let g = await moves(h, ['f2f3', 'e7e5', 'g2g4', 'd8h4']);
  assert.deepEqual(g.catur.result, { winner: 'b', reason: 'mat' });
  assert.equal(g.last.san, 'Qh4#');
  // main lagi (pasangan sama, tempat sama): warna ditukar
  const st = await h.host.c.post('/api/bareng/start', { game: 'catur', hostId: h.host.id });
  const j = await h.guest.c.post(`/api/bareng/${st.body.game.id}/join`);
  assert.notEqual(j.body.game.catur.white, w0);
  // pergi = kalah
  const id = st.body.game.id;
  const quitter = j.body.game.catur.white === h.host.id ? h.host : h.guest;
  await quitter.c.post(`/api/bareng/${id}/leave`);
  g = (await h.sync(h.host)).body.games.find((x: any) => x.id === id);
  assert.equal(g.catur.result.reason, 'pergi');
  assert.equal(g.catur.result.winner, 'b');
});

test('catur di alun-alun: hanya satu papan per alun-alun, kursi Pos Ronda (catur:1 / catur:2) di sinkron', async () => {
  resetSquares(); resetBareng();
  const a = await player('Pos1'), b = await player('Pos2'), c = await player('Pos3');
  const sq = (p: any) => p.c.post('/api/square/sync', { x: 2, y: 12 });
  for (const p of [a, b, c]) await sq(p);
  const st = await a.c.post('/api/bareng/start', { game: 'catur' });
  assert.equal(st.status, 200, JSON.stringify(st.body));
  const id = st.body.game.id;
  await b.c.post(`/api/bareng/${id}/join`);
  assert.equal((await c.c.post('/api/bareng/start', { game: 'catur' })).body.error.code, 'busy');
  const view = (await sq(c)).body;
  const g = view.games.find((x: any) => x.id === id);
  const acts = Object.fromEntries(view.members.map((m: any) => [m.id, m.act]));
  assert.equal(acts[g.catur.white], 'catur:1'); assert.equal(acts[g.catur.black], 'catur:2');
  // fitur dimatikan admin
  await setGame({ features: { catur: false } });
  resetBareng();
  assert.equal((await a.c.post('/api/bareng/start', { game: 'catur' })).status, 403);
  await setGame({ features: {} });
});

test('catur (logika sesi): waktu habis melawan raja sendirian = remis, pengulangan 3× = remis, 25 menit = remis', () => {
  const cfg = caturCfg({});
  const ended: string[] = [];
  const ops = (t: number) => ({ now: t, end: (w: string) => ended.push(w), note: () => {}, bump: () => {} });
  const host = () => ({ place: 'h:x', players: [{ id: 'A', name: 'A' }, { id: 'B', name: 'B' }], left: new Set<string>(), catur: null as any, moves: 0, last: null, turn: 0, turnUntil: 0 });
  // Putih kehabisan waktu, Hitam hanya punya Raja + Kuda → remis
  let h = host();
  caturBegin(h, cfg, 0);
  h.catur.st = caturFromFEN('4k3/8/8/2n5/8/8/3P4/4K3 w - - 0 30');
  h.catur.plies = 40; h.catur.runFrom = 0; h.catur.clocks.w = 1000;
  caturTick(h, ops(5000));
  assert.deepEqual(h.catur.result, { winner: null, reason: 'waktu-remis' });
  assert.deepEqual(caturRank(h).map((r) => r.factor), [0.6, 0.6]);
  assert.ok(caturGate(h));
  // pengulangan 3×: kuda bolak-balik
  h = host();
  caturBegin(h, cfg, 0);
  const W = h.catur.white, B = h.catur.black;
  const seq = 'g1f3 g8f6 f3g1 f6g8 g1f3 g8f6 f3g1 f6g8'.split(' ');
  seq.forEach((u, k) => caturPlay(h, k % 2 ? B : W, { from: u.slice(0, 2), to: u.slice(2) }, ops(1000 * k)));
  assert.deepEqual(h.catur.result, { winner: null, reason: 'ulang' });
  assert.ok(!caturGate(h), '8 paruh langkah: tanpa hadiah');
  // 25 menit
  h = host();
  caturBegin(h, cfg, 0);
  caturPlay(h, h.catur.white, { from: 'e2', to: 'e4' }, ops(1000));
  caturPlay(h, h.catur.black, { from: 'e7', to: 'e5' }, ops(2000));
  h.catur.runFrom = 25 * 60_000 - 1000;
  caturTick(h, ops(25 * 60_000 + 1));
  assert.deepEqual(h.catur.result, { winner: null, reason: 'batas' });
  // posisi en passant & promosi lewat sesi (promosi tanpa pilihan = Menteri)
  h = host();
  caturBegin(h, cfg, 0);
  h.catur.st = caturFromFEN('8/2k3P1/8/8/8/8/7K/8 w - - 0 1');
  h.catur.st.turn = 'w';
  caturPlay(h, h.catur.white, { from: 'g7', to: 'g8' }, ops(100));
  assert.equal(h.catur.st.b[caturIdx('g8')], 'Q');
  assert.equal(h.last.promo, 'q');
  assert.throws(() => caturPlay(h, h.catur.black, { from: 'c7', to: 'c6', promo: 'k' }, ops(200)), /promosi/);
  void caturFind; void caturStart; void caturApply; void ended;
});

test('ular tangga: pemain yang bertahan dapat hadiah hanya bila selesai normal atau sudah melempar ≥ 6 kali sendiri', async () => {
  resetSquares(); resetBareng();
  const a = await player('UlarMin1'), b = await player('UlarMin2');
  const sq = (p: any) => p.c.post('/api/square/sync', { x: 10, y: 18 });
  await sq(a); await sq(b);
  let id = (await a.c.post('/api/bareng/start', { game: 'ular' })).body.game.id;
  await b.c.post(`/api/bareng/${id}/join`);
  let g = (await a.c.post(`/api/bareng/${id}/go`)).body.game;
  const by: Record<string, any> = { [a.id]: a, [b.id]: b };
  // dua lemparan masing-masing, lalu B pergi: A belum melempar 6 kali → tanpa hadiah & tanpa jatah
  for (let k = 0; k < 4 && g.phase === 'main'; k++) g = (await by[g.turn].c.post(`/api/bareng/${id}/move`, { roll: true })).body.game;
  await b.c.post(`/api/bareng/${id}/leave`);
  await barengTick();
  g = (await sq(a)).body.games.find((x: any) => x.id === id);
  assert.equal(g.why, 'pergi');
  const ra = g.results.find((r: any) => r.id === a.id);
  assert.equal(ra.coins, 0); assert.ok(ra.short);
  assert.equal(await coop(a.id), 0);
  // main lagi: A & B masing-masing melempar 6 kali, lalu B pergi → A dapat hadiah
  resetBareng();
  id = (await a.c.post('/api/bareng/start', { game: 'ular' })).body.game.id;
  await b.c.post(`/api/bareng/${id}/join`);
  g = (await a.c.post(`/api/bareng/${id}/go`)).body.game;
  let thrown = 0;
  while (thrown < 12 && g.phase === 'main') { g = (await by[g.turn].c.post(`/api/bareng/${id}/move`, { roll: true })).body.game; thrown++; }
  if (g.phase === 'main') {
    await b.c.post(`/api/bareng/${id}/leave`);
    await barengTick();
    g = (await sq(a)).body.games.find((x: any) => x.id === id);
    const r2 = g.results.find((r: any) => r.id === a.id);
    assert.ok(r2.coins > 0, JSON.stringify(g.results));
    assert.equal(g.results.find((r: any) => r.id === b.id).coins, 0, 'yang pergi selalu 0');
  }
});
