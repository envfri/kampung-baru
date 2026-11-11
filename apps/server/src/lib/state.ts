import { GAMES, chubOf, needsWithSleep, NEED_KEYS, sickOnset, wakeAt, weightNow, type Needs, type Settings } from '@kb/shared';
import type { Db } from '../db/index';
import { maskPhone } from './klikflow';
import { bad, getCatalog, getSettings, activeEvents, today, counter, track, weekKey, type Catalog } from './core';
import { questSummary } from './quests';

export const J = (v: unknown) => JSON.stringify(v ?? null);

export interface PetRow {
  user_id: string; name: string; color: string; ear: string; wear: Record<string, string>;
  level: number; xp: number; kenyang: number; bersih: number; ceria: number; energi: number; needs_at: Date;
  sleep_from: Date | null; sick_at: Date | null; weight: number; crumbs_at: Date;
}

const ms = (d: Date | null | undefined) => (d ? new Date(d).getTime() : 0);
const stored = (p: PetRow): Needs => ({ kenyang: p.kenyang, bersih: p.bersih, ceria: p.ceria, energi: p.energi });
const sleepRule = (s: Settings) => (s as any).sleep as { energiPerHour: number; otherDecayMult: number; maxEnergiToSleep: number; badgeMinMinutes: number };

/** Kapan pet yang sedang tidur bangun sendiri (energi penuh); 0 bila tidak tidur. */
export function petWakeAt(p: PetRow, s: Settings) {
  return p.sleep_from ? wakeAt(p.energi, ms(p.needs_at), sleepRule(s)) : 0;
}

export function currentNeeds(p: PetRow, s: Settings, now = Date.now()): Needs {
  return needsWithSleep(stored(p), ms(p.needs_at), now, s.needs.decayPerHour, p.sleep_from ? sleepRule(s) : null);
}
export const currentWeight = (p: PetRow, s: Settings, now = Date.now()) => weightNow(p.weight ?? 0, ms(p.needs_at), now, (s as any).weight);

/** Sakit sekarang? (tercatat, atau baru saja melewati batas karena dibiarkan). */
export function isSick(p: PetRow, s: Settings, now = Date.now()) {
  if (p.sick_at) return true;
  if (p.sleep_from && petWakeAt(p, s) > now) return false;
  return sickOnset(currentNeeds(p, s, Math.max(ms(p.needs_at), petWakeAt(p, s))), Math.max(ms(p.needs_at), petWakeAt(p, s)), s.needs.decayPerHour, (s as any).health) <= now;
}
export const isAsleep = (p: PetRow, s: Settings, now = Date.now()) => !!p.sleep_from && petWakeAt(p, s) > now;

/** Remah & bulu rontok di lantai saat ini. */
export function crumbsNow(p: PetRow, s: Settings, now = Date.now()) {
  const c = (s as any).crumbs;
  return Math.max(0, Math.min(c.max, Math.floor((now - ms(p.crumbs_at)) / (c.everyMinutes * 60_000))));
}

/**
 * Kunci baris pet untuk diubah. Sekalian merapikan keadaan yang berubah karena waktu:
 * pet yang sudah waktunya bangun dibangunkan, dan pet yang dibiarkan terlalu lama ditandai sakit.
 */
export async function lockPet(db: Db, userId: string) {
  const p = await db.one<PetRow>(`select * from pets where user_id = $1 for update`, [userId]);
  if (!p) return p;
  const s = await getSettings(db);
  return settlePet(db, p, s);
}

export async function settlePet(db: Db, p: PetRow, s: Settings, now = Date.now()) {
  if (p.sleep_from) {
    const wake = petWakeAt(p, s);
    if (wake <= now) await wakePet(db, p, s, wake);
  }
  if (!p.sick_at && isSick(p, s, now)) {
    const from = Math.max(ms(p.needs_at), petWakeAt(p, s));
    const onset = Math.min(now, sickOnset(currentNeeds(p, s, from), from, s.needs.decayPerHour, (s as any).health));
    await db.query(`update pets set sick_at = $2 where user_id = $1`, [p.user_id, new Date(onset)]);
    p.sick_at = new Date(onset);
  }
  return p;
}

