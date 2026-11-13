// Changelog & versi. Satu-satunya sumber: CHANGELOG.md di root dibuat dari sini (npm run changelog),
// halaman admin "Versi & changelog" dan "Apa yang baru" di game membaca data ini.
//
// Cara menambah versi:
//   1. Tambahkan entri baru PALING ATAS di CHANGELOG (versi semver: fitur baru → naikkan MINOR, perbaikan → PATCH).
//   2. Samakan "version" di package.json root.
//   3. npm run changelog   (menulis ulang CHANGELOG.md)
//   4. Commit. Uji server gagal bila versi/CHANGELOG.md tidak sinkron.
// Item dengan `player: true` tampil di "Apa yang baru" di game: tulis dengan bahasa pemain, tanpa istilah teknis.

export type ChangeKind = 'baru' | 'ubah' | 'perbaikan' | 'keamanan';

export const CHANGE_KIND_LABEL: Record<ChangeKind, string> = {
  baru: 'Baru',
  ubah: 'Perubahan',
  perbaikan: 'Perbaikan',
  keamanan: 'Keamanan',
};

export interface ChangeItem {
  kind: ChangeKind;
  text: string;
  /** tampil di "Apa yang baru" untuk pemain */
  player?: boolean;
}

export interface Release {
  version: string;
  /** YYYY-MM-DD */
  date: string;
  title: string;
  /** ringkasan satu kalimat untuk pemain (opsional) */
  summary?: string;
  commits?: string[];
  items: ChangeItem[];
}

export const REPO_URL = 'https://github.com/envfri/kampung-baru';

