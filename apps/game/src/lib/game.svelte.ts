// State global game (Svelte 5 runes). Semua angka penting berasal dari server;
// client hanya menghitung ulang tampilan kebutuhan pet di antara respons.
import { decayNeeds, needsWithSleep, petLookState, type ItemLike, type Needs } from '@kb/shared';
import { api, ApiError, rid } from './api';
import { sfx } from './sfx';

export type View = 'home' | 'map' | 'garden' | 'karung' | 'fishing' | 'visit' | 'panen' | 'memori' | 'shop' | 'bakiak' | 'gasing' | 'layangan' | 'pinang' | 'duel';
export type Sheet = null | 'rooms' | 'duels' | 'bag' | 'friends' | 'pearls' | 'settings' | 'daily' | 'news' | 'collection' | 'feed' | 'seed' | 'gift' | 'notifs' | 'quests' | 'wardrobe' | 'games' | 'event' | 'whatsnew';

export interface CatalogItem extends ItemLike {
  description: string;
  price_coin: number;
  price_pearl: number;
  sell_coin: number;
  shop: string | null;
  event_id: string | null;
  available_from: string | null;
  available_to: string | null;
}

export const G = $state({
  booted: false,
  config: null as any,
  catalog: null as null | { version: string; items: CatalogItem[]; locations: any[]; events: any[]; packages: any[]; activities?: any[]; settings: any },
  me: null as any,
  view: 'home' as View,
  sheet: null as Sheet,
  sheetArg: null as any,
  shopId: 'pasar',
  shopTab: 'buy' as 'buy' | 'sell',
  bagTab: 'food',
  /** ruangan rumah yang sedang dilihat (id) & ruangan teman saat berkunjung (indeks) */
  roomId: '' as string,
  visitRoom: 0,
  /** posisi pet di peta kampung (id lokasi) dan tujuan jalan berikutnya */
  mapAt: 'rumah',
  mapGoal: null as null | string,
  visit: null as any,
  edit: false,
  sel: -1,
  draft: null as null | { i: string; x: number; y: number }[],
  toast: { text: '', kind: 'info' as 'info' | 'error' | 'good', n: 0 },
  now: Date.now(),
  offset: 0,
  busy: false,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  update: false,
  immersive: false,
  cool: {} as Record<string, number>,
  portrait: typeof window === 'undefined' ? true : window.innerHeight >= window.innerWidth,
  fx: 0,
  fxKind: 'hearts' as 'hearts' | 'bubbles' | 'coins' | 'zz' | 'food' | 'sparkle' | 'drops' | 'notes' | 'steam',
  /** versi terakhir yang dilihat pemain bila ada pembaruan yang belum dibuka */
  whatsNew: null as string | null,
  /** rawat dengan sentuhan: nampan makanan, mode mandi (gosok sabun → bilas) */
  feeding: false,
  feedDrag: null as null | { x: number; y: number; id: string },
  chewing: 0,
  bath: null as null | { scrub: number; tool: 'sabun' | 'gayung'; rinsing: boolean },
  /** celetukan pet yang sedang tampil */
  speech: null as null | { text: string; n: number },
  /** duel yang sedang dibuka (ruang tunggu / sedang dimainkan) */
  duel: null as null | { id: string; game: string; them: any; autostart?: boolean; live?: boolean },
});

let itemsCache: { v: string; map: Map<string, CatalogItem> } | null = null;
export function items(): Map<string, CatalogItem> {
  const c = G.catalog;
  if (!c) return new Map();
  if (!itemsCache || itemsCache.v !== c.version + ':' + c.items.length) itemsCache = { v: c.version + ':' + c.items.length, map: new Map(c.items.map((i) => [i.id, i])) };
  return itemsCache.map;
}
export const item = (id: string | null | undefined) => (id ? items().get(id) : undefined);
export const settings = () => G.catalog?.settings ?? {};
/** Event berjalan yang punya dekorasi (untuk peta, rumah, dan Panen Buah). */
export const activeDecor = () => (G.me?.events ?? []).find((e: any) => e.decor)?.decor ?? '';
export const serverNow = () => G.now + G.offset;

