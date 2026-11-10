// Pengiriman notifikasi. Setiap jenis notifikasi punya template di Pusat notifikasi (admin):
// nyala/mati, saluran (kotak masuk, push, email, WhatsApp), dan teks dengan {variabel}.
import { NOTIFY_EVENT_BY_KEY, renderText, type NotifyEventDef, type NotifyTemplate } from '@kb/shared';
import { config } from '../config';
import type { Db } from '../db/index';
import { getChannels, getTemplate } from './notify-config';
import { prefsAllow, pushItems } from './push';
import { mailEnabled, noteEmail } from './mail';
import { waEnabled, waPayload } from './klikflow';
import { capReached, deliver, enqueue, quietUntil } from './outbox';

export type Vars = Record<string, string | number | null | undefined>;

interface Recipient {
  id: string;
  display_name: string;
  notify_prefs: Record<string, any> | null;
  pet: string | null;
  email: string | null;
  email_blocked: boolean;
  wa_phone: string | null;
}

async function recipients(db: Db, ids: string[]) {
  return db.query<Recipient>(
    `select r.*, coalesce(exists (select 1 from email_suppressions x where x.email = r.email), false) as email_blocked from (
       select u.id, u.display_name, u.notify_prefs, p.name as pet,
              case when u.wa_verified_at is not null then u.wa_phone end as wa_phone,
              (select lower(ai.email) from auth_identities ai where ai.user_id = u.id and ai.email is not null
                order by case ai.provider when 'email' then 0 when 'google' then 1 else 2 end, ai.created_at limit 1) as email
         from users u left join pets p on p.user_id = u.id
        where u.id = any($1::uuid[]) and u.banned_at is null
     ) r`,
    [ids],
  );
}

export function varsFor(r: { display_name: string; pet: string | null }, url: string, vars: Vars): Vars {
  return { nama: r.display_name, pet: r.pet ?? 'pet-mu', link: config.publicUrl + (url.startsWith('/') ? url : '/'), ...vars };
}

interface DispatchOpts { url?: string; tag?: string; log?: any; email?: boolean; whatsapp?: boolean; single?: boolean }
export interface DispatchResult { recipients: number; inbox: number; pushed: number; emailed: number; whatsapped: number; waError?: string }

