// Sahabat Mungil: sembilan hewan kecil yang menemani pet (anak ayam, umang-umang, anak bebek, kura-kura, burung pipit,
// kunang-kunang, kelinci mini, hamster pipi tembam, landak mini) + dua sahabat besar Edisi Natal (Beruang Es & Rusa
// Kutup, paket konten 24), ikon kartu, Camilan Sahabat, Kerang Hias, dan Pondok Sahabat di peta. Semua orisinal: garis
// tinta INK tebal, isian datar, menghadap ke kanan (dibalik saat jalan ke kiri).
//
// Koordinat = ruang pet (renderPet): kaki di (0,0), satu sahabat ±34 lebar & ±30 tinggi (pet ±100 × 110), jadi di rumah
// & peta cukup memakai skala pet yang sama. Bagian yang bergerak diberi kelas (diatur CSS game, app.css):
//   b-n = gambar biasa, b-t = gambar trik (disembunyikan; tampil saat kelas .trk), b-f = sayap terbuka (pipit terbang),
//   b-glow = cahaya kunang-kunang, b-pk = kepala mematuk / mengangguk.
// Edisi Natal (digambar langsung ±1,6× lebih besar): efek kecil berkelas nt-* (salju, lampu tanduk, jejak kilau, napas
// dingin, lonceng, bintang trik). Efek terus-menerus (salju & lampu) tampil diam di posisinya; jejak & bintang trik
// tersembunyi (opacity 0) sampai CSS menyalakannya (.mv / .trk / .idl).
// Foto Jepret tidak membawa CSS, jadi gambar dasar (b-n) selalu frame diam yang pas.
import { INK, shade, registerArt, registerMapPlace, type IconDef } from './art';
import { SAHABAT_INFO, SAHABAT_SPECIES, UMANG_COLORS, UMANG_DEFAULT, buddyScale, type SahabatSp } from './sahabat';

const f1 = (v: number) => Math.round(v * 10) / 10;
const S = (w = 2.4) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
/** gabung beberapa bentuk jadi satu siluet bergaris: garis tebal dulu, lalu isian tanpa garis menutup sambungan dalam */
const blob = (shapes: string[], fill: string, w = 4.6) =>
  shapes.map((s) => s.replace('/>', ` fill="${fill}" ${S(w)}/>`)).join('') + shapes.map((s) => s.replace('/>', ` fill="${fill}"/>`)).join('');
const eye = (x: number, y: number, r = 1.9) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${INK}"/><circle cx="${f1(x - r * 0.35)}" cy="${f1(y - r * 0.4)}" r="${f1(r * 0.38)}" fill="#FFFFFF"/>`;
const blush = (x: number, y: number) => `<ellipse cx="${x}" cy="${y}" rx="2.6" ry="1.5" fill="#FF8FA3" opacity=".75"/>`;
const shadow = (rx = 14) => `<ellipse cx="0" cy="-0.5" rx="${rx}" ry="3.4" fill="#000" opacity=".13"/>`;

/* ------------------------------------------------------------------ */
/* Gambar tiap jenis                                                    */
/* ------------------------------------------------------------------ */

type Draw = {
  n: string; t?: string; f?: string; collar: [number, number, number]; head: number; shadow: number;
  /** Edisi Natal: l = gambar berbaring (bantal), lcollar = letak kalung saat berbaring, ck = skala kalung emas */
  l?: string; lcollar?: [number, number, number]; ck?: number;
  /** efek di luar badan (tidak ikut bergoyang): fx = selalu tampil (salju), back = di belakang badan (jejak kilau, bintang
   * trik), glow = cahaya lembut lampu tanduk saat berdiri di samping pet (pose 'side') */
  fx?: string; back?: string; glow?: string;
};

function ayam(): Draw {
  const Y = '#F7D65A', dk = shade(Y, -0.18);
  const feet = `<path d="M-3 -2.5V0.5M-5.6 0.5H-0.6M4 -2.5V0.5M1.6 0.5H6.4" fill="none" stroke="#E98A2E" stroke-width="2.2" stroke-linecap="round"/>`;
  const body = blob([`<ellipse cx="-1" cy="-10.5" rx="12.5" ry="9.6"/>`, `<circle cx="7" cy="-20.5" r="8"/>`, `<path d="M-12 -12L-17.5 -17L-13.5 -8Z"/>`], Y);
  const head = `<g class="b-pk">${blob([`<circle cx="7" cy="-20.5" r="8"/>`], Y)}` +
    `<path d="M4 -27.6q0 -5 2.6 -5.6q0.4 2.8 0.6 3.4q1.4 -3.4 3.6 -2.6q-1 2.6 -2 4.2" fill="${Y}" ${S(1.8)}/>` +
    `<path d="M14.6 -22.4L20.4 -20.4L14.6 -18.2Z" fill="#F08A2E" ${S(1.8)}/>` + eye(10.4, -22.4) + blush(10.2, -17.4) + `</g>`;
  const wing = `<path d="M-7.5 -13.5q3 8 11 3.2q-3 -6 -11 -3.2Z" fill="${dk}" ${S(1.8)}/>`;
  return { n: feet + body + wing + head, collar: [7, -14.2, 16], head: 30, shadow: 13 };
}

function umang(shell: string): Draw {
  const B = '#F08A5D', dk = shade(shell, -0.22), lt = shade(shell, 0.35);
  const legs = `<path d="M3 -5.5L8 -0.5M6 -6.5L12 -1.5M9 -8L15.5 -3.6" fill="none" stroke="${INK}" stroke-width="3.6"/><path d="M3 -5.5L8 -0.5M6 -6.5L12 -1.5M9 -8L15.5 -3.6" fill="none" stroke="${B}" stroke-width="1.8"/>`;
  const eyes = (up: number) => `<path d="M10.5 ${-12 - up}L11.5 ${-19 - up}M14 ${-11.5 - up}L16 ${-18 - up}" fill="none" stroke="${INK}" stroke-width="1.8"/>` + `<circle cx="11.5" cy="${-20 - up}" r="2.2" fill="${INK}"/><circle cx="16.2" cy="${-19 - up}" r="2.2" fill="${INK}"/><circle cx="10.9" cy="${-20.8 - up}" r=".8" fill="#fff"/><circle cx="15.6" cy="${-19.8 - up}" r=".8" fill="#fff"/>`;
  const claw = `<path d="M13 -7.5Q19 -10.5 21.5 -6.5Q22.8 -3.8 19.8 -2.4L17.4 -4.6L16.2 -2Q12.6 -2.6 13 -7.5Z" fill="${B}" ${S(1.9)}/>`;
  const shellD = 'M-14 -4Q-18 -15 -9 -21Q-1 -26 6 -20Q11 -15 8 -8Q5 -2 -4 -2Q-11 -1 -14 -4Z';
  const shellS = `<path d="${shellD}" fill="${shell}" ${S(2.6)}/>` +
    `<path d="M-1 -12.5q3.2 -0.2 2.8 3q-0.8 3.4 -4.6 2.8q-4.8 -1.2 -3.8 -6q1.4 -5.4 7.4 -5q7.2 1.2 6.4 8.6" fill="none" stroke="${dk}" stroke-width="2.2" stroke-linecap="round"/>` +
    `<path d="M-12 -12q2 -6 8 -8" fill="none" stroke="${lt}" stroke-width="2.2" stroke-linecap="round"/>` +
    `<circle cx="-8" cy="-6.5" r="1.3" fill="${dk}"/><circle cx="-3" cy="-4.4" r="1.1" fill="${dk}"/>`;
  const body = `<path d="M5 -11Q12 -14 15 -9Q16 -4 9 -3.4L5 -4Z" fill="${B}" ${S(2)}/>`;
  const n = legs + body + claw + shellS + eyes(0);
  // trik: masuk ke kerang (hanya kerang & mata mengintip)
  const t = `<g transform="translate(0 0.6)">${shellS}</g><circle cx="6.4" cy="-10" r="1.8" fill="${INK}"/><circle cx="9.6" cy="-9.4" r="1.8" fill="${INK}"/><circle cx="6" cy="-10.6" r=".6" fill="#fff"/><circle cx="9.2" cy="-10" r=".6" fill="#fff"/>`;
  return { n, t, collar: [11, -10.5, 9], head: 26, shadow: 15 };
}

