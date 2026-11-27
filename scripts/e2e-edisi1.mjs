// Uji Edisi Spesial (paket konten 19) di Toko Mutiara:
// tab "✦ Edisi Spesial" tampil dengan spanduk, pita & pratinjau bergerak (HP 390 & 320, desktop 1366); hitung mundur
// bila admin memberi batas jual; item yang lewat batas hilang dari toko & ditolak server; beli dengan Mutiara (diberi
// admin); pasang lewat Atur (Tas › Pasang), putar 4× dan tetap tergambar dengan efeknya; efek benar-benar bergerak
// (animation-name bukan 'none', posisi berubah) dan diam dengan prefers-reduced-motion; aktivitas mebelnya berjalan;
// tidak ada galat halaman / 5xx. Jalankan server dulu dengan admin (ADMIN_EMAIL & ADMIN_PASSWORD), lalu:
// BASE_URL=http://localhost:8787 npm run test:e2e:edisi1
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, request } = require('playwright');
const BASE = (process.env.BASE_URL ?? 'http://localhost:8787').replace(/\/$/, ''), OUT = process.env.SHOTS ?? 'test-results/e2e-edisi1';
const ADMIN = { email: process.env.ADMIN_EMAIL ?? 'owner@bupi.test', password: process.env.ADMIN_PASSWORD ?? 'rahasia-sekali-123' };
mkdirSync(OUT, { recursive: true });
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [], errors = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'GAGAL'} ${msg}`); if (!ok) fails.push(msg); };

const EDISI = ['es-tabebuya', 'es-uburubur', 'es-kincir', 'es-airmancur', 'es-gramofon', 'es-lampulava', 'es-teleskop', 'es-wayanggolek', 'wp-aurora', 'fl-kolamkaca'];
const adm = await request.newContext({ baseURL: BASE });
check((await adm.post('/api/admin/login', { data: ADMIN })).ok(), 'admin masuk');
const cat = await (await adm.get('/api/catalog')).json();
const byId = Object.fromEntries(cat.items.map((i) => [i.id, i]));
// barang edisi lain yang sedang dijual di tab yang sama (mis. sahabat Edisi Natal paket 24, pita "✦ Edisi Natal")
const onSale = (i) => (!i.available_from || new Date(i.available_from).getTime() <= Date.now()) && (!i.available_to || new Date(i.available_to).getTime() > Date.now());
const OTHER = cat.items.filter((i) => i.shop === 'mutiara' && Number(i.data?.edisi) > 0 && !EDISI.includes(i.id) && onSale(i)).map((i) => i.name);
check(EDISI.every((id) => byId[id]?.data?.edisi === 1 && byId[id].price_pearl > 0 && byId[id].shop === 'mutiara'), 'katalog memuat 10 barang Edisi Spesial (Mutiara, Toko Mutiara)');
/** ubah item lewat admin (PUT memakai seluruh isian item) */
async function adminEdit(id, patch) {
  const it = (await (await adm.get('/api/admin/items')).json()).items.find((i) => i.id === id);
  return adm.put(`/api/admin/items/${id}`, { data: { ...it, ...patch } });
}
// mulai bersih (run sebelumnya bisa terhenti di tengah): tanpa batas jual
for (const id of EDISI) if (byId[id]?.available_to) await adminEdit(id, { available_to: null });
// batas jual: kincir dijual 3 hari lagi (hitung mundur di kartu)
const until = new Date(Date.now() + 3 * 86_400_000 + 3_600_000).toISOString();
check((await adminEdit('es-kincir', { available_to: until })).ok(), 'admin memberi batas jual Kincir Angin Bambu (3 hari)');

const b = await chromium.launch();
async function mk(name, vp, pearls, opts = {}) {
  const mobile = vp[0] < 900;
  // dpr 2: foto layar tajam untuk paket desain
  const ctx = await b.newContext({ viewport: { width: vp[0], height: vp[1] }, deviceScaleFactor: 2, hasTouch: mobile, isMobile: mobile, ...opts });
  await ctx.addInitScript(() => { try { localStorage.setItem('kb-save-snooze', String(Date.now() + 9e9)); localStorage.setItem('kb-push-asked', String(Date.now() + 9e9)); localStorage.setItem('kb-news-seen', '["*"]'); localStorage.setItem('kb-ajak', JSON.stringify({ day: new Date().toLocaleDateString('en-CA'), n: 9, last: Date.now(), nanti: 0, mute: true, alunAt: 0 })); } catch {} });
  await ctx.request.post(BASE + '/api/auth/guest', { data: {} });
  await ctx.request.post(BASE + '/api/pet', { data: { name, color: '#F6B7A8', ear: 'kucing' } });
  await ctx.request.post(BASE + '/api/daily', { data: {} });
  const me = await (await ctx.request.get(BASE + '/api/me')).json();
  if (pearls) check((await adm.post(`/api/admin/players/${me.user.id}/wallet`, { data: { currency: 'pearl', delta: pearls, reason: 'uji edisi spesial' } })).ok(), `${name}: admin memberi ${pearls} Mutiara`);
  const p = await ctx.newPage();
  watch(p, name);
  return { ctx, p, me, name, vp };
}
function watch(p, name) {
  p.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  p.on('response', (res) => { if (res.url().includes('/api/') && res.status() >= 500) errors.push(`${name}: ${res.status()} ${res.url()}`); });
}
const meOf = async (pl) => (await pl.ctx.request.get(BASE + '/api/me')).json();
const closeSheets = async (p) => { for (let i = 0; i < 3; i++) { const x = p.locator('.sheet .x'); if (await x.count()) { await x.first().click().catch(() => {}); await W(300); } } };
const home = async (p) => { await p.goto(`${BASE}/?r=${Math.random().toString(36).slice(2)}`); await p.waitForSelector('.dock', { timeout: 20000 }); await W(1200); await closeSheets(p); };
const toastText = async (p) => (await p.locator('.toast').allInnerTexts().catch(() => [])).join(' | ');
/** keadaan animasi satu elemen: nama animasi, jumlah yang berjalan, posisi (translate) sekarang */
const anim = (p, sel) => p.evaluate((s) => {
  const e = document.querySelector(s);
  if (!e) return null;
  const cs = getComputedStyle(e);
  return { name: cs.animationName, running: e.getAnimations().filter((a) => a.playState === 'running').length, pos: `${cs.translate}|${cs.rotate}|${cs.opacity}` };
}, sel);
/** efek benar-benar bergerak: animasi berjalan dan posisinya berubah */
async function moving(p, sel) {
  const a = await anim(p, sel); await W(450); const c = await anim(p, sel);
  return !!a && a.name !== 'none' && a.running > 0 && a.pos !== c?.pos;
}

/** buka Toko Mutiara dari peta, lalu tab Edisi Spesial */
async function openEdisi(p) {
  await p.goto(`${BASE}/?r=m${Math.random().toString(36).slice(2)}#map`); await p.waitForSelector('.loc[data-loc="mutiara"]', { timeout: 20000 }); await W(800); await closeSheets(p);
  await p.locator('.loc[data-loc="mutiara"]').dispatchEvent('click');
  await p.waitForSelector('.tabbar button.edtab', { timeout: 20000 }); await W(400);
  await p.click('.tabbar button.edtab'); await W(700);
}
async function checkEdisiTab(pl, tag, n = 10) {
  const p = pl.p;
  const tab = await p.locator('.tabbar button.edtab').innerText();
  check(/✦ Edisi Spesial/.test(tab) && (await p.locator('.tabbar button.edtab.on').count()) === 1, `${tag}: tab "${tab.replace(/\n/g, ' ')}" tampil & aktif`);
  check(/Edisi Spesial/.test(await p.locator('.edban').innerText().catch(() => '')), `${tag}: spanduk Edisi Spesial tampil`);
  const cards = await p.evaluate(() => [...document.querySelectorAll('.grid .card')].map((c) => {
    const rib = c.querySelector('.ribbon')?.getBoundingClientRect(), bad = c.querySelector('.badge')?.getBoundingClientRect(), r = c.getBoundingClientRect();
    return { name: c.querySelector('.name')?.textContent, edisi: c.classList.contains('edisi'), ribbon: c.querySelector('.ribbon')?.textContent ?? '', sub: c.querySelector('.sub')?.textContent ?? '', cd: c.querySelector('.cd')?.textContent ?? '',
      inside: r.left >= -1 && r.right <= innerWidth + 1 && (!rib || rib.left >= -1), clash: !!(rib && bad && rib.right > bad.left - 1 && rib.bottom > bad.top && rib.top < bad.bottom), live: !!c.querySelector('.ic.edfx') };
  }));
  const mine = cards.filter((c) => !OTHER.includes(c.name));
  check(mine.length === n && cards.length === n + OTHER.length && cards.every((c) => c.edisi && c.live) && mine.every((c) => c.ribbon === '✦ Edisi Spesial'), `${tag}: ${mine.length} kartu Edisi Spesial dengan pita "✦ Edisi Spesial" & pratinjau .edfx${OTHER.length ? ` (+ ${OTHER.length} edisi lain: ${OTHER.join(', ')})` : ''}`);
  check(cards.every((c) => /✦/.test(c.sub)), `${tag}: kartu menyebut efeknya (${cards[0]?.sub})`);
  check(cards.every((c) => c.inside && !c.clash), `${tag}: kartu di dalam layar, pita tidak bertumpuk dengan lencana`);
  return mine;
}

