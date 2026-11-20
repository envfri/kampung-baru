// Uji Kerja Sambilan: pemain berjalan ke Papan Lowongan lewat peta, memilih pekerjaan, pet berjalan ke tempat kerja &
// tampil di sana (berseragam, hitung mundur), catatan di pintu rumah (pet tidak ada), aksi yang butuh pet ditolak
// dengan pilihan "Panggil pulang", panggil pulang, berangkat lagi sampai selesai, kartu "Terima gaji" (pet memegang
// amplop), naik pangkat & seragam, teman yang berkunjung melihat catatan di pintu dan tidak bisa main dengan pet tuan
// rumah (perabot tetap bisa dipakai), daftar Teman "Sedang kerja di …", ajakan sekali dari pet. Layar 390, 320, 1366.
// Admin memperpendek lama kerja jadi 1–3 menit lewat API admin (dikembalikan di akhir).
// Jalankan server dulu dengan admin (ADMIN_EMAIL & ADMIN_PASSWORD), lalu: BASE_URL=http://localhost:8787 npm run test:e2e:kerja
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, request } = require('playwright');
const BASE = (process.env.BASE_URL ?? 'http://localhost:8787').replace(/\/$/, '');
const OUT = (process.env.SHOTS ?? 'test-results/e2e-kerja').replace(/\/$/, '');
const ADMIN = { email: process.env.ADMIN_EMAIL ?? 'owner@bupi.test', password: process.env.ADMIN_PASSWORD ?? 'rahasia-sekali-123' };
mkdirSync(OUT, { recursive: true });
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [], errors = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'GAGAL'} ${msg}`); if (!ok) fails.push(msg); };

const adm = await request.newContext({ baseURL: BASE });
check((await adm.post('/api/admin/login', { data: ADMIN })).ok(), 'admin masuk');
const original = (await (await adm.get('/api/admin/settings')).json()).value;
async function setKerja(patch) {
  const cur = (await (await adm.get('/api/admin/settings')).json()).value;
  const r = await adm.put('/api/admin/settings', { data: { value: { ...cur, kerja: { ...cur.kerja, ...patch } } } });
  if (!r.ok()) throw new Error('pengaturan kerja: ' + (await r.text()));
  await W(16_000); // pengaturan & katalog di-cache ±15 detik di server
}
const b = await chromium.launch();

/** pemain baru (tamu) dengan pet; dsf 2 untuk gambar yang ditunjukkan ke pemilik */
async function mk(pet, color, ear, vp, { dsf = 1, ajak = false } = {}) {
  const mobile = vp[0] < 900;
  const ctx = await b.newContext({ viewport: { width: vp[0], height: vp[1] }, hasTouch: mobile, isMobile: mobile, deviceScaleFactor: dsf });
  await ctx.addInitScript((ajak) => {
    try {
      localStorage.setItem('kb-save-snooze', String(Date.now() + 9e9)); localStorage.setItem('kb-push-asked', String(Date.now() + 9e9)); localStorage.setItem('kb-news-seen', '["*"]');
      localStorage.setItem('kb-ajak', JSON.stringify({ day: new Date().toLocaleDateString('en-CA'), n: 9, last: Date.now(), nanti: 0, mute: true, alunAt: 0 }));
      if (!ajak) localStorage.setItem('kb-kerja-ajak', '1');
    } catch {}
  }, ajak);
  await ctx.request.post(BASE + '/api/auth/guest', { data: {} });
  const st = await (await ctx.request.post(BASE + '/api/pet', { data: { name: pet, color, ear } })).json();
  await ctx.request.post(BASE + '/api/daily', { data: {} });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(pet + ': ' + e.message));
  p.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 500) errors.push(`${pet} ${r.status()} ${r.url()}`); });
  return { ctx, p, pet, id: st.state.user.id, code: st.state.user.friend_code, room: st.state.rooms[0] };
}
const api = async (pl, path, data) => { const r = await pl.ctx.request.post(BASE + path, { data }); const j = await r.json().catch(() => ({})); if (!r.ok()) throw new Error(`${path}: ${JSON.stringify(j)}`); return j; };
const me = async (pl) => (await pl.ctx.request.get(BASE + '/api/me')).json();
async function closeSheets(pl) { for (let i = 0; i < 3; i++) { const x = pl.p.locator('.sheet .x'); if (await x.count()) { await x.first().click().catch(() => {}); await W(300); } } }
async function waitToast(pl, re, ms = 9000) { for (let t = 0; t < ms; t += 100) { const s = await pl.p.locator('.toast.show').textContent().catch(() => ''); if (re.test(s ?? '')) return s; await W(100); } return (await pl.p.locator('.toast').textContent().catch(() => '')) ?? ''; }
/** kotak elemen saling bertumpuk? (selector a vs daftar selector lain), dan a di dalam layar */
const clear = (pl, a, others) => pl.p.evaluate(([a, others]) => {
  const r = document.querySelector(a)?.getBoundingClientRect();
  if (!r || !r.width) return { ok: false, why: 'tidak ada ' + a };
  const hits = [];
  for (const sel of others) for (const e of document.querySelectorAll(sel)) {
    const q = e.getBoundingClientRect();
    if (q.width && q.height && r.left < q.right - 1 && q.left < r.right - 1 && r.top < q.bottom - 1 && q.top < r.bottom - 1) hits.push(sel);
  }
  const inside = r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
  return { ok: !hits.length && inside, hits, inside };
}, [a, others]);
async function shot(pl, file, wait = 500) { await W(wait); await pl.p.screenshot({ path: `${OUT}/${file}.png` }); }
async function toMap(pl) {
  await pl.p.locator('.dock button:has-text("Kampung")').click();
  await pl.p.waitForSelector('svg.map'); await W(500);
}
/** ketuk tempat di peta (peta digeser dulu bila tempatnya di luar layar, seperti pemain menggeser jari) */
async function tapLoc(pl, id) {
  await pl.p.evaluate((id) => document.querySelector(`[data-loc="${id}"]`)?.scrollIntoView({ inline: 'center', block: 'center' }), id);
  await W(250);
  await pl.p.locator(`[data-loc="${id}"]`).click();
}
const HUD = ['.hud', '.dock'];

// --------------------------------------------------------------------------------------------------------------
// 0. papan lowongan dengan angka bawaan (1 / 3 / 8 jam) untuk gambar; lalu admin memperpendek jadi menit
// --------------------------------------------------------------------------------------------------------------
await setKerja({ ...original.kerja, minutes: [60, 180, 480], ronda: { ...original.kerja.ronda, minutes: 480 } });
for (const vp of [[390, 844], [1366, 768]]) {
  const A = await mk('Mochi', '#F6B7A8', 'kucing', vp, { dsf: 2 });
  await A.p.goto(BASE + '/'); await A.p.waitForSelector('.dock'); await W(900); await closeSheets(A);
  await toMap(A);
  check(await A.p.locator('[data-loc="lowongan"]').count() === 1 && await A.p.locator('[data-loc="ronda"]').count() === 1, `${vp[0]}: Papan Lowongan & Pos Ronda ada di peta`);
  check(await A.p.locator('g.baru').count() === 1, `${vp[0]}: lencana BARU di Papan Lowongan`);
  if (vp[0] === 1366) await shot(A, 'peta-1366', 300);
  await tapLoc(A, 'lowongan');
  await A.p.waitForSelector('.sheet:has-text("Papan Lowongan") .job', { timeout: 12000 });
  await W(700);
  const jobs = await A.p.locator('.sheet .job').count();
  check(jobs === 6, `${vp[0]}: 6 tempat kerja di papan (${jobs})`);
  const warung = await A.p.locator('#job-warung').textContent();
  check(/Jaga warung/.test(warung) && /Pasar Pagi/.test(warung) && /1 jam/.test(warung) && /20/.test(warung) && /8 jam/.test(warung) && /110/.test(warung), `${vp[0]}: kartu warung: tempat, 1/3/8 jam, gaji 20/50/110`);
  const ronda = await A.p.locator('#job-ronda').textContent();
  check(/19\.00–23\.00/.test(ronda) && /Lv 6/.test(ronda) && /150/.test(ronda), `${vp[0]}: kartu ronda: jendela 19.00–23.00, Lv 6, gaji 150`);
  check(await A.p.locator('#job-kolam .go').isDisabled() && /Terbuka di Lv 2/.test(await A.p.locator('#job-kolam .go').textContent()), `${vp[0]}: kolam terkunci sampai Lv 2`);
  const sh = await clear(A, '.sheet', []);
  check(sh.inside, `${vp[0]}: lembar papan lowongan di dalam layar`);
  await shot(A, `papan-${vp[0]}`, 200);
  if (vp[0] === 390) {
    await A.p.locator('#job-ronda').scrollIntoViewIfNeeded(); await shot(A, 'papan-ronda-390', 300);
  }
  await closeSheets(A);
  check(await A.p.locator('g.baru').count() === 0, `${vp[0]}: lencana BARU hilang setelah papan dibuka`);
  await A.ctx.close();
}

// lama kerja diperpendek (menit) untuk uji; ronda 2 menit; pangkat cepat; bonus warung pasti
await setKerja({
  minutes: [1, 2, 3], ronda: { ...original.kerja.ronda, minutes: 2 }, rankAt: { karyawan: 1, senior: 3, kepala: 5 },
  jobs: { ...original.kerja.jobs, warung: { ...original.kerja.jobs.warung, bonusPct: 100, bonusItems: ['pisang-goreng'] } },
});
console.log('— admin: lama kerja 1/2/3 menit');

for (const vp of [[390, 844], [320, 568], [1366, 768]]) {
  const tag = vp[0], dsf = tag === 320 ? 2 : 2;
  console.log(`\n— layar ${vp[0]}×${vp[1]}`);
  const A = await mk('Mochi', '#F6B7A8', 'kucing', vp, { dsf });
  const F = await mk('Kopi', '#9FD0E8', 'anjing', [390, 844], { dsf: 2 });
  await api(F, '/api/friends', { code: A.code });
  await api(A, '/api/shop/buy', { itemId: 'pisang-goreng', qty: 2 });
  await A.p.goto(BASE + '/'); await A.p.waitForSelector('.dock'); await W(900); await closeSheets(A);

  // 1. jalan ke Papan Lowongan lewat peta, pilih warung 2 menit, Berangkat
  await toMap(A);
  await tapLoc(A, 'lowongan');
  await A.p.waitForSelector('#job-warung .opt', { timeout: 12000 }); await W(400);
  await A.p.locator('#job-warung .opt:has-text("2 mnt")').click();
  await A.p.locator('#job-warung .go').click();
  await A.p.waitForSelector('.sheet', { state: 'detached', timeout: 8000 }).catch(() => {});
  const t1 = await waitToast(A, /berangkat jaga warung/);
  check(/Mochi berangkat jaga warung\. Pulang pukul \d\d\.\d\d/.test(t1), `${tag}: berangkat: "${t1}"`);
  // pet berjalan ke Pasar Pagi dan bekerja di sana (berseragam, hitung mundur)
  await A.p.waitForSelector('.walker.atwork', { timeout: 15000 }).catch(() => {});
  check(await A.p.locator('.walker.atwork').count() === 1, `${tag}: pet tampil bekerja di tempat kerja`);
  const pill = (await A.p.locator('.walker .workpill').textContent().catch(() => '')) ?? '';
  check(/\d+ (dtk|mnt)/.test(pill), `${tag}: hitung mundur di atas pet (${pill.trim()})`);
  const near = await A.p.evaluate(() => {
    const w = document.querySelector('.walker')?.getBoundingClientRect(), l = document.querySelector('[data-loc="pasar"]')?.getBoundingClientRect();
    return !!w && !!l && w.left < l.right + 40 && w.right > l.left - 40 && w.bottom > l.top && w.top < l.bottom + 40;
  });
  check(near, `${tag}: pet berdiri di Pasar Pagi`);
  check(/Mochi sedang jaga warung di Pasar Pagi/.test(await A.p.locator('.hint').textContent()), `${tag}: petunjuk peta: pet sedang kerja`);
  await A.p.evaluate(() => document.querySelector('[data-loc="pasar"]')?.scrollIntoView({ inline: 'center', block: 'center' })); await W(300);
  if (tag !== 320) await shot(A, `peta-kerja-${tag}`, 300);
  // tempat yang butuh pet ditolak dari peta (kolam)
  await tapLoc(A, 'kolam');
  await A.p.waitForSelector('.box[role="alertdialog"]', { timeout: 4000 }).catch(() => {});
  const dlg0 = (await A.p.locator('.box[role="alertdialog"]').textContent().catch(() => '')) ?? '';
  check(/Mochi lagi kerja/.test(dlg0) && /Mancing bisa lagi setelah Mochi pulang/.test(dlg0) && /Panggil pulang/.test(dlg0), `${tag}: Kolam Pancing ditolak dengan pesan ramah + Panggil pulang`);
  await A.p.locator('.box .btn:has-text("Nanti saja")').click(); await W(300);
  check(await A.p.locator('svg.map').count() === 1, `${tag}: tetap di peta`);

  // 2. pulang ke rumah: catatan di pintu, pet tidak ada
  await tapLoc(A, 'rumah');
  await A.p.waitForSelector('.kcard.note', { timeout: 8000 });
  await W(600);
  const note = await A.p.locator('.kcard.note').textContent();
  check(/Mochi sedang jaga warung/.test(note) && /di Pasar Pagi · pulang \d\d\.\d\d/.test(note) && /Panggil pulang/.test(note), `${tag}: catatan pintu "${note.replace(/\s+/g, ' ').slice(0, 80)}…"`);
  check(await A.p.locator('svg.room .pet').count() === 0, `${tag}: pet tidak ada di rumah`);
  check(await A.p.locator('.acts .act').count() === 0, `${tag}: tombol rawat pet disembunyikan`);
  const c1 = await clear(A, '.kcard.note', [...HUD, '.roombar', '.needs']);
  check(c1.ok, `${tag}: catatan pintu tidak menutupi HUD/dock/kartu ${JSON.stringify(c1)}`);
  await shot(A, `rumah-pintu-${tag}`, 300);
  // aksi yang butuh pet: Tas › Beri makan → ditolak dengan pesan ramah
  await A.p.locator('.dock button:has-text("Tas")').click();
  await A.p.waitForSelector('.sheet .tabbar'); await W(300);
  const beri = A.p.locator('.sheet .btn:has-text("Beri")').first();
  if (await beri.count()) {
    await beri.click();
    await A.p.waitForSelector('.box[role="alertdialog"]', { timeout: 5000 }).catch(() => {});
    const dlg = (await A.p.locator('.box[role="alertdialog"]').textContent().catch(() => '')) ?? '';
    check(/Mochi lagi kerja/.test(dlg) && /Makan bisa lagi setelah Mochi pulang/.test(dlg), `${tag}: Tas › Beri ditolak: "${dlg.replace(/\s+/g, ' ').slice(0, 110)}"`);
    if (tag === 390) await shot(A, 'ditolak-390', 200);
    await A.p.locator('.box .btn:has-text("Nanti saja")').click(); await W(200);
  } else check(false, `${tag}: tombol Beri di Tas`);
  await closeSheets(A);

  // 3. teman berkunjung: catatan di pintu, pet tuan rumah tidak ada, aksi dengan pet dimatikan, perabot tetap bisa
  if (tag === 390) {
    await F.p.goto(BASE + '/?r=t#friends'); await F.p.waitForSelector('.friend', { timeout: 20000 }); await W(500);
    const fr = await F.p.locator(`.friend:has-text("${A.pet}")`).textContent();
    check(/Sedang kerja di Warung/.test(fr), `daftar Teman: "Sedang kerja di Warung"`);
    await F.p.locator(`.friend:has-text("${A.pet}") .btn`).first().click();
    await F.p.waitForSelector('.visit .doornote', { timeout: 10000 });
    await W(1200);
    const dn = await F.p.locator('.visit .doornote').textContent();
    check(/Mochi sedang jaga warung/.test(dn) && /pulang \d\d\.\d\d/.test(dn), `tamu: catatan di pintu "${dn.trim()}"`);
    check(await F.p.locator('svg.room .pet').count() === 0 && await F.p.locator(`svg.room .opet[data-o="${A.id}"]`).count() === 0, 'tamu: pet tuan rumah tidak ada di rumah');
    const acts = F.p.locator('.hbar .acts .act');
    check(await acts.count() === 5 && (await acts.evaluateAll((bs) => bs.every((x) => x.disabled))), 'tamu: Sapa/Peluk/Camilan/Kejar/Duduk dimatikan');
    check(/Mochi sedang jaga warung di Pasar Pagi/.test(await F.p.locator('.hbar .status').textContent()), 'tamu: status bar kunjungan menjelaskan');
    const rej = await F.ctx.request.post(BASE + `/api/visit/${A.id}/act`, { data: { kind: 'sapa' } });
    check(rej.status() === 400 && (await rej.json()).error.code === 'host_working', 'tamu: server menolak sapa (host_working)');
    const use = await F.ctx.request.post(BASE + `/api/visit/${A.id}/activity`, { data: { activityId: 'lihat-jendela', roomId: A.room.id, spot: 'jendela', etaMs: 0 } });
    check(use.ok(), `tamu: perabot (jendela) tuan rumah tetap bisa dipakai (${use.status()})`);
    await shot(F, 'tamu-pintu-390', 300);
    await F.p.locator('.visit .btn:has-text("Pulang")').click(); await W(300);
  }

  // 4. panggil pulang (gaji sebanding lama kerja)
  const coin0 = (await me(A)).wallet.coin;
  await A.p.locator('.kcard.note .btn:has-text("Panggil pulang")').click();
  await A.p.waitForSelector('.box[role="alertdialog"]');
  check(/gajinya dihitung sesuai lama kerja/.test(await A.p.locator('.box').textContent()), `${tag}: konfirmasi panggil pulang menjelaskan gaji sebanding`);
  await A.p.locator('.box .btn:has-text("Panggil pulang")').click();
  const t2 = await waitToast(A, /pulang dari Pasar Pagi/);
  check(/Mochi pulang dari Pasar Pagi\. Gaji \d+ koin untuk \d+ mnt kerja/.test(t2), `${tag}: dipanggil pulang: "${t2}"`);
  await A.p.waitForSelector('svg.room .pet', { timeout: 6000 }).catch(() => {});
  check(await A.p.locator('svg.room .pet').count() === 1 && await A.p.locator('.kcard').count() === 0, `${tag}: pet kembali di rumah, catatan hilang`);
  const st2 = await me(A);
  check(st2.kerja.shift === null && st2.wallet.coin >= coin0, `${tag}: shift selesai, koin tidak berkurang (${coin0} → ${st2.wallet.coin})`);

  // 5. berangkat lagi (1 menit) dari papan dan tunggu sampai pulang → amplop & Terima gaji
  await toMap(A);
  await tapLoc(A, 'lowongan');
  await A.p.waitForSelector('#job-warung .opt', { timeout: 12000 }); await W(300);
  await A.p.locator('#job-warung .opt:has-text("1 mnt")').click();
  await A.p.locator('#job-warung .go').click();
  await A.p.waitForSelector('.walker.atwork', { timeout: 15000 }).catch(() => {});
  await tapLoc(A, 'rumah');
  await A.p.waitForSelector('.kcard.note', { timeout: 8000 });
  console.log('     (menunggu shift 1 menit selesai…)');
  await A.p.waitForSelector('.kcard.gaji', { timeout: 100_000 });
  await W(1200);
  const gaji = await A.p.locator('.kcard.gaji').textContent();
  check(/Mochi pulang kerja!/.test(gaji) && /\+20/.test(gaji) && /\+4 XP/.test(gaji) && /Pisang Goreng/.test(gaji), `${tag}: kartu gaji: koin, XP, bonus (${gaji.replace(/\s+/g, ' ').slice(0, 90)}…)`);
  check(/“Mochi .*”|“.*Mochi.*”/.test(gaji), `${tag}: cerita lucu dengan nama pet`);
  check(/Naik pangkat: Karyawan!/.test(gaji) && /Dapat seragam: Celemek Warung/.test(gaji), `${tag}: kemajuan pangkat & seragam baru di kartu`);
  check(await A.p.locator('svg.room .pet .amplop').count() === 1, `${tag}: pet memegang amplop`);
  const c2 = await clear(A, '.kcard.gaji', [...HUD, '.roombar', '.needs']);
  check(c2.ok, `${tag}: kartu gaji tidak menutupi HUD/dock ${JSON.stringify(c2)}`);
  await shot(A, `terima-gaji-${tag}`, 300);
  const coin1 = (await me(A)).wallet.coin;
  await A.p.locator('.kcard.gaji .btn:has-text("Terima gaji")').click();
  await A.p.waitForSelector('.kcard.gaji:has-text("Gaji diterima!")', { timeout: 6000 });
  const st3 = await me(A);
  check(st3.wallet.coin === coin1 + 20 && (st3.inventory['celemek-warung'] ?? 0) === 1 && (st3.inventory['pisang-goreng'] ?? 0) >= 3, `${tag}: gaji 20 koin, bonus & seragam masuk Tas`);
  if (tag === 390) await shot(A, 'gaji-diterima-390', 300);
  await A.p.locator('.kcard.gaji .btn:has-text("Pakai sekarang")').click();
  await W(800);
  check((await me(A)).pet.wear.body === 'celemek-warung', `${tag}: seragam dipakai`);
  check(await A.p.locator('svg.room .pet .amplop').count() === 0 && await A.p.locator('.acts .act').count() >= 4, `${tag}: amplop hilang, tombol rawat kembali`);
  // kemajuan pangkat di papan
  await toMap(A);
  await tapLoc(A, 'lowongan');
  await A.p.waitForSelector('#job-warung .rank', { timeout: 12000 }); await W(300);
  check(/Karyawan/.test(await A.p.locator('#job-warung .rank').textContent()) && /1\/3 shift menuju Senior/.test(await A.p.locator('#job-warung .prog').textContent()), `${tag}: papan: Karyawan, 1/3 shift menuju Senior`);
  check(/22/.test(await A.p.locator('#job-warung .opts').textContent()), `${tag}: gaji Karyawan +10% (22 koin)`);
  await closeSheets(A);
  await A.ctx.close(); await F.ctx.close();
}

// 6. ajakan sekali dari pet ("Aku mau cari kerja sambilan, yuk!") → tombol ke Papan Lowongan
{
  const C = await mk('Lupis', '#A8D8A0', 'tunas', [390, 844], { ajak: true });
  await C.p.goto(BASE + '/'); await C.p.waitForSelector('.dock'); await W(600); await closeSheets(C);
  await C.p.waitForSelector('.ajak.ready', { timeout: 70_000 }).catch(() => {});
  const aj = (await C.p.locator('.ajak').textContent().catch(() => '')) ?? '';
  check(/Aku mau cari kerja sambilan, yuk!/.test(aj) && /Lihat lowongan/.test(aj), `ajakan pet: "${aj.trim().slice(0, 60)}"`);
  if (aj) {
    await shot(C, 'ajakan-390', 200);
    await C.p.locator('.ajak .go').click();
    await C.p.waitForSelector('.sheet:has-text("Papan Lowongan")', { timeout: 15000 }).catch(() => {});
    check(await C.p.locator('.sheet:has-text("Papan Lowongan")').count() === 1, 'ajakan: pet berjalan ke Papan Lowongan, papan terbuka');
  }
  await C.ctx.close();
  // ajakan hanya sekali per perangkat: dibuka ulang tidak muncul lagi (dicek lewat penanda)
}

// kembalikan pengaturan semula
const back = await adm.put('/api/admin/settings', { data: { value: { ...(await (await adm.get('/api/admin/settings')).json()).value, kerja: original.kerja } } });
check(back.ok(), 'pengaturan kerja dikembalikan');
await b.close();
check(!errors.length, `tanpa galat halaman / 5xx ${errors.slice(0, 5).join(' | ')}`);
console.log(`\n${fails.length ? `${fails.length} GAGAL` : 'SEMUA OK'} · gambar di ${OUT}`);
process.exit(fails.length ? 1 : 0);
