// Kebun: gambar tanaman per jenis (tunas → tumbuh → siap), ikon hasil panen, bungkus bibit
// bergambar, dan benda-benda kebun (pagar bambu, orang-orangan sawah, gentong, gubuk, papan nama).
// Gaya sama dengan art.ts: string SVG, garis INK, isi datar, shade(), garis 1,5–2,5 sudut bulat.
// Tanpa id/defs/clipPath supaya aman dipakai berkali-kali dalam satu SVG.
//
// Berkas ini tidak mengimpor art.ts (art.ts yang mengimpor berkas ini) supaya tidak melingkar.

const INK = '#2B2F4A';

function shade(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return (
    '#' +
    [(n >> 16) & 255, (n >> 8) & 255, n & 255]
      .map((v) => Math.max(0, Math.min(255, Math.round(a < 0 ? v * (1 + a) : v + (255 - v) * a))).toString(16).padStart(2, '0'))
      .join('')
  );
}

/* ------------------------------------------------------------------ */
/* 1. Pembantu                                                          */
/* ------------------------------------------------------------------ */

const f1 = (v: number) => Math.round(v * 10) / 10;
const rad = (d: number) => (d * Math.PI) / 180;

const STEM = '#3E8E4E';
const LA = '#7CC57D'; // daun muda
const LB = '#5DB36A';
const LC = '#56B36F'; // warna daun di Garden.svelte sekarang
const LD = '#3F9A58'; // daun tua

/** elips yang diputar di titik tengahnya */
const el = (cx: number, cy: number, rx: number, ry: number, fill: string, rot = 0, sw = 2) =>
  `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(rx)}" ry="${f1(ry)}"${rot ? ` transform="rotate(${f1(rot)} ${f1(cx)} ${f1(cy)})"` : ''} fill="${fill}"${sw ? ` stroke="${INK}" stroke-width="${sw}"` : ''}/>`;
const ci = (cx: number, cy: number, r: number, fill: string, sw = 2) =>
  `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r)}" fill="${fill}"${sw ? ` stroke="${INK}" stroke-width="${sw}"` : ''}/>`;
/** garis terbuka (batang, urat daun) */
const ln = (d: string, c: string, w: number, extra = '') =>
  `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
/** garis bertepi tinta (tinta tebal di bawah, warna di atas): batang di ikon */
const lnO = (d: string, c: string, w: number) => ln(d, INK, w + 2.4) + ln(d, c, w);
/** daun runcing dari (x,y) sepanjang len, lebar ≈ wid; rot dalam derajat (+ = condong kanan) */
const pl = (x: number, y: number, len: number, wid: number, rot: number, fill: string, sw = 1.8) =>
  `<path d="M0 0Q${f1(wid)} ${f1(-len * 0.5)} 0 ${f1(-len)}Q${f1(-wid)} ${f1(-len * 0.5)} 0 0Z" transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(rot)})" fill="${fill}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>`;
/** bunga lima kelopak */
const fl5 = (x: number, y: number, r: number, petal: string, mid: string, rot = 0, sw = 1.4) =>
  [0, 72, 144, 216, 288].map((a) => `<ellipse cx="${f1(x)}" cy="${f1(y - r * 0.55)}" rx="${f1(r * 0.42)}" ry="${f1(r * 0.6)}" transform="rotate(${a + rot} ${f1(x)} ${f1(y)})" fill="${petal}" stroke="${INK}" stroke-width="${sw}"/>`).join('') +
  ci(x, y, r * 0.3, mid, sw * 0.8);
const hl = (x: number, y: number, rx: number, ry: number, rot = 0) => `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${rx}" ry="${ry}"${rot ? ` transform="rotate(${rot} ${f1(x)} ${f1(y)})"` : ''} fill="#FFFFFF" opacity=".55"/>`;
/** kilau empat sudut */
export const kebunSparkle = (x: number, y: number, r = 6, fill = '#FFF6C9') =>
  `<path d="M${f1(x)} ${f1(y - r)}Q${f1(x)} ${f1(y)} ${f1(x + r)} ${f1(y)}Q${f1(x)} ${f1(y)} ${f1(x)} ${f1(y + r)}Q${f1(x)} ${f1(y)} ${f1(x - r)} ${f1(y)}Q${f1(x)} ${f1(y)} ${f1(x)} ${f1(y - r)}Z" fill="${fill}" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>`;
const g = (tf: string, body: string) => `<g transform="${tf}">${body}</g>`;
const pts = (n: number, from: number, to: number) => Array.from({ length: n }, (_, i) => (n === 1 ? from : from + ((to - from) * i) / (n - 1)));

/* bagian kecil yang dipakai ulang */
const classicLeaves = (h: number) =>
  ln(`M0 0V${-h}`, STEM, 5) + [[-14, -h * 0.45, -30], [14, -h * 0.6, 30], [-12, -h * 0.85, -20], [12, -h, 25]].map(([dx, dy, r], i) => el(dx, dy, 11, 6, i % 2 ? LB : LC, r)).join('');
const tomato = (x: number, y: number, c = '#E0583F') => ci(x, y, 6.5, c) + ln(`M${x - 3} ${y - 5.2}l3 1.8 3-1.8`, LD, 2) + hl(x - 2.3, y - 2, 1.9, 1.2, -30);
const berry = (x: number, y: number, s = 1) =>
  `<path d="M${x} ${y - 6 * s}C${x + 6.5 * s} ${y - 6 * s} ${x + 7 * s} ${y + 2 * s} ${x} ${y + 9 * s}C${x - 7 * s} ${y + 2 * s} ${x - 6.5 * s} ${y - 6 * s} ${x} ${y - 6 * s}Z" fill="#E0583F" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>` +
  `<path d="M${x - 4 * s} ${y - 6 * s}l2 -2.5 2 2 2 -2 2 2.5" fill="${LB}" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>` +
  `<g fill="#FCE3A3"><circle cx="${x - 2 * s}" cy="${y - 1 * s}" r="0.9"/><circle cx="${x + 2.5 * s}" cy="${y}" r="0.9"/><circle cx="${x}" cy="${y + 4 * s}" r="0.9"/></g>`;
const trifol = (x: number, y: number, s: number, fill: string) =>
  [-40, 0, 40].map((a) => `<ellipse cx="${f1(x)}" cy="${f1(y - 6 * s)}" rx="${f1(4.6 * s)}" ry="${f1(6.4 * s)}" transform="rotate(${a} ${f1(x)} ${f1(y)})" fill="${a ? fill : shade(fill, -0.08)}" stroke="${INK}" stroke-width="1.7"/>`).join('');
const chili = (x: number, y: number, rot: number, c: string, s = 1.05) =>
  g(`translate(${f1(x)} ${f1(y)}) rotate(${rot}) scale(${s})`, `<path d="M0 0C3.5 1 4.5 9 1.5 17C1 19 -1 19.5 -1 17C0 10 -3 3 0 0Z" fill="${c}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>` + el(0, 0.6, 2.6, 1.8, LD, 0, 1.3));
const eggplant = (x: number, y: number, rot: number) =>
  g(`translate(${f1(x)} ${f1(y)}) rotate(${rot})`,
    ln('M0 -1v-5', LD, 2.2) +
    `<path d="M0 -1C5 -1 7 7 6.5 13C6 20 -6 20 -6.5 13C-7 7 -5 -1 0 -1Z" fill="#7A4FA0" stroke="${INK}" stroke-width="1.8"/>` +
    `<path d="M-5.5 2L-2.5 -2.5 0 0.5 2.5 -2.5 5.5 2 2 4.5H-2Z" fill="${LB}" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>` +
    ln('M-3 7q-1 4 0 8', '#FFFFFF', 1.8, ' opacity=".5"'));
