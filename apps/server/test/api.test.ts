import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config';

config.adminEmail = 'owner@test.local';
config.adminPassword = 'rahasia-sekali-123';
config.paymentProvider = 'mock';
config.midtransServerKey = 'test-server-key';

const { buildApp } = await import('../src/app');
let app: any;
let db: any;

before(async () => {
  ({ app, db } = await buildApp({ memoryDb: true, logger: false, rateLimit: false, worker: false }));
});
after(async () => app?.close());

/** Klien kecil yang menyimpan cookie per pemain. */
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

async function newPlayer(petName = 'Mochi') {
  const c = client();
  const g = await c.post('/api/auth/guest');
  assert.equal(g.status, 200);
  const p = await c.post('/api/pet', { name: petName, color: '#F6B7A8', ear: 'tunas', ownerName: 'Tester' });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  return { c, state: p.body.state };
}

test('tamu baru mendapat modal awal, pet, dan ruangan', async () => {
  const { state } = await newPlayer();
  assert.equal(state.wallet.coin, 300);
  assert.equal(state.pet.name, 'Mochi');
  assert.equal(state.inventory['pisang-goreng'], 3);
  assert.equal(state.room.layout.length, 3);
});

test('nama kasar ditolak', async () => {
  const c = client();
  await c.post('/api/auth/guest');
  const r = await c.post('/api/pet', { name: 'b4ngsat', color: '#F6B7A8', ear: 'tunas' });
  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, 'name_banned');
});

test('makan memakai item dari tas dan menaikkan kenyang', async () => {
  const { c, state } = await newPlayer();
  const r = await c.post('/api/action', { type: 'makan', itemId: 'pisang-goreng' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.inventory['pisang-goreng'], 2);
  assert.ok(r.body.pet.needs.kenyang > state.pet.needs.kenyang);
  const r2 = await c.post('/api/action', { type: 'makan', itemId: 'kasur-rotan' });
  assert.equal(r2.status, 400);
});

test('cooldown mandi berlaku', async () => {
  const { c } = await newPlayer();
  assert.equal((await c.post('/api/action', { type: 'mandi' })).status, 200);
  const again = await c.post('/api/action', { type: 'mandi' });
  assert.equal(again.status, 400);
  assert.equal(again.body.error.code, 'cooldown');
});

test('beli dengan requestId yang sama hanya memotong koin sekali', async () => {
  const { c } = await newPlayer();
  const body = { itemId: 'pot-monstera', requestId: 'req-abc-12345' };
  const a = await c.post('/api/shop/buy', body);
  const b = await c.post('/api/shop/buy', body);
  assert.equal(a.status, 200);
  assert.equal(b.body.wallet.coin, a.body.wallet.coin);
  assert.equal(a.body.wallet.coin, 300 - 45);
  const notForSale = await c.post('/api/shop/buy', { itemId: 'tomat' });
  assert.equal(notForSale.status, 400);
});

test('susunan ruangan divalidasi di server', async () => {
  const { c } = await newPlayer();
  await c.post('/api/shop/buy', { itemId: 'meja-bambu' });
  const me = (await c.get('/api/me')).body;
  const layout = [...me.room.layout, { i: 'meja-bambu', x: 2, y: 4 }];
  const ok = await c.post('/api/room', { layout, version: me.room.version });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.inventory['meja-bambu'], undefined);
  // menaruh barang yang tidak dimiliki
  const cheat = await c.post('/api/room', { layout: [...layout, { i: 'sofa-santai', x: 0, y: 0 }], version: ok.body.room.version });
  assert.equal(cheat.status, 400);
  // bertumpuk
  const overlap = await c.post('/api/room', { layout: [...me.room.layout, { i: 'kasur-rotan', x: 4, y: 0 }], version: ok.body.room.version });
  assert.equal(overlap.status, 400);
  // versi lama
  const stale = await c.post('/api/room', { layout, version: me.room.version });
  assert.equal(stale.status, 409);
});

