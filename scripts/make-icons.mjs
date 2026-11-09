// Membuat ikon PWA (PNG) dari pet orisinal "Bulu" memakai Chromium (Playwright).
// Jalankan: npm run icons (butuh Playwright + Chromium terpasang)  (hasilnya di-commit ke apps/game/public/icons)
import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const out = new URL('../apps/game/public/icons/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const { renderPet } = await import('../packages/shared/src/art.ts');

const pet = renderPet({ color: '#F6B7A8', ear: 'tunas' }, []);
const icon = (pad, round) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${round}" fill="#B7D7CA"/>
  <circle cx="256" cy="300" r="${200 - pad}" fill="#D3E9DF"/>
  <g transform="translate(256 ${392 - pad * 0.6}) scale(${(3.1 * (200 - pad)) / 200})">${pet}</g>
</svg>`;
writeFileSync(out + 'favicon.svg', icon(0, 112));

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const browser = await chromium.launch();
const page = await browser.newPage();
async function png(svg, size, file) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: out + file, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}
await png(icon(0, 112), 192, 'icon-192.png');
await png(icon(0, 112), 512, 'icon-512.png');
await png(icon(40, 0), 512, 'maskable-512.png');
await png(icon(0, 0), 180, 'apple-touch-icon.png');
// ikon badge (siluet putih) untuk bilah status Android
const silhouette = renderPet({ color: '#FFFFFF', ear: 'tunas' }, [])
  .replace(/fill="#[0-9A-Fa-f]{3,6}"/g, 'fill="#FFFFFF"').replace(/stroke="#[0-9A-Fa-f]{3,6}"/g, 'stroke="#FFFFFF"').replace(/fill="#000"/g, 'fill="none"');
await png(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-60 -118 120 124">${silhouette}</svg>`, 96, 'badge-96.png');
await browser.close();
console.log('ikon dibuat di', out);
