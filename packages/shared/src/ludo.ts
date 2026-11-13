// Ludo (2–4 pemain): aturan murni, dipakai server (sumber kebenaran) dan game (gambar papan & animasi).
// Papan 15×15: jalur keliling 52 kotak, lajur pulang 5 kotak per warna, rumah di tengah.
// Kemajuan bidak r (relatif kursinya): -1 = di kandang, 0..50 = jalur (0 = kotak start), 51..55 = lajur pulang, 56 = rumah.

/** kursi (warna) searah jarum jam: 0 hijau kiri atas, 1 kuning kanan atas, 2 biru kanan bawah, 3 merah kiri bawah */
export const LUDO_COLORS = ['#3FA06A', '#F2B632', '#3F7FBF', '#E0583F'];
export const LUDO_COLOR_NAMES = ['Hijau', 'Kuning', 'Biru', 'Merah'];
/** kepala bidak per kursi (kotak 24×24): bulat, kotak, belah ketupat, segitiga — warna tidak jadi satu-satunya pembeda */
export const LUDO_HEADS = [
  `<circle cx="12" cy="8.4" r="4.9"/>`,
  `<rect x="7.4" y="3.8" width="9.2" height="9.2" rx="2"/>`,
  `<path d="M12 2.6 17.6 8.4 12 14.2 6.4 8.4Z"/>`,
  `<path d="M12 2.8 17.4 12.8H6.6Z"/>`,
];
export const LUDO_BASE = -1;
export const LUDO_HOME = 56;
/** kemajuan pertama di lajur pulang */
export const LUDO_LANE = 51;
const RING = 52;

// jalur keliling (kolom, baris), mulai dari kotak start hijau, searah jarum jam
const SEG: [[number, number], [number, number]][] = [
  [[1, 6], [5, 6]], [[6, 5], [6, 0]], [[7, 0], [8, 0]], [[8, 1], [8, 5]], [[9, 6], [14, 6]], [[14, 7], [14, 8]], [[13, 8], [9, 8]],
  [[8, 9], [8, 14]], [[7, 14], [6, 14]], [[6, 13], [6, 9]], [[5, 8], [0, 8]], [[0, 7], [0, 7]], [[0, 6], [0, 6]],
];
export const LUDO_PATH: [number, number][] = [];
for (const [[c0, r0], [c1, r1]] of SEG) {
  const n = Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0));
  for (let k = 0; k <= n; k++) LUDO_PATH.push([c0 + Math.sign(c1 - c0) * k, r0 + Math.sign(r1 - r0) * k]);
}
/** lajur pulang tiap kursi (5 kotak, dari luar ke dalam) */
export const LUDO_LANES: [number, number][][] = [
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
];
/** pojok kiri atas kandang (6×6) tiap kursi */
export const LUDO_BASES: [number, number][] = [[0, 0], [9, 0], [9, 9], [0, 9]];
/** 8 kotak aman (indeks jalur): 4 kotak start + 4 kotak bintang (start + 8) */
export const LUDO_SAFE = [0, 8, 13, 21, 26, 34, 39, 47];
/** urutan kursi menurut urutan ikut: dua pemain duduk berseberangan */
export const LUDO_JOIN_SEAT = [0, 2, 1, 3];

/** indeks kotak jalur (0..51) untuk kemajuan r kursi seat; null bila di kandang, lajur pulang, atau rumah */
export function ludoAbs(seat: number, r: number): number | null {
  return r >= 0 && r < LUDO_LANE ? (13 * seat + r) % RING : null;
}
/** kotak papan (kolom, baris) untuk kemajuan r kursi seat; null bila di kandang / rumah */
export function ludoCell(seat: number, r: number): [number, number] | null {
  const a = ludoAbs(seat, r);
  if (a !== null) return LUDO_PATH[a];
  if (r >= LUDO_LANE && r < LUDO_HOME) return LUDO_LANES[seat][r - LUDO_LANE];
  return null;
}
/** kotak aman: start & bintang di jalur, seluruh lajur pulang, dan rumah */
export function ludoSafe(seat: number, r: number) {
  const a = ludoAbs(seat, r);
  return a === null ? r >= LUDO_LANE : LUDO_SAFE.includes(a);
}
/** jumlah bidak per pemain: berdua 4, bertiga/berempat 2 (bisa diatur admin) */
export function ludoTokensFor(players: number, table: Record<string, number> = { 2: 4, 3: 2, 4: 2 }) {
  const n = Math.round(Number(table[String(players)]));
  return n >= 1 && n <= 4 ? n : players <= 2 ? 4 : 2;
}
/** kursi untuk n pemain, diurutkan searah jarum jam (= urutan giliran) */
export const ludoSeats = (n: number) => LUDO_JOIN_SEAT.slice(0, Math.max(0, Math.min(4, n))).sort((a, b) => a - b);

/** tujuan bidak di r dengan dadu roll: keluar kandang perlu 6, masuk rumah harus pas; null = tidak bisa jalan */
export function ludoTarget(r: number, roll: number): number | null {
  if (r === LUDO_BASE) return roll === 6 ? 0 : null;
  if (r >= LUDO_HOME) return null;
  return r + roll <= LUDO_HOME ? r + roll : null;
}

