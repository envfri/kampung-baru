# Kampung Bulu

Game pet sosial untuk browser dan HP (PWA). Pemain merawat pet "Bulu", menghias rumah isometrik, berkebun, ikut lomba karung, memancing, mengunjungi teman, dan menerima notifikasi walau game sedang ditutup. Semua karakter, gambar, nama, dan tata letak dibuat orisinal. **Kampung Bulu** masih nama kerja; cek dulu ketersediaan mereknya di PDKI (DJKI) sebelum peluncuran.

Pet bisa diubah lewat Lemari: 16 warna, 9 telinga, 6 motif, 5 gaya mata, 4 ekor (sebagian terbuka saat naik level), serta 30+ aksesori di kepala, wajah, leher, dan punggung. Katalog berisi puluhan makanan, mebel, dinding, lantai, bibit, dan ikan, semuanya bisa ditambah dari admin.

Isinya: game PWA, server API, panel admin, dan basis data. Semua gambar digambar sebagai SVG dari kode, jadi tidak ada file gambar besar. Muat awal game ±60 KB JavaScript (gzip) ditambah font.

## Fitur per fase

| Fase | Isi | Status |
|---|---|---|
| 1 · Vertical slice | Pet (warna, 4 tipe telinga), ruangan isometrik + mode atur, 4 kebutuhan yang turun seiring waktu, Pasar Pagi & Mebel Jati, Tas, login tamu / Google / email OTP, simpan di server, ledger dompet | Selesai |
| 2 · Alpha sosial | Teman lewat kode & link WhatsApp, kunjungan harian berhadiah, kirim & buka hadiah, Peta Kampung, Butik Benang & pakaian, Lomba Karung, Kebun | Selesai |
| 3 · Beta | Panel admin (katalog, event, ekonomi, peta, pemain, moderasi, audit), event musiman, rate limit & anti-curang, moderasi nama, PWA, analitik & funnel | Selesai |
| 4 · Soft launch | Mutiara via Midtrans (QRIS, e-wallet, transfer), Toko Mutiara (kosmetik saja), Kolam Pancing & koleksi ikan, kalender event | Selesai, perlu uji sandbox Midtrans |
| Mini-game | Balai Main: Panen Buah (tangkap buah, hindari kerikil) dan Ingat Jajanan (cocokkan kartu), plus Lomba Karung & Kolam Pancing. Skor dihitung ulang di server dari seed | Selesai |
| Event musiman | Diatur penuh dari admin: tanggal, dekorasi kampung & rumah (bendera, lampion, ketupat, kembang api, hujan, bunga), pengali koin, poin event per aktivitas, hadiah bertingkat, barang edisi terbatas, berulang tiap tahun, notifikasi otomatis saat mulai, template Agustusan/Ramadan/Lebaran/Imlek/Tahun Baru/Musim Hujan | Selesai |
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

Tanpa `DATABASE_URL`, server memakai PGlite (Postgres di dalam proses, data di `apps/server/.data/pglite`). Katalog awal, lokasi peta, event contoh, dan paket Mutiara dibuat otomatis saat pertama jalan. Kode OTP email muncul di log server bila `SMTP_URL` kosong. Pembayaran memakai halaman simulasi (`PAYMENT_PROVIDER=mock`).

Mode produksi lokal:

```bash
npm run build
```

```bash
npm start
```

## Admin

Admin pertama dibuat dari `ADMIN_EMAIL` + `ADMIN_PASSWORD` saat tabel admin kosong. Di mode dev tanpa variabel itu, server membuat `admin@kampungbulu.local` dengan password acak yang dicetak di log.

| Peran | Akses |
|---|---|
| Pemilik | Semua, termasuk harga paket Mutiara, tandai pembayaran lunas manual, kelola admin |
| Admin | Item & harga, event, peta & toko, ekonomi & fitur, media, notifikasi broadcast, pengumuman, ubah dompet/tas pemain, log audit |
| Moderator | Lihat semua data, blokir/buka blokir, ganti nama, keluarkan sesi, daftar kata terlarang |

Yang bisa diatur tanpa deploy:

- **Item & harga**: tambah/ubah makanan, mebel, pakaian, dinding, lantai, bibit, ikan. Gambar dari bentuk bawaan (warna bisa diubah) atau upload PNG/WebP/SVG, dengan pratinjau langsung.
- **Event**: buat dari template, atur tanggal, dekorasi, pengali koin, nama poin, poin per aktivitas, hadiah bertingkat (koin/Mutiara/item), berulang tiap tahun, dan notifikasi saat mulai. Lihat jumlah peserta & hadiah yang diambil.
- **Tugas**: tugas pemula & harian.
- **Peta & toko**: nama, posisi, warna bangunan, tampil/sembunyi, toko yang membeli barang pemain.
- **Ekonomi & fitur**: modal awal, kurva level, laju kebutuhan, hadiah & cooldown aksi, hadiah harian, lomba, kolam, kebun, ukuran ruangan, barang awal, notifikasi otomatis, nyala/matikan fitur dan metode login.
- **Notifikasi**: kirim sekarang atau jadwalkan ke semua pemain, yang aktif 7 hari, yang tidak aktif, pembeli, atau tamu.
- **Paket Mutiara**, **Pengumuman**, **Pemain**, **Pembayaran**, **Moderasi kata**, **Media**, **Log audit**, **Admin**.

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

