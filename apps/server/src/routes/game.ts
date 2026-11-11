import type { FastifyInstance } from 'fastify';
import { ACTIVITY_SPOTS, activityFits, activityMessage, addXp, GAMES, applyNeedDelta, fits, NEED_KEYS, PET_COLORS, PET_PARTS, partLevel, planProblem, type Needs } from '@kb/shared';

const PART_LABEL = { ear: 'Telinga', pattern: 'Motif', eyes: 'Mata', tail: 'Ekor' } as const;
/** Validasi bagian tubuh pet: harus dikenal dan sudah terbuka di level pet sekarang. */
function partFor(kind: keyof typeof PART_LABEL, value: unknown, level: number) {
  const key = oneOf(value, PART_LABEL[kind], PET_PARTS[kind].map((p) => p[0]));
  const need = partLevel(kind, key);
  if (level < need) throw bad('locked', `${PART_LABEL[kind]} ini terbuka di Lv ${need}.`);
  return key;
}
import type { Db } from '../db/index';
import {
  addItem, bad, checkName, coinMultiplier, cooldown, counter, credit, getCatalog, getSettings,
  HttpError, notFound, purchasable, today, track, yesterday, bumpCounter,
} from '../lib/core';
import { requireUser } from '../lib/auth';
import { J, loadRooms, lockPet, maxItemsFor, petView, playerState, publicCatalog, roomMeta, savePet, currentNeeds, currentWeight, assertAwake, assertHealthy, isAsleep, isSick, wakePet, crumbsNow } from '../lib/state';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const roomIdOf = (v: unknown) => {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string' || !UUID.test(v)) throw bad('invalid_room', 'Ruangan tidak valid.');
  return v;
};
import { int, obj, oneOf, reqId, str } from '../lib/validate';
import { claimQuest, questEvent, questList, questSummary } from '../lib/quests';

/** Jalankan mutasi sekali saja per requestId (aman dari klik ganda / retry di sinyal lemah). */
export async function once<T>(db: Db, userId: string, requestId: string | undefined, fn: (t: Db) => Promise<T>): Promise<T> {
  if (requestId) {
    const prev = await db.one<{ response: T }>(`select response from idempotency where user_id = $1 and request_id = $2`, [userId, requestId]);
    if (prev) return prev.response;
  }
  try {
    return await db.tx(async (t) => {
      const res = await fn(t);
      if (requestId) await t.query(`insert into idempotency (user_id, request_id, response) values ($1,$2,$3::text::jsonb)`, [userId, requestId, J(res)]);
      return res;
    });
  } catch (e: any) {
    if (requestId && e?.code === '23505') {
      const prev = await db.one<{ response: T }>(`select response from idempotency where user_id = $1 and request_id = $2`, [userId, requestId]);
      if (prev) return prev.response;
    }
    throw e;
  }
}

/** Bagian state yang berubah setelah aksi, supaya respons tetap kecil. */
export async function patch(db: Db, userId: string, parts: ('pet' | 'wallet' | 'inventory' | 'room' | 'garden' | 'limits')[]) {
  const out: Record<string, unknown> = {};
  const s = await getSettings(db);
  if (parts.includes('pet')) {
    const p = await db.one(`select * from pets where user_id = $1`, [userId]);
    out.pet = p ? petView(p, s) : null;
  }
  if (parts.includes('wallet')) out.wallet = await db.one(`select coin, pearl from wallets where user_id = $1`, [userId]);
  if (parts.includes('inventory')) {
    const rows = await db.query<{ item_id: string; qty: number }>(`select item_id, qty from inventory where user_id = $1 and qty > 0`, [userId]);
    out.inventory = Object.fromEntries(rows.map((r) => [r.item_id, r.qty]));
  }
  if (parts.includes('room')) {
    const rooms = await loadRooms(db, userId, await getCatalog(db), s);
    out.rooms = rooms;
    out.room = rooms[0];
  }
  if (parts.includes('garden')) out.garden = await db.query(`select slot, seed_id, planted_at, ready_at from garden_plots where user_id = $1 order by slot`, [userId]);
  if (parts.includes('limits')) {
    const [k, f] = await Promise.all([counter(db, userId, 'karung'), counter(db, userId, 'fishing')]);
    out.limits = { karungLeft: Math.max(0, s.karung.playsPerDay - k), fishingLeft: Math.max(0, s.fishing.castsPerDay - f), games: await gamesLeft(db, userId, s) };
  }
  out.quests = await questSummary(db, userId);
  out.serverNow = Date.now();
  return out;
}

