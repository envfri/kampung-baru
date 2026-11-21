// Nilai awal pengaturan game. Semua bisa diubah dari halaman admin (menu Ekonomi & Fitur)
// tanpa deploy ulang. Server menggabungkan nilai di database di atas default ini.
import { KERJA_STORIES } from './kerja';

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
  // Ludo main bareng: bidak per jumlah pemain, waktu lempar/pilih (ms), batas permainan, syarat hadiah, tempo langkah
  ludo: {
    tokensByPlayers: { 2: 4, 3: 2, 4: 2 } as Record<string, number>,
    rollMs: 10_000,
    pickMs: 8000,
    maxMs: 900_000,
    captureBonus: true,
    minMs: 300_000,
    stepMs: 190,
  },
  fishing: {
    castsPerDay: 30,
    /** energi per lemparan menurut jarak */
    energi: { dekat: 3, sedang: 4, jauh: 5 },
    /** lama menunggu sambaran (ms, min–maks) setelah pelampung jatuh */
    waitMs: { dekat: [2000, 4000], sedang: [3000, 6000], jauh: [4000, 8000] },
    /** pengali peluang ikan per tingkat menurut jarak (temuan memakai pengali dekat/jauh di item) */
    tierMult: {
      dekat: { biasa: 1.3, jarang: 0.6, langka: 0.3, legenda: 0 },
      sedang: { biasa: 1, jarang: 1, langka: 1, legenda: 1 },
      jauh: { biasa: 0.75, jarang: 1.3, langka: 1.8, legenda: 3 },
    },
    nibbleMax: 3,
    nibbleGapMs: [600, 1400],
    /** jendela tekan TARIK setelah sambar (ms), toleransi jaringan ditambah di server */
    windowMs: { biasa: 1200, jarang: 1200, langka: 1000, legenda: 900 },
    /** lama tarik-ulur minimal (ms, min–maks); server menolak ikan yang "mendarat" lebih cepat */
    fightMs: { biasa: [3000, 5000], jarang: [5000, 7000], langka: [6000, 9000], legenda: [8000, 12000], sampah: [1500, 2500], harta: [4000, 5000] },
    xp: { biasa: 3, jarang: 4, langka: 6, legenda: 10, temuan: 1 },
    /** peti harta: koin acak per pita (coinMin–bandMax[0], bandMax[0]–bandMax[1], ...) dengan peluang bandOdds (%) */
    treasure: { coinMin: 50, bandMax: [120, 200, 300], bandOdds: [60, 30, 10], pearlChance: 15, pearlMin: 1, pearlMax: 3 },
    /** batas Mutiara dari kolam (peti + Ikan Dewa) per hari */
    pearlDailyCap: 3,
    bottle: {
      coinMin: 5,
      coinMax: 20,
      messages: [
        'Siapa pun yang menemukan ini: jangan lupa makan ya!',
        'Hari ini aku dapat ikan mas 29 cm. Kalahkan kalau bisa!',
        'Kata Mbah: lempar jauh, sabar, nanti yang besar datang.',
        'Kalau tali terasa berat tapi diam saja… mungkin bukan ikan.',
        'Belut itu licin. Jangan biarkan talinya kendur!',
        'Semoga harimu semanis pisang goreng.',
        'Tolong jaga kolam ini tetap bersih ya. — Pak RT',
      ],
    },
    /** ikan yang dilepas lagi (Ikan Dewa): berkah Mutiara & ceria */
    release: { pearl: 1, ceria: 20 },
  },
  garden: {
    // tingkat kebun: petak, harga perluasan (koin), syarat level pet. Tingkat 1 gratis.
    levels: [
      { slots: 6, coins: 0, petLevel: 1 },
      { slots: 9, coins: 400, petLevel: 3 },
      { slots: 12, coins: 1200, petLevel: 6 },
      { slots: 15, coins: 3000, petLevel: 10 },
      { slots: 18, coins: 6000, petLevel: 15 },
    ],
    harvestXp: 3,
    xpCapPerDay: 150,
    waterPct: 10,
    fertilizerPct: 25,
    scarecrowPct: 10,
    fertileSoilPct: 10,
    plantsPerDay: 300,
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
    /** Fasilitas rumah teman: tamu boleh memakai perabot tuan rumah (efek ke pet tamu); tip koin untuk tuan rumah */
    facility: { on: true, hostCoins: 1, hostMaxPerDay: 10 },
  },
  /** Catur Kilat 5+3 (main bareng, 2 pemain): jam, batas diam, batas langkah pertama, syarat hadiah */
  catur: { baseMs: 300_000, incMs: 3000, firstMoveMs: 30_000, idleMs: 90_000, idleWarnMs: 60_000, maxMs: 1_500_000, minPlies: 20, drawOfferFromPly: 20, drawOffers: 3, promoAutoMs: 10_000, auto50: 100 },
  /** main bareng: pengali hadiah game panjang (Catur, Ludo) */
  bareng: { longMult: 1.5 },
  /** Jepret & Bagikan ke Story: batas catatan bagikan per pemain per hari (untuk tugas, tanpa koin di luar tugas) */
  jepret: { shareEventsPerDay: 5 },
  /** Pet ngajak ke Alun-alun (gelembung ajakan di rumah sendiri saat ada orang lain di alun-alun) */
  ajakAlun: {
    firstSec: 60,
    gapMin: 15,
    perDay: 4,
    minPeople: 1,
    ramaiFrom: 5,
    lines: {
      teman: ['Ke alun-alun yuk! {teman} lagi di sana.', '{teman} lagi di alun-alun, susul yuk!'],
      kembangApi: ['Sebentar lagi ada kembang api! Nonton bareng yuk?', 'Kembang api {menit} menit lagi! Ke alun-alun yuk?'],
      lomba: ['Lomba Mancing mulai {menit} menit lagi. Ikut yuk!'],
      arak: ['Arak-arakan ondel-ondel mau lewat! Ikut yuk?'],
      sedikit: ['Ada {jumlah} orang di alun-alun, samperin yuk?', 'Di alun-alun ada {jumlah} orang. Main ke sana yuk?'],
      ramai: ['Alun-alun lagi ramai, {jumlah} orang! Main ke sana yuk?', 'Wah, alun-alun ramai banget! Ke sana yuk?'],
    },
  },
  /** Kerja Sambilan: pet kerja paruh waktu di tempat kampung (Papan Lowongan di peta). Lama kerja dalam MENIT. */
  kerja: {
    on: true,
    /** pilihan lama kerja (menit) & hasilnya untuk tempat biasa: pendek, sedang, panjang */
    minutes: [60, 180, 480],
    pay: [20, 50, 110],
    xp: [4, 10, 24],
    /** biaya kebutuhan saat pulang (dikurangi); bersih hanya untuk tempat yang "kotor" (kebun & kolam) */
    energi: [8, 15, 30],
    kenyang: [6, 12, 25],
    bersih: [10, 15, 25],
    minEnergi: 25,
    minKenyang: 25,
    maxHoursPerDay: 12,
    /** shift selesai untuk naik pangkat (per tempat): Magang → Karyawan → Senior → Kepala */
    rankAt: { karyawan: 5, senior: 15, kepala: 40 },
    rankBonusPct: 10,
    /** ronda malam: hanya bisa mulai pukul fromHour–toHour (jam setempat pemain), lama tetap */
    ronda: { fromHour: 19, toHour: 23, minutes: 480, pay: 150, xp: 28, energi: 35, kenyang: 25 },
    jobs: {
      warung: { minLevel: 1, bonusPct: 35, bonusItems: ['pisang-goreng', 'es-teh', 'onde-onde', 'pisang-molen'], kotor: false },
      kebun: { minLevel: 1, bonusPct: 35, bonusItems: ['tomat', 'wortel', 'jagung', 'kangkung', 'bibit-tomat', 'bibit-cabai', 'bibit-kangkung'], kotor: true },
      kolam: { minLevel: 2, bonusPct: 30, bonusItems: ['ikan-mujair', 'ikan-nila', 'ikan-mas', 'ikan-tawes', 'ikan-wader', 'ikan-sepat'], kotor: true },
      mebel: { minLevel: 3, bonusPct: 8, bonusItems: ['kaktus-pot', 'pot-monstera'], kotor: false },
      butik: { minLevel: 4, bonusPct: 8, bonusItems: ['plester-lucu', 'pita-rambut', 'dasi-kupu', 'kacu-merahputih'], kotor: false },
      ronda: { minLevel: 6, bonusPct: 30, bonusItems: ['wedang-jahe', 'wedang-ronde'], kotor: false },
    },
    stories: KERJA_STORIES as Record<string, string[]>,
  },
  premium: {
    bundleDiscount: 20,
    bonusMin: 3,
  },
  square: {
    enabled: true,
    max: 20,
    freeChat: true,
    chatMax: 80,
    phrases: ['Halo semua!', 'Salam kenal!', 'Ayo joget!', 'Pertunjukannya seru!', 'Petmu lucu!', 'Sampai jumpa!'],
    dailyCoins: 15,
    actsPerDay: 14,
    actCoins: 3,
    actXp: 2,
    ceria: 6,
    rideCoins: 5,
    rideXp: 3,
    rideCeria: 8,
    gelangBonus: 10,
    fireworkCeria: 6,
    /** Lomba Mancing di Kolam Pemancingan Bareng (tiap 20 menit, 3 menit) */
    lomba: { castsPerDay: 12, entryEnergi: 6, prizes: [40, 25, 15], prizeXp: [10, 6, 4], joinCoins: 5, joinXp: 3, perDay: 3 },
    /** bonus Ramai-ramai di Kolam Pemancingan Bareng (mancing santai): min pemancing di dermaga → tunggu ikan lebih singkat & XP tambahan */
    ramai: { anglers: 3, waitPct: 70, xp: 1 },
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
    expireHours: 6,
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
    catur: true,
    ludo: true,
    jepret: true,
    ajakAlun: true,
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
  karung: 'Lomba Karung: jatah main per hari, biaya energi, hadiah per peringkat. Balap Karung Live di alun-alun memakai jatah & energi yang sama, hadiahnya +5 koin per peringkat.',
  ludo: 'Ludo main bareng (rumah & Tikar Ludo di alun-alun, 2–4 pemain). tokensByPlayers = bidak per pemain menurut jumlah pemain (berdua 4, bertiga/berempat 2; 1–4); rollMs = waktu melempar dadu, pickMs = waktu memilih bidak (habis = server melempar / memilih otomatis); maxMs = batas lama permainan (lalu diurutkan menurut langkah bidak); captureBonus = makan bidak lawan = lempar lagi; minMs = lama main minimal supaya berhadiah bila permainan tidak selesai normal (pemain lain pergi); stepMs = tempo animasi per kotak. Hadiah memakai jatah & koin main bareng (Kunjungan bareng › coop) menurut peringkat 100/60/40/20%.',
  fishing: 'Kolam Pancing: jatah lempar per hari (semua jarak), energi per jarak (dekat/sedang/jauh), lama tunggu sambaran per jarak (ms), pengali peluang per tingkat ikan menurut jarak (tierMult; temuan memakai pengali dekat/jauh di item), ngicip maks & jedanya, jendela tekan TARIK per tingkat (ms), lama tarik-ulur minimal per tingkat (ms; server menolak tangkapan yang lebih cepat), XP per tingkat. Peti harta: koin per pita & peluangnya (%), peluang bonus Mutiara (%) dan jumlahnya; pearlDailyCap = batas Mutiara dari kolam per hari (peti + Ikan Dewa). Botol pesan: koin & pesan acak (petunjuk ikan rahasia diatur di item ikan rahasia › petunjuk). release = berkah untuk ikan yang dilepas (Ikan Dewa). Bobot, tingkat, waktu & jarak tiap ikan diatur di Item & harga.',
  garden: 'Kebun. levels = tingkat kebun: jumlah petak (kelipatan 3, maks 18, makin banyak tiap tingkat), harga perluasan dalam koin, dan level pet minimal; tingkat 1 gratis. Benda & kegunaan tiap tingkat tetap: Lv2 orang-orangan sawah (scarecrowPct = peluang hasil panen +1), Lv3 gentong (Siram semua), Lv4 gubuk (Tanam semua), Lv5 tanah subur (fertileSoilPct = tumbuh lebih cepat). waterPct = siram (gratis, sekali per tanam) memotong sisa waktu sebesar persen ini dari lama tumbuh; fertilizerPct = pupuk (item, sekali per tanam). harvestXp = XP panen untuk bibit yang tidak punya XP sendiri; xpCapPerDay = batas XP panen per hari (0 = tanpa batas); plantsPerDay = batas tanam per pemain per hari.',
  room: 'Ukuran kamar awal (petak) dan batas jumlah barang terpasang per ruangan.',
  premium: 'Set item premium (Mutiara): bundleDiscount = diskon paket set dalam persen (dari jumlah harga item set yang belum dimiliki pemain); bonusMin = jumlah item berbeda dari set yang sama dalam satu ruangan untuk memunculkan efek suasana (hanya tampilan). Harga per item diatur di Item & harga.',
  square: 'Alun-alun: tempat berkumpul semua pemain (bukan hanya teman). enabled = buka/tutup; max = orang per alun-alun (penuh → otomatis Alun-alun 2, 3, ...); freeChat = boleh mengetik bebas (disaring kata terlarang, tautan & nomor ditolak; matikan supaya hanya frasa siap pakai), chatMax = panjang pesan, phrases = frasa siap pakai; dailyCoins = koin kunjungan pertama tiap hari; actsPerDay = jatah main berhadiah per hari (aksi singkat & wahana panjang bersama); actCoins/actXp/ceria = hadiah aksi singkat (nonton, komidi putar, ayunan, berteduh, duduk, joget, lempar gelang, layar tancap); rideCoins/rideXp/rideCeria = hadiah wahana panjang setelah selesai (bianglala, kereta kelinci, ikut arak-arakan); gelangBonus = koin tambahan lempar gelang 3 dari 3 (sekali sehari); fireworkCeria = ceria saat kembang api 20.00 & 21.00 (sekali sehari, tanpa koin). lomba = Lomba Mancing di Kolam Pemancingan Bareng (tiap 20 menit, 3 menit; mancing santai di luar lomba memakai jatah Kolam Pancing): castsPerDay = jatah lempar lomba per hari (terpisah), entryEnergi = energi sekali per lomba, prizes/prizeXp = hadiah juara 1–3 (butuh paling tidak 2 peserta; skor = total berat ikan), joinCoins/joinXp = hadiah peserta lain yang dapat ikan, perDay = lomba berhadiah per hari. Ikan lomba dicatat di Buku Ikan lalu dilepas (tidak masuk Tas). ramai = bonus Ramai-ramai untuk mancing santai di kolam alun-alun: bila paling tidak `anglers` pemancing duduk di dermaga (termasuk dirinya), waktu tunggu ikan dipotong menjadi waitPct % dan tiap tangkapan dapat +xp XP (tanpa koin tambahan). Lewat jatah: tetap boleh main tanpa hadiah; snacksPerDay = jajan per hari (harga & efek jajanan tetap). Obrolan tercatat di Moderasi; 3 laporan dari pemain berbeda dalam 1 jam membisukan obrolan pemain itu 30 menit.',
  visit: 'Kunjungan bareng: pet ikut berkunjung & bermain dengan pet teman. together = aktifkan; maxLive = tamu yang tampil bersamaan di satu rumah (semua ruangan, selain tuan rumah); actsPerFriend = interaksi berhadiah per teman per hari (coins & xp untuk tamu, ceria untuk pet tamu, hostCeria untuk pet tuan rumah); freeChat = boleh mengetik bebas (disaring daftar kata terlarang, tautan & nomor ditolak), chatMax = panjang pesan, phrases = frasa siap pakai (satu baris satu frasa); coopPerDay/coopCoins/coopXp = hadiah Masak bareng, Lempar bola, Congklak & Catur (menang penuh, kalah 40%, seri 60%) & Ular Tangga Kampung (peringkat 100/60/40/20%; pemain yang bertahan dapat hadiah bila permainan selesai normal atau ia sudah melempar paling tidak 6 kali); photoPerDay = foto bareng per hari. facility = Fasilitas rumah teman: tamu memakai perabot, jendela & lukisan di rumah teman seperti di rumah sendiri (efek, XP, koin & hadiah untuk pet tamu; cooldown & batas harian aktivitas sama dengan di rumah; satu pet per perabot untuk tidur/duduk/berendam/gowes; tidur sampai segar, mandi gosok & nampan makan tetap di rumah sendiri). Butuh together aktif & tuan rumah mengizinkan (Pengaturan › Teman boleh memakai perabot di rumahku). on = aktifkan; hostCoins = tip koin untuk tuan rumah per pemakaian (0–100), hostMaxPerDay = batas tip per tuan rumah per hari (0–1000).',
  catur: 'Catur Kilat (main bareng 2 pemain, rumah & Pos Ronda alun-alun). baseMs = waktu awal tiap pemain (ms, 300000 = 5 menit), incMs = tambahan per langkah (ms), firstMoveMs = batas langkah pertama tiap pihak (lewat = permainan batal tanpa hadiah), idleMs = batas diam satu langkah (lewat = kalah waktu), idleWarnMs = peringatan diam, maxMs = batas lama permainan (lewat = remis), minPlies = paruh langkah minimal supaya ada hadiah (kurang = tanpa hadiah & tanpa jatah), drawOfferFromPly = tawar remis boleh mulai paruh langkah ke-, drawOffers = tawaran remis per pemain, promoAutoMs = pilihan promosi otomatis Menteri (ms), auto50 = remis otomatis setelah sekian paruh langkah tanpa makan / gerak pion (0 = mati).',
  jepret: 'Jepret & Bagikan ke Story: pemain memotret rumah, rumah teman, atau alun-alun (atau Foto bareng) lalu membagikannya sebagai gambar Story/Feed. Gambar dibuat di HP pemain (tanpa biaya server, tidak disimpan di server). shareEventsPerDay = batas catatan bagikan/simpan per pemain per hari (0–50) yang dihitung untuk tugas harian "Bagikan 1 foto"; tidak ada koin di luar hadiah tugas. Nyalakan/matikan di Fitur & login › jepret.',
  ajakAlun: 'Pet ngajak ke Alun-alun: saat pemain di rumahnya sendiri dan ada orang lain di alun-alun, pet sesekali mengajak lewat gelembung bicara dengan tombol Ayo! (langsung jalan ke alun-alun) dan Nanti. Alasan dipilih otomatis: kembang api ≤ 5 menit lagi, Lomba Mancing ≤ 3 menit lagi, arak-arakan ≤ 2 menit lagi, teman sedang di sana, lalu keramaian. firstSec = jeda pertama setelah masuk rumah (detik, 5–600), gapMin = jeda antar ajakan (menit, 1–240), perDay = ajakan per hari (0–20), minPeople = paling sedikit orang lain di alun-alun (1–20), ramaiFrom = mulai sekian orang dipakai kalimat "ramai" (2–50). Pemain yang menekan Nanti 2 kali berturut-turut tidak diajak lagi hari itu; tidak mengajak bila baru pulang dari alun-alun (< 10 menit). lines = kalimat per alasan (satu baris satu kalimat, dipilih acak): {teman} = nama pet teman, {jumlah} = jumlah orang, {menit} = menit sampai acara, {pet} = nama pet pemain. Nyalakan/matikan di Fitur & login › ajakAlun.',
  kerja: 'Kerja Sambilan: pet kerja paruh waktu di tempat kampung (Papan Lowongan di peta) lalu pulang membawa gaji, XP, kadang barang bonus, dan cerita lucu. on = buka/tutup (pet yang sedang kerja tetap pulang & gajinya tetap bisa diambil). minutes = 3 pilihan lama kerja dalam MENIT (bawaan 60, 180, 480; perkecil untuk uji), pay & xp = gaji koin & XP Magang untuk tiap pilihan, energi/kenyang = kebutuhan yang berkurang saat pulang, bersih = ikut berkurang khusus tempat kotor (jobs › kotor: kebun & kolam). Selama kerja kebutuhan pet tidak turun dan pet tidak bisa sakit karena dibiarkan; biayanya dikenakan sekali saat pulang. Syarat mulai: energi ≥ minEnergi, kenyang ≥ minKenyang, tidak sakit, tidak tidur, level ≥ jobs › minLevel. maxHoursPerDay = batas jam kerja per hari (shift selesai dihitung penuh, yang dipanggil pulang dihitung lama kerjanya). rankAt = shift selesai per tempat untuk naik ke Karyawan / Senior / Kepala; rankBonusPct = tambahan gaji per pangkat di atas Magang (%). Saat jadi Karyawan pet dapat seragam tempat itu (tidak dijual di toko). Dipanggil pulang: gaji sebanding lama kerja (termasuk bonus pangkat), tanpa bonus barang, tidak dihitung untuk pangkat. ronda = Ronda malam di Pos Ronda: hanya bisa mulai pukul fromHour–toHour jam setempat pemain, lama tetap (minutes), gaji, XP & biaya sendiri. jobs › bonusPct = peluang barang bonus (%), bonusItems = ID item yang mungkin didapat (dipilih acak). stories = cerita pulang kerja per tempat (satu baris satu cerita, {pet} = nama pet).',
  bareng: 'Main bareng: longMult = pengali koin & XP untuk game panjang (Catur, Ludo) di atas hadiah main bareng biasa (Kunjungan bareng › coopCoins / coopXp). Jatah harian tetap sama.',
  account: 'Akun tamu & pindah perangkat. transferCodes = izinkan kode pindah perangkat (sekali pakai, berlaku transferMinutes menit). Ajakan "Simpan progres" untuk pemain tamu muncul setelah nudgeDays hari, atau saat pet mencapai Lv nudgeLevel, punya teman pertama, atau menang duel; bila ditunda muncul lagi setelah nudgeSnoozeDays hari.',
  duel: 'Duel dengan teman (Balap Bakiak, Gasing, Tangkap Layangan): main bareng langsung bila keduanya online, atau tantangan melawan bayangan. Hadiah koin dari sistem (tanpa taruhan) dibayar setelah kedua pemain main; perDay = batas duel per pemain per hari; tantangan yang belum selesai batal otomatis setelah expireHours jam (bawaan 6), dan yang menantang bisa membatalkannya sendiri selama temannya belum main.',
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
