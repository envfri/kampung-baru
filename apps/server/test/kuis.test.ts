// Cerdas Cermat Kampung (paket konten 25): bank soal (validator, cakupan, gambar), Kuis Harian (kunci tidak pernah
// terkirim sebelum menjawab, jawaban terlambat, satu jawaban per soal, set harian tetap, menghindari soal yang sudah
// dilihat, hadiah & batas harian, beruntun), Laporkan soal (batas harian), admin (validasi simpan, tanda otomatis,
// laporan), Tantang Teman (alur penuh, kedaluwarsa, seri dipecah waktu), Cerdas Cermat Bareng (urutan diterima, timer
// server tanpa jawaban), papan peringkat mingguan hanya teman, sinkron bank, reset peluncuran.
// Tidak bergantung pada ID / teks soal tertentu: kunci jawaban dibaca dari database & dihitung dengan fungsi shared.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { config } from '../src/config';

config.paymentProvider = 'mock';
config.adminEmail = 'owner@test.local';
config.adminPassword = 'rahasia-sekali-123';
const { buildApp } = await import('../src/app');
const { invalidateCaches } = await import('../src/lib/core');
const { setKuisClock, invalidateKuis } = await import('../src/lib/kuis');
const { resetHouses } = await import('../src/routes/house');
const { resetBareng, setBarengClock, barengTick } = await import('../src/routes/bareng');
const { syncKuisBank, seedPackV25, KUIS_BANK } = await import('../src/db/seed-kuis');
const {
  DEFAULT_SETTINGS, KUIS_CAT_IDS, KUIS_IMAGES, KUIS_TYPE_IDS, kuisImageInner, kuisImageSVG, kuisReveal, kuisCheck, kuisPublic, pickKuis, validateBank,
  validateQuestion, tantangParts, KUIS_QUICK, BARENG_GAMES, SQUARE_ACTS, kancilSVG, KANCIL_MOODS,
} = await import('@kb/shared');
let app: any;
let db: any;
before(async () => {
  ({ app, db } = await buildApp({ memoryDb: true, logger: false, rateLimit: false, worker: false }));
  // tanpa event berpengali koin supaya angka hadiah pasti
  await db.query(`update events set active = false`);
  invalidateCaches();
});
after(async () => { setKuisClock(() => Date.now()); setBarengClock(() => Date.now()); await app?.close(); });
let now = Date.UTC(2026, 10, 23, 3, 0); // Senin 23 Nov 2026, 10.00 WIB
setKuisClock(() => now);
const later = (ms: number) => { now += ms; };
beforeEach(async () => { await setKuis({}); });

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
  return { call, get: (u: string) => call('GET', u), post: (u: string, b?: unknown) => call('POST', u, b ?? {}), put: (u: string, b?: unknown) => call('PUT', u, b ?? {}), del: (u: string) => call('DELETE', u) };
}
type P = { c: ReturnType<typeof client>; id: string; code: string; room: string; name: string };
async function player(name: string): Promise<P> {
  const c = client();
  await c.post('/api/auth/guest');
  const p = await c.post('/api/pet', { name, color: '#F6B7A8', ear: 'kucing', ownerName: name });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  const id = p.body.state.user.id as string;
  await db.query(`update pets set energi = 100 where user_id = $1`, [id]);
  return { c, id, code: p.body.state.user.friend_code, room: p.body.state.rooms[0].id, name };
}
async function owner() {
  const c = client();
  assert.equal((await c.post('/api/admin/login', { email: 'owner@test.local', password: 'rahasia-sekali-123' })).status, 200);
  return c;
}
async function setKuis(patch: Record<string, unknown>) {
  if (!db) return;
  const row = await db.one(`select value from settings where key = 'game'`);
  const v = row?.value ?? {};
  v.kuis = { ...structuredClone(DEFAULT_SETTINGS.kuis), ...patch };
  await db.query(`insert into settings (key, value) values ('game', $1::text::jsonb) on conflict (key) do update set value = excluded.value`, [JSON.stringify(v)]);
  invalidateCaches();
}
const coins = async (p: P) => (await db.one(`select coin from wallets where user_id = $1`, [p.id])).coin as number;
const pearls = async (p: P) => (await db.one(`select pearl from wallets where user_id = $1`, [p.id])).pearl as number;
const qOf = async (id: string) => (await db.one(`select data from kuis_questions where id = $1`, [id])).data;
/** kunci jawaban dalam indeks tampil (dibaca dari database, seperti server) */
async function rightPick(runId: string, idx: number, qid: string) {
  const q = await qOf(qid), key = `${runId}:${idx}`, r: any = kuisReveal(q, key);
  return q.type === 'urutkan' ? r.order : q.type === 'cocokkan' ? r.pairs : r.answer;
}
async function wrongPick(runId: string, idx: number, qid: string) {
  const q = await qOf(qid), right = await rightPick(runId, idx, qid);
  if (Array.isArray(right)) return [...right].reverse();
  return (right + 1) % (q.options.length);
}
const SECRET_KEYS = ['answer', 'order', 'pairs', 'explain', 'source'];
function keysDeep(o: any, out = new Set<string>()) {
  if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { out.add(k); keysDeep(v, out); }
  return out;
}
/** soal yang sedang berjalan tidak membawa kunci / penjelasan / sumber (cek kunci objek & teks mentah respons) */
async function assertNoKey(raw: string, cur: any, label: string) {
  const ks = keysDeep(cur);
  for (const k of SECRET_KEYS) assert.ok(!ks.has(k), `${label}: kunci "${k}" tidak boleh ada di soal yang sedang berjalan`);
  const q = await qOf(cur.id ?? cur.q?.id);
  assert.ok(!raw.includes(JSON.stringify(q.explain).slice(1, -1)), `${label}: penjelasan bocor`);
  assert.ok(!raw.includes(JSON.stringify(q.source).slice(1, -1)), `${label}: sumber bocor`);
  if (q.type === 'urutkan') assert.notDeepEqual(cur.items ?? cur.q.items, q.order, `${label}: butir urutkan tidak boleh sudah urut`);
  if (q.type === 'cocokkan') assert.notDeepEqual(cur.right ?? cur.q.right, q.pairs.map((p: string[]) => p[1]), `${label}: sisi kanan tidak boleh sudah berpasangan`);
}
/** mainkan Kuis Harian sampai selesai; correctFor(idx) = true → jawab benar */
async function playHarian(p: P, correctFor: (i: number) => boolean = () => true) {
  let r = await p.c.post('/api/kuis/harian');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  let run = r.body.run;
  while (!run.done) {
    if (!run.current) { run = (await p.c.post(`/api/kuis/runs/${run.id}/next`)).body.run; continue; }
    const { idx, q } = run.current;
    const pick = correctFor(idx) ? await rightPick(run.id, idx, q.id) : await wrongPick(run.id, idx, q.id);
    const a = await p.c.post(`/api/kuis/runs/${run.id}/answer`, { idx, pick });
    assert.equal(a.status, 200, JSON.stringify(a.body));
    assert.equal(a.body.result.correct, correctFor(idx));
    run = a.body.run;
  }
  return run;
}

