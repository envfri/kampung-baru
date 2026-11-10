// Email lewat Mailketing API v2, diuji terhadap server Mailketing tiruan
// (format sesuai https://mailketing.co.id/docs/send-email-via-api/).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { config } from '../src/config';

const TOKEN = 'mk_token_uji';
const inbox: { to: string; subject: string; html: string; from: string; fromName: string }[] = [];
const mk = { failNext: 0 as number, credits: 1234 };
let server: Server;

function startMock() {
  server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const send = (s: number, b: any) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
      if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(401, { success: false, data: null, message: 'Invalid API token' });
      if (req.method === 'GET' && req.url === '/api/v2/credits') return send(200, { success: true, data: { credits: mk.credits, email: 'akun@contoh.id' }, message: 'OK' });
      if (req.method === 'POST' && req.url === '/api/v2/send') {
        const b = JSON.parse(raw);
        for (const k of ['from_name', 'from_email', 'subject', 'recipient', 'content']) if (!b[k]) return send(422, { success: false, data: null, message: 'Validation failed', errors: { [k]: `${k} is required` } });
        if (mk.failNext) { const s = mk.failNext; mk.failNext = 0; return send(s, { success: false, data: null, message: s === 402 ? 'Insufficient credits' : 'Server error' }); }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.recipient)) return send(422, { success: false, data: null, message: 'Validation failed', errors: { recipient: 'Recipient must be a valid email' } });
        inbox.push({ to: b.recipient, subject: b.subject, html: b.content, from: b.from_email, fromName: b.from_name });
        return send(200, { success: true, data: { message_id: `<m${inbox.length}@mailketing.co.id>` }, message: 'Email queued successfully' });
      }
      send(404, { success: false, message: 'Not found' });
    });
  });
  return new Promise<number>((ok) => server.listen(0, '127.0.0.1', () => ok((server.address() as any).port)));
}

config.adminEmail = 'owner@test.local';
config.adminPassword = 'rahasia-sekali-123';
config.paymentProvider = 'mock';
config.publicUrl = 'https://game.test';
config.mailketingToken = TOKEN;
config.mailFrom = 'BUPI <noreply@bupi.id>';

const { buildApp } = await import('../src/app');
const { runJobs } = await import('../src/lib/worker');
const { deliver } = await import('../src/lib/outbox');
let app: any;
let db: any;

before(async () => {
  config.mailketingBaseUrl = `http://127.0.0.1:${await startMock()}`;
  ({ app, db } = await buildApp({ memoryDb: true, logger: false, rateLimit: false, worker: false }));
});
after(async () => { await app?.close(); server?.close(); });

function client() {
  let cookie = '';
  const call = async (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await app.inject({ method, url, payload: body as any, headers: { ...(cookie ? { cookie } : {}), ...headers } });
    const set = res.headers['set-cookie'];
    if (set) {
      const jar = new Map(cookie ? cookie.split('; ').map((c: string) => c.split('=') as [string, string]) : []);
      for (const c of Array.isArray(set) ? set : [set]) { const [kv] = c.split(';'); const [k, v] = kv.split('='); if (v) jar.set(k, v); else jar.delete(k); }
      cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    }
    let b: any = res.body;
    try { b = JSON.parse(res.body); } catch { /* HTML */ }
    return { status: res.statusCode, body: b };
  };
  return { call, get: (u: string) => call('GET', u), post: (u: string, b?: unknown) => call('POST', u, b ?? {}) };
}

/** Pemain dengan akun email tertaut. OTP dikirim lewat Mailketing tiruan, kodenya diambil dari email. */
async function player(addr: string) {
  const c = client();
  await c.post('/api/auth/guest');
  assert.equal((await c.post('/api/pet', { name: 'Kopi', color: '#F6B7A8', ear: 'tunas' })).status, 200);
  const n = inbox.length;
  const st = await c.post('/api/auth/email/start', { email: addr });
  assert.equal(st.body.sent, true);
  const mail = inbox.slice(n).find((m) => m.to === addr)!;
  const code = /(\d{6})/.exec(mail.subject)![1];
  assert.equal((await c.post('/api/auth/email/verify', { email: addr, code })).status, 200);
  const me = (await c.get('/api/me')).body;
  return { c, id: me.user.id as string };
}

async function owner() {
  const o = client();
  assert.equal((await o.post('/api/admin/login', { email: 'owner@test.local', password: 'rahasia-sekali-123' })).status, 200);
  return o;
}

