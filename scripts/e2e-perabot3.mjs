// Uji perabot dapur, kamar mandi & taman (paket konten 20): berjalan ke Mebel Jati dan Toko Bangunan lewat peta, semua
// barang baru tampil di toko (HP 390 & 320, desktop 1366); beli dengan koin (koin diberi admin); pasang lewat Atur
// (Tas › Pasang, Putar, Selesai); dinding & lantai baru lewat Tas › Dekor; pakai aktivitas dengan tiga animasi baru:
// sikat gigi di wastafel (sikat), cuci piring di bak cuci (cuci), main ayunan di halaman (ayun) — kelas pose terpasang,
// animasinya berjalan (nama animasi & posisi berubah), pet & tali + dudukan ayunan berayun seirama; drum mesin cuci
// berputar. Dengan prefers-reduced-motion dan dengan Pengaturan › Kurangi animasi
// semua pose itu diam (animation-name none). Tidak ada galat halaman / 5xx.
// Jalankan server dulu dengan admin (ADMIN_EMAIL & ADMIN_PASSWORD), lalu: BASE_URL=http://localhost:8787 npm run test:e2e:perabot3
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, request } = require('playwright');
const BASE = (process.env.BASE_URL ?? 'http://localhost:8787').replace(/\/$/, ''), OUT = process.env.SHOTS ?? 'test-results/e2e-perabot3';
const ADMIN = { email: process.env.ADMIN_EMAIL ?? 'owner@bupi.test', password: process.env.ADMIN_PASSWORD ?? 'rahasia-sekali-123' };
mkdirSync(OUT, { recursive: true });
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [], errors = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'GAGAL'} ${msg}`); if (!ok) fails.push(msg); };

/** barang baru per toko (nama di kartu toko) */
const NEW = {
  mebel: ['Dandang & Kukusan', 'Penanak Nasi', 'Galon & Dispenser', 'Blender Jus', 'Rak Bumbu & Cobek', 'Bak Cuci Piring', 'Tempat Sampah Pilah', 'Meja Makan Taplak Kotak', 'Dinding Keramik Dapur', 'Lantai Tegel Catur',
    'Wastafel & Cermin', 'Baskom Bebek Karet', 'Ember & Papan Gilas', 'Mesin Cuci', 'Timbangan Badan', 'Gantungan Handuk Bambu', 'Keset Kaki', 'Dinding Keramik Biru Laut', 'Lantai Mozaik'],
  bangunan: ['Ayunan Kayu', 'Hamak', 'Meja Piknik', 'Bedeng Cabai & Tomat', 'Sangkar Burung', 'Bak Pasir', 'Tempat Minum Burung', 'Gerobak Bunga', 'Pagar Tanaman', 'Lantai Rumput Berbunga'],
};
const FIRST = { mebel: 'Dandang & Kukusan', bangunan: 'Ayunan Kayu' };

const adm = await request.newContext({ baseURL: BASE });
check((await adm.post('/api/admin/login', { data: ADMIN })).ok(), 'admin masuk');
const cat = await (await adm.get('/api/catalog')).json();
const byName = Object.fromEntries(cat.items.map((i) => [i.name, i]));
const byId = Object.fromEntries(cat.items.map((i) => [i.id, i]));
for (const [shop, names] of Object.entries(NEW)) check(names.every((n) => byName[n]?.shop === shop && byName[n].price_coin > 0 && !byName[n].price_pearl), `katalog: ${names.length} barang baru di toko ${shop} dengan harga koin`);
const acts = Object.fromEntries((cat.activities ?? []).map((a) => [a.id, a]));
check(acts['sikat-gigi']?.anim === 'sikat' && acts['cuci-piring']?.anim === 'cuci' && acts['main-ayunan-kayu']?.anim === 'ayun', 'katalog: aktivitas sikat gigi, cuci piring, main ayunan memakai animasi baru');

const b = await chromium.launch();
async function mk(name, vp, coins, opts = {}) {
  const mobile = vp[0] < 900;
  // dpr 2: foto layar tajam untuk paket desain
  const ctx = await b.newContext({ viewport: { width: vp[0], height: vp[1] }, deviceScaleFactor: 2, hasTouch: mobile, isMobile: mobile, ...opts });
  await ctx.addInitScript(() => { try { localStorage.setItem('kb-save-snooze', String(Date.now() + 9e9)); localStorage.setItem('kb-push-asked', String(Date.now() + 9e9)); localStorage.setItem('kb-news-seen', '["*"]'); localStorage.setItem('kb-ajak', JSON.stringify({ day: new Date().toLocaleDateString('en-CA'), n: 9, last: Date.now(), nanti: 0, mute: true, alunAt: 0 })); } catch {} });
  await ctx.request.post(BASE + '/api/auth/guest', { data: {} });
  await ctx.request.post(BASE + '/api/pet', { data: { name, color: '#F6B7A8', ear: 'kucing' } });
  await ctx.request.post(BASE + '/api/daily', { data: {} });
  const me = await (await ctx.request.get(BASE + '/api/me')).json();
  check((await adm.post(`/api/admin/players/${me.user.id}/wallet`, { data: { currency: 'coin', delta: coins, reason: 'uji perabot dapur, kamar mandi & taman' } })).ok(), `${name}: admin memberi ${coins} koin`);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  p.on('response', (res) => { if (res.url().includes('/api/') && res.status() >= 500) errors.push(`${name}: ${res.status()} ${res.url()}`); });
  return { ctx, p, me, name, vp };
}
const meOf = async (pl) => (await pl.ctx.request.get(BASE + '/api/me')).json();
const closeSheets = async (p) => { for (let i = 0; i < 3; i++) { const x = p.locator('.sheet .x'); if (await x.count()) { await x.first().click().catch(() => {}); await W(300); } } };
const home = async (pl) => { await pl.p.goto(`${BASE}/?r=${Math.random().toString(36).slice(2)}`); await pl.p.waitForSelector('.dock', { timeout: 20000 }); await W(1200); await closeSheets(pl.p); };
const toastText = async (p) => (await p.locator('.toast').allInnerTexts().catch(() => [])).join(' | ');
const waitToast = async (p, re) => { let t = ''; for (let i = 0; i < 40 && !re.test(t); i++) { await W(300); t = await toastText(p); } return t; };

/** dari peta kampung: pet berjalan ke toko, lalu masuk */
async function walkTo(pl, shop) {
  await pl.p.goto(`${BASE}/?r=${shop}${Math.random().toString(36).slice(2, 6)}#map`);
  await pl.p.waitForSelector(`.loc[data-loc="${shop}"]`, { timeout: 20000 }); await W(800); await closeSheets(pl.p);
  await pl.p.locator(`.loc[data-loc="${shop}"]`).dispatchEvent('click');
  await pl.p.waitForSelector('.shop .panel', { timeout: 20000 }); await W(600);
}
const cardNames = (p) => p.evaluate(() => [...document.querySelectorAll('.shop .panel .card .name')].map((e) => e.textContent.trim()));
const card = (p, name) => p.locator(`.shop .panel .card:has(.name:text-is("${name}"))`);
/** cek toko: semua barang baru tampil, kartu tidak keluar layar; foto layar dengan barang baru pertama di atas */
async function checkShop(pl, shop, tag) {
  const names = await cardNames(pl.p);
  const missing = NEW[shop].filter((n) => !names.includes(n));
  check(!missing.length, `${tag}: ${NEW[shop].length} barang baru tampil di ${shop}${missing.length ? ` (tidak ada: ${missing.join(', ')})` : ''}`);
  const off = await pl.p.evaluate(() => [...document.querySelectorAll('.shop .panel .card')].some((e) => { const r = e.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1; }));
  check(!off, `${tag}: kartu barang di dalam layar`);
  // ikon barang baru tergambar (svg tidak kosong)
  const icons = await pl.p.evaluate((ns) => ns.map((n) => { const c = [...document.querySelectorAll('.shop .panel .card')].find((e) => e.querySelector('.name')?.textContent.trim() === n); return c?.querySelector('svg')?.innerHTML.length ?? 0; }), NEW[shop]);
  check(icons.every((n) => n > 300), `${tag}: ikon ${NEW[shop].length} barang baru tergambar`);
  await pl.p.locator('.shop .tabbar button', { hasText: 'Mebel' }).first().click(); await W(300);
  check((await cardNames(pl.p)).includes(FIRST[shop]), `${tag}: tab Mebel memuat ${FIRST[shop]}`);
  await card(pl.p, FIRST[shop]).evaluate((e) => e.scrollIntoView({ block: 'start' })); await W(400);
  await pl.p.screenshot({ path: `${OUT}/toko-${shop}-${tag}.png` });
  // barang baru di tengah daftar juga (dapur / kamar mandi, benda taman lain)
  const mid = shop === 'mebel' ? 'Wastafel & Cermin' : 'Sangkar Burung';
  await card(pl.p, mid).evaluate((e) => e.scrollIntoView({ block: 'start' })); await W(400);
  await pl.p.screenshot({ path: `${OUT}/toko-${shop}-${tag}-b.png` });
  await pl.p.locator('.shop .tabbar button').first().click(); await W(300);
}
/** beli satu barang lewat kartu toko (barang ≥ 150 koin: ketuk dua kali untuk konfirmasi) */
async function buyCard(pl, name) {
  const before = (await meOf(pl)).wallet.coin;
  const c = card(pl.p, name);
  await c.scrollIntoViewIfNeeded();
  const btn = c.locator('.acts .btn').last();
  await btn.click(); await W(300);
  if (/Yakin/.test(await btn.innerText())) await btn.click();
  await W(1200);
  const me = await meOf(pl);
  return { spent: before - me.wallet.coin, me };
}
/** beli lewat API & pasang di ruangan lewat API (untuk pemain uji gerak) */
async function buyApi(pl, ids) { for (const id of ids) check((await pl.ctx.request.post(BASE + '/api/shop/buy', { data: { itemId: id, currency: 'coin' } })).ok(), `${pl.name}: beli ${id} (API)`); }
/** cari petak kosong untuk mebel w×d di ruangan (sisakan satu baris kosong di depannya untuk pet) */
function freeSpot(room, w, d, taken) {
  const occ = new Set(taken);
  for (const q of room.layout) { const it = byId[q.i]; if (!it || it.data?.flat) continue; const r = q.r ?? 0, fw = r % 2 ? it.data.d ?? 1 : it.data.w ?? 1, fd = r % 2 ? it.data.w ?? 1 : it.data.d ?? 1; for (let a = 0; a < fw; a++) for (let c = 0; c < fd; c++) occ.add(`${q.x + a},${q.y + c}`); }
  const size = room.size ?? 6;
  for (let y = 0; y + d <= size - 1; y++)
    for (let x = 0; x + w <= size; x++) {
      let ok = true;
      for (let a = 0; a < w && ok; a++) for (let c = 0; c <= d && ok; c++) if (occ.has(`${x + a},${y + c}`)) ok = false;
      if (ok) { for (let a = 0; a < w; a++) for (let c = 0; c < d; c++) taken.push(`${x + a},${y + c}`); return { x, y }; }
    }
  return null;
}
async function placeApi(pl, ids) {
  const me = await meOf(pl);
  const room = (me.rooms ?? [me.room])[0], taken = [], lay = [...room.layout];
  for (const id of ids) { const it = byId[id], s = freeSpot({ ...room, layout: lay }, it.data.w ?? 1, it.data.d ?? 1, taken); if (s) lay.push({ i: id, x: s.x, y: s.y }); }
  const r = await pl.ctx.request.post(BASE + '/api/room', { data: { roomId: room.id || undefined, version: room.version, layout: lay } });
  check(r.ok(), `${pl.name}: ${ids.length} mebel dipasang di kamar (API)`);
  const m2 = await meOf(pl);
  return (m2.rooms ?? [m2.room])[0];
}

