// Jepret & Bagikan ke Story: kartu Story/Feed (keterangan, label nama, zona aman, kode teman hanya bila dinyalakan),
// catatan bagikan POST /api/share (login, validasi, batas harian, batas laju), tugas harian "Bagikan 1 foto",
// pengaturan admin, dan fitur yang dimatikan.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config';
import {
  JEPRET_SAFE, JEPRET_SIZES, LABEL_FS, QUEST_EVENTS, QUEST_LINKS, cardLayout, fotoCaption, fotoPhoto, jepretCaption, jepretCard, jepretFileName, jepretLink, jepretPhoto,
  joinNames, labelSize, labelSVG, photoInner, placeLabels, renderPhoto, skyGeom, skySVG, SKY_COLORS, textW, DEFAULT_SETTINGS,
} from '@kb/shared';

config.paymentProvider = 'mock';
config.adminEmail = 'owner@test.local';
config.adminPassword = 'rahasia-sekali-123';
const { buildApp } = await import('../src/app');
const { seedPackV15 } = await import('../src/db/seed-jepret');
const core = await import('../src/lib/core');
let app: any;
let db: any;
before(async () => {
  ({ app, db } = await buildApp({ memoryDb: true, logger: false, rateLimit: false, worker: false }));
});
after(async () => { await app?.close(); });

/* ---------------- keterangan ---------------- */

test('keterangan Jepret: rumah, rumah teman, alun-alun, nama tampil / disembunyikan, "bareng N teman"', () => {
  assert.deepEqual(jepretCaption({ pet: 'Lupis', place: 'home', time: 'siang', others: [], names: true }), ['Lupis di rumah · siang']);
  assert.deepEqual(jepretCaption({ pet: 'Lupis', place: 'alun', time: 'malam', others: ['Putu', 'Wajik'], names: true }), ['Lupis di Alun-alun · malam', 'bareng Putu & Wajik']);
  assert.deepEqual(jepretCaption({ pet: 'Lupis', place: 'alun', time: 'malam', others: ['Putu', 'Wajik'], names: false }), ['Lupis di Alun-alun · malam', 'bareng 2 teman']);
  assert.deepEqual(jepretCaption({ pet: 'Lupis', place: 'visit', host: 'Wajik', time: 'sore', others: ['Wajik'], names: true }), ['Lupis di rumah Wajik · sore', 'bareng Wajik']);
  // nama disembunyikan: nama pet tuan rumah juga tidak muncul
  assert.deepEqual(jepretCaption({ pet: 'Lupis', place: 'visit', host: 'Wajik', time: 'pagi', others: ['Wajik'], names: false }), ['Lupis di rumah teman · pagi', 'bareng 1 teman']);
  assert.deepEqual(jepretCaption({ pet: 'Lupis', place: 'visit', host: null, time: 'siang', others: [], names: true }), ['Lupis di rumah teman · siang']);
  assert.equal(joinNames(['A']), 'A');
  assert.equal(joinNames(['A', 'B', 'C']), 'A, B & C');
  assert.equal(joinNames(['A', 'B', 'C', 'D', 'E', 'F']), 'A, B, C & 3 lainnya');
});

test('keterangan Foto bareng: nama pet di baris 1, "Foto bareng di rumah X · waktu" di baris 2', () => {
  assert.deepEqual(fotoCaption({ pets: ['Wajik', 'Lupis', 'Putu'], me: 'Lupis', host: 'Wajik', time: 'siang', names: true }), ['Wajik, Lupis & Putu', 'Foto bareng di rumah Wajik · siang']);
  assert.deepEqual(fotoCaption({ pets: ['Wajik', 'Lupis', 'Putu'], me: 'Lupis', host: 'Wajik', time: 'siang', names: false }), ['Lupis & 2 teman', 'Foto bareng di rumah teman · siang']);
  assert.deepEqual(fotoCaption({ pets: ['Lupis', 'Putu'], me: 'Lupis', host: 'Lupis', time: 'malam', names: false }), ['Lupis & 1 teman', 'Foto bareng di rumah Lupis · malam']);
  assert.deepEqual(fotoCaption({ pets: ['Lupis', 'Putu'], me: 'Lupis', host: 'alun', time: 'malam', names: true }), ['Lupis & Putu', 'Foto bareng di Alun-alun · malam']);
});

