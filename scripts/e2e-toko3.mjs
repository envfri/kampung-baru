// Uji barang baru tiga toko koin (paket konten 18): berjalan ke Pasar Pagi, Mebel Jati, dan Toko Bangunan lewat peta,
// barang baru tampil di tiap toko; beli makanan, mebel, dan benda halaman dengan koin (koin diberi admin); beri makan
// dengan makanan baru; pasang mebel baru lewat Atur (Tas › Pasang, Putar, Selesai) lalu pakai aktivitasnya; bangun
// halaman, pasang saung di halaman lewat Atur, lalu ngaso di saung. Foto layar tiap toko di HP 390 & 320 dan desktop 1366.
// Jalankan server dulu dengan admin (ADMIN_EMAIL & ADMIN_PASSWORD), lalu: BASE_URL=http://localhost:8787 npm run test:e2e:toko3
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, request } = require('playwright');
const BASE = (process.env.BASE_URL ?? 'http://localhost:8787').replace(/\/$/, ''), OUT = process.env.SHOTS ?? 'test-results/e2e-toko3';
const ADMIN = { email: process.env.ADMIN_EMAIL ?? 'owner@bupi.test', password: process.env.ADMIN_PASSWORD ?? 'rahasia-sekali-123' };
mkdirSync(OUT, { recursive: true });
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [], errors = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'GAGAL'} ${msg}`); if (!ok) fails.push(msg); };

/** barang baru per toko (nama di kartu toko) */
const NEW = {
  pasar: ['Gado-gado', 'Soto Ayam', 'Nasi Uduk', 'Onde-onde', 'Pisang Molen', 'Es Buah', 'Serabi', 'Wedang Ronde'],
  mebel: ['Kursi Goyang Rotan', 'Meja Belajar', 'Cermin Berdiri', 'Jam Bandul', 'Lemari Kaca Pajangan', 'Kipas Angin Berdiri', 'Radio Tua', 'Dipan Kayu', 'Dinding Lis Kayu', 'Dinding Kembang Kecil', 'Lantai Tegel Kembang'],
  bangunan: ['Saung Bambu', 'Sumur Timba', 'Kolam Ikan', 'Pot Kembang Sepatu', 'Lampu Taman Joglo', 'Batu Pijakan', 'Kurungan Ayam', 'Jemuran Bambu', 'Pagar Bambu', 'Hamparan Kerikil', 'Lantai Bata Merah'],
};
const FIRST = { pasar: 'Gado-gado', mebel: 'Kursi Goyang Rotan', bangunan: 'Saung Bambu' };
const TAB = { pasar: 'Makanan', mebel: 'Mebel', bangunan: 'Mebel' };

const adm = await request.newContext({ baseURL: BASE });
check((await adm.post('/api/admin/login', { data: ADMIN })).ok(), 'admin masuk');
const cat = await (await adm.get('/api/catalog')).json();
const byName = Object.fromEntries(cat.items.map((i) => [i.name, i]));
for (const [shop, names] of Object.entries(NEW)) check(names.every((n) => byName[n]?.shop === shop && byName[n].price_coin > 0), `katalog: ${names.length} barang baru di toko ${shop} dengan harga koin`);

const b = await chromium.launch();
async function mk(name, vp, coins) {
  const mobile = vp[0] < 900;
  const ctx = await b.newContext({ viewport: { width: vp[0], height: vp[1] }, hasTouch: mobile, isMobile: mobile });
  await ctx.addInitScript(() => { try { localStorage.setItem('kb-save-snooze', String(Date.now() + 9e9)); localStorage.setItem('kb-push-asked', String(Date.now() + 9e9)); localStorage.setItem('kb-news-seen', '["*"]'); localStorage.setItem('kb-ajak', JSON.stringify({ day: new Date().toLocaleDateString('en-CA'), n: 9, last: Date.now(), nanti: 0, mute: true, alunAt: 0 })); } catch {} });
  await ctx.request.post(BASE + '/api/auth/guest', { data: {} });
  await ctx.request.post(BASE + '/api/pet', { data: { name, color: '#F6B7A8', ear: 'kucing' } });
  await ctx.request.post(BASE + '/api/daily', { data: {} });
  const me = await (await ctx.request.get(BASE + '/api/me')).json();
  check((await adm.post(`/api/admin/players/${me.user.id}/wallet`, { data: { currency: 'coin', delta: coins, reason: 'uji barang toko baru' } })).ok(), `${name}: admin memberi ${coins} koin`);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  p.on('response', (res) => { if (res.url().includes('/api/') && res.status() >= 500) errors.push(`${name}: ${res.status()} ${res.url()}`); });
  return { ctx, p, me, name, vp };
}
const meOf = async (pl) => (await pl.ctx.request.get(BASE + '/api/me')).json();
const closeSheets = async (p) => { for (let i = 0; i < 3; i++) { const x = p.locator('.sheet .x'); if (await x.count()) { await x.first().click().catch(() => {}); await W(300); } } };
const home = async (pl) => { await pl.p.goto(`${BASE}/?r=${Math.random().toString(36).slice(2)}`); await pl.p.waitForSelector('.dock', { timeout: 20000 }); await W(1200); await closeSheets(pl.p); };
const toastText = async (p) => (await p.locator('.toast').allInnerTexts().catch(() => [])).join(' | ');
const waitToast = async (p, re) => { let t = ''; for (let i = 0; i < 30 && !re.test(t); i++) { await W(300); t = await toastText(p); } return t; };

/** dari peta kampung: pet berjalan ke toko, lalu masuk */
async function walkTo(pl, shop) {
  await pl.p.goto(`${BASE}/?r=${shop}#map`);
  await pl.p.waitForSelector(`.loc[data-loc="${shop}"]`, { timeout: 20000 }); await W(800); await closeSheets(pl.p);
  await pl.p.locator(`.loc[data-loc="${shop}"]`).dispatchEvent('click');
  await pl.p.waitForSelector('.shop .panel', { timeout: 20000 }); await W(600);
}
const cardNames = (p) => p.evaluate(() => [...document.querySelectorAll('.shop .panel .card .name')].map((e) => e.textContent.trim()));
const card = (p, name) => p.locator(`.shop .panel .card:has(.name:text-is("${name}"))`);
/** cek toko: semua barang baru tampil, kartu tidak keluar layar; foto layar dengan barang baru pertama di layar */
async function checkShop(pl, shop, tag) {
  const names = await cardNames(pl.p);
  const missing = NEW[shop].filter((n) => !names.includes(n));
  check(!missing.length, `${tag}: ${NEW[shop].length} barang baru tampil di ${shop}${missing.length ? ` (tidak ada: ${missing.join(', ')})` : ''}`);
  const off = await pl.p.evaluate(() => [...document.querySelectorAll('.shop .panel .card')].some((e) => { const r = e.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1; }));
  check(!off, `${tag}: kartu barang di dalam layar`);
  // tab jenis barang: hanya jenis itu, barang baru tetap ada
  await pl.p.locator('.shop .tabbar button', { hasText: TAB[shop] }).first().click(); await W(300);
  const inTab = await cardNames(pl.p);
  check(inTab.includes(FIRST[shop]), `${tag}: tab ${TAB[shop]} memuat ${FIRST[shop]}`);
  // barang baru pertama di atas panel, supaya barang-barang baru memenuhi foto
  await card(pl.p, FIRST[shop]).evaluate((e) => e.scrollIntoView({ block: 'start' })); await W(400);
  await pl.p.screenshot({ path: `${OUT}/toko-${shop}-${tag}.png` });
}
/** beli satu barang lewat kartu toko (barang ≥ 150 koin: ketuk dua kali untuk konfirmasi) */
async function buyCard(pl, name) {
  const before = (await meOf(pl)).wallet.coin;
  const c = card(pl.p, name);
  await c.scrollIntoViewIfNeeded();
  const btn = c.locator('.acts .btn').last();
  await btn.click(); await W(300);
  if (/Yakin/.test(await btn.innerText())) { await btn.click(); }
  await W(1200);
  const me = await meOf(pl);
  return { spent: before - me.wallet.coin, me };
}

