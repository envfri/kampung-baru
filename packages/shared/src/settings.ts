// Nilai awal pengaturan game. Semua bisa diubah dari halaman admin (menu Ekonomi & Fitur)
// tanpa deploy ulang. Server menggabungkan nilai di database di atas default ini.

export const DEFAULT_SETTINGS = {
  economy: {
    startCoins: 300,
    startPearls: 5,
    xpBase: 40,
    xpStep: 20,
    levelUpCoins: 30,
  },
  needs: {
    decayPerHour: { kenyang: 6, bersih: 4, ceria: 5, energi: 3 },
    start: { kenyang: 70, bersih: 70, ceria: 80, energi: 70 },
  },
  actions: {
    elus: { cooldownSec: 2, ceria: 2, xp: 1, dailyXpCap: 40 },
    mandi: { cooldownSec: 300, bersih: 40, xp: 3 },
    main: { cooldownSec: 60, ceria: 20, energi: -10, kenyang: -4, coins: 5, xp: 6, minEnergi: 10 },
    tidur: { cooldownSec: 900, energi: 45, xp: 2 },
    makan: { xp: 4 },
  },
  social: {
    visitCoins: 20,
    visitXp: 5,
    maxFriends: 150,
    giftsPerDay: 5,
  },
  daily: {
    coins: [20, 25, 30, 35, 40, 50, 80],
    day7Pearls: 2,
  },
  karung: {
    playsPerDay: 6,
    energiCost: 8,
    rewards: [40, 25, 15, 8],
    xp: 8,
    minTimeMs: 3000,
  },
  fishing: {
    castsPerDay: 30,
    energiCost: 4,
    biteMinMs: 1500,
    biteMaxMs: 5000,
    windowMs: 1300,
    xp: 3,
  },
  garden: {
    slots: 6,
    harvestXp: 3,
  },
  room: {
    size: 6,
    maxItems: 40,
  },
  house: {
    maxRooms: 6,
    maxSize: 12,
    expandStep: 2,
    expandCoins: [1500, 3500, 7000, 12000],
  },
  visit: {
    together: true,
    maxLive: 4,
    actsPerFriend: 6,
    ceria: 6,
    hostCeria: 3,
    coins: 3,
    xp: 2,
    freeChat: true,
    chatMax: 80,
    phrases: ['Halo!', 'Ayo main!', 'Rumahmu bagus!', 'Lucu banget!', 'Makasih!', 'Dadah!'],
    coopPerDay: 5,
    coopCoins: 25,
    coopXp: 6,
    photoPerDay: 6,
  },
  square: {
    enabled: true,
    max: 20,
    freeChat: true,
    chatMax: 80,
    phrases: ['Halo semua!', 'Salam kenal!', 'Ayo joget!', 'Pertunjukannya seru!', 'Petmu lucu!', 'Sampai jumpa!'],
    dailyCoins: 15,
    actsPerDay: 10,
    actCoins: 3,
    actXp: 2,
    ceria: 6,
    snacksPerDay: 5,
  },
  account: {
    transferCodes: true,
    transferMinutes: 15,
    nudgeDays: 2,
    nudgeLevel: 3,
    nudgeSnoozeDays: 3,
  },
  duel: {
    enabled: true,
    perDay: 10,
    winCoins: 30,
    loseCoins: 10,
    drawCoins: 20,
    xp: 6,
    expireHours: 48,
  },
  sleep: {
    energiPerHour: 40,
    otherDecayMult: 0.5,
    maxEnergiToSleep: 95,
    badgeMinMinutes: 20,
  },
  health: {
    enabled: true,
    lowThreshold: 20,
    lowCount: 2,
    sickAfterHours: 3,
  },
  weight: {
    perExcess: 0.6,
    lossPerDay: 6,
    chubbyAt: 40,
  },
  crumbs: {
    everyMinutes: 40,
    max: 5,
    coins: 2,
    dailyMax: 25,
  },
  speech: {
    everySec: 35,
    biasa: ['Halo, {nama}!', 'Hari ini mau ngapain?', 'Kampung lagi ramai, lho.'],
    senang: ['Aku senang banget!', 'Hari yang indah!', '{nama} baik deh!'],
    lapar: ['Perutku keroncongan…', 'Ada camilan nggak?', 'Laper nih, {nama}…'],
    kotor: ['Badanku gatal, mandi yuk!', 'Ih, ada lalat…', 'Aku butuh sabun!'],
    capek: ['Hoaam… ngantuk.', 'Matikan lampunya, dong…', 'Aku capek banget.'],
    bosan: ['Main yuk!', 'Bosan nih…', 'Ke Balai Main, yuk!'],
    sakit: ['Badanku nggak enak…', 'Kayaknya butuh jamu.', 'Pusing…'],
    gembul: ['Kekenyangan…', 'Olahraga dulu, kali ya?', 'Perutku bulat!'],
    tidur: ['Zzz…', 'Mimpi makan klepon…'],
    elus: ['Hihi, geli!', 'Lagi dong!', 'Sayang {nama}!'],
  } as Record<string, any>,
  quests: {
    dailyCount: 3,
  },
  games: {
    panen: { playsPerDay: 8, energiCost: 6, durationMs: 30000, coinPerPoint: 2, maxCoins: 80, xp: 6 },
    memori: { playsPerDay: 8, energiCost: 4, rewards: [15, 30, 50], xp: 6 },
    bakiak: { playsPerDay: 8, energiCost: 6, durationMs: 20000, coinPerStep: 1, maxCoins: 60, xp: 6 },
    gasing: { playsPerDay: 8, energiCost: 4, rounds: 5, coinPerSec: 2, maxCoins: 60, xp: 5 },
    layangan: { playsPerDay: 8, energiCost: 6, durationMs: 25000, coinPerPoint: 2, maxCoins: 70, xp: 6 },
    pinang: { playsPerDay: 5, energiCost: 8, durationMs: 20000, rewards: [10, 25, 45, 80], xp: 8 },
  },
  starter: {
    inventory: { 'pisang-goreng': 3, klepon: 2, 'bibit-tomat': 2, 'wp-garis': 1, 'fl-papan': 1 } as Record<string, number>,
    layout: [
      { i: 'kasur-rotan', x: 4, y: 0 },
      { i: 'karpet-kawung', x: 2, y: 2 },
      { i: 'pot-monstera', x: 0, y: 4 },
    ],
    wall: 'wp-garis',
    floor: 'fl-papan',
  },
  notify: {
    needsThreshold: 25,
    needsEveryHours: 8,
    dailyHourWib: 19,
    visitThrottleMin: 60,
  },
  features: {
    quests: true,
    minigames: true,
    guestLogin: true,
    emailLogin: true,
    googleLogin: true,
    facebookLogin: true,
    payments: true,
    garden: true,
    karung: true,
    fishing: true,
    gifts: true,
  },
};

