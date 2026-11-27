// Cerdas Cermat Kampung: gambar orisinal untuk kuis. Semua digambar sendiri dengan gaya game (garis tinta INK tebal,
// isian datar, sudut membulat). Tidak ada tulisan nama di dalam gambar.
//  - Pak Kancil (pembawa acara): kancil kartun berkacamata bulat & rompi batik, 4 ekspresi (netral, senang, hmm, sorak),
//    dan podium kayu dengan lonceng meja.
//  - 24 gambar tebak gambar (viewBox 160×120), satu per kunci KUIS_IMAGES.
import { INK } from './art';
import type { KuisImage } from './kuis';

const S = (w = 2.6) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const L = (d: string, w = 2.2, c = INK) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const P = (d: string, fill: string, w = 2.6) => `<path d="${d}" fill="${fill}" ${S(w)}/>`;
const E = (cx: number, cy: number, rx: number, ry: number, fill: string, w = 2.6) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" ${S(w)}/>`;
const C = (cx: number, cy: number, r: number, fill: string, w = 2.6) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${S(w)}/>`;
const R = (x: number, y: number, w: number, h: number, fill: string, rx = 2, sw = 2.6) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${S(sw)}/>`;
const eye = (x: number, y: number, r = 2.4) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${INK}"/><circle cx="${x - r * 0.35}" cy="${y - r * 0.4}" r="${r * 0.38}" fill="#fff"/>`;
const shadow = (cx = 80, cy = 106, rx = 60) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="5" fill="#000" opacity=".12"/>`;
const ground = (y = 104) => `<path d="M6 ${y}H154" stroke="${INK}" stroke-width="2" stroke-linecap="round" opacity=".35"/>`;

/* ------------------------------------------------------------------ */
/* Hewan                                                                */
/* ------------------------------------------------------------------ */

function komodo() {
  const B = '#8C8466', D = '#6B654E', Lb = '#B8AE8A';
  return shadow(82, 102, 70) +
    // kaki belakang & depan sisi jauh (lebih gelap)
    P('M70 84 L64 94 L58 99 L68 99 L74 92 Z', D, 2.4) + P('M110 82 L118 92 L124 98 L112 98 L104 90 Z', D, 2.4) +
    // ekor panjang & tebal
    P('M62 66 C44 70 24 82 4 100 C26 94 46 90 64 88 Z', B) +
    // badan rendah
    P('M58 66 C70 57 104 57 116 63 C125 68 124 83 112 86 C96 90 72 90 60 88 C50 85 50 70 58 66 Z', B) +
    // kepala pipih memanjang
    P('M108 61 C116 56 128 55 138 57 C146 59 152 62 154 66 C154 69 150 71 145 72 C134 75 122 78 112 82 Z', B) +
    `<path d="M66 86 C80 89 100 89 112 85 C110 80 100 82 92 82 C82 82 72 82 66 86 Z" fill="${Lb}" opacity=".7"/>` +
    // lidah bercabang kuning
    L('M152 68 L159 68 M159 68 L162 65 M159 68 L162 71', 2.2, '#E8B22A') +
    L('M128 71 Q140 71 151 68', 1.8) + eye(132, 62, 2.2) + L('M127 59 Q132 57 137 59', 1.8) + `<circle cx="149" cy="64" r="1.1" fill="${INK}"/>` +
    // kaki dekat bercakar
    P('M64 82 C62 90 56 96 50 99 L62 100 L70 92 L74 86 Z', B, 2.4) + L('M50 99 L46 101 M54 100 L51 103 M58 100 L56 103', 1.8) +
    P('M102 82 C106 90 112 95 118 98 L106 100 L98 92 L96 86 Z', B, 2.4) + L('M118 98 L122 100 M114 99 L117 102 M110 100 L112 103', 1.8) +
    // sisik & bintik
    [[72, 66], [84, 63], [96, 63], [106, 66], [78, 74], [92, 72], [104, 75], [48, 79], [36, 86]].map(([x, y]) => `<path d="M${x - 3} ${y}q3 -3 6 0" fill="none" stroke="${D}" stroke-width="1.6" stroke-linecap="round"/>`).join('');
}

function orangutan() {
  const F = '#C8632B', D = '#9A4520', SK = '#8C6A55', M = '#C9A086';
  return L('M8 18 Q80 6 152 20', 7, '#7A5232') + L('M8 18 Q80 6 152 20', 3.6, '#A8743F') +
    // lengan panjang ke dahan
    P('M70 52 C64 40 58 28 56 18 C60 14 68 14 70 18 C72 30 78 40 82 50 Z', F) +
    `<path d="M54 14 q5 -6 14 0 q-2 6 -6 6 q-6 0 -8 -6Z" fill="${SK}" ${S(2.2)}/>` +
    // badan berbulu panjang
    P('M64 56 C56 70 58 96 72 104 C80 108 96 108 104 100 C114 88 112 66 102 56 C92 50 74 50 64 56 Z', F) +
    L('M66 72 l-6 8 M64 86 l-6 6 M106 74 l6 8 M108 88 l6 6 M76 102 l-2 7 M90 104 l0 7 M100 100 l3 6', 2.4, D) +
    // lengan kanan menjuntai panjang
    P('M104 62 C116 70 124 86 124 104 C120 108 114 108 112 104 C112 90 108 80 100 72 Z', F) +
    `<ellipse cx="118" cy="106" rx="7" ry="5" fill="${SK}" ${S(2.2)}/>` +
    // kepala
    P('M70 30 C70 18 102 18 102 30 C106 44 100 58 86 58 C72 58 66 44 70 30 Z', F) +
    L('M72 22 l-4 -6 M86 18 l0 -6 M98 22 l4 -6', 2.4, D) +
    P('M76 36 C76 28 96 28 96 36 C98 46 94 54 86 54 C78 54 74 46 76 36 Z', SK, 2.2) +
    `<ellipse cx="86" cy="47" rx="7.5" ry="5.5" fill="${M}"/>` + eye(81, 38, 2) + eye(91, 38, 2) +
    `<circle cx="84" cy="45" r=".9" fill="${INK}"/><circle cx="88" cy="45" r=".9" fill="${INK}"/>` + L('M80 50 Q86 53 92 50', 1.8);
}

function gajah() {
  const G = '#9AA0A8', D = '#7C828B';
  return shadow(84, 104, 58) +
    R(44, 74, 13, 30, D, 4) + R(96, 74, 13, 30, D, 4) +
    L('M38 56 Q30 66 32 82', 2.4) + `<path d="M29 80 l3 6 l4 -5Z" fill="${INK}"/>` +
    P('M36 60 C36 36 72 28 98 34 C118 38 124 56 118 72 C112 86 86 88 62 86 C44 84 36 78 36 60 Z', G) +
    R(56, 76, 14, 28, G, 4) + R(106, 74, 14, 30, G, 4) +
    L('M58 102h10M108 102h10M46 102h9M98 102h9', 1.6, '#E9E4D6') +
    // kepala, telinga, belalai menjuntai
    P('M104 40 C110 26 136 24 142 40 C146 52 142 62 136 66 C140 78 142 90 138 98 C136 102 130 102 130 98 C132 88 130 78 124 70 C112 70 104 58 104 40 Z', G) +
    P('M112 40 C100 40 96 60 104 70 C110 74 118 70 120 62 C122 52 120 42 112 40 Z', D, 2.4) +
    L('M130 98 q-4 4 -8 0', 2.2) + P('M128 70 Q138 74 142 82 Q134 80 126 76 Z', '#FFFDF7', 2) + eye(134, 46, 2.3) + L('M136 66 q4 2 6 0', 1.6, D);
}

function badak() {
  const G = '#8F8A84', D = '#6F6A64';
  return shadow(82, 104, 62) +
    R(46, 78, 13, 26, D, 4) + R(92, 78, 13, 26, D, 4) +
    P('M34 64 C32 44 66 36 96 40 C116 42 122 56 120 72 C118 86 96 90 70 90 C46 90 36 82 34 64 Z', G) +
    // lipatan kulit seperti baju zirah (bahu & pinggul)
    L('M96 42 C90 56 90 74 96 88', 2.4, D) + L('M58 40 C52 56 52 74 58 90', 2.4, D) + L('M60 66 Q78 70 94 66', 1.8, D) +
    R(54, 80, 14, 24, G, 4) + R(100, 80, 14, 24, G, 4) +
    L('M30 60 q-6 4 -4 12', 2.2) +
    // kepala rendah, satu cula di moncong
    P('M112 50 C122 46 134 50 142 60 C148 66 152 74 150 80 C146 84 138 84 132 82 C124 80 116 76 112 70 Z', G) +
    P('M136 60 C138 50 142 42 144 36 C146 44 148 54 146 64 Z', '#D9CFC0', 2.4) +
    P('M118 52 C114 44 116 38 120 36 C124 40 124 46 122 52 Z', G, 2.2) +
    eye(128, 62, 2) + L('M146 78 q4 -2 5 -6', 1.8) + L('M124 74 Q132 78 140 77', 1.6, D);
}

function cenderawasih() {
  const BR = '#6B3427', Y = '#F2C94C', GR = '#2F8F5B', PL = '#F5CF5E', PL2 = '#FFF1BF';
  return L('M14 100 Q80 86 152 98', 7, '#7A5232') + L('M14 100 Q80 86 152 98', 3.6, '#A8743F') +
    // bulu hias panjang mengalir dari sisi badan
    [['M74 70 C56 64 36 70 18 88 C30 84 42 82 52 84', PL], ['M74 74 C58 74 42 84 30 104 C42 96 54 90 64 90', PL2], ['M72 66 C54 54 34 52 16 62 C30 64 44 68 54 74', PL2], ['M76 78 C66 86 58 98 56 114 C62 104 68 96 76 92', PL]]
      .map(([d, c]) => `<path d="${d} Z" fill="${c}" ${S(2.2)}/>`).join('') +
    L('M80 84 C84 98 74 108 64 112 M84 84 C92 100 86 112 78 118', 2, INK) +
    P('M70 60 C68 46 80 38 90 42 C98 46 98 62 94 74 C90 84 80 88 74 82 C70 78 70 70 70 60 Z', BR) +
    P('M76 66 C76 56 84 52 90 56 C94 62 92 74 86 78 C80 76 76 72 76 66 Z', '#86452F', 2) +
    // kepala kuning, leher hijau zamrud
    P('M80 30 C82 20 98 18 102 28 C104 36 100 44 92 46 C84 46 78 40 80 30 Z', Y) +
    P('M86 40 C88 46 96 48 100 42 C100 52 92 56 86 52 Z', GR, 2.2) +
    P('M101 30 L110 33 L101 37 Z', '#B8C4CC', 2) + eye(95, 30, 2.2) +
    L('M84 88 L82 96 M90 88 L92 96', 2.4);
}

function tarsius() {
  const F = '#A88D6F', D = '#86705A', IR = '#E8A33A';
  return L('M48 2 Q44 60 50 118', 9, '#6B4F35') + L('M48 2 Q44 60 50 118', 5, '#8A6A48') +
    // ekor panjang berumbai
    L('M64 92 C66 104 70 112 72 120', 2.4) + P('M69 112 q3 -2 6 2 q-1 6 -4 8 q-4 -4 -2 -10Z', D, 2) +
    // badan menempel di batang
    P('M54 64 C54 52 74 50 78 62 C82 76 78 94 66 96 C56 96 52 82 54 64 Z', F) +
    // kaki panjang menekuk
    P('M60 88 C52 86 46 90 46 96 L52 98 C56 94 62 94 66 92 Z', F, 2.2) + P('M70 84 C60 74 50 72 46 74 L46 80 C54 80 62 84 66 90 Z', F, 2.2) +
    // tangan berjari panjang dengan bantalan
    P('M58 62 C52 60 48 58 46 54 L48 50 C54 52 58 54 62 58 Z', F, 2.2) +
    `<circle cx="45" cy="50" r="2.2" fill="${F}" ${S(1.6)}/><circle cx="45" cy="55" r="2.2" fill="${F}" ${S(1.6)}/><circle cx="45" cy="76" r="2.2" fill="${F}" ${S(1.6)}/><circle cx="45" cy="96" r="2.2" fill="${F}" ${S(1.6)}/>` +
    // telinga besar tipis
    P('M58 26 C50 18 50 6 58 6 C66 6 66 18 64 26 Z', '#C7AE90', 2.2) + P('M92 26 C100 18 100 6 92 6 C84 6 84 18 86 26 Z', '#C7AE90', 2.2) +
    // kepala bulat dengan mata SANGAT besar
    C(75, 40, 20, F) +
    C(66, 38, 10, IR, 2.4) + C(85, 38, 10, IR, 2.4) +
    `<circle cx="66" cy="38" r="6" fill="${INK}"/><circle cx="85" cy="38" r="6" fill="${INK}"/><circle cx="63.5" cy="35" r="2.2" fill="#fff"/><circle cx="82.5" cy="35" r="2.2" fill="#fff"/>` +
    `<path d="M73.5 50 l1.5 1.6 l1.5 -1.6Z" fill="${INK}"/>` + L('M71 54 Q75 56 79 54', 1.6);
}

function anoa() {
  const B = '#4B3F37', D = '#382F29', W = '#E9E1D2', H = '#2A2320';
  return shadow(80, 104, 58) +
    R(48, 78, 11, 26, D, 4) + R(90, 78, 11, 26, D, 4) +
    P('M30 66 C28 50 56 42 86 44 C104 46 110 56 108 70 C106 84 88 88 64 88 C42 88 32 80 30 66 Z', B) +
    R(56, 80, 12, 24, B, 4) + R(98, 80, 12, 24, B, 4) +
    // kaus kaki pucat di kaki bawah
    `<rect x="57.3" y="94" width="9.4" height="8.5" fill="${W}"/><rect x="99.3" y="94" width="9.4" height="8.5" fill="${W}"/>` +
    L('M28 62 q-6 6 -4 14', 2.2) +
    // kepala sapi kecil, moncong lebar
    P('M98 54 C104 44 122 42 132 50 C138 56 146 66 146 74 C146 80 138 82 130 80 C120 78 106 74 100 66 Z', B) +
    `<path d="M132 76 C138 80 144 78 145 73" fill="none" stroke="${W}" stroke-width="2.4" stroke-linecap="round"/>` + `<ellipse cx="112" cy="72" rx="6" ry="3.2" fill="${W}" opacity=".85"/>` +
    `<circle cx="141" cy="70" r="1.3" fill="#9C8F86"/>` +
    // telinga mendatar ke samping
    P('M106 56 C98 54 92 58 92 61 C98 62 104 61 108 60 Z', '#5E5048', 2) +
    // tanduk lurus runcing, menyapu ke belakang sejajar dahi
    P('M116 48 C104 42 92 38 76 34 C88 40 100 48 112 54 Z', H, 2.2) + L('M110 47 l-2 5 M106 45 l-2 5', 1.2, '#6B5F57') +
    P('M122 46 C112 38 100 32 86 26 C96 34 106 42 118 50 Z', '#3A302A', 2.2) + L('M116 42 l-2 5', 1.2, '#6B5F57') +
    eye(124, 56, 2.1);
}

function penyu() {
  const SH = '#6E8B4E', SD = '#4E6B36', SK = '#9CB56E', W = '#BFE3EE';
  return `<rect x="0" y="0" width="160" height="120" rx="14" fill="${W}" opacity=".55"/>` +
    [[24, 20, 3], [136, 98, 4], [30, 100, 2.5], [140, 22, 2.5]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="#7FB8CC" stroke-width="1.4"/>`).join('') +
    // sirip depan panjang seperti dayung, sirip belakang kecil
    P('M96 42 C104 30 116 18 132 12 C134 18 124 32 108 48 Z', SK) + P('M96 78 C104 90 116 102 132 108 C134 102 124 88 108 72 Z', SK) +
    P('M56 44 C48 38 40 34 32 34 C34 42 42 48 54 52 Z', SK, 2.4) + P('M56 76 C48 82 40 86 32 86 C34 78 42 72 54 68 Z', SK, 2.4) +
    P('M48 60 L38 58 L48 64 Z', SK, 2) +
    // kepala berparuh
    P('M110 52 C118 46 130 48 136 56 C140 60 138 66 132 68 C124 70 114 68 110 64 Z', SK) + eye(126, 55, 2.1) + L('M136 61 q-4 1 -6 -1', 1.6) +
    // tempurung dengan sisik
    E(80, 60, 34, 26, SH) +
    P('M70 48 L80 42 L90 48 L90 60 L80 66 L70 60 Z', '#7FA05C', 2) + P('M70 60 L80 66 L80 78 L70 74 L62 66 Z', '#7FA05C', 2) + P('M90 60 L80 66 L80 78 L90 74 L98 66 Z', '#7FA05C', 2) +
    L('M62 50 L70 48 M98 50 L90 48 M58 62 L62 66 M102 62 L98 66 M80 42 L80 34', 1.8, SD);
}

