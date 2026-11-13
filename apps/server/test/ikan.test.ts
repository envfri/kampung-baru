// Kolam Pancing v32: peluang per jarak, rahasia tidak bocor, tarik-ulur minimal, batas Mutiara,
// hadiah peti & botol, dan koleksi pemain tetap utuh setelah paket konten 11.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config';

config.adminEmail = 'owner@test.local';
config.adminPassword = 'rahasia-sekali-123';

const { buildApp } = await import('../src/app');
const { openDb, migrate } = await import('../src/db/index');
const seedMod = await import('../src/db/seed');
const { seedQuests } = await import('../src/lib/quests');
const F = await import('../src/lib/fishing');
const { getCatalog, getSettings, invalidateCaches } = await import('../src/lib/core');
const { pondKind, fishTier } = await import('@kb/shared');

let app: any;
let db: any;
before(async () => {
  ({ app, db } = await buildApp({ memoryDb: true, logger: false, rateLimit: false, worker: false }));
});
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
    return { status: res.statusCode, body: res.body ? (() => { try { return JSON.parse(res.body); } catch { return res.body; } })() : null, raw: res.body as string };
  };
  return { call, get: (u: string) => call('GET', u), post: (u: string, b?: unknown) => call('POST', u, b ?? {}) };
}
async function newPlayer(name = 'Pemancing') {
  const c = client();
  assert.equal((await c.post('/api/auth/guest')).status, 200);
  const p = await c.post('/api/pet', { name: name.slice(0, 16), color: '#F6B7A8', ear: 'tunas' });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  return { c, uid: p.body.state.user.id as string };
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Pengaturan game (sebagian) + kolam hanya berisi item tertentu (sementara). */
async function setGame(v: any) {
  await db.query(`insert into settings (key, value) values ('game', $1::text::jsonb) on conflict (key) do update set value = excluded.value`, [JSON.stringify(v)]);
  invalidateCaches();
}
const FAST = { castsPerDay: 500, waitMs: { dekat: [300, 300], sedang: [300, 300], jauh: [300, 300] }, nibbleMax: 0, fightMs: { biasa: [1000, 1000], jarang: [1000, 1000], langka: [1000, 1000], legenda: [1000, 1000], sampah: [1000, 1000], harta: [1000, 1000] } };
async function onlyPond(ids: string[], patch: Record<string, any> = {}) {
  const pond = await db.query(`select id, data, active from items where (data->>'fishWeight') is not null`);
  for (const id of Object.keys(patch)) await db.query(`update items set data = $2::text::jsonb where id = $1`, [id, JSON.stringify(patch[id])]);
  await db.query(`update items set active = (id = any($1::text[])) where (data->>'fishWeight') is not null`, [ids]);
  invalidateCaches();
  return async () => {
    for (const r of pond) await db.query(`update items set data = $2::text::jsonb, active = $3 where id = $1`, [r.id, JSON.stringify(r.data), r.active]);
    invalidateCaches();
  };
}
/** Waktu hari ini pada jam WIB tertentu (untuk langit pagi/siang/sore/malam). */
const wib = (hour: number) => { const d = new Date(); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour - 7 < 0 ? hour + 17 : hour - 7, 0, 0); };

/** Satu tangkapan lewat logika server dengan jam tiruan (tanpa menunggu sungguhan). */
async function catchAt(uid: string, o: { dist?: 'dekat' | 'sedang' | 'jauh'; at?: number } = {}) {
  const s = await getSettings(db), cat = await getCatalog(db);
  const t0 = o.at ?? wib(12);
  const c = await db.tx((t: any) => F.castFish(t, uid, { place: 'kolam', dist: o.dist ?? 'jauh', s, cat, energi: 0, quota: { key: 'fishing', limit: 9999 }, now: t0 }));
  const hookAt = t0 + c.biteInMs + 100;
  const h = await db.tx((t: any) => F.hookFish(t, uid, c.castId, hookAt));
  assert.equal(h.result, 'hooked');
  const r: any = await db.tx((t: any) => F.landFish(t, uid, c.castId, cat, F.kolamReward(t, uid, s, cat), hookAt + c.fight.minMs + 50));
  assert.equal(r.result, 'caught', JSON.stringify(r));
  return { c, r };
}

