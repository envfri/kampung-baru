// Sahabat Mungil (server): keadaan sahabat pemain untuk client, sahabat aktif pemain lain (rumah live, alun-alun,
// kunjungan, kartu profil), keakraban & naik tingkat, jalan-jalan bareng (sekali sehari per jenis), kura-kura dari
// Kolam Pancing, burung pipit di Halaman. Aturan & angka: @kb/shared sahabat.ts + pengaturan admin `sahabat`.
// Rute: routes/sahabat.ts. Semua perubahan dijalankan di dalam transaksi pemanggil.
import {
  PIPIT_SPOTS, SAHABAT_INFO, SAHABAT_LEVELS, isSahabatSp, sahabatLevel, sahabatProgress,
  type SahabatSettings, type SahabatSp, type Settings,
} from '@kb/shared';
import type { Db } from '../db/index';
import { bad, getCatalog, getSettings, today, track, type Catalog } from './core';

export const sahabatOf = (s: Settings) => (s as any).sahabat as SahabatSettings;

/** jam untuk jendela kunang-kunang (bisa diganti saat uji) */
let clock = () => Date.now();
export function setSahabatClock(fn: () => number) { clock = fn; }
export const sahabatClock = () => clock();
/** angka acak untuk kura-kura & oleh-oleh (bisa diganti saat uji) */
let rnd = () => Math.random();
export function setSahabatRandom(fn: () => number) { rnd = fn; }
export const sahabatRandom = () => rnd();

export interface BuddyRow {
  id: string; user_id: string; species: string; name: string; variant: string | null;
  points: number; lvl: number; active: boolean; source: string; created_at: Date;
}

/** kunci penghitung harian (tabel daily_counters, hari WIB) */
export const SB = { makan: (id: string) => `sb_makan:${id}`, main: (id: string) => `sb_main:${id}`, jalan: (k: string) => `sb_jalan:${k}`, oleh: 'sb_oleh' };
export const OUTINGS = ['kunjung', 'alun', 'peta'] as const;
export type Outing = (typeof OUTINGS)[number];

async function countsToday(q: Db, uid: string) {
  const rows = await q.query<{ key: string; count: number }>(`select key, count from daily_counters where user_id = $1 and day = $2 and key like 'sb\\_%'`, [uid, today()]);
  return new Map(rows.map((r) => [r.key, r.count]));
}

export async function buddiesOf(q: Db, uid: string) {
  return q.query<BuddyRow>(`select * from pet_buddies where user_id = $1 order by created_at, species`, [uid]);
}

/** Sahabat untuk client: keakraban, tingkat, jatah makan & main hari ini. */
export function buddyView(b: BuddyRow, k: SahabatSettings, counts?: Map<string, number>) {
  const pr = sahabatProgress(b.points, k);
  const fed = counts?.get(SB.makan(b.id)) ?? 0, plays = counts?.get(SB.main(b.id)) ?? 0;
  return {
    id: b.id, sp: b.species, name: b.name, variant: b.variant, points: b.points, lvl: pr.lvl, level: pr.label, next: pr.next, need: pr.need, pct: Math.round(pr.pct * 100) / 100,
    active: b.active, fedToday: fed > 0, playsLeft: Math.max(0, k.mainPerDay - plays),
  };
}

/** Rumah teman / alun-alun / kartu profil: sahabat aktif seorang pemain (jenis, nama, warna kerang, tingkat). */
export const lookOf = (b: Pick<BuddyRow, 'species' | 'name' | 'variant' | 'points'>, k: SahabatSettings) => ({ sp: b.species, name: b.name, v: b.variant, lvl: sahabatLevel(b.points, k) });
export async function buddyLook(q: Db, uid: string, s?: Settings) {
  const st = s ?? (await getSettings(q));
  const b = await q.one<BuddyRow>(`select species, name, variant, points from pet_buddies where user_id = $1 and active`, [uid]);
  return b && isSahabatSp(b.species) ? lookOf(b, sahabatOf(st)) : null;
}
/** sahabat yang sedang istirahat di rumah (tampil dekat "rumah"-nya: kurungan ayam, sangkar burung, kolam ikan, ...) */
export async function restingLooks(q: Db, uid: string, s: Settings) {
  const k = sahabatOf(s);
  const rows = await q.query<BuddyRow>(`select species, name, variant, points from pet_buddies where user_id = $1 and not active order by created_at`, [uid]);
  return rows.filter((b) => isSahabatSp(b.species)).map((b) => lookOf(b, k));
}

/** Burung pipit siap didekati: belum dimiliki & ada Tempat Minum Burung / Sangkar Burung di ruangan luar (Halaman). */
export async function pipitWaiting(q: Db, uid: string, cat: Catalog) {
  const rows = await q.query<{ room_item: string | null; layout: any[] }>(`select room_item, layout from rooms where user_id = $1`, [uid]);
  return rows.some((r) => cat.byId.get(r.room_item ?? '')?.data?.theme === 'luar' && (r.layout ?? []).some((p: any) => PIPIT_SPOTS.includes(p?.i)));
}

