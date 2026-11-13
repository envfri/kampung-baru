// Uji Ludo main bareng: 3 pemain di rumah (2 HP + desktop): ajakan & aturan di ruang tunggu, papan diputar (kandang sendiri
// di kiri bawah), lempar dadu, ketuk bidak yang menyala, pemain keluar (bidaknya diangkat), hasil; lalu Tikar Ludo di
// alun-alun: menu benda, pet berjalan ke pojok tikar, kehadiran ludo:k, main sampai selesai & hadiah.
// Jalankan server dulu (npm run build && npm start), lalu: node scripts/e2e-ludo.mjs
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const { tsImport } = await import('tsx/esm/api');
const { ALUN_LAYOUT } = await tsImport('../packages/shared/src/square.ts', import.meta.url);
const BASE = process.env.BASE_URL ?? 'http://localhost:8787', OUT = process.env.SHOTS ?? 'test-results/e2e-ludo';
const ADMIN = { email: process.env.ADMIN_EMAIL ?? 'owner@bupi.test', password: process.env.ADMIN_PASSWORD ?? 'rahasia-sekali-123' };
mkdirSync(OUT, { recursive: true });
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [], errors = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'GAGAL'} ${msg}`); if (!ok) fails.push(msg); };
const b = await chromium.launch();
async function mk(pet, color, ear, opts) {
  const ctx = await b.newContext(opts);
  await ctx.addInitScript(() => { try { localStorage.setItem('kb-save-snooze', String(Date.now() + 9e9)); } catch {} });
  await ctx.request.post(BASE + '/api/auth/guest', { data: {} });
  const st = await (await ctx.request.post(BASE + '/api/pet', { data: { name: pet, color, ear } })).json();
  await ctx.request.post(BASE + '/api/daily', { data: {} });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(pet + ': ' + e.message));
  p.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 500) errors.push(`${pet} ${r.status()} ${r.url()}`); });
  return { ctx, p, pet, id: st.state.user.id, code: st.state.user.friend_code, room: st.state.rooms?.[0]?.id };
}
const shot = (pl, n) => pl.p.screenshot({ path: `${OUT}/${n}.png` });
async function closeSheets(pl) { for (let i = 0; i < 3; i++) { const x = pl.p.locator('.sheet .x'); if (await x.count()) { await x.first().click(); await W(300); } } }
const coins = async (pl) => (await (await pl.ctx.request.get(BASE + '/api/me')).json()).wallet?.coin ?? 0;
const board = (pl) => pl.p.locator('.lw[aria-label="Papan Ludo"]');
/** pengaturan Ludo lewat admin (untuk permainan singkat di alun-alun) */
const adm = await b.newContext();
const login = await adm.request.post(BASE + '/api/admin/login', { data: ADMIN });
check(login.ok(), 'admin masuk (untuk mengatur Ludo singkat)');
async function ludoSettings(patch) {
  const cur = (await (await adm.request.get(BASE + '/api/admin/settings')).json()).value;
  const r = await adm.request.put(BASE + '/api/admin/settings', { data: { value: { ...cur, ludo: { ...cur.ludo, ...patch } } } });
  return r.ok();
}
await ludoSettings({ tokensByPlayers: { 2: 4, 3: 2, 4: 2 }, stepMs: 190 });

/** satu putaran: siapa pun yang giliran melempar atau mengetuk bidak yang menyala */
async function play(pls, o) {
  let acts = 0, taps = 0, capture = false;
  for (const until = Date.now() + o.ms; Date.now() < until;) {
    for (const pl of pls) {
      if (o.stop && (await o.stop())) return { acts, taps, capture };
      const pick = pl.p.locator('.lw .pick');
      const n = await pick.count();
      if (n) {
        if (taps === 0 && o.tapShot) await shot(pl, o.tapShot);
        await pick.nth(Math.floor(Math.random() * n)).dispatchEvent('click'); taps++; acts++;
        await W(250); continue;
      }
      const btn = pl.p.locator('.lw .big:not([disabled])', { hasText: 'Lempar' });
      if (await btn.count()) { await btn.click(); acts++; await W(250); }
      if (!capture && (await pl.p.locator('.lw .log.hot', { hasText: 'memakan' }).count())) { capture = true; if (o.capShot) await shot(pl, o.capShot); }
      if (o.midShot && acts === 12) { await W(400); await o.midShot(); o.midShot = null; }
    }
    if (o.enough && o.enough(acts, taps)) break;
    await W(150);
  }
  return { acts, taps, capture };
}

const A = await mk('Lupis', '#F6B7A8', 'kelinci', { ...devices['Pixel 7'] });
const B = await mk('Wajik', '#9FD0E8', 'kucing', { viewport: { width: 1366, height: 820 } });
const C = await mk('Putu', '#F4D58D', 'tunas', { viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const D = await mk('Klepon', '#C9B6E8', 'tunas', { viewport: { width: 390, height: 844 } });
for (const v of [B, C]) await v.ctx.request.post(BASE + '/api/friends', { data: { code: A.code } });

/* ---------- Ludo bertiga di rumah Lupis ---------- */
await A.p.goto(BASE + '/'); await W(1500); await closeSheets(A);
for (const v of [B, C]) {
  await v.p.goto(BASE + '/#friends'); await v.p.waitForSelector('.friend');
  await v.p.click(`.friend:has-text("Lupis") .btn >> nth=0`); await v.p.waitForSelector('.hbar');
}
await W(3500);
await A.p.click('.hbar .btn:has-text("Main bareng")');
check(await A.p.locator('.pop .btn.g:has-text("Ludo") em:has-text("BARU")').isEnabled(), 'menu Main bareng di rumah: ubin Ludo (BARU)');
await A.p.click('.pop .btn.g:has-text("Ludo")');
for (const pl of [B, C]) await pl.p.waitForSelector('.card:has-text("mengajak main Ludo")', { timeout: 8000 }).catch(() => {});
check(await C.p.locator('.card:has-text("mengajak main Ludo")').count() === 1, 'tamu mendapat ajakan Ludo');
check((await C.p.locator('.card .rules span').allTextContents()).join(' · ') === 'berdua → 4 bidak · 3–4 pemain → 2 bidak · ±12 mnt · maks 15', 'ajakan menampilkan aturan bidak & lama main');
await shot(C, '01-ajakan-ludo-320');
for (const pl of [B, C]) await pl.p.click('.card .btn:has-text("Ikut main")');
await W(1200);
check((await A.p.locator('.card .rules span').count()) === 3, 'ruang tunggu menampilkan aturan Ludo');
await shot(A, '02-ruang-tunggu-ludo');
await A.p.click('.card .btn:has-text("Mulai sekarang")');
for (const pl of [A, B, C]) await board(pl).waitFor({ timeout: 8000 }).catch(() => {});
check((await board(A).count()) + (await board(B).count()) + (await board(C).count()) === 3, 'papan Ludo terbuka untuk ketiga pemain');
await W(800);
check(await A.p.locator('.lw .tok').count() === 6, 'bertiga: 2 bidak per pemain (6 bidak)');
check(await A.p.locator('.lw .turns > span').count() === 3, 'baris pemain: 3 pemain dengan pulang x/y');
check((await A.p.locator('.lw .turns small').first().textContent()).trim().endsWith('0/2'), 'kemajuan pulang 0/2');
// tiap pemain melihat kandangnya sendiri di kiri bawah papan
for (const pl of [A, B, C]) {
  const ok = await pl.p.evaluate((id) => {
    const svg = document.querySelector('.lw .lboard')?.getBoundingClientRect();
    const toks = [...document.querySelectorAll(`.lw .tok[data-p="${id}"]`)].map((e) => e.getBoundingClientRect());
    return !!svg && toks.length === 2 && toks.every((r) => r.left + r.width / 2 < svg.left + svg.width / 2 && r.top + r.height / 2 > svg.top + svg.height / 2);
  }, pl.id);
  check(ok, `${pl.pet}: kandang sendiri di kiri bawah (papan diputar)`);
}
// papan tidak menutupi HUD & dock (HP 320×640)
const fit = await C.p.evaluate(() => {
  const r = document.querySelector('.lw')?.getBoundingClientRect(), hud = document.querySelector('.hud')?.getBoundingClientRect(), dock = document.querySelector('.dock, nav.dock')?.getBoundingClientRect();
  return { top: r?.top, bottom: r?.bottom, hud: hud?.bottom, dock: dock?.top };
});
check(fit.top >= (fit.hud ?? 0) - 1 && fit.bottom <= (fit.dock ?? 640) + 1, `papan muat di antara HUD & dock di 320×640 (${Math.round(fit.top)}–${Math.round(fit.bottom)}, HUD ${Math.round(fit.hud ?? 0)}, dock ${Math.round(fit.dock ?? 0)})`);
const r1 = await play([A, B, C], {
  ms: 150_000, tapShot: '04-ketuk-bidak', capShot: '05-makan',
  midShot: async () => { await shot(A, '03a-ludo-tengah-hp'); await shot(B, '03b-ludo-tengah-desktop'); await shot(C, '03c-ludo-tengah-320'); },
  enough: (acts, taps) => taps >= 3 && acts >= 24,
});
check(r1.acts >= 15, `beberapa giliran dimainkan (${r1.acts} aksi)`);
check(r1.taps >= 1, `bidak dipilih dengan mengetuk (${r1.taps} ketukan)`);
console.log(`info makan bidak di e2e: ${r1.capture ? 'ya' : 'tidak terjadi (dadu acak; diuji di unit test)'}`);
// Putu keluar: bidaknya diangkat, permainan lanjut berdua
const hs = await (await A.ctx.request.post(`${BASE}/api/house/${A.id}/sync`, { data: { roomId: A.room, x: 2, y: 2 } })).json();
const game = (hs.games ?? []).find((g) => g.game === 'ludo');
check(!!game && game.phase === 'main', 'sesi Ludo berjalan di server');
await C.ctx.request.post(`${BASE}/api/bareng/${game.id}/leave`);
await W(2500);
check(await A.p.locator(`.lw .tok[data-p="${C.id}"]`).count() === 0, 'pemain yang keluar: bidaknya diangkat dari papan');
check(await A.p.locator('.lw .turns > span.out').count() === 1, 'pemain yang keluar dicoret di baris pemain');
await play([A, B], { ms: 8000 });
await B.ctx.request.post(`${BASE}/api/bareng/${game.id}/leave`);
await A.p.waitForSelector('.resph .res', { timeout: 15000 }).catch(() => {});
check(await A.p.locator('.resph .res').count() === 1, 'kartu hasil muncul saat pemain lain pergi');
check((await A.p.locator('.resph .res .why').textContent().catch(() => '')).includes('Tanpa hadiah'), 'kurang dari 5 menit & tidak selesai normal: tanpa hadiah');
check(await A.p.locator('.resph .res .rk').count() === 3, 'hasil menampilkan 3 pemain (yang keluar di bawah)');
await W(500); await shot(A, '06-hasil-pergi-hp');
await A.p.click('.resph .btn:has-text("Tutup")');

/* ---------- Tikar Ludo di alun-alun: berdua, 1 bidak (permainan singkat) ---------- */
check(await ludoSettings({ tokensByPlayers: { 2: 1, 3: 2, 4: 2 }, stepMs: 80 }), 'admin: Ludo singkat untuk uji');
async function enterAlun(pl) {
  await pl.p.goto(BASE + '/?r=1#alun'); await pl.p.waitForSelector('.sbar, .fp', { timeout: 20000 }); await W(800);
  const n = pl.p.locator('.fp .btn:has-text("Nanti")'); if (await n.count()) await n.click();
}
for (const pl of [A, B]) await enterAlun(pl);
await W(2500);
const MAT = ALUN_LAYOUT.findIndex((p) => p.i === 'alun-tikarludo');
check(MAT === ALUN_LAYOUT.length - 1 || MAT > 60, 'Tikar Ludo ditambah di akhir susunan alun-alun');
await A.p.evaluate((idx) => {
  const el = document.querySelector(`svg.room .furn[data-r="alun"][data-i="${idx}"]`);
  const r = el?.getBoundingClientRect();
  el?.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r ? r.left + r.width / 2 : 100, clientY: r ? r.top + r.height / 2 : 100 }));
}, MAT);
await W(500);
check(await A.p.locator('.menu .btn:has-text("Main Ludo (2–4 orang)")').count() === 1, 'ketuk Tikar Ludo: Main Ludo (2–4 orang)');
check(await A.p.locator('.menu .btn:has-text("Duduk di tikar")').count() === 1, 'ketuk Tikar Ludo: Duduk di tikar');
await shot(A, '07-menu-tikar-ludo');
await A.p.keyboard.press('Escape'); await W(300);
await A.p.click('.sbar .btn:has-text("Main")');
check(await A.p.locator('.pop .btn.g:has-text("Ludo"):has-text("Tikar Ludo")').count() === 1, 'menu Main alun-alun: ubin Ludo · Tikar Ludo');
await A.p.click('.pop .btn.g:has-text("Ludo")');
await B.p.waitForSelector('.card:has-text("mengajak main Ludo")', { timeout: 20000 }).catch(() => {});
check(await B.p.locator('.card:has-text("mengajak main Ludo")').count() === 1, 'orang di alun-alun mendapat ajakan Ludo');
await B.p.click('.card .btn:has-text("Ikut main")');
await W(3500);
// kehadiran: pemain Ludo berdiri di pojok Tikar Ludo sesuai warnanya (dilihat orang lain di alun-alun)
const seen = (await (await D.ctx.request.post(BASE + '/api/square/sync', { data: { x: 10, y: 18 } })).json()).members ?? [];
check(seen.find((m) => m.id === A.id)?.act === 'ludo:0' && seen.find((m) => m.id === B.id)?.act === 'ludo:2', `pemain Ludo terlihat di pojok tikar (${seen.map((m) => m.act).join(',')})`);
await shot(A, '08-pet-di-tikar-ludo');
const a0 = await coins(A), b0 = await coins(B);
await A.p.click('.card .btn:has-text("Mulai sekarang")');
for (const pl of [A, B]) await board(pl).waitFor({ timeout: 8000 }).catch(() => {});
check(await B.p.locator('.lw .tok').count() === 2, 'berdua dengan pengaturan 1 bidak: 2 bidak di papan');
const done = async () => (await A.p.locator('.resph .res').count()) > 0 && (await B.p.locator('.res.dk').count()) > 0;
await play([A, B], { ms: 240_000, stop: done });
await A.p.waitForSelector('.resph .res', { timeout: 15000 }).catch(() => {});
check(await done(), 'Ludo di alun-alun selesai sampai hasil (HP & desktop)');
await W(600);
await shot(A, '09-hasil-ludo-hp'); await shot(B, '10-hasil-ludo-desktop');
const winner = (await A.p.locator('.resph .res h2').textContent()).includes('juara 1') ? A : B;
check(((await coins(winner)) - (winner === A ? a0 : b0)) > 0, 'juara 1 mendapat koin main bareng');
check((await A.p.locator('.resph .res .rk').allTextContents()).some((t) => t.includes('pulang 1/1')), 'hasil: pulang 1/1');
await ludoSettings({ tokensByPlayers: { 2: 4, 3: 2, 4: 2 }, stepMs: 190 });

console.log(errors.length ? 'ERROR:\n' + errors.join('\n') : 'tanpa error halaman/server');
await b.close();
if (fails.length || errors.length) process.exit(1);
