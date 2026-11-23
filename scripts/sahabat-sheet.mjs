// Lembar kontak Sahabat Mungil (paket konten 23): sembilan sahabat — gambar biasa, gambar trik / terbang, warna kerang
// umang-umang, kalung emas Sahabat Sejati, ikon Album (siluet), ikon item, dan Pondok Sahabat di peta. Untuk paket
// desain & pemeriksaan gambar (tanpa server).
// Jalankan: npm run sahabat-sheet -- [folder keluaran]
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  SAHABAT_SPECIES, SAHABAT_INFO, UMANG_COLORS, buddyMarkup, buddyIcon, itemIcon, pondokSVG, renderPet,
} from '../packages/shared/src/index.ts';

const require = createRequire(import.meta.url);
const OUT = process.argv[2] ?? 'test-results/sahabat-sheet';
mkdirSync(OUT, { recursive: true });

const cell = (title, svg, sub = '') => `<figure><div class="art">${svg}</div><figcaption><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</figcaption></figure>`;
const stage = (inner, vb = '-40 -60 80 66') => `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
// frame trik / terbang: kelas yang sama dengan game, ditampilkan lewat CSS lembar ini
const frame = (sp, cls, o = {}) => stage(`<g class="bud ${cls}">${buddyMarkup(sp, o)}</g>`, SAHABAT_INFO[sp].fly && !o.perch ? '-40 -92 80 98' : undefined);
const pet = { color: '#F6B7A8', ear: 'kucing', pattern: 'polos', eyes: 'bulat', tail: 'bulat' };

let rows = '';
for (const sp of SAHABAT_SPECIES) {
  const I = SAHABAT_INFO[sp];
  const alt = sp === 'pipit' ? frame(sp, 'mv') : sp === 'kunang' ? frame(sp, 'nite') : ['umang', 'bebek', 'kura', 'hamster', 'landak'].includes(sp) ? frame(sp, 'trk') : frame(sp, 'flip', { flip: true });
  const altLabel = sp === 'pipit' ? 'terbang' : sp === 'kunang' ? 'malam' : ['umang', 'bebek', 'kura', 'hamster', 'landak'].includes(sp) ? `trik: ${I.trick}` : 'menghadap kiri';
  rows += `<section><h2>${I.name}</h2><p>${I.sifat}</p><div class="row">` +
    cell('biasa', frame(sp, '')) + cell(altLabel, alt) + cell('Sahabat Sejati', frame(sp, '', { lvl: 2 }), 'kalung emas') +
    cell('oleh-oleh', frame(sp, '', { gift: true })) +
    cell('di kepala pet', stage(`<g transform="scale(.82)">${renderPet(pet)}<g transform="translate(${sp === 'pipit' ? 3 : 0} ${sp === 'pipit' ? -74 : -70})">${buddyMarkup(sp, { perch: true, lvl: 1 })}</g></g>`, '-60 -150 120 156')) +
    cell('Album (belum)', buddyIcon(sp, { sil: true })) +
    `</div></section>`;
}
let shells = '';
for (const [k, c] of Object.entries(UMANG_COLORS)) shells += cell(c.label, frame('umang', '', { variant: k }), k);
const items = ['camilansahabat', 'keranghias'].map((key) => cell(key === 'camilansahabat' ? 'Camilan Sahabat' : 'Kerang Hias', itemIcon({ id: key, kind: 'material', name: key, art: { type: 'builtin', key }, data: {} }))).join('');
const pondok = stage(pondokSVG(0, 0), '-80 -100 160 112');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body { font-family: 'Baloo 2', system-ui, sans-serif; background: #FBF6EA; color: #2B2F4A; margin: 24px; }
h1 { margin: 0 0 6px; } h2 { margin: 0; font-size: 20px; } p { margin: 0 0 6px; color: #5F6478; font-weight: 600; }
section { background: #FFFDF7; border: 2.5px solid #2B2F4A; border-radius: 18px; padding: 10px 14px; margin: 0 0 12px; box-shadow: 0 3px 0 #2B2F4A; }
.row { display: flex; gap: 10px; flex-wrap: wrap; }
figure { margin: 0; width: 150px; text-align: center; }
.art { height: 120px; background: #E8F2DD; border-radius: 12px; display: grid; place-items: center; }
.art svg { height: 112px; width: 140px; }
figcaption { display: flex; flex-direction: column; font-size: 13px; } figcaption small { color: #5F6478; }
.bud.trk .b-n { display: none; } .bud.trk .b-t { display: inline; }
.bud.mv .b-n { display: none; } .bud.mv .b-f { display: inline; }
.bud.nite .b-glow { transform: scale(1.75); transform-box: fill-box; transform-origin: center; }
.dark .art { background: #2E3D5E; }
</style></head><body><h1>Sahabat Mungil — lembar kontak</h1><p>Gambar SVG orisinal (garis tinta, isian datar). Ukuran = ruang pet (pet ±100 × 110).</p>
${rows}
<section><h2>Umang-umang: warna rumah kerang</h2><div class="row">${shells}</div></section>
<section class="dark"><h2 style="color:#2B2F4A">Kunang-kunang malam</h2><div class="row">${cell('malam', frame('kunang', 'nite'))}${cell('malam, Sejati', frame('kunang', 'nite', { lvl: 2 }))}</div></section>
<section><h2>Item & Pondok Sahabat</h2><div class="row">${items}${cell('Pondok Sahabat', pondok, 'di peta')}</div></section>
</body></html>`;
writeFileSync(`${OUT}/sahabat-sheet.html`, html);

const { chromium } = require('playwright');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1040, height: 900 }, deviceScaleFactor: 2 });
await p.setContent(html);
await p.screenshot({ path: `${OUT}/sahabat-contact-sheet.png`, fullPage: true });
await b.close();
console.log(`${OUT}/sahabat-contact-sheet.png`);
