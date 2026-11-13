// Keadaan alun-alun yang dipakai bersama oleh layar alun-alun (Room) & bar alun-alun (SquareBar):
// wahana yang sedang ditunggu / dinaiki, permintaan batal, dan jam pratinjau (?jam=, ?langit=, ?arak=, ?kereta=).
import { localHM, squareNight } from '@kb/shared';

export type RideKind = 'bianglala' | 'kereta' | 'arak';
export const ALUN = $state({
  /** wahana pet sendiri: tunggu (belum naik) atau naik; until = selesai (jam server, ms) */
  ride: null as null | { kind: RideKind; phase: 'tunggu' | 'naik'; at: number; until: number },
  /** naik setiap tombol Batal ditekan */
  cancel: 0,
  /** sedang memancing di dermaga Kolam Pemancingan Bareng (layar mancing terbuka) */
  fishing: null as null | { pier: number },
  /** Lomba Mancing dari sinkron: papan skor langsung / hasil lomba terakhir / jadwal */
  lomba: null as null | LombaView,
  /** papan lomba dibuka (ketuk Papan Lomba Mancing) */
  board: false,
  /** hasil lomba yang sudah ditutup pemain */
  seen: '',
  /** bonus Ramai-ramai di kolam (dari sinkron, hanya saat duduk di dermaga): pemancing sekarang, yang dibutuhkan, XP tambahan */
  ramai: null as null | { anglers: number; need: number; xp: number },
});
export type LombaRow = { name: string; grams: number; fish: number; me?: boolean; rank?: number; coins?: number };
export type LombaView = {
  phase: 'lomba' | 'hasil' | 'daftar' | 'tunggu'; id?: string; start: number; end: number; next?: number; left: number; count?: number;
  board?: LombaRow[]; me?: { pos: number; grams: number; fish: number } | null;
  results?: LombaRow[] | null; mine?: { rank: number; coins: number; xp: number; grams: number } | null;
};

const qs = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
const LANGIT: Record<string, string> = { pagi: '07:00', siang: '12:00', sore: '16:00', malam: '20:30' };
/** ?jam=20:01 atau ?langit=malam: hanya untuk pratinjau tampilan (server tetap memakai jamnya sendiri) */
const fixedHM = (() => {
  const v = qs?.get('jam') ?? LANGIT[qs?.get('langit') ?? ''] ?? '';
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(v);
  return m ? { h: Math.min(23, +m[1]), m: Math.min(59, +m[2]) } : null;
})();
/** pratinjau arak-arakan / kereta: detik ke-N dalam jadwalnya */
export const PREVIEW = {
  hm: fixedHM,
  arak: qs?.has('arak') ? Math.max(0, Number(qs.get('arak')) || 0) : null,
  kereta: qs?.has('kereta') ? Math.max(0, Number(qs.get('kereta')) || 0) : null,
  lomba: qs?.has('lomba') ?? false,
  /** ?lomba=lomba | hasil: contoh papan skor / hasil untuk tangkapan layar & audit teks (nama 16 huruf) */
  lombaView: (['lomba', 'hasil'].includes(qs?.get('lomba') ?? '') ? qs!.get('lomba') : null) as null | 'lomba' | 'hasil',
  /** ?ramai=N: contoh jumlah pemancing di dermaga (tampilan bonus Ramai-ramai) */
  ramai: qs?.has('ramai') ? Math.max(1, Math.min(6, Number(qs.get('ramai')) || 1)) : null,
};
/** zona waktu HP dalam menit dari UTC (WIB 420, WITA 480, WIT 540) */
export const tzMin = () => -new Date().getTimezoneOffset();
/** jam & menit setempat (atau pratinjau) */
export function localNow() {
  if (fixedHM) return { ...fixedHM, s: 0 };
  return localHM(Date.now(), tzMin());
}
export const nightNow = () => { const t = localNow(); return squareNight(t.h, t.m); };
/** kartu Lomba Mancing terbuka: papan diketuk, atau hasil lomba yang kamu ikuti belum dilihat */
export const lombaCardOpen = () => ALUN.board || (ALUN.lomba?.phase === 'hasil' && !!ALUN.lomba.results && !!ALUN.lomba.mine && ALUN.seen !== ALUN.lomba.id);
/** contoh keadaan lomba untuk pratinjau (?lomba=lomba / ?lomba=hasil) */
export function previewLomba(now: number): LombaView | null {
  const v = PREVIEW.lombaView;
  if (!v) return null;
  const rows: LombaRow[] = [
    { name: 'Klepon Ketan Hit', grams: 2480, fish: 6 }, { name: 'Gethuk Singkong', grams: 1920, fish: 5, me: true },
    { name: 'Cenil Warna Warn', grams: 1310, fish: 4 }, { name: 'Onde Wijen Manis', grams: 870, fish: 3 },
  ];
  if (v === 'lomba') return { phase: 'lomba', id: 'pratinjau', start: now - 46_000, end: now + 134_000, left: 9, count: 4, board: rows, me: { pos: 2, grams: 1920, fish: 5 } };
  const res = rows.map((r, i) => ({ ...r, rank: i < 3 ? i + 1 : 0, coins: [40, 25, 15][i] ?? 5 }));
  return { phase: 'hasil', id: 'pratinjau', start: now - 200_000, end: now - 20_000, left: 9, count: 4, board: rows, results: res, mine: { rank: 2, coins: 25, xp: 6, grams: 1920 } };
}
