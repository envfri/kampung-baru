// Cerdas Cermat Kampung (server): bank soal aktif, Kuis Harian (10 soal tetap per pemain per hari WIB), Tantang Teman
// (soal sama untuk dua pemain, tabel duels game 'kuis'), papan peringkat mingguan teman, beruntun, laporan soal.
// Server = sumber kebenaran: pemain menerima soal TANPA kunci jawaban; server mencatat kapan tiap soal dikirim dan
// menolak jawaban yang terlambat (batas waktu + toleransi graceSec). Satu jawaban per soal. Hadiah dihitung di sini,
// di dalam transaksi pemanggil, dengan batas koin harian. Cerdas Cermat Bareng ada di lib/kuis-bareng.ts.
import {
  KUIS_CATEGORIES, applyNeedDelta, kuisPublicCfg, dayKey, kuisCheck, kuisPoints, kuisPublic, kuisReveal, kuisTimeMs, parsePick, pickKuis,
  tantangScore, type KuisQuestion, type KuisSettings, type Settings,
} from '@kb/shared';
import type { Db } from '../db/index';
import { bad, coinMultiplier, counter, credit, forbidden, getCatalog, getSettings, notFound, track, weekKey } from './core';
import { assertAwake, assertHealthy, currentNeeds, lockPet, savePet } from './state';
import { assertNotWorking } from './kerja';
import { grantXp } from '../routes/game';

export const kuisOf = (s: Settings) => (s as any).kuis as KuisSettings;

/** jam kuis (bisa diganti saat uji): batas waktu, hari WIB, minggu */
let clock = () => Date.now();
export function setKuisClock(fn: () => number) { clock = fn; }
export const kuisNow = () => clock();
export const kuisDay = (t = clock()) => dayKey(t);
export const kuisWeek = (t = clock()) => weekKey(t);
const dayBefore = (day: string) => dayKey(Date.parse(`${day}T12:00:00+07:00`) - 86_400_000);
const ms = (d: Date | string | null | undefined) => (d ? new Date(d).getTime() : 0);

/** kunci penghitung harian (daily_counters) */
export const KC = { koin: 'kuis_koin', lapor: 'kuis_lapor', tantang: 'kuis_tantang' };

/* ---------------- bank soal ---------------- */

let poolCache: { at: number; list: KuisQuestion[] } | null = null;
/** soal aktif (tidak dinonaktifkan & tidak dihapus admin), di-cache 15 detik */
export async function kuisPool(q: Db) {
  if (poolCache && Date.now() - poolCache.at < 15_000) return poolCache.list;
  const rows = await q.query<{ data: KuisQuestion }>(`select data from kuis_questions where active and deleted_at is null order by id`);
  poolCache = { at: Date.now(), list: rows.map((r) => r.data) };
  return poolCache.list;
}
export const invalidateKuis = () => { poolCache = null; };
/** soal menurut ID (termasuk yang sudah dinonaktifkan: permainan yang sedang berjalan tetap bisa diselesaikan) */
export async function questionsByIds(q: Db, ids: string[]) {
  const rows = await q.query<{ id: string; data: KuisQuestion }>(`select id, data from kuis_questions where id = any($1::text[])`, [ids]);
  return new Map(rows.map((r) => [r.id, r.data]));
}
async function seenSet(q: Db, uid: string, days: number) {
  if (days <= 0) return new Set<string>();
  const rows = await q.query<{ qid: string }>(`select qid from kuis_seen where user_id = $1 and seen_at > $2::timestamptz`, [uid, new Date(clock() - days * 86_400_000)]);
  return new Set(rows.map((r) => r.qid));
}

/* ---------------- permainan (Kuis Harian & Tantang Teman) ---------------- */

export interface RunRow {
  id: string; user_id: string; kind: 'harian' | 'tantang'; day: string; week: string; duel_id: string | null; qids: string[];
  timer_sec: number; grace_sec: number; created_at: Date; finished_at: Date | null; correct: number; score: number; total_ms: number;
  coins: number; xp: number; bonus: any;
}
interface AnsRow { run_id: string; idx: number; qid: string; served_at: Date; answered_at: Date | null; pick: any; correct: boolean | null; timed_out: boolean; ms: number | null; points: number; coins: number; xp: number }
const isDone = (a: AnsRow) => !!a.answered_at || a.timed_out;
const keyOf = (run: Pick<RunRow, 'id'>, idx: number) => `${run.id}:${idx}`;
const answersOf = (q: Db, runId: string) => q.query<AnsRow>(`select * from kuis_answers where run_id = $1 order by idx`, [runId]);

