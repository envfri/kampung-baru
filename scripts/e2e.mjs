// Uji alur utama di viewport HP (Playwright). Jalankan server dulu (npm run build && npm start),
// lalu: npm run test:e2e   (opsional BASE_URL=https://staging.contoh.id)
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { console.error('Pasang Playwright dulu: npm i -D playwright && npx playwright install chromium'); process.exit(1); }
const { chromium, devices } = pw;
const BASE = process.env.BASE_URL ?? 'http://localhost:8787';
const OUT = process.env.SHOTS ?? 'test-results/e2e';
mkdirSync(OUT, { recursive: true });

const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['Pixel 7'] });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 500) errors.push(`${r.status()} ${r.url()}`); });
const step = async (name, fn) => { await fn(); await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/${name}.png` }); console.log('✓', name); };

try {
  await step('01-login', () => p.goto(BASE).then(() => p.waitForSelector('text=Main sekarang')));
  await step('02-setup', async () => { await p.click('text=Main sekarang'); await p.fill('#pet-name', 'Uji'); await p.click('text=Kelinci'); });
  await step('03-daily', async () => { await p.click('text=Mulai main'); await p.click('.sheet .btn:has-text("Ambil hadiah")'); await p.waitForTimeout(1200); });
  await step('04-mandi', async () => {
    // gosok sabun di badan pet sampai berbusa, lalu bilas dengan gayung
    await p.click('.acts .btn:has-text("Mandi")');
    const b = await p.locator('.room .pet').boundingBox();
    await p.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.5); await p.mouse.down();
    for (let i = 0; i < 60; i++) await p.mouse.move(b.x + b.width * (0.25 + 0.5 * ((i % 10) / 10)), b.y + b.height * (0.3 + 0.4 * (Math.floor(i / 10) / 6)));
    await p.mouse.up();
    await p.click('.bathbar .btn:has-text("Gayung")');
    const b2 = await p.locator('.room .pet').boundingBox();
    await p.mouse.click(b2.x + b2.width / 2, b2.y + b2.height / 2);
    await p.waitForSelector('.bathbar', { state: 'detached' });
  });
  await step('05-makan', async () => { await p.click('.acts .btn:has-text("Makan")'); await p.click('.tray .food >> nth=0'); await p.waitForTimeout(400); await p.click('.tray .btn:has-text("Tutup")'); });
  await step('06-aktivitas', async () => {
    // ketuk kasur → menu aktivitas → pet berjalan & tidur di kasur
    await p.click('.furn >> nth=0', { force: true }).catch(() => {});
    if (!(await p.locator('.menu').count())) await p.click('.spot[data-spot="jendela"]');
    await p.click('.menu .btn >> nth=0');
    await p.waitForSelector('.room.acting', { timeout: 8000 });
    await p.waitForFunction(() => !document.querySelector('.room.acting'), null, { timeout: 12000 });
  });
  await step('07-jalan-ke-toko', async () => {
    // toko didatangi lewat peta: pet berjalan ke Mebel Jati, lalu masuk
    await p.click('.dock button:has-text("Kampung")'); await p.click('[data-loc="mebel"]');
    await p.waitForSelector('.shop .panel', { timeout: 10000 });
    await p.click('.card:has-text("Meja Bambu") .btn');
    await p.click('.shop .back');
    await p.click('.dock button:has-text("Tas")'); await p.click('.tabbar button:has-text("Mebel")');
    await p.click('.card:has-text("Meja Bambu") .btn'); await p.click('.editbar .btn:has-text("Selesai")');
  });
  await step('07b-butik-coba', async () => {
    // Butik Benang: Coba kaos di pet sendiri → Kaca Pas: Beli (konfirmasi) → Pakai semua
    await p.click('.dock button:has-text("Kampung")'); await p.click('[data-loc="butik"]');
    await p.waitForSelector('.shop .panel', { timeout: 10000 });
    await p.click('.card:has-text("Kaos Polos Merah") .try');
    await p.waitForSelector('.fit .buyall');
    await p.click('.fit .buyall'); await p.click('.fit .buyall:has-text("Yakin")');
    await p.click('.fit .buyall:has-text("Pakai semua")');
    await p.waitForSelector('.fit', { state: 'detached' });
    const body = await p.evaluate(() => fetch('/api/me').then((r) => r.json()).then((m) => m.pet.wear.body));
    if (body !== 'kaos-merah') throw new Error('kaos tidak terpakai: ' + body);
    await p.click('.shop .back');
  });
  await step('08-kebun', async () => {
    await p.click('.dock button:has-text("Kampung")'); await p.click('[data-loc="kebun"]');
    await p.click('.plot >> nth=0'); await p.click('.sheet .btn:has-text("Tanam")');
  });
  await step('09-lomba', async () => {
    await p.click('.bar .btn:has-text("Kampung")'); await p.click('[data-loc="lapangan"]');
    await p.click('.btn:has-text("Mulai lomba")'); await p.waitForTimeout(3300);
    // ritme ketukan manusia (±8 per detik); lebih cepat dari batas akan ditolak anti-curang
    for (let i = 0; i < 60 && (await p.locator('.pad').count()); i++) { await p.click(`.pad >> nth=${i % 2}`, { timeout: 1500 }).catch(() => {}); await p.waitForTimeout(70); }
    await p.waitForSelector('text=Waktumu');
  });
  await step('10-mancing', async () => {
    await p.click('.card .btn:has-text("Kampung")'); await p.click('[data-loc="kolam"]');
    await p.click('.btn:has-text("Lempar")'); await p.waitForSelector('text=TARIK!', { timeout: 8000 }); await p.click('text=TARIK!');
    await p.waitForTimeout(800);
  });
  await step('11-notifikasi', () => p.click('.tool[aria-label^="Notifikasi"]'));
  if (errors.length) throw new Error('Error di halaman:\n' + errors.join('\n'));
  console.log(`Selesai. Screenshot di ${OUT}/`);
} catch (e) {
  console.error('GAGAL:', e.message);
  await p.screenshot({ path: `${OUT}/gagal.png` }).catch(() => {});
  process.exitCode = 1;
} finally {
  await b.close();
}
