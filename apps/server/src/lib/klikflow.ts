// WhatsApp lewat Klik Flow API v2 (https://klikflow.id/docs/api).
// Satu endpoint POST /api/v2/messages untuk WhatsApp scan QR (teks bebas) dan WhatsApp Official
// (di luar 24 jam hanya template yang disetujui atau OTP). Kunci kf_test_… hanya mengirim ke nomor uji.
import { renderText, type NotifyChannelsConfig, type NotifyTemplate } from '@kb/shared';
import { config } from '../config';
import type { Db } from '../db/index';
import { verifyWebhook } from './zepay';

export const waEnabled = () => !!config.klikflowKey;
export const klikflowMode = (): 'live' | 'test' | null =>
  config.klikflowKey.startsWith('kf_live_') ? 'live' : config.klikflowKey.startsWith('kf_test_') ? 'test' : null;
export const klikflowWebhookUrl = () => `${config.publicUrl}/api/wa/klikflow/webhook`;

export class KlikFlowError extends Error {
  constructor(message: string, public status: number, public code: string, public retryAfter?: number) {
    super(message);
  }
}

export async function kf<T = any>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  if (!waEnabled()) throw new KlikFlowError('Klik Flow belum dikonfigurasi (KLIKFLOW_API_KEY).', 0, 'not_configured');
  const headers: Record<string, string> = { accept: 'application/json', authorization: `Bearer ${config.klikflowKey}` };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  let res: Response;
  try {
    res = await fetch(config.klikflowBaseUrl + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new KlikFlowError('Klik Flow tidak bisa dihubungi.', 0, 'network');
  }
  const text = await res.text();
  let j: any = null;
  try { j = text ? JSON.parse(text) : null; } catch { /* bukan JSON */ }
  if (!res.ok) {
    const ra = Number(res.headers.get('retry-after'));
    throw new KlikFlowError(j?.error?.message ?? `HTTP ${res.status}`, res.status, j?.error?.code ?? 'http_error', Number.isFinite(ra) ? ra : undefined);
  }
  return j as T;
}

/** Hasil kirim untuk antrean: kapan dicoba lagi, kapan berhenti. */
export interface WaResult { ok: boolean; id?: string; status?: number; code?: string; error?: string; retry?: boolean; stop?: boolean }

// Kode error yang menghentikan pengiriman WhatsApp lain di batch yang sama (masalah kunci/akun, bukan pesannya).
const STOP = new Set(['missing_key', 'key_invalid', 'key_revoked', 'key_expired', 'member_inactive', 'ip_not_allowed', 'plan_no_api', 'tenant_blocked', 'scope_missing', 'permission_missing', 'channel_not_allowed', 'channel_paused', 'channel_unavailable', 'daily_limit']);
const RETRY = new Set([...STOP, 'rate_limited', 'new_chat_limit', 'request_in_progress', 'internal_error', 'send_failed', 'network']);

export async function waSend(payload: any, idempotencyKey: string): Promise<WaResult> {
  try {
    const r: any = await kf('POST', '/api/v2/messages', payload, idempotencyKey);
    return { ok: true, id: r?.data?.id != null ? String(r.data.id) : undefined, status: 200 };
  } catch (e: any) {
    const code = e?.code ?? 'error';
    const retry = RETRY.has(code) || e?.status >= 500;
    return { ok: false, status: e?.status, code, error: `${e?.message ?? 'gagal'} (${code})`.slice(0, 300), retry, stop: STOP.has(code) };
  }
}

/**
 * Isi permintaan Kirim pesan untuk satu notifikasi.
 * Scan QR: teks bebas. Official: template yang disetujui (variabel diisi dari teks admin), atau OTP untuk kode verifikasi.
 */
export function waPayload(
  cfg: NotifyChannelsConfig['whatsapp'],
  to: string,
  tpl: NotifyTemplate,
  vars: Record<string, any>,
  opts: { otpCode?: string; forceText?: boolean } = {},
): { payload: any } | { error: string } {
  const base: any = { channel: cfg.channel, to, ...(cfg.from ? { from: cfg.from } : {}) };
  if (cfg.channel === 'whatsapp_qr' || opts.forceText) {
    const text = renderText(tpl.wa, vars);
    if (!text) return { error: 'Teks WhatsApp kosong' };
    return { payload: { ...base, type: 'text', text: { body: text.slice(0, 4000) } } };
  }
  if (opts.otpCode) {
    if (!cfg.verifyTemplate) return { error: 'Template Autentikasi untuk kode verifikasi belum diatur (admin → WhatsApp).' };
    return { payload: { ...base, type: 'otp', otp: { template: cfg.verifyTemplate, code: opts.otpCode } } };
  }
  if (!tpl.waTemplate) return { error: 'Template WhatsApp Official belum dipilih untuk notifikasi ini.' };
  const entries = Object.entries(tpl.waVars ?? {}).map(([k, v]) => [k, renderText(String(v ?? ''), vars)] as const);
  const numbered = entries.length > 0 && entries.every(([k]) => /^\d+$/.test(k));
  const variables = numbered
    ? entries.sort((a, b) => Number(a[0]) - Number(b[0])).map(([, v]) => v)
    : Object.fromEntries(entries);
  return {
    payload: {
      ...base,
      type: 'template',
      template: { name: tpl.waTemplate, ...(tpl.waLanguage ? { language: tpl.waLanguage } : {}), ...(entries.length ? { variables } : {}) },
    },
  };
}

/* ---------------- webhook ---------------- */

export async function klikflowSecrets(db: Db) {
  const out: string[] = [];
  if (config.klikflowWebhookSecret) out.push(config.klikflowWebhookSecret);
  const row = await db.one<{ value: any }>(`select value from settings where key = 'klikflow_webhook'`);
  if (row?.value?.secret && !out.includes(row.value.secret)) out.push(row.value.secret);
  return out;
}

/** `Klikflow-Signature: t=<detik>,v1=<HMAC-SHA256 "<t>.<body>">`, selisih waktu maks. 300 detik. */
export const verifyKlikflow = verifyWebhook;

export const maskPhone = (p: string | null | undefined) => (p ? p.slice(0, 5) + '•'.repeat(Math.max(0, p.length - 8)) + p.slice(-3) : null);