function bebek(): Draw {
  const Y = '#FBE48A', dk = shade(Y, -0.2), O = '#F08A2E';
  const feet = `<path d="M-4 -2.6V-0.4M3.6 -2.6V-0.4" stroke="${O}" stroke-width="2.4" stroke-linecap="round"/><path d="M-7.4 0.4L-4 -1.4L-0.6 0.4ZM0.2 0.4L3.6 -1.4L7 0.4Z" fill="${O}" ${S(1.5)}/>`;
  const body = blob([`<ellipse cx="-2" cy="-9.5" rx="13.5" ry="8.6"/>`, `<path d="M-13 -11L-19 -17.5L-13.5 -6Z"/>`, `<rect x="2.4" y="-21" width="7.6" height="10" rx="3.6"/>`, `<circle cx="7.4" cy="-23.4" r="7.4"/>`], Y);
  const head = `<g class="b-pk">${blob([`<circle cx="7.4" cy="-23.4" r="7.4"/>`], Y)}` +
    `<path d="M13 -24.6Q20 -25.6 20.6 -22.6Q20.4 -20.2 13.6 -20.4Z" fill="${O}" ${S(1.8)}/><path d="M13.8 -22.6H19.6" stroke="${shade(O, -0.3)}" stroke-width="1.1"/>` +
    eye(10, -25.6) + blush(9.4, -20.2) + `<path d="M5 -30.4q1.2 -3.4 3.4 -2.2" fill="none" ${S(1.8)}/></g>`;
  const wing = `<path d="M-9 -12q5 7.6 12 2.6q-4 -6 -12 -2.6Z" fill="${dk}" ${S(1.8)}/>`;
  const wingUp = `<path d="M-6 -14Q-16 -26 -6 -30Q0 -22 2 -14Z" fill="${dk}" ${S(1.8)}/><path d="M-6 -24l3 3M-8 -20l3 3" stroke="${shade(dk, -0.2)}" stroke-width="1.2"/>`;
  return { n: feet + body + `<g class="b-n2">${wing}</g>` + head, t: feet + body + wingUp + head, collar: [6.4, -16.2, 13], head: 33, shadow: 14 };
}

function kura(): Draw {
  const SH = '#6FAE58', SK = '#B5D86A', dk = shade(SH, -0.28), rim = shade(SH, 0.25);
  const legs = `<g fill="${SK}" ${S(2)}><path d="M-11 -6V0H-6.4V-6Z"/><path d="M5 -6V0H9.6V-6Z"/></g>`;
  const tail = `<path d="M-15 -6L-19.6 -4.4L-15 -3.6Z" fill="${SK}" ${S(1.8)}/>`;
  const shell = `<path d="M-16 -5Q-16 -21 -2 -21.6Q12 -21 12.6 -5Z" fill="${SH}" ${S(2.6)}/>` +
    `<path d="M-6.6 -19.4L-3 -14.6H3.4L6.4 -19.2M-3 -14.6L-5.6 -6.4M3.4 -14.6L5.8 -6.4M-12 -11.4L-5.6 -11M12 -11.4L4.8 -11" fill="none" stroke="${dk}" stroke-width="1.6" stroke-linecap="round"/>` +
    `<path d="M-17.6 -5.4H14.2V-2.2H-17.6Z" fill="${rim}" ${S(2.2)}/>`;
  const headN = `<g class="b-pk"><path d="M11 -9.6Q11 -14.6 16 -14.6Q21 -14.6 21 -9.4Q21 -5.2 16 -5.2Q12.6 -5.2 11 -7.6Z" fill="${SK}" ${S(2.2)}/>${eye(17.2, -10.8, 1.7)}<path d="M18.2 -7.4q1.4 0.8 2.4 -0.4" fill="none" ${S(1.3)}/></g>`;
  // trik: leher memanjang ke atas, tersenyum
  const headT = `<path d="M9 -8Q14 -10 15 -18L19.8 -18Q19.6 -10 13 -4.4Z" fill="${SK}" ${S(2.2)}/><circle cx="18" cy="-22.6" r="5.8" fill="${SK}" ${S(2.2)}/>${eye(19.6, -24, 1.7)}<path d="M18.6 -20.4q1.8 1.6 3.6 -0.2" fill="none" ${S(1.4)}/>${blush(20.8, -21)}`;
  return { n: tail + legs + headN + shell, t: tail + legs + headT + shell, collar: [12.4, -9.6, 7], head: 22, shadow: 17 };
}

function pipit(): Draw {
  const BR = '#A9764F', CAP = '#8B5A3C', BEL = '#F1E3CC', dk = shade(BR, -0.25);
  const legs = `<path d="M-1.6 -2.6V0.4M2.6 -2.6V0.4" stroke="${INK}" stroke-width="1.5"/>`;
  const tail = `<path d="M-9 -9L-19.4 -14.4L-17.6 -9.2L-20 -6.6L-8.6 -5.4Z" fill="${dk}" ${S(1.8)}/>`;
  const body = blob([`<ellipse cx="-1" cy="-8.6" rx="9.6" ry="7"/>`, `<circle cx="5.6" cy="-15" r="6.6"/>`], BEL);
  const back = `<path d="M-9.8 -9.6Q-9 -15.8 0 -15.2Q-3 -9 -9.8 -9.6Z" fill="${BR}" ${S(1.6)}/>`;
  const head = `<g class="b-pk"><path d="M0.6 -16.4Q1 -22 6 -21.8Q11 -21.6 12 -17.4Q7.6 -18.6 0.6 -16.4Z" fill="${CAP}" ${S(1.6)}/>` +
    `<path d="M11.8 -16.8L16.6 -15.2L11.8 -13.4Z" fill="#4C4F63" ${S(1.4)}/>` + eye(8.6, -16.6, 1.6) +
    `<path d="M7.6 -12.2q2.6 1.8 4.6 0.2" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/><ellipse cx="4" cy="-13" rx="2.6" ry="1.8" fill="#FFFFFF" opacity=".9"/></g>`;
  const wing = `<path d="M-7.8 -10.6Q-2 -14 4 -9.6Q-1 -4.8 -7.8 -10.6Z" fill="${BR}" ${S(1.8)}/><path d="M-4.4 -10.4l2.4 2M-1.4 -10.8l2.2 2" stroke="${dk}" stroke-width="1.1"/>`;
  const wingsUp = `<path d="M-5 -12Q-14 -26 -2 -28Q2 -20 2 -12Z" fill="${BR}" ${S(1.8)}/><path d="M-3.6 -22l2 2M-5.6 -18l2 2" stroke="${dk}" stroke-width="1.1"/>` +
    `<path d="M-1 -12Q6 -27 14 -22Q8 -16 3 -10Z" fill="${shade(BR, 0.12)}" ${S(1.8)}/>`;
  return { n: legs + tail + body + back + wing + head, f: tail + body + back + head + wingsUp, collar: [4.6, -10, 9], head: 24, shadow: 10 };
}

