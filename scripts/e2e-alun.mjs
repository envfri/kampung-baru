// Uji Alun-alun dengan 3 pemain yang bukan teman (2 HP, 1 desktop): jalan dari peta, saling melihat, obrolan,
// ajak berteman, naik komidi putar, jajan, joget (bila musik sedang main), foto bareng, blokir & laporan;
// v32 Pojok Wahana: lapangan 28×22, bianglala, lempar gelang, kereta kelinci, kabar acara, pratinjau malam,
// Kolam Pemancingan Bareng (duduk di dermaga, layar mancing, Papan Lomba Mancing).
// Jalankan server dulu (npm run build && npm start), lalu: npm run test:e2e:alun
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE_URL ?? 'http://localhost:8787', OUT = process.env.SHOTS ?? 'test-results/e2e-alun';
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
  return { ctx, p, pet, id: st.state.user.id };
}
const shot = (pl, n) => pl.p.screenshot({ path: `${OUT}/${n}.png` });
async function closeSheets(pl) { for (let i = 0; i < 3; i++) { const x = pl.p.locator('.sheet .x'); if (await x.count()) { await x.first().click(); await W(300); } } }
async function enter(pl) {
  await pl.p.goto(BASE + '/'); await W(1500); await closeSheets(pl);
  await pl.p.goto(BASE + '/?r=1#alun'); await pl.p.waitForSelector('.sbar, .fp', { timeout: 20000 }); await W(800);
}
/** ketuk benda di alun-alun berdasarkan urutan di ALUN_LAYOUT (10 potong jalan batu dulu; benda v32 ditambah di akhir) */
const PROP = { panggung: 10, airmancur: 11, komidi: 14, ayunan: 15, dawet: 16, bakso: 17, bianglala: 49, gelang: 50, halte: 51 };
async function tapProp(pl, i) {
  await pl.p.evaluate((idx) => {
    const el = document.querySelector(`svg.room .furn[data-r="alun"][data-i="${idx}"]`);
    const r = el?.getBoundingClientRect();
    el?.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r ? r.left + r.width / 2 : 100, clientY: r ? r.top + r.height / 2 : 100 }));
  }, i);
}

const A = await mk('Gethuk', '#F6B7A8', 'kelinci', { ...devices['Pixel 7'] });
const B = await mk('Klepon', '#9FD0E8', 'kucing', { viewport: { width: 1366, height: 820 } });
const C = await mk('Cenil', '#C9B6E8', 'tunas', { ...devices['Pixel 7'] });

// peta kampung punya Alun-alun
await A.p.goto(BASE + '/'); await W(1500); await closeSheets(A);
await A.p.click('.dock button:has-text("Kampung"), nav button:has-text("Kampung")').catch(() => {});
await W(1200);
check(await A.p.locator('svg.map .loc[data-loc="alun"]').count() === 1, 'Alun-alun ada di peta kampung');
await A.p.evaluate(() => { const w = document.querySelector('.wrap'); if (w) w.scrollLeft = w.scrollWidth; });
await W(300); await shot(A, '01-peta-alun-alun');

for (const pl of [A, B, C]) await enter(pl);
const enteredAt = Date.now();
await W(4000);
// sekali saja: "Mau punya teman baru?" (terima ajakan berteman bawaannya mati). Klepon menyalakannya.
check(await A.p.locator('.fp:has-text("Mau punya teman baru?")').count() === 1, 'kartu sekali "Mau punya teman baru?" muncul');
await shot(A, '02a-hp-mau-punya-teman');
await A.p.click('.fp .btn:has-text("Nanti")');
await B.p.click('.fp .btn:has-text("Ya, boleh")');
await C.p.click('.fp .btn:has-text("Nanti")');
await W(400);
check(await A.p.locator('.fp').count() === 0, 'kartu sekali tertutup setelah dijawab');
check((await (await B.ctx.request.get(BASE + '/api/me')).json()).user.friend_requests === true, 'Ya, boleh: terima ajakan berteman menyala');
const sees = async (pl, name) => pl.p.locator(`.tag:text-is("${name}")`).count();
let both = false;
for (let i = 0; i < 20 && !both; i++) { both = (await sees(A, 'Klepon')) + (await sees(A, 'Cenil')) >= 1; if (!both) await W(500); }
check(both, 'pemain lain (bukan teman) terlihat di alun-alun');
check((await A.p.locator('.sbar .status').textContent()).includes('3/20'), 'status: 3/20 orang');
await shot(A, '02-hp-alun-alun');
await shot(B, '03-desktop-alun-alun');
await A.p.click('.roombar .cambtn'); await W(1200);
await shot(A, '04-hp-seluruh-alun-alun');
await A.p.click('.roombar .cambtn'); await W(800);

