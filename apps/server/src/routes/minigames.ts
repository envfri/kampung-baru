import type { FastifyInstance } from 'fastify';
import { randomInt } from 'node:crypto';
import { applyNeedDelta, memoriLayout, memoriReplay, memoriStars, panenSchedule, panenScore, GAMES, bakiakReplay, BAKIAK, gasingScore, layanganSchedule, layanganScore, pinangReplay } from '@kb/shared';
import type { Db } from '../db/index';
import { activeEvents, bad, bumpCounter, coinMultiplier, credit, forbidden, getCatalog, getSettings, notFound, track } from '../lib/core';
import { requireUser } from '../lib/auth';
import { assertAwake, assertHealthy, currentNeeds, lockPet, savePet } from '../lib/state';
import { claimMilestone, eventList } from '../lib/events';
import { int } from '../lib/validate';
import { grantXp, patch } from './game';

const UUID = /^[0-9a-f-]{36}$/i;

export default async function minigameRoutes(app: FastifyInstance, { db }: { db: Db }) {
  const auth = { preHandler: requireUser(db) };
  const gameOf = (v: unknown) => {
    if (typeof v !== 'string' || !(v in GAMES)) throw notFound('Permainan tidak ditemukan.');
    return v as keyof typeof GAMES;
  };

  app.post('/api/games/:game/start', auth, async (req: any) => {
    const u = req.user!;
    const game = gameOf(req.params.game);
    const [s, cat] = await Promise.all([getSettings(db), getCatalog(db)]);
    if (!s.features.minigames) throw forbidden('Balai Main sedang ditutup.');
    const cfg: any = (s as any).games[game];
    // benda event muncul di Panen Buah bila ada event aktif berdekorasi yang memberi poin untuknya
    const ev = activeEvents(cat).find((e) => e.decor && Number(e.points?.game_event_drop) > 0);
    // Panjat Pinang hanya ada saat event berdekorasi bendera (Agustusan / Pekan Ceria)
    const need = (GAMES as any)[game].event as string | undefined;
    if (need && !activeEvents(cat).some((e) => e.decor === need)) throw bad('event_only', `${GAMES[game].name} hanya ada saat event Agustusan.`);
    return db.tx(async (t) => {
      const pet = await lockPet(t, u.id);
      if (!pet) throw bad('no_pet', 'Buat pet dulu.');
      assertAwake(pet, s);
      assertHealthy(pet, s);
      const needs = currentNeeds(pet, s);
      if (needs.energi < cfg.energiCost) throw bad('tired', `${pet.name} terlalu capek. Tidur dulu.`);
      await bumpCounter(t, u.id, `game_${game}`, cfg.playsPerDay);
      await savePet(t, u.id, { needs: applyNeedDelta(needs, { energi: -cfg.energiCost }) });
      const seed = randomInt(1, 2_000_000_000);
      const meta = game === 'panen' ? { durationMs: cfg.durationMs, eventDrops: !!ev, decor: ev?.decor ?? '' }
        : game === 'gasing' ? { rounds: cfg.rounds }
        : cfg.durationMs ? { durationMs: cfg.durationMs } : {};
      const run = (await t.one<{ id: string }>(`insert into game_runs (user_id, game, seed, meta) values ($1,$2,$3,$4::text::jsonb) returning id`, [u.id, game, seed, JSON.stringify(meta)]))!;
      return { ok: true, runId: run.id, seed, ...meta, ...(await patch(t, u.id, ['pet', 'limits'])) };
    });
  });

  app.post('/api/games/:game/finish', auth, async (req: any) => {
    const u = req.user!;
    const game = gameOf(req.params.game);
    const runId = String(req.body?.runId ?? '');
    if (!UUID.test(runId)) throw bad('invalid', 'Permainan tidak valid.');
    const [s, cat] = await Promise.all([getSettings(db), getCatalog(db)]);
    const cfg: any = (s as any).games[game];
    const mult = coinMultiplier(cat);
    return db.tx(async (t) => {
      const run = await t.one<{ seed: number; meta: any; started_at: Date; finished_at: Date | null }>(
        `select seed, meta, started_at, finished_at from game_runs where id = $1 and user_id = $2 and game = $3 for update`, [runId, u.id, game]);
      if (!run) throw notFound('Permainan tidak ditemukan.');
      if (run.finished_at) throw bad('finished', 'Permainan ini sudah selesai.');
      const elapsed = Date.now() - new Date(run.started_at).getTime();
      const invalid = async (why: string) => {
        await t.query(`update game_runs set finished_at = now(), score = 0, reward = 0 where id = $1`, [runId]);
        req.log.warn({ userId: u.id, runId, game, why, elapsed }, 'mini-game: hasil tidak wajar');
        throw bad('invalid_run', 'Hasil permainan tidak valid.');
      };
      if (elapsed > 15 * 60_000) await invalid('kedaluwarsa');
      let score = 0, reward = 0, extra: Record<string, unknown> = {};
      if (game === 'panen') {
        const duration = Number(run.meta?.durationMs) || cfg.durationMs;
        if (elapsed < duration - 500) await invalid('terlalu cepat');
        const caught = Array.isArray(req.body?.caught) ? req.body.caught.slice(0, 500).map(Number) : [];
        const sched = panenSchedule(run.seed, duration, !!run.meta?.eventDrops);
        const r = panenScore(sched, caught);
        if (!r) await invalid('indeks tangkapan tidak sah');
        score = r!.score;
        reward = Math.round(Math.min(cfg.maxCoins, score * cfg.coinPerPoint) * mult);
        extra = { eventDrops: r!.events };
        if (r!.events > 0) await track(t, u.id, 'game_event_drop', { game, count: r!.events });
      } else if (game === 'bakiak') {
        const duration = Number(run.meta?.durationMs) || cfg.durationMs;
        const taps = Array.isArray(req.body?.taps) ? req.body.taps.slice(0, 600) : [];
        const r = bakiakReplay(run.seed, taps, duration);
        if (!r) await invalid('ketukan bakiak tidak sah');
        const last = taps.length ? Number(taps[taps.length - 1][0]) : 0;
        if (elapsed + 1500 < last) await invalid('waktu tidak wajar');
        score = Math.min(BAKIAK.finish, r!.steps);
        reward = Math.round(Math.min(cfg.maxCoins, score * cfg.coinPerStep) * mult);
        extra = { steps: score, stumbles: r!.stumbles, finished: score >= BAKIAK.finish };
      } else if (game === 'gasing') {
        const rounds = Number(run.meta?.rounds) || cfg.rounds;
        const releases = Array.isArray(req.body?.releases) ? req.body.releases.slice(0, rounds).map(Number) : [];
        const r = gasingScore(run.seed, releases, rounds);
        if (!r) await invalid('lepasan gasing tidak sah');
        if (elapsed + 1500 < releases.reduce((a: number, b: number) => a + b, 0)) await invalid('terlalu cepat');
        score = Math.round(r!.total);
        reward = Math.round(Math.min(cfg.maxCoins, r!.total * cfg.coinPerSec) * mult);
        extra = { spins: r!.spins, total: r!.total };
      } else if (game === 'layangan') {
        const duration = Number(run.meta?.durationMs) || cfg.durationMs;
        if (elapsed < duration - 500) await invalid('terlalu cepat');
        const caught = Array.isArray(req.body?.caught) ? req.body.caught.slice(0, 300) : [];
        const r = layanganScore(layanganSchedule(run.seed, duration), caught, duration);
        if (!r) await invalid('tangkapan layangan tidak sah');
        score = r!.score;
        reward = Math.round(Math.min(cfg.maxCoins, score * cfg.coinPerPoint) * mult);
      } else if (game === 'pinang') {
        const duration = Number(run.meta?.durationMs) || cfg.durationMs;
        const taps = Array.isArray(req.body?.taps) ? req.body.taps.slice(0, 500).map(Number) : [];
        const r = pinangReplay(run.seed, taps, duration);
        if (!r) await invalid('ketukan pinang tidak sah');
        if (taps.length && elapsed + 1500 < taps[taps.length - 1]) await invalid('waktu tidak wajar');
        score = r!.height;
        reward = r!.tiers ? Math.round((cfg.rewards[r!.tiers - 1] ?? 0) * mult) : 0;
        extra = { height: r!.height, tiers: r!.tiers };
        if (r!.tiers >= 4) await track(t, u.id, 'pinang_top');
      } else {
        const flips = Array.isArray(req.body?.flips) ? req.body.flips.slice(0, 200) : [];
        const timeMs = int(req.body?.timeMs, 'Waktu', { min: 1, max: 900_000 });
        const res = memoriReplay(memoriLayout(run.seed), flips);
        if (!res) await invalid('langkah tidak membuka semua pasangan');
        if (timeMs < res!.moves * 350 || timeMs > elapsed + 1000) await invalid('waktu tidak wajar');
        const stars = memoriStars(res!.moves);
        score = stars;
        reward = Math.round((cfg.rewards[stars - 1] ?? 0) * mult);
        extra = { stars, moves: res!.moves };
      }
      if (reward > 0) await credit(t, u.id, 'coin', reward, `game:${game}`, runId);
      await t.query(`update game_runs set finished_at = now(), score = $2, reward = $3 where id = $1`, [runId, score, reward]);
      let levelUp = null;
      const pet = await lockPet(t, u.id);
      if (pet && cfg.xp) {
        const lv = await grantXp(t, u.id, pet, cfg.xp);
        await savePet(t, u.id, { level: lv.level, xp: lv.xp });
        if (lv.levelsGained) levelUp = lv.level;
      }
      await track(t, u.id, 'game_finish', { game, score });
      return { ok: true, score, reward, levelUp, ...extra, ...(await patch(t, u.id, ['wallet', 'pet', 'limits'])) };
    });
  });

  /* ---------------- event musiman ---------------- */

  app.get('/api/events', auth, async (req: any) => ({ events: await eventList(db, req.user!.id) }));

  app.post('/api/events/:id/claim', auth, async (req: any) => {
    const u = req.user!;
    const id = String(req.params.id);
    const index = int(req.body?.index, 'Hadiah', { min: 0, max: 50 });
    return db.tx(async (t) => {
      const m = await claimMilestone(t, u.id, id, index);
      return { ok: true, milestone: m, events: await eventList(t, u.id), ...(await patch(t, u.id, ['wallet', 'inventory'])) };
    });
  });
}
