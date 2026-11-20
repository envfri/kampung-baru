// Uji tamu di rumah: kartu tamu (HouseBar) tidak menutupi nampan makanan, bar mandi, atau bar tidur (HP 390 & 320,
// desktop 1366). HP: nampan terbuka → kartu tamu disembunyikan sementara, pet tidur → kartu tamu di atas bar tidur;
// desktop: nampan & bar tidur di kiri panel tamu. Berkunjung di HP pendek (320×568 … 375×667): ruangan tetap terlihat
// di antara kartu rumah teman & bar kunjungan.
// Jalankan server dulu (npm run build && npm start), lalu: BASE_URL=http://localhost:8787 node scripts/e2e-tamu.mjs
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = (process.env.BASE_URL ?? 'http://localhost:8787').replace(/\/$/, ''), W = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = (process.env.SHOTS ?? 'test-results/e2e-tamu') + '/';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); let fail = 0;
const ok = (c, m) => { console.log(c ? 'ok  ' : 'GAGAL', m); if (!c) fail++; };
async function mk(name, vp) {
  const mobile = vp[0] < 900;
  const ctx = await b.newContext({ viewport: { width: vp[0], height: vp[1] }, hasTouch: mobile, isMobile: mobile, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { try { localStorage.setItem('kb-save-snooze', String(Date.now() + 9e9)); localStorage.setItem('kb-push-asked', String(Date.now() + 9e9)); localStorage.setItem('kb-ajak', JSON.stringify({ day: new Date().toLocaleDateString('en-CA'), n: 9, last: Date.now(), nanti: 0, mute: true, alunAt: 0 })); } catch {} });
  await ctx.request.post(BASE + '/api/auth/guest', { data: {} });
  const st = await (await ctx.request.post(BASE + '/api/pet', { data: { name, color: '#F6B7A8', ear: 'kucing' } })).json();
  await ctx.request.post(BASE + '/api/daily', { data: {} });
  return { ctx, p: await ctx.newPage(), code: st.state.user.friend_code, id: st.state.user.id };
}
const closeSheets = async (p) => { for (let i = 0; i < 3; i++) { const x = p.locator('.sheet .x'); if (await x.count()) { await x.first().click().catch(() => {}); await W(300); } } };
const overlap = (p, a, c) => p.evaluate(([a, c]) => {
  const A = document.querySelector(a)?.getBoundingClientRect(), C = document.querySelector(c)?.getBoundingClientRect();
  if (!A || !C || !A.width || !C.width) return { a: !!A?.width, c: !!C?.width, hit: false };
  const hit = A.left < C.right - 1 && C.left < A.right - 1 && A.top < C.bottom - 1 && C.top < A.bottom - 1;
  return { a: true, c: true, hit, px: hit ? Math.round(Math.min(A.bottom, C.bottom) - Math.max(A.top, C.top)) : 0 };
}, [a, c]);
for (const vp of [[390, 844], [320, 640], [1366, 768]]) {
  const tag = vp[0];
  const host = await mk('Muci', vp), guest = await mk('Almirah', [390, 844]);
  await guest.ctx.request.post(BASE + '/api/friends', { data: { code: host.code } });
  await host.p.goto(BASE + '/'); await host.p.waitForSelector('.dock'); await W(1200); await closeSheets(host.p);
  // tamu berkunjung lewat daftar Teman
  await guest.p.goto(BASE + '/?r=t#friends'); await guest.p.waitForSelector('.friend', { timeout: 20000 }); await W(500);
  await guest.p.locator('.friend .btn:has-text("Main bareng"), .friend .btn:has-text("Kunjungi")').first().click();
  for (let i = 0; i < 40; i++) { await W(500); if (await host.p.locator('.hbar.home').count()) break; }
  ok(await host.p.locator('.hbar.home').count() > 0, `${tag}: kartu tamu tampil di rumah tuan rumah`);
  await host.p.click('.btn.act:has-text("Makan")'); await W(600);
  const m = await overlap(host.p, '.tray', '.hbar.home');
  ok(m.a && !m.hit, `${tag}: nampan makanan tidak tertutup kartu tamu ${JSON.stringify(m)}`);
  await host.p.screenshot({ path: `${OUT}makan-${tag}.png` });
  await host.p.click('.tray .btn:has-text("Tutup")'); await W(400);
  ok(await host.p.locator('.hbar.home').count() > 0, `${tag}: nampan ditutup → kartu tamu tampil lagi`);
  // mandi
  await host.p.click('.btn.act:has-text("Mandi")'); await W(600);
  const mb = await overlap(host.p, '.bathbar', '.hbar.home');
  ok(!mb.hit, `${tag}: bar mandi tidak bertumpuk dengan kartu tamu ${JSON.stringify(mb)}`);
  await host.p.click('.bathbar .btn:has-text("Batal")').catch(() => {}); await W(400);
  // tidur (lampu mati)
  await host.p.click('.btn.act:has-text("Tidur")'); await W(1500);
  const sb = await overlap(host.p, '.sleepbar', '.hbar.home');
  ok(!sb.hit, `${tag}: bar tidur tidak bertumpuk dengan kartu tamu ${JSON.stringify(sb)}`);
  await host.p.screenshot({ path: `${OUT}tidur-${tag}.png` });
  await host.ctx.close(); await guest.ctx.close();
}
// berkunjung di HP pendek: kartu rumah teman diringkas & bar kunjungan dirapatkan, ruangan (perabot & pet) tetap terlihat di antaranya
{
  const host = await mk('Muci', [390, 844]);
  await host.p.goto(BASE + '/'); await host.p.waitForSelector('.dock'); await W(1000); await closeSheets(host.p);
  for (const vp of [[320, 568], [320, 640], [360, 640], [375, 667], [390, 844]]) {
    const tag = vp.join('x');
    const guest = await mk('Almirah', vp);
    await guest.ctx.request.post(BASE + '/api/friends', { data: { code: host.code } });
    await guest.p.goto(BASE + '/?r=t#friends'); await guest.p.waitForSelector('.friend', { timeout: 20000 }); await W(500);
    await guest.p.locator('.friend .btn:has-text("Main bareng"), .friend .btn:has-text("Kunjungi")').first().click();
    await guest.p.waitForSelector('.visit', { timeout: 15000 }); await W(3500);
    const m = await guest.p.evaluate(() => {
      const r = (s) => document.querySelector(s)?.getBoundingClientRect();
      const card = r('.visit'), bar = r('.hbar:not(.home)'), hud = r('.hud');
      const mid = (e) => { const x = e.getBoundingClientRect(); return x.width ? x.top + x.height / 2 : null; };
      const inGap = (els) => els.map(mid).filter((y) => y !== null).every((y) => y > card.bottom && y < bar.top);
      const row = document.querySelector('.visit .row');
      return {
        gap: Math.round(bar.top - card.bottom), hudOk: card.top >= hud.bottom - 1,
        furn: inGap([...document.querySelectorAll('svg.room .furn')]), pets: inGap([...document.querySelectorAll('svg.room .opet, svg.room .pet')]),
        rowFits: row.scrollWidth <= row.clientWidth + 1, barFits: [...document.querySelectorAll('.hbar .social, .hbar .acts')].every((e) => e.scrollWidth <= e.clientWidth + 1),
        btns: [...document.querySelectorAll('.visit .row .btn, .hbar .btn')].every((e) => { const x = e.getBoundingClientRect(); return x.left >= 0 && x.right <= innerWidth && x.height >= 34; }),
      };
    });
    ok(m.gap >= 150, `kunjungan ${tag}: ruangan terlihat di antara kartu & bar (${m.gap} px)`);
    ok(m.furn && m.pets, `kunjungan ${tag}: semua perabot & pet di ruang yang terlihat ${JSON.stringify({ furn: m.furn, pets: m.pets })}`);
    ok(m.hudOk && m.rowFits && m.barFits && m.btns, `kunjungan ${tag}: kartu di bawah HUD, tombol muat & cukup besar ${JSON.stringify(m)}`);
    await guest.p.screenshot({ path: `${OUT}kunjungan-${tag}.png` });
    await guest.ctx.close();
  }
  await host.ctx.close();
}
await b.close();
console.log(fail ? `\n${fail} GAGAL` : '\nSemua lulus');
process.exit(fail ? 1 : 0);
