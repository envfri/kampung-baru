// Kunjungan bareng: interaksi dengan pet teman, rumah live (beberapa tamu), obrolan, main bareng, foto bareng.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config';

config.paymentProvider = 'mock';
const { buildApp } = await import('../src/app');
const { resetHouses } = await import('../src/routes/house');
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
  const p = await c.post('/api/pet', { name, color: '#F6B7A8', ear: 'tunas' });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  return { c, id: p.body.state.user.id as string, code: p.body.state.user.friend_code as string, room: p.body.state.rooms[0].id as string };
}
async function friends(host: any, ...others: any[]) { for (const o of others) await o.c.post('/api/friends', { code: host.code }); }
const setVisit = async (patch: Record<string, unknown>) => {
  const row = await db.one(`select value from settings where key = 'game'`);
  const v = row?.value ?? {};
  v.visit = { ...(v.visit ?? {}), ...patch };
  await db.query(`insert into settings (key, value) values ('game', $1::text::jsonb) on conflict (key) do update set value = excluded.value`, [JSON.stringify(v)]);
  (await import('../src/lib/core')).invalidateCaches();
};

test('interaksi dengan pet teman: hadiah terbatas, camilan menambah Kenyang pet teman, buku tamu & notifikasi', async () => {
  const a = await player('Mochi'), b = await player('Kopi'), x = await player('Asing');
  await friends(a, b);
  assert.equal((await x.c.post(`/api/visit/${a.id}/act`, { kind: 'sapa' })).status, 403, 'harus berteman');
  const v = await b.c.get(`/api/visit/${a.id}`);
  assert.equal(v.body.together.left, 6);
  const s1 = await b.c.post(`/api/visit/${a.id}/act`, { kind: 'sapa' });
  assert.equal(s1.status, 200, JSON.stringify(s1.body));
  assert.equal(s1.body.rewarded, true);
  assert.ok(s1.body.coins > 0);
  // camilan dari tas B untuk pet A
  await db.query(`update pets set kenyang = 40 where user_id = $1`, [a.id]);
  await db.query(`insert into inventory (user_id, item_id, qty) values ($1, 'klepon', 2) on conflict (user_id, item_id) do update set qty = 2`, [b.id]);
  const c1 = await b.c.post(`/api/visit/${a.id}/act`, { kind: 'camilan', itemId: 'klepon' });
  assert.equal(c1.status, 200, JSON.stringify(c1.body));
  assert.ok(c1.body.hostPet.needs.kenyang > 40, 'Kenyang pet teman bertambah');
  assert.equal(c1.body.inventory.klepon, 1, 'camilan berkurang dari tas tamu');
  for (let i = 0; i < 5; i++) await b.c.post(`/api/visit/${a.id}/act`, { kind: 'peluk' });
  const over = await b.c.post(`/api/visit/${a.id}/act`, { kind: 'kejar' });
  assert.equal(over.status, 200);
  assert.equal(over.body.rewarded, false, 'lewat batas: tetap boleh main, tanpa hadiah');
  const me = (await a.c.get('/api/me')).body;
  assert.ok(me.guestbookUnread >= 8, 'buku tamu bertambah');
  const gb = (await a.c.get('/api/guestbook')).body;
  assert.equal(gb.entries[0].name, 'Kopi');
  assert.equal((await a.c.get('/api/me')).body.guestbookUnread, 0, 'sudah dibaca');
  const notif = await db.one(`select count(*)::int c, max(title) t from notifications where user_id = $1 and url = '/#bukutamu'`, [a.id]);
  assert.equal(notif.c, 1, 'satu notifikasi per tamu per jam');
  assert.match(notif.t, /Kopi main ke rumahmu/);
});

