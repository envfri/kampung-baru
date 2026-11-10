// Pembayaran QRIS lewat ZePay, diuji terhadap server ZePay tiruan yang memeriksa tanda tangan
// persis seperti dokumentasi (https://payment.envfri.com/docs).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { config } from '../src/config';

const KEY_ID = 'zpk_test_kampung';
const SECRET = 'zsk_test_rahasia';

/* ---------------- ZePay tiruan ---------------- */

type ZP = { id: string; reference: string; status: string; amount: number; qr_string: string; expires_at: string; livemode: boolean; metadata: any };
const zp = {
  payments: new Map<string, ZP>(),
  hooks: [] as any[],
  idem: new Map<string, { status: number; body: any }>(),
  failNext: false,
  calls: [] as string[],
};
let server: Server;

function send(res: any, status: number, body: any) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(body === null ? '' : JSON.stringify(body));
}
const err = (res: any, status: number, code: string) => send(res, status, { error: { code, message: code, request_id: 'req_x' } });

function startMock() {
  server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const path = req.url!;
      const method = req.method!;
      zp.calls.push(`${method} ${path}`);
      // autentikasi sesuai dokumentasi
      const ts = String(req.headers['x-zepay-timestamp'] ?? '');
      const idem = req.headers['idempotency-key'] as string | undefined;
      const want = createHmac('sha256', SECRET)
        .update(`${ts}\n${method}\n${path}\n${createHash('sha256').update(raw).digest('hex')}${idem ? `\n${idem}` : ''}`)
        .digest('hex');
      if (req.headers['x-zepay-key-id'] !== KEY_ID) return err(res, 401, 'authentication_failed');
      if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return err(res, 401, 'timestamp_out_of_range');
      if (req.headers['x-zepay-signature'] !== want) return err(res, 401, 'signature_invalid');
      const needsIdem = method === 'POST' && /^\/api\/v2\/(payments|payments\/[^/]+\/cancel|webhook-endpoints|webhook-endpoints\/[^/]+\/rotate-secret)$/.test(path);
      if (needsIdem && (!idem || !/^[A-Za-z0-9_.:-]{16,64}$/.test(idem))) return err(res, 400, 'invalid_request');
      if (needsIdem && zp.idem.has(idem!)) { const r = zp.idem.get(idem!)!; return send(res, r.status, r.body); }
      const body = raw ? JSON.parse(raw) : {};
      const reply = (status: number, b: any) => { if (needsIdem) zp.idem.set(idem!, { status, body: b }); send(res, status, b); };

      let m: RegExpMatchArray | null;
      if (method === 'POST' && path === '/api/v2/payments') {
        const allowed = ['amount', 'method', 'description', 'expires_in_minutes', 'metadata'];
        if (Object.keys(body).some((k) => !allowed.includes(k))) return reply(400, { error: { code: 'invalid_request' } });
        if (zp.failNext) { zp.failNext = false; return reply(503, { error: { code: 'provider_unavailable', message: 'down' } }); }
        const p: ZP = {
          id: randomUUID(), reference: 'KBL-' + Math.random().toString(36).slice(2, 12).toUpperCase(), status: 'PENDING',
          amount: body.amount, qr_string: '00020101021226650013ID.ZEPAY.SIM' + body.amount + '6304SIMU',
          expires_at: new Date(Date.now() + body.expires_in_minutes * 60_000).toISOString(), livemode: false, metadata: body.metadata,
        };
        zp.payments.set(p.id, p);
        return reply(201, p);
      }
      if ((m = path.match(/^\/api\/v2\/payments\/([^/]+)$/)) && method === 'GET') {
        const p = zp.payments.get(m[1]);
        return p ? send(res, 200, p) : err(res, 404, 'not_found');
      }
      if ((m = path.match(/^\/api\/v2\/payments\/([^/]+)\/cancel$/)) && method === 'POST') {
        const p = zp.payments.get(m[1]);
        if (!p) return reply(404, { error: { code: 'not_found' } });
        if (p.status !== 'PENDING' && p.status !== 'CANCELLED') return reply(409, { error: { code: 'payment_not_cancellable', message: 'x' } });
        p.status = 'CANCELLED';
        return reply(200, p);
      }
      if ((m = path.match(/^\/api\/v2\/payments\/([^/]+)\/simulate$/)) && method === 'POST') {
        const p = zp.payments.get(m[1]);
        if (!p) return err(res, 404, 'not_found');
        p.status = body.status ?? 'SUCCESS';
        return send(res, 200, p);
      }
      if (path === '/api/v2/merchant' && method === 'GET') {
        return send(res, 200, {
          id: 'm1', code: 'KBL', name: 'BUPI', status: 'active', livemode: false, contact_email: 'rahasia@contoh.id',
          payment_methods: [{ method: 'QRIS', enabled: true, channels: [{ channel: 'QRIS', name: 'QRIS', fee_fixed: 0, fee_percent: 0.7, fee_paid_by: 'merchant', min_amount: 1000, max_amount: 10000000, expiry_minutes: 1440 }] }],
        });
      }
      if (path === '/api/v2/webhook-endpoints' && method === 'GET') return send(res, 200, { data: zp.hooks.map(({ secret, ...h }) => h) });
      if (path === '/api/v2/webhook-endpoints' && method === 'POST') {
        const h = { id: randomUUID(), url: body.url, events: body.events, status: 'enabled', secret: 'whsec_' + randomUUID().replace(/-/g, ''), secret_last4: '' };
        h.secret_last4 = h.secret.slice(-4);
        zp.hooks.push(h);
        return reply(201, h);
      }
      if ((m = path.match(/^\/api\/v2\/webhook-endpoints\/([^/]+)\/rotate-secret$/)) && method === 'POST') {
        const h = zp.hooks.find((x) => x.id === m![1]);
        h.secret = 'whsec_' + randomUUID().replace(/-/g, '');
        return reply(200, h);
      }
      if ((m = path.match(/^\/api\/v2\/webhook-endpoints\/([^/]+)\/test$/)) && method === 'POST') return send(res, 202, { event_id: 'evt_' + '0'.repeat(32) });
      return err(res, 404, 'not_found');
    });
  });
  return new Promise<number>((ok) => server.listen(0, '127.0.0.1', () => ok((server.address() as any).port)));
}

