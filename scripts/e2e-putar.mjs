// Uji "Putar perabot": mode Atur → pilih sofa → tombol Putar (HP 390 & 320, desktop 1366 + tombol R) → Selesai →
// arah tersimpan (r: 1) & tetap setelah muat ulang; tidak muat → pesan & tidak berubah; tombol bar Atur tidak bertumpuk;
// teman berkunjung melihat sofa yang diputar; tidak ada galat halaman / 5xx.
// Jalankan server dulu (npm run build && npm start), lalu: BASE_URL=http://localhost:8787 node scripts/e2e-putar.mjs
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = (process.env.BASE_URL ?? 'http://localhost:8787').replace(/\/$/, ''), OUT = process.env.SHOTS ?? 'test-results/e2e-putar';
const ADMIN = { email: process.env.ADMIN_EMAIL ?? 'owner@bupi.test', password: process.env.ADMIN_PASSWORD ?? 'rahasia-sekali-123' };
mkdirSync(OUT, { recursive: true });
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [], errors = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'GAGAL'} ${msg}`); if (!ok) fails.push(msg); };
const b = await chromium.launch();
const adm = await b.newContext();
check((await adm.request.post(BASE + '/api/admin/login', { data: ADMIN })).ok(), 'admin masuk');

/** pemain baru + sofa (dan kursi) di kamarnya; layout = susunan kamar yang disimpan lewat API */
async function mk(name, vp, layout, grant = { 'sofa-santai': 1 }) {
  const mobile = vp[0] < 900;
  const ctx = await b.newContext({ viewport: { width: vp[0], height: vp[1] }, hasTouch: mobile, isMobile: mobile });
  await ctx.addInitScript(() => { try { localStorage.setItem('kb-save-snooze', String(Date.now() + 9e9)); localStorage.setItem('kb-push-asked', String(Date.now() + 9e9)); localStorage.setItem('kb-ajak', JSON.stringify({ day: new Date().toLocaleDateString('en-CA'), n: 9, last: Date.now(), nanti: 0, mute: true, alunAt: 0 })); } catch {} });
  await ctx.request.post(BASE + '/api/auth/guest', { data: {} });
  await ctx.request.post(BASE + '/api/pet', { data: { name, color: '#F6B7A8', ear: 'kucing' } });
  await ctx.request.post(BASE + '/api/daily', { data: {} });
  const me = await (await ctx.request.get(BASE + '/api/me')).json();
  for (const [id, qty] of Object.entries(grant)) await adm.request.post(`${BASE}/api/admin/players/${me.user.id}/items`, { data: { itemId: id, qty } });
  const room = (me.rooms ?? [me.room])[0];
  const r = await ctx.request.post(BASE + '/api/room', { data: { version: room.version, roomId: room.id || undefined, layout } });
  if (!r.ok()) throw new Error('susun kamar: ' + (await r.text()));
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  p.on('response', (res) => { if (res.status() >= 500) errors.push(`${name}: ${res.status()} ${res.url()}`); });
  return { ctx, p, me, room, name };
}
const closeSheets = async (p) => { for (let i = 0; i < 3; i++) { const x = p.locator('.sheet .x'); if (await x.count()) { await x.first().click().catch(() => {}); await W(300); } } };
const home = async (pl) => { await pl.p.goto(`${BASE}/?r=${Math.random().toString(36).slice(2)}`); await pl.p.waitForSelector('.dock', { timeout: 20000 }); await W(1200); await closeSheets(pl.p); };
const sofaLay = async (pl) => { const me = await (await pl.ctx.request.get(BASE + '/api/me')).json(); return (me.rooms ?? [me.room])[0].layout.find((q) => q.i === 'sofa-santai'); };
const rotated = (p, idx) => p.evaluate((i) => !!document.querySelector(`svg.room [data-i="${i}"] .rot`), idx);
/** arah yang tergambar: 0 awal, 1 dicerminkan, 2 tampak belakang, 3 belakang dicerminkan */
const dirOf = (p, idx) => p.evaluate((i) => { const g = document.querySelector(`svg.room [data-i="${i}"]`); return g ? (g.querySelector('.back') ? 2 : 0) + (g.querySelector('.rot') ? 1 : 0) : -1; }, idx);
/** bar Atur: tombol tidak bertumpuk, di dalam layar, ≥ 40 px */
async function barOk(p, tag) {
  const r = await p.evaluate(() => {
    const bs = [...document.querySelectorAll('.editbar .row .btn')].map((e) => e.getBoundingClientRect());
    let overlap = false;
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i], c = bs[j]; if (a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1) overlap = true; }
    return { overlap, inside: bs.every((x) => x.left >= 0 && x.right <= innerWidth && x.bottom <= innerHeight), tall: bs.every((x) => x.height >= 34), n: bs.length };
  });
  check(!r.overlap && r.inside && r.tall, `${tag}: tombol bar Atur (${r.n}) tidak bertumpuk, di dalam layar, cukup tinggi`);
}

/* ---------------- HP 390: putar, simpan, muat ulang ---------------- */
// kasur awal di (4,0); sofa 2×1 di (2,0) menempel dinding kanan
const L1 = [{ i: 'kasur-rotan', x: 4, y: 0 }, { i: 'karpet-kawung', x: 2, y: 2 }, { i: 'sofa-santai', x: 2, y: 0 }];
const A = await mk('Lupis', [390, 844], L1);
await home(A);
await A.p.click('.btn.act:has-text("Atur")'); await W(700);
check(!(await A.p.locator('.editbar .rotbtn').count()), 'belum ada tombol Putar sebelum memilih perabot');
await A.p.locator('svg.room [data-i="2"]').first().click({ force: true }); await W(500);
check(await A.p.locator('.editbar .rotbtn').count() === 1, 'pilih sofa → tombol Putar muncul');
check(/Putar untuk mengubah arah/.test(await A.p.locator('.editbar p').innerText()), 'teks bantuan menyebut Putar');
await barOk(A.p, 'HP 390');
await A.p.screenshot({ path: `${OUT}/atur-pilih-390.png` });
check(!(await rotated(A.p, 2)), 'sofa belum diputar');
await A.p.click('.editbar .rotbtn'); await W(500);
check(await rotated(A.p, 2), 'Putar → sofa digambar diputar (dicerminkan)');
await A.p.screenshot({ path: `${OUT}/atur-diputar-390.png` });
await A.p.click('.editbar .btn:has-text("Selesai")'); await W(1200);
check(!(await A.p.locator('.editbar').count()), 'Selesai menutup mode Atur');
const s1 = await sofaLay(A);
check(s1?.r === 1, `arah tersimpan di server (${JSON.stringify(s1)})`);
await home(A);
check(await rotated(A.p, 2), 'setelah muat ulang sofa tetap diputar');
await A.p.screenshot({ path: `${OUT}/rumah-diputar-390.png` });
// 4 arah: putar lagi → membelakangi kamera (2), lalu (3), lalu kembali ke awal (0)
await A.p.click('.btn.act:has-text("Atur")'); await W(700);
await A.p.locator('svg.room [data-i="2"]').first().click({ force: true }); await W(400);
await A.p.click('.editbar .rotbtn'); await W(300);
check(await dirOf(A.p, 2) === 2, 'Putar ke-2 → sofa membelakangi kamera (tampak belakang)');
await A.p.screenshot({ path: `${OUT}/atur-belakang-390.png` });
await A.p.click('.editbar .btn:has-text("Selesai")'); await W(1200);
const s1b = await sofaLay(A);
check(s1b?.r === 2, `arah membelakangi kamera tersimpan (${JSON.stringify(s1b)})`);
await home(A);
check(await dirOf(A.p, 2) === 2, 'setelah muat ulang sofa tetap membelakangi kamera');
await A.p.click('.btn.act:has-text("Atur")'); await W(700);
await A.p.locator('svg.room [data-i="2"]').first().click({ force: true }); await W(400);
await A.p.click('.editbar .rotbtn'); await W(300);
check(await dirOf(A.p, 2) === 3, 'Putar ke-3 → belakang dicerminkan');
await A.p.click('.editbar .rotbtn'); await W(300);
check(await dirOf(A.p, 2) === 0, 'Putar ke-4 → kembali ke arah awal');
await A.p.click('.editbar .btn:has-text("Batal")'); await W(500);
check(await dirOf(A.p, 2) === 2, 'Batal → kembali seperti yang tersimpan (membelakangi kamera)');

/* ---------------- teman berkunjung melihat arah yang sama ---------------- */
const F = await mk('Wajik', [390, 844], [{ i: 'kasur-rotan', x: 4, y: 0 }, { i: 'karpet-kawung', x: 2, y: 2 }], {});
await F.ctx.request.post(BASE + '/api/friends', { data: { code: A.me.user.friend_code } });
await F.p.goto(`${BASE}/?r=f#friends`); await F.p.waitForSelector('.friend', { timeout: 20000 }); await W(600);
await F.p.locator('.friend .btn:has-text("Kunjungi"), .friend .btn:has-text("Main bareng")').first().click();
let visiting = false;
for (let i = 0; i < 40 && !visiting; i++) { await W(500); visiting = (await F.p.locator('svg.room').count()) > 0 && (await F.p.evaluate(() => !!document.querySelector('.visit, .hbar'))); }
await W(1500);
check(visiting && (await F.p.evaluate(() => !!document.querySelector('svg.room .back'))), 'teman berkunjung melihat sofa yang membelakangi kamera');
await F.p.screenshot({ path: `${OUT}/kunjungan-diputar-390.png` });

