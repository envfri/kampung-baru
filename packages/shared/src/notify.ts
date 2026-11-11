// Pusat notifikasi: semua jenis notifikasi, salurannya, dan teks bawaannya.
// Admin bisa menyalakan/mematikan tiap jenis & saluran dan mengubah teksnya; yang tersimpan di database
// hanya bagian yang diubah, sisanya kembali ke bawaan di sini.

export type NotifyChannel = 'inbox' | 'push' | 'email' | 'whatsapp';
export const NOTIFY_CHANNELS: NotifyChannel[] = ['inbox', 'push', 'email', 'whatsapp'];
export const CHANNEL_LABEL: Record<NotifyChannel, string> = { inbox: 'Kotak masuk', push: 'Push', email: 'Email', whatsapp: 'WhatsApp' };

/** Kategori yang bisa dimatikan pemain di Pengaturan (system selalu dikirim). */
export type NotifyKind = 'garden' | 'needs' | 'daily' | 'social' | 'events' | 'system';

export interface NotifyTemplate {
  enabled: boolean;
  channels: Record<NotifyChannel, boolean>;
  /** judul: kotak masuk, push, dan subjek email */
  title: string;
  /** isi: kotak masuk, push, dan email */
  body: string;
  /** teks WhatsApp (saluran scan QR); *tebal* dan _miring_ didukung WhatsApp */
  wa: string;
  /** nama template WhatsApp Official yang sudah disetujui ('' = tidak dikirim lewat Official) */
  waTemplate: string;
  /** bahasa template Official ('' = satu-satunya bahasa) */
  waLanguage: string;
  /** isian variabel template Official: nama/urutan variabel → teks dengan {variabel} */
  waVars: Record<string, string>;
}

export interface NotifyEventDef {
  key: string;
  group: string;
  label: string;
  desc: string;
  kind: NotifyKind;
  /** penting (pembayaran, kode, pesan admin): tidak dihitung batas harian & tidak ditunda jam tenang */
  critical?: boolean;
  /** saluran yang masuk akal untuk jenis ini */
  allowed: NotifyChannel[];
  url: string;
  vars: Record<string, string>;
  defaults: Omit<NotifyTemplate, 'waTemplate' | 'waLanguage' | 'waVars'> & Partial<Pick<NotifyTemplate, 'waTemplate' | 'waLanguage' | 'waVars'>>;
}

/** Variabel yang selalu tersedia. */
export const COMMON_VARS: Record<string, string> = {
  nama: 'Nama pemain',
  pet: 'Nama pet pemain',
  link: 'Tautan ke game (langsung ke halaman terkait)',
};

const ch = (...on: NotifyChannel[]) => ({ inbox: on.includes('inbox'), push: on.includes('push'), email: on.includes('email'), whatsapp: on.includes('whatsapp') });
const ALL: NotifyChannel[] = ['inbox', 'push', 'email', 'whatsapp'];

