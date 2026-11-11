// Aset Instagram dari art orisinal BUPI (Chromium/Playwright):
//  - marketing/instagram/profil.png          foto profil 1080×1080 (aman dipotong lingkaran)
//  - marketing/instagram/post-1-kiri.png     \
//  - marketing/instagram/post-2-tengah.png    > 3 post 1080×1350 (4:5) yang menyambung jadi satu baris grid profil
//  - marketing/instagram/post-3-kanan.png    /
//  - marketing/instagram/pratinjau-grid.png  gambaran baris pertama profil
// Grid profil Instagram memotong post 4:5 menjadi 3:4 (±34 px kiri-kanan), jadi panorama dibuat menyambung
// pada bagian yang terlihat di grid; tiap post tetap utuh dan bisa dibaca sendiri di feed.
// Jalankan: npm run instagram
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const out = root + 'marketing/instagram/';
mkdirSync(out, { recursive: true });
const { petMarkup, itemIcon, ALUN_ITEMS } = await import('../packages/shared/src/index.ts');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const INK = '#2B2F4A';
const fontDir = root + 'node_modules/@fontsource/baloo-2/files/';
const fonts = [600, 700, 800].map((w) => `@font-face{font-family:'Baloo 2';font-weight:${w};src:url(file://${fontDir}baloo-2-latin-${w}-normal.woff2) format('woff2')}`).join('');
// tangkapan layar game sungguhan (rumah dengan tamu), disimpan di bahan/ supaya hasilnya bisa dibuat ulang
const shot = out + 'bahan/layar-rumah-ramai.png';

const T = 1080, H = 1350, VIS = 1012, PAD = (T - VIS) / 2; // lebar tile, tinggi, lebar terlihat di grid, potongan tiap sisi
const PW = VIS * 3 + PAD * 2; // kanvas panorama
const cx = (i) => PAD + VIS * i + VIS / 2; // tengah tile i di kanvas

const wear = (key) => ({ id: key, kind: 'wear', name: key, art: { type: 'builtin', key }, data: {} });
const furn = (key, w, d, colors) => ({ id: key, kind: 'furniture', name: key, art: { type: 'builtin', key, colors }, data: { w, d } });
const pet = (x, y, s, look, o = {}) => `<g transform="translate(${x} ${y}) scale(${s})">${petMarkup({ look, wear: o.wear ?? [], state: { mood: o.mood ?? 'senang' }, flip: o.flip, prop: o.prop })}</g>`;
const icon = (item, x, y, w) => itemIcon(item).replace('<svg ', `<svg x="${x}" y="${y}" width="${w}" height="${w * 1.04}" `);
const FLAG = ['#E0583F', '#F2B632', '#3FA06A', '#3F7FBF', '#E7A1C9', '#FFFDF7'];

