// Notifikasi: simpan ke kotak notifikasi di game + kirim Web Push ke semua perangkat pemain.
import type { Db } from '../db/index';
import { vapidConfig } from '../config';
import { deliver, queueNoteEmail, queueNoteEmailMany } from './mail';

let webpush: any = null;
let keys: { publicKey: string; privateKey: string } | null = null;
let agent: unknown = undefined;
/** Hanya untuk pengujian: agent HTTPS khusus (mis. sertifikat lokal). */
export function setPushAgent(a: unknown) { agent = a; }

export type NotifyKind = 'garden' | 'needs' | 'daily' | 'social' | 'events' | 'system';
export const PREF_KINDS: NotifyKind[] = ['garden', 'needs', 'daily', 'social', 'events'];

export interface Note {
  kind: NotifyKind;
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export async function initPush(db: Db) {
  const mod = await import('web-push');
  webpush = mod.default ?? mod;
  if (vapidConfig.publicKey && vapidConfig.privateKey) {
    keys = { publicKey: vapidConfig.publicKey, privateKey: vapidConfig.privateKey };
  } else {
    const row = await db.one<{ value: any }>(`select value from settings where key = 'vapid'`);
    if (row?.value?.publicKey) keys = row.value;
    else {
      keys = webpush.generateVAPIDKeys();
      await db.query(`insert into settings (key, value) values ('vapid', $1::text::jsonb) on conflict (key) do nothing`, [JSON.stringify(keys)]);
      const again = await db.one<{ value: any }>(`select value from settings where key = 'vapid'`);
      keys = again!.value;
    }
  }
  webpush.setVapidDetails(vapidConfig.subject, keys!.publicKey, keys!.privateKey);
}

export const vapidPublicKey = () => keys?.publicKey ?? '';

/** Kirim push ke daftar langganan; langganan yang sudah mati dihapus. */
async function pushTo(db: Db, subs: { id: number; endpoint: string; p256dh: string; auth: string }[], payload: string, log?: any) {
  if (!webpush || !keys) return 0;
  let ok = 0;
  const queue = [...subs];
  const worker = async () => {
    for (let s = queue.shift(); s; s = queue.shift()) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24, urgency: 'normal', timeout: 10_000, ...(agent ? { agent } : {}) });
        ok++;
        await db.query(`update push_subscriptions set last_ok_at = now(), fail_count = 0 where id = $1`, [s.id]);
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) await db.query(`delete from push_subscriptions where id = $1`, [s.id]);
        else {
          await db.query(`update push_subscriptions set fail_count = fail_count + 1 where id = $1`, [s.id]);
          await db.query(`delete from push_subscriptions where id = $1 and fail_count >= 5`, [s.id]);
          log?.warn?.({ status: e?.statusCode, msg: e?.message }, 'push gagal');
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(16, queue.length) }, worker));
  return ok;
}

export function prefsAllow(prefs: Record<string, boolean> | null | undefined, kind: NotifyKind) {
  if (kind === 'system') return true;
  return prefs?.[kind] !== false;
}

/** Notifikasi untuk satu pemain. Aman dipanggil tanpa await (kesalahan hanya dicatat). */
export async function notify(db: Db, userId: string, n: Note, log?: any) {
  try {
    const u = await db.one<{ notify_prefs: any }>(`select notify_prefs from users where id = $1 and banned_at is null`, [userId]);
    if (!u) return;
    await db.query(`insert into notifications (user_id, kind, title, body, url) values ($1,$2,$3,$4,$5)`, [userId, n.kind, n.title, n.body, n.url ?? '/']);
    await db.query(`delete from notifications where user_id = $1 and id < (select coalesce(min(id), 0) from (select id from notifications where user_id = $1 order by id desc limit 100) x)`, [userId]);
    if (!prefsAllow(u.notify_prefs, n.kind)) return;
    const subs = await db.query(`select id, endpoint, p256dh, auth from push_subscriptions where user_id = $1`, [userId]);
    if (subs.length) await pushTo(db, subs, JSON.stringify({ title: n.title, body: n.body, url: n.url ?? '/', tag: n.tag ?? n.kind }), log);
    // salinan ke email (Mailketing) sesuai pengaturan admin & preferensi pemain; langsung dicoba kirim
    const mailId = await queueNoteEmail(db, userId, n, u.notify_prefs);
    if (mailId) void deliver(db, { ids: [mailId], log }).catch((e) => log?.warn?.({ err: String(e) }, 'email notifikasi tertunda'));
  } catch (e) {
    log?.error?.(e, 'notify gagal');
  }
}

/**
 * Kirim ke banyak pemain sekaligus (broadcast). `email: true` juga mengantrekan email (dikirim worker).
 * Mengembalikan jumlah pemain, push yang berhasil, dan email yang diantrekan.
 */
export async function notifyMany(db: Db, userIds: string[], n: Note, log?: any, opts: { email?: boolean } = {}) {
  let pushed = 0;
  for (let i = 0; i < userIds.length; i += 500) {
    const chunk = userIds.slice(i, i + 500);
    await db.query(
      `insert into notifications (user_id, kind, title, body, url) select u, $2, $3, $4, $5 from unnest($1::uuid[]) as u`,
      [chunk, n.kind, n.title, n.body, n.url ?? '/'],
    );
    const subs = await db.query(
      `select s.id, s.endpoint, s.p256dh, s.auth from push_subscriptions s join users u on u.id = s.user_id
        where s.user_id = any($1::uuid[]) and coalesce((u.notify_prefs->>$2)::boolean, true)`,
      [chunk, n.kind],
    );
    pushed += await pushTo(db, subs, JSON.stringify({ title: n.title, body: n.body, url: n.url ?? '/', tag: n.tag ?? 'broadcast' }), log);
  }
  const emailed = opts.email ? await queueNoteEmailMany(db, userIds, n).catch((e) => { log?.warn?.({ err: String(e) }, 'antrean email gagal'); return 0; }) : 0;
  return { recipients: userIds.length, pushed, emailed };
}