/* ---------------- tidak muat: pesan & tidak berubah (HP 320) ---------------- */
// sofa di baris terakhir (0,5), kursi di (0,4) & (1,4): diputar butuh 2 baris → tidak ada tempat dalam 1 petak
const L2 = [{ i: 'kasur-rotan', x: 4, y: 0 }, { i: 'sofa-santai', x: 0, y: 5 }, { i: 'kursi-kayu', x: 0, y: 4 }, { i: 'kursi-kayu', x: 1, y: 4 }];
const B = await mk('Putu', [320, 640], L2, { 'sofa-santai': 1, 'kursi-kayu': 2 });
await home(B);
await B.p.click('.btn.act:has-text("Atur")'); await W(700);
await B.p.locator('svg.room [data-i="1"]').first().click({ force: true }); await W(400);
await barOk(B.p, 'HP 320');
await B.p.screenshot({ path: `${OUT}/atur-pilih-320.png` });
await B.p.click('.editbar .rotbtn'); await W(400);
const toast = await B.p.locator('.toast').innerText().catch(() => '');
check(/Tidak muat kalau diputar di sini/.test(toast), `tidak muat → pesan ("${toast}")`);
check(!(await rotated(B.p, 1)), 'tidak muat → sofa tidak berubah');
await B.p.screenshot({ path: `${OUT}/tidak-muat-320.png` });
// kursi dipindah → sekarang muat (geser 1 petak ke atas)
await B.p.locator('svg.room [data-i="2"]').first().click({ force: true }); await W(300);
await B.p.click('.editbar .btn:has-text("Simpan ke Tas")'); await W(300);
await B.p.locator('svg.room [data-i="1"]').first().click({ force: true }); await W(300);
await B.p.click('.editbar .rotbtn'); await W(400);
check(await rotated(B.p, 1), 'setelah kursi disimpan ke Tas: sofa bisa diputar (bergeser 1 petak)');
await B.p.click('.editbar .btn:has-text("Selesai")'); await W(1200);
const s2 = await sofaLay(B);
check(s2?.r === 1 && s2.x === 0 && s2.y === 4, `tersimpan di (0,4) diputar (${JSON.stringify(s2)})`);

