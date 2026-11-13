// Butik Benang v0.32: slot baru "Baju" (body) + 12 aksesori tambahan untuk slot lama.
//
// Koordinat = ruang pet (renderPet): (0,0) di bawah kaki, badan x -46..46, y -78..-6. Wajah di y -58..-26,
// jadi baju mulai dari garis leher y -24 (tengah) dan y -34 (sisi). Wajah tidak pernah tertutup.
//
// Kontrak slot body:
//   draw(c)  kain baju; renderer membungkusnya dengan <g clip-path="url(#kb-body)">, digambar setelah isi badan + motif
//            bulu dan SEBELUM garis tepi badan (garis tepi digambar ulang di atasnya, jadi tepi baju selalu rapi).
//   back(c)  bagian di belakang badan (lengan pendek, duri dino): setelah jubah, ekor & telinga belakang.
//   over(c)  bagian tanpa potongan setelah kaki (ujung sabuk silat).
// ID clipPath memakai awalan kbb-*; bentuknya tidak bergantung warna, jadi ganda di satu halaman tidak masalah.
import { INK, shade } from './art';

type WearFn = (c: Record<string, string>) => string;
type BodyWearDef = { label: string; slot: 'body'; colors: Record<string, string>; draw: WearFn; over?: WearFn; back?: WearFn };
type ExtraWearDef = { label: string; slot: 'head' | 'face' | 'neck' | 'hand'; colors: Record<string, string>; draw: WearFn; back?: WearFn };

/* ------------------------------------------------------------------ */
/* bentuk bersama                                                       */
/* ------------------------------------------------------------------ */

const S = (w = 2.6) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round"`;
/** leher bulat: y -24 di tengah, y -34 di sisi badan */
const NECK = 'M-62 -42Q0 -6 62 -42';
const TEE = `${NECK}V8H-62Z`;
/** leher V (kemeja berkerah): terbuka sampai y -15 */
const VNECK = 'M-62 -42Q-30 -30 -11 -27L0 -15L11 -27Q30 -30 62 -42';
const VTEE = `${VNECK}V8H-62Z`;
const clip = (id: string, d: string) => `<clipPath id="${id}"><path d="${d}"/></clipPath>`;
/** isi dipotong mengikuti bidang kain (bidangnya sendiri tidak digambar) */
const within = (id: string, d: string, inner: string) => `${clip(id, d)}<g clip-path="url(#${id})">${inner}</g>`;
const fabric = (d: string, fill: string) => `<path d="${d}" fill="${fill}"/>`;
const edge = (d: string, w = 2.6) => `<path d="${d}" fill="none" ${S(w)} stroke-linecap="round"/>`;
/** kerah bulat rib */
const ribCollar = (fill: string) => `<path d="${NECK}L62 -36Q0 1 -62 -36Z" fill="${fill}" ${S(2.4)}/>`;
/** lengan pendek yang mengintip dari belakang badan (body.back) */
const sleeves = (fill: string, cuff?: string) =>
  [-1, 1].map((s) => `<g transform="scale(${s} 1)"><path d="M38 -33Q56 -34 55 -21Q52 -14 40 -16Z" fill="${fill}" ${S(2.6)}/>${cuff ? `<path d="M54.2 -25.5Q51 -16 45 -15.4" fill="none" stroke="${cuff}" stroke-width="3.4" stroke-linecap="round"/>` : ''}</g>`).join('');
const button = (x: number, y: number, fill = '#FFFDF7', r = 1.9) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${INK}" stroke-width="1.3"/>`;
/** kerah kemeja: dua lidah runcing di atas leher V */
const shirtCollar = (fill: string) =>
  [-1, 1].map((s) => `<path d="M${s * 34} -32.5Q${s * 20} -27.5 ${s * 11} -27L${s * 1} -15.5L${s * 8} -14Q${s * 16} -19 ${s * 34} -26Z" fill="${fill}" ${S(2.2)}/>`).join('');
const placket = (fill: string, ys = [-11.5]) => `<path d="M0 -15V0" stroke="${shade(fill, -0.3)}" stroke-width="1.6"/>` + ys.map((y) => button(0, y)).join('');
const star4 = (x: number, y: number, r: number, fill: string) => `<path d="M${x} ${y - r}L${x + r * 0.3} ${y - r * 0.3}L${x + r} ${y}L${x + r * 0.3} ${y + r * 0.3}L${x} ${y + r}L${x - r * 0.3} ${y + r * 0.3}L${x - r} ${y}L${x - r * 0.3} ${y - r * 0.3}Z" fill="${fill}"/>`;
const star5 = (x: number, y: number, r: number, fill: string, sw = 1.2) => {
  const p = Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; return `${(x + Math.cos(a) * rr).toFixed(1)},${(y + Math.sin(a) * rr).toFixed(1)}`; });
  return `<polygon points="${p.join(' ')}" fill="${fill}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>`;
};
const flower5 = (x: number, y: number, r: number, petal: string, mid: string, sw = 1) =>
  `<g transform="translate(${x} ${y})">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="${-r * 0.62}" rx="${r * 0.42}" ry="${r * 0.6}" transform="rotate(${a})" fill="${petal}" stroke="${INK}" stroke-width="${sw}"/>`).join('')}<circle r="${r * 0.32}" fill="${mid}"/></g>`;

/* isian batik / kain (menutup seluruh bidang, pemanggil yang memotong) */
const parang = (c: string, bg: string) =>
  `<g fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round">${[-80, -66, -52, -38, -24, -10, 4, 18, 32, 46, 60].map((x) => `<path d="M${x} 8q6 -7 2 -12t6 -12q6 -7 2 -12t6 -12"/>`).join('')}</g>` +
  `<g fill="${shade(bg, -0.25)}">${[-73, -59, -45, -31, -17, -3, 11, 25, 39, 53].map((x) => [0, 1, 2].map((k) => `<circle cx="${x + 4 + k * 8}" cy="${-2 - k * 12}" r="1.3"/>`).join('')).join('')}</g>`;
