// Kerja Sambilan: syarat mulai (level, energi, kenyang, sakit, tidur, jendela Ronda, batas jam per hari), aksi yang butuh
// pet ditolak selama kerja, panggil pulang (gaji sebanding), terima gaji (sekali, bonus pangkat, seragam sekali),
// kebutuhan beku & biaya tetap saat pulang, tidak sakit karena dibiarkan, notifikasi pulang kerja sekali, tamu di rumah
// teman yang petnya kerja, tugas & lencana, validasi pengaturan admin, dan paket konten 21.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config';

config.paymentProvider = 'mock';
config.adminEmail = 'owner@test.local';
config.adminPassword = 'rahasia-sekali-123';
const { buildApp } = await import('../src/app');
const { invalidateCaches } = await import('../src/lib/core');
const { setKerjaClock } = await import('../src/lib/kerja');
const { seedPackV21, KERJA_UNIFORMS } = await import('../src/db/seed-kerja');
const { runJobs } = await import('../src/lib/worker');
const { DEFAULT_SETTINGS } = await import('@kb/shared');
let app: any;
let db: any;
before(async () => { ({ app, db } = await buildApp({ memoryDb: true, logger: false, rateLimit: false, worker: false })); });
after(async () => app?.close());
beforeEach(async () => { setKerjaClock(() => Date.now()); await setKerja({}); });

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
type P = { c: ReturnType<typeof client>; id: string; code: string; room: string; pet: string };
async function player(pet: string, level = 1): Promise<P> {
  const c = client();
  await c.post('/api/auth/guest');
  const p = await c.post('/api/pet', { name: pet, color: '#F6B7A8', ear: 'kucing' });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  const id = p.body.state.user.id as string;
  await db.query(`update pets set level = $2, kenyang = 70, bersih = 70, ceria = 70, energi = 70, needs_at = now() where user_id = $1`, [id, level]);
  return { c, id, code: p.body.state.user.friend_code, room: p.body.state.rooms[0].id, pet };
}
/** pengaturan kerja: bawaan + perubahan (langsung di database, tanpa admin) */
async function setKerja(patch: Record<string, unknown>) {
  const row = await db?.one(`select value from settings where key = 'game'`);
  if (!db) return;
  const v = row?.value ?? {};
  v.kerja = { ...structuredClone(DEFAULT_SETTINGS.kerja), ...patch };
  await db.query(`insert into settings (key, value) values ('game', $1::text::jsonb) on conflict (key) do update set value = excluded.value`, [JSON.stringify(v)]);
  invalidateCaches();
}
const job = (j: string, bonus: { pct: number; items?: string[] }) => ({ jobs: { ...structuredClone(DEFAULT_SETTINGS.kerja.jobs), [j]: { ...(DEFAULT_SETTINGS.kerja.jobs as any)[j], bonusPct: bonus.pct, ...(bonus.items ? { bonusItems: bonus.items } : {}) } } });
const start = (p: P, j: string, minutes = 60, extra: Record<string, unknown> = {}) => p.c.post('/api/kerja/start', { job: j, minutes, requestId: 'start-' + Math.random().toString(36).slice(2, 12), ...extra });
/** waktu kerja habis (seolah-olah sudah lewat): shift & tubuh pet ikut */
async function finish(p: P) {
  await db.query(`update pet_jobs set started_at = now() - (minutes * interval '1 minute') - interval '1 minute', ends_at = now() - interval '1 minute' where user_id = $1 and status = 'working'`, [p.id]);
  await db.query(`update pets set work_until = now() - interval '1 minute' where user_id = $1 and work_until is not null`, [p.id]);
}
const coins = async (p: P) => (await db.one(`select coin from wallets where user_id = $1`, [p.id])).coin as number;
const qty = async (p: P, item: string) => (await db.one(`select qty from inventory where user_id = $1 and item_id = $2`, [p.id, item]))?.qty ?? 0;
const setProgress = (p: P, j: string, shifts: number) => db.query(`insert into pet_job_progress (user_id, job, shifts) values ($1,$2,$3) on conflict (user_id, job) do update set shifts = excluded.shifts`, [p.id, j, shifts]);
const WIB = (h: number, m = 0) => Date.UTC(2026, 10, 20, h - 7, m);