function kunang(): Draw {
  const GL = '#E9F56A', BD = '#3B3F55', WG = '#8E4A3A';
  const glow = `<g class="b-glow"><circle cx="-6" cy="-12" r="15" fill="#F6FF9E" opacity=".22"/><circle cx="-6" cy="-12" r="9" fill="#F6FF9E" opacity=".38"/></g>`;
  const body = `<ellipse cx="-6.4" cy="-12" rx="6" ry="5" fill="${GL}" ${S(2)}/><path d="M-9 -15.6v7.2M-6 -16.4v8.8" stroke="${shade(GL, -0.25)}" stroke-width="1"/>` +
    `<path d="M-3 -16Q4 -19 8 -14Q8 -9 1 -8.6Q-3 -9.4 -3 -16Z" fill="${WG}" ${S(2)}/><path d="M1.6 -17.6L2 -8.8" stroke="${shade(WG, -0.3)}" stroke-width="1.2"/>` +
    `<circle cx="9.6" cy="-13" r="4" fill="${BD}" ${S(1.8)}/><circle cx="10.8" cy="-13.8" r="1.2" fill="#FFFFFF"/>` +
    `<path d="M11.4 -16.4Q13.6 -21 17 -20.6M10 -16.8Q10.6 -22 13.4 -23" fill="none" stroke="${INK}" stroke-width="1.4"/>`;
  const wings = `<ellipse cx="-1" cy="-20" rx="6.4" ry="3.4" transform="rotate(-24 -1 -20)" fill="#FFFFFF" opacity=".72" ${S(1.4)}/><ellipse cx="4" cy="-20.6" rx="5.6" ry="3" transform="rotate(-48 4 -20.6)" fill="#FFFFFF" opacity=".6" ${S(1.4)}/>`;
  return { n: glow + body + wings, collar: [7.6, -10.4, 6], head: 20, shadow: 7 };
}

function kelinci(): Draw {
  const W = '#FBF4EA', IN = '#F7B8C6', dk = shade(W, -0.12);
  const tail = `<circle cx="-13.6" cy="-8.6" r="4.6" fill="#FFFFFF" ${S(2)}/>`;
  const earB = `<ellipse cx="2.4" cy="-34" rx="3.6" ry="9.4" transform="rotate(-16 2.4 -34)" fill="${dk}" ${S(2.2)}/>`;
  const body = blob([`<ellipse cx="-2" cy="-9.8" rx="12.4" ry="9.6"/>`, `<circle cx="7.6" cy="-19.6" r="7.8"/>`], W);
  const earF = `<ellipse cx="7.4" cy="-33" rx="3.8" ry="9.8" transform="rotate(8 7.4 -33)" fill="${W}" ${S(2.2)}/><ellipse cx="7.4" cy="-32.6" rx="1.6" ry="6.6" transform="rotate(8 7.4 -32.6)" fill="${IN}"/>`;
  const face = eye(10.8, -21) + `<path d="M14.6 -18.6l1.6 1.2l-1.8 0.8Z" fill="#F38BA0" ${S(1)}/><path d="M12.6 -16q1.6 1.2 3 0" fill="none" ${S(1.2)}/>` + blush(10.6, -16.4);
  const paws = `<ellipse cx="6" cy="-1.6" rx="3.6" ry="2" fill="${W}" ${S(1.8)}/><ellipse cx="-6" cy="-1.4" rx="5" ry="2.2" fill="${W}" ${S(1.8)}/>`;
  return { n: tail + earB + body + `<g class="b-pk">${earF}</g>` + face + paws, collar: [7.4, -12.4, 13], head: 38, shadow: 14 };
}

function hamster(): Draw {
  const O = '#F2B266', BL = '#FFF4E0', dk = shade(O, -0.2);
  const ears = `<circle cx="-6" cy="-22.6" r="3.8" fill="${O}" ${S(2)}/><circle cx="-6" cy="-22.6" r="1.7" fill="#F7B8C6"/><circle cx="8" cy="-22.6" r="3.8" fill="${O}" ${S(2)}/><circle cx="8" cy="-22.6" r="1.7" fill="#F7B8C6"/>`;
  const body = blob([`<ellipse cx="1" cy="-11.4" rx="13.6" ry="11.4"/>`], O);
  const belly = `<ellipse cx="1" cy="-4.6" rx="8.6" ry="4.6" fill="${BL}"/>`;
  const stripe = `<path d="M1 -22.6v4" stroke="${dk}" stroke-width="2.2" stroke-linecap="round"/>`;
  const face = (puff: boolean) =>
    `<ellipse cx="1" cy="-11.2" rx="6.4" ry="4.4" fill="${BL}"/>` +
    (puff
      ? `<circle cx="-8.2" cy="-11.4" r="6.4" fill="${BL}" ${S(2)}/><circle cx="10.2" cy="-11.4" r="6.4" fill="${BL}" ${S(2)}/>${blush(-8.2, -10.6)}${blush(10.2, -10.6)}`
      : `${blush(-6.4, -11.2)}${blush(8.4, -11.2)}`) +
    eye(-3.6, -16, 2) + eye(5.6, -16, 2) +
    `<path d="M-0.4 -12.8h2.8l-1.4 1.4Z" fill="#F38BA0" ${S(1)}/><path d="M-1 -10.2q2 1.6 4 0" fill="none" ${S(1.2)}/>`;
  const paws = `<ellipse cx="-3.4" cy="-7.4" rx="2.2" ry="1.5" fill="${shade(O, 0.2)}" ${S(1.3)}/><ellipse cx="5.4" cy="-7.4" rx="2.2" ry="1.5" fill="${shade(O, 0.2)}" ${S(1.3)}/><path d="M-6.4 0.2h4M4.4 0.2h4" stroke="${dk}" stroke-width="2.4" stroke-linecap="round"/>`;
  return { n: ears + body + belly + stripe + face(false) + paws, t: ears + body + belly + stripe + face(true) + paws, collar: [1, -5.6, 15], head: 30, shadow: 14 };
}

