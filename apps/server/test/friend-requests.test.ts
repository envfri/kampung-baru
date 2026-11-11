// Ajakan berteman untuk pemain yang bertemu di alun-alun atau di rumah teman: harus diterima penerima,
// hanya untuk yang benar-benar bertemu, menghormati blokir & pengaturan privasi, penolakan tidak diberitahukan.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config';

config.paymentProvider = 'mock';
const { buildApp } = await import('../src/app');
const { resetSquares } = await import('../src/routes/square');
const { resetHouses } = await import('../src/routes/house');
const { resetPings } = await import('../src/lib/pings');
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
const square = (p: any) => p.c.post('/api/square/sync', { x: 10, y: 18 });
const ask = (from: any, to: any) => from.c.post('/api/friends/requests', { userId: to.id });
/** menyalakan "Terima ajakan berteman" (bawaannya mati) */
const open = async (p: any) => assert.equal((await p.c.post('/api/me/privacy', { friendRequests: true })).body.friendRequests, true);
const areFriends = async (a: any, b: any) => !!(await db.one(`select 1 from friendships where user_id = $1 and friend_id = $2`, [a.id, b.id]));

test('alun-alun: ajak berteman → kabar live + notifikasi → terima → berteman (dua arah)', async () => {
  resetSquares(); resetPings();
  const a = await player('Ajeng'), b = await player('Bayu');
  await square(a); await square(b);
  // bawaan: belum menerima ajakan (tombol tidak aktif, server menolak)
  assert.deepEqual((await a.c.get(`/api/friends/relations?ids=${b.id}`)).body.closed, [b.id]);
  const shut = await ask(a, b);
  assert.equal(shut.status, 403);
  assert.match(shut.body.error.message, /belum menerima ajakan/);
  await open(b);
  assert.deepEqual((await a.c.get(`/api/friends/relations?ids=${b.id}`)).body.closed, []);
  const r = await ask(a, b);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.status, 'sent');
  assert.equal(await areFriends(a, b), false, 'belum berteman sebelum diterima');
  // ajakan ganda tidak membuat ajakan baru
  assert.equal((await ask(a, b)).body.status, 'sent');
  assert.equal((await db.one(`select count(*)::int c from friend_requests where from_id = $1 and to_id = $2`, [a.id, b.id])).c, 1);
  // kabar live di sinkron berikutnya (sekali saja)
  const s1 = await square(b);
  const p = s1.body.pings.find((x: any) => x.kind === 'friend_ask');
  assert.ok(p && p.from === a.id && p.name === 'Ajeng' && p.pet?.name === 'Ajeng', JSON.stringify(s1.body.pings));
  assert.equal((await square(b)).body.pings.length, 0);
  // notifikasi kotak masuk & lencana
  const me = (await b.c.get('/api/me')).body;
  assert.equal(me.friendAsks, 1);
  const inbox = await db.query(`select title, body from notifications where user_id = $1 order by created_at desc`, [b.id]);
  assert.ok(inbox.some((n: any) => n.title === 'Ajakan berteman' && n.body.includes('Ajeng') && n.body.includes('alun-alun')), JSON.stringify(inbox));
  // daftar ajakan & status hubungan
  const list = (await b.c.get('/api/friends/requests')).body;
  assert.equal(list.incoming.length, 1);
  assert.equal(list.incoming[0].from.id, a.id);
  assert.equal(list.incoming[0].place, 'alun');
  assert.deepEqual((await a.c.get(`/api/friends/relations?ids=${b.id}`)).body.sent, [b.id]);
  assert.deepEqual((await b.c.get(`/api/friends/relations?ids=${a.id}`)).body.incoming.map((x: any) => x.from), [a.id]);
  // hanya penerima yang bisa menjawab
  assert.equal((await a.c.post(`/api/friends/requests/${p.id}/accept`)).status, 404);
  const acc = await b.c.post(`/api/friends/requests/${p.id}/accept`);
  assert.equal(acc.status, 200, JSON.stringify(acc.body));
  assert.equal(await areFriends(a, b), true);
  assert.equal(await areFriends(b, a), true);
  assert.equal((await b.c.post(`/api/friends/requests/${p.id}/accept`)).status, 404, 'tidak bisa dijawab dua kali');
  // pengajak mendapat kabar diterima
  const s2 = await square(a);
  assert.ok(s2.body.pings.some((x: any) => x.kind === 'friend_ok' && x.from === b.id));
  assert.ok((await a.c.get('/api/friends')).body.friends.some((f: any) => f.id === b.id));
  assert.equal((await b.c.get('/api/me')).body.friendAsks, 0);
  assert.deepEqual((await a.c.get(`/api/friends/relations?ids=${b.id}`)).body.friends, [b.id]);
  // sudah berteman
  assert.equal((await ask(a, b)).body.status, 'friends');
  // tugas pemula "Teman sekampung" ikut maju
  const q = await db.one(`select count(*)::int c from analytics_events where user_id = $1 and name = 'friend_added'`, [b.id]);
  assert.ok(q.c >= 1);
});

test('hanya untuk yang benar-benar bertemu: tidak bisa lewat ID saja atau presence palsu', async () => {
  resetSquares(); resetPings();
  const a = await player('Citra'), b = await player('Dodi');
  await square(a);
  const r = await ask(a, b);
  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, 'not_met');
  // klien memalsukan status "sedang berkunjung" ke rumah yang sama
  await a.c.post('/api/presence', { where: 'visit', host: b.id });
  await b.c.post('/api/presence', { where: 'home', host: b.id });
  assert.equal((await ask(a, b)).body.error.code, 'not_met');
  assert.equal((await ask(a, a)).status, 400, 'diri sendiri');
  assert.equal((await a.c.post('/api/friends/requests', { userId: 'bukan-uuid' })).status, 400);
});

