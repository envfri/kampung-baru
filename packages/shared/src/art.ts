// Semua gambar game dibuat sebagai SVG dari kode (tanpa file gambar), sehingga ringan,
// tajam di semua layar, dan bisa diatur warnanya dari admin. Admin juga bisa memakai
// gambar upload (type: 'image') untuk item baru.
//
// Fungsi di sini mengembalikan string SVG. Dipakai oleh game dan pratinjau di admin.

import type { HousePlan, HouseDoor, WallSeg } from './house';

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
  return { s, iso, poly, box, quadX, quadY };
}
type Ctx = ReturnType<typeof G>;

/* ------------------------------------------------------------------ */
/* Furniture                                                           */
/* ------------------------------------------------------------------ */

type FurnFn = (g: Ctx, x: number, y: number, w: number, d: number, c: Record<string, string>, p: Record<string, number>) => string;

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
      o += g.box(x + w / 2 - 0.12, y + d / 2 - 0.12, 0, 0.24, 0.24, 62, C3(c.accent));
      for (const [dx, dy, r, k] of [[0, -112, 28, 0], [-22, -86, 25, 1], [22, -90, 24, 1], [-6, -72, 20, 0], [14, -68, 18, 0]])
        o += `<circle cx="${f1(cx + dx * s)}" cy="${f1(cy + dy * s)}" r="${f1(r * s)}" fill="${k ? shade(c.main, -0.14) : c.main}" stroke="${INK}" stroke-width="${f1(1.8 * s)}"/>`;
      return o + `<circle cx="${f1(cx - 9 * s)}" cy="${f1(cy - 120 * s)}" r="${f1(7 * s)}" fill="${shade(c.main, 0.35)}"/><circle cx="${f1(cx + 16 * s)}" cy="${f1(cy - 84 * s)}" r="${f1(3.5 * s)}" fill="#E0583F" stroke="${INK}" stroke-width="${f1(s)}"/>`;
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
      let o = `<ellipse cx="${f1(cx)}" cy="${f1(cy + 2 * s)}" rx="${f1(62 * s)}" ry="${f1(24 * s)}" fill="${INK}" opacity=".14"/>`;
      // akar gantung & batang besar
      o += `<path d="M${f1(cx - 16 * s)} ${f1(cy)}C${f1(cx - 14 * s)} ${f1(cy - 50 * s)} ${f1(cx - 10 * s)} ${f1(cy - 90 * s)} ${f1(cx - 6 * s)} ${f1(cy - 120 * s)}L${f1(cx + 8 * s)} ${f1(cy - 120 * s)}C${f1(cx + 12 * s)} ${f1(cy - 90 * s)} ${f1(cx + 16 * s)} ${f1(cy - 50 * s)} ${f1(cx + 18 * s)} ${f1(cy)}Z" fill="${c.accent}" stroke="${INK}" stroke-width="${f1(2.2 * s)}" stroke-linejoin="round"/>`;
      for (const dx of [-46, -30, 30, 44]) o += `<path d="M${f1(cx + dx * s)} ${f1(cy - 104 * s)}q${f1(dx > 0 ? 4 * s : -4 * s)} ${f1(40 * s)} 0 ${f1(84 * s)}" stroke="${shade(c.accent, -0.1)}" stroke-width="${f1(2.2 * s)}" fill="none" stroke-linecap="round"/>`;
      for (const [dx, dy, r, k] of [[0, -168, 40, 0], [-44, -140, 36, 1], [44, -142, 36, 1], [-24, -120, 32, 0], [26, -118, 32, 0], [-62, -116, 22, 1], [62, -118, 22, 1]])
        o += `<circle cx="${f1(cx + dx * s)}" cy="${f1(cy + dy * s)}" r="${f1(r * s)}" fill="${k ? shade(c.main, -0.12) : c.main}" stroke="${INK}" stroke-width="${f1(2 * s)}"/>`;
      return o + `<circle cx="${f1(cx - 14 * s)}" cy="${f1(cy - 182 * s)}" r="${f1(10 * s)}" fill="${shade(c.main, 0.3)}"/><circle cx="${f1(cx + 30 * s)}" cy="${f1(cy - 150 * s)}" r="${f1(6 * s)}" fill="${shade(c.main, 0.3)}"/>`;
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

