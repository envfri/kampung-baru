// Gambar barang koin baru paket konten 20: perabot dapur & kamar mandi (Mebel Jati) dan benda taman (Toko Bangunan),
// dua dinding keramik, tiga lantai (tegel catur, mozaik, rumput berbunga), dan properti pet untuk tiga animasi baru
// (ayun, sikat, cuci). Semua orisinal: garis INK, isian datar, warna bisa diganti dari admin, tanpa merek atau tulisan.
//
// 4 arah: seperti art-toko3.ts, tiap mebel dibangun dengan "scene" (bagian berkotak batas, diurutkan belakang → depan),
// jadi tampak belakang (2× & 3× putar) benar tanpa gambar kedua. Hiasan yang hanya ada di sisi depan (pintu & tombol
// mesin cuci, cermin, keran dispenser, lambang tong sampah, garis ukur) memakai g.quadX / g.quadY atau dicek g.back.
import {
  INK, P, shade, registerArt, registerSurfaces, WALL_KIT, C3, f1, at3, rk, inkLine, thinLine, prism, ovalTub, lathe, flatE, frontArc, onY, onX, discPts, shadowE, hull, wisp,
  type IsoCtx, type FurnDef, type WallPattern, type FloorPattern,
} from './art';
import { SCENE_KIT } from './art-toko3';

const { scene, rect, circ } = SCENE_KIT;
type Pt = number[];
type Scene = ReturnType<typeof scene>;

/* ------------------------------------------------------------------ */
/* Bantuan kecil                                                         */
/* ------------------------------------------------------------------ */

const seg = (a: Pt, b: Pt) => `M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}`;
const pathD = (pts: Pt[], close = true) => `M${P(pts).replace(/ /g, 'L')}${close ? 'Z' : ''}`;
/** elips di layar (benda kecil yang selalu menghadap kamera: buah, gelembung) */
const ell = (cx: number, cy: number, rx: number, ry: number, fill: string, s: number, sw = 1, extra = '') =>
  `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(rx)}" ry="${f1(ry)}" fill="${fill}"${sw ? ` stroke="${INK}" stroke-width="${f1(sw * s)}"` : ''}${extra}/>`;
/**
 * Sisi tegak sebuah alas segi-banyak yang menghadap kamera (logika sama dengan prism): untuk tiap sisi yang terlihat,
 * fungsi titik (t sepanjang sisi 0..1, z) — dipakai untuk menggambar corak (taplak kotak, daun pagar) di sisi itu.
 */
function seenSides(g: IsoCtx, base: number[][], z0: number) {
  const lo = base.map(([u, v]) => at3(g, u, v, z0));
  const n = lo.length, cx = lo.reduce((a, p) => a + p[0], 0) / n, cy = lo.reduce((a, p) => a + p[1], 0) / n;
  const out: ((t: number, z: number) => Pt)[] = [];
  for (let i = 0; i < n; i++) {
    const a = lo[i], b = lo[(i + 1) % n];
    let nx = b[1] - a[1], ny = a[0] - b[0];
    if (nx * ((a[0] + b[0]) / 2 - cx) + ny * ((a[1] + b[1]) / 2 - cy) < 0) { nx = -nx; ny = -ny; }
    if (ny > 1e-6) { const A0 = base[i], B0 = base[(i + 1) % n]; out.push((t, z) => at3(g, A0[0] + (B0[0] - A0[0]) * t, A0[1] + (B0[1] - A0[1]) * t, z)); }
  }
  return out;
}
/**
 * Lubang persegi di bidang datar (bak cuci, bak pasir): dasar lubang + dua dinding dalam yang jauh dari kamera
 * (dipilih dari letaknya di layar, jadi benar juga dari belakang).
 */
function hole(g: IsoCtx, u0: number, v0: number, u1: number, v1: number, zTop: number, depth: number, wall: string, floor: string, sw = 1.2) {
  const zb = zTop - depth;
  let o = g.poly([at3(g, u0, v0, zb), at3(g, u1, v0, zb), at3(g, u1, v1, zb), at3(g, u0, v1, zb)], floor, sw);
  const walls = [
    [[u0, v0], [u1, v0]], [[u1, v0], [u1, v1]], [[u1, v1], [u0, v1]], [[u0, v1], [u0, v0]],
  ].map(([a, b]) => ({ a, b, y: (at3(g, a[0], a[1], zTop)[1] + at3(g, b[0], b[1], zTop)[1]) / 2 }));
  walls.sort((p, q) => p.y - q.y);
  for (const w of walls.slice(0, 2)) o += g.poly([at3(g, w.a[0], w.a[1], zTop), at3(g, w.b[0], w.b[1], zTop), at3(g, w.b[0], w.b[1], zb), at3(g, w.a[0], w.a[1], zb)], wall, sw);
  return o + g.poly([at3(g, u0, v0, zTop), at3(g, u1, v0, zTop), at3(g, u1, v1, zTop), at3(g, u0, v1, zTop)], 'none', sw);
}
/** tabung tegak (lathe lurus + tutup atas) sebagai satu bagian scene */
function cyl(S: Scene, g: IsoCtx, cu: number, cv: number, r: number, z0: number, z1: number, fill: string, top = shade(fill, 0.12), extra = '', sw = 1.4) {
  S.add(cu - r, cv - r, cu + r, cv + r, z0, z1, lathe(g, cu, cv, [[z0, r], [z1, r]], fill, sw) + flatE(g, cu, cv, z1, r, top, sw) + extra);
}
/** matriks affine dari bidang tegak y = Y (a px ke arah x, b px ke atas) ke layar: untuk isi yang diputar CSS */
function planeY(g: IsoCtx, Y: number, cu: number, z0: number) {
  const p0 = at3(g, cu, Y, z0), pa = at3(g, cu + 1 / 32, Y, z0), pb = at3(g, cu, Y, z0 + 1);
  return [pa[0] - p0[0], pa[1] - p0[1], pb[0] - p0[0], pb[1] - p0[1], p0[0], p0[1]].map((v) => Math.round(v * 1000) / 1000).join(' ');
}
/** daun lonjong (semak, sayur, pagar tanaman) */
const leaf = (lx: number, ly: number, r: number, a: number, fill: string, s: number, sw = 1) =>
  `<ellipse cx="${f1(lx)}" cy="${f1(ly)}" rx="${f1(r * s)}" ry="${f1(r * 0.55 * s)}" transform="rotate(${f1(a)} ${f1(lx)} ${f1(ly)})" fill="${fill}" stroke="${INK}" stroke-width="${f1(sw * s)}"/>`;
/** bunga kecil lima kelopak */
function bloom(fx: number, fy: number, r: number, fill: string, s: number, mid = '#F7C548', sw = 0.8) {
  let o = '';
  for (let i = 0; i < 5; i++) { const a = (i / 5) * 2 * Math.PI - Math.PI / 2, px = fx + Math.cos(a) * r * 0.55, py = fy + Math.sin(a) * r * 0.5; o += `<ellipse cx="${f1(px)}" cy="${f1(py)}" rx="${f1(r * 0.5)}" ry="${f1(r * 0.38)}" transform="rotate(${f1((a * 180) / Math.PI)} ${f1(px)} ${f1(py)})" fill="${fill}" stroke="${INK}" stroke-width="${f1(sw * s)}"/>`; }
  return o + `<circle cx="${f1(fx)}" cy="${f1(fy)}" r="${f1(r * 0.3)}" fill="${mid}"/>`;
}
/** buah bulat kecil (jeruk, tomat) dengan tangkai */
const fruit = (fx: number, fy: number, r: number, fill: string, s: number) =>
  circ(fx, fy, r, fill, s, 1) + `<path d="M${f1(fx - r * 0.35)} ${f1(fy - r * 0.45)}a${f1(r * 0.35)} ${f1(r * 0.25)} 0 0 1 ${f1(r * 0.5)} ${f1(-r * 0.15)}" fill="none" stroke="#FFFFFF" stroke-width="${f1(1 * s)}" opacity=".7"/>` + `<path d="M${f1(fx)} ${f1(fy - r)}l${f1(1.5 * s)} ${f1(-2 * s)}" stroke="#3F8A4E" stroke-width="${f1(1.4 * s)}" stroke-linecap="round"/>`;
/** burung kecil di layar (menghadap kanan; f = -1 menghadap kiri) */
function birdie(bx: number, by: number, k: number, body: string, f = 1, peck = false) {
  const q = (v: number) => f1(v * k);
  let o = `<g transform="translate(${f1(bx)} ${f1(by)}) scale(${f} 1)">`;
  o += `<path d="M${q(-1.5)} 0l${q(-0.6)} ${q(2.4)}M${q(1.5)} 0l${q(0.6)} ${q(2.4)}" stroke="#E9A23B" stroke-width="${q(0.9)}" stroke-linecap="round"/>`;
  o += `<path d="M${q(-9)} ${q(-6)}l${q(-5)} ${q(-3)}l${q(1)} ${q(5)}Z" fill="${shade(body, -0.25)}" stroke="${INK}" stroke-width="${q(0.8)}" stroke-linejoin="round"/>`;
  o += `<ellipse cx="0" cy="${q(-5)}" rx="${q(8)}" ry="${q(5.4)}" fill="${body}" stroke="${INK}" stroke-width="${q(1)}"/>`;
  o += `<path d="M${q(-4)} ${q(-6)}q${q(4)} ${q(3)} ${q(7)} ${q(-1)}" fill="none" stroke="${shade(body, -0.3)}" stroke-width="${q(1)}"/>`;
  const hy = peck ? -3 : -11, hx = peck ? 8 : 6;
  o += `<circle cx="${q(hx)}" cy="${q(hy)}" r="${q(4.2)}" fill="${body}" stroke="${INK}" stroke-width="${q(1)}"/>`;
  o += `<path d="M${q(hx + 3.6)} ${q(hy - 1)}l${q(3.4)} ${q(1.2)}l${q(-3.4)} ${q(1.2)}Z" fill="#F2B632" stroke="${INK}" stroke-width="${q(0.6)}" stroke-linejoin="round"/>`;
  return o + `<circle cx="${q(hx + 1.4)}" cy="${q(hy - 1)}" r="${q(0.9)}" fill="${INK}"/></g>`;
}
/** kotak-kotak (gingham) di bidang datar: garis lebar sepanjang u & v, transparan supaya persilangan lebih gelap */
function gingham(g: IsoCtx, u0: number, v0: number, u1: number, v1: number, z: number, col: string, n: number) {
  let o = '';
  const du = (u1 - u0) / n, dv = (v1 - v0) / n;
  for (let i = 0; i < n; i += 2) {
    o += `<path d="${pathD([at3(g, u0 + i * du, v0, z), at3(g, u0 + (i + 1) * du, v0, z), at3(g, u0 + (i + 1) * du, v1, z), at3(g, u0 + i * du, v1, z)])}" fill="${col}" opacity=".55"/>`;
    o += `<path d="${pathD([at3(g, u0, v0 + i * dv, z), at3(g, u1, v0 + i * dv, z), at3(g, u1, v0 + (i + 1) * dv, z), at3(g, u0, v0 + (i + 1) * dv, z)])}" fill="${col}" opacity=".55"/>`;
  }
  return o;
}

/* ================================================================== */
/* Dapur (Mebel Jati)                                                  */
/* ================================================================== */

