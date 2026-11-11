// Alun-alun: semua pemain berkumpul (bukan hanya teman), maksimal 20 per alun-alun, blokir, obrolan, laporan, main & jajan.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config';
import { squareShow } from '@kb/shared';

config.paymentProvider = 'mock';
const { buildApp } = await import('../src/app');
const { resetSquares, setSquareClock, resetSquareActGap } = await import('../src/routes/square');
const resetSquareGap = async (_p?: unknown) => resetSquareActGap();
let app: any;
let db: any;
before(async () => { ({ app, db } = await buildApp({ memoryDb: true, logger: false, rateLimit: false, worker: false })); });
after(async () => app?.close());

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
  return { call, get: (u: string) => call('GET', u), post: (u: string, b?: unknown) => call('POST', u, b ?? {}) };
}
async function player(name: string) {
  const c = client();
  await c.post('/api/auth/guest');
  const p = await c.post('/api/pet', { name, color: '#F6B7A8', ear: 'tunas' });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  return { c, id: p.body.state.user.id as string, name };
}
const sync = (p: any, body: any = {}) => p.c.post('/api/square/sync', { x: 10, y: 18, ...body });

test('alun-alun: orang asing saling melihat, hadiah kunjungan harian, obrolan tersaring, keluar', async () => {
  resetSquares();
  const a = await player('Alun1'), b = await player('Alun2');
  const coin0 = (await a.c.get('/api/me')).body.wallet.coin;
  const ra = await sync(a);
  assert.equal(ra.status, 200, JSON.stringify(ra.body));
  assert.equal(ra.body.live, true);
  assert.equal(ra.body.inst, 1);
  assert.ok(ra.body.welcome?.coins > 0, 'hadiah kunjungan pertama hari ini');
  assert.equal(ra.body.welcome.wallet.coin, coin0 + ra.body.welcome.coins);
  await sync(b, { x: 12.5, y: 17 });
  const ra2 = await sync(a);
  assert.equal(ra2.body.welcome, null, 'hadiah kunjungan hanya sekali sehari');
  assert.deepEqual(ra2.body.members.map((m: any) => m.name), ['Alun2'], 'bukan teman pun saling melihat');
  assert.equal(ra2.body.members[0].roomId, 'alun');
  assert.equal(ra2.body.count, 2);
  // posisi dibatasi lapangan 20×20
  await sync(b, { x: 99, y: -5 });
  const m = (await sync(a)).body.members[0];
  assert.equal(m.x, 19.5); assert.equal(m.y, 0.5);
  // obrolan: frasa & ketik bebas tersaring (tautan / nomor ditolak)
  assert.equal((await a.c.post('/api/square/say', { text: 'Halo semua!' })).status, 200);
  await new Promise((r) => setTimeout(r, 1600));
  assert.equal((await a.c.post('/api/square/say', { text: 'cek www.contoh.com' })).status, 400);
  const ev = (await sync(b, { since: 0 })).body.events;
  assert.ok(ev.some((e: any) => e.kind === 'say' && e.text === 'Halo semua!'));
  assert.equal((await db.one(`select count(*)::int c from square_chat`)).c, 1, 'obrolan tercatat untuk moderasi');
  // keluar
  await b.c.post('/api/square/leave');
  assert.equal((await sync(a)).body.members.length, 0);
});

test('alun-alun: penuh 20 orang → otomatis Alun-alun 2; susul teman bila masih muat', async () => {
  resetSquares();
  const ps = [];
  for (let i = 0; i < 21; i++) ps.push(await player(`Ramai${i}`));
  for (const p of ps.slice(0, 20)) assert.equal((await sync(p)).body.inst, 1);
  const last = await sync(ps[20]);
  assert.equal(last.body.inst, 2, 'orang ke-21 masuk Alun-alun 2');
  assert.equal(last.body.count, 1);
  assert.deepEqual(last.body.others, [{ id: 1, count: 20 }]);
  // satu orang pulang dari Alun-alun 1, lalu orang di Alun-alun 2 menyusul teman ke Alun-alun 1
  await ps[0].c.post('/api/square/leave');
  await ps[20].c.post('/api/square/leave');
  assert.equal((await sync(ps[20], { inst: 1 })).body.inst, 1);
});

