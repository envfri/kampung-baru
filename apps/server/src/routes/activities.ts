import type { FastifyInstance } from 'fastify';
import { randomInt } from 'node:crypto';
import { applyNeedDelta, karungRace, KARUNG_HOPS, KARUNG_MAX_TAPS_PER_SEC } from '@kb/shared';
import type { Db } from '../db/index';
import { addItem, bad, bumpCounter, coinMultiplier, credit, forbidden, getCatalog, getSettings, notFound, purchasable, track } from '../lib/core';
import { castFish, fishBook, hookFish, kolamReward, landFish, loseFish } from '../lib/fishing';
import { requireUser } from '../lib/auth';
import { assertAwake, assertHealthy, currentNeeds, lockPet, savePet } from '../lib/state';
import { int, oneOf, str } from '../lib/validate';
import { grantXp, patch } from './game';

const UUID = /^[0-9a-f-]{36}$/i;

export default async function activityRoutes(app: FastifyInstance, { db }: { db: Db }) {
  const auth = { preHandler: requireUser(db) };

  // Kebun: lihat routes/garden.ts

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
  // Alur: cast (server memilih tangkapan) → hook (tekan TARIK saat sambar) → land (setelah tarik-ulur) | lost.

  const DISTS = ['dekat', 'sedang', 'jauh'] as const;
  const castIdOf = (req: any) => {
    const id = String(req.body?.castId ?? '');
    if (!UUID.test(id)) throw bad('invalid', 'Lemparan tidak valid.');
    return id;
  };
  const UPDATE = 'Kolam Pancing sudah diperbarui. Muat ulang aplikasi untuk memancing lagi, ya.';

  app.post('/api/fish/cast', auth, async (req: any) => {
    const u = req.user!;
    const s = await getSettings(db);
    if (!s.features.fishing) throw forbidden('Kolam Pancing sedang ditutup.');
    // klien lama (tanpa jarak) belum punya tarik-ulur: tolak sebelum memotong energi
    if (req.body?.distance === undefined) throw bad('update_required', UPDATE);
    const dist = oneOf(req.body.distance, 'Jarak', DISTS);
    const cat = await getCatalog(db);
    const energi = Math.max(0, Math.round(Number((s.fishing.energi as any)?.[dist]) || 0));
    return db.tx(async (t) => {
      const c = await castFish(t, u.id, { place: 'kolam', dist, s, cat, energi, quota: { key: 'fishing', limit: s.fishing.castsPerDay } });
      return { ok: true, ...c, ...(await patch(t, u.id, ['pet', 'limits'])) };
    });
  });

  app.post('/api/fish/hook', auth, async (req: any) => {
    const u = req.user!;
    const castId = castIdOf(req);
    return db.tx(async (t) => ({ ok: true, ...(await hookFish(t, u.id, castId)) }));
  });

  app.post('/api/fish/land', auth, async (req: any) => {
    const u = req.user!;
    const castId = castIdOf(req);
    const [s, cat] = await Promise.all([getSettings(db), getCatalog(db)]);
    return db.tx(async (t) => {
      const r: any = await landFish(t, u.id, castId, cat, kolamReward(t, u.id, s, cat));
      if (r.suspicious) req.log.warn({ userId: u.id, castId, elapsed: r.elapsed, min: r.min }, 'mancing: tarik-ulur terlalu cepat');
      delete r.suspicious; delete r.elapsed; delete r.min;
      return { ok: true, ...r, ...(await patch(t, u.id, r.result === 'caught' ? ['inventory', 'pet', 'wallet', 'limits'] : ['limits'])) };
    });
  });

  app.post('/api/fish/lost', auth, async (req: any) => {
    const u = req.user!;
    const castId = castIdOf(req);
    const reason = oneOf(req.body?.reason ?? 'batal', 'Alasan', ['putus', 'kendur', 'batal'] as const);
    return db.tx(async (t) => ({ ok: true, ...(await loseFish(t, u.id, castId, reason)) }));
  });

  // klien lama: tarik langsung tanpa tarik-ulur tidak lagi didukung
  app.post('/api/fish/reel', auth, async () => { throw bad('update_required', UPDATE); });

  app.get('/api/fish/collection', auth, async (req) => fishBook(db, req.user!.id, await getCatalog(db)));

  void purchasable;
}