/** Sisa jatah main hari ini untuk tiap mini-game Balai Main. */
export async function gamesLeft(db: Db, userId: string, s: any) {
  const ids = Object.keys(GAMES);
  const used = await Promise.all(ids.map((id) => counter(db, userId, 'game_' + id)));
  return Object.fromEntries(ids.map((id, i) => [id, Math.max(0, Number(s.games?.[id]?.playsPerDay ?? 0) - used[i])]));
}

/** Tambah XP pet (dan bonus koin saat naik level). Dipakai di banyak tempat. */
export async function grantXp(t: Db, userId: string, pet: { level: number; xp: number }, gain: number) {
  const s = await getSettings(t);
  const r = addXp(pet.level, pet.xp, gain, s.economy);
  if (r.levelsGained > 0 && s.economy.levelUpCoins > 0) await credit(t, userId, 'coin', s.economy.levelUpCoins * r.levelsGained, 'level_up', String(r.level));
  if (r.levelsGained > 0) await track(t, userId, 'level_up', { level: r.level });
  return r;
}

export default async function gameRoutes(app: FastifyInstance, { db }: { db: Db }) {
  const auth = { preHandler: requireUser(db) };

  app.get('/api/catalog', async (req, reply) => {
    const [cat, s] = await Promise.all([getCatalog(db), getSettings(db)]);
    const etag = `"cat-${cat.version}-${JSON.stringify(s).length}"`;
    reply.header('ETag', etag).header('Cache-Control', 'no-cache');
    if (req.headers['if-none-match'] === etag) return reply.code(304).send();
    return publicCatalog(cat, s);
  });

  /* ---------------- pet ---------------- */

  app.post('/api/pet', auth, async (req: any) => {
    const u = req.user!;
    const name = await checkName(db, str(req.body?.name, 'Nama pet')!);
    const owner = req.body?.ownerName ? await checkName(db, str(req.body.ownerName, 'Nama kamu')!) : null;
    const color = oneOf(req.body?.color, 'Warna', PET_COLORS);
    const ear = partFor('ear', req.body?.ear, 1);
    const s = await getSettings(db);
    const st = s.needs.start;
    const r = await db.one(
      `insert into pets (user_id, name, color, ear, kenyang, bersih, ceria, energi) values ($1,$2,$3,$4,$5,$6,$7,$8)
       on conflict (user_id) do nothing returning user_id`,
      [u.id, name, color, ear, st.kenyang, st.bersih, st.ceria, st.energi],
    );
    if (!r) throw new HttpError(409, 'pet_exists', 'Kamu sudah punya pet.');
    // tanpa nama pemilik, pakai nama pet (bukan "Tamu") supaya mudah dikenali teman
    await db.query(`update users set display_name = $2 where id = $1 and ($3::boolean or display_name = 'Tamu')`, [u.id, owner ?? name, !!owner]);
    await track(db, u.id, 'pet_created', { color, ear });
    return { ok: true, state: await playerState(db, u.id) };
  });

  app.post('/api/pet/look', auth, async (req: any) => {
    const u = req.user!;
    const body = obj(req.body, 'body');
    const cat = await getCatalog(db);
    return db.tx(async (t) => {
      const pet = await lockPet(t, u.id);
      if (!pet) throw bad('no_pet', 'Buat pet dulu.');
      const color = body.color !== undefined ? oneOf(body.color, 'Warna', PET_COLORS) : pet.color;
      const ear = body.ear !== undefined ? partFor('ear', body.ear, pet.level) : pet.ear;
      const pattern = body.pattern !== undefined ? partFor('pattern', body.pattern, pet.level) : (pet as any).pattern;
      const eyes = body.eyes !== undefined ? partFor('eyes', body.eyes, pet.level) : (pet as any).eyes;
      const tail = body.tail !== undefined ? partFor('tail', body.tail, pet.level) : (pet as any).tail;
      const wear: Record<string, string> = { ...(pet.wear ?? {}) };
      if (body.wear !== undefined) {
        const w = obj(body.wear, 'wear');
        for (const slot of ['head', 'face', 'neck', 'back']) {
          if (!(slot in w)) continue;
          const id = w[slot];
          if (id === null) { delete wear[slot]; continue; }
          const item = cat.byId.get(String(id));
          if (!item || item.kind !== 'wear' || (item.data?.slot ?? 'head') !== slot) throw bad('invalid_wear', 'Pakaian tidak cocok untuk bagian itu.');
          const own = await t.one(`select qty from inventory where user_id = $1 and item_id = $2 and qty > 0`, [u.id, item.id]);
          if (!own) throw bad('not_owned', 'Kamu belum punya pakaian itu.');
          wear[slot] = item.id;
        }
      }
      await t.query(`update pets set color = $2, ear = $3, wear = $4::text::jsonb, pattern = $5, eyes = $6, tail = $7 where user_id = $1`, [u.id, color, ear, J(wear), pattern, eyes, tail]);
      if (body.wear !== undefined && Object.values(obj(body.wear, 'wear')).some((v) => v)) await track(t, u.id, 'wear');
      return { ok: true, ...(await patch(t, u.id, ['pet'])) };
    });
  });

  /* ---------------- tugas ---------------- */

  app.get('/api/quests', auth, async (req: any) => questList(db, req.user!.id));

  app.post('/api/quests/:id/claim', auth, async (req: any) => {
    const u = req.user!;
    const id = String(req.params.id);
    if (!/^[a-z0-9-]{1,48}$/.test(id)) throw bad('invalid', 'Tugas tidak valid.');
    return db.tx(async (t) => {
      const r = await claimQuest(t, u.id, id);
      return { ok: true, ...r, list: await questList(t, u.id), ...(await patch(t, u.id, ['wallet', 'pet'])) };
    });
  });

  app.post('/api/pet/name', auth, async (req: any) => {
    const name = await checkName(db, str(req.body?.name, 'Nama pet')!);
    await db.query(`update pets set name = $2 where user_id = $1`, [req.user!.id, name]);
    return { ok: true, ...(await patch(db, req.user!.id, ['pet'])) };
  });

  app.post('/api/me/name', auth, async (req: any) => {
    const name = await checkName(db, str(req.body?.name, 'Nama kamu')!);
    await db.query(`update users set display_name = $2 where id = $1`, [req.user!.id, name]);
    return { ok: true, displayName: name };
  });

  /* ---------------- aksi di rumah ---------------- */

  app.post('/api/action', auth, async (req: any) => {
    const u = req.user!;
    const type = oneOf(req.body?.type, 'Aksi', ['makan', 'mandi', 'main', 'tidur', 'elus'] as const);
    // 'tidur' kini = matikan lampu (tidur sungguhan); tetap diterima dari PWA versi lama
    if (type === 'tidur') return sleepStart(u, reqId(req.body?.requestId));
    const itemId = req.body?.itemId ? String(req.body.itemId) : undefined;
    const [s, cat] = await Promise.all([getSettings(db), getCatalog(db)]);
    const mult = coinMultiplier(cat);
    return once(db, u.id, reqId(req.body?.requestId), async (t) => {
      const pet = await lockPet(t, u.id);
      if (!pet) throw bad('no_pet', 'Buat pet dulu.');
      let needs: Needs = currentNeeds(pet, s);
      let delta: Partial<Needs> = {};
      let xp = 0;
      let coins = 0;
      let weight: number | undefined;
      let cured = false;
      const a = s.actions;
      if (type !== 'elus') assertAwake(pet, s);
      if (type === 'makan') {
        const item = itemId ? cat.byId.get(itemId) : undefined;
        if (!item || item.kind !== 'food') throw bad('invalid_item', 'Pilih makanan dari tas.');
        const cure = !!item.data?.cure;
        if (needs.kenyang >= 99 && !(cure && isSick(pet, s))) throw bad('full', `${pet.name} masih kenyang.`);
        await addItem(t, u.id, item.id, -1);
        delta = item.data?.effects ?? {};
        xp = a.makan.xp;
        // kebanyakan makan → berat bertambah (tampak gembul)
        const excess = Math.max(0, needs.kenyang + Number(delta.kenyang ?? 0) - 100);
        weight = Math.min(100, currentWeight(pet, s) + excess * Number((s as any).weight.perExcess ?? 0));
        if (cure && pet.sick_at) {
          await t.query(`update pets set sick_at = null where user_id = $1`, [u.id]);
          cured = true;
          await track(t, u.id, 'cure', { itemId: item.id });
        }
      } else if (type === 'mandi') {
        await cooldown(t, u.id, 'mandi', a.mandi.cooldownSec);
        delta = { bersih: a.mandi.bersih };
        xp = a.mandi.xp;
      } else if (type === 'main') {
        assertHealthy(pet, s);
        if (needs.energi < a.main.minEnergi) throw bad('tired', `${pet.name} kecapekan. Tidur dulu.`);
        await cooldown(t, u.id, 'main', a.main.cooldownSec);
        delta = { ceria: a.main.ceria, energi: a.main.energi, kenyang: a.main.kenyang };
        xp = a.main.xp;
        coins = Math.round(a.main.coins * mult);
      } else {
        // elus: tidak pernah gagal, tapi XP dibatasi per hari dan per beberapa detik
        const cd = await t.one<{ until: Date }>(`select until from cooldowns where user_id = $1 and key = 'elus'`, [u.id]);
        if (!cd || new Date(cd.until).getTime() <= Date.now()) {
          await cooldown(t, u.id, 'elus', a.elus.cooldownSec);
          delta = { ceria: a.elus.ceria };
          const used = await counter(t, u.id, 'elus_xp');
          if (used < a.elus.dailyXpCap) {
            xp = a.elus.xp;
            await bumpCounter(t, u.id, 'elus_xp', Number.MAX_SAFE_INTEGER, xp);
          }
        }
      }
      for (const k of Object.keys(delta)) if (!(NEED_KEYS as readonly string[]).includes(k)) delete (delta as any)[k];
      needs = applyNeedDelta(needs, delta);
      const lv = xp ? await grantXp(t, u.id, pet, xp) : { level: pet.level, xp: pet.xp, levelsGained: 0 };
      if (coins) await credit(t, u.id, 'coin', coins, 'action:' + type);
      // elus saat tidur: hanya membelai, kebutuhan (dan hitungan tidur) tidak diubah
      if (type === 'elus' && isAsleep(pet, s)) return { ok: true, result: { type, coins: 0, xp: 0, levelUp: null, asleep: true }, ...(await patch(t, u.id, ['pet'])) };
      await savePet(t, u.id, { needs, level: lv.level, xp: lv.xp, weight });
      if (type !== 'elus') await track(t, u.id, 'action', { type });
      else if (xp || Object.keys(delta).length) await questEvent(t, u.id, 'action', { type });
      return { ok: true, result: { type, coins, xp, cured, levelUp: lv.levelsGained > 0 ? lv.level : null }, ...(await patch(t, u.id, ['pet', 'wallet', 'inventory'])) };
    });
  });

  /* ---------------- tidur dengan lampu mati ---------------- */

  async function sleepStart(u: { id: string }, requestId?: string) {
    const s = await getSettings(db);
    return once(db, u.id, requestId, async (t) => {
      const pet = await lockPet(t, u.id);
      if (!pet) throw bad('no_pet', 'Buat pet dulu.');
      if (isAsleep(pet, s)) return { ok: true, result: { type: 'tidur', coins: 0, xp: 0, levelUp: null }, ...(await patch(t, u.id, ['pet'])) };
      const needs = currentNeeds(pet, s);
      if (needs.energi >= (s as any).sleep.maxEnergiToSleep) throw bad('not_sleepy', `${pet.name} belum ngantuk. Main dulu, yuk!`);
      await savePet(t, u.id, { needs });
      await t.query(`update pets set sleep_from = now() where user_id = $1`, [u.id]);
      await track(t, u.id, 'sleep_start');
      return { ok: true, result: { type: 'tidur', coins: 0, xp: 0, levelUp: null }, ...(await patch(t, u.id, ['pet'])) };
    });
  }

  app.post('/api/sleep', auth, async (req: any) => {
    const u = req.user!;
    const on = req.body?.on !== false;
    if (on) return sleepStart(u, reqId(req.body?.requestId));
    const s = await getSettings(db);
    return db.tx(async (t) => {
      const pet = await lockPet(t, u.id);
      if (!pet) throw bad('no_pet', 'Buat pet dulu.');
      if (pet.sleep_from) await wakePet(t, pet, s);
      return { ok: true, ...(await patch(t, u.id, ['pet'])) };
    });
  });

  /* ---------------- sapu remah & bulu rontok ---------------- */

  app.post('/api/sweep', auth, async (req: any) => {
    const u = req.user!;
    const s = await getSettings(db);
    const c = (s as any).crumbs;
    return once(db, u.id, reqId(req.body?.requestId), async (t) => {
      const pet = await lockPet(t, u.id);
      if (!pet) throw bad('no_pet', 'Buat pet dulu.');
      const n = crumbsNow(pet, s);
      if (n <= 0) throw bad('no_crumbs', 'Lantainya sudah bersih.');
      // sisa remah tetap di lantai: geser dasar hitungan
      await t.query(`update pets set crumbs_at = now() - ($2::float8 * interval '1 minute') where user_id = $1`, [u.id, (n - 1) * c.everyMinutes]);
      const used = await counter(t, u.id, 'sweep');
      const coins = used < c.dailyMax ? c.coins : 0;
      await bumpCounter(t, u.id, 'sweep', Number.MAX_SAFE_INTEGER);
      if (coins) await credit(t, u.id, 'coin', coins, 'sweep');
      await track(t, u.id, 'sweep');
      return { ok: true, coins, ...(await patch(t, u.id, ['pet', 'wallet'])) };
    });
  });

  /* ---------------- toko ---------------- */

  app.post('/api/shop/buy', auth, async (req: any) => {
    const u = req.user!;
    const itemId = str(req.body?.itemId, 'Item', { max: 64 })!;
    const qty = int(req.body?.qty, 'Jumlah', { min: 1, max: 20, def: 1 });
    const currency = oneOf(req.body?.currency ?? 'coin', 'Mata uang', ['coin', 'pearl'] as const);
    const cat = await getCatalog(db);
    const item = cat.byId.get(itemId);
    if (!purchasable(cat, item)) throw bad('not_for_sale', 'Barang ini sedang tidak dijual.');
    const price = currency === 'coin' ? item!.price_coin : item!.price_pearl;
    if (!price) throw bad('wrong_currency', currency === 'coin' ? 'Barang ini dibeli dengan Mutiara.' : 'Barang ini dibeli dengan koin.');
    if (item!.kind === 'room') {
      const s = await getSettings(db);
      return once(db, u.id, reqId(req.body?.requestId), async (t) => {
        if (await t.one(`select 1 from rooms where user_id = $1 and room_item = $2`, [u.id, itemId])) throw bad('owned', 'Ruangan ini sudah ada di rumahmu.');
        const n = (await t.one<{ c: number; m: number }>(`select count(*)::int c, coalesce(max(sort), 0)::int m from rooms where user_id = $1`, [u.id]))!;
        const max = Number((s as any).house?.maxRooms ?? 6);
        if (n.c >= max) throw bad('max_rooms', `Rumahmu sudah punya ${max} ruangan (batas maksimal).`);
        await credit(t, u.id, currency, -price, 'buy', `${itemId}x1`);
        const deco = (id: unknown, kind: string) => (typeof id === 'string' && cat.byId.get(id)?.kind === kind ? id : null);
        const room = (await t.one<{ id: string }>(
          `insert into rooms (user_id, room_item, name, layout, wall, floor, sort) values ($1,$2,$3,'[]'::jsonb,$4,$5,$6) returning id`,
          [u.id, itemId, item!.name, deco(item!.data?.wall, 'wallpaper'), deco(item!.data?.floor, 'floor'), n.m + 1],
        ))!;
        await track(t, u.id, 'purchase', { itemId, kind: 'room', currency, total: price });
        return { ok: true, roomId: room.id, ...(await patch(t, u.id, ['wallet', 'room'])) };
      });
    }
    return once(db, u.id, reqId(req.body?.requestId), async (t) => {
      await credit(t, u.id, currency, -price * qty, 'buy', `${itemId}x${qty}`);
      await addItem(t, u.id, itemId, qty);
      await track(t, u.id, 'purchase', { itemId, kind: item!.kind, currency, total: price * qty });
      return { ok: true, ...(await patch(t, u.id, ['wallet', 'inventory'])) };
    });
  });

  app.post('/api/shop/sell', auth, async (req: any) => {
    const u = req.user!;
    const itemId = str(req.body?.itemId, 'Item', { max: 64 })!;
    const qty = int(req.body?.qty, 'Jumlah', { min: 1, max: 99, def: 1 });
    const cat = await getCatalog(db);
    const item = cat.byId.get(itemId);
    if (!item || item.sell_coin <= 0) throw bad('not_sellable', 'Barang ini tidak bisa dijual.');
    return once(db, u.id, reqId(req.body?.requestId), async (t) => {
      await addItem(t, u.id, itemId, -qty);
      await credit(t, u.id, 'coin', item.sell_coin * qty, 'sell', `${itemId}x${qty}`);
      await track(t, u.id, 'sell', { itemId, qty });
      return { ok: true, earned: item.sell_coin * qty, ...(await patch(t, u.id, ['wallet', 'inventory'])) };
    });
  });

  /* ---------------- ruangan ---------------- */

  app.post('/api/room', auth, async (req: any) => {
    const u = req.user!;
    const body = obj(req.body, 'body');
    const version = int(body.version, 'Versi', { min: 1 });
    const roomId = roomIdOf(body.roomId);
    if (!Array.isArray(body.layout)) throw bad('invalid', 'Susunan ruangan tidak valid.');
    const [s, cat] = await Promise.all([getSettings(db), getCatalog(db)]);
    const target = await db.one<{ id: string; room_item: string | null; size: number | null }>(
      `select id, room_item, size from rooms where user_id = $1 and ($2::uuid is null or id = $2::uuid) order by sort, id limit 1`, [u.id, roomId]);
    if (!target) throw notFound('Ruangan tidak ditemukan.');
    const size = roomMeta(target.room_item, cat, s, target.size).size;
    const maxItems = maxItemsFor(s, size);
    if (body.layout.length > maxItems) throw bad('too_many', `Maksimal ${maxItems} barang di ruangan ini.`);
    const layout = body.layout.map((p: any) => ({ i: String(p?.i ?? ''), x: int(p?.x, 'x', { min: 0, max: size - 1 }), y: int(p?.y, 'y', { min: 0, max: size - 1 }) }));
    const items: Record<string, any> = {};
    for (const p of layout) {
      const it = cat.byId.get(p.i);
      if (!it || it.kind !== 'furniture') throw bad('invalid_item', 'Ada barang yang bukan mebel.');
      items[it.id] = it;
    }
    // cek tabrakan satu per satu
    const placed: typeof layout = [];
    for (const p of layout) {
      if (!fits(items[p.i], p.x, p.y, placed, items, size)) throw bad('overlap', 'Ada barang yang bertumpuk atau keluar ruangan.');
      placed.push(p);
    }
    return db.tx(async (t) => {
      const room = await t.one<{ layout: any[]; version: number; wall: string | null; floor: string | null }>(`select layout, version, wall, floor from rooms where id = $1 and user_id = $2 for update`, [target.id, u.id]);
      if (!room) throw notFound('Ruangan tidak ditemukan.');
      if (room.version !== version) throw new HttpError(409, 'room_conflict', 'Ruangan diubah dari perangkat lain. Memuat ulang.', { room: { ...room, id: target.id } });
      const count = (arr: any[]) => arr.reduce((m: Record<string, number>, p: any) => ((m[p.i] = (m[p.i] ?? 0) + 1), m), {});
      const before = count(room.layout ?? []), after = count(layout);
      for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) {
        const diff = (after[id] ?? 0) - (before[id] ?? 0);
        if (diff !== 0) await addItem(t, u.id, id, -diff);
      }
      const theme = async (key: 'wall' | 'floor', kind: string) => {
        const v = body[key];
        if (v === undefined) return room[key];
        if (v === null) return null;
        const it = cat.byId.get(String(v));
        if (!it || it.kind !== kind) throw bad('invalid_item', 'Dekorasi tidak valid.');
        if (v !== room[key]) {
          const own = await t.one(`select 1 from inventory where user_id = $1 and item_id = $2 and qty > 0`, [u.id, it.id]);
          if (!own) throw bad('not_owned', 'Kamu belum punya dekorasi itu.');
        }
        return it.id;
      };
      const wall = await theme('wall', 'wallpaper');
      const floor = await theme('floor', 'floor');
      await t.query(`update rooms set layout = $2::text::jsonb, wall = $3, floor = $4, version = version + 1, updated_at = now() where id = $1`, [target.id, J(layout), wall, floor]);
      await track(t, u.id, 'room_save', { items: layout.length });
      return { ok: true, ...(await patch(t, u.id, ['room', 'inventory'])) };
    });
  });

  /** Denah buatan pemain masih sah? Bila tidak (bertumpuk / terpisah), semua ruangan kembali disusun otomatis. */
  async function resetPlanIfBroken(t: Db, userId: string, cat: any, s: any) {
    const rows = await t.query<{ id: string; room_item: string | null; size: number | null; gx: number | null; gy: number | null }>(
      `select id, room_item, size, gx, gy from rooms where user_id = $1 order by sort, id`, [userId]);
    const fixed = rows.filter((r) => r.gx !== null && r.gy !== null);
    if (!fixed.length) return false;
    const problem = planProblem(fixed.map((r) => ({ id: r.id, size: roomMeta(r.room_item, cat, s, r.size).size, gx: r.gx!, gy: r.gy! })));
    if (!problem) return false;
    await t.query(`update rooms set gx = null, gy = null where user_id = $1`, [userId]);
    return true;
  }

  /** Atur denah sendiri: simpan letak semua ruangan (harus tidak bertumpuk & saling menempel), atau kembali otomatis. */
  app.post('/api/room/plan', auth, async (req: any) => {
    const u = req.user!;
    const body = obj(req.body ?? {}, 'Denah');
    const [s, cat] = await Promise.all([getSettings(db), getCatalog(db)]);
    return db.tx(async (t) => {
      const rows = await t.query<{ id: string; room_item: string | null; size: number | null }>(
        `select id, room_item, size from rooms where user_id = $1 order by sort, id for update`, [u.id]);
      if (body.auto === true) {
        await t.query(`update rooms set gx = null, gy = null where user_id = $1`, [u.id]);
        return { ok: true, ...(await patch(t, u.id, ['room'])) };
      }
      const list = Array.isArray(body.rooms) ? body.rooms : null;
      if (!list || list.length !== rows.length) throw bad('invalid', 'Denah harus berisi semua ruanganmu.');
      const pos = new Map<string, { gx: number; gy: number }>();
      for (const p of list) {
        const id = String(p?.id ?? '');
        if (!rows.some((r) => r.id === id) || pos.has(id)) throw bad('invalid', 'Ruangan di denah tidak dikenal.');
        pos.set(id, { gx: int(p?.gx, 'Letak', { min: -200, max: 200 }), gy: int(p?.gy, 'Letak', { min: -200, max: 200 }) });
      }
      const plan = rows.map((r) => ({ id: r.id, size: roomMeta(r.room_item, cat, s, r.size).size, ...pos.get(r.id)! }));
      const problem = planProblem(plan);
      if (problem === 'overlap') throw bad('plan_overlap', 'Ada ruangan yang bertumpuk. Geser dulu supaya tidak menumpuk.');
      if (problem === 'apart') throw bad('plan_apart', 'Semua ruangan harus menempel ke ruangan lain supaya ada pintunya.');
      if (problem) throw bad('invalid', 'Letak ruangan tidak valid.');
      // simpan relatif terhadap pojok belakang rumah
      const x0 = Math.min(...plan.map((r) => r.gx)), y0 = Math.min(...plan.map((r) => r.gy));
      for (const r of plan) await t.query(`update rooms set gx = $2, gy = $3, updated_at = now() where id = $1`, [r.id, r.gx - x0, r.gy - y0]);
      await track(t, u.id, 'house_plan', { rooms: plan.length });
      return { ok: true, ...(await patch(t, u.id, ['room'])) };
    });
  });

  /** Perluas ruangan: lantai bertambah di sisi depan, mebel yang sudah ada tetap di tempatnya. */
  app.post('/api/room/expand', auth, async (req: any) => {
    const u = req.user!;
    const roomId = roomIdOf(req.body?.roomId);
    const [s, cat] = await Promise.all([getSettings(db), getCatalog(db)]);
    return db.tx(async (t) => {
      const room = await t.one<{ id: string; room_item: string | null; size: number | null; name: string }>(
        `select id, room_item, size, name from rooms where user_id = $1 and ($2::uuid is null or id = $2::uuid) order by sort, id limit 1 for update`, [u.id, roomId]);
      if (!room) throw notFound('Ruangan tidak ditemukan.');
      const meta = roomMeta(room.room_item, cat, s, room.size);
      if (!meta.expand) throw bad('max_size', `${room.name} sudah seluas mungkin (${meta.size}×${meta.size}).`);
      if (meta.expand.coins) await credit(t, u.id, 'coin', -meta.expand.coins, 'room_expand', `${room.id}:${meta.expand.size}`);
      await t.query(`update rooms set size = $2, version = version + 1, updated_at = now() where id = $1`, [room.id, meta.expand.size]);
      await track(t, u.id, 'room_expand', { size: meta.expand.size, coins: meta.expand.coins });
      // denah buatan pemain yang jadi bertumpuk / terpisah karena ruangan membesar: kembali disusun otomatis
      const planReset = await resetPlanIfBroken(t, u.id, cat, s);
      return { ok: true, roomId: room.id, size: meta.expand.size, coins: meta.expand.coins, planReset, ...(await patch(t, u.id, ['wallet', 'room'])) };
    });
  });

  /* ---------------- aktivitas di rumah (pakai mebel, lihat jendela/lukisan) ---------------- */

  app.post('/api/activity', auth, async (req: any) => {
    const u = req.user!;
    const b = obj(req.body, 'body');
    const id = str(b.activityId, 'Aktivitas', { max: 48 })!;
    const roomId = roomIdOf(b.roomId);
    const spot = b.spot !== undefined && b.spot !== null ? oneOf(b.spot, 'Bagian ruangan', Object.keys(ACTIVITY_SPOTS)) : null;
    const index = spot ? -1 : int(b.index, 'Mebel', { min: 0, max: 500 });
    const [s, cat] = await Promise.all([getSettings(db), getCatalog(db)]);
    const act = cat.activities.find((a) => a.id === id && a.active);
    if (!act) throw bad('invalid_activity', 'Aktivitas ini sedang tidak tersedia.');
    const mult = coinMultiplier(cat);
    return once(db, u.id, reqId(b.requestId), async (t) => {
      const room = await t.one<{ room_item: string | null; layout: any[] }>(
        `select room_item, layout from rooms where user_id = $1 and ($2::uuid is null or id = $2::uuid) order by sort, id limit 1`, [u.id, roomId]);
      if (!room) throw notFound('Ruangan tidak ditemukan.');
      let target = '';
      if (spot) {
        if (roomMeta(room.room_item, cat, s).theme === 'luar' || !activityFits(act.targets, null, spot)) throw bad('invalid_target', 'Aktivitas ini tidak bisa dilakukan di situ.');
        target = ACTIVITY_SPOTS[spot].toLowerCase();
      } else {
        const placed = (room.layout ?? [])[index];
        const it = placed ? cat.byId.get(placed.i) : undefined;
        if (!it || !activityFits(act.targets, it as any)) throw bad('invalid_target', 'Mebel itu tidak bisa dipakai untuk aktivitas ini.');
        target = it.name;
      }
      const pet = await lockPet(t, u.id);
      if (!pet) throw bad('no_pet', 'Buat pet dulu.');
      if (pet.level < (act.min_level ?? 1)) throw bad('locked', `Aktivitas ini terbuka di Lv ${act.min_level}.`);
      assertAwake(pet, s);
      let needs = currentNeeds(pet, s);
      const delta: Partial<Needs> = {};
      for (const k of NEED_KEYS) { const v = Math.round(Number(act.effects?.[k]) || 0); if (v) delta[k] = v; }
      const berat = Math.round(Number(act.effects?.berat) || 0);
      if ((delta.energi ?? 0) < 0 || berat < 0) assertHealthy(pet, s);
      if ((delta.energi ?? 0) < 0 && needs.energi + (delta.energi ?? 0) < 0) throw bad('tired', `${pet.name} kecapekan. Tidur dulu.`);
      await cooldown(t, u.id, 'act:' + act.id, act.cooldown_sec);
      if (act.daily_limit > 0) await bumpCounter(t, u.id, 'act:' + act.id, act.daily_limit);
      needs = applyNeedDelta(needs, delta);
      const lv = act.xp ? await grantXp(t, u.id, pet, act.xp) : { level: pet.level, xp: pet.xp, levelsGained: 0 };
      const coins = act.coins ? Math.round(act.coins * mult) : 0;
      if (coins) await credit(t, u.id, 'coin', coins, 'activity', act.id);
      const rewardItem = act.reward_item && cat.byId.get(act.reward_item) ? act.reward_item : null;
      if (rewardItem) await addItem(t, u.id, rewardItem, 1);
      const weight = berat ? Math.max(0, Math.min(100, currentWeight(pet, s) + berat)) : undefined;
      await savePet(t, u.id, { needs, level: lv.level, xp: lv.xp, weight });
      await track(t, u.id, 'activity', { id: act.id, anim: act.anim });
      if (berat < 0) await track(t, u.id, 'exercise', { id: act.id });
      return {
        ok: true,
        result: { id: act.id, coins, xp: act.xp, item: rewardItem, cooldownSec: act.cooldown_sec, levelUp: lv.levelsGained > 0 ? lv.level : null, message: activityMessage(act, pet.name, target) },
        ...(await patch(t, u.id, ['pet', 'wallet', 'inventory'])),
      };
    });
  });

  /* ---------------- hadiah harian ---------------- */

  app.post('/api/daily', auth, async (req: any) => {
    const u = req.user!;
    const [s, cat] = await Promise.all([getSettings(db), getCatalog(db)]);
    return db.tx(async (t) => {
      const last = await t.one<{ day: string; streak: number }>(`select day::text as day, streak from daily_claims where user_id = $1 order by day desc limit 1`, [u.id]);
      if (last?.day === today()) throw bad('claimed', 'Hadiah hari ini sudah diambil.');
      const streak = last?.day === yesterday() ? last.streak + 1 : 1;
      await t.query(`insert into daily_claims (user_id, day, streak) values ($1,$2,$3)`, [u.id, today(), streak]);
      const list = s.daily.coins.length ? s.daily.coins : [20];
      const idx = (streak - 1) % list.length;
      const coins = Math.round(list[idx] * coinMultiplier(cat));
      await credit(t, u.id, 'coin', coins, 'daily', String(streak));
      let pearls = 0;
      if (idx === list.length - 1 && s.daily.day7Pearls > 0) {
        pearls = s.daily.day7Pearls;
        await credit(t, u.id, 'pearl', pearls, 'daily', String(streak));
      }
      await track(t, u.id, 'daily_claim', { streak });
      return { ok: true, streak, coins, pearls, daily: { claimedToday: true, streak, lastDay: today() }, ...(await patch(t, u.id, ['wallet'])) };
    });
  });

  /* ---------------- analitik dari client ---------------- */

  const CLIENT_EVENTS = new Set(['session_start', 'tutorial_done', 'open_shop', 'open_map', 'install_prompt', 'installed', 'share_invite', 'open_pearls', 'save_nudge', 'save_nudge_later']);
  app.post('/api/track', { ...auth, config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req: any) => {
    const list = Array.isArray(req.body?.events) ? req.body.events.slice(0, 20) : [];
    for (const e of list) {
      if (typeof e?.name === 'string' && CLIENT_EVENTS.has(e.name)) await track(db, req.user!.id, e.name, typeof e.props === 'object' ? e.props : undefined);
    }
    return { ok: true };
  });
}
