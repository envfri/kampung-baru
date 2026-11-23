// Uji kamar mandi 2 & ruangan Mutiara (paket konten 22): berjalan ke Mebel Jati dan Toko Mutiara lewat peta, barang baru
// tampil di toko (HP 390 & 320, desktop 1366), kartu ruangan Mutiara menyebut "Termasuk: …"; beli dengan koin & Mutiara
// (diberi admin); pasang lewat Atur (Tas › Pasang) & API; pakai aktivitas dengan tiga animasi baru (gayung, shower,
// kering) — kelas pose terpasang, properti dibawa, animasinya berjalan, dan diam dengan prefers-reduced-motion; beli
// ruangan Mutiara lewat kartu toko: toast bonus, mebel khas + dinding + lantai masuk Tas, mebel khas dipasang & dipakai
// (semua enam ruangan); rumah 12 ruangan tampil (Rumahku 12/12, lihat seluruh rumah, Atur denah 12 ruangan).
// Tidak ada galat halaman / 5xx.
// Jalankan server dulu dengan admin (ADMIN_EMAIL & ADMIN_PASSWORD), lalu: BASE_URL=http://localhost:8787 npm run test:e2e:mandi2
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, request } = require('playwright');
const BASE = (process.env.BASE_URL ?? 'http://localhost:8787').replace(/\/$/, ''), OUT = process.env.SHOTS ?? 'test-results/e2e-mandi2';
const ADMIN = { email: process.env.ADMIN_EMAIL ?? 'owner@bupi.test', password: process.env.ADMIN_PASSWORD ?? 'rahasia-sekali-123' };
mkdirSync(OUT, { recursive: true });
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [], errors = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'GAGAL'} ${msg}`); if (!ok) fails.push(msg); };

/** barang baru per toko (nama di kartu toko) */
const NEW = {
  mebel: ['Bak Mandi Keramik & Gayung', 'Shower & Tirai Ikan', 'Pengering Bulu', 'Mesin Gelembung Sabun', 'Rak Mainan Mandi', 'Ember Rendam Kaki', 'Rak Sabun & Sampo', 'Lampu Ubur-ubur', 'Keranjang Cucian Rotan', 'Pot Lidah Mertua', 'Dinding Ubin Perahu Layar', 'Lantai Batu Kali Kecil'],
  mutiara: ['Bak Mandi Kaki Kucing', 'Pancuran Gajah', 'Ruang Main Anak', 'Rumah Pohon', 'Studio Karaoke', 'Rumah Kaca Anggrek', 'Pemandian Air Panas', 'Ruang Akuarium'],
};
/** ruangan Mutiara: mebel khas, aktivitasnya, pose, nama berkas foto */
const ROOMS = {
  'ruang-main': { name: 'Ruang Main Anak', bonus: 'kolam-bola', bonusName: 'Kolam Bola', act: 'Nyemplung kolam bola', pose: 'duduk', shot: 'ruang-main.png', at: { x: 1, y: 1 } },
  'rumah-pohon': { name: 'Rumah Pohon', bonus: 'ayunan-ban', bonusName: 'Ayunan Ban', act: 'Main ayunan ban', pose: 'ayun', shot: 'rumah-pohon.png', at: { x: 1, y: 2 } },
  'studio-karaoke': { name: 'Studio Karaoke', bonus: 'mesin-karaoke', bonusName: 'Mesin Karaoke', act: 'Nyanyi dangdut', pose: 'musik', shot: 'karaoke.png', at: { x: 2, y: 1 } },
  'rumah-kaca': { name: 'Rumah Kaca Anggrek', bonus: 'rak-anggrek', bonusName: 'Rak Anggrek', act: 'Siram anggrek', pose: 'siram', shot: 'rumah-kaca.png', at: { x: 2, y: 1 } },
  'air-panas': { name: 'Pemandian Air Panas', bonus: 'kolam-air-panas', bonusName: 'Kolam Air Panas', act: 'Berendam air panas', pose: 'mandi', shot: 'air-panas.png', at: { x: 1, y: 1 } },
  'ruang-akuarium': { name: 'Ruang Akuarium', bonus: 'sofa-kerang', bonusName: 'Sofa Kerang', act: 'Duduk di sofa kerang', pose: 'duduk', shot: 'akuarium.png', at: { x: 2, y: 1 } },
};

const adm = await request.newContext({ baseURL: BASE });
check((await adm.post('/api/admin/login', { data: ADMIN })).ok(), 'admin masuk');
const cat = await (await adm.get('/api/catalog')).json();
const byName = Object.fromEntries(cat.items.map((i) => [i.name, i]));
const byId = Object.fromEntries(cat.items.map((i) => [i.id, i]));
check(NEW.mebel.every((n) => byName[n]?.shop === 'mebel' && byName[n].price_coin > 0 && !byName[n].price_pearl), `katalog: ${NEW.mebel.length} barang baru di Mebel Jati dengan harga koin`);
check(NEW.mutiara.every((n) => byName[n]?.shop === 'mutiara' && byName[n].price_pearl > 0 && !byName[n].price_coin), `katalog: ${NEW.mutiara.length} barang & ruangan baru di Toko Mutiara dengan harga Mutiara`);
check(Object.values(ROOMS).every((r) => byId[r.bonus] && !byId[r.bonus].shop), 'katalog: mebel khas ruangan ada tapi tidak dijual di toko');
const acts = Object.fromEntries((cat.activities ?? []).map((a) => [a.id, a]));
check(acts['mandi-gayung']?.anim === 'gayung' && acts['mandi-shower']?.anim === 'shower' && acts['keringkan-bulu']?.anim === 'kering', 'katalog: mandi gayung, mandi shower, keringkan bulu memakai animasi baru');
check((cat.settings?.house?.maxRooms ?? 0) >= 12, `pengaturan: batas rumah ${cat.settings?.house?.maxRooms} ruangan`);

const b = await chromium.launch();
async function mk(name, vp, coins, pearls, opts = {}) {
  const mobile = vp[0] < 900;
  // dpr 2: foto layar tajam untuk paket desain
  const ctx = await b.newContext({ viewport: { width: vp[0], height: vp[1] }, deviceScaleFactor: 2, hasTouch: mobile, isMobile: mobile, ...opts });
  await ctx.addInitScript(() => { try { localStorage.setItem('kb-save-snooze', String(Date.now() + 9e9)); localStorage.setItem('kb-push-asked', String(Date.now() + 9e9)); localStorage.setItem('kb-news-seen', '["*"]'); localStorage.setItem('kb-ajak', JSON.stringify({ day: new Date().toLocaleDateString('en-CA'), n: 9, last: Date.now(), nanti: 0, mute: true, alunAt: 0 })); } catch {} });
  await ctx.request.post(BASE + '/api/auth/guest', { data: {} });
  await ctx.request.post(BASE + '/api/pet', { data: { name, color: '#F6B7A8', ear: 'kucing' } });
  await ctx.request.post(BASE + '/api/daily', { data: {} });
  const me = await (await ctx.request.get(BASE + '/api/me')).json();
  if (coins) check((await adm.post(`/api/admin/players/${me.user.id}/wallet`, { data: { currency: 'coin', delta: coins, reason: 'uji kamar mandi 2' } })).ok(), `${name}: admin memberi ${coins} koin`);
  if (pearls) check((await adm.post(`/api/admin/players/${me.user.id}/wallet`, { data: { currency: 'pearl', delta: pearls, reason: 'uji ruangan Mutiara' } })).ok(), `${name}: admin memberi ${pearls} Mutiara`);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  p.on('response', (res) => { if (res.url().includes('/api/') && res.status() >= 500) errors.push(`${name}: ${res.status()} ${res.url()}`); });
  return { ctx, p, me, name, vp };
}
/** halaman kedua dengan akun yang sama di ukuran layar lain */
async function view(pl, vp) {
  const mobile = vp[0] < 900;
  const ctx = await b.newContext({ storageState: await pl.ctx.storageState(), viewport: { width: vp[0], height: vp[1] }, deviceScaleFactor: 2, hasTouch: mobile, isMobile: mobile });
  await ctx.addInitScript(() => { try { localStorage.setItem('kb-save-snooze', String(Date.now() + 9e9)); localStorage.setItem('kb-push-asked', String(Date.now() + 9e9)); localStorage.setItem('kb-news-seen', '["*"]'); localStorage.setItem('kb-ajak', JSON.stringify({ day: new Date().toLocaleDateString('en-CA'), n: 9, last: Date.now(), nanti: 0, mute: true, alunAt: 0 })); } catch {} });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${pl.name} ${vp[0]}: ${e.message}`));
  p.on('response', (res) => { if (res.url().includes('/api/') && res.status() >= 500) errors.push(`${pl.name} ${vp[0]}: ${res.status()} ${res.url()}`); });
  return { ctx, p, me: pl.me, name: `${pl.name} ${vp[0]}`, vp };
}
const meOf = async (pl) => (await pl.ctx.request.get(BASE + '/api/me')).json();
const closeSheets = async (p) => { for (let i = 0; i < 3; i++) { const x = p.locator('.sheet .x'); if (await x.count()) { await x.first().click().catch(() => {}); await W(300); } } };
const home = async (pl) => { await pl.p.goto(`${BASE}/?r=${Math.random().toString(36).slice(2)}`); await pl.p.waitForSelector('.dock', { timeout: 30000 }); await W(1200); await closeSheets(pl.p); };
const toastText = async (p) => (await p.locator('.toast').allInnerTexts().catch(() => [])).join(' | ');
const waitToast = async (p, re) => { let t = ''; for (let i = 0; i < 40 && !re.test(t); i++) { await W(300); t = await toastText(p); } return t; };

