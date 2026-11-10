import type { FastifyInstance } from 'fastify';
import { randomBytes, randomUUID } from 'node:crypto';
import { builtinCatalog, DEFAULT_SETTINGS, mergeSettings, SETTINGS_HELP, QUEST_EVENTS, QUEST_LINKS, EVENT_DECOR, EVENT_POINT_SOURCES, EVENT_TEMPLATES } from '@kb/shared';
import { invalidateQuests } from '../lib/quests';
import type { Db } from '../db/index';
import { config } from '../config';
import {
  addItem, bad, bumpCatalog, credit, forbidden, getSettings, hashPassword, HttpError, invalidateBanned,
  invalidateCaches, notFound, today, verifyPassword,
} from '../lib/core';
import { audit, createAdminSession, destroyAdminSession, requireAdmin } from '../lib/auth';
import { J, petView } from '../lib/state';
import { bool, email as vEmail, int, isoDate, obj, oneOf, str } from '../lib/validate';
import { markPaid } from './payments';
import { applyZepay, pick, syncZepay } from '../lib/payments';
import { zepay, zepayConfigured, zepayMode, zepayWebhookUrl, ZePayError, type ZePayment } from '../lib/zepay';

const zErr = (e: unknown) => (e instanceof ZePayError ? `${e.message} (${e.code})` : String((e as any)?.message ?? e));

const KINDS = ['food', 'furniture', 'wear', 'wallpaper', 'floor', 'seed', 'fish', 'material'] as const;
const LOC_KINDS = ['home', 'shop', 'social', 'garden', 'race', 'pond', 'pearl', 'games'] as const;
const ID = /^[a-z0-9][a-z0-9-]{1,47}$/;
const UUID = /^[0-9a-f-]{36}$/i;
const MIME = ['image/png', 'image/webp', 'image/jpeg', 'image/svg+xml'];

function slug(v: unknown, name = 'ID') {
  const s = str(v, name, { max: 48 })!.toLowerCase();
  if (!ID.test(s)) throw bad('invalid_id', `${name} hanya boleh huruf kecil, angka, dan tanda hubung (2–48 karakter).`);
  return s;
}

