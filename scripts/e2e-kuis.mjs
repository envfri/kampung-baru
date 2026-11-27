// Uji Cerdas Cermat Kampung (Pak Kancil): Kuis Harian di HP 390 & 320 (7 tipe soal, jawaban benar & salah, waktu habis,
// "Tahukah kamu?", Laporkan soal, layar akhir), desktop 1366, Cerdas Cermat Bareng (3 pemain di rumah teman, 2 di alun-alun
// + penonton), Tantang Teman (dari layar Kuis & daftar Duel), panel admin Kuis (tambah/ubah/nonaktifkan, laporan), dan
// gerak dikurangi. Kunci jawaban dibaca lewat API admin (tidak ada ID / teks soal yang ditulis di sini).
// Jalankan server dulu dengan admin (ADMIN_EMAIL & ADMIN_PASSWORD), lalu: npm run test:e2e:kuis
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, request } = require('playwright');
const BASE = process.env.BASE_URL ?? 'http://localhost:8787', OUT = process.env.SHOTS ?? 'test-results/e2e-kuis';
const ADMIN = { email: process.env.ADMIN_EMAIL ?? 'owner@bupi.test', password: process.env.ADMIN_PASSWORD ?? 'rahasia-sekali-123' };
mkdirSync(OUT, { recursive: true });
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [], errors = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'GAGAL'} ${msg}`); if (!ok) fails.push(msg); };
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exact = (t) => new RegExp(`^\\s*${esc(t)}\\s*$`);
const b = await chromium.launch();

/* ---------------- admin API: kunci jawaban & pengaturan ---------------- */
const adm = await request.newContext({ baseURL: BASE });
check((await adm.post('/api/admin/login', { data: ADMIN })).status() === 200, 'admin masuk lewat API');
const Q = {};
async function loadQ() { for (const r of (await (await adm.get('/api/admin/kuis/questions?status=')).json()).questions) Q[r.id] = r.data; }
await loadQ();
const settings0 = (await (await adm.get('/api/admin/settings')).json()).value;
async function setKuis(patch) { const v = (await (await adm.get('/api/admin/settings')).json()).value; const r = await adm.put('/api/admin/settings', { data: { value: { ...v, kuis: { ...v.kuis, ...patch } } } }); return r.status(); }
const TYPES = ['pilihan', 'benarsalah', 'gambar', 'urutkan', 'cocokkan', 'peribahasa', 'hitung'];
const active = Object.values(Q).filter((q) => q);
check(TYPES.every((t) => active.some((q) => q.type === t)), 'bank berisi ketujuh tipe soal');

/* ---------------- pemain ---------------- */
async function mk(name, color, ear, opts, init = {}) {
  const ctx = await b.newContext({ deviceScaleFactor: 2, ...opts });
  await ctx.addInitScript((m) => { try { localStorage.setItem('kb-save-snooze', String(Date.now() + 9e9)); if (m) localStorage.setItem('kb-motion', 'kurang'); } catch {} }, !!init.lessMotion);
  await ctx.request.post(BASE + '/api/auth/guest', { data: {} });
  const st = await (await ctx.request.post(BASE + '/api/pet', { data: { name, color, ear } })).json();
  await ctx.request.post(BASE + '/api/daily', { data: {} });
  const p = await ctx.newPage();
  const pl = { ctx, p, name, id: st.state.user.id, code: st.state.user.friend_code, run: null, last: null };
  p.on('pageerror', (e) => errors.push(name + ': ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(`${name} console: ${m.text()}`); });
  p.on('response', async (r) => {
    const u = r.url();
    if (u.includes('/api/') && r.status() >= 500) errors.push(`${name} ${r.status()} ${u}`);
    if (/\/api\/kuis\/(harian|runs\/|tantang\/)/.test(u) && r.status() === 200) { try { const j = await r.json(); if (j.run) pl.run = j.run; } catch {} }
    if (/\/sync$/.test(u) && r.status() === 200) { try { const j = await r.json(); if (Array.isArray(j.games)) pl.games = j.games; } catch {} }
  });
  return pl;
}
const shot = (pl, n) => pl.p.screenshot({ path: `${OUT}/${n}.png` });
async function closeSheets(pl) { for (let i = 0; i < 3; i++) { const x = pl.p.locator('.sheet .x'); if (await x.count()) { await x.first().click(); await W(300); } } }
const noHScroll = (pl) => pl.p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** jawab soal yang sedang tampil: 'ok' benar, 'no' salah, 'timeout' biarkan waktu habis */
async function answerNow(pl, mode, label) {
  const cur = pl.run?.current;
  if (!cur) throw new Error('tidak ada soal berjalan');
  const q = Q[cur.q.id];
  const p = pl.p, sel = '.card.play .soal';
  if (mode === 'timeout') { await p.waitForSelector('.reveal', { timeout: (cur.limitMs ?? 15000) + 12000 }); return q; }
  if (q.type === 'benarsalah') {
    const i = mode === 'ok' ? q.answer : 1 - q.answer;
    await p.click(`${sel} .bs .opt >> nth=${i}`);
  } else if (q.options) {
    const t = mode === 'ok' ? q.options[q.answer] : q.options.find((_, i) => i !== q.answer);
    await p.locator(`${sel} .opt`).filter({ has: p.locator('.tx', { hasText: exact(t) }) }).click();
  } else if (q.type === 'urutkan') {
    const order = mode === 'ok' ? q.order : [...q.order].reverse();
    for (const t of order) { await p.locator(`${sel} .items .item`).filter({ has: p.locator('.tx', { hasText: exact(t) }) }).click(); await W(120); }
    if (label) await shot(pl, `${label}-terisi`);
    await p.click(`${sel} .kirim`);
  } else if (q.type === 'cocokkan') {
    const n = q.pairs.length;
    const pairs = mode === 'ok' ? q.pairs : q.pairs.map((x, i) => [x[0], q.pairs[(i + 1) % n][1]]);
    for (const [l, r] of pairs) {
      await p.locator(`${sel} .match .col >> nth=0`).locator('.pair').filter({ has: p.locator('.tx', { hasText: exact(l) }) }).click(); await W(80);
      await p.locator(`${sel} .match .col >> nth=1`).locator('.pair').filter({ has: p.locator('.tx', { hasText: exact(r) }) }).click(); await W(120);
    }
    if (label) await shot(pl, `${label}-terisi`);
    await p.click(`${sel} .kirim`);
  }
  await p.waitForSelector('.reveal', { timeout: 8000 });
  return q;
}
async function lanjut(pl) {
  const wasDone = pl.run?.done;
  await Promise.all([wasDone ? Promise.resolve() : pl.p.waitForResponse((r) => r.url().includes('/next'), { timeout: 8000 }).catch(() => {}), pl.p.click('.reveal .next')]);
  await W(400);
}
let nav = 0;
async function openKuis(pl) {
  // muat ulang sungguhan (pindah tagar saja tidak memuat ulang halaman)
  await pl.p.goto(`${BASE}/?r=${++nav}#kuis`);
  await pl.p.waitForSelector('.kuis .hero:not(.end)', { timeout: 15000 });
  await W(900);
}