export async function loadRun(t: Db, runId: string, uid: string, lock = false) {
  if (!/^[0-9a-f-]{36}$/i.test(runId)) throw bad('invalid', 'Permainan kuis tidak ditemukan.');
  const run = await t.one<RunRow>(`select * from kuis_runs where id = $1${lock ? ' for update' : ''}`, [runId]);
  if (!run || run.user_id !== uid) throw notFound('Permainan kuis tidak ditemukan.');
  return run;
}

/** Keadaan permainan untuk pemain: soal yang sedang berjalan TANPA kunci; yang sudah dijawab beserta jawaban & penjelasan. */
export async function runView(q: Db, run: RunRow) {
  const rows = await answersOf(q, run.id);
  const qs = await questionsByIds(q, run.qids);
  const pending = rows.find((r) => !isDone(r)) ?? null;
  const pq = pending ? qs.get(pending.qid) : null;
  const perCat: Record<string, { correct: number; total: number }> = {};
  for (const r of rows.filter(isDone)) {
    const c = qs.get(r.qid)?.cat ?? 'lain';
    perCat[c] ??= { correct: 0, total: 0 };
    perCat[c].total++;
    if (r.correct) perCat[c].correct++;
  }
  return {
    id: run.id, kind: run.kind, duelId: run.duel_id, day: run.day, total: run.qids.length, served: rows.length, answered: rows.filter(isDone).length,
    timerSec: run.timer_sec, graceSec: run.grace_sec, done: !!run.finished_at, serverNow: clock(),
    current: pending && pq ? (() => { const limit = kuisTimeMs(pq.type, run.timer_sec); return { idx: pending.idx, q: kuisPublic(pq, keyOf(run, pending.idx)), servedAt: ms(pending.served_at), limitMs: limit, deadline: ms(pending.served_at) + limit }; })() : null,
    answers: rows.filter(isDone).map((r) => {
      const qq = qs.get(r.qid);
      return {
        idx: r.idx, qid: r.qid, correct: !!r.correct, timedOut: r.timed_out, ms: r.ms ?? 0, points: r.points, coins: r.coins, xp: r.xp, pick: r.pick,
        q: qq ? kuisPublic(qq, keyOf(run, r.idx)) : null, reveal: qq ? kuisReveal(qq, keyOf(run, r.idx)) : null,
      };
    }),
    result: run.finished_at ? { correct: run.correct, total: run.qids.length, score: run.score, coins: run.coins, xp: run.xp, totalMs: run.total_ms, bonus: run.bonus ?? {}, perCat } : null,
  };
}
export type RunView = Awaited<ReturnType<typeof runView>>;

/** Soal yang dibiarkan melewati batas waktu (aplikasi ditutup, sinyal hilang) dicatat waktu habis. */
export async function settleExpired(t: Db, run: RunRow, s: Settings) {
  const rows = await answersOf(t, run.id);
  const p = rows.find((r) => !isDone(r));
  if (!p) return false;
  const qs = await questionsByIds(t, [p.qid]);
  const qq = qs.get(p.qid);
  const limit = qq ? kuisTimeMs(qq.type, run.timer_sec) : run.timer_sec * 1000;
  if (clock() <= ms(p.served_at) + limit + run.grace_sec * 1000) return false;
  await t.query(`update kuis_answers set timed_out = true, correct = false, ms = $3, answered_at = $4::timestamptz where run_id = $1 and idx = $2`, [run.id, p.idx, limit, new Date(ms(p.served_at) + limit)]);
  await t.query(`update kuis_questions set answered = answered + 1 where id = $1`, [p.qid]);
  if (p.idx + 1 >= run.qids.length) await finishRun(t, run, s);
  return true;
}

