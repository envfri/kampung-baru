# Changelog

Semua perubahan Kampung Bulu. Versi mengikuti [semver](https://semver.org/lang/id/): fitur baru menaikkan MINOR, perbaikan menaikkan PATCH; 1.0.0 untuk peluncuran publik.

> Berkas ini dibuat dari `packages/shared/src/changelog.ts` dengan `npm run changelog`. Jangan diedit langsung.

## 0.10.1 · 2026-11-10 · Tampilan lebih rapi & update PWA lebih andal

### Perubahan

- PWA memeriksa versi baru tiap 30 menit dan saat aplikasi dibuka lagi dari latar, sehingga pemain yang membiarkan aplikasi terbuka tetap mendapat update.

### Perbaikan

- Di HP layar kecil, daftar Balai Main dan daftar teman tidak lagi berdesakan. _(pemain)_
- Pemberitahuan "Versi baru tersedia" pindah ke atas sehingga tidak menutupi tombol Makan sampai Atur. _(pemain)_
- Info event kembali rapi ("Pekan Ceria Kampung · koin ×1.2"). _(pemain)_

## 0.10.0 · 2026-11-10 · Integrasi & URL webhook

### Baru

- Admin → Integrasi & URL: semua URL yang perlu didaftarkan (webhook ZePay, Klik Flow, Mailketing, Midtrans; origin login Google/Facebook; health check), status tiap layanan, variabel .env, tempat menempelkan, tombol salin, dan ringkasan teks untuk dibagikan.
- INTEGRASI.md di repo: daftar URL untuk domain produksi amt.ai.id dan langkah setiap layanan.

### Perubahan

- install.sh menampilkan URL webhook utama di ringkasan akhir instalasi.

Commit: [`24be392`](https://github.com/envfri/kampung-baru/commit/24be392)

## 0.9.0 · 2026-11-10 · Halaman versi & changelog

_Sekarang kamu bisa melihat apa saja yang baru di setiap pembaruan._

### Baru

- Menu "Apa yang baru" di Pengaturan, dan kabar singkat setelah game diperbarui. _(pemain)_
- Admin → Versi & changelog: versi yang berjalan, commit, waktu build, uptime, versi database, migrasi, status penyedia, riwayat deploy, dan changelog lengkap dengan pencarian.
- Riwayat deploy dicatat otomatis setiap server berjalan dengan versi/commit baru.
- Endpoint publik /api/version untuk memantau versi yang terpasang.

### Perubahan

- Commit Git ikut tercetak di build (install.sh dan update.sh mengirim GIT_SHA ke Docker).
- CHANGELOG.md di repo dibuat dari data yang sama (npm run changelog); uji gagal bila versi tidak sinkron.

Commit: [`01aff52`](https://github.com/envfri/kampung-baru/commit/01aff52)

## 0.8.1 · 2026-11-10 · Perbaikan sebelum instalasi

### Perbaikan

- Di HP layar kecil, tombol Makan, Mandi, Main, Tidur, dan Atur kini muat di layar. _(pemain)_
- Nama pet yang panjang tetap terbaca; level tampil sebagai lencana di pojok avatar. _(pemain)_
- Webhook ZePay, Klik Flow, Mailketing, dan Midtrans dikecualikan dari rate limit.
- Batch kirim lebih kecil dan pembaruan status dijaga agar email tidak terkirim dua kali.
- Pengingat hadiah harian juga untuk pemain yang hanya punya email/WhatsApp.

### Keamanan

- Kode verifikasi WhatsApp hanya untuk akun yang disimpan, maks. 3 kode per nomor per 24 jam, plus batas harian global.
- Pesan antre diperiksa ulang saat dikirim: STOP, nomor diputus, berhenti langganan, pemain diblokir, saluran dimatikan, jam tenang.
- Kunci ZePay live menolak event tanpa livemode; secret webhook mode uji tidak dipakai di mode live.
- Perbandingan tanda tangan webhook aman untuk masukan non-ASCII (tidak lagi error 500).

Commit: [`2e93dba`](https://github.com/envfri/kampung-baru/commit/2e93dba)

## 0.8.0 · 2026-11-10 · Pusat notifikasi & WhatsApp

_Kabar penting bisa dikirim ke WhatsApp-mu._

### Baru

- Sambungkan nomor WhatsApp di Pengaturan untuk menerima kabar penting. Balas STOP kapan saja untuk berhenti. _(pemain)_
- Pusat notifikasi: 18 jenis notifikasi, nyala/mati per saluran (kotak masuk, push, email, WhatsApp), teks bisa diedit dengan variabel, pratinjau, kirim uji, kembalikan ke bawaan.
- WhatsApp lewat Klik Flow API v2: scan QR (teks) dan WhatsApp Official (template disetujui + OTP), webhook status, STOP/MULAI.
- Pengaturan saluran: batas pesan per pemain per hari dan jam tenang WhatsApp.
- Halaman admin WhatsApp dan pilihan "Kirim juga ke WhatsApp" di broadcast.

### Perubahan

- Saklar notifikasi lama di Ekonomi & fitur dipindah otomatis ke Pusat notifikasi.

Commit: [`7cf0271`](https://github.com/envfri/kampung-baru/commit/7cf0271)

## 0.7.0 · 2026-11-10 · Email lewat Mailketing

### Baru

- Bukti pembelian Mutiara dan kabar event bisa dikirim ke email. Bisa dimatikan di Pengaturan atau lewat tautan di email. _(pemain)_
- Semua email (kode masuk & notifikasi) lewat Mailketing API v2, dengan antrean dan percobaan ulang.
- Admin → Email: sisa kredit, kirim email uji, URL webhook bounce, riwayat, alamat yang diblokir.

### Keamanan

- nodemailer/SMTP dihapus (menutup celah keamanan nodemailer).

Commit: [`6850a73`](https://github.com/envfri/kampung-baru/commit/6850a73)

## 0.6.1 · 2026-11-10 · Batas cek status ZePay

### Perbaikan

- Cek status QRIS dibatasi 30 per menit agar kuota 60 request/menit ZePay tetap cukup untuk membuat QR.

Commit: [`79efadd`](https://github.com/envfri/kampung-baru/commit/79efadd)

## 0.6.0 · 2026-11-10 · Bayar Mutiara dengan QRIS

_Beli Mutiara cukup pindai QRIS dari aplikasi bank atau e-wallet apa pun._

### Baru

- Beli Mutiara dengan QRIS langsung di dalam game: pindai dari aplikasi bank atau e-wallet, atau simpan QR ke galeri. _(pemain)_
- Tagihan yang belum dibayar bisa dilanjutkan atau dibatalkan dari Riwayat. _(pemain)_
- Integrasi ZePay: request bertanda tangan HMAC, webhook bertanda tangan, cek status cadangan, admin daftar webhook & simulasi lunas.

Commit: [`7be1ada`](https://github.com/envfri/kampung-baru/commit/7be1ada)

## 0.5.0 · 2026-11-10 · Balai Main & event musiman

_Dua mini-game baru dan event musiman dengan hadiah bertingkat._

### Baru

- Balai Main di peta: mini-game Panen Buah dan Ingat Jajanan. _(pemain)_
- Event musiman dengan poin dan hadiah bertingkat, dekorasi rumah, dan bonus koin. _(pemain)_
- Editor event di admin: template, tanggal, dekorasi, pengali koin, poin per aktivitas, hadiah bertingkat, berulang tiap tahun.

### Keamanan

- Skor mini-game dihitung ulang di server dari seed.

Commit: [`b2e54d3`](https://github.com/envfri/kampung-baru/commit/b2e54d3)

## 0.4.0 · 2026-11-09 · Jenis pet & Lemari

_Lebih banyak pilihan bentuk pet dan aksesori._

### Baru

- Jenis pet baru, pola bulu, mata, dan ekor yang terbuka seiring naik level. _(pemain)_
- Lemari untuk mengganti penampilan dan aksesori pet, termasuk slot punggung. _(pemain)_
- Barang & aksesori baru di toko. _(pemain)_

Commit: [`7bb5ab7`](https://github.com/envfri/kampung-baru/commit/7bb5ab7)

## 0.3.0 · 2026-11-09 · Tugas & pet jalan-jalan

### Baru

- Tugas pemula untuk mengenal game, dan tugas harian dengan hadiah. _(pemain)_
- Pet berjalan-jalan sendiri di rumah. Ketuk lantai untuk memanggilnya. _(pemain)_
- Editor tugas di admin.

Commit: [`03948be`](https://github.com/envfri/kampung-baru/commit/03948be)

## 0.2.0 · 2026-11-09 · Siap dipasang di VPS

### Baru

- Docker Compose dengan Caddy (HTTPS otomatis), PostgreSQL, Redis; skrip install, update, dan backup harian.

### Perbaikan

- Perbaikan hasil audit: batas request tamu, nama tampilan tamu, mode simulasi pembelian, dan lainnya.

Commit: [`27e3444`](https://github.com/envfri/kampung-baru/commit/27e3444), [`129e246`](https://github.com/envfri/kampung-baru/commit/129e246)

## 0.1.0 · 2026-11-09 · Kampung Bulu pertama

_Rawat pet, hias rumah, dan bermain bersama teman di kampung._

### Baru

- Rawat pet-mu: makan, mandi, main, tidur. Hias rumah dengan mebel dari toko. _(pemain)_
- Peta kampung: kebun, Lomba Karung, Kolam Pancing, dan toko. _(pemain)_
- Berteman, berkunjung, dan kirim hadiah. _(pemain)_
- Bisa dipasang di layar utama HP dan menerima notifikasi. _(pemain)_
- Server API dengan ekonomi di server, panel admin, PWA, notifikasi push.

Commit: [`6608d85`](https://github.com/envfri/kampung-baru/commit/6608d85)