const sunHead = (x: number, y: number, s = 1) =>
  Array.from({ length: 12 }, (_, i) => `<ellipse cx="${f1(x)}" cy="${f1(y - 11 * s)}" rx="${f1(3.8 * s)}" ry="${f1(7.4 * s)}" transform="rotate(${i * 30} ${f1(x)} ${f1(y)})" fill="${i % 2 ? '#F2C230' : '#F7D350'}" stroke="${INK}" stroke-width="1.5"/>`).join('') +
  ci(x, y, 9 * s, '#7A4A2A', 1.8) +
  `<g fill="#4B2E1A">${[[-3, -3], [2, -4], [4, 1], [-1, 1], [-4, 3], [1, 5]].map(([dx, dy]) => `<circle cx="${f1(x + dx * s)}" cy="${f1(y + dy * s)}" r="${f1(1.1 * s)}"/>`).join('')}</g>`;
const palm = (x: number, y: number, s: number, base: number) =>
  [-66, -33, 0, 33, 66].map((a, i) => pl(x, y, (i === 2 ? 15 : 12.5) * s, 6 * s, base + a, i % 2 ? LB : LC, 1.5)).join('') + ci(x, y, 1.6, '#A8553A', 0);
const roundLeaf = (x: number, y: number, s: number, fill: string, rot = 0) =>
  el(x, y, 11 * s, 8.5 * s, fill, rot) + ln(`M${f1(x)} ${f1(y + 6 * s)}V${f1(y - 5 * s)}M${f1(x)} ${f1(y + 2 * s)}l${f1(-5 * s)} ${f1(-4 * s)}M${f1(x)} ${f1(y + 2 * s)}l${f1(5 * s)} ${f1(-4 * s)}`, shade(fill, -0.28), 1.3);
const lobed = (x: number, y: number, s: number, fill: string, rot = 0) =>
  g(`translate(${f1(x)} ${f1(y)}) rotate(${rot}) scale(${s})`, el(-5, 1, 5, 6.5, fill, -30, 1.8) + el(5, 1, 5, 6.5, fill, 30, 1.8) + el(0, -3, 5.5, 8, shade(fill, 0.06), 0, 1.8) + ln('M0 6V-6M0 2l-5 -2M0 2l5 -2', shade(fill, -0.3), 1.1));
const vine = (w = 34) => ln(`M${-w} -2C${-w * 0.7} -8 ${-w * 0.35} 2 0 -4S${w * 0.65} -10 ${w} -2`, STEM, 3);
const tendril = (x: number, y: number) => ln(`M${x} ${y}q5 -3 2 -7q-4 -1 -2 -5`, STEM, 1.6);
const pumpkin = (x: number, y: number, s = 1) =>
  `<path d="M${f1(x - 1.5)} ${f1(y - 12 * s)}l1 -6h3.4l-1 6Z" fill="#7A5232" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>` +
  el(x, y, 18 * s, 12.5 * s, '#F2994A', 0, 2.2) +
  ln(`M${x} ${y - 12 * s}Q${x - 6 * s} ${y} ${x} ${y + 12 * s}M${x} ${y - 12 * s}Q${x + 6 * s} ${y} ${x} ${y + 12 * s}M${x - 7 * s} ${y - 11 * s}Q${x - 17 * s} ${y} ${x - 7 * s} ${y + 11 * s}M${x + 7 * s} ${y - 11 * s}Q${x + 17 * s} ${y} ${x + 7 * s} ${y + 11 * s}`, '#C9702F', 1.5) +
  hl(x - 10 * s, y - 5 * s, 2.6, 1.6, -30);
const rose = (x: number, y: number, r: number, c = '#E5506A') =>
  ci(x, y, r, c, 1.8) +
  `<path d="M${f1(x - r * 0.85)} ${f1(y + r * 0.1)}Q${f1(x - r * 0.6)} ${f1(y + r * 0.95)} ${f1(x)} ${f1(y + r * 0.95)}Q${f1(x + r * 0.6)} ${f1(y + r * 0.95)} ${f1(x + r * 0.85)} ${f1(y + r * 0.1)}" fill="${shade(c, -0.12)}" stroke="${INK}" stroke-width="1.5"/>` +
  ln(`M${f1(x - r * 0.45)} ${f1(y - r * 0.05)}a${f1(r * 0.45)} ${f1(r * 0.42)} 0 1 1 ${f1(r * 0.55)} ${f1(r * 0.4)}M${f1(x - r * 0.05)} ${f1(y - r * 0.1)}a${f1(r * 0.2)} ${f1(r * 0.2)} 0 1 1 ${f1(r * 0.25)} ${f1(r * 0.12)}`, shade(c, -0.35), 1.4);
const melon = (x: number, y: number) =>
  el(x, y, 19, 12.5, '#4FA85F', 0, 2.2) +
  [-6, 0, 6].map((dy) => ln(`M${x - 16 + Math.abs(dy) * 0.6} ${y + dy}${Array.from({ length: 6 }, (_, i) => `l${f1((32 - Math.abs(dy) * 1.2) / 6)} ${i % 2 ? 2 : -2}`).join('')}`, '#2B6E40', 2.6)).join('') +
  hl(x - 9, y - 7, 3.2, 1.6, -15);
const orchid = (x: number, y: number, s = 1, petal = '#FFFFFF', lip = '#C2408A') =>
  g(`translate(${f1(x)} ${f1(y)}) scale(${s})`,
    el(0, -6, 3, 5.2, petal, 0, 1.4) + el(-4.6, 4.6, 2.6, 4.8, shade(petal, -0.04), 38, 1.4) + el(4.6, 4.6, 2.6, 4.8, shade(petal, -0.04), -38, 1.4) +
    el(-5.6, -0.4, 5, 4.6, petal, -10, 1.4) + el(5.6, -0.4, 5, 4.6, petal, 10, 1.4) +
    el(0, 3, 2.7, 2.4, lip, 0, 1.2) + ci(0, 0.3, 1.5, '#F2C94C', 0.9));
const hibiscus = (x: number, y: number, c: string, s = 1) =>
  [0, 72, 144, 216, 288].map((a) => `<ellipse cx="${f1(x)}" cy="${f1(y - 5.6 * s)}" rx="${f1(4.9 * s)}" ry="${f1(6.4 * s)}" transform="rotate(${a + 18} ${f1(x)} ${f1(y)})" fill="${c}" stroke="${INK}" stroke-width="1.5"/>`).join('') +
  ci(x, y, 2.2 * s, c === '#FFFFFF' ? '#E0583F' : '#9E2F22', 1) + ln(`M${x} ${y}l${f1(4 * s)} ${f1(-6.5 * s)}`, '#F7E3A0', 1.6) + ci(x + 4 * s, y - 6.8 * s, 1.5 * s, '#F2C94C', 1);
const fruitLong = (x: number, y: number, rot: number, rx = 13, ry = 6) =>
  g(`rotate(${rot} ${f1(x)} ${f1(y)})`, el(x, y, rx, ry, '#F2D16B', 0, 2) + ln(`M${x - rx * 0.75} ${y - 2}Q${x} ${y - 4.5} ${x + rx * 0.75} ${y - 2}M${x - rx * 0.75} ${y + 2.2}Q${x} ${y + 4.5} ${x + rx * 0.75} ${y + 2.2}`, '#A9B85A', 1.6) + hl(x - rx * 0.4, y - 2.8, 3, 1.2));
