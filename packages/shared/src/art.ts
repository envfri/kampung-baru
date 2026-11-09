// Semua gambar game dibuat sebagai SVG dari kode (tanpa file gambar), sehingga ringan,
// tajam di semua layar, dan bisa diatur warnanya dari admin. Admin juga bisa memakai
// gambar upload (type: 'image') untuk item baru.
//
// Fungsi di sini mengembalikan string SVG. Dipakai oleh game dan pratinjau di admin.

export const INK = '#2B2F4A';

export type ArtSpec =
  | { type: 'builtin'; key: string; colors?: Record<string, string>; params?: Record<string, number> }
  | { type: 'image'; url: string; w?: number; h?: number };

export type ItemKind = 'food' | 'furniture' | 'wear' | 'wallpaper' | 'floor' | 'seed' | 'fish' | 'material';

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
  kotak: {
    label: 'Kotak (umum)',
    colors: { main: '#E9B23A' },
    draw(g, x, y, w, d, c, p) {
      return g.box(x + 0.08, y + 0.08, 0, w - 0.16, d - 0.16, Math.max(4, Math.min(120, p.height ?? 30)), C3(c.main));
    },
  },
};

/* ------------------------------------------------------------------ */
/* Pet (karakter orisinal "Bulu")                                      */
/* ------------------------------------------------------------------ */

export const PET_COLORS = ['#F6B7A8', '#F4D58D', '#A8D8A0', '#9FD0E8', '#C9B6E8', '#B98A64', '#F2EEE3', '#FFB86B', '#8FD3C1', '#E7A1C9'];
export const PET_EARS: [string, string][] = [['tunas', 'Tunas'], ['kucing', 'Kucing'], ['kelinci', 'Kelinci'], ['bulat', 'Bulat']];

type WearFn = (c: Record<string, string>) => string;
const WEAR: Record<string, { label: string; slot: 'head' | 'face' | 'neck'; colors: Record<string, string>; draw: WearFn }> = {
  caping: { label: 'Topi caping', slot: 'head', colors: { main: '#E3C16F' }, draw: (c) => `<path d="M-50 -64L0 -102 50 -64Q0 -55 -50 -64Z" fill="${c.main}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-27 -76Q0 -72 27 -76M-14 -88Q0 -86 14 -88" stroke="${shade(c.main, -0.3)}" stroke-width="2" fill="none"/>` },
  peci: { label: 'Peci', slot: 'head', colors: { main: '#2B2F4A' }, draw: (c) => `<path d="M-26 -70L-23 -92Q0 -97 23 -92L26 -70Q0 -75 -26 -70Z" fill="${c.main}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-24 -84Q0 -89 24 -84" stroke="${shade(c.main, 0.25)}" stroke-width="1.6" fill="none"/>` },
  mahkota: { label: 'Mahkota bunga', slot: 'head', colors: { main: '#FFFFFF', accent: '#F2B632' }, draw: (c) => [-30, -15, 0, 15, 30].map((x) => { const y = -76 - (30 - Math.abs(x)) * 0.25; return `<g transform="translate(${x} ${y})"><circle r="6.5" fill="${c.main}" stroke="${INK}" stroke-width="2"/><circle r="2.6" fill="${c.accent}"/></g>`; }).join('') },
  kupluk: { label: 'Kupluk rajut', slot: 'head', colors: { main: '#E0583F', accent: '#FFFFFF' }, draw: (c) => `<path d="M-38 -66Q-36 -104 0 -104Q36 -104 38 -66Z" fill="${c.main}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><rect x="-40" y="-72" width="80" height="10" rx="5" fill="${c.accent}" stroke="${INK}" stroke-width="2.5"/><circle cx="0" cy="-106" r="7" fill="${c.accent}" stroke="${INK}" stroke-width="2.5"/>` },
  kacamata: { label: 'Kacamata bulat', slot: 'face', colors: { main: '#2B2F4A' }, draw: (c) => `<g stroke="${c.main}" stroke-width="2.6"><circle cx="-15" cy="-46" r="10" fill="rgba(255,255,255,.28)"/><circle cx="15" cy="-46" r="10" fill="rgba(255,255,255,.28)"/><path d="M-5 -47q5 -4 10 0" fill="none"/></g>` },
  kacamatahitam: { label: 'Kacamata hitam', slot: 'face', colors: { main: '#2B2F4A' }, draw: (c) => `<g stroke="${INK}" stroke-width="2.4"><path d="M-27 -52H-4L-6 -42Q-15 -36 -24 -42Z" fill="${c.main}"/><path d="M27 -52H4L6 -42Q15 -36 24 -42Z" fill="${c.main}"/><path d="M-4 -50H4" fill="none"/></g>` },
  syal: { label: 'Syal motif', slot: 'neck', colors: { main: '#33508C', accent: '#F3E3B5' }, draw: (c) => `<path d="M-40 -30Q0 -14 40 -30L39 -21Q0 -5 -39 -21Z" fill="${c.main}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M20 -19L29 -1 19 1 14 -15Z" fill="${c.main}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><g fill="${c.accent}"><circle cx="-26" cy="-22" r="2"/><circle cx="-12" cy="-18" r="2"/><circle cx="2" cy="-17" r="2"/><circle cx="16" cy="-19" r="2"/><circle cx="30" cy="-23" r="2"/><circle cx="22" cy="-8" r="1.8"/></g>` },
  dasikupu: { label: 'Dasi kupu-kupu', slot: 'neck', colors: { main: '#E0583F' }, draw: (c) => `<path d="M0 -22L-16 -30V-14Z" fill="${c.main}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M0 -22L16 -30V-14Z" fill="${c.main}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="0" cy="-22" r="4" fill="${shade(c.main, -0.2)}" stroke="${INK}" stroke-width="2"/>` },
  kalung: { label: 'Kalung manik', slot: 'neck', colors: { main: '#F2B632' }, draw: (c) => `<path d="M-30 -27Q0 -12 30 -27" fill="none" stroke="${INK}" stroke-width="1.5"/>` + [-24, -12, 0, 12, 24].map((x) => `<circle cx="${x}" cy="${-19 - Math.abs(x) * 0.25}" r="4" fill="${c.main}" stroke="${INK}" stroke-width="1.8"/>`).join('') },
};

