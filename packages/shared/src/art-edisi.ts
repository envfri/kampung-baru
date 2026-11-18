// Gambar Edisi Spesial (Toko Mutiara, paket konten 19): 8 mebel dengan efek bergerak — kelopak tabebuya berguguran,
// ubur-ubur bercahaya, kincir bambu berputar, air mancur kristal, gramofon bernada, lampu lava pelangi, teleskop &
// bintang berkelip, wayang golek menari. Orisinal: garis INK, isian datar, seperti set premium.
//
// Efek = elemen SVG berkelas ed-* yang dianimasikan CSS game (app.css): hanya transform & opacity (lampu lava juga
// fill), tanpa JS per frame, sedikit elemen per mebel. Gambar dasarnya sudah satu "frame" yang pas, jadi saat
// prefers-reduced-motion dan di foto Jepret (SVG tanpa CSS) efeknya diam tapi tetap terlihat.
// Titik-titik lewat g.iso (at3), jadi tampak belakang (putar 2× / 3×) ikut benar. Isi efek digambar dalam px lokal di
// dalam <g transform="translate(..) scale(g.s)">, sehingga jarak animasi CSS (px) ikut besar-kecilnya petak.
import { INK, shade, registerArt, ISO_KIT, type FurnDef, type IsoCtx } from './art';

const { C3, at3, rk, inkLine, thinLine, prism, lathe, flatE, ovalTub, hull, pathOf, shadowE } = ISO_KIT;
type Pt = number[];
const f1 = (v: number) => Math.round(v * 10) / 10;
const f2 = (v: number) => Math.round(v * 100) / 100;
const GOLD = '#E9B949';

/** <g> berpusat di titik petak (u, v) setinggi z; isinya dalam px lokal (dikali g.s) */
const at = (g: IsoCtx, u: number, v: number, z: number, inner: string) => {
  const [X, Y] = at3(g, u, v, z);
  return `<g transform="translate(${f1(X)} ${f1(Y)}) scale(${f2(g.s)})">${inner}</g>`;
};
/** <g> di titik layar (x, y) dengan skala g.s */
const atXY = (g: IsoCtx, p: Pt, inner: string) => `<g transform="translate(${f1(p[0])} ${f1(p[1])}) scale(${f2(g.s)})">${inner}</g>`;
/** geser (px lokal) */
const tr = (x: number, y: number, inner: string) => `<g transform="translate(${f1(x)} ${f1(y)})">${inner}</g>`;
/** elemen efek: kelas animasi (ed-*), variabel CSS, jeda negatif supaya tidak serempak */
const fx = (cls: string, delay: number, inner: string, vars = '', attrs = '') => `<g class="${cls}" style="${vars}animation-delay:-${f2(delay)}s"${attrs}>${inner}</g>`;
/**
 * Matriks bidang di titik petak (u, v, z): 'u' = bidang tegak menghadap ±v (sumbu x lokal sepanjang u), 'v' = bidang
 * tegak menghadap ±u (sumbu x lokal sepanjang v), 'z' = bidang datar (x lokal sepanjang u, y lokal sepanjang v).
 * 1 px lokal = 1/32 petak mendatar = 1 px (×g.s) tegak; dihitung lewat g.iso → ikut cermin tampak belakang.
 */
function plane(g: IsoCtx, u: number, v: number, z: number, ax: 'u' | 'v' | 'z') {
  const o = at3(g, u, v, z), e = 1 / 32;
  const a = ax === 'v' ? at3(g, u, v + e, z) : at3(g, u + e, v, z);
  const b = ax === 'z' ? at3(g, u, v + e, z) : [o[0], o[1] + g.s];
  return `matrix(${f2(a[0] - o[0])} ${f2(a[1] - o[1])} ${f2(b[0] - o[0])} ${f2(b[1] - o[1])} ${f1(o[0])} ${f1(o[1])})`;
}
/** titik layar → px lokal terhadap titik asal o (skala g.s) */
const local = (g: IsoCtx, pts: Pt[], o: Pt) => pts.map((p) => [(p[0] - o[0]) / g.s, (p[1] - o[1]) / g.s]);
const pathL = (pts: Pt[]) => 'M' + pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L');
const P2 = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`;

/* ---------- bentuk kecil (px lokal, berpusat di 0,0) ---------- */
const PETAL = (col: string) => `<path d="M0 -3.6C3 -3.2 3.4 .7 0 3.6C-3.4 .7 -3 -3.2 0 -3.6Z" fill="${col}" stroke="${INK}" stroke-width=".8"/>`;
/** bintang empat sudut */
const STAR4 = (r: number, col: string, sw = 0.9) =>
  `<path d="M0 ${f1(-r)}Q${f1(r * 0.18)} ${f1(-r * 0.18)} ${f1(r)} 0Q${f1(r * 0.18)} ${f1(r * 0.18)} 0 ${f1(r)}Q${f1(-r * 0.18)} ${f1(r * 0.18)} ${f1(-r)} 0Q${f1(-r * 0.18)} ${f1(-r * 0.18)} 0 ${f1(-r)}Z" fill="${col}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>`;
/** not musik (kepala + tangkai + bendera) */
const NOTE = (col: string, dbl = false) =>
  `<ellipse rx="3.6" ry="2.6" transform="rotate(-20)" fill="${col}" stroke="${INK}" stroke-width="1.1"/><path d="M3.1 -1V-12${dbl ? 'h7v11' : 'q5 2 4 8'}" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>` +
  (dbl ? `<ellipse cx="10" cy="-.5" rx="3.6" ry="2.6" transform="rotate(-20 10 -.5)" fill="${col}" stroke="${INK}" stroke-width="1.1"/>` : '');
