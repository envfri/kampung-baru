// Pusat notifikasi + WhatsApp lewat Klik Flow API v2, diuji terhadap server Klik Flow tiruan
// (bentuk permintaan & error sesuai https://klikflow.id/docs/api).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { createHmac, randomUUID } from 'node:crypto';
import { config } from '../src/config';

const KEY = 'kf_test_kampung';
const TEST_NUMBERS = ['6281200000001', '6281200000002', '6281200000003', '6281200000004'];
const sent: any[] = [];
const idem = new Map<string, any>();
const kfm = { failNext: '' as string };
let server: Server;

function startMock() {
  server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const send = (s: number, b: any) => { res.writeHead(s, { 'content-type': 'application/json', 'klikflow-mode': 'test' }); res.end(JSON.stringify(b)); };
      const err = (s: number, code: string) => send(s, { error: { type: 'x', code, message: code, request_id: 'req_x' } });
      if (req.headers.authorization !== `Bearer ${KEY}`) return err(401, 'key_invalid');
      const url = req.url!;
      if (req.method === 'GET' && url === '/api/v2/me') return send(200, { data: { object: 'api_key', name: 'Game', prefix: 'kf_test_kam', mode: 'test', scopes: [{ scope: 'messages:send', usable: true }], channels: [] } });
      if (req.method === 'GET' && url === '/api/v2/channels') return send(200, { data: [{ id: 'wa:12', channel: 'whatsapp_qr', name: 'CS Kampung', connected: true, from: 12 }], next_cursor: null });
      if (req.method === 'GET' && url === '/api/v2/templates') return send(200, { data: [{ name: 'mutiara_masuk', language: 'id', category: 'UTILITY', status: 'APPROVED', body: 'Halo {{nama}}, +{{jumlah}} Mutiara masuk.', sendable: true, variables: [{ field: 'variables', name: 'nama' }, { field: 'variables', name: 'jumlah' }] }], next_cursor: null });
      if (req.method === 'GET' && url === '/api/v2/webhooks') return send(200, { data: [] });
      if (req.method === 'POST' && url === '/api/v2/webhooks') return err(403, 'live_key_required');
      if (req.method === 'POST' && url === '/api/v2/messages') {
        const k = req.headers['idempotency-key'] as string;
        if (k && idem.has(k)) return send(200, idem.get(k));
        const b = JSON.parse(raw);
        if (!['whatsapp_qr', 'whatsapp_official'].includes(b.channel) || !b.to || !b.type) return err(422, 'invalid_request');
        if (kfm.failNext) { const c = kfm.failNext; kfm.failNext = ''; return err(c === 'channel_paused' ? 403 : 502, c); }
        if (!TEST_NUMBERS.includes(b.to)) return err(403, 'test_number_required');
        if (b.type === 'text' && !b.text?.body) return err(422, 'invalid_request');
        if ((b.type === 'template' || b.type === 'otp') && b.channel !== 'whatsapp_official') return err(422, 'template_not_supported');
        if (b.type === 'template' && !b.template?.name) return err(422, 'invalid_request');
        if (b.type === 'otp' && !(b.otp?.template && b.otp?.code)) return err(422, 'otp_code_invalid');
        sent.push(b);
        const out = { data: { id: 99000 + sent.length, object: 'message', channel: b.channel, to: b.to, type: b.type, status: 'sent', test: true } };
        if (k) idem.set(k, out);
        return send(200, out);
      }
      err(404, 'not_found');
    });
  });
  return new Promise<number>((ok) => server.listen(0, '127.0.0.1', () => ok((server.address() as any).port)));
}

config.adminEmail = 'owner@test.local';
config.adminPassword = 'rahasia-sekali-123';
config.paymentProvider = 'mock';
config.publicUrl = 'https://game.test';
config.klikflowKey = KEY;
config.klikflowWebhookSecret = 'whsec_uji_kampung';
config.mailketingToken = '';