test('mulai kerja: syarat level, energi, kenyang, sakit, tidur, jendela Ronda, dan batas jam per hari', async () => {
  const a = await player('Mochi');
  // level: Kolam Lv 2, Ronda Lv 6
  let r = await start(a, 'kolam');
  assert.equal(r.status, 400); assert.equal(r.body.error.code, 'locked'); assert.match(r.body.error.message, /Lv 2/);
  // energi & kenyang minimal 25
  await db.query(`update pets set energi = 20 where user_id = $1`, [a.id]);
  r = await start(a, 'warung'); assert.equal(r.body.error.code, 'tired');
  await db.query(`update pets set energi = 70, kenyang = 20, needs_at = now() where user_id = $1`, [a.id]);
  r = await start(a, 'warung'); assert.equal(r.body.error.code, 'hungry');
  // sakit & tidur
  await db.query(`update pets set kenyang = 70, sick_at = now(), needs_at = now() where user_id = $1`, [a.id]);
  r = await start(a, 'warung'); assert.equal(r.body.error.code, 'sick');
  await db.query(`update pets set sick_at = null, energi = 40, sleep_from = now(), needs_at = now() where user_id = $1`, [a.id]);
  r = await start(a, 'warung'); assert.equal(r.body.error.code, 'asleep');
  await db.query(`update pets set sleep_from = null, energi = 70, needs_at = now() where user_id = $1`, [a.id]);
  // lama kerja harus salah satu pilihan
  r = await start(a, 'warung', 45); assert.equal(r.body.error.code, 'invalid');

  // Ronda: hanya mulai 19.00–23.00 jam setempat (WIB / WITA / WIT dari HP)
  const b = await player('Kopi', 6);
  setKerjaClock(() => WIB(12));
  r = await start(b, 'ronda', 480, { tz: 420 }); assert.equal(r.status, 400); assert.equal(r.body.error.code, 'ronda_closed'); assert.match(r.body.error.message, /19\.00–23\.00/);
  setKerjaClock(() => WIB(18)); // 18.00 WIB = 19.00 WITA
  r = await start(b, 'ronda', 480, { tz: 420 }); assert.equal(r.body.error.code, 'ronda_closed');
  r = await start(b, 'ronda', 999, { tz: 480 }); assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.kerja.shift.job, 'ronda'); assert.equal(r.body.kerja.shift.minutes, 480, 'ronda selalu 8 jam');
  setKerjaClock(() => WIB(23)); // 23.00 tepat sudah tutup
  const c = await player('Lupis', 6);
  r = await start(c, 'ronda', 480, { tz: 420 }); assert.equal(r.body.error.code, 'ronda_closed');

  // batas 12 jam per hari: shift selesai dihitung penuh, dipanggil pulang dihitung lama kerjanya
  const d = await player('Onde');
  await db.query(`insert into pet_jobs (user_id, job, minutes, day, started_at, ends_at, status) values ($1,'warung',480,$2::date,now(),now(),'claimed'), ($1,'kebun',180,$2::date,now(),now(),'recalled')`, [d.id, (await import('../src/lib/core')).today()]);
  await db.query(`update pet_jobs set worked_minutes = 100 where user_id = $1 and status = 'recalled'`, [d.id]);
  r = await start(d, 'warung', 180); assert.equal(r.body.error.code, 'daily_cap'); assert.match(r.body.error.message, /12 jam sehari/);
  r = await start(d, 'warung', 60); assert.equal(r.status, 200, '480 + 100 + 60 ≤ 720 menit');
  assert.equal(r.body.kerja.usedMinutes, 640);

  // mulai: shift berjalan, tubuh pet ditandai kerja, tidak bisa mulai lagi
  r = await start(a, 'warung', 60);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.kerja.shift.job, 'warung'); assert.equal(r.body.kerja.shift.done, false);
  assert.equal(r.body.kerja.shift.pay, undefined, 'gaji belum diumumkan sebelum pulang');
  assert.equal(r.body.pet.work.job, 'warung');
  r = await start(a, 'kebun', 60); assert.equal(r.body.error.code, 'working');
  const me = (await a.c.get('/api/me')).body;
  assert.equal(me.kerja.shift.job, 'warung', 'shift ikut di /api/me');
  // kerja sambilan ditutup admin: tidak bisa mulai
  await setKerja({ on: false });
  r = await start(d, 'warung', 60); assert.equal(r.body.error.code, 'kerja_off');
});

