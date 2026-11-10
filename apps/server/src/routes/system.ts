// Versi yang terpasang (publik) dan info sistem untuk admin → Versi & changelog.
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index';
import { config } from '../config';
import { requireAdmin } from '../lib/auth';
import { BUILD } from '../lib/version';
import { mailEnabled, mailFrom, webhookPath } from '../lib/mail';
import { klikflowMode, klikflowWebhookUrl, waEnabled } from '../lib/klikflow';
import { zepayConfigured, zepayMode, zepayWebhookUrl } from '../lib/zepay';
import { vapidPublicKey } from '../lib/push';

export default async function systemRoutes(app: FastifyInstance, { db }: { db: Db }) {
  app.get('/api/version', async (_req, reply) => {
    reply.header('Cache-Control', 'no-store');
    return BUILD;
  });

  app.get('/api/admin/system', { preHandler: requireAdmin(db, 'moderator') }, async () => {
    const [ver, migrations, deploys] = await Promise.all([
      db.one<{ v: string }>(`select current_setting('server_version') as v`),
      db.query(`select name, applied_at from schema_migrations order by name`),
      db.query(`select id, version, commit, built_at, started_at from deploys order by id desc limit 30`),
    ]);
    return {
      build: BUILD,
      uptimeSec: Math.round(process.uptime()),
      node: process.version,
      env: config.env,
      publicUrl: config.publicUrl,
      database: { kind: db.kind === 'pg' ? 'PostgreSQL' : 'PGlite', version: ver?.v ?? null },
      migrations,
      deploys,
      providers: {
        payments: config.paymentProvider + (config.paymentProvider === 'zepay' && zepayMode() ? ` (${zepayMode()})` : ''),
        email: mailEnabled() ? 'Mailketing' : null,
        whatsapp: waEnabled() ? `Klik Flow${klikflowMode() ? ` (${klikflowMode()})` : ''}` : null,
        push: !!vapidPublicKey(),
      },
    };
  });

  /* Semua URL yang perlu didaftarkan di layanan luar (webhook, origin login, dll.), dari PUBLIC_URL. */
  app.get('/api/admin/integrations', { preHandler: requireAdmin(db, 'admin') }, async () => {
    const u = config.publicUrl;
    const host = (() => { try { return new URL(u).host; } catch { return u; } })();
    const https = u.startsWith('https://');
    const val = async (k: string) => (await db.one<{ value: any }>(`select value from settings where key = $1`, [k]))?.value ?? null;
    const [zHook, zSeen, kHook, kSeen, mStatus] = await Promise.all([val('zepay_webhook'), val('zepay_seen'), val('klikflow_webhook'), val('wa_seen'), val('mail_status')]);
    const p = config.paymentProvider;
    const items = [
      {
        key: 'domain', name: 'Domain & HTTPS', status: https ? 'ok' : 'warn',
        note: https ? `Berjalan di ${host} dengan HTTPS.` : 'PUBLIC_URL belum https://. Webhook, push, dan login Google butuh HTTPS.',
        urls: [
          { label: 'Game', url: `${u}/` },
          { label: 'Admin', url: `${u}/admin/` },
          { label: 'Cek kesehatan (monitoring)', url: `${u}/healthz` },
          { label: 'Versi terpasang', url: `${u}/api/version` },
        ],
        where: 'DNS: buat A record domain ke IP VPS. Sertifikat HTTPS dibuat otomatis oleh Caddy.',
        env: ['DOMAIN', 'PUBLIC_URL'],
      },
      {
        key: 'zepay', name: 'Pembayaran QRIS (ZePay)',
        status: p !== 'zepay' ? 'off' : zepayConfigured() ? 'ok' : 'missing',
        note: p !== 'zepay' ? `Penyedia aktif: ${p}${p === 'mock' ? ' (simulasi)' : ''}.` : `Mode ${zepayMode() ?? '?'}; secret webhook ${config.zepayWebhookSecret ? 'dari env' : zHook?.secret ? 'tersimpan di database' : 'belum ada'}.`,
        urls: [{ label: 'Webhook (event payment.*)', url: zepayWebhookUrl() }],
        where: 'Otomatis: admin → Pembayaran → Daftarkan webhook (secret disimpan sendiri). Manual: POST /api/v2/webhook-endpoints di ZePay, lalu isi ZEPAY_WEBHOOK_SECRET.',
        env: ['PAYMENT_PROVIDER=zepay', 'ZEPAY_KEY_ID', 'ZEPAY_SECRET', 'ZEPAY_WEBHOOK_SECRET (opsional)', 'ZEPAY_EXPIRES_MINUTES (opsional)'],
        lastEvent: zSeen,
      },
      {
        key: 'klikflow', name: 'WhatsApp (Klik Flow)',
        status: waEnabled() ? 'ok' : 'missing',
        note: waEnabled() ? `Kunci ${klikflowMode() ?? '?'}; secret webhook ${config.klikflowWebhookSecret ? 'dari env' : kHook?.secret ? 'tersimpan di database' : 'belum ada'}.` : 'KLIKFLOW_API_KEY belum diisi.',
        urls: [{ label: 'Webhook (event message.status, message.received)', url: klikflowWebhookUrl() }],
        where: 'Kunci live: admin → WhatsApp → Daftarkan webhook. Kunci tes: Klik Flow → Pengaturan › API & Webhook › Webhook, pilih kedua event, lalu salin secret ke KLIKFLOW_WEBHOOK_SECRET.',
        env: ['KLIKFLOW_API_KEY', 'KLIKFLOW_WEBHOOK_SECRET (opsional)'],
        lastEvent: kSeen,
      },
      {
        key: 'mailketing', name: 'Email (Mailketing)',
        status: mailEnabled() ? 'ok' : 'missing',
        note: mailEnabled() ? `Pengirim ${mailFrom().email}; domain ${mailFrom().email.split('@')[1] ?? '?'} harus aktif di Mailketing → Setup Domain.` : 'MAILKETING_API_TOKEN belum diisi: kode masuk email hanya muncul di log.',
        urls: [
          { label: 'Bounce Webhook', url: u + (await webhookPath(db)), secret: true },
          { label: 'Unsubscribe Webhook', url: u + (await webhookPath(db)), secret: true },
        ],
        where: 'Mailketing → Integrasi → WebHook: tempel URL yang sama di kolom Bounce Webhook dan Unsubscribe Webhook, lalu Simpan. URL memuat kunci rahasia; jangan dibagikan.',
        env: ['MAILKETING_API_TOKEN', 'MAIL_FROM'],
        lastEvent: mStatus ? { at: mStatus.at, type: mStatus.ok ? 'kirim terakhir berhasil' : `kirim terakhir gagal: ${mStatus.error}` } : null,
      },
      {
        key: 'google', name: 'Login Google',
        status: config.googleClientId ? 'ok' : 'missing',
        note: config.googleClientId ? 'Client ID terisi.' : 'GOOGLE_CLIENT_ID belum diisi.',
        urls: [{ label: 'Authorized JavaScript origins', url: u }],
        where: 'Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID (Web application). Redirect URI tidak perlu.',
        env: ['GOOGLE_CLIENT_ID'],
      },
      {
        key: 'facebook', name: 'Login Facebook (opsional)',
        status: config.facebookAppId && config.facebookAppSecret ? 'ok' : 'off',
        note: config.facebookAppId ? 'App ID terisi.' : 'Tidak dipakai.',
        urls: [
          { label: 'App Domains', url: host },
          { label: 'Site URL (Website)', url: `${u}/` },
          { label: 'Allowed Domains for the JavaScript SDK', url: u },
        ],
        where: 'Meta for Developers → aplikasi → Settings › Basic (App Domains, Website) dan Facebook Login › Settings (Allowed Domains for the JavaScript SDK).',
        env: ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'],
      },
      {
        key: 'midtrans', name: 'Midtrans (alternatif)',
        status: p === 'midtrans' ? (config.midtransServerKey ? 'ok' : 'missing') : 'off',
        note: p === 'midtrans' ? `Mode ${config.midtransProduction ? 'produksi' : 'sandbox'}.` : 'Tidak dipakai (penyedia aktif: ' + p + ').',
        urls: [{ label: 'Payment Notification URL', url: `${u}/api/payments/midtrans/notify` }],
        where: 'Dashboard Midtrans → Settings → Configuration. Finish URL diatur otomatis per transaksi.',
        env: ['PAYMENT_PROVIDER=midtrans', 'MIDTRANS_SERVER_KEY', 'MIDTRANS_CLIENT_KEY', 'MIDTRANS_PRODUCTION'],
      },
      {
        key: 'push', name: 'Notifikasi push (Web Push)',
        status: vapidPublicKey() ? 'ok' : 'missing',
        note: 'Kunci VAPID dibuat otomatis dan disimpan di database. Butuh HTTPS.',
        urls: [],
        where: 'Tidak perlu didaftarkan di mana pun.',
        env: ['VAPID_SUBJECT (opsional, mis. mailto:admin@domain)'],
      },
      {
        key: 'auto', name: 'URL otomatis (tidak perlu didaftarkan)', status: 'info',
        note: 'Dibuat dan dipakai sendiri oleh server, hanya untuk referensi.',
        urls: [
          { label: 'Berhenti langganan email (tautan di setiap email)', url: `${u}/api/email/unsubscribe` },
          { label: 'Gambar QRIS pemain', url: `${u}/api/payments/:id/qris.png` },
          { label: 'Kembali dari pembayaran', url: `${u}/?payment=:id` },
          { label: 'Halaman simulasi bayar (hanya mode mock)', url: `${u}/pay/mock/:id` },
        ],
        where: '',
        env: [],
      },
    ];
    return { publicUrl: u, host, https, items };
  });
}
