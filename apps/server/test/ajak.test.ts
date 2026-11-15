// Pet ngajak ke Alun-alun: pilih alasan & kalimat (fungsi murni), jeda & batas per hari, cek pengaturan admin,
// dan GET /api/square (jumlah orang lain + teman yang sedang di alun-alun).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config';
import { AJAK_LINES, AJAK_MEMO0, DEFAULT_SETTINGS, LOMBA, PARADE, ajakAllowed, ajakNames, ajakNote, ajakPick, ajakText, checkAjakAlun, kembangApiSoon } from '@kb/shared';

config.paymentProvider = 'mock';
config.adminEmail = 'owner@test.local';
config.adminPassword = 'rahasia-sekali-123';
const { buildApp } = await import('../src/app');
const { resetSquares } = await import('../src/routes/square');
let app: any;
let db: any;
before(async () => { ({ app, db } = await buildApp({ memoryDb: true, logger: false, rateLimit: false, worker: false })); });
after(async () => { await app?.close(); });

function client() {
  let cookie = '';
  const call = async (method: string, url: string, body?: unknown) => {
    const res = await app.inject({ method, url, payload: body as any, headers: cookie ? { cookie } : {} });
    const set = res.headers['set-cookie'];
    if (set) {
      const jar = new Map(cookie ? cookie.split('; ').map((c: string) => c.split('=') as [string, string]) : []);
      for (const c of Array.isArray(set) ? set : [set]) { const [kv] = c.split(';'); const [k, v] = kv.split('='); if (v) jar.set(k, v); else jar.delete(k); }
      cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    }
    return { status: res.statusCode, body: res.body ? (() => { try { return JSON.parse(res.body); } catch { return res.body; } })() : null };
  };
  return { call, get: (u: string) => call('GET', u), post: (u: string, b?: unknown) => call('POST', u, b ?? {}), put: (u: string, b?: unknown) => call('PUT', u, b ?? {}) };
}
async function player(name: string) {
  const c = client();
  await c.post('/api/auth/guest');
  const p = await c.post('/api/pet', { name, color: '#F6B7A8', ear: 'tunas' });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  return { c, id: p.body.state.user.id as string, code: p.body.state.user.friend_code as string, name };
}

/** waktu tenang: tidak ada lomba (≥ 3 mnt lagi) & tidak ada arak-arakan (≥ 2 mnt lagi) */
function quietTime() {
  for (let t = Date.UTC(2026, 10, 13, 3, 0); ; t += 30_000) {
    const toLomba = (LOMBA.everyMs - ((t - LOMBA.offsetMs) % LOMBA.everyMs)) % LOMBA.everyMs;
    const inLomba = ((t - LOMBA.offsetMs) % LOMBA.everyMs) < LOMBA.durMs;
    const toArak = (PARADE.everyMs - ((t - PARADE.offsetMs) % PARADE.everyMs)) % PARADE.everyMs;
    const inArak = ((t - PARADE.offsetMs) % PARADE.everyMs) < PARADE.durMs;
    if (toLomba > 4 * 60_000 && !inLomba && toArak > 3 * 60_000 && !inArak) return t;
  }
}
const QUIET = quietTime();
const NOON = { h: 12, m: 0 };

/* ---------------- fungsi murni ---------------- */

test('ajakan: tidak ada orang lain → tidak mengajak; minPeople dihormati', () => {
  assert.equal(ajakPick({ now: QUIET, hm: NOON, squares: [] }), null);
  assert.equal(ajakPick({ now: QUIET, hm: NOON, squares: [{ id: 1, count: 0 }] }), null);
  assert.equal(ajakPick({ now: QUIET, hm: NOON, squares: [{ id: 1, count: 2 }], minPeople: 3 }), null);
  const p = ajakPick({ now: QUIET, hm: NOON, squares: [{ id: 1, count: 2 }] })!;
  assert.equal(p.reason, 'sedikit');
  assert.equal(p.total, 2);
  assert.equal(ajakText(p, { rand: () => 0 }).text, 'Ada 2 orang di alun-alun, samperin yuk?');
  assert.equal(ajakText(p, { rand: () => 0 }).sub, '');
});