/* ------------------------------------------------------------------ */

test('bank soal bawaan: lolos validateBank, semua kategori, level & tipe, 24 gambar dipakai & digambar', async () => {
  const bank = JSON.parse(readFileSync(new URL('../src/db/kuis-soal.json', import.meta.url), 'utf8'));
  assert.deepEqual(validateBank(bank), []);
  assert.ok(bank.length >= 30);
  for (const c of KUIS_CAT_IDS) assert.ok(bank.some((q: any) => q.cat === c), `kategori ${c}`);
  for (const t of KUIS_TYPE_IDS) assert.ok(bank.some((q: any) => q.type === t), `tipe ${t}`);
  for (const l of [1, 2, 3]) assert.ok(bank.some((q: any) => q.level === l), `level ${l}`);
  for (const img of KUIS_IMAGES) {
    assert.ok(bank.some((q: any) => q.image === img), `gambar ${img} dipakai`);
    const svg = kuisImageInner(img);
    assert.ok(svg.length > 300 && /<(path|ellipse|circle|rect)/.test(svg), `gambar ${img} digambar`);
    assert.ok(!/<text/i.test(kuisImageSVG(img)), `gambar ${img} tanpa tulisan`);
    assert.ok(!kuisImageSVG(img).toLowerCase().includes(`>${img.replace('-', ' ')}<`), `nama ${img} tidak ada di gambar`);
  }
  assert.equal(new Set(KUIS_IMAGES.map((k) => kuisImageInner(k))).size, 24, '24 gambar berbeda');
  for (const m of KANCIL_MOODS) assert.ok(kancilSVG(m, { podium: true }).includes('kc-podium'));
  // semua soal bank masuk database lewat paket 25
  const n = (await db.one(`select count(*)::int c from kuis_questions where origin = 'bank'`)).c;
  assert.equal(n, bank.length);
  assert.equal(KUIS_BANK.length, bank.length);
  // tugas & lencana
  const qs = await db.query(`select id, kind, event, target, filter from quests where id like '%kuis%' order by id`);
  assert.equal(qs.find((q: any) => q.id === 'h-kuis').event, 'kuis_harian');
  for (const c of KUIS_CAT_IDS) { const b = qs.find((q: any) => q.id === `b-kuis-${c}`); assert.deepEqual([b.kind, b.event, b.target, b.filter.cat], ['badge', 'kuis_benar', 30, c]); }
  assert.equal(qs.find((q: any) => q.id === 'b-kuis-juara').event, 'kuis_juara');
  assert.ok(Number((await db.one(`select value from settings where key = 'content_pack'`)).value) >= 25);
  assert.equal(await seedPackV25(db), false, 'paket 25 sekali saja');
});

test('validator: aturan bentuk & panjang dari SCHEMA.md', () => {
  const base = { id: 'bud-901', cat: 'budaya', level: 1, type: 'pilihan', q: 'Soal?', options: ['A', 'B', 'C', 'D'], answer: 0, explain: 'Penjelasan.', source: 'Sumber' };
  assert.deepEqual(validateQuestion(base), []);
  const errs = (o: any) => validateQuestion({ ...base, ...o });
  assert.ok(errs({ options: ['A', 'a ', 'C', 'D'] }).some((e) => /kembar/.test(e)), 'pilihan kembar setelah dinormalkan');
  assert.ok(errs({ answer: 4 }).length && errs({ answer: -1 }).length);
  assert.ok(errs({ q: 'x'.repeat(161) }).length);
  assert.ok(errs({ id: 'mak-901' }).some((e) => /diawali "bud-"/.test(e)));
  assert.ok(errs({ explain: '' }).length && errs({ source: ' ' }).length);
  assert.ok(errs({ explain: 'Tahukah kamu, ...' }).length);
  assert.ok(errs({ image: 'komodo' }).length, 'field yang tidak dipakai tipe ditolak');
  assert.ok(errs({ extra: 1 }).length, 'kunci tak dikenal ditolak');
  const bs = { ...base, type: 'benarsalah', options: ['Benar', 'Salah'] };
  assert.deepEqual(validateQuestion(bs), []);
  assert.ok(validateQuestion({ ...bs, options: ['Salah', 'Benar'] }).length);
  const ur = { id: 'sai-901', cat: 'sains', level: 2, type: 'urutkan', q: 'Urutkan.', order: ['a', 'b', 'c'], explain: 'x', source: 'y' };
  assert.deepEqual(validateQuestion(ur), []);
  assert.ok(validateQuestion({ ...ur, order: ['a', 'b'] }).length && validateQuestion({ ...ur, order: ['a', 'b', 'c', 'd', 'e', 'f'] }).length);
  assert.ok(validateQuestion({ ...ur, order: ['a', 'A', 'c'] }).length);
  assert.ok(validateQuestion({ ...ur, q: 'x'.repeat(101) }).length, 'urutkan ≤ 100 karakter');
  const co = { id: 'bhs-901', cat: 'bahasa', level: 1, type: 'cocokkan', q: 'Cocokkan.', pairs: [['a', '1'], ['b', '2'], ['c', '3']], explain: 'x', source: 'y' };
  assert.deepEqual(validateQuestion(co), []);
  assert.ok(validateQuestion({ ...co, pairs: [['a', '1'], ['a', '2'], ['c', '3']] }).some((e) => /kiri/.test(e)));
  assert.ok(validateQuestion({ ...co, pairs: [['a', '1'], ['b', '1'], ['c', '3']] }).some((e) => /kanan/.test(e)));
  assert.ok(validateQuestion({ ...co, pairs: [['a', '1'], ['b', '2']] }).length);
  const gb = { ...base, id: 'alm-901', cat: 'alam', type: 'gambar', image: 'komodo' };
  assert.deepEqual(validateQuestion(gb), []);
  assert.ok(validateQuestion({ ...gb, image: 'naga' }).length);
  const pb = { ...base, id: 'bhs-902', cat: 'bahasa', type: 'peribahasa', q: 'Bagai air di daun ___.' };
  assert.deepEqual(validateQuestion(pb), []);
  assert.ok(validateQuestion({ ...pb, q: 'Bagai air di daun.' }).length);
  assert.ok(validateQuestion({ ...base, id: 'mtk-901', cat: 'matematika', type: 'hitung', options: ['1', '2', 'tiga', '4'] }).length);
  // bank: ID & teks soal kembar
  const bank = validateBank([base, { ...base, q: 'Lain?' }, { ...base, id: 'bud-902', q: '  soal? ' }]);
  assert.ok(bank.some((e) => /ID kembar/.test(e)) && bank.some((e) => /Teks soal sama/.test(e)));
});

