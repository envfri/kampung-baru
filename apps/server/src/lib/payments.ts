// Status pembayaran Mutiara: kredit tepat sekali, penutupan, dan sinkron dengan ZePay.
import type { Db } from '../db/index';
import { credit, track } from './core';
import { notify } from './push';
import { zepay, zepayMode, type ZePayment } from './zepay';

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

/** Tutup pembayaran yang masih menunggu (gagal / kedaluwarsa). Pembayaran lunas tidak pernah diubah. */
export async function closePayment(db: Db, paymentId: string, status: 'failed' | 'expired', raw?: unknown) {
  const r = await db.one(
    `update payments set status = $2, raw = coalesce($3::text::jsonb, raw) where id = $1 and status = 'pending' returning id`,
    [paymentId, status, raw === undefined ? null : JSON.stringify(raw)],
  );
  return !!r;
}

/**
 * Terapkan status pembayaran dari ZePay (webhook atau cek status) ke pembayaran kita.
 * Nominal harus sama persis; status SUCCESS mengkredit Mutiara meski tagihan sempat kedaluwarsa (dana tetap masuk).
 */
export async function applyZepay(
  db: Db,
  pay: { id: string; amount_idr: number },
  zp: { status: string; amount: number; livemode?: boolean },
  raw: unknown,
  log?: any,
): Promise<'paid' | 'failed' | 'expired' | 'pending' | 'ignored'> {
  if (Number(zp.amount) !== pay.amount_idr) {
    log?.warn?.({ id: pay.id, amount: zp.amount, expected: pay.amount_idr }, 'zepay: nominal tidak cocok');
    return 'ignored';
  }
  if (zepayMode() === 'live' && zp.livemode === false) {
    log?.warn?.({ id: pay.id }, 'zepay: event mode uji ditolak di kunci live');
    return 'ignored';
  }
  switch (zp.status) {
    case 'SUCCESS': await markPaid(db, pay.id, raw); return 'paid';
    case 'EXPIRED': await closePayment(db, pay.id, 'expired', raw); return 'expired';
    case 'FAILED':
    case 'CANCELLED': await closePayment(db, pay.id, 'failed', raw); return 'failed';
    default: return 'pending';
  }
}

/** Tanya status langsung ke ZePay (cadangan bila webhook terlambat atau belum didaftarkan). */
export async function syncZepay(db: Db, paymentId: string, log?: any) {
  const p = await db.one<{ id: string; amount_idr: number; provider: string; provider_ref: string | null; status: string }>(
    `select id, amount_idr, provider, provider_ref, status from payments where id = $1`,
    [paymentId],
  );
  if (!p || p.provider !== 'zepay' || !p.provider_ref) return null;
  await db.query(`update payments set synced_at = now() where id = $1`, [p.id]);
  const zp = await zepay<ZePayment>('GET', `/payments/${encodeURIComponent(p.provider_ref)}`);
  return applyZepay(db, p, zp, { source: 'sync', payment: pick(zp) }, log);
}

/** Simpan hanya bagian yang perlu dari objek Payment ZePay (tanpa isi QR yang panjang). */
export const pick = (zp: any) => ({
  id: zp?.id, reference: zp?.reference, status: zp?.status, amount: zp?.amount, fee: zp?.fee, net_amount: zp?.net_amount,
  method: zp?.method, paid_at: zp?.paid_at, failure_reason: zp?.failure_reason, livemode: zp?.livemode,
});

/** Pekerjaan latar: cocokkan tagihan QRIS yang sudah lewat batas waktu, tutup yang tak pernah terbit. */
export async function paymentJobs(db: Db, log?: any) {
  await db.query(
    `update payments set status = 'failed' where provider = 'zepay' and status = 'pending' and provider_ref is null and created_at < now() - interval '1 hour'`,
  );
  const due = await db.query<{ id: string }>(
    `select id from payments
      where provider = 'zepay' and status = 'pending' and provider_ref is not null
        and expires_at < now() - interval '3 minutes' and created_at > now() - interval '3 days'
        and (synced_at is null or synced_at < now() - interval '10 minutes')
      order by expires_at limit 8`,
  );
  let synced = 0;
  for (const r of due) {
    try { await syncZepay(db, r.id, log); synced++; } catch (e) { log?.warn?.({ id: r.id, err: String(e) }, 'zepay: cek status gagal'); }
  }
  return synced;
}
