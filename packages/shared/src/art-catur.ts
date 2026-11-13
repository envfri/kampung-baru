// Gambar Catur: bidak gaya datar BUPI (Raja, Menteri, Benteng, Gajah, Kuda, Pion; isi gading / biru tua, garis INK)
// dan Pos Ronda 2×2 di alun-alun (gardu kayu beratap genteng, dinding gedek, bale-bale dengan papan catur di meja pendek,
// kentongan, termos kopi, papan nama di puncak atap). Didaftarkan ke art.ts lewat registerArt.
import { INK, P, shade, registerArt, type IsoCtx } from './art';
import { textW } from './art-alun';

const f1 = (v: number) => Math.round(v * 10) / 10;
const C3 = (hex: string) => [shade(hex, 0.14), shade(hex, -0.1), shade(hex, -0.27)];

/* ---------------- bidak (viewBox 0 0 45 45) ---------------- */
const BASE = 'M10 39.6h25c1.4 0 2.1-1 1.8-2.3l-.6-2.5c-.3-1.1-1.2-1.8-2.3-1.8H11.1c-1.1 0-2 .7-2.3 1.8l-.6 2.5c-.3 1.3.4 2.3 1.8 2.3Z';
const SHAPES: Record<string, { body: string[]; det: string[]; balls?: number[][]; eye?: number[]; nos?: number[] }> = {
  p: { body: ['M15.6 33C16.1 27.6 18.6 25.1 20.6 24.2h3.8C26.4 25.1 28.9 27.6 29.4 33Z', 'M18 24.6h9a1.6 1.6 0 0 0 0-3.2h-9a1.6 1.6 0 0 0 0 3.2Z', 'M22.5 9.2a6.4 6.4 0 1 1 0 12.8a6.4 6.4 0 1 1 0-12.8Z'], det: [] },
  r: { body: ['M14.6 33L16.2 18h12.6L30.4 33Z', 'M12.4 18.4V8.6h4.4v3.4h3.5V8.6h4.4v3.4h3.5V8.6h4.4v9.8Z'], det: ['M16.4 22.4h12.2', 'M15.8 28.6h13.4'] },
  n: {
    body: ['M14.4 33C14.4 27.6 16.4 24.6 19.6 22.2C17.6 21.8 15.6 21.2 13.8 20.3C12.1 19.4 11.3 17.7 12.1 16.2L17.1 10.4C17.9 9.4 18.5 8.3 18.7 7L20.1 4.4L22.6 7.1C28.2 7.6 32.8 12.3 32.8 19.6C32.8 25.2 31.2 28.6 31 33Z'],
    det: ['M24.2 8.8C28.6 10.8 30.6 14.8 30.8 19.8', 'M17.2 18.2C18.6 19.4 20.6 20.2 22.4 20.6'], eye: [19.8, 12.2], nos: [14.2, 17.4],
  },
  b: {
    body: ['M15.6 33C16.3 28 18.7 25.4 20.4 24.6h4.2C26.3 25.4 28.7 28 29.4 33Z', 'M17.4 24.8h10.2a1.6 1.6 0 0 0 0-3.2H17.4a1.6 1.6 0 0 0 0 3.2Z', 'M22.5 6.8C27.2 9.9 29.2 13.7 29.2 16.9C29.2 20 26.4 21.8 22.5 21.8C18.6 21.8 15.8 20 15.8 16.9C15.8 13.7 17.8 9.9 22.5 6.8Z', 'M22.5 2.8a2.1 2.1 0 1 1 0 4.2a2.1 2.1 0 1 1 0-4.2Z'],
    det: ['M25.8 11.2L21.6 16.4'],
  },
  q: { body: ['M14 33L11 15.8L15.4 22.6L16.6 11.8L19.8 20L22.5 9.6L25.2 20L28.4 11.8L29.6 22.6L34 15.8L31 33Z'], balls: [[11, 14], [16.6, 10], [22.5, 7.8], [28.4, 10], [34, 14]], det: ['M14.8 28.4C19.2 27 25.8 27 30.2 28.4'] },
  k: {
    body: ['M14.2 33C14.2 27.2 15.8 23.8 17.4 22.4h10.2C29.2 23.8 30.8 27.2 30.8 33Z', 'M15.6 22.4C14.6 16.8 18.1 13.6 22.5 13.6C26.9 13.6 30.4 16.8 29.4 22.4Z', 'M21.1 13.8V10.2h-3.1V7.4h3.1V4.2h2.8v3.2h3.1v2.8h-3.1v3.6Z'],
    det: ['M22.5 14v8.2', 'M15.8 28.2h13.4'],
  },
};
/** warna bidak: Putih = gading, Hitam = biru tua */
export const CATUR_PIECE_COL = { w: { fill: '#FFF6E2', det: INK }, b: { fill: '#3A3F5E', det: '#B9BED8' } };
const innerCache = new Map<string, string>();
/** isi SVG bidak (tanpa pembungkus) di kotak 45×45; huruf besar = Putih */
export function caturPieceInner(p: string) {
  const hit = innerCache.get(p);
  if (hit) return hit;
  const t = p.toLowerCase(), S = SHAPES[t];
  if (!S) return '';
  const c = CATUR_PIECE_COL[p === p.toUpperCase() ? 'w' : 'b'], sw = 2.2;
  let o = `<path d="${BASE}" fill="${c.fill}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  for (const d of S.body) o += `<path d="${d}" fill="${c.fill}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  for (const [x, y] of S.balls ?? []) o += `<circle cx="${x}" cy="${y}" r="2.2" fill="${c.fill}" stroke="${INK}" stroke-width="1.9"/>`;
  for (const d of S.det) o += `<path d="${d}" fill="none" stroke="${c.det}" stroke-width="1.6" stroke-linecap="round"/>`;
  if (S.eye && S.nos) o += `<circle cx="${S.eye[0]}" cy="${S.eye[1]}" r="1.5" fill="${c.det}"/><circle cx="${S.nos[0]}" cy="${S.nos[1]}" r=".9" fill="${c.det}"/>`;
  innerCache.set(p, o);
  return o;
}
export const caturPieceSVG = (p: string, size = 40) => `<svg viewBox="0 0 45 45" width="${size}" height="${size}" aria-hidden="true">${caturPieceInner(p)}</svg>`;