function babirusa() {
  const G = '#A39690', D = '#7F736D', T = '#FFF8E8';
  const tusk = (d: string) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${T}" stroke-width="3.8" stroke-linecap="round"/>`;
  return shadow(78, 104, 58) +
    L('M48 84 L46 104 M86 84 L88 104', 6, D) + L('M48 84 L46 104 M86 84 L88 104', 3, '#8F837D') +
    P('M24 66 C22 50 50 44 78 46 C98 48 106 58 104 72 C102 84 84 88 60 88 C38 88 26 80 24 66 Z', G) +
    L('M54 86 L52 104 M94 84 L96 104', 6, INK) + L('M54 86 L52 104 M94 84 L96 104', 3.4, G) +
    L('M22 64 q-6 2 -6 10', 2) + L('M40 54 l4 -2 M52 52 l4 -2 M66 52 l4 -2 M80 52 l4 -2', 1.4, D) +
    // kepala besar & moncong panjang
    P('M94 52 C102 42 122 42 132 52 C140 58 148 64 152 70 C152 76 146 78 138 78 C126 78 110 74 100 66 Z', G) +
    `<ellipse cx="151" cy="72" rx="2.4" ry="4.4" fill="#C9A59C" ${S(1.8)}/>` +
    P('M102 52 C96 44 96 38 99 36 C104 38 107 44 107 50 Z', G, 2) + eye(114, 54, 2.2) +
    // taring bawah melengkung ke atas di sisi moncong
    tusk('M140 76 C146 66 144 56 136 50') +
    // taring atas menembus kulit moncong lalu melengkung ke dahi
    `<ellipse cx="132" cy="62" rx="3.6" ry="2" fill="${D}" ${S(1.4)}/>` + tusk('M132 62 C132 46 124 34 112 30 C106 28 102 32 106 36') +
    L('M136 74 q5 2 10 1', 1.6, D);
}

