// Gambar Alun-alun v32 "Pojok Wahana": rel & kereta kelinci, kolam pancing bareng, bianglala, lempar gelang, halte,
// gapura, layar tancap, ondel-ondel, kembang api, dan properti panggung baru (angklung, silat, kuda lumping, lawak).
// Semua orisinal: garis INK, isian datar. Koordinat petak alun-alun (houseIso, t = 34). Didaftarkan ke art.ts lewat registerArt.
import { INK, P, shade, renderPet, houseIso, registerArt, type IsoCtx, type PetLook } from './art';
import { ALUN_D, ALUN_W, BIANGLALA, FILMS, KERETA_CARS, LOMBA_SIAP, POND_PIERS, RING, gondolaAngle, ringLen, ringPoint } from './square';

const T = 34, HT = 17, S = T / 32;
const f1 = (v: number) => Math.round(v * 10) / 10;
const C3 = (hex: string) => [shade(hex, 0.14), shade(hex, -0.1), shade(hex, -0.27)];
const FONT = `font-family="'Baloo 2',system-ui,sans-serif"`;

/* ---------------- ukuran teks: papan dibuat muat dengan tulisannya ---------------- */

/** perkiraan lebar teks Baloo 2 tebal (sengaja agak lebih lebar dari aslinya) */
export function textW(txt: string, size: number) {
  let w = 0;
  for (const ch of txt) w += /[A-Z]/.test(ch) ? (ch === 'M' || ch === 'W' ? 0.86 : ch === 'I' ? 0.34 : 0.66) : /[a-z]/.test(ch) ? (ch === 'm' || ch === 'w' ? 0.8 : /[ijlt]/.test(ch) ? 0.32 : 0.55) : /[0-9]/.test(ch) ? 0.58 : ch === ' ' ? 0.27 : /[.,:;!'|]/.test(ch) ? 0.28 : ch === '&' ? 0.7 : 0.45;
  return w * size;
}
/** ukuran huruf supaya muat di `avail` px (bila terlalu panjang, huruf diperkecil, paling kecil 65%) */
const fitSize = (txt: string, size: number, avail: number) => { const w = textW(txt, size); return w <= avail ? size : Math.max(size * 0.65, (size * avail) / w); };

/** alat gambar per konteks (mengikuti g supaya tetap benar di mana pun ruangannya) */
function K(g: IsoCtx) {
  const iso = (x: number, y: number) => g.iso(x, y) as [number, number];
  const up = (p: number[], v: number): [number, number] => [p[0], p[1] - v * S];
  const poly = (a: number[][], fill: string, sw = 1.6, extra = '') => `<polygon points="${P(a)}" fill="${fill}" stroke="${INK}" stroke-width="${f1(sw * S)}" stroke-linejoin="round"${extra}/>`;
  const box = (x: number, y: number, z: number, w: number, d: number, h: number, c3: string[], sw = 1.6) => {
    const p0 = iso(x, y), p1 = iso(x + w, y), p2 = iso(x + w, y + d), p3 = iso(x, y + d);
    const u = (p: number[], k: number) => [p[0], p[1] - (z + k) * S];
    return poly([u(p3, 0), u(p2, 0), u(p2, h), u(p3, h)], c3[1], sw) + poly([u(p1, 0), u(p2, 0), u(p2, h), u(p1, h)], c3[2], sw) + poly([u(p0, h), u(p1, h), u(p2, h), u(p3, h)], c3[0], sw);
  };
  /** bidang x = const (menghadap kanan-bawah), u sepanjang y */
  const quadX = (x: number, y0: number, y1: number, v0: number, v1: number, fill: string, sw = 1.6) => poly([up(iso(x, y0), v0), up(iso(x, y1), v0), up(iso(x, y1), v1), up(iso(x, y0), v1)], fill, sw);
  /** bidang y = const (menghadap kiri-bawah), u sepanjang x */
  const quadY = (y: number, x0: number, x1: number, v0: number, v1: number, fill: string, sw = 1.6) => poly([up(iso(x0, y), v0), up(iso(x1, y), v0), up(iso(x1, y), v1), up(iso(x0, y), v1)], fill, sw);
  /** tulisan miring mengikuti bidang y = const; len = panjang papan (petak) → huruf diperkecil bila perlu, data-fit untuk diperiksa */
  const textY = (xm: number, y: number, v: number, txt: string, size: number, fill: string, len: number, w = 800) => {
    const [X, Y] = up(iso(xm, y), v), avail = len * Math.hypot(T, HT) - 8;
    return `<text transform="matrix(0.894 0.447 0 1 ${f1(X)} ${f1(Y)})" text-anchor="middle" dy=".35em" ${FONT} font-weight="${w}" font-size="${f1(fitSize(txt, size, avail))}" fill="${fill}" data-fit="${f1(avail)}">${txt}</text>`;
  };
  /** tulisan miring mengikuti bidang x = const */
  const textX = (x: number, ym: number, v: number, txt: string, size: number, fill: string, len: number, w = 800) => {
    const [X, Y] = up(iso(x, ym), v), avail = len * Math.hypot(T, HT) - 8;
    return `<text transform="matrix(0.894 -0.447 0 1 ${f1(X)} ${f1(Y)})" text-anchor="middle" dy=".35em" ${FONT} font-weight="${w}" font-size="${f1(fitSize(txt, size, avail))}" fill="${fill}" data-fit="${f1(avail)}">${txt}</text>`;
  };
  return { iso, up, poly, box, quadX, quadY, textY, textX };
}
const H0 = K({ s: S, iso: (x: number, y: number) => houseIso(x, y) } as any);
const circ = (x: number, y: number, r: number, fill: string, sw = 1.4, extra = '') => `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="${fill}" stroke="${INK}" stroke-width="${f1(sw)}"${extra}/>`;
const line2 = (a: number[], b: number[], col: string, w: number) =>
  `<path d="M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}" stroke="${INK}" stroke-width="${f1(w + 2.4)}" stroke-linecap="round"/><path d="M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}" stroke="${col}" stroke-width="${f1(w)}" stroke-linecap="round"/>`;

/* ================================================================== */
/* Tanah: pinggiran kerikil & rel kereta kelinci di luar pagar         */
/* ================================================================== */
function ringRect(W: number, D: number, off: number, n = 10) {
  const r = 0.5 + off, pts: number[][] = [];
  const cs: [number, number, number][] = [[0.5, 0.5, 180], [W - 0.5, 0.5, 270], [W - 0.5, D - 0.5, 0], [0.5, D - 0.5, 90]];
  for (const [cx, cy, a0] of cs) for (let k = 0; k <= n; k++) { const a = ((a0 + (90 * k) / n) * Math.PI) / 180; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return pts;
}
/** titik layar tepi luar pulau alun-alun (untuk tirai malam & batas kamera) */
export function alunIslandPoly(W = ALUN_W, D = ALUN_D) { return ringRect(W, D, RING.band, 8).map((p) => houseIso(p[0], p[1])); }
/** Pulau alun-alun: pinggiran kerikil bertepi tanah, rel melingkar dengan bantalan kayu & perlintasan papan di gerbang. */
export function alunGroundSVG(W = ALUN_W, D = ALUN_D, gate: [number, number] = [9, 11]) {
  const { iso, poly } = H0;
  const outer = ringRect(W, D, RING.band, 12).map((p) => iso(p[0], p[1]));
  let o = `<g class="alun-ground" pointer-events="none"><polygon points="${P(outer.map((p) => [p[0], p[1] + 30]))}" fill="${INK}" opacity=".10"/>`;
  o += poly(outer.map((p) => [p[0], p[1] + 18]), '#B98A5A', 2.2) + poly(outer, '#E9D9B4', 2.2);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 220; k++) {
    const side = k % 4, t = rnd(), off = -0.15 - rnd() * 1.45;
    const [x, y] = side === 0 ? [t * W, off] : side === 1 ? [W - off, t * D] : side === 2 ? [t * W, D - off] : [off, t * D];
    const p = iso(x, y);
    o += `<ellipse cx="${f1(p[0])}" cy="${f1(p[1])}" rx="${f1(2.2 + rnd() * 1.6)}" ry="${f1(1.2 + rnd() * 0.8)}" fill="${rnd() < 0.5 ? '#CDB98E' : '#D9C8A2'}"/>`;
  }
  const L = ringLen(W, D);
  for (let u = 0; u < L; u += 0.42) {
    const p = ringPoint(u, W, D), nx = -p.dy, ny = p.dx, a = 0.36, b = 0.07;
    const q = [[p.x + nx * a - p.dx * b, p.y + ny * a - p.dy * b], [p.x + nx * a + p.dx * b, p.y + ny * a + p.dy * b], [p.x - nx * a + p.dx * b, p.y - ny * a + p.dy * b], [p.x - nx * a - p.dx * b, p.y - ny * a - p.dy * b]];
    o += `<polygon points="${P(q.map((v) => iso(v[0], v[1])))}" fill="#9A6A44" stroke="${INK}" stroke-width=".7"/>`;
  }
  // perlintasan papan di depan gerbang (jalan utama x 9–11)
  const y0 = D + 0.1, y1 = D + RING.band - 0.1;
  o += poly([iso(gate[0], y0), iso(gate[1], y0), iso(gate[1], y1), iso(gate[0], y1)], '#D8B47A', 1.4);
  for (let k = 1; k < 6; k++) { const yy = y0 + ((y1 - y0) * k) / 6, a = iso(gate[0], yy), b = iso(gate[1], yy); o += `<path d="M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}" stroke="#B48A52" stroke-width="1.2"/>`; }
  for (const side of [-0.22, 0.22]) {
    let d = '';
    for (let u = 0; u <= L + 0.01; u += 0.15) { const p = ringPoint(u, W, D), q = iso(p.x - p.dy * side, p.y + p.dx * side); d += (u ? 'L' : 'M') + f1(q[0]) + ' ' + f1(q[1]); }
    o += `<path d="${d}Z" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linejoin="round"/><path d="${d}Z" fill="none" stroke="#B9C1CF" stroke-width="1.8" stroke-linejoin="round"/>`;
  }
  return o + '</g>';
}

/* ================================================================== */
/* Properti pet baru (koordinat lokal pet: kaki di 0,0, badan x ±46)   */
/* ================================================================== */
function angklung(c = '#E7C373', ribbon = '#E0583F') {
  const dk = shade(c, -0.3);
  const tube = (x: number, w: number, top: number) => `<path d="M${x} 6V${top + 10}q0 -4 ${w / 2} -4V${top}h${w / 2}V6Z" fill="${c}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/><path d="M${x} ${top + 22}h${w}M${x} -6h${w}" stroke="${dk}" stroke-width="1.6"/>`;
  return `<g transform="translate(30 -38) rotate(8)"><rect x="-4" y="-60" width="6" height="72" rx="3" fill="${c}" stroke="${INK}" stroke-width="2.2"/><rect x="32" y="-60" width="6" height="72" rx="3" fill="${c}" stroke="${INK}" stroke-width="2.2"/>`
    + tube(5, 11, -46) + tube(19, 11, -30)
    + `<rect x="-7" y="4" width="48" height="9" rx="4.5" fill="${shade(c, -0.12)}" stroke="${INK}" stroke-width="2.2"/><rect x="-6" y="-58" width="46" height="6" rx="3" fill="${shade(c, -0.12)}" stroke="${INK}" stroke-width="2"/>`
    + `<path d="M14 -58l-6 -10l8 3l8 -3l-6 10Z" fill="${ribbon}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/></g>`;
}
function silat(band = '#C0392B', belt = '#2B2F4A') {
  return `<path d="M-37 -66Q0 -78 37 -66L36 -58Q0 -69 -36 -58Z" fill="${band}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`
    + `<circle cx="-18" cy="-66" r="1.8" fill="#F2B632"/><circle cx="0" cy="-69" r="1.8" fill="#F2B632"/><circle cx="18" cy="-66" r="1.8" fill="#F2B632"/>`
    + `<path d="M36 -63l18 -8l-3 8l6 6l-17 -2Z" fill="${band}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`
    + `<path d="M-42 -20Q0 -12 42 -20L41 -12Q0 -4 -41 -12Z" fill="${belt}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/><path d="M-30 -14q30 6 60 0" stroke="#F2B632" stroke-width="1.4" fill="none" stroke-dasharray="3 3"/>`
    + `<path d="M18 -12l-4 18l7 -2l4 -14Z" fill="${belt}" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>`;
}
function kuda(body: string, paint: string, mane: string, id: string) {
  const shape = 'M-58 -30Q-10 -36 30 -32Q40 -54 52 -74L57 -80L60 -92L65 -80Q80 -76 87 -63Q90 -55 82 -53Q68 -55 60 -48Q50 -38 47 -20L46 -6Q0 2 -52 -4Q-62 -12 -58 -30Z';
  let weave = '';
  for (let k = -120; k < 140; k += 9) weave += `M${k} 10L${k + 70} -100M${k + 70} 10L${k} -100`;
  return `<defs><clipPath id="kl-${id}"><path d="${shape}"/></clipPath></defs>`
    + `<path d="M-56 -26q-14 2 -20 14M-56 -22q-12 6 -14 18M-56 -18q-8 8 -6 18" fill="none" stroke="${mane}" stroke-width="3.4" stroke-linecap="round"/>`
    + `<path d="${shape}" fill="${body}"/><g clip-path="url(#kl-${id})"><path d="${weave}" stroke="${shade(body, -0.22)}" stroke-width="1.6" fill="none"/>`
    + `<path d="M-20 -34h44v26h-44Z" fill="${paint}" opacity=".9"/><path d="M-20 -24h44" stroke="#F2B632" stroke-width="3"/><path d="M-16 -14h36" stroke="${mane}" stroke-width="3" stroke-dasharray="5 4"/></g>`
    + `<path d="${shape}" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>`
    + `<path d="M34 -36Q44 -58 54 -76" fill="none" stroke="${mane}" stroke-width="5" stroke-linecap="round" stroke-dasharray="3 3"/>`
    + `<circle cx="72" cy="-68" r="3" fill="${INK}"/><path d="M62 -60q12 2 20 -2M66 -58l-3 10" stroke="${mane}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
    + `<circle cx="50" cy="-38" r="4.4" fill="#F2B632" stroke="${INK}" stroke-width="1.6"/>`;
}
const lawak = () => `<path d="M-36 -62q8 -6 16 -2M20 -64q8 -4 16 2" stroke="${INK}" stroke-width="4" stroke-linecap="round" fill="none"/>`
  + `<circle cx="-15" cy="-50" r="12" fill="#FFFFFF" fill-opacity=".35" stroke="${INK}" stroke-width="3"/><circle cx="15" cy="-50" r="12" fill="#FFFFFF" fill-opacity=".35" stroke="${INK}" stroke-width="3"/><path d="M-3 -51h6M-27 -52l-14 -4M27 -52l14 -4" stroke="${INK}" stroke-width="2.6"/>`
  + `<ellipse cx="0" cy="-38" rx="8" ry="6.5" fill="#F7A8B8" stroke="${INK}" stroke-width="2.2"/>`
  + `<path d="M-1 -32q-8 -6 -16 0q-6 4 -10 -2q2 8 10 8q10 0 16 -6ZM1 -32q8 -6 16 0q6 4 10 -2q-2 8 -10 8q-10 0 -16 -6Z" fill="${INK}"/>`;
function kipas(c1 = '#E0583F', c2 = '#F2B632') {
  let o = '<g transform="translate(36 -40) rotate(-20)">';
  for (let k = 0; k < 6; k++) { const a0 = ((-160 + k * 23) * Math.PI) / 180, a1 = ((-160 + (k + 1) * 23) * Math.PI) / 180, R = 30; o += `<path d="M0 0L${f1(R * Math.cos(a0))} ${f1(R * Math.sin(a0))}A${R} ${R} 0 0 1 ${f1(R * Math.cos(a1))} ${f1(R * Math.sin(a1))}Z" fill="${k % 2 ? c1 : c2}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`; }
  return o + `<circle r="3" fill="${INK}"/></g>`;
}
/** peci kecil (pelawak kedua): dipakai sebagai properti, bukan aksesori pemain */
const peci = `<path d="M-30 -74Q-28 -96 0 -98Q28 -96 30 -74Q0 -80 -30 -74Z" fill="#2B2F4A" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/><path d="M-29 -78Q0 -84 29 -78" stroke="#4A5072" stroke-width="2" fill="none"/>`;
const gelangDiTangan = (c = '#E0583F') => `<ellipse cx="40" cy="-52" rx="11" ry="5" fill="none" stroke="${INK}" stroke-width="5.4" transform="rotate(-20 40 -52)"/><ellipse cx="40" cy="-52" rx="11" ry="5" fill="none" stroke="${c}" stroke-width="3" transform="rotate(-20 40 -52)"/>`;
/** joran pancing: bx, by = letak pelampung (lokal pet) — pemancing di dermaga Kolam Pemancingan Bareng */
function joran(bx: number, by: number) {
  const tip = [84, -104];
  return `<path d="M18 -16L${tip[0]} ${tip[1]}" stroke="${INK}" stroke-width="4.6" stroke-linecap="round"/><path d="M18 -16L${tip[0]} ${tip[1]}" stroke="#8A5A36" stroke-width="2.4" stroke-linecap="round"/>`
    + `<path d="M18 -16L28 -30" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M18 -16L28 -30" stroke="#E0583F" stroke-width="4.4" stroke-linecap="round"/><circle cx="31" cy="-26" r="5" fill="#C9D1DC" stroke="${INK}" stroke-width="2"/>`
    + `<path d="M${tip[0]} ${tip[1]}Q${bx + 10} ${(tip[1] + by) / 2 - 10} ${bx} ${by - 5}" fill="none" stroke="${INK}" stroke-width="1.3"/>`
    + `<ellipse cx="${bx}" cy="${by + 3}" rx="12" ry="4" fill="none" stroke="#FFFFFF" stroke-width="2" opacity=".9"/>`
    + `<g class="apung"><ellipse cx="${bx}" cy="${by}" rx="6" ry="5" fill="#FFFFFF" stroke="${INK}" stroke-width="1.8"/><path d="M${bx - 6} ${by}h12" stroke="#E0583F" stroke-width="3"/><path d="M${bx} ${by - 5}v-6" stroke="${INK}" stroke-width="1.8"/></g>`;
}
const bendera = `<path d="M34 -30V-96" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><path d="M35 -95q14 -6 26 2q-12 6 -26 0Z" fill="#E0583F" stroke="${INK}" stroke-width="2"/><path d="M35 -86q14 -6 26 2" fill="none" stroke="#FFFFFF" stroke-width="5"/><path d="M35 -95q14 -6 26 2M35 -82q14 -6 26 2" fill="none" stroke="${INK}" stroke-width="2"/>`;
export const GONDOLA_COLORS = ['#E0583F', '#3F7FBF', '#3FA06A', '#F2B632', '#D97BA6', '#9A6FC0'];
/** depan cangkir gondola di depan badan pet yang naik bianglala (pet diskalakan 0,42 di gondola) */
const gondolaFront = (c: string) => `<path d="M-63 -23H63V3Q63 38 0 38Q-63 38 -63 3Z" fill="${c}" stroke="${INK}" stroke-width="5.4" stroke-linejoin="round"/><path d="M-56 -5H56" stroke="#FFFDF7" stroke-width="5.4" opacity=".9"/>`;

/* ================================================================== */
/* Wahana & benda baru                                                  */
/* ================================================================== */
function rr(g: IsoCtx, x0: number, y0: number, x1: number, y1: number, r: number, n = 6) {
  const pts: number[][] = [];
  const cs: [number, number, number][] = [[x0 + r, y0 + r, 180], [x1 - r, y0 + r, 270], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90]];
  for (const [cx, cy, a0] of cs) for (let k = 0; k <= n; k++) { const a = ((a0 + (90 * k) / n) * Math.PI) / 180; pts.push(g.iso(cx + r * Math.cos(a), cy + r * Math.sin(a))); }
  return pts;
}
function kolam(g: IsoCtx, x: number, y: number, w: number, d: number) {
  const { iso, up, poly, box } = K(g);
  const outer = rr(g, x + 0.04, y + 0.04, x + w - 0.04, y + d - 0.04, 0.7), inner = rr(g, x + 0.42, y + 0.42, x + w - 0.42, y + d - 0.42, 0.45);
  let s = `<polygon points="${P(outer.map((q) => [q[0], q[1] + 16]))}" fill="${INK}" opacity=".12"/>`;
  s += poly(outer.map((q) => [q[0], q[1] + 8 * S]), '#B3A893', 2) + poly(outer, '#DCD3C2', 2);
  for (let k = 0; k < outer.length; k += 2) { const a = outer[k], b = inner[Math.min(inner.length - 1, k)]; s += `<ellipse cx="${f1(a[0] * 0.55 + b[0] * 0.45)}" cy="${f1(a[1] * 0.55 + b[1] * 0.45)}" rx="5" ry="2.6" fill="${k % 4 ? '#C9BEA9' : '#E8E0D1'}" stroke="#8E8576" stroke-width=".8"/>`; }
  s += poly(inner, '#3F7E9E', 1.8);
  s += `<clipPath id="kolam-air"><polygon points="${P(inner)}"/></clipPath><g clip-path="url(#kolam-air)"><polygon points="${P(inner.map((q) => [q[0], q[1] + 7]))}" fill="#6EB7D6"/>`;
  for (const [fx, fy, r] of [[1.6, 1.9, 1], [3.4, 2.5, -1], [4.6, 1.5, 1], [2.6, 1.2, -1]] as [number, number, number][]) { const q = iso(x + fx, y + fy); s += `<g transform="translate(${f1(q[0])} ${f1(q[1] + 7)}) scale(${r} 1)" opacity=".28"><ellipse rx="11" ry="4.5" fill="${INK}"/><path d="M9 0l8 -5v10Z" fill="${INK}"/></g>`; }
  for (const [fx, fy] of [[1.2, 2.6], [3.0, 1.6], [4.4, 2.8], [2.2, 3.1], [5.0, 1.0]]) { const q = iso(x + fx, y + fy); s += `<path class="riak" d="M${f1(q[0] - 9)} ${f1(q[1] + 7)}q9 -5 18 0" stroke="#FFFFFF" stroke-width="2" fill="none" opacity=".8"/>`; }
  for (const [fx, fy, k] of [[0.9, 1.1, 1], [5.2, 3.0, 0], [3.9, 3.3, 1]] as [number, number, number][]) { const q = iso(x + fx, y + fy); s += `<path d="M${f1(q[0])} ${f1(q[1] + 6)}l11 -1.5a11 5.5 0 1 1 0 3Z" fill="#4FA36A" stroke="${INK}" stroke-width="1.1"/>` + (k ? `<circle cx="${f1(q[0] - 3)}" cy="${f1(q[1] + 3)}" r="3.4" fill="#FF8FA3" stroke="${INK}" stroke-width="1"/>` : ''); }
  s += `</g>`;
  const plank = (a: number[], b: number[]) => `<path d="M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}" stroke="#8A5A36" stroke-width="1"/>`;
  for (const px of POND_PIERS.back) {
    const sx = x + px;
    s += box(sx - 0.34, y + 0.1, 0, 0.68, 0.8, 4, C3('#B9804A'), 1.4);
    for (const u of [0.17, 0.34, 0.51]) s += plank(up(iso(sx - 0.34 + u, y + 0.1), 4), up(iso(sx - 0.34 + u, y + 0.9), 4));
    s += box(sx - 0.13, y + 0.35, 4, 0.26, 0.26, 7, C3('#3F7FBF'), 1.2);
  }
  for (const py of POND_PIERS.left) {
    const sy = y + py;
    s += box(x + 0.1, sy - 0.34, 0, 0.8, 0.68, 4, C3('#B9804A'), 1.4);
    for (const u of [0.17, 0.34, 0.51]) s += plank(up(iso(x + 0.1, sy - 0.34 + u), 4), up(iso(x + 0.9, sy - 0.34 + u), 4));
    s += box(x + 0.35, sy - 0.13, 4, 0.26, 0.26, 7, C3('#E0583F'), 1.2);
  }
  return s;
}