/** dari peta kampung: pet berjalan ke toko, lalu masuk */
async function walkTo(pl, shop) {
  await pl.p.goto(`${BASE}/?r=${shop}${Math.random().toString(36).slice(2, 6)}#map`);
  await pl.p.waitForSelector(`.loc[data-loc="${shop}"]`, { timeout: 30000 }); await W(800); await closeSheets(pl.p);
  await pl.p.locator(`.loc[data-loc="${shop}"]`).dispatchEvent('click');
  await pl.p.waitForSelector('.shop .panel', { timeout: 30000 }); await W(600);
}
const cardNames = (p) => p.evaluate(() => [...document.querySelectorAll('.shop .panel .card .name')].map((e) => e.textContent.trim()));
const card = (p, name) => p.locator(`.shop .panel .card:has(.name:text-is("${name}"))`);
/** cek toko: semua barang baru tampil, kartu & tombol tidak keluar layar, ikon tergambar */
async function checkShop(pl, shop, tag, shot) {
  // toko terbuka di tab Semua (bukan Edisi Spesial yang lebih lama) dan barang terbaru di urutan atas
  const tabOn = await pl.p.locator('.shop .tabbar:not(.slots) button.on').first().innerText().catch(() => '');
  check(/^Semua/.test(tabOn.trim()), `${tag}: ${shop} terbuka di tab Semua ("${tabOn.trim()}")`);
  // barang dari paket konten yang lebih baru (mis. sahabat Mutiara paket 23) boleh tampil lebih dulu
  const mine = cat.items.filter((i) => NEW[shop].includes(i.name));
  const since = Math.max(0, ...mine.map((i) => Number(i.new_until ?? 0)));
  const newer = cat.items.filter((i) => i.shop === shop && !NEW[shop].includes(i.name) && Number(i.new_until ?? 0) > since).length;
  const top = (await cardNames(pl.p)).slice(0, NEW[shop].length + newer);
  check(NEW[shop].every((n) => top.includes(n)), `${tag}: ${NEW[shop].length} barang baru di urutan paling atas ${shop}${newer ? ` (sesudah ${newer} barang paket yang lebih baru)` : ''} (${top.slice(0, 3).join(', ')}, …)`);
  const names = await cardNames(pl.p);
  const missing = NEW[shop].filter((n) => !names.includes(n));
  check(!missing.length, `${tag}: ${NEW[shop].length} barang baru tampil di ${shop}${missing.length ? ` (tidak ada: ${missing.join(', ')})` : ''}`);
  const off = await pl.p.evaluate(() => [...document.querySelectorAll('.shop .panel .card, .shop .panel .card .btn, .shop .panel .card .incl')].some((e) => { const r = e.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1; }));
  check(!off, `${tag}: kartu & tombol di dalam layar`);
  const icons = await pl.p.evaluate((ns) => ns.map((n) => { const c = [...document.querySelectorAll('.shop .panel .card')].find((e) => e.querySelector('.name')?.textContent.trim() === n); return c?.querySelector('svg')?.innerHTML.length ?? 0; }), NEW[shop]);
  check(icons.every((n) => n > 300), `${tag}: ikon ${NEW[shop].length} barang baru tergambar`);
  if (shop === 'mutiara') {
    // kartu ruangan: "Termasuk: <mebel khas> + dinding & lantai khusus"
    const incl = await pl.p.evaluate((rs) => rs.map(([n]) => [...document.querySelectorAll('.shop .panel .card')].find((e) => e.querySelector('.name')?.textContent.trim() === n)?.querySelector('.incl')?.textContent.trim() ?? ''), Object.values(ROOMS).map((r) => [r.name]));
    check(Object.values(ROOMS).every((r, i) => incl[i] === `Termasuk: ${r.bonusName} + dinding & lantai khusus`), `${tag}: kartu 6 ruangan menyebut barang bonusnya ("${incl[0]}")`);
  }
  if (shot) {
    const first = shop === 'mebel' ? 'Bak Mandi Keramik & Gayung' : 'Bak Mandi Kaki Kucing';
    await card(pl.p, first).evaluate((e) => e.scrollIntoView({ block: 'start' })); await W(400);
    await pl.p.screenshot({ path: `${OUT}/${shot}` });
    if (shop === 'mutiara') { await card(pl.p, 'Ruang Main Anak').evaluate((e) => e.scrollIntoView({ block: 'start' })); await W(400); await pl.p.screenshot({ path: `${OUT}/${shot.replace('.png', '-ruangan.png')}` }); }
  }
}
/** beli satu barang lewat kartu toko (Mutiara, ruangan & barang ≥ 150 koin: ketuk dua kali untuk konfirmasi) */
async function buyCard(pl, name) {
  const before = (await meOf(pl)).wallet;
  const c = card(pl.p, name);
  await c.scrollIntoViewIfNeeded();
  const btn = c.locator('.acts .btn').last();
  await btn.click(); await W(300);
  if (/Yakin/.test(await btn.innerText())) await btn.click();
  await W(1400);
  const me = await meOf(pl);
  return { coin: before.coin - me.wallet.coin, pearl: before.pearl - me.wallet.pearl, me };
}
async function buyApi(pl, ids) { for (const id of ids) { const it = byId[id]; check((await pl.ctx.request.post(BASE + '/api/shop/buy', { data: { itemId: id, currency: it.price_coin > 0 ? 'coin' : 'pearl' } })).ok(), `${pl.name}: beli ${id} (API)`); } }
/** pasang susunan di ruangan (API) */
async function setLayout(pl, roomItem, layout, extra = {}) {
  const me = await meOf(pl);
  const room = roomItem ? me.rooms.find((r) => r.item === roomItem) : me.rooms[0];
  const r = await pl.ctx.request.post(BASE + '/api/room', { data: { roomId: room.id, version: room.version, layout, ...extra } });
  check(r.ok(), `${pl.name}: susunan ${room.name} tersimpan (${layout.length} mebel)${r.ok() ? '' : ` ${await r.text()}`}`);
  const m2 = await meOf(pl);
  return m2.rooms.find((x) => x.id === room.id);
}

