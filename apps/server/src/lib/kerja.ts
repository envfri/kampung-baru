// Kerja Sambilan (server): pemeriksa tunggal "pet sedang kerja", keadaan shift untuk client, dan hitungan papan lowongan.
// Aturan & angka: @kb/shared kerja.ts + pengaturan admin `kerja`. Rute: routes/kerja.ts.
import {
  KERJA_INFO, KERJA_JOBS, KERJA_RANK_LABEL, KERJA_STORIES, kerjaOptions, kerjaPay, kerjaRank, kerjaRankIdx, kerjaStory,
  type KerjaJob, type KerjaSettings, type Settings,
} from '@kb/shared';
import type { Db } from '../db/index';
import { bad, getSettings, today } from './core';
import { isWorking, type PetRow } from './state';

export const kerjaOf = (s: Settings) => (s as any).kerja as KerjaSettings;
const ms = (d: Date | string | null | undefined) => (d ? new Date(d).getTime() : 0);
export const jobInfo = (job: string | null | undefined) => KERJA_INFO[(job ?? '') as KerjaJob] ?? { place: 'tempat kerja', loc: '', title: 'Kerja sambilan', doing: 'kerja sambilan', short: 'tempat kerja', uniform: [] };

/** jam untuk jendela Ronda (bisa diganti saat uji) */
let clock = () => Date.now();
export function setKerjaClock(fn: () => number) { clock = fn; }
export const kerjaClock = () => clock();

/** Pesan ramah untuk aksi yang butuh pet saat pet sedang kerja; client menampilkan pilihan "Panggil pulang". */
export function workingError(p: { name: string; work_until?: Date | string | null; work_job?: string | null }, what?: string) {
  const j = jobInfo(p.work_job);
  const after = what ? `${what} bisa lagi setelah ${p.name} pulang` : `Tunggu ${p.name} pulang`;
  return bad('working', `${p.name} sedang ${j.doing} di ${j.place}. ${after}, atau panggil pulang dulu.`, { kerja: { job: p.work_job ?? null, until: ms(p.work_until) } });
}

/**
 * Satu-satunya pemeriksa di server: tolak aksi yang butuh pet (rawat pet, perabot, berkunjung, alun-alun, mancing,
 * mini-game, duel, ...) selama pet kerja sambilan. Pakai baris pet yang sudah dikunci bila ada; selain itu dibaca sendiri.
 */
export async function assertNotWorking(db: Db, userId: string, what?: string, pet?: Pick<PetRow, 'name' | 'work_until' | 'work_job'> | null) {
  const p = pet ?? (await db.one<Pick<PetRow, 'name' | 'work_until' | 'work_job'>>(`select name, work_until, work_job from pets where user_id = $1`, [userId]));
  if (p && isWorking(p)) throw workingError(p, what);
}

/** Versi cepat untuk sinkron yang sering (rumah teman, alun-alun): hasil disimpan sebentar di memori. */
const CACHE = new Map<string, { at: number; until: number; name: string; job: string | null }>();
export function forgetWorking(userId: string) { CACHE.delete(userId); }
export async function assertNotWorkingFast(db: Db, userId: string, what?: string) {
  let c = CACHE.get(userId);
  if (!c || Date.now() - c.at > 10_000) {
    const p = await db.one<{ name: string; work_until: Date | null; work_job: string | null }>(`select name, work_until, work_job from pets where user_id = $1`, [userId]);
    c = { at: Date.now(), until: ms(p?.work_until), name: p?.name ?? 'Pet-mu', job: p?.work_job ?? null };
    if (CACHE.size > 20_000) CACHE.clear();
    CACHE.set(userId, c);
  }
  if (c.until > Date.now()) throw workingError({ name: c.name, work_until: new Date(c.until), work_job: c.job }, what);
}

/** Pemain lain (tuan rumah / teman) yang petnya sedang kerja: tempat & jam pulang, untuk kartu pintu & daftar teman. */
export async function workingOf(db: Db, ids: string[]) {
  if (!ids.length) return new Map<string, { job: string; place: string; doing: string; short: string; until: number }>();
  const rows = await db.query<{ user_id: string; work_job: string; work_until: Date }>(
    `select user_id, work_job, work_until from pets where user_id = any($1::uuid[]) and work_until > now()`, [ids]);
  return new Map(rows.map((r) => { const j = jobInfo(r.work_job); return [r.user_id, { job: r.work_job, place: j.place, doing: j.doing, short: j.short, until: ms(r.work_until) }]; }));
}

export interface JobRow {
  id: string; user_id: string; job: string; minutes: number; day: string; started_at: Date; ends_at: Date; status: string;
  pay: number; xp: number; bonus_item: string | null; story: string | null; rank: string | null; cost: Record<string, number>;
  ended_at: Date | null; worked_minutes: number | null; paid: number | null; claimed_at: Date | null; notified_at: Date | null;
}

/** menit kerja hari ini: shift yang berjalan/selesai dihitung penuh, yang dipanggil pulang menurut lama kerjanya */
export async function usedMinutesToday(db: Db, userId: string, day = today()) {
  const r = await db.one<{ m: number }>(
    `select coalesce(sum(case when status = 'recalled' then coalesce(worked_minutes, 0) else minutes end), 0)::int m
       from pet_jobs where user_id = $1 and day = $2::date`, [userId, day]);
  return r?.m ?? 0;
}

