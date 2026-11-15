// Uji 3 set premium baru (paket konten 17: Dapur Nenek, Sanggar Seni, Spa Bali):
// Toko Mutiara › tab Set menampilkan ketiga set dengan harga paket yang benar; beli paket dengan Mutiara (diberi admin);
// pasang mebelnya lewat Atur (Tas › Pasang, Putar, Selesai) & dinding set dari Tas; label suasana muncul dengan ≥ 3 item set;
// aktivitas baru (goreng pisang di tungku) berjalan; foto layar tab Set & ruangan berperabot di HP 390 & 320 dan desktop 1366.
// Jalankan server dulu dengan admin (ADMIN_EMAIL & ADMIN_PASSWORD), lalu: BASE_URL=http://localhost:8787 npm run test:e2e:premium2
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, request } = require('playwright');
const BASE = (process.env.BASE_URL ?? 'http://localhost:8787').replace(/\/$/, ''), OUT = process.env.SHOTS ?? 'test-results/e2e-premium2';
const ADMIN = { email: process.env.ADMIN_EMAIL ?? 'owner@bupi.test', password: process.env.ADMIN_PASSWORD ?? 'rahasia-sekali-123' };
mkdirSync(OUT, { recursive: true });
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [], errors = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'GAGAL'} ${msg}`); if (!ok) fails.push(msg); };

const SETS = { dapurnenek: 'Set Dapur Nenek', sanggar: 'Set Sanggar Seni', spabali: 'Set Spa Bali' };
const adm = await request.newContext({ baseURL: BASE });
check((await adm.post('/api/admin/login', { data: ADMIN })).ok(), 'admin masuk');
const cat = await (await adm.get('/api/catalog')).json();
const price = Object.fromEntries(cat.items.map((i) => [i.id, i.price_pearl]));
const disc = Number(cat.settings?.premium?.bundleDiscount ?? 20);
const SET_ITEMS = {
  dapurnenek: ['dn-tungku', 'dn-rakpiring', 'dn-gentong', 'dn-mejamakan', 'dn-petromaks', 'wp-gedek'],
  sanggar: ['sg-angklung', 'sg-kecapi', 'sg-kelir', 'sg-membatik', 'sg-kendang', 'fl-papanjati'],
  spabali: ['sp-bakkayu', 'sp-pancuran', 'sp-kamboja', 'sp-rakhanduk', 'sp-lilin', 'fl-batukali'],
};
const bundle = (key) => Math.round(SET_ITEMS[key].reduce((a, id) => a + (price[id] ?? 0), 0) * (1 - disc / 100));
check(Object.values(SET_ITEMS).flat().every((id) => price[id] > 0), 'katalog memuat 18 item set baru dengan harga Mutiara');

const b = await chromium.launch();
async function mk(name, vp, pearls) {
  const mobile = vp[0] < 900;
  const ctx = await b.newContext({ viewport: { width: vp[0], height: vp[1] }, hasTouch: mobile, isMobile: mobile });
  await ctx.addInitScript(() => { try { localStorage.setItem('kb-save-snooze', String(Date.now() + 9e9)); localStorage.setItem('kb-push-asked', String(Date.now() + 9e9)); localStorage.setItem('kb-news-seen', '["*"]'); localStorage.setItem('kb-ajak', JSON.stringify({ day: new Date().toLocaleDateString('en-CA'), n: 9, last: Date.now(), nanti: 0, mute: true, alunAt: 0 })); } catch {} });
  await ctx.request.post(BASE + '/api/auth/guest', { data: {} });
  await ctx.request.post(BASE + '/api/pet', { data: { name, color: '#F6B7A8', ear: 'kucing' } });
  await ctx.request.post(BASE + '/api/daily', { data: {} });
  const me = await (await ctx.request.get(BASE + '/api/me')).json();
  check((await adm.post(`/api/admin/players/${me.user.id}/wallet`, { data: { currency: 'pearl', delta: pearls, reason: 'uji set premium 2' } })).ok(), `${name}: admin memberi ${pearls} Mutiara`);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  p.on('response', (res) => { if (res.url().includes('/api/') && res.status() >= 500) errors.push(`${name}: ${res.status()} ${res.url()}`); });
  return { ctx, p, me, name, vp };
}
const meOf = async (pl) => (await pl.ctx.request.get(BASE + '/api/me')).json();
const closeSheets = async (p) => { for (let i = 0; i < 3; i++) { const x = p.locator('.sheet .x'); if (await x.count()) { await x.first().click().catch(() => {}); await W(300); } } };
const home = async (pl) => { await pl.p.goto(`${BASE}/?r=${Math.random().toString(36).slice(2)}`); await pl.p.waitForSelector('.dock', { timeout: 20000 }); await W(1200); await closeSheets(pl.p); };
const toastText = async (p) => (await p.locator('.toast').allInnerTexts().catch(() => [])).join(' | ');

/** buka Toko Mutiara dari peta, lalu tab Set */
async function openSetTab(pl) {
  await pl.p.goto(`${BASE}/?r=m#map`); await pl.p.waitForSelector('.loc[data-loc="mutiara"]', { timeout: 20000 }); await W(800); await closeSheets(pl.p);
  await pl.p.locator('.loc[data-loc="mutiara"]').dispatchEvent('click');
  await pl.p.waitForSelector('.tabbar button:has-text("Set")', { timeout: 20000 }); await W(400);
  await pl.p.click('.tabbar button:has-text("Set")'); await W(500);
}
/** kartu set: nama, harga paket di tombol, harga coret, dimiliki */
const setCards = (p) => p.evaluate(() => [...document.querySelectorAll('.set')].map((c) => {
  const btn = c.querySelector('.sbuy'), s = btn?.querySelector('s')?.textContent ?? '';
  const txt = (btn?.textContent ?? '').replace(s, '').trim();
  return { name: c.querySelector('.sh b')?.textContent ?? '', price: Number((txt.match(/(\d+)\s*$/) ?? [])[1] ?? NaN), was: Number(s || NaN), icons: c.querySelectorAll('.sicons span').length, bonus: c.querySelector('.sb')?.textContent ?? '', owned: c.querySelector('.sh span')?.textContent ?? '' };
}));
async function checkSetTab(pl, tag) {
  const cards = await setCards(pl.p);
  check(cards.length >= 8, `${tag}: tab Set menampilkan ${cards.length} set`);
  for (const [key, name] of Object.entries(SETS)) {
    const c = cards.find((x) => x.name === name);
    check(!!c && c.price === bundle(key) && c.icons === 6 && /Suasana/.test(c.bonus), `${tag}: ${name} tampil, 6 ikon, harga paket ${c?.price} = ${bundle(key)} Mutiara (coret ${c?.was})`);
  }
  // tombol paket tidak keluar layar
  const off = await pl.p.evaluate(() => [...document.querySelectorAll('.set .sbuy')].some((e) => { const r = e.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1; }));
  check(!off, `${tag}: tombol paket di dalam layar`);
}
const shotSet = async (pl, file) => {
  await pl.p.locator('.set:has-text("Set Dapur Nenek")').scrollIntoViewIfNeeded(); await W(300);
  await pl.p.screenshot({ path: `${OUT}/${file}` });
};
const moodText = (p) => p.evaluate(() => [...document.querySelectorAll('svg.room .mood-label text')].map((t) => t.textContent).join(' | '));