function cleanArt(v: any) {
  const a = obj(v, 'Gambar');
  if (a.type === 'image') {
    const url = str(a.url, 'URL gambar', { max: 500 })!;
    if (!/^(\/media\/[\w.-]+|https:\/\/[^\s"'<>]+)$/.test(url)) throw bad('invalid_art', 'URL gambar harus dari Media atau https://');
    const out: any = { type: 'image', url };
    if (a.w !== undefined && a.w !== '') out.w = int(a.w, 'Lebar gambar', { min: 8, max: 400 });
    if (a.h !== undefined && a.h !== '') out.h = int(a.h, 'Tinggi gambar', { min: 8, max: 400 });
    return out;
  }
  const key = str(a.key, 'Bentuk bawaan', { max: 40 })!;
  const colors: Record<string, string> = {};
  for (const [k, c] of Object.entries(obj(a.colors, 'Warna'))) if (typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c)) colors[k] = c;
  const params: Record<string, number> = {};
  for (const [k, n] of Object.entries(obj(a.params, 'Parameter'))) if (typeof n === 'number' && Number.isFinite(n)) params[k] = n;
  return { type: 'builtin', key, colors, ...(Object.keys(params).length ? { params } : {}) };
}

function cleanItemData(kind: string, v: any) {
  const d = obj(v, 'Data');
  const num = (x: any, name: string, min: number, max: number, def?: number) => (x === undefined || x === '' ? def : int(Math.round(Number(x)), name, { min, max }));
  switch (kind) {
    case 'food': {
      const e = obj(d.effects, 'Efek');
      const effects: Record<string, number> = {};
      for (const k of ['kenyang', 'bersih', 'ceria', 'energi']) if (e[k] !== undefined && e[k] !== '' && Number(e[k]) !== 0) effects[k] = num(e[k], `Efek ${k}`, -100, 100)!;
      return { effects };
    }
    case 'furniture':
      return { w: num(d.w, 'Lebar', 1, 4, 1), d: num(d.d, 'Panjang', 1, 4, 1), ...(bool(d.flat) ? { flat: true } : {}) };
    case 'wear':
      return { slot: oneOf(d.slot ?? 'head', 'Bagian', ['head', 'face', 'neck', 'back'] as const) };
    case 'seed':
      return { growMinutes: num(d.growMinutes, 'Lama tumbuh', 1, 10080, 30), yieldItem: slug(d.yieldItem, 'Hasil panen'), yieldQty: num(d.yieldQty, 'Jumlah panen', 1, 50, 1) };
    case 'fish':
    case 'material': {
      const out: any = {};
      if (d.fishWeight !== undefined && d.fishWeight !== '' && Number(d.fishWeight) > 0) {
        out.fishWeight = num(d.fishWeight, 'Peluang di kolam', 1, 1000);
        out.minCm = num(d.minCm, 'Ukuran min', 1, 500, 10);
        out.maxCm = Math.max(out.minCm, num(d.maxCm, 'Ukuran maks', 1, 500, 20)!);
      }
      return out;
    }
    default:
      return {};
  }
}

/** Pastikan nilai pengaturan tetap bertipe sama dengan default (angka tetap angka, dst). */
function sanitizeSettings(def: any, v: any, path = ''): any {
  if (Array.isArray(def)) {
    if (!Array.isArray(v)) throw bad('invalid_settings', `${path} harus berupa daftar.`);
    if (def.length && typeof def[0] === 'number') return v.map((x, i) => { const n = Number(x); if (!Number.isFinite(n)) throw bad('invalid_settings', `${path}[${i}] harus angka.`); return n; });
    return v;
  }
  if (def && typeof def === 'object') {
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw bad('invalid_settings', `${path || 'Pengaturan'} harus objek.`);
    const out: any = {};
    const keys = path.endsWith('inventory') ? Object.keys(v) : Object.keys(def);
    for (const k of keys) out[k] = k in v ? (k in def ? sanitizeSettings(def[k], v[k], path ? `${path}.${k}` : k) : v[k]) : def[k];
    if (path.endsWith('inventory')) for (const k of Object.keys(out)) out[k] = Math.max(0, Math.round(Number(out[k]) || 0));
    return out;
  }
  if (typeof def === 'number') { const n = Number(v); if (!Number.isFinite(n)) throw bad('invalid_settings', `${path} harus angka.`); return n; }
  if (typeof def === 'boolean') return v === true || v === 'true';
  if (typeof def === 'string') return String(v ?? '');
  return v;
}

export async function ensureAdmin(db: Db, log: { info: (...a: any[]) => void; warn: (...a: any[]) => void }) {
  const n = (await db.one<{ c: number }>('select count(*)::int as c from admins'))!.c;
  if (n > 0) return;
  let mail = config.adminEmail, pw = config.adminPassword;
  if (!mail || !pw) {
    if (config.isProd) {
      log.warn('Belum ada admin. Isi ADMIN_EMAIL dan ADMIN_PASSWORD lalu restart server.');
      return;
    }
    mail = 'admin@kampungbulu.local';
    pw = randomBytes(9).toString('base64url');
    log.warn({ email: mail, password: pw }, 'Admin pengembangan dibuat. Simpan password ini.');
  }
  await db.query(`insert into admins (email, name, password_hash, role) values ($1,$2,$3,'owner')`, [mail.toLowerCase(), 'Pemilik', await hashPassword(pw)]);
  log.info({ email: mail }, 'Admin pemilik dibuat');
}

export default async function adminRoutes(app: FastifyInstance, { db }: { db: Db }) {
  const mod = { preHandler: requireAdmin(db, 'moderator') };
  const adm = { preHandler: requireAdmin(db, 'admin') };
  const own = { preHandler: requireAdmin(db, 'owner') };

  /* ---------------- sesi ---------------- */

  app.post('/api/admin/login', { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (req: any, reply) => {
    const mail = vEmail(req.body?.email);
    const pw = str(req.body?.password, 'Password', { max: 200 })!;
    const a = await db.one<{ id: string; password_hash: string }>(`select id, password_hash from admins where email = $1`, [mail]);
    if (!a || !(await verifyPassword(pw, a.password_hash))) throw new HttpError(401, 'bad_login', 'Email atau password salah.');
    await db.query(`update admins set last_login_at = now() where id = $1`, [a.id]);
    await createAdminSession(db, reply, a.id);
    await db.query(`insert into admin_audit (admin_id, admin_email, action) values ($1,$2,'login')`, [a.id, mail]);
    return { ok: true };
  });

  app.post('/api/admin/logout', async (req, reply) => {
    await destroyAdminSession(db, req, reply);
    return { ok: true };
  });

  app.get('/api/admin/me', mod, async (req) => ({
    admin: req.admin,
    builtins: builtinCatalog(),
    kinds: KINDS,
    locationKinds: LOC_KINDS,
    settingsHelp: SETTINGS_HELP,
    paymentProvider: config.paymentProvider,
  }));

  app.post('/api/admin/password', mod, async (req: any) => {
    const cur = str(req.body?.current, 'Password lama', { max: 200 })!;
    const next = str(req.body?.next, 'Password baru', { min: 10, max: 200 })!;
    const a = await db.one<{ password_hash: string }>(`select password_hash from admins where id = $1`, [req.admin!.id]);
    if (!a || !(await verifyPassword(cur, a.password_hash))) throw bad('bad_password', 'Password lama salah.');
    await db.query(`update admins set password_hash = $2 where id = $1`, [req.admin!.id, await hashPassword(next)]);
    await audit(db, req, 'password_change');
    return { ok: true };
  });

  /* ---------------- dasbor ---------------- */

  app.get('/api/admin/stats', mod, async () => {
    const d = today();
    const one = async (sql: string, p: unknown[] = []) => (await db.one<{ v: number }>(sql, p))?.v ?? 0;
    const [users, guests, newToday, new7, dau, wau, coins, pearls, revenue, revenue30, paidCount] = await Promise.all([
      one(`select count(*)::int v from users`),
      one(`select count(*)::int v from users where is_guest`),
      one(`select count(*)::int v from users where created_at > now() - interval '1 day'`),
      one(`select count(*)::int v from users where created_at > now() - interval '7 days'`),
      one(`select count(distinct user_id)::int v from analytics_events where name = 'active' and props->>'day' = $1`, [d]),
      one(`select count(distinct user_id)::int v from analytics_events where name = 'active' and created_at > now() - interval '7 days'`),
      one(`select coalesce(sum(coin),0)::bigint::float8 v from wallets`),
      one(`select coalesce(sum(pearl),0)::bigint::float8 v from wallets`),
      one(`select coalesce(sum(amount_idr),0)::bigint::float8 v from payments where status = 'paid'`),
      one(`select coalesce(sum(amount_idr),0)::bigint::float8 v from payments where status = 'paid' and paid_at > now() - interval '30 days'`),
      one(`select count(*)::int v from payments where status = 'paid'`),
    ]);
    const d1 = await db.one<{ cohort: number; back: number }>(
      `with c as (select id from users where created_at >= date_trunc('day', now() - interval '1 day') and created_at < date_trunc('day', now()))
       select (select count(*)::int from c) cohort,
              (select count(distinct a.user_id)::int from analytics_events a join c on c.id = a.user_id where a.name = 'active' and a.props->>'day' = $1) back`,
      [d],
    );
    const funnel = await db.query<{ name: string; users: number }>(
      `select name, count(distinct user_id)::int users from analytics_events
        where created_at > now() - interval '30 days' and name in ('signup','pet_created','action','purchase','visit','race','fish','payment_paid')
        group by name`,
    );
    const series = await db.query(
      `select to_char(day, 'YYYY-MM-DD') as day,
              (select count(distinct user_id)::int from analytics_events a where a.name = 'active' and a.props->>'day' = to_char(day, 'YYYY-MM-DD')) dau,
              (select count(*)::int from users u where u.created_at >= day and u.created_at < day + interval '1 day') signups,
              (select coalesce(sum(amount_idr),0)::bigint::float8 from payments p where p.status = 'paid' and p.paid_at >= day and p.paid_at < day + interval '1 day') revenue
         from generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') day order by day`,
    );
    const topItems = await db.query(
      `select props->>'itemId' item, count(*)::int n from analytics_events where name = 'purchase' and created_at > now() - interval '7 days' group by 1 order by 2 desc limit 8`,
    );
    return {
      users, guests, newToday, new7, dau, wau, coins, pearls, revenue, revenue30, paidCount,
      d1: { cohort: d1?.cohort ?? 0, back: d1?.back ?? 0 },
      funnel: Object.fromEntries(funnel.map((f) => [f.name, f.users])),
      series, topItems,
    };
  });

  /* ---------------- item ---------------- */

  app.get('/api/admin/items', mod, async () => ({
    items: await db.query(
      `select i.*, (select coalesce(sum(qty),0)::int from inventory v where v.item_id = i.id) as owned from items i order by i.sort, i.id`,
    ),
  }));

  async function writeItem(req: any, id: string, creating: boolean) {
    const b = obj(req.body, 'body');
    const kind = oneOf(b.kind, 'Jenis', KINDS);
    const shop = b.shop ? slug(b.shop, 'Toko') : null;
    if (shop && !(await db.one('select 1 from locations where id = $1', [shop]))) throw bad('invalid_shop', 'Toko tidak ditemukan.');
    const eventId = b.event_id ? slug(b.event_id, 'Event') : null;
    if (eventId && !(await db.one('select 1 from events where id = $1', [eventId]))) throw bad('invalid_event', 'Event tidak ditemukan.');
    const data = cleanItemData(kind, b.data);
    if (kind === 'seed' && !(await db.one('select 1 from items where id = $1', [data.yieldItem]))) throw bad('invalid_yield', 'Item hasil panen tidak ditemukan.');
    const vals = [
      id, kind, str(b.name, 'Nama', { min: 2, max: 60 }), str(b.description, 'Deskripsi', { max: 200, optional: true }) ?? '',
      int(b.price_coin, 'Harga koin', { min: 0, max: 1_000_000, def: 0 }), int(b.price_pearl, 'Harga Mutiara', { min: 0, max: 100_000, def: 0 }),
      int(b.sell_coin, 'Harga jual', { min: 0, max: 1_000_000, def: 0 }), shop, J(cleanArt(b.art)), J(data), eventId,
      isoDate(b.available_from, 'Mulai dijual', true), isoDate(b.available_to, 'Selesai dijual', true), bool(b.active, true), int(b.sort, 'Urutan', { min: -100000, max: 100000, def: 0 }),
    ];
    if (creating) {
      if (await db.one('select 1 from items where id = $1', [id])) throw bad('exists', 'ID item sudah dipakai.');
      await db.query(
        `insert into items (id, kind, name, description, price_coin, price_pearl, sell_coin, shop, art, data, event_id, available_from, available_to, active, sort)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9::text::jsonb,$10::text::jsonb,$11,$12,$13,$14,$15)`, vals);
    } else {
      const r = await db.one(
        `update items set kind=$2, name=$3, description=$4, price_coin=$5, price_pearl=$6, sell_coin=$7, shop=$8, art=$9::text::jsonb, data=$10::text::jsonb,
                event_id=$11, available_from=$12, available_to=$13, active=$14, sort=$15, updated_at=now() where id=$1 returning id`, vals);
      if (!r) throw notFound('Item tidak ditemukan.');
    }
    await bumpCatalog(db);
    await audit(db, req, creating ? 'item_create' : 'item_update', id, b);
    return { ok: true, item: await db.one('select * from items where id = $1', [id]) };
  }
  app.post('/api/admin/items', adm, async (req: any) => writeItem(req, slug(req.body?.id), true));
  app.put('/api/admin/items/:id', adm, async (req: any) => writeItem(req, slug(req.params.id), false));
  app.delete('/api/admin/items/:id', adm, async (req: any) => {
    const id = slug(req.params.id);
    const used = await db.one<{ c: number }>(
      `select ((select count(*) from inventory where item_id = $1 and qty > 0) + (select count(*) from rooms where layout @> jsonb_build_array(jsonb_build_object('i', $1::text))))::int c`,
      [id],
    );
    if (used && used.c > 0) {
      await db.query(`update items set active = false, updated_at = now() where id = $1`, [id]);
      await bumpCatalog(db);
      await audit(db, req, 'item_deactivate', id);
      return { ok: true, deactivated: true, message: 'Item sudah dimiliki pemain, jadi dinonaktifkan (tidak dihapus).' };
    }
    await db.query(`delete from items where id = $1`, [id]);
    await bumpCatalog(db);
    await audit(db, req, 'item_delete', id);
    return { ok: true, deleted: true };
  });

  /* ---------------- media ---------------- */

  app.get('/api/admin/media', mod, async () => ({ media: await db.query(`select id, filename, mime, size, created_at from media order by created_at desc limit 300`) }));
  app.post('/api/admin/media', { ...adm, bodyLimit: 2_000_000 }, async (req: any) => {
    const filename = str(req.body?.filename, 'Nama file', { max: 120 })!.replace(/[^\w.-]/g, '_');
    const mime = oneOf(req.body?.mime, 'Tipe file', MIME);
    const bytes = Buffer.from(String(req.body?.data ?? ''), 'base64');
    if (!bytes.length) throw bad('empty', 'File kosong.');
    if (bytes.length > 512 * 1024) throw bad('too_big', 'Ukuran file maksimal 512 KB.');
    if (mime === 'image/svg+xml' && /<script|on\w+=|javascript:/i.test(bytes.toString('utf8'))) throw bad('unsafe_svg', 'SVG berisi script tidak diizinkan.');
    const ext = { 'image/png': 'png', 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/svg+xml': 'svg' }[mime];
    const id = `${randomBytes(8).toString('hex')}.${ext}`;
    await db.query(`insert into media (id, filename, mime, bytes, size) values ($1,$2,$3,$4,$5)`, [id, filename, mime, bytes, bytes.length]);
    await audit(db, req, 'media_upload', id, { filename, size: bytes.length });
    return { ok: true, id, url: `/media/${id}` };
  });
  app.delete('/api/admin/media/:id', adm, async (req: any) => {
    await db.query(`delete from media where id = $1`, [String(req.params.id)]);
    await audit(db, req, 'media_delete', String(req.params.id));
    return { ok: true };
  });

  /* ---------------- event ---------------- */

  app.get('/api/admin/events', mod, async () => ({
    events: await db.query(
      `select e.*,
              (select count(*)::int from event_progress p where p.event_id = e.id and p.season = to_char(e.starts_at, 'YYYY-MM-DD')) as participants,
              (select coalesce(sum(points),0)::int from event_progress p where p.event_id = e.id and p.season = to_char(e.starts_at, 'YYYY-MM-DD')) as total_points,
              (select coalesce(sum(jsonb_array_length(claimed)),0)::int from event_progress p where p.event_id = e.id and p.season = to_char(e.starts_at, 'YYYY-MM-DD')) as claims
         from events e order by e.starts_at desc`,
    ),
    decor: EVENT_DECOR,
    sources: EVENT_POINT_SOURCES,
    templates: EVENT_TEMPLATES,
    items: await db.query(`select id, name, kind from items where active order by kind, name`),
  }));
  async function writeEvent(req: any, id: string, creating: boolean) {
    const b = obj(req.body, 'body');
    const starts = isoDate(b.starts_at, 'Mulai')!, ends = isoDate(b.ends_at, 'Selesai')!;
    if (ends <= starts) throw bad('invalid_dates', 'Tanggal selesai harus setelah tanggal mulai.');
    const theme = obj(b.theme, 'Tema');
    const bonus = obj(b.bonus, 'Bonus');
    const mult = Number(bonus.coinMultiplier ?? 1);
    if (!(mult >= 1 && mult <= 5)) throw bad('invalid_bonus', 'Pengali koin harus 1–5.');
    const decor = oneOf(b.decor ?? '', 'Dekorasi', EVENT_DECOR.map((d) => d[0]));
    const points: Record<string, number> = {};
    for (const [k, v] of Object.entries(obj(b.points, 'Poin'))) {
      if (!/^[a-z_]{2,30}(:[a-z]{2,20})?$/.test(k)) throw bad('invalid_points', 'Sumber poin tidak dikenal.');
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) points[k] = Math.min(1000, Math.round(n));
    }
    if (!Array.isArray(b.milestones ?? [])) throw bad('invalid_milestones', 'Hadiah bertingkat harus berupa daftar.');
    const itemIds = new Set((await db.query<{ id: string }>('select id from items')).map((r) => r.id));
    const milestones = (b.milestones ?? []).slice(0, 20).map((m: any, i: number) => {
      const out: Record<string, unknown> = { points: int(Number(m?.points), `Poin hadiah #${i + 1}`, { min: 1, max: 1_000_000 }) };
      if (Number(m?.coin) > 0) out.coin = int(Number(m.coin), `Koin hadiah #${i + 1}`, { min: 1, max: 1_000_000 });
      if (Number(m?.pearl) > 0) out.pearl = int(Number(m.pearl), `Mutiara hadiah #${i + 1}`, { min: 1, max: 10_000 });
      if (m?.item) {
        if (!itemIds.has(String(m.item))) throw bad('invalid_item', `Item hadiah #${i + 1} tidak ditemukan.`);
        out.item = String(m.item);
        out.qty = int(Number(m.qty ?? 1), `Jumlah item #${i + 1}`, { min: 1, max: 99 });
      }
      if (!out.coin && !out.pearl && !out.item) throw bad('invalid_milestones', `Hadiah #${i + 1} belum berisi koin, Mutiara, atau item.`);
      return out;
    }).sort((a: any, c: any) => a.points - c.points);
    const vals = [id, str(b.name, 'Nama', { min: 2, max: 60 }), str(b.description, 'Deskripsi', { max: 300, optional: true }) ?? '', starts, ends,
      J({ color: /^#[0-9a-fA-F]{6}$/.test(theme.color) ? theme.color : '#E0583F' }), J({ coinMultiplier: Math.round(mult * 100) / 100 }), bool(b.active, true),
      decor, J(points), J(milestones), str(b.token_name, 'Nama poin', { min: 2, max: 24, optional: true }) ?? 'Poin event', bool(b.repeat_yearly, false), bool(b.notify_start, true)];
    if (creating) {
      if (await db.one('select 1 from events where id = $1', [id])) throw bad('exists', 'ID event sudah dipakai.');
      await db.query(`insert into events (id, name, description, starts_at, ends_at, theme, bonus, active, decor, points, milestones, token_name, repeat_yearly, notify_start)
                      values ($1,$2,$3,$4,$5,$6::text::jsonb,$7::text::jsonb,$8,$9,$10::text::jsonb,$11::text::jsonb,$12,$13,$14)`, vals);
    } else {
      const r = await db.one(`update events set name=$2, description=$3, starts_at=$4, ends_at=$5, theme=$6::text::jsonb, bonus=$7::text::jsonb, active=$8,
                              decor=$9, points=$10::text::jsonb, milestones=$11::text::jsonb, token_name=$12, repeat_yearly=$13, notify_start=$14 where id=$1 returning id`, vals);
      if (!r) throw notFound('Event tidak ditemukan.');
    }
    await bumpCatalog(db);
    await audit(db, req, creating ? 'event_create' : 'event_update', id, b);
    return { ok: true };
  }
  app.post('/api/admin/events', adm, async (req: any) => writeEvent(req, slug(req.body?.id), true));
  app.put('/api/admin/events/:id', adm, async (req: any) => writeEvent(req, slug(req.params.id), false));
  app.delete('/api/admin/events/:id', adm, async (req: any) => {
    const id = slug(req.params.id);
    await db.query(`update items set event_id = null where event_id = $1`, [id]);
    await db.query(`delete from events where id = $1`, [id]);
    await bumpCatalog(db);
    await audit(db, req, 'event_delete', id);
    return { ok: true };
  });

  /* ---------------- lokasi peta ---------------- */

  app.get('/api/admin/locations', mod, async () => ({ locations: await db.query(`select * from locations order by sort, id`) }));
  async function writeLocation(req: any, id: string, creating: boolean) {
    const b = obj(req.body, 'body');
    const st = obj(b.style, 'Gaya');
    const style: any = {};
    for (const k of ['body', 'roof']) if (typeof st[k] === 'string' && /^#[0-9a-fA-F]{6}$/.test(st[k])) style[k] = st[k];
    if (st.w !== undefined && st.w !== '') style.w = int(Number(st.w), 'Lebar bangunan', { min: 70, max: 140 });
    const kind = oneOf(b.kind, 'Jenis lokasi', LOC_KINDS);
    const vals = [id, str(b.name, 'Nama', { min: 2, max: 30 }), kind, int(Number(b.x), 'Posisi X', { min: 40, max: 920 }), int(Number(b.y), 'Posisi Y', { min: 120, max: 420 }),
      J(style), bool(b.enabled, true), int(Number(b.sort ?? 0), 'Urutan', { min: -1000, max: 1000 }), bool(b.sells_back, false)];
    if (creating) {
      if (await db.one('select 1 from locations where id = $1', [id])) throw bad('exists', 'ID lokasi sudah dipakai.');
      await db.query(`insert into locations (id, name, kind, x, y, style, enabled, sort, sells_back) values ($1,$2,$3,$4,$5,$6::text::jsonb,$7,$8,$9)`, vals);
    } else {
      if (id === 'rumah' && (kind !== 'home' || !bool(b.enabled, true))) throw bad('locked', 'Lokasi Rumahku harus tetap aktif.');
      const r = await db.one(`update locations set name=$2, kind=$3, x=$4, y=$5, style=$6::text::jsonb, enabled=$7, sort=$8, sells_back=$9 where id=$1 returning id`, vals);
      if (!r) throw notFound('Lokasi tidak ditemukan.');
    }
    await bumpCatalog(db);
    await audit(db, req, creating ? 'location_create' : 'location_update', id, b);
    return { ok: true };
  }
  app.post('/api/admin/locations', adm, async (req: any) => writeLocation(req, slug(req.body?.id), true));
  app.put('/api/admin/locations/:id', adm, async (req: any) => writeLocation(req, slug(req.params.id), false));
  app.delete('/api/admin/locations/:id', adm, async (req: any) => {
    const id = slug(req.params.id);
    if (id === 'rumah') throw bad('locked', 'Lokasi Rumahku tidak bisa dihapus.');
    await db.query(`update items set shop = null where shop = $1`, [id]);
    await db.query(`delete from locations where id = $1`, [id]);
    await bumpCatalog(db);
    await audit(db, req, 'location_delete', id);
    return { ok: true };
  });

  /* ---------------- pengaturan ---------------- */

  app.get('/api/admin/settings', mod, async () => ({ value: await getSettings(db), defaults: DEFAULT_SETTINGS, help: SETTINGS_HELP }));
  app.put('/api/admin/settings', adm, async (req: any) => {
    const value = sanitizeSettings(DEFAULT_SETTINGS, mergeSettings(DEFAULT_SETTINGS, obj(req.body?.value, 'Pengaturan')));
    if (value.room.size < 4 || value.room.size > 10) throw bad('invalid_settings', 'Ukuran ruangan harus 4–10.');
    if (value.garden.slots < 1 || value.garden.slots > 12) throw bad('invalid_settings', 'Jumlah petak kebun harus 1–12.');
    if (value.fishing.biteMaxMs < value.fishing.biteMinMs) throw bad('invalid_settings', 'Jeda gigitan maksimum harus ≥ minimum.');
    await db.query(`insert into settings (key, value) values ('game', $1::text::jsonb) on conflict (key) do update set value = excluded.value, updated_at = now()`, [J(value)]);
    await bumpCatalog(db);
    await audit(db, req, 'settings_update', 'game', value);
    return { ok: true, value };
  });

  /* ---------------- paket Mutiara ---------------- */

  app.get('/api/admin/packages', mod, async () => ({ packages: await db.query(`select * from pearl_packages order by sort, id`) }));
  async function writePackage(req: any, id: string, creating: boolean) {
    const b = obj(req.body, 'body');
    const vals = [id, str(b.name, 'Nama', { min: 2, max: 50 }), int(Number(b.pearls), 'Jumlah Mutiara', { min: 1, max: 100000 }), int(Number(b.bonus ?? 0), 'Bonus', { min: 0, max: 100000 }),
      int(Number(b.price_idr), 'Harga (Rp)', { min: 1000, max: 10_000_000 }), bool(b.active, true), int(Number(b.sort ?? 0), 'Urutan', { min: -1000, max: 1000 })];
    if (creating) {
      if (await db.one('select 1 from pearl_packages where id = $1', [id])) throw bad('exists', 'ID paket sudah dipakai.');
      await db.query(`insert into pearl_packages (id, name, pearls, bonus, price_idr, active, sort) values ($1,$2,$3,$4,$5,$6,$7)`, vals);
    } else {
      const r = await db.one(`update pearl_packages set name=$2, pearls=$3, bonus=$4, price_idr=$5, active=$6, sort=$7 where id=$1 returning id`, vals);
      if (!r) throw notFound('Paket tidak ditemukan.');
    }
    await bumpCatalog(db);
    await audit(db, req, creating ? 'package_create' : 'package_update', id, b);
    return { ok: true };
  }
  app.post('/api/admin/packages', own, async (req: any) => writePackage(req, slug(req.body?.id), true));
  app.put('/api/admin/packages/:id', own, async (req: any) => writePackage(req, slug(req.params.id), false));
  app.delete('/api/admin/packages/:id', own, async (req: any) => {
    const id = slug(req.params.id);
    await db.query(`update pearl_packages set active = false where id = $1`, [id]);
    await bumpCatalog(db);
    await audit(db, req, 'package_deactivate', id);
    return { ok: true };
  });

  /* ---------------- pengumuman ---------------- */

  app.get('/api/admin/announcements', mod, async () => ({ announcements: await db.query(`select * from announcements order by starts_at desc`) }));
  async function writeAnn(req: any, id: number | null) {
    const b = obj(req.body, 'body');
    const vals = [str(b.title, 'Judul', { min: 2, max: 80 }), str(b.body, 'Isi', { min: 2, max: 600 }), isoDate(b.starts_at, 'Mulai', true) ?? new Date(), isoDate(b.ends_at, 'Selesai', true), bool(b.active, true)];
    if (id === null) await db.query(`insert into announcements (title, body, starts_at, ends_at, active) values ($1,$2,$3,$4,$5)`, vals);
    else if (!(await db.one(`update announcements set title=$2, body=$3, starts_at=$4, ends_at=$5, active=$6 where id=$1 returning id`, [id, ...vals]))) throw notFound();
    await audit(db, req, id === null ? 'announcement_create' : 'announcement_update', String(id ?? ''), b);
    return { ok: true };
  }
  app.post('/api/admin/announcements', adm, async (req: any) => writeAnn(req, null));
  app.put('/api/admin/announcements/:id', adm, async (req: any) => writeAnn(req, int(Number(req.params.id), 'ID')));
  app.delete('/api/admin/announcements/:id', adm, async (req: any) => {
    await db.query(`delete from announcements where id = $1`, [int(Number(req.params.id), 'ID')]);
    await audit(db, req, 'announcement_delete', String(req.params.id));
    return { ok: true };
  });

  /* ---------------- pemain ---------------- */

  app.get('/api/admin/players', mod, async (req: any) => {
    const q = String(req.query?.q ?? '').trim();
    const page = Math.max(0, Number(req.query?.page ?? 0) | 0);
    const filter = String(req.query?.filter ?? '');
    const where: string[] = [];
    const params: unknown[] = [];
    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      where.push(`(lower(u.display_name) like $${params.length} or lower(p.name) like $${params.length} or lower(u.friend_code) like $${params.length} or u.id::text = $${params.length + 1}
               or exists(select 1 from auth_identities ai where ai.user_id = u.id and lower(ai.email) like $${params.length}))`);
      params.push(q);
    }
    if (filter === 'banned') where.push('u.banned_at is not null');
    if (filter === 'guest') where.push('u.is_guest');
    if (filter === 'payer') where.push(`exists(select 1 from payments py where py.user_id = u.id and py.status = 'paid')`);
    params.push(page * 50);
    const rows = await db.query(
      `select u.id, u.display_name, u.friend_code, u.is_guest, u.banned_at, u.created_at, u.last_seen_at, p.name as pet_name, p.level, w.coin, w.pearl
         from users u left join pets p on p.user_id = u.id left join wallets w on w.user_id = u.id
        ${where.length ? 'where ' + where.join(' and ') : ''}
        order by u.last_seen_at desc limit 50 offset $${params.length}`,
      params,
    );
    return { players: rows, page };
  });

  app.get('/api/admin/players/:id', mod, async (req: any) => {
    const id = String(req.params.id);
    if (!UUID.test(id)) throw bad('invalid', 'ID tidak valid.');
    const s = await getSettings(db);
    const user = await db.one(`select * from users where id = $1`, [id]);
    if (!user) throw notFound('Pemain tidak ditemukan.');
    const [ids, pet, wallet, ledger, inventory, room, payments, friends, gifts] = await Promise.all([
      db.query(`select provider, email, created_at from auth_identities where user_id = $1`, [id]),
      db.one(`select * from pets where user_id = $1`, [id]),
      db.one(`select coin, pearl from wallets where user_id = $1`, [id]),
      db.query(`select id, currency, delta, balance_after, reason, ref, created_at from wallet_ledger where user_id = $1 order by id desc limit 60`, [id]),
      db.query(`select item_id, qty from inventory where user_id = $1 and qty > 0 order by item_id`, [id]),
      db.one(`select layout, wall, floor, version, updated_at from rooms where user_id = $1`, [id]),
      db.query(`select id, package_id, pearls, amount_idr, status, provider, created_at, paid_at from payments where user_id = $1 order by created_at desc limit 20`, [id]),
      db.one<{ c: number }>(`select count(*)::int c from friendships where user_id = $1`, [id]),
      db.one<{ c: number }>(`select count(*)::int c from gifts where from_id = $1`, [id]),
    ]);
    return { user, identities: ids, pet: pet ? petView(pet, s) : null, wallet, ledger, inventory, room, payments, friends: friends?.c ?? 0, giftsSent: gifts?.c ?? 0 };
  });

  app.post('/api/admin/players/:id/ban', mod, async (req: any) => {
    const id = String(req.params.id);
    const reason = str(req.body?.reason, 'Alasan', { min: 3, max: 200 })!;
    await db.query(`update users set banned_at = now(), ban_reason = $2 where id = $1`, [id, reason]);
    await db.query(`delete from sessions where user_id = $1`, [id]);
    await audit(db, req, 'player_ban', id, { reason });
    return { ok: true };
  });
  app.post('/api/admin/players/:id/unban', mod, async (req: any) => {
    const id = String(req.params.id);
    await db.query(`update users set banned_at = null, ban_reason = null where id = $1`, [id]);
    await audit(db, req, 'player_unban', id);
    return { ok: true };
  });
  app.post('/api/admin/players/:id/rename', mod, async (req: any) => {
    const id = String(req.params.id);
    const petName = str(req.body?.petName, 'Nama pet', { min: 2, max: 16, optional: true });
    const displayName = str(req.body?.displayName, 'Nama pemain', { min: 2, max: 24, optional: true });
    if (petName) await db.query(`update pets set name = $2 where user_id = $1`, [id, petName]);
    if (displayName) await db.query(`update users set display_name = $2 where id = $1`, [id, displayName]);
    await audit(db, req, 'player_rename', id, { petName, displayName });
    return { ok: true };
  });
  app.post('/api/admin/players/:id/wallet', adm, async (req: any) => {
    const id = String(req.params.id);
    const currency = oneOf(req.body?.currency, 'Mata uang', ['coin', 'pearl'] as const);
    const delta = int(Number(req.body?.delta), 'Jumlah', { min: -1_000_000, max: 1_000_000 });
    if (delta === 0) throw bad('invalid', 'Jumlah tidak boleh 0.');
    const reason = str(req.body?.reason, 'Alasan', { min: 3, max: 120 })!;
    const bal = await db.tx((t) => credit(t, id, currency, delta, 'admin', `${req.admin!.email}: ${reason}`));
    await audit(db, req, 'player_wallet', id, { currency, delta, reason });
    return { ok: true, balance: bal };
  });
  app.post('/api/admin/players/:id/items', adm, async (req: any) => {
    const id = String(req.params.id);
    const itemId = slug(req.body?.itemId, 'Item');
    const qty = int(Number(req.body?.qty), 'Jumlah', { min: -999, max: 999 });
    if (!(await db.one('select 1 from items where id = $1', [itemId]))) throw notFound('Item tidak ditemukan.');
    await db.tx((t) => addItem(t, id, itemId, qty));
    await audit(db, req, 'player_items', id, { itemId, qty });
    return { ok: true };
  });
  app.post('/api/admin/players/:id/logout', mod, async (req: any) => {
    const id = String(req.params.id);
    await db.query(`delete from sessions where user_id = $1`, [id]);
    await audit(db, req, 'player_logout', id);
    return { ok: true };
  });

  /* ---------------- pembayaran ---------------- */

  app.get('/api/admin/payments', adm, async (req: any) => {
    const status = String(req.query?.status ?? '');
    const rows = await db.query(
      `select p.*, u.display_name from payments p join users u on u.id = p.user_id
        ${['pending', 'paid', 'failed', 'expired'].includes(status) ? 'where p.status = $1' : ''}
        order by p.created_at desc limit 200`,
      ['pending', 'paid', 'failed', 'expired'].includes(status) ? [status] : [],
    );
    return { payments: rows.map((r: any) => ({ ...r, raw: undefined, qr_string: undefined })) };
  });
  app.post('/api/admin/payments/:id/mark-paid', own, async (req: any) => {
    const id = String(req.params.id);
    const reason = str(req.body?.reason, 'Alasan', { min: 3, max: 200 })!;
    const done = await markPaid(db, id, { manual: true, by: req.admin!.email, reason });
    await audit(db, req, 'payment_mark_paid', id, { reason, done });
    return { ok: true, credited: done };
  });

  /* ---------------- ZePay (QRIS) ---------------- */

  app.get('/api/admin/zepay', adm, async () => {
    const hook = await db.one<{ value: any }>(`select value from settings where key = 'zepay_webhook'`);
    const seen = await db.one<{ value: any }>(`select value from settings where key = 'zepay_seen'`);
    const out: any = {
      active: config.paymentProvider === 'zepay',
      configured: zepayConfigured(),
      mode: zepayMode(),
      baseUrl: config.zepayBaseUrl,
      webhookUrl: zepayWebhookUrl(),
      secretSource: config.zepayWebhookSecret ? 'env' : hook?.value?.secret ? 'db' : null,
      lastEvent: seen?.value ?? null,
      expiresMinutes: config.zepayExpiresMinutes,
    };
    if (!out.configured) return out;
    const [m, eps] = await Promise.allSettled([zepay('GET', '/merchant'), zepay('GET', '/webhook-endpoints')]);
    if (m.status === 'fulfilled') {
      const v: any = m.value;
      const q = v.payment_methods?.find((x: any) => x.method === 'QRIS');
      out.merchant = { name: v.name, code: v.code, status: v.status, livemode: v.livemode, qris: q ? { enabled: !!q.enabled, channel: q.channels?.[0] ?? null } : null };
    } else out.error = zErr(m.reason);
    if (eps.status === 'fulfilled') {
      out.endpoints = ((eps.value as any).data ?? []).map((e: any) => ({
        id: e.id, url: e.url, status: e.status, events: e.events, secret_last4: e.secret_last4, ours: e.url === out.webhookUrl,
      }));
    } else out.endpointsError = zErr(eps.reason);
    return out;
  });

  /* Daftarkan URL webhook game ke ZePay; secret disimpan di database (env ZEPAY_WEBHOOK_SECRET tetap diterima). */
  app.post('/api/admin/zepay/webhook', own, async (req: any) => {
    if (!zepayConfigured()) throw bad('zepay_off', 'Isi ZEPAY_KEY_ID dan ZEPAY_SECRET di .env lalu restart server.');
    const url = zepayWebhookUrl();
    if (!url.startsWith('https://')) throw bad('zepay_url', 'PUBLIC_URL harus https:// supaya ZePay bisa mengirim webhook.');
    let ep: any, rotated = false;
    try {
      const list: any = await zepay('GET', '/webhook-endpoints');
      const found = (list.data ?? []).find((e: any) => e.url === url);
      if (found) {
        // secret lama tidak bisa dibaca lagi: rotasi supaya kita memegang secret yang baru
        ep = await zepay('POST', `/webhook-endpoints/${found.id}/rotate-secret`, { previous_secret_valid_hours: 24 }, `kb-rotate-${randomUUID()}`);
        rotated = true;
        const covers = (found.events ?? []).some((e: string) => e === '*' || e.startsWith('payment.'));
        if (found.status !== 'enabled' || !covers) {
          await zepay('PATCH', `/webhook-endpoints/${found.id}`, { status: 'enabled', ...(covers ? {} : { events: [...(found.events ?? []), 'payment.*'] }) });
        }
      } else {
        ep = await zepay('POST', '/webhook-endpoints', { url, events: ['payment.*'], description: 'Kampung Bulu' }, `kb-hook-${randomUUID()}`);
      }
    } catch (e) {
      throw bad('zepay_error', 'ZePay menolak: ' + zErr(e));
    }
    if (!ep?.secret) throw bad('zepay_error', 'ZePay tidak mengembalikan secret webhook.');
    await db.query(
      `insert into settings (key, value) values ('zepay_webhook', $1::text::jsonb) on conflict (key) do update set value = excluded.value`,
      [JSON.stringify({ endpointId: ep.id, secret: ep.secret, url, mode: zepayMode(), at: new Date().toISOString() })],
    );
    let testEvent: string | null = null;
    try { testEvent = ((await zepay('POST', `/webhook-endpoints/${ep.id}/test`)) as any)?.event_id ?? null; } catch { /* tidak wajib */ }
    await audit(db, req, 'zepay_webhook', ep.id, { url, rotated });
    return { ok: true, endpointId: ep.id, rotated, testEvent };
  });

  app.post('/api/admin/zepay/test', adm, async (req: any) => {
    const hook = await db.one<{ value: any }>(`select value from settings where key = 'zepay_webhook'`);
    let id: string | undefined = hook?.value?.endpointId;
    try {
      if (!id) id = ((await zepay('GET', '/webhook-endpoints')) as any).data?.find((e: any) => e.url === zepayWebhookUrl())?.id;
      if (!id) throw bad('zepay_hook', 'Webhook belum didaftarkan.');
      const r: any = await zepay('POST', `/webhook-endpoints/${id}/test`);
      await audit(db, req, 'zepay_webhook_test', id);
      return { ok: true, eventId: r?.event_id ?? null };
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw bad('zepay_error', 'ZePay menolak: ' + zErr(e));
    }
  });

  app.post('/api/admin/payments/:id/sync', adm, async (req: any) => {
    const id = String(req.params.id);
    if (!UUID.test(id)) throw bad('invalid', 'Pembayaran tidak valid.');
    let result: string | null;
    try { result = await syncZepay(db, id, req.log); } catch (e) { throw bad('zepay_error', 'Cek status gagal: ' + zErr(e)); }
    if (result === null) throw bad('not_zepay', 'Hanya pembayaran QRIS (ZePay) yang bisa dicek ke gateway.');
    await audit(db, req, 'payment_sync', id, { result });
    return { ok: true, result };
  });

  /* Mode uji (kunci zpk_test_…): tiru hasil pembayaran dari ZePay. */
  app.post('/api/admin/payments/:id/simulate', own, async (req: any) => {
    if (zepayMode() !== 'test') throw forbidden('Simulasi hanya bisa dengan kunci uji ZePay (zpk_test_…).');
    const id = String(req.params.id);
    if (!UUID.test(id)) throw bad('invalid', 'Pembayaran tidak valid.');
    const status = oneOf(req.body?.status ?? 'SUCCESS', 'Status', ['SUCCESS', 'FAILED', 'EXPIRED'] as const);
    const p = await db.one<{ id: string; amount_idr: number; provider: string; provider_ref: string | null }>(
      `select id, amount_idr, provider, provider_ref from payments where id = $1`,
      [id],
    );
    if (!p || p.provider !== 'zepay' || !p.provider_ref) throw bad('not_zepay', 'Hanya pembayaran QRIS (ZePay) yang bisa disimulasikan.');
    let zp: ZePayment;
    try { zp = await zepay<ZePayment>('POST', `/payments/${encodeURIComponent(p.provider_ref)}/simulate`, { status }); }
    catch (e) { throw bad('zepay_error', 'Simulasi gagal: ' + zErr(e)); }
    const result = await applyZepay(db, p, zp, { source: 'simulate', payment: pick(zp) }, req.log);
    await audit(db, req, 'payment_simulate', id, { status, result });
    return { ok: true, result };
  });

  /* ---------------- moderasi kata ---------------- */

  app.get('/api/admin/banned-words', mod, async () => ({ words: (await db.query<{ word: string }>(`select word from banned_words order by word`)).map((r) => r.word) }));
  app.post('/api/admin/banned-words', mod, async (req: any) => {
    const w = str(req.body?.word, 'Kata', { min: 2, max: 40 })!.toLowerCase();
    await db.query(`insert into banned_words (word) values ($1) on conflict do nothing`, [w]);
    invalidateBanned();
    await audit(db, req, 'banned_add', w);
    return { ok: true };
  });
  app.delete('/api/admin/banned-words/:word', mod, async (req: any) => {
    const w = String(req.params.word).toLowerCase();
    await db.query(`delete from banned_words where word = $1`, [w]);
    invalidateBanned();
    await audit(db, req, 'banned_remove', w);
    return { ok: true };
  });

  /* ---------------- audit & admin ---------------- */

  app.get('/api/admin/audit', adm, async (req: any) => {
    const page = Math.max(0, Number(req.query?.page ?? 0) | 0);
    return { audit: await db.query(`select * from admin_audit order by id desc limit 100 offset $1`, [page * 100]), page };
  });

  app.get('/api/admin/admins', own, async () => ({ admins: await db.query(`select id, email, name, role, created_at, last_login_at from admins order by created_at`) }));
  app.post('/api/admin/admins', own, async (req: any) => {
    const mail = vEmail(req.body?.email);
    const role = oneOf(req.body?.role, 'Peran', ['owner', 'admin', 'moderator'] as const);
    const pw = str(req.body?.password, 'Password', { min: 10, max: 200 })!;
    if (await db.one('select 1 from admins where email = $1', [mail])) throw bad('exists', 'Email admin sudah terdaftar.');
    await db.query(`insert into admins (email, name, password_hash, role) values ($1,$2,$3,$4)`, [mail, str(req.body?.name, 'Nama', { max: 60, optional: true }) ?? '', await hashPassword(pw), role]);
    await audit(db, req, 'admin_create', mail, { role });
    return { ok: true };
  });
  app.put('/api/admin/admins/:id', own, async (req: any) => {
    const id = String(req.params.id);
    const role = oneOf(req.body?.role, 'Peran', ['owner', 'admin', 'moderator'] as const);
    if (id === req.admin!.id && role !== 'owner') throw bad('self', 'Kamu tidak bisa menurunkan peranmu sendiri.');
    await db.query(`update admins set role = $2, name = coalesce($3, name) where id = $1`, [id, role, str(req.body?.name, 'Nama', { max: 60, optional: true }) ?? null]);
    if (req.body?.password) await db.query(`update admins set password_hash = $2 where id = $1`, [id, await hashPassword(str(req.body.password, 'Password', { min: 10, max: 200 })!)]);
    await audit(db, req, 'admin_update', id, { role });
    return { ok: true };
  });
  app.delete('/api/admin/admins/:id', own, async (req: any) => {
    const id = String(req.params.id);
    if (id === req.admin!.id) throw bad('self', 'Kamu tidak bisa menghapus akunmu sendiri.');
    await db.query(`delete from admins where id = $1`, [id]);
    await audit(db, req, 'admin_delete', id);
    return { ok: true };
  });

  /* ---------------- tugas ---------------- */

  app.get('/api/admin/quests', mod, async () => ({
    quests: await db.query(
      `select q.*, (select count(*)::int from quest_progress p where p.quest_id = q.id and p.claimed_at is not null) as claimed_total
         from quests q order by q.kind desc, q.sort, q.id`,
    ),
    events: QUEST_EVENTS,
    links: QUEST_LINKS,
  }));
  async function writeQuest(req: any, id: string, creating: boolean) {
    const b = obj(req.body, 'body');
    const event = oneOf(b.event, 'Peristiwa', Object.keys(QUEST_EVENTS));
    const filter: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj(b.filter, 'Filter'))) {
      if (!/^[a-zA-Z]{1,20}$/.test(k) || v === '' || v === null || typeof v === 'object') throw bad('invalid_filter', 'Filter harus berupa pasangan nama: nilai sederhana.');
      filter[k] = String(v).slice(0, 48);
    }
    const vals = [
      id, oneOf(b.kind, 'Jenis', ['starter', 'daily'] as const), str(b.title, 'Judul', { min: 2, max: 50 }), str(b.description, 'Deskripsi', { max: 160, optional: true }) ?? '',
      event, J(filter), int(Number(b.target), 'Target', { min: 1, max: 1000 }),
      int(Number(b.reward_coin ?? 0), 'Hadiah koin', { min: 0, max: 100000 }), int(Number(b.reward_pearl ?? 0), 'Hadiah Mutiara', { min: 0, max: 1000 }), int(Number(b.reward_xp ?? 0), 'Hadiah XP', { min: 0, max: 10000 }),
      oneOf(b.url ?? '/', 'Tujuan', QUEST_LINKS.map((l) => l[0])), int(Number(b.sort ?? 0), 'Urutan', { min: -10000, max: 10000 }), bool(b.active, true),
    ];
    if (creating) {
      if (await db.one('select 1 from quests where id = $1', [id])) throw bad('exists', 'ID tugas sudah dipakai.');
      await db.query(`insert into quests (id, kind, title, description, event, filter, target, reward_coin, reward_pearl, reward_xp, url, sort, active) values ($1,$2,$3,$4,$5,$6::text::jsonb,$7,$8,$9,$10,$11,$12,$13)`, vals);
    } else {
      const r = await db.one(`update quests set kind=$2, title=$3, description=$4, event=$5, filter=$6::text::jsonb, target=$7, reward_coin=$8, reward_pearl=$9, reward_xp=$10, url=$11, sort=$12, active=$13 where id=$1 returning id`, vals);
      if (!r) throw notFound('Tugas tidak ditemukan.');
    }
    invalidateQuests();
    await audit(db, req, creating ? 'quest_create' : 'quest_update', id, b);
    return { ok: true };
  }
  app.post('/api/admin/quests', adm, async (req: any) => writeQuest(req, slug(req.body?.id), true));
  app.put('/api/admin/quests/:id', adm, async (req: any) => writeQuest(req, slug(req.params.id), false));
  app.delete('/api/admin/quests/:id', adm, async (req: any) => {
    const id = slug(req.params.id);
    await db.query(`update quests set active = false where id = $1`, [id]);
    invalidateQuests();
    await audit(db, req, 'quest_deactivate', id);
    return { ok: true, message: 'Tugas dinonaktifkan (riwayat progres pemain tetap tersimpan).' };
  });

  app.post('/api/admin/cache/clear', adm, async (req) => {
    invalidateCaches();
    invalidateQuests();
    await bumpCatalog(db);
    await audit(db, req, 'cache_clear');
    return { ok: true };
  });
  void forbidden;
}
