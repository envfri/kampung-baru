// Jepret & Bagikan ke Story: foto pemandangan (dari adegan SVG asli) dijadikan kartu Story 9:16 / Feed 4:5 bergaya polaroid
// + panel merek BUPI. Semua di sini murni (tanpa DOM): game menyusun string SVG mandiri lalu mengubahnya ke PNG di HP
// (SVG → <img> → canvas → PNG). Tanpa foreignObject (kanvas jadi "tainted" di Safari) dan tanpa gambar luar.
import { INK, type SkyTime } from './art';
import { textW } from './art-alun';

export type JepretFormat = 'story' | 'feed';
export type JepretPlace = 'home' | 'visit' | 'alun';
/** lebar teks (px) untuk font Baloo 2 tebal; game memakai ukuran asli dari kanvas, server/uji memakai perkiraan */
export type Measure = (text: string, weight: number, size: number) => number;
type Rect = { x: number; y: number; w: number; h: number };

/** ukuran kanvas hasil (px) */
export const JEPRET_SIZES = { story: { W: 1080, H: 1920 }, feed: { W: 1080, H: 1350 } } as const;
/** Story: 250 px atas & 340 px bawah bisa tertutup tampilan Instagram, jadi hanya hiasan. Semua tulisan di 250–1580. */
export const JEPRET_SAFE = { top: 250, bottom: 340, textTop: 250, textBottom: 1580 } as const;
/** label nama pet (gaya .tag game): ukuran huruf di layar */
export const LABEL_FS = 11.5;

const f1 = (v: number) => Math.round(v * 10) / 10;
const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const FONT = `font-family="'Baloo 2', ui-rounded, sans-serif"`;
const estimate: Measure = (t, w, s) => textW(t, s) * (w >= 800 ? 1 : 0.97);

/* ------------------------------------------------------------------ */
/* Keterangan foto                                                     */
/* ------------------------------------------------------------------ */

/** "A", "A & B", "A, B & C"; lebih dari 4 nama: "A, B, C & 3 lainnya" */
export function joinNames(names: string[]) {
  const n = names.filter(Boolean);
  if (n.length <= 1) return n[0] ?? '';
  if (n.length <= 4) return `${n.slice(0, -1).join(', ')} & ${n[n.length - 1]}`;
  return `${n.slice(0, 3).join(', ')} & ${n.length - 3} lainnya`;
}

/**
 * Keterangan Jepret. Baris 1: "{pet} di {tempat} · {waktu}"; baris 2: pet lain di foto ("bareng Putu & Wajik",
 * atau "bareng 2 teman" bila nama disembunyikan). Hanya nama pet, tidak pernah nama akun.
 */
export function jepretCaption(c: { pet: string; place: JepretPlace; host?: string | null; time: SkyTime; others: string[]; names: boolean }): [string, string?] {
  const tempat = c.place === 'alun' ? 'Alun-alun' : c.place === 'home' ? 'rumah' : c.names && c.host ? `rumah ${c.host}` : 'rumah teman';
  const l1 = `${c.pet} di ${tempat} · ${c.time}`;
  if (!c.others.length) return [l1];
  return [l1, c.names ? `bareng ${joinNames(c.others)}` : `bareng ${c.others.length} teman`];
}

/**
 * Keterangan Foto bareng. Baris 1: nama pet di foto (atau "Lupis & 2 teman"); baris 2: "Foto bareng di rumah Wajik · siang".
 * host = nama pet tuan rumah, 'alun' untuk alun-alun, null bila tidak diketahui.
 */
export function fotoCaption(c: { pets: string[]; me?: string | null; host?: string | null; time: SkyTime; names: boolean }): [string, string] {
  const hasMe = !!c.me && c.pets.includes(c.me);
  const l1 = c.names ? joinNames(c.pets) : hasMe ? (c.pets.length > 1 ? `${c.me} & ${c.pets.length - 1} teman` : c.me!) : `${c.pets.length} pet`;
  const where = c.host === 'alun' ? ' di Alun-alun' : c.host ? (c.names || c.host === c.me ? ` di rumah ${c.host}` : ' di rumah teman') : '';
  return [l1, `Foto bareng${where} · ${c.time}`];
}