/* ---------------- HP 390: tiga toko, beli, makan, Atur, aktivitas, halaman ---------------- */
const A = await mk('Serabi', [390, 844], 3000);
await home(A);
await walkTo(A, 'pasar');
await checkShop(A, 'pasar', '390');
let r = await buyCard(A, 'Gado-gado');
check(r.spent === byName['Gado-gado'].price_coin && (r.me.inventory?.['gado-gado'] ?? 0) === 1, `beli Gado-gado di Pasar Pagi (−${r.spent} koin)`);
r = await buyCard(A, 'Es Buah');
check(r.spent === byName['Es Buah'].price_coin && (r.me.inventory?.['es-buah'] ?? 0) === 1, `beli Es Buah (−${r.spent} koin)`);

await walkTo(A, 'mebel');
await checkShop(A, 'mebel', '390');
r = await buyCard(A, 'Kursi Goyang Rotan');
check(r.spent === 120 && (r.me.inventory?.['kursi-goyang'] ?? 0) === 1, `beli Kursi Goyang Rotan di Mebel Jati (−${r.spent} koin)`);
r = await buyCard(A, 'Jam Bandul');
check(r.spent === 180 && (r.me.inventory?.['jam-bandul'] ?? 0) === 1, `beli Jam Bandul dengan konfirmasi (−${r.spent} koin)`);
await A.p.locator('.shop .tabbar button', { hasText: 'Lantai' }).first().click(); await W(300);
r = await buyCard(A, 'Lantai Tegel Kembang');
check(r.spent === 120 && (r.me.inventory?.['fl-tegelkembang'] ?? 0) === 1, `beli Lantai Tegel Kembang (−${r.spent} koin)`);

