// Uji fasilitas rumah teman: tamu berkunjung lewat daftar Teman, mengetuk sofa teman → menu "Perabot <teman>" → pet
// sendiri duduk di sofa (pose terlihat di layar tamu & tuan rumah), hasilnya di toast, cooldown di menu, perabot yang
// sedang dipakai pet lain (tamu kedua), pose pet tuan rumah terlihat tamu, tuan rumah mematikan izin, dan buku tamu.
// Menu tidak boleh tertutup kartu rumah teman, bar kunjungan, atau toast (HP 390 & 320, desktop 1366).
// Jalankan server dulu dengan admin (ADMIN_EMAIL & ADMIN_PASSWORD), lalu: BASE_URL=http://localhost:8787 npm run test:e2e:fasilitas
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, request } = require('playwright');
const BASE = (process.env.BASE_URL ?? 'http://localhost:8787').replace(/\/$/, '');
const OUT = (process.env.SHOTS ?? 'test-results/e2e-fasilitas').replace(/\/$/, '');
const ADMIN = { email: process.env.ADMIN_EMAIL ?? 'owner@bupi.test', password: process.env.ADMIN_PASSWORD ?? 'rahasia-sekali-123' };
mkdirSync(OUT, { recursive: true });
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [], errors = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'GAGAL'} ${msg}`); if (!ok) fails.push(msg); };

const adm = await request.newContext({ baseURL: BASE });
check((await adm.post('/api/admin/login', { data: ADMIN })).ok(), 'admin masuk');
const b = await chromium.launch();

/** pemain baru (tamu) dengan pet; dsf 2 untuk gambar yang ditunjukkan ke pemilik */
async function mk(pet, color, ear, vp, { dsf = 1, tip = true } = {}) {
  const mobile = vp[0] < 900;
  const ctx = await b.newContext({ viewport: { width: vp[0], height: vp[1] }, hasTouch: mobile, isMobile: mobile, deviceScaleFactor: dsf });
  await ctx.addInitScript((tip) => {
    try {
      localStorage.setItem('kb-save-snooze', String(Date.now() + 9e9)); localStorage.setItem('kb-push-asked', String(Date.now() + 9e9)); localStorage.setItem('kb-news-seen', '["*"]');
      localStorage.setItem('kb-ajak', JSON.stringify({ day: new Date().toLocaleDateString('en-CA'), n: 9, last: Date.now(), nanti: 0, mute: true, alunAt: 0 }));
      if (!tip) localStorage.setItem('kb-fas-tip', '1');
    } catch {}
  }, tip);
  await ctx.request.post(BASE + '/api/auth/guest', { data: {} });
  const st = await (await ctx.request.post(BASE + '/api/pet', { data: { name: pet, color, ear } })).json();
  await ctx.request.post(BASE + '/api/daily', { data: {} });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(pet + ': ' + e.message));
  p.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 500) errors.push(`${pet} ${r.status()} ${r.url()}`); });
  return { ctx, p, pet, id: st.state.user.id, code: st.state.user.friend_code, room: st.state.rooms[0] };
}
const api = async (pl, path, data) => { const r = await pl.ctx.request.post(BASE + path, { data }); const j = await r.json().catch(() => ({})); if (!r.ok()) throw new Error(`${path}: ${JSON.stringify(j)}`); return j; };
async function closeSheets(pl) { for (let i = 0; i < 3; i++) { const x = pl.p.locator('.sheet .x'); if (await x.count()) { await x.first().click().catch(() => {}); await W(300); } } }
/** titik di perabot yang benar-benar teratas (tidak tertutup pet, kartu, atau bar) */
const furnPoint = (pl, room, i) => pl.p.evaluate(([room, i]) => {
  const el = document.querySelector(`svg.room .furn[data-r="${room}"][data-i="${i}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  for (const fy of [0.5, 0.35, 0.65, 0.25, 0.75]) for (const fx of [0.5, 0.35, 0.65, 0.2, 0.8]) {
    const x = r.left + r.width * fx, y = r.top + r.height * fy;
    if (document.elementFromPoint(x, y)?.closest('.furn') === el) return { x, y };
  }
  return null;
}, [room, i]);
/** HP kecil: perabot tertutup kartu / bar → geser rumah dengan jari sampai perabotnya terlihat (seperti pemain sungguhan) */
async function panTo(pl, room, i) {
  const g = await pl.p.evaluate(([room, i]) => {
    const el = document.querySelector(`svg.room .furn[data-r="${room}"][data-i="${i}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const top = Math.max(0, ...[...document.querySelectorAll('.visit, .hud, .hud > *')].map((e) => e.getBoundingClientRect().bottom));
    const bot = Math.min(innerHeight, ...[...document.querySelectorAll('.hbar, .dock')].map((e) => e.getBoundingClientRect().top));
    const sx = innerWidth / 2;
    let sy = null;
    for (let y = top + 3; y < bot - 3 && sy === null; y += 3) if (document.elementFromPoint(sx, y)?.closest('svg.room')) sy = y;
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, ty: (top + bot) / 2, sx, sy };
  }, [room, i]);
  if (!g || g.sy === null) return;
  await pl.p.mouse.move(g.sx, g.sy); await pl.p.mouse.down();
  const dx = innerW(pl) / 2 - g.cx, dy = g.ty - g.cy;
  for (let k = 1; k <= 8; k++) await pl.p.mouse.move(g.sx + (dx * k) / 8, g.sy + (dy * k) / 8);
  await pl.p.mouse.up(); await W(500);
}
const innerW = (pl) => pl.p.viewportSize().width;
async function tapFurn(pl, room, i) {
  let pt = await furnPoint(pl, room, i);
  if (!pt) { console.log(`     (geser rumah supaya perabot ${i} terlihat)`); await panTo(pl, room, i); pt = await furnPoint(pl, room, i); }
  if (!pt) return false;
  await pl.p.mouse.click(pt.x, pt.y);
  return true;
}
/** ketuk perabot sampai menunya terbuka (pet yang lewat bisa menutupi titik ketukan; pemain sungguhan juga mengetuk lagi) */
async function openMenu(pl, room, i) {
  for (let k = 0; k < 3; k++) {
    if (await tapFurn(pl, room, i) && await pl.p.waitForSelector('.roomwrap .menu', { timeout: 1500 }).then(() => true, () => false)) return true;
    await pl.p.keyboard.press('Escape').catch(() => {}); await W(200);
  }
  return false;
}
/** menu aktivitas tidak bertumpuk dengan kartu rumah teman, bar kunjungan, toast, HUD & dock (dan tetap di dalam layar) */
const menuClear = (pl) => pl.p.evaluate(() => {
  const m = document.querySelector('.roomwrap .menu')?.getBoundingClientRect();
  if (!m) return { menu: false };
  const hit = (sel) => [...document.querySelectorAll(sel)].map((e) => e.getBoundingClientRect()).filter((r) => r.width && r.height)
    .some((r) => m.left < r.right - 1 && r.left < m.right - 1 && m.top < r.bottom - 1 && r.top < m.bottom - 1);
  const out = { menu: true, visit: hit('.visit'), hbar: hit('.hbar'), toast: hit('.toast.show'), hud: hit('.hud'), dock: hit('.dock'), inside: m.left >= 0 && m.top >= 0 && m.right <= innerWidth && m.bottom <= innerHeight };
  // tombol aktivitas teratas di menu juga benar-benar bisa diketuk (bukan tertutup elemen lain)
  const btn = document.querySelector('.roomwrap .menu .btn')?.getBoundingClientRect();
  out.tappable = !!btn && !!document.elementFromPoint(btn.left + btn.width / 2, btn.top + btn.height / 2)?.closest('.menu');
  return out;
});
const okMenu = (r) => r.menu && !r.visit && !r.hbar && !r.toast && !r.hud && !r.dock && r.inside && r.tappable;
const hasPose = (pl, sel, pose) => pl.p.evaluate(([sel, pose]) => !!document.querySelector(sel)?.classList.contains('pose-' + pose), [sel, pose]);
async function waitPose(pl, sel, pose, ms = 9000) { for (let t = 0; t < ms; t += 100) { if (await hasPose(pl, sel, pose)) return true; await W(100); } return false; }
async function waitToast(pl, re, ms = 9000) { for (let t = 0; t < ms; t += 100) { const s = await pl.p.locator('.toast.show').textContent().catch(() => ''); if (re.test(s ?? '')) return s; await W(100); } return (await pl.p.locator('.toast').textContent().catch(() => '')) ?? ''; }
/** label nama di bawah tiap pet cocok dengan petnya (tidak tertinggal saat kamera / pet bergerak) */
const tagsAligned = (pl, names) => pl.p.evaluate((names) => {
  const bad = [];
  for (const [id, name] of Object.entries(names)) {
    const el = document.querySelector(`svg.room .opet[data-o="${id}"]`), t = [...document.querySelectorAll('.tag')].find((x) => x.textContent === name);
    if (!el || !t) continue;
    const r = el.getBoundingClientRect(), q = t.getBoundingClientRect();
    const dx = Math.abs(q.left + q.width / 2 - (r.left + r.width / 2)), dy = q.top - r.bottom;
    if (dx > 40 || dy < -8 || dy > 50) { const w = document.querySelector('.roomwrap'); bad.push(`${name}: dx ${Math.round(dx)} dy ${Math.round(dy)} (gulir ${w.scrollLeft},${w.scrollTop})`); }
  }
  return bad;
}, names);
/** gambar layar setelah animasi singkat (pop, pet naik ke mebel) selesai; label nama ikut diperiksa */
async function shot(pl, file, names, wait = 700) {
  await W(wait);
  if (names) { const bad = await tagsAligned(pl, names); check(!bad.length, `${file}: label nama tepat di bawah petnya ${bad.join(', ')}`); }
  await pl.p.screenshot({ path: `${OUT}/${file}.png` });
}
const toastText = async (pl) => (await pl.p.locator('.toast.show').textContent().catch(() => '')) ?? '';

for (const vp of [[390, 844], [320, 640], [1366, 768]]) {
  const tag = vp[0], owner = tag !== 320 ? 2 : 1;
  console.log(`\n— layar ${vp[0]}×${vp[1]}`);
  // tuan rumah (HP) dengan sofa & bak mandi di kamarnya; tamu dengan layar yang diuji; tamu kedua (HP)
  const H = await mk('Mochi', '#F6B7A8', 'kelinci', [390, 844], { dsf: owner, tip: false });
  const G1 = await mk('Kopi', '#9FD0E8', 'kucing', vp, { dsf: owner });
  const G2 = await mk('Onde', '#F4D58D', 'tunas', [390, 844], { dsf: owner, tip: false });
  await adm.post(`/api/admin/players/${H.id}/wallet`, { data: { currency: 'coin', delta: 2000, reason: 'uji fasilitas rumah teman' } });
  for (const id of ['sofa-santai', 'bak-mandi']) await api(H, '/api/shop/buy', { itemId: id });
  const room = H.room;
  const layout = [...room.layout, { i: 'sofa-santai', x: 0, y: 0 }, { i: 'bak-mandi', x: 2, y: 0 }];
  await api(H, '/api/room', { roomId: room.id, version: room.version, layout });
  const SOFA = layout.length - 2, BAK = layout.length - 1, KASUR = layout.findIndex((p) => p.i === 'kasur-rotan');
  for (const g of [G1, G2]) await api(g, '/api/friends', { code: H.code });
  // nama label per pet di layar pemain itu (pet sendiri saat berkunjung = "__me")
  const names = (pl) => Object.fromEntries([H, G1, G2].map((x) => [x === pl && pl !== H ? '__me' : x.id, x === pl && pl !== H ? `${x.pet} (kamu)` : x.pet]));

  // tuan rumah di rumah (online), tamu datang lewat daftar Teman
  await H.p.goto(BASE + '/'); await H.p.waitForSelector('.dock'); await W(1200); await closeSheets(H);
  // pet tuan rumah main di pojok depan (tamu berkumpul di dekatnya), supaya perabot di dinding belakang terlihat jelas
  const hostTo = (x, y) => H.p.evaluate(([r, x, y]) => document.querySelector(`svg.room .fl[data-r="${r}"][data-x="${x}"][data-y="${y}"]`)?.dispatchEvent(new MouseEvent('click', { bubbles: true })), [room.id, x, y]);
  await hostTo(4, 5); await W(1500);
  await G1.p.goto(BASE + '/?r=t#friends'); await G1.p.waitForSelector('.friend', { timeout: 20000 }); await W(500);
  await G1.p.locator(`.friend:has-text("${H.pet}") .btn:has-text("Main bareng"), .friend:has-text("${H.pet}") .btn:has-text("Kunjungi")`).first().click();
  await G1.p.waitForSelector('.hbar'); await G1.p.waitForSelector('svg.room .opet[data-o="__me"]');
  // petunjuk sekali per perangkat
  const hint = await waitToast(G1, /Ketuk perabot/, 5000);
  check(/Ketuk perabot di rumah/.test(hint), `${tag}: petunjuk "ketuk perabot" muncul sekali (${hint})`);

  // 1. ketuk sofa → menu "Perabot <teman>" yang tidak tertutup apa pun
  check(await tapFurn(G1, room.id, SOFA), `${tag}: sofa teman bisa diketuk`);
  await G1.p.waitForSelector('.roomwrap .menu', { timeout: 4000 }).catch(() => {});
  const own = (await G1.p.locator('.roomwrap .menu .own').textContent().catch(() => '')) ?? '';
  const title = (await G1.p.locator('.roomwrap .menu b').textContent().catch(() => '')) ?? '';
  check(own === `Perabot ${H.pet}` && title === 'Sofa Santai', `${tag}: menu berjudul "${own}" · "${title}"`);
  const m1 = await menuClear(G1);
  check(okMenu(m1), `${tag}: menu tidak tertutup kartu rumah, bar kunjungan, toast, HUD & dock ${JSON.stringify(m1)}`);
  check(!(await G1.p.locator('.roomwrap .menu .btn:has-text("Tidur sampai segar")').count()), `${tag}: tanpa "Tidur sampai segar"`);
  await shot(G1, `menu-${tag}`);
  // 2. pakai: pet sendiri naik ke sofa (pose duduk) di layar tamu & tuan rumah
  const coins0 = (await (await G1.ctx.request.get(BASE + '/api/me')).json()).wallet.coin;
  await G1.p.locator('.roomwrap .menu .btn:has-text("Duduk santai")').click();
  check(await waitPose(G1, 'svg.room .opet[data-o="__me"]', 'duduk'), `${tag}: pet tamu duduk di sofa (layar tamu)`);
  await shot(G1, `tamu-duduk-${tag}`, names(G1));
  const hostSees = await waitPose(H, `svg.room .opet[data-o="${G1.id}"]`, 'duduk', 6000);
  check(hostSees, `${tag}: tuan rumah melihat pet tamu duduk di sofanya (.opet.pose-duduk)`);
  // naik ke atas sofa: titik pijak pet tamu = tengah sofa (antara petak 0,0 & 1,0), terangkat dari lantai (lift duduk)
  const sofaCheck = () => H.p.evaluate(([id, r]) => {
    const el = document.querySelector(`svg.room .opet[data-o="${id}"]`), svg = document.querySelector('svg.room');
    const tile = (x, y) => { const b = document.querySelector(`svg.room .fl[data-r="${r}"][data-x="${x}"][data-y="${y}"]`)?.getBoundingClientRect(); return b ? [b.left + b.width / 2, b.top + b.height / 2] : null; };
    const a = tile(0, 0), c = tile(1, 0), m = el?.getScreenCTM();
    if (!a || !c || !m) return null;
    const o = svg.createSVGPoint().matrixTransform(m);
    return { dx: Math.round(o.x - (a[0] + c[0]) / 2), lift: Math.round((a[1] + c[1]) / 2 - o.y) };
  }, [G1.id, room.id]);
  let onSofa = null;
  for (let t = 0; t < 2500; t += 100) { onSofa = await sofaCheck(); if (onSofa && Math.abs(onSofa.dx) <= 3 && onSofa.lift >= 5) break; await W(100); }
  check(!!onSofa && Math.abs(onSofa.dx) <= 3 && onSofa.lift >= 5, `${tag}: di layar tuan rumah pet tamu naik ke atas sofa (terangkat ${onSofa?.lift}px, geser ${onSofa?.dx}px)`);
  if (hostSees) await shot(H, `tuan-rumah-lihat-sofa-${tag}`, names(H), 250);
  const res = await waitToast(G1, /Kopi .*Ceria/);
  check(/^Kopi duduk santai di Sofa Santai\. \+\d+ Ceria, \+\d+ Energi/.test(res), `${tag}: hasil di toast "${res}"`);
  const st1 = await (await G1.ctx.request.get(BASE + '/api/me')).json();
  check(st1.wallet.coin >= coins0, `${tag}: koin tamu tidak berkurang`);
  // 3. cooldown di menu (sama dengan di rumah)
  await W(600);
  await openMenu(G1, room.id, SOFA);
  const cdBtn = G1.p.locator('.roomwrap .menu .btn:has-text("Duduk santai")');
  const cdTxt = (await cdBtn.locator('.ef').textContent().catch(() => '')) ?? '';
  check(await cdBtn.isDisabled().catch(() => false) && /mnt|dtk/.test(cdTxt), `${tag}: cooldown tampil di menu (${cdTxt})`);
  await G1.p.keyboard.press('Escape'); await W(300);

  // 4. satu pet per perabot: tamu pertama berendam, tamu kedua ditolak
  await G2.p.goto(BASE + '/?r=t#friends'); await G2.p.waitForSelector('.friend', { timeout: 20000 }); await W(400);
  await G2.p.locator(`.friend:has-text("${H.pet}") .btn`).first().click();
  await G2.p.waitForSelector('svg.room .opet[data-o="__me"]'); await W(1500);
  await hostTo(1, 5); await W(1200);
  check(await openMenu(G1, room.id, BAK), `${tag}: menu bak mandi terbuka (tamu pertama)`);
  await G1.p.locator('.roomwrap .menu .btn:has-text("Berendam")').click({ timeout: 3000 }).catch(() => {});
  await W(250);
  check(await openMenu(G2, room.id, BAK), `${tag}: menu bak mandi terbuka (tamu kedua)`);
  await G2.p.locator('.roomwrap .menu .btn:has-text("Berendam")').click({ timeout: 3000 }).catch(() => {});
  const occ = await waitToast(G2, /sedang dipakai/, 5000);
  check(occ === 'Bak Mandi sedang dipakai Kopi.', `${tag}: tamu kedua: "${occ}"`);
  await W(250); await G2.p.screenshot({ path: `${OUT}/dipakai-${tag}.png` }); check(!(await tagsAligned(G2, names(G2))).length, `${tag}: label nama di layar tamu kedua tepat`);
  check(await waitPose(G1, 'svg.room .opet[data-o="__me"]', 'mandi'), `${tag}: pet tamu berendam (layar tamu)`);
  const hostBath = await waitPose(H, `svg.room .opet[data-o="${G1.id}"]`, 'mandi', 6000);
  check(hostBath, `${tag}: tuan rumah melihat pet tamu berendam di bak mandinya`);
  if (hostBath) await shot(H, `tuan-rumah-lihat-bak-${tag}`, names(H));
  const g2sees = await waitPose(G2, `svg.room .opet[data-o="${G1.id}"]`, 'mandi', 4000);
  check(g2sees, `${tag}: tamu lain juga melihat pet tamu berendam`);
  const bathRes = await waitToast(G1, /berendam/);
  check(/Kopi berendam sampai wangi\./.test(bathRes), `${tag}: hasil berendam "${bathRes}"`);

  // 5. pose pet tuan rumah di rumahnya terlihat tamu (bonus): tuan rumah duduk di sofanya sendiri
  await W(4500); // tanda pakai sofa milik tamu sudah habis
  await openMenu(H, room.id, SOFA);
  await H.p.locator('.roomwrap .menu .btn:has-text("Duduk santai")').click().catch(() => {});
  const guestSeesHost = await waitPose(G1, `svg.room .opet[data-o="${H.id}"]`, 'duduk', 8000);
  check(guestSeesHost, `${tag}: tamu melihat pet tuan rumah duduk di sofanya`);
  if (guestSeesHost) await shot(G1, `tamu-lihat-tuan-rumah-${tag}`, names(G1));
  await W(3000);

  // 6. tuan rumah mematikan izin di Pengaturan → tamu ditolak dengan pesan ramah
  await closeSheets(H);
  await H.p.click('.hud .tool[aria-label^="Pengaturan"]'); await H.p.waitForSelector('.sheet');
  const tg = H.p.locator('label.tg:has-text("Teman boleh memakai perabot di rumahku") input');
  check(await tg.isChecked(), `${tag}: izin perabot menyala sejak awal`);
  await tg.uncheck(); await W(800);
  await H.p.screenshot({ path: `${OUT}/pengaturan-${tag}.png` });
  await closeSheets(H);
  await openMenu(G1, room.id, KASUR);
  await G1.p.locator('.roomwrap .menu .btn').first().click().catch(() => {});
  const off1 = await waitToast(G1, /belum mengizinkan/, 5000);
  check(off1 === 'Tuan rumah belum mengizinkan perabotnya dipakai.', `${tag}: ditolak server: "${off1}"`);
  await W(2600);
  await tapFurn(G1, room.id, SOFA); await W(300);
  const off2 = await toastText(G1);
  check(off2 === 'Tuan rumah belum mengizinkan perabotnya dipakai.' && !(await G1.p.locator('.roomwrap .menu').count()), `${tag}: ketuk lagi → langsung toast tanpa menu ("${off2}")`);
  await W(250); await G1.p.screenshot({ path: `${OUT}/tidak-diizinkan-${tag}.png` });

  // 7. buku tamu tuan rumah
  await H.p.goto(BASE + '/?r=b#bukutamu'); await H.p.waitForSelector('.sheet .friend', { timeout: 15000 }).catch(() => {});
  await W(600);
  const book = (await H.p.locator('.sheet').textContent().catch(() => '')) ?? '';
  check(/Kopi memakai Sofa Santai \(Duduk santai\)/.test(book) && /Kopi memakai Bak Mandi \(Berendam\)/.test(book), `${tag}: buku tamu mencatat pemakaian perabot`);
  await H.p.screenshot({ path: `${OUT}/buku-tamu-${tag}.png` });
  const hw = (await (await H.ctx.request.get(BASE + '/api/me')).json()).wallet.coin;
  check(hw > 0, `${tag}: dompet tuan rumah ${hw} koin (termasuk tip)`);
  for (const pl of [H, G1, G2]) await pl.ctx.close();
}

await b.close();
if (errors.length) { console.error('Galat:', errors); }
console.log(fails.length || errors.length ? `\n${fails.length} GAGAL, ${errors.length} galat` : `\nSemua lulus. Gambar di ${OUT}`);
process.exit(fails.length || errors.length ? 1 : 0);