function landak(): Draw {
  const SP = '#8A6A4F', TIP = '#D9BE97', FC = '#F4DDB8';
  let spikes = '';
  for (let k = 0; k <= 8; k++) {
    const a = Math.PI * (0.98 - k * 0.1), r0 = 11, r1 = 16.6;
    const cx = -3, cy = -9;
    const p = (rr: number, da: number) => `${f1(cx + Math.cos(a + da) * rr)} ${f1(cy - Math.sin(a + da) * rr)}`;
    spikes += `M${p(r0, -0.1)}L${p(r1, 0)}L${p(r0, 0.1)}`;
  }
  const back = `<path d="${spikes}Z" fill="${SP}" ${S(2)}/><path d="M-17 -6Q-17 -21.6 -3 -21.6Q9.6 -21 10.4 -8.6Q2 -2.2 -17 -6Z" fill="${SP}" ${S(2.4)}/>` +
    `<path d="M-12 -14l2 -3M-6 -17l1.4 -3M0 -16.4l1.6 -3M-9 -9.4l2 -3M-3 -11l1.6 -3" stroke="${TIP}" stroke-width="1.8" stroke-linecap="round"/>`;
  const face = `<g class="b-pk"><path d="M4 -16Q12 -15 18.6 -8.6Q16 -4 6 -3.6Q2 -9 4 -16Z" fill="${FC}" ${S(2.2)}/><circle cx="18.6" cy="-8.4" r="2" fill="${INK}"/>${eye(10.6, -11.4, 1.7)}${blush(12.4, -7)}</g>`;
  const feet = `<path d="M-8 -2.4v2.4M4 -2.4v2.4" stroke="${shade(SP, -0.2)}" stroke-width="3" stroke-linecap="round"/>`;
  // trik: menggulung jadi bola berduri
  let ball = '';
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2, r0 = 10.4, r1 = 14.8, cx = 0, cy = -12;
    const p = (rr: number, da: number) => `${f1(cx + Math.cos(a + da) * rr)} ${f1(cy + Math.sin(a + da) * rr)}`;
    ball += `M${p(r0, -0.16)}L${p(r1, 0)}L${p(r0, 0.16)}`;
  }
  const t = `<path d="${ball}Z" fill="${SP}" ${S(2)}/><circle cx="0" cy="-12" r="11" fill="${SP}" ${S(2.4)}/><path d="M-4 -18l2 -2.6M3 -17l2 -2.6M-6 -10l2 -2.6M1 -8l2 -2.6M6 -12l2 -2.6" stroke="${TIP}" stroke-width="1.8" stroke-linecap="round"/><path d="M-2 -5.4Q2 -3.6 6 -6" fill="none" stroke="${FC}" stroke-width="3" stroke-linecap="round"/>`;
  return { n: feet + back + face, t, collar: [6.6, -6, 9], head: 26, shadow: 16 };
}

/* ---------- Edisi Natal (paket konten 24): sahabat besar, digambar langsung ±1,6× ---------- */
const GOLD = '#F2B632';
/** butiran salju kecil bercabang enam (garis biru muda + inti putih) */
const flake = (r: number) => {
  const a = f1(r * 0.87), b = f1(r / 2);
  const d = `M0 ${-r}V${r}M${-a} ${-b}L${a} ${b}M${-a} ${b}L${a} ${-b}`;
  return `<path d="${d}" stroke="#8DBFE0" stroke-width="2.8" stroke-linecap="round"/><path d="${d}" stroke="#FFFFFF" stroke-width="1.3" stroke-linecap="round"/>`;
};
/** bintang berujung empat (kilau es, kilau emas, bintang trik) */
const star4 = (r: number, fill: string, stroke: string, w = 1) => {
  const q = f1(r * 0.28);
  return `<path d="M0 ${-r}L${q} ${-q}L${r} 0L${q} ${q}L0 ${r}L${-q} ${q}L${-r} 0L${-q} ${-q}Z" fill="${fill}" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round"/>`;
};
/** satu partikel efek: letak lewat atribut, gerak lewat CSS (kelas cls), jeda awal d detik, opacity awal op */
const part = (x: number, y: number, cls: string, inner: string, d = 0, op?: number) =>
  `<g transform="translate(${x} ${y})"><g class="${cls}"${d ? ` style="animation-delay:${d}s"` : ''}${op === undefined ? '' : ` opacity="${op}"`}>${inner}</g></g>`;

