// Panel admin v0.26: daftar dengan filter/urut/total/ekspor CSV (pemain, pembayaran, log audit, obrolan, laporan),
// angka menu samping, aksi massal pemain, bisukan obrolan, dan data dasbor tambahan.
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Db } from '../db/index';
import { APP_VERSION, AUDIT_CATS, xpToNext } from '@kb/shared';
import { activeEvents, addItem, bad, credit, getCatalog, getSettings, notFound, today } from '../lib/core';
import { BUILD } from '../lib/version';
import { getSite } from '../lib/site';
import { audit, requireAdmin } from '../lib/auth';
import { int, oneOf, str } from '../lib/validate';
import { notifyEvent } from '../lib/notify';
import { presenceOf } from './house';
import { forgetMute, squareStats } from './square';

const UUID = /^[0-9a-f-]{36}$/i;
const SIZES = [5, 10, 25, 50, 100];

/** halaman & urutan dari query (kolom urut hanya dari daftar putih) */
export function listOpts(q: any, sorts: Record<string, string>, def: string) {
  const size = SIZES.includes(Number(q?.size)) ? Number(q.size) : 25;
  const page = Math.max(0, Math.min(10_000, Number(q?.page ?? 0) | 0));
  const key = String(q?.sort ?? '');
  const sort = sorts[key] ?? sorts[def];
  const dir = q?.dir === 'asc' ? 'asc' : 'desc';
  return { size, page, offset: page * size, order: `${sort} ${dir} nulls last` };
}
const iso = (v: unknown) => { const s = String(v ?? ''); const d = new Date(s); return s && !Number.isNaN(d.getTime()) ? d.toISOString() : null; };
const many = (v: unknown, allowed: readonly string[]) => String(v ?? '').split(',').filter((x) => allowed.includes(x));
const like = (s: string) => `%${s.toLowerCase().replace(/[\\%_]/g, (m) => '\\' + m)}%`;
/** pembangun WHERE dengan parameter bernomor */
function W() {
  const where: string[] = [], params: unknown[] = [];
  const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
  return { where, params, p, sql: () => (where.length ? 'where ' + where.join(' and ') : '') };
}
function dates(w: ReturnType<typeof W>, col: string, from: unknown, to: unknown) {
  const f = iso(from), t = iso(to);
  if (f) w.where.push(`${col} >= ${w.p(f)}`);
  if (t) w.where.push(`${col} < ${w.p(t)}`);
}
/** kirim CSV (BOM supaya Excel membaca UTF-8) */
export function sendCsv(reply: FastifyReply, name: string, cols: [string, (r: any) => unknown][], rows: any[]) {
  const esc = (v: unknown) => { const s = v == null ? '' : v instanceof Date ? v.toISOString() : String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const body = '﻿' + [cols.map((c) => esc(c[0])).join(','), ...rows.map((r) => cols.map((c) => esc(c[1](r))).join(','))].join('\n');
  reply.header('content-type', 'text/csv; charset=utf-8');
  reply.header('content-disposition', `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`);
  reply.header('cache-control', 'no-store');
  return reply.send(body);
}

export default async function adminExtraRoutes(app: FastifyInstance, { db }: { db: Db }) {
  const mod = { preHandler: requireAdmin(db, 'moderator') };
  const adm = { preHandler: requireAdmin(db, 'admin') };
  const own = { preHandler: requireAdmin(db, 'owner') };
  const RANK: Record<string, number> = { moderator: 1, admin: 2, owner: 3 };

  /* ---------------- dasbor ---------------- */
  // ringkasan dengan rentang waktu, tren dibanding kemarin / periode sebelumnya, "perlu perhatian", dan status server
  app.get('/api/admin/dashboard', mod, async (req: any) => {
    const days = [1, 7, 14, 30, 90].includes(Number(req.query?.days)) ? Number(req.query.days) : 14;
    const span = Math.max(days, 7);
    const one = async (sql: string, p: unknown[] = []) => (await db.one<{ v: number }>(sql, p))?.v ?? 0;
    const d0 = today();
    const yday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const t0 = Date.now();
    await db.one('select 1');
    const dbMs = Date.now() - t0;
    const [k, series, d1, d1prev, funnel, played, money, coinFlow] = await Promise.all([
      db.one<any>(`select
          (select count(*)::int from users) users,
          (select count(*)::int from users where is_guest) guests,
          (select count(*)::int from users where created_at >= date_trunc('day', now())) new_today,
          (select count(*)::int from users where created_at >= date_trunc('day', now()) - interval '1 day' and created_at < date_trunc('day', now())) new_yday,
          (select count(*)::int from pets pt join users u on u.id = pt.user_id where u.created_at >= date_trunc('day', now())) pets_today,
          (select count(distinct user_id)::int from analytics_events where name = 'active' and props->>'day' = $1) dau,
          (select count(distinct user_id)::int from analytics_events where name = 'active' and props->>'day' = $2) dau_yday,
          (select count(distinct user_id)::int from analytics_events where name = 'active' and created_at > now() - interval '7 days') wau,
          (select count(*)::int from users where last_seen_at > now() - interval '150 seconds') online,
          (select coalesce(sum(coin),0)::float8 from wallets) coins,
          (select coalesce(sum(pearl),0)::float8 from wallets) pearls`, [d0, yday]),
      db.query(`select to_char(day, 'YYYY-MM-DD') as day,
              (select count(distinct user_id)::int from analytics_events a where a.name = 'active' and a.props->>'day' = to_char(day, 'YYYY-MM-DD')) dau,
              (select count(*)::int from users u where u.created_at >= day and u.created_at < day + interval '1 day') signups,
              (select coalesce(sum(amount_idr),0)::float8 from payments p where p.status = 'paid' and not p.test and p.paid_at >= day and p.paid_at < day + interval '1 day') revenue
         from generate_series(date_trunc('day', now()) - make_interval(days => $1::int - 1), date_trunc('day', now()), interval '1 day') day order by day`, [span]),
      db.one<{ cohort: number; back: number }>(
        `with c as (select id from users where created_at >= date_trunc('day', now() - interval '1 day') and created_at < date_trunc('day', now()))
         select (select count(*)::int from c) cohort,
                (select count(distinct a.user_id)::int from analytics_events a join c on c.id = a.user_id where a.name = 'active' and a.props->>'day' = $1) back`, [d0]),
      db.one<{ cohort: number; back: number }>(
        `with c as (select id from users where created_at >= date_trunc('day', now() - interval '2 days') and created_at < date_trunc('day', now() - interval '1 day'))
         select (select count(*)::int from c) cohort,
                (select count(distinct a.user_id)::int from analytics_events a join c on c.id = a.user_id where a.name = 'active' and a.props->>'day' = $1) back`, [yday]),
      db.query<{ name: string; users: number }>(
        `select name, count(distinct user_id)::int users from analytics_events
          where created_at > now() - interval '30 days' and name in ('signup','pet_created','action','purchase','visit','bareng_start','race','fish','payment_paid')
          group by name`),
      db.query<{ name: string; n: number }>(
        `select name, count(*)::int n from analytics_events
          where created_at >= date_trunc('day', now()) and name in ('coop','bareng_start','race','fish','square_act','game_finish','duel','visit_play','photo','harvest')
          group by name order by n desc`),
      db.one<any>(`select
          coalesce(sum(amount_idr) filter (where paid_at > now() - make_interval(days => $1::int)), 0)::float8 rev,
          count(*) filter (where paid_at > now() - make_interval(days => $1::int))::int n,
          coalesce(sum(amount_idr) filter (where paid_at > now() - make_interval(days => $1::int * 2) and paid_at <= now() - make_interval(days => $1::int)), 0)::float8 rev_prev,
          count(distinct user_id) filter (where paid_at > now() - make_interval(days => $1::int))::int payers
        from payments where status = 'paid' and not test`, [days]),
      db.query<{ day: string; net: number }>(`select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day, coalesce(sum(delta),0)::float8 net
          from wallet_ledger where currency = 'coin' and created_at > date_trunc('day', now()) - interval '13 days' group by 1 order by 1`),
    ]);
    // perlu perhatian
    const [rep, pend, mail] = await Promise.all([
      db.one<any>(`select count(*)::int c, min(created_at) oldest from reports where handled_at is null`),
      db.one<any>(`select count(*)::int c, coalesce(sum(amount_idr),0)::float8 amount, min(expires_at) expires from payments
                    where status = 'pending' and created_at < now() - interval '10 minutes' and (expires_at is null or expires_at > now())`),
      db.one<any>(`select count(*)::int c from email_outbox where status = 'failed' and created_at > now() - interval '1 day'`).catch(() => ({ c: 0 })),
    ]);
    const cat = await getCatalog(db);
    const evs = await Promise.all(activeEvents(cat).map(async (e: any) => ({
      id: e.id, name: e.name, starts_at: e.starts_at, ends_at: e.ends_at,
      players: await one(`select count(distinct user_id)::int v from event_progress where event_id = $1 and updated_at >= $2`, [e.id, e.starts_at]),
    })));
    const site: any = await getSite(db).catch(() => null);
    return {
      days, k, series, coinFlow,
      d1: { cohort: d1?.cohort ?? 0, back: d1?.back ?? 0 }, d1prev: { cohort: d1prev?.cohort ?? 0, back: d1prev?.back ?? 0 },
      funnel: Object.fromEntries(funnel.map((f) => [f.name, f.users])),
      played, money,
      attention: { reports: rep, pending: pend, mailFailed: (mail as any)?.c ?? 0, events: evs },
      server: { version: APP_VERSION, commit: (BUILD as any)?.commit ?? null, uptimeSec: Math.round(process.uptime()), dbMs, square: squareStats(), maintenance: !!site?.maintenance?.on },
    };
  });

  /* ---------------- angka di menu samping ---------------- */
  app.get('/api/admin/badges', mod, async (req: any) => {
    const reports = (await db.one<{ c: number }>(`select count(*)::int c from reports where handled_at is null`))?.c ?? 0;
    const out: Record<string, number> = { reports };
    if (RANK[req.admin!.role] >= RANK.admin) {
      out.payments = (await db.one<{ c: number }>(`select count(*)::int c from payments where status = 'pending' and (expires_at is null or expires_at > now()) and created_at > now() - interval '1 day'`))?.c ?? 0;
    }
    return { badges: out };
  });

  /* ---------------- pemain ---------------- */
  const PLAYER_SORTS: Record<string, string> = {
    seen: 'u.last_seen_at', joined: 'u.created_at', level: 'p.level', coin: 'coin', pearl: 'pearl', spent: 'spent', name: 'lower(u.display_name)',
  };
  function playerFilter(q: any) {
    const w = W();
    const s = String(q?.q ?? '').trim();
    if (s) {
      const l = w.p(like(s));
      const exact = w.p(s);
      w.where.push(`(lower(u.display_name) like ${l} or lower(p.name) like ${l} or lower(u.friend_code) like ${l} or u.id::text = ${exact}
        or exists(select 1 from auth_identities ai where ai.user_id = u.id and lower(ai.email) like ${l}))`);
    }
    const st = String(q?.status ?? q?.filter ?? '');
    if (st === 'akun') w.where.push('not u.is_guest and u.banned_at is null');
    if (st === 'tamu' || st === 'guest') w.where.push('u.is_guest');
    if (st === 'banned') w.where.push('u.banned_at is not null');
    if (st === 'muted') w.where.push('u.chat_muted_until > now()');
    if (st === 'payer') w.where.push(`exists(select 1 from payments py where py.user_id = u.id and py.status = 'paid')`);
    const act = String(q?.active ?? '');
    if (act === 'online') w.where.push(`u.last_seen_at > now() - interval '150 seconds'`);
    if (act === 'today') w.where.push(`u.last_seen_at >= date_trunc('day', now())`);
    if (act === '7' || act === '30') w.where.push(`u.last_seen_at > now() - interval '${act} days'`);
    if (act === 'idle30') w.where.push(`u.last_seen_at < now() - interval '30 days'`);
    const logins = many(q?.login, ['email', 'google', 'facebook', 'guest']);
    if (logins.length) {
      const parts = logins.filter((x) => x !== 'guest').map((x) => `exists(select 1 from auth_identities ai where ai.user_id = u.id and ai.provider = ${w.p(x)})`);
      if (logins.includes('guest')) parts.push('u.is_guest');
      w.where.push(`(${parts.join(' or ')})`);
    }
    const lvMin = Number(q?.lvMin), lvMax = Number(q?.lvMax);
    if (q?.lvMin !== undefined && Number.isFinite(lvMin)) w.where.push(`p.level >= ${w.p(lvMin)}`);
    if (q?.lvMax !== undefined && Number.isFinite(lvMax)) w.where.push(`p.level <= ${w.p(lvMax)}`);
    dates(w, 'u.created_at', q?.joinedFrom, q?.joinedTo);
    const pay = String(q?.payer ?? '');
    if (pay === 'yes') w.where.push(`exists(select 1 from payments py where py.user_id = u.id and py.status = 'paid')`);
    if (pay === 'no') w.where.push(`not exists(select 1 from payments py where py.user_id = u.id and py.status = 'paid')`);
    return w;
  }
  const PLAYER_COLS = `u.id, u.display_name, u.friend_code, u.is_guest, u.banned_at, u.ban_reason, u.chat_muted_until, u.created_at, u.last_seen_at, u.show_online,
       p.name as pet_name, p.level, p.xp, p.color, p.ear, p.pattern, p.eyes, p.tail,
       coalesce(w.coin, 0)::float8 as coin, coalesce(w.pearl, 0)::float8 as pearl,
       coalesce((select sum(py.amount_idr) from payments py where py.user_id = u.id and py.status = 'paid'), 0)::float8 as spent,
       coalesce((select string_agg(distinct ai.provider, ',') from auth_identities ai where ai.user_id = u.id), '') as providers,
       (select ai.email from auth_identities ai where ai.user_id = u.id and ai.email is not null order by ai.created_at limit 1) as email,
       (select count(*)::int from friendships f where f.user_id = u.id) as friends`;
  const PLAYER_FROM = `from users u left join pets p on p.user_id = u.id left join wallets w on w.user_id = u.id`;
  const withPresence = (r: any) => {
    const pr = presenceOf(r.id, r.last_seen_at);
    return { ...r, providers: r.providers ? String(r.providers).split(',') : [], online: !!pr, where: pr?.where ?? null };
  };

  app.get('/api/admin/players', mod, async (req: any) => {
    const w = playerFilter(req.query);
    const o = listOpts(req.query, PLAYER_SORTS, 'seen');
    const [rows, total] = await Promise.all([
      db.query(`select ${PLAYER_COLS} ${PLAYER_FROM} ${w.sql()} order by ${o.order}, u.id limit ${o.size} offset ${o.offset}`, w.params),
      db.one<{ c: number }>(`select count(*)::int c ${PLAYER_FROM} ${w.sql()}`, w.params),
    ]);
    return { players: rows.map(withPresence), total: total?.c ?? 0, page: o.page };
  });
  app.get('/api/admin/players-summary', mod, async () => {
    const r = await db.one<any>(`select count(*)::int total,
        count(*) filter (where last_seen_at > now() - interval '150 seconds')::int online,
        count(*) filter (where last_seen_at >= date_trunc('day', now()))::int active_today,
        count(*) filter (where created_at >= date_trunc('day', now()))::int new_today,
        count(*) filter (where chat_muted_until > now())::int muted,
        count(*) filter (where banned_at is not null)::int banned
      from users`);
    return { summary: r };
  });
  app.get('/api/admin/export/players.csv', adm, async (req: any, reply) => {
    const w = playerFilter(req.query);
    const o = listOpts({ ...req.query, size: 100 }, PLAYER_SORTS, 'seen');
    const rows = await db.query(`select ${PLAYER_COLS} ${PLAYER_FROM} ${w.sql()} order by ${o.order}, u.id limit 20000`, w.params);
    await audit(db, req, 'player_export', undefined, { rows: rows.length });
    return sendCsv(reply, 'pemain', [
      ['id', (r) => r.id], ['nama', (r) => r.display_name], ['kode_teman', (r) => r.friend_code], ['email', (r) => r.email], ['login', (r) => r.providers || (r.is_guest ? 'tamu' : '')],
      ['pet', (r) => r.pet_name], ['level', (r) => r.level], ['koin', (r) => r.coin], ['mutiara', (r) => r.pearl], ['total_belanja_idr', (r) => r.spent], ['teman', (r) => r.friends],
      ['daftar', (r) => r.created_at], ['terakhir_aktif', (r) => r.last_seen_at], ['diblokir', (r) => (r.banned_at ? 'ya' : '')], ['alasan_blokir', (r) => r.ban_reason],
    ], rows);
  });

  /** detail tambahan untuk laci pemain (jatah harian, sesi, laporan, posisi online) */
  app.get('/api/admin/players/:id/extra', mod, async (req: any) => {
    const id = String(req.params.id);
    if (!UUID.test(id)) throw bad('invalid', 'ID tidak valid.');
    const s: any = await getSettings(db);
    const [u, counters, sessions, rep, reportsBy, blocks] = await Promise.all([
      db.one<any>(`select u.last_seen_at, u.show_online, u.live_visits, u.friend_requests, u.chat_muted_until, p.level, p.xp from users u left join pets p on p.user_id = u.id where u.id = $1`, [id]),
      db.query<{ key: string; count: number }>(`select key, count from daily_counters where user_id = $1 and day = current_date order by key`, [id]),
      db.one<{ c: number; last: string | null }>(`select count(*)::int c, max(created_at) last from sessions where user_id = $1 and expires_at > now()`, [id]),
      db.one<{ c: number; last: string | null }>(`select count(*)::int c, max(created_at) last from reports where target_id = $1 and created_at > now() - interval '30 days'`, [id]),
      db.one<{ c: number }>(`select count(*)::int c from reports where reporter_id = $1 and created_at > now() - interval '30 days'`, [id]),
      db.one<{ c: number }>(`select count(*)::int c from blocks where blocked_id = $1`, [id]).catch(() => ({ c: 0 })),
    ]);
    if (!u) throw notFound('Pemain tidak ditemukan.');
    const pr = presenceOf(id, u.last_seen_at);
    const limits: Record<string, number | undefined> = {
      coop: s.visit?.coopPerDay, karung: s.karung?.playsPerDay, photo: s.visit?.photoPerDay, gifts: s.social?.giftsPerDay,
      fishing: s.fishing?.castsPerDay, friend_ask: 30, duel: s.duel?.perDay,
    };
    return {
      xpNext: u.level ? xpToNext(u.level, s.economy) : null,
      counters: counters.map((c) => ({ ...c, limit: limits[c.key] ?? null })),
      sessions: sessions?.c ?? 0, lastSession: sessions?.last ?? null,
      reports30: rep?.c ?? 0, lastReport: rep?.last ?? null, reportsMade30: reportsBy?.c ?? 0, blockedBy: (blocks as any)?.c ?? 0,
      presence: pr, privacy: { showOnline: u.show_online, liveVisits: u.live_visits, friendRequests: u.friend_requests },
    };
  });

  app.post('/api/admin/players/:id/mute', mod, async (req: any) => {
    const id = String(req.params.id);
    if (!UUID.test(id)) throw bad('invalid', 'ID tidak valid.');
    const minutes = int(Number(req.body?.minutes), 'Lama', { min: 5, max: 7 * 24 * 60 });
    const reason = str(req.body?.reason, 'Alasan', { min: 3, max: 200 })!;
    const r = await db.one(`update users set chat_muted_until = now() + make_interval(mins => $2::int) where id = $1 returning chat_muted_until`, [id, minutes]);
    if (!r) throw notFound('Pemain tidak ditemukan.');
    forgetMute(id);
    await audit(db, req, 'player_mute', id, { minutes, reason });
    return { ok: true, until: (r as any).chat_muted_until };
  });

  const idsOf = (v: unknown) => {
    const ids = [...new Set((Array.isArray(v) ? v : []).map(String).filter((x) => UUID.test(x)))];
    if (!ids.length) throw bad('invalid', 'Pilih minimal satu pemain.');
    if (ids.length > 500) throw bad('invalid', 'Maksimal 500 pemain sekaligus.');
    return ids;
  };
  app.post('/api/admin/players/bulk-notify', adm, async (req: any) => {
    const ids = idsOf(req.body?.ids);
    const title = str(req.body?.title, 'Judul', { min: 2, max: 60 })!;
    const body = str(req.body?.body, 'Isi', { min: 2, max: 160 })!;
    let sent = 0;
    for (const id of ids) {
      try { await notifyEvent(db, id, 'admin_message', { judul: title, isi: body }, { log: req.log }); sent++; } catch (e) { req.log.warn({ err: e, id }, 'notifikasi massal gagal untuk satu pemain'); }
    }
    await audit(db, req, 'player_bulk_notify', `${ids.length} pemain`, { title, sent, ids: ids.slice(0, 50) });
    return { ok: true, sent };
  });
  app.post('/api/admin/players/bulk-gift', own, async (req: any) => {
    const ids = idsOf(req.body?.ids);
    const reason = str(req.body?.reason, 'Alasan', { min: 3, max: 120 })!;
    const kind = oneOf(req.body?.kind, 'Jenis hadiah', ['coin', 'pearl', 'item'] as const);
    const amount = int(Number(req.body?.amount), 'Jumlah', { min: 1, max: kind === 'pearl' ? 10_000 : kind === 'coin' ? 1_000_000 : 99 });
    let itemId = '';
    if (kind === 'item') {
      itemId = String(req.body?.itemId ?? '');
      const it = await db.one<{ kind: string }>('select kind from items where id = $1', [itemId]);
      if (!it) throw notFound('Item tidak ditemukan.');
      if (it.kind === 'room') throw bad('invalid_item', 'Ruangan tidak bisa dihadiahkan lewat tas.');
    }
    const found = await db.query<{ id: string }>(`select id from users where id = any($1::uuid[])`, [ids]);
    await db.tx(async (t) => {
      for (const { id } of found) {
        if (kind === 'item') await addItem(t, id, itemId, amount);
        else await credit(t, id, kind, amount, 'admin', `${req.admin!.email}: ${reason}`);
      }
    });
    await audit(db, req, 'player_bulk_gift', `${found.length} pemain`, { kind, amount, itemId: itemId || undefined, reason, ids: found.slice(0, 50).map((x) => x.id) });
    return { ok: true, count: found.length };
  });

  /* ---------------- pembayaran ---------------- */
  const PAY_SORTS: Record<string, string> = { created: 'p.created_at', amount: 'p.amount_idr', paid: 'p.paid_at', status: 'p.status' };
  function payFilter(q: any) {
    const w = W();
    const st = many(q?.status, ['pending', 'paid', 'failed', 'expired']);
    if (st.length) w.where.push(`p.status = any(${w.p(st)}::text[])`);
    const pk = String(q?.pkg ?? '').split(',').filter(Boolean);
    if (pk.length) w.where.push(`p.package_id = any(${w.p(pk)}::text[])`);
    if (q?.mode === 'live') w.where.push('not p.test');
    if (q?.mode === 'test') w.where.push('p.test');
    dates(w, 'p.created_at', q?.atFrom, q?.atTo);
    const s = String(q?.q ?? '').trim();
    if (s) { const l = w.p(like(s)); w.where.push(`(lower(u.display_name) like ${l} or lower(coalesce(p.invoice,'')) like ${l} or lower(coalesce(p.provider_ref,'')) like ${l} or p.id::text = ${w.p(s)})`); }
    return w;
  }
  const PAY_COLS = `p.id, p.user_id, p.package_id, p.pearls, p.amount_idr, p.provider, p.provider_ref, p.status, p.created_at, p.paid_at, p.expires_at, p.invoice, p.synced_at, p.test, p.revoked_at, u.display_name`;
  app.get('/api/admin/payments', adm, async (req: any) => {
    const w = payFilter(req.query);
    const o = listOpts(req.query, PAY_SORTS, 'created');
    const [rows, total, sum] = await Promise.all([
      db.query(`select ${PAY_COLS} from payments p join users u on u.id = p.user_id ${w.sql()} order by ${o.order}, p.id limit ${o.size} offset ${o.offset}`, w.params),
      db.one<{ c: number; amount: number }>(`select count(*)::int c, coalesce(sum(p.amount_idr) filter (where p.status = 'paid'), 0)::float8 amount from payments p join users u on u.id = p.user_id ${w.sql()}`, w.params),
      db.one<any>(`select coalesce(sum(amount_idr) filter (where status = 'paid' and paid_at >= date_trunc('day', now()) and not test), 0)::float8 paid_today,
                          count(*) filter (where status = 'paid' and paid_at >= date_trunc('day', now()) and not test)::int paid_today_n,
                          count(*) filter (where status = 'pending' and (expires_at is null or expires_at > now()) and created_at > now() - interval '1 day')::int pending,
                          count(*) filter (where status = 'failed' and created_at >= date_trunc('day', now()))::int failed_today,
                          coalesce(sum(amount_idr) filter (where status = 'paid' and paid_at > now() - interval '30 days' and not test), 0)::float8 paid_30
                     from payments`),
    ]);
    const packages = await db.query(`select id, name, pearls from pearl_packages order by sort, id`);
    return { payments: rows, total: total?.c ?? 0, amount: total?.amount ?? 0, summary: sum, packages };
  });
  app.get('/api/admin/export/payments.csv', adm, async (req: any, reply) => {
    const w = payFilter(req.query);
    const rows = await db.query(`select ${PAY_COLS} from payments p join users u on u.id = p.user_id ${w.sql()} order by p.created_at desc limit 50000`, w.params);
    await audit(db, req, 'payment_export', undefined, { rows: rows.length });
    return sendCsv(reply, 'pembayaran', [
      ['id', (r) => r.id], ['dibuat', (r) => r.created_at], ['dibayar', (r) => r.paid_at], ['pemain', (r) => r.display_name], ['pemain_id', (r) => r.user_id],
      ['paket', (r) => r.package_id], ['mutiara', (r) => r.pearls], ['nominal_idr', (r) => r.amount_idr], ['status', (r) => r.status], ['penyedia', (r) => r.provider],
      ['invoice', (r) => r.invoice], ['ref', (r) => r.provider_ref], ['uji', (r) => (r.test ? 'ya' : '')], ['ditarik', (r) => (r.revoked_at ? 'ya' : '')],
    ], rows);
  });

  /* ---------------- log audit ---------------- */
  function auditFilter(q: any) {
    const w = W();
    const admins = String(q?.admin ?? '').split(',').filter(Boolean).slice(0, 20);
    if (admins.length) w.where.push(`admin_email = any(${w.p(admins)}::text[])`);
    const cats = many(q?.cat, AUDIT_CATS.map((c) => c.key));
    if (cats.length) w.where.push(`(${cats.map((k) => `action ~ ${w.p(AUDIT_CATS.find((c) => c.key === k)!.re)}`).join(' or ')})`);
    const s = String(q?.q ?? '').trim();
    if (s) { const l = w.p(like(s)); w.where.push(`(lower(coalesce(target,'')) like ${l} or lower(action) like ${l} or lower(coalesce(detail::text,'')) like ${l})`); }
    dates(w, 'created_at', q?.atFrom, q?.atTo);
    return w;
  }
  app.get('/api/admin/audit', adm, async (req: any) => {
    const w = auditFilter(req.query);
    const o = listOpts(req.query, { at: 'id' }, 'at');
    const [rows, total, admins] = await Promise.all([
      db.query(`select * from admin_audit ${w.sql()} order by ${o.order} limit ${o.size} offset ${o.offset}`, w.params),
      db.one<{ c: number }>(`select count(*)::int c from admin_audit ${w.sql()}`, w.params),
      db.query<{ admin_email: string }>(`select distinct admin_email from admin_audit where admin_email is not null order by 1 limit 50`),
    ]);
    return { audit: rows, total: total?.c ?? 0, admins: admins.map((a) => a.admin_email), page: o.page };
  });
  app.get('/api/admin/export/audit.csv', adm, async (req: any, reply) => {
    const w = auditFilter(req.query);
    const rows = await db.query(`select * from admin_audit ${w.sql()} order by id desc limit 50000`, w.params);
    return sendCsv(reply, 'log-audit', [
      ['waktu', (r) => r.created_at], ['admin', (r) => r.admin_email], ['aksi', (r) => r.action], ['target', (r) => r.target], ['detail', (r) => (r.detail ? JSON.stringify(r.detail) : '')],
    ], rows);
  });

  /* ---------------- moderasi: obrolan & laporan ---------------- */
  app.get('/api/admin/square-chat', mod, async (req: any) => {
    const w = W();
    const s = String(req.query?.q ?? '').trim();
    if (s) { const l = w.p(like(s)); w.where.push(`(lower(c.text) like ${l} or lower(u.display_name) like ${l})`); }
    const inst = Number(req.query?.inst);
    if (Number.isInteger(inst) && inst > 0) w.where.push(`c.inst = ${w.p(inst)}`);
    dates(w, 'c.created_at', req.query?.atFrom, req.query?.atTo);
    return { chats: await db.query(`select c.id, c.inst, c.text, c.created_at, u.id as user_id, u.display_name as user_name, u.chat_muted_until as muted_until, u.banned_at
        from square_chat c join users u on u.id = c.user_id ${w.sql()} order by c.created_at desc limit 300`, w.params) };
  });
  app.get('/api/admin/house-chat', mod, async (req: any) => {
    const w = W();
    const s = String(req.query?.q ?? '').trim();
    if (s) { const l = w.p(like(s)); w.where.push(`(lower(c.text) like ${l} or lower(u.display_name) like ${l} or lower(h.display_name) like ${l})`); }
    dates(w, 'c.created_at', req.query?.atFrom, req.query?.atTo);
    return { chats: await db.query(`select c.id, c.text, c.created_at, u.id as user_id, u.display_name as user_name, h.id as host_id, h.display_name as host_name, u.chat_muted_until as muted_until, u.banned_at
        from house_chat c join users u on u.id = c.user_id join users h on h.id = c.host_id ${w.sql()} order by c.created_at desc limit 300`, w.params) };
  });
  app.get('/api/admin/reports', mod, async (req: any) => {
    const w = W();
    const st = String(req.query?.status ?? (req.query?.all === '1' ? 'all' : 'new'));
    if (st === 'new') w.where.push('r.handled_at is null');
    if (st === 'done') w.where.push('r.handled_at is not null');
    const s = String(req.query?.q ?? '').trim();
    if (s) { const l = w.p(like(s)); w.where.push(`(lower(t.display_name) like ${l} or lower(coalesce(rp.display_name,'')) like ${l} or lower(coalesce(r.reason,'')) like ${l})`); }
    dates(w, 'r.created_at', req.query?.atFrom, req.query?.atTo);
    const [reports, open] = await Promise.all([
      db.query(`select r.id, r.place, r.reason, r.evidence, r.created_at, r.handled_at, r.handled_by,
              t.id as target_id, t.display_name as target_name, t.banned_at, rp.id as reporter_id, rp.display_name as reporter_name,
              t.chat_muted_until as muted_until,
              (select count(distinct x.reporter_id)::int from reports x where x.target_id = r.target_id and x.created_at > now() - interval '7 days') as week
         from reports r join users t on t.id = r.target_id left join users rp on rp.id = r.reporter_id
        ${w.sql()} order by r.created_at desc limit 300`, w.params),
      db.one<{ c: number }>(`select count(*)::int c from reports where handled_at is null`),
    ]);
    return { reports, open: open?.c ?? 0 };
  });
  app.post('/api/admin/reports/handle', mod, async (req: any) => {
    const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).map((x: unknown) => Number(x)).filter((x: number) => Number.isInteger(x) && x > 0))].slice(0, 300);
    if (!ids.length) throw bad('invalid', 'Pilih minimal satu laporan.');
    const r = await db.query(`update reports set handled_at = now(), handled_by = $2 where id = any($1::int[]) and handled_at is null returning id`, [ids, req.admin!.email]);
    await audit(db, req, 'report_handle', `${r.length} laporan`, { ids: r.map((x: any) => x.id) });
    return { ok: true, count: r.length };
  });
}