const DAPUR: Record<string, FurnDef> = {
  dandang: {
    label: 'Dandang & kukusan di kompor',
    colors: { main: '#C9CED6', accent: '#3F7FBF' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), cu = x + 0.46, cv = y + 0.44, k = rk(g), [cx, cy] = g.iso(cu, cv);
      S.add(x, y, x + 1, y + 1, -1, 0, shadowE(cx, cy + 2 * s, 0.4 * k, 0.2 * k));
      // kompor minyak: tangki bulat, cincin tungku, tiga kaki penyangga, api biru
      cyl(S, g, cu, cv, 0.3, 0, 12, c.accent, shade(c.accent, 0.2), frontArc(g, cu, cv, 6, 0.3, shade(c.accent, -0.3), 1.4));
      {
        let h = lathe(g, cu, cv, [[12, 0.16], [16, 0.15]], '#7D8899', 1.2) + flatE(g, cu, cv, 16, 0.15, '#3B3F55', 1.1);
        // api: lidah kecil di sekeliling cincin
        for (let i = 0; i < 7; i++) { const a = Math.PI * (0.1 + (0.8 * i) / 6), p = at3(g, cu + 0.12 * Math.cos(a), cv + 0.12 * Math.sin(a), 16); h += `<path d="M${f1(p[0] - 2 * s)} ${f1(p[1])}q${f1(2 * s)} ${f1(-7 * s)} ${f1(4 * s)} 0Z" fill="${i % 2 ? '#7FC4E8' : '#F2994A'}" stroke="${INK}" stroke-width="${f1(0.6 * s)}"/>`; }
        for (const a of [0.5, 2.6, 4.7]) { const p0 = at3(g, cu + 0.24 * Math.cos(a), cv + 0.24 * Math.sin(a), 12), p1 = at3(g, cu + 0.2 * Math.cos(a), cv + 0.2 * Math.sin(a), 23); h += inkLine([p0, p1], '#5E6878', 1.6, s); }
        S.add(cu - 0.25, cv - 0.25, cu + 0.25, cv + 0.25, 12, 22, h);
      }
      // dandang aluminium bertelinga
      {
        let h = lathe(g, cu, cv, [[22, 0.2], [24, 0.24], [44, 0.27], [48, 0.25], [52, 0.27]], c.main);
        h += frontArc(g, cu, cv, 30, 0.255, shade(c.main, -0.22), 1.2) + frontArc(g, cu, cv, 46, 0.26, shade(c.main, -0.22), 1.2);
        h += thinLine([at3(g, cu - 0.16, cv + 0.1, 28), at3(g, cu - 0.17, cv + 0.12, 42)], '#FFFFFF', 2.4 * s, ' opacity=".7"');
        for (const side of [-1, 1]) { const [px, py] = at3(g, cu, cv, 46); const ex = px + side * 0.29 * k; h += `<path d="M${f1(ex - side * 1 * s)} ${f1(py - 3 * s)}h${f1(side * 4 * s)}v${f1(5 * s)}h${f1(-side * 4 * s)}" fill="none" stroke="${INK}" stroke-width="${f1(2.6 * s)}" stroke-linejoin="round"/><path d="M${f1(ex - side * 1 * s)} ${f1(py - 3 * s)}h${f1(side * 4 * s)}v${f1(5 * s)}h${f1(-side * 4 * s)}" fill="none" stroke="#9AA7B8" stroke-width="${f1(1.2 * s)}"/>`; }
        S.add(cu - 0.27, cv - 0.27, cu + 0.27, cv + 0.27, 22, 52, h);
      }
      // kukusan bambu (kerucut beranyam) & tutup
      {
        let h = lathe(g, cu, cv, [[50, 0.21], [66, 0.33]], '#D9B26A', 1.4);
        const [px, py] = at3(g, cu, cv, 50);
        let wv = '';
        for (let i = -4; i <= 4; i++) { const a = at3(g, cu + i * 0.045, cv, 50), b = at3(g, cu + i * 0.075, cv, 66); wv += seg([a[0], a[1] + 0 * py], b); }
        h += `<path d="${wv}" stroke="#A9844C" stroke-width="${f1(0.9 * s)}"/>` + frontArc(g, cu, cv, 58, 0.27, '#A9844C', 1.2);
        h += lathe(g, cu, cv, [[66, 0.33], [69, 0.3], [74, 0.2], [76, 0.08]], c.main, 1.4) + lathe(g, cu, cv, [[76, 0.05], [79, 0.05]], '#3B3F55', 1.1) + flatE(g, cu, cv, 79, 0.05, '#5E6878', 1);
        h += thinLine([[px - 0.2 * k, py - 21 * s], [px - 0.1 * k, py - 25 * s]], '#FFFFFF', 2 * s, ' opacity=".7"');
        S.add(cu - 0.33, cv - 0.33, cu + 0.33, cv + 0.33, 50, 80, h);
        const [tx, ty] = at3(g, cu, cv, 80);
        S.add(cu - 0.2, cv - 0.2, cu + 0.2, cv + 0.2, 80, 100, wisp(tx - 9 * s, ty + 2 * s, s, 18) + wisp(tx + 8 * s, ty + 1 * s, s, 14));
      }
      // sepiring kue lapis di lantai
      {
        const pu = x + 0.84, pv = y + 0.84;
        S.add(pu - 0.15, pv - 0.15, pu + 0.15, pv + 0.15, 0, 1, flatE(g, pu, pv, 0.8, 0.15, '#FFFDF7', 1.1) + flatE(g, pu, pv, 1, 0.1, '#EDE6D6', 0));
        for (const [du, dv] of [[-0.07, -0.03], [0.05, 0.04]]) for (let i = 0; i < 4; i++) S.box(pu + du - 0.06, pv + dv - 0.035, 1 + i * 1.3, 0.12, 0.07, 1.3, C3(i % 2 ? '#FFFDF7' : '#F28CA8'), '', 0.6);
      }
      return S.out();
    },
  },
  penanaknasi: {
    label: 'Penanak nasi di lemari kecil',
    colors: { main: '#FFFDF7', accent: '#B98552' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), k = rk(g), T = 30, A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z);
      // lemari kecil berpintu
      let door = g.quadY(y + 0.86, x + 0.18, x + 0.82, 5, 25, shade(c.accent, -0.06), 1.1);
      if (!g.back) { const p = A(0.74, 0.86, 15); door += circ(p[0], p[1], 1.8 * s, '#E9B949', s, 0.9); }
      S.box(x + 0.12, y + 0.14, 0, 0.76, 0.72, T, C3(c.accent), door);
      // penanak nasi putih bermotif kembang
      const cu = x + 0.42, cv = y + 0.46;
      {
        let h = lathe(g, cu, cv, [[T, 0.17], [T + 1.5, 0.21], [T + 14, 0.22], [T + 16, 0.2]], c.main);
        const [px, py] = at3(g, cu, cv, T + 8);
        for (const [dx, col] of [[-0.12, '#F28CA8'], [0, '#7FC4E8'], [0.12, '#F28CA8']] as [number, string][]) h += bloom(px + dx * k, py + (Math.abs(dx) > 0.05 ? -1 : 1.2) * s, 3.4 * s, col, s, '#F7C548', 0.6);
        h += frontArc(g, cu, cv, T + 14, 0.215, '#C9CED6', 1.6);
        if (!g.back) {
          // panel tombol & lampu menyala di depan
          const q = A(0.42, 0.46 + 0.2, T + 4);
          h += `<rect x="${f1(q[0] - 3.4 * s)}" y="${f1(q[1] - 3 * s)}" width="${f1(6.8 * s)}" height="${f1(4.6 * s)}" rx="${f1(1 * s)}" fill="#3B3F55" stroke="${INK}" stroke-width="${f1(0.8 * s)}"/>` + circ(q[0] - 1.4 * s, q[1] - 0.7 * s, 0.9 * s, '#F2994A', s, 0) + circ(q[0] + 1.4 * s, q[1] - 0.7 * s, 0.9 * s, '#6BCB77', s, 0);
        }
        h += lathe(g, cu, cv, [[T + 16, 0.2], [T + 19, 0.18], [T + 22, 0.1], [T + 23, 0.04]], shade(c.main, -0.04));
        const [tx, ty] = at3(g, cu, cv, T + 22);
        h += `<path d="M${f1(tx - 0.16 * k)} ${f1(ty + 3 * s)}Q${f1(tx)} ${f1(ty - 12 * s)} ${f1(tx + 0.16 * k)} ${f1(ty + 3 * s)}" fill="none" stroke="${INK}" stroke-width="${f1(3.4 * s)}" stroke-linecap="round"/><path d="M${f1(tx - 0.16 * k)} ${f1(ty + 3 * s)}Q${f1(tx)} ${f1(ty - 12 * s)} ${f1(tx + 0.16 * k)} ${f1(ty + 3 * s)}" fill="none" stroke="#C9CED6" stroke-width="${f1(1.6 * s)}" stroke-linecap="round"/>`;
        h += circ(tx + 3 * s, ty + 1 * s, 1.4 * s, '#9AA7B8', s, 0.8) + wisp(tx + 3 * s, ty - 1 * s, s, 14);
        S.add(cu - 0.22, cv - 0.22, cu + 0.22, cv + 0.22, T, T + 40, h);
      }
      // mangkuk nasi mengepul & centong
      {
        const bu = x + 0.72, bv = y + 0.7;
        let h = lathe(g, bu, bv, [[T, 0.05], [T + 2, 0.08], [T + 5, 0.1]], '#7FC4E8', 1.1) + frontArc(g, bu, bv, T + 3.5, 0.09, '#FFFDF7', 1.2);
        const [px, py] = at3(g, bu, bv, T + 5);
        h += `<path d="M${f1(px - 0.1 * k)} ${f1(py)}Q${f1(px - 0.08 * k)} ${f1(py - 6 * s)} ${f1(px)} ${f1(py - 6.5 * s)}Q${f1(px + 0.08 * k)} ${f1(py - 6 * s)} ${f1(px + 0.1 * k)} ${f1(py)}Z" fill="#FFFFFF" stroke="${INK}" stroke-width="${f1(1 * s)}"/>`;
        for (const [dx, dy] of [[-2, -2], [1.5, -3.5], [3, -1.2], [-0.5, -4.6]]) h += `<ellipse cx="${f1(px + dx * s)}" cy="${f1(py + dy * s)}" rx="${f1(1 * s)}" ry="${f1(0.6 * s)}" fill="#EDE6D6"/>`;
        h += wisp(px - 1 * s, py - 7 * s, s, 12);
        S.add(bu - 0.1, bv - 0.1, bu + 0.1, bv + 0.1, T, T + 8, h);
        const c0 = A(0.66, 0.24, T + 1), c1 = A(0.8, 0.36, T + 1);
        S.add(x + 0.62, y + 0.22, x + 0.84, y + 0.4, T, T + 2, inkLine([c0, c1], '#F4EAD2', 2.6, s) + ell(c1[0] + 1.5 * s, c1[1] + 0.8 * s, 4 * s, 2.4 * s, '#F4EAD2', s, 1));
      }
      return S.out();
    },
  },
  dispenser: {
    label: 'Galon & dispenser air',
    colors: { main: '#E9EEF2', accent: '#5BB6E8' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), k = rk(g), A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z), Yf = y + 0.78, H = 60;
      // badan dispenser: pintu lemari bawah & ceruk keran (hanya dari depan)
      let front = g.quadY(Yf, x + 0.28, x + 0.72, 4, 16, shade(c.main, -0.06), 1.1) + g.quadY(Yf, x + 0.3, x + 0.7, 22, 44, '#5E6878', 1.1) + g.quadY(Yf, x + 0.3, x + 0.7, 22, 25, '#9AA7B8', 0.9);
      if (!g.back) {
        for (const [u, col] of [[0.41, '#E0583F'], [0.59, '#3F7FBF']] as [number, string][]) {
          const p = A(u, 0.78, 40);
          front += `<rect x="${f1(p[0] - 2.4 * s)}" y="${f1(p[1] - 3 * s)}" width="${f1(4.8 * s)}" height="${f1(5 * s)}" rx="${f1(1.2 * s)}" fill="${col}" stroke="${INK}" stroke-width="${f1(0.9 * s)}"/>`;
          front += thinLine([[p[0], p[1] + 2 * s], [p[0], p[1] + 5 * s]], '#C9CED6', 1.6 * s);
        }
        // gelas di atas tatakan
        const q = A(0.59, 0.78, 25);
        front += `<path d="M${f1(q[0] - 3 * s)} ${f1(q[1] - 9 * s)}L${f1(q[0] - 2.4 * s)} ${f1(q[1])}H${f1(q[0] + 2.4 * s)}L${f1(q[0] + 3 * s)} ${f1(q[1] - 9 * s)}Z" fill="#DDF3FF" stroke="${INK}" stroke-width="${f1(0.9 * s)}"/><path d="M${f1(q[0] - 2.7 * s)} ${f1(q[1] - 5 * s)}H${f1(q[0] + 2.7 * s)}" stroke="#7FC4E8" stroke-width="${f1(1.2 * s)}"/>`;
        const kn = A(0.66, 0.78, 10);
        front += circ(kn[0], kn[1], 1.4 * s, '#9AA7B8', s, 0.8);
        const lt = A(0.36, 0.78, 50);
        front += circ(lt[0], lt[1], 1.5 * s, '#E0583F', s, 0.7) + circ(lt[0] + 4 * s, lt[1] + 2 * s, 1.5 * s, '#6BCB77', s, 0.7);
      } else {
        // dari belakang: kisi udara
        let ln = '';
        for (let z = 18; z < 50; z += 5) ln += seg(A(0.32, 0.22, z), A(0.68, 0.22, z));
        front += `<path d="${ln}" stroke="${shade(c.main, -0.4)}" stroke-width="${f1(1.4 * s)}" stroke-linecap="round"/>`;
      }
      S.box(x + 0.22, y + 0.22, 0, 0.56, 0.56, H, C3(c.main), front);
      // leher & galon biru terbalik
      const cu = x + 0.5, cv = y + 0.5;
      S.add(cu - 0.2, cv - 0.2, cu + 0.2, cv + 0.2, H, H + 4, lathe(g, cu, cv, [[H, 0.2], [H + 3, 0.18]], shade(c.main, -0.08), 1.2));
      {
        let h = lathe(g, cu, cv, [[H + 2, 0.06], [H + 5, 0.11], [H + 9, 0.21], [H + 11, 0.24], [H + 30, 0.24], [H + 33, 0.22], [H + 35, 0.14], [H + 36, 0.05]], c.accent, 1.5);
        h += lathe(g, cu, cv, [[H + 2, 0.06], [H + 5, 0.06]], '#3F7FBF', 1);
        for (const z of [H + 16, H + 24]) h += frontArc(g, cu, cv, z, 0.235, shade(c.accent, -0.22), 1.2);
        const [px, py] = at3(g, cu, cv, H + 12);
        h += thinLine([[px - 0.14 * k, py], [px - 0.14 * k, py - 18 * s]], '#FFFFFF', 2.4 * s, ' opacity=".7"') + thinLine([[px - 0.08 * k, py - 4 * s], [px - 0.08 * k, py - 12 * s]], '#FFFFFF', 1.2 * s, ' opacity=".6"');
        for (const [dx, dy, r] of [[0.06, -6, 1.6], [0.1, -12, 1.2], [0.03, -17, 1]]) h += circ(px + dx * k, py + dy * s, r * s, '#DDF3FF', s, 0.5);
        h += flatE(g, cu, cv, H + 36, 0.06, shade(c.accent, 0.15), 1);
        S.add(cu - 0.24, cv - 0.24, cu + 0.24, cv + 0.24, H + 4, H + 36, h);
      }
      return S.out();
    },
  },
  blender: {
    label: 'Blender jus di meja kecil',
    colors: { main: '#E0583F', accent: '#F2994A' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), k = rk(g), T = 30, A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z), wood = C3('#C49A64'), leg = C3(shade('#C49A64', -0.1));
      for (const u of [0.13, 0.79]) for (const v of [0.13, 0.79]) S.box(x + u, y + v, 0, 0.08, 0.08, T - 3, leg);
      S.box(x + 0.14, y + 0.14, 8, 0.72, 0.72, 2, wood);
      // keranjang jeruk di rak bawah
      {
        const bu = x + 0.5, bv = y + 0.52;
        let h = lathe(g, bu, bv, [[10, 0.16], [16, 0.2]], '#C8955A', 1.2) + frontArc(g, bu, bv, 13, 0.18, '#9A6B3E', 1.2);
        const [px, py] = at3(g, bu, bv, 16);
        for (const [dx, dy] of [[-6, 0], [0, -2], [6, 0], [-3, 2], [3, 2]]) h += fruit(px + dx * s, py + dy * s, 3.4 * s, '#F2994A', s);
        S.add(bu - 0.2, bv - 0.2, bu + 0.2, bv + 0.2, 10, 20, h);
      }
      S.box(x + 0.1, y + 0.1, T - 3, 0.8, 0.8, 3, wood);
      // blender: dasar bertombol (tombol hanya dari depan), gelas berisi jus
      const cu = x + 0.38, cv = y + 0.36;
      let base = '';
      if (!g.back) for (const [i, col] of [[0, '#FFFDF7'], [1, '#F7C548'], [2, '#6BCB77']] as [number, string][]) { const p = A(0.38 - 0.06 + i * 0.06, 0.36 + 0.11, T + 4); base += circ(p[0], p[1], 1.3 * s, col, s, 0.7); }
      S.box(cu - 0.11, cv - 0.11, T, 0.22, 0.22, 8, C3(c.main), base, 1.3);
      {
        let h = lathe(g, cu, cv, [[T + 8, 0.08], [T + 10, 0.09], [T + 30, 0.12], [T + 32, 0.12]], '#EAF6FA', 1.3);
        h += lathe(g, cu, cv, [[T + 10, 0.083], [T + 24, 0.108]], c.accent, 0);
        h += flatE(g, cu, cv, T + 24, 0.108, shade(c.accent, 0.18), 0.8);
        const [px, py] = at3(g, cu, cv, T + 14);
        h += `<path d="M${f1(px - 4 * s)} ${f1(py)}l${f1(8 * s)} ${f1(-2 * s)}M${f1(px - 4 * s)} ${f1(py - 2 * s)}l${f1(8 * s)} ${f1(2 * s)}" stroke="#9AA7B8" stroke-width="${f1(1.2 * s)}"/>`;
        h += thinLine([[px - 0.09 * k, py - 2 * s], [px - 0.1 * k, py - 16 * s]], '#FFFFFF', 1.8 * s, ' opacity=".8"');
        // gagang di samping gelas
        const g0 = at3(g, cu + 0.12, cv, T + 28), g1 = at3(g, cu + 0.17, cv, T + 24), g2 = at3(g, cu + 0.16, cv, T + 14), g3 = at3(g, cu + 0.11, cv, T + 12);
        h += inkLine([g0, g1, g2, g3], '#EAF6FA', 1.6, s);
        h += lathe(g, cu, cv, [[T + 32, 0.125], [T + 35, 0.11]], '#3B3F55', 1.2) + lathe(g, cu, cv, [[T + 35, 0.04], [T + 38, 0.04]], '#3B3F55', 1);
        S.add(cu - 0.13, cv - 0.13, cu + 0.18, cv + 0.13, T + 8, T + 38, h);
      }
      // segelas jus bersedotan
      {
        const gu = x + 0.74, gv = y + 0.46;
        let h = lathe(g, gu, gv, [[T, 0.05], [T + 12, 0.065]], c.accent, 1.2) + flatE(g, gu, gv, T + 12, 0.065, shade(c.accent, 0.2), 1);
        const [px, py] = at3(g, gu, gv, T + 12);
        h += inkLine([[px + 1 * s, py], [px + 4 * s, py - 10 * s], [px + 7 * s, py - 12 * s]], '#E0583F', 1.2, s);
        h += `<path d="M${f1(px - 0.04 * k)} ${f1(py - 1 * s)}l${f1(-2 * s)} ${f1(-3 * s)}l${f1(4 * s)} ${f1(-1 * s)}Z" fill="#F7E05A" stroke="${INK}" stroke-width="${f1(0.7 * s)}"/>`;
        S.add(gu - 0.07, gv - 0.07, gu + 0.07, gv + 0.07, T, T + 14, h);
      }
      // buah: dua jeruk & alpukat terbelah
      {
        const fu = x + 0.4, fv = y + 0.74;
        const [px, py] = at3(g, fu, fv, T);
        let h = fruit(px - 5 * s, py - 3.6 * s, 4 * s, '#F2994A', s) + fruit(px + 3 * s, py - 4.6 * s, 4 * s, '#F2B632', s);
        h += `<path d="M${f1(px - 2 * s)} ${f1(py + 2 * s)}q${f1(-3 * s)} ${f1(-6 * s)} ${f1(3 * s)} ${f1(-9 * s)}q${f1(6 * s)} ${f1(3 * s)} ${f1(3 * s)} ${f1(9 * s)}Z" fill="#B7D46A" stroke="${INK}" stroke-width="${f1(1 * s)}"/>` + circ(px + 1.4 * s, py - 1.5 * s, 2.2 * s, '#8A5A36', s, 0.8);
        S.add(fu - 0.12, fv - 0.12, fu + 0.12, fv + 0.12, T, T + 9, h);
      }
      return S.out();
    },
  },
  rakbumbu: {
    label: 'Rak bumbu & cobek',
    colors: { main: '#A86E3F', accent: '#5E5A55' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), k = rk(g), T = 26, A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z), wood = C3(c.main), dk = C3(shade(c.main, -0.2));
      // meja kayu rendah
      for (const u of [0.1, 0.82]) for (const v of [0.12, 0.82]) S.box(x + u, y + v, 0, 0.08, 0.08, T - 3, wood);
      S.box(x + 0.08, y + 0.1, T - 3, 0.84, 0.82, 3, wood);
      // rak bumbu di belakang meja: papan punggung (dari belakang tampak papan-papan & gantungan), dua bilah rak, stoples
      let planks = '';
      if (g.back) {
        let ln = '';
        for (const u of [0.31, 0.5, 0.69]) ln += seg(A(u, 0.1, T + 2), A(u, 0.1, T + 56));
        planks = `<path d="${ln}" stroke="${shade(c.main, -0.42)}" stroke-width="${f1(1.1 * s)}"/>`;
        const hk = A(0.5, 0.1, T + 48);
        planks += `<path d="M${f1(hk[0] - 4 * s)} ${f1(hk[1])}q${f1(4 * s)} ${f1(-7 * s)} ${f1(8 * s)} 0" fill="none" stroke="${INK}" stroke-width="${f1(1.4 * s)}"/>` + circ(hk[0], hk[1] - 3.6 * s, 1.2 * s, '#C9CED6', s, 0.8);
      }
      S.box(x + 0.12, y + 0.1, T, 0.76, 0.05, 58, dk, planks);
      for (const z of [T + 18, T + 38]) S.box(x + 0.12, y + 0.15, z, 0.76, 0.14, 2.5, wood, '', 1.2);
      for (const u of [0.12, 0.84]) S.box(x + u, y + 0.15, T, 0.04, 0.14, 44, wood, '', 1.1);
      const jar = (u: number, z: number, col: string, lid: string) => {
        const ju = x + u, jv = y + 0.22;
        let h = lathe(g, ju, jv, [[z, 0.045], [z + 9, 0.05]], '#F4F0E4', 1) + lathe(g, ju, jv, [[z + 0.5, 0.042], [z + 6, 0.046]], col, 0);
        h += lathe(g, ju, jv, [[z + 9, 0.052], [z + 11, 0.052]], lid, 1) + flatE(g, ju, jv, z + 11, 0.052, shade(lid, 0.2), 0.8);
        S.add(ju - 0.05, jv - 0.05, ju + 0.05, jv + 0.05, z, z + 11, h);
      };
      [[0.24, '#D6402E', '#E0583F'], [0.38, '#F2C14E', '#3FA06A'], [0.52, '#8A5A36', '#E0583F'], [0.66, '#FFFDF7', '#3F7FBF'], [0.78, '#C0392B', '#3FA06A']].forEach(([u, col, lid]) => jar(u as number, T + 20.5, col as string, lid as string));
      [[0.26, '#6BA35A', '#F2B632'], [0.42, '#F2994A', '#3F7FBF'], [0.58, '#E9D8B0', '#E0583F'], [0.74, '#7A4A2A', '#F2B632']].forEach(([u, col, lid]) => jar(u as number, T + 40.5, col as string, lid as string));
      // cobek batu berisi sambal + ulekan
      {
        const cu = x + 0.44, cv = y + 0.6;
        let h = lathe(g, cu, cv, [[T, 0.15], [T + 3, 0.21], [T + 6, 0.23]], c.accent, 1.4) + flatE(g, cu, cv, T + 6, 0.23, shade(c.accent, 0.15), 1.2) + flatE(g, cu, cv, T + 5.6, 0.17, '#C0392B', 0.8);
        const [px, py] = at3(g, cu, cv, T + 5.6);
        for (const [dx, dy] of [[-4, 0], [3, -1], [0, 1.5], [5, 1]]) h += circ(px + dx * s, py + dy * s, 0.9 * s, '#F2C14E', s, 0);
        S.add(cu - 0.23, cv - 0.23, cu + 0.23, cv + 0.23, T, T + 6, h);
        const u0 = at3(g, cu + 0.04, cv - 0.02, T + 6), u1 = at3(g, cu + 0.16, cv - 0.1, T + 20);
        S.add(cu, cv - 0.12, cu + 0.18, cv, T + 6, T + 20, inkLine([u0, u1], shade(c.accent, 0.1), 4, s));
      }
      // cabai, bawang merah & bawang putih
      {
        const bu = x + 0.76, bv = y + 0.76, [px, py] = at3(g, bu, bv, T);
        let h = '';
        for (const [dx, dy, a] of [[-6, 1, -20], [-2, 3, 10], [2, 0, -40]]) h += `<path transform="rotate(${a} ${f1(px + dx * s)} ${f1(py + dy * s)})" d="M${f1(px + dx * s - 5 * s)} ${f1(py + dy * s)}q${f1(5 * s)} ${f1(3 * s)} ${f1(10 * s)} ${f1(-1 * s)}q${f1(-5 * s)} ${f1(-1 * s)} ${f1(-10 * s)} ${f1(1 * s)}Z" fill="#D6402E" stroke="${INK}" stroke-width="${f1(0.8 * s)}"/>`;
        for (const [dx, dy, col] of [[5, -3, '#B5486A'], [8, 0, '#B5486A'], [3, 3, '#F4F0E4']] as [number, number, string][]) h += `<path d="M${f1(px + dx * s)} ${f1(py + dy * s - 5 * s)}q${f1(3.4 * s)} ${f1(3 * s)} ${f1(2.6 * s)} ${f1(5 * s)}q${f1(-2.6 * s)} ${f1(2 * s)} ${f1(-5.2 * s)} 0q${f1(-0.8 * s)} ${f1(-2 * s)} ${f1(2.6 * s)} ${f1(-5 * s)}Z" fill="${col}" stroke="${INK}" stroke-width="${f1(0.8 * s)}"/>`;
        S.add(bu - 0.12, bv - 0.12, bu + 0.12, bv + 0.12, T, T + 6, h);
      }
      return S.out();
    },
  },
  bakcuci: {
    label: 'Bak cuci piring',
    colors: { main: '#7FB5A8', accent: '#D9DCE0' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), k = rk(g), A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z), Yf = y + 0.88, T = 38;
      // lemari bawah tiga pintu (gagang hanya dari depan)
      let doors = '';
      for (const [u0, u1] of [[0.12, 0.66], [0.7, 1.24], [1.28, 1.88]]) {
        doors += g.quadY(Yf, x + u0, x + u1, 4, 30, shade(c.main, 0.06), 1.1);
        if (!g.back) { const p = A(u1 - 0.07, 0.88, 22); doors += `<rect x="${f1(p[0] - 1 * s)}" y="${f1(p[1] - 4 * s)}" width="${f1(2 * s)}" height="${f1(7 * s)}" rx="${f1(1 * s)}" fill="#C9CED6" stroke="${INK}" stroke-width="${f1(0.7 * s)}"/>`; }
      }
      S.box(x + 0.06, y + 0.18, 0, 1.88, 0.7, 34, C3(c.main), doors);
      // meja atas & bak cuci (lubang berisi air bersabun)
      let sink = hole(g, x + 0.22, y + 0.32, x + 0.94, y + 0.78, T, 8, '#AEB7C4', '#BFE3F5');
      {
        const [px, py] = at3(g, x + 0.58, y + 0.55, T - 7.6);
        for (const [dx, dy, r] of [[-8, -1, 2.6], [-4, 1, 3.2], [1, -1, 2.4], [5, 1.5, 3], [9, 0, 2.2], [-1, 2.5, 2]]) sink += circ(px + dx * s, py + dy * s, r * s, '#FFFFFF', s, 0.6);
        sink += thinLine([at3(g, x + 0.36, y + 0.62, T - 7.4), at3(g, x + 0.5, y + 0.66, T - 7.4)], '#FFFDF7', 2.4 * s);
      }
      S.box(x + 0.02, y + 0.14, 34, 1.96, 0.78, 4, C3(c.accent), sink);
      // keran leher angsa
      {
        const u = 0.58, p0 = A(u, 0.24, T), p1 = A(u, 0.24, T + 16), p2 = A(u, 0.32, T + 21), p3 = A(u, 0.42, T + 17), p4 = A(u, 0.43, T + 13);
        let h = inkLine([p0, p1, p2, p3, p4], '#C9CED6', 2.4, s);
        for (const du of [-0.08, 0.08]) { const q = A(u + du, 0.24, T + 4); h += circ(q[0], q[1], 1.8 * s, du < 0 ? '#E0583F' : '#3F7FBF', s, 0.8); }
        S.add(x + u - 0.1, y + 0.2, x + u + 0.1, y + 0.44, T, T + 22, h);
      }
      // spons & sabun cair di pinggir bak
      S.box(x + 0.1, y + 0.6, T, 0.08, 0.12, 3, C3('#F7E05A'), '', 1);
      S.box(x + 0.1, y + 0.6, T + 3, 0.08, 0.12, 1.4, C3('#3FA06A'), '', 0.8);
      {
        const bu = x + 0.14, bv = y + 0.32;
        S.add(bu - 0.05, bv - 0.05, bu + 0.05, bv + 0.05, T, T + 14, lathe(g, bu, bv, [[T, 0.045], [T + 9, 0.045], [T + 11, 0.03]], '#6BCB77', 1) + lathe(g, bu, bv, [[T + 11, 0.012], [T + 14, 0.012]], '#FFFDF7', 0.8));
      }
      // rak piring: alas, kawat, piring berdiri & cangkir
      S.box(x + 1.1, y + 0.3, T, 0.78, 0.5, 2, C3('#C9CED6'), '', 1);
      // kawat rak: dua bingkai ujung (garis tipis) — dari depan dan belakang sama
      for (const u of [1.14, 1.84]) {
        const fr = [A(u, 0.32, T + 2), A(u, 0.32, T + 14), A(u, 0.78, T + 14), A(u, 0.78, T + 2)];
        S.add(x + u - 0.01, y + 0.3, x + u + 0.01, y + 0.8, T + 2, T + 14, thinLine(fr, INK, 2.6 * s) + thinLine(fr, '#C9CED6', 1.2 * s) + thinLine([A(u, 0.55, T + 2), A(u, 0.55, T + 14)], '#9AA7B8', 1 * s));
      }
      S.add(x + 1.14, y + 0.31, x + 1.84, y + 0.33, T + 13, T + 14, thinLine([A(1.14, 0.32, T + 14), A(1.84, 0.32, T + 14)], INK, 2.4 * s) + thinLine([A(1.14, 0.32, T + 14), A(1.84, 0.32, T + 14)], '#C9CED6', 1 * s));
      S.add(x + 1.14, y + 0.77, x + 1.84, y + 0.79, T + 13, T + 14, thinLine([A(1.14, 0.78, T + 14), A(1.84, 0.78, T + 14)], INK, 2.4 * s) + thinLine([A(1.14, 0.78, T + 14), A(1.84, 0.78, T + 14)], '#C9CED6', 1 * s));
      [[1.24, '#FFFDF7'], [1.32, '#7FC4E8'], [1.4, '#FFFDF7'], [1.48, '#F7A8C4'], [1.56, '#FFFDF7']].forEach(([u, col]) => {
        const m = onX(g, x + (u as number), y + 0.55, T + 2);
        S.add(x + (u as number) - 0.01, y + 0.4, x + (u as number) + 0.01, y + 0.7, T + 2, T + 22, g.poly(discPts(m, 0, 9.5, 9.5, 9.5, 22), col as string, 1.1) + g.poly(discPts(m, 0, 9.5, 6, 6, 18), shade(col as string, -0.06), 0.6));
      });
      for (const [u, v] of [[1.72, 0.42], [1.72, 0.66]]) S.add(x + u - 0.06, y + v - 0.06, x + u + 0.06, y + v + 0.06, T + 2, T + 9, lathe(g, x + u, y + v, [[T + 2, 0.055], [T + 9, 0.045]], '#F2B632', 1) + flatE(g, x + u, y + v, T + 9, 0.045, shade('#F2B632', -0.15), 0.8));
      return S.out();
    },
  },
  sampahpilah: {
    label: 'Tempat sampah pilah',
    colors: { main: '#3FA06A', accent: '#F2B632' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z), Yf = y + 0.8, H = 40;
      const bin = (u0: number, col: string, mark: 'daun' | 'botol') => {
        // pedal kecil di depan bawah
        S.box(x + u0 + 0.12, y + 0.8, 0, 0.14, 0.08, 3, C3('#5E6878'), '', 1);
        let front = g.quadY(Yf, x + u0 + 0.04, x + u0 + 0.34, 6, 34, shade(col, 0.1), 1);
        if (!g.back) {
          const m = onY(g, Yf, x + u0 + 0.19, 20);
          if (mark === 'daun') {
            front += g.poly([m(0, -8), m(-5, -2), m(-5, 4), m(0, 9), m(5, 4), m(5, -2)], '#FFFDF7', 1) + thinLine([m(0, -8), m(0, 7)], col, 1.2 * s) + thinLine([m(0, -1), m(3, 3)], col, 1 * s) + thinLine([m(0, 2), m(-3, 5)], col, 1 * s);
          } else {
            front += g.poly([m(-2, 10), m(2, 10), m(2, 6), m(4, 3), m(4, -8), m(-4, -8), m(-4, 3), m(-2, 6)], '#FFFDF7', 1) + g.poly([m(-4, -3), m(4, -3), m(4, -6), m(-4, -6)], shade(col, -0.2), 0.6);
          }
        }
        S.box(x + u0, y + 0.22, 0, 0.38, 0.58, H, C3(col), front, 1.4);
        // tutup berengsel & pegangan
        S.box(x + u0 - 0.01, y + 0.2, H, 0.4, 0.62, 4, C3(shade(col, -0.18)), '', 1.3);
        S.box(x + u0 + 0.12, y + 0.46, H + 4, 0.14, 0.06, 2.5, C3(shade(col, -0.35)), '', 1);
      };
      bin(0.08, c.main, 'daun');
      bin(0.54, c.accent, 'botol');
      return S.out();
    },
  },
  mejataplak: {
    label: 'Meja makan taplak kotak-kotak',
    colors: { main: '#A8703F', accent: '#D6402E' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), k = rk(g), A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z), wood = C3(c.main), dk = C3(shade(c.main, -0.1)), T = 30;
      const t0 = 0.42, t1 = 1.58;
      // kursi kayu di empat sisi, sandaran di sisi luar
      const chair = (cu: number, cv: number, du: number, dv: number) => {
        const r = 0.17, u0 = x + cu - r, v0 = y + cv - r;
        for (const [a, b] of [[0, 0], [2 * r - 0.06, 0], [0, 2 * r - 0.06], [2 * r - 0.06, 2 * r - 0.06]]) S.box(u0 + a, v0 + b, 0, 0.06, 0.06, 16, dk, '', 1.1);
        S.box(u0, v0, 16, 2 * r, 2 * r, 3, wood, '', 1.2);
        // sandaran: dua tiang & papan di sisi luar (du, dv)
        const bu = du > 0 ? u0 + 2 * r - 0.05 : u0, bv = dv > 0 ? v0 + 2 * r - 0.05 : v0;
        if (du) { for (const b of [0, 2 * r - 0.05]) S.box(bu, v0 + b, 19, 0.05, 0.05, 24, dk, '', 1.1); S.box(bu - 0.005, v0, 34, 0.06, 2 * r, 8, wood, '', 1.1); }
        else { for (const a of [0, 2 * r - 0.05]) S.box(u0 + a, bv, 19, 0.05, 0.05, 24, dk, '', 1.1); S.box(u0, bv - 0.005, 34, 2 * r, 0.06, 8, wood, '', 1.1); }
      };
      chair(1, 0.2, 0, -1); chair(0.2, 1, -1, 0); chair(1, 1.8, 0, 1); chair(1.8, 1, 1, 0);
      // meja: kaki, taplak kotak-kotak menjuntai
      for (const [a, b] of [[t0 + 0.06, t0 + 0.06], [t1 - 0.12, t0 + 0.06], [t0 + 0.06, t1 - 0.12], [t1 - 0.12, t1 - 0.12]]) S.box(x + a, y + b, 0, 0.06, 0.06, T - 8, dk);
      {
        const base = [[x + t0, y + t0], [x + t1, y + t0], [x + t1, y + t1], [x + t0, y + t1]];
        let cloth = prism(g, base, T - 9, 10, ['#FFFDF7', '#F4EEE2', '#E6DCCB']);
        // garis kotak di sisi yang menjuntai
        for (const side of seenSides(g, base, T - 9)) {
          let st = '';
          for (let i = 0; i < 10; i += 2) st += pathD([side(i / 10, T - 9), side((i + 1) / 10, T - 9), side((i + 1) / 10, T + 1), side(i / 10, T + 1)]);
          cloth += `<path d="${st}" fill="${c.accent}" opacity=".55"/>`;
          let hz = '';
          for (const z of [T - 6.5, T - 1.5]) hz += pathD([side(0, z), side(1, z), side(1, z + 2.5), side(0, z + 2.5)]);
          cloth += `<path d="${hz}" fill="${c.accent}" opacity=".55"/>`;
          // ujung taplak bergelombang
          const wv: Pt[] = [];
          for (let i = 0; i <= 10; i++) { const p = side(i / 10, T - 9); wv.push([p[0], p[1] + (i % 2 ? 1.6 : 0) * s]); }
          cloth += thinLine(wv, INK, 1.2 * s);
        }
        cloth += gingham(g, x + t0, y + t0, x + t1, y + t1, T + 1, c.accent, 10);
        cloth += g.poly([A(t0, t0, T + 1), A(t1, t0, T + 1), A(t1, t1, T + 1), A(t0, t1, T + 1)], 'none', 1.4);
        S.add(x + t0, y + t0, x + t1, y + t1, T - 9, T + 1, cloth);
      }
      const Z = T + 1;
      // bakul nasi, ayam goreng, sayur, dua gelas teh
      {
        const bu = x + 0.82, bv = y + 0.8;
        let h = lathe(g, bu, bv, [[Z, 0.1], [Z + 2, 0.13], [Z + 8, 0.17]], '#D9B26A', 1.2);
        let wv = '';
        for (let i = -3; i <= 3; i++) { const a = at3(g, bu + i * 0.03, bv, Z + 0.5), b = at3(g, bu + i * 0.05, bv, Z + 7.5); wv += seg(a, b); }
        h += `<path d="${wv}" stroke="#A9844C" stroke-width="${f1(0.8 * s)}"/>` + flatE(g, bu, bv, Z + 8, 0.17, '#C49A64', 1.1);
        const [px, py] = at3(g, bu, bv, Z + 8);
        h += `<path d="M${f1(px - 0.15 * k)} ${f1(py)}Q${f1(px)} ${f1(py - 11 * s)} ${f1(px + 0.15 * k)} ${f1(py)}Z" fill="#FFFFFF" stroke="${INK}" stroke-width="${f1(1 * s)}"/>` + wisp(px, py - 9 * s, s, 12);
        S.add(bu - 0.17, bv - 0.17, bu + 0.17, bv + 0.17, Z, Z + 16, h);
      }
      const plate = (pu: number, pv: number, food: (px: number, py: number) => string) => {
        const [px, py] = at3(g, x + pu, y + pv, Z + 1);
        S.add(x + pu - 0.15, y + pv - 0.15, x + pu + 0.15, y + pv + 0.15, Z, Z + 5, flatE(g, x + pu, y + pv, Z + 0.6, 0.15, '#FFFDF7', 1.1) + flatE(g, x + pu, y + pv, Z + 1, 0.1, '#EDE6D6', 0) + food(px, py));
      };
      plate(1.2, 0.76, (px, py) => [[-4, 0, -20], [3, -1, 25]].map(([dx, dy, a]) => `<g transform="rotate(${a} ${f1(px + dx * s)} ${f1(py + dy * s)})">${ell(px + dx * s, py + dy * s - 1 * s, 4.4 * s, 3 * s, '#C8782F', s, 1)}<path d="M${f1(px + dx * s + 3 * s)} ${f1(py + dy * s - 1 * s)}h${f1(4 * s)}" stroke="${INK}" stroke-width="${f1(2.6 * s)}" stroke-linecap="round"/><path d="M${f1(px + dx * s + 3 * s)} ${f1(py + dy * s - 1 * s)}h${f1(4 * s)}" stroke="#F4EAD2" stroke-width="${f1(1.2 * s)}" stroke-linecap="round"/></g>`).join(''));
      plate(0.8, 1.22, (px, py) => [[-4, 0], [0, -2], [4, 0], [-1, 1.5], [2, 1]].map(([dx, dy], i) => leaf(px + dx * s, py + dy * s - 1 * s, 3.4, i * 50, i % 2 ? '#3F8A4E' : '#6BA35A', s, 0.7)).join('') + circ(px + 2 * s, py - 2 * s, 1.4 * s, '#E0583F', s, 0));
      for (const [gu, gv] of [[1.3, 1.16], [1.06, 1.36]]) {
        const h = lathe(g, x + gu, y + gv, [[Z, 0.045], [Z + 10, 0.055]], '#E9A23B', 1) + flatE(g, x + gu, y + gv, Z + 10, 0.055, '#F2C14E', 0.8) + flatE(g, x + gu, y + gv, Z + 8, 0.03, '#FFFFFF', 0, ' opacity=".7"');
        S.add(x + gu - 0.06, y + gv - 0.06, x + gu + 0.06, y + gv + 0.06, Z, Z + 10, h);
      }
      return S.out();
    },
  },
};

