// Uji Situs & SEO + mode perawatan di browser: tag SEO & pratinjau tautan, robots/sitemap, halaman depan,
// admin menyalakan mode perawatan (pemain yang sedang main langsung melihat layar perawatan, pengunjung baru
// mendapat halaman 503, admin tetap bisa main), lalu mematikannya lagi (game terbuka sendiri).
// Jalankan server dulu dengan admin (ADMIN_EMAIL & ADMIN_PASSWORD), lalu: npm run test:e2e:situs
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE_URL ?? 'http://localhost:8787', OUT = process.env.SHOTS ?? 'test-results/e2e-situs';
const ADMIN = { email: process.env.ADMIN_EMAIL ?? 'owner@bupi.test', password: process.env.ADMIN_PASSWORD ?? 'rahasia-sekali-123' };
mkdirSync(OUT, { recursive: true });
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [], errors = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'GAGAL'} ${msg}`); if (!ok) fails.push(msg); };
const b = await chromium.launch();

// --- admin
const adm = await b.newContext({ viewport: { width: 1366, height: 900 } });
check((await adm.request.post(BASE + '/api/admin/login', { data: ADMIN })).ok(), 'admin masuk');
const site0 = (await (await adm.request.get(BASE + '/api/admin/site')).json()).site;
const put = async (patch) => {
  const cur = (await (await adm.request.get(BASE + '/api/admin/site')).json()).site;
  const next = { ...cur, ...patch, maintenance: { ...cur.maintenance, ...(patch.maintenance ?? {}) } };
  return adm.request.put(BASE + '/api/admin/site', { data: next });
};
await put({ maintenance: { on: false } });

// --- SEO di HTML & berkas pendukung
const html = await (await adm.request.get(BASE + '/')).text();
check(/<title>[^<]*BUPI[^<]*<\/title>/.test(html) && html.split('<title>').length === 2, 'satu <title> dari pengaturan situs');
for (const t of ['name="description"', 'rel="canonical"', 'property="og:title"', 'property="og:image"', 'property="og:image:width" content="1200"', 'name="twitter:card" content="summary_large_image"', 'application/ld+json'])
  check(html.includes(t), `tag ada: ${t}`);
const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
check(ld['@graph'].some((n) => [].concat(n['@type']).includes('VideoGame') && n.offers?.price === '0'), 'JSON-LD: VideoGame gratis');
check(ld['@graph'].find((n) => n['@type'] === 'Organization')?.sameAs?.some((u) => u.includes('instagram.com/playbudi')), 'JSON-LD: Instagram @playbudi');
const og = await adm.request.get(BASE + '/og/bupi.jpg');
check(og.ok() && og.headers()['content-type']?.includes('image/jpeg') && (await og.body()).length < 300_000, 'gambar pratinjau 1200×630 tersedia (< 300 KB)');
check((await (await adm.request.get(BASE + '/robots.txt')).text()).includes('User-agent'), 'robots.txt');
check((await (await adm.request.get(BASE + '/sitemap.xml')).text()).includes('<urlset'), 'sitemap.xml');
check((await adm.request.get(BASE + '/api/version')).headers()['x-robots-tag']?.includes('noindex'), 'API diberi X-Robots-Tag noindex');

// --- pemain
const P = await b.newContext({ ...devices['Pixel 7'] });
await P.addInitScript(() => { try { localStorage.setItem('kb-save-snooze', String(Date.now() + 9e9)); } catch {} });
const p = await P.newPage();
p.on('pageerror', (e) => errors.push('pemain: ' + e.message));
await p.goto(BASE + '/'); await W(1500);
check(await p.locator('.login .about li').count() === 4, 'layar depan: 4 hal yang bisa dilakukan di BUPI');
check(await p.locator('.login .follow a[href*="instagram.com/playbudi"]').count() === 1, 'layar depan: tautan Instagram @playbudi');
await p.screenshot({ path: `${OUT}/01-hp-layar-depan.png`, fullPage: true });
// undangan: pratinjau tautan memakai nama pengundang
await P.request.post(BASE + '/api/auth/guest', { data: {} });
const st = await (await P.request.post(BASE + '/api/pet', { data: { name: 'Gethuk', color: '#F6B7A8', ear: 'tunas', ownerName: 'Sari' } })).json();
const inv = await (await adm.request.get(BASE + `/?undang=${st.state.user.friend_code}`)).text();
check(inv.includes('Sari ngajak kamu main BUPI!'), 'tautan undangan: judul pratinjau dengan nama pengundang');
await p.goto(BASE + '/'); await W(1800);
for (let i = 0; i < 3; i++) { const x = p.locator('.sheet .x'); if (await x.count()) { await x.first().click(); await W(300); } }
check(await p.locator('.dock').count() === 1, 'pemain sudah di dalam game');

// --- admin: halaman Situs & SEO lalu nyalakan perawatan dari UI
const a = await adm.newPage();
a.on('pageerror', (e) => errors.push('admin: ' + e.message));
await a.goto(BASE + '/admin/#/site'); await a.waitForSelector('#mt-h'); await W(500);
await a.screenshot({ path: `${OUT}/02-admin-situs-seo.png`, fullPage: true });
check(await a.locator('.phone .mt-scene').count() === 1, 'admin: pratinjau halaman perawatan');
check(await a.locator('.g-title').count() === 1 && await a.locator('.share img').count() >= 1, 'admin: pratinjau Google & kartu tautan');
await a.fill('input[type="datetime-local"]', '');
await a.click('button:has-text("+1 jam")');
a.once('dialog', (d) => d.accept());
await a.click('button:has-text("Aktifkan mode perawatan")');
await W(800);
check(await a.locator('.chip:has-text("AKTIF")').count() === 1, 'admin: mode perawatan aktif');
check(await a.locator('.maintbar').count() === 1, 'admin: penanda merah perawatan di semua halaman');

// pemain yang sedang main: permintaan berikutnya → layar perawatan di dalam game
await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
let shown = false;
for (let i = 0; i < 20 && !shown; i++) { await W(300); shown = (await p.locator('.maint .mt-scene').count()) === 1; }
check(shown, 'pemain yang sedang main melihat layar perawatan');
check(await p.locator('.maint [data-mt-left]').count() === 1, 'hitung mundur perkiraan selesai');
check(await p.locator('.maint a.mt-ig[href*="instagram.com/playbudi"]').count() === 1, 'tombol Instagram @playbudi');
await W(1200);
await p.screenshot({ path: `${OUT}/03-hp-perawatan-dalam-game.png` });

// pengunjung baru: halaman 503 dari server
const V = await b.newContext({ ...devices['iPhone 13'] });
const v = await V.newPage();
v.on('pageerror', (e) => errors.push('pengunjung: ' + e.message));
const res = await v.goto(BASE + '/');
check(res.status() === 503 && !!res.headers()['retry-after'], 'pengunjung baru: HTTP 503 + Retry-After');
check(await v.locator('main.mt .mt-scene').count() === 1 && await v.locator('a.mt-ig').count() === 1, 'pengunjung baru: halaman perawatan beranimasi + Instagram');
await W(900);
await v.screenshot({ path: `${OUT}/04-iphone-halaman-503.png`, fullPage: true });
const g = await adm.newPage();
await g.goto(BASE + '/'); await W(1500);
check(await g.locator('.mt').count() === 0 && await g.locator('.mbar').count() === 1, 'admin tetap bisa membuka game (dengan penanda perawatan)');

// matikan: pemain kembali ke game sendiri (tombol Cek lagi)
await a.click('button:has-text("Matikan mode perawatan")'); await W(800);
check(await a.locator('.maintbar').count() === 0, 'admin: penanda perawatan hilang');
await W(5200);
await p.click('.maint [data-mt-check]').catch(() => {});
let back = false;
for (let i = 0; i < 30 && !back; i++) { await W(400); back = (await p.locator('.dock').count()) === 1 && (await p.locator('.maint').count()) === 0; }
check(back, 'perawatan selesai: pemain kembali ke game');
await v.reload(); await W(1200);
check(await v.locator('.login').count() === 1, 'pengunjung baru: game terbuka lagi');

await put({ ...site0, maintenance: { ...site0.maintenance, on: false } });
if (errors.length) { console.log('Error halaman:'); for (const e of errors) console.log('  ' + e); }
await b.close();
if (fails.length || errors.length) { console.log(`\n${fails.length} cek gagal, ${errors.length} error`); process.exit(1); }
console.log('\nSemua cek situs & perawatan lolos.');