test('Kuis Harian: soal tanpa kunci, jawaban benar/salah + penjelasan, satu jawaban, terlambat = waktu habis', async () => {
  const a = await player('Kinan');
  const st = await a.c.post('/api/kuis/harian');
  assert.equal(st.status, 200, JSON.stringify(st.body));
  const run = st.body.run;
  assert.equal(run.total, 10);
  assert.equal(run.answers.length, 0);
  assert.ok(run.current && run.current.idx === 0 && run.current.limitMs >= 15000);
  await assertNoKey(st.raw, run.current.q, 'mulai');
  assert.equal(Math.round((await db.one(`select energi from pets where user_id = $1`, [a.id])).energi), 95, 'energi berkurang 5');
  // GET keadaan & beranda juga tanpa kunci
  const g = await a.c.get(`/api/kuis/runs/${run.id}`);
  await assertNoKey(g.raw, g.body.run.current.q, 'GET');
  const home = await a.c.get('/api/kuis');
  assert.equal(home.body.today.id, run.id);
  for (const k of SECRET_KEYS) assert.ok(!keysDeep(home.body).has(k));
  // jawaban benar
  const c0 = await coins(a);
  const pick0 = await rightPick(run.id, 0, run.current.q.id);
  const r0 = await a.c.post(`/api/kuis/runs/${run.id}/answer`, { idx: 0, pick: pick0 });
  assert.equal(r0.status, 200, JSON.stringify(r0.body));
  assert.equal(r0.body.result.correct, true);
  assert.ok(r0.body.result.explain.length > 5, 'penjelasan sesudah menjawab');
  assert.equal(r0.body.result.coins, 5);
  assert.equal(await coins(a), c0 + 5);
  assert.ok(r0.body.result.points >= 10);
  // satu jawaban per soal
  const again = await a.c.post(`/api/kuis/runs/${run.id}/answer`, { idx: 0, pick: pick0 });
  assert.equal(again.body.error.code, 'answered');
  // soal berikutnya baru dikirim saat diminta; soal yang belum dikirim tidak bisa dijawab
  assert.equal((await a.c.post(`/api/kuis/runs/${run.id}/answer`, { idx: 1, pick: 0 })).body.error.code, 'not_served');
  let nx = await a.c.post(`/api/kuis/runs/${run.id}/next`);
  await assertNoKey(nx.raw, nx.body.run.current.q, 'soal 2');
  // jawaban salah: kunci & penjelasan dikirim
  const cur1 = nx.body.run.current;
  const r1 = await a.c.post(`/api/kuis/runs/${run.id}/answer`, { idx: 1, pick: await wrongPick(run.id, 1, cur1.q.id) });
  assert.equal(r1.body.result.correct, false);
  assert.equal(r1.body.result.coins, 0);
  assert.ok(r1.body.result.explain);
  const rv = r1.body.result;
  assert.ok(rv.answer !== undefined || rv.order || rv.pairs, 'kunci dalam indeks tampil');
  // bentuk jawaban tidak sah ditolak tanpa mengubah apa pun
  nx = await a.c.post(`/api/kuis/runs/${run.id}/next`);
  const cur2 = nx.body.run.current;
  assert.equal((await a.c.post(`/api/kuis/runs/${run.id}/answer`, { idx: 2, pick: 'x' })).body.error.code, 'invalid_pick');
  // terlambat: lewat batas + toleransi → waktu habis walau jawabannya benar
  later(cur2.limitMs + 2500);
  const late = await a.c.post(`/api/kuis/runs/${run.id}/answer`, { idx: 2, pick: await rightPick(run.id, 2, cur2.q.id) });
  assert.equal(late.body.result.correct, false);
  assert.equal(late.body.result.timedOut, true);
  assert.ok(late.body.result.explain);
  // masih dalam toleransi: dihitung
  nx = await a.c.post(`/api/kuis/runs/${run.id}/next`);
  const cur3 = nx.body.run.current;
  later(cur3.limitMs + 1500);
  const ok3 = await a.c.post(`/api/kuis/runs/${run.id}/answer`, { idx: 3, pick: await rightPick(run.id, 3, cur3.q.id) });
  assert.equal(ok3.body.result.correct, true, 'toleransi jaringan ±2 detik');
  // waktu habis tanpa jawaban (aplikasi ditutup): dicatat saat kembali, kunci & penjelasan ikut
  nx = await a.c.post(`/api/kuis/runs/${run.id}/next`);
  later(nx.body.run.current.limitMs + 3000);
  const back = await a.c.get(`/api/kuis/runs/${run.id}`);
  const last = back.body.run.answers.find((x: any) => x.idx === 4);
  assert.deepEqual([last.timedOut, last.correct, !!last.reveal.explain], [true, false, true]);
  assert.equal(back.body.run.current, null, 'GET tidak mengirim soal berikutnya');
  // menyerah (pick null) = waktu habis
  nx = await a.c.post(`/api/kuis/runs/${run.id}/next`);
  const gv = await a.c.post(`/api/kuis/runs/${run.id}/answer`, { idx: 5, pick: null });
  assert.deepEqual([gv.body.result.timedOut, gv.body.result.correct], [true, false]);
  // statistik soal
  const stats = await db.one(`select shown, answered, correct from kuis_questions where id = $1`, [run.current.q.id]);
  assert.deepEqual([stats.shown >= 1, stats.answered >= 1, stats.correct >= 1], [true, true, true]);
});