/* ---------------- app ---------------- */

config.adminEmail = 'owner@test.local';
config.adminPassword = 'rahasia-sekali-123';
config.publicUrl = 'https://game.test';
config.paymentProvider = 'zepay';
config.zepayKeyId = KEY_ID;
config.zepaySecret = SECRET;
config.zepayWebhookSecret = '';

const { buildApp } = await import('../src/app');
const { paymentJobs } = await import('../src/lib/payments');
let app: any;
let db: any;

before(async () => {
  config.zepayBaseUrl = `http://127.0.0.1:${await startMock()}`;
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
    return { status: res.statusCode, body: b, headers: res.headers, raw: res.rawPayload as Buffer };
  };
  return { call, get: (u: string) => call('GET', u), post: (u: string, b?: unknown) => call('POST', u, b ?? {}) };
}

async function payer(email: string) {
  const c = client();
  await c.post('/api/auth/guest');
  assert.equal((await c.post('/api/pet', { name: 'Kopi', color: '#F6B7A8', ear: 'tunas' })).status, 200);
  const start = await c.post('/api/auth/email/start', { email });
  assert.equal((await c.post('/api/auth/email/verify', { email, code: start.body.devCode })).status, 200);
  return c;
}

async function owner() {
  const o = client();
  assert.equal((await o.post('/api/admin/login', { email: 'owner@test.local', password: 'rahasia-sekali-123' })).status, 200);
  return o;
}

function webhook(secret: string, event: any, t = Math.floor(Date.now() / 1000)) {
  const raw = JSON.stringify(event);
  const v1 = createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  return app.inject({
    method: 'POST', url: '/api/payments/zepay/webhook', payload: raw,
    headers: { 'content-type': 'application/json', 'zepay-signature': `t=${t},v1=${v1}`, 'zepay-event-id': event.id, 'zepay-event-type': event.type },
  });
}
const evt = (type: string, p: ZP, extra: any = {}) => ({
  id: 'evt_' + randomUUID().replace(/-/g, ''), type, created: new Date().toISOString(), livemode: false,
  data: { payment_id: p.id, reference: p.reference, amount: p.amount, metadata: p.metadata, ...extra },
});