/** titik pada kurva kuadrat */
const qp = (p0: number[], c: number[], p1: number[], t: number) => [(1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1]];
const panicle = (p0: number[], c: number[], p1: number[], grain = '#E9C46A', stalk = '#C9A13B', gs = 1) => {
  let o = ln(`M${p0[0]} ${p0[1]}Q${c[0]} ${c[1]} ${p1[0]} ${p1[1]}`, stalk, 1.7 * gs);
  pts(8, 0.42, 1).forEach((t, i) => {
    const [x, y] = qp(p0, c, p1, t);
    const [x2, y2] = qp(p0, c, p1, Math.min(1, t + 0.02));
    const tx = x2 - x, ty = y2 - y, n = Math.hypot(tx, ty) || 1;
    const side = i % 2 ? 1 : -1, off = t === 1 ? 0 : 1.9 * gs;
    const gx = x + (-ty / n) * off * side, gy = y + (tx / n) * off * side;
    const ang = (Math.atan2(ty, tx) * 180) / Math.PI + 90 + side * 28;
    o += `<ellipse cx="${f1(gx)}" cy="${f1(gy)}" rx="${f1(1.9 * gs)}" ry="${f1(3.2 * gs)}" transform="rotate(${f1(ang)} ${f1(gx)} ${f1(gy)})" fill="${grain}" stroke="${INK}" stroke-width="1"/>`;
  });
  return o;
};
/** daun wortel: batang tipis + daun berbulu (daun runcing bertepi gerigi) */
const frond = (x0: number, y0: number, aDeg: number, len: number, fills = [LA, LB]) => {
  const a = rad(aDeg), dx = Math.sin(a), dy = -Math.cos(a);
  const sx = x0 + dx * len * 0.42, sy = y0 + dy * len * 0.42;
  return ln(`M${f1(x0)} ${f1(y0)}L${f1(sx)} ${f1(sy)}`, STEM, 2.2) +
    `<path d="M0 0Q5 -3 4.5 -6Q7 -9 4.5 -12Q6 -15 0 ${f1(-len * 0.62)}Q-6 -15 -4.5 -12Q-7 -9 -4.5 -6Q-5 -3 0 0Z" transform="translate(${f1(sx)} ${f1(sy)}) rotate(${aDeg})" fill="${aDeg % 2 ? fills[1] : fills[0]}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>` +
    ln(`M${f1(sx)} ${f1(sy)}l${f1(dx * len * 0.45)} ${f1(dy * len * 0.45)}`, shade(fills[1], -0.25), 1.1);
};
const fan = (n: number, spread: number, lenF: (a: number) => number, wid: number, fills: string[], sw = 1.6) =>
  pts(n, -spread, spread).map((a, i) => pl(0, 0, lenF(a), wid, a, fills[i % fills.length], sw)).join('');

/* ------------------------------------------------------------------ */
/* 2. Tanaman (KEBUN_CROPS)                                             */
/* ------------------------------------------------------------------ */
// Koordinat lokal: titik 0 = tengah garis tanah; ke atas = y negatif.
// Tanaman tetap di x ∈ [-38, 38] dan y ∈ [-64, 8] supaya muat di petak selebar 92.

type Sprout = 'dua' | 'bulat' | 'rumput' | 'duri' | 'daun';
const SPROUTS: Record<Sprout, () => string> = {
  // tunas dua daun (seperti kebun lama)
  dua: () => ln('M0 0v-12', STEM, 4) + el(-7, -14, 7, 4, LA) + el(7, -15, 7, 4, LB),
  // labu, semangka, timun: daun lembaga bulat
  bulat: () => ln('M0 0v-9', STEM, 4) + el(-7, -12, 6.8, 5.4, LA, -18) + el(7, -12, 6.8, 5.4, LB, 18),
  // padi, jagung: daun pita
  rumput: () => pl(-1, 0, 15, 5, -22, LA, 1.6) + pl(0, 0, 20, 5, 0, LB, 1.6) + pl(1, 0, 14, 5, 24, LA, 1.6),
  // nanas: berduri
  duri: () => fan(5, 50, (a) => 16 - Math.abs(a) * 0.08, 5, ['#6FAF7E', '#5E9E6E'], 1.5),
  // kangkung: daun panah di batang tipis
  daun: () => ln('M0 0q-3 -6 -6 -10M0 0v-13M0 0q3 -6 6 -10', '#8CC56E', 2.2) + pl(-6, -10, 9, 6, -40, LA, 1.5) + pl(0, -13, 10, 6, 0, LB, 1.5) + pl(6, -10, 9, 6, 40, LA, 1.5),
};

export interface CropDef {
  label: string;
  sprout: Sprout;
  grow: () => string;
  ready: () => string;
}

const kangkung = (n: number, L: number, spread: number) =>
  pts(n, -spread, spread).map((a, i) => {
    const len = L * (1 - Math.abs(a) / 220), r = rad(a);
    const tx = Math.sin(r) * len, ty = -Math.cos(r) * len;
    return ln(`M0 0Q${f1(tx * 0.25)} ${f1(ty * 0.6)} ${f1(tx)} ${f1(ty)}`, '#8CC56E', 2.4) + pl(tx, ty, 15, 9.5, a, i % 2 ? '#6CC070' : '#5DB36A', 1.6);
  }).join('');
const melatiLeaves = () =>
  ln('M0 0V-14M0 -6L-10 -16M0 -8L10 -18', STEM, 3) +
  [[-15, -8, -35], [15, -9, 35], [-18, -20, -50], [18, -22, 50], [-9, -17, -20], [9, -19, 20], [-6, -29, -15], [7, -30, 15], [0, -24, 0]].map(([x, y, r], i) => el(x, y, 8, 5, i % 2 ? LC : LD, r, 1.8)).join('');
const cabaiBush = () =>
  ln('M0 0V-22M0 -12L-12 -26M0 -18L12 -32M0 -22L-2 -38', STEM, 3.4) +
  [[-9, -16, -55], [9, -20, 50], [-15, -28, -40], [15, -34, 40], [-4, -40, -10], [5, -42, 20]].map(([x, y, r], i) => el(x, y, 8, 4.5, i % 2 ? LC : LD, r, 1.8)).join('');
const terongBush = () =>
  ln('M0 0V-32M0 -14L-10 -20M0 -20L10 -26', '#5E7A55', 3.6) +
  [[-15, -18, 13, 7.5, -28], [15, -25, 13, 7.5, 28], [-7, -34, 11, 6.5, -12], [10, -10, 10, 6, 22]].map(([x, y, rx, ry, r], i) =>
    el(x, y, rx, ry, [LC, LB, LA, LD][i], r) + g(`rotate(${r} ${x} ${y})`, ln(`M${x - rx * 0.7} ${y}H${x + rx * 0.7}`, shade([LC, LB, LA, LD][i], -0.28), 1.2))).join('');
const mawarBush = () =>
  ln('M0 0V-36M0 -10L-13 -28M0 -16L13 -32', '#3E7A4A', 3) + ln('M0 -24l-3 -2M0 -6l3 -2M-6 -18l-3 1M6 -22l3 1', '#3E7A4A', 1.6) +
  [[-8, -14, -40], [9, -18, 40], [-4, -28, -20], [5, -26, 25], [-15, -22, -55], [15, -26, 55]].map(([x, y, r], i) => el(x, y, 6.2, 3.8, i % 2 ? LC : LD, r, 1.6)).join('');
const krpBush = () =>
  ln('M0 0V-20M0 -8L-12 -20M0 -12L12 -24', STEM, 3) +
  [[-10, -10, -50], [7, -14, 35], [-16, -22, -35], [16, -27, 35], [-6, -30, -10], [3, -38, 8]].map(([x, y, r], i) => el(x, y, 8.5, 5, i % 2 ? LC : LD, r, 1.8)).join('');