/* ================================================================== */
/* Kamar mandi (Mebel Jati)                                            */
/* ================================================================== */

const MANDI: Record<string, FurnDef> = {
  wastafel: {
    label: 'Wastafel & cermin',
    colors: { main: '#F4F6F8', accent: '#7FB5A8' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), k = rk(g), A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z), por = C3(c.main);
      // papan punggung: cermin berbingkai hanya dari depan; dari belakang papan polos dengan gantungan
      const Yb = y + 0.2;
      let mir = g.quadY(Yb, x + 0.16, x + 0.84, 52, 92, shade(c.accent, 0.25), 1.2) + g.quadY(Yb, x + 0.21, x + 0.79, 55, 89, '#BFE3F5', 1.1);
      if (!g.back) {
        mir += thinLine([A(0.28, 0.2, 62), A(0.42, 0.2, 84)], '#FFFFFF', 3 * s, ' opacity=".8"') + thinLine([A(0.38, 0.2, 60), A(0.46, 0.2, 73)], '#FFFFFF', 1.6 * s, ' opacity=".7"');
        mir += thinLine([A(0.66, 0.2, 79), A(0.72, 0.2, 87)], '#FFFFFF', 1.6 * s, ' opacity=".6"');
      } else {
        let ln = '';
        for (const u of [0.3, 0.5, 0.7]) ln += seg(A(u, 0.14, 4), A(u, 0.14, 96));
        mir += `<path d="${ln}" stroke="${shade(c.accent, -0.35)}" stroke-width="${f1(1 * s)}"/>`;
        const hk = A(0.5, 0.14, 86);
        mir += `<path d="M${f1(hk[0] - 7 * s)} ${f1(hk[1] + 6 * s)}L${f1(hk[0])} ${f1(hk[1])}L${f1(hk[0] + 7 * s)} ${f1(hk[1] + 6 * s)}" fill="none" stroke="${INK}" stroke-width="${f1(1.2 * s)}"/>` + circ(hk[0], hk[1], 1.4 * s, '#C9CED6', s, 0.8);
      }
      S.box(x + 0.12, y + 0.14, 0, 0.76, 0.06, 98, C3(c.accent), mir);
      // rak kaca kecil: gelas sikat gigi & sabun cair
      S.box(x + 0.26, y + 0.2, 48, 0.48, 0.08, 2, C3('#DDEFF5'), '', 1);
      {
        const cu = x + 0.36, cv = y + 0.24;
        let h = '';
        for (const [dx, col, len] of [[-2, '#3F9FD8', 15], [2, '#F28CA8', 13]] as [number, string, number][]) { const p = at3(g, cu, cv, 56); h += inkLine([[p[0] + dx * s, p[1]], [p[0] + dx * 2.2 * s, p[1] - len * s]], col, 1.2, s); }
        h += lathe(g, cu, cv, [[50, 0.045], [58, 0.05]], '#F7E05A', 1);
        S.add(cu - 0.05, cv - 0.04, cu + 0.05, cv + 0.04, 50, 66, h);
        const bu = x + 0.62;
        S.add(bu - 0.04, cv - 0.04, bu + 0.04, cv + 0.04, 50, 64, lathe(g, bu, cv, [[50, 0.04], [58, 0.04], [60, 0.025]], '#9A6FC0', 1) + lathe(g, bu, cv, [[60, 0.01], [63, 0.01]], '#FFFDF7', 0.8) + inkLine([A(0.62, 0.24, 63), A(0.66, 0.24, 63)], '#FFFDF7', 0.8, s));
      }
      // kaki & mangkuk wastafel, keran
      const cu = x + 0.5, cv = y + 0.56;
      S.add(cu - 0.13, cv - 0.13, cu + 0.13, cv + 0.13, 0, 30, lathe(g, cu, cv, [[0, 0.14], [3, 0.11], [26, 0.075], [30, 0.11]], c.main));
      {
        const t = ovalTub(g, cu, cv, 0.33, 0.26, 30, 10, por, 1.5);
        let h = t.side + t.top + g.poly(t.ring(40, 0.06), '#DDEFF5', 1.1);
        const [px, py] = at3(g, cu, cv + 0.02, 40);
        h += `<ellipse cx="${f1(px)}" cy="${f1(py)}" rx="${f1(2.2 * s)}" ry="${f1(1.1 * s)}" fill="#9AA7B8" stroke="${INK}" stroke-width="${f1(0.7 * s)}"/>`;
        S.add(cu - 0.33, cv - 0.26, cu + 0.33, cv + 0.26, 30, 40, h);
        S.box(x + 0.7, y + 0.6, 40, 0.1, 0.07, 2.4, C3('#F28CA8'), '', 0.9);
      }
      {
        const fu = 0.5, p0 = A(fu, 0.34, 40), p1 = A(fu, 0.34, 49), p2 = A(fu, 0.42, 50), p3 = A(fu, 0.45, 46);
        let h = inkLine([p0, p1, p2, p3], '#C9CED6', 2.4, s);
        for (const du of [-0.09, 0.09]) { const q = A(fu + du, 0.34, 44); h += circ(q[0], q[1], 2 * s, du < 0 ? '#E0583F' : '#3F7FBF', s, 0.8); }
        S.add(x + 0.38, y + 0.3, x + 0.62, y + 0.46, 40, 51, h);
      }
      return S.out();
    },
  },
  baskombebek: {
    label: 'Baskom & bebek karet',
    colors: { main: '#3FA0D8', accent: '#F7D038' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), k = rk(g), cu = x + 0.5, cv = y + 0.5, [cx, cy] = g.iso(cu, cv), H = 16;
      S.add(x, y, x + 1, y + 1, -1, 0, shadowE(cx, cy + 2 * s, 0.48 * k, 0.24 * k));
      const t = ovalTub(g, cu, cv, 0.45, 0.45, 0, H, C3(c.main), 1.6);
      let h = t.side + frontArc(g, cu, cv, 4, 0.45, shade(c.main, -0.3), 1.2) + t.top;
      // air berbusa di dalam baskom
      h += g.poly(t.ring(H - 1.2, 0.06), '#BFE6F7', 1.1);
      const [wx, wy] = at3(g, cu, cv, H - 1.2);
      h += `<path d="M${f1(wx - 0.22 * k)} ${f1(wy + 3 * s)}q${f1(4 * s)} ${f1(2 * s)} ${f1(8 * s)} 0M${f1(wx + 0.04 * k)} ${f1(wy - 4 * s)}q${f1(4 * s)} ${f1(2 * s)} ${f1(8 * s)} 0" fill="none" stroke="#FFFFFF" stroke-width="${f1(1.4 * s)}" stroke-linecap="round"/>`;
      for (const [dx, dy, r] of [[-0.24, -2, 3.4], [-0.17, -4.5, 2.8], [-0.29, 0.5, 2.4], [-0.1, -6, 2.2], [0.2, -5, 2.6], [0.27, -3, 2]]) h += circ(wx + dx * k, wy + dy * s, r * s, '#FFFFFF', s, 0.6);
      S.add(cu - 0.45, cv - 0.45, cu + 0.45, cv + 0.45, 0, H, h);
      // bebek karet mengapung (menghadap kanan; dari belakang menghadap kiri)
      {
        const [bx, by] = at3(g, cu + 0.14, cv + 0.12, H - 1.2), f = g.back ? -1 : 1;
        let duck = `<g transform="translate(${f1(bx)} ${f1(by)}) scale(${f} 1)">`;
        duck += `<path d="M${f1(-10 * s)} ${f1(-5 * s)}Q${f1(-12 * s)} ${f1(2 * s)} ${f1(-2 * s)} ${f1(2 * s)}H${f1(6 * s)}Q${f1(11 * s)} ${f1(1 * s)} ${f1(10 * s)} ${f1(-5 * s)}Q${f1(4 * s)} ${f1(-3 * s)} ${f1(-2 * s)} ${f1(-5 * s)}Q${f1(-6 * s)} ${f1(-9 * s)} ${f1(-10 * s)} ${f1(-5 * s)}Z" fill="${c.accent}" stroke="${INK}" stroke-width="${f1(1.2 * s)}" stroke-linejoin="round"/>`;
        duck += `<path d="M${f1(-4 * s)} ${f1(-4 * s)}q${f1(4 * s)} ${f1(3 * s)} ${f1(8 * s)} 0" fill="none" stroke="${shade(c.accent, -0.25)}" stroke-width="${f1(1 * s)}"/>`;
        duck += circ(5 * s, -11 * s, 5 * s, c.accent, s, 1.2);
        duck += `<path d="M${f1(9 * s)} ${f1(-12 * s)}q${f1(5 * s)} ${f1(0.5 * s)} ${f1(5 * s)} ${f1(2 * s)}q${f1(-2 * s)} ${f1(1.6 * s)} ${f1(-5 * s)} ${f1(0.8 * s)}Z" fill="#F2994A" stroke="${INK}" stroke-width="${f1(0.9 * s)}" stroke-linejoin="round"/>`;
        duck += circ(6.4 * s, -12.6 * s, 1.1 * s, INK, s, 0) + circ(6.8 * s, -13 * s, 0.4 * s, '#FFFFFF', s, 0);
        S.add(cu + 0.02, cv, cu + 0.3, cv + 0.26, H - 1.2, H + 14, duck + '</g>');
      }
      // gayung di bibir baskom
      {
        const gu = cu - 0.3, gv = cv - 0.24;
        let h = lathe(g, gu, gv, [[H - 2, 0.07], [H + 4, 0.09]], '#F2994A', 1.1) + flatE(g, gu, gv, H + 4, 0.09, shade('#F2994A', -0.2), 1);
        h += inkLine([at3(g, gu + 0.08, gv, H + 2), at3(g, gu + 0.22, gv + 0.04, H + 6)], '#F2994A', 1.8, s);
        S.add(gu - 0.09, gv - 0.09, gu + 0.24, gv + 0.09, H, H + 6, h);
      }
      return S.out();
    },
  },
  embergilas: {
    label: 'Ember & papan gilas',
    colors: { main: '#3F9FD8', accent: '#C49A64' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), k = rk(g), A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z);
      // ember berisi air sabun & cucian
      {
        const cu = x + 0.36, cv = y + 0.38, H = 24;
        let h = shadowE(...(g.iso(cu, cv) as [number, number]), 0.28 * k, 0.14 * k) + lathe(g, cu, cv, [[0, 0.2], [H - 2, 0.25], [H, 0.265]], c.main);
        h += frontArc(g, cu, cv, 7, 0.215, shade(c.main, -0.25), 1.2) + flatE(g, cu, cv, H, 0.265, shade(c.main, 0.15), 1.3) + flatE(g, cu, cv, H - 0.6, 0.22, '#DDF3FF', 1);
        const [px, py] = at3(g, cu, cv, H - 0.6);
        h += `<path d="M${f1(px - 8 * s)} ${f1(py + 1 * s)}q${f1(3 * s)} ${f1(-9 * s)} ${f1(9 * s)} ${f1(-6 * s)}l${f1(1 * s)} ${f1(6 * s)}Z" fill="#E0583F" stroke="${INK}" stroke-width="${f1(1 * s)}" stroke-linejoin="round"/>`;
        for (const [dx, dy, r] of [[2, 0, 3], [6, 2, 2.4], [-2, 3, 2.2], [9, -1, 1.8], [-6, -2, 2]]) h += circ(px + dx * s, py + dy * s, r * s, '#FFFFFF', s, 0.6);
        // gagang kawat
        const hl = at3(g, cu - 0.26, cv, H - 2), hr = at3(g, cu + 0.26, cv, H - 2);
        h += `<path d="M${f1(hl[0])} ${f1(hl[1])}Q${f1((hl[0] + hr[0]) / 2)} ${f1(hl[1] - 22 * s)} ${f1(hr[0])} ${f1(hr[1])}" fill="none" stroke="${INK}" stroke-width="${f1(2.4 * s)}"/><path d="M${f1(hl[0])} ${f1(hl[1])}Q${f1((hl[0] + hr[0]) / 2)} ${f1(hl[1] - 22 * s)} ${f1(hr[0])} ${f1(hr[1])}" fill="none" stroke="#C9CED6" stroke-width="${f1(1 * s)}"/>`;
        S.add(cu - 0.27, cv - 0.27, cu + 0.27, cv + 0.27, 0, H + 12, h);
      }
      // papan gilas bersandar di ember (dari belakang: punggung papan polos dengan dua palang)
      {
        const u0 = 0.88, u1 = 0.62, v0 = 0.2, v1 = 0.62, z1 = 42;
        const P4 = (a: number, b: number) => { const v = v0 + (v1 - v0) * a; return A(u0 + (u1 - u0) * b, v, z1 * b); };
        let h = g.poly([P4(0, 0), P4(1, 0), P4(1, 1), P4(0, 1)], c.accent, 1.3);
        if (!g.back) {
          h += g.poly([P4(0.14, 0.14), P4(0.86, 0.14), P4(0.86, 0.74), P4(0.14, 0.74)], '#AEB7C4', 1);
          let ln = '';
          for (let b = 0.2; b < 0.72; b += 0.06) ln += seg(P4(0.14, b), P4(0.86, b));
          h += `<path d="${ln}" stroke="#6E7887" stroke-width="${f1(1.2 * s)}"/>`;
        } else {
          let ln = '';
          for (const b of [0.25, 0.7]) ln += seg(P4(0.05, b), P4(0.95, b));
          h += `<path d="${ln}" stroke="${shade(c.accent, -0.35)}" stroke-width="${f1(2.6 * s)}" stroke-linecap="round"/>`;
        }
        S.add(x + 0.61, y + v0, x + u0, y + v1, 0, z1, h);
      }
      // dingklik kecil dengan sabun batang & sikat
      {
        const wood = C3('#A86E3F');
        for (const [a, b] of [[0.2, 0.66], [0.46, 0.66], [0.2, 0.86], [0.46, 0.86]]) S.box(x + a, y + b, 0, 0.05, 0.05, 9, C3('#8A5A36'), '', 1);
        S.box(x + 0.17, y + 0.63, 9, 0.37, 0.31, 3, wood, '', 1.2);
        S.box(x + 0.22, y + 0.7, 12, 0.12, 0.08, 3, C3('#7FD3B8'), '', 1);
        S.box(x + 0.38, y + 0.68, 12, 0.12, 0.16, 2.5, C3('#E9B949'), '', 1);
        const br = A(0.44, 0.76, 14.5);
        S.add(x + 0.38, y + 0.68, x + 0.5, y + 0.84, 14.5, 16, `<path d="M${f1(br[0] - 5 * s)} ${f1(br[1])}h${f1(10 * s)}" stroke="#6B4428" stroke-width="${f1(1.6 * s)}" stroke-dasharray="${f1(1 * s)} ${f1(1 * s)}"/>`);
      }
      return S.out();
    },
  },
  mesincuci: {
    label: 'Mesin cuci pintu depan',
    colors: { main: '#EEF1F4', accent: '#3F7FBF' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z), Yf = y + 0.86, Z0 = 3, H = 58;
      for (const [a, b] of [[0.14, 0.16], [0.8, 0.16], [0.14, 0.78], [0.8, 0.78]]) S.box(x + a, y + b, 0, 0.06, 0.06, Z0, C3('#5E6878'), '', 0.9);
      // muka depan: laci sabun, layar, tombol putar, pintu bulat dengan drum berputar (kelas swim)
      let front = g.quadY(Yf, x + 0.15, x + 0.85, 47, 55, shade(c.main, -0.07), 1.1);
      if (!g.back) {
        front += g.quadY(Yf, x + 0.19, x + 0.38, 48.5, 53.5, shade(c.main, 0.04), 0.9) + thinLine([A(0.24, 0.86, 50), A(0.33, 0.86, 50)], '#9AA7B8', 1.2 * s);
        front += g.quadY(Yf, x + 0.45, x + 0.6, 49, 53, '#2E3B4E', 0.9);
        const dot = A(0.49, 0.86, 51);
        front += circ(dot[0], dot[1], 0.9 * s, '#6BCB77', s, 0) + circ(dot[0] + 3 * s, dot[1] + 1.5 * s, 0.9 * s, '#F2B632', s, 0);
        const m = onY(g, Yf, x + 0.74, 51);
        front += g.poly(discPts(m, 0, 0, 3.6, 3.6, 16), '#C9CED6', 1) + thinLine([m(0, 0), m(0, 3)], INK, 1 * s);
        const ring = onY(g, Yf, x + 0.5, 25);
        front += g.poly(discPts(ring, 0, 0, 15, 15, 30), '#C9CED6', 1.4) + g.poly(discPts(ring, 0, 0, 11.6, 11.6, 30), '#2E3B4E', 1.1);
        // isi drum (diputar di bidang pintu): cucian warna-warni & gelembung
        let drum = `<circle r="10.6" fill="${c.accent}" opacity=".55"/>`;
        for (const [a, col] of [[0, '#E0583F'], [2.1, '#F2B632'], [4.2, '#6BCB77']] as [number, string][]) drum += `<path transform="rotate(${f1((a * 180) / Math.PI)})" d="M2 -1Q5 -7 9 -3Q8 2 5 4Q2 3 2 -1Z" fill="${col}" stroke="${INK}" stroke-width="1"/>`;
        drum += `<circle cx="-3" cy="2" r="1.8" fill="#FFFFFF" opacity=".85"/><circle cx="1.5" cy="-4" r="1.3" fill="#FFFFFF" opacity=".85"/><circle cx="-1" cy="6" r="1.1" fill="#FFFFFF" opacity=".85"/>`;
        front += `<g transform="matrix(${planeY(g, Yf, x + 0.5, 25)})"><g class="swim" style="transform-origin:0px 0px;animation-duration:3.6s">${drum}</g></g>`;
        front += thinLine([ring(-6, 6), ring(-1, 9)], '#FFFFFF', 2 * s, ' opacity=".75"') + g.poly([ring(13.5, -3), ring(17, -3), ring(17, 3), ring(13.5, 3)], '#9AA7B8', 0.9);
      } else {
        // dari belakang: selang air & buang, kisi udara, sekrup
        let ln = '';
        for (let z = 38; z < 52; z += 3.5) ln += seg(A(0.3, 0.14, z), A(0.7, 0.14, z));
        front += `<path d="${ln}" stroke="${shade(c.main, -0.35)}" stroke-width="${f1(1.3 * s)}" stroke-linecap="round"/>`;
        for (const [a, b] of [[0.2, 8], [0.8, 8], [0.2, 52], [0.8, 52]]) { const p = A(a, 0.14, b); front += circ(p[0], p[1], 1.1 * s, '#9AA7B8', s, 0.6); }
      }
      S.box(x + 0.12, y + 0.14, Z0, 0.76, 0.72, H - Z0, C3(c.main), front);
      if (g.back) {
        S.add(x + 0.2, y + 0.06, x + 0.4, y + 0.14, 0, 46, inkLine([A(0.3, 0.13, 44), A(0.3, 0.09, 40), A(0.26, 0.08, 20), A(0.24, 0.08, 2)], '#9AA7B8', 2.2, s));
        S.add(x + 0.6, y + 0.06, x + 0.8, y + 0.14, 0, 34, inkLine([A(0.68, 0.13, 32), A(0.7, 0.09, 26), A(0.74, 0.07, 4)], '#5E6878', 2.2, s));
      }
      // di atas: handuk terlipat & botol sabun cair
      S.box(x + 0.2, y + 0.28, H, 0.32, 0.36, 3, C3('#F7A8C4'), '', 1.1);
      S.box(x + 0.2, y + 0.28, H + 3, 0.32, 0.36, 3, C3('#FFFDF7'), thinLine([A(0.2, 0.46, H + 6), A(0.52, 0.46, H + 6)], '#F7A8C4', 1.6 * s), 1.1);
      {
        const bu = x + 0.68, bv = y + 0.44;
        S.add(bu - 0.07, bv - 0.07, bu + 0.07, bv + 0.07, H, H + 18, lathe(g, bu, bv, [[H, 0.06], [H + 11, 0.065], [H + 13, 0.04]], c.accent, 1.1) + lathe(g, bu, bv, [[H + 13, 0.04], [H + 16, 0.04]], '#F2B632', 1) + flatE(g, bu, bv, H + 16, 0.04, shade('#F2B632', 0.2), 0.8) + thinLine([A(0.66, 0.5, H + 3), A(0.66, 0.5, H + 9)], '#FFFFFF', 1.6 * s, ' opacity=".7"'));
      }
      return S.out();
    },
  },
  timbangan: {
    label: 'Timbangan badan & pengukur tinggi',
    colors: { main: '#3F9FD8', accent: '#F4E6C8' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), k = rk(g), A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z), Yb = y + 0.2;
      // papan pengukur tinggi: pita warna & garis ukur hanya dari depan
      let chart = '';
      if (!g.back) {
        const bands = ['#6BCB77', '#F7D038', '#F2994A', '#F28CA8', '#7FC4E8'];
        bands.forEach((col, i) => (chart += g.quadY(Yb, x + 0.3, x + 0.42, 6 + i * 18, 24 + i * 18, col, 0.9)));
        let ln = '';
        for (let z = 6; z < 96; z += 4.5) { const long = Math.round((z - 6) / 4.5) % 4 === 0; ln += seg(A(0.25, 0.2, z), A(long ? 0.3 : 0.28, 0.2, z)); }
        chart += `<path d="${ln}" stroke="${INK}" stroke-width="${f1(0.9 * s)}"/>`;
        // jerapah kecil di pita teratas (gambar, bukan tulisan)
        const m = onY(g, Yb, x + 0.36, 88);
        chart += g.poly([m(-2, -6), m(2, -6), m(2, 2), m(4, 6), m(1, 7), m(-1, 3), m(-2, 3)], '#F2B632', 0.7);
      } else {
        const hk = A(0.34, 0.14, 90);
        chart += circ(hk[0], hk[1], 1.6 * s, '#C9CED6', s, 0.8) + circ(hk[0], hk[1] + 60 * s, 1.6 * s, '#C9CED6', s, 0.8);
      }
      S.box(x + 0.22, y + 0.14, 0, 0.24, 0.06, 98, C3(c.accent), chart);
      // penggaris geser di puncak
      S.box(x + 0.2, y + 0.14, 92, 0.28, 0.24, 3, C3('#E0583F'), '', 1.1);
      // timbangan jarum: alas, karet tapak kaki, jendela angka di atas
      const tu = x + 0.62, tv = y + 0.6;
      S.box(tu - 0.28, tv - 0.3, 0, 0.56, 0.6, 7, C3(c.main), '', 1.4);
      {
        const Z = 7;
        let h = g.poly([A(0.38, 0.34, Z), A(0.86, 0.34, Z), A(0.86, 0.7, Z), A(0.38, 0.7, Z)], shade(c.main, -0.15), 1);
        for (const v of [0.43, 0.61]) h += g.poly(Array.from({ length: 14 }, (_, i) => { const a = (i / 14) * 2 * Math.PI; return A(0.62 + 0.15 * Math.cos(a), v + 0.06 * Math.sin(a), Z); }), '#2E3B4E', 0.8);
        // jendela jarum (lingkaran mendatar)
        const dc = [x + 0.62, y + 0.79];
        h += flatE(g, dc[0], dc[1], Z, 0.1, '#FFFDF7', 1);
        let tk = '';
        for (let i = 0; i < 9; i++) { const a = Math.PI + (i / 8) * Math.PI; tk += seg(at3(g, dc[0] + 0.072 * Math.cos(a), dc[1] + 0.072 * Math.sin(a), Z), at3(g, dc[0] + 0.09 * Math.cos(a), dc[1] + 0.09 * Math.sin(a), Z)); }
        h += `<path d="${tk}" stroke="${INK}" stroke-width="${f1(0.7 * s)}"/>` + thinLine([at3(g, dc[0], dc[1], Z), at3(g, dc[0] + 0.055, dc[1] - 0.055, Z)], '#E0583F', 1.4 * s);
        S.add(tu - 0.28, tv - 0.3, tu + 0.28, tv + 0.3, Z, Z + 0.5, h);
      }
      return S.out();
    },
  },
  gantunganhanduk: {
    label: 'Gantungan handuk bambu',
    colors: { main: '#D9B26A', accent: '#7FC4E8' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z), bam = C3(c.main), Y = y + 0.5;
      // dua tiang bambu beruas dengan kaki melintang
      for (const u of [0.1, 0.82]) {
        S.box(x + u - 0.02, y + 0.24, 0, 0.12, 0.52, 4, C3(shade(c.main, -0.15)), '', 1.1);
        let nodes = '';
        for (const z of [22, 44, 66]) nodes += prism(g, rect(x + u - 0.008, Y - 0.048, 0.096, 0.096), z, 2, C3(shade(c.main, -0.22)), 0.9);
        S.box(x + u, Y - 0.04, 4, 0.08, 0.08, 84, bam, nodes, 1.2);
      }
      // palang & handuk yang tersampir (tiap handuk digambar sesudah palangnya)
      const m = (cu: number, z: number) => onY(g, Y, x + cu, z);
      const rail = (z: number) => prism(g, rect(x + 0.1, Y - 0.025, 0.8, 0.05), z, 3, bam, 1.1);
      const stripes = (q: (a: number, b: number) => Pt, hw: number, b0: number, b1: number, col: string) => thinLine([q(-hw, b0), q(hw, b0)], col, 2.2 * s) + thinLine([q(-hw, b1), q(hw, b1)], col, 1.2 * s);
      {
        // palang atas: handuk kecil merah muda
        const q = m(0.66, 80);
        const h = rail(80) + g.poly([q(-6, 4), q(6, 4), q(6, -14), q(4.5, -16), q(-4.5, -16), q(-6, -14)], '#F7A8C4', 1.2) + stripes(q, 6, -10, -12.5, '#FFFDF7') + g.poly([q(-6.6, 4.5), q(6.6, 4.5), q(6.6, 1.5), q(-6.6, 1.5)], shade('#F7A8C4', -0.12), 1);
        S.add(x + 0.1, Y - 0.025, x + 0.9, Y + 0.025, 62, 85, h);
      }
      {
        // palang tengah: handuk besar bergaris
        const q = m(0.4, 56);
        const h = rail(56) + g.poly([q(-10, 4.5), q(10, 4.5), q(10, -22), q(8, -24), q(-8, -24), q(-10, -22)], c.accent, 1.3) + stripes(q, 10, -14, -17.5, '#FFFDF7') + stripes(q, 10, -4, -6.5, shade(c.accent, -0.25)) + g.poly([q(-10.6, 5), q(10.6, 5), q(10.6, 1.5), q(-10.6, 1.5)], shade(c.accent, -0.12), 1);
        S.add(x + 0.1, Y - 0.025, x + 0.9, Y + 0.025, 30, 61, h);
      }
      {
        // palang bawah: keset kain terlipat
        const q = m(0.64, 30);
        const h = rail(30) + g.poly([q(-7, 4.5), q(7, 4.5), q(7, -16), q(-7, -16)], '#F2C14E', 1.2) + thinLine([q(-7, -16), q(-7, -17.5)], '#E0583F', 1.2 * s) + `<path d="${[-5, -2.5, 0, 2.5, 5].map((hx) => seg(q(hx, -16), q(hx, -18.5))).join('')}" stroke="#E0583F" stroke-width="${f1(1.2 * s)}"/>` + thinLine([q(-7, -6), q(7, -6)], '#E0583F', 1.6 * s);
        S.add(x + 0.1, Y - 0.025, x + 0.9, Y + 0.025, 10, 34, h);
      }
      return S.out();
    },
  },
  keset: {
    label: 'Keset kain perca',
    colors: { main: '#E0583F', accent: '#F2B632' },
    draw(g, x, y, w, d, c) {
      const s = g.s, cu = x + 0.5, cv = y + 0.5;
      const ring = (ru: number, rv: number, z = 0.6) => Array.from({ length: 36 }, (_, i) => { const a = (i / 36) * 2 * Math.PI; return at3(g, cu + ru * Math.cos(a), cv + rv * Math.sin(a), z); });
      const cols = [c.main, c.accent, '#3F9FD8', '#6BCB77', '#F7A8C4', c.main];
      let o = g.poly(hull([...ring(0.44, 0.34, 0), ...ring(0.44, 0.34, 1.6)]), shade(c.main, -0.25), 1.2);
      cols.forEach((col, i) => {
        const f = 1 - i * 0.16, pts = ring(0.44 * f, 0.34 * f, 1.6);
        o += g.poly(pts, col, i ? 0.7 : 1.2);
        // anyaman kepang: garis putus-putus di tiap lingkar
        if (i < cols.length - 1) o += `<polygon points="${P(ring(0.44 * (f - 0.08), 0.34 * (f - 0.08), 1.6))}" fill="none" stroke="${shade(col, -0.25)}" stroke-width="${f1(0.9 * s)}" stroke-dasharray="${f1(2 * s)} ${f1(2 * s)}"/>`;
      });
      return o;
    },
  },
};