function beruang(): Draw {
  const W = '#F6F9FD', SH = '#D3DFEC', IN = '#F4C6D0', NOSE = '#3A3550', RED = '#D9473B', GRN = '#3E9A5A', PINK = '#FF8FA3';
  const stripes = (d: string) => `<path d="${d}" stroke="${GRN}" stroke-width="2.3" stroke-linecap="round"/>`;
  // berdiri: kaki jauh (lebih gelap) → badan + kepala + telinga + kaki dekat jadi satu siluet → wajah & selendang
  const farLegs = `<g fill="${SH}" ${S(2.4)}><rect x="-11" y="-15" width="9.5" height="15.4" rx="4.4"/><rect x="15" y="-15" width="9.5" height="15.4" rx="4.4"/></g>`;
  const body = blob([
    `<circle cx="9" cy="-41.5" r="4.8"/>`, `<circle cx="21" cy="-43.5" r="4.8"/>`,
    `<ellipse cx="-2" cy="-18.5" rx="22.5" ry="14.5"/>`, `<circle cx="17" cy="-31" r="12.6"/>`, `<ellipse cx="27.6" cy="-27.4" rx="7.2" ry="5.6"/>`,
    `<rect x="4.6" y="-16" width="10.8" height="16.4" rx="4.8"/>`, `<rect x="-21.5" y="-16" width="11.2" height="16.4" rx="4.8"/>`, `<circle cx="-24" cy="-22" r="4.2"/>`,
  ], W, 5);
  const details = `<circle cx="21" cy="-43.2" r="2.1" fill="${IN}"/><circle cx="9.2" cy="-41.2" r="1.9" fill="${SH}"/>` +
    `<path d="M-17 -7.5q11 5.4 22 1.2" fill="none" stroke="${SH}" stroke-width="2.2" stroke-linecap="round"/>` +
    `<path d="M7.8 -2v-2.6M11.4 -2v-2.6M-18.4 -2v-2.6M-14.8 -2v-2.6" stroke="${SH}" stroke-width="1.6" stroke-linecap="round"/>` +
    `<ellipse cx="33.4" cy="-29" rx="2.7" ry="2.2" fill="${NOSE}" ${S(1.4)}/><path d="M31 -24.6q-2.2 1.8 -4.8 0.3" fill="none" ${S(1.5)}/>` +
    eye(22, -33.6, 2.4) + `<ellipse cx="23.4" cy="-26.6" rx="3.4" ry="2" fill="${PINK}" opacity=".7"/>`;
  // selendang rajut merah-hijau: lingkar leher + ujung menjuntai berumbai
  const scarf = `<path d="M4.2 -24.4Q11.6 -17.6 20.2 -22L21.4 -16.4Q11.4 -11.8 3 -18.8Z" fill="${RED}" ${S(2.2)}/>` + stripes('M7.8 -21.2l-1.3 4.4M12.4 -19.6l-0.6 4.6M16.8 -20.4v4.4') +
    `<path d="M13.6 -16.8L18.8 -5L13 -3.8L10.8 -15.6Z" fill="${RED}" ${S(2)}/>` + stripes('M12.4 -9.8l5 -1') +
    `<path d="M13.6 -3.6v2.2M15.8 -4v2.2M18 -4.6v2.2" stroke="${INK}" stroke-width="1.4" stroke-linecap="round"/>`;
  const n = farLegs + body + details + scarf;
  // trik: meluncur di perut sambil mendorong bola salju (mata terpejam senang, selendang berkibar ke belakang)
  const tb = blob([
    `<circle cx="15" cy="-24" r="4.4"/>`, `<circle cx="25.6" cy="-26" r="4.4"/>`,
    `<ellipse cx="-1" cy="-10.6" rx="24.5" ry="10.2"/>`, `<circle cx="22" cy="-15" r="11.6"/>`, `<ellipse cx="31.6" cy="-12.4" rx="6.6" ry="5"/>`,
    `<ellipse cx="33.4" cy="-3.6" rx="7.4" ry="3.4"/>`, `<ellipse cx="-25.6" cy="-4.4" rx="6.8" ry="3.4"/>`,
  ], W, 5);
  const spray = `<g fill="#FFFFFF" stroke="#8DBFE0" stroke-width="1.2"><circle cx="-31" cy="-8" r="2.6"/><circle cx="-35.4" cy="-3.4" r="1.9"/><circle cx="-30" cy="-1.6" r="1.6"/></g>`;
  const t = spray + tb +
    `<path d="M11 -21.6Q0 -27.4 -12 -23.4L-10.2 -18.4Q1 -21.2 11.6 -16.2Z" fill="${RED}" ${S(2)}/>` + stripes('M4 -22.8l1 4.2M-3 -23.2l0.6 4.4') +
    `<path d="M-12 -23.4l-3.4 -1.2M-11.2 -20.8l-3.6 0M-10.2 -18.4l-3.2 1.2" stroke="${INK}" stroke-width="1.3" stroke-linecap="round"/>` +
    `<circle cx="25.6" cy="-25.8" r="2" fill="${IN}"/>` +
    `<path d="M21.8 -18.2q2.4 -2.8 4.8 0" fill="none" ${S(2)}/><ellipse cx="37.4" cy="-13.6" rx="2.5" ry="2.1" fill="${NOSE}" ${S(1.3)}/><path d="M35.6 -9q-2.8 3 -6 0.6" fill="#F38BA0" ${S(1.5)}/>` +
    `<ellipse cx="26.6" cy="-10.4" rx="3.2" ry="1.9" fill="${PINK}" opacity=".7"/>` +
    `<path d="M9.4 -20.8Q13.2 -14.6 18.4 -16.8L19 -12.8Q12.6 -10.6 8.6 -16.6Z" fill="${RED}" ${S(1.8)}/>` +
    `<circle cx="48" cy="-8.2" r="7.8" fill="#FFFFFF" ${S(2.4)}/><path d="M43.4 -4.6q4.4 3 9.6 -1.4" fill="none" stroke="#CFE4F3" stroke-width="2.2" stroke-linecap="round"/><circle cx="45.6" cy="-11" r="1.4" fill="#E6F2FB"/>`;
  // berbaring (bantal untuk pet yang tidur): kepala bersandar di kaki depan, mata terpejam
  const lb = blob([
    `<circle cx="12.4" cy="-22.4" r="4.4"/>`, `<circle cx="23.4" cy="-24.2" r="4.4"/>`,
    `<ellipse cx="-2" cy="-11.4" rx="24.5" ry="11.4"/>`, `<circle cx="20" cy="-13" r="11.6"/>`, `<ellipse cx="29.6" cy="-10.2" rx="6.4" ry="4.8"/>`,
    `<ellipse cx="25" cy="-2.6" rx="9" ry="3.2"/>`, `<circle cx="-25.4" cy="-14" r="3.8"/>`,
  ], W, 5);
  const l = lb + `<circle cx="23.4" cy="-24" r="2" fill="${IN}"/>` +
    `<path d="M-19 -4.6q12 4 24 0.6" fill="none" stroke="${SH}" stroke-width="2.2" stroke-linecap="round"/>` +
    `<path d="M17.6 -14.6q2.4 1.8 4.8 0" fill="none" ${S(1.9)}/><ellipse cx="33.8" cy="-11.4" rx="2.4" ry="2" fill="${NOSE}" ${S(1.3)}/>` +
    `<ellipse cx="23.6" cy="-9.4" rx="3.2" ry="1.9" fill="${PINK}" opacity=".7"/>` +
    `<path d="M6.6 -21Q10.6 -12 9.2 -3L14 -3.2Q15.6 -12.4 11.8 -21.8Z" fill="${RED}" ${S(2)}/>` + stripes('M8 -17.2l4.4 -0.8M9.2 -10.6l4.6 -0.4');
  // salju yang selalu menari di sekitarnya (5 butir) & napas dingin (tampil saat .idl)
  const fx = ([[-31, -42, 3, -0.8], [-12, -56, 2.4, -2.4], [6, -59, 2.6, -1.6], [37, -45, 2.8, -3.2], [-37, -21, 2.2, 0]] as number[][])
    .map(([x, y, r, d]) => part(x, y, 'nt-flake', flake(r), d)).join('') +
    part(38.6, -27.4, 'nt-breath', `<g fill="#FFFFFF" stroke="#A9CDE6" stroke-width="1.2"><circle r="3.2"/><circle cx="4.4" cy="-1.6" r="2.6"/><circle cx="7.6" cy="0.8" r="2"/></g>`, 0, 0);
  // kilau es di bekas pijakan (tampil saat berjalan)
  const back = ([[12, -1, 0], [-15, -1, -0.15], [20, 0.4, -0.3], [-6, 0.4, -0.45]] as number[][])
    .map(([x, y, d]) => part(x, y, 'nt-frost', star4(3.6, '#E9F7FF', '#79B4DA'), d, 0)).join('');
  return { n, t, l, collar: [12.4, -15.6, 17], lcollar: [10.4, -6.6, 11], ck: 1.3, head: 49, shadow: 26, fx, back };
}

