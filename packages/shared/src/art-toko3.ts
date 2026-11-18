// Gambar barang baru tiga toko koin (paket konten 18): mebel Mebel Jati, benda halaman Toko Bangunan, dan ikon
// makanan Pasar Pagi. Semua orisinal: garis INK, isian datar, warna bisa diganti dari admin. Didaftarkan ke art.ts
// lewat registerArt (dinding & lantai barunya ada di art.ts: pola digambar di wallRun / floorSVG).
//
// 4 arah: arah 2 & 3 adalah tampak belakang (furnBack mencerminkan g.iso terhadap pusat petak). Mebel di sini tidak
// memakai g.box, tetapi "scene": tiap bagian (balok prism, hiasan, benda kecil) dicatat dengan kotak batasnya dalam
// koordinat petak yang sudah dicerminkan, lalu diurutkan belakang → depan dengan sortBoxes. Jadi urutan tumpuk benar
// dari depan maupun belakang tanpa gambar kedua. Hiasan yang hanya ada di sisi depan (laci, muka jam, layar) memakai
// g.quadX / g.quadY (otomatis hilang dari belakang) atau dicek dengan g.back.
import {
  INK, P, shade, registerArt, C3, f1, at3, rk, inkLine, thinLine, prism, ovalTub, lathe, flatE, frontArc, onY, onX, discPts, glowC, shadowE, sortBoxes, hull,
  type IsoCtx, type FurnDef, type IconDef,
} from './art';

type Pt = number[];
type Part = { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; n: number; h: string };

/**
 * Kumpulan bagian mebel yang diurutkan sendiri (belakang → depan). Koordinat bagian dicatat lewat g.iso, jadi pada
 * tampak belakang (g.iso dicerminkan) urutannya ikut terbalik. Hasil: satu string SVG.
 */
function scene(g: IsoCtx) {
  const s = g.s, parts: Part[] = [];
  // titik petak efektif (setelah dicerminkan), dihitung balik dari posisi layar: u + v dan u − v
  const eff = (u: number, v: number) => { const [X, Y] = g.iso(u, v); const a = Y / (16 * s), b = X / (32 * s); return [(a + b) / 2, (a - b) / 2]; };
  const add = (u0: number, v0: number, u1: number, v1: number, z0: number, z1: number, h: string) => {
    if (!h) return;
    const a = eff(u0, v0), b = eff(u1, v1);
    parts.push({ x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), y0: Math.min(a[1], b[1]), y1: Math.max(a[1], b[1]), z0, z1, n: parts.length, h });
  };
  return {
    add,
    /** balok (seperti g.box) + hiasan yang menempel di balok itu */
    box(u: number, v: number, z: number, w: number, d: number, h: number, c3: string[], extra = '', sw = 1.6) {
      add(u, v, u + w, v + d, z, z + h, prism(g, rect(u, v, w, d), z, h, c3, sw) + extra);
    },
    out: () => sortBoxes(parts).map((p) => p.h).join(''),
  };
}
const rect = (u: number, v: number, w: number, d: number) => [[u, v], [u + w, v], [u + w, v + d], [u, v + d]];
const circ = (cx: number, cy: number, r: number, fill: string, s: number, sw = 1.2, extra = '') =>
  `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r)}" fill="${fill}"${sw ? ` stroke="${INK}" stroke-width="${f1(sw * s)}"` : ''}${extra}/>`;
/**
 * Bidang atap / bidang miring: tiap bidang [titik 3D (u, v, z)], arah hadap (nu, nv) di petak. Diurutkan dari jauh ke
 * dekat menurut titik tengahnya (sudah dicerminkan), warnanya menurut arah hadap di layar (seperti sisi balok).
 */
function faces(g: IsoCtx, list: { pts: number[][]; n: [number, number]; c3: string[]; extra?: (pts: Pt[]) => string }[], sw = 1.6) {
  const s = g.s;
  const eff = (u: number, v: number) => { const [X, Y] = g.iso(u, v); const a = Y / (16 * s), b = X / (32 * s); return [(a + b) / 2, (a - b) / 2]; };
  return list
    .map((f) => {
      const m = f.pts.reduce((a, p) => [a[0] + p[0] / f.pts.length, a[1] + p[1] / f.pts.length], [0, 0]);
      const e0 = eff(m[0], m[1]), e1 = eff(m[0] + f.n[0], m[1] + f.n[1]);
      const nx = e1[0] - e0[0], ny = e1[1] - e0[1];
      // menghadap kamera: +y layar (kiri bawah) c3[1], +x (kanan bawah) c3[2]; membelakangi: c3[0] digelapkan
      const fill = nx + ny <= 0.02 ? shade(f.c3[0], -0.08) : ny >= nx ? f.c3[1] : f.c3[2];
      const pts = f.pts.map(([u, v, z]) => at3(g, u, v, z));
      return { key: e0[0] + e0[1] + (nx + ny) * 0.01, h: g.poly(pts, fill, sw) + (f.extra ? f.extra(pts) : '') };
    })
    .sort((a, b) => a.key - b.key)
    .map((f) => f.h)
    .join('');
}
/** buku-buku tegak berwarna (balok kecil) */
const BOOK = ['#E0583F', '#3F7FBF', '#F2B632', '#3FA06A', '#9A6FC0', '#F2EEE3'];

/* ================================================================== */
/* Mebel Jati                                                           */
/* ================================================================== */

