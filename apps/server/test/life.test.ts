// Hidup pet: tidur dengan lampu mati, sakit & jamu, berat badan, remah, suka rumah, lencana, mini-game baru.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config';
import { bakiakPrompts, gasingRounds, layanganSchedule, pinangReplay, pinangStart, pinangTap, pinangOil, pinangOily, PINANG } from '@kb/shared';

config.adminEmail = 'owner@test.local';
config.adminPassword = 'rahasia-sekali-123';
config.paymentProvider = 'mock';

const { buildApp } = await import('../src/app');
let app: any;
let db: any;

before(async () => {
  ({ app, db } = await buildApp({ memoryDb: true, logger: false, rateLimit: false, worker: false }));
});
after(async () => app?.close());

function client() {
  let cookie = '';
  const call = async (method: string, url: string, body?: unknown) => {
    const res = await app.inject({ method, url, payload: body as any, headers: cookie ? { cookie } : {} });
    const set = res.headers['set-cookie'];
    if (set) {
      const list = Array.isArray(set) ? set : [set];
      const jar = new Map(cookie ? cookie.split('; ').map((c: string) => c.split('=') as [string, string]) : []);
      for (const c of list) { const [kv] = c.split(';'); const [k, v] = kv.split('='); if (v) jar.set(k, v); else jar.delete(k); }
      cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    }
    return { status: res.statusCode, body: res.body ? (() => { try { return JSON.parse(res.body); } catch { return res.body; } })() : null };
  };
  return { call, get: (u: string) => call('GET', u), post: (u: string, b?: unknown) => call('POST', u, b ?? {}) };
}

async function player(name = 'Gembul') {
  const c = client();
  await c.post('/api/auth/guest');
  const p = await c.post('/api/pet', { name, color: '#F6B7A8', ear: 'tunas' });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  const id = p.body.state.user.id;
  await db.query(`update wallets set coin = 5000 where user_id = $1`, [id]);
  return { c, id, state: p.body.state };
}
const setNeeds = (id: string, n: Record<string, number>, hoursAgo = 0) =>
  db.query(`update pets set kenyang = $2, bersih = $3, ceria = $4, energi = $5, needs_at = now() - ($6::float8 * interval '1 hour') where user_id = $1`,
    [id, n.kenyang ?? 70, n.bersih ?? 70, n.ceria ?? 70, n.energi ?? 70, hoursAgo]);

test('tidur dengan lampu mati: energi naik bertahap, aksi lain ditolak, bangun sendiri & tercatat', async () => {
  const { c, id } = await player();
  await setNeeds(id, { energi: 97 });
  const full = await c.post('/api/sleep', { on: true });
  assert.equal(full.body.error?.code, 'not_sleepy');
  await setNeeds(id, { energi: 20 });
  const s = await c.post('/api/sleep', { on: true });
  assert.equal(s.status, 200, JSON.stringify(s.body));
  assert.ok(s.body.pet.sleep, 'sedang tidur');
  assert.ok(s.body.pet.sleep.wakeAt > Date.now() + 3600_000, 'bangun kira-kira 2 jam lagi');
  assert.equal((await c.post('/api/action', { type: 'mandi' })).body.error?.code, 'asleep');
  assert.equal((await c.post('/api/games/memori/start')).body.error?.code, 'asleep');
  // waktu berlalu 3 jam: pet bangun sendiri dengan energi penuh lalu turun pelan
  await db.query(`update pets set needs_at = now() - interval '3 hours', sleep_from = now() - interval '3 hours' where user_id = $1`, [id]);
  const me = (await c.get('/api/me')).body;
  assert.equal(me.pet.sleep, null);
  assert.ok(me.pet.needs.energi > 95, String(me.pet.needs.energi));
  assert.ok(me.pet.needs.kenyang > 55, 'kebutuhan lain turun lebih lambat saat tidur (tanpa tidur: 52)');
  await c.post('/api/action', { type: 'elus' }); // merapikan keadaan → tidur tercatat
  const q = (await c.get('/api/quests')).body;
  assert.equal(q.badges.find((b: any) => b.id === 'b-tidur').progress, 1);
});

test('bangunkan lebih awal', async () => {
  const { c, id } = await player();
  await setNeeds(id, { energi: 10 });
  await c.post('/api/sleep', { on: true });
  await db.query(`update pets set needs_at = now() - interval '30 minutes', sleep_from = now() - interval '30 minutes' where user_id = $1`, [id]);
  const w = await c.post('/api/sleep', { on: false });
  assert.equal(w.status, 200);
  assert.equal(w.body.pet.sleep, null);
  assert.ok(w.body.pet.needs.energi >= 29 && w.body.pet.needs.energi <= 31, String(w.body.pet.needs.energi));
});