/** Papan Lomba Mancing (1×1). Sebelum alur mancing bareng tersambung papan bertuliskan "SEGERA". */
function papanLomba(g: IsoCtx, x: number, y: number) {
  const { iso, up, box, quadY, textY } = K(g);
  const Y = y + 0.62;
  let s = box(x + 0.16, Y - 0.06, 0, 0.1, 0.1, 58, C3('#8A5A36')) + box(x + 0.78, Y - 0.06, 0, 0.1, 0.1, 58, C3('#8A5A36'));
  // papan lebih lebar dari tiangnya supaya "MANCING" muat (di mockup terpotong)
  s += quadY(Y, x - 0.17, x + 1.21, 38, 106, '#FFF4D6', 2) + quadY(Y, x - 0.17, x + 1.21, 86, 106, '#E0583F', 2);
  s += textY(x + 0.52, Y, 96, 'LOMBA', 11, '#FFFDF7', 1.38);
  s += textY(x + 0.52, Y, 76, 'MANCING', 9.5, INK, 1.38);
  s += textY(x + 0.52, Y, 60, LOMBA_SIAP ? 'tiap 20 mnt' : 'SEGERA', LOMBA_SIAP ? 8.5 : 10, '#1E7A4C', 1.38);
  const q = up(iso(x + 0.52, Y), 47);
  return s + `<g transform="matrix(0.894 0.447 0 1 ${f1(q[0])} ${f1(q[1])}) scale(.5)"><path d="M10 0L20 -7V7Z" fill="#E0583F" stroke="${INK}" stroke-width="2"/><ellipse cx="-2" cy="0" rx="13" ry="7" fill="#F2994A" stroke="${INK}" stroke-width="2.2"/><circle cx="-9" cy="-1" r="1.8" fill="${INK}"/></g>`;
}