test('teman: tambah lewat kode, kunjungi, hadiah sekali sehari', async () => {
  const a = await newPlayer('Kopi');
  const b = await newPlayer('Tempe');
  const code = (await b.c.get('/api/me')).body.user.friend_code;
  const add = await a.c.post('/api/friends', { code });
  assert.equal(add.status, 200);
  const list = (await b.c.get('/api/friends')).body.friends;
  assert.equal(list.length, 1);
  const bId = add.body.friend.id;
  const visit = await a.c.get(`/api/visit/${bId}`);
  assert.equal(visit.status, 200);
  assert.equal(visit.body.pet.name, 'Tempe');
  const claim = await a.c.post(`/api/visit/${bId}/claim`);
  assert.equal(claim.status, 200);
  assert.ok(claim.body.coins >= 20);
  assert.equal((await a.c.post(`/api/visit/${bId}/claim`)).status, 400);
  // hadiah barang
  const gift = await a.c.post('/api/gifts', { to: bId, itemId: 'klepon', message: 'dari Kopi' });
  assert.equal(gift.status, 200, JSON.stringify(gift.body));
  const inbox = (await b.c.get('/api/gifts')).body.gifts;
  assert.equal(inbox.length, 1);
  const open = await b.c.post(`/api/gifts/${inbox[0].id}/open`);
  assert.equal(open.body.inventory.klepon, 3);
});

test('kebun: tanam lalu belum bisa dipanen', async () => {
  const { c } = await newPlayer();
  const p = await c.post('/api/garden/plant', { slot: 0, seedId: 'bibit-tomat' });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  assert.equal(p.body.garden.length, 1);
  const h = await c.post('/api/garden/harvest', { slot: 0 });
  assert.equal(h.body.error.code, 'not_ready');
});

test('lomba karung menolak waktu mustahil dan menerima waktu wajar', async () => {
  const { c } = await newPlayer();
  const s1 = await c.post('/api/karung/start');
  assert.equal(s1.status, 200, JSON.stringify(s1.body));
  const cheat = await c.post('/api/karung/finish', { raceId: s1.body.raceId, timeMs: 500, taps: 40 });
  assert.equal(cheat.body.error.code, 'invalid_run');
  const s2 = await c.post('/api/karung/start');
  await new Promise((r) => setTimeout(r, 3100));
  const fin = await c.post('/api/karung/finish', { raceId: s2.body.raceId, timeMs: 3050, taps: 42 });
  assert.equal(fin.status, 200, JSON.stringify(fin.body));
  assert.equal(fin.body.rank, 1);
  assert.ok(fin.body.reward >= 40);
});

test('mancing: tarik terlalu cepat = lepas', async () => {
  const { c } = await newPlayer();
  const cast = await c.post('/api/fish/cast');
  assert.equal(cast.status, 200, JSON.stringify(cast.body));
  const reel = await c.post('/api/fish/reel', { castId: cast.body.castId });
  assert.equal(reel.body.result, 'missed');
  assert.equal(reel.body.reason, 'early');
});

test('hadiah harian hanya sekali', async () => {
  const { c } = await newPlayer();
  const d = await c.post('/api/daily');
  assert.equal(d.status, 200);
  assert.equal(d.body.streak, 1);
  assert.equal((await c.post('/api/daily')).status, 400);
});

