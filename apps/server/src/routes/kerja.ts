// Kerja Sambilan: papan lowongan, mulai kerja, panggil pulang, terima gaji.
//  - mulai: syarat level, energi, kenyang, tidak sakit, tidak tidur, batas jam per hari, jendela Ronda (jam setempat);
//    kebutuhan pet dibekukan selama kerja (pets.work_until) dan biayanya dikenakan sekali saat pulang;
//  - gaji, XP, barang bonus, cerita, & pangkat ditentukan saat mulai, dibayar saat "Terima gaji" (sekali per shift);
//  - dipanggil pulang: gaji (dengan bonus pangkat) sebanding lama kerja, tanpa barang bonus, tidak dihitung untuk pangkat.
import type { FastifyInstance } from 'fastify';
import { KERJA_INFO, isKerjaJob, kerjaDur, kerjaOptions, kerjaPay, kerjaProRata, kerjaRank, kerjaStory, localHM, rondaOpen, tzOf } from '@kb/shared';
import type { Db } from '../db/index';
import { addItem, bad, credit, getCatalog, getSettings, today, track } from '../lib/core';
import { requireUser } from '../lib/auth';
import { J, currentNeeds, endWork, isAsleep, isSick, lockPet, savePet } from '../lib/state';
import { forgetWorking, jobInfo, kerjaBoard, kerjaClock, kerjaOf, kerjaState, pickStory, rankIdxOf, usedMinutesToday, workingError, type JobRow } from '../lib/kerja';
import { reqId } from '../lib/validate';
import { grantXp, once, patch } from './game';

const ms = (d: Date | string | null | undefined) => (d ? new Date(d).getTime() : 0);
const hh = (h: number) => `${String(h % 24).padStart(2, '0')}.00`;