/* ---------------- tes ---------------- */

test('zepay: checkout menerbitkan QRIS, QR dipakai ulang, gambar hanya untuk pemiliknya', async () => {
  const cfg = (await client().get('/api/config')).body;
  assert.equal(cfg.payments, 'zepay');
  assert.equal(cfg.paymentsTest, true);

  const guest = client();
  await guest.post('/api/auth/guest');
  await guest.post('/api/pet', { name: 'Tamu', color: '#F6B7A8', ear: 'tunas' });
  assert.equal((await guest.post('/api/pearls/checkout', { packageId: 'p-kecil' })).body.error.code, 'guest');

  const c = await payer('qris1@contoh.id');
  const co = await c.post('/api/pearls/checkout', { packageId: 'p-kecil' });
  assert.equal(co.status, 200, JSON.stringify(co.body));
  assert.equal(co.body.qris.amount, 15000);
  assert.equal(co.body.qris.test, true);
  assert.match(co.body.qris.invoice, /^KBL-/);
  const sent = [...zp.payments.values()].at(-1)!;
  assert.equal(sent.metadata.kb_payment, co.body.paymentId);
  assert.equal(sent.amount, 15000);

  // tap lagi paket yang sama: QR yang masih berlaku dipakai ulang
  const again = await c.post('/api/pearls/checkout', { packageId: 'p-kecil' });
  assert.equal(again.body.paymentId, co.body.paymentId);
  assert.equal(zp.payments.size, 1);

  const img = await c.get(co.body.qris.image);
  assert.equal(img.status, 200);
  assert.equal(img.headers['content-type'], 'image/png');
  assert.equal(img.raw.subarray(1, 4).toString(), 'PNG');
  const other = await payer('qris2@contoh.id');
  assert.equal((await other.get(co.body.qris.image)).status, 404);

  const hist = (await c.get('/api/pearls')).body.history;
  assert.equal(hist[0].resumable, true);
  const st = (await c.get(`/api/payments/${co.body.paymentId}`)).body;
  assert.equal(st.payment.status, 'pending');
  assert.equal(st.qris.paymentId, co.body.paymentId);
});

test('zepay: webhook bertanda tangan mengkredit sekali; tanda tangan/jam salah ditolak', async () => {
  const o = await owner();
  const reg = await o.post('/api/admin/zepay/webhook');
  assert.equal(reg.status, 200, JSON.stringify(reg.body));
  assert.equal(zp.hooks[0].url, 'https://game.test/api/payments/zepay/webhook');
  assert.deepEqual(zp.hooks[0].events, ['payment.*']);
  const secret = zp.hooks[0].secret;

  const c = await payer('qris3@contoh.id');
  const before = (await c.get('/api/me')).body.wallet.pearl;
  const co = await c.post('/api/pearls/checkout', { packageId: 'p-sedang' });
  const p = zp.payments.get([...zp.payments.values()].find((x) => x.metadata.kb_payment === co.body.paymentId)!.id)!;
  p.status = 'SUCCESS';

  const ev = evt('payment.succeeded', p, { fee: 273, net_amount: p.amount - 273, method: 'QRIS', paid_at: new Date().toISOString() });
  assert.equal((await webhook('whsec_salah', ev)).statusCode, 401);
  assert.equal((await webhook(secret, ev, Math.floor(Date.now() / 1000) - 400)).statusCode, 401);
  // nominal diubah → tidak dikredit
  assert.equal((await webhook(secret, { ...ev, data: { ...ev.data, amount: 1000 } })).statusCode, 200);
  assert.equal((await c.get('/api/me')).body.wallet.pearl, before);

  const ok = await webhook(secret, ev);
  assert.equal(ok.statusCode, 200, ok.body);
  assert.equal(JSON.parse(ok.body).result, 'paid');
  assert.equal((await webhook(secret, ev)).statusCode, 200); // kiriman ulang
  const after = (await c.get(`/api/payments/${co.body.paymentId}`)).body;
  assert.equal(after.payment.status, 'paid');
  assert.equal(after.wallet.pearl, before + 33);
  assert.equal(after.qris, null);
  const ledger = await db.query(`select count(*)::int n from wallet_ledger where ref = $1`, [co.body.paymentId]);
  assert.equal(ledger[0].n, 1);

  // status di admin
  const info = (await o.get('/api/admin/zepay')).body;
  assert.equal(info.mode, 'test');
  assert.equal(info.secretSource, 'db');
  assert.equal(info.merchant.qris.enabled, true);
  assert.equal(info.merchant.contact_email, undefined);
  assert.equal(info.endpoints[0].ours, true);
  assert.equal(info.lastEvent.type, 'payment.succeeded');

  // kedaluwarsa setelah lunas tidak mengubah apa pun
  await webhook(secret, evt('payment.expired', p, { status: 'EXPIRED', reason: 'Tagihan kedaluwarsa' }));
  assert.equal((await c.get(`/api/payments/${co.body.paymentId}`)).body.payment.status, 'paid');
});