const fsel = (rid, i) => `svg.room .furn[data-i="${i}"]${rid ? `[data-r="${rid}"]` : ''}`;
/** keadaan animasi satu elemen: nama, jumlah yang berjalan, transform sekarang, visibility */
const anim = (p, sel) => p.evaluate((s) => {
  const e = document.querySelector(s);
  if (!e) return null;
  const cs = getComputedStyle(e);
  return { name: cs.animationName, running: e.getAnimations().filter((a) => a.playState === 'running').length, tf: `${cs.transform}|${cs.rotate}|${cs.translate}`, vis: cs.visibility };
}, sel);
/** bergerak: animasi bernama, berjalan, dan transform-nya berubah */
async function moving(p, sel, name) {
  const a = await anim(p, sel); await W(160); const c = await anim(p, sel);
  return { ok: !!a && (!name || a.name === name) && a.running > 0 && a.tf !== c?.tf, a, c };
}
/** foto layar di sekitar pet (dpr 2), tinggi ekstra ke atas untuk ayunan */
async function shotPet(p, path, up = 0) {
  const r = await p.evaluate(() => { const e = document.querySelector('svg.room g.pet'); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, vw: innerWidth, vh: innerHeight }; });
  if (!r) return;
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2 - up / 2, S = Math.min(Math.max(170, r.w * 2.1) + up, r.vw - 4);
  const x = Math.max(0, Math.min(r.vw - S, cx - S / 2)), y = Math.max(0, Math.min(r.vh - S, cy - S / 2));
  await p.screenshot({ path, clip: { x, y, width: S, height: S } });
}
/**
 * Ketuk mebel, pilih aktivitas, tunggu pet berpose, lalu periksa animasinya. mode: 'gerak' (harus bergerak) atau
 * 'diam' (reduced motion / Kurangi animasi). Kembali: pesan toast.
 */