test('nama file, link stiker (kode teman hanya bila dinyalakan)', () => {
  assert.equal(jepretFileName('Lupis', 'alun', new Date(2026, 10, 14)), 'bupi-lupis-alun-20261114.png');
  assert.equal(jepretFileName('Si Kucing!', 'visit', new Date(2026, 0, 2)), 'bupi-si-kucing-rumah-teman-20260102.png');
  assert.equal(jepretFileName('Ö', 'foto', new Date(2026, 0, 2)), 'bupi-o-foto-bareng-20260102.png');
  assert.equal(jepretLink('https://bupi.id'), 'https://bupi.id/');
  assert.equal(jepretLink('https://bupi.id/', null), 'https://bupi.id/');
  assert.equal(jepretLink('https://bupi.id', 'KB-ABC234'), 'https://bupi.id/?undang=KB-ABC234');
});

/* ---------------- label nama ---------------- */

test('label nama: pet sendiri dulu, yang bertumpuk turun maks. 2 baris, sisanya disembunyikan; tetap di dalam bingkai', () => {
  const { w, h } = labelSize('Lupis');
  assert.ok(w > textW('Lupis', LABEL_FS) && h > LABEL_FS, 'ukuran label mengikuti tulisan + padding');
  const pile = ['A', 'B', 'C', 'D'].map((n, i) => ({ id: n, name: `Pet${n}`, x: 100 + i, y: 200 }));
  const out = placeLabels(pile);
  assert.equal(out.length, 3, 'empat label di titik yang sama: tiga baris, satu disembunyikan');
  const ys = out.map((l) => l.y).sort((a, b) => a - b);
  assert.ok(ys[1] - ys[0] >= h && ys[2] - ys[1] >= h, 'baris tidak saling menumpuk');
  for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
    const a = out[i], b = out[j];
    const ix = Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2), iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    assert.ok(ix <= 0 || iy <= 0, 'label tidak bertumpuk');
  }
  const self = placeLabels([{ id: 'o', name: 'Lain', x: 100, y: 200 }, { id: 's', name: 'Aku', x: 100, y: 205, self: true }]);
  assert.equal(self[0].id, 's', 'pet sendiri ditempatkan lebih dulu');
  assert.equal(self[0].y, 205);
  // label di tepi bingkai digeser masuk
  const edge = placeLabels([{ id: 'e', name: 'Klepon', x: 2, y: 495 }], { bounds: { x: 0, y: 0, w: 400, h: 500 } })[0];
  assert.ok(edge.x - edge.w / 2 >= 0 && edge.y + edge.h <= 500, 'label di dalam bingkai');
  const svg = labelSVG(edge);
  assert.match(svg, />Klepon</);
  assert.doesNotMatch(placeLabels([{ id: 'x', name: '<b>&', x: 50, y: 50 }]).map((l) => labelSVG(l)).join(''), /<b>/, 'nama di-escape');
});

/* ---------------- kartu & zona aman ---------------- */