/** umbul-umbul: melengkung di tiap tile, terikat di sambungan antar-post */
function bunting(y0, sag, n) {
  let s = '', k = 0;
  for (let i = 0; i < 3; i++) {
    const a = PAD + VIS * i, b = a + VIS, m = (a + b) / 2;
    s += `<path d="M${a - PAD} ${y0}Q${m} ${y0 + sag * 2} ${b + PAD} ${y0}" fill="none" stroke="${INK}" stroke-width="4"/>`;
    for (let j = 0; j < n; j++) {
      const t = (j + 0.5) / n, u = 1 - t;
      const x0 = a - PAD, x2 = b + PAD;
      const x = u * u * x0 + 2 * u * t * m + t * t * x2, y = u * u * y0 + 2 * u * t * (y0 + sag * 2) + t * t * y0;
      const ang = (t - 0.5) * -22;
      s += `<path transform="translate(${x.toFixed(1)} ${(y - 2).toFixed(1)}) rotate(${ang.toFixed(1)})" d="M-22 0H22L0 40Z" fill="${FLAG[k++ % FLAG.length]}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
    }
  }
  return s;
}
const cloud = (x, y, s) => `<path transform="translate(${x} ${y}) scale(${s})" d="M-60 16a24 24 0 0 1 12-40a32 32 0 0 1 58-12a24 24 0 0 1 42 16a20 20 0 0 1 8 36z" fill="#fff" opacity=".92"/>`;
const tuft = (x, y) => `<path d="M${x} ${y}q7-14 14 0M${x + 18} ${y + 2}q6-11 12 0" fill="none" stroke="#5E9E5A" stroke-width="5" stroke-linecap="round"/>`;
const flower = (x, y, c) => `<g transform="translate(${x} ${y})"><path d="M0 0V-26" stroke="#3FA06A" stroke-width="4"/>${[0, 72, 144, 216, 288].map((a) => `<circle transform="rotate(${a} 0 -32) translate(0 -9)" cx="0" cy="-32" r="7" fill="${c}" stroke="${INK}" stroke-width="2.5"/>`).join('')}<circle cx="0" cy="-32" r="5" fill="#F7C548" stroke="${INK}" stroke-width="2"/></g>`;

const house = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">
  <rect x="20" y="90" width="220" height="140" fill="#FFFDF7" stroke="${INK}" stroke-width="5"/>
  <path d="M0 96L130 6 260 96Z" fill="#E0583F" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
  <path d="M40 80L130 18M220 80L130 18M66 62H194M96 40H164" stroke="#B9452F" stroke-width="4" fill="none"/>
  <rect x="104" y="146" width="52" height="84" rx="4" fill="#B98A64" stroke="${INK}" stroke-width="4.5"/><circle cx="146" cy="190" r="4.5" fill="${INK}"/>
  <rect x="38" y="122" width="46" height="40" rx="4" fill="#BFE3F5" stroke="${INK}" stroke-width="4"/><path d="M61 122V162M38 142H84" stroke="${INK}" stroke-width="3.5"/>
  <rect x="176" y="122" width="46" height="40" rx="4" fill="#BFE3F5" stroke="${INK}" stroke-width="4"/><path d="M199 122V162M176 142H222" stroke="${INK}" stroke-width="3.5"/>
  <path d="M30 230H230" stroke="${INK}" stroke-width="5"/>
</g>`;

const GROUND = 1150;
const scene = `<svg class="scene" viewBox="0 0 ${PW} ${H}" width="${PW}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <!-- matahari & awan -->
  <g transform="translate(${cx(2) + 385} 170)">${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<path transform="rotate(${a})" d="M0 -82V-104" stroke="#F2B632" stroke-width="12" stroke-linecap="round"/>`).join('')}<circle r="62" fill="#F7C548" stroke="${INK}" stroke-width="5"/></g>
  ${cloud(cx(0) - 380, 250, 1.1)}${cloud(cx(1) + 390, 640, 1)}${cloud(cx(2) - 360, 380, 0.9)}
  ${bunting(30, 46, 9)}
  <!-- tanah panjang menyambung 3 post + jalan setapak -->
  <path d="M-40 ${GROUND + 20}Q${cx(0)} ${GROUND - 60} ${cx(1) - 300} ${GROUND - 10}T${cx(2)} ${GROUND - 30}T${PW + 40} ${GROUND}V${H + 40}H-40Z" fill="#A8D8A0" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M-40 ${GROUND + 120}C${cx(0) - 100} ${GROUND + 60} ${cx(0) + 300} ${GROUND + 190} ${cx(1) - 200} ${GROUND + 120}S${cx(1) + 400} ${GROUND + 60} ${cx(2) - 100} ${GROUND + 130}S${PW} ${GROUND + 110} ${PW + 40} ${GROUND + 100}" fill="none" stroke="#E8D3A2" stroke-width="54" stroke-linecap="round"/>
  ${[60, 420, 900, 1240, 1500, 1980, 2320, 2700, 3000].map((x, i) => tuft(x, GROUND + 70 + (i % 3) * 40)).join('')}
  ${flower(cx(0) - 410, GROUND + 40, '#E7A1C9')}${flower(cx(0) + 400, GROUND + 30, '#FFFDF7')}${flower(cx(1) - 420, GROUND + 50, '#F7C548')}${flower(cx(2) + 420, GROUND + 60, '#E7A1C9')}
  <!-- tile 1: kenalan -->
  ${icon(furn('pohon', 1, 1), cx(0) - 500, 830, 290)}
  ${pet(cx(0) - 255, GROUND + 70, 2.2, { color: '#9FD0E8', ear: 'kelinci', eyes: 'bulat' }, { prop: 'gitar' })}
  ${pet(cx(0) + 265, GROUND + 70, 2.2, { color: '#C9B6E8', ear: 'kucing', pattern: 'totol', eyes: 'senyum' }, { wear: [wear('blangkon')], flip: true })}
  ${pet(cx(0), GROUND + 120, 3.0, { color: '#F6B7A8', ear: 'tunas', eyes: 'senyum' })}
  <!-- tile 2: rumah & kegiatan -->
  ${house(cx(1) - 200, 760, 1.55)}
  ${icon(furn('pohon', 1, 1), cx(1) + 215, 850, 270)}
  ${pet(cx(1) - 300, GROUND + 95, 1.4, { color: '#A8D8A0', ear: 'bulat', eyes: 'berbinar' }, { prop: 'siram' })}
  ${pet(cx(1) + 300, GROUND + 100, 1.45, { color: '#FFB86B', ear: 'rubah', eyes: 'senyum' }, { wear: [wear('caping')], flip: true })}
  <!-- tile 3: main di HP -->
  ${icon(ALUN_ITEMS['alun-komidi'], cx(2) - 515, 835, 320)}
  ${pet(cx(2) + 360, GROUND + 90, 1.5, { color: '#F4D58D', ear: 'anjing', eyes: 'bulat' }, { prop: 'kendang', flip: true })}
</svg>`;

const img = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
const page = `<!doctype html><html><head><meta charset="utf-8"><style>
${fonts}
*{box-sizing:border-box}
html,body{margin:0;width:${PW}px;height:${H}px;overflow:hidden}
body{position:relative;font-family:'Baloo 2',sans-serif;color:${INK};background:linear-gradient(180deg,#F1FAF5 0%,#DDF0E7 45%,#C6E2D5 100%)}
.scene{position:absolute;left:0;top:0}
.t{position:absolute;top:0;height:${H}px;width:${VIS}px;display:flex;flex-direction:column;align-items:center;text-align:center}
.t1{left:${PAD}px}.t2{left:${PAD + VIS}px}.t3{left:${PAD + VIS * 2}px}
.kicker{margin-top:190px;font-size:62px;font-weight:700;line-height:1}
.logo{font-size:300px;font-weight:800;line-height:.8;letter-spacing:-6px;margin-top:22px;text-shadow:0 10px 0 #fff,0 14px 0 rgba(43,47,74,.12)}
.sub{margin-top:34px;font-size:46px;font-weight:700;line-height:1.15;max-width:15em}
.h2{margin-top:178px;font-size:66px;font-weight:800;line-height:1.02;max-width:12em}
.list{margin-top:30px;display:flex;flex-direction:column;gap:16px;align-items:center}
.pill{display:flex;align-items:center;gap:16px;background:#FFFDF7;border:5px solid ${INK};border-radius:999px;box-shadow:0 7px 0 ${INK};padding:8px 34px 6px 14px;font-size:42px;font-weight:800;white-space:nowrap}
.pill i{display:inline-grid;place-items:center;width:58px;height:58px;border-radius:50%;font-style:normal;font-size:30px;color:#fff;border:4px solid ${INK}}
.big{margin-top:178px;font-size:118px;font-weight:800;line-height:.86}
.big b{display:inline-block;background:#F2B632;border:6px solid ${INK};border-radius:28px;box-shadow:0 9px 0 ${INK};padding:14px 28px 0;margin-top:14px;transform:rotate(-3deg)}
.lead{margin-top:30px;font-size:44px;font-weight:700}
.phone{position:absolute;left:50%;top:${540}px;transform:translateX(-50%) rotate(4deg);width:310px;height:630px;border:14px solid ${INK};border-radius:52px;overflow:hidden;background:#000;box-shadow:0 16px 0 rgba(43,47,74,.18)}
.phone img{display:block;width:100%;height:100%;object-fit:cover;object-position:top}
.cta{position:absolute;bottom:52px;left:50%;transform:translateX(-50%);display:flex;gap:16px;align-items:center;white-space:nowrap}
.chip{background:${INK};color:#F7C548;font-weight:800;font-size:40px;padding:8px 30px 4px;border-radius:999px}
.ig{display:flex;align-items:center;gap:14px;color:#fff;font-weight:800;font-size:40px;padding:8px 28px 4px 16px;border-radius:999px;border:5px solid ${INK};background:linear-gradient(45deg,#F9A13A 0%,#E1306C 50%,#8A3AB9 100%)}
.ig svg{width:44px;height:44px}
.tag1{margin-top:34px;background:${INK};color:#F7C548;font-weight:800;font-size:38px;letter-spacing:.06em;text-transform:uppercase;padding:8px 32px 4px;border-radius:999px;white-space:nowrap}
</style></head><body>
${scene}
<section class="t t1">
  <div class="kicker">Kenalin, ini</div>
  <div class="logo">BUPI</div>
  <div class="sub">pet lucu dari Kampung Bupi yang siap jadi temanmu</div>
  <div class="tag1">Game pet kampung</div>
</section>
<section class="t t2">
  <div class="h2">Di Kampung BUPI<br>kamu bisa…</div>
  <div class="list">
    <span class="pill"><i style="background:#E0583F">1</i>Rawat &amp; dandani pet</span>
    <span class="pill"><i style="background:#3F7FBF">2</i>Hias rumah sendiri</span>
    <span class="pill"><i style="background:#3FA06A">3</i>Main bareng teman</span>
    <span class="pill"><i style="background:#9A6FC0">4</i>Mini-game Nusantara</span>
  </div>
</section>
<section class="t t3">
  <div class="big">Main<br><b>GRATIS!</b></div>
  <div class="lead">langsung di HP, tanpa unduh</div>
  <div class="phone"><img src="${img(shot)}" alt=""></div>
  <div class="cta"><span class="chip">Link di bio</span><span class="ig"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="5.5"/><circle cx="12" cy="12" r="4.3"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"/></svg>@playbupi</span></div>
</section>
</body></html>`;

/* foto profil: maskot BUPI besar di tengah (aman untuk potongan lingkaran) */
const profile = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:1080px;height:1080px;overflow:hidden}
body{background:radial-gradient(70% 70% at 50% 42%,#F1FAF5 0%,#D3E9DF 55%,#A9CFBE 100%)}
svg{position:absolute;inset:0}
</style></head><body>
<svg viewBox="0 0 1080 1080" width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="540" cy="842" rx="300" ry="46" fill="#8FC7A0" opacity=".55"/>
  ${[[250, 330, 16], [835, 300, 13], [880, 640, 10], [210, 690, 11]].map(([x, y, r]) => `<path transform="translate(${x} ${y})" d="M0 ${-r * 2}L${r * 0.55} ${-r * 0.55} ${r * 2} 0 ${r * 0.55} ${r * 0.55} 0 ${r * 2} ${-r * 0.55} ${r * 0.55} ${-r * 2} 0 ${-r * 0.55} ${-r * 0.55}Z" fill="#F7C548" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`).join('')}
  ${pet(540, 836, 5.5, { color: '#F6B7A8', ear: 'tunas', eyes: 'senyum' })}
</svg></body></html>`;

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: PW, height: H } });
const tmp = join(tmpdir(), 'bupi-ig');
mkdirSync(tmp, { recursive: true });
writeFileSync(join(tmp, 'grid.html'), page);
await p.goto('file://' + join(tmp, 'grid.html'));
await p.evaluate(() => document.fonts.ready);
const names = ['post-1-kiri.png', 'post-2-tengah.png', 'post-3-kanan.png'];
for (let i = 0; i < 3; i++) await p.screenshot({ path: out + names[i], clip: { x: VIS * i, y: 0, width: T, height: H } });
// pratinjau baris pertama grid profil (potongan 3:4 + celah putih seperti di aplikasi)
await p.setViewportSize({ width: 3 * VIS + 8, height: H });
await p.goto('about:blank');
const tiles = names.map((n) => readFileSync(out + n).toString('base64'));
await p.setContent(`<body style="margin:0;background:#fff;display:flex;gap:4px">${tiles.map((b) => `<div style="width:${VIS}px;height:${H}px;overflow:hidden;position:relative"><img src="data:image/png;base64,${b}" style="position:absolute;left:-${PAD}px;top:0"></div>`).join('')}</body>`);
await p.screenshot({ path: out + 'pratinjau-grid.png' });
const q = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
writeFileSync(join(tmp, 'profil.html'), profile);
await q.goto('file://' + join(tmp, 'profil.html'));
await q.screenshot({ path: out + 'profil.png' });
await browser.close();
console.log('dibuat di', out);
