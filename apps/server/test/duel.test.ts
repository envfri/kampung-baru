// Duel dengan teman: tantangan bergantian (lawan bayangan) dan main bareng (live).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config';
import { bakiakPrompts, gasingRounds } from '@kb/shared';

config.paymentProvider = 'mock';
const { buildApp } = await import('../src/app');
let app: any;
let db: any;
before(async () => { ({ app, db } = await buildApp({ memoryDb: true, logger: false, rateLimit: false, worker: false })); });
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
async function player(name: string) {
  const c = client();
  await c.post('/api/auth/guest');
  const p = await c.post('/api/pet', { name, color: '#F6B7A8', ear: 'tunas' });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  return { c, id: p.body.state.user.id, code: p.body.state.user.friend_code };
}
async function pair() {
  const a = await player('Aa'), b = await player('Bb');
  await b.c.post('/api/friends', { code: a.code });
  return { a, b };
}
const backdate = (id: string, side: 'c' | 'o', sec: number) => db.query(`update duels set ${side}_started_at = now() - ($2::int * interval '1 second') where id = $1`, [id, sec]);
const coins = async (c: any) => (await c.get('/api/me')).body.wallet.coin;

test('tantangan bergantian: bayangan lawan, pemenang & hadiah untuk keduanya', async () => {
  const { a, b } = await pair();
  const stranger = await player('Cc');
  assert.equal((await stranger.c.post('/api/duels', { friendId: a.id, game: 'bakiak' })).status, 403, 'harus berteman');
  const mk = await a.c.post('/api/duels', { friendId: b.id, game: 'bakiak' });
  assert.equal(mk.status, 200, JSON.stringify(mk.body));
  const id = mk.body.duel.id;
  assert.equal((await b.c.post('/api/duels', { friendId: a.id, game: 'gasing' })).body.error?.code, 'duel_exists');
  assert.equal((await b.c.get('/api/me')).body.duelsPending, 1);
  // A main duluan (tanpa bayangan)
  const sa = await a.c.post(`/api/duels/${id}/start`);
  assert.equal(sa.status, 200, JSON.stringify(sa.body));
  assert.equal(sa.body.ghost, null);
  assert.equal((await a.c.post(`/api/duels/${id}/start`)).body.error?.code, 'started', 'tidak bisa mengulang');
  const tapsA = bakiakPrompts(sa.body.seed).slice(0, 40).map((f, i) => [300 + i * 200, f]);
  await backdate(id, 'c', 25);
  const fa = await a.c.post(`/api/duels/${id}/finish`, { inputs: { taps: tapsA } });
  assert.equal(fa.status, 200, JSON.stringify(fa.body));
  assert.equal(fa.body.duel.me.label, '40 langkah');
  assert.equal(fa.body.duel.status, 'open');
  // B membalas: dapat bayangan langkah A
  const before = { a: await coins(a.c), b: await coins(b.c) };
  const sb = await b.c.post(`/api/duels/${id}/start`);
  assert.equal(sb.body.seed, sa.body.seed, 'seed sama');
  assert.deepEqual(sb.body.ghost.taps.length, 40);
  const tapsB = bakiakPrompts(sb.body.seed).slice(0, 25).map((f, i) => [300 + i * 200, f]);
  await backdate(id, 'o', 25);
  const fb = await b.c.post(`/api/duels/${id}/finish`, { inputs: { taps: tapsB } });
  assert.equal(fb.status, 200, JSON.stringify(fb.body));
  assert.equal(fb.body.duel.status, 'done');
  assert.equal(fb.body.duel.result, 'kalah');
  assert.equal(fb.body.duel.them.label, '40 langkah');
  const after = { a: await coins(a.c), b: await coins(b.c) };
  assert.ok(after.a - before.a >= 30, `pemenang dapat koin (${after.a - before.a})`);
  assert.ok(after.b - before.b >= 10 && after.b - before.b < after.a - before.a, 'yang kalah tetap dapat koin hiburan');
  const list = (await a.c.get('/api/duels')).body;
  assert.equal(list.duels[0].result, 'menang');
  assert.equal(list.duels[0].me.reward, after.a - before.a, 'hadiah tercatat di duel');
  const q = (await a.c.get('/api/quests')).body;
  assert.equal(q.badges.find((x: any) => x.id === 'b-duel').progress, 1);
});

test('main bareng: keduanya siap → mulai bersama, progres lawan terlihat', async () => {
  const { a, b } = await pair();
  const id = (await a.c.post('/api/duels', { friendId: b.id, game: 'gasing' })).body.duel.id;
  const r1 = await a.c.post(`/api/duels/${id}/ready`);
  assert.equal(r1.body.duel.liveStart, null, 'lawan belum siap');
  const r2 = await b.c.post(`/api/duels/${id}/ready`);
  assert.equal(r2.body.duel.status, 'live');
  assert.ok(r2.body.duel.liveStart > Date.now(), 'mulai beberapa detik lagi');
  assert.equal((await a.c.post(`/api/duels/${id}/ready`)).body.duel.liveStart, r2.body.duel.liveStart, 'waktu mulai sama untuk keduanya');
  const sa = await a.c.post(`/api/duels/${id}/start`);
  const sb = await b.c.post(`/api/duels/${id}/start`);
  assert.equal(sb.body.ghost, null, 'main bareng: tanpa bayangan');
  await a.c.post(`/api/duels/${id}/progress`, { p: 72 });
  const pb = await b.c.post(`/api/duels/${id}/progress`, { p: 40 });
  assert.equal(pb.body.them, 72);
  const rel = gasingRounds(sa.body.seed, 5).map((r) => Math.round(r.zone * r.speed));
  await backdate(id, 'c', 30); await backdate(id, 'o', 30);
  await a.c.post(`/api/duels/${id}/finish`, { inputs: { releases: rel } });
  const fb = await b.c.post(`/api/duels/${id}/finish`, { inputs: { releases: rel } });
  assert.equal(fb.body.duel.result, 'seri', 'lepas di waktu yang sama = seri');
});

test('tolak tantangan & langkah tidak wajar', async () => {
  const { a, b } = await pair();
  const id = (await a.c.post('/api/duels', { friendId: b.id, game: 'layangan' })).body.duel.id;
  assert.equal((await b.c.post(`/api/duels/${id}/decline`)).status, 200);
  assert.equal((await b.c.post(`/api/duels/${id}/start`)).body.error?.code, 'closed');
  const id2 = (await a.c.post('/api/duels', { friendId: b.id, game: 'bakiak' })).body.duel.id;
  await a.c.post(`/api/duels/${id2}/start`);
  const bot = Array.from({ length: 50 }, (_, i) => [i * 10, 'L']);
  assert.equal((await a.c.post(`/api/duels/${id2}/finish`, { inputs: { taps: bot } })).body.error?.code, 'invalid_run');
  const v = (await a.c.get(`/api/duels/${id2}`)).body.duel;
  assert.equal(v.me.score, 0, 'langkah curang dihitung 0');
  const stranger = await player('Dd');
  assert.equal((await stranger.c.get(`/api/duels/${id2}`)).status, 403);
  // B mulai lalu aplikasinya tertutup: menyerah = skor 0, duel tetap tuntas & A menang
  await b.c.post(`/api/duels/${id2}/start`);
  const ff = await b.c.post(`/api/duels/${id2}/finish`, { forfeit: true });
  assert.equal(ff.status, 200, JSON.stringify(ff.body));
  assert.equal(ff.body.duel.status, 'done');
  assert.equal(ff.body.duel.result, 'seri', '0 lawan 0 (langkah A tadi tidak sah)');
});