test('ukuran & zona aman: Story 1080×1920 (foto 760×950), Feed 1080×1350 (660×825), Foto bareng 820×603', () => {
  assert.deepEqual(JEPRET_SIZES.story, { W: 1080, H: 1920 });
  assert.deepEqual(JEPRET_SIZES.feed, { W: 1080, H: 1350 });
  assert.equal(JEPRET_SAFE.top, 250); assert.equal(JEPRET_SAFE.bottom, 340);
  assert.equal(JEPRET_SAFE.textBottom, JEPRET_SIZES.story.H - JEPRET_SAFE.bottom);
  const s1 = cardLayout('story', 1.25, false), s2 = cardLayout('story', 1.25, true);
  assert.deepEqual([s1.pw, s1.ph], [760, 950]);
  assert.equal(s2.top, 258); assert.ok(s2.top + s2.CH <= 1388, 'polaroid berakhir sebelum 1388');
  assert.equal(s2.panelY, 1412); assert.equal(s2.panelY + s2.panelH, 1572);
  const f = cardLayout('feed', 1.25, true);
  assert.deepEqual([f.pw, f.ph], [660, 825]);
  assert.equal(f.top, 40); assert.ok(f.top + f.CH <= 1035); assert.equal(f.panelY, 1092); assert.equal(f.panelY + f.panelH, 1242);
  // grid profil memotong 34 px kiri & kanan (4:5 → 3:4): polaroid & panel tidak menyentuh pinggir
  assert.ok(f.px >= 34 + 100 && f.panelX >= 34 + 100);
  const fb = cardLayout('story', 100 / 136, true);
  assert.deepEqual([fb.pw, fb.ph], [820, 603]);
  for (const L of [s1, s2, fb]) {
    assert.ok(L.top >= JEPRET_SAFE.textTop && L.panelY + L.panelH <= JEPRET_SAFE.textBottom, 'semua isi Story di 250–1580');
    assert.ok(L.top + L.CH < L.panelY, 'polaroid tidak menimpa panel');
  }
});

const photo = jepretPhoto({ frame: { x: 16, y: 80, w: 358, h: 448 }, vw: 390, vh: 844, sky: skySVG({ vw: 390, vh: 844, colors: SKY_COLORS.siang, hillsOn: true, ...skyGeom(390, 844, 'siang') }), scene: { markup: '<rect class="x" width="10" height="10"/>', viewBox: '-200 -100 400 866' } });