/** Tunggu sampai antrean email kosong (pengiriman berjalan di latar). */
async function drain(ms = 4000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const r = await db.one(`select count(*)::int c from outbox where channel = 'email' and (status = 'sending' or (status = 'queued' and next_at <= now()))`);
    if (!r.c) return true;
    await new Promise((x) => setTimeout(x, 25));
  }
  return false;
}

async function waitFor(fn: () => boolean, ms = 3000) {
  const end = Date.now() + ms;
  while (!fn() && Date.now() < end) await new Promise((r) => setTimeout(r, 20));
  return fn();
}

test('email: kode masuk dikirim lewat Mailketing; isi tidak disimpan; gagal kirim boleh minta ulang', async () => {
  assert.equal((await client().get('/api/config')).body.email, true);
  const n = inbox.length;
  const c = client();
  await c.post('/api/auth/guest');
  const st = await c.post('/api/auth/email/start', { email: 'otp@contoh.id' });
  assert.equal(st.status, 200);
  assert.equal(st.body.sent, true);
  const m = inbox[n];
  assert.equal(m.to, 'otp@contoh.id');
  assert.equal(m.from, 'noreply@bupi.id');
  assert.equal(m.fromName, 'BUPI');
  assert.ok(m.html.includes(st.body.devCode));
  const row = await db.one(`select status, body, message_id from outbox where kind = 'login_code' and to_addr = 'otp@contoh.id'`);
  assert.equal(row.status, 'sent');
  assert.equal(row.body, null);
  assert.match(row.message_id, /mailketing/);

  mk.failNext = 500;
  const bad = await client().post('/api/auth/email/start', { email: 'gagal@contoh.id' });
  assert.equal(bad.body.sent, false);
  // tidak perlu menunggu 1 menit untuk mencoba lagi
  const again = await client().post('/api/auth/email/start', { email: 'gagal@contoh.id' });
  assert.equal(again.body.sent, true);
});

test('email: notifikasi sistem ikut ke email, isi di-escape, berhenti langganan menghentikannya', async () => {
  const { c, id } = await player('pemain1@contoh.id');
  const o = await owner();
  const n = inbox.length;
  assert.equal((await o.post(`/api/admin/players/${id}/notify`, { title: 'Hadiah <b>spesial</b>', body: 'Cek tasmu & ambil hadiahnya.' })).status, 200);
  assert.ok(await waitFor(() => inbox.length > n), 'email notifikasi terkirim');
  const m = inbox[inbox.length - 1];
  assert.equal(m.to, 'pemain1@contoh.id');
  assert.equal(m.subject, 'Hadiah <b>spesial</b>');
  assert.ok(m.html.includes('Hadiah &lt;b&gt;spesial&lt;/b&gt;'));
  assert.ok(!m.html.includes('%%UNSUB%%'));
  const link = /href="(https:\/\/game\.test\/api\/email\/unsubscribe\?[^"]+)"/.exec(m.html)![1].replace(/&amp;/g, '&');
  const path = link.replace('https://game.test', '');

  // GET hanya konfirmasi; token salah ditolak
  assert.equal((await client().get(path)).status, 200);
  assert.equal((await client().get(path.replace(/t=[^&]+/, 't=salah'))).status, 400);
  assert.equal((await c.get('/api/me')).body.notifyPrefs.email, undefined);
  const q = new URL(link).searchParams;
  const un = await app.inject({ method: 'POST', url: '/api/email/unsubscribe', payload: `u=${q.get('u')}&t=${q.get('t')}`, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  assert.equal(un.statusCode, 200);
  assert.equal((await c.get('/api/me')).body.notifyPrefs.email, false);

  const k = inbox.length;
  await o.post(`/api/admin/players/${id}/notify`, { title: 'Tes lagi', body: 'Seharusnya tidak ke email.' });
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(inbox.length, k);
  // dinyalakan lagi dari pengaturan game
  assert.equal((await c.post('/api/notify/prefs', { prefs: { email: true } })).body.prefs.email, true);
});