/** nama file: bupi-<pet>-<tempat>-<yyyymmdd>.png */
export function jepretFileName(pet: string, where: JepretPlace | 'foto', d = new Date()) {
  const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'pet';
  const tempat = where === 'alun' ? 'alun' : where === 'visit' ? 'rumah-teman' : where === 'foto' ? 'foto-bareng' : 'rumah';
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `bupi-${slug(pet)}-${tempat}-${ymd}.png`;
}

/** link untuk stiker Link: dengan kode teman hanya bila pemain menyalakan "Kode temanku" */
export const jepretLink = (origin: string, code?: string | null) => `${origin.replace(/\/$/, '')}/${code ? `?undang=${encodeURIComponent(code)}` : ''}`;

/* ------------------------------------------------------------------ */
/* Label nama pet (gaya .tag game) & aturan tumpang tindih              */
/* ------------------------------------------------------------------ */

export type JepretLabel = { id: string; name: string; x: number; y: number; w: number; h: number };
/** ukuran label: padding 7 px, garis 1,5 px, tinggi baris 1,45 (sama dengan .tag di Room.svelte) */
export function labelSize(name: string, fs = LABEL_FS, measure: Measure = estimate) {
  return { w: f1(measure(name, 800, fs) + (fs * 14) / 11.5 + 3), h: f1(fs * 1.45 + 3) };
}
/**
 * Label di bawah kaki pet. Sama dengan Room.svelte: pet sendiri didahulukan, lalu dari atas ke bawah; label yang menumpuk
 * digeser ke bawah paling banyak dua baris, yang masih menumpuk disembunyikan.
 */
export function placeLabels(items: { id: string; name: string; x: number; y: number; self?: boolean }[], o: { fs?: number; measure?: Measure; bounds?: Rect } = {}): JepretLabel[] {
  const fs = o.fs ?? LABEL_FS;
  const list = [...items].sort((a, b) => (!!a.self === !!b.self ? a.y - b.y : a.self ? -1 : 1));
  const out: JepretLabel[] = [];
  for (const t of list) {
    const { w, h } = labelSize(t.name, fs, o.measure);
    let x = t.x, y0 = t.y, dir = 1;
    // tetap di dalam bingkai foto: label yang terpotong tepi digeser masuk (di tepi bawah, baris cadangan naik ke atas)
    if (o.bounds) {
      const b = o.bounds;
      x = Math.max(b.x + w / 2 + 2, Math.min(b.x + b.w - w / 2 - 2, x));
      if (y0 + h > b.y + b.h - 2) { y0 = b.y + b.h - 2 - h; dir = -1; }
      if (y0 < b.y + 2) y0 = b.y + 2;
    }
    for (let k = 0; k < 3; k++) {
      const y = y0 + dir * k * (h + 1);
      if (out.some((q) => Math.abs(q.x - x) < (q.w + w) / 2 + 3 && Math.abs(q.y - y) < (q.h + h) / 2)) continue;
      out.push({ id: t.id, name: t.name, x: f1(x), y: f1(y), w, h });
      break;
    }
  }
  return out;
}
/** label sebagai SVG (koordinat layar); sama persis di jendela bidik & di foto */
export function labelSVG(l: JepretLabel, fs = LABEL_FS) {
  return `<g data-tbox="1"><rect data-box="1" x="${f1(l.x - l.w / 2)}" y="${f1(l.y)}" width="${l.w}" height="${l.h}" rx="${f1(l.h / 2)}" fill="#FFFDF7" fill-opacity=".95" stroke="${INK}" stroke-width="1.5"/>`
    + `<text x="${f1(l.x)}" y="${f1(l.y + l.h / 2)}" dy=".36em" text-anchor="middle" ${FONT} font-weight="800" font-size="${fs}" fill="${INK}">${esc(l.name)}</text></g>`;
}

/* ------------------------------------------------------------------ */
/* Langit (di game: CSS .roomwrap.sky) dalam koordinat layar           */
/* ------------------------------------------------------------------ */