/* ================= 1. Kuis Harian: 7 tipe, HP 390 & 320 ================= */
// kolam soal dibatasi satu soal per tipe (lewat admin) supaya kedua permainan pasti memuat ketujuh tipe
const keep = TYPES.map((t) => active.filter((q) => q.type === t).sort((a, b) => a.level - b.level)[0].id);
const disabled = [];
for (const q of active) if (!keep.includes(q.id)) { await adm.post(`/api/admin/kuis/questions/${q.id}/active`, { data: { active: false } }); disabled.push(q.id); }
check(disabled.length === active.length - 7, `kolam soal uji: 7 soal (satu per tipe), ${disabled.length} dinonaktifkan sementara`);
await W(16_000); // cache bank soal server ±15 detik

const A = await mk('Kinan', '#F6B7A8', 'kelinci', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const B = await mk('Bayu', '#9FD0E8', 'kucing', { viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true });
await B.ctx.request.post(BASE + '/api/friends', { data: { code: A.code } });

// Balai Main: kartu Kuis
await A.p.goto(BASE + '/#games'); await A.p.waitForSelector('.gm.kz', { timeout: 15000 }); await W(800);
await shot(A, '01-balai-main-kartu-kuis');
check(await A.p.locator('.gm.kz:has-text("Cerdas Cermat Kampung") .btn:has-text("Kuis")').count() === 1, 'Balai Main: kartu Cerdas Cermat Kampung');
await A.p.click('.gm.kz .btn');
await A.p.waitForSelector('.kuis .hero', { timeout: 10000 }); await W(1200);
await shot(A, '02-beranda-kuis-390');
check(await A.p.locator('.kuis .streak:has-text("Beruntun")').count() === 1 && await A.p.locator('.kuis .board').count() === 1, 'beranda Kuis: beruntun, mode, papan peringkat');
check((await noHScroll(A)) <= 1, 'beranda Kuis tanpa geser samping (390)');

await A.p.click('button:has-text("Mulai Kuis Harian")');
await A.p.waitForSelector('.card.play .soal', { timeout: 10000 }); await W(500);
check(!!A.run && A.run.total === 7, 'Kuis Harian dimulai (7 soal dari kolam uji)');
check(!JSON.stringify(A.run.current).match(/"(answer|order|pairs|explain|source)"/), 'soal yang sedang berjalan tanpa kunci jawaban (respons API)');
check(await A.p.locator('.timer').count() === 1, 'hitung mundur tampil');
// A: benar untuk pilihan/gambar/urutkan/hitung, salah untuk benarsalah/cocokkan, peribahasa dibiarkan waktu habis
const planA = { pilihan: 'ok', gambar: 'ok', urutkan: 'ok', hitung: 'ok', benarsalah: 'no', cocokkan: 'no', peribahasa: 'timeout' };
const seenTypes = new Set();
let shotOk = false, shotNo = false, reported = false;
for (let i = 0; i < 7; i++) {
  await A.p.waitForSelector('.card.play .soal', { timeout: 10000 }); await W(350);
  const t = Q[A.run.current.q.id].type;
  seenTypes.add(t);
  await shot(A, `03-soal-${t}-390`);
  check((await noHScroll(A)) <= 1, `soal ${t}: tanpa geser samping (390)`);
  const q = await answerNow(A, planA[t], `03-soal-${t}-390`);
  await W(500);
  const txt = await A.p.locator('.reveal').innerText();
  if (planA[t] === 'ok') { check(/Benar!/.test(txt) && /Tahukah kamu\?/.test(txt), `${t}: jawaban benar → "Benar!" + Tahukah kamu`); if (!shotOk) { await shot(A, '04-benar-tahukah-kamu'); shotOk = true; } }
  if (planA[t] === 'no') { check(/Belum tepat/.test(txt) && txt.includes(q.explain.slice(0, 25)), `${t}: jawaban salah → kunci & penjelasan`); if (!shotNo) { await shot(A, '05-salah-tahukah-kamu'); shotNo = true; } }
  if (planA[t] === 'timeout') { check(/Waktu habis/.test(txt) && txt.includes(q.explain.slice(0, 25)), `${t}: waktu habis → kunci & penjelasan`); await shot(A, '06-waktu-habis'); }
  if (t === 'cocokkan' || t === 'urutkan') await shot(A, `03-soal-${t}-390-kunci`);
  if (!reported && planA[t] === 'no') {
    await A.p.click('.reveal .btn:has-text("Laporkan soal")');
    await A.p.waitForSelector('.lapor'); await A.p.click('.lapor button:has-text("Jawaban salah")');
    await A.p.fill('.lapor textarea', 'Uji e2e: mohon dicek kuncinya.');
    await W(200); await shot(A, '07-laporkan-soal');
    await A.p.click('.lapor .btn:has-text("Kirim laporan")'); await W(800);
    check(await A.p.locator('.lapor').count() === 0, 'laporan terkirim dari layar jawaban');
    reported = true;
    await W(2600); // kabar "terima kasih" hilang dulu
  }
  await lanjut(A);
}
check(TYPES.every((t) => seenTypes.has(t)), `ketujuh tipe soal dimainkan di HP 390 (${[...seenTypes].join(', ')})`);
await A.p.waitForSelector('.kuis .score', { timeout: 10000 }); await W(800);
await shot(A, '08-layar-akhir');
const endTxt = await A.p.locator('.kuis').innerText();
check(/4\/7 benar/.test(endTxt), 'layar akhir: 4/7 benar');
check(await A.p.locator('.cats .ct').count() >= 5 && await A.p.locator('.review .rv').count() === 7, 'layar akhir: benar per kategori & daftar tinjau soal');
check(await A.p.locator('.hero.end .host svg.kancil').count() === 1, 'layar akhir: reaksi Pak Kancil');

// B (320): kebalikan A, laporkan dari layar akhir
const planB = { pilihan: 'no', gambar: 'no', urutkan: 'no', hitung: 'no', benarsalah: 'ok', cocokkan: 'ok', peribahasa: 'ok' };
await openKuis(B);
await shot(B, '09-beranda-kuis-320');
check((await noHScroll(B)) <= 1, 'beranda Kuis tanpa geser samping (320)');
await B.p.click('button:has-text("Mulai Kuis Harian")');
const seenB = new Set();
for (let i = 0; i < 7; i++) {
  await B.p.waitForSelector('.card.play .soal', { timeout: 10000 }); await W(300);
  const t = Q[B.run.current.q.id].type;
  seenB.add(t);
  if (['gambar', 'cocokkan', 'urutkan'].includes(t)) await shot(B, `10-soal-${t}-320`);
  check((await noHScroll(B)) <= 1, `soal ${t}: tanpa geser samping (320)`);
  await answerNow(B, planB[t]);
  await W(300);
  const ok = /Benar!/.test(await B.p.locator('.reveal').innerText());
  check(ok === (planB[t] === 'ok'), `320 ${t}: ${planB[t] === 'ok' ? 'benar' : 'salah'} sesuai jawaban`);
  await lanjut(B);
}
check(TYPES.every((t) => seenB.has(t)), 'ketujuh tipe soal dimainkan di HP 320');
await B.p.waitForSelector('.kuis .score', { timeout: 10000 }); await W(500);
await shot(B, '11-layar-akhir-320');
await B.p.click('.review .rv >> nth=0 >> .btn:has-text("Laporkan")');
await B.p.click('.lapor button:has-text("Salah ketik")');
await B.p.click('.lapor .btn:has-text("Kirim laporan")'); await W(700);
const reps = (await (await adm.get('/api/admin/kuis/reports')).json()).reports;
check(reps.length >= 2 && reps.some((r) => r.note?.includes('Uji e2e')), `laporan pemain tersimpan (${reps.length})`);
// beranda sesudah selesai: hasil hari ini & beruntun 1
await B.p.click('.kuis .btn:has-text("Kembali ke Kuis")'); await W(1200);
check(/Selesai: \d\/7 benar/.test(await B.p.locator('.mode.harian').innerText()), 'beranda: Kuis Harian hari ini sudah selesai');
check(/Beruntun 1 hari/.test(await B.p.locator('.streak').innerText()), 'beranda: beruntun 1 hari');
check((await B.p.locator('.board .rk').count()) === 2, 'papan peringkat: aku & teman');
await shot(B, '12-beranda-selesai-peringkat-320');

// desktop 1366: dua soal
const D = await mk('Dimas', '#F4D58D', 'tunas', { viewport: { width: 1366, height: 820 } });
await openKuis(D);
await shot(D, '13-beranda-kuis-1366');
await D.p.click('button:has-text("Mulai Kuis Harian")');
for (let i = 0; i < 2; i++) {
  await D.p.waitForSelector('.card.play .soal', { timeout: 10000 }); await W(400);
  const t = Q[D.run.current.q.id].type;
  await shot(D, `14-soal-${t}-1366`);
  await answerNow(D, 'ok'); await W(400);
  if (i === 0) await shot(D, '14b-benar-1366');
  await lanjut(D);
}
check((await noHScroll(D)) <= 1, 'desktop 1366 tanpa geser samping');

// kolam soal kembali seperti semula
for (const id of disabled) await adm.post(`/api/admin/kuis/questions/${id}/active`, { data: { active: true } });
check((await (await adm.get('/api/admin/kuis/questions?status=active')).json()).questions.length === active.length, 'kolam soal dipulihkan');
await W(16_000);

/* ================= 2. Gerak dikurangi ================= */
for (const [tag, opts, init] of [['sistem', { reducedMotion: 'reduce' }, {}], ['pengaturan game', {}, { lessMotion: true }]]) {
  const R = await mk(tag === 'sistem' ? 'Rani' : 'Raka', '#C9B6E8', 'kucing', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, ...opts }, init);
  await openKuis(R);
  await R.p.click('button:has-text("Mulai Kuis Harian")');
  await R.p.waitForSelector('.card.play .soal', { timeout: 10000 });
  await answerNow(R, 'ok'); await W(300);
  const anim = await R.p.evaluate(() => ({ reveal: getComputedStyle(document.querySelector('.reveal')).animationName, html: document.documentElement.classList.contains('reduce-motion') }));
  check(anim.reveal === 'none', `gerak dikurangi (${tag}): kartu jawaban tanpa animasi`);
  if (tag === 'pengaturan game') check(anim.html, 'pilihan "Kurangi animasi" memasang kelas reduce-motion');
  await lanjut(R); await R.p.waitForSelector('.timer', { timeout: 8000 });
  const tr = await R.p.evaluate(() => getComputedStyle(document.querySelector('.timer .bar')).transitionDuration);
  check(/^0s/.test(tr), `gerak dikurangi (${tag}): lingkar waktu tanpa transisi halus`);
  if (tag === 'sistem') await shot(R, '15-gerak-dikurangi');
  await R.ctx.close();
}