export type Settings = typeof DEFAULT_SETTINGS;

/** Penjelasan singkat per bagian, ditampilkan di halaman admin. */
export const SETTINGS_HELP: Record<keyof Settings, string> = {
  economy: 'Modal awal pemain, kurva level, dan bonus naik level.',
  needs: 'Laju turunnya kebutuhan per jam dan nilai awal pet baru.',
  actions: 'Efek, hadiah, dan cooldown (detik) untuk aksi di rumah.',
  social: 'Hadiah kunjungan teman dan batas hadiah harian.',
  daily: 'Hadiah login harian hari ke-1 sampai ke-7 (lalu berulang).',
  karung: 'Lomba Karung: jatah main per hari, biaya energi, hadiah per peringkat.',
  fishing: 'Kolam Pancing: jatah lempar per hari, jeda gigitan, dan lama jendela tarik (ms).',
  garden: 'Jumlah petak kebun dan XP panen.',
  room: 'Ukuran kamar awal (petak) dan batas jumlah barang terpasang per ruangan.',
  square: 'Alun-alun: tempat berkumpul semua pemain (bukan hanya teman). enabled = buka/tutup; max = orang per alun-alun (penuh → otomatis Alun-alun 2, 3, ...); freeChat = boleh mengetik bebas (disaring kata terlarang, tautan & nomor ditolak; matikan supaya hanya frasa siap pakai), chatMax = panjang pesan, phrases = frasa siap pakai; dailyCoins = koin kunjungan pertama tiap hari; actsPerDay/actCoins/actXp/ceria = hadiah nonton, naik komidi putar, ayunan, berteduh, duduk, joget; snacksPerDay = jajan per hari (harga & efek jajanan tetap). Obrolan tercatat di Moderasi; 3 laporan dari pemain berbeda dalam 1 jam membisukan obrolan pemain itu 30 menit.',
  visit: 'Kunjungan bareng: pet ikut berkunjung & bermain dengan pet teman. together = aktifkan; maxLive = tamu yang tampil bersamaan di satu rumah (semua ruangan, selain tuan rumah); actsPerFriend = interaksi berhadiah per teman per hari (coins & xp untuk tamu, ceria untuk pet tamu, hostCeria untuk pet tuan rumah); freeChat = boleh mengetik bebas (disaring daftar kata terlarang, tautan & nomor ditolak), chatMax = panjang pesan, phrases = frasa siap pakai (satu baris satu frasa); coopPerDay/coopCoins/coopXp = hadiah Masak bareng & Lempar bola; photoPerDay = foto bareng per hari.',
  account: 'Akun tamu & pindah perangkat. transferCodes = izinkan kode pindah perangkat (sekali pakai, berlaku transferMinutes menit). Ajakan "Simpan progres" untuk pemain tamu muncul setelah nudgeDays hari, atau saat pet mencapai Lv nudgeLevel, punya teman pertama, atau menang duel; bila ditunda muncul lagi setelah nudgeSnoozeDays hari.',
  duel: 'Duel dengan teman (Balap Bakiak, Gasing, Tangkap Layangan): main bareng langsung bila keduanya online, atau tantangan melawan bayangan. Hadiah koin dari sistem (tanpa taruhan) dibayar setelah kedua pemain main; perDay = batas duel per pemain per hari; tantangan kedaluwarsa setelah expireHours jam.',
  sleep: 'Tidur dengan lampu mati: energi naik per jam, kebutuhan lain turun lebih lambat (pengali), batas energi untuk bisa tidur, dan lama tidur minimal untuk dihitung lencana (menit).',
  health: 'Sakit ringan: pet sakit bila sejumlah kebutuhan (lowCount) di bawah ambang selama beberapa jam. Disembuhkan dengan makanan bertanda "menyembuhkan" (jamu). Pet tidak pernah mati.',
  weight: 'Berat badan: kelebihan kenyang × pengali menambah berat, turun sendiri per hari dan lewat olahraga (efek "berat" di Aktivitas). Mulai tampak gembul di angka chubbyAt.',
  crumbs: 'Remah & bulu rontok di lantai: muncul tiap beberapa menit sampai batas, disapu untuk koin (batas harian = jumlah remah berhadiah).',
  speech: 'Celetukan pet per suasana hati (satu baris satu kalimat). {pet} = nama pet, {nama} = nama pemain. everySec = jeda rata-rata antar celetukan (detik).',
  house: 'Rumah: jumlah maksimal ruangan per pemain (kamar awal + ruangan yang dibeli di Toko Bangunan). Jenis ruangan, harga, dan ukurannya diatur sebagai item jenis Ruangan. Perluas ruangan: tiap pembelian menambah expandStep petak per sisi sampai maxSize (maks 14); harga koin per perluasan ke-1, ke-2, dst. di expandCoins (yang terakhir dipakai untuk seterusnya). Batas barang per ruangan ikut membesar sebanding luasnya.',
  notify: 'Waktu notifikasi otomatis: ambang kebutuhan pet & jeda jam, jam pengingat hadiah harian (WIB), jeda notifikasi kunjungan (menit). Nyala/mati dan teks tiap notifikasi diatur di Pusat notifikasi.',
  games: 'Mini-game Balai Main. Panen Buah & Tangkap Layangan: hadiah = skor × koin per poin (maks maxCoins). Ingat Jajanan: koin untuk 1–3 bintang. Balap Bakiak: koin per langkah. Gasing: koin per detik berputar. Panjat Pinang (hanya saat event berdekorasi bendera): koin untuk tiap seperempat tiang.',
  quests: 'Jumlah tugas harian yang diberikan ke tiap pemain per hari (dipilih acak dari tugas harian yang aktif).',
  starter: 'Barang awal pemain baru: isi tas, susunan ruangan, dinding, dan lantai (pakai ID item).',
  features: 'Nyalakan atau matikan fitur dan metode login.',
};

export function mergeSettings(base: any, over: any): any {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return over ?? base;
  const out: any = { ...base };
  if (over && typeof over === 'object') {
    for (const k of Object.keys(over)) {
      out[k] = k in base ? mergeSettings(base[k], over[k]) : over[k];
    }
  }
  return out;
}