/** ketuk mebel: tunggu pet berhenti jalan-jalan, lalu klik tepat di elemen mebelnya (tidak tertutup pet di depannya) */
async function tapFurn(p, sel) {
  for (let i = 0; i < 40 && (await p.locator('svg.room.walking').count()); i++) await W(150);
  await p.evaluate((s) => { const e = document.querySelector(s); if (!e) return; const b = e.getBoundingClientRect(); e.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: b.x + b.width / 2, clientY: b.y + b.height / 2 })); }, sel);
  await W(600);
}
async function useActivity(pl, rid, idx, act, pose, mode, tag, shot) {
  const p = pl.p;
  await tapFurn(p, fsel(rid, idx));
  const menuTxt = await p.locator('.menu').innerText().catch(() => '');
  check(menuTxt.includes(act), `${tag}: ketuk mebel → menu "${act}" ("${menuTxt.replace(/\n/g, ' ')}")`);
  await p.locator(`.menu button:has-text("${act}")`).click();
  let on = false;
  for (let i = 0; i < 160 && !on; i++) { await W(80); on = await p.locator(`svg.room g.pet.pose-${pose}`).count() > 0; }
  check(on, `${tag}: kelas pose-${pose} terpasang pada pet`);
  if (on) {
    const prop = { ayun: '.p-ayun', sikat: '.p-sikat', cuci: '.p-cuci' }[pose];
    // ayun: yang berayun adalah pet utuh (.pet-hop) bersama tali & dudukan mebelnya (.ayk-ayun); lainnya badan & properti
    const bob = pose === 'ayun' ? `svg.room g.pet.pose-ayun > .pet-hop` : `svg.room g.pet.pose-${pose} .pet-bob`;
    const pr = pose === 'ayun' ? `${fsel(rid, idx)} .ayk-ayun` : `svg.room g.pet.pose-${pose} ${prop}`;
    check(await p.locator(`svg.room g.pet.pose-${pose} ${prop}`).count() === 1, `${tag}: properti ${prop} dibawa pet`);
    if (mode === 'gerak') {
      const m1 = await moving(p, bob, `p3-${pose}`);
      check(m1.ok, `${tag}: pet beranimasi p3-${pose} (${m1.a?.name}, berjalan ${m1.a?.running}, bergerak ${m1.a?.tf !== m1.c?.tf})`);
      const m2 = await moving(p, pr, { ayun: 'p3-ayun', sikat: 'p3-gosok', cuci: 'p3-spons' }[pose]);
      check(m2.ok, `${tag}: ${pose === 'ayun' ? 'tali & dudukan ayunan' : `properti ${prop}`} ikut bergerak (${m2.a?.name})`);
      if (pose === 'ayun') {
        // seirama: sudut putar pet & dudukan sama pada saat yang sama (dibaca bersamaan)
        const ang = await p.evaluate(([a, b]) => [a, b].map((s) => { const m = new DOMMatrix(getComputedStyle(document.querySelector(s)).transform); return Math.round((Math.atan2(m.b, m.a) * 180) / Math.PI * 10) / 10; }), [bob, pr]);
        check(Math.abs(ang[0] - ang[1]) < 1.5 && Math.abs(ang[0]) > 0.1, `${tag}: pet & dudukan berayun seirama (sudut ${ang[0]}° & ${ang[1]}°)`);
      }
    } else {
      const a = await anim(p, bob), c = await anim(p, pr);
      check(a?.name === 'none' && a.running === 0 && c?.name === 'none' && c.running === 0, `${tag}: pose diam (pet ${a?.name}, ${pose === 'ayun' ? 'dudukan' : 'properti'} ${c?.name})`);
    }
    if (shot) await shotPet(p, shot, pose === 'ayun' ? 90 : 0);
  }
  const want = { sikat: /sikat gigi/, cuci: /mencuci|cuci/, ayun: /main ayunan/ }[pose];
  const t = await waitToast(p, want);
  check(want.test(t), `${tag}: aktivitas selesai ("${t}")`);
  if (pose === 'ayun') {
    await W(400);
    const seat = await anim(p, `${fsel(rid, idx)} .ayk-ayun`);
    check(seat?.name === 'none' && seat.running === 0, `${tag}: setelah selesai dudukan ayunan diam lagi (${seat?.name})`);
  }
  return t;
}
/** tunggu sampai sedang berada di ruangan bernama */
async function goRoom(p, label) {
  await p.click('.roompill').catch(() => {}); await W(400);
  const pick = p.locator(`.sheet .room:has-text("${label}")`);
  if (await pick.count()) { await pick.first().click(); await W(400); }
  for (let i = 0; i < 40; i++) { await W(250); if ((await p.evaluate(() => document.querySelector('.roompill b')?.textContent ?? '')).includes(label)) break; }
  await W(900);
}
/** pasang barang dari Tas saat Atur */
async function pasang(p, nm, tag) {
  await p.locator('.editbar .btn', { hasText: /^\s*Tas\s*$/ }).click(); await p.waitForSelector('.sheet .card'); await W(300);
  await p.locator('.sheet .tabbar button:has-text("Mebel")').click().catch(() => {}); await W(200);
  await p.locator(`.sheet .card:has(.name:text-is("${nm}")) .btn:has-text("Pasang")`).click(); await W(500);
  check(/dipilih/.test(await p.locator('.editbar p').innerText()), `${tag}: ${nm} dipasang dari Tas & terpilih`);
}
/** pasang dinding / lantai dari Tas › Dekor */
async function dekor(pl, nm) {
  await pl.p.goto(`${BASE}/?r=d${Math.random().toString(36).slice(2, 6)}#bag`); await pl.p.waitForSelector('.sheet .tabbar'); await W(500);
  await pl.p.click('.sheet .tabbar button:has-text("Dekor")'); await W(300);
  await pl.p.locator(`.sheet .card:has(.name:text-is("${nm}")) .btn`).click(); await W(1200);
}