const WEAR_IMG_BOX: Record<string, [number, number, number, number]> = {
  head: [-48, -112, 96, 52],
  face: [-34, -60, 68, 30],
  neck: [-44, -36, 88, 40],
};

export interface PetLook {
  color: string;
  ear: string;
}

function wearSVG(item: ItemLike) {
  const a = item.art;
  if (a.type === 'image') {
    const url = safeUrl(a.url);
    if (!url) return '';
    const [x, y, w, h] = WEAR_IMG_BOX[item.data?.slot] ?? WEAR_IMG_BOX.head;
    return `<image href="${esc(url)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  const def = WEAR[a.key];
  if (!def) return '';
  const c: Record<string, string> = {};
  for (const k of Object.keys(def.colors)) c[k] = col(a.colors?.[k], def.colors[k]);
  return def.draw(c);
}

/** Pet digambar dengan titik (0,0) di bawah kaki. Lebar ±100, tinggi ±110. */
export function renderPet(look: PetLook, wear: ItemLike[] = []) {
  const color = col(look.color, '#F6B7A8');
  const dk = shade(color, -0.22), lt = shade(color, 0.5);
  let e = '';
  if (look.ear === 'kucing')
    e = `<path d="M-32 -60L-25 -94-5 -73Z" fill="${color}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-25 -70L-23 -85-12 -73Z" fill="#FF9FB2"/><path d="M32 -60L25 -94 5 -73Z" fill="${color}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M25 -70L23 -85 12 -73Z" fill="#FF9FB2"/>`;
  else if (look.ear === 'kelinci')
    e = `<ellipse cx="-15" cy="-92" rx="8.5" ry="25" transform="rotate(-12 -15 -92)" fill="${color}" stroke="${INK}" stroke-width="3"/><ellipse cx="-15" cy="-90" rx="3.6" ry="15" transform="rotate(-12 -15 -90)" fill="#FF9FB2"/><ellipse cx="15" cy="-92" rx="8.5" ry="25" transform="rotate(12 15 -92)" fill="${color}" stroke="${INK}" stroke-width="3"/><ellipse cx="15" cy="-90" rx="3.6" ry="15" transform="rotate(12 15 -90)" fill="#FF9FB2"/>`;
  else if (look.ear === 'bulat')
    e = `<circle cx="-30" cy="-68" r="13" fill="${color}" stroke="${INK}" stroke-width="3"/><circle cx="-30" cy="-68" r="6" fill="#FF9FB2"/><circle cx="30" cy="-68" r="13" fill="${color}" stroke="${INK}" stroke-width="3"/><circle cx="30" cy="-68" r="6" fill="#FF9FB2"/>`;
  else
    e = `<path d="M0 -76C0 -86 2 -92 4 -98" stroke="#3E8E4E" stroke-width="3.5" fill="none" stroke-linecap="round"/><ellipse cx="-8" cy="-100" rx="11" ry="6" transform="rotate(-25 -8 -100)" fill="#7CC57D" stroke="${INK}" stroke-width="2.5"/><ellipse cx="14" cy="-104" rx="12" ry="6.5" transform="rotate(20 14 -104)" fill="#5DB36A" stroke="${INK}" stroke-width="2.5"/>`;
  const order = { neck: 0, face: 1, head: 2 } as Record<string, number>;
  const worn = [...wear].sort((a, b) => (order[a.data?.slot] ?? 0) - (order[b.data?.slot] ?? 0)).map(wearSVG).join('');
  return (
    `<ellipse cx="0" cy="-2" rx="36" ry="7" fill="#000" opacity=".13"/>` +
    `<circle cx="40" cy="-22" r="9" fill="${lt}" stroke="${INK}" stroke-width="3"/>` +
    e +
    `<path d="M0 -78C30 -78 46 -56 46 -34C46 -14 28 -6 0 -6C-28 -6 -46 -14 -46 -34C-46 -56 -30 -78 0 -78Z" fill="${color}" stroke="${INK}" stroke-width="3.5"/>` +
    `<ellipse cx="0" cy="-23" rx="24" ry="13" fill="${lt}" opacity=".85"/>` +
    `<ellipse cx="-18" cy="-6" rx="12" ry="7" fill="${dk}" stroke="${INK}" stroke-width="3"/><ellipse cx="18" cy="-6" rx="12" ry="7" fill="${dk}" stroke="${INK}" stroke-width="3"/>` +
    `<g class="eyes"><circle cx="-15" cy="-46" r="6" fill="${INK}"/><circle cx="15" cy="-46" r="6" fill="${INK}"/><circle cx="-13" cy="-48" r="2" fill="#fff"/><circle cx="17" cy="-48" r="2" fill="#fff"/></g>` +
    `<ellipse cx="-28" cy="-35" rx="7" ry="4" fill="#FF8FA3" opacity=".7"/><ellipse cx="28" cy="-35" rx="7" ry="4" fill="#FF8FA3" opacity=".7"/>` +
    `<path d="M-7 -37q3.5 4 7 0q3.5 4 7 0" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>` +
    worn
  );
}

export const PET_VIEWBOX = '-58 -116 116 122';
export function petSVG(look: PetLook, wear: ItemLike[] = [], cls = '') {
  return `<svg viewBox="${PET_VIEWBOX}" class="${cls}" aria-hidden="true">${renderPet(look, wear)}</svg>`;
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
  bibit: { label: 'Bungkus bibit', kinds: ['seed'], colors: { main: '#C8955A', accent: '#3FA06A' }, draw: (c) => `<path d="M18 12H46L44 46H20Z" fill="${c.main}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M18 12L22 18 26 12 30 18 34 12 38 18 42 12 46 12" fill="none" stroke="${INK}" stroke-width="2"/><path d="M32 40V28" stroke="${INK}" stroke-width="2.5"/><ellipse cx="26" cy="28" rx="6" ry="3.5" transform="rotate(-25 26 28)" fill="${c.accent}" stroke="${INK}" stroke-width="2"/><ellipse cx="38" cy="26" rx="6" ry="3.5" transform="rotate(25 38 26)" fill="${shade(c.accent, -0.15)}" stroke="${INK}" stroke-width="2"/>` },
  ikan: { label: 'Ikan', kinds: ['fish'], colors: { main: '#F2994A', accent: '#E0583F' }, draw: (c, p) => `<path d="M48 26L60 16V36Z" fill="${c.accent}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><ellipse cx="30" cy="26" rx="21" ry="12" fill="${c.main}" stroke="${INK}" stroke-width="2.5"/><path d="M28 14q6 -6 12 0" fill="${c.accent}" stroke="${INK}" stroke-width="2"/>${p.stripes ? `<path d="M26 16v20M34 15v22" stroke="${shade(c.main, -0.3)}" stroke-width="2.4"/>` : ''}<circle cx="16" cy="23" r="3" fill="${INK}"/><circle cx="15" cy="22" r="1" fill="#fff"/>` },
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
};
const FLOORS: Record<string, { label: string; colors: Record<string, string> }> = {
  papan: { label: 'Papan kayu', colors: { main: '#C48A55', accent: '#B47B48' } },
  tegel: { label: 'Tegel catur', colors: { main: '#E9E4D6', accent: '#C9C2B0' } },
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

export interface RoomOpts {
  layout: Placed[];
  items: Record<string, ItemLike>;
  wall?: ItemLike | null;
  floor?: ItemLike | null;
  size?: number;
  pet?: { look: PetLook; wear: ItemLike[]; pos?: [number, number] } | null;
  edit?: boolean;
  sel?: number;
}

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
function floorColors(item?: ItemLike | null) {
  const a = item?.art ?? DEFAULT_FLOOR;
  if (a.type === 'image') return { key: 'papan', main: '#C48A55', accent: '#B47B48' };
  const def = FLOORS[a.key] ?? FLOORS.papan;
  return { key: a.key in FLOORS ? a.key : 'papan', main: col(a.colors?.main, def.colors.main), accent: col(a.colors?.accent, def.colors.accent) };
}

function roomShell(g: Ctx, W: number, wall: ReturnType<typeof wallColors>, floor: ReturnType<typeof floorColors>, edit: boolean) {
  const WH = 150, s = g.s;
  const A = g.iso(0, 0), B = g.iso(W, 0), Cc = g.iso(W, W), D = g.iso(0, W);
  const up = (p: number[], v: number) => [p[0], p[1] - v];
  const wallR = shade(wall.main, 0.35);
  let o = `<polygon points="${P([[A[0], A[1] + 10], [B[0] + 12, B[1] + 8], [Cc[0], Cc[1] + 16], [D[0] - 12, D[1] + 8]])}" fill="${INK}" opacity=".12"/>`;
  o += g.poly([A, D, up(D, WH), up(A, WH)], wall.main);
  o += g.poly([A, B, up(B, WH), up(A, WH)], wallR);
  if (wall.key === 'garis') {
    for (let yy = 0.5; yy < W; yy += 0.5) {
      const p = g.iso(0, yy);
      o += `<line x1="${f1(p[0])}" y1="${f1(p[1] - 30)}" x2="${f1(p[0])}" y2="${f1(p[1] - WH + 6)}" stroke="${wall.accent}" stroke-width="2.5"/>`;
    }
    for (let xx = 0.5; xx < W; xx += 0.5) {
      const p = g.iso(xx, 0);
      o += `<line x1="${f1(p[0])}" y1="${f1(p[1] - 30)}" x2="${f1(p[0])}" y2="${f1(p[1] - WH + 6)}" stroke="${shade(wall.accent, 0.35)}" stroke-width="2.5"/>`;
    }
  } else if (wall.key === 'titik') {
    for (let yy = 0.35; yy < W; yy += 0.55)
      for (let v = 40; v < WH - 8; v += 22) {
        const p = g.iso(0, yy + ((v / 22) % 2) * 0.27);
        if (yy + ((v / 22) % 2) * 0.27 < W - 0.1) o += `<circle cx="${f1(p[0])}" cy="${f1(p[1] - v)}" r="3" fill="${wall.accent}"/>`;
        const q = g.iso(yy + ((v / 22) % 2) * 0.27, 0);
        if (yy + ((v / 22) % 2) * 0.27 < W - 0.1) o += `<circle cx="${f1(q[0])}" cy="${f1(q[1] - v)}" r="3" fill="${shade(wall.accent, 0.3)}"/>`;
      }
  } else if (wall.key === 'image' && wall.url) {
    // pola gambar upload diterapkan sebagai tekstur di dua dinding
    const pid = 'wp' + Math.abs(hash(wall.url));
    o += `<defs><pattern id="${pid}" width="48" height="48" patternUnits="userSpaceOnUse"><image href="${esc(wall.url)}" width="48" height="48"/></pattern></defs>`;
    o += `<polygon points="${P([A, D, up(D, WH), up(A, WH)])}" fill="url(#${pid})" opacity=".9"/>`;
    o += `<polygon points="${P([A, B, up(B, WH), up(A, WH)])}" fill="url(#${pid})" opacity=".75"/>`;
  }
  o += g.quadX(0, 0, W, 0, 26, shade(wall.main, -0.14));
  o += g.quadY(0, 0, W, 0, 26, shade(wallR, -0.14));
  // jendela di dinding kanan
  const trim = shade(wall.main, -0.45);
  const wx0 = W / 2 - 1.1, wx1 = W / 2 + 1.1;
  o += g.quadY(0, wx0 - 0.1, wx1 + 0.1, 50, 56, trim);
  o += g.quadY(0, wx0, wx1, 56, 122, '#BFE3F5');
  const wm = g.iso(W / 2, 0), wl = g.iso(wx0, 0), wr = g.iso(wx1, 0);
  o += `<ellipse cx="${f1(wm[0] + 14)}" cy="${f1(wm[1] - 104 * s)}" rx="15" ry="5.5" fill="#FFFFFF"/><ellipse cx="${f1(wl[0] + 30)}" cy="${f1(wl[1] - 84 * s)}" rx="11" ry="4" fill="#FFFFFF"/>`;
  o += `<path d="M${f1(wm[0])} ${f1(wm[1] - 56 * s)}V${f1(wm[1] - 122 * s)}M${f1(wl[0])} ${f1(wl[1] - 89 * s)}L${f1(wr[0])} ${f1(wr[1] - 89 * s)}" stroke="${trim}" stroke-width="4"/>`;
  // lukisan di dinding kiri
  const py0 = W / 2 + 0.35, py1 = W / 2 + 1.65;
  o += g.quadX(0, py0, py1, 62, 110, '#FFFDF7');
  o += g.quadX(0, py0 + 0.13, py1 - 0.13, 68, 104, '#9FD3C2');
  const Q = (yy: number, v: number) => { const p = g.iso(0, yy); return [p[0], p[1] - v * s]; };
  o += `<polygon points="${P([Q(py0 + 0.2, 70), Q(py0 + 0.6, 94), Q(py0 + 1.0, 70)])}" fill="#3FA06A"/><polygon points="${P([Q(py0 + 0.5, 70), Q(py0 + 0.85, 86), Q(py0 + 1.13, 70)])}" fill="#2F7F55"/>`;
  const sun = Q(py0 + 0.35, 97);
  o += `<circle cx="${f1(sun[0])}" cy="${f1(sun[1])}" r="4" fill="#F2B632"/>`;
  // lantai
  for (let i = 0; i < W; i++)
    for (let j = 0; j < W; j++) {
      const fill = floor.key === 'tegel' ? ((i + j) % 2 ? floor.main : floor.accent) : (i + j) % 2 ? floor.main : floor.accent;
      const attrs = edit ? `class="tile" data-x="${i}" data-y="${j}"` : '';
      o += `<polygon ${attrs} points="${P([g.iso(i, j), g.iso(i + 1, j), g.iso(i + 1, j + 1), g.iso(i, j + 1)])}" fill="${fill}" stroke="${shade(floor.main, -0.22)}" stroke-width="1"/>`;
      if (floor.key === 'papan' && !edit) {
        const a = g.iso(i + 0.5, j), b = g.iso(i + 0.5, j + 1);
        o += `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${shade(floor.main, -0.12)}" stroke-width="1" pointer-events="none"/>`;
      }
    }
  o += `<polygon points="${P([A, B, Cc, D])}" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round" pointer-events="none"/>`;
  return o;
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

export function renderRoom(o: RoomOpts) {
  const W = o.size ?? 6;
  const t = Math.round((34 * 6) / W);
  const g = G({ ox: 400, oy: 150, t, h: t / 2 });
  let out = roomShell(g, W, wallColors(o.wall), floorColors(o.floor), !!o.edit);
  const list = o.layout.map((p, idx) => ({ p, idx, it: o.items[p.i] })).filter((e) => e.it);
  const grp = (e: (typeof list)[number]) =>
    `<g class="furn${o.edit ? ' editable' : ''}${o.edit && o.sel === e.idx ? ' sel' : ''}" data-i="${e.idx}">${furnDraw(g, e.it, e.p.x, e.p.y)}</g>`;
  list.filter((e) => footprint(e.it).flat).forEach((e) => (out += grp(e)));
  const draws = list
    .filter((e) => !footprint(e.it).flat)
    .map((e) => { const f = footprint(e.it); return { d: e.p.x + e.p.y + (f.w + f.d) / 2, h: grp(e) }; });
  if (o.pet) {
    const pos = o.pet.pos ?? petSpot(o.layout, o.items, W);
    const c = g.iso(pos[0], pos[1]);
    draws.push({ d: pos[0] + pos[1] + 0.01, h: `<g class="pet" transform="translate(${f1(c[0])} ${f1(c[1])}) scale(${f1((0.82 * t) / 34 * 100) / 100})"><g class="pet-hop"><g class="pet-bob">${renderPet(o.pet.look, o.pet.wear)}</g></g></g>` });
  }
  draws.sort((a, b) => a.d - b.d).forEach((d) => (out += d.h));
  return out;
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
    const vb = { head: '-54 -112 108 58', face: '-32 -62 64 32', neck: '-46 -38 92 44' }[slot as 'head'];
    return `<svg viewBox="${vb}" aria-hidden="true">${wearSVG(item)}</svg>`;
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
  return building(l);
}

export const MAP_VIEWBOX = '0 -40 800 520';

export function renderMap(locations: LocationLike[]) {
  let o = `<rect x="-200" y="-200" width="1200" height="900" fill="#A9D18A"/>`;
  for (let i = 0; i < 70; i++) o += `<circle cx="${(i * 137) % 800}" cy="${(i * 89) % 440}" r="3" fill="#97C478"/>`;
  [[40, 70], [200, 58], [380, 62], [560, 56], [760, 72], [20, 140], [780, 150]].forEach(([x, y]) => {
    o += `<circle cx="${x}" cy="${y + 16}" r="5" fill="#7A5232"/><circle cx="${x}" cy="${y}" r="20" fill="#5DA05A" stroke="${INK}" stroke-width="2.5"/><circle cx="${x - 6}" cy="${y - 6}" r="7" fill="#7CC57D"/>`;
  });
  o += `<path d="M-20 240H820M420 240V470" stroke="${INK}" stroke-width="38" fill="none"/><path d="M-20 240H820M420 240V470" stroke="#E9D9AE" stroke-width="32" fill="none"/><path d="M-20 240H820M420 240V470" stroke="#C9B582" stroke-width="2" stroke-dasharray="12 12" fill="none"/>`;
  for (const l of locations) {
    if (!l.enabled) continue;
    o += `<g class="loc" data-loc="${esc(l.id)}" tabindex="0" role="button" aria-label="${esc(l.name)}">${special(l)}</g>`;
  }
  return o;
}
