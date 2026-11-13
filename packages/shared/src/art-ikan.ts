// Kolam Pancing v32: gambar ikan & temuan (ikon 64×52, kepala menghadap kiri), mebel Kendi Antik,
// dan data tampilan bersama (tingkat, jarak, waktu langit, ukuran bayangan). Didaftarkan ke ICONS/FURN
// di art.ts lewat registerArt(), jadi item cukup memakai art key-nya (bisa diganti warna dari admin).
import { INK, shade, itemIcon, registerArt, skyTime, type IconDef, type FurnDef, type ItemLike, type SkyTime } from './art';

type C = Record<string, string>;
type Pm = Record<string, number>;
type IconFn = (c: C, p: Pm) => string;

const f1 = (v: number) => Math.round(v * 10) / 10;
const fin = (d: string, fill: string, sw = 2.2) => `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>`;
const fill = (d: string, f: string, op = 1) => `<path d="${d}" fill="${f}"${op < 1 ? ` opacity="${op}"` : ''}/>`;
const line = (d: string, s: string, w = 2, op = 1) => `<path d="${d}" fill="none" stroke="${s}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${op < 1 ? ` opacity="${op}"` : ''}/>`;
const outline = (d: string, w = 2.5) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linejoin="round"/>`;
const eye = (x: number, y: number, r = 3) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${INK}"/><circle cx="${f1(x - r * 0.35)}" cy="${f1(y - r * 0.35)}" r="${f1(r * 0.36)}" fill="#fff"/>`;
/** kumis / benang bergaris tepi: garis tinta tebal + isi warna */
const thread = (d: string, col: string, w = 1.6) => line(d, INK, w + 2) + line(d, col, w);
/** bintang kilau 4 sudut (untuk ikan Legenda) */
export const sparkle = (x: number, y: number, s = 1, col = '#FFF4B8') =>
  `<path d="M${x} ${f1(y - 5 * s)}Q${f1(x + 1 * s)} ${f1(y - 1 * s)} ${f1(x + 5 * s)} ${y}Q${f1(x + 1 * s)} ${f1(y + 1 * s)} ${x} ${f1(y + 5 * s)}Q${f1(x - 1 * s)} ${f1(y + 1 * s)} ${f1(x - 5 * s)} ${y}Q${f1(x - 1 * s)} ${f1(y - 1 * s)} ${x} ${f1(y - 5 * s)}Z" fill="${col}" stroke="${INK}" stroke-width="${f1(1.3 * Math.min(1, s + 0.2))}" stroke-linejoin="round"/>`;
/** kilau emas (Legenda): tiga bintang di luar badan */
const shimmer = (pts: number[][] = [[8, 9, 1], [57, 6, 0.8], [52, 46, 0.9]]) => pts.map(([x, y, s]) => sparkle(x, y, s)).join('');

/* ---------- tabung lengkung (belut, sidat) ---------- */
type Pt = [number, number];
function catmull(pts: Pt[], t: number): Pt {
  const n = pts.length - 1;
  const u = Math.min(n - 1e-6, Math.max(0, t * n));
  const i = Math.floor(u), s = u - i;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
  const q = (a: number, b: number, c: number, d: number) =>
    0.5 * (2 * b + (-a + c) * s + (2 * a - 5 * b + 4 * c - d) * s * s + (-a + 3 * b - 3 * c + d) * s * s * s);
  return [q(p0[0], p1[0], p2[0], p3[0]), q(p0[1], p1[1], p2[1], p3[1])];
}
function frame(pts: Pt[], t: number) {
  const a = catmull(pts, Math.max(0, t - 0.01)), b = catmull(pts, Math.min(1, t + 0.01));
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  return { p: catmull(pts, t), n: [dy / L, -dx / L] as Pt }; // n = sisi "atas/punggung"
}
/** Garis luar tabung dengan lebar w(t); kepala (t=0) membulat. */
function tube(pts: Pt[], w: (t: number) => number, t0 = 0, t1 = 1, N = 44) {
  const L: Pt[] = [], R: Pt[] = [];
  for (let k = 0; k <= N; k++) {
    const t = t0 + ((t1 - t0) * k) / N;
    const { p, n } = frame(pts, t);
    const ww = w(t);
    L.push([p[0] + n[0] * ww, p[1] + n[1] * ww]);
    R.push([p[0] - n[0] * ww, p[1] - n[1] * ww]);
  }
  const s = (q: Pt) => `${f1(q[0])} ${f1(q[1])}`;
  const w0 = w(t0);
  return `M${s(L[0])}` + L.slice(1).map((q) => `L${s(q)}`).join('') + R.reverse().map((q) => `L${s(q)}`).join('') + (t0 === 0 ? `A${f1(w0)} ${f1(w0)} 0 0 1 ${s(L[0])}` : '') + 'Z';
}
/** titik pada tabung: t sepanjang badan, o = -1..1 (punggung..perut) */
function onTube(pts: Pt[], w: (t: number) => number, t: number, o: number): Pt {
  const { p, n } = frame(pts, t);
  return [p[0] + n[0] * w(t) * -o, p[1] + n[1] * w(t) * -o];
}

/* ================================================================== */
/* Bentuk badan                                                        */
/* ================================================================== */

/** Badan tinggi/pipih: gurame, mujair, sepat, betok, bawal, tambakan.
 *  params: deep, belly, stripes, spots, lips, spines, feeler, edge, gillspot, pearl */
