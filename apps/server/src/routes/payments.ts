import type { FastifyInstance } from 'fastify';
import { createHash } from 'node:crypto';
import QRCode from 'qrcode';
import type { Db } from '../db/index';
import { config } from '../config';
import { bad, forbidden, getCatalog, getSettings, notFound, track } from '../lib/core';
import { requireUser } from '../lib/auth';
import { esc } from '@kb/shared';
import { str } from '../lib/validate';
import { applyZepay, closePayment, markPaid, pick, syncZepay } from '../lib/payments';
import { verifyWebhook, webhookSecrets, zepay, zepayConfigured, zepayMode, ZePayError, type ZePayment } from '../lib/zepay';

export { markPaid };

const UUID = /^[0-9a-f-]{36}$/i;
const rupiah = (n: number) => 'Rp' + n.toLocaleString('id-ID');

type QrRow = { id: string; amount_idr: number; pearls: number; invoice: string | null; expires_at: string | Date | null };
/** Data yang dibutuhkan layar QRIS di game. */
const qrisView = (p: QrRow) => ({
  paymentId: p.id,
  amount: p.amount_idr,
  pearls: p.pearls,
  invoice: p.invoice,
  expiresAt: p.expires_at,
  image: `/api/payments/${p.id}/qris.png`,
  test: zepayMode() === 'test',
});

// Batasi cek status ke ZePay saat game memeriksa pembayaran berulang-ulang.
// ZePay membatasi 60 request/menit per kunci API: cek status memakai paling banyak 30,
// sisanya untuk membuat QR baru, pembatalan, dan worker.
const lastSync = new Map<string, number>();
const recent: number[] = [];
const SYNC_PER_MINUTE = 30;
function syncDue(id: string, everyMs = 8_000) {
  const now = Date.now();
  if (now - (lastSync.get(id) ?? 0) < everyMs) return false;
  while (recent.length && now - recent[0] > 60_000) recent.shift();
  if (recent.length >= SYNC_PER_MINUTE) return false;
  if (lastSync.size > 5_000) lastSync.clear();
  lastSync.set(id, now);
  recent.push(now);
  return true;
}