const { buildApp } = await import('../src/app');
const { runJobs } = await import('../src/lib/worker');
const { markPaid } = await import('../src/lib/payments');
const { notifyEvent } = await import('../src/lib/notify');
const { migrateNotifySettings } = await import('../src/lib/notify-config');
let app: any;
let db: any;

before(async () => {
  config.klikflowBaseUrl = `http://127.0.0.1:${await startMock()}`;
  ({ app, db } = await buildApp({ memoryDb: true, logger: false, rateLimit: false, worker: false }));
});
after(async () => { await app?.close(); server?.close(); });

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
    let b: any = res.body;
    try { b = JSON.parse(res.body); } catch { /* bukan JSON */ }
    return { status: res.statusCode, body: b };
  };
  return { call, get: (u: string) => call('GET', u), post: (u: string, b?: unknown) => call('POST', u, b ?? {}), put: (u: string, b?: unknown) => call('PUT', u, b ?? {}) };
}

async function player(pet = 'Kopi', guest = false) {
  const c = client();
  await c.post('/api/auth/guest');
  assert.equal((await c.post('/api/pet', { name: pet, color: '#F6B7A8', ear: 'tunas' })).status, 200);
  if (!guest) {
    // akun disimpan lewat email (mode pengembangan: kode ada di respons)
    const mail = `${pet.toLowerCase()}-${randomUUID().slice(0, 6)}@contoh.id`;
    const st = await c.post('/api/auth/email/start', { email: mail });
    assert.equal((await c.post('/api/auth/email/verify', { email: mail, code: st.body.devCode })).status, 200);
  }
  const id = (await c.get('/api/me')).body.user.id as string;
  return { c, id };
}

/** Sambungkan nomor lewat kode yang dikirim ke WhatsApp (diambil dari pesan tiruan). */
async function linkWa(c: any, phone: string) {
  const n = sent.length;
  const st = await c.post('/api/wa/start', { phone });
  assert.equal(st.status, 200, JSON.stringify(st.body));
  const msg = sent.slice(n).at(-1);
  const code = msg.type === 'otp' ? msg.otp.code : /\*(\d{6})\*/.exec(msg.text.body)![1];
  const v = await c.post('/api/wa/verify', { code });
  assert.equal(v.status, 200, JSON.stringify(v.body));
  return msg;
}

async function owner() {
  const o = client();
  assert.equal((await o.post('/api/admin/login', { email: 'owner@test.local', password: 'rahasia-sekali-123' })).status, 200);
  return o;
}

async function waitSent(n: number, ms = 3000) {
  const end = Date.now() + ms;
  while (sent.length < n && Date.now() < end) await new Promise((r) => setTimeout(r, 20));
  return sent.length >= n;
}

function hook(event: any, secret = 'whsec_uji_kampung', t = Math.floor(Date.now() / 1000)) {
  const raw = JSON.stringify(event);
  const v1 = createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  return app.inject({ method: 'POST', url: '/api/wa/klikflow/webhook', payload: raw, headers: { 'content-type': 'application/json', 'klikflow-signature': `t=${t},v1=${v1}`, 'klikflow-event': event.type, 'klikflow-event-id': event.id } });
}

async function payFor(userId: string) {
  const p = await db.one(`insert into payments (user_id, package_id, pearls, amount_idr, provider) values ($1,'p-kecil',10,15000,'mock') returning id`, [userId]);
  await markPaid(db, p.id, { test: true });
  return p.id as string;
}

const noQuiet = { whatsapp: { quietStart: 0, quietEnd: 0, maxPerDay: 5, channel: 'whatsapp_qr' } };

/* ---------------- tes ---------------- */

