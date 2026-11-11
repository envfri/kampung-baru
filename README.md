# BUPI

Game pet sosial untuk browser dan HP (PWA). Pemain merawat pet orisinal "bupi" di Kampung Bupi, menghias rumah isometrik, berkebun, ikut lomba karung, memancing, mengunjungi teman, dan menerima notifikasi walau game sedang ditutup. Semua karakter, gambar, nama, dan tata letak dibuat orisinal. **BUPI** adalah nama game (dunianya: Kampung Bupi). Domain yang disarankan: playbupi.com dan bupi.id. Cek & daftarkan mereknya di PDKI (DJKI) sebelum peluncuran.

Pet bisa diubah lewat Lemari: 16 warna, 9 telinga, 6 motif, 5 gaya mata, 4 ekor (sebagian terbuka saat naik level), serta 30+ aksesori di kepala, wajah, leher, dan punggung. Katalog berisi puluhan makanan, mebel, dinding, lantai, bibit, dan ikan, semuanya bisa ditambah dari admin.

Isinya: game PWA, server API, panel admin, dan basis data. Semua gambar digambar sebagai SVG dari kode, jadi tidak ada file gambar besar. Muat awal game ±60 KB JavaScript (gzip) ditambah font.

## Fitur per fase

| Fase | Isi | Status |
|---|---|---|
| 1 · Vertical slice | Pet (warna, 4 tipe telinga), ruangan isometrik + mode atur, 4 kebutuhan yang turun seiring waktu, Pasar Pagi & Mebel Jati, Tas, login tamu / Google / email OTP, simpan di server, ledger dompet | Selesai |
| 2 · Alpha sosial | Teman lewat kode & link WhatsApp, kunjungan harian berhadiah, kirim & buka hadiah, Peta Kampung, Butik Benang & pakaian, Lomba Karung, Kebun | Selesai |
| 3 · Beta | Panel admin (katalog, event, ekonomi, peta, pemain, moderasi, audit), event musiman, rate limit & anti-curang, moderasi nama, PWA, analitik & funnel | Selesai |
| 4 · Soft launch | Mutiara via QRIS (ZePay), Toko Mutiara (kosmetik saja), Kolam Pancing & koleksi ikan, kalender event | Selesai, perlu uji kunci ZePay mode uji lalu live |
| Mini-game | Balai Main: Panen Buah (tangkap buah, hindari kerikil) dan Ingat Jajanan (cocokkan kartu), plus Lomba Karung & Kolam Pancing. Skor dihitung ulang di server dari seed | Selesai |
| Event musiman | Diatur penuh dari admin: tanggal, dekorasi kampung & rumah (bendera, lampion, ketupat, kembang api, hujan, bunga), pengali koin, poin event per aktivitas, hadiah bertingkat, barang edisi terbatas, berulang tiap tahun, notifikasi otomatis saat mulai, template Agustusan/Ramadan/Lebaran/Imlek/Tahun Baru/Musim Hujan | Selesai |
| Rumah & aktivitas | Rumah multi-ruangan: kamar awal + ruang tamu, dapur, kamar mandi, halaman rumput berpagar, loteng (dibeli di Toko Bangunan). Ketuk mebel/jendela/lukisan: pet berjalan ke sana lalu tidur di kasur, duduk di sofa, berendam, menyiram, membaca, memasak, dll. Aktivitas diatur dari admin | Selesai |
| Pet hidup | Wajah ikut perasaan (senang, lapar, capek, kotor, sakit, tidur), mata mengikuti jari, celetukan (diatur admin). Rawat dengan sentuhan: seret makanan ke mulut, gosok sabun lalu bilas, matikan lampu untuk tidur bertahap (bangun sendiri + notifikasi). Sakit ringan & jamu dari Warung Jamu, gembul & olahraga, remah/bulu rontok disapu untuk koin | Selesai |
| Lencana & sosial | 15 lencana (jenis Tugas "badge", diatur admin), suka rumah teman sekali seminggu, Rumah terfavorit minggu ini | Selesai |
| Mini-game Nusantara | Balap Bakiak, Gasing, Tangkap Layangan, Panjat Pinang (hanya saat event berdekorasi bendera); skor diputar ulang di server dari seed | Selesai |
| Duel teman | Tantang teman di Balap Bakiak, Gasing, Tangkap Layangan: main bareng (ruang duel, mulai bersamaan, skor lawan langsung) atau tantangan melawan bayangan. Seed sama, skor diputar ulang di server, hadiah koin sistem tanpa taruhan, batas per hari | Selesai |
| Kunjungan bareng | Pet ikut berkunjung; sapa/peluk/camilan/kejar/duduk dengan pet teman (buku tamu); rumah live untuk tuan rumah + sampai 4 tamu (polling, keadaan di memori server); obrolan frasa & ketik bebas tersaring; ekspresi; Masak bareng & Lempar bola; foto bareng → album & lukisan rumah; status online & privasi | Selesai |
| Akun & pindah perangkat | Main langsung sebagai tamu, sesi diperpanjang otomatis, ajakan Simpan progres (Google/email), kode pindah perangkat sekali pakai, konfirmasi sebelum pindah akun | Selesai |
| Peta & toko | Belanja dengan mendatangi toko di Peta Kampung: pet berjalan menyusuri jalan, lalu masuk ke dalam toko (penjaga, etalase, barang khusus toko itu) | Selesai |
| Notifikasi | Web Push (muncul walau PWA ditutup) + kotak notifikasi di game: kebun siap panen, pet butuh perhatian, pengingat hadiah harian, teman/kunjungan/hadiah, pembayaran, broadcast & jadwal dari admin | Selesai, perlu uji di HP sungguhan |

