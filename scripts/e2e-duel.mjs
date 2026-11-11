// Uji duel dua pemain sekaligus (HP + desktop): main bareng Balap Bakiak, lalu tantangan Tangkap Layangan
// melawan bayangan. Jalankan server dulu (npm run build && npm start), lalu: npm run test:e2e:duel
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE_URL ?? 'http://localhost:8787';
const OUT = process.env.SHOTS ?? 'test-results/e2e-duel';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const errors = [];
async function player(name, pet, opts) {
  const ctx = await b.newContext(opts);
  await ctx.request.post(BASE + '/api/auth/guest', { data: {} });
  const r = await ctx.request.post(BASE + '/api/pet', { data: { name: pet, color: name === 'Rani' ? '#F6B7A8' : '#9FD0E8', ear: name === 'Rani' ? 'kelinci' : 'kucing' } });
  const st = await r.json();
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(name + ': ' + e.message));
  p.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 500) errors.push(`${name} ${r.status()} ${r.url()}`); });
  return { ctx, p, id: st.state.user.id, code: st.state.user.friend_code, name };
}
const A = await player('Rani', 'Mochi', { ...devices['Pixel 7'] });
const B = await player('Dimas', 'Kopi', { viewport: { width: 1366, height: 820 }, deviceScaleFactor: 1 });
await B.ctx.request.post(BASE + '/api/friends', { data: { code: A.code } });
const shot = (pl, n) => pl.p.screenshot({ path: `${OUT}/${n}.png` });
const settle = (pl, ms = 400) => pl.p.waitForTimeout(ms);

// 1. A buka Teman → Duel Teman → pilih teman & permainan
await A.p.goto(BASE + '/#friends');
await A.p.waitForSelector('.duelbar');
await settle(A, 600); await shot(A, '01-teman-duel');
await A.p.click('.friend .btn:has-text("Duel")');
await A.p.waitForSelector('.new .friends button.on');
await A.p.click('.games button:has-text("Balap Bakiak")');
await settle(A); await shot(A, '02-buat-tantangan');
await A.p.click('.new .btn:has-text("Tantang!")');
await A.p.waitForSelector('.lobby .card');
await settle(A, 1200); await shot(A, '03-ruang-duel-menunggu');

// 2. B membuka daftar duel (dari notifikasi /#duels)
await B.p.goto(BASE + '/#duels');
await B.p.waitForSelector('.duel.hot');
await settle(B, 600); await shot(B, '04-desktop-daftar-duel');
await B.p.click('.duel.hot .btn:has-text("Buka")');
// keduanya siap → hitung mundur bersama
await A.p.waitForSelector('.card .big', { timeout: 10000 });
await settle(A, 200); await shot(A, '05-main-bareng-hitung-mundur');
await B.p.waitForSelector('.card .big', { timeout: 10000 }).catch(() => {});
await shot(B, '05b-desktop-hitung-mundur');

// 3. main: A cepat, B lebih lambat & sesekali salah
async function play(pl, gap, mistakeEvery) {
  await pl.p.waitForSelector('.prompt', { timeout: 15000 });
  const t0 = Date.now(); let i = 0;
  while (Date.now() - t0 < 23000) {
    const txt = await pl.p.locator('.prompt').first().innerText().catch(() => '');
    if (!txt) break;
    let key = txt.startsWith('KIRI') ? 'ArrowLeft' : txt.startsWith('KANAN') ? 'ArrowRight' : null;
    if (key && mistakeEvery && ++i % mistakeEvery === 0) key = key === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft';
    if (key) await pl.p.keyboard.press(key);
    await pl.p.waitForTimeout(gap);
  }
}
const pa = play(A, 230, 0), pb = play(B, 330, 9);
await A.p.waitForTimeout(9000 + 3000);
await shot(A, '06-main-bareng-hp');
await shot(B, '06b-main-bareng-desktop');
await Promise.all([pa, pb]);
await A.p.waitForSelector('.card h2', { timeout: 30000 });
await B.p.waitForSelector('.card h2', { timeout: 30000 });
await A.p.waitForFunction(() => /menang|Kalah|Seri/.test(document.querySelector('.card h2')?.textContent ?? ''), null, { timeout: 30000 }).catch(() => {});
await B.p.waitForFunction(() => /menang|Kalah|Seri/.test(document.querySelector('.card h2')?.textContent ?? ''), null, { timeout: 30000 }).catch(() => {});
await settle(A, 600); await shot(A, '07-hasil-hp');
await settle(B, 300); await shot(B, '07b-hasil-desktop');

// 4. tantangan bergantian: B menantang A main Tangkap Layangan, B main duluan
await B.p.click('.card .btn:has-text("Kembali ke Duel")');
await B.p.waitForSelector('.sheet');
await B.p.click('.sheet .btn:has-text("Tantang teman")');
await B.p.click('.new .friends button >> nth=0');
await B.p.click('.games button:has-text("Tangkap Layangan")');
await B.p.click('.new .btn:has-text("Tantang!")');
await B.p.waitForSelector('.lobby .card .btn:has-text("Main duluan")');
await settle(B, 500); await shot(B, '08-desktop-ruang-duel');
await B.p.click('.lobby .btn:has-text("Main duluan")');
async function catchKites(pl, rate) {
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    const k = pl.p.locator('.kite:not([aria-label="Layangan sobek"])');
    const n = await k.count().catch(() => 0);
    if (n && Math.random() < rate) await k.first().dispatchEvent('pointerdown').catch(() => {});
    if (await pl.p.locator('.card h2').count()) break;
    await pl.p.waitForTimeout(120);
  }
}
await B.p.waitForSelector('.top', { timeout: 10000 });
await catchKites(B, 0.6);
await B.p.waitForSelector('.card h2', { timeout: 15000 });
await settle(B, 500); await shot(B, '09-desktop-skor-tersimpan');

// 5. A membalas melawan bayangan B
await A.p.click('.card .btn:has-text("Kembali ke Duel")');
// A (tamu) baru menang duel: muncul ajakan Simpan progres; "Nanti saja" kembali ke daftar duel
await A.p.waitForSelector('.sheet[aria-label="Simpan progres"]', { timeout: 5000 });
await settle(A, 600); await shot(A, '09b-ajakan-simpan-setelah-menang');
await A.p.click('.sheet .link:has-text("Nanti saja")');
await A.p.waitForSelector('.sheet .duel.hot');
await settle(A, 500); await shot(A, '10-giliranmu');
await A.p.click('.duel.hot .btn:has-text("Main")');
await A.p.waitForSelector('.lobby .btn:has-text("Main sekarang")');
await settle(A, 500); await shot(A, '11-kalahkan-skornya');
await A.p.click('.lobby .btn:has-text("Main sekarang")');
await A.p.waitForSelector('.vsbar', { timeout: 10000 });
const ck = catchKites(A, 0.8);
await A.p.waitForTimeout(12000); await shot(A, '12-lawan-bayangan');
await ck;
await A.p.waitForSelector('.card h2', { timeout: 15000 });
await settle(A, 800); await shot(A, '13-hasil-tantangan');
// daftar duel A: riwayat
await A.p.click('.card .btn:has-text("Kembali ke Duel")');
await A.p.waitForSelector('.duel.past');
await settle(A, 500); await shot(A, '14-riwayat');
await b.close();
if (errors.length) { console.error('Galat:', errors); process.exit(1); }
console.log('Duel OK. Screenshot di', OUT);
