// Aktivitas di rumah: pet memakai mebel (tidur di kasur, duduk di sofa, menyiram tanaman, ...)
// atau melihat jendela/lukisan di dinding. Daftar aktivitasnya diatur dari admin (menu Aktivitas),
// jadi aktivitas baru bisa ditambah tanpa deploy. Di sini hanya jenis animasi & aturan pencocokan.
import type { ItemLike } from './art';

/** on = pet naik ke atas mebel (kasur, sofa, bak); selain itu pet berdiri di sebelahnya. */
export const ACTIVITY_ANIMS: Record<string, { label: string; on: boolean; lift: number; fx: string; prop?: string; ms: number }> = {
  tidur: { label: 'Tidur / rebahan (naik ke mebel)', on: true, lift: 22, fx: 'zz', ms: 3200 },
  duduk: { label: 'Duduk santai (naik ke mebel)', on: true, lift: 14, fx: 'hearts', ms: 2400 },
  mandi: { label: 'Berendam (naik ke mebel)', on: true, lift: 6, fx: 'bubbles', ms: 2800 },
  lihat: { label: 'Melihat / menikmati (di dekatnya)', on: false, lift: 0, fx: 'sparkle', ms: 2200 },
  siram: { label: 'Menyiram (di dekatnya)', on: false, lift: 0, fx: 'drops', prop: 'siram', ms: 2400 },
  baca: { label: 'Membaca (di dekatnya)', on: false, lift: 0, fx: 'notes', prop: 'baca', ms: 2600 },
  masak: { label: 'Memasak (di dekatnya)', on: false, lift: 0, fx: 'steam', prop: 'masak', ms: 2800 },
  main: { label: 'Bermain (di dekatnya)', on: false, lift: 0, fx: 'coins', prop: 'main', ms: 2400 },
};

/** Bagian ruangan bawaan yang bisa dipakai aktivitas (hanya di ruangan dalam rumah). */
export const ACTIVITY_SPOTS: Record<string, string> = { jendela: 'Jendela', lukisan: 'Lukisan dinding' };

export interface ActivityLike {
  id: string;
  name: string;
  description?: string;
  /** 'art:<bentuk mebel>' | 'item:<id item>' | 'spot:jendela' | 'spot:lukisan' */
  targets: string[];
  anim: string;
  effects: Record<string, number>;
  xp: number;
  coins: number;
  reward_item?: string | null;
  cooldown_sec: number;
  daily_limit: number;
  min_level: number;
  message?: string;
}

export function activityFits(targets: string[] | undefined, item?: ItemLike | null, spot?: string) {
  const t = targets ?? [];
  if (spot) return t.includes('spot:' + spot);
  if (!item || item.kind !== 'furniture') return false;
  return t.includes('item:' + item.id) || (item.art?.type === 'builtin' && t.includes('art:' + item.art.key));
}

export function activityMessage(a: Pick<ActivityLike, 'message' | 'name'>, pet: string, target: string) {
  const tpl = a.message?.trim() || `{pet} selesai: ${a.name}.`;
  return tpl.replace(/\{pet\}/g, pet).replace(/\{item\}/g, target);
}
