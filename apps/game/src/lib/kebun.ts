// Gambar kebun (bedengan, petak, tanaman, benda tiap tingkat) sebagai string SVG.
// Dipakai layar Kebun (petak bisa diketuk) dan pratinjau di sheet "Perluas kebun".
import {
  cropSVG, gentong, gubuk, kebunDrop, kebunLayout, kebunSparkle, kebunTuft, KEBUN_ICONS, orangOrangan, pagarBambu, papanNama, plotTimeText,
} from '@kb/shared';

const INK = '#2B2F4A';
const FONT = `font-family="'Baloo 2', ui-rounded, sans-serif" font-weight="800"`;

export interface PlotView { crop?: string; prog: number; watered: boolean; fertilized: boolean; label: string; fruit?: string }

/** Lebar teks (px) dengan huruf papan nama; perkiraan longgar bila canvas tidak ada. */
let ctx: CanvasRenderingContext2D | null | undefined;
export function textW(t: string, px = 13, weight = 800) {
  if (ctx === undefined) ctx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  if (!ctx) return t.length * px * 0.6;
  ctx.font = `${weight} ${px}px 'Baloo 2', ui-rounded, sans-serif`;
  return Math.ceil(ctx.measureText(t).width);
}

/** Tulisan papan nama yang muat: "Kebun Nama", lalu "Nama", lalu nama dipotong dengan "…". */
export function signText(name: string, max: number) {
  const full = `Kebun ${name}`;
  if (textW(full) <= max) return full;
  if (textW(name) <= max) return name;
  let s = name;
  while (s.length > 1 && textW(s + '…') > max) s = s.slice(0, -1);
  return s + '…';
}

/** Label pil di bawah petak: bilah progres + teks dalam satu pil. */
function pill(x: number, y: number, w: number, h: number, prog: number | null, text: string, fs: number) {
  const ty = y + h / 2 + fs * 0.36;
  if (prog === null) return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="#F3E3B5" stroke="${INK}" stroke-width="2"/><text x="${x + w / 2}" y="${ty}" text-anchor="middle" ${FONT} font-size="${fs}" fill="${INK}">${text}</text>`;
  const ready = prog >= 1;
  // teks panjang (mis. "12 j 30 mnt") diperkecil supaya tetap di dalam pil
  const f = text.length > 9 ? Math.min(fs, Math.floor(((w - 10) / (text.length * 0.62)) * 10) / 10) : fs;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${ready ? '#3FA06A' : '#E9E4D6'}" stroke="${INK}" stroke-width="2"/>` +
    (ready ? '' : `<rect x="${x + 2}" y="${y + 2}" width="${Math.max(h - 4, (w - 4) * prog).toFixed(1)}" height="${h - 4}" rx="${(h - 4) / 2}" fill="#F2C46A"/>`) +
    `<text x="${x + w / 2}" y="${y + h / 2 + f * 0.36}" text-anchor="middle" ${FONT} font-size="${f}" fill="${ready ? '#FFFFFF' : INK}">${text}</text>`;
}

const pupukBadge = (x: number, y: number) => {
  const p = KEBUN_ICONS.pupuk;
  return `<g><circle cx="${x}" cy="${y}" r="10.5" fill="#FFF3CF" stroke="${INK}" stroke-width="2"/><g transform="translate(${x - 13} ${y - 10.5}) scale(0.41)">${p.draw(p.colors).replace(/<path d="M[^"]*Q[^"]*Z" fill="#FFF6C9"[^>]*>/g, '')}</g></g>`;
};

export interface SceneOpts {
  level: number; n: number; plots: (PlotView | null)[]; ghost: boolean; wide: boolean; owner: string;
  /** petak yang baru muncul (animasi tumbuh) mulai dari indeks ini */
  fresh?: number;
}

