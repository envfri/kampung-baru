// Game main bareng baru (Congklak, Ular Tangga Kampung, Balap Karung Live) & paket set premium.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config';
import { congklakMoves, KARUNG_HOPS } from '@kb/shared';

config.paymentProvider = 'mock';
const { buildApp } = await import('../src/app');
const { resetSquares } = await import('../src/routes/square');
const { resetHouses } = await import('../src/routes/house');
const { resetBareng, setBarengClock, barengTick } = await import('../src/routes/bareng');
let app: any;
let db: any;
before(async () => {
  ({ app, db } = await buildApp({ memoryDb: true, logger: false, rateLimit: false, worker: false }));
  // tanpa event berpengali koin supaya angka hadiah pasti
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
const coins = async (p: any) => (await p.c.get('/api/me')).body.wallet.coin as number;
const square = (p: any) => p.c.post('/api/square/sync', { x: 10, y: 18 });

test('congklak di rumah: ajak → ikut → giliran bergantian, langkah otomatis saat waktu habis, selesai & hadiah main bareng', async () => {
  resetHouses(); resetBareng();
  const host = await player('Ratri'), guest = await player('Sekar'), other = await player('Tono');
  await guest.c.post('/api/friends', { code: host.code });
  const sync = (p: any) => p.c.post(`/api/house/${host.id}/sync`, { roomId: host.room, x: 2, y: 2 });
  await sync(host); await sync(guest);
  // orang yang tidak ada di rumah itu tidak bisa memulai / ikut
  assert.equal((await other.c.post('/api/bareng/start', { game: 'congklak', hostId: host.id })).body.error.code, 'not_here');
  assert.equal((await host.c.post('/api/bareng/start', { game: 'karung', hostId: host.id })).body.error.code, 'wrong_place');
  const st = await host.c.post('/api/bareng/start', { game: 'congklak', hostId: host.id });
  assert.equal(st.status, 200, JSON.stringify(st.body));
  const id = st.body.game.id;
  // tamu melihat ajakan lewat sinkron
  const seen = (await sync(guest)).body.games.find((g: any) => g.id === id);
  assert.equal(seen.phase, 'ajak');
  const j = await guest.c.post(`/api/bareng/${id}/join`);
  assert.equal(j.body.game.phase, 'main', 'kursi penuh → langsung main');
  assert.deepEqual(j.body.game.board, [7, 7, 7, 7, 7, 7, 7, 0, 7, 7, 7, 7, 7, 7, 7, 0]);
  let g = j.body.game;
  const who = (pid: string) => (pid === host.id ? host : guest);
  // bukan giliran
  const notTurn = who(g.players.find((p: any) => p.id !== g.turn).id);
  assert.equal((await notTurn.c.post(`/api/bareng/${id}/move`, { hole: 0 })).body.error.code, 'not_turn');
  // satu langkah sah
  const turnP = who(g.turn);
  const r = await turnP.c.post(`/api/bareng/${id}/move`, { hole: 3 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  g = r.body.game;
  assert.equal(g.board.reduce((a: number, b: number) => a + b, 0), 98, 'jumlah biji tetap');
  assert.ok(g.last.path.length >= 7);
  // waktu giliran habis: server memilih lubang otomatis
  const seq0 = g.seq;
  later(16_000);
  await sync(host); await sync(guest);
  g = (await sync(host)).body.games.find((x: any) => x.id === id);
  assert.ok(g.seq > seq0 && g.last.auto, 'langkah otomatis');
  // mainkan sampai selesai
  for (let k = 0; k < 400 && g.phase === 'main'; k++) {
    const p = who(g.turn), idx = g.players.findIndex((x: any) => x.id === g.turn) as 0 | 1;
    const mv = congklakMoves(g.board, idx);
    const res = await p.c.post(`/api/bareng/${id}/move`, { hole: mv[0] });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    g = res.body.game;
  }
  assert.equal(g.phase, 'selesai');
  assert.equal(g.board[7] + g.board[15], 98);
  const c0 = [await coins(host), await coins(guest)];
  await barengTick();
  g = (await sync(host)).body.games.find((x: any) => x.id === id);
  assert.equal(g.results.length, 2);
  const win = g.results[0], lose = g.results[1];
  if (win.rank === lose.rank) { assert.equal(win.coins, 15); } else { assert.equal(win.coins, 25); assert.equal(lose.coins, 10); }
  const c1 = [await coins(host), await coins(guest)];
  assert.ok(c1[0] > c0[0] && c1[1] > c0[1], 'keduanya dapat koin');
  const cnt = await db.one(`select count from daily_counters where user_id = $1 and key = 'coop'`, [host.id]);
  assert.equal(cnt.count, 1, 'memakai jatah main bareng harian');
});

test('ular tangga di alun-alun: 3 pemain, dadu dari server, giliran otomatis, peringkat & hadiah 25/15/10', async () => {
  resetSquares(); resetBareng();
  const a = await player('Ular1'), b = await player('Ular2'), c = await player('Ular3');
  for (const p of [a, b, c]) await square(p);
  assert.equal((await a.c.post('/api/bareng/start', { game: 'congklak' })).body.error.code, 'wrong_place');
  const st = await a.c.post('/api/bareng/start', { game: 'ular' });
  const id = st.body.game.id;
  // memulai lagi = ikut ajakan yang sama, bukan membuat sesi baru
  assert.equal((await b.c.post('/api/bareng/start', { game: 'ular' })).body.game.id, id);
  await c.c.post(`/api/bareng/${id}/join`);
  assert.equal((await b.c.post(`/api/bareng/${id}/go`)).status, 403, 'hanya yang mengajak yang bisa memulai');
  let g = (await a.c.post(`/api/bareng/${id}/go`)).body.game;
  assert.equal(g.phase, 'main');
  assert.equal(g.players.length, 3);
  const byId: Record<string, any> = { [a.id]: a, [b.id]: b, [c.id]: c };
  for (let k = 0; k < 300 && g.phase === 'main'; k++) {
    if (k % 7 === 6) { later(11_000); for (const p of [a, b, c]) await square(p); g = (await square(a)).body.games.find((x: any) => x.id === id); continue; }
    const r = await byId[g.turn].c.post(`/api/bareng/${id}/move`, { roll: true });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    g = r.body.game;
    assert.ok(g.last.roll >= 1 && g.last.roll <= 6);
  }
  assert.equal(g.phase, 'selesai');
  assert.ok(g.finished.length >= 2);
  await barengTick();
  g = (await square(a)).body.games.find((x: any) => x.id === id);
  assert.deepEqual(g.results.map((r: any) => r.rank), [1, 2, 3], JSON.stringify({ results: g.results, finished: g.finished, log: g.log, why: g.why }));
  assert.deepEqual(g.results.map((r: any) => r.coins), [25, 15, 10]);
});

test('balap karung live: 2 pemain sungguhan, energi & jatah karung, hasil divalidasi server, hadiah 40/25', async () => {
  resetSquares(); resetBareng();
  const a = await player('Karung1'), b = await player('Karung2');
  await square(a); await square(b);
  const st = await a.c.post('/api/bareng/start', { game: 'karung' });
  assert.equal(st.status, 200, JSON.stringify(st.body));
  const id = st.body.game.id;
  await b.c.post(`/api/bareng/${id}/join`);
  let g = (await a.c.post(`/api/bareng/${id}/go`)).body.game;
  assert.equal(g.phase, 'siap');
  await barengTick();
  g = (await square(a)).body.games.find((x: any) => x.id === id);
  assert.equal(g.phase, 'main');
  assert.ok(g.race.startAt > g.serverNow - 1, 'hitung mundur dulu');
  const energy = (await a.c.get('/api/me')).body.pet.needs.energi;
  assert.ok(energy <= 62, 'energi terpakai seperti lomba biasa');
  // sebelum mulai: kemajuan tidak dihitung
  await a.c.post(`/api/bareng/${id}/move`, { hops: 10 });
  later(3600 + 4000);
  // kemajuan dibatasi kecepatan jari: 40 lompatan dalam 4 detik masih masuk akal (≤ 14/detik)
  g = (await a.c.post(`/api/bareng/${id}/move`, { hops: 40, taps: 40, timeMs: 4000 })).body.game;
  assert.equal(g.race.done[a.id], 4000);
  // B mengklaim waktu yang lebih lama dari jam server sejak lomba dimulai: tidak sah
  g = (await b.c.post(`/api/bareng/${id}/move`, { hops: 40, taps: 40, timeMs: 9000 })).body.game;
  assert.equal(g.race.done[b.id], null, 'waktu tidak masuk akal = tidak sah');
  await square(a); await square(b);
  await barengTick();
  g = (await square(a)).body.games.find((x: any) => x.id === id);
  assert.equal(g.phase, 'selesai');
  assert.equal(g.results[0].id, a.id);
  assert.equal(g.results[0].coins, 40);
  assert.equal(g.results[1].coins, 0, 'tidak finis sah: tanpa koin');
  const cnt = await db.one(`select count from daily_counters where user_id = $1 and key = 'karung'`, [b.id]);
  assert.equal(cnt.count, 1, 'memakai jatah lomba karung');
});

test('ajakan: blokir tidak bisa ikut, pembatalan oleh yang mengajak, sepi bila tidak ada yang ikut', async () => {
  resetSquares(); resetBareng();
  const a = await player('Ajak1'), b = await player('Ajak2');
  await square(a); await square(b);
  await a.c.post('/api/blocks', { userId: b.id });
  const id = (await a.c.post('/api/bareng/start', { game: 'ular' })).body.game.id;
  assert.equal((await b.c.post(`/api/bareng/${id}/join`)).status, 403);
  await a.c.post(`/api/bareng/${id}/leave`);
  assert.equal((await square(a)).body.games.find((x: any) => x.id === id).why, 'batal');
  const id2 = (await b.c.post('/api/bareng/start', { game: 'ular' })).body.game.id;
  later(21_000);
  assert.equal((await square(b)).body.games.find((x: any) => x.id === id2).why, 'sepi');
});

test('paket set premium: harga diskon dari item yang belum dimiliki, tidak bisa beli dua kali', async () => {
  const p = await player('Sultan');
  await db.query(`update wallets set pearl = 120 where user_id = $1`, [p.id]);
  // punya satu item set dulu
  assert.equal((await p.c.post('/api/shop/buy', { itemId: 'kb-karpetawan', currency: 'pearl' })).status, 200);
  // total sisa: 15 + 12 + 10 + 8 + 10 = 55 → diskon 20% = 44
  const wrong = await p.c.post('/api/shop/bundle', { set: 'bintang', price: 49 });
  assert.equal(wrong.body.error.code, 'price_changed');
  const r = await p.c.post('/api/shop/bundle', { set: 'bintang', price: 44 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.price, 44);
  assert.equal(r.body.items.length, 5);
  assert.equal(r.body.wallet.pearl, 120 - 6 - 44);
  assert.equal((await p.c.post('/api/shop/bundle', { set: 'bintang' })).body.error.code, 'owned');
  assert.equal((await p.c.post('/api/shop/bundle', { set: 'tidak-ada' })).status, 400);
  // Mutiara kurang
  await db.query(`update wallets set pearl = 3 where user_id = $1`, [p.id]);
  assert.notEqual((await p.c.post('/api/shop/bundle', { set: 'keraton' })).status, 200);
  void KARUNG_HOPS;
});