export const CHANGELOG: Release[] = [
  {
    version: '0.31.3',
    date: '2026-11-13',
    title: 'Bagian atas layar HP lebih rapi',
    items: [
      { kind: 'perbaikan', text: 'Di HP, tombol lonceng, kabar, kalender & pengaturan tidak lagi menutupi lingkaran Kenyang/Bersih/Ceria/Energi. Koin & Mutiara diusahakan tetap sebaris; kalau tetap turun dua baris (koin sangat banyak atau huruf HP diperbesar), kebutuhan, pilihan ruangan & tombol acara ikut turun.', player: true },
      { kind: 'perbaikan', text: 'Nama acara di tombol acara tidak lagi terpotong ("Pekan Ceria Kampun…"); sekarang boleh dua baris.', player: true },
      { kind: 'perbaikan', text: 'Petunjuk di peta Kampung tidak lagi terpotong di HP; teks turun ke baris kedua.', player: true },
      { kind: 'ubah', text: 'HP sempit (≤380 px): level pindah ke pojok avatar dan tombol ikon sedikit lebih kecil supaya nama pet tetap terbaca. Teknis: HUD menulis kelebihan tingginya ke --hud-x; Needs, roombar, event, kartu kunjungan, toast, --prompt-top & tepi kamera rumah ikut menyesuaikan.' },
    ],
  },
  {
    version: '0.31.2',
    date: '2026-11-13',
    title: 'Alun-alun tampil utuh 20×20',
    commits: ['276a3b8'],
    items: [
      { kind: 'perbaikan', text: 'Alun-alun sekarang tergambar utuh 20×20 petak. Sebelumnya rumput & pagar terpotong di 16 petak, sehingga gerobak jajan, beberapa bangku, jalan batu, tikar Ular Tangga, garis start Balap Karung, dan pet yang berjalan ke sana tampak berada di luar lapangan.', player: true },
      { kind: 'ubah', text: 'Teknis: batas ukuran satu ruangan di houseLayout dinaikkan dari 16 ke 24 (ALUN_SIZE 20 tidak lagi terpotong); ukuran rumah pemain tetap dibatasi aturan pembelian ruangan.' },
    ],
  },
  {
    version: '0.31.1',
    date: '2026-11-13',
    title: 'Panggung alun-alun lebih rapi',
    commits: ['b195d9a'],
    items: [
      { kind: 'perbaikan', text: 'Panggung alun-alun: pengisi acara paling kiri tidak lagi tertutup tirai & lantai panggung. Ketiganya sekarang berdiri sebaris dengan jarak sama, dan payung tari, gitar, serta wayangnya terlihat semua.', player: true },
      { kind: 'ubah', text: 'Teknis: ?acara=tari|orkes|wayang|sulap untuk pratinjau tampilan panggung (hanya tampilan, tidak mengubah jadwal acara).' },
    ],
  },
  {
    version: '0.31.0',
    date: '2026-11-12',
    title: 'Halaman depan baru: rumah, pekarangan & langit',
    commits: ['46e0354'],
    items: [
      { kind: 'ubah', text: 'Halaman depan dirombak. Di desktop jadi dua kolom: judul, tombol Main sekarang / Masuk dengan email di kiri, dan adegan besar rumah dua ruangan di atas pekarangan (pohon, pagar bambu, bunga, jalan batu, lampu taman) di kanan.', player: true },
      { kind: 'ubah', text: 'Tiga pet di halaman depan diacak setiap kali dibuka (warna, telinga, motif & aksesori) dan bergerak pelan. Langit ikut jam pengunjung (pagi, siang, sore, malam berbintang dengan lampu taman menyala), lengkap dengan bukit & awan.', player: true },
      { kind: 'ubah', text: 'Kartu fitur bergambar (pet, miniatur ruangan, main bareng, gasing & layangan) dan tautan Instagram di pojok atas. Di HP adegan rumah tampil di atas, lalu judul, tombol & kartu fitur.', player: true },
      { kind: 'ubah', text: 'Teknis: lib/heroScene.ts menggambar adegan dari fungsi rumah & pekarangan yang sudah ada (tanpa unduhan gambar); ?langit= & ?pets= untuk pratinjau; layar ≥1600 px ikut membesar; diuji 7 ukuran layar tanpa geser samping & tanpa teks keluar dari latar.' },
    ],
  },
  {
    version: '0.30.0',
    date: '2026-11-12',
    title: 'Admin → Server: pemantauan CPU, memori, penyimpanan & database',
    commits: ['a1b8f5c'],
    items: [
      { kind: 'baru', text: 'Halaman Server (owner & admin): CPU, memori, penyimpanan, dan database (ukuran, koneksi, kecepatan kueri, cache), lengkap dengan grafik 1 jam. Bila server berjalan di container, yang dipakai batas container-nya. Diperbarui tiap 10 atau 30 detik.' },
      { kind: 'baru', text: 'Aplikasi & pemain: jeda event loop, permintaan per menit, waktu respons, persentase error 5xx, pemain online beserta sebarannya (rumah, berkunjung, alun-alun, peta, mini-game), sesi main bareng, dan antrean email/WhatsApp.' },
      { kind: 'baru', text: 'Riwayat CPU, memori & pemain online: 1 jam & 24 jam dari memori, 7 & 30 hari dari database (rata-rata 5 menit, disimpan 30 hari, tetap ada setelah restart).' },
      { kind: 'baru', text: 'Peringatan ke owner lewat email, WhatsApp & lonceng admin (angka merah di menu Server) dengan jeda 30 menit per jenis: CPU di atas 85% selama 5 menit, memori di atas 90%, penyimpanan di atas 85%, kueri database di atas 200 ms, error di atas 2% dalam 5 menit, dan (opsional) server menyala ulang. Ambang, saluran & penerima bisa diubah, ada tombol Kirim tes dan riwayat peringatan.' },
      { kind: 'baru', text: 'Endpoint paling lambat (p95, 1 jam), error terakhir, tabel database terbesar, info sistem, dan Unduh laporan (JSON).' },
      { kind: 'ubah', text: 'Pusat notifikasi: jenis baru "Peringatan server (ke owner)" untuk mengatur teks email/WhatsApp dan template WhatsApp Official.' },
      { kind: 'ubah', text: 'Teknis: migrasi 023_monitor (server_metrics, server_alerts), lib/monitor.ts (cgroup v1/v2, statfs, monitorEventLoopDelay, hook permintaan /api/), routes/server-monitor.ts, angka menu "server", uji server-monitor.test.ts & e2e admin.' },
    ],
  },
  {
    version: '0.29.1',
    date: '2026-11-12',
    title: 'Teks tidak lagi keluar dari tombol & kartu',
    commits: ['b2e0979', '7ec0630'],
    items: [
      { kind: 'perbaikan', text: 'Tulisan panjang di tombol sekarang turun ke baris baru dan tetap di dalam tombol, misalnya "Buka Lemari: ubah warna, telinga, motif, mata, ekor" di Tas.', player: true },
      { kind: 'perbaikan', text: 'Menu aktivitas benda (misalnya Air Mancur → Foto bareng): keterangan di kanan tidak lagi keluar dari tombol.', player: true },
      { kind: 'perbaikan', text: 'Deret kategori di Tas, Lemari & Toko tidak lagi terpotong di tepi layar HP: kategori yang tidak muat pindah ke baris kedua.', player: true },
      { kind: 'perbaikan', text: 'Panel Teman: tab yang sedang dipilih (Buku tamu, Album, Favorit) tidak lagi menyempit sampai tulisannya keluar; tab yang tidak muat pindah ke baris kedua.', player: true },
      { kind: 'ubah', text: 'Teknis: pemeriksaan otomatis teks-keluar-dari-latar di semua panel, tab, toko, mini-game, menu benda rumah & alun-alun pada lebar 320, 360, 390 & 1366 px (0 temuan); gaya titik online di panel Teman dibatasi ke <i> supaya tidak mengenai tab.' },
    ],
  },
  {
    version: '0.29.0',
    date: '2026-11-12',
    title: 'Pekarangan, langit ikut jam & kamera desktop',
    commits: ['dfd6762'],
    items: [
      { kind: 'baru', text: 'Pekarangan: rumah sekarang berdiri di pulau rumput dengan pohon, beringin yang mengintip di belakang, semak, bunga, jalan batu, lampu taman, kotak surat, dan pagar bambu. Ukurannya ikut membesar saat rumah bertambah ruangan, juga di rumah teman.', player: true },
      { kind: 'baru', text: 'Langit ikut jam: pagi, siang, sore, dan malam (bintang, bulan, lampu taman menyala), dengan awan yang bergerak pelan. Cukup gradasi warna & satu gambar kecil, tetap ringan.', player: true },
      { kind: 'baru', text: 'Desktop: panel kamera di kiri bawah. Dekat (zoom ke pet, kamera ikut saat berjalan), Ruangan, Pekarangan, plus tombol −/+. Bisa juga gulir untuk zoom, seret untuk geser, dan tombol 1/2/3, +/−, R.', player: true },
      { kind: 'baru', text: 'Desktop: Putar sudut (lihat rumah dari sisi seberang) dan Mode santai (setelah 30 detik tidak disentuh, kamera bergerak pelan di sekitar pet; berhenti begitu mouse bergerak dan paling lama 3 menit).', player: true },
      { kind: 'ubah', text: 'Tata letak dirapikan supaya menu & kartu tidak saling menutupi (diuji di 10 ukuran layar, dari HP 360 px sampai layar 2560 px): kartu main bareng kini di atas menu bawah, dan selama kartu itu tampil kartu tugas, tombol aksi & panel tamu disembunyikan dulu; di HP kartu tugas tidak lagi menimpa panel tamu; kartu ajakan berteman, ajakan notifikasi & tombol Tonton pindah ke bawah bar atas; menu aktivitas mebel tidak menutupi tombol aksi.', player: true },
      { kind: 'ubah', text: 'Teknis: houseYardSVG, houseYardBounds & skyTime di @kb/shared (pekarangan dibuat ulang hanya saat denah berubah); kamera near/yard, G.mirror & G.santai disimpan per perangkat; BG.card & --prompt-top untuk tata letak; uji yard.test.ts; e2e rumah/alun-alun/main bareng disesuaikan.' },
    ],
  },
  {
    version: '0.28.2',
    date: '2026-11-12',
    title: 'Permainan lebih besar di layar desktop',
    commits: ['973652d'],
    items: [
      { kind: 'ubah', text: 'Desktop: papan Congklak sekarang hampir dua kali lebih lebar, dengan nama, sisa waktu, dan petunjuk yang ikut membesar.', player: true },
      { kind: 'ubah', text: 'Desktop: papan Ular Tangga setinggi layar di sebelah kiri, sedangkan daftar pemain, catatan langkah, dadu, dan tombol lempar ada di panel kanan.', player: true },
      { kind: 'ubah', text: 'Desktop: kartu Ingat Jajanan lebih besar dan disusun 8 × 2 di tengah layar lebar. Tampilan di HP tidak berubah.', player: true },
    ],
  },
  {
    version: '0.28.1',
    date: '2026-11-12',
    title: 'Kartu rumah teman ikut disembunyikan saat main bareng',
    commits: ['1ed18f0'],
    items: [
      { kind: 'perbaikan', text: 'Saat main bareng di rumah teman, kartu "Rumah …" (Ambil koin, Suka, Hadiah, Pulang) ikut disembunyikan supaya tidak mengintip di belakang papan di HP. Kartunya kembali setelah permainan selesai.', player: true },
    ],
  },
  {
    version: '0.28.0',
    date: '2026-11-12',
    title: 'Main bareng langkah demi langkah & latar bermotif',
    commits: ['e0d69c6'],
    items: [
      { kind: 'ubah', text: 'Congklak: biji diambil lalu dijatuhkan satu per satu ke tiap lubang (angkanya ikut berubah), ada tangan yang membawa sisa biji, jeda saat mengambil lagi, dan efek saat menembak biji lawan.', player: true },
      { kind: 'ubah', text: 'Ular Tangga Kampung: dadu berputar dulu, lalu bidak melompat kotak demi kotak, memanjat tangga bambu, meluncur mengikuti lengkung ular, maju dua langkah di Warung, dan bergoyang di Becek.', player: true },
      { kind: 'ubah', text: 'Waktu giliran berikutnya ditambah selama langkah sebelumnya dimainkan, dan kartu hasil baru muncul setelah langkah terakhir selesai.', player: true },
      { kind: 'ubah', text: 'Selama main bareng, kartu Sapa/Ngobrol di rumah dan bar Alun-alun disembunyikan supaya papan lebih lega; muncul lagi setelah permainan selesai. Papan Ular Tangga dan Congklak sekarang di tengah layar.', player: true },
      { kind: 'ubah', text: 'Latar di rumah dan alun-alun tidak lagi polos: motif kawung, daun, dan bunga melati yang tipis (satu gambar kecil, tetap ringan).', player: true },
      { kind: 'ubah', text: 'Teknis: congklakFrames, ularFrames, dan framesMs di @kb/shared dipakai server (tambahan waktu giliran) dan game (animasi); langkah terakhir membawa at & anim. Uji bareng & e2e disesuaikan.' },
    ],
  },
  {
    version: '0.27.0',
    date: '2026-11-12',
    title: 'Aksesori baru: jubah, sayap, topi, topeng & slot Dibawa',
    commits: ['d1c7930'],
    summary: '36 aksesori baru dan slot kelima untuk barang yang dibawa di samping pet.',
    items: [
      { kind: 'baru', text: 'Punggung: Jubah Malam Berbintang, Jubah Batik Parang, Jas Hujan Bertudung, Jubah Kerah Tinggi, Selendang Penari, Sayap Merpati, Sayap Capung, Bakul Gendong, dan Tempurung Kura-kura.', player: true },
      { kind: 'baru', text: 'Kepala: Udeng, Topi Penyihir, Bando Bunga Matahari, Helm Proyek, Topi Ember, Mahkota Daun, dan Topi Wisuda. Wajah & leher: Topeng Kayu, Kacamata Hati, Monokel Emas, Masker Batik, Kalung Kerang, Medali Juara, dan Syal Rajut Belang.', player: true },
      { kind: 'baru', text: 'Warna baru dari aksesori lama: Jubah Pahlawan Biru, Hijau, dan Hitam; Sayap Kupu Merah Muda; Kupluk Biru; Baret Hitam; Syal Motif Hijau; dan Caping Merah Bata.', player: true },
      { kind: 'baru', text: 'Slot baru "Dibawa": pet bisa membawa Balon (merah, kuning, biru), Lampion, atau Kincir Kertas di samping, bersamaan dengan aksesori kepala, wajah, leher, dan punggung. Atur di Lemari › Aksesori. Di mini-game, aksesori punggung dan yang dibawa tetap disembunyikan supaya tidak menghalangi.', player: true },
      { kind: 'ubah', text: 'Kebanyakan dijual di Butik Benang (25–110 koin); Jubah Malam Berbintang, Jubah Kerah Tinggi, Sayap Merpati, Sayap Capung, Topi Penyihir, dan Monokel Emas di Toko Mutiara (3–8 Mutiara).', player: true },
      { kind: 'ubah', text: 'Lawan "Tempe" di Lomba Karung berganti nama jadi "Lupis".', player: true },
      { kind: 'ubah', text: 'Teknis: paket konten 10 (36 item), WEAR_SLOTS di @kb/shared (head, face, neck, back, hand) dipakai server, admin, dan Lemari; pilihan slot "Dibawa" di admin Item & harga. Uji baru: wear.test.ts.' },
    ],
  },
  {
    version: '0.26.2',
    date: '2026-11-12',
    title: 'Saran nama pet baru',
    commits: ['1797346'],
    items: [
      { kind: 'ubah', text: 'Saran nama saat membuat pet tidak lagi memuat "Tempe"; diganti "Klepon".', player: true },
    ],
  },
  {
    version: '0.26.1',
    date: '2026-11-12',
    title: 'Daftar teman rapi di HP & pet berjalan halus',
    commits: ['5b5b0b9'],
    items: [
      { kind: 'perbaikan', text: 'Daftar teman di HP tidak lagi berantakan saat ada teman di Alun-alun: nama terbaca utuh, tombol pindah ke baris bawah, dan "Susul ke Alun-alun" jadi tombol lebar tersendiri.', player: true },
      { kind: 'perbaikan', text: 'Pet tidak lagi seperti berpindah tempat tiba-tiba di komputer/HP yang memakai setelan "kurangi animasi": pet tetap berjalan halus di rumah, alun-alun, dan peta kampung (hanya goyangan langkah yang dimatikan).', player: true },
      { kind: 'perbaikan', text: 'Pet pemain lain yang berpindah jauh di alun-alun atau rumah teman sekarang berjalan menyusuri jalan, bukan langsung muncul di tempat baru.', player: true },
      { kind: 'ubah', text: 'Uji e2e alun-alun menunggu syarat 1 menit sebelum melapor, supaya tidak gagal di mesin yang cepat.' },
    ],
  },
  {
    version: '0.26.0',
    date: '2026-11-12',
    title: 'Panel admin baru: filter, modal konfirmasi, progres, dan tampilan HP',
    commits: ['d0d23d2'],
    items: [
      { kind: 'baru', text: 'Semua tabel admin punya kotak cari, filter dropdown (pilihan yang aktif tampil sebagai chip yang bisa dihapus satu per satu), urutkan per kolom, jumlah baris per halaman, kolom yang bisa disembunyikan/diurutkan ulang (diingat per admin), dan ekspor CSV. Filter tersimpan di tautan, jadi bisa dibagikan ke admin lain.' },
      { kind: 'baru', text: 'Menu samping baru: ikon, angka laporan & pembayaran yang perlu dicek, grup bisa dilipat, dan Ctrl K untuk mencari halaman atau pemain. Bar progres tipis saat memuat, notifikasi bertumpuk dengan tombol aksi, kerangka saat memuat, dan tampilan kosong yang jelas.' },
      { kind: 'baru', text: 'Pemain: kartu ringkasan yang bisa diklik jadi filter, filter status/aktif/login/level/tanggal daftar/pembayaran, detail bertab (Ringkasan, Dompet, Tas, Pembayaran, Moderasi) dengan bar level, kebutuhan pet, dan jatah harian. Baru: bisukan obrolan dari admin, kirim notifikasi ke banyak pemain (admin), dan beri hadiah massal (owner saja).' },
      { kind: 'baru', text: 'Dasbor: pilihan rentang (hari ini sampai 90 hari), tren dibanding kemarin, grafik dengan angka per hari saat kursor diarahkan, daftar "Perlu perhatian" (laporan, pembayaran macet, email gagal, event berjalan), paling dimainkan hari ini, dan status server. Diperbarui sendiri tiap 60 detik.' },
      { kind: 'baru', text: 'Pembayaran: ringkasan hari ini, filter status/waktu/paket/mode, hitung mundur QR untuk yang menunggu, alur Dibuat → Dibayar → Mutiara terkirim di detail. Moderasi dipecah jadi tab Laporan / Obrolan alun-alun / Obrolan di rumah / Kata terlarang dengan aksi cepat dan tandai selesai massal. Log audit: filter admin, jenis aksi, waktu, dan detail Sebelum → Sesudah.' },
      { kind: 'baru', text: 'Ekonomi & fitur: cari pengaturan, saringan "hanya yang beda dari bawaan", tombol kembalikan per nilai, bagian bisa dilipat, bar simpan yang muncul saat ada perubahan, dan modal Tinjau perubahan sebelum menyimpan.' },
      { kind: 'ubah', text: 'Aksi berbahaya memakai modal konfirmasi. Blokir pemain, hapus data, ubah saldo besar (lebih dari 1.000 koin atau 100 Mutiara), menyalakan mode perawatan (ketik PERAWATAN), tarik Mutiara demo, dan cut-off peluncuran harus diketik dulu. Menutup form dengan perubahan belum disimpan juga ditanya dulu.' },
      { kind: 'ubah', text: 'Halaman lain ikut dirapikan: Item (filter set premium, aktif/nonaktif massal dengan Urungkan), Event (status & progres waktu), Aktivitas, Tugas, Peta & toko, Paket, Pengumuman, Media (unggah banyak + seret, filter), Broadcast (pratinjau layar kunci, ketik KIRIM untuk semua pemain), Email, WhatsApp (daftar nomor tersambung), Pusat notifikasi, Admin, Akun saya (indikator kekuatan password), Situs & SEO, Peluncuran (daftar langkah), Integrasi, dan Versi. Di HP tabel tampil sebagai kartu dan filter terbuka dari bawah.' },
      { kind: 'perbaikan', text: 'Menyimpan item premium dari admin tidak lagi menghapus kaitan set-nya, jadi efek suasana set di rumah pemain tetap jalan.' },
      { kind: 'ubah', text: 'Teknis: endpoint daftar admin baru dengan filter, urut, total, dan ekspor CSV (routes/admin-extra.ts); /api/admin/dashboard, /api/admin/badges, mute, bulk-notify, bulk-gift (owner), dan reports/handle massal. Aktif/nonaktif item massal (admin-content.ts), daftar nomor WhatsApp (admin-comms.ts). Log audit pengaturan menyimpan perubahan Sebelum → Sesudah. Uji baru: admin-panel.test.ts, admin-content.test.ts, dan npm run test:e2e:admin.' },
    ],
  },
  {
    version: '0.25.1',
    date: '2026-11-12',
    title: 'Halaman masuk admin lebih bersih',
    commits: ['53cf001'],
    items: [
      { kind: 'keamanan', text: 'Halaman masuk panel admin tidak lagi menampilkan petunjuk tentang file konfigurasi server (.env, ADMIN_EMAIL, ADMIN_PASSWORD). Halaman ini terbuka untuk umum, jadi info teknis server tidak perlu terlihat.' },
    ],
  },
  {
    version: '0.25.0',
    date: '2026-11-12',
    title: 'Main bareng: Congklak, Ular Tangga Kampung, Balap Karung Live + set premium',
    commits: ['467f77e'],
    summary: 'Tiga permainan baru untuk dimainkan bareng teman, lima set hiasan premium, dan pohon alun-alun yang tidak lagi menutupi pet.',
    items: [
      { kind: 'baru', text: 'Congklak (2 pemain) di rumah: Main bareng › Congklak. Tiap lubang berisi 7 biji. Biji terakhir jatuh di lumbungmu = jalan lagi, di lubang berisi = ambil dan bagi lagi, di lubang kosongmu = tembak biji lawan di seberangnya. Giliran 15 detik.', player: true },
      { kind: 'baru', text: 'Ular Tangga Kampung (2–4 pemain) di rumah atau di tikar Ular Tangga di alun-alun: naik tangga bambu, turun lewat ular sawah, kotak Warung maju 2, kotak Becek diam sekali. Giliran 10 detik.', player: true },
      { kind: 'baru', text: 'Balap Karung Live (2–5 pemain) di garis start alun-alun: semua lomba bersamaan dan saling melihat posisi masing-masing. Kontrolnya sama dengan Lomba Karung (KIRI/KANAN bergantian), memakai energi & jatah Lomba Karung, hadiahnya lebih besar.', player: true },
      { kind: 'baru', text: 'Saat ada yang mengajak main, yang lain di tempat itu mendapat kartu ajakan (Nanti / Ikut main). Permainan mulai otomatis saat kursi penuh atau hitung mundur habis, dan pengajak bisa menekan Mulai sekarang. Yang tidak ikut bisa menonton.', player: true },
      { kind: 'baru', text: 'Lima set hiasan premium di Toko Mutiara (tab Set): Taman Malam, Keraton, Kafe Kopi Kampung, Pantai, dan Kamar Bintang. Ada perabot, dinding, dan lantai baru, sebagian bergerak (kolam koi, lampu berkelip, uap kopi, ikan berenang).', player: true },
      { kind: 'baru', text: 'Beli satu set sekaligus lebih hemat 20%, dihitung dari item yang belum kamu punya. Pasang minimal 3 item dari set yang sama di satu ruangan untuk memunculkan suasana khususnya (mis. bintang berkelip di Kamar Bintang).', player: true },
      { kind: 'ubah', text: 'Pohon di alun-alun dan halaman lebih kecil. Daun pohon jadi tembus pandang saat ada pet di belakangnya, jadi pet tidak lagi tertutup.', player: true },
      { kind: 'ubah', text: 'Hadiah: Congklak & Ular Tangga memakai jatah dan hadiah Main bareng (Congklak menang 25 / kalah 10 / seri 15 koin; Ular Tangga 25/15/10/5 menurut peringkat). Balap Karung Live = hadiah Lomba Karung + 5 koin per peringkat. Semua mengikuti pengali event.', player: true },
      { kind: 'ubah', text: 'Teknis: sesi permainan di memori server (routes/bareng.ts, aturan di shared/bareng.ts) dengan giliran otomatis saat waktu habis dan pemain hilang 15 detik dianggap keluar; data permainan ikut sinkron rumah/alun-alun. Paket konten 9 (30 item premium, 12 aktivitas), POST /api/shop/bundle, pengaturan premium (bundleDiscount, bonusMin). Uji server bareng.test.ts dan npm run test:e2e:bareng.' },
    ],
  },
  {
    version: '0.24.0',
    date: '2026-11-11',
    title: 'Kartu profil & ajakan berteman',
    commits: ['1524edb'],
    items: [
      { kind: 'baru', text: 'Ketuk pet atau label nama orang lain di Alun-alun, rumah teman, atau rumahmu untuk membuka kartu profilnya: nama pet, pemilik, level, dan tempat. Dari kartu ini kamu bisa Ajak berteman, Kirim hati, atau langsung Kunjungi rumahnya kalau sudah berteman.', player: true },
      { kind: 'baru', text: 'Ajakan berteman harus diterima dulu: yang diajak melihat kartu ajakan (Terima / Tolak), ajakannya juga tersimpan di menu Teman › Ajakan berteman selama 14 hari. Kalau dua orang saling mengajak, langsung berteman. Berteman lewat kode teman tetap langsung.', player: true },
      { kind: 'ubah', text: '"Terima ajakan berteman dari orang yang ditemui" bawaannya mati. Saat pertama masuk Alun-alun kamu ditanya sekali "Mau punya teman baru?"; bisa diubah kapan saja di Pengaturan › Privasi.', player: true },
      { kind: 'ubah', text: 'Tombol Orang di alun-alun & rumah teman serta daftar Tamu di rumahmu diganti kartu profil. Laporkan, Blokir, dan Antar pulang ada di bagian bawah kartu. Mengetuk pet orang lain tidak lagi langsung mengirim hati: pakai tombol Kirim hati.', player: true },
      { kind: 'keamanan', text: 'Ajakan hanya untuk orang yang benar-benar sedang/baru saja (10 menit) berada di tempat yang sama, maksimal 30 per hari. Penolakan tidak diberitahukan dan yang menolak tidak diganggu lagi selama 7 hari. Blokir membatalkan ajakan.', player: true },
      { kind: 'ubah', text: 'Migrasi 022 (users.friend_requests bawaan false untuk semua pemain, users.friend_prompt_at); /api/friends/relations memberi status closed; label nama bisa difokus keyboard sebagai pengganti daftar. Tes server & e2e alun-alun/kunjungan diperbarui.' },
    ],
  },
  {
    version: '0.23.0',
    date: '2026-11-11',
    title: 'Ajak berteman (dasar server)',
    commits: ['d7d1ff9'],
    items: [
      { kind: 'baru', text: 'Dasar ajakan berteman untuk pemain yang bertemu di alun-alun / rumah teman: tabel friend_requests (migrasi 021), API ajakan, kabar live lewat sinkron, notifikasi Ajakan berteman & Ajakan berteman diterima, pengaturan privasi. Tampilannya diganti kartu profil di 0.24.0.' },
    ],
  },
  {
    version: '0.22.1',
    date: '2026-11-11',
    title: 'Akun Instagram yang benar: @playbupi',
    commits: ['4221284'],
    items: [
      { kind: 'perbaikan', text: 'Akun Instagram BUPI yang benar adalah @playbupi (sebelumnya tertulis @playbudi) di halaman perawatan, layar depan, Pengaturan › Tentang, dan data untuk Google.', player: true },
      { kind: 'perbaikan', text: 'Server yang sudah menyimpan Situs & SEO dengan akun lama otomatis diperbaiki saat versi ini berjalan; akun lain yang diisi admin tidak diubah. Halaman perawatan statis (Caddy) dan aset Instagram (marketing/instagram, npm run instagram) dibuat ulang.' },
    ],
  },
  {
    version: '0.22.0',
    date: '2026-11-11',
    title: 'SEO, pratinjau tautan & mode perawatan',
    commits: ['8d45259'],
    items: [
      { kind: 'baru', text: 'Mode perawatan: halaman beranimasi (pet berhelm proyek memalu papan "DIRAPIKAN", temannya menyunggi batu bata) dengan perkiraan selesai & hitung mundur, tautan Instagram @playbupi, dan cek otomatis. Pemain yang sedang main langsung dialihkan lalu kembali ke game sendiri begitu perawatan selesai. Progres tetap aman.', player: true },
      { kind: 'baru', text: 'Tautan BUPI yang dibagikan ke WhatsApp, Facebook, X, atau Telegram kini tampil dengan gambar & judul. Tautan undangan teman tampil sebagai "Nama ngajak kamu main BUPI!".', player: true },
      { kind: 'baru', text: 'Layar depan berisi hal-hal yang bisa dilakukan di BUPI dan tautan media sosial. Ikuti kabar terbaru di Instagram @playbupi (juga di Pengaturan › Tentang).', player: true },
      { kind: 'baru', text: 'Admin › Situs & SEO: judul, deskripsi, kata kunci, gambar pratinjau (bawaan atau dari Media), izin mesin pencari, verifikasi Google Search Console/Bing, akun media sosial (Instagram, TikTok, YouTube, Facebook, X), dengan pratinjau hasil Google & kartu tautan. Mode perawatan dinyalakan/dimatikan dari sini (dengan perkiraan selesai, teks, dan izin admin tetap main), tercatat di Log audit, dan ditandai merah di semua halaman admin.' },
      { kind: 'baru', text: 'SEO: tag title/description/canonical/robots, Open Graph & kartu X lengkap (gambar 1200×630), data terstruktur JSON-LD (WebSite, Organization + akun sosial, VideoGame gratis), robots.txt, sitemap.xml, favicon.ico, konten noscript, dan X-Robots-Tag noindex untuk API/admin/bayar. Server uji otomatis tidak diindeks; indeks hanya di produksi ber-HTTPS.' },
      { kind: 'ubah', text: 'Mode perawatan membalas HTTP 503 + Retry-After (aman untuk peringkat Google). Panel admin, webhook ZePay/Mailketing/Klik Flow, file statis, dan /healthz tetap jalan. Halaman perawatan statis opsional untuk Caddy saat server dimulai ulang (lihat DEPLOY.md). Aset dibuat dengan npm run site-assets; uji baru: tes server Situs & SEO dan npm run test:e2e:situs.' },
    ],
  },
  {
    version: '0.21.1',
    date: '2026-11-11',
    title: 'Audit alun-alun',
    commits: ['2738769'],
    items: [
      { kind: 'keamanan', text: 'Laporan hanya sah dari pemain yang sedang bertemu dengan yang dilaporkan di alun-alun yang sama (dan sudah 1 menit di sana). Akun sekali pakai tidak bisa lagi membisukan orang lain. Bisu 30 menit hanya sekali per gelombang laporan (tidak diperpanjang terus), tersimpan di server, berlaku di alun-alun & rumah, dan bisa dibuka moderator.' },
      { kind: 'keamanan', text: 'Filter obrolan diperketat: yang disimpan & disiarkan adalah teks yang sudah dibersihkan; karakter pembalik arah, huruf mirip dari aksara lain, tanda gabung & angka aksara lain ditolak; kode akun / kode pindah perangkat dan nomor yang dicicil beberapa pesan ditolak; kata terlarang yang dieja per huruf tertangkap. Nama yang menyamar jadi tim BUPI (Admin, Moderator, Tim BUPI, ...) tidak bisa dipakai.', player: true },
      { kind: 'baru', text: 'Pengingat di obrolan alun-alun: jangan bagikan kode akun, kode pindah perangkat, nomor, atau alamat. Tim BUPI tidak pernah memintanya.', player: true },
      { kind: 'baru', text: 'Tombol Main di bar alun-alun: pilih nonton, komidi putar, ayunan, berteduh, duduk, atau jajan tanpa harus mengetuk bendanya.', player: true },
      { kind: 'perbaikan', text: 'Mandi atau nampan makan yang belum selesai di rumah tidak lagi membuat alun-alun macet. Ketuk jalan batu kini membuat pet berjalan ke sana, ketukan lantai tidak mengganggu aktivitas yang sedang berjalan, menu aktivitas tidak tertutup bar, dan label nama tidak lagi menumpuk jadi kolom panjang saat ramai (ada label "(kamu)" untuk pet sendiri).', player: true },
      { kind: 'perbaikan', text: 'Obrolan & ekspresi lama tidak diputar ulang saat baru masuk, tidak ada pemberitahuan setiap orang asing datang/pergi, pemberitahuan foto hanya bila kamu ikut difoto, foto alun-alun bergaya luar ruang, dan menyusul teman ke alun-alun yang sudah penuh diberi tahu.', player: true },
      { kind: 'ubah', text: 'Main di alun-alun diberi jeda 3 detik; setelah jatah harian habis tetap boleh main tanpa koin, XP, ceria, atau kemajuan tugas. Joget bareng dihitung dari joget sungguhan saat musik. Foto alun-alun masuk album yang memotret & temannya saja, dan tidak dihitung untuk lencana foto di rumah teman.', player: true },
      { kind: 'perbaikan', text: 'Server: nomor urut kejadian bersama (obrolan tidak hilang saat alun-alun kosong dibuat ulang), pengaturan bernilai 0 dihormati, alun-alun yang ditutup juga menolak obrolan/aksi/foto/laporan, laporan dengan ID salah tidak lagi error 500, kabar masuk tidak membanjiri saat keluar-masuk cepat, log obrolan alun-alun dibersihkan setelah 60 hari. Game: penanganan galat jaringan, posisi terbaru dikirim saat masuk & berfoto, polling lebih jarang saat sendirian, dan gambar pet lain disimpan per pet.' },
      { kind: 'baru', text: 'Migrasi 020 (users.chat_muted_until). Admin: Buka bisu di Moderasi & detail pemain, jumlah pelapor berbeda per 7 hari. Tes alun-alun diperluas (jam panggung tetap, laporan, bisu, filter, batas 0, kejadian setelah dibuat ulang, nama terlarang).' },
    ],
  },
  {
    version: '0.21.0',
    date: '2026-11-11',
    title: 'Alun-alun kampung',
    commits: ['c6b1e76'],
    summary: 'Alun-alun sudah dibuka! Jalan-jalan ke sana dari peta kampung, ketemu pemain lain, nonton panggung, naik komidi putar, jajan, dan joget bareng.',
    items: [
      { kind: 'baru', text: 'Alun-alun di peta kampung: lapangan luas tempat semua pemain berkumpul, dengan beringin kembar, air mancur, jalan batu, bangku, lampu taman, komidi putar, ayunan, dan gerobak jajanan.', player: true },
      { kind: 'baru', text: 'Panggung hiburan bergiliran: Orkes Kampung, Wayang Kardus, Tari Payung, dan Sulap Pak Badut. Semua orang menonton acara yang sama; saat musik main, tekan Joget untuk joget bareng (makin ramai makin ceria).', player: true },
      { kind: 'baru', text: 'Main di alun-alun: ketuk benda untuk nonton, naik komidi putar, main ayunan, berteduh di bawah beringin, duduk santai, atau jajan Es Dawet, Bakso, dan Arum Manis. Ada hadiah kunjungan harian dan hadiah main (dibatasi per hari).', player: true },
      { kind: 'baru', text: 'Ngobrol, ekspresi, dan foto bareng dengan pet di sekitarmu, seperti saat berkunjung ke rumah teman. Satu alun-alun maksimal 20 orang; kalau penuh otomatis dibuka Alun-alun 2. Teman yang sedang di alun-alun bisa disusul dari daftar Teman.', player: true },
      { kind: 'keamanan', text: 'Karena di alun-alun bisa bertemu orang yang bukan teman: obrolan disaring (kata terlarang, tautan & nomor ditolak) dengan frasa siap pakai, pemain bisa Laporkan atau Blokir (yang diblokir tidak saling melihat & mendengar sama sekali), tiga laporan dari pemain berbeda dalam satu jam membisukan obrolan pemain itu 30 menit, dan semua obrolan tercatat untuk moderasi.', player: true },
      { kind: 'baru', text: 'Tugas harian "Jalan-jalan ke Alun-alun" serta lencana Anak Alun-alun dan Raja Joget.', player: true },
      { kind: 'baru', text: 'Admin: Moderasi menampilkan laporan pemain (dengan obrolan terakhirnya, tandai selesai) dan obrolan alun-alun; pengaturan Ekonomi & fitur › Alun-alun (buka/tutup, kapasitas, ketik bebas atau frasa saja, hadiah). Tautan langsung #/players/<id> membuka detail pemain.' },
      { kind: 'perbaikan', text: 'Frasa siap pakai obrolan di rumah sendiri kini muncul (pengaturan kunjungan sebelumnya tidak terkirim ke game).', player: true },
      { kind: 'baru', text: 'Migrasi 019 (square_chat, reports, jenis lokasi square), paket konten v8. API: /api/square (sync, leave, say, act, photo, report), /api/admin/square-chat, /api/admin/reports. Peta kampung diperlebar ke 1260. Tes: square.test.ts & npm run test:e2e:alun.' },
    ],
  },
  {
    version: '0.20.1',
    date: '2026-11-11',
    title: 'Audit rumah tersambung & atur denah',
    commits: ['d297ac2'],
    items: [
      { kind: 'ubah', text: 'Main bareng sekarang lewat ajakan: yang memulai mengajak, teman lain memilih sendiri "Ikut main" atau "Tidak" (15 detik). Jatah main bareng harian hanya terpakai kalau kamu ikut. Kalau tidak ada yang ikut, ajakan batal sendiri.', player: true },
      { kind: 'ubah', text: 'Foto bareng berisi pet tuan rumah, yang memotret, dan pet yang sedang satu ruangan dengannya.', player: true },
      { kind: 'keamanan', text: 'Pemain yang saling memblokir tidak pernah ikut main bareng yang sama dan tidak ada di foto yang sama (foto tidak masuk album / lukisan mereka).' },
      { kind: 'perbaikan', text: 'Atur denah: kamera tidak lagi bergeser sendiri saat ruangan dipindah, ruangan lain tidak ikut bergeser saat satu ruangan dibawa ke pojok belakang, ruangan baru bisa diseret setelah dipilih (seret di tempat lain = geser layar, cubit tetap bisa), dan ada tombol nama ruangan untuk memilih tanpa mengetuk gambar.', player: true },
      { kind: 'perbaikan', text: 'Pet tidak lagi berbelok ke petak acak saat diminta pindah ruangan, tetap berjalan ke ruangan pilihan setelah selesai mandi/beraktivitas/tidur, dan tidak lagi berdiri di atas kasur setelah bangun. Tamu tetap bisa berjalan walau pet tuan rumah sedang tidur.', player: true },
      { kind: 'baru', text: 'Saat Atur mebel, ada peringatan bila sebuah ruangan jadi tidak bisa dimasuki karena jalannya tertutup mebel.', player: true },
      { kind: 'perbaikan', text: 'Rumah lebih ringan di HP: hanya ruangan yang berubah yang digambar ulang, remah di lapisan sendiri. Mebel yang menempel ke dinding pemisah tidak lagi tergambar di depan dinding. Jendela & lukisan di pratinjau admin tidak lagi mencuat melewati dinding.' },
      { kind: 'perbaikan', text: 'Atur denah otomatis dibatalkan saat pindah layar atau ganti akun; semua masalah denah (bertumpuk, terpisah, terlalu jauh) punya pesan sendiri. Tamu yang pulang langsung hilang dari rumah walau tuan rumah sendirian.' },
      { kind: 'keamanan', text: 'Sinkron rumah live: ruangan yang dikirim harus milik tuan rumah dan posisi dibatasi ukuran ruangannya (cache daftar ruangan dibersihkan saat ruangan dibeli/diperluas). Batas koordinat denah diperlebar (±1000) supaya denah yang sah tidak tertolak setelah digeser.' },
      { kind: 'ubah', text: 'API main bareng: action join / begin, fase ajak → main (event coop_join, coop_go; why sepi/batal). Tes: ajakan & blokir di main bareng, foto se-ruangan & blokir, validasi sinkron, uji "Susun otomatis" yang sungguhan.' },
    ],
  },
  {
    version: '0.20.0',
    date: '2026-11-11',
    title: 'Atur denah sendiri',
    commits: ['01eae37'],
    summary: 'Sekarang kamu bisa mengatur letak ruangan sendiri: halaman di samping, dapur di belakang, sesukamu. Pintunya muncul sendiri.',
    items: [
      { kind: 'baru', text: 'Atur denah (Rumahku › Atur denah): ketuk ruangan, lalu geser dengan jari atau tombol panah. Pintu muncul sendiri di dinding yang menempel, dinding tinggi berjendela menyesuaikan sisi belakang rumah.', player: true },
      { kind: 'baru', text: 'Ruangan tidak bisa ditumpuk. Ruangan yang belum menempel ke ruangan lain diberi garis merah dan harus ditempelkan dulu sebelum disimpan, supaya pet selalu bisa berjalan ke semua ruangan.', player: true },
      { kind: 'baru', text: 'Susun otomatis: kembalikan denah ke susunan rapi bawaan kapan saja. Ruangan yang baru dibeli langsung menempel ke denahmu.', player: true },
      { kind: 'ubah', text: 'Kalau ruangan yang diperluas jadi menabrak ruangan lain di denahmu, denah kembali tersusun otomatis (ada pemberitahuan) dan bisa diatur lagi.', player: true },
      { kind: 'ubah', text: 'Teman yang berkunjung melihat denah rumahmu persis seperti yang kamu atur.' },
      { kind: 'baru', text: 'Migrasi 018 (rooms.gx, rooms.gy). API: POST /api/room/plan { rooms: [{ id, gx, gy }] } atau { auto: true }, kode galat plan_overlap / plan_apart; /api/room/expand mengembalikan planReset. @kb/shared: houseLayout memakai letak tersimpan (yang bertumpuk/terpisah disusun ulang), opsi strict, dan planProblem untuk validasi.' },
    ],
  },
  {
    version: '0.19.0',
    date: '2026-11-11',
    title: 'Rumah tersambung',
    commits: ['f423382'],
    summary: 'Semua ruanganmu kini menyambung jadi satu rumah: kamar, ruang tamu, dapur, kamar mandi, dan halaman tampil sekaligus. Pet berjalan antarruangan lewat pintu.',
    items: [
      { kind: 'baru', text: 'Rumah tersambung: ruangan yang kamu beli tidak lagi dipilih satu per satu, tapi tampil menyambung jadi satu rumah. Ruangan dalam disusun rapat dengan dinding rendah berpintu di antaranya, dan halaman ada di depan rumah.', player: true },
      { kind: 'baru', text: 'Pet berjalan sendiri ke ruangan lain lewat pintu: ketuk lantai ruangan mana pun, atau pilih ruangan dari Rumahku. Kamera mengikuti ruangan tempat pet berada.', player: true },
      { kind: 'baru', text: 'Tombol "Seluruh rumah" untuk melihat semua ruangan sekaligus. Rumah bisa digeser dengan jari, dicubit untuk memperbesar, atau digulir dengan mouse; tombol "Ikuti pet" membawa kamera kembali.', player: true },
      { kind: 'ubah', text: 'Atur mebel per ruangan: ruangan yang sedang diatur terang, ruangan lain diredupkan. Ketuk ruangan lain untuk mengaturnya (simpan dulu perubahannya).', player: true },
      { kind: 'ubah', text: 'Kunjungan bareng satu rumah: teman yang sedang di dapur, halaman, atau ruangan lain tetap terlihat dan bisa diajak main bareng atau ikut foto bareng.', player: true },
      { kind: 'ubah', text: 'Jendela & lukisan ada di dinding belakang rumah. Remah & bulu rontok muncul di ruangan tempat pet berada. Kalau pet tidur, ia berjalan ke kasur walau kasurnya di ruangan lain.' },
      { kind: 'baru', text: 'Denah otomatis (@kb/shared houseLayout): ruangan diletakkan supaya rumah sepadat mungkin, pintu di petak kosong terdekat ke tengah sisi bersama (bergeser bila tertutup mebel), dinding tinggi hanya bila tidak menutupi ruangan lain. Tidak ada perubahan database; ruangan yang diperluas atau dibeli membuat denah menyesuaikan sendiri.' },
      { kind: 'ubah', text: 'API: /api/house/:id/sync mengembalikan semua anggota rumah beserta roomId (posisi tetap per ruangan), elsewhere selalu kosong; main bareng & foto bareng mencakup semua yang ada di rumah; posisi hingga 16 petak. Tes baru: house-plan.test.ts dan npm run test:e2e:rumah.' },
    ],
  },
  {
    version: '0.18.1',
    date: '2026-11-11',
    title: 'Audit kunjungan bareng',
    commits: ['e41aaaf'],
    items: [
      { kind: 'baru', text: 'Blokir pemain dari daftar tamu (Tamu › Blokir): langsung diantar pulang, berhenti berteman, dan tidak bisa menambahkanmu atau berkunjung lagi. Kelola di Pengaturan › Teman & tamu.', player: true },
      { kind: 'baru', text: 'Hapus foto dari albummu sendiri. Kalau kamu memilih tidak memajang foto, foto berikutnya tidak lagi otomatis dipajang di lukisan.', player: true },
      { kind: 'perbaikan', text: 'Main bareng: yang menekan Berhenti hanya keluar sendiri (permainan tetap jalan untuk yang lain), permainan yang dihentikan tanpa satu langkah pun tidak memakai jatah hadiah, dan bola pindah ke pemain lain bila pemegangnya pergi.', player: true },
      { kind: 'perbaikan', text: 'Ekspresi yang ditekan cepat tidak lagi hilang, obrolan tetap muncul setelah server diperbarui, dan dialog/kartu yang muncul tidak lagi bergeser sesaat saat dibuka.', player: true },
      { kind: 'keamanan', text: 'Tamu yang diantar pulang tidak bisa lagi beraksi, mengobrol, atau memotret di rumah itu. Berhenti berteman langsung berlaku. Foto bareng hanya bisa diambil dari dalam ruangan (tidak bisa memotret tamu lain dari jauh), dengan notifikasi maksimal sekali per jam per pemotret.' },
      { kind: 'keamanan', text: 'Aksi ke pet teman diberi jeda 4 detik dan batas harian per teman; buku tamu hanya mencatat aksi berhadiah & camilan sehingga tidak bisa dibanjiri. Filter obrolan menormalkan karakter tak terlihat & angka lebar penuh.' },
      { kind: 'perbaikan', text: 'Server: rumah kosong & catatan sementara di memori dibersihkan berkala (tidak menumpuk), pencarian pemain main bareng tidak lagi memindai semua rumah, baris pet dikunci berurutan (mencegah deadlock Postgres saat dua pemain saling berkunjung), batas jatah main bareng atomik, dan pemain yang bergabung bersamaan tidak lagi melebihi batas tamu. Klien lebih hemat: rumah yang tidak live dicek tiap 15 detik, tuan rumah tanpa tamu tiap 8 detik.' },
      { kind: 'baru', text: 'Migrasi 017 (blocks, users.photo_off). API: POST/GET /api/blocks, DELETE /api/blocks/:id, DELETE /api/photos/:id; /api/house/:id/sync mengirim boot id.' },
    ],
  },
  {
    version: '0.18.0',
    date: '2026-11-11',
    title: 'Perluas ruangan',
    commits: ['89e14c9'],
    summary: 'Ruanganmu kini bisa diperluas sampai 12×12. Mebel tetap di tempatnya, dan main bareng teman jadi lega.',
    items: [
      { kind: 'baru', text: 'Perluas ruangan: tiap ruangan bisa diperbesar bertahap (mis. 6×6 → 8×8 → 10×10 → 12×12) di Rumahku atau di Toko Bangunan. Lantai baru bertambah di sisi depan, mebel yang sudah ada tidak bergeser, dan batas jumlah barang ikut bertambah.', player: true },
      { kind: 'perbaikan', text: 'Saat banyak teman berkunjung, pet tidak lagi bertumpuk di satu tempat: tiap pet mencari tempat sendiri dengan jarak dari pet lain.', player: true },
      { kind: 'baru', text: 'Admin → Ekonomi & fitur → Rumah: maxSize (ukuran maksimal, sampai 14), expandStep (tambahan petak per perluasan), expandCoins (harga perluasan ke-1, ke-2, dst.). Migrasi 016 (rooms.size). API: POST /api/room/expand.' },
      { kind: 'keamanan', text: 'Obrolan di rumah disimpan 60 hari dan buku tamu 180 hari, lalu dihapus otomatis.' },
    ],
  },
  {
    version: '0.17.0',
    date: '2026-11-11',
    title: 'Kunjungan bareng: pet ikut main ke rumah teman',
    commits: ['d2371b4'],
    summary: 'Pet-mu kini ikut berkunjung. Main dengan pet teman, ngobrol, masak bareng, lempar bola, dan foto bareng. Kalau teman sedang online, kalian tampil bersama di rumah yang sama.',
    items: [
      { kind: 'baru', text: 'Pet-mu ikut berkunjung ke rumah teman dan berjalan-jalan di sana. Ketuk lantai untuk memindahkannya.', player: true },
      { kind: 'baru', text: 'Main dengan pet teman: Sapa, Peluk, kasih Camilan dari tasmu (Kenyang pet teman bertambah), Kejar-kejaran, dan Duduk bareng. Ada hadiah koin untuk beberapa kali main per teman per hari, dan tuan rumah melihatnya di Buku tamu.', player: true },
      { kind: 'baru', text: 'Main bareng langsung: kalau teman sedang di rumahnya atau teman lain sedang berkunjung, semua pet tampil bersama di ruangan yang sama (sampai 4 tamu sekaligus), lengkap dengan nama di bawah pet.', player: true },
      { kind: 'baru', text: 'Ngobrol pakai frasa siap pakai atau ketik sendiri (tautan, nomor, dan kata kasar otomatis ditolak), plus ekspresi: lambai, tertawa, sayang, kaget.', player: true },
      { kind: 'baru', text: 'Masak bareng: ikuti resep bergiliran, kalau berhasil semua pemain dapat koin dan makanan. Lempar bola: oper bola tepat waktu bersama-sama.', player: true },
      { kind: 'baru', text: 'Foto bareng (gaya Senyum, Lompat, atau Peluk): masuk album semua pet yang ada di foto dan bisa dipajang di lukisan dinding rumahmu.', player: true },
      { kind: 'baru', text: 'Status online di daftar Teman (di rumah / main ke rumah siapa / ramai berapa tamu), tab baru Buku tamu dan Album, serta pengaturan privasi: sembunyikan status online atau matikan main bareng langsung di rumahmu. Tuan rumah bisa mengantar tamu pulang.', player: true },
      { kind: 'baru', text: 'Admin: bagian Kunjungan bareng di Ekonomi & fitur (aktif/nonaktif, jumlah tamu live, hadiah, ketik bebas, daftar frasa, batas main bareng & foto per hari) dan daftar obrolan terbaru di Moderasi kata. Notifikasi baru: tamu main dengan pet-mu, foto bareng. Tugas harian "Main ke rumah teman" dan lencana Tetangga Akrab, Koki Kampung, Kenangan Bareng.' },
      { kind: 'baru', text: 'Migrasi 015 (visit_acts, house_chat, photos, photo_members; users.show_online, live_visits, featured_photo, guestbook_seen_at). API: /api/visit/:id/act, /api/house/:id/sync|leave|say|kick|coop|photo, /api/photos, /api/guestbook, /api/presence, /api/me/privacy. Keadaan rumah live disimpan di memori server (polling ±0,9 detik; tuan rumah tanpa tamu 5 detik).' },
    ],
  },
  {
    version: '0.16.1',
    date: '2026-11-11',
    title: 'Akhir mini-game lebih jelas',
    commits: ['0419067'],
    items: [
      { kind: 'perbaikan', text: 'Balap Bakiak: tim kini benar-benar melewati bendera finis dulu ("Finis!") sebelum hasil muncul. Gerakan tim lebih halus, pet-mu di depan, dan garis finis tidak lagi di ujung layar HP.', player: true },
      { kind: 'perbaikan', text: 'Lomba Karung: pet berhenti tepat di garis finis yang tergambar (sebelumnya berhenti sebelum garis) lalu melompatinya; lawan tetap berlomba sebentar sebelum papan hasil.', player: true },
      { kind: 'perbaikan', text: 'Semua mini-game memberi tanda akhir sebelum kartu hasil: "Waktu habis!", "Sampai puncak!" (Panjat Pinang), atau total putaran Gasing.', player: true },
      { kind: 'perbaikan', text: 'Lomba Karung punya batas waktu (semua lawan finis + 8 detik) dan Gasing melepas otomatis setelah 8 detik, supaya pemain yang berhenti tidak terjebak di layar permainan tanpa tombol keluar.', player: true },
    ],
  },
  {
    version: '0.16.0',
    date: '2026-11-11',
    title: 'Persiapan peluncuran: Mutiara uji aman & cut-off',
    commits: ['3836f4d'],
    items: [
      { kind: 'keamanan', text: 'Server produksi yang masih memakai pembayaran simulasi (PAYMENT_PROVIDER=mock): pembelian Mutiara terkunci untuk pemain (game menampilkan "Pembelian Mutiara belum dibuka"); halaman simulasi & checkout hanya bisa dipakai admin yang sedang login di browser yang sama.' },
      { kind: 'baru', text: 'Pembayaran uji (simulasi atau kunci uji ZePay) ditandai "uji" di admin › Pembayaran, dan Mutiara-nya bisa ditarik kembali dari admin › Peluncuran.' },
      { kind: 'baru', text: 'Admin › Peluncuran: cut-off supaya semua pemain mulai dari 0 saat produksi dibuka (reset progres dengan akun tetap, atau hapus semua pemain). Konten & pengaturan admin tidak tersentuh, catatan pembayaran sungguhan dilindungi, wajib ketik RESET BUPI, tercatat di log audit.' },
      { kind: 'ubah', text: 'Sebelum peluncuran resmi, menu Mutiara memberi tahu bahwa pembelian belum dibuka; Mutiara tetap bisa didapat dari hadiah harian, tugas, dan event.', player: true },
      { kind: 'baru', text: 'Migrasi 014 (payments.test, payments.revoked_at; pembayaran mock lama otomatis ditandai uji). API admin: GET /api/admin/launch, POST /api/admin/launch/revoke-demo, POST /api/admin/launch/reset.' },
    ],
  },
  {
    version: '0.15.0',
    date: '2026-11-11',
    title: 'Simpan progres & pindah perangkat',
    commits: ['869501b'],
    summary: 'Main tanpa daftar tetap aman: simpan pet-mu ke Google atau email, atau pindah ke HP lain pakai kode sekali pakai.',
    items: [
      { kind: 'baru', text: 'Simpan progres: hubungkan akun tamu ke Google atau email dari Pengaturan › Akun. Pet, rumah, dan temanmu tetap sama, dan bisa dibuka di HP atau browser lain dengan masuk memakai Google/email yang sama.', player: true },
      { kind: 'baru', text: 'Kode pindah perangkat: buat kode sekali pakai di Pengaturan › Akun, lalu ketik di HP/browser baru lewat "Punya kode pindah perangkat?". Tanpa perlu Google atau email.', player: true },
      { kind: 'baru', text: 'Pengingat Simpan progres untuk pemain tamu (setelah beberapa hari main, Lv 3, teman pertama, atau menang duel), bisa ditunda.', player: true },
      { kind: 'baru', text: 'Kalau perangkat ini sedang memakai akun lain, game bertanya dulu sebelum pindah akun supaya progres tidak hilang tanpa sengaja.', player: true },
      { kind: 'ubah', text: 'Sesi masuk diperpanjang otomatis selama dipakai: pemain aktif (termasuk tamu) tidak lagi terlempar keluar setelah 180 hari.', player: true },
      { kind: 'baru', text: 'Admin → Ekonomi & fitur: bagian Akun (kode pindah aktif/nonaktif, masa berlaku kode, kapan pengingat Simpan progres muncul & lama tunda).' },
      { kind: 'baru', text: 'Migrasi 013 (transfer_codes). API: POST /api/auth/transfer, POST /api/auth/transfer/redeem; login Google/email/Facebook dan tebus kode menolak pindah akun tanpa { switch: true } (kode identity_in_use / transfer_confirm berisi ringkasan kedua akun). Kode OTP email baru dihapus setelah login berhasil.' },
    ],
  },
  {
    version: '0.14.0',
    date: '2026-11-11',
    title: 'Duel dengan teman',
    commits: ['6a7ac8b'],
    summary: 'Adu skor mini-game dengan teman: main bareng saat sama-sama online, atau kirim tantangan dan temanmu melawan bayangan permainanmu.',
    items: [
      { kind: 'baru', text: 'Duel Teman: tantang teman main Balap Bakiak, Gasing, atau Tangkap Layangan dengan soal yang sama persis. Buka dari menu Teman (tombol Duel di tiap teman) atau Balai Main.', player: true },
      { kind: 'baru', text: 'Main bareng: kalau kalian berdua ada di ruang duel, permainan mulai bersamaan dan skor lawan terlihat langsung di layar.', player: true },
      { kind: 'baru', text: 'Tantangan: tidak perlu menunggu teman online. Main duluan, nanti temanmu melawan "bayangan" permainanmu.', player: true },
      { kind: 'baru', text: 'Hadiah koin untuk kedua pemain (menang lebih banyak, kalah tetap dapat), tanpa taruhan. Ada lencana Jagoan Duel dan tugas harian Adu seru.', player: true },
      { kind: 'baru', text: 'Admin → Ekonomi & fitur: bagian Duel (aktif/nonaktif, batas duel per hari, koin menang/seri/kalah, XP, masa berlaku tantangan). Notifikasi baru di Pusat notifikasi: tantangan duel masuk dan hasil duel.' },
      { kind: 'baru', text: 'Migrasi 012 (tabel duels). API: /api/duels (daftar & buat), /api/duels/:id (lihat, ready, start, progress, finish, decline). Skor duel diputar ulang di server dari langkah pemain; progres main bareng disimpan di memori server. Paket konten v6: lencana b-duel dan tugas harian h-duel.' },
    ],
  },
  {
    version: '0.13.1',
    date: '2026-11-11',
    title: 'Rapi di layar komputer',
    commits: ['f0acdd0'],
    items: [
      { kind: 'perbaikan', text: 'Di layar komputer, tombol mini-game (Kiri/Kanan, Lepas gasing, Panjat!) tidak lagi melebar selebar layar.', player: true },
      { kind: 'perbaikan', text: 'Warung Jamu di peta tidak lagi tertimpa pohon, dan tempat yang diklik tidak memunculkan kotak garis.', player: true },
      { kind: 'perbaikan', text: 'Spasi yang hilang di keterangan tab Terfavorit.' },
    ],
  },
  {
    version: '0.13.0',
    date: '2026-11-10',
    title: 'Pet terasa hidup: rawat dengan sentuhan, jamu, lencana, mini-game Nusantara',
    commits: ['bade17f'],
    summary: 'Wajah pet kini ikut perasaannya. Suapi, mandikan, dan tidurkan dengan sentuhan. Ada Warung Jamu, lencana, empat mini-game baru, dan suka rumah teman.',
    items: [
      { kind: 'baru', text: 'Wajah pet ikut perasaannya: senang tersenyum lebar, lapar berair mata, capek sayu dan menguap, kotor bernoda dan dikerubungi lalat, sakit berkompres. Matanya mengikuti jarimu.', player: true },
      { kind: 'baru', text: 'Makan: buka nampan lalu seret makanan ke mulut pet (atau ketuk). Pet mangap dan mengunyah.', player: true },
      { kind: 'baru', text: 'Mandi: gosok badan pet dengan sabun sampai berbusa, lalu bilas dengan gayung.', player: true },
      { kind: 'baru', text: 'Tidur: matikan lampu, pet naik ke kasur dan energinya terisi pelan-pelan. Pet bangun sendiri saat segar (ada notifikasi), atau bangunkan kapan saja.', player: true },
      { kind: 'baru', text: 'Pet suka berceletuk sesuai suasana hatinya.', player: true },
      { kind: 'baru', text: 'Pet bisa sakit ringan bila lama dibiarkan lapar dan kotor. Belikan jamu di Warung Jamu (Peta Kampung, sisi kanan) untuk menyembuhkannya.', player: true },
      { kind: 'baru', text: 'Kebanyakan makan bikin pet gembul. Olahraga dengan Sepeda Statis atau lompat tali di Matras Senam (Mebel Jati).', player: true },
      { kind: 'baru', text: 'Remah dan bulu rontok muncul di lantai. Ketuk untuk menyapu dan dapat koin.', player: true },
      { kind: 'baru', text: 'Lencana: 15 pencapaian dengan hadiah (Tugas › Lencana).', player: true },
      { kind: 'baru', text: 'Mini-game baru di Balai Main: Balap Bakiak, Gasing, Tangkap Layangan, dan Panjat Pinang (khusus event Agustusan).', player: true },
      { kind: 'baru', text: 'Suka rumah teman saat berkunjung (sekali seminggu), dan lihat Rumah terfavorit minggu ini di menu Teman.', player: true },
      { kind: 'ubah', text: 'Aktivitas kasur bawaan menjadi "Rebahan" sebentar; tidur sungguhan lewat lampu (tombol Tidur, atau ketuk kasur/lampu).', player: true },
      { kind: 'baru', text: 'Admin → Ekonomi & fitur: bagian Tidur, Kesehatan, Berat badan, Remah, Celetukan pet (satu baris satu kalimat), dan pengaturan 4 mini-game baru. Item makanan bisa ditandai "menyembuhkan"; Aktivitas punya efek "berat"; Tugas punya jenis Lencana.' },
      { kind: 'baru', text: 'Notifikasi baru di Pusat notifikasi: pet bangun tidur, pet sakit, rumah disukai.' },
      { kind: 'baru', text: 'Migrasi 011 (pets: sleep_from, sick_at, weight, crumbs_at; quests kind badge; house_likes). API: /api/sleep, /api/sweep, /api/visit/:id/like, /api/houses/top; aksi "tidur" dari PWA lama kini memulai tidur. Paket konten v5: Warung Jamu, 4 jamu, olahraga, 15 lencana, 3 tugas harian. Peta diperlebar ke 1080 (posisi X lokasi sampai 1040).' },
    ],
  },
  {
    version: '0.12.0',
    date: '2026-11-10',
    title: 'Rumah berkamar-kamar, mebel bisa dipakai, belanja jalan kaki',
    commits: ['663e93c'],
    summary: 'Bangun rumahmu: tambah ruang tamu, dapur, sampai halaman. Ketuk mebel untuk tidur, duduk, menyiram, atau membaca. Belanja kini dengan berjalan ke toko di Peta Kampung.',
    items: [
      { kind: 'baru', text: 'Toko Bangunan di Peta Kampung: beli ruangan baru untuk rumahmu (Ruang Tamu, Dapur, Kamar Mandi, Halaman Rumput berpagar, dan Loteng Bintang di Toko Mutiara). Pindah ruangan lewat tombol nama ruangan di Rumah.', player: true },
      { kind: 'baru', text: 'Mebel bisa dipakai: ketuk kasur untuk tidur, sofa/kursi untuk duduk santai, tanaman untuk disiram, rak buku untuk membaca, TV, akuarium, kulkas, kompor (masak roti), bak mandi, juga jendela dan lukisan di dinding.', player: true },
      { kind: 'baru', text: 'Belanja dengan mendatangi tokonya: ketuk toko di Peta Kampung, pet berjalan ke sana lalu masuk. Tiap toko punya penjaga dan barangnya sendiri.', player: true },
      { kind: 'baru', text: 'Mebel baru: Kompor Dapur, Bak Mandi, Bangku Taman, Pohon Mangga; lantai Rumput dan Batu Paving.', player: true },
      { kind: 'ubah', text: 'Tombol Toko di bawah diganti Tugas (dengan tanda hadiah siap). Saat berkunjung, kamu bisa melihat semua ruangan rumah teman.', player: true },
      { kind: 'baru', text: 'Admin → Aktivitas di rumah: tambah/ubah aktivitas (mebel atau bagian ruangan yang bisa dipakai, animasi, efek kebutuhan, XP, koin, hadiah barang, jeda, batas harian, level minimal, pesan) dengan pratinjau pose pet.' },
      { kind: 'baru', text: 'Item jenis Ruangan rumah (ukuran 4–10, ruangan dalam atau halaman, dinding & lantai awal) dan pengaturan house.maxRooms. Migrasi 010: rooms punya id per ruangan (data kamar lama tetap utuh), tabel activities.' },
      { kind: 'baru', text: 'API: POST /api/activity, POST /api/room menerima roomId (tanpa roomId = kamar awal, aman untuk PWA lama), state & kunjungan mengirim daftar rooms. Tugas harian baru "Betah di rumah" (peristiwa activity).' },
    ],
  },
  {
    version: '0.11.1',
    date: '2026-11-10',
    title: 'Login lewat http:// & perbaikan tampilan desktop',
    summary: 'Masuk dan main dari browser desktop kini lebih lancar.',
    commits: ['aae0213', '4a3e68c'],
    items: [
      { kind: 'perbaikan', text: 'Main tanpa daftar tidak lagi langsung diminta masuk ulang saat game dibuka lewat alamat http:// (mis. IP server sebelum domain siap).', player: true },
      { kind: 'perbaikan', text: 'Di layar komputer, jumlah koin & Mutiara tetap terlihat saat Tas/Toko terbuka, dan semua kategori terlihat tanpa harus digeser.', player: true },
      { kind: 'perbaikan', text: 'Bagikan undangan menyalin ajakan lengkap dengan link berisi kode teman. Ada juga tombol Salin link.', player: true },
      { kind: 'baru', text: 'Saat kenalan, nama pet bisa diketik bebas atau diacak dengan tombol Acak.', player: true },
      { kind: 'keamanan', text: 'Cookie sesi memakai flag Secure hanya bila PUBLIC_URL https:// (sebelumnya mengikuti NODE_ENV, sehingga di http:// browser membuang cookie dan semua /api/* 401).' },
      { kind: 'perbaikan', text: 'Isi-otomatis browser/pengelola sandi dimatikan di form kenalan; sesi tamu yang hilang sebelum pet dibuat dipulihkan otomatis.' },
    ],
  },
  {
    version: '0.11.0',
    date: '2026-11-10',
    title: 'Nama baru: BUPI',
    summary: 'Kampung Bulu sekarang bernama BUPI! Pet-mu, rumahmu, dan teman-temanmu tetap sama.',
    items: [
      { kind: 'ubah', text: 'Game berganti nama menjadi BUPI. Kampungnya sekarang bernama Kampung Bupi, dan pet-mu disebut bupi.', player: true },
      { kind: 'ubah', text: 'Nama di layar utama HP ikut berganti. Bila ikon lama masih bernama Kampung Bulu, pasang ulang dari menu browser.', player: true },
      { kind: 'ubah', text: 'Nama BUPI di judul & manifest PWA, layar masuk, admin, email (pengirim, isi, halaman berhenti langganan), WhatsApp, teks berbagi kode teman, notifikasi push, dan dokumentasi.' },
      { kind: 'ubah', text: 'Nama teknis: database bupi, file backup bupi-*.sql.gz, paket bupi, folder pemasangan ~/bupi (DEPLOY.md).' },
      { kind: 'perbaikan', text: 'backup.sh tidak lagi meninggalkan file backup kosong/rusak bila pg_dump gagal (mis. database mati): dump ditulis ke file sementara dan dicek penanda akhirnya dulu.' },
      { kind: 'perbaikan', text: 'Dua backup di detik yang sama (backup pengaman restore.sh) tidak lagi saling menimpa.' },
    ],
  },
  {
    version: '0.10.2',
    date: '2026-11-10',
    title: 'Panduan deploy & skrip deploy lebih aman',
    commits: ['a89984a'],
    items: [
      { kind: 'baru', text: 'DEPLOY.md: panduan deploy rekomendasi untuk Ubuntu 24.04/26.04 LTS (spesifikasi, DNS, pengamanan VPS, instalasi, setelah instal, update, rollback, backup di luar server, masalah umum).' },
      { kind: 'baru', text: 'deploy/restore.sh: pulihkan database dari backup dengan konfirmasi, didahului backup kondisi sekarang.' },
      { kind: 'ubah', text: 'update.sh membuat backup database dulu, lalu memeriksa server sehat dan menampilkan versi yang berjalan.' },
      { kind: 'ubah', text: 'install.sh mendukung Ubuntu 26.04 (resolute) dan memakai paket Docker bawaan Ubuntu bila repo Docker belum punya rilis tersebut.' },
      { kind: 'perbaikan', text: 'install.sh tidak lagi berhenti di langkah terakhir pada VPS baru yang belum punya crontab (backup harian kini terpasang dan password admin tercetak).' },
      { kind: 'perbaikan', text: 'Backup harian berjalan sebagai user deploy (bukan root), sehingga update.sh tanpa sudo bisa menulis backup.' },
      { kind: 'perbaikan', text: 'Nama file backup memakai detik agar dua backup di menit yang sama tidak saling menimpa.' },
    ],
  },
  {
    version: '0.10.1',
    date: '2026-11-10',
    title: 'Tampilan lebih rapi & update PWA lebih andal',
    commits: ['e218691'],
    items: [
      { kind: 'perbaikan', text: 'Di HP layar kecil, daftar Balai Main dan daftar teman tidak lagi berdesakan.', player: true },
      { kind: 'perbaikan', text: 'Pemberitahuan "Versi baru tersedia" pindah ke atas sehingga tidak menutupi tombol Makan sampai Atur.', player: true },
      { kind: 'perbaikan', text: 'Info event kembali rapi ("Pekan Ceria Kampung · koin ×1.2").', player: true },
      { kind: 'ubah', text: 'PWA memeriksa versi baru tiap 30 menit dan saat aplikasi dibuka lagi dari latar, sehingga pemain yang membiarkan aplikasi terbuka tetap mendapat update.' },
    ],
  },
  {
    version: '0.10.0',
    date: '2026-11-10',
    title: 'Integrasi & URL webhook',
    commits: ['24be392'],
    items: [
      { kind: 'baru', text: 'Admin → Integrasi & URL: semua URL yang perlu didaftarkan (webhook ZePay, Klik Flow, Mailketing, Midtrans; origin login Google/Facebook; health check), status tiap layanan, variabel .env, tempat menempelkan, tombol salin, dan ringkasan teks untuk dibagikan.' },
      { kind: 'baru', text: 'INTEGRASI.md di repo: daftar URL untuk domain produksi amt.ai.id dan langkah setiap layanan.' },
      { kind: 'ubah', text: 'install.sh menampilkan URL webhook utama di ringkasan akhir instalasi.' },
    ],
  },
  {
    version: '0.9.0',
    date: '2026-11-10',
    title: 'Halaman versi & changelog',
    summary: 'Sekarang kamu bisa melihat apa saja yang baru di setiap pembaruan.',
    commits: ['01aff52'],
    items: [
      { kind: 'baru', text: 'Menu "Apa yang baru" di Pengaturan, dan kabar singkat setelah game diperbarui.', player: true },
      { kind: 'baru', text: 'Admin → Versi & changelog: versi yang berjalan, commit, waktu build, uptime, versi database, migrasi, status penyedia, riwayat deploy, dan changelog lengkap dengan pencarian.' },
      { kind: 'baru', text: 'Riwayat deploy dicatat otomatis setiap server berjalan dengan versi/commit baru.' },
      { kind: 'baru', text: 'Endpoint publik /api/version untuk memantau versi yang terpasang.' },
      { kind: 'ubah', text: 'Commit Git ikut tercetak di build (install.sh dan update.sh mengirim GIT_SHA ke Docker).' },
      { kind: 'ubah', text: 'CHANGELOG.md di repo dibuat dari data yang sama (npm run changelog); uji gagal bila versi tidak sinkron.' },
    ],
  },
  {
    version: '0.8.1',
    date: '2026-11-10',
    title: 'Perbaikan sebelum instalasi',
    commits: ['2e93dba'],
    items: [
      { kind: 'perbaikan', text: 'Di HP layar kecil, tombol Makan, Mandi, Main, Tidur, dan Atur kini muat di layar.', player: true },
      { kind: 'perbaikan', text: 'Nama pet yang panjang tetap terbaca; level tampil sebagai lencana di pojok avatar.', player: true },
      { kind: 'keamanan', text: 'Kode verifikasi WhatsApp hanya untuk akun yang disimpan, maks. 3 kode per nomor per 24 jam, plus batas harian global.' },
      { kind: 'keamanan', text: 'Pesan antre diperiksa ulang saat dikirim: STOP, nomor diputus, berhenti langganan, pemain diblokir, saluran dimatikan, jam tenang.' },
      { kind: 'keamanan', text: 'Kunci ZePay live menolak event tanpa livemode; secret webhook mode uji tidak dipakai di mode live.' },
      { kind: 'keamanan', text: 'Perbandingan tanda tangan webhook aman untuk masukan non-ASCII (tidak lagi error 500).' },
      { kind: 'perbaikan', text: 'Webhook ZePay, Klik Flow, Mailketing, dan Midtrans dikecualikan dari rate limit.' },
      { kind: 'perbaikan', text: 'Batch kirim lebih kecil dan pembaruan status dijaga agar email tidak terkirim dua kali.' },
      { kind: 'perbaikan', text: 'Pengingat hadiah harian juga untuk pemain yang hanya punya email/WhatsApp.' },
    ],
  },
  {
    version: '0.8.0',
    date: '2026-11-10',
    title: 'Pusat notifikasi & WhatsApp',
    summary: 'Kabar penting bisa dikirim ke WhatsApp-mu.',
    commits: ['7cf0271'],
    items: [
      { kind: 'baru', text: 'Sambungkan nomor WhatsApp di Pengaturan untuk menerima kabar penting. Balas STOP kapan saja untuk berhenti.', player: true },
      { kind: 'baru', text: 'Pusat notifikasi: 18 jenis notifikasi, nyala/mati per saluran (kotak masuk, push, email, WhatsApp), teks bisa diedit dengan variabel, pratinjau, kirim uji, kembalikan ke bawaan.' },
      { kind: 'baru', text: 'WhatsApp lewat Klik Flow API v2: scan QR (teks) dan WhatsApp Official (template disetujui + OTP), webhook status, STOP/MULAI.' },
      { kind: 'baru', text: 'Pengaturan saluran: batas pesan per pemain per hari dan jam tenang WhatsApp.' },
      { kind: 'baru', text: 'Halaman admin WhatsApp dan pilihan "Kirim juga ke WhatsApp" di broadcast.' },
      { kind: 'ubah', text: 'Saklar notifikasi lama di Ekonomi & fitur dipindah otomatis ke Pusat notifikasi.' },
    ],
  },
  {
    version: '0.7.0',
    date: '2026-11-10',
    title: 'Email lewat Mailketing',
    commits: ['6850a73'],
    items: [
      { kind: 'baru', text: 'Bukti pembelian Mutiara dan kabar event bisa dikirim ke email. Bisa dimatikan di Pengaturan atau lewat tautan di email.', player: true },
      { kind: 'baru', text: 'Semua email (kode masuk & notifikasi) lewat Mailketing API v2, dengan antrean dan percobaan ulang.' },
      { kind: 'baru', text: 'Admin → Email: sisa kredit, kirim email uji, URL webhook bounce, riwayat, alamat yang diblokir.' },
      { kind: 'keamanan', text: 'nodemailer/SMTP dihapus (menutup celah keamanan nodemailer).' },
    ],
  },
  {
    version: '0.6.1',
    date: '2026-11-10',
    title: 'Batas cek status ZePay',
    commits: ['79efadd'],
    items: [
      { kind: 'perbaikan', text: 'Cek status QRIS dibatasi 30 per menit agar kuota 60 request/menit ZePay tetap cukup untuk membuat QR.' },
    ],
  },
  {
    version: '0.6.0',
    date: '2026-11-10',
    title: 'Bayar Mutiara dengan QRIS',
    summary: 'Beli Mutiara cukup pindai QRIS dari aplikasi bank atau e-wallet apa pun.',
    commits: ['7be1ada'],
    items: [
      { kind: 'baru', text: 'Beli Mutiara dengan QRIS langsung di dalam game: pindai dari aplikasi bank atau e-wallet, atau simpan QR ke galeri.', player: true },
      { kind: 'baru', text: 'Tagihan yang belum dibayar bisa dilanjutkan atau dibatalkan dari Riwayat.', player: true },
      { kind: 'baru', text: 'Integrasi ZePay: request bertanda tangan HMAC, webhook bertanda tangan, cek status cadangan, admin daftar webhook & simulasi lunas.' },
    ],
  },
  {
    version: '0.5.0',
    date: '2026-11-10',
    title: 'Balai Main & event musiman',
    summary: 'Dua mini-game baru dan event musiman dengan hadiah bertingkat.',
    commits: ['b2e54d3'],
    items: [
      { kind: 'baru', text: 'Balai Main di peta: mini-game Panen Buah dan Ingat Jajanan.', player: true },
      { kind: 'baru', text: 'Event musiman dengan poin dan hadiah bertingkat, dekorasi rumah, dan bonus koin.', player: true },
      { kind: 'baru', text: 'Editor event di admin: template, tanggal, dekorasi, pengali koin, poin per aktivitas, hadiah bertingkat, berulang tiap tahun.' },
      { kind: 'keamanan', text: 'Skor mini-game dihitung ulang di server dari seed.' },
    ],
  },
  {
    version: '0.4.0',
    date: '2026-11-09',
    title: 'Jenis pet & Lemari',
    summary: 'Lebih banyak pilihan bentuk pet dan aksesori.',
    commits: ['7bb5ab7'],
    items: [
      { kind: 'baru', text: 'Jenis pet baru, pola bulu, mata, dan ekor yang terbuka seiring naik level.', player: true },
      { kind: 'baru', text: 'Lemari untuk mengganti penampilan dan aksesori pet, termasuk slot punggung.', player: true },
      { kind: 'baru', text: 'Barang & aksesori baru di toko.', player: true },
    ],
  },
  {
    version: '0.3.0',
    date: '2026-11-09',
    title: 'Tugas & pet jalan-jalan',
    commits: ['03948be'],
    items: [
      { kind: 'baru', text: 'Tugas pemula untuk mengenal game, dan tugas harian dengan hadiah.', player: true },
      { kind: 'baru', text: 'Pet berjalan-jalan sendiri di rumah. Ketuk lantai untuk memanggilnya.', player: true },
      { kind: 'baru', text: 'Editor tugas di admin.' },
    ],
  },
  {
    version: '0.2.0',
    date: '2026-11-09',
    title: 'Siap dipasang di VPS',
    commits: ['27e3444', '129e246'],
    items: [
      { kind: 'baru', text: 'Docker Compose dengan Caddy (HTTPS otomatis), PostgreSQL, Redis; skrip install, update, dan backup harian.' },
      { kind: 'perbaikan', text: 'Perbaikan hasil audit: batas request tamu, nama tampilan tamu, mode simulasi pembelian, dan lainnya.' },
    ],
  },
  {
    version: '0.1.0',
    date: '2026-11-09',
    title: 'Versi pertama',
    summary: 'Rawat pet, hias rumah, dan bermain bersama teman di kampung.',
    commits: ['6608d85'],
    items: [
      { kind: 'baru', text: 'Rawat pet-mu: makan, mandi, main, tidur. Hias rumah dengan mebel dari toko.', player: true },
      { kind: 'baru', text: 'Peta kampung: kebun, Lomba Karung, Kolam Pancing, dan toko.', player: true },
      { kind: 'baru', text: 'Berteman, berkunjung, dan kirim hadiah.', player: true },
      { kind: 'baru', text: 'Bisa dipasang di layar utama HP dan menerima notifikasi.', player: true },
      { kind: 'baru', text: 'Server API dengan ekonomi di server, panel admin, PWA, notifikasi push.' },
    ],
  },
];

