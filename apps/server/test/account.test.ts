// Akun tamu & pindah perangkat: sesi bergulir, kode pindah perangkat, tautkan email/Google dengan konfirmasi pindah akun.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config';

config.paymentProvider = 'mock';
const { buildApp } = await import('../src/app');
let app: any;
let db: any;
before(async () => { ({ app, db } = await buildApp({ memoryDb: true, logger: false, rateLimit: false, worker: false })); });
after(async () => app?.close());

function client() {
  let cookie = '';
  let lastSetCookie: string[] = [];
  const call = async (method: string, url: string, body?: unknown) => {
    const res = await app.inject({ method, url, payload: body as any, headers: cookie ? { cookie } : {} });
    const set = res.headers['set-cookie'];
    lastSetCookie = set ? (Array.isArray(set) ? set : [set]) : [];
    if (set) {
      const jar = new Map(cookie ? cookie.split('; ').map((c: string) => c.split('=') as [string, string]) : []);
      for (const c of lastSetCookie) { const [kv] = c.split(';'); const [k, v] = kv.split('='); if (v) jar.set(k, v); else jar.delete(k); }
      cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    }
    return { status: res.statusCode, body: res.body ? (() => { try { return JSON.parse(res.body); } catch { return res.body; } })() : null };
  };
  return { call, get: (u: string) => call('GET', u), post: (u: string, b?: unknown) => call('POST', u, b ?? {}), setCookie: () => lastSetCookie };
}
async function guest(pet: string) {
  const c = client();
  await c.post('/api/auth/guest');
  const p = await c.post('/api/pet', { name: pet, color: '#F6B7A8', ear: 'tunas' });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  return { c, id: p.body.state.user.id as string };
}

test('sesi bergulir: dipakai = masa berlaku sesi & cookie diperpanjang', async () => {
  const { c, id } = await guest('Bola');
  await db.query(`update sessions set expires_at = now() + interval '10 days' where user_id = $1`, [id]);
  const me = await c.get('/api/me');
  assert.equal(me.status, 200);
  const row = await db.one(`select extract(epoch from (expires_at - now())) / 86400 as days from sessions where user_id = $1`, [id]);
  assert.ok(Number(row.days) > config.sessionDays - 1, `sesi diperpanjang (${row.days} hari)`);
  assert.ok(c.setCookie().some((s: string) => s.startsWith('kb_s=') && /Max-Age=\d+/.test(s)), 'cookie ikut diperbarui');
  // permintaan berikutnya di hari yang sama tidak menulis ulang
  await c.get('/api/me');
  assert.equal(c.setCookie().length, 0, 'tidak perlu set-cookie lagi');
});

