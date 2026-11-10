// Admin → Pusat notifikasi: nyala/mati & saluran per jenis notifikasi, teks yang bisa diedit, pratinjau, kirim uji.
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import {
  NOTIFY_CHANNELS, NOTIFY_EVENT_BY_KEY, NOTIFY_EVENTS, NOTIFY_LOCKED, NOTIFY_SAMPLE, normalizePhone, renderText, resolveChannels, resolveTemplate,
  type NotifyTemplate,
} from '@kb/shared';
import type { Db } from '../db/index';
import { config } from '../config';
import { bad, notFound } from '../lib/core';
import { audit, requireAdmin } from '../lib/auth';
import { email as vEmail } from '../lib/validate';
import { getAllTemplates, getChannels, invalidateNotify } from '../lib/notify-config';
import { mailEnabled, noteEmail, otpEmail } from '../lib/mail';
import { maskPhone, waEnabled, waPayload, waSend } from '../lib/klikflow';
import { deliver } from '../lib/outbox';

const S = (v: unknown, name: string, max: number) => {
  if (typeof v !== 'string') throw bad('invalid', `${name} harus teks.`);
  if (v.length > max) throw bad('invalid', `${name} maksimal ${max} karakter.`);
  return v.replace(/\r\n/g, '\n');
};

/** Validasi kiriman editor; hanya field yang dikirim yang diambil. */
function cleanDraft(key: string, b: any): Partial<NotifyTemplate> {
  const def = NOTIFY_EVENT_BY_KEY[key];
  const out: Partial<NotifyTemplate> = {};
  if (b == null || typeof b !== 'object') return out;
  if ('enabled' in b) out.enabled = b.enabled === true;
  if (b.channels && typeof b.channels === 'object') {
    out.channels = {} as any;
    for (const c of NOTIFY_CHANNELS) if (c in b.channels && def.allowed.includes(c)) (out.channels as any)[c] = b.channels[c] === true;
  }
  if ('title' in b) out.title = S(b.title, 'Judul', 120);
  if ('body' in b) out.body = S(b.body, 'Isi', 600);
  if ('wa' in b) out.wa = S(b.wa, 'Teks WhatsApp', 2000);
  if ('waTemplate' in b) {
    out.waTemplate = S(b.waTemplate, 'Template WhatsApp', 512).trim();
    if (out.waTemplate && !/^[a-z0-9_]+$/.test(out.waTemplate)) throw bad('invalid', 'Nama template WhatsApp hanya huruf kecil, angka, dan garis bawah.');
  }
  if ('waLanguage' in b) out.waLanguage = S(b.waLanguage, 'Bahasa template', 10).trim();
  if ('waVars' in b) {
    if (!b.waVars || typeof b.waVars !== 'object' || Array.isArray(b.waVars)) throw bad('invalid', 'Variabel template harus berupa daftar isian.');
    const e = Object.entries(b.waVars);
    if (e.length > 20) throw bad('invalid', 'Maksimal 20 variabel template.');
    out.waVars = Object.fromEntries(e.map(([k, v]) => [S(k, 'Nama variabel', 40), S(v, 'Isi variabel', 300)]));
  }
  if (NOTIFY_LOCKED.includes(key)) {
    out.enabled = true;
    if (out.channels) for (const c of def.allowed) (out.channels as any)[c] = true;
  }
  return out;
}

/** Simpan hanya bagian yang berbeda dari bawaan, supaya perubahan bawaan di kode tetap terpakai. */
function diff(key: string, t: NotifyTemplate) {
  const base = resolveTemplate(NOTIFY_EVENT_BY_KEY[key], null);
  const o: any = {};
  for (const k of ['enabled', 'title', 'body', 'wa', 'waTemplate', 'waLanguage'] as const) if (t[k] !== base[k]) o[k] = t[k];
  const ch: any = {};
  for (const c of NOTIFY_CHANNELS) if (t.channels[c] !== base.channels[c]) ch[c] = t.channels[c];
  if (Object.keys(ch).length) o.channels = ch;
  if (JSON.stringify(t.waVars) !== JSON.stringify(base.waVars)) o.waVars = t.waVars;
  return o;
}

const sampleVars = (url: string) => ({ ...NOTIFY_SAMPLE, link: config.publicUrl + url });

