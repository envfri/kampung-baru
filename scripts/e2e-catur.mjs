// Uji Catur (main bareng): ajakan di rumah (aturan singkat di kartu), papan dua pemain (HP & desktop), langkah sah lewat
// ketukan, pilihan promosi (posisi dari permainan: 1.e4 d5 2.exd5 c6 3.dxc6 Nf6 4.cxb7 Nbd7 5.bxa8, otomatis Menteri
// setelah 10 dtk), menyerah dengan konfirmasi, kartu hasil; lalu Catur di Pos Ronda alun-alun: pet berjalan ke sana,
// dua pemain duduk di bale-bale, penonton melihat "A vs B · Tonton" dan bisa menonton.
// Jalankan server dulu (npm run build && npm start), lalu: BASE_URL=http://localhost:8787 node scripts/e2e-catur.mjs
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL ?? 'http://localhost:8787', OUT = process.env.SHOTS ?? 'test-results/e2e-catur';
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
  return { ctx, p, pet, id: st.state.user.id, code: st.state.user.friend_code };
}
const shot = (pl, n) => pl.p.screenshot({ path: `${OUT}/${n}.png` });
async function closeSheets(pl) { for (let i = 0; i < 3; i++) { const x = pl.p.locator('.sheet .x'); if (await x.count()) { await x.first().click(); await W(300); } } }

const phone = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 };
const A = await mk('Lupis', '#F6B7A8', 'kelinci', phone);
const B = await mk('Wajik', '#9FD0E8', 'kucing', { viewport: { width: 1366, height: 768 } });
const C = await mk('Putu', '#F4D58D', 'tunas', phone);
for (const v of [B, C]) await v.ctx.request.post(BASE + '/api/friends', { data: { code: A.code } });