test('ajakan: ramai mulai ramaiFrom orang, tujuan = alun-alun paling ramai', () => {
  const p = ajakPick({ now: QUIET, hm: NOON, squares: [{ id: 1, count: 3 }, { id: 2, count: 4 }], ramaiFrom: 5 })!;
  assert.equal(p.reason, 'ramai');
  assert.equal(p.alun, 2);
  assert.equal(p.total, 7);
  assert.match(ajakText(p, { rand: () => 0 }).text, /ramai, 7 orang/);
});

test('ajakan: teman di alun-alun disebut namanya, tujuan = alun-alun tempat teman', () => {
  const p = ajakPick({ now: QUIET, hm: NOON, squares: [{ id: 1, count: 6 }, { id: 2, count: 3 }], friends: [{ name: 'Wajik', alun: 2 }] })!;
  assert.equal(p.reason, 'teman');
  assert.equal(p.alun, 2);
  const t = ajakText(p, { rand: () => 0 });
  assert.equal(t.text, 'Ke alun-alun yuk! Wajik lagi di sana.');
  assert.equal(t.sub, 'Alun-alun 2 · 3 orang');
  const two = ajakText(ajakPick({ now: QUIET, hm: NOON, squares: [{ id: 1, count: 4 }], friends: [{ name: 'Wajik', alun: 1 }, { name: 'Putu', alun: 1 }] })!, { rand: () => 0 });
  assert.equal(two.text, 'Ke alun-alun yuk! Wajik & Putu lagi di sana.');
  const three = ajakText(ajakPick({ now: QUIET, hm: NOON, squares: [{ id: 1, count: 4 }], friends: [{ name: 'Wajik', alun: 1 }, { name: 'Putu', alun: 1 }, { name: 'Klepon', alun: 1 }] })!, { rand: () => 0 });
  assert.equal(three.text, 'Ke alun-alun yuk! Wajik, Putu & 1 teman lain lagi di sana.');
  // teman ada walau hitungan belum ikut (data selisih sebentar): tetap mengajak
  assert.equal(ajakPick({ now: QUIET, hm: NOON, squares: [], friends: [{ name: 'Wajik', alun: 1 }] })?.reason, 'teman');
});

test('ajakan: acara yang segera mulai didahulukan, teman disebut di keterangan', () => {
  assert.equal(kembangApiSoon({ h: 19, m: 57 }), 3);
  assert.equal(kembangApiSoon({ h: 20, m: 55 }), 5);
  assert.equal(kembangApiSoon({ h: 19, m: 54 }), null);
  assert.equal(kembangApiSoon({ h: 20, m: 1 }), null);
  const k = ajakPick({ now: QUIET, hm: { h: 19, m: 57 }, squares: [{ id: 1, count: 5 }], friends: [{ name: 'Wajik', alun: 1 }, { name: 'Putu', alun: 1 }] })!;
  assert.equal(k.reason, 'kembangApi');
  assert.equal(k.menit, 3);
  const kt = ajakText(k, { rand: () => 0 });
  assert.equal(kt.text, 'Sebentar lagi ada kembang api! Nonton bareng yuk?');
  assert.equal(kt.sub, 'Wajik, Putu & 3 lainnya di sana');
  assert.equal(ajakText(k, { rand: () => 0.99 }).text, 'Kembang api 3 menit lagi! Ke alun-alun yuk?');
  // lomba mancing 2 menit lagi
  const lombaStart = Math.ceil((QUIET - LOMBA.offsetMs) / LOMBA.everyMs) * LOMBA.everyMs + LOMBA.offsetMs;
  const l = ajakPick({ now: lombaStart - 150_000, hm: NOON, squares: [{ id: 1, count: 2 }] })!;
  assert.equal(l.reason, 'lomba');
  assert.equal(l.menit, 3);
  assert.equal(ajakText(l).text, 'Lomba Mancing mulai 3 menit lagi. Ikut yuk!');
  assert.equal(ajakText(l).sub, 'Alun-alun 1 · 2 orang');
  // saat lomba berlangsung bukan alasan "lomba"
  assert.notEqual(ajakPick({ now: lombaStart + 30_000, hm: NOON, squares: [{ id: 1, count: 2 }] })?.reason, 'lomba');
  // arak-arakan 90 detik lagi (di luar jendela lomba)
  let t = QUIET; while (true) { const to = (PARADE.everyMs - ((t - PARADE.offsetMs) % PARADE.everyMs)) % PARADE.everyMs; const tl = (LOMBA.everyMs - ((t - LOMBA.offsetMs) % LOMBA.everyMs)) % LOMBA.everyMs; if (to === 90_000 && tl > 4 * 60_000) break; t += 30_000; }
  const a = ajakPick({ now: t, hm: NOON, squares: [{ id: 1, count: 1 }] })!;
  assert.equal(a.reason, 'arak');
  assert.equal(ajakText(a).text, 'Arak-arakan ondel-ondel mau lewat! Ikut yuk?');
});