const fsel = (rid, i) => `svg.room .furn[data-i="${i}"]${rid ? `[data-r="${rid}"]` : ''}`;
/** keadaan animasi satu elemen: nama, jumlah yang berjalan, transform & stroke-dashoffset sekarang */
const anim = (p, sel) => p.evaluate((s) => {
  const e = document.querySelector(s);
  if (!e) return null;
  const cs = getComputedStyle(e);
  return { name: cs.animationName, running: e.getAnimations().filter((a) => a.playState === 'running').length, tf: `${cs.transform}|${cs.rotate}|${cs.translate}|${cs.strokeDashoffset}|${cs.opacity}` };
}, sel);
async function moving(p, sel, name) {
  const a = await anim(p, sel); await W(160); const c = await anim(p, sel);
  return { ok: !!a && (!name || a.name === name) && a.running > 0 && a.tf !== c?.tf, a, c };
}
/** foto layar di sekitar pet (dpr 2); up = ruang ekstra ke atas (pancuran, ayunan) */
async function shotPet(p, path, up = 0) {
  const r = await p.evaluate(() => { const e = document.querySelector('svg.room g.pet'); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, vw: innerWidth, vh: innerHeight }; });
  if (!r) return;
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2 - up / 2, S = Math.min(Math.max(190, r.w * 2.3) + up, r.vw - 4);
  const x = Math.max(0, Math.min(r.vw - S, cx - S / 2)), y = Math.max(0, Math.min(r.vh - S, cy - S / 2));
  await p.screenshot({ path, clip: { x, y, width: S, height: S } });
}
/** ketuk mebel: tunggu pet berhenti jalan-jalan, lalu klik tepat di elemen mebelnya */
async function tapFurn(p, sel) {
  for (let i = 0; i < 40 && (await p.locator('svg.room.walking').count()); i++) await W(150);
  await p.evaluate((s) => { const e = document.querySelector(s); if (!e) return; const b = e.getBoundingClientRect(); e.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: b.x + b.width / 2, clientY: b.y + b.height / 2 })); }, sel);
  await W(600);
}
/** animasi baru: pet & properti bergerak (nama keyframes), atau diam saat gerak dikurangi */
const NEW_ANIM = {
  gayung: { bob: 'p22-guyur', prop: '.p-gayung', propAnim: 'p22-tuang', more: ['.p-guyur'] },
  shower: { bob: 'p22-bilas', prop: '.p-shower path', propAnim: 'p22-hujan', more: ['.p-busa'] },
  kering: { bob: 'p22-kembang', prop: '.p-bulu', propAnim: 'p22-bulu', more: ['.p-angin path'] },
};
/** ketuk mebel, pilih aktivitas, tunggu pet berpose, periksa animasi; kembali: pesan toast */
async function useActivity(pl, rid, idx, act, pose, mode, tag, shot, opts = {}) {
  const p = pl.p;
  await tapFurn(p, fsel(rid, idx));
  const menuTxt = await p.locator('.roomwrap .menu').innerText().catch(() => '');
  check(menuTxt.includes(act), `${tag}: ketuk mebel → menu "${act}" ("${menuTxt.replace(/\n/g, ' ')}")`);
  await p.locator(`.roomwrap .menu button:has-text("${act}")`).click().catch(() => {});
  let on = false;
  for (let i = 0; i < 160 && !on; i++) { await W(80); on = await p.locator(`svg.room g.pet.pose-${pose}`).count() > 0; }
  check(on, `${tag}: kelas pose-${pose} terpasang pada pet`);
  if (on) {
    const na = NEW_ANIM[pose];
    if (na) {
      check(await p.locator(`svg.room g.pet.pose-${pose} ${na.prop}`).count() >= 1, `${tag}: properti ${na.prop} dibawa pet`);
      for (const m of na.more) check(await p.locator(`svg.room g.pet.pose-${pose} ${m}`).count() >= 1, `${tag}: properti ${m}`);
      const bob = `svg.room g.pet.pose-${pose} .pet-bob`, pr = `svg.room g.pet.pose-${pose} ${na.prop}`;
      if (mode === 'gerak') {
        const m1 = await moving(p, bob, na.bob);
        check(m1.ok, `${tag}: pet beranimasi ${na.bob} (${m1.a?.name}, berjalan ${m1.a?.running})`);
        const m2 = await moving(p, pr, na.propAnim);
        check(m2.ok, `${tag}: properti ${na.prop} bergerak ${na.propAnim} (${m2.a?.name})`);
      } else {
        const a = await anim(p, bob), c = await anim(p, pr);
        check(a?.name === 'none' && a.running === 0 && c?.name === 'none' && c.running === 0, `${tag}: pose diam saat gerak dikurangi (pet ${a?.name}, properti ${c?.name})`);
      }
    }
    if (pose === 'ayun') {
      const m = await moving(p, `${fsel(rid, idx)} .ayk-ayun`, 'p3-ayun');
      check(m.ok, `${tag}: tali & ban berayun bersama pet (${m.a?.name})`);
    }
    if (opts.wait) await W(opts.wait);
    if (shot) await (opts.full ? p.screenshot({ path: shot }) : shotPet(p, shot, opts.up ?? 0));
  }
  const want = opts.toast ?? new RegExp(act.split(' ')[0], 'i');
  const t = await waitToast(p, want);
  check(want.test(t), `${tag}: aktivitas selesai ("${t}")`);
  return t;
}
/** pindah ke ruangan bernama lewat Rumahku */
async function goRoom(p, label) {
  await p.click('.roompill').catch(() => {}); await W(500);
  const pick = p.locator(`.sheet .room:has-text("${label}")`);
  if (await pick.count()) { await pick.first().click(); await W(400); }
  for (let i = 0; i < 40; i++) { await W(250); if ((await p.evaluate(() => document.querySelector('.roompill b')?.textContent ?? '')).includes(label)) break; }
  await W(1600);
}
/** pasang barang dari Tas saat Atur */
async function pasang(p, nm, tag) {
  await p.locator('.editbar .btn', { hasText: /^\s*Tas\s*$/ }).click(); await p.waitForSelector('.sheet .card'); await W(300);
  await p.locator('.sheet .tabbar button:has-text("Mebel")').click().catch(() => {}); await W(200);
  const c = p.locator(`.sheet .card:has(.name:text-is("${nm}"))`);
  check(await c.count() === 1, `${tag}: ${nm} ada di Tas`);
  await c.locator('.btn:has-text("Pasang")').click(); await W(500);
  check(/dipilih/.test(await p.locator('.editbar p').innerText()), `${tag}: ${nm} dipasang dari Tas & terpilih`);
}