function rusa(): Draw {
  const BR = '#B67B49', DK = shade(BR, -0.24), CR = '#F4E3C6', HOOF = '#5A3A26', ANT = '#DDB97F', NOSE = '#4A3428', RED = '#C8372D';
  const leg = (x: number, fill: string, rot = 0) => `<g${rot ? ` transform="rotate(${rot} ${f1(x + 2.7)} -17)"` : ''}><rect x="${x}" y="-18" width="5.4" height="16.6" rx="2.4" fill="${fill}" ${S(2.2)}/><rect x="${f1(x - 0.4)}" y="-3.4" width="6.2" height="3.8" rx="1.4" fill="${HOOF}" ${S(1.6)}/></g>`;
  // tanduk: garis tinta tebal lalu warna tanduk di atasnya (cabang menyatu tanpa sambungan)
  const antD = (near: boolean) => near
    ? 'M23 -50.5C24.5 -58 22 -64 17.5 -71M23.6 -58L30.6 -62.4M21.2 -65L27.4 -70.6M23.4 -53.6L29 -55.4'
    : 'M17.5 -50C15 -57 10 -61 4.6 -64M13.2 -57.6L12.2 -65.6M8.6 -61.4L6.4 -68';
  const antler = (near: boolean) => `<path d="${antD(near)}" fill="none" stroke="${INK}" stroke-width="5.6" stroke-linecap="round" stroke-linejoin="round"/><path d="${antD(near)}" fill="none" stroke="${near ? ANT : shade(ANT, -0.12)}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`;
  // lampu kecil di tanduk (berkelip bergantian: .nt-light)
  const BULBS: [number, number, string, number][] = [[21.8, -56.6, '#FFD95A', 0], [17.2, -55.8, '#FF7B7B', -0.4], [29.4, -61.2, '#7BD88F', -1.2], [17.2, -62.8, '#7CC0FF', -0.8], [7.1, -65.6, '#FFF3C4', -0.2]];
  const wire = `<path d="M24.4 -59.4Q20.4 -54.4 14.4 -57.2Q11.6 -58.6 10.4 -59.6M21.2 -66Q17.6 -61.6 12.4 -63.6" fill="none" stroke="#2F5D3A" stroke-width="1.1" stroke-linecap="round"/>`;
  const bulbs = BULBS.map(([x, y, c, d]) => part(x, y, 'nt-light', `<ellipse rx="1.8" ry="2.2" fill="${c}" stroke="${INK}" stroke-width=".9"/><circle cx="-.6" cy="-.8" r=".5" fill="#FFFFFF"/>`, d)).join('');
  const glow = BULBS.map(([x, y, c], k) => part(x, y, 'nt-halo', `<circle r="3.9" fill="${c}"/>`, -k * 0.4, 0.5)).join('');
  const ear = `<path d="M15.6 -47.6Q8 -53.2 5.6 -48.8Q8.8 -44.8 15.6 -45.8Z" fill="${BR}" ${S(2)}/><path d="M13.2 -47.2Q9.4 -49.6 8.2 -48.6" fill="none" stroke="${CR}" stroke-width="1.6" stroke-linecap="round"/>`;
  const body = blob([`<ellipse cx="-4" cy="-25" rx="20" ry="10.6"/>`, `<path d="M3 -32L13.6 -47.4L24.6 -42.4L15.8 -22.6Z"/>`, `<ellipse cx="21" cy="-44.2" rx="8.4" ry="7.2"/>`, `<ellipse cx="29" cy="-40.6" rx="6.2" ry="4.8"/>`], BR, 4.8);
  const tail = `<ellipse cx="-24" cy="-30" rx="3.8" ry="2.6" transform="rotate(-24 -24 -30)" fill="${CR}" ${S(2)}/>`;
  const marks = `<ellipse cx="-4" cy="-17.8" rx="13" ry="3.4" fill="${CR}"/><ellipse cx="12.4" cy="-27" rx="3.6" ry="5.6" fill="${CR}"/><ellipse cx="29.6" cy="-40" rx="5" ry="3.8" fill="${CR}"/>` +
    `<ellipse cx="34.6" cy="-41.4" rx="2.5" ry="2.1" fill="${NOSE}" ${S(1.3)}/><path d="M33.6 -37.4q-2 1.4 -4.2 0.4" fill="none" ${S(1.4)}/>` +
    eye(22.8, -46, 2.2) + `<ellipse cx="25.4" cy="-40.8" rx="3" ry="1.8" fill="#FF8FA3" opacity=".7"/>`;
  // kalung merah dengan lonceng emas (berayun & berkilau saat .idl / .trk)
  const collarR = `<path d="M7.4 -36.4Q14.4 -30.2 21.6 -35.8L22.4 -31.8Q14.4 -26 6.6 -32.4Z" fill="${RED}" ${S(1.8)}/>`;
  const bell = `<g class="nt-bell"><path d="M14.6 -31.4v2" stroke="${INK}" stroke-width="1.4"/><circle cx="14.6" cy="-26.4" r="3.6" fill="${GOLD}" ${S(1.6)}/><path d="M12.6 -25.6h4" stroke="${INK}" stroke-width="1.1" stroke-linecap="round"/><circle cx="13.4" cy="-27.6" r=".9" fill="#FFF4C2"/></g>`;
  const jingle = part(20.6, -26.6, 'nt-jingle', star4(2.8, '#FFE27A', INK, 0.8), 0, 0) + part(8.4, -23, 'nt-jingle', star4(2.2, '#FFE27A', INK, 0.8), 0.15, 0);
  const head = ear + antler(false) + antler(true) + wire + bulbs;
  const n = leg(-13.4, DK) + leg(12.2, DK) + tail + leg(-19.6, BR) + leg(6.6, BR) + body + marks + head + collarR + bell + jingle;
  // trik: melompat tinggi (kaki terentang)
  const t = leg(-13.4, DK, 38) + leg(12.2, DK, -38) + tail + leg(-19.6, BR, 44) + leg(6.6, BR, -44) + body + marks + head + collarR + bell;
  // jejak kilau emas saat berjalan & lengkung bintang emas saat melompat (di belakang badan, tidak ikut melompat)
  const trail = ([[-19, -3, 0], [-26, -8, -0.12], [-32, -2, -0.24], [-38, -7, -0.36]] as number[][])
    .map(([x, y, d]) => part(x, y, 'nt-trail', star4(3.2, '#FFE27A', '#C9930F', 0.9), d, 0)).join('');
  const arc = [-172, -131, -90, -49, -8].map((deg, k) => {
    const a = (deg * Math.PI) / 180;
    return part(f1(Math.cos(a) * 44), f1(-40 + Math.sin(a) * 50), 'nt-arc', star4(5.2, '#FFE27A', INK, 1.1), f1(k * 0.11), 0);
  }).join('');
  return { n, t, collar: [14.6, -35, 15], ck: 1.25, head: 71, shadow: 24, back: trail + arc, glow };
}

function drawOf(sp: SahabatSp, variant?: string | null): Draw {
  switch (sp) {
    case 'ayam': return ayam();
    case 'umang': return umang(UMANG_COLORS[variant ?? '']?.main ?? UMANG_COLORS[UMANG_DEFAULT].main);
    case 'bebek': return bebek();
    case 'kura': return kura();
    case 'pipit': return pipit();
    case 'kunang': return kunang();
    case 'kelinci': return kelinci();
    case 'hamster': return hamster();
    case 'landak': return landak();
    case 'beruang': return beruang();
    case 'rusa': return rusa();
  }
}
const CACHE = new Map<string, Draw>();
function cached(sp: SahabatSp, variant?: string | null) {
  const k = sp + ':' + (sp === 'umang' ? variant ?? '' : '');
  let d = CACHE.get(k);
  if (!d) { d = drawOf(sp, variant); CACHE.set(k, d); }
  return d;
}