## Struktur

```
apps/server   API (Fastify + TypeScript), PostgreSQL / PGlite, worker notifikasi
apps/game     Game PWA (Svelte 5 + Vite), service worker buatan sendiri
apps/admin    Panel admin (Svelte 5), disajikan di /admin/
packages/shared  Gambar SVG (pet, mebel, peta), aturan ekonomi, pengaturan bawaan
scripts       dev.mjs (jalankan semua), e2e.mjs (uji di viewport HP), make-icons.mjs
```

Server menyajikan game di `/`, admin di `/admin/`, API di `/api/`, dan gambar upload di `/media/`. Satu proses, satu port.

## Menjalankan di komputer sendiri

Butuh Node.js 20.11 atau lebih baru.

```bash
npm install
```

```bash
cp .env.example .env
```

```bash
npm run dev
```

- Game: http://localhost:5173
- Admin: http://localhost:5174/admin/
- API: http://localhost:8787

Tanpa `DATABASE_URL`, server memakai PGlite (Postgres di dalam proses, data di `apps/server/.data/pglite`). Katalog awal, lokasi peta, event contoh, dan paket Mutiara dibuat otomatis saat pertama jalan. Kode OTP email muncul di log server bila `MAILKETING_API_TOKEN` kosong. Pembayaran memakai halaman simulasi (`PAYMENT_PROVIDER=mock`).

Mode produksi lokal:

```bash
npm run build
```

```bash
npm start
```

## Admin

Admin pertama dibuat dari `ADMIN_EMAIL` + `ADMIN_PASSWORD` saat tabel admin kosong. Di mode dev tanpa variabel itu, server membuat `admin@bupi.local` dengan password acak yang dicetak di log.

| Peran | Akses |
|---|---|
| Pemilik | Semua, termasuk harga paket Mutiara, tandai pembayaran lunas manual, kelola admin |
| Admin | Item & harga, event, peta & toko, ekonomi & fitur, media, notifikasi broadcast, pengumuman, ubah dompet/tas pemain, log audit |
| Moderator | Lihat semua data, blokir/buka blokir, ganti nama, keluarkan sesi, daftar kata terlarang |

Yang bisa diatur tanpa deploy:

