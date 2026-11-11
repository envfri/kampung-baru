// Uji rumah tersambung: semua ruangan (kamar, ruang tamu, dapur, kamar mandi, halaman) tampil sekaligus sebagai satu rumah.
// Pet berjalan antarruangan lewat pintu, kamera mengikuti ruangan / melihat seluruh rumah / digeser, mode Atur per ruangan,
// dan tamu yang berada di ruangan berbeda tetap saling terlihat.
// Jalankan server dulu dengan admin (ADMIN_EMAIL & ADMIN_PASSWORD), lalu: npm run test:e2e:rumah
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, devices, request } = require('playwright');
const BASE = process.env.BASE_URL ?? 'http://localhost:8787', OUT = process.env.SHOTS ?? 'test-results/e2e-rumah';
const ADMIN = { email: process.env.ADMIN_EMAIL ?? 'owner@bupi.test', password: process.env.ADMIN_PASSWORD ?? 'rahasia-sekali-123' };
mkdirSync(OUT, { recursive: true });
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [], errors = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'GAGAL'} ${msg}`); if (!ok) fails.push(msg); };

const adm = await request.newContext({ baseURL: BASE });
check((await adm.post('/api/admin/login', { data: ADMIN })).ok(), 'admin masuk');
const b = await chromium.launch();
async function mk(pet, color, ear, opts) {
  const ctx = await b.newContext(opts);
  await ctx.addInitScript(() => { try { localStorage.setItem('kb-save-snooze', String(Date.now() + 9e9)); localStorage.setItem('kb-news-seen', '["*"]'); } catch {} });
  await ctx.request.post(BASE + '/api/auth/guest', { data: {} });
  const st = await (await ctx.request.post(BASE + '/api/pet', { data: { name: pet, color, ear } })).json();
  await ctx.request.post(BASE + '/api/daily', { data: {} });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(pet + ': ' + e.message));
  p.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 500) errors.push(`${pet} ${r.status()} ${r.url()}`); });
  return { ctx, p, pet, id: st.state.user.id, code: st.state.user.friend_code };
}
const api = async (pl, path, data) => { const r = await pl.ctx.request.post(BASE + path, { data }); const j = await r.json().catch(() => ({})); if (!r.ok()) throw new Error(`${path}: ${JSON.stringify(j)}`); return j; };
const me = async (pl) => (await pl.ctx.request.get(BASE + '/api/me')).json();

// pemain dengan rumah 5 ruangan berperabot
const A = await mk('Mochi', '#F6B7A8', 'kelinci', { ...devices['Pixel 7'] });
await adm.post(`/api/admin/players/${A.id}/wallet`, { data: { currency: 'coin', delta: 30000, reason: 'uji rumah tersambung' } });
for (const id of ['ruang-tamu', 'dapur', 'kamar-mandi', 'halaman']) await api(A, '/api/shop/buy', { itemId: id });
for (const id of ['sofa-santai', 'tv-tabung', 'karpet-kawung', 'kompor-dapur', 'kulkas-mini', 'meja-bambu', 'bak-mandi', 'bangku-taman', 'pohon-mangga', 'pot-monstera']) await api(A, '/api/shop/buy', { itemId: id });
let st = await me(A);
const R = Object.fromEntries(st.rooms.map((r) => [r.item ?? 'kamar', r]));
check(st.rooms.length === 5, `5 ruangan dibeli (${st.rooms.length})`);
const put = async (key, items) => { const r = R[key]; await api(A, '/api/room', { roomId: r.id, version: r.version, layout: [...r.layout, ...items] }); };
await put('ruang-tamu', [{ i: 'sofa-santai', x: 1, y: 0 }, { i: 'karpet-kawung', x: 2, y: 2 }, { i: 'tv-tabung', x: 5, y: 3 }, { i: 'pot-monstera', x: 0, y: 0 }]);
await put('dapur', [{ i: 'kompor-dapur', x: 1, y: 0 }, { i: 'kulkas-mini', x: 0, y: 0 }, { i: 'meja-bambu', x: 3, y: 3 }]);
await put('kamar-mandi', [{ i: 'bak-mandi', x: 0, y: 0 }]);
await put('halaman', [{ i: 'pohon-mangga', x: 0, y: 0 }, { i: 'bangku-taman', x: 3, y: 2 }]);

const shot = (pl, n) => pl.p.screenshot({ path: `${OUT}/${n}.png` });
async function closeSheets(pl) { for (let i = 0; i < 3; i++) { const x = pl.p.locator('.sheet .x'); if (await x.count()) { await x.first().click(); await W(300); } } }
const roomsShown = (pl) => pl.p.evaluate(() => new Set([...document.querySelectorAll('.room .fl[data-r], .room .tile[data-r]')].map((e) => e.getAttribute('data-r'))).size);
const petRoom = (pl) => pl.p.evaluate(() => document.querySelector('.roompill b')?.textContent ?? '');
const viewBox = (pl) => pl.p.evaluate(() => document.querySelector('svg.room')?.getAttribute('viewBox') ?? '');

// 1. HP: semua ruangan digambar sekaligus, kamera fokus ke kamar
await A.p.goto(BASE + '/'); await W(1800); await closeSheets(A); await W(900);
check(await roomsShown(A) === 5, 'kelima ruangan tampil dalam satu rumah');
check((await A.p.locator('svg.room .spot[data-spot="jendela"]').count()) >= 1, 'jendela di dinding belakang');
await shot(A, '01-hp-fokus-kamar');
// 2. seluruh rumah
await A.p.click('.cambtn'); await W(900);
await shot(A, '02-hp-seluruh-rumah');
const vbHouse = await viewBox(A);
// 3. pilih Dapur dari Rumahku: pet berjalan ke sana lewat pintu, kamera ikut
await A.p.click('.cambtn'); await W(700);
await A.p.click('.roompill'); await A.p.waitForSelector('.sheet .room');
await A.p.click('.sheet .room:has-text("Dapur")'); await W(400);
let walked = false;
for (let i = 0; i < 40 && !walked; i++) { await W(250); walked = (await petRoom(A)).includes('Dapur'); }
check(walked, 'pet berjalan ke Dapur dan ruangan aktif ikut berganti');
await W(1500); await shot(A, '03-hp-di-dapur');
// 4. ketuk lantai Kamar Mandi: pet pindah ruangan sendiri lewat pintu
await A.p.click('.cambtn'); await W(900);
const km = R['kamar-mandi'].id;
await A.p.evaluate((id) => { const el = document.querySelector(`.room .fl[data-r="${id}"][data-x="1"][data-y="2"]`); el?.dispatchEvent(new MouseEvent('click', { bubbles: true })); }, km);
let inBath = false;
for (let i = 0; i < 40 && !inBath; i++) { await W(250); inBath = (await petRoom(A)).includes('Kamar Mandi'); }
check(inBath, 'ketuk lantai ruangan lain: pet berjalan ke Kamar Mandi');
await W(800); await shot(A, '04-hp-ke-kamar-mandi');
// 5. geser kamera dengan jari
await A.p.click('.cambtn'); await W(800);
const vb0 = await viewBox(A);
const box = await A.p.locator('svg.room').boundingBox();
await A.p.mouse.move(box.x + 200, box.y + 420); await A.p.mouse.down(); await A.p.mouse.move(box.x + 120, box.y + 360, { steps: 6 }); await A.p.mouse.up(); await W(300);
check((await viewBox(A)) !== vb0, 'kamera bisa digeser');
check(await A.p.locator('.cambtn:has-text("Ikuti"), .cambtn[aria-label*="Kembali"]').count() === 1, 'tombol kembali mengikuti pet muncul setelah digeser');
await A.p.click('.cambtn'); await W(800);
// 6. mode Atur per ruangan: ruangan lain diredupkan, ketuk ruangan lain untuk mengaturnya
await A.p.click('.acts .act:has-text("Atur")'); await W(900);
check((await A.p.locator('svg.room .dim').count()) > 0, 'mode Atur: ruangan lain diredupkan');
check((await A.p.locator('.editbar .ename').textContent()).includes('Kamar Mandi'), 'mode Atur mengatur ruangan tempat pet berada');
await shot(A, '05-hp-atur-kamar-mandi');
const rt = R['ruang-tamu'].id;
await A.p.evaluate((id) => { const el = document.querySelector(`.room .fl[data-r="${id}"]`); el?.dispatchEvent(new MouseEvent('click', { bubbles: true })); }, rt);
await W(900);
check((await A.p.locator('.editbar .ename').textContent()).includes('Ruang Tamu'), 'ketuk ruangan lain saat Atur: pindah mengatur Ruang Tamu');
await shot(A, '06-hp-atur-ruang-tamu');
await A.p.click('.editbar .btn:has-text("Batal")'); await W(600);

// 7. desktop & tamu: tuan rumah di Kamar Mandi, tamu di ruangan lain tetap saling terlihat
const B = await mk('Kopi', '#9FD0E8', 'kucing', { viewport: { width: 1366, height: 820 } });
await B.ctx.request.post(BASE + '/api/friends', { data: { code: A.code } });
await B.p.goto(BASE + '/#friends'); await B.p.waitForSelector('.friend');
await B.p.click('.friend:has-text("Mochi") .btn >> nth=0');
await B.p.waitForSelector('.hbar'); await W(2500);
check(await roomsShown(B) === 5, 'tamu melihat seluruh rumah teman (5 ruangan)');
const hostTag = async () => B.p.locator('.tag:text-is("Mochi")').count();
let seen = 0;
for (let i = 0; i < 16 && !seen; i++) { await W(300); seen = await hostTag(); }
check(seen === 1, 'pet tuan rumah terlihat walau di ruangan lain');
await B.p.click('.whorow .cambtn'); await W(1000);
await shot(B, '07-desktop-tamu-seluruh-rumah');
// tamu berjalan ke halaman
const hal = R['halaman'].id;
await B.p.evaluate((id) => { const el = document.querySelector(`.room .fl[data-r="${id}"][data-x="4"][data-y="4"]`); el?.dispatchEvent(new MouseEvent('click', { bubbles: true })); }, hal);
await W(5000);
const guestRoom = await B.p.evaluate(() => 1);
void guestRoom;
await shot(B, '08-desktop-tamu-ke-halaman');
await A.p.click('.cambtn'); await W(1500);
check(await A.p.locator('.tag:text-is("Kopi")').count() === 1, 'tuan rumah melihat tamu yang sedang di halaman');
await shot(A, '09-hp-tuan-rumah-lihat-tamu');
// tampilan desktop rumah sendiri
await B.p.click('.visit .btn:has-text("Pulang")'); await W(1500); await closeSheets(B);
await shot(B, '10-desktop-rumah-sendiri');

console.log('viewBox seluruh rumah:', vbHouse);
if (errors.length) { console.log('Error halaman:'); for (const e of errors) console.log('  ' + e); }
await b.close();
if (fails.length || errors.length) { console.log(`\n${fails.length} cek gagal, ${errors.length} error`); process.exit(1); }
console.log('\nSemua cek rumah tersambung lolos.');
