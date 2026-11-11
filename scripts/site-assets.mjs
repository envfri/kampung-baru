// Aset situs dari art orisinal BUPI, memakai Chromium (Playwright):
//  - apps/game/public/og/bupi.jpg      gambar pratinjau tautan (Open Graph / kartu X), 1200×630
//  - deploy/perawatan/index.html      halaman perawatan statis untuk Caddy saat server sedang dimulai ulang
// Jalankan: npm run site-assets   (hasilnya di-commit)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const root = new URL('../', import.meta.url).pathname;
const { petMarkup, itemIcon, ALUN_ITEMS, DEFAULT_SITE, maintenancePage, socialLinks } = await import('../packages/shared/src/index.ts');

const require = createRequire(import.meta.url);
const fontDir = root + 'node_modules/@fontsource/baloo-2/files/';
const font = (w, inline) => `@font-face{font-family:'Baloo 2';font-style:normal;font-weight:${w};font-display:swap;src:url(${inline ? `data:font/woff2;base64,${readFileSync(fontDir + `baloo-2-latin-${w}-normal.woff2`).toString('base64')}` : `file://${fontDir}baloo-2-latin-${w}-normal.woff2`}) format('woff2')}`;
const INK = '#2B2F4A';

/* ---------------- gambar pratinjau 1200×630 ---------------- */
const wear = (key) => ({ id: key, kind: 'wear', name: key, art: { type: 'builtin', key }, data: {} });
const pet = (x, y, s, look, opts = {}) => `<g transform="translate(${x} ${y}) scale(${s})">${petMarkup({ look, wear: opts.wear ?? [], state: { mood: 'senang' }, flip: opts.flip, prop: opts.prop })}</g>`;
const icon = (id, x, y, w) => itemIcon(ALUN_ITEMS[id]).replace('<svg ', `<svg x="${x}" y="${y}" width="${w}" height="${w * 1.04}" `);
const flags = (() => {
  const C = ['#E0583F', '#F2B632', '#3FA06A', '#3F7FBF', '#E7A1C9', '#FFFDF7'];
  let s = `<path d="M-10 18Q600 120 1210 18" fill="none" stroke="${INK}" stroke-width="3"/>`;
  for (let i = 0; i < 24; i++) {
    const t = (i + 0.5) / 24, u = 1 - t;
    const x = u * u * -10 + 2 * u * t * 600 + t * t * 1210, y = u * u * 18 + 2 * u * t * 120 + t * t * 18;
    s += `<path transform="translate(${x.toFixed(1)} ${(y - 1).toFixed(1)}) rotate(${((t - 0.5) * -14).toFixed(1)})" d="M-15 0H15L0 27Z" fill="${C[i % C.length]}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
  }
  return s;
})();
const house = `<g transform="translate(120 330)">
  <rect x="20" y="90" width="200" height="130" fill="#FFFDF7" stroke="${INK}" stroke-width="5"/>
  <path d="M0 96L120 12 240 96Z" fill="#E0583F" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
  <path d="M38 80L120 22M202 80L120 22M64 62H176" stroke="#B9452F" stroke-width="4" fill="none"/>
  <rect x="96" y="140" width="46" height="80" rx="4" fill="#B98A64" stroke="${INK}" stroke-width="4.5"/><circle cx="133" cy="182" r="4" fill="${INK}"/>
  <rect x="38" y="118" width="40" height="36" rx="4" fill="#BFE3F5" stroke="${INK}" stroke-width="4"/><path d="M58 118V154M38 136H78" stroke="${INK}" stroke-width="3.5"/>
  <rect x="160" y="118" width="40" height="36" rx="4" fill="#BFE3F5" stroke="${INK}" stroke-width="4"/><path d="M180 118V154M160 136H200" stroke="${INK}" stroke-width="3.5"/>
</g>`;
const scene = `<svg viewBox="0 0 1200 630" width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <circle cx="1090" cy="120" r="44" fill="#F7C548" stroke="${INK}" stroke-width="4"/>
  ${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<path transform="translate(1090 120) rotate(${a})" d="M0 -62V-76" stroke="#F2B632" stroke-width="8" stroke-linecap="round"/>`).join('')}
  <path d="M60 210a26 26 0 0 1 14-44a34 34 0 0 1 62-12a26 26 0 0 1 44 16a22 22 0 0 1 8 40z" fill="#fff" opacity=".9"/>
  ${flags}
  <path d="M40 560Q260 500 600 512T1160 548Q1186 552 1184 580Q1182 612 1150 612H56Q22 612 20 584Q18 562 40 560Z" fill="#A8D8A0" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
  <path d="M90 584q8-14 16 0M1060 590q8-14 16 0M560 596q8-14 16 0" fill="none" stroke="#5E9E5A" stroke-width="4" stroke-linecap="round"/>
  ${house}
  ${icon('alun-komidi', 880, 300, 290)}
  ${icon('alun-pohon', 1062, 372, 150)}
  ${pet(470, 562, 1.25, { color: '#9FD0E8', ear: 'kelinci', eyes: 'bulat' }, { prop: 'gitar' })}
  ${pet(735, 562, 1.25, { color: '#C9B6E8', ear: 'kucing', pattern: 'totol', eyes: 'senyum' }, { wear: [wear('blangkon')], flip: true })}
  ${pet(602, 584, 1.6, { color: '#F6B7A8', ear: 'tunas', eyes: 'senyum' })}
</svg>`;
const og = `<!doctype html><html><head><meta charset="utf-8"><style>
${font(700, true)}${font(800, true)}
html,body{margin:0;width:1200px;height:630px;overflow:hidden}
body{position:relative;font-family:'Baloo 2',sans-serif;color:${INK};background:radial-gradient(120% 90% at 50% 10%,#F1FAF5 0%,#D3E9DF 50%,#B7D7CA 100%)}
.scene{position:absolute;inset:0}
.txt{position:absolute;left:0;right:0;top:96px;display:flex;flex-direction:column;align-items:center;gap:0}
h1{margin:0;font-size:150px;line-height:.86;font-weight:800;letter-spacing:-2px;color:${INK};text-shadow:0 6px 0 #fff,0 8px 0 rgba(43,47,74,.12)}
p{margin:14px 0 0;font-size:38px;font-weight:700;line-height:1.1}
.chips{display:flex;gap:12px;margin-top:16px}
.chip{background:${INK};color:#F7C548;font-weight:800;font-size:23px;letter-spacing:.04em;padding:4px 18px 1px;border-radius:999px;text-transform:uppercase}
</style></head><body>
<div class="scene">${scene}</div>
<div class="txt"><h1>BUPI</h1><p>Rawat pet lucu, hias rumah, main bareng teman</p>
<div class="chips"><span class="chip">Gratis</span><span class="chip">Main di HP &amp; browser</span><span class="chip">Tanpa unduh</span></div></div>
</body></html>`;

const { chromium } = require('playwright');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
mkdirSync(root + 'apps/game/public/og', { recursive: true });
await page.setContent(og, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
// JPEG (~100 KB): WhatsApp tidak menampilkan pratinjau untuk gambar yang terlalu besar
await page.screenshot({ path: root + 'apps/game/public/og/bupi.jpg', type: 'jpeg', quality: 90, clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();

/* ---------------- halaman perawatan statis (Caddy) ---------------- */
mkdirSync(root + 'deploy/perawatan', { recursive: true });
const m = { title: 'BUPI sedang diperbarui', message: 'Versi baru sedang dipasang. Biasanya cuma sebentar, halaman ini akan terbuka sendiri begitu BUPI siap.', until: null };
writeFileSync(root + 'deploy/perawatan/index.html', maintenancePage(m, socialLinks(DEFAULT_SITE.social), { kind: 'static', fontCss: font(600, true) + font(800, true) }));
console.log('dibuat: apps/game/public/og/bupi.jpg, deploy/perawatan/index.html');