type WearSlot = 'head' | 'face' | 'neck' | 'back';
type WearFn = (c: Record<string, string>) => string;
// draw: digambar di depan tubuh; back: di belakang tubuh (sayap, ransel, jubah)
const WEAR: Record<string, { label: string; slot: WearSlot; colors: Record<string, string>; draw: WearFn; back?: WearFn }> = {
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
};

const WEAR_IMG_BOX: Record<string, [number, number, number, number]> = {
  head: [-48, -112, 96, 52],
  face: [-34, -60, 68, 30],
  neck: [-44, -36, 88, 40],
  back: [-66, -100, 132, 100],
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
  const order: Record<string, number> = { back: 0, neck: 1, face: 2, head: 3 };
  const parts = [...wear].sort((a, b) => (order[a.data?.slot] ?? 1) - (order[b.data?.slot] ?? 1)).map(wearParts);
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
    `<path d="${BODY}" fill="${color}"/>` +
    patternSVG(look.pattern, color) +
    `<path d="${BODY}" fill="none" stroke="${INK}" stroke-width="3.5"/>` +
    `<ellipse cx="0" cy="-23" rx="24" ry="13" fill="${lt}" opacity=".85"/>` +
    `<ellipse cx="-18" cy="-6" rx="12" ry="7" fill="${dk}" stroke="${INK}" stroke-width="3"/><ellipse cx="18" cy="-6" rx="12" ry="7" fill="${dk}" stroke="${INK}" stroke-width="3"/>` +
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
  bibit: { label: 'Bungkus bibit', kinds: ['seed'], colors: { main: '#C8955A', accent: '#3FA06A' }, draw: (c) => `<path d="M18 12H46L44 46H20Z" fill="${c.main}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M18 12L22 18 26 12 30 18 34 12 38 18 42 12 46 12" fill="none" stroke="${INK}" stroke-width="2"/><path d="M32 40V28" stroke="${INK}" stroke-width="2.5"/><ellipse cx="26" cy="28" rx="6" ry="3.5" transform="rotate(-25 26 28)" fill="${c.accent}" stroke="${INK}" stroke-width="2"/><ellipse cx="38" cy="26" rx="6" ry="3.5" transform="rotate(25 38 26)" fill="${shade(c.accent, -0.15)}" stroke="${INK}" stroke-width="2"/>` },
  ikan: { label: 'Ikan', kinds: ['fish'], colors: { main: '#F2994A', accent: '#E0583F' }, draw: (c, p) => `<path d="M48 26L60 16V36Z" fill="${c.accent}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><ellipse cx="30" cy="26" rx="21" ry="12" fill="${c.main}" stroke="${INK}" stroke-width="2.5"/><path d="M28 14q6 -6 12 0" fill="${c.accent}" stroke="${INK}" stroke-width="2"/>${p.stripes ? `<path d="M26 16v20M34 15v22" stroke="${shade(c.main, -0.3)}" stroke-width="2.4"/>` : ''}${p.spots ? `<path d="M22 18q6 -2 9 4q-4 5 -10 1Z M34 26q6 -3 8 3q-3 5 -9 2Z M26 31q4 -1 5 3q-3 2 -6 0Z" fill="${c.accent}"/>` : ''}<circle cx="16" cy="23" r="3" fill="${INK}"/><circle cx="15" cy="22" r="1" fill="#fff"/>` },
  bunga: { label: 'Bunga', kinds: ['material'], colors: { main: '#FFFFFF', accent: '#F2B632' }, draw: (c) => `<path d="M32 46V30" stroke="#3E8E4E" stroke-width="3"/>` + [0, 72, 144, 216, 288].map((r) => `<ellipse cx="32" cy="14" rx="5.5" ry="9" transform="rotate(${r} 32 24)" fill="${c.main}" stroke="${INK}" stroke-width="2"/>`).join('') + `<circle cx="32" cy="24" r="4.5" fill="${c.accent}" stroke="${INK}" stroke-width="1.8"/>` },
  sandal: { label: 'Sandal jepit', kinds: ['material'], colors: { main: '#3F7FBF' }, draw: (c) => `<ellipse cx="32" cy="28" rx="13" ry="21" transform="rotate(-20 32 28)" fill="${c.main}" stroke="${INK}" stroke-width="2.5"/><path d="M28 14L24 30M28 14L38 26" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>` },
  koin: { label: 'Kantong koin', kinds: ['material'], colors: { main: '#F2B632' }, draw: (c) => `<path d="M20 22Q14 44 32 46Q50 44 44 22Z" fill="#C8955A" stroke="${INK}" stroke-width="2.5"/><path d="M24 22L28 14H36L40 22" fill="#C8955A" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="32" cy="34" r="7" fill="${c.main}" stroke="${INK}" stroke-width="2"/>` },
};

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
  // baskom mandi di depan kaki (mode mandi: gosok sabun lalu bilas)
  baskom: `<ellipse cx="0" cy="-10" rx="54" ry="13" fill="#9FD3EC" stroke="${INK}" stroke-width="3" opacity=".92"/><path d="M-54 -10Q-50 16 0 18Q50 16 54 -10Q48 4 0 6Q-48 4 -54 -10Z" fill="#9AA7B8" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-36 -6q8 4 16 0M12 -5q8 4 16 0" stroke="#FFFFFF" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
};

export const ROOM_ISO: Iso = { ox: 400, oy: 150, t: 34, h: 17 };
export const ROOM_VIEWBOX = '140 -70 520 500';

export function footprint(item?: ItemLike | null) {
  const d = item?.data ?? {};
  return { w: Math.max(1, Math.min(4, d.w | 0 || 1)), d: Math.max(1, Math.min(4, d.d | 0 || 1)), flat: !!d.flat };
}

export function occupied(layout: Placed[], items: Record<string, ItemLike>, skip = -1) {
  const set = new Set<string>();
  layout.forEach((p, i) => {
    if (i === skip) return;
    const it = items[p.i];
    if (!it) return;
    const f = footprint(it);
    if (f.flat) return;
    for (let a = 0; a < f.w; a++) for (let b = 0; b < f.d; b++) set.add(`${p.x + a},${p.y + b}`);
  });
  return set;
}

export function fits(item: ItemLike, x: number, y: number, layout: Placed[], items: Record<string, ItemLike>, size: number, skip = -1) {
  const f = footprint(item);
  if (x < 0 || y < 0 || x + f.w > size || y + f.d > size) return false;
  if (f.flat) return true;
  const o = occupied(layout, items, skip);
  for (let a = 0; a < f.w; a++) for (let b = 0; b < f.d; b++) if (o.has(`${x + a},${y + b}`)) return false;
  return true;
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

function furnDraw(g: Ctx, item: ItemLike, x: number, y: number) {
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
  } else if (wall.key === 'image' && wall.url) {
    // pola gambar upload diterapkan sebagai tekstur dinding
    const pid = 'wp' + Math.abs(hash(wall.url));
    o += `<defs><pattern id="${pid}" width="48" height="48" patternUnits="userSpaceOnUse"><image href="${esc(wall.url)}" width="48" height="48"/></pattern></defs>`;
    o += `<polygon points="${P([P0, P1, up(P1, WH), up(P0, WH)])}" fill="url(#${pid})" opacity="${L ? '.9' : '.75'}"/>`;
  }
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

/** Petak-petak lantai (bisa diketuk) + garis tepi ruangan. */
function floorSVG(g: Ctx, W: number, floor: FloorC, edit: boolean, rid?: string) {
  const s = g.s;
  const rattr = rid !== undefined ? ` data-r="${esc(rid)}"` : '';
  let o = '';
  for (let i = 0; i < W; i++)
    for (let j = 0; j < W; j++) {
      const solid = floor.key === 'teraso' || floor.key === 'karpet';
      const fill = solid ? floor.main : (i + j) % 2 ? floor.main : floor.accent;
      const attrs = `class="${edit ? 'tile' : 'fl'}"${rattr} data-x="${i}" data-y="${j}"`;
      o += `<polygon ${attrs} points="${P([g.iso(i, j), g.iso(i + 1, j), g.iso(i + 1, j + 1), g.iso(i, j + 1)])}" fill="${fill}" stroke="${shade(floor.main, floor.key === 'karpet' ? -0.06 : -0.22)}" stroke-width="1"/>`;
      if (floor.key === 'teraso')
        for (const [fx, fy, k] of [[0.25, 0.3, 0], [0.7, 0.2, 1], [0.5, 0.65, 0], [0.2, 0.8, 1], [0.8, 0.75, 0]]) {
          const q = g.iso(i + ((fx + i * 0.13) % 1), j + ((fy + j * 0.17) % 1));
          o += `<circle cx="${f1(q[0])}" cy="${f1(q[1])}" r="${f1(1.6 * s)}" fill="${k ? '#FFFFFF' : floor.accent}" pointer-events="none"/>`;
        }
      if (floor.key === 'rumput' && !edit && (i * 7 + j * 3) % 3 === 0) {
        const c = g.iso(i + 0.5, j + 0.5);
        o += `<path d="M${f1(c[0] - 5 * s)} ${f1(c[1] + 2 * s)}l${f1(2 * s)} ${f1(-7 * s)}M${f1(c[0])} ${f1(c[1] + 2 * s)}v${f1(-9 * s)}M${f1(c[0] + 5 * s)} ${f1(c[1] + 2 * s)}l${f1(-2 * s)} ${f1(-7 * s)}" stroke="#5E9E4A" stroke-width="${f1(1.6 * s)}" stroke-linecap="round" pointer-events="none"/>`;
      }
      if (floor.key === 'papan' && !edit) {
        const a = g.iso(i + 0.5, j), b = g.iso(i + 0.5, j + 1);
        o += `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${shade(floor.main, -0.12)}" stroke-width="1" pointer-events="none"/>`;
      }
    }
  o += `<polygon points="${P([g.iso(0, 0), g.iso(W, 0), g.iso(W, W), g.iso(0, W)])}" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round" pointer-events="none"/>`;
  return o;
}

