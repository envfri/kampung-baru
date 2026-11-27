// Uji Sahabat Edisi Natal (paket konten 24) di HP 390, HP 320 (animasi dikurangi) & desktop 1366:
// Toko Mutiara langsung terbuka di tab "✦ Edisi Spesial" (barang edisi terbaru) dengan spanduk Edisi Natal, pita
// "✦ Edisi Natal", hitung mundur & pratinjau bergerak; beli Beruang Es ("Yakin?"); Pondok Sahabat juga menawarkan Rusa
// Kutup; ajak jalan-jalan; sahabat besar mengikuti pet di rumah (lebih besar dari sahabat biasa, lebih kecil dari pet,
// tidak menutupi wajah pet, efek salju / lampu / jejak kilau berjalan); trik; Akrab saat pet tidur (rusa berdiri di
// samping dengan cahaya lembut, beruang jadi bantal — tidak pernah di kepala); kalung Sahabat Sejati; kunjungan teman,
// peta, alun-alun, foto Jepret; Album bagian Edisi Natal (siluet selama dijual, tersembunyi sesudahnya, yang dimiliki
// tetap); sesudah masa jual hilang dari toko & ditolak server; animasi dikurangi = gambar diam. Tanpa galat halaman / 5xx.
// Jalankan server dulu dengan admin (ADMIN_EMAIL & ADMIN_PASSWORD), lalu: BASE_URL=http://localhost:8787 npm run test:e2e:natal
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, request } = require('playwright');
const BASE = (process.env.BASE_URL ?? 'http://localhost:8787').replace(/\/$/, ''), OUT = process.env.SHOTS ?? 'test-results/e2e-natal';
const ADMIN = { email: process.env.ADMIN_EMAIL ?? 'owner@bupi.test', password: process.env.ADMIN_PASSWORD ?? 'rahasia-sekali-123' };
mkdirSync(OUT, { recursive: true });
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [], errors = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'GAGAL'} ${msg}`); if (!ok) fails.push(msg); };

const NATAL = { beruang: 'sahabat-beruang', rusa: 'sahabat-rusa' };
const UNTIL = '2027-01-06T16:59:59.000Z';
const adm = await request.newContext({ baseURL: BASE });
check((await adm.post('/api/admin/login', { data: ADMIN })).ok(), 'admin masuk');
/** ubah item lewat admin (PUT memakai seluruh isian item) */
async function adminEdit(id, patch) {
  const it = (await (await adm.get('/api/admin/items')).json()).items.find((i) => i.id === id);
  return adm.put(`/api/admin/items/${id}`, { data: { ...it, ...patch } });
}
let cat = await (await adm.get('/api/catalog')).json();
let byId = Object.fromEntries(cat.items.map((i) => [i.id, i]));
// mulai bersih (run sebelumnya bisa terhenti di tengah): masa jual bawaan
for (const id of Object.values(NATAL)) if (byId[id] && new Date(byId[id].available_to ?? 0).getTime() <= Date.now()) await adminEdit(id, { available_to: UNTIL });
cat = await (await adm.get('/api/catalog')).json();
byId = Object.fromEntries(cat.items.map((i) => [i.id, i]));
check(Object.values(NATAL).every((id) => byId[id]?.kind === 'sahabat' && byId[id].price_pearl === 25 && byId[id].shop === 'mutiara' && byId[id].data?.edisi === 2 && byId[id].data?.edisiNama === 'Edisi Natal'),
  'katalog: Beruang Es & Rusa Kutup (sahabat, 25 Mutiara, Toko Mutiara, Edisi Natal)');
check(Object.values(NATAL).every((id) => new Date(byId[id].available_to).getTime() > Date.now()), `katalog: masih dalam masa jual (sampai ${byId[NATAL.rusa]?.available_to})`);
const before = (await (await adm.get('/api/admin/settings')).json()).value;
const putSahabat = async (k) => (await adm.put('/api/admin/settings', { data: { value: { ...before, sahabat: { ...before.sahabat, ...k } } } })).status();

const b = await chromium.launch();
const INIT = () => { try { localStorage.setItem('kb-save-snooze', String(Date.now() + 9e9)); localStorage.setItem('kb-push-asked', String(Date.now() + 9e9)); localStorage.setItem('kb-news-seen', '["*"]'); localStorage.setItem('kb-ajak', JSON.stringify({ day: new Date().toLocaleDateString('en-CA'), n: 9, last: Date.now(), nanti: 0, mute: true, alunAt: 0 })); localStorage.setItem('kb-kerja-ajak', '1'); localStorage.setItem('kb-pondok-seen', '1'); } catch {} };
async function mk(name, vp, { coins = 0, pearls = 0, reduce = false } = {}) {
  const mobile = vp[0] < 900;
  const ctx = await b.newContext({ viewport: { width: vp[0], height: vp[1] }, deviceScaleFactor: 2, hasTouch: mobile, isMobile: mobile, ...(reduce ? { reducedMotion: 'reduce' } : {}) });
  await ctx.addInitScript(INIT);
  await ctx.request.post(BASE + '/api/auth/guest', { data: {} });
  const st = await (await ctx.request.post(BASE + '/api/pet', { data: { name, color: '#F6B7A8', ear: 'kucing' } })).json();
  await ctx.request.post(BASE + '/api/daily', { data: {} });
  const id = st.state.user.id;
  if (coins) check((await adm.post(`/api/admin/players/${id}/wallet`, { data: { currency: 'coin', delta: coins, reason: 'uji edisi natal' } })).ok(), `${name}: admin memberi ${coins} koin`);
  if (pearls) check((await adm.post(`/api/admin/players/${id}/wallet`, { data: { currency: 'pearl', delta: pearls, reason: 'uji edisi natal' } })).ok(), `${name}: admin memberi ${pearls} Mutiara`);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  p.on('response', (res) => { if (res.url().includes('/api/') && res.status() >= 500) errors.push(`${name}: ${res.status()} ${res.url()}`); });
  return { ctx, p, id, code: st.state.user.friend_code, name, vp };
}
const api = async (pl, url, data) => (await (data === undefined ? pl.ctx.request.get(BASE + url) : pl.ctx.request.post(BASE + url, { data: { requestId: 'e2e-' + Math.random().toString(36).slice(2), ...data } }))).json();
const state = async (pl) => (await api(pl, '/api/sahabat')).sahabat;
const buddyOf = async (pl, sp) => (await state(pl)).list.find((x) => x.sp === sp);
const closeSheets = async (p) => { for (let i = 0; i < 3; i++) { const x = p.locator('.sheet .x'); if (await x.count()) { await x.first().click().catch(() => {}); await W(300); } } };
const home = async (pl) => { await pl.p.goto(`${BASE}/?r=${Math.random().toString(36).slice(2)}`); await pl.p.waitForSelector('svg.room', { timeout: 30000 }); await W(1400); await closeSheets(pl.p); await W(300); };
const shot = (pl, name) => pl.p.screenshot({ path: `${OUT}/${name}-${pl.vp[0]}.png` });
const toastText = async (p) => (await p.locator('.toast').allInnerTexts().catch(() => [])).join(' | ');
const waitToast = async (p, re) => { let t = ''; for (let i = 0; i < 40 && !re.test(t); i++) { await W(250); t = await toastText(p); } return t; };
const rect = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, l: r.left, t: r.top, r: r.right, b: r.bottom }; }, sel);
/** animasi satu elemen: nama, jumlah yang berjalan, opacity sekarang */
const anim = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const cs = getComputedStyle(e); return { name: cs.animationName, running: e.getAnimations().filter((a) => a.playState === 'running').length, opacity: cs.opacity, display: cs.display }; }, sel);
const noOverflow = (p, scope = '.sheet') => p.evaluate((sc) => document.scrollingElement.scrollWidth <= innerWidth + 1 && [...document.querySelectorAll(`${sc} .btn, ${sc} .card, ${sc} .cell, ${sc} .bud, ${sc} .natban`)].every((e) => { const r = e.getBoundingClientRect(); return r.right <= innerWidth + 1 && r.left >= -1; }), scope);
async function walkMap(pl, loc) {
  await pl.p.goto(`${BASE}/?r=${Math.random().toString(36).slice(2, 6)}#map`);
  await pl.p.waitForSelector(`.loc[data-loc="${loc}"]`, { timeout: 30000 }); await W(900); await closeSheets(pl.p);
}
async function openMutiara(pl) {
  await walkMap(pl, 'mutiara');
  await pl.p.locator('.loc[data-loc="mutiara"]').dispatchEvent('click');
  await pl.p.waitForSelector('.shop .panel', { timeout: 30000 }); await W(900);
}
/** kartu Toko Mutiara tab Edisi: tab aktif, spanduk, pita, hitung mundur, pratinjau bergerak */
async function checkEdisiTab(pl, tag) {
  const p = pl.p;
  const on = await p.locator('.shop .tabbar button.edtab.on').count();
  check(on === 1, `${tag}: Toko Mutiara langsung terbuka di tab Edisi Spesial (barang edisi terbaru)`);
  if (!on) { await p.click('.shop .tabbar button.edtab').catch(() => {}); await W(600); }
  const ban = await p.locator('.shop .natban').innerText().catch(() => '');
  check(/Edisi Natal/.test(ban) && /Beruang Es/.test(ban) && /Rusa Kutup/.test(ban) && /6 Januari/.test(ban), `${tag}: spanduk Edisi Natal menyebut kedua sahabat & batas jual ("${ban.replace(/\n/g, ' ').slice(0, 90)}…")`);
  const cards = await p.evaluate(() => [...document.querySelectorAll('.shop .grid .card.winter')].map((c) => { const r = c.getBoundingClientRect(); return { name: c.querySelector('.name')?.textContent, ribbon: c.querySelector('.ribbon')?.textContent ?? '', cd: c.querySelector('.cd')?.textContent ?? '', sub: c.querySelector('.sub')?.textContent ?? '', live: !!c.querySelector('.ic.edfx .nt-flake, .ic.edfx .nt-light'), inside: r.left >= -1 && r.right <= innerWidth + 1 }; }));
  check(cards.length === 2 && cards.every((c) => c.ribbon === '✦ Edisi Natal' && c.live), `${tag}: 2 kartu Edisi Natal berpita "✦ Edisi Natal" dengan pratinjau bergerak (${cards.map((c) => c.name).join(', ')})`);
  check(cards.every((c) => /^⏳ Sisa \d+ (hari|jam|mnt)$/.test(c.cd.trim())), `${tag}: hitung mundur di kartu ("${cards[0]?.cd}")`);
  check(cards.every((c) => /Sahabat besar · ✦/.test(c.sub)), `${tag}: kartu menyebut efeknya ("${cards.map((c) => c.sub).join(' / ')}")`);
  check(cards.every((c) => c.inside) && await noOverflow(p, '.shop .panel'), `${tag}: kartu di dalam layar`);
  const names = await p.evaluate(() => [...document.querySelectorAll('.shop .grid .card .name')].map((n) => n.textContent));
  check(names.slice(0, 2).sort().join() === 'Beruang Es,Rusa Kutup', `${tag}: sahabat Edisi Natal (terbaru) di urutan teratas tab (${names.slice(0, 3).join(', ')}, …)`);
  return cards;
}

