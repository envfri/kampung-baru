import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Db } from '../db/index';
import { config } from '../config';
import { HttpError, friendCode, sha256, token, getSettings, today } from './core';

export const USER_COOKIE = 'kb_s';
export const ADMIN_COOKIE = 'kb_a';

export interface SessionUser {
  id: string;
  display_name: string;
  friend_code: string;
  is_guest: boolean;
  banned_at: Date | null;
  ban_reason: string | null;
}
export interface SessionAdmin {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'moderator';
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: SessionUser;
    admin?: SessionAdmin;
  }
}

const cookieOpts = (maxAgeSec: number, path = '/') => ({
  path,
  httpOnly: true,
  sameSite: 'lax' as const,
  // Secure hanya bila benar-benar disajikan lewat HTTPS. Memaksa Secure di origin http:// (mis. akses
  // lewat IP:8787 sebelum domain siap) membuat browser membuang cookie: login tampak berhasil tetapi
  // semua /api/* berikutnya 401 "Silakan masuk dulu". Ikuti skema PUBLIC_URL, bukan NODE_ENV.
  secure: config.publicUrl.startsWith('https://'),
  maxAge: maxAgeSec,
});

/* ---------------- user sessions ---------------- */

export async function createSession(db: Db, reply: FastifyReply, userId: string) {
  const t = token();
  const days = config.sessionDays;
  await db.query(`insert into sessions (token_hash, user_id, expires_at) values ($1,$2, now() + ($3::int * interval '1 day'))`, [sha256(t), userId, days]);
  reply.setCookie(USER_COOKIE, t, cookieOpts(days * 86400));
  return t;
}

export async function destroySession(db: Db, req: FastifyRequest, reply: FastifyReply) {
  const t = readToken(req, USER_COOKIE);
  if (t) await db.query('delete from sessions where token_hash = $1', [sha256(t)]);
  reply.clearCookie(USER_COOKIE, { path: '/' });
}

const readCookieToken = (req: FastifyRequest) => (req.cookies as Record<string, string | undefined>)[USER_COOKIE];

function readToken(req: FastifyRequest, cookie: string) {
  const c = (req.cookies as Record<string, string | undefined>)[cookie];
  if (c) return c;
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ')) return h.slice(7);
  return undefined;
}

export async function loadUser(db: Db, req: FastifyRequest, reply?: FastifyReply) {
  const t = readToken(req, USER_COOKIE);
  if (!t) return undefined;
  const u = await db.one<SessionUser & { last_seen_at: Date; session_expires: Date }>(
    `select u.id, u.display_name, u.friend_code, u.is_guest, u.banned_at, u.ban_reason, u.last_seen_at, s.expires_at as session_expires
       from sessions s join users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now()`,
    [sha256(t)],
  );
  // Sesi bergulir: selama dipakai, masa berlaku sesi & cookie diperpanjang (paling sering sehari sekali),
  // jadi pemain aktif (terutama akun tamu yang tidak punya cara masuk lain) tidak pernah terlempar keluar.
  if (u && reply && !u.banned_at) {
    const days = config.sessionDays;
    if (new Date(u.session_expires).getTime() < Date.now() + (days - 1) * 86_400_000) {
      await db.query(`update sessions set expires_at = now() + ($2::int * interval '1 day') where token_hash = $1`, [sha256(t), days]);
      if (readCookieToken(req) === t) reply.setCookie(USER_COOKIE, t, cookieOpts(days * 86400));
    }
  }
  if (u && Date.now() - new Date(u.last_seen_at).getTime() > 60_000) {
    await db.query('update users set last_seen_at = now() where id = $1', [u.id]);
    // satu baris "active" per hari untuk metrik DAU/retensi
    await db.query(
      `insert into analytics_events (user_id, name, props)
       select $1, 'active', jsonb_build_object('day', $2::text)
       where not exists (select 1 from analytics_events where user_id = $1 and name = 'active' and props->>'day' = $2)`,
      [u.id, today()],
    );
  }
  return u;
}

export function requireUser(db: Db) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const u = await loadUser(db, req, reply);
    if (!u) throw new HttpError(401, 'unauthorized', 'Silakan masuk dulu.');
    if (u.banned_at) throw new HttpError(403, 'banned', `Akun ini diblokir${u.ban_reason ? ': ' + u.ban_reason : '.'}`);
    req.user = u;
  };
}