/** Kirim soal berikutnya (bila soal sebelumnya sudah dijawab). Waktu kirim dicatat untuk batas waktu. */
async function serveNext(t: Db, run: RunRow) {
  if (run.finished_at) return;
  const rows = await answersOf(t, run.id);
  if (rows.some((r) => !isDone(r))) return;
  const idx = rows.length;
  if (idx >= run.qids.length) return;
  const qid = run.qids[idx];
  const at = new Date(clock());
  await t.query(`insert into kuis_answers (run_id, idx, qid, served_at) values ($1,$2,$3,$4::timestamptz) on conflict do nothing`, [run.id, idx, qid, at]);
  await t.query(`update kuis_questions set shown = shown + 1 where id = $1`, [qid]);
  await t.query(`insert into kuis_seen (user_id, qid, seen_at) values ($1,$2,$3::timestamptz) on conflict (user_id, qid) do update set seen_at = excluded.seen_at`, [run.user_id, qid, at]);
}

/** Pastikan soal berikutnya terkirim (setelah membereskan soal yang kedaluwarsa). */
export async function advance(t: Db, run: RunRow, s: Settings) {
  await settleExpired(t, run, s);
  const fresh = (await t.one<RunRow>(`select * from kuis_runs where id = $1`, [run.id]))!;
  await serveNext(t, fresh);
  return fresh;
}

/** penghitung koin Kuis Harian per hari (batas kuis.dailyCoinCap): berapa yang boleh diberikan dari `want` */
async function takeCoins(t: Db, uid: string, day: string, want: number, cap: number) {
  if (want <= 0) return 0;
  await t.query(`insert into daily_counters (user_id, key, day, count) values ($1,$2,$3,0) on conflict (user_id, key, day) do nothing`, [uid, KC.koin, day]);
  const r = await t.one<{ count: number }>(`select count from daily_counters where user_id = $1 and key = $2 and day = $3 for update`, [uid, KC.koin, day]);
  const give = Math.max(0, Math.min(want, cap - (r?.count ?? 0)));
  if (give > 0) await t.query(`update daily_counters set count = count + $4 where user_id = $1 and key = $2 and day = $3`, [uid, KC.koin, day, give]);
  return give;
}
async function giveXp(t: Db, uid: string, xp: number) {
  if (xp <= 0) return null;
  const pet = await t.one<{ level: number; xp: number }>(`select level, xp from pets where user_id = $1 for update`, [uid]);
  if (!pet) return null;
  const lv = await grantXp(t, uid, pet, xp);
  await t.query(`update pets set level = $2, xp = $3 where user_id = $1`, [uid, lv.level, lv.xp]);
  return lv.levelsGained ? lv.level : null;
}

/**
 * Jawab soal ke-idx. pick = indeks tampil (null = menyerah / waktu habis). Jawaban yang datang lebih dari batas waktu +
 * graceSec sejak soal dikirim dihitung waktu habis (salah). Soal yang sudah dijawab tidak bisa dijawab lagi.
 */