test('saling mengajak = langsung berteman; ditolak = diam-diam tidak mengganggu lagi', async () => {
  resetSquares(); resetPings();
  const a = await player('Eka'), b = await player('Fajar'), c = await player('Gita');
  await square(a); await square(b); await square(c);
  await open(b); await open(c);
  assert.equal((await ask(a, b)).body.status, 'sent');
  const back = await ask(b, a);
  assert.equal(back.body.status, 'friends');
  assert.equal(await areFriends(a, b), true);
  // tolak
  assert.equal((await ask(a, c)).body.status, 'sent');
  const inc = (await c.c.get('/api/friends/requests')).body.incoming;
  assert.equal((await c.c.post(`/api/friends/requests/${inc[0].id}/decline`)).status, 200);
  assert.equal(await areFriends(a, c), false);
  await square(c);
  // mengajak lagi: pengajak tetap melihat "terkirim", penerima tidak mendapat ajakan/kabar baru
  assert.equal((await ask(a, c)).body.status, 'sent');
  assert.equal((await c.c.get('/api/friends/requests')).body.incoming.length, 0);
  assert.equal((await square(c)).body.pings.length, 0);
  assert.deepEqual((await a.c.get(`/api/friends/relations?ids=${c.id}`)).body.sent, [c.id], 'tetap terlihat menunggu');
});

test('privasi & blokir: penerima bisa menutup ajakan; blokir menghapus ajakan dan menolak ajakan baru', async () => {
  resetSquares(); resetPings();
  const a = await player('Hana'), b = await player('Indra'), c = await player('Joko');
  await square(a); await square(b); await square(c);
  // bawaan mati; "Nanti" pada ajakan sekali di alun-alun hanya mencatat sudah ditanya
  const me0 = (await b.c.get('/api/me')).body.user;
  assert.equal(me0.friend_requests, false);
  assert.equal(me0.friend_prompt_at, null);
  const later = await b.c.post('/api/me/privacy', { friendPrompt: 'later' });
  assert.equal(later.body.friendRequests, false);
  assert.ok(later.body.friendPromptAt);
  assert.ok((await b.c.get('/api/me')).body.user.friend_prompt_at, 'tidak ditanya lagi');
  const r = await ask(a, b);
  assert.equal(r.status, 403);
  assert.match(r.body.error.message, /belum menerima ajakan/);
  // menyalakan lalu mematikan lagi di Pengaturan
  await open(b);
  assert.equal((await b.c.post('/api/me/privacy', { friendRequests: false })).body.friendRequests, false);
  assert.equal((await ask(a, b)).status, 403);
  await open(a);
  // c mengajak a lalu a memblokir c: ajakan hilang, ajakan baru ditolak dua arah
  assert.equal((await ask(c, a)).body.status, 'sent');
  await a.c.post('/api/blocks', { userId: c.id });
  assert.equal((await a.c.get('/api/friends/requests')).body.incoming.length, 0);
  assert.equal((await ask(c, a)).status, 403);
  assert.equal((await ask(a, c)).status, 403);
});

test('rumah teman: tamu yang belum saling berteman bisa saling mengajak', async () => {
  resetHouses(); resetSquares(); resetPings();
  const host = await player('Kirana'), b = await player('Lintang'), c = await player('Melati');
  await open(c);
  for (const g of [b, c]) await g.c.post('/api/friends', { code: host.code });
  const sync = (p: any) => p.c.post(`/api/house/${host.id}/sync`, { roomId: host.room, x: 2, y: 2 });
  const sb = await sync(b);
  assert.equal(sb.body.live, true, JSON.stringify(sb.body));
  await sync(c);
  const r = await ask(b, c);
  assert.equal(r.body.status, 'sent', JSON.stringify(r.body));
  const s = await sync(c);
  assert.ok(s.body.pings.some((x: any) => x.kind === 'friend_ask' && x.from === b.id));
  assert.equal((await db.one(`select place from friend_requests where from_id = $1 and to_id = $2`, [b.id, c.id])).place, 'visit');
  const inbox = await db.query(`select body from notifications where user_id = $1`, [c.id]);
  assert.ok(inbox.some((n: any) => n.body.includes('rumah teman')));
  // orang luar yang tidak di rumah itu tidak bisa diajak dari rumah ini
  const d = await player('Nadia');
  assert.equal((await ask(b, d)).body.error.code, 'not_met');
});

test('akun tamu tanpa nama: ajakan memakai nama yang sama seperti di alun-alun (nama pet)', async () => {
  resetSquares(); resetPings();
  const anon = client();
  await anon.post('/api/auth/guest');
  const st = await anon.post('/api/pet', { name: 'Klepon', color: '#9FD0E8', ear: 'kucing' });
  const a = { c: anon, id: st.body.state.user.id as string };
  const b = await player('Oki');
  await open(b);
  await square(a); await square(b);
  assert.equal((await ask(a, b)).body.status, 'sent');
  const p = (await square(b)).body.pings[0];
  assert.notEqual(p.name, 'Tamu');
  assert.equal(p.name, (await square(b)).body.members.find((m: any) => m.id === a.id).name);
  assert.equal((await b.c.get('/api/friends/requests')).body.incoming[0].from.name, p.name);
});