await walkTo(A, 'bangunan');
await checkShop(A, 'bangunan', '390');
r = await buyCard(A, 'Saung Bambu');
check(r.spent === 240 && (r.me.inventory?.['saung-bambu'] ?? 0) === 1, `beli Saung Bambu di Toko Bangunan dengan konfirmasi (−${r.spent} koin)`);
r = await buyCard(A, 'Pot Kembang Sepatu');
check(r.spent === 60 && (r.me.inventory?.['pot-kembang-sepatu'] ?? 0) === 1, `beli Pot Kembang Sepatu (−${r.spent} koin)`);

// beri makan dengan makanan baru (ketuk di nampan)
await home(A);
await A.p.click('.acts .btn.act:has-text("Makan")'); await A.p.waitForSelector('.tray'); await W(400);
await A.p.screenshot({ path: `${OUT}/nampan-makanan-390.png` });
await A.p.locator('.tray .food[aria-label^="Beri Gado-gado"]').click();
let t = await waitToast(A.p, /makan Gado-gado/);
check(/makan Gado-gado/.test(t), `beri makan Gado-gado ("${t}")`);
let me = await meOf(A);
check((me.inventory?.['gado-gado'] ?? 0) === 0, 'Gado-gado habis dari Tas');
await A.p.locator('.tray .btn:has-text("Tutup")').click().catch(() => {}); await W(300);

