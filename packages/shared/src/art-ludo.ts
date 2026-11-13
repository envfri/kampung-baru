// Gambar Ludo di alun-alun: Tikar Ludo 3×3 (datar, bisa dilewati) = tikar anyaman pandan dengan papan Ludo tercetak,
// bidak mini & dadu. Orisinal: garis INK, isian datar. Didaftarkan ke art.ts lewat registerArt.
import { INK, P, shade, registerArt, type IsoCtx } from './art';
import { LUDO_COLORS } from './ludo';

const f1 = (v: number) => Math.round(v * 10) / 10;
const C3 = (hex: string) => [shade(hex, 0.14), shade(hex, -0.1), shade(hex, -0.27)];

/** Tikar Ludo w×d petak: pinggiran hijau, anyaman pandan, papan 15×15 (kandang, lengan, lajur pulang, segitiga rumah), bidak mini & dadu. */
function tikarLudo(g: IsoCtx, x: number, y: number, w: number, d: number) {
  const s = g.s, q = (u: number, v: number) => g.iso(x + u, y + v);
  let h = g.poly([q(0.06, 0.06), q(w - 0.06, 0.06), q(w - 0.06, d - 0.06), q(0.06, d - 0.06)], '#3FA06A', 1.8);
  h += `<polygon points="${P([q(0.16, 0.16), q(w - 0.16, 0.16), q(w - 0.16, d - 0.16), q(0.16, d - 0.16)])}" fill="#E9D7A8"/>`;
  // anyaman
  for (let k = 1; k < 12; k++) { const t = 0.16 + (k * (w - 0.32)) / 12, a = q(t, 0.16), b = q(t, d - 0.16); h += `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="#D2BC86" stroke-width="1"/>`; }
  // papan 15×15 tercetak
  const m = 0.32, c = (Math.min(w, d) - 2 * m) / 15;
  const rect = (i: number, j: number, wi: number, hj: number, fill: string, sw = 1.1) =>
    `<polygon points="${P([q(m + i * c, m + j * c), q(m + (i + wi) * c, m + j * c), q(m + (i + wi) * c, m + (j + hj) * c), q(m + i * c, m + (j + hj) * c)])}" fill="${fill}" stroke="${INK}" stroke-width="${f1(sw * s)}" stroke-linejoin="round"/>`;
  const cell = (i: number, j: number, fill: string) =>
    `<polygon points="${P([q(m + i * c, m + j * c), q(m + (i + 1) * c, m + j * c), q(m + (i + 1) * c, m + (j + 1) * c), q(m + i * c, m + (j + 1) * c)])}" fill="${fill}" stroke="${INK}" stroke-opacity=".45" stroke-width=".6"/>`;
  h += rect(0, 0, 15, 15, '#FFFDF7', 1.3);
  ([[0, 0], [9, 0], [9, 9], [0, 9]] as const).forEach(([i, j], k) => { h += rect(i, j, 6, 6, LUDO_COLORS[k]) + rect(i + 1, j + 1, 4, 4, '#FFF8E6', 0.8); });
  for (let a = 0; a < 6; a++) for (let b = 6; b < 9; b++) h += cell(a, b, '#FFFDF7') + cell(b, a, '#FFFDF7') + cell(14 - a, b, '#FFFDF7') + cell(b, 14 - a, '#FFFDF7');
  for (let a = 1; a < 6; a++) h += cell(a, 7, LUDO_COLORS[0]) + cell(7, a, LUDO_COLORS[1]) + cell(14 - a, 7, LUDO_COLORS[2]) + cell(7, 14 - a, LUDO_COLORS[3]);
  const ctr = [q(m + 6 * c, m + 6 * c), q(m + 9 * c, m + 6 * c), q(m + 9 * c, m + 9 * c), q(m + 6 * c, m + 9 * c)], mid = q(m + 7.5 * c, m + 7.5 * c);
  ([[0, 1, 1], [1, 2, 2], [2, 3, 3], [3, 0, 0]] as const).forEach(([a, b, k]) => (h += `<polygon points="${P([ctr[a], ctr[b], mid])}" fill="${LUDO_COLORS[k]}" stroke="${INK}" stroke-width="${f1(0.8 * s)}" stroke-linejoin="round"/>`));
  // bidak mini (tegak, menghadap kamera) & dadu
  const tok = (i: number, j: number, col: string) => {
    const p = q(m + i * c, m + j * c);
    return `<path d="M${f1(p[0] - 3.4 * s)} ${f1(p[1])}q${f1(3.4 * s)} ${f1(1.6 * s)} ${f1(6.8 * s)} 0l${f1(-1.6 * s)} ${f1(-6 * s)}h${f1(-3.6 * s)}Z" fill="${col}" stroke="${INK}" stroke-width="${f1(0.9 * s)}" stroke-linejoin="round"/><circle cx="${f1(p[0])}" cy="${f1(p[1] - 7.6 * s)}" r="${f1(2.6 * s)}" fill="${col}" stroke="${INK}" stroke-width="${f1(0.9 * s)}"/>`;
  };
  const toks: [number, number, number][] = [[2.3, 3.5, 0], [3.7, 3.5, 0], [11, 2.5, 1], [7.5, 11.5, 3], [12.5, 11.8, 2], [1.5, 6.5, 3], [8.5, 3.5, 2]];
  for (const [i, j, k] of toks.sort((a, b) => a[0] + a[1] - b[0] - b[1])) h += tok(i, j, LUDO_COLORS[k]);
  h += g.box(x + w - 0.55, y + 0.3, 0, 0.18, 0.18, 7, C3('#FFFDF7'));
  const dp = g.iso(x + w - 0.46, y + 0.39);
  h += `<circle cx="${f1(dp[0] - 2 * s)}" cy="${f1(dp[1] - 8 * s)}" r="${f1(1 * s)}" fill="#E0583F"/><circle cx="${f1(dp[0] + 2 * s)}" cy="${f1(dp[1] - 6 * s)}" r="${f1(1 * s)}" fill="#E0583F"/>`;
  return h;
}

registerArt({}, {
  tikarludo: { label: 'Tikar Ludo', colors: {}, draw: (g, x, y, w, d) => tikarLudo(g, x, y, w, d) },
});

/** pojok Tikar Ludo (relatif petak kiri atas tikar 3×3) tempat pemain berdiri menurut warna kursinya */
export const LUDO_MAT_SPOTS: [number, number][] = [[0.35, 0.35], [2.65, 0.35], [2.65, 2.65], [0.35, 2.65]];