const pipih: IconFn = (c, p) => {
  const deep = !!p.deep;
  const body = deep
    ? 'M6 27C7 15 15 6 27 6C39 6 47 14 50 21L50 31C47 40 39 47 27 47C15 47 7 39 6 27Z'
    : 'M6 27C8 19 15 12 26 10C37 8 46 14 50 21L50 31C46 38 37 44 26 43C15 42 8 35 6 27Z';
  const dark = shade(c.main, -0.28);
  let s = '';
  // sirip belakang (tertutup badan)
  s += fin('M48 21L61 11Q57 26 61 41L48 31Z', c.accent);
  if (p.spines) s += fin('M17 16L19 5L23 12L26 3L30 10L33 2L37 9L40 3L43 11L47 7L49 20L30 22Z', c.accent);
  else {
    s += fin(deep ? 'M20 9C28 3 39 0 49 1C48 8 49 14 50 21L36 20Z' : 'M21 12C29 7 39 4 49 5C48 10 49 15 50 21L36 20Z', p.edge ? c.edge : c.accent);
    if (p.edge) s += fill(deep ? 'M24 9C31 5 39 3 46.5 3.6C46 9 47 14 47.5 19L36 19Z' : 'M25 12C31 9 39 7 46.5 7.6C46 11.5 47 15.5 47.5 19.5L36 19Z', c.accent);
    s += line(deep ? 'M30 8L33 4M37 7L40 2.6M44 8L46 3' : 'M30 11L32 7.4M37 10L39.4 6M44 11L46 6.6', shade(c.accent, -0.25), 1.2, 0.9);
  }
  s += fin(deep ? 'M28 45C36 49 44 51 50 50C49 44 49 38 50 31L36 32Z' : 'M28 42C36 46 44 48 50 47C49 42 49 37 50 32L36 32Z', c.accent);
  s += line(deep ? 'M37 47l3 2.4M44 46l3 3' : 'M37 44l3 2.4M44 43l3 3', shade(c.accent, -0.25), 1.2, 0.9);
  // badan
  s += fill(body, c.main);
  s += fill(deep ? 'M7 24C9 14 17 7 27 7C38 7 46 14 50 21L50 23C40 15 20 13 7 24Z' : 'M7 24C10 17 16 12 26 11C37 9 46 14 50 21L50 23C40 16 20 15 7 24Z', shade(c.main, -0.1));
  if (p.belly) s += fill(deep ? 'M50 31C47 40 39 47 27 47C15 47 7 39 6 28C16 38 36 39 50 31Z' : 'M50 31C46 38 37 44 26 43C15 42 8 35 6 28C16 35 36 37 50 31Z', c.belly);
  if (p.stripes) s += line(deep ? 'M22 10v34M30 8v38M38 10v34M45 16v24' : 'M22 13v28M30 11v31M38 12v29M45 17v21', shade(c.main, -0.2), 2.6, 0.8);
  if (p.spots) s += `<circle cx="34" cy="24" r="3.4" fill="${dark}"/><circle cx="46.5" cy="26" r="2.5" fill="${dark}"/>` + line('M19 18q3 2.4 6 0t6 0M24 39q3 2.4 6 0t6 0', shade(c.main, 0.32), 1.5, 0.8);
  if (p.pearl) s += `<ellipse cx="30" cy="17" rx="9" ry="2.6" fill="#FFFFFF" opacity=".85"/><circle cx="41" cy="20" r="1.6" fill="#FFFFFF"/><circle cx="37" cy="34" r="1.3" fill="#FFFFFF" opacity=".9"/>` + line('M27 23a3 3 0 0 1 0 5M33 22a3 3 0 0 1 0 5M39 24a3 3 0 0 1 0 5', shade(c.main, -0.12), 1.3, 0.9);
  if (p.gillspot) s += `<circle cx="21" cy="25" r="2.6" fill="${dark}"/><circle cx="47" cy="25.5" r="2" fill="${dark}"/>`;
  s += outline(body);
  s += line(deep ? 'M17 14Q11 27 17 40' : 'M17 16Q12 27 18 38', shade(c.main, -0.3), 2);
  s += fin(deep ? 'M21 30q8 -1 11 7q-8 2 -11 -7Z' : 'M21 29q8 -1 11 6q-8 2 -11 -6Z', c.accent, 1.8);
  if (p.feeler) s += thread(deep ? 'M20 40C22 47 29 50 37 49' : 'M19 37C21 46 28 50 36 49', c.accent, 1.6);
  if (p.lips) s += `<ellipse cx="6.2" cy="27" rx="3.6" ry="3.4" fill="#F49AA5" stroke="${INK}" stroke-width="2"/>` + line('M3.8 27h3.6', INK, 1.6);
  else s += line('M6.8 27.8l3.4 -0.6', INK, 1.8);
  s += eye(13.5, 22.5, 3);
  return s;
};

/** Badan ramping perak: wader, tawes, nilem. params: deep, stripe, dots */
const ramping: IconFn = (c, p) => {
  const deep = !!p.deep;
  const body = deep
    ? 'M5 26C9 17 19 12 30 12C41 12 47 18 51 22L51 30C47 34 41 39 30 39C19 39 9 35 5 26Z'
    : 'M5 26C9 19 19 16 30 16C40 16 47 20 51 23L51 29C47 32 40 36 30 36C19 36 9 33 5 26Z';
  let s = '';
  s += fin('M49 23L61 11Q58 21 54 26Q58 31 61 41L49 29Z', c.accent);
  s += fin(deep ? 'M24 14L31 2L40 15Z' : 'M26 17L32 6L40 18Z', c.accent);
  s += fin(deep ? 'M25 37l4 8l6 -8Z' : 'M25 35l4 7l5 -7Z', c.accent, 2);
  s += fin(deep ? 'M38 36l3 7l6 -8Z' : 'M38 34l3 6l5 -7Z', c.accent, 2);
  s += fill(body, c.main);
  s += fill(deep ? 'M6 24C10 17 19 13 30 13C41 13 47 18 51 22L51 24C40 18 20 18 6 24Z' : 'M6 25C10 19 19 17 30 17C40 17 47 20 51 23L51 25C40 21 20 21 6 25Z', shade(c.main, -0.18));
  if (p.stripe) s += line('M14 23C26 22 38 22 48 23', '#F2C94C', 1.5, 0.95) + line('M12 27C25 26 38 26 50 26.5', shade(c.main, -0.5), 2.6);
  if (p.dots) s += [20, 27, 34, 41].map((x) => `<circle cx="${x}" cy="${26 + (x === 41 ? 0 : 0.5)}" r="1.9" fill="${shade(c.main, -0.45)}"/>`).join('');
  s += fill(deep ? 'M8 31C16 38 30 40 50 30L51 30C47 34 41 39 30 39C19 39 11 36 8 31Z' : 'M8 30C16 35 30 37 50 29L51 29C47 32 40 36 30 36C19 36 11 34 8 30Z', '#FFFFFF', 0.45);
  s += outline(body);
  s += line(deep ? 'M17 17Q13 26 17 35' : 'M16 19Q13 26 16 33', shade(c.main, -0.35), 1.8);
  s += line('M5.6 26.6l3 -0.2', INK, 1.7);
  s += eye(12.5, 24, 2.8);
  return s;
};

