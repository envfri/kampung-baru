// Gambar paket konten 22 (kamar mandi 2 & ruangan Mutiara):
// - Mebel Jati: bak mandi keramik & gayung, shower bertirai ikan, pengering bulu, mesin gelembung sabun, rak mainan mandi,
//   ember rendam kaki, rak sabun & sampo, lampu ubur-ubur, keranjang cucian rotan, pot lidah mertua; dinding ubin
//   perahu layar & lantai batu kali kecil.
// - Toko Mutiara: bak mandi kaki kucing & pancuran gajah.
// - Enam ruangan Mutiara, masing-masing dengan dinding & lantai khusus dan satu mebel khas (kolam bola, ayunan ban,
//   mesin karaoke, rak anggrek, kolam air panas, sofa kerang), plus tampilan ikon ruangannya.
// - Properti pet untuk tiga animasi baru: gayung (mengguyur badan), shower (di bawah pancuran), kering (bulu mengembang).
// Semua orisinal: garis INK, isian datar, warna bisa diganti dari admin, tanpa merek atau tulisan.
//
// 4 arah: seperti art-perabot3.ts, tiap mebel dibangun dengan "scene" (bagian berkotak batas, diurutkan belakang → depan),
// jadi tampak belakang (2× & 3× putar) benar tanpa gambar kedua. Hiasan yang hanya ada di sisi depan (corong speaker,
// layar karaoke, panel tombol) dicek g.back atau digambar di sisi yang terlihat (seenSides).
// Efek bergerak memakai kelas yang sudah ada: water (uap / aliran air), swim (putar), blink, ed-* (app.css) — semuanya
// diam dengan prefers-reduced-motion & Pengaturan › Kurangi animasi, dan gambar dasarnya sudah satu frame yang pas.
import {
  INK, P, shade, registerArt, registerSurfaces, registerRoomLooks, WALL_KIT, C3, f1, at3, rk, inkLine, thinLine, prism, ovalTub, lathe, flatE, frontArc, onY, onX, discPts, shadowE, hull, wisp,
  type IsoCtx, type FurnDef, type WallPattern, type FloorPattern,
} from './art';
import { SCENE_KIT } from './art-toko3';
import { PERABOT3_AYUN } from './art-perabot3';

const { scene, rect, circ } = SCENE_KIT;
type Pt = number[];
type Scene = ReturnType<typeof scene>;
const f2 = (v: number) => Math.round(v * 100) / 100;

/* ------------------------------------------------------------------ */
/* Bantuan kecil                                                         */
/* ------------------------------------------------------------------ */

const seg = (a: Pt, b: Pt) => `M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}`;
const pathD = (pts: Pt[], close = true) => `M${P(pts).replace(/ /g, 'L')}${close ? 'Z' : ''}`;
/** elips di layar (benda kecil yang selalu menghadap kamera: bola, gelembung, batu) */
const ell = (cx: number, cy: number, rx: number, ry: number, fill: string, s: number, sw = 1, extra = '') =>
  `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(rx)}" ry="${f1(ry)}" fill="${fill}"${sw ? ` stroke="${INK}" stroke-width="${f1(sw * s)}"` : ''}${extra}/>`;
/** elips sebagai potongan path (banyak bentuk dalam satu elemen supaya ringan) */
const ellD = (cx: number, cy: number, rx: number, ry: number) => `M${f1(cx - rx)} ${f1(cy)}a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(2 * rx)} 0a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(-2 * rx)} 0Z`;
/** <g> berpusat di titik petak (u, v) setinggi z; isinya dalam px lokal (dikali g.s) */
const at = (g: IsoCtx, u: number, v: number, z: number, inner: string, cls = '', style = '') => {
  const [X, Y] = at3(g, u, v, z);
  return `<g transform="translate(${f1(X)} ${f1(Y)}) scale(${f2(g.s)})"${cls ? ` class="${cls}"` : ''}${style ? ` style="${style}"` : ''}>${inner}</g>`;
};
/** elemen efek ed-* (app.css): jeda negatif supaya tidak serempak */
const fx = (cls: string, delay: number, inner: string, vars = '', attrs = '') => `<g class="${cls}" style="${vars}animation-delay:-${f2(delay)}s"${attrs}>${inner}</g>`;
/** pseudo-acak tetap (pola lantai & dinding sama tiap kali digambar) */
const rnd = (t: number) => { const v = Math.sin(t * 12.9898) * 43758.5453; return v - Math.floor(v); };
/**
 * Sisi tegak sebuah alas segi-banyak yang menghadap kamera (logika sama dengan prism): untuk tiap sisi yang terlihat,
 * fungsi titik (t sepanjang sisi 0..1, z) — dipakai untuk corak di sisi itu (ubin, anyaman), benar juga dari belakang.
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
/** Lubang persegi di bidang datar (bak, kolam): dasar lubang + dua dinding dalam yang jauh dari kamera. */
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
/** matriks affine dari bidang tegak v = Y (a px ke arah u, b px ke atas) ke layar: untuk isi yang diputar CSS */
function planeY(g: IsoCtx, Y: number, cu: number, z0: number) {
  const p0 = at3(g, cu, Y, z0), pa = at3(g, cu + 1 / 32, Y, z0), pb = at3(g, cu, Y, z0 + 1);
  return [pa[0] - p0[0], pa[1] - p0[1], pb[0] - p0[0], pb[1] - p0[1], p0[0], p0[1]].map((v) => Math.round(v * 1000) / 1000).join(' ');
}
/** daun lonjong */
const leaf = (lx: number, ly: number, r: number, a: number, fill: string, s: number, sw = 1) =>
  `<ellipse cx="${f1(lx)}" cy="${f1(ly)}" rx="${f1(r * s)}" ry="${f1(r * 0.5 * s)}" transform="rotate(${f1(a)} ${f1(lx)} ${f1(ly)})" fill="${fill}" stroke="${INK}" stroke-width="${f1(sw * s)}"/>`;
/** gelembung sabun (lingkaran bening + kilau) di titik layar */
const bubble = (bx: number, by: number, r: number, s: number) =>
  `<circle cx="${f1(bx)}" cy="${f1(by)}" r="${f1(r)}" fill="#FFFFFF" fill-opacity=".35" stroke="#7FB8D8" stroke-width="${f1(0.9 * s)}"/><path d="M${f1(bx - r * 0.55)} ${f1(by - r * 0.15)}a${f1(r * 0.6)} ${f1(r * 0.6)} 0 0 1 ${f1(r * 0.45)} ${f1(-r * 0.4)}" fill="none" stroke="#FFFFFF" stroke-width="${f1(0.9 * s)}" stroke-linecap="round"/>`;
/** botol bubut kecil (sampo, sabun cair) */
function bottle(S: Scene, g: IsoCtx, bu: number, bv: number, z: number, h: number, r: number, body: string, cap: string) {
  const neck = Math.max(0.018, r * 0.45);
  let o = lathe(g, bu, bv, [[z, r * 0.92], [z + h * 0.75, r], [z + h * 0.88, neck], [z + h, neck]], body, 1);
  o += lathe(g, bu, bv, [[z + h, neck * 1.2], [z + h + 3, neck * 1.2]], cap, 0.9) + flatE(g, bu, bv, z + h + 3, neck * 1.2, shade(cap, 0.2), 0.8);
  const p = at3(g, bu - r * 0.4, bv + r * 0.4, z + h * 0.2), q = at3(g, bu - r * 0.4, bv + r * 0.4, z + h * 0.62);
  o += thinLine([p, q], '#FFFFFF', 1.2 * g.s, ' opacity=".7"');
  S.add(bu - r, bv - r, bu + r, bv + r, z, z + h + 3, o);
}

/* ================================================================== */
/* Kamar mandi (Mebel Jati)                                             */
/* ================================================================== */

/** tinggi alas shower: = lift animasi shower (activities.ts) */
const TRAY = 4;