export async function answerRun(t: Db, run: RunRow, idx: number, rawPick: unknown, s: Settings) {
  if (!Number.isInteger(idx) || idx < 0 || idx >= run.qids.length) throw bad('invalid', 'Nomor soal tidak valid.');
  const row = await t.one<AnsRow>(`select * from kuis_answers where run_id = $1 and idx = $2 for update`, [run.id, idx]);
  if (!row) throw bad('not_served', 'Soal ini belum dibuka.');
  if (isDone(row)) throw bad('answered', 'Soal ini sudah dijawab.');
  const q = (await questionsByIds(t, [row.qid])).get(row.qid);
  if (!q) throw notFound('Soal tidak ditemukan.');
  const k = kuisOf(s);
  const key = keyOf(run, idx);
  const limit = kuisTimeMs(q.type, run.timer_sec);
  const elapsed = clock() - ms(row.served_at);
  let correct = false, timedOut = false, pick: number | number[] | null = null;
  if (rawPick === null || rawPick === undefined) timedOut = true;
  else {
    pick = parsePick(q, rawPick);
    if (pick === null) throw bad('invalid_pick', 'Jawaban tidak valid.');
    if (elapsed > limit + run.grace_sec * 1000) timedOut = true;
    else correct = kuisCheck(q, key, pick);
  }
  const msRec = timedOut ? limit : Math.max(0, Math.min(elapsed, limit));
  let points = 0, coins = 0, xp = 0, levelUp: number | null = null;
  if (correct && run.kind === 'harian') {
    points = kuisPoints(q.level, msRec, limit, k);
    const mult = coinMultiplier(await getCatalog(t));
    coins = await takeCoins(t, run.user_id, run.day, Math.round(k.coins * mult), k.dailyCoinCap);
    if (coins) await credit(t, run.user_id, 'coin', coins, 'kuis', run.id);
    xp = k.xp;
    levelUp = await giveXp(t, run.user_id, xp);
  }
  await t.query(
    `update kuis_answers set answered_at = $3::timestamptz, pick = $4::text::jsonb, correct = $5, timed_out = $6, ms = $7, points = $8, coins = $9, xp = $10 where run_id = $1 and idx = $2`,
    [run.id, idx, new Date(clock()), JSON.stringify(pick), correct, timedOut, msRec, points, coins, xp]);
  await t.query(`update kuis_questions set answered = answered + 1, correct = correct + $2 where id = $1`, [q.id, correct ? 1 : 0]);
  if (run.kind === 'harian') await t.query(`update kuis_runs set coins = coins + $2, xp = xp + $3, score = score + $4 where id = $1`, [run.id, coins, xp, points]);
  if (correct) await track(t, run.user_id, 'kuis_benar', { cat: q.cat, mode: run.kind });
  let finish: any = null;
  if (idx + 1 >= run.qids.length) finish = await finishRun(t, (await t.one<RunRow>(`select * from kuis_runs where id = $1`, [run.id]))!, s);
  return { idx, correct, timedOut, ms: msRec, limitMs: limit, points, coins, xp, levelUp, ...kuisReveal(q, key), finish };
}

/** Selesaikan permainan: hitung hasil; Kuis Harian = bonus sempurna & beruntun; Tantang = skor duel & hadiah bila keduanya selesai. */
export async function finishRun(t: Db, run: RunRow, s: Settings) {
  if (run.finished_at) return null;
  const rows = await answersOf(t, run.id);
  const correct = rows.filter((r) => r.correct).length, total = run.qids.length;
  const totalMs = rows.reduce((a, r) => a + (r.ms ?? 0), 0) + Math.max(0, total - rows.length) * run.timer_sec * 1000;
  const score = rows.reduce((a, r) => a + r.points, 0);
  const k = kuisOf(s);
  if (run.kind === 'tantang') {
    await t.query(`update kuis_runs set finished_at = $2::timestamptz, correct = $3, total_ms = $4 where id = $1`, [run.id, new Date(clock()), correct, totalMs]);
    return finishTantang(t, run, correct, totalMs, s);
  }
  // Kuis Harian: sempurna & beruntun
  const bonus: Record<string, number> = {};
  let bonusCoins = 0, bonusXp = 0, pearls = 0;
  if (total > 0 && correct === total) { bonusCoins += k.perfectCoins; bonusXp += k.perfectXp; bonus.perfect = 1; }
  const st = await t.one<{ streak: number; best: number; last_day: string | null }>(`select streak, best, last_day from kuis_streaks where user_id = $1 for update`, [run.user_id]);
  let streak = st?.streak ?? 0;
  if (st?.last_day !== run.day) {
    streak = st?.last_day === dayBefore(run.day) ? streak + 1 : 1;
    if (streak % 7 === 0) { bonusCoins += k.streak7Coins; pearls += k.streak7Pearls; bonus.streak7 = streak; }
    else if (streak % 7 === 3) { bonusCoins += k.streak3Coins; bonus.streak3 = streak; }
    await t.query(
      `insert into kuis_streaks (user_id, streak, best, last_day) values ($1,$2,$2,$3)
       on conflict (user_id) do update set streak = $2, best = greatest(kuis_streaks.best, $2), last_day = $3`, [run.user_id, streak, run.day]);
  }
  const mult = coinMultiplier(await getCatalog(t));
  const coins = await takeCoins(t, run.user_id, run.day, Math.round(bonusCoins * mult), k.dailyCoinCap);
  if (coins) await credit(t, run.user_id, 'coin', coins, 'kuis_bonus', run.id);
  if (pearls) await credit(t, run.user_id, 'pearl', pearls, 'kuis_beruntun', run.id);
  const levelUp = await giveXp(t, run.user_id, bonusXp);
  Object.assign(bonus, { coins, xp: bonusXp, pearls, streak });
  await t.query(`update kuis_runs set finished_at = $2::timestamptz, correct = $3, total_ms = $4, score = $5, coins = coins + $6, xp = xp + $7, bonus = $8::text::jsonb where id = $1`,
    [run.id, new Date(clock()), correct, totalMs, score, coins, bonusXp, JSON.stringify(bonus)]);
  await track(t, run.user_id, 'kuis_harian', { correct, total, score });
  await track(t, run.user_id, 'game_finish', { game: 'kuis', score });
  return { kind: 'harian', bonus, levelUp };
}

