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
    version: '0.21.1',
    date: '2026-11-11',
    title: 'Audit alun-alun',
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