export const KEBUN_CROPS: Record<string, CropDef> = {
  /* --- 4 tanaman lama (digambar ulang per jenis) --- */
  tomat: {
    label: 'Tomat', sprout: 'dua',
    grow: () => classicLeaves(40) + fl5(-7, -27, 4, '#F2C94C', '#E8A33A') + fl5(9, -35, 4, '#F2C94C', '#E8A33A'),
    ready: () => classicLeaves(42) + tomato(-11, -20) + tomato(11, -28) + tomato(-3, -38, '#E9703F') + tomato(4, -12),
  },
  jagung: {
    label: 'Jagung', sprout: 'rumput',
    grow: () => ln('M0 0V-44', '#4F9A55', 5) + pl(0, -8, 24, 8, -62, LB) + pl(0, -16, 26, 8, 58, LC) + pl(0, -26, 22, 7, -48, LA) + pl(0, -34, 20, 7, 44, LB) + pl(0, -43, 12, 5, 4, LA),
    ready: () =>
      ln('M0 0V-48', '#4F9A55', 5) + pl(0, -8, 24, 8, -62, LB) + pl(0, -14, 26, 8, 58, LC) + pl(0, -30, 22, 7, -50, LA) + pl(0, -40, 18, 7, 48, LB) +
      g('translate(8 -28) rotate(20)', pl(0, 11, 17, 10, -16, LA) + el(0, 0, 5.4, 11, '#F2C94C', 0, 1.8) + ln('M-3 -6h6M-4 -2h8M-4 2h8M-3 6h6', '#C9A13B', 1.3) + pl(0, 11, 15, 9, 18, LB) + ln('M0 -11q-2 -4 0 -7M0 -11q3 -3 3 -6', '#A8622C', 1.5)) +
      ln('M0 -48l-6 -8M0 -48v-11M0 -48l6 -8M-3 -52l-3 -2M3 -52l3 -2', '#C9A13B', 2.4),
  },
  melati: {
    label: 'Melati', sprout: 'dua',
    grow: () => melatiLeaves() + [[-12, -33, -15], [4, -38, 10], [16, -30, 25]].map(([x, y, r]) => el(x, y, 2.4, 3.8, '#FFFFFF', r, 1.4)).join(''),
    ready: () => melatiLeaves() + [[-14, -26], [0, -35], [14, -28], [-6, -14], [9, -13]].map(([x, y]) => fl5(x, y, 6.6, '#FFFFFF', '#F2D16B')).join(''),
  },
  stroberi: {
    label: 'Stroberi', sprout: 'dua',
    grow: () => ln('M0 0L-14 -10M0 0L13 -12M0 0L0 -18', STEM, 2.6) + trifol(-14, -10, 1, LB) + trifol(13, -12, 1, LC) + trifol(0, -18, 1.1, LB) + fl5(-5, -27, 4.6, '#FFFFFF', '#F2C94C') + fl5(17, -23, 4.6, '#FFFFFF', '#F2C94C'),
    ready: () => ln('M0 0L-14 -10M0 0L13 -12M0 0L0 -18M-6 -8Q-16 -12 -22 -6M6 -8Q17 -12 22 -5M0 -10Q8 -18 6 -6', STEM, 2) + trifol(-14, -10, 1, LB) + trifol(13, -12, 1, LC) + trifol(0, -18, 1.1, LB) + berry(-22, -3) + berry(22, -2) + berry(6, -4, 0.9) + fl5(-5, -28, 4.4, '#FFFFFF', '#F2C94C'),
  },

  /* --- 12 tanaman baru --- */
  kangkung: {
    label: 'Kangkung', sprout: 'daun',
    grow: () => kangkung(5, 20, 50),
    ready: () => kangkung(8, 27, 62) + fl5(-9, -30, 4, '#F1E6F7', '#B48ED6') + fl5(12, -26, 4, '#F1E6F7', '#B48ED6'),
  },
  cabai: {
    label: 'Cabai rawit', sprout: 'dua',
    grow: () => cabaiBush() + fl5(-9, -24, 3.6, '#FFFFFF', '#F2C94C') + fl5(9, -28, 3.6, '#FFFFFF', '#F2C94C') + fl5(-1, -35, 3.4, '#FFFFFF', '#F2C94C'),
    ready: () => cabaiBush() + chili(-12, -24, 10, '#E0402F') + chili(-4, -34, -6, '#E0402F') + chili(9, -30, -12, '#E0402F') + chili(16, -31, 14, '#E87A2F') + chili(3, -22, 4, '#5DB36A'),
  },
  wortel: {
    label: 'Wortel', sprout: 'dua',
    grow: () => [-40, -19, 1, 21, 41].map((a) => frond(0, -1, a, a === 1 ? 30 : 26)).join(''),
    ready: () =>
      [-10, 10].map((x) => (x < 0 ? [-37, -15, 5] : [-5, 15, 37]).map((a) => frond(x, -9, a, a === 5 || a === -5 ? 33 : 29)).join('') +
        `<path d="M${x - 8} 4Q${x - 9.5} -11 ${x} -11Q${x + 9.5} -11 ${x + 8} 4Z" fill="#F28C28" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>` +
        ln(`M${x - 5} -4h4M${x + 1} -7h4`, '#C46A1A', 1.4) + hl(x - 4, -6, 1.2, 2.4)).join('') +
      `<path d="M-22 4Q-11 -1 0 3Q11 -1 22 4Q11 8 0 7Q-11 8 -22 4Z" fill="#7A4A22" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`,
  },
  terong: {
    label: 'Terong', sprout: 'dua',
    grow: () => terongBush() + fl5(-4, -24, 4.8, '#B48ED6', '#F2C94C') + fl5(8, -38, 4.6, '#B48ED6', '#F2C94C'),
    ready: () => terongBush() + eggplant(-10, -17, 10) + eggplant(11, -23, -12),
  },
  matahari: {
    label: 'Bunga matahari', sprout: 'bulat',
    grow: () => ln('M0 0V-38', STEM, 4.5) + el(-11, -14, 11, 6.5, LC, -30) + el(11, -24, 11, 6.5, LB, 30) + el(-9, -32, 8, 5, LA, -25) + pl(0, -38, 9, 7, -42, LA, 1.5) + pl(0, -38, 9, 7, 42, LA, 1.5) + ci(0, -43, 6, LB, 1.8),
    ready: () => ln('M0 0V-40', STEM, 4.5) + el(-11, -13, 11, 6.5, LC, -30) + el(11, -22, 11, 6.5, LB, 30) + el(-10, -31, 8, 5, LA, -25) + sunHead(1, -45),
  },
  singkong: {
    label: 'Singkong', sprout: 'dua',
    grow: () => ln('M0 0L-12 -26M0 0L1 -34M0 0L13 -24', '#A8553A', 3.2) + palm(-12, -26, 0.9, -25) + palm(13, -24, 0.9, 25) + palm(1, -34, 1, 0),
    ready: () =>
      el(-13, 3, 11, 4.4, '#A8703F', -24) + el(13, 3, 11, 4.4, '#9A6436', 24) + el(0, 6, 9, 4.2, '#B07A48', 90) + ln('M-19 4l2.5 3M-11 0l2.5 3M19 4l-2.5 3M11 0l-2.5 3M-3 6h6M-3 10h6', '#7A4A28', 1.2) + `<path d="M-12 0Q0 -5 12 0Q0 4 -12 0Z" fill="#7A4A22" stroke="${INK}" stroke-width="1.4"/>` +
      ln('M0 0L-13 -28M0 0L1 -37M0 0L14 -26', '#A8553A', 3.4) + palm(-13, -28, 1, -25) + palm(14, -26, 1, 25) + palm(1, -37, 1.08, 0),
  },
  labu: {
    label: 'Labu kuning', sprout: 'bulat',
    grow: () => vine() + roundLeaf(-20, -12, 1, LC, -10) + roundLeaf(19, -14, 1, LB, 10) + roundLeaf(-1, -23, 0.95, LA) + tendril(28, -5) + fl5(7, -8, 5.6, '#F2C94C', '#E8A33A') + ci(-10, -3, 3.6, LB, 1.6),
    ready: () => vine() + roundLeaf(-24, -16, 1, LC, -10) + roundLeaf(23, -19, 1, LB, 10) + roundLeaf(-4, -30, 0.9, LA) + tendril(-31, -4) + pumpkin(3, -11),
  },
  mawar: {
    label: 'Mawar', sprout: 'dua',
    grow: () => mawarBush() + [[-13, -31], [0, -40], [13, -35]].map(([x, y]) => el(x, y, 3.6, 5, LB, 0, 1.5) + el(x, y - 3.4, 2.4, 2.8, '#E5506A', 0, 1.3)).join(''),
    ready: () => mawarBush() + rose(-13, -31, 7) + rose(13, -35, 7) + rose(0, -42, 7.5, '#EE6A80'),
  },
  semangka: {
    label: 'Semangka', sprout: 'bulat',
    grow: () => vine() + lobed(-21, -10, 1, LC, -20) + lobed(20, -12, 1, LB, 20) + lobed(0, -21, 0.95, LA) + ci(9, -5, 5, '#4FA85F', 1.6) + ln('M5 -6h8', '#2B6E40', 1.6) + fl5(-9, -6, 4.6, '#F2C94C', '#E8A33A'),
    ready: () => vine() + lobed(-24, -16, 1, LC, -20) + lobed(24, -18, 1, LB, 20) + lobed(-2, -27, 0.9, LA) + tendril(30, -4) + melon(2, -10),
  },
  padi: {
    label: 'Padi ketan', sprout: 'rumput',
    grow: () => fan(9, 36, (a) => 40 * (1 - Math.abs(a) / 110), 5.4, [LA, LB], 1.5),
    ready: () =>
      fan(9, 38, (a) => 36 * (1 - Math.abs(a) / 110), 5.4, ['#C3CF6A', '#A9C25E'], 1.5) +
      panicle([-2, -16], [-4, -56], [-21, -36], '#E3B54A') + panicle([2, -16], [5, -58], [22, -38], '#E3B54A') + panicle([-1, -20], [-1, -62], [-9, -44], '#EBC35C') + panicle([1, -20], [4, -63], [11, -46], '#EBC35C'),
  },
  nanas: {
    label: 'Nanas', sprout: 'duri',
    grow: () => fan(9, 72, (a) => 27 * (0.62 + 0.38 * Math.cos(rad(a))), 6.6, ['#5E9E6E', '#4C8A5E']) + ci(0, -13, 4, '#E07A8F', 1.6),
    ready: () =>
      fan(9, 76, (a) => 26 * (0.62 + 0.38 * Math.cos(rad(a))), 6.6, ['#5E9E6E', '#4C8A5E']) +
      [-40, -20, 0, 20, 40].map((a, i) => pl(0, -36, a ? 11 : 14, 5, a, i % 2 ? '#4C8A5E' : '#5E9E6E', 1.5)).join('') +
      el(0, -25, 9.5, 12, '#F2B632', 0, 2) +
      [[-4, -31], [4, -31], [0, -26], [-6, -21], [6, -21], [0, -16], [-4, -26.5], [4, -26.5]].map(([x, y]) => ln(`M${x - 2} ${y - 1}l2 2 2 -2`, '#B9801E', 1.3)).join('') +
      hl(-5, -29, 1.8, 3.2, 15),
  },
  anggrek: {
    label: 'Anggrek bulan', sprout: 'dua',
    grow: () => el(-11, -5, 13, 5, '#4F9E5F', -14) + el(11, -5, 13, 5, LB, 14) + el(0, -8, 10, 4.5, LA) + ln('M7 2V-46', '#B9804A', 2) + ln('M2 -8C3 -28 6 -42 16 -46', '#5E7A55', 2.2) + ci(9, -40, 3, '#EAF4DE', 1.4) + ci(13, -44.5, 3, '#EAF4DE', 1.4) + ci(17.5, -46, 2.6, '#EAF4DE', 1.4),
    ready: () => el(-11, -5, 13, 5, '#4F9E5F', -14) + el(11, -5, 13, 5, LB, 14) + el(0, -8, 10, 4.5, LA) + ln('M7 2V-48', '#B9804A', 2) + ln('M2 -8C2 -32 6 -50 24 -50', '#5E7A55', 2.2) + orchid(-1, -32, 1) + orchid(8, -45, 1.05) + orchid(22, -46, 0.95) + ci(27, -49, 2.4, '#EAF4DE', 1.2),
  },

  /* --- 2 tanaman event --- */
  timunsuri: {
    label: 'Timun suri', sprout: 'bulat',
    grow: () => vine() + roundLeaf(-21, -11, 0.95, LC, -10) + roundLeaf(19, -13, 0.95, LB, 10) + roundLeaf(0, -22, 0.9, LA) + fl5(-7, -6, 4.6, '#F2C94C', '#E8A33A') + el(10, -4, 5.5, 3.2, '#B9C86A', -10, 1.5),
    ready: () => vine() + roundLeaf(-24, -17, 0.95, LC, -10) + roundLeaf(23, -18, 0.95, LB, 10) + roundLeaf(0, -28, 0.9, LA) + fruitLong(-10, -7, -12) + fruitLong(11, -9, 14, 12, 5.6) + fl5(25, -6, 4, '#F2C94C', '#E8A33A'),
  },
  merahputih: {
    label: 'Kembang merah putih', sprout: 'dua',
    grow: () => krpBush() + el(-15, -31, 3, 4.6, '#E0583F', -15, 1.4) + el(14, -35, 3, 4.6, '#FFFFFF', 15, 1.4) + el(1, -44, 3, 4.6, '#E0583F', 0, 1.4),
    ready: () => krpBush() + hibiscus(-14, -28, '#E0583F') + hibiscus(14, -33, '#FFFFFF') + hibiscus(0, -44, '#E0583F', 0.95),
  },
};