function harimau() {
  const O = '#E8862E', W = '#FFF6E6', K = INK;
  const stripe = (d: string, w = 2.6) => `<path d="${d}" fill="none" stroke="${K}" stroke-width="${w}" stroke-linecap="round"/>`;
  return shadow(82, 104, 62) +
    // ekor bergelang hitam
    `<path d="M34 60 C20 58 14 44 22 30" fill="none" stroke="${K}" stroke-width="9" stroke-linecap="round"/><path d="M34 60 C20 58 14 44 22 30" fill="none" stroke="${O}" stroke-width="5" stroke-linecap="round"/>` +
    stripe('M24 52 l5 -3 M19 44 l5 -1', 2.4) + `<circle cx="22" cy="30" r="3" fill="${K}"/>` +
    R(44, 76, 12, 28, '#C96F22', 5) + R(92, 76, 12, 28, '#C96F22', 5) +
    P('M34 62 C34 46 64 42 92 44 C112 46 120 56 118 70 C116 84 96 86 70 86 C48 86 34 78 34 62 Z', O) +
    `<path d="M50 84 C66 88 92 88 110 82 C100 78 70 80 50 84Z" fill="${W}"/>` +
    stripe('M52 46 C50 54 54 60 52 66') + stripe('M64 44 C62 52 66 58 64 64') + stripe('M76 44 C74 52 78 58 76 66') + stripe('M88 45 C86 52 90 58 88 64') + stripe('M42 52 C46 58 44 64 46 70') +
    R(54, 78, 12, 26, O, 5) + R(102, 76, 12, 28, O, 5) + stripe('M56 88 h8 M104 86 h8 M56 94 h8 M104 92 h8', 2) +
    // kepala
    P('M100 46 C100 32 112 24 124 24 C138 24 148 34 148 46 C148 58 138 66 124 66 C110 66 100 58 100 46 Z', O) +
    P('M104 36 C102 28 106 22 112 22 C114 26 112 30 110 32 Z', O, 2.2) + `<path d="M106 30 C105 27 107 25 109 25 C110 27 109 29 108 30Z" fill="${K}"/>` +
    P('M134 30 C134 24 140 20 144 22 C146 28 142 32 140 34 Z', O, 2.2) +
    `<path d="M128 46 C126 54 130 62 138 62 C146 60 148 52 146 46 C140 50 134 50 128 46Z" fill="${W}"/>` +
    stripe('M116 28 l2 8 M124 26 v7 M108 44 l6 2 M108 52 l6 0 M146 40 l-5 2', 2.2) +
    eye(128, 40, 2.3) + eye(140, 40, 2.3) + `<path d="M135 47 l3 2.6 l3 -2.6Z" fill="#E36A75" ${S(1.4)}/>` + L('M138 50 v3 M134 54 q4 3 8 0', 1.6);
}

