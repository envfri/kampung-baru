// Uji panel admin: masuk lewat form, buka semua halaman (desktop & HP) tanpa error, Ctrl K, filter + chip di Pemain,
// laci detail bertab, modal konfirmasi, bar simpan di Ekonomi & fitur, tab Moderasi.
// Jalankan server dulu dengan admin (ADMIN_EMAIL & ADMIN_PASSWORD), lalu: npm run test:e2e:admin
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE_URL ?? 'http://localhost:8787', OUT = process.env.SHOTS ?? 'test-results/e2e-admin';
const ADMIN = { email: process.env.ADMIN_EMAIL ?? 'owner@bupi.test', password: process.env.ADMIN_PASSWORD ?? 'rahasia-sekali-123' };
mkdirSync(OUT, { recursive: true });
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [], errors = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'GAGAL'} ${msg}`); if (!ok) fails.push(msg); };
const b = await chromium.launch();

// satu pemain supaya tabel tidak kosong
{
  const ctx = await b.newContext();
  await ctx.request.post(BASE + '/api/auth/guest', { data: {} });
  await ctx.request.post(BASE + '/api/pet', { data: { name: 'Lemper', color: '#F6B7A8', ear: 'kucing' } });
  await ctx.close();
}

async function open(opts, tag) {
  const ctx = await b.newContext(opts);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(`${tag} console: ${m.text()}`); });
  p.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 500) errors.push(`${tag} ${r.status()} ${r.url()}`); });
  await p.goto(BASE + '/admin/');
  await p.waitForSelector('input[type=email]');
  check(!(await p.locator('text=.env').count()), `${tag}: halaman masuk tanpa info .env`);
  await p.fill('input[type=email]', ADMIN.email);
  await p.fill('input[type=password]', ADMIN.password);
  await p.click('button[type=submit], button:has-text("Masuk")');
  await p.waitForSelector('nav[aria-label="Menu admin"]', { timeout: 10000 });
  return { ctx, p };
}
const PAGES = ['dashboard', 'items', 'events', 'quests', 'activities', 'locations', 'settings', 'media', 'notifcenter', 'broadcasts', 'email', 'whatsapp', 'announcements',
  'players', 'moderation', 'payments', 'packages', 'launch', 'server', 'audit', 'site', 'integrations', 'versions', 'admins', 'account'];

const D = await open({ viewport: { width: 1440, height: 900 } }, 'desktop');
for (const k of PAGES) {
  const before = errors.length;
  await D.p.goto(`${BASE}/admin/#/${k}`); await W(900);
  check(await D.p.locator('h1').first().isVisible() && errors.length === before, `halaman ${k} tampil tanpa error`);
  await D.p.screenshot({ path: `${OUT}/d-${k}.png` });
}
// Ctrl K: cari pemain lalu buka detailnya
await D.p.goto(`${BASE}/admin/#/dashboard`); await W(600);
await D.p.keyboard.press('Control+k');
await D.p.fill('.pal input', 'Lemper'); await W(800);
check(await D.p.locator('.pal li[role=option]:has-text("Lemper")').count() > 0, 'Ctrl K menemukan pemain');
await D.p.screenshot({ path: `${OUT}/d-palette.png` });
await D.p.keyboard.press('ArrowDown'); await D.p.keyboard.press('ArrowDown');
await D.p.locator('.pal li[role=option]:has-text("Lemper") button').first().click(); await W(1200);
check(await D.p.locator('.drawer').count() === 1, 'pilih pemain dari Ctrl K membuka detailnya');
await D.p.click('.drawer button[role=tab]:has-text("Moderasi")'); await W(300);
await D.p.click('.drawer button:has-text("Blokir pemain")'); await W(300);
check(await D.p.locator('.modal button:has-text("Blokir pemain")').isDisabled(), 'tombol blokir terkunci sampai nama diketik');
await D.p.screenshot({ path: `${OUT}/d-blokir.png` });
await D.p.click('.modal button:has-text("Batal")'); await W(200);
await D.p.keyboard.press('Escape'); await W(300);
// filter Status → chip aktif & tersimpan di tautan
await D.p.goto(`${BASE}/admin/#/players`); await W(800);
await D.p.click('.dd:has-text("Status")'); await D.p.click('.pop .opt:has-text("Tamu")'); await W(800);
check(await D.p.locator('.fchip:has-text("Status: Tamu")').count() === 1, 'filter aktif muncul sebagai chip');
check((await D.p.evaluate(() => location.hash)).includes('status=tamu'), 'filter tersimpan di tautan');
await D.p.click('.chips .link:has-text("Reset semua")'); await W(600);
check(await D.p.locator('.fchip').count() === 0, 'reset semua menghapus chip');
// Ekonomi & fitur: ubah angka → bar simpan → batalkan
await D.p.goto(`${BASE}/admin/#/settings`); await W(1000);
await D.p.fill('#sec-karung .f:nth-child(2) input', '99'); await W(300);
check(await D.p.locator('.savebar:has-text("1 perubahan")').count() === 1, 'bar simpan muncul setelah mengubah angka');
await D.p.click('.savebar button:has-text("Batalkan")'); await D.p.click('.modal button:has-text("Batalkan perubahan")'); await W(300);
check(await D.p.locator('.savebar').count() === 0, 'perubahan dibatalkan');
// Moderasi: tab
await D.p.goto(`${BASE}/admin/#/moderation`); await W(800);
await D.p.click('button[role=tab]:has-text("Kata terlarang")'); await W(600);
check(await D.p.locator('.w').count() > 0, 'tab kata terlarang menampilkan daftar');

// Server: 4 kartu pemakaian, riwayat, aturan peringatan bisa disimpan
await D.p.goto(`${BASE}/admin/#/server`); await W(1500);
check(await D.p.locator('.gauge').count() === 4, 'Server: kartu CPU, memori, penyimpanan, database tampil');
check(await D.p.locator('.gauge:has-text("CPU") b').first().textContent().then((t) => /%/.test(t ?? '')), 'Server: angka CPU terisi');
await D.p.fill('input[aria-label="Batas CPU (%)"]', '80'); await W(300);
await D.p.click('.sec button:has-text("Simpan"), button:has-text("Simpan")'); await W(800);
check(await D.p.locator('text=Pengaturan peringatan disimpan').count() > 0, 'Server: aturan peringatan tersimpan');
await D.p.fill('input[aria-label="Batas CPU (%)"]', '85'); await D.p.click('button:has-text("Simpan")'); await W(600);
await D.p.screenshot({ path: `${OUT}/d-server-cek.png` });
const M = await open({ ...devices['Pixel 7'] }, 'hp');
for (const k of ['dashboard', 'players', 'payments', 'moderation', 'settings', 'items', 'audit', 'server']) {
  const before = errors.length;
  await M.p.goto(`${BASE}/admin/#/${k}`); await W(900);
  const over = await M.p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check(errors.length === before && over <= 1, `HP: ${k} tampil tanpa error & tanpa geser samping (${over}px)`);
  await M.p.screenshot({ path: `${OUT}/m-${k}.png` });
}
await M.p.goto(`${BASE}/admin/#/players`); await W(800);
await M.p.click('button:has-text("Filter")'); await W(400);
check(await M.p.locator('.sheet[aria-label="Filter"]').count() === 1, 'HP: filter terbuka sebagai lembar dari bawah');
await M.p.screenshot({ path: `${OUT}/m-filter.png` });

console.log(errors.length ? 'ERROR:\n' + errors.join('\n') : 'tanpa error halaman/server');
await b.close();
if (fails.length || errors.length) process.exit(1);
