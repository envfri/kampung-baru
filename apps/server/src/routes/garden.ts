import type { FastifyInstance } from 'fastify';
import { randomInt } from 'node:crypto';
import { GARDEN_PERK_LEVEL, gardenState, type Settings } from '@kb/shared';
import type { Db } from '../db/index';
import { addItem, bad, bumpCounter, counter, credit, forbidden, getCatalog, getSettings, notFound, purchasable, track, type Catalog, type CatalogItem } from '../lib/core';
import { requireUser } from '../lib/auth';
import { lockPet, savePet } from '../lib/state';
import { bool, int, str } from '../lib/validate';
import { grantXp, patch } from './game';

/** Item pupuk: memotong sisa waktu tumbuh (persen di pengaturan garden.fertilizerPct). */
export const PUPUK = 'pupuk';
const PARTS = ['garden', 'inventory', 'wallet'] as const;

/** Tingkat kebun tersimpan pemain. `lock` mengunci baris pemain sampai transaksi selesai. */
async function storedLevel(t: Db, userId: string, lock = false) {
  const r = await t.one<{ garden_level: number }>(`select garden_level from users where id = $1${lock ? ' for update' : ''}`, [userId]);
  return Number(r?.garden_level ?? 1);
}

function seedOf(cat: Catalog, id: string) {
  const seed = cat.byId.get(id);
  const grow = Number(seed?.data?.growMinutes);
  if (!seed || seed.kind !== 'seed' || !(grow > 0) || !cat.byId.get(seed.data?.yieldItem)) throw bad('invalid_seed', 'Bibit tidak valid.');
  return { seed, grow };
}

const pctOf = (v: unknown, max: number) => Math.min(max, Math.max(0, Number(v) || 0)) / 100;

/** Lama tumbuh (detik) saat ditanam; Tanah subur (Kebun Lv5) mempercepat. */
function growSec(minutes: number, level: number, s: Settings) {
  const cut = level >= GARDEN_PERK_LEVEL.fertileSoil ? pctOf(s.garden.fertileSoilPct, 50) : 0;
  return Math.max(1, Math.round(minutes * 60 * (1 - cut)));
}

/**
 * Panen beberapa petak sekaligus (sudah dicek siap & dikunci pemanggil): hasil masuk tas,
 * peluang +1 dari orang-orangan sawah, XP per bibit dengan batas harian, dan progres tugas per petak.
 */
async function harvestPlots(t: Db, userId: string, plots: { slot: number; seed_id: string }[], cat: Catalog, s: Settings, level: number) {
  await t.query(`delete from garden_plots where user_id = $1 and slot = any($2::int[])`, [userId, plots.map((p) => p.slot)]);
  const got = new Map<string, number>();
  let bonus = 0, xp = 0;
  const luck = level >= GARDEN_PERK_LEVEL.scarecrow ? pctOf(s.garden.scarecrowPct, 100) : 0;
  for (const p of plots) {
    const seed = cat.byId.get(p.seed_id);
    const yieldItem = seed?.data?.yieldItem;
    let qty = Math.max(1, Math.round(Number(seed?.data?.yieldQty) || 1));
    if (luck > 0 && randomInt(0, 10_000) < luck * 10_000) { qty += 1; bonus++; }
    if (yieldItem && cat.byId.get(yieldItem)) got.set(yieldItem, (got.get(yieldItem) ?? 0) + qty);
    const own = Number(seed?.data?.harvestXp);
    xp += Math.max(0, Math.round(Number.isFinite(own) ? own : Number(s.garden.harvestXp) || 0));
  }
  for (const [id, qty] of got) await addItem(t, userId, id, qty);
  // XP panen dibatasi per hari supaya tanaman 10 menit tidak jadi ladang XP
  const cap = Math.max(0, Math.round(Number(s.garden.xpCapPerDay) || 0));
  if (cap > 0 && xp > 0) xp = Math.max(0, Math.min(xp, cap - (await counter(t, userId, 'garden_xp'))));
  let levelUp: number | null = null;
  if (xp > 0) {
    if (cap > 0) await bumpCounter(t, userId, 'garden_xp', cap, xp);
    const pet = await lockPet(t, userId);
    if (pet) {
      const lv = await grantXp(t, userId, pet, xp);
      await savePet(t, userId, { level: lv.level, xp: lv.xp });
      if (lv.levelsGained) levelUp = lv.level;
    }
  }
  for (const p of plots) await track(t, userId, 'harvest', { seedId: p.seed_id });
  return { count: plots.length, items: [...got].map(([itemId, qty]) => ({ itemId, qty })), bonus, xp, levelUp };
}