test('email: jenis notifikasi diatur admin, batas harian per pemain', async () => {
  const { id } = await player('pemain2@contoh.id');
  const o = await owner();
  const { notifyEvent } = await import('../src/lib/notify');
  const n = inbox.length;
  await notifyEvent(db, id, 'visit', { teman: 'Tamu' });
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(inbox.length, n, 'sosial mati secara bawaan');

  // admin: nyalakan email untuk "Ada tamu", ubah judulnya, batas 2 email per hari
  const put = await o.call('PUT', '/api/admin/notify/templates/visit', { channels: { email: true }, title: 'Tamu {teman} datang' });
  assert.equal(put.status, 200, JSON.stringify(put.body));
  assert.equal((await o.call('PUT', '/api/admin/notify/channels', { email: { maxPerDay: 2 } })).status, 200);
  for (let i = 0; i < 3; i++) await notifyEvent(db, id, 'visit', { teman: `Tamu${i}` });
  await waitFor(() => inbox.length >= n + 2);
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(inbox.filter((m) => m.to === 'pemain2@contoh.id' && /^Tamu Tamu\d datang$/.test(m.subject)).length, 2);
});

test('email: broadcast admin dengan email dikirim worker, tamu tanpa email dilewati', async () => {
  await player('pemain3@contoh.id');
  const guest = client();
  await guest.post('/api/auth/guest');
  const o = await owner();
  const info = (await o.get('/api/admin/broadcasts')).body.stats;
  assert.equal(info.emailEnabled, true);
  assert.ok(info.emailUsers >= 1);
  const r = await o.post('/api/admin/broadcasts', { title: 'Event Panen Raya', body: 'Mulai hari ini!', url: '/', segment: 'all', email: true });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  await runJobs(db);
  assert.ok(await drain());
  const b = await db.one(`select status, email, emailed from broadcasts where id = $1`, [r.body.id]);
  assert.equal(b.status, 'sent');
  assert.equal(b.email, true);
  const got = inbox.filter((m) => m.subject === 'Event Panen Raya').map((m) => m.to);
  assert.ok(got.includes('pemain3@contoh.id'));
  assert.equal(b.emailed, got.length);
  assert.equal(new Set(got).size, got.length, 'satu email per pemain');
  const queued = await db.one(`select count(*)::int c from outbox where channel = 'email' and status in ('queued','sending')`);
  assert.equal(queued.c, 0);
});

test('email: webhook bounce menandai alamat, admin bisa melepasnya; kredit habis menunda antrean', async () => {
  const { id } = await player('mantul@contoh.id');
  const o = await owner();
  const panel = (await o.get('/api/admin/email')).body;
  assert.equal(panel.enabled, true);
  assert.equal(panel.credits, 1234);
  assert.equal(panel.from.email, 'noreply@bupi.id');
  const hook = panel.webhookUrl.replace('https://game.test', '');
  assert.match(hook, /^\/api\/email\/mailketing\/[\w-]{32}$/);

  assert.equal((await client().post('/api/email/mailketing/kunci-salah', { type: 'bounce', email: 'mantul@contoh.id' })).status, 404);
  assert.equal((await client().post(hook, { type: 'bounce', email: 'Mantul@Contoh.id', reason: 'User Unknown', date: '2026-11-10 10:00:00', message_id: 'x' })).status, 200);
  assert.equal((await o.get('/api/admin/email')).body.suppressions[0].email, 'mantul@contoh.id');
  const n = inbox.length;
  await o.post(`/api/admin/players/${id}/notify`, { title: 'Untuk alamat mantul', body: 'Tidak dikirim.' });
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(inbox.length, n);
  assert.equal((await o.call('DELETE', '/api/admin/email/suppressions/mantul@contoh.id')).status, 200);

  // kredit habis: email tetap di antrean dan dicoba lagi nanti
  mk.failNext = 402;
  await o.post(`/api/admin/players/${id}/notify`, { title: 'Saat kredit habis', body: 'Ditunda.' });
  await new Promise((r) => setTimeout(r, 150));
  const row = await db.one(`select id, status, error, next_at from outbox where subject = 'Saat kredit habis'`);
  assert.equal(row.status, 'queued');
  assert.match(row.error, /credits/i);
  assert.ok(new Date(row.next_at).getTime() > Date.now());
  // admin: kirim ulang sekarang (setelah kredit diisi)
  const retry = await o.post('/api/admin/email/retry');
  assert.ok(retry.body.requeued >= 1);
  await deliver(db);
  assert.ok(await drain());
  assert.equal((await db.one(`select status from outbox where id = $1`, [row.id])).status, 'sent');

  // email uji dari admin
  const t = await o.post('/api/admin/email/test', { to: 'admin@contoh.id' });
  assert.equal(t.status, 200, JSON.stringify(t.body));
  assert.equal(inbox[inbox.length - 1].subject, 'Tes email BUPI');
  const badTo = await o.post('/api/admin/email/test', { to: 'bukan-email' });
  assert.equal(badTo.status, 400);
});