/** Ikan berkumis: lele (ekor bulat, sirip panjang) & patin (ekor bercabang). params: fork */
const kumis: IconFn = (c, p) => {
  const fork = !!p.fork;
  const body = fork
    ? 'M6 27C7 19 14 15 22 15C34 15 44 19 51 22L51 30C44 34 34 37 22 37C14 37 7 34 6 27Z'
    : 'M6 27C6 20 11 17 18 17C30 17 42 19 52 22L52 30C42 33 30 36 18 36C11 36 6 33 6 27Z';
  let s = '';
  if (fork) {
    s += fin('M49 22L61 11Q57 26 61 41L49 30Z', c.accent);
    s += fin('M19 16L24 4L31 16Z', c.accent);
    s += fin('M40 18q4 -6 8 1Z', c.accent, 2);
    s += fin('M28 35C36 43 46 39 50 30L38 31Z', c.accent);
  } else {
    s += fin('M50 22C56 16 63 19 62 26C63 33 56 36 50 30Z', c.accent);
    s += fin('M20 18C30 11 44 13 53 21L40 22Z', c.accent);
    s += fin('M22 35C32 42 46 39 53 30L40 30Z', c.accent);
  }
  s += fill(body, c.main);
  s += fill(fork ? 'M7 24C12 17 22 15 30 15C40 16 46 19 51 22L51 25C40 20 20 19 7 24Z' : 'M7 24C9 19 13 17 18 17C30 17 42 19 52 22L52 24C40 21 20 20 7 24Z', shade(c.main, -0.22));
  s += fill(fork ? 'M8 31C14 36 30 38 51 30L51 30C44 34 34 37 22 37C14 37 9 35 8 31Z' : 'M8 31C14 35 30 37 52 29L52 30C42 33 30 36 18 36C12 36 9 34 8 31Z', shade(c.main, 0.45));
  if (fork) s += line('M16 26C28 25 40 25 50 26', shade(c.main, -0.3), 1.4, 0.8);
  s += outline(body);
  s += fin(fork ? 'M19 30q7 0 9 6q-7 1 -9 -6Z' : 'M17 30q7 0 9 6q-7 1 -9 -6Z', c.accent, 1.8);
  if (fork) s += thread('M8 24Q4 21 3 16', shade(c.main, -0.35), 1.2) + thread('M7.5 30Q4 33 4 38', shade(c.main, -0.35), 1.2);
  else s += thread('M8 23Q3 19 3 12', c.accent, 1.3) + thread('M10 22Q7 15 9.5 9.5', c.accent, 1.3) + thread('M7 30Q2 33 2.5 40', c.accent, 1.3) + thread('M9.5 31Q6.5 37 9 43', c.accent, 1.3);
  s += line('M6.5 28q4 2.2 7.5 0', INK, 1.8);
  s += eye(fork ? 13 : 13, fork ? 22.5 : 22.5, fork ? 2.8 : 2.4);
  return s;
};

/** Belut & sidat: badan panjang melengkung. params: sidat (sirip tepi + sirip dada) */
const BELUT_PTS: Pt[] = [[9, 19], [19, 15], [29, 23], [38, 33], [49, 35], [57, 27], [60, 18]];
const belut: IconFn = (c, p) => {
  const sid = !!p.sidat;
  const w = (t: number) => (sid ? 6.2 : 6.6) * (1 - 0.85 * Math.pow(t, 1.6)) + 0.6;
  const d = tube(BELUT_PTS, w);
  let s = '';
  if (sid) s += fin(tube(BELUT_PTS, (t) => w(t) + 2.2, 0.42, 1), c.accent, 2);
  s += fill(d, c.main);
  // perut terang
  const belly: Pt[] = [];
  for (let k = 0; k <= 30; k++) belly.push(onTube(BELUT_PTS, w, 0.02 + k * 0.03, 0.55));
  s += line('M' + belly.map((q) => `${f1(q[0])} ${f1(q[1])}`).join('L'), c.belly ?? shade(c.main, 0.4), sid ? 3.6 : 3, 0.95);
  // kilau punggung
  const back: Pt[] = [];
  for (let k = 0; k <= 16; k++) back.push(onTube(BELUT_PTS, w, 0.06 + k * 0.03, -0.5));
  s += line('M' + back.map((q) => `${f1(q[0])} ${f1(q[1])}`).join('L'), shade(c.main, 0.35), 1.6, 0.8);
  if (!sid) s += [0.2, 0.32, 0.45, 0.58, 0.7, 0.8].map((t, i) => { const q = onTube(BELUT_PTS, w, t, i % 2 ? -0.2 : 0.15); return `<circle cx="${f1(q[0])}" cy="${f1(q[1])}" r="1.2" fill="${shade(c.main, -0.4)}"/>`; }).join('');
  s += outline(d);
  if (sid) { const q = onTube(BELUT_PTS, w, 0.13, 0.1); s += fin(`M${f1(q[0])} ${f1(q[1])}q4 -1 6 4q-5 2 -6 -4Z`, c.accent, 1.6); }
  const e = onTube(BELUT_PTS, w, 0.035, -0.32);
  s += eye(f1(e[0]), f1(e[1]), 2.1);
  s += line('M3.5 21.5l4 0.8', INK, 1.6);
  return s;
};