export default async function gardenRoutes(app: FastifyInstance, { db }: { db: Db }) {
  const auth = { preHandler: requireUser(db) };
  // katalog & pengaturan dimuat di luar transaksi (PGlite hanya punya satu koneksi)
  const load = async () => {
    const [s, cat] = await Promise.all([getSettings(db), getCatalog(db)]);
    if (!s.features.garden) throw forbidden('Kebun sedang ditutup.');
    return { s, cat };
  };

  /** Tanam satu petak, atau semua petak kosong (Kebun Lv4). `buy`: kekurangan bibit langsung dibeli. */
  app.post('/api/garden/plant', auth, async (req: any) => {
    const u = req.user!;
    const { s, cat } = await load();
    const all = bool(req.body?.all), buy = bool(req.body?.buy);
    const { seed, grow } = seedOf(cat, str(req.body?.seedId, 'Bibit', { max: 64 })!);
    return db.tx(async (t) => {
      const g = gardenState(s.garden, await storedLevel(t, u.id, true));
      if (all && g.level < GARDEN_PERK_LEVEL.plantAll) throw bad('locked', `Tanam semua terbuka di Kebun Lv ${GARDEN_PERK_LEVEL.plantAll} (gubuk alat).`);
      const one = all && (req.body?.slot === undefined || req.body?.slot === null) ? -1 : int(req.body?.slot, 'Petak', { min: 0, max: g.slots - 1 });
      const pet = await t.one<{ level: number }>(`select level from pets where user_id = $1`, [u.id]);
      const need = Math.max(1, Number(seed.data?.minLevel) || 1);
      if ((pet?.level ?? 1) < need) throw bad('locked', `${seed.name} terbuka di Lv ${need}.`);
      const taken = new Set((await t.query<{ slot: number }>(`select slot from garden_plots where user_id = $1`, [u.id])).map((r) => r.slot));
      if (one >= 0 && taken.has(one)) throw bad('occupied', 'Petak ini sudah ditanami.');
      // petak yang diketuk selalu duluan, lalu petak kosong lain (Tanam semua)
      let targets = all ? [...(one >= 0 ? [one] : []), ...Array.from({ length: g.slots }, (_, i) => i).filter((i) => i !== one && !taken.has(i))] : [one];
      if (!targets.length) throw bad('full', 'Semua petak sudah ditanami.');
      const cap = Math.max(1, Math.round(Number(s.garden.plantsPerDay) || 300));
      const left = cap - (await counter(t, u.id, 'garden_plant'));
      if (left <= 0) throw bad('daily_limit', `Jatah tanam hari ini (${cap} petak) sudah habis. Besok lagi, ya.`);
      targets = targets.slice(0, left);
      // bibit di tas dipakai dulu
      const have = Number((await t.one<{ qty: number }>(`select qty from inventory where user_id = $1 and item_id = $2`, [u.id, seed.id]))?.qty ?? 0);
      let bought = 0;
      if (have < targets.length) {
        if (buy) {
          if (!purchasable(cat, seed) || !(seed.price_coin > 0)) throw bad('not_for_sale', `${seed.name} sedang tidak dijual.`);
          bought = targets.length - have;
        } else if (have === 0) throw bad('not_owned', 'Bibit ini tidak ada di tas.');
        else targets = targets.slice(0, have);
      }
      if (bought) {
        await credit(t, u.id, 'coin', -seed.price_coin * bought, 'buy', `${seed.id}x${bought}`);
        await track(t, u.id, 'purchase', { itemId: seed.id, kind: 'seed', currency: 'coin', total: seed.price_coin * bought });
      }
      if (targets.length - bought > 0) await addItem(t, u.id, seed.id, -(targets.length - bought));
      await bumpCounter(t, u.id, 'garden_plant', cap, targets.length);
      const sec = growSec(grow, g.level, s);
      await t.query(
        `insert into garden_plots (user_id, slot, seed_id, ready_at, grow_sec)
         select $1, x, $2, now() + ($3::int * interval '1 second'), $3 from unnest($4::int[]) as x`,
        [u.id, seed.id, sec, targets],
      );
      for (const _ of targets) await track(t, u.id, 'plant', { seedId: seed.id });
      return { ok: true, planted: targets.length, slots: targets, bought, cost: bought * seed.price_coin, ...(await patch(t, u.id, [...PARTS])) };
    });
  });

  app.post('/api/garden/harvest', auth, async (req: any) => {
    const u = req.user!;
    const slot = int(req.body?.slot, 'Petak', { min: 0, max: 99 });
    const [s, cat] = await Promise.all([getSettings(db), getCatalog(db)]);
    return db.tx(async (t) => {
      const plot = await t.one<{ slot: number; seed_id: string; ready_at: Date }>(`select slot, seed_id, ready_at from garden_plots where user_id = $1 and slot = $2 for update`, [u.id, slot]);
      if (!plot) throw notFound('Petak ini kosong.');
      if (new Date(plot.ready_at).getTime() > Date.now()) throw bad('not_ready', 'Tanamannya belum siap dipanen.');
      const r = await harvestPlots(t, u.id, [plot], cat, s, gardenState(s.garden, await storedLevel(t, u.id)).level);
      const h = r.items[0] ?? { itemId: cat.byId.get(plot.seed_id)?.data?.yieldItem, qty: 0 };
      return { ok: true, harvested: { ...h, bonus: r.bonus > 0 }, ...r, ...(await patch(t, u.id, ['garden', 'inventory', 'pet', 'wallet'])) };
    });
  });

  /** Panen semua petak yang siap dalam satu transaksi. */
  app.post('/api/garden/harvest-all', auth, async (req: any) => {
    const u = req.user!;
    const [s, cat] = await Promise.all([getSettings(db), getCatalog(db)]);
    return db.tx(async (t) => {
      const plots = await t.query<{ slot: number; seed_id: string }>(`select slot, seed_id from garden_plots where user_id = $1 and ready_at <= now() order by slot for update`, [u.id]);
      if (!plots.length) throw bad('nothing_ready', 'Belum ada tanaman yang siap dipanen.');
      const r = await harvestPlots(t, u.id, plots, cat, s, gardenState(s.garden, await storedLevel(t, u.id)).level);
      return { ok: true, ...r, ...(await patch(t, u.id, ['garden', 'inventory', 'pet', 'wallet'])) };
    });
  });

  /** Siram (gratis, sekali per tanam): sisa waktu berkurang waterPct% dari lama tumbuh. `all`: semua petak (Kebun Lv3). */
  app.post('/api/garden/water', auth, async (req: any) => {
    const u = req.user!;
    const { s } = await load();
    const all = bool(req.body?.all);
    const slot = all ? null : int(req.body?.slot, 'Petak', { min: 0, max: 99 });
    return db.tx(async (t) => {
      const g = gardenState(s.garden, await storedLevel(t, u.id));
      if (all && g.level < GARDEN_PERK_LEVEL.waterAll) throw bad('locked', `Siram semua terbuka di Kebun Lv ${GARDEN_PERK_LEVEL.waterAll} (gentong air).`);
      if (slot !== null) {
        const p = await t.one<{ ready_at: Date; watered_at: Date | null }>(`select ready_at, watered_at from garden_plots where user_id = $1 and slot = $2 for update`, [u.id, slot]);
        if (!p) throw notFound('Petak ini kosong.');
        if (new Date(p.ready_at).getTime() <= Date.now()) throw bad('ready', 'Tanaman ini sudah siap dipanen.');
        if (p.watered_at) throw bad('watered', 'Tanaman ini sudah disiram.');
      }
      const rows = await t.query<{ slot: number }>(
        `update garden_plots set watered_at = now(),
                ready_at = greatest(now(), ready_at - (coalesce(grow_sec, 0) * $3::float8) * interval '1 second')
          where user_id = $1 and ($2::int is null or slot = $2) and watered_at is null and ready_at > now() returning slot`,
        [u.id, slot, pctOf(s.garden.waterPct, 90)],
      );
      if (!rows.length) throw bad('nothing', 'Tidak ada tanaman yang perlu disiram.');
      for (const r of rows) await track(t, u.id, 'water', { slot: r.slot });
      return { ok: true, watered: rows.length, ...(await patch(t, u.id, ['garden'])) };
    });
  });

  /** Pupuk (1 item, sekali per tanam): sisa waktu berkurang fertilizerPct% dari lama tumbuh. `buy`: beli 1 pupuk bila tidak punya. */
  app.post('/api/garden/fertilize', auth, async (req: any) => {
    const u = req.user!;
    const { s, cat } = await load();
    const slot = int(req.body?.slot, 'Petak', { min: 0, max: 99 });
    const buy = bool(req.body?.buy);
    return db.tx(async (t) => {
      const p = await t.one<{ ready_at: Date; fertilized_at: Date | null }>(`select ready_at, fertilized_at from garden_plots where user_id = $1 and slot = $2 for update`, [u.id, slot]);
      if (!p) throw notFound('Petak ini kosong.');
      if (new Date(p.ready_at).getTime() <= Date.now()) throw bad('ready', 'Tanaman ini sudah siap dipanen.');
      if (p.fertilized_at) throw bad('fertilized', 'Tanaman ini sudah dipupuk.');
      const have = Number((await t.one<{ qty: number }>(`select qty from inventory where user_id = $1 and item_id = $2`, [u.id, PUPUK]))?.qty ?? 0);
      let bought = false;
      if (have > 0) await addItem(t, u.id, PUPUK, -1);
      else {
        const it = cat.byId.get(PUPUK) as CatalogItem | undefined;
        if (!buy) throw bad('not_owned', 'Belum punya pupuk. Beli di Pasar Pagi.');
        if (!it || !purchasable(cat, it) || !(it.price_coin > 0)) throw bad('not_for_sale', 'Pupuk sedang tidak dijual.');
        await credit(t, u.id, 'coin', -it.price_coin, 'buy', `${PUPUK}x1`);
        await track(t, u.id, 'purchase', { itemId: PUPUK, kind: it.kind, currency: 'coin', total: it.price_coin });
        bought = true;
      }
      await t.query(
        `update garden_plots set fertilized_at = now(),
                ready_at = greatest(now(), ready_at - (coalesce(grow_sec, 0) * $3::float8) * interval '1 second')
          where user_id = $1 and slot = $2`,
        [u.id, slot, pctOf(s.garden.fertilizerPct, 90)],
      );
      await track(t, u.id, 'fertilize', { slot });
      return { ok: true, bought, ...(await patch(t, u.id, [...PARTS])) };
    });
  });

  /** Perluas kebun satu tingkat: bayar koin & syarat level pet, dicek di dalam satu transaksi. */
  app.post('/api/garden/expand', auth, async (req: any) => {
    const u = req.user!;
    const { s } = await load();
    const to = req.body?.to === undefined || req.body?.to === null ? null : int(req.body.to, 'Tingkat', { min: 1, max: 99 });
    return db.tx(async (t) => {
      const g = gardenState(s.garden, await storedLevel(t, u.id, true));
      if (to !== null && to !== g.level + 1) throw bad('stale', `Kebunmu sudah Lv ${g.level}.`);
      if (!g.next) throw bad('max_level', 'Kebunmu sudah paling luas.');
      const pet = await t.one<{ level: number; name: string }>(`select level, name from pets where user_id = $1 for update`, [u.id]);
      if (!pet) throw bad('no_pet', 'Buat pet dulu.');
      if (pet.level < g.next.petLevel) throw bad('pet_level', `Butuh pet Lv ${g.next.petLevel}. ${pet.name} baru Lv ${pet.level}.`);
      if (g.next.coins > 0) await credit(t, u.id, 'coin', -g.next.coins, 'garden_expand', `lv${g.level + 1}`);
      await t.query(`update users set garden_level = $2 where id = $1`, [u.id, g.level + 1]);
      await track(t, u.id, 'garden_expand', { level: g.level + 1, coins: g.next.coins });
      return { ok: true, level: g.level + 1, slots: g.next.slots, coins: g.next.coins, ...(await patch(t, u.id, ['garden', 'wallet'])) };
    });
  });
}
