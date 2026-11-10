// Antrean pesan keluar (email lewat Mailketing, WhatsApp lewat Klik Flow) dengan percobaan ulang.
import { config } from '../config';
import type { Db } from '../db/index';
import { mailEnabled, mailketingSend, UNSUB, unsubUrl, type SendResult } from './mail';
import { waEnabled, waSend } from './klikflow';
import { CRITICAL_KEYS } from './notify-config';

export type OutChannel = 'email' | 'whatsapp';

/** Awal hari ini (WIB) untuk batas harian. */
export function wibDayStart(now = Date.now()) {
  const wib = now + 7 * 3_600_000;
  return new Date(wib - (wib % 86_400_000) - 7 * 3_600_000);
}

/** Bila sekarang jam tenang (WIB), kapan boleh mengirim lagi; null bila boleh sekarang. */
export function quietUntil(start: number, end: number, now = Date.now()): Date | null {
  if (start === end) return null;
  const hour = Math.floor(((now + 7 * 3_600_000) % 86_400_000) / 3_600_000);
  const inQuiet = start < end ? hour >= start && hour < end : hour >= start || hour < end;
  if (!inQuiet) return null;
  const day = wibDayStart(now).getTime();
  let t = day + end * 3_600_000;
  if (t <= now) t += 86_400_000;
  return new Date(t);
}

/** Sudah mencapai batas pesan (bukan penting) hari ini untuk saluran ini? */
export async function capReached(db: Db, userId: string, channel: OutChannel, max: number) {
  const r = await db.one<{ c: number }>(
    `select count(*)::int c from outbox where user_id = $1 and channel = $2 and created_at >= $3 and kind <> all($4::text[])`,
    [userId, channel, wibDayStart(), CRITICAL_KEYS],
  );
  return (r?.c ?? 0) >= max;
}

export async function enqueue(db: Db, m: { channel: OutChannel; userId: string | null; to: string; kind: string; subject: string; body: string; nextAt?: Date | null }) {
  const r = await db.one<{ id: string }>(
    `insert into outbox (channel, user_id, to_addr, kind, subject, body, next_at) values ($1,$2,$3,$4,$5,$6, coalesce($7, now())) returning id`,
    [m.channel, m.userId, m.to, m.kind, m.subject, m.body, m.nextAt ?? null],
  );
  return Number(r!.id);
}

const BACKOFF_MIN = [2, 10, 30, 120, 360];
const MAX_ATTEMPTS = 6;

/**
 * Kirim pesan di antrean. Baris diklaim dulu (status `sending`) supaya tidak terkirim dua kali;
 * klaim yang macet lebih dari 10 menit diambil ulang. Masalah akun (kredit habis, kunci salah, nomor dijeda)
 * menunda sisa batch saluran itu.
 */
export async function deliver(db: Db, opts: { ids?: number[]; limit?: number; log?: any } = {}) {
  const live = [mailEnabled() ? 'email' : null, waEnabled() ? 'whatsapp' : null].filter(Boolean) as string[];
  if (!live.length) return { sent: 0, failed: 0, deferred: 0 };
  const claim = `status = 'sending', attempts = attempts + 1, next_at = now() + interval '10 minutes'`;
  const rows = opts.ids?.length
    ? await db.query(`update outbox set ${claim} where id = any($1::bigint[]) and status = 'queued' and channel = any($2::text[]) returning *`, [opts.ids, live])
    : await db.query(
        `update outbox set ${claim} where id in (
           select id from outbox where status in ('queued','sending') and next_at <= now() and channel = any($2::text[])
           order by id limit $1 for update skip locked
         ) returning *`,
        [opts.limit ?? 300, live],
      );
  let sent = 0, failed = 0, deferred = 0;
  const stop: Record<string, string | null> = { email: null, whatsapp: null };
  const last: Record<string, SendResult | null> = { email: null, whatsapp: null };
  const queue = [...rows];
  const work = async () => {
    for (let r = queue.shift(); r; r = queue.shift()) {
      if (stop[r.channel]) {
        await db.query(`update outbox set status = 'queued', attempts = attempts - 1, next_at = now() + interval '15 minutes', error = $2 where id = $1`, [r.id, stop[r.channel]]);
        deferred++;
        continue;
      }
      let res: SendResult & { stop?: boolean };
      if (r.channel === 'email') {
        const html = String(r.body ?? '').replace(UNSUB, r.user_id ? await unsubUrl(db, r.user_id) : config.publicUrl);
        res = await mailketingSend(r.to_addr, r.subject, html);
        if (!res.ok && [401, 402, 403].includes(res.status ?? 0)) res.stop = true;
      } else {
        let payload: any;
        try { payload = JSON.parse(r.body ?? ''); } catch { payload = null; }
        res = payload ? await waSend(payload, `kb-out-${r.id}`) : { ok: false, error: 'isi pesan rusak' };
      }
      last[r.channel] = res;
      if (res.ok) {
        await db.query(`update outbox set status = 'sent', sent_at = now(), message_id = $2, body = null, error = null where id = $1`, [r.id, res.id ?? null]);
        sent++;
      } else if (res.retry && r.attempts < MAX_ATTEMPTS) {
        if (res.stop) stop[r.channel] = res.error ?? 'ditunda';
        const wait = BACKOFF_MIN[Math.min(r.attempts - 1, BACKOFF_MIN.length - 1)];
        await db.query(`update outbox set status = 'queued', next_at = now() + ($2::int * interval '1 minute'), error = $3 where id = $1`, [r.id, wait, res.error]);
        deferred++;
      } else {
        await db.query(`update outbox set status = 'failed', body = null, error = $2 where id = $1`, [r.id, res.error]);
        failed++;
        opts.log?.warn?.({ id: r.id, channel: r.channel, kind: r.kind, err: res.error }, 'pesan gagal dikirim');
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, rows.length) }, work));
  for (const ch of ['email', 'whatsapp'] as const) {
    const l = last[ch];
    if (!l) continue;
    await db.query(
      `insert into settings (key, value) values ($1, $2::text::jsonb) on conflict (key) do update set value = excluded.value`,
      [ch === 'email' ? 'mail_status' : 'wa_status', JSON.stringify({ at: new Date().toISOString(), ok: l.ok, status: l.status ?? null, error: l.ok ? null : l.error })],
    );
  }
  return { sent, failed, deferred };
}