test('rumah live: beberapa tamu saling melihat, ekspresi, obrolan tersaring, antar pulang, batas tamu', async () => {
  resetHouses();
  const a = await player('Rumah'), b = await player('Tamu1'), c = await player('Tamu2'), d = await player('Tamu3');
  await friends(a, b, c, d);
  const sync = (p: any, body: any = {}) => p.c.post(`/api/house/${a.id}/sync`, { roomId: a.room, x: 2, y: 2, ...body });
  await sync(a, { x: 1, y: 1 });
  await sync(b, { x: 3, y: 3 });
  const rc = await sync(c, { x: 4, y: 2, emote: 'hati' });
  assert.equal(rc.body.live, true);
  assert.deepEqual(rc.body.members.map((m: any) => m.name).sort(), ['Rumah', 'Tamu1']);
  assert.ok(rc.body.members.find((m: any) => m.host).pet.name, 'pet tuan rumah ikut tampil');
  const rb = await sync(b, { since: 0 });
  assert.ok(rb.body.events.some((e: any) => e.kind === 'emote' && e.emote === 'hati'), 'ekspresi terlihat tamu lain');
  // obrolan: frasa, ketik bebas, tautan & kata terlarang ditolak
  assert.equal((await b.c.post(`/api/house/${a.id}/say`, { text: 'Halo!' })).status, 200);
  assert.equal((await b.c.post(`/api/house/${a.id}/say`, { text: 'kedua' })).body.error?.code, 'too_fast');
  assert.equal((await c.c.post(`/api/house/${a.id}/say`, { text: 'main ke www.contoh.com ya' })).body.error?.code, 'chat_link');
  assert.equal((await c.c.post(`/api/house/${a.id}/say`, { text: 'wa aku 0812 3456 7890' })).body.error?.code, 'chat_link');
  await db.query(`insert into banned_words (word) values ('jelek') on conflict do nothing`);
  (await import('../src/lib/core')).invalidateBanned();
  assert.equal((await c.c.post(`/api/house/${a.id}/say`, { text: 'rumahmu jelek' })).body.error?.code, 'chat_banned');
  assert.equal((await c.c.post(`/api/house/${a.id}/say`, { text: 'Rumahmu adem banget' })).status, 200, 'ketik bebas boleh');
  const ra = await sync(a, { since: rb.body.seq });
  assert.ok(ra.body.events.some((e: any) => e.kind === 'say' && e.text === 'Rumahmu adem banget'));
  assert.equal((await db.one(`select count(*)::int c from house_chat where host_id = $1`, [a.id])).c, 2, 'obrolan tersimpan untuk moderasi');
  // batas tamu live
  await setVisit({ maxLive: 2 });
  const rd = await sync(d);
  assert.equal(rd.body.full, true, 'rumah penuh');
  assert.ok(rd.body.members.length >= 2, 'tetap bisa melihat yang di dalam');
  await setVisit({ maxLive: 4 });
  // tuan rumah mengantar tamu pulang
  assert.equal((await b.c.post(`/api/house/${a.id}/kick`, { userId: c.id })).status, 403);
  assert.equal((await a.c.post(`/api/house/${a.id}/kick`, { userId: c.id })).status, 200);
  assert.equal((await sync(c)).body.reason, 'kicked');
  // status online & tamu di daftar teman
  const fl = (await b.c.get('/api/friends')).body.friends.find((f: any) => f.id === a.id);
  assert.equal(fl.online, true);
  assert.equal(fl.where, 'home');
  assert.ok(fl.guests >= 1);
  // privasi: sembunyikan status & tolak tamu live
  await a.c.post('/api/me/privacy', { showOnline: false, liveVisits: false });
  assert.equal((await b.c.get('/api/friends')).body.friends.find((f: any) => f.id === a.id).online, false);
  assert.equal((await sync(b)).body.reason, 'host_off');
});