export function needsNow(pet = G.me?.pet): Needs {
  if (!pet) return { kenyang: 0, bersih: 0, ceria: 0, energi: 0 };
  const per = settings().needs?.decayPerHour ?? {};
  // tidur: energi naik bertahap sampai bangun (dihitung dari saat mulai tidur)
  if (pet.sleep && settings().sleep) return needsWithSleep(pet.sleep.needs, pet.sleep.from, serverNow(), per, settings().sleep);
  return decayNeeds(pet.needs, pet.needsAt, serverNow(), per);
}
export const isSleeping = (pet = G.me?.pet) => !!pet?.sleep && serverNow() < pet.sleep.wakeAt;
/** Keadaan tubuh pet untuk digambar: wajah sesuai kebutuhan, noda kotor, gembul. */
export function petLook(pet = G.me?.pet) {
  if (!pet) return undefined;
  return petLookState(needsNow(pet), { sleeping: isSleeping(pet), sick: !!pet.sick, chub: pet.chub ?? 0 });
}

export function wearItems(wear: Record<string, string> | undefined) {
  return Object.values(wear ?? {}).map((id) => item(id)).filter(Boolean) as CatalogItem[];
}

export function toast(text: string, kind: 'info' | 'error' | 'good' = 'info') {
  G.toast = { text, kind, n: G.toast.n + 1 };
}

export function merge(p: any) {
  if (!p || !G.me) return;
  const readyBefore = G.me.quests?.ready ?? 0;
  for (const k of ['pet', 'wallet', 'inventory', 'room', 'rooms', 'garden', 'limits', 'daily', 'notificationsUnread', 'quests']) if (p[k] !== undefined) G.me[k] = p[k];
  if ((G.me.quests?.ready ?? 0) > readyBefore) setTimeout(() => toast('Tugas selesai! Ambil hadiahnya di Tugas.', 'good'), 900);
  if (p.serverNow) G.offset = p.serverNow - Date.now();
}

export function setState(s: any) {
  G.me = s;
  if (s?.serverNow) G.offset = s.serverNow - Date.now();
}

export function fail(e: unknown) {
  const msg = e instanceof ApiError ? (e.status === 401 ? 'Sesimu berakhir. Masuk lagi untuk melanjutkan.' : e.message) : 'Terjadi kesalahan. Coba lagi.';
  sfx.error();
  toast(msg, 'error');
  if (e instanceof ApiError && e.status === 401) {
    G.me = null;
  }
}

/** Panggil API mutasi, gabungkan hasilnya ke state, tampilkan error sebagai toast. */
export async function run<T = any>(fn: () => Promise<T>): Promise<T | null> {
  if (G.busy) return null;
  G.busy = true;
  try {
    const r: any = await fn();
    merge(r);
    return r;
  } catch (e) {
    fail(e);
    if (e instanceof ApiError && e.code === 'room_conflict' && e.data?.room) {
      const i = (G.me.rooms ?? []).findIndex((r: any) => r.id === e.data.room.id);
      if (i >= 0) G.me.rooms[i] = { ...G.me.rooms[i], ...e.data.room };
    }
    return null;
  } finally {
    G.busy = false;
  }
}

export const post = (url: string, body: any = {}) => api.post(url, { requestId: rid(), ...body });

export function fx(kind: typeof G.fxKind) {
  G.fxKind = kind;
  G.fx++;
}

export async function loadCatalog() {
  const cached = (() => { try { return JSON.parse(localStorage.getItem('kb-catalog') ?? 'null'); } catch { return null; } })();
  if (cached && !G.catalog) G.catalog = cached;
  try {
    const c = await api.get('/api/catalog');
    G.catalog = c;
    try { localStorage.setItem('kb-catalog', JSON.stringify(c)); } catch { /* penuh */ }
  } catch (e) {
    if (!G.catalog) throw e;
  }
}

export async function refreshMe() {
  const s = await api.get('/api/me');
  setState(s);
  if (G.catalog && s.catalogVersion !== G.catalog.version) loadCatalog();
  return s;
}

/* -------- pembelian & barang -------- */