/** 0 = tunas, 1 = tumbuh, 2 = siap (ambang sama dengan kebun lama). */
export const cropStage = (prog: number) => (prog >= 1 ? 2 : prog < 0.34 ? 0 : 1);

/** Tanaman umum (gambar kebun lama) untuk bibit buatan admin tanpa data.crop. */
export function genericPlant(prog: number, fruit = '#E0583F') {
  if (prog < 0.34) return SPROUTS.dua();
  const h = prog < 0.75 ? 30 : 42;
  let s = classicLeaves(h);
  if (prog >= 1) for (const [dx, dy] of [[-10, -h * 0.55], [10, -h * 0.75], [0, -h - 4]]) s += ci(dx, dy, 7, fruit);
  return s;
}

/** Tanaman di (cx, base); base = garis tanah, `prog` 0..1. Saat tumbuh, ukurannya membesar 0,8 → 1. */
export function cropSVG(key: string | undefined, prog: number, cx: number, base: number, scale = 1, fruit?: string) {
  const def = key ? KEBUN_CROPS[key] : undefined;
  const st = cropStage(prog);
  const grow = st === 1 ? 0.8 + 0.2 * Math.min(1, (prog - 0.34) / 0.66) : 1;
  const body = !def ? genericPlant(prog, fruit) : st === 0 ? SPROUTS[def.sprout]() : st === 1 ? def.grow() : def.ready();
  return `<g transform="translate(${f1(cx)} ${f1(base)}) scale(${f1(scale * grow * 100) / 100})">${body}</g>`;
}

/* ------------------------------------------------------------------ */
/* 3. Ikon hasil panen & pupuk (64×52, sama bentuknya dengan ICONS)    */
/* ------------------------------------------------------------------ */

