// Peta kampung: letak Alun-alun & Lapangan Lomba ditukar (paket konten 16) tanpa menimpa jalan / tempat lain,
// dan letak yang sudah diubah admin tidak disentuh. Paket 21: Papan Lowongan & Pos Ronda juga tidak menimpa apa pun.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config';

config.paymentProvider = 'mock';
config.adminEmail = 'owner@test.local';
config.adminPassword = 'rahasia-sekali-123';
const { buildApp } = await import('../src/app');
const { seedPackV16, PETA_TUKAR } = await import('../src/db/seed-peta');
const { invalidateCaches } = await import('../src/lib/core');
let app: any;
let db: any;
before(async () => { ({ app, db } = await buildApp({ memoryDb: true, logger: false, rateLimit: false, worker: false })); });
after(async () => { await app?.close(); });

const locs = async () => JSON.parse((await app.inject({ method: 'GET', url: '/api/catalog' })).body).locations as { id: string; kind: string; x: number; y: number; style?: any }[];
const catVer = async () => Number((await db.one(`select value from settings where key = 'catalog_version'`))?.value ?? 0);

/** kotak gambar tiap tempat di peta (lihat special() di art.ts): [kiri, atas, kanan, bawah], label di (x, y) */
function box(l: { kind: string; x: number; y: number; style?: any }): [number, number, number, number] {
  const { x, y } = l;
  if (l.kind === 'square') return [x - 96, y - 140, x + 96, y + 14];
  if (l.kind === 'race') return [x - 82, y - 106, x + 82, y + 14];
  if (l.kind === 'garden') return [x - 57, y - 84, x + 43, y + 14];
  if (l.kind === 'pond') return [x - 78, y - 86, x + 78, y + 14];
  // Papan Lowongan (jobBoardSVG + label lebar) & Pos Ronda (posRondaSVG + label), lihat art-kerja.ts
  if (l.kind === 'jobs') return [x - 75, y - 100, x + 75, y + 14];
  if (l.kind === 'ronda') return [x - 58, y - 96, x + 58, y + 14];
  const w = Number(l.style?.w ?? 100);
  return [x - w / 2 - 6, y - 100, x + w / 2 + 6, y + 14];
}
const hit = (a: number[], b: number[]) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
/** jalan utama (y 240, lebar 38) & jalan ke bawah (x 420, y 240–470) */
const ROADS = [[-20, 221, 1280, 259], [401, 240, 439, 470]];

test('peta: Alun-alun di kiri bawah (dekat Rumahku & Kebun), Lapangan Lomba di ujung kanan', async () => {
  const L = await locs();
  const alun = L.find((l) => l.id === 'alun')!, lap = L.find((l) => l.id === 'lapangan')!;
  assert.deepEqual([alun.x, alun.y], [PETA_TUKAR.alun.to.x, PETA_TUKAR.alun.to.y]);
  assert.deepEqual([lap.x, lap.y], [PETA_TUKAR.lapangan.to.x, PETA_TUKAR.lapangan.to.y]);
  assert.ok(alun.x < 420 && lap.x > 1000, 'tertukar: alun-alun di kiri jalan ke bawah, lapangan di kanan');
});

test('peta: gambar Alun-alun & Lapangan Lomba tidak menimpa jalan atau tempat lain', async () => {
  const L = await locs();
  for (const id of ['alun', 'lapangan']) {
    const me = L.find((l) => l.id === id)!;
    const b = box(me);
    for (const r of ROADS) assert.ok(!hit(b, r), `${id} menimpa jalan ${JSON.stringify(r)} (${JSON.stringify(b)})`);
    for (const o of L) if (o.id !== id) assert.ok(!hit(b, box(o)), `${id} menimpa ${o.id}`);
    assert.ok(b[0] >= 0 && b[2] <= 1260, `${id} di dalam peta`);
  }
});

test('paket 16: letak lama ditukar sekali & katalog dimuat ulang; letak buatan admin tidak disentuh', async () => {
  // keadaan server lama: letak bawaan lama, paket belum jalan
  const reset = async (alunX: number) => {
    await db.query(`update locations set x = $1, y = 412 where id = 'alun'`, [alunX]);
    await db.query(`update locations set x = 304, y = 384 where id = 'lapangan'`);
    await db.query(`delete from settings where key = 'pack_peta_tukar'`);
    invalidateCaches();
  };
  await reset(1150);
  const v0 = await catVer();
  assert.equal(await seedPackV16(db), true);
  assert.ok((await catVer()) > v0, 'versi katalog naik (peta di HP ikut berubah)');
  invalidateCaches();
  let L = await locs();
  assert.equal(L.find((l) => l.id === 'alun')!.x, 300);
  assert.equal(L.find((l) => l.id === 'lapangan')!.x, 1150);
  // berjalan sekali saja
  assert.equal(await seedPackV16(db), false);
  // admin sudah memindah alun-alun sendiri → tidak ditukar
  await reset(999);
  assert.equal(await seedPackV16(db), false);
  invalidateCaches();
  L = await locs();
  assert.equal(L.find((l) => l.id === 'alun')!.x, 999);
  assert.equal(L.find((l) => l.id === 'lapangan')!.x, 304);
});

test('peta: Papan Lowongan & Pos Ronda (paket 21) tidak menimpa jalan, tempat lain, atau labelnya', async () => {
  // uji paket 16 di atas meninggalkan letak buatan admin: kembalikan letak bawaan sekarang
  await db.query(`update locations set x = $1, y = $2 where id = 'alun'`, [PETA_TUKAR.alun.to.x, PETA_TUKAR.alun.to.y]);
  await db.query(`update locations set x = $1, y = $2 where id = 'lapangan'`, [PETA_TUKAR.lapangan.to.x, PETA_TUKAR.lapangan.to.y]);
  invalidateCaches();
  const L = await locs();
  /** label (pil) tiap tempat: lebar dari panjang nama (lihat pill() di art.ts); bangunan & papan lowongan di bawah kaki, lainnya di (x, y) */
  const pillBox = (l: { kind: string; name?: string; x: number; y: number }) => {
    const w = String(l.name ?? '').length * 8.2 + 26, top = ['shop', 'pearl', 'social', 'games', 'home', 'jobs'].includes(l.kind) ? l.y + 12 : l.y;
    return [l.x - w / 2, top, l.x + w / 2, top + 25];
  };
  for (const id of ['lowongan', 'ronda']) {
    const me = L.find((l) => l.id === id)!;
    assert.ok(me, `${id} ada di peta`);
    const b = box(me);
    for (const r of ROADS) assert.ok(!hit(b, r), `${id} menimpa jalan ${JSON.stringify(r)} (${JSON.stringify(b)})`);
    for (const o of L) if (o.id !== id) {
      assert.ok(!hit(b, box(o)), `${id} menimpa ${o.id}`);
      assert.ok(!hit(pillBox(me as any), pillBox(o as any)), `label ${id} menimpa label ${o.id}`);
    }
    assert.ok(b[0] >= 0 && b[2] <= 1260 && b[1] >= -40, `${id} di dalam peta`);
  }
  // papan lowongan di tepi jalan (deret toko), pos ronda di deret bawah
  assert.ok(L.find((l) => l.id === 'lowongan')!.y < 240 && L.find((l) => l.id === 'ronda')!.y > 260);
});
