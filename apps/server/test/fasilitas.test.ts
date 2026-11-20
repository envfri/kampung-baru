// Fasilitas rumah teman: pet tamu memakai perabot tuan rumah (efek ke pet tamu, cooldown & batas harian sama dengan di
// rumah), syarat (teman, tidak diantar pulang, admin & tuan rumah mengizinkan, pet bangun), satu pet per perabot,
// tip & buku tamu untuk tuan rumah, dan pose aktivitas di sinkron rumah live.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config';

config.paymentProvider = 'mock';
config.adminEmail = 'owner@test.local';
config.adminPassword = 'rahasia-sekali-123';
const { buildApp } = await import('../src/app');
const { resetHouses } = await import('../src/routes/house');
const { resetFurniture, ageFurniture } = await import('../src/lib/facility');
const { ACTIVITY_ANIMS } = await import('@kb/shared');
let app: any;
let db: any;
before(async () => { ({ app, db } = await buildApp({ memoryDb: true, logger: false, rateLimit: false, worker: false })); });
after(async () => app?.close());
beforeEach(() => { resetFurniture(); resetHouses(); });

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
// kamar tiap pemain: kasur (0), sofa (1), pot tanaman (2), bak mandi (3), kulkas (4)
const LAYOUT = [{ i: 'kasur-rotan', x: 4, y: 0 }, { i: 'sofa-santai', x: 0, y: 0 }, { i: 'pot-monstera', x: 0, y: 4 }, { i: 'bak-mandi', x: 2, y: 4 }, { i: 'kulkas-mini', x: 5, y: 3 }];
const IDX = { kasur: 0, sofa: 1, pot: 2, bak: 3, kulkas: 4 } as const;
async function player(pet: string): Promise<P> {
  const c = client();
  await c.post('/api/auth/guest');
  const p = await c.post('/api/pet', { name: pet, color: '#F6B7A8', ear: 'tunas' });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  const id = p.body.state.user.id as string, room = p.body.state.rooms[0].id as string;
  await db.query(`update rooms set layout = $2::text::jsonb where id = $1`, [room, JSON.stringify(LAYOUT)]);
  // kebutuhan di tengah supaya efek aktivitas terlihat utuh
  await db.query(`update pets set kenyang = 50, bersih = 40, ceria = 50, energi = 60, needs_at = now() where user_id = $1`, [id]);
  return { c, id, code: p.body.state.user.friend_code, room, pet };
}
async function friends(host: P, ...others: P[]) { for (const o of others) assert.equal((await o.c.post('/api/friends', { code: host.code })).status, 200); }
const setVisit = async (patch: Record<string, unknown>) => {
  const row = await db.one(`select value from settings where key = 'game'`);
  const v = row?.value ?? {};
  v.visit = { ...(v.visit ?? {}), ...patch };
  await db.query(`insert into settings (key, value) values ('game', $1::text::jsonb) on conflict (key) do update set value = excluded.value`, [JSON.stringify(v)]);
  (await import('../src/lib/core')).invalidateCaches();
};
const FAC = { on: true, hostCoins: 1, hostMaxPerDay: 10 };
/** pakai perabot di rumah teman */
const use = (g: P, host: P, activityId: string, at: keyof typeof IDX | { spot: string }, extra: Record<string, unknown> = {}) =>
  g.c.post(`/api/visit/${host.id}/activity`, { activityId, roomId: host.room, ...(typeof at === 'string' ? { index: IDX[at], itemId: LAYOUT[IDX[at]].i } : at), etaMs: 0, ...extra });
/** pakai perabot di rumah sendiri */
const home = (p: P, activityId: string, at: keyof typeof IDX, extra: Record<string, unknown> = {}) =>
  p.c.post('/api/activity', { activityId, roomId: p.room, index: IDX[at], etaMs: 0, ...extra });
const clearCool = (p: P) => db.query(`delete from cooldowns where user_id = $1 and key like 'act:%'`, [p.id]);
const coins = async (p: P) => (await db.one(`select coin from wallets where user_id = $1`, [p.id])).coin as number;

