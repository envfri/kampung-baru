import type { FastifyInstance } from 'fastify';
import { randomInt, randomUUID } from 'node:crypto';
import { normalizePhone } from '@kb/shared';
import type { Db } from '../db/index';
import { config } from '../config';
import { bad, forbidden, HttpError, sha256 } from '../lib/core';
import { audit, requireAdmin, requireUser } from '../lib/auth';
import { str } from '../lib/validate';
import { getChannels, getTemplate } from '../lib/notify-config';
import { kf, klikflowMode, klikflowSecrets, klikflowWebhookUrl, maskPhone, verifyKlikflow, waEnabled, waPayload, waSend } from '../lib/klikflow';
import { deliver, enqueue, wibDayStart } from '../lib/outbox';
import { varsFor } from '../lib/notify';

const kfErr = (e: any) => `${e?.message ?? e} (${e?.code ?? 'error'})`;

export default async function waRoutes(app: FastifyInstance, { db }: { db: Db }) {
  const auth = { preHandler: requireUser(db) };

  async function available() {
    return waEnabled() && (await getChannels(db)).whatsapp.enabled;
  }

  /* ---------------- pemain: sambungkan nomor WhatsApp ---------------- */

  app.post('/api/wa/start', { ...auth, config: { rateLimit: { max: 5, timeWindow: '10 minutes' } } }, async (req: any) => {
    if (!(await available())) throw forbidden('Notifikasi WhatsApp sedang tidak tersedia.');
    const u = req.user!;
    // akun tamu bisa dibuat tanpa batas: kode WhatsApp hanya untuk akun yang sudah disimpan (Google/email)
    if (u.is_guest) throw bad('guest', 'Simpan progres dulu (masuk dengan Google atau email) sebelum menyambungkan WhatsApp.');
    const phone = normalizePhone(req.body?.phone);
    if (!phone) throw bad('invalid_phone', 'Nomor WhatsApp tidak valid. Contoh: 0812 3456 7890.');
    const taken = await db.one(`select 1 from users where wa_phone = $1 and wa_verified_at is not null and id <> $2`, [phone, u.id]);
    if (taken) throw bad('phone_taken', 'Nomor ini sudah tersambung ke akun lain.');
    const prev = await db.one<{ created_at: Date }>(`select created_at from wa_otps where user_id = $1`, [u.id]);
    if (prev && Date.now() - new Date(prev.created_at).getTime() < 60_000) throw bad('otp_wait', 'Kode baru saja dikirim. Tunggu 1 menit sebelum meminta lagi.');
    // satu nomor tidak boleh dibanjiri kode dari banyak akun, dan ada batas harian untuk semua pemain
    const cnt = await db.one<{ per_phone: number; per_day: number }>(
      `select count(*) filter (where to_addr = $1 and created_at > now() - interval '24 hours')::int as per_phone,
              count(*) filter (where created_at >= $2)::int as per_day
         from outbox where channel = 'whatsapp' and kind = 'wa_verify'`,
      [phone, wibDayStart()],
    );
    if ((cnt?.per_phone ?? 0) >= 3) throw bad('otp_limit', 'Kode untuk nomor ini sudah dikirim 3 kali dalam 24 jam. Coba lagi besok.');
    const chCfg = await getChannels(db);
    if ((cnt?.per_day ?? 0) >= chCfg.whatsapp.verifyPerDay) throw bad('otp_limit', 'Penyambungan WhatsApp sedang ramai. Coba lagi besok.');

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const ch = await getChannels(db);
    const tpl = (await getTemplate(db, 'wa_verify'))!;
    const pet = await db.one<{ name: string }>(`select name from pets where user_id = $1`, [u.id]);
    const p = waPayload(ch.whatsapp, phone, tpl, varsFor({ display_name: u.display_name, pet: pet?.name ?? null }, '/', { kode: code }), { otpCode: code });
    if ('error' in p) throw bad('wa_error', 'WhatsApp belum siap: ' + p.error);
    await db.query(
      `insert into wa_otps (user_id, phone, code_hash, expires_at) values ($1,$2,$3, now() + interval '10 minutes')
       on conflict (user_id) do update set phone = excluded.phone, code_hash = excluded.code_hash, attempts = 0, expires_at = excluded.expires_at, created_at = now()`,
      [u.id, phone, sha256(`${u.id}:${phone}:${code}`)],
    );
    // kode dikirim langsung dan tidak disimpan di antrean
    const res = await waSend(p.payload, `kb-verify-${randomUUID()}`);
    await db.query(
      `insert into outbox (channel, user_id, to_addr, kind, subject, status, attempts, message_id, error, sent_at) values ('whatsapp',$1,$2,'wa_verify','Kode verifikasi',$3,1,$4,$5,$6)`,
      [u.id, phone, res.ok ? 'sent' : 'failed', res.id ?? null, res.ok ? null : res.error, res.ok ? new Date() : null],
    );
    if (!res.ok) {
      await db.query(`delete from wa_otps where user_id = $1`, [u.id]);
      req.log.warn({ code: res.code }, 'kode verifikasi WhatsApp gagal dikirim');
      const msg = res.code === 'test_number_required' ? 'Nomor ini belum terdaftar sebagai nomor uji di Klik Flow (mode uji).'
        : res.code === 'invalid_phone' ? 'Nomor ini tidak terdaftar di WhatsApp.'
        : res.code === 'contact_blocked' ? 'Nomor ini memblokir pesan dari kami.'
        : 'Kode gagal dikirim ke WhatsApp. Coba lagi sebentar.';
      throw bad('wa_failed', msg);
    }
    return { ok: true, phone: maskPhone(phone), ...(config.isProd ? {} : { devCode: code }) };
  });

  app.post('/api/wa/verify', { ...auth, config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async (req: any) => {
    const u = req.user!;
    const code = str(req.body?.code, 'Kode', { max: 10 })!.replace(/\D/g, '');
    const o = await db.one<{ phone: string; code_hash: string; attempts: number; expires_at: Date }>(`select * from wa_otps where user_id = $1`, [u.id]);
    if (!o || new Date(o.expires_at).getTime() < Date.now()) throw bad('otp_expired', 'Kode sudah kedaluwarsa. Minta kode baru.');
    if (o.attempts >= 5) throw bad('otp_locked', 'Terlalu banyak percobaan. Minta kode baru.');
    if (sha256(`${u.id}:${o.phone}:${code}`) !== o.code_hash) {
      await db.query(`update wa_otps set attempts = attempts + 1 where user_id = $1`, [u.id]);
      throw bad('otp_wrong', 'Kode salah.');
    }
    try {
      const r = await db.one<{ notify_prefs: any }>(
        `update users set wa_phone = $2, wa_verified_at = now(), notify_prefs = notify_prefs || '{"whatsapp": true}'::jsonb where id = $1 returning notify_prefs`,
        [u.id, o.phone],
      );
      await db.query(`delete from wa_otps where user_id = $1`, [u.id]);
      return { ok: true, wa: { phone: maskPhone(o.phone), verified: true }, prefs: r?.notify_prefs ?? {} };
    } catch (e: any) {
      if (e?.code === '23505') throw bad('phone_taken', 'Nomor ini sudah tersambung ke akun lain.');
      throw e;
    }
  });

  app.post('/api/wa/remove', auth, async (req: any) => {
    await db.query(`update users set wa_phone = null, wa_verified_at = null where id = $1`, [req.user!.id]);
    return { ok: true };
  });

  /* ---------------- webhook Klik Flow: status pesan & balasan STOP/MULAI ---------------- */

  async function reply(userId: string, phone: string, key: 'wa_stop' | 'wa_start', log: any) {
    const tpl = await getTemplate(db, key);
    if (!tpl?.enabled) return;
    const ch = await getChannels(db);
    const u = await db.one<{ display_name: string; pet: string | null }>(`select u.display_name, p.name as pet from users u left join pets p on p.user_id = u.id where u.id = $1`, [userId]);
    // pemain baru saja menulis: jendela 24 jam terbuka, jadi teks biasa boleh juga di WhatsApp Official
    const p = waPayload(ch.whatsapp, phone, tpl, varsFor(u ?? { display_name: '', pet: null }, '/', {}), { forceText: true });
    if ('error' in p) return;
    const id = await enqueue(db, { channel: 'whatsapp', userId, to: phone, kind: key, subject: tpl.title, body: JSON.stringify(p.payload) });
    void deliver(db, { ids: [id], log }).catch(() => {});
  }

  app.register(async (sub) => {
    sub.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
      (req as any).rawBody = body;
      try { done(null, JSON.parse((body as Buffer).toString('utf8'))); } catch (e: any) { e.statusCode = 400; done(e, undefined); }
    });
    sub.post('/api/wa/klikflow/webhook', { config: { rateLimit: false } }, async (req: any, res) => {
      const raw: Buffer | undefined = req.rawBody;
      if (!raw || !verifyKlikflow(req.headers['klikflow-signature'], raw, await klikflowSecrets(db))) {
        req.log.warn({ event: req.headers['klikflow-event-id'] }, 'klikflow: tanda tangan webhook tidak cocok');
        return res.code(400).send({ ok: false });
      }
      const ev = req.body ?? {};
      if (typeof ev.id !== 'string') return { ok: true };
      // id dicatat setelah diproses: bila pemrosesan gagal, kiriman ulang dari Klik Flow tetap diproses
      if (await db.one(`select 1 from webhook_events where id = $1`, [ev.id])) return { ok: true, duplicate: true };
      await db.query(
        `insert into settings (key, value) values ('wa_seen', $1::text::jsonb) on conflict (key) do update set value = excluded.value`,
        [JSON.stringify({ at: new Date().toISOString(), type: ev.type, test: !!ev.test })],
      );
      const d = ev.data ?? {};
      if (ev.type === 'message.status' && d.message_id != null) {
        const failed = d.status === 'failed';
        await db.query(
          `update outbox set delivery = $2, status = case when $3 then 'failed' else status end, error = case when $3 then $4 else error end
            where channel = 'whatsapp' and message_id = $1`,
          [String(d.message_id), String(d.status ?? '').slice(0, 20), failed, String(d.error ?? 'gagal terkirim').slice(0, 300)],
        );
      } else if (ev.type === 'message.received' && String(d.channel ?? '').startsWith('whatsapp')) {
        const text = String(d.text ?? '').trim().toLowerCase().replace(/[^a-z]/g, '');
        const phone = normalizePhone(d.from);
        const cmd = ['stop', 'berhenti', 'unsubscribe', 'unsub', 'matikan'].includes(text) ? 'stop' : ['mulai', 'start', 'nyalakan'].includes(text) ? 'start' : null;
        if (cmd && phone) {
          const u = await db.one<{ id: string }>(`select id from users where wa_phone = $1 and wa_verified_at is not null`, [phone]);
          if (u) {
            await db.query(`update users set notify_prefs = notify_prefs || $2::text::jsonb where id = $1`, [u.id, JSON.stringify({ whatsapp: cmd === 'start' })]);
            await reply(u.id, phone, cmd === 'stop' ? 'wa_stop' : 'wa_start', req.log);
          }
        }
      }
      await db.query(`insert into webhook_events (id, source) values ($1, 'klikflow') on conflict do nothing`, [ev.id]);
      return { ok: true };
    });
  });

  /* ---------------- admin ---------------- */
  const adm = { preHandler: requireAdmin(db, 'admin') };
  const own = { preHandler: requireAdmin(db, 'owner') };

  app.get('/api/admin/whatsapp', adm, async () => {
    const since = new Date(Date.now() - 86_400_000);
    const ch = await getChannels(db);
    const [stats, recent, hook, seen, last] = await Promise.all([
      db.one(
        `select count(*) filter (where status in ('queued','sending'))::int queued,
                count(*) filter (where status = 'sent' and sent_at >= $1)::int sent24,
                count(*) filter (where status = 'failed' and created_at >= $1)::int failed24,
                (select count(*)::int from users where wa_verified_at is not null) verified,
                (select count(*)::int from users where wa_verified_at is not null and (notify_prefs->>'whatsapp')::boolean is false) optedout
           from outbox where channel = 'whatsapp'`,
        [since],
      ),
      db.query(`select id, to_addr, kind, subject, status, attempts, error, delivery, created_at, sent_at, next_at from outbox where channel = 'whatsapp' order by id desc limit 50`),
      db.one<{ value: any }>(`select value from settings where key = 'klikflow_webhook'`),
      db.one<{ value: any }>(`select value from settings where key = 'wa_seen'`),
      db.one<{ value: any }>(`select value from settings where key = 'wa_status'`),
    ]);
    const out: any = {
      enabled: waEnabled(),
      mode: klikflowMode(),
      config: ch.whatsapp,
      webhookUrl: klikflowWebhookUrl(),
      secretSource: config.klikflowWebhookSecret ? 'env' : hook?.value?.secret ? 'db' : null,
      lastEvent: seen?.value ?? null,
      last: last?.value ?? null,
      stats,
      recent: recent.map((r: any) => ({ ...r, to_addr: maskPhone(r.to_addr) })),
    };
    if (!out.enabled) return out;
    const [me, chans, tpls] = await Promise.allSettled([kf('GET', '/api/v2/me'), kf('GET', '/api/v2/channels'), kf('GET', '/api/v2/templates')]);
    if (me.status === 'fulfilled') {
      const m: any = (me.value as any).data ?? {};
      out.key = { name: m.name, mode: m.mode, prefix: m.prefix, scopes: m.scopes ?? [] };
    } else out.error = kfErr(me.reason);
    if (chans.status === 'fulfilled') out.channels = (chans.value as any).data ?? [];
    else out.channelsError = kfErr(chans.reason);
    if (tpls.status === 'fulfilled') out.templates = ((tpls.value as any).data ?? []).map((t: any) => ({ name: t.name, language: t.language, category: t.category, status: t.status, body: t.body, sendable: t.sendable, variables: t.variables ?? [] }));
    else out.templatesError = kfErr(tpls.reason);
    return out;
  });

  /* Daftarkan URL webhook ke Klik Flow (butuh kunci live); secret disimpan di database. */
  app.post('/api/admin/whatsapp/webhook', own, async (req: any) => {
    if (!waEnabled()) throw bad('wa_off', 'Isi KLIKFLOW_API_KEY di .env lalu restart server.');
    const url = klikflowWebhookUrl();
    if (!url.startsWith('https://')) throw bad('wa_url', 'PUBLIC_URL harus https:// supaya Klik Flow bisa mengirim webhook.');
    let hook: any;
    try {
      const list: any = await kf('GET', '/api/v2/webhooks');
      // secret webhook lama tidak bisa dibaca lewat API: hapus lalu buat ulang
      for (const w of (list.data ?? []).filter((w: any) => w.url === url)) await kf('DELETE', `/api/v2/webhooks/${w.id}`);
      hook = ((await kf('POST', '/api/v2/webhooks', { url, events: ['message.status', 'message.received'], description: 'Kampung Bulu' }, `kb-hook-${randomUUID()}`)) as any).data;
    } catch (e: any) {
      if (e?.code === 'live_key_required') throw bad('wa_live', 'Webhook hanya bisa didaftarkan dengan kunci live (kf_live_…). Dengan kunci tes, status pesan tetap terlihat di riwayat.');
      throw bad('wa_error', 'Klik Flow menolak: ' + kfErr(e));
    }
    if (!hook?.secret) throw bad('wa_error', 'Klik Flow tidak mengembalikan secret webhook.');
    await db.query(
      `insert into settings (key, value) values ('klikflow_webhook', $1::text::jsonb) on conflict (key) do update set value = excluded.value`,
      [JSON.stringify({ id: hook.id, secret: hook.secret, url, at: new Date().toISOString() })],
    );
    let tested = false;
    try { await kf('POST', `/api/v2/webhooks/${hook.id}/test`, {}, `kb-hooktest-${randomUUID()}`); tested = true; } catch { /* tidak wajib */ }
    await audit(db, req, 'wa_webhook', String(hook.id), { url });
    return { ok: true, id: hook.id, tested };
  });

  /* Kirim ulang pesan WhatsApp yang tertunda (mis. setelah kuota/nomor aktif lagi). Jam tenang tetap dihormati. */
  app.post('/api/admin/whatsapp/retry', adm, async (req: any) => {
    const rows = await db.query(
      `update outbox set next_at = now(), attempts = 0, error = null
        where channel = 'whatsapp' and status = 'queued' and next_at > now() and error is not null returning id`,
    );
    await audit(db, req, 'wa_retry', String(rows.length));
    void deliver(db, { log: req.log }).catch(() => {});
    return { ok: true, requeued: rows.length };
  });

  app.post('/api/admin/whatsapp/unlink/:id', adm, async (req: any) => {
    if (!/^[0-9a-f-]{36}$/i.test(String(req.params.id))) throw bad('invalid', 'Pemain tidak valid.');
    const r = await db.one(`update users set wa_phone = null, wa_verified_at = null where id = $1 returning id`, [String(req.params.id)]);
    if (!r) throw new HttpError(404, 'not_found', 'Pemain tidak ditemukan.');
    await audit(db, req, 'wa_unlink', String(req.params.id));
    return { ok: true };
  });
}