/* ================================================================== */
/* Taman (Toko Bangunan)                                               */
/* ================================================================== */

/** tinggi dudukan & palang Ayunan Kayu: harus sama dengan lift animasi ayun (activities.ts) & tali properti ayun */
const AYUN_SEAT = 24, AYUN_BAR = 108;

const TAMAN: Record<string, FurnDef> = {
  ayunankayu: {
    label: 'Ayunan kayu',
    colors: { main: '#8A5A36', accent: '#B98552' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z), wood = C3(c.main), Z = AYUN_BAR;
      // bidang ketuk tak terlihat di antara kedua kaki (rangka ayunan banyak ruang kosong): ketuk di mana saja di ayunan
      S.add(x + 0.1, y + 0.49, x + w - 0.1, y + 0.51, -1, 0, g.poly([A(0.1, 0.5, 0), A(w - 0.1, 0.5, 0), A(w - 0.1, 0.5, Z), A(0.1, 0.5, Z)], '#FFFFFF', 0).replace('<polygon ', '<polygon opacity="0" '));
      // kaki segitiga di kedua ujung + palang penguat
      for (const u of [0.1, w - 0.1]) {
        for (const v of [0.1, 0.9]) S.add(x + u - 0.05, y + Math.min(v, 0.5) - 0.02, x + u + 0.05, y + Math.max(v, 0.5) + 0.02, 0, Z, inkLine([A(u, v, 0), A(u, 0.5 + (v - 0.5) * 0.06, Z - 1)], c.main, 4.2, s));
        S.add(x + u - 0.03, y + 0.26, x + u + 0.03, y + 0.74, 34, 38, inkLine([A(u, 0.31, 36), A(u, 0.69, 36)], shade(c.main, 0.15), 2.6, s));
      }
      S.box(x + 0.02, y + 0.46, Z, w - 0.04, 0.08, 6, wood, '', 1.3);
      // tali & dudukan papan (kelas ayk-ayun): saat pet main ayunan, CSS game mengayunkannya bersama pet dari titik
      // tengah palang (transform-origin di bawah, koordinat lokal — benar juga di dalam gambar yang dicerminkan)
      {
        const cu = w / 2, pv = A(cu, 0.5, Z);
        let h = '';
        for (const du of [-0.4, 0.4]) h += inkLine([A(cu + du, 0.5, Z), A(cu + du, 0.5, AYUN_SEAT)], '#C8A06A', 1.8, s);
        h += prism(g, rect(x + cu - 0.46, y + 0.42, 0.92, 0.16), AYUN_SEAT - 4, 4, C3(c.accent), 1.3);
        S.add(x + cu - 0.46, y + 0.42, x + cu + 0.46, y + 0.58, AYUN_SEAT - 4, Z, `<g class="ayk-ayun" style="transform-origin:${f1(pv[0])}px ${f1(pv[1])}px">${h}</g>`);
      }
      // rumput & bunga kecil di kaki
      for (const u of [0.1, w - 0.1]) {
        const p = A(u, 0.5, 0);
        S.add(x + u - 0.08, y + 0.42, x + u + 0.08, y + 0.58, 0, 4, `<path d="M${f1(p[0] - 6 * s)} ${f1(p[1] + 1 * s)}l${f1(2 * s)} ${f1(-6 * s)}M${f1(p[0] + 5 * s)} ${f1(p[1] + 2 * s)}l${f1(-1 * s)} ${f1(-6 * s)}" stroke="#5E9E4A" stroke-width="${f1(1.6 * s)}" stroke-linecap="round"/>`);
      }
      return S.out();
    },
  },
  hamak: {
    label: 'Hamak di rangka kayu',
    colors: { main: '#8A5A36', accent: '#E0583F' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z), wood = C3(c.main);
      // alas rangka: balok panjang & kaki melintang
      S.box(x + 0.18, y + 0.45, 0, w - 0.36, 0.1, 5, wood, '', 1.3);
      for (const u of [0.12, w - 0.24]) S.box(x + u, y + 0.2, 0, 0.12, 0.6, 5, C3(shade(c.main, -0.12)), '', 1.3);
      // lengan lengkung naik ke ujung kain
      const arm = (left: boolean) => {
        const pts: Pt[] = [];
        for (let i = 0; i <= 10; i++) { const t = i / 10, u = left ? 0.2 - 0.14 * Math.sin((t * Math.PI) / 2) : w - 0.2 + 0.14 * Math.sin((t * Math.PI) / 2); pts.push(A(u, 0.5, 5 + 60 * t)); }
        return inkLine(pts, c.main, 4.6, s);
      };
      S.add(x + 0.04, y + 0.45, x + 0.22, y + 0.55, 5, 66, arm(true));
      // kain bergaris pelangi: tepi melengkung (rendah di tengah), menyempit di kedua ujung
      {
        const N = 24, z = (t: number) => 20 + 38 * (2 * t - 1) ** 2, hw = (t: number) => 0.035 + 0.2 * Math.sin(Math.PI * t) ** 0.7;
        const u = (t: number) => 0.14 + (w - 0.28) * t;
        const edge = (side: number) => Array.from({ length: N + 1 }, (_, i) => { const t = i / N; return A(u(t), 0.5 + side * hw(t), z(t)); });
        const e0 = edge(-1), e1 = edge(1);
        let h = g.poly([...e0, ...e1.reverse()], c.accent, 1.4);
        const cols = ['#F2994A', '#F7D038', '#6BCB77', '#3F9FD8'];
        cols.forEach((col, k) => {
          const f = -0.6 + k * 0.4, line = Array.from({ length: N + 1 }, (_, i) => { const t = i / N; return A(u(t), 0.5 + f * hw(t), z(t)); });
          h += thinLine(line, col, 3.2 * s);
        });
        h += g.poly([...edge(-1), ...edge(1).reverse()], 'none', 1.4);
        // tongkat perentang & tali ke ujung lengan
        for (const t of [0, 1]) {
          const uu = u(t) + (t ? -0.04 : 0.04);
          h += inkLine([A(uu, 0.3, z(t) - 2), A(uu, 0.7, z(t) - 2)], shade(c.main, 0.2), 2, s);
          const tip = A(t ? w - 0.06 : 0.06, 0.5, 66);
          h += thinLine([A(uu, 0.32, z(t) - 2), tip, A(uu, 0.68, z(t) - 2)], '#C8A06A', 1.2 * s);
        }
        // bantal kecil di satu ujung
        const pl = A(0.48, 0.5, z(0.2) + 2);
        h += `<rect x="${f1(pl[0] - 9 * s)}" y="${f1(pl[1] - 7 * s)}" width="${f1(18 * s)}" height="${f1(9 * s)}" rx="${f1(4 * s)}" transform="rotate(-24 ${f1(pl[0])} ${f1(pl[1])})" fill="#FFFDF7" stroke="${INK}" stroke-width="${f1(1.2 * s)}"/>`;
        S.add(x + 0.14, y + 0.28, x + w - 0.14, y + 0.72, 18, 62, h);
      }
      S.add(x + w - 0.22, y + 0.45, x + w - 0.04, y + 0.55, 5, 66, arm(false));
      return S.out();
    },
  },
  mejapiknik: {
    label: 'Meja piknik & bangku',
    colors: { main: '#C08A55', accent: '#C0392B' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), k = rk(g), A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z), wood = C3(c.main), dk = C3(shade(c.main, -0.15)), T = 32;
      const planks = (u0: number, u1: number, v0: number, v1: number, z: number, n: number) => {
        let ln = '';
        for (let i = 1; i < n; i++) { const v = v0 + ((v1 - v0) * i) / n; ln += seg(A(u0, v, z), A(u1, v, z)); }
        return `<path d="${ln}" stroke="${shade(c.main, -0.3)}" stroke-width="${f1(1.1 * s)}"/>`;
      };
      // kaki silang di kedua ujung (bidang x = u) & balok penyangga bangku
      for (const u of [0.36, 1.56]) {
        S.box(x + u, y + 0.16, 13, 0.08, 1.68, 3, dk, '', 1.1);
        for (const [v0, v1] of [[0.5, 1.0], [1.5, 1.0]]) S.add(x + u, y + Math.min(v0, v1) - 0.04, x + u + 0.08, y + Math.max(v0, v1) + 0.04, 0, T, inkLine([A(u + 0.04, v0, 0), A(u + 0.04, v1, T - 3)], c.main, 3.8, s));
      }
      // dua bangku & daun meja dari bilah papan
      for (const v0 of [0.18, 1.58]) S.box(x + 0.24, y + v0, 16, 1.52, 0.24, 3, wood, planks(0.24, 1.76, v0, v0 + 0.24, 19, 2), 1.3);
      S.box(x + 0.2, y + 0.62, T - 3, 1.6, 0.76, 3, wood, planks(0.2, 1.8, 0.62, 1.38, T, 4), 1.4);
      // keranjang rotan bertutup, semangka, teko es teh
      {
        const bu = x + 0.62, bv = y + 0.9;
        S.box(bu - 0.16, bv - 0.11, T, 0.32, 0.22, 10, C3('#D9B26A'), '', 1.2);
        const wv: string[] = [];
        for (const z of [T + 3.5, T + 7]) wv.push(seg(A(0.62 - 0.16, 1.01, z), A(0.62 + 0.16, 1.01, z)));
        S.box(bu - 0.17, bv - 0.12, T + 10, 0.34, 0.24, 2.5, C3(c.accent), `<path d="${wv.join('')}" stroke="#A9844C" stroke-width="${f1(1 * s)}"/>`, 1.2);
        const h0 = A(0.5, 0.9, T + 12.5), h1 = A(0.74, 0.9, T + 12.5);
        S.add(bu - 0.13, bv - 0.01, bu + 0.13, bv + 0.01, T + 12.5, T + 22, `<path d="M${f1(h0[0])} ${f1(h0[1])}Q${f1((h0[0] + h1[0]) / 2)} ${f1(h0[1] - 18 * s)} ${f1(h1[0])} ${f1(h1[1])}" fill="none" stroke="${INK}" stroke-width="${f1(3.4 * s)}"/><path d="M${f1(h0[0])} ${f1(h0[1])}Q${f1((h0[0] + h1[0]) / 2)} ${f1(h0[1] - 18 * s)} ${f1(h1[0])} ${f1(h1[1])}" fill="none" stroke="#D9B26A" stroke-width="${f1(1.6 * s)}"/>`);
      }
      {
        const pu = x + 1.12, pv = y + 1.1, [px, py] = at3(g, pu, pv, T + 1);
        let h = flatE(g, pu, pv, T + 0.6, 0.17, '#FFFDF7', 1.1);
        for (const [dx, dy, a] of [[-6, 0, -12], [2, -2, 8], [8, 1, 20]]) h += `<g transform="rotate(${a} ${f1(px + dx * s)} ${f1(py + dy * s)})"><path d="M${f1(px + dx * s - 6 * s)} ${f1(py + dy * s)}A${f1(6 * s)} ${f1(6 * s)} 0 0 1 ${f1(px + dx * s + 6 * s)} ${f1(py + dy * s)}Z" fill="#E8485A" stroke="${INK}" stroke-width="${f1(1 * s)}"/><path d="M${f1(px + dx * s - 6 * s)} ${f1(py + dy * s)}H${f1(px + dx * s + 6 * s)}" stroke="#6BCB77" stroke-width="${f1(2 * s)}"/><circle cx="${f1(px + dx * s - 1.5 * s)}" cy="${f1(py + dy * s - 2.6 * s)}" r="${f1(0.7 * s)}" fill="${INK}"/><circle cx="${f1(px + dx * s + 2 * s)}" cy="${f1(py + dy * s - 2 * s)}" r="${f1(0.7 * s)}" fill="${INK}"/></g>`;
        S.add(pu - 0.17, pv - 0.17, pu + 0.17, pv + 0.17, T, T + 7, h);
      }
      {
        const ju = x + 1.46, jv = y + 0.84;
        let h = lathe(g, ju, jv, [[T, 0.08], [T + 14, 0.09], [T + 16, 0.07]], '#EAF6FA', 1.2) + lathe(g, ju, jv, [[T + 0.5, 0.075], [T + 10, 0.085]], '#E9A23B', 0);
        h += flatE(g, ju, jv, T + 10, 0.085, '#F2C14E', 0.8) + circ(at3(g, ju, jv, T + 10)[0] - 2 * s, at3(g, ju, jv, T + 10)[1], 1.6 * s, '#FFFFFF', s, 0.6);
        h += inkLine([at3(g, ju + 0.08, jv, T + 13), at3(g, ju + 0.14, jv, T + 10), at3(g, ju + 0.12, jv, T + 4), at3(g, ju + 0.08, jv, T + 3)], '#EAF6FA', 1.4, s);
        S.add(ju - 0.09, jv - 0.09, ju + 0.15, jv + 0.09, T, T + 16, h);
        for (const [gu, gv] of [[1.3, 1.22], [0.92, 1.24]]) S.add(x + gu - 0.05, y + gv - 0.05, x + gu + 0.05, y + gv + 0.05, T, T + 8, lathe(g, x + gu, y + gv, [[T, 0.04], [T + 8, 0.05]], '#E9A23B', 1) + flatE(g, x + gu, y + gv, T + 8, 0.05, '#F2C14E', 0.8));
      }
      return S.out();
    },
  },
  bedengsayur: {
    label: 'Bedeng cabai & tomat',
    colors: { main: '#9C6B45', accent: '#E0403F' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z), H = 14;
      // bedeng papan: garis papan di sisi yang terlihat, tanah gembur di atas
      const base = [[x + 0.06, y + 0.12], [x + w - 0.06, y + 0.12], [x + w - 0.06, y + 0.88], [x + 0.06, y + 0.88]];
      let box = prism(g, base, 0, H, C3(c.main), 1.4);
      for (const side of seenSides(g, base, 0)) box += thinLine([side(0, H / 2), side(1, H / 2)], shade(c.main, -0.3), 1.1 * s);
      box += g.poly([A(0.13, 0.19, H), A(w - 0.13, 0.19, H), A(w - 0.13, 0.81, H), A(0.13, 0.81, H)], '#6B4A2E', 1.1);
      let dots = '';
      for (let i = 0; i < 18; i++) { const p = A(0.2 + ((i * 0.37) % 1) * (w - 0.4), 0.25 + ((i * 0.61) % 1) * 0.5, H); dots += `M${f1(p[0] - 1 * s)} ${f1(p[1])}h${f1(2 * s)}`; }
      box += `<path d="${dots}" stroke="#8A6440" stroke-width="${f1(1.4 * s)}" stroke-linecap="round"/>`;
      S.add(x + 0.06, y + 0.12, x + w - 0.06, y + 0.88, 0, H, box);
      // tanaman cabai (cabai merah & hijau menggantung)
      const chili = (u: number, v: number) => {
        const [px, py] = A(u, v, H);
        let h = thinLine([[px, py], [px, py - 16 * s]], '#4F7A3A', 1.8 * s);
        for (const [dx, dy, r, a, dk] of [[-8, -14, 7, -30, 1], [8, -15, 7, 30, 0], [-4, -22, 7, -60, 0], [5, -24, 7, 50, 1], [0, -30, 6.5, 0, 0], [-10, -24, 6, -40, 1], [10, -26, 6, 40, 0]] as number[][]) h += leaf(px + dx * s, py + dy * s, r, a, dk ? '#3F8A4E' : '#5DA862', s);
        for (const [dx, dy, col] of [[-6, -12, c.accent], [3, -13, '#4FA34F'], [8, -19, c.accent], [-2, -19, c.accent], [-10, -18, '#4FA34F']] as [number, number, string][]) h += `<path d="M${f1(px + dx * s - 1.4 * s)} ${f1(py + dy * s)}q${f1(1.4 * s)} ${f1(9 * s)} ${f1(3 * s)} ${f1(1 * s)}Z" fill="${col}" stroke="${INK}" stroke-width="${f1(0.8 * s)}" stroke-linejoin="round"/>`;
        S.add(x + u - 0.16, y + v - 0.16, x + u + 0.16, y + v + 0.16, H, H + 36, h);
      };
      // tanaman tomat berajir bambu
      const tomato = (u: number, v: number) => {
        const [px, py] = A(u, v, H);
        let h = inkLine([[px + 4 * s, py], [px + 4 * s, py - 44 * s]], '#D9B26A', 1.6, s);
        h += thinLine([[px, py], [px - 2 * s, py - 20 * s], [px + 1 * s, py - 34 * s]], '#4F7A3A', 1.8 * s);
        for (const [dx, dy, r, a, dk] of [[-8, -12, 7, -30, 1], [8, -16, 7, 30, 0], [-6, -24, 7, -50, 0], [6, -28, 7, 40, 1], [-2, -36, 7, -10, 0], [-10, -32, 6, -40, 1], [9, -38, 6, 30, 0]] as number[][]) h += leaf(px + dx * s, py + dy * s, r, a, dk ? '#3F8A4E' : '#5DA862', s);
        h += thinLine([[px + 1 * s, py - 22 * s], [px + 4 * s, py - 22 * s]], '#C8A06A', 1 * s);
        for (const [dx, dy, r, col] of [[-5, -14, 4, c.accent], [3, -10, 3.6, '#F2994A'], [-3, -27, 3.8, c.accent], [6, -31, 3.4, '#E9C46A'], [1, -19, 3.4, c.accent]] as [number, number, number, string][]) h += fruit(px + dx * s, py + dy * s, r * s, col, s);
        S.add(x + u - 0.16, y + v - 0.16, x + u + 0.16, y + v + 0.16, H, H + 50, h);
      };
      chili(0.34, 0.5); chili(0.74, 0.46);
      tomato(1.2, 0.5); tomato(1.62, 0.5);
      return S.out();
    },
  },
  sangkarburung: {
    label: 'Sangkar burung di tiang',
    colors: { main: '#D9B26A', accent: '#F2C230' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), k = rk(g), cu = x + 0.5, cv = y + 0.5, [cx, cy] = g.iso(cu, cv), Z0 = 58, Zt = 90;
      S.add(x, y, x + 1, y + 1, -1, 0, shadowE(cx, cy + 1 * s, 0.3 * k, 0.15 * k));
      S.box(cu - 0.16, cv - 0.16, 0, 0.32, 0.32, 7, C3('#B9B3A4'), '', 1.3);
      S.box(cu - 0.035, cv - 0.035, 7, 0.07, 0.07, Z0 - 10, C3('#8A5A36'), '', 1.2);
      S.box(cu - 0.2, cv - 0.2, Z0 - 3, 0.4, 0.4, 3, C3('#8A5A36'), '', 1.2);
      // sangkar bambu: jeruji belakang, isi (tangkringan, burung, cawan), jeruji depan
      const R = 0.2, P3 = (a: number, z: number) => at3(g, cu + R * Math.cos(a), cv + R * Math.sin(a), z);
      const front = (a: number) => P3(a, Z0)[1] >= at3(g, cu, cv, Z0)[1] - 0.5;
      const N = 14, bar = (a: number, col: string) => thinLine([P3(a, Z0 + 2), P3(a, Zt)], INK, 2 * s) + thinLine([P3(a, Z0 + 2), P3(a, Zt)], col, 0.9 * s);
      const hoop = (z: number, isFront: boolean, col: string) => {
        const pts: Pt[] = [];
        for (let i = 0; i <= 40; i++) { const a = (i / 40) * 2 * Math.PI; if (front(a) === isFront) pts.push(P3(a, z)); }
        pts.sort((p, q) => p[0] - q[0]);
        return thinLine(pts, INK, 2.6 * s) + thinLine(pts, col, 1.3 * s);
      };
      let o = lathe(g, cu, cv, [[Z0, R + 0.02], [Z0 + 3, R + 0.02]], shade(c.main, -0.25), 1.2) + flatE(g, cu, cv, Z0 + 3, R + 0.02, '#E9DDBF', 1);
      const dark = shade(c.main, -0.22);
      for (let i = 0; i < N; i++) { const a = (i / N) * 2 * Math.PI; if (!front(a)) o += bar(a, dark); }
      o += hoop(Zt - 10, false, dark);
      // tangkringan & cawan makan / minum
      const pa = at3(g, cu - 0.16, cv, Z0 + 14), pb = at3(g, cu + 0.16, cv, Z0 + 14);
      o += inkLine([pa, pb], '#A86E3F', 1.4, s);
      for (const [du, col] of [[-0.1, '#F2C14E'], [0.1, '#7FC4E8']] as [number, string][]) { const q = at3(g, cu + du, cv + 0.08, Z0 + 3); o += `<path d="M${f1(q[0] - 3 * s)} ${f1(q[1] - 3 * s)}h${f1(6 * s)}l${f1(-1 * s)} ${f1(3 * s)}h${f1(-4 * s)}Z" fill="${col}" stroke="${INK}" stroke-width="${f1(0.8 * s)}"/>`; }
      o += birdie(at3(g, cu, cv, Z0 + 14)[0], at3(g, cu, cv, Z0 + 14)[1] + 0.5 * s, s * 0.95, c.accent, g.back ? -1 : 1);
      for (let i = 0; i < N; i++) { const a = (i / N) * 2 * Math.PI; if (front(a)) o += bar(a, c.main); }
      o += hoop(Zt - 10, true, c.main) + hoop(Z0 + 4, true, c.main);
      // atap kubah & kait
      o += lathe(g, cu, cv, [[Zt, R + 0.01], [Zt + 4, R - 0.02], [Zt + 9, 0.1], [Zt + 11, 0.03]], shade(c.main, -0.05), 1.3);
      const tp = at3(g, cu, cv, Zt + 11);
      o += `<circle cx="${f1(tp[0])}" cy="${f1(tp[1] - 4 * s)}" r="${f1(3.4 * s)}" fill="none" stroke="${INK}" stroke-width="${f1(2.4 * s)}"/><circle cx="${f1(tp[0])}" cy="${f1(tp[1] - 4 * s)}" r="${f1(3.4 * s)}" fill="none" stroke="#C9CED6" stroke-width="${f1(1 * s)}"/>`;
      S.add(cu - R, cv - R, cu + R, cv + R, Z0, Zt + 16, o);
      return S.out();
    },
  },
  bakpasir: {
    label: 'Bak pasir & istana pasir',
    colors: { main: '#B98552', accent: '#F0D9A8' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), k = rk(g), A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z), wood = C3(c.main), H = 12, Zs = 9;
      const b0 = 0.08, b1 = 0.2, e0 = w - 0.2, e1 = w - 0.08;
      // pasir (di bawah bingkai), berombak kecil, kerang
      {
        let h = g.poly([A(b1, b1, Zs), A(e0, b1, Zs), A(e0, e0, Zs), A(b1, e0, Zs)], c.accent, 1.2);
        let rp = '';
        for (const [u, v] of [[0.5, 0.5], [1.4, 0.5], [0.45, 1.5], [1.1, 1.3], [1.55, 1.6], [0.8, 0.9]]) { const a = A(u - 0.12, v, Zs), m = A(u, v - 0.06, Zs), b = A(u + 0.12, v, Zs); rp += `M${f1(a[0])} ${f1(a[1])}Q${f1(m[0])} ${f1(m[1])} ${f1(b[0])} ${f1(b[1])}`; }
        h += `<path d="${rp}" fill="none" stroke="${shade(c.accent, -0.18)}" stroke-width="${f1(1.2 * s)}" stroke-linecap="round"/>`;
        for (const [u, v, col] of [[0.4, 1.0, '#F7A8C4'], [1.5, 1.25, '#FFFDF7'], [0.7, 1.65, '#F2994A']] as [number, number, string][]) { const p = A(u, v, Zs); h += `<path d="M${f1(p[0] - 3 * s)} ${f1(p[1])}a${f1(3 * s)} ${f1(3 * s)} 0 0 1 ${f1(6 * s)} 0Z" fill="${col}" stroke="${INK}" stroke-width="${f1(0.7 * s)}"/>`; }
        S.add(x + b1, y + b1, x + e0, y + e0, 0, Zs, h);
      }
      // bingkai papan empat sisi + dudukan sudut
      S.box(x + b0, y + b0, 0, w - 0.16, b1 - b0, H, wood, '', 1.3);
      S.box(x + b0, y + e0, 0, w - 0.16, b1 - b0, H, wood, '', 1.3);
      S.box(x + b0, y + b1, 0, b1 - b0, e0 - b1, H, wood, '', 1.3);
      S.box(x + e0, y + b1, 0, b1 - b0, e0 - b1, H, wood, '', 1.3);
      for (const [u, v] of [[b0, b0], [e0 - 0.08, b0], [b0, e0 - 0.08], [e0 - 0.08, e0 - 0.08]]) S.box(x + u, y + v, H, 0.2, 0.2, 2, C3(shade(c.main, 0.12)), '', 1.1);
      // istana pasir: menara bulat & bendera
      {
        const cu = x + 1.2, cv = y + 0.78, sand = shade(c.accent, -0.08);
        let h = lathe(g, cu, cv, [[Zs, 0.22], [Zs + 8, 0.2]], sand, 1.2) + flatE(g, cu, cv, Zs + 8, 0.2, shade(c.accent, 0.05), 1.1);
        for (const [du, dv, hh] of [[-0.11, -0.06, 10], [0.11, 0.04, 8], [0, 0.1, 6]]) h += lathe(g, cu + du, cv + dv, [[Zs + 8, 0.07], [Zs + 8 + hh, 0.06]], sand, 1.1) + flatE(g, cu + du, cv + dv, Zs + 8 + hh, 0.06, shade(c.accent, 0.05), 1);
        const tp = at3(g, cu - 0.11, cv - 0.06, Zs + 18);
        h += `<path d="M${f1(tp[0])} ${f1(tp[1])}V${f1(tp[1] - 12 * s)}" stroke="${INK}" stroke-width="${f1(1.2 * s)}"/><path d="M${f1(tp[0])} ${f1(tp[1] - 12 * s)}l${f1(7 * s)} ${f1(2.5 * s)}l${f1(-7 * s)} ${f1(2.5 * s)}Z" fill="#E0583F" stroke="${INK}" stroke-width="${f1(0.8 * s)}"/>`;
        S.add(cu - 0.22, cv - 0.22, cu + 0.22, cv + 0.22, Zs, Zs + 32, h);
      }
      // ember mainan & sekop
      {
        const bu = x + 0.6, bv = y + 1.3;
        let h = lathe(g, bu, bv, [[Zs, 0.08], [Zs + 9, 0.1]], '#E0583F', 1.2) + flatE(g, bu, bv, Zs + 9, 0.1, shade('#E0583F', -0.25), 1);
        const hl = at3(g, bu - 0.1, bv, Zs + 8), hr = at3(g, bu + 0.1, bv, Zs + 8);
        h += `<path d="M${f1(hl[0])} ${f1(hl[1])}Q${f1((hl[0] + hr[0]) / 2)} ${f1(hl[1] - 12 * s)} ${f1(hr[0])} ${f1(hr[1])}" fill="none" stroke="${INK}" stroke-width="${f1(1.4 * s)}"/>`;
        S.add(bu - 0.1, bv - 0.1, bu + 0.1, bv + 0.1, Zs, Zs + 14, h);
        const s0 = A(0.92, 1.5, Zs + 1), s1 = A(0.98, 1.42, Zs + 16);
        S.add(x + 0.86, y + 1.4, x + 1.02, y + 1.56, Zs, Zs + 18, `<path d="M${f1(s0[0] - 4 * s)} ${f1(s0[1] - 1 * s)}q${f1(4 * s)} ${f1(6 * s)} ${f1(8 * s)} 0l${f1(-1 * s)} ${f1(-5 * s)}h${f1(-6 * s)}Z" fill="#F7D038" stroke="${INK}" stroke-width="${f1(1 * s)}" stroke-linejoin="round"/>` + inkLine([[s0[0], s0[1] - 6 * s], s1], '#3F9FD8', 1.6, s));
      }
      return S.out();
    },
  },
  minumburung: {
    label: 'Tempat minum burung',
    colors: { main: '#B9B3A4', accent: '#7FC4E8' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), k = rk(g), cu = x + 0.5, cv = y + 0.5, [cx, cy] = g.iso(cu, cv), Zb = 34;
      S.add(x, y, x + 1, y + 1, -1, 0, shadowE(cx, cy + 1 * s, 0.34 * k, 0.17 * k));
      // rumput & bunga kecil di kaki
      {
        let h = '';
        for (const [du, dv, col] of [[-0.3, 0.14, '#F7D038'], [0.26, 0.24, '#F7A8C4'], [0.3, -0.2, '#FFFFFF'], [-0.18, 0.3, '#C9A0E8']] as [number, number, string][]) {
          const [px, py] = at3(g, cu + du, cv + dv, 0);
          h += leaf(px - 3 * s, py - 3 * s, 4, -50, '#5DA862', s, 0.8) + leaf(px + 3 * s, py - 3 * s, 4, 50, '#3F8A4E', s, 0.8) + bloom(px, py - 7 * s, 3.4 * s, col, s);
        }
        S.add(x + 0.1, y + 0.1, x + 0.9, y + 0.9, 0, 1, h);
      }
      S.add(cu - 0.2, cv - 0.2, cu + 0.2, cv + 0.2, 0, Zb, lathe(g, cu, cv, [[0, 0.2], [4, 0.17], [8, 0.1], [Zb - 4, 0.08], [Zb, 0.12]], c.main) + frontArc(g, cu, cv, 4, 0.17, shade(c.main, -0.25), 1.2));
      {
        let h = lathe(g, cu, cv, [[Zb, 0.12], [Zb + 4, 0.3], [Zb + 8, 0.37]], c.main) + flatE(g, cu, cv, Zb + 8, 0.37, shade(c.main, 0.12), 1.3) + flatE(g, cu, cv, Zb + 7.4, 0.31, c.accent, 1);
        const [wx, wy] = at3(g, cu, cv, Zb + 7.4);
        h += `<ellipse cx="${f1(wx - 4 * s)}" cy="${f1(wy + 1 * s)}" rx="${f1(7 * s)}" ry="${f1(3 * s)}" fill="none" stroke="#FFFFFF" stroke-width="${f1(1.2 * s)}" opacity=".8"/>`;
        // burung pipit mandi (mematuk air, cipratan) & satu lagi bertengger di bibir
        h += birdie(wx - 5 * s, wy + 2 * s, s * 0.9, '#B07A4A', g.back ? -1 : 1, true);
        for (const [dx, dy] of [[4, -6], [8, -9], [1, -10], [10, -4]]) h += `<path d="M${f1(wx + dx * s)} ${f1(wy + dy * s - 2 * s)}q${f1(1.4 * s)} ${f1(2 * s)} 0 ${f1(3 * s)}q${f1(-1.4 * s)} ${f1(-1 * s)} 0 ${f1(-3 * s)}Z" fill="${c.accent}" stroke="${INK}" stroke-width="${f1(0.5 * s)}"/>`;
        const rp = at3(g, cu + 0.26, cv + 0.22, Zb + 8);
        h += birdie(rp[0], rp[1], s * 0.85, '#9A6B45', g.back ? 1 : -1);
        S.add(cu - 0.37, cv - 0.37, cu + 0.37, cv + 0.37, Zb, Zb + 20, h);
      }
      return S.out();
    },
  },
  gerobakbunga: {
    label: 'Gerobak bunga',
    colors: { main: '#B98552', accent: '#F28CA8' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z), wood = C3(c.main), Z0 = 16, Z1 = 30;
      // roda di dua sisi (bidang y), terlihat dari kedua sisi
      const wheel = (v: number) => {
        const m = onY(g, y + v, x + 0.56, 13);
        let h = g.poly(discPts(m, 0, 0, 13, 13, 24), '#5E4630', 1.4) + g.poly(discPts(m, 0, 0, 10, 10, 24), shade(c.main, 0.15), 1);
        let sp = '';
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI; sp += seg(m(10 * Math.cos(a), 10 * Math.sin(a)), m(-10 * Math.cos(a), -10 * Math.sin(a))); }
        h += `<path d="${sp}" stroke="${shade(c.main, -0.35)}" stroke-width="${f1(1.4 * s)}"/>` + g.poly(discPts(m, 0, 0, 2.6, 2.6, 12), '#5E4630', 0.9);
        S.add(x + 0.36, y + v - 0.01, x + 0.76, y + v + 0.01, 0, 26, h);
      };
      wheel(0.2);
      // kaki penyangga & dua gagang
      S.box(x + 0.16, y + 0.46, 0, 0.06, 0.08, Z0, C3(shade(c.main, -0.15)), '', 1.1);
      for (const v of [0.3, 0.7]) S.add(x + 0.02, y + v - 0.02, x + 0.2, y + v + 0.02, Z0 + 4, Z0 + 14, inkLine([A(0.18, v, Z0 + 5), A(0.03, v, Z0 + 12)], c.main, 2.6, s));
      // bak gerobak: papan bergaris
      const base = [[x + 0.16, y + 0.24], [x + 0.88, y + 0.24], [x + 0.88, y + 0.76], [x + 0.16, y + 0.76]];
      let bed = prism(g, base, Z0, Z1 - Z0, wood, 1.4);
      for (const side of seenSides(g, base, Z0)) bed += thinLine([side(0, Z0 + 7), side(1, Z0 + 7)], shade(c.main, -0.3), 1.1 * s);
      bed += g.poly([A(0.2, 0.28, Z1), A(0.84, 0.28, Z1), A(0.84, 0.72, Z1), A(0.2, 0.72, Z1)], '#6B4A2E', 1);
      S.add(x + 0.16, y + 0.24, x + 0.88, y + 0.76, Z0, Z1, bed);
      // pot-pot bunga di dalam bak
      const pot = (u: number, v: number, col: string) => {
        const pu = x + u, pv = y + v;
        let h = lathe(g, pu, pv, [[Z1 - 2, 0.07], [Z1 + 6, 0.09]], '#C66B3D', 1.1) + flatE(g, pu, pv, Z1 + 6, 0.09, '#5A3A22', 0.9);
        const [px, py] = at3(g, pu, pv, Z1 + 6);
        for (const [dx, dy, a] of [[-5, -3, -40], [5, -4, 40], [0, -7, 0], [-7, -8, -60], [7, -9, 60]]) h += leaf(px + dx * s, py + dy * s, 5, a, '#4F9A4A', s, 0.8);
        for (const [dx, dy, r] of [[-3, -9, 4.4], [4, -11, 4], [0, -15, 3.8], [-7, -13, 3.2]]) h += bloom(px + dx * s, py + dy * s, r * s, col, s);
        S.add(pu - 0.09, pv - 0.09, pu + 0.09, pv + 0.09, Z1, Z1 + 26, h);
      };
      pot(0.34, 0.38, c.accent); pot(0.66, 0.38, '#F7D038'); pot(0.34, 0.62, '#C9A0E8'); pot(0.66, 0.62, '#FFFFFF');
      wheel(0.8);
      return S.out();
    },
  },
  pagartanaman: {
    label: 'Pagar tanaman',
    colors: { main: '#4F9A4A', accent: '#9C6B45' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z), Z0 = 10, Z1 = 40;
      const box = [[x + 0.04, y + 0.26], [x + w - 0.04, y + 0.26], [x + w - 0.04, y + 0.74], [x + 0.04, y + 0.74]];
      let o = prism(g, box, 0, Z0, C3(c.accent), 1.4);
      for (const side of seenSides(g, box, 0)) o += thinLine([side(0, Z0 / 2), side(1, Z0 / 2)], shade(c.accent, -0.3), 1 * s);
      S.add(x + 0.04, y + 0.26, x + w - 0.04, y + 0.74, 0, Z0, o);
      // semak dipangkas: balok hijau bertekstur daun di sisi yang terlihat & di atas, bunga putih kecil
      const hb = [[x + 0.07, y + 0.29], [x + w - 0.07, y + 0.29], [x + w - 0.07, y + 0.71], [x + 0.07, y + 0.71]];
      let h = prism(g, hb, Z0, Z1 - Z0, C3(c.main), 1.5);
      const dk = shade(c.main, -0.2), lt = shade(c.main, 0.2);
      let leaves = '', lights = '', flowers = '';
      seenSides(g, hb, Z0).forEach((side, si) => {
        const n = Math.max(3, Math.round(Math.hypot(side(1, Z0)[0] - side(0, Z0)[0], side(1, Z0)[1] - side(0, Z0)[1]) / (9 * s)));
        for (let i = 0; i < n; i++)
          for (let j = 0; j < 3; j++) {
            const t = (i + 0.5 + (j % 2) * 0.4) / (n + 0.4), z = Z0 + 5 + j * 9, p = side(t, z);
            (j % 2 ? lights : leaves) && ((i + j + si) % 2 ? (leaves += `M${f1(p[0] - 3 * s)} ${f1(p[1])}a${f1(3 * s)} ${f1(2 * s)} 0 1 0 ${f1(6 * s)} 0a${f1(3 * s)} ${f1(2 * s)} 0 1 0 ${f1(-6 * s)} 0Z`) : (lights += `M${f1(p[0] - 2.6 * s)} ${f1(p[1])}a${f1(2.6 * s)} ${f1(1.8 * s)} 0 1 0 ${f1(5.2 * s)} 0a${f1(2.6 * s)} ${f1(1.8 * s)} 0 1 0 ${f1(-5.2 * s)} 0Z`));
            if ((i * 3 + j + si) % 7 === 2) flowers += bloom(p[0], p[1] - 2 * s, 2.6 * s, '#FFFDF7', s, '#F7D038', 0.5);
          }
        // tepi atas bergelombang
        const top: Pt[] = [];
        for (let i = 0; i <= 2 * n; i++) { const p = side(i / (2 * n), Z1); top.push([p[0], p[1] - (i % 2 ? 2.2 : 0) * s]); }
        h += thinLine(top, shade(c.main, 0.12), 2.4 * s);
      });
      for (let i = 0; i < 9; i++) { const p = A(0.16 + ((i * 0.37) % 1) * (w - 0.32), 0.34 + ((i * 0.53) % 1) * 0.32, Z1); lights += `M${f1(p[0] - 3 * s)} ${f1(p[1])}a${f1(3 * s)} ${f1(1.6 * s)} 0 1 0 ${f1(6 * s)} 0a${f1(3 * s)} ${f1(1.6 * s)} 0 1 0 ${f1(-6 * s)} 0Z`; if (i % 3 === 1) flowers += bloom(p[0], p[1] - 1 * s, 2.6 * s, '#FFFDF7', s, '#F7D038', 0.5); }
      h += `<path d="${leaves}" fill="${dk}" opacity=".55"/><path d="${lights}" fill="${lt}" opacity=".7"/>` + flowers;
      S.add(x + 0.07, y + 0.29, x + w - 0.07, y + 0.71, Z0, Z1, h);
      return S.out();
    },
  },
};