export const NOTIFY_EVENTS: NotifyEventDef[] = [
  {
    key: 'payment_paid', group: 'Pembayaran', label: 'Mutiara masuk', kind: 'system', critical: true, allowed: ALL, url: '/#pearls',
    desc: 'Setelah pembayaran Mutiara berhasil. Berfungsi sebagai bukti pembelian.',
    vars: { mutiara: 'Jumlah Mutiara, mis. 10', nominal: 'Nominal, mis. Rp15.000', invoice: 'Nomor invoice/ID pembayaran' },
    defaults: {
      enabled: true, channels: ch('inbox', 'push', 'email', 'whatsapp'),
      title: 'Mutiara masuk',
      body: '+{mutiara} Mutiara ({nominal}) sudah ada di dompetmu. Terima kasih!',
      wa: '*Mutiara masuk* 🎉\n+{mutiara} Mutiara ({nominal}) sudah ada di dompet {pet}.\nInvoice: {invoice}\n\n{link}',
    },
  },
  {
    key: 'admin_message', group: 'Pesan admin', label: 'Pesan ke satu pemain', kind: 'system', critical: true, allowed: ALL, url: '/',
    desc: 'Dikirim admin dari halaman Pemain. Judul dan isi ditulis admin saat mengirim.',
    vars: { judul: 'Judul yang ditulis admin', isi: 'Isi yang ditulis admin' },
    defaults: { enabled: true, channels: ch('inbox', 'push', 'email'), title: '{judul}', body: '{isi}', wa: '*{judul}*\n{isi}\n\n{link}' },
  },
  {
    key: 'broadcast', group: 'Pesan admin', label: 'Broadcast', kind: 'events', allowed: ['inbox', 'push', 'email', 'whatsapp'], url: '/',
    desc: 'Dikirim dari halaman Broadcast ke banyak pemain. Email & WhatsApp dipilih per broadcast.',
    vars: { judul: 'Judul broadcast', isi: 'Isi broadcast' },
    defaults: { enabled: true, channels: ch('inbox', 'push', 'email', 'whatsapp'), title: '{judul}', body: '{isi}', wa: '*{judul}*\n{isi}\n\n{link}' },
  },
  {
    key: 'event_start', group: 'Event', label: 'Event musiman dimulai', kind: 'events', allowed: ALL, url: '/#event',
    desc: 'Sekali saat event musiman mulai (event yang mengaktifkan "umumkan saat mulai").',
    vars: { event: 'Nama event', deskripsi: 'Deskripsi event' },
    defaults: { enabled: true, channels: ch('inbox', 'push', 'email'), title: '{event} dimulai!', body: '{deskripsi}', wa: '*{event} dimulai!*\n{deskripsi}\n\n{link}' },
  },
  {
    key: 'garden_ready', group: 'Kebun', label: 'Kebun siap dipanen', kind: 'garden', allowed: ALL, url: '/#garden',
    desc: 'Saat tanaman di kebun pemain sudah bisa dipanen.',
    vars: { tanaman: 'Nama hasil panen, atau "3 petak" bila lebih dari satu', jumlah: 'Jumlah petak yang siap' },
    defaults: { enabled: true, channels: ch('inbox', 'push'), title: 'Kebun siap dipanen', body: '{tanaman} di kebunmu sudah bisa dipanen.', wa: '{tanaman} di kebun {pet} sudah bisa dipanen 🌱\n{link}' },
  },
  {
    key: 'pet_woke', group: 'Pet', label: 'Pet bangun tidur', kind: 'needs', allowed: ALL, url: '/',
    desc: 'Pet yang ditidurkan (lampu dimatikan) bangun sendiri dengan energi penuh, saat pemain tidak membuka game.',
    vars: {},
    defaults: { enabled: true, channels: ch('inbox', 'push'), title: '{pet} sudah bangun', body: '{pet} bangun dengan energi penuh. Yuk main!', wa: '{pet} sudah bangun dan siap main ☀️\n{link}' },
  },
  {
    key: 'pet_sick', group: 'Pet', label: 'Pet sakit', kind: 'needs', allowed: ALL, url: '/#map',
    desc: 'Pet mulai sakit karena beberapa kebutuhannya lama dibiarkan rendah. Disembuhkan dengan jamu dari Warung Jamu.',
    vars: {},
    defaults: { enabled: true, channels: ch('inbox', 'push'), title: '{pet} kurang enak badan', body: '{pet} sakit. Belikan jamu di Warung Jamu, ya.', wa: '{pet} kurang enak badan 🤒 Belikan jamu di Warung Jamu, ya.\n{link}' },
  },
  {
    key: 'needs_kenyang', group: 'Pet', label: 'Pet lapar', kind: 'needs', allowed: ALL, url: '/',
    desc: 'Pemain tidak membuka game dan kenyang pet di bawah ambang (atur ambang di Ekonomi & fitur › Waktu notifikasi otomatis).',
    vars: {},
    defaults: { enabled: true, channels: ch('inbox', 'push'), title: '{pet} butuh kamu', body: '{pet} lapar. Ada makanan di tasmu?', wa: '{pet} lapar 🍌 Ada makanan di tasmu?\n{link}' },
  },
  {
    key: 'needs_bersih', group: 'Pet', label: 'Pet kotor', kind: 'needs', allowed: ALL, url: '/',
    desc: 'Kebersihan pet di bawah ambang.',
    vars: {},
    defaults: { enabled: true, channels: ch('inbox', 'push'), title: '{pet} butuh kamu', body: '{pet} sudah kotor dan butuh mandi.', wa: '{pet} sudah kotor dan butuh mandi 🫧\n{link}' },
  },
  {
    key: 'needs_ceria', group: 'Pet', label: 'Pet kesepian', kind: 'needs', allowed: ALL, url: '/',
    desc: 'Keceriaan pet di bawah ambang.',
    vars: {},
    defaults: { enabled: true, channels: ch('inbox', 'push'), title: '{pet} butuh kamu', body: '{pet} kesepian. Ajak main sebentar, yuk.', wa: '{pet} kesepian. Ajak main sebentar, yuk 🎈\n{link}' },
  },
  {
    key: 'needs_energi', group: 'Pet', label: 'Pet kecapekan', kind: 'needs', allowed: ALL, url: '/',
    desc: 'Energi pet di bawah ambang.',
    vars: {},
    defaults: { enabled: true, channels: ch('inbox', 'push'), title: '{pet} butuh kamu', body: '{pet} kecapekan dan perlu tidur.', wa: '{pet} kecapekan dan perlu tidur 💤\n{link}' },
  },
  {
    key: 'daily_reminder', group: 'Harian', label: 'Pengingat hadiah harian', kind: 'daily', allowed: ALL, url: '/#daily',
    desc: 'Sekali sehari setelah jam tertentu (WIB) bila pemain belum mengambil hadiah harian.',
    vars: {},
    defaults: { enabled: true, channels: ch('inbox', 'push'), title: 'Hadiah harian menunggu', body: 'Ambil hadiah hari ini sebelum tengah malam supaya beruntunmu tidak putus.', wa: 'Hadiah harian {pet} menunggu 🎁 Ambil sebelum tengah malam supaya beruntunmu tidak putus.\n{link}' },
  },
  {
    key: 'friend_added', group: 'Teman', label: 'Teman baru', kind: 'social', allowed: ALL, url: '/#friends',
    desc: 'Pemain lain menambahkan pemain ini sebagai teman.',
    vars: { teman: 'Nama teman' },
    defaults: { enabled: true, channels: ch('inbox', 'push'), title: 'Teman baru', body: '{teman} menambahkanmu sebagai teman. Kunjungi rumahnya, yuk!', wa: '{teman} menambahkanmu sebagai teman di Kampung Bupi. Kunjungi rumahnya, yuk!\n{link}' },
  },
  {
    key: 'visit', group: 'Teman', label: 'Ada tamu', kind: 'social', allowed: ALL, url: '/#friends',
    desc: 'Teman mampir ke rumah (paling banyak sekali per jeda, atur jeda di Ekonomi & fitur › Waktu notifikasi otomatis).',
    vars: { teman: 'Nama teman yang mampir' },
    defaults: { enabled: true, channels: ch('inbox', 'push'), title: 'Ada tamu!', body: '{teman} mampir ke rumahmu.', wa: '{teman} mampir ke rumah {pet} 🏡\n{link}' },
  },
  {
    key: 'house_liked', group: 'Teman', label: 'Rumah disukai', kind: 'social', allowed: ALL, url: '/#friends',
    desc: 'Teman menyukai rumah pemain (sekali per teman per minggu).',
    vars: { teman: 'Nama teman yang menyukai', jumlah: 'Total suka minggu ini' },
    defaults: { enabled: true, channels: ch('inbox', 'push'), title: 'Rumahmu disukai!', body: '{teman} menyukai rumahmu. Sudah {jumlah} suka minggu ini.', wa: '{teman} menyukai rumah {pet} 💛 Sudah {jumlah} suka minggu ini.\n{link}' },
  },
  {
    key: 'duel_invite', group: 'Teman', label: 'Ditantang duel', kind: 'social', allowed: ALL, url: '/#duels',
    desc: 'Teman menantang pemain duel mini-game (bisa main bareng langsung bila sama-sama online).',
    vars: { teman: 'Nama penantang', permainan: 'Nama mini-game' },
    defaults: { enabled: true, channels: ch('inbox', 'push'), title: '{teman} menantangmu!', body: 'Duel {permainan}. Main bareng sekarang atau balas tantangannya nanti.', wa: '{teman} menantang {pet} duel {permainan} ⚔️\n{link}' },
  },
  {
    key: 'duel_result', group: 'Teman', label: 'Hasil duel', kind: 'social', allowed: ALL, url: '/#duels',
    desc: 'Duel selesai (lawan sudah main): menang, kalah, atau seri.',
    vars: { teman: 'Nama lawan', permainan: 'Nama mini-game', hasil: 'Menang / Kalah / Seri', skor: 'Skor kamu vs skor lawan' },
    defaults: { enabled: true, channels: ch('inbox', 'push'), title: 'Duel {permainan}: {hasil}', body: 'Melawan {teman}: {skor}.', wa: 'Duel {permainan} melawan {teman}: {hasil} ({skor})\n{link}' },
  },
  {
    key: 'gift', group: 'Teman', label: 'Dapat hadiah', kind: 'social', allowed: ALL, url: '/#friends',
    desc: 'Teman mengirim hadiah.',
    vars: { teman: 'Nama pengirim', pesan: 'Pesan pengirim diawali ": " (kosong bila tidak ada)' },
    defaults: { enabled: true, channels: ch('inbox', 'push'), title: 'Kamu dapat hadiah', body: '{teman} mengirim hadiah{pesan}. Buka di menu Teman.', wa: '{teman} mengirim hadiah untuk {pet}{pesan} 🎁\n{link}' },
  },
  {
    key: 'push_test', group: 'Akun', label: 'Notifikasi uji (pemain)', kind: 'system', allowed: ['inbox', 'push'], url: '/',
    desc: 'Saat pemain menekan "Kirim notifikasi uji" di Pengaturan.',
    vars: {},
    defaults: { enabled: true, channels: ch('inbox', 'push'), title: 'Notifikasi aktif', body: 'Kamu akan dikabari saat kebun siap panen, ada hadiah teman, dan lainnya.', wa: '' },
  },
  {
    key: 'login_code', group: 'Akun', label: 'Kode masuk (email)', kind: 'system', critical: true, allowed: ['email'], url: '/',
    desc: 'Kode untuk masuk atau menautkan akun email. Tidak bisa dimatikan selama login email aktif; teksnya bisa diubah.',
    vars: { kode: 'Kode 6 angka' },
    defaults: { enabled: true, channels: ch('email'), title: 'Kode masuk BUPI: {kode}', body: 'Ketik kode ini di game. Kode berlaku 10 menit.', wa: '' },
  },
  {
    key: 'wa_verify', group: 'Akun', label: 'Kode verifikasi WhatsApp', kind: 'system', critical: true, allowed: ['whatsapp'], url: '/',
    desc: 'Kode saat pemain menyambungkan nomor WhatsApp. Saluran Official memakai template Autentikasi yang diatur di halaman WhatsApp.',
    vars: { kode: 'Kode 6 angka' },
    defaults: { enabled: true, channels: ch('whatsapp'), title: 'Kode verifikasi WhatsApp', body: '', wa: 'Kode verifikasi WhatsApp BUPI: *{kode}*\nBerlaku 10 menit. Jangan berikan ke siapa pun.' },
  },
  {
    key: 'wa_stop', group: 'Akun', label: 'Balasan STOP WhatsApp', kind: 'system', critical: true, allowed: ['whatsapp'], url: '/',
    desc: 'Balasan saat pemain mengirim STOP/BERHENTI ke nomor WhatsApp bisnis. Notifikasi WhatsApp pemain itu langsung dimatikan.',
    vars: {},
    defaults: { enabled: true, channels: ch('whatsapp'), title: 'WhatsApp dimatikan', body: '', wa: 'Notifikasi WhatsApp BUPI untuk {pet} sudah dimatikan. Balas *MULAI* kalau mau menyalakannya lagi.' },
  },
  {
    key: 'wa_start', group: 'Akun', label: 'Balasan MULAI WhatsApp', kind: 'system', critical: true, allowed: ['whatsapp'], url: '/',
    desc: 'Balasan saat pemain mengirim MULAI ke nomor WhatsApp bisnis untuk menyalakan lagi notifikasi WhatsApp.',
    vars: {},
    defaults: { enabled: true, channels: ch('whatsapp'), title: 'WhatsApp dinyalakan', body: '', wa: 'Notifikasi WhatsApp BUPI untuk {pet} menyala lagi. Balas *STOP* kapan saja untuk berhenti.' },
  },
];

