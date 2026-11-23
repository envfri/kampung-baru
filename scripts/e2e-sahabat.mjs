// Uji Sahabat Mungil (paket konten 23) di HP 390, HP 320 (animasi dikurangi) & desktop 1366:
// anak ayam pertama menunggu di depan pintu (gelembung, bukan dialog yang menghalangi) → ketuk → lembar beri nama →
// sahabat mengikuti pet di rumah; oleh-oleh harian; ketuk = trik; Akrab: duduk di kepala pet saat tidur; Pondok Sahabat
// di peta (lencana BARU, sahabat ikut berjalan di peta, jalan-jalan dihitung sekali sehari); panel Pondok (Camilan
// Sahabat, adopsi koin & Mutiara), Sahabatku (camilan, warna kerang, nama, ajak), Album (siluet + petunjuk); Toko
// Mutiara menjual sahabat Mutiara (jalur beli yang sama, "Yakin?"); sahabat yang istirahat di rumah (paling banyak 3);
// burung pipit di Halaman; kunang-kunang malam hari; kura-kura dari Kolam Pancing (API); kunjungan teman (sahabat tuan
// rumah, sahabat tamu, sahabat istirahat), kartu profil, alun-alun, foto Jepret. Tidak ada galat halaman / 5xx.
// Jalankan server dulu dengan admin (ADMIN_EMAIL & ADMIN_PASSWORD), lalu: BASE_URL=http://localhost:8787 npm run test:e2e:sahabat
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, request } = require('playwright');
const BASE = (process.env.BASE_URL ?? 'http://localhost:8787').replace(/\/$/, ''), OUT = process.env.SHOTS ?? 'test-results/e2e-sahabat';
const ADMIN = { email: process.env.ADMIN_EMAIL ?? 'owner@bupi.test', password: process.env.ADMIN_PASSWORD ?? 'rahasia-sekali-123' };
mkdirSync(OUT, { recursive: true });
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [], errors = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'GAGAL'} ${msg}`); if (!ok) fails.push(msg); };

// zona waktu dengan jam setempat ±12 siang & ±21 malam (langit rumah mengikuti jam pemain)
const utcH = new Date().getUTCHours();
const tzAt = (h) => { const off = ((h - utcH + 36) % 24) - 12; return off === 0 ? 'Etc/UTC' : off > 0 ? `Etc/GMT-${off}` : `Etc/GMT+${-off}`; };
const DAY_TZ = tzAt(12), NIGHT_TZ = tzAt(21);

const adm = await request.newContext({ baseURL: BASE });
check((await adm.post('/api/admin/login', { data: ADMIN })).ok(), 'admin masuk');
const cat = await (await adm.get('/api/catalog')).json();
const byId = Object.fromEntries(cat.items.map((i) => [i.id, i]));
const SP = ['ayam', 'umang', 'bebek', 'kura', 'pipit', 'kunang', 'kelinci', 'hamster', 'landak'];
check(SP.every((sp) => byId[`sahabat-${sp}`]?.kind === 'sahabat'), 'katalog: 9 sahabat (item jenis sahabat)');
check(byId['sahabat-umang']?.price_coin === 250 && byId['sahabat-bebek']?.price_coin === 400 && byId['sahabat-kelinci']?.price_pearl === 12 && byId['sahabat-landak']?.price_pearl === 15, 'katalog: harga bawaan (umang 250, bebek 400 koin; kelinci 12, landak 15 Mutiara)');
check(byId['camilan-sahabat']?.price_coin === 5, 'katalog: Camilan Sahabat 5 koin');
check(cat.locations.some((l) => l.id === 'pondok' && l.kind === 'sahabat'), 'peta: Pondok Sahabat');
const before = (await (await adm.get('/api/admin/settings')).json()).value;
const putSahabat = async (k) => (await adm.put('/api/admin/settings', { data: { value: { ...before, sahabat: { ...before.sahabat, ...k } } } })).status();

const b = await chromium.launch();
const INIT = () => { try { localStorage.setItem('kb-save-snooze', String(Date.now() + 9e9)); localStorage.setItem('kb-push-asked', String(Date.now() + 9e9)); localStorage.setItem('kb-news-seen', '["*"]'); localStorage.setItem('kb-ajak', JSON.stringify({ day: new Date().toLocaleDateString('en-CA'), n: 9, last: Date.now(), nanti: 0, mute: true, alunAt: 0 })); localStorage.setItem('kb-kerja-ajak', '1'); } catch {} };
async function mk(name, vp, { coins = 0, pearls = 0, tz = DAY_TZ, reduce = false } = {}) {
  const mobile = vp[0] < 900;
  const ctx = await b.newContext({ viewport: { width: vp[0], height: vp[1] }, deviceScaleFactor: 2, hasTouch: mobile, isMobile: mobile, timezoneId: tz, ...(reduce ? { reducedMotion: 'reduce' } : {}) });
  await ctx.addInitScript(INIT);
  await ctx.request.post(BASE + '/api/auth/guest', { data: {} });
  const st = await (await ctx.request.post(BASE + '/api/pet', { data: { name, color: '#F6B7A8', ear: 'kucing' } })).json();
  await ctx.request.post(BASE + '/api/daily', { data: {} });
  const id = st.state.user.id;
  if (coins) check((await adm.post(`/api/admin/players/${id}/wallet`, { data: { currency: 'coin', delta: coins, reason: 'uji sahabat' } })).ok(), `${name}: admin memberi ${coins} koin`);
  if (pearls) check((await adm.post(`/api/admin/players/${id}/wallet`, { data: { currency: 'pearl', delta: pearls, reason: 'uji sahabat' } })).ok(), `${name}: admin memberi ${pearls} Mutiara`);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  p.on('response', (res) => { if (res.url().includes('/api/') && res.status() >= 500) errors.push(`${name}: ${res.status()} ${res.url()}`); });
  return { ctx, p, id, code: st.state.user.friend_code, name, vp };
}
const api = async (pl, url, data) => (await (data === undefined ? pl.ctx.request.get(BASE + url) : pl.ctx.request.post(BASE + url, { data: { requestId: 'e2e-' + Math.random().toString(36).slice(2), ...data } }))).json();
const state = async (pl) => (await api(pl, '/api/sahabat')).sahabat;
const closeSheets = async (p) => { for (let i = 0; i < 3; i++) { const x = p.locator('.sheet .x'); if (await x.count()) { await x.first().click().catch(() => {}); await W(300); } } };
const home = async (pl) => { await pl.p.goto(`${BASE}/?r=${Math.random().toString(36).slice(2)}`); await pl.p.waitForSelector('svg.room', { timeout: 30000 }); await W(1400); await closeSheets(pl.p); await W(300); };
const shot = (pl, name) => pl.p.screenshot({ path: `${OUT}/${name}-${pl.vp[0]}.png` });
const toastText = async (p) => (await p.locator('.toast').allInnerTexts().catch(() => [])).join(' | ');
const waitToast = async (p, re) => { let t = ''; for (let i = 0; i < 40 && !re.test(t); i++) { await W(250); t = await toastText(p); } return t; };
const rect = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, l: r.left, t: r.top, r: r.right, b: r.bottom }; }, sel);
const noOverflow = (p) => p.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1 && [...document.querySelectorAll('.sheet .btn, .sheet .card, .sheet .cell, .sheet .bud')].every((e) => { const r = e.getBoundingClientRect(); return r.right <= innerWidth + 1 && r.left >= -1; }));
async function walkMap(pl, loc) {
  await pl.p.goto(`${BASE}/?r=${Math.random().toString(36).slice(2, 6)}#map`);
  await pl.p.waitForSelector(`.loc[data-loc="${loc}"]`, { timeout: 30000 }); await W(900); await closeSheets(pl.p);
}