- **Item & harga**: tambah/ubah makanan, mebel, pakaian, dinding, lantai, bibit, ikan, dan **ruangan rumah** (ukuran, ruangan dalam/halaman, dinding & lantai awal). Gambar dari bentuk bawaan (warna bisa diubah) atau upload PNG/WebP/SVG, dengan pratinjau langsung.
- **Aktivitas di rumah**: tambah/ubah aktivitas mebel (mis. "Tidur" di semua kasur, "Lihat ke luar" di jendela): mebel/bagian ruangan yang bisa dipakai, animasi, efek ke kebutuhan, XP, koin, hadiah barang, jeda, batas harian, level minimal, dan pesannya.
- **Event**: buat dari template, atur tanggal, dekorasi, pengali koin, nama poin, poin per aktivitas, hadiah bertingkat (koin/Mutiara/item), berulang tiap tahun, dan notifikasi saat mulai. Lihat jumlah peserta & hadiah yang diambil.
- **Tugas**: tugas pemula & harian.
- **Peta & toko**: nama, posisi, warna bangunan, tampil/sembunyi, toko yang membeli barang pemain.
- **Ekonomi & fitur**: modal awal, kurva level, laju kebutuhan, hadiah & cooldown aksi, hadiah harian, lomba, kolam, kebun, ukuran kamar awal, jumlah maksimal ruangan per rumah, barang awal, notifikasi otomatis, nyala/matikan fitur dan metode login.
- **Notifikasi**: kirim sekarang atau jadwalkan ke semua pemain, yang aktif 7 hari, yang tidak aktif, pembeli, atau tamu.
- **Pusat notifikasi**, **Broadcast**, **Email**, **WhatsApp**, **Paket Mutiara**, **Pengumuman**, **Pemain**, **Pembayaran**, **Moderasi kata**, **Media**, **Log audit**, **Integrasi & URL**, **Versi & changelog**, **Admin**.

Perubahan katalog dan pengaturan sampai ke pemain dalam ±15 detik (cache server), lalu disimpan di HP pemain untuk dipakai offline.

## Notifikasi push

- Pemain menyalakan notifikasi dari ikon lonceng, menu Pengaturan, atau ajakan yang muncul setelah mereka mulai bermain (tidak langsung saat pertama buka).
- **Android** (Chrome, Edge, Samsung Internet, Firefox) dan desktop: langsung bisa, baik di browser maupun setelah dipasang.
- **iPhone/iPad**: butuh iOS/iPadOS 16.4 atau lebih baru, dan game harus dipasang ke Layar Utama lalu dibuka dari ikonnya. Game menampilkan petunjuk ini otomatis.
- Pemain bisa mematikan per jenis: kebun, pet, hadiah harian, sosial, event. Notifikasi tetap masuk ke kotak notifikasi di dalam game.
- Kunci VAPID dibuat otomatis dan disimpan di database. Untuk mengatur sendiri, isi `VAPID_PUBLIC_KEY` dan `VAPID_PRIVATE_KEY` (buat dengan `npx web-push generate-vapid-keys`). Jangan ganti kunci setelah peluncuran, karena semua langganan lama akan putus.
- Notifikasi otomatis dikirim oleh worker di dalam server setiap menit. Bila server lebih dari satu instance, hanya satu yang menjalankannya (advisory lock Postgres).
- Push wajib lewat **HTTPS** (kecuali `localhost`).

## Login

- **Tamu**: langsung main. Progres tersimpan di server dan bisa ditautkan ke Google/email kapan saja tanpa hilang (Pengaturan › Akun, atau lembar **Simpan progres** yang muncul sendiri setelah beberapa hari / Lv 3 / teman pertama / menang duel; diatur di admin, bagian `account`).
- **Sesi bergulir**: sesi berlaku `SESSION_DAYS` hari (bawaan 180) dan diperpanjang otomatis selama dipakai, jadi pemain aktif tidak pernah terlempar keluar.
- **Pindah perangkat**: lewat Google/email yang sama, atau **kode pindah perangkat** sekali pakai (Pengaturan › Akun › Buat kode pindah; berlaku 15 menit, bisa dimatikan di admin). Di perangkat baru: layar masuk › *Punya kode pindah perangkat?*. Bila perangkat itu sedang memakai akun lain, pemain diminta konfirmasi dulu sebelum pindah.
- **Google**: buat OAuth Client ID tipe Web di Google Cloud Console. Isi Authorized JavaScript origins dengan domain game (harus **https**, Google tidak menerima `http://IP:port`), lalu isi `GOOGLE_CLIENT_ID` dan restart. Tombol Google otomatis muncul di layar masuk, Pengaturan › Akun, dan lembar Simpan progres.
- **Email OTP**: dikirim lewat Mailketing, lihat bagian Email di bawah.
- **Facebook** (opsional): isi `FACEBOOK_APP_ID` dan `FACEBOOK_APP_SECRET`. Sistem teman tetap memakai kode/link, karena Facebook hanya memberi daftar teman yang juga memakai aplikasi.

## Integrasi & URL webhook

Semua URL yang perlu didaftarkan di layanan luar (webhook ZePay, Klik Flow, Mailketing, Midtrans; origin login Google/Facebook; health check) ada di:

- **[INTEGRASI.md](INTEGRASI.md)**: sudah terisi untuk `amt.ai.id`, lengkap dengan variabel `.env` per layanan dan tempat menempelkannya.
- **Admin → Integrasi & URL**: dibuat dari `PUBLIC_URL` yang sedang berjalan, dengan status tiap layanan, tombol salin, event terakhir yang diterima, dan URL webhook Mailketing yang memuat kunci rahasia.

| Webhook | URL |
|---|---|
| ZePay (QRIS) | `https://<domain>/api/payments/zepay/webhook` |
| Klik Flow (WhatsApp) | `https://<domain>/api/wa/klikflow/webhook` |
| Mailketing (bounce & unsubscribe) | `https://<domain>/api/email/mailketing/<kunci>` (lihat admin) |
| Midtrans (alternatif) | `https://<domain>/api/payments/midtrans/notify` |

## Notifikasi: Pusat notifikasi, email & WhatsApp

Semua notifikasi diatur dari admin → **Pusat notifikasi**, tanpa deploy:

- Daftar 18 jenis notifikasi (pembayaran, pesan admin, broadcast, event, kebun, pet, harian, teman, akun). Tiap jenis bisa dinyalakan/dimatikan, dan tiap saluran dipilih sendiri: **kotak masuk** di game, **push** HP, **email**, **WhatsApp**.
- Teks bisa diubah dengan variabel, mis. `{pet} lapar. Ada makanan di tasmu?`. Klik variabel untuk menyisipkan. Variabel yang salah ketik ditandai. Pratinjau push, email, dan WhatsApp tampil langsung dengan contoh isian, dan bisa **kirim uji** ke email/nomor admin.
- **Kembalikan ke bawaan** per jenis. Yang disimpan hanya bagian yang diubah.
- Kartu **Saluran**: email & WhatsApp nyala/mati, batas pesan per pemain per hari, dan **jam tenang** WhatsApp (bawaan 21.00–07.00 WIB; pesan biasa ditunda sampai pagi).
- Notifikasi **penting** (bukti pembelian, pesan admin, kode) tidak dihitung batas harian dan tidak ditunda jam tenang. Kode masuk & kode verifikasi WhatsApp tidak bisa dimatikan, tapi teksnya bisa diubah.
- Ambang & jeda (kebutuhan pet, jam pengingat harian, jeda kunjungan) ada di Ekonomi & fitur › Waktu notifikasi otomatis.
- Pemain bisa mematikan kategori, email, atau WhatsApp di Pengaturan game.

### Email (Mailketing)