/* ================= 3. Tantang Teman ================= */
await openKuis(A);
await A.p.click('.mode.tantang .btn:has-text("Tantang teman")');
await A.p.waitForSelector('.friends button'); await W(300);
await A.p.click('.friends button:has-text("Bayu")');
await shot(A, '16-tantang-pilih-teman');
await A.p.click('.btn:has-text("Tantang!")');
await A.p.waitForSelector('.card.play .soal', { timeout: 10000 });
check(A.run?.kind === 'tantang' && A.run.total === 5, 'Tantang Teman: 5 soal, A main duluan');
const tantangIds = [];
for (let i = 0; i < 5; i++) {
  await A.p.waitForSelector('.card.play .soal', { timeout: 10000 }); await W(250);
  tantangIds.push(A.run.current.q.id);
  await answerNow(A, i < 3 ? 'ok' : 'no'); await W(200);
  await lanjut(A);
}
await A.p.waitForSelector('.kuis .score', { timeout: 10000 }); await W(800);
check(/Menunggu Bayu/.test(await A.p.locator('.kuis .score').innerText()), 'A selesai: menunggu Bayu');
// B melihat tantangan di daftar Duel & di layar Kuis
await B.p.goto(`${BASE}/?r=${++nav}#duels`); await B.p.waitForSelector('.duel.hot', { timeout: 10000 }); await W(600);
check(await B.p.locator('.duel.hot:has-text("Tantang Kuis")').count() === 1, 'daftar Duel teman memuat tantangan kuis');
await shot(B, '17-tantangan-di-daftar-duel');
await B.p.click('.duel.hot:has-text("Tantang Kuis") .btn:has-text("Main")');
await B.p.waitForSelector('.card.play .soal', { timeout: 10000 });
check(B.run?.kind === 'tantang' && B.run.answers.length === 0, 'B memulai tantangan tanpa melihat jawaban A');
const idsB = [];
for (let i = 0; i < 5; i++) {
  await B.p.waitForSelector('.card.play .soal', { timeout: 10000 }); await W(200);
  idsB.push(B.run.current.q.id);
  await answerNow(B, 'ok'); await W(200);
  await lanjut(B);
}
check(JSON.stringify(idsB) === JSON.stringify(tantangIds), 'B mendapat soal yang sama persis');
await B.p.waitForSelector('.kuis .score .vs', { timeout: 10000 }); await W(1200);
check(/Kamu menang!/.test(await B.p.locator('.kuis .score').innerText()), 'B menang (5 vs 3 benar)');
await W(2600); // kabar "Tugas selesai" hilang dulu
await shot(B, '18-tantang-hasil');
await openKuis(A);
check(/Kalah/.test(await A.p.locator('.mode.tantang').innerText()), 'riwayat tantangan A: Kalah');
await shot(A, '19-tantang-riwayat-beranda');
// tantangan baru dari daftar Duel (pilihan permainan "Tantang Kuis")
await B.p.goto(`${BASE}/?r=${++nav}#duels`); await B.p.waitForSelector('.sheet'); await W(500);
await B.p.click('.sheet .btn:has-text("Tantang teman")');
await B.p.click('.new .friends button >> nth=0');
await B.p.click('.games button:has-text("Tantang Kuis")'); await W(300);
await shot(B, '20-duel-pilih-tantang-kuis');
await B.p.click('.new .btn:has-text("Tantang!")');
await B.p.waitForSelector('.card.play .soal', { timeout: 10000 });
check(B.run?.kind === 'tantang', 'Tantang Kuis dibuat dari daftar Duel lalu langsung dimainkan');
await B.p.click('.giveup'); await B.p.click('.giveup'); await W(1200);
check(await B.p.locator('.kuis .score').count() === 1, 'Akhiri: sisa soal dihitung waktu habis');
await openKuis(A);
check(await A.p.locator('.mode.tantang .duel.hot').count() === 1, 'A mendapat tantangan dari B di layar Kuis');
await shot(A, '21-tantang-undangan');