/* ------------------------------------------------------------------ */
/* Rumah adat                                                           */
/* ------------------------------------------------------------------ */

function rumahGadang() {
  const ROOF = '#3B3530', RL = '#5A524A', W = '#8A5A36', RED = '#C0392B', GOLD = '#F2B632';
  const posts = [32, 50, 68, 92, 110, 128].map((x) => R(x - 2.5, 88, 5, 16, '#6B4428', 1, 2)).join('');
  return ground(104) + posts +
    R(28, 62, 104, 28, W, 2) +
    `<rect x="30" y="66" width="100" height="6" fill="${RED}"/>` + [36, 48, 60, 72, 84, 96, 108, 120].map((x) => `<path d="M${x} 72 l4 -6 l4 6Z" fill="${GOLD}"/>`).join('') +
    [40, 60, 92, 112].map((x) => R(x, 75, 10, 11, '#5E3A1F', 1.5, 2)).join('') +
    R(74, 74, 12, 16, '#5E3A1F', 1.5, 2) + L('M74 98 h12 M75 94 h10 M76 102 h8', 2) +
    // atap gonjong: lengkung cekung yang naik ke ujung-ujung runcing
    P('M8 12 Q22 44 40 46 Q52 44 57 6 Q64 40 80 42 Q96 40 103 6 Q108 44 120 46 Q138 44 152 12 L148 26 Q136 58 120 64 L40 64 Q24 58 12 26 Z', ROOF, 2.8) +
    L('M14 26 Q28 52 42 56 M146 26 Q132 52 118 56 M57 14 Q62 44 80 48 Q98 44 103 14', 1.6, RL) +
    L('M30 60 L130 60', 1.6, RL);
}

function joglo() {
  const T = '#B5543A', TD = '#8E3E2A', TL = '#D07052', W = '#C98B55', WD = '#8A5A36';
  return ground(106) +
    R(14, 92, 132, 10, '#BDB5A3', 2) +
    R(26, 64, 108, 28, W, 1.5) +
    [30, 54, 106, 130].map((x) => R(x - 2.5, 64, 5, 28, WD, 1, 2)).join('') +
    R(68, 70, 24, 22, '#7A4A2A', 1.5, 2) + L('M80 70 v22', 2) + R(40, 70, 10, 10, '#5E3A1F', 1, 2) + R(110, 70, 10, 10, '#5E3A1F', 1, 2) +
    // atap bawah lebar (penanggap)
    P('M6 66 L40 44 L120 44 L154 66 Z', T, 2.8) + L('M22 56 h116 M14 61 h132', 1.4, TD) +
    // atap tengah tinggi & curam (brunjung)
    P('M38 46 L64 10 L96 10 L122 46 Z', T, 2.8) + L('M52 28 h56 M45 37 h70 M58 19 h44', 1.4, TD) +
    L('M64 10 L96 10', 3.4, TD) + `<path d="M62 10 l-3 -5 l5 2Z M98 10 l3 -5 l-5 2Z" fill="${TL}" ${S(1.6)}/>`;
}

function honai() {
  const ST = '#C9A44C', SD = '#A8852F', W = '#7A5232';
  return ground(104) +
    [[16, 104], [144, 104], [26, 106], [134, 106]].map(([x, y]) => L(`M${x} ${y} l-3 -6 M${x} ${y} l0 -7 M${x} ${y} l3 -6`, 1.8, '#5DA05A')).join('') +
    // dinding bulat kayu
    P('M40 70 L40 98 Q80 108 120 98 L120 70 Z', W) +
    L('M50 72 v28 M60 74 v29 M70 74 v30 M90 74 v30 M100 74 v29 M110 72 v28', 1.6, '#5E3A1F') +
    R(72, 80, 16, 23, '#3B2A1E', 2, 2.2) +
    // atap jerami kerucut membulat
    P('M26 76 C30 46 56 14 80 10 C104 14 130 46 134 76 Q80 90 26 76 Z', ST, 2.8) +
    L('M40 70 Q60 40 78 16 M54 76 Q66 46 80 14 M80 80 V14 M106 76 Q94 46 80 14 M120 70 Q100 40 82 16', 1.5, SD) +
    L('M32 74 Q80 86 128 74', 1.8, SD) + L('M80 10 q-4 -6 2 -8', 2, '#9A9A9A');
}

