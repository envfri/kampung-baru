# Changelog

Semua perubahan BUPI. Versi mengikuti [semver](https://semver.org/lang/id/): fitur baru menaikkan MINOR, perbaikan menaikkan PATCH; 1.0.0 untuk peluncuran publik.

> Berkas ini dibuat dari `packages/shared/src/changelog.ts` dengan `npm run changelog`. Jangan diedit langsung.

## 0.34.0 · 2026-11-13 · Kolam Pancing baru: 25 ikan, ikan rahasia & harta karun

_Mancing sekarang ada tahapannya: lempar, tunggu bayangan ikan, sambar, lalu tarik-ulur. Ada 25 ikan, 3 ikan rahasia, dan peti harta karun!_

### Baru

- Mancing bertahap: tahan untuk atur tenaga lempar (Dekat, Sedang, Jauh), tunggu bayangan ikan mendekat, ikan ngicip-ngicip dulu, sambar tepat waktu, lalu tarik-ulur sambil menjaga tali supaya tidak kendur atau putus. _(pemain)_
- 25 ikan dalam 4 kelas (Biasa, Jarang, Langka, Legenda). Ada ikan yang lebih sering muncul pagi, malam, di tepi atau di tengah kolam. Lempar jauh memakai energi lebih banyak, tapi lebih sering dapat ikan langka. _(pemain)_
- 3 ikan rahasia tampil sebagai "???" di Buku Ikan sampai tertangkap. Petunjuknya bisa ditemukan di Botol Berisi Pesan. _(pemain)_
- Temuan dari kolam: sandal, kaleng, botol berisi pesan (koin + pesan), Kendi Antik (hiasan rumah), Kalung Kerang Mutiara, dan Peti Harta Karun berisi 50–300 koin, kadang juga Mutiara (maks. 3 Mutiara per hari dari kolam). _(pemain)_
- Buku Ikan baru: dikelompokkan per kelas, dengan siluet, kapan & di mana ikan muncul, tab Temuan dan Rekor. Kolam ikut jam: pagi, siang, sore & malam. _(pemain)_
- Peta Kampung menampilkan berapa orang sedang di Alun-alun ("● 7 orang di sini · Alun-alun 1 · 7/20"), dengan tanda "Ramai!" kalau hampir penuh. _(pemain)_

### Perubahan

- Teknis: migrasi 024, lib/fishing.ts (dipakai ulang untuk alun-alun nanti: place, kuota, hadiah), rute /api/fish/cast·hook·land·lost; /api/fish/reel lama menjawab update_required. Paket konten 11 (penanda pack_ikan): id ikan lama tetap, sandal pindah ke temuan. Admin: pengaturan Kolam Pancing lengkap & isian ikan baru. Komponen FishingFlow & CatchCard. Lebar kartu badge peta diukur dari teks sungguhan.

### Keamanan

- Hasil lemparan ditentukan server saat melempar; nama, gambar & petunjuk ikan rahasia tidak dikirim sebelum tertangkap; waktu sambar & lama tarik-ulur minimum dicek server, jadi skrip tidak bisa langsung menangkap.

## 0.33.0 · 2026-11-13 · Kebun bisa diperluas & 18 bibit

_Kebun sekarang bisa diperluas sampai 18 petak, ada 14 bibit baru, dan tombol Siram semua, Tanam semua & Panen semua._

### Baru

- Perluas kebun dari Lv1 (6 petak) sampai Lv5 (18 petak): 400, 1.200, 3.000 & 6.000 koin, saat pet Lv 3, 6, 10 & 15. Tiap level menambah hiasan: orang-orangan sawah & pagar bambu, gentong air, gubuk, papan nama & bunga. _(pemain)_
- Bonus tiap level: Lv2 kadang panen +1, Lv3 membuka Siram semua, Lv4 membuka Tanam semua, Lv5 tanaman tumbuh 10% lebih cepat. _(pemain)_
- 14 bibit baru (total 18): beberapa terbuka di level pet tertentu, dan ada bibit musiman dari acara. _(pemain)_
- Siram tanaman (waktu tumbuh −10%) dan beri Pupuk (−25%, beli di Pasar Pagi). Tombol Panen semua, Siram semua & Tanam semua, plus "Pilih bibit" yang bisa beli & tanam sekali ketuk. _(pemain)_

### Perubahan

- Di layar lebar, kebun Lv3 ke atas tampil dua bedeng berdampingan supaya tidak kecil. Papan nama kebun memakai nama pet dan selalu muat. _(pemain)_
- Teknis: migrasi 025 (users.garden_level; garden_plots grow_sec, watered_at, fertilized_at), rute kebun dipindah ke routes/garden.ts (expand, harvest-all, water, fertilize, plant buy/all). Paket konten 13 memakai penanda pack_kebun. Admin Ekonomi & fitur → Kebun: tabel level, persen siram/pupuk/bonus, XP panen, batas XP & tanam harian. Bibit di atas level pet tidak bisa dibeli.

### Keamanan

- Naik level kebun mengunci baris pemain dalam satu transaksi (ketuk dua kali tidak membayar dua kali); semua aksi kebun & aksi "semua" dicek di server; batas XP panen 150/hari & tanam 300/hari.

Commit: [`63882f0`](https://github.com/envfri/kampung-baru/commit/63882f0)

## 0.32.0 · 2026-11-13 · Butik Benang: baju untuk pet

_Pet sekarang bisa pakai baju! 28 baju baru dan 12 aksesori di Butik Benang, bisa dicoba dulu sebelum dibeli._

### Baru

- Bagian baru "Baju": 28 pakaian, dari kaos polos, daster bunga, piyama bintang, sarung, baju lurik, batik Parang/Kawung/Mega Mendung, baju silat, sampai kebaya & beskap. Bisa dipadukan dengan topi, kalung, ransel & barang bawaan. _(pemain)_
- Tiga baju istimewa di Toko Mutiara: Kostum Dino, Jaket Payet Panggung & Baju Songket Emas. _(pemain)_
- 12 aksesori baru, jadi isi Butik Benang naik dari 50 ke 85 barang. _(pemain)_
- Tombol "Coba": lihat petmu memakai barangnya dulu. Semua yang dicoba terkumpul di Kaca Pas dan bisa dibeli sekaligus, lalu langsung dipakai semua. _(pemain)_

### Perubahan

- Butik punya tab per bagian (Baju, Kepala, Wajah, Leher, Punggung, Dibawa), lencana "Baru" untuk barang baru selama 14 hari, dan manekin yang berganti tiap hari. Lemari punya bagian Baju. _(pemain)_
- Teknis: slot pakaian `body` digambar di renderPet (lengan di belakang badan, kain mengikuti badan di bawah garis luar, aksesori depan tetap di atas); disembunyikan di Balap Karung karena tertutup karung. Paket konten 12 memakai penanda pack_butik sehingga urutan paket tidak saling melewatkan. Admin: slot Baju & isian "Set padu-padan".

### Keamanan

- POST /api/shop/buy-many (Kaca Pas): hanya barang pakai, tanpa dobel, menolak barang yang sudah dimiliki, total koin & Mutiara dicek dalam satu transaksi (kurang = tidak ada yang terbeli), idempoten per requestId.

Commit: [`c8ea922`](https://github.com/envfri/kampung-baru/commit/c8ea922)

## 0.31.3 · 2026-11-13 · Bagian atas layar HP lebih rapi

### Perubahan

- HP sempit (≤380 px): level pindah ke pojok avatar dan tombol ikon sedikit lebih kecil supaya nama pet tetap terbaca. Teknis: HUD menulis kelebihan tingginya ke --hud-x; Needs, roombar, event, kartu kunjungan, toast, --prompt-top & tepi kamera rumah ikut menyesuaikan.

### Perbaikan

- Di HP, tombol lonceng, kabar, kalender & pengaturan tidak lagi menutupi lingkaran Kenyang/Bersih/Ceria/Energi. Koin & Mutiara diusahakan tetap sebaris; kalau tetap turun dua baris (koin sangat banyak atau huruf HP diperbesar), kebutuhan, pilihan ruangan & tombol acara ikut turun. _(pemain)_
- Nama acara di tombol acara tidak lagi terpotong ("Pekan Ceria Kampun…"); sekarang boleh dua baris. _(pemain)_
- Petunjuk di peta Kampung tidak lagi terpotong di HP; teks turun ke baris kedua. _(pemain)_

Commit: [`37925c0`](https://github.com/envfri/kampung-baru/commit/37925c0)

## 0.31.2 · 2026-11-13 · Alun-alun tampil utuh 20×20

### Perubahan

- Teknis: batas ukuran satu ruangan di houseLayout dinaikkan dari 16 ke 24 (ALUN_SIZE 20 tidak lagi terpotong); ukuran rumah pemain tetap dibatasi aturan pembelian ruangan.

### Perbaikan

- Alun-alun sekarang tergambar utuh 20×20 petak. Sebelumnya rumput & pagar terpotong di 16 petak, sehingga gerobak jajan, beberapa bangku, jalan batu, tikar Ular Tangga, garis start Balap Karung, dan pet yang berjalan ke sana tampak berada di luar lapangan. _(pemain)_

Commit: [`276a3b8`](https://github.com/envfri/kampung-baru/commit/276a3b8)

## 0.31.1 · 2026-11-13 · Panggung alun-alun lebih rapi

### Perubahan

- Teknis: ?acara=tari|orkes|wayang|sulap untuk pratinjau tampilan panggung (hanya tampilan, tidak mengubah jadwal acara).

### Perbaikan

- Panggung alun-alun: pengisi acara paling kiri tidak lagi tertutup tirai & lantai panggung. Ketiganya sekarang berdiri sebaris dengan jarak sama, dan payung tari, gitar, serta wayangnya terlihat semua. _(pemain)_

Commit: [`b195d9a`](https://github.com/envfri/kampung-baru/commit/b195d9a)

## 0.31.0 · 2026-11-12 · Halaman depan baru: rumah, pekarangan & langit

### Perubahan

- Halaman depan dirombak. Di desktop jadi dua kolom: judul, tombol Main sekarang / Masuk dengan email di kiri, dan adegan besar rumah dua ruangan di atas pekarangan (pohon, pagar bambu, bunga, jalan batu, lampu taman) di kanan. _(pemain)_
- Tiga pet di halaman depan diacak setiap kali dibuka (warna, telinga, motif & aksesori) dan bergerak pelan. Langit ikut jam pengunjung (pagi, siang, sore, malam berbintang dengan lampu taman menyala), lengkap dengan bukit & awan. _(pemain)_
- Kartu fitur bergambar (pet, miniatur ruangan, main bareng, gasing & layangan) dan tautan Instagram di pojok atas. Di HP adegan rumah tampil di atas, lalu judul, tombol & kartu fitur. _(pemain)_
- Teknis: lib/heroScene.ts menggambar adegan dari fungsi rumah & pekarangan yang sudah ada (tanpa unduhan gambar); ?langit= & ?pets= untuk pratinjau; layar ≥1600 px ikut membesar; diuji 7 ukuran layar tanpa geser samping & tanpa teks keluar dari latar.

Commit: [`46e0354`](https://github.com/envfri/kampung-baru/commit/46e0354)

## 0.30.0 · 2026-11-12 · Admin → Server: pemantauan CPU, memori, penyimpanan & database

### Baru

- Halaman Server (owner & admin): CPU, memori, penyimpanan, dan database (ukuran, koneksi, kecepatan kueri, cache), lengkap dengan grafik 1 jam. Bila server berjalan di container, yang dipakai batas container-nya. Diperbarui tiap 10 atau 30 detik.
- Aplikasi & pemain: jeda event loop, permintaan per menit, waktu respons, persentase error 5xx, pemain online beserta sebarannya (rumah, berkunjung, alun-alun, peta, mini-game), sesi main bareng, dan antrean email/WhatsApp.
- Riwayat CPU, memori & pemain online: 1 jam & 24 jam dari memori, 7 & 30 hari dari database (rata-rata 5 menit, disimpan 30 hari, tetap ada setelah restart).
- Peringatan ke owner lewat email, WhatsApp & lonceng admin (angka merah di menu Server) dengan jeda 30 menit per jenis: CPU di atas 85% selama 5 menit, memori di atas 90%, penyimpanan di atas 85%, kueri database di atas 200 ms, error di atas 2% dalam 5 menit, dan (opsional) server menyala ulang. Ambang, saluran & penerima bisa diubah, ada tombol Kirim tes dan riwayat peringatan.
- Endpoint paling lambat (p95, 1 jam), error terakhir, tabel database terbesar, info sistem, dan Unduh laporan (JSON).

### Perubahan

- Pusat notifikasi: jenis baru "Peringatan server (ke owner)" untuk mengatur teks email/WhatsApp dan template WhatsApp Official.
- Teknis: migrasi 023_monitor (server_metrics, server_alerts), lib/monitor.ts (cgroup v1/v2, statfs, monitorEventLoopDelay, hook permintaan /api/), routes/server-monitor.ts, angka menu "server", uji server-monitor.test.ts & e2e admin.

Commit: [`a1b8f5c`](https://github.com/envfri/kampung-baru/commit/a1b8f5c)

## 0.29.1 · 2026-11-12 · Teks tidak lagi keluar dari tombol & kartu

### Perubahan

- Teknis: pemeriksaan otomatis teks-keluar-dari-latar di semua panel, tab, toko, mini-game, menu benda rumah & alun-alun pada lebar 320, 360, 390 & 1366 px (0 temuan); gaya titik online di panel Teman dibatasi ke <i> supaya tidak mengenai tab.

### Perbaikan

- Tulisan panjang di tombol sekarang turun ke baris baru dan tetap di dalam tombol, misalnya "Buka Lemari: ubah warna, telinga, motif, mata, ekor" di Tas. _(pemain)_
- Menu aktivitas benda (misalnya Air Mancur → Foto bareng): keterangan di kanan tidak lagi keluar dari tombol. _(pemain)_
- Deret kategori di Tas, Lemari & Toko tidak lagi terpotong di tepi layar HP: kategori yang tidak muat pindah ke baris kedua. _(pemain)_
- Panel Teman: tab yang sedang dipilih (Buku tamu, Album, Favorit) tidak lagi menyempit sampai tulisannya keluar; tab yang tidak muat pindah ke baris kedua. _(pemain)_

Commit: [`b2e0979`](https://github.com/envfri/kampung-baru/commit/b2e0979), [`7ec0630`](https://github.com/envfri/kampung-baru/commit/7ec0630)

## 0.29.0 · 2026-11-12 · Pekarangan, langit ikut jam & kamera desktop

### Baru

- Pekarangan: rumah sekarang berdiri di pulau rumput dengan pohon, beringin yang mengintip di belakang, semak, bunga, jalan batu, lampu taman, kotak surat, dan pagar bambu. Ukurannya ikut membesar saat rumah bertambah ruangan, juga di rumah teman. _(pemain)_
- Langit ikut jam: pagi, siang, sore, dan malam (bintang, bulan, lampu taman menyala), dengan awan yang bergerak pelan. Cukup gradasi warna & satu gambar kecil, tetap ringan. _(pemain)_
- Desktop: panel kamera di kiri bawah. Dekat (zoom ke pet, kamera ikut saat berjalan), Ruangan, Pekarangan, plus tombol −/+. Bisa juga gulir untuk zoom, seret untuk geser, dan tombol 1/2/3, +/−, R. _(pemain)_
- Desktop: Putar sudut (lihat rumah dari sisi seberang) dan Mode santai (setelah 30 detik tidak disentuh, kamera bergerak pelan di sekitar pet; berhenti begitu mouse bergerak dan paling lama 3 menit). _(pemain)_

### Perubahan

- Tata letak dirapikan supaya menu & kartu tidak saling menutupi (diuji di 10 ukuran layar, dari HP 360 px sampai layar 2560 px): kartu main bareng kini di atas menu bawah, dan selama kartu itu tampil kartu tugas, tombol aksi & panel tamu disembunyikan dulu; di HP kartu tugas tidak lagi menimpa panel tamu; kartu ajakan berteman, ajakan notifikasi & tombol Tonton pindah ke bawah bar atas; menu aktivitas mebel tidak menutupi tombol aksi. _(pemain)_
- Teknis: houseYardSVG, houseYardBounds & skyTime di @kb/shared (pekarangan dibuat ulang hanya saat denah berubah); kamera near/yard, G.mirror & G.santai disimpan per perangkat; BG.card & --prompt-top untuk tata letak; uji yard.test.ts; e2e rumah/alun-alun/main bareng disesuaikan.

Commit: [`dfd6762`](https://github.com/envfri/kampung-baru/commit/dfd6762)

## 0.28.2 · 2026-11-12 · Permainan lebih besar di layar desktop

### Perubahan

- Desktop: papan Congklak sekarang hampir dua kali lebih lebar, dengan nama, sisa waktu, dan petunjuk yang ikut membesar. _(pemain)_
- Desktop: papan Ular Tangga setinggi layar di sebelah kiri, sedangkan daftar pemain, catatan langkah, dadu, dan tombol lempar ada di panel kanan. _(pemain)_
- Desktop: kartu Ingat Jajanan lebih besar dan disusun 8 × 2 di tengah layar lebar. Tampilan di HP tidak berubah. _(pemain)_

Commit: [`973652d`](https://github.com/envfri/kampung-baru/commit/973652d)

## 0.28.1 · 2026-11-12 · Kartu rumah teman ikut disembunyikan saat main bareng

### Perbaikan

- Saat main bareng di rumah teman, kartu "Rumah …" (Ambil koin, Suka, Hadiah, Pulang) ikut disembunyikan supaya tidak mengintip di belakang papan di HP. Kartunya kembali setelah permainan selesai. _(pemain)_

Commit: [`1ed18f0`](https://github.com/envfri/kampung-baru/commit/1ed18f0)

## 0.28.0 · 2026-11-12 · Main bareng langkah demi langkah & latar bermotif

### Perubahan

- Congklak: biji diambil lalu dijatuhkan satu per satu ke tiap lubang (angkanya ikut berubah), ada tangan yang membawa sisa biji, jeda saat mengambil lagi, dan efek saat menembak biji lawan. _(pemain)_
- Ular Tangga Kampung: dadu berputar dulu, lalu bidak melompat kotak demi kotak, memanjat tangga bambu, meluncur mengikuti lengkung ular, maju dua langkah di Warung, dan bergoyang di Becek. _(pemain)_
- Waktu giliran berikutnya ditambah selama langkah sebelumnya dimainkan, dan kartu hasil baru muncul setelah langkah terakhir selesai. _(pemain)_
- Selama main bareng, kartu Sapa/Ngobrol di rumah dan bar Alun-alun disembunyikan supaya papan lebih lega; muncul lagi setelah permainan selesai. Papan Ular Tangga dan Congklak sekarang di tengah layar. _(pemain)_
- Latar di rumah dan alun-alun tidak lagi polos: motif kawung, daun, dan bunga melati yang tipis (satu gambar kecil, tetap ringan). _(pemain)_
- Teknis: congklakFrames, ularFrames, dan framesMs di @kb/shared dipakai server (tambahan waktu giliran) dan game (animasi); langkah terakhir membawa at & anim. Uji bareng & e2e disesuaikan.

Commit: [`e0d69c6`](https://github.com/envfri/kampung-baru/commit/e0d69c6)

## 0.27.0 · 2026-11-12 · Aksesori baru: jubah, sayap, topi, topeng & slot Dibawa

_36 aksesori baru dan slot kelima untuk barang yang dibawa di samping pet._

### Baru

- Punggung: Jubah Malam Berbintang, Jubah Batik Parang, Jas Hujan Bertudung, Jubah Kerah Tinggi, Selendang Penari, Sayap Merpati, Sayap Capung, Bakul Gendong, dan Tempurung Kura-kura. _(pemain)_
- Kepala: Udeng, Topi Penyihir, Bando Bunga Matahari, Helm Proyek, Topi Ember, Mahkota Daun, dan Topi Wisuda. Wajah & leher: Topeng Kayu, Kacamata Hati, Monokel Emas, Masker Batik, Kalung Kerang, Medali Juara, dan Syal Rajut Belang. _(pemain)_
- Warna baru dari aksesori lama: Jubah Pahlawan Biru, Hijau, dan Hitam; Sayap Kupu Merah Muda; Kupluk Biru; Baret Hitam; Syal Motif Hijau; dan Caping Merah Bata. _(pemain)_
- Slot baru "Dibawa": pet bisa membawa Balon (merah, kuning, biru), Lampion, atau Kincir Kertas di samping, bersamaan dengan aksesori kepala, wajah, leher, dan punggung. Atur di Lemari › Aksesori. Di mini-game, aksesori punggung dan yang dibawa tetap disembunyikan supaya tidak menghalangi. _(pemain)_

### Perubahan

- Kebanyakan dijual di Butik Benang (25–110 koin); Jubah Malam Berbintang, Jubah Kerah Tinggi, Sayap Merpati, Sayap Capung, Topi Penyihir, dan Monokel Emas di Toko Mutiara (3–8 Mutiara). _(pemain)_
- Lawan "Tempe" di Lomba Karung berganti nama jadi "Lupis". _(pemain)_
- Teknis: paket konten 10 (36 item), WEAR_SLOTS di @kb/shared (head, face, neck, back, hand) dipakai server, admin, dan Lemari; pilihan slot "Dibawa" di admin Item & harga. Uji baru: wear.test.ts.

Commit: [`d1c7930`](https://github.com/envfri/kampung-baru/commit/d1c7930)

## 0.26.2 · 2026-11-12 · Saran nama pet baru

### Perubahan

- Saran nama saat membuat pet tidak lagi memuat "Tempe"; diganti "Klepon". _(pemain)_

Commit: [`1797346`](https://github.com/envfri/kampung-baru/commit/1797346)

## 0.26.1 · 2026-11-12 · Daftar teman rapi di HP & pet berjalan halus

### Perubahan

- Uji e2e alun-alun menunggu syarat 1 menit sebelum melapor, supaya tidak gagal di mesin yang cepat.

### Perbaikan

- Daftar teman di HP tidak lagi berantakan saat ada teman di Alun-alun: nama terbaca utuh, tombol pindah ke baris bawah, dan "Susul ke Alun-alun" jadi tombol lebar tersendiri. _(pemain)_
- Pet tidak lagi seperti berpindah tempat tiba-tiba di komputer/HP yang memakai setelan "kurangi animasi": pet tetap berjalan halus di rumah, alun-alun, dan peta kampung (hanya goyangan langkah yang dimatikan). _(pemain)_
- Pet pemain lain yang berpindah jauh di alun-alun atau rumah teman sekarang berjalan menyusuri jalan, bukan langsung muncul di tempat baru. _(pemain)_

Commit: [`5b5b0b9`](https://github.com/envfri/kampung-baru/commit/5b5b0b9)

## 0.26.0 · 2026-11-12 · Panel admin baru: filter, modal konfirmasi, progres, dan tampilan HP

### Baru

- Semua tabel admin punya kotak cari, filter dropdown (pilihan yang aktif tampil sebagai chip yang bisa dihapus satu per satu), urutkan per kolom, jumlah baris per halaman, kolom yang bisa disembunyikan/diurutkan ulang (diingat per admin), dan ekspor CSV. Filter tersimpan di tautan, jadi bisa dibagikan ke admin lain.
- Menu samping baru: ikon, angka laporan & pembayaran yang perlu dicek, grup bisa dilipat, dan Ctrl K untuk mencari halaman atau pemain. Bar progres tipis saat memuat, notifikasi bertumpuk dengan tombol aksi, kerangka saat memuat, dan tampilan kosong yang jelas.
- Pemain: kartu ringkasan yang bisa diklik jadi filter, filter status/aktif/login/level/tanggal daftar/pembayaran, detail bertab (Ringkasan, Dompet, Tas, Pembayaran, Moderasi) dengan bar level, kebutuhan pet, dan jatah harian. Baru: bisukan obrolan dari admin, kirim notifikasi ke banyak pemain (admin), dan beri hadiah massal (owner saja).
- Dasbor: pilihan rentang (hari ini sampai 90 hari), tren dibanding kemarin, grafik dengan angka per hari saat kursor diarahkan, daftar "Perlu perhatian" (laporan, pembayaran macet, email gagal, event berjalan), paling dimainkan hari ini, dan status server. Diperbarui sendiri tiap 60 detik.
- Pembayaran: ringkasan hari ini, filter status/waktu/paket/mode, hitung mundur QR untuk yang menunggu, alur Dibuat → Dibayar → Mutiara terkirim di detail. Moderasi dipecah jadi tab Laporan / Obrolan alun-alun / Obrolan di rumah / Kata terlarang dengan aksi cepat dan tandai selesai massal. Log audit: filter admin, jenis aksi, waktu, dan detail Sebelum → Sesudah.
- Ekonomi & fitur: cari pengaturan, saringan "hanya yang beda dari bawaan", tombol kembalikan per nilai, bagian bisa dilipat, bar simpan yang muncul saat ada perubahan, dan modal Tinjau perubahan sebelum menyimpan.

### Perubahan

- Aksi berbahaya memakai modal konfirmasi. Blokir pemain, hapus data, ubah saldo besar (lebih dari 1.000 koin atau 100 Mutiara), menyalakan mode perawatan (ketik PERAWATAN), tarik Mutiara demo, dan cut-off peluncuran harus diketik dulu. Menutup form dengan perubahan belum disimpan juga ditanya dulu.
- Halaman lain ikut dirapikan: Item (filter set premium, aktif/nonaktif massal dengan Urungkan), Event (status & progres waktu), Aktivitas, Tugas, Peta & toko, Paket, Pengumuman, Media (unggah banyak + seret, filter), Broadcast (pratinjau layar kunci, ketik KIRIM untuk semua pemain), Email, WhatsApp (daftar nomor tersambung), Pusat notifikasi, Admin, Akun saya (indikator kekuatan password), Situs & SEO, Peluncuran (daftar langkah), Integrasi, dan Versi. Di HP tabel tampil sebagai kartu dan filter terbuka dari bawah.
- Teknis: endpoint daftar admin baru dengan filter, urut, total, dan ekspor CSV (routes/admin-extra.ts); /api/admin/dashboard, /api/admin/badges, mute, bulk-notify, bulk-gift (owner), dan reports/handle massal. Aktif/nonaktif item massal (admin-content.ts), daftar nomor WhatsApp (admin-comms.ts). Log audit pengaturan menyimpan perubahan Sebelum → Sesudah. Uji baru: admin-panel.test.ts, admin-content.test.ts, dan npm run test:e2e:admin.

### Perbaikan

- Menyimpan item premium dari admin tidak lagi menghapus kaitan set-nya, jadi efek suasana set di rumah pemain tetap jalan.

Commit: [`d0d23d2`](https://github.com/envfri/kampung-baru/commit/d0d23d2)

## 0.25.1 · 2026-11-12 · Halaman masuk admin lebih bersih

### Keamanan

- Halaman masuk panel admin tidak lagi menampilkan petunjuk tentang file konfigurasi server (.env, ADMIN_EMAIL, ADMIN_PASSWORD). Halaman ini terbuka untuk umum, jadi info teknis server tidak perlu terlihat.

Commit: [`53cf001`](https://github.com/envfri/kampung-baru/commit/53cf001)

## 0.25.0 · 2026-11-12 · Main bareng: Congklak, Ular Tangga Kampung, Balap Karung Live + set premium

_Tiga permainan baru untuk dimainkan bareng teman, lima set hiasan premium, dan pohon alun-alun yang tidak lagi menutupi pet._

### Baru

- Congklak (2 pemain) di rumah: Main bareng › Congklak. Tiap lubang berisi 7 biji. Biji terakhir jatuh di lumbungmu = jalan lagi, di lubang berisi = ambil dan bagi lagi, di lubang kosongmu = tembak biji lawan di seberangnya. Giliran 15 detik. _(pemain)_
- Ular Tangga Kampung (2–4 pemain) di rumah atau di tikar Ular Tangga di alun-alun: naik tangga bambu, turun lewat ular sawah, kotak Warung maju 2, kotak Becek diam sekali. Giliran 10 detik. _(pemain)_
- Balap Karung Live (2–5 pemain) di garis start alun-alun: semua lomba bersamaan dan saling melihat posisi masing-masing. Kontrolnya sama dengan Lomba Karung (KIRI/KANAN bergantian), memakai energi & jatah Lomba Karung, hadiahnya lebih besar. _(pemain)_
- Saat ada yang mengajak main, yang lain di tempat itu mendapat kartu ajakan (Nanti / Ikut main). Permainan mulai otomatis saat kursi penuh atau hitung mundur habis, dan pengajak bisa menekan Mulai sekarang. Yang tidak ikut bisa menonton. _(pemain)_
- Lima set hiasan premium di Toko Mutiara (tab Set): Taman Malam, Keraton, Kafe Kopi Kampung, Pantai, dan Kamar Bintang. Ada perabot, dinding, dan lantai baru, sebagian bergerak (kolam koi, lampu berkelip, uap kopi, ikan berenang). _(pemain)_
- Beli satu set sekaligus lebih hemat 20%, dihitung dari item yang belum kamu punya. Pasang minimal 3 item dari set yang sama di satu ruangan untuk memunculkan suasana khususnya (mis. bintang berkelip di Kamar Bintang). _(pemain)_

### Perubahan

- Pohon di alun-alun dan halaman lebih kecil. Daun pohon jadi tembus pandang saat ada pet di belakangnya, jadi pet tidak lagi tertutup. _(pemain)_
- Hadiah: Congklak & Ular Tangga memakai jatah dan hadiah Main bareng (Congklak menang 25 / kalah 10 / seri 15 koin; Ular Tangga 25/15/10/5 menurut peringkat). Balap Karung Live = hadiah Lomba Karung + 5 koin per peringkat. Semua mengikuti pengali event. _(pemain)_
- Teknis: sesi permainan di memori server (routes/bareng.ts, aturan di shared/bareng.ts) dengan giliran otomatis saat waktu habis dan pemain hilang 15 detik dianggap keluar; data permainan ikut sinkron rumah/alun-alun. Paket konten 9 (30 item premium, 12 aktivitas), POST /api/shop/bundle, pengaturan premium (bundleDiscount, bonusMin). Uji server bareng.test.ts dan npm run test:e2e:bareng.

Commit: [`467f77e`](https://github.com/envfri/kampung-baru/commit/467f77e)

## 0.24.0 · 2026-11-11 · Kartu profil & ajakan berteman

### Baru

- Ketuk pet atau label nama orang lain di Alun-alun, rumah teman, atau rumahmu untuk membuka kartu profilnya: nama pet, pemilik, level, dan tempat. Dari kartu ini kamu bisa Ajak berteman, Kirim hati, atau langsung Kunjungi rumahnya kalau sudah berteman. _(pemain)_
- Ajakan berteman harus diterima dulu: yang diajak melihat kartu ajakan (Terima / Tolak), ajakannya juga tersimpan di menu Teman › Ajakan berteman selama 14 hari. Kalau dua orang saling mengajak, langsung berteman. Berteman lewat kode teman tetap langsung. _(pemain)_

### Perubahan

- "Terima ajakan berteman dari orang yang ditemui" bawaannya mati. Saat pertama masuk Alun-alun kamu ditanya sekali "Mau punya teman baru?"; bisa diubah kapan saja di Pengaturan › Privasi. _(pemain)_
- Tombol Orang di alun-alun & rumah teman serta daftar Tamu di rumahmu diganti kartu profil. Laporkan, Blokir, dan Antar pulang ada di bagian bawah kartu. Mengetuk pet orang lain tidak lagi langsung mengirim hati: pakai tombol Kirim hati. _(pemain)_
- Migrasi 022 (users.friend_requests bawaan false untuk semua pemain, users.friend_prompt_at); /api/friends/relations memberi status closed; label nama bisa difokus keyboard sebagai pengganti daftar. Tes server & e2e alun-alun/kunjungan diperbarui.

### Keamanan

- Ajakan hanya untuk orang yang benar-benar sedang/baru saja (10 menit) berada di tempat yang sama, maksimal 30 per hari. Penolakan tidak diberitahukan dan yang menolak tidak diganggu lagi selama 7 hari. Blokir membatalkan ajakan. _(pemain)_

Commit: [`1524edb`](https://github.com/envfri/kampung-baru/commit/1524edb)

## 0.23.0 · 2026-11-11 · Ajak berteman (dasar server)

### Baru

- Dasar ajakan berteman untuk pemain yang bertemu di alun-alun / rumah teman: tabel friend_requests (migrasi 021), API ajakan, kabar live lewat sinkron, notifikasi Ajakan berteman & Ajakan berteman diterima, pengaturan privasi. Tampilannya diganti kartu profil di 0.24.0.

Commit: [`d7d1ff9`](https://github.com/envfri/kampung-baru/commit/d7d1ff9)

## 0.22.1 · 2026-11-11 · Akun Instagram yang benar: @playbupi

### Perbaikan

- Akun Instagram BUPI yang benar adalah @playbupi (sebelumnya tertulis @playbudi) di halaman perawatan, layar depan, Pengaturan › Tentang, dan data untuk Google. _(pemain)_
- Server yang sudah menyimpan Situs & SEO dengan akun lama otomatis diperbaiki saat versi ini berjalan; akun lain yang diisi admin tidak diubah. Halaman perawatan statis (Caddy) dan aset Instagram (marketing/instagram, npm run instagram) dibuat ulang.

Commit: [`4221284`](https://github.com/envfri/kampung-baru/commit/4221284)

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