/** pusat roda bianglala (layar) & jari-jari gondola */
export const BIANG_HUB = (() => { const C = houseIso(BIANGLALA.x + 1.5, BIANGLALA.y + 1.5); return { x: C[0], y: C[1] - 150 * S, R: 86 * S }; })();
/** titik gantung gondola k pada `now` (layar) */
export function gondolaPos(now: number, k: number) {
  const a = (gondolaAngle(now, k) * Math.PI) / 180;
  return { x: BIANG_HUB.x + BIANG_HUB.R * Math.cos(a), y: BIANG_HUB.y + BIANG_HUB.R * Math.sin(a) };
}
/** gondola (titik gantung di 0,0) */
export function gondolaSVG(k: number) {
  const c = GONDOLA_COLORS[k % 6], g = (dx: number, dy: number) => `${f1(dx * S)} ${f1(dy * S)}`;
  return `<path d="M${g(0, 0)}L${g(0, 9)}" stroke="${INK}" stroke-width="2.4"/><path d="M${g(-19, 16)}L${g(-19, 36)}M${g(19, 16)}L${g(19, 36)}" stroke="${INK}" stroke-width="2.2"/>`
    + `<path d="M${g(-25, 34)}H${f1(25 * S)}V${f1(44 * S)}Q${g(25, 58)} ${g(0, 58)}Q${g(-25, 58)} ${g(-25, 44)}Z" fill="${c}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/><path d="M${g(-22, 41)}H${f1(22 * S)}" stroke="#FFFDF7" stroke-width="2.2" opacity=".9"/>`
    + `<path d="M${g(-25, 18)}Q${g(-25, 6)} ${g(0, 6)}Q${g(25, 6)} ${g(25, 18)}Z" fill="${shade(c, 0.35)}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><circle cx="0" cy="${f1(6 * S)}" r="2.4" fill="#F2B632" stroke="${INK}" stroke-width="1"/>`;
}
/** roda (berpusat di 0,0): jari-jari, lingkar, bohlam; diputar lewat transform oleh layar alun-alun */
function wheelSVG(R: number, bright = false) {
  let spokes = '';
  for (let k = 0; k < 12; k++) { const a = (k * 30 * Math.PI) / 180; spokes += `<path d="M0 0L${f1(R * Math.cos(a))} ${f1(R * Math.sin(a))}" stroke="${INK}" stroke-width="3.6"/><path d="M0 0L${f1(R * Math.cos(a))} ${f1(R * Math.sin(a))}" stroke="#FFFDF7" stroke-width="1.6"/>`; }
  let zig = 'M';
  for (let k = 0; k <= 24; k++) { const a = (k * 15 * Math.PI) / 180, r = k % 2 ? R * 0.78 : R; zig += `${k ? 'L' : ''}${f1(r * Math.cos(a))} ${f1(r * Math.sin(a))}`; }
  const rim = (r: number, col: string, w: number) => `<circle r="${f1(r)}" fill="none" stroke="${INK}" stroke-width="${f1(w + 3)}"/><circle r="${f1(r)}" fill="none" stroke="${col}" stroke-width="${f1(w)}"/>`;
  let bulbs = '';
  for (let k = 0; k < 24; k++) { const a = ((k * 15 + 7.5) * Math.PI) / 180; bulbs += circ(R * Math.cos(a), R * Math.sin(a), bright ? 3 : 2.4, k % 2 ? '#FFE07A' : '#FFFFFF', 0.8); }
  if (bright) return bulbs;
  return spokes + `<path d="${zig}" fill="none" stroke="#FFFDF7" stroke-width="1.6" opacity=".95"/>` + rim(R * 0.78, '#F2B632', 2.6) + rim(R, '#E0583F', 5.4) + bulbs;
}
/** Bianglala (3×3): kaki, roda berputar (class bl-wheel), 6 gondola (class bl-gon, data-k) yang selalu tegak. */
function bianglala(g: IsoCtx, x: number, y: number) {
  const { iso, box } = K(g);
  const C = iso(x + 1.5, y + 1.5), Hb = [C[0], C[1] - 150 * S], R = 86 * S;
  const LF = iso(x + 1.5 - 1.08, y + 1.5 + 1.08), RF = iso(x + 1.5 + 1.08, y + 1.5 - 1.08);
  const off = [12, -7], H2 = [Hb[0] + off[0], Hb[1] + off[1]];
  let s = `<ellipse cx="${f1(C[0])}" cy="${f1(C[1] + 4)}" rx="96" ry="40" fill="${INK}" opacity=".12"/>`;
  s += box(x + 0.22, y + 0.22, 0, 2.56, 2.56, 8, C3('#DCD3C2')) + box(x + 1.05, y + 2.78, 0, 0.9, 0.3, 4, C3('#C9BEA9'), 1.2);
  s += line2(H2, [LF[0] + off[0], LF[1] + off[1] - 8 * S], shade('#3F7FBF', -0.25), 5) + line2(H2, [RF[0] + off[0], RF[1] + off[1] - 8 * S], shade('#3F7FBF', -0.25), 5) + line2(Hb, H2, '#9AA7B8', 4);
  const now = Date.now();
  s += `<g class="bl-wheel" transform="translate(${f1(Hb[0])} ${f1(Hb[1])}) rotate(${f1(gondolaAngle(now, 0) % 360)})">${wheelSVG(R)}</g>`;
  s += circ(Hb[0], Hb[1], 15 * S, '#F2B632', 2.2) + `<path d="M${f1(Hb[0])} ${f1(Hb[1] - 9)}l2.6 6l6.4 .6l-4.9 4.2l1.5 6.2l-5.6 -3.3l-5.6 3.3l1.5 -6.2l-4.9 -4.2l6.4 -.6Z" fill="#E0583F" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`;
  s += line2(Hb, [LF[0], LF[1] - 8 * S], '#3F7FBF', 5.4) + line2(Hb, [RF[0], RF[1] - 8 * S], '#3F7FBF', 5.4) + line2([Hb[0] - 30, Hb[1] + 78], [Hb[0] + 30, Hb[1] + 78], '#3F7FBF', 3);
  for (let k = 0; k < 6; k++) { const a = (gondolaAngle(now, k) * Math.PI) / 180; s += `<g class="bl-gon" data-k="${k}" transform="translate(${f1(Hb[0] + R * Math.cos(a))} ${f1(Hb[1] + R * Math.sin(a))})">${gondolaSVG(k)}</g>`; }
  return s;
}