/** Bangunkan pet: simpan kebutuhan saat bangun, catat tidur (untuk lencana) bila cukup lama. */
export async function wakePet(db: Db, p: PetRow, s: Settings, at = Date.now()) {
  const n = currentNeeds(p, s, at);
  const w = currentWeight(p, s, at);
  const slept = (at - ms(p.needs_at)) / 60_000;
  await db.query(
    `update pets set kenyang = $2, bersih = $3, ceria = $4, energi = $5, weight = $6, needs_at = $7, sleep_from = null where user_id = $1`,
    [p.user_id, n.kenyang, n.bersih, n.ceria, n.energi, w, new Date(at)],
  );
  Object.assign(p, n, { weight: w, needs_at: new Date(at), sleep_from: null });
  if (slept >= sleepRule(s).badgeMinMinutes) await track(db, p.user_id, 'sleep', { minutes: Math.round(slept) });
  return n;
}

/** Tolak aksi yang butuh pet bangun / sehat, dengan pesan yang ramah. */
export function assertAwake(p: PetRow, s: Settings) {
  if (isAsleep(p, s)) throw bad('asleep', `${p.name} sedang tidur. Bangunkan dulu, ya.`);
}
export function assertHealthy(p: PetRow, s: Settings) {
  if (isSick(p, s)) throw bad('sick', `${p.name} lagi kurang enak badan. Kasih jamu dulu, ya.`);
}

export async function savePet(db: Db, userId: string, fields: Partial<{ needs: Needs; level: number; xp: number; weight: number }>) {
  const n = fields.needs;
  const s = await getSettings(db);
  const loss = Number((s as any).weight?.lossPerDay ?? 0);
  await db.query(
    `update pets set
       weight = case when $2::real is null then coalesce($8, weight)
                     else least(100, greatest(0, coalesce($8, weight - $9::float8 * extract(epoch from now() - needs_at) / 86400))) end,
       kenyang = coalesce($2, kenyang), bersih = coalesce($3, bersih), ceria = coalesce($4, ceria), energi = coalesce($5, energi),
       needs_at = case when $2::real is null then needs_at else now() end,
       level = coalesce($6, level), xp = coalesce($7, xp)
     where user_id = $1`,
    [userId, n?.kenyang ?? null, n?.bersih ?? null, n?.ceria ?? null, n?.energi ?? null, fields.level ?? null, fields.xp ?? null, fields.weight ?? null, loss],
  );
}

export function petView(p: PetRow, s: Settings) {
  const now = Date.now();
  const needs = currentNeeds(p, s, now);
  for (const k of NEED_KEYS) needs[k] = Math.round(needs[k] * 10) / 10;
  const weight = Math.round(currentWeight(p, s, now) * 10) / 10;
  const asleep = isAsleep(p, s, now);
  return {
    name: p.name, color: p.color, ear: p.ear, pattern: (p as any).pattern ?? 'polos', eyes: (p as any).eyes ?? 'bulat', tail: (p as any).tail ?? 'bulat', wear: p.wear ?? {}, level: p.level, xp: p.xp,
    needs, needsAt: now,
    // tidur: client menghitung energi naik dari sini sampai wakeAt
    sleep: asleep ? { from: ms(p.needs_at), wakeAt: petWakeAt(p, s), needs: stored(p) } : null,
    sick: isSick(p, s, now),
    weight, chub: Math.round(chubOf(weight, (s as any).weight) * 100) / 100,
    crumbsAt: ms(p.crumbs_at),
  };
}

/** Ukuran & tema ruangan ditentukan item jenis 'room'-nya (kamar awal: ukuran dari pengaturan). */
export function roomMeta(roomItem: string | null | undefined, cat: Catalog, s: Settings) {
  const it = roomItem ? cat.byId.get(roomItem) : undefined;
  const size = Math.max(4, Math.min(10, Math.round(Number(it?.data?.size ?? s.room.size)) || s.room.size));
  return { size, theme: it?.data?.theme === 'luar' ? 'luar' : 'dalam' };
}

/** Semua ruangan rumah pemain, urut (kamar awal dulu). */
export async function loadRooms(db: Db, userId: string, cat: Catalog, s: Settings, withVersion = true) {
  const rows = await db.query<any>(`select id, room_item, name, layout, wall, floor, version from rooms where user_id = $1 order by sort, id`, [userId]);
  return rows.map((r) => ({ id: r.id, item: r.room_item, name: r.name, layout: r.layout ?? [], wall: r.wall, floor: r.floor, ...(withVersion ? { version: r.version } : {}), ...roomMeta(r.room_item, cat, s) }));
}