// Atur: pasang kursi goyang & jam bandul dari Tas, putar jam ke belakang dua kali, Selesai
await A.p.click('.btn.act:has-text("Atur")'); await W(700);
for (const nm of ['Kursi Goyang Rotan', 'Jam Bandul']) {
  await A.p.locator('.editbar .btn', { hasText: /^\s*Tas\s*$/ }).click(); await A.p.waitForSelector('.sheet .card'); await W(300);
  await A.p.locator('.sheet .tabbar button:has-text("Mebel")').click().catch(() => {}); await W(200);
  await A.p.locator(`.sheet .card:has(.name:text-is("${nm}")) .btn:has-text("Pasang")`).click(); await W(500);
  check(/dipilih/.test(await A.p.locator('.editbar p').innerText()), `Atur: ${nm} dipasang dari Tas & terpilih`);
}
await A.p.click('.editbar .rotbtn'); await W(250); await A.p.click('.editbar .rotbtn'); await W(300);
await A.p.screenshot({ path: `${OUT}/atur-390.png` });
await A.p.click('.editbar .btn:has-text("Selesai")'); await W(1200);
me = await meOf(A);
let room = (me.rooms ?? [me.room])[0];
const ki = room.layout.findIndex((q) => q.i === 'kursi-goyang'), ji = room.layout.findIndex((q) => q.i === 'jam-bandul');
check(ki >= 0 && ji >= 0, 'Selesai: kursi goyang & jam bandul tersimpan di kamar');
check(room.layout[ji]?.r === 2, `jam bandul tersimpan membelakangi kamera (r: ${room.layout[ji]?.r})`);
// lantai tegel dari Tas › Dekor
await A.p.goto(`${BASE}/?r=t#bag`); await A.p.waitForSelector('.sheet .tabbar'); await W(500);
await A.p.click('.sheet .tabbar button:has-text("Dekor")'); await W(300);
await A.p.locator('.sheet .card:has(.name:text-is("Lantai Tegel Kembang")) .btn').click(); await W(1200);
me = await meOf(A);
check((me.rooms ?? [me.room])[0].floor === 'fl-tegelkembang', 'Lantai Tegel Kembang terpasang di kamar');
// aktivitas baru: bergoyang di kursi goyang
await home(A);
check(await A.p.locator('svg.room .back').count() >= 1, 'jam bandul digambar membelakangi kamera');
const rid = room.id;
const fsel = (r2, i) => `svg.room .furn[data-i="${i}"]${r2 ? `[data-r="${r2}"]` : ''}`;
const kursi = A.p.locator(fsel(rid, ki)).first();
await (await kursi.count() ? kursi : A.p.locator(fsel('', ki)).first()).click({ force: true }); await W(600);
let menuTxt = await A.p.locator('.menu').innerText().catch(() => '');
check(/Bergoyang santai/.test(menuTxt), `ketuk kursi goyang: menu aktivitas ("${menuTxt.replace(/\n/g, ' ')}")`);
await A.p.locator('.menu button:has-text("Bergoyang santai")').click();
t = await waitToast(A.p, /bergoyang pelan/);
check(/bergoyang pelan/.test(t), `aktivitas Bergoyang santai berjalan ("${t}")`);
await A.p.screenshot({ path: `${OUT}/ruang-mebel-390.png` });

// halaman: bangun lewat API, pasang saung lewat Atur (ketuk halaman saat Atur), lalu ngaso di saung
check((await A.ctx.request.post(BASE + '/api/shop/buy', { data: { itemId: 'halaman', currency: 'coin' } })).ok(), 'halaman dibangun (API)');
me = await meOf(A);
const hal = me.rooms.find((x) => x.item === 'halaman');
check(!!hal, 'halaman ada di rumah');
await home(A);
await A.p.click('.btn.act:has-text("Atur")'); await W(800);
await A.p.evaluate((id) => { const el = document.querySelector(`.room .fl[data-r="${id}"]`); el?.dispatchEvent(new MouseEvent('click', { bubbles: true })); }, hal.id);
await W(900);
check((await A.p.locator('.editbar .ename').textContent()).includes('Halaman'), 'Atur: pindah mengatur Halaman Rumput');
for (const nm of ['Saung Bambu', 'Pot Kembang Sepatu']) {
  await A.p.locator('.editbar .btn', { hasText: /^\s*Tas\s*$/ }).click(); await A.p.waitForSelector('.sheet .card'); await W(300);
  await A.p.locator('.sheet .tabbar button:has-text("Mebel")').click().catch(() => {}); await W(200);
  await A.p.locator(`.sheet .card:has(.name:text-is("${nm}")) .btn:has-text("Pasang")`).click(); await W(500);
  check(/dipilih/.test(await A.p.locator('.editbar p').innerText()), `Atur halaman: ${nm} dipasang`);
}
await A.p.screenshot({ path: `${OUT}/atur-halaman-390.png` });
await A.p.click('.editbar .btn:has-text("Selesai")'); await W(1400);
me = await meOf(A);
const hal2 = me.rooms.find((x) => x.item === 'halaman');
const si = hal2.layout.findIndex((q) => q.i === 'saung-bambu'), pi = hal2.layout.findIndex((q) => q.i === 'pot-kembang-sepatu');
check(si >= 0 && pi >= 0, 'saung & pot kembang tersimpan di halaman');
// ke halaman, ketuk saung
await A.p.click('.roompill').catch(() => {}); await W(400);
const pick = A.p.locator('.sheet .room:has-text("Halaman")');
if (await pick.count()) { await pick.first().click(); await W(400); }
for (let i = 0; i < 40; i++) { await W(250); if ((await A.p.evaluate(() => document.querySelector('.roompill b')?.textContent ?? '')).includes('Halaman')) break; }
await W(800);
await A.p.locator(fsel(hal2.id, si)).first().click({ force: true }); await W(700);
menuTxt = await A.p.locator('.menu').innerText().catch(() => '');
check(/Ngaso di saung/.test(menuTxt), `ketuk saung di halaman: menu aktivitas ("${menuTxt.replace(/\n/g, ' ')}")`);
await A.p.locator('.menu button:has-text("Ngaso di saung")').click();
t = await waitToast(A.p, /ngaso di saung/);
check(/ngaso di saung/.test(t), `aktivitas Ngaso di saung berjalan ("${t}")`);
await A.p.screenshot({ path: `${OUT}/halaman-390.png` });