/** Lempar Gelang (2×2): rak botol bertingkat, meja depan bergaris, atap kain, papan nama dua baris. */
function lemparGelang(g: IsoCtx, x: number, y: number) {
  const { iso, up, poly, box, quadY, textY } = K(g);
  const post = (px: number, py: number) => box(px - 0.05, py - 0.05, 0, 0.1, 0.1, 100, C3('#8A5A36'), 1.2);
  let s = post(x + 0.14, y + 0.14) + post(x + 1.86, y + 0.14);
  s += quadY(y + 0.14, x + 0.18, x + 1.82, 8, 96, '#FFF4D6', 1.6);
  for (let k = 0; k < 6; k++) s += quadY(y + 0.15, x + 0.18 + k * 0.28, x + 0.32 + k * 0.28, 8, 96, '#F7D9A0', 0.6);
  const bottle = (bx: number, by: number, z: number, c: string, ring?: string) => {
    const q = up(iso(bx, by), z);
    return `<g transform="translate(${f1(q[0])} ${f1(q[1])})"><path d="M-4 0V-11q0 -3 2 -4V-19h4V-15q2 1 2 4V0Z" fill="${c}" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/><path d="M-2 -10v7" stroke="#FFFFFF" stroke-width="1.4" opacity=".8"/>${ring ? `<ellipse cx="0" cy="-15" rx="6" ry="2.4" fill="none" stroke="${INK}" stroke-width="3.4"/><ellipse cx="0" cy="-15" rx="6" ry="2.4" fill="none" stroke="${ring}" stroke-width="1.8"/>` : ''}</g>`;
  };
  const bc = ['#5FB36A', '#7FC4E8', '#F2994A', '#D97BA6', '#9A6FC0'];
  for (let t = 0; t < 3; t++) {
    const yy = y + 0.2 + t * 0.34, h = 44 - t * 12;
    s += box(x + 0.22, yy, 0, 1.56, 0.34, h, C3('#B9804A'), 1.3);
    for (let k = 0; k < 5; k++) s += bottle(x + 0.38 + k * 0.31, yy + 0.17, h, bc[(k + t) % 5], (k + t * 2) % 4 === 1 ? ['#E0583F', '#F2B632', '#3F7FBF'][t] : undefined);
  }
  s += box(x + 0.1, y + 1.3, 0, 1.8, 0.5, 30, C3('#FFFDF7'));
  for (let k = 0; k < 6; k++) s += quadY(y + 1.8, x + 0.1 + k * 0.3, x + 0.25 + k * 0.3, 0, 30, '#E0583F', 0.6);
  const q = up(iso(x + 1.55, y + 1.55), 30);
  s += `<g transform="translate(${f1(q[0])} ${f1(q[1])})"><path d="M0 0V-16" stroke="#8A5A36" stroke-width="3"/>${[0, 1, 2, 3].map((k) => `<ellipse cx="0" cy="${-2 - k * 3.2}" rx="8" ry="3" fill="none" stroke="${INK}" stroke-width="3.6"/><ellipse cx="0" cy="${-2 - k * 3.2}" rx="8" ry="3" fill="none" stroke="${['#E0583F', '#F2B632', '#3FA06A', '#3F7FBF'][k]}" stroke-width="2"/>`).join('')}</g>`;
  s += post(x + 0.14, y + 1.86) + post(x + 1.86, y + 1.86);
  const A = up(iso(x + 0.02, y + 0.04), 108), B = up(iso(x + 1.98, y + 0.04), 108), Cc = up(iso(x + 1.98, y + 2.0), 98), D = up(iso(x + 0.02, y + 2.0), 98);
  s += poly([A, B, Cc, D], '#F2B632', 1.8);
  const L = (t: number, a: number[], b: number[]) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  for (let k = 0; k < 7; k += 2) s += `<polygon points="${P([L(k / 7, A, B), L((k + 1) / 7, A, B), L((k + 1) / 7, D, Cc), L(k / 7, D, Cc)])}" fill="#E0583F"/>`;
  s += poly([A, B, Cc, D], 'none', 1.8);
  for (let k = 0; k < 7; k++) { const a = L(k / 7, D, Cc), b = L((k + 1) / 7, D, Cc); s += `<path d="M${f1(a[0])} ${f1(a[1])}Q${f1((a[0] + b[0]) / 2)} ${f1((a[1] + b[1]) / 2 + 9)} ${f1(b[0])} ${f1(b[1])}Z" fill="${k % 2 ? '#E0583F' : '#F2B632'}" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`; }
  // papan nama dua baris (satu baris tidak muat di atas atap)
  s += box(x + 0.5, y + 1.96, 98, 0.06, 0.06, 12, C3('#8A5A36'), 1) + box(x + 1.44, y + 1.96, 98, 0.06, 0.06, 12, C3('#8A5A36'), 1);
  s += quadY(y + 2.0, x + 0.2, x + 1.8, 108, 140, '#FFFDF7', 1.8);
  return s + textY(x + 1.0, y + 2.0, 131, 'LEMPAR', 10, '#C0392B', 1.6) + textY(x + 1.0, y + 2.0, 117, 'GELANG', 10, '#C0392B', 1.6);
}

/** Halte Kereta Kelinci (1×3 sepanjang y) di tepi timur, menghadap rel. */
function halte(g: IsoCtx, x: number, y: number) {
  const { iso, up, box, quadX, textX } = K(g);
  let s = box(x + 0.04, y + 0.04, 0, 0.92, 2.92, 10, C3('#DCD3C2'));
  s += `<polygon points="${P([up(iso(x + 0.8, y + 0.06), 10), up(iso(x + 0.92, y + 0.06), 10), up(iso(x + 0.92, y + 2.94), 10), up(iso(x + 0.8, y + 2.94), 10)])}" fill="#F2B632"/>`;
  const post = (px: number, py: number) => box(px - 0.05, py - 0.05, 10, 0.1, 0.1, 92, C3('#3FA06A'), 1.2);
  s += post(x + 0.12, y + 0.25) + post(x + 0.12, y + 2.75);
  s += quadX(x + 0.1, y + 0.3, y + 2.7, 10, 80, '#FFF4D6', 1.8);
  const m = (yy: number, v: number) => up(iso(x + 0.11, yy), v);
  let route = '';
  for (let k = 0; k <= 24; k++) { const a = (k / 24) * Math.PI * 2, q = m(y + 1.5 + Math.cos(a) * 0.85, 54 + Math.sin(a) * 16); route += (k ? 'L' : 'M') + f1(q[0]) + ' ' + f1(q[1]); }
  s += `<path d="${route}Z" fill="none" stroke="#E0583F" stroke-width="2.4"/>` + circ(m(y + 2.25, 42)[0], m(y + 2.25, 42)[1], 3.2, '#3FA06A', 1);
  s += textX(x + 0.11, y + 1.5, 24, 'RUTE KELILING', 7, INK, 2.2, 700);
  s += box(x + 0.14, y + 0.55, 10, 0.26, 1.9, 13, C3('#B9804A'), 1.3);
  s += post(x + 0.55, y + 0.25) + post(x + 0.55, y + 2.75);
  s += box(x - 0.04, y + 0.12, 102, 0.7, 2.76, 8, C3('#C0392B'));
  for (let k = 1; k < 6; k++) { const a = up(iso(x - 0.04, y + 0.12 + k * 0.46), 110), b = up(iso(x + 0.66, y + 0.12 + k * 0.46), 110); s += `<path d="M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}" stroke="${shade('#C0392B', -0.3)}" stroke-width="1.2"/>`; }
  s += box(x + 0.28, y + 0.9, 110, 0.08, 0.08, 8, C3('#8A5A36'), 1) + box(x + 0.28, y + 2.02, 110, 0.08, 0.08, 8, C3('#8A5A36'), 1);
  s += quadX(x + 0.32, y + 0.7, y + 2.3, 117, 137, '#3FA06A', 1.8) + textX(x + 0.32, y + 1.5, 127, 'HALTE', 12.5, '#FFFDF7', 1.6);
  const e = up(iso(x + 0.32, y + 1.5), 137);
  return s + `<g transform="translate(${f1(e[0])} ${f1(e[1])})"><path d="M-9 -2Q-15 -30 -7 -34Q0 -30 -3 -2Z" fill="#FFFDF7" stroke="${INK}" stroke-width="2"/><path d="M3 -2Q2 -32 10 -33Q17 -28 9 -2Z" fill="#FFFDF7" stroke="${INK}" stroke-width="2"/><path d="M-7 -6Q-10 -24 -7 -28M7 -6Q8 -24 10 -27" stroke="#F7A8C4" stroke-width="3" stroke-linecap="round"/></g>`;
}