const MANDI2: Record<string, FurnDef> = {
  bakgayung: {
    label: 'Bak mandi keramik & gayung',
    colors: { main: '#8FD0E8', accent: '#FFFFFF' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), H = 40, u0 = x + 0.1, v0 = y + 0.1, L = 0.8, k = rk(g);
      const [cx, cy] = g.iso(x + 0.5, y + 0.5);
      S.add(x, y, x + 1, y + 1, -1, 0, shadowE(cx, cy + 3 * s, 0.6 * k, 0.3 * k));
      // bak: ubin di sisi yang terlihat (garis nat + ubin pita tua di atas), bibir bak, air & gayung di dalamnya
      let tiles = '', band = '';
      for (const side of seenSides(g, rect(u0, v0, L, L), 0)) {
        for (const z of [10, 20, 30]) tiles += seg(side(0, z), side(1, z));
        for (const t of [0.25, 0.5, 0.75]) tiles += seg(side(t, 0), side(t, 34));
        band += pathD([side(0, 34), side(1, 34), side(1, H), side(0, H)]);
        for (let i = 0; i < 4; i++) { const t = (i + 0.5) / 4, p = side(t, 37), r = 1.6 * s; band += `M${f1(p[0])} ${f1(p[1] - r)}l${f1(r)} ${f1(r)}l${f1(-r)} ${f1(r)}l${f1(-r)} ${f1(-r)}Z`; }
      }
      let deco = `<path d="${tiles}" stroke="${shade(c.main, -0.28)}" stroke-width="${f1(1 * s)}" fill="none"/>`;
      deco += `<path d="${band}" fill="${shade(c.main, -0.32)}" fill-opacity=".55" stroke="${INK}" stroke-width="${f1(0.8 * s)}" stroke-opacity=".6"/>`;
      // kilau ubin
      for (const side of seenSides(g, rect(u0, v0, L, L), 0)) deco += thinLine([side(0.12, 16), side(0.2, 26)], '#FFFFFF', 1.8 * s, ' opacity=".7"');
      deco += hole(g, u0 + 0.08, v0 + 0.08, u0 + L - 0.08, v0 + L - 0.08, H, 7, shade(c.main, 0.2), '#7FC4E8', 1.1);
      // bibir bak (ubin putih) & air bergoyang
      const [wx, wy] = at3(g, x + 0.5, y + 0.5, H - 7);
      deco += `<path d="M${f1(wx - 0.28 * k)} ${f1(wy + 1 * s)}q${f1(5 * s)} ${f1(-2.5 * s)} ${f1(10 * s)} 0M${f1(wx + 0.02 * k)} ${f1(wy + 4 * s)}q${f1(5 * s)} ${f1(-2.5 * s)} ${f1(10 * s)} 0M${f1(wx - 0.1 * k)} ${f1(wy - 4 * s)}q${f1(4 * s)} ${f1(-2 * s)} ${f1(8 * s)} 0" fill="none" stroke="#FFFFFF" stroke-width="${f1(1.4 * s)}" stroke-linecap="round" opacity=".9"/>`;
      S.box(u0, v0, 0, L, L, H, C3(c.main), deco, 1.5);
      // rangka bibir bak: ubin putih tipis di keempat sisi atas
      {
        const r0 = [at3(g, u0, v0, H), at3(g, u0 + L, v0, H), at3(g, u0 + L, v0 + L, H), at3(g, u0, v0 + L, H)];
        const r1 = [at3(g, u0 + 0.08, v0 + 0.08, H), at3(g, u0 + L - 0.08, v0 + 0.08, H), at3(g, u0 + L - 0.08, v0 + L - 0.08, H), at3(g, u0 + 0.08, v0 + L - 0.08, H)];
        const ring = `M${P(r0).replace(/ /g, 'L')}ZM${P(r1.slice().reverse()).replace(/ /g, 'L')}Z`;
        S.add(u0, v0, u0 + L, v0 + L, H, H + 0.2, `<path d="${ring}" fill="${c.accent}" fill-rule="evenodd" stroke="${INK}" stroke-width="${f1(1.2 * s)}" stroke-linejoin="round"/>`);
      }
      // keran kecil di bibir belakang
      {
        const p0 = at3(g, x + 0.5, y + 0.14, H), p1 = at3(g, x + 0.5, y + 0.14, H + 12), p2 = at3(g, x + 0.5, y + 0.28, H + 12), p3 = at3(g, x + 0.5, y + 0.3, H + 7);
        let h = inkLine([p0, p1, p2, p3], '#C9CED6', 2.2, s);
        const kn = at3(g, x + 0.5, y + 0.14, H + 8);
        h += circ(kn[0], kn[1], 2 * s, '#3F7FBF', s, 0.8);
        S.add(x + 0.44, y + 0.1, x + 0.56, y + 0.32, H, H + 13, h);
      }
      // gayung mengapung: cangkir bulat bergagang panjang yang menjulur keluar bibir bak
      {
        const gu = x + 0.6, gv = y + 0.58, col = '#F28CA8';
        let h = lathe(g, gu, gv, [[H - 7, 0.09], [H, 0.1]], col, 1.1) + flatE(g, gu, gv, H, 0.1, shade(col, -0.25), 1) + flatE(g, gu, gv, H - 0.5, 0.075, '#BFE6F7', 0);
        h += inkLine([at3(g, gu + 0.09, gv, H - 1), at3(g, gu + 0.36, gv + 0.1, H + 5)], col, 2.2, s);
        S.add(gu - 0.1, gv - 0.1, gu + 0.37, gv + 0.12, H - 7, H + 6, h);
      }
      return S.out();
    },
  },
  showertirai: {
    label: 'Shower & tirai ikan',
    colors: { main: '#DDF3FF', accent: '#F2994A' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), k = rk(g), A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z), chrome = '#C9CED6', HT = 118;
      // alas shower: nampan putih bertepi, dasar biru muda & lubang pembuangan
      {
        let h = g.poly([A(0.14, 0.14, TRAY), A(0.86, 0.14, TRAY), A(0.86, 0.86, TRAY), A(0.14, 0.86, TRAY)], '#CFE3EC', 1);
        let ln = '';
        for (const t of [0.32, 0.5, 0.68]) ln += seg(A(t, 0.2, TRAY), A(t, 0.8, TRAY));
        h += `<path d="${ln}" stroke="#B4CCD8" stroke-width="${f1(1 * s)}"/>`;
        const dr = A(0.5, 0.5, TRAY);
        h += ell(dr[0], dr[1], 3.4 * s, 1.7 * s, '#9AA7B8', s, 0.8) + `<path d="M${f1(dr[0] - 2 * s)} ${f1(dr[1])}h${f1(4 * s)}" stroke="${INK}" stroke-width="${f1(0.6 * s)}"/>`;
        S.box(x + 0.06, y + 0.06, 0, 0.88, 0.88, TRAY, C3('#F4F7F9'), h, 1.3);
      }
      // tirai ikan di sisi kiri-belakang (bidang u = 0,08): lipatan bergelombang & ikan-ikan kecil
      {
        const U = x + 0.08, v0 = 0.1, v1 = 0.84, zt = HT + 6, zb = 14, n = 14;
        const top: Pt[] = [], bot: Pt[] = [];
        for (let i = 0; i <= n; i++) {
          const v = v0 + ((v1 - v0) * i) / n, wob = (i % 2 ? 0.035 : -0.01);
          top.push(at3(g, U + wob * 0.5, y + v, zt)); bot.push(at3(g, U + wob, y + v, zb + (i % 2 ? 0 : 2)));
        }
        let h = `<path d="${pathD([...top, ...bot.slice().reverse()])}" fill="${c.main}" stroke="${INK}" stroke-width="${f1(1.3 * s)}" stroke-linejoin="round"/>`;
        // bayangan lipatan
        let fold = '';
        for (let i = 1; i < n; i += 2) fold += pathD([top[i], top[i + 1], bot[i + 1], bot[i]]);
        h += `<path d="${fold}" fill="${shade(c.main, -0.12)}"/>`;
        // pita bawah & ikan cetak
        h += `<path d="${pathD([...bot.map((p) => [p[0], p[1] - 8 * s]), ...bot.slice().reverse()])}" fill="${shade(c.main, -0.22)}" opacity=".7"/>`;
        const fish = (fv: number, fz: number, col: string, dir: number) => {
          const m = onX(g, U + 0.02, y + fv, fz);
          return g.poly([m(-6 * dir, 0), m(-1 * dir, 3.4), m(5 * dir, 2), m(7 * dir, 0), m(5 * dir, -2), m(-1 * dir, -3.4)], col, 0.8) + g.poly([m(-6 * dir, 0), m(-10 * dir, 3), m(-10 * dir, -3)], col, 0.8) + circ(...(m(3.6 * dir, 0.6) as [number, number]), 0.8 * s, INK, s, 0);
        };
        [[0.22, 112, c.accent, 1], [0.52, 98, '#3F9FD8', -1], [0.74, 116, '#F7C548', 1], [0.3, 76, '#F7C548', -1], [0.62, 64, c.accent, 1], [0.24, 44, '#3F9FD8', 1], [0.7, 34, c.accent, -1]].forEach(([fv, fz, col, dir]) => (h += fish(fv as number, fz as number, col as string, dir as number)));
        // gelembung kecil di sela ikan
        for (const [fv, fz] of [[0.4, 104], [0.44, 86], [0.6, 50], [0.36, 58]]) { const p = at3(g, U + 0.02, y + fv, fz); h += `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${f1(1.6 * s)}" fill="none" stroke="#7FB8D8" stroke-width="${f1(0.8 * s)}"/>`; }
        // batang & cincin tirai
        h += inkLine([A(0.08, 0.04, zt + 2), A(0.08, 0.96, zt + 2)], chrome, 1.8, s);
        for (let i = 0; i <= n; i += 2) h += circ(top[i][0], top[i][1] - 2 * s, 1.6 * s, '#FFFFFF', s, 0.8);
        S.add(x + 0.04, y + v0, x + 0.12, y + v1, zb, zt + 3, h);
      }
      // pipa tegak di sudut belakang, lengan ke tengah, kepala pancuran tepat di atas tengah alas
      {
        const pu = 0.16, pv = 0.16;
        let h = inkLine([A(pu, pv, TRAY), A(pu, pv, HT + 4)], chrome, 2.6, s);
        // kran pencampur & tempat sabun
        const m = A(pu, pv, 56);
        h += `<rect x="${f1(m[0] - 5 * s)}" y="${f1(m[1] - 3 * s)}" width="${f1(10 * s)}" height="${f1(6 * s)}" rx="${f1(2 * s)}" fill="${chrome}" stroke="${INK}" stroke-width="${f1(1 * s)}"/>`;
        h += circ(m[0] - 4.5 * s, m[1], 2.2 * s, '#E0583F', s, 0.8) + circ(m[0] + 4.5 * s, m[1], 2.2 * s, '#3F7FBF', s, 0.8);
        const sd = A(pu, pv, 40);
        h += `<path d="M${f1(sd[0] - 6 * s)} ${f1(sd[1])}h${f1(12 * s)}l${f1(-2 * s)} ${f1(3 * s)}h${f1(-8 * s)}Z" fill="${chrome}" stroke="${INK}" stroke-width="${f1(0.9 * s)}" stroke-linejoin="round"/>` + ell(sd[0], sd[1] - 1.2 * s, 3.6 * s, 1.6 * s, '#F7A8C4', s, 0.7);
        S.add(x + pu - 0.03, y + pv - 0.03, x + pu + 0.03, y + pv + 0.03, TRAY, HT + 5, h);
        const arm = inkLine([A(pu, pv, HT + 4), A(0.5, 0.5, HT + 4), A(0.5, 0.5, HT)], chrome, 2.2, s);
        let head = lathe(g, x + 0.5, y + 0.5, [[HT - 6, 0.15], [HT - 4, 0.15], [HT, 0.05]], chrome, 1.2);
        // titik-titik lubang pancuran di bibir & dua tetes jatuh
        const hb = A(0.5, 0.5, HT - 6);
        for (const dx of [-0.09, -0.03, 0.03, 0.09]) head += circ(hb[0] + dx * k, hb[1] + 0.8 * s, 0.7 * s, '#5E6878', s, 0);
        head += `<path d="M${f1(hb[0] - 0.05 * k)} ${f1(hb[1] + 10 * s)}q${f1(1.6 * s)} ${f1(2.6 * s)} 0 ${f1(3.6 * s)}q${f1(-1.6 * s)} ${f1(-1 * s)} 0 ${f1(-3.6 * s)}ZM${f1(hb[0] + 0.07 * k)} ${f1(hb[1] + 20 * s)}q${f1(1.6 * s)} ${f1(2.6 * s)} 0 ${f1(3.6 * s)}q${f1(-1.6 * s)} ${f1(-1 * s)} 0 ${f1(-3.6 * s)}Z" fill="#9FD8F0" stroke="${INK}" stroke-width="${f1(0.6 * s)}"/>`;
        S.add(x + 0.14, y + 0.14, x + 0.66, y + 0.66, HT - 6, HT + 5, arm + head);
      }
      return S.out();
    },
  },
  pengeringbulu: {
    label: 'Pengering bulu berdiri',
    colors: { main: '#F28CA8', accent: '#FFFDF7' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), k = rk(g), cu = x + 0.36, cv = y + 0.36, A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z);
      const [bx, by] = g.iso(cu, cv);
      S.add(x, y, x + 1, y + 1, -1, 0, shadowE(bx, by + 2 * s, 0.34 * k, 0.17 * k));
      // alas bulat berat dengan tiga roda kecil
      {
        let h = '';
        for (const a of [0.6, 2.7, 4.8]) { const p = at3(g, cu + 0.24 * Math.cos(a), cv + 0.24 * Math.sin(a), 1.5); h += ell(p[0], p[1], 2.4 * s, 1.8 * s, '#3B3F55', s, 0.8); }
        h += lathe(g, cu, cv, [[2, 0.27], [5, 0.25], [8, 0.14]], c.main, 1.3) + flatE(g, cu, cv, 8, 0.14, shade(c.main, 0.2), 1);
        S.add(cu - 0.28, cv - 0.28, cu + 0.28, cv + 0.28, 0, 8, h);
      }
      // tiang teleskop & panel tombol (putaran panas & kipas)
      {
        let h = inkLine([at3(g, cu, cv, 8), at3(g, cu, cv, 46)], '#C9CED6', 3, s) + inkLine([at3(g, cu, cv, 46), at3(g, cu, cv, 84)], '#E6E9ED', 2.2, s);
        h += lathe(g, cu, cv, [[44, 0.05], [49, 0.05]], '#5E6878', 1);
        const p = at3(g, cu, cv, 30);
        h += `<rect x="${f1(p[0] - 6 * s)}" y="${f1(p[1] - 7 * s)}" width="${f1(12 * s)}" height="${f1(14 * s)}" rx="${f1(3 * s)}" fill="${c.accent}" stroke="${INK}" stroke-width="${f1(1.1 * s)}"/>`;
        h += circ(p[0], p[1] - 2.5 * s, 2.6 * s, '#F2994A', s, 0.8) + `<path d="M${f1(p[0])} ${f1(p[1] - 2.5 * s)}l${f1(1.6 * s)} ${f1(-1.6 * s)}" stroke="${INK}" stroke-width="${f1(0.8 * s)}"/>` + circ(p[0], p[1] + 3.6 * s, 1.5 * s, '#6BCB77', s, 0.7);
        S.add(cu - 0.06, cv - 0.06, cu + 0.06, cv + 0.06, 8, 86, h);
      }
      // kepala pengering: badan bulat, corong mengarah ke depan-bawah, kisi belakang, udara hangat bergelombang
      {
        const top = at3(g, cu, cv, 84), hc = at3(g, cu + 0.18, cv + 0.18, 90), r = 11 * s;
        let h = inkLine([top, [hc[0] - 4 * s, hc[1] + 3 * s]], '#E6E9ED', 2.2, s);
        // corong (kerucut terpotong) menghadap kiri-bawah layar (arah depan)
        const nz = [hc[0] - 6 * s, hc[1] + 6 * s];
        const dir = [-0.55, 0.84], nrm = [0.84, 0.55];
        const P0 = (t: number, half: number, sg: number) => [nz[0] + dir[0] * t * s + nrm[0] * half * s * sg, nz[1] + dir[1] * t * s + nrm[1] * half * s * sg];
        h += circ(hc[0], hc[1], r, c.main, s, 1.4);
        h += `<path d="${pathD([P0(0, 7, -1), P0(16, 5, -1), P0(16, 5, 1), P0(0, 7, 1)])}" fill="${shade(c.main, -0.12)}" stroke="${INK}" stroke-width="${f1(1.2 * s)}" stroke-linejoin="round"/>`;
        h += `<path d="${pathD([P0(15, 5.6, -1), P0(19, 6.6, -1), P0(19, 6.6, 1), P0(15, 5.6, 1)])}" fill="${c.accent}" stroke="${INK}" stroke-width="${f1(1.1 * s)}" stroke-linejoin="round"/>`;
        // kisi udara di punggung kepala & kilau
        h += `<path d="M${f1(hc[0] + 2 * s)} ${f1(hc[1] - 6 * s)}l${f1(5 * s)} ${f1(4 * s)}M${f1(hc[0] + 1 * s)} ${f1(hc[1] - 2 * s)}l${f1(6 * s)} ${f1(4.6 * s)}M${f1(hc[0])} ${f1(hc[1] + 2 * s)}l${f1(5 * s)} ${f1(3.6 * s)}" stroke="${shade(c.main, -0.35)}" stroke-width="${f1(1.2 * s)}" stroke-linecap="round"/>`;
        h += `<path d="M${f1(hc[0] - 6 * s)} ${f1(hc[1] - 4 * s)}a${f1(7 * s)} ${f1(7 * s)} 0 0 1 ${f1(5 * s)} ${f1(-5 * s)}" fill="none" stroke="#FFFFFF" stroke-width="${f1(1.8 * s)}" stroke-linecap="round" opacity=".8"/>`;
        // telinga kucing kecil di atas kepala pengering (hiasan)
        h += `<path d="M${f1(hc[0] - 7 * s)} ${f1(hc[1] - 7 * s)}l${f1(1 * s)} ${f1(-7 * s)}l${f1(5 * s)} ${f1(4 * s)}ZM${f1(hc[0] + 3 * s)} ${f1(hc[1] - 10 * s)}l${f1(4 * s)} ${f1(-6 * s)}l${f1(3 * s)} ${f1(6 * s)}Z" fill="${c.main}" stroke="${INK}" stroke-width="${f1(1 * s)}" stroke-linejoin="round"/>`;
        // udara hangat: tiga garis bergelombang (kelas water: garis putus-putus mengalir)
        const ex = P0(20, 0, 1);
        let air = '';
        for (const off of [-6, 0, 6]) {
          const a0 = [ex[0] + nrm[0] * off * s, ex[1] + nrm[1] * off * s];
          air += `<path class="water" d="M${f1(a0[0])} ${f1(a0[1])}q${f1((dir[0] * 6 + nrm[0] * 3) * s)} ${f1((dir[1] * 6 + nrm[1] * 3) * s)} ${f1(dir[0] * 12 * s)} ${f1(dir[1] * 12 * s)}t${f1(dir[0] * 12 * s)} ${f1(dir[1] * 12 * s)}" fill="none" stroke="#F7B267" stroke-width="${f1(1.6 * s)}" stroke-linecap="round" stroke-dasharray="${f1(4 * s)} ${f1(3 * s)}" opacity=".85"/>`;
        }
        S.add(cu - 0.1, cv - 0.1, cu + 0.34, cv + 0.34, 70, 104, h + air);
      }
      return S.out();
    },
  },
  mesingelembung: {
    label: 'Mesin gelembung sabun',
    colors: { main: '#7FD3B8', accent: '#F7A8C4' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z), T = 14, wood = C3('#C49A64');
      // dingklik kayu
      for (const u of [0.14, 0.8]) for (const v of [0.14, 0.8]) S.box(x + u, y + v, 0, 0.06, 0.06, T - 3, C3(shade('#C49A64', -0.1)), '', 1);
      S.box(x + 0.1, y + 0.1, T - 3, 0.8, 0.8, 3, wood, '', 1.3);
      // badan mesin: kotak membulat bergagang; lubang kipas & tongkat gelembung di muka depan
      const Yf = y + 0.74, H = 30;
      let front = '';
      if (!g.back) {
        const ring = onY(g, Yf, x + 0.5, T + 13);
        front += g.poly(discPts(ring, 0, 0, 11.5, 11.5, 24), c.accent, 1.2) + g.poly(discPts(ring, 0, 0, 8.6, 8.6, 24), '#2E3B4E', 1);
        let fan = '';
        for (let i = 0; i < 4; i++) fan += `<path transform="rotate(${i * 90})" d="M0 0Q5 -2.4 7.4 -7.4Q1.2 -8 0 0Z" fill="#DDF3FF" stroke="${INK}" stroke-width=".7"/>`;
        front += `<g transform="matrix(${planeY(g, Yf, x + 0.5, T + 13)})"><g class="swim" style="transform-origin:0px 0px;animation-duration:1.2s">${fan}</g></g>`;
        front += circ(...(ring(0, 0) as [number, number]), 1.2 * s, '#C9CED6', s, 0.6);
        // tombol & lampu
        const b = onY(g, Yf, x + 0.76, T + 22);
        front += g.poly(discPts(b, 0, 0, 2.4, 2.4, 12), '#F7C548', 0.8) + g.poly(discPts(onY(g, Yf, x + 0.76, T + 10), 0, 0, 2, 2, 12), '#E0583F', 0.8);
      } else {
        let ln = '';
        for (let z = T + 6; z < T + H - 4; z += 4) ln += seg(A(0.28, 0.26, z), A(0.72, 0.26, z));
        front += `<path d="${ln}" stroke="${shade(c.main, -0.4)}" stroke-width="${f1(1.2 * s)}" stroke-linecap="round"/>`;
      }
      S.box(x + 0.2, y + 0.26, T, 0.6, 0.48, H, C3(c.main), front, 1.4);
      // gagang di atas
      S.add(x + 0.34, y + 0.46, x + 0.66, y + 0.54, T + H, T + H + 9, inkLine([A(0.36, 0.5, T + H), A(0.38, 0.5, T + H + 8), A(0.62, 0.5, T + H + 8), A(0.64, 0.5, T + H)], c.accent, 2.4, s));
      // botol cairan sabun di dingklik
      bottle(S, g, x + 0.16, y + 0.82, T, 13, 0.06, '#C9A2FF', '#FFFFFF');
      // gelembung melayang naik dari corong (ed-rise: naik & memudar)
      let bub = '';
      const list: [number, number, number, number][] = [[-14, -42, 5, 0], [4, -52, 3.6, 0.7], [-24, -60, 4.4, 1.4], [12, -70, 5.6, 2.1], [-6, -82, 3.4, 2.8], [18, -92, 4, 0.4], [-20, -100, 5, 1.1], [2, -112, 3.2, 1.8]];
      for (const [bxl, byl, r, dl] of list) bub += fx('ed-rise', dl * 1.2, bubble(bxl, byl, r, 1), '--rise:26px;');
      S.add(x + 0.3, y + 0.66, x + 0.7, y + 0.76, T + 4, T + 120, at(g, x + 0.5, Yf, 0, bub));
      return S.out();
    },
  },
  rakmainan: {
    label: 'Rak mainan mandi',
    colors: { main: '#7FC4E8', accent: '#E0583F' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z), u0 = x + 0.16, v0 = y + 0.3, W0 = 0.68, D0 = 0.4;
      const panel = C3(c.main), shelf = C3(shade(c.main, 0.2));
      // dua sisi rak & dua papan (bawah, atas), papan punggung rendah
      S.box(u0, v0, 0, 0.05, D0, 40, panel, '', 1.2);
      S.box(u0 + W0 - 0.05, v0, 0, 0.05, D0, 40, panel, '', 1.2);
      S.box(u0 + 0.05, v0, 4, W0 - 0.1, D0, 2.5, shelf, '', 1.1);
      S.box(u0 + 0.05, v0, 22, W0 - 0.1, D0, 2.5, shelf, '', 1.1);
      S.box(u0 + 0.05, v0, 37.5, W0 - 0.1, D0, 2.5, shelf, '', 1.1);
      S.box(u0 + 0.05, v0, 6.5, W0 - 0.1, 0.03, 10, panel, '', 0.9);
      // rak bawah: ikan karet oranye & biru, ember kecil
      const fishy = (fu: number, fv: number, z: number, col: string, dir: number, sz = 1) => {
        const [px, py] = A(fu, fv, z), q = (v: number) => f1(v * s * sz);
        return `<g transform="translate(${f1(px)} ${f1(py)}) scale(${dir} 1)"><path d="M${q(-9)} ${q(-4)}q${q(9)} ${q(-9)} ${q(17)} ${q(-1)}q${q(-8)} ${q(9)} ${q(-17)} ${q(1)}Z" fill="${col}" stroke="${INK}" stroke-width="${f1(1 * s)}"/><path d="M${q(-8)} ${q(-4)}l${q(-6)} ${q(-4)}v${q(8)}Z" fill="${col}" stroke="${INK}" stroke-width="${f1(1 * s)}" stroke-linejoin="round"/><circle cx="${q(4.4)}" cy="${q(-5)}" r="${q(1.4)}" fill="${INK}"/><path d="M${q(-2)} ${q(-9)}q${q(3)} ${q(-3)} ${q(5)} 0" fill="${shade(col, -0.2)}" stroke="${INK}" stroke-width="${f1(0.8 * s)}"/></g>`;
      };
      S.add(u0 + 0.06, v0 + 0.06, u0 + 0.36, v0 + D0 - 0.04, 6.5, 14, fishy(0.36, 0.52, 7, '#F2994A', 1));
      S.add(u0 + 0.36, v0 + 0.06, u0 + W0 - 0.06, v0 + D0 - 0.04, 6.5, 20, lathe(g, x + 0.66, y + 0.5, [[6.5, 0.07], [15, 0.09]], '#F7C548', 1.1) + flatE(g, x + 0.66, y + 0.5, 15, 0.09, '#FFE7A0', 1) + inkLine([A(0.58, 0.5, 15), A(0.66, 0.5, 21), A(0.74, 0.5, 15)], '#F7C548', 1, s));
      // rak tengah: ikan karet biru, bola kecil
      S.add(u0 + 0.06, v0 + 0.06, u0 + 0.4, v0 + D0 - 0.04, 24.5, 32, fishy(0.42, 0.5, 25, '#3F9FD8', -1));
      {
        const [px, py] = A(0.68, 0.48, 30);
        S.add(u0 + 0.42, v0 + 0.06, u0 + W0 - 0.06, v0 + D0 - 0.04, 24.5, 36, circ(px, py, 5 * s, '#F7C548', s, 1.1) + `<path d="M${f1(px - 5 * s)} ${f1(py)}a${f1(5 * s)} ${f1(2.4 * s)} 0 0 0 ${f1(10 * s)} 0" fill="none" stroke="#E0583F" stroke-width="${f1(1.4 * s)}"/><path d="M${f1(px - 1.5 * s)} ${f1(py - 5 * s)}a${f1(2.6 * s)} ${f1(5 * s)} 0 0 0 0 ${f1(10 * s)}" fill="none" stroke="#3F9FD8" stroke-width="${f1(1.4 * s)}"/>`);
      }
      // rak atas: kapal-kapalan berlayar (lambung, tiang, layar segitiga bergaris, bendera)
      {
        const [px, py] = A(0.5, 0.5, 40), q = (v: number) => f1(v * s);
        let h = `<path d="M${f1(px - 14 * s)} ${f1(py - 6 * s)}h${q(28)}l${q(-5)} ${q(7)}h${q(-18)}Z" fill="${c.accent}" stroke="${INK}" stroke-width="${f1(1.2 * s)}" stroke-linejoin="round"/>`;
        h += `<path d="M${f1(px - 12 * s)} ${f1(py - 3.4 * s)}h${q(24)}" stroke="#FFFDF7" stroke-width="${f1(1.4 * s)}"/>`;
        h += circ(px - 4 * s, py - 2.4 * s, 1.3 * s, '#BFE6F7', s, 0.6) + circ(px + 2 * s, py - 2.4 * s, 1.3 * s, '#BFE6F7', s, 0.6);
        h += `<path d="M${f1(px)} ${f1(py - 6 * s)}V${f1(py - 32 * s)}" stroke="${INK}" stroke-width="${f1(1.6 * s)}"/>`;
        h += `<path d="M${f1(px + 1 * s)} ${f1(py - 30 * s)}L${f1(px + 13 * s)} ${f1(py - 9 * s)}H${f1(px + 1 * s)}Z" fill="#FFFDF7" stroke="${INK}" stroke-width="${f1(1.1 * s)}" stroke-linejoin="round"/>`;
        h += `<path d="M${f1(px - 1 * s)} ${f1(py - 26 * s)}L${f1(px - 10 * s)} ${f1(py - 9 * s)}H${f1(px - 1 * s)}Z" fill="#F7C548" stroke="${INK}" stroke-width="${f1(1.1 * s)}" stroke-linejoin="round"/>`;
        h += `<path d="M${f1(px + 3.4 * s)} ${f1(py - 23 * s)}l${q(4)} ${q(7)}" stroke="#3F9FD8" stroke-width="${f1(1.4 * s)}"/>`;
        h += `<path d="M${f1(px)} ${f1(py - 32 * s)}l${q(6)} ${q(2)}l${q(-6)} ${q(2)}Z" fill="#E0583F" stroke="${INK}" stroke-width="${f1(0.7 * s)}" stroke-linejoin="round"/>`;
        S.add(u0 + 0.1, v0 + 0.1, u0 + W0 - 0.1, v0 + D0 - 0.1, 40, 72, h);
      }
      return S.out();
    },
  },
  emberrendam: {
    label: 'Ember rendam kaki',
    colors: { main: '#C8955A', accent: '#9FD8E8' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), k = rk(g), cu = x + 0.5, cv = y + 0.5, H = 13;
      const [cx, cy] = g.iso(cu, cv);
      S.add(x, y, x + 1, y + 1, -1, 0, shadowE(cx, cy + 3 * s, 0.46 * k, 0.23 * k));
      // bak kayu bundar bersimpai, air hangat berkelopak bunga, uap
      {
        let h = lathe(g, cu, cv, [[0, 0.34], [H - 2, 0.4], [H, 0.41]], c.main, 1.5);
        // bilah kayu & dua simpai
        let st = '';
        for (const a of [-0.75, -0.4, -0.05, 0.3, 0.65]) { const p = at3(g, cu + 0.37 * Math.sin(a), cv + 0.37 * Math.cos(a), 1), q = at3(g, cu + 0.4 * Math.sin(a), cv + 0.4 * Math.cos(a), H - 1); st += seg(p, q); }
        h += `<path d="${st}" stroke="${shade(c.main, -0.3)}" stroke-width="${f1(1 * s)}"/>`;
        h += frontArc(g, cu, cv, 3, 0.355, '#5E6878', 1.6) + frontArc(g, cu, cv, H - 3, 0.395, '#5E6878', 1.6);
        h += flatE(g, cu, cv, H, 0.41, shade(c.main, 0.15), 1.3) + flatE(g, cu, cv, H - 1.5, 0.35, c.accent, 1);
        const [wx, wy] = at3(g, cu, cv, H - 1.5);
        // kelopak bunga mengapung & riak
        for (const [dx, dy, col] of [[-0.2, -2, '#F28CA8'], [0.14, 1.5, '#F7C548'], [0.04, -4, '#F28CA8'], [-0.08, 3, '#FFFDF7']] as [number, number, string][]) h += ell(wx + dx * k, wy + dy * s, 2.6 * s, 1.4 * s, col, s, 0.6);
        h += `<path d="M${f1(wx - 0.26 * k)} ${f1(wy + 1 * s)}q${f1(4 * s)} ${f1(-2 * s)} ${f1(8 * s)} 0M${f1(wx + 0.08 * k)} ${f1(wy - 2 * s)}q${f1(4 * s)} ${f1(-2 * s)} ${f1(8 * s)} 0" fill="none" stroke="#FFFFFF" stroke-width="${f1(1.2 * s)}" stroke-linecap="round"/>`;
        h += wisp(wx - 8 * s, wy - 3 * s, s, 18) + wisp(wx + 6 * s, wy - 5 * s, s, 22) + wisp(wx + 18 * s, wy - 1 * s, s, 14);
        S.add(cu - 0.41, cv - 0.41, cu + 0.41, cv + 0.41, 0, H + 24, h);
      }
      // handuk gulung di depan-kanan & teko air panas di belakang-kiri
      {
        const tu = x + 0.88, tv = y + 0.64;
        const [px, py] = at3(g, tu, tv, 0);
        S.add(tu - 0.08, tv - 0.14, tu + 0.08, tv + 0.14, 0, 8, `<path d="M${f1(px - 9 * s)} ${f1(py - 3 * s)}l${f1(12 * s)} ${f1(6 * s)}a${f1(3.6 * s)} ${f1(3.6 * s)} 0 0 0 ${f1(3 * s)} ${f1(-7 * s)}l${f1(-12 * s)} ${f1(-6 * s)}a${f1(3.6 * s)} ${f1(3.6 * s)} 0 0 0 ${f1(-3 * s)} ${f1(7 * s)}Z" fill="#F7A8C4" stroke="${INK}" stroke-width="${f1(1.1 * s)}" stroke-linejoin="round"/><path d="M${f1(px - 4 * s)} ${f1(py - 6.5 * s)}l${f1(12 * s)} ${f1(6 * s)}" stroke="#FFFDF7" stroke-width="${f1(1.3 * s)}"/>`);
        const ku = x + 0.12, kv = y + 0.2;
        let h = lathe(g, ku, kv, [[0, 0.07], [6, 0.09], [10, 0.07], [12, 0.03]], '#E0583F', 1.1) + flatE(g, ku, kv, 12, 0.03, '#FFFDF7', 0.8);
        h += inkLine([at3(g, ku + 0.08, kv, 6), at3(g, ku + 0.16, kv, 11)], '#E0583F', 1.4, s) + wisp(...(at3(g, ku + 0.16, kv, 12) as [number, number]), s, 10);
        S.add(ku - 0.09, kv - 0.09, ku + 0.17, kv + 0.09, 0, 13, h);
      }
      return S.out();
    },
  },
  raksabun: {
    label: 'Rak sabun & sampo bambu',
    colors: { main: '#D9B26A', accent: '#F28CA8' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z), bam = C3(c.main), u0 = x + 0.18, v0 = y + 0.28, W0 = 0.64, D0 = 0.44;
      // empat tiang bambu beruas
      for (const [u, v] of [[0, 0], [W0 - 0.06, 0], [0, D0 - 0.06], [W0 - 0.06, D0 - 0.06]]) {
        let nodes = '';
        for (const z of [18, 40]) nodes += prism(g, rect(u0 + u - 0.006, v0 + v - 0.006, 0.072, 0.072), z, 2, C3(shade(c.main, -0.22)), 0.8);
        S.box(u0 + u, v0 + v, 0, 0.06, 0.06, 62, bam, nodes, 1.1);
      }
      // tiga papan bilah
      for (const z of [8, 30, 52]) {
        let sl = '';
        for (const t of [0.25, 0.5, 0.75]) sl += seg(A(0.18 + 0.02, 0.28 + D0 * t, z + 2.4), A(0.18 + W0 - 0.02, 0.28 + D0 * t, z + 2.4));
        S.box(u0 + 0.02, v0 + 0.02, z, W0 - 0.04, D0 - 0.04, 2.4, C3(shade(c.main, 0.1)), `<path d="${sl}" stroke="${shade(c.main, -0.3)}" stroke-width="${f1(0.8 * s)}"/>`, 1.1);
      }
      // isi: botol sampo & sabun cair, sabun batang, spons, sikat punggung
      bottle(S, g, x + 0.3, y + 0.42, 10.4, 15, 0.07, c.accent, '#FFFFFF');
      bottle(S, g, x + 0.48, y + 0.44, 10.4, 12, 0.06, '#7FC4E8', '#3F7FBF');
      S.box(x + 0.6, y + 0.42, 10.4, 0.14, 0.1, 4, C3('#F7E05A'), '', 0.9);
      bottle(S, g, x + 0.3, y + 0.46, 32.4, 11, 0.06, '#9A6FC0', '#F7C548');
      S.box(x + 0.44, y + 0.38, 32.4, 0.12, 0.09, 3.6, C3('#FFFDF7'), '', 0.9);
      S.box(x + 0.44, y + 0.38, 36, 0.12, 0.09, 3.2, C3('#7FD3B8'), '', 0.9);
      {
        const p = A(0.66, 0.5, 35);
        S.add(x + 0.58, y + 0.42, x + 0.74, y + 0.58, 32.4, 40, ell(p[0], p[1], 6 * s, 4 * s, '#F7A8C4', s, 1) + `<path d="M${f1(p[0] - 4 * s)} ${f1(p[1] - 1 * s)}q${f1(2 * s)} ${f1(2 * s)} ${f1(4 * s)} 0t${f1(4 * s)} 0" fill="none" stroke="${shade('#F7A8C4', -0.3)}" stroke-width="${f1(0.8 * s)}"/>`);
      }
      bottle(S, g, x + 0.34, y + 0.46, 54.4, 13, 0.065, '#6BCB77', '#FFFDF7');
      bottle(S, g, x + 0.52, y + 0.44, 54.4, 9, 0.05, '#F2994A', '#FFFDF7');
      {
        const p0 = A(0.64, 0.48, 54.4), p1 = A(0.74, 0.4, 76);
        S.add(x + 0.6, y + 0.38, x + 0.76, y + 0.52, 54.4, 78, inkLine([p0, p1], '#A86E3F', 1.8, s) + ell(p0[0], p0[1] - 1 * s, 5 * s, 2.6 * s, '#D9B26A', s, 1) + `<path d="M${f1(p0[0] - 4 * s)} ${f1(p0[1] - 1 * s)}h${f1(8 * s)}" stroke="#8A5A36" stroke-width="${f1(1.2 * s)}" stroke-dasharray="${f1(1 * s)} ${f1(1 * s)}"/>`);
      }
      return S.out();
    },
  },
  lampuubur: {
    label: 'Lampu ubur-ubur',
    colors: { main: '#3D4FA8', accent: '#E9B949' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), k = rk(g), cu = x + 0.5, cv = y + 0.5, z0 = 9, z1 = 66, R = 0.18;
      const [cx, cy] = g.iso(cu, cv);
      S.add(x, y, x + 1, y + 1, -2, -1, shadowE(cx, cy + 2 * s, 0.32 * k, 0.16 * k));
      // cahaya lembut di sekeliling lampu (ed-glow: berdenyut pelan; diam = setengah terang)
      S.add(x, y, x + 1, y + 1, -1, 0, at(g, cu, cv, 40, fx('ed-glow', 0, `<ellipse rx="34" ry="44" fill="#B9A8FF"/>`, '', ' opacity=".35"')));
      let h = lathe(g, cu, cv, [[0, 0.26], [3, 0.25], [7, 0.2], [z0, 0.2]], c.accent, 1.3) + frontArc(g, cu, cv, 4, 0.24, shade(c.accent, -0.3), 1.2);
      // tabung kaca berisi air biru-ungu
      h += lathe(g, cu, cv, [[z0, R], [z1, R]], c.main, 1.4);
      h += lathe(g, cu, cv, [[z0 + 1, R * 0.5], [z1 - 2, R * 0.5]], shade(c.main, 0.12), 0);
      // ubur-ubur bercahaya (ed-bob naik-turun, ed-glow berdenyut)
      const jelly = (col: string) =>
        `<path d="M-4 1.5q-2 5 0 9q2 4 0 7M0 1.5q2 5 0 9q-2 3 0 6M4 1.5q2 5 0 8q-2 4 0 6" fill="none" stroke="${col}" stroke-width="1.5" stroke-linecap="round"/>` +
        `<path d="M-7.5 1.5C-8.5 -10 8.5 -10 7.5 1.5Q5.6 3.2 3.7 1.5Q1.9 3.2 0 1.5Q-1.9 3.2 -3.7 1.5Q-5.6 3.2 -7.5 1.5Z" fill="${col}" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/><ellipse cx="-2.8" cy="-4.6" rx="2" ry="1.3" fill="#FFFFFF" opacity=".75"/>`;
      h += at(g, cu - 0.04, cv + 0.04, 50, fx('ed-glow', 0.4, `<circle r="11" fill="#FF9ECF"/>`, '', ' opacity=".35"') + fx('ed-bob', 0, jelly('#FF9ECF')));
      h += at(g, cu + 0.05, cv - 0.02, 28, `<g transform="scale(.8)">${fx('ed-glow', 1.3, `<circle r="11" fill="#8FE8F2"/>`, '', ' opacity=".35"') + fx('ed-bob', 1.1, jelly('#8FE8F2'))}</g>`);
      h += at(g, cu + 0.08, cv + 0.06, 20, fx('ed-rise', 0.6, `<circle r="1.6" fill="none" stroke="#FFFFFF" stroke-width=".9"/><circle cx="-3" cy="6" r="1.1" fill="none" stroke="#FFFFFF" stroke-width=".8"/>`, '--rise:30px;'));
      // kilau kaca & tutup emas
      const [gx0, gy0] = at3(g, cu, cv, z0 + 6);
      h += thinLine([[gx0 - R * k * 0.62, gy0], [gx0 - R * k * 0.62, gy0 - (z1 - z0 - 14) * s]], '#FFFFFF', 2.2 * s, ' opacity=".55"');
      h += lathe(g, cu, cv, [[z1, R + 0.02], [z1 + 5, R + 0.02], [z1 + 8, 0.06]], c.accent, 1.3) + flatE(g, cu, cv, z1 + 8, 0.06, shade(c.accent, 0.2), 1);
      h += circ(...(at3(g, cu, cv, z1 + 10) as [number, number]), 2.4 * s, shade(c.accent, 0.1), s, 1);
      S.add(cu - 0.26, cv - 0.26, cu + 0.26, cv + 0.26, 0, z1 + 12, h);
      return S.out();
    },
  },
  keranjangcucian: {
    label: 'Keranjang cucian rotan',
    colors: { main: '#C8955A', accent: '#F7A8C4' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), k = rk(g), cu = x + 0.5, cv = y + 0.5, H = 34, r0 = 0.27, r1 = 0.34;
      const [cx, cy] = g.iso(cu, cv);
      S.add(x, y, x + 1, y + 1, -1, 0, shadowE(cx, cy + 2 * s, 0.4 * k, 0.2 * k));
      // badan anyaman: lingkar mendatar + bilah tegak bergantian (hanya busur depan)
      let h = lathe(g, cu, cv, [[0, r0], [H - 3, r1 - 0.01], [H, r1]], c.main, 1.5);
      for (const z of [6, 12, 18, 24]) h += frontArc(g, cu, cv, z, r0 + ((r1 - r0) * z) / H, shade(c.main, -0.28), 1.1);
      let st = '';
      for (let i = 0; i < 9; i++) {
        const a = -1.2 + (2.4 * i) / 8;
        for (const [za, zb] of [[1, 6], [12, 18], [24, 30]]) { const r = (z: number) => r0 + ((r1 - r0) * z) / H; const off = i % 2 ? 0 : 6; st += seg(at3(g, cu + r(za + off) * Math.sin(a), cv + r(za + off) * Math.cos(a), za + off), at3(g, cu + r(zb + off) * Math.sin(a), cv + r(zb + off) * Math.cos(a), Math.min(H - 1, zb + off))); }
      }
      h += `<path d="${st}" stroke="${shade(c.main, -0.35)}" stroke-width="${f1(1.4 * s)}" stroke-linecap="round"/>`;
      h += flatE(g, cu, cv, H, r1, shade(c.main, 0.18), 1.4) + flatE(g, cu, cv, H - 0.5, r1 - 0.05, shade(c.main, -0.35), 0.8);
      // cucian yang menyembul: handuk bergaris tersampir di bibir, kaus kaki
      const [tx, ty] = at3(g, cu, cv, H);
      h += `<path d="M${f1(tx - 0.24 * k)} ${f1(ty - 3 * s)}q${f1(8 * s)} ${f1(-9 * s)} ${f1(22 * s)} ${f1(-4 * s)}q${f1(6 * s)} ${f1(3 * s)} ${f1(4 * s)} ${f1(9 * s)}l${f1(-3 * s)} ${f1(14 * s)}l${f1(-9 * s)} ${f1(-2 * s)}l${f1(2 * s)} ${f1(-10 * s)}q${f1(-9 * s)} ${f1(-2 * s)} ${f1(-16 * s)} ${f1(2 * s)}Z" fill="${c.accent}" stroke="${INK}" stroke-width="${f1(1.1 * s)}" stroke-linejoin="round"/>`;
      h += `<path d="M${f1(tx + 0.02 * k)} ${f1(ty + 3 * s)}l${f1(9 * s)} ${f1(2 * s)}M${f1(tx + 0.01 * k)} ${f1(ty + 6.5 * s)}l${f1(9 * s)} ${f1(2 * s)}" stroke="#FFFDF7" stroke-width="${f1(1.4 * s)}"/>`;
      h += `<path d="M${f1(tx - 0.14 * k)} ${f1(ty - 2 * s)}q${f1(-3 * s)} ${f1(-10 * s)} ${f1(2 * s)} ${f1(-12 * s)}l${f1(6 * s)} ${f1(1 * s)}l${f1(-2 * s)} ${f1(8 * s)}Z" fill="#7FC4E8" stroke="${INK}" stroke-width="${f1(1 * s)}" stroke-linejoin="round"/><path d="M${f1(tx - 0.13 * k)} ${f1(ty - 8 * s)}l${f1(6 * s)} ${f1(1.4 * s)}" stroke="#FFFDF7" stroke-width="${f1(1.2 * s)}"/>`;
      // dua pegangan
      for (const sg of [-1, 1]) { const p = at3(g, cu + sg * r1 * 0.98, cv, H - 6); h += `<path d="M${f1(p[0] - sg * 1 * s)} ${f1(p[1] - 3 * s)}q${f1(sg * 6 * s)} ${f1(3 * s)} 0 ${f1(7 * s)}" fill="none" stroke="${INK}" stroke-width="${f1(3 * s)}"/><path d="M${f1(p[0] - sg * 1 * s)} ${f1(p[1] - 3 * s)}q${f1(sg * 6 * s)} ${f1(3 * s)} 0 ${f1(7 * s)}" fill="none" stroke="${shade(c.main, -0.1)}" stroke-width="${f1(1.4 * s)}"/>`; }
      S.add(cu - r1, cv - r1, cu + r1, cv + r1, 0, H + 12, h);
      return S.out();
    },
  },
  lidahmertua: {
    label: 'Pot lidah mertua',
    colors: { main: '#3F7A4E', accent: '#C9714A' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), k = rk(g), cu = x + 0.5, cv = y + 0.5, H = 22;
      const [cx, cy] = g.iso(cu, cv);
      S.add(x, y, x + 1, y + 1, -1, 0, shadowE(cx, cy + 2 * s, 0.32 * k, 0.16 * k));
      let h = lathe(g, cu, cv, [[0, 0.17], [3, 0.2], [H - 3, 0.24], [H, 0.25]], c.accent, 1.4);
      h += frontArc(g, cu, cv, 7, 0.21, '#FFFDF7', 2.2) + frontArc(g, cu, cv, 11, 0.215, '#FFFDF7', 1.2);
      h += flatE(g, cu, cv, H, 0.25, shade(c.accent, 0.15), 1.2) + flatE(g, cu, cv, H - 0.4, 0.2, '#6B4A2B', 0);
      // daun pedang tegak: belakang dulu (lebih tua), depan terakhir; garis kuning di tepi, pita belang muda
      const [sx, sy] = at3(g, cu, cv, H - 0.4);
      const blades: [number, number, number, number][] = [[-6, 60, -8, 0], [7, 66, 6, 0], [-1, 74, -1, 1], [-11, 48, -16, 1], [12, 52, 15, 1], [-4, 56, -4, 2], [4, 50, 9, 2]];
      for (const [bx, len, lean, tier] of blades) {
        const b0 = [sx + bx * s, sy + (tier - 1) * 1.6 * s], tip = [b0[0] + lean * s, b0[1] - len * s], wd = (tier === 2 ? 5 : 4.4) * s;
        const col = tier === 0 ? shade(c.main, -0.15) : tier === 1 ? c.main : shade(c.main, 0.08);
        const L = [b0[0] - wd, b0[1]], R = [b0[0] + wd, b0[1]], mL = [b0[0] - wd * 1.1 + lean * 0.45 * s, b0[1] - len * 0.5 * s], mR = [b0[0] + wd * 1.1 + lean * 0.45 * s, b0[1] - len * 0.5 * s];
        h += `<path d="M${f1(L[0])} ${f1(L[1])}Q${f1(mL[0])} ${f1(mL[1])} ${f1(tip[0])} ${f1(tip[1])}Q${f1(mR[0])} ${f1(mR[1])} ${f1(R[0])} ${f1(R[1])}Z" fill="${col}" stroke="${INK}" stroke-width="${f1(1.1 * s)}" stroke-linejoin="round"/>`;
        h += `<path d="M${f1(L[0] + 1 * s)} ${f1(L[1] - 2 * s)}Q${f1(mL[0] + 1.2 * s)} ${f1(mL[1])} ${f1(tip[0])} ${f1(tip[1] + 3 * s)}M${f1(R[0] - 1 * s)} ${f1(R[1] - 2 * s)}Q${f1(mR[0] - 1.2 * s)} ${f1(mR[1])} ${f1(tip[0])} ${f1(tip[1] + 3 * s)}" fill="none" stroke="#E2CF55" stroke-width="${f1(1.1 * s)}"/>`;
        let band = '';
        for (const t of [0.2, 0.38, 0.56, 0.72]) { const yy = b0[1] - len * t * s, xx = b0[0] + lean * t * t * s, hw = wd * (1 - t * 0.7); band += `M${f1(xx - hw * 0.8)} ${f1(yy + 1.4 * s)}q${f1(hw * 0.8)} ${f1(-2.4 * s)} ${f1(hw * 1.6)} 0`; }
        h += `<path d="${band}" fill="none" stroke="${shade(c.main, 0.35)}" stroke-width="${f1(1.2 * s)}" stroke-linecap="round" opacity=".8"/>`;
      }
      S.add(cu - 0.25, cv - 0.25, cu + 0.25, cv + 0.25, 0, H + 76, h);
      return S.out();
    },
  },
};