/** foto kartu-kartu: panel digulir sampai spanduk di atas */
async function shotCards(p, file) {
  await p.locator('.edban').evaluate((e) => e.scrollIntoView({ block: 'start' })); await W(500);
  await p.screenshot({ path: `${OUT}/${file}` });
  await p.locator('.panel').evaluate((e) => e.scrollTo(0, 0)); await W(200);
}

/* ---------------- HP 390: tab, beli tabebuya, pasang lewat Atur, putar 4×, efek bergerak, aktivitas ---------------- */
const A = await mk('Mekar', [390, 844], 100);
await openEdisi(A.p);
let cards = await checkEdisiTab(A, 'HP 390');
check(/Sisa 3 hari/.test(cards.find((c) => c.name === 'Kincir Angin Bambu')?.cd ?? ''), `HP 390: hitung mundur di kartu kincir ("${cards.find((c) => c.name === 'Kincir Angin Bambu')?.cd}")`);
check(cards.filter((c) => c.cd).length === 1, 'HP 390: barang tanpa batas jual tidak punya hitung mundur');
check(await moving(A.p, '.grid .card.edisi .ic .ed-fall'), 'HP 390: pratinjau tabebuya di kartu bergerak (kelopak jatuh)');
check(await moving(A.p, '.grid .card.edisi .ic .ed-spin'), 'HP 390: pratinjau kincir berputar');
check((await anim(A.p, '.scene .ed-fall'))?.running > 0, 'HP 390: etalase memajang barang Edisi Spesial yang bergerak');
await A.p.screenshot({ path: `${OUT}/toko-edisi-390.png` });
await shotCards(A.p, 'toko-edisi-kartu-390.png');
// beli Pohon Tabebuya Mekar (ketuk harga → Yakin? → beli)
const pearl0 = (await meOf(A)).wallet.pearl;
const tcard = A.p.locator('.grid .card:has(.name:text-is("Pohon Tabebuya Mekar"))');
await tcard.locator('.acts .btn').click(); await W(300);
check(/Yakin/.test(await tcard.locator('.acts .btn').innerText()), 'ketuk harga: minta konfirmasi');
await tcard.locator('.acts .btn').click();
let bought = '';
for (let i = 0; i < 20 && !/masuk Tas/.test(bought); i++) { await W(150); bought = await toastText(A.p); }
await W(800);
let me = await meOf(A);
check(me.wallet.pearl === pearl0 - byId['es-tabebuya'].price_pearl && (me.inventory?.['es-tabebuya'] ?? 0) === 1, `beli tabebuya: Mutiara ${pearl0} → ${me.wallet.pearl}, masuk Tas`);
check(/Pohon Tabebuya Mekar masuk Tas\. Pasang lewat Atur/.test(bought), `pesan beli menyebut barang & cara melihat efeknya ("${bought}")`);
check(/×1/.test(await tcard.innerText()), 'kartu menandai sudah punya (×1)');
await A.p.screenshot({ path: `${OUT}/toko-edisi-dibeli-390.png` });
// pasang lewat Atur › Tas › Pasang
await home(A.p);
await A.p.click('.btn.act:has-text("Atur")'); await W(700);
await A.p.locator('.editbar .btn', { hasText: /^\s*Tas\s*$/ }).click(); await A.p.waitForSelector('.sheet .card'); await W(300);
await A.p.locator('.sheet .tabbar button:has-text("Mebel")').click().catch(() => {}); await W(200);
const bagCard = A.p.locator('.sheet .card:has(.name:text-is("Pohon Tabebuya Mekar"))');
check((await bagCard.locator('.ribbon').innerText().catch(() => '')) === '✦ Edisi Spesial', 'Tas: kartu tabebuya berpita Edisi Spesial');
await bagCard.locator('.btn:has-text("Pasang")').click(); await W(600);
check(/dipilih/.test(await A.p.locator('.editbar p').innerText()), 'Atur: tabebuya dipasang dari Tas & terpilih');
/** arah yang tergambar: 0 awal, 1 dicerminkan, 2 tampak belakang, 3 belakang dicerminkan; + jumlah efek di mebel terpilih */
const selState = (p) => p.evaluate(() => { const g = document.querySelector('svg.room .furn.sel'); return g ? { dir: (g.querySelector('.back') ? 2 : 0) + (g.querySelector('.rot') ? 1 : 0), fx: g.querySelectorAll('.ed-fall').length, canopy: g.querySelectorAll('.canopy').length } : null; });
let st = await selState(A.p);
check(st?.dir === 0 && st.fx === 6, `arah awal, 6 kelopak berguguran (${JSON.stringify(st)})`);
const dirs = [];
for (let k = 1; k <= 4; k++) {
  await A.p.click('.editbar .rotbtn'); await W(350);
  st = await selState(A.p);
  dirs.push(st?.dir);
  check(st?.dir === k % 4 && st.fx === 6 && st.canopy === 1, `Putar ${k}×: arah ${st?.dir}, tajuk & 6 kelopak tetap tergambar`);
  if (k === 2) await A.p.screenshot({ path: `${OUT}/atur-putar2-390.png` });
}
await A.p.click('.editbar .rotbtn'); await W(300); // simpan menghadap 1× putar
await A.p.click('.editbar .btn:has-text("Selesai")'); await W(1200);
me = await meOf(A);
let lay = (me.rooms ?? [me.room])[0].layout;
const ti = lay.findIndex((q) => q.i === 'es-tabebuya');
check(ti >= 0 && lay[ti].r === 1, `Selesai: tabebuya tersimpan (arah ${lay[ti]?.r})`);
await home(A.p);
const fsel = `svg.room .furn[data-i="${ti}"] .ed-fall`;
const fa = await anim(A.p, fsel);
check(fa?.name === 'ed-fall' && fa.running > 0, `di rumah: kelopak beranimasi (animation-name ${fa?.name})`);
check(await moving(A.p, fsel), 'di rumah: kelopak benar-benar bergerak');
await A.p.screenshot({ path: `${OUT}/ruang-efek-390.png` });
// aktivitas: tangkap kelopak
await A.p.locator(`svg.room .furn[data-i="${ti}"]`).first().click({ force: true }); await W(600);
const menuTxt = await A.p.locator('.menu').innerText().catch(() => '');
check(/Tangkap kelopak/.test(menuTxt), `ketuk tabebuya: menu aktivitas ("${menuTxt.replace(/\n/g, ' ')}")`);
await A.p.locator('.menu button:has-text("Tangkap kelopak")').click();
let done = '';
for (let i = 0; i < 30 && !/menangkap kelopak/.test(done); i++) { await W(400); done = await toastText(A.p); }
check(/menangkap kelopak/.test(done), `aktivitas berjalan ("${done}")`);
await A.p.screenshot({ path: `${OUT}/aktivitas-390.png` });

