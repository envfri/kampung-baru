// Kerja Sambilan: seragam tiap tempat kerja (pakaian, tidak dijual di toko), Papan Lowongan & Pos Ronda di peta,
// ikon kartu papan lowongan, dan amplop gaji. Gaya sama dengan gambar lain: bidang datar bergaris tinta.
//
// Koordinat pakaian = ruang pet (renderPet): kaki di (0,0), badan x -46..46, y -78..-6, wajah y -58..-26.
// Slot body: draw dipotong bentuk badan (garis tepi badan digambar ulang di atasnya), back di belakang badan,
// over tanpa potongan setelah kaki (sepatu bot). Slot lain: draw di depan, back di belakang badan.
import { shade } from './art';
import type { KerjaJob } from './kerja';

// sama dengan INK di art.ts; ditulis ulang di sini karena ikon di bawah dibuat saat modul dimuat (art.ts mengimpor file ini)
const INK = '#2B2F4A';

type WearFn = (c: Record<string, string>) => string;
type KerjaWearDef = { label: string; slot: 'body' | 'head' | 'neck' | 'hand'; colors: Record<string, string>; draw: WearFn; back?: WearFn; over?: WearFn };

const S = (w = 2.6) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round"`;
const NECK = 'M-62 -42Q0 -6 62 -42';
const TEE = `${NECK}V8H-62Z`;
const fabric = (d: string, fill: string) => `<path d="${d}" fill="${fill}"/>`;
const edge = (d: string, w = 2.4) => `<path d="${d}" fill="none" ${S(w)} stroke-linecap="round"/>`;
const ribCollar = (fill: string) => `<path d="${NECK}L62 -36Q0 1 -62 -36Z" fill="${fill}" ${S(2.4)}/>`;
const sleeves = (fill: string, cuff?: string) =>
  [-1, 1].map((s) => `<g transform="scale(${s} 1)"><path d="M38 -33Q56 -34 55 -21Q52 -14 40 -16Z" fill="${fill}" ${S(2.6)}/>${cuff ? `<path d="M54.2 -25.5Q51 -16 45 -15.4" fill="none" stroke="${cuff}" stroke-width="3.4" stroke-linecap="round"/>` : ''}</g>`).join('');
const clip = (id: string, d: string, inner: string) => `<clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})">${inner}</g>`;

