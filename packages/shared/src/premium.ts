// Set item premium (Mutiara): isi tiap set, efek suasana bila ≥ beberapa item set yang sama ada di satu ruangan,
// dan harga paket (diskon dari jumlah harga item yang belum dimiliki, diatur admin di Ekonomi & fitur › premium).
export interface PremiumSet {
  key: string;
  name: string;
  desc: string;
  /** efek suasana (hanya tampilan) */
  bonus: string;
  /** warna khas set (kartu toko & label suasana) */
  color: string;
  items: string[];
}

export const PREMIUM_SETS: PremiumSet[] = [
  { key: 'tamanmalam', name: 'Set Taman Malam', desc: 'Untuk halaman: kolam koi bercahaya dan lampu-lampu malam.', bonus: 'Senja biru & kunang-kunang', color: '#33427A',
    items: ['tm-kolamkoi', 'tm-pohonlampu', 'tm-lenterastupa', 'tm-jembatan', 'tm-topleskunang', 'fl-batutaman'] },
  { key: 'keraton', name: 'Set Keraton', desc: 'Ruang tamu bangsawan Jawa: ukiran, kuningan, dan batik.', bonus: 'Kilau keemasan', color: '#8E2A1E',
    items: ['kr-gamelan', 'kr-kursiraja', 'kr-gebyok', 'kr-lampukuningan', 'kr-karpetparang', 'wp-kawung'] },
  { key: 'kafe', name: 'Set Kafe Kopi Kampung', desc: 'Pojok ngopi: mesin kopi, meja bar, dan toples kerupuk.', bonus: 'Cahaya hangat & uap kopi', color: '#6B4A2B',
    items: ['kf-mesinkopi', 'kf-mejabar', 'kf-raktoples', 'kf-papanmenu', 'kf-lampuedison', 'fl-terasoemas'] },
  { key: 'pantai', name: 'Set Pantai', desc: 'Kamar tepi pantai: hammock, papan selancar, akuarium ombak.', bonus: 'Sinar matahari pagi', color: '#3F7FBF',
    items: ['pt-hammock', 'pt-kursipantai', 'pt-papanselancar', 'pt-oborbambu', 'pt-akuariumombak', 'fl-pasir'] },
  { key: 'bintang', name: 'Set Kamar Bintang', desc: 'Kamar anak penjelajah angkasa.', bonus: 'Bintang berkelip di seluruh kamar', color: '#2B3A6B',
    items: ['kb-kasurroket', 'kb-proyektor', 'kb-tenda', 'kb-karpetawan', 'kb-rakpelangi', 'wp-langit'] },
];
export const PREMIUM_SET_BY_KEY: Record<string, PremiumSet> = Object.fromEntries(PREMIUM_SETS.map((s) => [s.key, s]));

/** Harga paket: jumlah harga Mutiara item set yang belum dimiliki, dipotong diskon (%), dibulatkan. */
export function bundlePrice(prices: number[], discountPct: number) {
  const total = prices.reduce((a, b) => a + b, 0);
  return { total, price: Math.max(0, Math.round(total * (1 - Math.max(0, Math.min(90, discountPct)) / 100))) };
}

/**
 * Suasana ruangan: set yang punya ≥ min item berbeda di ruangan ini (mebel + dinding + lantai).
 * `setOf` memetakan id item ke kunci set (dari data.set di katalog).
 */
export function roomMood(ids: (string | null | undefined)[], setOf: (id: string) => string | undefined, min = 3): string | null {
  const count = new Map<string, Set<string>>();
  for (const id of ids) {
    if (!id) continue;
    const k = setOf(id);
    if (!k) continue;
    if (!count.has(k)) count.set(k, new Set());
    count.get(k)!.add(id);
  }
  let best: string | null = null, n = 0;
  for (const [k, v] of count) if (v.size >= min && v.size > n) { best = k; n = v.size; }
  return best;
}
