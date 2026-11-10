// Web Push (VAPID) ke semua perangkat pemain. Penentuan isi & saluran ada di lib/notify.ts.
import type { Db } from '../db/index';
import { vapidConfig } from '../config';

let webpush: any = null;
let keys: { publicKey: string; privateKey: string } | null = null;
let agent: unknown = undefined;
/** Hanya untuk pengujian: agent HTTPS khusus (mis. sertifikat lokal). */
export function setPushAgent(a: unknown) { agent = a; }

export type NotifyKind = 'garden' | 'needs' | 'daily' | 'social' | 'events' | 'system';
export const PREF_KINDS: NotifyKind[] = ['garden', 'needs', 'daily', 'social', 'events'];


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

type Sub = { id: number; endpoint: string; p256dh: string; auth: string };

/** Kirim push ke daftar langganan; langganan yang sudah mati dihapus. */
export async function pushTo(db: Db, subs: Sub[], payload: string, log?: any) {
  return pushItems(db, subs.map((sub) => ({ sub, payload })), log);
}

/** Kirim push dengan isi berbeda per langganan (notifikasi yang dipersonalisasi). */
export async function pushItems(db: Db, items: { sub: Sub; payload: string }[], log?: any) {
  if (!webpush || !keys) return 0;
  let ok = 0;
  const queue = [...items];
  const worker = async () => {
    for (let it = queue.shift(); it; it = queue.shift()) {
      const s = it.sub;
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, it.payload, { TTL: 60 * 60 * 24, urgency: 'normal', timeout: 10_000, ...(agent ? { agent } : {}) });
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
