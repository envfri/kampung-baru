// Cerdas Cermat Kampung: rute pemain (Kuis Harian, Tantang Teman, laporkan soal, beranda & papan peringkat) dan rute
// admin (bank soal, statistik, tanda otomatis, laporan). Logika ada di lib/kuis.ts; Cerdas Cermat Bareng di
// routes/bareng.ts + lib/kuis-bareng.ts; pembuatan tantangan lewat POST /api/duels {game:'kuis'} (routes/duels.ts).
import type { FastifyInstance } from 'fastify';
import {
  KUIS_CATEGORIES, KUIS_CAT_IDS, cleanQuestion, isKuisCat, normKuis, tantangLabel, validateQuestion, type KuisQuestion,
} from '@kb/shared';
import type { Db } from '../db/index';
import { bad, getSettings, notFound } from '../lib/core';
import { audit, requireAdmin, requireUser } from '../lib/auth';
import { notifyEvent } from '../lib/notify';
import {
  FLAG_SQL, REPORT_REASONS, advance, answerRun, assertKuisOn, forfeitRun, invalidateKuis, kuisHome, loadRun, reportQuestion, runView,
  expireTantang, settleExpired, startHarian, startTantang,
} from '../lib/kuis';
import { patch } from './game';

export default async function kuisRoutes(app: FastifyInstance, { db }: { db: Db }) {
  const auth = { preHandler: requireUser(db) };
  const mod = { preHandler: requireAdmin(db, 'moderator') };
  const adm = { preHandler: requireAdmin(db, 'admin') };

  /* ---------------- pemain ---------------- */

  app.get('/api/kuis', auth, async (req: any) => kuisHome(db, req.user!.id));

  /** mulai / lanjutkan Kuis Harian hari ini (set soal tetap sepanjang hari WIB) */
  app.post('/api/kuis/harian', auth, async (req: any) => {
    const uid = req.user!.id;
    const s = await getSettings(db);
    assertKuisOn(s);
    return db.tx(async (t) => {
      const run = await startHarian(t, uid, s);
      return { run: await runView(t, run), ...(await patch(t, uid, ['pet'])) };
    });
  });

  /** keadaan permainan (soal yang terlewat batas waktunya dicatat waktu habis) */
  app.get('/api/kuis/runs/:id', auth, async (req: any) => {
    const uid = req.user!.id;
    const s = await getSettings(db);
    return db.tx(async (t) => {
      let run = await loadRun(t, String(req.params.id), uid, true);
      await settleExpired(t, run, s);
      run = await loadRun(t, run.id, uid);
      return { run: await runView(t, run) };
    });
  });

  /** soal berikutnya (dikirim sekarang: batas waktunya mulai dihitung) */
  app.post('/api/kuis/runs/:id/next', auth, async (req: any) => {
    const uid = req.user!.id;
    const s = await getSettings(db);
    return db.tx(async (t) => {
      const run = await advance(t, await loadRun(t, String(req.params.id), uid, true), s);
      return { run: await runView(t, run) };
    });
  });

  /** jawab satu soal: {idx, pick} (pick null = waktu habis / menyerah) */
  app.post('/api/kuis/runs/:id/answer', auth, async (req: any) => {
    const u = req.user!;
    const s = await getSettings(db);
    const res = await db.tx(async (t) => {
      const run = await loadRun(t, String(req.params.id), u.id, true);
      if (run.finished_at) throw bad('finished', 'Kuis ini sudah selesai.');
      const result = await answerRun(t, run, Number(req.body?.idx), req.body?.pick, s);
      const fresh = await loadRun(t, run.id, u.id);
      return { result, run: await runView(t, fresh), out: await patch(t, u.id, ['wallet', 'pet']) };
    });
    const fin = res.result.finish;
    if (fin?.kind === 'tantang' && fin.done && fin.otherId) void tantangNotify({ otherId: fin.otherId, duelId: res.run.duelId }, u, req);
    return { result: { ...res.result, finish: fin ? { kind: fin.kind, bonus: fin.bonus, done: fin.done, levelUp: fin.levelUp ?? null } : null }, run: res.run, ...res.out };
  });

  /** akhiri sekarang: soal yang belum dijawab dihitung waktu habis */
  app.post('/api/kuis/runs/:id/akhiri', auth, async (req: any) => {
    const u = req.user!;
    const s = await getSettings(db);
    const res = await db.tx(async (t) => {
      const run = await forfeitRun(t, await loadRun(t, String(req.params.id), u.id, true), s);
      const d = run.duel_id ? await t.one<any>(`select status, challenger_id, opponent_id from duels where id = $1`, [run.duel_id]) : null;
      return { run: await runView(t, run), d, out: await patch(t, u.id, ['wallet', 'pet']) };
    });
    if (res.d?.status === 'done') void tantangNotify({ otherId: res.d.challenger_id === u.id ? res.d.opponent_id : res.d.challenger_id, duelId: res.run.duelId }, u, req);
    return { run: res.run, ...res.out };
  });

  /** Tantang Teman: mulai / lanjutkan giliran sendiri */
  app.post('/api/kuis/tantang/:id/start', auth, async (req: any) => {
    const uid = req.user!.id;
    const s = await getSettings(db);
    assertKuisOn(s);
    await expireTantang(db, String(req.params.id));
    return db.tx(async (t) => {
      const run = await startTantang(t, uid, String(req.params.id), s);
      return { run: await runView(t, run), ...(await patch(t, uid, ['pet'])) };
    });
  });

  app.post('/api/kuis/report', { ...auth, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req: any) => {
    const uid = req.user!.id;
    const s = await getSettings(db);
    return db.tx((t) => reportQuestion(t, uid, req.body ?? {}, s));
  });

  async function tantangNotify(fin: any, u: { id: string; display_name: string }, req: any) {
    try {
      const d = await db.one<any>(`select * from duels where id = $1`, [fin.duelId]);
      if (!d || d.status !== 'done') return;
      const other = fin.otherId;
      const oSide = d.challenger_id === other ? 'c' : 'o', mSide = oSide === 'c' ? 'o' : 'c';
      const hasil = d.winner_id === other ? 'Menang!' : d.winner_id ? 'Kalah' : 'Seri';
      await notifyEvent(db, other, 'duel_result', { teman: u.display_name, permainan: 'Tantang Kuis', hasil, skor: `${tantangLabel(d[oSide + '_score'])} vs ${tantangLabel(d[mSide + '_score'])}` }, { log: req.log, url: '/#kuis' });
    } catch (e) { req.log.error(e); }
  }

  /* ---------------- admin: bank soal ---------------- */

  const LIST_SQL = `select q.id, q.cat, q.level, q.type, q.data, q.active, q.origin, q.deleted_at, q.shown, q.answered, q.correct, q.created_at, q.updated_at, q.updated_by,
      coalesce(r.open, 0)::int open_reports, coalesce(r.total, 0)::int reports, ${FLAG_SQL} as flagged
    from kuis_questions q left join (select qid, count(*) filter (where resolved_at is null) open, count(*) total from kuis_reports group by qid) r on r.qid = q.id`;

  app.get('/api/admin/kuis/questions', mod, async (req: any) => {
    const f = req.query ?? {};
    const where: string[] = [], args: unknown[] = [];
    const arg = (v: unknown) => { args.push(v); return `$${args.length}`; };
    const many = (v: unknown) => String(v ?? '').split(',').map((x) => x.trim()).filter(Boolean);
    if (many(f.cat).length) where.push(`q.cat = any(${arg(many(f.cat))}::text[])`);
    if (many(f.level).length) where.push(`q.level = any(${arg(many(f.level).map(Number))}::int[])`);
    if (many(f.type).length) where.push(`q.type = any(${arg(many(f.type))}::text[])`);
    const st = String(f.status ?? '');
    if (st === 'active') where.push(`q.active and q.deleted_at is null`);
    else if (st === 'disabled') where.push(`not q.active and q.deleted_at is null`);
    else if (st === 'deleted') where.push(`q.deleted_at is not null`);
    else where.push(`q.deleted_at is null`);
    if (f.flagged === 'true') where.push(FLAG_SQL);
    if (f.origin === 'bank' || f.origin === 'admin') where.push(`q.origin = ${arg(f.origin)}`);
    const text = String(f.q ?? '').trim().toLowerCase();
    if (text) where.push(`(q.id ilike ${arg(`%${text}%`)} or lower(q.data::text) like ${arg(`%${text}%`)})`);
    const rows = await db.query(`${LIST_SQL} ${where.length ? 'where ' + where.join(' and ') : ''} order by q.id limit 2000`, args);
    const sum = await db.one<any>(`select count(*) filter (where deleted_at is null)::int total, count(*) filter (where active and deleted_at is null)::int active,
        count(*) filter (where not active and deleted_at is null)::int disabled, count(*) filter (where deleted_at is not null)::int deleted from kuis_questions`);
    const flagged = (await db.one<{ c: number }>(`select count(*)::int c from (${LIST_SQL} where q.deleted_at is null and ${FLAG_SQL}) x`))!.c;
    const open = (await db.one<{ c: number }>(`select count(*)::int c from kuis_reports where resolved_at is null`))!.c;
    const byCat = await db.query(`select cat, level, count(*)::int n from kuis_questions where active and deleted_at is null group by cat, level`);
    return { questions: rows, summary: { ...sum, flagged, openReports: open, byCat } };
  });

  app.get('/api/admin/kuis/questions/:id', mod, async (req: any) => {
    const q = await db.one(`${LIST_SQL} where q.id = $1`, [String(req.params.id)]);
    if (!q) throw notFound('Soal tidak ditemukan.');
    const reports = await db.query(`select r.id, r.reason, r.note, r.created_at, r.resolved_at, r.resolved_by, u.display_name as reporter from kuis_reports r left join users u on u.id = r.user_id where r.qid = $1 order by r.created_at desc limit 50`, [q.id]);
    return { question: q, reports };
  });

  /** ID baru untuk soal buatan admin: prefiks kategori + nomor 900–999 (bank resmi memakai nomor di bawahnya) */
  async function nextId(cat: string) {
    const pre = KUIS_CATEGORIES[cat as keyof typeof KUIS_CATEGORIES].prefix;
    const rows = await db.query<{ id: string }>(`select id from kuis_questions where id like $1`, [`${pre}-9%`]);
    const used = new Set(rows.map((r) => r.id));
    for (let n = 900; n <= 999; n++) { const id = `${pre}-${n}`; if (!used.has(id)) return id; }
    throw bad('full', 'Nomor soal buatan admin untuk kategori ini sudah habis (900–999).');
  }
  app.get('/api/admin/kuis/next-id', mod, async (req: any) => {
    const cat = String(req.query?.cat ?? '');
    if (!isKuisCat(cat)) throw bad('invalid', 'Kategori tidak dikenal.');
    return { id: await nextId(cat) };
  });

  /** periksa soal dengan validator yang sama dengan uji & seed, plus teks kembar dengan soal lain */
  async function checked(raw: any, id: string, selfId: string | null) {
    const q = cleanQuestion({ ...(raw ?? {}), id });
    const errors = validateQuestion(q);
    if (!errors.length) {
      const dup = await db.one<{ id: string }>(`select id from kuis_questions where qnorm = $1 and deleted_at is null and ($2::text is null or id <> $2)`, [normKuis(q.q), selfId]);
      if (dup) errors.push(`Teks soal sama dengan soal ${dup.id}.`);
    }
    if (errors.length) throw bad('invalid_question', errors.join(' '), { errors });
    return q as KuisQuestion;
  }

  app.post('/api/admin/kuis/questions', adm, async (req: any) => {
    const raw = req.body?.question ?? {};
    if (!isKuisCat(raw.cat)) throw bad('invalid_question', `Kategori "${raw.cat ?? ''}" tidak dikenal.`, { errors: [`Kategori "${raw.cat ?? ''}" tidak dikenal (pilih: ${KUIS_CAT_IDS.join(', ')}).`] });
    const id = await nextId(raw.cat);
    const q = await checked(raw, id, null);
    await db.query(`insert into kuis_questions (id, cat, level, type, data, qnorm, origin, active, updated_by) values ($1,$2,$3,$4,$5::text::jsonb,$6,'admin',$7,$8)`,
      [q.id, q.cat, q.level, q.type, JSON.stringify(q), normKuis(q.q), req.body?.active !== false, req.admin!.email]);
    invalidateKuis();
    await audit(db, req, 'kuis_question_create', q.id, { q: q.q });
    return { ok: true, question: await db.one(`${LIST_SQL} where q.id = $1`, [q.id]) };
  });

  app.put('/api/admin/kuis/questions/:id', adm, async (req: any) => {
    const id = String(req.params.id);
    const cur = await db.one<{ cat: string; data: KuisQuestion }>(`select cat, data from kuis_questions where id = $1`, [id]);
    if (!cur) throw notFound('Soal tidak ditemukan.');
    const raw = req.body?.question ?? {};
    if (raw.cat !== undefined && raw.cat !== cur.cat) throw bad('invalid_question', 'Kategori soal tidak bisa diganti. Buat soal baru di kategori lain lalu nonaktifkan soal ini.', { errors: ['Kategori soal tidak bisa diganti. Buat soal baru di kategori lain lalu nonaktifkan soal ini.'] });
    const q = await checked({ ...raw, cat: cur.cat }, id, id);
    await db.query(`update kuis_questions set level = $2, type = $3, data = $4::text::jsonb, qnorm = $5, updated_at = now(), updated_by = $6 where id = $1`,
      [id, q.level, q.type, JSON.stringify(q), normKuis(q.q), req.admin!.email]);
    invalidateKuis();
    await audit(db, req, 'kuis_question_update', id, { before: cur.data, after: q });
    return { ok: true, question: await db.one(`${LIST_SQL} where q.id = $1`, [id]) };
  });

  app.post('/api/admin/kuis/questions/:id/active', adm, async (req: any) => {
    const id = String(req.params.id);
    const on = req.body?.active === true;
    const r = await db.one(`update kuis_questions set active = $2, updated_at = now(), updated_by = $3 where id = $1 and deleted_at is null returning id`, [id, on, req.admin!.email]);
    if (!r) throw notFound('Soal tidak ditemukan.');
    invalidateKuis();
    await audit(db, req, on ? 'kuis_question_enable' : 'kuis_question_disable', id);
    return { ok: true };
  });

  /** hapus = disimpan dengan tanda dihapus, supaya sinkron bank tidak pernah menambahkannya lagi */
  app.delete('/api/admin/kuis/questions/:id', adm, async (req: any) => {
    const id = String(req.params.id);
    const r = await db.one(`update kuis_questions set deleted_at = now(), active = false, updated_at = now(), updated_by = $2 where id = $1 and deleted_at is null returning id`, [id, req.admin!.email]);
    if (!r) throw notFound('Soal tidak ditemukan.');
    invalidateKuis();
    await audit(db, req, 'kuis_question_delete', id);
    return { ok: true };
  });

  app.post('/api/admin/kuis/questions/:id/restore', adm, async (req: any) => {
    const id = String(req.params.id);
    const r = await db.one(`update kuis_questions set deleted_at = null, active = false, updated_at = now(), updated_by = $2 where id = $1 and deleted_at is not null returning id`, [id, req.admin!.email]);
    if (!r) throw notFound('Soal tidak ditemukan.');
    invalidateKuis();
    await audit(db, req, 'kuis_question_restore', id);
    return { ok: true };
  });

  /* ---------------- admin: laporan pemain ---------------- */

  app.get('/api/admin/kuis/reports', mod, async (req: any) => {
    const st = String(req.query?.status ?? '');
    const where = st === 'resolved' ? 'r.resolved_at is not null' : st === 'all' ? 'true' : 'r.resolved_at is null';
    const qid = String(req.query?.qid ?? '');
    const rows = await db.query(
      `select r.id, r.qid, r.reason, r.note, r.created_at, r.resolved_at, r.resolved_by, r.user_id, u.display_name as reporter,
              q.cat, q.type, q.level, q.data->>'q' as qtext, q.active, q.deleted_at,
              (select count(*)::int from kuis_reports x where x.qid = r.qid and x.resolved_at is null) as open_for_q
         from kuis_reports r left join users u on u.id = r.user_id left join kuis_questions q on q.id = r.qid
        where ${where} ${qid ? 'and r.qid = $1' : ''} order by r.created_at desc limit 500`, qid ? [qid] : []);
    const open = (await db.one<{ c: number }>(`select count(*)::int c from kuis_reports where resolved_at is null`))!.c;
    return { reports: rows, open, reasons: REPORT_REASONS };
  });

  app.post('/api/admin/kuis/reports/resolve', mod, async (req: any) => {
    const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).map(Number).filter((n: number) => Number.isInteger(n) && n > 0).slice(0, 500);
    if (!ids.length) throw bad('invalid', 'Pilih laporan dulu.');
    const rows = await db.query(`update kuis_reports set resolved_at = now(), resolved_by = $2 where id = any($1::bigint[]) and resolved_at is null returning id`, [ids, req.admin!.email]);
    await audit(db, req, 'kuis_reports_resolve', undefined, { ids });
    return { ok: true, count: rows.length };
  });
}