/* ---------------- desktop 1366: tombol R ---------------- */
const C = await mk('Klepon', [1366, 768], L1);
await home(C);
await C.p.click('.btn.act:has-text("Atur")'); await W(700);
await C.p.locator('svg.room [data-i="2"]').first().click({ force: true }); await W(400);
check(/Putar \(R\)/.test(await C.p.locator('.editbar p').innerText()), 'desktop: teks bantuan menyebut tombol R');
await barOk(C.p, 'desktop 1366');
await C.p.keyboard.press('r'); await W(400);
check(await rotated(C.p, 2), 'desktop: tombol R memutar sofa');
await C.p.screenshot({ path: `${OUT}/atur-diputar-1366.png` });
for (let k = 0; k < 3; k++) { await C.p.keyboard.press('R'); await W(250); }
check(await dirOf(C.p, 2) === 0, 'desktop: R 4× → arah awal');
await C.p.click('.editbar .btn:has-text("Batal")'); await W(300);
// di luar mode Atur, R tidak melakukan apa-apa
await C.p.keyboard.press('r'); await W(300);
check(!(await C.p.locator('.editbar').count()), 'R di luar mode Atur tidak membuka apa pun');

check(!errors.length, `tanpa galat halaman / 5xx${errors.length ? `: ${errors.join(' | ')}` : ''}`);
await b.close();
console.log(fails.length ? `\n${fails.length} GAGAL` : '\nSemua lulus');
process.exit(fails.length ? 1 : 0);