export const APP_VERSION = CHANGELOG[0].version;

/** Bandingkan versi semver sederhana: negatif bila a < b. */
export function compareVersion(a: string, b: string) {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
}

/** Rilis yang punya item untuk pemain, lebih baru dari `since` (opsional). */
export function playerReleases(since?: string | null) {
  return CHANGELOG
    .filter((r) => !since || compareVersion(r.version, since) > 0)
    .map((r) => ({ ...r, items: r.items.filter((i) => i.player) }))
    .filter((r) => r.items.length > 0);
}

/** Isi CHANGELOG.md. */
export function changelogMarkdown() {
  const out = [
    '# Changelog',
    '',
    'Semua perubahan BUPI. Versi mengikuti [semver](https://semver.org/lang/id/): fitur baru menaikkan MINOR, perbaikan menaikkan PATCH; 1.0.0 untuk peluncuran publik.',
    '',
    '> Berkas ini dibuat dari `packages/shared/src/changelog.ts` dengan `npm run changelog`. Jangan diedit langsung.',
    '',
  ];
  for (const r of CHANGELOG) {
    out.push(`## ${r.version} · ${r.date} · ${r.title}`, '');
    if (r.summary) out.push(`_${r.summary}_`, '');
    for (const k of ['baru', 'ubah', 'perbaikan', 'keamanan'] as ChangeKind[]) {
      const items = r.items.filter((i) => i.kind === k);
      if (!items.length) continue;
      out.push(`### ${CHANGE_KIND_LABEL[k]}`, '');
      for (const i of items) out.push(`- ${i.text}${i.player ? ' _(pemain)_' : ''}`);
      out.push('');
    }
    if (r.commits?.length) out.push(`Commit: ${r.commits.map((c) => `[\`${c}\`](${REPO_URL}/commit/${c})`).join(', ')}`, '');
  }
  return out.join('\n');
}