/** Gapura Pojok Wahana (1×4 sepanjang y): dua tiang di ujung, lengkung bertulisan di atas jalan. */
function gapura(g: IsoCtx, x: number, y: number) {
  const { iso, up, box, textX } = K(g);
  const X = x + 0.48;
  let s = box(x + 0.3, y + 0.3, 0, 0.36, 0.36, 118, C3('#C0392B')) + box(x + 0.22, y + 0.22, 0, 0.52, 0.52, 14, C3('#DCD3C2'));
  const pt = (yy: number, v: number) => up(iso(X, yy), v);
  const ya = y + 0.48, yb = y + 3.52;
  let top = '', bot = '';
  for (let k = 0; k <= 16; k++) { const t = k / 16, yy = ya + (yb - ya) * t, arch = Math.sin(t * Math.PI) * 14; const a = pt(yy, 128 + arch), b = pt(yy, 108 + arch * 0.6); top += (k ? 'L' : 'M') + f1(a[0]) + ' ' + f1(a[1]); bot = 'L' + f1(b[0]) + ' ' + f1(b[1]) + bot; }
  s += `<path d="${top}${bot}Z" fill="#F2B632" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`;
  // tulisan di bagian lengkung yang paling tinggi (sepanjang ±2,3 petak dari 3 petak lengkung)
  s += textX(X, y + 2, 125, 'POJOK WAHANA', 11.5, '#C0392B', 2.6);
  for (let k = 0; k < 7; k++) { const t = (k + 0.5) / 7, yy = ya + (yb - ya) * t, arch = Math.sin(t * Math.PI) * 14, a = pt(yy, 108 + arch * 0.6); s += `<path d="M${f1(a[0] - 4)} ${f1(a[1])}l4 9l4 -9Z" fill="${['#E0583F', '#3FA06A', '#3F7FBF', '#FFFDF7'][k % 4]}" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>`; }
  s += box(x + 0.3, y + 3.34, 0, 0.36, 0.36, 118, C3('#C0392B')) + box(x + 0.22, y + 3.26, 0, 0.52, 0.52, 14, C3('#DCD3C2'));
  for (const yy of [ya, yb]) { const q = pt(yy, 118); s += circ(q[0], q[1] - 10, 8, '#F2B632', 1.8); }
  return s;
}

/** film kartun pendek (bingkai lokal 120 × 72); judul di pita yang lebarnya mengikuti tulisan */
export function filmFrame(i: number) {
  const pets: [PetLook, PetLook][] = [
    [{ color: '#C9B6E8', ear: 'tunas', eyes: 'senyum' } as PetLook, { color: '#9FD0E8', ear: 'kucing', pattern: 'totol' } as PetLook],
    [{ color: '#F6B7A8', ear: 'kelinci', eyes: 'bulat' } as PetLook, { color: '#F4D58D', ear: 'bulat' } as PetLook],
    [{ color: '#9FD3C2', ear: 'kelinci' } as PetLook, { color: '#E7A6C8', ear: 'tunas' } as PetLook],
  ][i % 3];
  const title = FILMS[i % FILMS.length];
  const sky = ['#BFE6F7', '#FFE3B8', '#C9E7F2'][i % 3];
  let o = `<rect width="120" height="72" fill="${sky}"/><circle cx="96" cy="16" r="9" fill="#FFF4C8" stroke="${INK}" stroke-width="1"/><circle cx="20" cy="10" r="1.2" fill="#fff"/><circle cx="40" cy="20" r="1" fill="#fff"/><circle cx="70" cy="8" r="1.2" fill="#fff"/>`;
  o += i % 3 === 2 ? `<path d="M0 50Q30 44 60 50T120 48V72H0Z" fill="#6EB7D6" stroke="${INK}" stroke-width="1"/><g class="ride"><path d="M58 56q6 -6 12 0q-6 6 -12 0Z" fill="#F2994A" stroke="${INK}" stroke-width=".8"/><path d="M70 56l5 -3v6Z" fill="#F2994A" stroke="${INK}" stroke-width=".8"/></g>`
    : `<path d="M0 58Q30 44 60 54T120 50V72H0Z" fill="#8CC56E" stroke="${INK}" stroke-width="1"/>`;
  o += i % 3 === 1 ? `<g class="ride"><path d="M60 10l8 8l-8 8l-8 -8Z" fill="#E0583F" stroke="${INK}" stroke-width="1"/><path d="M60 26q-4 12 4 22" stroke="${INK}" stroke-width=".8" fill="none"/></g>`
    : i % 3 === 0 ? `<g class="ride"><path d="M64 20q-2 10 2 22" stroke="${INK}" stroke-width=".8" fill="none"/><ellipse cx="63" cy="16" rx="7" ry="8.4" fill="#E0583F" stroke="${INK}" stroke-width="1"/><path d="M60 13q2 -3 4 -3" stroke="#fff" stroke-width="1.2" fill="none"/></g>` : '';
  o += `<g transform="translate(46 60) scale(.2)">${renderPet(pets[0], [], { mood: 'senang' })}</g><g transform="translate(76 58) scale(.2) scale(-1 1)">${renderPet(pets[1], [], { mood: 'senang' })}</g>`;
  const tw = textW(title, 6), bw = tw + 8;
  o += `<rect x="4" y="61" width="${f1(bw)}" height="9" rx="2" fill="${INK}" opacity=".7"/><text x="${f1(4 + bw / 2)}" y="65.5" dy=".35em" text-anchor="middle" ${FONT} font-weight="800" font-size="6" fill="#FFFDF7" data-fit="${f1(bw - 3)}">${title.replace('&', '&amp;')}</text>`;
  return o;
}
/** Layar Tancap (3×1). Siang: layar tergulung + papan jadwal; malam: layar terbentang (isi film digambar di lapisan terang). */
function layarTancap(g: IsoCtx, x: number, y: number, night: boolean) {
  const { iso, up, box, quadY, textY } = K(g);
  const Y = y + 0.5;
  let s = '';
  const pole = (px: number) => box(px - 0.06, Y - 0.06, 0, 0.12, 0.12, 156, C3('#D9B26A'), 1.4);
  for (const [px, dx] of [[x + 0.15, -0.55], [x + 2.85, 0.55]] as [number, number][]) { const a = up(iso(px, Y), 150), b = iso(px + dx, Y + 0.7); s += `<path d="M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}" stroke="${INK}" stroke-width="1" opacity=".6"/>`; }
  s += pole(x + 0.15) + pole(x + 2.85);
  const t = up(iso(x + 0.15, Y), 150);
  s += `<path d="M${f1(t[0])} ${f1(t[1])}l-16 -8v18Z" fill="#9AA7B8" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><ellipse cx="${f1(t[0] - 16)}" cy="${f1(t[1] + 1)}" rx="3.4" ry="9" fill="#C9D1DC" stroke="${INK}" stroke-width="1.6"/>`;
  if (!night) {
    const A = up(iso(x + 0.25, Y), 150), B = up(iso(x + 2.75, Y), 150);
    s += `<path d="M${f1(A[0])} ${f1(A[1])}L${f1(B[0])} ${f1(B[1])}" stroke="${INK}" stroke-width="12" stroke-linecap="round"/><path d="M${f1(A[0])} ${f1(A[1])}L${f1(B[0])} ${f1(B[1])}" stroke="#FFFDF7" stroke-width="8.6" stroke-linecap="round"/>`;
    // papan jadwal: dua baris pendek supaya muat (dulu "nanti malam 19.00" terpotong)
    s += quadY(Y, x + 0.45, x + 2.55, 66, 106, '#2B2F4A', 1.6) + textY(x + 1.5, Y, 95, 'LAYAR TANCAP', 9.5, '#F2B632', 2.1) + textY(x + 1.5, Y, 77, 'malam, 19.00', 8.5, '#FFFDF7', 2.1, 700);
    return s;
  }
  return s + quadY(Y, x + 0.25, x + 2.75, 44, 146, '#2B2F4A', 2) + quadY(Y, x + 0.33, x + 2.67, 50, 140, '#FFFDF7', 1.2);
}
/** isi layar (film) dipetakan ke bidang layar; dipakai lapisan terang malam */
export function layarFilmSVG(film: number, x = 13, y = 0) {
  const tl = H0.up(houseIso(x + 0.33, y + 0.5), 140), wTiles = 2.34, Hpx = 90 * S;
  return `<g transform="matrix(${f1(((T * wTiles) / 120) * 100) / 100} ${f1(((HT * wTiles) / 120) * 100) / 100} 0 ${f1((Hpx / 72) * 1000) / 1000} ${f1(tl[0])} ${f1(tl[1])})">${filmFrame(film)}</g>`;
}
/** sorotan proyektor ke layar (malam) */
export function proyektorBeam(px = 14, py = 4, x = 13, y = 0) {
  const L = H0.up(houseIso(px + 0.45, py + 0.3), 34), Y = y + 0.5;
  const a = H0.up(houseIso(x + 0.33, Y), 140), b = H0.up(houseIso(x + 2.67, Y), 140), c = H0.up(houseIso(x + 2.67, Y), 50), d = H0.up(houseIso(x + 0.33, Y), 50);
  return `<polygon points="${P([L, a, b, c, d])}" fill="#FFF4C8" opacity=".16"/><polygon points="${P([L, a, d])}" fill="#FFF4C8" opacity=".1"/>` + circ(L[0], L[1], 3.4, '#FFF4C8', 1);
}
function proyektor(g: IsoCtx, x: number, y: number, night: boolean) {
  if (!night) return '';
  const { iso, up, box } = K(g);
  let s = box(x + 0.25, y + 0.25, 0, 0.5, 0.5, 26, C3('#8A5A36'), 1.4) + box(x + 0.3, y + 0.3, 26, 0.4, 0.4, 14, C3('#3B3F55'), 1.4);
  const q = up(iso(x + 0.5, y + 0.4), 40);
  return s + circ(q[0] - 7, q[1] - 10, 7, '#9AA7B8', 1.4) + circ(q[0] + 8, q[1] - 12, 8, '#9AA7B8', 1.4) + `<circle cx="${f1(q[0] - 7)}" cy="${f1(q[1] - 10)}" r="2" fill="${INK}"/><circle cx="${f1(q[0] + 8)}" cy="${f1(q[1] - 12)}" r="2" fill="${INK}"/>`;
}
function tikar(g: IsoCtx, x: number, y: number, w: number, d: number, night: boolean) {
  if (!night) return '';
  const q = (a: number, b: number) => g.iso(x + a, y + b);
  let s = K(g).poly([q(0.08, 0.08), q(w - 0.08, 0.08), q(w - 0.08, d - 0.08), q(0.08, d - 0.08)], '#E9C987', 1.6);
  for (let k = 1; k < w * 3; k++) { const a = q(k / 3, 0.1), b = q(k / 3, d - 0.1); s += `<path d="M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}" stroke="${k % 3 ? '#D4AE62' : '#C0392B'}" stroke-width="${k % 3 ? 1 : 2}"/>`; }
  return s;
}