// prefers-reduced-motion: pemain yang sama, efek diam (frame dasar tetap terlihat)
const R = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, reducedMotion: 'reduce', storageState: await A.ctx.storageState() });
const rp = await R.newPage();
watch(rp, 'Mekar (reduce)');
await home(rp);
const ra = await anim(rp, fsel);
check(!!ra && ra.name === 'none' && ra.running === 0, `reduced-motion: kelopak diam (animation-name ${ra?.name}, berjalan ${ra?.running})`);
check(!(await moving(rp, fsel)) && (await rp.locator(fsel).count()) === 6, 'reduced-motion: posisi tidak berubah, 6 kelopak tetap tergambar');
await rp.screenshot({ path: `${OUT}/ruang-diam-reduce-390.png` });
await openEdisi(rp);
const rc = await anim(rp, '.grid .card.edisi .ic .ed-spin');
check(rc?.name === 'none' && rc.running === 0, 'reduced-motion: pratinjau di kartu toko juga diam');
await R.close();

// Pengaturan › Kurangi animasi (pilihan di game, HP tidak diatur): efek diam, tersimpan setelah muat ulang, bisa dinyalakan lagi
await A.p.goto(`${BASE}/?r=km#akun`); await A.p.waitForSelector('.sheet', { timeout: 20000 }); await W(600);
const km = A.p.locator('.sheet label.tg:has-text("Kurangi animasi") input');
check(await km.count() === 1 && !(await km.isChecked()), 'Pengaturan: pilihan "Kurangi animasi" ada (mati bawaan)');
await km.check(); await W(300);
check(await A.p.evaluate(() => document.documentElement.classList.contains('reduce-motion')), 'Kurangi animasi: <html> dapat kelas reduce-motion');
await home(A.p);
const ka = await anim(A.p, fsel);
check(!!ka && ka.name === 'none' && ka.running === 0, `Kurangi animasi (setelah muat ulang): kelopak diam (animation-name ${ka?.name})`);
check((await A.p.locator(fsel).count()) === 6, 'Kurangi animasi: kelopak tetap tergambar');
await A.p.goto(`${BASE}/?r=km2#akun`); await A.p.waitForSelector('.sheet', { timeout: 20000 }); await W(600);
await A.p.locator('.sheet label.tg:has-text("Kurangi animasi") input').uncheck(); await W(300);
await home(A.p);
check(await moving(A.p, fsel), 'Kurangi animasi dimatikan: kelopak bergerak lagi');