/* ---------------- HP 390: beli Set Dapur Nenek lewat toko, pasang lewat Atur, dinding dari Tas, aktivitas ---------------- */
const A = await mk('Mochi', [390, 844], 150);
await openSetTab(A);
await checkSetTab(A, 'HP 390');
await shotSet(A, 'toko-set-390.png');
const pearl0 = (await meOf(A)).wallet.pearl;
const card = A.p.locator('.set:has-text("Set Dapur Nenek")');
await card.locator('.sbuy').click(); await W(300);
check(/Yakin/.test(await card.locator('.sbuy').innerText()), 'ketuk paket: minta konfirmasi');
await card.locator('.sbuy').click(); await W(1500);
let me = await meOf(A);
check(me.wallet.pearl === pearl0 - bundle('dapurnenek'), `beli paket: Mutiara ${me.wallet.pearl} = ${pearl0} − ${bundle('dapurnenek')}`);
check(SET_ITEMS.dapurnenek.every((id) => (me.inventory?.[id] ?? 0) >= 1), 'keenam item Dapur Nenek masuk Tas');
check(/Set lengkap/.test(await card.innerText()), 'kartu set berubah jadi "Set lengkap"');
await A.p.screenshot({ path: `${OUT}/toko-set-dibeli-390.png` });