/* ================================================================== */
/* Ondel-ondel (orisinal: wajah bulat ramah, baju bermotif, mahkota     */
/* bunga kertas warna-warni)                                             */
/* ================================================================== */
export const ONDEL = [
  { face: '#E8704F', hair: '#2B2F4A', top: '#C0392B', dress: '#2F8F83', band: '#F2B632', sash: '#F2B632', dots: '#BFE9DF', lips: '#9E2F22', stache: true },
  { face: '#FBE3C8', hair: '#2B2F4A', top: '#F2B632', dress: '#D24D7A', band: '#3FA06A', sash: '#3F7FBF', dots: '#FFD3E2', lips: '#E0583F', stache: false },
];
/** ondel-ondel berdiri di titik layar (X, Y) */
export function ondelSVG(X: number, Y: number, which: number, o: { scale?: number; tilt?: number; cls?: string } = {}) {
  const v = ONDEL[which % 2], k = (o.scale ?? 1) * S;
  let s = `<g transform="translate(${f1(X)} ${f1(Y)}) scale(${f1(k * 100) / 100})${o.tilt ? ` rotate(${o.tilt})` : ''}"><g${o.cls ? ` class="${o.cls}"` : ''}>`;
  s += `<ellipse cx="0" cy="0" rx="36" ry="9" fill="${INK}" opacity=".16"/><ellipse cx="-10" cy="-3" rx="7" ry="4" fill="${INK}"/><ellipse cx="10" cy="-3" rx="7" ry="4" fill="${INK}"/>`;
  const skirt = 'M-24 -104Q-30 -50 -38 -12Q-28 -4 -19 -10Q-10 -3 0 -10Q10 -3 19 -10Q28 -4 38 -12Q30 -50 24 -104Z';
  const cid = `ondel-${which % 2}`;
  s += `<clipPath id="${cid}"><path d="${skirt}"/></clipPath><path d="${skirt}" fill="${v.dress}"/><g clip-path="url(#${cid})">`;
  for (let r = 0; r < 4; r++) for (let c = -4; c <= 4; c++) s += `<circle cx="${c * 9 + (r % 2) * 4.5}" cy="${-92 + r * 11}" r="2" fill="${v.dots}"/>`;
  let tri = 'M-44 -48';
  for (let c = 0; c < 11; c++) tri += `L${-44 + c * 8 + 4} -60L${-44 + (c + 1) * 8} -48`;
  s += `<path d="${tri}V-42H-44Z" fill="${v.band}" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/><rect x="-44" y="-38" width="88" height="8" fill="${v.top}"/><path d="M-44 -26H44" stroke="${v.band}" stroke-width="3" stroke-dasharray="6 4"/>`;
  s += `</g><path d="${skirt}" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>`;
  s += `<path d="M-26 -104Q-30 -132 -16 -142H16Q30 -132 26 -104Z" fill="${v.top}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>`;
  s += `<path d="M-20 -140L22 -106L16 -100L-24 -132Z" fill="${v.sash}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M18 -104q8 12 2 26l-6 -2q4 -12 -2 -20Z" fill="${v.sash}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`;
  s += `<path d="M-15 -142Q0 -128 15 -142" fill="none" stroke="${INK}" stroke-width="5"/><path d="M-15 -142Q0 -128 15 -142" fill="none" stroke="#F2B632" stroke-width="3" stroke-dasharray="1 4" stroke-linecap="round"/>`;
  s += `<path d="M-24 -136Q-38 -118 -36 -84L-27 -82Q-27 -110 -18 -126Z" fill="${v.top}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><circle cx="-32" cy="-80" r="6" fill="${v.face}" stroke="${INK}" stroke-width="2"/>`;
  s += `<path d="M24 -136Q38 -118 36 -84L27 -82Q27 -110 18 -126Z" fill="${v.top}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><circle cx="32" cy="-80" r="6" fill="${v.face}" stroke="${INK}" stroke-width="2"/>`;
  const cols = ['#E0583F', '#F2B632', '#3FA06A', '#7FC4E8', '#F7A8C4', '#FFFDF7', '#9A6FC0'];
  for (let i = 0; i < 11; i++) {
    const a = ((-160 + i * 14) * Math.PI) / 180, r = 52 + (i % 2) * 12, bx = Math.cos(a) * 16, by = -206 + Math.sin(a) * 4, ex = Math.cos(a) * r * 0.9, ey = -196 + Math.sin(a) * r;
    s += `<path d="M${f1(bx)} ${f1(by)}Q${f1(ex * 0.4)} ${f1(ey + 24)} ${f1(ex)} ${f1(ey)}" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/><path d="M${f1(bx)} ${f1(by)}Q${f1(ex * 0.4)} ${f1(ey + 24)} ${f1(ex)} ${f1(ey)}" fill="none" stroke="${cols[(i + 2) % 7]}" stroke-width="1.2" stroke-linecap="round"/>`;
    s += `<g transform="translate(${f1(ex)} ${f1(ey)})">${[0, 72, 144, 216, 288].map((d) => `<ellipse cx="0" cy="-4" rx="2.6" ry="4" transform="rotate(${d})" fill="${cols[i % 7]}" stroke="${INK}" stroke-width="1"/>`).join('')}<circle r="2" fill="#F2B632" stroke="${INK}" stroke-width=".8"/></g>`;
  }
  s += `<path d="M-8 -146h16v8h-16Z" fill="${v.face}" stroke="${INK}" stroke-width="2"/><circle cx="0" cy="-178" r="33" fill="${v.face}" stroke="${INK}" stroke-width="2.8"/>`;
  s += `<path d="M-33 -182Q-32 -214 0 -214Q32 -214 33 -182Q26 -200 0 -202Q-26 -200 -33 -182Z" fill="${v.hair}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`;
  s += `<path d="M-30 -204Q0 -222 30 -204L28 -196Q0 -212 -28 -196Z" fill="#F2B632" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>${[-18, 0, 18].map((x) => `<circle cx="${x}" cy="${x ? -205 : -210}" r="2.6" fill="#E0583F" stroke="${INK}" stroke-width="1"/>`).join('')}`;
  s += `<circle cx="-34" cy="-170" r="4" fill="#F2B632" stroke="${INK}" stroke-width="1.6"/><circle cx="34" cy="-170" r="4" fill="#F2B632" stroke="${INK}" stroke-width="1.6"/>`;
  s += `<path d="M-20 -192q7 -5 13 -1M7 -193q7 -4 13 1" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  s += `<ellipse cx="-12" cy="-180" rx="7" ry="8" fill="#FFFFFF" stroke="${INK}" stroke-width="2"/><ellipse cx="12" cy="-180" rx="7" ry="8" fill="#FFFFFF" stroke="${INK}" stroke-width="2"/><circle cx="-11" cy="-179" r="4" fill="${INK}"/><circle cx="13" cy="-179" r="4" fill="${INK}"/><circle cx="-9.6" cy="-181" r="1.4" fill="#fff"/><circle cx="14.4" cy="-181" r="1.4" fill="#fff"/>`;
  s += `<ellipse cx="-22" cy="-164" rx="7" ry="4.4" fill="#FF8FA3" opacity=".75"/><ellipse cx="22" cy="-164" rx="7" ry="4.4" fill="#FF8FA3" opacity=".75"/><path d="M-3 -170q3 3 6 0" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  s += v.stache ? `<path d="M0 -164q-6 -5 -12 -1q-5 3 -9 -1q2 7 9 6q8 0 12 -4ZM0 -164q6 -5 12 -1q5 3 9 -1q-2 7 -9 6q-8 0 -12 -4Z" fill="${INK}"/><path d="M-6 -157q6 5 12 0" stroke="${v.lips}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
    : `<path d="M-7 -161q7 7 14 0q-7 3 -14 0Z" fill="${v.lips}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`;
  return s + '</g></g>';
}