test('alun-alun: yang saling memblokir tidak saling melihat & obrolannya tidak sampai', async () => {
  resetSquares();
  const a = await player('Blok1'), b = await player('Blok2'), c = await player('Blok3');
  await sync(a); await sync(b); await sync(c);
  assert.equal((await a.c.post('/api/blocks', { userId: b.id })).status, 200);
  const ra = await sync(a), rb = await sync(b);
  assert.deepEqual(ra.body.members.map((m: any) => m.name), ['Blok3']);
  assert.deepEqual(rb.body.members.map((m: any) => m.name), ['Blok3'], 'dua arah');
  await b.c.post('/api/square/say', { text: 'Salam kenal!' });
  assert.ok(!(await sync(a, { since: 0 })).body.events.some((e: any) => e.kind === 'say'), 'obrolan yang memblokir tidak sampai');
  assert.ok((await sync(c, { since: 0 })).body.events.some((e: any) => e.kind === 'say'), 'orang lain tetap mendengar');
  // foto bareng: yang saling memblokir tidak difoto bersama
  await sync(a, { x: 10, y: 18 }); await sync(b, { x: 11, y: 18 }); await sync(c, { x: 10, y: 17 });
  const ph = await c.c.post('/api/square/photo', { pose: 'senyum' });
  assert.equal(ph.status, 200, JSON.stringify(ph.body));
  const names = ph.body.photo.members.map((m: any) => m.name);
  assert.ok(names.includes('Blok3') && !(names.includes('Blok1') && names.includes('Blok2')), `bukan pasangan terblokir: ${names}`);
});

/** waktu (ms) setelah `from` saat musik sedang main di panggung */
function musicAt(from: number, music = true) {
  let t = from;
  while (squareShow(t).music !== music || (music === false && squareShow(t).playing)) t += 1000;
  return t;
}
const setVisit = async (key: string, patch: Record<string, unknown>) => {
  const row = await db.one(`select value from settings where key = 'game'`);
  const v = row?.value ?? {};
  v[key] = { ...(v[key] ?? {}), ...patch };
  await db.query(`insert into settings (key, value) values ('game', $1::text::jsonb) on conflict (key) do update set value = excluded.value`, [JSON.stringify(v)]);
  (await import('../src/lib/core')).invalidateCaches();
};

test('alun-alun: main berhadiah terbatas, jeda antaraksi, jajan, joget & nonton mengikuti jadwal panggung', async () => {
  resetSquares();
  const realNow = Date.now();
  try {
    const a = await player('Main1');
    await sync(a);
    await db.query(`update wallets set coin = 500 where user_id = $1`, [a.id]);
    const gap = () => resetSquareGap(a);
    const r1 = await a.c.post('/api/square/act', { kind: 'naik' });
    assert.equal(r1.status, 200, JSON.stringify(r1.body));
    assert.equal(r1.body.rewarded, true);
    assert.ok(r1.body.coins > 0);
    assert.equal((await a.c.post('/api/square/act', { kind: 'ayun' })).body.error?.code, 'too_fast', 'ada jeda antaraksi');
    for (let i = 0; i < 12; i++) { await gap(); await a.c.post('/api/square/act', { kind: 'ayun' }); }
    await gap();
    await db.query(`update pets set ceria = 10 where user_id = $1`, [a.id]);
    const capped = await a.c.post('/api/square/act', { kind: 'duduk' });
    assert.equal(capped.status, 200);
    assert.equal(capped.body.rewarded, false, 'lewat batas harian: tetap boleh main tanpa hadiah');
    assert.equal(capped.body.ceria, 0, 'lewat batas: tidak menambah ceria');
    assert.equal((await db.one(`select ceria from pets where user_id = $1`, [a.id])).ceria, 10);
    // jajan bakso: koin berkurang, Kenyang naik
    await gap();
    await db.query(`update pets set kenyang = 40 where user_id = $1`, [a.id]);
    const before = (await a.c.get('/api/me')).body.wallet.coin;
    const j = await a.c.post('/api/square/act', { kind: 'jajan', item: 'alun-bakso' });
    assert.equal(j.status, 200, JSON.stringify(j.body));
    assert.ok(j.body.pet.needs.kenyang > 40);
    assert.equal(j.body.wallet.coin, before - 18, 'harga bakso 18 koin');
    await gap();
    assert.equal((await a.c.post('/api/square/act', { kind: 'jajan', item: 'kue-palsu' })).status, 400);
    // joget & nonton mengikuti jadwal panggung (jam alun-alun dipasang tetap)
    setSquareClock(() => musicAt(realNow));
    await gap();
    assert.equal((await a.c.post('/api/square/act', { kind: 'joget' })).status, 200, 'joget saat musik');
    setSquareClock(() => musicAt(realNow, false));
    await gap();
    assert.equal((await a.c.post('/api/square/act', { kind: 'joget' })).body.error?.code, 'no_music');
    await gap();
    assert.equal((await a.c.post('/api/square/act', { kind: 'nonton' })).body.error?.code, 'show_break');
    // joget yang diklaim lewat sinkron di luar musik tidak tampil
    await sync(a, { act: 'joget' });
    const b = await player('Main2');
    assert.equal((await sync(b)).body.members[0].act, null);
  } finally { setSquareClock(() => Date.now()); }
});