function tongkonan() {
  const R1 = '#3B3530', RL = '#5A524A', RED = '#B5543A', Y = '#F2B632', WH = '#FFFDF7';
  const posts = [48, 64, 80, 96, 112].map((x) => R(x - 2.5, 82, 5, 22, '#4E3A2A', 1, 2)).join('');
  return ground(104) + posts +
    // tiang depan penopang atap, dengan tanduk kerbau bersusun
    R(18, 28, 6, 76, '#4E3A2A', 1, 2) +
    [40, 48, 56, 64].map((y) => `<path d="M12 ${y} q9 -7 18 0 q-9 -3 -18 0Z" fill="#E9E1D2" ${S(1.6)}/>`).join('') +
    // badan rumah berukir
    R(42, 56, 76, 28, RED, 1.5) +
    [50, 66, 82, 98].map((x) => `<rect x="${x}" y="60" width="12" height="20" fill="${INK}"/><circle cx="${x + 6}" cy="70" r="4" fill="${Y}"/><circle cx="${x + 6}" cy="70" r="1.6" fill="${WH}"/>`).join('') +
    L('M42 60 H118 M42 80 H118', 1.6, Y) +
    // atap melengkung seperti perahu, ujung depan & belakang mencuat tinggi
    P('M4 10 Q40 44 80 46 Q120 44 156 10 L150 26 Q116 58 80 60 Q44 58 10 26 Z', R1, 2.8) +
    L('M10 22 Q44 52 80 54 Q116 52 150 22', 1.6, RL) + L('M16 18 Q46 46 80 48 Q114 46 144 18', 1.2, RL);
}

/* ------------------------------------------------------------------ */
/* Alat musik                                                           */
/* ------------------------------------------------------------------ */

function angklung() {
  const B = '#E3C27A', BD = '#B8944A';
  const tube = (x: number, top: number, w: number) => {
    const cut = top + (98 - top) * 0.42;
    return P(`M${x} 98 L${x} ${cut} L${x + w * 0.25} ${cut} L${x + w * 0.25} ${top} Q${x + w / 2} ${top - 5} ${x + w * 0.75} ${top} L${x + w * 0.75} ${cut} L${x + w} ${cut} L${x + w} 98 Z`, B, 2.4) +
      L(`M${x} ${cut + (98 - cut) * 0.5} h${w}`, 1.6, BD) + `<ellipse cx="${x + w / 2}" cy="${top + 1}" rx="${w * 0.22}" ry="1.4" fill="${BD}"/>`;
  };
  return shadow(80, 108, 50) +
    // rangka
    R(40, 14, 6, 86, B, 2, 2.4) + R(114, 14, 6, 86, B, 2, 2.4) + R(36, 26, 88, 6, B, 3, 2.4) +
    L('M43 40 h0 M43 60 h0', 1) + L('M40 44 h6 M40 70 h6 M114 44 h6 M114 70 h6', 1.6, BD) +
    tube(54, 24, 22) + tube(84, 44, 20) +
    // tabung dasar mendatar
    R(30, 96, 100, 10, B, 5, 2.6) + L('M60 96 v10 M100 96 v10', 1.6, BD);
}

function sasando() {
  const LF = '#D9B55F', LD = '#A8852F', BB = '#C9B46A', BD = '#8E7A3A';
  return shadow(80, 110, 48) +
    // wadah gema dari lembaran daun lontar (melengkung terbuka)
    P('M26 34 C22 62 34 96 80 104 C126 96 138 62 134 34 C118 46 100 50 80 50 C60 50 42 46 26 34 Z', LF, 2.8) +
    L('M34 40 C34 66 46 90 66 100 M48 46 C50 70 60 90 74 102 M112 46 C110 70 100 90 86 102 M126 40 C126 66 114 90 94 100', 1.6, LD) +
    P('M26 34 C42 46 60 50 80 50 C100 50 118 46 134 34 C120 40 100 44 80 44 C60 44 40 40 26 34 Z', '#E8CB80', 2.2) +
    // tabung bambu dengan senar di sekelilingnya
    R(70, 10, 20, 96, BB, 4, 2.6) +
    [73, 76, 79, 82, 85, 88].map((x) => L(`M${x} 14 V102`, 1, INK)).join('') +
    L('M70 30 h20 M70 84 h20', 1.8, BD) + [72, 77, 83, 88].map((x) => `<circle cx="${x}" cy="12.5" r="1.6" fill="${BD}"/><circle cx="${x}" cy="103.5" r="1.6" fill="${BD}"/>`).join('');
}

function gong() {
  const W = '#8A5A36', G = '#D9A21B', GL = '#F2C14E', GD = '#A87A10';
  return ground(108) +
    R(22, 18, 8, 88, W, 2) + R(130, 18, 8, 88, W, 2) + R(12, 100, 28, 7, W, 2) + R(120, 100, 28, 7, W, 2) +
    P('M12 20 Q16 10 26 12 L134 12 Q144 10 148 20 L148 26 L12 26 Z', '#A8743F', 2.6) + L('M40 19 h80', 1.6, '#6B4428') +
    L('M62 26 L66 36 M98 26 L94 36', 2.2) +
    C(80, 66, 32, G, 2.8) + C(80, 66, 24, GL, 2) + C(80, 66, 10, G, 2.4) +
    `<ellipse cx="76" cy="62" rx="3.5" ry="2.5" fill="#FFF3C4"/>` + `<path d="M58 50 Q66 40 80 38" fill="none" stroke="#FFF3C4" stroke-width="2.4" stroke-linecap="round"/>` +
    L('M52 84 Q66 96 86 96', 1.8, GD);
}

function kendang() {
  const W = '#B07A44', WD = '#8A5A36', SK = '#F3E3C3', LA = '#6B4428';
  return shadow(82, 100, 56) +
    R(52, 90, 6, 12, WD, 1, 2) + R(108, 90, 6, 12, WD, 1, 2) +
    P('M34 44 Q80 24 128 34 L128 90 Q80 100 34 80 Z', W, 2.8) +
    L('M60 34 Q64 62 60 90 M100 30 Q104 62 100 96', 1.4, WD) +
    // tali kulit berbentuk huruf V
    L('M38 46 L56 84 L72 40 L88 92 L104 34 L122 92', 2, LA) + L('M38 78 L56 40 M72 90 L88 36 M104 94 L122 36', 1.4, LA) +
    E(34, 62, 6, 18, SK, 2.6) + E(128, 62, 8, 28, SK, 2.8) + E(128, 62, 4.5, 23, '#E8D2A8', 1.4);
}

function kolintang() {
  const BOX = '#8A5A36', TOP = '#A8743F', B1 = '#D99A5A', B2 = '#C9884A';
  const bars = Array.from({ length: 10 }, (_, i) => {
    const x = 26 + i * 11, len = 40 - i * 2.2, y = 58 - len / 2;
    return R(x, y, 9, len, i % 2 ? B2 : B1, 2, 2) + `<circle cx="${x + 4.5}" cy="${y + 4}" r="1.1" fill="${INK}"/><circle cx="${x + 4.5}" cy="${y + len - 4}" r="1.1" fill="${INK}"/>`;
  }).join('');
  return shadow(80, 108, 60) +
    R(26, 84, 6, 20, BOX, 1, 2) + R(128, 84, 6, 20, BOX, 1, 2) +
    // kotak gema
    P('M18 64 L142 52 L142 84 L18 90 Z', BOX, 2.6) + P('M18 64 L30 36 L142 30 L142 52 Z', TOP, 2.4) +
    L('M30 76 L130 70', 1.4, '#6B4428') +
    bars +
    // dua pemukul
    L('M96 104 L128 84 M110 106 L136 90', 2.4, '#6B4428') + C(128, 83, 4, '#E0583F', 2) + C(136, 89, 4, '#E0583F', 2);
}