/* ---------------- Pos Ronda 2×2 ---------------- */
/** tempat duduk dua pemain catur di bale-bale (relatif pojok Pos Ronda, petak): kiri = Putih, kanan = Hitam */
export const RONDA_SEATS: [number, number][] = [[0.3, 1.7], [1.7, 0.3]];
/** tinggi duduk di bale-bale (px pada skala 1) */
export const RONDA_LIFT = 21;
/** ukuran terukur Pos Ronda pada skala 1 (px): lebar atap ±140, tinggi sampai papan nama ±185 dari tanah */
export const RONDA_SIZE = { w: 150, h: 186 };

function posRonda(g: IsoCtx, x: number, y: number) {
  const s = g.s, iso = (a: number, b: number) => g.iso(a, b) as number[];
  const Q = (a: number, b: number, v: number) => { const p = iso(a, b); return [p[0], p[1] - v * s]; };
  const poly = (a: number[][], fill: string, sw = 1.6) => `<polygon points="${P(a)}" fill="${fill}" stroke="${INK}" stroke-width="${f1(sw * s)}" stroke-linejoin="round"/>`;
  const box = (bx: number, by: number, z: number, w: number, d: number, h: number, c3: string[]) => g.box(bx, by, z, w, d, h, c3);
  const line = (a: number[], b: number[], col: string, w = 1) => `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${col}" stroke-width="${w}"/>`;
  const wood = '#8A5A36', gedek = '#E3C98E', bale = '#D9B26A', roof = '#C0573E';
  const c = iso(x + 1, y + 1);
  let h = `<ellipse cx="${f1(c[0])}" cy="${f1(c[1])}" rx="${f1(80 * s)}" ry="${f1(38 * s)}" fill="${INK}" opacity=".1"/>`;
  // dinding gedek (anyaman bambu) di dua sisi belakang
  h += poly([Q(x + 0.1, y + 0.1, 16), Q(x + 0.1, y + 1.9, 16), Q(x + 0.1, y + 1.9, 64), Q(x + 0.1, y + 0.1, 64)], gedek);
  for (let k = 1; k < 10; k++) h += line(Q(x + 0.1, y + 0.1 + k * 0.18, 16), Q(x + 0.1, y + 0.1 + k * 0.18, 64), shade(gedek, -0.25));
  for (const v of [28, 40, 52]) h += line(Q(x + 0.1, y + 0.1, v), Q(x + 0.1, y + 1.9, v), shade(gedek, -0.25));
  h += poly([Q(x + 0.1, y + 0.1, 16), Q(x + 1.9, y + 0.1, 16), Q(x + 1.9, y + 0.1, 64), Q(x + 0.1, y + 0.1, 64)], shade(gedek, -0.12));
  for (let k = 1; k < 10; k++) h += line(Q(x + 0.1 + k * 0.18, y + 0.1, 16), Q(x + 0.1 + k * 0.18, y + 0.1, 64), shade(gedek, -0.35));
  for (const v of [28, 40, 52]) h += line(Q(x + 0.1, y + 0.1, v), Q(x + 1.9, y + 0.1, v), shade(gedek, -0.35));
  // tiang belakang
  h += box(x + 0.04, y + 0.04, 0, 0.12, 0.12, 106, C3(wood)) + box(x + 1.84, y + 0.04, 0, 0.12, 0.12, 106, C3(wood)) + box(x + 0.04, y + 1.84, 0, 0.12, 0.12, 106, C3(wood));
  // bale-bale bambu (kaki pendek) + bilah
  for (const [a, b] of [[0.2, 0.2], [1.7, 0.2], [0.2, 1.7], [1.7, 1.7], [0.95, 1.7], [1.7, 0.95]]) h += box(x + a, y + b, 0, 0.09, 0.09, 14, C3(shade(bale, -0.25)));
  h += box(x + 0.14, y + 0.14, 14, 1.72, 1.72, 6, C3(bale));
  for (let k = 1; k < 12; k++) h += line(Q(x + 0.14 + (k * 1.72) / 12, y + 0.16, 20), Q(x + 0.14 + (k * 1.72) / 12, y + 1.84, 20), shade(bale, -0.28));
  // termos & gelas kopi
  const th = Q(x + 0.42, y + 0.42, 20);
  h += `<rect x="${f1(th[0] - 4.5 * s)}" y="${f1(th[1] - 16 * s)}" width="${f1(9 * s)}" height="${f1(16 * s)}" rx="${f1(2.4 * s)}" fill="#E0583F" stroke="${INK}" stroke-width="${f1(1.3 * s)}"/><rect x="${f1(th[0] - 3.4 * s)}" y="${f1(th[1] - 19.5 * s)}" width="${f1(6.8 * s)}" height="${f1(3.6 * s)}" rx="1" fill="#FFFDF7" stroke="${INK}" stroke-width="1"/>`;
  const gl = Q(x + 0.62, y + 0.3, 20);
  h += `<path d="M${f1(gl[0] - 3)} ${f1(gl[1] - 7)}h6l-.8 7h-4.4Z" fill="#FFF4D6" stroke="${INK}" stroke-width="1.1"/><rect x="${f1(gl[0] - 2.4)}" y="${f1(gl[1] - 5)}" width="4.8" height="3.4" fill="#8A5A36"/>`;
  // meja pendek + papan catur di tengah bale-bale
  const mx = x + 0.72, my = y + 0.72, mw = 0.56, z0 = 20;
  for (const [a, b] of [[0.05, 0.05], [mw - 0.12, 0.05], [0.05, mw - 0.12], [mw - 0.12, mw - 0.12]]) h += box(mx + a, my + b, z0, 0.07, 0.07, 9, C3(shade('#B98A5A', -0.3)));
  h += box(mx, my, z0 + 9, mw, mw, 4, C3('#B98A5A'));
  const z = z0 + 13, m0 = 0.07, cw = (mw - 2 * m0) / 8;
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) h += `<polygon points="${P([Q(mx + m0 + i * cw, my + m0 + j * cw, z), Q(mx + m0 + (i + 1) * cw, my + m0 + j * cw, z), Q(mx + m0 + (i + 1) * cw, my + m0 + (j + 1) * cw, z), Q(mx + m0 + i * cw, my + m0 + (j + 1) * cw, z)])}" fill="${(i + j) % 2 ? '#F2DFB6' : '#C49563'}"/>`;
  h += `<polygon points="${P([Q(mx + m0, my + m0, z), Q(mx + mw - m0, my + m0, z), Q(mx + mw - m0, my + mw - m0, z), Q(mx + m0, my + mw - m0, z)])}" fill="none" stroke="${INK}" stroke-width="1.1"/>`;
  const pc = (i: number, j: number, col: string, tall: number) => { const p = Q(mx + m0 + (i + 0.5) * cw, my + m0 + (j + 0.5) * cw, z); return `<path d="M${f1(p[0] - 2.6)} ${f1(p[1])}h5.2l-1.1-${tall}h-3Z" fill="${col}" stroke="${INK}" stroke-width=".8"/><circle cx="${f1(p[0])}" cy="${f1(p[1] - tall - 1.5)}" r="2.1" fill="${col}" stroke="${INK}" stroke-width=".8"/>`; };
  const pieces: [number, number, string, number][] = [[0, 1, 'w', 7], [1, 1, 'w', 5], [2, 2, 'w', 5], [4, 1, 'w', 8], [5, 3, 'w', 5], [3, 4, 'b', 5], [6, 5, 'b', 5], [5, 6, 'b', 8], [7, 6, 'b', 7], [2, 6, 'b', 6]];
  for (const [i, j, col, t] of pieces.sort((a, b2) => a[0] + a[1] - b2[0] - b2[1])) h += pc(i, j, col === 'w' ? '#FFF6E2' : '#3A3F5E', t);
  // tiang depan
  h += box(x + 1.84, y + 1.84, 0, 0.12, 0.12, 106, C3(wood));
  // kentongan bambu di tiang kanan
  const kt = Q(x + 2.02, y + 0.3, 100), kb = Q(x + 2.02, y + 0.3, 72);
  h += `<line x1="${f1(kt[0])}" y1="${f1(kt[1])}" x2="${f1(kb[0])}" y2="${f1(kb[1] - 24 * s)}" stroke="${INK}" stroke-width="1.2"/><rect x="${f1(kb[0] - 5.5 * s)}" y="${f1(kb[1] - 26 * s)}" width="${f1(11 * s)}" height="${f1(28 * s)}" rx="${f1(4.5 * s)}" fill="#C9A25A" stroke="${INK}" stroke-width="${f1(1.5 * s)}"/><line x1="${f1(kb[0])}" y1="${f1(kb[1] - 20 * s)}" x2="${f1(kb[0])}" y2="${f1(kb[1] - 5 * s)}" stroke="${INK}" stroke-width="${f1(2.2 * s)}" stroke-linecap="round"/>`;
  // atap limasan genteng (dua sisi depan terlihat) + papan nama: tembus pandang bila ada pet di belakangnya (seperti pohon)
  const A = Q(x + 1, y + 1, 156), E = 106, ov = 0.2;
  const eL = Q(x - ov, y + 2 + ov, E), eF = Q(x + 2 + ov, y + 2 + ov, E), eR = Q(x + 2 + ov, y - ov, E), eB = Q(x - ov, y - ov, E);
  let r = poly([A, eB, eR], shade(roof, -0.3)) + poly([A, eL, eB], shade(roof, -0.3));
  r += poly([A, eR, eF], roof) + poly([A, eF, eL], shade(roof, -0.12));
  for (let k = 1; k < 4; k++) {
    const t = k / 4, at = (q: number[]) => [A[0] + (q[0] - A[0]) * t, A[1] + (q[1] - A[1]) * t];
    r += line(at(eR), at(eF), shade(roof, -0.32), 1.2) + line(at(eF), at(eL), shade(roof, -0.32), 1.2);
  }
  // papan nama berdiri di puncak atap, kotaknya mengikuti panjang tulisan
  const txt = 'POS RONDA', fs = 10 * s, ls = 0.4, hh = 18 * s;
  const w = textW(txt, fs) + ls * txt.length + 14 * s, bx = A[0], by = A[1] - 12 * s - hh;
  r += line([bx - 16 * s, by + hh], [bx - 16 * s, A[1] + 4], INK, 1.6) + line([bx + 16 * s, by + hh], [bx + 16 * s, A[1] + 4], INK, 1.6);
  r += `<rect x="${f1(bx - w / 2)}" y="${f1(by)}" width="${f1(w)}" height="${f1(hh)}" rx="${f1(3.5 * s)}" fill="#FFF4D6" stroke="${INK}" stroke-width="${f1(1.7 * s)}"/>`;
  r += `<text x="${f1(bx)}" y="${f1(by + hh / 2)}" dy=".35em" text-anchor="middle" font-family="'Baloo 2',system-ui,sans-serif" font-weight="800" font-size="${f1(fs)}" fill="${INK}" letter-spacing="${ls}" data-fit="${f1(w - 4)}">${txt}</text>`;
  r += `<circle cx="${f1(A[0])}" cy="${f1(A[1] - 3)}" r="${f1(4 * s)}" fill="#F2B632" stroke="${INK}" stroke-width="1.3"/>`;
  return h + `<g class="canopy">${r}</g>`;
}

registerArt({}, {
  posronda: { label: 'Pos ronda', colors: {}, draw: (g, x, y) => posRonda(g, x, y) },
});