export const KERJA_WEAR: Record<string, KerjaWearDef> = {
  /* ---------- Warung: celemek oranye bertepi hijau, saku buku nota & pensil, lap belang di bahu ---------- */
  celemekwarung: {
    label: 'Celemek warung', slot: 'body', colors: { main: '#EC8F3E', accent: '#2F7F55', lap: '#FFFDF7' },
    draw: (c) => {
      const bib = 'M-17 -25Q0 -21 17 -25L19 -17Q38 -15 62 -22V8H-62V-22Q-38 -15 -19 -17Z';
      return [-1, 1].map((s) => `<path d="M${s * 15} -25Q${s * 28} -30 ${s * 42} -35" fill="none" stroke="${INK}" stroke-width="5.4" stroke-linecap="round"/><path d="M${s * 15} -25Q${s * 28} -30 ${s * 42} -35" fill="none" stroke="${c.accent}" stroke-width="2.4" stroke-linecap="round"/>`).join('') +
        fabric(bib, c.main) + edge(bib) +
        // tepi hijau bib & tali pinggang
        `<path d="M-15.5 -22.6Q0 -19 15.5 -22.6" fill="none" stroke="${c.accent}" stroke-width="2.4"/>` +
        `<path d="M-62 -19Q-38 -12 -19 -14Q0 -12 19 -14Q38 -12 62 -19L62 -14Q38 -7 19 -9Q0 -7 -19 -9Q-38 -7 -62 -14Z" fill="${c.accent}" ${S(1.8)}/>` +
        // saku dengan buku nota & pensil
        `<path d="M-7.5 -8H7.5V-1.5Q0 1 -7.5 -1.5Z" fill="${shade(c.main, -0.14)}" ${S(1.6)}/>` +
        `<rect x="-6" y="-21" width="7" height="8" rx="1" fill="#FFFDF7" transform="rotate(-8 -2.5 -17)" ${S(1.3)}/><path d="M-4.6 -18.6h4M-4.4 -16.4h3.4" stroke="#8C97A6" stroke-width="1" transform="rotate(-8 -2.5 -17)"/>` +
        `<path d="M3 -20.5L6.6 -12" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/><path d="M3 -20.5L6.6 -12" stroke="#F2C230" stroke-width="1.8" stroke-linecap="round"/><path d="M2.6 -21.2l1.2 2.4" stroke="#F49AB6" stroke-width="1.8" stroke-linecap="round"/>` +
        // lap belang merah-putih tersampir di bahu kanan
        `<path d="M24 -37Q31 -39 37 -39L33 -9Q27 -8 21 -10Z" fill="${c.lap}" ${S(1.8)}/>` +
        `<path d="M23.6 -31.5L35.9 -32.8M22.7 -24L34.9 -25M21.9 -16.6L34 -17.3" stroke="#E0583F" stroke-width="2"/>`;
    },
  },

  /* ---------- Kebun: caping lebar anyaman bambu, pita hijau, tunas terselip, tali merah ---------- */
  capingkebun: {
    label: 'Caping kebun', slot: 'head', colors: { main: '#E6C46E', accent: '#3FA06A' },
    draw: (c) => {
      const cone = 'M-60 -63L0 -106 60 -63Q0 -52 -60 -63Z';
      let weave = '';
      for (let i = -9; i <= 9; i++) weave += `<path d="M${i * 9} -110L${i * 9 + 34} -48M${i * 9} -110L${i * 9 - 34} -48" stroke="${shade(c.main, -0.22)}" stroke-width="1.1"/>`;
      return `<path d="${cone}" fill="${c.main}"/>` + clip('kbk-caping', cone, weave) + `<path d="${cone}" fill="none" ${S(3)}/>` +
        `<path d="M-46 -70Q0 -61 46 -70L42 -64.5Q0 -56.5 -42 -64.5Z" fill="${c.accent}" ${S(2.2)}/>` +
        `<path d="M-3 -104L0 -110L3 -104Z" fill="${shade(c.main, -0.3)}" ${S(1.6)}/>` +
        // tunas terselip di pita
        `<g transform="translate(28 -68)"><path d="M0 0Q2 -10 -2 -16" fill="none" stroke="#3E8E4E" stroke-width="2.4" stroke-linecap="round"/><path d="M-2 -14Q-12 -18 -12 -10Q-6 -8 -2 -13Z" fill="#7CC57D" ${S(1.6)}/><path d="M-1 -11Q8 -18 10 -10Q4 -6 -1 -10Z" fill="#7CC57D" ${S(1.6)}/></g>` +
        // tali caping
        `<path d="M-42 -64Q-48 -50 -42 -38" fill="none" stroke="#C0392B" stroke-width="2" stroke-linecap="round"/><circle cx="-42" cy="-37" r="2.6" fill="#C0392B" stroke="${INK}" stroke-width="1.2"/>`;
    },
  },

  /* ---------- Kolam: topi rimba hijau zaitun dengan pelampung & lencana ikan ---------- */
  topikolam: {
    label: 'Topi kolam', slot: 'head', colors: { main: '#77955A', accent: '#4B6236' },
    draw: (c) =>
      `<path d="M-54 -61Q-44 -78 0 -79Q44 -78 54 -61Q30 -68 0 -68Q-30 -68 -54 -61Z" fill="${shade(c.main, -0.08)}" ${S(3)}/>` +
      `<path d="M-46 -64Q0 -73 46 -64" fill="none" stroke="${shade(c.main, 0.25)}" stroke-width="1.4" stroke-dasharray="3 3"/>` +
      `<path d="M-29 -74Q-31 -102 0 -103Q31 -102 29 -74Q0 -80 -29 -74Z" fill="${c.main}" ${S(3)}/>` +
      `<path d="M-29 -80Q0 -86 29 -80L29 -74Q0 -80 -29 -74Z" fill="${c.accent}" ${S(2)}/>` +
      [-1, 1].map((s) => `<circle cx="${s * 22}" cy="-92" r="2.2" fill="#C9D1DC" stroke="${INK}" stroke-width="1.2"/>`).join('') +
      // pelampung merah-putih disematkan
      `<g transform="translate(14 -92) rotate(18)"><path d="M0 -15V-10" stroke="${INK}" stroke-width="1.6"/><path d="M-5 -2A5 7 0 0 1 5 -2Z" fill="#E0583F" ${S(1.6)}/><path d="M-5 -2A5 7 0 0 0 5 -2Z" fill="#FFFDF7" ${S(1.6)}/><path d="M0 -10V-8.5" stroke="${INK}" stroke-width="1.6"/></g>` +
      // lencana ikan
      `<g transform="translate(-12 -91)"><path d="M-7 0Q-2 -5 4 0Q-2 5 -7 0Z" fill="#7FC4E8" ${S(1.4)}/><path d="M4 0L8 -3.4V3.4Z" fill="#7FC4E8" ${S(1.4)}/><circle cx="-3.6" cy="-0.6" r=".8" fill="${INK}"/></g>`,
  },

  /* ---------- Kolam: celana kodok anti air + sepatu bot kuning (bot digambar di atas kaki) ---------- */
  botkolam: {
    label: 'Celana kodok & sepatu bot', slot: 'body', colors: { main: '#3E6B5A', accent: '#F2C230', shirt: '#F3E3B5' },
    draw: (c) => {
      const bib = 'M-19 -27Q0 -24 19 -27L21 -16Q40 -14 62 -21V8H-62V-21Q-40 -14 -21 -16Z';
      return fabric(TEE, c.shirt) + ribCollar(shade(c.shirt, -0.12)) +
        [-1, 1].map((s) => `<path d="M${s * 16} -26L${s * 38} -38" stroke="${INK}" stroke-width="6.4" stroke-linecap="round"/><path d="M${s * 16} -26L${s * 38} -38" stroke="${shade(c.main, -0.15)}" stroke-width="3.2" stroke-linecap="round"/><circle cx="${s * 16}" cy="-25" r="2.4" fill="${c.accent}" stroke="${INK}" stroke-width="1.3"/>`).join('') +
        fabric(bib, c.main) + edge(bib) +
        `<path d="M-9 -22H9V-14H-9Z" fill="${shade(c.main, 0.12)}" ${S(1.6)}/><path d="M-9 -20H9" stroke="${INK}" stroke-width="1.2"/>` +
        // tetes air
        `<path d="M-30 -14q-2 3 0 4.4q2 -1.4 0 -4.4ZM28 -9q-2 3 0 4.4q2 -1.4 0 -4.4Z" fill="#BFE3F5" stroke="${INK}" stroke-width="1"/>`;
    },
    over: (c) => [-1, 1].map((s) => `<g transform="scale(${s} 1)"><path d="M6 -14Q6 -18 10 -18H27Q31 -18 31 -14V-2Q31 2 27 2H10Q6 2 6 -2Z" fill="${c.accent}" ${S(2.6)}/><path d="M6.6 -12.5H30.4" stroke="${shade(c.accent, -0.28)}" stroke-width="2.6"/><path d="M8 -1H29" stroke="${shade(c.accent, -0.4)}" stroke-width="2.2"/></g>`).join(''),
  },

  /* ---------- Mebel Jati: rompi bengkel kanvas dengan penggaris lipat, pensil tukang, amplas & serutan kayu ---------- */
  rompibengkel: {
    label: 'Rompi bengkel kayu', slot: 'body', colors: { main: '#8C6A43', accent: '#F2C230', shirt: '#E9EEF2' },
    draw: (c) => {
      const L = 'M-62 -42Q-30 -30 -13 -27L-8 8H-62Z';
      return fabric(TEE, c.shirt) + ribCollar(shade(c.shirt, -0.12)) +
        [1, -1].map((s) => `<g transform="scale(${s} 1)">${fabric(L, c.main)}${edge('M-13 -27L-8 8', 2.4)}<path d="M-15 -24L-11 6" stroke="${shade(c.main, 0.3)}" stroke-width="1.3" stroke-dasharray="2.4 2"/>` +
          `<rect x="-34" y="-17" width="16" height="12" rx="1.5" fill="${shade(c.main, -0.15)}" ${S(1.6)}/><path d="M-34 -14H-18" stroke="${shade(c.main, 0.2)}" stroke-width="1" stroke-dasharray="2 1.6"/></g>`).join('') +
        // penggaris lipat kuning & pensil tukang di saku kiri
        `<g transform="rotate(-10 -27 -18)"><rect x="-31" y="-31" width="5" height="16" fill="${c.accent}" ${S(1.3)}/><path d="M-31 -27h2.4M-31 -23h2.4M-31 -19h2.4" stroke="${INK}" stroke-width=".9"/></g>` +
        `<path d="M-22 -31L-20 -15" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M-22 -31L-20 -15" stroke="#E0583F" stroke-width="2.2" stroke-linecap="round"/>` +
        // amplas di saku kanan
        `<rect x="19" y="-25" width="12" height="9" rx="1" fill="#D9A55B" transform="rotate(8 25 -20)" ${S(1.3)}/><g fill="${shade('#D9A55B', -0.3)}" transform="rotate(8 25 -20)"><circle cx="22" cy="-22" r=".7"/><circle cx="26" cy="-21" r=".7"/><circle cx="29" cy="-23" r=".7"/><circle cx="24" cy="-19" r=".7"/></g>` +
        // serutan kayu keriting
        `<path d="M-40 -10q3 -3 5 0t5 0M33 -6q3 -3 5 0t5 0" fill="none" stroke="#E6C08A" stroke-width="2" stroke-linecap="round"/>`;
    },
    back: (c) => sleeves(c.shirt),
  },

  /* ---------- Butik Benang: pita meteran kuning menjuntai di leher dengan bantalan jarum ---------- */
  pitameteran: {
    label: 'Pita meteran', slot: 'neck', colors: { main: '#F2C230', accent: '#E0583F' },
    draw: (c) => {
      const tape = (d: string, n: number) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="8.4" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${c.main}" stroke-width="5.6" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${INK}" stroke-width="2.4" stroke-dasharray="0.9 ${n}"/>`;
      return tape('M-34 -31Q0 -15 34 -31', 3.1) +
        tape('M-30 -27Q-34 -12 -26 4', 3.1) + tape('M28 -28Q36 -18 31 -6', 3.1) +
        `<rect x="-30.5" y="2" width="9" height="6" rx="1" fill="#C9D1DC" ${S(1.6)}/><rect x="27" y="-8" width="9" height="6" rx="1" fill="#C9D1DC" transform="rotate(-12 31 -5)" ${S(1.6)}/>` +
        // bantalan jarum tomat kecil
        `<g transform="translate(-14 -20)"><circle r="5.4" fill="${c.accent}" ${S(1.6)}/><path d="M-3 -4.5L3 4.5M3 -4.5L-3 4.5" stroke="${shade(c.accent, -0.3)}" stroke-width="1"/><path d="M-2 -4L-5 -10M2 -4L4 -10" stroke="#C9D1DC" stroke-width="1.4"/><circle cx="-5" cy="-10.5" r="1.4" fill="#3F7FBF"/><circle cx="4" cy="-10.5" r="1.4" fill="#F7A8C4"/></g>`;
    },
  },

  /* ---------- Ronda: jaket gelap dengan sarung kotak diselempangkan & peluit ---------- */
  sarungronda: {
    label: 'Sarung ronda (diselempangkan)', slot: 'body', colors: { main: '#2E3A5E', accent: '#8E2F3C', line: '#F3E3B5' },
    draw: (c) => {
      const sash = 'M-62 -48L-36 -48L62 4V12H40Z';
      let plaid = `<rect x="-70" y="-60" width="140" height="80" fill="${c.accent}"/>`;
      for (let k = -8; k <= 8; k++) plaid += `<path d="M${k * 12} -60L${k * 12 + 60} 20" stroke="${shade(c.accent, -0.3)}" stroke-width="4" opacity=".7"/><path d="M${k * 12 + 4} -60L${k * 12 + 64} 20" stroke="${c.line}" stroke-width="1.1"/>`;
      for (let k = -6; k <= 8; k++) plaid += `<path d="M-70 ${k * 10}L70 ${k * 10 - 70}" stroke="${shade(c.accent, -0.3)}" stroke-width="3" opacity=".55"/>`;
      return fabric(TEE, c.main) + ribCollar(shade(c.main, 0.15)) +
        `<path d="M0 -24V8" stroke="${shade(c.main, 0.25)}" stroke-width="1.6"/>` +
        clip('kbk-ronda', sash, plaid) + edge('M-36 -48L62 4M-62 -44L40 12', 2.4) +
        // peluit di tali
        `<path d="M-18 -24Q-24 -14 -20 -8" fill="none" stroke="#E0583F" stroke-width="1.6"/><g transform="translate(-20 -6) rotate(-20)"><rect x="-6" y="-3" width="10" height="6" rx="3" fill="#C9D1DC" ${S(1.4)}/><circle cx="4" cy="0" r="3.2" fill="#C9D1DC" ${S(1.4)}/></g>`;
    },
    back: (c) => sleeves(c.main, shade(c.main, 0.25)),
  },

  /* ---------- Ronda: kentongan bambu bertali & pemukulnya ---------- */
  kentonganronda: {
    label: 'Kentongan', slot: 'hand', colors: { main: '#C9A15E', accent: '#7A5232' },
    draw: (c) =>
      `<path d="M41 -22Q45 -38 49 -50" fill="none" stroke="${c.accent}" stroke-width="1.8"/>` +
      `<g transform="rotate(6 50 -68)"><rect x="42" y="-92" width="15" height="44" rx="5.5" fill="${c.main}" ${S(2.6)}/>` +
      `<path d="M42.5 -80H56.5M42.5 -60H56.5" stroke="${shade(c.main, -0.3)}" stroke-width="1.8"/>` +
      `<rect x="47.5" y="-77" width="4.6" height="14" rx="2.3" fill="${INK}"/><path d="M45.5 -89.5q4 -3 8 0" fill="none" stroke="${shade(c.main, 0.3)}" stroke-width="1.4"/></g>` +
      // pemukul
      `<path d="M37 -20L61 -38" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M37 -20L61 -38" stroke="${c.accent}" stroke-width="2.6" stroke-linecap="round"/><circle cx="61.5" cy="-38.5" r="3.8" fill="${shade(c.accent, 0.2)}" ${S(1.8)}/>`,
  },
};

/* ------------------------------------------------------------------ */
/* Peta: Papan Lowongan & Pos Ronda                                    */
/* ------------------------------------------------------------------ */

/** Papan Lowongan (label di bawah, x,y = kaki papan di tepi jalan). Lebar gambar ±46, tinggi ±96. */
export function jobBoardSVG(x: number, y: number) {
  const note = (nx: number, ny: number, w: number, h: number, fill: string, rot: number, inner: string, pin: string) =>
    `<g transform="translate(${nx} ${ny}) rotate(${rot})"><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="1.5" fill="${fill}" stroke="${INK}" stroke-width="1.6"/>${inner}<circle cx="0" cy="${-h / 2 + 2.6}" r="2.2" fill="${pin}" stroke="${INK}" stroke-width="1"/></g>`;
  const lines = (w: number, ys: number[]) => ys.map((yy) => `<path d="M${-w / 2 + 3} ${yy}H${w / 2 - 3}" stroke="#9AA0B2" stroke-width="1.2"/>`).join('');
  return `<ellipse cx="${x}" cy="${y + 2}" rx="54" ry="7" fill="${INK}" opacity=".16"/><g class="lift">` +
    // tiang & atap kecil
    [-1, 1].map((s) => `<rect x="${x + s * 36 - 3.5}" y="${y - 82}" width="7" height="84" rx="2" fill="#8A5A36" stroke="${INK}" stroke-width="2.2"/>`).join('') +
    `<polygon points="${x - 50},${y - 80} ${x + 50},${y - 80} ${x + 40},${y - 96} ${x - 40},${y - 96}" fill="#C0603A" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<path d="M${x - 40} ${y - 88}H${x + 40}" stroke="${shade('#C0603A', -0.2)}" stroke-width="1.6"/>` +
    // papan gabus
    `<rect x="${x - 42}" y="${y - 78}" width="84" height="52" rx="3" fill="#D6A76A" stroke="${INK}" stroke-width="2.5"/>` +
    `<rect x="${x - 38}" y="${y - 74}" width="76" height="44" rx="2" fill="#E3BC84" stroke="${shade('#D6A76A', -0.3)}" stroke-width="1.2"/>` +
    // lembar lowongan dengan gambar kecil
    note(x - 24, y - 60, 22, 24, '#FFFDF7', -5, `<path d="M-6 -2h12l-2 6h-8Z" fill="#E8B04B" stroke="${INK}" stroke-width="1"/>` + lines(22, [7]), '#E0583F') +
    note(x, y - 57, 20, 26, '#FFF1B8', 3, `<path d="M0 6V-3M0 -1q-6 -2 -5 -7q5 0 5 7q0 -7 5 -7q1 5 -5 7" fill="#7CC57D" stroke="${INK}" stroke-width="1"/>` + lines(20, [9]), '#3F7FBF') +
    note(x + 23, y - 61, 22, 22, '#DDEFFB', -3, `<path d="M-6 0Q-1 -5 5 0Q-1 5 -6 0ZM5 0l4 -3v6Z" fill="#7FC4E8" stroke="${INK}" stroke-width="1"/>` + lines(22, [7]), '#F2B632') +
    note(x - 12, y - 39, 26, 14, '#FBE3EE', 2, lines(26, [-1, 3]), '#3FA06A') +
    note(x + 16, y - 38, 24, 14, '#FFFDF7', -4, lines(24, [-1, 3]), '#9A6FC0') +
    // rumput di kaki papan
    `<path d="M${x - 46} ${y}q2 -7 4 0q2 -7 4 0M${x + 38} ${y}q2 -7 4 0q2 -7 4 0" fill="none" stroke="#3E8E4E" stroke-width="2" stroke-linecap="round"/>` +
    `</g>`;
}

/** Pos Ronda: gardu panggung beratap genteng, kentongan & lampu teplok tergantung, bale bertikar (x,y = label). */
export function posRondaSVG(x: number, y: number) {
  const fy = y - 26; // lantai bale
  return `<ellipse cx="${x}" cy="${y - 6}" rx="56" ry="9" fill="${INK}" opacity=".16"/><g class="lift">` +
    // kaki panggung
    [-40, -14, 14, 40].map((dx) => `<rect x="${x + dx - 3}" y="${fy}" width="6" height="22" fill="#7A5232" stroke="${INK}" stroke-width="2"/>`).join('') +
    // tiang atap
    [-44, 44].map((dx) => `<rect x="${x + dx - 3.5}" y="${y - 76}" width="7" height="52" fill="#9A6A40" stroke="${INK}" stroke-width="2.2"/>`).join('') +
    // dinding belakang anyaman bambu (gedek) setengah tinggi
    `<rect x="${x - 41}" y="${y - 58}" width="82" height="30" fill="#E2C58E" stroke="${INK}" stroke-width="2"/>` +
    [-33, -22, -11, 0, 11, 22, 33].map((dx) => `<path d="M${x + dx} ${y - 58}V${y - 28}" stroke="#C9A66B" stroke-width="1.4"/>`).join('') +
    [-50, -42, -34].map((dy) => `<path d="M${x - 41} ${y + dy}H${x + 41}" stroke="#C9A66B" stroke-width="1.2"/>`).join('') +
    // lantai bale & tikar
    `<rect x="${x - 50}" y="${fy - 6}" width="100" height="9" rx="2" fill="#B07A45" stroke="${INK}" stroke-width="2.4"/>` +
    `<rect x="${x - 30}" y="${fy - 9}" width="44" height="4" rx="1" fill="#E9C46A" stroke="${INK}" stroke-width="1.4"/>` +
    // atap genteng
    `<polygon points="${x - 58},${y - 72} ${x + 58},${y - 72} ${x + 40},${y - 94} ${x - 40},${y - 94}" fill="#B5462E" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>` +
    [-84, -77].map((dy, i) => `<path d="M${x - 50 + i * 4} ${y + dy}H${x + 50 - i * 4}" stroke="${shade('#B5462E', -0.25)}" stroke-width="1.5"/>`).join('') +
    // kentongan tergantung di kanan
    `<path d="M${x + 34} ${y - 72}V${y - 66}" stroke="${INK}" stroke-width="1.6"/><rect x="${x + 29}" y="${y - 66}" width="10" height="26" rx="4" fill="#C9A15E" stroke="${INK}" stroke-width="2"/><rect x="${x + 32.5}" y="${y - 60}" width="3" height="11" rx="1.5" fill="${INK}"/>` +
    // lampu teplok di kiri
    `<path d="M${x - 32} ${y - 72}V${y - 64}" stroke="${INK}" stroke-width="1.6"/><path d="M${x - 37} ${y - 64}h10l-2 12h-6Z" fill="#FFE08A" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/><circle cx="${x - 32}" cy="${y - 57}" r="2.2" fill="#F2B632"/>` +
    // cangkir kopi di bale
    `<path d="M${x + 20} ${fy - 13}h7l-1 6h-5Z" fill="#FFFDF7" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>` +
    `</g>`;
}

/* ------------------------------------------------------------------ */
/* Ikon kartu papan lowongan (64 × 52)                                  */
/* ------------------------------------------------------------------ */

const ICON: Record<KerjaJob, string> = {
  warung:
    `<rect x="10" y="20" width="44" height="24" rx="2" fill="#FDF1D6" stroke="${INK}" stroke-width="2.4"/>` +
    `<path d="M6 20L12 8H52L58 20Z" fill="#3FA06A" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>` +
    [0, 1, 2, 3].map((i) => `<path d="M${16 + i * 10} 8L${14 + i * 11} 20H${19 + i * 11}L${21 + i * 10} 8Z" fill="#FFFDF7" opacity=".85"/>`).join('') +
    `<ellipse cx="32" cy="32" rx="14" ry="4" fill="#FFFFFF" stroke="${INK}" stroke-width="1.8"/><rect x="22" y="24" width="11" height="6" rx="3" fill="#E8B04B" stroke="${INK}" stroke-width="1.4" transform="rotate(-12 27 27)"/><rect x="31" y="23" width="11" height="6" rx="3" fill="#D9A040" stroke="${INK}" stroke-width="1.4" transform="rotate(10 36 26)"/>`,
  kebun:
    `<path d="M14 30H50L46 46H18Z" fill="#C9934E" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><path d="M16 36H48M17 41H47" stroke="#9A6A34" stroke-width="1.6"/>` +
    `<path d="M24 30L20 8" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M24 30L20 8" stroke="#F08A3C" stroke-width="3.4" stroke-linecap="round"/><path d="M20 8q-6 -4 -8 0M20 8q0 -7 4 -6" fill="none" stroke="#3E8E4E" stroke-width="2.2" stroke-linecap="round"/>` +
    `<circle cx="38" cy="25" r="8" fill="#E0583F" stroke="${INK}" stroke-width="2.2"/><path d="M34 18l4 3 4 -3" fill="none" stroke="#3E8E4E" stroke-width="2.2" stroke-linecap="round"/>`,
  kolam:
    `<path d="M4 38Q16 32 32 38T60 38V48H4Z" fill="#6EB7D6" stroke="${INK}" stroke-width="2.2"/><path d="M10 43q6 -3 12 0M34 44q6 -3 12 0" fill="none" stroke="#FFFFFF" stroke-width="1.8"/>` +
    `<g transform="translate(30 24) rotate(-24)"><path d="M-12 0Q-4 -8 8 0Q-4 8 -12 0Z" fill="#F2B632" stroke="${INK}" stroke-width="2"/><path d="M8 0L15 -6V6Z" fill="#F2B632" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><circle cx="-6" cy="-1" r="1.4" fill="${INK}"/></g>` +
    `<path d="M48 8V30" stroke="${INK}" stroke-width="2.4"/><path d="M42 26Q48 36 54 26" fill="none" stroke="${INK}" stroke-width="2"/><path d="M43 27h10M44 30h8" stroke="#9AA0B2" stroke-width="1"/>`,
  mebel:
    `<rect x="6" y="28" width="52" height="12" rx="2" fill="#C8955A" stroke="${INK}" stroke-width="2.4"/><path d="M12 34q8 -3 16 0t16 0" fill="none" stroke="#9A6A34" stroke-width="1.5"/>` +
    `<g transform="rotate(-14 34 18)"><rect x="20" y="12" width="26" height="12" rx="3" fill="#E0583F" stroke="${INK}" stroke-width="2.2"/><rect x="20" y="20" width="26" height="5" fill="#D9A55B" stroke="${INK}" stroke-width="1.6"/></g>` +
    `<path d="M50 24q3 -3 5 0t5 0M8 22q3 -3 5 0" fill="none" stroke="#E6C08A" stroke-width="2" stroke-linecap="round"/>`,
  butik:
    `<path d="M20 10L28 6Q32 10 36 6L44 10L52 18L46 24L42 21V44H22V21L18 24L12 18Z" fill="#9FD0E8" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>` +
    `<path d="M28 6Q32 13 36 6" fill="none" stroke="${INK}" stroke-width="1.8"/><path d="M32 14V40" stroke="#5B9BC0" stroke-width="1.6" stroke-dasharray="2.4 2.2"/>` +
    `<path d="M48 30L58 46" stroke="#C9D1DC" stroke-width="2.4" stroke-linecap="round"/><path d="M48 30Q38 38 46 44" fill="none" stroke="#E0583F" stroke-width="1.6"/>`,
  ronda:
    `<path d="M48 14A10 10 0 1 1 40 4A8 8 0 1 0 48 14Z" fill="#F2D16B" stroke="${INK}" stroke-width="2"/>` +
    `<path d="M14 8l1.4 3 3 1.4-3 1.4-1.4 3-1.4-3-3-1.4 3-1.4Z" fill="#F2D16B"/>` +
    `<path d="M26 6V12" stroke="${INK}" stroke-width="1.8"/><rect x="19" y="12" width="14" height="34" rx="5" fill="#C9A15E" stroke="${INK}" stroke-width="2.4"/><rect x="24" y="19" width="4" height="16" rx="2" fill="${INK}"/><path d="M19.5 22H32.5M19.5 38H32.5" stroke="#9A7440" stroke-width="1.6"/>` +
    `<path d="M38 46L54 28" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M38 46L54 28" stroke="#7A5232" stroke-width="2.6" stroke-linecap="round"/><circle cx="54.5" cy="27.5" r="3.6" fill="#9A6A40" stroke="${INK}" stroke-width="1.6"/>`,
};
/** Ikon tempat kerja untuk kartu papan lowongan, kartu pintu, & kartu gaji. */
export const kerjaIcon = (job: KerjaJob) => `<svg viewBox="0 0 64 52" aria-hidden="true">${ICON[job] ?? ''}</svg>`;

/** Amplop gaji (ikon kartu "Terima gaji"). */
export const AMPLOP_ICON = `<svg viewBox="0 0 64 52" aria-hidden="true"><g transform="rotate(-6 32 28)"><rect x="8" y="12" width="48" height="32" rx="3" fill="#F7E7C6" stroke="${INK}" stroke-width="2.6"/><path d="M8 14L32 32L56 14" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><circle cx="32" cy="31" r="5" fill="#E0583F" stroke="${INK}" stroke-width="1.8"/><circle cx="46" cy="10" r="7" fill="#F2B632" stroke="${INK}" stroke-width="2"/><path d="M46 6v8" stroke="#B9800F" stroke-width="2"/></g></svg>`;