/* ================================================================== */
/* Toko Mutiara: bak mandi kaki kucing & pancuran gajah                 */
/* ================================================================== */

/** kaki kucing (cakar membulat, tiga jari, kacang jari merah muda) berdiri di titik layar p */
function catPaw(p: Pt, s: number, fur: string) {
  const q = (v: number) => f1(v * s);
  let o = `<path d="M${f1(p[0] - 4 * s)} ${f1(p[1] - 3 * s)}C${f1(p[0] - 5 * s)} ${f1(p[1] - 10 * s)} ${f1(p[0] + 5 * s)} ${f1(p[1] - 10 * s)} ${f1(p[0] + 4 * s)} ${f1(p[1] - 3 * s)}Z" fill="${fur}" stroke="${INK}" stroke-width="${f1(1.1 * s)}" stroke-linejoin="round"/>`;
  o += ell(p[0], p[1] - 2.4 * s, 6.4 * s, 3.6 * s, fur, s, 1.2);
  o += `<path d="M${f1(p[0] - 2.2 * s)} ${f1(p[1] - 0.2 * s)}v${q(-2.6)}M${f1(p[0] + 2.2 * s)} ${f1(p[1] - 0.2 * s)}v${q(-2.6)}" stroke="${INK}" stroke-width="${f1(0.9 * s)}" stroke-linecap="round"/>`;
  o += `<path d="${ellD(p[0] - 4.2 * s, p[1] + 0.2 * s, 1.1 * s, 0.7 * s)}${ellD(p[0], p[1] + 0.9 * s, 1.1 * s, 0.7 * s)}${ellD(p[0] + 4.2 * s, p[1] + 0.2 * s, 1.1 * s, 0.7 * s)}" fill="#F28CA8"/>`;
  return o;
}

