// Uji kunjungan bareng dengan 5 pemain sekaligus (tuan rumah + 4 tamu, HP & desktop): status online di Teman,
// semua pet tampil di rumah, obrolan & ekspresi, peluk, Masak bareng, foto bareng, antar pulang, lukisan & album.
// Jalankan server dulu (npm run build && npm start), lalu: npm run test:e2e:kunjungan
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE_URL ?? 'http://localhost:8787', OUT = process.env.SHOTS ?? 'test-results/e2e-kunjungan';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); const errors = [];
const W = (ms) => new Promise((r) => setTimeout(r, ms));
async function mk(pet, color, ear, opts) {
  const ctx = await b.newContext(opts);
  await ctx.addInitScript(() => { try { localStorage.setItem('kb-save-snooze', String(Date.now() + 9e9)); } catch {} });
  await ctx.request.post(BASE + '/api/auth/guest', { data: {} });
  const st = await (await ctx.request.post(BASE + '/api/pet', { data: { name: pet, color, ear } })).json();
  await ctx.request.post(BASE + '/api/daily', { data: {} });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(pet + ': ' + e.message));
  p.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 500) errors.push(`${pet} ${r.status()} ${r.url()}`); });
  return { ctx, p, pet, id: st.state.user.id, code: st.state.user.friend_code };
}
const phone = { ...devices['Pixel 7'] };
const A = await mk('Mochi', '#F6B7A8', 'kelinci', phone);
const B = await mk('Kopi', '#9FD0E8', 'kucing', { viewport: { width: 1366, height: 820 } });
const C = await mk('Onde', '#F4D58D', 'tunas', phone);
const D = await mk('Cilok', '#A8D8A0', 'kucing', phone);
const E = await mk('Serabi', '#C9B6E8', 'kelinci', phone);
for (const v of [B, C, D, E]) await v.ctx.request.post(BASE + '/api/friends', { data: { code: A.code } });
const shot = (pl, n) => pl.p.screenshot({ path: `${OUT}/${n}.png` });
async function closeSheets(pl) { for (let i = 0; i < 3; i++) { const x = pl.p.locator('.sheet .x'); if (await x.count()) { await x.first().click(); await W(300); } } }

// tuan rumah di rumah
await A.p.goto(BASE + '/'); await W(1500); await closeSheets(A);
// B melihat A online di daftar teman lalu ikut main
await B.p.goto(BASE + '/#friends'); await B.p.waitForSelector('.friend'); await W(2500);
await B.p.goto(BASE + '/?r=1#friends'); await B.p.waitForSelector('.friend'); await W(800);
await shot(B, '01-teman-online');
await B.p.click(`.friend:has-text("Mochi") .btn:has-text("Main bareng"), .friend:has-text("Mochi") .btn:has-text("Kunjungi")`);
await B.p.waitForSelector('.hbar'); await W(800);
for (const v of [C, D, E]) {
  await v.p.goto(BASE + '/#friends'); await v.p.waitForSelector('.friend');
  await v.p.click(`.friend:has-text("Mochi") .btn >> nth=0`);
  await v.p.waitForSelector('.hbar');
}
await W(4000);
await shot(A, '02-tuan-rumah-ramai');
await shot(B, '03-desktop-tamu');
await shot(C, '04-hp-tamu');
// obrolan & ekspresi
await B.p.click('.hbar .btn:has-text("Ngobrol")');
await B.p.fill('.hbar .chat .input', 'Halo semua! Rumahnya adem');
await B.p.click('.hbar .chat .btn:has-text("Kirim")');
await D.p.click('.hbar .btn:has-text("Ekspresi")'); await D.p.click('.pop .em >> nth=2');
await W(1800); await shot(A, '05-obrolan-di-rumah');
// C memeluk pet tuan rumah
await C.p.click('.hbar .act:has-text("Peluk")');
const hostSeen = []; for (let i = 0; i < 8; i++) { hostSeen.push(await C.p.locator('.tag:text-is("Mochi")').count()); await W(250); }
await shot(C, '06-peluk'); await W(2000);
// Masak bareng: A memulai, semua bergiliran memilih bahan sesuai resep
await A.p.click('.hbar .btn:has-text("Main bareng")'); await A.p.click('.pop .btn:has-text("Masak bareng")');
await W(2500); await shot(C, '07-masak-bareng');
const players = [A, B, C, D, E];
for (let n = 0; n < 60; n++) {
  let done = false;
  for (const pl of players) {
    if (await pl.p.locator('.coop header b:has-text("jadi"), .coop header b:has-text("Belum")').count()) { done = true; }
    const want = await pl.p.locator('.coop .step.now').getAttribute('title').catch(() => null);
    const btn = pl.p.locator(`.coop .opt:not([disabled]):has-text("${want}")`);
    if (want && await btn.count()) { await btn.first().click(); await W(300); }
  }
  if (done) break;
  await W(500);
}
await W(1500); await shot(A, '08-masak-hasil'); await shot(B, '08b-masak-hasil-desktop');
for (const pl of players) { const t = pl.p.locator('.coop .btn:has-text("Tutup")'); if (await t.count()) await t.click(); }
// foto bareng (gaya peluk)
await B.p.click('.hbar .btn:has-text("Foto")'); await B.p.click('.pop .btn:has-text("Peluk")');
await B.p.waitForSelector('.ph'); await W(500); await shot(B, '09-foto-bareng');
await B.p.click('.ph .btn:has-text("Tutup")').catch(() => {});
// tuan rumah mengantar Serabi pulang
await A.p.click('.hbar .btn:has-text("Tamu (")'); await A.p.click('.pop .guest:has-text("Serabi") .btn');
await W(2500);
const eView = await E.p.evaluate(() => document.querySelector('.hbar') ? 'masih' : 'pulang');
// lukisan rumah A sekarang berisi foto
await A.p.goto(BASE + '/?r=2'); await W(2500); await closeSheets(A); await W(600); await shot(A, '10-lukisan-foto');
const coopAgain = await A.p.locator('.coop').count();
await A.p.goto(BASE + '/?r=3#album'); await W(1500); await shot(A, '11-album');
await b.close();
if (hostSeen.includes('0')) errors.push('pet tuan rumah sempat hilang: ' + hostSeen.join(''));
if (coopAgain) errors.push('hasil main bareng muncul lagi setelah muat ulang');
if (eView !== 'pulang') errors.push('tamu yang diantar pulang masih di rumah');
if (errors.length) { console.error('Galat:', errors); process.exit(1); }
console.log('Kunjungan bareng OK. Screenshot di', OUT);