/* ---------------- HP 390: Mebel Jati & Toko Mutiara, beli, kamar mandi baru, tiga animasi baru ---------------- */
const A = await mk('Gayung', [390, 844], 8000, 80);
await home(A);
await walkTo(A, 'mebel');
await checkShop(A, 'mebel', '390', 'mebel-mandi-390.png');
let r = await buyCard(A, 'Bak Mandi Keramik & Gayung');
check(r.coin === 180 && (r.me.inventory?.['bak-gayung'] ?? 0) === 1, `beli Bak Mandi Keramik & Gayung dengan konfirmasi (−${r.coin} koin)`);
r = await buyCard(A, 'Shower & Tirai Ikan');
check(r.coin === 230 && (r.me.inventory?.['shower-tirai-ikan'] ?? 0) === 1, `beli Shower & Tirai Ikan (−${r.coin} koin)`);
r = await buyCard(A, 'Pengering Bulu');
check(r.coin === 140 && (r.me.inventory?.['pengering-bulu'] ?? 0) === 1, `beli Pengering Bulu (−${r.coin} koin)`);
r = await buyCard(A, 'Lampu Ubur-ubur');
check(r.coin === 120 && (r.me.inventory?.['lampu-ubur-ubur'] ?? 0) === 1, `beli Lampu Ubur-ubur (−${r.coin} koin)`);
await A.p.locator('.shop .tabbar button', { hasText: 'Dinding' }).first().click(); await W(300);
r = await buyCard(A, 'Dinding Ubin Perahu Layar');
check(r.coin === 70 && (r.me.inventory?.['wp-ubinperahu'] ?? 0) === 1, `beli Dinding Ubin Perahu Layar (−${r.coin} koin)`);
await A.p.locator('.shop .tabbar button', { hasText: 'Lantai' }).first().click(); await W(300);
r = await buyCard(A, 'Lantai Batu Kali Kecil');
check(r.coin === 70 && (r.me.inventory?.['fl-batukalikecil'] ?? 0) === 1, `beli Lantai Batu Kali Kecil (−${r.coin} koin)`);