const PREMI: Record<string, FurnDef> = {
  bakkakikucing: {
    label: 'Bak mandi kaki kucing',
    colors: { main: '#F6A9BD', accent: '#FFF3E4' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), k = rk(g), cu = x + w / 2, cv = y + d / 2, rx = w / 2 - 0.16, ry = d / 2 - 0.14, Z0 = 7, H = 17;
      const [cx, cy] = g.iso(cu, cv);
      S.add(x, y, x + w, y + d, -1, 0, shadowE(cx, cy + 3 * s, (rx + 0.12) * k * 0.72, (rx + 0.12) * k * 0.36));
      // empat kaki kucing di bawah lengkung bak
      for (const [du, dv] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const pu = cu + du * rx * 0.72, pv = cv + dv * ry * 0.62;
        S.add(pu - 0.08, pv - 0.06, pu + 0.08, pv + 0.06, 0, Z0 + 1, catPaw(at3(g, pu, pv, 0), s * 1.35, c.accent));
      }
      // badan bak: sisi merah muda dengan pita emas, bibir putih melingkar, air & busa menggunung
      const t = ovalTub(g, cu, cv, rx, ry, Z0, H, C3(c.main), 1.6);
      let h = t.side;
      h += `<polyline points="${P(t.arc.map((i) => at3(g, cu + rx * Math.cos((i / 40) * 2 * Math.PI), cv + ry * Math.sin((i / 40) * 2 * Math.PI), Z0 + 5)))}" fill="none" stroke="#E9B949" stroke-width="${f1(2 * s)}" stroke-linecap="round"/>`;
      const rim = t.ring(Z0 + H), inner = t.ring(Z0 + H, 0.08);
      h += `<path d="M${P(rim).replace(/ /g, 'L')}ZM${P(inner.slice().reverse()).replace(/ /g, 'L')}Z" fill="${c.accent}" fill-rule="evenodd" stroke="${INK}" stroke-width="${f1(1.4 * s)}" stroke-linejoin="round"/>`;
      h += g.poly(t.ring(Z0 + H - 2, 0.1), '#BFE6F7', 1);
      // busa: awan bergerigi di atas air
      const foam: Pt[] = [];
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * 2 * Math.PI, b = 1 + 0.12 * Math.sin(i * 2.7) + (i % 2 ? 0.08 : 0);
        foam.push(at3(g, cu + (rx - 0.18) * b * Math.cos(a), cv + (ry - 0.12) * b * Math.sin(a), Z0 + H + 2 + (i % 3) * 1.4));
      }
      h += `<path d="${pathD(foam)}" fill="#FFFFFF" stroke="${INK}" stroke-width="${f1(1.1 * s)}" stroke-linejoin="round"/>`;
      const [fx0, fy0] = at3(g, cu, cv, Z0 + H + 3);
      for (const [dx, dy, r] of [[-0.42, -3, 3.4], [-0.2, -6, 4.4], [0.06, -4, 3.6], [0.32, -6.5, 4], [0.5, -2.5, 3]]) h += circ(fx0 + dx * k, fy0 + dy * s, r * s, '#FFFFFF', s, 0.9);
      h += `<path d="M${f1(fx0 - 0.3 * k)} ${f1(fy0 + 1 * s)}q${f1(4 * s)} ${f1(2 * s)} ${f1(8 * s)} 0M${f1(fx0 + 0.15 * k)} ${f1(fy0 + 2 * s)}q${f1(4 * s)} ${f1(2 * s)} ${f1(8 * s)} 0" fill="none" stroke="#9FD0E8" stroke-width="${f1(1 * s)}" stroke-linecap="round"/>`;
      S.add(cu - rx, cv - ry, cu + rx, cv + ry, Z0, Z0 + H + 8, h);
      // keran emas & gelembung melayang
      {
        const ku = cu - rx + 0.1;
        const p0 = at3(g, ku, cv, Z0 + H), p1 = at3(g, ku, cv, Z0 + H + 14), p2 = at3(g, ku + 0.16, cv, Z0 + H + 16), p3 = at3(g, ku + 0.22, cv, Z0 + H + 10);
        let k2 = inkLine([p0, p1, p2, p3], '#E9B949', 2.4, s);
        for (const dv of [-0.12, 0.12]) { const q = at3(g, ku - 0.02, cv + dv, Z0 + H + 3); k2 += circ(q[0], q[1], 2.2 * s, '#E9B949', s, 0.9); }
        S.add(ku - 0.04, cv - 0.14, ku + 0.24, cv + 0.14, Z0 + H, Z0 + H + 17, k2);
        let bub = '';
        [[-0.3, 40, 3.4, 0], [0.2, 48, 2.6, 1.2], [0.5, 36, 3, 2.3]].forEach(([du, z, r, dl]) => (bub += at(g, cu + (du as number), cv, z as number, fx('ed-rise', dl as number, bubble(0, 0, r as number, 1), '--rise:22px;'))));
        S.add(cu - 0.4, cv - 0.05, cu + 0.6, cv + 0.05, Z0 + H + 8, Z0 + H + 40, bub);
      }
      return S.out();
    },
  },
  pancurangajah: {
    label: 'Pancuran gajah',
    colors: { main: '#A7B7CC', accent: '#7FC8D8' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), k = rk(g), cu = x + w / 2, cv = y + d / 2, R = Math.min(w, d) / 2 - 0.06, stone = '#D4CCBA';
      // kolam bundar berbibir batu, air biru kehijauan, daun teratai & riak di tengah
      const t = ovalTub(g, cu, cv, R, R, 0, 9, C3(stone), 1.6);
      let h = t.side;
      for (const z of [3, 6]) h += `<polyline points="${P(t.arc.map((i) => at3(g, cu + R * Math.cos((i / 40) * 2 * Math.PI), cv + R * Math.sin((i / 40) * 2 * Math.PI), z)))}" fill="none" stroke="${shade(stone, -0.25)}" stroke-width="${f1(1 * s)}" stroke-dasharray="${f1(10 * s)} ${f1(3 * s)}"/>`;
      const rim = t.ring(9), inner = t.ring(9, 0.12);
      h += `<path d="M${P(rim).replace(/ /g, 'L')}ZM${P(inner.slice().reverse()).replace(/ /g, 'L')}Z" fill="${shade(stone, 0.15)}" fill-rule="evenodd" stroke="${INK}" stroke-width="${f1(1.4 * s)}" stroke-linejoin="round"/>`;
      h += g.poly(t.ring(6, 0.13), c.accent, 1);
      const [wx, wy] = at3(g, cu, cv, 6);
      h += `<path d="${ellD(wx, wy, 0.3 * k, 0.15 * k)}${ellD(wx, wy, 0.55 * k, 0.27 * k)}" fill="none" stroke="#FFFFFF" stroke-width="${f1(1.3 * s)}" opacity=".75"/>`;
      for (const [du, dv, flower] of [[0.5, -0.1, 1], [-0.1, 0.55, 0], [0.38, 0.42, 0]] as [number, number, number][]) {
        const p = at3(g, cu + du * R, cv + dv * R, 6.2);
        h += `<path d="M${f1(p[0])} ${f1(p[1])}l${f1(7 * s)} ${f1(-1.6 * s)}a${f1(7 * s)} ${f1(3.6 * s)} 0 1 1 ${f1(-2 * s)} ${f1(3.8 * s)}Z" fill="#5FAF5A" stroke="${INK}" stroke-width="${f1(0.9 * s)}" stroke-linejoin="round"/>`;
        if (flower) h += `<path d="M${f1(p[0] - 4 * s)} ${f1(p[1] - 1 * s)}q${f1(1 * s)} ${f1(-6 * s)} ${f1(4 * s)} ${f1(-7 * s)}q${f1(3 * s)} ${f1(1 * s)} ${f1(4 * s)} ${f1(7 * s)}q${f1(-4 * s)} ${f1(2.4 * s)} ${f1(-8 * s)} 0Z" fill="#F7A8C4" stroke="${INK}" stroke-width="${f1(0.8 * s)}"/>`;
      }
      S.add(cu - R, cv - R, cu + R, cv + R, 0, 9, h);
      // gajah batu menghadap depan di atas alas, belalai terangkat menyemprotkan air ke tengah kolam
      const eu = cu - R * 0.62, ev = cv - R * 0.62, PZ = 14;
      S.add(eu - 0.2, ev - 0.2, eu + 0.2, ev + 0.2, 0, PZ, lathe(g, eu, ev, [[0, 0.22], [PZ - 3, 0.2], [PZ, 0.22]], stone, 1.3) + flatE(g, eu, ev, PZ, 0.22, shade(stone, 0.15), 1.2) + frontArc(g, eu, ev, 5, 0.21, shade(stone, -0.3), 1.2));
      {
        const E = at3(g, eu, ev, PZ), K = 1.45 * s, m = c.main, dk = shade(m, -0.22), q = (v: number) => f1(v * K);
        const X = (v: number) => f1(E[0] + v * K), Y = (v: number) => f1(E[1] + v * K);
        let e = `<ellipse cx="${X(0)}" cy="${Y(-20)}" rx="${q(21)}" ry="${q(18)}" fill="${dk}" stroke="${INK}" stroke-width="${f1(1.4 * s)}"/>`;
        // kaki depan berkuku
        for (const sx of [-1, 1]) e += `<path d="M${X(sx * 4)} ${Y(-14)}h${q(sx * 10)}v${q(13)}q${q(-sx * 5)} ${q(2)} ${q(-sx * 10)} 0Z" fill="${m}" stroke="${INK}" stroke-width="${f1(1.2 * s)}" stroke-linejoin="round"/><path d="M${X(sx * 6)} ${Y(-1.6)}h${q(sx * 2)}M${X(sx * 9.5)} ${Y(-1.6)}h${q(sx * 2)}" stroke="#FFFDF7" stroke-width="${f1(1.4 * s)}" stroke-linecap="round"/>`;
        // telinga lebar, kepala, mata, gading kecil, hiasan kepala
        for (const sx of [-1, 1]) e += `<ellipse cx="${X(sx * 17)}" cy="${Y(-42)}" rx="${q(11.5)}" ry="${q(14)}" transform="rotate(${sx * 14} ${X(sx * 17)} ${Y(-42)})" fill="${m}" stroke="${INK}" stroke-width="${f1(1.3 * s)}"/><ellipse cx="${X(sx * 17.5)}" cy="${Y(-41)}" rx="${q(7)}" ry="${q(9.5)}" transform="rotate(${sx * 14} ${X(sx * 17.5)} ${Y(-41)})" fill="#F4B6C4"/>`;
        e += `<circle cx="${X(0)}" cy="${Y(-40)}" r="${q(14)}" fill="${m}" stroke="${INK}" stroke-width="${f1(1.4 * s)}"/>`;
        e += `<path d="M${X(-9)} ${Y(-52)}q${q(9)} ${q(-7)} ${q(18)} 0l${q(-3)} ${q(5)}q${q(-6)} ${q(-3)} ${q(-12)} 0Z" fill="#E0583F" stroke="${INK}" stroke-width="${f1(1 * s)}" stroke-linejoin="round"/><circle cx="${X(0)}" cy="${Y(-53.5)}" r="${q(2.2)}" fill="#F7C548" stroke="${INK}" stroke-width="${f1(0.8 * s)}"/>`;
        for (const sx of [-1, 1]) e += `<circle cx="${X(sx * 5.5)}" cy="${Y(-42)}" r="${q(2)}" fill="${INK}"/><circle cx="${X(sx * 5.5 + 0.6)}" cy="${Y(-42.8)}" r="${q(0.7)}" fill="#FFFFFF"/>`;
        e += `<path d="M${X(-6)} ${Y(-31)}q${q(-2)} ${q(5)} ${q(1)} ${q(7)}M${X(6)} ${Y(-31)}q${q(2)} ${q(5)} ${q(-1)} ${q(7)}" fill="none" stroke="#FFFDF7" stroke-width="${f1(2.2 * s)}" stroke-linecap="round"/>`;
        // belalai: melengkung ke bawah lalu naik ke kanan
        const tr = `M${X(0)} ${Y(-34)}C${X(1)} ${Y(-20)} ${X(14)} ${Y(-20)} ${X(17)} ${Y(-32)}C${X(19)} ${Y(-42)} ${X(22)} ${Y(-52)} ${X(29)} ${Y(-58)}`;
        e += `<path d="${tr}" fill="none" stroke="${INK}" stroke-width="${f1(8.6 * K)}" stroke-linecap="round"/><path d="${tr}" fill="none" stroke="${m}" stroke-width="${f1(6.2 * K)}" stroke-linecap="round"/>`;
        e += `<path d="M${X(4)} ${Y(-25)}l${q(2)} ${q(-2)}M${X(9)} ${Y(-24)}l${q(1)} ${q(-3)}M${X(15)} ${Y(-29)}l${q(-2)} ${q(-1)}" stroke="${dk}" stroke-width="${f1(1 * s)}" stroke-linecap="round"/>`;
        // semburan air: lengkung dari ujung belalai ke atas tengah kolam (garis mengalir, kelas water)
        const tip = [E[0] + 29 * K, E[1] - 58 * K], land = at3(g, cu, cv, 92);
        const ctl = [Math.max(tip[0], land[0]) + 14 * s, Math.min(tip[1], land[1]) - 30 * s];
        const arc = `M${f1(tip[0])} ${f1(tip[1])}Q${f1(ctl[0])} ${f1(ctl[1])} ${f1(land[0])} ${f1(land[1])}`;
        e += `<path d="${arc}" fill="none" stroke="#9FD8F0" stroke-width="${f1(5 * s)}" stroke-linecap="round" opacity=".75"/><path class="water" d="${arc}" fill="none" stroke="#FFFFFF" stroke-width="${f1(1.8 * s)}" stroke-linecap="round" stroke-dasharray="${f1(5 * s)} ${f1(6 * s)}"/>`;
        for (const [dx, dy] of [[-5, 4], [4, 9], [-2, 15], [6, 20]]) e += `<path d="M${f1(land[0] + dx * s)} ${f1(land[1] + dy * s)}q${f1(1.4 * s)} ${f1(2.4 * s)} 0 ${f1(3.4 * s)}q${f1(-1.4 * s)} ${f1(-1 * s)} 0 ${f1(-3.4 * s)}Z" fill="#9FD8F0" stroke="${INK}" stroke-width="${f1(0.6 * s)}"/>`;
        S.add(eu - 0.22, ev - 0.22, eu + 0.22, ev + 0.22, PZ, PZ + 90, e);
      }
      return S.out();
    },
  },
};

/* ================================================================== */
/* Mebel khas ruangan Mutiara (gratis bersama ruangannya)               */
/* ================================================================== */

/** tinggi dudukan & palang Ayunan Ban: sama dengan Ayunan Kayu (lift & titik putar animasi ayun) */
const AYUN_SEAT = PERABOT3_AYUN.seat, AYUN_BAR = PERABOT3_AYUN.bar;
const BALLS = ['#E0583F', '#F7C548', '#3F9FD8', '#6BCB77', '#F28CA8'];

/** anggrek bulan: tiga kelopak sempit + dua kelopak lebar (satu kelompok), bibir, titik kuning; px layar */
function orchid(fx0: number, fy0: number, r: number, col: string, s: number) {
  let pet = '';
  for (const [a, rr, wd] of [[-90, 1, 0.42], [150, 0.95, 0.42], [30, 0.95, 0.42], [200, 0.9, 0.62], [-20, 0.9, 0.62]] as [number, number, number][]) {
    const rad = (a * Math.PI) / 180, px = fx0 + Math.cos(rad) * r * rr * 0.55, py = fy0 + Math.sin(rad) * r * rr * 0.55;
    pet += `<ellipse cx="${f1(px)}" cy="${f1(py)}" rx="${f1(r * rr * 0.58)}" ry="${f1(r * wd * 0.62)}" transform="rotate(${f1(a)} ${f1(px)} ${f1(py)})"/>`;
  }
  return `<g fill="${col}" stroke="${INK}" stroke-width="${f1(0.7 * s)}">${pet}</g><path d="M${f1(fx0 - r * 0.3)} ${f1(fy0 + r * 0.15)}q${f1(r * 0.3)} ${f1(r * 0.7)} ${f1(r * 0.6)} 0z" fill="${shade(col, -0.35)}" stroke="${INK}" stroke-width="${f1(0.6 * s)}"/><circle cx="${f1(fx0)}" cy="${f1(fy0 - r * 0.05)}" r="${f1(r * 0.16)}" fill="#F7C548"/>`;
}