test('peluang per jarak: dekat banyak ikan Biasa, jauh lebih banyak Langka/Legenda & peti', async () => {
  const s = await getSettings(db), cat = await getCatalog(db);
  const pool = F.pondPool(cat);
  const groups = (dist: any, sky: any) => {
    const g: Record<string, number> = { temuan: 0, biasa: 0, jarang: 0, langka: 0, legenda: 0, peti: 0 };
    for (const { item, p } of F.pondOdds(pool, dist, sky, s)) {
      g[pondKind(item) === 'fish' ? fishTier(item.data) : 'temuan'] += p;
      if (item.id === 'peti-harta') g.peti += p;
    }
    return g;
  };
  // angka rancangan (siang): dekat 77,9% Biasa · sedang 63,5% · jauh 49,5%; Legenda 0 / 0,34% / 1,06%
  const near = groups('dekat', 'siang'), mid = groups('sedang', 'siang'), far = groups('jauh', 'siang');
  const close = (a: number, b: number, tol = 0.006) => assert.ok(Math.abs(a - b) < tol, `${a} ≈ ${b}`);
  close(near.biasa, 0.779); close(near.temuan, 0.0947); close(near.legenda, 0);
  close(mid.biasa, 0.635); close(mid.jarang, 0.212); close(mid.langka, 0.053); close(mid.legenda, 0.0034, 0.001);
  close(far.biasa, 0.495); close(far.jarang, 0.286); close(far.langka, 0.099); close(far.legenda, 0.0106, 0.001);
  assert.ok(far.peti > mid.peti && mid.peti > near.peti, 'peti lebih sering di lemparan jauh');
  // ikan "hanya malam" tidak muncul siang; ikan rahasia hanya di waktunya
  const sidat = (sky: any) => F.pondOdds(pool, 'jauh', sky, s).find((o: any) => o.item.id === 'ikan-sidat')!.p;
  assert.equal(sidat('siang'), 0);
  assert.ok(sidat('malam') > 0);
  // pengundian mengikuti peluang (kuantil merata, deterministik)
  const N = 4000, cnt: Record<string, number> = {};
  for (let k = 0; k < N; k++) { const it = F.pickCatch(pool, 'jauh', 'siang', s, (k + 0.5) / N)!; const g = pondKind(it) === 'fish' ? fishTier(it.data) : 'temuan'; cnt[g] = (cnt[g] ?? 0) + 1; }
  close(cnt.biasa / N, far.biasa, 0.01); close(cnt.legenda / N, far.legenda, 0.003);
  assert.equal(F.pickCatch(pool, 'dekat', 'siang', s, 0.9999)?.data?.tier === 'legenda', false);
});

test('energi per jarak: dekat 3, jauh 5; klien lama diminta memuat ulang', async () => {
  const { c } = await newPlayer();
  const before = (await c.get('/api/me')).body.pet.needs.energi;
  const a = await c.post('/api/fish/cast', { distance: 'dekat' });
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.ok(Math.abs(before - a.body.pet.needs.energi - 3) < 0.6);
  const b = await c.post('/api/fish/cast', { distance: 'jauh' });
  assert.ok(Math.abs(a.body.pet.needs.energi - b.body.pet.needs.energi - 5) < 0.6);
  assert.equal(b.body.limits.fishingLeft, 28);
  assert.equal((await c.post('/api/fish/cast', { distance: 'sangat-jauh' })).status, 400);
  assert.equal((await c.post('/api/fish/reel', { castId: b.body.castId })).body.error.code, 'update_required');
});