await walkTo(A, 'mutiara');
await checkShop(A, 'mutiara', '390', 'mutiara-mandi-390.png');
r = await buyCard(A, 'Bak Mandi Kaki Kucing');
check(r.pearl === 12 && (r.me.inventory?.['bak-kaki-kucing'] ?? 0) === 1, `beli Bak Mandi Kaki Kucing dengan Mutiara (−${r.pearl})`);
await A.p.locator('.shop .tabbar button', { hasText: 'Ruangan' }).first().click(); await W(300);
r = await buyCard(A, 'Ruang Main Anak');
let t = await waitToast(A.p, /Kolam Bola/);
check(r.pearl === 12 && /Ruang Main Anak sudah dibangun/.test(t) && /Kolam Bola \+ dinding & lantai khusus sudah masuk Tas/.test(t), `beli Ruang Main Anak (−${r.pearl} Mutiara), toast bonus ("${t}")`);
let main = r.me.rooms.find((x) => x.item === 'ruang-main');
check(!!main && main.wall === 'wp-balonpastel' && main.floor === 'fl-puzzlebusa' && main.size === 5, `Ruang Main Anak dibangun 5×5 berdinding balon & berlantai puzzle (${main?.wall}, ${main?.floor})`);
check(['kolam-bola', 'wp-balonpastel', 'fl-puzzlebusa'].every((id) => r.me.inventory?.[id] === 1), 'Kolam Bola, dinding & lantai khusus masuk Tas (×1)');
check(await card(A.p, 'Ruang Main Anak').locator('.btn:has-text("Lihat")').count() === 1, 'kartu Ruang Main Anak: tombol Lihat (sudah punya)');
r = await buyCard(A, 'Rumah Pohon');
check(r.pearl === 15 && (r.me.inventory?.['ayunan-ban'] ?? 0) === 1 && r.me.rooms.some((x) => x.item === 'rumah-pohon'), `beli Rumah Pohon (−${r.pearl} Mutiara), Ayunan Ban di Tas`);