test('selama kerja: aksi yang butuh pet ditolak dengan pesan ramah; belanja, Atur, Tas & teman tetap bisa', async () => {
  const a = await player('Mochi'), b = await player('Kopi');
  assert.equal((await b.c.post('/api/friends', { code: a.code })).status, 200);
  await a.c.post('/api/shop/buy', { itemId: 'pisang-goreng', qty: 2 });
  assert.equal((await start(a, 'warung', 180)).status, 200);
  const blocked = async (r: { status: number; body: any }, what: string) => {
    assert.equal(r.status, 400, `${what}: ${JSON.stringify(r.body)}`);
    assert.equal(r.body.error.code, 'working', what);
    assert.match(r.body.error.message, /Mochi sedang jaga warung di Pasar Pagi\..*panggil pulang/, what);
    assert.ok(r.body.error.kerja?.until > Date.now(), `${what}: jam pulang ikut dikirim`);
  };
  await blocked(await a.c.post('/api/action', { type: 'makan', itemId: 'pisang-goreng' }), 'makan (Tas › Beri)');
  await blocked(await a.c.post('/api/action', { type: 'mandi' }), 'mandi');
  await blocked(await a.c.post('/api/action', { type: 'main' }), 'main');
  await blocked(await a.c.post('/api/action', { type: 'elus' }), 'elus');
  await blocked(await a.c.post('/api/sleep', { on: true }), 'tidur');
  await blocked(await a.c.post('/api/activity', { activityId: 'tidur-kasur', roomId: a.room, index: 0, itemId: 'kasur-rotan', etaMs: 0 }), 'perabot');
  await blocked(await a.c.post('/api/activity', { activityId: 'lihat-jendela', roomId: a.room, spot: 'jendela' }), 'jendela');
  await blocked(await a.c.get(`/api/visit/${b.id}`), 'berkunjung');
  await blocked(await a.c.post(`/api/visit/${b.id}/claim`), 'hadiah kunjungan');
  await blocked(await a.c.post(`/api/visit/${b.id}/act`, { kind: 'sapa' }), 'main dengan pet teman');
  await blocked(await a.c.post('/api/fish/cast', { distance: 'dekat' }), 'mancing');
  await blocked(await a.c.post('/api/games/memori/start'), 'mini-game');
  await blocked(await a.c.post('/api/karung/start'), 'lomba karung');
  await blocked(await a.c.post('/api/duels', { game: 'bakiak', friendId: b.id }), 'duel');
  await blocked(await a.c.post('/api/square/act', { kind: 'nonton' }), 'alun-alun');
  await blocked(await a.c.post('/api/bareng/start', { game: 'catur', place: 'alun' }), 'main bareng');
  const sq = await a.c.post('/api/square/sync', {});
  assert.equal(sq.body.live, false); assert.equal(sq.body.reason, 'working', 'tidak bisa masuk alun-alun');
  const hs = await a.c.post(`/api/house/${b.id}/sync`, {});
  assert.equal(hs.body.live, false); assert.equal(hs.body.reason, 'working', 'tidak bisa masuk rumah teman');
  // yang tetap boleh: belanja, Atur, Tas (pakaian), tugas, daftar teman, kebun, sapu remah
  assert.equal((await a.c.post('/api/shop/buy', { itemId: 'es-teh' })).status, 200, 'belanja');
  const room = (await a.c.get('/api/me')).body.rooms[0];
  assert.equal((await a.c.post('/api/room', { roomId: room.id, layout: room.layout, version: room.version })).status, 200, 'Atur rumah');
  assert.equal((await a.c.get('/api/quests')).status, 200, 'Tugas');
  assert.equal((await a.c.get('/api/friends')).status, 200, 'Teman');
  assert.equal((await a.c.post('/api/garden/plant', { slot: 0, seedId: 'bibit-tomat' })).status, 200, 'Kebun');
});

