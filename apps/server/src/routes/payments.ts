import type { FastifyInstance } from 'fastify';
import { createHash } from 'node:crypto';
import type { Db } from '../db/index';
import { config } from '../config';
import { bad, credit, forbidden, getCatalog, getSettings, notFound, track } from '../lib/core';
import { requireUser } from '../lib/auth';
import { esc } from '@kb/shared';
import { str } from '../lib/validate';
import { notify } from '../lib/push';

const UUID = /^[0-9a-f-]{36}$/i;
const rupiah = (n: number) => 'Rp' + n.toLocaleString('id-ID');

/** Tandai pembayaran lunas dan kreditkan Mutiara tepat sekali. */
export async function markPaid(db: Db, paymentId: string, raw?: unknown) {
  let paid: { user_id: string; pearls: number } | null = null;
  const done = await db.tx(async (t) => {
    const p = await t.one<{ user_id: string; pearls: number; amount_idr: number }>(
      `update payments set status = 'paid', paid_at = now(), raw = coalesce($2::text::jsonb, raw) where id = $1 and status <> 'paid' returning user_id, pearls, amount_idr`,
      [paymentId, raw === undefined ? null : JSON.stringify(raw)],
    );
    if (!p) return false;
    await credit(t, p.user_id, 'pearl', p.pearls, 'purchase', paymentId);
    await track(t, p.user_id, 'payment_paid', { amount: p.amount_idr, pearls: p.pearls });
    paid = p;
    return true;
  });
  if (paid) {
    const p = paid as { user_id: string; pearls: number };
    void notify(db, p.user_id, { kind: 'system', title: 'Mutiara masuk', body: `+${p.pearls} Mutiara sudah ada di dompetmu. Terima kasih!`, url: '/#pearls', tag: 'payment' });
  }
  return done;
}

export default async function paymentRoutes(app: FastifyInstance, { db }: { db: Db }) {
  const auth = { preHandler: requireUser(db) };

  app.get('/api/pearls', auth, async (req) => {
    const cat = await getCatalog(db);
    const history = await db.query(
      `select id, package_id, pearls, amount_idr, status, created_at, paid_at from payments where user_id = $1 order by created_at desc limit 10`,
      [req.user!.id],
    );
    return { packages: cat.packages.filter((p) => p.active), history, provider: config.paymentProvider };
  });

  app.post('/api/pearls/checkout', { ...auth, config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (req: any) => {
    const u = req.user!;
    const s = await getSettings(db);
    if (!s.features.payments) throw forbidden('Pembelian Mutiara sedang tidak tersedia.');
    if (u.is_guest) throw bad('guest', 'Simpan progres dulu (masuk dengan Google atau email) sebelum membeli Mutiara.');
    const pkgId = str(req.body?.packageId, 'Paket', { max: 64 })!;
    const cat = await getCatalog(db);
    const pkg = cat.packages.find((p) => p.id === pkgId && p.active);
    if (!pkg) throw notFound('Paket tidak ditemukan.');
    const pay = (await db.one<{ id: string }>(
      `insert into payments (user_id, package_id, pearls, amount_idr, provider) values ($1,$2,$3,$4,$5) returning id`,
      [u.id, pkg.id, pkg.pearls + pkg.bonus, pkg.price_idr, config.paymentProvider],
    ))!;
    await track(db, u.id, 'checkout', { packageId: pkg.id, amount: pkg.price_idr });

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
    const p = await db.one(`select id, status, pearls, amount_idr, paid_at from payments where id = $1 and user_id = $2`, [id, req.user!.id]);
    if (!p) throw notFound('Pembayaran tidak ditemukan.');
    const wallet = await db.one(`select coin, pearl from wallets where user_id = $1`, [req.user!.id]);
    return { payment: p, wallet };
  });

  /* Notifikasi Midtrans (HTTP notification URL di dashboard Midtrans: <PUBLIC_URL>/api/payments/midtrans/notify) */
  app.post('/api/payments/midtrans/notify', async (req: any, reply) => {
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
<small>Halaman ini hanya ada di mode pengembangan (PAYMENT_PROVIDER=mock). Di produksi, pemain diarahkan ke Midtrans (QRIS, e-wallet, transfer bank).</small>
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
