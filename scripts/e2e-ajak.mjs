// Uji "Pet ngajak ke Alun-alun": teman ada di alun-alun → di rumah sendiri pet mengajak lewat gelembung (HP 390, HP 320,
// desktop 1366) tanpa menimpa HUD / tombol / kartu; gelembung biasa tidak dobel; Nanti menutup & dicatat; Nanti 2× = diam
// hari itu; Ayo! → pet jalan ke alun-alun (alun-alun tempat teman); tidak mengajak saat sibuk (nampan makan, lembar terbuka)
// & 10 menit setelah pulang dari alun-alun; fitur dimatikan admin → tidak muncul; tidak ada galat halaman / 5xx.
// Jalankan server dulu (npm run build && npm start), lalu: BASE_URL=http://localhost:8787 node scripts/e2e-ajak.mjs
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = (process.env.BASE_URL ?? 'http://localhost:8787').replace(/\/$/, ''), OUT = process.env.SHOTS ?? 'test-results/e2e-ajak';
const ADMIN = { email: process.env.ADMIN_EMAIL ?? 'owner@bupi.test', password: process.env.ADMIN_PASSWORD ?? 'rahasia-sekali-123' };
mkdirSync(OUT, { recursive: true });
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [], errors = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'GAGAL'} ${msg}`); if (!ok) fails.push(msg); };
const b = await chromium.launch();

const adm = await b.newContext();
check((await adm.request.post(BASE + '/api/admin/login', { data: ADMIN })).ok(), 'admin masuk');
const before = (await (await adm.request.get(BASE + '/api/admin/settings')).json()).value;
const setAjak = async (patch, feat = true) => {
  const r = await adm.request.put(BASE + '/api/admin/settings', { data: { value: { ...before, ajakAlun: { ...before.ajakAlun, ...patch }, features: { ...before.features, ajakAlun: feat } } } });
  if (!r.ok()) throw new Error('pengaturan: ' + (await r.text()));
};
await setAjak({ firstSec: 5, gapMin: 15, perDay: 4 });

async function mk(name, vp, mobile) {
  const ctx = await b.newContext({ viewport: { width: vp[0], height: vp[1] }, hasTouch: mobile, isMobile: mobile });
  await ctx.addInitScript(() => { try { localStorage.setItem('kb-save-snooze', String(Date.now() + 9e9)); localStorage.setItem('kb-push-asked', String(Date.now() + 9e9)); } catch {} });
  await ctx.request.post(BASE + '/api/auth/guest', { data: {} });
  const st = await (await ctx.request.post(BASE + '/api/pet', { data: { name, color: '#F6B7A8', ear: 'kucing' } })).json();
  await ctx.request.post(BASE + '/api/daily', { data: {} });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  p.on('response', (r) => { if (r.status() >= 500) errors.push(`${name}: ${r.status()} ${r.url()}`); });
  return { ctx, p, code: st.state.user.friend_code, name };
}
const closeSheets = async (p) => { for (let i = 0; i < 3; i++) { const x = p.locator('.sheet .x'); if (await x.count()) { await x.first().click().catch(() => {}); await W(300); } } };
const home = async (pl) => { await pl.p.goto(`${BASE}/?r=${Math.random().toString(36).slice(2)}`); await pl.p.waitForSelector('.dock', { timeout: 20000 }); await W(1200); await closeSheets(pl.p); };
const memo = (p) => p.evaluate(() => { try { return JSON.parse(localStorage.getItem('kb-ajak') ?? '{}'); } catch { return {}; } });
const setMemo = (p, m) => p.evaluate((m) => localStorage.setItem('kb-ajak', JSON.stringify(m)), m);
const waitAjak = async (p, ms = 25000) => { try { await p.waitForSelector('.ajak.ready', { timeout: ms }); return true; } catch { return false; } };
/** gelembung tidak menimpa HUD / tombol / kartu & tetap di layar */
async function layout(p, tag) {
  const r = await p.evaluate(() => {
    const a = document.querySelector('.ajak').getBoundingClientRect();
    const hit = (s) => [...document.querySelectorAll(s)].map((e) => [s, e.getBoundingClientRect()]).filter(([, r]) => r.width && r.height && r.left < a.right && r.right > a.left && r.top < a.bottom && r.bottom > a.top).map(([s]) => s);
    const over = ['.hud', '.roombar', '.needs', '.event', '.jbtn', '.acts', '.dock', 'button.chip'].flatMap(hit);
    const btns = [...document.querySelectorAll('.ajak button')].map((e) => e.getBoundingClientRect().height);
    const speech = [...document.querySelectorAll('.bubble')].filter((e) => !e.classList.contains('hb') && e.checkVisibility()).length;
    const pet = document.querySelector('.room .pet').getBoundingClientRect();
    return { a: { l: a.left, r: a.right, t: a.top, b: a.bottom }, over, btns, speech, down: document.querySelector('.ajak').classList.contains('down'), petTop: pet.top, petBottom: pet.bottom, w: innerWidth, h: innerHeight, text: document.querySelector('.ajak p').innerText };
  });
  check(r.a.l >= 0 && r.a.r <= r.w && r.a.t >= 0 && r.a.b <= r.h, `${tag}: gelembung di dalam layar`);
  check(!r.over.length, `${tag}: tidak menimpa HUD / tombol / kartu${r.over.length ? ` (${r.over.join(', ')})` : ''}`);
  check(r.btns.length === 2 && r.btns.every((h) => h >= 34), `${tag}: tombol Ayo! & Nanti ≥ 34 px`);
  check(r.speech === 0, `${tag}: celetukan biasa tidak tampil bersamaan`);
  check(r.down ? r.a.t >= r.petTop : r.a.b <= r.petTop + 4, `${tag}: menempel ke pet (${r.down ? 'di bawah' : 'di atas'})`);
  return r;
}

// teman (Wajik) di alun-alun, tetap live selama uji
const wajik = await mk('Wajik', [390, 844], true);
await wajik.p.goto(BASE + '/?r=1#alun'); await wajik.p.waitForSelector('.sbar, .fp', { timeout: 20000 });
check(true, 'Wajik masuk alun-alun');

/* ---------------- HP 390 ---------------- */
const lupis = await mk('Lupis', [390, 844], true);
check((await lupis.ctx.request.post(BASE + '/api/friends', { data: { code: wajik.code } })).ok(), 'Lupis berteman dengan Wajik');
const sq = await (await lupis.ctx.request.get(BASE + '/api/square')).json();
check(sq.friends?.some((f) => f.name === 'Wajik' && f.alun >= 1), 'GET /api/square menyebut Wajik di alun-alun');
await home(lupis);
check(!(await lupis.p.locator('.ajak').count()), 'belum langsung mengajak saat baru masuk rumah');
check(await waitAjak(lupis.p), 'pet mengajak ke alun-alun (≤ 25 detik dengan jeda pertama 5 detik)');
const t1 = await lupis.p.locator('.ajak').innerText();
check(/Wajik/.test(t1), `ajakan menyebut Wajik ("${t1.replace(/\s+/g, ' ')}")`);
await layout(lupis.p, 'HP 390');
await lupis.p.screenshot({ path: `${OUT}/ajak-390.png` });
let m = await memo(lupis.p);
check(m.n === 1 && m.last > 0, 'tampil dicatat (1 kali hari ini)');
await lupis.p.click('.ajak .no'); await W(400);
check(!(await lupis.p.locator('.ajak').count()), 'Nanti menutup gelembung');
m = await memo(lupis.p);
check(m.nanti === 1 && !m.mute, 'Nanti dicatat (belum diam)');
// jeda 15 menit: tidak muncul lagi
await W(9000);
check(!(await lupis.p.locator('.ajak').count()), 'tidak muncul lagi sebelum jeda 15 menit');
// sibuk: nampan makanan terbuka → tidak mengajak
await setMemo(lupis.p, { ...m, last: Date.now() - 20 * 60_000 });
await lupis.p.click('.btn.act:has-text("Makan")'); await W(9000);
check(!(await lupis.p.locator('.ajak').count()), 'tidak mengajak saat nampan makanan terbuka');
// pindah dari nampan ke lembar Tas tanpa celah: jeda ajakan ditutup dulu selama berpindah
await setMemo(lupis.p, { ...(await memo(lupis.p)), last: Date.now() });
await lupis.p.click('.tray .btn:has-text("Tutup")'); await W(300);
// lembar terbuka → tidak mengajak
await lupis.p.click('.dock button:has-text("Tas")').catch(() => {}); await W(500);
await setMemo(lupis.p, { ...(await memo(lupis.p)), last: Date.now() - 20 * 60_000 });
await W(8000);
check(!(await lupis.p.locator('.ajak').count()), 'tidak mengajak saat lembar Tas terbuka');
await closeSheets(lupis.p);
// muncul lagi → Ayo! → jalan ke alun-alun
{ const ok = await waitAjak(lupis.p);
  if (!ok) { await lupis.p.screenshot({ path: `${OUT}/gagal-ajak-lagi.png` }); console.log('   keadaan:', JSON.stringify(await lupis.p.evaluate(() => ({ sheet: !!document.querySelector('.sheet'), tray: !!document.querySelector('.tray'), walking: !!document.querySelector('svg.room.walking'), memo: localStorage.getItem('kb-ajak'), hash: location.hash })))); }
  check(ok, 'mengajak lagi setelah jeda & tidak sibuk'); }
await lupis.p.click('.ajak .go');
let inAlun = false;
for (let i = 0; i < 60 && !inAlun; i++) { await W(500); inAlun = (await lupis.p.locator('.sbar, .fp').count()) > 0; }
check(inAlun, 'Ayo! → pet jalan ke alun-alun');
m = await memo(lupis.p);
check(m.nanti === 0, 'Ayo! mereset hitungan Nanti');
await W(1500);
await lupis.p.screenshot({ path: `${OUT}/ayo-alun-390.png` });
// pulang lewat tombol Pulang: 10 menit tidak diajak ke alun-alun lagi
if (await lupis.p.locator('.fp .btn:has-text("Nanti")').count()) { await lupis.p.click('.fp .btn:has-text("Nanti")'); await W(500); }
await lupis.p.click('.sbar .btn:has-text("Pulang")'); await W(1200);
check(await lupis.p.locator('svg.map').count() === 1, 'Pulang → peta kampung');
await lupis.p.click('.dock button:has-text("Rumah")');
let atHome = false;
for (let i = 0; i < 40 && !atHome; i++) { await W(500); atHome = (await lupis.p.locator('.btn.act:has-text("Makan")').count()) > 0; }
check(atHome, 'Rumah → kembali ke rumah');
await W(800); await closeSheets(lupis.p);
m = await memo(lupis.p);
check(m.alunAt > Date.now() - 60_000, 'pulang dari alun-alun dicatat');
await setMemo(lupis.p, { ...m, last: Date.now() - 20 * 60_000 });
await W(10000);
check(!(await lupis.p.locator('.ajak').count()), 'tidak mengajak < 10 menit setelah pulang dari alun-alun');
// Nanti 2× berturut-turut → diam hari itu
await setMemo(lupis.p, { ...(await memo(lupis.p)), last: Date.now() - 20 * 60_000, alunAt: 0, nanti: 1 });
check(await waitAjak(lupis.p), 'mengajak lagi (tes Nanti kedua)');
await lupis.p.click('.ajak .no'); await W(300);
m = await memo(lupis.p);
check(m.mute === true, 'Nanti 2× berturut-turut → diam hari itu');
await setMemo(lupis.p, { ...m, last: Date.now() - 20 * 60_000 });
await W(9000);
check(!(await lupis.p.locator('.ajak').count()), 'tidak mengajak lagi hari itu');

/* ---------------- HP 320: gelembung di bawah pet bila di atas tidak muat ---------------- */
const putu = await mk('Putu', [320, 640], true);
await putu.ctx.request.post(BASE + '/api/friends', { data: { code: wajik.code } });
await home(putu);
check(await waitAjak(putu.p), 'HP 320: pet mengajak');
await W(400);
const r320 = await layout(putu.p, 'HP 320');
check(r320.down ? !(await putu.p.locator('button.chip[aria-label="Buka daftar tugas"]').count()) : true, 'HP 320: gelembung di bawah pet → kartu tugas disembunyikan sementara');
await putu.p.screenshot({ path: `${OUT}/ajak-320.png` });
// hilang sendiri setelah 12 detik (tidak dihitung Nanti)
await W(13000);
check(!(await putu.p.locator('.ajak').count()), 'HP 320: hilang sendiri setelah 12 detik');
const mp = await memo(putu.p);
check(!mp.nanti, 'hilang sendiri tidak dihitung Nanti');
check(await putu.p.locator('button.chip[aria-label="Buka daftar tugas"]').count() > 0, 'kartu tugas tampil lagi');

/* ---------------- desktop 1366 ---------------- */
const klepon = await mk('Klepon', [1366, 768], false);
await klepon.ctx.request.post(BASE + '/api/friends', { data: { code: wajik.code } });
await home(klepon);
check(await waitAjak(klepon.p), 'desktop: pet mengajak');
await W(400);
const rd = await layout(klepon.p, 'desktop 1366');
check(!rd.down, 'desktop: gelembung di atas kepala pet');
await klepon.p.screenshot({ path: `${OUT}/ajak-1366.png` });
await klepon.p.click('.ajak .no');

/* ---------------- fitur dimatikan admin ---------------- */
await setAjak({ firstSec: 5 }, false);
const kue = await mk('Kue', [390, 844], true);
await kue.ctx.request.post(BASE + '/api/friends', { data: { code: wajik.code } });
await home(kue);
await W(12000);
check(!(await kue.p.locator('.ajak').count()), 'fitur dimatikan: pet tidak mengajak');

// kembalikan pengaturan
const rr = await adm.request.put(BASE + '/api/admin/settings', { data: { value: before } });
check(rr.ok(), 'pengaturan dikembalikan');
check(!errors.length, `tanpa galat halaman / 5xx${errors.length ? `: ${errors.join(' | ')}` : ''}`);
await b.close();
console.log(fails.length ? `\n${fails.length} GAGAL` : '\nSemua lulus');
process.exit(fails.length ? 1 : 0);