/* ---------------- HP 390: dua toko, beli, Atur, dekor, tiga animasi baru, halaman ---------------- */
const A = await mk('Lapis', [390, 844], 6000);
await home(A);
await walkTo(A, 'mebel');
await checkShop(A, 'mebel', '390');
let r = await buyCard(A, 'Wastafel & Cermin');
check(r.spent === 130 && (r.me.inventory?.['wastafel-cermin'] ?? 0) === 1, `beli Wastafel & Cermin di Mebel Jati (−${r.spent} koin)`);
r = await buyCard(A, 'Bak Cuci Piring');
check(r.spent === 150 && (r.me.inventory?.['bak-cuci-piring'] ?? 0) === 1, `beli Bak Cuci Piring dengan konfirmasi (−${r.spent} koin)`);
r = await buyCard(A, 'Mesin Cuci');
check(r.spent === 190 && (r.me.inventory?.['mesin-cuci'] ?? 0) === 1, `beli Mesin Cuci dengan konfirmasi (−${r.spent} koin)`);
r = await buyCard(A, 'Keset Kaki');
check(r.spent === 20 && (r.me.inventory?.['keset-kaki'] ?? 0) === 1, `beli Keset Kaki (−${r.spent} koin)`);
await A.p.locator('.shop .tabbar button', { hasText: 'Lantai' }).first().click(); await W(300);
r = await buyCard(A, 'Lantai Mozaik');
check(r.spent === 120 && (r.me.inventory?.['fl-mozaik'] ?? 0) === 1, `beli Lantai Mozaik (−${r.spent} koin)`);
await A.p.locator('.shop .tabbar button', { hasText: 'Dinding' }).first().click(); await W(300);
r = await buyCard(A, 'Dinding Keramik Biru Laut');
check(r.spent === 110 && (r.me.inventory?.['wp-keramikbiru'] ?? 0) === 1, `beli Dinding Keramik Biru Laut (−${r.spent} koin)`);

