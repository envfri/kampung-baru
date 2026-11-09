import type { FastifyInstance } from 'fastify';
import { addXp, applyNeedDelta, fits, NEED_KEYS, PET_COLORS, PET_EARS, type Needs } from '@kb/shared';
import type { Db } from '../db/index';
import {
  addItem, bad, checkName, coinMultiplier, cooldown, counter, credit, getCatalog, getSettings,
  HttpError, notFound, purchasable, today, track, yesterday, bumpCounter,
} from '../lib/core';
import { requireUser } from '../lib/auth';
import { J, lockPet, petView, playerState, publicCatalog, savePet, currentNeeds } from '../lib/state';
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
  if (parts.includes('room')) out.room = await db.one(`select layout, wall, floor, version from rooms where user_id = $1`, [userId]);
  if (parts.includes('garden')) out.garden = await db.query(`select slot, seed_id, planted_at, ready_at from garden_plots where user_id = $1 order by slot`, [userId]);
  if (parts.includes('limits')) {
    const [k, f] = await Promise.all([counter(db, userId, 'karung'), counter(db, userId, 'fishing')]);
    out.limits = { karungLeft: Math.max(0, s.karung.playsPerDay - k), fishingLeft: Math.max(0, s.fishing.castsPerDay - f) };
  }
  out.quests = await questSummary(db, userId);
  out.serverNow = Date.now();
  return out;
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
    const ear = oneOf(req.body?.ear, 'Telinga', PET_EARS.map((e) => e[0]));
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
      const ear = body.ear !== undefined ? oneOf(body.ear, 'Telinga', PET_EARS.map((e) => e[0])) : pet.ear;
      const wear: Record<string, string> = { ...(pet.wear ?? {}) };
      if (body.wear !== undefined) {
        const w = obj(body.wear, 'wear');
        for (const slot of ['head', 'face', 'neck']) {
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
      await t.query(`update pets set color = $2, ear = $3, wear = $4::text::jsonb where user_id = $1`, [u.id, color, ear, J(wear)]);
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
      const a = s.actions;
      if (type === 'makan') {
        const item = itemId ? cat.byId.get(itemId) : undefined;
        if (!item || item.kind !== 'food') throw bad('invalid_item', 'Pilih makanan dari tas.');
        if (needs.kenyang >= 99) throw bad('full', `${pet.name} masih kenyang.`);
        await addItem(t, u.id, item.id, -1);
        delta = item.data?.effects ?? {};
        xp = a.makan.xp;
      } else if (type === 'mandi') {
        await cooldown(t, u.id, 'mandi', a.mandi.cooldownSec);
        delta = { bersih: a.mandi.bersih };
        xp = a.mandi.xp;
      } else if (type === 'main') {
        if (needs.energi < a.main.minEnergi) throw bad('tired', `${pet.name} kecapekan. Tidur dulu.`);
        await cooldown(t, u.id, 'main', a.main.cooldownSec);
        delta = { ceria: a.main.ceria, energi: a.main.energi, kenyang: a.main.kenyang };
        xp = a.main.xp;
        coins = Math.round(a.main.coins * mult);
      } else if (type === 'tidur') {
        await cooldown(t, u.id, 'tidur', a.tidur.cooldownSec);
        delta = { energi: a.tidur.energi };
        xp = a.tidur.xp;
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
      await savePet(t, u.id, { needs, level: lv.level, xp: lv.xp });
      if (type !== 'elus') await track(t, u.id, 'action', { type });
      else if (xp || Object.keys(delta).length) await questEvent(t, u.id, 'action', { type });
      return { ok: true, result: { type, coins, xp, levelUp: lv.levelsGained > 0 ? lv.level : null }, ...(await patch(t, u.id, ['pet', 'wallet', 'inventory'])) };
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
    if (!Array.isArray(body.layout)) throw bad('invalid', 'Susunan ruangan tidak valid.');
    const [s, cat] = await Promise.all([getSettings(db), getCatalog(db)]);
    const size = s.room.size;
    if (body.layout.length > s.room.maxItems) throw bad('too_many', `Maksimal ${s.room.maxItems} barang di ruangan.`);
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
      const room = await t.one<{ layout: any[]; version: number; wall: string | null; floor: string | null }>(`select layout, version, wall, floor from rooms where user_id = $1 for update`, [u.id]);
      if (!room) throw notFound('Ruangan tidak ditemukan.');
      if (room.version !== version) throw new HttpError(409, 'room_conflict', 'Ruangan diubah dari perangkat lain. Memuat ulang.', { room });
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
      await t.query(`update rooms set layout = $2::text::jsonb, wall = $3, floor = $4, version = version + 1, updated_at = now() where user_id = $1`, [u.id, J(layout), wall, floor]);
      await track(t, u.id, 'room_save', { items: layout.length });
      return { ok: true, ...(await patch(t, u.id, ['room', 'inventory'])) };
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

  const CLIENT_EVENTS = new Set(['session_start', 'tutorial_done', 'open_shop', 'open_map', 'install_prompt', 'installed', 'share_invite', 'open_pearls']);
  app.post('/api/track', { ...auth, config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req: any) => {
    const list = Array.isArray(req.body?.events) ? req.body.events.slice(0, 20) : [];
    for (const e of list) {
      if (typeof e?.name === 'string' && CLIENT_EVENTS.has(e.name)) await track(db, req.user!.id, e.name, typeof e.props === 'object' ? e.props : undefined);
    }
    return { ok: true };
  });
}