test('ikan rahasia tidak bocor sebelum tertangkap', async () => {
  // hanya Arwana yang bisa muncul (jam berapa pun); dua rahasia lain tetap aktif tapi tidak muncul
  const never = { pagi: 0, siang: 0, sore: 0, malam: 0 };
  const sec = Object.fromEntries((await db.query(`select id, data from items where id in ('koi-naga', 'ikan-dewa')`)).map((r: any) => [r.id, { ...r.data, time: never }]));
  const restore = await onlyPond(['arwana-emas', 'koi-naga', 'ikan-dewa'], sec);
  const aw = (await db.one(`select data from items where id = 'arwana-emas'`)).data;
  await db.query(`update items set data = data - 'time' where id = 'arwana-emas'`); invalidateCaches();
  try {
    const { c, uid } = await newPlayer();
    const secretWords = ['arwana', 'Arwana', 'Koi Naga', 'Ikan Dewa', aw.hint, 'koinaga', 'ikandewa', 'koi-naga', 'ikan-dewa'];
    const cast = await c.post('/api/fish/cast', { distance: 'jauh' });
    assert.equal(cast.status, 200, cast.raw);
    for (const w of secretWords) assert.ok(!cast.raw.includes(w), `respons lempar membocorkan "${w}"`);
    const keys = Object.keys(cast.body).sort();
    for (const k of keys) assert.ok(['ok', 'castId', 'place', 'dist', 'sky', 'leadMs', 'biteInMs', 'nibbles', 'windowMs', 'shadow', 'fight', 'pet', 'limits', 'quests', 'serverNow'].includes(k), `kunci tak terduga: ${k}`);
    assert.equal(cast.body.shadow.glow, true);
    const early = await c.post('/api/fish/hook', { castId: cast.body.castId });
    assert.equal(early.body.result, 'early');
    for (const w of secretWords) assert.ok(!early.raw.includes(w));
    // katalog umum, /api/me & Buku Ikan juga bersih
    for (const url of ['/api/catalog', '/api/me', '/api/fish/collection']) {
      const r = await c.get(url);
      for (const w of secretWords) assert.ok(!r.raw.includes(w), `${url} membocorkan "${w}"`);
    }
    const book0 = (await c.get('/api/fish/collection')).body;
    assert.equal(book0.secrets.length, 3);
    assert.ok(book0.secrets.every((x: any) => x.tier === 'legenda' && x.hint === null && Object.keys(x).sort().join() === 'hint,key,tier'));
    // setelah tertangkap: nama & gambar terbuka
    const { r } = await catchAt(uid);
    assert.equal(r.item.id, 'arwana-emas');
    assert.equal(r.item.name, 'Arwana Emas');
    assert.equal(r.secret, true);
    assert.equal(r.firstCatch, true);
    assert.deepEqual(r.secretOf, { got: 1, total: 3 });
    assert.ok(!('hint' in r.item.data), 'petunjuk tidak ikut di item');
    assert.ok(r.revealed.some((i: any) => i.id === 'arwana-emas'));
    const me = (await c.get('/api/me')).body;
    assert.ok(me.revealed.some((i: any) => i.id === 'arwana-emas'));
    const book1 = (await c.get('/api/fish/collection')).body;
    assert.equal(book1.secrets.length, 2);
    assert.ok(book1.revealed.some((i: any) => i.id === 'arwana-emas'));
    assert.ok(!(await c.get('/api/fish/collection')).raw.includes('koi-naga'));
  } finally { await restore(); }
});

test('tarik-ulur minimal dijaga server: mendarat terlalu cepat = lepas', async () => {
  await setGame({ fishing: FAST });
  const restore = await onlyPond(['ikan-mas']);
  try {
    const { c } = await newPlayer();
    // mendarat sebelum kail menyangkut ditolak
    const c0 = await c.post('/api/fish/cast', { distance: 'dekat' });
    assert.equal((await c.post('/api/fish/land', { castId: c0.body.castId })).body.error.code, 'not_hooked');
    // kail tepat waktu, lalu langsung mendarat → lepas, tanpa hadiah
    const c1 = await c.post('/api/fish/cast', { distance: 'dekat' });
    assert.equal(c1.body.fight.minMs, 1000);
    await sleep(c1.body.biteInMs + 30);
    const h1 = await c.post('/api/fish/hook', { castId: c1.body.castId });
    assert.equal(h1.body.result, 'hooked');
    const fast = await c.post('/api/fish/land', { castId: c1.body.castId });
    assert.equal(fast.body.result, 'lepas');
    assert.equal(fast.body.reason, 'cepat');
    assert.equal(fast.body.inventory, undefined);
    assert.equal((await c.get('/api/me')).body.inventory['ikan-mas'] ?? 0, 0);
    assert.equal((await c.post('/api/fish/land', { castId: c1.body.castId })).body.error.code, 'resolved', 'sekali pakai');
    // menunggu sampai lama minimal → tertangkap
    const c2 = await c.post('/api/fish/cast', { distance: 'dekat' });
    await sleep(c2.body.biteInMs + 30);
    assert.equal((await c.post('/api/fish/hook', { castId: c2.body.castId })).body.result, 'hooked');
    await sleep(c2.body.fight.minMs + 20);
    const ok = await c.post('/api/fish/land', { castId: c2.body.castId });
    assert.equal(ok.body.result, 'caught', JSON.stringify(ok.body));
    assert.equal(ok.body.item.id, 'ikan-mas');
    assert.equal(ok.body.inventory['ikan-mas'], 1);
    assert.ok(ok.body.cm >= 12 && ok.body.cm <= 30);
    // terlambat menarik (jam tiruan)
    const c3 = await c.post('/api/fish/cast', { distance: 'dekat' });
    const row = await db.one(`select user_id, bite_at, window_ms from fishing_casts where id = $1`, [c3.body.castId]);
    const tooLate = new Date(row.bite_at).getTime() + row.window_ms + F.HOOK_LATE_MS + 50;
    assert.equal((await db.tx((t: any) => F.hookFish(t, row.user_id, c3.body.castId, tooLate))).result, 'late');
    // tali putus dilaporkan klien: lepas
    const c4 = await c.post('/api/fish/cast', { distance: 'dekat' });
    await sleep(c4.body.biteInMs + 30);
    await c.post('/api/fish/hook', { castId: c4.body.castId });
    const lost = await c.post('/api/fish/lost', { castId: c4.body.castId, reason: 'putus' });
    assert.equal(lost.body.result, 'lepas');
    assert.equal((await c.post('/api/fish/land', { castId: c4.body.castId })).body.error.code, 'resolved');
  } finally { await restore(); await setGame({}); }
});

