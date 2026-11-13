// Gambar adegan kolam pancing (viewBox 0 0 420 440). Dipecah per lapisan supaya yang bergerak
// (pelampung, bayangan, ikan saat tarik-ulur) tidak menggambar ulang pet & kolam setiap frame.
import { INK, type SkyTime } from '@kb/shared';

export const VIEW = '0 0 420 440';
export type Dist = 'dekat' | 'sedang' | 'jauh';

/**
 * Panggilan server untuk alur mancing. Kolam di rumah memakai /api/fish/*; Lomba Mancing alun-alun
 * nanti cukup memberi fungsi lain (jatah & hadiah sendiri) tanpa mengubah FishingFlow.
 */
export interface FishApi {
  cast: (dist: Dist) => Promise<any>;
  hook: (castId: string) => Promise<any>;
  land: (castId: string) => Promise<any>;
  lost: (castId: string, reason: 'putus' | 'kendur' | 'batal') => Promise<any>;
}
/** titik pelampung per jarak */
export const SPOT: Record<Dist, [number, number]> = { dekat: [181, 229], sedang: [248, 261], jauh: [315, 294] };
/** ujung joran per pose */
export const TIP = { back: [24, 120], fwd: [96, 140], bent: [122, 150] } as const;
export type RodPose = keyof typeof TIP;
/** tepi dermaga: tujuan ikan saat ditarik */
export const DOCK: [number, number] = [146, 214];
const RING_C = [118, 198];
const RING_R: Record<Dist, number> = { dekat: 80, sedang: 165, jauh: 250 };
const GRASS = '#A9D18A';
const FONT = `font-family="'Baloo 2',ui-rounded,sans-serif" font-weight="800"`;