await home(A);
await A.p.click('.btn.act:has-text("Atur")'); await W(700);
for (const nm of ['Tungku Tanah Liat', 'Gentong Air', 'Meja Makan & Bangku Panjang']) {
  await A.p.locator('.editbar .btn', { hasText: /^\s*Tas\s*$/ }).click(); await A.p.waitForSelector('.sheet .card'); await W(300);
  await A.p.locator('.sheet .tabbar button:has-text("Mebel")').click().catch(() => {}); await W(200);
  await A.p.locator(`.sheet .card:has(.name:text-is("${nm}")) .btn:has-text("Pasang")`).click(); await W(500);
  check(/dipilih/.test(await A.p.locator('.editbar p').innerText()), `Atur: ${nm} dipasang dari Tas & terpilih`);
}
// meja makan diputar sekali
await A.p.click('.editbar .rotbtn'); await W(300);
await A.p.screenshot({ path: `${OUT}/atur-390.png` });
await A.p.click('.editbar .btn:has-text("Selesai")'); await W(1200);
me = await meOf(A);
let lay = (me.rooms ?? [me.room])[0].layout;
check(['dn-tungku', 'dn-gentong', 'dn-mejamakan'].every((id) => lay.some((q) => q.i === id)), 'Selesai: tiga mebel set tersimpan di kamar');
check(lay.find((q) => q.i === 'dn-mejamakan')?.r === 1, 'meja makan tersimpan diputar (r: 1)');
let mood = await moodText(A.p);
check(/Suasana Dapur Nenek/.test(mood), `label suasana muncul dengan 3 item set ("${mood}")`);
// dinding gedek dari Tas › Dekor
await A.p.goto(`${BASE}/?r=t#bag`); await A.p.waitForSelector('.sheet .tabbar'); await W(500);
await A.p.click('.sheet .tabbar button:has-text("Dekor")'); await W(300);
await A.p.locator('.sheet .card:has(.name:text-is("Dinding Anyaman Bambu")) .btn').click(); await W(1200);
me = await meOf(A);
check((me.rooms ?? [me.room])[0].wall === 'wp-gedek', 'dinding anyaman bambu terpasang');
await home(A);
mood = await moodText(A.p);
check(/Suasana Dapur Nenek/.test(mood), 'label suasana tetap ada setelah muat ulang (4 item set)');
check(await A.p.locator('svg.room .moods .blink').count() > 4, 'efek suasana (bara & asap) digambar');
await A.p.screenshot({ path: `${OUT}/ruang-set-390.png` });
// aktivitas baru: goreng pisang di tungku
me = await meOf(A);
lay = (me.rooms ?? [me.room])[0].layout;
const ti = lay.findIndex((q) => q.i === 'dn-tungku');
await A.p.locator(`svg.room .furn[data-i="${ti}"]`).first().click({ force: true }); await W(600);
const menuTxt = await A.p.locator('.menu').innerText().catch(() => '');
check(/Goreng pisang/.test(menuTxt), `ketuk tungku: menu aktivitas ("${menuTxt.replace(/\n/g, ' ')}")`);
const pisang0 = me.inventory?.['pisang-goreng'] ?? 0;
await A.p.locator('.menu button:has-text("Goreng pisang")').click();
let done = '';
for (let i = 0; i < 30 && !/menggoreng pisang/.test(done); i++) { await W(400); done = await toastText(A.p); }
check(/menggoreng pisang/.test(done), `aktivitas berjalan ("${done}")`);
await A.p.screenshot({ path: `${OUT}/aktivitas-390.png` });
me = await meOf(A);
check((me.inventory?.['pisang-goreng'] ?? 0) === pisang0 + 1, 'hadiah aktivitas: pisang goreng masuk Tas');