/** ubur-ubur: payung bergerigi + tentakel bercahaya */
const JELLY = (col: string) =>
  `<path d="M-5 1.5q-2 5 0 9q2 4 0 8M0 1.5q2 5 0 10q-2 3 0 6M5 1.5q2 5 0 9q-2 4 0 7" fill="none" stroke="${col}" stroke-width="1.7" stroke-linecap="round" opacity=".9"/>` +
  `<path d="M-8.5 1.5C-9.5 -11.5 9.5 -11.5 8.5 1.5Q6.4 3.4 4.2 1.5Q2.1 3.4 0 1.5Q-2.1 3.4 -4.2 1.5Q-6.4 3.4 -8.5 1.5Z" fill="${col}" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>` +
  `<ellipse cx="-3.2" cy="-5.2" rx="2.4" ry="1.5" fill="#FFFFFF" opacity=".75"/>`;

const EDISI: Record<string, FurnDef> = {
  /* ---------------- Pohon Tabebuya Mekar: kelopak merah muda berguguran ---------------- */
  tabebuya: {
    label: 'Pohon tabebuya mekar',
    colors: { main: '#F48FB8', accent: '#CDBDA8' },
    draw(g, x, y, w, d, c) {
      const s = g.s, cu = x + w / 2, cv = y + d / 2, [cx, cy] = g.iso(cu, cv);
      const pinks = [c.main, shade(c.main, 0.32), shade(c.main, -0.14)];
      let o = shadowE(cx, cy + 1 * s, 26 * s, 11 * s);
      // kelopak yang sudah gugur di lantai
      for (const [du, dv, k] of [[0.36, 0.1, 0], [-0.12, 0.38, 1], [0.24, 0.34, 2], [-0.34, -0.06, 0]]) {
        const [px, py] = at3(g, cu + du, cv + dv, 0.5);
        o += `<ellipse cx="${f1(px)}" cy="${f1(py)}" rx="${f1(2.8 * s)}" ry="${f1(1.4 * s)}" fill="${pinks[k]}" stroke="${INK}" stroke-width="${f1(0.6 * s)}"/>`;
      }
      // pot batu bundar & tanahnya
      o += lathe(g, cu, cv, [[0, 0.22], [3, 0.25], [15, 0.29], [19, 0.3]], c.accent);
      o += flatE(g, cu, cv, 19, 0.3, shade(c.accent, 0.2), 1.5) + flatE(g, cu, cv, 19.4, 0.24, '#6B4A2B', 0);
      for (const [du, dv, k] of [[0.08, 0.1, 1], [-0.1, -0.04, 2]]) {
        const [px, py] = at3(g, cu + du, cv + dv, 19.6);
        o += `<ellipse cx="${f1(px)}" cy="${f1(py)}" rx="${f1(2.6 * s)}" ry="${f1(1.3 * s)}" fill="${pinks[k]}"/>`;
      }
      // batang & cabang (titik layar dari pusat: pohon hampir simetris, tampak belakang tetap pas)
      const B = (dx: number, dz: number): Pt => [cx + dx * s, cy - dz * s], bark = '#8C7B6B';
      o += inkLine([B(0, 19), B(-1.5, 44), B(1, 64)], bark, 5, s);
      o += inkLine([B(1, 60), B(-13, 74), B(-24, 86)], bark, 3.2, s) + inkLine([B(1, 62), B(13, 76), B(25, 88)], bark, 3.2, s) + inkLine([B(0, 63), B(-2, 84), B(2, 98)], bark, 3, s);
      // tajuk bunga: satu siluet bergaris tinta (gumpalan tinta sedikit lebih besar di bawah gumpalan isi),
      // lalu bayangan & sorot tanpa garis, bunga kecil di atasnya. Kelas canopy: tembus pandang bila pet di belakangnya.
      const blobs: [number, number, number][] = [[-31, 95, 12], [-19, 106, 16], [0, 113, 18], [19, 106, 16], [31, 96, 12], [-13, 91, 14], [13, 92, 14], [0, 97, 15], [-25, 87, 9], [25, 88, 9], [-8, 124, 10], [9, 123, 10]];
      const C = (dx: number, dz: number, r: number, fill: string) => `<circle cx="${f1(cx + dx * s)}" cy="${f1(cy - dz * s)}" r="${f1(r * s)}" fill="${fill}"/>`;
      o += `<g class="canopy">` + blobs.map(([dx, dz, r]) => C(dx, dz, r + 1.7, INK)).join('') + blobs.map(([dx, dz, r]) => C(dx, dz, r, c.main)).join('');
      o += [[10, 89, 10], [24, 92, 7], [-12, 87, 8], [-27, 92, 6]].map(([dx, dz, r]) => C(dx, dz, r, pinks[2])).join('');
      o += [[-12, 113, 9], [-24, 101, 6], [4, 121, 7], [14, 108, 6]].map(([dx, dz, r]) => C(dx, dz, r, pinks[1])).join('');
      // bunga kecil: lima titik krem berpusat kuning
      for (const [dx, dz] of [[-22, 102], [8, 118], [24, 99], [-6, 93], [-30, 92], [17, 109], [-11, 116], [3, 104], [-16, 88], [29, 90]]) {
        const fx0 = cx + dx * s, fy0 = cy - dz * s;
        let fl = '';
        for (let k = 0; k < 5; k++) { const a = k * 1.2566 + dx; fl += `M${f1(fx0 + Math.cos(a) * 1.7 * s - 1.2 * s)} ${f1(fy0 + Math.sin(a) * 1.7 * s)}a${f1(1.2 * s)} ${f1(1.2 * s)} 0 1 0 ${f1(2.4 * s)} 0a${f1(1.2 * s)} ${f1(1.2 * s)} 0 1 0 ${f1(-2.4 * s)} 0Z`; }
        o += `<path d="${fl}" fill="#FFF0F6"/><circle cx="${f1(fx0)}" cy="${f1(fy0)}" r="${f1(0.9 * s)}" fill="#F7C548"/>`;
      }
      o += `</g>`;
      // kelopak berguguran (ed-fall turun, ed-flutter bergoyang): posisi dasar sudah di tengah jalan jatuh
      const fall: [number, number, number][] = [[-22, 72, 1], [16, 60, 0], [-8, 46, 2], [26, 40, 1], [-30, 30, 0], [6, 80, 2]];
      let pe = '';
      fall.forEach(([dx, z, k], i) => {
        const end = Math.abs(dx) < 15 ? 22 : 2, top = 86;
        pe += tr(dx, -z, fx('ed-fall', i * 1.05, fx('ed-flutter', i * 0.41, PETAL(pinks[k])), `--up:${top - z}px;--down:${z - end}px;`));
      });
      return o + at(g, cu, cv, 0, pe);
    },
  },

  /* ---------------- Akuarium Ubur-ubur Bercahaya: ubur-ubur naik-turun, cahayanya berdenyut ---------------- */
  akuariumubur: {
    label: 'Akuarium ubur-ubur',
    colors: { main: '#2C3B78', accent: '#5B3F6B' },
    draw(g, x, y, w, d, c) {
      const s = g.s;
      let o = g.box(x + 0.04, y + 0.18, 0, w - 0.08, d - 0.36, 24, C3(c.accent));
      o += g.quadY(y + d - 0.18, x + 0.14, x + w - 0.14, 6, 18, shade(c.accent, -0.18), 1);
      o += g.box(x + 0.02, y + 0.16, 24, w - 0.04, d - 0.32, 3, C3(GOLD));
      o += g.box(x + 0.08, y + 0.22, 27, w - 0.16, d - 0.44, 48, C3(c.main));
      o += g.box(x + 0.05, y + 0.19, 75, w - 0.1, d - 0.38, 4, C3('#C9CED6'));
      // gagang laci (sisi depan saja)
      if (!g.back) for (const u of [x + w * 0.32, x + w * 0.68]) { const p = at3(g, u, y + d - 0.18, 12); o += `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${f1(1.8 * s)}" fill="${GOLD}" stroke="${INK}" stroke-width="${f1(0.8 * s)}"/>`; }
      // sisi kaca yang menghadap kamera (tampak belakang: sisi seberangnya, yang setelah dicermin jadi di depan)
      const Yf = g.back ? y + 0.22 : y + d - 0.22;
      const sand: Pt[] = [at3(g, x + 0.1, Yf, 27.5), at3(g, x + w - 0.1, Yf, 27.5)];
      for (let k = 8; k >= 0; k--) sand.push(at3(g, x + 0.1 + ((w - 0.2) * k) / 8, Yf, 32 + 2.2 * Math.sin(k * 1.3)));
      o += g.poly(sand, '#E8D3A6', 1.1);
      // karang & rumput laut
      o += thinLine([at3(g, x + 0.36, Yf, 31), at3(g, x + 0.36, Yf, 41)], '#FF8FA3', 2.6 * s) + thinLine([at3(g, x + 0.36, Yf, 36), at3(g, x + 0.3, Yf, 42)], '#FF8FA3', 2.2 * s) + thinLine([at3(g, x + 0.36, Yf, 35), at3(g, x + 0.42, Yf, 43)], '#FF8FA3', 2.2 * s);
      o += `<path d="${pathOf([at3(g, x + w - 0.42, Yf, 31), at3(g, x + w - 0.46, Yf, 38), at3(g, x + w - 0.4, Yf, 45), at3(g, x + w - 0.45, Yf, 52)])}" fill="none" stroke="#3FA06A" stroke-width="${f1(2.2 * s)}" stroke-linecap="round" stroke-linejoin="round"/>`;
      // ubur-ubur di tengah tangki (kaca: terlihat dari depan & belakang)
      const cols = ['#FF9ECF', '#C9A2FF', '#8FE8F2'];
      [[0.5, 52], [1.0, 41], [1.48, 57]].forEach(([u, z], i) => {
        o += at(g, x + u * (w / 2), y + d / 2, z, fx('ed-glow', i * 0.7, `<circle r="12" fill="${cols[i]}"/>`, '', ' opacity=".4"') + fx('ed-bob', i * 0.95, JELLY(cols[i])));
      });
      // gelembung naik
      [[0.76, 34], [1.3, 36]].forEach(([u, z], i) => {
        o += at(g, x + u * (w / 2), y + d / 2, z, fx('ed-rise', i * 1.6, `<circle r="2" fill="none" stroke="#FFFFFF" stroke-width="1"/><circle cx="3" cy="5" r="1.3" fill="none" stroke="#FFFFFF" stroke-width=".9"/>`, '--rise:32px;'));
      });
      // kilau kaca & lampu tutup
      let gl = '';
      for (const du of [0.18, 0.28]) { const a = at3(g, x + du, Yf, 70), b = at3(g, x + du + 0.14, Yf, 46); gl += `M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}`; }
      o += `<path d="${gl}" stroke="#FFFFFF" stroke-width="${f1(1.8 * s)}" stroke-linecap="round" opacity=".45"/>`;
      return o;
    },
  },

  /* ---------------- Kincir Angin Bambu: baling-baling berputar ---------------- */
  kincir: {
    label: 'Kincir angin bambu',
    colors: { main: '#E0583F', accent: '#C9A35A' },
    draw(g, x, y, w, d, c) {
      const s = g.s, cu = x + w / 2, cv = y + d / 2, H = 96;
      let o = shadowE(...(g.iso(cu, cv) as [number, number]), 18 * s, 7 * s);
      o += g.box(x + 0.3, y + 0.3, 0, 0.4, 0.4, 6, C3('#9C9A86'));
      const pole = () => {
        let p = inkLine([at3(g, cu, cv, 5), at3(g, cu, cv, H)], c.accent, 3.6, s);
        for (const z of [28, 52, 76]) { const q = at3(g, cu, cv, z); p += thinLine([[q[0] - 2.6 * s, q[1]], [q[0] + 2.6 * s, q[1]]], shade(c.accent, -0.4), 1.2 * s); }
        return p;
      };
      const hub = () => prism(g, [[cu - 0.2, cv - 0.05], [cu + 0.16, cv - 0.05], [cu + 0.16, cv + 0.05], [cu - 0.2, cv + 0.05]], H, 8, C3(shade(c.accent, -0.22)), 1.3);
      // ekor penunjuk angin: batang bambu ke belakang + sirip papan bergaris (bidang tegak sepanjang u)
      const tail = () => {
        const p = (u: number, z: number) => at3(g, cu + u, cv, H + z);
        return inkLine([p(-0.18, 4), p(-0.4, 4)], c.accent, 2.2, s) +
          g.poly([p(-0.36, -6), p(-0.62, -10), p(-0.62, 20), p(-0.36, 14)], '#FFFDF7', 1.4) +
          g.poly([p(-0.45, -7.7), p(-0.53, -8.8), p(-0.53, 17.4), p(-0.45, 15.7)], c.main, 0) + g.poly([p(-0.36, -6), p(-0.62, -10), p(-0.62, 20), p(-0.36, 14)], 'none', 1.4);
      };
      // baling-baling bambu berujung merah di ujung depan poros (bidang tegak menghadap +u), berputar (ed-spin)
      const rotor = () => {
        const B = (rot: number) => `<g transform="rotate(${rot})"><path d="M0 -2.6L27 -6.5Q33 0 27 6.5L0 2.6Z" fill="#E7C98A" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/><path d="M20 -5.5L27 -6.5Q33 0 27 6.5L20 5.5Z" fill="${c.main}" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/><path d="M4 0H18" stroke="#C9A35A" stroke-width="1"/></g>`;
        const blades = B(45) + B(135) + B(225) + B(315) + `<circle r="4.2" fill="${c.main}" stroke="${INK}" stroke-width="1.2"/><circle r="1.6" fill="${GOLD}"/>`;
        return `<g transform="${plane(g, cu + 0.19, cv, H + 4, 'v')}">${fx('ed-spin', 0, blades)}</g>`;
      };
      // pita kecil di tiang (berkibar)
      const ribbon = () => at(g, cu, cv, H - 8, fx('ed-flutter', 0.3, `<path d="M0 0q7 2 12 -1q-2 4 1 8q-7 0 -13 -3Z" fill="${c.main}" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>`));
      // urutan: depan → ekor, tiang, poros, baling-baling; dari belakang baling-baling di sisi jauh
      o += g.back ? rotor() + pole() + hub() + ribbon() + tail() : tail() + pole() + ribbon() + hub() + rotor();
      return o;
    },
  },

  /* ---------------- Air Mancur Kristal: air memancar, riak & kilau ---------------- */
  airmancurkristal: {
    label: 'Air mancur kristal',
    colors: { main: '#E9E4F2', accent: '#9FDDF5' },
    draw(g, x, y, w, d, c) {
      const s = g.s, cu = x + w / 2, cv = y + d / 2, R = Math.min(w, d) / 2 - 0.12, k = rk(g);
      const t = ovalTub(g, cu, cv, R, R, 0, 16, C3(c.main));
      const [cx, cy] = g.iso(cu, cv);
      let o = shadowE(cx, cy + 2 * s, R * k + 6 * s, (R * k) / 2 + 4 * s) + t.side;
      for (const z of [5, 11]) { const r = t.ring(z); o += thinLine(t.arc.map((i) => r[i]), shade(c.main, -0.22), 1.1 * s); }
      o += t.top + flatE(g, cu, cv, 14.5, R - 0.11, c.accent, 1.2);
      // pancaran: 4 lengkung air dari kristal ke kolam (garis putus-putus mengalir: ed-flow)
      const O = at3(g, cu, cv, 0), waterY = at3(g, cu, cv, 14)[1];
      const arcs = [[1, 0], [0, 1], [-1, 0], [0, -1]].map(([du, dv]) => {
        const pts: Pt[] = [];
        // dari dekat puncak kristal naik sedikit lalu jatuh ke kolam dekat bibirnya (parabola)
        for (let i = 0; i <= 14; i++) { const q = i / 14, r = 0.05 + q * (R - 0.26); pts.push(at3(g, cu + du * r, cv + dv * r, 68 + 34 * q - 88 * q * q)); }
        const end = pts[pts.length - 1], dd = pathL(local(g, pts, O));
        const h = `<path d="${dd}" fill="none" stroke="#6FB8DC" stroke-width="5" stroke-linecap="round" opacity=".55"/><path d="${dd}" fill="none" stroke="#DDF5FF" stroke-width="3.2" stroke-linecap="round"/>` +
          fx('ed-flow', 0, `<path d="${dd}" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="5 5"/>`);
        return { h, end, front: end[1] > waterY + 0.5 };
      });
      const arcSet = (front: boolean) => atXY(g, O, arcs.filter((a) => a.front === front).map((a) => a.h).join(''));
      o += arcSet(false);
      // tiang & mangkuk atas
      o += lathe(g, cu, cv, [[14, 0.2], [18, 0.13], [30, 0.075], [37, 0.09], [42, 0.16]], shade(c.main, -0.06));
      o += flatE(g, cu, cv, 42, 0.27, c.main, 1.4) + flatE(g, cu, cv, 42.6, 0.2, c.accent, 0);
      // kristal (gambar tegak menghadap kamera) + cahaya berdenyut
      const crystal =
        fx('ed-glow', 0.4, `<circle cy="-16" r="17" fill="#CFF4FF"/>`, '', ' opacity=".5"') +
        `<path d="M-9 -2L-13 -12L-10 -19L-6 -10Z" fill="#E5D4FF" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/><path d="M9 -2L14 -10L11 -17L6 -9Z" fill="#C9AEF5" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>` +
        `<path d="M0 -34L7.5 -18L6 -2L0 1L-6 -2L-7.5 -18Z" fill="#A8E2F7" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>` +
        `<path d="M0 -34L-7.5 -18L-6 -2L0 1Z" fill="#E6FBFF"/><path d="M0 -34L-7.5 -18L-6 -2L0 1L6 -2L7.5 -18Z" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>` +
        `<path d="M0 -34V1M-7.5 -18L0 -14L7.5 -18" fill="none" stroke="#6FB8DC" stroke-width=".9"/><path d="M-3.5 -24L-2 -10" stroke="#FFFFFF" stroke-width="1.4" stroke-linecap="round"/>`;
      o += at(g, cu, cv, 43, crystal);
      o += arcSet(true);
      // riak di tempat air jatuh (sisi depan)
      arcs.filter((a) => a.front).forEach((a, i) => (o += atXY(g, a.end, fx('ed-ripple', i * 0.8, `<ellipse rx="7" ry="3.5" fill="none" stroke="#FFFFFF" stroke-width="1.4"/>`))));
      // kilau di sekitar kristal
      const sp = [[-15, -30, 4.2, '#FFFFFF'], [14, -22, 3.4, '#FFF6C8'], [3, -44, 3.8, '#E5D4FF']] as const;
      o += at(g, cu, cv, 43, sp.map(([dx, dy, r, col], i) => tr(dx, dy, fx('ed-twinkle', i * 0.6, STAR4(r, col, 0.8)))).join(''));
      return o;
    },
  },

  /* ---------------- Gramofon Antik: piringan berputar, not musik melayang ---------------- */
  gramofon: {
    label: 'Gramofon antik',
    colors: { main: '#E9B949', accent: '#7A4A2A' },
    draw(g, x, y, w, d, c) {
      const s = g.s, brass = c.main, wood = c.accent, TOP = 33;
      let o = shadowE(...(g.iso(x + 0.5, y + 0.5) as [number, number]), 22 * s, 9 * s);
      for (const [a, b] of [[0.22, 0.22], [0.7, 0.22], [0.22, 0.7], [0.7, 0.7]]) o += g.box(x + a, y + b, 0, 0.08, 0.08, 6, C3(shade(wood, -0.3)));
      o += g.box(x + 0.2, y + 0.2, 6, 0.6, 0.6, 24, C3(wood));
      // kisi pengeras suara di sisi depan
      o += g.quadY(y + 0.8, x + 0.28, x + 0.72, 10, 26, shade(wood, -0.32), 1);
      if (!g.back) for (const u of [0.36, 0.44, 0.52, 0.6, 0.68]) o += thinLine([at3(g, x + u, y + 0.8, 12), at3(g, x + u, y + 0.8, 24)], shade(brass, -0.1), 1 * s);
      o += g.box(x + 0.17, y + 0.17, 30, 0.66, 0.66, 3, C3(shade(wood, -0.15)));
      // piringan hitam berputar (bidang datar di atas lemari)
      const rec = `<circle r="9.6" fill="#B5703F" stroke="${INK}" stroke-width="1.3"/>` +
        fx('ed-spin', 0, `<circle r="8.3" fill="#2B2F4A"/><circle r="6.3" fill="none" stroke="#545A7A" stroke-width=".8"/><circle r="4.5" fill="none" stroke="#545A7A" stroke-width=".8"/><circle r="2.6" fill="#C0392B"/><path d="M-6.9 -3.1A7.6 7.6 0 0 1 -1.6 -7.4" fill="none" stroke="#FFFFFF" stroke-width="1.4" stroke-linecap="round" opacity=".75"/><circle cx="1.3" cy="-.5" r=".8" fill="#FFFDF7"/>`, 'animation-duration:3s;') +
        `<circle r=".9" fill="#C9CED6"/>`;
      o += `<g transform="${plane(g, x + 0.46, y + 0.54, TOP, 'z')}">${rec}</g>`;
      // lengan jarum
      const pv = at3(g, x + 0.74, y + 0.3, TOP + 1), nd = at3(g, x + 0.58, y + 0.46, TOP + 2.5);
      o += inkLine([pv, [pv[0], pv[1] - 4 * s], nd], '#C9CED6', 1.6, s) + `<circle cx="${f1(pv[0])}" cy="${f1(pv[1])}" r="${f1(2.4 * s)}" fill="${brass}" stroke="${INK}" stroke-width="${f1(0.9 * s)}"/>`;
      // corong kuningan: leher dari sudut belakang, bunga corong menghadap +v (tampak belakang: punggung corong)
      const n0 = at3(g, x + 0.3, y + 0.3, TOP + 2), n1 = at3(g, x + 0.3, y + 0.33, TOP + 26);
      const bc = { u: x + 0.34, v: y + 0.62, z: TOP + 60 }, R = 19;
      const bell = Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * 2 * Math.PI; return at3(g, bc.u + (R * Math.cos(a)) / 32, bc.v, bc.z - R * Math.sin(a)); });
      o += inkLine([n0, n1], brass, 4, s);
      o += g.poly(hull([...bell, [n1[0] - 2.6 * s, n1[1]], [n1[0] + 2.6 * s, n1[1]]]), shade(brass, -0.08), 1.5);
      if (g.back) {
        let ribs = '';
        for (let i = 0; i < 24; i += 4) ribs += `M${f1(n1[0])} ${f1(n1[1])}L${f1(bell[i][0])} ${f1(bell[i][1])}`;
        o += `<path d="${ribs}" stroke="${shade(brass, -0.32)}" stroke-width="${f1(1 * s)}" fill="none"/>` + g.poly(bell, 'none', 1.5);
      } else {
        let ribs = '';
        for (let i = 0; i < 8; i++) { const a = (i / 8) * 2 * Math.PI; ribs += `M0 0L${f1(R * Math.cos(a))} ${f1(R * Math.sin(a))}`; }
        o += `<g transform="${plane(g, bc.u, bc.v, bc.z, 'u')}"><circle r="${R}" fill="${brass}" stroke="${INK}" stroke-width="1.5"/><circle r="${R - 3.5}" fill="#B07A2A"/><path d="${ribs}" stroke="#8A5A22" stroke-width="1"/><circle r="8" fill="#7A4A1E"/><circle r="3.6" fill="#3B2A1A"/></g>`;
      }
      // not musik melayang dari corong (ed-rise)
      const cols = [GOLD, '#F7A8C4', '#8FD3E8'];
      const notes = [[-16, -14, 0], [14, -22, 1], [-2, -32, 2]];
      // not tidak boleh terbalik di arah yang dicerminkan (putar 1× / 3×)
      const nt = (h: string) => (g.flip ? `<g transform="scale(-1 1)">${h}</g>` : h);
      o += at(g, bc.u, bc.v, bc.z, notes.map(([dx, dy, k], i) => tr(dx, dy, fx('ed-rise', i * 1.15, nt(NOTE(cols[k], i === 1)), '--rise:26px;'))).join(''));
      return o;
    },
  },

  /* ---------------- Lampu Lava Pelangi: gumpalan naik-turun & berganti warna ---------------- */
  lampulava: {
    label: 'Lampu lava pelangi',
    colors: { main: '#463A8A', accent: '#C9CED6' },
    draw(g, x, y, w, d, c) {
      const s = g.s, cu = x + w / 2, cv = y + d / 2, Z = 14;
      let o = shadowE(...(g.iso(cu, cv) as [number, number]), 18 * s, 7 * s);
      o += g.box(x + 0.27, y + 0.27, 0, 0.46, 0.46, Z, C3('#FFFDF7'));
      // cahaya di sekitar kaca (berganti warna)
      o += at(g, cu, cv, Z + 42, fx('ed-halo', 0, `<circle r="25"/>`, '', ' fill="#FF9ECF" opacity=".3"'));
      o += lathe(g, cu, cv, [[Z, 0.21], [Z + 3, 0.22], [Z + 16, 0.13]], c.accent);
      o += lathe(g, cu, cv, [[Z + 16, 0.14], [Z + 30, 0.22], [Z + 50, 0.2], [Z + 66, 0.11]], c.main, 1.4);
      // gumpalan lava: naik-turun pelan (ed-lava) sambil berganti warna (ed-hue)
      const blobs: [number, number, number, number, string, number][] = [[-1.5, 28, 5.8, 18, '#FF7AB6', 6.4], [2.2, 48, 5, -15, '#FFB347', 7.6], [-0.5, 38, 3.8, 10, '#7FE0C0', 5.2]];
      o += at(g, cu, cv, Z, blobs.map(([dx, dz, r, rise, col, dur], i) =>
        tr(dx, -dz, `<g class="ed-blob" fill="${col}" style="--rise:${rise}px;animation-duration:${dur}s,${f1(dur * 1.6)}s;animation-delay:-${f1(i * 2.1)}s,-${f1(i * 3.3)}s"><path d="M0 ${f1(-r * 1.2)}C${f1(r)} ${f1(-r * 1.1)} ${f1(r * 1.05)} ${f1(r * 0.9)} 0 ${f1(r)}C${f1(-r * 1.1)} ${f1(r * 0.9)} ${f1(-r)} ${f1(-r * 1.1)} 0 ${f1(-r * 1.2)}Z"/></g>`)).join(''));
      // kilau kaca & tutup logam
      const h0 = at3(g, cu, cv, Z + 24), h1 = at3(g, cu, cv, Z + 52);
      o += `<path d="M${f1(h0[0] - 5.5 * s)} ${f1(h0[1])}Q${f1(h0[0] - 7.5 * s)} ${f1((h0[1] + h1[1]) / 2)} ${f1(h1[0] - 5 * s)} ${f1(h1[1])}" fill="none" stroke="#FFFFFF" stroke-width="${f1(1.6 * s)}" stroke-linecap="round" opacity=".55"/>`;
      o += lathe(g, cu, cv, [[Z + 65, 0.11], [Z + 68, 0.12], [Z + 78, 0.055]], c.accent) + flatE(g, cu, cv, Z + 78, 0.055, shade(c.accent, 0.2), 1.1);
      return o;
    },
  },

  /* ---------------- Teleskop Bintang: bintang berkelip & bintang jatuh ---------------- */
  teleskop: {
    label: 'Teleskop bintang',
    colors: { main: '#2B3A6B', accent: '#E9B949' },
    draw(g, x, y, w, d, c) {
      const s = g.s, cu = x + w / 2, cv = y + d / 2, wood = '#8A5A36', AZ = 56;
      let o = shadowE(...(g.iso(cu, cv) as [number, number]), 22 * s, 9 * s);
      const apex = at3(g, cu, cv, AZ);
      const legs = [[cu + 0.34, cv + 0.06], [cu - 0.14, cv + 0.34], [cu - 0.12, cv - 0.34]].map(([u, v]) => { const f = at3(g, u, v, 0); return { k: f[1], h: inkLine([f, apex], wood, 3, s) }; }).sort((a, b) => a.k - b.k);
      o += legs.map((l) => l.h).join('');
      o += `<circle cx="${f1(apex[0])}" cy="${f1(apex[1])}" r="${f1(4 * s)}" fill="${c.accent}" stroke="${INK}" stroke-width="${f1(1.2 * s)}"/>`;
      // tabung: ujung lensa mata rendah (+v), lensa objektif tinggi (−v); tampak belakang: ikut berbalik arah
      const E = at3(g, cu - 0.02, cv + 0.22, AZ + 3), F = at3(g, cu + 0.06, cv - 0.5, AZ + 32);
      const L = Math.hypot(F[0] - E[0], F[1] - E[1]) || 1, ux = (F[0] - E[0]) / L, uy = (F[1] - E[1]) / L, nx = -uy, ny = ux;
      const side = (p: Pt, r: number, k: number): Pt => [p[0] + nx * r * k * s, p[1] + ny * r * k * s];
      const along = (t: number): Pt => [E[0] + (F[0] - E[0]) * t, E[1] + (F[1] - E[1]) * t];
      // lensa mata (kuningan) di ujung bawah
      const E2: Pt = [E[0] - ux * 9 * s, E[1] - uy * 9 * s];
      o += g.poly([side(E2, 2.6, 1), side(E, 2.6, 1), side(E, 2.6, -1), side(E2, 2.6, -1)], c.accent, 1.1);
      o += g.poly([side(E, 4.6, 1), side(F, 7, 1), side(F, 7, -1), side(E, 4.6, -1)], c.main, 1.5);
      for (const t of [0.12, 0.56, 0.93]) { const p = along(t), r = 4.6 + 2.4 * t + 0.4; o += inkLine([side(p, r, 1), side(p, r, -1)], c.accent, 1.8, s); }
      o += `<path d="M${P2(side(along(0.2), 2.4, 1))}L${P2(side(along(0.85), 3.6, 1))}" stroke="#FFFFFF" stroke-width="${f1(1.3 * s)}" stroke-linecap="round" opacity=".5"/>`;
      const ang = (Math.atan2(ny, nx) * 180) / Math.PI;
      o += `<ellipse cx="${f1(F[0])}" cy="${f1(F[1])}" rx="${f1(7.4 * s)}" ry="${f1(3.2 * s)}" transform="rotate(${f1(ang)} ${f1(F[0])} ${f1(F[1])})" fill="${g.back ? '#9FD8F5' : shade(c.main, -0.35)}" stroke="${c.accent}" stroke-width="${f1(1.8 * s)}"/>`;
      // bintang berkelip di arah bidikan + satu bintang jatuh
      const stars: [number, number, number, number, string][] = [[0.04, -0.58, 64, 6, '#FFF6C8'], [0.3, -0.5, 52, 4.4, '#FFFFFF'], [-0.2, -0.44, 74, 4.8, c.accent], [0.22, -0.66, 78, 3.6, '#FFFFFF']];
      stars.forEach(([du, dv, z, r, col], i) => (o += at(g, cu + du, cv + dv, AZ + z, fx('ed-twinkle', i * 0.55, STAR4(r, col)))));
      o += at(g, cu + 0.4, cv - 0.62, AZ + 70, fx('ed-shoot', 1.2, `<path d="M0 0L14 -7" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" opacity=".8"/>${STAR4(3.2, '#FFF6C8', 0.7)}`));
      return o;
    },
  },

  /* ---------------- Wayang Golek Menari: boneka bergoyang, tangan menari ---------------- */
  wayanggolek: {
    label: 'Wayang golek menari',
    colors: { main: '#8E2A1E', accent: '#2F6E5E' },
    draw(g, x, y, w, d, c) {
      const s = g.s, cu = x + w / 2, cv = y + d / 2;
      let o = shadowE(...(g.iso(cu, cv) as [number, number]), 20 * s, 8 * s);
      o += g.box(x + 0.24, y + 0.3, 0, 0.52, 0.4, 10, C3('#6B4A2B')) + g.box(x + 0.22, y + 0.28, 10, 0.56, 0.44, 3, C3(GOLD));
      const base = at3(g, cu, cv, 13);
      o += thinLine([base, [base[0], base[1] - 16 * s]], '#5A381F', 2.6 * s);
      o += atXY(g, [base[0], base[1] - 14 * s], fx('ed-sway', 0, `<g transform="scale(1.22)">${golek(c, g.back)}</g>`));
      return o;
    },
  },
};