export type SkyColors = { s1: string; s2: string; s3: string; h1?: string; h2?: string; orb?: string; glow?: string; cl?: number };
/** warna langit, sama dengan Room.svelte (alunMalam: langit alun-alun lebih terang karena ditutup tirai gelap) */
export const SKY_COLORS: Record<SkyTime | 'alunMalam', SkyColors> = {
  pagi: { s1: '#F9D6B5', s2: '#F6E7CF', s3: '#E6F2E4', h1: '#BFDDB4', h2: '#AACFA0', orb: '#FFE3A3', glow: 'rgba(255, 210, 150, .5)', cl: 0.9 },
  siang: { s1: '#A9DDF5', s2: '#CDEBF6', s3: '#E4F4EA', h1: '#B9DDB0', h2: '#A6D29B', orb: '#FFF1C2', glow: 'rgba(255, 236, 170, .5)', cl: 0.9 },
  sore: { s1: '#F3A77E', s2: '#F8CFA0', s3: '#F1E3C4', h1: '#A9C99A', h2: '#93B98A', orb: '#FFC27A', glow: 'rgba(255, 170, 100, .45)', cl: 0.9 },
  malam: { s1: '#1F2D4F', s2: '#33507A', s3: '#46648A', h1: '#324866', h2: '#283B57', orb: '#FFF4C8', glow: 'rgba(255, 244, 200, .18)', cl: 0.22 },
  alunMalam: { s1: '#283853', s2: '#4D79A3', s3: '#719EC1', orb: '#FFF4C8', glow: 'rgba(255, 244, 200, .18)', cl: 0.22 },
};
/** letak matahari/bulan, bukit & awan menurut CSS Room.svelte (bila game tidak mengirim posisi aslinya) */
export function skyGeom(vw: number, vh: number, time: SkyTime) {
  const small = vw <= 700;
  const d = time === 'malam' ? 62 : small ? 56 : 84;
  const top = time === 'pagi' ? 0.2 : time === 'sore' ? 0.26 : small && time !== 'malam' ? 0.16 : time === 'malam' ? 0.1 : 0.11;
  const x = time === 'pagi' ? vw * 0.12 : vw * (1 - (time === 'sore' ? 0.09 : 0.13)) - d;
  const hh = vh * (small ? 0.3 : 0.4);
  return {
    orb: { x, y: vh * top, w: d, h: d },
    hills: { x: 0, y: vh - hh, w: vw, h: hh },
    clouds: [{ x: vw * 0.24, y: vh * 0.08, w: 190, h: 60 }, { x: vw * 0.64, y: vh * 0.19, w: 130, h: 42 }],
  };
}
const rgba0 = (c: string) => (c.startsWith('rgba') ? c.replace(/,\s*[\d.]+\s*\)$/, ', 0)') : c);
const opOf = (c: string) => { const m = /rgba\([^)]*,\s*([\d.]+)\s*\)/.exec(c); return m ? Number(m[1]) : 1; };
const rgbOf = (c: string) => { const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(c); return m ? `rgb(${m[1]},${m[2]},${m[3]})` : c; };

/**
 * Langit seluas layar (vw × vh): gradasi, bintang (malam), matahari/bulan + cahayanya, bukit, awan.
 * plain = latar game biasa (alun-alun siang tidak punya langit, yang terlihat latar kawung hijau).
 */