test('tamu memakai perabot teman: efek, XP & koin ke pet tamu; cooldown & batas harian sama dengan di rumah (dua arah)', async () => {
  const a = await player('Mochi'), b = await player('Kopi');
  await friends(a, b);
  const v = await b.c.get(`/api/visit/${a.id}`);
  assert.deepEqual(v.body.facility, { on: true, reason: null });
  const hostBefore = await db.one(`select bersih, ceria from pets where user_id = $1`, [a.id]);
  const r = await use(b, a, 'berendam', 'bak');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.result.gained.bersih, 45, 'Bersih pet tamu naik penuh');
  assert.equal(r.body.result.gained.ceria, 4);
  assert.match(r.body.result.message, /^Kopi /, 'pesan memakai nama pet tamu');
  assert.ok(r.body.pet.needs.bersih >= 84, 'patch berisi pet tamu');
  assert.equal(r.body.pet.name, 'Kopi');
  const hostAfter = await db.one(`select bersih, ceria from pets where user_id = $1`, [a.id]);
  assert.deepEqual(hostAfter, hostBefore, 'pet tuan rumah tidak berubah');
  // cooldown sama dengan di rumah: tamu tidak bisa berendam lagi di rumahnya sendiri
  const again = await home(b, 'berendam', 'bak');
  assert.equal(again.body.error?.code, 'cooldown');
  assert.ok(again.body.error.retryInSec > 500);
  // arah sebaliknya: duduk di sofa sendiri dulu, lalu di sofa teman
  assert.equal((await home(b, 'duduk-santai', 'sofa')).status, 200);
  const sofa = await use(b, a, 'duduk-santai', 'sofa');
  assert.equal(sofa.body.error?.code, 'cooldown');
  // batas harian (Ambil camilan: 3 per hari) juga dihitung bersama
  for (let i = 0; i < 2; i++) { await clearCool(b); assert.equal((await home(b, 'ambil-camilan', 'kulkas')).status, 200); }
  await clearCool(b);
  assert.equal((await use(b, a, 'ambil-camilan', 'kulkas')).status, 200, 'jatah ke-3 di rumah teman');
  await clearCool(b);
  assert.equal((await use(b, a, 'ambil-camilan', 'kulkas')).body.error?.code, 'daily_limit');
  await clearCool(b);
  assert.equal((await home(b, 'ambil-camilan', 'kulkas')).body.error?.code, 'daily_limit');
  // koin aktivitas (siram tanaman) masuk ke dompet tamu, XP ke pet tamu
  const c0 = await coins(b), xp0 = (await db.one(`select xp from pets where user_id = $1`, [b.id])).xp;
  const w = await use(b, a, 'siram-tanaman', 'pot');
  assert.equal(w.status, 200, JSON.stringify(w.body));
  assert.equal(w.body.wallet.coin, c0 + w.body.result.coins);
  assert.ok(w.body.result.coins > 0);
  assert.ok((await db.one(`select xp from pets where user_id = $1`, [b.id])).xp > xp0 || w.body.pet.level > 1);
  // tugas: dicatat sebagai aktivitas (dengan rumah tempatnya)
  const ev = await db.one(`select count(*)::int c from analytics_events where user_id = $1 and name = 'activity' and props->>'host' = $2`, [b.id, a.id]);
  assert.equal(ev.c, 3);
});