const A = await mk('Mochi', [390, 844], { coins: 3000, pearls: 60 });
const B = await mk('Kopi', [390, 844], { coins: 600 });
let restored = false;
const restore = async () => { if (!restored) { restored = true; check((await adm.put('/api/admin/settings', { data: { value: before } })).status() === 200, 'pengaturan admin dikembalikan'); } };

try {
  /* ---------- 1. anak ayam pertama di depan pintu (bukan dialog yang menghalangi) ---------- */
  await home(A);
  check(await A.p.locator('.sheet').count() === 0, '390: tidak ada lembar / dialog yang terbuka sendiri saat masuk');
  check(await A.p.locator('svg.room .bud.k-wait.sp-ayam').count() === 1, '390: anak ayam menunggu di rumah');
  const tip = await A.p.locator('.btip.tap').first().innerText().catch(() => '');
  check(/Ciap\? Ketuk aku!/.test(tip), `390: gelembung anak ayam ("${tip}")`);
  // pet masih bisa dirawat: tombol aksi & dok tetap bisa diketuk
  check(await A.p.locator('.acts .act').count() >= 5 && await A.p.locator('.dock').count() === 1, '390: tombol aksi & dok tetap ada');
  await shot(A, '01-anak-ayam-di-pintu');
  await A.p.locator('svg.room .bud.k-wait.sp-ayam').dispatchEvent('click');
  await A.p.waitForSelector('.sheet[aria-label="Sahabat baru!"]', { timeout: 5000 }).catch(() => {});
  check(await A.p.locator('.sheet[aria-label="Sahabat baru!"]').count() === 1, '390: ketuk anak ayam → lembar beri nama');
  check((await A.p.locator('.sheet input').inputValue()) === 'Ciko', '390: nama bawaan disarankan (Ciko)');
  check(await A.p.locator('.sheet .chip').count() === 4, '390: 4 saran nama');
  await A.p.locator('.sheet input').fill('Kiko');
  await shot(A, '02-beri-nama-anak-ayam');
  check(await noOverflow(A.p), '390: lembar beri nama di dalam layar');
  await A.p.getByRole('button', { name: /Jadikan sahabat Mochi/ }).click();
  check(/Kiko jadi sahabat Mochi/.test(await waitToast(A.p, /jadi sahabat/)), '390: toast sahabat baru');
  await W(800);
  let st = await state(A);
  check(st.list.length === 1 && st.list[0].name === 'Kiko' && st.list[0].active && !st.ayam, 'server: Kiko si anak ayam aktif, tidak menunggu lagi');
  check(await A.p.locator('svg.room .bud.k-wait').count() === 0 && await A.p.locator('svg.room .bud.k-follow.sp-ayam[data-b="main"]').count() === 1, '390: anak ayam sekarang mengikuti pet');

  /* ---------- 2. mengikuti pet di rumah ---------- */
  const petAt = () => rect(A.p, 'svg.room .pet .pet-bob');
  const budAt = () => rect(A.p, 'svg.room .bud[data-b="main"] .bud-bob');
  const b0 = await budAt();
  const tiles = A.p.locator('svg.room .fl');
  let moved = false, near = false;
  for (const k of [3, 30, 8, 25]) {
    await tiles.nth(k).dispatchEvent('click').catch(() => {});
    await W(350);
    const mid = await budAt();
    await W(2600);
    const p1 = await petAt(), b1 = await budAt();
    if (mid && b0 && Math.hypot(mid.x - b0.x, mid.y - b0.y) > 4) moved = true;
    if (p1 && b1 && Math.hypot(p1.x - b1.x, p1.y - b1.y) < 140) near = true;
    if (moved && near) break;
  }
  check(moved, '390: sahabat ikut berjalan saat pet berjalan');
  check(near, '390: sahabat berhenti di dekat pet');
  await shot(A, '03-rumah-mengikuti');

  /* ---------- 3. oleh-oleh harian (gelembung, sekali sehari) ---------- */
  check(st.gift === true, 'server: oleh-oleh hari ini menunggu');
  const giftTip = A.p.locator('.btip.tap:has-text("Ada oleh-oleh!")');
  for (let i = 0; i < 20 && !(await giftTip.count()); i++) await W(250);
  check(await giftTip.count() === 1, '390: gelembung "Ada oleh-oleh!" di atas sahabat');
  await giftTip.click().catch(() => {});
  check(/oleh-oleh/.test(await waitToast(A.p, /oleh-oleh/)), '390: oleh-oleh diterima (toast)');
  await W(500);
  check((await state(A)).gift === false && await A.p.locator('.btip:has-text("oleh-oleh")').count() === 0, 'oleh-oleh tidak ditawarkan lagi hari ini');

  /* ---------- 4. ketuk = main (Kenal: lompat kecil) ---------- */
  await A.p.locator('svg.room .bud[data-b="main"]').dispatchEvent('click');
  await W(150);
  check(await A.p.locator('svg.room .bud[data-b="main"].hop1').count() === 1, '390: ketuk sahabat (Kenal) → lompat kecil');
  await W(1800);
  check((await state(A)).list[0].playsLeft === 2, 'server: main dihitung (sisa 2× hari ini)');

  /* ---------- 5. Akrab: trik & duduk di kepala saat pet tidur ---------- */
  check(await putSahabat({ akrabAt: 5, sejatiAt: 400 }) === 200, 'sementara: Akrab cukup 5 keakraban');
  await W(200);
  await api(A, '/api/sahabat/main', { id: st.list[0].id });
  st = await state(A);
  check(st.list[0].lvl === 1, `server: Kiko naik ke Akrab (${st.list[0].points} keakraban)`);
  await home(A);
  await A.p.locator('svg.room .bud[data-b="main"]').dispatchEvent('click');
  await W(150);
  check(await A.p.locator('svg.room .bud[data-b="main"].trk').count() === 1, '390: Akrab → trik (.trk)');
  await W(1500);
  await A.p.locator('.acts .act:has-text("Tidur")').click();
  await A.p.waitForSelector('svg.room .pet.pose-tidur', { timeout: 15000 }).catch(() => {});
  await A.p.waitForSelector('svg.room .bud.perch[data-b="main"]', { timeout: 6000 }).catch(() => {});
  check(await A.p.locator('svg.room .bud.perch[data-b="main"]').count() === 1, '390: pet tidur → Kiko duduk di kepala pet');
  const ph = await rect(A.p, 'svg.room .pet .pet-bob'), bh = await rect(A.p, 'svg.room .bud[data-b="main"] .bud-bob');
  check(!!ph && !!bh && bh.y < ph.y && Math.abs(bh.x - ph.x) < ph.w, '390: letak sahabat di atas kepala pet');
  await W(600);
  await shot(A, '04-tidur-sahabat-di-kepala');
  await A.p.getByRole('button', { name: /bangunkan/ }).click().catch(() => {});
  await W(1500);
  check(await A.p.locator('svg.room .bud.perch').count() === 0, '390: pet bangun → sahabat turun lagi');

  /* ---------- 6. Pondok Sahabat di peta ---------- */
  await walkMap(A, 'pondok');
  check(await A.p.locator('svg.map g.pbaru').count() === 1, '390: lencana BARU di Pondok Sahabat');
  check(await A.p.locator('svg.map .mapbud.sp-ayam').count() === 1, '390: sahabat ikut di peta');
  const pond = await rect(A.p, '.loc[data-loc="pondok"]');
  check(!!pond && pond.w > 40 && pond.r <= 390 * 3, '390: Pondok Sahabat tergambar di peta');
  await A.p.evaluate(() => document.querySelector('.loc[data-loc="pondok"]').scrollIntoView({ inline: 'center' }));
  await W(400);
  await shot(A, '05-peta-pondok-sahabat');
  const mb0 = await rect(A.p, 'svg.map .mapbud');
  await A.p.locator('.loc[data-loc="pondok"]').dispatchEvent('click');
  await W(700);
  const mb1 = await rect(A.p, 'svg.map .mapbud');
  check(!!mb0 && !!mb1 && Math.hypot(mb1.x - mb0.x, mb1.y - mb0.y) > 3, '390: sahabat berjalan di belakang pet di peta');
  await A.p.waitForSelector('.sheet[aria-label="Pondok Sahabat"]', { timeout: 20000 }).catch(() => {});
  check(await A.p.locator('.sheet[aria-label="Pondok Sahabat"]').count() === 1, '390: sampai di Pondok Sahabat → panel Pondok terbuka');
  await W(800);
  check((await state(A)).jalan.peta === true, 'server: jalan-jalan keliling kampung bareng sahabat dihitung');
  check(await A.p.locator('svg.map g.pbaru').count() === 0, '390: lencana BARU hilang setelah Pondok dibuka');
  await shot(A, '06-pondok-panel');
  check(await noOverflow(A.p), '390: panel Pondok di dalam layar');
  // camilan & adopsi koin
  const w0 = (await api(A, '/api/me')).wallet, coin0 = w0.coin;
  await A.p.locator('.snack .btn').nth(1).click();
  check(/5 Camilan Sahabat/.test(await waitToast(A.p, /Camilan/)), '390: beli 5 Camilan Sahabat');
  const um = A.p.locator('.sheet .card:has(b:text-is("Umang-umang")) .btn');
  await um.click(); await W(200);
  check((await um.innerText()).includes('Yakin?'), '390: adopsi minta konfirmasi (Yakin?)');
  await um.click();
  check(/jadi sahabatmu|sekarang sahabatmu/.test(await waitToast(A.p, /sahabatmu/)), '390: adopsi Umang-umang (koin)');
  // sesudah adopsi panel pindah ke Sahabatku (sahabat baru terlihat): kembali ke tab Pondok
  check(await A.p.locator('.sheet .bud:has-text("Umang-umang")').count() === 1, '390: sesudah adopsi, sahabat baru tampil di Sahabatku');
  await A.p.getByRole('tab', { name: 'Pondok' }).click(); await W(300);
  const kl = A.p.locator('.sheet .card:has(b:text-is("Kelinci Mini")) .btn').last();
  await kl.click(); await W(200); await kl.click();
  await waitToast(A.p, /Kelinci/);
  await W(600);
  const me1 = await api(A, '/api/me');
  check(me1.wallet.coin === coin0 - 25 - 250, `server: koin terpotong 25 + 250 (${coin0} → ${me1.wallet.coin})`);
  check(me1.wallet.pearl === w0.pearl - 12, `server: Mutiara terpotong 12 untuk kelinci (${w0.pearl} → ${me1.wallet.pearl})`);
  check(me1.inventory['camilan-sahabat'] === 5, 'Tas: 5 Camilan Sahabat');
  st = await state(A);
  check(['ayam', 'umang', 'kelinci'].every((sp) => st.list.some((x) => x.sp === sp)) && st.list.filter((x) => x.active).length === 1, 'server: 3 sahabat, satu yang aktif');

  /* ---------- 7. Sahabatku: camilan, warna kerang, nama, ajak ---------- */
  await A.p.getByRole('tab', { name: /Sahabatku/ }).click(); await W(300);
  const kiko = A.p.locator('.sheet .bud:has(b:has-text("Kiko"))');
  await kiko.getByRole('button', { name: /Beri camilan/ }).click();
  check(/Nyam/.test(await waitToast(A.p, /Nyam/)), '390: beri camilan → toast');
  await W(500);
  check(await kiko.getByRole('button', { name: /Sudah makan/ }).count() === 1, '390: camilan sekali sehari (tombol "Sudah makan")');
  const umang = A.p.locator('.sheet .bud:has(.shells)');
  await umang.locator('.shell[aria-label="Biru laut"]').click(); await W(700);
  check((await state(A)).list.find((x) => x.sp === 'umang').variant === 'biru', '390: warna rumah kerang umang diganti (biru)');
  await umang.getByRole('button', { name: 'Ganti nama' }).click();
  await umang.locator('.ren input').fill('Kerang');
  await umang.getByRole('button', { name: 'Simpan' }).click(); await W(700);
  check((await state(A)).list.find((x) => x.sp === 'umang').name === 'Kerang', '390: ganti nama sahabat');
  const kel = A.p.locator('.sheet .bud:has-text("Kelinci Mini")');
  await kel.getByRole('button', { name: 'Ajak jalan-jalan' }).click(); await W(700);
  st = await state(A);
  check(st.list.find((x) => x.sp === 'kelinci').active && st.list.filter((x) => x.active).length === 1, '390: kelinci diajak jalan-jalan, yang lain istirahat');
  await A.p.evaluate(() => document.querySelector('.sheet .bud')?.scrollIntoView());
  await shot(A, '07-sahabatku');

  /* ---------- 8. Toko Mutiara: sahabat Mutiara lewat jalur beli toko ---------- */
  await walkMap(A, 'mutiara');
  await A.p.locator('.loc[data-loc="mutiara"]').dispatchEvent('click');
  await A.p.waitForSelector('.shop .panel', { timeout: 30000 }); await W(700);
  const tabSah = A.p.locator('.shop .tabbar button:has-text("Sahabat")');
  if (await tabSah.count()) { await tabSah.click(); await W(300); }
  const shopCard = (n) => A.p.locator(`.shop .panel .card:has(.name:text-is("${n}"))`);
  check(await shopCard('Hamster Pipi Tembam').count() === 1 && await shopCard('Landak Mini').count() === 1, '390: Toko Mutiara menjual Hamster & Landak Mini');
  check((await shopCard('Kelinci Mini').innerText()).includes('Punya'), '390: Kelinci Mini bertanda Punya di Toko Mutiara');
  const hb = shopCard('Hamster Pipi Tembam').locator('.acts .btn').last();
  await hb.click(); await W(200);
  check((await hb.innerText()).includes('Yakin?'), '390: beli dengan Mutiara minta konfirmasi');
  await hb.click();
  check(/jadi sahabatmu/.test(await waitToast(A.p, /sahabatmu/)), '390: Hamster diadopsi di Toko Mutiara');
  await shopCard('Hamster Pipi Tembam').scrollIntoViewIfNeeded(); await W(500);
  await shot(A, '08-toko-mutiara-sahabat');
  const lb = shopCard('Landak Mini').locator('.acts .btn').last();
  await lb.click(); await W(200); await lb.click(); await waitToast(A.p, /Landak/);
  await W(500);
  check((await state(A)).list.length === 5, 'server: 5 sahabat');

  /* ---------- 9. burung pipit di Halaman ---------- */
  const hal = await api(A, '/api/shop/buy', { itemId: 'halaman', currency: 'coin' });
  check(!!hal.roomId, 'Halaman dibeli (API)');
  check((await adm.post(`/api/admin/players/${A.id}/items`, { data: { itemId: 'tempat-minum-burung', qty: 1 } })).ok(), 'admin memberi Tempat Minum Burung');
  const room = (await api(A, '/api/me')).rooms.find((r) => r.id === hal.roomId);
  check(!!(await api(A, '/api/room', { roomId: room.id, layout: [{ i: 'tempat-minum-burung', x: 3, y: 2 }], version: room.version })).ok, 'Tempat Minum Burung dipasang di Halaman');
  check((await state(A)).pipit === true, 'server: burung pipit mampir');
  await home(A);
  await A.p.locator('.cambtn').first().click().catch(() => {}); await W(900);
  check(await A.p.locator('svg.room .bud.k-wait.sp-pipit').count() === 1, '390: burung pipit bertengger di Tempat Minum Burung');
  await shot(A, '09-pipit-di-halaman');
  await A.p.locator('svg.room .bud.k-wait.sp-pipit').dispatchEvent('click');
  await A.p.waitForSelector('.sheet[aria-label="Sahabat baru!"]', { timeout: 5000 }).catch(() => {});
  await A.p.getByRole('button', { name: /Jadikan sahabat/ }).click();
  await waitToast(A.p, /pipit/);
  await W(600);
  check((await state(A)).list.some((x) => x.sp === 'pipit'), 'server: burung pipit jadi sahabat');

  /* ---------- 10. kura-kura dari Kolam Pancing (langka; peluang 100% sementara, lewat API) ---------- */
  check(await putSahabat({ akrabAt: 5, sejatiAt: 400, kuraPct: 100 }) === 200, 'sementara: peluang kura-kura 100%');
  let kura = null;
  for (let i = 0; i < 6 && !kura; i++) {
    const c = await api(A, '/api/fish/cast', { distance: 'dekat' });
    if (!c.castId) break;
    await W(c.biteInMs + 80);
    const h = await api(A, '/api/fish/hook', { castId: c.castId });
    if (h.result !== 'hooked') continue;
    await W(c.fight.minMs + 80);
    const l = await api(A, '/api/fish/land', { castId: c.castId });
    if (l.kura) kura = l.kura;
  }
  check(kura?.sp === 'kura', 'Kolam Pancing: kura-kura ikut tersangkut & jadi sahabat');
  check(await putSahabat({ akrabAt: 5, sejatiAt: 400, kuraPct: 1 }) === 200, 'peluang kura-kura kembali 1%');

  /* ---------- 11. kunang-kunang malam hari (jendela admin mencakup jam sekarang, langit HP malam) ---------- */
  const wibH = (utcH + 7) % 24;
  check(await putSahabat({ akrabAt: 5, sejatiAt: 400, kunang: { fromHour: wibH, toHour: (wibH + 2) % 24 } }) === 200, 'sementara: kunang-kunang muncul jam sekarang');
  const N = await mk('Bintang', [390, 844], { tz: NIGHT_TZ });
  await api(N, '/api/sahabat/ayam', { name: 'Ciap' });
  await home(N);
  await N.p.waitForSelector('svg.room .bud.k-wait.sp-kunang', { timeout: 8000 }).catch(() => {});
  check(await N.p.locator('svg.room .bud.k-wait.sp-kunang').count() === 1, '390 malam: kunang-kunang berkelip di depan rumah');
  check(await N.p.locator('svg.room .bud.nite').count() >= 1, '390 malam: cahaya kunang-kunang terang (kelas malam)');
  await shot(N, '10-kunang-kunang-malam');
  await N.p.locator('svg.room .bud.k-wait.sp-kunang').dispatchEvent('click');
  await N.p.waitForSelector('.sheet[aria-label="Sahabat baru!"]', { timeout: 5000 }).catch(() => {});
  await N.p.getByRole('button', { name: /Jadikan sahabat/ }).click();
  await waitToast(N.p, /kunang/);
  await W(500);
  const nst = await state(N);
  check(nst.list.some((x) => x.sp === 'kunang'), 'server: kunang-kunang tertangkap jadi sahabat');
  // ajak kunang-kunang: cahayanya di sekitar pet malam hari
  await api(N, '/api/sahabat/aktif', { id: nst.list.find((x) => x.sp === 'kunang').id });
  await home(N);
  check(await N.p.locator('svg.room .bud.sp-kunang.nite[data-b="main"]').count() === 1, '390 malam: kunang-kunang menerangi sekitar pet');
  await shot(N, '11-kunang-menemani-malam');
  await N.ctx.close();
  check(await putSahabat({}) === 200, 'jendela kunang-kunang kembali bawaan');

  /* ---------- 12. sahabat istirahat di rumah (paling banyak 3) & Album ---------- */
  await home(A);
  const rest = await A.p.locator('svg.room .bud.k-rest').count();
  check(rest >= 1 && rest <= 3, `390: sahabat istirahat tampil di rumah (${rest}, maks 3)`);
  await A.p.locator('.cambtn').first().click().catch(() => {}); await W(900);
  await shot(A, '12-rumah-sahabat-istirahat');
  await A.p.locator('.dock button:has-text("Tas")').click(); await W(500);
  check(await A.p.locator('.sheet button.sahabat').count() === 1, '390: Tas › Sahabat Mungil');
  await A.p.locator('.sheet button.sahabat').click(); await W(500);
  await A.p.getByRole('tab', { name: /Album/ }).click(); await W(400);
  const cells = await A.p.locator('.sheet .album .cell').count(), unk = await A.p.locator('.sheet .album .cell.unk').count();
  check(cells === 9 && unk === 2, `390: Album 9 sahabat, ${unk} siluet (belum dimiliki)`);
  check((await A.p.locator('.sheet .album .cell.unk small.hint').allInnerTexts()).every((t) => t.length > 20), '390: siluet diberi petunjuk cara mendapatkan');
  await shot(A, '13-album');
  check(await noOverflow(A.p), '390: Album di dalam layar');
  await closeSheets(A.p);

  /* ---------- 13. kunjungan teman: sahabat tuan rumah, sahabat tamu, sahabat istirahat, kartu profil ---------- */
  await api(B, '/api/sahabat/ayam', { name: 'Piyik' });
  await B.ctx.request.post(BASE + '/api/friends', { data: { code: A.code } });
  await home(A);
  await B.p.goto(BASE + '/?r=1#friends'); await B.p.waitForSelector('.friend', { timeout: 20000 }); await W(800);
  await B.p.click(`.friend:has-text("Mochi") .btn:has-text("Main bareng"), .friend:has-text("Mochi") .btn:has-text("Kunjungi")`);
  await B.p.waitForSelector('.visit', { timeout: 20000 }).catch(() => {});
  await W(3500);
  const hostKey = await B.p.evaluate(() => [...document.querySelectorAll('svg.room .bud.k-follow')].map((e) => e.getAttribute('data-b') + ':' + [...e.classList].find((c) => c.startsWith('sp-'))));
  check(hostKey.some((k) => /sp-kelinci/.test(k)), `kunjungan: sahabat tuan rumah (kelinci) mengikuti petnya (${hostKey.join(', ')})`);
  check(hostKey.some((k) => k.startsWith('c:__me') && /sp-ayam/.test(k)), 'kunjungan: sahabat tamu ikut berkunjung');
  check(await B.p.locator('svg.room .bud.k-rest').count() >= 1, 'kunjungan: sahabat tuan rumah yang istirahat terlihat');
  await shot(B, '14-kunjungan-teman');
  check((await state(B)).jalan.kunjung === true, 'kunjungan: keakraban jalan-jalan bareng sahabat dihitung (server)');
  // tuan rumah melihat sahabat tamu, lalu membuka kartu profilnya
  await W(1500);
  check(await A.p.locator(`svg.room .bud[data-b="c:${B.id}"]`).count() === 1, 'tuan rumah: sahabat tamu terlihat di rumahnya');
  const opet = A.p.locator(`svg.room .opet[data-o="${B.id}"]`);
  if (await opet.count()) {
    await opet.click({ force: true }); await W(600);
    check((await A.p.locator('.pcard .bud').innerText().catch(() => '')).includes('Piyik'), 'kartu profil: sahabat aktif tamu tampil');
    await shot(A, '15-kartu-profil');
    await A.p.locator('.pcard .x').click().catch(() => {});
  } else check(false, 'tuan rumah: pet tamu terlihat');
  await B.p.getByRole('button', { name: 'Pulang' }).click().catch(() => {});

  /* ---------- 14. alun-alun: sahabat ikut & terlihat pemain lain ---------- */
  await A.p.goto(BASE + '/?r=2#alun'); await A.p.waitForSelector('.sbar, .fp', { timeout: 25000 }).catch(() => {}); await W(1500);
  await B.p.goto(BASE + '/?r=3#alun'); await B.p.waitForSelector('.sbar, .fp', { timeout: 25000 }).catch(() => {}); await W(3500);
  check(await B.p.locator('svg.room .bud[data-b="main"].sp-ayam').count() === 1, 'alun-alun: sahabat sendiri ikut');
  check(await B.p.locator(`svg.room .bud[data-b="c:${A.id}"]`).count() === 1, 'alun-alun: sahabat pemain lain terlihat');
  check((await state(B)).jalan.alun === true, 'alun-alun: keakraban jalan-jalan bareng sahabat dihitung (server)');
  await closeSheets(B.p);
  // ajakan "Mau punya teman baru?" (sekali saja) ditutup dulu supaya alun-alun terlihat
  await B.p.getByRole('button', { name: 'Nanti' }).click().catch(() => {});
  // jalan sedikit: sahabat menyusul di belakang pet
  const n = await B.p.locator('svg.room .fl').count();
  if (n) await B.p.locator('svg.room .fl').nth(Math.floor(n / 2)).dispatchEvent('click').catch(() => {});
  await W(3000);
  await shot(B, '16-alun-alun');

  /* ---------- 15. Jepret: sahabat ikut terfoto ---------- */
  await home(A);
  await A.p.click('.jbtn'); await A.p.waitForSelector('.jp', { timeout: 6000 }); await W(800);
  const fr = await rect(A.p, '.jp .frame, .jp .vf, .jp .vfb');
  const bp = await rect(A.p, 'svg.room .bud[data-b="main"] .bud-bob');
  check(!!bp && (!fr || (bp.x > fr.l && bp.x < fr.r && bp.y > fr.t && bp.y < fr.b)), 'Jepret: sahabat di dalam bingkai foto');
  await A.p.click('.jp .shut');
  await A.p.waitForSelector('div[role="dialog"][aria-label="Fotomu siap!"]', { timeout: 10000 }).catch(() => {});
  await A.p.waitForFunction(() => { const i = document.querySelector('.prev img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 15000 }).catch(() => {});
  await W(500);
  const prev = A.p.locator('.prev img');
  check(await prev.count() === 1, 'Jepret: foto jadi');
  if (await prev.count()) await prev.screenshot({ path: `${OUT}/17-foto-jepret-390.png` });
  await shot(A, '17-jepret-pratinjau');
  await A.p.keyboard.press('Escape').catch(() => {});

  /* ---------- 16. HP 320 dengan animasi dikurangi ---------- */
  const D = await mk('Tahu', [320, 640], { reduce: true, coins: 500 });
  await home(D);
  check(await D.p.locator('svg.room .bud.k-wait.sp-ayam').count() === 1 && await D.p.locator('.sheet').count() === 0, '320: anak ayam menunggu, tanpa dialog yang menghalangi');
  await shot(D, '01-anak-ayam-di-pintu');
  await D.p.locator('.btip.tap').first().click();
  await D.p.waitForSelector('.sheet[aria-label="Sahabat baru!"]', { timeout: 5000 }).catch(() => {});
  check(await noOverflow(D.p), '320: lembar beri nama di dalam layar');
  await shot(D, '02-beri-nama-anak-ayam');
  await D.p.getByRole('button', { name: /Jadikan sahabat/ }).click(); await W(1200);
  await D.p.locator('svg.room .fl').nth(14).dispatchEvent('click'); await W(250);
  const anim = await D.p.evaluate(() => { const e = document.querySelector('svg.room .bud .bud-bob'); return e ? getComputedStyle(e).animationName : 'tidak ada'; });
  check(anim === 'none', `320 animasi dikurangi: sahabat tidak bergoyang (${anim})`);
  await W(2500);
  await shot(D, '03-rumah-mengikuti');
  await walkMap(D, 'pondok');
  await D.p.locator('.loc[data-loc="pondok"]').dispatchEvent('click');
  await D.p.waitForSelector('.sheet[aria-label="Pondok Sahabat"]', { timeout: 20000 }).catch(() => {});
  await W(700);
  check(await noOverflow(D.p), '320: panel Pondok di dalam layar');
  await shot(D, '06-pondok-panel');
  await D.p.getByRole('tab', { name: /Album/ }).click(); await W(400);
  check(await noOverflow(D.p), '320: Album di dalam layar');
  await shot(D, '13-album');
  await D.ctx.close();

  /* ---------- 17. desktop 1366 ---------- */
  const E = await mk('Serabi', [1366, 768], { coins: 800 });
  await home(E);
  check(await E.p.locator('svg.room .bud.k-wait.sp-ayam').count() === 1, '1366: anak ayam menunggu');
  await shot(E, '01-anak-ayam-di-pintu');
  await E.p.locator('svg.room .bud.k-wait.sp-ayam').dispatchEvent('click');
  await E.p.waitForSelector('.sheet[aria-label="Sahabat baru!"]', { timeout: 5000 }).catch(() => {});
  await shot(E, '02-beri-nama-anak-ayam');
  await E.p.getByRole('button', { name: /Jadikan sahabat/ }).click(); await W(1500);
  await E.p.locator('svg.room .fl').nth(20).dispatchEvent('click'); await W(2800);
  check(await E.p.locator('svg.room .bud[data-b="main"]').count() === 1, '1366: sahabat mengikuti pet');
  await shot(E, '03-rumah-mengikuti');
  check(await putSahabat({ akrabAt: 1, sejatiAt: 400 }) === 200, 'sementara: Akrab cukup 1 keakraban');
  await api(E, '/api/sahabat/main', { id: (await state(E)).list[0].id });
  await home(E);
  await E.p.locator('.acts .act:has-text("Tidur")').click();
  await E.p.waitForSelector('svg.room .bud.perch', { timeout: 15000 }).catch(() => {});
  check(await E.p.locator('svg.room .bud.perch').count() === 1, '1366: Akrab → duduk di kepala pet yang tidur');
  await W(600);
  await shot(E, '04-tidur-sahabat-di-kepala');
  await E.p.getByRole('button', { name: /bangunkan/ }).click().catch(() => {});
  await walkMap(E, 'pondok');
  await shot(E, '05-peta-pondok-sahabat');
  await E.p.locator('.loc[data-loc="pondok"]').dispatchEvent('click');
  await E.p.waitForSelector('.sheet[aria-label="Pondok Sahabat"]', { timeout: 20000 }).catch(() => {});
  await W(700);
  await shot(E, '06-pondok-panel');
  await E.p.getByRole('tab', { name: /Album/ }).click(); await W(400);
  await shot(E, '13-album');
  await E.ctx.close();
} finally {
  await restore();
}

check(!errors.length, `tanpa galat halaman / 5xx${errors.length ? `: ${errors.join(' | ')}` : ''}`);
await b.close();
console.log(fails.length ? `\n${fails.length} GAGAL` : '\nSemua lulus');
process.exit(fails.length ? 1 : 0);
