// Game main bareng baru (rumah & alun-alun): Congklak, Ular Tangga Kampung, Balap Karung Live.
// Aturan dihitung di server; fungsi di sini dipakai server (sumber kebenaran) dan game (gambar papan).

export type BarengGame = 'congklak' | 'ular' | 'karung';
export const BARENG_GAMES: Record<BarengGame, { name: string; min: number; max: number; places: ('house' | 'alun')[]; inviteMs: number; turnMs: number; maxMs: number }> = {
  congklak: { name: 'Congklak', min: 2, max: 2, places: ['house'], inviteMs: 20_000, turnMs: 15_000, maxMs: 20 * 60_000 },
  ular: { name: 'Ular Tangga Kampung', min: 2, max: 4, places: ['house', 'alun'], inviteMs: 20_000, turnMs: 10_000, maxMs: 10 * 60_000 },
  karung: { name: 'Balap Karung Live', min: 2, max: 5, places: ['alun'], inviteMs: 20_000, turnMs: 0, maxMs: 60_000 },
};

/* ---------------- Congklak ---------------- */
// Papan 16 lubang: 0–6 lubang pemain A (kiri→kanan dari sisi A), 7 = lumbung A, 8–14 lubang pemain B, 15 = lumbung B.
export const CONGKLAK_HOLES = 7;
export const CONGKLAK_SEEDS = 7;
export const congklakStart = () => [...Array(7).fill(CONGKLAK_SEEDS), 0, ...Array(7).fill(CONGKLAK_SEEDS), 0];
export const congklakStore = (p: 0 | 1) => (p === 0 ? 7 : 15);
export const congklakSide = (p: 0 | 1, i: number) => (p === 0 ? i >= 0 && i <= 6 : i >= 8 && i <= 14);
export interface CongklakMove {
  board: number[];
  /** urutan lubang yang diisi (untuk animasi) */
  path: number[];
  /** tembak: lubang lawan yang bijinya diambil */
  capture: number | null;
  /** berhenti di lumbung sendiri: jalan lagi */
  again: boolean;
  /** permainan selesai (satu sisi kosong); sisa biji masuk lumbung pemiliknya */
  over: boolean;
}
/**
 * Satu giliran congklak. Biji dibagi berlawanan arah jarum jam, melewati lumbung lawan.
 * Biji terakhir di lumbung sendiri = jalan lagi; di lubang berisi = ambil semua dan lanjut membagi;
 * di lubang kosong milik sendiri = tembak (ambil biji lubang seberang); di lubang kosong lawan = giliran selesai.
 */
export function congklakPlay(board0: number[], p: 0 | 1, hole: number): CongklakMove | null {
  if (!Number.isInteger(hole) || hole < 0 || hole > 6) return null;
  const board = board0.slice();
  let i = p === 0 ? hole : 8 + hole;
  if (!board[i]) return null;
  const mine = congklakStore(p), theirs = congklakStore(p === 0 ? 1 : 0);
  let seeds = board[i];
  board[i] = 0;
  const path: number[] = [];
  let capture: number | null = null, again = false, laps = 0;
  for (;;) {
    while (seeds > 0) {
      i = (i + 1) % 16;
      if (i === theirs) continue;
      board[i]++; seeds--; path.push(i);
    }
    if (i === mine) { again = true; break; }
    if (board[i] > 1 && laps < 40) { seeds = board[i]; board[i] = 0; laps++; continue; }
    if (board[i] === 1 && congklakSide(p, i)) {
      const o = 14 - i;
      if (board[o] > 0) { board[mine] += board[o] + 1; board[o] = 0; board[i] = 0; capture = o; }
    }
    break;
  }
  const sideA = board.slice(0, 7).reduce((a, b) => a + b, 0), sideB = board.slice(8, 15).reduce((a, b) => a + b, 0);
  const over = sideA === 0 || sideB === 0;
  if (over) {
    for (let k = 0; k < 7; k++) { board[7] += board[k]; board[k] = 0; board[15] += board[8 + k]; board[8 + k] = 0; }
  }
  // jalan lagi tidak berlaku bila sisinya sendiri sudah kosong
  return { board, path, capture, again: again && !over, over };
}
/** lubang yang boleh dipilih pemain p */
export const congklakMoves = (board: number[], p: 0 | 1) => Array.from({ length: 7 }, (_, h) => h).filter((h) => board[p === 0 ? h : 8 + h] > 0);

/* ---------------- Ular Tangga Kampung ---------------- */
export const ULAR_SIZE = 36;
export const ULAR_LADDERS: Record<number, number> = { 4: 16, 7: 20, 23: 34 };
export const ULAR_SNAKES: Record<number, number> = { 33: 21, 27: 12, 30: 19 };
/** Warung: maju 2 kotak · Becek: diam sekali */
export const ULAR_WARUNG = 13, ULAR_BECEK = 26;
export interface UlarStep { from: number; roll: number; to: number; via: 'tangga' | 'ular' | 'warung' | 'becek' | null; finish: boolean }
export function ularMove(from: number, roll: number): UlarStep {
  let to = from + roll;
  if (to >= ULAR_SIZE) return { from, roll, to: ULAR_SIZE, via: null, finish: true };
  let via: UlarStep['via'] = null;
  if (ULAR_LADDERS[to]) { to = ULAR_LADDERS[to]; via = 'tangga'; }
  else if (ULAR_SNAKES[to]) { to = ULAR_SNAKES[to]; via = 'ular'; }
  else if (to === ULAR_WARUNG) { to += 2; via = 'warung'; }
  else if (to === ULAR_BECEK) via = 'becek';
  return { from, roll, to, via, finish: false };
}
/** posisi kotak n (1..36) di papan 6×6 berliku (1 di kiri bawah), dalam satuan kotak: [kolom, baris dari atas] */
export function ularCell(n: number): [number, number] {
  const r = Math.floor((n - 1) / 6), c = (n - 1) % 6;
  return [r % 2 ? 5 - c : c, 5 - r];
}

/* ---------------- Hadiah ---------------- */
/** pengali hadiah Ular Tangga menurut peringkat (× koin main bareng) */
export const ULAR_RANK = [1, 0.6, 0.4, 0.2];
