// Semua gambar game dibuat sebagai SVG dari kode (tanpa file gambar), sehingga ringan,
// tajam di semua layar, dan bisa diatur warnanya dari admin. Admin juga bisa memakai
// gambar upload (type: 'image') untuk item baru.
//
// Fungsi di sini mengembalikan string SVG. Dipakai oleh game dan pratinjau di admin.

import type { HousePlan, HouseDoor, WallSeg } from './house';
import { BODY_WEAR, EXTRA_WEAR, bodyIcon, mannequin, type BodyParts } from './art-butik';
import { KEBUN_ICONS, SEED_PICS, seedPacket } from './art-kebun';
import { KERJA_WEAR, jobBoardSVG, posRondaSVG } from './art-kerja';

export const INK = '#2B2F4A';

export type ArtSpec =
  | { type: 'builtin'; key: string; colors?: Record<string, string>; params?: Record<string, number> }
  | { type: 'image'; url: string; w?: number; h?: number };

export type ItemKind = 'food' | 'furniture' | 'wear' | 'wallpaper' | 'floor' | 'seed' | 'fish' | 'material' | 'room';

export interface ItemLike {
  id: string;
  kind: ItemKind;
  name: string;
  art: ArtSpec;
  data: any;
}

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const HEX = /^#[0-9a-fA-F]{6}$/;
const col = (v: unknown, d: string) => (typeof v === 'string' && HEX.test(v) ? v : d);
const safeUrl = (u: string) => (/^(\/media\/[\w.-]+|https:\/\/[^\s"'<>]+|data:image\/(png|webp|jpeg|svg\+xml);base64,[A-Za-z0-9+/=]+)$/.test(u) ? u : '');

export function shade(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return (
    '#' +
    [(n >> 16) & 255, (n >> 8) & 255, n & 255]
      .map((v) => Math.max(0, Math.min(255, Math.round(a < 0 ? v * (1 + a) : v + (255 - v) * a))).toString(16).padStart(2, '0'))
      .join('')
  );
}
const C3 = (hex: string) => [shade(hex, 0.14), shade(hex, -0.1), shade(hex, -0.27)];
const f1 = (v: number) => Math.round(v * 10) / 10;
export const P = (a: number[][]) => a.map((p) => f1(p[0]) + ',' + f1(p[1])).join(' ');

/* ------------------------------------------------------------------ */
/* Isometric drawing context                                           */
/* ------------------------------------------------------------------ */

export interface Iso {
  ox: number;
  oy: number;
  t: number;
  h: number;
}

function G(c: Iso) {
  const s = c.t / 32;
  const iso = (x: number, y: number) => [c.ox + (x - y) * c.t, c.oy + (x + y) * c.h];
  const poly = (a: number[][], fill: string, sw = 1.6) =>
    `<polygon points="${P(a)}" fill="${fill}" stroke="${INK}" stroke-width="${f1(sw * s)}" stroke-linejoin="round"/>`;
  const box = (x: number, y: number, z: number, w: number, d: number, h: number, c3: string[]) => {
    const Z = z * s, H = h * s;
    const p0 = iso(x, y), p1 = iso(x + w, y), p2 = iso(x + w, y + d), p3 = iso(x, y + d);
    const u = (p: number[], k: number) => [p[0], p[1] - Z - k];
    return (
      poly([u(p3, 0), u(p2, 0), u(p2, H), u(p3, H)], c3[1]) +
      poly([u(p1, 0), u(p2, 0), u(p2, H), u(p1, H)], c3[2]) +
      poly([u(p0, H), u(p1, H), u(p2, H), u(p3, H)], c3[0])
    );
  };
  // bidang X = x (menghadap kanan-bawah), u sepanjang y, v ke atas (px)
  const quadX = (x: number, y0: number, y1: number, v0: number, v1: number, fill: string, sw = 1.6) => {
    const Q = (yy: number, v: number) => { const p = iso(x, yy); return [p[0], p[1] - v * s]; };
    return poly([Q(y0, v0), Q(y1, v0), Q(y1, v1), Q(y0, v1)], fill, sw);
  };
  // bidang Y = y (menghadap kiri-bawah), u sepanjang x
  const quadY = (y: number, x0: number, x1: number, v0: number, v1: number, fill: string, sw = 1.6) => {
    const Q = (xx: number, v: number) => { const p = iso(xx, y); return [p[0], p[1] - v * s]; };
    return poly([Q(x0, v0), Q(x1, v0), Q(x1, v1), Q(x0, v1)], fill, sw);
  };
  /** back: digambar sebagai tampak belakang (perabot diputar 180°) — hiasan di sisi depan boleh dilewati;
   *  flip: digambar di dalam cermin (putar 1× / 3×) — tanda yang tidak boleh terbalik (not musik) bisa dicermin balik */
  return { s, iso, poly, box, quadX, quadY, back: false as boolean, flip: false as boolean };
}
type Ctx = ReturnType<typeof G>;

/* ------------------------------------------------------------------ */
/* Furniture                                                           */
/* ------------------------------------------------------------------ */

export type FurnFn = (g: Ctx, x: number, y: number, w: number, d: number, c: Record<string, string>, p: Record<string, number>) => string;
export type FurnCtx = Ctx;

const FURN: Record<string, { label: string; colors: Record<string, string>; draw: FurnFn }> = {
  karpet: {
    label: 'Karpet motif',
    colors: { main: '#2F5D7C', accent: '#F3E3B5' },
    draw(g, x, y, w, d, c) {
      const s = g.s;
      const q = (a: number, b: number) => g.iso(x + a, y + b);
      let o = g.poly([q(0.1, 0.1), q(w - 0.1, 0.1), q(w - 0.1, d - 0.1), q(0.1, d - 0.1)], c.main);
      o += `<polygon points="${P([q(0.38, 0.38), q(w - 0.38, 0.38), q(w - 0.38, d - 0.38), q(0.38, d - 0.38)])}" fill="none" stroke="${c.accent}" stroke-width="${f1(1.4 * s)}" stroke-dasharray="${f1(4 * s)} ${f1(3 * s)}"/>`;
      const m = q(w / 2, d / 2);
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]])
        o += `<ellipse cx="${f1(m[0] + dx * 13 * s)}" cy="${f1(m[1] + dy * 6.5 * s)}" rx="${f1((dx ? 9 : 6) * s)}" ry="${f1((dx ? 3.6 : 4.4) * s)}" fill="${c.accent}"/>`;
      return o + `<circle cx="${f1(m[0])}" cy="${f1(m[1])}" r="${f1(2.6 * s)}" fill="#E9B23A"/>`;
    },
  },
  kasur: {
    label: 'Kasur',
    colors: { main: '#C8955A', accent: '#5E8FC7' },
    draw(g, x, y, w, d, c) {
      return (
        g.box(x, y, 0, 0.14, d, 40, C3(shade(c.main, -0.15))) +
        g.box(x, y, 0, w, d, 12, C3(c.main)) +
        g.box(x + 0.1, y + 0.08, 12, w - 0.16, d - 0.16, 9, C3('#F4EEE2')) +
        g.box(x + 0.2, y + 0.16, 21, 0.5, d - 0.32, 7, C3('#FFFFFF')) +
        g.box(x + 0.8, y + 0.06, 21, w - 0.82, d - 0.12, 4, C3(c.accent))
      );
    },
  },
  rak: {
    label: 'Rak buku',
    colors: { main: '#8A5A36' },
    draw(g, x, y, w, d, c) {
      let o = g.box(x, y + 0.15, 0, 0.55, d - 0.3, 88, C3(c.main));
      const X = x + 0.55, y0 = y + 0.15, y1 = y + d - 0.15;
      const cols = ['#E0583F', '#3F7FBF', '#F2B632', '#3FA06A', '#9A6FC0', '#F2EEE3'];
      [[8, 30], [34, 56], [60, 82]].forEach(([a, b], si) => {
        o += g.quadX(X, y0 + 0.08, y1 - 0.08, a, b, shade(c.main, -0.35));
        let u = y0 + 0.16, i = si * 2;
        while (u < y1 - 0.34) {
          const wd = 0.12 + ((i * 37) % 5) * 0.02;
          const ht = b - a - 3 - ((i * 13) % 4) * 3;
          o += g.quadX(X, u, u + wd, a, a + ht, cols[i % cols.length], 1);
          u += wd + 0.03;
          i++;
        }
      });
      return o;
    },
  },
  tanaman: {
    label: 'Tanaman pot',
    colors: { main: '#C66B3D', accent: '#56B36F' },
    draw(g, x, y, w, d, c) {
      const s = g.s;
      let o = g.box(x + 0.3, y + 0.3, 0, 0.4, 0.4, 22, C3(c.main));
      const ctr = g.iso(x + 0.5, y + 0.5);
      const cx = ctr[0], cy = ctr[1] - 26 * s;
      [[-16, -16, -35], [14, -20, 30], [-4, -30, -5], [-22, -4, -60], [20, -6, 55]].forEach(([dx, dy, r], i) => {
        const ex = f1(cx + dx * s), ey = f1(cy + dy * s);
        o += `<ellipse cx="${ex}" cy="${ey}" rx="${f1(14 * s)}" ry="${f1(7.5 * s)}" transform="rotate(${r} ${ex} ${ey})" fill="${i % 2 ? shade(c.accent, -0.2) : c.accent}" stroke="${INK}" stroke-width="${f1(1.5 * s)}"/>`;
      });
      return o;
    },
  },
  lampu: {
    label: 'Lampu berdiri',
    colors: { main: '#F2C14E' },
    draw(g, x, y, w, d, c) {
      const s = g.s;
      const ctr = g.iso(x + 0.5, y + 0.5);
      const cx = ctr[0], cy = ctr[1];
      return (
        `<circle cx="${f1(cx)}" cy="${f1(cy - 70 * s)}" r="${f1(30 * s)}" fill="#FFE7A0" opacity=".45"/>` +
        g.box(x + 0.32, y + 0.32, 0, 0.36, 0.36, 4, C3('#3B3F55')) +
        `<line x1="${f1(cx)}" y1="${f1(cy - 4 * s)}" x2="${f1(cx)}" y2="${f1(cy - 62 * s)}" stroke="${INK}" stroke-width="${f1(3 * s)}"/>` +
        `<polygon points="${P([[cx - 16 * s, cy - 60 * s], [cx + 16 * s, cy - 60 * s], [cx + 10 * s, cy - 82 * s], [cx - 10 * s, cy - 82 * s]])}" fill="${c.main}" stroke="${INK}" stroke-width="${f1(1.8 * s)}" stroke-linejoin="round"/>` +
        `<path d="M${f1(cx - 13 * s)} ${f1(cy - 67 * s)}H${f1(cx + 13 * s)}M${f1(cx - 11.5 * s)} ${f1(cy - 74 * s)}H${f1(cx + 11.5 * s)}" stroke="${shade(c.main, -0.3)}" stroke-width="${f1(1.2 * s)}"/>`
      );
    },
  },
  meja: {
    label: 'Meja',
    colors: { main: '#D8B27A' },
    draw(g, x, y, w, d, c) {
      let o = '';
      const leg = C3(shade(c.main, -0.15));
      [[0.15, 0.15], [w - 0.25, 0.15], [0.15, d - 0.25], [w - 0.25, d - 0.25]].forEach(([a, b]) => (o += g.box(x + a, y + b, 0, 0.1, 0.1, 24, leg)));
      o += g.box(x + 0.08, y + 0.08, 24, w - 0.16, d - 0.16, 5, C3(c.main));
      const s = g.s, ctr = g.iso(x + w / 2, y + d / 2);
      return o + `<rect x="${f1(ctr[0] - 5 * s)}" y="${f1(ctr[1] - 40 * s)}" width="${f1(10 * s)}" height="${f1(11 * s)}" rx="${f1(2 * s)}" fill="#FFFFFF" stroke="${INK}" stroke-width="${f1(1.4 * s)}"/>`;
    },
  },
  kursi: {
    label: 'Kursi',
    colors: { main: '#D8B27A', accent: '#E0583F' },
    draw(g, x, y, w, d, c) {
      let o = '';
      const leg = C3(shade(c.main, -0.15));
      [[0.25, 0.25], [0.68, 0.25], [0.25, 0.68], [0.68, 0.68]].forEach(([a, b]) => (o += g.box(x + a, y + b, 0, 0.08, 0.08, 14, leg)));
      o += g.box(x + 0.2, y + 0.2, 0, 0.1, 0.6, 44, C3(c.main));
      o += g.box(x + 0.2, y + 0.2, 14, 0.6, 0.6, 4, C3(c.main));
      o += g.box(x + 0.32, y + 0.27, 18, 0.42, 0.46, 3, C3(c.accent));
      return o;
    },
  },
  sofa: {
    label: 'Sofa',
    colors: { main: '#7FA7D9', accent: '#F2EEE3' },
    draw(g, x, y, w, d, c) {
      const m = C3(c.main);
      let o = g.box(x + 0.05, y + 0.05, 0, w - 0.1, 0.3, 36, m);
      o += g.box(x + 0.05, y + 0.05, 0, w - 0.1, d - 0.1, 14, m);
      o += g.box(x + 0.05, y + 0.05, 0, 0.25, d - 0.1, 24, m);
      o += g.box(x + w - 0.3, y + 0.05, 0, 0.25, d - 0.1, 24, m);
      o += g.box(x + 0.4, y + 0.38, 14, 0.5, 0.5, 6, C3(c.accent));
      o += g.box(x + w - 0.9, y + 0.38, 14, 0.5, 0.5, 6, C3(c.accent));
      return o;
    },
  },
  lemari: {
    label: 'Lemari',
    colors: { main: '#9C6B45' },
    draw(g, x, y, w, d, c) {
      let o = g.box(x + 0.05, y + 0.05, 0, w - 0.1, d - 0.1, 96, C3(c.main));
      const X = x + w - 0.05;
      o += g.quadX(X, y + 0.12, y + d / 2 - 0.03, 8, 88, shade(c.main, -0.2), 1.2);
      o += g.quadX(X, y + d / 2 + 0.03, y + d - 0.12, 8, 88, shade(c.main, -0.2), 1.2);
      if (g.back) return o; // dari belakang: gagang pintu tidak terlihat
      const k1 = g.iso(X, y + d / 2 - 0.12), k2 = g.iso(X, y + d / 2 + 0.12);
      o += `<circle cx="${f1(k1[0])}" cy="${f1(k1[1] - 48 * g.s)}" r="${f1(2.4 * g.s)}" fill="#F2B632" stroke="${INK}" stroke-width="1"/>`;
      o += `<circle cx="${f1(k2[0])}" cy="${f1(k2[1] - 48 * g.s)}" r="${f1(2.4 * g.s)}" fill="#F2B632" stroke="${INK}" stroke-width="1"/>`;
      return o;
    },
  },
  tv: {
    label: 'TV tabung',
    colors: { main: '#4A4E69', accent: '#B98B4E' },
    draw(g, x, y, w, d, c) {
      const s = g.s;
      let o = g.box(x + 0.1, y + 0.1, 0, 0.8, 0.8, 18, C3(c.accent));
      o += g.box(x + 0.18, y + 0.22, 18, 0.64, 0.5, 30, C3(c.main));
      o += g.quadY(y + 0.72, x + 0.25, x + 0.76, 21, 44, '#7FC4E8', 1.4);
      o += g.quadY(y + 0.72, x + 0.3, x + 0.42, 37, 42, '#D7F0FB', 0);
      const top = g.iso(x + 0.5, y + 0.47);
      return o + `<path d="M${f1(top[0])} ${f1(top[1] - 48 * s)}l${f1(-9 * s)} ${f1(-16 * s)}M${f1(top[0])} ${f1(top[1] - 48 * s)}l${f1(9 * s)} ${f1(-16 * s)}" stroke="${INK}" stroke-width="${f1(2 * s)}" stroke-linecap="round"/>`;
    },
  },
  akuarium: {
    label: 'Akuarium',
    colors: { main: '#BFE3F5', accent: '#8A5A36' },
    draw(g, x, y, w, d, c) {
      const s = g.s;
      let o = g.box(x, y, 0, w, d, 16, C3(c.accent));
      o += g.box(x + 0.1, y + 0.1, 16, w - 0.2, d - 0.2, 32, C3(c.main));
      const P = (xx: number, v: number) => { const p = g.iso(xx, y + d - 0.1); return [p[0], p[1] - v * s]; };
      const fish = (xx: number, v: number, colr: string) => { const [fx, fy] = P(xx, v); return `<ellipse cx="${f1(fx)}" cy="${f1(fy)}" rx="${f1(6 * s)}" ry="${f1(3.6 * s)}" fill="${colr}" stroke="${INK}" stroke-width="${f1(1.2 * s)}"/><path d="M${f1(fx + 5 * s)} ${f1(fy)}l${f1(5 * s)} ${f1(-4 * s)}v${f1(8 * s)}Z" fill="${colr}" stroke="${INK}" stroke-width="${f1(1 * s)}"/>`; };
      const [px, py] = P(x + 0.35, 18);
      o += `<path d="M${f1(px)} ${f1(py)}q${f1(-4 * s)} ${f1(-10 * s)} 0 ${f1(-20 * s)}M${f1(px + 5 * s)} ${f1(py)}q${f1(4 * s)} ${f1(-8 * s)} 0 ${f1(-15 * s)}" stroke="#3FA06A" stroke-width="${f1(2.4 * s)}" fill="none"/>`;
      o += fish(x + 0.8, 34, '#F2994A') + fish(x + w - 0.6, 26, '#E0583F');
      const [bx, by] = P(x + w - 0.45, 40);
      return o + `<circle cx="${f1(bx)}" cy="${f1(by)}" r="${f1(2 * s)}" fill="#FFFFFF" opacity=".8"/><circle cx="${f1(bx + 3 * s)}" cy="${f1(by - 6 * s)}" r="${f1(1.5 * s)}" fill="#FFFFFF" opacity=".8"/>`;
    },
  },
  kulkas: {
    label: 'Kulkas',
    colors: { main: '#EEF3F5', accent: '#E0583F' },
    draw(g, x, y, w, d, c) {
      let o = g.box(x + 0.12, y + 0.12, 0, 0.76, 0.76, 92, C3(c.main));
      const Y = y + 0.88;
      o += g.quadY(Y, x + 0.12, x + 0.88, 58, 60, shade(c.main, -0.35), 0);
      o += g.quadY(Y, x + 0.72, x + 0.79, 66, 84, '#9AA7B8', 1);
      o += g.quadY(Y, x + 0.72, x + 0.79, 30, 50, '#9AA7B8', 1);
      if (g.back) return o; // dari belakang: magnet hiasan di pintu tidak terlihat
      const m = g.iso(x + 0.35, Y);
      return o + `<circle cx="${f1(m[0])}" cy="${f1(m[1] - 76 * g.s)}" r="${f1(3 * g.s)}" fill="${c.accent}" stroke="${INK}" stroke-width="${f1(g.s)}"/>`;
    },
  },
  beanbag: {
    label: 'Bean bag',
    colors: { main: '#E07A5F' },
    draw(g, x, y, w, d, c) {
      const s = g.s, ctr = g.iso(x + 0.5, y + 0.5), cx = ctr[0], cy = ctr[1];
      const P = (dx: number, dy: number) => `${f1(cx + dx * s)} ${f1(cy + dy * s)}`;
      return `<path d="M${P(-28, -2)}Q${P(-32, -30)} ${P(-6, -34)}Q${P(24, -38)} ${P(28, -10)}Q${P(22, 6)} ${P(0, 4)}Q${P(-22, 6)} ${P(-28, -2)}Z" fill="${c.main}" stroke="${INK}" stroke-width="${f1(1.8 * s)}" stroke-linejoin="round"/><path d="M${P(-14, -22)}Q${P(0, -14)} ${P(16, -22)}" fill="none" stroke="${shade(c.main, -0.25)}" stroke-width="${f1(1.6 * s)}"/><path d="M${P(-20, -24)}q${f1(4 * s)} ${f1(-6 * s)} ${f1(10 * s)} ${f1(-7 * s)}" stroke="#FFFFFF" stroke-width="${f1(2 * s)}" opacity=".6" fill="none" stroke-linecap="round"/>`;
    },
  },
  kaktus: {
    label: 'Kaktus pot',
    colors: { main: '#5DA05A', accent: '#C66B3D' },
    draw(g, x, y, w, d, c) {
      const s = g.s;
      let o = g.box(x + 0.32, y + 0.32, 0, 0.36, 0.36, 16, C3(c.accent));
      const ctr = g.iso(x + 0.5, y + 0.5), cx = ctr[0], base = ctr[1] - 18 * s;
      const arm = (dir: number) => `M${f1(cx + dir * 6 * s)} ${f1(base - 18 * s)}h${f1(dir * 9 * s)}v${f1(-12 * s)}`;
      o += `<path d="${arm(-1)}${arm(1)}" fill="none" stroke="${INK}" stroke-width="${f1(10 * s)}" stroke-linecap="round" stroke-linejoin="round"/>`;
      o += `<path d="${arm(-1)}${arm(1)}" fill="none" stroke="${c.main}" stroke-width="${f1(6.5 * s)}" stroke-linecap="round" stroke-linejoin="round"/>`;
      o += `<rect x="${f1(cx - 7 * s)}" y="${f1(base - 40 * s)}" width="${f1(14 * s)}" height="${f1(42 * s)}" rx="${f1(7 * s)}" fill="${c.main}" stroke="${INK}" stroke-width="${f1(1.8 * s)}"/>`;
      o += `<path d="M${f1(cx)} ${f1(base - 34 * s)}v${f1(30 * s)}" stroke="${shade(c.main, -0.25)}" stroke-width="${f1(1.4 * s)}"/>`;
      return o + `<circle cx="${f1(cx)}" cy="${f1(base - 41 * s)}" r="${f1(4 * s)}" fill="#FF8FA3" stroke="${INK}" stroke-width="${f1(1.4 * s)}"/>`;
    },
  },
  lampion: {
    label: 'Lampion berdiri',
    colors: { main: '#C0392B', accent: '#F2B632' },
    draw(g, x, y, w, d, c) {
      const s = g.s, ctr = g.iso(x + 0.5, y + 0.5), cx = ctr[0], cy = ctr[1];
      let o = g.box(x + 0.35, y + 0.35, 0, 0.3, 0.3, 5, C3('#5A381F'));
      o += `<path d="M${f1(cx)} ${f1(cy - 4 * s)}V${f1(cy - 84 * s)}h${f1(16 * s)}" fill="none" stroke="${INK}" stroke-width="${f1(3 * s)}" stroke-linecap="round"/>`;
      const lx = cx + 16 * s, ly = cy - 64 * s;
      o += `<circle cx="${f1(lx)}" cy="${f1(ly)}" r="${f1(22 * s)}" fill="#FFD27A" opacity=".35"/>`;
      o += `<line x1="${f1(lx)}" y1="${f1(cy - 84 * s)}" x2="${f1(lx)}" y2="${f1(ly - 14 * s)}" stroke="${INK}" stroke-width="${f1(1.5 * s)}"/>`;
      o += `<ellipse cx="${f1(lx)}" cy="${f1(ly)}" rx="${f1(11 * s)}" ry="${f1(13 * s)}" fill="${c.main}" stroke="${INK}" stroke-width="${f1(1.8 * s)}"/>`;
      o += `<path d="M${f1(lx - 4 * s)} ${f1(ly - 12 * s)}v${f1(24 * s)}M${f1(lx + 4 * s)} ${f1(ly - 12 * s)}v${f1(24 * s)}" stroke="${shade(c.main, -0.3)}" stroke-width="${f1(1.2 * s)}"/>`;
      o += `<rect x="${f1(lx - 6 * s)}" y="${f1(ly - 16 * s)}" width="${f1(12 * s)}" height="${f1(4 * s)}" fill="${c.accent}" stroke="${INK}" stroke-width="${f1(1.2 * s)}"/><rect x="${f1(lx - 6 * s)}" y="${f1(ly + 12 * s)}" width="${f1(12 * s)}" height="${f1(4 * s)}" fill="${c.accent}" stroke="${INK}" stroke-width="${f1(1.2 * s)}"/>`;
      return o + `<path d="M${f1(lx)} ${f1(ly + 16 * s)}v${f1(8 * s)}" stroke="${c.accent}" stroke-width="${f1(2 * s)}"/>`;
    },
  },
  payung: {
    label: 'Payung taman',
    colors: { main: '#3F7FBF', accent: '#FFFFFF' },
    draw(g, x, y, w, d, c) {
      const s = g.s, ctr = g.iso(x + 0.5, y + 0.5), cx = ctr[0], cy = ctr[1];
      let o = g.box(x + 0.32, y + 0.32, 0, 0.36, 0.36, 6, C3('#9AA7B8'));
      o += `<line x1="${f1(cx)}" y1="${f1(cy - 6 * s)}" x2="${f1(cx)}" y2="${f1(cy - 70 * s)}" stroke="${INK}" stroke-width="${f1(3 * s)}"/>`;
      const top = cy - 92 * s, rim = cy - 66 * s, R = 40 * s;
      for (let i = 0; i < 6; i++) {
        const a0 = -R + (i * 2 * R) / 6, a1 = -R + ((i + 1) * 2 * R) / 6;
        o += `<path d="M${f1(cx)} ${f1(top)}L${f1(cx + a0)} ${f1(rim + Math.abs(a0) * 0.12)}Q${f1(cx + (a0 + a1) / 2)} ${f1(rim + 8 * s)} ${f1(cx + a1)} ${f1(rim + Math.abs(a1) * 0.12)}Z" fill="${i % 2 ? c.accent : c.main}" stroke="${INK}" stroke-width="${f1(1.6 * s)}" stroke-linejoin="round"/>`;
      }
      return o + `<circle cx="${f1(cx)}" cy="${f1(top)}" r="${f1(3 * s)}" fill="${INK}"/>`;
    },
  },
  kompor: {
    label: 'Kompor dapur',
    colors: { main: '#EEF3F5', accent: '#E0583F' },
    draw(g, x, y, w, d, c) {
      const s = g.s;
      let o = g.box(x + 0.06, y + 0.06, 0, w - 0.12, d - 0.12, 36, C3(c.main));
      o += g.quadY(y + d - 0.06, x + 0.18, x + w - 0.18, 8, 26, shade(c.main, -0.32), 1.2);
      o += g.quadY(y + d - 0.06, x + 0.3, x + w - 0.3, 22, 24, '#9AA7B8', 0);
      for (const [a, b] of [[0.3, 0.32], [0.7, 0.68]]) {
        const p = g.iso(x + a * w, y + b * d);
        o += `<ellipse cx="${f1(p[0])}" cy="${f1(p[1] - 36 * s)}" rx="${f1(8 * s)}" ry="${f1(4 * s)}" fill="#3B3F55" stroke="${INK}" stroke-width="${f1(1.2 * s)}"/>`;
      }
      o += g.box(x + 0.16 * w, y + 0.18 * d, 36, 0.3, 0.3, 12, C3(c.accent));
      const t = g.iso(x + 0.31 * w, y + 0.33 * d);
      return o + `<path d="M${f1(t[0] - 3 * s)} ${f1(t[1] - 52 * s)}q${f1(-4 * s)} ${f1(-6 * s)} 0 ${f1(-12 * s)}M${f1(t[0] + 4 * s)} ${f1(t[1] - 52 * s)}q${f1(-4 * s)} ${f1(-6 * s)} 0 ${f1(-12 * s)}" stroke="#9AA7B8" stroke-width="${f1(1.6 * s)}" fill="none" stroke-linecap="round" opacity=".8"/>`;
    },
  },
  bakmandi: {
    label: 'Bak mandi',
    colors: { main: '#FFFFFF', accent: '#7FC4E8' },
    draw(g, x, y, w, d, c) {
      const s = g.s;
      let o = g.box(x + 0.06, y + 0.06, 0, w - 0.12, d - 0.12, 26, C3(c.main));
      const q = (a: number, b: number) => { const p = g.iso(x + a, y + b); return [p[0], p[1] - 24 * s]; };
      o += g.poly([q(0.22, 0.2), q(w - 0.22, 0.2), q(w - 0.22, d - 0.2), q(0.22, d - 0.2)], c.accent, 1.2);
      const t = g.iso(x + 0.14, y + d / 2);
      o += `<path d="M${f1(t[0])} ${f1(t[1] - 26 * s)}v${f1(-16 * s)}h${f1(9 * s)}v${f1(5 * s)}" fill="none" stroke="${INK}" stroke-width="${f1(3 * s)}" stroke-linecap="round" stroke-linejoin="round"/>`;
      const m = q(w / 2, d / 2);
      return o + `<circle cx="${f1(m[0] - 9 * s)}" cy="${f1(m[1] - 3 * s)}" r="${f1(4.5 * s)}" fill="#FFFFFF" stroke="${INK}" stroke-width="${f1(s)}"/><circle cx="${f1(m[0] + 7 * s)}" cy="${f1(m[1] - 5 * s)}" r="${f1(3.2 * s)}" fill="#FFFFFF" stroke="${INK}" stroke-width="${f1(s)}"/>`;
    },
  },
  bangku: {
    label: 'Bangku taman',
    colors: { main: '#B9804A', accent: '#3B3F55' },
    draw(g, x, y, w, d, c) {
      const leg = C3(c.accent);
      let o = '';
      for (const a of [0.14, w - 0.24]) o += g.box(x + a, y + 0.2, 0, 0.1, 0.1, 18, leg) + g.box(x + a, y + d - 0.3, 0, 0.1, 0.1, 18, leg);
      o += g.box(x + 0.08, y + 0.08, 18, w - 0.16, 0.1, 26, C3(c.main));
      return o + g.box(x + 0.08, y + 0.18, 18, w - 0.16, d - 0.34, 4, C3(c.main));
    },
  },
  pohon: {
    label: 'Pohon rindang',
    colors: { main: '#5DA05A', accent: '#8A5A36' },
    draw(g, x, y, w, d, c) {
      const s = g.s, ctr = g.iso(x + w / 2, y + d / 2), cx = ctr[0], cy = ctr[1];
      let o = `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(30 * s)}" ry="${f1(12 * s)}" fill="${INK}" opacity=".12"/>`;
      o += g.box(x + w / 2 - 0.1, y + d / 2 - 0.1, 0, 0.2, 0.2, 48, C3(c.accent));
      o += `<g class="canopy">`;
      for (const [dx, dy, r, k] of [[0, -90, 23, 0], [-18, -69, 20, 1], [18, -72, 19, 1], [-5, -57, 16, 0], [11, -54, 14, 0]])
        o += `<circle cx="${f1(cx + dx * s)}" cy="${f1(cy + dy * s)}" r="${f1(r * s)}" fill="${k ? shade(c.main, -0.14) : c.main}" stroke="${INK}" stroke-width="${f1(1.8 * s)}"/>`;
      return o + `<circle cx="${f1(cx - 7 * s)}" cy="${f1(cy - 97 * s)}" r="${f1(6 * s)}" fill="${shade(c.main, 0.35)}"/><circle cx="${f1(cx + 13 * s)}" cy="${f1(cy - 68 * s)}" r="${f1(3 * s)}" fill="#E0583F" stroke="${INK}" stroke-width="${f1(s)}"/></g>`;
    },
  },
  sepeda: {
    label: 'Sepeda statis',
    colors: { main: '#3F7FBF', accent: '#3B3F55' },
    draw(g, x, y, w, d, c) {
      const s = g.s;
      let o = g.box(x + 0.12, y + 0.36, 0, 0.76, 0.28, 6, C3(c.accent));
      o += g.box(x + 0.22, y + 0.43, 6, 0.13, 0.13, 22, C3(c.main));
      const fw = g.iso(x + 0.8, y + 0.5);
      o += `<circle cx="${f1(fw[0])}" cy="${f1(fw[1] - 18 * s)}" r="${f1(11 * s)}" fill="${shade(c.accent, 0.25)}" stroke="${INK}" stroke-width="${f1(1.6 * s)}"/><circle cx="${f1(fw[0])}" cy="${f1(fw[1] - 18 * s)}" r="${f1(3 * s)}" fill="${INK}"/>`;
      o += g.box(x + 0.64, y + 0.43, 6, 0.13, 0.13, 38, C3(c.main));
      o += g.box(x + 0.12, y + 0.37, 28, 0.34, 0.26, 5, C3('#3B3F55'));
      const hb = g.iso(x + 0.7, y + 0.5);
      return o + `<path d="M${f1(hb[0] - 11 * s)} ${f1(hb[1] - 46 * s)}q${f1(11 * s)} ${f1(-6 * s)} ${f1(22 * s)} 0" fill="none" stroke="${INK}" stroke-width="${f1(3.4 * s)}" stroke-linecap="round"/>`;
    },
  },
  matras: {
    label: 'Matras senam',
    colors: { main: '#8FD3A7', accent: '#FFFDF7' },
    draw(g, x, y, w, d, c) {
      const s = g.s;
      const q = (a: number, b: number) => g.iso(x + a, y + b);
      let o = g.poly([q(0.12, 0.15), q(w - 0.12, 0.15), q(w - 0.12, d - 0.15), q(0.12, d - 0.15)], c.main);
      for (let k = 1; k < 4; k++) {
        const a = 0.12 + (k * (w - 0.24)) / 4;
        o += `<line x1="${f1(q(a, 0.2)[0])}" y1="${f1(q(a, 0.2)[1])}" x2="${f1(q(a, d - 0.2)[0])}" y2="${f1(q(a, d - 0.2)[1])}" stroke="${c.accent}" stroke-width="${f1(1.4 * s)}" opacity=".7"/>`;
      }
      return o;
    },
  },
  /* ---------- properti Alun-alun ---------- */
  beringin: {
    label: 'Pohon beringin',
    colors: { main: '#3F8F4E', accent: '#7A5232' },
    draw(g, x, y, w, d, c) {
      const s = g.s, ctr = g.iso(x + w / 2, y + d / 2), cx = ctr[0], cy = ctr[1];
      let o = `<ellipse cx="${f1(cx)}" cy="${f1(cy + 2 * s)}" rx="${f1(52 * s)}" ry="${f1(20 * s)}" fill="${INK}" opacity=".14"/>`;
      // akar gantung & batang besar
      o += `<path d="M${f1(cx - 16 * s)} ${f1(cy)}C${f1(cx - 14 * s)} ${f1(cy - 50 * s)} ${f1(cx - 10 * s)} ${f1(cy - 75 * s)} ${f1(cx - 6 * s)} ${f1(cy - 100 * s)}L${f1(cx + 8 * s)} ${f1(cy - 100 * s)}C${f1(cx + 12 * s)} ${f1(cy - 75 * s)} ${f1(cx + 16 * s)} ${f1(cy - 50 * s)} ${f1(cx + 18 * s)} ${f1(cy)}Z" fill="${c.accent}" stroke="${INK}" stroke-width="${f1(2.2 * s)}" stroke-linejoin="round"/>`;
      o += `<g class="canopy">`;
      for (const dx of [-38, -24, 24, 36]) o += `<path d="M${f1(cx + dx * s)} ${f1(cy - 86 * s)}q${f1(dx > 0 ? 4 * s : -4 * s)} ${f1(34 * s)} 0 ${f1(68 * s)}" stroke="${shade(c.accent, -0.1)}" stroke-width="${f1(2.2 * s)}" fill="none" stroke-linecap="round"/>`;
      for (const [dx, dy, r, k] of [[0, -136, 32, 0], [-35, -114, 29, 1], [35, -116, 29, 1], [-19, -98, 26, 0], [21, -96, 26, 0], [-50, -94, 18, 1], [50, -96, 18, 1]])
        o += `<circle cx="${f1(cx + dx * s)}" cy="${f1(cy + dy * s)}" r="${f1(r * s)}" fill="${k ? shade(c.main, -0.12) : c.main}" stroke="${INK}" stroke-width="${f1(2 * s)}"/>`;
      return o + `<circle cx="${f1(cx - 11 * s)}" cy="${f1(cy - 147 * s)}" r="${f1(8 * s)}" fill="${shade(c.main, 0.3)}"/><circle cx="${f1(cx + 24 * s)}" cy="${f1(cy - 121 * s)}" r="${f1(5 * s)}" fill="${shade(c.main, 0.3)}"/></g>`;
    },
  },
  airmancur: {
    label: 'Air mancur',
    colors: { main: '#D9D2C3', accent: '#7FC4E8' },
    draw(g, x, y, w, d, c) {
      const s = g.s, ctr = g.iso(x + w / 2, y + d / 2), cx = ctr[0], cy = ctr[1];
      const rx = (w + d) * 15 * s, ry = rx / 2;
      let o = `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(rx)}" ry="${f1(ry)}" fill="${shade(c.main, -0.25)}" stroke="${INK}" stroke-width="${f1(2 * s)}"/>`;
      o += `<path d="M${f1(cx - rx)} ${f1(cy)}v${f1(-14 * s)}a${f1(rx)} ${f1(ry)} 0 0 0 ${f1(2 * rx)} 0v${f1(14 * s)}a${f1(rx)} ${f1(ry)} 0 0 1 ${f1(-2 * rx)} 0Z" fill="${c.main}" stroke="${INK}" stroke-width="${f1(2 * s)}"/>`;
      o += `<ellipse cx="${f1(cx)}" cy="${f1(cy - 14 * s)}" rx="${f1(rx - 6 * s)}" ry="${f1(ry - 3 * s)}" fill="${c.accent}" stroke="${INK}" stroke-width="${f1(1.6 * s)}"/>`;
      o += `<path d="M${f1(cx - 9 * s)} ${f1(cy - 14 * s)}V${f1(cy - 44 * s)}h${f1(18 * s)}V${f1(cy - 14 * s)}" fill="${c.main}" stroke="${INK}" stroke-width="${f1(1.8 * s)}"/>`;
      o += `<ellipse cx="${f1(cx)}" cy="${f1(cy - 44 * s)}" rx="${f1(22 * s)}" ry="${f1(9 * s)}" fill="${c.main}" stroke="${INK}" stroke-width="${f1(1.8 * s)}"/><ellipse cx="${f1(cx)}" cy="${f1(cy - 46 * s)}" rx="${f1(17 * s)}" ry="${f1(6 * s)}" fill="${c.accent}"/>`;
      // pancuran (bergerak lewat kelas .water)
      let jets = '';
      for (const dx of [-1, 0, 1]) jets += `<path class="water" d="M${f1(cx)} ${f1(cy - 50 * s)}q${f1(dx * 20 * s)} ${f1(-34 * s)} ${f1(dx * 34 * s + (dx ? 0 : 1))} ${f1(dx ? 24 * s : -8 * s)}" fill="none" stroke="#BFE6F7" stroke-width="${f1(3.4 * s)}" stroke-linecap="round" stroke-dasharray="${f1(6 * s)} ${f1(5 * s)}"/>`;
      return o + jets + `<ellipse cx="${f1(cx - rx * 0.4)}" cy="${f1(cy - 16 * s)}" rx="${f1(8 * s)}" ry="${f1(2.4 * s)}" fill="#FFFFFF" opacity=".8"/>`;
    },
  },
  panggung: {
    label: 'Panggung hiburan',
    colors: { main: '#B9804A', accent: '#C0392B' },
    draw(g, x, y, w, d, c) {
      const s = g.s;
      let o = g.box(x, y, 0, w, d, 24, C3(c.main));
      // papan lantai panggung
      for (let k = 1; k < w * 2; k++) { const a = g.iso(x + k / 2, y), b = g.iso(x + k / 2, y + d); o += `<line x1="${f1(a[0])}" y1="${f1(a[1] - 24 * s)}" x2="${f1(b[0])}" y2="${f1(b[1] - 24 * s)}" stroke="${shade(c.main, -0.18)}" stroke-width="${f1(s)}"/>`; }
      // tiang & latar belakang bertirai
      o += g.box(x, y, 24, 0.14, 0.14, 120, C3('#8A5A36')) + g.box(x + w - 0.14, y, 24, 0.14, 0.14, 120, C3('#8A5A36'));
      o += g.quadY(y, x + 0.14, x + w - 0.14, 24 * 1, 144 * 1, shade(c.accent, -0.25));
      for (let k = 0; k < 8; k++) { const u = x + 0.2 + (k * (w - 0.4)) / 7, p = g.iso(u, y); o += `<path d="M${f1(p[0])} ${f1(p[1] - 30 * s)}V${f1(p[1] - 140 * s)}" stroke="${shade(c.accent, -0.4)}" stroke-width="${f1(1.4 * s)}"/>`; }
      // tirai kiri-kanan & papan nama
      const L0 = g.iso(x + 0.14, y), L1 = g.iso(x + 0.9, y), R0 = g.iso(x + w - 0.9, y), R1 = g.iso(x + w - 0.14, y);
      const up = (p: number[], v: number) => [p[0], p[1] - v * s];
      o += g.poly([up(L0, 24), up(L0, 150), up(L1, 150), up(L1, 110), up(L0, 40)], c.accent) + g.poly([up(R1, 24), up(R1, 150), up(R0, 150), up(R0, 110), up(R1, 40)], c.accent);
      const T0 = g.iso(x - 0.1, y), T1 = g.iso(x + w + 0.1, y);
      o += g.poly([up(T0, 144), up(T1, 144), up(T1, 162), up(T0, 162)], '#F2B632');
      for (let k = 0; k < 9; k++) { const u = x + (k * w) / 8, p = g.iso(u, y); o += `<circle cx="${f1(p[0])}" cy="${f1(p[1] - 153 * s)}" r="${f1(2.6 * s)}" fill="${k % 2 ? '#FFFFFF' : '#E0583F'}"/>`; }
      return o;
    },
  },
  komidi: {
    label: 'Komidi putar',
    colors: { main: '#E0583F', accent: '#FFF4D6' },
    draw(g, x, y, w, d, c) {
      const s = g.s, ctr = g.iso(x + w / 2, y + d / 2), cx = ctr[0], cy = ctr[1];
      const rx = (w + d) * 15 * s, ry = rx / 2;
      let o = `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(rx)}" ry="${f1(ry)}" fill="${INK}" opacity=".14"/>`;
      o += `<path d="M${f1(cx - rx)} ${f1(cy - 4 * s)}v${f1(-10 * s)}a${f1(rx)} ${f1(ry)} 0 0 0 ${f1(2 * rx)} 0v${f1(10 * s)}a${f1(rx)} ${f1(ry)} 0 0 1 ${f1(-2 * rx)} 0Z" fill="${shade(c.main, -0.2)}" stroke="${INK}" stroke-width="${f1(2 * s)}"/>`;
      o += `<ellipse cx="${f1(cx)}" cy="${f1(cy - 14 * s)}" rx="${f1(rx)}" ry="${f1(ry)}" fill="${c.accent}" stroke="${INK}" stroke-width="${f1(2 * s)}"/>`;
      o += `<rect x="${f1(cx - 5 * s)}" y="${f1(cy - 128 * s)}" width="${f1(10 * s)}" height="${f1(116 * s)}" fill="#F2B632" stroke="${INK}" stroke-width="${f1(1.8 * s)}"/>`;
      // kuda-kuda naik-turun (kelas .ride)
      const horse = (hx: number, hy: number, col: string, k: number) =>
        `<g class="ride" style="animation-delay:${k * 0.35}s"><line x1="${f1(hx)}" y1="${f1(hy - 92 * s)}" x2="${f1(hx)}" y2="${f1(hy)}" stroke="#C9A13B" stroke-width="${f1(2.4 * s)}"/><path d="M${f1(hx - 16 * s)} ${f1(hy - 38 * s)}q${f1(4 * s)} ${f1(-14 * s)} ${f1(20 * s)} ${f1(-12 * s)}l${f1(8 * s)} ${f1(-12 * s)}l${f1(6 * s)} ${f1(6 * s)}l${f1(-6 * s)} ${f1(12 * s)}q${f1(-2 * s)} ${f1(14 * s)} ${f1(-14 * s)} ${f1(14 * s)}h${f1(-12 * s)}Z" fill="${col}" stroke="${INK}" stroke-width="${f1(1.8 * s)}" stroke-linejoin="round"/><path d="M${f1(hx - 12 * s)} ${f1(hy - 26 * s)}v${f1(10 * s)}M${f1(hx + 6 * s)} ${f1(hy - 26 * s)}v${f1(10 * s)}" stroke="${INK}" stroke-width="${f1(2 * s)}"/></g>`;
      o += horse(cx - rx * 0.55, cy - 16 * s, '#FFFFFF', 0) + horse(cx + rx * 0.5, cy - 18 * s, '#F7A8C4', 1) + horse(cx - rx * 0.15, cy + ry * 0.45 - 14 * s, '#9FD3EC', 2);
      // atap kerucut bergaris
      const top = cy - 150 * s, rim = cy - 104 * s;
      for (let i = 0; i < 8; i++) {
        const a0 = -rx - 6 * s + (i * (2 * rx + 12 * s)) / 8, a1 = -rx - 6 * s + ((i + 1) * (2 * rx + 12 * s)) / 8;
        o += `<path d="M${f1(cx)} ${f1(top)}L${f1(cx + a0)} ${f1(rim)}Q${f1(cx + (a0 + a1) / 2)} ${f1(rim + 9 * s)} ${f1(cx + a1)} ${f1(rim)}Z" fill="${i % 2 ? c.accent : c.main}" stroke="${INK}" stroke-width="${f1(1.6 * s)}" stroke-linejoin="round"/>`;
      }
      return o + `<path d="M${f1(cx)} ${f1(top)}v${f1(-14 * s)}l${f1(12 * s)} ${f1(4 * s)}l${f1(-12 * s)} ${f1(4 * s)}" fill="#F2B632" stroke="${INK}" stroke-width="${f1(1.4 * s)}"/>`;
    },
  },
  ayunan: {
    label: 'Ayunan',
    colors: { main: '#3F7FBF', accent: '#E0583F' },
    draw(g, x, y, w, d, c) {
      const s = g.s;
      const leg = C3(c.main);
      let o = g.box(x + 0.05, y + d / 2 - 0.06, 0, 0.12, 0.12, 96, leg) + g.box(x + w - 0.17, y + d / 2 - 0.06, 0, 0.12, 0.12, 96, leg);
      const a = g.iso(x + 0.1, y + d / 2), b = g.iso(x + w - 0.1, y + d / 2);
      o += `<line x1="${f1(a[0])}" y1="${f1(a[1] - 96 * s)}" x2="${f1(b[0])}" y2="${f1(b[1] - 96 * s)}" stroke="${INK}" stroke-width="${f1(6 * s)}" stroke-linecap="round"/><line x1="${f1(a[0])}" y1="${f1(a[1] - 96 * s)}" x2="${f1(b[0])}" y2="${f1(b[1] - 96 * s)}" stroke="${shade(c.main, 0.2)}" stroke-width="${f1(3 * s)}" stroke-linecap="round"/>`;
      // dua dudukan berayun (kelas .swing, berputar dari palang)
      for (const u of [0.32, 0.68]) {
        const p = g.iso(x + w * u, y + d / 2);
        o += `<g class="swing" style="transform-origin:${f1(p[0])}px ${f1(p[1] - 96 * s)}px;animation-delay:${u}s"><path d="M${f1(p[0] - 9 * s)} ${f1(p[1] - 96 * s)}V${f1(p[1] - 30 * s)}M${f1(p[0] + 9 * s)} ${f1(p[1] - 96 * s)}V${f1(p[1] - 30 * s)}" stroke="#7A5232" stroke-width="${f1(1.6 * s)}"/><rect x="${f1(p[0] - 13 * s)}" y="${f1(p[1] - 32 * s)}" width="${f1(26 * s)}" height="${f1(7 * s)}" rx="${f1(2 * s)}" fill="${c.accent}" stroke="${INK}" stroke-width="${f1(1.6 * s)}"/></g>`;
      }
      return o;
    },
  },
  gerobak: {
    label: 'Gerobak jajanan',
    colors: { main: '#3FA06A', accent: '#FFFDF7' },
    draw(g, x, y, w, d, c, p) {
      const s = g.s;
      let o = g.box(x + 0.15, y + 0.15, 16, w - 0.3, d - 0.3, 34, C3(c.main));
      for (const u of [0.35, w - 0.35]) { const q = g.iso(x + u, y + d - 0.12); o += `<circle cx="${f1(q[0])}" cy="${f1(q[1] - 10 * s)}" r="${f1(10 * s)}" fill="#3B3F55" stroke="${INK}" stroke-width="${f1(1.6 * s)}"/><circle cx="${f1(q[0])}" cy="${f1(q[1] - 10 * s)}" r="${f1(3 * s)}" fill="#C9A13B"/>`; }
      // atap kain bergaris
      o += g.box(x + 0.15, y + 0.2, 50, 0.07, 0.07, 54, C3('#8A5A36')) + g.box(x + w - 0.22, y + 0.2, 50, 0.07, 0.07, 54, C3('#8A5A36'));
      const A = g.iso(x + 0.02, y + 0.05), B = g.iso(x + w - 0.02, y + 0.05), Cc = g.iso(x + w - 0.02, y + d - 0.02), D = g.iso(x + 0.02, y + d - 0.02);
      const up = (q: number[], v: number) => [q[0], q[1] - v * s];
      o += g.poly([up(A, 108), up(B, 108), up(Cc, 100), up(D, 100)], c.accent);
      o += `<path d="M${f1(up(D, 100)[0])} ${f1(up(D, 100)[1])}L${f1(up(Cc, 100)[0])} ${f1(up(Cc, 100)[1])}" stroke="${c.main}" stroke-width="${f1(6 * s)}" stroke-dasharray="${f1(8 * s)} ${f1(8 * s)}"/>`;
      // dagangan di etalase: 0 = es dawet, 1 = bakso, 2 = arum manis
      const top = g.iso(x + w / 2, y + d / 2);
      const k = p.kind | 0, ex = top[0], ey = top[1] - 54 * s;
      if (k === 1) o += `<ellipse cx="${f1(ex)}" cy="${f1(ey)}" rx="${f1(13 * s)}" ry="${f1(5 * s)}" fill="#FFFFFF" stroke="${INK}" stroke-width="${f1(1.4 * s)}"/><circle cx="${f1(ex - 4 * s)}" cy="${f1(ey - 3 * s)}" r="${f1(4 * s)}" fill="#A0704A" stroke="${INK}" stroke-width="${f1(s)}"/><circle cx="${f1(ex + 4 * s)}" cy="${f1(ey - 3 * s)}" r="${f1(4 * s)}" fill="#A0704A" stroke="${INK}" stroke-width="${f1(s)}"/>`;
      else if (k === 2) o += `<line x1="${f1(ex)}" y1="${f1(ey + 4 * s)}" x2="${f1(ex)}" y2="${f1(ey - 8 * s)}" stroke="#B9804A" stroke-width="${f1(1.6 * s)}"/><circle cx="${f1(ex)}" cy="${f1(ey - 14 * s)}" r="${f1(9 * s)}" fill="#F7A8C4" stroke="${INK}" stroke-width="${f1(1.4 * s)}"/><circle cx="${f1(ex - 3 * s)}" cy="${f1(ey - 17 * s)}" r="${f1(3 * s)}" fill="#FFD6E5"/>`;
      else o += `<path d="M${f1(ex - 7 * s)} ${f1(ey - 16 * s)}h${f1(14 * s)}l${f1(-2 * s)} ${f1(18 * s)}h${f1(-10 * s)}Z" fill="#9CCB5A" stroke="${INK}" stroke-width="${f1(1.4 * s)}"/><rect x="${f1(ex - 6 * s)}" y="${f1(ey - 6 * s)}" width="${f1(12 * s)}" height="${f1(5 * s)}" fill="#C8955A"/>`;
      return o;
    },
  },
  lampujalan: {
    label: 'Lampu taman',
    colors: { main: '#3B3F55', accent: '#FFE07A' },
    draw(g, x, y, w, d, c) {
      const s = g.s, ctr = g.iso(x + 0.5, y + 0.5), cx = ctr[0], cy = ctr[1];
      let o = g.box(x + 0.36, y + 0.36, 0, 0.28, 0.28, 8, C3(c.main));
      o += `<rect x="${f1(cx - 2.5 * s)}" y="${f1(cy - 92 * s)}" width="${f1(5 * s)}" height="${f1(86 * s)}" fill="${c.main}" stroke="${INK}" stroke-width="${f1(1.4 * s)}"/>`;
      o += `<circle cx="${f1(cx)}" cy="${f1(cy - 100 * s)}" r="${f1(16 * s)}" fill="${c.accent}" opacity=".35"/>`;
      return o + `<path d="M${f1(cx - 9 * s)} ${f1(cy - 92 * s)}h${f1(18 * s)}l${f1(-3 * s)} ${f1(-16 * s)}h${f1(-12 * s)}Z" fill="${c.accent}" stroke="${INK}" stroke-width="${f1(1.6 * s)}"/><path d="M${f1(cx - 11 * s)} ${f1(cy - 108 * s)}h${f1(22 * s)}l${f1(-11 * s)} ${f1(-8 * s)}Z" fill="${c.main}" stroke="${INK}" stroke-width="${f1(1.4 * s)}"/>`;
    },
  },
  paving: {
    label: 'Jalan batu',
    colors: { main: '#D8CFC0', accent: '#BDB2A0' },
    draw(g, x, y, w, d, c) {
      const s = g.s;
      let o = '';
      for (let a = 0; a < w; a++)
        for (let b = 0; b < d; b++) {
          const q = (u: number, v: number) => g.iso(x + a + u, y + b + v);
          o += `<polygon points="${P([q(0.04, 0.04), q(0.96, 0.04), q(0.96, 0.96), q(0.04, 0.96)])}" fill="${(a + b) % 2 ? c.main : c.accent}" stroke="${shade(c.main, -0.3)}" stroke-width="${f1(s)}"/>`;
          o += `<path d="M${P([q(0.5, 0.04), q(0.5, 0.96)]).replace(' ', 'L')}M${P([q(0.04, 0.5), q(0.96, 0.5)]).replace(' ', 'L')}" stroke="${shade(c.main, -0.18)}" stroke-width="${f1(0.8 * s)}"/>`;
        }
      return o;
    },
  },
  kotak: {
    label: 'Kotak (umum)',
    colors: { main: '#E9B23A' },
    draw(g, x, y, w, d, c, p) {
      return g.box(x + 0.08, y + 0.08, 0, w - 0.16, d - 0.16, Math.max(4, Math.min(120, p.height ?? 30)), C3(c.main));
    },
  },
};

/* ------------------------------------------------------------------ */
/* Pet (karakter orisinal "Bupi")                                      */
/* ------------------------------------------------------------------ */

export const PET_COLORS = [
  '#F6B7A8', '#F4D58D', '#A8D8A0', '#9FD0E8', '#C9B6E8', '#B98A64', '#F2EEE3', '#FFB86B', '#8FD3C1', '#E7A1C9',
  '#FF8A80', '#7FA7D9', '#B5E08D', '#D9C2A3', '#9E9AC8', '#FFD6E7',
];

/** Bagian tubuh pet: [kunci, label, level minimum]. Bagian tertentu terbuka saat pet naik level. */
export type PetPart = [string, string, number];
export const PET_PARTS: { ear: PetPart[]; pattern: PetPart[]; eyes: PetPart[]; tail: PetPart[] } = {
  ear: [['tunas', 'Tunas', 1], ['kucing', 'Kucing', 1], ['kelinci', 'Kelinci', 1], ['bulat', 'Bulat', 1], ['anjing', 'Terkulai', 1], ['tanduk', 'Tanduk', 3], ['rubah', 'Runcing', 4], ['antena', 'Antena', 5], ['bunga', 'Bunga', 6]],
  pattern: [['polos', 'Polos', 1], ['totol', 'Totol', 1], ['belang', 'Belang', 2], ['topeng', 'Topeng', 3], ['ujung', 'Dua warna', 4], ['bintang', 'Bintang', 6]],
  eyes: [['bulat', 'Bulat', 1], ['senyum', 'Senyum', 1], ['berbinar', 'Berbinar', 2], ['sayu', 'Sayu', 3], ['bintang', 'Bintang', 5]],
  tail: [['bulat', 'Bulat', 1], ['keriting', 'Keriting', 2], ['lebat', 'Lebat', 3], ['daun', 'Daun', 4]],
};
/** Kompatibel dengan versi lama: daftar telinga [kunci, label]. */
export const PET_EARS: [string, string][] = PET_PARTS.ear.map(([k, l]) => [k, l]);
export function partLevel(kind: keyof typeof PET_PARTS, key: string) {
  return PET_PARTS[kind].find((p) => p[0] === key)?.[2] ?? Infinity;
}

type WearSlot = 'head' | 'face' | 'neck' | 'back' | 'hand' | 'body';
type WearFn = (c: Record<string, string>) => string;
// draw: digambar di depan tubuh; back: di belakang tubuh (sayap, ransel, jubah); slot hand = dibawa di samping kanan
// slot body (Baju, art-butik.ts): draw dipotong bentuk badan, over = setelah kaki
const WEAR: Record<string, { label: string; slot: WearSlot; colors: Record<string, string>; draw: WearFn; back?: WearFn; over?: WearFn }> = {
  caping: { label: 'Topi caping', slot: 'head', colors: { main: '#E3C16F' }, draw: (c) => `<path d="M-50 -64L0 -102 50 -64Q0 -55 -50 -64Z" fill="${c.main}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-27 -76Q0 -72 27 -76M-14 -88Q0 -86 14 -88" stroke="${shade(c.main, -0.3)}" stroke-width="2" fill="none"/>` },
  peci: { label: 'Peci', slot: 'head', colors: { main: '#2B2F4A' }, draw: (c) => `<path d="M-26 -70L-23 -92Q0 -97 23 -92L26 -70Q0 -75 -26 -70Z" fill="${c.main}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-24 -84Q0 -89 24 -84" stroke="${shade(c.main, 0.25)}" stroke-width="1.6" fill="none"/>` },
  mahkota: { label: 'Mahkota bunga', slot: 'head', colors: { main: '#FFFFFF', accent: '#F2B632' }, draw: (c) => [-30, -15, 0, 15, 30].map((x) => { const y = -76 - (30 - Math.abs(x)) * 0.25; return `<g transform="translate(${x} ${y})"><circle r="6.5" fill="${c.main}" stroke="${INK}" stroke-width="2"/><circle r="2.6" fill="${c.accent}"/></g>`; }).join('') },
  kupluk: { label: 'Kupluk rajut', slot: 'head', colors: { main: '#E0583F', accent: '#FFFFFF' }, draw: (c) => `<path d="M-38 -66Q-36 -104 0 -104Q36 -104 38 -66Z" fill="${c.main}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><rect x="-40" y="-72" width="80" height="10" rx="5" fill="${c.accent}" stroke="${INK}" stroke-width="2.5"/><circle cx="0" cy="-106" r="7" fill="${c.accent}" stroke="${INK}" stroke-width="2.5"/>` },
  blangkon: { label: 'Blangkon', slot: 'head', colors: { main: '#6B4A2B', accent: '#E9C46A' }, draw: (c) => `<path d="M-34 -68Q-34 -96 0 -97Q34 -96 34 -68Q0 -76 -34 -68Z" fill="${c.main}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-30 -80Q0 -88 30 -80M-24 -90Q0 -95 24 -90" stroke="${c.accent}" stroke-width="2" fill="none" stroke-dasharray="3 3"/><ellipse cx="0" cy="-70" rx="9" ry="5" fill="${shade(c.main, -0.2)}" stroke="${INK}" stroke-width="2"/>` },
  topikoki: { label: 'Topi koki', slot: 'head', colors: { main: '#FFFFFF' }, draw: (c) => `<rect x="-24" y="-82" width="48" height="14" rx="3" fill="${c.main}" stroke="${INK}" stroke-width="3"/><path d="M-24 -82C-40 -86 -38 -112 -18 -108C-14 -122 14 -122 18 -108C38 -112 40 -86 24 -82Z" fill="${c.main}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-10 -82V-98M10 -82V-98" stroke="${shade(c.main, -0.15)}" stroke-width="2"/>` },
  mahkotaemas: { label: 'Mahkota emas', slot: 'head', colors: { main: '#F2B632', accent: '#E0583F' }, draw: (c) => `<path d="M-28 -70L-30 -98L-15 -84L0 -104L15 -84L30 -98L28 -70Z" fill="${c.main}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><circle cx="0" cy="-80" r="4.5" fill="${c.accent}" stroke="${INK}" stroke-width="2"/><circle cx="-17" cy="-76" r="3" fill="#7FA7D9" stroke="${INK}" stroke-width="1.6"/><circle cx="17" cy="-76" r="3" fill="#7FA7D9" stroke="${INK}" stroke-width="1.6"/>` },
  topipesta: { label: 'Topi pesta', slot: 'head', colors: { main: '#9A6FC0', accent: '#F2B632' }, draw: (c) => `<path d="M-18 -72L4 -114L22 -72Q2 -66 -18 -72Z" fill="${c.main}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-12 -82L14 -88M-6 -94L12 -98" stroke="${c.accent}" stroke-width="3"/><circle cx="4" cy="-115" r="6" fill="${c.accent}" stroke="${INK}" stroke-width="2.5"/>` },
  pita: { label: 'Pita rambut', slot: 'head', colors: { main: '#FF8FA3' }, draw: (c) => `<g transform="translate(18 -76) rotate(-15)"><path d="M0 0L-16 -10V10Z" fill="${c.main}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M0 0L16 -10V10Z" fill="${c.main}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><circle r="5" fill="${shade(c.main, -0.2)}" stroke="${INK}" stroke-width="2"/></g>` },
  headphone: { label: 'Headphone', slot: 'head', colors: { main: '#3F7FBF', accent: '#2B2F4A' }, draw: (c) => `<path d="M-42 -50Q-44 -96 0 -96Q44 -96 42 -50" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M-42 -50Q-44 -96 0 -96Q44 -96 42 -50" fill="none" stroke="${c.accent}" stroke-width="5" stroke-linecap="round"/><rect x="-54" y="-62" width="16" height="26" rx="7" fill="${c.main}" stroke="${INK}" stroke-width="3"/><rect x="38" y="-62" width="16" height="26" rx="7" fill="${c.main}" stroke="${INK}" stroke-width="3"/>` },
  baret: { label: 'Baret', slot: 'head', colors: { main: '#E0583F' }, draw: (c) => `<path d="M-36 -70Q-44 -96 -6 -98Q34 -100 34 -76Q20 -66 -36 -70Z" fill="${c.main}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-2 -98l2 -7" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>` },
  kacamata: { label: 'Kacamata bulat', slot: 'face', colors: { main: '#2B2F4A' }, draw: (c) => `<g stroke="${c.main}" stroke-width="2.6"><circle cx="-15" cy="-46" r="10" fill="rgba(255,255,255,.28)"/><circle cx="15" cy="-46" r="10" fill="rgba(255,255,255,.28)"/><path d="M-5 -47q5 -4 10 0" fill="none"/></g>` },
  kacamatahitam: { label: 'Kacamata hitam', slot: 'face', colors: { main: '#2B2F4A' }, draw: (c) => `<g stroke="${INK}" stroke-width="2.4"><path d="M-27 -52H-4L-6 -42Q-15 -36 -24 -42Z" fill="${c.main}"/><path d="M27 -52H4L6 -42Q15 -36 24 -42Z" fill="${c.main}"/><path d="M-4 -50H4" fill="none"/></g>` },
  kacamatabintang: { label: 'Kacamata bintang', slot: 'face', colors: { main: '#F2B632' }, draw: (c) => { const star = (x: number) => `<path d="M${x} -58l3.5 7.5 8 1-6 5.5 1.6 8-7.1-4-7.1 4 1.6-8-6-5.5 8-1Z" fill="${c.main}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`; return star(-15) + star(15) + `<path d="M-6 -48h12" stroke="${INK}" stroke-width="2.2"/>`; } },
  kacamatarenang: { label: 'Kacamata renang', slot: 'face', colors: { main: '#3FA06A', accent: '#BFE3F5' }, draw: (c) => `<path d="M-44 -48H44" stroke="${c.main}" stroke-width="5"/><ellipse cx="-15" cy="-47" rx="12" ry="9" fill="${c.accent}" stroke="${INK}" stroke-width="2.6"/><ellipse cx="15" cy="-47" rx="12" ry="9" fill="${c.accent}" stroke="${INK}" stroke-width="2.6"/><path d="M-20 -50l4 -3M10 -50l4 -3" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>` },
  kumis: { label: 'Kumis', slot: 'face', colors: { main: '#2B2F4A' }, draw: (c) => `<path d="M0 -41C-6 -45 -16 -44 -22 -38C-14 -38 -8 -36 0 -39C8 -36 14 -38 22 -38C16 -44 6 -45 0 -41Z" fill="${c.main}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>` },
  syal: { label: 'Syal motif', slot: 'neck', colors: { main: '#33508C', accent: '#F3E3B5' }, draw: (c) => `<path d="M-40 -30Q0 -14 40 -30L39 -21Q0 -5 -39 -21Z" fill="${c.main}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M20 -19L29 -1 19 1 14 -15Z" fill="${c.main}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><g fill="${c.accent}"><circle cx="-26" cy="-22" r="2"/><circle cx="-12" cy="-18" r="2"/><circle cx="2" cy="-17" r="2"/><circle cx="16" cy="-19" r="2"/><circle cx="30" cy="-23" r="2"/><circle cx="22" cy="-8" r="1.8"/></g>` },
  dasikupu: { label: 'Dasi kupu-kupu', slot: 'neck', colors: { main: '#E0583F' }, draw: (c) => `<path d="M0 -22L-16 -30V-14Z" fill="${c.main}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M0 -22L16 -30V-14Z" fill="${c.main}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="0" cy="-22" r="4" fill="${shade(c.main, -0.2)}" stroke="${INK}" stroke-width="2"/>` },
  kalung: { label: 'Kalung manik', slot: 'neck', colors: { main: '#F2B632' }, draw: (c) => `<path d="M-30 -27Q0 -12 30 -27" fill="none" stroke="${INK}" stroke-width="1.5"/>` + [-24, -12, 0, 12, 24].map((x) => `<circle cx="${x}" cy="${-19 - Math.abs(x) * 0.25}" r="4" fill="${c.main}" stroke="${INK}" stroke-width="1.8"/>`).join('') },
  kalungbunga: { label: 'Kalung bunga', slot: 'neck', colors: { main: '#FF8FA3', accent: '#F2B632' }, draw: (c) => [-30, -18, -6, 6, 18, 30].map((x, i) => { const y = -24 + (30 - Math.abs(x)) * 0.22; return `<g transform="translate(${x} ${y})">${[0, 72, 144, 216, 288].map((r) => `<ellipse cx="0" cy="-4" rx="3" ry="4.2" transform="rotate(${r})" fill="${i % 2 ? c.main : '#FFFFFF'}" stroke="${INK}" stroke-width="1.2"/>`).join('')}<circle r="2" fill="${c.accent}"/></g>`; }).join('') },
  dasi: { label: 'Dasi panjang', slot: 'neck', colors: { main: '#33508C', accent: '#E0583F' }, draw: (c) => `<path d="M-6 -26H6L4 -20L8 -4L0 4L-8 -4L-4 -20Z" fill="${c.main}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><path d="M-5 -14L5 -10M-6 -6L6 -2" stroke="${c.accent}" stroke-width="2"/>` },
  lonceng: { label: 'Kerah lonceng', slot: 'neck', colors: { main: '#E0583F', accent: '#F2B632' }, draw: (c) => `<path d="M-38 -30Q0 -16 38 -30" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M-38 -30Q0 -16 38 -30" fill="none" stroke="${c.main}" stroke-width="4.5" stroke-linecap="round"/><circle cx="0" cy="-14" r="7" fill="${c.accent}" stroke="${INK}" stroke-width="2.4"/><path d="M-4 -12H4M0 -12V-8" stroke="${INK}" stroke-width="1.6"/>` },
  sayapkupu: { label: 'Sayap kupu-kupu', slot: 'back', colors: { main: '#9FD0E8', accent: '#F2B632' }, draw: () => '', back: (c) => [-1, 1].map((s) => `<g transform="scale(${s} 1)"><path d="M20 -50C40 -96 84 -80 70 -54C62 -40 40 -42 26 -44Z" fill="${c.main}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M24 -40C46 -40 66 -30 56 -16C48 -6 34 -18 24 -30Z" fill="${shade(c.main, -0.12)}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><circle cx="54" cy="-66" r="6" fill="${c.accent}" stroke="${INK}" stroke-width="2"/></g>`).join('') },
  ransel: { label: 'Ransel', slot: 'back', colors: { main: '#E9A23B', accent: '#8A5A36' }, draw: (c) => `<path d="M-30 -62Q-36 -40 -32 -18M30 -62Q36 -40 32 -18" fill="none" stroke="${c.accent}" stroke-width="5" stroke-linecap="round"/>`, back: (c) => `<rect x="26" y="-70" width="34" height="50" rx="10" fill="${c.main}" stroke="${INK}" stroke-width="3"/><rect x="34" y="-52" width="22" height="18" rx="5" fill="${shade(c.main, -0.15)}" stroke="${INK}" stroke-width="2.4"/><rect x="-60" y="-70" width="34" height="50" rx="10" fill="${c.main}" stroke="${INK}" stroke-width="3"/>` },
  jubah: { label: 'Jubah', slot: 'back', colors: { main: '#C0392B', accent: '#F2B632' }, draw: (c) => `<circle cx="0" cy="-26" r="5" fill="${c.accent}" stroke="${INK}" stroke-width="2.2"/>`, back: (c) => `<path d="M-38 -44Q-60 -10 -54 0L54 0Q60 -10 38 -44Z" fill="${c.main}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` },
  // ---------- aksesori v0.27 ----------
  jubahbintang: { label: 'Jubah malam berbintang', slot: 'back', colors: { main: '#2B3A6B', accent: '#F2C94C' },
    draw: (c) => `<path d="M-30 -31Q0 -19 30 -31" fill="none" stroke="${c.accent}" stroke-width="3" stroke-linecap="round"/><path d="M0 -33l3 6.2 6.8.9-5 4.7 1.3 6.7L0 -17.7l-6.1 3.2 1.3-6.7-5-4.7 6.8-.9Z" fill="${c.accent}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`,
    back: (c) => `<path d="M-40 -48Q-70 -8 -62 3L62 3Q70 -8 40 -48Z" fill="${c.main}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-62 3Q0 12 62 3" fill="none" stroke="${shade(c.main, 0.25)}" stroke-width="3"/>` +
      [[-56, -6, 4], [55, -12, 3.5], [-50, -26, 3], [52, -32, 4.2], [-60, -14, 2], [60, -2, 2.4]].map(([x, y, r]) => `<path d="M${x} ${y - r}L${x + r * 0.35} ${y - r * 0.35}L${x + r} ${y}L${x + r * 0.35} ${y + r * 0.35}L${x} ${y + r}L${x - r * 0.35} ${y + r * 0.35}L${x - r} ${y}L${x - r * 0.35} ${y - r * 0.35}Z" fill="${c.accent}"/>`).join('') },
  jubahbatik: { label: 'Jubah batik parang', slot: 'back', colors: { main: '#7A4A26', accent: '#E9C46A' },
    draw: (c) => `<path d="M-30 -31Q0 -19 30 -31" fill="none" stroke="${c.accent}" stroke-width="3.5" stroke-linecap="round"/><circle cx="0" cy="-24" r="5.5" fill="${c.accent}" stroke="${INK}" stroke-width="2.2"/><circle cx="0" cy="-24" r="2" fill="${c.main}"/>`,
    back: (c) => `<clipPath id="kb-cape-b"><path d="M-40 -48Q-70 -8 -62 3L62 3Q70 -8 40 -48Z"/></clipPath><path d="M-40 -48Q-70 -8 -62 3L62 3Q70 -8 40 -48Z" fill="${c.main}"/>` +
      `<g clip-path="url(#kb-cape-b)" fill="none" stroke="${c.accent}" stroke-width="3" stroke-linecap="round">${[-90, -74, -58, -42, -26, -10, 6, 22, 38, 54, 70].map((x) => `<path d="M${x} 8q6 -8 2 -14t6 -14q6 -8 2 -14t6 -14q6 -8 2 -14"/>`).join('')}</g>` +
      `<path d="M-40 -48Q-70 -8 -62 3L62 3Q70 -8 40 -48Z" fill="none" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` },
  jashujan: { label: 'Jas hujan bertudung', slot: 'back', colors: { main: '#F2C230', accent: '#2B2F4A' },
    draw: (c) => `<path d="M-30 -31Q0 -21 30 -31" fill="none" stroke="${shade(c.main, -0.2)}" stroke-width="4" stroke-linecap="round"/>` + [-8, 8].map((x) => `<rect x="${x - 3}" y="-29" width="6" height="9" rx="2" fill="${c.accent}"/>`).join(''),
    back: (c) => `<path d="M-44 -54Q-50 -112 0 -114Q50 -112 44 -54Q0 -66 -44 -54Z" fill="${c.main}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-36 -60Q-40 -104 0 -106Q40 -104 36 -60" fill="none" stroke="${shade(c.main, -0.18)}" stroke-width="2.4"/>` +
      `<path d="M-40 -46Q-66 -8 -60 3L60 3Q66 -8 40 -46Z" fill="${c.main}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-56 -8L-48 -30M56 -8L48 -30" stroke="${shade(c.main, -0.18)}" stroke-width="2.4" stroke-linecap="round"/>` },
  jubahkerah: { label: 'Jubah kerah tinggi', slot: 'back', colors: { main: '#6A3FA0', accent: '#D7263D' },
    draw: (c) => `<path d="M-30 -31Q0 -20 30 -31" fill="none" stroke="${INK}" stroke-width="2.4"/><circle cx="-6" cy="-25" r="3.6" fill="#F2C94C" stroke="${INK}" stroke-width="1.8"/><circle cx="6" cy="-25" r="3.6" fill="#F2C94C" stroke="${INK}" stroke-width="1.8"/><path d="M-6 -25H6" stroke="#F2C94C" stroke-width="2"/>`,
    back: (c) => `<path d="M-40 -48Q-70 -8 -62 3L62 3Q70 -8 40 -48Z" fill="${c.main}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-60 -2Q-58 -20 -46 -40M60 -2Q58 -20 46 -40" fill="none" stroke="${c.accent}" stroke-width="5" stroke-linecap="round"/>` +
      [-1, 1].map((s) => `<path d="M${s * 34} -44L${s * 60} -96L${s * 46} -64L${s * 40} -88L${s * 22} -56Z" fill="${shade(c.main, -0.15)}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M${s * 40} -50L${s * 54} -84" stroke="${c.accent}" stroke-width="2.4" stroke-linecap="round"/>`).join('') },
  selendang: { label: 'Selendang penari', slot: 'back', colors: { main: '#E8578E', accent: '#F2C94C' },
    draw: (c) => `<path d="M-40 -32Q0 -14 40 -32L38 -22Q0 -6 -38 -22Z" fill="${c.main}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-36 -26Q0 -11 36 -26" fill="none" stroke="${c.accent}" stroke-width="2" stroke-dasharray="3 4"/>`,
    back: (c) => [-1, 1].map((s) => `<path d="M${s * 36} -30C${s * 70} -30 ${s * 54} -8 ${s * 74} 4L${s * 64} 10C${s * 46} -2 ${s * 58} -20 ${s * 34} -20Z" fill="${c.main}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M${s * 64} 10l${s * 2} 6M${s * 69} 7l${s * 3} 6M${s * 74} 4l${s * 4} 5" stroke="${c.accent}" stroke-width="2.6" stroke-linecap="round"/>`).join('') },
  sayapmerpati: { label: 'Sayap merpati', slot: 'back', colors: { main: '#FFFFFF', accent: '#C9D9EA' }, draw: () => '',
    back: (c) => [-1, 1].map((s) => `<g transform="scale(${s} 1)"><path d="M28 -56C46 -96 88 -110 100 -92C92 -88 100 -78 88 -72C94 -64 84 -56 74 -58C76 -48 62 -44 54 -48C52 -38 40 -36 32 -40Z" fill="${c.main}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M40 -62C56 -82 76 -94 94 -92M44 -54C60 -66 74 -72 86 -72M44 -46C56 -52 66 -56 74 -58" fill="none" stroke="${c.accent}" stroke-width="3" stroke-linecap="round"/></g>`).join('') },
  sayapcapung: { label: 'Sayap capung', slot: 'back', colors: { main: '#BFE9F2', accent: '#3F7FBF' }, draw: () => '',
    back: (c) => [-1, 1].map((s) => `<g transform="scale(${s} 1)"><path d="M28 -56C52 -84 96 -96 98 -84C98 -72 60 -58 30 -50Z" fill="${c.main}" fill-opacity=".8" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><path d="M30 -44C58 -50 96 -44 94 -32C90 -22 56 -32 30 -38Z" fill="${c.main}" fill-opacity=".8" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><path d="M34 -54C56 -70 78 -80 92 -84M34 -42C56 -42 76 -40 90 -36" fill="none" stroke="${c.accent}" stroke-width="1.6"/></g>`).join('') },
  bakul: { label: 'Bakul gendong', slot: 'back', colors: { main: '#D9A55B', accent: '#5FB36A' },
    draw: (c) => `<path d="M-32 -60Q-38 -40 -34 -20M32 -60Q38 -40 34 -20" fill="none" stroke="${shade(c.main, -0.35)}" stroke-width="5" stroke-linecap="round"/>`,
    back: (c) => `<path d="M30 -96c-4 -10 2 -16 8 -10M44 -98c2 -12 12 -10 10 0M54 -94c8 -8 14 0 6 6" fill="${c.accent}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><path d="M38 -100l4 -8" stroke="#E0583F" stroke-width="5" stroke-linecap="round"/>` +
      `<path d="M22 -92H68L62 -26Q45 -18 28 -26Z" fill="${c.main}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
      [-80, -66, -52, -38].map((y) => `<path d="M${26 + (y + 92) * 0.05} ${y}H${66 - (y + 92) * 0.06}" stroke="${shade(c.main, -0.25)}" stroke-width="2"/>`).join('') +
      [32, 42, 52, 60].map((x) => `<path d="M${x} -90L${x - 1} -28" stroke="${shade(c.main, -0.25)}" stroke-width="1.6"/>`).join('') +
      `<rect x="20" y="-96" width="50" height="8" rx="4" fill="${shade(c.main, -0.12)}" stroke="${INK}" stroke-width="2.6"/>` },
  tempurung: { label: 'Tempurung kura-kura', slot: 'back', colors: { main: '#5E9E54', accent: '#C9E3A6' }, draw: () => '',
    back: (c) => `<path d="M-60 -10Q-66 -72 0 -80Q66 -72 60 -10Q0 4 -60 -10Z" fill="${c.main}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
      `<g fill="none" stroke="${c.accent}" stroke-width="3" stroke-linejoin="round"><path d="M-60 -36L-50 -46L-50 -60M60 -36L50 -46L50 -60M-56 -16L-48 -28M56 -16L48 -28M-24 -74L-16 -80M24 -74L16 -80"/></g>` +
      `<path d="M-60 -10Q0 4 60 -10" fill="none" stroke="${shade(c.main, -0.25)}" stroke-width="5"/>` },
  udeng: { label: 'Udeng', slot: 'head', colors: { main: '#2B2F4A', accent: '#E9C46A' },
    draw: (c) => `<path d="M-38 -66Q0 -80 38 -66L36 -56Q0 -70 -36 -56Z" fill="${c.main}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
      [-26, -13, 0, 13, 26].map((x) => `<circle cx="${x}" cy="${-62 - (26 - Math.abs(x)) * 0.12}" r="1.8" fill="${c.accent}"/>`).join('') +
      `<path d="M-4 -72L-18 -98Q-4 -92 -2 -78Z" fill="${c.main}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-12 -92l4 6" stroke="${c.accent}" stroke-width="2"/>` },
  topipenyihir: { label: 'Topi penyihir', slot: 'head', colors: { main: '#5B3E96', accent: '#F2C94C' },
    draw: (c) => `<ellipse cx="0" cy="-70" rx="46" ry="9" fill="${c.main}" stroke="${INK}" stroke-width="3"/><path d="M-26 -72L-4 -118Q4 -128 18 -122Q8 -118 10 -110L26 -72Q0 -64 -26 -72Z" fill="${c.main}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M-25 -78Q0 -71 25 -78" fill="none" stroke="${c.accent}" stroke-width="5"/><path d="M4 -100l2.2 4.6 5 .7-3.6 3.4 .9 5-4.5-2.4-4.5 2.4 .9-5-3.6-3.4 5-.7Z" fill="${c.accent}" stroke="${INK}" stroke-width="1.6"/>` },
  bandomatahari: { label: 'Bando bunga matahari', slot: 'head', colors: { main: '#F2C230', accent: '#6B4A2B' },
    draw: (c) => `<path d="M-40 -60Q-38 -92 0 -94Q38 -92 40 -60" fill="none" stroke="#5FB36A" stroke-width="5" stroke-linecap="round"/>` +
      `<g transform="translate(24 -88)">${Array.from({ length: 10 }, (_, i) => `<ellipse cx="0" cy="-10" rx="4.5" ry="8" transform="rotate(${i * 36})" fill="${c.main}" stroke="${INK}" stroke-width="1.8"/>`).join('')}<circle r="7" fill="${c.accent}" stroke="${INK}" stroke-width="2"/></g>` },
  helm: { label: 'Helm proyek', slot: 'head', colors: { main: '#F2C230', accent: '#FFFFFF' },
    draw: (c) => `<path d="M-36 -70Q-36 -106 0 -106Q36 -106 36 -70Z" fill="${c.main}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-46 -68Q0 -76 46 -68L44 -62Q0 -70 -44 -62Z" fill="${shade(c.main, -0.12)}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M-6 -105H6V-72H-6Z" fill="${shade(c.main, 0.15)}" stroke="${INK}" stroke-width="2.2"/><path d="M-22 -96Q-26 -84 -24 -76" stroke="${c.accent}" stroke-width="3" stroke-linecap="round" opacity=".7"/>` },
  topiember: { label: 'Topi ember', slot: 'head', colors: { main: '#7FB3D5', accent: '#F2EEE3' },
    draw: (c) => `<path d="M-30 -74Q-30 -102 0 -102Q30 -102 30 -74Z" fill="${c.main}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-30 -76Q0 -82 30 -76L46 -62Q0 -74 -46 -62Z" fill="${shade(c.main, -0.1)}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M-29 -82Q0 -88 29 -82" fill="none" stroke="${c.accent}" stroke-width="4"/>` },
  mahkotadaun: { label: 'Mahkota daun', slot: 'head', colors: { main: '#5FB36A', accent: '#E0583F' },
    draw: (c) => `<path d="M-36 -68Q0 -80 36 -68" fill="none" stroke="${shade(c.main, -0.3)}" stroke-width="3"/>` +
      [-34, -24, -12, 0, 12, 24, 34].map((x, i) => { const y = -70 - (34 - Math.abs(x)) * 0.18; const r = (x < 0 ? -1 : 1) * (20 + i * 3); return `<path d="M${x} ${y}q-5 -10 0 -16q5 6 0 16Z" transform="rotate(${x === 0 ? 0 : r} ${x} ${y})" fill="${i % 2 ? c.main : shade(c.main, -0.15)}" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>`; }).join('') +
      [-18, 18].map((x) => `<circle cx="${x}" cy="-76" r="3.4" fill="${c.accent}" stroke="${INK}" stroke-width="1.6"/>`).join('') },
  toga: { label: 'Topi wisuda', slot: 'head', colors: { main: '#2B2F4A', accent: '#F2C94C' },
    draw: (c) => `<path d="M-24 -70Q0 -64 24 -70L24 -86Q0 -80 -24 -86Z" fill="${c.main}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-46 -92L0 -104L46 -92L0 -80Z" fill="${shade(c.main, 0.15)}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M0 -92L34 -86V-66" fill="none" stroke="${c.accent}" stroke-width="2.4"/><path d="M30 -68h8l-1 10h-6Z" fill="${c.accent}" stroke="${INK}" stroke-width="1.6"/><circle cx="0" cy="-92" r="3" fill="${c.accent}"/>` },
  topeng: { label: 'Topeng kayu', slot: 'face', colors: { main: '#FFF8EC', accent: '#D7263D' },
    draw: (c) => `<path fill-rule="evenodd" d="M-36 -48Q-36 -64 -18 -62Q0 -60 18 -62Q36 -64 36 -48Q36 -36 20 -36Q8 -36 0 -42Q-8 -36 -20 -36Q-36 -36 -36 -48ZM-23 -52a8 6 0 1 0 16 0a8 6 0 1 0 -16 0ZM7 -52a8 6 0 1 0 16 0a8 6 0 1 0 -16 0Z" fill="${c.main}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>` +
      `<path d="M-30 -58q8 -5 16 -2M30 -58q-8 -5 -16 -2" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/><path d="M-34 -44l6 2M34 -44l-6 2M0 -60v5" stroke="${c.accent}" stroke-width="3" stroke-linecap="round"/>` },
  kacamatahati: { label: 'Kacamata hati', slot: 'face', colors: { main: '#FF6B8A' },
    draw: (c) => { const h = (x: number) => `<path d="M${x} -38C${x - 14} -46 ${x - 14} -58 ${x - 6} -58C${x - 2} -58 ${x} -55 ${x} -52C${x} -55 ${x + 2} -58 ${x + 6} -58C${x + 14} -58 ${x + 14} -46 ${x} -38Z" fill="${c.main}" fill-opacity=".85" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`; return h(-15) + h(15) + `<path d="M-5 -51H5" stroke="${INK}" stroke-width="2.4"/>`; } },
  monokel: { label: 'Monokel', slot: 'face', colors: { main: '#F2C94C' },
    draw: (c) => `<circle cx="15" cy="-47" r="11" fill="rgba(255,255,255,.3)" stroke="${c.main}" stroke-width="3"/><circle cx="15" cy="-47" r="11" fill="none" stroke="${INK}" stroke-width="1.2"/><path d="M25 -42Q34 -30 30 -14" fill="none" stroke="${c.main}" stroke-width="1.8" stroke-dasharray="2.5 2"/>` },
  masker: { label: 'Masker batik', slot: 'face', colors: { main: '#3F7FBF', accent: '#F3E3B5' },
    draw: (c) => `<path d="M-38 -44L-22 -44Q0 -48 22 -44L38 -44M-38 -30L-22 -30M38 -30L22 -30" fill="none" stroke="${INK}" stroke-width="1.6"/><path d="M-22 -44Q0 -48 22 -44L22 -28Q0 -20 -22 -28Z" fill="${c.main}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>` +
      [[-12, -38], [0, -36], [12, -38], [-6, -30], [6, -30]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="none" stroke="${c.accent}" stroke-width="1.6"/>`).join('') },
  kalungkerang: { label: 'Kalung kerang', slot: 'neck', colors: { main: '#F6D6C2', accent: '#E8A87C' },
    draw: (c) => `<path d="M-30 -27Q0 -12 30 -27" fill="none" stroke="${INK}" stroke-width="1.5"/>` +
      [-22, -8, 8, 22].map((x) => { const y = -19 - Math.abs(x) * 0.22; return `<g transform="translate(${x} ${y})"><path d="M0 -4L-6 4Q0 8 6 4Z" fill="${c.main}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><path d="M0 -4V5M-3 0L-2 5M3 0L2 5" stroke="${c.accent}" stroke-width="1"/></g>`; }).join('') },
  medali: { label: 'Medali juara', slot: 'neck', colors: { main: '#F2C94C', accent: '#D7263D' },
    draw: (c) => `<path d="M-22 -30L-6 -12M22 -30L6 -12" stroke="${c.accent}" stroke-width="6" stroke-linecap="round"/><path d="M-22 -30L-6 -12M22 -30L6 -12" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="1 4"/>` +
      `<circle cx="0" cy="-6" r="10" fill="${c.main}" stroke="${INK}" stroke-width="2.6"/><path d="M0 -12l1.8 3.8 4.2.6-3 2.9.7 4.1L0 -2.6l-3.7 2 .7-4.1-3-2.9 4.2-.6Z" fill="${shade(c.main, -0.2)}"/>` },
  syalrajut: { label: 'Syal rajut belang', slot: 'neck', colors: { main: '#E0583F', accent: '#FFFFFF' },
    draw: (c) => `<path d="M-40 -32Q0 -16 40 -32L39 -21Q0 -5 -39 -21Z" fill="${c.main}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
      [-28, -14, 0, 14, 28].map((x) => `<path d="M${x} ${-28 + Math.abs(x) * 0.04}v${10 - Math.abs(x) * 0.08}" stroke="${c.accent}" stroke-width="4"/>`).join('') +
      `<path d="M22 -20L30 4L18 6L14 -16Z" fill="${c.main}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M17 -8L27 -10M15 -2L28 -4" stroke="${c.accent}" stroke-width="3.5"/><path d="M19 6v5M24 5v5M29 4v5" stroke="${c.main}" stroke-width="2.4" stroke-linecap="round"/>` },
  // ---------- slot "dibawa": dipegang di samping pet ----------
  balon: { label: 'Balon', slot: 'hand', colors: { main: '#E0583F', accent: '#FFFFFF' },
    draw: (c) => `<path d="M40 -24Q48 -46 44 -72" fill="none" stroke="${INK}" stroke-width="1.6"/><ellipse cx="45" cy="-92" rx="14" ry="17" fill="${c.main}" stroke="${INK}" stroke-width="2.8"/><path d="M41 -75l4 3 4 -3Z" fill="${c.main}" stroke="${INK}" stroke-width="1.6"/><ellipse cx="40" cy="-98" rx="3.2" ry="5.5" fill="${c.accent}" opacity=".6"/>` },
  lampion: { label: 'Lampion', slot: 'hand', colors: { main: '#D7263D', accent: '#F2C94C' },
    draw: (c) => `<path d="M40 -22Q50 -30 50 -46" fill="none" stroke="${shade(c.accent, -0.4)}" stroke-width="3" stroke-linecap="round"/><path d="M50 -46V-52" stroke="${INK}" stroke-width="1.6"/><rect x="42" y="-56" width="16" height="4" rx="2" fill="${c.accent}" stroke="${INK}" stroke-width="1.6"/><ellipse cx="50" cy="-70" rx="13" ry="15" fill="${c.main}" stroke="${INK}" stroke-width="2.6"/><path d="M50 -85V-55M42 -82Q38 -70 42 -58M58 -82Q62 -70 58 -58" fill="none" stroke="${shade(c.main, -0.25)}" stroke-width="1.6"/><rect x="42" y="-88" width="16" height="4" rx="2" fill="${c.accent}" stroke="${INK}" stroke-width="1.6"/><path d="M50 -55v8" stroke="${c.accent}" stroke-width="2.4"/><ellipse cx="50" cy="-70" rx="7" ry="9" fill="#FFE08A" opacity=".45"/>` },
  kincir: { label: 'Kincir kertas', slot: 'hand', colors: { main: '#3F7FBF', accent: '#F2C230' },
    draw: (c) => `<path d="M40 -20L46 -60" stroke="#8A5A36" stroke-width="3" stroke-linecap="round"/><g transform="translate(46 -64)">${[0, 90, 180, 270].map((r, i) => `<path d="M0 0L0 -16Q8 -14 10 -6Z" transform="rotate(${r})" fill="${i % 2 ? c.accent : c.main}" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>`).join('')}<circle r="2.6" fill="${INK}"/></g>` },
};
// Butik Benang v0.32: baju (slot body) + aksesori tambahan
Object.assign(WEAR, BODY_WEAR, EXTRA_WEAR);
// Kerja Sambilan: seragam tiap tempat kerja (didapat saat naik ke Karyawan)
Object.assign(WEAR, KERJA_WEAR);

const WEAR_IMG_BOX: Record<string, [number, number, number, number]> = {
  head: [-48, -112, 96, 52],
  face: [-34, -60, 68, 30],
  neck: [-44, -36, 88, 40],
  back: [-66, -100, 132, 100],
  hand: [30, -112, 36, 92],
  body: [-50, -42, 100, 40],
};

export interface PetLook {
  color: string;
  ear: string;
  pattern?: string;
  eyes?: string;
  tail?: string;
}

function wearParts(item: ItemLike): { front: string; behind: string } {
  const a = item.art;
  const slot = item.data?.slot ?? (a.type === 'builtin' ? WEAR[a.key]?.slot : 'head');
  if (a.type === 'image') {
    const url = safeUrl(a.url);
    if (!url) return { front: '', behind: '' };
    const [x, y, w, h] = WEAR_IMG_BOX[slot] ?? WEAR_IMG_BOX.head;
    const img = `<image href="${esc(url)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
    return slot === 'back' ? { front: '', behind: img } : { front: img, behind: '' };
  }
  const def = WEAR[a.key];
  if (!def) return { front: '', behind: '' };
  const c: Record<string, string> = {};
  for (const k of Object.keys(def.colors)) c[k] = col(a.colors?.[k], def.colors[k]);
  return { front: def.draw(c), behind: def.back ? def.back(c) : '' };
}

const slotOf = (item: ItemLike): string => item.data?.slot ?? (item.art.type === 'builtin' ? WEAR[item.art.key]?.slot : 'head') ?? 'head';
/** Baju (slot body): draw dipotong bentuk badan oleh pemanggil; back di belakang badan; over setelah kaki. */
function bodyParts(item: ItemLike): BodyParts {
  const a = item.art;
  if (a.type === 'image') {
    const url = safeUrl(a.url);
    const [x, y, w, h] = WEAR_IMG_BOX.body;
    return { back: '', over: '', draw: url ? `<image href="${esc(url)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>` : '' };
  }
  const def = WEAR[a.key];
  if (!def) return { back: '', draw: '', over: '' };
  const c: Record<string, string> = {};
  for (const k of Object.keys(def.colors)) c[k] = col(a.colors?.[k], def.colors[k]);
  return { back: def.back ? def.back(c) : '', draw: def.draw(c), over: def.over ? def.over(c) : '' };
}
/** Manekin Butik yang memajang satu baju (titik 0,0 = lantai). */
export const mannequinSVG = (item: ItemLike) => mannequin(bodyParts(item));

const BODY = 'M0 -78C30 -78 46 -56 46 -34C46 -14 28 -6 0 -6C-28 -6 -46 -14 -46 -34C-46 -56 -30 -78 0 -78Z';

function earsSVG(ear: string | undefined, color: string, dk: string): { behind: string; front: string } {
  const sw = `stroke="${INK}" stroke-width="3" stroke-linejoin="round"`;
  const pair = (s: string) => s + `<g transform="scale(-1 1)">${s}</g>`;
  switch (ear) {
    case 'kucing':
      return { behind: pair(`<path d="M-32 -60L-25 -94-5 -73Z" fill="${color}" ${sw}/><path d="M-25 -70L-23 -85-12 -73Z" fill="#FF9FB2"/>`), front: '' };
    case 'kelinci':
      return { behind: pair(`<ellipse cx="-15" cy="-92" rx="8.5" ry="25" transform="rotate(-12 -15 -92)" fill="${color}" ${sw}/><ellipse cx="-15" cy="-90" rx="3.6" ry="15" transform="rotate(-12 -15 -90)" fill="#FF9FB2"/>`), front: '' };
    case 'bulat':
      return { behind: pair(`<circle cx="-30" cy="-68" r="13" fill="${color}" ${sw}/><circle cx="-30" cy="-68" r="6" fill="#FF9FB2"/>`), front: '' };
    case 'anjing':
      return { behind: '', front: pair(`<path d="M-30 -70C-52 -72 -58 -44 -48 -30C-42 -24 -34 -32 -32 -44Z" fill="${dk}" ${sw}/>`) };
    case 'tanduk':
      return { behind: pair(`<path d="M-30 -66Q-36 -96 -24 -112Q-22 -94 -10 -76Z" fill="#F3E3B5" ${sw}/><path d="M-29 -84l8 2M-28 -94l6 2" stroke="${shade('#F3E3B5', -0.35)}" stroke-width="2"/>`), front: '' };
    case 'rubah':
      return { behind: pair(`<path d="M-38 -56L-30 -108L-6 -74Z" fill="${color}" ${sw}/><path d="M-31 -98L-27 -108L-22 -96Z" fill="${INK}"/><path d="M-30 -72L-28 -94L-14 -76Z" fill="${shade(color, 0.5)}"/>`), front: '' };
    case 'antena':
      return { behind: pair(`<path d="M-10 -76Q-14 -96 -26 -104" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><circle cx="-27" cy="-105" r="6" fill="${dk}" stroke="${INK}" stroke-width="2.5"/>`), front: '' };
    case 'bunga':
      return {
        behind: `<path d="M2 -76C2 -86 4 -90 6 -94" stroke="#3E8E4E" stroke-width="3.5" fill="none" stroke-linecap="round"/>` +
          [0, 72, 144, 216, 288].map((r) => `<ellipse cx="6" cy="-109" rx="6" ry="9" transform="rotate(${r} 6 -100)" fill="#FFFFFF" stroke="${INK}" stroke-width="2.2"/>`).join('') +
          `<circle cx="6" cy="-100" r="5" fill="#F2B632" stroke="${INK}" stroke-width="2"/>`,
        front: '',
      };
    default:
      return { behind: `<path d="M0 -76C0 -86 2 -92 4 -98" stroke="#3E8E4E" stroke-width="3.5" fill="none" stroke-linecap="round"/><ellipse cx="-8" cy="-100" rx="11" ry="6" transform="rotate(-25 -8 -100)" fill="#7CC57D" stroke="${INK}" stroke-width="2.5"/><ellipse cx="14" cy="-104" rx="12" ry="6.5" transform="rotate(20 14 -104)" fill="#5DB36A" stroke="${INK}" stroke-width="2.5"/>`, front: '' };
  }
}

function patternSVG(pattern: string | undefined, color: string) {
  const d = shade(color, -0.2), l = shade(color, 0.55);
  let inner = '';
  switch (pattern) {
    case 'totol': inner = [[-30, -60, 6], [24, -66, 5], [34, -40, 7], [-36, -36, 5], [-8, -70, 4], [12, -52, 3.5]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${d}"/>`).join(''); break;
    case 'belang': inner = `<path d="M-14 -80Q-10 -70 -18 -62M0 -82Q4 -72 -2 -64M14 -80Q18 -70 12 -62" fill="none" stroke="${d}" stroke-width="5" stroke-linecap="round"/><path d="M-48 -44Q-38 -42 -36 -34M48 -44Q38 -42 36 -34" fill="none" stroke="${d}" stroke-width="5" stroke-linecap="round"/>`; break;
    case 'topeng': inner = `<path d="M-38 -54Q-15 -64 0 -54Q15 -64 38 -54Q40 -40 26 -38Q15 -44 0 -42Q-15 -44 -26 -38Q-40 -40 -38 -54Z" fill="${d}"/>`; break;
    case 'ujung': inner = `<path d="M-50 -48Q0 -40 50 -48V-90H-50Z" fill="${d}"/>`; break;
    case 'bintang': inner = [[-30, -62, 1.6], [28, -60, 1.3], [-36, -32, 1.1], [36, -34, 1.4], [6, -70, 1]].map(([x, y, s]) => `<path d="M0 -6L1.8 -1.8 6 0 1.8 1.8 0 6 -1.8 1.8 -6 0 -1.8 -1.8Z" transform="translate(${x} ${y}) scale(${s})" fill="#FFF6C9" stroke="${shade(color, -0.25)}" stroke-width="0.8"/>`).join(''); break;
    default: return '';
  }
  return `<g clip-path="url(#kb-body)">${inner}</g>`;
}

function eyesSVG(eyes: string | undefined, color: string) {
  switch (eyes) {
    case 'senyum':
      return `<g class="eyes"><path d="M-21 -45q6 -8 12 0M9 -45q6 -8 12 0" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/></g>`;
    case 'berbinar':
      return `<g class="eyes"><circle cx="-15" cy="-46" r="7.5" fill="${INK}"/><circle cx="15" cy="-46" r="7.5" fill="${INK}"/><circle cx="-12.5" cy="-49" r="2.8" fill="#fff"/><circle cx="17.5" cy="-49" r="2.8" fill="#fff"/><circle cx="-17" cy="-43" r="1.4" fill="#fff"/><circle cx="13" cy="-43" r="1.4" fill="#fff"/></g>`;
    case 'sayu':
      return `<g class="eyes"><circle cx="-15" cy="-45" r="6" fill="${INK}"/><circle cx="15" cy="-45" r="6" fill="${INK}"/><path d="M-22 -46H-8V-53H-22ZM8 -46H22V-53H8Z" fill="${color}"/><path d="M-22 -46H-8M8 -46H22" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/></g>`;
    case 'bintang':
      return `<g class="eyes">${[-15, 15].map((x) => `<path d="M${x} -54l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8Z" fill="${INK}"/><circle cx="${x + 1.5}" cy="-48" r="1.4" fill="#fff"/>`).join('')}</g>`;
    default:
      return `<g class="eyes"><circle cx="-15" cy="-46" r="6" fill="${INK}"/><circle cx="15" cy="-46" r="6" fill="${INK}"/><circle cx="-13" cy="-48" r="2" fill="#fff"/><circle cx="17" cy="-48" r="2" fill="#fff"/></g>`;
  }
}

function tailSVG(tail: string | undefined, lt: string, dk: string) {
  switch (tail) {
    case 'keriting': return `<path d="M38 -20C52 -20 56 -34 46 -38C38 -41 34 -32 41 -29" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M38 -20C52 -20 56 -34 46 -38C38 -41 34 -32 41 -29" fill="none" stroke="${lt}" stroke-width="4.5" stroke-linecap="round"/>`;
    case 'lebat': return `<path d="M38 -16C54 -14 66 -30 62 -52C60 -64 50 -66 48 -56C46 -44 44 -34 34 -28Z" fill="${lt}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M52 -54q4 10 -2 20M44 -40q4 6 0 12" stroke="${dk}" stroke-width="2" fill="none" opacity=".55"/>`;
    case 'daun': return `<path d="M38 -20Q46 -46 62 -46Q58 -24 38 -20Z" fill="#7CC57D" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><path d="M40 -22Q50 -34 58 -42" stroke="#3E8E4E" stroke-width="1.8" fill="none"/>`;
    default: return `<circle cx="40" cy="-22" r="9" fill="${lt}" stroke="${INK}" stroke-width="3"/>`;
  }
}

/** Keadaan tubuh yang ikut digambar: suasana hati (wajah), seberapa kotor, seberapa gembul. */
export interface PetStateLook { mood?: string; dirt?: number; chub?: number }

const MOUTH_RED = '#8E3B46';
function mouthSVG(mood: string) {
  const sw = `stroke="${INK}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"`;
  const open = `<ellipse cx="0" cy="-34" rx="8.5" ry="7.5" fill="${MOUTH_RED}" ${sw}/><ellipse cx="0" cy="-30" rx="5" ry="2.8" fill="#FF8FA3"/>`;
  let base: string;
  switch (mood) {
    case 'senang': base = `<path d="M-9 -38Q0 -25 9 -38Z" fill="${MOUTH_RED}" ${sw}/><path d="M-4.5 -32.5q4.5 3 9 0" fill="#FF8FA3"/>`; break;
    case 'lapar': case 'bosan': base = `<path d="M-7 -35h14" fill="none" ${sw}/>`; break;
    case 'sakit': base = `<path d="M-9 -35q2.2 -2.4 4.5 0t4.5 0t4.5 0t4.5 0" fill="none" ${sw}/>`; break;
    case 'tidur': base = `<ellipse cx="1" cy="-35" rx="3" ry="2.4" fill="${MOUTH_RED}" stroke="${INK}" stroke-width="1.8"/>`; break;
    default: base = `<path d="M-7 -37q3.5 4 7 0q3.5 4 7 0" fill="none" ${sw}/>`;
  }
  // m-open: mulut mangap saat disuapi; m-yawn: menguap berkala saat capek (diatur CSS game)
  return `<g class="m-base">${base}</g><g class="m-open" display="none">${open}</g>${mood === 'capek' ? `<g class="m-yawn" opacity="0">${open}</g>` : ''}`;
}

function dirtSVG(dirt: number) {
  if (dirt < 0.05) return '';
  const spots = [[-28, -58, 7, 5], [22, -64, 6, 4], [30, -30, 8, 5], [-34, -26, 6, 4], [4, -72, 5, 3.5]].slice(0, Math.ceil(dirt * 5));
  let o = `<g clip-path="url(#kb-body)" opacity=".6">${spots.map(([x, y, rx, ry], i) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${i * 37} ${x} ${y})" fill="#8B6B4A"/>`).join('')}</g>`;
  if (dirt > 0.6) {
    o += `<path d="M-40 -88q-4 -6 0 -12t0 -12M44 -84q-4 -6 0 -12t0 -12" fill="none" stroke="#9AA7B8" stroke-width="2.2" stroke-linecap="round" opacity=".8"/>`;
    o += [[0, 1.9], [180, 2.7]].map(([a, d]) => `<g><g transform="translate(0 -96)"><ellipse rx="3.2" ry="2.6" fill="${INK}"/><ellipse cx="-1.5" cy="-3" rx="2.4" ry="1.6" fill="#FFFFFF" opacity=".85"/></g><animateTransform attributeName="transform" type="rotate" from="${a} 0 -62" to="${a + 360} 0 -62" dur="${d}s" repeatCount="indefinite"/></g>`).join('');
  }
  return o;
}

/** Pet digambar dengan titik (0,0) di bawah kaki. Lebar ±100, tinggi ±110. */
export function renderPet(look: PetLook, wear: ItemLike[] = [], st: PetStateLook = {}) {
  const color = col(look.color, '#F6B7A8');
  const dk = shade(color, -0.22), lt = shade(color, 0.5);
  const ears = earsSVG(look.ear, color, dk);
  const order: Record<string, number> = { back: 0, neck: 1, face: 2, head: 3, hand: 4 };
  // baju punya lapisan sendiri: di atas bulu, di bawah garis tepi, kaki, telinga terkulai & semua aksesori depan
  const cloth = wear.find((w) => slotOf(w) === 'body');
  const bp = cloth ? bodyParts(cloth) : null;
  const parts = wear.filter((w) => w !== cloth).sort((a, b) => (order[a.data?.slot] ?? 1) - (order[b.data?.slot] ?? 1)).map(wearParts);
  const mood = st.mood ?? 'biasa';
  const lid = look.pattern === 'topeng' || look.pattern === 'ujung' ? shade(color, -0.2) : color;
  const chub = Math.max(0, Math.min(1, st.chub ?? 0));
  const eyes = mood === 'tidur'
    ? `<g class="eyes-closed"><path d="M-21 -46q6 5 12 0M9 -46q6 5 12 0" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/></g>`
    : eyesSVG(look.eyes, lid);
  const lids = (mood === 'capek' || mood === 'sakit') && look.eyes !== 'senyum' && look.eyes !== 'sayu'
    ? `<path d="M-23 -55H-7V-46.5H-23ZM7 -55H23V-46.5H7Z" fill="${lid}"/><path d="M-22 -46.5H-8M8 -46.5H22" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>` : '';
  const tears = mood === 'lapar'
    ? [-15, 15].map((x, i) => `<path d="M${x} -40q-3.4 6 0 9q3.4 -3 0 -9Z" fill="#7FC4E8" stroke="${INK}" stroke-width="1.2"><animateTransform attributeName="transform" type="translate" values="0 0;0 7;0 0" dur="${1.6 + i * 0.3}s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0.2;1" dur="${1.6 + i * 0.3}s" repeatCount="indefinite"/></path>`).join('') : '';
  const sick = mood === 'sakit'
    ? `<path d="M-23 -77Q0 -84 23 -77L21 -66Q0 -72 -21 -66Z" fill="#FFFFFF" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><path d="M-14 -76v7M-4 -78v7M6 -78v7M16 -76v7" stroke="#9FD0E8" stroke-width="1.6"/><path d="M36 -62q-4 6 0 9q4 -3 0 -9Z" fill="#BFE3F5" stroke="${INK}" stroke-width="1.2"/>` : '';
  const blush = mood === 'senang' ? 1 : mood === 'sakit' ? 0.25 : 0.7;
  return (
    `<defs><clipPath id="kb-body"><path d="${BODY}"/></clipPath></defs>` +
    `<g class="pm pm-${esc(mood)}"${chub > 0.01 ? ` transform="scale(${f1((1 + 0.2 * chub) * 100) / 100} ${f1((1 - 0.05 * chub) * 100) / 100})"` : ''}>` +
    `<ellipse cx="0" cy="-2" rx="36" ry="7" fill="#000" opacity=".13"/>` +
    parts.map((p) => p.behind).join('') +
    tailSVG(look.tail, lt, dk) +
    ears.behind +
    (bp ? `<g class="w-body-back">${bp.back}</g>` : '') +
    `<path d="${BODY}" fill="${color}"/>` +
    patternSVG(look.pattern, color) +
    (bp ? `<g class="w-body" clip-path="url(#kb-body)">${bp.draw}</g>` : '') +
    `<path d="${BODY}" fill="none" stroke="${INK}" stroke-width="3.5"/>` +
    (bp ? '' : `<ellipse cx="0" cy="-23" rx="24" ry="13" fill="${lt}" opacity=".85"/>`) +
    `<ellipse cx="-18" cy="-6" rx="12" ry="7" fill="${dk}" stroke="${INK}" stroke-width="3"/><ellipse cx="18" cy="-6" rx="12" ry="7" fill="${dk}" stroke="${INK}" stroke-width="3"/>` +
    (bp?.over ? `<g class="w-body-over">${bp.over}</g>` : '') +
    dirtSVG(st.dirt ?? 0) +
    ears.front +
    `<g class="look">${eyes}</g>` + lids + tears +
    `<ellipse cx="-28" cy="-35" rx="${blush === 1 ? 8.5 : 7}" ry="${blush === 1 ? 5 : 4}" fill="#FF8FA3" opacity="${blush}"/><ellipse cx="28" cy="-35" rx="${blush === 1 ? 8.5 : 7}" ry="${blush === 1 ? 5 : 4}" fill="#FF8FA3" opacity="${blush}"/>` +
    mouthSVG(mood) +
    sick +
    parts.map((p) => p.front).join('') +
    `</g>`
  );
}

export const PET_VIEWBOX = '-66 -124 132 130';
export function petSVG(look: PetLook, wear: ItemLike[] = [], cls = '', st?: PetStateLook) {
  return `<svg viewBox="${PET_VIEWBOX}" class="${cls}" aria-hidden="true">${renderPet(look, wear, st)}</svg>`;
}

/* ------------------------------------------------------------------ */
/* Small icons: food, seed, fish, material                              */
/* ------------------------------------------------------------------ */

const plate = `<ellipse cx="32" cy="42" rx="25" ry="7" fill="#FFFFFF" stroke="${INK}" stroke-width="2.5"/>`;
type IconFn = (c: Record<string, string>, p: Record<string, number>) => string;
const ICONS: Record<string, { label: string; kinds: ItemKind[]; colors: Record<string, string>; draw: IconFn }> = {
  pisang: { label: 'Pisang goreng', kinds: ['food'], colors: { main: '#E8B04B' }, draw: (c) => plate + `<g stroke="${INK}" stroke-width="2.2"><rect x="12" y="24" width="26" height="12" rx="6" fill="${c.main}" transform="rotate(-14 25 30)"/><rect x="26" y="22" width="26" height="12" rx="6" fill="${shade(c.main, -0.12)}" transform="rotate(10 39 28)"/></g>` },
  tumpeng: { label: 'Tumpeng', kinds: ['food'], colors: { main: '#F2C94C' }, draw: (c) => plate + `<path d="M14 40L32 8 50 40Z" fill="${c.main}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M10 40Q32 30 54 40" fill="#5DB36A" stroke="${INK}" stroke-width="2.2"/><circle cx="32" cy="10" r="3" fill="#E0583F" stroke="${INK}" stroke-width="1.5"/>` },
  gelas: { label: 'Minuman gelas', kinds: ['food'], colors: { main: '#7CC57D', accent: '#8C5A2B' }, draw: (c) => `<path d="M20 10H44L40 46H24Z" fill="#F4EEE2"/><path d="M22.6 27H41.4L40 46H24Z" fill="${c.accent}"/><path d="M21.6 18H42.4L41.4 27H22.6Z" fill="${c.main}"/><g fill="${shade(c.main, -0.35)}"><circle cx="28" cy="21" r="1.6"/><circle cx="35" cy="23" r="1.6"/><circle cx="31" cy="31" r="1.6"/></g><path d="M20 10H44L40 46H24Z" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>` },
  bola3: { label: 'Kue bulat (3)', kinds: ['food'], colors: { main: '#58A55C', accent: '#FFFFFF' }, draw: (c) => plate + `<g stroke="${INK}" stroke-width="2.2" fill="${c.main}"><circle cx="21" cy="34" r="8"/><circle cx="43" cy="34" r="8"/><circle cx="32" cy="24" r="8"/></g><g fill="${c.accent}"><circle cx="19" cy="31" r="1.3"/><circle cx="45" cy="31" r="1.3"/><circle cx="30" cy="21" r="1.3"/><circle cx="34" cy="26" r="1.3"/></g>` },
  mangkuk: { label: 'Mangkuk', kinds: ['food'], colors: { main: '#E9A23B', accent: '#FFFFFF' }, draw: (c) => `<ellipse cx="32" cy="22" rx="22" ry="7" fill="${c.main}" stroke="${INK}" stroke-width="2.2"/><path d="M10 22Q12 46 32 46Q52 46 54 22" fill="${c.accent}" stroke="${INK}" stroke-width="2.5"/><path d="M24 16q2 -6 0 -10M34 15q2 -6 0 -10" stroke="${INK}" stroke-width="1.6" fill="none" opacity=".5"/>` },
  buah: { label: 'Buah bulat', kinds: ['food'], colors: { main: '#E0583F', accent: '#3FA06A' }, draw: (c) => `<circle cx="32" cy="30" r="16" fill="${c.main}" stroke="${INK}" stroke-width="2.5"/><path d="M32 14q4 -6 10 -5q-2 7 -10 5Z" fill="${c.accent}" stroke="${INK}" stroke-width="2"/><ellipse cx="26" cy="24" rx="4" ry="2.5" fill="#fff" opacity=".6"/>` },
  jagung: { label: 'Jagung', kinds: ['food'], colors: { main: '#F2C94C', accent: '#7CC57D' }, draw: (c) => `<ellipse cx="32" cy="27" rx="9" ry="19" fill="${c.main}" stroke="${INK}" stroke-width="2.4"/><path d="M27 18h10M26 25h12M26 32h12M27 39h10" stroke="${shade(c.main, -0.25)}" stroke-width="1.6"/><path d="M32 47C18 44 16 30 20 22Q26 34 32 47Z" fill="${c.accent}" stroke="${INK}" stroke-width="2.2"/><path d="M32 47C46 44 48 30 44 22Q38 34 32 47Z" fill="${shade(c.accent, -0.12)}" stroke="${INK}" stroke-width="2.2"/>` },
  kue: { label: 'Potongan kue', kinds: ['food'], colors: { main: '#F7DCE4', accent: '#E0583F' }, draw: (c) => plate + `<path d="M14 38L50 38 50 24 14 30Z" fill="${c.main}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><path d="M14 30L50 24 40 18 14 26Z" fill="${shade(c.main, 0.4)}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/><circle cx="38" cy="19" r="4" fill="${c.accent}" stroke="${INK}" stroke-width="1.8"/>` },
  eskrim: { label: 'Es krim cone', kinds: ['food'], colors: { main: '#FF8FA3', accent: '#8FD3C1' }, draw: (c) => `<path d="M22 26L32 50L42 26Z" fill="#E3B370" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><path d="M26 32l10 8M30 28l8 6M28 40l4 -6" stroke="#B98B4E" stroke-width="1.4"/><circle cx="27" cy="22" r="8" fill="${c.accent}" stroke="${INK}" stroke-width="2.2"/><circle cx="37" cy="20" r="8.5" fill="${c.main}" stroke="${INK}" stroke-width="2.2"/><circle cx="35" cy="10" r="3" fill="#E0583F" stroke="${INK}" stroke-width="1.5"/>` },
  donat: { label: 'Donat', kinds: ['food'], colors: { main: '#D9A066', accent: '#F7A8C4' }, draw: (c) => plate + `<ellipse cx="32" cy="32" rx="19" ry="12" fill="${c.main}" stroke="${INK}" stroke-width="2.4"/><path d="M15 30Q16 20 32 20Q48 20 49 30Q45 36 40 33Q36 38 32 34Q27 38 23 33Q18 36 15 30Z" fill="${c.accent}" stroke="${INK}" stroke-width="2"/><ellipse cx="32" cy="29" rx="6" ry="3.2" fill="#FFFFFF" stroke="${INK}" stroke-width="2"/><path d="M22 26l2 -1M40 25l2 1M28 23l1 2M37 32l2 -1" stroke="#3F7FBF" stroke-width="2" stroke-linecap="round"/>` },
  sate: { label: 'Sate', kinds: ['food'], colors: { main: '#A8622C', accent: '#6B3E1E' }, draw: (c) => plate + [0, 1, 2].map((i) => `<g transform="translate(${i * 7 - 7} ${i * 2})"><path d="M14 40L50 18" stroke="#C8955A" stroke-width="2.4" stroke-linecap="round"/>${[0, 1, 2, 3].map((k) => `<rect x="${20 + k * 7}" y="${30 - k * 4.4}" width="7" height="7" rx="2" transform="rotate(-31 ${23.5 + k * 7} ${33.5 - k * 4.4})" fill="${k % 2 ? c.accent : c.main}" stroke="${INK}" stroke-width="1.4"/>`).join('')}</g>`).join('') },
  martabak: { label: 'Martabak', kinds: ['food'], colors: { main: '#E3B370', accent: '#6B3E1E' }, draw: (c) => plate + `<path d="M14 36L20 22H44L50 36Z" fill="${c.main}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><path d="M17 29H47" stroke="${c.accent}" stroke-width="3"/><path d="M26 22L24 36M38 22L40 36" stroke="${INK}" stroke-width="1.6"/><path d="M22 25l1 -1M33 25l1 1M42 26l1 -1" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round"/>` },
  roti: { label: 'Roti', kinds: ['food'], colors: { main: '#E3B370' }, draw: (c) => plate + `<path d="M12 38Q10 18 32 16Q54 18 52 38Z" fill="${c.main}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><path d="M22 24l4 6M30 21l4 6M38 22l4 6" stroke="${shade(c.main, -0.3)}" stroke-width="2" stroke-linecap="round"/>` },
  stroberi: { label: 'Stroberi', kinds: ['food'], colors: { main: '#E0583F', accent: '#3FA06A' }, draw: (c) => `<path d="M32 48C18 40 14 26 20 20Q32 14 44 20C50 26 46 40 32 48Z" fill="${c.main}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M22 18L28 22L32 14L36 22L42 18L38 24H26Z" fill="${c.accent}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><g fill="#FCE3A3"><circle cx="26" cy="28" r="1.4"/><circle cx="34" cy="27" r="1.4"/><circle cx="40" cy="31" r="1.4"/><circle cx="29" cy="35" r="1.4"/><circle cx="36" cy="38" r="1.4"/></g>` },
  ketupat: { label: 'Ketupat', kinds: ['food'], colors: { main: '#9CCB5A' }, draw: (c) => plate + `<path d="M32 12L48 28L32 44L16 28Z" fill="${c.main}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M24 20L40 36M28 16L44 32M20 24L36 40M40 20L24 36M36 16L20 32M44 24L28 40" stroke="${shade(c.main, -0.3)}" stroke-width="1.4"/><path d="M32 12q-4 -6 -10 -6M32 12q4 -7 11 -6" fill="none" stroke="${shade(c.main, -0.2)}" stroke-width="2" stroke-linecap="round"/>` },
  // params.pic: gambar hasil panen di jendela bungkus (indeks SEED_PICS, art-kebun.ts)
  bibit: { label: 'Bungkus bibit', kinds: ['seed'], colors: { main: '#C8955A', accent: '#3FA06A' }, draw: (c, p) => p.pic ? seedPacket(c as any, seedPic(p.pic)) : `<path d="M18 12H46L44 46H20Z" fill="${c.main}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M18 12L22 18 26 12 30 18 34 12 38 18 42 12 46 12" fill="none" stroke="${INK}" stroke-width="2"/><path d="M32 40V28" stroke="${INK}" stroke-width="2.5"/><ellipse cx="26" cy="28" rx="6" ry="3.5" transform="rotate(-25 26 28)" fill="${c.accent}" stroke="${INK}" stroke-width="2"/><ellipse cx="38" cy="26" rx="6" ry="3.5" transform="rotate(25 38 26)" fill="${shade(c.accent, -0.15)}" stroke="${INK}" stroke-width="2"/>` },
  ikan: { label: 'Ikan', kinds: ['fish'], colors: { main: '#F2994A', accent: '#E0583F' }, draw: (c, p) => `<path d="M48 26L60 16V36Z" fill="${c.accent}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><ellipse cx="30" cy="26" rx="21" ry="12" fill="${c.main}" stroke="${INK}" stroke-width="2.5"/><path d="M28 14q6 -6 12 0" fill="${c.accent}" stroke="${INK}" stroke-width="2"/>${p.stripes ? `<path d="M26 16v20M34 15v22" stroke="${shade(c.main, -0.3)}" stroke-width="2.4"/>` : ''}${p.spots ? `<path d="M22 18q6 -2 9 4q-4 5 -10 1Z M34 26q6 -3 8 3q-3 5 -9 2Z M26 31q4 -1 5 3q-3 2 -6 0Z" fill="${c.accent}"/>` : ''}<circle cx="16" cy="23" r="3" fill="${INK}"/><circle cx="15" cy="22" r="1" fill="#fff"/>` },
  bunga: { label: 'Bunga', kinds: ['material'], colors: { main: '#FFFFFF', accent: '#F2B632' }, draw: (c) => `<path d="M32 46V30" stroke="#3E8E4E" stroke-width="3"/>` + [0, 72, 144, 216, 288].map((r) => `<ellipse cx="32" cy="14" rx="5.5" ry="9" transform="rotate(${r} 32 24)" fill="${c.main}" stroke="${INK}" stroke-width="2"/>`).join('') + `<circle cx="32" cy="24" r="4.5" fill="${c.accent}" stroke="${INK}" stroke-width="1.8"/>` },
  sandal: { label: 'Sandal jepit', kinds: ['material'], colors: { main: '#3F7FBF' }, draw: (c) => `<ellipse cx="32" cy="28" rx="13" ry="21" transform="rotate(-20 32 28)" fill="${c.main}" stroke="${INK}" stroke-width="2.5"/><path d="M28 14L24 30M28 14L38 26" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>` },
  koin: { label: 'Kantong koin', kinds: ['material'], colors: { main: '#F2B632' }, draw: (c) => `<path d="M20 22Q14 44 32 46Q50 44 44 22Z" fill="#C8955A" stroke="${INK}" stroke-width="2.5"/><path d="M24 22L28 14H36L40 22" fill="#C8955A" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="32" cy="34" r="7" fill="${c.main}" stroke="${INK}" stroke-width="2"/>` },
};

// ikon hasil kebun & pupuk (art-kebun.ts) ikut terdaftar sebagai bentuk bawaan
Object.assign(ICONS, KEBUN_ICONS);
function seedPic(i: number) {
  const d = ICONS[SEED_PICS[i] ?? ''];
  return d ? d.draw(d.colors, {}) : '';
}

/** Pendaftaran gambar dari modul lain (mis. art-ikan.ts): ikon kecil 64×52 & mebel isometrik. */
export type IconDef = { label: string; kinds: ItemKind[]; colors: Record<string, string>; draw: IconFn };
export type FurnDef = { label: string; colors: Record<string, string>; draw: FurnFn };
export function registerArt(icons: Record<string, IconDef>, furn: Record<string, FurnDef> = {}, props: Record<string, string> = {}) {
  Object.assign(ICONS, icons);
  Object.assign(FURN, furn);
  // properti yang dipegang pet (art-alun.ts: angklung, kuda lumping, gondola, ...)
  Object.assign(PROPS, props);
}

/* ------------------------------------------------------------------ */
/* Wallpaper & floor                                                    */
/* ------------------------------------------------------------------ */

const WALLS: Record<string, { label: string; colors: Record<string, string> }> = {
  garis: { label: 'Garis tegak', colors: { main: '#F3DFB8', accent: '#E6CFA2' } },
  titik: { label: 'Titik-titik', colors: { main: '#DCE9F5', accent: '#B9CFE6' } },
  polos: { label: 'Polos', colors: { main: '#EEF7E8', accent: '#D6E9CB' } },
  kotak: { label: 'Kotak-kotak', colors: { main: '#FBE3D3', accent: '#EBC2A8' } },
  bata: { label: 'Bata ekspos', colors: { main: '#D98E6A', accent: '#B5694A' } },
};
const FLOORS: Record<string, { label: string; colors: Record<string, string> }> = {
  papan: { label: 'Papan kayu', colors: { main: '#C48A55', accent: '#B47B48' } },
  tegel: { label: 'Tegel catur', colors: { main: '#E9E4D6', accent: '#C9C2B0' } },
  teraso: { label: 'Teraso', colors: { main: '#E6E1D8', accent: '#A9A196' } },
  karpet: { label: 'Karpet lembut', colors: { main: '#9FB8D9', accent: '#8AA6CC' } },
  rumput: { label: 'Rumput', colors: { main: '#8CC56E', accent: '#7DB862' } },
  batu: { label: 'Batu paving', colors: { main: '#C9C2B0', accent: '#B5AD9A' } },
};
/** Jenis ruangan (untuk ikon item 'room'): dalam rumah atau halaman terbuka. */
const ROOMS: Record<string, { label: string; colors: Record<string, string> }> = {
  dalam: { label: 'Ruangan dalam', colors: { main: '#F3DFB8', accent: '#C48A55' } },
  luar: { label: 'Halaman terbuka', colors: { main: '#D9B26A', accent: '#8CC56E' } },
};

export const DEFAULT_WALL: ArtSpec = { type: 'builtin', key: 'garis', colors: WALLS.garis.colors };
export const DEFAULT_FLOOR: ArtSpec = { type: 'builtin', key: 'papan', colors: FLOORS.papan.colors };

/** Daftar renderer bawaan per jenis item, untuk pilihan di admin. */
export function builtinCatalog() {
  const pick = (o: Record<string, any>) => Object.entries(o).map(([key, v]) => ({ key, label: v.label, colors: v.colors }));
  const icons = (k: ItemKind) => Object.entries(ICONS).filter(([, v]) => v.kinds.includes(k)).map(([key, v]) => ({ key, label: v.label, colors: v.colors }));
  return {
    furniture: pick(FURN),
    wear: Object.entries(WEAR).map(([key, v]) => ({ key, label: v.label, colors: v.colors, slot: v.slot })),
    wallpaper: pick(WALLS),
    floor: pick(FLOORS),
    food: icons('food'),
    seed: icons('seed'),
    fish: icons('fish'),
    material: icons('material'),
    room: pick(ROOMS),
  } as Record<ItemKind, { key: string; label: string; colors: Record<string, string>; slot?: string }[]>;
}

/* ------------------------------------------------------------------ */
/* Room                                                                 */
/* ------------------------------------------------------------------ */

export interface Placed {
  i: string; // item id
  x: number;
  y: number;
  /** arah: kosong / 0 = awal, 1 = seperempat putaran (dicerminkan, lebar & dalam ditukar), 2 = membelakangi kamera, 3 = keduanya */
  r?: number;
}

/** Benda event kecil (dipusatkan di 0,0, ±14px) untuk dekorasi & mini-game. */
export function eventDropSVG(decor: string | undefined) {
  switch (decor) {
    case 'bendera': return `<path d="M-8 14V-14" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/><path d="M-7 -13H12V-4H-7Z" fill="#E0583F" stroke="${INK}" stroke-width="2"/><path d="M-7 -4H12V5H-7Z" fill="#FFFFFF" stroke="${INK}" stroke-width="2"/>`;
    case 'lampion': return `<ellipse cx="0" cy="0" rx="11" ry="13" fill="#C0392B" stroke="${INK}" stroke-width="2.2"/><path d="M-4 -12v24M4 -12v24" stroke="#8E2A20" stroke-width="1.4"/><rect x="-6" y="-16" width="12" height="4" fill="#F2B632" stroke="${INK}" stroke-width="1.4"/><rect x="-6" y="12" width="12" height="4" fill="#F2B632" stroke="${INK}" stroke-width="1.4"/>`;
    case 'ketupat': return `<path d="M0 -14L14 0L0 14L-14 0Z" fill="#9CCB5A" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/><path d="M-7 -7L7 7M-3.5 -10.5L10.5 3.5M-10.5 -3.5L3.5 10.5M7 -7L-7 7M3.5 -10.5L-10.5 3.5M10.5 -3.5L-3.5 10.5" stroke="#6E9A3C" stroke-width="1.2"/>`;
    case 'kembangapi': return `<path d="M0 -14L3.5 -4.5 13 -4 5.5 2.5 8 12 0 6.5-8 12-5.5 2.5-13 -4-3.5 -4.5Z" fill="#F2B632" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`;
    case 'hujan': return `<path d="M-14 0Q-12 -13 0 -13Q12 -13 14 0Q10 -3 7 0Q3 -3 0 0Q-3 -3 -7 0Q-10 -3 -14 0Z" fill="#3F7FBF" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M0 0V10q0 4 -4 4" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`;
    case 'bunga': return [0, 72, 144, 216, 288].map((r) => `<ellipse cx="0" cy="-7" rx="5" ry="7" transform="rotate(${r})" fill="#F7A8C4" stroke="${INK}" stroke-width="1.6"/>`).join('') + `<circle r="4" fill="#F2B632" stroke="${INK}" stroke-width="1.4"/>`;
    default: return `<circle r="12" fill="#F2B632" stroke="${INK}" stroke-width="2.2"/><path d="M0 -6L1.8 -1.8 6 0 1.8 1.8 0 6-1.8 1.8-6 0-1.8-1.8Z" fill="#FFFDF7"/>`;
  }
}

function roomDecor(g: Ctx, W: number, decor: string | undefined, runsL: [number, number][] = [[0, W]], runsR: [number, number][] = [[0, W]], rain = true) {
  if (!decor) return '';
  const WH = 150, s = g.s;
  const along = (wall: 'L' | 'R', u: number, sag: number) => { const p = wall === 'L' ? g.iso(0, u) : g.iso(u, 0); return [p[0], p[1] - WH + 14 + sag]; };
  let o = '';
  for (const wall of ['L', 'R'] as const) {
    if (decor === 'hujan') continue;
    for (const [a, b] of wall === 'L' ? runsL : runsR) {
      const pts: number[][] = [];
      for (let u = a + 0.15; u <= b - 0.1; u += 0.35) pts.push(along(wall, u, Math.sin((u / W) * Math.PI * 3) * -6 + 10));
      if (pts.length < 2) continue;
      o += `<polyline points="${P(pts)}" fill="none" stroke="${INK}" stroke-width="1.6" opacity=".7"/>`;
      pts.forEach((p, i) => {
        if (decor === 'bendera') o += `<path d="M${f1(p[0] - 5)} ${f1(p[1])}L${f1(p[0] + 5)} ${f1(p[1])}L${f1(p[0])} ${f1(p[1] + 11)}Z" fill="${i % 2 ? '#FFFFFF' : '#E0583F'}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`;
        else if (decor === 'kembangapi') o += `<circle cx="${f1(p[0])}" cy="${f1(p[1] + 4)}" r="3.6" fill="${['#F2B632', '#E0583F', '#7FC4E8', '#8FD3A7'][i % 4]}" stroke="${INK}" stroke-width="1"/>`;
        else if (decor === 'bunga' && i % 2 === 0) o += `<g transform="translate(${f1(p[0])} ${f1(p[1] + 3)}) scale(.55)">${eventDropSVG('bunga')}</g>`;
        else if ((decor === 'lampion' || decor === 'ketupat') && i % 3 === 1) o += `<line x1="${f1(p[0])}" y1="${f1(p[1])}" x2="${f1(p[0])}" y2="${f1(p[1] + 10)}" stroke="${INK}" stroke-width="1.2"/><g transform="translate(${f1(p[0])} ${f1(p[1] + 22)}) scale(.75)">${eventDropSVG(decor)}</g>`;
      });
    }
  }
  if (decor === 'hujan' && rain) {
    // hujan di balik jendela (tidak menghalangi ketukan ke jendela)
    for (let k = 0; k < 9; k++) {
      const xx = W / 2 - 1.0 + (k * 0.23) % 2.1, v = 64 + ((k * 23) % 50);
      const p = g.iso(xx, 0);
      o += `<line x1="${f1(p[0])}" y1="${f1(p[1] - v * s)}" x2="${f1(p[0] - 4)}" y2="${f1(p[1] - v * s + 10)}" stroke="#3F7FBF" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>`;
    }
  }
  return o ? `<g pointer-events="none">${o}</g>` : '';
}

export interface RoomOpts {
  layout: Placed[];
  items: Record<string, ItemLike>;
  wall?: ItemLike | null;
  floor?: ItemLike | null;
  size?: number;
  /** pose & prop saat beraktivitas (tidur di kasur, menyiram, membaca, ...); lift = naik di atas mebel */
  pet?: { look: PetLook; wear: ItemLike[]; pos?: [number, number]; flip?: boolean; lift?: number; pose?: string; prop?: string; state?: PetStateLook } | null;
  edit?: boolean;
  sel?: number;
  decor?: string;
  /** 'luar' = halaman terbuka berpagar (tanpa dinding, jendela, lukisan) */
  theme?: string;
  /** remah & bulu rontok di lantai (diketuk untuk disapu) */
  crumbs?: { x: number; y: number; k: string; c?: string }[];
  /** pet lain di ruangan (tamu / pet sendiri saat berkunjung); digeser per frame lewat [data-o] */
  others?: { id: string; look: PetLook; wear: ItemLike[]; pos: [number, number]; flip?: boolean; pose?: string; state?: PetStateLook }[];
  /** isi lukisan dinding: foto bareng (lihat photoScene) */
  photo?: string;
}

function crumbSVG(g: Ctx, cr: { x: number; y: number; k: string; c?: string }, i: number) {
  const s = g.s, p = g.iso(cr.x, cr.y), x = f1(p[0]), y = f1(p[1]);
  let art = '';
  if (cr.k === 'bulu') art = `<path d="M-7 2q3 -9 7 -1q3 -8 7 0" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/><path d="M-7 2q3 -9 7 -1q3 -8 7 0" fill="none" stroke="${col(cr.c, '#F6B7A8')}" stroke-width="2" stroke-linecap="round"/>`;
  else if (cr.k === 'daun') art = `<path d="M-7 2Q-2 -8 8 -4Q3 5 -7 2Z" fill="#C9A13B" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`;
  else art = [[-5, 1, 2.6], [2, -2, 2.1], [5, 3, 2.4], [-1, 4, 1.7]].map(([a, b, r]) => `<circle cx="${a}" cy="${b}" r="${r}" fill="#C8955A" stroke="${INK}" stroke-width="1"/>`).join('');
  return `<g class="crumb" data-c="${i}" transform="translate(${x} ${y}) scale(${f1(s * 1.6 * 100) / 100})"><circle r="13" fill="#FFFFFF" opacity="0"/>${art}</g>`;
}

/** Benda kecil yang dipegang pet saat beraktivitas (koordinat lokal pet, kaki di 0,0). */
const PROPS: Record<string, string> = {
  cangkir: `<g transform="translate(34 -36)"><path d="M-9 -8h18l-2 14h-14Z" fill="#FFFDF7" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><path d="M9 -5q7 1 0 8" fill="none" stroke="${INK}" stroke-width="2.4"/><path d="M-9 -8h18" stroke="#8A5A36" stroke-width="3"/><path d="M-3 -14q-3 -4 0 -8M3 -14q-3 -4 0 -8" stroke="#FFFFFF" stroke-width="2" fill="none" opacity=".9"/></g>`,
  siram: `<g transform="translate(40 -40) rotate(-18)"><path d="M-12 -8h22v18h-22z" fill="#7FC4E8" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M10 -4l16 -10" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M10 -4l16 -10" stroke="#7FC4E8" stroke-width="2.4" stroke-linecap="round"/><path d="M-12 -2q-8 2 -6 10" fill="none" stroke="${INK}" stroke-width="3"/></g>`,
  baca: `<g transform="translate(0 -30)"><path d="M-26 -14L0 -8 26 -14V12L0 18-26 12Z" fill="#FFFDF7" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M0 -8V18" stroke="${INK}" stroke-width="2.4"/><path d="M-26 -14L-26 12 0 18 0 -8Z" fill="#E0583F" opacity=".25"/><path d="M-18 -4l12 3M-18 3l12 3M6 -1l12 -3M6 6l12 -3" stroke="${INK}" stroke-width="1.6" opacity=".6"/></g>`,
  masak: `<g transform="translate(42 -36)"><ellipse rx="16" ry="6" fill="#3B3F55" stroke="${INK}" stroke-width="2.4"/><path d="M14 -2l18 -6" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><circle cx="-4" cy="-4" r="3" fill="#F2C94C"/><circle cx="5" cy="-3" r="2.6" fill="#E0583F"/></g>`,
  main: `<g transform="translate(-44 -12)"><circle r="12" fill="#E0583F" stroke="${INK}" stroke-width="2.6"/><path d="M-12 0h24M0 -12q-7 12 0 24" stroke="#FFFDF7" stroke-width="2.4" fill="none"/></g>`,
  tali: `<path d="M-42 -22Q-66 -136 0 -138Q66 -136 42 -22" fill="none" stroke="#E0583F" stroke-width="3.2" stroke-linecap="round"/><rect x="-48" y="-30" width="9" height="15" rx="3.5" fill="#F2B632" stroke="${INK}" stroke-width="2.2"/><rect x="39" y="-30" width="9" height="15" rx="3.5" fill="#F2B632" stroke="${INK}" stroke-width="2.2"/>`,
  // pengisi acara panggung alun-alun
  gitar: `<g transform="translate(18 -34) rotate(-28)"><ellipse cx="0" cy="8" rx="14" ry="12" fill="#C8955A" stroke="${INK}" stroke-width="3"/><circle cx="0" cy="6" r="4" fill="${INK}"/><rect x="-3" y="-40" width="6" height="40" fill="#8A5A36" stroke="${INK}" stroke-width="2.4"/><rect x="-5" y="-48" width="10" height="9" rx="2" fill="#5B3A22" stroke="${INK}" stroke-width="2"/></g>`,
  kendang: `<g transform="translate(0 -22)"><path d="M-30 -10Q0 -18 30 -10L26 14Q0 20 -26 14Z" fill="#A0522D" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><ellipse cx="-29" cy="2" rx="5" ry="12" fill="#F3E3B5" stroke="${INK}" stroke-width="2.4"/><ellipse cx="29" cy="2" rx="5" ry="12" fill="#F3E3B5" stroke="${INK}" stroke-width="2.4"/><path d="M-22 -10L-14 14M-6 -12L2 16M10 -12L18 14" stroke="#F2B632" stroke-width="2"/></g>`,
  payungtari: `<g transform="translate(30 -66) rotate(16)"><line x1="0" y1="0" x2="0" y2="34" stroke="${INK}" stroke-width="3"/><path d="M-30 0Q0 -30 30 0Q22 -4 15 0Q8 -4 0 0Q-8 -4 -15 0Q-22 -4 -30 0Z" fill="#E0583F" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><path d="M-15 0Q0 -26 15 0" fill="none" stroke="#F2B632" stroke-width="2"/></g>`,
  topi: `<g transform="translate(0 -96)"><ellipse cx="0" cy="12" rx="30" ry="7" fill="#2B2F4A" stroke="${INK}" stroke-width="2"/><rect x="-18" y="-24" width="36" height="36" rx="3" fill="#2B2F4A" stroke="${INK}" stroke-width="2"/><rect x="-18" y="4" width="36" height="6" fill="#E0583F"/><g class="dove" transform="translate(30 -30)"><path d="M-10 0Q0 -12 12 -4Q4 0 12 6Q0 8 -10 0Z" fill="#FFFFFF" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/></g></g>`,
  wayang: `<g transform="translate(36 -40)"><line x1="0" y1="40" x2="0" y2="-36" stroke="#8A5A36" stroke-width="2.4"/><path d="M0 -40q10 2 8 14q8 6 4 18l-4 22h-8l-4 -22q-4 -12 4 -18q-2 -12 0 -14Z" fill="#C0392B" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/><circle cx="2" cy="-34" r="6" fill="#F2B632" stroke="${INK}" stroke-width="1.8"/><path d="M8 -12q16 -6 18 8" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/></g>`,
  // amplop gaji kerja sambilan, dipegang di samping (pulang kerja, belum diterima)
  amplop: `<g class="amplop" transform="translate(40 -40) rotate(-14)"><rect x="-15" y="-10" width="30" height="20" rx="2" fill="#F7E7C6" stroke="${INK}" stroke-width="2.8"/><path d="M-15 -9L0 3L15 -9" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><circle cx="0" cy="2.4" r="3.6" fill="#E0583F" stroke="${INK}" stroke-width="1.6"/><circle cx="9" cy="-12" r="5" fill="#F2B632" stroke="${INK}" stroke-width="2"/></g>`,
  // baskom mandi di depan kaki (mode mandi: gosok sabun lalu bilas)
  baskom: `<ellipse cx="0" cy="-10" rx="54" ry="13" fill="#9FD3EC" stroke="${INK}" stroke-width="3" opacity=".92"/><path d="M-54 -10Q-50 16 0 18Q50 16 54 -10Q48 4 0 6Q-48 4 -54 -10Z" fill="#9AA7B8" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-36 -6q8 4 16 0M12 -5q8 4 16 0" stroke="#FFFFFF" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
};

export const ROOM_ISO: Iso = { ox: 400, oy: 150, t: 34, h: 17 };
export const ROOM_VIEWBOX = '140 -70 520 500';

/** Perabot bisa diputar (dicerminkan): tidak bila admin mematikannya (gambar bertulisan) atau benda tetap bermasker. */
export const canRotate = (item?: ItemLike | null) => !!item && !item.data?.noRotate && !Array.isArray(item.data?.mask);
/** Perabot punya tampak belakang (4 arah): gambar bawaan saja (gambar unggahan tidak punya sisi belakang). */
export const canBack = (item?: ItemLike | null) => canRotate(item) && item!.art?.type === 'builtin' && !item!.data?.noBack;
/** jumlah arah perabot: 4, 2, atau 1 */
export const rotSteps = (item?: ItemLike | null) => (canBack(item) ? 4 : canRotate(item) ? 2 : 1);
/** arah perabot yang dipakai (0–3) — arah yang tidak tersedia untuk perabot itu dianggap arah awal */
export const rotOf = (item: ItemLike | null | undefined, r?: number) => {
  const n = rotSteps(item);
  return Number.isInteger(r) && (r as number) > 0 && (r as number) < n ? (r as number) : 0;
};

// mebel katalog dibatasi 4×4 oleh admin; benda tetap alun-alun (kolam pancing 6×5) boleh sampai 8
/** Ukuran petak perabot; r = 1 (diputar): lebar & dalam ditukar. */
export function footprint(item?: ItemLike | null, r?: number) {
  const d = item?.data ?? {};
  const w = Math.max(1, Math.min(8, d.w | 0 || 1)), dd = Math.max(1, Math.min(8, d.d | 0 || 1));
  return rotOf(item, r) % 2 ? { w: dd, d: w, flat: !!d.flat } : { w, d: dd, flat: !!d.flat };
}

export function occupied(layout: Placed[], items: Record<string, ItemLike>, skip = -1) {
  const set = new Set<string>();
  layout.forEach((p, i) => {
    if (i === skip) return;
    const it = items[p.i];
    if (!it) return;
    // mask: petak yang benar-benar menghalangi (kolam: air; gapura: dua tiangnya saja), datar atau tidak
    const mask: [number, number][] | undefined = Array.isArray(it.data?.mask) ? it.data.mask : undefined;
    if (mask) { for (const [a, b] of mask) set.add(`${p.x + a},${p.y + b}`); return; }
    const f = footprint(it, p.r);
    if (f.flat) return;
    for (let a = 0; a < f.w; a++) for (let b = 0; b < f.d; b++) set.add(`${p.x + a},${p.y + b}`);
  });
  return set;
}

/** Perabot muat di (x, y)? r = 1: dicek dengan ukuran petak yang ditukar. */
export function fits(item: ItemLike, x: number, y: number, layout: Placed[], items: Record<string, ItemLike>, size: number, skip = -1, r = 0) {
  const f = footprint(item, r);
  if (x < 0 || y < 0 || x + f.w > size || y + f.d > size) return false;
  if (f.flat) return true;
  const o = occupied(layout, items, skip);
  for (let a = 0; a < f.w; a++) for (let b = 0; b < f.d; b++) if (o.has(`${x + a},${y + b}`)) return false;
  return true;
}

/** urutan geser saat diputar: tetap di tempat, lalu 1 petak ke samping, lalu serong */
const ROT_SHIFT: [number, number][] = [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
/**
 * Putar perabot ke-`sel` seperempat putaran. Tetap di tempat bila muat; bila tidak, digeser paling jauh 1 petak.
 * Hasil: susunan barunya untuk perabot itu, atau null bila tidak bisa diputar / tidak muat di sekitar sini.
 */
export function rotatePlaced(layout: Placed[], sel: number, items: Record<string, ItemLike>, size: number): Placed | null {
  const p = layout[sel];
  const it = p ? items[p.i] : null;
  if (!p || !it || !canRotate(it)) return null;
  // seperempat putaran: awal → 1 → 2 → 3 → awal (2 arah: awal ↔ 1)
  const r = (rotOf(it, p.r) + 1) % rotSteps(it);
  for (const [dx, dy] of ROT_SHIFT) {
    const x = p.x + dx, y = p.y + dy;
    if (fits(it, x, y, layout, items, size, sel, r)) return r ? { ...p, x, y, r } : (({ r: _r, ...rest }) => ({ ...rest, x, y }))(p);
  }
  return null;
}

export function petSpot(layout: Placed[], items: Record<string, ItemLike>, size = 6): [number, number] {
  const o = occupied(layout, items);
  const m = Math.floor(size / 2);
  const cand: [number, number][] = [];
  for (let r = 0; r < size; r++)
    for (let dx = -r; dx <= r; dx++)
      for (let dy = -r; dy <= r; dy++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r) cand.push([m + dx, m + dy]);
  for (const [x, y] of cand) if (x >= 0 && y >= 0 && x < size && y < size && !o.has(`${x},${y}`)) return [x + 0.5, y + 0.5];
  return [m + 0.5, m + 0.5];
}

/**
 * Gambar perabot di petak (x, y). r = 1 (diputar): digambar di (y, x) lalu dicerminkan terhadap garis tegak lewat
 * titik iso (0,0) ruangan — cermin itu memetakan petak (u, v) ke (v, u), jadi hasilnya perabot berukuran d×w di (x, y)
 * yang menghadap ke dinding lainnya. Tidak perlu gambar baru.
 */
function furnDraw(g: Ctx, item: ItemLike, x: number, y: number, r = 0) {
  const q = rotOf(item, r);
  if (q % 2) {
    const X0 = g.iso(0, 0)[0], gf: Ctx = { ...g, flip: true };
    return `<g class="rot" transform="translate(${f1(2 * X0)} 0) scale(-1 1)">${q === 3 ? furnBack(gf, item, y, x) : furnDrawRaw(gf, item, y, x)}</g>`;
  }
  return q === 2 ? furnBack(g, item, x, y) : furnDrawRaw(g, item, x, y);
}
/**
 * Tampak belakang (diputar 180° di petaknya): titik dicerminkan terhadap pusat petak, panel yang tadinya menghadap
 * kamera (layar TV, pintu lemari, ...) jadi membelakangi kamera sehingga tidak digambar, dan balok-balok diurutkan
 * ulang dari belakang ke depan. Hiasan lain (garis, lingkaran) digambar di atasnya.
 */
function furnBack(g: Ctx, item: ItemLike, x: number, y: number) {
  const f = footprint(item);
  const W = f.w, D = f.d;
  const R = (u: number, v: number): [number, number] => [2 * x + W - u, 2 * y + D - v];
  type B = { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; n: number; h: string };
  const boxes: B[] = [];
  const bg: Ctx = {
    ...g,
    back: true,
    iso: (u: number, v: number) => { const [a, b] = R(u, v); return g.iso(a, b); },
    box: (bx: number, by: number, z: number, bw: number, bd: number, h: number, c3: string[]) => {
      const nx = 2 * x + W - bx - bw, ny = 2 * y + D - by - bd;
      boxes.push({ x0: nx, x1: nx + bw, y0: ny, y1: ny + bd, z0: z, z1: z + h, n: boxes.length, h: g.box(nx, ny, z, bw, bd, h, c3) });
      return '';
    },
    // panel bidang x / y yang menghadap kamera: setelah diputar menghadap dinding → tidak terlihat
    quadX: () => '',
    quadY: () => '',
  } as Ctx;
  const rest = furnDrawRaw(bg, item, x, y);
  return `<g class="back">${sortBoxes(boxes).map((q) => q.h).join('')}${rest}</g>`;
}
/**
 * Urutan gambar balok isometrik (belakang → depan): A sebelum B bila A di belakang B pada sumbu x atau y, atau di
 * bawahnya (z). Bila tidak bisa diputuskan (balok saling menembus), pakai titik tengah lalu urutan aslinya.
 */
function sortBoxes<T extends { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; n: number }>(list: T[]): T[] {
  const e = 1e-6;
  const behind = (a: T, b: T) => a.x1 <= b.x0 + e || a.y1 <= b.y0 + e || a.z1 <= b.z0 + e;
  const key = (a: T) => (a.x0 + a.x1) / 2 + (a.y0 + a.y1) / 2;
  const cmp = (a: T, b: T) => key(a) - key(b) || a.z0 - b.z0 || a.n - b.n;
  const left = [...list], out: T[] = [];
  while (left.length) {
    let pick = -1;
    for (let i = 0; i < left.length; i++) {
      const a = left[i];
      const blocked = left.some((b, j) => j !== i && behind(b, a) && !behind(a, b));
      if (!blocked && (pick < 0 || cmp(a, left[pick]) < 0)) pick = i;
    }
    if (pick < 0) pick = left.reduce((m, a, i) => (cmp(a, left[m]) < 0 ? i : m), 0);
    out.push(left.splice(pick, 1)[0]);
  }
  return out;
}
function furnDrawRaw(g: Ctx, item: ItemLike, x: number, y: number) {
  const f = footprint(item);
  const a = item.art;
  if (a.type === 'image') {
    const url = safeUrl(a.url);
    if (!url) return '';
    const s = g.s;
    const cx = g.iso(x + f.w / 2, y + f.d / 2)[0];
    const bottom = g.iso(x + f.w, y + f.d)[1];
    const w = (a.w ?? (f.w + f.d) * 32) * s;
    const h = (a.h ?? (f.w + f.d) * 32) * s;
    if (f.flat) {
      const top = g.iso(x, y)[1];
      return `<image href="${esc(url)}" x="${f1(cx - w / 2)}" y="${f1(top)}" width="${f1(w)}" height="${f1(bottom - top)}" preserveAspectRatio="none"/>`;
    }
    return `<image href="${esc(url)}" x="${f1(cx - w / 2)}" y="${f1(bottom - h)}" width="${f1(w)}" height="${f1(h)}" preserveAspectRatio="xMidYMax meet"/>`;
  }
  const def = FURN[a.key] ?? FURN.kotak;
  const c: Record<string, string> = {};
  for (const k of Object.keys(def.colors)) c[k] = col(a.colors?.[k], def.colors[k]);
  return def.draw(g, x, y, f.w, f.d, c, a.params ?? {});
}

function wallColors(item?: ItemLike | null) {
  const a = item?.art ?? DEFAULT_WALL;
  if (a.type === 'image') return { key: 'image', main: '#F3DFB8', accent: '#E6CFA2', url: safeUrl(a.url) };
  const def = WALLS[a.key] ?? WALLS.garis;
  return { key: a.key in WALLS ? a.key : 'garis', main: col(a.colors?.main, def.colors.main), accent: col(a.colors?.accent, def.colors.accent), url: '' };
}
const GRASS_FLOOR: ArtSpec = { type: 'builtin', key: 'rumput', colors: FLOORS.rumput.colors };
function floorColors(item?: ItemLike | null, fallback: ArtSpec = DEFAULT_FLOOR) {
  const a = item?.art ?? fallback;
  if (a.type === 'image') return { key: 'papan', main: '#C48A55', accent: '#B47B48' };
  const def = FLOORS[a.key] ?? FLOORS.papan;
  return { key: a.key in FLOORS ? a.key : 'papan', main: col(a.colors?.main, def.colors.main), accent: col(a.colors?.accent, def.colors.accent) };
}

type WallC = ReturnType<typeof wallColors>;
type FloorC = ReturnType<typeof floorColors>;
const WALL_H = 150;
/** pola dinding & lantai yang didaftarkan modul lain (lihat registerSurfaces) */
export type WallPattern = (g: Ctx, side: 'L' | 'R', a: number, b: number, wall: { key: string; main: string; accent: string }, main: string) => string;
export type FloorPattern = (g: Ctx, floor: { key: string; main: string; accent: string }, i: number, j: number, edit: boolean) => string;
const WALL_PATTERNS: WallPattern[] = [];
const FLOOR_PATTERNS: FloorPattern[] = [];
/** titik pada dinding belakang: L = bidang x = 0 (sepanjang y), R = bidang y = 0 (sepanjang x) */
const onWall = (g: Ctx, side: 'L' | 'R', u: number) => (side === 'L' ? g.iso(0, u) : g.iso(u, 0));

/** Halaman terbuka: semak di balik pagar (satu sisi, petak a..b). */
function bushRun(g: Ctx, side: 'L' | 'R', a: number, b: number) {
  const s = g.s;
  let o = '';
  for (let k = Math.floor(a); k < b; k++) {
    const p = side === 'L' ? g.iso(-0.2, k + 0.5) : g.iso(k + 0.5, -0.2);
    o += `<ellipse cx="${f1(p[0])}" cy="${f1(p[1] - 20 * s)}" rx="${f1(24 * s)}" ry="${f1(17 * s)}" fill="${k % 2 ? '#5DA05A' : '#6DB068'}" stroke="${INK}" stroke-width="${f1(1.5 * s)}"/>`;
  }
  return o;
}
const FENCE = '#D9B26A';
/** pagar bambu rendah (palang + tiang) di satu sisi, u = a..b */
function fenceRails(g: Ctx, side: 'L' | 'R', a: number, b: number) {
  return side === 'L'
    ? g.quadX(0, a, b, 13, 19, shade(FENCE, -0.2)) + g.quadX(0, a, b, 28, 34, shade(FENCE, -0.2))
    : g.quadY(0, a, b, 13, 19, FENCE) + g.quadY(0, a, b, 28, 34, FENCE);
}
function fencePosts(g: Ctx, side: 'L' | 'R', a: number, b: number) {
  let o = '';
  for (let u = a; u <= b + 0.001; u += 0.5) {
    const p = Math.max(a, u - 0.06), q = Math.min(b, u + 0.06);
    o += side === 'L' ? g.quadX(0, p, q, 0, 40, shade(FENCE, -0.1), 1.2) : g.quadY(0, p, q, 0, 40, shade(FENCE, 0.15), 1.2);
  }
  return o;
}
/** Halaman terbuka: semak & pagar bambu rendah menggantikan dinding. */
function fenceSVG(g: Ctx, W: number) {
  return bushRun(g, 'L', 0, W) + bushRun(g, 'R', 0, W) + fenceRails(g, 'L', 0, W) + fenceRails(g, 'R', 0, W) + fencePosts(g, 'L', 0, W) + fencePosts(g, 'R', 0, W);
}

/** Petak lantai di depan jendela / lukisan (tempat pet berdiri saat melihatnya) dan arah hadapnya. */
export const ROOM_SPOTS = {
  jendela: { label: 'Jendela', tiles: (W: number): [number, number][] => [[Math.floor(W / 2 - 0.6), 0], [Math.floor(W / 2), 0], [Math.floor(W / 2 - 0.6), 1], [Math.floor(W / 2), 1]], flip: false },
  lukisan: { label: 'Lukisan', tiles: (W: number): [number, number][] => [[0, Math.floor(W / 2 + 0.5)], [0, Math.min(W - 1, Math.floor(W / 2 + 1.2))], [1, Math.floor(W / 2 + 0.5)], [1, Math.min(W - 1, Math.floor(W / 2 + 1.2))]], flip: true },
} as const;
export type RoomSpot = keyof typeof ROOM_SPOTS;

/**
 * Dinding Aurora (Edisi Spesial): bintang kecil + dua pita cahaya bergelombang (hijau & ungu) yang bergantian terang
 * pelan (kelas ed-aurora, CSS game). Gelombang memakai u mutlak, jadi bentang yang terpotong pintu tetap menyambung.
 */
function auroraRun(at: (u: number) => number[], a: number, b: number, L: boolean, accent: string) {
  const n = Math.max(2, Math.ceil((b - a) / 0.12));
  const edge = (v: number, amp: number, fq: number, ph: number) =>
    Array.from({ length: n + 1 }, (_, i) => { const u = a + ((b - a) * i) / n, p = at(u); return [p[0], p[1] - v - amp * Math.sin(u * fq + ph)]; });
  const band = (v: number, th: number, amp: number, fq: number, ph: number) => P([...edge(v + th / 2, amp, fq, ph), ...edge(v - th / 2, amp * 0.6, fq, ph + 0.7).reverse()]);
  let stars = '';
  for (let u = a + 0.2, i = 0; u < b - 0.1; u += 0.38, i++) {
    const p = at(u), v = 44 + ((i * 41) % 96), r = 1 + (i % 3) * 0.45;
    stars += `M${f1(p[0] - r)} ${f1(p[1] - v)}a${f1(r)} ${f1(r)} 0 1 0 ${f1(2 * r)} 0a${f1(r)} ${f1(r)} 0 1 0 ${f1(-2 * r)} 0Z`;
  }
  const c1 = L ? accent : shade(accent, 0.25), c2 = L ? '#C79BFF' : '#D9BCFF';
  return (stars ? `<path d="${stars}" fill="#FFF6D8" opacity=".75"/>` : '')
    + `<polygon class="ed-aurora" points="${band(108, 24, 10, 2.2, 0)}" fill="${c1}" opacity=".5"/>`
    + `<polygon class="ed-aurora ed-aurora2" points="${band(86, 16, 8, 1.7, 1.9)}" fill="${c2}" opacity=".38"/>`;
}

/** Satu bentang dinding tinggi berwallpaper (u = a..b) beserta motif & plint bawahnya. */
function wallRun(g: Ctx, side: 'L' | 'R', a: number, b: number, wall: WallC) {
  const WH = WALL_H;
  const L = side === 'L';
  const at = (u: number) => onWall(g, side, u);
  const up = (p: number[], v: number) => [p[0], p[1] - v];
  const main = L ? wall.main : shade(wall.main, 0.35);
  const P0 = at(a), P1 = at(b);
  let o = g.poly([P0, P1, up(P1, WH), up(P0, WH)], main);
  if (wall.key === 'garis') {
    const c = L ? wall.accent : shade(wall.accent, 0.35);
    for (let u = Math.ceil(a * 2 + 0.001) / 2; u < b - 0.001; u += 0.5) {
      const p = at(u);
      o += `<line x1="${f1(p[0])}" y1="${f1(p[1] - 30)}" x2="${f1(p[0])}" y2="${f1(p[1] - WH + 6)}" stroke="${c}" stroke-width="2.5"/>`;
    }
  } else if (wall.key === 'titik') {
    const c = L ? wall.accent : shade(wall.accent, 0.3);
    for (let yy = a + 0.35; yy < b; yy += 0.55)
      for (let v = 40; v < WH - 8; v += 22) {
        const u = yy + ((v / 22) % 2) * 0.27;
        if (u >= b - 0.1) continue;
        const p = at(u);
        o += `<circle cx="${f1(p[0])}" cy="${f1(p[1] - v)}" r="3" fill="${c}"/>`;
      }
  } else if (wall.key === 'kotak' || wall.key === 'bata') {
    const brick = wall.key === 'bata';
    const step = brick ? 18 : 30;
    const c = L ? wall.accent : shade(wall.accent, 0.25);
    let row = 0;
    for (let v = 30 + step; v < WH - 4; v += step, row++) {
      const p = at(a), q = at(b);
      o += `<line x1="${f1(p[0])}" y1="${f1(p[1] - v)}" x2="${f1(q[0])}" y2="${f1(q[1] - v)}" stroke="${c}" stroke-width="2"/>`;
      const off = brick ? (row % 2) * 0.35 : 0;
      const gap = brick ? 0.7 : 1;
      for (let u = a + off + gap / 2; u < b; u += gap) {
        const top = Math.min(v + step, WH - 4);
        const pu = at(u);
        o += `<line x1="${f1(pu[0])}" y1="${f1(pu[1] - v)}" x2="${f1(pu[0])}" y2="${f1(pu[1] - top)}" stroke="${c}" stroke-width="2"/>`;
      }
    }
  } else if (wall.key === 'langit') {
    // langit malam: bintang berkelip (kelas blink) + bulan sabit di dinding kiri
    let i = 0;
    for (let yy = a + 0.3; yy < b; yy += 0.62)
      for (let v = 34; v < WH - 10; v += 26) {
        const u = yy + (((v / 26) | 0) % 2) * 0.31;
        if (u >= b - 0.1) continue;
        const p = at(u), r = 1.6 + ((i * 7) % 3) * 0.7;
        o += `<circle${i % 3 === 0 ? ` class="blink" style="animation-delay:-${(i % 7) * 0.4}s"` : ''} cx="${f1(p[0])}" cy="${f1(p[1] - v)}" r="${f1(r)}" fill="${i % 4 ? '#FFFDF7' : wall.accent}"/>`;
        i++;
      }
    if (L) { const m = at(a + (b - a) * 0.3); o += `<circle cx="${f1(m[0])}" cy="${f1(m[1] - WH + 34)}" r="13" fill="#FFF1C4"/><circle cx="${f1(m[0] + 6)}" cy="${f1(m[1] - WH + 30)}" r="11" fill="${main}"/>`; }
  } else if (wall.key === 'kawung') {
    const c = L ? wall.accent : shade(wall.accent, 0.2);
    for (let yy = a + 0.32; yy < b - 0.1; yy += 0.5)
      for (let v = 44; v < WH - 12; v += 24) {
        const p = at(yy + (((v / 24) | 0) % 2) * 0.25);
        if (yy + (((v / 24) | 0) % 2) * 0.25 >= b - 0.1) continue;
        const px = p[0], py = p[1] - v;
        o += `<ellipse cx="${f1(px - 4.4)}" cy="${f1(py)}" rx="3.6" ry="2.6" fill="${c}"/><ellipse cx="${f1(px + 4.4)}" cy="${f1(py)}" rx="3.6" ry="2.6" fill="${c}"/><ellipse cx="${f1(px)}" cy="${f1(py - 4.4)}" rx="2.6" ry="3.6" fill="${c}"/><ellipse cx="${f1(px)}" cy="${f1(py + 4.4)}" rx="2.6" ry="3.6" fill="${c}"/><circle cx="${f1(px)}" cy="${f1(py)}" r="1.2" fill="${main}"/>`;
      }
  } else if (wall.key === 'gedek') {
    // anyaman bambu: petak bergantian bilah tegak & mendatar (satu path untuk isi, satu untuk garis)
    const c = L ? wall.accent : shade(wall.accent, 0.25), k = Math.min(1, g.s);
    const du = 0.3, dv = 13 * k, v0 = 26 * g.s, vTop = WH - 2;
    let cells = '', lines = '', i = 0;
    for (let u = a; u < b - 0.02; u += du, i++) {
      const u1 = Math.min(b, u + du), p0 = at(u), p1 = at(u1);
      let j = 0;
      for (let v = v0; v < vTop - 1; v += dv, j++) {
        const v1 = Math.min(vTop, v + dv);
        if ((i + j) % 2) {
          cells += `M${f1(p0[0])} ${f1(p0[1] - v)}L${f1(p1[0])} ${f1(p1[1] - v)}L${f1(p1[0])} ${f1(p1[1] - v1)}L${f1(p0[0])} ${f1(p0[1] - v1)}Z`;
          for (const k of [0.25, 0.5, 0.75]) { const q = at(u + (u1 - u) * k); lines += `M${f1(q[0])} ${f1(q[1] - v)}V${f1(q[1] - v1)}`; }
        } else for (const k of [0.33, 0.67]) { const vv = v + (v1 - v) * k; lines += `M${f1(p0[0])} ${f1(p0[1] - vv)}L${f1(p1[0])} ${f1(p1[1] - vv)}`; }
      }
    }
    const t0 = at(a), t1 = at(b);
    o += `<path d="${cells}" fill="${c}" fill-opacity=".3"/><path d="${lines}" stroke="${c}" stroke-width="${f1(1.2 * k)}" fill="none"/>`;
    // reng bambu di bagian atas
    o += `<path d="M${f1(t0[0])} ${f1(t0[1] - WH + 7)}L${f1(t1[0])} ${f1(t1[1] - WH + 7)}" stroke="${INK}" stroke-width="${f1(6 * k)}" stroke-linecap="round"/><path d="M${f1(t0[0])} ${f1(t0[1] - WH + 7)}L${f1(t1[0])} ${f1(t1[1] - WH + 7)}" stroke="${shade(main, -0.12)}" stroke-width="${f1(3.6 * k)}" stroke-linecap="round"/>`;
  } else if (wall.key === 'aurora') {
    o += auroraRun(at, a, b, L, wall.accent);
  } else if (wall.key === 'image' && wall.url) {
    // pola gambar upload diterapkan sebagai tekstur dinding
    const pid = 'wp' + Math.abs(hash(wall.url));
    o += `<defs><pattern id="${pid}" width="48" height="48" patternUnits="userSpaceOnUse"><image href="${esc(wall.url)}" width="48" height="48"/></pattern></defs>`;
    o += `<polygon points="${P([P0, P1, up(P1, WH), up(P0, WH)])}" fill="url(#${pid})" opacity="${L ? '.9' : '.75'}"/>`;
  }
  o += toko3Wall(g, side, a, b, wall, main);
  for (const fn of WALL_PATTERNS) o += fn(g, side, a, b, wall, main);
  o += L ? g.quadX(0, a, b, 0, 26, shade(wall.main, -0.14)) : g.quadY(0, a, b, 0, 26, shade(main, -0.14));
  return o;
}

/** Jendela di dinding kanan (bisa diketuk: pet melihat ke luar). */
/** tinggi jendela & lukisan tidak ikut membesar melewati dinding (dinding selalu 150 px) pada petak besar */
const vk = (g: Ctx) => Math.min(1, 1.1 / g.s);
function windowSVG(g: Ctx, W: number, wall: WallC, rid?: string) {
  const k = vk(g), s = g.s * k;
  let o = `<g class="spot" data-spot="jendela"${rid !== undefined ? ` data-r="${esc(rid)}"` : ''}>`;
  const trim = shade(wall.main, -0.45);
  const wx0 = W / 2 - 1.1, wx1 = W / 2 + 1.1;
  o += g.quadY(0, wx0 - 0.1, wx1 + 0.1, 50 * k, 56 * k, trim);
  o += g.quadY(0, wx0, wx1, 56 * k, 122 * k, '#BFE3F5');
  const wm = g.iso(W / 2, 0), wl = g.iso(wx0, 0), wr = g.iso(wx1, 0);
  o += `<ellipse cx="${f1(wm[0] + 14)}" cy="${f1(wm[1] - 104 * s)}" rx="15" ry="5.5" fill="#FFFFFF"/><ellipse cx="${f1(wl[0] + 30)}" cy="${f1(wl[1] - 84 * s)}" rx="11" ry="4" fill="#FFFFFF"/>`;
  o += `<path d="M${f1(wm[0])} ${f1(wm[1] - 56 * s)}V${f1(wm[1] - 122 * s)}M${f1(wl[0])} ${f1(wl[1] - 89 * s)}L${f1(wr[0])} ${f1(wr[1] - 89 * s)}" stroke="${trim}" stroke-width="4"/>`;
  return o + `</g>`;
}

/** Lukisan di dinding kiri (bisa diketuk); isinya foto bareng bila ada. */
function paintingSVG(g: Ctx, W: number, photo = '', rid?: string) {
  const k = vk(g), s = g.s * k;
  let o = `<g class="spot" data-spot="lukisan"${rid !== undefined ? ` data-r="${esc(rid)}"` : ''}>`;
  const py0 = W / 2 + 0.35, py1 = W / 2 + 1.65;
  o += g.quadX(0, py0, py1, 62 * k, 110 * k, '#FFFDF7');
  if (photo) {
    // foto bareng yang dipajang: isi kotak 136×100 dipetakan ke bidang dinding kiri
    const y0 = py0 + 0.13, y1 = py1 - 0.13;
    o += g.quadX(0, y0, y1, 68 * k, 104 * k, '#DDEFF5');
    const a0 = g.iso(0, y0), a1 = g.iso(0, y1);
    const m = [(a0[0] - a1[0]) / 136, (a0[1] - a1[1]) / 136, 0, (36 * s) / 100, a1[0], a1[1] - 104 * s].map((v) => Math.round(v * 1000) / 1000);
    return o + `<g class="photo" transform="matrix(${m.join(' ')})">${photo}</g></g>`;
  }
  o += g.quadX(0, py0 + 0.13, py1 - 0.13, 68 * k, 104 * k, '#9FD3C2');
  const Q = (yy: number, v: number) => { const p = g.iso(0, yy); return [p[0], p[1] - v * s]; };
  o += `<polygon points="${P([Q(py0 + 0.2, 70), Q(py0 + 0.6, 94), Q(py0 + 1.0, 70)])}" fill="#3FA06A"/><polygon points="${P([Q(py0 + 0.5, 70), Q(py0 + 0.85, 86), Q(py0 + 1.13, 70)])}" fill="#2F7F55"/>`;
  const sun = Q(py0 + 0.35, 97);
  return o + `<circle cx="${f1(sun[0])}" cy="${f1(sun[1])}" r="4" fill="#F2B632"/></g>`;
}

/** batu-batu lantai batu kali dalam satu petak: [u, v, jari-jari] (petak 0..1, tidak keluar petak) */
const BATU_KALI = [[0.25, 0.25, 0.17], [0.7, 0.22, 0.15], [0.5, 0.55, 0.17], [0.21, 0.74, 0.14], [0.8, 0.72, 0.14], [0.5, 0.9, 0.07]];
/** Petak-petak lantai (bisa diketuk) + garis tepi ruangan. */
function floorSVG(g: Ctx, W: number, floor: FloorC, edit: boolean, rid?: string, D = W) {
  const s = g.s;
  const rattr = rid !== undefined ? ` data-r="${esc(rid)}"` : '';
  let o = '';
  for (let i = 0; i < W; i++)
    for (let j = 0; j < D; j++) {
      const solid = floor.key === 'teraso' || floor.key === 'karpet' || floor.key === 'terasoemas' || floor.key === 'pasir' || floor.key === 'papanjati' || floor.key === 'batukali' || floor.key === 'kolamkaca';
      const fill = solid ? floor.main : floor.key === 'batutaman' ? ((i + j) % 2 ? floor.main : shade(floor.main, -0.05)) : (i + j) % 2 ? floor.main : floor.accent;
      const attrs = `class="${edit ? 'tile' : 'fl'}"${rattr} data-x="${i}" data-y="${j}"`;
      // kolam kaca: bingkai kaca terang di antara panel
      const edge = floor.key === 'kolamkaca' ? `stroke="${floor.accent}" stroke-width="${f1(Math.max(1.2, 1.8 * Math.min(1, s)))}"` : `stroke="${shade(floor.main, floor.key === 'karpet' || floor.key === 'batukali' ? -0.06 : -0.22)}" stroke-width="1"`;
      o += `<polygon ${attrs} points="${P([g.iso(i, j), g.iso(i + 1, j), g.iso(i + 1, j + 1), g.iso(i, j + 1)])}" fill="${fill}" ${edge}/>`;
      if (floor.key === 'teraso')
        for (const [fx, fy, k] of [[0.25, 0.3, 0], [0.7, 0.2, 1], [0.5, 0.65, 0], [0.2, 0.8, 1], [0.8, 0.75, 0]]) {
          const q = g.iso(i + ((fx + i * 0.13) % 1), j + ((fy + j * 0.17) % 1));
          o += `<circle cx="${f1(q[0])}" cy="${f1(q[1])}" r="${f1(1.6 * s)}" fill="${k ? '#FFFFFF' : floor.accent}" pointer-events="none"/>`;
        }
      if (floor.key === 'terasoemas')
        for (const [fx, fy, k] of [[0.2, 0.3, 0], [0.65, 0.18, 1], [0.45, 0.6, 2], [0.15, 0.82, 0], [0.82, 0.7, 1], [0.6, 0.88, 2], [0.35, 0.12, 2]]) {
          const q = g.iso(i + ((fx + i * 0.13) % 1), j + ((fy + j * 0.17) % 1));
          o += `<circle cx="${f1(q[0])}" cy="${f1(q[1])}" r="${f1((k === 0 ? 2 : 1.4) * s)}" fill="${k === 0 ? floor.accent : k === 1 ? '#FFFFFF' : '#8A7A62'}" pointer-events="none"/>`;
        }
      if (floor.key === 'pasir' && !edit) {
        const a = g.iso(i + 0.15, j + 0.5), b2 = g.iso(i + 0.85, j + 0.5), m = g.iso(i + 0.5, j + 0.35);
        o += `<path d="M${f1(a[0])} ${f1(a[1])}Q${f1(m[0])} ${f1(m[1])} ${f1(b2[0])} ${f1(b2[1])}" fill="none" stroke="${floor.accent}" stroke-width="1.4" pointer-events="none"/>`;
        if ((i * 5 + j * 3) % 7 === 0) { const c2 = g.iso(i + 0.6, j + 0.7); o += `<path d="M${f1(c2[0] - 4 * s)} ${f1(c2[1])}a${f1(4 * s)} ${f1(3 * s)} 0 0 1 ${f1(8 * s)} 0Z" fill="#FFB7A8" stroke="${INK}" stroke-width="${f1(0.8 * s)}" pointer-events="none"/>`; }
      }
      if (floor.key === 'batutaman' && !edit && (i + j) % 2 === 0) {
        const c2 = g.iso(i + 0.5, j + 0.5);
        o += `<ellipse cx="${f1(c2[0])}" cy="${f1(c2[1])}" rx="${f1(14 * s)}" ry="${f1(7 * s)}" fill="${floor.accent}" stroke="${shade(floor.accent, -0.3)}" stroke-width="1.2" pointer-events="none"/>`;
      }
      if ((floor.key === 'rumput' || floor.key === 'batutaman') && !edit && (i * 7 + j * 3) % 3 === 0 && (floor.key === 'rumput' || (i + j) % 2)) {
        const c = g.iso(i + 0.5, j + 0.5);
        o += `<path d="M${f1(c[0] - 5 * s)} ${f1(c[1] + 2 * s)}l${f1(2 * s)} ${f1(-7 * s)}M${f1(c[0])} ${f1(c[1] + 2 * s)}v${f1(-9 * s)}M${f1(c[0] + 5 * s)} ${f1(c[1] + 2 * s)}l${f1(-2 * s)} ${f1(-7 * s)}" stroke="#5E9E4A" stroke-width="${f1(1.6 * s)}" stroke-linecap="round" pointer-events="none"/>`;
      }
      if (floor.key === 'papanjati') {
        // parket jati anyaman: 4 kotak kecil per petak, bilah bergantian arah
        const q = (u: number, v: number) => g.iso(i + u, j + v);
        const seg = (u0: number, v0: number, u1: number, v1: number) => { const p = q(u0, v0), r = q(u1, v1); return `M${f1(p[0])} ${f1(p[1])}L${f1(r[0])} ${f1(r[1])}`; };
        let d = seg(0.5, 0, 0.5, 1) + seg(0, 0.5, 1, 0.5), cells = '';
        for (const [a, b] of [[0, 0], [0.5, 0], [0, 0.5], [0.5, 0.5]]) {
          const alongX = (a + b) % 1 === 0;
          for (const k of [1 / 3, 2 / 3]) d += alongX ? seg(a, b + 0.5 * k, a + 0.5, b + 0.5 * k) : seg(a + 0.5 * k, b, a + 0.5 * k, b + 0.5);
          if (!alongX) cells += `M${P([q(a, b), q(a + 0.5, b), q(a + 0.5, b + 0.5), q(a, b + 0.5)]).replace(/ /g, 'L')}Z`;
        }
        o += `<path d="${cells}" fill="${floor.accent}" fill-opacity=".22" pointer-events="none"/><path d="${d}" stroke="${floor.accent}" stroke-width="${f1(0.9 * s)}" fill="none" pointer-events="none"/>`;
      }
      if (floor.key === 'batukali') {
        // batu kali bulat di atas adukan semen; tiap batu tetap di dalam petaknya
        let d1 = '', d2 = '';
        BATU_KALI.forEach(([u, v, r], k) => {
          const jit = (((i * 7 + j * 13 + k * 5) % 7) / 7 - 0.5) * 0.04;
          const c = g.iso(i + u + jit, j + v - jit), rx = r * (0.9 + jit * 2) * Math.SQRT2 * g.s * 32, ry = rx / 2;
          const e = `M${f1(c[0] - rx)} ${f1(c[1])}a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(2 * rx)} 0a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(-2 * rx)} 0Z`;
          if ((k + i * 2 + j) % 3) d1 += e; else d2 += e;
        });
        const sw = f1(Math.min(1, s));
        o += `<path d="${d1}" fill="${floor.accent}" stroke="${shade(floor.accent, -0.2)}" stroke-width="${sw}" pointer-events="none"/><path d="${d2}" fill="${shade(floor.accent, 0.18)}" stroke="${shade(floor.accent, -0.2)}" stroke-width="${sw}" pointer-events="none"/>`;
      }
      if (floor.key === 'papan' && !edit) {
        const a = g.iso(i + 0.5, j), b = g.iso(i + 0.5, j + 1);
        o += `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${shade(floor.main, -0.12)}" stroke-width="1" pointer-events="none"/>`;
      }
      o += toko3Floor(g, floor, i, j, edit);
      for (const fn of FLOOR_PATTERNS) o += fn(g, floor, i, j, edit);
    }
  if (floor.key === 'kolamkaca' && !edit) o += kolamKaca(g, W, D, floor);
  o += `<polygon points="${P([g.iso(0, 0), g.iso(W, 0), g.iso(W, D), g.iso(0, D)])}" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round" pointer-events="none"/>`;
  return o;
}

/**
 * Lantai Kolam Kaca (Edisi Spesial): riak cahaya di air, batu dasar kolam, beberapa ikan berenang di bawah kaca
 * (kelas ed-swim: bergeser sepanjang satu jalur lurus, --tx/--ty = setengah jalur di layar), lalu kilau kaca di atasnya.
 * Satu kelompok per ruangan (bukan per petak) supaya ringan; tidak menangkap ketukan.
 */
function kolamKaca(g: Ctx, W: number, D: number, floor: FloorC) {
  const s = g.s;
  let caus = '', glint = '', peb = '';
  for (let i = 0; i < W; i++)
    for (let j = 0; j < D; j++) {
      const a = g.iso(i + 0.18, j + 0.62), m = g.iso(i + 0.42, j + 0.38), b = g.iso(i + 0.78, j + 0.58);
      caus += `M${f1(a[0])} ${f1(a[1])}Q${f1(m[0])} ${f1(m[1])} ${f1(b[0])} ${f1(b[1])}`;
      // kilau kaca: satu garis miring pendek di sudut petak (tidak di semua petak)
      if ((i * 3 + j * 5) % 4 === 0) { const p = g.iso(i + 0.12, j + 0.42), q = g.iso(i + 0.12, j + 0.16); glint += `M${f1(p[0])} ${f1(p[1])}L${f1(q[0])} ${f1(q[1])}`; }
      // batu kecil di dasar kolam
      if ((i * 7 + j * 3) % 5 === 1) {
        const c = g.iso(i + 0.66, j + 0.7), r = 3.4 * s;
        peb += `M${f1(c[0] - r)} ${f1(c[1])}a${f1(r)} ${f1(r / 2)} 0 1 0 ${f1(2 * r)} 0a${f1(r)} ${f1(r / 2)} 0 1 0 ${f1(-2 * r)} 0Z`;
      }
    }
  let o = `<g pointer-events="none"><path d="${caus}" fill="none" stroke="${shade(floor.main, 0.38)}" stroke-width="${f1(1.3 * Math.min(1, s))}" stroke-linecap="round" opacity=".8"/>`;
  if (peb) o += `<path d="${peb}" fill="${shade(floor.main, -0.12)}"/>`;
  const n = Math.max(2, Math.min(5, Math.round((W * D) / 8)));
  const cols = ['#F2994A', '#FFFDF7', '#E0583F', '#F7C548', '#FFFDF7'];
  for (let k = 0; k < n; k++) {
    const alongU = k % 2 === 0, len = alongU ? W : D, other = alongU ? D : W;
    const lane = 0.6 + ((k * 0.618 + 0.21) % 1) * Math.max(0.01, other - 1.2);
    const dir = (k >> 1) % 2 ? -1 : 1;
    const p0 = alongU ? g.iso(0.3, lane) : g.iso(lane, 0.3), p1 = alongU ? g.iso(len - 0.3, lane) : g.iso(lane, len - 0.3);
    const tx = ((p1[0] - p0[0]) / 2) * dir, ty = ((p1[1] - p0[1]) / 2) * dir;
    const k2 = s * 1.25, F = alongU ? [k2 * dir, (k2 / 2) * dir] : [-k2 * dir, (k2 / 2) * dir], S = alongU ? [-k2, k2 / 2] : [k2, k2 / 2];
    const m = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2], dur = 11 + k * 1.7 + len * 0.6;
    o += `<g transform="translate(${f1(m[0])} ${f1(m[1])})"><g class="ed-swim" style="--tx:${f1(tx)}px;--ty:${f1(ty)}px;animation-duration:${f1(dur)}s;animation-delay:-${f1((k * 3.7) % dur)}s">`
      + `<g transform="matrix(${[F[0], F[1], S[0], S[1]].map((v) => Math.round(v * 100) / 100).join(' ')} 0 0)" opacity=".88">${koi(1, cols[k % cols.length])}</g></g></g>`;
  }
  return o + (glint ? `<path d="${glint}" stroke="#FFFFFF" stroke-width="${f1(1.8 * Math.min(1, s))}" stroke-linecap="round" opacity=".75"/>` : '') + `</g>`;
}

function roomShadow(g: Ctx, W: number, DD = W) {
  const A = g.iso(0, 0), B = g.iso(W, 0), Cc = g.iso(W, DD), D = g.iso(0, DD);
  return `<polygon points="${P([[A[0], A[1] + 10], [B[0] + 12, B[1] + 8], [Cc[0], Cc[1] + 16], [D[0] - 12, D[1] + 8]])}" fill="${INK}" opacity=".12"/>`;
}

function roomShell(g: Ctx, W: number, wall: WallC, floor: FloorC, edit: boolean, outdoor = false, photo = '') {
  let o = roomShadow(g, W);
  if (outdoor) o += fenceSVG(g, W);
  else o += wallRun(g, 'L', 0, W, wall) + wallRun(g, 'R', 0, W, wall) + windowSVG(g, W, wall) + paintingSVG(g, W, photo);
  return o + floorSVG(g, W, floor, edit);
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

/** Geometri ruangan: titik layar untuk koordinat petak & skala pet. Dipakai untuk animasi pet berjalan. */
export function roomGeom(size = 6) {
  const t = Math.round((34 * 6) / size);
  const g = G({ ox: 400, oy: 150, t, h: t / 2 });
  return { t, s: t / 32, point: (x: number, y: number) => g.iso(x, y), petScale: Math.round(((0.82 * t) / 34) * 100) / 100 };
}

export function renderRoom(o: RoomOpts) {
  const W = o.size ?? 6;
  const t = Math.round((34 * 6) / W);
  const g = G({ ox: 400, oy: 150, t, h: t / 2 });
  const outdoor = o.theme === 'luar';
  let out = roomShell(g, W, wallColors(o.wall), floorColors(o.floor, outdoor ? GRASS_FLOOR : DEFAULT_FLOOR), !!o.edit, outdoor, o.photo ?? '') + (outdoor ? '' : roomDecor(g, W, o.decor));
  const list = o.layout.map((p, idx) => ({ p, idx, it: o.items[p.i] })).filter((e) => e.it);
  const grp = (e: (typeof list)[number]) =>
    `<g class="furn${o.edit ? ' editable' : ''}${o.edit && o.sel === e.idx ? ' sel' : ''}" data-i="${e.idx}">${furnDraw(g, e.it, e.p.x, e.p.y, e.p.r)}</g>`;
  list.filter((e) => footprint(e.it).flat).forEach((e) => (out += grp(e)));
  if (!o.edit) (o.crumbs ?? []).forEach((c, i) => (out += crumbSVG(g, c, i)));
  const draws = list
    .filter((e) => !footprint(e.it).flat)
    .map((e) => { const f = footprint(e.it, e.p.r); return { d: e.p.x + e.p.y + (f.w + f.d) / 2, h: grp(e) }; });
  if (o.pet) {
    const pos = o.pet.pos ?? petSpot(o.layout, o.items, W);
    const c = g.iso(pos[0], pos[1]);
    const lift = (o.pet.lift ?? 0) * g.s;
    const prop = o.pet.prop ? PROPS[o.pet.prop] ?? '' : '';
    draws.push({ d: pos[0] + pos[1] + 0.01, h: `<g class="pet${o.pet.pose ? ' pose-' + esc(o.pet.pose) : ''}" transform="translate(${f1(c[0])} ${f1(c[1] - lift)}) scale(${f1((0.82 * t) / 34 * 100) / 100})"><g class="pet-hop"><g class="pet-face"${o.pet.flip ? ' transform="scale(-1 1)"' : ''}><g class="pet-bob">${renderPet(o.pet.look, o.pet.wear, o.pet.state)}</g>${prop}</g></g></g>` });
  }
  for (const p of o.edit ? [] : o.others ?? []) {
    const c = g.iso(p.pos[0], p.pos[1]);
    draws.push({ d: p.pos[0] + p.pos[1] + 0.005, h: `<g class="opet${p.pose ? ' pose-' + esc(p.pose) : ''}" data-o="${esc(p.id)}" transform="translate(${f1(c[0])} ${f1(c[1])}) scale(${f1((0.82 * t) / 34 * 100) / 100})"><g class="pet-hop"><g class="pet-face"${p.flip ? ' transform="scale(-1 1)"' : ''}><g class="pet-bob">${renderPet(p.look, p.wear, p.state)}</g></g></g></g>` });
  }
  draws.sort((a, b) => a.d - b.d).forEach((d) => (out += d.h));
  return out;
}

/* ------------------------------------------------------------------ */
/* Rumah tersambung (semua ruangan tampil sekaligus)                    */
/* ------------------------------------------------------------------ */

/** ukuran petak rumah (px SVG) & skala pet di dalamnya */
export const HOUSE_T = 34;
const HOUSE_HT = HOUSE_T / 2;
export const HOUSE_PET_SCALE = 0.82;
export const HOUSE_WALL_H = WALL_H;
/** tinggi dinding pemisah antarruangan (rendah supaya isi ruangan di belakangnya tetap terlihat) */
const LOW_H = 34;
const HG = G({ ox: 0, oy: 0, t: HOUSE_T, h: HOUSE_HT });
/** titik layar (SVG) untuk koordinat petak rumah */
export const houseIso = (x: number, y: number) => HG.iso(x, y) as [number, number];
const roomG = (r: { gx: number; gy: number }) => G({ ox: (r.gx - r.gy) * HOUSE_T, oy: (r.gx + r.gy) * HOUSE_HT, t: HOUSE_T, h: HOUSE_HT });

export interface HouseRoomArt {
  layout: Placed[];
  wall?: ItemLike | null;
  floor?: ItemLike | null;
  /** ruangan yang sedang diatur: mebel bisa dipilih, lantai jadi petak tujuan */
  edit?: boolean;
  /** ruangan lain selama mode atur (diredupkan) */
  dim?: boolean;
  sel?: number;
  /** isi lukisan (foto bareng) */
  photo?: string;
  /** mebel datar hanya hiasan (jalan batu alun-alun): tidak menangkap ketukan */
  inertFlats?: boolean;
}
/**
 * Satu benda yang diurutkan menurut kedalaman (dinding rendah, mebel, pet); d kecil digambar dulu.
 * w: garis dinding (sumbu & letak), b: kotak mebel [x0, y0, x1, y1] — dipakai bila kedalamannya seri.
 */
export interface HouseDraw { key: string; d: number; h: string; w?: ['x' | 'y', number]; b?: [number, number, number, number] }
/** Urutan gambar: menurut kedalaman; bila seri, mebel di belakang garis dinding digambar sebelum dindingnya. */
export function houseDrawOrder(a: HouseDraw, b: HouseDraw) {
  const d = a.d - b.d;
  if (Math.abs(d) > 1e-6) return d;
  const behind = (box: [number, number, number, number], w: ['x' | 'y', number]) => (w[0] === 'x' ? box[2] <= w[1] : box[3] <= w[1]);
  if (a.w && b.b) return behind(b.b, a.w) ? 1 : -1;
  if (b.w && a.b) return behind(a.b, b.w) ? -1 : 1;
  return 0;
}

const runsOf = (segs: WallSeg[], ok: (s: WallSeg) => boolean) => {
  const out: [number, number][] = [];
  segs.forEach((s, k) => {
    if (!ok(s)) return;
    const last = out[out.length - 1];
    if (last && last[1] === k) last[1] = k + 1;
    else out.push([k, k + 1]);
  });
  return out;
};

/** Kotak pembatas (koordinat SVG) seluruh rumah atau satu ruangan, termasuk tinggi dinding. */
export function houseBounds(plan: HousePlan, roomId?: string) {
  const list = roomId ? plan.rooms.filter((r) => r.id === roomId) : plan.rooms;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const r of list) {
    const tall = !r.outdoor && [...r.L, ...r.R].some((s) => s.k === 'tall');
    const top = houseIso(r.gx, r.gy)[1] - (tall ? WALL_H : r.outdoor ? 60 : 90);
    x0 = Math.min(x0, houseIso(r.gx, r.gy + r.d)[0]);
    x1 = Math.max(x1, houseIso(r.gx + r.w, r.gy)[0]);
    y0 = Math.min(y0, top);
    y1 = Math.max(y1, houseIso(r.gx + r.w, r.gy + r.d)[1]);
  }
  if (!isFinite(x0)) return { x: -200, y: -150, w: 400, h: 300 };
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** satu potong lapisan milik satu ruangan (disusun ulang hanya bila isinya berubah) */
export interface HousePart { key: string; h: string }
/**
 * Lapisan bawah rumah, dipotong per ruangan supaya perubahan kecil (pilih mebel, remah) tidak menggambar ulang seluruh rumah:
 * bayangan, dinding belakang tinggi & pagar luar, lantai, keset pintu, karpet (mebel datar).
 */
export function houseLayers(plan: HousePlan, art: Record<string, HouseRoomArt>, items: Record<string, ItemLike>, decor?: string) {
  let shadow = '';
  const back: HousePart[] = [], floor: HousePart[] = [], flats: HousePart[] = [];
  const dimWrap = (a: HouseRoomArt, s: string) => (a.dim && s ? `<g class="dim">${s}</g>` : s);
  for (const r of plan.rooms) {
    const a = art[r.id] ?? { layout: [] };
    const g = roomG(r), W = r.w, D = r.d;
    shadow += roomShadow(g, W, D);
    const wall = wallColors(a.wall);
    let b = '';
    if (r.outdoor) {
      for (const side of ['L', 'R'] as const) for (const [p, q] of runsOf(side === 'L' ? r.L : r.R, (s) => s.k === 'tall')) b += bushRun(g, side, p, q) + fenceRails(g, side, p, q) + fencePosts(g, side, p, q);
    } else {
      const tl = runsOf(r.L, (s) => s.k === 'tall'), tr = runsOf(r.R, (s) => s.k === 'tall');
      for (const [p, q] of tl) b += wallRun(g, 'L', p, q, wall);
      for (const [p, q] of tr) b += wallRun(g, 'R', p, q, wall);
      if (r.window) b += windowSVG(g, W, wall, r.id);
      if (r.painting) b += paintingSVG(g, D, a.photo ?? '', r.id);
      b += roomDecor(g, W, decor, tl, tr, r.window);
    }
    // data-r: dinding juga bisa diketuk untuk memilih ruangan (atur denah / mode atur)
    back.push({ key: r.id, h: b ? dimWrap(a, `<g data-r="${esc(r.id)}">${b}</g>`) : '' });
    floor.push({ key: r.id, h: dimWrap(a, floorSVG(g, W, floorColors(a.floor, r.outdoor ? GRASS_FLOOR : DEFAULT_FLOOR), !!a.edit, r.id, D)) });
    let f = '';
    a.layout.forEach((p, idx) => {
      const it = items[p.i];
      if (!it || !footprint(it).flat) return;
      // alun-alun: jalan batu diteruskan ke lantai; tikar permainan (data.tap) tetap bisa diketuk
      f += a.inertFlats && !it.data?.tap ? `<g pointer-events="none">${furnDraw(g, it, p.x, p.y, p.r)}</g>` : `<g class="${furnCls(a, idx)}" data-r="${esc(r.id)}" data-i="${idx}">${furnDraw(g, it, p.x, p.y, p.r)}</g>`;
    });
    flats.push({ key: r.id, h: dimWrap(a, f) });
  }
  return { shadow, back, floor, mats: plan.doors.map(doorMat).join(''), flats };
}
/** Semua lapisan bawah sebagai satu string (pratinjau & uji). */
export function houseBase(plan: HousePlan, art: Record<string, HouseRoomArt>, decor?: string, items: Record<string, ItemLike> = {}) {
  const l = houseLayers(plan, art, items, decor);
  return l.shadow + l.back.map((p) => p.h).join('') + l.floor.map((p) => p.h).join('') + l.mats + l.flats.map((p) => p.h).join('');
}
/** Remah & bulu rontok di satu ruangan (lapisan sendiri: sering berubah). */
export function houseCrumbs(plan: HousePlan, roomId: string, crumbs: { x: number; y: number; k: string; c?: string }[]) {
  const r = plan.byId.get(roomId);
  if (!r || !crumbs.length) return '';
  const g = roomG(r);
  return crumbs.map((c, i) => crumbSVG(g, c, i)).join('');
}

/** keset di ambang pintu */
function doorMat(d: HouseDoor) {
  const [p0, p1] = d.axis === 'x' ? [[d.line - 0.32, d.at + 0.18], [d.line + 0.32, d.at + 0.82]] : [[d.at + 0.18, d.line - 0.32], [d.at + 0.82, d.line + 0.32]];
  const pts = [HG.iso(p0[0], p0[1]), HG.iso(p1[0], p0[1]), HG.iso(p1[0], p1[1]), HG.iso(p0[0], p1[1])];
  const mid = d.axis === 'x' ? [HG.iso(d.line, d.at + 0.18), HG.iso(d.line, d.at + 0.82)] : [HG.iso(d.at + 0.18, d.line), HG.iso(d.at + 0.82, d.line)];
  return `<polygon points="${P(pts)}" fill="#C98A52" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round" pointer-events="none"/><line x1="${f1(mid[0][0])}" y1="${f1(mid[0][1])}" x2="${f1(mid[1][0])}" y2="${f1(mid[1][1])}" stroke="#A86E3C" stroke-width="2" pointer-events="none"/>`;
}

const furnCls = (a: HouseRoomArt, idx: number) => (a.dim ? 'furn-x' : `furn${a.edit ? ' editable' : ''}${a.edit && a.sel === idx ? ' sel' : ''}`);

/** dinding rendah satu petak (pemisah ruangan / dinding luar di sisi depan rumah) */
function lowWall(g: Ctx, side: 'L' | 'R', k: number, main: string, capStart: boolean, capEnd: boolean, post0: boolean, post1: boolean) {
  const T = 0.13, s = g.s, H = LOW_H * s;
  const at = (u: number, off = 0) => (side === 'L' ? g.iso(-off, u) : g.iso(u, -off));
  const up = (p: number[], v: number) => [p[0], p[1] - v];
  const a = at(k), b = at(k + 1), a2 = at(k, T), b2 = at(k + 1, T);
  const face = side === 'L' ? main : shade(main, 0.3);
  const sw = f1(1.6 * s);
  let o = `<polygon points="${P([a, b, up(b, H), up(a, H)])}" fill="${face}"/>`;
  o += `<polygon points="${P([a, b, up(b, 8 * s), up(a, 8 * s)])}" fill="${shade(face, -0.16)}"/>`;
  o += `<polygon points="${P([up(a, H), up(b, H), up(b2, H), up(a2, H)])}" fill="${shade(main, 0.45)}"/>`;
  let d = `M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}M${f1(a[0])} ${f1(a[1] - H)}L${f1(b[0])} ${f1(b[1] - H)}M${f1(a2[0])} ${f1(a2[1] - H)}L${f1(b2[0])} ${f1(b2[1] - H)}`;
  if (capStart) d += `M${f1(a[0])} ${f1(a[1])}V${f1(a[1] - H)}L${f1(a2[0])} ${f1(a2[1] - H)}`;
  if (capEnd) d += `M${f1(b[0])} ${f1(b[1])}V${f1(b[1] - H)}L${f1(b2[0])} ${f1(b2[1] - H)}`;
  o += `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  // kusen pintu: tiang lebih tinggi di sisi yang berbatasan dengan pintu
  const trim = shade(main, -0.42);
  if (post0) o += g.box(side === 'L' ? -0.16 : k, side === 'L' ? k : -0.16, 0, side === 'L' ? 0.16 : 0.14, side === 'L' ? 0.14 : 0.16, 54, C3(trim));
  if (post1) o += g.box(side === 'L' ? -0.16 : k + 0.86, side === 'L' ? k + 0.86 : -0.16, 0, side === 'L' ? 0.16 : 0.14, side === 'L' ? 0.14 : 0.16, 54, C3(trim));
  return o;
}
/** pagar bambu satu petak (halaman) */
function lowFence(g: Ctx, side: 'L' | 'R', k: number) {
  return fenceRails(g, side, k, k + 1) + fencePosts(g, side, k, k + 1);
}
const OUTSIDE_WALL = '#E8D2A6';

/** Dinding rendah & mebel, untuk digabung dengan pet lalu diurutkan menurut kedalaman (d kecil digambar dulu). */
export function houseDraws(plan: HousePlan, art: Record<string, HouseRoomArt>, items: Record<string, ItemLike>): HouseDraw[] {
  const out: HouseDraw[] = [];
  for (const r of plan.rooms) {
    const a = art[r.id] ?? { layout: [] };
    const g = roomG(r);
    const wall = wallColors(a.wall);
    const dim = (h: string) => (a.dim ? `<g class="dim">${h}</g>` : h);
    for (const side of ['L', 'R'] as const) {
      const segs = side === 'L' ? r.L : r.R;
      segs.forEach((sg, k) => {
        if (sg.k === 'tall' || sg.k === 'door') return;
        const [gx, gy] = side === 'L' ? [r.gx, r.gy + k] : [r.gx + k, r.gy];
        const d = gx + gy + 0.5;
        const behindOut = sg.by ? plan.byId.get(sg.by)?.outdoor : false;
        let h: string;
        if (r.outdoor && (sg.k === 'low' || behindOut)) h = lowFence(g, side, k);
        else {
          const prev = segs[k - 1], next = segs[k + 1];
          const isWall = (x?: WallSeg) => !!x && (x.k === 'low' || x.k === 'part');
          h = lowWall(g, side, k, r.outdoor ? OUTSIDE_WALL : wall.main, !isWall(prev), !isWall(next), prev?.k === 'door', next?.k === 'door');
        }
        out.push({ key: `w:${r.id}:${side}${k}`, d, h: dim(`<g data-r="${esc(r.id)}">${h}</g>`), w: side === 'L' ? ['x', gx] : ['y', gy] });
      });
    }
    a.layout.forEach((p, idx) => {
      const it = items[p.i];
      if (!it) return;
      const f = footprint(it, p.r);
      if (f.flat) return;
      const x0 = r.gx + p.x, y0 = r.gy + p.y;
      out.push({ key: `f:${r.id}:${idx}`, d: x0 + y0 + (f.w + f.d) / 2, h: dim(`<g class="${furnCls(a, idx)}" data-r="${esc(r.id)}" data-i="${idx}">${furnDraw(g, it, p.x, p.y, p.r)}</g>`), b: [x0, y0, x0 + f.w, y0 + f.d] });
    });
  }
  return out;
}

/** Isi elemen pet (posisi diatur lewat transform pembungkusnya). */
export function petMarkup(p: { look: PetLook; wear: ItemLike[]; state?: PetStateLook; flip?: boolean; prop?: string }) {
  const prop = p.prop ? PROPS[p.prop] ?? '' : '';
  return `<g class="pet-hop"><g class="pet-face"${p.flip ? ' transform="scale(-1 1)"' : ''}><g class="pet-bob">${renderPet(p.look, p.wear, p.state)}</g>${prop}</g></g>`;
}

/* ------------------------------------------------------------------ */
/* Item icons (toko, tas, admin)                                         */
/* ------------------------------------------------------------------ */

export function itemIcon(item: ItemLike) {
  const a = item.art;
  if (item.kind === 'furniture') {
    const f = footprint(item);
    const t = Math.min(20, 66 / (f.w + f.d));
    const g = G({ ox: -(f.w - f.d) * t / 2, oy: -((f.w + f.d) * t / 2) / 2 + (f.flat ? 4 : 22), t, h: t / 2 });
    return `<svg viewBox="-50 -64 100 104" aria-hidden="true">${furnDraw(g, item, 0, 0)}</svg>`;
  }
  if (item.kind === 'wear') {
    const slot = slotOf(item);
    if (slot === 'body') return bodyIcon(bodyParts(item));
    const vb = { head: '-56 -130 112 78', face: '-46 -64 92 50', neck: '-46 -40 92 54', back: '-80 -118 160 136', hand: '22 -114 46 98' }[slot as 'head'] ?? '-56 -130 112 70';
    const p = wearParts(item);
    return `<svg viewBox="${vb}" aria-hidden="true">${p.behind}${p.front}</svg>`;
  }
  if (item.kind === 'room') {
    const c = a.type === 'builtin' ? a.colors ?? {} : {};
    const outdoor = (item.data?.theme ?? (a.type === 'builtin' ? a.key : 'dalam')) === 'luar';
    const def = ROOMS[outdoor ? 'luar' : 'dalam'].colors;
    const wallIt = { art: { type: 'builtin', key: 'polos', colors: { main: col(c.main, def.main), accent: col(c.main, def.main) } } } as unknown as ItemLike;
    const floorIt = { art: { type: 'builtin', key: outdoor ? 'rumput' : 'papan', colors: { main: col(c.accent, def.accent), accent: shade(col(c.accent, def.accent), -0.08) } } } as unknown as ItemLike;
    const g = G({ ox: 32, oy: 10, t: 9, h: 4.5 });
    return `<svg viewBox="${outdoor ? '2 -8 60 50' : '2 -34 60 72'}" aria-hidden="true">${roomShell(g, 3, wallColors(wallIt), floorColors(floorIt), false, outdoor)}</svg>`;
  }
  if (item.kind === 'wallpaper' || item.kind === 'floor') {
    if (a.type === 'image') {
      const url = safeUrl(a.url);
      return `<svg viewBox="0 0 64 52" aria-hidden="true"><rect x="6" y="4" width="52" height="44" rx="6" fill="#fff" stroke="${INK}" stroke-width="2.5"/>${url ? `<image href="${esc(url)}" x="8" y="6" width="48" height="40" preserveAspectRatio="xMidYMid slice"/>` : ''}</svg>`;
    }
    const g = G({ ox: 32, oy: 10, t: 9, h: 4.5 });
    const shell = item.kind === 'wallpaper' ? roomShell(g, 3, wallColors(item), floorColors(null), false) : roomShell(g, 3, wallColors(null), floorColors(item), false);
    return `<svg viewBox="2 -34 60 70" aria-hidden="true">${shell}</svg>`;
  }
  if (a.type === 'image') {
    const url = safeUrl(a.url);
    return `<svg viewBox="0 0 64 52" aria-hidden="true">${url ? `<image href="${esc(url)}" x="4" y="2" width="56" height="48" preserveAspectRatio="xMidYMid meet"/>` : ''}</svg>`;
  }
  const def = ICONS[a.key] ?? ICONS.koin;
  const c: Record<string, string> = {};
  for (const k of Object.keys(def.colors)) c[k] = col(a.colors?.[k], def.colors[k]);
  return `<svg viewBox="0 0 64 52" aria-hidden="true">${def.draw(c, a.params ?? {})}</svg>`;
}

/* ------------------------------------------------------------------ */
/* Kampung map                                                          */
/* ------------------------------------------------------------------ */

export interface LocationLike {
  id: string;
  name: string;
  kind: string; // home | shop | social | garden | race | pond | pearl
  x: number;
  y: number;
  enabled: boolean;
  style?: { body?: string; roof?: string; w?: number };
}

function pill(x: number, y: number, label: string) {
  const lw = label.length * 8.2 + 26;
  return `<rect x="${f1(x - lw / 2)}" y="${y}" width="${f1(lw)}" height="25" rx="12.5" fill="#FFFDF7" stroke="${INK}" stroke-width="2"/><text x="${x}" y="${y + 18}" text-anchor="middle" font-family="'Baloo 2',system-ui,sans-serif" font-weight="700" font-size="14.5" fill="${INK}">${esc(label)}</text>`;
}

function building(l: LocationLike) {
  const x = l.x, y = l.y, h = 46;
  const w = Math.max(70, Math.min(140, l.style?.w ?? 104));
  const body = col(l.style?.body, '#FDF1D6'), roof = col(l.style?.roof, '#3FA06A');
  return (
    `<ellipse cx="${x}" cy="${y + 3}" rx="${w / 2 + 18}" ry="8" fill="${INK}" opacity=".16"/><g class="lift">` +
    `<rect x="${x - w / 2}" y="${y - h}" width="${w}" height="${h}" fill="${body}" stroke="${INK}" stroke-width="2.5"/>` +
    `<rect x="${x - w / 2 + 10}" y="${y - 36}" width="15" height="13" fill="#FFE7A0" stroke="${INK}" stroke-width="2"/><rect x="${x + w / 2 - 25}" y="${y - 36}" width="15" height="13" fill="#FFE7A0" stroke="${INK}" stroke-width="2"/>` +
    `<rect x="${x - 9}" y="${y - 27}" width="18" height="27" fill="${shade(body, -0.4)}" stroke="${INK}" stroke-width="2"/>` +
    `<polygon points="${x - w / 2 - 14},${y - h} ${x + w / 2 + 14},${y - h} ${x + w / 2 - 6},${y - h - 20} ${x - w / 2 + 6},${y - h - 20}" fill="${roof}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<polygon points="${f1(x - w / 4)},${y - h - 20} ${f1(x + w / 4)},${y - h - 20} ${f1(x + w / 9)},${y - h - 40} ${f1(x - w / 9)},${y - h - 40}" fill="${shade(roof, -0.15)}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>` +
    `</g>${pill(x, y + 12, l.name)}`
  );
}

function special(l: LocationLike) {
  const x = l.x, y = l.y;
  if (l.kind === 'garden') {
    let k = '';
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) {
        const px = x - 57 + c * 38, py = y - 84 + r * 26;
        k += `<rect x="${px}" y="${py}" width="30" height="18" rx="5" fill="#8C5A2B" stroke="${INK}" stroke-width="2"/><path d="M${px + 15} ${py + 9}v-8M${px + 15} ${py + 3}l-5 -3M${px + 15} ${py + 3}l5 -3" stroke="#3E8E4E" stroke-width="2.5" stroke-linecap="round"/>`;
      }
    return `<g class="lift">${k}</g>${pill(x, y, l.name)}`;
  }
  if (l.kind === 'race') {
    let fl = '';
    for (let i = 0; i < 9; i++) { const fx = x - 76 + i * 17; fl += `<path d="M${fx} ${y - 106}l8 0-4 9z" fill="${i % 2 ? '#FFFFFF' : '#E0583F'}" stroke="${INK}" stroke-width="1"/>`; }
    return `<g class="lift"><rect x="${x - 82}" y="${y - 100}" width="164" height="92" rx="10" fill="#8CC56E" stroke="${INK}" stroke-width="2.5"/><path d="M${x - 68} ${y - 78}H${x + 68}M${x - 68} ${y - 54}H${x + 68}M${x - 68} ${y - 30}H${x + 68}" stroke="#FFFDF7" stroke-width="2.5" stroke-dasharray="7 6"/><path d="M${x - 82} ${y - 106}H${x + 84}" stroke="${INK}" stroke-width="1.5"/>${fl}</g>${pill(x, y, l.name)}`;
  }
  if (l.kind === 'pond') {
    return `<g class="lift"><ellipse cx="${x}" cy="${y - 46}" rx="78" ry="40" fill="#6EB7D6" stroke="${INK}" stroke-width="2.5"/><path d="M${x - 35} ${y - 52}q8 -5 16 0M${x + 15} ${y - 36}q8 -5 16 0M${x - 5} ${y - 66}q6 -4 12 0" stroke="#FFFFFF" stroke-width="2" fill="none"/><rect x="${x - 65}" y="${y - 40}" width="40" height="10" fill="#B98B4E" stroke="${INK}" stroke-width="2"/></g>${pill(x, y, l.name)}`;
  }
  if (l.kind === 'square') {
    // alun-alun: lapangan rumput berpagar dengan jalan batu, beringin kembar, air mancur, panggung & komidi putar
    let o = `<rect x="${x - 96}" y="${y - 128}" width="192" height="118" rx="14" fill="#8CC56E" stroke="${INK}" stroke-width="2.5"/>`;
    o += `<path d="M${x - 96} ${y - 66}H${x + 96}M${x} ${y - 128}V${y - 10}" stroke="#D8CFC0" stroke-width="14"/><path d="M${x - 96} ${y - 66}H${x + 96}M${x} ${y - 128}V${y - 10}" stroke="#BDB2A0" stroke-width="1.5" stroke-dasharray="6 6"/>`;
    o += `<rect x="${x + 30}" y="${y - 124}" width="56" height="22" rx="3" fill="#B9804A" stroke="${INK}" stroke-width="2"/><rect x="${x + 34}" y="${y - 140}" width="48" height="20" fill="#C0392B" stroke="${INK}" stroke-width="2"/><rect x="${x + 30}" y="${y - 146}" width="56" height="8" fill="#F2B632" stroke="${INK}" stroke-width="1.6"/>`;
    o += `<circle cx="${x}" cy="${y - 66}" r="12" fill="#9FD3EC" stroke="${INK}" stroke-width="2"/><circle cx="${x}" cy="${y - 66}" r="4" fill="#FFFFFF"/>`;
    for (const dx of [-34, 34]) o += `<circle cx="${x + dx}" cy="${y - 96}" r="17" fill="#3F8F4E" stroke="${INK}" stroke-width="2.2"/><circle cx="${x + dx - 6}" cy="${y - 102}" r="6" fill="#62B06A"/>`;
    o += `<path d="M${x - 78} ${y - 40}l14 -14l14 14z" fill="#E0583F" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/><ellipse cx="${x - 64}" cy="${y - 38}" rx="16" ry="6" fill="#FFF4D6" stroke="${INK}" stroke-width="1.8"/>`;
    for (let i = 0; i < 7; i++) o += `<path d="M${x - 84 + i * 28} ${y - 128}q14 10 28 0" fill="none" stroke="${INK}" stroke-width="1.2"/><circle cx="${x - 70 + i * 28}" cy="${y - 123}" r="3" fill="${['#E0583F', '#F2B632', '#7FC4E8', '#F7A8C4'][i % 4]}"/>`;
    return `<g class="lift">${o}</g>${pill(x, y, l.name)}`;
  }
  // Kerja Sambilan: papan lowongan (di tepi jalan, label seperti bangunan) & pos ronda
  if (l.kind === 'jobs') return `${jobBoardSVG(x, y)}${pill(x, y + 12, l.name)}`;
  if (l.kind === 'ronda') return `${posRondaSVG(x, y)}${pill(x, y, l.name)}`;
  return building(l);
}

/** Lebar peta 1260 (versi lama 960 → 1080): sisi kanan untuk Warung Jamu dan Alun-alun. */
export const MAP_W = 1260;
export const MAP_VIEWBOX = `0 -40 ${MAP_W} 520`;

function mapDecor(decor: string | undefined) {
  if (!decor) return '';
  let o = '';
  const garland = (y: number, every: number, item: (x: number, yy: number, i: number) => string) => {
    let pts = '', out = '';
    for (let x = -10, i = 0; x <= MAP_W + 10; x += every, i++) {
      const yy = y + Math.sin(((x % 240) / 240) * Math.PI) * 18;
      pts += `${x},${f1(yy)} `;
      out += item(x, yy, i);
    }
    return `<polyline points="${pts}" fill="none" stroke="${INK}" stroke-width="1.6" opacity=".7"/>` + out;
  };
  switch (decor) {
    case 'bendera':
      o += garland(-18, 24, (x, y, i) => `<path d="M${x - 8} ${f1(y)}L${x + 8} ${f1(y)}L${x} ${f1(y + 16)}Z" fill="${i % 2 ? '#FFFFFF' : '#E0583F'}" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>`);
      o += `<path d="M453 232V112" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M455 114H495V126H455Z" fill="#E0583F" stroke="${INK}" stroke-width="2"/><path d="M455 126H495V138H455Z" fill="#FFFFFF" stroke="${INK}" stroke-width="2"/>`;
      break;
    case 'lampion':
    case 'ketupat':
      if (decor === 'ketupat') o += `<path d="M58 -14A22 22 0 1 0 82 14A18 18 0 1 1 58 -14Z" fill="#F2D16B" stroke="${INK}" stroke-width="2"/>` + [[110, -20], [140, 6], [96, 26]].map(([x, y]) => `<path d="M${x} ${y - 5}L${x + 1.5} ${y - 1.5} ${x + 5} ${y} ${x + 1.5} ${y + 1.5} ${x} ${y + 5} ${x - 1.5} ${y + 1.5} ${x - 5} ${y} ${x - 1.5} ${y - 1.5}Z" fill="#FFF6C9"/>`).join('');
      o += garland(-22, 26, (x, y, i) => (i % 3 === 1 ? `<line x1="${x}" y1="${f1(y)}" x2="${x}" y2="${f1(y + 10)}" stroke="${INK}" stroke-width="1.2"/><g transform="translate(${x} ${f1(y + 24)}) scale(.9)">${eventDropSVG(decor)}</g>` : ''));
      break;
    case 'kembangapi':
      o += `<rect x="-200" y="-200" width="1600" height="300" fill="#2B2F4A" opacity=".12"/>`;
      [[90, -8, '#F2B632'], [300, -18, '#E0583F'], [520, 0, '#7FC4E8'], [720, -14, '#8FD3A7'], [890, 4, '#E7A1C9'], [1030, -10, '#F2B632']].forEach(([x, y, c]) => {
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          o += `<line x1="${f1(+x + Math.cos(a) * 8)}" y1="${f1(+y + Math.sin(a) * 8)}" x2="${f1(+x + Math.cos(a) * 26)}" y2="${f1(+y + Math.sin(a) * 26)}" stroke="${c}" stroke-width="3" stroke-linecap="round"/><circle cx="${f1(+x + Math.cos(a) * 31)}" cy="${f1(+y + Math.sin(a) * 31)}" r="2.4" fill="${c}"/>`;
        }
      });
      break;
    case 'hujan':
      o += `<rect x="-200" y="-200" width="1600" height="900" fill="#2F5D7C" opacity=".1"/>`;
      for (let k = 0; k < 160; k++) {
        const x = (k * 97) % (MAP_W + 20), y = ((k * 61) % 520) - 40;
        o += `<line x1="${x}" y1="${y}" x2="${x - 6}" y2="${y + 16}" stroke="#3F7FBF" stroke-width="2" stroke-linecap="round" opacity=".55"/>`;
      }
      [[160, 246], [640, 236], [420, 340]].forEach(([x, y]) => (o += `<ellipse cx="${x}" cy="${y}" rx="22" ry="6" fill="#7FC4E8" opacity=".7"/>`));
      break;
    case 'bunga':
      for (let k = 0; k < 40; k++) {
        const x = (k * 113) % MAP_W, y = ((k * 71) % 500) - 30;
        o += `<ellipse cx="${x}" cy="${y}" rx="5" ry="3" transform="rotate(${(k * 47) % 180} ${x} ${y})" fill="${k % 3 ? '#F7A8C4' : '#FFFFFF'}" stroke="${INK}" stroke-width=".8" opacity=".9"/>`;
      }
      break;
  }
  return `<g pointer-events="none">${o}</g>`;
}

export function renderMap(locations: LocationLike[], decor?: string) {
  let o = `<rect x="-200" y="-200" width="1500" height="900" fill="#A9D18A"/>`;
  for (let i = 0; i < 96; i++) o += `<circle cx="${(i * 137) % MAP_W}" cy="${(i * 89) % 440}" r="3" fill="#97C478"/>`;
  [[40, 70], [200, 58], [380, 62], [560, 56], [770, 64], [20, 140], [940, 70], [1062, 52], [1000, 330], [1150, 70], [1230, 150], [1240, 330]].forEach(([x, y]) => {
    o += `<circle cx="${x}" cy="${y + 16}" r="5" fill="#7A5232"/><circle cx="${x}" cy="${y}" r="20" fill="#5DA05A" stroke="${INK}" stroke-width="2.5"/><circle cx="${x - 6}" cy="${y - 6}" r="7" fill="#7CC57D"/>`;
  });
  const road = `M-20 240H${MAP_W + 20}M420 240V470`;
  o += `<path d="${road}" stroke="${INK}" stroke-width="38" fill="none"/><path d="${road}" stroke="#E9D9AE" stroke-width="32" fill="none"/><path d="${road}" stroke="#C9B582" stroke-width="2" stroke-dasharray="12 12" fill="none"/>`;
  for (const l of locations) {
    if (!l.enabled) continue;
    o += `<g class="loc" data-loc="${esc(l.id)}" tabindex="0" role="button" aria-label="${esc(l.name)}">${special(l)}</g>`;
  }
  return o + mapDecor(decor);
}

/* ------------------------------------------------------------------ */
/* Foto bareng                                                          */
/* ------------------------------------------------------------------ */

export const PHOTO_POSES = { senyum: 'Senyum', lompat: 'Lompat', peluk: 'Peluk' } as const;

/** Pet-pet dalam foto, digambar di kotak 136×100 (dipakai di album & lukisan dinding). */
export function photoScene(members: { look: PetLook; wear: ItemLike[]; state?: PetStateLook }[], pose = 'senyum') {
  const n = Math.max(1, Math.min(6, members.length));
  const hug = pose === 'peluk';
  const gap = Math.min(hug ? 40 : 52, 128 / n);
  const sc = Math.min(0.5, (gap * (hug ? 1.45 : 1.12)) / 132);
  const x0 = 68 - (gap * (n - 1)) / 2;
  let out = '';
  members.slice(0, 6).forEach((m, i) => {
    const up = pose === 'lompat' ? (i % 2 ? 6 : 16) : 0;
    const tilt = hug ? (i < (n - 1) / 2 ? 6 : i > (n - 1) / 2 ? -6 : 0) : 0;
    out += `<g transform="translate(${f1(x0 + i * gap)} ${f1(96 - up)}) rotate(${tilt}) scale(${f1(sc * 100) / 100})">${renderPet(m.look, m.wear, { ...(m.state ?? {}), mood: 'senang', dirt: 0 })}</g>`;
  });
  if (hug) out += `<path d="M68 ${f1(Math.max(14, 96 - 132 * sc - 14))}c-4-6-12-2-8 4l8 7 8-7c4-6-4-10-8-4z" fill="#E0583F" stroke="${INK}" stroke-width="1.5"/>`;
  return out;
}

/** Foto polaroid untuk album: latar dari dinding & lantai ruangan tempat foto diambil. */
export function renderPhoto(members: { look: PetLook; wear: ItemLike[]; state?: PetStateLook }[], pose: string, wall?: ItemLike | null, floor?: ItemLike | null, theme = 'dalam') {
  return `<svg viewBox="0 0 160 140" aria-hidden="true"><rect x="1" y="1" width="158" height="138" rx="6" fill="#FFFDF7" stroke="${INK}" stroke-width="2"/>`
    + `<svg x="12" y="10" width="136" height="100" viewBox="0 0 136 100">${photoInner(members, pose, wall, floor, theme)}</svg><rect x="12" y="10" width="136" height="100" fill="none" stroke="${INK}" stroke-width="1.5"/></svg>`;
}
/** Isi foto album (136 × 100, tanpa bingkai): latar dinding & lantai + pet. Dipakai juga kartu Bagikan (Foto bareng). */
export function photoInner(members: { look: PetLook; wear: ItemLike[]; state?: PetStateLook }[], pose: string, wall?: ItemLike | null, floor?: ItemLike | null, theme = 'dalam') {
  const outdoor = theme === 'luar' || theme === 'alun';
  const w = outdoor ? { main: '#BFE3F5', accent: '#A9D6EE' } : wallColors(wall);
  const f = floorColors(floor, outdoor ? GRASS_FLOOR : DEFAULT_FLOOR);
  return `<rect width="136" height="100" fill="${w.main}"/><rect y="70" width="136" height="30" fill="${f.main}"/><path d="M0 70H136" stroke="${shade(f.main, -0.25)}" stroke-width="1.5"/>`
    + (outdoor ? '' : `<path d="M0 ${'25'}H136" stroke="${shade(w.main, -0.08)}" stroke-width="3" opacity=".6"/>`)
    + photoScene(members, pose);
}


/* ================================================================== */
/* Item premium (set bertema): Taman Malam, Keraton, Kafe Kopi,        */
/* Pantai, Kamar Bintang, Dapur Nenek, Sanggar Seni, Spa Bali. Kelas   */
/* animasi: blink, flicker, swim, water, swing (CSS di Room.svelte).    */
/* ================================================================== */

const glowC = (cx: number, cy: number, r: number, col = '#FFE7A0', op = 0.42, cls = 'glow') =>
  `<circle class="${cls}" cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r)}" fill="${col}" fill-opacity="${op}"/>`;
const shadowE = (cx: number, cy: number, rx: number, ry: number) => `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(rx)}" ry="${f1(ry)}" fill="${INK}" opacity=".12"/>`;
const flame = (cx: number, cy: number, s: number, k = 1) =>
  `<g class="flicker" style="transform-origin:${f1(cx)}px ${f1(cy)}px"><path d="M${f1(cx)} ${f1(cy)}c${f1(-8 * s * k)} ${f1(-6 * s * k)} ${f1(-6 * s * k)} ${f1(-14 * s * k)} 0 ${f1(-22 * s * k)}c${f1(6 * s * k)} ${f1(8 * s * k)} ${f1(8 * s * k)} ${f1(16 * s * k)} 0 ${f1(22 * s * k)}Z" fill="#F2994A" stroke="${INK}" stroke-width="${f1(1.3 * s)}" stroke-linejoin="round"/><path d="M${f1(cx)} ${f1(cy - 2 * s)}c${f1(-4 * s * k)} ${f1(-4 * s * k)} ${f1(-3 * s * k)} ${f1(-8 * s * k)} 0 ${f1(-12 * s * k)}c${f1(3 * s * k)} ${f1(4 * s * k)} ${f1(4 * s * k)} ${f1(8 * s * k)} 0 ${f1(12 * s * k)}Z" fill="#FFE27A"/></g>`;
const koi = (s: number, col: string) =>
  `<g><ellipse rx="${f1(9 * s)}" ry="${f1(4 * s)}" fill="${col}" stroke="${INK}" stroke-width="${f1(1.1 * s)}"/><path d="M${f1(-8 * s)} 0l${f1(-7 * s)} ${f1(-5 * s)}v${f1(10 * s)}Z" fill="${col}" stroke="${INK}" stroke-width="${f1(1.1 * s)}" stroke-linejoin="round"/><circle cx="${f1(2 * s)}" cy="${f1(-1 * s)}" r="${f1(2.2 * s)}" fill="#FFFFFF"/><circle cx="${f1(5 * s)}" cy="${f1(-1 * s)}" r="${f1(0.9 * s)}" fill="${INK}"/></g>`;

/* ---------- bantuan gambar set premium 2: Dapur Nenek, Sanggar Seni, Spa Bali ---------- */
type Pt = number[];
/** titik petak (u, v) setinggi z px — lewat g.iso, jadi ikut dicerminkan pada tampak belakang */
const at3 = (g: Ctx, u: number, v: number, z: number): Pt => { const p = g.iso(u, v); return [p[0], p[1] - z * g.s]; };
/** jari-jari petak → setengah lebar elips di layar (lingkaran di lantai) */
const rk = (g: Ctx) => Math.SQRT2 * 32 * g.s;
const pathOf = (pts: Pt[]) => 'M' + P(pts).replace(/ /g, 'L');
/** garis bertepi tinta (batang, tali, gagang): garis tinta lebar lalu warnanya */
const inkLine = (pts: Pt[], colr: string, w: number, s: number) =>
  `<polyline points="${P(pts)}" fill="none" stroke="${INK}" stroke-width="${f1((w + 2) * s)}" stroke-linecap="round" stroke-linejoin="round"/><polyline points="${P(pts)}" fill="none" stroke="${colr}" stroke-width="${f1(w * s)}" stroke-linecap="round" stroke-linejoin="round"/>`;
const thinLine = (pts: Pt[], colr: string, w: number, extra = '') => `<polyline points="${P(pts)}" fill="none" stroke="${colr}" stroke-width="${f1(w)}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
/** uap / asap tipis yang bergerak (kelas water) */
const wisp = (x: number, y: number, s: number, h = 16, colr = '#FFFFFF', op = 0.85) =>
  `<path class="water" d="M${f1(x)} ${f1(y)}q${f1(-4 * s)} ${f1((-h / 2) * s)} 0 ${f1(-h * s)}q${f1(4 * s)} ${f1((-h / 3) * s)} 0 ${f1((-h / 1.6) * s)}" fill="none" stroke="${colr}" stroke-width="${f1(2 * s)}" stroke-linecap="round" stroke-dasharray="${f1(4 * s)} ${f1(4 * s)}" opacity="${op}"/>`;
/** bunga kamboja: lima kelopak putih berpusat kuning */
function kambojaFlower(cx: number, cy: number, r: number, s: number, rot = 0) {
  let o = '';
  for (let k = 0; k < 5; k++) {
    const a = rot + k * 72, rad = (a * Math.PI) / 180, px = cx + Math.cos(rad) * r * 0.5, py = cy + Math.sin(rad) * r * 0.5;
    o += `<ellipse cx="${f1(px)}" cy="${f1(py)}" rx="${f1(r * 0.62)}" ry="${f1(r * 0.34)}" transform="rotate(${f1(a + 18)} ${f1(px)} ${f1(py)})" fill="#FFFDF7" stroke="${INK}" stroke-width="${f1(0.8 * s)}"/>`;
  }
  return o + `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r * 0.3)}" fill="#F7C548"/>`;
}
/** selimut cembung titik-titik layar (untuk badan kendang & batang pisang yang tidur) */
function hull(pts: Pt[]) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: Pt[] = [], hi: Pt[] = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}
/**
 * Prisma tegak beralas segi-banyak cembung (koordinat petak). Sisi yang menghadap kamera dipilih dari arah tepinya
 * di layar, jadi benar juga untuk tampak belakang (titik dicerminkan lewat g.iso). Warna sisi seperti g.box.
 */
function prism(g: Ctx, base: number[][], z0: number, h: number, c3: string[], sw = 1.6) {
  const lo = base.map(([u, v]) => at3(g, u, v, z0)), hi = base.map(([u, v]) => at3(g, u, v, z0 + h));
  const n = lo.length, cx = lo.reduce((a, p) => a + p[0], 0) / n, cy = lo.reduce((a, p) => a + p[1], 0) / n;
  let o = '';
  for (let i = 0; i < n; i++) {
    const a = lo[i], b = lo[(i + 1) % n];
    let nx = b[1] - a[1], ny = a[0] - b[0];
    if (nx * ((a[0] + b[0]) / 2 - cx) + ny * ((a[1] + b[1]) / 2 - cy) < 0) { nx = -nx; ny = -ny; }
    if (ny > 1e-6) o += g.poly([a, b, hi[(i + 1) % n], hi[i]], nx < 0 ? c3[1] : c3[2], sw);
  }
  return o + g.poly(hi, c3[0], sw);
}
/**
 * Tabung tegak beralas elips (sumbu x & y petak): sisi depan dua warna (kiri terang, kanan gelap) seperti balok.
 * Hasil: gambar sisi, cincin atas, dan titik-titik busur depan (untuk bilah, simpai, ...).
 */
function ovalTub(g: Ctx, cu: number, cv: number, rx: number, ry: number, z0: number, h: number, c3: string[], sw = 1.6) {
  const N = 40;
  const ring = (z: number, ex = 0) => Array.from({ length: N }, (_, i) => { const a = (i / N) * 2 * Math.PI; return at3(g, cu + (rx - ex) * Math.cos(a), cv + (ry - ex) * Math.sin(a), z); });
  const lo = ring(z0), hi = ring(z0 + h);
  let iL = 0, iR = 0, iF = 0;
  lo.forEach((p, i) => { if (p[0] < lo[iL][0]) iL = i; if (p[0] > lo[iR][0]) iR = i; if (p[1] > lo[iF][1]) iF = i; });
  // busur depan iL → iF → iR (arah yang melewati titik terdepan)
  const walk = (a: number, b: number, dir: number) => { const out = [a]; for (let i = a; i !== b; ) { i = (i + dir + N) % N; out.push(i); } return out; };
  let arc = walk(iL, iR, 1);
  if (!arc.includes(iF)) arc = walk(iL, iR, -1);
  const k = arc.indexOf(iF), left = arc.slice(0, k + 1), right = arc.slice(k);
  const face = (ids: number[], fill: string) => g.poly([...ids.map((i) => lo[i]), ...ids.slice().reverse().map((i) => hi[i])], fill, sw);
  return { side: face(left, c3[1]) + face(right, c3[2]), top: g.poly(hi, c3[0], sw), ring, arc, lo, hi };
}
/** benda bulat bubut (gentong, pot, dandang): profil [[z px, jari-jari petak], ...] dari bawah ke atas */
function lathe(g: Ctx, cu: number, cv: number, prof: number[][], fill: string, sw = 1.6) {
  const [cx, cy] = g.iso(cu, cv), k = rk(g), s = g.s;
  const L = prof.map(([z, r]) => [cx - r * k, cy - z * s]), R = prof.map(([z, r]) => [cx + r * k, cy - z * s]).reverse();
  const r0 = prof[0][1] * k;
  return `<path d="${pathOf(L)}L${P(R).replace(/ /g, 'L')}A${f1(r0)} ${f1(r0 / 2)} 0 0 1 ${f1(L[0][0])} ${f1(L[0][1])}Z" fill="${fill}" stroke="${INK}" stroke-width="${f1(sw * s)}" stroke-linejoin="round"/>`;
}
/** elips mendatar (lingkaran di bidang datar) setinggi z */
const flatE = (g: Ctx, cu: number, cv: number, z: number, r: number, fill: string, sw = 1.4, extra = '') => {
  const [cx, cy] = at3(g, cu, cv, z), R = r * rk(g);
  return `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(R)}" ry="${f1(R / 2)}" fill="${fill}"${sw ? ` stroke="${INK}" stroke-width="${f1(sw * g.s)}"` : ''}${extra}/>`;
};
/** busur depan (setengah bawah) lingkaran mendatar: simpai, cincin hiasan */
const frontArc = (g: Ctx, cu: number, cv: number, z: number, r: number, colr: string, w: number) => {
  const [cx, cy] = at3(g, cu, cv, z), R = r * rk(g);
  return `<path d="M${f1(cx - R)} ${f1(cy)}A${f1(R)} ${f1(R / 2)} 0 0 0 ${f1(cx + R)} ${f1(cy)}" fill="none" stroke="${colr}" stroke-width="${f1(w * g.s)}" stroke-linecap="round"/>`;
};
/** bidang tegak y = Y: (hx px ke arah x, vy px ke atas) dari titik (cu, v0) */
const onY = (g: Ctx, Y: number, cu: number, v0 = 0) => (hx: number, vy: number) => at3(g, cu + hx / 32, Y, v0 + vy);
/** bidang tegak x = X: (hx px ke arah y, vy px ke atas) */
const onX = (g: Ctx, X: number, cu: number, v0 = 0) => (hx: number, vy: number) => at3(g, X, cu + hx / 32, v0 + vy);
const discPts = (m: (a: number, b: number) => Pt, cx: number, cy: number, rx: number, ry = rx, n = 18) =>
  Array.from({ length: n }, (_, i) => { const a = (i / n) * 2 * Math.PI; return m(cx + rx * Math.cos(a), cy + ry * Math.sin(a)); });
/** wayang kulit (tokoh) menghadap +hx: titik-titik siluet dalam koordinat bidang (px) */
const WAYANG_BODY = [[-4, 0], [-7, 13], [-5, 17], [-4, 29], [-6, 39], [-4, 45], [-7, 50], [-6, 56], [-2, 63], [2, 58], [3, 54], [9, 49], [3, 47], [2, 44], [5, 39], [4, 29], [7, 17], [9, 0]];
const GUNUNGAN = [[-2, -6], [2, -6], [2, 6], [11, 9], [15, 20], [14, 34], [10, 46], [5, 56], [0, 66], [-5, 56], [-10, 46], [-14, 34], [-15, 20], [-11, 9], [-2, 6]];

const PREMIUM: Record<string, { label: string; colors: Record<string, string>; draw: FurnFn }> = {
  /* ---------------- alun-alun: tempat game main bareng ---------------- */
  tikarular: {
    label: 'Tikar ular tangga',
    colors: { main: '#E9D7A8', accent: '#C0392B' },
    draw(g, x, y, w, d, c) {
      const s = g.s, q = (u: number, v: number) => g.iso(x + u, y + v);
      let o = g.poly([q(0.06, 0.06), q(w - 0.06, 0.06), q(w - 0.06, d - 0.06), q(0.06, d - 0.06)], c.accent, 1.8);
      const m = 0.2, n = 6, cw = (w - 2 * m) / n, ch = (d - 2 * m) / n;
      const fills = ['#FFF4D6', '#DDF0E7', '#FFE1D6', '#E2ECFA'];
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++)
        o += `<polygon points="${P([q(m + i * cw, m + j * ch), q(m + (i + 1) * cw, m + j * ch), q(m + (i + 1) * cw, m + (j + 1) * ch), q(m + i * cw, m + (j + 1) * ch)])}" fill="${fills[(i + j) % 4]}" stroke="${shade(c.main, -0.25)}" stroke-width="0.8"/>`;
      // tangga bambu & ular di atas tikar
      const L = (a: number[], b: number[]) => [q(m + a[0] * cw, m + a[1] * ch), q(m + b[0] * cw, m + b[1] * ch)];
      for (const [a0, a1] of [L([1.5, 5.3], [2.5, 2.4]), L([4.6, 4.5], [3.6, 1.2])]) {
        o += `<line x1="${f1(a0[0] - 3 * s)}" y1="${f1(a0[1])}" x2="${f1(a1[0] - 3 * s)}" y2="${f1(a1[1])}" stroke="#B5902F" stroke-width="${f1(2.2 * s)}"/><line x1="${f1(a0[0] + 3 * s)}" y1="${f1(a0[1])}" x2="${f1(a1[0] + 3 * s)}" y2="${f1(a1[1])}" stroke="#B5902F" stroke-width="${f1(2.2 * s)}"/>`;
        for (let t = 0.15; t < 0.95; t += 0.2) o += `<line x1="${f1(a0[0] - 3 * s + (a1[0] - a0[0]) * t)}" y1="${f1(a0[1] + (a1[1] - a0[1]) * t)}" x2="${f1(a0[0] + 3 * s + (a1[0] - a0[0]) * t)}" y2="${f1(a0[1] + (a1[1] - a0[1]) * t)}" stroke="#B5902F" stroke-width="${f1(1.6 * s)}"/>`;
      }
      const [s0, s1] = L([0.8, 0.8], [2.2, 4.4]);
      o += `<path d="M${f1(s0[0])} ${f1(s0[1])}C${f1(s0[0] + 24 * s)} ${f1(s0[1] + 14 * s)} ${f1(s1[0] - 24 * s)} ${f1(s1[1] - 14 * s)} ${f1(s1[0])} ${f1(s1[1])}" fill="none" stroke="${INK}" stroke-width="${f1(5 * s)}" stroke-linecap="round"/><path d="M${f1(s0[0])} ${f1(s0[1])}C${f1(s0[0] + 24 * s)} ${f1(s0[1] + 14 * s)} ${f1(s1[0] - 24 * s)} ${f1(s1[1] - 14 * s)} ${f1(s1[0])} ${f1(s1[1])}" fill="none" stroke="#5FB36A" stroke-width="${f1(3 * s)}" stroke-linecap="round"/>`;
      return o;
    },
  },
  garisstart: {
    label: 'Garis start balap karung',
    colors: { main: '#E0583F', accent: '#FFFDF7' },
    draw(g, x, y, w, d, c) {
      const s = g.s, Y = y + d / 2;
      // garis putih di tanah
      const l0 = g.iso(x + 0.05, y + d - 0.12), l1 = g.iso(x + w - 0.05, y + d - 0.12);
      let o = `<line x1="${f1(l0[0])}" y1="${f1(l0[1])}" x2="${f1(l1[0])}" y2="${f1(l1[1])}" stroke="#FFFFFF" stroke-width="${f1(4 * s)}" stroke-linecap="round"/>`;
      const post = (xx: number) => g.box(xx, Y - 0.06, 0, 0.12, 0.12, 82, C3('#8A5A36'));
      o += post(x + 0.08);
      // spanduk kotak-kotak
      const a = g.iso(x + 0.14, Y), b = g.iso(x + w - 0.14, Y);
      const band = (v0: number, v1: number) => [[a[0], a[1] - v0 * s], [b[0], b[1] - v0 * s], [b[0], b[1] - v1 * s], [a[0], a[1] - v1 * s]];
      o += g.poly(band(58, 80), c.accent, 1.8);
      const N = 12;
      for (let k = 0; k < N; k++) for (const [r0, r1, odd] of [[58, 69, 0], [69, 80, 1]] as [number, number, number][]) {
        if ((k + odd) % 2) continue;
        const t0 = k / N, t1 = (k + 1) / N;
        const pt = (t: number, v: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - v * s];
        o += `<polygon points="${P([pt(t0, r0), pt(t1, r0), pt(t1, r1), pt(t0, r1)])}" fill="${INK}"/>`;
      }
      o += g.poly(band(58, 80).map((p) => p), 'none', 1.8);
      // bendera kecil di puncak tiang
      for (const xx of [x + 0.14, x + w - 0.14]) { const p = g.iso(xx, Y); o += `<path d="M${f1(p[0])} ${f1(p[1] - 82 * s)}v${f1(-16 * s)}l${f1(14 * s)} ${f1(5 * s)}l${f1(-14 * s)} ${f1(5 * s)}" fill="${c.main}" stroke="${INK}" stroke-width="${f1(1.4 * s)}" stroke-linejoin="round"/>`; }
      return o + post(x + w - 0.2);
    },
  },

  /* ---------------- Taman Malam ---------------- */
  kolamkoi: {
    label: 'Kolam koi bercahaya',
    colors: { main: '#A8A293', accent: '#2F6FA8' },
    draw(g, x, y, w, d, c) {
      const s = g.s, [cx, cy] = g.iso(x + w / 2, y + d / 2);
      const rx = (w + d) * 14.5 * s, ry = rx / 2;
      let o = shadowE(cx, cy + 4 * s, rx + 6 * s, ry + 4 * s);
      o += `<path d="M${f1(cx - rx)} ${f1(cy)}v${f1(-10 * s)}a${f1(rx)} ${f1(ry)} 0 0 0 ${f1(2 * rx)} 0v${f1(10 * s)}a${f1(rx)} ${f1(ry)} 0 0 1 ${f1(-2 * rx)} 0Z" fill="${shade(c.main, -0.12)}" stroke="${INK}" stroke-width="${f1(2 * s)}"/>`;
      o += `<ellipse cx="${f1(cx)}" cy="${f1(cy - 10 * s)}" rx="${f1(rx)}" ry="${f1(ry)}" fill="${c.main}" stroke="${INK}" stroke-width="${f1(2 * s)}"/>`;
      o += `<ellipse cx="${f1(cx)}" cy="${f1(cy - 10 * s)}" rx="${f1(rx - 9 * s)}" ry="${f1(ry - 5 * s)}" fill="${c.accent}" stroke="${INK}" stroke-width="${f1(1.6 * s)}"/>`;
      o += `<ellipse class="blink" cx="${f1(cx)}" cy="${f1(cy - 11 * s)}" rx="${f1(rx - 18 * s)}" ry="${f1(ry - 10 * s)}" fill="#7FD6F2" fill-opacity=".45"/>`;
      // batu di bibir kolam
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        o += `<ellipse cx="${f1(cx + Math.cos(a) * (rx - 4 * s))}" cy="${f1(cy - 10 * s + Math.sin(a) * (ry - 2 * s))}" rx="${f1(7 * s)}" ry="${f1(3.8 * s)}" fill="${k % 2 ? shade(c.main, 0.15) : shade(c.main, -0.05)}" stroke="${INK}" stroke-width="${f1(1.1 * s)}"/>`;
      }
      // teratai
      for (const [dx, dy, r] of [[-0.5, -0.3, 8], [0.45, 0.25, 7]]) {
        const px = cx + dx * rx * 0.7, py = cy - 10 * s + dy * ry * 0.7;
        o += `<path d="M${f1(px)} ${f1(py)}l${f1(r * s)} ${f1(-1.5 * s)}a${f1(r * s)} ${f1(r * s * 0.5)} 0 1 1 0 ${f1(3 * s)}Z" fill="#4FA36A" stroke="${INK}" stroke-width="${f1(1 * s)}"/>`;
      }
      o += `<circle cx="${f1(cx - rx * 0.35)}" cy="${f1(cy - 13 * s - ry * 0.2)}" r="${f1(3 * s)}" fill="#FF8FA3" stroke="${INK}" stroke-width="${f1(0.9 * s)}"/>`;
      // dua ikan koi berenang melingkar (kelas swim)
      o += `<g transform="translate(${f1(cx)} ${f1(cy - 10 * s)}) scale(1 .5)"><g class="swim" style="transform-origin:0 0">`;
      o += `<g transform="translate(${f1(rx * 0.42)} 0) rotate(90)">${koi(s, '#F2994A')}</g><g transform="translate(${f1(-rx * 0.42)} 0) rotate(-90)">${koi(s, '#FFFDF7')}</g></g></g>`;
      // lampu kecil di tepi
      for (const a of [0.15, 0.5, 0.85]) { const px = cx - rx + a * 2 * rx, py = cy - 10 * s + Math.sin(Math.acos(1 - 2 * a)) * ry; o += glowC(px, py - 6 * s, 7 * s, '#FFE7A0', 0.5, 'blink') + `<circle cx="${f1(px)}" cy="${f1(py - 6 * s)}" r="${f1(2.6 * s)}" fill="#FFE27A" stroke="${INK}" stroke-width="${f1(0.9 * s)}"/>`; }
      return o;
    },
  },
  pohonlampu: {
    label: 'Pohon lampu kelip',
    colors: { main: '#3E8E5A', accent: '#7A5232' },
    draw(g, x, y, w, d, c) {
      const s = g.s, [cx, cy] = g.iso(x + w / 2, y + d / 2);
      let o = shadowE(cx, cy, 28 * s, 11 * s) + g.box(x + w / 2 - 0.1, y + d / 2 - 0.1, 0, 0.2, 0.2, 46, C3(c.accent));
      o += `<g class="canopy" transform="translate(${f1(cx)} ${f1(cy)}) scale(.86) translate(${f1(-cx)} ${f1(-cy + 6 * s)})">`;
      for (const [dx, dy, r, k] of [[0, -104, 26, 0], [-20, -80, 23, 1], [20, -84, 22, 1], [-4, -66, 18, 0]])
        o += `<circle cx="${f1(cx + dx * s)}" cy="${f1(cy + dy * s)}" r="${f1(r * s)}" fill="${k ? shade(c.main, -0.15) : c.main}" stroke="${INK}" stroke-width="${f1(1.8 * s)}"/>`;
      o += `<path d="M${f1(cx - 34 * s)} ${f1(cy - 86 * s)}Q${f1(cx)} ${f1(cy - 66 * s)} ${f1(cx + 34 * s)} ${f1(cy - 92 * s)}M${f1(cx - 24 * s)} ${f1(cy - 112 * s)}Q${f1(cx + 2 * s)} ${f1(cy - 94 * s)} ${f1(cx + 22 * s)} ${f1(cy - 116 * s)}" fill="none" stroke="${INK}" stroke-width="${f1(1 * s)}" opacity=".6"/>`;
      const cols = ['#F7C548', '#FF8FA3', '#9FE3FF', '#FFFDF7'];
      [[-30, -84], [-16, -78], [0, -76], [16, -80], [30, -88], [-20, -108], [-8, -102], [6, -102], [18, -110], [-6, -124], [8, -126]].forEach(([dx, dy], i) => {
        o += `<circle class="blink" style="animation-delay:-${(i * 0.37).toFixed(2)}s" cx="${f1(cx + dx * s)}" cy="${f1(cy + dy * s)}" r="${f1(3.2 * s)}" fill="${cols[i % 4]}" stroke="${INK}" stroke-width="${f1(0.8 * s)}"/>`;
      });
      return o + `</g>`;
    },
  },
  lenterastupa: {
    label: 'Lentera stupa',
    colors: { main: '#B9B3A4', accent: '#FFD27A' },
    draw(g, x, y, w, d, c) {
      const s = g.s, [cx, cy] = g.iso(x + w / 2, y + d / 2);
      let o = shadowE(cx, cy, 20 * s, 8 * s) + g.box(x + 0.27, y + 0.27, 0, 0.46, 0.46, 9, C3(shade(c.main, -0.1)));
      o += g.box(x + 0.33, y + 0.33, 9, 0.34, 0.34, 6, C3(c.main));
      o += glowC(cx, cy - 34 * s, 22 * s, c.accent, 0.35, 'blink');
      o += `<path d="M${f1(cx - 15 * s)} ${f1(cy - 15 * s)}Q${f1(cx - 17 * s)} ${f1(cy - 44 * s)} ${f1(cx)} ${f1(cy - 52 * s)}Q${f1(cx + 17 * s)} ${f1(cy - 44 * s)} ${f1(cx + 15 * s)} ${f1(cy - 15 * s)}Z" fill="${c.main}" stroke="${INK}" stroke-width="${f1(1.7 * s)}" stroke-linejoin="round"/>`;
      o += `<path d="M${f1(cx - 7 * s)} ${f1(cy - 28 * s)}l${f1(7 * s)} ${f1(-8 * s)} ${f1(7 * s)} ${f1(8 * s)} ${f1(-7 * s)} ${f1(8 * s)}Z" fill="${c.accent}" stroke="${INK}" stroke-width="${f1(1.3 * s)}"/>`;
      o += `<path d="M${f1(cx - 4 * s)} ${f1(cy - 28 * s)}h${f1(8 * s)}M${f1(cx)} ${f1(cy - 33 * s)}v${f1(10 * s)}" stroke="${shade(c.accent, -0.35)}" stroke-width="${f1(1 * s)}"/>`;
      o += `<rect x="${f1(cx - 3 * s)}" y="${f1(cy - 66 * s)}" width="${f1(6 * s)}" height="${f1(15 * s)}" rx="${f1(1.5 * s)}" fill="${shade(c.main, -0.1)}" stroke="${INK}" stroke-width="${f1(1.3 * s)}"/><circle cx="${f1(cx)}" cy="${f1(cy - 68 * s)}" r="${f1(3.5 * s)}" fill="${c.main}" stroke="${INK}" stroke-width="${f1(1.2 * s)}"/>`;
      return o;
    },
  },
  jembatan: {
    label: 'Jembatan kayu',
    colors: { main: '#C0392B', accent: '#B5703F' },
    draw(g, x, y, w, d, c) {
      const s = g.s, y0 = y + 0.2, y1 = y + d - 0.2, N = 12;
      const h = (t: number) => (6 + 16 * Math.sin(Math.PI * t)) * s;
      const pt = (t: number, yy: number, up = 0) => { const p = g.iso(x + 0.05 + t * (w - 0.1), yy); return [p[0], p[1] - h(t) - up * s]; };
      let o = '';
      const rail = (yy: number) => {
        let r = '';
        for (let k = 0; k <= 4; k++) { const t = k / 4, a = pt(t, yy), b = pt(t, yy, 20); r += `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${INK}" stroke-width="${f1(4.6 * s)}" stroke-linecap="round"/><line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${c.main}" stroke-width="${f1(2.6 * s)}" stroke-linecap="round"/>`; }
        const top = Array.from({ length: N + 1 }, (_, k) => pt(k / N, yy, 20));
        r += `<polyline points="${P(top)}" fill="none" stroke="${INK}" stroke-width="${f1(5 * s)}" stroke-linecap="round" stroke-linejoin="round"/><polyline points="${P(top)}" fill="none" stroke="${c.main}" stroke-width="${f1(3 * s)}" stroke-linecap="round" stroke-linejoin="round"/>`;
        return r;
      };
      o += rail(y0);
      const far = Array.from({ length: N + 1 }, (_, k) => pt(k / N, y0));
      const near = Array.from({ length: N + 1 }, (_, k) => pt(k / N, y1));
      const nearLow = near.map((p) => [p[0], p[1] + 7 * s]);
      o += g.poly([...far, ...near.slice().reverse()], c.accent);
      o += g.poly([...near, ...nearLow.slice().reverse()], shade(c.accent, -0.25));
      for (let k = 1; k < N; k++) { const a = far[k], b = near[k]; o += `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${shade(c.accent, -0.3)}" stroke-width="${f1(1.1 * s)}"/>`; }
      return o + rail(y1);
    },
  },
  topleskunang: {
    label: 'Toples kunang-kunang',
    colors: { main: '#DFF3FF', accent: '#8A5A36' },
    draw(g, x, y, w, d, c) {
      const s = g.s, [cx, cy] = g.iso(x + w / 2, y + d / 2);
      let o = shadowE(cx, cy, 18 * s, 7 * s) + g.box(x + 0.3, y + 0.3, 0, 0.4, 0.4, 16, C3(c.accent));
      const top = cy - 16 * s;
      o += glowC(cx, top - 18 * s, 24 * s, '#F4FFB0', 0.4, 'blink');
      o += `<path d="M${f1(cx - 12 * s)} ${f1(top)}V${f1(top - 28 * s)}q0 ${f1(-6 * s)} ${f1(6 * s)} ${f1(-6 * s)}h${f1(12 * s)}q${f1(6 * s)} 0 ${f1(6 * s)} ${f1(6 * s)}V${f1(top)}Z" fill="${c.main}" fill-opacity=".55" stroke="${INK}" stroke-width="${f1(1.6 * s)}"/>`;
      o += `<rect x="${f1(cx - 9 * s)}" y="${f1(top - 39 * s)}" width="${f1(18 * s)}" height="${f1(6 * s)}" rx="${f1(2 * s)}" fill="#C8955A" stroke="${INK}" stroke-width="${f1(1.3 * s)}"/>`;
      [[-5, -8], [4, -14], [-2, -21], [6, -25], [-6, -27]].forEach(([dx, dy], i) => {
        o += `<circle class="blink" style="animation-delay:-${(i * 0.45).toFixed(2)}s" cx="${f1(cx + dx * s)}" cy="${f1(top + dy * s)}" r="${f1(2.3 * s)}" fill="#EFFF7A"/>`;
      });
      return o + `<path d="M${f1(cx - 9 * s)} ${f1(top - 4 * s)}v${f1(-20 * s)}" stroke="#FFFFFF" stroke-width="${f1(1.6 * s)}" opacity=".7"/>`;
    },
  },

  /* ---------------- Keraton ---------------- */
  gamelan: {
    label: 'Gamelan mini',
    colors: { main: '#8E2A1E', accent: '#D9A441' },
    draw(g, x, y, w, d, c) {
      const s = g.s;
      const gold = '#E9B949';
      let o = g.box(x + 0.06, y + 0.22, 0, 0.16, d - 0.44, 34, C3(c.main)) + g.box(x + w - 0.22, y + 0.22, 0, 0.16, d - 0.44, 34, C3(c.main));
      o += g.box(x + 0.06, y + 0.22, 34, 0.16, d - 0.44, 4, C3(gold)) + g.box(x + w - 0.22, y + 0.22, 34, 0.16, d - 0.44, 4, C3(gold));
      o += g.box(x + 0.2, y + 0.26, 0, w - 0.4, d - 0.52, 22, C3(c.main));
      o += g.quadY(y + d - 0.26, x + 0.2, x + w - 0.2, 15, 18, gold, 0);
      o += g.quadY(y + d - 0.26, x + 0.2, x + w - 0.2, 5, 7, gold, 0);
      const n = 7, bw = (w - 0.5) / n;
      for (let i = 0; i < n; i++) o += g.box(x + 0.25 + i * bw, y + 0.32, 22, bw - 0.05, d - 0.64, 4 + (n - i) * 0.6, C3(c.accent));
      // pemukul
      const [mx, my] = g.iso(x + w * 0.62, y + d - 0.3);
      return o + `<line x1="${f1(mx)}" y1="${f1(my - 30 * s)}" x2="${f1(mx + 16 * s)}" y2="${f1(my - 44 * s)}" stroke="#7A5232" stroke-width="${f1(2.4 * s)}" stroke-linecap="round"/><ellipse cx="${f1(mx)}" cy="${f1(my - 29 * s)}" rx="${f1(4 * s)}" ry="${f1(3 * s)}" fill="${gold}" stroke="${INK}" stroke-width="${f1(1 * s)}"/>`;
    },
  },
  kursiraja: {
    label: 'Kursi raja ukir',
    colors: { main: '#6B3F22', accent: '#C0392B' },
    draw(g, x, y, w, d, c) {
      const s = g.s, gold = '#E9B949';
      let o = g.box(x + 0.12, y + 0.12, 0, 0.76, 0.14, 70, C3(c.main));
      const crest = [0, 0.18, 0.32, 0.5, 0.68, 0.82, 1].map((t, i) => { const p = g.iso(x + 0.12 + t * 0.76, y + 0.19); return [p[0], p[1] - (70 + (i % 2 ? 6 : 0) + (i === 3 ? 12 : 0)) * s]; });
      const b0 = g.iso(x + 0.12, y + 0.19), b1 = g.iso(x + 0.88, y + 0.19);
      o += g.poly([[b0[0], b0[1] - 68 * s], ...crest, [b1[0], b1[1] - 68 * s]], gold);
      o += g.quadY(y + 0.26, x + 0.2, x + 0.8, 30, 62, c.accent, 1.2);
      o += g.box(x + 0.12, y + 0.26, 0, 0.76, 0.62, 18, C3(c.main));
      o += g.box(x + 0.18, y + 0.3, 18, 0.64, 0.54, 6, C3(c.accent));
      o += g.box(x + 0.12, y + 0.26, 18, 0.1, 0.62, 16, C3(c.main)) + g.box(x + 0.78, y + 0.26, 18, 0.1, 0.62, 16, C3(c.main));
      o += g.box(x + 0.12, y + 0.26, 34, 0.1, 0.62, 3, C3(gold)) + g.box(x + 0.78, y + 0.26, 34, 0.1, 0.62, 3, C3(gold));
      return o + g.quadY(y + 0.88, x + 0.12, x + 0.88, 7, 10, gold, 0);
    },
  },
  gebyok: {
    label: 'Sekat gebyok ukir',
    colors: { main: '#7A4A2A', accent: '#E9B949' },
    draw(g, x, y, w, d, c) {
      const s = g.s, Y = y + d / 2 + 0.07;
      let o = g.box(x + 0.05, y + d / 2 - 0.07, 0, w - 0.1, 0.14, 100, C3(c.main));
      // ukiran: motif kawung berulang di sisi depan
      for (let u = x + 0.22; u < x + w - 0.1; u += 0.32)
        for (let v = 18; v < 92; v += 18) {
          const p = g.iso(u, Y), px = p[0], py = p[1] - v * s;
          for (const [ox, oy] of [[-3.6, 0], [3.6, 0], [0, -4.2], [0, 4.2]])
            o += `<ellipse cx="${f1(px + ox * s)}" cy="${f1(py + oy * s)}" rx="${f1((ox ? 3 : 2.4) * s)}" ry="${f1((ox ? 2.4 : 3) * s)}" fill="${shade(c.main, -0.3)}"/>`;
          o += `<circle cx="${f1(px)}" cy="${f1(py)}" r="${f1(1.2 * s)}" fill="${c.accent}"/>`;
        }
      const crest = Array.from({ length: 9 }, (_, i) => { const t = i / 8, p = g.iso(x + 0.05 + t * (w - 0.1), Y); return [p[0], p[1] - (100 + 14 * Math.sin(Math.PI * t) + (i % 2 ? 0 : 3)) * s]; });
      const a = g.iso(x + 0.05, Y), b = g.iso(x + w - 0.05, Y);
      return o + g.poly([[a[0], a[1] - 100 * s], ...crest, [b[0], b[1] - 100 * s]], c.accent);
    },
  },
  lampukuningan: {
    label: 'Lampu kuningan',
    colors: { main: '#D9A441', accent: '#FFF1C4' },
    draw(g, x, y, w, d, c) {
      const s = g.s, [cx, cy] = g.iso(x + 0.5, y + 0.5);
      let o = shadowE(cx, cy, 16 * s, 6 * s) + glowC(cx, cy - 78 * s, 30 * s, '#FFE7A0', 0.45, 'blink');
      o += `<ellipse cx="${f1(cx)}" cy="${f1(cy - 2 * s)}" rx="${f1(12 * s)}" ry="${f1(5 * s)}" fill="${shade(c.main, -0.15)}" stroke="${INK}" stroke-width="${f1(1.5 * s)}"/>`;
      o += `<path d="M${f1(cx)} ${f1(cy - 4 * s)}V${f1(cy - 64 * s)}" stroke="${INK}" stroke-width="${f1(4.6 * s)}"/><path d="M${f1(cx)} ${f1(cy - 4 * s)}V${f1(cy - 64 * s)}" stroke="${c.main}" stroke-width="${f1(2.6 * s)}"/>`;
      for (const v of [22, 44]) o += `<ellipse cx="${f1(cx)}" cy="${f1(cy - v * s)}" rx="${f1(4.5 * s)}" ry="${f1(3 * s)}" fill="${c.main}" stroke="${INK}" stroke-width="${f1(1.2 * s)}"/>`;
      o += `<path d="M${f1(cx - 18 * s)} ${f1(cy - 66 * s)}Q${f1(cx - 16 * s)} ${f1(cy - 92 * s)} ${f1(cx)} ${f1(cy - 96 * s)}Q${f1(cx + 16 * s)} ${f1(cy - 92 * s)} ${f1(cx + 18 * s)} ${f1(cy - 66 * s)}Z" fill="${c.accent}" stroke="${INK}" stroke-width="${f1(1.7 * s)}" stroke-linejoin="round"/>`;
      o += `<path d="M${f1(cx - 18 * s)} ${f1(cy - 66 * s)}h${f1(36 * s)}" stroke="${c.main}" stroke-width="${f1(3.4 * s)}" stroke-linecap="round"/><circle cx="${f1(cx)}" cy="${f1(cy - 98 * s)}" r="${f1(3.4 * s)}" fill="${c.main}" stroke="${INK}" stroke-width="${f1(1.1 * s)}"/>`;
      for (const dx of [-14, -5, 5, 14]) o += `<path d="M${f1(cx + dx * s)} ${f1(cy - 66 * s)}v${f1(7 * s)}" stroke="${c.main}" stroke-width="${f1(1.6 * s)}"/>`;
      return o;
    },
  },
  karpetparang: {
    label: 'Karpet batik parang',
    colors: { main: '#6B3F22', accent: '#F3E3B5' },
    draw(g, x, y, w, d, c) {
      const s = g.s;
      const q = (a: number, b: number) => g.iso(x + a, y + b);
      let o = g.poly([q(0.08, 0.08), q(w - 0.08, 0.08), q(w - 0.08, d - 0.08), q(0.08, d - 0.08)], c.accent, 1.8);
      o += g.poly([q(0.2, 0.2), q(w - 0.2, 0.2), q(w - 0.2, d - 0.2), q(0.2, d - 0.2)], c.main, 1.2);
      // garis parang miring (pola S berulang)
      let lines = '';
      for (let k = -d + 0.35; k < w - 0.2; k += 0.32) {
        const pts: number[][] = [];
        for (let t = 0; t <= 1.001; t += 0.05) {
          const a = k + t * (d - 0.4), b = 0.2 + t * (d - 0.4);
          if (a < 0.22 || a > w - 0.22) continue;
          const wob = Math.sin(t * Math.PI * 6) * 0.04;
          pts.push(q(a + wob, b - wob));
        }
        if (pts.length > 1) lines += `<polyline points="${P(pts)}" fill="none" stroke="${c.accent}" stroke-width="${f1(2.4 * s)}" stroke-linecap="round"/>`;
      }
      return o + lines;
    },
  },

  /* ---------------- Kafe Kopi Kampung ---------------- */
  mesinkopi: {
    label: 'Mesin kopi',
    colors: { main: '#C9CED6', accent: '#8A5A36' },
    draw(g, x, y, w, d, c) {
      const s = g.s;
      let o = g.box(x + 0.08, y + 0.1, 0, 0.84, 0.8, 40, C3(c.accent));
      o += g.quadY(y + 0.9, x + 0.14, x + 0.86, 6, 34, shade(c.accent, -0.12), 1);
      o += g.box(x + 0.04, y + 0.06, 40, 0.92, 0.88, 4, C3('#C48A55'));
      o += g.box(x + 0.22, y + 0.2, 44, 0.56, 0.5, 34, C3(c.main));
      o += g.box(x + 0.22, y + 0.2, 78, 0.56, 0.5, 4, C3('#C0392B'));
      o += g.quadY(y + 0.7, x + 0.32, x + 0.68, 58, 72, '#2B2F4A', 1);
      if (g.back) return o; // dari belakang: lampu, corong & cangkir di depan tidak terlihat
      const [px, py] = g.iso(x + 0.5, y + 0.7);
      o += `<circle cx="${f1(px - 8 * s)}" cy="${f1(py - 65 * s)}" r="${f1(3 * s)}" fill="#7FC4E8"/><circle cx="${f1(px + 8 * s)}" cy="${f1(py - 65 * s)}" r="${f1(3 * s)}" fill="#F2B632"/>`;
      o += `<rect x="${f1(px - 5 * s)}" y="${f1(py - 55 * s)}" width="${f1(10 * s)}" height="${f1(6 * s)}" fill="#3B3F55" stroke="${INK}" stroke-width="${f1(1 * s)}"/>`;
      o += `<path d="M${f1(px - 6 * s)} ${f1(py - 46 * s)}h${f1(12 * s)}l${f1(-1.5 * s)} ${f1(8 * s)}h${f1(-9 * s)}Z" fill="#FFFDF7" stroke="${INK}" stroke-width="${f1(1.2 * s)}"/>`;
      for (const dx of [-3, 3]) o += `<path class="water" d="M${f1(px + dx * s)} ${f1(py - 48 * s)}q${f1(-4 * s)} ${f1(-8 * s)} 0 ${f1(-16 * s)}" fill="none" stroke="#FFFFFF" stroke-width="${f1(2 * s)}" stroke-linecap="round" stroke-dasharray="${f1(4 * s)} ${f1(4 * s)}" opacity=".9"/>`;
      return o;
    },
  },
  mejabar: {
    label: 'Meja bar kayu',
    colors: { main: '#6B4A2B', accent: '#C48A55' },
    draw(g, x, y, w, d, c) {
      const s = g.s;
      let o = g.box(x + 0.06, y + 0.24, 0, w - 0.12, d - 0.48, 46, C3(c.main));
      for (let u = x + 0.2; u < x + w - 0.1; u += 0.18) {
        const a = g.iso(u, y + d - 0.24), b = a;
        o += `<line x1="${f1(a[0])}" y1="${f1(a[1] - 4 * s)}" x2="${f1(b[0])}" y2="${f1(b[1] - 40 * s)}" stroke="${shade(c.main, -0.3)}" stroke-width="${f1(1.2 * s)}"/>`;
      }
      o += g.box(x, y + 0.14, 46, w, d - 0.28, 5, C3(c.accent));
      const [jx, jy] = g.iso(x + w - 0.45, y + d / 2);
      o += `<path d="M${f1(jx - 7 * s)} ${f1(jy - 51 * s)}v${f1(-14 * s)}q0 ${f1(-4 * s)} ${f1(4 * s)} ${f1(-4 * s)}h${f1(6 * s)}q${f1(4 * s)} 0 ${f1(4 * s)} ${f1(4 * s)}v${f1(14 * s)}Z" fill="#E8F4FA" fill-opacity=".7" stroke="${INK}" stroke-width="${f1(1.2 * s)}"/><circle cx="${f1(jx - 2 * s)}" cy="${f1(jy - 56 * s)}" r="${f1(2.6 * s)}" fill="#C8955A"/><circle cx="${f1(jx + 3 * s)}" cy="${f1(jy - 59 * s)}" r="${f1(2.6 * s)}" fill="#C8955A"/>`;
      const [kx, ky] = g.iso(x + 0.45, y + d / 2);
      return o + `<path d="M${f1(kx - 5 * s)} ${f1(ky - 51 * s)}h${f1(10 * s)}l${f1(-1.4 * s)} ${f1(-9 * s)}h${f1(-7.2 * s)}Z" fill="#FFFDF7" stroke="${INK}" stroke-width="${f1(1.1 * s)}"/><path d="M${f1(kx + 5 * s)} ${f1(ky - 57 * s)}q${f1(5 * s)} ${f1(1 * s)} 0 ${f1(4 * s)}" fill="none" stroke="${INK}" stroke-width="${f1(1.1 * s)}"/>`;
    },
  },
  raktoples: {
    label: 'Rak toples kerupuk',
    colors: { main: '#8A5A36', accent: '#E0583F' },
    draw(g, x, y, w, d, c) {
      const s = g.s;
      let o = g.box(x + 0.15, y + 0.2, 0, 0.7, 0.6, 84, C3(c.main));
      const Y = y + 0.8;
      for (const [a, b] of [[6, 30], [32, 56], [58, 82]]) o += g.quadY(Y, x + 0.2, x + 0.8, a, b, shade(c.main, -0.35), 1);
      const lids = [c.accent, '#3F7FBF', '#3FA06A'];
      [[6, 30], [32, 56], [58, 82]].forEach(([a], si) => {
        for (const u of [0.32, 0.6]) {
          const p = g.iso(x + u + 0.06, Y), px = p[0], py = p[1] - (a + 1) * s;
          o += `<rect x="${f1(px - 7 * s)}" y="${f1(py - 19 * s)}" width="${f1(14 * s)}" height="${f1(18 * s)}" rx="${f1(4 * s)}" fill="#EAF5FA" fill-opacity=".85" stroke="${INK}" stroke-width="${f1(1.1 * s)}"/>`;
          o += `<circle cx="${f1(px - 2 * s)}" cy="${f1(py - 7 * s)}" r="${f1(3.4 * s)}" fill="#F3D9A0"/><circle cx="${f1(px + 3 * s)}" cy="${f1(py - 10 * s)}" r="${f1(3 * s)}" fill="#E9C27A"/>`;
          o += `<rect x="${f1(px - 6 * s)}" y="${f1(py - 22 * s)}" width="${f1(12 * s)}" height="${f1(4 * s)}" rx="${f1(1.5 * s)}" fill="${lids[(si + (u > 0.5 ? 1 : 0)) % 3]}" stroke="${INK}" stroke-width="${f1(1 * s)}"/>`;
        }
      });
      return o;
    },
  },
  papanmenu: {
    label: 'Papan menu kapur',
    colors: { main: '#2F3A36', accent: '#B5703F' },
    draw(g, x, y, w, d, c) {
      const s = g.s, Y = y + 0.6;
      let o = shadowE(...(g.iso(x + 0.5, y + 0.5) as [number, number]), 18 * s, 7 * s);
      const L = g.iso(x + 0.22, Y), R = g.iso(x + 0.78, Y);
      o += `<path d="M${f1(L[0])} ${f1(L[1])}L${f1(L[0] + 6 * s)} ${f1(L[1] - 72 * s)}M${f1(R[0])} ${f1(R[1])}L${f1(R[0] - 6 * s)} ${f1(R[1] - 72 * s)}" stroke="${INK}" stroke-width="${f1(4.6 * s)}" stroke-linecap="round"/><path d="M${f1(L[0])} ${f1(L[1])}L${f1(L[0] + 6 * s)} ${f1(L[1] - 72 * s)}M${f1(R[0])} ${f1(R[1])}L${f1(R[0] - 6 * s)} ${f1(R[1] - 72 * s)}" stroke="${c.accent}" stroke-width="${f1(2.6 * s)}" stroke-linecap="round"/>`;
      o += g.quadY(Y, x + 0.25, x + 0.75, 20, 70, c.main, 1.4);
      o += g.quadY(Y, x + 0.25, x + 0.75, 66, 70, c.accent, 1.2);
      const m = g.iso(x + 0.5, Y), mx = m[0], my = m[1];
      o += `<g stroke="#F4F1E8" stroke-width="${f1(1.4 * s)}" fill="none" stroke-linecap="round"><path d="M${f1(mx - 10 * s)} ${f1(my - 58 * s)}h${f1(9 * s)}M${f1(mx + 3 * s)} ${f1(my - 58 * s)}h${f1(7 * s)}"/><path d="M${f1(mx - 10 * s)} ${f1(my - 48 * s)}h${f1(14 * s)}M${f1(mx - 10 * s)} ${f1(my - 41 * s)}h${f1(11 * s)}"/><path d="M${f1(mx - 6 * s)} ${f1(my - 32 * s)}h${f1(8 * s)}l${f1(-1 * s)} ${f1(6 * s)}h${f1(-6 * s)}Z"/><path d="M${f1(mx - 3 * s)} ${f1(my - 35 * s)}q${f1(-2 * s)} ${f1(-3 * s)} 0 ${f1(-6 * s)}"/></g>`;
      return o;
    },
  },
  lampuedison: {
    label: 'Lampu edison',
    colors: { main: '#2B2F4A', accent: '#FFE7A0' },
    draw(g, x, y, w, d, c) {
      const s = g.s, [cx, cy] = g.iso(x + 0.5, y + 0.5);
      let o = shadowE(cx, cy, 18 * s, 7 * s);
      o += `<path d="M${f1(cx - 12 * s)} ${f1(cy + 2 * s)}L${f1(cx)} ${f1(cy - 20 * s)}L${f1(cx + 12 * s)} ${f1(cy + 2 * s)}M${f1(cx)} ${f1(cy - 20 * s)}V${f1(cy - 96 * s)}h${f1(30 * s)}" fill="none" stroke="${c.main}" stroke-width="${f1(3.4 * s)}" stroke-linecap="round" stroke-linejoin="round"/>`;
      [[8, 70], [18, 62], [28, 74]].forEach(([dx, v], i) => {
        const bx = cx + dx * s, by = cy - v * s;
        o += `<line x1="${f1(bx)}" y1="${f1(cy - 96 * s)}" x2="${f1(bx)}" y2="${f1(by - 9 * s)}" stroke="${INK}" stroke-width="${f1(1.1 * s)}"/>`;
        o += glowC(bx, by, 12 * s, c.accent, 0.5, 'blink').replace('class="blink"', `class="blink" style="animation-delay:-${i * 0.6}s"`);
        o += `<rect x="${f1(bx - 2.5 * s)}" y="${f1(by - 10 * s)}" width="${f1(5 * s)}" height="${f1(4 * s)}" fill="#8A6A3A" stroke="${INK}" stroke-width="${f1(0.8 * s)}"/><ellipse cx="${f1(bx)}" cy="${f1(by)}" rx="${f1(5 * s)}" ry="${f1(6.5 * s)}" fill="${c.accent}" stroke="${INK}" stroke-width="${f1(1 * s)}"/><path d="M${f1(bx - 2 * s)} ${f1(by + 1 * s)}l${f1(1 * s)} ${f1(-4 * s)} ${f1(1 * s)} ${f1(3 * s)} ${f1(1 * s)} ${f1(-3 * s)} ${f1(1 * s)} ${f1(4 * s)}" fill="none" stroke="#E08A2E" stroke-width="${f1(0.8 * s)}"/>`;
      });
      return o;
    },
  },

  /* ---------------- Pantai ---------------- */
  hammock: {
    label: 'Hammock',
    colors: { main: '#E0583F', accent: '#F7C548' },
    draw(g, x, y, w, d, c) {
      const s = g.s, yy = y + d / 2;
      const post = (xx: number) => g.box(xx, yy - 0.07, 0, 0.14, 0.14, 76, C3('#C9A35A')) + [18, 40, 62].map((v) => g.quadY(yy + 0.07, xx, xx + 0.14, v, v + 2, '#8A6A3A', 0)).join('');
      let o = shadowE(...(g.iso(x + w / 2, yy) as [number, number]), (w * 26) * s, 10 * s) + post(x + 0.04);
      const a = g.iso(x + 0.2, yy), b = g.iso(x + w - 0.2, yy), m = g.iso(x + w / 2, yy);
      const A = [a[0], a[1] - 60 * s], B = [b[0], b[1] - 60 * s];
      const sag = 34;
      o += `<g class="swing" style="transform-origin:${f1(m[0])}px ${f1(m[1] - 64 * s)}px">`;
      // kain: tepi atas melengkung sampai ±36 px di tengah, tepi bawah ±20 px (kain tebal & terlihat jelas)
      o += `<path d="M${f1(A[0])} ${f1(A[1])}Q${f1(m[0])} ${f1(m[1] - 12 * s)} ${f1(B[0])} ${f1(B[1])}Q${f1(m[0])} ${f1(m[1] + 20 * s)} ${f1(A[0])} ${f1(A[1])}Z" fill="${c.main}" stroke="${INK}" stroke-width="${f1(1.8 * s)}" stroke-linejoin="round"/>`;
      for (const t of [0.3, 0.5, 0.7]) {
        const px = A[0] + (B[0] - A[0]) * t, py = A[1] + (B[1] - A[1]) * t + Math.sin(Math.PI * t) * 30 * s;
        o += `<path d="M${f1(px)} ${f1(py - 6 * s)}v${f1(12 * s)}" stroke="${c.accent}" stroke-width="${f1(4 * s)}"/>`;
      }
      o += `<ellipse cx="${f1(A[0] + (B[0] - A[0]) * 0.24)}" cy="${f1(A[1] + (B[1] - A[1]) * 0.24 + 14 * s)}" rx="${f1(10 * s)}" ry="${f1(5.5 * s)}" fill="#FFFDF7" stroke="${INK}" stroke-width="${f1(1.3 * s)}"/></g>`;
      return o + post(x + w - 0.18);
    },
  },
  kursipantai: {
    label: 'Kursi pantai',
    colors: { main: '#3F7FBF', accent: '#FFFDF7' },
    draw(g, x, y, w, d, c) {
      const s = g.s;
      const pt = (a: number, b: number, v: number) => { const p = g.iso(x + a, y + b); return [p[0], p[1] - v * s]; };
      let o = shadowE(...(g.iso(x + 0.5, y + 0.55) as [number, number]), 22 * s, 9 * s);
      const wood = '#B5703F';
      for (const a of [0.18, 0.82]) o += `<polyline points="${P([pt(a, 0.9, 0), pt(a, 0.5, 16), pt(a, 0.2, 44)])}" fill="none" stroke="${INK}" stroke-width="${f1(4.4 * s)}" stroke-linecap="round" stroke-linejoin="round"/><polyline points="${P([pt(a, 0.9, 0), pt(a, 0.5, 16), pt(a, 0.2, 44)])}" fill="none" stroke="${wood}" stroke-width="${f1(2.4 * s)}" stroke-linecap="round" stroke-linejoin="round"/>`;
      // kain bergaris
      const cloth = [pt(0.2, 0.86, 12), pt(0.8, 0.86, 12), pt(0.8, 0.52, 14), pt(0.8, 0.24, 42), pt(0.2, 0.24, 42), pt(0.2, 0.52, 14)];
      o += g.poly(cloth, c.main, 1.6);
      for (const a of [0.35, 0.5, 0.65]) o += `<polyline points="${P([pt(a, 0.86, 12), pt(a, 0.52, 14), pt(a, 0.24, 42)])}" fill="none" stroke="${c.accent}" stroke-width="${f1(4 * s)}"/>`;
      return o;
    },
  },
  papanselancar: {
    label: 'Papan selancar',
    colors: { main: '#7FC4E8', accent: '#F7C548' },
    draw(g, x, y, w, d, c) {
      const s = g.s, [cx, cy] = g.iso(x + 0.5, y + 0.5);
      let o = shadowE(cx, cy, 16 * s, 6 * s) + g.box(x + 0.3, y + 0.35, 0, 0.4, 0.3, 6, C3('#B5703F'));
      o += `<g transform="rotate(10 ${f1(cx)} ${f1(cy - 46 * s)})"><path d="M${f1(cx)} ${f1(cy - 6 * s)}C${f1(cx - 14 * s)} ${f1(cy - 20 * s)} ${f1(cx - 14 * s)} ${f1(cy - 72 * s)} ${f1(cx)} ${f1(cy - 92 * s)}C${f1(cx + 14 * s)} ${f1(cy - 72 * s)} ${f1(cx + 14 * s)} ${f1(cy - 20 * s)} ${f1(cx)} ${f1(cy - 6 * s)}Z" fill="${c.main}" stroke="${INK}" stroke-width="${f1(1.8 * s)}"/>`;
      o += `<path d="M${f1(cx)} ${f1(cy - 10 * s)}V${f1(cy - 88 * s)}" stroke="${c.accent}" stroke-width="${f1(4 * s)}"/><path d="M${f1(cx - 9 * s)} ${f1(cy - 60 * s)}q${f1(9 * s)} ${f1(-6 * s)} ${f1(18 * s)} 0" fill="none" stroke="#E0583F" stroke-width="${f1(2.6 * s)}"/><circle cx="${f1(cx)}" cy="${f1(cy - 40 * s)}" r="${f1(3.4 * s)}" fill="#FFFDF7" stroke="${INK}" stroke-width="${f1(1 * s)}"/></g>`;
      return o;
    },
  },
  oborbambu: {
    label: 'Obor bambu',
    colors: { main: '#C9A35A', accent: '#8A6A3A' },
    draw(g, x, y, w, d, c) {
      const s = g.s, [cx, cy] = g.iso(x + 0.5, y + 0.5);
      let o = shadowE(cx, cy, 14 * s, 6 * s) + glowC(cx, cy - 84 * s, 26 * s, '#FFD27A', 0.45, 'blink');
      o += g.box(x + 0.44, y + 0.44, 0, 0.12, 0.12, 74, C3(c.main));
      for (const v of [18, 38, 58]) o += g.quadY(y + 0.56, x + 0.44, x + 0.56, v, v + 2, c.accent, 0) + g.quadX(x + 0.56, y + 0.44, y + 0.56, v, v + 2, c.accent, 0);
      o += `<path d="M${f1(cx - 9 * s)} ${f1(cy - 74 * s)}h${f1(18 * s)}l${f1(-3 * s)} ${f1(-8 * s)}h${f1(-12 * s)}Z" fill="${c.accent}" stroke="${INK}" stroke-width="${f1(1.4 * s)}"/>`;
      return o + flame(cx, cy - 82 * s, s);
    },
  },
  akuariumombak: {
    label: 'Akuarium ombak',
    colors: { main: '#BFE3F5', accent: '#5A6E8A' },
    draw(g, x, y, w, d, c) {
      const s = g.s;
      let o = g.box(x + 0.05, y + 0.2, 0, w - 0.1, d - 0.4, 18, C3(c.accent));
      o += g.box(x + 0.1, y + 0.25, 18, w - 0.2, d - 0.5, 40, C3(c.main));
      const Y = y + d - 0.25;
      o += g.quadY(Y, x + 0.12, x + w - 0.12, 19, 26, '#F0D9A8', 0);
      const pt = (u: number, v: number) => { const p = g.iso(u, Y); return [p[0], p[1] - v * s]; };
      // terumbu karang
      const [kx, ky] = pt(x + 0.35, 24);
      o += `<path d="M${f1(kx)} ${f1(ky)}v${f1(-14 * s)}m0 ${f1(6 * s)}l${f1(-5 * s)} ${f1(-6 * s)}m${f1(5 * s)} ${f1(2 * s)}l${f1(5 * s)} ${f1(-7 * s)}" stroke="#FF8FA3" stroke-width="${f1(3 * s)}" stroke-linecap="round" fill="none"/>`;
      const [k2, k3] = pt(x + w - 0.4, 24);
      o += `<path d="M${f1(k2)} ${f1(k3)}q${f1(-4 * s)} ${f1(-10 * s)} 0 ${f1(-18 * s)}M${f1(k2 + 5 * s)} ${f1(k3)}q${f1(4 * s)} ${f1(-8 * s)} 0 ${f1(-14 * s)}" stroke="#3FA06A" stroke-width="${f1(2.6 * s)}" fill="none"/>`;
      // ikan
      for (const [u, v, col, flip] of [[0.7, 40, '#F2994A', 1], [1.25, 32, '#F7C548', -1], [0.95, 48, '#E0583F', 1]] as [number, number, string, number][]) {
        const [fx, fy] = pt(x + u, v);
        o += `<g transform="translate(${f1(fx)} ${f1(fy)}) scale(${flip * 0.7} .7)">${koi(s, col)}</g>`;
      }
      // ombak (kelas water)
      const wv = Array.from({ length: 9 }, (_, i) => pt(x + 0.12 + (i / 8) * (w - 0.24), 52 + (i % 2 ? 3 : -1)));
      o += `<polyline class="water" points="${P(wv)}" fill="none" stroke="#FFFFFF" stroke-width="${f1(2.4 * s)}" stroke-linecap="round" stroke-dasharray="${f1(7 * s)} ${f1(4 * s)}"/>`;
      return o;
    },
  },

  /* ---------------- Kamar Bintang ---------------- */
  kasurroket: {
    label: 'Kasur roket',
    colors: { main: '#F2EEE3', accent: '#E0583F' },
    draw(g, x, y, w, d, c) {
      const s = g.s;
      let o = g.box(x + 0.08, y + 0.12, 0, w - 0.55, d - 0.24, 26, C3(c.main));
      // moncong roket
      const n0 = g.iso(x + w - 0.47, y + 0.12), n1 = g.iso(x + w - 0.47, y + d - 0.12), tip = g.iso(x + w - 0.05, y + d / 2);
      o += g.poly([[n1[0], n1[1]], [tip[0], tip[1] - 13 * s], [n1[0], n1[1] - 26 * s]], shade(c.accent, -0.1));
      o += g.poly([[n0[0], n0[1] - 26 * s], [tip[0], tip[1] - 13 * s], [n1[0], n1[1] - 26 * s]], c.accent);
      // sirip
      const f0 = g.iso(x + 0.08, y + d - 0.12);
      o += g.poly([[f0[0], f0[1]], [f0[0] - 14 * s, f0[1] + 8 * s], [f0[0] + 4 * s, f0[1] - 18 * s]], c.accent);
      // jendela bulat di sisi
      const [wx, wy] = g.iso(x + w * 0.62, y + d - 0.12);
      o += `<circle cx="${f1(wx)}" cy="${f1(wy - 14 * s)}" r="${f1(7 * s)}" fill="#9FD0E8" stroke="${INK}" stroke-width="${f1(2 * s)}"/><circle cx="${f1(wx - 2 * s)}" cy="${f1(wy - 16 * s)}" r="${f1(2 * s)}" fill="#FFFFFF"/>`;
      // selimut & bantal
      o += g.box(x + 0.6, y + 0.16, 26, w - 1.2, d - 0.32, 5, C3('#3F7FBF'));
      o += g.box(x + 0.16, y + 0.24, 26, 0.36, d - 0.48, 7, C3('#FFFFFF'));
      const [sx, sy] = g.iso(x + 0.9, y + d / 2);
      return o + `<path d="M${f1(sx)} ${f1(sy - 37 * s)}l${f1(1.6 * s)} ${f1(3.4 * s)} ${f1(3.8 * s)} ${f1(.5 * s)} ${f1(-2.8 * s)} ${f1(2.6 * s)} ${f1(.7 * s)} ${f1(3.7 * s)} ${f1(-3.3 * s)} ${f1(-1.8 * s)} ${f1(-3.3 * s)} ${f1(1.8 * s)} ${f1(.7 * s)} ${f1(-3.7 * s)} ${f1(-2.8 * s)} ${f1(-2.6 * s)} ${f1(3.8 * s)} ${f1(-.5 * s)}Z" fill="#F7C548"/>`;
    },
  },
  proyektorbintang: {
    label: 'Proyektor bintang',
    colors: { main: '#2B3A6B', accent: '#F7C548' },
    draw(g, x, y, w, d, c) {
      const s = g.s, [cx, cy] = g.iso(x + 0.5, y + 0.5);
      let o = g.box(x + 0.22, y + 0.22, 0, 0.56, 0.56, 30, C3('#7FA7D9'));
      o += `<path d="M${f1(cx - 26 * s)} ${f1(cy - 130 * s)}L${f1(cx - 10 * s)} ${f1(cy - 44 * s)}h${f1(20 * s)}L${f1(cx + 26 * s)} ${f1(cy - 130 * s)}Z" fill="#FFF6C8" opacity=".28"/>`;
      o += `<path d="M${f1(cx - 14 * s)} ${f1(cy - 31 * s)}a${f1(14 * s)} ${f1(14 * s)} 0 0 1 ${f1(28 * s)} 0Z" fill="${c.main}" stroke="${INK}" stroke-width="${f1(1.6 * s)}"/>`;
      for (const [dx, dy] of [[-6, -38], [3, -41], [7, -35], [-1, -35]]) o += `<circle cx="${f1(cx + dx * s)}" cy="${f1(cy + dy * s)}" r="${f1(1.4 * s)}" fill="${c.accent}"/>`;
      const star = (sx: number, sy: number, r: number, i: number) => `<path class="blink" style="animation-delay:-${(i * 0.5).toFixed(1)}s" d="M${f1(sx)} ${f1(sy - r)}l${f1(r * 0.3)} ${f1(r * 0.7)} ${f1(r * 0.7)} ${f1(r * 0.3)} ${f1(-r * 0.7)} ${f1(r * 0.3)} ${f1(-r * 0.3)} ${f1(r * 0.7)} ${f1(-r * 0.3)} ${f1(-r * 0.7)} ${f1(-r * 0.7)} ${f1(-r * 0.3)} ${f1(r * 0.7)} ${f1(-r * 0.3)}Z" fill="${c.accent}"/>`;
      [[-16, -112, 5], [12, -122, 4], [0, -92, 3.5], [-8, -70, 3], [18, -84, 4.5], [-20, -88, 3]].forEach(([dx, dy, r], i) => (o += star(cx + dx * s, cy + dy * s, r * s, i)));
      return o;
    },
  },
  tendakemah: {
    label: 'Tenda kemah',
    colors: { main: '#F2A541', accent: '#E0583F' },
    draw(g, x, y, w, d, c) {
      const s = g.s, H = 74;
      const up = (p: number[], v: number) => [p[0], p[1] - v * s];
      const a0 = g.iso(x + 0.12, y + 0.12), a1 = g.iso(x + w - 0.12, y + 0.12), b0 = g.iso(x + 0.12, y + d - 0.12), b1 = g.iso(x + w - 0.12, y + d - 0.12);
      const r0 = up(g.iso(x + 0.12, y + d / 2), H), r1 = up(g.iso(x + w - 0.12, y + d / 2), H);
      let o = shadowE(...(g.iso(x + w / 2, y + d / 2) as [number, number]), (w + d) * 16 * s, (w + d) * 7 * s);
      if (g.back) {
        // tampak belakang: atap sisi lain & ujung tenda tanpa pintu, bendera & umbul-umbul tetap
        o += g.poly([a0, a1, r1, r0], c.main);
        o += g.poly([a0, b0, r0], shade(c.main, -0.15));
        o += `<path d="M${f1(r1[0])} ${f1(r1[1])}v${f1(-22 * s)}" stroke="${INK}" stroke-width="${f1(2 * s)}"/><path d="M${f1(r1[0])} ${f1(r1[1] - 22 * s)}l${f1(-14 * s)} ${f1(5 * s)}l${f1(14 * s)} ${f1(5 * s)}Z" fill="${c.accent}" stroke="${INK}" stroke-width="${f1(1.4 * s)}" stroke-linejoin="round"/>`;
        return o;
      }
      o += g.poly([b0, b1, r1, r0], c.main);
      for (const t of [0.33, 0.66]) { const p = [b0[0] + (b1[0] - b0[0]) * t, b0[1] + (b1[1] - b0[1]) * t], q = [r0[0] + (r1[0] - r0[0]) * t, r0[1] + (r1[1] - r0[1]) * t]; o += `<line x1="${f1(p[0])}" y1="${f1(p[1])}" x2="${f1(q[0])}" y2="${f1(q[1])}" stroke="${shade(c.main, -0.2)}" stroke-width="${f1(2 * s)}"/>`; }
      o += g.poly([a1, b1, r1], shade(c.main, -0.15));
      const m = [(a1[0] + b1[0]) / 2, (a1[1] + b1[1]) / 2];
      o += g.poly([[m[0] - 12 * s, m[1] - 2 * s], [m[0] + 10 * s, m[1] + 4 * s], [r1[0], r1[1] + 30 * s]], '#3B2F4A', 1.2);
      o += `<path d="M${f1(r1[0])} ${f1(r1[1])}v${f1(-22 * s)}" stroke="${INK}" stroke-width="${f1(2 * s)}"/><path d="M${f1(r1[0])} ${f1(r1[1] - 22 * s)}l${f1(14 * s)} ${f1(5 * s)}l${f1(-14 * s)} ${f1(5 * s)}Z" fill="${c.accent}" stroke="${INK}" stroke-width="${f1(1.2 * s)}"/>`;
      // umbul-umbul kecil di punggung tenda
      const N = 6;
      for (let i = 1; i < N; i++) { const t = i / N, p = [r0[0] + (r1[0] - r0[0]) * t, r0[1] + (r1[1] - r0[1]) * t + 6 * s]; o += `<path d="M${f1(p[0] - 4 * s)} ${f1(p[1])}h${f1(8 * s)}l${f1(-4 * s)} ${f1(8 * s)}Z" fill="${['#FFFDF7', '#3F7FBF', '#F7C548'][i % 3]}" stroke="${INK}" stroke-width="${f1(1 * s)}"/>`; }
      return o;
    },
  },
  karpetawan: {
    label: 'Karpet awan',
    colors: { main: '#FFFFFF', accent: '#9FC3E8' },
    draw(g, x, y, w, d, c) {
      const s = g.s, k = Math.SQRT2;
      const blobs = [[0.55, 0.6, 0.42], [1.0, 0.45, 0.5], [1.45, 0.65, 0.4], [0.75, 1.2, 0.48], [1.3, 1.25, 0.45], [1.0, 1.0, 0.5]].map(([u, v, r]) => [u * w / 2, v * d / 2, r * Math.min(w, d) / 2]);
      const ell = (u: number, v: number, r: number, fill: string, grow = 0) => { const p = g.iso(x + u, y + v), t = Math.abs(g.iso(1, 0)[0] - g.iso(0, 0)[0]); return `<ellipse cx="${f1(p[0])}" cy="${f1(p[1])}" rx="${f1(r * t * k + grow)}" ry="${f1((r * t * k + grow) / 2)}" fill="${fill}"/>`; };
      let o = blobs.map(([u, v, r]) => ell(u, v, r, INK, 2.6 * s)).join('');
      o += blobs.map(([u, v, r]) => ell(u, v, r, c.accent, 0)).join('');
      o += blobs.map(([u, v, r]) => ell(u - 0.04, v - 0.04, r * 0.86, c.main, 0)).join('');
      return o;
    },
  },
  rakpelangi: {
    label: 'Rak buku pelangi',
    colors: { main: '#FFFDF7', accent: '#9A6FC0' },
    draw(g, x, y, w, d, c) {
      const s = g.s;
      let o = g.box(x, y + 0.15, 0, 0.55, d - 0.3, 78, C3(c.main));
      const X = x + 0.55, y0 = y + 0.15, y1 = y + d - 0.15;
      const cols = ['#E0583F', '#F2994A', '#F7C548', '#3FA06A', '#3F7FBF', '#9A6FC0'];
      [[8, 32], [38, 62]].forEach(([a, b], si) => {
        o += g.quadX(X, y0 + 0.08, y1 - 0.08, a, b, shade(c.accent, 0.55));
        let u = y0 + 0.14, i = si * 3;
        while (u < y1 - 0.2) { o += g.quadX(X, u, u + 0.09, a, b - 2 - ((i * 7) % 3) * 3, cols[i % 6], 1); u += 0.11; i++; }
      });
      // lengkung pelangi di atas
      const top = (u: number, v: number) => { const p = g.iso(X, u); return [p[0], p[1] - v * s]; };
      cols.forEach((col, i) => {
        const r = 0.34 - i * 0.045;
        const pts = Array.from({ length: 13 }, (_, k) => { const t = Math.PI * (k / 12); return top(y + d / 2 + Math.cos(t) * r, 78 + Math.sin(t) * r * 56); });
        o += `<polyline points="${P(pts)}" fill="none" stroke="${col}" stroke-width="${f1(3.4 * s)}" stroke-linecap="round"/>`;
      });
      return o;
    },
  },

  /* ---------------- Dapur Nenek ---------------- */
  tungku: {
    label: 'Tungku tanah liat',
    colors: { main: '#C66B3D', accent: '#3B3F55' },
    draw(g, x, y, w, d, c) {
      const s = g.s, top = 33;
      let o = g.box(x + 0.08, y + 0.16, 0, w - 0.16, d - 0.32, 28, C3(c.main));
      o += g.box(x + 0.04, y + 0.12, 28, w - 0.08, d - 0.24, 5, C3(shade(c.main, -0.1)));
      // lubang api & kayu bakar di sisi depan (dari belakang tidak terlihat)
      const Y = y + d - 0.16;
      if (!g.back) for (const u0 of [x + 0.3, x + w - 0.72]) {
        const arch: Pt[] = [at3(g, u0, Y, 2)];
        for (let k = 0; k <= 8; k++) arch.push(at3(g, u0 + (0.42 * k) / 8, Y, 12 + 8 * Math.sin((Math.PI * k) / 8)));
        arch.push(at3(g, u0 + 0.42, Y, 2));
        o += g.poly(arch, '#2B1A14', 1.4);
        const m = at3(g, u0 + 0.21, Y, 2);
        o += `<ellipse cx="${f1(m[0])}" cy="${f1(m[1] - 2 * s)}" rx="${f1(9 * s)}" ry="${f1(3 * s)}" fill="#E0583F"/>` + flame(m[0], m[1] - 2 * s, s, 0.75);
        o += inkLine([at3(g, u0 + 0.12, Y - 0.05, 5), at3(g, u0 + 0.05, Y + 0.13, 2)], '#8A5A36', 3, s) + inkLine([at3(g, u0 + 0.3, Y - 0.05, 6), at3(g, u0 + 0.37, Y + 0.12, 2.5)], '#A8743F', 3, s);
      }
      // wajan berisi gorengan
      const pan = (cu: number, cv: number) => {
        const [px, py] = at3(g, cu, cv, top), R = 13 * s;
        let p = `<ellipse cx="${f1(px)}" cy="${f1(py)}" rx="${f1(R + 1.5 * s)}" ry="${f1(R / 2 + 1 * s)}" fill="#2B1A14"/>`;
        p += `<path d="M${f1(px - R)} ${f1(py)}A${f1(R)} ${f1(R * 0.55)} 0 0 0 ${f1(px + R)} ${f1(py)}Z" fill="${c.accent}" stroke="${INK}" stroke-width="${f1(1.4 * s)}"/>`;
        p += `<ellipse cx="${f1(px)}" cy="${f1(py)}" rx="${f1(R)}" ry="${f1(R / 2)}" fill="${shade(c.accent, 0.3)}" stroke="${INK}" stroke-width="${f1(1.4 * s)}"/><ellipse cx="${f1(px)}" cy="${f1(py + 0.6 * s)}" rx="${f1(R - 2.6 * s)}" ry="${f1(R / 2 - 1.8 * s)}" fill="${c.accent}"/>`;
        for (const [dx, dy, r] of [[-4, 0.5, -15], [3.5, 1.2, 10], [0, -1.8, 25]]) p += `<ellipse cx="${f1(px + dx * s)}" cy="${f1(py + dy * s)}" rx="${f1(4.4 * s)}" ry="${f1(2.2 * s)}" transform="rotate(${r} ${f1(px + dx * s)} ${f1(py + dy * s)})" fill="#E9B949" stroke="${INK}" stroke-width="${f1(0.9 * s)}"/>`;
        p += inkLine([[px + 2 * s, py - 1 * s], [px + 15 * s, py - 13 * s]], '#B5703F', 2, s);
        return p + wisp(px - 5 * s, py - 4 * s, s, 12, '#FFFFFF', 0.7);
      };
      // dandang & kukusan nasi
      const dandang = (cu: number, cv: number) => {
        const [px, py] = g.iso(cu, cv), k = rk(g);
        let p = lathe(g, cu, cv, [[top - 2, 0.19], [top + 3, 0.23], [top + 15, 0.24], [top + 19, 0.19], [top + 23, 0.18], [top + 25, 0.22]], '#C9CED6');
        p += frontArc(g, cu, cv, top + 9, 0.235, '#9AA3B2', 1.6);
        p += flatE(g, cu, cv, top + 25, 0.22, '#AEB6C3');
        // kerucut anyaman bambu
        const r0 = 0.17 * k, r1 = 0.3 * k, zb = py - (top + 23) * s, zt = py - (top + 36) * s;
        p += `<path d="M${f1(px - r0)} ${f1(zb)}L${f1(px - r1)} ${f1(zt)}A${f1(r1)} ${f1(r1 / 2)} 0 0 0 ${f1(px + r1)} ${f1(zt)}L${f1(px + r0)} ${f1(zb)}A${f1(r0)} ${f1(r0 / 2)} 0 0 1 ${f1(px - r0)} ${f1(zb)}Z" fill="#D9B26A" stroke="${INK}" stroke-width="${f1(1.4 * s)}" stroke-linejoin="round"/>`;
        let hatch = '';
        for (let t = -0.8; t <= 0.81; t += 0.4) hatch += `M${f1(px + t * r0)} ${f1(zb + 1 * s)}L${f1(px + t * r1 + 3 * s)} ${f1(zt + 2 * s)}M${f1(px + t * r0)} ${f1(zb + 1 * s)}L${f1(px + t * r1 - 3 * s)} ${f1(zt + 2 * s)}`;
        p += `<path d="${hatch}" stroke="#B08A4A" stroke-width="${f1(0.9 * s)}"/>`;
        p += `<ellipse cx="${f1(px)}" cy="${f1(zt)}" rx="${f1(r1)}" ry="${f1(r1 / 2)}" fill="#C9A35A" stroke="${INK}" stroke-width="${f1(1.4 * s)}"/>`;
        // nasi mengepul
        p += `<path d="M${f1(px - r1 + 3 * s)} ${f1(zt)}Q${f1(px - r1 + 4 * s)} ${f1(zt - 9 * s)} ${f1(px)} ${f1(zt - 10 * s)}Q${f1(px + r1 - 4 * s)} ${f1(zt - 9 * s)} ${f1(px + r1 - 3 * s)} ${f1(zt)}Z" fill="#FFFDF7" stroke="${INK}" stroke-width="${f1(1.2 * s)}"/>`;
        return p + wisp(px - 4 * s, zt - 11 * s, s, 14) + wisp(px + 5 * s, zt - 9 * s, s, 11);
      };
      return o + pan(x + 0.5, y + 0.5) + dandang(x + w - 0.5, y + 0.5);
    },
  },
  rakpiring: {
    label: 'Rak piring kayu',
    colors: { main: '#B5703F', accent: '#4F9A6E' },
    draw(g, x, y, w, d, c) {
      const s = g.s, X = x + 0.58, y0 = y + 0.1, y1 = y + d - 0.1, H = 80;
      let o = g.box(x + 0.06, y0, 0, 0.52, y1 - y0, H, C3(c.main));
      o += g.box(x + 0.03, y0 - 0.03, H, 0.58, y1 - y0 + 0.06, 4, C3(shade(c.main, -0.15)));
      if (g.back) {
        // dari belakang: papan polos bersambung
        for (const u of [0.3, 0.5, 0.7]) o += thinLine([at3(g, x + 0.06, y + u, 3), at3(g, x + 0.06, y + u, H - 3)], shade(c.main, -0.3), 1.2 * s);
      } else {
        const tiers = [[6, 28], [33, 52], [57, 75]];
        for (const [a, b] of tiers) o += g.quadX(X, y0 + 0.06, y1 - 0.06, a, b, shade(c.main, -0.45), 1.2);
        // piring berdiri
        for (const u of [y0 + 0.33, y0 + 0.4, y0 + 0.47]) {
          const m = onX(g, X - 0.02, u);
          o += g.poly(discPts(m, 0, 17, 8.5), c.accent, 1.1) + g.poly(discPts(m, 0, 17, 6.4), '#FFFDF7', 0.8);
        }
        o += g.quadX(X, y0 + 0.06, y1 - 0.06, 11, 13.5, shade(c.main, 0.1), 1);
        // cangkir blirik
        for (const u of [y0 + 0.18, y0 + 0.37, y0 + 0.56]) {
          const m = onX(g, X - 0.01, u);
          o += g.poly([m(-4, 34), m(4, 34), m(4.5, 46), m(-4.5, 46)], '#F2F5EE', 1);
          o += g.poly([m(-4.5, 44), m(4.5, 44), m(4.5, 46.5), m(-4.5, 46.5)], c.accent, 0.8);
          o += `<circle cx="${f1(m(-1, 39)[0])}" cy="${f1(m(-1, 39)[1])}" r="${f1(0.9 * s)}" fill="${c.accent}"/><circle cx="${f1(m(2, 37)[0])}" cy="${f1(m(2, 37)[1])}" r="${f1(0.9 * s)}" fill="${c.accent}"/>`;
          o += thinLine([m(-4.3, 43), m(-7.5, 42), m(-7.5, 37), m(-4.1, 36)], c.accent, 1.6 * s);
        }
        // mangkuk bertumpuk
        for (const u of [y0 + 0.24, y0 + 0.54]) {
          const m = onX(g, X - 0.01, u);
          for (const v of [58, 63, 68]) o += g.poly([m(-8, v + 4), m(-6, v + 1), m(-3, v), m(3, v), m(6, v + 1), m(8, v + 4)], v === 68 ? '#FFFDF7' : shade('#FFFDF7', -0.06), 1) + thinLine([m(-8, v + 4), m(8, v + 4)], c.accent, 1.4 * s);
        }
      }
      // di atas rak: teko blirik & cething nasi
      const items: [number, number, string][] = [];
      {
        const cu = x + 0.32, cv = y + 0.3, [px, py] = at3(g, cu, cv, H + 4);
        let t = lathe(g, cu, cv, [[H + 4, 0.1], [H + 8, 0.14], [H + 14, 0.13], [H + 18, 0.07], [H + 19, 0.08]], '#F2F5EE');
        t += frontArc(g, cu, cv, H + 9, 0.14, c.accent, 1.6);
        t += inkLine([[px + 0.12 * rk(g), py - 8 * s], [px + 0.2 * rk(g), py - 14 * s], [px + 0.24 * rk(g), py - 16 * s]], '#F2F5EE', 2.2, s);
        t += `<path d="M${f1(px - 0.12 * rk(g))} ${f1(py - 12 * s)}q${f1(-5 * s)} ${f1(-1 * s)} ${f1(-4 * s)} ${f1(5 * s)}" fill="none" stroke="${INK}" stroke-width="${f1(1.6 * s)}"/>`;
        t += flatE(g, cu, cv, H + 19, 0.08, c.accent, 1.1) + `<circle cx="${f1(px)}" cy="${f1(py - 17 * s)}" r="${f1(1.8 * s)}" fill="${c.accent}" stroke="${INK}" stroke-width="${f1(0.8 * s)}"/>`;
        items.push([g.iso(cu, cv)[1], 0, t]);
      }
      {
        const cu = x + 0.34, cv = y + 0.68;
        let t = lathe(g, cu, cv, [[H + 4, 0.11], [H + 13, 0.16]], '#D9B26A');
        const [px, py] = at3(g, cu, cv, H + 4), k = rk(g);
        let hatch = '';
        for (let i = -3; i <= 3; i++) hatch += `M${f1(px + i * 0.035 * k)} ${f1(py + 1 * s)}L${f1(px + i * 0.05 * k + 2 * s)} ${f1(py - 8 * s)}`;
        t += `<path d="${hatch}" stroke="#B08A4A" stroke-width="${f1(0.9 * s)}"/>` + flatE(g, cu, cv, H + 13, 0.16, '#C9A35A', 1.2);
        t += `<path d="M${f1(px - 0.13 * k)} ${f1(py - 13 * s)}Q${f1(px)} ${f1(py - 20 * s)} ${f1(px + 0.13 * k)} ${f1(py - 13 * s)}Z" fill="#FFFDF7" stroke="${INK}" stroke-width="${f1(1 * s)}"/>`;
        items.push([g.iso(cu, cv)[1], 1, t]);
      }
      return o + items.sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((e) => e[2]).join('');
    },
  },
  gentongair: {
    label: 'Gentong air',
    colors: { main: '#B5562F', accent: '#5B9BD1' },
    draw(g, x, y, w, d, c) {
      const s = g.s, cu = x + 0.5, cv = y + 0.5, [cx, cy] = g.iso(cu, cv), k = rk(g), H = 60;
      let o = shadowE(cx, cy + 1 * s, 0.42 * k, 0.21 * k);
      o += lathe(g, cu, cv, [[0, 0.2], [5, 0.27], [16, 0.35], [28, 0.385], [40, 0.355], [50, 0.28], [55, 0.22], [58, 0.255], [H, 0.26]], c.main);
      o += frontArc(g, cu, cv, 21, 0.372, shade(c.main, -0.25), 2.2) + frontArc(g, cu, cv, 37, 0.362, shade(c.main, -0.25), 2.2);
      for (let i = -3; i <= 3; i++) {
        const a = (i / 3.6) * (Math.PI / 2), r = 0.38 * k;
        o += `<circle cx="${f1(cx + Math.sin(a) * r)}" cy="${f1(cy - 29 * s + Math.cos(a) * r * 0.5)}" r="${f1(1.6 * s)}" fill="${shade(c.main, 0.35)}"/>`;
      }
      o += `<path d="M${f1(cx - 0.3 * k)} ${f1(cy - 46 * s)}Q${f1(cx - 0.38 * k)} ${f1(cy - 30 * s)} ${f1(cx - 0.28 * k)} ${f1(cy - 12 * s)}" fill="none" stroke="#FFFFFF" stroke-width="${f1(3 * s)}" stroke-linecap="round" opacity=".3"/>`;
      o += flatE(g, cu, cv, H, 0.26, shade(c.main, 0.12), 1.6) + flatE(g, cu, cv, H + 0.4, 0.205, c.accent, 1.2);
      o += `<ellipse cx="${f1(cx - 4 * s)}" cy="${f1(cy - (H + 1) * s)}" rx="${f1(4 * s)}" ry="${f1(1.2 * s)}" fill="#FFFFFF" opacity=".7"/>`;
      // gayung batok bersandar di bibir gentong
      const bx = cx + 0.16 * k, by = cy - (H + 1) * s;
      o += inkLine([[bx - 1 * s, by - 1 * s], [cx - 0.3 * k, by - 15 * s]], '#C8955A', 2.4, s);
      o += `<path d="M${f1(bx - 7 * s)} ${f1(by - 1 * s)}A${f1(7 * s)} ${f1(5 * s)} 0 0 0 ${f1(bx + 7 * s)} ${f1(by - 1 * s)}Z" fill="#6B4428" stroke="${INK}" stroke-width="${f1(1.3 * s)}"/><ellipse cx="${f1(bx)}" cy="${f1(by - 1 * s)}" rx="${f1(7 * s)}" ry="${f1(2.6 * s)}" fill="#8A5A36" stroke="${INK}" stroke-width="${f1(1.3 * s)}"/>`;
      return o;
    },
  },
  mejamakan: {
    label: 'Meja makan & bangku panjang',
    colors: { main: '#9C6B45', accent: '#D9B26A' },
    draw(g, x, y, w, d, c) {
      const s = g.s, wood = C3(c.main), dark = C3(shade(c.main, -0.18)), top = 30;
      let o = '';
      for (const [a, b] of [[0.12, 0.1], [w - 0.22, 0.1], [0.12, 0.38], [w - 0.22, 0.38]]) o += g.box(x + a, y + b, 0, 0.1, 0.1, 26, dark);
      o += g.box(x + 0.06, y + 0.06, 26, w - 0.12, 0.46, 4, wood);
      for (const a of [0.16, w - 0.26]) o += g.box(x + a, y + 0.64, 0, 0.1, 0.22, 14, dark);
      o += g.box(x + 0.08, y + 0.6, 14, w - 0.16, 0.3, 4, wood);
      // isi meja: tudung saji, piring tempe, kendi, cangkir (diurutkan dari belakang ke depan)
      const L: [number, string][] = [];
      const add = (cu: number, cv: number, h: string) => L.push([g.iso(cu, cv)[1], h]);
      {
        const cu = x + 0.6, cv = y + 0.3, [px, py] = at3(g, cu, cv, top), R = 0.24 * rk(g), H = 17 * s;
        let t = `<path d="M${f1(px - R)} ${f1(py)}Q${f1(px - R)} ${f1(py - H * 1.15)} ${f1(px)} ${f1(py - H)}Q${f1(px + R)} ${f1(py - H * 1.15)} ${f1(px + R)} ${f1(py)}A${f1(R)} ${f1(R / 2)} 0 0 1 ${f1(px - R)} ${f1(py)}Z" fill="${c.accent}" stroke="${INK}" stroke-width="${f1(1.5 * s)}" stroke-linejoin="round"/>`;
        t += `<path d="M${f1(px - R * 0.97)} ${f1(py - H * 0.25)}Q${f1(px)} ${f1(py - H * 0.25 + R * 0.42)} ${f1(px + R * 0.97)} ${f1(py - H * 0.25)}" fill="none" stroke="#C0392B" stroke-width="${f1(2.6 * s)}"/>`;
        t += `<path d="M${f1(px - R * 0.82)} ${f1(py - H * 0.58)}Q${f1(px)} ${f1(py - H * 0.58 + R * 0.34)} ${f1(px + R * 0.82)} ${f1(py - H * 0.58)}" fill="none" stroke="#3FA06A" stroke-width="${f1(2.2 * s)}"/>`;
        let wv = '';
        for (let i = -2; i <= 2; i++) wv += `M${f1(px + i * R * 0.32)} ${f1(py - H * 0.92 + Math.abs(i) * 1.2 * s)}l${f1(1.5 * s)} ${f1(H * 0.5)}`;
        t += `<path d="${wv}" stroke="#B08A4A" stroke-width="${f1(0.9 * s)}"/><circle cx="${f1(px)}" cy="${f1(py - H - 1.5 * s)}" r="${f1(2.4 * s)}" fill="#C0392B" stroke="${INK}" stroke-width="${f1(1 * s)}"/>`;
        add(cu, cv, t);
      }
      {
        const cu = x + 1.06, cv = y + 0.36, [px, py] = at3(g, cu, cv, top);
        let t = flatE(g, cu, cv, top, 0.15, '#FFFDF7', 1.3) + `<ellipse cx="${f1(px)}" cy="${f1(py)}" rx="${f1(0.11 * rk(g))}" ry="${f1(0.055 * rk(g))}" fill="none" stroke="${shade('#4F9A6E', 0)}" stroke-width="${f1(1 * s)}"/>`;
        for (const [dx, dy] of [[-3, 0], [3, -1], [0, 1.5]]) t += `<rect x="${f1(px + dx * s - 3 * s)}" y="${f1(py + dy * s - 3 * s)}" width="${f1(6 * s)}" height="${f1(3.4 * s)}" rx="${f1(0.8 * s)}" transform="rotate(-12 ${f1(px + dx * s)} ${f1(py + dy * s)})" fill="#D9A441" stroke="${INK}" stroke-width="${f1(0.8 * s)}"/>`;
        add(cu, cv, t);
      }
      {
        const cu = x + 1.42, cv = y + 0.24, [px, py] = at3(g, cu, cv, top), k = rk(g);
        let t = inkLine([[px + 0.1 * k, py - 9 * s], [px + 0.2 * k, py - 15 * s]], '#B5562F', 2.6, s);
        t += lathe(g, cu, cv, [[top, 0.08], [top + 3, 0.13], [top + 8, 0.15], [top + 13, 0.12], [top + 16, 0.05], [top + 22, 0.04], [top + 23, 0.06]], '#B5562F');
        t += frontArc(g, cu, cv, top + 8, 0.15, '#D98A5E', 1.4);
        add(cu, cv, t);
      }
      for (const [cu, cv] of [[x + 1.68, y + 0.3], [x + 1.62, y + 0.44]]) {
        let t = lathe(g, cu, cv, [[top, 0.05], [top + 7, 0.06]], '#F2F5EE', 1.2) + flatE(g, cu, cv, top + 7, 0.06, '#4F9A6E', 1);
        add(cu, cv, t);
      }
      return o + L.sort((a, b) => a[0] - b[0]).map((e) => e[1]).join('');
    },
  },
  petromaks: {
    label: 'Lampu petromaks',
    colors: { main: '#C9CED6', accent: '#FFF6D0' },
    draw(g, x, y, w, d, c) {
      const s = g.s, wood = C3('#8A5A36');
      let o = '';
      for (const [a, b] of [[0.27, 0.27], [0.65, 0.27], [0.27, 0.65], [0.65, 0.65]]) o += g.box(x + a, y + b, 0, 0.08, 0.08, 16, wood);
      o += g.box(x + 0.22, y + 0.22, 16, 0.56, 0.56, 4, wood);
      const cu = x + 0.5, cv = y + 0.5, [cx, cy] = g.iso(cu, cv), z = 20, k = rk(g);
      const Y = (v: number) => cy - (z + v) * s;
      o += glowC(cx, Y(26), 30 * s, '#FFE7A0', 0.42, 'blink');
      // tangki & pompa
      o += lathe(g, cu, cv, [[z, 0.18], [z + 3, 0.25], [z + 9, 0.26], [z + 12, 0.18]], c.main);
      o += frontArc(g, cu, cv, z + 6, 0.255, shade(c.main, -0.3), 1.4);
      o += inkLine([[cx + 0.25 * k, Y(7)], [cx + 0.35 * k, Y(9)]], c.main, 1.6, s) + `<circle cx="${f1(cx + 0.36 * k)}" cy="${f1(Y(9))}" r="${f1(2.6 * s)}" fill="#C0392B" stroke="${INK}" stroke-width="${f1(1 * s)}"/>`;
      o += `<circle cx="${f1(cx - 0.27 * k)}" cy="${f1(Y(6))}" r="${f1(2.4 * s)}" fill="${shade(c.main, -0.35)}" stroke="${INK}" stroke-width="${f1(1 * s)}"/>`;
      // kaca, kaos lampu menyala, rangka
      o += `<path d="M${f1(cx - 7 * s)} ${f1(Y(12))}Q${f1(cx - 11 * s)} ${f1(Y(23))} ${f1(cx - 7 * s)} ${f1(Y(34))}H${f1(cx + 7 * s)}Q${f1(cx + 11 * s)} ${f1(Y(23))} ${f1(cx + 7 * s)} ${f1(Y(12))}Z" fill="${c.accent}" fill-opacity=".9" stroke="${INK}" stroke-width="${f1(1.4 * s)}"/>`;
      o += `<ellipse class="blink" cx="${f1(cx)}" cy="${f1(Y(22))}" rx="${f1(6 * s)}" ry="${f1(7.5 * s)}" fill="#FFFFFF" fill-opacity=".8"/><ellipse cx="${f1(cx)}" cy="${f1(Y(22))}" rx="${f1(3.6 * s)}" ry="${f1(4.8 * s)}" fill="#FFFDF2" stroke="#F2C14E" stroke-width="${f1(1 * s)}"/>`;
      o += thinLine([[cx - 9 * s, Y(12)], [cx - 9 * s, Y(35)]], INK, 1.6 * s) + thinLine([[cx + 9 * s, Y(12)], [cx + 9 * s, Y(35)]], INK, 1.6 * s);
      // tudung & pegangan
      o += `<path d="M${f1(cx - 13 * s)} ${f1(Y(34))}Q${f1(cx)} ${f1(Y(30))} ${f1(cx + 13 * s)} ${f1(Y(34))}L${f1(cx + 5 * s)} ${f1(Y(42))}H${f1(cx - 5 * s)}Z" fill="${c.main}" stroke="${INK}" stroke-width="${f1(1.4 * s)}" stroke-linejoin="round"/>`;
      o += `<rect x="${f1(cx - 4 * s)}" y="${f1(Y(46))}" width="${f1(8 * s)}" height="${f1(4.5 * s)}" rx="${f1(1 * s)}" fill="${shade(c.main, -0.15)}" stroke="${INK}" stroke-width="${f1(1.1 * s)}"/>`;
      o += `<path d="M${f1(cx - 9 * s)} ${f1(Y(39))}Q${f1(cx - 10 * s)} ${f1(Y(55))} ${f1(cx)} ${f1(Y(55))}Q${f1(cx + 10 * s)} ${f1(Y(55))} ${f1(cx + 9 * s)} ${f1(Y(39))}" fill="none" stroke="${INK}" stroke-width="${f1(2.6 * s)}" stroke-linecap="round"/><path d="M${f1(cx - 9 * s)} ${f1(Y(39))}Q${f1(cx - 10 * s)} ${f1(Y(55))} ${f1(cx)} ${f1(Y(55))}Q${f1(cx + 10 * s)} ${f1(Y(55))} ${f1(cx + 9 * s)} ${f1(Y(39))}" fill="none" stroke="${c.main}" stroke-width="${f1(1.2 * s)}" stroke-linecap="round"/>`;
      return o;
    },
  },

  /* ---------------- Sanggar Seni ---------------- */
  rakangklung: {
    label: 'Rak angklung',
    colors: { main: '#E2BE6E', accent: '#7A4A2A' },
    draw(g, x, y, w, d, c) {
      const s = g.s, wood = C3(c.accent), Y = y + 0.5, H = 96;
      let o = '';
      for (const px of [x + 0.08, x + w - 0.2]) o += g.box(px - 0.05, y + 0.22, 0, 0.22, 0.56, 6, wood) + g.box(px, Y - 0.06, 6, 0.12, 0.12, H - 6, wood);
      const ang = (cu: number, k: number, ribbon: string) => {
        const m = onY(g, Y, cu), hw = 5 * k, b0 = 24, top = b0 + 52 * k, col = c.main;
        let a = thinLine([m(0, top), m(0, H - 2)], INK, 1.1 * s);
        const tube = (hx: number, tw: number, tt: number) =>
          g.poly([m(hx - tw, b0 + 2), m(hx + tw, b0 + 2), m(hx + tw, tt - 9 * k), m(hx + tw * 0.25, tt), m(hx - tw * 0.25, tt), m(hx - tw, tt - 9 * k)], col, 1.2) +
          thinLine([m(hx - tw, b0 + (tt - b0) * 0.45), m(hx + tw, b0 + (tt - b0) * 0.45)], shade(col, -0.32), 1 * s);
        a += tube(-2.3 * k, 2 * k, b0 + 43 * k) + tube(2.3 * k, 1.8 * k, b0 + 32 * k);
        a += inkLine([m(-hw, b0 - 2), m(-hw, top)], col, 1.6, s) + inkLine([m(hw, b0 - 2), m(hw, top)], col, 1.6, s);
        a += inkLine([m(-hw - 1, top - 1), m(hw + 1, top - 1)], col, 1.6, s) + inkLine([m(-hw, b0 + 25 * k), m(hw, b0 + 25 * k)], col, 1.4, s);
        a += g.poly([m(-hw - 2, b0 - 3), m(hw + 2, b0 - 3), m(hw + 2, b0 + 3.5), m(-hw - 2, b0 + 3.5)], shade(col, -0.12), 1.2);
        return a + g.poly([m(-3, top + 1), m(3, top + 1), m(0, top - 5)], ribbon, 1);
      };
      const ks = [0.95, 0.84, 0.74, 0.64], ribbons = ['#E0583F', '#3F7FBF', '#3FA06A', '#9A6FC0'];
      let cu = x + 0.22;
      ks.forEach((k, i) => { const hw = (5 * k + 2) / 32; cu += hw; o += ang(cu, k, ribbons[i]); cu += hw + 0.02; });
      o += g.box(x + 0.06, Y - 0.06, H, w - 0.12, 0.12, 7, wood);
      for (const px of [x + 0.08, x + w - 0.08]) { const [fx, fy] = at3(g, px, Y, H + 7); o += `<circle cx="${f1(fx)}" cy="${f1(fy - 2 * s)}" r="${f1(3.4 * s)}" fill="#E9B949" stroke="${INK}" stroke-width="${f1(1.1 * s)}"/>`; }
      return o;
    },
  },
  kecapi: {
    label: 'Kecapi',
    colors: { main: '#8A5A36', accent: '#E9B949' },
    draw(g, x, y, w, d, c) {
      const s = g.s, z0 = 6, h = 12, top = z0 + h;
      let o = '';
      for (const [a, b] of [[0.34, 0.34], [w - 0.44, 0.34], [0.34, 0.56], [w - 0.44, 0.56]]) o += g.box(x + a, y + b, 0, 0.1, 0.1, z0, C3(shade(c.main, -0.3)));
      const oct = (m: number) => [[0.1 + m, 0.4 + m * 0.4], [0.3 + m * 0.6, 0.26 + m], [w - 0.32 - m * 0.6, 0.26 + m], [w - 0.08 - m, 0.38 + m * 0.4], [w - 0.08 - m, 0.62 - m * 0.4], [w - 0.32 - m * 0.6, 0.74 - m], [0.3 + m * 0.6, 0.74 - m], [0.1 + m, 0.6 - m * 0.4]].map(([u, v]) => [x + u, y + v]);
      o += prism(g, oct(0), z0, h, C3(c.main));
      o += g.poly(oct(0.07).map(([u, v]) => at3(g, u, v, top)), shade(c.main, 0.42), 1.1);
      // ukiran emas di kedua ujung
      for (const [u, dir] of [[x + 0.2, -1], [x + w - 0.2, 1]] as [number, number][]) {
        const [px, py] = at3(g, u, y + 0.5, top);
        const curl = `M${f1(px - dir * 5 * s)} ${f1(py + 1 * s)}Q${f1(px - dir * 6 * s)} ${f1(py - 9 * s)} ${f1(px + dir * 1 * s)} ${f1(py - 10 * s)}Q${f1(px + dir * 7 * s)} ${f1(py - 9 * s)} ${f1(px + dir * 5 * s)} ${f1(py - 4 * s)}Q${f1(px + dir * 2 * s)} ${f1(py - 1 * s)} ${f1(px)} ${f1(py - 5 * s)}`;
        o += `<path d="${curl}" fill="none" stroke="${INK}" stroke-width="${f1(4 * s)}" stroke-linecap="round"/><path d="${curl}" fill="none" stroke="${c.accent}" stroke-width="${f1(2.2 * s)}" stroke-linecap="round"/>`;
      }
      // senar, kuda-kuda (susu), pasak penyetem
      const N = 9;
      let strings = '', bridges = '', pegs = '';
      for (let i = 0; i < N; i++) {
        const v = y + 0.37 + (0.26 * i) / (N - 1);
        const a = at3(g, x + 0.4, v, top + 1.5), b = at3(g, x + w - 0.36, v, top + 1.5);
        strings += `M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}`;
        const p = at3(g, x + 0.7 + (0.62 * i) / (N - 1), v, top);
        bridges += `M${f1(p[0] - 2.4 * s)} ${f1(p[1] + 0.6 * s)}L${f1(p[0])} ${f1(p[1] - 3.2 * s)}L${f1(p[0] + 2.4 * s)} ${f1(p[1] + 0.6 * s)}Z`;
        const q = at3(g, x + w - 0.34, v, top + 1.5);
        pegs += `M${f1(q[0] + 1.6 * s)} ${f1(q[1])}a${f1(1.6 * s)} ${f1(1.6 * s)} 0 1 0 ${f1(-3.2 * s)} 0a${f1(1.6 * s)} ${f1(1.6 * s)} 0 1 0 ${f1(3.2 * s)} 0Z`;
      }
      o += `<path d="${bridges}" fill="${c.accent}" stroke="${INK}" stroke-width="${f1(0.8 * s)}" stroke-linejoin="round"/>`;
      o += `<path d="${strings}" stroke="#4A3524" stroke-width="${f1(0.9 * s)}"/>`;
      return o + `<path d="${pegs}" fill="${c.accent}" stroke="${INK}" stroke-width="${f1(0.7 * s)}"/>`;
    },
  },
  kelir: {
    label: 'Kelir wayang mini',
    colors: { main: '#7A2E2E', accent: '#FFF4D6' },
    draw(g, x, y, w, d, c) {
      const s = g.s, wood = C3('#6B4A2B'), Yb = y + 0.36, Y = y + 0.46, H = 104;
      const u0 = x + 0.2, u1 = x + w - 0.2, v0 = 26, v1 = 98;
      let o = '';
      for (const px of [x + 0.08, x + w - 0.2]) o += g.box(px - 0.04, y + 0.2, 0, 0.2, 0.42, 6, wood) + g.box(px, Yb, 6, 0.12, 0.1, H - 6, wood);
      o += g.box(x + 0.04, Yb, H, w - 0.08, 0.1, 6, wood);
      const Q = (u: number, v: number, YY = Y) => at3(g, u, YY, v);
      const fig = (m0: (a: number, b: number) => Pt, dir: number, fill: string, stroke: boolean, k = 0.62) => {
        const m = (a: number, b: number) => m0(a * k, b * k);
        const sw = stroke ? ` stroke="${INK}" stroke-width="${f1(1.1 * s)}" stroke-linejoin="round"` : '';
        let f = `<polygon points="${P(WAYANG_BODY.map(([a, b]) => m(a * dir, b)))}" fill="${fill}"${sw}/>`;
        const arm = [m(2 * dir, 40), m(13 * dir, 27), m(18 * dir, 31)], stick = [m(18 * dir, 31), m(20 * dir, 2)];
        f += stroke ? inkLine(arm, fill, 1.6, s) + thinLine(stick, '#5A381F', 1.2 * s) + thinLine([m(0, 0), m(0, -10)], '#5A381F', 1.6 * s) : thinLine(arm, fill, 2.2 * s) + thinLine(stick, fill, 1 * s);
        if (stroke) f += `<polygon points="${P([m(-6 * dir, 56), m(-2 * dir, 63), m(2 * dir, 58), m(-1 * dir, 57)])}" fill="#E9B949"${sw}/><circle cx="${f1(m(2 * dir, 51)[0])}" cy="${f1(m(2 * dir, 51)[1])}" r="${f1(0.9 * s)}" fill="${INK}"/>` + thinLine([m(-4 * dir, 29), m(4 * dir, 29)], '#E9B949', 1.6 * s);
        return f;
      };
      const gun = (m0: (a: number, b: number) => Pt, fill: string, stroke: boolean, k = 0.85) => {
        const m = (a: number, b: number) => m0(a * k, b * k);
        const sw = stroke ? ` stroke="${INK}" stroke-width="${f1(1.2 * s)}" stroke-linejoin="round"` : '';
        let f = `<polygon points="${P(GUNUNGAN.map(([a, b]) => m(a, b)))}" fill="${fill}"${sw}/>`;
        if (!stroke) return f;
        f += `<polygon points="${P(GUNUNGAN.filter(([, b]) => b > 6).map(([a, b]) => m(a * 0.72, 8 + (b - 8) * 0.82)))}" fill="#C0392B"/>`;
        f += thinLine([m(0, 12), m(0, 54)], '#5A381F', 1.6 * s) + thinLine([m(0, 40), m(-7, 47)], '#3FA06A', 1.6 * s) + thinLine([m(0, 34), m(7, 42)], '#3FA06A', 1.6 * s) + thinLine([m(0, 26), m(-8, 32)], '#3FA06A', 1.6 * s);
        return f + `<polygon points="${P([m(-4, 8), m(4, 8), m(4, 16), m(0, 19), m(-4, 16)])}" fill="#3B2F2F"/>`;
      };
      const gedebog = () => g.box(x + 0.2, y + 0.56, 0, w - 0.4, 0.2, 12, C3('#9BB061'));
      if (g.back) {
        o += gedebog();
        // sisi bayangan: layar diterangi blencong dari balik kelir, wayang tampak sebagai bayangan
        const ua = u0 + 0.1;
        o += g.poly([Q(ua, v0), Q(u1, v0), Q(u1, v1), Q(ua, v1)], '#FFE6AE', 1.4);
        o += g.poly([Q(ua, v1 - 7), Q(u1, v1 - 7), Q(u1, v1), Q(ua, v1)], c.main, 1.1) + g.poly([Q(ua, v0), Q(u1, v0), Q(u1, v0 + 7), Q(ua, v0 + 7)], '#3B2F2F', 1.1);
        o += `<polygon class="blink" points="${P(discPts(onY(g, Y, (ua + u1) / 2), 0, 62, 20, 24, 24))}" fill="#FFF6D6" fill-opacity=".75"/>`;
        o += `<g opacity=".6">${gun(onY(g, Y, x + w / 2, 33), '#3B2F2F', false, 0.92)}${fig(onY(g, Y, x + 0.5, 33), 1, '#3B2F2F', false, 0.72)}${fig(onY(g, Y, x + w - 0.5, 33), -1, '#3B2F2F', false, 0.72)}</g>`;
        return o;
      }
      o += g.quadY(Y, u0, u1, v0, v1, c.accent, 1.4);
      o += g.quadY(Y, u0, u1, v1 - 7, v1, c.main, 1.1) + g.quadY(Y, u0, u1, v0, v0 + 7, '#3B2F2F', 1.1);
      o += `<polygon points="${P(discPts(onY(g, Y, (u0 + u1) / 2), 0, 66, 20, 22, 24))}" fill="#FFE7A0" fill-opacity=".45"/>`;
      // wayang tertancap di batang pisang (gedebog)
      const Yp = y + 0.64;
      o += gun(onY(g, Yp, x + w / 2, 12), '#E9B949', true);
      o += fig(onY(g, Yp, x + 0.5, 12), 1, '#3F5E8F', true) + fig(onY(g, Yp, x + w - 0.5, 12), -1, '#8E2A1E', true);
      o += gedebog();
      // blencong menggantung
      const [hx, hy] = at3(g, x + w / 2, y + 0.46, H), [lx, ly] = at3(g, x + w / 2, y + 0.66, 86);
      o += thinLine([[hx, hy], [lx, ly - 3 * s]], INK, 1.1 * s) + glowC(lx, ly - 5 * s, 12 * s, '#FFD27A', 0.45, 'blink');
      o += `<path d="M${f1(lx - 6 * s)} ${f1(ly - 2 * s)}Q${f1(lx)} ${f1(ly + 3 * s)} ${f1(lx + 6 * s)} ${f1(ly - 2 * s)}L${f1(lx + 9 * s)} ${f1(ly - 6 * s)}L${f1(lx + 4.5 * s)} ${f1(ly - 4 * s)}Q${f1(lx)} ${f1(ly - 1.5 * s)} ${f1(lx - 4.5 * s)} ${f1(ly - 4 * s)}Z" fill="#B07A3A" stroke="${INK}" stroke-width="${f1(1.1 * s)}" stroke-linejoin="round"/>`;
      return o + flame(lx - 3 * s, ly - 4 * s, s, 0.4);
    },
  },
  membatik: {
    label: 'Meja membatik',
    colors: { main: '#F7EBCF', accent: '#2F3E6E' },
    draw(g, x, y, w, d, c) {
      const s = g.s, wood = C3('#8A5A36'), Yb = y + 0.3, H = 60, u0 = x + 0.22, u1 = x + 1.3, um = u0 + (u1 - u0) * 0.6;
      let o = '';
      for (const px of [x + 0.1, x + 1.34]) o += g.box(px - 0.05, y + 0.14, 0, 0.18, 0.34, 5, wood) + g.box(px, Yb, 5, 0.08, 0.08, H - 5, wood);
      o += g.box(x + 0.06, Yb, H, 1.4, 0.08, 5, wood);
      const Yf = y + 0.4, Yk = y + 0.27;
      const cloth = (YY: number, vb: number) => {
        const pts: Pt[] = [at3(g, u0, YY, H + 4), at3(g, u1, YY, H + 4)];
        for (let k = 0; k <= 8; k++) { const u = u1 - ((u1 - u0) * k) / 8; pts.push(at3(g, u, YY, vb + 2.5 * Math.sin(k * 1.7))); }
        return g.poly(pts, c.main, 1.3);
      };
      // tungku kecil (anglo), wajan malam, canting
      const anglo = () => {
        const cu = x + 1.66, cv = y + 0.66, [px, py] = at3(g, cu, cv, 15), k = rk(g);
        let a = lathe(g, cu, cv, [[0, 0.12], [3, 0.15], [10, 0.16], [13, 0.13], [14, 0.145]], '#C66B3D');
        a += `<circle cx="${f1(px - 0.08 * k)}" cy="${f1(py + 6 * s)}" r="${f1(1.6 * s)}" fill="#F2994A"/>`;
        a += flatE(g, cu, cv, 15, 0.15, '#3B3F55', 1.3) + flatE(g, cu, cv, 15.3, 0.11, '#7A4A1E', 0) + `<ellipse cx="${f1(px - 2 * s)}" cy="${f1(py - 0.5 * s)}" rx="${f1(2.6 * s)}" ry="${f1(0.9 * s)}" fill="#C08A4A"/>`;
        a += inkLine([[px + 2 * s, py - 1 * s], [px + 15 * s, py - 15 * s]], '#C9A35A', 1.8, s) + `<circle cx="${f1(px + 1.5 * s)}" cy="${f1(py - 0.5 * s)}" r="${f1(2.2 * s)}" fill="#C77B3A" stroke="${INK}" stroke-width="${f1(0.9 * s)}"/>`;
        return a + wisp(px - 4 * s, py - 2 * s, s, 10, '#FFFFFF', 0.6);
      };
      if (g.back) {
        // dari belakang: anglo di balik kain; yang terlihat sisi belakang kain (motif tembus samar)
        let faint = '';
        for (let ua = u0 + 0.06; ua + 0.2 < u1 - 0.02; ua += 0.13) { const a = at3(g, ua, Yk, 34), b = at3(g, ua + 0.18, Yk, 60); faint += `M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}`; }
        return o + anglo() + cloth(Yf, 16) + cloth(Yk, 30) + `<path d="${faint}" stroke="${c.accent}" stroke-width="${f1(2.4 * s)}" stroke-linecap="round" opacity=".22"/>`;
      }
      o += cloth(Yf, 16);
      // bagian kiri sudah dibatik (dasar sogan, parang biru), kanan masih garis pensil
      const wash: Pt[] = [at3(g, u0, Yf, 62), at3(g, um, Yf, 62)];
      for (let k = 0; k <= 4; k++) { const u = um - ((um - u0) * k) / 4; wash.push(at3(g, u, Yf, 20 + 2.5 * Math.sin((8 - k) * 1.7))); }
      o += g.poly(wash, '#E2BC86', 0);
      let band = '', pencil = '', dots = '';
      for (let ua = u0 - 0.1; ua < u1 - 0.06; ua += 0.13) {
        const pts: Pt[] = [];
        for (let k = 0; k <= 6; k++) { const f = k / 6, u = ua + 0.24 * f; if (u >= u0 + 0.01 && u <= u1 - 0.01) pts.push(at3(g, u, Yf, 22 + 36 * f + Math.sin(f * Math.PI * 3) * 1.5)); }
        if (pts.length < 2) continue;
        const seg = pathOf(pts);
        if (ua + 0.12 < um) { band += seg; for (const f of [0.3, 0.7]) { const u = ua + 0.24 * f + 0.06; if (u < um - 0.02 && u > u0) { const p = at3(g, u, Yf, 22 + 36 * f); dots += `M${f1(p[0])} ${f1(p[1])}h0.1`; } } } else pencil += seg;
      }
      o += `<path d="${band}" fill="none" stroke="${c.accent}" stroke-width="${f1(2.6 * s)}" stroke-linecap="round" stroke-linejoin="round"/>`;
      o += `<path d="${dots}" stroke="#FFFDF7" stroke-width="${f1(2 * s)}" stroke-linecap="round"/><path d="${pencil}" fill="none" stroke="#9A9384" stroke-width="${f1(0.9 * s)}" stroke-dasharray="${f1(3 * s)} ${f1(2 * s)}"/>`;

      // dingklik
      o += g.box(x + 0.54, y + 0.64, 0, 0.06, 0.22, 8, wood) + g.box(x + 0.82, y + 0.64, 0, 0.06, 0.22, 8, wood) + g.box(x + 0.5, y + 0.62, 8, 0.42, 0.26, 3, C3('#B5703F'));
      return o + anglo();
    },
  },
  gendang: {
    label: 'Kendang',
    colors: { main: '#8A4B2A', accent: '#F3E3B5' },
    draw(g, x, y, w, d, c) {
      const s = g.s, v = y + 0.5, zc = 22, ua = x + 0.08, ub = x + 0.92;
      const rad = (t: number) => 7 + 3 * t + 3.5 * Math.sin(Math.PI * t);
      let o = '';
      for (const u of [x + 0.22, x + 0.68]) o += g.box(u, y + 0.3, 0, 0.1, 0.4, 13, C3('#5A381F'));
      const pt = (t: number, a: number, dr = 0) => { const r = rad(t) + dr, u = ua + (ub - ua) * t; return at3(g, u, v + (r * Math.cos(a)) / 32, zc + r * Math.sin(a)); };
      const ring = (t: number, dr = 0, n = 24) => Array.from({ length: n }, (_, j) => pt(t, (j / n) * 2 * Math.PI, dr));
      const all: Pt[] = [];
      for (let i = 0; i <= 10; i++) all.push(...ring(i / 10));
      o += g.poly(hull(all), c.main, 1.8);
      // sisi yang terlihat: dari belakang, sisi yang lain
      const vis = (a: number) => (g.back ? -Math.cos(a) : Math.cos(a)) + Math.sin(a);
      const visArc = (t: number, dr = 0) => { const out: Pt[] = []; for (let j = 0; j <= 32; j++) { const a = (j / 32) * 2 * Math.PI - Math.PI / 4 + (g.back ? Math.PI / 2 : 0); if (vis(a) > -0.05) out.push(pt(t, a, dr)); } return out; };
      // tali kendang (zig-zag)
      const ac = g.back ? (3 * Math.PI) / 4 : Math.PI / 4, lace: Pt[] = [];
      for (let k = 0; k <= 10; k++) lace.push(pt(k % 2 ? 0.88 : 0.12, ac - 1.25 + k * 0.25, 0.3));
      o += inkLine(lace, c.accent, 1, s);
      o += thinLine(visArc(0.05, 0.4), '#3B2A20', 2.6 * s) + thinLine(visArc(0.95, 0.4), '#3B2A20', 2.6 * s);
      // muka kendang yang menghadap kamera
      const th = g.back ? 0 : 1;
      o += g.poly(ring(th, 0.6, 28), shade(c.main, -0.3), 1.6) + g.poly(ring(th, -1.6, 28), c.accent, 1.2);
      return o;
    },
  },

  /* ---------------- Spa Bali ---------------- */
  bakkayu: {
    label: 'Bak berendam kayu',
    colors: { main: '#B5703F', accent: '#8FD3E8' },
    draw(g, x, y, w, d, c) {
      const s = g.s, cu = x + w / 2, cv = y + d / 2, rx = w / 2 - 0.1, ry = d / 2 - 0.1, H = 28;
      const t = ovalTub(g, cu, cv, rx, ry, 0, H, C3(c.main));
      let o = shadowE(...(g.iso(cu, cv) as [number, number]), 34 * s, 17 * s) + t.side;
      // bilah kayu & simpai
      let staves = '';
      t.arc.forEach((i, k) => { if (k % 3 === 1) staves += `M${f1(t.lo[i][0])} ${f1(t.lo[i][1])}L${f1(t.hi[i][0])} ${f1(t.hi[i][1])}`; });
      o += `<path d="${staves}" stroke="${shade(c.main, -0.3)}" stroke-width="${f1(1 * s)}"/>`;
      for (const z of [6, H - 7]) { const r = t.ring(z); o += thinLine(t.arc.map((i) => r[i]), INK, 4 * s) + thinLine(t.arc.map((i) => r[i]), '#7A8094', 2.2 * s); }
      o += t.top;
      // air kembang
      const water = t.ring(H - 1, 0.07);
      o += g.poly(water, c.accent, 1.2);
      const W = (a: number, b: number) => at3(g, cu + a * rx, cv + b * ry, H - 1);
      for (const [a, b] of [[-0.45, -0.1], [0.25, 0.3]]) { const p = W(a, b); o += `<path d="M${f1(p[0] - 7 * s)} ${f1(p[1])}q${f1(7 * s)} ${f1(3 * s)} ${f1(14 * s)} 0" fill="none" stroke="#FFFFFF" stroke-width="${f1(1.4 * s)}" opacity=".8"/>`; }
      [[-0.2, -0.25, 0], [0.4, -0.2, 20], [-0.55, 0.25, 40], [0.05, 0.2, 60], [0.62, 0.15, 10]].forEach(([a, b, r]) => { const p = W(a, b); o += `<ellipse cx="${f1(p[0])}" cy="${f1(p[1])}" rx="${f1(2.6 * s)}" ry="${f1(1.5 * s)}" transform="rotate(${r} ${f1(p[0])} ${f1(p[1])})" fill="#F28BA0" stroke="${INK}" stroke-width="${f1(0.6 * s)}"/>`; });
      for (const [a, b, r] of [[-0.05, -0.05, 7], [0.48, 0.02, 6]]) { const p = W(a, b); o += kambojaFlower(p[0], p[1] - 1 * s, r * s, s, 10); }
      // handuk gulung di bibir bak
      const hp = at3(g, cu - rx + 0.12, cv - 0.05, H + 1);
      o += `<rect x="${f1(hp[0] - 9 * s)}" y="${f1(hp[1] - 5 * s)}" width="${f1(18 * s)}" height="${f1(8 * s)}" rx="${f1(4 * s)}" transform="rotate(-26 ${f1(hp[0])} ${f1(hp[1])})" fill="#FFFDF7" stroke="${INK}" stroke-width="${f1(1.2 * s)}"/>`;
      const m = at3(g, cu, cv, H + 4);
      return o + wisp(m[0] - 12 * s, m[1], s, 14) + wisp(m[0] + 6 * s, m[1] - 2 * s, s, 18) + wisp(m[0] + 20 * s, m[1] + 2 * s, s, 12);
    },
  },
  pancuran: {
    label: 'Pancuran batu',
    colors: { main: '#9C9A86', accent: '#8FD3E8' },
    draw(g, x, y, w, d, c) {
      const s = g.s, stone = C3(c.main), Y = y + 0.38;
      let o = g.box(x + 0.12, y + 0.14, 0, 0.76, 0.24, 80, stone);
      o += g.box(x + 0.15, y + 0.16, 80, 0.7, 0.2, 6, C3(shade(c.main, 0.1))) + g.box(x + 0.28, y + 0.19, 86, 0.44, 0.14, 7, C3(shade(c.main, 0.16)));
      const [fx, fy] = at3(g, x + 0.5, y + 0.26, 93);
      o += `<path d="M${f1(fx - 6 * s)} ${f1(fy + 1 * s)}Q${f1(fx - 7 * s)} ${f1(fy - 8 * s)} ${f1(fx)} ${f1(fy - 15 * s)}Q${f1(fx + 7 * s)} ${f1(fy - 8 * s)} ${f1(fx + 6 * s)} ${f1(fy + 1 * s)}Z" fill="${shade(c.main, 0.2)}" stroke="${INK}" stroke-width="${f1(1.3 * s)}" stroke-linejoin="round"/>`;
      const moss = (pts: [number, number, number][]) => pts.map(([u, v, z]) => { const p = at3(g, u, v, z); return `<ellipse cx="${f1(p[0])}" cy="${f1(p[1])}" rx="${f1(5 * s)}" ry="${f1(2.4 * s)}" fill="#6FA35A" stroke="${INK}" stroke-width="${f1(0.8 * s)}"/>`; }).join('');
      if (g.back) {
        // sisi belakang: susunan batu polos berlumut
        const m = onY(g, y + 0.14, x + 0.5);
        let seams = '';
        for (const v of [27, 54]) seams += `M${P([m(-12, v), m(12, v)]).replace(' ', 'L')}`;
        for (const [hx, v0, v1] of [[-6, 0, 27], [10, 27, 54], [-12, 54, 80]]) seams += `M${P([m(hx, v0), m(hx, v1)]).replace(' ', 'L')}`;
        o += `<path d="${seams}" stroke="${shade(c.main, -0.3)}" stroke-width="${f1(1.2 * s)}" fill="none"/>`;
        return o + g.box(x + 0.16, y + 0.46, 0, 0.68, 0.44, 18, C3(shade(c.main, 0.05))) + moss([[x + 0.3, y + 0.14, 3], [x + 0.7, y + 0.14, 4]]);
      }
      o += g.quadY(Y, x + 0.2, x + 0.8, 26, 74, shade(c.main, -0.1), 1.2);
      // ukiran bunga & sulur
      const m = onY(g, Y, x + 0.5, 0);
      let rel = '';
      for (let k = 0; k < 6; k++) { const a = (k / 6) * 2 * Math.PI; rel += `<polygon points="${P(discPts(m, Math.cos(a) * 4.4, 64 + Math.sin(a) * 4.4, 2.8, 2.8, 8))}" fill="${shade(c.main, 0.12)}"/>`; }
      rel += `<polygon points="${P(discPts(m, 0, 64, 2.4, 2.4, 8))}" fill="${shade(c.main, -0.25)}"/>`;
      rel += `<path d="M${P([m(-7, 32), m(-3, 42), m(-7, 50)]).replace(/ /g, 'L')}M${P([m(7, 32), m(3, 42), m(7, 50)]).replace(/ /g, 'L')}" fill="none" stroke="${shade(c.main, 0.15)}" stroke-width="${f1(2 * s)}" stroke-linecap="round" stroke-linejoin="round"/>`;
      o += rel;
      o += g.box(x + 0.16, y + 0.46, 0, 0.68, 0.44, 18, C3(shade(c.main, 0.05)));
      o += g.poly([at3(g, x + 0.22, y + 0.52, 16.5), at3(g, x + 0.78, y + 0.52, 16.5), at3(g, x + 0.78, y + 0.84, 16.5), at3(g, x + 0.22, y + 0.84, 16.5)], c.accent, 1.1);
      const fl = at3(g, x + 0.66, y + 0.74, 17);
      o += kambojaFlower(fl[0], fl[1], 5.5 * s, s, 30);
      // pancuran bambu & air jatuh
      const a = at3(g, x + 0.5, Y - 0.02, 56), b = at3(g, x + 0.5, Y + 0.16, 54.5), e = at3(g, x + 0.5, y + 0.62, 16.5);
      o += inkLine([a, b], '#C9A35A', 4.4, s) + `<ellipse cx="${f1(b[0])}" cy="${f1(b[1])}" rx="${f1(2.6 * s)}" ry="${f1(3 * s)}" fill="#6B4A2B" stroke="${INK}" stroke-width="${f1(1 * s)}"/>`;
      const fall = `M${f1(b[0])} ${f1(b[1] + 1 * s)}Q${f1(b[0] - 3 * s)} ${f1(b[1] + 8 * s)} ${f1(e[0])} ${f1(e[1])}`;
      o += `<path d="${fall}" fill="none" stroke="#DFF3FB" stroke-width="${f1(4 * s)}" stroke-linecap="round" opacity=".85"/><path class="water" d="${fall}" fill="none" stroke="#FFFFFF" stroke-width="${f1(1.6 * s)}" stroke-linecap="round" stroke-dasharray="${f1(4 * s)} ${f1(4 * s)}"/>`;
      o += `<ellipse cx="${f1(e[0])}" cy="${f1(e[1])}" rx="${f1(7 * s)}" ry="${f1(2.4 * s)}" fill="none" stroke="#FFFFFF" stroke-width="${f1(1.2 * s)}" opacity=".9"/>`;
      return o + moss([[x + 0.2, y + 0.9, 17], [x + 0.84, y + 0.6, 17.5]]);
    },
  },
  kamboja: {
    label: 'Pot kamboja',
    colors: { main: '#4F9A5A', accent: '#B9B3A4' },
    draw(g, x, y, w, d, c) {
      const s = g.s, [cx, cy] = g.iso(x + 0.5, y + 0.5);
      let o = g.box(x + 0.3, y + 0.3, 0, 0.4, 0.4, 16, C3(c.accent)) + g.box(x + 0.26, y + 0.26, 16, 0.48, 0.48, 4, C3(shade(c.accent, 0.1)));
      o += g.poly([at3(g, x + 0.32, y + 0.32, 20), at3(g, x + 0.68, y + 0.32, 20), at3(g, x + 0.68, y + 0.68, 20), at3(g, x + 0.32, y + 0.68, 20)], '#5A3A22', 1);
      const B = (dx: number, dy: number): Pt => [cx + dx * s, cy + dy * s], bark = '#9C8A78';
      o += inkLine([B(0, -21), B(-1, -40), B(-3, -52)], bark, 5, s);
      o += inkLine([B(-1, -40), B(-13, -55), B(-21, -70)], bark, 3.4, s) + inkLine([B(-3, -52), B(3, -68), B(5, -84)], bark, 3.2, s);
      o += inkLine([B(-1, -45), B(12, -57), B(21, -66)], bark, 3, s) + inkLine([B(-13, -55), B(-26, -60)], bark, 2.4, s);
      o += `<g class="canopy">`;
      const tips: [number, number, number][] = [[-26, -60, 0], [-21, -70, 1], [21, -66, 2], [5, -84, 3]];
      for (const [tx, ty, i] of tips) {
        const [px, py] = B(tx, ty);
        [-160, -120, -80, -40, 0].forEach((a, k) => {
          const rad = (a * Math.PI) / 180, lx = px + Math.cos(rad) * 8 * s, ly = py + Math.sin(rad) * 7 * s;
          o += `<ellipse cx="${f1(lx)}" cy="${f1(ly)}" rx="${f1(9 * s)}" ry="${f1(3.4 * s)}" transform="rotate(${a} ${f1(lx)} ${f1(ly)})" fill="${(k + i) % 2 ? shade(c.main, -0.16) : c.main}" stroke="${INK}" stroke-width="${f1(1.1 * s)}"/>`;
        });
        o += kambojaFlower(px - 2 * s, py - 3 * s, 6 * s, s, i * 20) + kambojaFlower(px + 5 * s, py + 1 * s, 5 * s, s, 40 + i * 13);
      }
      return o + `</g>`;
    },
  },
  rakhanduk: {
    label: 'Rak handuk bambu',
    colors: { main: '#C9A35A', accent: '#3E8E7E' },
    draw(g, x, y, w, d, c) {
      const s = g.s, H = 96;
      const rail = (u: number, t: number): Pt => { const a = at3(g, u, y + 0.74, 0), b = at3(g, u, y + 0.22, H); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
      let o = shadowE(...(g.iso(x + 0.5, y + 0.7) as [number, number]), 22 * s, 6 * s);
      for (const u of [x + 0.2, x + 0.8]) {
        o += inkLine([rail(u, 0), rail(u, 1.03)], c.main, 4, s);
        for (const t of [0.31, 0.53, 0.75, 0.97]) { const p = rail(u, t); o += thinLine([[p[0] - 2.4 * s, p[1]], [p[0] + 2.4 * s, p[1]]], shade(c.main, -0.35), 1.2 * s); }
      }
      // anak tangga & handuk, dari belakang ke depan (tampak belakang: tangga condong ke arah kamera)
      const towels: Record<number, [number, number, number, string, string]> = { 0.86: [0.1, 0.72, 26, '#FFFDF7', c.accent], 0.64: [0.26, 0.9, 22, c.accent, '#FFFDF7'], 0.42: [0.12, 0.7, 20, '#EBCBA6', '#C0392B'] };
      const steps = [0.2, 0.42, 0.64, 0.86].map((t) => ({ t, k: g.iso(x + 0.5, y + 0.74 - 0.52 * t)[1] - t * H * s }));
      for (const { t } of steps.sort((a, b) => a.k - b.k)) {
        o += inkLine([rail(x + 0.2, t), rail(x + 0.8, t)], shade(c.main, -0.05), 2.6, s);
        const tw = towels[t];
        if (!tw) continue;
        const [a0, a1, len, col, stripe] = tw;
        const p = rail(x + 0.2 + 0.6 * a0, t), q = rail(x + 0.2 + 0.6 * a1, t);
        o += `<path d="M${f1(p[0])} ${f1(p[1] + len * s)}V${f1(p[1])}Q${f1((p[0] + q[0]) / 2)} ${f1((p[1] + q[1]) / 2 - 5 * s)} ${f1(q[0])} ${f1(q[1])}V${f1(q[1] + len * s)}Z" fill="${col}" stroke="${INK}" stroke-width="${f1(1.3 * s)}" stroke-linejoin="round"/>`;
        o += `<path d="M${f1(p[0])} ${f1(p[1] + (len - 5) * s)}L${f1(q[0])} ${f1(q[1] + (len - 5) * s)}M${f1(p[0])} ${f1(p[1] + (len - 8) * s)}L${f1(q[0])} ${f1(q[1] + (len - 8) * s)}" stroke="${stripe}" stroke-width="${f1(1.4 * s)}"/>`;
      }
      return o;
    },
  },
  lilinaroma: {
    label: 'Lilin aroma',
    colors: { main: '#8C8A78', accent: '#FFF1D0' },
    draw(g, x, y, w, d, c) {
      const s = g.s, top = 14;
      let o = g.box(x + 0.18, y + 0.22, 0, 0.64, 0.56, 11, C3(c.main)) + g.box(x + 0.12, y + 0.16, 11, 0.76, 0.68, 3, C3(shade(c.main, 0.12)));
      if (!g.back) o += g.quadY(y + 0.78, x + 0.3, x + 0.7, 3, 8, shade(c.main, -0.22), 1) + g.quadX(x + 0.82, y + 0.34, y + 0.66, 3, 8, shade(c.main, -0.32), 1);
      const L: [number, string][] = [];
      const add = (cu: number, cv: number, h: string) => L.push([g.iso(cu, cv)[1], h]);
      for (const [u, v, r, h] of [[0.34, 0.36, 0.085, 22], [0.54, 0.3, 0.075, 15], [0.68, 0.48, 0.08, 10]]) {
        const cu = x + u, cv = y + v, t = ovalTub(g, cu, cv, r, r, top, h, C3(c.accent), 1.2), [px, py] = at3(g, cu, cv, top + h);
        add(cu, cv, glowC(px, py - 7 * s, 12 * s, '#FFE7A0', 0.4, 'blink') + t.side + t.top + thinLine([[px, py], [px, py - 3 * s]], INK, 1 * s) + flame(px, py - 2 * s, s, 0.55));
      }
      {
        const cu = x + 0.38, cv = y + 0.64, [px, py] = at3(g, cu, cv, top + 5);
        add(cu, cv, lathe(g, cu, cv, [[top, 0.08], [top + 5, 0.14]], '#E8E2D6', 1.2) + flatE(g, cu, cv, top + 5, 0.14, '#E8E2D6', 1.2) + flatE(g, cu, cv, top + 5.2, 0.105, '#8FD3E8', 0) + kambojaFlower(px, py, 5.2 * s, s, 15));
      }
      for (const [u, v, col] of [[0.24, 0.5, '#B9B3A4'], [0.56, 0.74, '#A8A293'], [0.62, 0.66, '#CFC9BA']] as [number, number, string][]) {
        const [px, py] = at3(g, x + u, y + v, top);
        add(x + u, y + v, `<ellipse cx="${f1(px)}" cy="${f1(py - 1 * s)}" rx="${f1(3.4 * s)}" ry="${f1(2.2 * s)}" fill="${col}" stroke="${INK}" stroke-width="${f1(0.8 * s)}"/>`);
      }
      return o + L.sort((a, b) => a[0] - b[0]).map((e) => e[1]).join('');
    },
  },
};
Object.assign(FURN, PREMIUM);

/** konteks gambar isometrik (untuk modul gambar lain, mis. art-alun.ts) */
export type IsoCtx = Ctx;
/** bantuan gambar isometrik untuk modul gambar lain (mis. art-toko3.ts) */
export { C3, f1, at3, rk, pathOf, inkLine, thinLine, wisp, hull, prism, ovalTub, lathe, flatE, frontArc, onY, onX, discPts, glowC, shadowE, flame, sortBoxes };

/** alat gambar isometrik bersama (dipakai modul gambar lain, mis. art-edisi.ts); semua titik lewat g.iso → ikut tampak belakang */
export const ISO_KIT = { C3, f1, at3, rk, pathOf, inkLine, thinLine, prism, ovalTub, lathe, flatE, frontArc, onY, onX, discPts, hull, glowC, shadowE, koi };

/** Dinding & lantai premium (pola digambar di wallRun / floorSVG) */
Object.assign(WALLS, {
  langit: { label: 'Langit malam', colors: { main: '#2B3A6B', accent: '#F7C548' } },
  kawung: { label: 'Batik kawung', colors: { main: '#F3E3B5', accent: '#8A5A36' } },
  gedek: { label: 'Anyaman bambu (gedek)', colors: { main: '#DDBF85', accent: '#A9844C' } },
});
Object.assign(FLOORS, {
  terasoemas: { label: 'Teraso emas', colors: { main: '#F1E9D8', accent: '#D9A441' } },
  pasir: { label: 'Pasir pantai', colors: { main: '#F0D9A8', accent: '#E2C48C' } },
  batutaman: { label: 'Batu taman', colors: { main: '#8CC56E', accent: '#B9B3A4' } },
  papanjati: { label: 'Parket jati', colors: { main: '#A4693E', accent: '#7A4526' } },
  batukali: { label: 'Batu kali', colors: { main: '#D3CAB6', accent: '#ABA597' } },
});
/** Dinding & lantai toko koin (paket konten 18: Mebel Jati & Toko Bangunan; pola digambar di wallRun / floorSVG) */
Object.assign(WALLS, {
  lambri: { label: 'Lis kayu (lambrisering)', colors: { main: '#F4E6C8', accent: '#A0673C' } },
  kembang: { label: 'Kembang kecil', colors: { main: '#FBEADB', accent: '#E07A8C' } },
});
Object.assign(FLOORS, {
  tegelkembang: { label: 'Tegel kembang', colors: { main: '#EADFC8', accent: '#B5523B' } },
  kerikil: { label: 'Kerikil', colors: { main: '#D2CBBB', accent: '#A69C88' } },
  batamerah: { label: 'Bata merah', colors: { main: '#C4674A', accent: '#EBDCC2' } },
});
/** pola dinding toko koin (dipanggil wallRun untuk tiap bentang; dinding lain: kosong) */
function toko3Wall(g: Ctx, side: 'L' | 'R', a: number, b: number, wall: WallC, main: string) {
  const L = side === 'L', WH = WALL_H;
  const at = (u: number) => onWall(g, side, u);
  const up = (p: number[], v: number) => [p[0], p[1] - v];
  let o = '';
  if (wall.key === 'lambri') {
    // lambrisering: papan kayu tegak di bagian bawah dinding, lis di atasnya, garis lis tipis dekat plafon
    const wood = L ? wall.accent : shade(wall.accent, 0.16), v0 = 24, v1 = 72;
    const p0 = at(a), p1 = at(b);
    o += `<polygon points="${P([up(p0, v0), up(p1, v0), up(p1, v1), up(p0, v1)])}" fill="${wood}"/>`;
    let ln = '';
    for (let u = Math.ceil(a * 4 + 0.001) / 4; u < b - 0.001; u += 0.25) { const p = at(u); ln += `M${f1(p[0])} ${f1(p[1] - v0)}V${f1(p[1] - v1 + 2)}`; }
    o += `<path d="${ln}" stroke="${shade(wood, -0.24)}" stroke-width="1.4"/>`;
    o += `<polygon points="${P([up(p0, v1 - 3), up(p1, v1 - 3), up(p1, v1 + 4), up(p0, v1 + 4)])}" fill="${shade(wood, -0.1)}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`;
    o += `<line x1="${f1(p0[0])}" y1="${f1(p0[1] - WH + 16)}" x2="${f1(p1[0])}" y2="${f1(p1[1] - WH + 16)}" stroke="${shade(main, -0.12)}" stroke-width="2.4"/>`;
  } else if (wall.key === 'kembang') {
    // kembang kecil empat kelopak berdaun, baris berselang-seling
    const fc = L ? wall.accent : shade(wall.accent, 0.22), lc = L ? '#8DBF7E' : shade('#8DBF7E', 0.25), mid = L ? '#F7C548' : shade('#F7C548', 0.25);
    let petals = '', leaves = '', dots = '', row = 0;
    const circ = (cx: number, cy: number, r: number) => `M${f1(cx - r)} ${f1(cy)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
    for (let v = 44; v < WH - 12; v += 26, row++)
      for (let u = a + 0.28 + (row % 2) * 0.3; u < b - 0.12; u += 0.6) {
        const p = at(u), px = p[0], py = p[1] - v;
        leaves += `M${f1(px + 2)} ${f1(py + 3)}q5 0 7 5q-5 1 -7 -5Z`;
        for (const [dx, dy] of [[-2.6, 0], [2.6, 0], [0, -2.6], [0, 2.6]]) petals += circ(px + dx, py + dy, 2.3);
        dots += circ(px, py, 1);
      }
    o += `<path d="${leaves}" fill="${lc}"/><path d="${petals}" fill="${fc}"/><path d="${dots}" fill="${mid}"/>`;
  }
  return o;
}
/** pola lantai toko koin untuk petak (i, j): digambar di atas petak dasar, tidak menangkap ketukan */
function toko3Floor(g: Ctx, floor: FloorC, i: number, j: number, edit: boolean) {
  const k = floor.key;
  if (k !== 'tegelkembang' && k !== 'kerikil' && k !== 'batamerah') return '';
  const s = g.s, q = (u: number, v: number) => g.iso(i + u, j + v);
  const tile = P([q(0, 0), q(1, 0), q(1, 1), q(0, 1)]);
  const poly = (pts: number[][]) => `M${P(pts).replace(/ /g, 'L')}Z`;
  const ell = (c: number[], rx: number) => `M${f1(c[0] - rx)} ${f1(c[1])}a${f1(rx)} ${f1(rx / 2)} 0 1 0 ${f1(2 * rx)} 0a${f1(rx)} ${f1(rx / 2)} 0 1 0 ${f1(-2 * rx)} 0Z`;
  const pe = ' pointer-events="none"';
  if (k === 'tegelkembang') {
    // tegel semen bermotif: kembang empat kelopak di tengah, seperempat lingkaran di sudut (jadi bulatan bersama tetangga)
    let o = `<polygon points="${tile}" fill="${floor.main}" stroke="${shade(floor.main, -0.22)}" stroke-width="1"${pe}/>`;
    let corners = '', petals = '';
    for (const [cu, cv] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      const pts: number[][] = [q(cu, cv)];
      for (let t = 0; t <= 6; t++) { const a = (Math.PI / 2) * (t / 6), du = cu ? -1 : 1, dv = cv ? -1 : 1; pts.push(q(cu + du * 0.2 * Math.cos(a), cv + dv * 0.2 * Math.sin(a))); }
      corners += poly(pts);
    }
    for (const [du, dv] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const tip = q(0.5 + du * 0.3, 0.5 + dv * 0.3), sideA = q(0.5 + du * 0.13 - dv * 0.08, 0.5 + dv * 0.13 + du * 0.08), sideB = q(0.5 + du * 0.13 + dv * 0.08, 0.5 + dv * 0.13 - du * 0.08);
      petals += poly([q(0.5, 0.5), sideA, tip, sideB]);
    }
    const sw = f1(Math.min(1, s) * 0.9);
    o += `<path d="${corners}" fill="#4E8378" stroke="${INK}" stroke-opacity=".35" stroke-width="${sw}"${pe}/>`;
    o += `<path d="${poly([q(0.12, 0.12), q(0.88, 0.12), q(0.88, 0.88), q(0.12, 0.88)])}" fill="none" stroke="${shade(floor.main, -0.16)}" stroke-width="${sw}"${pe}/>`;
    o += `<path d="${petals}" fill="${floor.accent}" stroke="${INK}" stroke-opacity=".35" stroke-width="${sw}"${pe}/>`;
    return o + `<path d="${ell(q(0.5, 0.5), 3.2 * s)}" fill="#F2C14E"${pe}/>`;
  }
  if (k === 'kerikil') {
    // kerikil: batu kecil acak (tetap per petak) di atas tanah berpasir
    let o = `<polygon points="${tile}" fill="${floor.main}" stroke="${shade(floor.main, -0.06)}" stroke-width="1"${pe}/>`;
    const d: string[] = ['', '', '', ''];
    for (let n = 0; n < 11; n++) {
      const fr = (t: number) => { const v = Math.sin(t) * 43758.5453; return v - Math.floor(v); };
      const h = fr(i * 12.9898 + j * 78.233 + n * 37.719), h2 = fr(i * 39.346 + j * 11.135 + n * 83.155);
      const u = 0.1 + 0.8 * h, v = 0.1 + 0.8 * h2;
      d[n % 4] += ell(q(u, v), (1.8 + ((n * 7) % 5) * 0.45) * s);
    }
    const cols = [floor.accent, shade(floor.accent, 0.3), shade(floor.main, -0.16), '#F4F0E6'];
    return o + d.map((p, n) => `<path d="${p}" fill="${cols[n]}"${pe}/>`).join('');
  }
  // bata merah susun memanjang: 4 baris per petak, sambungan berselang
  let o = `<polygon points="${tile}" fill="${floor.main}" stroke="${floor.accent}" stroke-width="${f1(1.3 * Math.min(1, s))}"${pe}/>`;
  const seg = (u0: number, v0: number, u1: number, v1: number) => { const a = q(u0, v0), b = q(u1, v1); return `M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}`; };
  let ln = '', dark = '';
  for (let r = 0; r < 4; r++) {
    const v0 = r / 4, v1 = (r + 1) / 4;
    if (r) ln += seg(0, v0, 1, v0);
    const joints = (r + j) % 2 ? [0.25, 0.75] : [0.5];
    for (const u of joints) ln += seg(u, v0, u, v1);
    if ((i * 3 + j * 5 + r) % 4 === 0) { const [u0, u1] = joints.length === 1 ? [0.5, 1] : [0.25, 0.75]; dark += poly([q(u0, v0), q(u1, v0), q(u1, v1), q(u0, v1)]); }
  }
  return o + `<path d="${dark}" fill="${shade(floor.main, -0.1)}"${pe}/><path d="${ln}" stroke="${floor.accent}" stroke-width="${f1(1.3 * Math.min(1, s))}"${pe}/>`;
}
/**
 * Pola dinding & lantai dari modul gambar lain (mis. art-perabot3.ts): bentuknya didaftarkan ke WALLS / FLOORS, lalu
 * fungsi polanya dipanggil wallRun untuk tiap bentang dinding dan floorSVG untuk tiap petak (bentuk lain: kosong).
 */
export function registerSurfaces(
  walls: Record<string, { label: string; colors: Record<string, string> }>,
  floors: Record<string, { label: string; colors: Record<string, string> }>,
  wall?: WallPattern,
  floor?: FloorPattern,
) {
  Object.assign(WALLS, walls);
  Object.assign(FLOORS, floors);
  if (wall) WALL_PATTERNS.push(wall);
  if (floor) FLOOR_PATTERNS.push(floor);
}
/** titik dinding belakang (L: bidang x = 0, R: bidang y = 0) & tinggi dinding, untuk pola dinding di modul lain */
export const WALL_KIT = { onWall, WALL_H };

/** Dinding & lantai Edisi Spesial (efek bergerak: kelas ed-* dianimasikan CSS game) */
Object.assign(WALLS, { aurora: { label: 'Aurora (bergerak)', colors: { main: '#25336A', accent: '#7FE8C0' } } });
Object.assign(FLOORS, { kolamkaca: { label: 'Kolam kaca (ikan berenang)', colors: { main: '#4C9BC8', accent: '#DDF0F8' } } });

/* ------------------------------------------------------------------ */
/* Pekarangan: rumah berdiri di atas pulau rumput (diorama)             */
/* ------------------------------------------------------------------ */

/** batas petak pekarangan di sekeliling denah (belakang sempit, depan lebih lebar untuk jalan & gerbang) */
function yardBox(plan: HousePlan) {
  let X0 = Infinity, X1 = -Infinity, Y0 = Infinity, Y1 = -Infinity;
  for (const r of plan.rooms) { X0 = Math.min(X0, r.gx); Y0 = Math.min(Y0, r.gy); X1 = Math.max(X1, r.gx + r.w); Y1 = Math.max(Y1, r.gy + r.d); }
  return { X0, X1, Y0, Y1, a: X0 - 2.5, b: Y0 - 2.5, c: X1 + 4, d: Y1 + 4 };
}
const YARD_DEPTH = 40;
/** Kotak pembatas (koordinat SVG) pekarangan, termasuk pohon di belakang & tebal tanah. */
export function houseYardBounds(plan: HousePlan) {
  if (!plan.rooms.length) return houseBounds(plan);
  const { a, b, c, d } = yardBox(plan);
  const L = houseIso(a, d), R = houseIso(c, b), T = houseIso(a, b), F = houseIso(c, d);
  const y0 = Math.min(T[1] - 165, houseBounds(plan).y);
  return { x: L[0], y: y0, w: R[0] - L[0], h: F[1] + YARD_DEPTH + 30 - y0 };
}
/**
 * Pekarangan di sekeliling rumah: pulau rumput bertepi tanah, semak di belakang, pohon, bunga di depan rumah,
 * jalan batu ke gerbang, lampu taman & kotak surat, pagar bambu. Semua di luar tapak rumah (tidak menutupi ruangan),
 * digambar sebelum rumah. Satu string SVG tanpa animasi: cukup dibuat ulang bila denah berubah.
 */
export function houseYardSVG(plan: HousePlan, night = false): string {
  if (!plan.rooms.length) return '';
  const { X0, X1, Y0, Y1, a, b, c, d } = yardBox(plan);
  const g = HG, I = (x: number, y: number) => houseIso(x, y);
  const L = I(a, d), F = I(c, d), R = I(c, b), T = I(a, b);
  const dn = (p: number[], k: number) => [p[0], p[1] + k];
  const sw = `stroke="${INK}" stroke-linejoin="round"`;
  let o = `<g class="yard" pointer-events="none">`;
  // bayangan pulau, sisi tanah, bibir rumput, batu kecil di tanah
  o += `<ellipse cx="${f1((L[0] + R[0]) / 2)}" cy="${f1(F[1] + YARD_DEPTH + 22)}" rx="${f1((R[0] - L[0]) * 0.45)}" ry="30" fill="${INK}" opacity=".09"/>`;
  o += `<polygon points="${P([L, F, dn(F, YARD_DEPTH), dn(L, YARD_DEPTH)])}" fill="#B07A44" ${sw} stroke-width="2.6"/>`;
  o += `<polygon points="${P([F, R, dn(R, YARD_DEPTH), dn(F, YARD_DEPTH)])}" fill="#8F6034" ${sw} stroke-width="2.6"/>`;
  o += `<polygon points="${P([L, F, dn(F, 10), dn(L, 10)])}" fill="#6FAE58"/><polygon points="${P([F, R, dn(R, 10), dn(F, 10)])}" fill="#5E9A4A"/>`;
  for (let k = 0; k < 14; k++) {
    const t = (k * 0.137 + 0.05) % 1, left = k % 2 === 0;
    const p = left ? [L[0] + (F[0] - L[0]) * t, L[1] + (F[1] - L[1]) * t] : [F[0] + (R[0] - F[0]) * t, F[1] + (R[1] - F[1]) * t];
    o += `<ellipse cx="${f1(p[0])}" cy="${f1(p[1] + 19 + (k % 3) * 6)}" rx="${3 + (k % 3)}" ry="2.4" fill="${left ? '#946233' : '#76502A'}"/>`;
  }
  // rumput + jalur potong rumput
  o += `<polygon points="${P([T, R, F, L])}" fill="#A2D47E" ${sw} stroke-width="2.6"/>`;
  for (let x = Math.ceil(a); x < c; x += 2) o += `<polygon points="${P([I(x, b), I(Math.min(c, x + 1), b), I(Math.min(c, x + 1), d), I(x, d)])}" fill="#AEDB8A" opacity=".55"/>`;
  // semak rendah di dua tepi belakang
  const bush = (p: number[], k: number) => `<ellipse cx="${f1(p[0])}" cy="${f1(p[1] - 14)}" rx="22" ry="15" fill="${k % 2 ? '#5DA05A' : '#6DB068'}" stroke="${INK}" stroke-width="1.6"/>`;
  for (let x = a + 0.5, k = 0; x < c; x += 1, k++) o += bush(I(x, b + 0.35), k);
  for (let y = b + 1.5, k = 0; y < d; y += 1, k++) o += bush(I(a + 0.35, y), k + 1);
  // jumput rumput (tidak di tapak rumah)
  const inHouse = (x: number, y: number) => x > X0 - 0.6 && x < X1 + 0.6 && y > Y0 - 0.6 && y < Y1 + 1.2;
  for (let k = 0; k < 26; k++) {
    const x = a + 0.8 + ((k * 7.31) % (c - a - 1.6)), y = b + 1 + ((k * 4.77) % (d - b - 2));
    if (inHouse(x, y)) continue;
    const p = I(x, y);
    o += `<path d="M${f1(p[0] - 6)} ${f1(p[1])}l2 -9l2 7l2 -11l2 11l2 -7l2 9" fill="none" stroke="#4F8F45" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  // jalan batu dari sudut depan rumah ke gerbang
  for (let t = 0.35; t < 3.6; t += 0.75) { const p = I(X1 + t, Y1 + t); o += `<ellipse cx="${f1(p[0])}" cy="${f1(p[1])}" rx="15" ry="7.5" fill="#D9D2C3" stroke="${INK}" stroke-width="1.6"/><ellipse cx="${f1(p[0] - 3)}" cy="${f1(p[1] - 2)}" rx="6" ry="2.6" fill="#EEE8DA"/>`; }
  // bunga di sepanjang depan rumah (agak menjauh dari lantai supaya tidak tertutup)
  const cols = ['#FF8FA3', '#F7C548', '#FFFDF7', '#E0583F', '#B48CE0'];
  const flower = (p: number[], k: number) => `<path d="M${f1(p[0])} ${f1(p[1])}v-8" stroke="#4F8F45" stroke-width="2"/><circle cx="${f1(p[0])}" cy="${f1(p[1] - 10)}" r="4" fill="${cols[k % 5]}" stroke="${INK}" stroke-width="1.3"/>`;
  for (let x = X0 + 0.4, k = 0; x < X1 - 0.3; x += 0.8, k++) o += flower(I(x, Y1 + 1), k);
  for (let y = Y0 + 0.4, k = 2; y < Y1 - 0.9; y += 0.8, k++) o += flower(I(X1 + 1, y), k);
  // pohon: kiri & kanan rumah, beringin di belakang (mengintip di atas dinding)
  o += FURN.pohon.draw(g, X0 - 2.1, Y1 + 1.4, 1, 1, FURN.pohon.colors, {});
  o += FURN.pohon.draw(g, X1 + 1.6, Y0 - 2.2, 1, 1, { main: '#4F9A57', accent: '#8A5A36' }, {});
  o += FURN.beringin.draw(g, X0 - 2.3, Y0 - 2.3, 1, 1, FURN.beringin.colors, {});
  // lampu taman (menyala malam hari) & kotak surat di dekat gerbang
  { const p = I(c - 1.2, d - 2.4);
    o += `<ellipse cx="${f1(p[0])}" cy="${f1(p[1])}" rx="9" ry="4" fill="${INK}" opacity=".15"/><rect x="${f1(p[0] - 2.5)}" y="${f1(p[1] - 60)}" width="5" height="60" fill="#3B3F55" stroke="${INK}" stroke-width="1.4"/>`;
    if (night) o += glowC(p[0], p[1] - 66, 36, '#FFE7A0', 0.5, '');
    o += `<path d="M${f1(p[0] - 10)} ${f1(p[1] - 58)}h20l-4 -16h-12Z" fill="${night ? '#FFE27A' : '#FFF4D6'}" ${sw} stroke-width="1.8"/><path d="M${f1(p[0] - 12)} ${f1(p[1] - 74)}h24" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`; }
  { const p = I(c - 2.4, d - 1.1);
    o += `<rect x="${f1(p[0] - 2)}" y="${f1(p[1] - 30)}" width="4" height="30" fill="#8A5A36" stroke="${INK}" stroke-width="1.2"/><path d="M${f1(p[0] - 13)} ${f1(p[1] - 30)}v-12a8 8 0 0 1 8 -8h10a8 8 0 0 1 8 8v12Z" fill="#E0583F" ${sw} stroke-width="1.8"/><path d="M${f1(p[0] + 9)} ${f1(p[1] - 46)}v-12h8v5h-8" fill="#F7C548" stroke="${INK}" stroke-width="1.4"/>`; }
  // pagar bambu di dua tepi depan, celah gerbang di sudut depan
  const FC = '#D9B26A';
  o += g.quadY(d - 0.15, a + 0.2, c - 2.2, 12, 17, shade(FC, -0.05)) + g.quadY(d - 0.15, a + 0.2, c - 2.2, 25, 30, shade(FC, -0.05));
  o += g.quadX(c - 0.15, b + 0.2, d - 2.2, 12, 17, shade(FC, -0.2)) + g.quadX(c - 0.15, b + 0.2, d - 2.2, 25, 30, shade(FC, -0.2));
  for (let u = a + 0.2; u <= c - 2.2 + 0.001; u += 0.5) o += g.quadY(d - 0.15, u - 0.06, u + 0.06, 0, 36, shade(FC, 0.12), 1.2);
  for (let u = b + 0.2; u <= d - 2.2 + 0.001; u += 0.5) o += g.quadX(c - 0.15, u - 0.06, u + 0.06, 0, 36, shade(FC, -0.1), 1.2);
  return o + `</g>`;
}

/** waktu langit menurut jam pemain */
export type SkyTime = 'pagi' | 'siang' | 'sore' | 'malam';
export function skyTime(hour: number): SkyTime {
  return hour >= 5 && hour < 10 ? 'pagi' : hour >= 10 && hour < 15 ? 'siang' : hour >= 15 && hour < 18 ? 'sore' : 'malam';
}
