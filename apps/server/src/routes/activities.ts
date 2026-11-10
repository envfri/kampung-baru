import type { FastifyInstance } from 'fastify';
import { randomInt } from 'node:crypto';
import { applyNeedDelta, karungRace, KARUNG_HOPS, KARUNG_MAX_TAPS_PER_SEC } from '@kb/shared';
import type { Db } from '../db/index';
import { addItem, bad, bumpCounter, coinMultiplier, credit, forbidden, getCatalog, getSettings, notFound, purchasable, track } from '../lib/core';
import { requireUser } from '../lib/auth';
import { assertAwake, assertHealthy, currentNeeds, lockPet, savePet } from '../lib/state';
import { int, str } from '../lib/validate';
import { grantXp, patch } from './game';

const UUID = /^[0-9a-f-]{36}$/i;

export default async function activityRoutes(app: FastifyInstance, { db }: { db: Db }) {
  const auth = { preHandler: requireUser(db) };

  /* ---------------- Kebun ---------------- */

  app.post('/api/garden/plant', auth, async (req: any) => {
    const u = req.user!;
    const s = await getSettings(db);
    if (!s.features.garden) throw forbidden('Kebun sedang ditutup.');
    const slot = int(req.body?.slot, 'Petak', { min: 0, max: s.garden.slots - 1 });
    const seedId = str(req.body?.seedId, 'Bibit', { max: 64 })!;
    const cat = await getCatalog(db);
    const seed = cat.byId.get(seedId);
    const grow = Number(seed?.data?.growMinutes);
    if (!seed || seed.kind !== 'seed' || !(grow > 0) || !cat.byId.get(seed.data?.yieldItem)) throw bad('invalid_seed', 'Bibit tidak valid.');
    return db.tx(async (t) => {
      const taken = await t.one(`select 1 from garden_plots where user_id = $1 and slot = $2`, [u.id, slot]);
      if (taken) throw bad('occupied', 'Petak ini sudah ditanami.');
      await addItem(t, u.id, seedId, -1);
      await t.query(`insert into garden_plots (user_id, slot, seed_id, ready_at) values ($1,$2,$3, now() + ($4::int * interval '1 minute'))`, [u.id, slot, seedId, Math.round(grow)]);
      await track(t, u.id, 'plant', { seedId });
      return { ok: true, ...(await patch(t, u.id, ['garden', 'inventory'])) };
    });
  });

  app.post('/api/garden/harvest', auth, async (req: any) => {
    const u = req.user!;
    const s = await getSettings(db);
    const slot = int(req.body?.slot, 'Petak', { min: 0, max: 99 });
    const cat = await getCatalog(db);
    return db.tx(async (t) => {
      const plot = await t.one<{ seed_id: string; ready_at: Date }>(`select seed_id, ready_at from garden_plots where user_id = $1 and slot = $2 for update`, [u.id, slot]);
      if (!plot) throw notFound('Petak ini kosong.');
      if (new Date(plot.ready_at).getTime() > Date.now()) throw bad('not_ready', 'Tanamannya belum siap dipanen.');
      const seed = cat.byId.get(plot.seed_id);
      const yieldItem = seed?.data?.yieldItem;
      const qty = Math.max(1, Number(seed?.data?.yieldQty) || 1);
      await t.query(`delete from garden_plots where user_id = $1 and slot = $2`, [u.id, slot]);
      if (yieldItem && cat.byId.get(yieldItem)) await addItem(t, u.id, yieldItem, qty);
      const pet = await lockPet(t, u.id);
      if (pet && s.garden.harvestXp) {
        const lv = await grantXp(t, u.id, pet, s.garden.harvestXp);
        await savePet(t, u.id, { level: lv.level, xp: lv.xp });
      }
      await track(t, u.id, 'harvest', { seedId: plot.seed_id });
      return { ok: true, harvested: { itemId: yieldItem, qty }, ...(await patch(t, u.id, ['garden', 'inventory', 'pet', 'wallet'])) };
    });
  });

  /* ---------------- Lomba Karung ---------------- */

  app.post('/api/karung/start', auth, async (req: any) => {
    const u = req.user!;
    const s = await getSettings(db);
    if (!s.features.karung) throw forbidden('Lapangan Lomba sedang ditutup.');
    return db.tx(async (t) => {
      const pet = await lockPet(t, u.id);
      if (!pet) throw bad('no_pet', 'Buat pet dulu.');
      assertAwake(pet, s);
      assertHealthy(pet, s);
      const needs = currentNeeds(pet, s);
      if (needs.energi < s.karung.energiCost) throw bad('tired', `${pet.name} terlalu capek untuk lomba. Tidur dulu.`);
      await bumpCounter(t, u.id, 'karung', s.karung.playsPerDay);
      await savePet(t, u.id, { needs: applyNeedDelta(needs, { energi: -s.karung.energiCost }) });
      const seed = randomInt(1, 2_000_000_000);
      const race = (await t.one<{ id: string }>(`insert into races (user_id, seed) values ($1,$2) returning id`, [u.id, seed]))!;
      return { ok: true, raceId: race.id, seed, rivals: karungRace(seed), hops: KARUNG_HOPS, ...(await patch(t, u.id, ['pet', 'limits'])) };
    });
  });

  app.post('/api/karung/finish', auth, async (req: any) => {
    const u = req.user!;
    const raceId = String(req.body?.raceId ?? '');
    if (!UUID.test(raceId)) throw bad('invalid', 'Lomba tidak valid.');
    const timeMs = int(req.body?.timeMs, 'Waktu', { min: 1, max: 600_000 });
    const taps = int(req.body?.taps, 'Ketukan', { min: 0, max: 10_000 });
    const [s, cat] = await Promise.all([getSettings(db), getCatalog(db)]);
    return db.tx(async (t) => {
      const race = await t.one<{ seed: number; started_at: Date; finished_at: Date | null }>(`select seed, started_at, finished_at from races where id = $1 and user_id = $2 for update`, [raceId, u.id]);
      if (!race) throw notFound('Lomba tidak ditemukan.');
      if (race.finished_at) throw bad('finished', 'Lomba ini sudah selesai.');
      const elapsed = Date.now() - new Date(race.started_at).getTime();
      // waktu yang diklaim harus masuk akal dibanding jam server dan batas kecepatan jari manusia
      const plausible =
        elapsed < 10 * 60_000 &&
        timeMs >= s.karung.minTimeMs &&
        timeMs <= elapsed + 500 &&
        taps >= KARUNG_HOPS &&
        taps / (timeMs / 1000) <= KARUNG_MAX_TAPS_PER_SEC;
      if (!plausible) {
        await t.query(`update races set finished_at = now(), time_ms = $2, rank = 0, reward = 0 where id = $1`, [raceId, timeMs]);
        req.log.warn({ userId: u.id, raceId, timeMs, taps, elapsed }, 'karung: hasil tidak wajar');
        throw bad('invalid_run', 'Hasil lomba tidak valid.');
      }
      const rivals = karungRace(race.seed);
      const rank = 1 + rivals.filter((r) => r.timeMs < timeMs).length;
      const base = s.karung.rewards[rank - 1] ?? 0;
      const reward = Math.round(base * coinMultiplier(cat));
      if (reward > 0) await credit(t, u.id, 'coin', reward, 'karung', raceId);
      await t.query(`update races set finished_at = now(), time_ms = $2, rank = $3, reward = $4 where id = $1`, [raceId, timeMs, rank, reward]);
      const pet = await lockPet(t, u.id);
      let levelUp = null;
      if (pet && s.karung.xp) {
        const lv = await grantXp(t, u.id, pet, s.karung.xp);
        await savePet(t, u.id, { level: lv.level, xp: lv.xp });
        if (lv.levelsGained) levelUp = lv.level;
      }
      await track(t, u.id, 'race', { rank, timeMs });
      return { ok: true, rank, reward, levelUp, ...(await patch(t, u.id, ['wallet', 'pet'])) };
    });
  });

  /* ---------------- Kolam Pancing ---------------- */

  app.post('/api/fish/cast', auth, async (req: any) => {
    const u = req.user!;
    const s = await getSettings(db);
    if (!s.features.fishing) throw forbidden('Kolam Pancing sedang ditutup.');
    const cat = await getCatalog(db);
    const now = Date.now();
    const pool = cat.items.filter((i) => i.active && Number(i.data?.fishWeight) > 0 && (!i.event_id || purchasableEvent(cat, i.event_id, now)));
    if (!pool.length) throw bad('empty_pond', 'Kolam sedang kosong.');
    return db.tx(async (t) => {
      const pet = await lockPet(t, u.id);
      if (!pet) throw bad('no_pet', 'Buat pet dulu.');
      assertAwake(pet, s);
      const needs = currentNeeds(pet, s);
      if (needs.energi < s.fishing.energiCost) throw bad('tired', `${pet.name} terlalu capek untuk memancing.`);
      await bumpCounter(t, u.id, 'fishing', s.fishing.castsPerDay);
      await savePet(t, u.id, { needs: applyNeedDelta(needs, { energi: -s.fishing.energiCost }) });
      const total = pool.reduce((a, i) => a + Number(i.data.fishWeight), 0);
      let r = randomInt(0, 1_000_000) / 1_000_000 * total;
      let fish = pool[0];
      for (const i of pool) { r -= Number(i.data.fishWeight); if (r <= 0) { fish = i; break; } }
      const biteIn = randomInt(s.fishing.biteMinMs, Math.max(s.fishing.biteMinMs + 1, s.fishing.biteMaxMs));
      const c = (await t.one<{ id: string }>(
        `insert into fishing_casts (user_id, fish_id, bite_at, window_ms) values ($1,$2, now() + ($3::int * interval '1 millisecond'), $4) returning id`,
        [u.id, fish.id, biteIn, s.fishing.windowMs],
      ))!;
      return { ok: true, castId: c.id, biteInMs: biteIn, windowMs: s.fishing.windowMs, ...(await patch(t, u.id, ['pet', 'limits'])) };
    });
  });

  app.post('/api/fish/reel', auth, async (req: any) => {
    const u = req.user!;
    const castId = String(req.body?.castId ?? '');
    if (!UUID.test(castId)) throw bad('invalid', 'Lemparan tidak valid.');
    const [s, cat] = await Promise.all([getSettings(db), getCatalog(db)]);
    return db.tx(async (t) => {
      const c = await t.one<{ fish_id: string; bite_at: Date; window_ms: number; result: string | null }>(
        `select fish_id, bite_at, window_ms, result from fishing_casts where id = $1 and user_id = $2 for update`, [castId, u.id]);
      if (!c) throw notFound('Lemparan tidak ditemukan.');
      if (c.result) throw bad('resolved', 'Lemparan ini sudah selesai.');
      const bite = new Date(c.bite_at).getTime();
      const now = Date.now();
      const tooEarly = now < bite - 350; // toleransi latensi jaringan
      const tooLate = now > bite + c.window_ms + 700;
      if (tooEarly || tooLate) {
        await t.query(`update fishing_casts set result = 'missed' where id = $1`, [castId]);
        return { ok: true, result: 'missed', reason: tooEarly ? 'early' : 'late', ...(await patch(t, u.id, ['limits'])) };
      }
      const fish = cat.byId.get(c.fish_id)!;
      const min = Number(fish.data?.minCm) || 5, max = Math.max(min, Number(fish.data?.maxCm) || min);
      const cm = Math.round((min + (randomInt(0, 1001) / 1000) * (max - min)) * 10) / 10;
      await t.query(`update fishing_casts set result = 'caught' where id = $1`, [castId]);
      await addItem(t, u.id, fish.id, 1);
      const prev = await t.one<{ best_cm: number; count: number }>(`select best_cm, count from fish_collection where user_id = $1 and fish_id = $2`, [u.id, fish.id]);
      await t.query(
        `insert into fish_collection (user_id, fish_id, count, best_cm) values ($1,$2,1,$3)
         on conflict (user_id, fish_id) do update set count = fish_collection.count + 1, best_cm = greatest(fish_collection.best_cm, excluded.best_cm)`,
        [u.id, fish.id, cm],
      );
      const pet = await lockPet(t, u.id);
      if (pet && s.fishing.xp) {
        const lv = await grantXp(t, u.id, pet, s.fishing.xp);
        await savePet(t, u.id, { level: lv.level, xp: lv.xp });
      }
      await track(t, u.id, 'fish', { fishId: fish.id });
      return {
        ok: true, result: 'caught', fishId: fish.id, cm,
        firstCatch: !prev, newRecord: !!prev && cm > prev.best_cm,
        ...(await patch(t, u.id, ['inventory', 'pet', 'wallet', 'limits'])),
      };
    });
  });

  app.get('/api/fish/collection', auth, async (req) => {
    const rows = await db.query(`select fish_id, count, best_cm, first_at from fish_collection where user_id = $1`, [req.user!.id]);
    return { collection: rows };
  });

  function purchasableEvent(cat: Awaited<ReturnType<typeof getCatalog>>, eventId: string, now: number) {
    const ev = cat.events.find((e) => e.id === eventId);
    return !!ev && ev.active && new Date(ev.starts_at).getTime() <= now && new Date(ev.ends_at).getTime() > now;
  }
  void purchasable;
}