/* ---------------- Kuis Harian ---------------- */

/** syarat main sama seperti mini-game Balai Main: pet ada, tidak kerja, tidak tidur, tidak sakit, energi cukup */
async function payEnergi(t: Db, uid: string, s: Settings, what: string) {
  const k = kuisOf(s);
  const pet = await lockPet(t, uid);
  if (!pet) throw bad('no_pet', 'Buat pet dulu.');
  await assertNotWorking(t, uid, what, pet);
  assertAwake(pet, s);
  assertHealthy(pet, s);
  const needs = currentNeeds(pet, s);
  if (needs.energi < k.energi) throw bad('tired', `${pet.name} terlalu capek untuk kuis. Tidur dulu, ya.`);
  if (k.energi > 0) await savePet(t, uid, { needs: applyNeedDelta(needs, { energi: -k.energi }) });
}

export function assertKuisOn(s: Settings) {
  if (kuisOf(s).on === false || (s.features as any).minigames === false) throw forbidden('Kuis sedang ditutup. Coba lagi nanti, ya.');
}

/** Mulai / lanjutkan Kuis Harian hari ini. Set soal ditentukan sekali saat mulai (tetap sepanjang hari). */
export async function startHarian(t: Db, uid: string, s: Settings) {
  const k = kuisOf(s);
  const day = kuisDay();
  let run = await t.one<RunRow>(`select * from kuis_runs where user_id = $1 and kind = 'harian' and day = $2 for update`, [uid, day]);
  if (!run) {
    const pool = await kuisPool(t);
    const picked = pickKuis(`${uid}:${day}`, pool, k.dailyCount, k.levelMix, await seenSet(t, uid, k.seenDays));
    if (!picked.length) throw bad('no_questions', 'Soal kuis belum tersedia. Coba lagi nanti, ya.');
    await payEnergi(t, uid, s, 'Main Kuis');
    run = (await t.one<RunRow>(
      `insert into kuis_runs (user_id, kind, day, week, qids, timer_sec, grace_sec, created_at) values ($1,'harian',$2,$3,$4::text[],$5,$6,$7::timestamptz) returning *`,
      [uid, day, kuisWeek(), picked.map((q) => q.id), k.timerSec, k.graceSec, new Date(clock())]))!;
    await track(t, uid, 'kuis_mulai', { kind: 'harian', n: picked.length });
  }
  return advance(t, run, s);
}

/** Akhiri permainan sekarang: soal yang belum dijawab dihitung waktu habis. */
export async function forfeitRun(t: Db, run: RunRow, s: Settings) {
  if (run.finished_at) return run;
  const rows = await answersOf(t, run.id);
  const qs = await questionsByIds(t, run.qids);
  const now = new Date(clock());
  for (let i = 0; i < run.qids.length; i++) {
    const r = rows.find((x) => x.idx === i);
    const limit = kuisTimeMs(qs.get(run.qids[i])?.type ?? 'pilihan', run.timer_sec);
    if (!r) await t.query(`insert into kuis_answers (run_id, idx, qid, served_at, answered_at, correct, timed_out, ms) values ($1,$2,$3,$4::timestamptz,$4::timestamptz,false,true,$5)`, [run.id, i, run.qids[i], now, limit]);
    else if (!isDone(r)) {
      await t.query(`update kuis_answers set timed_out = true, correct = false, ms = $3, answered_at = $4::timestamptz where run_id = $1 and idx = $2`, [run.id, i, limit, now]);
      await t.query(`update kuis_questions set answered = answered + 1 where id = $1`, [r.qid]);
    }
  }
  await finishRun(t, run, s);
  return (await t.one<RunRow>(`select * from kuis_runs where id = $1`, [run.id]))!;
}