/** Gabus & toman: badan silinder, kepala seperti ular. params: toman, blotch */
const gabus: IconFn = (c, p) => {
  const tm = !!p.toman;
  const body = 'M5 26C5 20 10 17 17 17L50 20C54 21 55 23 55 26C55 29 54 31 50 32L17 35C10 35 5 32 5 26Z';
  let s = '';
  s += fin('M52 22C58 16 63 19 63 26C63 33 58 36 52 30Z', c.accent);
  s += fin('M17 18C28 10 44 11 53 21L40 21Z', c.accent);
  s += fin('M26 34C36 41 47 39 53 31L40 31Z', c.accent);
  s += fill(body, c.main);
  s += fill('M6 24C7 19 11 17 17 17L50 20C53 21 54 22 55 24C40 22 20 21 6 24Z', shade(c.main, -0.2));
  if (tm) {
    s += line('M13 25.5C25 26 40 26.5 52 26', c.stripe, 3.4, 0.95);
    s += [[22, 21], [32, 22], [42, 22.5], [27, 30], [37, 30], [47, 29]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.5" fill="#9FD0E8" opacity=".9"/>`).join('');
  } else {
    s += [[21, 24, 3.4, 4.6], [29.5, 27, 3, 4.2], [38, 24.5, 3.2, 4.4], [46, 27, 2.6, 3.4], [25, 30.5, 2, 1.8], [42, 30.5, 1.8, 1.6]].map(([x, y, rx, ry], i) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${i % 2 ? 18 : -14} ${x} ${y})" fill="${shade(c.main, -0.4)}"/>`).join('');
  }
  s += fill('M8 30C14 34 30 35 50 31L50 32L17 35C11 35 9 33 8 30Z', shade(c.main, 0.5), 0.9);
  s += outline(body);
  s += line('M15 18Q11 26 15 34', shade(c.main, -0.35), 1.8);
  s += fin('M18 29q7 0 9 6q-7 1 -9 -6Z', c.accent, 1.8);
  if (tm) s += '<path d="M6.5 27.4l1.6 2l1.6 -2l1.6 2l1.6 -2" fill="#FFFFFF" stroke="' + INK + '" stroke-width="1" stroke-linejoin="round"/>' + line('M13 19l3.5 3', '#E9E4D6', 1.4) + line('M5 27.4l9 0.6', INK, 1.8);
  else s += line('M5 27.4l7 0.8', INK, 1.8);
  s += eye(11, 21.8, 2.6);
  if (tm) s += shimmer([[6, 9, 0.9], [58, 8, 0.8], [36, 47, 0.75]]);
  return s;
};

/** Ikan sapu-sapu: kepala lebar, sirip punggung layar, mulut pengisap, totol. */
const sapu: IconFn = (c) => {
  const body = 'M5 32C5 24 10 18 19 17C31 16 42 21 51 24L51 30C42 33 30 36 19 36L8 36C6 35 5 34 5 32Z';
  let s = '';
  s += fin('M49 24L61 14Q57 25 62 40L49 30Z', shade(c.main, -0.15));
  s += fin('M15 19C16 6 27 2 41 9C39 14 37 18 35 21Z', shade(c.main, -0.15));
  s += line('M19 18L20 8M24 18L26 6M29 19L31 6M33 20L37 9', c.spot, 1.4, 0.8);
  s += fill(body, c.main);
  s += [[13, 24, 1.8], [19, 27, 1.6], [24, 22, 1.7], [28, 30, 1.6], [33, 25, 1.7], [39, 28, 1.5], [44, 25.5, 1.4], [21, 32, 1.4], [35, 31.5, 1.3], [16, 20.5, 1.3], [47, 28, 1.1]]
    .map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${f1(r * 0.8)}" fill="${c.spot}"/>`).join('');
  s += outline(body);
  s += fin('M13 33L27 42L23 34Z', shade(c.main, -0.15), 1.8);
  s += `<ellipse cx="7.2" cy="35" rx="3.4" ry="2.3" fill="${shade(c.main, 0.35)}" stroke="${INK}" stroke-width="1.8"/>`;
  s += eye(13.5, 22, 2.4);
  return s;
};

/** Cupang: badan kecil, sirip besar berkibar. */
const cupang: IconFn = (c) => {
  const body = 'M8 24C8 19 13 17 20 17C28 17 33 20 36 24C33 28 28 31 20 31C13 31 8 29 8 24Z';
  const rays = (cx: number, cy: number, pts: number[][]) => pts.map(([x, y]) => `M${cx} ${cy}L${x} ${y}`).join('');
  let s = '';
  s += fin('M33 23C40 8 55 3 62 13C64 24 62 37 55 45C45 47 38 36 33 26Z', c.accent);
  s += line(rays(35, 24, [[48, 7], [57, 11], [61, 21], [61, 31], [57, 41], [48, 43]]), shade(c.accent, -0.25), 1.3, 0.9);
  s += fin('M17 18C19 7 30 3 39 11C37 15 35 19 33 21Z', c.accent);
  s += line(rays(26, 19, [[22, 9], [28, 7], [34, 9]]), shade(c.accent, -0.25), 1.2, 0.9);
  s += fin('M15 29C19 44 34 51 45 42C41 36 36 31 30 29Z', shade(c.accent, -0.08));
  s += line(rays(24, 30, [[22, 42], [29, 46], [37, 46], [42, 41]]), shade(c.accent, -0.3), 1.2, 0.9);
  s += fill(body, c.main);
  s += line('M17 21a2.5 2.5 0 0 1 0 4M22 20a2.5 2.5 0 0 1 0 4M27 21a2.5 2.5 0 0 1 0 4M20 25a2.5 2.5 0 0 1 0 4M25 25a2.5 2.5 0 0 1 0 4', shade(c.main, 0.4), 1.2, 0.85);
  s += outline(body);
  s += thread('M17 30L14 41', c.accent, 1.4);
  s += line('M8.4 23.3l2.4 -0.4', INK, 1.6);
  s += eye(13, 22.4, 2.6);
  return s;
};

/** Betutu: kepala besar, mulut lebar, dua sirip punggung, motif marmer. */
const betutu: IconFn = (c) => {
  const body = 'M5 28C5 20 11 16 20 16C30 16 42 21 50 24L50 31C42 34 30 37 20 37C11 37 5 34 5 28Z';
  const dk = shade(c.main, -0.35);
  let s = '';
  s += fin('M48 23C56 17 63 20 62 27C63 35 56 38 48 31Z', c.accent);
  s += fin('M19 18C20 9 28 8 30 18Z', c.accent);
  s += fin('M32 19C35 11 44 13 46 22L38 22Z', c.accent);
  s += fin('M32 35C35 42 44 41 46 30L38 31Z', c.accent);
  s += fill(body, c.main);
  s += [
    'M14 18c4 -1 7 2 5 5c-3 2 -7 0 -5 -5Z', 'M24 20c5 -2 8 3 5 6c-4 2 -8 -1 -5 -6Z', 'M35 22c4 -1 7 2 5 5c-3 2 -6 0 -5 -5Z',
    'M18 29c4 -1 6 3 3 5c-3 1 -5 -1 -3 -5Z', 'M30 29c4 -1 7 2 4 5c-3 1 -6 -1 -4 -5Z', 'M42 27c3 -1 6 2 3 4c-3 1 -5 -1 -3 -4Z',
  ].map((d) => fill(d, dk, 0.85)).join('');
  s += line('M8 31C16 35 30 36 49 31', shade(c.main, 0.45), 2.4, 0.8);
  s += outline(body);
  s += fin('M17 30C18 24 28 25 27 33C24 35 19 34 17 30Z', c.accent, 1.8);
  s += line('M5.2 29L15 30.2', INK, 2);
  s += line('M5.6 29.4q1 3.6 5 3.4', INK, 1.6);
  s += eye(13, 20.5, 3.1);
  return s;
};

/** Arwana: badan panjang punggung rata, sisik besar, mulut naik, sungut dagu. */
const arwana: IconFn = (c) => {
  const body = 'M4 20C8 17 14 17 20 17L44 18C50 19 54 22 55 25C54 28 50 31 44 32L18 33C10 33 5 29 4 20Z';
  let s = '';
  s += fin('M53 21C58 13 64 17 63 25C64 33 58 37 53 29Z', c.accent);
  s += fin('M37 19C41 10 52 10 56 22L46 22Z', c.accent);
  s += fin('M29 32C37 42 52 40 56 28L44 29Z', c.accent);
  s += fill(body, c.main);
  // sisik besar 3 baris
  let sc = '';
  for (let r = 0; r < 3; r++) for (let k = 0; k < 6; k++) {
    const x = 17 + k * 5.4 + (r % 2 ? 2.7 : 0), y = 21.2 + r * 4.2;
    if (x > 47) continue;
    sc += `M${f1(x)} ${f1(y - 2.4)}a2.6 2.6 0 0 1 0 4.8`;
  }
  s += line(sc, c.scale, 1.3, 0.95);
  s += fill('M16 19.5C24 18.6 34 18.6 42 19.4C34 20.6 24 20.8 16 19.5Z', '#FFFFFF', 0.7);
  s += outline(body);
  s += line('M13 18.5Q9.5 25 13.5 31.5', c.scale, 1.8);
  s += fin('M14 30C16 36 22 41 27 40C23 36 20 33 19 30Z', c.accent, 1.8);
  s += line('M4.2 20.4L13 24.5', INK, 1.8);
  s += thread('M5 21L1.8 16.8', c.accent, 1.2) + thread('M5.6 21.6L2 19.8', c.accent, 1.2);
  s += eye(9.5, 20.6, 2.5);
  s += shimmer([[9, 8, 1], [30, 7, 0.75], [57, 7, 0.9], [44, 45, 0.85]]);
  return s;
};

/** Koi Naga: koi berkumis naga, mahkota sirip, ekor kupu-kupu, tanduk kecil emas. */
const koinaga: IconFn = (c) => {
  const body = 'M7 26C7 18 16 14 28 14C38 14 45 19 48 26C45 33 38 38 28 38C16 38 7 34 7 26Z';
  let s = '';
  s += fin('M45 26C51 12 61 7 63 15C61 21 58 24 55 26C58 28 61 31 63 37C61 45 51 40 45 26Z', c.accent);
  s += line('M47 26L60 12M47 26L61 20M47 26L61 32M47 26L60 40', shade(c.accent, -0.25), 1.2, 0.8);
  s += fin('M17 16q3 -7 7 -1q3 -7 7 -1q3 -7 7 -1q3 -6 6 1L42 20L18 19Z', c.gold);
  s += fin('M24 36C26 45 34 48 40 44C37 40 35 37 34 35Z', c.accent);
  s += fill(body, c.main);
  s += fill('M18 16C25 14 33 15 36 19C33 24 25 24 20 21C17 20 16 18 18 16Z', c.accent);
  s += fill('M31 27C36 24 43 25 46 27C43 31 37 34 31 32C29 31 29 29 31 27Z', c.accent);
  s += fill('M14 31c3 -2 7 -1 8 2c-3 2 -6 2 -8 -2Z', c.accent);
  s += line('M24 25a2.4 2.4 0 0 1 0 4.4M29 22a2.4 2.4 0 0 1 0 4.4M36 21a2.4 2.4 0 0 1 0 4.4M26 31a2.4 2.4 0 0 1 0 4.4', c.gold, 1.3, 0.95);
  s += outline(body);
  s += fin('M18 30C18 38 24 44 30 43C26 39 24 35 23 31Z', c.accent, 1.8);
  s += fin('M14 16l-2.5 -6l3.2 2.2l0.8 -4l2 6.6Z', c.gold, 1.4);
  s += thread('M8 28C3 31 3 38 9 40C14 42 18 40 22 44', c.gold, 1.3);
  s += thread('M9 23C4 20 4 13 9 11C13 9.5 16 12 19 10', c.gold, 1.3);
  s += line('M7.4 26.6l3 0', INK, 1.7);
  s += eye(14, 22.5, 2.9);
  s += shimmer([[52, 47, 0.85], [6, 47, 0.7], [33, 6, 0.75]]);
  return s;
};

/** Ikan Dewa: ikan keramat bersisik besar biru-perak, bibir tebal, aura lembut. */
const dewa: IconFn = (c) => {
  const body = 'M6 27C7 18 16 13 28 13C40 13 47 19 51 23L51 30C47 34 40 39 28 39C16 39 7 35 6 27Z';
  let s = '';
  s += `<ellipse cx="32" cy="26" rx="31" ry="24" fill="${c.aura}" opacity=".45"/><ellipse cx="32" cy="26" rx="26" ry="19" fill="${c.aura}" opacity=".45"/>`;
  s += fin('M49 23L62 10Q57 26 62 42L49 30Z', c.accent);
  s += fin('M23 14L30 3L39 14Z', c.accent);
  s += fin('M33 37l4 8l7 -9Z', c.accent, 2);
  s += fill(body, c.main);
  s += fill('M7 24C10 17 17 14 28 14C40 14 47 19 51 23L51 24C40 19 20 18 7 24Z', shade(c.main, -0.2));
  let sc = '';
  for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) {
    const x = 20 + k * 5 + (r % 2 ? 2.5 : 0), y = 18.5 + r * 5;
    if (x > 48 || (r === 3 && (x < 23 || x > 42)) || (r === 0 && x > 44)) continue;
    sc += `M${f1(x)} ${f1(y - 2.6)}a2.8 2.8 0 0 1 0 5.2`;
  }
  s += line(sc, shade(c.main, -0.3), 1.3, 0.9);
  s += fill('M18 20C26 17.6 36 17.6 44 20C36 21 26 21 18 20Z', '#FFFFFF', 0.75);
  s += outline(body);
  s += line('M17 16Q12 27 17 37', shade(c.main, -0.35), 1.9);
  s += fin('M20 30q8 0 10 6q-8 1 -10 -6Z', c.accent, 1.8);
  s += `<ellipse cx="6.4" cy="27.6" rx="3" ry="2.4" fill="${c.lip}" stroke="${INK}" stroke-width="1.8"/>`;
  s += thread('M7.5 30.4L4.8 34.6', c.lip, 1.2);
  s += eye(13.5, 23, 3);
  s += [[8, 9, 0.8, '#FFFFFF'], [55, 6, 0.8, '#E6F6FF'], [58, 45, 0.7, '#FFFFFF']].map(([x, y, k, col]) => sparkle(x as number, y as number, k as number, col as string)).join('');
  return s;
};