/** boneka wayang golek (px lokal, titik goyang di ujung bawah kain = 0,0); back = tampak belakang (tanpa wajah) */
function golek(c: Record<string, string>, back: boolean) {
  const skin = '#F6D7B0', hair = '#2B2420', gold = GOLD;
  // tangan: dari bahu ke bawah, membawa tuding (tongkat); bergerak menari (ed-wave) di sendi bahu
  const arm = (dir: number, delay: number) => tr(10.5 * dir, -38, fx('ed-wave', delay,
    `<path d="M0 0Q${f1(5 * dir)} 7 ${f1(4 * dir)} 13Q${f1(3 * dir)} 18 ${f1(-1 * dir)} 21" fill="none" stroke="${INK}" stroke-width="4.6" stroke-linecap="round"/><path d="M0 0Q${f1(5 * dir)} 7 ${f1(4 * dir)} 13Q${f1(3 * dir)} 18 ${f1(-1 * dir)} 21" fill="none" stroke="${skin}" stroke-width="2.6" stroke-linecap="round"/>` +
    `<path d="M${f1(4.6 * dir)} 11.5h${f1(-2.6 * dir)}" stroke="${gold}" stroke-width="2.2"/><path d="M${f1(-1 * dir)} 21L${f1(2 * dir)} 44" stroke="#5A381F" stroke-width="1.2" stroke-linecap="round"/>`));
  // selendang (sampur) di pinggang, ujungnya berkibar
  const sampur = (dir: number, delay: number) => tr(7 * dir, -20, fx('ed-wave', delay, `<path d="M0 0Q${f1(5 * dir)} 8 ${f1(3 * dir)} 18L${f1(7 * dir)} 17Q${f1(9 * dir)} 7 ${f1(2 * dir)} -1Z" fill="#F2B632" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>`));
  const kain = `<path d="M-8 -21L8 -21L11.5 0Q0 2.5 -11.5 0Z" fill="${c.main}" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<path d="M-6 -16L-2 -20M-8 -10L0 -18M-9 -3L4 -17M-5 -1L7 -14M1 0L9 -9" stroke="${gold}" stroke-width="1.1" stroke-linecap="round" opacity=".9"/>` +
    `<path d="M-9 -21.5H9V-24.5H-9Z" fill="${gold}" stroke="${INK}" stroke-width="1"/>`;
  const torso = `<path d="M-8 -24L-11 -37Q0 -41 11 -37L8 -24Z" fill="${c.accent}" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>`;
  const neck = `<rect x="-2.2" y="-44" width="4.4" height="6" fill="${skin}" stroke="${INK}" stroke-width="1"/>`;
  const collar = `<path d="M-9 -37.5Q0 -32 9 -37.5Q0 -35 -9 -37.5Z" fill="${gold}" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>`;
  let head: string;
  if (back) {
    head = `<ellipse cx="0" cy="-51" rx="7" ry="8.4" fill="${hair}" stroke="${INK}" stroke-width="1.2"/><circle cx="0" cy="-45" r="4" fill="${hair}" stroke="${INK}" stroke-width="1"/>` +
      `<path d="M-7.5 -56L-6 -66L0 -72L6 -66L7.5 -56Q0 -59 -7.5 -56Z" fill="${gold}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/><path d="M-4 -62Q0 -66 4 -62" fill="none" stroke="#C0392B" stroke-width="1.4"/>`;
  } else {
    head = `<path d="M-6.5 -49Q-8 -56 -4 -58L4 -58Q8 -56 6.5 -49Z" fill="${hair}"/>` +
      `<ellipse cx="0" cy="-50" rx="6.4" ry="8" fill="${skin}" stroke="${INK}" stroke-width="1.2"/>` +
      `<path d="M-4.4 -52q1.6 -1.2 3 0M1.4 -52q1.6 -1.2 3 0" fill="none" stroke="${INK}" stroke-width="1" stroke-linecap="round"/><path d="M-4.2 -50.6h2.6M1.6 -50.6h2.6" stroke="${INK}" stroke-width="1.1" stroke-linecap="round"/>` +
      `<path d="M0 -51v4.6q1 .6 1.6 0" fill="none" stroke="#C99A6E" stroke-width=".9"/><path d="M-1.6 -45q1.6 1 3.2 0" fill="none" stroke="#C0392B" stroke-width="1.2" stroke-linecap="round"/>` +
      `<path d="M-7 -56L-6 -65L-2.5 -62L0 -71L2.5 -62L6 -65L7 -56Q0 -59 -7 -56Z" fill="${gold}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/><circle cx="0" cy="-60" r="1.8" fill="#C0392B" stroke="${INK}" stroke-width=".7"/>` +
      `<path d="M6.4 -58Q11 -60 10 -53Q9.5 -50 7 -50" fill="none" stroke="${gold}" stroke-width="2" stroke-linecap="round"/>`;
  }
  // tampak belakang: tangan di balik badan
  return back
    ? arm(-1, 0.4) + arm(1, 0) + sampur(-1, 0.2) + sampur(1, 0.6) + kain + torso + neck + head
    : sampur(-1, 0.2) + sampur(1, 0.6) + kain + torso + neck + collar + head + arm(-1, 0.4) + arm(1, 0);
}

registerArt({}, EDISI);

/** bentuk mebel Edisi Spesial (kunci art) */
export const EDISI_ART_KEYS = Object.keys(EDISI);