/* ---------------- Tantang Teman (tabel duels, game 'kuis') ---------------- */

/** soal tantangan: sama untuk kedua pemain (meta.qids), dipilih sekali saat tantangan dibuat */
export async function tantangMeta(q: Db, uid: string, s: Settings) {
  const k = kuisOf(s);
  const pool = await kuisPool(q);
  const picked = pickKuis(`${uid}:${clock()}:${Math.random()}`, pool, k.tantangCount, [2, 2, 1], await seenSet(q, uid, k.seenDays));
  if (picked.length < Math.min(3, k.tantangCount)) throw bad('no_questions', 'Soal kuis belum cukup untuk tantangan. Coba lagi nanti, ya.');
  return { qids: picked.map((x) => x.id), timerSec: k.timerSec, graceSec: k.graceSec };
}

/** tantangan yang lewat batas waktu dan belum dimainkan keduanya ditandai kedaluwarsa (di luar transaksi mulai) */
export async function expireTantang(q: Db, duelId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(duelId)) return;
  await q.query(`update duels set status = 'expired' where id = $1 and game = 'kuis' and status in ('open','live') and expires_at < now() and (c_score is null or o_score is null)
    and not exists (select 1 from kuis_runs r where r.duel_id = duels.id and r.finished_at is null)`, [duelId]);
}

/** Mulai (atau lanjutkan) giliran sendiri dalam tantangan kuis. */
export async function startTantang(t: Db, uid: string, duelId: string, s: Settings) {
  if (!/^[0-9a-f-]{36}$/i.test(duelId)) throw bad('invalid', 'Tantangan tidak valid.');
  const d = await t.one<any>(`select * from duels where id = $1 for update`, [duelId]);
  if (!d || d.game !== 'kuis') throw notFound('Tantangan tidak ditemukan.');
  const side = d.challenger_id === uid ? 'c' : d.opponent_id === uid ? 'o' : null;
  if (!side) throw forbidden('Ini bukan tantanganmu.');
  let run = await t.one<RunRow>(`select * from kuis_runs where duel_id = $1 and user_id = $2 and kind = 'tantang' for update`, [duelId, uid]);
  if (!run) {
    if (d[side + '_score'] !== null) throw bad('finished', 'Kamu sudah memainkan tantangan ini.');
    if (d.status !== 'open' && d.status !== 'live') throw bad('closed', 'Tantangan ini sudah selesai.');
    if (ms(d.expires_at) < Date.now()) throw bad('closed', 'Tantangan ini sudah kedaluwarsa.');
    const k = kuisOf(s);
    if ((await counter(t, uid, KC.tantang)) >= k.tantangPerDay) throw bad('daily_limit', 'Jatah Tantang Teman hari ini sudah habis. Coba lagi besok.');
    await payEnergi(t, uid, s, 'Tantang Teman');
    await t.query(`insert into daily_counters (user_id, key, day, count) values ($1,$2,$3,1) on conflict (user_id, key, day) do update set count = daily_counters.count + 1`, [uid, KC.tantang, dayKey(Date.now())]);
    await t.query(`update duels set ${side}_started_at = now() where id = $1`, [d.id]);
    const m = d.meta ?? {};
    run = (await t.one<RunRow>(
      `insert into kuis_runs (user_id, kind, day, week, duel_id, qids, timer_sec, grace_sec, created_at) values ($1,'tantang',$2,$3,$4,$5::text[],$6,$7,$8::timestamptz) returning *`,
      [uid, kuisDay(), kuisWeek(), d.id, m.qids ?? [], Number(m.timerSec) || kuisOf(s).timerSec, Number(m.graceSec ?? kuisOf(s).graceSec), new Date(clock())]))!;
    await track(t, uid, 'kuis_mulai', { kind: 'tantang' });
  }
  return advance(t, run, s);
}