/* ================================================================== */
/* Dinding & lantai                                                    */
/* ================================================================== */

const { onWall, WALL_H } = WALL_KIT;
/** pola dinding baru: keramik dapur (lis motif) & keramik biru laut (lis ombak) */
const wallPattern: WallPattern = (g, side, a, b, wall, main) => {
  if (wall.key !== 'keramikdapur' && wall.key !== 'keramikbiru') return '';
  const L = side === 'L', at = (u: number) => onWall(g, side, u), up = (p: number[], v: number) => [p[0], p[1] - v], k = Math.min(1, g.s);
  const quad = (u0: number, u1: number, v0: number, v1: number) => pathD([up(at(u0), v0), up(at(u1), v0), up(at(u1), v1), up(at(u0), v1)]);
  const lit = (col: string, k = 0.3) => (L ? col : shade(col, k));
  const grid = (v0: number, v1: number, du: number, dv: number, col: string) => {
    let ln = '';
    for (let v = v0 + dv; v < v1 - 0.5; v += dv) ln += seg(up(at(a), v), up(at(b), v));
    for (let u = Math.ceil(a / du + 0.001) * du; u < b - 0.001; u += du) ln += seg(up(at(u), v0), up(at(u), v1));
    return `<path d="${ln}" stroke="${col}" stroke-width="${f1(1.2 * k)}" fill="none"/>`;
  };
  let o = '';
  if (wall.key === 'keramikdapur') {
    // keramik putih persegi sampai setinggi lis, lis bermotif belah ketupat, di atasnya cat polos
    const v0 = 26, v1 = 100, grout = lit(shade(wall.main, -0.16), 0.3);
    o += `<path d="${quad(a, b, v0, v1)}" fill="${main}"/>` + grid(v0, v1, 0.25, 12.4, grout);
    o += `<path d="${quad(a, b, v1, v1 + 10)}" fill="${lit(wall.accent, 0.25)}" stroke="${INK}" stroke-width="1" stroke-opacity=".5"/>`;
    let dia = '';
    for (let u = Math.ceil(a / 0.25 + 0.001) * 0.25 - 0.125; u < b - 0.05; u += 0.25) { if (u < a + 0.05) continue; const p = up(at(u), v1 + 5), r = f1(3.6 * k); dia += `M${f1(p[0])} ${f1(p[1] - 3.6 * k)}l${r} ${r}l${-r} ${r}l${-r} ${-r}Z`; }
    o += `<path d="${dia}" fill="${lit('#F7E7B4', 0.2)}" stroke="${INK}" stroke-width=".7" stroke-opacity=".5"/>`;
    // kilau keramik
    let gl = '';
    for (let u = Math.ceil(a / 0.75 + 0.001) * 0.75 + 0.06; u < b - 0.1; u += 0.75) gl += seg(up(at(u), 60), up(at(u + 0.08), 66));
    o += `<path d="${gl}" stroke="#FFFFFF" stroke-width="${f1(2 * k)}" stroke-linecap="round" opacity=".7"/>`;
  } else {
    // biru laut: keramik tua di bawah, lis ombak putih, keramik muda di atas
    const v0 = 26, v1 = 78, v2 = 88;
    o += `<path d="${quad(a, b, v0, v1)}" fill="${lit(wall.accent, 0.22)}"/>` + grid(v0, v1, 0.2, 10.4, lit(shade(wall.accent, 0.35), 0.2));
    o += `<path d="${quad(a, b, v1, v2)}" fill="${lit(shade(wall.accent, -0.15), 0.22)}" stroke="${INK}" stroke-width="1" stroke-opacity=".45"/>`;
    let wave = '';
    for (let u = a; u < b - 0.01; u += 0.2) { const p = up(at(u), v1 + 4), q = up(at(Math.min(b, u + 0.1)), v1 + 7.5), r = up(at(Math.min(b, u + 0.2)), v1 + 4); wave += `M${f1(p[0])} ${f1(p[1])}Q${f1(q[0])} ${f1(q[1] - 5)} ${f1(r[0])} ${f1(r[1])}`; }
    o += `<path d="${wave}" fill="none" stroke="#FFFFFF" stroke-width="${f1(2 * k)}" stroke-linecap="round"/>`;
    o += grid(v2, WALL_H - 4, 0.25, 15.5, lit(shade(wall.main, -0.14), 0.3));
    // ikan kecil sesekali di keramik bawah
    let fish = '';
    for (let u = Math.ceil(a / 1.3 + 0.001) * 1.3 + 0.4; u < b - 0.2; u += 1.3) { const p = up(at(u), 50), q = (v: number) => f1(v * k); fish += `M${f1(p[0] - 5 * k)} ${f1(p[1])}q${q(5)} ${q(-4.5)} ${q(10)} 0q${q(-5)} ${q(4.5)} ${q(-10)} 0Zm${q(10)} 0l${q(4)} ${q(-3)}v${q(6)}Z`; }
    if (fish) o += `<path d="${fish}" fill="${lit('#F7C548', 0.15)}" stroke="${INK}" stroke-width=".8" stroke-opacity=".6"/>`;
  }
  return o;
};
/** pola lantai baru per petak: tegel catur (4 kotak per petak), mozaik (16 kotak kecil), rumput berbunga */
const floorPattern: FloorPattern = (g, floor, i, j, edit) => {
  const key = floor.key;
  if (key !== 'tegelcatur' && key !== 'mozaik' && key !== 'rumputbunga') return '';
  const s = g.s, q = (u: number, v: number) => g.iso(i + u, j + v), pe = ' pointer-events="none"';
  const cell = (u0: number, v0: number, du: number, dv: number) => pathD([q(u0, v0), q(u0 + du, v0), q(u0 + du, v0 + dv), q(u0, v0 + dv)]);
  const tile = P([q(0, 0), q(1, 0), q(1, 1), q(0, 1)]);
  const sw = f1(Math.min(1, s));
  if (key === 'tegelcatur') {
    let o = `<polygon points="${tile}" fill="${floor.main}" stroke="${shade(floor.main, -0.25)}" stroke-width="1"${pe}/>`;
    o += `<path d="${cell(0, 0, 0.5, 0.5)}${cell(0.5, 0.5, 0.5, 0.5)}" fill="${floor.accent}"${pe}/>`;
    if (!edit) o += `<path d="${seg(q(0.07, 0.62), q(0.07, 0.88))}${seg(q(0.57, 0.12), q(0.57, 0.38))}" stroke="#FFFFFF" stroke-width="${f1(1.4 * Math.min(1, s))}" stroke-linecap="round" opacity=".35"${pe}/>`;
    return o + `<path d="${seg(q(0.5, 0), q(0.5, 1))}${seg(q(0, 0.5), q(1, 0.5))}" stroke="${shade(floor.main, -0.3)}" stroke-width="${sw}"${pe}/>`;
  }
  if (key === 'mozaik') {
    const cols = [floor.main, floor.accent, '#FFFFFF', shade(floor.accent, -0.2), shade(floor.main, 0.25)];
    const d: string[] = cols.map(() => '');
    for (let a = 0; a < 4; a++)
      for (let b2 = 0; b2 < 4; b2++) {
        const h = Math.sin((i * 4 + a) * 12.9898 + (j * 4 + b2) * 78.233) * 43758.5453, r = h - Math.floor(h);
        d[r < 0.34 ? 0 : r < 0.62 ? 1 : r < 0.78 ? 2 : r < 0.9 ? 3 : 4] += cell(a * 0.25, b2 * 0.25, 0.25, 0.25);
      }
    const o = d.map((p, n) => (p ? `<path d="${p}" fill="${cols[n]}"${pe}/>` : '')).join('');
    let ln = '';
    for (const t of [0.25, 0.5, 0.75]) ln += seg(q(t, 0), q(t, 1)) + seg(q(0, t), q(1, t));
    return o + `<path d="${ln}" stroke="#F4F8FA" stroke-width="${sw}"${pe}/><polygon points="${tile}" fill="none" stroke="#E6EEF2" stroke-width="1.2"${pe}/>`;
  }
  // rumput berbunga: rumput dua warna + bunga kecil (posisi tetap per petak)
  let o = `<polygon points="${tile}" fill="${(i + j) % 2 ? floor.main : shade(floor.main, -0.04)}" stroke="${shade(floor.main, -0.12)}" stroke-width="1"${pe}/>`;
  if (edit) return o;
  const fr = (t: number) => { const v = Math.sin(t) * 43758.5453; return v - Math.floor(v); };
  let tuft = '';
  for (let n = 0; n < 2; n++) {
    const c = q(0.2 + 0.6 * fr(i * 3.1 + j * 7.7 + n * 1.9), 0.2 + 0.6 * fr(i * 5.3 + j * 2.9 + n * 4.1));
    tuft += `M${f1(c[0] - 4 * s)} ${f1(c[1] + 1 * s)}l${f1(1.6 * s)} ${f1(-5 * s)}M${f1(c[0])} ${f1(c[1] + 1 * s)}v${f1(-7 * s)}M${f1(c[0] + 4 * s)} ${f1(c[1] + 1 * s)}l${f1(-1.6 * s)} ${f1(-5 * s)}`;
  }
  o += `<path d="${tuft}" stroke="${shade(floor.main, -0.3)}" stroke-width="${f1(1.4 * s)}" stroke-linecap="round"${pe}/>`;
  const fl = ['#FFFFFF', '#F7D038', '#F7A8C4', floor.accent];
  let petals = '', mids = '';
  for (let n = 0; n < 3; n++) {
    const c = q(0.14 + 0.72 * fr(i * 9.7 + j * 3.3 + n * 2.7), 0.14 + 0.72 * fr(i * 1.7 + j * 8.9 + n * 6.1)), r = (2.6 + fr(i + j + n) * 1.2) * s, col = fl[(i * 3 + j * 5 + n) % fl.length];
    let pp = '';
    for (let m = 0; m < 5; m++) { const ang = (m / 5) * 2 * Math.PI; pp += `M${f1(c[0] + Math.cos(ang) * r - r * 0.45)} ${f1(c[1] + Math.sin(ang) * r * 0.5)}a${f1(r * 0.45)} ${f1(r * 0.3)} 0 1 0 ${f1(r * 0.9)} 0a${f1(r * 0.45)} ${f1(r * 0.3)} 0 1 0 ${f1(-r * 0.9)} 0Z`; }
    petals += `<path d="${pp}" fill="${col}" stroke="${INK}" stroke-width="${f1(0.5 * s)}" stroke-opacity=".6"/>`;
    mids += `M${f1(c[0] - r * 0.3)} ${f1(c[1])}a${f1(r * 0.3)} ${f1(r * 0.2)} 0 1 0 ${f1(r * 0.6)} 0a${f1(r * 0.3)} ${f1(r * 0.2)} 0 1 0 ${f1(-r * 0.6)} 0Z`;
  }
  return o + `<g${pe}>${petals}<path d="${mids}" fill="#F2B632"/></g>`;
};