test('pusat notifikasi: matikan jenis, ubah teks & saluran, reset, kunci login tetap menyala', async () => {
  const o = await owner();
  const list = (await o.get('/api/admin/notify')).body;
  assert.ok(list.events.length >= 15);
  assert.equal(list.providers.whatsapp, true);
  assert.equal(list.templates.payment_paid.channels.whatsapp, true);

  const { c, id } = await player('Bolu');
  // matikan "Kebun siap dipanen": tidak ada notifikasi sama sekali
  assert.equal((await o.put('/api/admin/notify/templates/garden_ready', { enabled: false })).status, 200);
  await notifyEvent(db, id, 'garden_ready', { tanaman: 'Tomat', jumlah: 1 });
  assert.equal((await c.get('/api/notifications')).body.items.length, 0);

  // ubah teks hadiah
  const put = await o.put('/api/admin/notify/templates/gift', { title: 'Hadiah dari {teman}!', body: '{pet} dapat kiriman{pesan}.' });
  assert.equal(put.status, 200, JSON.stringify(put.body));
  assert.deepEqual(put.body.override, { title: 'Hadiah dari {teman}!', body: '{pet} dapat kiriman{pesan}.' });
  await notifyEvent(db, id, 'gift', { teman: 'Sari', pesan: ': “Halo”' });
  let items = (await c.get('/api/notifications')).body.items;
  assert.equal(items[0].title, 'Hadiah dari Sari!');
  assert.equal(items[0].body, 'Bolu dapat kiriman: “Halo”.');

  // matikan kotak masuk untuk hadiah
  await o.put('/api/admin/notify/templates/gift', { channels: { inbox: false } });
  await notifyEvent(db, id, 'gift', { teman: 'Budi', pesan: '' });
  assert.equal((await c.get('/api/notifications')).body.items.length, 1);

  // pratinjau isi editor yang belum disimpan
  const pv = await o.post('/api/admin/notify/preview/gift', { draft: { title: 'Kado untuk {pet}', wa: '🎁 {teman} kirim hadiah' } });
  assert.equal(pv.body.title, 'Kado untuk Mochi');
  assert.equal(pv.body.waText, '🎁 Budi kirim hadiah');
  assert.ok(pv.body.emailHtml.includes('Kado untuk Mochi'));

  // kembali ke bawaan
  assert.equal((await o.call('DELETE', '/api/admin/notify/templates/gift')).status, 200);
  await notifyEvent(db, id, 'gift', { teman: 'Rina', pesan: '' });
  items = (await c.get('/api/notifications')).body.items;
  assert.equal(items[0].title, 'Kamu dapat hadiah');
  assert.equal(items[0].body, 'Rina mengirim hadiah. Buka di menu Teman.');

  // kode masuk & verifikasi WhatsApp tidak bisa dimatikan, teksnya bisa diubah
  const lk = await o.put('/api/admin/notify/templates/login_code', { enabled: false, title: 'Kodemu: {kode}' });
  assert.equal(lk.body.template.enabled, true);
  assert.equal(lk.body.template.title, 'Kodemu: {kode}');
  // saluran di luar yang diizinkan tidak bisa dinyalakan
  const pt = await o.put('/api/admin/notify/templates/push_test', { channels: { whatsapp: true } });
  assert.equal(pt.body.template.channels.whatsapp, false);

  // moderator hanya boleh melihat
  assert.equal((await o.post('/api/admin/admins', { email: 'mod2@test.local', password: 'moderator-123', role: 'moderator' })).status, 200);
  const m = client();
  await m.post('/api/admin/login', { email: 'mod2@test.local', password: 'moderator-123' });
  assert.equal((await m.get('/api/admin/notify')).status, 200);
  assert.equal((await m.put('/api/admin/notify/templates/gift', { enabled: false })).status, 403);
  await o.call('DELETE', '/api/admin/notify/templates/garden_ready');
});