test('zepay: tanpa webhook, cek status saat game memeriksa ikut mengkredit', async () => {
  const c = await payer('qris4@contoh.id');
  const before = (await c.get('/api/me')).body.wallet.pearl;
  const co = await c.post('/api/pearls/checkout', { packageId: 'p-kecil' });
  const p = [...zp.payments.values()].find((x) => x.metadata.kb_payment === co.body.paymentId)!;
  p.status = 'SUCCESS';
  const r = (await c.get(`/api/payments/${co.body.paymentId}`)).body;
  assert.equal(r.payment.status, 'paid');
  assert.equal(r.wallet.pearl, before + 10);
});

test('zepay: batal, gagal terbit, simulasi admin, dan worker untuk QR kedaluwarsa', async () => {
  const c = await payer('qris5@contoh.id');
  const o = await owner();

  // pemain membatalkan
  const co = await c.post('/api/pearls/checkout', { packageId: 'p-besar' });
  const cancel = await c.post(`/api/payments/${co.body.paymentId}/cancel`);
  assert.equal(cancel.body.status, 'failed');
  assert.equal([...zp.payments.values()].find((x) => x.metadata.kb_payment === co.body.paymentId)!.status, 'CANCELLED');

  // gateway gangguan: tagihan ditutup, pesan ramah
  zp.failNext = true;
  const down = await c.post('/api/pearls/checkout', { packageId: 'p-besar' });
  assert.equal(down.status, 400);
  assert.equal(down.body.error.code, 'payment_error');
  assert.match(down.body.error.message, /gangguan/);
  const failed = await db.one(`select status from payments where user_id = (select user_id from payments where id = $1) order by created_at desc limit 1`, [co.body.paymentId]);
  assert.equal(failed.status, 'failed');

  // simulasi lunas dari admin (kunci uji)
  const before = (await c.get('/api/me')).body.wallet.pearl;
  const co2 = await c.post('/api/pearls/checkout', { packageId: 'p-besar' });
  const sim = await o.post(`/api/admin/payments/${co2.body.paymentId}/simulate`, { status: 'SUCCESS' });
  assert.equal(sim.status, 200, JSON.stringify(sim.body));
  assert.equal(sim.body.result, 'paid');
  assert.equal((await c.get('/api/me')).body.wallet.pearl, before + 80);
  const list = (await o.get('/api/admin/payments')).body.payments;
  assert.equal(list[0].qr_string, undefined);

  // QR lewat batas waktu tanpa webhook: worker menanyakan status ke ZePay
  const co3 = await c.post('/api/pearls/checkout', { packageId: 'p-kecil' });
  const p3 = [...zp.payments.values()].find((x) => x.metadata.kb_payment === co3.body.paymentId)!;
  p3.status = 'EXPIRED';
  await db.query(`update payments set expires_at = now() - interval '10 minutes' where id = $1`, [co3.body.paymentId]);
  assert.equal(await paymentJobs(db), 1);
  assert.equal((await db.one(`select status from payments where id = $1`, [co3.body.paymentId])).status, 'expired');

  // sinkron manual dari admin
  const sync = await o.post(`/api/admin/payments/${co3.body.paymentId}/sync`);
  assert.equal(sync.body.result, 'expired');
});