const MEBEL: Record<string, FurnDef> = {
  kursigoyang: {
    label: 'Kursi goyang rotan',
    colors: { main: '#D2A05A', accent: '#B5523B' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z);
      const frame = C3(shade(c.main, -0.22)), rot = C3(c.main);
      // dua kaki lengkung (goyang)
      const rocker = (v: number) => {
        const pts: Pt[] = [];
        for (let k = 0; k <= 14; k++) { const t = k / 14; pts.push(A(0.04 + 0.9 * t, v, 1.5 + 13 * ((t - 0.55) / 0.55) ** 2)); }
        return inkLine(pts, shade(c.main, -0.3), 2.6, s);
      };
      for (const v of [0.22, 0.78]) S.add(x + 0.04, y + v - 0.02, x + 0.94, y + v + 0.02, 0, 15, rocker(v));
      for (const u of [0.3, 0.68]) for (const v of [0.2, 0.74]) S.box(x + u, y + v, 2, 0.06, 0.06, 14, frame);
      S.box(x + 0.24, y + 0.2, 16, 0.56, 0.6, 4, rot);
      S.box(x + 0.3, y + 0.26, 20, 0.46, 0.48, 4, C3(c.accent));
      // sandaran miring beranyam rotan (anyaman tembus pandang: terlihat dari dua sisi)
      const pan = (p: number, q: number) => A(0.29 - 0.16 * q, 0.24 + 0.52 * p, 21 + 38 * q + 7 * Math.sin(Math.PI * p) * q);
      const outline: Pt[] = [];
      for (let k = 0; k <= 8; k++) outline.push(pan(k / 8, 0));
      for (let k = 1; k <= 8; k++) outline.push(pan(1, k / 8));
      for (let k = 1; k <= 12; k++) outline.push(pan(1 - k / 12, 1));
      for (let k = 1; k < 8; k++) outline.push(pan(0, 1 - k / 8));
      let back = g.poly(outline, g.back ? shade(c.main, -0.06) : shade(c.main, 0.22), 1.2);
      let weave = '';
      for (let k = -1; k <= 1.05; k += 0.16)
        for (const dir of [1, -1]) {
          const pts: Pt[] = [];
          for (let t = 0; t <= 10; t++) { const q = t / 10, p = k + dir * 0.55 * q; if (p >= -0.001 && p <= 1.001) pts.push(pan(Math.min(1, Math.max(0, p)), 0.04 + 0.92 * q)); }
          if (pts.length > 1) weave += `M${P(pts).replace(/ /g, 'L')}`;
        }
      back += `<path d="${weave}" fill="none" stroke="${shade(c.main, -0.22)}" stroke-width="${f1(0.9 * s)}"/>`;
      back += inkLine([...outline, outline[0]], shade(c.main, -0.12), 2, s);
      S.add(x + 0.1, y + 0.22, x + 0.3, y + 0.78, 20, 67, back);
      // sandaran tangan
      for (const v of [0.15, 0.79]) {
        S.box(x + 0.7, y + v + 0.005, 20, 0.05, 0.05, 14, frame);
        S.box(x + 0.18, y + v, 34, 0.6, 0.06, 3, rot);
      }
      return S.out();
    },
  },
  mejabelajar: {
    label: 'Meja belajar & lampu',
    colors: { main: '#B98552', accent: '#3F8F6E' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z);
      const wood = C3(c.main), dk = C3(shade(c.main, -0.2)), T = 36;
      S.box(x + 0.08, y + 0.12, 0, 0.1, 0.76, T - 4, dk);
      S.box(x + 0.18, y + 0.12, 10, 1.18, 0.04, T - 14, dk);
      // laci di sisi depan (dari belakang tidak terlihat)
      const knob = (u: number, z: number) => { const p = A(u, 0.88, z); return circ(p[0], p[1], 1.9 * s, '#F2D16B', s, 1); };
      const drawers = g.quadY(y + 0.88, x + 1.4, x + 1.86, 4, 15, shade(c.main, -0.06), 1.2) + g.quadY(y + 0.88, x + 1.4, x + 1.86, 18, 29, shade(c.main, -0.06), 1.2) + (g.back ? '' : knob(1.63, 9.5) + knob(1.63, 23.5));
      S.box(x + 1.36, y + 0.12, 0, 0.54, 0.76, T - 4, wood, drawers);
      S.box(x + 0.04, y + 0.08, T - 4, 1.92, 0.84, 4, wood);
      // rak kecil di belakang meja + buku
      S.box(x + 0.06, y + 0.08, T, 1.88, 0.06, 30, dk);
      for (const u of [0.08, 1.87]) S.box(x + u, y + 0.14, T, 0.05, 0.15, 16, dk);
      S.box(x + 0.06, y + 0.14, T + 16, 1.88, 0.15, 3, wood);
      let bu = 1.12;
      for (let i = 0; i < 9; i++) { const bw = 0.05 + ((i * 37) % 3) * 0.012, bh = 10 + ((i * 13) % 4) * 1.6; S.box(x + bu, y + 0.15, T + 19, bw, 0.12, bh, C3(BOOK[i % BOOK.length]), '', 1); bu += bw + 0.012; }
      // celengan ayam tanah liat di rak
      {
        const [px, py] = A(0.86, 0.22, T + 19);
        let h = `<path d="M${f1(px - 7 * s)} ${f1(py)}Q${f1(px - 9 * s)} ${f1(py - 9 * s)} ${f1(px - 3 * s)} ${f1(py - 10 * s)}Q${f1(px - 2 * s)} ${f1(py - 16 * s)} ${f1(px + 3 * s)} ${f1(py - 15 * s)}Q${f1(px + 6 * s)} ${f1(py - 13 * s)} ${f1(px + 4 * s)} ${f1(py - 9 * s)}Q${f1(px + 9 * s)} ${f1(py - 6 * s)} ${f1(px + 7 * s)} ${f1(py)}Z" fill="#D9874E" stroke="${INK}" stroke-width="${f1(1.1 * s)}" stroke-linejoin="round"/>`;
        h += `<path d="M${f1(px + 1 * s)} ${f1(py - 16 * s)}l${f1(1.5 * s)} ${f1(-3 * s)}l${f1(1.5 * s)} ${f1(2.4 * s)}" fill="#E0403F" stroke="${INK}" stroke-width="${f1(0.8 * s)}"/>`;
        h += `<path d="M${f1(px + 5.6 * s)} ${f1(py - 12.5 * s)}l${f1(2.6 * s)} ${f1(0.8 * s)}l${f1(-2.4 * s)} ${f1(1.2 * s)}" fill="#F2B632" stroke="${INK}" stroke-width="${f1(0.7 * s)}"/>`;
        h += `<path d="M${f1(px - 3 * s)} ${f1(py - 5 * s)}q${f1(3 * s)} ${f1(2 * s)} ${f1(6 * s)} 0" fill="none" stroke="#3FA06A" stroke-width="${f1(1.2 * s)}"/>` + circ(px + 2.6 * s, py - 13 * s, 0.8 * s, INK, s, 0);
        S.add(x + 0.78, y + 0.15, x + 0.94, y + 0.28, T + 19, T + 36, h);
      }
      // lampu belajar
      {
        const base: Pt = [0.32, 0.46];
        let h = lathe(g, x + base[0], y + base[1], [[T, 0.1], [T + 2.6, 0.1], [T + 3.4, 0.05]], c.accent);
        const j0 = A(base[0], base[1], T + 3), j1 = A(0.26, 0.44, T + 30), hd = A(0.5, 0.56, T + 40);
        h += inkLine([j0, j1, hd], shade(c.accent, -0.1), 1.8, s) + circ(j1[0], j1[1], 1.8 * s, c.accent, s, 1);
        const [hx, hy] = hd;
        h += `<ellipse cx="${f1(hx + 1 * s)}" cy="${f1(hy + 9 * s)}" rx="${f1(5 * s)}" ry="${f1(2.4 * s)}" fill="#FFF3B8"/>`;
        h += `<path d="M${f1(hx - 3.5 * s)} ${f1(hy - 3 * s)}L${f1(hx + 3.5 * s)} ${f1(hy - 3 * s)}L${f1(hx + 9 * s)} ${f1(hy + 8 * s)}Q${f1(hx + 1 * s)} ${f1(hy + 11 * s)} ${f1(hx - 7 * s)} ${f1(hy + 8 * s)}Z" fill="${c.accent}" stroke="${INK}" stroke-width="${f1(1.3 * s)}" stroke-linejoin="round"/>`;
        S.add(x + 0.2, y + 0.36, x + 0.58, y + 0.64, T, T + 46, flatE(g, x + 0.56, y + 0.62, T, 0.2, '#FFE7A0', 0, ' opacity=".55"') + h);
      }
      // buku terbuka
      {
        const pg = (u0: number, u1: number, zs: number) => g.poly([A(u0, 0.42, T + 0.6), A(u1, 0.42, T + zs), A(u1, 0.7, T + zs), A(u0, 0.7, T + 0.6)], '#FFFDF7', 1);
        let h = g.poly([A(0.72, 0.4, T + 0.3), A(1.2, 0.4, T + 0.3), A(1.2, 0.72, T + 0.3), A(0.72, 0.72, T + 0.3)], '#C0392B', 1) + pg(0.74, 0.96, 2.2) + pg(1.18, 0.96, 2.2);
        let ln = '';
        for (const v of [0.48, 0.55, 0.62]) for (const [u0, u1] of [[0.78, 0.92], [1.0, 1.14]]) { const a = A(u0, v, T + 1.4), b2 = A(u1, v, T + 1.4); ln += `M${f1(a[0])} ${f1(a[1])}L${f1(b2[0])} ${f1(b2[1])}`; }
        h += `<path d="${ln}" stroke="#9AA7B8" stroke-width="${f1(0.9 * s)}"/>`;
        S.add(x + 0.72, y + 0.4, x + 1.2, y + 0.72, T, T + 2.2, h);
      }
      // tempat pensil
      {
        const cu = x + 1.6, cv = y + 0.42, [px, py] = A(1.6, 0.42, T);
        let h = '';
        for (const [dx, col, len] of [[-2, '#F2B632', 15], [1.5, '#3F7FBF', 13], [0, '#E0583F', 17]] as [number, string, number][]) h += inkLine([[px + dx * s, py - 8 * s], [px + (dx * 1.8) * s, py - len * s]], col, 1.4, s);
        h += lathe(g, cu, cv, [[T, 0.075], [T + 10, 0.085]], '#3FA06A') + flatE(g, cu, cv, T + 10, 0.085, '#2F7F55', 1);
        S.add(x + 1.52, y + 0.34, x + 1.68, y + 0.5, T, T + 18, h);
      }
      return S.out();
    },
  },
  cermin: {
    label: 'Cermin berdiri',
    colors: { main: '#8A5A36', accent: '#BFE3F5' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), Y = y + 0.5, wood = C3(c.main);
      S.box(x + 0.1, y + 0.38, 0, 0.8, 0.24, 5, C3(shade(c.main, -0.18)));
      const pivot = (u: number) => { const p = at3(g, x + u, Y, 50); return circ(p[0], p[1], 2.6 * s, '#E9B949', s, 1); };
      for (const u of [0.13, 0.8]) S.box(x + u, Y - 0.04, 5, 0.07, 0.08, 76, wood, pivot(u + 0.035));
      // bingkai melengkung di bidang tegak; kaca hanya dari depan, dari belakang papan kayu
      const m = onY(g, Y, x + 0.5);
      const shape = (hw: number, z0: number, z1: number, ry: number) => {
        const pts: Pt[] = [m(-hw, z0), m(hw, z0)];
        for (let k = 0; k <= 14; k++) { const a = (k / 14) * Math.PI; pts.push(m(hw * Math.cos(a), z1 + ry * Math.sin(a))); }
        return pts;
      };
      let h = g.poly(shape(9.4, 9, 70, 18), g.back ? shade(c.main, -0.08) : c.main, 1.6);
      if (g.back) {
        h += g.poly(shape(7.4, 12, 70, 15), shade(c.main, 0.06), 1);
        let ln = '';
        for (const hx of [-3.7, 0, 3.7]) { const a = m(hx, 13), b = m(hx, 70 + 15 * Math.sqrt(1 - (hx / 7.4) ** 2) - 1); ln += `M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}`; }
        h += `<path d="${ln}" stroke="${shade(c.main, -0.15)}" stroke-width="${f1(1 * s)}"/>`;
      } else {
        h += g.poly(shape(7.4, 12, 70, 15), c.accent, 1.1);
        h += thinLine([m(-5, 30), m(1, 52)], '#FFFFFF', 2.4 * s, ' opacity=".75"') + thinLine([m(-1, 26), m(3.5, 40)], '#FFFFFF', 1.4 * s, ' opacity=".7"');
        h += thinLine([m(4, 60), m(5.5, 72)], '#FFFFFF', 1.4 * s, ' opacity=".6"');
      }
      S.add(x + 0.21, Y - 0.02, x + 0.79, Y + 0.02, 9, 90, h);
      return S.out();
    },
  },
  jambandul: {
    label: 'Jam bandul',
    colors: { main: '#7A4A2A', accent: '#E9B949' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), wood = C3(c.main), dk = C3(shade(c.main, -0.2)), Yt = y + 0.72, Yh = y + 0.75;
      S.box(x + 0.2, y + 0.26, 0, 0.6, 0.51, 12, dk);
      // badan: jendela bandul (bandul berayun pelan, kelas swing)
      let trunk = g.quadY(Yt, x + 0.31, x + 0.69, 17, 66, shade(c.main, -0.14), 1.2) + g.quadY(Yt, x + 0.35, x + 0.65, 21, 62, '#3B2A20', 1.1);
      if (!g.back) {
        const p0 = at3(g, x + 0.5, Yt, 60), L = 24 * s, k = 0.55;
        trunk += inkLine([at3(g, x + 0.4, Yt, 61), at3(g, x + 0.4, Yt, 40)], '#C9A13B', 0.6, s) + inkLine([at3(g, x + 0.6, Yt, 61), at3(g, x + 0.6, Yt, 44)], '#C9A13B', 0.6, s);
        for (const [u, z] of [[0.4, 40], [0.6, 44]]) { const q = at3(g, x + u, Yt, z); trunk += `<rect x="${f1(q[0] - 1.8 * s)}" y="${f1(q[1])}" width="${f1(3.6 * s)}" height="${f1(9 * s)}" rx="${f1(1 * s)}" fill="${c.accent}" stroke="${INK}" stroke-width="${f1(0.9 * s)}"/>`; }
        // ayunan dipersempit (skala x) supaya tetap di dalam jendela
        trunk += `<g transform="translate(${f1(p0[0])} ${f1(p0[1])}) scale(${k} 1)"><g class="swing" style="transform-origin:0px 0px;animation-duration:1.4s">`;
        trunk += `<line x1="0" y1="0" x2="0" y2="${f1(L)}" stroke="${c.accent}" stroke-width="${f1(1.8 * s / k)}"/>`;
        trunk += `<ellipse cx="0" cy="${f1(L + 4 * s)}" rx="${f1(5.2 * s / k)}" ry="${f1(5.2 * s)}" fill="${c.accent}" stroke="${INK}" stroke-width="${f1(1.1 * s)}"/></g></g>`;
        trunk += thinLine([at3(g, x + 0.38, Yt, 56), at3(g, x + 0.45, Yt, 34)], '#FFFFFF', 1.4 * s, ' opacity=".35"');
      }
      S.box(x + 0.26, y + 0.31, 12, 0.48, 0.41, 60, wood, trunk);
      // kepala: muka jam (hanya dari depan)
      let hood = g.quadY(Yh, x + 0.2, x + 0.8, 75, 104, shade(c.main, -0.1), 1.2);
      if (!g.back) {
        const m = onY(g, Yh, x + 0.5, 89.5);
        hood += g.poly(discPts(m, 0, 0, 9.4, 9.4, 30), c.accent, 1.3) + g.poly(discPts(m, 0, 0, 7.8, 7.8, 30), '#FFF8E6', 1);
        let ticks = '';
        for (let i = 0; i < 12; i++) { const a = (i / 12) * 2 * Math.PI, p = m(6.3 * Math.cos(a), 6.3 * Math.sin(a)); ticks += `M${f1(p[0])} ${f1(p[1])}h0.1`; }
        hood += `<path d="${ticks}" stroke="${INK}" stroke-width="${f1(1.6 * s)}" stroke-linecap="round"/>`;
        hood += thinLine([m(0, 0), m(0, 5.4)], INK, 1.5 * s) + thinLine([m(0, 0), m(3.8, -1.2)], INK, 1.2 * s);
        const ctr = m(0, 0);
        hood += circ(ctr[0], ctr[1], 1.3 * s, '#C0392B', s, 0);
      }
      S.box(x + 0.17, y + 0.28, 72, 0.66, 0.47, 34, wood, hood);
      S.box(x + 0.14, y + 0.24, 106, 0.72, 0.55, 4, dk);
      // mahkota ukir di atas (bidang tengah, terlihat dari dua sisi)
      {
        const m = onY(g, y + 0.515, x + 0.5, 110);
        const pts: Pt[] = [m(-9, 0), m(9, 0), m(9, 3)];
        for (let k = 0; k <= 10; k++) { const a = (k / 10) * Math.PI; pts.push(m(9 * Math.cos(a), 3 + 9 * Math.sin(a))); }
        let h = g.poly(pts, c.main, 1.3) + `<path d="M${P([m(-5, 3), m(0, 9), m(5, 3)]).replace(/ /g, 'L')}" fill="none" stroke="${c.accent}" stroke-width="${f1(1.2 * s)}"/>`;
        const top = m(0, 13.5);
        h += circ(top[0], top[1] - 2 * s, 2.4 * s, c.accent, s, 1);
        S.add(x + 0.22, y + 0.5, x + 0.78, y + 0.53, 110, 128, h);
      }
      return S.out();
    },
  },
  lemarikaca: {
    label: 'Lemari kaca pajangan',
    colors: { main: '#9C6B45', accent: '#D6EEF5' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), wood = C3(c.main), dk = C3(shade(c.main, -0.22)), Yl = y + 0.82, Yu = y + 0.78;
      for (const u of [0.1, w - 0.18]) for (const v of [0.26, 0.7]) S.box(x + u, y + v, 0, 0.08, 0.08, 5, dk);
      // bufet bawah: dua pintu
      let low = g.quadY(Yl, x + 0.12, x + 0.98, 9, 31, shade(c.main, -0.08), 1.2) + g.quadY(Yl, x + 1.02, x + 1.88, 9, 31, shade(c.main, -0.08), 1.2);
      low += g.quadY(Yl, x + 0.2, x + 0.9, 13, 27, shade(c.main, 0.06), 1) + g.quadY(Yl, x + 1.1, x + 1.8, 13, 27, shade(c.main, 0.06), 1);
      if (!g.back) for (const u of [0.92, 1.08]) { const p = at3(g, x + u, Yl, 20); low += circ(p[0], p[1], 2 * s, '#E9B949', s, 1); }
      S.box(x + 0.06, y + 0.22, 5, 1.88, 0.6, 30, wood, low);
      // lemari kaca atas: kaca, rak, isi pajangan (hanya dari depan)
      let up = g.quadY(Yu, x + 0.14, x + 1.86, 37, 83, shade(c.main, -0.1), 1.2);
      up += g.quadY(Yu, x + 0.18, x + 0.97, 40, 80, c.accent, 1.1) + g.quadY(Yu, x + 1.03, x + 1.82, 40, 80, c.accent, 1.1);
      if (!g.back) {
        const Yi = Yu, m = (u: number, z: number) => onY(g, Yi, x + u, z);
        up += g.quadY(Yi, x + 0.18, x + 0.97, 59, 61, shade(c.main, 0.1), 0.8) + g.quadY(Yi, x + 1.03, x + 1.82, 59, 61, shade(c.main, 0.1), 0.8);
        // rak bawah: piring berdiri & cangkir, teko
        for (const [u, col] of [[0.32, '#3F7FBF'], [0.47, '#E0583F'], [0.62, '#3FA06A']] as [number, string][]) up += g.poly(discPts(m(u, 0), 0, 50, 8, 8, 20), col, 1) + g.poly(discPts(m(u, 0), 0, 50, 5.8, 5.8, 20), '#FFFDF7', 0.7);
        for (const u of [0.78, 0.88]) { const q = m(u, 41); up += g.poly([q(-2.8, 0), q(2.8, 0), q(3.4, 8), q(-3.4, 8)], '#FFFDF7', 0.9) + thinLine([q(3.2, 6.5), q(5.4, 5.5), q(5, 2.4), q(3, 2)], INK, 1 * s); }
        {
          const q = m(1.3, 41);
          up += g.poly([q(-6, 2), q(-7, 7), q(-5, 11), q(5, 11), q(7, 7), q(6, 2), q(4, 0), q(-4, 0)], '#FFFDF7', 1);
          up += thinLine([q(6.6, 8), q(10, 11), q(11.5, 13)], INK, 1.4 * s) + thinLine([q(-6.6, 9), q(-9, 8), q(-9, 4), q(-6.6, 3)], INK, 1.1 * s);
          up += g.poly([q(-3, 11), q(3, 11), q(1.5, 13.5), q(-1.5, 13.5)], '#3F7FBF', 0.8) + thinLine([q(-5, 5.5), q(5, 5.5)], '#3F7FBF', 1.4 * s);
        }
        for (const [u, col] of [[1.55, '#9A6FC0'], [1.7, '#F2B632']] as [number, string][]) up += g.poly(discPts(m(u, 0), 0, 50, 7.4, 7.4, 20), col, 1) + g.poly(discPts(m(u, 0), 0, 50, 5, 5, 20), '#FFFDF7', 0.7);
        // rak atas: gelas berkaki, toples kue, ayam jago keramik
        for (const u of [0.3, 0.42, 0.54]) { const q = m(u, 61); up += g.poly([q(-0.7, 0), q(0.7, 0), q(0.7, 5), q(3, 9), q(3.6, 15), q(-3.6, 15), q(-3, 9), q(-0.7, 5)], '#EAF6FA', 0.9) + thinLine([q(-3, 0.2), q(3, 0.2)], INK, 1 * s); }
        {
          const q = m(0.8, 61);
          up += g.poly([q(-6, 0), q(6, 0), q(6.6, 12), q(-6.6, 12)], '#F4F0E4', 1) + g.poly([q(-6.6, 12), q(6.6, 12), q(5.2, 15), q(-5.2, 15)], '#C0392B', 0.9);
          for (const [a, b] of [[-3, 4], [2.5, 4.5], [0, 8]]) { const p = q(a, b); up += circ(p[0], p[1], 2.2 * s, '#E3A84A', s, 0.7); }
        }
        {
          const q = m(1.45, 61);
          up += g.poly([q(-6, 0), q(6, 0), q(5, 5), q(7, 10), q(4, 9), q(2, 13), q(3, 17), q(0, 16), q(-1, 12), q(-5, 9)], '#FFFDF7', 1);
          up += g.poly([q(0, 16), q(1.5, 19), q(3, 17)], '#E0403F', 0.7) + g.poly([q(5, 5), q(9, 11), q(7, 10)], '#3FA06A', 0.7);
          up += thinLine([q(-4, 3), q(4, 3)], '#3F7FBF', 1.2 * s);
        }
        up += g.poly(discPts(m(1.66, 61), 0, 6, 4.2, 4.2, 16), '#E3A84A', 0.9) + thinLine([m(1.66, 61)(0, 10), m(1.66, 61)(0, 17)], '#8A5A36', 1.2 * s);
        // kilau kaca
        for (const u of [0.24, 1.09]) up += thinLine([m(u, 44)(0, 0), m(u + 0.18, 76)(0, 0)], '#FFFFFF', 2 * s, ' opacity=".55"') + thinLine([m(u + 0.1, 44)(0, 0), m(u + 0.2, 62)(0, 0)], '#FFFFFF', 1.2 * s, ' opacity=".45"');
      }
      up += g.quadY(Yu, x + 0.97, x + 1.03, 40, 80, shade(c.main, -0.1), 1);
      S.box(x + 0.1, y + 0.26, 35, 1.8, 0.52, 50, wood, up);
      S.box(x + 0.04, y + 0.2, 85, 1.92, 0.64, 4, dk);
      // di atas: renda, vas bunga, toples nastar
      {
        const cu = x + 1.5, cv = y + 0.5, [px, py] = at3(g, cu, cv, 89);
        let h = flatE(g, cu, cv, 89, 0.2, '#FFFDF7', 0.9);
        h += lathe(g, cu, cv, [[89, 0.07], [92, 0.12], [98, 0.12], [104, 0.06], [106, 0.07]], '#3F7FBF') + frontArc(g, cu, cv, 95, 0.12, '#FFFDF7', 1.4);
        for (const [dx, dy, col] of [[-5, -12, '#E0583F'], [4, -14, '#F7C548'], [0, -18, '#FF8FA3'], [7, -8, '#E0583F']] as [number, number, string][]) {
          h += thinLine([[px, py - 17 * s], [px + dx * s, py + (dy - 9) * s]], '#3FA06A', 1.2 * s);
          h += circ(px + dx * s, py + (dy - 10) * s, 2.8 * s, col, s, 1);
        }
        S.add(cu - 0.2, cv - 0.2, cu + 0.2, cv + 0.2, 89, 120, h);
      }
      {
        const cu = x + 0.48, cv = y + 0.5;
        let h = lathe(g, cu, cv, [[89, 0.1], [99, 0.11], [101, 0.08]], '#F2F5EE');
        const [px, py] = at3(g, cu, cv, 89);
        for (const [dx, dy] of [[-3, 4], [2.5, 5], [0, 7.5]]) h += circ(px + dx * s, py - dy * s, 2.1 * s, '#E3A84A', s, 0.7);
        h += flatE(g, cu, cv, 101, 0.085, '#E0583F', 1) + lathe(g, cu, cv, [[101, 0.03], [104, 0.03]], '#E0583F', 1);
        S.add(cu - 0.12, cv - 0.12, cu + 0.12, cv + 0.12, 89, 106, h);
      }
      return S.out();
    },
  },
  kipasangin: {
    label: 'Kipas angin berdiri',
    colors: { main: '#3F8FBF', accent: '#CDEBF7' },
    draw(g, x, y, w, d, c) {
      const s = g.s, cu = x + 0.5, cv = y + 0.5, [cx, cy] = g.iso(cu, cv), k = rk(g);
      let o = shadowE(cx, cy, 0.3 * k, 0.15 * k);
      o += lathe(g, cu, cv, [[0, 0.27], [3, 0.28], [6, 0.22], [7.5, 0.1]], c.main);
      if (!g.back) for (const [i, col] of [[-1, '#3FA06A'], [0, '#F2B632'], [1, '#E0583F']] as [number, string][]) o += `<rect x="${f1(cx + i * 5 * s - 1.8 * s)}" y="${f1(cy - 4.2 * s)}" width="${f1(3.6 * s)}" height="${f1(2.2 * s)}" rx="${f1(0.6 * s)}" fill="${col}" stroke="${INK}" stroke-width="${f1(0.7 * s)}"/>`;
      o += inkLine([[cx, cy - 7 * s], [cx, cy - 62 * s]], '#C9CED6', 2.6, s);
      o += `<rect x="${f1(cx - 3.2 * s)}" y="${f1(cy - 68 * s)}" width="${f1(6.4 * s)}" height="${f1(8 * s)}" rx="${f1(1.6 * s)}" fill="${c.main}" stroke="${INK}" stroke-width="${f1(1.2 * s)}"/>`;
      const hx = cx, hy = cy - 82 * s, R = 21 * s;
      const motor = (front: boolean) => {
        const mx = hx + (front ? 2 : 0) * s, my = hy + (front ? -1 : 2) * s;
        let m = `<rect x="${f1(mx - 10 * s)}" y="${f1(my - 9 * s)}" width="${f1(20 * s)}" height="${f1(19 * s)}" rx="${f1(8 * s)}" fill="${c.main}" stroke="${INK}" stroke-width="${f1(1.5 * s)}"/>`;
        if (!front) return m;
        // dari belakang: kisi motor & tombol putar di atasnya
        for (const dy of [-3, 0, 3]) m += thinLine([[mx - 5 * s, my + dy * s], [mx + 5 * s, my + dy * s]], shade(c.main, -0.35), 1.2 * s);
        return m + `<rect x="${f1(mx - 2 * s)}" y="${f1(my - 14 * s)}" width="${f1(4 * s)}" height="${f1(6 * s)}" rx="${f1(1.2 * s)}" fill="#3B3F55" stroke="${INK}" stroke-width="${f1(1 * s)}"/>`;
      };
      if (!g.back) o += motor(false);
      // baling-baling berputar pelan (kelas swim)
      let blades = '';
      for (const a of [0, 120, 240]) blades += `<path transform="rotate(${a})" d="M0 0C${f1(R * 0.18)} ${f1(-R * 0.4)} ${f1(R * 0.72)} ${f1(-R * 0.5)} ${f1(R * 0.82)} ${f1(-R * 0.1)}C${f1(R * 0.72)} ${f1(R * 0.2)} ${f1(R * 0.3)} ${f1(R * 0.14)} 0 0Z" fill="${g.back ? shade(c.accent, -0.18) : c.accent}" stroke="${INK}" stroke-width="${f1(1.1 * s)}" stroke-linejoin="round"/>`;
      o += `<g transform="translate(${f1(hx)} ${f1(hy)})"><g class="swim" style="transform-origin:0px 0px">${blades}</g></g>`;
      // kisi pelindung
      let spokes = '';
      for (let i = 0; i < 16; i++) { const a = (i / 16) * 2 * Math.PI; spokes += `M${f1(hx + Math.cos(a) * R * 0.2)} ${f1(hy + Math.sin(a) * R * 0.2)}L${f1(hx + Math.cos(a) * R)} ${f1(hy + Math.sin(a) * R)}`; }
      o += `<path d="${spokes}" stroke="#8C96A8" stroke-width="${f1(0.8 * s)}"/>`;
      o += `<circle cx="${f1(hx)}" cy="${f1(hy)}" r="${f1(R * 0.62)}" fill="none" stroke="#8C96A8" stroke-width="${f1(0.9 * s)}"/>`;
      o += `<circle cx="${f1(hx)}" cy="${f1(hy)}" r="${f1(R)}" fill="none" stroke="${INK}" stroke-width="${f1(3 * s)}"/><circle cx="${f1(hx)}" cy="${f1(hy)}" r="${f1(R)}" fill="none" stroke="#DDE3EA" stroke-width="${f1(1.3 * s)}"/>`;
      if (g.back) o += motor(true);
      else o += circ(hx, hy, 4.6 * s, c.main, s, 1.2) + circ(hx - 1.4 * s, hy - 1.4 * s, 1.2 * s, '#FFFFFF', s, 0, ' opacity=".8"');
      return o;
    },
  },
  radiotua: {
    label: 'Radio tua di meja kecil',
    colors: { main: '#8A5A36', accent: '#F2C14E' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z), T = 22, tab = C3('#C49A64'), legc = C3(shade('#C49A64', -0.22));
      for (const u of [0.16, 0.78]) for (const v of [0.18, 0.78]) S.box(x + u, y + v, 0, 0.06, 0.06, T, legc);
      S.box(x + 0.16, y + 0.18, 6, 0.68, 0.66, 2, tab);
      // kaset di rak bawah
      S.box(x + 0.3, y + 0.34, 8, 0.26, 0.17, 2.4, C3('#3B3F55'), '', 1);
      S.box(x + 0.32, y + 0.36, 10.4, 0.26, 0.17, 2.4, C3('#E0583F'), '', 1);
      S.box(x + 0.12, y + 0.14, T, 0.76, 0.74, 4, tab);
      // badan radio kayu
      const Yr = y + 0.68, Z = T + 4;
      let front = g.quadY(Yr, x + 0.23, x + 0.77, Z + 3, Z + 25, shade(c.main, -0.12), 1.1);
      front += g.quadY(Yr, x + 0.26, x + 0.5, Z + 6, Z + 22, '#E9DDBF', 1) + g.quadY(Yr, x + 0.54, x + 0.74, Z + 15, Z + 22, c.accent, 1);
      if (!g.back) {
        let ln = '';
        for (let u = 0.3; u < 0.48; u += 0.035) { const a = A(u, 0.68, Z + 7), b = A(u, 0.68, Z + 21); ln += `M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}`; }
        for (let u = 0.57; u < 0.73; u += 0.03) { const a = A(u, 0.68, Z + 16), b = A(u, 0.68, Z + 18); ln += `M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}`; }
        front += `<path d="${ln}" stroke="${shade(c.main, -0.3)}" stroke-width="${f1(0.9 * s)}"/>` + thinLine([A(0.63, 0.68, Z + 15.5), A(0.63, 0.68, Z + 21.5)], '#C0392B', 1.4 * s);
        for (const u of [0.58, 0.7]) { const p = A(u, 0.68, Z + 9.5); front += circ(p[0], p[1], 2.6 * s, '#3B2A20', s, 1) + circ(p[0] - 0.6 * s, p[1] - 0.6 * s, 0.9 * s, '#C9A13B', s, 0); }
      } else {
        // dari belakang: celah udara di papan belakang
        let ln = '';
        for (let u = 0.3; u < 0.72; u += 0.06) { const a = A(u, 0.34, Z + 8), b = A(u, 0.34, Z + 20); ln += `M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}`; }
        front += `<path d="${ln}" stroke="#3B2A20" stroke-width="${f1(1.6 * s)}" stroke-linecap="round"/>`;
      }
      S.box(x + 0.2, y + 0.34, Z, 0.6, 0.34, 28, C3(c.main), front);
      // pegangan & antena
      {
        const pts: Pt[] = [];
        for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push(A(0.38 + 0.24 * t, 0.51, Z + 28 + 5 * Math.sin(Math.PI * t))); }
        S.add(x + 0.34, y + 0.49, x + 0.66, y + 0.53, Z + 28, Z + 36, inkLine(pts, '#6B4428', 1.1, s));
        const a0 = A(0.74, 0.42, Z + 28), a1 = A(0.92, 0.34, Z + 58);
        S.add(x + 0.72, y + 0.32, x + 0.94, y + 0.44, Z + 28, Z + 60, thinLine([a0, a1], '#9AA7B8', 1.6 * s) + circ(a1[0], a1[1], 1.8 * s, '#C9CED6', s, 0.9));
      }
      return S.out();
    },
  },
  dipan: {
    label: 'Dipan kayu & tikar',
    colors: { main: '#A86E3F', accent: '#E3C27A' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z), wood = C3(c.main), dk = C3(shade(c.main, -0.2)), Z = 20;
      for (const u of [0.06, w - 0.16]) for (const v of [0.08, d - 0.18]) S.box(x + u, y + v, 0, 0.1, 0.1, 12, dk);
      S.box(x + 0.04, y + 0.06, 12, w - 0.08, d - 0.12, 8, wood);
      // tikar pandan beranyam
      let weave = '';
      const seg = (a: Pt, b: Pt) => `M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}`;
      for (let u = 0.22; u < w - 0.12; u += 0.11) weave += seg(A(u, 0.12, Z + 1.5), A(u, d - 0.12, Z + 1.5));
      for (let v = 0.2; v < d - 0.12; v += 0.11) weave += seg(A(0.14, v, Z + 1.5), A(w - 0.12, v, Z + 1.5));
      let mat = `<path d="${weave}" stroke="${shade(c.accent, -0.2)}" stroke-width="${f1(0.8 * s)}"/>`;
      mat += thinLine([A(w - 0.24, 0.12, Z + 1.5), A(w - 0.24, d - 0.12, Z + 1.5)], '#C0392B', 2 * s) + thinLine([A(w - 0.3, 0.12, Z + 1.5), A(w - 0.3, d - 0.12, Z + 1.5)], '#3FA06A', 1.4 * s);
      S.box(x + 0.12, y + 0.1, Z, w - 0.22, d - 0.2, 1.5, C3(c.accent), mat);
      // sandaran kepala berukir di ujung kiri, sandaran kaki rendah
      const carve = g.quadX(x + 0.14, y + 0.18, y + d - 0.18, 24, 46, shade(c.main, -0.1), 1.1);
      let crest = '';
      {
        const m = onX(g, x + 0.09, y + d / 2, 52);
        const pts: Pt[] = [m(-13, 0), m(13, 0)];
        for (let k = 0; k <= 12; k++) { const a = (k / 12) * Math.PI; pts.push(m(13 * Math.cos(a), 6 * Math.sin(a))); }
        crest = g.poly(pts, c.main, 1.3);
        const top = m(0, 6);
        crest += circ(top[0], top[1] - 1.6 * s, 2 * s, '#E9B949', s, 0.9);
      }
      S.box(x + 0.04, y + 0.06, 12, 0.1, d - 0.12, 40, wood, carve + crest);
      S.box(x + w - 0.14, y + 0.06, 12, 0.1, d - 0.12, 18, wood);
      // bantal & guling
      for (const v of [0.16, 0.52]) S.box(x + 0.2, y + v, Z + 1.5, 0.32, 0.32, 5, C3('#FFFDF7'), '', 1.3);
      {
        const u0 = 0.66, u1 = 1.32, v0 = 0.76, r = 5.5, zc = Z + 1.5 + r;
        const pt = (u: number, a: number) => A(u, v0 + (r * Math.cos(a)) / 32, zc + r * Math.sin(a));
        const all: Pt[] = [];
        for (let i = 0; i <= 8; i++) for (let j = 0; j < 16; j++) all.push(pt(u0 + ((u1 - u0) * i) / 8, (j / 16) * 2 * Math.PI));
        let h = g.poly(hull(all), '#F4E9F0', 1.3);
        const vis = (a: number) => (g.back ? -Math.cos(a) : Math.cos(a)) + Math.sin(a) > -0.05;
        for (const u of [u0 + 0.08, u1 - 0.08]) { const arc: Pt[] = []; for (let j = 0; j <= 24; j++) { const a = (j / 24) * 2 * Math.PI; if (vis(a)) arc.push(pt(u, a)); } h += thinLine(arc, '#E07A8C', 1.6 * s); }
        const end = g.back ? u0 : u1;
        h += g.poly(Array.from({ length: 16 }, (_, j) => pt(end, (j / 16) * 2 * Math.PI)), '#EBD6E2', 1);
        S.add(x + u0, y + v0 - 0.18, x + u1, y + v0 + 0.18, Z + 1.5, Z + 13, h);
      }
      // kain batik terlipat di kaki dipan
      {
        let bat = '';
        for (let t = 0.02; t < 0.28; t += 0.07) bat += `M${f1(A(1.48 + t, 0.24, Z + 5.5)[0])} ${f1(A(1.48 + t, 0.24, Z + 5.5)[1])}L${f1(A(1.48 + t + 0.05, 0.76, Z + 5.5)[0])} ${f1(A(1.48 + t + 0.05, 0.76, Z + 5.5)[1])}`;
        S.box(x + 1.46, y + 0.22, Z + 1.5, 0.32, 0.56, 4, C3('#8A5A3A'), `<path d="${bat}" stroke="#F2D9A6" stroke-width="${f1(1.4 * s)}" stroke-dasharray="${f1(3 * s)} ${f1(2 * s)}"/>`, 1.2);
      }
      return S.out();
    },
  },
};