const KHAS: Record<string, FurnDef> = {
  kolambola: {
    label: 'Kolam bola',
    colors: { main: '#7FC4E8', accent: '#F7D038' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), cu = x + w / 2, cv = y + d / 2, R = Math.min(w, d) / 2 - 0.08;
      // dua cincin tiup bertumpuk (warna berselang) dengan kilau, bibir atas tebal
      const t1 = ovalTub(g, cu, cv, R, R, 0, 8, C3(c.main), 1.6), t2 = ovalTub(g, cu, cv, R, R, 8, 8, C3(c.accent), 1.6);
      let h = t1.side + t2.side;
      for (const [tt, z] of [[t1, 4], [t2, 12]] as [typeof t1, number][]) {
        const pts = tt.arc.map((i) => at3(g, cu + R * Math.cos((i / 40) * 2 * Math.PI) * 0.995, cv + R * Math.sin((i / 40) * 2 * Math.PI) * 0.995, z + 1.6));
        h += `<polyline points="${P(pts.slice(3, Math.max(4, Math.floor(pts.length * 0.45))))}" fill="none" stroke="#FFFFFF" stroke-width="${f1(1.8 * s)}" stroke-linecap="round" opacity=".7"/>`;
      }
      const rim = t2.ring(16), inner = t2.ring(16, 0.16);
      h += `<path d="M${P(rim).replace(/ /g, 'L')}ZM${P(inner.slice().reverse()).replace(/ /g, 'L')}Z" fill="${shade(c.accent, 0.2)}" fill-rule="evenodd" stroke="${INK}" stroke-width="${f1(1.4 * s)}" stroke-linejoin="round"/>`;
      h += g.poly(t2.ring(13, 0.17), shade(c.main, -0.3), 1);
      // bola-bola warna-warni (satu path per warna, kilau putih bersama)
      const paths = BALLS.map(() => ''), rb = 4.6 * s;
      let shine = '';
      const balls: { p: Pt; c: number }[] = [];
      for (let a = -R + 0.2; a <= R - 0.2; a += 0.15)
        for (let b2 = -R + 0.2; b2 <= R - 0.2; b2 += 0.15) {
          if (a * a + b2 * b2 > (R - 0.22) ** 2) continue;
          const n = Math.round((a + 3) * 31 + (b2 + 3) * 17);
          const z = 14 + (1 - (a * a + b2 * b2) / (R * R)) * 5 + rnd(n) * 2;
          balls.push({ p: at3(g, cu + a + (rnd(n + 1) - 0.5) * 0.05, cv + b2 + (rnd(n + 2) - 0.5) * 0.05, z), c: Math.floor(rnd(n + 3) * BALLS.length) });
        }
      balls.sort((p, q) => p.p[1] - q.p[1]);
      for (const bl of balls) { paths[bl.c] += ellD(bl.p[0], bl.p[1] - rb, rb, rb); shine += ellD(bl.p[0] - rb * 0.35, bl.p[1] - rb * 1.35, rb * 0.28, rb * 0.2); }
      h += paths.map((p, i) => (p ? `<path d="${p}" fill="${BALLS[i]}" stroke="${INK}" stroke-width="${f1(0.9 * s)}"/>` : '')).join('') + `<path d="${shine}" fill="#FFFFFF" opacity=".75"/>`;
      S.add(cu - R, cv - R, cu + R, cv + R, 0, 24, h);
      // dua bola yang terlempar keluar
      for (const [du, dv, ci] of [[R + 0.02, R * 0.55, 2], [R * 0.4, R + 0.04, 0]] as [number, number, number][]) {
        const p = at3(g, cu + du, cv + dv, 0);
        S.add(cu + du - 0.07, cv + dv - 0.07, cu + du + 0.07, cv + dv + 0.07, 0, 9, ell(p[0], p[1] - rb, rb, rb, BALLS[ci], s, 0.9) + ell(p[0] - rb * 0.35, p[1] - rb * 1.35, rb * 0.28, rb * 0.2, '#FFFFFF', s, 0, ' opacity=".75"'));
      }
      return S.out();
    },
  },
  ayunanban: {
    label: 'Ayunan ban',
    colors: { main: '#8A5A36', accent: '#3B3F55' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z), wood = C3(c.main), Z = AYUN_BAR;
      // bidang ketuk tak terlihat di antara kedua kaki: ketuk di mana saja di ayunan
      S.add(x + 0.1, y + 0.49, x + w - 0.1, y + 0.51, -1, 0, g.poly([A(0.1, 0.5, 0), A(w - 0.1, 0.5, 0), A(w - 0.1, 0.5, Z), A(0.1, 0.5, Z)], '#FFFFFF', 0).replace('<polygon ', '<polygon opacity="0" '));
      // kaki segitiga dari batang kayu (garis kulit kayu), palang kayu berlilit daun
      for (const u of [0.12, w - 0.12]) {
        for (const v of [0.08, 0.92]) {
          const a = A(u, v, 0), b = A(u, 0.5 + (v - 0.5) * 0.06, Z - 1), m = (t: number, o: number): Pt => [a[0] + (b[0] - a[0]) * t + o * s, a[1] + (b[1] - a[1]) * t];
          S.add(x + u - 0.06, y + Math.min(v, 0.5) - 0.02, x + u + 0.06, y + Math.max(v, 0.5) + 0.02, 0, Z, inkLine([a, b], c.main, 5.4, s) + thinLine([m(0.2, -1), m(0.42, -1)], shade(c.main, -0.35), 1 * s) + thinLine([m(0.58, 1), m(0.8, 1)], shade(c.main, -0.35), 1 * s));
        }
        S.add(x + u - 0.03, y + 0.26, x + u + 0.03, y + 0.74, 30, 34, inkLine([A(u, 0.3, 32), A(u, 0.7, 32)], shade(c.main, 0.12), 3, s));
      }
      {
        let bar = '';
        // ujung batang: lingkar tahun
        for (const u of [0.02, w - 0.02]) { const p = A(u, 0.5, Z + 3.5); bar += ell(p[0], p[1], 3.2 * s, 4 * s, '#E3B370', s, 1) + ell(p[0], p[1], 1.4 * s, 1.8 * s, 'none', s, 0.6); }
        // daun-daun melilit palang & menjuntai
        for (const [u, dz, a, cl] of [[0.3, 8, -30, 0], [0.42, 7, 20, 1], [0.7, 9, -10, 0], [1.25, 8, 30, 1], [1.4, 9, -25, 0], [1.62, 7, 15, 1], [0.95, 9, 0, 0]] as [number, number, number, number][]) { const p = A(u, 0.5, Z + dz); bar += leaf(p[0], p[1], 6, a, cl ? '#3F8F4E' : '#5FAF5A', s, 1); }
        for (const [u, dz] of [[0.36, -6], [1.5, -8]] as [number, number][]) { const p = A(u, 0.5, Z + dz); bar += leaf(p[0], p[1], 5, 80, '#5FAF5A', s, 1) + leaf(p[0] + 2 * s, p[1] + 7 * s, 4.4, 100, '#3F8F4E', s, 1); }
        S.box(x + 0.02, y + 0.45, Z, w - 0.04, 0.1, 7, wood, bar, 1.3);
      }
      // tali & ban (kelas ayk-ayun: berayun bersama pet dari titik tengah palang, seperti Ayunan Kayu)
      {
        const cu = w / 2, pv = A(cu, 0.5, Z);
        let hh = inkLine([A(cu - 0.05, 0.5, Z), A(cu, 0.5, 54)], '#C8A06A', 1.8, s) + inkLine([A(cu + 0.05, 0.5, Z), A(cu, 0.5, 54)], '#C8A06A', 1.8, s);
        const knot = A(cu, 0.5, 54), ZT = AYUN_SEAT, R = 0.34;
        // tali ke empat titik di ban (yang di belakang dulu)
        for (const a of [Math.PI * 1.25, Math.PI * 1.75, Math.PI * 0.75, Math.PI * 0.25]) hh += inkLine([knot, A(cu + R * 0.8 * Math.cos(a), 0.5 + R * 0.8 * Math.sin(a), ZT)], '#C8A06A', 1.3, s);
        // ban mendatar: sisi berulir, permukaan atas, lubang tengah
        let tire = lathe(g, x + cu, y + 0.5, [[ZT - 7, R - 0.02], [ZT - 4, R], [ZT, R - 0.02]], c.accent, 1.4);
        let tread = '';
        for (let i = 0; i < 9; i++) { const a = Math.PI * (0.12 + (0.76 * i) / 8); tread += seg(at3(g, x + cu + R * Math.cos(a), y + 0.5 + R * Math.sin(a), ZT - 5.5), at3(g, x + cu + R * Math.cos(a + 0.12), y + 0.5 + R * Math.sin(a + 0.12), ZT - 2.5)); }
        tire += `<path d="${tread}" stroke="${shade(c.accent, -0.45)}" stroke-width="${f1(1.4 * s)}" stroke-linecap="round"/>`;
        tire += flatE(g, x + cu, y + 0.5, ZT, R - 0.02, shade(c.accent, 0.16), 1.3) + flatE(g, x + cu, y + 0.5, ZT, 0.16, shade(c.accent, -0.4), 1.2) + frontArc(g, x + cu, y + 0.5, ZT, 0.25, shade(c.accent, 0.35), 1.2);
        S.add(x + cu - 0.46, y + 0.16, x + cu + 0.46, y + 0.84, ZT - 7, Z, `<g class="ayk-ayun" style="transform-origin:${f1(pv[0])}px ${f1(pv[1])}px">${hh}${tire}</g>`);
      }
      return S.out();
    },
  },
  mesinkaraoke: {
    label: 'Mesin karaoke',
    colors: { main: '#6B4FA0', accent: '#F2B632' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z), Yf = y + 0.82, Xf = x + 0.88, H = 44;
      // kabinet speaker: dua corong & lampu LED di muka depan, satu corong di sisi kanan (dari belakang: kisi udara)
      let front = '';
      const cone = (m: (a: number, b: number) => Pt, r: number) => g.poly(discPts(m, 0, 0, r, r, 22), '#2E3242', 1.2) + g.poly(discPts(m, 0, 0, r * 0.66, r * 0.66, 22), '#4A4E64', 1) + g.poly(discPts(m, 0, 0, r * 0.26, r * 0.26, 14), c.accent, 0.8);
      if (!g.back) {
        front += cone(onY(g, Yf, x + 0.32, 18), 9.5) + cone(onY(g, Yf, x + 0.7, 26), 6.4) + cone(onX(g, Xf, y + 0.5, 22), 9);
        ['#E0583F', '#F7C548', '#6BCB77', '#3F9FD8', '#F28CA8'].forEach((col, i) => { const m = onY(g, Yf, x + 0.56 + i * 0.06, 38); front += `<g class="blink" style="animation-delay:-${f2(i * 0.33)}s">${g.poly([m(-1.4, -1.4), m(1.4, -1.4), m(1.4, 1.4), m(-1.4, 1.4)], col, 0.7)}</g>`; });
        front += g.poly(discPts(onY(g, Yf, x + 0.7, 12), 0, 0, 2.6, 2.6, 12), '#C9CED6', 0.8) + g.poly(discPts(onY(g, Yf, x + 0.82, 12), 0, 0, 2.6, 2.6, 12), '#C9CED6', 0.8);
      } else {
        let ln = '';
        for (let z = 8; z < H - 6; z += 5) ln += seg(A(0.24, 0.18, z), A(0.76, 0.18, z)) + seg(A(0.88, 0.3, z), A(0.88, 0.7, z));
        front += `<path d="${ln}" stroke="${shade(c.main, -0.4)}" stroke-width="${f1(1.2 * s)}" stroke-linecap="round"/>`;
      }
      S.box(x + 0.12, y + 0.18, 0, 0.76, 0.64, H, C3(c.main), front, 1.5);
      // layar di atas kabinet: bar lirik warna-warni & bola pemandu (tanpa tulisan)
      {
        const Ys = y + 0.5;
        let scr = '';
        if (!g.back) {
          const m = onY(g, Ys, x + 0.5, H + 4);
          scr += g.poly([m(-14.5, 2), m(14.5, 2), m(14.5, 22), m(-14.5, 22)], '#28307A', 1);
          for (const [y0, x0, x1, col] of [[18, -11, 6, '#F28CA8'], [12, -11, 11, '#F7C548'], [6, -11, 2, '#8FE8F2']] as [number, number, number, string][]) scr += thinLine([m(x0, y0), m(x1, y0)], col, 2.4 * s);
          scr += `<g class="blink">${g.poly(discPts(m, 8, 7, 1.6, 1.6, 10), '#FFFFFF', 0.6)}</g>`;
        }
        S.box(x + 0.2, y + 0.38, H, 0.6, 0.12, 30, C3('#2E3242'), scr, 1.3);
        // bola disko kecil di atas layar
        const db = A(0.5, 0.44, H + 38);
        let ball = inkLine([A(0.5, 0.44, H + 30), A(0.5, 0.44, H + 34)], '#C9CED6', 1.2, s) + circ(db[0], db[1], 5.4 * s, '#DDE3EA', s, 1.1);
        ball += `<path d="M${f1(db[0] - 5.4 * s)} ${f1(db[1])}h${f1(10.8 * s)}M${f1(db[0])} ${f1(db[1] - 5.4 * s)}v${f1(10.8 * s)}M${f1(db[0] - 4 * s)} ${f1(db[1] - 3 * s)}h${f1(8 * s)}M${f1(db[0] - 4 * s)} ${f1(db[1] + 3 * s)}h${f1(8 * s)}" stroke="#9AA7B8" stroke-width="${f1(0.6 * s)}"/>`;
        ball += `<g class="blink"><path d="M${f1(db[0] + 7 * s)} ${f1(db[1] - 6 * s)}l${f1(1 * s)} ${f1(2.4 * s)}l${f1(2.4 * s)} ${f1(1 * s)}l${f1(-2.4 * s)} ${f1(1 * s)}l${f1(-1 * s)} ${f1(2.4 * s)}l${f1(-1 * s)} ${f1(-2.4 * s)}l${f1(-2.4 * s)} ${f1(-1 * s)}l${f1(2.4 * s)} ${f1(-1 * s)}Z" fill="#FFF6D8"/></g>`;
        S.add(x + 0.44, y + 0.38, x + 0.56, y + 0.5, H + 30, H + 44, ball);
      }
      // mikrofon bertiang di depan-kanan, kabel melingkar
      {
        const mu = x + 0.93, mv = y + 0.62, MZ = 64;
        let h = flatE(g, mu, mv, 0, 0.07, '#3B3F55', 1) + inkLine([at3(g, mu, mv, 0), at3(g, mu, mv, MZ)], '#5E6878', 1.6, s);
        const mh = at3(g, mu - 0.03, mv, MZ + 4);
        h += `<path d="M${f1(mh[0] + 1 * s)} ${f1(mh[1] + 4 * s)}l${f1(4 * s)} ${f1(10 * s)}" stroke="${INK}" stroke-width="${f1(3.6 * s)}" stroke-linecap="round"/><path d="M${f1(mh[0] + 1 * s)} ${f1(mh[1] + 4 * s)}l${f1(4 * s)} ${f1(10 * s)}" stroke="${c.accent}" stroke-width="${f1(2 * s)}" stroke-linecap="round"/>`;
        h += circ(mh[0], mh[1], 4.2 * s, '#C9CED6', s, 1.1) + `<path d="M${f1(mh[0] - 3 * s)} ${f1(mh[1] - 1 * s)}h${f1(6 * s)}M${f1(mh[0] - 3 * s)} ${f1(mh[1] + 1.4 * s)}h${f1(6 * s)}" stroke="#7E8B91" stroke-width="${f1(0.6 * s)}"/>`;
        const c0 = at3(g, mu, mv, 0);
        h += `<path d="M${f1(c0[0])} ${f1(c0[1])}c${f1(-8 * s)} ${f1(2 * s)} ${f1(-10 * s)} ${f1(-4 * s)} ${f1(-4 * s)} ${f1(-5 * s)}s${f1(2 * s)} ${f1(5 * s)} ${f1(-6 * s)} ${f1(6 * s)}" fill="none" stroke="#2E3242" stroke-width="${f1(1.2 * s)}"/>`;
        S.add(mu - 0.07, mv - 0.07, mu + 0.07, mv + 0.07, 0, MZ + 8, h);
      }
      return S.out();
    },
  },
  rakanggrek: {
    label: 'Rak anggrek bertingkat',
    colors: { main: '#F4F1EA', accent: '#B35FC4' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), paint = C3(c.main), frame = C3(shade(c.main, -0.12));
      // tiga undakan (depan rendah, belakang tinggi) & dua papan samping berundak
      const tiers: [number, number, number][] = [[0.64, 0.3, 14], [0.36, 0.3, 30], [0.08, 0.3, 46]];
      for (const [v0, dv, z] of tiers) S.box(x + 0.1, y + v0, z - 3, w - 0.2, dv, 3, paint, '', 1.2);
      for (const u of [0.06, w - 0.12]) for (const [v0, dv, z] of tiers) S.box(x + u, y + v0, 0, 0.06, dv, z, frame, '', 1.2);
      // pot & anggrek berbunga (tangkai melengkung, kuntum di ujung)
      const pot = (u: number, v: number, z: number, col: string, r = 0.09) => lathe(g, x + u, y + v, [[z, r * 0.75], [z + 9, r]], col, 1.1) + flatE(g, x + u, y + v, z + 9, r, shade(col, 0.15), 1) + flatE(g, x + u, y + v, z + 9.2, r * 0.8, '#7A9A5A', 0);
      const plant = (u: number, v: number, z: number, potCol: string, flower: string, tall: number, dir: number) => {
        let h = pot(u, v, z, potCol);
        const [px, py] = at3(g, x + u, y + v, z + 9);
        h += leaf(px - 4 * s, py - 1 * s, 7, -18, '#3F8F4E', s, 1) + leaf(px + 4 * s, py - 1.4 * s, 7, 16, '#5FAF5A', s, 1);
        const top = [px + dir * 9 * s, py - tall * s], tip = [px + dir * 16 * s, py - tall * 0.72 * s];
        h += `<path d="M${f1(px)} ${f1(py - 2 * s)}Q${f1(px + dir * 1 * s)} ${f1(py - tall * 1.05 * s)} ${f1(top[0])} ${f1(top[1])}T${f1(tip[0])} ${f1(tip[1])}" fill="none" stroke="#5E7A3A" stroke-width="${f1(1.4 * s)}" stroke-linecap="round"/>`;
        for (const [fxk, fyk, r] of [[0.55, -0.92, 5.4], [0.9, -0.98, 5], [1.25, -0.9, 4.6], [1.55, -0.76, 3.8]] as [number, number, number][]) h += orchid(px + dir * fxk * 10 * s, py + fyk * tall * s + 3 * s, r * s, flower, s);
        S.add(x + u - 0.1, y + v - 0.1, x + u + 0.1, y + v + 0.1, z, z + tall + 6, h);
      };
      plant(0.42, 0.22, 46, '#C9714A', c.accent, 34, 1);
      plant(1.0, 0.22, 46, '#7FC4E8', '#FFFFFF', 38, -1);
      plant(1.58, 0.22, 46, '#C9714A', '#F28CA8', 32, 1);
      plant(0.72, 0.5, 30, '#FFFDF7', '#F28CA8', 30, -1);
      plant(1.3, 0.5, 30, '#C9714A', c.accent, 34, 1);
      // undakan depan: pot daun & botol penyemprot
      {
        let h = pot(0.5, 0.79, 14, '#7FC4E8', 0.08);
        const [px, py] = at3(g, x + 0.5, y + 0.79, 23);
        h += leaf(px - 3 * s, py - 4 * s, 6, -60, '#3F8F4E', s, 1) + leaf(px + 3 * s, py - 4 * s, 6, -120, '#5FAF5A', s, 1) + leaf(px, py - 6 * s, 5.4, -90, '#4F9F4E', s, 1);
        S.add(x + 0.4, y + 0.69, x + 0.6, y + 0.89, 14, 34, h);
        const bu = x + 1.5, bv = y + 0.8;
        let b2 = lathe(g, bu, bv, [[14, 0.06], [24, 0.06], [27, 0.03]], '#6BCB77', 1) + lathe(g, bu, bv, [[27, 0.02], [31, 0.02]], '#FFFFFF', 0.8);
        b2 += inkLine([at3(g, bu, bv, 31), at3(g, bu + 0.08, bv, 31)], '#FFFFFF', 1.2, s);
        S.add(bu - 0.07, bv - 0.07, bu + 0.09, bv + 0.07, 14, 32, b2);
      }
      return S.out();
    },
  },
  kolamairpanas: {
    label: 'Kolam air panas berbatu',
    colors: { main: '#9ED9D6', accent: '#8E8A80' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), k = rk(g), cu = x + w / 2, cv = y + d / 2, R = Math.min(w, d) / 2 - 0.16;
      let h = '';
      // dasar & air susu kebiruan
      const ring = (r: number, z: number, wob = 0) => Array.from({ length: 36 }, (_, i) => { const a = (i / 36) * 2 * Math.PI, b = 1 + wob * Math.sin(i * 1.7); return at3(g, cu + r * b * Math.cos(a), cv + r * b * Math.sin(a), z); });
      h += g.poly(ring(R + 0.06, 1, 0.03), shade(c.main, -0.45), 1.2) + g.poly(ring(R - 0.02, 3, 0.03), c.main, 1) + g.poly(ring(R * 0.55, 3), shade(c.main, 0.25), 0);
      const [wx, wy] = at3(g, cu, cv, 3);
      h += `<path d="M${f1(wx - 0.4 * k)} ${f1(wy + 2 * s)}q${f1(6 * s)} ${f1(-3 * s)} ${f1(12 * s)} 0M${f1(wx + 0.1 * k)} ${f1(wy + 7 * s)}q${f1(6 * s)} ${f1(-3 * s)} ${f1(12 * s)} 0M${f1(wx - 0.1 * k)} ${f1(wy - 6 * s)}q${f1(5 * s)} ${f1(-2.4 * s)} ${f1(10 * s)} 0" fill="none" stroke="#FFFFFF" stroke-width="${f1(1.4 * s)}" stroke-linecap="round" opacity=".8"/>`;
      // bunga kamboja mengapung
      for (const [du, dv] of [[0.3, -0.25], [-0.35, 0.3]]) {
        const p = at3(g, cu + du, cv + dv, 3.4);
        let fl = '';
        for (let i = 0; i < 5; i++) { const a = (i / 5) * 2 * Math.PI; fl += ellD(p[0] + Math.cos(a) * 2.6 * s, p[1] + Math.sin(a) * 1.4 * s, 2.2 * s, 1.3 * s); }
        h += `<path d="${fl}" fill="#FFFDF7" stroke="${INK}" stroke-width="${f1(0.6 * s)}"/><circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${f1(1 * s)}" fill="#F7C548"/>`;
      }
      // batu-batu bulat mengelilingi kolam (diurutkan menurut layar: belakang dulu)
      const rocks: { p: Pt; rx: number; ry: number; col: string }[] = [];
      const cols = [c.accent, shade(c.accent, 0.18), shade(c.accent, -0.12), '#A39784'];
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * 2 * Math.PI + 0.1, rr = R + 0.1 + rnd(i + 7) * 0.05, big = 0.8 + rnd(i + 3) * 0.5;
        rocks.push({ p: at3(g, cu + rr * Math.cos(a), cv + rr * Math.sin(a), 0), rx: 9 * big * s, ry: 6.4 * big * s, col: cols[i % cols.length] });
      }
      rocks.sort((p, q) => p.p[1] - q.p[1]);
      for (const r of rocks) {
        h += `<path d="M${f1(r.p[0] - r.rx)} ${f1(r.p[1])}C${f1(r.p[0] - r.rx)} ${f1(r.p[1] - r.ry * 1.9)} ${f1(r.p[0] + r.rx)} ${f1(r.p[1] - r.ry * 1.9)} ${f1(r.p[0] + r.rx)} ${f1(r.p[1])}Q${f1(r.p[0])} ${f1(r.p[1] + r.ry * 0.5)} ${f1(r.p[0] - r.rx)} ${f1(r.p[1])}Z" fill="${r.col}" stroke="${INK}" stroke-width="${f1(1.2 * s)}" stroke-linejoin="round"/>`;
        h += `<path d="M${f1(r.p[0] - r.rx * 0.5)} ${f1(r.p[1] - r.ry * 0.9)}q${f1(r.rx * 0.3)} ${f1(-r.ry * 0.45)} ${f1(r.rx * 0.6)} ${f1(-r.ry * 0.25)}" fill="none" stroke="#FFFFFF" stroke-width="${f1(1.2 * s)}" stroke-linecap="round" opacity=".55"/>`;
      }
      // pancuran bambu dari batu belakang, uap mengepul
      const b0 = at3(g, cu - R - 0.06, cv - R * 0.2, 22), b1 = at3(g, cu - R * 0.62, cv - R * 0.16, 17), mid = [b0[0] + (b1[0] - b0[0]) * 0.45, b0[1] + (b1[1] - b0[1]) * 0.45];
      h += inkLine([at3(g, cu - R - 0.06, cv - R * 0.2, 0), b0], '#9CA85A', 3, s) + inkLine([b0, b1], '#B9C46A', 3.6, s) + thinLine([[mid[0], mid[1] - 2.4 * s], [mid[0], mid[1] + 2.4 * s]], '#7E8A3A', 1.2 * s);
      const fall = at3(g, cu - R * 0.6, cv - R * 0.16, 3);
      h += `<path class="water" d="M${f1(b1[0])} ${f1(b1[1])}Q${f1(b1[0] + 4 * s)} ${f1((b1[1] + fall[1]) / 2)} ${f1(fall[0] + 2 * s)} ${f1(fall[1])}" fill="none" stroke="#DDF3FF" stroke-width="${f1(2.6 * s)}" stroke-linecap="round" stroke-dasharray="${f1(4 * s)} ${f1(3 * s)}"/>`;
      h += `<path d="${ellD(fall[0] + 2 * s, fall[1], 6 * s, 2.4 * s)}" fill="none" stroke="#FFFFFF" stroke-width="${f1(1 * s)}" opacity=".8"/>`;
      for (const [du, dv, hh] of [[-0.3, -0.2, 22], [0.25, -0.1, 26], [0.05, 0.3, 20], [-0.4, 0.35, 16], [0.45, 0.3, 18]] as [number, number, number][]) { const p = at3(g, cu + du, cv + dv, 4); h += wisp(p[0], p[1], s, hh, '#FFFFFF', 0.55); }
      S.add(cu - R - 0.16, cv - R - 0.16, cu + R + 0.16, cv + R + 0.16, 0, 30, h);
      return S.out();
    },
  },
  sofakerang: {
    label: 'Sofa kerang',
    colors: { main: '#F9C3CF', accent: '#7FD3C8' },
    draw(g, x, y, w, d, c) {
      const s = g.s, S = scene(g), A = (u: number, v: number, z: number) => at3(g, x + u, y + v, z);
      // alas mutiara & bantal duduk bersudut tumpul (atas = 14, tinggi dudukan animasi duduk)
      S.box(x + 0.08, y + 0.2, 0, w - 0.16, 0.72, 6, C3('#F4EEE2'), '', 1.4);
      const cut = 0.12, u0 = x + 0.12, u1 = x + w - 0.12, v0 = y + 0.24, v1 = y + 0.88;
      const seat = [[u0 + cut, v0], [u1 - cut, v0], [u1, v0 + cut], [u1, v1 - cut], [u1 - cut, v1], [u0 + cut, v1], [u0, v1 - cut], [u0, v0 + cut]];
      let sh = '';
      for (const side of seenSides(g, seat, 6)) sh += seg(side(0.1, 10), side(0.9, 10));
      S.add(u0, v0, u1, v1, 6, 14, prism(g, seat, 6, 8, C3(c.accent), 1.4) + `<path d="${sh}" stroke="${shade(c.accent, -0.3)}" stroke-width="${f1(1 * s)}" stroke-dasharray="${f1(2 * s)} ${f1(2 * s)}"/>`);
      // sandaran kerang di bidang belakang: kipas bergelombang dengan rusuk, tebal (bayangan di belakangnya)
      const Yb = y + 0.24, cu = x + w / 2, N = 9;
      const fan = (Y: number, grow: number) => {
        const m = onY(g, Y, cu, 12), pts: Pt[] = [m(-6, -2)];
        for (let i = 0; i <= N * 4; i++) {
          const a = Math.PI - (Math.PI * i) / (N * 4), bump = 1 + 0.06 * Math.abs(Math.sin((i / 4) * Math.PI));
          pts.push(m(Math.cos(a) * 30 * grow * bump, Math.max(0, Math.sin(a)) * 54 * grow * bump));
        }
        pts.push(m(6, -2));
        return { m, pts };
      };
      const back = fan(Yb - 0.05, 1.02), front = fan(Yb, 1);
      let h = g.poly(back.pts, shade(c.main, -0.25), 1.3) + g.poly(front.pts, c.main, 1.4);
      let ribs = '', light = '';
      const o0 = front.m(0, 0);
      for (let i = 0; i <= N; i++) {
        const a = Math.PI - (Math.PI * i) / N, p = front.m(Math.cos(a) * 28, Math.max(0, Math.sin(a)) * 51);
        ribs += seg(o0, p);
        if (i < N && i % 2 === 0) { const a2 = Math.PI - (Math.PI * (i + 1)) / N; light += pathD([o0, p, front.m(Math.cos(a2) * 28, Math.max(0, Math.sin(a2)) * 51)]); }
      }
      h += `<path d="${light}" fill="${shade(c.main, 0.3)}"/><path d="${ribs}" stroke="${shade(c.main, -0.3)}" stroke-width="${f1(1.2 * s)}" stroke-linecap="round"/>`;
      h += g.poly(discPts(front.m, 0, 3, 7, 4.4, 16), shade(c.main, -0.1), 1.1);
      S.add(x + 0.1, Yb - 0.06, x + w - 0.1, Yb, 6, 70, h);
      // bantal mutiara di pojok dudukan
      const pp = A(0.42, 0.6, 20);
      S.add(x + 0.32, y + 0.5, x + 0.52, y + 0.7, 14, 26, circ(pp[0], pp[1], 6.4 * s, '#FFFDF7', s, 1.2) + circ(pp[0] - 2 * s, pp[1] - 2.4 * s, 1.8 * s, '#FFFFFF', s, 0) + `<path d="M${f1(pp[0] + 4.6 * s)} ${f1(pp[1] - 1 * s)}a${f1(6 * s)} ${f1(6 * s)} 0 0 1 ${f1(-3 * s)} ${f1(6 * s)}" fill="none" stroke="#F4B6C4" stroke-width="${f1(1.2 * s)}"/>`);
      return S.out();
    },
  },
};