test('set harian tetap per pemain per hari WIB & menghindari soal yang sudah dilihat', async () => {
  now = Date.UTC(2026, 10, 24, 3, 0);
  const a = await player('Bayu');
  const r1 = (await a.c.post('/api/kuis/harian')).body.run;
  const q1 = (await db.one(`select qids from kuis_runs where id = $1`, [r1.id])).qids;
  // memuat ulang: permainan yang sama, soal yang sama
  const r2 = (await a.c.post('/api/kuis/harian')).body.run;
  assert.equal(r2.id, r1.id);
  assert.deepEqual((await db.one(`select qids from kuis_runs where id = $1`, [r2.id])).qids, q1);
  assert.equal(r2.current.idx, 0, 'soal yang sama dilanjutkan');
  // pemilihan murni & tetap
  const pool = (await db.query(`select data from kuis_questions where active and deleted_at is null`)).map((r: any) => r.data);
  const p1 = pickKuis('u:2026-11-24', pool, 10, [4, 4, 2]).map((q: any) => q.id);
  assert.deepEqual(pickKuis('u:2026-11-24', pool, 10, [4, 4, 2]).map((q: any) => q.id), p1);
  const lv = pickKuis('u:x', pool, 10, [4, 4, 2]).reduce((m: any, q: any) => ((m[q.level] = (m[q.level] ?? 0) + 1), m), {});
  assert.deepEqual([lv[1], lv[2], lv[3]], [4, 4, 2], 'campuran 4/4/2');
  assert.ok(new Set(pickKuis('u:x', pool, 10, [4, 4, 2]).map((q: any) => q.cat)).size >= 6, 'kategori bercampur');
  // bank tipis: tetap dapat soal sebanyak yang ada, level lain mengisi
  const thin = pool.filter((q: any) => q.level !== 3).slice(0, 12);
  assert.equal(pickKuis('k', thin, 10, [4, 4, 2]).length, 10);
  assert.equal(pickKuis('k', thin.slice(0, 5), 10, [4, 4, 2]).length, 5);
  // soal yang sudah dilihat dihindari selama masih ada yang lain
  const seen = new Set(p1);
  const p2 = pickKuis('u:2026-11-25', pool, 10, [4, 4, 2], seen);
  assert.ok(p2.every((q: any) => !seen.has(q.id)), 'tidak mengulang soal yang dilihat');
  // lewat server: selesaikan hari ini, besok tidak bertemu soal yang sama
  await playHarian(a);
  now = Date.UTC(2026, 10, 25, 3, 0);
  const r3 = (await a.c.post('/api/kuis/harian')).body.run;
  assert.notEqual(r3.id, r1.id);
  const q3 = (await db.one(`select qids from kuis_runs where id = $1`, [r3.id])).qids;
  assert.ok(q3.every((id: string) => !q1.includes(id)), 'hari berikutnya: soal baru');
});

test('hadiah: koin & XP per benar, bonus sempurna, batas koin harian; beruntun 3 & 7 hari', async () => {
  const a = await player('Citra');
  now = Date.UTC(2026, 10, 2, 3, 0); // Senin
  const c0 = await coins(a);
  const run = await playHarian(a);
  assert.equal(run.result.correct, 10);
  assert.equal(run.result.bonus.perfect, 1);
  assert.equal(await coins(a), c0 + 10 * 5 + 25, '10 benar × 5 + bonus sempurna 25');
  assert.equal(run.result.bonus.streak, 1);
  // batas koin harian (hari baru, batas 12)
  await setKuis({ dailyCoinCap: 12 });
  now += 86_400_000;
  const c1 = await coins(a);
  const r2 = await playHarian(a, (i) => i % 2 === 0);
  assert.equal(r2.result.correct, 5);
  assert.equal(await coins(a), c1 + 12, 'koin berhenti di batas harian');
  assert.equal(r2.result.bonus.streak, 2);
  // hari ke-3 beruntun: bonus 3 hari
  await setKuis({});
  now += 86_400_000;
  const c2 = await coins(a);
  const r3 = await playHarian(a, () => false);
  assert.equal(r3.result.bonus.streak3, 3);
  assert.equal(await coins(a), c2 + 20, 'semua salah: hanya bonus beruntun 3 hari');
  const home = (await a.c.get('/api/kuis')).body;
  assert.deepEqual([home.streak.streak, home.streak.today], [3, true]);
  // hari ke-4..7: bonus 7 hari + Mutiara
  for (let d = 4; d <= 6; d++) { now += 86_400_000; await playHarian(a, () => false); }
  now += 86_400_000;
  const p0 = await pearls(a), c3 = await coins(a);
  const r7 = await playHarian(a, () => false);
  assert.equal(r7.result.bonus.streak7, 7);
  assert.equal(await pearls(a), p0 + 1);
  assert.equal(await coins(a), c3 + 40);
  // bolos sehari: beruntun mulai lagi dari 1
  now += 2 * 86_400_000;
  const r8 = await playHarian(a, () => false);
  assert.equal(r8.result.bonus.streak, 1);
  // tugas harian "Jawab Kuis Harian" & lencana Si Pintar menghitung jawaban benar per kategori
  const prog = await db.query(`select quest_id, progress from quest_progress where user_id = $1 and quest_id like 'b-kuis-%'`, [a.id]);
  assert.ok(prog.reduce((s: number, r: any) => s + r.progress, 0) >= 15, 'jawaban benar tercatat untuk lencana');
});