test('lemparan baru menutup lemparan lama (satu kail per pemain)', async () => {
  const { c } = await newPlayer();
  const a = await c.post('/api/fish/cast', { distance: 'sedang' });
  await c.post('/api/fish/cast', { distance: 'sedang' });
  const row = await db.one(`select result, reason from fishing_casts where id = $1`, [a.body.castId]);
  assert.equal(row.result, 'lepas');
  assert.equal(row.reason, 'ditinggal');
});

test('peti harta: koin 50–300 (× bonus event) & Mutiara berbatas 3 per hari', async () => {
  await setGame({ fishing: { treasure: { pearlChance: 100, pearlMin: 2, pearlMax: 2 }, pearlDailyCap: 3 } });
  const restore = await onlyPond(['peti-harta']);
  try {
    const { c, uid } = await newPlayer();
    const w0 = (await c.get('/api/me')).body.wallet;
    const got: number[] = [];
    let coins = 0;
    for (let i = 0; i < 3; i++) {
      const { r } = await catchAt(uid, { dist: 'jauh' });
      assert.equal(r.kind, 'treasure');
      assert.ok(r.coins >= 50 && r.coins <= 360, `koin peti ${r.coins}`);
      assert.equal(r.pearlWanted, 2);
      got.push(r.pearl);
      coins += r.coins;
    }
    assert.deepEqual(got, [2, 1, 0], 'Mutiara kolam maks 3 per hari');
    const w1 = (await c.get('/api/me')).body.wallet;
    assert.equal(w1.pearl - w0.pearl, 3);
    assert.ok(w1.coin - w0.coin >= coins, 'koin peti masuk dompet');
    assert.equal((await c.get('/api/me')).body.inventory['peti-harta'] ?? 0, 0, 'peti langsung dibuka, tidak masuk Tas');
    const led = await db.query(`select currency, delta, reason from wallet_ledger where user_id = $1 and reason like 'fish-%'`, [uid]);
    assert.ok(led.some((l: any) => l.reason === 'fish-treasure' && l.currency === 'pearl'));
    // Ikan Dewa dilepas: berkah Mutiara juga kena batas yang sama; ceria naik; tidak masuk Tas
    const restore2 = await onlyPond(['ikan-dewa']);
    await db.query(`update items set data = data - 'time' where id = 'ikan-dewa'`); invalidateCaches();
    try {
      const ceria0 = (await c.get('/api/me')).body.pet.needs.ceria;
      const { r } = await catchAt(uid);
      assert.equal(r.released, true);
      assert.equal(r.pearl, 0, 'batas harian sudah penuh');
      assert.equal((await c.get('/api/me')).body.inventory['ikan-dewa'] ?? 0, 0);
      assert.ok((await c.get('/api/me')).body.pet.needs.ceria >= Math.min(100, ceria0 + 15));
      const fresh = await newPlayer('Dewa');
      const { r: r2 } = await catchAt(fresh.uid);
      assert.equal(r2.pearl, 1, 'pemain lain masih dapat berkah');
    } finally { await restore2(); }
  } finally { await restore(); await setGame({}); }
});