type IconFn = (c: Record<string, string>) => string;
export const KEBUN_ICONS: Record<string, { label: string; kinds: string[]; colors: Record<string, string>; draw: IconFn }> = {
  kangkung: {
    label: 'Ikat sayur', kinds: ['food'], colors: { main: '#6CC070', accent: '#E0583F' },
    draw: (c) =>
      lnO('M26 47L29 31M32 47V29M38 47L35 31', '#8CC56E', 3) +
      pl(30, 33, 13, 9, -72, shade(c.main, -0.1), 2) + pl(34, 33, 13, 9, 72, c.main, 2) +
      pl(29, 31, 19, 12, -36, c.main, 2) + pl(35, 31, 19, 12, 36, shade(c.main, -0.1), 2) + pl(32, 29, 23, 12, 0, shade(c.main, 0.12), 2) +
      `<rect x="25" y="37" width="14" height="5.5" rx="2" fill="${c.accent}" stroke="${INK}" stroke-width="2"/>`,
  },
  cabai: {
    label: 'Cabai', kinds: ['food'], colors: { main: '#E0402F', accent: '#3FA06A' },
    draw: (c) => {
      const ch = (x: number, y: number, r: number, f: string) => g(`translate(${x} ${y}) rotate(${r}) scale(1.85)`, `<path d="M0 0C3.5 1 4.5 9 1.5 17C1 19 -1 19.5 -1 17C0 10 -3 3 0 0Z" fill="${f}" stroke="${INK}" stroke-width="1.25" stroke-linejoin="round"/>` + el(0, 0.5, 2.9, 1.9, c.accent, 0, 1.1) + ln('M0 -0.5q-1 -2 1 -3.6', shade(c.accent, -0.2), 1.2));
      return ch(22, 9, 26, shade(c.main, -0.05)) + ch(42, 9, -24, '#5DB36A') + ch(32, 7, 2, c.main) + hl(30, 16, 1, 3.5, 5);
    },
  },
  wortel: {
    label: 'Wortel', kinds: ['food'], colors: { main: '#F28C28', accent: '#5DB36A' },
    draw: (c) =>
      g('rotate(36 32 28)',
        pl(32, 13, 14, 8, -28, c.accent, 2) + pl(32, 13, 13, 8, 28, shade(c.accent, -0.12), 2) + pl(32, 13, 16, 8, 0, shade(c.accent, 0.12), 2) +
        `<path d="M24.5 13H39.5Q41 14 40 18Q36.5 34 32 49Q27.5 34 24 18Q23 14 24.5 13Z" fill="${c.main}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>` +
        ln('M27 20h4M33 26h4.5M28.5 32h3M33 38h2.5', shade(c.main, -0.28), 1.6) + hl(28, 19, 1.3, 3)),
  },
  terong: {
    label: 'Terong', kinds: ['food'], colors: { main: '#7A4FA0', accent: '#5DB36A' },
    draw: (c) =>
      lnO('M21 14l-5 -7', shade(c.accent, -0.2), 3) +
      `<path d="M23 16C31 11 38 17 42 25C47 34 47 44 39 46C31 48 27 41 25 33C23 27 18 20 23 16Z" fill="${c.main}" stroke="${INK}" stroke-width="2.4"/>` +
      `<path d="M15 19L20 12 24 15 28 10 30 17 26 21 20 22Z" fill="${c.accent}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>` +
      ln('M30 23q5 7 8 16', '#FFFFFF', 2.6, ' opacity=".45"'),
  },
  singkong: {
    label: 'Singkong', kinds: ['food'], colors: { main: '#A8703F', accent: '#F6F0E2' },
    draw: (c) =>
      el(30, 22, 20, 6.8, c.main, -16, 2.4) + el(48.6, 16.6, 2.6, 6.2, c.accent, -16, 2) +
      el(33, 34, 20, 6.8, shade(c.main, -0.08), 10, 2.4) + el(52.4, 37.5, 2.6, 6.2, c.accent, 10, 2) +
      ln('M18 23l2 5M26 19l1 6M36 17l1 5M20 35l1-5M30 31l0 6M40 33l-1 6', shade(c.main, -0.3), 1.5),
  },
  labu: {
    label: 'Labu', kinds: ['food'], colors: { main: '#F2994A', accent: '#7A5232' },
    draw: (c) =>
      pl(35, 13, 12, 9, 62, '#5DB36A', 1.8) +
      `<path d="M30 18l1 -9h4.5l-1 9Z" fill="${c.accent}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>` +
      el(32, 31, 21, 15, c.main, 0, 2.5) +
      ln('M32 16Q25 31 32 46M32 16Q39 31 32 46M24 17.5Q12 31 24 44.5M40 17.5Q52 31 40 44.5', shade(c.main, -0.25), 1.8) + hl(20, 25, 2.6, 4, 20),
  },
  semangka: {
    label: 'Semangka', kinds: ['food'], colors: { main: '#E9504A', accent: '#3F9A58' },
    draw: (c) =>
      `<path d="M8 17A24 24 0 0 0 56 17Z" fill="${c.accent}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>` +
      `<path d="M12 17A20 20 0 0 0 52 17Z" fill="#F4F1DC"/>` +
      `<path d="M14.5 17A17.5 17.5 0 0 0 49.5 17Z" fill="${c.main}"/>` +
      ln('M8 17H56', INK, 2.5) +
      [[22, 22, -25], [32, 25, 0], [42, 22, 25], [27, 30, -15], [37, 30, 15]].map(([x, y, r]) => el(x, y, 1.4, 2.3, INK, r, 0)).join('') +
      ln('M14 30q2 4 5 6M45 36q3 -2 5 -6', shade(c.accent, -0.3), 1.6),
  },
  nanas: {
    label: 'Nanas', kinds: ['food'], colors: { main: '#F2B632', accent: '#4C8A5E' },
    draw: (c) =>
      [-44, -22, 0, 22, 44].map((a, i) => pl(32, 19, a ? 13 : 17, 6, a, i % 2 ? c.accent : shade(c.accent, 0.15), 2)).join('') +
      el(32, 33, 12, 15, c.main, 0, 2.5) +
      [[-6, -9], [2, -9], [-2, -4], [6, -4], [-6, 1], [2, 1], [-2, 6], [6, 6], [-2, 11], [-9, -4], [-9, 6]].map(([dx, dy]) => ln(`M${30 + dx} ${33 + dy}l2.2 2.2 2.2 -2.2`, shade(c.main, -0.32), 1.5)).join('') +
      hl(25, 26, 2, 4.5, 12),
  },
  padi: {
    label: 'Seikat padi', kinds: ['material'], colors: { main: '#E9C46A', accent: '#C9A13B' },
    draw: (c) =>
      lnO('M28 48L30.5 24M32 48V22M36 48L33.5 24', c.accent, 2.6) +
      `<rect x="25.5" y="37" width="13" height="5.5" rx="2" fill="#8A5A36" stroke="${INK}" stroke-width="2"/>` +
      panicle([30.5, 24], [22, 6], [12, 22], c.main, c.accent, 1.15) + panicle([33.5, 24], [42, 6], [52, 22], c.main, c.accent, 1.15) + panicle([32, 22], [34, 2], [40, 16], c.main, c.accent, 1.05),
  },
  matahari: {
    label: 'Bunga matahari', kinds: ['material'], colors: { main: '#F2C230', accent: '#7A4A2A' },
    draw: (c) =>
      lnO('M32 34V49', '#3E8E4E', 3) + el(41, 42, 7, 3.8, '#56B36F', -28, 1.8) +
      Array.from({ length: 12 }, (_, i) => `<ellipse cx="32" cy="11" rx="4.2" ry="7.6" transform="rotate(${i * 30} 32 22)" fill="${i % 2 ? c.main : shade(c.main, 0.2)}" stroke="${INK}" stroke-width="1.8"/>`).join('') +
      ci(32, 22, 8.6, c.accent, 2) + `<g fill="${shade(c.accent, -0.4)}">${[[-3, -3], [2, -4], [4, 1], [-1, 1], [-4, 3], [1, 5]].map(([dx, dy]) => `<circle cx="${32 + dx}" cy="${22 + dy}" r="1.1"/>`).join('')}</g>`,
  },
  mawar: {
    label: 'Mawar', kinds: ['material'], colors: { main: '#E5506A', accent: '#3F9A58' },
    draw: (c) =>
      lnO('M32 30Q31 40 34 49', '#3E7A4A', 3) + el(41, 39, 7.5, 4, c.accent, -28, 1.8) + ln('M31.5 40l-3 -1.5', '#3E7A4A', 1.6) +
      ci(32, 19, 13, c.main, 2.4) +
      `<path d="M20 21Q22 33 32 33Q42 33 44 21" fill="${shade(c.main, -0.12)}" stroke="${INK}" stroke-width="2"/>` +
      ln('M26 18a6 5.5 0 1 1 7.4 5M30 17a2.6 2.6 0 1 1 3.2 2', shade(c.main, -0.38), 1.9),
  },
  anggrek: {
    label: 'Anggrek', kinds: ['material'], colors: { main: '#FFFFFF', accent: '#C2408A' },
    draw: (c) => ln('M10 48C12 34 20 24 29 21', '#5E7A55', 2.4) + ci(13, 38, 2.6, '#EAF4DE', 1.4) + orchid(33, 23, 2.35, c.main, c.accent),
  },
  timunsuri: {
    label: 'Timun suri', kinds: ['food'], colors: { main: '#F2D16B', accent: '#A9B85A' },
    draw: (c) =>
      g('rotate(-14 27 25)', el(27, 25, 21, 10, c.main, 0, 2.4) + ln('M10 22Q27 16 44 22M10 28Q27 34 44 28', c.accent, 1.8) + hl(17, 21, 4, 1.6)) +
      ci(47, 38, 9, c.main, 2.2) + ci(47, 38, 6.4, '#FBF1C8', 0) + [0, 60, 120, 180, 240, 300].map((a) => `<ellipse cx="47" cy="35" rx="0.9" ry="1.6" transform="rotate(${a} 47 38)" fill="#D9B85A"/>`).join(''),
  },
  merahputih: {
    label: 'Kembang merah putih', kinds: ['material'], colors: { main: '#E0583F', accent: '#FFFFFF' },
    draw: (c) => pl(14, 44, 12, 9, -70, '#3F9A58', 1.8) + pl(50, 44, 12, 9, 70, '#56B36F', 1.8) + hibiscus(23, 23, c.accent, 2) + hibiscus(42, 28, c.main, 2),
  },
  pupuk: {
    label: 'Karung pupuk', kinds: ['material'], colors: { main: '#9CCB5A', accent: '#C8955A' },
    draw: (c) =>
      `<path d="M18 19Q11 45 32 47Q53 45 46 19Z" fill="${c.accent}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>` +
      `<path d="M22 19L25 9H39L42 19" fill="${shade(c.accent, 0.1)}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>` +
      ln('M23.5 15.5H40.5', INK, 2.4) +
      `<rect x="22" y="24" width="20" height="16" rx="4" fill="${c.main}" stroke="${INK}" stroke-width="1.8"/>` +
      ln('M32 37V31', '#2E6F44', 2) + el(28.5, 30, 3.6, 2, '#2E6F44', -20, 0) + el(35.5, 29, 3.6, 2, '#2E6F44', 20, 0) +
      kebunSparkle(50, 12, 4.5) + kebunSparkle(13, 16, 3.2),
  },
};

