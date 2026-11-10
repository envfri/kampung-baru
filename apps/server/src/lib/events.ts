// Event musiman: poin dari aktivitas, hadiah bertingkat, pengulangan tahunan, pengumuman otomatis.
import type { Db } from '../db/index';
import { activeEvents, addItem, bad, credit, getCatalog, notFound, track } from './core';
import type { EventMilestone } from '@kb/shared';

export const seasonOf = (ev: { starts_at: Date | string }) => new Date(ev.starts_at).toISOString().slice(0, 10);

/** Dipanggil dari track: tambah poin event untuk peristiwa yang terdaftar di pengaturan event aktif. */
export async function eventPoints(db: Db, userId: string | null, name: string, props?: Record<string, unknown>) {
  if (!userId) return;
  const cat = await getCatalog(db);
  for (const ev of activeEvents(cat)) {
    const per = Number(ev.points?.[`${name}:${props?.game ?? ''}`] ?? ev.points?.[name] ?? 0);
    if (!(per > 0)) continue;
    const n = Math.max(1, Math.min(100, Number(props?.count ?? 1) || 1));
    await db.query(
      `insert into event_progress (user_id, event_id, season, points) values ($1,$2,$3,$4)
       on conflict (user_id, event_id, season) do update set points = event_progress.points + excluded.points, updated_at = now()`,
      [userId, ev.id, seasonOf(ev), Math.round(per * n)],
    );
  }
}

export async function eventList(db: Db, userId: string) {
  const cat = await getCatalog(db);
  const now = Date.now();
  const list = cat.events.filter((e) => e.active && new Date(e.ends_at).getTime() > now && new Date(e.starts_at).getTime() < now + 14 * 86_400_000);
  const out = [];
  for (const ev of list) {
    const season = seasonOf(ev);
    const p = await db.one<{ points: number; claimed: number[] }>(`select points, claimed from event_progress where user_id = $1 and event_id = $2 and season = $3`, [userId, ev.id, season]);
    const claimed: number[] = p?.claimed ?? [];
    const running = new Date(ev.starts_at).getTime() <= now;
    out.push({
      id: ev.id, name: ev.name, description: ev.description, starts_at: ev.starts_at, ends_at: ev.ends_at, running,
      color: ev.theme?.color ?? '#E0583F', decor: ev.decor ?? '', tokenName: ev.token_name ?? 'Poin event',
      multiplier: Number(ev.bonus?.coinMultiplier ?? 1), points: ev.points ?? {}, myPoints: p?.points ?? 0,
      milestones: ((ev.milestones ?? []) as EventMilestone[]).map((m, i) => ({ ...m, index: i, claimed: claimed.includes(i), ready: running && (p?.points ?? 0) >= m.points && !claimed.includes(i) })),
      items: cat.items.filter((i) => i.event_id === ev.id && i.active).map((i) => i.id),
    });
  }
  return out;
}

export async function claimMilestone(db: Db, userId: string, eventId: string, index: number) {
  const cat = await getCatalog(db);
  const ev = activeEvents(cat).find((e) => e.id === eventId);
  if (!ev) throw notFound('Event tidak sedang berlangsung.');
  const m = (ev.milestones ?? [])[index] as EventMilestone | undefined;
  if (!m) throw notFound('Hadiah tidak ditemukan.');
  const season = seasonOf(ev);
  const row = await db.one(
    `update event_progress set claimed = claimed || $4::text::jsonb, updated_at = now()
      where user_id = $1 and event_id = $2 and season = $3 and points >= $5 and not (claimed @> $4::text::jsonb) returning 1 as ok`,
    [userId, eventId, season, JSON.stringify([index]), m.points],
  );
  if (!row) throw bad('not_ready', 'Poin belum cukup atau hadiah sudah diambil.');
  if (m.coin) await credit(db, userId, 'coin', m.coin, 'event', `${eventId}#${index}`);
  if (m.pearl) await credit(db, userId, 'pearl', m.pearl, 'event', `${eventId}#${index}`);
  if (m.item && cat.byId.get(m.item)) await addItem(db, userId, m.item, Math.max(1, m.qty ?? 1));
  await track(db, userId, 'event_claim', { eventId, index });
  return m;
}

/** Bagian dari worker: event tahunan dijadwalkan ulang, event yang baru mulai diumumkan. */
export async function eventJobs(db: Db) {
  await db.query(
    `update events set starts_at = starts_at + interval '1 year', ends_at = ends_at + interval '1 year'
      where repeat_yearly and active and ends_at < now()`,
  );
  return db.query<{ id: string; name: string; description: string; season: string }>(
    `update events set announced_season = to_char(starts_at, 'YYYY-MM-DD')
      where active and notify_start and starts_at <= now() and ends_at > now()
        and announced_season is distinct from to_char(starts_at, 'YYYY-MM-DD')
      returning id, name, description, announced_season as season`,
  );
}