const kawung = (c: string, dot: string) => {
  let o = '';
  for (let y = -40; y <= 4; y += 11) for (let x = -55 + (((y + 40) / 11) % 2) * 5.5; x <= 55; x += 11)
    o += `<g transform="translate(${x} ${y})">${[45, 135, 225, 315].map((a) => `<ellipse cx="0" cy="-3.3" rx="2.3" ry="3.4" transform="rotate(${a})" fill="${c}" stroke="${shade(c, -0.35)}" stroke-width=".8"/>`).join('')}<circle r="1.1" fill="${dot}"/></g>`;
  return o;
};
const cloud = (x: number, y: number, k: number, fills: string[]) =>
  fills.map((f, i) => { const s = k * (1 - i * 0.26); return `<path transform="translate(${x} ${y}) scale(${s.toFixed(2)})" d="M-14 4Q-20 4 -20 -1Q-20 -6 -14 -6Q-13 -12 -6 -12Q-1 -12 1 -8Q4 -13 10 -11Q15 -9 14 -4Q20 -4 20 1Q20 5 15 5Q12 9 6 7Q2 10 -3 7Q-9 9 -14 4Z" fill="${f}" stroke="${INK}" stroke-width="${(1.3 / s).toFixed(2)}" stroke-linejoin="round"/>`; }).join('');
const plaid = (bg: string, a: string, b: string) =>
  `<rect x="-62" y="-50" width="124" height="60" fill="${bg}"/>` +
  [-48, -24, 0, 24, 48].map((x) => `<rect x="${x - 4.5}" y="-50" width="9" height="60" fill="${a}" opacity=".55"/>`).join('') +
  [-38, -20, -2].map((y) => `<rect x="-62" y="${y - 4.5}" width="124" height="9" fill="${a}" opacity=".55"/>`).join('') +
  [-36, -12, 12, 36].map((x) => `<path d="M${x} -50V10" stroke="${b}" stroke-width="1.4"/>`).join('') +
  [-29, -11, 7].map((y) => `<path d="M-62 ${y}H62" stroke="${b}" stroke-width="1.4"/>`).join('');
const jarik = (y: number, bg = '#7A4A26', fg = '#E9C46A') =>
  within(`kbb-jarik${y}`, `M-62 ${y}Q0 ${y + 8} 62 ${y}V10H-62Z`, `<rect x="-62" y="${y - 4}" width="124" height="30" fill="${bg}"/>${parang(fg, bg)}`) +
  edge(`M-62 ${y}Q0 ${y + 8} 62 ${y}`, 2.4) + `<path d="M-2 ${y + 4}L-4 8M3 ${y + 4}L2 8M8 ${y + 4}L8 8" stroke="${shade(bg, -0.35)}" stroke-width="1.6"/>`;

/** satu renderer per motif batik: 0 = parang, 1 = kawung, 2 = mega mendung */
function kemejaBatik(m: 0 | 1 | 2, label: string, colors: Record<string, string>): BodyWearDef {
  return {
    label, slot: 'body', colors,
    draw: (c) => {
      const cl = [shade(c.main, 0.15), shade(c.main, 0.4), c.accent];
      const motif = m === 0 ? parang(c.accent, c.main)
        : m === 1 ? kawung(c.accent, shade(c.main, -0.3))
        : cloud(-30, -18, 1.05, cl) + cloud(26, -24, 0.95, cl) + cloud(2, -4, 0.8, cl);
      return within(`kbb-kem${m}`, VTEE, `<rect x="-62" y="-50" width="124" height="60" fill="${c.main}"/>${motif}`) + edge(VNECK) + placket(c.main, [-10]) + shirtCollar(shade(c.main, -0.12));
    },
    back: (c) => sleeves(c.main),
  };
}

/* ------------------------------------------------------------------ */
/* slot BODY: Baju                                                      */
/* ------------------------------------------------------------------ */

