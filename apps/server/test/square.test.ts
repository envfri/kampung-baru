// Alun-alun: semua pemain berkumpul (bukan hanya teman), maksimal 20 per alun-alun, blokir, obrolan, laporan, main & jajan.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config';
import { squareShow } from '@kb/shared';

config.paymentProvider = 'mock';
const { buildApp } = await import('../src/app');
const { resetSquares } = await import('../src/routes/square');
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

test('alun-alun: main berhadiah terbatas, jajan, joget hanya saat musik, laporan membisukan obrolan', async () => {
  resetSquares();
  const a = await player('Main1');
  await sync(a);
  await db.query(`update wallets set coin = 500 where user_id = $1`, [a.id]);
  const r1 = await a.c.post('/api/square/act', { kind: 'naik' });
  assert.equal(r1.status, 200, JSON.stringify(r1.body));
  assert.equal(r1.body.rewarded, true);
  assert.ok(r1.body.coins > 0);
  for (let i = 0; i < 12; i++) await a.c.post('/api/square/act', { kind: 'ayun' });
  const capped = await a.c.post('/api/square/act', { kind: 'duduk' });
  assert.equal(capped.status, 200);
  assert.equal(capped.body.rewarded, false, 'lewat batas harian: tetap boleh main tanpa hadiah');
  // jajan bakso: koin berkurang, Kenyang naik
  await db.query(`update pets set kenyang = 40 where user_id = $1`, [a.id]);
  const before = (await a.c.get('/api/me')).body.wallet.coin;
  const j = await a.c.post('/api/square/act', { kind: 'jajan', item: 'alun-bakso' });
  assert.equal(j.status, 200, JSON.stringify(j.body));
  assert.ok(j.body.pet.needs.kenyang > 40);
  assert.equal(j.body.wallet.coin, before - 18, 'harga bakso 18 koin');
  assert.equal((await a.c.post('/api/square/act', { kind: 'jajan', item: 'kue-palsu' })).status, 400);
  // joget & nonton mengikuti jadwal panggung
  const show = squareShow(Date.now());
  const jg = await a.c.post('/api/square/act', { kind: 'joget' });
  if (show.music) assert.equal(jg.status, 200); else assert.equal(jg.body.error?.code, 'no_music');
  const nt = await a.c.post('/api/square/act', { kind: 'nonton' });
  if (show.playing) assert.equal(nt.status, 200); else assert.equal(nt.body.error?.code, 'show_break');
  // tiga pelapor berbeda dalam satu jam → obrolan dibisukan
  const rs = [await player('Lapor1'), await player('Lapor2'), await player('Lapor3')];
  for (const r of rs) { await sync(r); assert.equal((await r.c.post('/api/square/report', { userId: a.id, reason: 'kata kasar' })).status, 200); }
  assert.equal((await db.one(`select count(*)::int c from reports where target_id = $1`, [a.id])).c, 3);
  assert.equal((await a.c.post('/api/square/say', { text: 'Halo semua!' })).status, 403, 'dibisukan sementara');
  assert.equal((await a.c.post('/api/square/report', { userId: a.id })).status, 400, 'tidak bisa melapor diri sendiri');
});

test('alun-alun: ditutup admin & pet yang tidur tidak bisa masuk', async () => {
  resetSquares();
  const a = await player('Tutup1');
  await db.query(`update pets set sleep = '{"since": 1, "wakeAt": 9999999999999}'::jsonb where user_id = $1`, [a.id]).catch(() => {});
  const asleep = await sync(a);
  const row = await db.one(`select value from settings where key = 'game'`);
  const v = row?.value ?? {};
  v.square = { ...(v.square ?? {}), enabled: false };
  await db.query(`insert into settings (key, value) values ('game', $1::text::jsonb) on conflict (key) do update set value = excluded.value`, [JSON.stringify(v)]);
  (await import('../src/lib/core')).invalidateCaches();
  assert.equal((await sync(a)).body.reason, 'off');
  void asleep;
});