test('sakit bila dibiarkan, jamu dari Warung Jamu menyembuhkan', async () => {
  const { c, id } = await player();
  await setNeeds(id, { kenyang: 8, bersih: 10, ceria: 60, energi: 60 }, 0);
  await db.query(`update pets set needs_at = now() - interval '4 hours' where user_id = $1`, [id]);
  const me = (await c.get('/api/me')).body;
  assert.equal(me.pet.sick, true);
  assert.equal((await c.post('/api/action', { type: 'main' })).body.error?.code, 'sick');
  assert.equal((await c.post('/api/games/memori/start')).body.error?.code, 'sick');
  const cat = (await c.get('/api/catalog')).body;
  assert.ok(cat.locations.some((l: any) => l.id === 'jamu' && l.x > 960), 'Warung Jamu di sisi kanan peta');
  assert.equal((await c.post('/api/shop/buy', { itemId: 'jamu-kunyit' })).status, 200);
  const eat = await c.post('/api/action', { type: 'makan', itemId: 'jamu-kunyit' });
  assert.equal(eat.status, 200, JSON.stringify(eat.body));
  assert.equal(eat.body.result.cured, true);
  assert.equal(eat.body.pet.sick, false);
});

test('kebanyakan makan bikin gembul, olahraga menurunkannya', async () => {
  const { c, id, state } = await player();
  await setNeeds(id, { kenyang: 95 });
  await c.post('/api/shop/buy', { itemId: 'tumpeng-mini' });
  const eat = await c.post('/api/action', { type: 'makan', itemId: 'tumpeng-mini' });
  assert.equal(eat.status, 200, JSON.stringify(eat.body));
  assert.ok(eat.body.pet.weight >= 14 && eat.body.pet.weight <= 16, String(eat.body.pet.weight)); // (95+30-100) × 0,6
  await c.post('/api/shop/buy', { itemId: 'sepeda-statis' });
  const room = state.rooms[0];
  const lay = [...room.layout, { i: 'sepeda-statis', x: 0, y: 0 }];
  assert.equal((await c.post('/api/room', { roomId: room.id, version: room.version, layout: lay })).status, 200);
  const gow = await c.post('/api/activity', { activityId: 'bersepeda', roomId: room.id, index: lay.length - 1 });
  assert.equal(gow.status, 200, JSON.stringify(gow.body));
  assert.ok(gow.body.pet.weight <= 8, String(gow.body.pet.weight));
});

test('remah muncul seiring waktu dan disapu untuk koin', async () => {
  const { c, id } = await player();
  assert.equal((await c.post('/api/sweep')).body.error?.code, 'no_crumbs');
  await db.query(`update pets set crumbs_at = now() - interval '125 minutes' where user_id = $1`, [id]);
  let coins = 0;
  for (let i = 0; i < 3; i++) {
    const r = await c.post('/api/sweep');
    assert.equal(r.status, 200, JSON.stringify(r.body));
    coins += r.body.coins;
  }
  assert.equal(coins, 6);
  assert.equal((await c.post('/api/sweep')).body.error?.code, 'no_crumbs');
});

test('suka rumah teman sekali seminggu dan rumah terfavorit', async () => {
  const a = await player('Aa');
  const b = await player('Bb');
  assert.equal((await b.c.post(`/api/visit/${a.id}/like`)).status, 403, 'belum berteman');
  await b.c.post('/api/friends', { code: a.state.user.friend_code });
  const l1 = await b.c.post(`/api/visit/${a.id}/like`);
  assert.equal(l1.body.likes.count, 1);
  const l2 = await b.c.post(`/api/visit/${a.id}/like`);
  assert.equal(l2.body.already, true);
  assert.equal(l2.body.likes.count, 1);
  assert.equal((await a.c.post(`/api/visit/${a.id}/like`)).status, 400);
  const v = (await b.c.get(`/api/visit/${a.id}`)).body;
  assert.deepEqual(v.likes, { count: 1, liked: true });
  const top = (await b.c.get('/api/houses/top')).body;
  assert.equal(top.top[0].id, a.id);
  assert.equal(top.top[0].friend, true);
  assert.equal((await a.c.get('/api/me')).body.likesWeek, 1);
});

async function backdate(runId: string, sec: number) {
  await db.query(`update game_runs set started_at = now() - ($2::int * interval '1 second') where id = $1`, [runId, sec]);
}