test('pet tidur / tidak cukup energi: Kuis Harian ditolak seperti mini-game lain', async () => {
  now = Date.UTC(2026, 10, 26, 3, 0);
  const a = await player('Dewi');
  await db.query(`update pets set energi = 2 where user_id = $1`, [a.id]);
  assert.equal((await a.c.post('/api/kuis/harian')).body.error.code, 'tired');
  await setKuis({ on: false });
  assert.equal((await a.c.post('/api/kuis/harian')).status, 403);
});

test('Laporkan soal: alasan sah, catatan ≤ 200, tidak dobel, batas per hari', async () => {
  await setKuis({ reportsPerDay: 2 });
  const a = await player('Eka');
  const ids = (await db.query(`select id from kuis_questions order by id limit 4`)).map((r: any) => r.id);
  assert.equal((await a.c.post('/api/kuis/report', { qid: ids[0], reason: 'aneh' })).status, 400);
  assert.equal((await a.c.post('/api/kuis/report', { qid: ids[0], reason: 'salah', note: 'x'.repeat(201) })).status, 400);
  assert.equal((await a.c.post('/api/kuis/report', { qid: 'zzz-000', reason: 'salah' })).status, 404);
  assert.equal((await a.c.post('/api/kuis/report', { qid: ids[0], reason: 'salah', note: 'Kuncinya tertukar' })).body.ok, true);
  assert.equal((await a.c.post('/api/kuis/report', { qid: ids[0], reason: 'ketik' })).body.already, true, 'laporan terbuka yang sama tidak dobel');
  assert.equal((await a.c.post('/api/kuis/report', { qid: ids[1], reason: 'bingung' })).body.ok, true);
  assert.equal((await a.c.post('/api/kuis/report', { qid: ids[2], reason: 'lain' })).body.error.code, 'daily_limit');
  assert.equal((await db.one(`select count(*)::int c from kuis_reports where user_id = $1`, [a.id])).c, 2);
});

test('admin: daftar & saring, buat/ubah dengan validasi yang sama, nonaktif, hapus, tanda otomatis, laporan', async () => {
  const adm = await owner();
  const list = await adm.get('/api/admin/kuis/questions?cat=alam&type=gambar');
  assert.equal(list.status, 200);
  assert.ok(list.body.questions.length >= 10 && list.body.questions.every((q: any) => q.cat === 'alam' && q.type === 'gambar'));
  assert.ok(list.body.summary.total >= 40);
  // buat: ditolak dengan pesan yang sama dengan validator
  const bad = await adm.post('/api/admin/kuis/questions', { question: { cat: 'sains', level: 1, type: 'pilihan', q: 'Apa?', options: ['A', 'A', 'B', 'C'], answer: 0, explain: '', source: 'x' } });
  assert.equal(bad.status, 400);
  assert.ok(bad.body.error.errors.some((e: string) => /kembar/.test(e)) && bad.body.error.errors.some((e: string) => /explain/.test(e)));
  const okQ = { cat: 'sains', level: 1, type: 'pilihan', q: 'Hewan apa yang bernapas dengan insang?', options: ['Ikan', 'Kucing', 'Ayam', 'Sapi'], answer: 0, explain: 'Ikan bernapas dengan insang di dalam air.', source: 'IPA SD' };
  const cr = await adm.post('/api/admin/kuis/questions', { question: okQ });
  assert.equal(cr.status, 200, JSON.stringify(cr.body));
  const id = cr.body.question.id;
  assert.match(id, /^sai-9\d\d$/, 'ID buatan admin memakai nomor 900–999');
  assert.equal(cr.body.question.origin, 'admin');
  // teks kembar ditolak
  assert.ok((await adm.post('/api/admin/kuis/questions', { question: { ...okQ, q: '  hewan apa yang bernapas dengan INSANG? ' } })).body.error.errors.some((e: string) => /sama dengan soal/.test(e)));
  // ubah: validasi, kategori tetap
  assert.equal((await adm.put(`/api/admin/kuis/questions/${id}`, { question: { ...okQ, answer: 7 } })).status, 400);
  assert.equal((await adm.put(`/api/admin/kuis/questions/${id}`, { question: { ...okQ, cat: 'alam' } })).status, 400);
  const up = await adm.put(`/api/admin/kuis/questions/${id}`, { question: { ...okQ, level: 2 } });
  assert.equal(up.status, 200);
  assert.equal((await qOf(id)).level, 2);
  // nonaktif → tidak dipakai lagi
  assert.equal((await adm.post(`/api/admin/kuis/questions/${id}/active`, { active: false })).status, 200);
  invalidateKuis();
  assert.equal((await adm.get('/api/admin/kuis/questions?status=disabled')).body.questions.some((q: any) => q.id === id), true);
  // tanda otomatis: benar < 25 % setelah ≥ 30 jawaban, atau ≥ 3 laporan terbuka
  const [x1, x2] = (await db.query(`select id from kuis_questions where origin = 'bank' order by id desc limit 2`)).map((r: any) => r.id);
  await db.query(`update kuis_questions set answered = 30, correct = 7 where id = $1`, [x1]);
  await db.query(`update kuis_questions set answered = 29, correct = 0 where id = $1`, [x2]);
  let fl = (await adm.get('/api/admin/kuis/questions?flagged=true')).body.questions.map((q: any) => q.id);
  assert.ok(fl.includes(x1) && !fl.includes(x2));
  for (const n of ['Lapor1', 'Lapor2', 'Lapor3']) { const p = await player(n); await p.c.post('/api/kuis/report', { qid: x2, reason: 'salah' }); }
  fl = (await adm.get('/api/admin/kuis/questions?flagged=true')).body.questions.map((q: any) => q.id);
  assert.ok(fl.includes(x2), '3 laporan terbuka → ditandai');
  // kotak laporan: lihat & tandai selesai
  const reps = await adm.get('/api/admin/kuis/reports');
  const mine = reps.body.reports.filter((r: any) => r.qid === x2);
  assert.equal(mine.length, 3);
  assert.ok(mine[0].qtext && mine[0].reporter);
  assert.equal((await adm.post('/api/admin/kuis/reports/resolve', { ids: mine.map((r: any) => r.id) })).body.count, 3);
  fl = (await adm.get('/api/admin/kuis/questions?flagged=true')).body.questions.map((q: any) => q.id);
  assert.ok(!fl.includes(x2), 'laporan selesai → tanda hilang');
  assert.equal((await adm.get('/api/admin/badges')).body.badges.kuis, (await db.one(`select count(*)::int c from kuis_reports where resolved_at is null`)).c);
  // hapus = tanda dihapus (tidak muncul di daftar biasa)
  assert.equal((await adm.del(`/api/admin/kuis/questions/${id}`)).status, 200);
  assert.ok(!(await adm.get('/api/admin/kuis/questions')).body.questions.some((q: any) => q.id === id));
  assert.ok((await adm.get('/api/admin/kuis/questions?status=deleted')).body.questions.some((q: any) => q.id === id));
  // moderator tidak boleh mengubah (cukup cek tanpa login)
  assert.equal((await client().post('/api/admin/kuis/questions', { question: okQ })).status, 401);
  // pengaturan: validasi & badgeAt ikut mengubah target lencana
  const cur = (await adm.get('/api/admin/settings')).body.value;
  assert.equal((await adm.put('/api/admin/settings', { value: { ...cur, kuis: { ...cur.kuis, timerSec: 1 } } })).status, 400);
  assert.equal((await adm.put('/api/admin/settings', { value: { ...cur, kuis: { ...cur.kuis, badgeAt: 40 } } })).status, 200);
  assert.equal((await db.one(`select target from quests where id = 'b-kuis-sains'`)).target, 40);
  assert.match((await db.one(`select description from quests where id = 'b-kuis-sains'`)).description, /40 soal/);
  await adm.put('/api/admin/settings', { value: { ...cur, kuis: { ...cur.kuis, badgeAt: 30 } } });
});