/* ---------- Catur di rumah Lupis ---------- */
await A.p.goto(BASE + '/'); await W(1500); await closeSheets(A);
await B.p.goto(BASE + '/#friends'); await B.p.waitForSelector('.friend');
await B.p.click(`.friend:has-text("Lupis") .btn >> nth=0`); await B.p.waitForSelector('.hbar');
await W(3500);
await A.p.click('.hbar .btn:has-text("Main bareng")');
await W(400); await shot(A, '01-menu-main-rumah');
check(await A.p.locator('.pop .btn.g').count() >= 3, 'menu Main bareng: ubin papan & dadu');
check(await A.p.locator('.pop .btn.g:has-text("Catur") em:has-text("BARU")').count() === 1, 'ubin Catur dengan tanda BARU');
await A.p.click('.pop .btn.g:has-text("Catur")');
await B.p.waitForSelector('.card:has-text("mengajak main Catur")', { timeout: 8000 }).catch(() => {});
check(await B.p.locator('.card:has-text("mengajak main Catur") .rules span:has-text("dtk/langkah")').count() === 1, 'ajakan Catur dengan aturan singkat (5 mnt + 3 dtk/langkah)');
await shot(B, '02-ajakan-catur-desktop'); await shot(A, '03-menunggu-catur-hp');
await B.p.click('.card .btn:has-text("Ikut main")');
for (const pl of [A, B]) await pl.p.waitForSelector('.cw[aria-label="Papan catur"]', { timeout: 8000 }).catch(() => {});
check(await A.p.locator('.cw').count() === 1 && await B.p.locator('.cw').count() === 1, 'papan catur terbuka untuk kedua pemain');
check(await A.p.locator('.acts:not(.hide)').count() === 0, 'HP: tombol aksi disembunyikan selama main catur');
const aSide = (await A.p.locator('.pl.bot .side').textContent()).trim();
check(['Putih', 'Hitam'].includes(aSide), `warna diundi (Lupis ${aSide})`);
const W1 = aSide === 'Putih' ? A : B, B1 = W1 === A ? B : A;
check((await B1.p.locator('.pl.bot .side').textContent()).trim() === 'Hitam', 'sisi sendiri di bawah (Hitam: papan diputar)');
await W(500); await shot(A, '04-catur-awal-hp'); await shot(B, '05-catur-awal-desktop');
/** ketuk petak (aria-label "e2, Pion" dst.) */
async function tapSq(pl, sq) { await pl.p.locator(`.cw rect.hit[aria-label^="${sq}"]`).first().click({ force: true }); await W(120); }
async function move(pl, from, to, label) {
  await pl.p.waitForSelector(`.cw rect.hit[aria-label^="${from}"]`, { timeout: 8000 }).catch(() => {});
  await tapSq(pl, from);
  const dots = await pl.p.locator('.cw rect.hit[aria-label$="tujuan"]').count();
  await tapSq(pl, to);
  await W(700);
  if (label) check(dots > 0, `${label}: titik langkah sah tampil (${dots})`);
}
// bukan giliran: Hitam tidak punya petak yang bisa diketuk
check(await B1.p.locator('.cw rect.hit').count() === 0, 'bukan giliran: bidak tidak bisa diketuk');
await move(W1, 'e2', 'e4', 'e2→e4');
await move(B1, 'd7', 'd5', 'd7→d5');
await W(300); await shot(W1, '06-langkah-terakhir');
await move(W1, 'e4', 'd5');
await move(B1, 'c7', 'c6');
await move(W1, 'd5', 'c6');
await move(B1, 'g8', 'f6');
await move(W1, 'c6', 'b7');
await move(B1, 'b8', 'd7');
check(await B.p.locator('.cw .moves .mv').count() >= 4, 'desktop: daftar langkah');
const capsW = await W1.p.locator('.pl.bot .cp').count();
check(capsW >= 1, `bidak termakan tampil di samping nama (${capsW})`);
// promosi: b7 → a8 (makan Benteng): pilihan bidak muncul; 10 dtk tanpa pilihan = Menteri
await tapSq(W1, 'b7');
await tapSq(W1, 'a8');
await W1.p.waitForSelector('.cw .promo', { timeout: 4000 }).catch(() => {});
check(await W1.p.locator('.cw .promo .opt').count() === 4, 'pilihan promosi: Menteri, Benteng, Gajah, Kuda');
await W(300); await shot(W1, `07-promosi-${W1 === A ? 'hp' : 'desktop'}`);
await W(10_800);
const lastSan = await B.p.locator('.cw .moves .mv span.last').textContent().catch(() => '');
check(await W1.p.locator('.cw .promo').count() === 0 && lastSan.includes('xa8=Q'), `10 dtk tanpa pilihan = Menteri (${lastSan.trim()})`);
await W(600); await shot(A, '08-setelah-promosi-hp'); await shot(B, '09-setelah-promosi-desktop');
// menyerah (konfirmasi dulu)
await B1.p.click('.cw .btn:has-text("Menyerah")');
check(await B1.p.locator('.cw .btn:has-text("Ya, menyerah")').count() === 1, 'menyerah perlu konfirmasi');
await B1.p.click('.cw .btn:has-text("Ya, menyerah")');
for (const pl of [A, B]) await pl.p.waitForSelector('.res', { timeout: 10000 }).catch(() => {});
await W(1200);
check((await W1.p.locator('.res h2').textContent().catch(() => '')).includes('Kamu menang'), 'kartu hasil: Kamu menang!');
check((await B1.p.locator('.res').textContent().catch(() => '')).includes('menyerah'), 'kartu hasil menyebut menyerah');
check((await A.p.locator('.res').textContent().catch(() => '')).includes('tanpa hadiah'), 'kurang dari 20 paruh langkah: tanpa hadiah');
await shot(A, '10-hasil-hp'); await shot(B, '11-hasil-desktop');
for (const pl of [A, B]) { const t = pl.p.locator('.res .btn:has-text("Tutup")'); if (await t.count()) await t.click(); }
await W(500);
check(await A.p.locator('.cw').count() === 0, 'Tutup menutup papan');