function tifa() {
  const W = '#6B4428', WL = '#A8743F', SK = '#F0DDB4';
  return shadow(80, 110, 30) +
    // pegangan di samping
    `<path d="M94 32 C112 36 116 64 98 80" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M94 32 C112 36 116 64 98 80" fill="none" stroke="${W}" stroke-width="5" stroke-linecap="round"/>` +
    // badan berpinggang, mekar di bawah
    P('M60 22 L100 22 C98 40 90 52 90 66 C90 84 98 96 104 108 L56 108 C62 96 70 84 70 66 C70 52 62 40 60 22 Z', W, 2.8) +
    `<path d="M66 40 l6 8 l6 -8 l6 8 l6 -8" fill="none" stroke="${WL}" stroke-width="2"/>` +
    `<path d="M64 96 l5 -8 l5 8 l5 -8 l5 8 l5 -8 l5 8" fill="none" stroke="${WL}" stroke-width="2"/>` +
    `<circle cx="80" cy="66" r="5" fill="none" stroke="${WL}" stroke-width="2"/><path d="M80 61 q6 5 0 10" fill="none" stroke="${WL}" stroke-width="1.6"/>` +
    // kulit di atas & ikatan rotan
    E(80, 22, 20, 5, SK, 2.6) + L('M60 28 Q80 34 100 28', 2.2, '#C9A44C') + L('M62 32 Q80 38 98 32', 1.4, '#C9A44C');
}

/* ------------------------------------------------------------------ */
/* Lainnya                                                              */
/* ------------------------------------------------------------------ */

function keris() {
  const ST = '#A3ACB8', SD = '#6E7886', H = '#6B4428', G = '#E3B23C';
  return shadow(80, 112, 40) + `<g transform="translate(80 60) rotate(28) scale(1.08) translate(-62 -60)">` +
    // bilah berlekuk (luk), runcing ke atas
    P('M54 84 C50 76 60 70 56 62 C52 54 62 48 58 40 C54 32 62 26 60 18 L64 6 C70 14 66 22 70 30 C74 38 66 44 70 52 C74 60 66 66 70 74 C72 78 70 82 70 84 Z', ST, 2.4) +
    L('M62 80 C58 72 66 66 62 58 C58 50 66 44 62 36 C60 28 64 22 63 14', 1.4, SD) +
    // ganja (pangkal melebar ke satu sisi)
    P('M44 84 L78 84 L76 90 L50 92 Z', '#8C95A2', 2.2) +
    `<rect x="56" y="91" width="12" height="4" rx="1.5" fill="${G}" ${S(1.8)}/>` +
    // hulu kayu melengkung
    P('M56 95 C50 102 54 112 60 116 C66 118 72 114 70 108 C68 102 64 100 68 95 Z', H, 2.4) + L('M57 103 q4 2 9 0 M58 109 q4 2 8 0', 1.4, '#A8743F') +
    `</g>`;
}

function gunungan() {
  const G = '#D9A21B', GD = '#A87A10', RED = '#C0392B', GR = '#3FA06A', SK = '#2E5D8F';
  return `<path d="M80 96 V118" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M80 96 V118" stroke="#3B2A1E" stroke-width="2.6" stroke-linecap="round"/>` +
    // bentuk gunung / daun lancip
    P('M80 4 C92 26 132 52 130 84 L124 96 L36 96 L30 84 C28 52 68 26 80 4 Z', G, 2.8) +
    P('M80 14 C90 32 120 54 118 82 L114 90 L46 90 L42 82 C40 54 70 32 80 14 Z', '#F2C14E', 1.8) +
    // langit, pohon hayat & cabang melingkar
    `<path d="M80 18 C88 32 104 44 108 56 L52 56 C56 44 72 32 80 18Z" fill="${SK}" opacity=".85"/>` +
    L('M80 76 V24', 3, GD) +
    L('M80 60 C70 56 64 48 66 40 C68 36 72 38 70 42 M80 52 C90 48 96 40 94 32 C92 28 88 30 90 34 M80 42 C74 38 72 32 74 28 M80 66 C92 64 100 58 102 50', 2, GR) +
    [[66, 40], [94, 32], [74, 28], [102, 50], [60, 64], [100, 66]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="${RED}" ${S(1.4)}/>`).join('') +
    // gapura di bawah
    P('M64 90 L64 76 L72 70 L88 70 L96 76 L96 90 Z', RED, 2) + R(74, 78, 12, 12, '#3B2A1E', 1, 1.6) + L('M80 78 v12', 1.4, G) +
    [[40, 86], [120, 86], [50, 70], [110, 70], [58, 50], [102, 50]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="#FFF3C4"/>`).join('');
}

function becak() {
  const RED = '#C0392B', BL = '#3F7FBF', BLD = '#2E5D8F', F = '#4A4F68';
  const wheel = (cx: number, cy: number, r: number) => C(cx, cy, r, '#FFFDF7', 2.8) + C(cx, cy, r - 4, 'none', 1.6) +
    [0, 45, 90, 135].map((a) => { const t = (a * Math.PI) / 180, dx = Math.cos(t) * (r - 4), dy = Math.sin(t) * (r - 4); return L(`M${(cx - dx).toFixed(1)} ${(cy - dy).toFixed(1)} L${(cx + dx).toFixed(1)} ${(cy + dy).toFixed(1)}`, 1.2); }).join('') + C(cx, cy, 2.6, INK, 1);
  return shadow(84, 110, 64) +
    // rangka sepeda pengemudi di belakang
    L('M34 92 L52 64 L84 74 M52 64 L46 54 M40 54 h14 M58 90 L52 64 M58 90 L84 80', 3, F) +
    `<path d="M38 52 q8 -4 16 0 l-2 4 h-12Z" fill="${INK}"/>` + C(58, 90, 4, '#9AA0A8', 2) +
    wheel(34, 94, 14) +
    // kursi penumpang di depan
    P('M80 84 L80 62 Q80 56 86 56 L132 56 Q138 56 138 62 L138 84 Z', RED, 2.6) +
    `<rect x="86" y="64" width="44" height="12" rx="3" fill="#F2B632" ${S(1.8)}/>` + `<path d="M92 70 q6 -5 12 0 q6 5 12 0 q6 -5 10 0" fill="none" stroke="${RED}" stroke-width="1.8"/>` +
    // tenda lipat
    P('M84 58 C84 28 104 20 132 26 L140 58 Z', BL, 2.6) + L('M96 56 C96 34 108 26 124 28 M112 56 C112 38 120 30 132 30', 1.8, BLD) +
    L('M138 84 L148 92 L152 92', 3, F) +
    wheel(118, 94, 14);
}