test('beli Mutiara (mock): tamu ditolak, akun email berhasil, kredit tidak dobel', async () => {
  const { c } = await newPlayer();
  config.paymentProvider = 'midtrans';
  assert.equal((await c.post('/api/pearls/checkout', { packageId: 'p-kecil' })).body.error.code, 'guest');
  config.paymentProvider = 'mock';
  const start = await c.post('/api/auth/email/start', { email: 'pemain@contoh.id' });
  assert.equal(start.status, 200);
  const v = await c.post('/api/auth/email/verify', { email: 'pemain@contoh.id', code: start.body.devCode });
  assert.equal(v.status, 200, JSON.stringify(v.body));
  assert.equal(v.body.linked, true);
  const before = (await c.get('/api/me')).body.wallet.pearl;
  const co = await c.post('/api/pearls/checkout', { packageId: 'p-kecil' });
  assert.equal(co.status, 200);
  await app.inject({ method: 'POST', url: co.body.redirectUrl, payload: 'action=pay', headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  await app.inject({ method: 'POST', url: co.body.redirectUrl, payload: 'action=pay', headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  const after = (await c.get(`/api/payments/${co.body.paymentId}`)).body;
  assert.equal(after.payment.status, 'paid');
  assert.equal(after.wallet.pearl, before + 10);
  // beli kosmetik dengan Mutiara
  const buy = await c.post('/api/shop/buy', { itemId: 'mahkota-melati', currency: 'pearl' });
  assert.equal(buy.status, 200, JSON.stringify(buy.body));
  const wear = await c.post('/api/pet/look', { wear: { head: 'mahkota-melati' } });
  assert.equal(wear.body.pet.wear.head, 'mahkota-melati');
});

test('notifikasi Midtrans dengan signature salah ditolak', async () => {
  const r = await app.inject({ method: 'POST', url: '/api/payments/midtrans/notify', payload: { order_id: 'x', status_code: '200', gross_amount: '1000.00', signature_key: 'salah' } });
  assert.equal(r.statusCode, 403);
});

test('admin: login, ubah item, peran dibatasi', async () => {
  const anon = client();
  assert.equal((await anon.get('/api/admin/items')).status, 401);
  const owner = client();
  const bad = await owner.post('/api/admin/login', { email: 'owner@test.local', password: 'salah' });
  assert.equal(bad.status, 401);
  assert.equal((await owner.post('/api/admin/login', { email: 'owner@test.local', password: 'rahasia-sekali-123' })).status, 200);
  const items = (await owner.get('/api/admin/items')).body.items;
  const kasur = items.find((i: any) => i.id === 'kasur-rotan');
  const upd = await owner.call('PUT', '/api/admin/items/kasur-rotan', { ...kasur, price_coin: 99 });
  assert.equal(upd.status, 200, JSON.stringify(upd.body));
  const cat = (await client().get('/api/catalog')).body;
  assert.equal(cat.items.find((i: any) => i.id === 'kasur-rotan').price_coin, 99);
  // item baru dengan gambar bawaan
  const created = await owner.post('/api/admin/items', { id: 'bantal-kucing', kind: 'furniture', name: 'Bantal Duduk', price_coin: 20, shop: 'mebel', art: { type: 'builtin', key: 'kotak', colors: { main: '#FF8FA3' }, params: { height: 10 } }, data: { w: 1, d: 1 } });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  // pengaturan
  const st = (await owner.get('/api/admin/settings')).body.value;
  st.social.visitCoins = 33;
  assert.equal((await owner.call('PUT', '/api/admin/settings', { value: st })).status, 200);
  assert.equal((await client().get('/api/catalog')).body.settings.social.visitCoins, 33);
  // moderator tidak boleh ubah item
  assert.equal((await owner.post('/api/admin/admins', { email: 'mod@test.local', password: 'moderator-123', role: 'moderator' })).status, 200);
  const mod = client();
  await mod.post('/api/admin/login', { email: 'mod@test.local', password: 'moderator-123' });
  assert.equal((await mod.call('PUT', '/api/admin/items/kasur-rotan', { ...kasur })).status, 403);
  assert.equal((await mod.get('/api/admin/players')).status, 200);
  const stats = await owner.get('/api/admin/stats');
  assert.equal(stats.status, 200, JSON.stringify(stats.body));
  assert.ok(stats.body.users > 0);
  assert.equal(stats.body.series.length, 14);
});

test('pemain yang diblokir tidak bisa main', async () => {
  const { c } = await newPlayer();
  const me = (await c.get('/api/me')).body;
  const owner = client();
  await owner.post('/api/admin/login', { email: 'owner@test.local', password: 'rahasia-sekali-123' });
  assert.equal((await owner.post(`/api/admin/players/${me.user.id}/ban`, { reason: 'spam nama' })).status, 200);
  assert.equal((await c.get('/api/me')).status, 401);
});

test('notifikasi: hadiah teman masuk ke kotak notifikasi penerima', async () => {
  const a = await newPlayer('Kopi');
  const b = await newPlayer('Onde');
  const code = (await b.c.get('/api/me')).body.user.friend_code;
  const add = await a.c.post('/api/friends', { code });
  await a.c.post('/api/gifts', { to: add.body.friend.id, itemId: 'klepon', message: 'selamat' });
  await new Promise((r) => setTimeout(r, 150));
  const n = (await b.c.get('/api/notifications')).body;
  assert.ok(n.items.some((i: any) => i.title === 'Kamu dapat hadiah'), JSON.stringify(n.items));
  assert.ok(n.items.some((i: any) => i.title === 'Teman baru'));
  assert.ok((await b.c.get('/api/me')).body.notificationsUnread >= 2);
  await b.c.post('/api/notifications/read');
  assert.equal((await b.c.get('/api/me')).body.notificationsUnread, 0);
});

test('notifikasi: kebun siap panen dikirim oleh worker sekali saja', async () => {
  const { runJobs } = await import('../src/lib/worker');
  const { c } = await newPlayer('Tomi');
  const me = (await c.get('/api/me')).body;
  await c.post('/api/garden/plant', { slot: 1, seedId: 'bibit-tomat' });
  await db.query(`update garden_plots set ready_at = now() - interval '1 minute' where user_id = $1`, [me.user.id]);
  await runJobs(db);
  await runJobs(db);
  const n = (await c.get('/api/notifications')).body.items.filter((i: any) => i.kind === 'garden');
  assert.equal(n.length, 1);
  assert.equal(n[0].url, '/#garden');
});

test('notifikasi: broadcast admin, preferensi, dan validasi langganan push', async () => {
  const { runJobs } = await import('../src/lib/worker');
  const p = await newPlayer('Siti');
  const pref = await p.c.post('/api/notify/prefs', { prefs: { events: false, garden: true } });
  assert.equal(pref.body.prefs.events, false);
  assert.equal((await p.c.post('/api/push/subscribe', { subscription: { endpoint: 'http://tidak-aman', keys: { p256dh: 'x', auth: 'y' } } })).status, 400);
  assert.ok((await client().get('/api/push/key')).body.publicKey.length > 40);
  const owner = client();
  await owner.post('/api/admin/login', { email: 'owner@test.local', password: 'rahasia-sekali-123' });
  const b = await owner.post('/api/admin/broadcasts', { title: 'Event baru', body: 'Pekan Ceria dimulai hari ini.', url: '/#news', segment: 'all' });
  assert.equal(b.status, 200, JSON.stringify(b.body));
  await new Promise((r) => setTimeout(r, 300));
  await runJobs(db);
  const list = (await owner.get('/api/admin/broadcasts')).body.broadcasts;
  assert.equal(list[0].status, 'sent');
  assert.ok(list[0].recipients > 1);
  // tetap masuk kotak notifikasi walau push event dimatikan
  assert.ok((await p.c.get('/api/notifications')).body.items.some((i: any) => i.title === 'Event baru'));
});

test('push: server mengirim Web Push terenkripsi dan menghapus langganan yang mati', async () => {
  const https = await import('node:https');
  const { execFileSync } = await import('node:child_process');
  const { mkdtempSync, readFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { createECDH, randomBytes } = await import('node:crypto');
  const { notify, setPushAgent } = await import('../src/lib/push');
  // sertifikat lokal sementara untuk endpoint push tiruan
  const dir = mkdtempSync(join(tmpdir(), 'kbpush-'));
  execFileSync('openssl', ['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-days', '1', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1', '-keyout', join(dir, 'k.pem'), '-out', join(dir, 'c.pem')], { stdio: 'ignore' });
  const cert = readFileSync(join(dir, 'c.pem'));
  const got: any[] = [];
  let status = 201;
  const srv = https.createServer({ key: readFileSync(join(dir, 'k.pem')), cert }, (req, res) => {
    let n = 0;
    req.on('data', (c) => (n += c.length));
    req.on('end', () => { got.push({ headers: req.headers, bytes: n }); res.statusCode = status; res.end(); });
  });
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', () => r()));
  setPushAgent(new https.Agent({ ca: cert }));
  try {
    const port = (srv.address() as any).port;
    const { c } = await newPlayer('Pusi');
    const me = (await c.get('/api/me')).body;
    const ecdh = createECDH('prime256v1');
    ecdh.generateKeys();
    await db.query(`insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ($1,$2,$3,$4)`, [me.user.id, `https://127.0.0.1:${port}/push/abc`, ecdh.getPublicKey().toString('base64url'), randomBytes(16).toString('base64url')]);
    await notify(db, me.user.id, { kind: 'garden', title: 'Kebun siap dipanen', body: 'Tomat siap.', url: '/#garden' });
    assert.equal(got.length, 1);
    assert.equal(got[0].headers['content-encoding'], 'aes128gcm');
    assert.match(String(got[0].headers.authorization), /^vapid t=/);
    assert.ok(got[0].bytes > 50);
    assert.ok((await db.one(`select last_ok_at from push_subscriptions where user_id = $1`, [me.user.id])).last_ok_at);
    // preferensi dimatikan: tetap masuk kotak notifikasi, tapi tidak dikirim ke HP
    await c.post('/api/notify/prefs', { prefs: { garden: false } });
    await notify(db, me.user.id, { kind: 'garden', title: 'Kebun lagi', body: 'x' });
    assert.equal(got.length, 1);
    // endpoint mati (410) dihapus
    status = 410;
    await notify(db, me.user.id, { kind: 'social', title: 'Hadiah', body: 'x' });
    assert.equal(got.length, 2);
    assert.equal(await db.one(`select 1 from push_subscriptions where user_id = $1`, [me.user.id]), undefined);
  } finally {
    setPushAgent(undefined);
    srv.close();
  }
});

test('audit: nama tampilan tamu memakai nama pet, bukan "Tamu"', async () => {
  const c = client();
  await c.post('/api/auth/guest');
  await c.post('/api/pet', { name: 'Gethuk', color: '#F6B7A8', ear: 'tunas' });
  assert.equal((await c.get('/api/me')).body.user.display_name, 'Gethuk');
  const d = client();
  await d.post('/api/auth/guest');
  await d.post('/api/pet', { name: 'Onde', color: '#F6B7A8', ear: 'tunas', ownerName: 'Rina' });
  assert.equal((await d.get('/api/me')).body.user.display_name, 'Rina');
});

test('audit: mode simulasi mengizinkan tamu mencoba beli Mutiara', async () => {
  const { c } = await newPlayer('Simu');
  const co = await c.post('/api/pearls/checkout', { packageId: 'p-kecil' });
  assert.equal(co.status, 200, JSON.stringify(co.body));
});

test('tugas: pemula maju dari aksi nyata, hadiah diambil sekali, harian 3 per hari', async () => {
  const { c } = await newPlayer('Tugas');
  let q = (await c.get('/api/quests')).body;
  assert.equal(q.starter.length, 12);
  assert.equal(q.daily.length, 3);
  assert.equal(q.summary.next.id, 'p-elus');
  // elus 3x (jeda cooldown 2 detik di antaranya)
  for (let i = 0; i < 3; i++) {
    const r = await c.post('/api/action', { type: 'elus' });
    assert.equal(r.status, 200);
    if (i < 2) await new Promise((res) => setTimeout(res, 2100));
  }
  await c.post('/api/action', { type: 'makan', itemId: 'pisang-goreng' });
  q = (await c.get('/api/quests')).body;
  const elus = q.starter.find((x: any) => x.id === 'p-elus');
  assert.equal(elus.progress, 3);
  assert.equal(elus.done, true);
  assert.equal(q.starter.find((x: any) => x.id === 'p-makan').done, true);
  assert.equal(q.summary.ready >= 2, true);
  const before = (await c.get('/api/me')).body.wallet.coin;
  const cl = await c.post('/api/quests/p-elus/claim');
  assert.equal(cl.status, 200, JSON.stringify(cl.body));
  assert.equal(cl.body.wallet.coin, before + 20);
  assert.equal((await c.post('/api/quests/p-elus/claim')).status, 400);
  assert.equal((await c.post('/api/quests/p-lomba/claim')).status, 400);
  // ringkasan ikut di respons aksi
  const act = await c.post('/api/action', { type: 'mandi' });
  assert.ok(act.body.quests.ready >= 2);
});

test('tugas: admin bisa menambah tugas harian baru', async () => {
  const owner = client();
  await owner.post('/api/admin/login', { email: 'owner@test.local', password: 'rahasia-sekali-123' });
  const list = (await owner.get('/api/admin/quests')).body;
  assert.ok(list.quests.length >= 23);
  const r = await owner.post('/api/admin/quests', { id: 'h-jual', kind: 'daily', title: 'Pedagang', description: 'Jual 2 barang.', event: 'sell', filter: {}, target: 2, reward_coin: 20, url: '/#shop' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const bad = await owner.post('/api/admin/quests', { id: 'h-x', kind: 'daily', title: 'X', event: 'tidak-ada', target: 1 });
  assert.equal(bad.status, 400);
});

test('jenis pet: bagian terkunci sesuai level, paket konten v2 tersedia, slot punggung', async () => {
  const { c } = await newPlayer('Gaya');
  const locked = await c.post('/api/pet/look', { ear: 'bunga' });
  assert.equal(locked.status, 400);
  assert.equal(locked.body.error.code, 'locked');
  const ok = await c.post('/api/pet/look', { pattern: 'totol', eyes: 'senyum', ear: 'anjing' });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.pet.pattern, 'totol');
  assert.equal(ok.body.pet.eyes, 'senyum');
  const cat = (await c.get('/api/catalog')).body;
  for (const id of ['blangkon', 'akuarium', 'es-krim', 'ikan-koi', 'wp-bata', 'sayap-kupu']) assert.ok(cat.items.find((i: any) => i.id === id), id);
  const buy = await c.post('/api/shop/buy', { itemId: 'ransel-jalan' });
  assert.equal(buy.status, 200, JSON.stringify(buy.body));
  const wear = await c.post('/api/pet/look', { wear: { back: 'ransel-jalan' } });
  assert.equal(wear.body.pet.wear.back, 'ransel-jalan');
});

test('mini-game Panen Buah: skor dihitung server, terlalu cepat ditolak', async () => {
  const { panenSchedule } = await import('@kb/shared');
  const { c } = await newPlayer('Panen');
  const owner = client();
  await owner.post('/api/admin/login', { email: 'owner@test.local', password: 'rahasia-sekali-123' });
  const st = (await owner.get('/api/admin/settings')).body.value;
  st.games.panen.durationMs = 3000;
  await owner.call('PUT', '/api/admin/settings', { value: st });
  const s1 = await c.post('/api/games/panen/start');
  assert.equal(s1.status, 200, JSON.stringify(s1.body));
  const early = await c.post('/api/games/panen/finish', { runId: s1.body.runId, caught: [0] });
  assert.equal(early.body.error.code, 'invalid_run');
  const s2 = await c.post('/api/games/panen/start');
  const sched = panenSchedule(s2.body.seed, s2.body.durationMs, s2.body.eventDrops);
  const good = sched.map((d: any, i: number) => (d.value > 0 ? i : -1)).filter((i: number) => i >= 0);
  await new Promise((r) => setTimeout(r, 3000));
  const fin = await c.post('/api/games/panen/finish', { runId: s2.body.runId, caught: good });
  assert.equal(fin.status, 200, JSON.stringify(fin.body));
  assert.equal(fin.body.score, sched.filter((d: any) => d.value > 0).reduce((a: number, d: any) => a + d.value, 0));
  assert.ok(fin.body.reward > 0);
  const dup = await c.post('/api/games/panen/start');
  await new Promise((r) => setTimeout(r, 3000));
  assert.equal((await c.post('/api/games/panen/finish', { runId: dup.body.runId, caught: [0, 0] })).body.error.code, 'invalid_run');
});

test('mini-game Ingat Jajanan: langkah diputar ulang di server', async () => {
  const { memoriLayout } = await import('@kb/shared');
  const { c } = await newPlayer('Ingat');
  const s = await c.post('/api/games/memori/start');
  assert.equal(s.status, 200, JSON.stringify(s.body));
  const layout = memoriLayout(s.body.seed);
  // langkah sempurna: pasangkan kartu yang sama
  const flips: [number, number][] = [];
  const seen = new Map<number, number>();
  layout.forEach((v: number, i: number) => { if (seen.has(v)) flips.push([seen.get(v)!, i]); else seen.set(v, i); });
  const bad = await c.post('/api/games/memori/finish', { runId: s.body.runId, flips: flips.slice(0, 3), timeMs: 5000 });
  assert.equal(bad.body.error.code, 'invalid_run');
  const s2 = await c.post('/api/games/memori/start');
  const l2 = memoriLayout(s2.body.seed);
  const f2: [number, number][] = [];
  const seen2 = new Map<number, number>();
  l2.forEach((v: number, i: number) => { if (seen2.has(v)) f2.push([seen2.get(v)!, i]); else seen2.set(v, i); });
  await new Promise((r) => setTimeout(r, 3000));
  const ok = await c.post('/api/games/memori/finish', { runId: s2.body.runId, flips: f2, timeMs: 2900 });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.stars, 3);
  assert.ok(ok.body.reward >= 50);
});

test('event musiman: poin dari aktivitas, hadiah bertingkat, editor admin', async () => {
  const owner = client();
  await owner.post('/api/admin/login', { email: 'owner@test.local', password: 'rahasia-sekali-123' });
  const meta = (await owner.get('/api/admin/events')).body;
  assert.ok(meta.templates.length >= 6);
  const now = Date.now();
  const r = await owner.post('/api/admin/events', {
    id: 'uji-musim', name: 'Musim Uji', description: 'Event uji', starts_at: new Date(now - 60_000).toISOString(), ends_at: new Date(now + 86_400_000).toISOString(),
    theme: { color: '#3F7FBF' }, bonus: { coinMultiplier: 1 }, decor: 'hujan', token_name: 'Tetes', active: true,
    points: { daily_claim: 30, harvest: 5 }, milestones: [{ points: 20, coin: 40 }, { points: 25, item: 'payung-taman' }],
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const badItem = await owner.post('/api/admin/events', { id: 'uji-x', name: 'X', starts_at: new Date().toISOString(), ends_at: new Date(now + 1e6).toISOString(), milestones: [{ points: 5, item: 'tidak-ada' }] });
  assert.equal(badItem.status, 400);
  const { c } = await newPlayer('Event');
  await c.post('/api/daily');
  const ev = (await c.get('/api/events')).body.events.find((e: any) => e.id === 'uji-musim');
  assert.equal(ev.myPoints, 30);
  assert.equal(ev.decor, 'hujan');
  assert.equal(ev.milestones[0].ready, true);
  const before = (await c.get('/api/me')).body.wallet.coin;
  const cl = await c.post('/api/events/uji-musim/claim', { index: 0 });
  assert.equal(cl.status, 200, JSON.stringify(cl.body));
  assert.equal(cl.body.wallet.coin, before + 40);
  assert.equal((await c.post('/api/events/uji-musim/claim', { index: 0 })).status, 400);
  const cl2 = await c.post('/api/events/uji-musim/claim', { index: 1 });
  assert.equal(cl2.body.inventory['payung-taman'], 1);
  const stats = (await owner.get('/api/admin/events')).body.events.find((e: any) => e.id === 'uji-musim');
  assert.equal(stats.participants, 1);
  assert.equal(stats.claims, 2);
});

test('event musiman: diumumkan sekali saat mulai, berulang tiap tahun', async () => {
  const { eventJobs } = await import('../src/lib/events');
  await db.query(`insert into events (id, name, starts_at, ends_at, repeat_yearly) values ('uji-tahunan', 'Tahunan', now() - interval '10 days', now() - interval '1 day', true)`);
  const first = await eventJobs(db);
  assert.ok(first.some((e: any) => e.id === 'uji-musim'));
  const again = await eventJobs(db);
  assert.ok(!again.some((e: any) => e.id === 'uji-musim'));
  const ev = await db.one(`select starts_at, ends_at from events where id = 'uji-tahunan'`);
  assert.ok(new Date(ev.ends_at).getTime() > Date.now() + 300 * 86_400_000);
});
