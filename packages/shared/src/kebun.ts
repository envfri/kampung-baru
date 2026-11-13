// Kebun: tingkat kebun (jumlah petak, harga, syarat level pet), kegunaan tiap tingkat,
// dan tata letak petak. Dipakai server (aturan) dan client (gambar & teks) supaya selalu sama.
import { DEFAULT_SETTINGS } from './settings';

export interface GardenLevel { slots: number; coins: number; petLevel: number }

/** Tingkat kebun yang membuka tiap kegunaan (benda di kebun ikut muncul di tingkat ini). */
export const GARDEN_PERK_LEVEL = { scarecrow: 2, waterAll: 3, plantAll: 4, fertileSoil: 5 } as const;

/** Daftar tingkat dari pengaturan `garden` (dibersihkan; tingkat 1 selalu gratis). */
export function gardenLevels(g: any): GardenLevel[] {
  const raw: any[] = Array.isArray(g?.levels) && g.levels.length ? g.levels : DEFAULT_SETTINGS.garden.levels;
  return raw.map((x, i) => ({
    slots: Math.max(1, Math.round(Number(x?.slots) || 6)),
    coins: i ? Math.max(0, Math.round(Number(x?.coins) || 0)) : 0,
    petLevel: i ? Math.max(1, Math.round(Number(x?.petLevel) || 1)) : 1,
  }));
}

/** Keadaan kebun untuk tingkat tersimpan pemain (dibatasi ke tingkat yang ada di pengaturan). */
export function gardenState(g: any, stored: unknown) {
  const levels = gardenLevels(g);
  const level = Math.min(levels.length, Math.max(1, Math.round(Number(stored) || 1)));
  return { level, slots: levels[level - 1].slots, next: (levels[level] ?? null) as GardenLevel | null, levels, max: levels.length };
}

/** Benda baru (`adds`) dan kegunaannya (`effect`) tiap tingkat (indeks = tingkat − 1). */
export function gardenPerks(g: any) {
  const pct = (k: string, d: number) => Math.round(Number(g?.[k] ?? d));
  return [
    { key: 'panen', adds: 'Bedengan 3×2', effect: 'Panen semua sekali ketuk' },
    { key: 'orangan', adds: 'Orang-orangan sawah + pagar bambu', effect: `${pct('scarecrowPct', 10)}% peluang hasil panen +1` },
    { key: 'gentong', adds: 'Gentong air', effect: 'Siram semua tanaman sekali ketuk' },
    { key: 'gubuk', adds: 'Gubuk alat', effect: 'Tanam semua: isi semua petak kosong dengan satu bibit' },
    { key: 'papan', adds: 'Papan nama + bunga pagar', effect: `Tanah subur: semua tanaman tumbuh ${pct('fertileSoilPct', 10)}% lebih cepat` },
  ];
}

/** Lama tumbuh dalam menit → "10 mnt", "1 j 30", "6 jam", "2 hr 3 j". */
export function growText(min: number) {
  const m = Math.max(1, Math.round(min));
  if (m < 60) return `${m} mnt`;
  if (m < 1440) return m % 60 ? `${Math.floor(m / 60)} j ${m % 60}` : `${m / 60} jam`;
  const h = Math.round(m / 60);
  return h % 24 ? `${Math.floor(h / 24)} hr ${h % 24} j` : `${h / 24} hari`;
}

/** Sisa waktu (ms) untuk label petak, paling banyak ±10 huruf: "32 mnt", "3 j 10 mnt", "2 hr 4 j". */
export function plotTimeText(ms: number) {
  if (ms <= 0) return 'siap';
  // toleransi 2 detik supaya tanaman 30 menit yang baru ditanam tertulis "30 mnt", bukan "31 mnt"
  const m = Math.max(1, Math.ceil((ms - 2000) / 60000));
  if (m < 60) return `${m} mnt`;
  if (m < 1440) return `${Math.floor(m / 60)} j ${m % 60} mnt`;
  const h = Math.floor(m / 60);
  return `${Math.floor(h / 24)} hr ${h % 24} j`;
}

/**
 * Tata letak petak di kebun (viewBox lebar 400, atau 800 bila dua bedengan berdampingan).
 * Petak ke-i selalu di baris ⌊i/3⌋ kolom i%3: tingkat baru hanya menambah baris di bawah,
 * tanaman lama tidak pindah. Lv1 (≤6 petak) memakai petak besar; lebih dari itu petak ringkas.
 * `wide` (layar mendatar): bila lebih dari 3 baris, baris 4–6 jadi bedengan kedua di kanan.
 */
export function kebunLayout(n: number, ghost: boolean, wide = false) {
  const rows = Math.max(1, Math.ceil(n / 3));
  const compact = n > 6;
  const pitchY = compact ? 94 : 128, plotH = compact ? 58 : 78, top = 148;
  const two = wide && rows > 3;
  const W = two ? 800 : 400;
  const bedRows = two ? [3, rows - 3] : [rows];
  const bedBottom = (r: number) => top + r * pitchY - (compact ? 8 : 6);
  const ghostH = compact ? 84 : 96;
  const beds = bedRows.map((r, b) => ({ x: 20 + b * 400, rows: r, top: top - 22, bottom: bedBottom(r) }));
  // baris bayangan "Perluas kebun": tepat di posisi baris berikutnya
  let g: null | { x: number; y: number; w: number; h: number } = null;
  if (ghost) {
    const b = two || (wide && rows === 3) ? 1 : 0;
    const r = b ? rows - 3 : rows;
    const y = r ? bedBottom(r) + 10 : top - 22;
    g = { x: 20 + b * 400, y, w: 360, h: ghostH };
  }
  // bila bayangan membuka bedengan kanan (Lv2 di layar mendatar), lebarkan gambar
  const W2 = g && g.x > 300 ? 800 : W;
  const bottom = Math.max(...beds.map((b) => b.bottom), g ? g.y + g.h : 0);
  const y0 = n <= 6 ? 84 : 8; // Lv1 belum punya benda di jalur rumput atas
  return {
    rows, compact, pitchY, plotH, top, W: W2, y0, H: bottom + 14 - y0, beds, ghost: g,
    cell: (i: number) => {
      const row = Math.floor(i / 3), b = two && row >= 3 ? 1 : 0;
      return { x: 40 + b * 400 + (i % 3) * 112, y: top + (row - b * 3) * pitchY };
    },
    base: (y: number) => y + (compact ? 42 : 56),
    plantScale: compact ? 0.86 : 1,
  };
}
