// Uji Jepret & Bagikan ke Story: tombol Jepret di rumah / rumah teman / alun-alun (HP 320 & 390, desktop 1366) tanpa
// menimpa HUD, deret ruangan, kebutuhan, event, kartu tugas, bar & dok; buka/tutup (J, Spasi, Esc); jepret → "Fotomu siap!";
// Story/Feed; Nama pet; Kode temanku (bawaan mati, link tanpa ?undang=; nyala → peringatan + link dengan kode);
// Bagikan (navigator.share/canShare & clipboard ditiru: File PNG 1080×1920 / 1080×1350, link tersalin); tugas "Bagikan 1 foto"
// maju sekali; desktop "Unduh gambar"; cadangan browser dalam aplikasi; Foto bareng + Bagikan; menu Foto bareng di HP 320
// bisa diketuk semua; kartu tugas tidak menimpa panel tamu di desktop; tidak ada galat halaman / 5xx.
// Jalankan server dulu (npm run build && npm start), lalu: BASE_URL=http://localhost:8787 node scripts/e2e-jepret.mjs
// (SHOTS = folder tangkapan layar; PNG asli yang "dibagikan" ikut disimpan di sana)
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = (process.env.BASE_URL ?? 'http://localhost:8787').replace(/\/$/, ''), OUT = process.env.SHOTS ?? 'test-results/e2e-jepret';
const ADMIN = { email: process.env.ADMIN_EMAIL ?? 'owner@bupi.test', password: process.env.ADMIN_PASSWORD ?? 'rahasia-sekali-123' };
mkdirSync(OUT, { recursive: true });
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [], errors = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'GAGAL'} ${msg}`); if (!ok) fails.push(msg); };
const b = await chromium.launch();

// zona waktu dengan jam setempat ±12 siang (langit rumah "siang" mengikuti jam pemain)
const utcH = new Date().getUTCHours(), off = ((12 - utcH + 36) % 24) - 12;
const DAY_TZ = off === 0 ? 'Etc/UTC' : off > 0 ? `Etc/GMT-${off}` : `Etc/GMT+${-off}`;

/** navigator.share / canShare / clipboard ditiru di halaman: File yang dibagikan & link yang disalin dicatat */
function stubs(cfg) {
  try { localStorage.setItem('kb-save-snooze', String(Date.now() + 9e9)); } catch {}
  const J = (window.__jp = { shared: [], clip: [], order: [] });
  const clip = { writeText: async (t) => { J.clip.push(String(t)); J.order.push('clip'); } };
  try { Object.defineProperty(Navigator.prototype, 'clipboard', { configurable: true, get: () => clip }); } catch {}
  if (cfg.share) {
    Navigator.prototype.canShare = function (d) { return !!cfg.canShare && !!d?.files?.length; };
    Navigator.prototype.share = function (d) {
      J.order.push('share');
      const f = d?.files?.[0];
      const rec = { files: d?.files?.length ?? 0, text: d?.text ?? null, url: d?.url ?? null, title: d?.title ?? null };
      return (async () => {
        if (f) {
          const u = new Uint8Array(await f.arrayBuffer());
          const be = (i) => ((u[i] << 24) | (u[i + 1] << 16) | (u[i + 2] << 8) | u[i + 3]) >>> 0;
          Object.assign(rec, { name: f.name, type: f.type, size: f.size, isFile: f instanceof File, png: u[1] === 0x50 && u[2] === 0x4e && u[3] === 0x47, w: be(16), h: be(20) });
          let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
          rec.b64 = btoa(s);
        }
        J.shared.push(rec);
      })();
    };
  }
}
async function mk(pet, color, ear, opts = {}, cfg = { share: true, canShare: true }) {
  const ctx = await b.newContext({ deviceScaleFactor: 1, timezoneId: DAY_TZ, acceptDownloads: true, ...opts });
  await ctx.addInitScript(stubs, cfg);
  await ctx.request.post(BASE + '/api/auth/guest', { data: {} });
  const st = await (await ctx.request.post(BASE + '/api/pet', { data: { name: pet, color, ear, ownerName: 'Akun ' + pet } })).json();
  await ctx.request.post(BASE + '/api/daily', { data: {} });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(pet + ': ' + e.message));
  p.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 500) errors.push(`${pet} ${r.status()} ${r.url()}`); });
  return { ctx, p, pet, id: st.state.user.id, code: st.state.user.friend_code };
}
const shot = (pl, n) => pl.p.screenshot({ path: `${OUT}/${n}.png` });
async function closeSheets(pl) { for (let i = 0; i < 3; i++) { const x = pl.p.locator('.sheet .x'); if (await x.count()) { await x.first().click(); await W(300); } } }
async function home(pl, q = '') { await pl.p.goto(`${BASE}/?r=${Math.random().toString(36).slice(2)}${q}`); await pl.p.waitForSelector('.dock', { timeout: 20000 }); await W(1200); await closeSheets(pl); await W(400); }
async function visit(pl, host) {
  await pl.p.goto(`${BASE}/?r=${Math.random()}#friends`); await pl.p.waitForSelector('.friend', { timeout: 15000 });
  await pl.p.click(`.friend:has-text("${host}") .btn >> nth=0`); await pl.p.waitForSelector('.visit', { timeout: 15000 }); await W(1500);
}
async function alun(pl, q = '') {
  await pl.p.goto(`${BASE}/?r=${Math.random()}${q}#alun`); await pl.p.waitForSelector('.sbar, .fp', { timeout: 25000 }); await W(800);
  const n = pl.p.locator('.fp .btn:has-text("Nanti")'); if (await n.count()) { await n.click(); await W(400); }
  await W(800);
}
/** kotak elemen UI yang terlihat */
const rects = (pl, sels) => pl.p.evaluate((sels) => sels.flatMap((s) => [...document.querySelectorAll(s)].filter((e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true })).map((e) => { const r = e.getBoundingClientRect(); return { s, x: r.left, y: r.top, r: r.right, b: r.bottom }; })), sels);
const hit = (a, c) => Math.min(a.r, c.r) - Math.max(a.x, c.x) > 1 && Math.min(a.b, c.b) - Math.max(a.y, c.y) > 1;
const UI = ['.hud', '.roombar', '.needs', '.event', 'button.chip[aria-label="Buka daftar tugas"]', '.acts:not(.hide)', '.hbar', '.sbar', '.visit', '.cam', '.dock', '.sleepbar', '.offline'];
async function pillCheck(pl, label, name) {
  const pill = (await rects(pl, ['.jbtn']))[0];
  check(!!pill, `${label}: tombol Jepret tampil`);
  if (!pill) { await shot(pl, name); return; }
  const vp = pl.p.viewportSize();
  check(pill.x >= 0 && pill.y >= 0 && pill.r <= vp.width && pill.b <= vp.height && pill.b - pill.y >= 43.5, `${label}: tombol di dalam layar, tinggi ≥ 44 px`);
  const over = (await rects(pl, UI)).filter((r) => hit(pill, r)).map((r) => r.s);
  check(!over.length, `${label}: tidak menimpa ${over.join(', ') || 'HUD, deret ruangan, kebutuhan, event, kartu tugas, bar & dok'}`);
  await shot(pl, name);
}
const jp = (pl) => pl.p.evaluate(() => ({ shared: window.__jp.shared.map(({ b64, ...r }) => r), clip: [...window.__jp.clip], order: [...window.__jp.order] }));
async function savePng(pl, i, name) { const s = await pl.p.evaluate((i) => window.__jp.shared[i]?.b64, i); if (s) writeFileSync(`${OUT}/${name}.png`, Buffer.from(s, 'base64')); }
async function waitShared(pl, n) { for (let i = 0; i < 40 && (await pl.p.evaluate(() => window.__jp.shared.length)) < n; i++) await W(150); }
async function previewReady(pl, w, h) {
  await pl.p.waitForFunction(([w, h]) => { const i = document.querySelector('.prev img'); return i && i.complete && i.naturalWidth === w && i.naturalHeight === h; }, [w, h], { timeout: 15000 }).catch(() => {});
  await pl.p.waitForFunction(() => { const x = document.querySelector('div[role="dialog"][aria-label="Fotomu siap!"] .btn.hot.big, .dlg .btn.hot.big'); return x && !x.disabled; }, null, { timeout: 15000 }).catch(() => {});
  return pl.p.evaluate(() => { const i = document.querySelector('.prev img'); return i ? { w: i.naturalWidth, h: i.naturalHeight, alt: i.alt } : null; });
}
const questOf = async (pl) => (await (await pl.ctx.request.get(BASE + '/api/quests')).json()).daily.find((q) => q.id === 'h-bagikan');