registerSurfaces(
  {
    keramikdapur: { label: 'Keramik dapur (lis motif)', colors: { main: '#F6F3EA', accent: '#3F8F8A' } },
    keramikbiru: { label: 'Keramik biru laut', colors: { main: '#DCEFF7', accent: '#2F7FA8' } },
  },
  {
    tegelcatur: { label: 'Tegel catur hitam-putih', colors: { main: '#F3F0E8', accent: '#2E3242' } },
    mozaik: { label: 'Mozaik kamar mandi', colors: { main: '#7FC8D8', accent: '#2F8FB0' } },
    rumputbunga: { label: 'Rumput berbunga', colors: { main: '#86C46A', accent: '#C9A0E8' } },
  },
  wallPattern,
  floorPattern,
);

/* ================================================================== */
/* Properti pet untuk animasi baru (koordinat lokal pet, kaki di 0,0)  */
/* ================================================================== */

/**
 * ayun: penanda saja (tanpa gambar) — tali & dudukan tetap milik Ayunan Kayu, digambar di belakang pet; CSS game
 * mengayunkan pet (.pet-hop) dan tali + dudukan (.ayk-ayun) bersamaan dari titik tengah palang (0, −PERABOT3_AYUN.pivot
 * px lokal pet). Penanda ini membedakannya dari pose ayun alun-alun. sikat: sikat gigi yang digosokkan (p-sikat) &
 * busa (p-busa); cuci: spons & busa (p-cuci). Tanpa CSS (foto, admin) semuanya diam di posisi tengah.
 */
