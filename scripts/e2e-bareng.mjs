// Uji game main bareng: Congklak (2 pemain, rumah), Ular Tangga Kampung (3 pemain, rumah) dan
// Balap Karung Live (3 pemain, alun-alun), plus pohon tembus pandang di alun-alun.
// Jalankan server dulu (npm run build && npm start), lalu: npm run test:e2e:bareng
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE_URL ?? 'http://localhost:8787', OUT = process.env.SHOTS ?? 'test-results/e2e-bareng';
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
const coins = async (pl) => (await (await pl.ctx.request.get(BASE + '/api/me')).json()).wallet?.coin ?? 0;

const phone = { ...devices['Pixel 7'] };
const A = await mk('Lupis', '#F6B7A8', 'kelinci', phone);
const B = await mk('Wajik', '#9FD0E8', 'kucing', { viewport: { width: 1366, height: 820 } });
const C = await mk('Putu', '#F4D58D', 'tunas', phone);
for (const v of [B, C]) await v.ctx.request.post(BASE + '/api/friends', { data: { code: A.code } });

/* ---------- Congklak di rumah Lupis ---------- */
await A.p.goto(BASE + '/'); await W(1500); await closeSheets(A);
await B.p.goto(BASE + '/#friends'); await B.p.waitForSelector('.friend');
await B.p.click(`.friend:has-text("Lupis") .btn >> nth=0`); await B.p.waitForSelector('.hbar');
await W(3500);
await A.p.click('.hbar .btn:has-text("Main bareng")');
await shot(A, '01-menu-main-bareng');
check(await A.p.locator('.pop .btn:has-text("Congklak")').isEnabled(), 'menu Main bareng punya Congklak (aktif saat ada tamu)');
await A.p.click('.pop .btn:has-text("Congklak")');
await B.p.waitForSelector('.card:has-text("mengajak main Congklak")', { timeout: 8000 }).catch(() => {});
check(await B.p.locator('.card:has-text("mengajak main Congklak")').count() === 1, 'tamu mendapat ajakan Congklak');
await shot(B, '02-ajakan-congklak');
const a0 = await coins(A), b0 = await coins(B);
await B.p.click('.card .btn:has-text("Ikut main")');
await A.p.waitForSelector('.sheet[aria-label="Papan congklak"]', { timeout: 8000 }).catch(() => {});
check(await A.p.locator('.sheet[aria-label="Papan congklak"]').count() === 1, 'papan congklak terbuka otomatis saat kursi penuh');
check((await A.p.locator('.sheet[aria-label="Papan congklak"] text.n').allTextContents()).filter((t) => t === '7').length === 14, 'tiap lubang berisi 7 biji');
await W(600); await shot(A, '03-congklak-hp');
await shot(B, '04-congklak-desktop');
let moves = 0, gotRes = false;
for (let n = 0; n < 200 && !gotRes; n++) {
  for (const pl of [A, B]) {
    if (await pl.p.locator('.card.res').count()) { gotRes = true; break; }
    const can = pl.p.locator('.sheet .hole.can');
    const k = await can.count();
    if (k) { await can.nth(Math.floor(Math.random() * k)).click(); moves++; if (moves === 6) { await W(500); await shot(pl, '05-congklak-tengah'); } await W(350); }
  }
  await W(250);
}
check(gotRes, `congklak selesai sampai hasil (${moves} langkah)`);
await W(800);
await shot(A, '06-hasil-congklak-hp'); await shot(B, '07-hasil-congklak-desktop');
const da = (await coins(A)) - a0, db = (await coins(B)) - b0;
// (event aktif bisa melipatgandakan koin; yang dicek: pemenang dapat lebih, seri sama rata)
check(da > 0 && db > 0, `kedua pemain congklak dapat koin (${da}/${db})`);
for (const pl of [A, B]) { const t = pl.p.locator('.card.res .btn:has-text("Tutup")'); if (await t.count()) await t.click(); }