/** Siluet ikan rahasia (??? di Buku Ikan) — sengaja bentuk umum, tidak membocorkan rupa aslinya. */
const rahasia: IconFn = (c) =>
  `<path d="M47 26L60 15V37Z" fill="${c.main}" stroke="${c.main}" stroke-width="2.4" stroke-linejoin="round"/>` +
  `<path d="M7 26C9 16 19 12 30 12C42 12 49 19 50 26C49 33 42 40 30 40C19 40 9 36 7 26Z" fill="${c.main}"/>` +
  `<path d="M22 13C27 5 37 5 42 15Z" fill="${c.main}"/>` +
  `<text x="29" y="34" text-anchor="middle" font-family="'Baloo 2',ui-rounded,sans-serif" font-weight="800" font-size="24" fill="${c.accent}" stroke="${INK}" stroke-width="1.2">?</text>` +
  sparkle(54, 8, 0.85, c.accent) + sparkle(9, 44, 0.65, c.accent);

/* ================================================================== */
/* Temuan: sampah & harta                                              */
/* ================================================================== */

const kaleng: IconFn = (c) =>
  `<g transform="rotate(-24 32 28)">` +
  `<path d="M14 18H46V38H14Z" fill="${c.main}"/>` +
  `<path d="M14 23H46V33H14Z" fill="${c.accent}"/>` +
  `<path d="M24 23l-2 10M37 23l2 10" stroke="#FFFFFF" stroke-width="1.6" opacity=".7"/>` +
  `<path d="M14 18H46M14 38H46" fill="none" stroke="${INK}" stroke-width="2.4"/>` +
  `<path d="M30 18q2 4 0 8" fill="none" stroke="${shade(c.main, -0.35)}" stroke-width="1.6"/>` +
  `<ellipse cx="46" cy="28" rx="4.5" ry="10" fill="${shade(c.main, -0.3)}" stroke="${INK}" stroke-width="2.4"/>` +
  `<ellipse cx="46" cy="28" rx="2.4" ry="7" fill="#3E4A5E"/>` +
  `<path d="M14 18A4.5 10 0 0 0 14 38" fill="${shade(c.main, 0.2)}" stroke="${INK}" stroke-width="2.4"/>` +
  `</g>` +
  `<path d="M52 40q2 3 0 5q-2 -2 0 -5ZM57 34q1.6 2.4 0 4q-1.6 -1.6 0 -4Z" fill="#9FD0E8" stroke="${INK}" stroke-width="1.2"/>`;