export async function progressOf(db: Db, userId: string) {
  const rows = await db.query<{ job: string; shifts: number; uniform_at: Date | null }>(`select job, shifts, uniform_at from pet_job_progress where user_id = $1`, [userId]);
  return new Map(rows.map((r) => [r.job, r]));
}

/** Shift untuk client. Hasil (gaji, XP, bonus, cerita, pangkat) baru dikirim setelah waktunya habis. */
export function shiftView(j: JobRow, petName: string, k: KerjaSettings, shiftsBefore: number, uniformGot: boolean, now = Date.now()) {
  const done = ms(j.ends_at) <= now;
  const info = jobInfo(j.job);
  const base = { id: j.id, job: j.job, place: info.place, loc: info.loc, title: info.title, doing: info.doing, minutes: j.minutes, startedAt: ms(j.started_at), endsAt: ms(j.ends_at), done };
  if (!done) return base;
  const before = kerjaRank(shiftsBefore, k.rankAt), after = kerjaRank(shiftsBefore + 1, k.rankAt);
  return {
    ...base,
    pay: j.pay, xp: j.xp, bonus: j.bonus_item, story: kerjaStory(j.story ?? '', petName),
    rank: { before: before.key, after: after.key, label: after.label, up: after.idx > before.idx, shifts: shiftsBefore + 1, next: after.next, pct: after.pct },
    // naik ke Karyawan (atau lebih) & seragam tempat ini belum pernah didapat
    uniform: after.idx >= 1 && !uniformGot ? info.uniform : null,
  };
}

/** Keadaan kerja sambilan pemain (bagian /api/me & respons rute kerja). */
export async function kerjaState(db: Db, userId: string, s?: Settings) {
  s ??= await getSettings(db);
  const k = kerjaOf(s);
  const [open, used, pet, total] = await Promise.all([
    db.one<JobRow>(`select * from pet_jobs where user_id = $1 and status = 'working' limit 1`, [userId]),
    usedMinutesToday(db, userId),
    db.one<{ name: string }>(`select name from pets where user_id = $1`, [userId]),
    db.one<{ c: number }>(`select count(*)::int c from pet_jobs where user_id = $1`, [userId]),
  ]);
  let shift = null;
  if (open) {
    const prog = await db.one<{ shifts: number; uniform_at: Date | null }>(`select shifts, uniform_at from pet_job_progress where user_id = $1 and job = $2`, [userId, open.job]);
    shift = shiftView(open, pet?.name ?? 'Pet-mu', k, prog?.shifts ?? 0, !!prog?.uniform_at);
  }
  return { on: k.on !== false, shift, usedMinutes: used, maxMinutes: k.maxHoursPerDay * 60, shiftsEver: total?.c ?? 0 };
}

/** Papan lowongan lengkap (GET /api/kerja): tiap tempat dengan pilihan lama kerja, gaji sesuai pangkat, syarat, seragam. */
export async function kerjaBoard(db: Db, userId: string, s: Settings, owned: (id: string) => boolean) {
  const k = kerjaOf(s);
  const prog = await progressOf(db, userId);
  const jobs = KERJA_JOBS.map((job) => {
    const p = prog.get(job);
    const shifts = p?.shifts ?? 0;
    const r = kerjaRank(shifts, k.rankAt);
    const js = k.jobs?.[job] ?? { minLevel: 1, bonusPct: 0, bonusItems: [], kotor: false };
    const info = KERJA_INFO[job];
    return {
      id: job, place: info.place, loc: info.loc, title: info.title, doing: info.doing,
      minLevel: js.minLevel, bonusPct: js.bonusPct, bonusItems: js.bonusItems, kotor: !!js.kotor,
      options: kerjaOptions(k, job).map((o) => ({ ...o, basePay: o.pay, pay: kerjaPay(o.pay, r.idx, k.rankBonusPct) })),
      rank: { ...r, bonusPct: r.idx * k.rankBonusPct },
      uniform: { items: info.uniform, got: !!p?.uniform_at, owned: info.uniform.every(owned) },
      ...(job === 'ronda' ? { window: { fromHour: k.ronda.fromHour, toHour: k.ronda.toHour } } : {}),
    };
  });
  return {
    on: k.on !== false, jobs, rankAt: k.rankAt, rankBonusPct: k.rankBonusPct, rankLabels: KERJA_RANK_LABEL,
    minEnergi: k.minEnergi, minKenyang: k.minKenyang, maxMinutes: k.maxHoursPerDay * 60,
  };
}

/** cerita pulang kerja acak (pengaturan admin, atau bawaan bila kosong) */
export function pickStory(k: KerjaSettings, job: KerjaJob, rand = Math.random) {
  const list = (k.stories?.[job] ?? []).filter((x) => typeof x === 'string' && x.trim());
  const pool = list.length ? list : KERJA_STORIES[job];
  return pool[Math.floor(rand() * pool.length) % pool.length];
}

/** pangkat (index) dari jumlah shift selesai */
export const rankIdxOf = (k: KerjaSettings, shifts: number) => kerjaRankIdx(shifts, k.rankAt);