test('alun-alun: batas 0 dari admin dihormati', async () => {
  resetSquares();
  await setVisit('square', { actsPerDay: 0, snacksPerDay: 0 });
  try {
    const a = await player('Nol1');
    await sync(a);
    const r = await a.c.post('/api/square/act', { kind: 'duduk' });
    assert.equal(r.body.rewarded, false, 'actsPerDay 0 = tidak ada main berhadiah');
    await resetSquareGap(a);
    assert.equal((await a.c.post('/api/square/act', { kind: 'jajan', item: 'alun-dawet' })).body.error?.code, 'daily_limit');
  } finally { await setVisit('square', { actsPerDay: 10, snacksPerDay: 5 }); }
});

test('alun-alun: laporan hanya dari yang bertemu, bisu sekali per gelombang & bisa dibuka admin', async () => {
  resetSquares();
  const realNow = Date.now();
  try {
    const a = await player('Lapor0');
    await sync(a);
    // tiga akun yang tidak pernah ke alun-alun tidak bisa melapor
    const outsiders = [await player('Luar1'), await player('Luar2'), await player('Luar3')];
    for (const o of outsiders) assert.equal((await o.c.post('/api/square/report', { userId: a.id })).body.error?.code, 'not_here');
    // baru masuk: belum boleh melapor
    const rs = [await player('Lapor1'), await player('Lapor2'), await player('Lapor3'), await player('Lapor4')];
    for (const r of rs) await sync(r);
    assert.equal((await rs[0].c.post('/api/square/report', { userId: a.id })).body.error?.code, 'too_soon');
    setSquareClock(() => realNow + 120_000);
    // id huruf besar = orang yang sama; tidak bisa melapor diri sendiri; id tak dikenal ditolak
    assert.equal((await rs[0].c.post('/api/square/report', { userId: rs[0].id.toUpperCase() })).body.error?.code, 'invalid');
    assert.equal((await rs[0].c.post('/api/square/report', { userId: '00000000-0000-0000-0000-000000000000' })).body.error?.code, 'not_met');
    assert.equal((await rs[0].c.post('/api/square/report', { userId: '------------------------------------' })).status, 400);
    for (const r of rs.slice(0, 3)) assert.equal((await r.c.post('/api/square/report', { userId: a.id.toUpperCase(), reason: 'kata kasar' })).status, 200);
    const u1 = await db.one(`select chat_muted_until from users where id = $1`, [a.id]);
    assert.ok(u1.chat_muted_until, 'dibisukan setelah 3 pelapor');
    assert.equal((await a.c.post('/api/square/say', { text: 'Halo semua!' })).status, 403);
    // laporan berikutnya tidak memperpanjang bisu
    assert.equal((await rs[3].c.post('/api/square/report', { userId: a.id })).status, 200);
    const u2 = await db.one(`select chat_muted_until from users where id = $1`, [a.id]);
    assert.equal(new Date(u2.chat_muted_until).getTime(), new Date(u1.chat_muted_until).getTime(), 'bisu tidak diperpanjang');
    // admin membuka bisu → bisa mengobrol lagi, laporan lama tidak membisukan ulang
    const { forgetMute } = await import('../src/routes/square');
    await db.query(`update users set chat_muted_until = now() - interval '1 second' where id = $1`, [a.id]);
    forgetMute(a.id);
    assert.equal((await a.c.post('/api/square/say', { text: 'Halo semua!' })).status, 200);
  } finally { setSquareClock(() => Date.now()); }
});