test('pusat notifikasi: saklar lama di Ekonomi & fitur dipindah otomatis', async () => {
  await db.query(
    `insert into settings (key, value) values ('game', $1::text::jsonb) on conflict (key) do update set value = excluded.value`,
    [JSON.stringify({ notify: { needsLow: false, needsThreshold: 30, giftsAndFriends: false }, email: { enabled: true, social: true, maxPerDay: 4 } })],
  );
  await migrateNotifySettings(db);
  const o = await owner();
  const t = (await o.get('/api/admin/notify')).body;
  assert.equal(t.templates.needs_kenyang.enabled, false);
  assert.equal(t.templates.gift.enabled, false);
  assert.equal(t.templates.visit.channels.email, true);
  assert.equal(t.channels.email.maxPerDay, 4);
  const g = (await db.one(`select value from settings where key = 'game'`)).value;
  assert.deepEqual(g, { notify: { needsThreshold: 30 } });
  for (const k of ['needs_kenyang', 'needs_bersih', 'needs_ceria', 'needs_energi', 'gift', 'friend_added', 'visit']) await o.call('DELETE', `/api/admin/notify/templates/${k}`);
});

test('whatsapp: sambungkan nomor dengan kode, bukti pembelian ke WhatsApp, kunci tes hanya nomor uji', async () => {
  const o = await owner();
  assert.equal((await o.put('/api/admin/notify/channels', noQuiet)).status, 200);
  assert.equal((await client().get('/api/config')).body.whatsapp, true);
  const { c, id } = await player('Kopi');

  assert.equal((await c.post('/api/wa/start', { phone: '12345' })).body.error.code, 'invalid_phone');
  const notTest = await c.post('/api/wa/start', { phone: '0812 9999 9999' });
  assert.equal(notTest.body.error.code, 'wa_failed');
  assert.match(notTest.body.error.message, /nomor uji/);

  const n = sent.length;
  assert.equal((await c.post('/api/wa/start', { phone: '0812-0000-0001' })).status, 200);
  const msg = sent[n];
  assert.equal(msg.channel, 'whatsapp_qr');
  assert.equal(msg.type, 'text');
  assert.equal(msg.to, '6281200000001');
  assert.equal((await c.post('/api/wa/verify', { code: '000000' })).body.error.code, 'otp_wrong');
  const code = /\*(\d{6})\*/.exec(msg.text.body)![1];
  const v = await c.post('/api/wa/verify', { code });
  assert.equal(v.status, 200);
  assert.equal(v.body.wa.verified, true);
  assert.equal((await c.get('/api/me')).body.user.wa.phone, '62812•••••001');
  // kode tidak tersimpan di antrean
  const row = await db.one(`select body, status from outbox where kind = 'wa_verify' and user_id = $1 order by id desc limit 1`, [id]);
  assert.equal(row.body, null);

  // nomor yang sudah dipakai akun lain ditolak
  const other = await player('Lain');
  const n2 = sent.length;
  await other.c.post('/api/wa/start', { phone: '081200000001' });
  assert.equal(sent.length, n2, 'kode tidak dikirim ke nomor milik akun lain');

  // pembayaran → WhatsApp
  const k = sent.length;
  await payFor(id);
  assert.ok(await waitSent(k + 1));
  const paid = sent[k];
  assert.equal(paid.to, '6281200000001');
  assert.match(paid.text.body, /\+10 Mutiara \(Rp15\.000\) sudah ada di dompet Kopi/);

  // pemain mematikan WhatsApp
  await c.post('/api/notify/prefs', { prefs: { whatsapp: false } });
  const k2 = sent.length;
  await payFor(id);
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(sent.length, k2);
  await c.post('/api/notify/prefs', { prefs: { whatsapp: true } });

  // batas harian (bukan penting): "Ada tamu" lewat WhatsApp, maks 1 per hari
  await o.put('/api/admin/notify/templates/visit', { channels: { whatsapp: true } });
  await o.put('/api/admin/notify/channels', { whatsapp: { maxPerDay: 1 } });
  const k3 = sent.length;
  await notifyEvent(db, id, 'visit', { teman: 'Sari' });
  await notifyEvent(db, id, 'visit', { teman: 'Budi' });
  await waitSent(k3 + 1);
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(sent.slice(k3).filter((m) => /mampir/.test(m.text?.body ?? '')).length, 1);
  await o.call('DELETE', '/api/admin/notify/templates/visit');
});