const A = await mk('Salju', [390, 844], { coins: 1000, pearls: 100 });
const B = await mk('Embun', [390, 844], { coins: 300 });
let restored = false;
const restore = async () => {
  if (restored) return;
  restored = true;
  check((await adm.put('/api/admin/settings', { data: { value: before } })).status() === 200, 'pengaturan admin dikembalikan');
  for (const id of Object.values(NATAL)) await adminEdit(id, { available_to: UNTIL });
};

try {
  /* ---------- 1. Toko Mutiara: tab Edisi Spesial, kartu Edisi Natal, beli Beruang Es ("Yakin?") ---------- */
  await openMutiara(A);
  await checkEdisiTab(A, '390');
  const anFl = await anim(A.p, '.shop .grid .card.winter .ic .nt-flake');
  check(anFl?.name === 'nt-flake' && anFl.running > 0, `390: salju di pratinjau kartu bergerak (${anFl?.name})`);
  await A.p.screenshot({ path: `${OUT}/01-toko-mutiara-edisi-natal-390.png` });
  await A.p.locator('.shop .natban').evaluate((e) => e.scrollIntoView({ block: 'start' })); await W(400);
  await A.p.screenshot({ path: `${OUT}/02-toko-kartu-edisi-natal-390.png` });
  const pearl0 = (await api(A, '/api/me')).wallet.pearl;
  const bcard = A.p.locator('.shop .grid .card:has(.name:text-is("Beruang Es"))');
  const bbtn = bcard.locator('.acts .btn').last();
  await bbtn.click(); await W(250);
  check(/Yakin\?/.test(await bbtn.innerText()), '390: beli Beruang Es minta konfirmasi (Yakin?)');
  await bbtn.click();
  check(/jadi sahabatmu/.test(await waitToast(A.p, /sahabatmu/)), '390: Beruang Es diadopsi di Toko Mutiara (toast)');
  await W(700);
  let me = await api(A, '/api/me');
  check(me.wallet.pearl === pearl0 - 25, `server: Mutiara terpotong 25 (${pearl0} → ${me.wallet.pearl})`);
  check(/Punya/.test(await bcard.innerText()), '390: kartu Beruang Es bertanda Punya');
  let st = await state(A);
  check(st.list.length === 1 && st.list[0].sp === 'beruang' && st.list[0].active, 'server: Beruang Es jadi sahabat pertama & langsung aktif');

  /* ---------- 2. Pondok Sahabat juga menawarkan Edisi Natal; adopsi Rusa Kutup ---------- */
  await walkMap(A, 'pondok');
  await A.p.locator('.loc[data-loc="pondok"]').dispatchEvent('click');
  await A.p.waitForSelector('.sheet[aria-label="Pondok Sahabat"]', { timeout: 20000 }).catch(() => {});
  await W(700);
  const pban = await A.p.locator('.sheet .natban').innerText().catch(() => '');
  check(/Edisi Natal/.test(pban) && /6 Januari/.test(pban), `390: Pondok Sahabat: spanduk Edisi Natal ("${pban.replace(/\n/g, ' ').slice(0, 80)}…")`);
  const rcard = A.p.locator('.sheet .card.natal:has(b:text-is("Rusa Kutup"))');
  check(await rcard.count() === 1 && (await rcard.locator('.ribbon').innerText()) === '✦ Edisi Natal' && /Sisa \d+/.test(await rcard.locator('.cd').innerText()), '390: Pondok: kartu Rusa Kutup berpita & hitung mundur');
  check(await A.p.locator('.sheet .card.natal:has(b:text-is("Beruang Es")) .badge').innerText().catch(() => '') === 'Punya', '390: Pondok: Beruang Es bertanda Punya');
  check(await noOverflow(A.p), '390: panel Pondok di dalam layar');
  await rcard.scrollIntoViewIfNeeded(); await W(300);
  await A.p.screenshot({ path: `${OUT}/03-pondok-edisi-natal-390.png` });
  const rbtn = rcard.locator('.btn').last();
  await rbtn.click(); await W(250);
  check(/Yakin\?/.test(await rbtn.innerText()), '390: Pondok: adopsi Rusa Kutup minta konfirmasi');
  await rbtn.click();
  check(/sahabatmu/.test(await waitToast(A.p, /sahabatmu/)), '390: Rusa Kutup diadopsi di Pondok Sahabat');
  await W(600);
  // ajak Rusa Kutup jalan-jalan (Beruang Es istirahat)
  const rusaRow = A.p.locator('.sheet .bud:has-text("Rusa Kutup")');
  check(/Edisi Natal/.test(await rusaRow.innerText().catch(() => '')), '390: Sahabatku: Rusa Kutup bertanda Edisi Natal');
  await rusaRow.getByRole('button', { name: 'Ajak jalan-jalan' }).click(); await W(800);
  st = await state(A);
  check(st.list.find((x) => x.sp === 'rusa')?.active && st.list.filter((x) => x.active).length === 1, 'server: Rusa Kutup aktif, satu sahabat aktif');
  check(me.wallet.pearl - (await api(A, '/api/me')).wallet.pearl === 25, 'server: Rusa Kutup 25 Mutiara');

  /* ---------- 3. di rumah: mengikuti pet, ukuran, efek, tidak menutupi wajah ---------- */
  await home(A);
  const main = 'svg.room .bud[data-b="main"]';
  check(await A.p.locator(`${main}.big.sp-rusa`).count() === 1, '390: Rusa Kutup mengikuti pet di rumah');
  check(await A.p.locator('svg.room .bud.k-rest.sp-beruang').count() === 1, '390: Beruang Es istirahat di rumah');
  const rb = await rect(A.p, `${main} .b-n`), ab = await rect(A.p, 'svg.room .bud.k-wait.sp-ayam .b-n'), pb = await rect(A.p, 'svg.room .pet .pet-bob');
  check(!!rb && !!ab && rb.h >= 1.4 * ab.h, `390: Rusa Kutup lebih besar dari sahabat biasa (tinggi ${rb?.h.toFixed(0)} vs anak ayam ${ab?.h.toFixed(0)} px)`);
  // tanduk rusa tinggi tapi tipis: dibandingkan tinggi & luas kotaknya (badan jauh lebih kecil dari pet)
  check(!!rb && !!pb && rb.h < pb.h && rb.w < pb.w && rb.w * rb.h < 0.7 * pb.w * pb.h, `390: tetap lebih kecil dari pet (tinggi ${rb?.h.toFixed(0)} vs ${pb?.h.toFixed(0)} px, luas ${rb && pb ? Math.round((100 * rb.w * rb.h) / (pb.w * pb.h)) : '?'}%)`);
  const li = await anim(A.p, `${main} .nt-light`);
  check(li?.name === 'nt-blink' && li.running > 0, `390: lampu tanduk berkelip (${li?.name})`);
  const tiles = A.p.locator('svg.room .fl');
  const budAt = () => rect(A.p, `${main} .bud-bob`);
  let moved = false, near = false, trail = false, faceOk = true;
  const b0 = await budAt();
  for (const k of [3, 30, 8, 25, 14]) {
    await tiles.nth(k).dispatchEvent('click').catch(() => {});
    await W(400);
    const mid = await budAt();
    if (mid && b0 && Math.hypot(mid.x - b0.x, mid.y - b0.y) > 4) moved = true;
    const tr = await anim(A.p, `${main}.mv .nt-trail`);
    if (tr?.name === 'nt-trail' && tr.running > 0) trail = true;
    await W(2800);
    const p1 = await rect(A.p, 'svg.room .pet .pet-bob'), b1 = await budAt();
    if (p1 && b1 && Math.hypot(p1.x - b1.x, p1.y - b1.y) < 160) near = true;
    // wajah pet (mata & mulut: ±40–70% tinggi pet dari atas) tidak tertutup sahabat yang digambar di depan pet
    const cover = await A.p.evaluate(() => {
      const pet = document.querySelector('svg.room .pet'), bud = document.querySelector('svg.room .bud[data-b="main"]');
      if (!pet || !bud) return false;
      const pr = pet.querySelector('.pet-bob').getBoundingClientRect(), br = bud.querySelector('.b-n').getBoundingClientRect();
      const face = { l: pr.left + pr.width * 0.22, r: pr.right - pr.width * 0.22, t: pr.top + pr.height * 0.35, b: pr.top + pr.height * 0.72 };
      const inFront = !!(pet.compareDocumentPosition(bud) & Node.DOCUMENT_POSITION_FOLLOWING);
      return inFront && br.left < face.r && br.right > face.l && br.top < face.b && br.bottom > face.t;
    });
    if (cover) faceOk = false;
  }
  check(moved, '390: Rusa Kutup ikut berjalan saat pet berjalan');
  check(near, '390: berhenti di dekat pet');
  check(trail, '390: jejak kilau emas saat berjalan (.nt-trail bergerak)');
  check(faceOk, '390: sahabat besar tidak pernah menutupi wajah pet');
  await shot(A, '04-rumah-mengikuti');

  /* ---------- 4. Akrab: trik & berdiri di samping pet yang tidur (bukan di kepala) ---------- */
  check(await putSahabat({ akrabAt: 5, sejatiAt: 400 }) === 200, 'sementara: Akrab cukup 5 keakraban');
  await W(200);
  const rusa = await buddyOf(A, 'rusa'), beru = await buddyOf(A, 'beruang');
  await api(A, '/api/sahabat/main', { id: rusa.id }); await api(A, '/api/sahabat/main', { id: rusa.id });
  check((await buddyOf(A, 'rusa')).lvl === 1, 'server: Rusa Kutup naik ke Akrab');
  await api(A, '/api/sahabat/oleh', {});
  await home(A);
  await tiles.nth(20).dispatchEvent('click').catch(() => {}); await W(3200);
  await A.p.locator(main).dispatchEvent('click');
  await W(120);
  check(await A.p.locator(`${main}.trk`).count() === 1, '390: ketuk → trik Lompat bintang (.trk)');
  const arc = await anim(A.p, `${main} .nt-arc`);
  check(arc?.name === 'nt-star', `390: lengkung bintang emas saat melompat (${arc?.name})`);
  await W(380);
  await shot(A, '05-trik-rusa-lompat-bintang');
  await W(1500);
  await A.p.locator('.acts .act:has-text("Tidur")').click();
  await A.p.waitForSelector('svg.room .pet.pose-tidur', { timeout: 15000 }).catch(() => {});
  await A.p.waitForSelector(`${main}.side`, { timeout: 12000 }).catch(() => {});
  check(await A.p.locator(`${main}.side`).count() === 1, '390: pet tidur → Rusa Kutup berdiri di samping (.side)');
  check(await A.p.locator('svg.room .bud.perch').count() === 0, '390: sahabat besar tidak naik ke kepala pet');
  check(await A.p.locator(`${main} .nt-halo`).count() === 5, '390: lampu tanduk menyala lembut (5 cahaya)');
  const ps = await rect(A.p, 'svg.room .pet .pet-bob'), bs = await rect(A.p, `${main} .b-n`);
  check(!!ps && !!bs && Math.abs(bs.x - ps.x) > ps.w * 0.4 && Math.abs(bs.b - ps.b) < ps.h, `390: di samping pet (geser ${bs ? Math.round(bs.x - ps.x) : '?'} px), tidak di atas kepalanya`);
  await W(600);
  await shot(A, '06-tidur-rusa-di-samping');
  await A.p.getByRole('button', { name: /bangunkan/ }).click().catch(() => {});
  await W(1800);
  check(await A.p.locator(`${main}.side`).count() === 0, '390: pet bangun → rusa kembali mengikuti');
  // Beruang Es: bantal untuk pet yang tidur
  await api(A, '/api/sahabat/aktif', { id: beru.id });
  await api(A, '/api/sahabat/main', { id: beru.id }); await api(A, '/api/sahabat/main', { id: beru.id });
  check((await buddyOf(A, 'beruang')).lvl === 1, 'server: Beruang Es naik ke Akrab');
  await home(A);
  await A.p.locator('.acts .act:has-text("Tidur")').click();
  await A.p.waitForSelector('svg.room .pet.pose-tidur', { timeout: 15000 }).catch(() => {});
  await A.p.waitForSelector(`${main}.pillow`, { timeout: 8000 }).catch(() => {});
  check(await A.p.locator(`${main}.pillow.sp-beruang`).count() === 1, '390: pet tidur → Beruang Es berbaring jadi bantal (.pillow)');
  check(await A.p.locator('svg.room .bud.perch').count() === 0, '390: beruang tidak di kepala pet');
  const behind = await A.p.evaluate(() => { const pet = document.querySelector('svg.room .pet'), bud = document.querySelector('svg.room .bud[data-b="main"]'); return !!(pet && bud && bud.compareDocumentPosition(pet) & Node.DOCUMENT_POSITION_FOLLOWING); });
  const pp = await rect(A.p, 'svg.room .pet .pet-bob'), bp = await rect(A.p, `${main} .b-n`);
  check(behind && !!pp && !!bp && Math.abs(bp.x - pp.x) < pp.w && bp.b > pp.t + pp.h * 0.5, '390: bantal di belakang punggung pet (digambar di belakang, tidak menutupi wajah)');
  await W(600);
  await shot(A, '07-tidur-beruang-bantal');
  await A.p.getByRole('button', { name: /bangunkan/ }).click().catch(() => {});
  await W(1500);
  // trik beruang: meluncur di perut mendorong bola salju; napas dingin
  await tiles.nth(9).dispatchEvent('click').catch(() => {}); await W(3000);
  await A.p.locator(main).dispatchEvent('click'); await W(350);
  const tf = await anim(A.p, `${main} .b-t`);
  check(tf?.display !== 'none' && (await anim(A.p, `${main} .bud-bob`))?.name === 'nt-slide', '390: trik Beruang Es: meluncur di perut (frame trik tampil)');
  await shot(A, '08-trik-beruang-meluncur');
  await W(1500);
  // Sahabat Sejati: kalung emas
  check(await putSahabat({ akrabAt: 5, sejatiAt: 12 }) === 200, 'sementara: Sahabat Sejati cukup 12 keakraban');
  await api(A, '/api/sahabat/main', { id: beru.id });
  check((await buddyOf(A, 'beruang')).lvl === 2, 'server: Beruang Es jadi Sahabat Sejati');
  await home(A);
  check(await A.p.locator(`${main} .b-collar`).count() === 1, '390: kalung emas Sahabat Sejati di Beruang Es');
  check(await putSahabat({ akrabAt: 5, sejatiAt: 400 }) === 200, 'Sahabat Sejati kembali 400');
  // kembali: Rusa Kutup yang ikut
  await api(A, '/api/sahabat/aktif', { id: rusa.id });

  /* ---------- 5. peta ---------- */
  await walkMap(A, 'pondok');
  check(await A.p.locator('svg.map .mapbud.sp-rusa').count() === 1, '390: Rusa Kutup ikut di peta');
  const m0 = await rect(A.p, 'svg.map .mapbud');
  await A.p.locator('.loc[data-loc="pasar"]').dispatchEvent('click').catch(() => {});
  await W(700);
  const m1 = await rect(A.p, 'svg.map .mapbud');
  check(!!m0 && !!m1 && Math.hypot(m1.x - m0.x, m1.y - m0.y) > 3, '390: Rusa Kutup berjalan di belakang pet di peta');
  const mb = await rect(A.p, 'svg.map .mapbud .b-n'), wk = await rect(A.p, 'svg.map .walker .body');
  check(!!mb && !!wk && mb.h > wk.h * 0.4 && mb.h < wk.h && mb.w * mb.h < 0.7 * wk.w * wk.h, `390: ukuran di peta: lebih kecil dari pet, tetap besar (${mb?.h.toFixed(0)} vs ${wk?.h.toFixed(0)} px)`);
  await shot(A, '09-peta-rusa');
  await A.p.waitForSelector('.shop .panel', { timeout: 25000 }).catch(() => {});

  /* ---------- 6. kunjungan teman: sahabat besar tuan rumah (aktif & istirahat) ---------- */
  await api(B, '/api/sahabat/ayam', { name: 'Piyik' });
  await B.ctx.request.post(BASE + '/api/friends', { data: { code: A.code } });
  await home(A);
  await B.p.goto(BASE + '/?r=1#friends'); await B.p.waitForSelector('.friend', { timeout: 20000 }); await W(800);
  await B.p.click(`.friend:has-text("Salju") .btn:has-text("Main bareng"), .friend:has-text("Salju") .btn:has-text("Kunjungi")`);
  await B.p.waitForSelector('.visit', { timeout: 20000 }).catch(() => {});
  await W(3500);
  const keys = await B.p.evaluate(() => [...document.querySelectorAll('svg.room .bud')].map((e) => e.getAttribute('data-b') + ':' + [...e.classList].filter((c) => c.startsWith('sp-') || c.startsWith('k-')).join('.')));
  check(keys.some((k) => /k-follow/.test(k) && /sp-rusa/.test(k)), `kunjungan: Rusa Kutup tuan rumah mengikuti petnya (${keys.join(', ')})`);
  check(keys.some((k) => /k-rest/.test(k) && /sp-beruang/.test(k)), 'kunjungan: Beruang Es tuan rumah istirahat di rumahnya');
  await shot(B, '10-kunjungan-teman');
  await B.p.getByRole('button', { name: 'Pulang' }).click().catch(() => {});

  /* ---------- 7. alun-alun: terlihat pemain lain ---------- */
  await A.p.goto(BASE + '/?r=2#alun'); await A.p.waitForSelector('.sbar, .fp', { timeout: 25000 }).catch(() => {}); await W(1500);
  await B.p.goto(BASE + '/?r=3#alun'); await B.p.waitForSelector('.sbar, .fp', { timeout: 25000 }).catch(() => {}); await W(3500);
  await closeSheets(B.p);
  await B.p.getByRole('button', { name: 'Nanti' }).click().catch(() => {});
  check(await B.p.locator(`svg.room .bud.sp-rusa[data-b="c:${A.id}"]`).count() === 1, 'alun-alun: Rusa Kutup pemain lain terlihat');
  check(await A.p.locator('svg.room .bud.sp-rusa[data-b="main"]').count() === 1, 'alun-alun: Rusa Kutup ikut pemiliknya');
  const n = await A.p.locator('svg.room .fl').count();
  if (n) await A.p.locator('svg.room .fl').nth(Math.floor(n / 2)).dispatchEvent('click').catch(() => {});
  await W(3200);
  await shot(A, '11-alun-alun');
  await shot(B, '11b-alun-alun-dilihat-teman');
  // kartu profil pemain lain: sahabat besar tampil pas di kotak ikonnya
  const opet = B.p.locator(`svg.room .opet[data-o="${A.id}"]`);
  if (await opet.count()) {
    await opet.click({ force: true }); await W(700);
    const card = await B.p.locator('.pcard .bud').innerText().catch(() => '');
    check(/Kerlip/.test(card) && /Rusa Kutup/.test(card), `kartu profil: sahabat aktif Rusa Kutup tampil ("${card.replace(/\n/g, ' ')}")`);
    const ic = await rect(B.p, '.pcard .bud .bic svg'), box = await rect(B.p, '.pcard .bud');
    check(!!ic && !!box && ic.t >= box.t - 1 && ic.b <= box.b + 1 && ic.w <= 41, 'kartu profil: ikon sahabat besar muat di kotaknya');
    await shot(B, '11c-kartu-profil');
    await B.p.locator('.pcard .x').click().catch(() => {});
  } else check(false, 'alun-alun: pet pemain lain terlihat');

  /* ---------- 8. Jepret: sahabat besar ikut terfoto ---------- */
  await home(A);
  await A.p.click('.jbtn'); await A.p.waitForSelector('.jp', { timeout: 6000 }); await W(800);
  const fr = await rect(A.p, '.jp .frame, .jp .vf, .jp .vfb');
  const bj = await rect(A.p, `${main} .bud-bob`);
  check(!!bj && (!fr || (bj.x > fr.l && bj.x < fr.r && bj.y > fr.t && bj.y < fr.b)), 'Jepret: Rusa Kutup di dalam bingkai foto');
  await A.p.click('.jp .shut');
  await A.p.waitForSelector('div[role="dialog"][aria-label="Fotomu siap!"]', { timeout: 10000 }).catch(() => {});
  await A.p.waitForFunction(() => { const i = document.querySelector('.prev img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 15000 }).catch(() => {});
  await W(500);
  const prev = A.p.locator('.prev img');
  check(await prev.count() === 1, 'Jepret: foto jadi');
  if (await prev.count()) await prev.screenshot({ path: `${OUT}/12-foto-jepret-390.png` });
  await shot(A, '12b-jepret-pratinjau');
  await A.p.keyboard.press('Escape').catch(() => {});

  /* ---------- 9. Album: bagian Edisi Natal ---------- */
  const openAlbum = async (pl) => {
    await home(pl);
    await pl.p.locator('.dock button:has-text("Tas")').click(); await W(500);
    await pl.p.locator('.sheet button.sahabat').click(); await W(500);
    await pl.p.getByRole('tab', { name: /Album/ }).click(); await W(500);
  };
  await openAlbum(A);
  check(await A.p.locator('.sheet .album.biasa .cell').count() === 9, '390: Album: 9 sahabat biasa');
  check((await A.p.locator('.sheet .alnat h3').innerText().catch(() => '')).includes('Edisi Natal'), '390: Album: bagian "Edisi Natal" sendiri');
  check(await A.p.locator('.sheet .album.natal .cell').count() === 2 && await A.p.locator('.sheet .album.natal .cell.unk').count() === 0, '390: Album: Beruang Es & Rusa Kutup milik sendiri tampil');
  check(/Album · 2\/11/.test(await A.p.getByRole('tab', { name: /Album/ }).innerText()), `390: hitungan Album (${await A.p.getByRole('tab', { name: /Album/ }).innerText()})`);
  await A.p.locator('.sheet .alnat').scrollIntoViewIfNeeded(); await W(300);
  await shot(A, '13-album-edisi-natal-punya');
  await openAlbum(B);
  const hints = await B.p.locator('.sheet .album.natal .cell.unk small.hint').allInnerTexts();
  check(hints.length === 2 && hints.every((t) => /^Edisi terbatas di Toko Mutiara sampai 6 Januari\.?$/.test(t.trim())), `390: Album teman: 2 siluet Edisi Natal ("${hints[0]}")`);
  check(await noOverflow(B.p), '390: Album di dalam layar');
  await B.p.locator('.sheet .alnat').scrollIntoViewIfNeeded(); await W(300);
  await shot(B, '14-album-edisi-natal-siluet');

  /* ---------- 10. sesudah masa jual: hilang dari toko & Album yang belum punya, server menolak, pemilik tetap ---------- */
  for (const id of Object.values(NATAL)) check((await adminEdit(id, { available_to: new Date(Date.now() - 60_000).toISOString() })).ok(), `admin: masa jual ${id} berakhir`);
  await W(400);
  await openAlbum(B);
  check(await B.p.locator('.sheet .alnat').count() === 0 && await B.p.locator('.sheet .album.biasa .cell').count() === 9, '390: sesudah masa jual: siluet Edisi Natal disembunyikan dari Album');
  check(/Album · 1\/9/.test(await B.p.getByRole('tab', { name: /Album/ }).innerText()), 'hitungan Album kembali 9');
  await openAlbum(A);
  check(await A.p.locator('.sheet .album.natal .cell').count() === 2, '390: pemilik tetap melihat sahabat Edisi Natal di Album');
  await openMutiara(B);
  check(await B.p.locator('.shop .grid .card.winter').count() === 0 && await B.p.locator('.shop .natban').count() === 0, '390: Toko Mutiara tidak menjual Edisi Natal lagi');
  const nb = await B.ctx.request.post(BASE + '/api/shop/buy', { data: { itemId: NATAL.rusa, currency: 'pearl', requestId: 'e2e-late' } });
  const nbj = await nb.json();
  check(nb.status() === 400 && nbj.error?.code === 'not_for_sale' && /Masa jual Rusa Kutup \(Edisi Natal\) sudah berakhir/.test(nbj.error?.message ?? ''), `server menolak sesudah masa jual ("${nbj.error?.message}")`);
  await walkMap(B, 'pondok');
  await B.p.locator('.loc[data-loc="pondok"]').dispatchEvent('click');
  await B.p.waitForSelector('.sheet[aria-label="Pondok Sahabat"]', { timeout: 20000 }).catch(() => {});
  await W(700);
  check(await B.p.locator('.sheet .card.natal').count() === 0 && await B.p.locator('.sheet .natban').count() === 0, '390: Pondok Sahabat tidak menawarkan Edisi Natal lagi');
  await home(A);
  check(await A.p.locator(`${main}.sp-rusa`).count() === 1 && (await anim(A.p, `${main} .nt-light`))?.name === 'nt-blink', '390: pemilik tetap ditemani Rusa Kutup dengan semua efeknya');
  for (const id of Object.values(NATAL)) await adminEdit(id, { available_to: UNTIL });

  /* ---------- 11. HP 320 dengan animasi dikurangi ---------- */
  const D = await mk('Kristal', [320, 640], { reduce: true, pearls: 30 });
  await openMutiara(D);
  await checkEdisiTab(D, '320');
  const rf = await anim(D.p, '.shop .grid .card.winter .ic .nt-flake');
  check(rf?.name === 'none', `320 animasi dikurangi: pratinjau kartu diam (${rf?.name})`);
  await D.p.screenshot({ path: `${OUT}/01-toko-mutiara-edisi-natal-320.png` });
  await D.p.locator('.shop .natban').evaluate((e) => e.scrollIntoView({ block: 'start' })); await W(300);
  await D.p.screenshot({ path: `${OUT}/02-toko-kartu-edisi-natal-320.png` });
  const dbtn = D.p.locator('.shop .grid .card:has(.name:text-is("Beruang Es")) .acts .btn').last();
  await dbtn.click(); await W(250); await dbtn.click();
  await waitToast(D.p, /sahabatmu/);
  await W(600);
  check((await state(D)).list.some((x) => x.sp === 'beruang'), '320: Beruang Es diadopsi');
  await home(D);
  const dm = 'svg.room .bud[data-b="main"]';
  const fl = await D.p.evaluate((s) => [...document.querySelectorAll(`${s} .nt-flake`)].map((e) => { const cs = getComputedStyle(e); return [cs.animationName, cs.opacity]; }), dm);
  check(fl.length === 5 && fl.every(([nm, op]) => nm === 'none' && Number(op) > 0.5), `320 animasi dikurangi: 5 butir salju diam & tetap terlihat (${JSON.stringify(fl[0])})`);
  await D.p.locator('svg.room .fl').nth(14).dispatchEvent('click'); await W(300);
  const fz = await anim(D.p, `${dm} .nt-frost`), bob = await anim(D.p, `${dm} .bud-bob`);
  check(fz?.name === 'none' && Number(fz.opacity) === 0 && bob?.name === 'none', `320 animasi dikurangi: tidak bergoyang, jejak es tersembunyi (${bob?.name}, ${fz?.name})`);
  await W(2800);
  await shot(D, '15-rumah-diam-animasi-dikurangi');
  await D.p.locator('.dock button:has-text("Tas")').click(); await W(500);
  await D.p.locator('.sheet button.sahabat').click(); await W(500);
  await D.p.getByRole('tab', { name: /Album/ }).click(); await W(400);
  check(await noOverflow(D.p) && await D.p.locator('.sheet .album.natal .cell').count() === 2, '320: Album Edisi Natal di dalam layar (1 punya, 1 siluet)');
  await D.p.locator('.sheet .alnat').scrollIntoViewIfNeeded(); await W(300);
  await shot(D, '13-album-edisi-natal');
  await D.ctx.close();

  /* ---------- 12. desktop 1366 ---------- */
  const E = await mk('Gembul', [1366, 768], { pearls: 30 });
  await openMutiara(E);
  await checkEdisiTab(E, '1366');
  await E.p.screenshot({ path: `${OUT}/01-toko-mutiara-edisi-natal-1366.png` });
  const ebtn = E.p.locator('.shop .grid .card:has(.name:text-is("Rusa Kutup")) .acts .btn').last();
  await ebtn.click(); await W(250); await ebtn.click();
  await waitToast(E.p, /sahabatmu/);
  await W(600);
  check((await state(E)).list.some((x) => x.sp === 'rusa' && x.active), '1366: Rusa Kutup diadopsi & aktif');
  await home(E);
  await E.p.locator('svg.room .fl').nth(20).dispatchEvent('click'); await W(3200);
  check(await E.p.locator('svg.room .bud.big.sp-rusa[data-b="main"]').count() === 1, '1366: Rusa Kutup mengikuti pet');
  await shot(E, '04-rumah-mengikuti');
  await E.ctx.close();
} finally {
  await restore();
}

check(!errors.length, `tanpa galat halaman / 5xx${errors.length ? `: ${errors.join(' | ')}` : ''}`);
await b.close();
console.log(fails.length ? `\n${fails.length} GAGAL` : '\nSemua lulus');
process.exit(fails.length ? 1 : 0);