/* ---------------- HP 320: Set Spa Bali ---------------- */
const B = await mk('Putu', [320, 640], 100);
const pearlB = (await meOf(B)).wallet.pearl;
await openSetTab(B);
await checkSetTab(B, 'HP 320');
await shotSet(B, 'toko-set-320.png');
const bc = B.p.locator('.set:has-text("Set Spa Bali")');
await bc.scrollIntoViewIfNeeded(); await bc.locator('.sbuy').click(); await W(300); await bc.locator('.sbuy').click(); await W(1500);
me = await meOf(B);
check(me.wallet.pearl === pearlB - bundle('spabali'), `HP 320: beli Spa Bali lewat toko (${pearlB} → ${me.wallet.pearl} Mutiara)`);
let room = (me.rooms ?? [me.room])[0];
// kamar awal: kasur (4,0), karpet (2,2) datar, pot (0,4)
let r = await B.ctx.request.post(BASE + '/api/room', { data: { roomId: room.id || undefined, version: room.version, floor: 'fl-batukali', layout: [...room.layout, { i: 'sp-kamboja', x: 0, y: 0 }, { i: 'sp-pancuran', x: 1, y: 0 }, { i: 'sp-rakhanduk', x: 0, y: 2, r: 1 }, { i: 'sp-bakkayu', x: 3, y: 2, r: 1 }, { i: 'sp-lilin', x: 1, y: 3, r: 2 }] } });
check(r.ok(), 'HP 320: kamar spa tersimpan (diputar & membelakangi)');
await home(B);
check(/Suasana Spa Bali/.test(await moodText(B.p)), 'HP 320: label Suasana Spa Bali');
check(await B.p.locator('svg.room .back').count() >= 1, 'HP 320: lilin aroma digambar membelakangi kamera');
await B.p.screenshot({ path: `${OUT}/ruang-set-320.png` });

/* ---------------- desktop 1366: Set Sanggar Seni ---------------- */
const C = await mk('Klepon', [1366, 820], 100);
await openSetTab(C);
await checkSetTab(C, 'desktop 1366');
await shotSet(C, 'toko-set-1366.png');
r = await C.ctx.request.post(BASE + '/api/shop/bundle', { data: { set: 'sanggar', price: bundle('sanggar') } });
check(r.ok(), `desktop: beli paket Sanggar Seni lewat API (${bundle('sanggar')} Mutiara)`);
me = await meOf(C); room = (me.rooms ?? [me.room])[0];
r = await C.ctx.request.post(BASE + '/api/room', { data: { roomId: room.id || undefined, version: room.version, floor: 'fl-papanjati', layout: [...room.layout, { i: 'sg-kelir', x: 0, y: 1, r: 1 }, { i: 'sg-angklung', x: 2, y: 0 }, { i: 'sg-kecapi', x: 2, y: 4 }, { i: 'sg-membatik', x: 4, y: 2 }, { i: 'sg-kendang', x: 1, y: 3, r: 3 }] } });
check(r.ok(), 'desktop: kamar sanggar tersimpan');
await home(C);
check(/Suasana Sanggar Seni/.test(await moodText(C.p)), 'desktop: label Suasana Sanggar Seni');
await C.p.screenshot({ path: `${OUT}/ruang-set-1366.png` });
// musik di kecapi
me = await meOf(C);
const ki = (me.rooms ?? [me.room])[0].layout.findIndex((q) => q.i === 'sg-kecapi');
await C.p.locator(`svg.room .furn[data-i="${ki}"]`).first().click({ force: true }); await W(500);
check(/Petik kecapi/.test(await C.p.locator('.menu').innerText().catch(() => '')), 'desktop: ketuk kecapi → menu "Petik kecapi"');
await C.p.keyboard.press('Escape').catch(() => {});

check(!errors.length, `tanpa galat halaman / 5xx${errors.length ? `: ${errors.join(' | ')}` : ''}`);
await b.close();
console.log(fails.length ? `\n${fails.length} GAGAL` : '\nSemua lulus');
process.exit(fails.length ? 1 : 0);