async function dispatch(db: Db, def: NotifyEventDef, tpl: NotifyTemplate, list: Recipient[], vars: Vars, o: DispatchOpts): Promise<DispatchResult> {
  const url = o.url ?? def.url;
  const out: DispatchResult = { recipients: list.length, inbox: 0, pushed: 0, emailed: 0, whatsapped: 0 };
  if (!list.length) return out;
  const items = list.map((r) => {
    const v = varsFor(r, url, vars);
    return { r, v, title: renderText(tpl.title, v) || def.label, body: renderText(tpl.body, v) };
  });

  // kotak notifikasi di game (tetap tersimpan walau pemain mematikan kategori ini)
  if (tpl.channels.inbox) {
    const ids = items.map((x) => x.r.id);
    await db.query(
      `insert into notifications (user_id, kind, title, body, url) select * from unnest($1::uuid[], $2::text[], $3::text[], $4::text[], $5::text[])`,
      [ids, items.map(() => def.kind), items.map((x) => x.title), items.map((x) => x.body), items.map(() => url)],
    );
    await db.query(
      `delete from notifications n using (
         select id from (select id, row_number() over (partition by user_id order by id desc) rn from notifications where user_id = any($1::uuid[])) z where rn > 100
       ) d where n.id = d.id`,
      [ids],
    );
    out.inbox = items.length;
  }

  const allowed = items.filter((x) => prefsAllow(x.r.notify_prefs as any, def.kind));
  if (!allowed.length) return out;

  if (tpl.channels.push) {
    const byUser = new Map(allowed.map((x) => [x.r.id, x]));
    const subs = await db.query<{ id: number; user_id: string; endpoint: string; p256dh: string; auth: string }>(
      `select id, user_id, endpoint, p256dh, auth from push_subscriptions where user_id = any($1::uuid[])`,
      [[...byUser.keys()]],
    );
    out.pushed = await pushItems(
      db,
      subs.map((s) => {
        const x = byUser.get(s.user_id)!;
        return { sub: s, payload: JSON.stringify({ title: x.title, body: x.body, url, tag: o.tag ?? def.key }) };
      }),
      o.log,
    );
  }

  const ch = await getChannels(db);
  const now: number[] = [];

  if ((o.email ?? tpl.channels.email) && def.allowed.includes('email') && ch.email.enabled && mailEnabled()) {
    for (const x of allowed) {
      if (!x.r.email || x.r.email_blocked || x.r.notify_prefs?.email === false) continue;
      if (o.single && !def.critical && (await capReached(db, x.r.id, 'email', ch.email.maxPerDay))) continue;
      const m = noteEmail(x.title, x.body, url);
      now.push(await enqueue(db, { channel: 'email', userId: x.r.id, to: x.r.email, kind: def.key, subject: m.subject, body: m.html }));
      out.emailed++;
    }
  }

  if ((o.whatsapp ?? tpl.channels.whatsapp) && def.allowed.includes('whatsapp') && ch.whatsapp.enabled && waEnabled()) {
    const later = def.critical ? null : quietUntil(ch.whatsapp.quietStart, ch.whatsapp.quietEnd);
    for (const x of allowed) {
      if (!x.r.wa_phone || x.r.notify_prefs?.whatsapp === false) continue;
      if (o.single && !def.critical && (await capReached(db, x.r.id, 'whatsapp', ch.whatsapp.maxPerDay))) continue;
      const p = waPayload(ch.whatsapp, x.r.wa_phone, tpl, x.v);
      if ('error' in p) {
        out.waError = p.error;
        if (o.single) {
          await db.query(
            `insert into outbox (channel, user_id, to_addr, kind, subject, status, error) values ('whatsapp',$1,$2,$3,$4,'failed',$5)`,
            [x.r.id, x.r.wa_phone, def.key, x.title, p.error],
          );
        }
        continue;
      }
      const id = await enqueue(db, { channel: 'whatsapp', userId: x.r.id, to: x.r.wa_phone, kind: def.key, subject: x.title, body: JSON.stringify(p.payload), nextAt: later });
      if (!later) now.push(id);
      out.whatsapped++;
    }
    if (out.waError) o.log?.warn?.({ key: def.key, err: out.waError }, 'notifikasi WhatsApp tidak bisa dibuat');
  }

  // satu pemain: langsung kirim; broadcast/event dikirim worker bertahap
  if (o.single && now.length) void deliver(db, { ids: now, log: o.log }).catch((e) => o.log?.warn?.({ err: String(e) }, 'pengiriman tertunda'));
  return out;
}

/** Notifikasi untuk satu pemain. Aman dipanggil tanpa await (kesalahan hanya dicatat). */
export async function notifyEvent(db: Db, userId: string, key: string, vars: Vars = {}, o: Omit<DispatchOpts, 'single'> = {}) {
  try {
    const def = NOTIFY_EVENT_BY_KEY[key];
    if (!def) throw new Error(`jenis notifikasi tidak dikenal: ${key}`);
    const tpl = (await getTemplate(db, key))!;
    if (!tpl.enabled) return null;
    const list = await recipients(db, [userId]);
    return await dispatch(db, def, tpl, list, vars, { ...o, single: true });
  } catch (e) {
    o.log?.error?.(e, 'notifikasi gagal');
    return null;
  }
}

/** Notifikasi ke banyak pemain (broadcast, event). Email/WhatsApp diantrekan dan dikirim worker. */
export async function notifyMany(db: Db, userIds: string[], key: string, vars: Vars = {}, o: Omit<DispatchOpts, 'single'> = {}) {
  const total: DispatchResult = { recipients: 0, inbox: 0, pushed: 0, emailed: 0, whatsapped: 0 };
  const def = NOTIFY_EVENT_BY_KEY[key];
  const tpl = def ? await getTemplate(db, key) : null;
  if (!def || !tpl?.enabled) return total;
  for (let i = 0; i < userIds.length; i += 500) {
    const r = await dispatch(db, def, tpl, await recipients(db, userIds.slice(i, i + 500)), vars, o);
    total.recipients += r.recipients; total.inbox += r.inbox; total.pushed += r.pushed; total.emailed += r.emailed; total.whatsapped += r.whatsapped;
    if (r.waError) total.waError = r.waError;
  }
  return total;
}

/** Apakah jenis notifikasi ini menyala (untuk melewati perhitungan mahal di worker). */
export async function eventOn(db: Db, key: string) {
  return !!(await getTemplate(db, key))?.enabled;
}
