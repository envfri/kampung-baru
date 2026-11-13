// Ubin permainan "Main bareng" (menu rumah & alun-alun), dibuat dari BARENG_GAMES: ubin hanya tampil bila game-nya
// ada di sana (dan, di alun-alun, bendanya ada di ALUN_LAYOUT). Juga baris aturan singkat di kartu ajakan / ruang tunggu.
import { BARENG_GAMES, ALUN_LAYOUT, INK, caturPieceSVG } from '@kb/shared';

type GameDef = { name: string; min: number; max: number; places: ('house' | 'alun')[] };
const GAMES = BARENG_GAMES as unknown as Record<string, GameDef>;
export interface BarengTile {
  key: string;
  label: string;
  icon: string;
  isNew?: boolean;
  /** benda di alun-alun tempat main (ubin disembunyikan bila bendanya belum ada) */
  prop?: string;
  where?: string;
}
const svg = (inner: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
const LUDO = ['#3FA06A', '#F2B632', '#3F7FBF', '#E0583F'];
export const BARENG_TILES: BarengTile[] = [
  { key: 'congklak', label: 'Congklak', icon: svg(`<rect x="1.5" y="7" width="21" height="10" rx="5" fill="#C98B55" stroke="${INK}" stroke-width="1.6"/>${[6.5, 10.2, 13.8, 17.5].map((x) => `<circle cx="${x}" cy="10" r="1.5" fill="#5E3A1F"/><circle cx="${x}" cy="14" r="1.5" fill="#5E3A1F"/>`).join('')}`) },
  {
    key: 'ular', label: 'Ular Tangga', prop: 'alun-tikarular', where: 'Tikar Ular',
    icon: svg(`<rect x="2" y="2" width="20" height="20" rx="4" fill="#FFF4D6" stroke="${INK}" stroke-width="1.6"/><path d="M7 18L10 6M11 18L14 6M8 14h4.2M9 10h4.2" stroke="#B5902F" stroke-width="1.6" stroke-linecap="round"/><path d="M17 6c-3 2 3 5 0 7s2 4 0 5" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/><path d="M17 6c-3 2 3 5 0 7s2 4 0 5" fill="none" stroke="#5FB36A" stroke-width="2" stroke-linecap="round"/>`),
  },
  {
    key: 'karung', label: 'Balap Karung', prop: 'alun-garisstart', where: 'Garis start',
    icon: svg(`<path d="M7 5h10l-1.2 2.5c2.6 2 3.4 5 3.2 8.2C18.8 19.5 16 21 12 21s-6.8-1.5-7-5.3C4.8 12.5 5.6 9.5 8.2 7.5Z" fill="#D9B26A" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><path d="M8.4 7.6h7.2" stroke="${INK}" stroke-width="1.4"/><path d="M9 13l2 1.5L15 12" stroke="#A8743F" stroke-width="1.4" fill="none" stroke-linecap="round"/>`),
  },
  { key: 'catur', label: 'Catur', isNew: true, prop: 'alun-posronda', where: 'Pos Ronda', icon: caturPieceSVG('N', 30) },
  {
    key: 'ludo', label: 'Ludo', isNew: true, prop: 'alun-tikarludo', where: 'Tikar Ludo',
    icon: svg(`<rect x="1.5" y="1.5" width="21" height="21" rx="3" fill="#FFFDF7" stroke="${INK}" stroke-width="1.5"/>${[[2.3, 2.3], [14.2, 2.3], [14.2, 14.2], [2.3, 14.2]].map(([x, y], k) => `<rect x="${x}" y="${y}" width="7.5" height="7.5" fill="${LUDO[k]}"/>`).join('')}<path d="M12 9.6l2.4 2.4L12 14.4 9.6 12Z" fill="${INK}"/><path d="M4.4 9.2q1.7.8 3.4 0l-.8-3h-1.8Z" fill="#FFFDF7" stroke="${INK}" stroke-width="1"/><circle cx="6.1" cy="5.4" r="1.4" fill="#FFFDF7" stroke="${INK}" stroke-width="1"/>`),
  },
];
/** jumlah pemain: "2" atau "2–4" */
export const playersOf = (key: string) => { const g = GAMES[key]; return !g ? '' : g.min === g.max ? `${g.min}` : `${g.min}–${g.max}`; };
/** ubin yang tampil di tempat ini (game yang ditutup admin lewat features.<game> = false tidak tampil) */
export function barengTiles(place: 'house' | 'alun', features?: Record<string, unknown>) {
  return BARENG_TILES.filter((t) => features?.[t.key] !== false && GAMES[t.key]?.places.includes(place) && (place === 'house' || (!!t.prop && ALUN_LAYOUT.some((p) => p.i === t.prop))));
}
/** indeks benda tempat main di ALUN_LAYOUT (−1 bila tidak ada) */
export const tileIndex = (t: BarengTile) => (t.prop ? ALUN_LAYOUT.findIndex((p) => p.i === t.prop) : -1);

const num = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');
/** baris aturan singkat di kartu ajakan / ruang tunggu, per game (game lain menambah barisnya sendiri di sini) */
export const RULE_CHIPS: Record<string, (cfg: any) => { t: string; clock?: boolean }[]> = {
  catur: (cfg) => {
    const c = cfg?.catur ?? {}, base = (c.baseMs ?? 300_000) / 60_000, inc = (c.incMs ?? 3000) / 1000;
    return [{ t: `${num(base)} mnt + ${num(inc)} dtk/langkah`, clock: true }, { t: 'warna diundi' }, { t: 'aturan lengkap' }];
  },
  ludo: (cfg) => {
    const l = cfg?.ludo ?? {}, t = l.tokensByPlayers ?? { 2: 4, 3: 2, 4: 2 }, max = (l.maxMs ?? 900_000) / 60_000;
    const many = t[3] === t[4] ? `3–4 pemain → ${t[3]} bidak` : `bertiga ${t[3]} · berempat ${t[4]} bidak`;
    return [{ t: `berdua → ${t[2]} bidak` }, { t: many }, { t: `±12 mnt · maks ${num(max)}`, clock: true }];
  },
};
export const CLOCK_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8.5" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M12 8.5V13l3 2M9.5 2.8h5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>`;