function roomShadow(g: Ctx, W: number) {
  const A = g.iso(0, 0), B = g.iso(W, 0), Cc = g.iso(W, W), D = g.iso(0, W);
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
    `<g class="furn${o.edit ? ' editable' : ''}${o.edit && o.sel === e.idx ? ' sel' : ''}" data-i="${e.idx}">${furnDraw(g, e.it, e.p.x, e.p.y)}</g>`;
  list.filter((e) => footprint(e.it).flat).forEach((e) => (out += grp(e)));
  if (!o.edit) (o.crumbs ?? []).forEach((c, i) => (out += crumbSVG(g, c, i)));
  const draws = list
    .filter((e) => !footprint(e.it).flat)
    .map((e) => { const f = footprint(e.it); return { d: e.p.x + e.p.y + (f.w + f.d) / 2, h: grp(e) }; });
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
    x0 = Math.min(x0, houseIso(r.gx, r.gy + r.size)[0]);
    x1 = Math.max(x1, houseIso(r.gx + r.size, r.gy)[0]);
    y0 = Math.min(y0, top);
    y1 = Math.max(y1, houseIso(r.gx + r.size, r.gy + r.size)[1]);
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
    const g = roomG(r), W = r.size;
    shadow += roomShadow(g, W);
    const wall = wallColors(a.wall);
    let b = '';
    if (r.outdoor) {
      for (const side of ['L', 'R'] as const) for (const [p, q] of runsOf(side === 'L' ? r.L : r.R, (s) => s.k === 'tall')) b += bushRun(g, side, p, q) + fenceRails(g, side, p, q) + fencePosts(g, side, p, q);
    } else {
      const tl = runsOf(r.L, (s) => s.k === 'tall'), tr = runsOf(r.R, (s) => s.k === 'tall');
      for (const [p, q] of tl) b += wallRun(g, 'L', p, q, wall);
      for (const [p, q] of tr) b += wallRun(g, 'R', p, q, wall);
      if (r.window) b += windowSVG(g, W, wall, r.id);
      if (r.painting) b += paintingSVG(g, W, a.photo ?? '', r.id);
      b += roomDecor(g, W, decor, tl, tr, r.window);
    }
    // data-r: dinding juga bisa diketuk untuk memilih ruangan (atur denah / mode atur)
    back.push({ key: r.id, h: b ? dimWrap(a, `<g data-r="${esc(r.id)}">${b}</g>`) : '' });
    floor.push({ key: r.id, h: dimWrap(a, floorSVG(g, W, floorColors(a.floor, r.outdoor ? GRASS_FLOOR : DEFAULT_FLOOR), !!a.edit, r.id)) });
    let f = '';
    a.layout.forEach((p, idx) => {
      const it = items[p.i];
      if (!it || !footprint(it).flat) return;
      f += `<g class="${furnCls(a, idx)}" data-r="${esc(r.id)}" data-i="${idx}">${furnDraw(g, it, p.x, p.y)}</g>`;
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
      const f = footprint(it);
      if (f.flat) return;
      const x0 = r.gx + p.x, y0 = r.gy + p.y;
      out.push({ key: `f:${r.id}:${idx}`, d: x0 + y0 + (f.w + f.d) / 2, h: dim(`<g class="${furnCls(a, idx)}" data-r="${esc(r.id)}" data-i="${idx}">${furnDraw(g, it, p.x, p.y)}</g>`), b: [x0, y0, x0 + f.w, y0 + f.d] });
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
    const slot = item.data?.slot ?? (a.type === 'builtin' ? WEAR[a.key]?.slot : 'head') ?? 'head';
    const vb = { head: '-56 -124 112 64', face: '-46 -64 92 42', neck: '-46 -40 92 50', back: '-80 -112 160 116' }[slot as 'head'] ?? '-56 -124 112 64';
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
  const outdoor = theme === 'luar';
  const w = outdoor ? { main: '#BFE3F5', accent: '#A9D6EE' } : wallColors(wall);
  const f = floorColors(floor, outdoor ? GRASS_FLOOR : DEFAULT_FLOOR);
  return `<svg viewBox="0 0 160 140" aria-hidden="true"><rect x="1" y="1" width="158" height="138" rx="6" fill="#FFFDF7" stroke="${INK}" stroke-width="2"/>`
    + `<svg x="12" y="10" width="136" height="100" viewBox="0 0 136 100"><rect width="136" height="100" fill="${w.main}"/><rect y="70" width="136" height="30" fill="${f.main}"/><path d="M0 70H136" stroke="${shade(f.main, -0.25)}" stroke-width="1.5"/>`
    + (outdoor ? '' : `<path d="M0 ${'25'}H136" stroke="${shade(w.main, -0.08)}" stroke-width="3" opacity=".6"/>`)
    + photoScene(members, pose) + `</svg><rect x="12" y="10" width="136" height="100" fill="none" stroke="${INK}" stroke-width="1.5"/></svg>`;
}
