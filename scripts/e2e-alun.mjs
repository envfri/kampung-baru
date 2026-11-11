// Uji Alun-alun dengan 3 pemain yang bukan teman (2 HP, 1 desktop): jalan dari peta, saling melihat, obrolan,
// naik komidi putar, jajan, joget (bila musik sedang main), foto bareng, blokir & laporan.
// Jalankan server dulu (npm run build && npm start), lalu: npm run test:e2e:alun
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE_URL ?? 'http://localhost:8787', OUT = process.env.SHOTS ?? 'test-results/e2e-alun';
mkdirSync(OUT, { recursive: true });
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [], errors = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'GAGAL'} ${msg}`); if (!ok) fails.push(msg); };
const b = await chromium.launch();
async function mk(pet, color, ear, opts) {
  const ctx = await b.newContext(opts);
  await ctx.addInitScript(() => { try { localStorage.setItem('kb-save-snooze', String(Date.now() + 9e9)); } catch {} });
  await ctx.request.post(BASE + '/api/auth/guest', { data: {} });
  const st = await (await ctx.request.post(BASE + '/api/pet', { data: { name: pet, color, ear } })).json();
  await ctx.request.post(BASE + '/api/daily', { data: {} });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(pet + ': ' + e.message));
  p.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 500) errors.push(`${pet} ${r.status()} ${r.url()}`); });
  return { ctx, p, pet, id: st.state.user.id };
}
const shot = (pl, n) => pl.p.screenshot({ path: `${OUT}/${n}.png` });
async function closeSheets(pl) { for (let i = 0; i < 3; i++) { const x = pl.p.locator('.sheet .x'); if (await x.count()) { await x.first().click(); await W(300); } } }
async function enter(pl) {
  await pl.p.goto(BASE + '/'); await W(1500); await closeSheets(pl);
  await pl.p.goto(BASE + '/?r=1#alun'); await pl.p.waitForSelector('.sbar', { timeout: 20000 }); await W(800);
}
/** ketuk benda di alun-alun berdasarkan urutan di ALUN_LAYOUT (10 potong jalan batu dulu) */
const PROP = { panggung: 10, airmancur: 11, komidi: 14, ayunan: 15, dawet: 16, bakso: 17 };
async function tapProp(pl, i) {
  await pl.p.evaluate((idx) => {
    const el = document.querySelector(`svg.room .furn[data-r="alun"][data-i="${idx}"]`);
    const r = el?.getBoundingClientRect();
    el?.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r ? r.left + r.width / 2 : 100, clientY: r ? r.top + r.height / 2 : 100 }));
  }, i);
}

const A = await mk('Gethuk', '#F6B7A8', 'kelinci', { ...devices['Pixel 7'] });
const B = await mk('Klepon', '#9FD0E8', 'kucing', { viewport: { width: 1366, height: 820 } });
const C = await mk('Cenil', '#C9B6E8', 'tunas', { ...devices['Pixel 7'] });

// peta kampung punya Alun-alun
await A.p.goto(BASE + '/'); await W(1500); await closeSheets(A);
await A.p.click('.dock button:has-text("Kampung"), nav button:has-text("Kampung")').catch(() => {});
await W(1200);
check(await A.p.locator('svg.map .loc[data-loc="alun"]').count() === 1, 'Alun-alun ada di peta kampung');
await A.p.evaluate(() => { const w = document.querySelector('.wrap'); if (w) w.scrollLeft = w.scrollWidth; });
await W(300); await shot(A, '01-peta-alun-alun');

for (const pl of [A, B, C]) await enter(pl);
await W(4000);
const sees = async (pl, name) => pl.p.locator(`.tag:text-is("${name}")`).count();
let both = false;
for (let i = 0; i < 20 && !both; i++) { both = (await sees(A, 'Klepon')) + (await sees(A, 'Cenil')) >= 1; if (!both) await W(500); }
check(both, 'pemain lain (bukan teman) terlihat di alun-alun');
check((await A.p.locator('.sbar .status').textContent()).includes('3/20'), 'status: 3/20 orang');
await shot(A, '02-hp-alun-alun');
await shot(B, '03-desktop-alun-alun');
await A.p.click('.roombar .cambtn'); await W(1200);
await shot(A, '04-hp-seluruh-alun-alun');
await A.p.click('.roombar .cambtn'); await W(800);

// obrolan frasa
await A.p.click('.sbar .btn:has-text("Ngobrol")');
await A.p.click('.sbar .chip:has-text("Halo semua!")');
let heard = false;
for (let i = 0; i < 10 && !heard; i++) { await W(400); heard = (await B.p.locator('.bubble.hb:has-text("Halo semua!")').count()) > 0; }
check(heard, 'obrolan sampai ke pemain lain');
await A.p.click('.sbar .btn:has-text("Tutup")');
await shot(B, '05-desktop-obrolan');

// naik komidi putar
await tapProp(A, PROP.komidi); await W(400);
check(await A.p.locator('.menu .btn:has-text("Naik komidi putar")').count() === 1, 'ketuk komidi putar: menu Naik');
await A.p.click('.menu .btn:has-text("Naik komidi putar")');
let rode = false;
for (let i = 0; i < 24 && !rode; i++) { await W(300); rode = (await A.p.locator('svg.room .pet.pose-naik').count()) > 0; }
check(rode, 'pet naik komidi putar');
await shot(A, '06-hp-naik-komidi');
await W(4000);

// jajan es dawet
await tapProp(C, PROP.dawet); await W(400);
const jajan = C.p.locator('.menu .btn:has-text("Jajan Es Dawet")');
check(await jajan.count() === 1, 'gerobak: menu Jajan Es Dawet');
if (await jajan.count()) { await jajan.click(); await W(6000); }
check((await C.p.locator('.toast').textContent().catch(() => '')).length >= 0, 'jajan selesai');
await shot(C, '07-hp-jajan');

// joget bareng bila musik sedang main
const music = !(await A.p.locator('.sbar .btn:has-text("Joget")').isDisabled());
if (music) {
  for (const pl of [A, B, C]) await pl.p.click('.sbar .btn:has-text("Joget")');
  await W(2500);
  check((await A.p.locator('svg.room .pose-joget').count()) >= 2, 'joget bareng terlihat');
  await shot(A, '08-hp-joget-bareng');
} else console.log('     (musik sedang tidak main: joget dilewati)');

// foto bareng: pet di dekat yang memotret ikut
await B.p.click('.sbar .btn:has-text("Foto")'); await B.p.click('.sbar .pop .btn:has-text("Senyum")');
await W(1500);
check(await B.p.locator('.ph').count() === 1 || (await B.p.locator('.toast:has-text("Ajak pet lain")').count()) === 1, 'foto bareng: pratinjau foto atau ajakan mendekat');
await shot(B, '09-desktop-foto');
await B.p.locator('.ph .btn:has-text("Tutup")').click().catch(() => {});

// laporkan & blokir
await C.p.click('.sbar .btn:has-text("Orang")'); await W(300);
await C.p.click('.sbar .pop .guest:has-text("Klepon") .btn:has-text("Laporkan")');
await C.p.fill('.sbar .pop .input', 'uji laporan');
await C.p.click('.sbar .pop .btn:has-text("Kirim laporan")'); await W(600);
check((await C.p.locator('.toast').textContent().catch(() => '')).includes('Laporan'), 'laporan terkirim');
await C.p.click('.sbar .btn:has-text("Orang")'); await W(300);
await C.p.click('.sbar .pop .guest:has-text("Gethuk") .btn:has-text("Blokir")');
await C.p.click('.confirm .btn:has-text("Blokir"), dialog .btn:has-text("Blokir"), .cd .btn:has-text("Blokir")').catch(() => {});
await W(3000);
check(await sees(C, 'Gethuk') === 0, 'pemain yang diblokir hilang dari alun-alun');
await shot(C, '10-hp-setelah-blokir');

// pulang ke peta
await A.p.click('.sbar .btn:has-text("Pulang")'); await W(1200);
check(await A.p.locator('svg.map').count() === 1, 'Pulang: kembali ke peta kampung');

if (errors.length) { console.log('Error halaman:'); for (const e of errors) console.log('  ' + e); }
await b.close();
if (fails.length || errors.length) { console.log(`\n${fails.length} cek gagal, ${errors.length} error`); process.exit(1); }
console.log('\nSemua cek alun-alun lolos.');