await walkTo(A, 'bangunan');
await checkShop(A, 'bangunan', '390');
r = await buyCard(A, 'Ayunan Kayu');
check(r.spent === 180 && (r.me.inventory?.['ayunan-kayu'] ?? 0) === 1, `beli Ayunan Kayu di Toko Bangunan dengan konfirmasi (−${r.spent} koin)`);
r = await buyCard(A, 'Pagar Tanaman');
check(r.spent === 45 && (r.me.inventory?.['pagar-tanaman'] ?? 0) === 1, `beli Pagar Tanaman (−${r.spent} koin)`);
await A.p.locator('.shop .tabbar button', { hasText: 'Lantai' }).first().click(); await W(300);
r = await buyCard(A, 'Lantai Rumput Berbunga');
check(r.spent === 90 && (r.me.inventory?.['fl-rumputbunga'] ?? 0) === 1, `beli Lantai Rumput Berbunga (−${r.spent} koin)`);

// Atur: pasang wastafel, bak cuci, mesin cuci, keset dari Tas; mesin cuci diputar sekali; Selesai
await home(A);
await A.p.click('.btn.act:has-text("Atur")'); await W(700);
for (const nm of ['Wastafel & Cermin', 'Bak Cuci Piring', 'Keset Kaki', 'Mesin Cuci']) await pasang(A.p, nm, 'Atur');
await A.p.click('.editbar .rotbtn'); await W(300);
await A.p.screenshot({ path: `${OUT}/atur-390.png` });
await A.p.click('.editbar .btn:has-text("Selesai")'); await W(1200);
let me = await meOf(A);
let room = (me.rooms ?? [me.room])[0];
const idx = (id) => room.layout.findIndex((q) => q.i === id);
check(['wastafel-cermin', 'bak-cuci-piring', 'keset-kaki', 'mesin-cuci'].every((id) => idx(id) >= 0), 'Selesai: wastafel, bak cuci, keset & mesin cuci tersimpan di kamar');
check(room.layout[idx('mesin-cuci')]?.r === 1, `mesin cuci tersimpan diputar 1× (r: ${room.layout[idx('mesin-cuci')]?.r})`);
// dinding & lantai baru
await dekor(A, 'Lantai Mozaik');
await dekor(A, 'Dinding Keramik Biru Laut');
me = await meOf(A); room = (me.rooms ?? [me.room])[0];
check(room.floor === 'fl-mozaik' && room.wall === 'wp-keramikbiru', `Dekor: lantai mozaik & dinding keramik biru terpasang (${room.floor}, ${room.wall})`);
await home(A);
const rid = room.id;
// drum mesin cuci berputar (kelas swim di pintu)
const drum = `${fsel(rid, idx('mesin-cuci'))} .swim`;
const dm = await moving(A.p, drum);
check(dm.ok && /swim/.test(dm.a?.name ?? ''), `drum mesin cuci berputar (${dm.a?.name}, berjalan ${dm.a?.running})`);
{
  // tunggu kamera berhenti bergeser, lalu foto mesin cucinya
  await W(1500);
  const bx = await A.p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const q = e.getBoundingClientRect(); return { x: q.x, y: q.y - q.height * 0.6, w: q.width, h: q.height }; }, drum);
  if (bx) { const S = Math.max(170, Math.max(bx.w, bx.h) + 50); await A.p.screenshot({ path: `${OUT}/pose-drum.png`, clip: { x: Math.max(0, bx.x + bx.w / 2 - S / 2), y: Math.max(0, bx.y + bx.h / 2 - S / 2), width: S, height: S } }); }
}
// sikat gigi (sikat) & cuci piring (cuci)
await useActivity(A, rid, idx('wastafel-cermin'), 'Sikat gigi', 'sikat', 'gerak', 'sikat gigi', `${OUT}/pose-sikat.png`);
const coinBefore = (await meOf(A)).wallet.coin;
await useActivity(A, rid, idx('bak-cuci-piring'), 'Cuci piring', 'cuci', 'gerak', 'cuci piring', `${OUT}/pose-cuci.png`);
check((await meOf(A)).wallet.coin === coinBefore + 2, 'cuci piring: +2 koin');
await A.p.screenshot({ path: `${OUT}/kamar-390.png` });

