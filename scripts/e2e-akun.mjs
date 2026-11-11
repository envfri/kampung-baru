// Uji akun tamu & pindah perangkat (3 perangkat): ajakan Simpan progres, kode pindah, layar masuk,
// dan konfirmasi sebelum pindah akun. Jalankan server dulu (npm run build && npm start), lalu: npm run test:e2e:akun
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE_URL ?? 'http://localhost:8787', OUT = process.env.SHOTS ?? 'test-results/e2e-akun';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); const errors = [];
const watch = (p, n) => { p.on('pageerror', (e) => errors.push(n + ': ' + e.message)); p.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 500) errors.push(`${n} ${r.status()} ${r.url()}`); }); };
async function guest(ctx, pet, color, ear) {
  await ctx.request.post(BASE + '/api/auth/guest', { data: {} });
  const st = await (await ctx.request.post(BASE + '/api/pet', { data: { name: pet, color, ear } })).json();
  await ctx.request.post(BASE + '/api/daily', { data: {} });
  return st.state.user;
}
// HP lama: tamu "Mochi" yang sudah punya teman
const A = await b.newContext({ ...devices['Pixel 7'] });
const ua = await guest(A, 'Mochi', '#F6B7A8', 'kelinci');
const F = await b.newContext(); await guest(F, 'Kopi', '#9FD0E8', 'kucing');
await F.request.post(BASE + '/api/friends', { data: { code: ua.friend_code } });
const pa = await A.newPage(); watch(pa, 'A');
await pa.goto(BASE + '/');
await pa.waitForTimeout(1200);
if (await pa.locator('.sheet[aria-label="Kabar Kampung"], .sheet[aria-label^="Kabar"]').count()) await pa.click('.sheet .x');
await pa.waitForSelector('.sheet[aria-label="Simpan progres"]', { timeout: 10000 });
await pa.waitForTimeout(1500); await pa.screenshot({ path: `${OUT}/01-ajakan-simpan.png` });
await pa.click('.sheet .btn:has-text("Pindah sekarang pakai kode")');
await pa.click('.sheet .btn:has-text("Buat kode pindah perangkat")');
await pa.waitForSelector('.code b');
const code = (await pa.locator('.code b').innerText()).trim();
await pa.waitForTimeout(400); await pa.screenshot({ path: `${OUT}/02-kode-pindah.png` });
await pa.click('.sheet .link:has-text("Nanti saja")');
await pa.waitForTimeout(400);
// Pengaturan › Akun (tamu)
await pa.click('.tool[aria-label^="Pengaturan"]');
await pa.waitForSelector('.sheet[aria-label="Pengaturan"]');
await pa.waitForTimeout(1500); await pa.screenshot({ path: `${OUT}/03-pengaturan-akun-tamu.png` });
// HP/laptop baru: layar masuk → kode pindah
const N = await b.newContext({ viewport: { width: 1280, height: 800 } });
const pn = await N.newPage(); watch(pn, 'N');
await pn.goto(BASE + '/');
await pn.waitForSelector('text=Punya kode pindah perangkat?');
await pn.waitForTimeout(1200); await pn.screenshot({ path: `${OUT}/04-layar-masuk.png` });
await pn.click('text=Punya kode pindah perangkat?');
await pn.fill('#kb-transfer', code);
await pn.screenshot({ path: `${OUT}/05-ketik-kode.png` });
await pn.click('.btn:has-text("Buka akunku")');
await pn.waitForSelector('.hud, .game', { timeout: 10000 });
await pn.waitForTimeout(1500); await pn.screenshot({ path: `${OUT}/06-desktop-akun-terbuka.png` });
const nameN = await pn.evaluate(async () => (await (await fetch('/api/me')).json()).pet.name);
// perangkat lain yang sudah main sebagai tamu → dialog konfirmasi
const code2 = (await (await A.request.post(BASE + '/api/auth/transfer', { data: {} })).json()).code;
const C = await b.newContext({ ...devices['Pixel 7'] });
await guest(C, 'Onde', '#F4D58D', 'kucing');
const pc = await C.newPage(); watch(pc, 'C');
await pc.goto(BASE + '/#akun');
await pc.waitForSelector('.sheet[aria-label="Pengaturan"]');
await pc.click('.btn:has-text("Punya kode dari perangkat lain?")');
await pc.fill('#kb-transfer', code2);
await pc.click('.btn:has-text("Buka akunku")');
await pc.waitForSelector('[role="alertdialog"]');
await pc.waitForTimeout(300); await pc.screenshot({ path: `${OUT}/07-konfirmasi-pindah.png` });
await pc.click('[role="alertdialog"] .btn:has-text("Ya, pindah")');
await pc.waitForTimeout(1500);
const nameC = await pc.evaluate(async () => (await (await fetch('/api/me')).json()).pet.name);
await pc.screenshot({ path: `${OUT}/08-sudah-pindah.png` });
await b.close();
if (nameN !== 'Mochi' || nameC !== 'Mochi') errors.push(`akun tidak pindah: ${nameN} / ${nameC}`);
if (errors.length) { console.error('Galat:', errors); process.exit(1); }
console.log('Akun & pindah perangkat OK. Screenshot di', OUT);
