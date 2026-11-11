// Duel dengan teman. Kedua pemain memainkan mini-game yang sama dengan seed yang sama:
//  - main bareng (live): keduanya siap di ruang tunggu → hitung mundur bersama → progres lawan terlihat langsung;
//  - tantangan: pemain kedua melawan "bayangan" (rekaman langkah pemain pertama).
// Skor tiap pemain dihitung ulang server dari langkahnya, hadiah koin dari sistem (tanpa taruhan).
import type { FastifyInstance } from 'fastify';
import { randomInt } from 'node:crypto';
import { applyNeedDelta, DUEL_GAMES, GAMES, duelScore, duelLabel } from '@kb/shared';
import type { Db } from '../db/index';
import { bad, bumpCounter, coinMultiplier, counter, credit, forbidden, getCatalog, getSettings, notFound, track } from '../lib/core';
import { requireUser } from '../lib/auth';
import { assertAwake, assertHealthy, currentNeeds, lockPet, petView, savePet } from '../lib/state';
import { notifyEvent } from '../lib/notify';
import { str } from '../lib/validate';
import { grantXp, patch } from './game';

const UUID = /^[0-9a-f-]{36}$/i;
type Side = 'c' | 'o';
const other = (s: Side): Side => (s === 'c' ? 'o' : 'c');
/** Progres main bareng (cukup di memori: satu instance server, data berumur detik). */
const liveProgress = new Map<string, { c?: { p: number; at: number }; o?: { p: number; at: number } }>();
const READY_MS = 6000, LIVE_DELAY_MS = 4500;