// halaman: bangun lewat API, pasang ayunan & pagar tanaman lewat Atur (ketuk halaman saat Atur), main ayunan
check((await A.ctx.request.post(BASE + '/api/shop/buy', { data: { itemId: 'halaman', currency: 'coin' } })).ok(), 'halaman dibangun (API)');
me = await meOf(A);
const hal = me.rooms.find((x) => x.item === 'halaman');
check(!!hal, 'halaman ada di rumah');
await home(A);
await A.p.click('.btn.act:has-text("Atur")'); await W(800);
await A.p.evaluate((id) => { const el = document.querySelector(`.room .fl[data-r="${id}"]`); el?.dispatchEvent(new MouseEvent('click', { bubbles: true })); }, hal.id);
await W(900);
check((await A.p.locator('.editbar .ename').textContent()).includes('Halaman'), 'Atur: pindah mengatur Halaman Rumput');
await pasang(A.p, 'Ayunan Kayu', 'Atur halaman');
// pindahkan ayunan ke tengah halaman: ketuk petak (3, 3) selagi ayunan terpilih
await A.p.evaluate((id) => { const el = document.querySelector(`.room .tile[data-r="${id}"][data-x="3"][data-y="3"]`); el?.dispatchEvent(new MouseEvent('click', { bubbles: true })); }, hal.id);
await W(500);
await pasang(A.p, 'Pagar Tanaman', 'Atur halaman');
await A.p.screenshot({ path: `${OUT}/atur-halaman-390.png` });
await A.p.click('.editbar .btn:has-text("Selesai")'); await W(1400);
await dekor(A, 'Lantai Rumput Berbunga');
me = await meOf(A);
let hal2 = me.rooms.find((x) => x.item === 'halaman');
const ai = hal2.layout.findIndex((q) => q.i === 'ayunan-kayu');
check(ai >= 0 && hal2.layout.some((q) => q.i === 'pagar-tanaman'), 'ayunan & pagar tanaman tersimpan di halaman');
check(hal2.layout[ai]?.x === 3 && hal2.layout[ai]?.y === 3, `Atur: ayunan dipindah ke tengah halaman (${hal2.layout[ai]?.x}, ${hal2.layout[ai]?.y})`);
// lantai rumput berbunga dipasang di ruangan yang sedang dipilih; pastikan untuk halaman lewat API bila perlu
if (hal2.floor !== 'fl-rumputbunga') {
  const rr = await A.ctx.request.post(BASE + '/api/room', { data: { roomId: hal2.id, version: hal2.version, layout: hal2.layout, floor: 'fl-rumputbunga' } });
  check(rr.ok(), 'lantai rumput berbunga dipasang di halaman (API)');
  me = await meOf(A); hal2 = me.rooms.find((x) => x.item === 'halaman');
}
check(hal2.floor === 'fl-rumputbunga', `halaman berlantai rumput berbunga (${hal2.floor})`);
await home(A);
await goRoom(A.p, 'Halaman');
await W(1200);
await useActivity(A, hal2.id, ai, 'Main ayunan', 'ayun', 'gerak', 'main ayunan', `${OUT}/pose-ayun.png`);
await A.p.screenshot({ path: `${OUT}/halaman-390.png` });