export default async function kerjaRoutes(app: FastifyInstance, { db }: { db: Db }) {
  const auth = { preHandler: requireUser(db) };

  app.get('/api/kerja', auth, async (req: any) => {
    const uid = req.user!.id;
    const [s, cat] = await Promise.all([getSettings(db), getCatalog(db)]);
    const inv = new Set((await db.query<{ item_id: string }>(`select item_id from inventory where user_id = $1 and qty > 0`, [uid])).map((r) => r.item_id));
    return { ...(await kerjaBoard(db, uid, s, (id) => inv.has(id) || !cat.byId.get(id))), state: await kerjaState(db, uid, s), serverNow: Date.now() };
  });

  /* ---------------- mulai kerja ---------------- */

  app.post('/api/kerja/start', auth, async (req: any) => {
    const uid = req.user!.id;
    const b = req.body ?? {};
    const [s, cat] = await Promise.all([getSettings(db), getCatalog(db)]);
    const k = kerjaOf(s);
    if (k.on === false) throw bad('kerja_off', 'Papan Lowongan sedang tutup. Coba lagi nanti, ya.');
    if (!isKerjaJob(b.job)) throw bad('invalid', 'Pekerjaan tidak dikenal.');
    const job = b.job;
    const info = KERJA_INFO[job];
    const opts = kerjaOptions(k, job);
    const opt = job === 'ronda' ? opts[0] : opts.find((o) => o.minutes === Number(b.minutes));
    if (!opt) throw bad('invalid', 'Pilih lama kerja dulu.');
    if (job === 'ronda' && !rondaOpen(localHM(kerjaClock(), tzOf(b.tz)), k.ronda.fromHour, k.ronda.toHour)) {
      throw bad('ronda_closed', `Ronda malam hanya bisa mulai pukul ${hh(k.ronda.fromHour)}–${hh(k.ronda.toHour)}. Datang lagi nanti malam, ya.`);
    }
    const js = k.jobs?.[job] ?? { minLevel: 1, bonusPct: 0, bonusItems: [], kotor: false };
    const res = await once(db, uid, reqId(b.requestId), async (t) => {
      const pet = await lockPet(t, uid);
      if (!pet) throw bad('no_pet', 'Buat pet dulu.');
      const open = await t.one<JobRow>(`select * from pet_jobs where user_id = $1 and status = 'working' for update`, [uid]);
      if (open && ms(open.ends_at) > Date.now()) throw workingError({ name: pet.name, work_until: open.ends_at, work_job: open.job });
      if (open) throw bad('unclaimed', `${pet.name} baru pulang kerja. Terima gajinya dulu, ya.`);
      if (pet.level < js.minLevel) throw bad('locked', `${info.title} di ${info.place} terbuka di Lv ${js.minLevel}.`);
      if (isAsleep(pet, s)) throw bad('asleep', `${pet.name} sedang tidur. Bangunkan dulu, ya.`);
      if (isSick(pet, s)) throw bad('sick', `${pet.name} lagi kurang enak badan. Kasih jamu dulu, baru kerja.`);
      const needs = currentNeeds(pet, s);
      if (needs.energi < k.minEnergi) throw bad('tired', `${pet.name} masih capek. Butuh energi paling sedikit ${k.minEnergi} untuk kerja: tidur dulu, ya.`);
      if (needs.kenyang < k.minKenyang) throw bad('hungry', `${pet.name} lapar. Butuh kenyang paling sedikit ${k.minKenyang}: makan dulu sebelum kerja, ya.`);
      const used = await usedMinutesToday(t, uid);
      const max = k.maxHoursPerDay * 60;
      if (used + opt.minutes > max) {
        const left = Math.max(0, max - used);
        throw bad('daily_cap', `${pet.name} sudah kerja ${kerjaDur(used)} hari ini. Batasnya ${k.maxHoursPerDay} jam sehari${left ? `, sisa ${kerjaDur(left)}` : ''}. Istirahat dulu, ya.`, { usedMinutes: used, maxMinutes: max });
      }
      const prog = await t.one<{ shifts: number }>(`select shifts from pet_job_progress where user_id = $1 and job = $2`, [uid, job]);
      const rIdx = rankIdxOf(k, prog?.shifts ?? 0);
      const pay = kerjaPay(opt.pay, rIdx, k.rankBonusPct);
      // barang bonus: peluang bonusPct %, dipilih acak dari barang yang masih ada di katalog
      const pool = (js.bonusItems ?? []).filter((id) => cat.byId.get(id)?.active);
      const bonus = pool.length && Math.random() * 100 < js.bonusPct ? pool[Math.floor(Math.random() * pool.length)] : null;
      const now = Date.now();
      const ends = new Date(now + opt.minutes * 60_000);
      await t.query(
        `insert into pet_jobs (user_id, job, minutes, day, started_at, ends_at, pay, xp, bonus_item, story, rank, cost)
         values ($1,$2,$3,$4::date,$5,$6,$7,$8,$9,$10,$11,$12::text::jsonb)`,
        [uid, job, opt.minutes, today(), new Date(now), ends, pay, opt.xp, bonus, pickStory(k, job), kerjaRank(prog?.shifts ?? 0, k.rankAt).key, J(opt.cost)],
      );
      // kebutuhan dibekukan di nilai sekarang sampai pulang
      await savePet(t, uid, { needs });
      await t.query(`update pets set work_until = $2, work_cost = $3::text::jsonb, work_job = $4 where user_id = $1`, [uid, ends, J(opt.cost), job]);
      await track(t, uid, 'kerja_start', { job, minutes: opt.minutes });
      return { ok: true, kerja: await kerjaState(t, uid, s), ...(await patch(t, uid, ['pet'])) };
    });
    forgetWorking(uid);
    return res;
  });

  /* ---------------- panggil pulang ---------------- */

  app.post('/api/kerja/recall', auth, async (req: any) => {
    const uid = req.user!.id;
    const s = await getSettings(db);
    const res = await once(db, uid, reqId(req.body?.requestId), async (t) => {
      const pet = await lockPet(t, uid);
      if (!pet) throw bad('no_pet', 'Buat pet dulu.');
      const j = await t.one<JobRow>(`select * from pet_jobs where user_id = $1 and status = 'working' for update`, [uid]);
      if (!j) throw bad('not_working', `${pet.name} sedang tidak kerja.`);
      const now = Date.now(), start = ms(j.started_at), end = ms(j.ends_at);
      if (end <= now) throw bad('already_done', `${pet.name} sudah selesai kerja. Terima gajinya, ya.`, { done: true });
      const worked = Math.max(0, now - start), total = Math.max(1, end - start);
      const paid = kerjaProRata(j.pay, worked, total);
      const xp = Math.floor((j.xp * worked) / total);
      const workedMinutes = Math.min(j.minutes, Math.ceil(worked / 60_000));
      await t.query(`update pet_jobs set status = 'recalled', ended_at = $2, worked_minutes = $3, paid = $4 where id = $1`, [j.id, new Date(now), workedMinutes, paid]);
      if (paid) await credit(t, uid, 'coin', paid, 'kerja_recall', j.id);
      let levelUp: number | null = null;
      if (xp) { const lv = await grantXp(t, uid, pet, xp); await savePet(t, uid, { level: lv.level, xp: lv.xp }); if (lv.levelsGained) levelUp = lv.level; Object.assign(pet, { level: lv.level, xp: lv.xp }); }
      // pulang lebih awal: biaya kebutuhan sebanding lama kerja
      await endWork(t, pet, s, now, worked / total);
      await track(t, uid, 'kerja_recall', { job: j.job, minutes: workedMinutes });
      return { ok: true, result: { job: j.job, place: jobInfo(j.job).place, paid, xp, workedMinutes, levelUp }, kerja: await kerjaState(t, uid, s), ...(await patch(t, uid, ['pet', 'wallet'])) };
    });
    forgetWorking(uid);
    return res;
  });

  /* ---------------- terima gaji ---------------- */

  app.post('/api/kerja/claim', auth, async (req: any) => {
    const uid = req.user!.id;
    const [s, cat] = await Promise.all([getSettings(db), getCatalog(db)]);
    const k = kerjaOf(s);
    const res = await once(db, uid, reqId(req.body?.requestId), async (t) => {
      // mengunci pet juga mengenakan biaya kerja bila belum (settlePet)
      const pet = await lockPet(t, uid);
      if (!pet) throw bad('no_pet', 'Buat pet dulu.');
      const j = await t.one<JobRow>(`select * from pet_jobs where user_id = $1 and status = 'working' for update`, [uid]);
      if (!j) throw bad('nothing', 'Tidak ada gaji yang menunggu.');
      if (ms(j.ends_at) > Date.now()) throw bad('not_done', `${pet.name} masih kerja. Tunggu sampai pulang, ya.`);
      await t.query(`update pet_jobs set status = 'claimed', claimed_at = now(), paid = pay where id = $1`, [j.id]);
      if (j.pay) await credit(t, uid, 'coin', j.pay, 'kerja', j.id);
      const bonus = j.bonus_item && cat.byId.get(j.bonus_item) ? j.bonus_item : null;
      if (bonus) await addItem(t, uid, bonus, 1);
      let levelUp: number | null = null;
      if (j.xp) { const lv = await grantXp(t, uid, pet, j.xp); await savePet(t, uid, { level: lv.level, xp: lv.xp }); if (lv.levelsGained) levelUp = lv.level; }
      // pangkat per tempat & seragam (sekali saja, saat pertama kali jadi Karyawan atau lebih)
      const before = (await t.one<{ shifts: number }>(`select shifts from pet_job_progress where user_id = $1 and job = $2`, [uid, j.job]))?.shifts ?? 0;
      const prog = (await t.one<{ shifts: number; uniform_at: Date | null }>(
        `insert into pet_job_progress (user_id, job, shifts) values ($1, $2, 1)
         on conflict (user_id, job) do update set shifts = pet_job_progress.shifts + 1 returning shifts, uniform_at`, [uid, j.job]))!;
      const rb = kerjaRank(before, k.rankAt), ra = kerjaRank(prog.shifts, k.rankAt);
      let uniform: string[] | null = null;
      if (ra.idx >= 1 && !prog.uniform_at) {
        const got = await t.one(`update pet_job_progress set uniform_at = now() where user_id = $1 and job = $2 and uniform_at is null returning 1 as ok`, [uid, j.job]);
        if (got) {
          uniform = jobInfo(j.job).uniform.filter((id) => cat.byId.get(id));
          for (const id of uniform) await addItem(t, uid, id, 1);
        }
      }
      await track(t, uid, 'kerja', { job: j.job, minutes: j.minutes });
      if (ra.idx > rb.idx) await track(t, uid, 'kerja_rank', { job: j.job, rank: ra.key });
      return {
        ok: true,
        result: {
          job: j.job, place: jobInfo(j.job).place, pay: j.pay, xp: j.xp, bonus, story: kerjaStory(j.story ?? '', pet.name), levelUp,
          rank: { before: rb.key, after: ra.key, label: ra.label, up: ra.idx > rb.idx, shifts: prog.shifts, next: ra.next, pct: ra.pct }, uniform,
        },
        kerja: await kerjaState(t, uid, s),
        ...(await patch(t, uid, ['pet', 'wallet', 'inventory'])),
      };
    });
    forgetWorking(uid);
    return res;
  });
}