/* ---------------- HP 320: tab, hitung mundur, beli lampu lava, lewat batas jual ---------------- */
const B = await mk('Lava', [320, 640], 40);
const pearlB = (await meOf(B)).wallet.pearl;
await openEdisi(B.p);
cards = await checkEdisiTab(B, 'HP 320');
await B.p.screenshot({ path: `${OUT}/toko-edisi-320.png` });
await shotCards(B.p, 'toko-edisi-kartu-320.png');
const lcard = B.p.locator('.grid .card:has(.name:text-is("Lampu Lava Pelangi"))');
await lcard.scrollIntoViewIfNeeded();
await lcard.locator('.acts .btn').click(); await W(300); await lcard.locator('.acts .btn').click(); await W(1500);
me = await meOf(B);
check((me.inventory?.['es-lampulava'] ?? 0) === 1 && me.wallet.pearl === pearlB - byId['es-lampulava'].price_pearl, `HP 320: beli Lampu Lava Pelangi lewat toko (${pearlB} → ${me.wallet.pearl} Mutiara)`);
// wayang golek lewat batas jual: hilang dari toko, server menolak pembelian
check((await adminEdit('es-wayanggolek', { available_to: new Date(Date.now() - 60_000).toISOString() })).ok(), 'admin: batas jual Wayang Golek sudah lewat');
await W(400);
await openEdisi(B.p);
cards = await B.p.evaluate(() => [...document.querySelectorAll('.grid .card .name')].map((n) => n.textContent));
check(cards.length === 9 + OTHER.length && !cards.includes('Wayang Golek Menari'), `HP 320: barang lewat batas tidak tampil (${cards.length} kartu)`);
const nb = await B.ctx.request.post(BASE + '/api/shop/buy', { data: { itemId: 'es-wayanggolek', currency: 'pearl' } });
check(nb.status() === 400 && (await nb.json()).error?.code === 'not_for_sale', `HP 320: server menolak beli barang lewat batas (${nb.status()})`);
check((await adminEdit('es-wayanggolek', { available_to: null })).ok(), 'admin: batas jual Wayang Golek dihapus lagi');
// pasang lampu lava lewat API, di rumah efek bergerak
let room = (me.rooms ?? [me.room])[0];
let r = await B.ctx.request.post(BASE + '/api/room', { data: { roomId: room.id || undefined, version: room.version, layout: [...room.layout, { i: 'es-lampulava', x: 1, y: 0, r: 2 }] } });
check(r.ok(), 'HP 320: lampu lava dipasang membelakangi kamera');
await home(B.p);
me = await meOf(B);
const li = (me.rooms ?? [me.room])[0].layout.findIndex((q) => q.i === 'es-lampulava');
check(await moving(B.p, `svg.room .furn[data-i="${li}"] .ed-blob`), 'HP 320: gumpalan lava bergerak (tampak belakang)');
await B.p.screenshot({ path: `${OUT}/ruang-efek-320.png` });