// kamar: tiga mebel kamar mandi baru (API), lantai & dinding baru; pakai gayung, shower, keringkan bulu
let me = await meOf(A);
let kamar = await setLayout(A, null, [{ i: 'bak-gayung', x: 1, y: 0 }, { i: 'shower-tirai-ikan', x: 3, y: 0 }, { i: 'pengering-bulu', x: 0, y: 2, r: 1 }, { i: 'lampu-ubur-ubur', x: 5, y: 0 }], { wall: 'wp-ubinperahu', floor: 'fl-batukalikecil' });
check(kamar.wall === 'wp-ubinperahu' && kamar.floor === 'fl-batukalikecil', 'kamar: dinding ubin perahu & lantai batu kali kecil');
await home(A);
const ki = (id) => kamar.layout.findIndex((q) => q.i === id);
await useActivity(A, kamar.id, ki('bak-gayung'), 'Mandi gayung', 'gayung', 'gerak', 'mandi gayung', `${OUT}/gayung.png`, { up: 40, toast: /gayung/ });
await useActivity(A, kamar.id, ki('shower-tirai-ikan'), 'Mandi shower', 'shower', 'gerak', 'mandi shower', `${OUT}/shower.png`, { up: 90, toast: /shower/ });
await useActivity(A, kamar.id, ki('pengering-bulu'), 'Keringkan bulu', 'kering', 'gerak', 'keringkan bulu', `${OUT}/kering.png`, { up: 30, toast: /bulu/ });

// Ruang Main Anak: Atur › Tas › Pasang Kolam Bola (mebel khas dari Tas), lalu nyemplung
await home(A);
await goRoom(A.p, 'Ruang Main Anak');
await A.p.click('.btn.act:has-text("Atur")'); await W(800);
check((await A.p.locator('.editbar .ename').textContent().catch(() => '')).includes('Ruang Main Anak'), 'Atur: mengatur Ruang Main Anak');
await pasang(A.p, 'Kolam Bola', 'Atur Ruang Main Anak');
await A.p.click('.editbar .btn:has-text("Selesai")'); await W(1400);
me = await meOf(A);
main = me.rooms.find((x) => x.item === 'ruang-main');
const kb = main.layout.findIndex((q) => q.i === 'kolam-bola');
check(kb >= 0 && (me.inventory?.['kolam-bola'] ?? 0) === 0, 'Kolam Bola terpasang di Ruang Main Anak (keluar dari Tas)');
await home(A);
await goRoom(A.p, 'Ruang Main Anak');
await useActivity(A, main.id, kb, 'Nyemplung kolam bola', 'duduk', 'gerak', 'nyemplung kolam bola', null, { toast: /kolam bola/ });

/* ---------------- prefers-reduced-motion: tiga animasi baru diam ---------------- */
const R = await mk('Diam', [390, 844], 3000, 0, { reducedMotion: 'reduce' });
await buyApi(R, ['bak-gayung', 'shower-tirai-ikan', 'pengering-bulu']);
const rr = await setLayout(R, null, [{ i: 'bak-gayung', x: 1, y: 0 }, { i: 'shower-tirai-ikan', x: 3, y: 0 }, { i: 'pengering-bulu', x: 0, y: 2 }]);
await home(R);
const rI = (id) => rr.layout.findIndex((q) => q.i === id);
await useActivity(R, rr.id, rI('bak-gayung'), 'Mandi gayung', 'gayung', 'diam', 'reduced-motion mandi gayung', null, { toast: /gayung/ });
await useActivity(R, rr.id, rI('shower-tirai-ikan'), 'Mandi shower', 'shower', 'diam', 'reduced-motion mandi shower', null, { toast: /shower/ });
await useActivity(R, rr.id, rI('pengering-bulu'), 'Keringkan bulu', 'kering', 'diam', 'reduced-motion keringkan bulu', null, { toast: /bulu/ });
const lamp = await anim(R.p, 'svg.room .ed-glow');
check(!lamp || (lamp.name === 'none' && lamp.running === 0), `reduced-motion: cahaya lampu & hiasan bergerak diam (${lamp?.name ?? 'tidak ada'})`);