test('syarat: harus berteman, tidak diantar pulang, admin & tuan rumah mengizinkan, perabot cocok, pet bangun', async () => {
  const a = await player('Rumah'), b = await player('Tamu'), x = await player('Asing');
  await friends(a, b);
  assert.equal((await use(x, a, 'duduk-santai', 'sofa')).status, 403, 'bukan teman');
  assert.equal((await a.c.post(`/api/visit/${a.id}/activity`, { activityId: 'duduk-santai', roomId: a.room, index: 1, itemId: 'sofa-santai' })).body.error?.code, 'own_house');
  // diantar pulang
  await a.c.post(`/api/house/${a.id}/sync`, { roomId: a.room, x: 1, y: 1 });
  assert.equal((await a.c.post(`/api/house/${a.id}/kick`, { userId: b.id })).status, 200);
  assert.equal((await use(b, a, 'duduk-santai', 'sofa')).status, 403, 'tamu yang diantar pulang ditolak');
  resetHouses();
  // tuan rumah mematikan izin di Pengaturan
  const off = await a.c.post('/api/me/privacy', { facilityVisits: false });
  assert.equal(off.body.facilityVisits, false);
  assert.equal((await a.c.get('/api/me')).body.user.facility_visits, false);
  assert.deepEqual((await b.c.get(`/api/visit/${a.id}`)).body.facility, { on: false, reason: 'host' });
  const h = await use(b, a, 'duduk-santai', 'sofa');
  assert.equal(h.status, 403);
  assert.equal(h.body.error.code, 'facility_host_off');
  assert.match(h.body.error.message, /belum mengizinkan/);
  await a.c.post('/api/me/privacy', { facilityVisits: true });
  // admin mematikan fasilitas, atau kunjungan bareng
  await setVisit({ facility: { ...FAC, on: false } });
  assert.deepEqual((await b.c.get(`/api/visit/${a.id}`)).body.facility, { on: false, reason: 'admin' });
  assert.equal((await use(b, a, 'duduk-santai', 'sofa')).body.error?.code, 'facility_off');
  await setVisit({ facility: FAC, together: false });
  assert.equal((await use(b, a, 'duduk-santai', 'sofa')).body.error?.code, 'facility_off');
  await setVisit({ together: true });
  // denah di layar tamu usang: perabot di indeks itu bukan yang diketuk
  const moved = await b.c.post(`/api/visit/${a.id}/activity`, { activityId: 'duduk-santai', roomId: a.room, index: IDX.sofa, itemId: 'kasur-rotan' });
  assert.equal(moved.status, 400);
  assert.equal(moved.body.error.code, 'furniture_moved');
  assert.equal((await b.c.post(`/api/visit/${a.id}/activity`, { activityId: 'duduk-santai', roomId: a.room, index: 40, itemId: 'sofa-santai' })).body.error?.code, 'furniture_moved');
  assert.equal((await b.c.post(`/api/visit/${a.id}/activity`, { activityId: 'duduk-santai', roomId: a.room, index: IDX.sofa })).status, 400, 'id perabot wajib');
  // aktivitas yang tidak cocok dengan perabotnya
  assert.equal((await use(b, a, 'berendam', 'sofa')).body.error?.code, 'invalid_target');
  // "Tidur sampai segar" (lampu mati) bukan aktivitas perabot: hanya di rumah sendiri
  assert.equal((await use(b, a, '__sleep', 'kasur')).body.error?.code, 'invalid_activity');
  // pet tamu sedang tidur
  await db.query(`update pets set energi = 10, needs_at = now(), sleep_from = now() where user_id = $1`, [b.id]);
  const z = await use(b, a, 'duduk-santai', 'sofa');
  assert.equal(z.body.error?.code, 'asleep');
  await db.query(`update pets set energi = 60, sleep_from = null where user_id = $1`, [b.id]);
  // jendela (bagian ruangan) juga bisa dipakai
  const win = await use(b, a, 'lihat-jendela', { spot: 'jendela' });
  assert.equal(win.status, 200, JSON.stringify(win.body));
  assert.equal((await use(b, a, 'duduk-santai', 'sofa')).status, 200, 'setelah semua syarat terpenuhi: boleh');
});