/* ---------------- desktop 1366: tab, beli akuarium, kamar Edisi Spesial lengkap ---------------- */
const C = await mk('Ubur', [1366, 820], 200);
await openEdisi(C.p);
cards = await checkEdisiTab(C, 'desktop 1366');
await C.p.screenshot({ path: `${OUT}/toko-edisi-1366.png` });
const acard = C.p.locator('.grid .card:has(.name:text-is("Akuarium Ubur-ubur Bercahaya"))');
await acard.scrollIntoViewIfNeeded();
await acard.locator('.acts .btn').click(); await W(300); await acard.locator('.acts .btn').click(); await W(1500);
me = await meOf(C);
check((me.inventory?.['es-uburubur'] ?? 0) === 1, 'desktop: beli Akuarium Ubur-ubur lewat toko');
for (const id of ['es-gramofon', 'es-teleskop', 'es-kincir', 'wp-aurora', 'fl-kolamkaca']) {
  r = await C.ctx.request.post(BASE + '/api/shop/buy', { data: { itemId: id, currency: 'pearl' } });
  check(r.ok(), `desktop: beli ${id} lewat API`);
}
me = await meOf(C); room = (me.rooms ?? [me.room])[0];
// kamar awal: kasur (4,0), karpet (2,2) datar, pot (0,4)
r = await C.ctx.request.post(BASE + '/api/room', { data: { roomId: room.id || undefined, version: room.version, wall: 'wp-aurora', floor: 'fl-kolamkaca',
  layout: [...room.layout, { i: 'es-uburubur', x: 1, y: 0 }, { i: 'es-gramofon', x: 0, y: 1, r: 1 }, { i: 'es-teleskop', x: 5, y: 2 }, { i: 'es-kincir', x: 0, y: 2, r: 2 }] } });
