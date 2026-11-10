# Integrasi & URL — amt.ai.id

Daftar semua alamat yang perlu didaftarkan di layanan luar, untuk domain produksi **amt.ai.id**.
Versi yang selalu sesuai dengan server (dengan tombol salin dan status) ada di **admin → Integrasi & URL**.

> Ganti domain? Ganti `amt.ai.id` di bawah dengan domain baru, isi `DOMAIN` dan `PUBLIC_URL` di `.env`, lalu daftarkan ulang webhook.

## Ringkasan URL

| Untuk | URL | Tempel di |
|---|---|---|
| Game | `https://amt.ai.id/` | — |
| Admin | `https://amt.ai.id/admin/` | — |
| Cek kesehatan (monitoring/uptime) | `https://amt.ai.id/healthz` | UptimeRobot, dll. (opsional) |
| Versi terpasang | `https://amt.ai.id/api/version` | — |
| **Webhook ZePay** (QRIS) | `https://amt.ai.id/api/payments/zepay/webhook` | Otomatis lewat admin → Pembayaran → **Daftarkan webhook** |
| **Webhook Klik Flow** (WhatsApp) | `https://amt.ai.id/api/wa/klikflow/webhook` | Kunci live: admin → WhatsApp → **Daftarkan webhook**. Kunci tes: Klik Flow → Pengaturan › API & Webhook › Webhook |
| **Webhook Mailketing** (bounce & unsubscribe) | `https://amt.ai.id/api/email/mailketing/<kunci-rahasia>` | Mailketing → Integrasi → WebHook. URL lengkap ada di admin → Email (atau Integrasi & URL) |
| Login Google: Authorized JavaScript origins | `https://amt.ai.id` | Google Cloud Console → Credentials → OAuth client ID (Web) |
| Login Facebook (opsional) | App Domains `amt.ai.id`, Site URL `https://amt.ai.id/` | Meta for Developers → Settings › Basic, Facebook Login › Settings |
| Midtrans (alternatif, tidak dipakai bila ZePay) | `https://amt.ai.id/api/payments/midtrans/notify` | Dashboard Midtrans → Settings → Configuration |

## DNS & HTTPS

- Buat **A record** `amt.ai.id` → IP VPS (dicetak di akhir `install.sh`).
- HTTPS dibuat otomatis oleh Caddy beberapa menit setelah DNS mengarah. Port 80 dan 443 harus terbuka.
- `.env`: `DOMAIN=amt.ai.id`, `PUBLIC_URL=https://amt.ai.id` (diisi otomatis oleh `install.sh`).

## Pembayaran QRIS — ZePay

- Dokumentasi: https://payment.envfri.com/docs
- `.env`:
  ```
  PAYMENT_PROVIDER=zepay
  ZEPAY_KEY_ID=zpk_test_…        # lalu zpk_live_… saat siap
  ZEPAY_SECRET=zsk_test_…
  # ZEPAY_WEBHOOK_SECRET=whsec_…  # hanya bila webhook didaftarkan manual
  # ZEPAY_EXPIRES_MINUTES=30
  ```
- **Webhook**: `https://amt.ai.id/api/payments/zepay/webhook`, event `payment.*`.
  Cara termudah: admin → **Pembayaran** → **Daftarkan webhook**. Server mendaftarkan URL ini, menyimpan secret-nya, dan mengirim event uji.
- Webhook mode uji dan live terpisah: setelah ganti ke kunci live, klik **Daftarkan webhook** sekali lagi.
- Mode uji: di admin → Pembayaran ada tombol **Simulasi lunas** per transaksi.

## WhatsApp — Klik Flow

- Dokumentasi: https://klikflow.id/docs/api
- Kunci: Klik Flow → Pengaturan › API & Webhook › **Buat kunci**, izin `messages:send`, `business:read`, `templates:read` (+ `messages:new` bila WhatsApp scan QR ke nomor baru).
- `.env`:
  ```
  KLIKFLOW_API_KEY=kf_test_…      # lalu kf_live_…
  # KLIKFLOW_WEBHOOK_SECRET=whsec_…  # wajib bila webhook didaftarkan manual (kunci tes)
  ```
- **Webhook**: `https://amt.ai.id/api/wa/klikflow/webhook`, event **`message.status`** dan **`message.received`** (status terkirim/dibaca/gagal, balasan STOP/MULAI pemain).
  - Kunci **live**: admin → **WhatsApp** → **Daftarkan webhook** (otomatis, secret disimpan sendiri).
  - Kunci **tes**: tambahkan manual di Klik Flow → Pengaturan › API & Webhook › Webhook, pilih kedua event, salin secret ke `KLIKFLOW_WEBHOOK_SECRET`, lalu `docker compose up -d`.
- Kunci tes hanya mengirim ke **nomor uji** (maks. 5) di Pengaturan › API & Webhook › Nomor uji.
- WhatsApp Official: siapkan template disetujui (termasuk satu template **Autentikasi** untuk kode verifikasi), pilih di admin → WhatsApp dan di Pusat notifikasi.

## Email — Mailketing

- Dokumentasi: https://mailketing.co.id/docs/send-email-via-api/
- Mailketing → **Setup Domain**: tambahkan `amt.ai.id` sampai aktif.
- Token: Mailketing → Integrasi → **Email Application API**.
- `.env`:
  ```
  MAILKETING_API_TOKEN=…
  MAIL_FROM=Kampung Bulu <noreply@amt.ai.id>
  ```
- **Webhook**: Mailketing → Integrasi → **WebHook**, isi **Bounce Webhook** dan **Unsubscribe Webhook** dengan URL yang sama dari admin → **Email** (bentuknya `https://amt.ai.id/api/email/mailketing/<kunci-rahasia>`). Kunci dibuat sekali per database, jadi URL lengkapnya hanya ada di admin. Jangan dibagikan.

## Login Google

- Google Cloud Console → APIs & Services → Credentials → **Create OAuth client ID** → *Web application*.
- **Authorized JavaScript origins**: `https://amt.ai.id` (redirect URI tidak perlu).
- `.env`: `GOOGLE_CLIENT_ID=….apps.googleusercontent.com`
- Butuh halaman Kebijakan Privasi untuk publikasi consent screen.

## Login Facebook (opsional)

- Meta for Developers → aplikasi → Settings › Basic: **App Domains** `amt.ai.id`, **Website / Site URL** `https://amt.ai.id/`.
- Facebook Login › Settings: **Allowed Domains for the JavaScript SDK** `https://amt.ai.id`.
- `.env`: `FACEBOOK_APP_ID=…`, `FACEBOOK_APP_SECRET=…`

## Notifikasi push

Tidak perlu didaftarkan: kunci VAPID dibuat otomatis dan disimpan di database. Opsional `.env`: `VAPID_SUBJECT=mailto:admin@amt.ai.id`.

## URL otomatis (referensi, tidak perlu didaftarkan)

- Berhenti langganan email (tautan di setiap email): `https://amt.ai.id/api/email/unsubscribe`
- Gambar QRIS pemain: `https://amt.ai.id/api/payments/:id/qris.png`
- Kembali dari pembayaran: `https://amt.ai.id/?payment=:id`

## Setelah mengubah `.env`

```bash
docker compose up -d
```

Lalu cek admin → **Integrasi & URL** (status tiap layanan) dan kirim pesan uji dari admin → Email / WhatsApp.