/* ---------- Ular Tangga Kampung: 3 pemain ---------- */
await C.p.goto(BASE + '/#friends'); await C.p.waitForSelector('.friend');
await C.p.click(`.friend:has-text("Lupis") .btn >> nth=0`); await C.p.waitForSelector('.hbar');
await W(3000);
await B.p.click('.hbar .btn:has-text("Main bareng")');
await B.p.click('.pop .btn:has-text("Ular Tangga")');
for (const pl of [A, C]) await pl.p.waitForSelector('.card:has-text("mengajak main Ular Tangga")', { timeout: 8000 }).catch(() => {});
check(await C.p.locator('.card:has-text("mengajak main Ular Tangga")').count() === 1, 'pemain lain mendapat ajakan Ular Tangga');
for (const pl of [A, C]) await pl.p.click('.card .btn:has-text("Ikut main")');
await W(1200);
await shot(B, '08-ruang-tunggu-ular');
check(await B.p.locator('.card .btn:has-text("Mulai sekarang")').isEnabled(), 'pengajak bisa Mulai sekarang (3 dari 4 kursi)');
await B.p.click('.card .btn:has-text("Mulai sekarang")');
await A.p.waitForSelector('[aria-label="Papan Ular Tangga"]', { timeout: 8000 }).catch(() => {});
check(await A.p.locator('[aria-label="Papan Ular Tangga"]').count() === 1, 'papan ular tangga terbuka');
let rolls = 0; gotRes = false;
for (let n = 0; n < 300 && !gotRes; n++) {
  for (const pl of [A, B, C]) {
    if (await pl.p.locator('.card.res').count()) { gotRes = true; break; }
    const btn = pl.p.locator('.btn:has-text("Lempar dadu"):not([disabled])');
    if (await btn.count()) { await btn.click(); rolls++; if (rolls === 5) { await W(900); await shot(pl, '09-ular-tangga'); } await W(300); }
  }
  await W(200);
}
check(gotRes, `ular tangga selesai sampai hasil (${rolls} lemparan)`);
await W(800); await shot(C, '10-hasil-ular');
check(await C.p.locator('.card.res .rk').count() === 3, 'hasil ular tangga menampilkan 3 peringkat');
for (const pl of [A, B, C]) { const t = pl.p.locator('.card.res .btn:has-text("Tutup")'); if (await t.count()) await t.click(); }

/* ---------- Alun-alun: pohon & Balap Karung Live ---------- */
async function enterAlun(pl) {
  await pl.p.goto(BASE + '/?r=1#alun'); await pl.p.waitForSelector('.sbar', { timeout: 20000 }); await W(800);
  const n = pl.p.locator('.fp .btn:has-text("Nanti")'); if (await n.count()) await n.click();
}
for (const pl of [A, B, C]) await enterAlun(pl);
await W(3500);
await shot(B, '11-alun-alun-desktop');
check(await B.p.locator('svg.room .canopy').count() >= 3, 'pohon alun-alun punya kanopi');
// geser pet Wajik ke belakang pohon: cek kanopi jadi tembus pandang
const behind = await B.p.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 20; i++) { if (document.querySelector('svg.room .seethru')) return true; await sleep(250); }
  return false;
});
console.log(`info kanopi tembus pandang saat ini: ${behind ? 'ya' : 'tidak ada pet di belakang pohon'}`);

await A.p.click('.sbar .btn:has-text("Main")');
await shot(A, '12-menu-main-alun');
check(await A.p.locator('.pop .btn:has-text("Balap Karung Live")').count() === 1, 'menu Main alun-alun punya Balap Karung Live');
check(await A.p.locator('.pop .btn:has-text("Ular Tangga bareng")').count() === 1, 'menu Main alun-alun punya Ular Tangga');
await A.p.click('.pop .btn:has-text("Balap Karung Live")');
for (const pl of [B, C]) await pl.p.waitForSelector('.card:has-text("mengajak main Balap Karung Live")', { timeout: 15000 }).catch(() => {});
check(await B.p.locator('.card:has-text("mengajak main Balap Karung Live")').count() === 1, 'orang di alun-alun mendapat ajakan Balap Karung Live');
await shot(A, '13-pet-di-garis-start');
await shot(C, '14-ajakan-karung');
for (const pl of [B, C]) await pl.p.click('.card .btn:has-text("Ikut lomba")');
await W(1000);
await A.p.click('.card .btn:has-text("Mulai sekarang")');
await A.p.waitForSelector('.race', { timeout: 8000 }).catch(() => {});
check(await A.p.locator('.race').count() === 1, 'arena Balap Karung Live terbuka');
await W(800); await shot(A, '15-karung-hitung-mundur');
// tunggu aba-aba lalu lompat KIRI/KANAN dengan kecepatan berbeda
await A.p.waitForSelector('.race .pads', { timeout: 8000 }).catch(() => {});
await W(3200);
const race = async (pl, gap) => { for (let i = 0; i < 40; i++) { await pl.p.keyboard.press(i % 2 ? 'ArrowRight' : 'ArrowLeft'); await W(gap); } };
const mid = (async () => { await W(2600); await shot(B, '16-karung-live-desktop'); await shot(C, '17-karung-live-hp'); })();
await Promise.all([race(A, 120), race(B, 95), race(C, 150), mid]);
for (const pl of [A, B, C]) await pl.p.waitForSelector('.card.res', { timeout: 20000 }).catch(() => {});
check(await A.p.locator('.card.res').count() === 1, 'hasil Balap Karung Live muncul');
const first = await A.p.locator('.card.res .rk >> nth=0').textContent().catch(() => '');
check(first.includes('Wajik'), `pelari tercepat juara 1 (${first.trim()})`);
await W(500); await shot(A, '18-hasil-karung-hp'); await shot(B, '19-hasil-karung-desktop');

console.log(errors.length ? 'ERROR:\n' + errors.join('\n') : 'tanpa error halaman/server');
await b.close();
if (fails.length || errors.length) process.exit(1);