/** Skor tantangan masuk ke duel; bila kedua pemain sudah main: pemenang (lebih banyak benar, seri dipecah waktu) & hadiah dari sistem. */
async function finishTantang(t: Db, run: RunRow, correct: number, totalMs: number, s: Settings) {
  const d = await t.one<any>(`select * from duels where id = $1 for update`, [run.duel_id]);
  if (!d) return null;
  const me = d.challenger_id === run.user_id ? 'c' : 'o', them = me === 'c' ? 'o' : 'c';
  const score = tantangScore(correct, totalMs);
  await t.query(`update duels set ${me}_score = $2, ${me}_inputs = '{}'::jsonb, ${me}_finished_at = now() where id = $1`, [d.id, score]);
  d[me + '_score'] = score;
  if (d[them + '_score'] === null || (d.status !== 'open' && d.status !== 'live')) return { kind: 'tantang', score, done: false };
  const mine = score, theirs = d[them + '_score'];
  const winner = mine === theirs ? null : mine > theirs ? run.user_id : (me === 'c' ? d.opponent_id : d.challenger_id);
  await t.query(`update duels set status = 'done', winner_id = $2 where id = $1`, [d.id, winner]);
  const du = (s as any).duel ?? {};
  const mult = coinMultiplier(await getCatalog(t));
  const out: Record<string, number> = {};
  for (const uid of [d.challenger_id, d.opponent_id]) {
    const coins = Math.round((winner === null ? du.drawCoins : winner === uid ? du.winCoins : du.loseCoins) * mult) || 0;
    if (coins) await credit(t, uid, 'coin', coins, 'duel', d.id);
    await t.query(`update duels set ${uid === d.challenger_id ? 'c' : 'o'}_reward = $2 where id = $1`, [d.id, coins]);
    await giveXp(t, uid, Number(du.xp) || 0);
    await track(t, uid, 'duel', { game: 'kuis' });
    if (winner === uid) await track(t, uid, 'duel_win', { game: 'kuis' });
    out[uid] = coins;
  }
  return { kind: 'tantang', score, done: true, winner, rewards: out, otherId: me === 'c' ? d.opponent_id : d.challenger_id };
}

/* ---------------- beranda Kuis: beruntun & papan peringkat teman ---------------- */

export async function streakOf(q: Db, uid: string) {
  const st = await q.one<{ streak: number; best: number; last_day: string | null }>(`select streak, best, last_day from kuis_streaks where user_id = $1`, [uid]);
  const day = kuisDay();
  const alive = st?.last_day === day || st?.last_day === dayBefore(day);
  return { streak: alive ? st!.streak : 0, best: st?.best ?? 0, today: st?.last_day === day };
}

/** Papan peringkat mingguan (Senin–Minggu WIB) poin Kuis Harian: hanya pemain & temannya. */
export async function weeklyBoard(q: Db, uid: string, week = kuisWeek()) {
  const rows = await q.query<any>(
    `with ppl as (select $1::uuid id union select friend_id from friendships where user_id = $1)
     select u.id, u.display_name as name, p.name as pet, p.color, p.ear, p.pattern, p.eyes, p.tail, p.wear,
            coalesce(r.points, 0)::int points, coalesce(r.correct, 0)::int correct, coalesce(r.days, 0)::int days
       from ppl join users u on u.id = ppl.id left join pets p on p.user_id = u.id
       left join (select user_id, sum(score) points, sum(correct) correct, count(*) filter (where finished_at is not null) days
                    from kuis_runs where kind = 'harian' and week = $2 group by user_id) r on r.user_id = u.id
      where u.banned_at is null`, [uid, week]);
  const list = rows.filter((r) => r.id === uid || r.points > 0)
    .sort((a, b) => b.points - a.points || b.correct - a.correct || String(a.name).localeCompare(String(b.name)));
  let rank = 0, prev = -1;
  return list.slice(0, 50).map((r, i) => {
    if (r.points !== prev) { rank = i + 1; prev = r.points; }
    return { id: r.id, name: r.name, me: r.id === uid, rank, points: r.points, correct: r.correct, days: r.days, pet: r.pet ? { name: r.pet, color: r.color, ear: r.ear, pattern: r.pattern, eyes: r.eyes, tail: r.tail, wear: r.wear ?? {} } : null };
  });
}


