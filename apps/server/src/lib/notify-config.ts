// Template & saluran notifikasi yang diatur admin (Pusat notifikasi), dengan cache singkat.
import {
  NOTIFY_EVENTS, NOTIFY_EVENT_BY_KEY, resolveChannels, resolveTemplate,
  type NotifyChannelsConfig, type NotifyTemplate,
} from '@kb/shared';
import type { Db } from '../db/index';

let cache: { at: number; over: Map<string, any>; channels: NotifyChannelsConfig } | null = null;
export const invalidateNotify = () => { cache = null; };

async function load(db: Db) {
  if (cache && Date.now() - cache.at < 10_000) return cache;
  const [rows, ch] = await Promise.all([
    db.query<{ key: string; value: any }>(`select key, value from notify_templates`),
    db.one<{ value: any }>(`select value from settings where key = 'notify_channels'`),
  ]);
  cache = { at: Date.now(), over: new Map(rows.map((r) => [r.key, r.value])), channels: resolveChannels(ch?.value) };
  return cache;
}

export async function getTemplate(db: Db, key: string): Promise<NotifyTemplate | null> {
  const def = NOTIFY_EVENT_BY_KEY[key];
  if (!def) return null;
  return resolveTemplate(def, (await load(db)).over.get(key));
}

export async function getAllTemplates(db: Db) {
  const c = await load(db);
  return {
    templates: Object.fromEntries(NOTIFY_EVENTS.map((d) => [d.key, resolveTemplate(d, c.over.get(d.key))])),
    overrides: Object.fromEntries(c.over),
  };
}

export async function getChannels(db: Db) {
  return (await load(db)).channels;
}

/** Jenis notifikasi penting (tidak dihitung batas harian, tidak ditunda jam tenang). */
export const CRITICAL_KEYS = [...NOTIFY_EVENTS.filter((e) => e.critical).map((e) => e.key), 'otp', 'test'];

/**
 * Sekali jalan: saklar notifikasi lama di Ekonomi & fitur (notify.gardenReady, …) dan bagian `email`
 * dipindah ke Pusat notifikasi, lalu dihapus dari pengaturan game.
 */
export async function migrateNotifySettings(db: Db) {
  const row = await db.one<{ value: any }>(`select value from settings where key = 'game'`);
  const v = row?.value;
  if (!v || typeof v !== 'object') return;
  const n = v.notify ?? {};
  const e = v.email;
  const old = ['gardenReady', 'needsLow', 'dailyReminder', 'socialVisits', 'giftsAndFriends'];
  if (!old.some((k) => k in n) && e === undefined) return;
  const patch = new Map<string, any>();
  const set = (key: string, val: any) => patch.set(key, { ...(patch.get(key) ?? {}), ...val });
  if (n.gardenReady === false) set('garden_ready', { enabled: false });
  if (n.needsLow === false) for (const k of ['needs_kenyang', 'needs_bersih', 'needs_ceria', 'needs_energi']) set(k, { enabled: false });
  if (n.dailyReminder === false) set('daily_reminder', { enabled: false });
  if (n.socialVisits === false) set('visit', { enabled: false });
  if (n.giftsAndFriends === false) { set('friend_added', { enabled: false }); set('gift', { enabled: false }); }
  if (e && typeof e === 'object') {
    for (const d of NOTIFY_EVENTS) {
      if (typeof e[d.kind] === 'boolean' && d.allowed.includes('email') && e[d.kind] !== d.defaults.channels.email) {
        set(d.key, { channels: { ...(patch.get(d.key)?.channels ?? {}), email: e[d.kind] } });
      }
    }
    const ch = { email: { ...(typeof e.enabled === 'boolean' ? { enabled: e.enabled } : {}), ...(Number.isFinite(e.maxPerDay) ? { maxPerDay: e.maxPerDay } : {}) } };
    await db.query(
      `insert into settings (key, value) values ('notify_channels', $1::text::jsonb) on conflict (key) do update set value = settings.value || excluded.value`,
      [JSON.stringify(ch)],
    );
  }
  await db.tx(async (t) => {
    for (const [key, val] of patch) {
      await t.query(
        `insert into notify_templates (key, value, updated_by) values ($1, $2::text::jsonb, 'migrasi') on conflict (key) do update set value = notify_templates.value || excluded.value`,
        [key, JSON.stringify(val)],
      );
    }
    for (const k of old) delete n[k];
    delete v.email;
    await t.query(`update settings set value = $1::text::jsonb where key = 'game'`, [JSON.stringify(v)]);
  });
  invalidateNotify();
}