/* ---------------- gerak dikurangi: prefers-reduced-motion (HP) ---------------- */
const R = await mk('Diam', [390, 844], 3000, { reducedMotion: 'reduce' });
await buyApi(R, ['wastafel-cermin', 'ember-gilas', 'ayunan-kayu', 'mesin-cuci']);
let rr = await placeApi(R, ['ayunan-kayu', 'wastafel-cermin', 'ember-gilas', 'mesin-cuci']);
await home(R);
const rI = (id) => rr.layout.findIndex((q) => q.i === id);
const rd = await anim(R.p, `${fsel(rr.id, rI('mesin-cuci'))} .swim`);
check(rd?.name === 'none' && rd.running === 0, `reduced-motion: drum mesin cuci diam (${rd?.name})`);
await useActivity(R, rr.id, rI('wastafel-cermin'), 'Sikat gigi', 'sikat', 'diam', 'reduced-motion sikat gigi');
await useActivity(R, rr.id, rI('ember-gilas'), 'Cuci baju', 'cuci', 'diam', 'reduced-motion cuci baju');
await useActivity(R, rr.id, rI('ayunan-kayu'), 'Main ayunan', 'ayun', 'diam', 'reduced-motion main ayunan', `${OUT}/pose-ayun-diam.png`);

/* ---------------- gerak dikurangi: Pengaturan › Kurangi animasi (pilihan di game) ---------------- */
const K = await mk('Pelan', [390, 844], 3000);
await buyApi(K, ['wastafel-cermin', 'bak-cuci-piring', 'ayunan-kayu', 'mesin-cuci']);
const kr = await placeApi(K, ['ayunan-kayu', 'bak-cuci-piring', 'wastafel-cermin', 'mesin-cuci']);
await K.p.goto(`${BASE}/?r=km#akun`); await K.p.waitForSelector('.sheet', { timeout: 20000 }); await W(600);
const km = K.p.locator('.sheet label.tg:has-text("Kurangi animasi") input');
check(await km.count() === 1, 'Pengaturan: pilihan "Kurangi animasi" ada');
await km.check(); await W(300);
check(await K.p.evaluate(() => document.documentElement.classList.contains('reduce-motion')), 'Kurangi animasi: <html> dapat kelas reduce-motion');
await home(K);
const kI = (id) => kr.layout.findIndex((q) => q.i === id);
const kd = await anim(K.p, `${fsel(kr.id, kI('mesin-cuci'))} .swim`);
check(kd?.name === 'none' && kd.running === 0, `Kurangi animasi: drum mesin cuci diam (${kd?.name})`);
await useActivity(K, kr.id, kI('wastafel-cermin'), 'Sikat gigi', 'sikat', 'diam', 'Kurangi animasi sikat gigi');
await useActivity(K, kr.id, kI('bak-cuci-piring'), 'Cuci piring', 'cuci', 'diam', 'Kurangi animasi cuci piring');
await useActivity(K, kr.id, kI('ayunan-kayu'), 'Main ayunan', 'ayun', 'diam', 'Kurangi animasi main ayunan');