test('sinkron bank: hanya menambah ID baru; tidak mengubah, mengaktifkan, atau menambah lagi yang dihapus', async () => {
  const one = KUIS_BANK[0], two = KUIS_BANK[1];
  await db.query(`update kuis_questions set data = jsonb_set(data, '{q}', '"Diubah admin?"'), active = false where id = $1`, [one.id]);
  await db.query(`update kuis_questions set deleted_at = now(), active = false where id = $1`, [two.id]);
  const fresh = { ...one, id: one.id.slice(0, 4) + '777', q: 'Soal baru di rilis berikutnya, benar?' };
  const bad = { ...one, id: one.id.slice(0, 4) + '778', q: 'Tidak sah', explain: '' };
  const r = await syncKuisBank(db, [...KUIS_BANK, fresh, bad]);
  assert.deepEqual([r.added, r.invalid], [1, 1]);
  const row = await db.one(`select data, active from kuis_questions where id = $1`, [one.id]);
  assert.deepEqual([row.data.q, row.active], ['Diubah admin?', false], 'ubahan admin tetap');
  assert.ok((await db.one(`select deleted_at from kuis_questions where id = $1`, [two.id])).deleted_at, 'yang dihapus tidak kembali');
  assert.ok(await db.one(`select 1 from kuis_questions where id = $1`, [fresh.id]));
  assert.equal((await syncKuisBank(db, [...KUIS_BANK, fresh])).added, 0, 'idempoten');
  await db.query(`update kuis_questions set data = $2::text::jsonb, active = true where id = $1`, [one.id, JSON.stringify(one)]);
  await db.query(`update kuis_questions set deleted_at = null, active = true where id = $1`, [two.id]);
  await db.query(`delete from kuis_questions where id = $1`, [fresh.id]);
  invalidateKuis();
});