/** kalung emas Sahabat Sejati: pita emas melengkung & bandul bintang kecil */
function collar([x, y, w]: [number, number, number], k = 1) {
  const G = '#F2B632';
  return `<g class="b-collar"${k !== 1 ? ` transform="translate(${x} ${y}) scale(${k}) translate(${-x} ${-y})"` : ''}><path d="M${f1(x - w / 2)} ${f1(y - 1.2)}Q${x} ${f1(y + 2.2)} ${f1(x + w / 2)} ${f1(y - 1.2)}" fill="none" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/>` +
    `<path d="M${f1(x - w / 2)} ${f1(y - 1.2)}Q${x} ${f1(y + 2.2)} ${f1(x + w / 2)} ${f1(y - 1.2)}" fill="none" stroke="${G}" stroke-width="2.2" stroke-linecap="round"/>` +
    `<circle cx="${x}" cy="${f1(y + 2.6)}" r="2.6" fill="${G}" ${S(1.4)}/><circle cx="${f1(x - 0.8)}" cy="${f1(y + 1.8)}" r=".8" fill="#FFF4C2"/></g>`;
}
/** buntelan oleh-oleh (kain merah berbintik) di sebelah sahabat */
const BUNTEL = `<g class="b-gift" transform="translate(-23 0)"><path d="M-6 -1Q-8 -9 -2 -10Q0 -13 2 -10Q8 -9 6 -1Z" fill="#E0583F" ${S(1.8)}/><path d="M-2.4 -10.4L-4.4 -14M2.4 -10.4L4.4 -14" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/><circle cx="-2" cy="-5" r=".9" fill="#fff"/><circle cx="2.4" cy="-3.4" r=".9" fill="#fff"/><circle cx="1" cy="-7" r=".9" fill="#fff"/></g>`;

export interface BuddyOpts {
  variant?: string | null;
  /** tingkat keakraban (2 = Sahabat Sejati: kalung emas) */
  lvl?: number;
  flip?: boolean;
  /** membawa oleh-oleh (buntelan) */
  gift?: boolean;
  /** hinggap / duduk (di kepala pet, atau jadi bantal): tanpa bayangan, hewan terbang tidak melayang */
  perch?: boolean;
  /** pose Akrab sahabat besar: 'pillow' = berbaring (Beruang Es), 'side' = berdiri di samping pet, lampu menyala lembut */
  pose?: 'pillow' | 'side' | null;
}

/**
 * Isi elemen sahabat (posisi diatur lewat transform pembungkusnya, sama seperti pet). Hewan terbang digambar melayang
 * (`fly`) dengan bayangan tetap di lantai, kecuali saat hinggap.
 */
export function buddyMarkup(sp: SahabatSp, o: BuddyOpts = {}) {
  const d = cached(sp, o.variant);
  const fly = o.perch ? 0 : SAHABAT_INFO[sp].fly ?? 0;
  const pillow = o.pose === 'pillow' && !!d.l;
  const col = (o.lvl ?? 0) >= 2 ? collar(pillow ? d.lcollar ?? d.collar : d.collar, d.ck) : '';
  const frames = `<g class="b-n">${pillow ? d.l : d.n}</g>` + (d.t && !pillow ? `<g class="b-t" display="none">${d.t}</g>` : '') + (d.f ? `<g class="b-f" display="none">${d.f}</g>` : '');
  const body = `<g class="bud-bob">${frames}${col}${o.pose === 'side' && d.glow ? d.glow : ''}</g>`;
  // efek Edisi Natal: jejak & bintang trik di belakang badan, salju di depan (tidak ikut bergoyang)
  const inner = (d.back ?? '') + body + (d.fx ?? '');
  // buntelan oleh-oleh ikut dibalik bersama sahabat (selalu di belakangnya; sahabat besar: sedikit lebih jauh)
  const gift = o.gift && !o.perch ? (buddyScale(sp) > 1 ? `<g transform="translate(-14 0)">${BUNTEL}</g>` : BUNTEL) : '';
  return `<g class="bud-hop">${o.perch ? '' : shadow(d.shadow * (fly ? 0.6 : 1))}<g class="bud-face"${o.flip ? ' transform="scale(-1 1)"' : ''}>${gift}${fly ? `<g transform="translate(0 -${fly})">${inner}</g>` : inner}</g></g>`;
}
/** tinggi kepala sahabat (untuk letak gelembung) */
export const buddyHead = (sp: SahabatSp) => cached(sp).head + (SAHABAT_INFO[sp].fly ?? 0);

/** Ikon sahabat untuk kartu, Album & kartu profil. sil = siluet (belum dimiliki). */
export function buddyIcon(sp: SahabatSp, o: { variant?: string | null; lvl?: number; sil?: boolean; trick?: boolean } = {}) {
  const d = cached(sp, o.variant);
  const base = o.trick && d.t ? d.t : d.n;
  // siluet: tanpa cahaya & kilau yang tersembunyi (jadi tidak muncul sebagai bintik abu-abu)
  const plain = o.sil ? base.replace(/<g class="b-glow">[\s\S]*?<\/g>/, '').replace(/<g transform="[^"]*"><g class="nt-(?:jingle|breath)"[^>]*>[\s\S]*?<\/g><\/g>/g, '') : base;
  const inner = plain + ((o.lvl ?? 0) >= 2 && !o.sil ? collar(d.collar, d.ck) : '');
  const body = o.sil
    ? `<g class="sil" fill="#B9BDCD" stroke="#9EA3B8">${inner.replace(/fill="[^"]*"/g, '').replace(/stroke="[^"]*"/g, '').replace(/opacity="[^"]*"/g, '').replace(/ class="nt-[\w-]+"( style="[^"]*")?/g, '')}</g>`
    : inner + (d.fx ?? '');
  // sahabat besar (Edisi Natal) digambar lebih besar: bingkainya ikut diperbesar supaya muat di kotak yang sama
  const k = buddyScale(sp);
  const vb = k > 1 ? `${f1(-25 * k)} ${f1(-45 * k)} ${f1(50 * k)} ${f1(49 * k)}` : '-25 -45 50 49';
  return `<svg viewBox="${vb}" aria-hidden="true">${o.sil ? '' : shadow(d.shadow)}${body}</svg>`;
}

/* ------------------------------------------------------------------ */
/* Ikon item (64 × 52): sahabat di toko, Camilan Sahabat, Kerang Hias    */
/* ------------------------------------------------------------------ */

const iconOf = (sp: SahabatSp, variant?: string) => (c: Record<string, string>) => {
  const v = sp === 'umang' ? (Object.entries(UMANG_COLORS).find(([, x]) => x.main.toLowerCase() === (c.main ?? '').toLowerCase())?.[0] ?? variant) : variant;
  const d = cached(sp, v);
  // sahabat besar: diperkecil supaya muat di ikon 64 × 52 (tanduk rusa & salju tidak terpotong)
  const k = buddyScale(sp) > 1 ? Math.min(1.18 / buddyScale(sp), 44 / (d.head + 6)) : 1.18;
  return `<g transform="translate(31 47) scale(${f1(k * 100) / 100})">${shadow(d.shadow)}${d.n}${d.fx ?? ''}</g>`;
};
const camilan: IconDef['draw'] = (c) =>
  `<ellipse cx="32" cy="46" rx="20" ry="4" fill="#000" opacity=".12"/>` +
  `<path d="M16 18L48 18L45 46H19Z" fill="${c.main}" ${S(2.6)}/><path d="M16 18L20 10H44L48 18" fill="${shade(c.main, -0.12)}" ${S(2.4)}/>` +
  `<path d="M22 12l3 3M28 11l2 3M36 11l-1 3M41 12l-2 3" stroke="${shade(c.main, -0.35)}" stroke-width="1.6" stroke-linecap="round"/>` +
  `<circle cx="32" cy="31" r="7.4" fill="${c.accent}" ${S(2)}/><path d="M32 34.6l-3.6 -3.4a2.2 2.2 0 1 1 3.6 -2.6a2.2 2.2 0 1 1 3.6 2.6Z" fill="#FFFDF7"/>` +
  `<g fill="#E9C46A" ${S(1.2)}><ellipse cx="12" cy="44" rx="2.6" ry="1.8"/><ellipse cx="52" cy="43" rx="2.4" ry="1.7"/><ellipse cx="56" cy="46" rx="2" ry="1.4"/></g>`;