const botol: IconFn = (c) =>
  `<g transform="rotate(-28 32 26)">` +
  `<path d="M10 20C10 15 13 14 18 14H38L44 19H50V33H44L38 38H18C13 38 10 37 10 32Z" fill="${c.main}" opacity=".9"/>` +
  `<rect x="17" y="19" width="19" height="14" rx="5" fill="#FFF3CF" stroke="${INK}" stroke-width="1.8"/>` +
  `<path d="M21 19v14M32 19v14" stroke="${shade('#FFF3CF', -0.2)}" stroke-width="1.4"/>` +
  `<path d="M26 19v14" stroke="#E0583F" stroke-width="2"/>` +
  `<path d="M10 20C10 15 13 14 18 14H38L44 19H50V33H44L38 38H18C13 38 10 37 10 32Z" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>` +
  `<path d="M14 18H34" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>` +
  `<rect x="50" y="20" width="7" height="12" rx="2.5" fill="${c.accent}" stroke="${INK}" stroke-width="2.2"/>` +
  `</g>`;

const peti: IconFn = (c, p) => {
  const wood = c.main, gold = c.accent;
  if (p.open)
    return (
      `<path d="M10 6L54 6L50 20L14 20Z" fill="${shade(wood, -0.2)}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>` +
      `<path d="M18 6v14M46 6v14" stroke="${gold}" stroke-width="3"/>` +
      `<path d="M12 22H52L48 26H16Z" fill="#5A3A22"/>` +
      `<g stroke="${INK}" stroke-width="1.6">${[[18, 21], [25, 18], [32, 20], [39, 17], [46, 21], [22, 24], [42, 24]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="5" ry="3.2" fill="${gold}"/>`).join('')}</g>` +
      `<circle cx="32" cy="15" r="4.6" fill="#F3EEFA" stroke="${INK}" stroke-width="1.8"/><circle cx="30.6" cy="13.6" r="1.4" fill="#fff"/>` +
      `<path d="M10 22H54V46H10Z" fill="${wood}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>` +
      `<path d="M10 30H54" stroke="${shade(wood, -0.25)}" stroke-width="1.6"/>` +
      `<path d="M18 22v24M46 22v24" stroke="${gold}" stroke-width="3.4"/><path d="M18 22v24M46 22v24" stroke="${INK}" stroke-width="0.8" opacity=".35"/>` +
      `<rect x="28" y="24" width="8" height="9" rx="2" fill="${gold}" stroke="${INK}" stroke-width="1.8"/>` +
      sparkle(6, 10, 0.75) + sparkle(58, 14, 0.85) + sparkle(56, 3, 0.55)
    );
  return (
    `<path d="M10 22C10 12 18 9 32 9C46 9 54 12 54 22Z" fill="${shade(wood, 0.08)}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>` +
    `<path d="M10 22H54V44H10Z" fill="${wood}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>` +
    `<path d="M10 33H54" stroke="${shade(wood, -0.25)}" stroke-width="1.6"/>` +
    `<path d="M18 10v34M46 10v34" stroke="${gold}" stroke-width="3.4"/>` +
    `<path d="M10 22H54" stroke="${INK}" stroke-width="2.4"/>` +
    `<rect x="27.5" y="18" width="9" height="11" rx="2.4" fill="${gold}" stroke="${INK}" stroke-width="2"/>` +
    `<circle cx="32" cy="23" r="1.6" fill="${INK}"/><path d="M32 23v3" stroke="${INK}" stroke-width="1.4"/>` +
    `<path d="M12 44c2 4 0 6 -2 7M50 44c1 3 4 4 6 4" fill="none" stroke="#5DA05A" stroke-width="2.2" stroke-linecap="round"/>` +
    sparkle(56, 9, 0.7)
  );
};