test('botol pesan: koin 5–20 & petunjuk ikan rahasia tersimpan di Buku Ikan', async () => {
  await setGame({ fishing: { bottle: { coinMin: 5, coinMax: 20, messages: [] } } });
  // ikan rahasia tetap aktif (sumber petunjuk) tapi tidak bisa muncul sekarang
  const never = { pagi: 0, siang: 0, sore: 0, malam: 0 };
  const sec = Object.fromEntries((await db.query(`select id, data from items where data->>'secret' = 'true'`)).map((r: any) => [r.id, { ...r.data, time: never }]));
  const restore = await onlyPond(['botol-pesan', ...Object.keys(sec)], sec);
  try {
    const { c, uid } = await newPlayer();
    const w0 = (await c.get('/api/me')).body.wallet.coin;
    const { r } = await catchAt(uid, { dist: 'sedang' });
    assert.equal(r.kind, 'bottle');
    assert.ok(r.coins >= 5 && r.coins <= 24, `koin botol ${r.coins}`);
    assert.ok(r.message.length > 10);
    assert.equal(r.hint, true, 'tanpa pesan biasa, isi botol pasti petunjuk');
    assert.ok(!JSON.stringify(r).match(/arwana-emas|koi-naga|ikan-dewa/), 'petunjuk tidak menyebut id ikan');
    assert.equal((await c.get('/api/me')).body.wallet.coin - w0, r.coins);
    const book = (await c.get('/api/fish/collection')).body;
    const withHint = book.secrets.filter((x: any) => x.hint);
    assert.equal(withHint.length, 1);
    assert.equal(withHint[0].hint, r.message);
    assert.ok(book.collection.some((x: any) => x.fish_id === 'botol-pesan'), 'temuan tercatat di Buku (tab Temuan)');
  } finally { await restore(); await setGame({}); }
});

test('admin: data kolam baru (tingkat, tarikan, waktu, jarak) diterima editor item', async () => {
  const owner = client();
  assert.equal((await owner.post('/api/admin/login', { email: 'owner@test.local', password: 'rahasia-sekali-123' })).status, 200);
  const items = (await owner.get('/api/admin/items')).body.items;
  const toman = items.find((i: any) => i.id === 'ikan-toman');
  const body = { ...toman, data: { ...toman.data, tier: 'langka', pull: 4, time: { pagi: 0, siang: '', malam: 2.5 }, near: 0.5, far: 2, fishWeight: 1.5, nibbleMin: 1, nibbleMax: 2, jerk: true } };
  const put = await owner.call('PUT', '/api/admin/items/ikan-toman', body);
  assert.equal(put.status, 200, JSON.stringify(put.body));
  assert.deepEqual(put.body.item.data.time, { pagi: 0, malam: 2.5 });
  assert.equal(put.body.item.data.tier, 'langka');
  assert.equal(put.body.item.data.pull, 4);
  assert.equal(put.body.item.data.fishWeight, 1.5);
  assert.equal(put.body.item.data.far, 2);
  assert.equal((await owner.call('PUT', '/api/admin/items/ikan-toman', { ...body, data: { ...body.data, tier: 'mitos' } })).status, 400);
  // temuan mebel/aksesori tetap punya data kolam setelah disimpan
  const kendi = items.find((i: any) => i.id === 'kendi-antik');
  const k = await owner.call('PUT', '/api/admin/items/kendi-antik', kendi);
  assert.equal(k.status, 200, JSON.stringify(k.body));
  assert.equal(k.body.item.data.find, 'decor');
  assert.equal(k.body.item.data.fishWeight, 2.5);
  assert.equal(k.body.item.data.w, 1);
  // pengaturan baru tervalidasi
  const st = (await owner.get('/api/admin/settings')).body.value;
  assert.equal((await owner.call('PUT', '/api/admin/settings', { value: { ...st, fishing: { ...st.fishing, pearlDailyCap: 99 } } })).status, 400);
  assert.equal((await owner.call('PUT', '/api/admin/settings', { value: { ...st, fishing: { ...st.fishing, energi: { dekat: 2, sedang: 4, jauh: 6 } } } })).status, 200);
  await owner.call('PUT', '/api/admin/items/ikan-toman', toman);
  await setGame({});
});