test('ajakan: kalimat dari admin dipakai ({teman} {jumlah} {menit} {pet}), baris kosong → bawaan', () => {
  const p = ajakPick({ now: QUIET, hm: NOON, squares: [{ id: 1, count: 3 }], friends: [{ name: 'Wajik', alun: 1 }] })!;
  assert.equal(ajakText(p, { pet: 'Lupis', lines: { teman: ['{pet} kangen {teman}! Ada {jumlah} orang.'] } }).text, 'Lupis kangen Wajik! Ada 3 orang.');
  assert.equal(ajakText(p, { lines: { teman: ['', '  '] }, rand: () => 0 }).text, AJAK_LINES.teman[0].replace('{teman}', 'Wajik'));
  assert.equal(ajakNames(['A']), 'A');
  assert.equal(ajakNames(['A', 'B']), 'A & B');
  assert.equal(ajakNames(['A'], 2), 'A & 2 lainnya');
  assert.equal(ajakNames([], 2), '');
});

test('ajakan: jeda pertama, jeda antar ajakan, batas per hari, Nanti 2× = diam hari itu, baru pulang dari alun-alun', () => {
  const R = { firstSec: 60, gapMin: 15, perDay: 4 };
  const T0 = Date.UTC(2026, 10, 14, 5, 0), D = '2026-11-14';
  const home = T0 - 30_000;
  assert.equal(ajakAllowed(AJAK_MEMO0, R, T0, D, home), false, 'baru 30 detik di rumah');
  assert.equal(ajakAllowed(AJAK_MEMO0, R, T0 + 31_000, D, home), true);
  let m = ajakNote(AJAK_MEMO0, 'tampil', T0 + 31_000, D);
  assert.equal(m.n, 1);
  assert.equal(ajakAllowed(m, R, T0 + 10 * 60_000, D, home), false, 'jeda 15 menit');
  assert.equal(ajakAllowed(m, R, T0 + 31_000 + 15 * 60_000, D, home), true);
  m = ajakNote(m, 'nanti', T0 + 40_000, D);
  assert.equal(m.mute, false);
  m = ajakNote(ajakNote(m, 'tampil', T0 + 20 * 60_000, D), 'nanti', T0 + 20 * 60_000, D);
  assert.equal(m.mute, true, 'Nanti dua kali berturut-turut');
  assert.equal(ajakAllowed(m, R, T0 + 5 * 3600_000, D, home), false);
  assert.equal(ajakAllowed(m, R, T0 + 24 * 3600_000, '2026-11-15', home), true, 'besok boleh lagi');
  // Ayo! di antara dua Nanti mereset hitungan
  let k = ajakNote(ajakNote(AJAK_MEMO0, 'nanti', T0, D), 'ayo', T0, D);
  k = ajakNote(k, 'nanti', T0, D);
  assert.equal(k.mute, false);
  // batas per hari
  let c = { ...AJAK_MEMO0 };
  for (let i = 0; i < 4; i++) c = ajakNote(c, 'tampil', T0 + i * 20 * 60_000, D);
  assert.equal(ajakAllowed(c, R, T0 + 5 * 3600_000, D, home), false, 'sudah 4 kali');
  // baru pulang dari alun-alun
  const back = { ...AJAK_MEMO0, alunAt: T0 };
  assert.equal(ajakAllowed(back, R, T0 + 5 * 60_000, D, home), false);
  assert.equal(ajakAllowed(back, R, T0 + 11 * 60_000, D, home), true);
});

test('ajakan: pengaturan bawaan lolos cek, nilai di luar batas ditolak', () => {
  const ok: string[] = [];
  checkAjakAlun((DEFAULT_SETTINGS as any).ajakAlun, (m) => ok.push(m));
  assert.deepEqual(ok, []);
  assert.equal((DEFAULT_SETTINGS as any).features.ajakAlun, true);
  for (const bad of [{ firstSec: 1 }, { gapMin: 0 }, { perDay: 21 }, { minPeople: 0 }, { ramaiFrom: 1 }, { lines: { ...(DEFAULT_SETTINGS as any).ajakAlun.lines, teman: ['x'.repeat(121)] } }, { lines: { teman: [] } }]) {
    const errs: string[] = [];
    checkAjakAlun({ ...(DEFAULT_SETTINGS as any).ajakAlun, ...bad }, (m) => errs.push(m));
    assert.equal(errs.length, 1, JSON.stringify(bad));
    assert.match(errs[0], /Ajakan ke Alun-alun/);
  }
});