const kendi: IconFn = (c) =>
  `<path d="M44 26C50 22 56 18 59 14" fill="none" stroke="${INK}" stroke-width="6.4" stroke-linecap="round"/>` +
  `<path d="M44 26C50 22 56 18 59 14" fill="none" stroke="${shade(c.main, -0.08)}" stroke-width="3.4" stroke-linecap="round"/>` +
  `<path d="M26 6H38L37 14C47 17 52 24 52 32C52 42 43 48 32 48C21 48 12 42 12 32C12 24 17 17 27 14Z" fill="${c.main}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>` +
  `<path d="M25 4H39" stroke="${INK}" stroke-width="5.4" stroke-linecap="round"/><path d="M25 4H39" stroke="${shade(c.main, 0.12)}" stroke-width="2.6" stroke-linecap="round"/>` +
  `<path d="M14 29H50" stroke="${c.accent}" stroke-width="3"/>` +
  `<path d="M15 34l4 -4l4 4l4 -4l4 4l4 -4l4 4l4 -4l4 4l2 -2" fill="none" stroke="${c.accent}" stroke-width="2"/>` +
  `<path d="M18 22C20 19 23 17 26 16" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" opacity=".6"/>` +
  `<path d="M40 41l3 -3l-1 -3" fill="none" stroke="${shade(c.main, -0.4)}" stroke-width="1.4"/>` +
  `<path d="M16 40q4 5 10 6" fill="none" stroke="#5DA05A" stroke-width="3" stroke-linecap="round" opacity=".8"/>`;

/* ================================================================== */
/* Registri: masuk ke ICONS (ikon) & FURN (mebel isometrik) di art.ts  */
/* ================================================================== */

export const FISH_ICONS: Record<string, IconDef> = {
  ikanpipih: { label: 'Ikan badan tinggi', kinds: ['fish'], colors: { main: '#C9B48A', accent: '#8C7A55', belly: '#E36A4B', edge: '#E0583F' }, draw: pipih },
  ikanramping: { label: 'Ikan ramping', kinds: ['fish'], colors: { main: '#D7DCE0', accent: '#F2B65A' }, draw: ramping },
  ikankumis: { label: 'Ikan berkumis', kinds: ['fish'], colors: { main: '#6B6255', accent: '#4A4339' }, draw: kumis },
  ikanbelut: { label: 'Belut / sidat', kinds: ['fish'], colors: { main: '#B08A4A', accent: '#8A6A35', belly: '#E8CF8E' }, draw: belut },
  ikangabus: { label: 'Gabus / toman', kinds: ['fish'], colors: { main: '#6E6A58', accent: '#55513F', stripe: '#F2994A' }, draw: gabus },
  ikansapu: { label: 'Sapu-sapu', kinds: ['fish'], colors: { main: '#6B6255', spot: '#D9C79A' }, draw: sapu },
  ikancupang: { label: 'Cupang', kinds: ['fish'], colors: { main: '#3F5FBF', accent: '#E0583F' }, draw: cupang },
  ikanbetutu: { label: 'Betutu', kinds: ['fish'], colors: { main: '#A08463', accent: '#6E5640' }, draw: betutu },
  arwana: { label: 'Legenda sisik besar', kinds: ['fish'], colors: { main: '#F4C752', accent: '#E59A2F', scale: '#B9800F' }, draw: arwana },
  koinaga: { label: 'Legenda berkumis', kinds: ['fish'], colors: { main: '#FFFDF7', accent: '#E0583F', gold: '#F2B632' }, draw: koinaga },
  ikandewa: { label: 'Legenda keramat', kinds: ['fish'], colors: { main: '#A9CCDA', accent: '#5F93AD', lip: '#D9B8C4', aura: '#D6F0FA' }, draw: dewa },
  rahasia: { label: 'Siluet rahasia', kinds: ['fish'], colors: { main: '#3A3F5E', accent: '#F2B632' }, draw: rahasia },
  kaleng: { label: 'Kaleng bekas', kinds: ['material'], colors: { main: '#B8C0C8', accent: '#E0583F' }, draw: kaleng },
  botolpesan: { label: 'Botol berisi pesan', kinds: ['material'], colors: { main: '#8FD3C1', accent: '#C8955A' }, draw: botol },
  petiharta: { label: 'Peti harta karun', kinds: ['material'], colors: { main: '#B9733A', accent: '#F2B632' }, draw: peti },
  kendi: { label: 'Kendi antik', kinds: ['material'], colors: { main: '#C9764A', accent: '#FFF3CF' }, draw: kendi },
};