export function skySVG(o: { vw: number; vh: number; plain?: boolean; night?: boolean; hillsOn?: boolean; colors: SkyColors; orb?: Rect | null; hills?: Rect | null; clouds?: Rect[] }) {
  const { vw, vh, colors: c } = o;
  if (o.plain) {
    // .game: motif kawung tipis + cahaya lembut di tengah + gradasi hijau
    const kw = (x: number, y: number) => `<g transform="translate(${x} ${y})"><ellipse cy="-11" rx="6" ry="10"/><ellipse cy="11" rx="6" ry="10"/><ellipse cx="-11" rx="10" ry="6"/><ellipse cx="11" rx="10" ry="6"/></g>`;
    return `<defs><linearGradient id="jpPl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D3E9DF"/><stop offset="1" stop-color="#B7D7CA"/></linearGradient>`
      + `<radialGradient id="jpPlG" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".35"/><stop offset=".7" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>`
      + `<pattern id="jpPlK" width="160" height="160" patternUnits="userSpaceOnUse"><g fill="none" stroke="#FFFFFF" stroke-opacity=".5" stroke-width="2">${kw(40, 40)}${kw(120, 120)}</g><g fill="#FFFFFF" fill-opacity=".55"><circle cx="14" cy="72" r="2"/><circle cx="150" cy="78" r="2.4"/><circle cx="70" cy="146" r="2"/><circle cx="96" cy="14" r="1.8"/></g></pattern></defs>`
      + `<rect width="${vw}" height="${vh}" fill="url(#jpPl)"/><rect width="${vw}" height="${vh}" fill="url(#jpPlG)"/><rect width="${vw}" height="${vh}" fill="url(#jpPlK)"/>`;
  }
  let s = `<defs><linearGradient id="jpSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.s1}"/><stop offset=".58" stop-color="${c.s2}"/><stop offset="1" stop-color="${c.s3}"/></linearGradient>`;
  if (c.glow) s += `<radialGradient id="jpGlow"><stop offset=".25" stop-color="${rgbOf(c.glow)}" stop-opacity="${opOf(c.glow)}"/><stop offset="1" stop-color="${rgbOf(rgba0(c.glow))}" stop-opacity="0"/></radialGradient>`;
  if (o.night) s += `<pattern id="jpStars" width="220" height="160" patternUnits="userSpaceOnUse"><g fill="#FFF6D8"><circle cx="20" cy="30" r="1.6"/><circle cx="90" cy="12" r="1.2"/><circle cx="150" cy="60" r="1.8"/><circle cx="200" cy="22" r="1.1"/><circle cx="60" cy="100" r="1.3"/><circle cx="180" cy="120" r="1.5"/><circle cx="120" cy="140" r="1"/></g></pattern>`;
  if (o.hillsOn && c.h1 && c.h2) s += `<linearGradient id="jpHill" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="300"><stop offset="0" stop-color="${c.h1}"/><stop offset="1" stop-color="${c.h2}"/></linearGradient>`;
  s += `</defs><rect width="${vw}" height="${vh}" fill="url(#jpSky)"/>`;
  if (o.night) s += `<rect width="${vw}" height="${vh}" fill="url(#jpStars)"/>`;
  if (o.orb && c.orb) {
    const r = o.orb.w / 2, cx = o.orb.x + r, cy = o.orb.y + o.orb.h / 2;
    // box-shadow: cincin 22 px + pendar 90 px
    if (c.glow) s += `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r + 22 + 92)}" fill="url(#jpGlow)"/><circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r + 22)}" fill="${rgbOf(c.glow)}" fill-opacity="${opOf(c.glow)}"/>`;
    s += `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r)}" fill="${c.orb}"/>`;
  }
  if (o.hillsOn && o.hills && c.h1) {
    const h = o.hills;
    s += `<path transform="translate(${f1(h.x)} ${f1(h.y)}) scale(${(h.w / 1600).toFixed(4)} ${(h.h / 300).toFixed(4)})" d="M0 120 C200 40 380 70 560 100 S900 20 1100 70 S1450 50 1600 90 V300 H0Z" fill="url(#jpHill)"/>`;
  }
  for (const cl of o.clouds ?? []) {
    const k = Math.min(cl.w / 190, cl.h / 60), dx = (cl.w - 190 * k) / 2, dy = (cl.h - 60 * k) / 2;
    s += `<path transform="translate(${f1(cl.x + dx)} ${f1(cl.y + dy)}) scale(${k.toFixed(3)})" d="M20 52a18 18 0 0 1 6-34a26 26 0 0 1 48-8a22 22 0 0 1 38 4a20 20 0 0 1 34 10a17 17 0 0 1 22 28Z" fill="#FFFFFF" opacity="${c.cl ?? 0.9}"/>`;
  }
  return s;
}

/* ------------------------------------------------------------------ */
/* Foto: langit + adegan (koordinat dunia) + lapisan layar + label      */
/* ------------------------------------------------------------------ */

/**
 * Isi foto dalam koordinat layar; viewBox = kotak bingkai Jepret di layar, jadi foto sama persis dengan yang terlihat.
 * scene.markup = isi SVG ruangan yang sudah dibersihkan, scene.viewBox = viewBox SVG ruangan saat itu.
 * mirror = "Putar sudut" (desktop): seluruh adegan dicermin di tengah layar, tulisan sudah dibalik lagi oleh game.
 */