export default async function notifyCenterRoutes(app: FastifyInstance, { db }: { db: Db }) {
  const mod = { preHandler: requireAdmin(db, 'moderator') };
  const adm = { preHandler: requireAdmin(db, 'admin') };

  app.get('/api/admin/notify', mod, async () => {
    const { templates, overrides } = await getAllTemplates(db);
    return {
      events: NOTIFY_EVENTS,
      locked: NOTIFY_LOCKED,
      templates,
      overrides,
      channels: await getChannels(db),
      providers: { email: mailEnabled(), whatsapp: waEnabled() },
    };
  });

  app.put('/api/admin/notify/templates/:key', adm, async (req: any) => {
    const key = String(req.params.key);
    const def = NOTIFY_EVENT_BY_KEY[key];
    if (!def) throw notFound('Jenis notifikasi tidak dikenal.');
    const { overrides } = await getAllTemplates(db);
    const d = cleanDraft(key, req.body);
    const merged = resolveTemplate(def, { ...(overrides[key] ?? {}), ...d, channels: { ...(overrides[key]?.channels ?? {}), ...(d.channels ?? {}) } });
    const value = diff(key, merged);
    if (Object.keys(value).length) {
      await db.query(
        `insert into notify_templates (key, value, updated_at, updated_by) values ($1, $2::text::jsonb, now(), $3)
         on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by`,
        [key, JSON.stringify(value), req.admin!.email],
      );
    } else await db.query(`delete from notify_templates where key = $1`, [key]);
    invalidateNotify();
    await audit(db, req, 'notify_template', key, value);
    return { ok: true, template: merged, override: value };
  });

  app.delete('/api/admin/notify/templates/:key', adm, async (req: any) => {
    const key = String(req.params.key);
    const def = NOTIFY_EVENT_BY_KEY[key];
    if (!def) throw notFound('Jenis notifikasi tidak dikenal.');
    await db.query(`delete from notify_templates where key = $1`, [key]);
    invalidateNotify();
    await audit(db, req, 'notify_template_reset', key);
    return { ok: true, template: resolveTemplate(def, null) };
  });

  /* Pratinjau dengan contoh isian; `draft` = isi editor yang belum disimpan. */
  app.post('/api/admin/notify/preview/:key', mod, async (req: any) => {
    const key = String(req.params.key);
    const def = NOTIFY_EVENT_BY_KEY[key];
    if (!def) throw notFound('Jenis notifikasi tidak dikenal.');
    const { overrides } = await getAllTemplates(db);
    const t = resolveTemplate(def, { ...(overrides[key] ?? {}), ...cleanDraft(key, req.body?.draft) });
    const v = sampleVars(def.url);
    const title = renderText(t.title, v), body = renderText(t.body, v);
    const email = key === 'login_code' ? otpEmail(title, body, NOTIFY_SAMPLE.kode) : noteEmail(title, body, def.url);
    const ch = await getChannels(db);
    const wa = waPayload(ch.whatsapp, '6281200000000', t, v, key === 'wa_verify' ? { otpCode: NOTIFY_SAMPLE.kode } : {});
    return { title, body, waText: renderText(t.wa, v), waPayload: 'error' in wa ? null : wa.payload, waError: 'error' in wa ? wa.error : null, emailSubject: email.subject, emailHtml: email.html };
  });

  /* Kirim uji ke alamat email / nomor WhatsApp admin, memakai isi editor saat ini. */
  app.post('/api/admin/notify/test/:key', { ...adm, config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async (req: any) => {
    const key = String(req.params.key);
    const def = NOTIFY_EVENT_BY_KEY[key];
    if (!def) throw notFound('Jenis notifikasi tidak dikenal.');
    const channel = req.body?.channel === 'whatsapp' ? 'whatsapp' : 'email';
    const { overrides } = await getAllTemplates(db);
    const t = resolveTemplate(def, { ...(overrides[key] ?? {}), ...cleanDraft(key, req.body?.draft) });
    const v = sampleVars(def.url);
    const title = renderText(t.title, v), body = renderText(t.body, v);
    if (channel === 'email') {
      if (!mailEnabled()) throw bad('mail_off', 'Mailketing belum disambungkan (MAILKETING_API_TOKEN).');
      const to = vEmail(req.body?.to ?? req.admin!.email);
      const m = key === 'login_code' ? otpEmail(title, body, NOTIFY_SAMPLE.kode) : noteEmail(`[Uji] ${title}`, body, def.url);
      const r = await db.one<{ id: string }>(`insert into outbox (channel, to_addr, kind, subject, body) values ('email',$1,'test',$2,$3) returning id`, [to, m.subject, m.html]);
      await deliver(db, { ids: [Number(r!.id)], log: req.log });
      const row = await db.one<{ status: string; error: string | null }>(`select status, error from outbox where id = $1`, [r!.id]);
      await audit(db, req, 'notify_test', key, { channel, status: row?.status });
      if (row?.status !== 'sent') throw bad('send_failed', 'Mailketing menolak: ' + (row?.error ?? 'tidak diketahui'));
      return { ok: true, to };
    }
    if (!waEnabled()) throw bad('wa_off', 'Klik Flow belum disambungkan (KLIKFLOW_API_KEY).');
    const phone = normalizePhone(req.body?.to);
    if (!phone) throw bad('invalid_phone', 'Nomor WhatsApp tidak valid.');
    const ch = await getChannels(db);
    const p = waPayload(ch.whatsapp, phone, t, v, key === 'wa_verify' ? { otpCode: NOTIFY_SAMPLE.kode } : {});
    if ('error' in p) throw bad('wa_error', p.error);
    const res = await waSend(p.payload, `kb-test-${randomUUID()}`);
    await db.query(
      `insert into outbox (channel, to_addr, kind, subject, status, attempts, message_id, error, sent_at) values ('whatsapp',$1,'test',$2,$3,1,$4,$5,$6)`,
      [phone, `[Uji] ${def.label}`, res.ok ? 'sent' : 'failed', res.id ?? null, res.ok ? null : res.error, res.ok ? new Date() : null],
    );
    await audit(db, req, 'notify_test', key, { channel, ok: res.ok });
    if (!res.ok) throw bad('send_failed', 'Klik Flow menolak: ' + res.error);
    return { ok: true, to: maskPhone(phone) };
  });

  /* Pengaturan saluran: email & WhatsApp nyala/mati, batas harian, jam tenang, nomor pengirim. */
  app.put('/api/admin/notify/channels', adm, async (req: any) => {
    const b = req.body ?? {};
    const cur = await getChannels(db);
    const int = (v: any, name: string, min: number, max: number, d: number) => {
      if (v === undefined) return d;
      const n = Number(v);
      if (!Number.isInteger(n) || n < min || n > max) throw bad('invalid', `${name} harus angka ${min}–${max}.`);
      return n;
    };
    const e = b.email ?? {}, w = b.whatsapp ?? {};
    const next = resolveChannels({
      email: {
        enabled: 'enabled' in e ? e.enabled === true : cur.email.enabled,
        maxPerDay: int(e.maxPerDay, 'Batas email per hari', 0, 50, cur.email.maxPerDay),
      },
      whatsapp: {
        enabled: 'enabled' in w ? w.enabled === true : cur.whatsapp.enabled,
        channel: w.channel === undefined ? cur.whatsapp.channel : w.channel === 'whatsapp_official' ? 'whatsapp_official' : 'whatsapp_qr',
        from: w.from === undefined ? cur.whatsapp.from : S(String(w.from ?? ''), 'Nomor pengirim', 40).trim(),
        maxPerDay: int(w.maxPerDay, 'Batas WhatsApp per hari', 0, 50, cur.whatsapp.maxPerDay),
        quietStart: int(w.quietStart, 'Jam tenang mulai', 0, 23, cur.whatsapp.quietStart),
        quietEnd: int(w.quietEnd, 'Jam tenang selesai', 0, 23, cur.whatsapp.quietEnd),
        verifyTemplate: w.verifyTemplate === undefined ? cur.whatsapp.verifyTemplate : S(String(w.verifyTemplate ?? ''), 'Template verifikasi', 512).trim(),
      },
    });
    await db.query(
      `insert into settings (key, value) values ('notify_channels', $1::text::jsonb) on conflict (key) do update set value = excluded.value`,
      [JSON.stringify(next)],
    );
    invalidateNotify();
    await audit(db, req, 'notify_channels', undefined, next);
    return { ok: true, channels: next };
  });
}