const PROPS_P3: Record<string, string> = {
  ayun: `<g class="p-ayun"></g>`,
  sikat: `<g class="p-busa"><circle cx="-6" cy="-27" r="4.2" fill="#FFFFFF" stroke="#9FD0E8" stroke-width="1.4"/><circle cx="2" cy="-25" r="3.4" fill="#FFFFFF" stroke="#9FD0E8" stroke-width="1.4"/><circle cx="-11" cy="-31" r="3" fill="#FFFFFF" stroke="#9FD0E8" stroke-width="1.4"/><circle cx="9" cy="-28" r="2.6" fill="#FFFFFF" stroke="#9FD0E8" stroke-width="1.4"/></g><g class="p-sikat"><path d="M38 -12L10 -31" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M38 -12L10 -31" stroke="#3F9FD8" stroke-width="3.6" stroke-linecap="round"/><path d="M3 -40l10 6.6-3.6 5.4-10 -6.6Z" fill="#FFFFFF" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M2 -37l7 4.6M4 -39.5l7 4.6" stroke="#9FD0E8" stroke-width="1.2"/></g>`,
  cuci: `<g class="p-cuci"><g transform="translate(38 -30) rotate(-14)"><rect x="-12" y="-8" width="24" height="16" rx="4" fill="#F7E05A" stroke="${INK}" stroke-width="2.6"/><rect x="-12" y="-8" width="24" height="6" rx="3" fill="#6BCB77" stroke="${INK}" stroke-width="2"/><circle cx="-4" cy="3" r="1.4" fill="#E2C23A"/><circle cx="4" cy="2" r="1.2" fill="#E2C23A"/></g><circle cx="26" cy="-38" r="4.6" fill="#FFFFFF" stroke="#9FD0E8" stroke-width="1.4"/><circle cx="50" cy="-40" r="3.6" fill="#FFFFFF" stroke="#9FD0E8" stroke-width="1.4"/><circle cx="31" cy="-44" r="2.8" fill="#FFFFFF" stroke="#9FD0E8" stroke-width="1.4"/><circle cx="46" cy="-19" r="3" fill="#FFFFFF" stroke="#9FD0E8" stroke-width="1.4"/></g>`,
};

registerArt({}, { ...DAPUR, ...MANDI, ...TAMAN }, PROPS_P3);

/** bentuk mebel baru per kelompok (untuk uji & galeri) */
export const PERABOT3_ART = { dapur: Object.keys(DAPUR), mandi: Object.keys(MANDI), taman: Object.keys(TAMAN) };
/** dinding & lantai baru */
export const PERABOT3_SURFACES = { wallpaper: ['keramikdapur', 'keramikbiru'], floor: ['tegelcatur', 'mozaik', 'rumputbunga'] };
/**
 * Ayunan Kayu: tinggi dudukan & palang (px petak); pivot = jarak palang dari dudukan dalam px lokal pet
 * ((palang − dudukan) × 34/32 ÷ skala pet 0,82) — titik putar pose ayun di CSS game (transform-origin 0 −pivot).
 */
export const PERABOT3_AYUN = { seat: AYUN_SEAT, bar: AYUN_BAR, pivot: Math.round(((AYUN_BAR - AYUN_SEAT) * 34) / 32 / 0.82) };