function bedug() {
  const W = '#8A5A36', WD = '#6B4428', SK = '#F3E3C3', PEG = '#E3B23C';
  return ground(108) +
    // penyangga kayu
    P('M30 106 L44 64 L50 64 L40 106 Z', WD, 2.4) + P('M126 106 L114 64 L108 64 L118 106 Z', WD, 2.4) + R(24, 100, 112, 7, W, 2, 2.4) +
    // badan tabung kayu
    P('M38 32 Q76 22 112 26 L112 92 Q76 98 38 88 Z', W, 2.8) +
    L('M56 28 Q60 60 56 92 M84 25 Q88 60 84 95', 1.4, WD) +
    E(38, 60, 8, 28, '#7A4A2A', 2.4) +
    // kulit pukul & paku keliling
    E(112, 59, 22, 33, SK, 2.8) + E(112, 59, 18, 28, '#EAD6AE', 1.4) +
    Array.from({ length: 14 }, (_, i) => { const t = (i / 14) * Math.PI * 2; return `<circle cx="${(112 + Math.cos(t) * 20).toFixed(1)}" cy="${(59 + Math.sin(t) * 30.5).toFixed(1)}" r="1.5" fill="${PEG}" stroke="${INK}" stroke-width=".8"/>`; }).join('') +
    // pemukul
    L('M140 104 L150 74', 3.4, WD) + C(151, 70, 5, '#C0392B', 2.2);
}

/* ------------------------------------------------------------------ */
/* Daftar gambar                                                        */
/* ------------------------------------------------------------------ */

const DRAW: Record<KuisImage, () => string> = {
  komodo, orangutan, gajah, badak, cenderawasih, tarsius, anoa, penyu, babirusa, harimau,
  'rumah-gadang': rumahGadang, joglo, honai, tongkonan,
  angklung, sasando, gong, kendang, kolintang, tifa,
  keris, gunungan, becak, bedug,
};
const BG: Partial<Record<KuisImage, string>> = { penyu: 'none' };
/** isi gambar (viewBox 0 0 160 120) */
export const kuisImageInner = (key: string) => (Object.hasOwn(DRAW, key) ? DRAW[key as KuisImage]() : '');
/** gambar tebak gambar lengkap. label = teks alternatif untuk pembaca layar (JANGAN nama jawabannya) */
export function kuisImageSVG(key: string, label = 'Gambar soal') {
  const bg = BG[key as KuisImage] ?? '#FFF8E6';
  return `<svg viewBox="0 0 160 120" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg">${bg !== 'none' ? `<rect x="0" y="0" width="160" height="120" rx="14" fill="${bg}"/>` : ''}${kuisImageInner(key)}</svg>`;
}

/* ------------------------------------------------------------------ */
/* Pak Kancil, pembawa acara                                            */
/* ------------------------------------------------------------------ */

export type KancilMood = 'netral' | 'senang' | 'hmm' | 'sorak';
export const KANCIL_MOODS: KancilMood[] = ['netral', 'senang', 'hmm', 'sorak'];

/**
 * Pak Kancil (kancil kartun orisinal): tubuh cokelat hangat, garis putih di leher, telinga bulat kecil, mata besar,
 * kacamata bulat & rompi batik hijau. viewBox 0 0 120 150; kaki di y ±146. podium = berdiri di balik podium berlonceng.
 */