/* ================================================================== */
/* Kereta Kelinci: tiap gerbong digambar di titik 0,0 lalu digeser     */
/* ================================================================== */
function wheels(x0: number, y0: number, w: number, d: number, alongY: boolean) {
  const { iso } = H0;
  let s = '';
  const ws = alongY ? [y0 + 0.3, y0 + d - 0.3].map((yy) => iso(x0 + w, yy)) : [x0 + 0.3, x0 + w - 0.3].map((xx) => iso(xx, y0 + d));
  for (const q of ws) s += circ(q[0], q[1] - 7 * S, 7.5 * S, '#3B3F55', 1.6) + `<circle cx="${f1(q[0])}" cy="${f1(q[1] - 7 * S)}" r="${f1(2.6 * S)}" fill="#C9A13B"/>`;
  return s;
}
/**
 * Satu gerbong di titik 0,0 (petak): part 'back' = lantai & dinding jauh (di belakang penumpang),
 * 'front' = dinding dekat, roda, atap (di depan penumpang). Lokomotif seluruhnya di 'front'.
 */
export function keretaCarSVG(i: number, alongY: boolean, fwd: boolean, part: 'back' | 'front') {
  const { iso, up, poly, box, quadX, quadY } = H0;
  const car = KERETA_CARS[i];
  const wd = 0.92;
  const [w, d] = alongY ? [wd, car.L] : [car.L, wd];
  const x0 = -w / 2, y0 = -d / 2, x1 = x0 + w, y1 = y0 + d;
  const shadow = `<polygon points="${P([iso(x0, y0), iso(x1, y0), iso(x1, y1), iso(x0, y1)].map((q) => [q[0], q[1] + 6]))}" fill="${INK}" opacity=".14"/>`;
  const chassis = box(x0 + 0.08, y0 + 0.08, 4, w - 0.16, d - 0.16, 8, C3('#3B3F55'), 1.3);
  if (car.k === 'engine') {
    if (part === 'back') return '';
    let s = shadow + chassis;
    const cab = alongY ? (fwd ? [x0, y0, w, d * 0.45] : [x0, y0 + d * 0.55, w, d * 0.45]) : (fwd ? [x0, y0, w * 0.45, d] : [x0 + w * 0.55, y0, w * 0.45, d]);
    const nose = alongY ? (fwd ? [x0 + 0.06, y0 + d * 0.45, w - 0.12, d * 0.55 - 0.04] : [x0 + 0.06, y0 + 0.04, w - 0.12, d * 0.55]) : (fwd ? [x0 + w * 0.45, y0 + 0.06, w * 0.55 - 0.04, d - 0.12] : [x0 + 0.04, y0 + 0.06, w * 0.55, d - 0.12]);
    const front = alongY ? (fwd ? iso(x0 + w / 2, y1 - 0.1) : iso(x0 + w / 2, y0 + 0.1)) : (fwd ? iso(x1 - 0.1, y0 + d / 2) : iso(x0 + 0.1, y0 + d / 2));
    const drawCab = () => box(cab[0], cab[1], 12, cab[2], cab[3], 46, C3('#F7A8C4')) + box(cab[0] - 0.06, cab[1] - 0.06, 58, cab[2] + 0.12, cab[3] + 0.12, 7, C3('#E0583F'))
      + (alongY ? quadX(cab[0] + cab[2], cab[1] + 0.12, cab[1] + cab[3] - 0.12, 32, 52, '#BFE6F7', 1.2) : quadY(cab[1] + cab[3], cab[0] + 0.12, cab[0] + cab[2] - 0.12, 32, 52, '#BFE6F7', 1.2));
    const drawNose = () => box(nose[0], nose[1], 12, nose[2], nose[3], 26, C3('#FFFDF7')) + (alongY ? quadX(nose[0] + nose[2], nose[1] + 0.05, nose[1] + nose[3] - 0.05, 18, 22, '#E0583F', 0.8) : quadY(nose[1] + nose[3], nose[0] + 0.05, nose[0] + nose[2] - 0.05, 18, 22, '#E0583F', 0.8));
    s += fwd ? drawCab() + drawNose() : drawNose() + drawCab();
    s += wheels(x0, y0, w, d, alongY);
    const hx = front[0], hy = front[1] - 52 * S;
    s += `<g transform="translate(${f1(hx)} ${f1(hy)})">`
      + `<path d="M-14 -14Q-24 -58 -11 -62Q-2 -58 -4 -16Z" fill="#FFFDF7" stroke="${INK}" stroke-width="2.4"/><path d="M5 -16Q4 -60 15 -62Q27 -56 14 -14Z" fill="#FFFDF7" stroke="${INK}" stroke-width="2.4"/><path d="M-12 -20Q-17 -48 -11 -54M8 -20Q8 -48 14 -53" stroke="#F7A8C4" stroke-width="4.4" stroke-linecap="round"/>`
      + `<ellipse cx="0" cy="0" rx="27" ry="23" fill="#FFFDF7" stroke="${INK}" stroke-width="2.6"/>`
      + `<ellipse cx="-10" cy="-4" rx="4" ry="5" fill="${INK}"/><ellipse cx="10" cy="-4" rx="4" ry="5" fill="${INK}"/><circle cx="-8.6" cy="-6" r="1.4" fill="#fff"/><circle cx="11.4" cy="-6" r="1.4" fill="#fff"/>`
      + `<ellipse cx="-17" cy="6" rx="5.5" ry="3.4" fill="#FF8FA3" opacity=".8"/><ellipse cx="17" cy="6" rx="5.5" ry="3.4" fill="#FF8FA3" opacity=".8"/>`
      + `<path d="M-3 3h6l-3 3.4Z" fill="#E0583F" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/><path d="M0 6.4q-3 4 -6 1.6M0 6.4q3 4 6 1.6" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`
      + `<path d="M-24 4h-10M-24 8l-9 3M24 4h10M24 8l9 3" stroke="${INK}" stroke-width="1.2" stroke-linecap="round"/>`
      + `<path d="M-10 22l-6 -6v12ZM10 22l6 -6v12Z" fill="#E0583F" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><circle cx="0" cy="22" r="3.4" fill="#F2B632" stroke="${INK}" stroke-width="1.4"/></g>`;
    return s + circ(front[0], front[1] - 20 * S, 4.4, '#FFE07A', 1.4);
  }
  const c = (car as { c: string }).c;
  const pole = (px: number, py: number) => box(px - 0.035, py - 0.035, 34, 0.07, 0.07, 58, C3('#FFFDF7'), 1);
  if (part === 'back') {
    return shadow + chassis + poly([up(iso(x0, y0), 12), up(iso(x1, y0), 12), up(iso(x1, y1), 12), up(iso(x0, y1), 12)], shade(c, -0.45), 1.4)
      + quadX(x0, y0, y1, 12, 34, shade(c, -0.32), 1.4) + quadY(y0, x0, x1, 12, 34, shade(c, -0.22), 1.4)
      + pole(x0 + 0.06, y0 + 0.06) + pole(x1 - 0.06, y0 + 0.06) + pole(x0 + 0.06, y1 - 0.06);
  }
  let s = quadY(y1, x0, x1, 12, 34, shade(c, -0.08), 1.6) + quadX(x1, y0, y1, 12, 34, shade(c, -0.25), 1.6);
  s += alongY ? quadX(x1, y0 + 0.06, y1 - 0.06, 21, 25, '#FFFDF7', 0.8) : quadY(y1, x0 + 0.06, x1 - 0.06, 21, 25, '#FFFDF7', 0.8);
  s += wheels(x0, y0, w, d, alongY) + pole(x1 - 0.06, y1 - 0.06);
  const e = 0.06, A = up(iso(x0 - e, y0 - e), 94), B = up(iso(x1 + e, y0 - e), 94), Cc = up(iso(x1 + e, y1 + e), 94), Dd = up(iso(x0 - e, y1 + e), 94);
  s += poly([A, B, Cc, Dd], '#FFFDF7', 1.8);
  const L = (t: number, a: number[], b: number[]) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const [a0, a1, b0, b1] = alongY ? [A, Dd, B, Cc] : [A, B, Dd, Cc];
  for (let k = 0; k < 6; k += 2) s += `<polygon points="${P([L(k / 6, a0, a1), L((k + 1) / 6, a0, a1), L((k + 1) / 6, b0, b1), L(k / 6, b0, b1)])}" fill="${c}"/>`;
  s += poly([A, B, Cc, Dd], 'none', 1.8);
  for (const [a, b] of [[Dd, Cc], [Cc, B]]) for (let k = 0; k < 4; k++) { const p = L(k / 4, a, b), q = L((k + 1) / 4, a, b); s += `<path d="M${f1(p[0])} ${f1(p[1])}Q${f1((p[0] + q[0]) / 2)} ${f1((p[1] + q[1]) / 2 + 7)} ${f1(q[0])} ${f1(q[1])}Z" fill="${k % 2 ? c : '#FFFDF7'}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`; }
  return s;
}