/* ---------------- server ---------------- */

test('GET /api/square: hitungan tanpa diri sendiri, teman yang di alun-alun (nama pet), status online disembunyikan tidak ikut', async () => {
  resetSquares();
  const me = await player('Lupis');
  const wajik = await player('Wajik');
  const putu = await player('Putu');
  const asing = await player('Asing');
  assert.equal((await me.c.post('/api/friends', { code: wajik.code })).status, 200);
  assert.equal((await me.c.post('/api/friends', { code: putu.code })).status, 200);
  let r = await me.c.get('/api/square');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.squares, []);
  assert.deepEqual(r.body.friends, []);
  for (const p of [wajik, putu, asing]) assert.equal((await p.c.post('/api/square/sync', { x: 10, y: 18 })).status, 200);
  r = await me.c.get('/api/square');
  assert.deepEqual(r.body.squares, [{ id: 1, count: 3 }]);
  assert.deepEqual(r.body.friends.map((f: any) => f.name).sort(), ['Putu', 'Wajik']);
  assert.ok(r.body.friends.every((f: any) => f.alun === 1));
  // diri sendiri di alun-alun tidak dihitung
  await me.c.post('/api/square/sync', { x: 10, y: 18 });
  r = await me.c.get('/api/square');
  assert.deepEqual(r.body.squares, [{ id: 1, count: 3 }]);
  // teman yang menyembunyikan status online tidak disebut
  await db.query(`update users set show_online = false where id = $1`, [putu.id]);
  r = await me.c.get('/api/square');
  assert.deepEqual(r.body.friends.map((f: any) => f.name), ['Wajik']);
  // fitur dimatikan admin: tidak ada daftar teman (hitungan tetap untuk peta)
  const row = await db.one(`select value from settings where key = 'game'`);
  const v = row?.value ?? {};
  v.features = { ...(v.features ?? {}), ajakAlun: false };
  await db.query(`insert into settings (key, value) values ('game', $1::text::jsonb) on conflict (key) do update set value = excluded.value`, [JSON.stringify(v)]);
  (await import('../src/lib/core')).invalidateCaches();
  r = await me.c.get('/api/square');
  assert.deepEqual(r.body.friends, []);
  assert.deepEqual(r.body.squares, [{ id: 1, count: 3 }]);
  v.features.ajakAlun = true;
  await db.query(`update settings set value = $1::text::jsonb where key = 'game'`, [JSON.stringify(v)]);
  (await import('../src/lib/core')).invalidateCaches();
  // pengaturan untuk game ikut dikirim di katalog
  const cat = await me.c.get('/api/catalog');
  assert.equal(cat.body.settings.ajakAlun.gapMin, 15);
  assert.equal(cat.body.settings.features.ajakAlun, true);
});

test('admin: ajakAlun tersimpan & nilai salah ditolak; catatan ajak_alun diterima', async () => {
  const adm = client();
  assert.equal((await adm.post('/api/admin/login', { email: 'owner@test.local', password: 'rahasia-sekali-123' })).status, 200);
  const cur = (await adm.get('/api/admin/settings')).body.value;
  const bad = await adm.put('/api/admin/settings', { value: { ...cur, ajakAlun: { ...cur.ajakAlun, gapMin: 0 } } });
  assert.equal(bad.status, 400);
  assert.match(JSON.stringify(bad.body), /gapMin/);
  const ok = await adm.put('/api/admin/settings', { value: { ...cur, ajakAlun: { ...cur.ajakAlun, perDay: 2 } } });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal((await adm.get('/api/admin/settings')).body.value.ajakAlun.perDay, 2);
  const p = await player('Kue');
  assert.equal((await p.c.post('/api/track', { events: [{ name: 'ajak_alun', props: { reason: 'teman', choice: 'ayo' } }] })).status, 200);
  const ev = await db.one(`select count(*)::int as n from analytics_events where user_id = $1 and name = 'ajak_alun'`, [p.id]);
  assert.equal(ev.n, 1);
});
