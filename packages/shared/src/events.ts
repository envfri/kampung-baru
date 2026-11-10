// Event musiman: dekorasi, sumber poin, dan template siap pakai untuk admin.

export const EVENT_DECOR: [string, string][] = [
  ['', 'Tanpa dekorasi'],
  ['bendera', 'Bendera merah putih'],
  ['lampion', 'Lampion merah'],
  ['ketupat', 'Ketupat & bulan sabit'],
  ['kembangapi', 'Kembang api'],
  ['hujan', 'Musim hujan'],
  ['bunga', 'Kelopak bunga'],
];

/** Peristiwa yang memberi poin event. Kunci = nama peristiwa yang dicatat server. */
export const EVENT_POINT_SOURCES: [string, string][] = [
  ['game_finish', 'Main mini-game di Balai Main (per permainan)'],
  ['game_event_drop', 'Tangkap benda event di Panen Buah (per benda)'],
  ['race', 'Ikut Lomba Karung'],
  ['fish', 'Tangkap ikan'],
  ['visit', 'Kunjungi rumah teman'],
  ['gift_sent', 'Kirim hadiah ke teman'],
  ['harvest', 'Panen kebun'],
  ['quest_claim', 'Selesaikan tugas'],
  ['daily_claim', 'Ambil hadiah harian'],
  ['purchase', 'Belanja di toko'],
];

export interface EventMilestone {
  points: number;
  coin?: number;
  pearl?: number;
  item?: string;
  qty?: number;
}

export interface EventTemplate {
  key: string;
  label: string;
  name: string;
  description: string;
  color: string;
  decor: string;
  multiplier: number;
  tokenName: string;
  /** Tanggal mulai tiap tahun (bulan 1–12, tanggal) — kosong untuk hari raya berbasis kalender hijriah/imlek. */
  start?: [number, number];
  days: number;
  repeatYearly: boolean;
  points: Record<string, number>;
  milestones: EventMilestone[];
}

const P = (o: Record<string, number>) => o;
export const EVENT_TEMPLATES: EventTemplate[] = [
  {
    key: 'agustusan', label: 'Agustusan (17 Agustus)', name: 'Pekan Merdeka Kampung', color: '#E0583F', decor: 'bendera', multiplier: 1.2, tokenName: 'Bendera',
    description: 'Kampung berhias merah putih! Ikut lomba, kumpulkan bendera, dan tukar dengan hadiah kemerdekaan.',
    start: [8, 10], days: 14, repeatYearly: true,
    points: P({ game_finish: 10, game_event_drop: 2, race: 8, visit: 5, daily_claim: 10 }),
    milestones: [{ points: 50, coin: 100 }, { points: 150, item: 'kupluk-merahputih' }, { points: 300, item: 'karpet-merahputih' }, { points: 500, pearl: 5 }],
  },
  {
    key: 'ramadan', label: 'Ramadan', name: 'Ramadan Ceria', color: '#3FA06A', decor: 'ketupat', multiplier: 1.1, tokenName: 'Ketupat',
    description: 'Bulan penuh berkah. Berbagi hadiah dengan teman dan kumpulkan ketupat untuk hadiah spesial.',
    days: 30, repeatYearly: false,
    points: P({ gift_sent: 8, visit: 6, game_finish: 8, game_event_drop: 2, daily_claim: 10 }),
    milestones: [{ points: 60, item: 'ketupat', qty: 5 }, { points: 180, item: 'peci-lebaran' }, { points: 360, item: 'lampion-merah' }, { points: 600, pearl: 5 }],
  },
  {
    key: 'lebaran', label: 'Lebaran', name: 'Lebaran di Kampung', color: '#2F7F55', decor: 'ketupat', multiplier: 1.3, tokenName: 'Ketupat',
    description: 'Mohon maaf lahir dan batin! Silaturahmi ke rumah teman untuk ketupat ekstra.',
    days: 7, repeatYearly: false,
    points: P({ visit: 12, gift_sent: 10, game_finish: 8, game_event_drop: 2, daily_claim: 15 }),
    milestones: [{ points: 40, coin: 150 }, { points: 120, item: 'peci-lebaran' }, { points: 240, item: 'ketupat', qty: 10 }, { points: 400, pearl: 6 }],
  },
  {
    key: 'imlek', label: 'Imlek', name: 'Imlek di Kampung', color: '#C0392B', decor: 'lampion', multiplier: 1.2, tokenName: 'Angpau',
    description: 'Lampion merah menghiasi kampung. Kumpulkan angpau dari mini-game dan lomba!',
    days: 10, repeatYearly: false,
    points: P({ game_finish: 10, game_event_drop: 2, race: 6, harvest: 4, daily_claim: 10 }),
    milestones: [{ points: 50, coin: 120 }, { points: 150, item: 'lampion-merah' }, { points: 320, pearl: 4 }],
  },
  {
    key: 'tahunbaru', label: 'Tahun Baru', name: 'Malam Tahun Baru', color: '#3F5FBF', decor: 'kembangapi', multiplier: 1.25, tokenName: 'Bintang',
    description: 'Kembang api di langit kampung! Main bareng teman dan sambut tahun baru dengan hadiah.',
    start: [12, 28], days: 7, repeatYearly: true,
    points: P({ game_finish: 10, game_event_drop: 2, visit: 6, quest_claim: 8, daily_claim: 10 }),
    milestones: [{ points: 50, coin: 120 }, { points: 150, item: 'topi-tahunbaru' }, { points: 300, pearl: 5 }],
  },
  {
    key: 'hujan', label: 'Musim Hujan', name: 'Musim Hujan Tiba', color: '#3F7FBF', decor: 'hujan', multiplier: 1.1, tokenName: 'Tetes air',
    description: 'Hujan turun, kebun subur! Panen lebih sering dan kumpulkan tetes air.',
    start: [12, 1], days: 30, repeatYearly: true,
    points: P({ harvest: 6, fish: 3, game_finish: 8, game_event_drop: 2, daily_claim: 8 }),
    milestones: [{ points: 60, coin: 100 }, { points: 180, item: 'payung-taman' }, { points: 360, pearl: 4 }],
  },
  {
    key: 'bunga', label: 'Pekan Bunga', name: 'Pekan Bunga Kampung', color: '#E7A1C9', decor: 'bunga', multiplier: 1.15, tokenName: 'Kelopak',
    description: 'Kelopak bunga berterbangan. Rawat kebun dan hias rumah untuk kelopak ekstra.',
    days: 10, repeatYearly: false,
    points: P({ harvest: 6, purchase: 3, game_finish: 8, game_event_drop: 2, daily_claim: 8 }),
    milestones: [{ points: 50, coin: 100 }, { points: 150, item: 'kalung-bunga' }, { points: 300, pearl: 4 }],
  },
];