/* ================================================================== */
/* Untaian lampu, efek panggung, kembang api                            */
/* ================================================================== */
/** untaian bohlam antara dua titik layar (night: bohlam menyala) */
export function festoonSVG(a: number[], b: number[], night = false, sag = 26, n = 9) {
  const pt = (t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + Math.sin(t * Math.PI) * sag];
  let d = '';
  for (let k = 0; k <= 20; k++) { const p = pt(k / 20); d += (k ? 'L' : 'M') + f1(p[0]) + ' ' + f1(p[1]); }
  let s = night ? '' : `<path d="${d}" fill="none" stroke="${INK}" stroke-width="1.4"/>`;
  const cols = ['#E0583F', '#F2B632', '#3FA06A', '#7FC4E8', '#F7A8C4'];
  for (let k = 1; k < n; k++) { const p = pt(k / n); s += (night ? `<circle cx="${f1(p[0])}" cy="${f1(p[1] + 4)}" r="11" fill="url(#alun-glow)"/>` : '') + `<ellipse cx="${f1(p[0])}" cy="${f1(p[1] + 4)}" rx="3" ry="4" fill="${night ? '#FFE7A0' : cols[k % 5]}" stroke="${INK}" stroke-width="1"/>`; }
  return s;
}
/** kepala lampu taman (layar) untuk untaian lampu */
export const lampHead = (x: number, y: number) => H0.up(houseIso(x + 0.5, y + 0.5), 98);
/** gelembung tulisan (panggung): lebar mengikuti tulisan */
export function speechSVG(x: number, y: number, txt: string, o: { size?: number; color?: string; tail?: 'l' | 'r' | 'c'; rot?: number; cls?: string; delay?: number } = {}) {
  const size = o.size ?? 14, w = textW(txt, size) + 18, h = size + 10;
  const tx = o.tail === 'l' ? -w / 2 + 12 : o.tail === 'r' ? w / 2 - 12 : 0;
  return `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${o.rot ?? 0})"><g${o.cls ? ` class="${o.cls}" style="animation-delay:${o.delay ?? 0}s"` : ''}><path d="M${f1(-w / 2)} ${f1(-h)}h${f1(w)}q6 0 6 6v${f1(h - 12)}q0 6 -6 6H${f1(tx + 6)}l-6 8l-4 -8H${f1(-w / 2)}q-6 0 -6 -6v${f1(-(h - 12))}q0 -6 6 -6Z" fill="#FFFDF7" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`
    + `<text x="0" y="${f1(-h / 2 + 2)}" text-anchor="middle" dy=".35em" ${FONT} font-weight="800" font-size="${size}" fill="${o.color ?? '#E0583F'}" data-fit="${f1(w - 4)}">${txt}</text></g></g>`;
}
export const swooshSVG = (x: number, y: number, r: number, a0: number, a1: number) => {
  const p = (a: number) => [x + r * Math.cos((a * Math.PI) / 180), y + r * Math.sin((a * Math.PI) / 180)];
  const A = p(a0), B = p(a1);
  return `<path d="M${f1(A[0])} ${f1(A[1])}A${r} ${r} 0 0 ${a1 > a0 ? 1 : 0} ${f1(B[0])} ${f1(B[1])}" fill="none" stroke="#FFFDF7" stroke-width="4" stroke-linecap="round" opacity=".95"/><path d="M${f1(A[0])} ${f1(A[1])}A${r} ${r} 0 0 ${a1 > a0 ? 1 : 0} ${f1(B[0])} ${f1(B[1])}" fill="none" stroke="${INK}" stroke-width="1.2" stroke-linecap="round" stroke-dasharray="2 5" opacity=".6"/>`;
};
export const dustSVG = (x: number, y: number) => `<g opacity=".85"><circle cx="${f1(x)}" cy="${f1(y)}" r="6" fill="#E9DFC9" stroke="${INK}" stroke-width="1.2"/><circle cx="${f1(x + 8)}" cy="${f1(y - 3)}" r="4.5" fill="#E9DFC9" stroke="${INK}" stroke-width="1.2"/><circle cx="${f1(x - 7)}" cy="${f1(y - 2)}" r="3.5" fill="#E9DFC9" stroke="${INK}" stroke-width="1.2"/></g>`;
/** satu ledakan kembang api berpusat di 0,0 */
export function fireworkSVG(r: number, c1: string, c2: string, n = 16, rot = 0) {
  let s = `<circle r="${f1(r * 1.15)}" fill="${c1}" opacity=".12"/>`;
  for (let k = 0; k < n; k++) {
    const a = (((k * 360) / n + rot) * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
    s += `<path d="M${f1(ca * r * 0.28)} ${f1(sa * r * 0.28)}Q${f1(ca * r * 0.7)} ${f1(sa * r * 0.7 + 4)} ${f1(ca * r * 0.92)} ${f1(sa * r * 0.92 + 8)}" fill="none" stroke="${c1}" stroke-width="3" stroke-linecap="round"/><circle cx="${f1(ca * r * 0.95)}" cy="${f1(sa * r * 0.95 + 9)}" r="3.2" fill="${c2}"/>`;
  }
  return s + `<circle r="${f1(r * 0.14)}" fill="#FFFDF7"/>`;
}

/* ================================================================== */
/* Lapisan terang malam: cahaya lampu, layar film, sorot proyektor      */
/* ================================================================== */
/**
 * Dipasang di atas tirai gelap malam: lingkaran cahaya lampu (dari daftar lampu), layar film, untaian lampu Jalan Wahana,
 * bohlam gapura & lempar gelang. Satu string statis (berubah hanya bila film berganti).
 */
export function alunNightSVG(lamps: { x: number; y: number }[], film: number) {
  const { iso, up } = H0;
  let s = `<defs><radialGradient id="alun-glow"><stop offset="0" stop-color="#FFD98A" stop-opacity=".8"/><stop offset=".45" stop-color="#FFD98A" stop-opacity=".3"/><stop offset="1" stop-color="#FFD98A" stop-opacity="0"/></radialGradient>`
    + `<radialGradient id="alun-pool"><stop offset="0" stop-color="#FFD98A" stop-opacity=".45"/><stop offset="1" stop-color="#FFD98A" stop-opacity="0"/></radialGradient>`
    + `<radialGradient id="alun-screen"><stop offset="0" stop-color="#CFE8FF" stop-opacity=".5"/><stop offset="1" stop-color="#CFE8FF" stop-opacity="0"/></radialGradient></defs>`;
  for (const p of lamps) {
    const c = iso(p.x + 0.5, p.y + 0.5);
    s += `<ellipse cx="${f1(c[0])}" cy="${f1(c[1])}" rx="58" ry="26" fill="url(#alun-pool)"/><circle cx="${f1(c[0])}" cy="${f1(c[1] - 100 * S)}" r="50" fill="url(#alun-glow)"/>`;
    s += `<path d="M${f1(c[0] - 9 * S)} ${f1(c[1] - 92 * S)}h${f1(18 * S)}l${f1(-3 * S)} ${f1(-16 * S)}h${f1(-12 * S)}Z" fill="#FFE9A8" stroke="${INK}" stroke-width="1.7"/>`;
  }
  // layar tancap & sorot proyektor (film < 0: layar belum diputar)
  const sc = up(iso(14.5, 0.5), 95);
  if (film >= 0) s += `<circle cx="${f1(sc[0])}" cy="${f1(sc[1])}" r="120" fill="url(#alun-screen)"/>` + proyektorBeam() + layarFilmSVG(film);
  // bohlam gapura, halte, lempar gelang
  for (const yy of [12.48, 15.52]) { const q = up(iso(20.48, yy), 118); s += `<circle cx="${f1(q[0])}" cy="${f1(q[1] - 10)}" r="30" fill="url(#alun-glow)"/>` + circ(q[0], q[1] - 10, 8, '#FFE07A', 1.8); }
  { const p = up(iso(27.3, 19.5), 98); s += `<circle cx="${f1(p[0])}" cy="${f1(p[1] + 10)}" r="46" fill="url(#alun-glow)"/>` + circ(p[0], p[1], 4, '#FFE07A', 1); }
  for (let k = 0; k < 5; k++) { const p = up(iso(21.2 + k * 0.4, 3.0), 96); s += `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="12" fill="url(#alun-glow)"/>` + circ(p[0], p[1] + 4, 2.6, '#FFE07A', 0.8); }
  return s + festoonSVG(lampHead(21, 12), lampHead(25, 12), true);
}
/** bohlam roda bianglala yang menyala (diputar bersama roda) */
export const bianglalaBulbsSVG = () => `<g class="bl-wheel bl-bright" transform="translate(${f1(BIANG_HUB.x)} ${f1(BIANG_HUB.y)})">${wheelSVG(BIANG_HUB.R, true)}</g>`;

/* ================================================================== */
/* Pendaftaran ke art.ts                                                */
/* ================================================================== */
const ondelFurn = (g: IsoCtx, x: number, y: number, p: Record<string, number>) => { const q = g.iso(x + 0.5, y + 0.45); return ondelSVG(q[0], q[1], p.v ?? 0); };
registerArt({}, {
    kolampancing: { label: 'Kolam pemancingan bareng', colors: {}, draw: (g, x, y, w, d) => kolam(g, x, y, w, d) },
    papanlomba: { label: 'Papan lomba mancing', colors: {}, draw: (g, x, y) => papanLomba(g, x, y) },
    bianglala: { label: 'Bianglala', colors: {}, draw: (g, x, y) => bianglala(g, x, y) },
    lempargelang: { label: 'Lempar gelang', colors: {}, draw: (g, x, y) => lemparGelang(g, x, y) },
    halte: { label: 'Halte kereta kelinci', colors: {}, draw: (g, x, y) => halte(g, x, y) },
    gapura: { label: 'Gapura', colors: {}, draw: (g, x, y) => gapura(g, x, y) },
    layartancap: { label: 'Layar tancap', colors: {}, draw: (g, x, y, w, d, c, p) => layarTancap(g, x, y, !!p.night) },
    proyektor: { label: 'Proyektor film', colors: {}, draw: (g, x, y, w, d, c, p) => proyektor(g, x, y, !!p.night) },
    tikarnonton: { label: 'Tikar nonton', colors: {}, draw: (g, x, y, w, d, c, p) => tikar(g, x, y, w, d, !!p.night) },
    ondel: { label: 'Ondel-ondel', colors: {}, draw: (g, x, y, w, d, c, p) => ondelFurn(g, x, y, p) },
}, {
    angklung: angklung('#E7C373', '#E0583F'), angklung2: angklung('#D9B26A', '#3F7FBF'), angklung3: angklung('#E7C373', '#3FA06A'),
    silat: silat('#C0392B'), silat2: silat('#3F7FBF', '#2B2F4A'),
    kudaA: kuda('#EBD39C', '#2B2F4A', '#C0392B', 'a'), kudaB: kuda('#FFFDF7', '#C0392B', '#2B2F4A', 'b'), kudaC: kuda('#C8955A', '#3F7FBF', '#F2B632', 'c'),
    lawak: lawak(), kipas: kipas() + peci, gelang: gelangDiTangan(), bendera,
    // dermaga belakang (pet menghadap kiri-bawah) & dermaga kiri (menghadap kanan-bawah)
    joran: joran(77, 34), joran2: joran(76, 56),
    ...Object.fromEntries(GONDOLA_COLORS.map((c, k) => [`gondola${k}`, gondolaFront(c)])),
});