test('alun-alun: obrolan tersaring dari karakter pembalik arah, huruf mirip, kode akun & nomor dicicil', async () => {
  resetSquares();
  const a = await player('Saring1');
  await sync(a);
  const say = async (text: string) => { await new Promise((r) => setTimeout(r, 1550)); return a.c.post('/api/square/say', { text }); };
  // pembalik arah dibuang: yang disiarkan & disimpan "moc.ukotok" (tidak terbaca sebagai tautan)
  assert.equal((await say('\u202Emoc.ukotok')).status, 200);
  assert.equal((await db.one(`select text from square_chat where user_id = $1 order by id desc limit 1`, [a.id])).text, 'moc.ukotok');
  assert.equal((await say('halo аdmin')).status, 400, 'huruf Kirilik mirip ditolak');
  assert.equal((await say('kodenya K7QM-2XPA ya')).body.error?.code, 'chat_code', 'kode pindah perangkat ditolak');
  assert.equal((await say('0812')).status, 200);
  assert.equal((await say('3456')).body.error?.code, 'chat_link', 'nomor yang dicicil ditolak');
  const ok = await say('Petmu  lucu   banget 😊');
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal((await db.one(`select text from square_chat where user_id = $1 order by id desc limit 1`, [a.id])).text, 'Petmu lucu banget 😊', 'yang disimpan teks bersih');
});

test('alun-alun: kejadian tetap sampai setelah alun-alun kosong dibuat ulang', async () => {
  resetSquares();
  const a = await player('Ulang1'), b = await player('Ulang2');
  await sync(a);
  await a.c.post('/api/square/say', { text: 'Halo semua!' });
  const seqA = (await sync(a)).body.seq;
  await a.c.post('/api/square/leave');
  // alun-alun 1 kosong lalu dibuat ulang (nomor kejadian tidak mulai dari 0 lagi)
  const { squareCounts } = await import('../src/routes/square');
  void squareCounts;
  await sync(b);
  await b.c.post('/api/square/say', { text: 'Salam kenal!' });
  const ra = await sync(a, { since: seqA });
  assert.ok(ra.body.events.some((e: any) => e.kind === 'say' && e.text === 'Salam kenal!'), 'obrolan baru tetap sampai');
});

test('nama yang menyamar jadi tim BUPI ditolak', async () => {
  const c = client();
  await c.post('/api/auth/guest');
  for (const name of ['Admin', 'Mod Bupi', 'Tim BUPI', 'Moderator1']) assert.equal((await c.post('/api/pet', { name, color: '#F6B7A8', ear: 'tunas' })).body.error?.code, 'name_reserved', name);
});

test('alun-alun: ditutup admin & pet yang tidur tidak bisa masuk', async () => {
  resetSquares();
  const a = await player('Tutup1');
  await db.query(`update pets set sleep_from = now() where user_id = $1`, [a.id]);
  const asleep = await sync(a);
  assert.equal(asleep.body.reason, 'asleep');
  await db.query(`update pets set sleep_from = null where user_id = $1`, [a.id]);
  await setVisit('square', { enabled: false });
  try {
    assert.equal((await sync(a)).body.reason, 'off');
    assert.equal((await a.c.post('/api/square/say', { text: 'Halo semua!' })).status, 403);
  } finally { await setVisit('square', { enabled: true }); }
});