/* ---------------- HP 320: tiga toko, beli lewat kartu ---------------- */
const B = await mk('Klepon', [320, 640], 1000);
await home(B);
for (const shop of ['pasar', 'mebel', 'bangunan']) {
  await walkTo(B, shop);
  await checkShop(B, shop, '320');
}
r = await buyCard(B, 'Saung Bambu');
check(r.spent === 240, `HP 320: beli Saung Bambu (−${r.spent} koin)`);
await walkTo(B, 'pasar');
r = await buyCard(B, 'Wedang Ronde');
check(r.spent === 9 && (r.me.inventory?.['wedang-ronde'] ?? 0) === 1, `HP 320: beli Wedang Ronde (−${r.spent} koin)`);

/* ---------------- desktop 1366: tiga toko, ruangan berperabot ---------------- */
const C = await mk('Onde', [1366, 820], 3000);
await home(C);
for (const shop of ['pasar', 'bangunan', 'mebel']) {
  await walkTo(C, shop);
  await checkShop(C, shop, '1366');
}
r = await buyCard(C, 'Lemari Kaca Pajangan');
check(r.spent === 200, `desktop: beli Lemari Kaca Pajangan (−${r.spent} koin)`);
for (const id of ['meja-belajar', 'kipas-angin', 'radio-tua', 'dipan-kayu', 'cermin-berdiri', 'wp-lambri']) check((await C.ctx.request.post(BASE + '/api/shop/buy', { data: { itemId: id, currency: 'coin' } })).ok(), `desktop: beli ${id} (API)`);
me = await meOf(C); room = (me.rooms ?? [me.room])[0];
const lay = [{ i: 'dipan-kayu', x: 4, y: 0 }, { i: 'lemari-kaca', x: 0, y: 1, r: 1 }, { i: 'meja-belajar', x: 0, y: 4, r: 1 }, { i: 'radio-tua', x: 2, y: 0 }, { i: 'cermin-berdiri', x: 1, y: 0 }, { i: 'kipas-angin', x: 5, y: 3, r: 2 }];
check((await C.ctx.request.post(BASE + '/api/room', { data: { roomId: room.id || undefined, version: room.version, wall: 'wp-lambri', layout: lay } })).ok(), 'desktop: kamar dengan 6 mebel baru tersimpan (dinding lis kayu)');
await home(C);
me = await meOf(C);
const ri = (me.rooms ?? [me.room])[0].layout.findIndex((q) => q.i === 'radio-tua');
await C.p.locator(`svg.room .furn[data-i="${ri}"]`).first().click({ force: true }); await W(600);
check(/Dengar radio/.test(await C.p.locator('.menu').innerText().catch(() => '')), 'desktop: ketuk radio → menu "Dengar radio"');
await C.p.locator('.menu button:has-text("Dengar radio")').click();
t = await waitToast(C.p, /keroncong/);
check(/keroncong/.test(t), `desktop: aktivitas Dengar radio ("${t}")`);
await C.p.screenshot({ path: `${OUT}/ruang-mebel-1366.png` });

check(!errors.length, `tanpa galat halaman / 5xx${errors.length ? `: ${errors.join(' | ')}` : ''}`);
await b.close();
console.log(fails.length ? `\n${fails.length} GAGAL` : '\nSemua lulus');
process.exit(fails.length ? 1 : 0);