export function kancilSVG(mood: KancilMood = 'netral', opts: { podium?: boolean; ring?: boolean; label?: string } = {}) {
  const F = '#B9774A', FD = '#8E5530', FL = '#E8C29A', W = '#FFF8EC', V = '#3FA06A', VD = '#2B7A4E';
  const up = mood === 'sorak';
  // lengan (kaki depan) & kuku kecil
  // kuku kecil gelap (kancil berkuku belah)
  const hoof = (x: number, y: number, r = 0) => `<path transform="rotate(${r} ${x} ${y})" d="M${x - 3.6} ${y - 1} L${x + 3.6} ${y - 1} L${x + 3} ${y + 3.4} Q${x} ${y + 4.6} ${x - 3} ${y + 3.4} Z" fill="#3B2A1E" ${S(1.6)}/><path d="M${x} ${y} v3.6" transform="rotate(${r} ${x} ${y})" stroke="#7A5A44" stroke-width="1"/>`;
  const limb = (d: string) => L(d, 7, INK) + L(d, 3.6, F);
  const armL = up ? limb('M44 76 C36 66 30 54 28 42') + hoof(28, 40, 180)
    : limb('M44 78 C36 86 34 96 38 104') + hoof(38, 105);
  const armR = up ? limb('M76 76 C84 66 90 54 92 42') + hoof(92, 40, 180)
    : mood === 'hmm' ? limb('M76 78 C88 82 86 66 78 64') + hoof(77, 63, 120)
    : limb('M76 78 C84 86 86 96 82 104') + hoof(82, 105);
  const legs = limb('M52 120 L50 142 M68 120 L70 142') + hoof(50, 142) + hoof(70, 142);
  const body = P('M42 74 C40 96 44 118 60 122 C76 118 80 96 78 74 C72 68 48 68 42 74 Z', F) +
    // rompi batik
    P('M42 76 C40 96 44 116 54 120 L56 84 L48 74 Z', V, 2.2) + P('M78 76 C80 96 76 116 66 120 L64 84 L72 74 Z', V, 2.2) +
    [[47, 92], [48, 106], [73, 92], [72, 106]].map(([x, y]) => `<path d="M${x - 3} ${y}l3 -3l3 3l-3 3Z" fill="#F2C94C" stroke="${VD}" stroke-width="1"/>`).join('') +
    // dada putih bergaris (khas kancil)
    `<path d="M56 74 L60 96 L64 74Z" fill="${W}"/>` + L('M55 80 L60 84 L65 80 M56 87 L60 90 L64 87', 1.4, FL);
  const tail = `<path d="M44 112 q-8 -2 -8 -8" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M44 112 q-8 -2 -8 -8" fill="none" stroke="${W}" stroke-width="2.4" stroke-linecap="round"/>`;
  // kepala: menghadap sedikit ke kanan, moncong runcing
  // telinga kecil membulat di belakang kepala (bukan telinga tikus yang tinggi)
  const ears = P('M45 32 C39 27 38 20 42 18 C47 17 51 23 52 30 Z', F, 2.4) + `<path d="M45 29 C42 25 42 21 44 20.5 C47 21 49 25 49.5 29Z" fill="${FD}"/>` +
    P('M66 27 C66 20 71 15 75 17 C78 20 76 27 72 31 Z', F, 2.4) + `<path d="M68 27 C68.5 22 71.5 19 73.5 20 C75 22 73.5 26 71 29Z" fill="${FD}"/>`;
  const head = P('M40 46 C38 30 52 22 64 24 C76 26 84 34 90 44 C96 50 102 54 102 58 C102 63 96 66 88 66 C80 70 66 74 56 72 C44 70 40 60 40 46 Z', F, 2.6) +
    `<path d="M82 60 C88 62 96 62 100 58 C96 64 90 66 84 66Z" fill="${FL}"/>` +
    `<path d="M46 60 C50 68 58 70 66 69 C58 66 52 62 50 56Z" fill="${FL}" opacity=".9"/>` +
    `<ellipse cx="101" cy="56.5" rx="3.2" ry="2.6" fill="${INK}"/><circle cx="100.2" cy="55.6" r=".9" fill="#fff"/>` +
    L('M50 34 Q56 30 62 32', 1.6, FD);
  // mata & mulut per ekspresi
  const eyesOpen = (dx = 0) => `<ellipse cx="${60 + dx}" cy="44" rx="4.4" ry="5.2" fill="${INK}"/><ellipse cx="${75 + dx}" cy="43" rx="4" ry="4.8" fill="${INK}"/><circle cx="${58.6 + dx}" cy="42" r="1.6" fill="#fff"/><circle cx="${73.6 + dx}" cy="41" r="1.5" fill="#fff"/>`;
  let face = '';
  if (mood === 'netral') face = eyesOpen() + L('M78 62 Q84 66 90 63', 2);
  if (mood === 'senang') face = L('M55 45 Q60 39 65 45 M70 44 Q75 38 80 44', 2.6) + P('M78 61 Q86 70 94 62 Z', '#C44A5A', 2) + `<ellipse cx="54" cy="56" rx="4" ry="2.4" fill="#FF8FA3" opacity=".75"/>`;
  if (mood === 'hmm') face = eyesOpen(2) + L('M56 35 Q60 33 65 35 M71 32 Q76 28 81 31', 2) + L('M80 64 h8', 2.2);
  if (mood === 'sorak') face = L('M55 46 L60 41 L65 46 M70 45 L75 40 L80 45', 2.6) + P('M76 60 Q86 76 96 60 Q86 64 76 60 Z', '#C44A5A', 2.2) + `<ellipse cx="54" cy="56" rx="4" ry="2.4" fill="#FF8FA3" opacity=".75"/>`;
  // kacamata bulat
  const specs = mood === 'senang' || mood === 'sorak' ? '' : `<circle cx="${mood === 'hmm' ? 62 : 60}" cy="44" r="8" fill="none" stroke="${INK}" stroke-width="2"/><circle cx="${mood === 'hmm' ? 77 : 75}" cy="43" r="7.5" fill="none" stroke="${INK}" stroke-width="2"/>` + L(`M${mood === 'hmm' ? 70 : 68} 43.5 h${mood === 'hmm' ? 0 : 0}`, 2);
  const specsHappy = mood === 'senang' || mood === 'sorak' ? `<circle cx="60" cy="44" r="8" fill="none" stroke="${INK}" stroke-width="2" opacity=".9"/><circle cx="75" cy="43" r="7.5" fill="none" stroke="${INK}" stroke-width="2" opacity=".9"/>` : '';
  const sparkle = up ? [[18, 22, '#F2C94C'], [102, 22, '#E0583F'], [12, 58, '#3F7FBF'], [108, 60, '#3FA06A']].map(([x, y, c]) => `<path d="M${x} ${(y as number) - 6}l2 4l4 2l-4 2l-2 4l-2 -4l-4 -2l4 -2Z" fill="${c}" ${S(1.2)}/>`).join('') : '';
  const kancil = `<g class="kc-body">${tail}${legs}${body}${armL}${mood === 'hmm' ? '' : armR}${ears}${head}${face}${specs}${specsHappy}${mood === 'hmm' ? armR : ''}</g>${sparkle}`;
  const podium = opts.podium ? kancilPodium(!!opts.ring) : '';
  const vb = opts.podium ? '0 0 120 166' : '0 0 120 150';
  return `<svg viewBox="${vb}" class="kancil mood-${mood}" role="img" aria-label="${opts.label ?? 'Pak Kancil'}" xmlns="http://www.w3.org/2000/svg">${kancil}${podium}</svg>`;
}

/** podium kayu dengan lonceng meja (ring = lonceng sedang berdenting) */
export function kancilPodium(ring = false) {
  const W = '#B07A44', WD = '#8A5A36', G = '#E3B23C';
  return `<g class="kc-podium">` +
    P('M14 112 L106 112 L98 164 L22 164 Z', W, 2.8) + P('M8 104 L112 104 L112 114 L8 114 Z', '#C98B55', 2.6) +
    L('M26 126 H94 M24 140 H96 M23 152 H97', 1.6, WD) +
    `<circle cx="60" cy="138" r="9" fill="#F2C94C" ${S(2.2)}/><path d="M57 135 q3 -4 6 0 q0 3 -3 4 v2" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/><circle cx="60" cy="144" r="1.2" fill="${INK}"/>` +
    `<g class="kc-bell${ring ? ' ring' : ''}">` + P('M80 103 C80 92 100 92 100 103 Z', G, 2.4) + `<rect x="78" y="102" width="24" height="4" rx="2" fill="${WD}" ${S(2)}/>` + `<circle cx="90" cy="92" r="2.2" fill="${G}" ${S(1.8)}/>` +
    `<path d="M84 98 q3 -4 6 -4" fill="none" stroke="#FFF3C4" stroke-width="1.8" stroke-linecap="round"/></g>` +
    (ring ? `<g class="kc-ting">${L('M104 88 l6 -5 M106 96 l8 0 M104 104 l6 4', 2.4, '#E0583F')}</g>` : '') +
    `</g>`;
}

/** lonceng kecil (ikon "pertama benar" di Cerdas Cermat Bareng) */
export const BELL_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 18 C5 9 8 5 12 5 C16 5 19 9 19 18 Z" fill="#E3B23C" ${S(1.8)}/><rect x="3.5" y="17" width="17" height="3.2" rx="1.6" fill="#8A5A36" ${S(1.6)}/><circle cx="12" cy="4" r="1.6" fill="#E3B23C" ${S(1.4)}/></svg>`;