/* ------------------------------------------------------------------ */
/* 4. Bungkus bibit berjendela gambar                                   */
/* ------------------------------------------------------------------ */
// ICONS.bibit membaca params.pic (indeks SEED_PICS, hanya boleh ditambah di belakang): bungkus
// menampilkan gambar hasil panen supaya 18 bibit tetap mudah dibedakan walau warnanya mirip.

export const SEED_PICS = ['', 'buah', 'jagung', 'bunga', 'stroberi', 'kangkung', 'cabai', 'wortel', 'terong', 'matahari', 'singkong', 'labu', 'mawar', 'semangka', 'padi', 'nanas', 'anggrek', 'timunsuri', 'merahputih'];

/** picInner = isi SVG gambar hasil panen (ruang 64×52); kosong → gambar tunas. */
export function seedPacket(c: { main: string; accent: string }, picInner = '') {
  return (
    `<path d="M14 8H50L48 48H16Z" fill="${c.main}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<path d="M16.6 41H47.4L47 48H17Z" fill="${shade(c.main, -0.2)}"/>` +
    `<path d="M14 8H50L48 48H16Z" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<path d="M14 8L18 13 22 8 26 13 30 8 34 13 38 8 42 13 46 8 50 8" fill="none" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>` +
    `<rect x="18.5" y="16" width="27" height="23" rx="5" fill="#FFF8E6" stroke="${INK}" stroke-width="1.8"/>` +
    (picInner
      ? `<g transform="translate(19.2 16.6) scale(0.4)">${picInner}</g>`
      : ln('M32 35V26', INK, 2.2) + el(27.5, 25, 4.5, 2.6, c.accent, -25, 1.6) + el(36.5, 24, 4.5, 2.6, shade(c.accent, -0.15), 25, 1.6)) +
    `<circle cx="20.5" cy="44.5" r="1.4" fill="${shade(c.main, 0.45)}"/><circle cx="25" cy="44.5" r="1.4" fill="${shade(c.main, 0.45)}"/>`
  );
}

/* ------------------------------------------------------------------ */
/* 5. Benda kebun (koordinat kebun; titik pegang = tengah bawah)        */
/* ------------------------------------------------------------------ */

/** Pagar bambu dari x1 sampai x2, berdiri di y. */
export function pagarBambu(x1: number, x2: number, y: number, h = 26) {
  let o = '';
  const rail = (yy: number) => `<rect x="${x1 - 6}" y="${f1(yy)}" width="${x2 - x1 + 12}" height="4.6" rx="2.3" fill="#C9A05A" stroke="${INK}" stroke-width="1.5"/>`;
  let k = 0;
  for (let x = x1; x <= x2 + 0.1; x += 22, k++) {
    const hh = h + (k % 2 ? 0 : 4);
    o += `<rect x="${f1(x - 3.6)}" y="${f1(y - hh)}" width="7.2" height="${f1(hh)}" rx="3.6" fill="#E1BE74" stroke="${INK}" stroke-width="1.5"/>` + ln(`M${f1(x - 3)} ${f1(y - hh * 0.5)}h6`, '#B48A45', 1.2);
  }
  return o + rail(y - h * 0.74) + rail(y - h * 0.34);
}

/** orang-orangan sawah */
export function orangOrangan(x: number, y: number, s = 1) {
  return g(`translate(${x} ${y}) scale(${s})`,
    el(0, 1, 18, 4, INK, 0, 0).replace('/>', ' opacity=".12"/>') +
    lnO('M0 0V-66', '#B98B4E', 3.6) + lnO('M-25 -47H25', '#B98B4E', 3.6) +
    ln('M-9 -28l-3 8M-3 -28l-1 9M3 -28l1 9M9 -28l3 8', '#E9C46A', 2.2) +
    `<path d="M-13 -55H13L18 -28H-18Z" fill="#3F7FBF" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M-13 -54L-26 -50L-25 -42L-12 -45Z" fill="#3F7FBF" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M13 -54L26 -50L25 -42L12 -45Z" fill="#3F7FBF" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>` +
    ln('M-26 -48l-6 -1M-26 -45l-6 2M-25 -43l-4 4M26 -48l6 -1M26 -45l6 2M25 -43l4 4', '#E9C46A', 2) +
    `<rect x="4" y="-42" width="8" height="7" rx="1.5" fill="#F2C94C" stroke="${INK}" stroke-width="1.5" transform="rotate(8 8 -38)"/>` + ln('M-4 -55V-30M4 -55V-30', '#33639A', 1.4) +
    ci(0, -63, 10, '#EAD9B2', 2) + ci(-3.6, -64, 1.7, INK, 0) + ci(3.6, -64, 1.7, INK, 0) + el(-6.5, -60, 2.4, 1.4, '#FF8FA3', 0, 0) + el(6.5, -60, 2.4, 1.4, '#FF8FA3', 0, 0) +
    ln('M-4 -59q4 3 8 0', INK, 1.6) + ln('M-2.5 -58.4v1.6M0 -57.8v1.6M2.5 -58.4v1.6', INK, 1) +
    `<path d="M-22 -68L0 -86L22 -68Q0 -63 -22 -68Z" fill="#E3C16F" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>` + ln('M-12 -73Q0 -71 12 -73M-5 -80Q0 -79 5 -80', '#B9934A', 1.4) +
    `<path d="M-1 -30l-6 9 5 -1 1 5 3 -12Z" fill="#E0583F" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round" transform="translate(0 -12)"/>`);
}