check(r.ok(), 'desktop: kamar Edisi Spesial tersimpan (dinding aurora, lantai kolam kaca)');
await home(C.p);
for (const [cls, what] of [['ed-bob', 'ubur-ubur'], ['ed-spin', 'baling-baling & piringan'], ['ed-twinkle', 'bintang'], ['ed-aurora', 'aurora di dinding'], ['ed-swim', 'ikan di lantai']]) {
  check(await moving(C.p, `svg.room .${cls}`), `desktop: ${what} bergerak (${cls})`);
}
await C.p.screenshot({ path: `${OUT}/ruang-efek-1366.png` });
// musik di gramofon
const gi = (await meOf(C)).rooms[0].layout.findIndex((q) => q.i === 'es-gramofon');
await C.p.locator(`svg.room .furn[data-i="${gi}"]`).first().click({ force: true }); await W(500);
check(/Putar piringan hitam/.test(await C.p.locator('.menu').innerText().catch(() => '')), 'desktop: ketuk gramofon → menu "Putar piringan hitam"');
await C.p.keyboard.press('Escape').catch(() => {});

check((await adminEdit('es-kincir', { available_to: null })).ok(), 'admin: batas jual kincir dikembalikan (tanpa batas)');
check(!errors.length, `tanpa galat halaman / 5xx${errors.length ? `: ${errors.join(' | ')}` : ''}`);
await b.close();
console.log(fails.length ? `\n${fails.length} GAGAL` : '\nSemua lulus');
process.exit(fails.length ? 1 : 0);
