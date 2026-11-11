# Changelog

Semua perubahan BUPI. Versi mengikuti [semver](https://semver.org/lang/id/): fitur baru menaikkan MINOR, perbaikan menaikkan PATCH; 1.0.0 untuk peluncuran publik.

> Berkas ini dibuat dari `packages/shared/src/changelog.ts` dengan `npm run changelog`. Jangan diedit langsung.

## 0.22.1 · 2026-11-11 · Akun Instagram yang benar: @playbupi

### Perbaikan

- Akun Instagram BUPI yang benar adalah @playbupi (sebelumnya tertulis @playbudi) di halaman perawatan, layar depan, Pengaturan › Tentang, dan data untuk Google. _(pemain)_
- Server yang sudah menyimpan Situs & SEO dengan akun lama otomatis diperbaiki saat versi ini berjalan; akun lain yang diisi admin tidak diubah. Halaman perawatan statis (Caddy) dan aset Instagram (marketing/instagram, npm run instagram) dibuat ulang.

## 0.22.0 · 2026-11-11 · SEO, pratinjau tautan & mode perawatan

### Baru

- Mode perawatan: halaman beranimasi (pet berhelm proyek memalu papan "DIRAPIKAN", temannya menyunggi batu bata) dengan perkiraan selesai & hitung mundur, tautan Instagram @playbupi, dan cek otomatis. Pemain yang sedang main langsung dialihkan lalu kembali ke game sendiri begitu perawatan selesai. Progres tetap aman. _(pemain)_
- Tautan BUPI yang dibagikan ke WhatsApp, Facebook, X, atau Telegram kini tampil dengan gambar & judul. Tautan undangan teman tampil sebagai "Nama ngajak kamu main BUPI!". _(pemain)_
- Layar depan berisi hal-hal yang bisa dilakukan di BUPI dan tautan media sosial. Ikuti kabar terbaru di Instagram @playbupi (juga di Pengaturan › Tentang). _(pemain)_
- Admin › Situs & SEO: judul, deskripsi, kata kunci, gambar pratinjau (bawaan atau dari Media), izin mesin pencari, verifikasi Google Search Console/Bing, akun media sosial (Instagram, TikTok, YouTube, Facebook, X), dengan pratinjau hasil Google & kartu tautan. Mode perawatan dinyalakan/dimatikan dari sini (dengan perkiraan selesai, teks, dan izin admin tetap main), tercatat di Log audit, dan ditandai merah di semua halaman admin.
- SEO: tag title/description/canonical/robots, Open Graph & kartu X lengkap (gambar 1200×630), data terstruktur JSON-LD (WebSite, Organization + akun sosial, VideoGame gratis), robots.txt, sitemap.xml, favicon.ico, konten noscript, dan X-Robots-Tag noindex untuk API/admin/bayar. Server uji otomatis tidak diindeks; indeks hanya di produksi ber-HTTPS.

### Perubahan

- Mode perawatan membalas HTTP 503 + Retry-After (aman untuk peringkat Google). Panel admin, webhook ZePay/Mailketing/Klik Flow, file statis, dan /healthz tetap jalan. Halaman perawatan statis opsional untuk Caddy saat server dimulai ulang (lihat DEPLOY.md). Aset dibuat dengan npm run site-assets; uji baru: tes server Situs & SEO dan npm run test:e2e:situs.

Commit: [`8d45259`](https://github.com/envfri/kampung-baru/commit/8d45259)

## 0.21.1 · 2026-11-11 · Audit alun-alun

### Baru

- Pengingat di obrolan alun-alun: jangan bagikan kode akun, kode pindah perangkat, nomor, atau alamat. Tim BUPI tidak pernah memintanya. _(pemain)_
- Tombol Main di bar alun-alun: pilih nonton, komidi putar, ayunan, berteduh, duduk, atau jajan tanpa harus mengetuk bendanya. _(pemain)_
- Migrasi 020 (users.chat_muted_until). Admin: Buka bisu di Moderasi & detail pemain, jumlah pelapor berbeda per 7 hari. Tes alun-alun diperluas (jam panggung tetap, laporan, bisu, filter, batas 0, kejadian setelah dibuat ulang, nama terlarang).

### Perubahan

- Main di alun-alun diberi jeda 3 detik; setelah jatah harian habis tetap boleh main tanpa koin, XP, ceria, atau kemajuan tugas. Joget bareng dihitung dari joget sungguhan saat musik. Foto alun-alun masuk album yang memotret & temannya saja, dan tidak dihitung untuk lencana foto di rumah teman. _(pemain)_

### Perbaikan

- Mandi atau nampan makan yang belum selesai di rumah tidak lagi membuat alun-alun macet. Ketuk jalan batu kini membuat pet berjalan ke sana, ketukan lantai tidak mengganggu aktivitas yang sedang berjalan, menu aktivitas tidak tertutup bar, dan label nama tidak lagi menumpuk jadi kolom panjang saat ramai (ada label "(kamu)" untuk pet sendiri). _(pemain)_
- Obrolan & ekspresi lama tidak diputar ulang saat baru masuk, tidak ada pemberitahuan setiap orang asing datang/pergi, pemberitahuan foto hanya bila kamu ikut difoto, foto alun-alun bergaya luar ruang, dan menyusul teman ke alun-alun yang sudah penuh diberi tahu. _(pemain)_
- Server: nomor urut kejadian bersama (obrolan tidak hilang saat alun-alun kosong dibuat ulang), pengaturan bernilai 0 dihormati, alun-alun yang ditutup juga menolak obrolan/aksi/foto/laporan, laporan dengan ID salah tidak lagi error 500, kabar masuk tidak membanjiri saat keluar-masuk cepat, log obrolan alun-alun dibersihkan setelah 60 hari. Game: penanganan galat jaringan, posisi terbaru dikirim saat masuk & berfoto, polling lebih jarang saat sendirian, dan gambar pet lain disimpan per pet.

### Keamanan

- Laporan hanya sah dari pemain yang sedang bertemu dengan yang dilaporkan di alun-alun yang sama (dan sudah 1 menit di sana). Akun sekali pakai tidak bisa lagi membisukan orang lain. Bisu 30 menit hanya sekali per gelombang laporan (tidak diperpanjang terus), tersimpan di server, berlaku di alun-alun & rumah, dan bisa dibuka moderator.
- Filter obrolan diperketat: yang disimpan & disiarkan adalah teks yang sudah dibersihkan; karakter pembalik arah, huruf mirip dari aksara lain, tanda gabung & angka aksara lain ditolak; kode akun / kode pindah perangkat dan nomor yang dicicil beberapa pesan ditolak; kata terlarang yang dieja per huruf tertangkap. Nama yang menyamar jadi tim BUPI (Admin, Moderator, Tim BUPI, ...) tidak bisa dipakai. _(pemain)_

Commit: [`2738769`](https://github.com/envfri/kampung-baru/commit/2738769)

## 0.21.0 · 2026-11-11 · Alun-alun kampung

_Alun-alun sudah dibuka! Jalan-jalan ke sana dari peta kampung, ketemu pemain lain, nonton panggung, naik komidi putar, jajan, dan joget bareng._

### Baru

- Alun-alun di peta kampung: lapangan luas tempat semua pemain berkumpul, dengan beringin kembar, air mancur, jalan batu, bangku, lampu taman, komidi putar, ayunan, dan gerobak jajanan. _(pemain)_
- Panggung hiburan bergiliran: Orkes Kampung, Wayang Kardus, Tari Payung, dan Sulap Pak Badut. Semua orang menonton acara yang sama; saat musik main, tekan Joget untuk joget bareng (makin ramai makin ceria). _(pemain)_
- Main di alun-alun: ketuk benda untuk nonton, naik komidi putar, main ayunan, berteduh di bawah beringin, duduk santai, atau jajan Es Dawet, Bakso, dan Arum Manis. Ada hadiah kunjungan harian dan hadiah main (dibatasi per hari). _(pemain)_
- Ngobrol, ekspresi, dan foto bareng dengan pet di sekitarmu, seperti saat berkunjung ke rumah teman. Satu alun-alun maksimal 20 orang; kalau penuh otomatis dibuka Alun-alun 2. Teman yang sedang di alun-alun bisa disusul dari daftar Teman. _(pemain)_
- Tugas harian "Jalan-jalan ke Alun-alun" serta lencana Anak Alun-alun dan Raja Joget. _(pemain)_
- Admin: Moderasi menampilkan laporan pemain (dengan obrolan terakhirnya, tandai selesai) dan obrolan alun-alun; pengaturan Ekonomi & fitur › Alun-alun (buka/tutup, kapasitas, ketik bebas atau frasa saja, hadiah). Tautan langsung #/players/<id> membuka detail pemain.
- Migrasi 019 (square_chat, reports, jenis lokasi square), paket konten v8. API: /api/square (sync, leave, say, act, photo, report), /api/admin/square-chat, /api/admin/reports. Peta kampung diperlebar ke 1260. Tes: square.test.ts & npm run test:e2e:alun.

### Perbaikan

- Frasa siap pakai obrolan di rumah sendiri kini muncul (pengaturan kunjungan sebelumnya tidak terkirim ke game). _(pemain)_

### Keamanan

- Karena di alun-alun bisa bertemu orang yang bukan teman: obrolan disaring (kata terlarang, tautan & nomor ditolak) dengan frasa siap pakai, pemain bisa Laporkan atau Blokir (yang diblokir tidak saling melihat & mendengar sama sekali), tiga laporan dari pemain berbeda dalam satu jam membisukan obrolan pemain itu 30 menit, dan semua obrolan tercatat untuk moderasi. _(pemain)_

Commit: [`c6b1e76`](https://github.com/envfri/kampung-baru/commit/c6b1e76)

## 0.20.1 · 2026-11-11 · Audit rumah tersambung & atur denah

### Baru

- Saat Atur mebel, ada peringatan bila sebuah ruangan jadi tidak bisa dimasuki karena jalannya tertutup mebel. _(pemain)_

### Perubahan

- Main bareng sekarang lewat ajakan: yang memulai mengajak, teman lain memilih sendiri "Ikut main" atau "Tidak" (15 detik). Jatah main bareng harian hanya terpakai kalau kamu ikut. Kalau tidak ada yang ikut, ajakan batal sendiri. _(pemain)_
- Foto bareng berisi pet tuan rumah, yang memotret, dan pet yang sedang satu ruangan dengannya. _(pemain)_
- API main bareng: action join / begin, fase ajak → main (event coop_join, coop_go; why sepi/batal). Tes: ajakan & blokir di main bareng, foto se-ruangan & blokir, validasi sinkron, uji "Susun otomatis" yang sungguhan.

### Perbaikan

- Atur denah: kamera tidak lagi bergeser sendiri saat ruangan dipindah, ruangan lain tidak ikut bergeser saat satu ruangan dibawa ke pojok belakang, ruangan baru bisa diseret setelah dipilih (seret di tempat lain = geser layar, cubit tetap bisa), dan ada tombol nama ruangan untuk memilih tanpa mengetuk gambar. _(pemain)_
- Pet tidak lagi berbelok ke petak acak saat diminta pindah ruangan, tetap berjalan ke ruangan pilihan setelah selesai mandi/beraktivitas/tidur, dan tidak lagi berdiri di atas kasur setelah bangun. Tamu tetap bisa berjalan walau pet tuan rumah sedang tidur. _(pemain)_
- Rumah lebih ringan di HP: hanya ruangan yang berubah yang digambar ulang, remah di lapisan sendiri. Mebel yang menempel ke dinding pemisah tidak lagi tergambar di depan dinding. Jendela & lukisan di pratinjau admin tidak lagi mencuat melewati dinding.
- Atur denah otomatis dibatalkan saat pindah layar atau ganti akun; semua masalah denah (bertumpuk, terpisah, terlalu jauh) punya pesan sendiri. Tamu yang pulang langsung hilang dari rumah walau tuan rumah sendirian.

### Keamanan

- Pemain yang saling memblokir tidak pernah ikut main bareng yang sama dan tidak ada di foto yang sama (foto tidak masuk album / lukisan mereka).
- Sinkron rumah live: ruangan yang dikirim harus milik tuan rumah dan posisi dibatasi ukuran ruangannya (cache daftar ruangan dibersihkan saat ruangan dibeli/diperluas). Batas koordinat denah diperlebar (±1000) supaya denah yang sah tidak tertolak setelah digeser.

Commit: [`d297ac2`](https://github.com/envfri/kampung-baru/commit/d297ac2)

## 0.20.0 · 2026-11-11 · Atur denah sendiri

_Sekarang kamu bisa mengatur letak ruangan sendiri: halaman di samping, dapur di belakang, sesukamu. Pintunya muncul sendiri._

### Baru

- Atur denah (Rumahku › Atur denah): ketuk ruangan, lalu geser dengan jari atau tombol panah. Pintu muncul sendiri di dinding yang menempel, dinding tinggi berjendela menyesuaikan sisi belakang rumah. _(pemain)_
- Ruangan tidak bisa ditumpuk. Ruangan yang belum menempel ke ruangan lain diberi garis merah dan harus ditempelkan dulu sebelum disimpan, supaya pet selalu bisa berjalan ke semua ruangan. _(pemain)_
- Susun otomatis: kembalikan denah ke susunan rapi bawaan kapan saja. Ruangan yang baru dibeli langsung menempel ke denahmu. _(pemain)_
- Migrasi 018 (rooms.gx, rooms.gy). API: POST /api/room/plan { rooms: [{ id, gx, gy }] } atau { auto: true }, kode galat plan_overlap / plan_apart; /api/room/expand mengembalikan planReset. @kb/shared: houseLayout memakai letak tersimpan (yang bertumpuk/terpisah disusun ulang), opsi strict, dan planProblem untuk validasi.

### Perubahan

- Kalau ruangan yang diperluas jadi menabrak ruangan lain di denahmu, denah kembali tersusun otomatis (ada pemberitahuan) dan bisa diatur lagi. _(pemain)_
- Teman yang berkunjung melihat denah rumahmu persis seperti yang kamu atur.

Commit: [`01eae37`](https://github.com/envfri/kampung-baru/commit/01eae37)

## 0.19.0 · 2026-11-11 · Rumah tersambung

_Semua ruanganmu kini menyambung jadi satu rumah: kamar, ruang tamu, dapur, kamar mandi, dan halaman tampil sekaligus. Pet berjalan antarruangan lewat pintu._

### Baru

- Rumah tersambung: ruangan yang kamu beli tidak lagi dipilih satu per satu, tapi tampil menyambung jadi satu rumah. Ruangan dalam disusun rapat dengan dinding rendah berpintu di antaranya, dan halaman ada di depan rumah. _(pemain)_
- Pet berjalan sendiri ke ruangan lain lewat pintu: ketuk lantai ruangan mana pun, atau pilih ruangan dari Rumahku. Kamera mengikuti ruangan tempat pet berada. _(pemain)_
- Tombol "Seluruh rumah" untuk melihat semua ruangan sekaligus. Rumah bisa digeser dengan jari, dicubit untuk memperbesar, atau digulir dengan mouse; tombol "Ikuti pet" membawa kamera kembali. _(pemain)_
- Denah otomatis (@kb/shared houseLayout): ruangan diletakkan supaya rumah sepadat mungkin, pintu di petak kosong terdekat ke tengah sisi bersama (bergeser bila tertutup mebel), dinding tinggi hanya bila tidak menutupi ruangan lain. Tidak ada perubahan database; ruangan yang diperluas atau dibeli membuat denah menyesuaikan sendiri.

### Perubahan

- Atur mebel per ruangan: ruangan yang sedang diatur terang, ruangan lain diredupkan. Ketuk ruangan lain untuk mengaturnya (simpan dulu perubahannya). _(pemain)_
- Kunjungan bareng satu rumah: teman yang sedang di dapur, halaman, atau ruangan lain tetap terlihat dan bisa diajak main bareng atau ikut foto bareng. _(pemain)_
- Jendela & lukisan ada di dinding belakang rumah. Remah & bulu rontok muncul di ruangan tempat pet berada. Kalau pet tidur, ia berjalan ke kasur walau kasurnya di ruangan lain.
- API: /api/house/:id/sync mengembalikan semua anggota rumah beserta roomId (posisi tetap per ruangan), elsewhere selalu kosong; main bareng & foto bareng mencakup semua yang ada di rumah; posisi hingga 16 petak. Tes baru: house-plan.test.ts dan npm run test:e2e:rumah.

Commit: [`f423382`](https://github.com/envfri/kampung-baru/commit/f423382)

## 0.18.1 · 2026-11-11 · Audit kunjungan bareng

### Baru

- Blokir pemain dari daftar tamu (Tamu › Blokir): langsung diantar pulang, berhenti berteman, dan tidak bisa menambahkanmu atau berkunjung lagi. Kelola di Pengaturan › Teman & tamu. _(pemain)_
- Hapus foto dari albummu sendiri. Kalau kamu memilih tidak memajang foto, foto berikutnya tidak lagi otomatis dipajang di lukisan. _(pemain)_
- Migrasi 017 (blocks, users.photo_off). API: POST/GET /api/blocks, DELETE /api/blocks/:id, DELETE /api/photos/:id; /api/house/:id/sync mengirim boot id.

### Perbaikan

- Main bareng: yang menekan Berhenti hanya keluar sendiri (permainan tetap jalan untuk yang lain), permainan yang dihentikan tanpa satu langkah pun tidak memakai jatah hadiah, dan bola pindah ke pemain lain bila pemegangnya pergi. _(pemain)_
- Ekspresi yang ditekan cepat tidak lagi hilang, obrolan tetap muncul setelah server diperbarui, dan dialog/kartu yang muncul tidak lagi bergeser sesaat saat dibuka. _(pemain)_
- Server: rumah kosong & catatan sementara di memori dibersihkan berkala (tidak menumpuk), pencarian pemain main bareng tidak lagi memindai semua rumah, baris pet dikunci berurutan (mencegah deadlock Postgres saat dua pemain saling berkunjung), batas jatah main bareng atomik, dan pemain yang bergabung bersamaan tidak lagi melebihi batas tamu. Klien lebih hemat: rumah yang tidak live dicek tiap 15 detik, tuan rumah tanpa tamu tiap 8 detik.

### Keamanan

- Tamu yang diantar pulang tidak bisa lagi beraksi, mengobrol, atau memotret di rumah itu. Berhenti berteman langsung berlaku. Foto bareng hanya bisa diambil dari dalam ruangan (tidak bisa memotret tamu lain dari jauh), dengan notifikasi maksimal sekali per jam per pemotret.
- Aksi ke pet teman diberi jeda 4 detik dan batas harian per teman; buku tamu hanya mencatat aksi berhadiah & camilan sehingga tidak bisa dibanjiri. Filter obrolan menormalkan karakter tak terlihat & angka lebar penuh.

Commit: [`e41aaaf`](https://github.com/envfri/kampung-baru/commit/e41aaaf)

## 0.18.0 · 2026-11-11 · Perluas ruangan

_Ruanganmu kini bisa diperluas sampai 12×12. Mebel tetap di tempatnya, dan main bareng teman jadi lega._

### Baru

- Perluas ruangan: tiap ruangan bisa diperbesar bertahap (mis. 6×6 → 8×8 → 10×10 → 12×12) di Rumahku atau di Toko Bangunan. Lantai baru bertambah di sisi depan, mebel yang sudah ada tidak bergeser, dan batas jumlah barang ikut bertambah. _(pemain)_
- Admin → Ekonomi & fitur → Rumah: maxSize (ukuran maksimal, sampai 14), expandStep (tambahan petak per perluasan), expandCoins (harga perluasan ke-1, ke-2, dst.). Migrasi 016 (rooms.size). API: POST /api/room/expand.

### Perbaikan

- Saat banyak teman berkunjung, pet tidak lagi bertumpuk di satu tempat: tiap pet mencari tempat sendiri dengan jarak dari pet lain. _(pemain)_

### Keamanan

- Obrolan di rumah disimpan 60 hari dan buku tamu 180 hari, lalu dihapus otomatis.

Commit: [`89e14c9`](https://github.com/envfri/kampung-baru/commit/89e14c9)

## 0.17.0 · 2026-11-11 · Kunjungan bareng: pet ikut main ke rumah teman

_Pet-mu kini ikut berkunjung. Main dengan pet teman, ngobrol, masak bareng, lempar bola, dan foto bareng. Kalau teman sedang online, kalian tampil bersama di rumah yang sama._

### Baru

- Pet-mu ikut berkunjung ke rumah teman dan berjalan-jalan di sana. Ketuk lantai untuk memindahkannya. _(pemain)_
- Main dengan pet teman: Sapa, Peluk, kasih Camilan dari tasmu (Kenyang pet teman bertambah), Kejar-kejaran, dan Duduk bareng. Ada hadiah koin untuk beberapa kali main per teman per hari, dan tuan rumah melihatnya di Buku tamu. _(pemain)_
- Main bareng langsung: kalau teman sedang di rumahnya atau teman lain sedang berkunjung, semua pet tampil bersama di ruangan yang sama (sampai 4 tamu sekaligus), lengkap dengan nama di bawah pet. _(pemain)_
- Ngobrol pakai frasa siap pakai atau ketik sendiri (tautan, nomor, dan kata kasar otomatis ditolak), plus ekspresi: lambai, tertawa, sayang, kaget. _(pemain)_
- Masak bareng: ikuti resep bergiliran, kalau berhasil semua pemain dapat koin dan makanan. Lempar bola: oper bola tepat waktu bersama-sama. _(pemain)_
- Foto bareng (gaya Senyum, Lompat, atau Peluk): masuk album semua pet yang ada di foto dan bisa dipajang di lukisan dinding rumahmu. _(pemain)_
- Status online di daftar Teman (di rumah / main ke rumah siapa / ramai berapa tamu), tab baru Buku tamu dan Album, serta pengaturan privasi: sembunyikan status online atau matikan main bareng langsung di rumahmu. Tuan rumah bisa mengantar tamu pulang. _(pemain)_
- Admin: bagian Kunjungan bareng di Ekonomi & fitur (aktif/nonaktif, jumlah tamu live, hadiah, ketik bebas, daftar frasa, batas main bareng & foto per hari) dan daftar obrolan terbaru di Moderasi kata. Notifikasi baru: tamu main dengan pet-mu, foto bareng. Tugas harian "Main ke rumah teman" dan lencana Tetangga Akrab, Koki Kampung, Kenangan Bareng.
- Migrasi 015 (visit_acts, house_chat, photos, photo_members; users.show_online, live_visits, featured_photo, guestbook_seen_at). API: /api/visit/:id/act, /api/house/:id/sync|leave|say|kick|coop|photo, /api/photos, /api/guestbook, /api/presence, /api/me/privacy. Keadaan rumah live disimpan di memori server (polling ±0,9 detik; tuan rumah tanpa tamu 5 detik).

Commit: [`d2371b4`](https://github.com/envfri/kampung-baru/commit/d2371b4)

## 0.16.1 · 2026-11-11 · Akhir mini-game lebih jelas

### Perbaikan

- Balap Bakiak: tim kini benar-benar melewati bendera finis dulu ("Finis!") sebelum hasil muncul. Gerakan tim lebih halus, pet-mu di depan, dan garis finis tidak lagi di ujung layar HP. _(pemain)_
- Lomba Karung: pet berhenti tepat di garis finis yang tergambar (sebelumnya berhenti sebelum garis) lalu melompatinya; lawan tetap berlomba sebentar sebelum papan hasil. _(pemain)_
- Semua mini-game memberi tanda akhir sebelum kartu hasil: "Waktu habis!", "Sampai puncak!" (Panjat Pinang), atau total putaran Gasing. _(pemain)_
- Lomba Karung punya batas waktu (semua lawan finis + 8 detik) dan Gasing melepas otomatis setelah 8 detik, supaya pemain yang berhenti tidak terjebak di layar permainan tanpa tombol keluar. _(pemain)_

Commit: [`0419067`](https://github.com/envfri/kampung-baru/commit/0419067)

## 0.16.0 · 2026-11-11 · Persiapan peluncuran: Mutiara uji aman & cut-off

### Baru

- Pembayaran uji (simulasi atau kunci uji ZePay) ditandai "uji" di admin › Pembayaran, dan Mutiara-nya bisa ditarik kembali dari admin › Peluncuran.
- Admin › Peluncuran: cut-off supaya semua pemain mulai dari 0 saat produksi dibuka (reset progres dengan akun tetap, atau hapus semua pemain). Konten & pengaturan admin tidak tersentuh, catatan pembayaran sungguhan dilindungi, wajib ketik RESET BUPI, tercatat di log audit.
- Migrasi 014 (payments.test, payments.revoked_at; pembayaran mock lama otomatis ditandai uji). API admin: GET /api/admin/launch, POST /api/admin/launch/revoke-demo, POST /api/admin/launch/reset.

### Perubahan

- Sebelum peluncuran resmi, menu Mutiara memberi tahu bahwa pembelian belum dibuka; Mutiara tetap bisa didapat dari hadiah harian, tugas, dan event. _(pemain)_

### Keamanan

- Server produksi yang masih memakai pembayaran simulasi (PAYMENT_PROVIDER=mock): pembelian Mutiara terkunci untuk pemain (game menampilkan "Pembelian Mutiara belum dibuka"); halaman simulasi & checkout hanya bisa dipakai admin yang sedang login di browser yang sama.

Commit: [`3836f4d`](https://github.com/envfri/kampung-baru/commit/3836f4d)

## 0.15.0 · 2026-11-11 · Simpan progres & pindah perangkat

_Main tanpa daftar tetap aman: simpan pet-mu ke Google atau email, atau pindah ke HP lain pakai kode sekali pakai._

### Baru

- Simpan progres: hubungkan akun tamu ke Google atau email dari Pengaturan › Akun. Pet, rumah, dan temanmu tetap sama, dan bisa dibuka di HP atau browser lain dengan masuk memakai Google/email yang sama. _(pemain)_
- Kode pindah perangkat: buat kode sekali pakai di Pengaturan › Akun, lalu ketik di HP/browser baru lewat "Punya kode pindah perangkat?". Tanpa perlu Google atau email. _(pemain)_
- Pengingat Simpan progres untuk pemain tamu (setelah beberapa hari main, Lv 3, teman pertama, atau menang duel), bisa ditunda. _(pemain)_
- Kalau perangkat ini sedang memakai akun lain, game bertanya dulu sebelum pindah akun supaya progres tidak hilang tanpa sengaja. _(pemain)_
- Admin → Ekonomi & fitur: bagian Akun (kode pindah aktif/nonaktif, masa berlaku kode, kapan pengingat Simpan progres muncul & lama tunda).
- Migrasi 013 (transfer_codes). API: POST /api/auth/transfer, POST /api/auth/transfer/redeem; login Google/email/Facebook dan tebus kode menolak pindah akun tanpa { switch: true } (kode identity_in_use / transfer_confirm berisi ringkasan kedua akun). Kode OTP email baru dihapus setelah login berhasil.

### Perubahan

- Sesi masuk diperpanjang otomatis selama dipakai: pemain aktif (termasuk tamu) tidak lagi terlempar keluar setelah 180 hari. _(pemain)_

Commit: [`869501b`](https://github.com/envfri/kampung-baru/commit/869501b)

## 0.14.0 · 2026-11-11 · Duel dengan teman

_Adu skor mini-game dengan teman: main bareng saat sama-sama online, atau kirim tantangan dan temanmu melawan bayangan permainanmu._

### Baru

- Duel Teman: tantang teman main Balap Bakiak, Gasing, atau Tangkap Layangan dengan soal yang sama persis. Buka dari menu Teman (tombol Duel di tiap teman) atau Balai Main. _(pemain)_
- Main bareng: kalau kalian berdua ada di ruang duel, permainan mulai bersamaan dan skor lawan terlihat langsung di layar. _(pemain)_
- Tantangan: tidak perlu menunggu teman online. Main duluan, nanti temanmu melawan "bayangan" permainanmu. _(pemain)_
- Hadiah koin untuk kedua pemain (menang lebih banyak, kalah tetap dapat), tanpa taruhan. Ada lencana Jagoan Duel dan tugas harian Adu seru. _(pemain)_
- Admin → Ekonomi & fitur: bagian Duel (aktif/nonaktif, batas duel per hari, koin menang/seri/kalah, XP, masa berlaku tantangan). Notifikasi baru di Pusat notifikasi: tantangan duel masuk dan hasil duel.
- Migrasi 012 (tabel duels). API: /api/duels (daftar & buat), /api/duels/:id (lihat, ready, start, progress, finish, decline). Skor duel diputar ulang di server dari langkah pemain; progres main bareng disimpan di memori server. Paket konten v6: lencana b-duel dan tugas harian h-duel.

Commit: [`6a7ac8b`](https://github.com/envfri/kampung-baru/commit/6a7ac8b)

## 0.13.1 · 2026-11-11 · Rapi di layar komputer

### Perbaikan

- Di layar komputer, tombol mini-game (Kiri/Kanan, Lepas gasing, Panjat!) tidak lagi melebar selebar layar. _(pemain)_
- Warung Jamu di peta tidak lagi tertimpa pohon, dan tempat yang diklik tidak memunculkan kotak garis. _(pemain)_
- Spasi yang hilang di keterangan tab Terfavorit.

Commit: [`f0acdd0`](https://github.com/envfri/kampung-baru/commit/f0acdd0)

## 0.13.0 · 2026-11-10 · Pet terasa hidup: rawat dengan sentuhan, jamu, lencana, mini-game Nusantara

_Wajah pet kini ikut perasaannya. Suapi, mandikan, dan tidurkan dengan sentuhan. Ada Warung Jamu, lencana, empat mini-game baru, dan suka rumah teman._

### Baru

- Wajah pet ikut perasaannya: senang tersenyum lebar, lapar berair mata, capek sayu dan menguap, kotor bernoda dan dikerubungi lalat, sakit berkompres. Matanya mengikuti jarimu. _(pemain)_
- Makan: buka nampan lalu seret makanan ke mulut pet (atau ketuk). Pet mangap dan mengunyah. _(pemain)_
- Mandi: gosok badan pet dengan sabun sampai berbusa, lalu bilas dengan gayung. _(pemain)_
- Tidur: matikan lampu, pet naik ke kasur dan energinya terisi pelan-pelan. Pet bangun sendiri saat segar (ada notifikasi), atau bangunkan kapan saja. _(pemain)_
- Pet suka berceletuk sesuai suasana hatinya. _(pemain)_
- Pet bisa sakit ringan bila lama dibiarkan lapar dan kotor. Belikan jamu di Warung Jamu (Peta Kampung, sisi kanan) untuk menyembuhkannya. _(pemain)_
- Kebanyakan makan bikin pet gembul. Olahraga dengan Sepeda Statis atau lompat tali di Matras Senam (Mebel Jati). _(pemain)_
- Remah dan bulu rontok muncul di lantai. Ketuk untuk menyapu dan dapat koin. _(pemain)_
- Lencana: 15 pencapaian dengan hadiah (Tugas › Lencana). _(pemain)_
- Mini-game baru di Balai Main: Balap Bakiak, Gasing, Tangkap Layangan, dan Panjat Pinang (khusus event Agustusan). _(pemain)_
- Suka rumah teman saat berkunjung (sekali seminggu), dan lihat Rumah terfavorit minggu ini di menu Teman. _(pemain)_
- Admin → Ekonomi & fitur: bagian Tidur, Kesehatan, Berat badan, Remah, Celetukan pet (satu baris satu kalimat), dan pengaturan 4 mini-game baru. Item makanan bisa ditandai "menyembuhkan"; Aktivitas punya efek "berat"; Tugas punya jenis Lencana.
- Notifikasi baru di Pusat notifikasi: pet bangun tidur, pet sakit, rumah disukai.
- Migrasi 011 (pets: sleep_from, sick_at, weight, crumbs_at; quests kind badge; house_likes). API: /api/sleep, /api/sweep, /api/visit/:id/like, /api/houses/top; aksi "tidur" dari PWA lama kini memulai tidur. Paket konten v5: Warung Jamu, 4 jamu, olahraga, 15 lencana, 3 tugas harian. Peta diperlebar ke 1080 (posisi X lokasi sampai 1040).

### Perubahan

- Aktivitas kasur bawaan menjadi "Rebahan" sebentar; tidur sungguhan lewat lampu (tombol Tidur, atau ketuk kasur/lampu). _(pemain)_

Commit: [`bade17f`](https://github.com/envfri/kampung-baru/commit/bade17f)

## 0.12.0 · 2026-11-10 · Rumah berkamar-kamar, mebel bisa dipakai, belanja jalan kaki

_Bangun rumahmu: tambah ruang tamu, dapur, sampai halaman. Ketuk mebel untuk tidur, duduk, menyiram, atau membaca. Belanja kini dengan berjalan ke toko di Peta Kampung._

### Baru

- Toko Bangunan di Peta Kampung: beli ruangan baru untuk rumahmu (Ruang Tamu, Dapur, Kamar Mandi, Halaman Rumput berpagar, dan Loteng Bintang di Toko Mutiara). Pindah ruangan lewat tombol nama ruangan di Rumah. _(pemain)_
- Mebel bisa dipakai: ketuk kasur untuk tidur, sofa/kursi untuk duduk santai, tanaman untuk disiram, rak buku untuk membaca, TV, akuarium, kulkas, kompor (masak roti), bak mandi, juga jendela dan lukisan di dinding. _(pemain)_
- Belanja dengan mendatangi tokonya: ketuk toko di Peta Kampung, pet berjalan ke sana lalu masuk. Tiap toko punya penjaga dan barangnya sendiri. _(pemain)_
- Mebel baru: Kompor Dapur, Bak Mandi, Bangku Taman, Pohon Mangga; lantai Rumput dan Batu Paving. _(pemain)_
- Admin → Aktivitas di rumah: tambah/ubah aktivitas (mebel atau bagian ruangan yang bisa dipakai, animasi, efek kebutuhan, XP, koin, hadiah barang, jeda, batas harian, level minimal, pesan) dengan pratinjau pose pet.
- Item jenis Ruangan rumah (ukuran 4–10, ruangan dalam atau halaman, dinding & lantai awal) dan pengaturan house.maxRooms. Migrasi 010: rooms punya id per ruangan (data kamar lama tetap utuh), tabel activities.
- API: POST /api/activity, POST /api/room menerima roomId (tanpa roomId = kamar awal, aman untuk PWA lama), state & kunjungan mengirim daftar rooms. Tugas harian baru "Betah di rumah" (peristiwa activity).

### Perubahan

- Tombol Toko di bawah diganti Tugas (dengan tanda hadiah siap). Saat berkunjung, kamu bisa melihat semua ruangan rumah teman. _(pemain)_

Commit: [`663e93c`](https://github.com/envfri/kampung-baru/commit/663e93c)

## 0.11.1 · 2026-11-10 · Login lewat http:// & perbaikan tampilan desktop

_Masuk dan main dari browser desktop kini lebih lancar._

### Baru

- Saat kenalan, nama pet bisa diketik bebas atau diacak dengan tombol Acak. _(pemain)_

### Perbaikan

- Main tanpa daftar tidak lagi langsung diminta masuk ulang saat game dibuka lewat alamat http:// (mis. IP server sebelum domain siap). _(pemain)_
- Di layar komputer, jumlah koin & Mutiara tetap terlihat saat Tas/Toko terbuka, dan semua kategori terlihat tanpa harus digeser. _(pemain)_
- Bagikan undangan menyalin ajakan lengkap dengan link berisi kode teman. Ada juga tombol Salin link. _(pemain)_
- Isi-otomatis browser/pengelola sandi dimatikan di form kenalan; sesi tamu yang hilang sebelum pet dibuat dipulihkan otomatis.

### Keamanan

- Cookie sesi memakai flag Secure hanya bila PUBLIC_URL https:// (sebelumnya mengikuti NODE_ENV, sehingga di http:// browser membuang cookie dan semua /api/* 401).

Commit: [`aae0213`](https://github.com/envfri/kampung-baru/commit/aae0213), [`4a3e68c`](https://github.com/envfri/kampung-baru/commit/4a3e68c)

## 0.11.0 · 2026-11-10 · Nama baru: BUPI

_Kampung Bulu sekarang bernama BUPI! Pet-mu, rumahmu, dan teman-temanmu tetap sama._

### Perubahan

- Game berganti nama menjadi BUPI. Kampungnya sekarang bernama Kampung Bupi, dan pet-mu disebut bupi. _(pemain)_
- Nama di layar utama HP ikut berganti. Bila ikon lama masih bernama Kampung Bulu, pasang ulang dari menu browser. _(pemain)_
- Nama BUPI di judul & manifest PWA, layar masuk, admin, email (pengirim, isi, halaman berhenti langganan), WhatsApp, teks berbagi kode teman, notifikasi push, dan dokumentasi.
- Nama teknis: database bupi, file backup bupi-*.sql.gz, paket bupi, folder pemasangan ~/bupi (DEPLOY.md).

### Perbaikan

- backup.sh tidak lagi meninggalkan file backup kosong/rusak bila pg_dump gagal (mis. database mati): dump ditulis ke file sementara dan dicek penanda akhirnya dulu.
- Dua backup di detik yang sama (backup pengaman restore.sh) tidak lagi saling menimpa.

## 0.10.2 · 2026-11-10 · Panduan deploy & skrip deploy lebih aman

### Baru

- DEPLOY.md: panduan deploy rekomendasi untuk Ubuntu 24.04/26.04 LTS (spesifikasi, DNS, pengamanan VPS, instalasi, setelah instal, update, rollback, backup di luar server, masalah umum).
- deploy/restore.sh: pulihkan database dari backup dengan konfirmasi, didahului backup kondisi sekarang.

### Perubahan

- update.sh membuat backup database dulu, lalu memeriksa server sehat dan menampilkan versi yang berjalan.
- install.sh mendukung Ubuntu 26.04 (resolute) dan memakai paket Docker bawaan Ubuntu bila repo Docker belum punya rilis tersebut.

### Perbaikan

- install.sh tidak lagi berhenti di langkah terakhir pada VPS baru yang belum punya crontab (backup harian kini terpasang dan password admin tercetak).
- Backup harian berjalan sebagai user deploy (bukan root), sehingga update.sh tanpa sudo bisa menulis backup.
- Nama file backup memakai detik agar dua backup di menit yang sama tidak saling menimpa.

Commit: [`a89984a`](https://github.com/envfri/kampung-baru/commit/a89984a)

## 0.10.1 · 2026-11-10 · Tampilan lebih rapi & update PWA lebih andal

### Perubahan

- PWA memeriksa versi baru tiap 30 menit dan saat aplikasi dibuka lagi dari latar, sehingga pemain yang membiarkan aplikasi terbuka tetap mendapat update.

### Perbaikan

- Di HP layar kecil, daftar Balai Main dan daftar teman tidak lagi berdesakan. _(pemain)_
- Pemberitahuan "Versi baru tersedia" pindah ke atas sehingga tidak menutupi tombol Makan sampai Atur. _(pemain)_
- Info event kembali rapi ("Pekan Ceria Kampung · koin ×1.2"). _(pemain)_

Commit: [`e218691`](https://github.com/envfri/kampung-baru/commit/e218691)

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

## 0.1.0 · 2026-11-09 · Versi pertama

_Rawat pet, hias rumah, dan bermain bersama teman di kampung._

### Baru

- Rawat pet-mu: makan, mandi, main, tidur. Hias rumah dengan mebel dari toko. _(pemain)_
- Peta kampung: kebun, Lomba Karung, Kolam Pancing, dan toko. _(pemain)_
- Berteman, berkunjung, dan kirim hadiah. _(pemain)_
- Bisa dipasang di layar utama HP dan menerima notifikasi. _(pemain)_
- Server API dengan ekonomi di server, panel admin, PWA, notifikasi push.

Commit: [`6608d85`](https://github.com/envfri/kampung-baru/commit/6608d85)

