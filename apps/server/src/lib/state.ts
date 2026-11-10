import { decayNeeds, NEED_KEYS, type Needs, type Settings } from '@kb/shared';
import type { Db } from '../db/index';
import { maskPhone } from './klikflow';
import { getCatalog, getSettings, activeEvents, today, counter, type Catalog } from './core';
import { questSummary } from './quests';

export const J = (v: unknown) => JSON.stringify(v ?? null);

export interface PetRow {
  user_id: string; name: string; color: string; ear: string; wear: Record<string, string>;
  level: number; xp: number; kenyang: number; bersih: number; ceria: number; energi: number; needs_at: Date;
}

export function currentNeeds(p: PetRow, s: Settings, now = Date.now()): Needs {
  const stored = { kenyang: p.kenyang, bersih: p.bersih, ceria: p.ceria, energi: p.energi };
  return decayNeeds(stored, new Date(p.needs_at).getTime(), now, s.needs.decayPerHour);
}

export async function lockPet(db: Db, userId: string) {
  return db.one<PetRow>(`select * from pets where user_id = $1 for update`, [userId]);
}

export async function savePet(db: Db, userId: string, fields: Partial<{ needs: Needs; level: number; xp: number }>) {
  const n = fields.needs;
  await db.query(
    `update pets set
       kenyang = coalesce($2, kenyang), bersih = coalesce($3, bersih), ceria = coalesce($4, ceria), energi = coalesce($5, energi),
       needs_at = case when $2::real is null then needs_at else now() end,
       level = coalesce($6, level), xp = coalesce($7, xp)
     where user_id = $1`,
    [userId, n?.kenyang ?? null, n?.bersih ?? null, n?.ceria ?? null, n?.energi ?? null, fields.level ?? null, fields.xp ?? null],
  );
}

export function petView(p: PetRow, s: Settings) {
  const needs = currentNeeds(p, s);
  for (const k of NEED_KEYS) needs[k] = Math.round(needs[k] * 10) / 10;
  return { name: p.name, color: p.color, ear: p.ear, pattern: (p as any).pattern ?? 'polos', eyes: (p as any).eyes ?? 'bulat', tail: (p as any).tail ?? 'bulat', wear: p.wear ?? {}, level: p.level, xp: p.xp, needs, needsAt: Date.now() };
}

/** Semua yang dibutuhkan client setelah masuk. */
export async function playerState(db: Db, userId: string) {
  const [s, cat] = await Promise.all([getSettings(db), getCatalog(db)]);
  const [user, pet, wallet, inv, room, plots, gifts, visitors, daily, friendsCount, identities] = await Promise.all([
    db.one(`select id, display_name, friend_code, is_guest, created_at, wa_phone, wa_verified_at from users where id = $1`, [userId]),
    db.one<PetRow>(`select * from pets where user_id = $1`, [userId]),
    db.one<{ coin: number; pearl: number }>(`select coin, pearl from wallets where user_id = $1`, [userId]),
    db.query<{ item_id: string; qty: number }>(`select item_id, qty from inventory where user_id = $1 and qty > 0`, [userId]),
    db.one(`select layout, wall, floor, version from rooms where user_id = $1`, [userId]),
    db.query(`select slot, seed_id, planted_at, ready_at from garden_plots where user_id = $1 order by slot`, [userId]),
    db.one<{ c: number }>(`select count(*)::int as c from gifts where to_id = $1 and opened_at is null`, [userId]),
    db.query(
      `select u.display_name as name, v.created_at from visits v join users u on u.id = v.visitor_id
        where v.host_id = $1 and v.created_at > now() - interval '2 days' order by v.created_at desc limit 10`,
      [userId],
    ),
    db.one<{ day: string; streak: number }>(`select day::text as day, streak from daily_claims where user_id = $1 order by day desc limit 1`, [userId]),
    db.one<{ c: number }>(`select count(*)::int as c from friendships where user_id = $1`, [userId]),
    db.query<{ provider: string; email: string | null }>(`select provider, email from auth_identities where user_id = $1`, [userId]),
  ]);
  const announcements = await db.query(
    `select id, title, body, starts_at from announcements where active and starts_at <= now() and (ends_at is null or ends_at > now()) order by starts_at desc limit 5`,
  );
  const [plays, casts, unread, prefs] = await Promise.all([
    counter(db, userId, 'karung'),
    counter(db, userId, 'fishing'),
    db.one<{ c: number }>(`select count(*)::int c from notifications where user_id = $1 and read_at is null`, [userId]),
    db.one<{ notify_prefs: any }>(`select notify_prefs from users where id = $1`, [userId]),
  ]);
  return {
    serverNow: Date.now(),
    catalogVersion: cat.version,
    user: {
      ...user, wa_phone: undefined, wa_verified_at: undefined,
      wa: user?.wa_verified_at ? { phone: maskPhone(user.wa_phone), verified: true } : null,
      identities: identities.map((i) => ({ provider: i.provider, email: i.email })),
    },
    pet: pet ? petView(pet, s) : null,
    wallet: wallet ?? { coin: 0, pearl: 0 },
    inventory: Object.fromEntries(inv.map((r) => [r.item_id, r.qty])),
    room: room ?? { layout: [], wall: null, floor: null, version: 1 },
    garden: plots,
    giftsUnread: gifts?.c ?? 0,
    visitors,
    friendsCount: friendsCount?.c ?? 0,
    daily: { claimedToday: daily?.day === today(), streak: daily?.streak ?? 0, lastDay: daily?.day ?? null },
    limits: {
      karungLeft: Math.max(0, s.karung.playsPerDay - plays),
      fishingLeft: Math.max(0, s.fishing.castsPerDay - casts),
      games: {
        panen: Math.max(0, (s as any).games.panen.playsPerDay - (await counter(db, userId, 'game_panen'))),
        memori: Math.max(0, (s as any).games.memori.playsPerDay - (await counter(db, userId, 'game_memori'))),
      },
    },
    announcements,
    events: activeEvents(cat),
    notificationsUnread: unread?.c ?? 0,
    quests: await questSummary(db, userId),
    notifyPrefs: prefs?.notify_prefs ?? {},
  };
}

/** Data publik: katalog + pengaturan yang perlu diketahui client. Di-cache oleh client & service worker. */
export function publicCatalog(cat: Catalog, s: Settings) {
  const now = Date.now();
  return {
    version: cat.version,
    items: cat.items
      .filter((i) => i.active)
      .map((i) => ({
        id: i.id, kind: i.kind, name: i.name, description: i.description,
        price_coin: i.price_coin, price_pearl: i.price_pearl, sell_coin: i.sell_coin, shop: i.shop,
        art: i.art, data: i.data, event_id: i.event_id,
        available_from: i.available_from, available_to: i.available_to,
      })),
    locations: cat.locations.filter((l) => l.enabled),
    events: cat.events.filter((e) => e.active && new Date(e.ends_at).getTime() > now - 86_400_000),
    packages: cat.packages.filter((p) => p.active),
    settings: {
      needs: s.needs,
      actions: s.actions,
      economy: { xpBase: s.economy.xpBase, xpStep: s.economy.xpStep },
      social: s.social,
      daily: s.daily,
      karung: s.karung,
      games: (s as any).games,
      fishing: { castsPerDay: s.fishing.castsPerDay, energiCost: s.fishing.energiCost, windowMs: s.fishing.windowMs },
      garden: s.garden,
      room: s.room,
      features: s.features,
    },
  };
}
