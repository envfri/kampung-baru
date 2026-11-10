// Klien ZePay Merchant API v2 (https://payment.envfri.com/docs) untuk pembayaran QRIS.
// Setiap request ditandatangani HMAC-SHA256; webhook diverifikasi dari body mentah.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config';
import type { Db } from '../db/index';

export class ZePayError extends Error {
  constructor(message: string, public status: number, public code: string, public details?: unknown) {
    super(message);
  }
}

export const zepayConfigured = () => !!(config.zepayKeyId && config.zepaySecret);
/** `live` / `test` dari awalan kunci API (zpk_live_… / zpk_test_…). */
export const zepayMode = (): 'live' | 'test' | null =>
  config.zepayKeyId.startsWith('zpk_live_') ? 'live' : config.zepayKeyId.startsWith('zpk_test_') ? 'test' : null;
export const zepayWebhookUrl = () => `${config.publicUrl}/api/payments/zepay/webhook`;

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/** Tanda tangan request: hex(HMAC(secret, ts \n METHOD \n path \n hex(sha256(body)) [\n Idempotency-Key])). */
export function signRequest(secret: string, ts: string, method: string, pathAndQuery: string, body: string, idempotencyKey?: string) {
  const bodyHash = createHash('sha256').update(body).digest('hex');
  return createHmac('sha256', secret)
    .update(`${ts}\n${method}\n${pathAndQuery}\n${bodyHash}${idempotencyKey ? `\n${idempotencyKey}` : ''}`)
    .digest('hex');
}

export async function zepay<T = any>(method: Method, path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  if (!zepayConfigured()) throw new ZePayError('ZePay belum dikonfigurasi (ZEPAY_KEY_ID / ZEPAY_SECRET).', 0, 'not_configured');
  const full = '/api/v2' + path;
  const raw = body === undefined ? '' : JSON.stringify(body);
  const ts = Math.floor(Date.now() / 1000).toString();
  const headers: Record<string, string> = {
    accept: 'application/json',
    'X-ZePay-Key-Id': config.zepayKeyId,
    'X-ZePay-Timestamp': ts,
    'X-ZePay-Signature': signRequest(config.zepaySecret, ts, method, full, raw, idempotencyKey),
  };
  if (raw) headers['content-type'] = 'application/json';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  let res: Response;
  try {
    res = await fetch(config.zepayBaseUrl + full, { method, headers, body: raw || undefined, signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new ZePayError('ZePay tidak bisa dihubungi.', 0, 'network');
  }
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* bukan JSON */ }
  if (!res.ok) throw new ZePayError(json?.error?.message ?? `HTTP ${res.status}`, res.status, json?.error?.code ?? 'http_error', json?.error?.details);
  return json as T;
}

/* ---------------- webhook ---------------- */

/** Secret webhook: dari env bila diisi, selain itu yang disimpan saat admin mendaftarkan webhook. */
export async function webhookSecrets(db: Db): Promise<string[]> {
  const out: string[] = [];
  if (config.zepayWebhookSecret) out.push(config.zepayWebhookSecret);
  const row = await db.one<{ value: any }>(`select value from settings where key = 'zepay_webhook'`);
  // secret yang didaftarkan dengan kunci uji tidak berlaku setelah pindah ke kunci live (dan sebaliknya)
  if (row?.value?.secret && !out.includes(row.value.secret) && (!row.value.mode || row.value.mode === zepayMode())) out.push(row.value.secret);
  return out;
}

/**
 * Verifikasi header `ZePay-Signature: t=<unix>,v1=<hex>[,v1=<hex>]` dengan
 * v1 = hex(HMAC_SHA256(secret, t + "." + body_mentah)). Tolak bila jam meleset > 300 detik.
 */
export function verifyWebhook(header: unknown, raw: Buffer, secrets: string[], nowSec = Date.now() / 1000) {
  if (typeof header !== 'string' || !secrets.length) return false;
  let t = '';
  const sigs: string[] = [];
  for (const part of header.split(',')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim(), v = part.slice(i + 1).trim();
    if (k === 't') t = v;
    else if (k === 'v1') sigs.push(v);
  }
  if (!/^\d{1,12}$/.test(t) || Math.abs(nowSec - Number(t)) > 300) return false;
  for (const s of secrets) {
    const expected = Buffer.from(createHmac('sha256', s).update(t + '.').update(raw).digest('hex'));
    if (sigs.some((v) => { const b = Buffer.from(v); return b.length === expected.length && timingSafeEqual(b, expected); })) return true;
  }
  return false;
}

/** Bentuk objek Payment ZePay yang dipakai di sini. */
export interface ZePayment {
  id: string;
  reference: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
  amount: number;
  qr_string: string | null;
  expires_at: string | null;
  failure_reason?: string | null;
  livemode: boolean;
  metadata?: Record<string, unknown>;
}
