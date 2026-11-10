// Versi & changelog: data changelog sah, sinkron dengan package.json & CHANGELOG.md, API versi & riwayat deploy.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { config } from '../src/config';
import { APP_VERSION, CHANGELOG, changelogMarkdown, compareVersion, playerReleases } from '@kb/shared';

config.adminEmail = 'owner@test.local';
config.adminPassword = 'rahasia-sekali-123';

const { buildApp } = await import('../src/app');
const { recordDeploy, BUILD } = await import('../src/lib/version');
let app: any;
let db: any;

before(async () => {
  ({ app, db } = await buildApp({ memoryDb: true, logger: false, rateLimit: false, worker: false }));
});
after(async () => app?.close());

const root = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

test('changelog: versi urut menurun, unik, tanggal & isi sah', () => {
  const seen = new Set<string>();
  for (let i = 0; i < CHANGELOG.length; i++) {
    const r = CHANGELOG[i];
    assert.match(r.version, /^\d+\.\d+\.\d+$/, r.version);
    assert.ok(!seen.has(r.version), `versi ganda ${r.version}`);
    seen.add(r.version);
    assert.match(r.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(!Number.isNaN(Date.parse(r.date)));
    assert.ok(r.title.length > 2 && r.items.length > 0, `${r.version} butuh judul & isi`);
    if (i > 0) {
      assert.ok(compareVersion(CHANGELOG[i - 1].version, r.version) > 0, `${CHANGELOG[i - 1].version} harus lebih baru dari ${r.version}`);
      assert.ok(CHANGELOG[i - 1].date >= r.date, `tanggal ${CHANGELOG[i - 1].version} tidak boleh lebih lama`);
    }
  }
  assert.equal(APP_VERSION, CHANGELOG[0].version);
  assert.ok(playerReleases().length > 0);
  assert.ok(playerReleases('0.8.0').every((r) => compareVersion(r.version, '0.8.0') > 0));
});

test('changelog: package.json & CHANGELOG.md sinkron (jalankan npm run changelog)', () => {
  assert.equal(JSON.parse(root('package.json')).version, APP_VERSION, 'samakan "version" di package.json root dengan versi changelog terbaru');
  assert.equal(root('CHANGELOG.md'), changelogMarkdown() + '\n', 'CHANGELOG.md belum diperbarui: jalankan npm run changelog');
});

test('versi: /api/version publik, info sistem admin, riwayat deploy tidak ganda', async () => {
  const v = await app.inject({ method: 'GET', url: '/api/version' });
  assert.equal(v.statusCode, 200);
  assert.equal(v.headers['cache-control'], 'no-store');
  assert.equal(JSON.parse(v.body).version, APP_VERSION);

  assert.equal((await app.inject({ method: 'GET', url: '/api/admin/system' })).statusCode, 401);
  const login = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { email: 'owner@test.local', password: 'rahasia-sekali-123' } });
  const cookie = String(login.headers['set-cookie']).split(';')[0];
  const s = JSON.parse((await app.inject({ method: 'GET', url: '/api/admin/system', headers: { cookie } })).body);
  assert.equal(s.build.version, APP_VERSION);
  assert.equal(s.database.kind, 'PGlite');
  assert.ok(s.migrations.some((m: any) => m.name === '009_deploys.sql'));
  assert.equal(s.deploys.length, 1);
  assert.equal(s.deploys[0].version, APP_VERSION);
  assert.equal(s.deploys[0].commit, BUILD.commit);

  // server dijalankan ulang dengan versi yang sama: tidak dicatat lagi
  assert.equal(await recordDeploy(db), false);
  assert.equal((await db.one(`select count(*)::int c from deploys`)).c, 1);
});

test('integrasi: semua URL webhook dari PUBLIC_URL, hanya untuk admin', async () => {
  const login = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { email: 'owner@test.local', password: 'rahasia-sekali-123' } });
  const cookie = String(login.headers['set-cookie']).split(';')[0];
  const r = await app.inject({ method: 'GET', url: '/api/admin/integrations', headers: { cookie } });
  assert.equal(r.statusCode, 200);
  const d = JSON.parse(r.body);
  const url = (key: string) => d.items.find((i: any) => i.key === key).urls[0].url as string;
  assert.equal(url('zepay'), `${config.publicUrl}/api/payments/zepay/webhook`);
  assert.equal(url('klikflow'), `${config.publicUrl}/api/wa/klikflow/webhook`);
  assert.match(url('mailketing'), /\/api\/email\/mailketing\/[\w-]{32}$/);
  assert.equal(url('midtrans'), `${config.publicUrl}/api/payments/midtrans/notify`);
  assert.equal(url('google'), config.publicUrl);
  // URL webhook Mailketing yang tercantum benar-benar diterima server
  const hook = url('mailketing').replace(config.publicUrl, '');
  assert.equal((await app.inject({ method: 'POST', url: hook, payload: { type: 'emailopen', email: 'x@contoh.id' } })).statusCode, 200);
  // moderator tidak boleh melihat (URL Mailketing memuat kunci rahasia)
  await app.inject({ method: 'POST', url: '/api/admin/admins', headers: { cookie }, payload: { email: 'mod9@test.local', password: 'moderator-123', role: 'moderator' } });
  const m = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { email: 'mod9@test.local', password: 'moderator-123' } });
  const mc = String(m.headers['set-cookie']).split(';')[0];
  assert.equal((await app.inject({ method: 'GET', url: '/api/admin/integrations', headers: { cookie: mc } })).statusCode, 403);
});