test('Tantang Teman: soal sama, kunci tetap di server, pemenang & hadiah setelah keduanya main, seri dipecah waktu', async () => {
  now = Date.now();
  const a = await player('Fajar'), b = await player('Gita'), c = await player('Hana');
  await b.c.post('/api/friends', { code: a.code });
  // hanya teman
  assert.equal((await a.c.post('/api/duels', { friendId: c.id, game: 'kuis' })).status, 403);
  const cr = await a.c.post('/api/duels', { friendId: b.id, game: 'kuis' });
  assert.equal(cr.status, 200, JSON.stringify(cr.body));
  const duel = cr.body.duel;
  assert.equal(duel.game, 'kuis');
  for (const k of [...SECRET_KEYS, 'qids', 'meta']) assert.ok(!keysDeep(cr.body).has(k), `duel tanpa ${k}`);
  const list = await b.c.get('/api/duels');
  assert.ok(list.body.games.includes('kuis'));
  for (const k of [...SECRET_KEYS, 'qids', 'meta']) assert.ok(!keysDeep(list.body).has(k));
  // jalur duel mini-game menolak tantangan kuis (tidak ada "bayangan" berisi jawaban)
  assert.equal((await b.c.post(`/api/duels/${duel.id}/start`)).body.error.code, 'kuis_flow');
  // A main: 3 benar dari 5
  const sa = await a.c.post(`/api/kuis/tantang/${duel.id}/start`);
  assert.equal(sa.status, 200, JSON.stringify(sa.body));
  await assertNoKey(sa.raw, sa.body.run.current.q, 'tantang A');
  let run = sa.body.run;
  assert.equal(run.total, 5);
  const qidsA: string[] = [];
  while (!run.done) {
    if (!run.current) { run = (await a.c.post(`/api/kuis/runs/${run.id}/next`)).body.run; continue; }
    const { idx, q } = run.current;
    qidsA.push(q.id);
    later(1000);
    const pick = idx < 3 ? await rightPick(run.id, idx, q.id) : await wrongPick(run.id, idx, q.id);
    run = (await a.c.post(`/api/kuis/runs/${run.id}/answer`, { idx, pick })).body.run;
  }
  let dv = (await b.c.get(`/api/duels/${duel.id}`)).body.duel;
  assert.equal(dv.them.played, true);
  assert.match(dv.them.label, /^3 benar/);
  // B memainkan soal yang SAMA; jawabannya tidak bocor sebelum B menjawab
  const sb = await b.c.post(`/api/kuis/tantang/${duel.id}/start`);
  await assertNoKey(sb.raw, sb.body.run.current.q, 'tantang B');
  assert.equal(sb.body.run.answers.length, 0, 'B tidak melihat jawaban A');
  let rb = sb.body.run;
  const qidsB: string[] = [];
  const ca = await coins(a), cb = await coins(b);
  while (!rb.done) {
    if (!rb.current) { rb = (await b.c.post(`/api/kuis/runs/${rb.id}/next`)).body.run; continue; }
    const { idx, q } = rb.current;
    qidsB.push(q.id);
    later(500); // B sama-sama 3 benar tapi lebih cepat → menang (seri dipecah waktu)
    const pick = idx < 3 ? await rightPick(rb.id, idx, q.id) : await wrongPick(rb.id, idx, q.id);
    rb = (await b.c.post(`/api/kuis/runs/${rb.id}/answer`, { idx, pick })).body.run;
  }
  assert.deepEqual(qidsB, qidsA, 'soal sama persis');
  dv = (await b.c.get(`/api/duels/${duel.id}`)).body.duel;
  assert.equal(dv.status, 'done');
  assert.equal(dv.result, 'menang');
  const d = await db.one(`select c_score, o_score, winner_id from duels where id = $1`, [duel.id]);
  assert.equal(tantangParts(d.c_score).correct, 3);
  assert.equal(tantangParts(d.o_score).correct, 3);
  assert.ok(tantangParts(d.o_score).totalMs < tantangParts(d.c_score).totalMs);
  assert.equal(d.winner_id, b.id);
  assert.equal(await coins(b), cb + 30, 'menang 30 koin (pengaturan duel)');
  assert.equal(await coins(a), ca + 10, 'kalah 10 koin');
  // jatah per hari
  await setKuis({ tantangPerDay: 1 });
  const d2 = (await b.c.post('/api/duels', { friendId: a.id, game: 'kuis' })).body.duel;
  assert.equal((await b.c.post(`/api/kuis/tantang/${d2.id}/start`)).body.error.code, 'daily_limit');
  await setKuis({});
  // kedaluwarsa: tidak bisa dimulai, tanpa hadiah
  await db.query(`update duels set expires_at = now() - interval '1 minute' where id = $1`, [d2.id]);
  assert.equal((await a.c.post(`/api/kuis/tantang/${d2.id}/start`)).body.error.code, 'closed');
  assert.equal((await db.one(`select status from duels where id = $1`, [d2.id])).status, 'expired');
  // dibatalkan yang menantang (jalur duel biasa)
  const d3 = (await a.c.post('/api/duels', { friendId: b.id, game: 'kuis' })).body.duel;
  assert.equal((await a.c.post(`/api/duels/${d3.id}/decline`)).body.status, 'cancelled');
  // seri persis: benar & waktu sama
  const d4 = (await a.c.post('/api/duels', { friendId: b.id, game: 'kuis' })).body.duel;
  for (const p of [a, b]) {
    let r = (await p.c.post(`/api/kuis/tantang/${d4.id}/start`)).body.run;
    r = (await p.c.post(`/api/kuis/runs/${r.id}/akhiri`)).body.run;
    assert.equal(r.done, true);
  }
  const f4 = await db.one(`select status, winner_id, c_score, o_score from duels where id = $1`, [d4.id]);
  assert.deepEqual([f4.status, f4.winner_id, f4.c_score === f4.o_score], ['done', null, true]);
});

test('Cerdas Cermat Bareng: urutan diterima (3/2/0), lonceng, kunci hanya saat jawaban, timer server memajukan ronde', async () => {
  assert.deepEqual([BARENG_GAMES.kuis.min, BARENG_GAMES.kuis.max], [2, 4]);
  assert.deepEqual(BARENG_GAMES.kuis.places, ['house', 'alun']);
  assert.ok(SQUARE_ACTS.panggung.some((a: any) => a.id === 'kuis'), 'bisa dimulai di Panggung alun-alun');
  resetHouses(); resetBareng();
  let bt = Date.now();
  setBarengClock(() => bt);
  const host = await player('Ira'), g1 = await player('Joko'), g2 = await player('Kiki');
  for (const g of [g1, g2]) await g.c.post('/api/friends', { code: host.code });
  const sync = (p: P) => p.c.post(`/api/house/${host.id}/sync`, { roomId: host.room, x: 2, y: 2 });
  await sync(host); await sync(g1); await sync(g2);
  const st = await host.c.post('/api/bareng/start', { game: 'kuis', hostId: host.id });
  assert.equal(st.status, 200, JSON.stringify(st.body));
  const id = st.body.game.id;
  await g1.c.post(`/api/bareng/${id}/join`);
  await g2.c.post(`/api/bareng/${id}/join`);
  assert.equal((await host.c.post(`/api/bareng/${id}/go`)).body.game.phase, 'siap');
  await barengTick();
  let g = (await sync(host)).body.games.find((x: any) => x.id === id);
  assert.equal(g.phase, 'main');
  assert.equal(g.kuis.total, 7);
  assert.ok(KUIS_QUICK.includes(g.kuis.q.type), 'hanya tipe sekali ketuk');
  const raw = JSON.stringify(g);
  for (const k of SECRET_KEYS) assert.ok(!keysDeep(g.kuis).has(k), `tahap tanya tanpa ${k}`);
  const q0 = await qOf(g.kuis.q.id);
  assert.ok(!raw.includes(JSON.stringify(q0.explain).slice(1, -1)));
  // sebelum soal muncul (jeda Siap) jawaban ditolak
  assert.equal((await g1.c.post(`/api/bareng/${id}/move`, { pick: 0 })).body.error.code, 'too_early');
  bt += 2100;
  const key = `${id}:0`;
  const right = (kuisReveal(q0, key) as any).answer, wrong = (right + 1) % q0.options.length;
  assert.ok(kuisCheck(q0, key, right) && kuisPublic(q0, key).options!.length === q0.options.length);
  // Joko benar duluan (lonceng, 3), Ira benar kemudian (2), Kiki salah (0)
  await g1.c.post(`/api/bareng/${id}/move`, { pick: right });
  assert.equal((await g1.c.post(`/api/bareng/${id}/move`, { pick: wrong })).body.error.code, 'answered', 'satu jawaban');
  await host.c.post(`/api/bareng/${id}/move`, { pick: right });
  g = (await g2.c.post(`/api/bareng/${id}/move`, { pick: wrong })).body.game;
  assert.equal(g.kuis.stage, 'jawab', 'semua sudah menjawab → jawaban tampil');
  assert.equal(g.kuis.answer, right);
  assert.ok(g.kuis.explain);
  assert.equal(g.kuis.bell, g1.id);
  assert.deepEqual([g.kuis.points[g1.id], g.kuis.points[host.id], g.kuis.points[g2.id]], [3, 2, 0]);
  // ronde berikutnya setelah jeda jawaban; lalu timer server memajukan ronde tanpa jawaban sama sekali
  bt += 6100; await barengTick();
  g = (await sync(host)).body.games.find((x: any) => x.id === id);
  assert.deepEqual([g.kuis.round, g.kuis.stage], [1, 'tanya']);
  for (let r = 1; r < 7; r++) {
    bt += 2000 + 15_000 + 2100; await sync(host); await sync(g1); await sync(g2); await barengTick();
    g = (await sync(host)).body.games.find((x: any) => x.id === id);
    assert.equal(g.kuis.stage, 'jawab', `ronde ${r + 1}: waktu habis → jawaban tampil`);
    bt += 6100; await sync(host); await sync(g1); await sync(g2); await barengTick();
  }
  g = (await sync(host)).body.games.find((x: any) => x.id === id);
  assert.equal(g.phase, 'selesai');
  await barengTick();
  g = (await sync(host)).body.games.find((x: any) => x.id === id);
  assert.equal(g.results[0].id, g1.id);
  assert.equal(g.results[0].rank, 1);
  // menjawab kurang dari 3 soal: tanpa hadiah & tanpa jatah
  assert.ok(g.results.every((r: any) => r.coins === 0));
  setBarengClock(() => Date.now());
});