Semua email dikirim lewat [Mailketing](https://mailketing.co.id/docs/send-email-via-api/) API v2 (1 email = 1 kredit).

1. Di Mailketing: tambahkan domain pengirim di **Setup Domain** sampai aktif, lalu salin token dari **Integrasi → Email Application API**.
2. Isi `MAILKETING_API_TOKEN` dan `MAIL_FROM=BUPI <noreply@domainmu>` di `.env`, lalu `docker compose up -d`.
3. Admin → **Email**: lihat sisa kredit, **Kirim email uji**, lalu salin **URL webhook** ke Mailketing → Integrasi → WebHook (kolom Bounce dan Unsubscribe). Alamat yang bounce otomatis tidak dikirimi lagi.

Hanya pemain yang menautkan email/Google yang menerima email. Setiap email punya tautan berhenti langganan. Isi email kode masuk tidak disimpan; isi email notifikasi dihapus dari database setelah terkirim.

### WhatsApp (Klik Flow)

WhatsApp dikirim lewat [Klik Flow](https://klikflow.id/docs/api) API v2.

1. Di Klik Flow: Pengaturan › API & Webhook › **Buat kunci** dengan izin `messages:send`, `business:read`, `templates:read` (dan `messages:new` untuk WhatsApp scan QR ke nomor baru). Mulai dengan kunci tes `kf_test_…` dan daftarkan nomor uji (maks. 5).
2. Isi `KLIKFLOW_API_KEY` di `.env`, lalu `docker compose up -d`.
3. Admin → **WhatsApp**: pilih saluran dan nomor pengirim.
   - **Scan QR**: teks bebas dari Pusat notifikasi.
   - **WhatsApp Official**: di luar 24 jam hanya template yang disetujui. Pilih template Autentikasi untuk kode verifikasi, lalu di Pusat notifikasi pilih template + isi variabelnya untuk tiap jenis yang dikirim ke WhatsApp.
4. Dengan kunci live, klik **Daftarkan webhook** (status sampai/dibaca/gagal dan balasan STOP/MULAI). Dengan kunci tes, isi URL webhook manual di Klik Flow dan salin secret-nya ke `KLIKFLOW_WEBHOOK_SECRET`.

Pemain menyambungkan nomor di Pengaturan game, lalu memasukkan kode 6 angka yang dikirim ke WhatsApp itu. Satu nomor hanya untuk satu akun. Balasan **STOP** ke nomor bisnis mematikan WhatsApp pemain itu, dan **MULAI** menyalakan lagi. Broadcast punya pilihan **Kirim juga ke WhatsApp**.

Pengiriman email & WhatsApp lewat antrean: dicoba langsung, lalu worker mengulang bila penyedia gangguan, kredit/kuota habis, atau nomor dijeda (2 mnt → 6 jam, maks. 6 kali). Tombol **Kirim ulang yang tertunda** ada di halaman Email dan WhatsApp.

## Pembayaran QRIS (ZePay)

Mutiara dibayar dengan QRIS dinamis dari [ZePay](https://payment.envfri.com/docs). QR tampil langsung di dalam game, jadi pemain tidak meninggalkan aplikasi. Bisa dibayar dari aplikasi bank atau e-wallet apa pun.

1. Minta kunci API ke tim ZePay. Mulai dengan kunci mode uji (`zpk_test_…` / `zsk_test_…`).
2. Isi di `.env`, lalu `docker compose up -d`:
   ```
   PAYMENT_PROVIDER=zepay
   ZEPAY_KEY_ID=zpk_test_…
   ZEPAY_SECRET=zsk_test_…
   ```
3. Buka admin → **Pembayaran** → **Daftarkan webhook**. Server mendaftarkan `https://domainmu/api/payments/zepay/webhook` ke ZePay, menyimpan secret-nya di database, dan mengirim event uji. Panel itu juga menampilkan status merchant, kanal QRIS, dan event terakhir yang diterima.
4. Uji dari game: beli paket → QR muncul → di admin klik **Simulasi lunas** (hanya ada di mode uji) → Mutiara masuk dan pemain mendapat notifikasi.
5. Setelah lancar, ganti ke kunci live (`zpk_live_…`), restart, lalu klik **Daftarkan webhook** sekali lagi (webhook mode uji dan live terpisah).

Cara kerjanya:

- Checkout membuat tagihan `POST /api/v2/payments` (metode QRIS) dengan `Idempotency-Key` per pembayaran. Setiap request ditandatangani HMAC-SHA256 sesuai dokumentasi ZePay.
- Game menampilkan QR (PNG dari server), hitung mundur, tombol **Simpan QR** (untuk yang main di HP yang sama: simpan, lalu pilih dari galeri di aplikasi bank), dan **Batalkan**. Tagihan yang belum dibayar bisa dilanjutkan dari Riwayat.
- Mutiara dikredit dari webhook `payment.succeeded`. Tanda tangan dicek dari body mentah, selisih waktu maks. 300 detik, dan nominal harus sama. Kredit hanya terjadi sekali.
- Cadangan bila webhook terlambat: selama pemain menunggu di layar QR, server menanyakan status ke ZePay setiap ±8 detik. Worker juga mengecek QR yang sudah lewat batas waktu, sehingga pembayaran yang masuk terlambat tetap dikredit.
- Admin bisa **Cek status** per transaksi dan **Tandai lunas** manual (pemilik, dengan alasan, tercatat di log audit).

Variabel lain: `ZEPAY_EXPIRES_MINUTES` (masa berlaku QR, bawaan 30), `ZEPAY_WEBHOOK_SECRET` (opsional bila webhook didaftarkan manual), `ZEPAY_BASE_URL`.

Tamu harus menautkan akun dulu sebelum membeli, supaya Mutiara tidak hilang.

Midtrans masih didukung sebagai alternatif (`PAYMENT_PROVIDER=midtrans`, `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`, notification URL `https://domainmu/api/payments/midtrans/notify`).

## Deploy ke VPS (Ubuntu 24.04 / 26.04 LTS)

Panduan lengkap yang direkomendasikan ada di **[DEPLOY.md](DEPLOY.md)**: pilihan OS & spesifikasi, DNS, pengamanan VPS, instalasi, langkah setelah instal, update, rollback, backup di luar server, dan pemecahan masalah.

Ringkasnya (Docker Compose: Caddy HTTPS otomatis → aplikasi → PostgreSQL 16 + Redis; minimal 1 vCPU / 2 GB RAM):

```bash
sudo bash deploy/install.sh amt.ai.id
```

| Skrip | Fungsi |
|---|---|
| `deploy/install.sh domain` | Pasang Docker (Ubuntu 22.04/24.04/26.04), swap, firewall, `.env` acak, build & jalankan, backup harian 03:15 |
| `deploy/update.sh` | Backup database → tarik commit terbaru → build ulang → cek sehat → tampilkan versi |
| `deploy/backup.sh` | Dump database ke `backups/` (14 hari) |
| `deploy/restore.sh file` | Pulihkan database dari backup (dengan konfirmasi; backup kondisi sekarang dulu) |

- Lihat log: `docker compose logs -f app`
- Ubah konfigurasi (Google, Mailketing, Klik Flow, ZePay): edit `.env`, lalu `docker compose up -d`
- Pembelian Mutiara masih **simulasi** (`PAYMENT_PROVIDER=mock`) sampai kunci ZePay diisi. Dengan `NODE_ENV=production`, simulasi **terkunci untuk pemain** (mereka melihat "Pembelian Mutiara belum dibuka"); hanya admin yang login di browser yang sama bisa mencoba alur beli, dan Mutiara-nya ditandai uji. Ganti ke `zepay` sebelum dibuka untuk umum (lihat bagian Pembayaran QRIS).

## Versi & changelog

- Versi mengikuti semver: fitur baru menaikkan MINOR (0.8.0 → 0.9.0), perbaikan menaikkan PATCH (0.8.0 → 0.8.1); 1.0.0 untuk peluncuran publik.
- Sumber tunggal: `packages/shared/src/changelog.ts`. Dari sana dibuat [CHANGELOG.md](CHANGELOG.md), halaman admin **Versi & changelog**, dan menu **Apa yang baru** di game (hanya item bertanda `player: true`).
- Admin → **Versi & changelog**: versi yang berjalan, commit Git, waktu build, uptime, versi database & migrasi, penyedia (pembayaran/email/WhatsApp/push), **riwayat deploy** (dicatat otomatis tiap versi/commit baru berjalan), dan changelog dengan pencarian & filter.
- `GET /api/version` (publik) memberi versi, commit, waktu build, dan waktu server mulai. Berguna untuk memastikan update sudah terpasang.
- Pemain yang sudah pernah main mendapat kabar singkat dan titik merah di Pengaturan setelah game diperbarui (sekali per versi).

Merilis versi baru:

1. Tambahkan entri paling atas di `packages/shared/src/changelog.ts` (tanggal, judul, item `baru`/`ubah`/`perbaikan`/`keamanan`; tandai `player: true` untuk yang perlu tahu pemain, dengan bahasa pemain).
2. Samakan `"version"` di `package.json` root.
3. `npm run changelog` untuk menulis ulang `CHANGELOG.md`.
4. Commit & push. `npm test` gagal bila versi atau `CHANGELOG.md` belum sinkron.
5. Di VPS: `bash deploy/update.sh` (commit ikut tercetak di build dan tercatat di riwayat deploy).

## Pengujian

```bash
npm test
```

47 uji API (PGlite di memori): login & moderasi nama, makan/mandi/cooldown, beli dengan idempotensi, validasi ruangan (barang tak dimiliki, bertumpuk, versi lama), teman, kunjungan & hadiah, kebun, anti-curang lomba karung, kolam, hadiah harian, pembelian Mutiara mock + kredit tidak dobel, tanda tangan Midtrans, QRIS ZePay terhadap server ZePay tiruan (tanda tangan request & webhook, QR dipakai ulang, kredit sekali, cek status cadangan, batal, gateway gangguan, simulasi admin, worker QR kedaluwarsa), email Mailketing terhadap server Mailketing tiruan (kode masuk, notifikasi & escape isi, berhenti langganan, jenis & batas harian, broadcast email, webhook bounce, kredit habis & kirim ulang), Pusat notifikasi (matikan/ubah teks/saluran/reset, migrasi saklar lama, kunci login), WhatsApp Klik Flow terhadap server tiruan (verifikasi nomor, kunci tes, template Official & OTP, jam tenang, batas harian, nomor dijeda, webhook bertanda tangan, STOP/MULAI, status gagal, broadcast), versi & changelog (urutan versi, sinkron package.json/CHANGELOG.md, /api/version, riwayat deploy), peran admin, blokir, notifikasi (kotak masuk, worker kebun, broadcast, preferensi), dan pengiriman Web Push terenkripsi ke endpoint tiruan.

Uji alur di viewport HP (butuh server jalan dan Playwright):

```bash
npm run test:e2e
```

## Keamanan & anti-curang

- Server memegang saldo dan inventori. Client hanya mengirim niat (mis. "beri makan item X").
- Semua perubahan saldo tercatat di `wallet_ledger` dengan saldo setelahnya.
- Aksi mutasi memakai `requestId` (aman dari klik ganda / jaringan putus-sambung).
- Hasil Lomba Karung dicek terhadap jam server, waktu minimum, dan batas kecepatan ketukan. Peringkat dihitung ulang di server dari seed.
- Waktu gigitan kolam ditentukan dan dicek di server.
- Rate limit per sesi (atau per IP untuk yang belum login), dengan Redis bila tersedia.
- Cookie sesi `httpOnly`, CSP ketat untuk game, header keamanan, SVG upload diperiksa dan disajikan dengan sandbox.

## Peluncuran: cut-off supaya semua mulai dari 0

Selama masa uji, pemain (dan kamu) mengumpulkan koin, Mutiara, barang, dan level. Supaya adil saat game dibuka untuk umum, admin › **Peluncuran** (hanya owner):

- **Tarik Mutiara uji**: menarik Mutiara dari pembayaran uji (simulasi mock / kunci uji ZePay `zpk_test_…`). Pembayaran uji ditandai "uji" di admin › Pembayaran. Mutiara yang terlanjur dibelanjakan tidak bisa ditarik (saldo tidak dibuat minus) dan dilaporkan.
- **Cut-off peluncuran**: semua pemain mulai dari nol. Pilihan *Reset progres, akun tetap* (disarankan: pemain uji tetap bisa masuk, lalu membuat pet baru dengan koin/Mutiara/barang modal awal; daftar teman bisa dipertahankan) atau *Hapus semua pemain*. Item, harga, event, tugas, peta, pengaturan, paket, pengumuman, media, admin, log audit, dan riwayat email/WA tidak tersentuh. Wajib ketik `RESET BUPI`. Bila sudah ada pembayaran sungguhan, catatannya tetap disimpan dan cut-off perlu konfirmasi tambahan ("Hapus semua pemain" diblokir).

Urutan hari peluncuran:

```bash
./deploy/backup.sh
```

1. Cadangkan database (perintah di atas, di folder aplikasi).
2. Admin › Peluncuran › **Jalankan cut-off**.
3. Isi kunci live ZePay di `.env` (`PAYMENT_PROVIDER=zepay`, `ZEPAY_KEY_ID=zpk_live_…`, `ZEPAY_SECRET=zsk_live_…`), lalu restart.
4. Admin › Pembayaran › **Daftarkan webhook**, lalu beli satu paket kecil sungguhan untuk memastikan.
5. Umumkan peluncuran lewat Pengumuman / Broadcast.

## Yang perlu dilakukan sebelum peluncuran

- Uji push di HP Android dan iPhone sungguhan setelah deploy HTTPS.
- Aktifkan domain pengirim di Mailketing, kirim email uji dari admin, dan pasang URL webhook bounce.
- Uji WhatsApp Klik Flow dengan kunci tes & nomor uji, siapkan template Official bila memakai WhatsApp Official, lalu ganti ke kunci live dan daftarkan webhook.
- Uji QRIS ZePay dengan kunci mode uji dari awal sampai akhir, lalu ganti ke kunci live dan bayar satu paket kecil sungguhan.
- Cek & daftarkan merek "BUPI" di PDKI; amankan domain playbupi.com / bupi.id dan akun @playbupi.
- Halaman Kebijakan Privasi dan Syarat Layanan (wajib untuk login Google/Facebook dan pembayaran).
- Uji beban (mis. k6) dengan target DAU awal, lalu atur `PG_POOL_MAX` dan jumlah instance.
- Sentuhan seni: art direction final, suara, dan animasi tambahan sesuai style guide.
