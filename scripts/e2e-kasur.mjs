// Uji semua kasur bisa dipakai tidur sungguhan: Kasur Rotan, Dipan Kayu, dan Kasur Roket menawarkan "Tidur sampai segar"
// (lampu mati, energi terisi sampai segar) selain rebahan sebentar; pet tidur di kasur yang diketuk (bukan kasur lain),
// tombol Tidur tanpa Kasur Rotan membawa pet ke kasur lain (bukan lantai), dan rebahan menampilkan energi yang bertambah.
// Jalankan server dulu dengan admin (ADMIN_EMAIL & ADMIN_PASSWORD), lalu: BASE_URL=http://localhost:8787 npm run test:e2e:kasur
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, request } = require('playwright');
const BASE = (process.env.BASE_URL ?? 'http://localhost:8787').replace(/\/$/, ''), OUT = process.env.SHOTS ?? 'test-results/e2e-kasur';
const ADMIN = { email: process.env.ADMIN_EMAIL ?? 'owner@bupi.test', password: process.env.ADMIN_PASSWORD ?? 'rahasia-sekali-123' };
mkdirSync(OUT, { recursive: true });
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [], errors = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'GAGAL'} ${msg}`); if (!ok) fails.push(msg); };

const adm = await request.newContext({ baseURL: BASE });
check((await adm.post('/api/admin/login', { data: ADMIN })).ok(), 'admin masuk');

const b = await chromium.launch();
async function mk(name, vp) {
  const mobile = vp[0] < 900;
  const ctx = await b.newContext({ viewport: { width: vp[0], height: vp[1] }, hasTouch: mobile, isMobile: mobile });
  await ctx.addInitScript(() => { try { localStorage.setItem('kb-save-snooze', String(Date.now() + 9e9)); localStorage.setItem('kb-push-asked', String(Date.now() + 9e9)); localStorage.setItem('kb-news-seen', '["*"]'); localStorage.setItem('kb-ajak', JSON.stringify({ day: new Date().toLocaleDateString('en-CA'), n: 9, last: Date.now(), nanti: 0, mute: true, alunAt: 0 })); localStorage.setItem('kb-kerja-ajak', '1'); } catch {} });
  await ctx.request.post(BASE + '/api/auth/guest', { data: {} });
  await ctx.request.post(BASE + '/api/pet', { data: { name, color: '#F6B7A8', ear: 'kucing' } });
  await ctx.request.post(BASE + '/api/daily', { data: {} });
  const me = await (await ctx.request.get(BASE + '/api/me')).json();
  check((await adm.post(`/api/admin/players/${me.user.id}/wallet`, { data: { currency: 'coin', delta: 2000, reason: 'uji kasur' } })).ok(), `${name}: admin memberi koin`);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  p.on('response', (res) => { if (res.url().includes('/api/') && res.status() >= 500) errors.push(`${name}: ${res.status()} ${res.url()}`); });
  return { ctx, p, me, name };
}
const meOf = async (pl) => (await pl.ctx.request.get(BASE + '/api/me')).json();
const closeSheets = async (p) => { for (let i = 0; i < 3; i++) { const x = p.locator('.sheet .x'); if (await x.count()) { await x.first().click().catch(() => {}); await W(300); } } };
const home = async (pl) => { await pl.p.goto(`${BASE}/?r=${Math.random().toString(36).slice(2)}`); await pl.p.waitForSelector('.dock', { timeout: 20000 }); await W(1500); await closeSheets(pl.p); };
const toastText = async (p) => (await p.locator('.toast').allInnerTexts().catch(() => [])).join(' | ');
const waitToast = async (p, re) => { let t = ''; for (let i = 0; i < 40 && !re.test(t); i++) { await W(300); t = await toastText(p); } return t; };
/** simpan denah kamar pertama */
async function setLayout(pl, layout) {
  const me = await meOf(pl); const room = (me.rooms ?? [me.room])[0];
  const r = await pl.ctx.request.post(BASE + '/api/room', { data: { roomId: room.id || undefined, version: room.version, layout } });
  return r.ok();
}
const idxOf = async (pl, id) => { const me = await meOf(pl); return (me.rooms ?? [me.room])[0].layout.findIndex((q) => q.i === id); };
/** pet tidur di atas perabot ke-i: titik tengah pet di dalam kotak perabot */
async function petOn(p, i) {
  return p.evaluate((i) => {
    const pet = document.querySelector('svg.room g.pet.pose-tidur'), f = document.querySelector(`svg.room .furn[data-i="${i}"]`);
    if (!pet || !f) return { ok: false, why: pet ? 'perabot tidak ada' : 'pet tidak dalam pose tidur' };
    const a = pet.getBoundingClientRect(), r = f.getBoundingClientRect();
    const cx = a.x + a.width / 2, cy = a.y + a.height / 2;
    return { ok: cx >= r.left && cx <= r.right && cy >= r.top - 20 && cy <= r.bottom, why: `pet ${Math.round(cx)},${Math.round(cy)} perabot ${Math.round(r.left)}-${Math.round(r.right)},${Math.round(r.top)}-${Math.round(r.bottom)}` };
  }, i);
}
async function tapFurn(pl, i) { await pl.p.locator(`svg.room .furn[data-i="${i}"]`).first().click({ force: true }); await W(700); return pl.p.locator('.roomwrap .menu').innerText().catch(() => ''); }
async function waitOn(pl, i) { let r = { ok: false, why: '' }; for (let k = 0; k < 30 && !r.ok; k++) { await W(400); r = await petOn(pl.p, i); } return r; }
const wake = (pl) => pl.ctx.request.post(BASE + '/api/sleep', { data: { on: false } });

/* ---------------- HP 390: Dipan Kayu & Kasur Rotan di kamar yang sama ---------------- */
const A = await mk('Kapuk', [390, 844]);
check((await A.ctx.request.post(BASE + '/api/shop/buy', { data: { itemId: 'dipan-kayu', currency: 'coin' } })).ok(), 'beli Dipan Kayu');
check(await setLayout(A, [{ i: 'kasur-rotan', x: 4, y: 0 }, { i: 'dipan-kayu', x: 0, y: 4 }]), 'kamar: Kasur Rotan + Dipan Kayu');
await home(A);
let di = await idxOf(A, 'dipan-kayu'), ki = await idxOf(A, 'kasur-rotan');
let menu = await tapFurn(A, di);
check(/Tidur sampai segar/.test(menu) && /Leyeh-leyeh/.test(menu), `ketuk Dipan Kayu → "Tidur sampai segar" + "Leyeh-leyeh" ("${menu.replace(/\s+/g, ' ')}")`);
await A.p.screenshot({ path: `${OUT}/dipan-menu-390.png` });
await A.p.locator('.roomwrap .menu button:has-text("Tidur sampai segar")').click();
let t = await waitToast(A.p, /tidur/);
check(/Lampu dimatikan/.test(t), `tidur dari Dipan Kayu ("${t}")`);
let on = await waitOn(A, di);
check(on.ok, `pet tidur di Dipan Kayu yang diketuk, bukan di Kasur Rotan (${on.why})`);
check(!!(await meOf(A)).pet.sleep || (await A.p.locator('svg.room.asleep').count()) > 0, 'server: pet tidur');
await W(800);
await A.p.screenshot({ path: `${OUT}/dipan-tidur-390.png` });
check((await wake(A)).ok(), 'bangunkan pet');

// Kasur Rotan tetap bisa: pet tidur di kasur rotan bila kasur itu yang diketuk
await home(A);
menu = await tapFurn(A, ki);
check(/Tidur sampai segar/.test(menu), 'ketuk Kasur Rotan → "Tidur sampai segar"');
await A.p.locator('.roomwrap .menu button:has-text("Tidur sampai segar")').click();
on = await waitOn(A, ki);
check(on.ok, `pet tidur di Kasur Rotan yang diketuk (${on.why})`);
check((await wake(A)).ok(), 'bangunkan pet lagi');

// Leyeh-leyeh: energi yang bertambah tampil di pesan
await home(A);
const before = (await meOf(A)).pet.needs?.energi;
menu = await tapFurn(A, di);
await A.p.locator('.roomwrap .menu button:has-text("Leyeh-leyeh")').click();
t = await waitToast(A.p, /leyeh-leyeh/);
const after = (await meOf(A)).pet.needs?.energi;
check(/leyeh-leyeh/.test(t) && (/\+\d+ Energi/.test(t) || /Energi.*sudah penuh/.test(t)), `Leyeh-leyeh menampilkan energi ("${t}")`);
check(after > before || after >= 99, `Leyeh-leyeh menambah energi (${Math.round(before)} → ${Math.round(after)})`);
await A.p.screenshot({ path: `${OUT}/leyeh-390.png` });

/* ---------------- HP 320: tanpa Kasur Rotan, tombol Tidur membawa pet ke Dipan Kayu ---------------- */
const B = await mk('Bantal', [320, 640]);
check((await B.ctx.request.post(BASE + '/api/shop/buy', { data: { itemId: 'dipan-kayu', currency: 'coin' } })).ok(), '320: beli Dipan Kayu');
check(await setLayout(B, [{ i: 'dipan-kayu', x: 4, y: 0 }]), '320: kamar hanya dengan Dipan Kayu (Kasur Rotan disimpan)');
await home(B);
di = await idxOf(B, 'dipan-kayu');
check((await B.ctx.request.post(BASE + '/api/sleep', { data: { on: true } })).ok(), '320: tidur lewat tombol Tidur (API)');
await home(B);
on = await waitOn(B, di);
check(on.ok, `320: pet tidur di Dipan Kayu, bukan di lantai (${on.why})`);
await B.p.screenshot({ path: `${OUT}/dipan-tidur-320.png` });
check((await wake(B)).ok(), '320: bangunkan pet');

/* ---------------- desktop 1366: Kasur Roket (mutiara) ---------------- */
const C = await mk('Roket', [1366, 820]);
const meC = await meOf(C);
check((await adm.post(`/api/admin/players/${meC.user.id}/wallet`, { data: { currency: 'pearl', delta: 30, reason: 'uji kasur roket' } })).ok(), '1366: admin memberi mutiara');
const buyR = await C.ctx.request.post(BASE + '/api/shop/buy', { data: { itemId: 'kb-kasurroket', currency: 'pearl' } });
if (buyR.ok()) {
  check(await setLayout(C, [{ i: 'kb-kasurroket', x: 3, y: 0 }]), '1366: kamar dengan Kasur Roket');
  await home(C);
  const ri = await idxOf(C, 'kb-kasurroket');
  menu = await tapFurn(C, ri);
  check(/Tidur sampai segar/.test(menu) && /Rebahan di roket/.test(menu), `1366: ketuk Kasur Roket → "Tidur sampai segar" + "Rebahan di roket"`);
  await C.p.locator('.roomwrap .menu button:has-text("Tidur sampai segar")').click();
  on = await waitOn(C, ri);
  check(on.ok, `1366: pet tidur di Kasur Roket (${on.why})`);
  await W(800);
  await C.p.screenshot({ path: `${OUT}/roket-tidur-1366.png` });
} else console.log(`lewati Kasur Roket: beli dengan mutiara ditolak (${(await buyR.json().catch(() => ({})))?.error?.code ?? buyR.status()})`);

// rumah teman: tetap hanya rebahan (tidur sungguhan hanya di rumah sendiri) sudah diuji di e2e-fasilitas
check(!errors.length, `tanpa galat halaman / 5xx${errors.length ? `: ${errors.join(' | ')}` : ''}`);
await b.close();
console.log(fails.length ? `\n${fails.length} GAGAL` : '\nSEMUA OK');
process.exit(fails.length ? 1 : 0);