/** Jenis yang tidak bisa dimatikan (dibutuhkan untuk login/verifikasi); teksnya tetap bisa diubah. */
export const NOTIFY_LOCKED = ['login_code', 'wa_verify'];

/** Contoh isi variabel untuk pratinjau & kirim uji di admin. */
export const NOTIFY_SAMPLE: Record<string, string> = {
  nama: 'Sari', pet: 'Mochi', mutiara: '10', nominal: 'Rp15.000', invoice: 'KBL-01JC0KY2MJ', judul: 'Pekan Ceria dimulai!',
  isi: 'Hadiah koin +20% sampai Minggu.', event: 'Pekan Panen Raya', deskripsi: 'Kumpulkan poin panen dan ambil caping emas edisi terbatas.',
  tanaman: 'Jagung', jumlah: '1', teman: 'Budi', pesan: ': “Selamat ulang tahun!”', kode: '482913',
};

export const NOTIFY_EVENT_BY_KEY: Record<string, NotifyEventDef> = Object.fromEntries(NOTIFY_EVENTS.map((e) => [e.key, e]));

/** Gabungkan teks bawaan dengan bagian yang diubah admin. Saluran di luar `allowed` selalu mati. */
export function resolveTemplate(def: NotifyEventDef, over?: Partial<NotifyTemplate> | null): NotifyTemplate {
  const base: NotifyTemplate = { waTemplate: '', waLanguage: '', waVars: {}, ...def.defaults, channels: { ...def.defaults.channels } };
  const o = over ?? {};
  const t: NotifyTemplate = {
    enabled: typeof o.enabled === 'boolean' ? o.enabled : base.enabled,
    channels: { ...base.channels, ...(o.channels ?? {}) },
    title: typeof o.title === 'string' ? o.title : base.title,
    body: typeof o.body === 'string' ? o.body : base.body,
    wa: typeof o.wa === 'string' ? o.wa : base.wa,
    waTemplate: typeof o.waTemplate === 'string' ? o.waTemplate : base.waTemplate,
    waLanguage: typeof o.waLanguage === 'string' ? o.waLanguage : base.waLanguage,
    waVars: o.waVars && typeof o.waVars === 'object' ? { ...o.waVars } : base.waVars,
  };
  for (const c of NOTIFY_CHANNELS) if (!def.allowed.includes(c)) t.channels[c] = false;
  return t;
}