/** Bagian-bagian gambar kebun. `plot(i)` = satu petak lengkap (tanah, tanaman, label, lencana). */
export function gardenScene(o: SceneOpts) {
  const L = kebunLayout(o.n, o.ghost, o.wide);
  const W = L.W, lv = o.level, two = W > 400;
  let s = `<rect x="-400" y="-400" width="${W + 800}" height="${L.H + 1200}" fill="#A9D18A"/>`;
  for (const [x, y] of [[30, 30], [120, 60], [210, 22], [290, 70], [370, 36], [60, 100], [345, 104], [470, 40], [560, 76], [650, 28], [740, 66]]) {
    if (x < W) s += `<path d="M${x - 4} ${y}l2 -6 2 6 2 -7 2 7" fill="none" stroke="#8DBE6C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  // benda tiap tingkat di jalur rumput atas
  const band = 120;
  if (lv >= 4) s += gubuk(two ? 110 : 78, band - 6, 0.98);
  if (lv >= 3) s += gentong(two ? (lv >= 4 ? 232 : 120) : lv >= 4 ? 170 : 66, band - 2, 0.95);
  if (lv >= 5) {
    const max = two ? 220 : 90;
    const t = signText(o.owner, max);
    s += papanNama(two ? 400 : 262, band - 4, t, textW(t));
  }
  if (lv >= 2) s += orangOrangan(two ? 700 : lv >= 5 ? 352 : 330, band + 2, 0.98);
  if (lv >= 2) s += pagarBambu(16, W - 16, band + 4, 24);
  else s += `<path d="M10 118H${W - 10}" stroke="#8A5A36" stroke-width="6" stroke-dasharray="4 14" stroke-linecap="round"/>`;
  if (lv >= 5) for (let k = 0; 38 + k * 46 < W - 20; k++) s += kebunTuft(38 + k * 46, band + 5, ['#FF8FA3', '#FFFFFF', '#F2C94C', '#B48ED6'][k % 4]);
  for (const b of L.beds) if (b.rows > 0) s += `<rect x="${b.x}" y="${b.top}" width="360" height="${b.bottom - b.top}" rx="18" fill="#C9A16E" stroke="${INK}" stroke-width="3"/>`;

  const plot = (i: number) => {
    const c = L.cell(i), p = o.plots[i] ?? null;
    const growing = !!p && p.prog < 1;
    const wet = growing && p!.watered;
    const fy = L.compact ? [20, 36, 50] : [26, 46, 66];
    let g = `<rect x="${c.x}" y="${c.y}" width="92" height="${L.plotH}" rx="12" fill="${wet ? '#6E4520' : '#8C5A2B'}" stroke="${INK}" stroke-width="2.5"/>` +
      `<path d="${fy.map((d) => `M${c.x + 10} ${c.y + d}h72`).join('')}" stroke="${wet ? '#55351A' : '#6E4520'}" stroke-width="2"/>`;
    if (wet) g += [[c.x + 14, c.y + L.plotH - 9], [c.x + 78, c.y + L.plotH - 12], [c.x + 70, c.y + 12]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="3" ry="1.6" fill="#9FD3F0" opacity=".85"/>`).join('');
    const lw = 84, lh = L.compact ? 17 : 19, ly = c.y + L.plotH + (L.compact ? 6 : 7), fs = L.compact ? 12.5 : 14;
    if (!p) {
      return g + `<text x="${c.x + 46}" y="${c.y + L.plotH / 2 + 12}" text-anchor="middle" ${FONT} font-size="${L.compact ? 30 : 34}" fill="#F3E3B5">+</text>` + pill(c.x + 4, ly, lw, lh, null, 'Tanam', fs);
    }
    g += `<g class="crop">${cropSVG(p.crop, p.prog, c.x + 46, L.base(c.y), L.plantScale, p.fruit)}</g>`;
    g += pill(c.x + 4, ly, lw, lh, p.prog, p.prog >= 1 ? 'Panen!' : p.label, fs);
    if (p.prog >= 1) g += `<g class="twinkle">${kebunSparkle(c.x + 12, c.y + 10, 5.5)}${kebunSparkle(c.x + 82, c.y + 20, 4.5)}</g>`;
    if (growing && !p.watered) g += `<g><circle cx="${c.x + 86}" cy="${c.y + 6}" r="10.5" fill="#FFFFFF" stroke="${INK}" stroke-width="2"/>${kebunDrop(c.x + 86, c.y + 6, 0.95)}</g>`;
    if (growing && p.fertilized) g += pupukBadge(c.x + 6, c.y + 6);
    return g;
  };

  let ghost = '';
  if (L.ghost) {
    const { x, y, w, h } = L.ghost;
    ghost = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="#B9D99C" stroke="${INK}" stroke-width="2.5" stroke-dasharray="8 7"/>` +
      [0, 1, 2].map((k) => `<rect x="${x + 20 + k * 112}" y="${y + 12}" width="92" height="${h - 24}" rx="12" fill="none" stroke="#6E9B58" stroke-width="2.2" stroke-dasharray="6 6"/>`).join('');
  }
  return { L, W, H: L.H, y0: L.y0, back: s, plot, ghost };
}

/** Seluruh kebun sebagai satu SVG statis (pratinjau). `hi`: tandai petak mulai indeks ini. */
export function gardenStatic(o: SceneOpts & { hi?: number; hiText?: string; top?: number }) {
  const sc = gardenScene(o);
  let body = sc.back + Array.from({ length: o.n }, (_, i) => sc.plot(i)).join('') + sc.ghost;
  if (o.hi !== undefined && o.hi < o.n) {
    const a = sc.L.cell(o.hi), b = sc.L.cell(o.n - 1);
    body += `<rect x="${a.x - 6}" y="${a.y - 6}" width="${b.x - a.x + 104}" height="${sc.L.plotH + 36}" rx="15" fill="none" stroke="#F2B632" stroke-width="5" stroke-dasharray="9 6"/>`;
    if (o.hiText) body += `<text x="${(a.x + b.x + 92) / 2}" y="${a.y + sc.L.plotH / 2 + 8}" text-anchor="middle" ${FONT} font-size="22" fill="#FFFDF7" stroke="${INK}" stroke-width="5" paint-order="stroke">${o.hiText}</text>`;
  }
  const y0 = o.top ?? sc.y0;
  return `<svg viewBox="0 ${y0} ${sc.W} ${sc.H + sc.y0 - y0}" preserveAspectRatio="xMidYMin meet" aria-hidden="true">${body}</svg>`;
}

/** Keadaan satu petak untuk digambar (dari data server). */
export function plotView(p: any, now: number, item: (id: string) => any): PlotView {
  const a = new Date(p.planted_at).getTime(), b = new Date(p.ready_at).getTime();
  const prog = Math.max(0, Math.min(1, (now - a) / Math.max(1, b - a)));
  const seed = item(p.seed_id);
  const fruit = item(seed?.data?.yieldItem)?.art?.colors?.main;
  // progres dibulatkan per 2% supaya gambar petak tidak digambar ulang tiap detik
  return { crop: seed?.data?.crop, prog: b <= now ? 1 : Math.min(Math.floor(prog * 50) / 50, 0.999), watered: !!p.watered_at, fertilized: !!p.fertilized_at, label: plotTimeText(b - now), fruit };
}
