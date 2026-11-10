import type { FastifyInstance } from 'fastify';
import { esc } from '@kb/shared';
import type { Db } from '../db/index';
import { config } from '../config';
import { bad, notFound } from '../lib/core';
import { audit, requireAdmin } from '../lib/auth';
import { email as vEmail } from '../lib/validate';
import { checkUnsub, checkWebhookKey, deliver, mailEnabled, mailFrom, mailketingCredits, testEmail, webhookPath } from '../lib/mail';

const UUID = /^[0-9a-f-]{36}$/i;

function page(title: string, body: string) {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>body{font-family:system-ui,sans-serif;background:#EEF3F0;color:#2B2F4A;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px}
main{background:#FFFDF7;border:3px solid #2B2F4A;border-radius:20px;box-shadow:0 5px 0 #2B2F4A;padding:24px;max-width:380px;width:100%}
h1{font-size:21px;margin:0 0 10px}p{margin:0 0 14px;line-height:1.5}button,a.b{display:inline-block;font:700 16px system-ui;padding:12px 18px;border-radius:14px;border:2.5px solid #2B2F4A;box-shadow:0 3px 0 #2B2F4A;cursor:pointer;background:#F2B632;color:#2B2F4A;text-decoration:none}</style>
</head><body><main><h1>${esc(title)}</h1>${body}</main></body></html>`;
}

export default async function emailRoutes(app: FastifyInstance, { db }: { db: Db }) {
  /* ---------------- berhenti langganan (tautan di setiap email notifikasi) ---------------- */
  // GET hanya menampilkan tombol konfirmasi: pemindai tautan di kotak masuk tidak ikut memberhentikan langganan.
  const target = (req: any) => {
    const u = String(req.query?.u ?? req.body?.u ?? '');
    const t = String(req.query?.t ?? req.body?.t ?? '');
    return { u, t };
  };
  app.get('/api/email/unsubscribe', async (req: any, reply) => {
    const { u, t } = target(req);
    reply.type('text/html; charset=utf-8');
    if (!UUID.test(u) || !(await checkUnsub(db, u, t))) return reply.code(400).send(page('Tautan tidak valid', '<p>Tautan ini rusak atau sudah tidak berlaku. Kamu tetap bisa mematikan email dari Pengaturan di game.</p>'));
    return page('Berhenti menerima email?', `<p>Kamu tidak akan menerima email notifikasi Kampung Bulu lagi. Kode masuk tetap dikirim saat kamu memintanya.</p>
<form method="post"><input type="hidden" name="u" value="${esc(u)}"><input type="hidden" name="t" value="${esc(t)}"><button>Berhenti berlangganan</button></form>`);
  });
  app.post('/api/email/unsubscribe', async (req: any, reply) => {
    const { u, t } = target(req);
    reply.type('text/html; charset=utf-8');
    if (!UUID.test(u) || !(await checkUnsub(db, u, t))) return reply.code(400).send(page('Tautan tidak valid', '<p>Tautan ini rusak atau sudah tidak berlaku.</p>'));
    await db.query(`update users set notify_prefs = notify_prefs || '{"email": false}'::jsonb where id = $1`, [u]);
    return page('Sudah berhenti', `<p>Email notifikasi dimatikan. Kamu bisa menyalakannya lagi kapan saja di Pengaturan game.</p><a class="b" href="${esc(config.publicUrl)}/">Buka Kampung Bulu</a>`);
  });

  /* ---------------- webhook Mailketing (Bounce & Unsubscribe) ---------------- */
  app.post('/api/email/mailketing/:key', async (req: any, reply) => {
    if (!(await checkWebhookKey(db, String(req.params.key)))) return reply.code(404).send({ ok: false });
    const b = req.body ?? {};
    const type = String(b.type ?? '');
    const addr = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
    if ((type === 'bounce' || type === 'unsubscribe') && addr.includes('@') && addr.length <= 254) {
      const detail = String(b.reason ?? '').slice(0, 200) || null;
      await db.query(
        `insert into email_suppressions (email, reason, detail) values ($1,$2,$3) on conflict (email) do update set reason = excluded.reason, detail = excluded.detail, created_at = now()`,
        [addr, type, detail],
      );
      if (type === 'bounce' && typeof b.message_id === 'string') {
        await db.query(`update email_outbox set error = $2 where message_id = $1`, [b.message_id, `bounce: ${detail ?? '-'}`]);
      }
      req.log.info({ type }, 'mailketing: alamat email ditandai tidak dikirimi lagi');
    }
    return { ok: true };
  });

  /* ---------------- admin ---------------- */
  const adm = { preHandler: requireAdmin(db, 'admin') };

  app.get('/api/admin/email', adm, async () => {
    const since = new Date(Date.now() - 86_400_000);
    const [stats, recent, supp, status] = await Promise.all([
      db.one(
        `select count(*) filter (where status in ('queued','sending'))::int queued,
                count(*) filter (where status = 'sent' and sent_at >= $1)::int sent24,
                count(*) filter (where status = 'failed' and created_at >= $1)::int failed24,
                (select count(*)::int from email_suppressions) suppressed
           from email_outbox`,
        [since],
      ),
      db.query(`select id, to_email, kind, subject, status, attempts, error, created_at, sent_at from email_outbox order by id desc limit 50`),
      db.query(`select email, reason, detail, created_at from email_suppressions order by created_at desc limit 100`),
      db.one<{ value: any }>(`select value from settings where key = 'mail_status'`),
    ]);
    const out: any = {
      enabled: mailEnabled(),
      from: mailFrom(),
      webhookUrl: config.publicUrl + (await webhookPath(db)),
      stats, recent, suppressions: supp, last: status?.value ?? null,
    };
    if (out.enabled) {
      const c = await mailketingCredits();
      if ('error' in c) out.creditsError = c.error;
      else out.credits = c.credits;
    }
    return out;
  });

  app.post('/api/admin/email/test', { ...adm, config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (req: any) => {
    if (!mailEnabled()) throw bad('mail_off', 'Isi MAILKETING_API_TOKEN di .env lalu restart server.');
    const to = vEmail(req.body?.to ?? req.admin!.email);
    const m = testEmail();
    const r = await db.one<{ id: string }>(`insert into email_outbox (to_email, kind, subject, html) values ($1,'test',$2,$3) returning id`, [to, m.subject, m.html]);
    await deliver(db, { ids: [Number(r!.id)], log: req.log });
    const row = await db.one<{ status: string; error: string | null; message_id: string | null }>(`select status, error, message_id from email_outbox where id = $1`, [r!.id]);
    await audit(db, req, 'email_test', to, { status: row?.status });
    if (row?.status !== 'sent') throw bad('mail_error', 'Mailketing menolak: ' + (row?.error ?? 'tidak diketahui'));
    return { ok: true, messageId: row.message_id };
  });

  app.delete('/api/admin/email/suppressions/:email', adm, async (req: any) => {
    const addr = String(req.params.email).toLowerCase();
    const r = await db.one(`delete from email_suppressions where email = $1 returning email`, [addr]);
    if (!r) throw notFound('Alamat tidak ada di daftar.');
    await audit(db, req, 'email_unsuppress', addr);
    return { ok: true };
  });

  /* Kirim ulang email notifikasi yang gagal dalam 24 jam terakhir (mis. setelah kredit diisi). */
  app.post('/api/admin/email/retry', adm, async (req: any) => {
    const rows = await db.query(
      `update email_outbox set status = 'queued', next_at = now(), attempts = 0, error = null
        where status = 'queued' and next_at > now() returning id`,
    );
    await audit(db, req, 'email_retry', String(rows.length));
    void deliver(db, { log: req.log }).catch(() => {});
    return { ok: true, requeued: rows.length };
  });
}