test('satu pet per perabot (tidur, duduk, berendam, ...): tamu lain & tuan rumah ditolak selama dipakai, boleh lagi setelah selesai', async () => {
  const a = await player('Mochi'), b = await player('Kopi'), c = await player('Onde');
  await friends(a, b, c);
  assert.equal((await use(b, a, 'duduk-santai', 'sofa')).status, 200);
  const busy = await use(c, a, 'duduk-santai', 'sofa');
  assert.equal(busy.status, 400);
  assert.equal(busy.body.error.code, 'occupied');
  assert.equal(busy.body.error.message, 'Sofa Santai sedang dipakai Kopi.');
  // tuan rumah di rumahnya sendiri juga menunggu
  const hostBusy = await home(a, 'duduk-santai', 'sofa');
  assert.equal(hostBusy.body.error?.code, 'occupied');
  assert.match(hostBusy.body.error.message, /dipakai Kopi/);
  // ditolak tidak memakai cooldown / jatah
  assert.ok(!(await db.one(`select 1 from cooldowns where user_id = $1 and key = 'act:duduk-santai'`, [c.id])));
  // aktivitas di dekat mebel (siram, lihat jendela) boleh bersamaan
  assert.equal((await use(b, a, 'siram-tanaman', 'pot')).status, 200);
  assert.equal((await use(c, a, 'siram-tanaman', 'pot')).status, 200);
  assert.equal((await use(b, a, 'lihat-jendela', { spot: 'jendela' })).status, 200);
  assert.equal((await use(c, a, 'lihat-jendela', { spot: 'jendela' })).status, 200);
  // waktu pakai habis (jalan + animasi + jeda): tamu lain boleh
  ageFurniture(60_000);
  assert.equal((await use(c, a, 'duduk-santai', 'sofa')).status, 200);
  assert.match((await home(a, 'duduk-santai', 'sofa')).body.error?.message ?? '', /dipakai Onde/);
  ageFurniture(60_000);
  assert.equal((await home(a, 'duduk-santai', 'sofa')).status, 200, 'tuan rumah boleh setelah tamu selesai');
  // sebaliknya: tuan rumah berendam di rumahnya → tamu menunggu
  assert.equal((await home(a, 'berendam', 'bak')).status, 200);
  const bak = await use(b, a, 'berendam', 'bak');
  assert.equal(bak.body.error?.code, 'occupied');
  assert.equal(bak.body.error.message, 'Bak Mandi sedang dipakai Mochi.');
  // perabot yang sama di rumah lain tidak terpengaruh
  assert.equal((await home(b, 'berendam', 'bak')).status, 200);
  // lama tanda = perkiraan jalan (maks 5 dtk) + animasi + jeda; tanpa perkiraan dianggap 5 dtk
  const { occupyMs } = await import('../src/lib/facility');
  assert.equal(occupyMs(2400, 0), 2400 + 1500);
  assert.equal(occupyMs(2400, 99_999), 5000 + 2400 + 1500);
  assert.equal(occupyMs(2400, undefined), 5000 + 2400 + 1500);
});

test('tuan rumah dapat tip koin (dibatasi per hari), catatan buku tamu & notifikasi; permintaan ulang tidak dihitung dua kali', async () => {
  await setVisit({ facility: { on: true, hostCoins: 2, hostMaxPerDay: 3 } });
  const a = await player('Rumah'), b = await player('Kopi'), c = await player('Onde');
  await friends(a, b, c);
  const c0 = await coins(a);
  const r1 = await use(b, a, 'duduk-santai', 'sofa', { requestId: 'fasilitas-uji-01' });
  assert.equal(r1.status, 200, JSON.stringify(r1.body));
  assert.equal(r1.body.hostTip, 2);
  assert.equal(await coins(a), c0 + 2);
  // permintaan yang sama dikirim ulang (sinyal lemah): jawaban sama, tanpa tip / catatan baru
  const r1b = await use(b, a, 'duduk-santai', 'sofa', { requestId: 'fasilitas-uji-01' });
  assert.deepEqual(r1b.body.result, r1.body.result);
  assert.equal(await coins(a), c0 + 2);
  assert.equal((await use(b, a, 'siram-tanaman', 'pot')).body.hostTip, 2);
  assert.equal((await use(c, a, 'lihat-jendela', { spot: 'jendela' })).body.hostTip, 2);
  const r4 = await use(c, a, 'siram-tanaman', 'pot');
  assert.equal(r4.status, 200);
  assert.equal(r4.body.hostTip, 0, 'batas tip per hari tercapai');
  assert.equal(await coins(a), c0 + 6);
  const led = await db.one(`select count(*)::int n from wallet_ledger where user_id = $1 and reason = 'facility_tip'`, [a.id]);
  assert.equal(led.n, 3);
  // buku tamu
  const gb = (await a.c.get('/api/guestbook')).body.entries;
  assert.equal(gb.length, 4);
  const sofa = gb.find((e: any) => e.activity_id === 'duduk-santai');
  assert.equal(sofa.kind, 'perabot');
  assert.equal(sofa.item_id, 'sofa-santai');
  assert.equal(sofa.visitor_id, b.id);
  assert.equal(sofa.pet_name, 'Kopi');
  assert.ok(gb.some((e: any) => e.item_id === 'spot:jendela' && e.activity_id === 'lihat-jendela'));
  assert.ok((await b.c.get(`/api/visit/${a.id}`)).body.guestbook.length >= 4, 'terakhir mampir di kartu rumah');
  // notifikasi: satu per tamu per jam (dua tamu → dua)
  const n = await db.query(`select title, body from notifications where user_id = $1 and url = '/#bukutamu' order by created_at`, [a.id]);
  assert.equal(n.length, 2);
  assert.ok(n.some((x: any) => /memakai Sofa Santai, ditemani Rumah/.test(x.body)), JSON.stringify(n));
  await setVisit({ facility: FAC });
});

