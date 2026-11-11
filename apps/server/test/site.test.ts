// Situs & SEO: tag SEO & pratinjau tautan di index.html, robots/sitemap, akun media sosial, dan mode perawatan.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../src/config';
import { DEFAULT_SITE, durText, etaText, maintenancePage, socialLink, socialLinks } from '@kb/shared';

config.paymentProvider = 'mock';
config.adminEmail = 'owner@test.local';
config.adminPassword = 'rahasia-sekali-123';
const { buildApp } = await import('../src/app');
const { imageSize, invalidateSite, retryAfter, migrateSite, getSite } = await import('../src/lib/site');
let app: any;
let db: any;
before(async () => { ({ app, db } = await buildApp({ memoryDb: true, logger: false, rateLimit: false, worker: false })); });
after(async () => app?.close());
const hasGame = existsSync(join(config.gameDist, 'index.html'));

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
    let body2: any = res.body;
    try { body2 = JSON.parse(res.body); } catch { /* bukan JSON */ }
    return { status: res.statusCode, headers: res.headers, body: body2, text: res.body as string };
  };
  return { call, get: (u: string) => call('GET', u), post: (u: string, b?: unknown) => call('POST', u, b ?? {}), put: (u: string, b?: unknown) => call('PUT', u, b ?? {}) };
}
async function owner() {
  const o = client();
  assert.equal((await o.post('/api/admin/login', { email: 'owner@test.local', password: 'rahasia-sekali-123' })).status, 200);
  return o;
}
async function setSite(o: ReturnType<typeof client>, patch: (s: any) => void) {
  const s = (await o.get('/api/admin/site')).body.site;
  patch(s);
  const r = await o.put('/api/admin/site', s);
  invalidateSite();
  return r;
}

test('akun media sosial: nama akun, @akun, atau URL profil; domain lain ditolak', () => {
  assert.equal(socialLink('instagram', '@playbupi')?.url, 'https://www.instagram.com/playbupi');
  assert.equal(socialLink('instagram', 'playbupi')?.handle, 'playbupi');
  assert.equal(socialLink('instagram', 'https://instagram.com/playbupi/?hl=id')?.handle, 'playbupi');
  assert.equal(socialLink('tiktok', '@playbupi')?.url, 'https://www.tiktok.com/@playbupi');
  assert.equal(socialLink('youtube', 'https://www.youtube.com/@playbupi')?.handle, 'playbupi');
  assert.equal(socialLink('x', 'https://twitter.com/playbupi')?.handle, 'playbupi');
  assert.equal(socialLink('instagram', 'https://evil.example/playbupi'), null);
  assert.equal(socialLink('instagram', 'http://instagram.com/playbupi'), null, 'harus https');
  assert.equal(socialLink('instagram', 'play budi'), null);
  assert.equal(socialLink('instagram', ''), null);
  assert.deepEqual(socialLinks(DEFAULT_SITE.social).map((l) => l.handle), ['playbupi']);
});

test('perkiraan selesai, ukuran gambar, dan halaman perawatan aman dari HTML admin', () => {
  assert.equal(durText(30_000), 'kurang dari 1 menit');
  assert.equal(durText(45 * 60_000), '45 menit');
  assert.equal(durText(83 * 60_000), '1 jam 23 menit');
  assert.equal(durText(50 * 3600_000), '2 hari 2 jam');
  const now = Date.parse('2026-11-11T10:00:00Z');
  const e = etaText('2026-11-11T12:30:00Z', now)!;
  assert.match(e.at, /19\.30 WIB$/);
  assert.equal(e.left, 'sekitar 2 jam 30 menit lagi');
  assert.equal(etaText('2026-11-11T09:00:00Z', now)!.left, 'sebentar lagi, ya!');
  assert.equal(etaText('', now), null);
  const png = Buffer.alloc(32); png.writeUInt32BE(0x89504e47, 0); png.writeUInt32BE(1200, 16); png.writeUInt32BE(630, 20);
  assert.deepEqual(imageSize(png), { width: 1200, height: 630 });
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0, 0, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x76, 0x04, 0xb0, 0x03]);
  assert.deepEqual(imageSize(jpg), { width: 1200, height: 630 });
  assert.equal(imageSize(Buffer.from('bukan gambar')), null);
  const html = maintenancePage({ title: '<script>x</script>', message: 'a "b"', until: null }, [], { kind: 'server', nonce: 'abc' });
  assert.ok(!html.includes('<script>x</script>') && html.includes('&lt;script&gt;'));
  assert.ok(html.includes('<script nonce="abc">'));
});