/* ---------------- kamar mandi baru berperabot (HP 390 & desktop 1366) ---------------- */
const KM = await mk('Busa', [390, 844], 6000, 30);
await buyApi(KM, ['kamar-mandi', 'bak-gayung', 'shower-tirai-ikan', 'bak-kaki-kucing', 'rak-sabun-sampo', 'pengering-bulu', 'keranjang-cucian', 'lampu-ubur-ubur', 'pot-lidah-mertua', 'ember-rendam-kaki', 'rak-mainan-mandi', 'mesin-gelembung', 'wp-ubinperahu', 'fl-batukalikecil']);
const km = await setLayout(KM, 'kamar-mandi', [
  { i: 'shower-tirai-ikan', x: 0, y: 0 }, { i: 'bak-gayung', x: 1, y: 0 }, { i: 'bak-kaki-kucing', x: 2, y: 0 }, { i: 'rak-sabun-sampo', x: 0, y: 1, r: 1 },
  { i: 'pengering-bulu', x: 0, y: 2, r: 1 }, { i: 'keranjang-cucian', x: 0, y: 3 }, { i: 'lampu-ubur-ubur', x: 3, y: 1 }, { i: 'rak-mainan-mandi', x: 3, y: 2, r: 1 },
  { i: 'pot-lidah-mertua', x: 3, y: 3 }, { i: 'mesin-gelembung', x: 2, y: 3, r: 2 },
], { wall: 'wp-ubinperahu', floor: 'fl-batukalikecil' });
check(km.layout.length === 10, 'kamar mandi: 10 mebel baru tersimpan');
await home(KM);
await goRoom(KM.p, 'Kamar Mandi');
// pet berendam busa di bak kaki kucing saat difoto
await useActivity(KM, km.id, km.layout.findIndex((q) => q.i === 'bak-kaki-kucing'), 'Berendam busa', 'mandi', 'gerak', 'berendam busa', `${OUT}/kamar-mandi-baru-390.png`, { full: true, wait: 600, toast: /busa/ });
const KMD = await view(KM, [1366, 820]);
await home(KMD);
await goRoom(KMD.p, 'Kamar Mandi');
await useActivity(KMD, km.id, km.layout.findIndex((q) => q.i === 'mesin-gelembung'), 'Main gelembung', 'lihat', 'gerak', 'desktop main gelembung', `${OUT}/kamar-mandi-baru-1366.png`, { full: true, toast: /gelembung/ });

/* ---------------- HP 320: dua toko, beli lewat kartu ---------------- */
const B = await mk('Sabun', [320, 568], 1500, 40);
await home(B);
await walkTo(B, 'mebel');
await checkShop(B, 'mebel', '320');
r = await buyCard(B, 'Rak Sabun & Sampo');
check(r.coin === 60 && (r.me.inventory?.['rak-sabun-sampo'] ?? 0) === 1, `HP 320: beli Rak Sabun & Sampo (−${r.coin} koin)`);
await walkTo(B, 'mutiara');
await checkShop(B, 'mutiara', '320', 'mutiara-mandi-320.png');
await B.p.locator('.shop .tabbar button', { hasText: 'Ruangan' }).first().click(); await W(300);
r = await buyCard(B, 'Studio Karaoke');
t = await waitToast(B.p, /Mesin Karaoke/);
check(r.pearl === 15 && (r.me.inventory?.['mesin-karaoke'] ?? 0) === 1, `HP 320: beli Studio Karaoke (−${r.pearl}), toast "${t}"`);

/* ---------------- desktop 1366: dua toko ---------------- */
const C = await mk('Gajah', [1366, 820], 3000, 40);
await home(C);
for (const shop of ['mebel', 'mutiara']) { await walkTo(C, shop); await checkShop(C, shop, '1366', `${shop === 'mebel' ? 'mebel' : 'mutiara'}-mandi-1366.png`); }
r = await buyCard(C, 'Pancuran Gajah');
check(r.pearl === 15 && (r.me.inventory?.['pancuran-gajah'] ?? 0) === 1, `desktop: beli Pancuran Gajah (−${r.pearl} Mutiara)`);
const pg = await setLayout(C, null, [{ i: 'pancuran-gajah', x: 2, y: 1 }]);
await home(C);
await useActivity(C, pg.id, 0, 'Mandi di pancuran gajah', 'shower', 'gerak', 'desktop pancuran gajah', `${OUT}/pancuran-gajah.png`, { up: 120, toast: /gajah/ });

