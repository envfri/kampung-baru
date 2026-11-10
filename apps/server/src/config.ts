// Semua konfigurasi dibaca dari environment variable. Lihat .env.example di root repo.
const env = process.env;

export const config = {
  env: env.NODE_ENV ?? 'development',
  isProd: env.NODE_ENV === 'production',
  port: Number(env.PORT ?? 8787),
  host: env.HOST ?? '0.0.0.0',
  publicUrl: (env.PUBLIC_URL ?? 'http://localhost:8787').replace(/\/$/, ''),
  databaseUrl: env.DATABASE_URL ?? '',
  pgliteDir: env.PGLITE_DIR ?? '.data/pglite',
  redisUrl: env.REDIS_URL ?? '',
  trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true',
  sessionDays: Number(env.SESSION_DAYS ?? 180),
  // akun admin pertama (dibuat otomatis jika belum ada admin sama sekali)
  adminEmail: env.ADMIN_EMAIL ?? '',
  adminPassword: env.ADMIN_PASSWORD ?? '',
  // login
  googleClientId: env.GOOGLE_CLIENT_ID ?? '',
  facebookAppId: env.FACEBOOK_APP_ID ?? '',
  facebookAppSecret: env.FACEBOOK_APP_SECRET ?? '',
  smtpUrl: env.SMTP_URL ?? '',
  mailFrom: env.MAIL_FROM ?? 'Kampung Bulu <noreply@kampungbulu.local>',
  // pembayaran: zepay (QRIS) | midtrans | mock
  paymentProvider: (env.PAYMENT_PROVIDER ?? (env.NODE_ENV === 'production' ? 'zepay' : 'mock')) as 'mock' | 'midtrans' | 'zepay',
  zepayBaseUrl: (env.ZEPAY_BASE_URL ?? 'https://payment.envfri.com').replace(/\/$/, ''),
  zepayKeyId: env.ZEPAY_KEY_ID ?? '',
  zepaySecret: env.ZEPAY_SECRET ?? '',
  zepayWebhookSecret: env.ZEPAY_WEBHOOK_SECRET ?? '',
  zepayExpiresMinutes: Math.min(1440, Math.max(5, Number(env.ZEPAY_EXPIRES_MINUTES ?? 30) || 30)),
  midtransServerKey: env.MIDTRANS_SERVER_KEY ?? '',
  midtransClientKey: env.MIDTRANS_CLIENT_KEY ?? '',
  midtransProduction: env.MIDTRANS_PRODUCTION === 'true',
  // file statis hasil build
  gameDist: env.GAME_DIST ?? new URL('../../game/dist', import.meta.url).pathname,
  adminDist: env.ADMIN_DIST ?? new URL('../../admin/dist', import.meta.url).pathname,
};
export type Config = typeof config;

// Web Push (VAPID). Kosongkan untuk dibuat otomatis dan disimpan di database.
export const vapidConfig = {
  publicKey: process.env.VAPID_PUBLIC_KEY ?? '',
  privateKey: process.env.VAPID_PRIVATE_KEY ?? '',
  subject: process.env.VAPID_SUBJECT ?? 'mailto:admin@kampungbulu.local',
};