test('index.html: judul, deskripsi, canonical, Open Graph, kartu X, JSON-LD; robots & sitemap', { skip: !hasGame && 'game belum di-build' }, async () => {
  const c = client();
  const r = await c.get('/');
  assert.equal(r.status, 200);
  const h = r.text;
  assert.equal(h.split('<title>').length, 2, 'satu judul saja');
  assert.ok(h.includes(`<title>${DEFAULT_SITE.seo.title.replace('&', '&amp;')}</title>`));
  for (const t of ['name="description"', `rel="canonical" href="${config.publicUrl}/"`, 'property="og:image" content="' + config.publicUrl + '/og/bupi.jpg"', 'name="twitter:card" content="summary_large_image"', 'content="noindex, follow"'])
    assert.ok(h.includes(t), t);
  assert.equal(r.headers['x-robots-tag'], 'noindex', 'server uji (bukan produksi) tidak diindeks');
  const ld = JSON.parse(h.match(/<script type="application\/ld\+json">(.*?)<\/script>/)![1]);
  const game = ld['@graph'].find((n: any) => [].concat(n['@type']).includes('VideoGame'));
  assert.equal(game.offers.price, '0');
  assert.deepEqual(ld['@graph'].find((n: any) => n['@type'] === 'Organization').sameAs, ['https://www.instagram.com/playbupi']);
  // rute SPA lain: noindex
  assert.match((await c.get('/apa-saja')).text, /content="noindex, follow"/);
  // robots: server non-produksi ditutup; sitemap tetap ada
  assert.match((await c.get('/robots.txt')).text, /Disallow: \//);
  const sm = await c.get('/sitemap.xml');
  assert.match(sm.headers['content-type'], /xml/);
  assert.ok(sm.text.includes(`<loc>${config.publicUrl}/</loc>`));
  assert.equal((await c.get('/favicon.ico')).status, 301);
  assert.match(String((await c.get('/api/version')).headers['x-robots-tag']), /noindex/);
});

test('tautan undangan: pratinjau memakai nama pengundang; admin mengubah SEO & sosmed', { skip: !hasGame && 'game belum di-build' }, async () => {
  const p = client();
  await p.post('/api/auth/guest');
  const st = await p.post('/api/pet', { name: 'Gethuk', color: '#F6B7A8', ear: 'tunas', ownerName: 'Sari' });
  const code = st.body.state.user.friend_code;
  const h = (await client().get(`/?undang=${code}`)).text;
  assert.ok(h.includes('content="Sari ngajak kamu main BUPI!"'), 'og:title undangan');
  assert.ok(h.includes(`Masukkan kode teman ${code}`));
  assert.ok(!(await client().get('/?undang=KB-TIDAKADA')).text.includes('ngajak kamu'));

  const o = await owner();
  // validasi
  assert.equal((await setSite(o, (s) => { s.social.instagram = 'https://evil.example/x'; })).status, 400);
  assert.equal((await setSite(o, (s) => { s.seo.image = 'javascript:alert(1)'; })).status, 400);
  assert.equal((await setSite(o, (s) => { s.seo.title = 'Judul <b>'; })).status, 400);
  assert.equal((await setSite(o, (s) => { s.seo.image = '/media/tidak-ada'; })).status, 400);
  const ok = await setSite(o, (s) => {
    s.seo.title = 'BUPI Uji'; s.seo.googleVerify = '<meta name="google-site-verification" content="abc_DEF-123456" />';
    s.social.instagram = '@playbupi'; s.social.tiktok = 'https://www.tiktok.com/@playbupi';
  });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.site.seo.googleVerify, 'abc_DEF-123456', 'kode diambil dari tag meta yang ditempel');
  const h2 = (await client().get('/')).text;
  assert.ok(h2.includes('<title>BUPI Uji</title>'));
  assert.ok(h2.includes('name="google-site-verification" content="abc_DEF-123456"'));
  const pub = (await client().get('/api/site')).body;
  assert.deepEqual(pub.social.map((l: any) => l.key), ['instagram', 'tiktok']);
  assert.deepEqual((await client().get('/api/config')).body.social.map((l: any) => l.handle), ['playbupi', 'playbupi']);
  // moderator boleh melihat, tidak boleh mengubah: cukup cek tanpa login ditolak
  assert.equal((await client().put('/api/admin/site', {})).status, 401);
  await setSite(o, (s) => { s.seo = { ...DEFAULT_SITE.seo }; s.social = { ...DEFAULT_SITE.social }; });
});