/** gentong air dari tanah liat + gayung */
export function gentong(x: number, y: number, s = 1) {
  return g(`translate(${x} ${y}) scale(${s})`,
    el(0, 0, 27, 5.5, '#B5AD9A', 0, 1.8) + el(-14, -1, 6, 3, '#C9C2B0', 0, 1.4) + el(13, 0, 7, 3, '#A9A196', 0, 1.4) +
    `<path d="M-17 -44Q-31 -24 -19 -5Q0 3 19 -5Q31 -24 17 -44Z" fill="#C0603A" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>` +
    ln('M-24 -28Q0 -22 24 -28M-23 -16Q0 -10 23 -16', '#A44E2E', 2) + ln('M-21 -22l3 2M-11 -19l3 2M-1 -18l3 2M9 -19l3 2M18 -21l3 2', '#E08A5A', 1.6) +
    ln('M-19 -34Q-23 -22 -17 -10', '#FFFFFF', 3, ' opacity=".3"') +
    el(0, -44, 18.5, 5.5, '#D9784E', 0, 2.2) + el(0, -44.5, 14, 3.6, '#6FB7E0', 0, 1.5) + el(-5, -45, 4, 1.2, '#FFFFFF', 0, 0).replace('/>', ' opacity=".7"/>') +
    lnO('M5 -45L24 -64', '#C8955A', 2.6) + el(4, -46, 6.5, 3.2, '#8A5A36', -15, 1.8));
}

/** gubuk bambu beratap ilalang, dengan cangkul dan gembor */
export function gubuk(x: number, y: number, s = 1) {
  const W = 40;
  return g(`translate(${x} ${y}) scale(${s})`,
    el(0, 1, 54, 6, INK, 0, 0).replace('/>', ' opacity=".12"/>') +
    [-38, -14, 14, 38].map((px) => `<rect x="${px - 2.5}" y="-16" width="5" height="16" rx="2" fill="#A8743F" stroke="${INK}" stroke-width="1.6"/>`).join('') +
    `<rect x="-46" y="-20" width="92" height="7" rx="2" fill="#B98B4E" stroke="${INK}" stroke-width="1.8"/>` +
    `<rect x="${-W}" y="-60" width="${2 * W}" height="40" fill="#E9CF98" stroke="${INK}" stroke-width="2"/>` +
    ln(`M${-W} -52H${W}M${-W} -44H${W}M${-W} -36H${W}M${-W} -28H${W}`, '#CDAE72', 1.6) +
    `<rect x="-11" y="-50" width="20" height="30" rx="3" fill="#6B4428" stroke="${INK}" stroke-width="1.8"/>` +
    `<path d="M-11 -50h20v9q-5 3 -10 0q-5 3 -10 0Z" fill="#E0583F" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<rect x="17" y="-52" width="15" height="12" rx="2" fill="#5A3A22" stroke="${INK}" stroke-width="1.6"/>` + ln('M22 -52v12M27 -52v12', '#C9A05A', 1.6) +
    lnO(`M-${W} -60V-20M${W} -60V-20`, '#C9A05A', 3) +
    `<path d="M-58 -56L-28 -90H28L58 -56Z" fill="#C9A15A" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>` +
    ln('M-50 -60l2 4M-40 -60l2 4M-30 -60l2 4M-20 -60l2 4M-10 -60l2 4M0 -60l2 4M10 -60l2 4M20 -60l2 4M30 -60l2 4M40 -60l2 4', '#A88442', 1.6) +
    ln('M-40 -74H40M-34 -82H34', '#B8934C', 1.6) +
    `<rect x="-30" y="-94" width="60" height="6" rx="3" fill="#A88442" stroke="${INK}" stroke-width="1.8"/>` +
    // cangkul bersandar di kanan
    lnO('M46 -2L56 -46', '#8A5A36', 2.6) + `<path d="M41 -6L52 -6 50 2 42 2Z" fill="#9AA0A8" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>` +
    // gembor di kiri
    `<path d="M-56 -2V-16H-42V-2Z" fill="#4FA3A5" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>` + lnO('M-56 -13L-66 -20', '#4FA3A5', 2.4) + ln('M-53 -16q4 -8 8 0', INK, 1.8));
}

const escX = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Papan nama kebun. `textW` = lebar teks terukur (font 800 13px); papan selalu dibuat
 * selebar teks + 24 supaya tulisan tidak pernah keluar papan. Tanpa ukuran: perkiraan longgar.
 */
export function papanNama(x: number, y: number, text: string, textW?: number, s = 1) {
  const tw = textW ?? text.length * 7.8;
  const w = Math.round(Math.max(70, tw + 24));
  return g(`translate(${x} ${y}) scale(${s})`,
    `<rect x="${-w / 2 + 8}" y="-34" width="5" height="34" fill="#8A5A36" stroke="${INK}" stroke-width="1.6"/><rect x="${w / 2 - 13}" y="-34" width="5" height="34" fill="#8A5A36" stroke="${INK}" stroke-width="1.6"/>` +
    `<rect x="${-w / 2}" y="-50" width="${w}" height="26" rx="6" fill="#E3B370" stroke="${INK}" stroke-width="2.2"/>` +
    ln(`M${-w / 2 + 4} -37H${w / 2 - 4}`, '#C9955A', 1.2) +
    `<text x="0" y="-32.5" text-anchor="middle" font-family="'Baloo 2', ui-rounded, sans-serif" font-weight="800" font-size="13" fill="${INK}">${escX(text)}</text>` +
    fl5(-w / 2 + 2, -50, 6, '#FF8FA3', '#F2C94C') + fl5(w / 2 - 2, -51, 5, '#FFFFFF', '#F2C94C'));
}
/** Lebar papan nama untuk teks selebar `textW`. */
export const papanW = (textW: number) => Math.round(Math.max(70, textW + 24));

/** rumpun bunga kecil untuk pinggir pagar */
export const kebunTuft = (x: number, y: number, c: string) => pl(x - 3, y, 8, 5, -30, LB, 1.3) + pl(x + 3, y, 8, 5, 30, LC, 1.3) + fl5(x, y - 7, 4.5, c, '#F2C94C', 0, 1.2);

/** tetes air (lencana siram) */
export const kebunDrop = (x: number, y: number, s = 1, fill = '#6FB7E0') =>
  `<path d="M${x} ${y - 7 * s}C${x + 3 * s} ${y - 3 * s} ${x + 5 * s} ${y} ${x + 5 * s} ${y + 2.5 * s}A${5 * s} ${5 * s} 0 0 1 ${x - 5 * s} ${y + 2.5 * s}C${x - 5 * s} ${y} ${x - 3 * s} ${y - 3 * s} ${x} ${y - 7 * s}Z" fill="${fill}" stroke="${INK}" stroke-width="${f1(1.6 * Math.min(1.2, s))}" stroke-linejoin="round"/>` + hl(x - 2 * s, y + 1 * s, 1 * s, 1.8 * s);
/** keranjang untuk tombol Panen semua */
export const basketIcon = (fill = '#C8955A') =>
  `<path d="M6 14H34L30 33H10Z" fill="${fill}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>` + ln('M8 20H32M9 26H31M14 14L15 33M20 14V33M26 14L25 33', shade(fill, -0.3), 1.4) +
  ln('M10 14Q20 0 30 14', INK, 2.4) + ci(14, 11, 4.6, '#E0583F', 2) + ci(22, 10, 4.6, '#F2C94C', 2) + ci(28, 12, 3.8, '#7CC57D', 2);