/* ================================================================== */
/* Dinding & lantai                                                    */
/* ================================================================== */

const { onWall, WALL_H } = WALL_KIT;
const WALL_KEYS = ['ubinperahu', 'balonpastel', 'papanpohon', 'busawarna', 'kacaanggrek', 'batubambu', 'kacaakuarium'];
const FLOOR_KEYS = ['batukalikecil', 'puzzlebusa', 'papandaun', 'lantaidisko', 'batutapak', 'batusungai', 'pasirlaut'];

/** ikan kecil menghadap kanan (dir = −1: kiri), px layar */
const fishD = (x0: number, y0: number, r: number, dir: number) =>
  `M${f1(x0 - r * dir)} ${f1(y0)}q${f1(r * dir)} ${f1(-r * 0.75)} ${f1(2 * r * dir)} 0q${f1(-r * dir)} ${f1(r * 0.75)} ${f1(-2 * r * dir)} 0Zm0 0l${f1(-r * 0.7 * dir)} ${f1(-r * 0.5)}v${f1(r)}Z`;

const wallPattern: WallPattern = (g, side, a, b, wall, main) => {
  if (!WALL_KEYS.includes(wall.key)) return '';
  const L = side === 'L', at0 = (u: number) => onWall(g, side, u), up = (p: number[], v: number) => [p[0], p[1] - v], k = Math.min(1, g.s);
  const P2 = (u: number, v: number) => up(at0(u), v);
  const quad = (u0: number, u1: number, v0: number, v1: number) => pathD([P2(u0, v0), P2(u1, v0), P2(u1, v1), P2(u0, v1)]);
  const lit = (col: string, kk = 0.3) => (L ? col : shade(col, kk));
  const uSteps = (step: number, off = 0) => { const out: number[] = []; for (let u = Math.ceil((a - off) / step - 0.001) * step + off; u < b - 0.001; u += step) if (u > a + 0.001) out.push(u); return out; };
  const WH = WALL_H;
  let o = '';
  if (wall.key === 'ubinperahu') {
    // ubin putih (bawah) & biru muda (atas), lis ombak biru, perahu layar kecil di sebagian ubin
    const lo = lit(wall.main, 0.15), hi = lit(shade(wall.accent, 0.72), 0.2), grout = lit(shade(wall.accent, 0.45), 0.25);
    o += `<path d="${quad(a, b, 26, 72)}" fill="${lo}"/><path d="${quad(a, b, 84, WH - 2)}" fill="${hi}"/>`;
    let ln = '';
    for (const v of [38, 50, 62, 96, 108, 120, 132]) ln += seg(P2(a, v), P2(b, v));
    for (const u of uSteps(0.3)) ln += seg(P2(u, 26), P2(u, 72)) + seg(P2(u, 84), P2(u, WH - 2));
    o += `<path d="${ln}" stroke="${grout}" stroke-width="${f1(1.1 * k)}" fill="none"/>`;
    o += `<path d="${quad(a, b, 72, 84)}" fill="${lit(wall.accent, 0.22)}" stroke="${INK}" stroke-width="1" stroke-opacity=".5"/>`;
    let wave = '';
    for (let u = a; u < b - 0.01; u += 0.2) { const p = P2(u, 77), r = P2(Math.min(b, u + 0.2), 77), m = P2(Math.min(b, u + 0.1), 81); wave += `M${f1(p[0])} ${f1(p[1])}Q${f1(m[0])} ${f1(m[1] - 4)} ${f1(r[0])} ${f1(r[1])}`; }
    o += `<path d="${wave}" fill="none" stroke="#FFFFFF" stroke-width="${f1(1.8 * k)}" stroke-linecap="round"/>`;
    // perahu layar: lambung, layar putih & layar biru, di ubin terpilih
    let hull = '', sail = '', sail2 = '';
    uSteps(0.3).forEach((u, n) => {
      for (const [v, row] of [[44, 0], [114, 1]] as [number, number][]) {
        if ((Math.round(u / 0.3) * 3 + row * 2) % 5 !== 1) continue;
        const p = P2(u - 0.15, v), q = (x: number) => f1(x * k);
        hull += `M${f1(p[0] - 4.6 * k)} ${f1(p[1])}h${q(9.2)}l${q(-2)} ${q(3.2)}h${q(-5.2)}Z`;
        sail += `M${f1(p[0] + 0.4 * k)} ${f1(p[1] - 1 * k)}V${f1(p[1] - 9 * k)}L${f1(p[0] + 5 * k)} ${f1(p[1] - 1 * k)}Z`;
        sail2 += `M${f1(p[0] - 0.6 * k)} ${f1(p[1] - 1 * k)}V${f1(p[1] - 7 * k)}L${f1(p[0] - 4 * k)} ${f1(p[1] - 1 * k)}Z`;
        void n;
      }
    });
    if (hull) o += `<path d="${hull}" fill="${lit('#E0583F', 0.15)}" stroke="${INK}" stroke-width=".7" stroke-opacity=".7"/><path d="${sail}" fill="#FFFFFF" stroke="${INK}" stroke-width=".7" stroke-opacity=".7"/><path d="${sail2}" fill="${lit(wall.accent, 0.2)}"/>`;
  } else if (wall.key === 'balonpastel') {
    // pastel: lis bawah bertitik, balon warna-warni bertali, untaian bendera kecil di atas
    o += `<path d="${quad(a, b, 26, 50)}" fill="${lit(shade(wall.accent, 0.35), 0.2)}"/>`;
    let dots = '';
    for (const u of uSteps(0.22, 0.11)) { const p = P2(u, 38); dots += ellD(p[0], p[1], 1.8 * k, 1.8 * k); }
    o += `<path d="${dots}" fill="#FFFFFF"/>` + `<path d="${seg(P2(a, 50), P2(b, 50))}" stroke="${lit(wall.accent, 0.2)}" stroke-width="${f1(2.4 * k)}"/>`;
    const BAL = ['#F28CA8', '#F7C548', '#7FD3B8', '#B9A2E8', '#7FC4E8'];
    const paths = BAL.map(() => '');
    let strings = '', knots = '', shine = '';
    uSteps(0.62, 0.31).forEach((u) => {
      const n = Math.round(u / 0.62 * 7), v = 84 + ((n * 37) % 40), p = P2(u, v), rx = 6.4 * k, ry = 8.2 * k;
      paths[n % BAL.length] += ellD(p[0], p[1], rx, ry);
      shine += ellD(p[0] - rx * 0.4, p[1] - ry * 0.35, rx * 0.25, ry * 0.18);
      knots += `M${f1(p[0] - 1.6 * k)} ${f1(p[1] + ry + 2 * k)}l${f1(1.6 * k)} ${f1(-2.4 * k)}l${f1(1.6 * k)} ${f1(2.4 * k)}Z`;
      strings += `M${f1(p[0])} ${f1(p[1] + ry + 2 * k)}q${f1(-4 * k)} ${f1(8 * k)} 0 ${f1(14 * k)}t0 ${f1(12 * k)}`;
    });
    o += `<path d="${strings}" fill="none" stroke="${lit('#8A7A9A', 0.2)}" stroke-width="${f1(0.9 * k)}"/>`;
    o += paths.map((p, i) => (p ? `<path d="${p}" fill="${lit(BAL[i], 0.12)}" stroke="${INK}" stroke-width=".9" stroke-opacity=".7"/>` : '')).join('') + `<path d="${knots}" fill="${INK}" opacity=".5"/><path d="${shine}" fill="#FFFFFF" opacity=".7"/>`;
    // bendera segitiga di tali melengkung
    let rope = '', flags = '';
    const span = 1.1;
    for (let u = Math.floor(a / span) * span; u < b; u += span) {
      const u0 = Math.max(a, u), u1 = Math.min(b, u + span);
      if (u1 - u0 < 0.05) continue;
      const sag = (t: number) => P2(u0 + (u1 - u0) * t, 140 - 10 * Math.sin(Math.PI * t) * ((u1 - u0) / span));
      const p0 = sag(0), pm = sag(0.5), p1 = sag(1);
      rope += `M${f1(p0[0])} ${f1(p0[1])}Q${f1(pm[0] * 2 - (p0[0] + p1[0]) / 2)} ${f1(pm[1] * 2 - (p0[1] + p1[1]) / 2)} ${f1(p1[0])} ${f1(p1[1])}`;
      for (const t of [0.15, 0.38, 0.62, 0.85]) { const f = sag(t); flags += `M${f1(f[0] - 3 * k)} ${f1(f[1])}h${f1(6 * k)}l${f1(-3 * k)} ${f1(7 * k)}Z`; }
    }
    o += `<path d="${rope}" fill="none" stroke="${INK}" stroke-width=".9" stroke-opacity=".6"/><path d="${flags}" fill="${lit(wall.accent, 0.1)}" stroke="${INK}" stroke-width=".7" stroke-opacity=".6"/>`;
  } else if (wall.key === 'papanpohon') {
    // papan kayu tegak (sambungan, serat, paku), dahan & daun menjalar di atas
    let seams = '', dark = '', grain = '', nails = '';
    uSteps(0.34).forEach((u, n) => {
      seams += seg(P2(u, 26), P2(u, WH - 2));
      if (n % 2 === 0) dark += quad(u, Math.min(b, u + 0.34), 26, WH - 2);
      const m = P2(u + 0.17, 40 + ((n * 23) % 60));
      grain += `M${f1(m[0] - 0.5)} ${f1(m[1])}q${f1(2 * k)} ${f1(-8 * k)} 0 ${f1(-16 * k)}`;
      for (const v of [44, 120]) { const p = P2(u + 0.05, v); nails += ellD(p[0], p[1], 1 * k, 1 * k); }
    });
    o += `<path d="${dark}" fill="${INK}" opacity=".07"/><path d="${seams}" stroke="${lit(shade(wall.main, -0.35), 0.2)}" stroke-width="${f1(1.4 * k)}"/><path d="${grain}" fill="none" stroke="${lit(shade(wall.main, -0.22), 0.2)}" stroke-width="${f1(1 * k)}" stroke-linecap="round"/><path d="${nails}" fill="${lit('#5E4A3A', 0.2)}"/>`;
    // dahan
    const br: Pt[] = [];
    for (let u = a; u <= b + 0.001; u += 0.25) br.push(P2(Math.min(u, b), 132 + 5 * Math.sin(u * 2.3)));
    o += `<polyline points="${P(br)}" fill="none" stroke="${INK}" stroke-width="${f1(7 * k)}" stroke-linecap="round" stroke-linejoin="round"/><polyline points="${P(br)}" fill="none" stroke="${lit('#7A5236', 0.2)}" stroke-width="${f1(4.6 * k)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    let leaves = '', leaves2 = '';
    uSteps(0.18, 0.05).forEach((u, n) => {
      const p = P2(u, 132 + 5 * Math.sin(u * 2.3) + (n % 3 === 0 ? -8 : 6)), r = (n % 2 ? 6.4 : 5.4) * k;
      const e = `M${f1(p[0] - r)} ${f1(p[1])}q${f1(r)} ${f1(-r * 0.9)} ${f1(2 * r)} 0q${f1(-r)} ${f1(r * 0.9)} ${f1(-2 * r)} 0Z`;
      if (n % 3) leaves += e; else leaves2 += e;
    });
    // daun menjuntai di beberapa tempat
    uSteps(1.1, 0.5).forEach((u) => { for (let i = 0; i < 4; i++) { const p = P2(u + (i % 2 ? 0.03 : -0.03), 122 - i * 11), r = 4.6 * k; leaves += `M${f1(p[0] - r)} ${f1(p[1])}q${f1(r)} ${f1(-r)} ${f1(2 * r)} 0q${f1(-r)} ${f1(r)} ${f1(-2 * r)} 0Z`; } });
    o += `<path d="${leaves}" fill="${lit(wall.accent, 0.12)}" stroke="${INK}" stroke-width=".8" stroke-opacity=".7"/><path d="${leaves2}" fill="${lit(shade(wall.accent, -0.2), 0.12)}" stroke="${INK}" stroke-width=".8" stroke-opacity=".7"/>`;
  } else if (wall.key === 'busawarna') {
    // panel busa peredam warna-warni (pola kotak telur), lampu neon di atas
    const COL = [wall.accent, '#4FC3C8', '#F7C548', '#9A6FC0'];
    const panels = COL.map(() => '');
    let egg = '';
    const step = 0.5, rows = [[32, 58], [62, 88], [92, 118], [122, 142]];
    for (let u = Math.floor(a / step) * step; u < b - 0.01; u += step) {
      const u0 = Math.max(a, u) + 0.03, u1 = Math.min(b, u + step) - 0.03;
      if (u1 - u0 < 0.08) continue;
      rows.forEach(([v0, v1], r) => {
        const ci = (Math.round(u / step) + r * 3) % COL.length;
        panels[ci] += quad(u0, u1, v0, v1);
        for (const t of [0.25, 0.75]) for (const vv of [v0 + (v1 - v0) * 0.3, v0 + (v1 - v0) * 0.72]) { const p = P2(u0 + (u1 - u0) * t, vv); egg += `M${f1(p[0] - 3 * k)} ${f1(p[1])}l${f1(3 * k)} ${f1(-3 * k)}l${f1(3 * k)} ${f1(3 * k)}`; }
      });
    }
    o += panels.map((p, i) => (p ? `<path d="${p}" fill="${lit(COL[i], 0.18)}" stroke="${INK}" stroke-width="1" stroke-opacity=".55"/>` : '')).join('');
    o += `<path d="${egg}" fill="none" stroke="#FFFFFF" stroke-width="${f1(1.1 * k)}" stroke-linecap="round" stroke-linejoin="round" opacity=".45"/>`;
    o += `<path d="${seg(P2(a, 146), P2(b, 146))}" stroke="${wall.accent}" stroke-width="${f1(6 * k)}" stroke-linecap="round" opacity=".35"/><path d="${seg(P2(a, 146), P2(b, 146))}" stroke="#FFE3F0" stroke-width="${f1(1.8 * k)}" stroke-linecap="round"/>`;
  } else if (wall.key === 'kacaanggrek') {
    // dinding rendah bata krem, panel kaca berbingkai putih, daun di balik kaca, kilau kaca
    o += `<path d="${quad(a, b, 26, 46)}" fill="${lit('#D8C7A6', 0.15)}"/>`;
    let br = seg(P2(a, 36), P2(b, 36));
    uSteps(0.36).forEach((u, n) => { br += seg(P2(u, 26), P2(u, 36)) + seg(P2(u + 0.18 * (n % 2 ? 1 : -1), 36), P2(u + 0.18 * (n % 2 ? 1 : -1), 46)); });
    o += `<path d="${br}" stroke="${lit('#A8957A', 0.15)}" stroke-width="${f1(1.1 * k)}"/>`;
    o += `<path d="${quad(a, b, 46, WH - 2)}" fill="${lit(wall.main, 0.15)}"/>`;
    // dedaunan di luar kaca (siluet hijau muda)
    let bush = '';
    uSteps(0.42, 0.2).forEach((u, n) => { const p = P2(u, 54 + (n % 3) * 6), r = (10 + (n % 2) * 4) * k; bush += `M${f1(p[0] - r)} ${f1(p[1] + 6 * k)}a${f1(r)} ${f1(r * 0.9)} 0 0 1 ${f1(2 * r)} 0Z`; });
    o += `<path d="${bush}" fill="${lit('#A8D89A', 0.12)}"/>`;
    // kilau diagonal per panel
    let gl = '';
    uSteps(0.5, 0.12).forEach((u) => { gl += pathD([P2(u, 60), P2(u + 0.1, 60), P2(u + 0.22, 88), P2(u + 0.12, 88)]); });
    o += `<path d="${gl}" fill="#FFFFFF" opacity=".45"/>`;
    // bingkai
    let fr = seg(P2(a, 46), P2(b, 46)) + seg(P2(a, 96), P2(b, 96)) + seg(P2(a, WH - 3), P2(b, WH - 3));
    for (const u of uSteps(0.5)) fr += seg(P2(u, 46), P2(u, WH - 3));
    o += `<path d="${fr}" stroke="${INK}" stroke-width="${f1(4.4 * k)}" stroke-opacity=".75" stroke-linecap="round"/><path d="${fr}" stroke="${lit(wall.accent, 0.1)}" stroke-width="${f1(2.6 * k)}" stroke-linecap="round"/>`;
    // sulur anggrek bergantung dari bingkai atas
    let vine = '', lv = '';
    uSteps(1.3, 0.7).forEach((u) => { const p0 = P2(u, WH - 3), p1 = P2(u + 0.06, WH - 30); vine += `M${f1(p0[0])} ${f1(p0[1])}Q${f1(p0[0] + 6 * k)} ${f1((p0[1] + p1[1]) / 2)} ${f1(p1[0])} ${f1(p1[1])}`; for (const t of [0.3, 0.6, 0.9]) { const q = [p0[0] + (p1[0] - p0[0]) * t + 3 * k, p0[1] + (p1[1] - p0[1]) * t]; lv += `M${f1(q[0] - 4 * k)} ${f1(q[1])}q${f1(4 * k)} ${f1(-3.4 * k)} ${f1(8 * k)} 0q${f1(-4 * k)} ${f1(3.4 * k)} ${f1(-8 * k)} 0Z`; } });
    if (vine) o += `<path d="${vine}" fill="none" stroke="#5E7A3A" stroke-width="${f1(1.4 * k)}"/><path d="${lv}" fill="#5FAF5A" stroke="${INK}" stroke-width=".7" stroke-opacity=".7"/>`;
  } else if (wall.key === 'batubambu') {
    // batu alam di bawah, deretan bambu tegak beruas di atas, tali ijuk melintang
    o += `<path d="${quad(a, b, 26, 72)}" fill="${lit(shade(wall.main, -0.35), 0.15)}"/>`;
    const stones = ['', '', ''];
    let row = 0;
    for (const v of [34, 50, 64]) {
      uSteps(0.26, row % 2 ? 0.13 : 0).concat([a]).forEach((u, n) => {
        if (u > b - 0.12) return;
        const p = P2(Math.max(a + 0.13, Math.min(b - 0.13, u + 0.11)), v), rx = (8.6 + rnd(u * 9 + v) * 3) * k, ry = (6 + rnd(u * 5 + v) * 2) * k;
        stones[(n + row) % 3] += `M${f1(p[0] - rx)} ${f1(p[1])}C${f1(p[0] - rx)} ${f1(p[1] - ry * 1.3)} ${f1(p[0] + rx)} ${f1(p[1] - ry * 1.3)} ${f1(p[0] + rx)} ${f1(p[1])}C${f1(p[0] + rx)} ${f1(p[1] + ry * 1.2)} ${f1(p[0] - rx)} ${f1(p[1] + ry * 1.2)} ${f1(p[0] - rx)} ${f1(p[1])}Z`;
      });
      row++;
    }
    const SC = [wall.main, shade(wall.main, 0.12), shade(wall.main, -0.1)];
    o += stones.map((p, i) => (p ? `<path d="${p}" fill="${lit(SC[i], 0.15)}" stroke="${INK}" stroke-width=".9" stroke-opacity=".6"/>` : '')).join('');
    // bambu
    let poles = '', poles2 = '', nodes = '';
    uSteps(0.14, 0.07).forEach((u, n) => {
      const q = quad(u - 0.06, Math.min(b, u + 0.06), 74, WH - 2);
      if (n % 2) poles += q; else poles2 += q;
      for (const v of [92 + (n % 3) * 4, 122 + (n % 2) * 5]) nodes += seg(P2(u - 0.06, v), P2(Math.min(b, u + 0.06), v));
    });
    o += `<path d="${poles}" fill="${lit(wall.accent, 0.15)}" stroke="${INK}" stroke-width=".9" stroke-opacity=".6"/><path d="${poles2}" fill="${lit(shade(wall.accent, -0.12), 0.15)}" stroke="${INK}" stroke-width=".9" stroke-opacity=".6"/>`;
    o += `<path d="${nodes}" stroke="${lit(shade(wall.accent, -0.4), 0.15)}" stroke-width="${f1(1.4 * k)}"/>`;
    o += `<path d="${seg(P2(a, 106), P2(b, 106))}" stroke="${INK}" stroke-width="${f1(3.4 * k)}" stroke-opacity=".7"/><path d="${seg(P2(a, 106), P2(b, 106))}" stroke="${lit('#6B4A2B', 0.2)}" stroke-width="${f1(2 * k)}" stroke-dasharray="${f1(3 * k)} ${f1(2 * k)}"/>`;
    o += `<path d="${seg(P2(a, 73), P2(b, 73))}" stroke="${INK}" stroke-width="${f1(1.2 * k)}" stroke-opacity=".6"/>`;
  } else {
    // dinding akuarium: air biru berlapis, sinar matahari, rumput laut & karang, gelembung, ikan berenang (ed-swim),
    // tiang bingkai kaca
    o += `<path d="${quad(a, b, 26, 60)}" fill="${lit(shade(wall.main, -0.22), 0.15)}"/><path d="${quad(a, b, 112, WH - 2)}" fill="${lit(shade(wall.main, 0.2), 0.15)}"/>`;
    let rays = '';
    uSteps(0.9, 0.3).forEach((u) => { rays += pathD([P2(u, WH - 2), P2(u + 0.16, WH - 2), P2(u + 0.42, 40), P2(u + 0.32, 40)]); });
    o += `<path d="${rays}" fill="#FFFFFF" opacity=".12"/>`;
    // pasir dasar, rumput laut, karang
    let sand = '';
    const sp: Pt[] = [];
    for (let u = a; u <= b + 0.001; u += 0.1) sp.push(P2(Math.min(u, b), 30 + 3 * Math.sin(u * 5)));
    sand = `M${P([P2(a, 26), ...sp, P2(b, 26)]).replace(/ /g, 'L')}Z`;
    o += `<path d="${sand}" fill="${lit('#E8D3A6', 0.1)}"/>`;
    let weed = '', coral = '';
    uSteps(0.55, 0.2).forEach((u, n) => {
      const p = P2(u, 30), hgt = (34 + (n % 3) * 10) * k;
      weed += `M${f1(p[0])} ${f1(p[1])}q${f1(-6 * k)} ${f1(-hgt / 3)} 0 ${f1(-hgt / 1.6)}t0 ${f1(-hgt / 2.4)}`;
      if (n % 2) { const c2 = P2(u + 0.22, 30); coral += `M${f1(c2[0])} ${f1(c2[1])}v${f1(-10 * k)}m0 ${f1(4 * k)}l${f1(-5 * k)} ${f1(-5 * k)}m${f1(5 * k)} ${f1(2 * k)}l${f1(5 * k)} ${f1(-6 * k)}`; }
    });
    o += `<path d="${weed}" fill="none" stroke="${lit('#3FA06A', 0.15)}" stroke-width="${f1(3 * k)}" stroke-linecap="round"/><path d="${coral}" fill="none" stroke="${lit('#FF8FA3', 0.1)}" stroke-width="${f1(2.6 * k)}" stroke-linecap="round"/>`;
    let bub = '';
    uSteps(0.8, 0.5).forEach((u, n) => { for (let i = 0; i < 4; i++) { const p = P2(u + i * 0.02, 50 + i * 18 + (n % 2) * 6); bub += ellD(p[0], p[1], (1.2 + i * 0.4) * k, (1.2 + i * 0.4) * k); } });
    o += `<path d="${bub}" fill="none" stroke="#FFFFFF" stroke-width="${f1(0.9 * k)}" opacity=".7"/>`;
    // ikan berenang sepanjang dinding (diam saat gerak dikurangi: tetap di tengah jalurnya)
    const len = b - a;
    if (len > 0.8) {
      const n = Math.max(1, Math.min(3, Math.round(len / 1.8)));
      const FC = ['#F2994A', '#F7C548', '#FF8FA3'];
      for (let i = 0; i < n; i++) {
        const v = 70 + ((i * 29) % 44), dir = i % 2 ? -1 : 1, m = P2(a + len * (0.3 + 0.4 * ((i + 0.5) / n)), v), e0 = P2(a + 0.2, v), e1 = P2(b - 0.2, v);
        const tx = ((e1[0] - e0[0]) / 2) * dir, ty = ((e1[1] - e0[1]) / 2) * dir, sx = (e1[0] - e0[0]) * dir >= 0 ? 1 : -1, dur = 13 + i * 3.3 + len;
        o += `<g transform="translate(${f1(m[0])} ${f1(m[1])})"><g class="ed-swim" style="--tx:${f1(tx)}px;--ty:${f1(ty)}px;animation-duration:${f1(dur)}s;animation-delay:-${f1((i * 4.1) % dur)}s"><path d="${fishD(0, 0, 6 * k, sx)}" fill="${FC[i % FC.length]}" stroke="${INK}" stroke-width=".9"/><circle cx="${f1(sx * 3.4 * k)}" cy="${f1(-1 * k)}" r="${f1(1 * k)}" fill="${INK}"/></g></g>`;
      }
    }
    // tiang bingkai akuarium
    let fr = seg(P2(a, WH - 3), P2(b, WH - 3));
    for (const u of uSteps(1.5, 0.75)) fr += seg(P2(u, 26), P2(u, WH - 3));
    o += `<path d="${fr}" stroke="${INK}" stroke-width="${f1(5 * k)}" stroke-opacity=".8" stroke-linecap="round"/><path d="${fr}" stroke="${lit('#2B3A6B', 0.2)}" stroke-width="${f1(3 * k)}" stroke-linecap="round"/>`;
    // kilau kaca
    let gl = '';
    uSteps(1.5, 0.3).forEach((u) => { gl += seg(P2(u, 118), P2(u + 0.14, 136)) + seg(P2(u + 0.12, 112), P2(u + 0.2, 122)); });
    o += `<path d="${gl}" stroke="#FFFFFF" stroke-width="${f1(2 * k)}" stroke-linecap="round" opacity=".45"/>`;
  }
  return o;
};

/** pola lantai per petak (satu poligon dasar + 1–3 path per petak supaya ringan) */
const floorPattern: FloorPattern = (g, floor, i, j, edit) => {
  const key = floor.key;
  if (!FLOOR_KEYS.includes(key)) return '';
  const s = g.s, q = (u: number, v: number) => g.iso(i + u, j + v), pe = ' pointer-events="none"', K = Math.SQRT2 * 32 * s;
  const tile = P([q(0, 0), q(1, 0), q(1, 1), q(0, 1)]);
  const base = (fill: string, stroke = 'none', sw = 1) => `<polygon points="${tile}" fill="${fill}"${stroke !== 'none' ? ` stroke="${stroke}" stroke-width="${sw}"` : ''}${pe}/>`;
  const R = (n: number) => rnd(i * 31.7 + j * 17.3 + n * 7.1);
  const sw = f1(Math.min(1, s));
  if (key === 'batukalikecil') {
    // kerikil kali kecil abu-abu kebiruan di atas adukan
    let o = base(floor.main, shade(floor.main, -0.1));
    if (edit) return o;
    let d1 = '', d2 = '';
    for (let a = 0; a < 3; a++)
      for (let b2 = 0; b2 < 3; b2++) {
        const n = a * 3 + b2, c = q((a + 0.5 + (R(n) - 0.5) * 0.4) / 3, (b2 + 0.5 + (R(n + 9) - 0.5) * 0.4) / 3), rx = (0.1 + R(n + 3) * 0.05) * K;
        const e = ellD(c[0], c[1], rx, rx * 0.55);
        if (R(n + 5) < 0.5) d1 += e; else d2 += e;
      }
    return o + `<path d="${d1}" fill="${floor.accent}" stroke="${shade(floor.accent, -0.25)}" stroke-width="${sw}"${pe}/><path d="${d2}" fill="${shade(floor.accent, 0.25)}" stroke="${shade(floor.accent, -0.25)}" stroke-width="${sw}"${pe}/>`;
  }
  if (key === 'puzzlebusa') {
    // tikar busa puzzle: tiap petak satu warna, tonjolan kait di dua sisi
    const COL = [floor.main, floor.accent, '#F28CA8', '#6BCB77'];
    const ci = (i * 2 + j * 3) % 4, col = COL[ci];
    let o = base(col, shade(col, -0.25), 1.2);
    if (edit) return o;
    // kait: setengah lingkaran di sisi kanan (u = 1) & bawah (v = 1) berwarna petak ini, lubang di sisi kiri & atas berwarna tetangga
    const tab = (u: number, v: number) => { const c = q(u, v); return ellD(c[0], c[1], 0.12 * K, 0.06 * K); };
    const nR = COL[((i + 1) * 2 + j * 3) % 4], nD = COL[(i * 2 + (j + 1) * 3) % 4];
    if (i % 2 === 0) o += `<path d="${tab(0.92, 0.5)}" fill="${nR}" stroke="${shade(nR, -0.25)}" stroke-width="${sw}"${pe}/>`;
    if (j % 2 === 0) o += `<path d="${tab(0.5, 0.92)}" fill="${nD}" stroke="${shade(nD, -0.25)}" stroke-width="${sw}"${pe}/>`;
    const c = q(0.5, 0.5);
    return o + `<path d="${ellD(c[0], c[1], 0.16 * K, 0.08 * K)}" fill="none" stroke="#FFFFFF" stroke-width="${f1(1.2 * Math.min(1, s))}" opacity=".55"${pe}/>`;
  }
  if (key === 'papandaun') {
    // papan kayu memanjang u (tiga bilah per petak) & daun gugur
    let o = base((i + j) % 2 ? floor.main : shade(floor.main, -0.05), shade(floor.main, -0.2));
    let ln = '';
    for (const t of [1 / 3, 2 / 3]) ln += seg(q(0, t), q(1, t));
    const sj = ((i + j) % 3) / 3;
    ln += seg(q(0.5 + sj * 0.4, 0), q(0.5 + sj * 0.4, 1 / 3)) + seg(q(0.2 + sj * 0.3, 1 / 3), q(0.2 + sj * 0.3, 2 / 3)) + seg(q(0.7 - sj * 0.3, 2 / 3), q(0.7 - sj * 0.3, 1));
    o += `<path d="${ln}" stroke="${shade(floor.main, -0.3)}" stroke-width="${sw}"${pe}/>`;
    if (edit) return o;
    let lv = '';
    const n = R(1) < 0.45 ? 1 : R(2) < 0.3 ? 2 : 0;
    for (let m = 0; m < n; m++) { const c = q(0.2 + R(m + 3) * 0.6, 0.2 + R(m + 4) * 0.6), r = 4.4 * s, a = R(m + 5) * 3; lv += `M${f1(c[0] - r * Math.cos(a))} ${f1(c[1] - r * Math.sin(a) * 0.5)}Q${f1(c[0])} ${f1(c[1] - r * 0.9)} ${f1(c[0] + r * Math.cos(a))} ${f1(c[1] + r * Math.sin(a) * 0.5)}Q${f1(c[0])} ${f1(c[1] + r * 0.9)} ${f1(c[0] - r * Math.cos(a))} ${f1(c[1] - r * Math.sin(a) * 0.5)}Z`; }
    return o + (lv ? `<path d="${lv}" fill="${R(7) < 0.5 ? floor.accent : '#E9B23A'}" stroke="${INK}" stroke-width="${f1(0.7 * s)}" stroke-opacity=".7"${pe}/>` : '');
  }
  if (key === 'lantaidisko') {
    // lantai gelap mengilap: garis kilau, bercak lampu disko warna-warni (berkedip pelan: kelas blink)
    let o = base((i + j) % 2 ? floor.main : shade(floor.main, 0.08), shade(floor.main, 0.3), 1);
    if (edit) return o;
    o += `<path d="${seg(q(0.12, 0.7), q(0.12, 0.9))}${seg(q(0.62, 0.15), q(0.62, 0.32))}" stroke="#FFFFFF" stroke-width="${f1(1.2 * Math.min(1, s))}" stroke-linecap="round" opacity=".25"${pe}/>`;
    if ((i * 3 + j * 5) % 4 === 0) {
      const LC = [floor.accent, '#8FE8F2', '#F7E05A', '#B9A2FF'], c = q(0.5, 0.5), col = LC[(i + j * 2) % 4];
      o += `<ellipse class="blink" style="animation-delay:-${f2(((i * 7 + j * 3) % 9) * 0.37)}s" cx="${f1(c[0])}" cy="${f1(c[1])}" rx="${f1(0.34 * K)}" ry="${f1(0.17 * K)}" fill="${col}" opacity=".45"${pe}/>`;
    }
    return o;
  }
  if (key === 'batutapak') {
    // batu pijakan pipih (empat batu per petak) di antara lumut
    let o = base(floor.accent, shade(floor.accent, -0.15));
    const j1 = (R(1) - 0.5) * 0.12, j2 = (R(2) - 0.5) * 0.12;
    const st = [
      [[0.06, 0.06], [0.5 + j1, 0.05], [0.47 + j1, 0.46 + j2], [0.05, 0.5]],
      [[0.55 + j1, 0.05], [0.95, 0.07], [0.94, 0.44 + j2], [0.52 + j1, 0.47 + j2]],
      [[0.05, 0.55], [0.46 + j1, 0.52 + j2], [0.5 + j1, 0.95], [0.07, 0.94]],
      [[0.53 + j1, 0.52 + j2], [0.94, 0.5 + j2], [0.95, 0.94], [0.56 + j1, 0.95]],
    ];
    let d = '';
    for (const poly of st) d += pathD(poly.map(([u, v]) => q(u, v)));
    o += `<path d="${d}" fill="${(i + j) % 2 ? floor.main : shade(floor.main, -0.06)}" stroke="${shade(floor.main, -0.3)}" stroke-width="${sw}" stroke-linejoin="round"${pe}/>`;
    if (edit) return o;
    const c = q(0.25 + R(3) * 0.5, 0.25 + R(4) * 0.5);
    return o + `<path d="M${f1(c[0] - 3 * s)} ${f1(c[1] - 1 * s)}q${f1(3 * s)} ${f1(-2 * s)} ${f1(6 * s)} 0" fill="none" stroke="#FFFFFF" stroke-width="${f1(1.1 * s)}" stroke-linecap="round" opacity=".45"${pe}/>`;
  }
  if (key === 'batusungai') {
    // batu sungai besar yang licin & basah: celah gelap, batu bulat lonjong berkilau
    let o = base(shade(floor.main, -0.25), shade(floor.main, -0.35));
    let d = '', sh = '';
    const pts: [number, number, number][] = [[0.28, 0.3, 0.2], [0.72, 0.28, 0.19], [0.3, 0.74, 0.19], [0.74, 0.72, 0.2]];
    pts.forEach(([u, v, r], n) => {
      const c = q(u + (R(n) - 0.5) * 0.08, v + (R(n + 4) - 0.5) * 0.08), rx = r * K * (0.92 + R(n + 8) * 0.16);
      d += ellD(c[0], c[1], rx, rx * 0.52);
      if (!edit) sh += `M${f1(c[0] - rx * 0.5)} ${f1(c[1] - rx * 0.2)}q${f1(rx * 0.3)} ${f1(-rx * 0.18)} ${f1(rx * 0.6)} ${f1(-rx * 0.1)}`;
    });
    o += `<path d="${d}" fill="${floor.main}" stroke="${shade(floor.main, -0.4)}" stroke-width="${sw}"${pe}/>`;
    return o + (sh ? `<path d="${sh}" fill="none" stroke="${floor.accent}" stroke-width="${f1(1.4 * s)}" stroke-linecap="round"${pe}/>` : '');
  }
  // pasir laut: riak pasir, sinar air (kaustik) samar, kerang & bintang laut di sebagian petak
  let o = base((i + j) % 2 ? floor.main : shade(floor.main, -0.03), shade(floor.main, -0.08));
  if (edit) return o;
  const a1 = q(0.1, 0.35), m1 = q(0.5, 0.2), b1 = q(0.9, 0.38), a2 = q(0.15, 0.75), m2 = q(0.5, 0.6), b2 = q(0.85, 0.78);
  o += `<path d="M${f1(a1[0])} ${f1(a1[1])}Q${f1(m1[0])} ${f1(m1[1])} ${f1(b1[0])} ${f1(b1[1])}M${f1(a2[0])} ${f1(a2[1])}Q${f1(m2[0])} ${f1(m2[1])} ${f1(b2[0])} ${f1(b2[1])}" fill="none" stroke="${shade(floor.main, -0.14)}" stroke-width="${f1(1.2 * s)}" stroke-linecap="round"${pe}/>`;
  const n = Math.floor(R(11) * 7);
  if (n === 0) {
    const c = q(0.62, 0.55), r = 5 * s;
    let st = '';
    for (let m = 0; m < 5; m++) { const a = -Math.PI / 2 + (m * 2 * Math.PI) / 5, a2 = a + Math.PI / 5; st += `${m ? 'L' : 'M'}${f1(c[0] + Math.cos(a) * r)} ${f1(c[1] + Math.sin(a) * r * 0.6)}L${f1(c[0] + Math.cos(a2) * r * 0.45)} ${f1(c[1] + Math.sin(a2) * r * 0.27)}`; }
    o += `<path d="${st}Z" fill="${floor.accent}" stroke="${INK}" stroke-width="${f1(0.7 * s)}" stroke-linejoin="round"${pe}/>`;
  } else if (n === 3) {
    const c = q(0.4, 0.45), r = 4 * s;
    o += `<path d="M${f1(c[0] - r)} ${f1(c[1])}a${f1(r)} ${f1(r * 0.7)} 0 0 1 ${f1(2 * r)} 0ZM${f1(c[0])} ${f1(c[1])}l${f1(-r * 0.5)} ${f1(-r * 0.55)}M${f1(c[0])} ${f1(c[1])}v${f1(-r * 0.7)}M${f1(c[0])} ${f1(c[1])}l${f1(r * 0.5)} ${f1(-r * 0.55)}" fill="#FFE3E0" stroke="${INK}" stroke-width="${f1(0.7 * s)}"${pe}/>`;
  }
  return o;
};

registerSurfaces(
  {
    ubinperahu: { label: 'Ubin perahu layar', colors: { main: '#F4FAFC', accent: '#2F7FA8' } },
    balonpastel: { label: 'Balon pastel', colors: { main: '#FDEAF2', accent: '#9ED8E8' } },
    papanpohon: { label: 'Papan rumah pohon', colors: { main: '#C8955A', accent: '#5FAF5A' } },
    busawarna: { label: 'Busa peredam warna-warni', colors: { main: '#3B2F5E', accent: '#F28CA8' } },
    kacaanggrek: { label: 'Kaca rumah kaca', colors: { main: '#D6EFE4', accent: '#FFFFFF' } },
    batubambu: { label: 'Batu alam & bambu', colors: { main: '#B9B2A2', accent: '#C9CC72' } },
    kacaakuarium: { label: 'Kaca akuarium (ikan berenang)', colors: { main: '#2F6FA8', accent: '#8FE8F2' } },
  },
  {
    batukalikecil: { label: 'Batu kali kecil', colors: { main: '#D8DCDA', accent: '#8C9AA2' } },
    puzzlebusa: { label: 'Tikar busa puzzle', colors: { main: '#F7C548', accent: '#7FC4E8' } },
    papandaun: { label: 'Papan berdaun gugur', colors: { main: '#B98552', accent: '#6BB55A' } },
    lantaidisko: { label: 'Lantai disko mengilap', colors: { main: '#2E2546', accent: '#F28CA8' } },
    batutapak: { label: 'Batu pijakan berlumut', colors: { main: '#C3C2B4', accent: '#7DAA6A' } },
    batusungai: { label: 'Batu sungai licin', colors: { main: '#7E8790', accent: '#C6D0D8' } },
    pasirlaut: { label: 'Pasir dasar laut', colors: { main: '#F2DEB0', accent: '#F2994A' } },
  },
  wallPattern,
  floorPattern,
);

/* ================================================================== */
/* Ikon ruangan Mutiara (dinding, lantai & mebel khas di ruang mini)   */
/* ================================================================== */

registerRoomLooks({
  ruangmain: { label: 'Ruang Main Anak', colors: { main: '#FDEAF2', accent: '#F7C548' }, wall: 'balonpastel', floor: 'puzzlebusa', furn: { key: 'kolambola', w: 2, d: 2 } },
  rumahpohon: { label: 'Rumah Pohon', colors: { main: '#C8955A', accent: '#B98552' }, wall: 'papanpohon', floor: 'papandaun', furn: { key: 'ayunanban', w: 2, d: 1 } },
  karaoke: { label: 'Studio Karaoke', colors: { main: '#3B2F5E', accent: '#2E2546' }, wall: 'busawarna', floor: 'lantaidisko', furn: { key: 'mesinkaraoke', w: 1, d: 1 } },
  rumahkaca: { label: 'Rumah Kaca Anggrek', colors: { main: '#D6EFE4', accent: '#C3C2B4' }, wall: 'kacaanggrek', floor: 'batutapak', furn: { key: 'rakanggrek', w: 2, d: 1 } },
  airpanas: { label: 'Pemandian Air Panas', colors: { main: '#B9B2A2', accent: '#7E8790' }, wall: 'batubambu', floor: 'batusungai', furn: { key: 'kolamairpanas', w: 2, d: 2 } },
  ruangakuarium: { label: 'Ruang Akuarium', colors: { main: '#2F6FA8', accent: '#F2DEB0' }, wall: 'kacaakuarium', floor: 'pasirlaut', furn: { key: 'sofakerang', w: 2, d: 1 } },
});

/* ================================================================== */
/* Properti pet untuk animasi baru (koordinat lokal pet, kaki di 0,0)  */
/* ================================================================== */

/**
 * gayung: gayung terangkat di atas kepala, dimiringkan (p-gayung, berputar dari pegangannya), aliran air mengguyur
 * kepala (p-guyur) & cipratan; shower: tetes air jatuh dari pancuran (p-shower: garis putus-putus mengalir ke bawah) &
 * busa di kepala; kering: angin hangat bergelombang dari depan (p-angin) & gumpalan bulu halus (p-bulu) — badan pet
 * mengembang lewat CSS (pose-kering). Tanpa CSS (foto, admin) semuanya diam di tengah gerakan.
 */
const DROP = (x0: number, y0: number, r = 1) => `M${f1(x0)} ${f1(y0 - 4 * r)}q${f1(3 * r)} ${f1(4.4 * r)} 0 ${f1(6.4 * r)}q${f1(-3 * r)} ${f1(-2 * r)} 0 ${f1(-6.4 * r)}Z`;
const PROPS_M2: Record<string, string> = {
  gayung: `<g class="p-guyur"><path d="M1 -122C-2 -110 -4 -98 -3 -82L6 -82C6 -96 8 -108 11 -119Z" fill="#9FD8F0" stroke="#5FA8D0" stroke-width="1.6" opacity=".9"/><path d="M4 -114Q2 -102 2 -90" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round"/><path d="${DROP(-30, -80)}${DROP(32, -76)}${DROP(-22, -96, 0.8)}${DROP(26, -94, 0.8)}${DROP(-40, -64, 0.7)}${DROP(42, -60, 0.7)}" fill="#9FD8F0" stroke="${INK}" stroke-width="1.2"/></g>`
    + `<g class="p-gayung"><g transform="translate(16 -122) rotate(-32)"><path d="M-10 -9h20l-2 18q-8 4 -16 0Z" fill="#F28CA8" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><ellipse cx="0" cy="-9" rx="10" ry="3.6" fill="#BFE6F7" stroke="${INK}" stroke-width="2.2"/><path d="M-5 -2v8" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" opacity=".7"/><path d="M9 -2L33 8" stroke="${INK}" stroke-width="6.6" stroke-linecap="round"/><path d="M9 -2L33 8" stroke="#F28CA8" stroke-width="3.4" stroke-linecap="round"/></g></g>`,
  shower: `<g class="p-shower"><path d="M-34 -156V-40M-14 -160V-86M8 -160V-88M28 -156V-44M-24 -150V-104M18 -150V-102" fill="none" stroke="#7FC4E8" stroke-width="3" stroke-linecap="round" stroke-dasharray="7 11" opacity=".9"/><path d="M-34 -156V-40M28 -156V-44" fill="none" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round" stroke-dasharray="7 11"/></g>`
    + `<g class="p-busa"><circle cx="-8" cy="-80" r="5" fill="#FFFFFF" stroke="#9FD0E8" stroke-width="1.4"/><circle cx="4" cy="-82" r="6" fill="#FFFFFF" stroke="#9FD0E8" stroke-width="1.4"/><circle cx="15" cy="-78" r="4" fill="#FFFFFF" stroke="#9FD0E8" stroke-width="1.4"/><circle cx="-18" cy="-76" r="3.4" fill="#FFFFFF" stroke="#9FD0E8" stroke-width="1.4"/></g>`
    + `<g class="p-cipr"><path d="${DROP(-44, -8, 0.8)}${DROP(44, -10, 0.8)}${DROP(-52, -22, 0.6)}${DROP(54, -24, 0.6)}" fill="#9FD8F0" stroke="${INK}" stroke-width="1.1"/></g>`,
  kering: `<g class="p-angin"><path d="M88 -64q-8 -6 -16 0t-16 0M92 -46q-8 -6 -16 0t-16 0M84 -82q-8 -6 -16 0t-14 0" fill="none" stroke="#F7B267" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="9 6"/></g>`
    + `<g class="p-bulu"><path d="M-50 -46a6 6 0 0 1 4 -10a6 6 0 0 1 9 -2a5 5 0 0 1 2 9a6 6 0 0 1 -15 3ZM40 -78a6 6 0 0 1 6 -9a6 6 0 0 1 9 3a5 5 0 0 1 -2 9a6 6 0 0 1 -13 -3ZM-40 -82a5 5 0 0 1 6 -7a5 5 0 0 1 8 3a5 5 0 0 1 -3 7a5 5 0 0 1 -11 -3ZM46 -30a5 5 0 0 1 6 -6a5 5 0 0 1 7 4a5 5 0 0 1 -4 7a5 5 0 0 1 -9 -5ZM-4 -94a5 5 0 0 1 6 -7a5 5 0 0 1 8 3a5 5 0 0 1 -3 7a5 5 0 0 1 -11 -3Z" fill="#FFFFFF" fill-opacity=".85" stroke="#C9CED6" stroke-width="1.4"/><path d="M-30 -96l2 -6l2 6l6 2l-6 2l-2 6l-2 -6l-6 -2ZM30 -100l1.6 -4.6l1.6 4.6l4.6 1.6l-4.6 1.6l-1.6 4.6l-1.6 -4.6l-4.6 -1.6Z" fill="#FFE27A" stroke="${INK}" stroke-width="1"/></g>`,
};

registerArt({}, { ...MANDI2, ...PREMI, ...KHAS }, PROPS_M2);

/** bentuk mebel baru per kelompok (untuk uji & galeri) */
export const MANDI2_ART = { mandi: Object.keys(MANDI2), mutiara: Object.keys(PREMI), khas: Object.keys(KHAS) };
/** dinding & lantai baru (yang pertama milik Mebel Jati, sisanya khusus ruangan Mutiara) */
export const MANDI2_SURFACES = { wallpaper: WALL_KEYS, floor: FLOOR_KEYS };
/** ruangan bertema: bentuk ikon → dinding, lantai, mebel khas */
export const MANDI2_ROOM_KEYS = ['ruangmain', 'rumahpohon', 'karaoke', 'rumahkaca', 'airpanas', 'ruangakuarium'];
/** tinggi alas shower (= lift animasi shower) */
export const MANDI2_SHOWER = { tray: TRAY };