const kerang: IconDef['draw'] = (c) => {
  let ribs = '';
  for (let k = -3; k <= 3; k++) ribs += `<path d="M32 42L${32 + k * 6.2} ${17 + Math.abs(k) * 2.4}" stroke="${shade(c.main, -0.22)}" stroke-width="1.6" stroke-linecap="round"/>`;
  return `<ellipse cx="32" cy="45" rx="18" ry="4" fill="#000" opacity=".12"/>` +
    `<path d="M32 43Q12 40 12 26Q14 14 32 13Q50 14 52 26Q52 40 32 43Z" fill="${c.main}" ${S(2.6)}/>${ribs}` +
    `<path d="M26 43L32 48L38 43Z" fill="${c.accent}" ${S(2)}/><path d="M20 22q4 -5 9 -6" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" opacity=".8"/>`;
};

const ICONS: Record<string, IconDef> = {
  camilansahabat: { label: 'Camilan Sahabat', kinds: ['material'], colors: { main: '#F3E3B5', accent: '#E0583F' }, draw: camilan },
  keranghias: { label: 'Kerang hias', kinds: ['material'], colors: { main: '#F7C6D2', accent: '#F2DEB0' }, draw: kerang },
};
for (const sp of SAHABAT_SPECIES) {
  ICONS[`sahabat${sp}`] = { label: SAHABAT_INFO[sp].name, kinds: ['sahabat'], colors: sp === 'umang' ? { main: UMANG_COLORS[UMANG_DEFAULT].main } : {}, draw: iconOf(sp) };
}
registerArt(ICONS);

/* ------------------------------------------------------------------ */
/* Pondok Sahabat di peta                                                */
/* ------------------------------------------------------------------ */

/** Pondok bambu beratap ijuk dengan kandang kecil berpagar, rumah burung bertiang, & papan tapak kaki (x,y = kaki pondok). */
export function pondokSVG(x: number, y: number) {
  const fy = y - 4;
  let o = `<ellipse cx="${x}" cy="${y}" rx="64" ry="8" fill="${INK}" opacity=".15"/><g class="lift">`;
  // rumah burung bertiang (kiri belakang)
  o += `<rect x="${x - 55}" y="${y - 72}" width="4" height="70" fill="#8A5A36" ${S(1.8)}/>` +
    `<path d="M${x - 63} ${y - 70}H${x - 43}V${y - 54}H${x - 63}Z" fill="#E9C46A" ${S(2)}/><path d="M${x - 66} ${y - 69}L${x - 53} ${y - 82}L${x - 40} ${y - 69}Z" fill="#C0603A" ${S(2)}/>` +
    `<circle cx="${x - 53}" cy="${y - 62}" r="3.4" fill="${INK}"/>`;
  // pondok: tiang, dinding gedek, pintu bundar, atap ijuk bertingkat
  o += [-30, 30].map((dx) => `<rect x="${x + dx - 3}" y="${y - 56}" width="6" height="52" fill="#9A6A40" ${S(2)}/>`).join('') +
    `<rect x="${x - 28}" y="${y - 50}" width="56" height="46" fill="#E2C58E" ${S(2.2)}/>` +
    [-20, -10, 0, 10, 20].map((dx) => `<path d="M${x + dx} ${y - 50}V${fy}" stroke="#C9A66B" stroke-width="1.4"/>`).join('') +
    `<path d="M${x - 10} ${fy}V${y - 24}A10 10 0 0 1 ${x + 10} ${y - 24}V${fy}Z" fill="#7A5232" ${S(2)}/>` +
    `<path d="M${x - 42} ${y - 50}L${x} ${y - 82}L${x + 42} ${y - 50}Z" fill="#B88A4A" ${S(2.6)}/>` +
    `<path d="M${x - 34} ${y - 56}L${x} ${y - 78}M${x + 34} ${y - 56}L${x} ${y - 78}M${x - 22} ${y - 52}L${x - 4} ${y - 74}M${x + 22} ${y - 52}L${x + 4} ${y - 74}" stroke="${shade('#B88A4A', -0.28)}" stroke-width="1.6"/>` +
    `<path d="M${x - 44} ${y - 50}Q${x} ${y - 44} ${x + 44} ${y - 50}" fill="none" stroke="${shade('#B88A4A', -0.3)}" stroke-width="3" stroke-linecap="round"/>` +
    // papan tapak kaki di atas pintu
    `<rect x="${x - 11}" y="${y - 47}" width="22" height="11" rx="2" fill="#FFFDF7" ${S(1.8)}/>` +
    `<g fill="#E0583F"><ellipse cx="${x}" cy="${y - 39.6}" rx="3" ry="2.4"/><circle cx="${x - 4}" cy="${y - 43.6}" r="1.4"/><circle cx="${x - 1.4}" cy="${y - 45}" r="1.4"/><circle cx="${x + 1.4}" cy="${y - 45}" r="1.4"/><circle cx="${x + 4}" cy="${y - 43.6}" r="1.4"/></g>`;
  // kandang kecil berpagar di kanan dengan dua anak ayam
  o += `<path d="M${x + 30} ${y - 2}H${x + 62}V${y - 16}H${x + 30}" fill="#BFE39A" ${S(1.8)}/>` +
    [34, 42, 50, 58].map((dx) => `<path d="M${x + dx} ${y - 1}V${y - 20}" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/><path d="M${x + dx} ${y - 1}V${y - 20}" stroke="#E2C58E" stroke-width="1.8" stroke-linecap="round"/>`).join('') +
    `<path d="M${x + 31} ${y - 13}H${x + 61}" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/><path d="M${x + 31} ${y - 13}H${x + 61}" stroke="#E2C58E" stroke-width="1.8" stroke-linecap="round"/>` +
    `<g transform="translate(${x + 41} ${y - 3}) scale(.55)">${cached('ayam').n}</g><g transform="translate(${x + 53} ${y - 3}) scale(-.5 .5)">${cached('ayam').n}</g>`;
  // rumput
  o += `<path d="M${x - 64} ${y}q2 -7 4 0q2 -7 4 0M${x + 22} ${y}q2 -6 4 0" fill="none" stroke="#3E8E4E" stroke-width="2" stroke-linecap="round"/>`;
  return o + `</g>`;
}
registerMapPlace('sahabat', (l, pill) => pondokSVG(l.x, l.y) + pill(l.x, l.y + 6, l.name));