/** Kendi Antik sebagai hiasan rumah 1×1: gambar kendi berdiri di tengah petak + bayangan tipis. */
const FISH_FURN: Record<string, FurnDef> = {
  kendi: {
    label: 'Kendi antik',
    colors: { main: '#C9764A', accent: '#FFF3CF' },
    draw(g, x, y, _w, _d, c) {
      const s = g.s, p = g.iso(x + 0.5, y + 0.5), k = Math.round(0.82 * s * 100) / 100;
      return `<ellipse cx="${f1(p[0])}" cy="${f1(p[1] - 1 * s)}" rx="${f1(18 * s)}" ry="${f1(7.5 * s)}" fill="${INK}" opacity=".15"/>` +
        `<g transform="translate(${f1(p[0] - 32 * k)} ${f1(p[1] - 47 * k)}) scale(${k})">${kendi(c, {})}</g>`;
    },
  },
};

registerArt(FISH_ICONS, FISH_FURN);

/* ================================================================== */
/* Data tampilan bersama (server & game)                               */
/* ================================================================== */

export type FishTier = 'biasa' | 'jarang' | 'langka' | 'legenda';
export const FISH_TIER_KEYS: FishTier[] = ['biasa', 'jarang', 'langka', 'legenda'];
export const FISH_TIERS: Record<FishTier, { label: string; stars: number; col: string; bg: string }> = {
  biasa: { label: 'Biasa', stars: 1, col: '#5DA05A', bg: '#E4F2DF' },
  jarang: { label: 'Jarang', stars: 2, col: '#3F7FBF', bg: '#DFECF8' },
  langka: { label: 'Langka', stars: 3, col: '#B0569E', bg: '#F7E4F1' },
  legenda: { label: 'Legenda', stars: 4, col: '#D9961A', bg: '#FFF1C9' },
};
export const fishTier = (d: any): FishTier => (FISH_TIER_KEYS.includes(d?.tier) ? d.tier : 'biasa');

export type FishDist = 'dekat' | 'sedang' | 'jauh';
export const FISH_DISTS: FishDist[] = ['dekat', 'sedang', 'jauh'];
export const DIST_LABEL: Record<FishDist, string> = { dekat: 'Dekat', sedang: 'Sedang', jauh: 'Jauh' };

/** Temuan di kolam (bukan ikan): sampah, botol pesan, peti harta, hiasan rumah, aksesori. */
export type PondFind = 'junk' | 'bottle' | 'treasure' | 'decor' | 'wear';
export const POND_FINDS: PondFind[] = ['junk', 'bottle', 'treasure', 'decor', 'wear'];
export const FIND_LABEL: Record<PondFind, string> = { junk: 'Sampah', bottle: 'Botol', treasure: 'Harta karun', decor: 'Hiasan rumah', wear: 'Aksesori' };

export const SKY_LABEL: Record<SkyTime, string> = { pagi: 'Pagi', siang: 'Siang', sore: 'Sore', malam: 'Malam' };
/** Waktu langit kolam menurut jam WIB (server memakai patokan yang sama untuk peluang ikan). */
export const pondSky = (ms: number): SkyTime => skyTime(new Date(ms + 7 * 3_600_000).getUTCHours());

/** Isi kolam: ikan atau temuan, menurut data item (fishWeight > 0). Item bukan ikan tanpa data.find = sampah/hiasan/aksesori. */
export function pondKind(it?: { kind?: string; data?: any } | null): 'fish' | PondFind | null {
  const d = it?.data;
  if (!d || !(Number(d.fishWeight) > 0)) return null;
  if (POND_FINDS.includes(d.find)) return d.find;
  if (!it?.kind || it.kind === 'fish') return 'fish';
  return it.kind === 'furniture' ? 'decor' : it.kind === 'wear' ? 'wear' : 'junk';
}

/** Ukuran bayangan di air menurut panjang ikan: S <15, M 15–35, L 35–60, XL 60+ cm. */
export const shadowSize = (cm: number): 'S' | 'M' | 'L' | 'XL' => (cm < 15 ? 'S' : cm < 35 ? 'M' : cm < 60 ? 'L' : 'XL');

/** Petunjuk singkat (waktu/jarak) di Buku Ikan untuk ikan yang belum tertangkap. */
export function fishWhere(d: any): string {
  const t = d?.time ?? {};
  const skies: SkyTime[] = ['pagi', 'siang', 'sore', 'malam'];
  const on = skies.filter((k) => t[k] === undefined || t[k] === null || Number(t[k]) > 0);
  const out: string[] = [];
  if (on.length === 1) out.push('hanya ' + on[0]);
  else {
    const best = skies.filter((k) => Number(t[k]) >= 1.5);
    if (best.length) out.push(best.join('/'));
  }
  const tier = fishTier(d);
  if (tier === 'legenda' || (tier === 'langka' && !out.length)) out.push('jauh');
  else if (Number(d?.near) > 1) out.push('tepi kolam');
  return out.join(' · ') || 'kapan saja';
}

/** Ikon datar 64×52 untuk kartu hasil & Buku Ikan (kendi tetap ikon kendi, bukan mebel isometrik). */
export function pondIcon(it: ItemLike) {
  const a = it.art;
  if (a?.type === 'builtin' && FISH_ICONS[a.key] && it.kind !== 'fish' && it.kind !== 'material') {
    const def = FISH_ICONS[a.key];
    return `<svg viewBox="0 0 64 52" aria-hidden="true">${def.draw({ ...def.colors, ...(a.colors ?? {}) }, a.params ?? {})}</svg>`;
  }
  return itemIcon(it);
}

/** Siluet "???" untuk ikan rahasia yang belum tertangkap. */
export const secretIcon = () => `<svg viewBox="0 0 64 52" aria-hidden="true">${rahasia({ main: '#4A5078', accent: '#F2B632' }, {})}</svg>`;

/** Ikon peti harta (tertutup / terbuka) untuk kartu Harta karun. */
export const chestIcon = (open: boolean) => `<svg viewBox="0 0 64 52" aria-hidden="true">${peti(FISH_ICONS.petiharta.colors, open ? { open: 1 } : {})}</svg>`;