test('whatsapp official: template & variabel, OTP verifikasi, jam tenang, nomor dijeda', async () => {
  const o = await owner();
  const hourWib = Math.floor(((Date.now() + 7 * 3_600_000) % 86_400_000) / 3_600_000);
  assert.equal((await o.put('/api/admin/notify/channels', { whatsapp: { channel: 'whatsapp_official', verifyTemplate: 'kode_login', quietStart: hourWib, quietEnd: (hourWib + 1) % 24, maxPerDay: 5 } })).status, 200);
  const { c, id } = await player('Ubi');
  const otp = await linkWa(c, '081200000002');
  assert.deepEqual({ type: otp.type, template: otp.otp.template }, { type: 'otp', template: 'kode_login' });

  // tanpa template Official, notifikasi tidak bisa dikirim & tercatat gagal
  const k = sent.length;
  await payFor(id);
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(sent.length, k);
  const fail = await db.one(`select status, error from outbox where channel = 'whatsapp' and user_id = $1 and kind = 'payment_paid' order by id desc limit 1`, [id]);
  assert.equal(fail.status, 'failed');
  assert.match(fail.error, /Template WhatsApp Official belum dipilih/);

  // pilih template & isi variabelnya
  await o.put('/api/admin/notify/templates/payment_paid', { waTemplate: 'mutiara_masuk', waLanguage: 'id', waVars: { nama: '{nama}', jumlah: '{mutiara}' } });
  await payFor(id);
  assert.ok(await waitSent(k + 1));
  assert.deepEqual(sent[k].template, { name: 'mutiara_masuk', language: 'id', variables: { nama: 'Ubi', jumlah: '10' } });

  // jam tenang: notifikasi biasa ditunda, pembayaran (penting) tetap langsung
  await o.put('/api/admin/notify/templates/visit', { channels: { whatsapp: true }, waTemplate: 'mutiara_masuk', waVars: { '1': '{teman}' } });
  await notifyEvent(db, id, 'visit', { teman: 'Sari' });
  const q = await db.one(`select status, next_at, body from outbox where channel = 'whatsapp' and user_id = $1 and kind = 'visit' order by id desc limit 1`, [id]);
  assert.equal(q.status, 'queued');
  assert.ok(new Date(q.next_at).getTime() > Date.now());
  assert.deepEqual(JSON.parse(q.body).template.variables, ['Sari']);

  // nomor dijeda di Klik Flow: pesan tetap di antrean untuk dicoba lagi
  await o.put('/api/admin/notify/channels', { whatsapp: { quietStart: 0, quietEnd: 0 } });
  kfm.failNext = 'channel_paused';
  await notifyEvent(db, id, 'visit', { teman: 'Budi' });
  await new Promise((r) => setTimeout(r, 150));
  const paused = await db.one(`select status, error from outbox where channel = 'whatsapp' and user_id = $1 and kind = 'visit' order by id desc limit 1`, [id]);
  assert.equal(paused.status, 'queued');
  assert.match(paused.error, /channel_paused/);
  await o.call('DELETE', '/api/admin/notify/templates/visit');
  await o.call('DELETE', '/api/admin/notify/templates/payment_paid');
  await o.put('/api/admin/notify/channels', noQuiet);
});