/* ================================================================== */
/* Toko Bangunan: benda halaman                                         */
/* ================================================================== */

const BANGUNAN: Record<string, FurnDef> = {
  saung: {
    label: 'Saung bambu',
    colors: { main: '#D9B26A', accent: '#9A7448' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z), bam = C3(c.main), bamDk = C3(shade(c.main, -0.24));
      const P0 = 0.12, P1 = 1.72, Z = 16, cm = (P0 + P1) / 2;
      for (const u of [P0, cm - 0.05, P1 - 0.1]) for (const v of [P0, cm - 0.05, P1 - 0.1]) S.box(x + u, y + v, 0, 0.1, 0.1, Z - 4, bamDk);
      // lantai bilah bambu (palupuh)
      let slats = '';
      for (let v = P0 + 0.08; v < P1 - 0.02; v += 0.1) { const a = A(P0 + 0.02, v, Z), b = A(P1 - 0.02, v, Z); slats += `M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}`; }
      S.box(x + P0, y + P0, Z - 4, P1 - P0, P1 - P0, 4, bam, `<path d="${slats}" stroke="${shade(c.main, -0.26)}" stroke-width="${f1(0.9 * s)}"/>`);
      // batu undakan di depan
      S.box(x + 0.62, y + P1 + 0.03, 0, 0.56, 0.2, 7, C3('#B9B3A4'));
      // pagar rendah di dua sisi belakang
      for (const t of [0.5, 0.92, 1.34]) { S.box(x + P0 + t, y + P0 + 0.015, Z, 0.07, 0.07, 18, bam, '', 1); S.box(x + P0 + 0.015, y + P0 + t, Z, 0.07, 0.07, 18, bam, '', 1); }
      S.box(x + P0 + 0.1, y + P0 + 0.01, Z + 18, P1 - P0 - 0.2, 0.08, 3, bam, '', 1.1);
      S.box(x + P0 + 0.01, y + P0 + 0.1, Z + 18, 0.08, P1 - P0 - 0.2, 3, bam, '', 1.1);
      // tiang bambu beruas; caping tergantung di tiang kanan
      for (const [u, v] of [[P0, P0], [P1 - 0.1, P0], [P0, P1 - 0.1], [P1 - 0.1, P1 - 0.1]]) {
        let nodes = '';
        for (const z of [Z + 22, Z + 46]) nodes += prism(g, rect(x + u - 0.008, y + v - 0.008, 0.116, 0.116), z, 2, bamDk, 1);
        if (u > 1 && v < 1) {
          const [px, py] = A(u + 0.05, v + 0.13, Z + 42);
          nodes += thinLine([[px, py - 2 * s], [px, py - 6 * s]], INK, 1 * s);
          nodes += `<path d="M${f1(px - 11 * s)} ${f1(py + 5 * s)}L${f1(px)} ${f1(py - 5 * s)}L${f1(px + 11 * s)} ${f1(py + 5 * s)}Q${f1(px)} ${f1(py + 8 * s)} ${f1(px - 11 * s)} ${f1(py + 5 * s)}Z" fill="#E9C46A" stroke="${INK}" stroke-width="${f1(1.2 * s)}" stroke-linejoin="round"/>`;
          nodes += `<path d="M${f1(px - 6 * s)} ${f1(py)}L${f1(px + 6 * s)} ${f1(py)}M${f1(px - 3 * s)} ${f1(py - 3 * s)}L${f1(px + 3 * s)} ${f1(py - 3 * s)}" stroke="#B08A4A" stroke-width="${f1(0.8 * s)}"/>`;
        }
        S.box(x + u, y + v, Z, 0.1, 0.1, 66, bam, nodes);
      }
      // atap ijuk limasan (tembus pandang bila ada pet di belakangnya: kelas canopy)
      {
        const R0 = -0.06, R1 = 1.9, ze = 82, za = 128, ap = [cm, cm, za];
        const ij = C3(c.accent);
        let roof = prism(g, rect(x + R0, y + R0, R1 - R0, R1 - R0), ze - 4, 4, C3(shade(c.accent, -0.1)), 1.4);
        const E = [[R0, R0], [R1, R0], [R1, R1], [R0, R1]].map(([u, v]) => [x + u, y + v, ze]);
        const normals: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
        const thatch = (pts: Pt[]) => {
          const [a, b, t] = pts;
          let l = '';
          for (let k = 1; k < 9; k++) { const f = k / 9, e = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; l += `M${f1(t[0] + (e[0] - t[0]) * 0.15)} ${f1(t[1] + (e[1] - t[1]) * 0.15)}L${f1(e[0])} ${f1(e[1] - 1.5 * s)}`; }
          // dua lapis rumbia (garis sejajar tepi atap)
          let band = '';
          for (const f of [0.36, 0.68]) band += `M${f1(a[0] + (t[0] - a[0]) * f)} ${f1(a[1] + (t[1] - a[1]) * f)}L${f1(b[0] + (t[0] - b[0]) * f)} ${f1(b[1] + (t[1] - b[1]) * f)}`;
          return `<path d="${l}" stroke="${shade(c.accent, -0.3)}" stroke-width="${f1(0.9 * s)}"/><path d="${band}" stroke="${shade(c.accent, -0.45)}" stroke-width="${f1(1.4 * s)}"/>`;
        };
        roof += faces(g, E.map((p, i) => ({ pts: [p, E[(i + 1) % 4], [x + ap[0], y + ap[1], za]], n: normals[i], c3: ij, extra: thatch })), 1.6);
        const [tx, ty] = A(cm, cm, za);
        roof += `<path d="M${f1(tx - 4 * s)} ${f1(ty + 3 * s)}L${f1(tx)} ${f1(ty - 8 * s)}L${f1(tx + 4 * s)} ${f1(ty + 3 * s)}Z" fill="${c.main}" stroke="${INK}" stroke-width="${f1(1.2 * s)}" stroke-linejoin="round"/>`;
        S.add(x + R0, y + R0, x + R1, y + R1, ze - 4, za + 8, `<g class="canopy">${roof}</g>`);
      }
      return S.out();
    },
  },
  sumur: {
    label: 'Sumur timba',
    colors: { main: '#B9B3A4', accent: '#9C6B45' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), cu = x + 0.5, cv = y + 0.5, H = 28, wood = C3(c.accent), A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z);
      {
        const t = ovalTub(g, cu, cv, 0.36, 0.36, 0, H, C3(c.main));
        let h = shadowE(...(g.iso(cu, cv) as [number, number]), 0.42 * rk(g), 0.21 * rk(g)) + t.side;
        // susunan batu bata di dinding sumur
        let ln = '';
        const rings = [0, 9.5, 19, H];
        for (let r = 1; r < 3; r++) { const ring = t.ring(rings[r]); ln += `M${P(t.arc.map((i) => ring[i])).replace(/ /g, 'L')}`; }
        for (let r = 0; r < 3; r++) {
          const lo = t.ring(rings[r]), hi = t.ring(rings[r + 1]);
          t.arc.forEach((i, k) => { if ((k + r * 2) % 5 === 2) ln += `M${f1(lo[i][0])} ${f1(lo[i][1])}L${f1(hi[i][0])} ${f1(hi[i][1])}`; });
        }
        h += `<path d="${ln}" fill="none" stroke="${shade(c.main, -0.3)}" stroke-width="${f1(1 * s)}"/>`;
        h += t.top + flatE(g, cu, cv, H, 0.28, '#2B2F4A', 1.2) + flatE(g, cu, cv, H - 0.5, 0.22, '#3F6F8F', 0);
        const [px, py] = at3(g, cu, cv, H);
        h += `<ellipse cx="${f1(px - 3 * s)}" cy="${f1(py)}" rx="${f1(4 * s)}" ry="${f1(1.2 * s)}" fill="#FFFFFF" opacity=".5"/>`;
        // lumut di kaki sumur
        for (const a of [0.6, 1.9, 2.6]) { const p = at3(g, cu + 0.36 * Math.cos(a), cv + 0.36 * Math.sin(a), 1); h += `<ellipse cx="${f1(p[0])}" cy="${f1(p[1])}" rx="${f1(4 * s)}" ry="${f1(2 * s)}" fill="#6DA05A"/>`; }
        S.add(cu - 0.36, cv - 0.36, cu + 0.36, cv + 0.36, 0, H, h);
      }
      for (const u of [0.03, 0.89]) S.box(x + u, y + 0.46, 0, 0.08, 0.08, 84, wood);
      S.box(x + 0.01, y + 0.46, 84, 0.98, 0.08, 4, wood);
      // kerekan, tali, timba yang menggantung
      {
        const m = onY(g, y + 0.5, cu, 74);
        let h = thinLine([A(0.46, 0.5, 84), m(-1.5, 2)], INK, 1.2 * s) + thinLine([A(0.54, 0.5, 84), m(1.5, 2)], INK, 1.2 * s);
        const rope = A(0.5 - 5.5 / 32, 0.5, 74), b0 = A(0.5 - 5.5 / 32, 0.5, 52);
        h += thinLine([rope, b0], '#C8A06A', 1.4 * s);
        h += thinLine([A(0.5 + 5.5 / 32, 0.5, 74), A(0.88, 0.5, 40)], '#C8A06A', 1.4 * s);
        h += g.poly(discPts(m, 0, 0, 6.5, 6.5, 18), '#8C96A8', 1.2) + g.poly(discPts(m, 0, 0, 2, 2, 10), '#3B3F55', 0.8);
        const bu = 0.5 - 5.5 / 32;
        h += lathe(g, x + bu, cv, [[38, 0.085], [50, 0.115]], '#9AA7B8') + frontArc(g, x + bu, cv, 44, 0.1, '#7D8899', 1.2) + flatE(g, x + bu, cv, 50, 0.115, '#5E6878', 1.1);
        const [qx, qy] = A(bu, 0.5, 50);
        h += `<path d="M${f1(qx - 0.115 * rk(g))} ${f1(qy)}Q${f1(qx)} ${f1(qy - 6 * s)} ${f1(qx + 0.115 * rk(g))} ${f1(qy)}" fill="none" stroke="${INK}" stroke-width="${f1(1.2 * s)}"/>`;
        S.add(x + 0.3, y + 0.38, x + 0.62, y + 0.62, 36, 84, h);
      }
      // atap genteng pelana
      {
        const z0 = 88, zr = 104, u0 = x - 0.05, u1 = x + 1.05, va = y + 0.14, vb = y + 0.86, vm = y + 0.5;
        const gen = C3('#C8653C'), woodF = C3(shade(c.accent, 0.1));
        const tiles = (pts: Pt[]) => {
          const [a, b, cc, dd] = pts;
          let l = '';
          for (let k = 1; k < 4; k++) { const f = k / 4; l += `M${f1(a[0] + (dd[0] - a[0]) * f)} ${f1(a[1] + (dd[1] - a[1]) * f)}L${f1(b[0] + (cc[0] - b[0]) * f)} ${f1(b[1] + (cc[1] - b[1]) * f)}`; }
          for (let k = 1; k < 8; k++) { const f = k / 8; l += `M${f1(a[0] + (b[0] - a[0]) * f)} ${f1(a[1] + (b[1] - a[1]) * f)}L${f1(dd[0] + (cc[0] - dd[0]) * f)} ${f1(dd[1] + (cc[1] - dd[1]) * f)}`; }
          return `<path d="${l}" stroke="${shade('#C8653C', -0.3)}" stroke-width="${f1(0.9 * s)}"/>`;
        };
        let h = faces(g, [
          { pts: [[u0, vm, zr], [u1, vm, zr], [u1, va, z0], [u0, va, z0]], n: [0, -1], c3: gen, extra: tiles },
          { pts: [[u0, vm, zr], [u1, vm, zr], [u1, vb, z0], [u0, vb, z0]], n: [0, 1], c3: gen, extra: tiles },
          { pts: [[u0 + 0.04, va + 0.02, z0], [u0 + 0.04, vb - 0.02, z0], [u0 + 0.04, vm, zr - 2]], n: [-1, 0], c3: woodF },
          { pts: [[u1 - 0.04, va + 0.02, z0], [u1 - 0.04, vb - 0.02, z0], [u1 - 0.04, vm, zr - 2]], n: [1, 0], c3: woodF },
        ]);
        h += inkLine([A(-0.07, 0.5, zr + 1), A(1.07, 0.5, zr + 1)], '#A8502E', 2.4, s);
        S.add(u0, va, u1, vb, z0, zr + 2, h);
      }
      return S.out();
    },
  },
  kolamikan: {
    label: 'Kolam ikan & pancuran bambu',
    colors: { main: '#A9A39A', accent: '#3E8FB5' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), cu = x + w / 2, cv = y + d / 2, H = 10, k = rk(g), A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z);
      const sup = (hx: number, hy: number, n = 40) => Array.from({ length: n }, (_, i) => { const a = (i / n) * 2 * Math.PI, co = Math.cos(a), si = Math.sin(a); return [cu + hx * Math.sign(co) * Math.abs(co) ** 0.5, cv + hy * Math.sign(si) * Math.abs(si) ** 0.5]; });
      const hx = w / 2 - 0.14, hy = d / 2 - 0.14;
      {
        const rim = sup(hx, hy);
        const [cx, cy] = g.iso(cu, cv);
        let h = shadowE(cx, cy + 2 * s, hx * k * 1.05, hy * k * 0.55);
        h += prism(g, rim, 0, H, C3(c.main));
        // batu tempel di sisi depan bibir kolam
        const lo = rim.map(([u, v]) => at3(g, u, v, 0)), mid = rim.map(([u, v]) => at3(g, u, v, H / 2)), hi = rim.map(([u, v]) => at3(g, u, v, H));
        let ln = '';
        const ccy = at3(g, cu, cv, 0)[1];
        rim.forEach((_, i) => {
          const j = (i + 1) % rim.length;
          if (lo[i][1] < ccy - 1 || lo[j][1] < ccy - 1) return;
          ln += `M${f1(mid[i][0])} ${f1(mid[i][1])}L${f1(mid[j][0])} ${f1(mid[j][1])}`;
          ln += i % 2 ? `M${f1(lo[i][0])} ${f1(lo[i][1])}L${f1(mid[i][0])} ${f1(mid[i][1])}` : `M${f1(mid[i][0])} ${f1(mid[i][1])}L${f1(hi[i][0])} ${f1(hi[i][1])}`;
        });
        h += `<path d="${ln}" stroke="${shade(c.main, -0.3)}" stroke-width="${f1(0.9 * s)}"/>`;
        // air (lubang kolam), dinding dalam yang jauh terlihat
        const inner = sup(hx - 0.16, hy - 0.16).map(([u, v]) => at3(g, u, v, H));
        h += g.poly(inner, c.accent, 1.2);
        let iL = 0, iR = 0;
        inner.forEach((p, i) => { if (p[0] < inner[iL][0]) iL = i; if (p[0] > inner[iR][0]) iR = i; });
        const walk = (a: number, b: number, dir: number) => { const out = [a]; for (let i = a; i !== b; ) { i = (i + dir + inner.length) % inner.length; out.push(i); } return out; };
        let back = walk(iL, iR, 1);
        if (back.reduce((t, i) => t + inner[i][1], 0) / back.length > ccy - H * s) back = walk(iL, iR, -1);
        const band = [...back.map((i) => inner[i]), ...back.slice().reverse().map((i) => [inner[i][0], inner[i][1] + 4 * s])];
        h += g.poly(band, shade(c.main, -0.32), 0) + thinLine(back.map((i) => inner[i]), INK, 1.2 * s);
        // pinggir: lempeng batu
        let cap = '';
        const out = rim.map(([u, v]) => at3(g, u, v, H));
        for (let i = 0; i < rim.length; i += 3) cap += `M${f1(out[i][0])} ${f1(out[i][1])}L${f1(inner[i][0])} ${f1(inner[i][1])}`;
        h += `<path d="${cap}" stroke="${shade(c.main, -0.22)}" stroke-width="${f1(0.9 * s)}"/>`;
        // riak, daun teratai, bunga, ikan mas berenang (kelas swim)
        const W = (a: number, b: number) => at3(g, cu + a * (hx - 0.2), cv + b * (hy - 0.2), H);
        for (const [a, b] of [[-0.2, 0.35], [0.4, -0.1]]) { const p = W(a, b); h += `<path d="M${f1(p[0] - 7 * s)} ${f1(p[1])}q${f1(7 * s)} ${f1(3 * s)} ${f1(14 * s)} 0" fill="none" stroke="#FFFFFF" stroke-width="${f1(1.3 * s)}" opacity=".75"/>`; }
        const [wx, wy] = at3(g, cu, cv, H);
        const fish = (col: string) => `<g><ellipse rx="${f1(7 * s)}" ry="${f1(3.4 * s)}" fill="${col}" stroke="${INK}" stroke-width="${f1(1 * s)}"/><path d="M${f1(-6 * s)} 0l${f1(-6 * s)} ${f1(-4 * s)}v${f1(8 * s)}Z" fill="${col}" stroke="${INK}" stroke-width="${f1(1 * s)}" stroke-linejoin="round"/><circle cx="${f1(3 * s)}" cy="${f1(-0.8 * s)}" r="${f1(0.9 * s)}" fill="${INK}"/></g>`;
        const R = Math.min(hx, hy) * k * 0.42;
        h += `<g transform="translate(${f1(wx)} ${f1(wy)}) scale(1 .5)"><g class="swim" style="transform-origin:0px 0px">`;
        h += `<g transform="translate(${f1(R)} 0) rotate(90)">${fish('#F2994A')}</g><g transform="translate(${f1(-R * 0.7)} ${f1(R * 0.7)}) rotate(-45)">${fish('#E0583F')}</g><g transform="translate(${f1(-R * 0.4)} ${f1(-R * 0.9)}) rotate(205)">${fish('#F7C548')}</g></g></g>`;
        for (const [a, b, r] of [[-0.5, -0.25, 9], [0.45, 0.4, 8], [0.05, 0.55, 6.5]]) { const p = W(a, b); h += `<path d="M${f1(p[0])} ${f1(p[1])}l${f1(r * s)} ${f1(-1.6 * s)}a${f1(r * s)} ${f1(r * s * 0.5)} 0 1 1 0 ${f1(3.2 * s)}Z" fill="#4FA36A" stroke="${INK}" stroke-width="${f1(1 * s)}"/>`; }
        {
          const p = W(-0.5, -0.25), fx = p[0] - 1 * s, fy = p[1] - 3 * s;
          for (const [dx, a] of [[-3.4, -30], [3.4, 30], [0, 0]] as [number, number][]) h += `<ellipse cx="${f1(fx + dx * s)}" cy="${f1(fy - 2 * s)}" rx="${f1(2.2 * s)}" ry="${f1(4.6 * s)}" transform="rotate(${a} ${f1(fx + dx * s)} ${f1(fy - 2 * s)})" fill="#FF9EB5" stroke="${INK}" stroke-width="${f1(0.9 * s)}"/>`;
          h += circ(fx, fy - 0.5 * s, 1.6 * s, '#F7C548', s, 0);
        }
        S.add(cu - hx, cv - hy, cu + hx, cv + hy, 0, H, h);
      }
      // pancuran bambu di sudut belakang: batu besar, tiang, cerat, air jatuh
      {
        let post = '';
        const [rx0, ry0] = A(0.16, 0.16, 0);
        post += `<path d="M${f1(rx0 - 13 * s)} ${f1(ry0 + 2 * s)}Q${f1(rx0 - 14 * s)} ${f1(ry0 - 12 * s)} ${f1(rx0 - 2 * s)} ${f1(ry0 - 15 * s)}Q${f1(rx0 + 12 * s)} ${f1(ry0 - 14 * s)} ${f1(rx0 + 13 * s)} ${f1(ry0 + 1 * s)}Q${f1(rx0)} ${f1(ry0 + 6 * s)} ${f1(rx0 - 13 * s)} ${f1(ry0 + 2 * s)}Z" fill="#8F9389" stroke="${INK}" stroke-width="${f1(1.4 * s)}" stroke-linejoin="round"/>`;
        post += `<path d="M${f1(rx0 - 6 * s)} ${f1(ry0 - 11 * s)}q${f1(5 * s)} ${f1(-2 * s)} ${f1(9 * s)} ${f1(1 * s)}" fill="none" stroke="#B4B8AE" stroke-width="${f1(1.6 * s)}" stroke-linecap="round"/>`;
        const pb = A(0.14, 0.14, 8), pt = A(0.14, 0.14, 52);
        post += inkLine([pb, pt], '#9CB55A', 4, s);
        for (const z of [22, 38]) { const q = A(0.14, 0.14, z); post += thinLine([[q[0] - 3 * s, q[1]], [q[0] + 3 * s, q[1]]], '#6E8A3A', 1.4 * s); }
        post += `<ellipse cx="${f1(pt[0])}" cy="${f1(pt[1])}" rx="${f1(3 * s)}" ry="${f1(1.5 * s)}" fill="#C9D98F" stroke="${INK}" stroke-width="${f1(1 * s)}"/>`;
        // pakis kecil di samping batu
        const [fx, fy] = A(0.32, 0.08, 0);
        for (const a of [-60, -30, 0, 30, 60]) post += `<ellipse cx="${f1(fx + Math.sin((a * Math.PI) / 180) * 6 * s)}" cy="${f1(fy - Math.cos((a * Math.PI) / 180) * 6 * s)}" rx="${f1(2 * s)}" ry="${f1(6 * s)}" transform="rotate(${a} ${f1(fx + Math.sin((a * Math.PI) / 180) * 6 * s)} ${f1(fy - Math.cos((a * Math.PI) / 180) * 6 * s)})" fill="#5DA05A" stroke="${INK}" stroke-width="${f1(0.8 * s)}"/>`;
        S.add(x + 0.0, y + 0.0, x + 0.15, y + 0.15, 0, 54, post);
        const sp0 = A(0.16, 0.16, 46), sp1 = A(0.46, 0.42, 40), wt = A(0.52, 0.48, H);
        let spout = inkLine([sp0, sp1], '#9CB55A', 2.4, s);
        spout += `<path class="water" d="M${f1(sp1[0])} ${f1(sp1[1])}Q${f1(sp1[0] + 4 * s)} ${f1(sp1[1] + 6 * s)} ${f1(wt[0])} ${f1(wt[1])}" fill="none" stroke="#BFE6F7" stroke-width="${f1(2.6 * s)}" stroke-linecap="round" stroke-dasharray="${f1(5 * s)} ${f1(4 * s)}"/>`;
        spout += `<ellipse cx="${f1(wt[0])}" cy="${f1(wt[1])}" rx="${f1(7 * s)}" ry="${f1(2.6 * s)}" fill="none" stroke="#FFFFFF" stroke-width="${f1(1.2 * s)}" opacity=".8"/>`;
        S.add(x + 0.15, y + 0.15, x + 0.5, y + 0.46, H, 46, spout);
      }
      return S.out();
    },
  },
  potkembang: {
    label: 'Pot kembang sepatu',
    colors: { main: '#C66B3D', accent: '#E0403F' },
    draw(g, x, y, w, d, c) {
      const s = g.s, cu = x + 0.5, cv = y + 0.5, [cx, cy] = g.iso(cu, cv), k = rk(g);
      let o = shadowE(cx, cy + 1 * s, 0.36 * k, 0.18 * k);
      o += lathe(g, cu, cv, [[0, 0.2], [3, 0.22], [24, 0.3], [26, 0.34], [33, 0.34]], c.main);
      o += frontArc(g, cu, cv, 26, 0.335, shade(c.main, -0.28), 1.6);
      for (let i = -3; i <= 3; i++) { const a = (i / 3.6) * (Math.PI / 2), r = 0.27 * k; o += circ(cx + Math.sin(a) * r, cy - 13 * s + Math.cos(a) * r * 0.5, 1.4 * s, shade(c.main, 0.3), s, 0); }
      o += flatE(g, cu, cv, 33, 0.34, shade(c.main, 0.1), 1.4) + flatE(g, cu, cv, 33, 0.29, '#5A3A22', 1);
      // semak berdaun & bunga kembang sepatu
      const by = cy - 31 * s;
      o += thinLine([[cx - 3 * s, by + 2 * s], [cx - 8 * s, by - 18 * s]], '#4F7A3A', 2 * s) + thinLine([[cx + 2 * s, by + 2 * s], [cx + 9 * s, by - 22 * s]], '#4F7A3A', 2 * s);
      const leaf = (lx: number, ly: number, r: number, a: number, dk: boolean) => `<ellipse cx="${f1(lx)}" cy="${f1(ly)}" rx="${f1(r * s)}" ry="${f1(r * 0.55 * s)}" transform="rotate(${a} ${f1(lx)} ${f1(ly)})" fill="${dk ? '#3F8A4E' : '#5DA862'}" stroke="${INK}" stroke-width="${f1(1.2 * s)}"/>`;
      o += `<g class="canopy">`;
      for (const [dx, dy, r, a, dk] of [[-17, -6, 10, -20, 1], [17, -7, 10, 25, 1], [-6, -4, 9, -60, 1], [7, -5, 9, 60, 1], [-21, -20, 10, -40, 0], [21, -21, 10, 40, 0], [-12, -30, 11, -35, 1], [12, -31, 11, 35, 1], [0, -20, 11, 90, 0], [0, -40, 11, 0, 0], [-16, -42, 10, -55, 0], [16, -43, 10, 55, 0], [-6, -52, 9, -25, 1], [7, -53, 9, 25, 0], [-24, -32, 8, -70, 1], [24, -33, 8, 70, 0]] as number[][]) o += leaf(cx + dx * s, by + dy * s, r, a, !!dk);
      const flower = (fx: number, fy: number, r: number, rot: number) => {
        let f = '';
        for (let i = 0; i < 5; i++) { const a = rot + i * 72, rad = (a * Math.PI) / 180, px = fx + Math.cos(rad) * r * 0.55, py = fy + Math.sin(rad) * r * 0.55; f += `<ellipse cx="${f1(px)}" cy="${f1(py)}" rx="${f1(r * 0.6)}" ry="${f1(r * 0.42)}" transform="rotate(${f1(a)} ${f1(px)} ${f1(py)})" fill="${c.accent}" stroke="${INK}" stroke-width="${f1(0.9 * s)}"/>`; }
        f += circ(fx, fy, r * 0.24, shade(c.accent, -0.35), s, 0);
        return f + thinLine([[fx, fy], [fx + r * 0.75, fy - r * 0.55]], '#F7C548', 1.2 * s) + circ(fx + r * 0.78, fy - r * 0.58, r * 0.12, '#F7C548', s, 0);
      };
      for (const [dx, dy, r, rot] of [[-13, -26, 7.5, 10], [11, -41, 7, 40], [15, -14, 7, -20], [-8, -48, 6.5, 70], [-21, -9, 6, 30], [3, -6, 6, 80]]) o += flower(cx + dx * s, by + dy * s, r * s, rot);
      o += `<ellipse cx="${f1(cx + 2 * s)}" cy="${f1(by - 59 * s)}" rx="${f1(2.4 * s)}" ry="${f1(4.2 * s)}" fill="${c.accent}" stroke="${INK}" stroke-width="${f1(0.9 * s)}"/>`;
      return o + `</g>`;
    },
  },
  lampujoglo: {
    label: 'Lampu taman joglo',
    colors: { main: '#4A3B2E', accent: '#FFE7A0' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), cu = x + 0.5, cv = y + 0.5, A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z);
      S.box(x + 0.3, y + 0.3, 0, 0.4, 0.4, 8, C3('#B9B3A4'));
      S.box(x + 0.43, y + 0.43, 8, 0.14, 0.14, 46, C3(c.main));
      // kotak lampu berkaca, menyala hangat
      {
        const b = rect(x + 0.32, y + 0.32, 0.36, 0.36);
        const [gx, gy] = at3(g, cu, cv, 66);
        let h = glowC(gx, gy, 30 * s, c.accent, 0.38, 'blink');
        h += prism(g, b, 54, 24, ['#FFF1C4', shade(c.accent, -0.02), shade(c.accent, -0.12)], 1.4);
        let ln = '';
        for (const [u, v] of [[0.32, 0.32], [0.68, 0.32], [0.68, 0.68], [0.32, 0.68], [0.5, 0.32], [0.68, 0.5], [0.5, 0.68], [0.32, 0.5]]) { const a = A(u, v, 54), q = A(u, v, 78); ln += `M${f1(a[0])} ${f1(a[1])}L${f1(q[0])} ${f1(q[1])}`; }
        h += `<path d="${ln}" stroke="${c.main}" stroke-width="${f1(1.6 * s)}" opacity=".8"/>`;
        h += prism(g, rect(x + 0.3, y + 0.3, 0.4, 0.4), 52, 3, C3(c.main), 1.2);
        S.add(x + 0.3, y + 0.3, x + 0.7, y + 0.7, 54, 78, h);
      }
      // atap joglo bertingkat
      {
        const pyr = (r: number, z0: number, z1: number, col: string) =>
          faces(g, [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([nu, nv]) => {
            const c0 = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
            const i = nu === 0 ? (nv < 0 ? 0 : 2) : nu > 0 ? 1 : 3;
            const a = c0[i], b2 = c0[(i + 1) % 4];
            return { pts: [[cu + a[0] * r, cv + a[1] * r, z0], [cu + b2[0] * r, cv + b2[1] * r, z0], [cu, cv, z1]], n: [nu, nv] as [number, number], c3: C3(col) };
          }));
        let h = prism(g, rect(x + 0.24, y + 0.24, 0.52, 0.52), 78, 3, C3(c.main), 1.2) + pyr(0.27, 81, 94, '#8A5A36') + prism(g, rect(x + 0.4, y + 0.4, 0.2, 0.2), 90, 3, C3(c.main), 1);
        h += pyr(0.11, 93, 102, '#8A5A36');
        const t = A(0.5, 0.5, 102);
        h += circ(t[0], t[1] - 1.5 * s, 2.2 * s, '#E9B949', s, 1);
        S.add(x + 0.24, y + 0.24, x + 0.76, y + 0.76, 78, 106, h);
      }
      return S.out();
    },
  },
  batupijak: {
    label: 'Batu pijakan',
    colors: { main: '#CFC8B6', accent: '#A69C88' },
    draw(g, x, y, w, d, c) {
      const s = g.s, A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z);
      let o = '';
      const stone = (u: number, v: number, r: number, seed: number) => {
        const pts: number[][] = [];
        for (let i = 0; i < 11; i++) { const a = (i / 11) * 2 * Math.PI, rr = r * (0.86 + 0.14 * Math.sin(seed + i * 2.1)); pts.push([u + rr * Math.cos(a), v + rr * Math.sin(a)]); }
        const top = pts.map(([a, b]) => A(a, b, 2.5)), side = pts.map(([a, b]) => A(a, b, 0));
        let st = g.poly(hull([...top, ...side]), shade(c.main, -0.28), 1.2) + g.poly(top, c.main, 1.2);
        const [hx, hy] = A(u - r * 0.25, v - r * 0.25, 2.5);
        st += `<ellipse cx="${f1(hx)}" cy="${f1(hy)}" rx="${f1(r * 9 * s)}" ry="${f1(r * 3.6 * s)}" fill="#FFFFFF" opacity=".35"/>`;
        return st;
      };
      o += stone(0.3, 0.3, 0.23, 1) + stone(0.7, 0.68, 0.24, 2.4) + stone(0.76, 0.24, 0.12, 4.1);
      for (const [u, v, r] of [[0.52, 0.5, 1.8], [0.2, 0.7, 1.5], [0.36, 0.86, 1.7], [0.9, 0.46, 1.3], [0.58, 0.1, 1.4]]) { const p = A(u, v, 0.5); o += `<ellipse cx="${f1(p[0])}" cy="${f1(p[1])}" rx="${f1(r * s)}" ry="${f1(r * 0.6 * s)}" fill="${c.accent}" stroke="${INK}" stroke-width="${f1(0.6 * s)}"/>`; }
      return o;
    },
  },
  kurungan: {
    label: 'Kurungan ayam',
    colors: { main: '#D9B26A', accent: '#C8622F' },
    draw(g, x, y, w, d, c) {
      const s = g.s, cu = x + 0.5, cv = y + 0.5, [cx, cy] = g.iso(cu, cv), k = rk(g);
      const prof = (z: number) => (z < 24 ? 0.39 - 0.002 * z : z < 48 ? 0.342 - 0.0108 * (z - 24) : Math.max(0, 0.083 - 0.03 * (z - 48)));
      const P3 = (a: number, z: number) => at3(g, cu + prof(z) * Math.cos(a), cv + prof(z) * Math.sin(a), z);
      const front = (a: number) => P3(a, 0)[1] >= cy - 0.5;
      const N = 10, zs = [0, 6, 12, 18, 24, 30, 36, 42, 46, 48, 50.5];
      const slat = (a: number, col: string) => thinLine(zs.map((z) => P3(a, z)), INK, 2.2 * s) + thinLine(zs.map((z) => P3(a, z)), col, 1.1 * s);
      const hoop = (z: number, isFront: boolean, col: string) => {
        const pts: Pt[] = [];
        for (let i = 0; i <= 40; i++) { const a = (i / 40) * 2 * Math.PI; if (front(a) === isFront) pts.push(P3(a, z)); }
        // urutkan dari kiri ke kanan supaya garisnya tidak melompat
        pts.sort((p, q) => p[0] - q[0]);
        return thinLine(pts, INK, 2.8 * s) + thinLine(pts, col, 1.5 * s);
      };
      let o = shadowE(cx, cy, 0.42 * k, 0.21 * k);
      // jagung bertebaran di luar kurungan (di tanah, selalu di bawah)
      for (const [du, dv] of [[0.74, 0.92], [0.92, 0.72], [0.62, 0.95], [0.95, 0.6], [0.84, 0.86]]) { const p = at3(g, x + du, y + dv, 0.5); o += `<ellipse cx="${f1(p[0])}" cy="${f1(p[1])}" rx="${f1(1.7 * s)}" ry="${f1(1.2 * s)}" fill="#F2C230" stroke="${INK}" stroke-width="${f1(0.5 * s)}"/>`; }
      // wadah minum di sudut: digambar sebelum / sesudah kurungan menurut letaknya di layar
      const dp = at3(g, x + 0.12, y + 0.86, 0);
      const dish = `<path d="M${f1(dp[0] - 5 * s)} ${f1(dp[1] - 3 * s)}L${f1(dp[0] - 4 * s)} ${f1(dp[1] + 1 * s)}Q${f1(dp[0])} ${f1(dp[1] + 3 * s)} ${f1(dp[0] + 4 * s)} ${f1(dp[1] + 1 * s)}L${f1(dp[0] + 5 * s)} ${f1(dp[1] - 3 * s)}Z" fill="#9AA7B8" stroke="${INK}" stroke-width="${f1(1 * s)}"/><ellipse cx="${f1(dp[0])}" cy="${f1(dp[1] - 3 * s)}" rx="${f1(5 * s)}" ry="${f1(2 * s)}" fill="#7FC4E8" stroke="${INK}" stroke-width="${f1(1 * s)}"/>`;
      if (dp[1] < cy) o += dish;
      const dark = shade(c.main, -0.2);
      for (let i = 0; i < N; i++) { const a = (i / N) * 2 * Math.PI; if (!front(a)) o += slat(a, dark); }
      o += hoop(4, false, dark) + hoop(26, false, dark);
      // induk ayam di dalam (menghadap ke kanan; dari belakang menghadap ke kiri)
      {
        const hx = cx - 1 * s, hy = cy + 1 * s, f = g.back ? -1 : 1;
        let hen = `<g transform="translate(${f1(hx)} ${f1(hy)}) scale(${f * 0.86} .86)">`;
        hen += `<path d="M${f1(-4 * s)} 0l${f1(-1 * s)} ${f1(3 * s)}M${f1(3 * s)} 0l${f1(1 * s)} ${f1(3 * s)}" stroke="#E9A23B" stroke-width="${f1(1.6 * s)}" stroke-linecap="round"/>`;
        hen += `<path d="M${f1(-14 * s)} ${f1(-12 * s)}Q${f1(-20 * s)} ${f1(-26 * s)} ${f1(-10 * s)} ${f1(-24 * s)}Q${f1(-7 * s)} ${f1(-18 * s)} ${f1(-8 * s)} ${f1(-14 * s)}Z" fill="#3B3F55" stroke="${INK}" stroke-width="${f1(1 * s)}"/>`;
        hen += `<path d="M${f1(-13 * s)} ${f1(-10 * s)}Q${f1(-15 * s)} ${f1(1 * s)} ${f1(0)} ${f1(1 * s)}Q${f1(12 * s)} ${f1(1 * s)} ${f1(11 * s)} ${f1(-11 * s)}Q${f1(10 * s)} ${f1(-17 * s)} ${f1(4 * s)} ${f1(-15 * s)}Q${f1(-6 * s)} ${f1(-19 * s)} ${f1(-13 * s)} ${f1(-10 * s)}Z" fill="${c.accent}" stroke="${INK}" stroke-width="${f1(1.3 * s)}" stroke-linejoin="round"/>`;
        hen += `<path d="M${f1(-6 * s)} ${f1(-9 * s)}Q${f1(0)} ${f1(-4 * s)} ${f1(5 * s)} ${f1(-9 * s)}" fill="none" stroke="${shade(c.accent, -0.3)}" stroke-width="${f1(1.2 * s)}"/>`;
        hen += `<path d="M${f1(-2 * s)} ${f1(-3 * s)}Q${f1(6 * s)} ${f1(-1 * s)} ${f1(9 * s)} ${f1(-9 * s)}" fill="none" stroke="#F3D9A8" stroke-width="${f1(3 * s)}" stroke-linecap="round"/>`;
        hen += `<circle cx="${f1(9 * s)}" cy="${f1(-19 * s)}" r="${f1(5.4 * s)}" fill="${shade(c.accent, 0.22)}" stroke="${INK}" stroke-width="${f1(1.2 * s)}"/>`;
        hen += `<path d="M${f1(6 * s)} ${f1(-23.5 * s)}q${f1(1 * s)} ${f1(-4 * s)} ${f1(3 * s)} ${f1(-1.5 * s)}q${f1(1.5 * s)} ${f1(-3 * s)} ${f1(3 * s)} ${f1(0.5 * s)}q${f1(2 * s)} ${f1(-1 * s)} ${f1(1 * s)} ${f1(2.5 * s)}Z" fill="#E0403F" stroke="${INK}" stroke-width="${f1(0.8 * s)}"/>`;
        hen += `<path d="M${f1(14 * s)} ${f1(-20 * s)}l${f1(4 * s)} ${f1(1.4 * s)}l${f1(-4 * s)} ${f1(1.6 * s)}Z" fill="#F2B632" stroke="${INK}" stroke-width="${f1(0.8 * s)}"/>`;
        hen += `<path d="M${f1(12.5 * s)} ${f1(-16 * s)}q${f1(0.5 * s)} ${f1(3.5 * s)} ${f1(-1.6 * s)} ${f1(3 * s)}" fill="#E0403F" stroke="${INK}" stroke-width="${f1(0.7 * s)}"/>`;
        hen += circ(11 * s, -20 * s, 1 * s, INK, s, 0) + `</g>`;
        o += hen;
      }
      for (let i = 0; i < N; i++) { const a = (i / N) * 2 * Math.PI; if (front(a)) o += slat(a, c.main); }
      o += hoop(4, true, c.main) + hoop(26, true, c.main);
      // pegangan di puncak
      const tp = at3(g, cu, cv, 50.5);
      o += `<path d="M${f1(tp[0] - 5 * s)} ${f1(tp[1])}Q${f1(tp[0])} ${f1(tp[1] - 11 * s)} ${f1(tp[0] + 5 * s)} ${f1(tp[1])}" fill="none" stroke="${INK}" stroke-width="${f1(3.4 * s)}" stroke-linecap="round"/><path d="M${f1(tp[0] - 5 * s)} ${f1(tp[1])}Q${f1(tp[0])} ${f1(tp[1] - 11 * s)} ${f1(tp[0] + 5 * s)} ${f1(tp[1])}" fill="none" stroke="${c.main}" stroke-width="${f1(1.8 * s)}" stroke-linecap="round"/>`;
      o += `<ellipse cx="${f1(tp[0])}" cy="${f1(tp[1])}" rx="${f1(4 * s)}" ry="${f1(2 * s)}" fill="${shade(c.main, -0.1)}" stroke="${INK}" stroke-width="${f1(1 * s)}"/>`;
      if (dp[1] >= cy) o += dish;
      return o;
    },
  },
  jemuran: {
    label: 'Jemuran bambu',
    colors: { main: '#C9A15A', accent: '#3F7FBF' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), Y = y + d / 2, A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z), bam = C3(c.main), Hp = 82;
      // dua tiang bercabang dengan kaki silang
      for (const u of [0.08, w - 0.18]) {
        S.box(x + u - 0.09, Y - 0.04, 0, 0.28, 0.08, 4, C3(shade(c.main, -0.15)), '', 1.1);
        S.box(x + u + 0.01, Y - 0.14, 0, 0.08, 0.28, 4, C3(shade(c.main, -0.15)), '', 1.1);
        const fork = inkLine([A(u + 0.05, d / 2, Hp - 2), A(u - 0.03, d / 2, Hp + 8)], c.main, 2, s) + inkLine([A(u + 0.05, d / 2, Hp - 2), A(u + 0.13, d / 2, Hp + 8)], c.main, 2, s);
        S.box(x + u, Y - 0.05, 4, 0.1, 0.1, Hp - 4, bam, fork, 1.2);
      }
      // pakaian di bidang tegak (terlihat dari dua sisi)
      const m = (cuu: number) => onY(g, Y, x + cuu, Hp);
      let cl = '';
      {
        // kaos bergaris
        const q = m(0.54);
        cl += g.poly([q(-4, 0), q(-9, -3), q(-11, -10), q(-7.5, -12), q(-6.5, -9), q(-6.5, -30), q(6.5, -30), q(6.5, -9), q(7.5, -12), q(11, -10), q(9, -3), q(4, 0), q(2, -2), q(-2, -2)], c.accent, 1.3);
        cl += thinLine([q(-6.5, -17), q(6.5, -17)], '#FFFDF7', 2 * s) + thinLine([q(-6.5, -22), q(6.5, -22)], '#FFFDF7', 2 * s);
      }
      {
        // sarung kotak-kotak terlipat di jemuran
        const q = m(1.04);
        cl += g.poly([q(-8, 1), q(8, 1), q(8, -44), q(-8, -44)], '#2F7F55', 1.3);
        let pl = '';
        for (const hx of [-4, 0, 4]) { const a = q(hx, 0), b = q(hx, -44); pl += `M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}`; }
        for (const vy of [-9, -18, -27, -36]) { const a = q(-8, vy), b = q(8, vy); pl += `M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}`; }
        cl += `<path d="${pl}" stroke="#C0392B" stroke-width="${f1(1.6 * s)}" opacity=".85"/>` + g.poly([q(-8, -29), q(8, -29), q(8, -36), q(-8, -36)], '#F2C14E', 0.9);
      }
      {
        // handuk belang
        const q = m(1.47);
        cl += g.poly([q(-6, 1), q(6, 1), q(6, -26), q(4.5, -28), q(-4.5, -28), q(-6, -26)], '#FF9EB5', 1.3);
        cl += thinLine([q(-6, -22), q(6, -22)], '#FFFDF7', 2 * s) + thinLine([q(-6, -18), q(6, -18)], '#FFFDF7', 1.2 * s);
      }
      {
        // celana pendek anak
        const q = m(1.7);
        cl += g.poly([q(-5.5, 1), q(5.5, 1), q(6, -14), q(1, -14), q(0, -8), q(-1, -14), q(-6, -14)], '#F2C14E', 1.2) + thinLine([q(-5.5, -2), q(5.5, -2)], '#E0583F', 1.6 * s);
      }
      // jepitan
      [0.43, 0.65, 0.84, 1.24, 1.32, 1.6, 1.64, 1.76].forEach((u, i) => { const q = m(u); cl += g.poly([q(-1, 2.5), q(1, 2.5), q(1, -4), q(-1, -4)], i % 2 ? '#F2B632' : '#3FA06A', 0.7); });
      S.add(x + 0.25, Y - 0.01, x + w - 0.25, Y + 0.01, 30, Hp, cl);
      // galah bambu di atas
      const pole = inkLine([A(0.04, d / 2, Hp + 1), A(w - 0.04, d / 2, Hp + 1)], c.main, 2.6, s);
      let nodes = '';
      for (let u = 0.3; u < w - 0.1; u += 0.42) { const q = A(u, d / 2, Hp + 1); nodes += `M${f1(q[0])} ${f1(q[1] - 1.8 * s)}l0 ${f1(3.6 * s)}`; }
      S.add(x + 0.04, Y - 0.01, x + w - 0.04, Y + 0.01, Hp + 1, Hp + 4, pole + `<path d="${nodes}" stroke="${shade(c.main, -0.3)}" stroke-width="${f1(1.1 * s)}"/>`);
      return S.out();
    },
  },
  pagarbambu: {
    label: 'Pagar bambu',
    colors: { main: '#D9B26A', accent: '#6B4A2E' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), Y = y + d / 2, bam = C3(c.main), A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z);
      const n = Math.max(2, Math.round(w / 0.4));
      for (let i = 0; i <= n; i++) {
        const u = 0.06 + ((w - 0.22) * i) / n, h = 42 + (i % 2) * 5, r = 0.05;
        // ujung runcing & ruas bambu
        let cap = faces(g, ([[0, -1], [1, 0], [0, 1], [-1, 0]] as [number, number][]).map((nn, k) => {
          const cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]], a = cs[k], b = cs[(k + 1) % 4];
          return { pts: [[x + u + r + a[0] * r, Y + a[1] * r, h], [x + u + r + b[0] * r, Y + b[1] * r, h], [x + u + r, Y, h + 8]], n: nn, c3: bam };
        }), 1);
        for (const z of [13, 28]) cap += prism(g, rect(x + u - 0.008, Y - r - 0.008, 2 * r + 0.016, 2 * r + 0.016), z, 2, C3(shade(c.main, -0.22)), 0.8);
        S.box(x + u, Y - r, 0, 2 * r, 2 * r, h, bam, cap, 1.1);
      }
      // dua palang di depan tiang, diikat tali ijuk
      for (const z of [15, 31]) {
        let ties = '';
        for (let i = 0; i <= n; i++) { const u = 0.06 + ((w - 0.22) * i) / n + 0.05, p = A(u, d / 2 + (g.back ? 0.06 : 0.13), z + 2); ties += `M${f1(p[0] - 1.6 * s)} ${f1(p[1] - 3 * s)}l${f1(3.2 * s)} ${f1(5 * s)}M${f1(p[0] + 1.6 * s)} ${f1(p[1] - 3 * s)}l${f1(-3.2 * s)} ${f1(5 * s)}`; }
        S.box(x + 0.02, Y + 0.06, z, w - 0.04, 0.07, 4, bam, `<path d="${ties}" stroke="${c.accent}" stroke-width="${f1(1.3 * s)}"/>`, 1.1);
      }
      return S.out();
    },
  },
};