/* ---------------- rumah 12 ruangan: semua ruangan Mutiara, mebel khas dipakai; rumah tampil utuh ---------------- */
const D = await mk('Duabelas', [390, 844], 20000, 200);
await buyApi(D, ['ruang-tamu', 'dapur', 'kamar-mandi', 'halaman', 'loteng', ...Object.keys(ROOMS)]);
me = await meOf(D);
check(me.rooms.length === 12, `rumah 12 ruangan (${me.rooms.length})`);
check(Object.values(ROOMS).every((x) => me.inventory?.[x.bonus] === 1), 'mebel khas keenam ruangan ada di Tas');
// tiap ruangan Mutiara: mebel khas + beberapa mebel lain
const EXTRA = { 'ruang-main': ['rak-mainan-mandi', 'mesin-gelembung'], 'rumah-pohon': ['pot-lidah-mertua', 'keranjang-cucian'], 'studio-karaoke': ['lampu-ubur-ubur'], 'rumah-kaca': ['pot-lidah-mertua', 'ember-rendam-kaki'], 'air-panas': ['rak-sabun-sampo', 'ember-rendam-kaki'], 'ruang-akuarium': ['lampu-ubur-ubur', 'mesin-gelembung'] };
await buyApi(D, Object.values(EXTRA).flat());
const placed = {};
for (const [id, x] of Object.entries(ROOMS)) {
  const lay = [{ i: x.bonus, ...x.at }];
  EXTRA[id].forEach((e, k) => lay.push({ i: e, x: k === 0 ? 0 : 4, y: 0 }));
  placed[id] = await setLayout(D, id, lay);
}
await home(D);
for (const [id, x] of Object.entries(ROOMS)) {
  await goRoom(D.p, x.name);
  const room = placed[id];
  await useActivity(D, room.id, 0, x.act, x.pose, 'gerak', `${x.name}: ${x.act}`, `${OUT}/${x.shot}`, { full: true, wait: x.pose === 'ayun' ? 300 : 700, toast: new RegExp(x.act.split(' ').slice(-1)[0], 'i') });
}
// Rumahku: 12/12, lihat seluruh rumah, Atur denah 12 ruangan (HP 390, 320, desktop 1366)
for (const vp of [[390, 844], [320, 568], [1366, 820]]) {
  const V = vp[0] === 390 ? D : await view(D, vp);
  await home(V);
  await V.p.click('.roompill'); await W(600);
  const txt = await V.p.locator('.sheet').innerText();
  check(/12\/12 ruangan/.test(txt) && (await V.p.locator('.sheet .room').count()) === 12, `${vp[0]}: Rumahku menampilkan 12/12 ruangan`);
  await V.p.locator('.sheet .btn:has-text("Lihat seluruh rumah")').click(); await W(2200);
  const n = await V.p.evaluate(() => new Set([...document.querySelectorAll('svg.room [data-r]')].map((e) => e.getAttribute('data-r'))).size);
  check(n === 12, `${vp[0]}: rumah 12 ruangan tergambar (${n})`);
  if (vp[0] !== 320) await V.p.screenshot({ path: `${OUT}/rumah-12-ruangan-${vp[0]}.png` });
  await V.p.click('.roompill'); await W(600);
  await V.p.locator('.sheet .btn:has-text("Atur denah")').click(); await W(1500);
  const chips = await V.p.locator('.planbar .pick .chip').count(), labels = await V.p.locator('.plabel').count();
  // tombol bawah di dalam layar; deretan pilihan ruangan bisa digeser (gulir mendatar) sampai pilihan terakhir
  const off = await V.p.evaluate(() => [...document.querySelectorAll('.planbar .row .btn, .planbar .pick')].some((e) => { const r = e.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1 || r.bottom > innerHeight + 1; }));
  const lastChip = await V.p.evaluate(() => { const pk = document.querySelector('.planbar .pick'), c = [...document.querySelectorAll('.planbar .pick .chip')].pop(); if (!pk || !c) return false; c.scrollIntoView({ inline: 'end', block: 'nearest' }); const a = pk.getBoundingClientRect(), b = c.getBoundingClientRect(); return b.right <= a.right + 1 && b.left >= a.left - 1; });
  check(chips === 12 && labels === 12 && !off && lastChip, `${vp[0]}: Atur denah menampilkan 12 ruangan (pilihan ${chips}, label ${labels}), tombol di dalam layar, pilihan terakhir bisa digulir`);
  await V.p.locator('.planbar .pick .chip').last().click(); await W(600);
  check(/dipilih/.test(await V.p.locator('.planbar p').first().innerText()), `${vp[0]}: Atur denah: ruangan ke-12 bisa dipilih`);
  await V.p.screenshot({ path: `${OUT}/atur-denah-12-${vp[0]}.png` });
  await V.p.locator('.planbar .btn:has-text("Batal")').click(); await W(800);
  check(!(await V.p.locator('.planbar').count()), `${vp[0]}: Atur denah ditutup (Batal)`);
}

check(!errors.length, `tanpa galat halaman / 5xx${errors.length ? `: ${errors.join(' | ')}` : ''}`);
await b.close();
console.log(fails.length ? `\n${fails.length} GAGAL` : '\nSemua lulus');
process.exit(fails.length ? 1 : 0);
