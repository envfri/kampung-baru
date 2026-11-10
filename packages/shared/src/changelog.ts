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
    version: '0.9.0',
    date: '2026-11-10',
    title: 'Halaman versi & changelog',
    summary: 'Sekarang kamu bisa melihat apa saja yang baru di setiap pembaruan.',
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
    title: 'Kampung Bulu pertama',
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
    'Semua perubahan Kampung Bulu. Versi mengikuti [semver](https://semver.org/lang/id/): fitur baru menaikkan MINOR, perbaikan menaikkan PATCH; 1.0.0 untuk peluncuran publik.',
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