export async function kuisHome(q: Db, uid: string) {
  const s = await getSettings(q);
  const k = kuisOf(s);
  const day = kuisDay();
  const run = await q.one<RunRow>(`select * from kuis_runs where user_id = $1 and kind = 'harian' and day = $2`, [uid, day]);
  const answered = run ? (await q.one<{ c: number }>(`select count(*)::int c from kuis_answers where run_id = $1 and (answered_at is not null or timed_out)`, [run.id]))!.c : 0;
  const [streak, board, tUsed, rUsed] = await Promise.all([streakOf(q, uid), weeklyBoard(q, uid), counter(q, uid, KC.tantang), counter(q, uid, KC.lapor)]);
  // reset harian: tengah malam WIB berikutnya
  const now = clock() + 7 * 3_600_000;
  return {
    cfg: kuisPublicCfg(s),
    today: run ? { id: run.id, done: !!run.finished_at, answered, total: run.qids.length, correct: run.correct, score: run.score, coins: run.coins } : null,
    streak,
    week: { key: kuisWeek(), board },
    tantangLeft: Math.max(0, k.tantangPerDay - tUsed),
    reportsLeft: Math.max(0, k.reportsPerDay - rUsed),
    resetAt: Math.floor(now / 86_400_000 + 1) * 86_400_000 - 7 * 3_600_000,
    categories: Object.fromEntries(Object.entries(KUIS_CATEGORIES).map(([id, c]) => [id, { name: c.name, short: c.short, color: c.color }])),
    serverNow: clock(),
  };
}

/* ---------------- Laporkan soal ---------------- */

export const REPORT_REASONS: Record<string, string> = { salah: 'Jawaban salah', bingung: 'Soal membingungkan', ketik: 'Salah ketik', lain: 'Lainnya' };

/** Laporan soal dari pemain (batas per hari; laporan terbuka yang sama dari pemain yang sama tidak dobel). */
export async function reportQuestion(t: Db, uid: string, body: any, s: Settings) {
  const qid = String(body?.qid ?? '');
  const reason = String(body?.reason ?? '');
  if (!Object.hasOwn(REPORT_REASONS, reason)) throw bad('invalid', 'Pilih alasan laporan dulu, ya.');
  const note = String(body?.note ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (note.length > 200) throw bad('invalid', 'Catatan paling panjang 200 karakter.');
  if (!(await t.one(`select 1 from kuis_questions where id = $1`, [qid]))) throw notFound('Soal tidak ditemukan.');
  if (await t.one(`select 1 from kuis_reports where qid = $1 and user_id = $2 and resolved_at is null`, [qid, uid])) return { ok: true, already: true };
  const k = kuisOf(s);
  if ((await counter(t, uid, KC.lapor)) >= k.reportsPerDay) throw bad('daily_limit', 'Kamu sudah banyak melapor hari ini. Terima kasih! Coba lagi besok, ya.');
  await t.query(`insert into daily_counters (user_id, key, day, count) values ($1,$2,$3,1) on conflict (user_id, key, day) do update set count = daily_counters.count + 1`, [uid, KC.lapor, dayKey(Date.now())]);
  await t.query(`insert into kuis_reports (qid, user_id, reason, note) values ($1,$2,$3,$4)`, [qid, uid, reason, note || null]);
  await track(t, uid, 'kuis_lapor', { qid, reason });
  return { ok: true, already: false };
}

/* ---------------- admin: tanda otomatis ---------------- */

/** ditandai otomatis: benar < 25 % setelah ≥ 30 jawaban, atau ≥ 3 laporan terbuka */
export const kuisFlagged = (answered: number, correct: number, openReports: number) => (answered >= 30 && correct / answered < 0.25) || openReports >= 3;
export const FLAG_SQL = `((q.answered >= 30 and q.correct::float / greatest(q.answered, 1) < 0.25) or coalesce(r.open, 0) >= 3)`;
