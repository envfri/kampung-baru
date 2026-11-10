// Semua email (kode masuk & notifikasi) dikirim lewat Mailketing API v2:
// https://mailketing.co.id/docs/send-email-via-api/ — POST /api/v2/send, token Bearer, 1 email = 1 kredit.
// Tanpa MAILKETING_API_TOKEN, kode masuk hanya dicatat di log server dan notifikasi tidak dikirim ke email.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { esc } from '@kb/shared';
import { config } from '../config';
import type { Db } from '../db/index';
import { getSettings } from './core';
import type { Note } from './push';

export const mailEnabled = () => !!config.mailketingToken;

/** "Kampung Bulu <noreply@domain>" → nama & alamat pengirim. */
export function mailFrom(v = config.mailFrom) {
  const m = /^\s*"?(.*?)"?\s*<\s*([^<>\s]+@[^<>\s]+)\s*>\s*$/.exec(v);
  if (m) return { name: m[1] || 'Kampung Bulu', email: m[2] };
  return { name: 'Kampung Bulu', email: v.trim() };
}

/* ---------------- Mailketing API ---------------- */

export interface SendResult { ok: boolean; id?: string; status?: number; error?: string; retry?: boolean }

export async function mailketingSend(to: string, subject: string, html: string): Promise<SendResult> {
  const from = mailFrom();
  let res: Response;
  try {
    res = await fetch(`${config.mailketingBaseUrl}/api/v2/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', authorization: `Bearer ${config.mailketingToken}` },
      body: JSON.stringify({ from_name: from.name, from_email: from.email, recipient: to, subject, content: html }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return { ok: false, error: 'Mailketing tidak bisa dihubungi', retry: true };
  }
  const j: any = await res.json().catch(() => null);
  if (res.ok && j?.success) return { ok: true, id: j.data?.message_id ?? undefined, status: res.status };
  const detail = j?.errors && typeof j.errors === 'object' ? Object.values(j.errors).join('; ') : '';
  const error = `${j?.message ?? `HTTP ${res.status}`}${detail ? `: ${detail}` : ''}`.slice(0, 300);
  // 401 token salah, 402 kredit habis, 403 domain pengirim belum aktif, 429 terlalu banyak gagal, 5xx gangguan:
  // email tetap di antrean dan dicoba lagi. 400/422 (alamat/isi salah) langsung gagal.
  const retry = [401, 402, 403, 429].includes(res.status) || res.status >= 500;
  return { ok: false, status: res.status, error, retry };
}

export async function mailketingCredits(): Promise<{ credits: number; account?: string } | { error: string }> {
  try {
    const res = await fetch(`${config.mailketingBaseUrl}/api/v2/credits`, {
      headers: { accept: 'application/json', authorization: `Bearer ${config.mailketingToken}` },
      signal: AbortSignal.timeout(15_000),
    });
    const j: any = await res.json().catch(() => null);
    if (res.ok && j?.success) return { credits: Number(j.data?.credits ?? 0), account: j.data?.email };
    if (res.status === 402) return { credits: 0 };
    return { error: j?.message ?? `HTTP ${res.status}` };
  } catch {
    return { error: 'Mailketing tidak bisa dihubungi' };
  }
}

/* ---------------- kunci untuk tautan berhenti langganan & webhook ---------------- */

let key: Buffer | null = null;
async function mailKey(db: Db) {
  if (key) return key;
  let row = await db.one<{ value: any }>(`select value from settings where key = 'mail_key'`);
  if (!row) {
    await db.query(`insert into settings (key, value) values ('mail_key', $1::text::jsonb) on conflict (key) do nothing`, [JSON.stringify({ key: randomBytes(32).toString('base64') })]);
    row = await db.one<{ value: any }>(`select value from settings where key = 'mail_key'`);
  }
  key = Buffer.from(row!.value.key, 'base64');
  return key;
}
const mac = (k: Buffer, s: string) => createHmac('sha256', k).update(s).digest('base64url');
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function unsubUrl(db: Db, userId: string) {
  return `${config.publicUrl}/api/email/unsubscribe?u=${userId}&t=${mac(await mailKey(db), 'unsub:' + userId).slice(0, 32)}`;
}
export async function checkUnsub(db: Db, userId: string, token: string) {
  return same(mac(await mailKey(db), 'unsub:' + userId).slice(0, 32), token);
}
/** Mailketing tidak menandatangani webhook, jadi URL-nya memuat kunci rahasia. */
export async function webhookPath(db: Db) {
  return `/api/email/mailketing/${mac(await mailKey(db), 'mailketing-webhook').slice(0, 32)}`;
}
export async function checkWebhookKey(db: Db, k: string) {
  return same(mac(await mailKey(db), 'mailketing-webhook').slice(0, 32), k);
}

/* ---------------- template ---------------- */

const INK = '#2B2F4A';
const UNSUB = '%%UNSUB%%';

function layout(o: { preheader: string; heading: string; body: string; cta?: { label: string; url: string }; footer: string }) {
  const icon = `${config.publicUrl}/icons/icon-192.png`;
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(o.heading)}</title></head>
<body style="margin:0;padding:0;background:#EEF3F0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${INK}">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(o.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF3F0;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
<tr><td style="padding:0 4px 12px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td><img src="${icon}" width="40" height="40" alt="" style="display:block;border-radius:10px"></td>
<td style="padding-left:10px;font-size:18px;font-weight:800;color:${INK}">Kampung Bulu</td></tr></table></td></tr>
<tr><td style="background:#FFFDF7;border:3px solid ${INK};border-radius:18px;padding:24px">
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:${INK}">${esc(o.heading)}</h1>
${o.body}
${o.cta ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px"><tr><td style="background:#F2B632;border:2.5px solid ${INK};border-radius:14px">
<a href="${esc(o.cta.url)}" style="display:inline-block;padding:12px 22px;font-size:16px;font-weight:800;color:${INK};text-decoration:none">${esc(o.cta.label)}</a></td></tr></table>` : ''}
</td></tr>
<tr><td style="padding:14px 6px;font-size:12.5px;line-height:1.5;color:#5F6478">${o.footer}</td></tr>
</table></td></tr></table></body></html>`;
}

const para = (s: string) => `<p style="margin:0 0 10px;font-size:16px;line-height:1.5">${esc(s)}</p>`;

export function otpEmail(code: string) {
  return {
    subject: `Kode masuk Kampung Bulu: ${code}`,
    html: layout({
      preheader: `Kode masukmu ${code}, berlaku 10 menit.`,
      heading: 'Kode masuk kamu',
      body: `<p style="margin:4px 0 14px;font-size:34px;font-weight:800;letter-spacing:8px;font-family:Menlo,Consolas,monospace">${esc(code)}</p>${para('Ketik kode ini di game. Kode berlaku 10 menit.')}`,
      footer: 'Abaikan email ini jika kamu tidak meminta kode. Jangan berikan kode ini ke siapa pun.',
    }),
  };
}

/** Email notifikasi. Tautan berhenti langganan diisi saat dikirim (berbeda per pemain). */
export function noteEmail(n: Note) {
  return {
    subject: n.title,
    html: layout({
      preheader: n.body,
      heading: n.title,
      body: para(n.body),
      cta: { label: 'Buka Kampung Bulu', url: config.publicUrl + (n.url && n.url.startsWith('/') ? n.url : '/') },
      footer: `Kamu menerima email ini karena akun Kampung Bulu-mu memakai alamat ini. <a href="${UNSUB}" style="color:#5F6478">Berhenti menerima email notifikasi</a>, atau atur di Pengaturan game.`,
    }),
  };
}

export function testEmail() {
  return {
    subject: 'Tes email Kampung Bulu',
    html: layout({
      preheader: 'Pengiriman email lewat Mailketing berjalan.',
      heading: 'Email berhasil terkirim',
      body: para('Kalau kamu membaca ini, pengiriman email lewat Mailketing sudah berjalan: kode masuk dan notifikasi pemain akan sampai.'),
      cta: { label: 'Buka admin', url: `${config.publicUrl}/admin/` },
      footer: 'Email uji dari halaman admin → Email.',
    }),
  };
}

/* ---------------- antrean ---------------- */

/** Alamat email pemain: dari login email dulu, lalu Google, lalu lainnya. */
export async function userEmail(db: Db, userId: string) {
  const r = await db.one<{ email: string }>(
    `select lower(email) as email from auth_identities where user_id = $1 and email is not null
      order by case provider when 'email' then 0 when 'google' then 1 else 2 end, created_at limit 1`,
    [userId],
  );
  return r?.email ?? null;
}

/** Awal hari ini (WIB) untuk menghitung batas email harian. */
function wibDayStart() {
  const wib = Date.now() + 7 * 3_600_000;
  return new Date(wib - (wib % 86_400_000) - 7 * 3_600_000);
}

/**
 * Masukkan notifikasi ke antrean email bila diizinkan: Mailketing aktif, jenis notifikasi dinyalakan admin,
 * pemain tidak mematikan email, alamat tidak bounce/berhenti langganan, dan belum melewati batas harian.
 */
export async function queueNoteEmail(db: Db, userId: string, n: Note, prefs: Record<string, any> | null | undefined) {
  if (!mailEnabled()) return null;
  const s = await getSettings(db);
  if (!s.email.enabled || !(s.email as any)[n.kind]) return null;
  if (prefs?.email === false) return null;
  const to = await userEmail(db, userId);
  if (!to) return null;
  if (await db.one(`select 1 from email_suppressions where email = $1`, [to])) return null;
  if (n.kind !== 'system') {
    const c = await db.one<{ c: number }>(
      `select count(*)::int c from email_outbox where user_id = $1 and kind not in ('otp','test','system') and created_at >= $2`,
      [userId, wibDayStart()],
    );
    if ((c?.c ?? 0) >= s.email.maxPerDay) return null;
  }
  const m = noteEmail(n);
  const r = await db.one<{ id: string }>(
    `insert into email_outbox (user_id, to_email, kind, subject, html) values ($1,$2,$3,$4,$5) returning id`,
    [userId, to, n.kind, m.subject, m.html],
  );
  return r ? Number(r.id) : null;
}

/** Antrekan satu email yang sama untuk banyak pemain (broadcast/event). Mengembalikan jumlah yang diantrekan. */
export async function queueNoteEmailMany(db: Db, userIds: string[], n: Note) {
  if (!mailEnabled() || !userIds.length) return 0;
  const s = await getSettings(db);
  if (!s.email.enabled) return 0;
  const m = noteEmail(n);
  let queued = 0;
  for (let i = 0; i < userIds.length; i += 500) {
    const rows = await db.query(
      `insert into email_outbox (user_id, to_email, kind, subject, html)
       select distinct on (u.id) u.id, lower(ai.email), $2, $3, $4
         from users u join auth_identities ai on ai.user_id = u.id and ai.email is not null
        where u.id = any($1::uuid[]) and u.banned_at is null
          and coalesce((u.notify_prefs->>'email')::boolean, true)
          and coalesce((u.notify_prefs->>$2)::boolean, true)
          and not exists (select 1 from email_suppressions x where x.email = lower(ai.email))
        order by u.id, case ai.provider when 'email' then 0 when 'google' then 1 else 2 end, ai.created_at
       returning id`,
      [userIds.slice(i, i + 500), n.kind, m.subject, m.html],
    );
    queued += rows.length;
  }
  return queued;
}

/** Jumlah pemain yang bisa menerima email (untuk perkiraan kredit di halaman broadcast). */
export async function emailableUsers(db: Db, where = 'true') {
  const r = await db.one<{ c: number }>(
    `select count(distinct u.id)::int c from users u join auth_identities ai on ai.user_id = u.id and ai.email is not null
      where u.banned_at is null and coalesce((u.notify_prefs->>'email')::boolean, true)
        and not exists (select 1 from email_suppressions x where x.email = lower(ai.email)) and ${where}`,
  );
  return r?.c ?? 0;
}

const BACKOFF_MIN = [2, 10, 30, 120, 360];
const MAX_ATTEMPTS = 6;

/**
 * Kirim email di antrean. Baris diklaim dulu (status `sending`) supaya tidak terkirim dua kali;
 * klaim yang macet lebih dari 10 menit diambil ulang. Bila kredit habis, sisa batch ditunda.
 */
export async function deliver(db: Db, opts: { ids?: number[]; limit?: number; log?: any } = {}) {
  if (!mailEnabled()) return { sent: 0, failed: 0, deferred: 0 };
  const claim = `status = 'sending', attempts = attempts + 1, next_at = now() + interval '10 minutes'`;
  const rows = opts.ids?.length
    ? await db.query(`update email_outbox set ${claim} where id = any($1::bigint[]) and status = 'queued' returning *`, [opts.ids])
    : await db.query(
        `update email_outbox set ${claim} where id in (
           select id from email_outbox where status in ('queued','sending') and next_at <= now() order by id limit $1 for update skip locked
         ) returning *`,
        [opts.limit ?? 300],
      );
  let sent = 0, failed = 0, deferred = 0, stop: string | null = null, last: SendResult | null = null;
  const queue = [...rows];
  const work = async () => {
    for (let r = queue.shift(); r; r = queue.shift()) {
      if (stop) {
        await db.query(`update email_outbox set status = 'queued', attempts = attempts - 1, next_at = now() + interval '15 minutes', error = $2 where id = $1`, [r.id, stop]);
        deferred++;
        continue;
      }
      const html = String(r.html ?? '').replace(UNSUB, r.user_id ? await unsubUrl(db, r.user_id) : config.publicUrl);
      const res = await mailketingSend(r.to_email, r.subject, html);
      last = res;
      if (res.ok) {
        await db.query(`update email_outbox set status = 'sent', sent_at = now(), message_id = $2, html = null, error = null where id = $1`, [r.id, res.id ?? null]);
        sent++;
      } else if (res.retry && r.attempts < MAX_ATTEMPTS) {
        if (res.status === 402 || res.status === 401 || res.status === 403) stop = res.error ?? 'ditunda';
        const wait = BACKOFF_MIN[Math.min(r.attempts - 1, BACKOFF_MIN.length - 1)];
        await db.query(`update email_outbox set status = 'queued', next_at = now() + ($2::int * interval '1 minute'), error = $3 where id = $1`, [r.id, wait, res.error]);
        deferred++;
      } else {
        await db.query(`update email_outbox set status = 'failed', html = null, error = $2 where id = $1`, [r.id, res.error]);
        failed++;
        opts.log?.warn?.({ id: r.id, kind: r.kind, err: res.error }, 'email gagal dikirim');
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, rows.length) }, work));
  if (last) {
    const l = last as SendResult;
    await db.query(
      `insert into settings (key, value) values ('mail_status', $1::text::jsonb) on conflict (key) do update set value = excluded.value`,
      [JSON.stringify({ at: new Date().toISOString(), ok: l.ok, status: l.status ?? null, error: l.ok ? null : l.error })],
    );
  }
  return { sent, failed, deferred };
}

/** Kode masuk: dikirim langsung (tidak lewat antrean karena hanya berlaku 10 menit). Isi email tidak disimpan. */
export async function sendOtp(db: Db, to: string, code: string, log: { info: (...a: any[]) => void; warn?: (...a: any[]) => void; error: (...a: any[]) => void }) {
  if (!mailEnabled()) {
    log.info({ to, code }, 'MAILKETING_API_TOKEN belum diisi: kode masuk hanya dicatat di log');
    return false;
  }
  const m = otpEmail(code);
  const res = await mailketingSend(to, m.subject, m.html);
  await db.query(
    `insert into email_outbox (to_email, kind, subject, status, attempts, message_id, error, sent_at) values ($1,'otp',$2,$3,1,$4,$5,$6)`,
    [to.toLowerCase(), 'Kode masuk Kampung Bulu', res.ok ? 'sent' : 'failed', res.id ?? null, res.ok ? null : res.error, res.ok ? new Date() : null],
  );
  if (!res.ok) log.error({ status: res.status, err: res.error }, 'gagal mengirim email kode masuk');
  return res.ok;
}