export type LudoTokens = Record<string, number[]>;
export interface LudoMove {
  token: number; from: number; to: number;
  /** bidak lawan yang dimakan (kembali ke kandang) */
  capture: { id: string; k: number; from: number }[];
  home: boolean;
  /** mendarat di kotak aman (bintang / start / lajur pulang) */
  safe: boolean;
}
/** Akibat menjalankan bidak k milik who dengan dadu roll (tanpa mengubah apa pun); null bila tidak boleh. */
export function ludoPlan(tok: LudoTokens, seat: Record<string, number>, who: string, k: number, roll: number): LudoMove | null {
  const mine = tok[who];
  if (!mine || !Number.isInteger(k) || k < 0 || k >= mine.length) return null;
  const from = mine[k], to = ludoTarget(from, roll);
  if (to === null) return null;
  const s = seat[who], abs = ludoAbs(s, to), safe = ludoSafe(s, to);
  const capture: LudoMove['capture'] = [];
  // tanpa benteng: mendarat di kotak biasa memakan semua bidak lawan di kotak itu
  if (abs !== null && !safe) {
    for (const [id, list] of Object.entries(tok)) {
      if (id === who || seat[id] === undefined) continue;
      list.forEach((r, j) => { if (ludoAbs(seat[id], r) === abs) capture.push({ id, k: j, from: r }); });
    }
  }
  return { token: k, from, to, capture, home: to === LUDO_HOME, safe };
}
/** semua langkah sah untuk dadu roll */
export function ludoOptions(tok: LudoTokens, seat: Record<string, number>, who: string, roll: number): LudoMove[] {
  return (tok[who] ?? []).map((_, k) => ludoPlan(tok, seat, who, k, roll)).filter((m): m is LudoMove => !!m);
}
/** Jalankan langkah: keadaan bidak baru (salinan). */
export function ludoApply(tok: LudoTokens, who: string, m: LudoMove): LudoTokens {
  const out: LudoTokens = Object.fromEntries(Object.entries(tok).map(([id, l]) => [id, l.slice()]));
  out[who][m.token] = m.to;
  for (const c of m.capture) out[c.id][c.k] = LUDO_BASE;
  return out;
}
/** pilihan otomatis saat waktu habis: makan > masuk rumah > keluar kandang > kotak aman > bidak terdepan */
export function ludoAutoPick(opts: LudoMove[]): LudoMove | null {
  if (!opts.length) return null;
  const score = (m: LudoMove) => (m.capture.length ? 5 : m.home ? 4 : m.from === LUDO_BASE ? 3 : m.safe ? 2 : 1);
  return [...opts].sort((a, b) => score(b) - score(a) || b.from - a.from || a.token - b.token)[0];
}
/** langkah yang benar-benar berbeda (bidak di kotak yang sama = pilihan yang sama) */
export const ludoDistinct = (opts: LudoMove[]) => opts.filter((m, i) => opts.findIndex((o) => o.from === m.from) === i);

/** hitungan 6 berturut-turut sesudah lemparan; 6 ketiga = lemparan hangus & giliran selesai */
export function ludoRollRule(sixes: number, roll: number) {
  const n = roll === 6 ? sixes + 1 : 0;
  return { sixes: n, void: n >= 3 };
}
/** lempar lagi: dapat 6 (bukan yang ketiga) atau memakan bidak lawan (bila bonus makan aktif); tidak bila semua bidak sudah pulang */
export function ludoAgain(roll: number, sixes: number, m: LudoMove | null, o: { captureBonus?: boolean; done?: boolean } = {}) {
  if (o.done || sixes >= 3) return false;
  return roll === 6 || (!!m?.capture.length && o.captureBonus !== false);
}
/** langkah total bidak untuk peringkat (bidak di rumah = 56, di kandang = 0) */
export const ludoProgress = (list: number[]) => list.reduce((a, r) => a + Math.max(0, Math.min(LUDO_HOME, r)), 0);
export const ludoHomeCount = (list: number[]) => list.filter((r) => r >= LUDO_HOME).length;

/* ---------------- animasi ---------------- */

export interface LudoStep {
  roll: number; token: number | null; from: number; to: number;
  capture: { id: string; k: number; from: number }[];
  home: boolean;
  /** tidak ada bidak yang bisa jalan (giliran lewat) atau 6 ketiga (hangus) */
  pass?: boolean; void?: boolean;
}
/** lama dadu berputar (ms) */
export const LUDO_DICE_MS = 700;
export interface LudoFrame { kind: 'roll' | 'wait' | 'out' | 'step' | 'capture' | 'home' | 'pass'; r: number; ms: number }
/**
 * Bingkai satu langkah: dadu berputar (bila lemparan & langkah sekaligus), jeda singkat untuk langkah otomatis,
 * keluar kandang, maju kotak demi kotak, makan (bidak lawan terbang ke kandang), masuk rumah, atau giliran lewat.
 */
export function ludoFrames(st: LudoStep, o: { dice?: boolean; wait?: boolean; stepMs?: number } = {}): LudoFrame[] {
  const stepMs = Math.max(60, Math.min(600, o.stepMs ?? 190));
  const out: LudoFrame[] = [];
  if (o.dice) out.push({ kind: 'roll', r: st.from, ms: LUDO_DICE_MS });
  if (st.pass || st.void || st.token === null) { out.push({ kind: 'pass', r: st.from, ms: 800 }); return out; }
  if (o.wait) out.push({ kind: 'wait', r: st.from, ms: 300 });
  if (st.from === LUDO_BASE) out.push({ kind: 'out', r: 0, ms: 400 });
  else for (let r = st.from + 1; r <= st.to; r++) out.push({ kind: 'step', r, ms: stepMs });
  if (st.capture.length) out.push({ kind: 'capture', r: st.to, ms: 700 });
  if (st.home) out.push({ kind: 'home', r: st.to, ms: 600 });
  return out;
}