/* ---------- admin: semua tugas harian dibagikan selama uji (supaya "Bagikan 1 foto" pasti ada hari ini) ---------- */
const adm = await b.newContext();
check((await adm.request.post(BASE + '/api/admin/login', { data: ADMIN })).ok(), 'admin masuk');
const before = (await (await adm.request.get(BASE + '/api/admin/settings')).json()).value;
const putSettings = async (v) => (await adm.request.put(BASE + '/api/admin/settings', { data: { value: v } })).status();
check(await putSettings({ ...before, quests: { ...before.quests, dailyCount: 40 } }) === 200, 'sementara: semua tugas harian aktif');

const phone = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
const A = await mk('Lupis', '#F6B7A8', 'kelinci', phone);
const B = await mk('Wajik', '#9FD0E8', 'kucing', phone);
const C = await mk('Putu', '#F4D58D', 'tunas', phone);
const D = await mk('Klepon', '#A8D8A0', 'bulat', { viewport: { width: 1366, height: 768 } });
for (const v of [B, C, D]) await v.ctx.request.post(BASE + '/api/friends', { data: { code: A.code } });

try {
  /* ---------- 1. rumah sendiri (HP 390 & 320): tombol Jepret di bawah deret ruangan ---------- */
  await home(A);
  check(await A.p.locator('.jbtn em:has-text("BARU")').count() === 1, 'tombol Jepret berlabel BARU sebelum dipakai');
  check((await A.p.locator('.jbtn').getAttribute('aria-label')) === 'Jepret: foto pemandangan', 'aria-label tombol Jepret');
  await pillCheck(A, 'rumah HP 390', 'masuk-rumah-390');
  const room = (await rects(A, ['.roombar']))[0], pill = (await rects(A, ['.jbtn']))[0];
  check(room && pill && Math.abs(pill.y - room.b - 8) <= 1 && Math.abs(pill.x - room.x) <= 1, `8 px di bawah deret ruangan, rata kiri (${Math.round(pill?.y - room?.b)} px)`);
  await A.p.setViewportSize({ width: 320, height: 640 }); await W(700);
  await pillCheck(A, 'rumah HP 320', 'masuk-rumah-320');
  await A.p.setViewportSize({ width: 390, height: 844 }); await W(500);

  /* ---------- 2. buka / tutup, jendela bidik rumah siang ---------- */
  await A.p.click('.jbtn'); await A.p.waitForSelector('.jp', { timeout: 5000 }); await W(600);
  check(await A.p.locator('.hud, .dock, .roombar, .needs, .acts, button.chip[aria-label="Buka daftar tugas"]').count() === 0, 'mode Jepret: HUD, dok, deret ruangan, kebutuhan, tombol aksi & kartu tugas disembunyikan');
  check(await A.p.locator('.tgl').count() === 0, 'foto sendirian: sakelar Nama pet tidak tampil');
  check(await A.p.locator('.jp .hint:has-text("Geser untuk pindah")').count() === 1, 'petunjuk geser & cubit');
  const ctl = await rects(A, ['.jp .rbtn.x', '.jp .shut', '.jp .vfb .rb']);
  check(ctl.length === 4 && ctl.every((r) => r.r - r.x >= 44 && r.b - r.y >= 44), 'tombol jendela bidik ≥ 44 px');
  const fr = (await rects(A, ['.jp .vf']))[0];
  check(fr && Math.abs((fr.b - fr.y) / (fr.r - fr.x) - 1.25) < 0.01 && Math.abs(fr.r - fr.x - (390 - 32)) <= 1, 'bingkai 4:5 selebar layar − 32 px');
  check(await A.p.evaluate(() => document.querySelector('.jbtn') === null), 'tombol Jepret tidak tampil di dalam mode Jepret');
  await shot(A, 'jepret-rumah-siang-390');
  await A.p.click('.jp .rbtn.x'); await W(500);
  check(await A.p.locator('.jp').count() === 0 && await A.p.locator('.hud').count() === 1 && await A.p.locator('.dock').count() === 1, 'tutup: UI game kembali');
  check(await A.p.locator('.jbtn em').count() === 0, 'label BARU hilang setelah dipakai');
  await A.p.click('.jbtn'); await A.p.waitForSelector('.jp');
  await A.p.click('.jp button[aria-label="Lihat seluruh rumah"]'); await W(700);
  await A.p.click('.jp button[aria-label="Pusatkan ke pet-ku"]'); await W(700);

  /* ---------- 3. jepret → Fotomu siap! (Story), Bagikan, tugas ---------- */
  const q0 = await questOf(A);
  check(q0 && q0.progress === 0, 'tugas harian "Bagikan 1 foto" ada, progres 0');
  await A.p.click('.jp .shut');
  await A.p.waitForSelector('div[role="dialog"][aria-label="Fotomu siap!"]', { timeout: 8000 });
  let img = await previewReady(A, 1080, 1920);
  check(img?.w === 1080 && img?.h === 1920, `pratinjau Story 1080×1920 (${img?.w}×${img?.h})`);
  check(/Lupis di rumah · (pagi|siang|sore|malam)/.test(img?.alt ?? '') && !/Kode teman/.test(img?.alt ?? ''), `keterangan "${img?.alt}"`);
  check((await A.p.locator('[role="radio"][aria-checked="true"]').textContent()).includes('Story'), 'Story 9:16 terpilih');
  check(await A.p.locator('.chk:has-text("Nama pet")').count() === 0, 'foto sendirian: tanpa pilihan Nama pet');
  check((await A.p.locator('.chk:has-text("Kode temanku")').getAttribute('aria-checked')) === 'false', 'Kode temanku bawaan mati');
  check(await A.p.locator('.warn').count() === 0, 'tanpa peringatan saat kode mati');
  check(await A.p.locator('button:has-text("Simpan ke album")').count() === 0, 'tidak ada "Simpan ke album" untuk Jepret');
  await W(400); await shot(A, 'pratinjau-story-390');
  await shot(A, 'kode-temanku-mati-390');
  await A.p.click('div[role="dialog"][aria-label="Fotomu siap!"] .btn.hot.big'); await waitShared(A, 1);
  let s = await jp(A);
  const f1 = s.shared[0];
  check(f1?.files === 1 && f1.isFile && f1.png && f1.type === 'image/png', 'navigator.share menerima 1 File PNG');
  check(f1?.w === 1080 && f1?.h === 1920, `PNG Story 1080×1920 (${f1?.w}×${f1?.h})`);
  check(/^bupi-lupis-rumah-\d{8}\.png$/.test(f1?.name ?? ''), `nama file ${f1?.name}`);
  check(f1?.text === null && f1?.url === null && f1?.title === 'BUPI', 'share tanpa text/url (link lewat clipboard)');
  check(s.clip[0] === BASE + '/', `link tersalin tanpa ?undang= (${s.clip[0]})`);
  check(s.order[0] === 'clip' && s.order[1] === 'share', 'link disalin dulu, lalu lembar bagikan dibuka (satu ketukan)');
  check(await A.p.locator('.toast.show:has-text("Link BUPI tersalin")').count() === 1, 'toast "Link BUPI tersalin — tempel lewat stiker Link di Story"');
  await savePng(A, 0, 'png-rumah-siang-story');
  let q1 = null; for (let i = 0; i < 20; i++) { q1 = await questOf(A); if (q1?.progress === 1) break; await W(200); }
  check(q1?.progress === 1 && q1?.done, 'tugas "Bagikan 1 foto" selesai setelah Bagikan');
  await W(4300);
  check(await A.p.locator('.note:has-text("Link BUPI tersalin")').count() === 1, 'catatan link tersalin tetap di lembar');

  /* ---------- 4. Feed 4:5 ---------- */
  await A.p.click('[role="radio"]:has-text("Feed")');
  img = await previewReady(A, 1080, 1350);
  check(img?.w === 1080 && img?.h === 1350, `pratinjau Feed 1080×1350 (${img?.w}×${img?.h})`);
  await shot(A, 'pratinjau-feed-390');
  await A.p.click('div[role="dialog"][aria-label="Fotomu siap!"] .btn.hot.big'); await waitShared(A, 2);
  s = await jp(A);
  check(s.shared[1]?.w === 1080 && s.shared[1]?.h === 1350, `PNG Feed 1080×1350 (${s.shared[1]?.w}×${s.shared[1]?.h})`);
  await savePng(A, 1, 'png-rumah-siang-feed');
  await W(800);
  check((await questOf(A))?.progress === 1, 'tugas tidak bertambah lagi (sekali sehari)');

  /* ---------- 5. Kode temanku nyala ---------- */
  await A.p.click('[role="radio"]:has-text("Story")');
  await A.p.click('.chk:has-text("Kode temanku")'); await W(200);
  check(await A.p.locator('.warn:has-text("Siapa pun yang melihat bisa langsung berteman denganmu.")').count() === 1, 'Kode temanku nyala: peringatan tampil');
  check(await A.p.evaluate(() => localStorage.getItem('kb-jepret-code')) === '1', 'pilihan Kode temanku diingat di perangkat');
  img = await previewReady(A, 1080, 1920);
  await W(400);
  img = await A.p.evaluate(() => document.querySelector('.prev img')?.alt);
  check(img?.includes(`Kode teman ${A.code}`), 'kartu memuat kode teman');
  await shot(A, 'kode-temanku-nyala-390');
  await A.p.click('div[role="dialog"][aria-label="Fotomu siap!"] .btn.hot.big'); await waitShared(A, 3);
  s = await jp(A);
  check(s.clip.at(-1) === `${BASE}/?undang=${A.code}`, `link dengan kode teman (${s.clip.at(-1)})`);
  await A.p.click('.chk:has-text("Kode temanku")'); await W(300);
  check(await A.p.locator('.warn').count() === 0 && await A.p.evaluate(() => localStorage.getItem('kb-jepret-code')) === '0', 'Kode temanku dimatikan lagi');
  // Ulangi → kembali ke jendela bidik; Esc menutup
  await A.p.click('div[role="dialog"][aria-label="Fotomu siap!"] .btn.back'); await W(500);
  check(await A.p.locator('.jp').count() === 1, 'Ulangi: kembali ke jendela bidik');
  await A.p.keyboard.press('Escape'); await W(400);
  check(await A.p.locator('.jp').count() === 0, 'Esc menutup Jepret');

  /* ---------- 6. alun-alun malam: 3 pet, label nama, Nama pet ---------- */
  await alun(A, '&jam=20:30');
  // Wajik & Putu berdiri di dekat Lupis (lewat sinkron alun-alun langsung)
  const sync = async (pl, x, y) => (await (await pl.ctx.request.post(BASE + '/api/square/sync', { data: { x, y } })).json());
  let me = (await sync(B, 10, 17)).members?.find((m) => m.id === A.id);
  const keepNear = async () => { me = (await sync(B, (me?.x ?? 10) + 1.3, (me?.y ?? 17) - 0.9)).members?.find((m) => m.id === A.id) ?? me; await sync(C, (me?.x ?? 10) - 1.2, (me?.y ?? 17) + 0.8); };
  await keepNear();
  const near = setInterval(() => keepNear().catch(() => {}), 1500);
  await W(4000);
  await pillCheck(A, 'alun-alun HP 390', 'masuk-alun-390');
  const ar = (await rects(A, ['.roombar']))[0], ap = (await rects(A, ['.jbtn']))[0];
  check(ar && ap && Math.abs(ap.y - ar.b - 8) <= 1 && Math.abs(ap.x - ar.x) <= 1, `alun-alun: 8 px di bawah tombol kamera (${Math.round(ap?.y - ar?.b)} px)`);
  await A.p.setViewportSize({ width: 320, height: 640 }); await W(700);
  await pillCheck(A, 'alun-alun HP 320', 'masuk-alun-320');
  await A.p.setViewportSize({ width: 390, height: 844 }); await W(500);
  await A.p.click('.jbtn'); await A.p.waitForSelector('.jp');
  await A.p.click('.jp button[aria-label="Pusatkan ke pet-ku"]'); await W(1500);
  await A.p.waitForSelector('.jp .tgl', { timeout: 6000 }).catch(() => {});
  check((await A.p.locator('.jp .tgl').getAttribute('aria-checked').catch(() => null)) === 'true', 'ada pet lain: sakelar Nama pet tampil (nyala)');
  check(await A.p.locator('.jp .tgl[role="switch"] small:has-text("tampil di foto")').count() === 1, 'sakelar: teks "tampil di foto"');
  let tags = await A.p.$$eval('.jp svg.jl text', (t) => t.map((x) => x.textContent));
  check(tags.includes('Lupis') && tags.includes('Wajik') && tags.includes('Putu'), `label nama pet di bingkai: ${tags.join(', ')}`);
  check(!tags.some((t) => /kamu|Akun/.test(t)), 'label hanya nama pet (tanpa "(kamu)" & nama akun)');
  check(await A.p.locator('.tag, .bubble').count() === 0, 'label game & gelembung obrolan disembunyikan di mode Jepret');
  await shot(A, 'jepret-alun-malam-390');
  await A.p.click('.jp .tgl'); await W(300);
  check((await A.p.locator('.jp .tgl').getAttribute('aria-checked')) === 'false' && await A.p.locator('.jp svg.jl').count() === 0, 'Nama pet dimatikan: label hilang, "disembunyikan"');
  await shot(A, 'jepret-alun-malam-tanpa-nama-390');
  await A.p.click('.jp .tgl'); await W(300);
  await A.p.click('.jp .shut');
  await A.p.waitForSelector('div[role="dialog"][aria-label="Fotomu siap!"]', { timeout: 8000 });
  img = await previewReady(A, 1080, 1920);
  check(/Lupis di Alun-alun · malam, bareng (Putu & Wajik|Wajik & Putu)/.test(img?.alt ?? ''), `keterangan alun-alun: ${img?.alt}`);
  check((await A.p.locator('.chk:has-text("Nama pet")').getAttribute('aria-checked')) === 'true', 'pilihan Nama pet juga di lembar');
  await shot(A, 'pratinjau-alun-malam-390');
  const nShared = (await jp(A)).shared.length;
  await A.p.click('div[role="dialog"][aria-label="Fotomu siap!"] .btn.hot.big'); await waitShared(A, nShared + 1);
  await savePng(A, nShared, 'png-alun-malam-story');
  await A.p.click('.chk:has-text("Nama pet")'); await W(300);
  img = await previewReady(A, 1080, 1920); await W(300);
  check(/bareng 2 teman/.test(await A.p.evaluate(() => document.querySelector('.prev img')?.alt)), 'nama disembunyikan: "bareng 2 teman"');
  await A.p.click('.chk:has-text("Nama pet")'); await W(200);
  await A.p.click('div[role="dialog"][aria-label="Fotomu siap!"] .x'); await W(400);
  clearInterval(near);

  /* ---------- 7. rumah teman (HP 390 & 320) ---------- */
  await visit(A, 'Wajik');
  await pillCheck(A, 'rumah teman HP 390', 'masuk-kunjungan-390');
  const vc = (await rects(A, ['.visit']))[0], vp = (await rects(A, ['.jbtn']))[0];
  check(vc && vp && Math.abs(vp.y - vc.b - 8) <= 2, `8 px di bawah kartu rumah teman (${Math.round(vp?.y - vc?.b)} px)`);
  await A.p.setViewportSize({ width: 320, height: 640 }); await W(800);
  await pillCheck(A, 'rumah teman HP 320', 'masuk-kunjungan-320');
  await A.p.setViewportSize({ width: 390, height: 844 }); await W(500);

  /* ---------- 8. Foto bareng: menu bisa diketuk semua di 320 & 360, PhotoPreview + Bagikan ---------- */
  await home(B); // Wajik di rumah (live), Lupis bertamu
  await visit(A, 'Wajik'); await W(3500);
  for (const [w, h] of [[320, 640], [360, 800]]) {
    await A.p.setViewportSize({ width: w, height: h }); await W(800);
    await A.p.click('.hbar .btn:has-text("Foto")'); await W(500);
    const opts = await A.p.$$eval('.hbar .pop.col .btn', (bs) => bs.map((x) => { const r = x.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { t: x.textContent.trim(), ok: !!e && (e === x || x.contains(e)) }; }));
    check(opts.length === 3 && opts.every((o) => o.ok), `${w}×${h}: semua gaya Foto bareng bisa diketuk (${opts.map((o) => `${o.t}${o.ok ? '' : ' ✗'}`).join(', ')})`);
    const hud = (await rects(A, ['.hud']))[0], pop = (await rects(A, ['.hbar .pop']))[0];
    check(hud && pop && pop.y >= hud.b - 1, `${w}×${h}: menu tidak menutupi HUD`);
    await shot(A, `foto-bareng-menu-${w}`);
    await A.p.click('.hbar .btn:has-text("Foto")'); await W(300);
  }
  await A.p.setViewportSize({ width: 390, height: 844 }); await W(600);
  await A.p.click('.hbar .btn:has-text("Foto")'); await W(300);
  await A.p.click('.hbar .pop .btn:has-text("Senyum")');
  await A.p.waitForSelector('.ph[aria-label="Foto bareng"]', { timeout: 8000 }).catch(() => {});
  check(await A.p.locator('.ph .share .btn:has-text("Bagikan")').count() === 1 && await A.p.locator('.ph .share .btn:has-text("Simpan ke galeri"), .ph .share .btn:has-text("Menyiapkan")').count() === 1, 'Foto bareng: baris Bagikan + Simpan ke galeri');
  await W(1500);
  await shot(A, 'foto-bareng-bagikan-390');
  await A.p.click('.ph .share .btn:has-text("Bagikan")');
  await A.p.waitForSelector('div[role="dialog"][aria-label="Fotomu siap!"]', { timeout: 8000 });
  img = await previewReady(A, 1080, 1920);
  check(/Foto bareng di rumah Wajik/.test(img?.alt ?? ''), `kartu Foto bareng: ${img?.alt}`);
  check(await A.p.locator('div[role="dialog"][aria-label="Fotomu siap!"] .btn.back:has-text("Kembali")').count() === 1, 'Foto bareng: tombol Kembali');
  check(await A.p.locator('.note:has-text("sudah ada di album")').count() === 1 && await A.p.locator('button:has-text("Simpan ke album")').count() === 0, 'Foto bareng: catatan sudah di album, tanpa Simpan ke album');
  await W(500); await shot(A, 'foto-bareng-pratinjau-390');
  const nF = (await jp(A)).shared.length;
  await A.p.click('div[role="dialog"][aria-label="Fotomu siap!"] .btn.hot.big'); await waitShared(A, nF + 1);
  s = await jp(A);
  check(s.shared[nF]?.w === 1080 && s.shared[nF]?.h === 1920 && /foto-bareng/.test(s.shared[nF]?.name), `Foto bareng dibagikan sebagai PNG Story (${s.shared[nF]?.name})`);
  await savePng(A, nF, 'png-foto-bareng-story');
  await A.p.click('div[role="dialog"][aria-label="Fotomu siap!"] .btn.back'); await W(400);
  check(await A.p.locator('.ph[aria-label="Foto bareng"]').count() === 1, 'Kembali: Foto bareng masih terbuka');
  await A.p.click('.ph .row .btn:has-text("Tutup")'); await W(300);

  /* ---------- 9. desktop 1366: tamu di rumah, J / Spasi / Esc, Unduh gambar ---------- */
  await home(D);
  await visit(A, 'Klepon'); await W(4000);
  await D.p.waitForSelector('.hbar.home', { timeout: 10000 }).catch(() => {});
  const qc = (await rects(D, ['button.chip[aria-label="Buka daftar tugas"]']))[0], hb = (await rects(D, ['.hbar']))[0];
  check(qc && hb && !hit(qc, hb), `desktop 1366 + tamu: kartu tugas tidak menimpa panel tamu (${qc ? Math.round(qc.r) : '?'} ≤ ${hb ? Math.round(hb.x) : '?'})`);
  await pillCheck(D, 'rumah desktop 1366 (ada tamu)', 'masuk-rumah-1366');
  const cam = (await rects(D, ['.cam']))[0], dp = (await rects(D, ['.jbtn']))[0];
  check(cam && dp && Math.abs(cam.y - dp.b - 8) <= 4 && Math.abs(dp.x - cam.x) <= 1, 'desktop: di atas panel kamera, rata kiri');
  check(await D.p.locator('.jbtn kbd:has-text("J")').count() === 1, 'desktop: petunjuk tombol J');
  await D.p.keyboard.press('j'); await D.p.waitForSelector('.jp', { timeout: 5000 }).catch(() => {});
  check(await D.p.locator('.jp').count() === 1 && await D.p.locator('.jp .vtitle:has-text("Jepret")').count() === 1, 'J membuka Jepret (desktop)');
  check(await D.p.locator('.jp button[aria-label="Perkecil"]').count() === 1 && await D.p.locator('.jp button[aria-label="Perbesar"]').count() === 1, 'desktop: tombol − / +');
  check(await D.p.locator('.jp .hint:has-text("Spasi untuk jepret")').count() === 1, 'desktop: petunjuk Spasi & Esc');
  const df = (await rects(D, ['.jp .vf']))[0];
  check(df && Math.abs(df.b - df.y - 540) <= 1, 'desktop: bingkai setinggi 540 px');
  await D.p.click('.jp button[aria-label="Perbesar"]'); await W(400);
  await D.p.keyboard.press('Escape'); await W(400);
  check(await D.p.locator('.jp').count() === 0, 'Esc menutup');
  await D.p.keyboard.press('j'); await W(400); await D.p.keyboard.press('j'); await W(400);
  check(await D.p.locator('.jp').count() === 0, 'J membuka lalu J menutup');
  await D.p.keyboard.press('1'); await W(400);
  check(await D.p.locator('.cam .seg button[aria-pressed="true"]').textContent().catch(() => '') === 'Dekat', 'pintasan kamera lama (1 = Dekat) tetap jalan');
  await D.p.keyboard.press('2'); await W(300);
  await D.p.keyboard.press('j'); await D.p.waitForSelector('.jp');
  await W(500); await shot(D, 'jepret-rumah-desktop');
  await D.p.keyboard.press(' ');
  await D.p.waitForSelector('.dlg[aria-label="Fotomu siap!"]', { timeout: 8000 }).catch(() => {});
  img = await previewReady(D, 1080, 1920);
  check(img?.w === 1080 && await D.p.locator('.dlg').count() === 1, 'Spasi menjepret; desktop: jendela pratinjau');
  check(await D.p.locator('.dlg .btn.hot.big:has-text("Unduh gambar")').count() === 1 && await D.p.locator('.dlg .lbl:has-text("LINK UNDANGAN")').count() === 1 && await D.p.locator('.dlg .steps:has-text("Instagram Story")').count() === 1, 'desktop: Unduh gambar + link + langkah');
  check((await D.p.locator('.dlg .lk input').inputValue()) === BASE.replace(/^https?:\/\//, '') + '/', 'desktop: link tanpa kode teman (bawaan)');
  await W(400); await shot(D, 'pratinjau-desktop');
  const dl = D.p.waitForEvent('download', { timeout: 8000 }).catch(() => null);
  await D.p.click('.dlg .btn.hot.big');
  const d = await dl;
  check(!!d && /^bupi-klepon-rumah-\d{8}\.png$/.test(d.suggestedFilename()), `Unduh gambar memicu unduhan (${d?.suggestedFilename()})`);
  if (d) await d.saveAs(`${OUT}/png-unduh-desktop.png`).catch(() => {});
  await D.p.click('.dlg .lk .btn'); await W(200);
  check((await jp(D)).clip.at(-1) === BASE + '/', 'desktop: Salin link');
  let qd = null; for (let i = 0; i < 15; i++) { qd = await questOf(D); if (qd?.progress === 1) break; await W(200); }
  check(qd?.progress === 1, 'desktop: unduhan dihitung untuk tugas');
  await D.p.keyboard.press('Escape'); await W(400);
  check(await D.p.locator('.dlg').count() === 0 && await D.p.locator('.jp').count() === 0, 'Esc menutup pratinjau');
  // desktop: rumah teman & alun-alun
  await visit(D, 'Lupis');
  await pillCheck(D, 'rumah teman desktop 1366', 'masuk-kunjungan-1366');
  await alun(D);
  await pillCheck(D, 'alun-alun desktop 1366', 'masuk-alun-1366');
  const dpa = (await rects(D, ['.jbtn']))[0];
  check(dpa && Math.abs(768 - dpa.b - 14) <= 2 && Math.abs(dpa.x - 14) <= 1, 'desktop alun-alun: pojok kiri bawah');

  /* ---------- 10. browser dalam aplikasi (tidak bisa berbagi file) ---------- */
  const E = await mk('Klepon2', '#E7A1C9', 'tunas', { ...phone, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36 Instagram 350.0.0.0' }, { share: true, canShare: false });
  await home(E);
  await E.p.click('.jbtn'); await E.p.waitForSelector('.jp'); await W(400);
  await E.p.click('.jp .shut'); await E.p.waitForSelector('div[role="dialog"][aria-label="Fotomu siap!"]');
  await previewReady(E, 1080, 1920);
  await E.p.click('div[role="dialog"][aria-label="Fotomu siap!"] .btn.hot.big');
  await E.p.waitForSelector('div[role="dialog"][aria-label="Simpan dulu, ya"]', { timeout: 5000 }).catch(() => {});
  check(await E.p.locator('div[role="dialog"][aria-label="Simpan dulu, ya"] img.save').count() === 1, 'cadangan: gambar besar (tekan lama untuk menyimpan)');
  check(await E.p.locator('.lead:has-text("Tekan lama gambar untuk menyimpan, lalu buka Instagram.")').count() === 1, 'cadangan: petunjuk tekan lama');
  check(await E.p.locator('.tip:has-text("Buka di browser")').count() === 1, 'cadangan: tip Buka di browser');
  check((await jp(E)).shared.length === 0, 'cadangan: share() tidak dipanggil');
  await W(300); await shot(E, 'cadangan-dalam-aplikasi-390');
  await E.p.click('div[role="dialog"][aria-label="Simpan dulu, ya"] .btn.hot.big'); await W(300);
  check((await jp(E)).clip.at(-1) === BASE + '/', 'cadangan: Salin link');
  let qe = null; for (let i = 0; i < 15; i++) { qe = await questOf(E); if (qe?.progress === 1) break; await W(200); }
  check(qe?.progress === 1, 'cadangan: Salin link dihitung untuk tugas');
  await E.p.click('div[role="dialog"][aria-label="Simpan dulu, ya"] .btn.back'); await W(300);
  check(await E.p.locator('div[role="dialog"][aria-label="Fotomu siap!"]').count() === 1, 'cadangan: Kembali ke Fotomu siap!');

  /* ---------- 11. Tugas › "Bagikan 1 foto" › Ke sana membuka Jepret; tautan /#jepret ---------- */
  await home(C);
  await C.p.goto(`${BASE}/?r=${Math.random()}#quests`); await C.p.waitForSelector('.sheet', { timeout: 10000 }); await W(500);
  await C.p.click('.sheet button:has-text("Harian")'); await W(400);
  const qi = C.p.locator('.sheet li:has-text("Bagikan 1 foto")');
  check(await qi.count() === 1 && (await qi.textContent()).includes('Jepret atau Foto bareng, lalu Bagikan atau simpan ke galeri.') && (await qi.textContent()).includes('+2 XP'), 'tugas harian "Bagikan 1 foto" di daftar Tugas (10 koin, +2 XP)');
  await qi.scrollIntoViewIfNeeded().catch(() => {}); await shot(C, 'tugas-bagikan-390');
  await qi.locator('.btn:has-text("Ke sana")').click();
  await C.p.waitForSelector('.jp', { timeout: 5000 }).catch(() => {});
  check(await C.p.locator('.jp').count() === 1 && await C.p.locator('.sheet').count() === 0, 'Ke sana: lembar Tugas tertutup, Jepret terbuka');
  await C.p.click('.jp .rbtn.x'); await W(300);
  await C.p.goto(`${BASE}/?r=${Math.random()}#jepret`); await C.p.waitForSelector('.jp', { timeout: 10000 }).catch(() => {});
  check(await C.p.locator('.jp').count() === 1, 'tautan /#jepret membuka Jepret');
  await C.p.click('.jp .rbtn.x'); await W(300);

  /* ---------- 12. fitur dimatikan admin: tombol Jepret & Bagikan Foto bareng hilang ---------- */
  const cur = (await (await adm.request.get(BASE + '/api/admin/settings')).json()).value;
  check(await putSettings({ ...cur, features: { ...cur.features, jepret: false } }) === 200, 'admin mematikan Jepret');
  await W(800); // simpan pengaturan admin langsung mengosongkan cache server
  await home(C);
  check(await C.p.locator('.jbtn').count() === 0, 'fitur mati: tombol Jepret tidak tampil');
  await C.p.keyboard.press('j'); await W(300);
  check(await C.p.locator('.jp').count() === 0, 'fitur mati: J tidak membuka Jepret');
  check((await C.ctx.request.post(BASE + '/api/share', { data: { kind: 'jepret', via: 'share', fmt: 'story' } })).status() === 403, 'fitur mati: /api/share ditolak');
  check(await putSettings({ ...cur, features: { ...cur.features, jepret: true } }) === 200, 'admin menyalakan lagi');
} finally {
  await putSettings(before).catch(() => {});
}

check(!errors.length, `tanpa galat halaman / 5xx${errors.length ? ': ' + [...new Set(errors)].join(' | ') : ''}`);
await b.close();
console.log(fails.length ? `\n${fails.length} GAGAL` : '\nSemua lulus');
process.exit(fails.length ? 1 : 0);