/** suasana per waktu langit: lapisan warna di atas adegan & warna latar di luar gambar */
export const SKY_TINT: Record<SkyTime, { col: string; op: number }> = {
  pagi: { col: '#FFF6E0', op: 0.18 },
  siang: { col: '#FFFFFF', op: 0 },
  sore: { col: '#F3A77E', op: 0.2 },
  malam: { col: '#1B2747', op: 0.52 },
};
function mix(a: string, b: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const x = p(a), y = p(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
export const skyBg = (sky: SkyTime) => mix(GRASS, SKY_TINT[sky].col, SKY_TINT[sky].op);

export const sparkle = (x: number, y: number, s = 1, col = '#FFF4B8') => {
  const r = (v: number) => Math.round(v * 10) / 10;
  return `<path d="M${x} ${r(y - 5 * s)}Q${r(x + s)} ${r(y - s)} ${r(x + 5 * s)} ${y}Q${r(x + s)} ${r(y + s)} ${x} ${r(y + 5 * s)}Q${r(x - s)} ${r(y + s)} ${r(x - 5 * s)} ${y}Q${r(x - s)} ${r(y - s)} ${x} ${r(y - 5 * s)}Z" fill="${col}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`;
};

/** kolam, rumput, dermaga (tetap selama di adegan) */
export function pondBase(sky: SkyTime) {
  let s = `<defs><clipPath id="kolam-clip"><ellipse cx="220" cy="300" rx="188.5" ry="118.5"/></clipPath></defs>`;
  s += `<rect x="-600" y="-400" width="1620" height="1300" fill="${GRASS}"/>`;
  s += `<g stroke="#86BB69" stroke-width="2.4" stroke-linecap="round" fill="none">${[[180, 60], [300, 40], [360, 120], [250, 150], [40, 300], [20, 420], [400, 430], [150, 110], [330, 180]].map(([x, y]) => `<path d="M${x} ${y}l3 -7l3 7l3 -6"/>`).join('')}</g>`;
  s += [[214, 96, '#FFFFFF'], [340, 70, '#F7C948'], [30, 380, '#FFFFFF'], [262, 30, '#F7A8C4']].map(([x, y, c]) => `<g transform="translate(${x} ${y})" fill="${c}"><circle r="3.4" cx="-3"/><circle r="3.4" cx="3"/><circle r="3.4" cy="-3"/><circle r="3.4" cy="3"/><circle r="2.2" fill="#F2B632"/></g>`).join('');
  // alang-alang di tepi kanan
  s += [[364, 236, -4, 176], [374, 233, 2, 166], [386, 240, 6, 180], [396, 246, 3, 192]].map(([x, y, dx, ty]) => `<path d="M${x} ${y}Q${x + dx} ${(y + ty) / 2} ${x + dx} ${ty}" fill="none" stroke="#4E8F4E" stroke-width="3" stroke-linecap="round"/><rect x="${x + dx - 3.5}" y="${ty - 4}" width="7" height="20" rx="3.5" fill="#8A5A36" stroke="${INK}" stroke-width="1.8"/>`).join('');
  s += `<path d="M358 250q-8 -30 -18 -44M402 254q6 -26 14 -40" fill="none" stroke="#5DA05A" stroke-width="3" stroke-linecap="round"/>`;
  // air
  s += `<ellipse cx="220" cy="300" rx="190" ry="120" fill="#6EB7D6" stroke="${INK}" stroke-width="3"/>`;
  s += `<g clip-path="url(#kolam-clip)"><ellipse cx="318" cy="338" rx="128" ry="80" fill="#5FA6C9" opacity=".7"/><ellipse cx="342" cy="360" rx="80" ry="48" fill="#5698BC" opacity=".6"/></g>`;
  s += `<path class="wave" d="M120 280q10 -6 20 0M260 340q10 -6 20 0M300 260q8 -5 16 0M170 360q8 -5 16 0" stroke="#FFFFFF" stroke-width="2.5" fill="none" opacity=".8"/>`;
  // teratai & batu
  s += `<g transform="translate(384 318) rotate(-8)"><path d="M0 0L14 -3A16 8 0 1 1 13 4Z" fill="#7CC57D" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/></g>`;
  s += `<g transform="translate(112 380)"><path d="M0 0L-14 -3A16 8 0 1 0 -13 4Z" fill="#7CC57D" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><g transform="translate(-2 -6)" stroke="${INK}" stroke-width="1.5"><path d="M0 0l-6 -6l4 -2Z" fill="#F7A8C4"/><path d="M0 0l6 -6l-4 -2Z" fill="#F7A8C4"/><path d="M0 0l0 -10l-3 3l3 -3l3 3Z" fill="#FBC7DA"/></g></g>`;
  s += `<g stroke="${INK}" stroke-width="2"><ellipse cx="40" cy="376" rx="14" ry="9" fill="#C9C2B0"/><ellipse cx="58" cy="392" rx="10" ry="7" fill="#B5AD9A"/><ellipse cx="404" cy="372" rx="11" ry="7" fill="#C9C2B0"/></g>`;
  if (sky === 'malam') s += `<g opacity=".9"><ellipse cx="300" cy="236" rx="22" ry="7" fill="#FFF4C8" opacity=".55"/><path d="M282 246h36M288 254h24" stroke="#FFF4C8" stroke-width="2.4" stroke-linecap="round" opacity=".5"/></g>`;
  // dermaga
  s += `<ellipse cx="90" cy="200" rx="40" ry="16" fill="#5DA05A" stroke="${INK}" stroke-width="2.5"/>`;
  s += `<rect x="0" y="176" width="120" height="22" fill="#B98B4E" stroke="${INK}" stroke-width="2.5"/><path d="M20 198v40M60 198v44M100 198v40" stroke="#8A5A36" stroke-width="6"/><path d="M30 176v22M60 176v22M90 176v22" stroke="#8A5A36" stroke-width="1.6" opacity=".6"/>`;
  if (sky === 'malam' || sky === 'sore') s += `<g><path d="M14 176V120" stroke="#8A5A36" stroke-width="4"/><path d="M14 122h12" stroke="#8A5A36" stroke-width="3"/><circle class="lamp" cx="26" cy="134" r="22" fill="#FFE9A8" opacity=".35"/><rect x="20" y="126" width="12" height="15" rx="3" fill="#FFE27A" stroke="${INK}" stroke-width="2"/></g>`;
  return s;
}

/** lapisan suasana di atas semuanya (malam gelap + kunang-kunang, sore jingga, pagi berkabut) */
export function skyLayer(sky: SkyTime) {
  const t = SKY_TINT[sky];
  let s = t.op ? `<rect x="-600" y="-400" width="1620" height="1300" fill="${t.col}" opacity="${t.op}" pointer-events="none"/>` : '';
  if (sky === 'pagi') s += `<g fill="#FFFFFF" opacity=".3" pointer-events="none"><ellipse class="mist" cx="160" cy="276" rx="120" ry="12"/><ellipse class="mist m2" cx="300" cy="322" rx="110" ry="10"/></g>`;
  if (sky === 'malam') {
    s += `<circle cx="26" cy="134" r="30" fill="#FFE9A8" opacity=".28"/><rect x="20" y="126" width="12" height="15" rx="3" fill="#FFE27A" stroke="${INK}" stroke-width="2"/>`;
    s += [[200, 120], [330, 150], [60, 280], [380, 400], [150, 60], [280, 90]].map(([x, y], i) => `<g class="fly f${i % 3}"><circle cx="${x}" cy="${y}" r="7" fill="#FFF4B8" opacity=".3"/><circle cx="${x}" cy="${y}" r="2.6" fill="#FFF4B8"/></g>`).join('');
  }
  return s;
}

/** lingkaran jarak & labelnya saat mengukur kekuatan lempar */
export function pondRings(on: Dist | null) {
  let s = `<g clip-path="url(#kolam-clip)">`;
  for (const k of ['dekat', 'sedang', 'jauh'] as Dist[]) {
    const r = RING_R[k], hi = on === k;
    s += `<ellipse cx="${RING_C[0]}" cy="${RING_C[1]}" rx="${r}" ry="${(r * 0.62).toFixed(1)}" fill="none" stroke="#FFFFFF" stroke-width="${hi ? 4 : 2.4}" ${hi ? '' : 'stroke-dasharray="7 7"'} opacity="${hi ? 0.95 : 0.6}"/>`;
  }
  s += `</g>`;
  const lab: Record<Dist, [number, number, number, string]> = { dekat: [140, 254, 50, 'Dekat'], sedang: [168, 309, 58, 'Sedang'], jauh: [196, 362, 44, 'Jauh'] };
  for (const k of ['dekat', 'sedang', 'jauh'] as Dist[]) {
    const [x, y, w, t] = lab[k], hi = on === k;
    s += `<g transform="translate(${x} ${y})"><rect x="${-w / 2}" y="-11" width="${w}" height="21" rx="10.5" fill="${hi ? '#F2B632' : '#FFFDF7'}" stroke="${INK}" stroke-width="2" opacity="${hi ? 1 : 0.85}"/><text y="5" text-anchor="middle" ${FONT} font-size="13.5" fill="${INK}">${t}</text></g>`;
  }
  return s;
}

/** bayangan ikan di bawah air, berpusat di 0,0 menghadap kiri (box = barang/harta) */
export function shadowSvg(size: string, glow = false) {
  if (size === 'box') return `<rect x="-15" y="-8" width="30" height="16" rx="4" fill="#24566E" opacity=".42"/><path d="M-8 -3h16" stroke="#FFFFFF" stroke-width="1.6" opacity=".35"/>` + sparkle(13, -10, 0.55, '#FFFFFF');
  const r = ({ S: 10, M: 16, L: 23, XL: 30 } as Record<string, number>)[size] ?? 16;
  let s = '';
  if (glow) s += `<ellipse rx="${r * 1.6}" ry="${r * 0.85}" fill="#FFF4B8" opacity=".35"/>`;
  s += `<g fill="#24566E" opacity=".5"><ellipse rx="${r}" ry="${(r * 0.42).toFixed(1)}"/><path d="M${r * 0.8} 0l${r * 0.6} ${(-r * 0.42).toFixed(1)}v${(r * 0.84).toFixed(1)}Z"/><path d="M${(-r * 0.1).toFixed(1)} ${(-r * 0.38).toFixed(1)}q${(r * 0.3).toFixed(1)} ${(-r * 0.3).toFixed(1)} ${(r * 0.6).toFixed(1)} 0Z"/></g>`;
  if (glow) s += sparkle(-r * 0.5, -r * 0.8, 0.8, '#FFFFFF') + sparkle(r, -r * 0.3, 0.6) + sparkle(-r * 1.3, r * 0.5, 0.55, '#FFFFFF');
  return s;
}

/** pelampung berpusat di 0,0; state: float | nibble | dunk; glow = lampu kecil (malam) */
export function bobberSvg(state: 'float' | 'nibble' | 'dunk', glow = false) {
  const B = (cy: number) => `<ellipse cx="0" cy="${cy}" rx="9" ry="6" fill="#FFFFFF" stroke="${INK}" stroke-width="2"/><path d="M-9 ${cy}h18" stroke="#E0583F" stroke-width="5"/><path d="M0 ${cy - 6}v-8" stroke="${INK}" stroke-width="2"/>` + (glow ? `<circle cy="${cy - 14}" r="8" fill="#FFF4B8" opacity=".55"/><circle cy="${cy - 14}" r="3" fill="#FFE27A" stroke="${INK}" stroke-width="1.4"/>` : '');
  if (state === 'float') return `<ellipse cy="5" rx="15" ry="5" fill="none" stroke="#FFFFFF" stroke-width="2" opacity=".7"/>` + B(0);
  if (state === 'nibble') return `<ellipse cy="6" rx="19" ry="6.5" fill="none" stroke="#FFFFFF" stroke-width="2.4" opacity=".85"/>` + B(3);
  return (
    `<ellipse cy="8" rx="40" ry="13" fill="none" stroke="#FFFFFF" stroke-width="2" opacity=".45"/>` +
    `<ellipse cy="8" rx="25" ry="8" fill="none" stroke="#FFFFFF" stroke-width="2.8" opacity=".9"/>` +
    `<path d="M0 4v-9" stroke="${INK}" stroke-width="2"/><path d="M-7 6a7 4.4 0 0 1 14 0Z" fill="#FFFFFF" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>` +
    `<g fill="#FFFFFF" stroke="${INK}" stroke-width="1.4"><path d="M-22 -6q-3 -5 0 -9q3 4 0 9Z"/><path d="M20 -8q-3 -5 0 -9q3 4 0 9Z"/><path d="M-11 -14q-2.4 -4 0 -7q2.4 3 0 7Z"/></g>` +
    `<text y="-22" text-anchor="middle" ${FONT} font-size="40" fill="#E0583F" stroke="${INK}" stroke-width="1.6">!</text>`
  );
}

/** ikan menyentak di permukaan saat tarik-ulur, berpusat di 0,0 */
export function splashSvg(calm = false) {
  let s = `<ellipse cy="2" rx="34" ry="11" fill="none" stroke="#FFFFFF" stroke-width="2.8" opacity=".9"/><ellipse cy="2" rx="52" ry="17" fill="none" stroke="#FFFFFF" stroke-width="2" opacity=".45"/>`;
  if (calm) return s + `<rect x="-14" y="-8" width="28" height="14" rx="4" fill="#24566E" opacity=".5"/>`;
  s += `<g transform="translate(6 0) rotate(18) scale(1.5)"><path d="M0 0C-2 -9 -11 -16 -16 -21C-7 -19 -1 -14 0 -9C1 -14 7 -19 16 -21C11 -16 2 -9 0 0Z" fill="#2C4F63" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/></g>`;
  s += `<g fill="#FFFFFF" stroke="${INK}" stroke-width="1.4">${[[-30, -12, 1], [-20, -26, 0.8], [26, -18, 1], [36, -6, 0.8], [8, -34, 0.7]].map(([dx, dy, k]) => `<path transform="translate(${dx} ${dy}) scale(${k})" d="M0 0q-4 -6 0 -11q4 5 0 11Z"/>`).join('')}</g>`;
  return s;
}

/** joran & gulungan (ujung joran sesuai pose); pet digambar terpisah supaya tidak digambar ulang */
export function rodSvg(pose: RodPose, spin = false) {
  const tip = TIP[pose];
  let s = '';
  if (pose === 'back') s += `<path d="M${tip[0]} ${tip[1]}q-3 14 0 26" fill="none" stroke="${INK}" stroke-width="1.6"/><g transform="translate(${tip[0]} ${tip[1] + 30}) scale(.8)"><ellipse rx="9" ry="6" fill="#FFFFFF" stroke="${INK}" stroke-width="2"/><path d="M-9 0h18" stroke="#E0583F" stroke-width="5"/></g>`;
  const rod = pose === 'bent' ? `M60 196Q84 140 ${tip[0]} ${tip[1]}` : `M${pose === 'back' ? 64 : 60} 196L${tip[0]} ${tip[1]}`;
  s += `<path d="${rod}" fill="none" stroke="#8A5A36" stroke-width="4" stroke-linecap="round"/>`;
  s += `<g transform="translate(${pose === 'back' ? 61 : 66} ${pose === 'back' ? 186 : 184})"><g class="${spin ? 'reel spin' : 'reel'}"><circle r="6" fill="#D9D2C3" stroke="${INK}" stroke-width="2"/><circle r="1.8" fill="${INK}"/><path d="M0 0l7 4" stroke="${INK}" stroke-width="2" stroke-linecap="round"/></g></g>`;
  return s;
}

/** keringat & garis usaha di dekat pet saat tegangan tinggi */
export const sweatSvg = `<path d="M104 112q-5 8 0 11q5 -3 0 -11Z" fill="#9FD0E8" stroke="${INK}" stroke-width="1.6"/><path d="M110 98l6 -4M112 106l7 -1" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;

/** gelembung kata kecil di atas pet ("sst…", "tuk…") */
export function bubbleSvg(text: string) {
  const w = text.length * 8.4 + 18;
  return `<g transform="translate(118 84)"><rect x="0" y="-16" width="${w.toFixed(0)}" height="28" rx="12" fill="#FFFDF7" stroke="${INK}" stroke-width="2.2"/><path d="M8 11l-8 9l14 -9" fill="#FFFDF7" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/><path d="M7 10.6h9" stroke="#FFFDF7" stroke-width="3"/><text x="9" y="4" ${FONT} font-size="15" fill="${INK}">${text}</text></g>`;
}

/** tali dari ujung joran ke titik (lengkung bila kendur) */
export function lineD(pose: RodPose, x: number, y: number, slack = 1) {
  const [tx, ty] = TIP[pose];
  if (slack <= 0.05) return `M${tx} ${ty}L${x.toFixed(1)} ${(y - 6).toFixed(1)}`;
  return `M${tx} ${ty}Q${((tx + x) / 2).toFixed(1)} ${(ty - 60 * slack).toFixed(1)} ${x.toFixed(1)} ${(y - 12).toFixed(1)}`;
}