export default async function paymentRoutes(app: FastifyInstance, { db }: { db: Db }) {
  const auth = { preHandler: requireUser(db) };

  app.get('/api/pearls', auth, async (req) => {
    const cat = await getCatalog(db);
    const history = await db.query(
      `select id, package_id, pearls, amount_idr, status, created_at, paid_at,
              (status = 'pending' and provider = 'zepay' and qr_string is not null and expires_at > now() + interval '30 seconds') as resumable
         from payments where user_id = $1 order by created_at desc limit 10`,
      [req.user!.id],
    );
    return { packages: cat.packages.filter((p) => p.active), history, provider: config.paymentProvider, test: config.paymentProvider === 'zepay' && zepayMode() === 'test' };
  });

  app.post('/api/pearls/checkout', { ...auth, config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (req: any) => {
    const u = req.user!;
    const s = await getSettings(db);
    if (!s.features.payments) throw forbidden('Pembelian Mutiara sedang tidak tersedia.');
    if (u.is_guest && config.paymentProvider !== 'mock') throw bad('guest', 'Simpan progres dulu (masuk dengan Google atau email) sebelum membeli Mutiara.');
    const pkgId = str(req.body?.packageId, 'Paket', { max: 64 })!;
    const cat = await getCatalog(db);
    const pkg = cat.packages.find((p) => p.id === pkgId && p.active);
    if (!pkg) throw notFound('Paket tidak ditemukan.');
    if (config.paymentProvider === 'zepay') {
      if (!zepayConfigured()) throw forbidden('Pembayaran QRIS belum dikonfigurasi (ZEPAY_KEY_ID / ZEPAY_SECRET).');
      // QR untuk paket yang sama dan masih berlaku dipakai lagi, supaya tidak menumpuk tagihan
      const open = await db.one<QrRow>(
        `select id, amount_idr, pearls, invoice, expires_at from payments
          where user_id = $1 and package_id = $2 and provider = 'zepay' and status = 'pending' and amount_idr = $3
            and qr_string is not null and expires_at > now() + interval '2 minutes'
          order by created_at desc limit 1`,
        [u.id, pkg.id, pkg.price_idr],
      );
      if (open) return { ok: true, paymentId: open.id, qris: qrisView(open) };
    }

    const pay = (await db.one<{ id: string }>(
      `insert into payments (user_id, package_id, pearls, amount_idr, provider) values ($1,$2,$3,$4,$5) returning id`,
      [u.id, pkg.id, pkg.pearls + pkg.bonus, pkg.price_idr, config.paymentProvider],
    ))!;
    await track(db, u.id, 'checkout', { packageId: pkg.id, amount: pkg.price_idr });

    if (config.paymentProvider === 'zepay') {
      try {
        const zp = await zepay<ZePayment>('POST', '/payments', {
          amount: pkg.price_idr,
          method: 'QRIS',
          description: `${pkg.pearls + pkg.bonus} Mutiara · ${pkg.name}`.slice(0, 140),
          expires_in_minutes: config.zepayExpiresMinutes,
          metadata: { kb_payment: pay.id, package: pkg.id },
        }, `kb-pay-${pay.id}`);
        if (!zp?.id || !zp.qr_string) throw new ZePayError('Respons ZePay tanpa QRIS', 502, 'no_qr');
        const row = (await db.one<QrRow>(
          `update payments set provider_ref = $2, invoice = $3, qr_string = $4, expires_at = $5 where id = $1
           returning id, amount_idr, pearls, invoice, expires_at`,
          [pay.id, zp.id, zp.reference, zp.qr_string, zp.expires_at],
        ))!;
        return { ok: true, paymentId: pay.id, qris: qrisView(row) };
      } catch (e: any) {
        req.log.error({ id: pay.id, status: e?.status, code: e?.code, msg: e?.message }, 'zepay: gagal membuat QRIS');
        await closePayment(db, pay.id, 'failed', { error: e?.code ?? 'error', message: String(e?.message ?? e).slice(0, 200) });
        const down = e?.code === 'provider_unavailable' || e?.code === 'payment_method_unavailable' || e?.code === 'network' || e?.status >= 500;
        throw bad('payment_error', down ? 'QRIS sedang gangguan. Coba lagi beberapa menit lagi.' : 'Gagal membuat QRIS. Coba lagi sebentar.');
      }
    }

    if (config.paymentProvider === 'mock') {
      return { ok: true, paymentId: pay.id, redirectUrl: `/pay/mock/${pay.id}` };
    }
    if (!config.midtransServerKey) throw forbidden('Pembayaran belum dikonfigurasi (MIDTRANS_SERVER_KEY).');
    const base = config.midtransProduction ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com';
    const res = await fetch(`${base}/snap/v1/transactions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        authorization: 'Basic ' + Buffer.from(config.midtransServerKey + ':').toString('base64'),
      },
      body: JSON.stringify({
        transaction_details: { order_id: pay.id, gross_amount: pkg.price_idr },
        item_details: [{ id: pkg.id, name: pkg.name.slice(0, 50), price: pkg.price_idr, quantity: 1 }],
        customer_details: { first_name: u.display_name },
        enabled_payments: ['other_qris', 'gopay', 'shopeepay', 'bank_transfer', 'echannel'],
        callbacks: { finish: `${config.publicUrl}/?payment=${pay.id}` },
      }),
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok || !body.token) {
      req.log.error({ status: res.status, body }, 'midtrans: gagal membuat transaksi');
      await db.query(`update payments set status = 'failed', raw = $2::text::jsonb where id = $1`, [pay.id, JSON.stringify(body)]);
      throw bad('payment_error', 'Gagal membuat pembayaran. Coba lagi sebentar.');
    }
    await db.query(`update payments set provider_ref = $2 where id = $1`, [pay.id, body.token]);
    return { ok: true, paymentId: pay.id, snapToken: body.token, redirectUrl: body.redirect_url };
  });

  app.get('/api/payments/:id', auth, async (req: any) => {
    const id = String(req.params.id);
    if (!UUID.test(id)) throw bad('invalid', 'Pembayaran tidak valid.');
    const load = () => db.one(
      `select id, status, pearls, amount_idr, paid_at, provider, provider_ref, invoice, expires_at, qr_string is not null as has_qr
         from payments where id = $1 and user_id = $2`,
      [id, req.user!.id],
    );
    let p = await load();
    if (!p) throw notFound('Pembayaran tidak ditemukan.');
    // cadangan bila webhook terlambat: tanya ZePay langsung (dibatasi tiap beberapa detik)
    if (p.status === 'pending' && p.provider === 'zepay' && p.provider_ref && zepayConfigured() && syncDue(id)) {
      try { await syncZepay(db, id, req.log); p = await load(); } catch (e) { req.log.warn({ id, err: String(e) }, 'zepay: cek status gagal'); }
    }
    const wallet = await db.one(`select coin, pearl from wallets where user_id = $1`, [req.user!.id]);
    const qris = p.status === 'pending' && p.provider === 'zepay' && p.has_qr ? qrisView(p) : null;
    return { payment: { id: p.id, status: p.status, pearls: p.pearls, amount_idr: p.amount_idr, paid_at: p.paid_at }, wallet, qris };
  });

  /* Gambar QRIS (PNG) supaya bisa dipindai atau disimpan ke galeri lalu dibuka di aplikasi bank/e-wallet. */
  app.get('/api/payments/:id/qris.png', auth, async (req: any, reply) => {
    const id = String(req.params.id);
    if (!UUID.test(id)) throw bad('invalid', 'Pembayaran tidak valid.');
    const p = await db.one<{ qr_string: string | null }>(`select qr_string from payments where id = $1 and user_id = $2`, [id, req.user!.id]);
    if (!p?.qr_string) throw notFound('QRIS tidak ditemukan.');
    const png = await QRCode.toBuffer(p.qr_string, { type: 'png', width: 600, margin: 3, errorCorrectionLevel: 'M' });
    reply.header('cache-control', 'private, max-age=3600').type('image/png');
    return png;
  });

  /* Pemain membatalkan tagihan yang belum dibayar. */
  app.post('/api/payments/:id/cancel', auth, async (req: any) => {
    const id = String(req.params.id);
    if (!UUID.test(id)) throw bad('invalid', 'Pembayaran tidak valid.');
    const p = await db.one<{ id: string; status: string; provider: string; provider_ref: string | null; amount_idr: number }>(
      `select id, status, provider, provider_ref, amount_idr from payments where id = $1 and user_id = $2`,
      [id, req.user!.id],
    );
    if (!p) throw notFound('Pembayaran tidak ditemukan.');
    if (p.status === 'pending') {
      if (p.provider === 'zepay' && p.provider_ref) {
        try {
          const zp = await zepay<ZePayment>('POST', `/payments/${encodeURIComponent(p.provider_ref)}/cancel`, { reason: 'Dibatalkan pemain' }, `kb-cancel-${p.id}`);
          await applyZepay(db, p, zp, { source: 'cancel', payment: pick(zp) }, req.log);
        } catch (e: any) {
          // sudah dibayar/ditutup duluan: ambil status terbarunya
          if (e?.code === 'payment_not_cancellable') await syncZepay(db, p.id, req.log).catch(() => null);
          else { req.log.warn({ id, code: e?.code }, 'zepay: gagal membatalkan'); throw bad('payment_error', 'Gagal membatalkan. Coba lagi sebentar.'); }
        }
      } else await closePayment(db, p.id, 'failed', { cancelled: 'player' });
    }
    const after = await db.one<{ status: string }>(`select status from payments where id = $1`, [id]);
    const wallet = await db.one(`select coin, pearl from wallets where user_id = $1`, [req.user!.id]);
    return { ok: true, status: after?.status, wallet };
  });

  /*
   * Webhook ZePay: <PUBLIC_URL>/api/payments/zepay/webhook (didaftarkan dari admin → Pembayaran).
   * Tanda tangan dihitung dari body mentah, jadi rute ini memakai parser JSON sendiri yang menyimpan byte aslinya.
   */
  app.register(async (sub) => {
    sub.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
      (req as any).rawBody = body;
      try { done(null, JSON.parse((body as Buffer).toString('utf8'))); } catch (e: any) { e.statusCode = 400; done(e, undefined); }
    });
    sub.post('/api/payments/zepay/webhook', { config: { rateLimit: false } }, async (req: any, reply) => {
      const raw: Buffer | undefined = req.rawBody;
      if (!raw || !verifyWebhook(req.headers['zepay-signature'], raw, await webhookSecrets(db))) {
        req.log.warn({ event: req.headers['zepay-event-id'] }, 'zepay: tanda tangan webhook tidak cocok');
        return reply.code(401).send({ ok: false });
      }
      const ev = req.body ?? {};
      await db.query(
        `insert into settings (key, value) values ('zepay_seen', $1::text::jsonb) on conflict (key) do update set value = excluded.value`,
        [JSON.stringify({ at: new Date().toISOString(), id: ev.id, type: ev.type, livemode: ev.livemode })],
      );
      const status = ({ 'payment.succeeded': 'SUCCESS', 'payment.expired': 'EXPIRED', 'payment.failed': 'FAILED', 'payment.cancelled': 'CANCELLED' } as Record<string, string>)[ev.type];
      if (!status) return { ok: true };
      const d = ev.data ?? {};
      const ref = String(d.payment_id ?? '');
      let p = ref ? await db.one<{ id: string; amount_idr: number }>(`select id, amount_idr from payments where provider = 'zepay' and provider_ref = $1`, [ref]) : undefined;
      // cadangan: tagihan sudah terbit di ZePay tapi id-nya belum sempat tersimpan di sini
      const ours = d.metadata?.kb_payment;
      if (!p && ref && typeof ours === 'string' && UUID.test(ours)) {
        p = await db.one(`update payments set provider_ref = $2 where id = $1 and provider = 'zepay' and provider_ref is null returning id, amount_idr`, [ours, ref]);
      }
      if (!p) {
        req.log.warn({ event: ev.id, ref }, 'zepay: pembayaran tidak dikenal');
        return { ok: true, ignored: true };
      }
      const result = await applyZepay(db, p, { status, amount: d.amount, livemode: ev.livemode }, { source: 'webhook', event: ev.id, type: ev.type, data: d }, req.log);
      return { ok: true, result };
    });
  });

  /* Notifikasi Midtrans (HTTP notification URL di dashboard Midtrans: <PUBLIC_URL>/api/payments/midtrans/notify) */
  app.post('/api/payments/midtrans/notify', { config: { rateLimit: false } }, async (req: any, reply) => {
    const b = req.body ?? {};
    const sig = createHash('sha512').update(`${b.order_id}${b.status_code}${b.gross_amount}${config.midtransServerKey}`).digest('hex');
    if (!config.midtransServerKey || sig !== b.signature_key) {
      req.log.warn({ order: b.order_id }, 'midtrans: signature tidak cocok');
      return reply.code(403).send({ ok: false });
    }
    const id = String(b.order_id ?? '');
    if (!UUID.test(id)) return reply.code(400).send({ ok: false });
    const p = await db.one<{ amount_idr: number }>(`select amount_idr from payments where id = $1`, [id]);
    if (!p) return reply.code(404).send({ ok: false });
    if (Math.round(Number(b.gross_amount)) !== p.amount_idr) {
      req.log.warn({ id, gross: b.gross_amount }, 'midtrans: nominal tidak cocok');
      return reply.code(400).send({ ok: false });
    }
    const st = String(b.transaction_status);
    if (st === 'settlement' || (st === 'capture' && b.fraud_status === 'accept')) await markPaid(db, id, b);
    else if (st === 'expire') await db.query(`update payments set status = 'expired', raw = $2::text::jsonb where id = $1 and status = 'pending'`, [id, JSON.stringify(b)]);
    else if (st === 'cancel' || st === 'deny' || st === 'failure') await db.query(`update payments set status = 'failed', raw = $2::text::jsonb where id = $1 and status = 'pending'`, [id, JSON.stringify(b)]);
    return { ok: true };
  });

  /* Simulasi pembayaran untuk pengembangan (PAYMENT_PROVIDER=mock). */
  app.get('/pay/mock/:id', async (req: any, reply) => {
    if (config.paymentProvider !== 'mock') return reply.code(404).send('Not found');
    const id = String(req.params.id);
    if (!UUID.test(id)) return reply.code(400).send('Bad request');
    const p = await db.one<{ status: string; pearls: number; amount_idr: number }>(`select status, pearls, amount_idr from payments where id = $1`, [id]);
    if (!p) return reply.code(404).send('Not found');
    reply.type('text/html; charset=utf-8');
    return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Simulasi pembayaran</title>
<style>body{font-family:system-ui,sans-serif;background:#EEF3F0;color:#2B2F4A;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px}
main{background:#fff;border:3px solid #2B2F4A;border-radius:20px;box-shadow:0 5px 0 #2B2F4A;padding:24px;max-width:360px;width:100%}
h1{font-size:20px;margin:0 0 8px}p{margin:0 0 16px}.row{display:flex;gap:10px}button{flex:1;font:700 16px system-ui;padding:12px;border-radius:14px;border:2.5px solid #2B2F4A;box-shadow:0 3px 0 #2B2F4A;cursor:pointer;background:#fff}
.pay{background:#F2B632}small{display:block;margin-top:14px;color:#5F6478}</style></head><body><main>
<h1>Simulasi pembayaran</h1><p>${esc(p.pearls)} Mutiara · <b>${rupiah(p.amount_idr)}</b><br>Status: ${esc(p.status)}</p>
${p.status === 'pending' ? `<form method="post" class="row"><button class="pay" name="action" value="pay">Bayar</button><button name="action" value="cancel">Batal</button></form>` : `<p><a href="/?payment=${id}">Kembali ke game</a></p>`}
<small>Halaman ini hanya ada di mode pengembangan (PAYMENT_PROVIDER=mock). Di produksi, pemain membayar dengan QRIS (ZePay).</small>
</main></body></html>`;
  });

  app.post('/pay/mock/:id', async (req: any, reply) => {
    if (config.paymentProvider !== 'mock') return reply.code(404).send('Not found');
    const id = String(req.params.id);
    if (!UUID.test(id)) return reply.code(400).send('Bad request');
    const action = (req.body as any)?.action;
    if (action === 'pay') await markPaid(db, id, { mock: true });
    else await db.query(`update payments set status = 'failed' where id = $1 and status = 'pending'`, [id]);
    return reply.redirect(`/?payment=${id}`, 303);
  });
}