export function jepretPhoto(p: { frame: Rect; vw: number; vh: number; sky: string; scene: { markup: string; viewBox: string; mirror?: boolean }; overlay?: string; labels?: JepretLabel[] }) {
  const vb = p.scene.viewBox.split(/[\s,]+/).map(Number);
  const flip = p.scene.mirror ? `<g transform="matrix(-1 0 0 1 ${f1(2 * vb[0] + vb[2])} 0)">` : '<g>';
  const content = p.sky
    + `<svg x="0" y="0" width="${p.vw}" height="${p.vh}" viewBox="${p.scene.viewBox}" preserveAspectRatio="xMidYMid meet" overflow="hidden">${flip}<g ${FONT}>${p.scene.markup}</g></g></svg>`
    + (p.overlay ?? '')
    + (p.labels ?? []).map((l) => labelSVG(l)).join('');
  return { content, viewBox: `${f1(p.frame.x)} ${f1(p.frame.y)} ${f1(p.frame.w)} ${f1(p.frame.h)}` };
}

/** Isi foto Foto bareng (album, 136 × 100) sebagai foto kartu. */
export const fotoPhoto = (inner: string) => ({ content: inner, viewBox: '0 0 136 100' });

/* ------------------------------------------------------------------ */
/* Kartu Story / Feed                                                  */
/* ------------------------------------------------------------------ */

/** maskot BUPI dari favicon (pet tunas, art orisinal) */
const MASCOT = `<ellipse cx="0" cy="-2" rx="36" ry="7" fill="#000" opacity=".13"/><circle cx="40" cy="-22" r="9" fill="#fbdbd4" stroke="${INK}" stroke-width="3"/><path d="M0 -76C0 -86 2 -92 4 -98" stroke="#3E8E4E" stroke-width="3.5" fill="none" stroke-linecap="round"/><ellipse cx="-8" cy="-100" rx="11" ry="6" transform="rotate(-25 -8 -100)" fill="#7CC57D" stroke="${INK}" stroke-width="2.5"/><ellipse cx="14" cy="-104" rx="12" ry="6.5" transform="rotate(20 14 -104)" fill="#5DB36A" stroke="${INK}" stroke-width="2.5"/><path d="M0 -78C30 -78 46 -56 46 -34C46 -14 28 -6 0 -6C-28 -6 -46 -14 -46 -34C-46 -56 -30 -78 0 -78Z" fill="#F6B7A8" stroke="${INK}" stroke-width="3.5"/><ellipse cx="0" cy="-23" rx="24" ry="13" fill="#fbdbd4" opacity=".85"/><ellipse cx="-18" cy="-6" rx="12" ry="7" fill="#c08f83" stroke="${INK}" stroke-width="3"/><ellipse cx="18" cy="-6" rx="12" ry="7" fill="#c08f83" stroke="${INK}" stroke-width="3"/><g><circle cx="-15" cy="-46" r="6" fill="${INK}"/><circle cx="15" cy="-46" r="6" fill="${INK}"/><circle cx="-13" cy="-48" r="2" fill="#fff"/><circle cx="17" cy="-48" r="2" fill="#fff"/></g><ellipse cx="-28" cy="-35" rx="7" ry="4" fill="#FF8FA3" opacity=".7"/><ellipse cx="28" cy="-35" rx="7" ry="4" fill="#FF8FA3" opacity=".7"/><path d="M-7 -37q3.5 4 7 0q3.5 4 7 0" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`;
const sparkle = (x: number, y: number, r: number, fill = '#F7C548') => `<path transform="translate(${f1(x)} ${f1(y)}) scale(${f1(r / 10)})" d="M0-10L2.6-2.6 10 0 2.6 2.6 0 10-2.6 2.6-10 0-2.6-2.6Z" fill="${fill}" stroke="${INK}" stroke-width="${f1((1.6 * 10) / r)}" stroke-linejoin="round"/>`;

/**
 * Letak kartu: polaroid (lebar PW, foto pw × ph, keterangan capH) & panel merek. Story: polaroid 258–1388, panel 1412–1572
 * (foto lebar seperti Foto bareng: ditengahkan di zona aman). Feed: polaroid 40–1035, panel 1092–1242.
 */
export function cardLayout(kind: JepretFormat, aspect = 1.25, twoLines = false) {
  const { W } = JEPRET_SIZES[kind];
  const st = kind === 'story';
  const PW = st ? (aspect < 1 ? 900 : 840) : 740, pad = 40;
  const pw = PW - pad * 2, ph = Math.round(pw * aspect);
  const capH = twoLines ? (st ? 140 : 130) : st ? 92 : 86;
  const CH = pad + ph + capH;
  const panelH = st ? 160 : 150;
  const short = st && CH < 1000;
  const top = st ? (short ? Math.round(JEPRET_SAFE.textTop + (1330 - (CH + 26 + panelH)) / 2) : 258) : 40;
  const panelY = st ? (short ? top + CH + 26 : 1412) : 1092;
  const panelW = st ? 840 : PW;
  return { W, PW, pad, pw, ph, capH, CH, top, panelY, panelH, panelW, px: (W - PW) / 2, panelX: (W - panelW) / 2 };
}