/* ================================================================== */
/* Pasar Pagi: ikon makanan (64×52, sama dengan ikon makanan lama)      */
/* ================================================================== */

const plate = `<ellipse cx="32" cy="42" rx="25" ry="7" fill="#FFFFFF" stroke="${INK}" stroke-width="2.5"/>`;
const ink = (w = 2) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round"`;

const FOOD: Record<string, IconDef> = {
  gadogado: {
    label: 'Gado-gado', kinds: ['food'], colors: { main: '#B5703F', accent: '#7CC57D' },
    draw: (c) => plate +
      `<path d="M11 39Q8 31 16 29Q18 22 27 24Q33 18 41 23Q50 21 52 29Q57 33 53 39Z" fill="${c.accent}" ${ink(2.2)}/>` +
      `<path d="M15 32q3 -3 6 0M44 27q3 -3 6 1" fill="none" stroke="${shade(c.accent, -0.3)}" stroke-width="1.4"/>` +
      `<rect x="16" y="28" width="9" height="8" rx="1.6" fill="#EEF3D8" ${ink(1.6)}/><rect x="25" y="31" width="8" height="7" rx="1.5" fill="#E9C46A" ${ink(1.6)}/>` +
      `<ellipse cx="41" cy="32" rx="6.5" ry="4.6" fill="#FFFFFF" ${ink(1.6)}/><circle cx="41" cy="32" r="2.5" fill="#F2B632"/>` +
      `<path d="M20 30Q24 25 31 27Q37 24 40 28Q38 33 31 32Q25 35 20 30Z" fill="${c.main}" ${ink(1.6)}/>` +
      `<path d="M37 12Q40 8 44 11Q48 8 51 12Q55 13 53 17Q56 21 51 22Q49 26 45 23Q41 26 38 22Q33 21 35 17Q32 14 37 12Z" fill="#F7E3A1" ${ink(1.8)}/>` +
      `<g fill="#E2C47E"><circle cx="41" cy="15" r="1.1"/><circle cx="47" cy="17" r="1.1"/><circle cx="43" cy="20" r="1"/></g>`,
  },
  soto: {
    label: 'Soto ayam', kinds: ['food'], colors: { main: '#F2C14E', accent: '#3FA0A0' },
    draw: (c) =>
      `<path d="M23 12q2 -6 0 -10M33 11q2 -6 0 -10M42 12q2 -5 0 -9" stroke="${INK}" stroke-width="1.6" fill="none" opacity=".35"/>` +
      `<ellipse cx="32" cy="22" rx="22" ry="7" fill="${c.main}" ${ink(2.2)}/>` +
      `<path d="M18 21q4 -2 8 0M30 23q4 -2 7 0" stroke="#FFF4C4" stroke-width="1.6" fill="none"/>` +
      `<ellipse cx="38" cy="19" rx="5" ry="3" fill="#FFFFFF" ${ink(1.4)}/><circle cx="38" cy="19" r="1.7" fill="#F2B632"/>` +
      `<g fill="#3FA06A"><circle cx="24" cy="18" r="1.3"/><circle cx="28" cy="20" r="1.2"/><circle cx="45" cy="22" r="1.2"/><circle cx="20" cy="23" r="1.1"/></g>` +
      `<path d="M10 22Q12 46 32 46Q52 46 54 22" fill="#FFFDF7" stroke="${INK}" stroke-width="2.5"/>` +
      `<path d="M12.5 31Q32 39 51.5 31" fill="none" stroke="${c.accent}" stroke-width="3"/>` +
      `<path d="M48 18A6 6 0 0 1 58 22L48 22Z" fill="#9CCB5A" ${ink(1.6)}/><path d="M50 19.5A4 4 0 0 1 55.5 21" fill="none" stroke="#DDEFB2" stroke-width="1.2"/>`,
  },
  nasiuduk: {
    label: 'Nasi uduk', kinds: ['food'], colors: { main: '#4FA35A', accent: '#FFFDF7' },
    draw: (c) =>
      `<path d="M6 34L30 47L58 33L44 22L18 23Z" fill="${c.main}" ${ink(2.4)}/>` +
      `<path d="M18 23L30 47M44 22L30 47" fill="none" stroke="${shade(c.main, 0.25)}" stroke-width="1.4"/>` +
      `<path d="M14 33Q14 16 31 15Q47 16 47 32Q31 38 14 33Z" fill="${c.accent}" ${ink(2.2)}/>` +
      `<g fill="#E8E2D2"><circle cx="24" cy="24" r="1"/><circle cx="31" cy="20" r="1"/><circle cx="38" cy="25" r="1"/><circle cx="29" cy="28" r="1"/></g>` +
      `<path d="M33 30L46 26L49 30L36 34Z" fill="#F2C94C" ${ink(1.6)}/>` +
      `<g stroke="#8A5A36" stroke-width="2.4" stroke-linecap="round"><path d="M15 30l5 2M17 34l5 0M21 31l4 3"/></g>` +
      `<path d="M44 15Q50 14 51 19Q46 21 43 18Z" fill="#E0403F" ${ink(1.4)}/>` +
      `<circle cx="10" cy="38" r="3.4" fill="#C8E6A0" ${ink(1.3)}/><circle cx="54" cy="36" r="3.2" fill="#C8E6A0" ${ink(1.3)}/>` +
      `<g fill="#B5703F"><circle cx="27" cy="18" r=".9"/><circle cx="34" cy="17" r=".9"/><circle cx="22" cy="21" r=".9"/></g>`,
  },
  ondeonde: {
    label: 'Onde-onde', kinds: ['food'], colors: { main: '#E3A84A', accent: '#6DB068' },
    draw: (c) => {
      const ball = (cx: number, cy: number) =>
        `<circle cx="${cx}" cy="${cy}" r="9" fill="${c.main}" ${ink(2.2)}/><ellipse cx="${cx - 3}" cy="${cy - 3}" rx="2.6" ry="1.6" fill="#FFFFFF" opacity=".45"/>` +
        [[-4, 2, 30], [2, -4, -20], [4, 3, 60], [-1, 5, 10], [-5, -2, -50], [5, -1, 80]].map(([dx, dy, r]) => `<ellipse cx="${cx + dx}" cy="${cy + dy}" rx="1.4" ry=".7" transform="rotate(${r} ${cx + dx} ${cy + dy})" fill="#FFF8E6"/>`).join('');
      return `<path d="M8 40L28 48L56 39L36 31Z" fill="${c.accent}" ${ink(2.2)}/><path d="M18 36L46 42" stroke="${shade(c.accent, -0.25)}" stroke-width="1.2"/>` + ball(23, 35) + ball(41, 35) + ball(32, 22);
    },
  },
  molen: {
    label: 'Pisang molen', kinds: ['food'], colors: { main: '#E8B04B', accent: '#B9772C' },
    draw: (c) => {
      const roll = (cx: number, cy: number, r: number) =>
        `<g transform="rotate(${r} ${cx} ${cy})"><rect x="${cx - 14}" y="${cy - 5}" width="28" height="10" rx="5" fill="${c.main}" ${ink(2.2)}/>` +
        `<path d="M${cx - 8} ${cy - 5}l-4 10M${cx - 2} ${cy - 5}l-4 10M${cx + 4} ${cy - 5}l-4 10M${cx + 10} ${cy - 5}l-4 10" stroke="${c.accent}" stroke-width="2" stroke-linecap="round"/></g>`;
      return `<path d="M7 40L22 46L57 40L42 33Z" fill="#E9D3A6" ${ink(2.2)}/><path d="M12 40l14 5" stroke="#CDB07A" stroke-width="1.2"/>` + roll(22, 36, -8) + roll(42, 36, 8) + roll(32, 25, -3);
    },
  },
  esbuah: {
    label: 'Es buah', kinds: ['food'], colors: { main: '#FF9EB5', accent: '#9CCB5A' },
    draw: (c) =>
      `<path d="M24 47H40L37 44H27Z" fill="#DDF1F7" ${ink(1.8)}/><rect x="30" y="38" width="4" height="7" fill="#DDF1F7" ${ink(1.6)}/>` +
      `<path d="M12 18H52Q51 38 32 39Q13 38 12 18Z" fill="${c.main}" fill-opacity=".85"/>` +
      `<g ${ink(1.3)}><rect x="17" y="21" width="7" height="6" rx="1" fill="${c.accent}"/><rect x="27" y="25" width="7" height="6" rx="1" fill="#F2994A"/><rect x="38" y="21" width="7" height="6" rx="1" fill="#E0403F"/><ellipse cx="23" cy="31" rx="3" ry="2" fill="#F4F0E4"/><ellipse cx="40" cy="31" rx="3" ry="2" fill="#F4F0E4"/></g>` +
      `<g ${ink(1.4)}><rect x="15" y="12" width="8" height="7" rx="1.2" fill="#E0403F"/><rect x="24" y="9" width="8" height="8" rx="1.2" fill="${c.accent}"/><rect x="34" y="11" width="8" height="7" rx="1.2" fill="#F2994A"/><rect x="42" y="13" width="7" height="6" rx="1.2" fill="#E9F6FB" opacity=".9"/></g>` +
      `<path d="M27 8q3 -5 7 -3q-3 4 -7 3Z" fill="#3FA06A" ${ink(1.2)}/>` +
      `<path d="M12 18H52Q51 38 32 39Q13 38 12 18Z" fill="none" ${ink(2.4)}/><path d="M16 22Q18 33 26 36" fill="none" stroke="#FFFFFF" stroke-width="2" opacity=".7" stroke-linecap="round"/>` +
      `<path d="M47 14L56 3" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/><path d="M47 14L56 3" stroke="#C9CED6" stroke-width="1.6" stroke-linecap="round"/>`,
  },
  serabi: {
    label: 'Serabi', kinds: ['food'], colors: { main: '#F4E3B5', accent: '#7A4A1E' },
    draw: (c) => {
      const cake = (cx: number, cy: number, top: string) =>
        `<path d="M${cx - 13} ${cy}v4a13 5 0 0 0 26 0v-4" fill="#C98A4B" ${ink(2)}/><ellipse cx="${cx}" cy="${cy}" rx="13" ry="5" fill="${top}" ${ink(2)}/>` +
        `<g fill="${shade(top, -0.18)}"><circle cx="${cx - 5}" cy="${cy - 1}" r=".9"/><circle cx="${cx + 1}" cy="${cy + 1.5}" r=".9"/><circle cx="${cx + 6}" cy="${cy - 1}" r=".9"/><circle cx="${cx - 1}" cy="${cy - 2.5}" r=".8"/></g>`;
      return `<ellipse cx="32" cy="42" rx="25" ry="7" fill="#C66B3D" ${ink(2.5)}/><ellipse cx="32" cy="40.5" rx="20" ry="4.6" fill="#D9874E"/>` +
        cake(22, 34, c.main) + cake(42, 33, '#B8D98A') +
        `<path d="M31 29Q32 24 38 24Q45 24 47 28Q46 31 42 31Q41 35 39 31Q35 32 33 31Q30 33 31 29Z" fill="${c.accent}" ${ink(1.6)}/><path d="M35 27q3 -1 6 0" stroke="#B5703F" stroke-width="1.4" fill="none"/>` +
        `<path d="M14 30Q16 25 21 26Q25 25 27 28Q26 31 22 31Q21 34 19 31Q15 32 14 30Z" fill="${c.accent}" ${ink(1.4)}/>`;
    },
  },
  ronde: {
    label: 'Wedang ronde', kinds: ['food'], colors: { main: '#C98A3B', accent: '#FFFDF7' },
    draw: (c) =>
      `<path d="M23 10q2 -5 0 -8M31 9q2 -5 0 -8M39 10q2 -5 0 -8" stroke="${INK}" stroke-width="1.6" fill="none" opacity=".35"/>` +
      `<path d="M44 20q11 0 10 10q-1 9 -11 8" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M44 20q11 0 10 10q-1 9 -11 8" fill="none" stroke="#EAF6FA" stroke-width="2.4" stroke-linecap="round"/>` +
      `<path d="M15 12H47L44 45Q32 49 18 45Z" fill="#EAF6FA"/>` +
      `<path d="M16.2 20H45.8L44 45Q32 49 18 45Z" fill="${c.main}" opacity=".9"/>` +
      `<g ${ink(1.4)}><circle cx="24" cy="38" r="4.4" fill="${c.accent}"/><circle cx="33" cy="40" r="4.4" fill="#FF9EB5"/><circle cx="40" cy="35" r="4.2" fill="#9CCB5A"/></g>` +
      `<ellipse cx="27" cy="24" rx="4" ry="2.4" fill="#E9D27A" ${ink(1.2)}/><g fill="#F4E3B5" ${ink(0.9)}><ellipse cx="36" cy="25" rx="2" ry="1.4"/><ellipse cx="40" cy="27" rx="2" ry="1.4"/><ellipse cx="21" cy="29" rx="2" ry="1.4"/></g>` +
      `<path d="M15 12H47L44 45Q32 49 18 45Z" fill="none" ${ink(2.4)}/><path d="M19 16L21 40" stroke="#FFFFFF" stroke-width="2" opacity=".7" stroke-linecap="round"/>`,
  },
};

registerArt(FOOD, { ...MEBEL, ...BANGUNAN });

/** bentuk mebel baru per toko (untuk uji & galeri) */
export const TOKO3_ART = { mebel: Object.keys(MEBEL), bangunan: Object.keys(BANGUNAN), pasar: Object.keys(FOOD) };