/** Semua yang dibutuhkan client (dipanggil juga dari playerState). */
export async function sahabatState(q: Db, uid: string, s: Settings, cat?: Catalog) {
  const k = sahabatOf(s);
  const [rows, counts] = await Promise.all([buddiesOf(q, uid), countsToday(q, uid)]);
  const list = rows.filter((b) => isSahabatSp(b.species)).map((b) => buddyView(b, k, counts));
  const has = new Set(list.map((b) => b.sp));
  const active = list.find((b) => b.active) ?? null;
  return {
    on: k.on !== false,
    list,
    /** anak ayam menunggu di depan pintu (sahabat pertama, gratis) */
    ayam: k.on !== false && !has.has('ayam'),
    /** burung pipit mampir di Halaman (belum dimiliki) */
    pipit: k.on !== false && !has.has('pipit') && (await pipitWaiting(q, uid, cat ?? (await getCatalog(q)))),
    /** oleh-oleh hari ini (sahabat aktif membawa buntelan) */
    gift: k.on !== false && !!active && !(counts.get(SB.oleh) ?? 0),
    /** jalan-jalan bareng yang sudah dihitung hari ini */
    jalan: Object.fromEntries(OUTINGS.map((o) => [o, (counts.get(SB.jalan(o)) ?? 0) > 0])),
  };
}

/** Sahabat baru untuk pemain (sekali per jenis). Bila belum ada yang aktif, langsung jadi sahabat aktif. */
export async function grantBuddy(t: Db, uid: string, sp: SahabatSp, name: string, source: string, variant: string | null = null) {
  const hasActive = !!(await t.one(`select 1 from pet_buddies where user_id = $1 and active`, [uid]));
  const row = await t.one<BuddyRow>(
    `insert into pet_buddies (user_id, species, name, variant, active, source) values ($1,$2,$3,$4,$5,$6)
     on conflict (user_id, species) do nothing returning *`,
    [uid, sp, name, variant, !hasActive, source],
  );
  if (!row) throw bad('owned', `Kamu sudah punya ${SAHABAT_INFO[sp].name}.`);
  await track(t, uid, 'sahabat_baru', { sp, source });
  return row;
}

/** Tambah keakraban; naik tingkat dicatat sekali (lencana Sahabat Sejati, kabar di client). */
export async function addPoints(t: Db, uid: string, b: BuddyRow, pts: number, k: SahabatSettings) {
  const gain = Math.max(0, Math.round(pts));
  const r = (await t.one<{ points: number }>(`update pet_buddies set points = points + $2 where id = $1 returning points`, [b.id, gain]))!;
  const lvl = sahabatLevel(r.points, k);
  let up: number | null = null;
  if (lvl > b.lvl) {
    const got = await t.one(`update pet_buddies set lvl = $2 where id = $1 and lvl < $2 returning 1 as ok`, [b.id, lvl]);
    if (got) {
      up = lvl;
      for (let l = b.lvl + 1; l <= lvl; l++) await track(t, uid, l === 1 ? 'sahabat_akrab' : 'sahabat_sejati', { sp: b.species });
    }
  }
  Object.assign(b, { points: r.points, lvl: Math.max(b.lvl, lvl) });
  return { gain, points: r.points, lvl, level: SAHABAT_LEVELS[lvl], up };
}

/** penghitung harian dengan batas: true = masih ada jatah (dan sudah dipakai satu) */
export async function takeDaily(t: Db, uid: string, key: string, limit: number) {
  if (limit <= 0) return false;
  const day = today();
  await t.query(`insert into daily_counters (user_id, key, day, count) values ($1, $2, $3, 0) on conflict (user_id, key, day) do nothing`, [uid, key, day]);
  const r = await t.one<{ count: number }>(`select count from daily_counters where user_id = $1 and key = $2 and day = $3 for update`, [uid, key, day]);
  if ((r?.count ?? 0) >= limit) return false;
  await t.query(`update daily_counters set count = count + 1 where user_id = $1 and key = $2 and day = $3`, [uid, key, day]);
  return true;
}

/**
 * Jalan-jalan bareng sahabat aktif (berkunjung ke rumah teman, ke alun-alun, jalan di peta): keakraban sekali sehari
 * per jenis. Tidak pernah melempar galat ke pemanggil (sinkron rumah/alun-alun tetap jalan).
 */
export async function outing(db: Db, uid: string, kind: Outing) {
  try {
    const s = await getSettings(db);
    const k = sahabatOf(s);
    if (k.on === false) return null;
    return await db.tx(async (t) => {
      const b = await t.one<BuddyRow>(`select * from pet_buddies where user_id = $1 and active for update`, [uid]);
      if (!b || !isSahabatSp(b.species)) return null;
      if (!(await takeDaily(t, uid, SB.jalan(kind), 1))) return null;
      const r = await addPoints(t, uid, b, k.points.jalan, k);
      await track(t, uid, 'sahabat_jalan', { sp: b.species, kind });
      return { id: b.id, sp: b.species, name: b.name, kind, ...r };
    });
  } catch { return null; }
}

/** Kolam Pancing: kura-kura kadang ikut tersangkut bersama ikan (sekali seumur akun). Dipanggil di transaksi tangkapan. */
export async function kuraRoll(t: Db, uid: string, s: Settings) {
  const k = sahabatOf(s);
  if (k.on === false || !(k.kuraPct > 0)) return null;
  if (await t.one(`select 1 from pet_buddies where user_id = $1 and species = 'kura'`, [uid])) return null;
  if (rnd() * 100 >= k.kuraPct) return null;
  const b = await t.one<BuddyRow>(
    `insert into pet_buddies (user_id, species, name, active, source)
     values ($1, 'kura', $2, not exists (select 1 from pet_buddies where user_id = $1 and active), 'mancing')
     on conflict (user_id, species) do nothing returning *`, [uid, SAHABAT_INFO.kura.nama[0]]);
  if (!b) return null;
  await track(t, uid, 'sahabat_baru', { sp: 'kura', source: 'mancing' });
  return buddyView(b, k);
}