test('mini-game baru: bakiak, gasing, layangan, panjat pinang + lencana juara', async () => {
  const { c } = await player();
  // Balap Bakiak: ikuti aba-aba
  const b = (await c.post('/api/games/bakiak/start')).body;
  const taps = bakiakPrompts(b.seed).slice(0, 40).map((f, i) => [300 + i * 200, f]);
  await backdate(b.runId, 25);
  const bf = await c.post('/api/games/bakiak/finish', { runId: b.runId, taps });
  assert.equal(bf.status, 200, JSON.stringify(bf.body));
  assert.equal(bf.body.steps, 40);
  assert.ok(bf.body.reward >= 40, 'koin per langkah (× bonus event)');
  // ketukan terlalu rapat = curang
  const b2 = (await c.post('/api/games/bakiak/start')).body;
  const bot = Array.from({ length: 50 }, (_, i) => [i * 10, 'L']);
  assert.equal((await c.post('/api/games/bakiak/finish', { runId: b2.runId, taps: bot })).body.error?.code, 'invalid_run');
  // Gasing: lepas tepat di tengah zona
  const g = (await c.post('/api/games/gasing/start')).body;
  const releases = gasingRounds(g.seed, g.rounds).map((r) => Math.round(r.zone * r.speed));
  await backdate(g.runId, 30);
  const gf = await c.post('/api/games/gasing/finish', { runId: g.runId, releases });
  assert.equal(gf.status, 200, JSON.stringify(gf.body));
  assert.ok(gf.body.spins.every((x: number) => x >= 11.5), JSON.stringify(gf.body.spins));
  // Tangkap Layangan: ambil semua kecuali yang sobek
  const k = (await c.post('/api/games/layangan/start')).body;
  const sched = layanganSchedule(k.seed, k.durationMs);
  const caught = sched.map((x, i) => [i, x.t + 600]).filter(([i]) => sched[i as number].kind !== 'sobek');
  await backdate(k.runId, 30);
  const kf = await c.post('/api/games/layangan/finish', { runId: k.runId, caught });
  assert.equal(kf.status, 200, JSON.stringify(kf.body));
  assert.equal(kf.body.score, sched.filter((x) => x.kind !== 'sobek').reduce((a, x) => a + x.value, 0));
  // Panjat Pinang: ada event bendera (Pekan Ceria bawaan). Ketuk berirama sampai puncak
  // (bagian berminyak bisa membuat terpeleset: pilih irama yang sampai puncak untuk seed ini, dihitung dengan aturan yang sama)
  const p = (await c.post('/api/games/pinang/start')).body;
  assert.ok(p.runId, JSON.stringify(p));
  let ptaps: number[] = [];
  for (let gap = 150; gap <= 200 && !ptaps.length; gap += 5) {
    const tt = Array.from({ length: 120 }, (_, i) => 200 + i * gap).filter((t) => t <= 20_000);
    if (pinangReplay(p.seed, tt, 20_000)?.tiers === 4) ptaps = tt;
  }
  assert.ok(ptaps.length, 'ada irama tenang yang sampai puncak');
  await backdate(p.runId, 25);
  const pf = await c.post('/api/games/pinang/finish', { runId: p.runId, taps: ptaps });
  assert.equal(pf.status, 200, JSON.stringify(pf.body));
  assert.equal(pf.body.height, 100);
  assert.equal(pf.body.tiers, 4);
  const q = (await c.get('/api/quests')).body;
  const badge = q.badges.find((x: any) => x.id === 'b-pinang');
  assert.equal(badge.done, true);
  const before = (await c.get('/api/me')).body.wallet.pearl;
  const cl = await c.post('/api/quests/b-pinang/claim');
  assert.equal(cl.status, 200, JSON.stringify(cl.body));
  assert.equal(cl.body.wallet.pearl, before + 3);
});

test('panjat pinang licin: bagian berminyak dari seed, berat & bisa terpeleset, hitungan game = server', () => {
  const oil = pinangOil(42);
  assert.equal(oil.length, PINANG.oil.count);
  for (const [a, b] of oil) { assert.ok(a >= 15 && b <= 96 && b - a <= PINANG.oil.len); }
  assert.deepEqual(pinangOil(42), oil, 'sama untuk seed yang sama');
  // terlalu cepat = melorot
  const s1 = pinangStart(7);
  assert.equal(pinangTap(s1, 100), 'naik');
  assert.equal(pinangTap(s1, 200), 'cepat');
  assert.equal(pinangTap(s1, 230), null, 'ketukan terlalu rapat tidak sah');
  // irama tenang yang panjang pasti melewati bagian berminyak & sesekali terpeleset
  let peleset = 0, inOil = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const st = pinangStart(seed);
    for (let t = 200; t <= 20_000; t += 170) { const before = st.h; const r = pinangTap(st, t); if (pinangOily(st.oil, before)) inOil++; if (r === 'peleset') peleset++; }
  }
  assert.ok(inOil > 0 && peleset > 0, `terpeleset ${peleset}× dari ${inOil} ketukan di bagian berminyak`);
  // putar ulang server = langkah demi langkah di game
  const taps = Array.from({ length: 100 }, (_, i) => 150 + i * 175);
  const st = pinangStart(99); for (const t of taps) { pinangTap(st, t); if (st.h >= PINANG.top) break; }
  assert.equal(pinangReplay(99, taps, 20_000)!.height, Math.round(st.maxH));
});

test('panjat pinang tertutup tanpa event bendera', async () => {
  const { c } = await player();
  await db.query(`update events set decor = 'hujan' where decor = 'bendera'`);
  const { invalidateCaches } = await import('../src/lib/core');
  invalidateCaches();
  try {
    assert.equal((await c.post('/api/games/pinang/start')).body.error?.code, 'event_only');
  } finally {
    await db.query(`update events set decor = 'bendera' where id = 'pekan-ceria'`);
    invalidateCaches();
  }
});