/** ukuran huruf (dan bila perlu tulisan dipendekkan) supaya muat di maxW */
function fit(text: string, maxW: number, fs: number, weight: number, measure: Measure, minK = 0.62) {
  const w = measure(text, weight, fs);
  if (w <= maxW) return { text, fs };
  const f2 = Math.max(fs * minK, (fs * maxW) / w) * 0.99;
  if (measure(text, weight, f2) <= maxW) return { text, fs: f1(f2) };
  let t = text;
  while (t.length > 1 && measure(t + '…', weight, f2) > maxW) t = t.slice(0, -1);
  return { text: t.trimEnd() + '…', fs: f1(f2) };
}

function background(W: number, H: number, night: boolean, story: boolean) {
  const mx = story ? W - 150 : W - 84, my = story ? 150 : 110, mr = story ? 62 : 52;
  const g = night ? ['#2A3B66', '#1A2547'] : ['#E1F2E8', '#C3E1D1'];
  let o = `<defs><linearGradient id="jpBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${g[0]}"/><stop offset="1" stop-color="${g[1]}"/></linearGradient>`
    // motif kawung + melati seperti latar game
    + `<pattern id="jpKw" width="240" height="240" patternUnits="userSpaceOnUse"><g fill="none" stroke="#FFFFFF" stroke-opacity="${night ? 0.08 : 0.5}" stroke-width="3">`
    + [[60, 60], [180, 180]].map(([x, y]) => `<g transform="translate(${x} ${y})"><ellipse cy="-16" rx="9" ry="15"/><ellipse cy="16" rx="9" ry="15"/><ellipse cx="-16" rx="15" ry="9"/><ellipse cx="16" rx="15" ry="9"/></g>`).join('')
    + `</g><g fill="#FFFFFF" fill-opacity="${night ? 0.1 : 0.55}"><circle cx="21" cy="108" r="3"/><circle cx="225" cy="117" r="3.5"/><circle cx="105" cy="219" r="3"/><circle cx="144" cy="21" r="2.6"/></g></pattern></defs>`
    + `<rect width="${W}" height="${H}" fill="url(#jpBg)"/><rect width="${W}" height="${H}" fill="url(#jpKw)"/>`;
  if (night) {
    for (let i = 0; i < 70; i++) { const x = (i * 157) % W, y = (i * 263) % (H * 0.8); o += `<circle cx="${x}" cy="${f1(y)}" r="${1.5 + (i % 3)}" fill="#FFF6D8" opacity="${f1(0.5 + (i % 4) * 0.12)}"/>`; }
    o += `<circle cx="${mx}" cy="${my}" r="${f1(mr * 2.4)}" fill="#FFF4C8" opacity=".08"/><circle cx="${mx}" cy="${my}" r="${mr}" fill="#FFF4C8"/>`;
  }
  if (story) {
    // umbul-umbul (hiasan; boleh tertutup tampilan Instagram di zona atas)
    const cols = ['#E0583F', '#F2B632', '#3FA06A', '#6FB7E0', '#E7A1C9', '#FFFDF7'];
    o += `<path d="M-20 70 Q ${W / 2} 190 ${W + 20} 70" fill="none" stroke="${INK}" stroke-width="5"/>`;
    for (let i = 0; i < 15; i++) {
      const t = (i + 0.5) / 15, x = -20 + t * (W + 40), y = 70 + 4 * t * (1 - t) * 120 * 0.97;
      o += `<path d="M${f1(x - 30)} ${f1(y - 4)} L${f1(x + 30)} ${f1(y - 4)} L${f1(x)} ${f1(y + 58)}Z" fill="${cols[i % cols.length]}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
    }
  }
  // tanah berumput (hiasan; tempat yang pas untuk stiker Link di Story)
  const gy = story ? H - 250 : H - 70, gc = night ? ['#4E7A55', '#3D6347'] : ['#A6D78F', '#8CC56E'];
  o += `<path d="M-20 ${gy + 40} C ${W * 0.25} ${gy - 30} ${W * 0.55} ${gy + 30} ${W * 0.8} ${gy - 10} S ${W + 10} ${gy + 10} ${W + 20} ${gy}V${H + 20}H-20Z" fill="${gc[0]}" stroke="${INK}" stroke-width="6"/>`;
  if (story) {
    o += `<path d="M-20 ${gy + 150} C ${W * 0.3} ${gy + 110} ${W * 0.7} ${gy + 170} ${W + 20} ${gy + 120}V${H + 20}H-20Z" fill="${gc[1]}"/>`;
    const fl = night ? ['#FFF4C8', '#E7A1C9'] : ['#E0583F', '#FFFDF7', '#F2B632', '#E7A1C9'];
    for (let i = 0; i < 16; i++) { const x = 40 + ((i * 271) % (W - 80)), y = gy + 60 + ((i * 97) % 150); o += `<path d="M${x} ${y + 18}v-18" stroke="#3E8E4E" stroke-width="4"/><circle cx="${x}" cy="${y}" r="9" fill="${fl[i % fl.length]}" stroke="${INK}" stroke-width="3"/>`; }
  }
  return o;
}

function brandPanel(o: { x: number; y: number; w: number; h: number; code?: string | null; domain: string; s?: number; measure: Measure }) {
  const s = o.s ?? 1, { x, y, w, h } = o;
  const cx = x + 82 * s, cy = y + h / 2, right = x + 384 * s;
  const tw = w - (right - x) - 24 * s;
  const l1 = fit('Main bareng di BUPI', tw, 36 * s, 800, o.measure), l2 = fit(o.domain, tw, 36 * s, 800, o.measure);
  let out = `<g><rect x="${f1(x)}" y="${f1(y + 9 * s)}" width="${w}" height="${h}" rx="${f1(30 * s)}" fill="${INK}"/><rect x="${f1(x)}" y="${f1(y)}" width="${w}" height="${h}" rx="${f1(30 * s)}" fill="#FFFDF7" stroke="${INK}" stroke-width="${f1(5 * s)}"/>`
    + `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(52 * s)}" fill="#D3E9DF" stroke="${INK}" stroke-width="${f1(4 * s)}"/>`
    + `<g transform="translate(${f1(cx)} ${f1(cy + 40 * s)}) scale(${f1(0.82 * s * 100) / 100})">${MASCOT}</g>`
    // tulisan BUPI: gaya judul OG/Instagram (Baloo 2 800, tinta, bayangan putih)
    + `<g ${FONT} font-weight="800" font-size="${f1(86 * s)}" letter-spacing="${f1(-2 * s)}" data-tbox="1"><rect data-box="1" x="${f1(x + 150 * s)}" y="${f1(y + 18 * s)}" width="${f1(206 * s)}" height="${f1(h - 30 * s)}" fill="none"/>`
    + `<text x="${f1(x + 154 * s)}" y="${f1(cy + 39 * s)}" fill="${INK}" opacity=".12">BUPI</text><text x="${f1(x + 154 * s)}" y="${f1(cy + 37 * s)}" fill="#FFFFFF">BUPI</text><text x="${f1(x + 154 * s)}" y="${f1(cy + 31 * s)}" fill="${INK}">BUPI</text></g>`
    + `<path d="M${f1(right - 18 * s)} ${f1(y + 28 * s)}V${f1(y + h - 28 * s)}" stroke="${INK}" stroke-opacity=".18" stroke-width="${f1(4 * s)}" stroke-linecap="round"/>`;
  const lines = o.code ? [cy - 34 * s, cy + 8 * s] : [cy - 6 * s, cy + 40 * s];
  out += `<g data-tbox="1"><rect data-box="1" x="${f1(right)}" y="${f1(y + 12 * s)}" width="${f1(tw)}" height="${f1(h - 24 * s)}" fill="none"/>`
    + `<text x="${f1(right)}" y="${f1(lines[0])}" ${FONT} font-weight="800" font-size="${l1.fs}" fill="${INK}">${esc(l1.text)}</text>`
    + `<text x="${f1(right)}" y="${f1(lines[1])}" ${FONT} font-weight="800" font-size="${l2.fs}" fill="#1E7A4C" data-domain="1">${esc(l2.text)}</text></g>`;
  if (o.code) {
    const t = `Kode teman: ${o.code}`, fs = 26 * s, cw = Math.min(tw, o.measure(t, 800, fs) + 34 * s), ch = 40 * s, top = cy + 26 * s;
    out += `<g data-tbox="1" data-code="1"><rect data-box="1" x="${f1(right)}" y="${f1(top)}" width="${f1(cw)}" height="${f1(ch)}" rx="${f1(ch / 2)}" fill="${INK}"/><text x="${f1(right + 17 * s)}" y="${f1(top + ch / 2)}" dy=".36em" ${FONT} font-weight="800" font-size="${f1(fs)}" fill="#F7C548">${esc(t)}</text></g>`;
  }
  return out + '</g>';
}

/**
 * Kartu Story (1080×1920) / Feed (1080×1350) sebagai satu string SVG mandiri. fontCss = @font-face Baloo 2 (base64) dari game.
 * code: kode teman (hanya bila pemain menyalakan "Kode temanku"), domain: host situs (mis. bupi.id).
 */
export function jepretCard(c: { kind: JepretFormat; photo: { content: string; viewBox: string }; aspect?: number; caption: [string, string?]; code?: string | null; night?: boolean; domain: string; fontCss?: string; measure?: Measure }) {
  const measure = c.measure ?? estimate;
  const st = c.kind === 'story';
  const { W, H } = JEPRET_SIZES[c.kind];
  const L = cardLayout(c.kind, c.aspect ?? 1.25, !!c.caption[1]);
  const { PW, pad, pw, ph, capH, CH, top, px } = L;
  const capW = PW - 48;
  const c1 = fit(c.caption[0], capW - 8, st ? 50 : 46, 800, measure, 0.55);
  const c2 = c.caption[1] ? fit(c.caption[1], capW - 8, st ? 34 : 31, 700, measure, 0.55) : null;
  let o = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${c.fontCss ? `<style>${c.fontCss}</style>` : ''}`;
  o += background(W, H, !!c.night, st);
  o += sparkle(px - 40, top + 120, 26) + sparkle(px + PW + 38, top + 60, 20) + sparkle(px + PW + 30, top + CH - 140, 30, '#FFFDF7') + sparkle(px - 30, top + CH - 60, 18, '#FFFDF7');
  const cx = W / 2, cy = top + CH / 2;
  o += `<g transform="rotate(-1.5 ${cx} ${f1(cy)})"><rect x="${px}" y="${top + 13}" width="${PW}" height="${CH}" rx="28" fill="${INK}"/><rect x="${px}" y="${top}" width="${PW}" height="${CH}" rx="28" fill="#FFFDF7" stroke="${INK}" stroke-width="6"/>`
    + `<defs><clipPath id="jpPh"><rect x="${px + pad}" y="${top + pad}" width="${pw}" height="${ph}" rx="10"/></clipPath></defs>`
    + `<rect x="${px + pad}" y="${top + pad}" width="${pw}" height="${ph}" fill="#FFFDF7"/>`
    + `<g clip-path="url(#jpPh)"><svg x="${px + pad}" y="${top + pad}" width="${pw}" height="${ph}" viewBox="${c.photo.viewBox}" preserveAspectRatio="xMidYMid slice" overflow="hidden">${c.photo.content}</svg></g>`
    + `<rect x="${px + pad}" y="${top + pad}" width="${pw}" height="${ph}" rx="10" fill="none" stroke="${INK}" stroke-width="5"/>`
    + `<g data-tbox="1"><rect data-box="1" x="${px + 24}" y="${top + pad + ph + 12}" width="${capW}" height="${capH - 22}" fill="none"/>`
    + `<text x="${cx}" y="${top + pad + ph + (st ? 66 : 60)}" text-anchor="middle" ${FONT} font-weight="800" font-size="${c1.fs}" fill="${INK}">${esc(c1.text)}</text>`
    + (c2 ? `<text x="${cx}" y="${top + pad + ph + (st ? 112 : 102)}" text-anchor="middle" ${FONT} font-weight="700" font-size="${c2.fs}" fill="#5F6478">${esc(c2.text)}</text>` : '')
    + `</g></g>`;
  o += brandPanel({ x: L.panelX, y: L.panelY, w: L.panelW, h: L.panelH, code: c.code, domain: c.domain, s: st ? 1 : 0.93, measure });
  return o + '</svg>';
}