export function canBuy(it: CatalogItem, now = serverNow()) {
  if (!it.shop) return false;
  if (it.available_from && new Date(it.available_from).getTime() > now) return false;
  if (it.available_to && new Date(it.available_to).getTime() <= now) return false;
  if (it.event_id) {
    const ev = G.catalog?.events.find((e) => e.id === it.event_id);
    if (!ev || new Date(ev.starts_at).getTime() > now || new Date(ev.ends_at).getTime() <= now) return false;
  }
  return it.price_coin > 0 || it.price_pearl > 0;
}

export const owned = (id: string) => (G.me?.inventory?.[id] ?? 0) as number;

export const fmt = (n: number) => Math.round(n).toLocaleString('id-ID');

export function timeLeft(ms: number) {
  if (ms <= 0) return 'siap';
  const m = Math.ceil(ms / 60000);
  if (m < 60) return `${m} mnt`;
  const h = Math.floor(m / 60);
  return `${h} j ${m % 60} mnt`;
}

export function effText(e: Record<string, number> | undefined) {
  const L: Record<string, string> = { kenyang: 'Kenyang', bersih: 'Bersih', ceria: 'Ceria', energi: 'Energi' };
  return Object.entries(e ?? {}).map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${L[k] ?? k}`).join(' · ');
}

export function track(name: string, props?: Record<string, unknown>) {
  api.post('/api/track', { events: [{ name, props }] }).catch(() => {});
}

/* -------- tidur dengan lampu mati -------- */

export async function setSleep(on: boolean) {
  const r: any = await run(() => post('/api/sleep', { on }));
  if (r) {
    if (on) { sfx.pop(); toast(`Lampu dimatikan. ${G.me.pet.name} tidur…`); }
    else { sfx.level(); toast(`${G.me.pet.name} bangun!`, 'good'); }
  }
  return r;
}

/** Celetukan pet dari pengaturan admin (per suasana hati). */
export function sayLine(mood: string) {
  const sp = settings().speech ?? {};
  const list: string[] = (sp[mood]?.length ? sp[mood] : sp.biasa) ?? [];
  if (!list.length || !G.me) return;
  const t = list[Math.floor(Math.random() * list.length)].replace(/\{pet\}/g, G.me.pet.name).replace(/\{nama\}/g, G.me.user.display_name);
  G.speech = { text: t, n: (G.speech?.n ?? 0) + 1 };
}

/* -------- rumah multi-ruangan -------- */

export interface RoomState { id: string; item: string | null; name: string; layout: { i: string; x: number; y: number }[]; wall: string | null; floor: string | null; version: number; size: number; theme: 'dalam' | 'luar' }

/** Ruangan yang sedang dilihat di rumah sendiri (default: kamar awal). */
export function curRoom(): RoomState {
  const list: RoomState[] = G.me?.rooms ?? (G.me?.room ? [{ id: '', item: null, name: 'Kamar', size: settings().room?.size ?? 6, theme: 'dalam', ...G.me.room }] : []);
  return list.find((r) => r.id === G.roomId) ?? list[0];
}

export function switchRoom(id: string) {
  if (G.edit || id === curRoom()?.id) return;
  G.roomId = id;
  G.view = 'home';
}

/** Jalan ke tempat di peta kampung (pet berjalan dulu, lalu tempatnya dibuka). */
export function goTo(locId: string, opts: { tab?: 'buy' | 'sell' } = {}) {
  if (G.edit) { G.edit = false; G.draft = null; G.sel = -1; }
  G.sheet = null;
  G.visit = null;
  if (opts.tab) G.shopTab = opts.tab;
  // berangkat dari rumah: pet keluar dari pintu Rumahku
  if (G.view === 'home' || G.view === 'visit') G.mapAt = 'rumah';
  G.view = 'map';
  G.mapGoal = locId;
}

/* -------- mode atur ruangan -------- */

export function startEdit() {
  if (G.edit) return;
  G.draft = (curRoom()?.layout ?? []).map((p: any) => ({ ...p }));
  G.sel = -1;
  G.edit = true;
  G.sheet = null;
  G.view = 'home';
}

export function draftAvail(id: string) {
  const placedNow = (G.draft ?? []).filter((p) => p.i === id).length;
  const placedSaved = (curRoom()?.layout ?? []).filter((p: any) => p.i === id).length;
  return owned(id) - (placedNow - placedSaved);
}
