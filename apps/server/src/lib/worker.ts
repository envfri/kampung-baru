// Pekerjaan latar: notifikasi otomatis & broadcast terjadwal.
// Memakai advisory lock Postgres agar hanya satu instance server yang menjalankannya.
import type { Db } from '../db/index';
import { getCatalog, getSettings, today } from './core';
import { eventOn, notifyEvent, notifyMany, type Vars } from './notify';
import { eventJobs } from './events';
import { paymentJobs } from './payments';
import { zepayConfigured } from './zepay';
import { mailEnabled } from './mail';
import { waEnabled } from './klikflow';
import { drainOutbox } from './outbox';
import { getTemplate } from './notify-config';
import { settlePet, isAsleep, type PetRow } from './state';

const LOCK = 7_420_011;

export async function runJobs(db: Db, log?: any) {
  const s = await getSettings(db);
  const cat = await getCatalog(db);
  const outbox: { userId: string; key: string; vars: Vars; url?: string }[] = [];
  const on = { garden: await eventOn(db, 'garden_ready'), daily: await eventOn(db, 'daily_reminder'),
    needs: (await Promise.all(['needs_kenyang', 'needs_bersih', 'needs_ceria', 'needs_energi'].map((k) => eventOn(db, k)))).some(Boolean) };
  let broadcasts: any[] = [];

  let locked = false;
  await db.tx(async (t) => {
    const lock = await t.one<{ ok: boolean }>(`select pg_try_advisory_xact_lock($1) as ok`, [LOCK]);
    if (!lock?.ok) return;
    locked = true;

    // 1) kebun siap panen
    if (on.garden) {
      const ready = await t.query<{ user_id: string; seed_id: string }>(
        `update garden_plots set notified_at = now() where ready_at <= now() and notified_at is null returning user_id, seed_id`,
      );
      const byUser = new Map<string, string[]>();
      for (const r of ready) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.seed_id]);
      for (const [userId, seeds] of byUser) {
        const yieldName = cat.byId.get(cat.byId.get(seeds[0])?.data?.yieldItem)?.name ?? 'Tanaman';
        outbox.push({ userId, key: 'garden_ready', vars: { tanaman: seeds.length > 1 ? `${seeds.length} petak tanaman` : yieldName, jumlah: seeds.length } });
      }
    }

    // 2) pet butuh perhatian (hanya pemain yang sedang tidak membuka game)
    if (on.needs) {
      const r = s.needs.decayPerHour;
      const rows = await t.query<{ user_id: string; name: string; kenyang: number; bersih: number; ceria: number; energi: number }>(
        `with c as (
           select p.user_id, p.name,
             greatest(0, p.kenyang - $1::float8 * extract(epoch from now() - p.needs_at) / 3600) as kenyang,
             greatest(0, p.bersih  - $2::float8 * extract(epoch from now() - p.needs_at) / 3600) as bersih,
             greatest(0, p.ceria   - $3::float8 * extract(epoch from now() - p.needs_at) / 3600) as ceria,
             greatest(0, p.energi  - $4::float8 * extract(epoch from now() - p.needs_at) / 3600) as energi
           from pets p join users u on u.id = p.user_id
           where u.banned_at is null and u.last_seen_at < now() - interval '30 minutes' and u.last_seen_at > now() - interval '14 days'
             and p.sleep_from is null
             and (p.needs_notified_at is null or p.needs_notified_at < now() - ($5::int * interval '1 hour'))
         )
         select * from c where least(kenyang, bersih, ceria, energi) < $6 limit 500`,
        [r.kenyang ?? 0, r.bersih ?? 0, r.ceria ?? 0, r.energi ?? 0, s.notify.needsEveryHours, s.notify.needsThreshold],
      );
      for (const p of rows) {
        const [k] = (['kenyang', 'bersih', 'ceria', 'energi'] as const).map((k) => [k, p[k]] as const).sort((a, b) => a[1] - b[1])[0];
        await t.query(`update pets set needs_notified_at = now() where user_id = $1`, [p.user_id]);
        outbox.push({ userId: p.user_id, key: `needs_${k}`, vars: {} });
      }
    }

    // 2b) pet bangun sendiri (energi penuh) & pet mulai sakit karena lama dibiarkan
    const lifeRows = await t.query<PetRow & { offline: boolean }>(
      `select p.*, (u.last_seen_at < now() - interval '5 minutes') as offline from pets p join users u on u.id = p.user_id
        where u.banned_at is null and u.last_seen_at > now() - interval '14 days'
          and (p.sleep_from is not null or p.sick_at is null)
        order by p.needs_at limit 1500`,
    );
    for (const p of lifeRows) {
      const wasAsleep = !!p.sleep_from, wasSick = !!p.sick_at;
      if (wasAsleep && isAsleep(p, s)) continue;
      await settlePet(t, p, s);
      if (wasAsleep && !p.sleep_from && p.offline) outbox.push({ userId: p.user_id, key: 'pet_woke', vars: {} });
      if (!wasSick && p.sick_at) outbox.push({ userId: p.user_id, key: 'pet_sick', vars: {} });
    }

    // 3) pengingat hadiah harian (sekali sehari setelah jam tertentu WIB)
    const hourWib = (new Date().getUTCHours() + 7) % 24;
    if (on.daily && hourWib >= s.notify.dailyHourWib) {
      const dailyTpl = await getTemplate(db, 'daily_reminder');
      const rows = await t.query<{ id: string }>(
        `insert into daily_counters (user_id, key, day, count)
         select u.id, 'notif_daily', $1::date, 1 from users u
          where u.banned_at is null and u.last_seen_at > now() - interval '14 days'
            and (exists (select 1 from push_subscriptions s where s.user_id = u.id)
                 or ($2::boolean and u.wa_verified_at is not null)
                 or ($3::boolean and exists (select 1 from auth_identities ai where ai.user_id = u.id and ai.email is not null)))
            and not exists (select 1 from daily_claims d where d.user_id = u.id and d.day = $1::date)
            and not exists (select 1 from daily_counters c where c.user_id = u.id and c.key = 'notif_daily' and c.day = $1::date)
          limit 2000
         on conflict do nothing
         returning user_id as id`,
        [today(), !!dailyTpl?.channels.whatsapp, !!dailyTpl?.channels.email],
      );
      for (const r of rows) outbox.push({ userId: r.id, key: 'daily_reminder', vars: {} });
    }

    // 4) broadcast terjadwal dari admin
    broadcasts = await t.query(`update broadcasts set status = 'sending' where status = 'scheduled' and send_at <= now() returning *`);
  });

  for (const o of outbox) await notifyEvent(db, o.userId, o.key, o.vars, { log });

  // QRIS yang lewat batas waktu tanpa kabar webhook: cek status langsung ke ZePay
  if (locked && zepayConfigured()) {
    try { await paymentJobs(db, log); } catch (e) { log?.warn?.({ err: String(e) }, 'zepay: pekerjaan latar gagal'); }
  }

  // event musiman: jadwal ulang tahunan & umumkan event yang baru mulai
  const started = await eventJobs(db);
  for (const ev of started) {
    const ids = (await db.query<{ id: string }>(`select id from users where banned_at is null and last_seen_at > now() - interval '30 days'`)).map((r) => r.id);
    const r = await notifyMany(db, ids, 'event_start', { event: ev.name, deskripsi: ev.description || 'Ada event baru di Kampung Bupi. Kumpulkan poin dan ambil hadiahnya.' }, { url: '/#event', tag: 'event-' + ev.id, log });
    log?.info?.({ event: ev.id, ...r }, 'pengumuman event terkirim');
  }

  for (const b of broadcasts) {
    const where: Record<string, string> = {
      all: 'true',
      active7: `u.last_seen_at > now() - interval '7 days'`,
      inactive7: `u.last_seen_at <= now() - interval '7 days'`,
      payers: `exists (select 1 from payments p where p.user_id = u.id and p.status = 'paid')`,
      guests: 'u.is_guest',
    };
    const ids = (await db.query<{ id: string }>(`select u.id from users u where u.banned_at is null and ${where[b.segment] ?? 'true'}`)).map((r) => r.id);
    const r = await notifyMany(db, ids, 'broadcast', { judul: b.title, isi: b.body }, { url: b.url, tag: 'broadcast-' + b.id, log, email: !!b.email, whatsapp: !!b.whatsapp });
    await db.query(
      `update broadcasts set status = 'sent', sent_at = now(), recipients = $2, pushed = $3, emailed = $4, whatsapped = $5 where id = $1`,
      [b.id, r.recipients, r.pushed, b.email ? r.emailed : null, b.whatsapp ? r.whatsapped : null],
    );
    log?.info?.({ id: b.id, ...r }, 'broadcast terkirim');
  }
  await db.query(`delete from webhook_events where created_at < now() - interval '30 days'`).catch(() => {});
  // sekali sejam: obrolan rumah disimpan 60 hari (untuk moderasi), buku tamu 180 hari
  if (new Date().getMinutes() === 7) {
    await db.query(`delete from house_chat where created_at < now() - interval '60 days'`).catch(() => {});
    await db.query(`delete from square_chat where created_at < now() - interval '60 days'`).catch(() => {});
    await db.query(`delete from friend_requests where created_at < now() - interval '60 days'`).catch(() => {});
    await db.query(`delete from visit_acts where created_at < now() - interval '180 days'`).catch(() => {});
  }

  // antrean email & WhatsApp (broadcast, event, jam tenang, percobaan ulang)
  if (mailEnabled() || waEnabled()) {
    try { await drainOutbox(db, log); } catch (e) { log?.warn?.({ err: String(e) }, 'pengiriman pesan gagal'); }
  }
  return { sent: outbox.length, broadcasts: broadcasts.length };
}

export function startWorker(db: Db, log: any, everyMs = 60_000) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await runJobs(db, log); } catch (e) { log.error(e, 'worker gagal'); } finally { running = false; }
  };
  const t = setInterval(tick, everyMs);
  setTimeout(tick, 5_000);
  return () => clearInterval(t);
}