test('paket konten 11: koleksi pemain dari content_pack 10 tetap utuh', async () => {
  // database lama: semua paket sampai 10, pemain sudah menangkap ikan lama & sandal
  const old = await openDb({ memory: true });
  await migrate(old);
  await seedMod.seed(old); await seedQuests(old); await seedMod.seedPacks(old);
  for (const f of [seedMod.seedPackV3, seedMod.seedPackV4, seedMod.seedPackV5, seedMod.seedPackV6, seedMod.seedPackV7, seedMod.seedPackV8, seedMod.seedPackV9, seedMod.seedPackV10]) await f(old);
  assert.equal(Number((await old.one(`select value from settings where key = 'content_pack'`)).value), 10);
  const u = await old.one(`insert into users (display_name, friend_code) values ('Lama', 'KB-LAMA01') returning id`);
  const caught = [['ikan-mas', 12, 28.4], ['ikan-lele', 5, 41.2], ['ikan-cupang', 1, 6.1], ['ikan-koi', 2, 33], ['sandal-jepit', 4, 24]];
  for (const [id, n, cm] of caught) await old.query(`insert into fish_collection (user_id, fish_id, count, best_cm) values ($1,$2,$3,$4)`, [u.id, id, n, cm]);
  await old.query(`insert into inventory (user_id, item_id, qty) values ($1,'ikan-lele',3), ($1,'sandal-jepit',2)`, [u.id]);
  await old.query(`update items set name = 'Lele Dumbo', sell_coin = 15 where id = 'ikan-lele'`); // ubahan admin
  const before = await old.query(`select fish_id, count, best_cm from fish_collection where user_id = $1 order by fish_id`, [u.id]);

  const up = await buildApp({ db: old, logger: false, rateLimit: false, worker: false });
  invalidateCaches();
  try {
    assert.ok(Number((await old.one(`select value from settings where key = 'content_pack'`)).value) >= 11);
    assert.ok(await old.one(`select 1 from settings where key = 'pack_ikan'`), 'penanda paket ikan tercatat');
    const after2 = await old.query(`select fish_id, count, best_cm from fish_collection where user_id = $1 order by fish_id`, [u.id]);
    assert.deepEqual(after2, before, 'koleksi tidak berubah');
    const inv = await old.query(`select item_id, qty from inventory where user_id = $1 order by item_id`, [u.id]);
    assert.deepEqual(inv.map((r: any) => [r.item_id, r.qty]), [['ikan-lele', 3], ['sandal-jepit', 2]]);
    const it = (id: string) => old.one(`select name, sell_coin, art, data from items where id = $1`, [id]);
    const lele = await it('ikan-lele');
    assert.equal(lele.name, 'Lele Dumbo', 'nama dari admin tetap');
    assert.equal(lele.sell_coin, 15);
    assert.equal(lele.art.key, 'ikankumis');
    assert.equal(lele.data.tier, 'biasa');
    assert.equal(lele.data.time.malam, 1.5);
    assert.equal((await it('ikan-cupang')).art.key, 'ikancupang');
    assert.equal((await it('ikan-gurame')).art.key, 'ikanpipih');
    assert.equal((await it('ikan-sapu')).art.key, 'ikansapu');
    assert.equal((await it('ikan-cupang')).data.tier, 'langka');
    const sandal = await it('sandal-jepit');
    assert.equal(sandal.data.find, 'junk');
    assert.equal(sandal.data.fishWeight, 40);
    const n = await old.one(`select count(*)::int c from items where active and (data->>'fishWeight')::float > 0 and coalesce(data->>'find', '') = ''`);
    assert.equal(n.c, 25, '25 jenis ikan');
    const finds = await old.one(`select count(*)::int c from items where active and coalesce(data->>'find', '') <> ''`);
    assert.equal(finds.c, 6, '6 temuan');
    // paket tidak dijalankan dua kali
    assert.equal(await (await import('../src/db/seed-ikan')).seedPackV11(old), false);
    // Buku Ikan pemain lama: 4 ikan tertangkap dari 25, sandal di Temuan
    const cat = await getCatalog(old);
    const book = await F.fishBook(old, u.id, cat);
    assert.deepEqual(book.book, { got: 4, total: 25 });
    assert.ok(book.collection.some((r: any) => r.fish_id === 'sandal-jepit'));
  } finally {
    await up.app.close();
    await old.close();
    invalidateCaches();
  }
});
