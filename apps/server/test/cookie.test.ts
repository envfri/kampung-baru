// Cookie sesi hanya ber-flag Secure bila PUBLIC_URL https://. Di http:// (mis. uji lewat IP:8787 sebelum
// domain siap) flag Secure membuat browser membuang cookie, sehingga semua request berikutnya 401.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config';

const { buildApp } = await import('../src/app');
let app: any;
before(async () => { ({ app } = await buildApp({ memoryDb: true, logger: false, rateLimit: false, worker: false })); });
after(async () => app?.close());

const cookieOf = (res: any) => [res.headers['set-cookie']].flat().find((c: string) => c?.startsWith('kb_s=')) as string;

test('PUBLIC_URL http:// → cookie tanpa Secure, dan sesi tetap terbaca', async () => {
  const prev = config.publicUrl;
  config.publicUrl = 'http://192.0.2.10:8787';
  try {
    const g = await app.inject({ method: 'POST', url: '/api/auth/guest' });
    const c = cookieOf(g);
    assert.ok(c, 'cookie sesi dikirim');
    assert.doesNotMatch(c, /;\s*Secure/i);
    const me = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: c.split(';')[0] } });
    assert.equal(me.statusCode, 200);
  } finally { config.publicUrl = prev; }
});

test('PUBLIC_URL https:// → cookie Secure', async () => {
  const prev = config.publicUrl;
  config.publicUrl = 'https://contoh.id';
  try {
    const g = await app.inject({ method: 'POST', url: '/api/auth/guest' });
    assert.match(cookieOf(g), /;\s*Secure/i);
  } finally { config.publicUrl = prev; }
});