/** Dompet, ruangan, dan barang awal pemain baru (juga dipakai saat cut-off peluncuran). */
export async function grantStarter(t: Db, userId: string, s: any, known?: Set<string>) {
  known ??= new Set((await t.query<{ id: string }>('select id from items')).map((r) => r.id));
  const start = s.economy;
  await t.query(`insert into wallets (user_id, coin, pearl) values ($1, 0, 0)`, [userId]);
  if (start.startCoins > 0) {
    await t.query(`update wallets set coin = $2 where user_id = $1`, [userId, start.startCoins]);
    await t.query(`insert into wallet_ledger (user_id, currency, delta, balance_after, reason) values ($1,'coin',$2,$2,'starter')`, [userId, start.startCoins]);
  }
  if (start.startPearls > 0) {
    await t.query(`update wallets set pearl = $2 where user_id = $1`, [userId, start.startPearls]);
    await t.query(`insert into wallet_ledger (user_id, currency, delta, balance_after, reason) values ($1,'pearl',$2,$2,'starter')`, [userId, start.startPearls]);
  }
  for (const [id, qty] of Object.entries(s.starter.inventory ?? {})) {
    if (known.has(id) && (qty as number) > 0) await t.query(`insert into inventory (user_id, item_id, qty) values ($1,$2,$3)`, [userId, id, qty]);
  }
  const layout = (s.starter.layout ?? []).filter((p: any) => known!.has(p.i));
  await t.query(`insert into rooms (user_id, layout, wall, floor) values ($1,$2,$3,$4)`, [
    userId,
    JSON.stringify(layout),
    known.has(s.starter.wall) ? s.starter.wall : null,
    known.has(s.starter.floor) ? s.starter.floor : null,
  ]);
}

/** Buat pemain baru beserta dompet, ruangan, dan barang awal. Pet dibuat saat setup. */
export async function createUser(db: Db, displayName: string, isGuest: boolean) {
  const s = await getSettings(db);
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = friendCode();
    const exists = await db.one('select 1 from users where friend_code = $1', [code]);
    if (exists) continue;
    return db.tx(async (t) => {
      const u = (await t.one<{ id: string }>(`insert into users (display_name, friend_code, is_guest) values ($1,$2,$3) returning id`, [displayName, code, isGuest]))!;
      await grantStarter(t, u.id, s);
      await t.query(`insert into analytics_events (user_id, name, props) values ($1, 'signup', $2)`, [u.id, { guest: isGuest }]);
      return u.id;
    });
  }
  throw new Error('Gagal membuat kode teman unik');
}

/* ---------------- admin sessions ---------------- */

export async function createAdminSession(db: Db, reply: FastifyReply, adminId: string) {
  const t = token();
  await db.query(`insert into admin_sessions (token_hash, admin_id, expires_at) values ($1,$2, now() + interval '12 hours')`, [sha256(t), adminId]);
  reply.setCookie(ADMIN_COOKIE, t, cookieOpts(12 * 3600, '/'));
}

export async function destroyAdminSession(db: Db, req: FastifyRequest, reply: FastifyReply) {
  const t = readToken(req, ADMIN_COOKIE);
  if (t) await db.query('delete from admin_sessions where token_hash = $1', [sha256(t)]);
  reply.clearCookie(ADMIN_COOKIE, { path: '/' });
}

export const ROLE_RANK = { moderator: 1, admin: 2, owner: 3 } as const;

/** Admin yang sedang login di browser yang sama (atau undefined). Tidak melempar error. */
export async function loadAdmin(db: Db, req: FastifyRequest) {
  const t = (req.cookies as Record<string, string | undefined>)[ADMIN_COOKIE];
  if (!t) return undefined;
  return (await db.one<SessionAdmin>(
    `select a.id, a.email, a.name, a.role from admin_sessions s join admins a on a.id = s.admin_id where s.token_hash = $1 and s.expires_at > now()`,
    [sha256(t)],
  )) ?? undefined;
}

export function requireAdmin(db: Db, min: keyof typeof ROLE_RANK = 'moderator') {
  return async (req: FastifyRequest) => {
    const t = (req.cookies as Record<string, string | undefined>)[ADMIN_COOKIE];
    if (!t) throw new HttpError(401, 'unauthorized', 'Silakan masuk sebagai admin.');
    const a = await db.one<SessionAdmin>(
      `select a.id, a.email, a.name, a.role from admin_sessions s join admins a on a.id = s.admin_id where s.token_hash = $1 and s.expires_at > now()`,
      [sha256(t)],
    );
    if (!a) throw new HttpError(401, 'unauthorized', 'Sesi admin berakhir. Silakan masuk lagi.');
    if (ROLE_RANK[a.role] < ROLE_RANK[min]) throw new HttpError(403, 'forbidden', 'Peran admin kamu tidak punya akses ke fitur ini.');
    req.admin = a;
  };
}

export async function audit(db: Db, req: FastifyRequest, action: string, target?: string, detail?: unknown) {
  await db.query(`insert into admin_audit (admin_id, admin_email, action, target, detail) values ($1,$2,$3,$4,$5)`, [
    req.admin?.id ?? null,
    req.admin?.email ?? null,
    action,
    target ?? null,
    detail === undefined ? null : JSON.stringify(detail),
  ]);
}