test('Cerdas Cermat Bareng di alun-alun (2 pemain): selesai normal → hadiah main bareng & lencana Juara', async () => {
  resetBareng();
  let bt = Date.now();
  setBarengClock(() => bt);
  const a = await player('Lala'), b = await player('Mira');
  const sq = (p: P) => p.c.post('/api/square/sync', { x: 10, y: 18 });
  await sq(a); await sq(b);
  const st = await a.c.post('/api/bareng/start', { game: 'kuis' });
  assert.equal(st.status, 200, JSON.stringify(st.body));
  const id = st.body.game.id;
  await b.c.post(`/api/bareng/${id}/join`);
  await a.c.post(`/api/bareng/${id}/go`);
  await barengTick();
  for (let r = 0; r < 7; r++) {
    bt += 2100;
    const g = (await sq(a)).body.games.find((x: any) => x.id === id);
    const q = await qOf(g.kuis.q.id), right = (kuisReveal(q, `${id}:${r}`) as any).answer;
    await a.c.post(`/api/bareng/${id}/move`, { pick: right });
    await b.c.post(`/api/bareng/${id}/move`, { pick: (right + 1) % q.options.length });
    bt += 6100; await sq(a); await sq(b); await barengTick();
  }
  await barengTick();
  const g = (await sq(a)).body.games.find((x: any) => x.id === id);
  assert.equal(g.phase, 'selesai');
  const ra = g.results.find((r: any) => r.id === a.id), rb = g.results.find((r: any) => r.id === b.id);
  assert.deepEqual([ra.rank, ra.score, rb.rank, rb.score], [1, 21, 2, 0]);
  assert.equal(ra.coins, 25, 'juara 1: coopCoins penuh');
  assert.equal(rb.coins, 15, 'juara 2: 60%');
  assert.equal((await db.one(`select count from daily_counters where user_id = $1 and key = 'coop'`, [a.id])).count, 1);
  const juara = await db.one(`select completed_at from quest_progress where user_id = $1 and quest_id = 'b-kuis-juara'`, [a.id]);
  assert.ok(juara?.completed_at, 'lencana Juara Cerdas Cermat');
  assert.ok(!(await db.one(`select 1 from quest_progress where user_id = $1 and quest_id = 'b-kuis-juara'`, [b.id])));
  setBarengClock(() => Date.now());
});

test('papan peringkat mingguan: hanya aku & teman, poin Kuis Harian minggu ini', async () => {
  now = Date.UTC(2026, 11, 7, 3, 0); // Senin 7 Des
  const a = await player('Nina'), b = await player('Oki'), c = await player('Pras');
  await b.c.post('/api/friends', { code: a.code });
  await playHarian(a, (i) => i < 4);
  await playHarian(b, () => true);
  await playHarian(c, () => true);
  const board = (await a.c.get('/api/kuis')).body.week.board;
  const ids = board.map((r: any) => r.id);
  assert.ok(ids.includes(a.id) && ids.includes(b.id));
  assert.ok(!ids.includes(c.id), 'bukan teman tidak tampil');
  assert.equal(board[0].id, b.id);
  assert.equal(board.find((r: any) => r.me).id, a.id);
  // minggu berikutnya: mulai dari nol
  now = Date.UTC(2026, 11, 14, 3, 0);
  const nb = (await a.c.get('/api/kuis')).body.week.board;
  assert.deepEqual(nb.map((r: any) => [r.id, r.points]), [[a.id, 0]]);
});

test('reset peluncuran mengosongkan data kuis pemain & statistik soal', async () => {
  const a = await player('Qori');
  now = Date.UTC(2026, 11, 15, 3, 0);
  await playHarian(a, () => true);
  const q = (await db.one(`select id from kuis_questions limit 1`)).id;
  await a.c.post('/api/kuis/report', { qid: q, reason: 'salah' });
  for (const t of ['kuis_runs', 'kuis_answers', 'kuis_seen', 'kuis_streaks', 'kuis_reports']) assert.ok((await db.one(`select count(*)::int c from ${t}`)).c > 0, t);
  const adm = await owner();
  const r = await adm.post('/api/admin/launch/reset', { confirm: 'RESET BUPI', mode: 'progress' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  for (const t of ['kuis_runs', 'kuis_answers', 'kuis_seen', 'kuis_streaks', 'kuis_reports']) assert.equal((await db.one(`select count(*)::int c from ${t}`)).c, 0, `${t} kosong`);
  assert.equal((await db.one(`select coalesce(sum(shown + answered + correct), 0)::int s from kuis_questions`)).s, 0);
  assert.ok((await db.one(`select count(*)::int c from kuis_questions`)).c >= 40, 'bank soal tetap');
});
