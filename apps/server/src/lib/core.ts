import { createHash, randomBytes, randomInt, scrypt as _scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { DEFAULT_SETTINGS, mergeSettings, dayKey, type Settings } from '@kb/shared';
import type { Db } from '../db/index';

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}
export const bad = (code: string, msg: string, extra?: Record<string, unknown>) => new HttpError(400, code, msg, extra);
export const notFound = (msg = 'Tidak ditemukan') => new HttpError(404, 'not_found', msg);
export const forbidden = (msg = 'Tidak diizinkan') => new HttpError(403, 'forbidden', msg);

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const token = (bytes = 32) => randomBytes(bytes).toString('base64url');

export async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 32);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}
export async function verifyPassword(pw: string, stored: string) {
  const [alg, s, k] = stored.split('$');
  if (alg !== 'scrypt' || !s || !k) return false;
  const key = await scrypt(pw, Buffer.from(s, 'base64'), 32);
  const want = Buffer.from(k, 'base64');
  return want.length === key.length && timingSafeEqual(want, key);
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function friendCode() {
  let s = 'KB-';
  for (let i = 0; i < 6; i++) s += CODE_CHARS[randomInt(CODE_CHARS.length)];
  return s;
}

export const today = () => dayKey(Date.now());
export const yesterday = () => dayKey(Date.now() - 86_400_000);

/* ---------------- settings & catalog cache ---------------- */

const TTL = 15_000;
let settingsCache: { at: number; value: Settings } | null = null;
let catalogCache: { at: number; value: Catalog } | null = null;

export async function getSettings(db: Db): Promise<Settings> {
  if (settingsCache && Date.now() - settingsCache.at < TTL) return settingsCache.value;
  const row = await db.one<{ value: any }>(`select value from settings where key = 'game'`);
  const value = mergeSettings(DEFAULT_SETTINGS, row?.value ?? {}) as Settings;
  settingsCache = { at: Date.now(), value };
  return value;
}

export interface CatalogItem {
  id: string; kind: any; name: string; description: string;
  price_coin: number; price_pearl: number; sell_coin: number; shop: string | null;
  art: any; data: any; event_id: string | null; available_from: Date | null; available_to: Date | null; active: boolean; sort: number;
}
export interface Catalog {
  version: string;
  items: CatalogItem[];
  byId: Map<string, CatalogItem>;
  locations: any[];
  events: any[];
  packages: any[];
  activities: any[];
}

export async function getCatalog(db: Db): Promise<Catalog> {
  if (catalogCache && Date.now() - catalogCache.at < TTL) return catalogCache.value;
  const [items, locations, events, packages, activities, ver] = await Promise.all([
    db.query<CatalogItem>(`select id, kind, name, description, price_coin, price_pearl, sell_coin, shop, art, data, event_id, available_from, available_to, active, sort from items order by sort, id`),
    db.query(`select id, name, kind, x, y, style, enabled, sort, sells_back from locations order by sort, id`),
    db.query(`select id, name, description, starts_at, ends_at, theme, bonus, active, decor, points, milestones, token_name, repeat_yearly from events order by starts_at`),
    db.query(`select id, name, pearls, bonus, price_idr, active, sort from pearl_packages order by sort, id`),
    db.query(`select id, name, description, targets, anim, effects, xp, coins, reward_item, cooldown_sec, daily_limit, min_level, message, active, sort from activities order by sort, id`),
    db.one<{ value: any }>(`select value from settings where key = 'catalog_version'`),
  ]);
  const value: Catalog = { version: String(ver?.value ?? 1), items, byId: new Map(items.map((i) => [i.id, i])), locations, events, packages, activities };
  catalogCache = { at: Date.now(), value };
  return value;
}

export async function bumpCatalog(db: Db) {
  await db.query(
    `insert into settings (key, value) values ('catalog_version', to_jsonb(1)) on conflict (key) do update set value = to_jsonb((settings.value)::text::int + 1), updated_at = now()`,
  );
  catalogCache = null;
  settingsCache = null;
}
export function invalidateCaches() {
  catalogCache = null;
  settingsCache = null;
}

export function activeEvents(cat: Catalog, now = Date.now()) {
  return cat.events.filter((e) => e.active && new Date(e.starts_at).getTime() <= now && new Date(e.ends_at).getTime() > now);
}
export function coinMultiplier(cat: Catalog) {
  return activeEvents(cat).reduce((m, e) => Math.max(m, Number(e.bonus?.coinMultiplier) || 1), 1);
}

/** Item bisa dibeli sekarang? (aktif, dijual di toko, dalam periode, event-nya berjalan) */
export function purchasable(cat: Catalog, item: CatalogItem | undefined, now = Date.now()) {
  if (!item || !item.active || !item.shop) return false;
  const loc = cat.locations.find((l) => l.id === item.shop);
  if (!loc || !loc.enabled) return false;
  if (item.available_from && new Date(item.available_from).getTime() > now) return false;
  if (item.available_to && new Date(item.available_to).getTime() <= now) return false;
  if (item.event_id) {
    const ev = cat.events.find((e) => e.id === item.event_id);
    if (!ev || !ev.active || new Date(ev.starts_at).getTime() > now || new Date(ev.ends_at).getTime() <= now) return false;
  }
  return item.price_coin > 0 || item.price_pearl > 0;
}

/* ---------------- moderation ---------------- */

let bannedCache: { at: number; words: string[] } | null = null;
export async function checkName(db: Db, name: string) {
  const n = name.trim().replace(/\s+/g, ' ');
  if (n.length < 2 || n.length > 16) throw bad('name_length', 'Nama harus 2–16 karakter.');
  if (!/^[\p{L}\p{N} '._-]+$/u.test(n)) throw bad('name_chars', 'Nama hanya boleh huruf, angka, spasi, titik, atau tanda hubung.');
  if (!bannedCache || Date.now() - bannedCache.at > TTL) {
    bannedCache = { at: Date.now(), words: (await db.query<{ word: string }>('select word from banned_words')).map((r) => r.word.toLowerCase()) };
  }
  const norm = n
    .toLowerCase()
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't').replace(/@/g, 'a');
  const squashed = norm.replace(/[^a-z]/g, '');
  for (const w of bannedCache.words) {
    if (norm.split(/[^a-z]+/).includes(w) || (w.length >= 5 && squashed.includes(w))) throw bad('name_banned', 'Nama itu tidak bisa dipakai. Coba nama lain.');
  }
  return n;
}
export function invalidateBanned() {
  bannedCache = null;
}

/* ---------------- wallet, inventory, counters ---------------- */

export async function credit(db: Db, userId: string, currency: 'coin' | 'pearl', delta: number, reason: string, ref?: string) {
  if (!Number.isInteger(delta) || delta === 0) return null;
  const row = await db.one<{ bal: number }>(
    `update wallets set ${currency} = ${currency} + $2 where user_id = $1 and ${currency} + $2 >= 0 returning ${currency} as bal`,
    [userId, delta],
  );
  if (!row) throw bad('insufficient_funds', currency === 'coin' ? 'Koin belum cukup.' : 'Mutiara belum cukup.');
  await db.query(`insert into wallet_ledger (user_id, currency, delta, balance_after, reason, ref) values ($1,$2,$3,$4,$5,$6)`, [userId, currency, delta, row.bal, reason, ref ?? null]);
  return row.bal;
}

export async function addItem(db: Db, userId: string, itemId: string, qty: number) {
  if (qty > 0) {
    await db.query(`insert into inventory (user_id, item_id, qty) values ($1,$2,$3) on conflict (user_id, item_id) do update set qty = inventory.qty + excluded.qty`, [userId, itemId, qty]);
  } else if (qty < 0) {
    const r = await db.one(`update inventory set qty = qty + $3 where user_id = $1 and item_id = $2 and qty + $3 >= 0 returning qty`, [userId, itemId, qty]);
    if (!r) throw bad('not_owned', 'Barang tidak ada di tas.');
  }
}

export async function bumpCounter(db: Db, userId: string, key: string, limit: number, by = 1) {
  const r = await db.one<{ count: number }>(
    `insert into daily_counters (user_id, key, day, count) values ($1,$2,$3,$4)
     on conflict (user_id, key, day) do update set count = daily_counters.count + $4
     returning count`,
    [userId, key, today(), by],
  );
  if (r!.count > limit) throw bad('daily_limit', 'Jatah hari ini sudah habis. Coba lagi besok.');
  return r!.count;
}
export async function counter(db: Db, userId: string, key: string) {
  const r = await db.one<{ count: number }>(`select count from daily_counters where user_id = $1 and key = $2 and day = $3`, [userId, key, today()]);
  return r?.count ?? 0;
}

export async function cooldown(db: Db, userId: string, key: string, seconds: number) {
  if (seconds <= 0) return;
  const r = await db.one<{ until: Date }>(`select until from cooldowns where user_id = $1 and key = $2`, [userId, key]);
  if (r && new Date(r.until).getTime() > Date.now()) {
    const left = Math.ceil((new Date(r.until).getTime() - Date.now()) / 1000);
    throw bad('cooldown', `Tunggu ${left >= 60 ? Math.ceil(left / 60) + ' menit' : left + ' detik'} lagi.`, { retryInSec: left });
  }
  await db.query(
    `insert into cooldowns (user_id, key, until) values ($1,$2, now() + ($3::int * interval '1 second'))
     on conflict (user_id, key) do update set until = excluded.until`,
    [userId, key, seconds],
  );
}

type TrackHook = (db: Db, userId: string | null, name: string, props?: Record<string, unknown>) => Promise<void>;
let trackHook: TrackHook | null = null;
/** Dipasang oleh app: setiap peristiwa juga memajukan progres tugas. */
export function setTrackHook(fn: TrackHook) { trackHook = fn; }

export async function track(db: Db, userId: string | null, name: string, props?: Record<string, unknown>) {
  await db.query(`insert into analytics_events (user_id, name, props) values ($1,$2,$3)`, [userId, name, props ?? null]).catch(() => {});
  if (trackHook) await trackHook(db, userId, name, props);
}