test('kartu: kode teman hanya bila dinyalakan, tanpa foreignObject, domain & keterangan ikut, tulisan muat', () => {
  const on = jepretCard({ kind: 'story', photo, caption: ['Lupis di Alun-alun · malam', 'bareng Putu & Wajik'], code: 'KB-Y5QB6A', night: true, domain: 'bupi.id' });
  assert.match(on, /Kode teman: KB-Y5QB6A/);
  assert.match(on, /Main bareng di BUPI/);
  assert.match(on, />bupi\.id</);
  assert.match(on, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="1080" height="1920"/);
  const off = jepretCard({ kind: 'feed', photo, caption: ['Lupis di rumah · siang'], code: null, domain: 'bupi.id' });
  assert.doesNotMatch(off, /Kode teman|KB-/);
  assert.match(off, /Main bareng di BUPI/);
  assert.match(off, /height="1350"/);
  for (const svg of [on, off]) {
    assert.doesNotMatch(svg, /foreignObject/i);
    assert.doesNotMatch(svg, /<image|href="http/i, 'tidak ada gambar luar');
  }
  assert.match(jepretCard({ kind: 'story', photo, caption: ['x'], domain: 'bupi.id', fontCss: '@font-face{font-family:"Baloo 2"}' }), /<style>@font-face/);
  // nama panjang: huruf diperkecil / dipendekkan supaya tetap di dalam kotak keterangan
  const long = jepretCard({ kind: 'story', photo, caption: ['Abcdefghijklmnop di rumah Qrstuvwxyzabcdef · siang', 'bareng Abcdefghijklmnop, Qrstuvwxyzabcdef, Wwwwwwwwwwwwwwww & 2 lainnya'], domain: 'staging.playbupi.example.com' });
  const cap = /<rect data-box="1" x="([\d.]+)" y="[\d.]+" width="([\d.]+)"[^>]*\/><text x="([\d.]+)"[^>]*font-size="([\d.]+)"[^>]*>([^<]+)<\/text><text[^>]*font-size="([\d.]+)"[^>]*>([^<]+)</.exec(long)!;
  const boxW = Number(cap[2]), un = (s: string) => s.replace(/&amp;/g, '&');
  assert.ok(textW(un(cap[5]), Number(cap[4])) <= boxW, 'baris 1 muat');
  assert.ok(!cap[5].includes('…'), 'nama 16 huruf di rumah 16 huruf: cukup diperkecil, tidak dipotong');
  assert.ok(textW(un(cap[7]), Number(cap[6])) * 0.97 <= boxW, 'baris 2 muat');
  const dom = /font-size="([\d.]+)" fill="#1E7A4C" data-domain="1">([^<]+)</.exec(long)!;
  assert.ok(textW(dom[2], Number(dom[1])) <= 840 - 384 - 24, 'domain muat di panel');
});

test('foto: langit + adegan (viewBox ruangan) + label; Putar sudut mencermin adegan; Foto bareng 136×100', () => {
  assert.equal(photo.viewBox, '16 80 358 448');
  assert.match(photo.content, /viewBox="-200 -100 400 866"/);
  assert.match(photo.content, /id="jpSky"/);
  const m = jepretPhoto({ frame: { x: 0, y: 0, w: 100, h: 125 }, vw: 1366, vh: 768, sky: '', scene: { markup: '', viewBox: '-300 -50 600 337', mirror: true } });
  assert.match(m.content, /matrix\(-1 0 0 1 0 0\)/, 'dicermin di tengah viewBox (-300 + 300 = 0)');
  const m2 = jepretPhoto({ frame: { x: 0, y: 0, w: 100, h: 125 }, vw: 100, vh: 100, sky: '', scene: { markup: '', viewBox: '10 0 100 100', mirror: true } });
  assert.match(m2.content, /matrix\(-1 0 0 1 120 0\)/);
  const night = skySVG({ vw: 390, vh: 844, night: true, colors: SKY_COLORS.alunMalam, ...skyGeom(390, 844, 'malam') });
  assert.match(night, /jpStars/); assert.doesNotMatch(night, /jpHill/, 'alun-alun malam tanpa bukit');
  assert.match(skySVG({ vw: 390, vh: 844, plain: true, colors: SKY_COLORS.siang }), /#D3E9DF/);
  const members = [{ look: { name: 'A', color: '#F6B7A8', ear: 'tunas' } as any, wear: [] }, { look: { name: 'B', color: '#9FD0E8', ear: 'kucing' } as any, wear: [] }];
  const inner = photoInner(members, 'senyum', null, null, 'dalam');
  assert.ok(renderPhoto(members, 'senyum', null, null, 'dalam').includes(inner), 'album memakai isi foto yang sama');
  assert.equal(fotoPhoto(inner).viewBox, '0 0 136 100');
});

/* ---------------- server ---------------- */

function client(a = () => app) {
  let cookie = '';
  const call = async (method: string, url: string, body?: unknown) => {
    const res = await a().inject({ method, url, payload: body as any, headers: cookie ? { cookie } : {} });
    const set = res.headers['set-cookie'];
    if (set) {
      const jar = new Map(cookie ? cookie.split('; ').map((c: string) => c.split('=') as [string, string]) : []);
      for (const c of Array.isArray(set) ? set : [set]) { const [kv] = c.split(';'); const [k, v] = kv.split('='); if (v) jar.set(k, v); else jar.delete(k); }
      cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    }
    return { status: res.statusCode, body: res.body ? (() => { try { return JSON.parse(res.body); } catch { return res.body; } })() : null };
  };
  return { get: (u: string) => call('GET', u), post: (u: string, b?: unknown) => call('POST', u, b ?? {}), put: (u: string, b?: unknown) => call('PUT', u, b ?? {}) };
}
async function player(name: string, a = () => app) {
  const c = client(a);
  await c.post('/api/auth/guest');
  const p = await c.post('/api/pet', { name, color: '#F6B7A8', ear: 'tunas' });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  return { c, id: p.body.state.user.id as string };
}
async function setGame(patch: Record<string, unknown>) {
  const row = await db.one(`select value from settings where key = 'game'`);
  const v = { ...(row?.value ?? {}), ...patch };
  await db.query(`insert into settings (key, value) values ('game', $1::text::jsonb) on conflict (key) do update set value = excluded.value`, [JSON.stringify(v)]);
  core.invalidateCaches();
}
const shares = async (uid: string) => (await db.one(`select count(*)::int c from analytics_events where user_id = $1 and name = 'share'`, [uid])).c;

test('tugas harian "Bagikan 1 foto" ada di kumpulan harian (10 koin, +2 XP, Ke sana = Jepret); peristiwa share terdaftar', async () => {
  const q = await db.one(`select * from quests where id = 'h-bagikan'`);
  assert.ok(q && q.active);
  assert.equal(q.kind, 'daily'); assert.equal(q.title, 'Bagikan 1 foto'); assert.equal(q.event, 'share');
  assert.equal(q.target, 1); assert.equal(q.reward_coin, 10); assert.equal(q.reward_xp, 2); assert.equal(q.url, '/#jepret');
  assert.equal(await seedPackV15(db), false, 'paket hanya sekali');
  assert.ok(QUEST_EVENTS.share && /jepret \| foto/.test(QUEST_EVENTS.share.filters));
  assert.ok(QUEST_LINKS.some(([u]) => u === '/#jepret'));
  assert.equal(DEFAULT_SETTINGS.features.jepret, true);
  assert.equal(DEFAULT_SETTINGS.jepret.shareEventsPerDay, 5);
});

test('POST /api/share: perlu masuk, data divalidasi, peristiwa dicatat & tugas Bagikan 1 foto maju sekali', async () => {
  // semua tugas harian aktif dibagikan hari ini, supaya "Bagikan 1 foto" pasti termasuk
  await setGame({ quests: { dailyCount: 40 } });
  const anon = client();
  assert.equal((await anon.post('/api/share', { kind: 'jepret', via: 'share', fmt: 'story' })).status, 401);
  const p = await player('Bagi1');
  for (const bad of [{}, { kind: 'jepret', via: 'share' }, { kind: 'video', via: 'share', fmt: 'story' }, { kind: 'jepret', via: 'kirim', fmt: 'story' }, { kind: 'foto', via: 'save', fmt: 'reels' }]) {
    const r = await p.c.post('/api/share', bad);
    assert.equal(r.status, 400, JSON.stringify(bad));
  }
  let ql = (await p.c.get('/api/quests')).body;
  let d = ql.daily.find((x: any) => x.id === 'h-bagikan');
  assert.ok(d, 'tugas ada di daftar harian');
  assert.equal(d.progress, 0);
  const r = await p.c.post('/api/share', { kind: 'jepret', via: 'share', fmt: 'story' });
  assert.equal(r.status, 200);
  assert.equal(r.body.counted, true);
  assert.ok(r.body.quests.ready >= 1, 'ringkasan tugas ikut dikirim (tugas siap diambil)');
  ql = (await p.c.get('/api/quests')).body;
  d = ql.daily.find((x: any) => x.id === 'h-bagikan');
  assert.equal(d.progress, 1); assert.equal(d.done, true);
  // bagikan lagi: progres tetap 1 (target 1, sekali sehari)
  await p.c.post('/api/share', { kind: 'foto', via: 'save', fmt: 'feed' });
  d = (await p.c.get('/api/quests')).body.daily.find((x: any) => x.id === 'h-bagikan');
  assert.equal(d.progress, 1);
  const before = (await p.c.get('/api/me')).body.wallet.coin;
  const cl = await p.c.post('/api/quests/h-bagikan/claim');
  assert.equal(cl.status, 200);
  assert.equal((await p.c.get('/api/me')).body.wallet.coin, before + 10, '10 koin');
  assert.equal((await p.c.post('/api/quests/h-bagikan/claim')).status, 400, 'sekali saja');
  const ev = await db.one(`select props from analytics_events where user_id = $1 and name = 'share' order by id limit 1`, [p.id]);
  assert.deepEqual(ev.props, { kind: 'jepret', via: 'share', fmt: 'story' });
});

test('POST /api/share: paling banyak shareEventsPerDay catatan per pemain per hari', async () => {
  const p = await player('Bagi2');
  const vias = ['share', 'save', 'download', 'inapp', 'share', 'save', 'download'];
  const counted = [];
  for (const via of vias) counted.push((await p.c.post('/api/share', { kind: 'jepret', via, fmt: 'story' })).body.counted);
  assert.deepEqual(counted, [true, true, true, true, true, false, false]);
  assert.equal(await shares(p.id), 5);
  // admin menurunkan batas: berlaku untuk pemain baru hari ini
  await setGame({ jepret: { shareEventsPerDay: 1 } });
  const q = await player('Bagi3');
  assert.equal((await q.c.post('/api/share', { kind: 'foto', via: 'download', fmt: 'feed' })).body.counted, true);
  assert.equal((await q.c.post('/api/share', { kind: 'foto', via: 'download', fmt: 'feed' })).body.counted, false);
  assert.equal(await shares(q.id), 1);
  await setGame({ jepret: { shareEventsPerDay: 5 } });
});

test('pengaturan Jepret divalidasi admin; fitur dimatikan → /api/share ditolak & tugas tidak dibagikan', async () => {
  const o = client();
  assert.equal((await o.post('/api/admin/login', { email: 'owner@test.local', password: 'rahasia-sekali-123' })).status, 200);
  const cur = (await o.get('/api/admin/settings')).body;
  assert.equal(cur.value.jepret.shareEventsPerDay, 5);
  assert.ok(cur.help.jepret && /shareEventsPerDay/.test(cur.help.jepret), 'ada penjelasan di admin');
  for (const n of [51, -1, 2.5]) {
    const r = await o.put('/api/admin/settings', { value: { ...cur.value, jepret: { shareEventsPerDay: n } } });
    assert.equal(r.status, 400, String(n));
    assert.match(r.body.error.message, /Jepret/);
  }
  assert.equal((await o.put('/api/admin/settings', { value: { ...cur.value, jepret: { shareEventsPerDay: 8 } } })).status, 200);
  assert.equal((await o.get('/api/admin/settings')).body.value.jepret.shareEventsPerDay, 8);
  // matikan fitur
  assert.equal((await o.put('/api/admin/settings', { value: { ...cur.value, features: { ...cur.value.features, jepret: false } } })).status, 200);
  const p = await player('Tutup');
  const r = await p.c.post('/api/share', { kind: 'jepret', via: 'share', fmt: 'story' });
  assert.equal(r.status, 403);
  assert.equal((await p.c.get('/api/catalog')).body.settings.features.jepret, false, 'game tahu fitur mati (tombol Jepret disembunyikan)');
  assert.ok(!(await p.c.get('/api/quests')).body.daily.some((x: any) => x.id === 'h-bagikan'), 'tugas Bagikan tidak dibagikan saat fitur mati');
  assert.equal((await o.put('/api/admin/settings', { value: { ...cur.value, features: { ...cur.value.features, jepret: true } } })).status, 200);
  assert.equal((await p.c.post('/api/share', { kind: 'jepret', via: 'share', fmt: 'story' })).status, 200);
});

test('POST /api/share: batas laju 10 per menit', async () => {
  const rl = await buildApp({ memoryDb: true, logger: false, rateLimit: true, worker: false });
  try {
    const p = await player('Cepat', () => rl.app);
    const codes = [];
    for (let i = 0; i < 12; i++) codes.push((await p.c.post('/api/share', { kind: 'jepret', via: 'save', fmt: 'story' })).status);
    assert.deepEqual(codes.slice(0, 10), Array(10).fill(200));
    assert.deepEqual(codes.slice(10), [429, 429]);
  } finally { await rl.app.close(); }
});