export const BODY_WEAR: Record<string, BodyWearDef> = {
  kaos: {
    label: 'Kaos polos', slot: 'body', colors: { main: '#E0583F' },
    draw: (c) => fabric(TEE, c.main) + `<path d="M-34 -20Q-30 -14 -32 -8M30 -18Q33 -13 31 -9" fill="none" stroke="${shade(c.main, -0.14)}" stroke-width="2" stroke-linecap="round"/>` + ribCollar(shade(c.main, -0.12)),
    back: (c) => sleeves(c.main),
  },
  kaosgaris: {
    label: 'Kaos garis', slot: 'body', colors: { main: '#FFFDF7', accent: '#33508C' },
    draw: (c) => within('kbb-garis', TEE, `<rect x="-62" y="-50" width="124" height="60" fill="${c.main}"/>${[-29, -21, -13].map((y) => `<path d="M-62 ${y}Q0 ${y + 14} 62 ${y}" fill="none" stroke="${c.accent}" stroke-width="4"/>`).join('')}`) + ribCollar(c.accent),
    back: (c) => sleeves(c.main, c.accent),
  },
  batikparang: kemejaBatik(0, 'Kemeja batik parang', { main: '#7A4A26', accent: '#E9C46A' }),
  batikkawung: kemejaBatik(1, 'Kemeja batik kawung', { main: '#3E3A5C', accent: '#E9C46A' }),
  batikmega: kemejaBatik(2, 'Kemeja batik mega mendung', { main: '#2E5C9A', accent: '#FFFDF7' }),
  koko: {
    label: 'Baju koko', slot: 'body', colors: { main: '#FFFDF7', accent: '#3FA06A' },
    draw: (c) => fabric(TEE, c.main) + `<path d="${NECK}L62 -38.5Q0 -3 -62 -38.5Z" fill="${c.main}" ${S(2.2)}/>` +
      `<path d="M-5 -21V2M5 -21V2" stroke="${c.accent}" stroke-width="1.6" stroke-dasharray="2.2 1.6"/>` + [-18, -12, -6].map((y) => `<path d="M-4.4 ${y}h8.8" stroke="${shade(c.main, -0.25)}" stroke-width="1"/>${button(0, y, c.accent, 1.5)}`).join('') +
      `<path d="M-30 -24q4 3 0 6q-4 3 0 6M30 -24q-4 3 0 6q4 3 0 6" fill="none" stroke="${c.accent}" stroke-width="1.6" stroke-linecap="round"/>`,
    back: (c) => sleeves(c.main),
  },
  sarung: {
    label: 'Sarung kotak (dikemul)', slot: 'body', colors: { main: '#2F7F55', line: '#F2C94C' },
    draw: (c) => within('kbb-sarung', TEE, plaid(c.main, shade(c.main, -0.3), c.line)) + ribCollar(shade(c.main, -0.2)) +
      // lipatan sarung yang dikemulkan di bahu
      `<path d="M-8 -21.5Q10 -16 26 4" fill="none" ${S(2.4)}/>` +
      within('kbb-sarung2', TEE, within('kbb-sarungfold', 'M-8 -21.5Q10 -16 26 4L62 4V-60H-8Z', `<rect x="-6" y="-60" width="80" height="70" fill="${INK}" opacity=".16"/>`)) +
      `<path d="M-30 -22Q-24 -14 -26 -8" fill="none" stroke="${shade(c.main, -0.45)}" stroke-width="1.6" stroke-linecap="round"/>`,
    back: (c) => [-1, 1].map((s) => `<g transform="scale(${s} 1)"><path d="M40 -34Q58 -34 56 -16Q50 -10 40 -13Z" fill="${shade(c.main, -0.1)}" ${S(2.6)}/><path d="M50 -31V-14" stroke="${c.line}" stroke-width="1.4"/></g>`).join(''),
  },
  kebaya: {
    label: 'Kebaya kutu baru', slot: 'body', colors: { main: '#F7B6C8', accent: '#FFFDF7', jarik: '#7A4A26' },
    draw: (c) => {
      const V = 'M-62 -42Q-30 -30 -16 -27L0 -9L16 -27Q30 -30 62 -42V8H-62Z';
      const scallops = (s: number) => Array.from({ length: 6 }, (_, i) => { const t = i / 6, x = s * (16 - 16 * t), y = -27 + 18 * t; return `<circle cx="${(x + s * 2.4).toFixed(1)}" cy="${(y + 1.2).toFixed(1)}" r="2.3" fill="${c.accent}" stroke="${shade(c.main, -0.3)}" stroke-width=".9"/>`; }).join('');
      return fabric('M-16 -27L0 -9L16 -27Z', c.accent) + `<path d="M-18 -27Q0 -22 18 -27V-22Q0 -17 -18 -22Z" fill="${shade(c.main, -0.08)}" ${S(1.6)}/>` +
        within('kbb-kebaya', V, `<rect x="-62" y="-50" width="124" height="60" fill="${c.main}"/>${[[-34, -24], [-26, -14], [32, -22], [26, -12], [-40, -12], [40, -10]].map(([x, y]) => flower5(x, y, 4.2, c.accent, shade(c.main, -0.2), 0.7)).join('')}`) +
        scallops(-1) + scallops(1) + edge('M-62 -42Q-30 -30 -16 -27L0 -9L16 -27Q30 -30 62 -42', 2.2) +
        [-21, -15].map((y) => `<circle cx="0" cy="${y}" r="2.6" fill="#F2C94C" stroke="${INK}" stroke-width="1.2"/>`).join('') + `<path d="M0 -18.4v0.8" stroke="#F2C94C" stroke-width="1.4"/>` +
        jarik(-12, c.jarik);
    },
    back: (c) => sleeves(c.main),
  },
  beskap: {
    label: 'Beskap & jarik', slot: 'body', colors: { main: '#2E3550', accent: '#E9C46A', jarik: '#7A4A26' },
    draw: (c) => fabric(TEE, c.main) + `<path d="${NECK}L62 -37Q0 -1 -62 -37Z" fill="${shade(c.main, 0.12)}" ${S(2.2)}/>` +
      // kancing depan miring ke kanan, kancing emas
      `<path d="M-2 -20Q6 -16 12 -10Q20 -2 22 6" fill="none" ${S(2.2)}/>` + [[3, -18], [10, -12.5], [16, -6]].map(([x, y]) => button(x, y, c.accent, 1.9)).join('') +
      `<path d="M-30 -24L-20 -22" stroke="${c.accent}" stroke-width="1.6" stroke-linecap="round"/>` + jarik(-14, c.jarik),
    back: (c) => sleeves(c.main),
  },
  lurik: {
    label: 'Baju lurik', slot: 'body', colors: { main: '#C9A57A', accent: '#5B3A22' },
    draw: (c) => within('kbb-lurik', TEE, `<rect x="-62" y="-50" width="124" height="60" fill="${c.main}"/>${Array.from({ length: 21 }, (_, i) => -60 + i * 6).map((x, i) => `<path d="M${x} -50V10" stroke="${c.accent}" stroke-width="${i % 3 === 0 ? 2.4 : 1}" opacity="${i % 3 === 0 ? 0.85 : 0.6}"/>`).join('')}`) +
      `<path d="${NECK}L62 -37Q0 -1 -62 -37Z" fill="${c.accent}" ${S(2.2)}/>` + placket(c.main, [-17, -10]),
    back: (c) => sleeves(c.main),
  },
  jersey: {
    label: 'Jersey merah putih', slot: 'body', colors: { main: '#D7263D', accent: '#FFFDF7' },
    draw: (c) => within('kbb-jersey', TEE, `<rect x="-62" y="-50" width="124" height="60" fill="${c.main}"/><path d="M-62 -26Q-42 -22 -38 10H-44Q-46 -16 -62 -20ZM62 -26Q42 -22 38 10H44Q46 -16 62 -20Z" fill="${c.accent}"/>`) +
      `<path d="${NECK}L62 -38.5Q0 -3 -62 -38.5Z" fill="${c.accent}" ${S(2.2)}/>` +
      // angka "17" di dada (17 Agustus)
      `<g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M-7.5 -15.5L-4.5 -18V-9M1.5 -18H8.5L4.5 -9" stroke="${INK}" stroke-width="5.4"/><path d="M-7.5 -15.5L-4.5 -18V-9M1.5 -18H8.5L4.5 -9" stroke="${c.accent}" stroke-width="2.6"/></g>`,
    back: (c) => sleeves(c.main, c.accent),
  },
  hoodie: {
    label: 'Hoodie', slot: 'body', colors: { main: '#A9B1BE', accent: '#FFFDF7' },
    draw: (c) => fabric(TEE, c.main) + `<path d="M-13 -15Q0 -18 13 -15L15 4H-15Z" fill="${shade(c.main, -0.08)}" ${S(2.2)}/>` +
      // tudung terlipat: kerah tebal
      `<path d="${NECK}L62 -34Q0 6 -62 -34Z" fill="${shade(c.main, 0.12)}" ${S(2.4)}/><path d="M-30 -27Q0 -12 30 -27" fill="none" stroke="${shade(c.main, -0.15)}" stroke-width="1.6"/>` +
      `<path d="M-6 -19V-8M6 -19V-8" stroke="${c.accent}" stroke-width="2" stroke-linecap="round"/>${[-6, 6].map((x) => `<rect x="${x - 1.6}" y="-9" width="3.2" height="4" rx="1" fill="${INK}"/>`).join('')}`,
    back: (c) => sleeves(c.main, shade(c.main, -0.15)),
  },
  piyama: {
    label: 'Piyama bintang', slot: 'body', colors: { main: '#BFDDF2', accent: '#F2C94C', pipe: '#FFFDF7' },
    draw: (c) => within('kbb-piyama', VTEE, `<rect x="-62" y="-50" width="124" height="60" fill="${c.main}"/>${[[-34, -22, 3], [-22, -10, 2.4], [24, -20, 3], [36, -12, 2.2], [-10, -4, 2], [14, -6, 2.4], [-40, -8, 2]].map(([x, y, r]) => star5(x, y, r, c.accent, 0.8)).join('')}`) +
      edge(VNECK) + `<path d="M0 -15V2" stroke="${c.pipe}" stroke-width="2"/>` + [-11, -4].map((y) => button(0, y, c.pipe, 1.7)).join('') +
      // kerah bulat berlis
      [-1, 1].map((s) => `<path d="M${s * 34} -32.5Q${s * 20} -27.5 ${s * 11} -27L${s * 1} -15.5Q${s * 14} -10 ${s * 26} -18Q${s * 34} -24 ${s * 34} -32.5Z" fill="${c.main}" ${S(2.2)}/><path d="M${s * 3} -15.8Q${s * 14} -12 ${s * 24} -18.5" fill="none" stroke="${c.pipe}" stroke-width="1.8"/>`).join(''),
    back: (c) => sleeves(c.main, c.pipe),
  },
  rompi: {
    label: 'Rompi rajut', slot: 'body', colors: { main: '#E3A83B', accent: '#B5562F', shirt: '#FFFDF7' },
    draw: (c) => {
      const V = 'M-62 -42Q-36 -30 -18 -28L0 -6L18 -28Q36 -30 62 -42V8H-62Z';
      let arg = '';
      for (let x = -48; x <= 48; x += 16) for (const y of [-26, -10]) arg += `<path d="M${x} ${y - 8}L${x + 6} ${y}L${x} ${y + 8}L${x - 6} ${y}Z" fill="${shade(c.main, -0.12)}"/><path d="M${x - 8} ${y - 8}L${x + 8} ${y + 8}M${x + 8} ${y - 8}L${x - 8} ${y + 8}" stroke="${c.accent}" stroke-width="1" stroke-dasharray="1.5 1.5"/>`;
      return fabric(TEE, c.shirt) + shirtCollar(c.shirt) + within('kbb-rompi', V, `<rect x="-62" y="-50" width="124" height="60" fill="${c.main}"/>${arg}`) +
        `<path d="M-62 -42Q-36 -30 -18 -28L0 -6L18 -28Q36 -30 62 -42" fill="none" stroke="${c.accent}" stroke-width="6" stroke-linejoin="round"/>` + edge('M-62 -42Q-36 -30 -18 -28L0 -6L18 -28Q36 -30 62 -42', 2.2) + edge('M-62 -37Q-36 -25 -21 -23.5L0 1L21 -23.5Q36 -25 62 -37', 1.8);
    },
    back: (c) => sleeves(c.shirt),
  },
  overall: {
    label: 'Overall jeans', slot: 'body', colors: { main: '#4E78B8', accent: '#F2C94C' },
    draw: (c) => {
      const d = 'M-15 -26Q0 -24 15 -26L16 -16Q34 -16 62 -22V8H-62V-22Q-34 -16 -16 -16Z';
      return within('kbb-overall', d, `<rect x="-62" y="-50" width="124" height="60" fill="${c.main}"/><path d="M-62 -14Q0 -6 62 -14" stroke="${shade(c.main, 0.3)}" stroke-width="1.4" stroke-dasharray="2 2" fill="none"/>`) +
        `<path d="${d}" fill="none" ${S(2.4)}/>` + `<path d="M-9 -22H9L8 -14H-8Z" fill="${shade(c.main, -0.12)}" ${S(1.6)}/>` +
        // tali naik ke bahu
        [-1, 1].map((s) => `<path d="M${s * 12} -26Q${s * 30} -31 ${s * 44} -33" fill="none" stroke="${INK}" stroke-width="7.6" stroke-linecap="round"/><path d="M${s * 12} -26Q${s * 30} -31 ${s * 44} -33" fill="none" stroke="${c.main}" stroke-width="4" stroke-linecap="round"/>${button(s * 12, -24, c.accent, 2.4)}`).join('');
    },
  },
  daster: {
    label: 'Daster bunga', slot: 'body', colors: { main: '#F49AB6', accent: '#FFFDF7', mid: '#F2C94C' },
    draw: (c) => within('kbb-daster', TEE, `<rect x="-62" y="-50" width="124" height="60" fill="${c.main}"/>${[[-32, -22], [-14, -10], [8, -16], [28, -24], [34, -10], [-38, -8], [0, -2]].map(([x, y], i) => flower5(x, y, i % 2 ? 4.6 : 5.6, c.accent, c.mid, 0.8)).join('')}${[[-24, -16], [18, -8], [22, -20]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1.6" ry="3" fill="#7CC57D"/>`).join('')}`) +
      // leher lebar berkerut
      `<path d="${NECK}" fill="none" stroke="${c.accent}" stroke-width="5" stroke-dasharray="4 1.6"/>` + edge('M-62 -38Q0 -1 62 -38', 1.6) + edge(NECK, 2.2),
    back: (c) => [-1, 1].map((s) => `<g transform="scale(${s} 1)"><path d="M38 -34Q58 -36 57 -21Q50 -14 40 -16Z" fill="${c.main}" ${S(2.6)}/></g>`).join(''),
  },
  varsity: {
    label: 'Jaket varsity', slot: 'body', colors: { main: '#2F4E8C', accent: '#F3E3B5' },
    draw: (c) => fabric(TEE, c.main) +
      `<path d="${NECK}L62 -36Q0 1 -62 -36Z" fill="${c.accent}" ${S(2.2)}/><path d="M-62 -39Q0 -3 62 -39" fill="none" stroke="${c.main}" stroke-width="1.6"/>` +
      `<path d="M0 -18V2" stroke="${INK}" stroke-width="1.6"/>` + [-14, -7, 0].map((y) => button(0, y, c.accent, 1.5)).join('') +
      // tempelan huruf "B" (Bupi)
      `<rect x="-29" y="-24" width="13" height="14" rx="3.5" fill="${c.accent}" ${S(1.8)}/><path d="M-25.5 -21.5V-12.5H-21.5Q-18.6 -12.5 -18.6 -14.8Q-18.6 -17 -21.4 -17.2Q-19.2 -17.4 -19.2 -19.4Q-19.2 -21.5 -21.8 -21.5Z" fill="${c.main}"/>`,
    back: (c) => [-1, 1].map((s) => `<g transform="scale(${s} 1)"><path d="M38 -33Q56 -34 55 -21Q52 -14 40 -16Z" fill="${c.accent}" ${S(2.6)}/><path d="M54.4 -24Q52 -16 45 -15.2" fill="none" stroke="${c.main}" stroke-width="3.6" stroke-linecap="round"/></g>`).join(''),
  },
  flanel: {
    label: 'Kemeja flanel', slot: 'body', colors: { main: '#C0392B', accent: '#4A1F1A', line: '#F3E3B5' },
    draw: (c) => within('kbb-flanel', VTEE, plaid(c.main, c.accent, c.line)) + edge(VNECK) + placket(c.main, [-10]) +
      `<path d="M-30 -22H-17V-13Q-23.5 -11 -30 -13Z" fill="${c.main}" ${S(1.8)}/><path d="M-30 -22H-17V-19H-30Z" fill="${shade(c.main, -0.2)}" ${S(1.6)}/>` + shirtCollar(c.main),
    back: (c) => sleeves(c.main, c.accent),
  },
  pantai: {
    label: 'Kemeja pantai', slot: 'body', colors: { main: '#38B2AC', accent: '#E0583F', leaf: '#2F7F55' },
    draw: (c) => within('kbb-pantai', VTEE, `<rect x="-62" y="-50" width="124" height="60" fill="${c.main}"/>` +
        [[-36, -20, 30], [-12, -6, -20], [30, -22, 60], [22, -4, 10]].map(([x, y, r]) => `<g transform="rotate(${r} ${x} ${y})"><path d="M${x - 9} ${y + 3}q4 -8 12 -5q-4 7 -12 5Z" fill="${c.leaf}"/></g>`).join('') +
        [[-32, -24, 6], [-10, -8, 5], [32, -18, 6.4], [12, -2, 4.6], [-42, -6, 4.4]].map(([x, y, r]) => flower5(x, y, r, c.accent, '#F2C94C', 0.9)).join('')) +
      edge(VNECK) + placket(c.main, [-10]) +
      // kerah terbuka
      [-1, 1].map((s) => `<path d="M${s * 34} -32.5Q${s * 20} -27.5 ${s * 11} -27L${s * 1} -15.5L${s * 6} -10Q${s * 12} -20 ${s * 34} -24Z" fill="${shade(c.main, -0.1)}" ${S(2.2)}/>`).join(''),
    back: (c) => sleeves(c.main),
  },
  seragam: {
    label: 'Seragam penjelajah', slot: 'body', colors: { main: '#B08D57', accent: '#7A5C33' },
    draw: (c) => fabric(VTEE, c.main) + edge(VNECK) + placket(c.main, [-10]) +
      [-1, 1].map((s) => `<path d="M${s * 32} -23H${s * 16}V${-13}Q${s * 24} -10 ${s * 32} -13Z" fill="${c.main}" ${S(1.8)}/><path d="M${s * 32} -23H${s * 16}V-18.5Q${s * 24} -16 ${s * 32} -18.5Z" fill="${shade(c.main, -0.12)}" ${S(1.6)}/>${button(s * 24, -18, c.accent, 1.4)}`).join('') +
      // tanda pundak
      [-1, 1].map((s) => `<path d="M${s * 36} -33L${s * 46} -36L${s * 47} -31L${s * 37} -28Z" fill="${shade(c.main, -0.15)}" ${S(1.6)}/>`).join('') +
      shirtCollar(shade(c.main, -0.06)),
    back: (c) => sleeves(c.main, c.accent),
  },
  celemek: {
    label: 'Celemek koki', slot: 'body', colors: { main: '#FFFDF7', accent: '#E0583F' },
    draw: (c) => {
      const bib = 'M-17 -25Q0 -23 17 -25L18 -18Q36 -16 62 -22V8H-62V-22Q-36 -16 -18 -18Z';
      let gingham = '';
      for (let x = -11; x < 11; x += 3.6) gingham += `<rect x="${x}" y="-12" width="1.8" height="10" fill="${c.accent}" opacity=".6"/>`;
      for (let y = -12; y < -2; y += 3.6) gingham += `<rect x="-11" y="${y}" width="22" height="1.8" fill="${c.accent}" opacity=".6"/>`;
      return [-1, 1].map((s) => `<path d="M${s * 14} -25Q${s * 30} -30 ${s * 44} -34" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M${s * 14} -25Q${s * 30} -30 ${s * 44} -34" fill="none" stroke="${c.main}" stroke-width="2.2" stroke-linecap="round"/>`).join('') +
        fabric(bib, c.main) + edge(bib, 2.4) + `<path d="M-62 -19Q-36 -13 -18 -15M18 -15Q36 -13 62 -19" fill="none" stroke="${c.accent}" stroke-width="2.4"/>` +
        `<path d="M-11 -12H11V-4Q0 -1 -11 -4Z" fill="${c.main}"/>${within('kbb-celemekp', 'M-11 -12H11V-4Q0 -1 -11 -4Z', gingham)}<path d="M-11 -12H11V-4Q0 -1 -11 -4Z" fill="none" ${S(1.8)}/>`;
    },
  },
  silat: {
    label: 'Baju silat', slot: 'body', colors: { main: '#33364F', accent: '#D7263D' },
    draw: (c) => fabric('M-62 -42Q-30 -30 -14 -27L0 -14L14 -27Q30 -30 62 -42V8H-62Z', c.main) +
      // depan silang + pita kerah
      `<path d="M-62 -42Q-30 -30 -14 -27L0 -14L14 -27Q30 -30 62 -42" fill="none" stroke="${shade(c.main, 0.25)}" stroke-width="5"/>` + edge('M-62 -42Q-30 -30 -14 -27L0 -14L14 -27Q30 -30 62 -42', 2.2) + edge('M-62 -37.5Q-30 -25.5 -16 -23L0 -9', 1.6) +
      // sabuk dengan simpul
      `<path d="M-62 -19Q0 -9 62 -19L62 -12Q0 -2 -62 -12Z" fill="${c.accent}" ${S(2.2)}/>`,
    over: (c) => `<path d="M-24 -13l-6 12l5 1l4 -10ZM-20 -13l2 13l5 -1l-3 -12Z" fill="${c.accent}" ${S(2)}/><ellipse cx="-22" cy="-13.5" rx="5" ry="4" fill="${shade(c.accent, -0.12)}" ${S(2)}/>`,
    back: (c) => sleeves(c.main),
  },
  dino: {
    label: 'Kostum dino', slot: 'body', colors: { main: '#6CC17A', accent: '#F3E3B5', spike: '#F2C94C' },
    draw: (c) => fabric(TEE, c.main) + `<path d="M-20 -24Q0 -18 20 -24Q24 -6 14 4H-14Q-24 -6 -20 -24Z" fill="${c.accent}" ${S(2.2)}/>` +
      [-18, -12, -6].map((y) => `<path d="M${-19 + (y + 24) * 0.2} ${y}Q0 ${y + 4} ${19 - (y + 24) * 0.2} ${y}" fill="none" stroke="${shade(c.accent, -0.3)}" stroke-width="1.4"/>`).join('') +
      ribCollar(shade(c.main, -0.15)) + [[-36, -22], [36, -16], [-30, -12]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="${shade(c.main, -0.15)}"/>`).join(''),
    back: (c) => [-1, 1].map((s) => `<g transform="scale(${s} 1)">${[[44, -32], [43, -21], [38, -11]].map(([x, y]) => `<path d="M${x - 2} ${y - 7}Q${x + 6} ${y - 6} ${x + 10} ${y}Q${x + 6} ${y + 4} ${x - 2} ${y + 6}Z" fill="${c.spike}" ${S(2.2)}/>`).join('')}</g>`).join(''),
  },
  payet: {
    label: 'Jaket payet panggung', slot: 'body', colors: { main: '#C2185B', accent: '#F2C94C', inner: '#FFFDF7' },
    draw: (c) => {
      let seq = '';
      for (let y = -32; y <= 4; y += 5) for (let x = -58 + ((y / 5) % 2 ? 2.5 : 0); x <= 58; x += 5) seq += `<circle cx="${x}" cy="${y}" r="1.5" fill="${shade(c.main, 0.35)}"/>`;
      const V = 'M-62 -42Q-30 -30 -12 -27L0 -4L12 -27Q30 -30 62 -42V8H-62Z';
      return fabric(TEE, c.inner) + within('kbb-payet', V, `<rect x="-62" y="-50" width="124" height="60" fill="${c.main}"/>${seq}`) +
        // kerah emas
        [-1, 1].map((s) => `<path d="M${s * 34} -32.5Q${s * 22} -28 ${s * 12} -27L${s * 1} -5L${s * 8} -8Q${s * 14} -20 ${s * 34} -26Z" fill="${c.accent}" ${S(2.2)}/>`).join('') +
        star4(-30, -18, 4, '#FFFFFF') + star4(26, -10, 3.4, '#FFFFFF') + star4(36, -24, 2.6, '#FFFFFF') + `<path d="M-5 -24l5 4l5 -4v6l-5 -2l-5 2Z" fill="${INK}"/>`;
    },
    back: (c) => sleeves(c.main, c.accent),
  },
  songket: {
    label: 'Baju songket emas', slot: 'body', colors: { main: '#9B1B30', accent: '#F2C94C' },
    draw: (c) => {
      let mot = '';
      for (let y = -30; y <= 6; y += 9) for (let x = -56 + (((y + 30) / 9) % 2) * 6; x <= 56; x += 12) mot += `<path d="M${x} ${y - 3.4}L${x + 3.4} ${y}L${x} ${y + 3.4}L${x - 3.4} ${y}Z" fill="${c.accent}"/><circle cx="${x}" cy="${y}" r=".9" fill="${c.main}"/>`;
      return within('kbb-songket', TEE, `<rect x="-62" y="-50" width="124" height="60" fill="${c.main}"/>${mot}<path d="M-62 -9Q0 1 62 -9" stroke="${c.accent}" stroke-width="3.4" fill="none"/>`) +
        // kalung susun emas
        `<path d="${NECK}L62 -34Q20 -14 0 -12Q-20 -14 -62 -34Z" fill="${c.accent}" ${S(2.2)}/>` +
        [-24, -12, 0, 12, 24].map((x) => `<path d="M${x} ${-19.5 - Math.abs(x) * 0.16}l2.2 3.2l-2.2 3.2l-2.2 -3.2Z" fill="${shade(c.accent, -0.3)}"/>`).join('');
    },
    back: (c) => sleeves(c.main, c.accent),
  },
};

/* ------------------------------------------------------------------ */
/* aksesori tambahan (slot lama)                                       */
/* ------------------------------------------------------------------ */

export const EXTRA_WEAR: Record<string, ExtraWearDef> = {
  kopiah: { label: 'Kopiah rajut putih', slot: 'head', colors: { main: '#FFFDF7', accent: '#C9C2B0' },
    draw: (c) => `<path d="M-30 -68Q-32 -98 0 -98Q32 -98 30 -68Q0 -76 -30 -68Z" fill="${c.main}" ${S(3)}/>` +
      [-84, -76].map((y) => `<path d="M-28 ${y + 4}Q0 ${y - 4} 28 ${y + 4}" fill="none" stroke="${c.accent}" stroke-width="1.6" stroke-dasharray="2 2"/>`).join('') +
      `<path d="M-14 -94l3 4l3 -4l3 4l3 -4l3 4l3 -4" fill="none" stroke="${c.accent}" stroke-width="1.4"/>` },
  konde: { label: 'Konde melati', slot: 'head', colors: { main: '#3B2A20', accent: '#FFFDF7' },
    draw: (c) => `<ellipse cx="0" cy="-86" rx="17" ry="12" fill="${c.main}" ${S(3)}/><path d="M-10 -90Q0 -96 10 -90M-8 -83Q0 -88 8 -83" fill="none" stroke="${shade(c.main, 0.3)}" stroke-width="1.6"/>` +
      `<path d="M16 -92L30 -104" stroke="#F2C94C" stroke-width="2.6" stroke-linecap="round"/><circle cx="31" cy="-105" r="3.4" fill="#F2C94C" stroke="${INK}" stroke-width="1.6"/>` +
      [-18, -12, -6, 0, 6, 12, 18].map((x) => `<circle cx="${x}" cy="${-75 + Math.abs(x) * 0.12}" r="3.1" fill="${c.accent}" stroke="${INK}" stroke-width="1.3"/>`).join('') },
  topipet: { label: 'Topi pet', slot: 'head', colors: { main: '#F2C230', accent: '#3F7FBF' },
    draw: (c) => `<path d="M-32 -68Q-34 -102 0 -102Q34 -102 32 -68Z" fill="${c.main}" ${S(3)}/><path d="M-36 -70Q-10 -76 22 -70Q46 -66 52 -60Q30 -60 10 -64Q-14 -66 -36 -64Z" fill="${c.accent}" ${S(3)}/>` +
      `<path d="M0 -102V-70M-18 -98Q-12 -86 -12 -70M18 -98Q12 -86 12 -70" fill="none" stroke="${shade(c.main, -0.2)}" stroke-width="1.6"/><circle cx="0" cy="-103" r="3.4" fill="${c.accent}" stroke="${INK}" stroke-width="1.8"/>` },
  ikatmp: { label: 'Ikat kepala merah putih', slot: 'head', colors: { main: '#D7263D', accent: '#FFFDF7' },
    draw: (c) => `<path d="M-40 -66Q0 -80 40 -66L40 -60Q0 -74 -40 -60Z" fill="${c.main}" ${S(2.6)}/><path d="M-40 -60Q0 -74 40 -60L39 -55Q0 -68 -39 -55Z" fill="${c.accent}" ${S(2.4)}/>` +
      `<path d="M39 -62l12 -8l2 7ZM39 -60l13 3l-4 6Z" fill="${c.main}" ${S(2.2)}/>` },
  tudungdino: { label: 'Tudung dino', slot: 'head', colors: { main: '#6CC17A', accent: '#F2C94C' },
    draw: (c) => [-18, -6, 6, 18].map((x, i) => `<path d="M${x - 6} ${-74 - (18 - Math.abs(x)) * 0.25}L${x} ${-88 - (i % 3 ? 4 : 0) - (18 - Math.abs(x)) * 0.25}L${x + 6} ${-74 - (18 - Math.abs(x)) * 0.25}Z" fill="${c.accent}" ${S(2.4)}/>`).join('') +
      `<path d="M-40 -60Q-44 -94 0 -94Q44 -94 40 -60Q32 -70 0 -72Q-32 -70 -40 -60Z" fill="${c.main}" ${S(3)}/>` +
      [-1, 1].map((s) => `<circle cx="${s * 14}" cy="-84" r="5" fill="#FFFDF7" stroke="${INK}" stroke-width="2"/><circle cx="${s * 14 + 1}" cy="-84" r="2.2" fill="${INK}"/>`).join('') +
      `<path d="M-30 -68l4 5l4 -5l4 5l4 -5M10 -70l4 5l4 -5l4 5l4 -5" fill="#FFFDF7" ${S(1.4)}/>` },
  plester: { label: 'Plester lucu', slot: 'face', colors: { main: '#F6C9A0', accent: '#E8A87C' },
    draw: (c) => `<g transform="rotate(-24 32 -57)"><rect x="21" y="-61.5" width="22" height="9" rx="4.5" fill="${c.main}" ${S(2)}/><rect x="28" y="-60.5" width="8" height="7" fill="${shade(c.main, 0.3)}"/><g fill="${c.accent}"><circle cx="30" cy="-58.5" r=".8"/><circle cx="34" cy="-58.5" r=".8"/><circle cx="30" cy="-55.5" r=".8"/><circle cx="34" cy="-55.5" r=".8"/></g></g>` },
  kacu: { label: 'Kacu merah putih', slot: 'neck', colors: { main: '#D7263D', accent: '#FFFDF7' },
    draw: (c) => `<path d="M-38 -31Q0 -14 38 -31L30 -22Q0 -8 -30 -22Z" fill="${c.main}" ${S(2.6)}/><path d="M-30 -22Q0 -8 30 -22L0 2Z" fill="${c.accent}" ${S(2.4)}/><path d="M-30 -22Q0 -8 30 -22L20 -15Q0 -6 -20 -15Z" fill="${c.main}"/>` +
      `<path d="M-30 -22Q0 -8 30 -22" fill="none" stroke="${INK}" stroke-width="1.2"/><rect x="-5" y="-16" width="10" height="7" rx="3" fill="#B08D57" ${S(1.8)}/>` },
  kalungmutiara: { label: 'Kalung mutiara', slot: 'neck', colors: { main: '#FFFDF7', accent: '#E8DDF5' },
    draw: (c) => [-30, -24, -18, -12, -6, 0, 6, 12, 18, 24, 30].map((x) => { const y = -28 + (30 - Math.abs(x)) * 0.3; return `<circle cx="${x}" cy="${y.toFixed(1)}" r="3.2" fill="${c.main}" stroke="${INK}" stroke-width="1.3"/><circle cx="${x - 1}" cy="${(y - 1).toFixed(1)}" r="1" fill="#FFFFFF"/>`; }).join('') +
      `<path d="M0 -15.5L4 -11L0 -4L-4 -11Z" fill="${c.accent}" ${S(1.6)}/>` },
  kipas: { label: 'Kipas batik', slot: 'hand', colors: { main: '#7A4A26', accent: '#E9C46A' },
    draw: (c) => `<g transform="translate(46 -40)"><path d="M0 0L-22 -24A32 32 0 0 1 22 -24Z" fill="${c.main}" ${S(2.4)}/>` +
      [-16, -8, 0, 8, 16].map((x) => `<path d="M0 0L${x * 1.4} -29" stroke="${c.accent}" stroke-width="1.4"/>`).join('') + `<path d="M-15 -17A22 22 0 0 1 15 -17" fill="none" stroke="${c.accent}" stroke-width="1.8" stroke-dasharray="2.4 2"/>` +
      `<circle r="2.6" fill="${c.accent}" stroke="${INK}" stroke-width="1.4"/></g><path d="M44 -38L40 -22" stroke="#8A5A36" stroke-width="3" stroke-linecap="round"/>` },
  sutil: { label: 'Sutil kayu', slot: 'hand', colors: { main: '#C8955A', accent: '#8A5A36' },
    draw: (c) => `<path d="M40 -20L50 -62" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M40 -20L50 -62" stroke="${c.main}" stroke-width="3" stroke-linecap="round"/><path d="M44 -62Q44 -84 56 -86Q64 -84 60 -64Q56 -58 48 -60Z" fill="${c.main}" ${S(2.4)}/><path d="M50 -66l6 -12" stroke="${c.accent}" stroke-width="1.6" stroke-linecap="round"/>` },
  mikrofon: { label: 'Mikrofon panggung', slot: 'hand', colors: { main: '#2B2F4A', accent: '#C9D1DC' },
    draw: (c) => `<path d="M40 -22L46 -54" stroke="${INK}" stroke-width="7.4" stroke-linecap="round"/><path d="M40 -22L46 -54" stroke="${c.main}" stroke-width="4" stroke-linecap="round"/><circle cx="48" cy="-62" r="9" fill="${c.accent}" ${S(2.6)}/><path d="M41 -64h14M42 -59h12M45 -69l6 12M51 -69l-6 12" stroke="${shade(c.accent, -0.3)}" stroke-width="1.1"/>` +
      `<path d="M58 -74l3 -3M60 -66l4 -1M56 -80l1 -4" stroke="#F2C94C" stroke-width="2" stroke-linecap="round"/>` },
  raket: { label: 'Raket bulu tangkis', slot: 'hand', colors: { main: '#3F7FBF', accent: '#FFFDF7' },
    draw: (c) => `<path d="M40 -20L46 -52" stroke="${INK}" stroke-width="5.4" stroke-linecap="round"/><path d="M40 -20L46 -52" stroke="${c.main}" stroke-width="2.2" stroke-linecap="round"/><path d="M40 -20L42 -30" stroke="${c.accent}" stroke-width="4" stroke-linecap="round"/>` +
      `<ellipse cx="49" cy="-70" rx="11" ry="15" transform="rotate(10 49 -70)" fill="${c.accent}" fill-opacity=".55" stroke="${c.main}" stroke-width="3.4"/><ellipse cx="49" cy="-70" rx="11" ry="15" transform="rotate(10 49 -70)" fill="none" stroke="${INK}" stroke-width="1.2"/>` +
      `<g stroke="${shade(c.main, -0.2)}" stroke-width=".7"><path d="M42 -80L56 -78M40 -72L58 -69M40 -64L57 -61M45 -84L42 -58M50 -85L47 -56M55 -83L52 -57"/></g>` },
};

/* ------------------------------------------------------------------ */
/* ikon toko & manekin                                                  */
/* ------------------------------------------------------------------ */

/** Bagian baju yang sudah digambar (lihat bodyParts di art.ts). */
export interface BodyParts { back: string; draw: string; over: string }
const BODY_D = 'M0 -78C30 -78 46 -56 46 -34C46 -14 28 -6 0 -6C-28 -6 -46 -14 -46 -34C-46 -56 -30 -78 0 -78Z';
const CLIP = `<clipPath id="kb-body"><path d="${BODY_D}"/></clipPath>`;

/** Ikon toko/Lemari untuk baju: baju di atas badan bayangan bergaris putus (supaya terbaca sebagai pakaian, bukan pet). */
export function bodyIcon(p: BodyParts) {
  return `<svg viewBox="-62 -60 124 64" aria-hidden="true"><defs>${CLIP}<clipPath id="kbi-low"><path d="M-70 -40Q0 -4 70 -40V10H-70Z"/></clipPath></defs>` +
    `${p.back}<path d="${BODY_D}" fill="#F4EFE4" stroke="#C9C2B0" stroke-width="2" stroke-dasharray="4 3"/><g clip-path="url(#kb-body)">${p.draw}</g>` +
    `<g clip-path="url(#kbi-low)"><path d="${BODY_D}" fill="none" stroke="${INK}" stroke-width="3"/></g>${p.over}</svg>`;
}

/** Properti adegan Butik: manekin tanpa wajah yang memajang baju; titik (0,0) = lantai, skala sama dengan pet. */
export function mannequin(p: BodyParts) {
  const wood = '#B98B4E';
  return `<defs>${CLIP}</defs><ellipse cx="0" cy="-1" rx="24" ry="5" fill="#000" opacity=".13"/>` +
    `<path d="M0 -14L-18 -1M0 -14L18 -1M0 -14V-2" fill="none" stroke="${INK}" stroke-width="6.4" stroke-linecap="round"/><path d="M0 -14L-18 -1M0 -14L18 -1M0 -14V-2" fill="none" stroke="${wood}" stroke-width="3" stroke-linecap="round"/>` +
    `<rect x="-4" y="-40" width="8" height="28" rx="2" fill="${wood}" ${S(2.4)}/>` +
    `<g transform="translate(0 -30)">${p.back}<path d="${BODY_D}" fill="#E6D6BD"/><path d="M0 -78V-30" stroke="#CDB998" stroke-width="2" stroke-dasharray="3 3"/><g clip-path="url(#kb-body)">${p.draw}</g><path d="${BODY_D}" fill="none" stroke="${INK}" stroke-width="3.5"/>` +
    `<path d="M-24 -64Q-14 -72 -2 -73" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity=".6"/><rect x="-7" y="-88" width="14" height="10" rx="4" fill="${wood}" ${S(2.4)}/>${p.over}</g>`;
}