test('whatsapp webhook: tanda tangan, STOP/MULAI dari pemain, status gagal, event ganda', async () => {
  const o = await owner();
  await o.put('/api/admin/notify/channels', noQuiet);
  const { c, id } = await player('Teh');
  await linkWa(c, '081200000003');

  const stop = { id: 'evt_' + randomUUID().replace(/-/g, ''), type: 'message.received', created: new Date().toISOString(), business_id: 7, data: { channel: 'whatsapp_qr', from: '6281200000003', type: 'text', text: 'Stop' } };
  assert.equal((await hook(stop, 'whsec_salah')).statusCode, 400);
  assert.equal((await hook(stop, undefined, Math.floor(Date.now() / 1000) - 400)).statusCode, 400);
  const n = sent.length;
  assert.equal((await hook(stop)).statusCode, 200);
  assert.equal((await c.get('/api/me')).body.notifyPrefs.whatsapp, false);
  assert.ok(await waitSent(n + 1));
  assert.match(sent[n].text.body, /dimatikan/);
  // event yang sama dikirim ulang: diabaikan
  assert.equal(JSON.parse((await hook(stop)).body).duplicate, true);

  const start = { ...stop, id: 'evt_' + randomUUID().replace(/-/g, ''), data: { ...stop.data, text: 'MULAI' } };
  await hook(start);
  assert.equal((await c.get('/api/me')).body.notifyPrefs.whatsapp, true);

  // status gagal dari Klik Flow
  const k = sent.length;
  await payFor(id);
  await waitSent(k + 1);
  const row = await db.one(`select message_id from outbox where channel = 'whatsapp' and user_id = $1 and kind = 'payment_paid' and status = 'sent' order by id desc limit 1`, [id]);
  await hook({ id: 'evt_' + randomUUID().replace(/-/g, ''), type: 'message.status', created: new Date().toISOString(), data: { message_id: Number(row.message_id), status: 'failed', error: 'Nomor tidak aktif' } });
  const after = await db.one(`select status, delivery, error from outbox where message_id = $1`, [row.message_id]);
  assert.deepEqual(after, { status: 'failed', delivery: 'failed', error: 'Nomor tidak aktif' });
});

test('whatsapp: broadcast admin, halaman admin WhatsApp, kirim uji template', async () => {
  const o = await owner();
  await o.put('/api/admin/notify/channels', noQuiet);
  const stats = (await o.get('/api/admin/broadcasts')).body.stats;
  assert.equal(stats.waEnabled, true);
  assert.ok(stats.waUsers >= 2);
  const r = await o.post('/api/admin/broadcasts', { title: 'Pekan Ceria', body: 'Koin +20% sampai Minggu.', url: '/', segment: 'all', whatsapp: true });
  assert.equal(r.status, 200);
  await runJobs(db);
  const end = Date.now() + 3000;
  let b: any;
  while (Date.now() < end) {
    b = await db.one(`select status, whatsapped from broadcasts where id = $1`, [r.body.id]);
    const left = await db.one(`select count(*)::int c from outbox where channel = 'whatsapp' and kind = 'broadcast' and status in ('queued','sending')`);
    if (b.status === 'sent' && !left.c) break;
    await new Promise((x) => setTimeout(x, 25));
  }
  assert.ok(b.whatsapped >= 2);
  const got = sent.filter((m) => /\*Pekan Ceria\*/.test(m.text?.body ?? ''));
  assert.equal(got.length, b.whatsapped);
  assert.ok(got.every((m) => m.text.body.includes('https://game.test/')));

  const wa = (await o.get('/api/admin/whatsapp')).body;
  assert.equal(wa.mode, 'test');
  assert.equal(wa.key.name, 'Game');
  assert.equal(wa.channels[0].from, 12);
  assert.equal(wa.templates[0].name, 'mutiara_masuk');
  assert.ok(wa.stats.verified >= 2);
  assert.ok(wa.recent.every((x: any) => !/^62\d{9,}$/.test(x.to_addr)), 'nomor disamarkan');
  const reg = await o.post('/api/admin/whatsapp/webhook');
  assert.equal(reg.body.error.code, 'wa_live');

  const n = sent.length;
  const t = await o.post('/api/admin/notify/test/event_start', { channel: 'whatsapp', to: '081200000001', draft: { wa: 'Uji {event}: {deskripsi}' } });
  assert.equal(t.status, 200, JSON.stringify(t.body));
  assert.equal(sent[n].text.body, 'Uji Pekan Panen Raya: Kumpulkan poin panen dan ambil caping emas edisi terbatas.');
  assert.equal((await o.post('/api/admin/notify/test/event_start', { channel: 'whatsapp', to: '081299999999' })).body.error.code, 'send_failed');
});