/** Semua yang dibutuhkan client setelah masuk. */
export async function playerState(db: Db, userId: string) {
  const [s, cat] = await Promise.all([getSettings(db), getCatalog(db)]);
  const [user, pet, wallet, inv, rooms, plots, gifts, visitors, daily, friendsCount, identities] = await Promise.all([
    db.one<any>(`select id, display_name, friend_code, is_guest, created_at, wa_phone, wa_verified_at, show_online, live_visits, featured_photo, guestbook_seen_at from users where id = $1`, [userId]),
    db.one<PetRow>(`select * from pets where user_id = $1`, [userId]),
    db.one<{ coin: number; pearl: number }>(`select coin, pearl from wallets where user_id = $1`, [userId]),
    db.query<{ item_id: string; qty: number }>(`select item_id, qty from inventory where user_id = $1 and qty > 0`, [userId]),
    loadRooms(db, userId, cat, s),
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
  const [plays, casts, unread, prefs, likes, duels, book, photo] = await Promise.all([
    counter(db, userId, 'karung'),
    counter(db, userId, 'fishing'),
    db.one<{ c: number }>(`select count(*)::int c from notifications where user_id = $1 and read_at is null`, [userId]),
    db.one<{ notify_prefs: any }>(`select notify_prefs from users where id = $1`, [userId]),
    db.one<{ c: number }>(`select count(*)::int c from house_likes where host_id = $1 and week = $2`, [userId, weekKey()]),
    // duel yang menunggu giliranku (ditantang, atau tantanganku yang belum kumainkan)
    db.one<{ c: number }>(
      `select count(*)::int c from duels where status in ('open','live') and expires_at > now()
         and ((opponent_id = $1 and o_score is null) or (challenger_id = $1 and c_score is null))`, [userId]),
    db.one<{ c: number }>(`select count(*)::int c from visit_acts where host_id = $1 and created_at > $2`, [userId, user?.guestbook_seen_at ?? new Date()]),
    user?.featured_photo ? db.one<any>(`select id, pose, members, scene from photos where id = $1`, [user.featured_photo]) : null,
  ]);
  return {
    serverNow: Date.now(),
    catalogVersion: cat.version,
    user: {
      ...user, wa_phone: undefined, wa_verified_at: undefined, guestbook_seen_at: undefined, featured_photo: undefined,
      wa: user?.wa_verified_at ? { phone: maskPhone(user.wa_phone), verified: true } : null,
      identities: identities.map((i) => ({ provider: i.provider, email: i.email })),
    },
    pet: pet ? petView(pet, s) : null,
    wallet: wallet ?? { coin: 0, pearl: 0 },
    inventory: Object.fromEntries(inv.map((r) => [r.item_id, r.qty])),
    rooms,
    // klien lama (sebelum rumah multi-ruangan) membaca `room`
    room: rooms[0] ?? { layout: [], wall: null, floor: null, version: 1 },
    garden: plots,
    giftsUnread: gifts?.c ?? 0,
    visitors,
    friendsCount: friendsCount?.c ?? 0,
    daily: { claimedToday: daily?.day === today(), streak: daily?.streak ?? 0, lastDay: daily?.day ?? null },
    limits: {
      karungLeft: Math.max(0, s.karung.playsPerDay - plays),
      fishingLeft: Math.max(0, s.fishing.castsPerDay - casts),
      games: Object.fromEntries(await Promise.all(Object.keys(GAMES).map(async (id) => [id, Math.max(0, Number((s as any).games?.[id]?.playsPerDay ?? 0) - (await counter(db, userId, 'game_' + id)))]))),
    },
    announcements,
    events: activeEvents(cat),
    notificationsUnread: unread?.c ?? 0,
    quests: await questSummary(db, userId),
    notifyPrefs: prefs?.notify_prefs ?? {},
    likesWeek: likes?.c ?? 0,
    duelsPending: duels?.c ?? 0,
    guestbookUnread: book?.c ?? 0,
    /** foto bareng yang dipajang di lukisan rumah */
    photo: photo ?? null,
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
    activities: cat.activities.filter((a) => a.active).map(({ active, sort, ...a }) => a),
    settings: {
      needs: s.needs,
      actions: s.actions,
      economy: { xpBase: s.economy.xpBase, xpStep: s.economy.xpStep },
      social: s.social,
      daily: s.daily,
      karung: s.karung,
      games: (s as any).games,
      fishing: { castsPerDay: s.fishing.castsPerDay, energiCost: s.fishing.energiCost, windowMs: s.fishing.windowMs },
      sleep: (s as any).sleep,
      health: (s as any).health,
      weight: (s as any).weight,
      crumbs: (s as any).crumbs,
      speech: (s as any).speech,
      garden: s.garden,
      room: s.room,
      house: (s as any).house,
      features: s.features,
    },
  };
}