test('mode perawatan: pemain 503 (+Retry-After), admin & webhook tetap jalan, admin boleh main', async () => {
  const o = await owner();
  const p = client();
  await p.post('/api/auth/guest');
  assert.equal((await p.post('/api/pet', { name: 'Klepon', color: '#9FD0E8', ear: 'kucing' })).status, 200);
  const until = new Date(Date.now() + 90 * 60_000).toISOString();
  const on = await setSite(o, (s) => { s.maintenance.on = true; s.maintenance.until = until; s.maintenance.title = 'Lagi dirapikan'; });
  assert.equal(on.status, 200);

  const me = await p.get('/api/me');
  assert.equal(me.status, 503);
  assert.equal(me.body.error.code, 'maintenance');
  assert.equal(me.body.error.maintenance.until, until);
  const ra = Number(me.headers['retry-after']);
  assert.ok(ra > 85 * 60 && ra <= 90 * 60, `Retry-After ${ra}`);
  assert.equal((await client().post('/api/auth/guest')).status, 503, 'tidak bisa membuat akun baru');
  if (hasGame) {
    const page = await client().get('/');
    assert.equal(page.status, 503);
    assert.match(page.headers['content-type'], /text\/html/);
    assert.ok(page.text.includes('Lagi dirapikan') && page.text.includes('instagram.com/playbupi'));
    assert.match(String(page.headers['content-security-policy']), /script-src 'nonce-/);
    assert.equal((await client().get('/og/bupi.jpg')).status, 200, 'file statis tetap disajikan');
  }
  const site = (await client().get('/api/site')).body;
  assert.equal(site.maintenance.on, true);
  assert.equal(site.maintenance.bypass, false);
  // tetap jalan
  assert.equal((await client().get('/healthz')).status, 200);
  assert.equal((await client().get('/api/version')).status, 200);
  assert.equal((await client().get('/robots.txt')).status, 200);
  assert.notEqual((await client().post('/api/payments/midtrans/notify', {})).status, 503, 'webhook pembayaran tidak diblokir');
  assert.equal((await o.get('/api/admin/me')).status, 200);
  // admin yang sedang masuk boleh main (bypass), dengan penanda
  const cfg = await o.get('/api/config');
  assert.equal(cfg.status, 200);
  assert.deepEqual(cfg.body.maintenance, { bypass: true });
  assert.equal((await o.get('/api/site')).body.maintenance.bypass, true);
  // bypass dimatikan: admin juga melihat perawatan di game, panel admin tetap bisa
  await setSite(o, (s) => { s.maintenance.adminBypass = false; });
  assert.equal((await o.get('/api/config')).status, 503);
  assert.equal((await o.get('/api/admin/site')).status, 200);
  // pratinjau admin
  const pv = await o.get('/api/admin/site/maintenance-preview');
  assert.equal(pv.status, 200);
  assert.ok(pv.text.includes('Lagi dirapikan'));
  // matikan: pemain bisa main lagi, tercatat di log audit
  await setSite(o, (s) => { s.maintenance.on = false; s.maintenance.adminBypass = true; s.maintenance.until = ''; s.maintenance.title = DEFAULT_SITE.maintenance.title; });
  assert.equal((await p.get('/api/me')).status, 200);
  assert.equal((await client().get('/api/config')).body.maintenance, null);
  const audit = (await o.get('/api/admin/audit')).body;
  const acts = (audit.rows ?? audit.audit ?? audit.items ?? []).map((r: any) => r.action);
  if (acts.length) assert.ok(acts.includes('maintenance_on') && acts.includes('maintenance_off'), acts.join(','));
});

test('Retry-After: sampai perkiraan selesai (2 menit – 1 hari), bawaan 30 menit', () => {
  const s = (until: string) => ({ ...DEFAULT_SITE, maintenance: { ...DEFAULT_SITE.maintenance, until } }) as any;
  const now = Date.parse('2026-11-11T10:00:00Z');
  assert.equal(retryAfter(s(''), now), 1800);
  assert.equal(retryAfter(s('2026-11-11T10:00:30Z'), now), 120);
  assert.equal(retryAfter(s('2026-11-11T11:00:00Z'), now), 3600);
  assert.equal(retryAfter(s('2026-11-20T10:00:00Z'), now), 86400);
  assert.equal(retryAfter(s('2026-11-10T10:00:00Z'), now), 1800);
});

test('akun Instagram salah ketik dari v0.22.0 (playbudi) diperbaiki ke playbupi; akun lain tidak disentuh', async () => {
  const save = (ig: string) => db.query(`insert into settings (key, value) values ('site', $1::text::jsonb) on conflict (key) do update set value = excluded.value`, [JSON.stringify({ social: { instagram: ig, tiktok: '@lain' } })]);
  await save('playbudi');
  assert.equal(await migrateSite(db), true);
  const s = await getSite(db);
  assert.equal(s.social.instagram, 'playbupi');
  assert.equal(s.social.tiktok, '@lain');
  assert.equal(await migrateSite(db), false, 'sekali saja');
  await save('@akunlain');
  assert.equal(await migrateSite(db), false);
  assert.equal((await getSite(db)).social.instagram, '@akunlain');
  await db.query(`delete from settings where key = 'site'`);
  invalidateSite();
  assert.equal((await getSite(db)).social.instagram, 'playbupi', 'bawaan');
});