test('panggil pulang: gaji sebanding lama kerja (termasuk bonus pangkat), tanpa bonus, tidak dihitung pangkat', async () => {
  await setKerja(job('warung', { pct: 100, items: ['es-teh'] }));
  const a = await player('Mochi');
  await setProgress(a, 'warung', 5); // Karyawan: +10%
  assert.equal((await start(a, 'warung', 180)).status, 200);
  const shift = await db.one(`select * from pet_jobs where user_id = $1 and status = 'working'`, [a.id]);
  assert.equal(shift.pay, 55, '50 koin + 10% (Karyawan)');
  // sudah kerja separuh waktu
  await db.query(`update pet_jobs set started_at = now() - interval '90 minutes', ends_at = now() + interval '90 minutes' where id = $1`, [shift.id]);
  await db.query(`update pets set work_until = now() + interval '90 minutes' where user_id = $1`, [a.id]);
  const before = await coins(a), esBefore = await qty(a, 'es-teh');
  const r = await a.c.post('/api/kerja/recall', { requestId: 'recall-1234567' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.body.result.paid >= 27 && r.body.result.paid <= 28, `gaji separuh: ${r.body.result.paid}`);
  assert.equal(await coins(a), before + r.body.result.paid);
  assert.equal(await qty(a, 'es-teh'), esBefore, 'tanpa barang bonus');
  assert.equal((await db.one(`select shifts from pet_job_progress where user_id = $1 and job = 'warung'`, [a.id])).shifts, 5, 'tidak dihitung untuk pangkat');
  const row = await db.one(`select status, worked_minutes, paid from pet_jobs where id = $1`, [shift.id]);
  assert.equal(row.status, 'recalled'); assert.ok(row.worked_minutes >= 90 && row.worked_minutes <= 91);
  // biaya kebutuhan sebanding (separuh dari −15 energi / −12 kenyang)
  const pet = r.body.pet;
  assert.equal(pet.work, null, 'pet sudah di rumah');
  assert.ok(Math.abs(pet.needs.energi - (70 - 8)) <= 1, `energi ${pet.needs.energi}`);
  assert.ok(Math.abs(pet.needs.kenyang - (70 - 6)) <= 1, `kenyang ${pet.needs.kenyang}`);
  assert.equal(r.body.kerja.shift, null);
  assert.equal(r.body.kerja.usedMinutes, row.worked_minutes, 'batas harian menghitung lama kerja sebenarnya');
  // tidak ada yang bisa dipanggil lagi; aksi rawat pet bisa lagi
  assert.equal((await a.c.post('/api/kerja/recall', {})).body.error.code, 'not_working');
  assert.equal((await a.c.post('/api/action', { type: 'elus' })).status, 200);
});

test('terima gaji: dibayar sekali (idempotent), XP, bonus, naik pangkat & seragam sekali saja, lalu +10% gaji', async () => {
  await setKerja(job('warung', { pct: 100, items: ['es-teh'] }));
  const a = await player('Mochi');
  await setProgress(a, 'warung', 4);
  assert.equal((await start(a, 'warung', 60)).status, 200);
  // belum pulang: belum bisa diterima
  assert.equal((await a.c.post('/api/kerja/claim', {})).body.error.code, 'not_done');
  await finish(a);
  const me = (await a.c.get('/api/me')).body;
  assert.equal(me.kerja.shift.done, true);
  assert.equal(me.kerja.shift.pay, 20); assert.equal(me.kerja.shift.xp, 4); assert.equal(me.kerja.shift.bonus, 'es-teh');
  assert.match(me.kerja.shift.story, /Mochi/, 'cerita memakai nama pet');
  assert.equal(me.kerja.shift.rank.up, true); assert.equal(me.kerja.shift.rank.after, 'karyawan');
  assert.deepEqual(me.kerja.shift.uniform, ['celemek-warung'], 'kartu menampilkan seragam yang akan didapat');
  const c0 = await coins(a), xp0 = (await db.one(`select level, xp from pets where user_id = $1`, [a.id]));
  const r1 = await a.c.post('/api/kerja/claim', { requestId: 'claim-aaaaaaaa' });
  assert.equal(r1.status, 200, JSON.stringify(r1.body));
  assert.equal(r1.body.result.pay, 20);
  assert.equal(await coins(a), c0 + 20);
  assert.equal(await qty(a, 'es-teh'), 1, 'barang bonus masuk Tas');
  assert.equal(await qty(a, 'celemek-warung'), 1, 'seragam warung didapat saat jadi Karyawan');
  assert.deepEqual(r1.body.result.uniform, ['celemek-warung']);
  assert.equal(r1.body.result.rank.after, 'karyawan');
  const xp1 = await db.one(`select level, xp from pets where user_id = $1`, [a.id]);
  assert.ok(xp1.level > xp0.level || xp1.xp === xp0.xp + 4, 'XP bertambah');
  // ulangi requestId yang sama: jawaban sama, tidak dibayar dua kali
  const r2 = await a.c.post('/api/kerja/claim', { requestId: 'claim-aaaaaaaa' });
  assert.deepEqual(r2.body.result, r1.body.result);
  assert.equal(await coins(a), c0 + 20);
  // permintaan baru: tidak ada gaji lagi
  assert.equal((await a.c.post('/api/kerja/claim', { requestId: 'claim-bbbbbbbb' })).body.error.code, 'nothing');
  assert.equal((await db.one(`select status from pet_jobs where user_id = $1`, [a.id])).status, 'claimed');

  // shift berikutnya: gaji Karyawan +10%, seragam tidak diberikan lagi
  assert.equal((await start(a, 'warung', 60)).status, 200);
  await finish(a);
  const r3 = await a.c.post('/api/kerja/claim', { requestId: 'claim-cccccccc' });
  assert.equal(r3.body.result.pay, 22, '20 + 10%');
  assert.equal(r3.body.result.uniform, null);
  assert.equal(await qty(a, 'celemek-warung'), 1, 'seragam hanya sekali');
  // seragam tidak dijual di toko
  assert.equal((await a.c.post('/api/shop/buy', { itemId: 'celemek-warung' })).body.error.code, 'not_for_sale');
  // papan lowongan menampilkan pangkat & gaji sesuai pangkat
  const board = (await a.c.get('/api/kerja')).body;
  const w = board.jobs.find((x: any) => x.id === 'warung');
  assert.equal(w.rank.key, 'karyawan'); assert.equal(w.rank.shifts, 6); assert.equal(w.options[0].pay, 22); assert.equal(w.uniform.got, true);
  assert.equal(board.jobs.find((x: any) => x.id === 'ronda').window.fromHour, 19);
});

test('kebutuhan beku selama kerja, biaya tetap saat pulang (kebun juga Bersih), dan tidak sakit karena dibiarkan', async () => {
  const a = await player('Mochi');
  await db.query(`update pets set energi = 80, kenyang = 70, bersih = 60, ceria = 50, needs_at = now() where user_id = $1`, [a.id]);
  assert.equal((await start(a, 'kebun', 180)).status, 200);
  // seolah 2 jam berlalu: kebutuhan tetap
  await db.query(`update pets set needs_at = now() - interval '2 hours' where user_id = $1`, [a.id]);
  let pet = (await a.c.get('/api/me')).body.pet;
  assert.deepEqual([pet.needs.energi, pet.needs.kenyang, pet.needs.bersih, pet.needs.ceria].map(Math.round), [80, 70, 60, 50], 'tidak turun selama kerja');
  assert.ok(pet.work && pet.work.cost.bersih === -15, 'biaya bersih untuk kebun ikut dikirim');
  // dibiarkan lama dengan kebutuhan rendah: tidak sakit selama kerja (juga oleh pekerjaan latar)
  await db.query(`update pets set energi = 26, kenyang = 26, bersih = 5, ceria = 5, needs_at = now() - interval '20 hours' where user_id = $1`, [a.id]);
  await runJobs(db);
  pet = (await a.c.get('/api/me')).body.pet;
  assert.equal(pet.sick, false);
  assert.equal((await db.one(`select sick_at from pets where user_id = $1`, [a.id])).sick_at, null);
  // pulang: biaya 3 jam dikenakan sekali (energi −15, kenyang −12, bersih −15), lalu turun biasa lagi
  await db.query(`update pets set energi = 80, kenyang = 70, bersih = 60, ceria = 50 where user_id = $1`, [a.id]);
  await finish(a);
  pet = (await a.c.get('/api/me')).body.pet;
  assert.equal(pet.work, null);
  assert.ok(Math.abs(pet.needs.energi - 65) < 0.5 && Math.abs(pet.needs.kenyang - 58) < 0.5 && Math.abs(pet.needs.bersih - 45) < 0.5, JSON.stringify(pet.needs));
  assert.ok(pet.needs.ceria < 50 && pet.needs.ceria > 49.5, 'setelah pulang turun biasa (1 menit)');
  await a.c.post('/api/kerja/claim', {});
  const row = await db.one(`select energi, kenyang, bersih, work_until, needs_at from pets where user_id = $1`, [a.id]);
  assert.equal(row.work_until, null);
  assert.equal(Math.round(row.energi), 65); assert.equal(Math.round(row.kenyang), 58); assert.equal(Math.round(row.bersih), 45);
  // Ronda: −35 energi, −25 kenyang (pulang pagi mengantuk)
  const b = await player('Kopi', 6);
  setKerjaClock(() => WIB(20));
  await db.query(`update pets set energi = 60, kenyang = 60, needs_at = now() where user_id = $1`, [b.id]);
  assert.equal((await start(b, 'ronda', 480, { tz: 420 })).status, 200);
  await finish(b);
  pet = (await b.c.get('/api/me')).body.pet;
  assert.ok(Math.abs(pet.needs.energi - 25) < 0.5 && Math.abs(pet.needs.kenyang - 35) < 0.5, JSON.stringify(pet.needs));
});

test('pekerjaan latar: notifikasi "sudah pulang kerja" sekali per shift', async () => {
  const a = await player('Mochi');
  assert.equal((await start(a, 'warung', 60)).status, 200);
  await runJobs(db);
  const n0 = (await a.c.get('/api/notifications')).body.items.filter((i: any) => /pulang kerja/.test(i.title));
  assert.equal(n0.length, 0, 'belum pulang');
  await finish(a);
  await runJobs(db);
  await runJobs(db);
  const n = (await a.c.get('/api/notifications')).body.items.filter((i: any) => /pulang kerja/.test(i.title));
  assert.equal(n.length, 1, 'sekali saja');
  assert.equal(n[0].title, 'Mochi sudah pulang kerja');
  assert.match(n[0].body, /bawa gaji/);
  assert.equal(n[0].url, '/#kerja');
});

test('teman berkunjung saat pet tuan rumah kerja: catatan pintu, aksi dengan pet ditolak, perabot tetap bisa dipakai', async () => {
  const a = await player('Mochi'), b = await player('Kopi');
  assert.equal((await b.c.post('/api/friends', { code: a.code })).status, 200);
  assert.equal((await start(a, 'butik', 60)).status, 400, 'Butik Lv 4');
  await db.query(`update pets set level = 4 where user_id = $1`, [a.id]);
  assert.equal((await start(a, 'butik', 60)).status, 200);
  const v = await b.c.get(`/api/visit/${a.id}`);
  assert.equal(v.status, 200);
  assert.equal(v.body.work.job, 'butik'); assert.equal(v.body.work.place, 'Butik Benang'); assert.ok(v.body.work.until > Date.now());
  for (const kind of ['sapa', 'peluk', 'kejar', 'duduk']) {
    await db.query(`delete from cooldowns where user_id = $1`, [b.id]);
    const r = await b.c.post(`/api/visit/${a.id}/act`, { kind });
    assert.equal(r.status, 400, kind); assert.equal(r.body.error.code, 'host_working', kind);
    assert.match(r.body.error.message, /Mochi sedang melipat & menjahit baju di Butik Benang/);
    await new Promise((res) => setTimeout(res, 5));
  }
  // perabot tuan rumah tetap bisa dipakai pet tamu
  const f = await b.c.post(`/api/visit/${a.id}/activity`, { activityId: 'lihat-jendela', roomId: a.room, spot: 'jendela', etaMs: 0 });
  assert.equal(f.status, 200, JSON.stringify(f.body));
  // daftar teman: "Sedang kerja di Butik Benang"
  const fr = (await b.c.get('/api/friends')).body.friends.find((x: any) => x.id === a.id);
  assert.equal(fr.work.short, 'Butik Benang');
  // rumah live: tuan rumah tetap di rumah, tapi petnya tidak tampil (away)
  await a.c.post(`/api/house/${a.id}/sync`, { roomId: a.room, x: 2, y: 2 });
  const hs = await b.c.post(`/api/house/${a.id}/sync`, { roomId: a.room, x: 3, y: 3 });
  assert.equal(hs.body.live, true);
  assert.equal(hs.body.members.find((m: any) => m.id === a.id)?.away, true);
});

test('tugas & lencana: kerja dihitung saat gaji diterima; lencana Kepala', async () => {
  const a = await player('Mochi');
  await setProgress(a, 'kebun', 39);
  assert.equal((await start(a, 'kebun', 60)).status, 200);
  await finish(a);
  const r = await a.c.post('/api/kerja/claim', {});
  assert.equal(r.body.result.rank.after, 'kepala');
  const q = (await a.c.get('/api/quests')).body;
  const badge = (id: string) => q.badges.find((b: any) => b.id === id);
  assert.equal(badge('b-kerja-10').progress, 1);
  assert.equal(badge('b-kerja-50').target, 50); assert.equal(badge('b-kerja-100').target, 100);
  assert.equal(badge('b-kepala').done, true, 'Kepala');
  // tugas harian ada di kumpulan tugas harian (dihitung bila terpilih hari ini)
  const h = await db.one(`select event, target, kind from quests where id = 'h-kerja'`);
  assert.deepEqual(h, { event: 'kerja', target: 1, kind: 'daily' });
  const prog = await db.one(`select progress from quest_progress where user_id = $1 and quest_id = 'h-kerja'`, [a.id]);
  const daily = q.daily.map((x: any) => x.id);
  if (daily.includes('h-kerja')) assert.equal(prog?.progress, 1);
  // dipanggil pulang tidak dihitung
  assert.equal((await start(a, 'kebun', 60)).status, 200);
  await a.c.post('/api/kerja/recall', {});
  assert.equal((await a.c.get('/api/quests')).body.badges.find((b: any) => b.id === 'b-kerja-10').progress, 1);
});

test('admin: pengaturan kerja divalidasi & bisa diperpendek untuk uji', async () => {
  const adm = client();
  assert.equal((await adm.post('/api/admin/login', { email: 'owner@test.local', password: 'rahasia-sekali-123' })).status, 200);
  const cur = (await adm.get('/api/admin/settings')).body.value;
  assert.ok(cur.kerja && (await adm.get('/api/admin/settings')).body.help.kerja.includes('MENIT'));
  const put = (k: Record<string, unknown>) => adm.put('/api/admin/settings', { value: { ...cur, kerja: { ...cur.kerja, ...k } } });
  let r = await put({ minutes: [60, 30, 480] });
  assert.equal(r.status, 400); assert.match(r.body.error.message, /Kerja sambilan: minutes harus naik/);
  r = await put({ minutes: [60, 180] }); assert.equal(r.status, 400);
  r = await put({ jobs: { ...cur.kerja.jobs, warung: { ...cur.kerja.jobs.warung, bonusItems: ['tidak-ada'] } } });
  assert.equal(r.status, 400); assert.match(r.body.error.message, /item tidak dikenal \(tidak-ada\)/);
  r = await put({ ronda: { ...cur.kerja.ronda, fromHour: 20, toHour: 20 } }); assert.equal(r.status, 400);
  r = await put({ rankAt: { karyawan: 10, senior: 5, kepala: 40 } }); assert.equal(r.status, 400);
  r = await put({ stories: { ...cur.kerja.stories, kolam: [] } }); assert.equal(r.status, 400);
  r = await put({ maxHoursPerDay: 0 }); assert.equal(r.status, 400);
  // lama kerja dalam menit: bisa diperpendek (uji e2e)
  r = await put({ minutes: [1, 2, 3], ronda: { ...cur.kerja.ronda, minutes: 2 } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  invalidateCaches();
  const a = await player('Mochi');
  const s = await start(a, 'warung', 2);
  assert.equal(s.status, 200);
  assert.ok(s.body.kerja.shift.endsAt - s.body.kerja.shift.startedAt === 120_000);
  // katalog umum: kerja nyala + syarat (tanpa angka cerita)
  const cat = (await a.c.get('/api/catalog')).body;
  assert.equal(cat.settings.kerja.on, true); assert.equal(cat.settings.kerja.minEnergi, 25); assert.equal(cat.settings.kerja.stories, undefined);
});

test('paket 21: seragam, Papan Lowongan & Pos Ronda, tugas & lencana; sekali saja & tidak menimpa ubahan admin', async () => {
  for (const u of KERJA_UNIFORMS) {
    const it = await db.one(`select kind, shop, price_coin, price_pearl, sell_coin, data from items where id = $1`, [u.id]);
    assert.equal(it.kind, 'wear'); assert.equal(it.shop, null); assert.equal(it.price_coin + it.price_pearl + it.sell_coin, 0, `${u.id} tidak dijual`);
    assert.equal(it.data.slot, u.slot);
  }
  const loc = await db.query(`select id, kind from locations where id in ('lowongan', 'ronda') order by id`);
  assert.deepEqual(loc, [{ id: 'lowongan', kind: 'jobs' }, { id: 'ronda', kind: 'ronda' }]);
  assert.ok(Number((await db.one(`select value from settings where key = 'content_pack'`)).value) >= 21);
  // ubahan admin
  await db.query(`update items set name = 'Celemek Ubahan' where id = 'celemek-warung'`);
  await db.query(`update locations set x = 1170 where id = 'lowongan'`);
  await db.query(`update quests set reward_coin = 99 where id = 'h-kerja'`);
  await db.query(`delete from settings where key = 'pack_kerja'`);
  const v0 = Number((await db.one(`select value from settings where key = 'catalog_version'`)).value);
  assert.equal(await seedPackV21(db), true);
  assert.ok(Number((await db.one(`select value from settings where key = 'catalog_version'`)).value) > v0, 'versi katalog naik');
  assert.equal((await db.one(`select name from items where id = 'celemek-warung'`)).name, 'Celemek Ubahan');
  assert.equal((await db.one(`select x from locations where id = 'lowongan'`)).x, 1170);
  assert.equal((await db.one(`select reward_coin from quests where id = 'h-kerja'`)).reward_coin, 99);
  assert.equal(await seedPackV21(db), false, 'sekali saja');
  await db.query(`update locations set x = 1160 where id = 'lowongan'`);
  invalidateCaches();
});