test('main bareng: Masak bareng bergiliran & Lempar bola, hadiah untuk semua pemain', async () => {
  resetHouses();
  const a = await player('Dapur'), b = await player('Koki');
  await friends(a, b);
  const sync = (p: any) => p.c.post(`/api/house/${a.id}/sync`, { roomId: a.room, x: 2, y: 2 });
  await sync(a);
  assert.equal((await a.c.post(`/api/house/${a.id}/coop`, { action: 'start', game: 'masak' })).body.error?.code, 'coop_alone');
  await sync(b);
  const st = await a.c.post(`/api/house/${a.id}/coop`, { action: 'start', game: 'masak' });
  assert.equal(st.status, 200, JSON.stringify(st.body));
  let coop = st.body.coop;
  const coinsBefore = (await b.c.get('/api/me')).body.wallet.coin;
  const who = (id: string) => (id === a.id ? a : b);
  const other = (id: string) => (id === a.id ? b : a);
  assert.equal((await other(coop.active).c.post(`/api/house/${a.id}/coop`, { action: 'pick', coopId: coop.id, pick: 'nasi' })).body.error?.code, 'not_turn');
  // kunci jawaban dari server (uji): ambil resep dari keadaan internal lewat sinkron
  for (let i = 0; i < coop.steps; i++) {
    const s = (await sync(a)).body.coop;
    // coba semua pilihan sampai benar (salah maksimal 2 kali)
    let advanced = false;
    for (const pick of s.options) {
      const r = await who(s.active).c.post(`/api/house/${a.id}/coop`, { action: 'pick', coopId: s.id, pick });
      coop = r.body.coop;
      if (coop.done || coop.step > s.step) { advanced = true; break; }
      if (coop.mistakes >= 2) break;
    }
    if (coop.done) break;
    assert.ok(advanced || coop.mistakes < 3);
  }
  if (!coop.done) { const r = await a.c.post(`/api/house/${a.id}/coop`, { action: 'quit', coopId: coop.id }); coop = r.body.coop; }
  assert.equal(coop.done, true);
  assert.equal(coop.results.length, 2, 'hadiah untuk kedua pemain');
  assert.ok((await b.c.get('/api/me')).body.wallet.coin > coinsBefore, 'koin masuk');
  // Lempar bola
  const lb = await b.c.post(`/api/house/${a.id}/coop`, { action: 'start', game: 'bola' });
  assert.equal(lb.status, 200, JSON.stringify(lb.body));
  let ball = lb.body.coop;
  for (let i = 0; i < 6; i++) {
    await new Promise((r) => setTimeout(r, 520));
    const r = await who(ball.holder).c.post(`/api/house/${a.id}/coop`, { action: 'pass', coopId: ball.id, hit: true });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    ball = r.body.coop;
  }
  assert.equal(ball.passes, 6);
  const q = await a.c.post(`/api/house/${a.id}/coop`, { action: 'quit', coopId: ball.id });
  assert.equal(q.body.coop.ok, true, '5 oper atau lebih = berhasil');
});

test('foto bareng: masuk album semua pet di foto & dipajang di lukisan rumah', async () => {
  resetHouses();
  const a = await player('Kebun'), b = await player('Pelancong');
  await friends(a, b);
  // tuan rumah tidak online: pet-nya tetap ikut berfoto
  const p = await b.c.post(`/api/house/${a.id}/photo`, { roomId: a.room, pose: 'peluk' });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  assert.equal(p.body.photo.members.length, 2);
  assert.equal(p.body.photo.pose, 'peluk');
  const albumA = (await a.c.get('/api/photos')).body;
  assert.equal(albumA.photos.length, 1);
  assert.equal(albumA.featured, p.body.photo.id, 'foto pertama langsung dipajang');
  assert.equal((await a.c.get('/api/me')).body.photo.id, p.body.photo.id);
  assert.equal((await b.c.get(`/api/visit/${a.id}`)).body.photo.id, p.body.photo.id, 'tamu melihat foto di lukisan rumah teman');
  assert.equal((await a.c.post(`/api/photos/${p.body.photo.id}/feature`, { off: true })).body.featured, null);
  const solo = await player('Sendiri');
  assert.equal((await solo.c.post(`/api/house/${solo.id}/photo`, { roomId: solo.room })).body.error?.code, 'photo_alone');
});