test('whatsapp: tamu ditolak, batas kode per nomor, pesan antre dibatalkan setelah STOP, tanda tangan aneh tidak bikin error', async () => {
  const o = await owner();
  await o.put('/api/admin/notify/channels', noQuiet);
  const guest = await player('Tamu', true);
  assert.equal((await guest.c.post('/api/wa/start', { phone: '081200000002' })).body.error.code, 'guest');

  // nomor yang sama hanya 3 kode per 24 jam, dari akun mana pun
  for (let i = 0; i < 3; i++) {
    const x = await player('Coba' + i);
    assert.equal((await x.c.post('/api/wa/start', { phone: '081200000004' })).status, 200);
  }
  const extra = await player('Lebih');
  assert.equal((await extra.c.post('/api/wa/start', { phone: '081200000004' })).body.error.code, 'otp_limit');

  // pesan biasa ditunda jam tenang, lalu pemain membalas STOP: saat dikirim, pesan dibatalkan
  const { c, id } = await player('Stop');
  const phone = '081200000001';
  await db.query(`update users set wa_phone = null, wa_verified_at = null where wa_phone = '6281200000001'`);
  await db.query(`delete from outbox where to_addr = '6281200000001' and kind = 'wa_verify'`);
  await linkWa(c, phone);
  await o.put('/api/admin/notify/templates/visit', { channels: { whatsapp: true } });
  const hourWib = Math.floor(((Date.now() + 7 * 3_600_000) % 86_400_000) / 3_600_000);
  await o.put('/api/admin/notify/channels', { whatsapp: { quietStart: hourWib, quietEnd: (hourWib + 1) % 24 } });
  await notifyEvent(db, id, 'visit', { teman: 'Sari' });
  const row = await db.one(`select id from outbox where channel = 'whatsapp' and user_id = $1 and kind = 'visit' order by id desc limit 1`, [id]);
  await o.put('/api/admin/notify/channels', noQuiet);
  await c.post('/api/notify/prefs', { prefs: { whatsapp: false } });
  await db.query(`update outbox set next_at = now() where id = $1`, [row.id]);
  const n = sent.length;
  const { deliver } = await import('../src/lib/outbox');
  await deliver(db);
  assert.equal(sent.length, n);
  const after = await db.one(`select status, error from outbox where id = $1`, [row.id]);
  assert.equal(after.status, 'failed');
  assert.match(after.error, /mematikan WhatsApp/);
  await o.call('DELETE', '/api/admin/notify/templates/visit');

  // tanda tangan dengan karakter non-ASCII: ditolak, bukan error server
  const t = Math.floor(Date.now() / 1000);
  const r = await app.inject({ method: 'POST', url: '/api/wa/klikflow/webhook', payload: '{"id":"evt_x","type":"message.status","data":{}}', headers: { 'content-type': 'application/json', 'klikflow-signature': `t=${t},v1=${'é'.repeat(64)}` } });
  assert.equal(r.statusCode, 400);
  const u = await app.inject({ method: 'GET', url: `/api/email/unsubscribe?u=${id}&t=${'a'.repeat(31)}%C3%A9` });
  assert.equal(u.statusCode, 400);
  assert.equal((await o.post('/api/admin/whatsapp/unlink/bukan-uuid')).status, 400);
});