export default async function duelRoutes(app: FastifyInstance, { db }: { db: Db }) {
  const auth = { preHandler: requireUser(db) };
  const isFriend = async (a: string, b: string) => !!(await db.one(`select 1 from friendships where user_id = $1 and friend_id = $2`, [a, b]));
  const ms = (d: any) => (d ? new Date(d).getTime() : null);

  async function people(ids: string[], q: Db = db) {
    const s = await getSettings(q);
    const rows = await q.query<any>(
      `select u.id, u.display_name, p.* from users u left join pets p on p.user_id = u.id where u.id = any($1::uuid[])`, [ids]);
    return new Map(rows.map((r) => [r.id, { id: r.id, name: r.display_name, pet: r.name ? petView({ ...r, user_id: r.id }, s) : null }]));
  }

  function sideOf(d: any, uid: string): Side {
    if (d.challenger_id === uid) return 'c';
    if (d.opponent_id === uid) return 'o';
    throw forbidden('Ini bukan duelmu.');
  }

  function view(d: any, uid: string, ppl: Map<string, any>) {
    const me = sideOf(d, uid), them = other(me);
    const now = Date.now();
    const themId = me === 'c' ? d.opponent_id : d.challenger_id;
    const p = ppl.get(themId);
    return {
      id: d.id, game: d.game, gameName: (GAMES as any)[d.game]?.name ?? d.game, status: d.status,
      role: me === 'c' ? 'challenger' : 'opponent',
      createdAt: ms(d.created_at), expiresAt: ms(d.expires_at), liveStart: ms(d.live_start),
      me: { score: d[me + '_score'], label: duelLabel(d.game, d[me + '_score']), started: !!d[me + '_started_at'], played: d[me + '_score'] !== null, reward: d[me + '_reward'] ?? 0 },
      them: {
        id: themId, name: p?.name ?? 'Teman', pet: p?.pet ? { name: p.pet.name, color: p.pet.color, ear: p.pet.ear, pattern: p.pet.pattern, eyes: p.pet.eyes, tail: p.pet.tail, wear: p.pet.wear } : null,
        score: d[them + '_score'], label: duelLabel(d.game, d[them + '_score']), played: d[them + '_score'] !== null, started: !!d[them + '_started_at'],
        ready: !!d[them + '_ready_at'] && now - ms(d[them + '_ready_at'])! < READY_MS,
      },
      result: d.status === 'done' ? (d.winner_id === uid ? 'menang' : d.winner_id ? 'kalah' : 'seri') : null,
    };
  }

  async function load(id: string, uid: string, lock = false, t: Db = db) {
    if (!UUID.test(id)) throw bad('invalid', 'Duel tidak valid.');
    const d = await t.one<any>(`select * from duels where id = $1${lock ? ' for update' : ''}`, [id]);
    if (!d) throw notFound('Duel tidak ditemukan.');
    sideOf(d, uid);
    if ((d.status === 'open' || d.status === 'live') && ms(d.expires_at)! < Date.now() && (d.c_score === null || d.o_score === null)) {
      await t.query(`update duels set status = 'expired' where id = $1`, [id]);
      d.status = 'expired';
    }
    return d;
  }

  app.get('/api/duels', auth, async (req: any) => {
    const uid = req.user!.id;
    await db.query(`update duels set status = 'expired' where status in ('open','live') and expires_at < now() and (challenger_id = $1 or opponent_id = $1)`, [uid]);
    const rows = await db.query<any>(
      `select * from duels where (challenger_id = $1 or opponent_id = $1)
         and (status in ('open','live') or created_at > now() - interval '7 days') order by created_at desc limit 30`, [uid]);
    const ppl = await people([...new Set(rows.flatMap((d) => [d.challenger_id, d.opponent_id]))]);
    const s: any = await getSettings(db);
    return { duels: rows.map((d) => view(d, uid, ppl)), games: DUEL_GAMES, leftToday: Math.max(0, s.duel.perDay - (await counter(db, uid, 'duel'))), serverNow: Date.now() };
  });

  app.post('/api/duels', auth, async (req: any) => {
    const me = req.user!;
    const s: any = await getSettings(db);
    if (!s.duel.enabled || !s.features.minigames) throw forbidden('Duel sedang ditutup.');
    const game = str(req.body?.game, 'Permainan', { max: 20 })!;
    if (!(DUEL_GAMES as readonly string[]).includes(game)) throw bad('invalid_game', 'Permainan ini belum bisa untuk duel.');
    const friendId = String(req.body?.friendId ?? '');
    if (!UUID.test(friendId) || friendId === me.id) throw bad('invalid', 'Pilih teman untuk ditantang.');
    if (!(await isFriend(me.id, friendId))) throw forbidden('Kamu hanya bisa menantang teman.');
    const friend = await db.one<{ display_name: string }>(`select display_name from users where id = $1 and banned_at is null`, [friendId]);
    if (!friend) throw notFound('Teman tidak ditemukan.');
    const open = await db.one<{ id: string }>(
      `select id from duels where status in ('open','live') and expires_at > now()
         and ((challenger_id = $1 and opponent_id = $2) or (challenger_id = $2 and opponent_id = $1)) limit 1`, [me.id, friendId]);
    if (open) throw bad('duel_exists', `Masih ada duel yang belum selesai dengan ${friend.display_name}.`, { duelId: open.id });
    const cfg = s.games[game] ?? {};
    const meta = game === 'gasing' ? { rounds: cfg.rounds ?? 5 } : { durationMs: cfg.durationMs };
    const d = (await db.one<any>(
      `insert into duels (game, seed, meta, challenger_id, opponent_id, expires_at)
       values ($1,$2,$3::text::jsonb,$4,$5, now() + ($6::int * interval '1 hour')) returning *`,
      [game, randomInt(1, 2_000_000_000), JSON.stringify(meta), me.id, friendId, s.duel.expireHours],
    ))!;
    await track(db, me.id, 'duel_create', { game });
    void notifyEvent(db, friendId, 'duel_invite', { teman: me.display_name, permainan: (GAMES as any)[game].name }, { log: req.log, url: '/#duels' });
    return { ok: true, duel: view(d, me.id, await people([me.id, friendId])) };
  });

  app.get('/api/duels/:id', auth, async (req: any) => {
    const uid = req.user!.id;
    const d = await load(String(req.params.id), uid);
    return { duel: view(d, uid, await people([d.challenger_id, d.opponent_id])), serverNow: Date.now() };
  });

  /** Ruang tunggu main bareng: tanda "aku siap" (dikirim berkala). Bila keduanya siap, mulai bersama. */
  app.post('/api/duels/:id/ready', { ...auth, config: { rateLimit: { max: 400, timeWindow: '1 minute' } } }, async (req: any) => {
    const uid = req.user!.id;
    const d = await db.tx(async (t) => {
      const d = await load(String(req.params.id), uid, true, t);
      const me = sideOf(d, uid), them = other(me);
      if (d.status !== 'open' && d.status !== 'live') return d;
      if (d[me + '_started_at']) return d;
      const now = Date.now();
      await t.query(`update duels set ${me}_ready_at = now() where id = $1`, [d.id]);
      d[me + '_ready_at'] = new Date(now);
      const themReady = d[them + '_ready_at'] && now - ms(d[them + '_ready_at'])! < READY_MS && !d[them + '_started_at'];
      if (d.status === 'open' && !d.live_start && themReady) {
        const start = new Date(now + LIVE_DELAY_MS);
        await t.query(`update duels set status = 'live', live_start = $2 where id = $1`, [d.id, start]);
        d.status = 'live'; d.live_start = start;
      }
      return d;
    });
    return { duel: view(d, uid, await people([d.challenger_id, d.opponent_id])), serverNow: Date.now() };
  });

  app.post('/api/duels/:id/decline', auth, async (req: any) => {
    const uid = req.user!.id;
    const d = await load(String(req.params.id), uid);
    const me = sideOf(d, uid);
    if (d.status !== 'open' || d[me + '_started_at']) throw bad('invalid', 'Duel ini tidak bisa dibatalkan.');
    await db.query(`update duels set status = 'declined' where id = $1`, [d.id]);
    return { ok: true };
  });

  app.post('/api/duels/:id/start', auth, async (req: any) => {
    const u = req.user!;
    const s: any = await getSettings(db);
    return db.tx(async (t) => {
      const d = await load(String(req.params.id), u.id, true, t);
      const me = sideOf(d, u.id), them = other(me);
      if (d.status !== 'open' && d.status !== 'live') throw bad('closed', 'Duel ini sudah selesai.');
      if (d[me + '_started_at']) throw bad('started', 'Kamu sudah memainkan duel ini.');
      const pet = await lockPet(t, u.id);
      if (!pet) throw bad('no_pet', 'Buat pet dulu.');
      assertAwake(pet, s);
      assertHealthy(pet, s);
      const cfg = s.games[d.game] ?? {};
      const needs = currentNeeds(pet, s);
      if (needs.energi < (cfg.energiCost ?? 0)) throw bad('tired', `${pet.name} terlalu capek. Tidur dulu.`);
      await bumpCounter(t, u.id, 'duel', s.duel.perDay);
      await savePet(t, u.id, { needs: applyNeedDelta(needs, { energi: -(cfg.energiCost ?? 0) }) });
      await t.query(`update duels set ${me}_started_at = now() where id = $1`, [d.id]);
      // tantangan: langkah lawan yang sudah main dipakai untuk "bayangan"
      const ghost = d[them + '_score'] !== null ? d[them + '_inputs'] : null;
      return { ok: true, seed: d.seed, meta: d.meta, ghost, liveStart: ms(d.live_start), ...(await patch(t, u.id, ['pet'])) };
    });
  });

  /** Main bareng: kirim progres sendiri (±tiap 0,7 detik), dapat progres lawan. */
  app.post('/api/duels/:id/progress', { ...auth, config: { rateLimit: { max: 400, timeWindow: '1 minute' } } }, async (req: any) => {
    const uid = req.user!.id;
    const id = String(req.params.id);
    const d = await load(id, uid);
    const me = sideOf(d, uid), them = other(me);
    const p = Math.max(0, Math.min(100_000, Math.round(Number(req.body?.p) || 0)));
    const rec = liveProgress.get(id) ?? {};
    rec[me] = { p, at: Date.now() };
    liveProgress.set(id, rec);
    if (liveProgress.size > 5000) for (const [k, v] of liveProgress) if (Math.max(v.c?.at ?? 0, v.o?.at ?? 0) < Date.now() - 600_000) liveProgress.delete(k);
    const t = rec[them];
    return { them: t && Date.now() - t.at < 5000 ? t.p : null, themDone: d[them + '_score'] !== null, themScore: d[them + '_score'] };
  });

  app.post('/api/duels/:id/finish', auth, async (req: any) => {
    const u = req.user!;
    const [s, cat] = await Promise.all([getSettings(db) as Promise<any>, getCatalog(db)]);
    const res = await db.tx(async (t) => {
      const d = await load(String(req.params.id), u.id, true, t);
      const me = sideOf(d, u.id), them = other(me);
      if (!d[me + '_started_at']) throw bad('not_started', 'Mulai duel dulu.');
      if (d[me + '_score'] !== null) throw bad('finished', 'Kamu sudah menyelesaikan duel ini.');
      // menyerah: mulai tapi tidak selesai (aplikasi tertutup dll.) → skor 0 supaya duel tetap bisa tuntas
      const forfeit = req.body?.forfeit === true;
      const inputs = forfeit ? {} : req.body?.inputs ?? {};
      const elapsed = Date.now() - ms(d[me + '_started_at'])!;
      let score = forfeit ? 0 : duelScore(d.game, d.seed, d.meta, inputs);
      // waktu wajar (sama seperti mini-game biasa)
      const dur = Number(d.meta?.durationMs) || 0;
      if (score !== null && d.game === 'layangan' && elapsed < dur - 500) score = null;
      if (score !== null && d.game === 'bakiak' && Array.isArray(inputs.taps) && inputs.taps.length && elapsed + 1500 < Number(inputs.taps[inputs.taps.length - 1][0])) score = null;
      if (score !== null && d.game === 'gasing' && elapsed + 1500 < (inputs.releases ?? []).reduce((a: number, b: number) => a + Number(b), 0)) score = null;
      if (!forfeit && elapsed > 15 * 60_000) score = null;
      const invalid = score === null;
      if (invalid) req.log.warn({ userId: u.id, duel: d.id, elapsed }, 'duel: hasil tidak wajar');
      await t.query(`update duels set ${me}_score = $2, ${me}_inputs = $3::text::jsonb, ${me}_finished_at = now() where id = $1`, [d.id, score ?? 0, JSON.stringify(invalid ? {} : inputs)]);
      d[me + '_score'] = score ?? 0;
      let reward = 0, xp = 0, levelUp: number | null = null;
      if (d[them + '_score'] !== null) {
        // keduanya sudah main: tentukan pemenang & bagi hadiah ke dua pemain
        const mine = d[me + '_score'], theirs = d[them + '_score'];
        const winner = mine === theirs ? null : mine > theirs ? u.id : (me === 'c' ? d.opponent_id : d.challenger_id);
        await t.query(`update duels set status = 'done', winner_id = $2 where id = $1`, [d.id, winner]);
        d.status = 'done'; d.winner_id = winner;
        const mult = coinMultiplier(cat);
        for (const uid of [d.challenger_id, d.opponent_id]) {
          const coins = Math.round((winner === null ? s.duel.drawCoins : winner === uid ? s.duel.winCoins : s.duel.loseCoins) * mult);
          if (coins) await credit(t, uid, 'coin', coins, 'duel', d.id);
          const side = uid === d.challenger_id ? 'c' : 'o';
          await t.query(`update duels set ${side}_reward = $2 where id = $1`, [d.id, coins]);
          d[side + '_reward'] = coins;
          const pet = await t.one<{ level: number; xp: number }>(`select level, xp from pets where user_id = $1 for update`, [uid]);
          if (pet && s.duel.xp) {
            const lv = await grantXp(t, uid, pet, s.duel.xp);
            await t.query(`update pets set level = $2, xp = $3 where user_id = $1`, [uid, lv.level, lv.xp]);
            if (uid === u.id && lv.levelsGained) levelUp = lv.level;
          }
          if (uid === u.id) { reward = coins; xp = s.duel.xp; }
          await track(t, uid, 'duel', { game: d.game });
          if (winner === uid) await track(t, uid, 'duel_win', { game: d.game });
        }
      }
      const ppl = await people([d.challenger_id, d.opponent_id], t);
      return { d, invalid, reward, xp, levelUp, view: view(d, u.id, ppl), themView: view(d, me === 'c' ? d.opponent_id : d.challenger_id, ppl), out: await patch(t, u.id, ['wallet', 'pet']) };
    });
    liveProgress.delete(res.d.id);
    const otherId = res.d.challenger_id === u.id ? res.d.opponent_id : res.d.challenger_id;
    if (res.d.status === 'done') {
      const tv = res.themView;
      void notifyEvent(db, otherId, 'duel_result', { teman: u.display_name, permainan: tv.gameName, hasil: tv.result === 'menang' ? 'Menang!' : tv.result === 'kalah' ? 'Kalah' : 'Seri', skor: `${tv.me.label} vs ${tv.them.label}` }, { log: req.log, url: '/#duels' });
    }
    if (res.invalid) throw bad('invalid_run', 'Hasil duel tidak valid.');
    return { ok: true, duel: res.view, reward: res.reward, xp: res.xp, levelUp: res.levelUp, ...res.out };
  });
}