test('rumah live: semua pose aktivitas (ACTIVITY_ANIMS) tersinkron ke yang lain, aksi asal tetap ditolak', async () => {
  const a = await player('Rumah'), b = await player('Tamu');
  await friends(a, b);
  const sync = (p: P, body: any = {}) => p.c.post(`/api/house/${a.id}/sync`, { roomId: a.room, x: 2, y: 2, ...body });
  await sync(a);
  const seen = async (act: unknown) => { await sync(b, { act, x: 3, y: 4.5 }); return (await sync(a)).body.members.find((m: any) => m.id === b.id)?.act; };
  for (const k of Object.keys(ACTIVITY_ANIMS)) assert.equal(await seen(k), k, `pose ${k} diterima`);
  for (const k of ['sapa', 'duduk', 'jalan']) assert.equal(await seen(k), k, `aksi lama ${k} tetap diterima`);
  for (const junk of ['terbang', 'constructor', '__proto__', 'toString', '<b>x</b>', 'mandi ', 42, { a: 1 }]) assert.equal(await seen(junk), null, `ditolak: ${String(junk)}`);
  // tuan rumah yang beraktivitas di rumahnya terlihat oleh tamu
  await sync(a, { act: 'tidur', x: 5, y: 0.5 });
  const host = (await sync(b)).body.members.find((m: any) => m.host);
  assert.equal(host.act, 'tidur');
});

test('admin: Kunjungan bareng › facility tersimpan di Ekonomi & fitur, nilai salah ditolak, langsung berlaku untuk tamu', async () => {
  const adm = client();
  assert.equal((await adm.post('/api/admin/login', { email: 'owner@test.local', password: 'rahasia-sekali-123' })).status, 200);
  const got = (await adm.get('/api/admin/settings')).body;
  assert.deepEqual(got.defaults.visit.facility, { on: true, hostCoins: 1, hostMaxPerDay: 10 });
  assert.match(got.help.visit, /facility/);
  const cur = got.value;
  for (const f of [{ hostCoins: -1 }, { hostCoins: 1.5 }, { hostMaxPerDay: 5000 }]) {
    const r = await adm.put('/api/admin/settings', { value: { ...cur, visit: { ...cur.visit, facility: { ...cur.visit.facility, ...f } } } });
    assert.equal(r.status, 400, JSON.stringify(f));
    assert.match(r.body.error.message, /facility/);
  }
  const ok = await adm.put('/api/admin/settings', { value: { ...cur, visit: { ...cur.visit, facility: { on: false, hostCoins: 3, hostMaxPerDay: 20 } } } });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.deepEqual((await adm.get('/api/admin/settings')).body.value.visit.facility, { on: false, hostCoins: 3, hostMaxPerDay: 20 });
  const a = await player('Rumah'), b = await player('Tamu');
  await friends(a, b);
  assert.equal((await use(b, a, 'duduk-santai', 'sofa')).body.error?.code, 'facility_off');
  await adm.put('/api/admin/settings', { value: { ...cur, visit: { ...cur.visit, facility: FAC } } });
  (await import('../src/lib/core')).invalidateCaches();
  assert.equal((await use(b, a, 'duduk-santai', 'sofa')).status, 200);
});