/* ================= 4. Cerdas Cermat Bareng: 3 pemain di rumah teman ================= */
async function answerBareng(pl, mode) {
  const g = (pl.games ?? []).find((x) => x.game === 'kuis');
  const q = Q[g?.kuis?.q?.id];
  if (!q) return false;
  const t = mode === 'ok' ? q.options[q.answer] : q.options.find((_, i) => i !== q.answer);
  if (q.type === 'benarsalah') await pl.p.click(`.kb .bs .opt >> nth=${mode === 'ok' ? q.answer : 1 - q.answer}`);
  else await pl.p.locator('.kb .opt').filter({ has: pl.p.locator('.tx', { hasText: exact(t) }) }).click();
  return true;
}
const waitStage = (pl, stage, ms = 25_000) => pl.p.waitForFunction((s) => { const el = document.querySelector('.kb'); if (!el) return false; return s === 'jawab' ? !!el.querySelector('.rev') : !!el.querySelector('.soal') && !el.querySelector('.rev') && !el.querySelector('.lead'); }, stage, { timeout: ms });
const H = await mk('Ratri', '#F6B7A8', 'kelinci', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const G1 = await mk('Sekar', '#9FD0E8', 'kucing', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const G2 = await mk('Tono', '#F4D58D', 'tunas', { viewport: { width: 1366, height: 820 } });
for (const v of [G1, G2]) await v.ctx.request.post(BASE + '/api/friends', { data: { code: H.code } });
await H.p.goto(BASE + '/'); await W(1500); await closeSheets(H);
for (const v of [G1, G2]) { await v.p.goto(`${BASE}/?r=${++nav}#friends`); await v.p.waitForSelector('.friend'); await v.p.click(`.friend:has-text("Ratri") .btn >> nth=0`); await v.p.waitForSelector('.hbar'); }
await W(3500);
await H.p.click('.hbar .btn:has-text("Main bareng")'); await W(300);
check(await H.p.locator('.pop .btn.g:has-text("Cerdas Cermat") em:has-text("BARU")').count() === 1, 'menu Main bareng di rumah: ubin Cerdas Cermat (BARU)');
await shot(H, '22-menu-main-bareng-cerdas-cermat');
await H.p.click('.pop .btn.g:has-text("Cerdas Cermat")');
for (const v of [G1, G2]) await v.p.waitForSelector('.card:has-text("mengajak main Cerdas Cermat")', { timeout: 8000 }).catch(() => {});
check(await G1.p.locator('.card:has-text("mengajak main Cerdas Cermat")').count() === 1, 'tamu mendapat ajakan Cerdas Cermat');
for (const v of [G1, G2]) await v.p.click('.card .btn:has-text("Ikut main")');
await W(1200);
await H.p.click('.card .btn:has-text("Mulai sekarang")');
await Promise.all([H, G1, G2].map((pl) => waitStage(pl, 'tanya', 15_000).catch(() => {})));
await W(300);
check(await G1.p.locator('.kb .soal').count() === 1, 'soal Cerdas Cermat tampil untuk semua pemain');
await shot(H, '23-bareng-soal-rumah-hp'); await shot(G2, '23b-bareng-soal-rumah-desktop');
// ronde 1: Sekar benar duluan (lonceng), Ratri benar kemudian, Tono salah
await answerBareng(G1, 'ok'); await W(500);
await answerBareng(H, 'ok'); await W(300);
await answerBareng(G2, 'no');
await Promise.all([H, G1, G2].map((pl) => waitStage(pl, 'jawab', 10_000).catch(() => {})));
await W(500);
await shot(G1, '24-bareng-lonceng-rumah');
await shot(G2, '24b-bareng-lonceng-desktop');
const pts = async (pl) => Object.fromEntries((await pl.p.locator('.kb .pl').all()).length ? await Promise.all((await pl.p.locator('.kb .pl').all()).map(async (el) => [await el.locator('.nm').innerText(), Number(await el.locator('.pt').innerText())])) : []);
const p1 = await pts(H);
check(p1['Sekar'] === 3 && p1['Kamu'] === 2 && p1['Tono'] === 0, `nilai menurut urutan diterima: pertama benar 3, benar 2, salah 0 (${JSON.stringify(p1)})`);
check(await G1.p.locator('.kb .pl.bell .belli').count() === 1, 'lonceng untuk yang pertama benar');
check(/Tahukah kamu\?/.test(await H.p.locator('.kb .rev').innerText()), 'jawaban & penjelasan tampil untuk semua');
// ronde 2: Tono tidak menjawab → timer server tetap memajukan ronde
await Promise.all([H, G1, G2].map((pl) => waitStage(pl, 'tanya', 15_000).catch(() => {})));
await answerBareng(H, 'ok'); await answerBareng(G1, 'no');
await waitStage(G2, 'jawab', 25_000).catch(() => {});
check(await G2.p.locator('.kb .rev').count() === 1, 'tanpa jawaban Tono, waktu habis memajukan ronde');
for (let r = 2; r < 7; r++) {
  await Promise.all([H, G1, G2].map((pl) => waitStage(pl, 'tanya', 15_000).catch(() => {})));
  await answerBareng(G1, 'ok'); await answerBareng(H, r % 2 ? 'ok' : 'no'); await answerBareng(G2, 'ok');
  await waitStage(H, 'jawab', 12_000).catch(() => {});
}
await H.p.waitForSelector('.kb .podium', { timeout: 30_000 }).catch(() => {});
await W(1200);
check(await H.p.locator('.kb .podium .pod').count() === 3, 'podium hasil 3 pemain');
check(/Juara Cerdas Cermat!/.test(await G1.p.locator('.kb h2').innerText()), 'Sekar juara Cerdas Cermat');
await shot(G1, '25-bareng-podium-rumah'); await shot(G2, '25b-bareng-podium-desktop');
for (const pl of [H, G1, G2]) { const t = pl.p.locator('.kb .btn:has-text("Tutup")'); if (await t.count()) await t.click(); }

/* ================= 5. Cerdas Cermat Bareng: 2 pemain di Panggung alun-alun + penonton ================= */
async function enterAlun(pl) {
  await pl.p.goto(BASE + '/?r=1#alun'); await pl.p.waitForSelector('.sbar, .fp', { timeout: 20000 }); await W(800);
  const n = pl.p.locator('.fp .btn:has-text("Nanti")'); if (await n.count()) await n.click();
}
for (const pl of [H, G1, G2]) await enterAlun(pl);
await W(3500);
await H.p.click('.sbar .btn:has-text("Main")'); await W(300);
check(await H.p.locator('.pop .btn.g:has-text("Cerdas Cermat"):has-text("Panggung")').count() === 1, 'menu Main alun-alun: ubin Cerdas Cermat · Panggung');
await H.p.click('.pop .btn.g:has-text("Cerdas Cermat")');
await G1.p.waitForSelector('.card:has-text("mengajak main Cerdas Cermat")', { timeout: 20000 }).catch(() => {});
check(await G1.p.locator('.card:has-text("mengajak main Cerdas Cermat")').count() === 1, 'alun-alun: ajakan Cerdas Cermat');
await G1.p.click('.card .btn:has-text("Ikut main")');
await G2.p.waitForSelector('.card:has-text("mengajak main Cerdas Cermat")', { timeout: 8000 }).catch(() => {});
const nanti = G2.p.locator('.card .btn:has-text("Nanti")'); if (await nanti.count()) await nanti.click();
await W(800);
await H.p.click('.card .btn:has-text("Mulai sekarang")');
await Promise.all([H, G1].map((pl) => waitStage(pl, 'tanya', 15_000).catch(() => {})));
// penonton: Tono menonton dari alun-alun
await G2.p.waitForSelector('.watch', { timeout: 10000 }).catch(() => {});
if (await G2.p.locator('.watch').count()) await G2.p.click('.watch');
await W(800);
check(await G2.p.locator('.kb .st:has-text("menonton")').count() === 1 || await G2.p.locator('.kb').count() === 1, 'penonton melihat soal Cerdas Cermat');
await shot(H, '26-bareng-soal-alun');
await shot(G2, '26b-bareng-penonton-desktop');
for (let r = 0; r < 7; r++) {
  await Promise.all([H, G1].map((pl) => waitStage(pl, 'tanya', 15_000).catch(() => {})));
  await answerBareng(H, 'ok'); await W(200); await answerBareng(G1, r === 0 ? 'ok' : 'no');
  await waitStage(H, 'jawab', 10_000).catch(() => {});
  if (r === 0) { await W(400); await shot(H, '27-bareng-lonceng-alun'); }
}
await H.p.waitForSelector('.kb .podium', { timeout: 30_000 }).catch(() => {});
await W(1200);
check(await H.p.locator('.kb .podium .pod').count() === 2, 'podium alun-alun 2 pemain');
check(/\+\d+ koin/.test(await H.p.locator('.kb .gainr').innerText()), 'hadiah main bareng untuk juara');
await shot(H, '28-bareng-podium-alun');

/* ================= 6. Admin: Kuis ================= */
const AD = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const ap = await AD.newPage();
ap.on('pageerror', (e) => errors.push('admin: ' + e.message));
ap.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 500) errors.push(`admin ${r.status()} ${r.url()}`); });
await ap.goto(BASE + '/admin/');
await ap.waitForSelector('input[type=email]');
await ap.fill('input[type=email]', ADMIN.email); await ap.fill('input[type=password]', ADMIN.password);
await ap.click('button[type=submit], button:has-text("Masuk")');
await ap.waitForSelector('nav[aria-label="Menu admin"]', { timeout: 10000 });
await ap.goto(BASE + '/admin/#/kuis'); await ap.waitForSelector('h1:has-text("Kuis")'); await W(1200);
check(await ap.locator('table tbody tr, .card-row').count() > 10, 'admin Kuis: daftar soal');
await ap.screenshot({ path: `${OUT}/29-admin-daftar-soal.png` });
// saring lewat tautan: tipe tebak gambar
await ap.goto(BASE + '/admin/?r=1#/kuis?type=gambar'); await ap.waitForSelector('h1:has-text("Kuis")'); await W(1500);
const nG = await ap.locator('table tbody tr').count();
check(nG >= 24 && (await ap.locator('table tbody tr:has-text("Tebak gambar")').count()) === nG, `saringan tipe: ${nG} soal tebak gambar`);
await ap.goto(BASE + '/admin/?r=2#/kuis'); await ap.waitForSelector('h1:has-text("Kuis")'); await W(1200);
// tambah soal (soal uji dari jalan sebelumnya di database yang sama dihapus dulu supaya teksnya tidak kembar)
const NEWQ = 'Hewan apa yang bernapas dengan insang?';
const before = (await (await adm.get('/api/admin/kuis/questions?origin=admin')).json()).questions;
for (const q of before.filter((x) => x.data.q === NEWQ)) await adm.delete(`/api/admin/kuis/questions/${q.id}`);
await ap.click('.btn:has-text("Tambah soal")'); await ap.waitForSelector('.drawer');
await ap.selectOption('.drawer select >> nth=0', 'sains');
await ap.fill('.drawer textarea >> nth=0', NEWQ);
for (const [i, t] of ['Ikan', 'Kucing', 'Ayam', 'Ikan'].entries()) await ap.fill(`.drawer .opt >> nth=${i} >> input:not([type=radio])`, t);
await W(300);
check(await ap.locator('.drawer .errs li:has-text("kembar")').count() === 1, 'validasi langsung: pilihan kembar');
check(await ap.locator('.drawer .errs li:has-text("explain")').count() === 1, 'validasi langsung: penjelasan wajib');
check(await ap.locator('.drawer .btn.primary:has-text("Tambah soal")').isDisabled(), 'tombol simpan terkunci selama ada galat');
await ap.screenshot({ path: `${OUT}/30-admin-tambah-validasi.png` });
await ap.fill(`.drawer .opt >> nth=3 >> input:not([type=radio])`, 'Sapi');
await ap.fill('.drawer textarea >> nth=1', 'Ikan bernapas dengan insang untuk mengambil oksigen dari air.');
await ap.fill('.drawer label:has-text("Sumber") input', 'Buku IPA SD');
await W(300);
check(await ap.locator('.drawer .okv').count() === 1, 'soal lolos validasi');
await ap.screenshot({ path: `${OUT}/31-admin-form-pratinjau.png` });
await ap.click('.drawer .btn.primary:has-text("Tambah soal")'); await W(1500);
const created = (await (await adm.get('/api/admin/kuis/questions?origin=admin')).json()).questions.filter((q) => q.data.q === NEWQ && !before.some((x) => x.id === q.id));
check(created.length === 1, `soal baru tersimpan (${created[0]?.id})`);
await ap.waitForSelector('.drawer .btn.primary:has-text("Simpan perubahan")', { timeout: 8000 });
// ubah level & nonaktifkan
await ap.selectOption('.drawer select >> nth=1', '2'); await W(200);
await ap.click('.drawer .btn.primary:has-text("Simpan perubahan")'); await W(1200);
const cid = created[0]?.id;
check((await (await adm.get(`/api/admin/kuis/questions/${cid}`)).json()).question.level === 2, 'ubah soal: level tersimpan');
await ap.click('.drawer .btn:has-text("Nonaktifkan")'); await W(1200);
check((await (await adm.get(`/api/admin/kuis/questions/${cid}`)).json()).question.active === false, 'soal dinonaktifkan');
// gambar: pratinjau di form ubah soal bank
await ap.click('.drawer [aria-label="Tutup"]'); await W(500);
const g0 = Object.entries(Q).find(([, q]) => q?.type === 'gambar')?.[0];
await ap.goto(`${BASE}/admin/#/kuis/${g0}`); await ap.waitForSelector('.drawer .pv .pic svg', { timeout: 10000 }); await W(600);
check(await ap.locator('.drawer .pv .pic svg').count() === 1, 'pratinjau soal tebak gambar menampilkan gambar');
await ap.screenshot({ path: `${OUT}/32-admin-ubah-gambar-pratinjau.png` });
await ap.click('.drawer [aria-label="Tutup"]'); await W(500);
// kotak laporan
await ap.goto(BASE + '/admin/#/kuis?tab=laporan'); await W(1500);
const nRep = await ap.locator('table tbody tr').count();
check(nRep >= 2, `kotak laporan: ${nRep} laporan terbuka`);
await ap.screenshot({ path: `${OUT}/33-admin-kotak-laporan.png` });
const open0 = (await (await adm.get('/api/admin/kuis/reports')).json()).open;
await ap.click('table tbody tr >> nth=0 >> .btn:has-text("Selesai")'); await W(1200);
check((await (await adm.get('/api/admin/kuis/reports')).json()).open === open0 - 1, 'laporan ditandai selesai');
await ap.click('table tbody tr >> nth=0 >> .btn:has-text("Buka soal")'); await ap.waitForSelector('.drawer .reps'); await W(500);
check(await ap.locator('.drawer .reps .rep').count() >= 1, 'dari laporan langsung ke soalnya (dengan daftar laporan)');
await ap.screenshot({ path: `${OUT}/34-admin-laporan-ke-soal.png` });
// HP: halaman Kuis tanpa geser samping
const AM = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, storageState: await AD.storageState() });
const amp = await AM.newPage();
await amp.goto(BASE + '/admin/#/kuis'); await amp.waitForSelector('header.mobile b:has-text("Kuis")'); await W(1500);
check(await amp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1, 'admin Kuis di HP tanpa geser samping');
await amp.screenshot({ path: `${OUT}/35-admin-kuis-hp.png` });

/* ================= selesai ================= */
const s1 = await setKuis({});
check(s1 === 200, 'pengaturan kuis bisa disimpan');
void settings0;
console.log(errors.length ? 'ERROR:\n' + errors.join('\n') : 'tanpa error halaman/server');
check(!errors.length, 'tanpa error halaman & tanpa 5xx');
await b.close();
console.log(`\n${fails.length ? `${fails.length} GAGAL` : 'SEMUA OK'}`);
if (fails.length || errors.length) process.exit(1);
