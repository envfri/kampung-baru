import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { randomInt, randomUUID } from 'node:crypto';
import type { Db } from '../db/index';
import { config } from '../config';
import { getSite } from '../lib/site';
import { socialLinks } from '@kb/shared';
import { zepayMode } from '../lib/zepay';
import { bad, forbidden, getSettings, sha256, track, HttpError } from '../lib/core';
import { createSession, createUser, destroySession, loadAdmin, loadUser, requireUser } from '../lib/auth';
import { mockLocked } from './payments';
import { playerState } from '../lib/state';
import { email as vEmail, str } from '../lib/validate';
import { mailEnabled, sendOtp } from '../lib/mail';
import { waEnabled } from '../lib/klikflow';
import { getChannels } from '../lib/notify-config';

let googleJwks: any = null;
const PROVIDER_NAME: Record<string, string> = { google: 'Google', email: 'Email', facebook: 'Facebook' };
/** Huruf kode pindah: tanpa I, O, 0, 1 supaya tidak tertukar saat diketik. */
const TRANSFER_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const normCode = (s: unknown) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/O/g, '0').replace(/I/g, '1');

export default async function authRoutes(app: FastifyInstance, { db }: { db: Db }) {
  /** Login dengan identitas pihak ketiga. Jika sedang login sebagai tamu, identitas ditautkan ke akun tamu itu. */
  /** Ringkasan akun untuk dialog konfirmasi pindah akun. */
  async function summary(userId: string) {
    const r = await db.one<any>(`select u.display_name, p.name as pet, p.level from users u left join pets p on p.user_id = u.id where u.id = $1`, [userId]);
    return { name: r?.display_name ?? 'Pemain', pet: r?.pet ?? null, level: r?.level ?? 1 };
  }
  /** Sedang login & mau pindah ke akun lain: minta konfirmasi dulu (akun tamu yang ditinggal tidak bisa dibuka lagi). */
  async function confirmSwitch(req: any, current: any, targetId: string, code: string, msg: string) {
    if (!current || current.id === targetId || req.body?.switch === true) return;
    throw bad(code, msg, { guest: !!current.is_guest, current: await summary(current.id), other: await summary(targetId) });
  }

  async function loginWithIdentity(req: FastifyRequest, reply: FastifyReply, provider: string, uid: string, mail: string | null, name: string) {
    const existing = await db.one<{ user_id: string }>(`select user_id from auth_identities where provider = $1 and provider_uid = $2`, [provider, uid]);
    const current = await loadUser(db, req);
    if (existing) {
      await confirmSwitch(req, current, existing.user_id, 'identity_in_use', `Akun ${PROVIDER_NAME[provider] ?? provider} ini sudah dipakai akun BUPI lain.`);
      const banned = await db.one<{ banned_at: Date | null; ban_reason: string | null }>('select banned_at, ban_reason from users where id = $1', [existing.user_id]);
      if (banned?.banned_at) throw forbidden(`Akun ini diblokir${banned.ban_reason ? ': ' + banned.ban_reason : '.'}`);
      if (!current || current.id !== existing.user_id) await createSession(db, reply, existing.user_id);
      await track(db, existing.user_id, 'login', { provider });
      return { userId: existing.user_id, switched: !!current && current.id !== existing.user_id };
    }
    if (current) {
      await db.query(`insert into auth_identities (provider, provider_uid, user_id, email) values ($1,$2,$3,$4)`, [provider, uid, current.id, mail]);
      if (current.is_guest) {
        await db.query(`update users set is_guest = false, display_name = case when display_name = 'Tamu' then $2 else display_name end where id = $1`, [current.id, name.slice(0, 24) || 'Pemain']);
        await track(db, current.id, 'guest_upgraded', { provider });
      }
      return { userId: current.id, linked: true };
    }
    const id = await createUser(db, name.slice(0, 24) || 'Pemain', false);
    await db.query(`insert into auth_identities (provider, provider_uid, user_id, email) values ($1,$2,$3,$4)`, [provider, uid, id, mail]);
    await createSession(db, reply, id);
    return { userId: id, created: true };
  }

  app.get('/api/config', async (req) => {
    const s = await getSettings(db);
    const site = await getSite(db);
    const f = s.features;
    return {
      login: {
        guest: f.guestLogin,
        email: f.emailLogin && (mailEnabled() || !config.isProd),
        google: f.googleLogin && config.googleClientId ? config.googleClientId : null,
        facebook: f.facebookLogin && config.facebookAppId ? config.facebookAppId : null,
        transfer: (s as any).account?.transferCodes !== false,
      },
      payments: f.payments && (!mockLocked() || (await loadAdmin(db, req))) ? config.paymentProvider : null,
      paymentsTest: config.paymentProvider === 'zepay' && zepayMode() === 'test',
      email: mailEnabled(),
      whatsapp: waEnabled() && (await getChannels(db)).whatsapp.enabled,
      midtransClientKey: config.paymentProvider === 'midtrans' ? config.midtransClientKey : null,
      midtransProduction: config.midtransProduction,
      social: socialLinks(site.social),
      // permintaan ini hanya lolos saat perawatan bila admin boleh lewat: game menampilkan penanda kecil
      maintenance: site.maintenance.on ? { bypass: true } : null,
    };
  });

  app.post('/api/auth/guest', { config: { rateLimit: { max: 60, timeWindow: '10 minutes' } } }, async (req, reply) => {
    const s = await getSettings(db);
    if (!s.features.guestLogin) throw forbidden('Main sebagai tamu sedang tidak tersedia.');
    const id = await createUser(db, 'Tamu', true);
    await db.query(`insert into auth_identities (provider, provider_uid, user_id) values ('guest', $1, $2)`, [randomUUID(), id]);
    await createSession(db, reply, id);
    return { ok: true, state: await playerState(db, id) };
  });

  app.post('/api/auth/email/start', { config: { rateLimit: { max: 5, timeWindow: '10 minutes' } } }, async (req: any) => {
    const s = await getSettings(db);
    if (!s.features.emailLogin || (config.isProd && !mailEnabled())) throw forbidden('Login email sedang tidak tersedia.');
    const mail = vEmail(req.body?.email);
    const prev = await db.one<{ created_at: Date }>(`select created_at from email_otps where email = $1`, [mail]);
    if (prev && Date.now() - new Date(prev.created_at).getTime() < 60_000) throw bad('otp_wait', 'Kode baru saja dikirim. Tunggu 1 menit sebelum meminta lagi.');
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await db.query(
      `insert into email_otps (email, code_hash, expires_at) values ($1,$2, now() + interval '10 minutes')
       on conflict (email) do update set code_hash = excluded.code_hash, attempts = 0, expires_at = excluded.expires_at, created_at = now()`,
      [mail, sha256(mail + ':' + code)],
    );
    const sent = await sendOtp(db, mail, code, req.log);
    if (!sent && mailEnabled()) {
      // jangan biarkan pemain menunggu email yang tidak akan datang; boleh langsung minta ulang
      await db.query(`delete from email_otps where email = $1`, [mail]);
      if (config.isProd) throw bad('mail_failed', 'Email kode masuk gagal dikirim. Periksa alamatnya atau coba lagi beberapa menit lagi.');
    }
    return { ok: true, sent, ...(config.isProd ? {} : { devCode: code }) };
  });

  app.post('/api/auth/email/verify', { config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async (req: any, reply) => {
    const mail = vEmail(req.body?.email);
    const code = str(req.body?.code, 'Kode', { min: 6, max: 6 })!;
    const row = await db.one<{ code_hash: string; attempts: number; expires_at: Date }>(`select * from email_otps where email = $1`, [mail]);
    if (!row || new Date(row.expires_at).getTime() < Date.now()) throw bad('otp_expired', 'Kode sudah kedaluwarsa. Minta kode baru.');
    if (row.attempts >= 5) throw bad('otp_locked', 'Terlalu banyak percobaan. Minta kode baru.');
    if (row.code_hash !== sha256(mail + ':' + code)) {
      await db.query(`update email_otps set attempts = attempts + 1 where email = $1`, [mail]);
      throw bad('otp_wrong', 'Kode salah. Periksa lagi email kamu.');
    }
    const r = await loginWithIdentity(req, reply, 'email', mail, mail, mail.split('@')[0]);
    await db.query(`delete from email_otps where email = $1`, [mail]);
    return { ok: true, ...r, state: await playerState(db, r.userId) };
  });

  app.post('/api/auth/google', { config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async (req: any, reply) => {
    if (!config.googleClientId) throw forbidden('Login Google belum dikonfigurasi.');
    const credential = str(req.body?.credential, 'Credential', { max: 4096 })!;
    const { createRemoteJWKSet, jwtVerify } = await import('jose');
    googleJwks ??= createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
    let payload: any;
    try {
      ({ payload } = await jwtVerify(credential, googleJwks, { issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: config.googleClientId }));
    } catch {
      throw bad('google_invalid', 'Login Google gagal diverifikasi. Coba lagi.');
    }
    const r = await loginWithIdentity(req, reply, 'google', String(payload.sub), payload.email_verified ? String(payload.email) : null, String(payload.given_name ?? payload.name ?? 'Pemain'));
    return { ok: true, ...r, state: await playerState(db, r.userId) };
  });

  app.post('/api/auth/facebook', { config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async (req: any, reply) => {
    if (!config.facebookAppId || !config.facebookAppSecret) throw forbidden('Login Facebook belum dikonfigurasi.');
    const at = str(req.body?.accessToken, 'Access token', { max: 2048 })!;
    const appToken = `${config.facebookAppId}|${config.facebookAppSecret}`;
    const dbg: any = await fetch(`https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(at)}&access_token=${encodeURIComponent(appToken)}`).then((r) => r.json()).catch(() => null);
    if (!dbg?.data?.is_valid || String(dbg.data.app_id) !== config.facebookAppId) throw bad('facebook_invalid', 'Login Facebook gagal diverifikasi.');
    const me: any = await fetch(`https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(at)}`).then((r) => r.json()).catch(() => null);
    if (!me?.id) throw bad('facebook_invalid', 'Login Facebook gagal diverifikasi.');
    const r = await loginWithIdentity(req, reply, 'facebook', String(me.id), me.email ?? null, String(me.name ?? 'Pemain').split(' ')[0]);
    return { ok: true, ...r, state: await playerState(db, r.userId) };
  });

  /* ---------- kode pindah perangkat ---------- */

  app.post('/api/auth/transfer', { preHandler: requireUser(db), config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (req: any) => {
    const s: any = await getSettings(db);
    if (!s.account.transferCodes) throw forbidden('Kode pindah perangkat sedang tidak tersedia.');
    const uid = req.user!.id;
    let code = '';
    for (let i = 0; i < 8; i++) code += TRANSFER_ABC[randomInt(0, TRANSFER_ABC.length)];
    const minutes = Math.max(1, Math.min(60, Number(s.account.transferMinutes) || 15));
    // satu kode aktif per akun: kode lama yang belum dipakai dibatalkan
    await db.query(`delete from transfer_codes where user_id = $1 and used_at is null`, [uid]);
    const row = await db.one<{ expires_at: Date }>(
      `insert into transfer_codes (code_hash, user_id, expires_at) values ($1,$2, now() + ($3::int * interval '1 minute')) returning expires_at`,
      [sha256('transfer:' + code), uid, minutes],
    );
    await track(db, uid, 'transfer_code', {});
    return { code: `${code.slice(0, 4)}-${code.slice(4)}`, expiresAt: new Date(row!.expires_at).getTime(), minutes };
  });

  app.post('/api/auth/transfer/redeem', { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (req: any, reply) => {
    const s: any = await getSettings(db);
    if (!s.account.transferCodes) throw forbidden('Kode pindah perangkat sedang tidak tersedia.');
    const code = normCode(req.body?.code);
    if (code.length !== 8) throw bad('transfer_invalid', 'Kode pindah terdiri dari 8 huruf/angka, mis. K7QM-2XPA.');
    const row = await db.one<{ user_id: string }>(
      `select user_id from transfer_codes where code_hash = $1 and used_at is null and expires_at > now()`, [sha256('transfer:' + code)]);
    if (!row) throw bad('transfer_invalid', 'Kode tidak cocok atau sudah kedaluwarsa. Buat kode baru di perangkat lama.');
    const target = await db.one<{ banned_at: Date | null; ban_reason: string | null }>('select banned_at, ban_reason from users where id = $1', [row.user_id]);
    if (target?.banned_at) throw forbidden(`Akun ini diblokir${target.ban_reason ? ': ' + target.ban_reason : '.'}`);
    const current = await loadUser(db, req);
    if (current?.id === row.user_id) throw bad('transfer_same', 'Kode ini untuk akun yang sedang kamu pakai di perangkat ini.');
    await confirmSwitch(req, current, row.user_id, 'transfer_confirm', 'Perangkat ini sedang memakai akun lain.');
    const used = await db.one(`update transfer_codes set used_at = now(), used_ip = $2 where code_hash = $1 and used_at is null returning 1`, [sha256('transfer:' + code), req.ip]);
    if (!used) throw bad('transfer_invalid', 'Kode ini baru saja dipakai. Buat kode baru di perangkat lama.');
    await createSession(db, reply, row.user_id);
    await track(db, row.user_id, 'transfer_used', { switched: !!current });
    return { ok: true, switched: !!current, transferred: true, state: await playerState(db, row.user_id) };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    await destroySession(db, req, reply);
    return { ok: true };
  });

  app.get('/api/me', { preHandler: requireUser(db) }, async (req) => playerState(db, req.user!.id));

  app.delete('/api/me', { preHandler: requireUser(db) }, async (req, reply) => {
    // hapus akun beserta semua datanya (hak pengguna untuk menghapus data)
    const confirm = (req.body as any)?.confirm;
    if (confirm !== 'HAPUS') throw new HttpError(400, 'confirm', 'Ketik HAPUS untuk mengonfirmasi.');
    await db.query('delete from users where id = $1', [req.user!.id]);
    reply.clearCookie('kb_s', { path: '/' });
    return { ok: true };
  });
}