/* ---------- Alun-alun: Catur di Pos Ronda ---------- */
async function enterAlun(pl, q = '') {
  await pl.p.goto(`${BASE}/?r=1${q}#alun`); await pl.p.waitForSelector('.sbar, .fp', { timeout: 20000 }); await W(800);
  const n = pl.p.locator('.fp .btn:has-text("Nanti")'); if (await n.count()) await n.click();
}
for (const pl of [A, B, C]) await enterAlun(pl);
await W(3000);
await A.p.click('.sbar .btn:has-text("Main")');
await W(400); await shot(A, '12-menu-main-alun');
check(await A.p.locator('.pop .btn.g:has-text("Catur"):has-text("Pos Ronda")').count() === 1, 'menu Main alun-alun: ubin Catur · Pos Ronda');
check(await A.p.locator('.pop .btn.g:has-text("Ular Tangga")').count() === 1 && await A.p.locator('.pop .btn.g:has-text("Balap Karung")').count() === 1, 'ubin Ular Tangga & Balap Karung');
await A.p.click('.pop .btn.g:has-text("Catur")');
await B.p.waitForSelector('.card:has-text("mengajak main Catur")', { timeout: 20000 }).catch(() => {});
check(await B.p.locator('.card:has-text("mengajak main Catur")').count() === 1, 'orang di alun-alun mendapat ajakan Catur');
await W(1500); await shot(A, '13-pet-ke-pos-ronda');
await B.p.click('.card .btn:has-text("Ikut main")');
for (const pl of [A, B]) await pl.p.waitForSelector('.cw', { timeout: 8000 }).catch(() => {});
await W(6000);
// penonton: pill Tonton & ubin "A vs B · Tonton"
await C.p.waitForSelector('.watch', { timeout: 8000 }).catch(() => {});
check(await C.p.locator('.watch:has-text("Catur sedang dimainkan")').count() === 1, 'penonton melihat "Catur sedang dimainkan · Tonton"');
const seated = await C.p.evaluate(() => [...document.querySelectorAll('svg.room .opet')].filter((e) => /scale\(0\.6\)/.test(e.getAttribute('transform') ?? '')).length);
check(seated === 2, `dua pemain duduk di bale-bale Pos Ronda (skala 0,6): ${seated}`);
await shot(C, '14-pos-ronda-dimainkan');
await C.p.click('.sbar .btn:has-text("Main")');
await W(400);
check(await C.p.locator('.pop .btn.g.busy:has-text(" vs ")').count() === 1, 'ubin Catur: "A vs B · Tonton"');
await shot(C, '15-menu-tonton');
await C.p.click('.pop .btn.g.busy');
await C.p.waitForSelector('.cw', { timeout: 5000 }).catch(() => {});
check(await C.p.locator('.cw .btn:has-text("Putar papan")').count() === 1, 'penonton: papan baca saja dengan Putar papan');
check(await C.p.locator('.cw rect.hit').count() === 0, 'penonton tidak bisa melangkah');
await C.p.click('.cw .btn:has-text("Putar papan")'); await W(300);
await shot(C, '16-penonton-hp');
await shot(A, '17-catur-alun-hp'); await shot(B, '18-catur-alun-desktop');
await C.p.click('.cw .btn:has-text("Berhenti menonton")'); await W(300);
check(await C.p.locator('.cw').count() === 0, 'Berhenti menonton');
const quitter = (await A.p.locator('.pl.bot .side').textContent()).trim() === 'Putih' ? A : B;
await quitter.p.click('.cw .btn:has-text("Menyerah")'); await quitter.p.click('.cw .btn:has-text("Ya, menyerah")');
await A.p.waitForSelector('.res', { timeout: 10000 }).catch(() => {});
await W(1500);
check(await A.p.locator('.res').count() === 1, 'hasil catur di alun-alun');
await shot(A, '19-hasil-alun-hp');
for (const pl of [A, B]) { const t = pl.p.locator('.res .btn:has-text("Tutup")'); if (await t.count()) await t.click(); }
await W(3000);
const after = await C.p.evaluate(() => [...document.querySelectorAll('svg.room .opet')].filter((e) => /scale\(0\.6\)/.test(e.getAttribute('transform') ?? '')).length);
check(after === 0, 'selesai: pemain berdiri lagi dari bale-bale');

console.log(errors.length ? 'ERROR:\n' + errors.join('\n') : 'tanpa error halaman/server');
await b.close();
if (fails.length || errors.length) process.exit(1);