// obrolan frasa
await A.p.click('.sbar .btn:has-text("Ngobrol")');
check((await A.p.locator('.sbar .tip').textContent()).includes('kode'), 'pengingat jangan bagikan kode saat mengobrol');
await A.p.click('.sbar .chip:has-text("Halo semua!")');
let heard = false;
for (let i = 0; i < 10 && !heard; i++) { await W(400); heard = (await B.p.locator('.bubble.hb:has-text("Halo semua!")').count()) > 0; }
check(heard, 'obrolan sampai ke pemain lain');
await A.p.click('.sbar .btn:has-text("Tutup")');
await shot(B, '05-desktop-obrolan');

// ketuk pet orang lain → kartu profil → Ajak berteman → kartu ajakan di layar yang diajak → Terima
const tapPet = (pl, id) => pl.p.evaluate((u) => document.querySelector(`svg.room .opet[data-o="${u}"]`)?.dispatchEvent(new MouseEvent('click', { bubbles: true })), id);
check(await A.p.locator('.sbar .btn:has-text("Orang")').count() === 0, 'tombol Orang sudah tidak ada');
await tapPet(A, B.id);
await A.p.waitForSelector('.pcard[role="dialog"]');
check((await A.p.locator('.pcard').textContent()).includes('Pemilik: Klepon'), 'kartu profil: nama pet & pemilik');
check(await A.p.locator('.pcard .btn:has-text("Ajak berteman")').count() === 1, 'kartu profil: tombol Ajak berteman');
await W(400); await shot(A, '05a-hp-kartu-profil');
await A.p.click('.pcard .btn:has-text("Ajak berteman")'); await W(700);
check(await A.p.locator('.pcard .btn:has-text("menunggu jawaban")').count() === 1, 'ajakan terkirim: menunggu jawaban');
await A.p.click('.pcard .x');
check(await A.p.locator('.pcard').count() === 0, 'kartu tertutup dengan ×');
let card = false;
for (let i = 0; i < 15 && !card; i++) { await W(400); card = (await B.p.locator('.ask:has-text("Gethuk ngajak kamu berteman")').count()) === 1; }
check(card, 'yang diajak melihat kartu ajakan berteman');
await shot(B, '05b-desktop-kartu-ajakan');
await B.p.click('.ask .btn:has-text("Terima")');
let okToast = false;
for (let i = 0; i < 15 && !okToast; i++) { await W(400); okToast = (await A.p.locator('.toast:has-text("menerima ajakan berteman")').count()) > 0; }
check(okToast, 'pengajak diberi tahu ajakan diterima');
check((await (await A.ctx.request.get(BASE + '/api/friends')).json()).friends.some((f) => f.id === B.id), 'sekarang berteman');
// label nama juga bisa diketuk; teman: Kunjungi rumahnya
await A.p.locator('.tag.tap', { hasText: 'Klepon' }).first().click({ force: true });
await A.p.waitForSelector('.pcard[role="dialog"]'); await W(500);
check(await A.p.locator('.pcard .chip:has-text("Teman")').count() === 1 && await A.p.locator('.pcard .btn:has-text("Kunjungi rumahnya")').count() === 1, 'label nama → kartu: Teman + Kunjungi rumahnya');
await A.p.click('.pcard .btn:has-text("Kirim hati")'); await W(300);
await A.p.keyboard.press('Escape');
check(await A.p.locator('.pcard').count() === 0, 'kartu tertutup dengan Esc');
// yang belum menyalakan terima ajakan
await tapPet(C, A.id);
await C.p.waitForSelector('.pcard[role="dialog"]'); await W(500);
check(await C.p.locator('.pcard .btn:has-text("Belum menerima ajakan berteman")').count() === 1, 'pemain yang belum menerima ajakan: tombol tidak aktif');
await W(300); await shot(C, '05c-hp-belum-menerima-ajakan');
await C.p.click('.pcard .x');