test('kode pindah perangkat: sekali pakai, kedaluwarsa, dan konfirmasi bila perangkat memakai akun tamu lain', async () => {
  const a = await guest('Mochi');
  const mk = await a.c.post('/api/auth/transfer');
  assert.equal(mk.status, 200, JSON.stringify(mk.body));
  assert.match(mk.body.code, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  // perangkat baru (belum masuk): kode bisa diketik huruf kecil/tanpa strip
  const hp = client();
  assert.equal((await hp.get('/api/me')).status, 401);
  const r = await hp.post('/api/auth/transfer/redeem', { code: mk.body.code.toLowerCase().replace('-', ' ') });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.state.user.id, a.id);
  assert.equal(r.body.state.pet.name, 'Mochi');
  assert.equal((await hp.get('/api/me')).body.user.id, a.id, 'perangkat baru sudah masuk');
  assert.equal((await a.c.get('/api/me')).status, 200, 'perangkat lama tetap masuk');
  assert.equal((await client().post('/api/auth/transfer/redeem', { code: mk.body.code })).body.error?.code, 'transfer_invalid', 'sekali pakai');
  assert.equal((await client().post('/api/auth/transfer/redeem', { code: 'ABCD-EFGH' })).body.error?.code, 'transfer_invalid');
  // kode baru membatalkan kode lama yang belum dipakai
  const k1 = (await a.c.post('/api/auth/transfer')).body.code;
  const k2 = (await a.c.post('/api/auth/transfer')).body.code;
  assert.equal((await client().post('/api/auth/transfer/redeem', { code: k1 })).body.error?.code, 'transfer_invalid', 'kode lama batal');
  assert.equal((await a.c.post('/api/auth/transfer/redeem', { code: k2 })).body.error?.code, 'transfer_same');
  // kedaluwarsa
  await db.query(`update transfer_codes set expires_at = now() - interval '1 second' where user_id = $1 and used_at is null`, [a.id]);
  assert.equal((await client().post('/api/auth/transfer/redeem', { code: k2 })).body.error?.code, 'transfer_invalid', 'kedaluwarsa');
  // perangkat yang sudah memakai akun tamu lain: tanya dulu, baru pindah
  const k3 = (await a.c.post('/api/auth/transfer')).body.code;
  const other = await guest('Kopi');
  const ask = await other.c.post('/api/auth/transfer/redeem', { code: k3 });
  assert.equal(ask.body.error?.code, 'transfer_confirm');
  assert.equal(ask.body.error.guest, true);
  assert.equal(ask.body.error.current.pet, 'Kopi');
  assert.equal(ask.body.error.other.pet, 'Mochi');
  const sw = await other.c.post('/api/auth/transfer/redeem', { code: k3, switch: true });
  assert.equal(sw.status, 200, JSON.stringify(sw.body));
  assert.equal(sw.body.switched, true);
  assert.equal((await other.c.get('/api/me')).body.user.id, a.id);
  // dimatikan admin
  const { invalidateCaches } = await import('../src/lib/core');
  const before = (await db.one(`select value from settings where key = 'game'`))?.value ?? {};
  await db.query(`insert into settings (key, value) values ('game', $1::text::jsonb) on conflict (key) do update set value = excluded.value`, [JSON.stringify({ ...before, account: { transferCodes: false } })]);
  invalidateCaches();
  assert.equal((await a.c.post('/api/auth/transfer')).status, 403, 'kode pindah bisa dimatikan admin');
  assert.equal((await app.inject({ method: 'GET', url: '/api/config' }).then((r: any) => r.json())).login.transfer, false);
  await db.query(`update settings set value = $1::text::jsonb where key = 'game'`, [JSON.stringify(before)]);
  invalidateCaches();
});

test('tautkan email ke akun tamu; email yang sudah dipakai akun lain minta konfirmasi dulu', async () => {
  const b = await guest('Tempe');
  const st = await b.c.post('/api/auth/email/start', { email: 'tempe@contoh.id' });
  assert.ok(st.body.devCode);
  const v = await b.c.post('/api/auth/email/verify', { email: 'tempe@contoh.id', code: st.body.devCode });
  assert.equal(v.status, 200, JSON.stringify(v.body));
  assert.equal(v.body.linked, true);
  assert.equal(v.body.state.user.is_guest, false, 'bukan tamu lagi');
  assert.equal(v.body.state.user.id, b.id, 'akun & pet yang sama');
  // perangkat lain yang sempat main sebagai tamu, lalu masuk dengan email yang sama
  const d = await guest('Cilok');
  const st2 = await d.c.post('/api/auth/email/start', { email: 'tempe@contoh.id' });
  const ask = await d.c.post('/api/auth/email/verify', { email: 'tempe@contoh.id', code: st2.body.devCode });
  assert.equal(ask.body.error?.code, 'identity_in_use');
  assert.equal(ask.body.error.other.pet, 'Tempe');
  assert.equal(ask.body.error.guest, true);
  assert.equal((await d.c.get('/api/me')).body.user.id, d.id, 'belum pindah sebelum dikonfirmasi');
  const ok = await d.c.post('/api/auth/email/verify', { email: 'tempe@contoh.id', code: st2.body.devCode, switch: true });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.state.user.id, b.id, 'kode OTP tetap berlaku setelah konfirmasi');
  // perangkat yang belum masuk sama sekali: langsung masuk tanpa dialog
  const fresh = client();
  const st3 = await fresh.post('/api/auth/email/start', { email: 'tempe@contoh.id' });
  await db.query(`update email_otps set created_at = now() - interval '2 minutes' where email = 'tempe@contoh.id'`);
  const st4 = st3.body.devCode ? st3 : await fresh.post('/api/auth/email/start', { email: 'tempe@contoh.id' });
  const fr = await fresh.post('/api/auth/email/verify', { email: 'tempe@contoh.id', code: st4.body.devCode });
  assert.equal(fr.status, 200, JSON.stringify(fr.body));
  assert.equal(fr.body.state.user.id, b.id);
});