/* ---------------- HP 320: dua toko, beli lewat kartu ---------------- */
const B = await mk('Kukus', [320, 640], 1500);
await home(B);
for (const shop of ['mebel', 'bangunan']) { await walkTo(B, shop); await checkShop(B, shop, '320'); }
r = await buyCard(B, 'Hamak');
check(r.spent === 160 && (r.me.inventory?.['hamak-taman'] ?? 0) === 1, `HP 320: beli Hamak (−${r.spent} koin)`);
await walkTo(B, 'mebel');
r = await buyCard(B, 'Baskom Bebek Karet');
check(r.spent === 60 && (r.me.inventory?.['baskom-bebek'] ?? 0) === 1, `HP 320: beli Baskom Bebek Karet (−${r.spent} koin)`);

/* ---------------- desktop 1366: dua toko, dapur berperabot, makan siang ---------------- */
const C = await mk('Taplak', [1366, 820], 4000);
await home(C);
for (const shop of ['bangunan', 'mebel']) { await walkTo(C, shop); await checkShop(C, shop, '1366'); }
r = await buyCard(C, 'Meja Makan Taplak Kotak');
check(r.spent === 220 && (r.me.inventory?.['meja-makan-taplak'] ?? 0) === 1, `desktop: beli Meja Makan Taplak Kotak (−${r.spent} koin)`);
await buyApi(C, ['dandang-kukusan', 'penanak-nasi', 'galon-dispenser', 'rak-bumbu', 'tempat-sampah-pilah', 'wp-keramikdapur', 'fl-tegelcatur']);
me = await meOf(C); room = (me.rooms ?? [me.room])[0];
const lay = [{ i: 'rak-bumbu', x: 0, y: 0 }, { i: 'dandang-kukusan', x: 1, y: 0 }, { i: 'galon-dispenser', x: 2, y: 0 }, { i: 'penanak-nasi', x: 0, y: 1, r: 1 }, { i: 'tempat-sampah-pilah', x: 0, y: 3, r: 1 }, { i: 'meja-makan-taplak', x: 2, y: 2 }];
check((await C.ctx.request.post(BASE + '/api/room', { data: { roomId: room.id || undefined, version: room.version, wall: 'wp-keramikdapur', floor: 'fl-tegelcatur', layout: lay } })).ok(), 'desktop: dapur dengan 6 mebel baru tersimpan (keramik dapur & tegel catur)');
await home(C);
me = await meOf(C);
const mi = (me.rooms ?? [me.room])[0].layout.findIndex((q) => q.i === 'meja-makan-taplak');
await tapFurn(C.p, fsel('', mi));
check(/Makan siang/.test(await C.p.locator('.menu').innerText().catch(() => '')), 'desktop: ketuk meja makan → menu "Makan siang"');
await C.p.locator('.menu button:has-text("Makan siang")').click();
let ok = false;
for (let i = 0; i < 160 && !ok; i++) { await W(80); ok = await C.p.locator('svg.room g.pet.pose-duduk').count() > 0; }
check(ok, 'desktop: pet duduk di meja makan (pose-duduk)');
await C.p.screenshot({ path: `${OUT}/dapur-1366.png` });
const t = await waitToast(C.p, /makan siang/);
check(/makan siang/.test(t), `desktop: aktivitas Makan siang ("${t}")`);

check(!errors.length, `tanpa galat halaman / 5xx${errors.length ? `: ${errors.join(' | ')}` : ''}`);
await b.close();
console.log(fails.length ? `\n${fails.length} GAGAL` : '\nSemua lulus');
process.exit(fails.length ? 1 : 0);