- **Tamu**: langsung main. Progres tersimpan di server dan bisa ditautkan ke Google/email kapan saja tanpa hilang.
- **Google**: buat OAuth Client ID tipe Web di Google Cloud Console. Isi Authorized JavaScript origins dengan domain game, lalu isi `GOOGLE_CLIENT_ID`.
- **Email OTP**: isi `SMTP_URL` (mis. `smtps://user:pass@smtp.mailgun.org:465`).
- **Facebook** (opsional): isi `FACEBOOK_APP_ID` dan `FACEBOOK_APP_SECRET`. Sistem teman tetap memakai kode/link, karena Facebook hanya memberi daftar teman yang juga memakai aplikasi.

## Pembayaran (Midtrans)

1. Daftar Midtrans, ambil Server Key dan Client Key (sandbox dulu).
2. Isi `PAYMENT_PROVIDER=midtrans`, `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`, `MIDTRANS_PRODUCTION=false`.
3. Di dashboard Midtrans, set **Payment Notification URL** ke `https://domainmu/api/payments/midtrans/notify`.
4. Uji beli paket dari game. Mutiara masuk setelah notifikasi Midtrans diterima. Tanda tangan dan nominal diverifikasi, dan kredit hanya terjadi sekali.

Tamu harus menautkan akun dulu sebelum membeli, supaya Mutiara tidak hilang.

## Deploy ke VPS (Ubuntu 22.04/24.04)

Stack produksi: Caddy (HTTPS otomatis Let's Encrypt) → aplikasi → PostgreSQL + Redis, semuanya lewat Docker Compose. Minimal 1 vCPU, 2 GB RAM (skrip menambah swap otomatis bila RAM kecil).

1. Di panel DNS domain, buat **A record** domain → IP VPS. Di panel VPS, buka port **80** dan **443** (firewall/security group).
2. Masuk ke VPS lewat SSH, lalu buat deploy key untuk repo privat ini:

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/kampung_deploy -C "vps"
```

```bash
cat ~/.ssh/kampung_deploy.pub
```

   Tempel isinya di GitHub: repo → Settings → Deploy keys → Add deploy key (cukup akses baca).

3. Clone dan pasang (ganti domainnya):

```bash
GIT_SSH_COMMAND="ssh -i ~/.ssh/kampung_deploy -o StrictHostKeyChecking=accept-new" git clone git@github.com:envfri/kampung-baru.git ~/kampung-bulu
```

```bash
cd ~/kampung-bulu && git config core.sshCommand "ssh -i ~/.ssh/kampung_deploy"
```

```bash
sudo bash deploy/install.sh amt.ai.id
```

`install.sh` memasang Docker, menambah swap bila perlu, membuat `.env` dengan password acak, membangun & menjalankan semua layanan, memasang backup database harian (03:15, disimpan 14 hari di `backups/`), lalu mencetak alamat game, admin, dan password admin. HTTPS aktif otomatis beberapa menit setelah DNS mengarah ke VPS.

- Update ke versi terbaru: `bash deploy/update.sh`
- Lihat log: `docker compose logs -f app`
- Ubah konfigurasi (Google, SMTP, Midtrans): edit `.env`, lalu `docker compose up -d`
- Pembelian Mutiara masih **simulasi** (`PAYMENT_PROVIDER=mock`) sampai kunci Midtrans diisi. Ganti sebelum dibuka untuk umum.

## Pengujian

```bash
npm test
```

19 uji API (PGlite di memori): login & moderasi nama, makan/mandi/cooldown, beli dengan idempotensi, validasi ruangan (barang tak dimiliki, bertumpuk, versi lama), teman, kunjungan & hadiah, kebun, anti-curang lomba karung, kolam, hadiah harian, pembelian Mutiara mock + kredit tidak dobel, tanda tangan Midtrans, peran admin, blokir, notifikasi (kotak masuk, worker kebun, broadcast, preferensi), dan pengiriman Web Push terenkripsi ke endpoint tiruan.

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

## Yang perlu dilakukan sebelum peluncuran

- Uji push di HP Android dan iPhone sungguhan setelah deploy HTTPS.
- Uji Midtrans sandbox dari awal sampai akhir, lalu ganti ke kunci produksi.
- Cek merek "Kampung Bulu" di PDKI, atau pilih nama final.
- Halaman Kebijakan Privasi dan Syarat Layanan (wajib untuk login Google/Facebook dan pembayaran).
- Uji beban (mis. k6) dengan target DAU awal, lalu atur `PG_POOL_MAX` dan jumlah instance.
- Sentuhan seni: art direction final, suara, dan animasi tambahan sesuai style guide.
