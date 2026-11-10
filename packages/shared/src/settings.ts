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
  quests: {
    dailyCount: 3,
  },
  games: {
    panen: { playsPerDay: 8, energiCost: 6, durationMs: 30000, coinPerPoint: 2, maxCoins: 80, xp: 6 },
    memori: { playsPerDay: 8, energiCost: 4, rewards: [15, 30, 50], xp: 6 },
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
    gardenReady: true,
    needsLow: true,
    needsThreshold: 25,
    needsEveryHours: 8,
    dailyReminder: true,
    dailyHourWib: 19,
    socialVisits: true,
    visitThrottleMin: 60,
    giftsAndFriends: true,
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
  email: {
    enabled: true,
    system: true,
    events: true,
    social: false,
    garden: false,
    needs: false,
    daily: false,
    maxPerDay: 3,
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
  room: 'Ukuran ruangan (petak) dan batas jumlah barang terpasang.',
  notify: 'Notifikasi otomatis ke HP: kebun siap panen, pet butuh perhatian (ambang & jeda jam), pengingat hadiah harian (jam WIB), kunjungan & hadiah teman.',
  games: 'Mini-game Balai Main. Panen Buah: hadiah = skor × koin per poin (maks maxCoins). Ingat Jajanan: hadiah koin untuk 1, 2, dan 3 bintang.',
  quests: 'Jumlah tugas harian yang diberikan ke tiap pemain per hari (dipilih acak dari tugas harian yang aktif).',
  starter: 'Barang awal pemain baru: isi tas, susunan ruangan, dinding, dan lantai (pakai ID item).',
  features: 'Nyalakan atau matikan fitur dan metode login.',
  email: 'Notifikasi yang ikut dikirim ke email pemain lewat Mailketing (1 email = 1 kredit). system = pembayaran & pesan admin, events = event musiman. maxPerDay = batas email per pemain per hari di luar pembayaran. Broadcast dipilih per broadcast di halaman Notifikasi.',
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