/** Isi {variabel}. Variabel yang tidak dikenal dibiarkan apa adanya supaya salah ketik terlihat di pratinjau. */
export function renderText(tpl: string, vars: Record<string, string | number | null | undefined>) {
  return tpl
    .replace(/\{([a-z_]+)\}/g, (m, k) => (k in vars ? String(vars[k] ?? '') : m))
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([.,!?])/g, '$1')
    .trim();
}

/** Variabel {…} di teks yang tidak tersedia untuk jenis notifikasi ini. */
export function unknownVars(def: NotifyEventDef, text: string) {
  const ok = new Set([...Object.keys(COMMON_VARS), ...Object.keys(def.vars)]);
  return [...new Set([...text.matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1]).filter((k) => !ok.has(k)))];
}

/** Pengaturan saluran (bukan per jenis notifikasi). */
export interface NotifyChannelsConfig {
  email: { enabled: boolean; maxPerDay: number };
  whatsapp: {
    enabled: boolean;
    channel: 'whatsapp_qr' | 'whatsapp_official';
    from: string;
    maxPerDay: number;
    quietStart: number;
    quietEnd: number;
    verifyTemplate: string;
    /** batas kode verifikasi WhatsApp yang dikirim per hari (semua pemain) */
    verifyPerDay: number;
  };
}

export const DEFAULT_CHANNELS: NotifyChannelsConfig = {
  email: { enabled: true, maxPerDay: 3 },
  whatsapp: { enabled: true, channel: 'whatsapp_qr', from: '', maxPerDay: 2, quietStart: 21, quietEnd: 7, verifyTemplate: '', verifyPerDay: 100 },
};

export function resolveChannels(over?: any): NotifyChannelsConfig {
  const o = over ?? {};
  return {
    email: { ...DEFAULT_CHANNELS.email, ...(o.email ?? {}) },
    whatsapp: { ...DEFAULT_CHANNELS.whatsapp, ...(o.whatsapp ?? {}) },
  };
}

/** Nomor WhatsApp Indonesia ke format 62…; null bila tidak sah. */
export function normalizePhone(v: unknown): string | null {
  let s = String(v ?? '').replace(/[\s().-]/g, '');
  if (s.startsWith('+')) s = s.slice(1);
  if (s.startsWith('08')) s = '62' + s.slice(1);
  else if (s.startsWith('8')) s = '62' + s;
  return /^62[1-9]\d{7,12}$/.test(s) ? s : null;
}