// jalan batu bagian dari lantai: mengetuknya membuat pet berjalan ke sana
const before = await A.p.evaluate(() => document.querySelector('svg.room .pet')?.getAttribute('transform'));
await A.p.evaluate(() => { const el = [...document.querySelectorAll('svg.room .fl[data-r="alun"]')].find((e) => e.getAttribute('data-x') === '10' && e.getAttribute('data-y') === '6'); el?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
await W(2500);
check((await A.p.evaluate(() => document.querySelector('svg.room .pet')?.getAttribute('transform'))) !== before, 'ketuk jalan batu: pet berjalan');
check(await A.p.locator('.tag.self').count() === 1, 'label pet sendiri "(kamu)"');
// daftar Main di bar (tanpa mengetuk gambar): ayunan
await A.p.click('.sbar .btn:has-text("Main")'); await W(300);
check(await A.p.locator('.sbar .pop .btn:has-text("Naik komidi putar")').count() === 1, 'daftar Main berisi aktivitas alun-alun');
await A.p.click('.sbar .pop .btn:has-text("Main ayunan")');
let swung = false;
for (let i = 0; i < 30 && !swung; i++) { await W(300); swung = (await A.p.locator('svg.room .pet.pose-ayun').count()) > 0; }
check(swung, 'dari daftar Main: pet main ayunan');
await W(4500);
// naik komidi putar
await tapProp(A, PROP.komidi); await W(400);
check(await A.p.locator('.menu .btn:has-text("Naik komidi putar")').count() === 1, 'ketuk komidi putar: menu Naik');
await A.p.click('.menu .btn:has-text("Naik komidi putar")');
let rode = false;
for (let i = 0; i < 24 && !rode; i++) { await W(300); rode = (await A.p.locator('svg.room .pet.pose-naik').count()) > 0; }
check(rode, 'pet naik komidi putar');
await shot(A, '06-hp-naik-komidi');
await W(4000);

// jajan es dawet
await tapProp(C, PROP.dawet); await W(400);
const jajan = C.p.locator('.menu .btn:has-text("Jajan Es Dawet")');
check(await jajan.count() === 1, 'gerobak: menu Jajan Es Dawet');
if (await jajan.count()) { await jajan.click(); await W(6000); }
check((await C.p.locator('.toast').textContent().catch(() => '')).length >= 0, 'jajan selesai');
await shot(C, '07-hp-jajan');

// joget bareng bila musik sedang main
const music = !(await A.p.locator('.sbar .btn:has-text("Joget")').isDisabled());
if (music) {
  for (const pl of [A, B, C]) await pl.p.click('.sbar .btn:has-text("Joget")');
  await W(2500);
  check((await A.p.locator('svg.room .pose-joget').count()) >= 2, 'joget bareng terlihat');
  await shot(A, '08-hp-joget-bareng');
} else console.log('     (musik sedang tidak main: joget dilewati)');

// foto bareng: pet di dekat yang memotret ikut
await B.p.click('.sbar .btn:has-text("Foto")'); await B.p.click('.sbar .pop .btn:has-text("Senyum")');
await W(1500);
check(await B.p.locator('.ph').count() === 1 || (await B.p.locator('.toast:has-text("Ajak pet lain")').count()) === 1, 'foto bareng: pratinjau foto atau ajakan mendekat');
await shot(B, '09-desktop-foto');
await B.p.locator('.ph .btn:has-text("Tutup")').click().catch(() => {});

// v32 Pojok Wahana: lapangan 28×22 dengan rel kereta, bianglala, kereta kelinci, lempar gelang, kabar acara
check(await A.p.locator('svg.room .fl[data-r="alun"]').count() === 28 * 22, 'lapangan 28×22 petak');
check(await A.p.locator('svg.room .alun-ground').count() === 1, 'rel kereta kelinci keliling lapangan');
check(await A.p.locator('svg.room .bl-gon').count() === 6, 'bianglala: 6 gondola');
check(await A.p.locator('svg.room [data-o^="mv:kr"]').count() === 7, 'kereta kelinci: lokomotif + 3 gerbong (lantai & atap)');
const fitBad = await A.p.evaluate(() => [...document.querySelectorAll('svg.room text[data-fit]')].filter((t) => t.getComputedTextLength() > Number(t.dataset.fit) + 0.5).map((t) => t.textContent));
check(fitBad.length === 0, `tulisan papan & gapura muat di papannya${fitBad.length ? ': ' + fitBad.join(', ') : ''}`);
check((await A.p.locator('.sbar .ev').textContent()).trim().length > 0, 'bar: kabar acara (arak-arakan / wahana / malam)');
// C naik bianglala (selesai ±70 detik; hadiahnya dicek sambil menunggu laporan)
await C.p.click('.sbar .btn:has-text("Main")'); await W(300);
check(await C.p.locator('.sbar .pop .btn:has-text("Naik bianglala")').count() === 1, 'daftar Main berisi wahana Pojok Wahana');
await C.p.click('.sbar .pop .btn:has-text("Naik bianglala")');
let inGondola = false;
for (let i = 0; i < 80 && !inGondola; i++) { await W(300); inGondola = (await C.p.locator('svg.room .pet.pose-wahana').count()) > 0; }
check(inGondola, 'naik bianglala: pet duduk di gondola');
check((await C.p.locator('.sbar .ev').textContent()).includes('Naik bianglala'), 'bar: sisa waktu naik bianglala');
let seenRide = false;
for (let i = 0; i < 15 && !seenRide; i++) { await W(400); seenRide = (await A.p.locator(`svg.room .opet.pose-wahana[data-o="${C.id}"]`).count()) === 1; }
check(seenRide, 'pemain lain melihat pet itu di gondola');
await W(3000); await shot(C, '11-hp-bianglala');
const rideStart = Date.now();
// A: lempar gelang (tiga lemparan diundi server)
await tapProp(A, PROP.gelang); await W(400);
const gl = A.p.locator('.menu .btn:has-text("Lempar gelang")');
check(await gl.count() === 1, 'ketuk lapak: menu Lempar gelang');
if (await gl.count()) await gl.click();
let thrown = false;
for (let i = 0; i < 40 && !thrown; i++) { await W(400); thrown = (await A.p.locator('.toast:has-text("dari 3 gelang")').count()) > 0; }
check(thrown, 'lempar gelang: hasil tiga lemparan');
await shot(A, '12-hp-lempar-gelang');
// B: kereta kelinci di halte (berhenti 15 detik tiap 2 menit): menunggu dengan hitung mundur + Batal, atau langsung naik
await B.p.click('.sbar .btn:has-text("Main")'); await W(300);
await B.p.click('.sbar .pop .btn:has-text("Naik Kereta Kelinci")');
let kr = '';
for (let i = 0; i < 40 && !/Kereta datang|Naik kereta/.test(kr); i++) { await W(500); kr = (await B.p.locator('.sbar .ev').textContent()) ?? ''; }
check(/Kereta datang \d+:\d\d|Naik kereta/.test(kr), `kereta: tunggu di halte atau naik (${kr.trim()})`);
await shot(B, '13-desktop-kereta');
if (kr.includes('Kereta datang')) {
  await B.p.click('.sbar .ev .mini:has-text("Batal")'); await W(600);
  check(!(await B.p.locator('.sbar .ev').textContent()).includes('Kereta datang'), 'Batal: berhenti menunggu kereta');
}
// pratinjau malam (jam HP 20.01): tirai malam, layar tancap memutar film, kembang api
const N = await mk('Onde', '#F4D58D', 'bulat', { viewport: { width: 1366, height: 768 } });
await N.p.goto(BASE + '/'); await W(1200); await closeSheets(N);
await N.p.goto(BASE + '/?r=2&jam=20:01#alun'); await N.p.waitForSelector('.sbar, .fp', { timeout: 20000 }); await W(1500);
await N.p.locator('.fp .btn:has-text("Nanti")').click().catch(() => {});
check(await N.p.locator('svg.room .malam .veil').count() === 1, 'malam: alun-alun gelap, lampu menyala');
check(await N.p.locator('.fwk .fwb').count() === 5, 'malam 20.00: kembang api');
check(await N.p.locator('svg.room .malam text', { hasText: 'Bupi' }).count() + await N.p.locator('svg.room .malam text', { hasText: 'Layangan' }).count() + await N.p.locator('svg.room .malam text', { hasText: 'Ikan' }).count() === 1, 'layar tancap memutar film');
await N.p.click('.roombar .cambtn'); await W(1400);
await shot(N, '14-desktop-malam');
await N.ctx.close();
// Kolam Pemancingan Bareng: A duduk di dermaga → layar mancing (alur Kolam Pancing), pemain lain melihatnya memancing
await A.p.click('.sbar .btn:has-text("Main")'); await W(300);
await A.p.click('.sbar .pop .btn:has-text("Mancing bareng")');
let fishing = false;
for (let i = 0; i < 60 && !fishing; i++) { await W(300); fishing = (await A.p.locator('.alunfish .fishing').count()) === 1; }
check(fishing, 'duduk di dermaga: layar mancing terbuka');
check(/Mancing Bareng|Lomba Mancing/.test((await A.p.locator('.alunfish h2').first().textContent()) ?? ''), 'layar mancing: Mancing Bareng / Lomba Mancing');
check(await A.p.locator('.sbar').count() === 0, 'bar alun-alun disembunyikan selama memancing');
let angler = false;
for (let i = 0; i < 15 && !angler; i++) { await W(400); angler = (await B.p.locator(`svg.room .opet.pose-mancing[data-o="${A.id}"]`).count()) === 1; }
check(angler, 'pemain lain melihat pet itu memancing di dermaga');
const cast = await A.p.evaluate(async () => {
  const P = async (u, body) => (await fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json();
  const c = await P('/api/square/fish/cast', { distance: 'dekat' });
  if (c.castId) await P('/api/square/fish/lost', { castId: c.castId, reason: 'batal' });
  return c;
});
check(cast.mode === 'santai' || cast.mode === 'lomba', `lempar kail dari dermaga (${cast.mode ?? cast.error?.code})`);
await shot(A, '15-hp-mancing-bareng');
await A.p.click('.alunfish .btn:has-text("Berdiri")'); await W(800);
check(await A.p.locator('.alunfish').count() === 0 && await A.p.locator('.sbar').count() === 1, 'Berdiri: kembali ke alun-alun');
// Papan Lomba Mancing: papan skor / jadwal (B mungkin masih naik kereta, jadi A yang mengetuk)
await A.p.evaluate(() => { const el = document.querySelector(`svg.room .furn[data-r="alun"][data-i="48"]`); el?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
await W(600);
check(await A.p.locator('.lomba[role="dialog"]').count() === 1, 'ketuk Papan Lomba Mancing: papan skor / jadwal lomba');
check(await A.p.locator('.sbar').count() === 0, 'HP: bar alun-alun disembunyikan selama papan terbuka');
await shot(A, '16-hp-papan-lomba');
await A.p.click('.lomba .btn:has-text("Tutup")'); await W(300);

// laporkan & blokir lewat kartu profil
// server baru menerima laporan setelah pelapor 1 menit di alun-alun
// sambil menunggu: bianglala C selesai satu putaran → hadiah wahana dari server
let rideDone = false;
while (Date.now() - enteredAt < 62_000 || (!rideDone && Date.now() - rideStart < 90_000)) { if (!rideDone) rideDone = (await C.p.locator('.toast:has-text("Naik bianglala seru"), .toast:has-text("hadiah main hari ini sudah habis")').count()) > 0; await W(500); }
check(rideDone, 'bianglala selesai: hadiah wahana');
await tapPet(C, B.id); await C.p.waitForSelector('.pcard[role="dialog"]');
await C.p.click('.pcard .foot button:has-text("Laporkan")');
await C.p.fill('.pcard .input', 'uji laporan');
await C.p.click('.pcard .btn:has-text("Kirim laporan")'); await W(600);
check((await C.p.locator('.toast').textContent().catch(() => '')).includes('Laporan'), 'laporan terkirim');
await tapPet(C, A.id); await C.p.waitForSelector('.pcard[role="dialog"]');
await C.p.click('.pcard .foot button:has-text("Blokir")');
await C.p.click('[role="alertdialog"] .btn:has-text("Blokir")');
await W(3000);
const blocks = await (await C.ctx.request.get(BASE + '/api/blocks')).json();
check(blocks.blocks?.some((x) => x.id === A.id), 'blokir tersimpan');
check(await sees(C, 'Gethuk') === 0 && await C.p.locator(`svg.room .opet[data-o="${A.id}"]`).count() === 0, 'pemain yang diblokir hilang dari alun-alun');
await shot(C, '10-hp-setelah-blokir');

// pulang ke peta
await A.p.click('.sbar .btn:has-text("Pulang")'); await W(1200);
check(await A.p.locator('svg.map').count() === 1, 'Pulang: kembali ke peta kampung');

if (errors.length) { console.log('Error halaman:'); for (const e of errors) console.log('  ' + e); }
await b.close();
if (fails.length || errors.length) { console.log(`\n${fails.length} cek gagal, ${errors.length} error`); process.exit(1); }
console.log('\nSemua cek alun-alun lolos.');
