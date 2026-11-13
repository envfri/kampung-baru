// Game main bareng baru (rumah & alun-alun): Congklak, Ular Tangga Kampung, Balap Karung Live, Catur (catur.ts), Ludo (ludo.ts).
// Aturan dihitung di server; fungsi di sini dipakai server (sumber kebenaran) dan game (gambar papan).

export type BarengGame = 'congklak' | 'ular' | 'karung' | 'catur' | 'ludo';
/** long: game panjang (±10–15 menit): hadiah × bareng.longMult, dan di HP tombol aksi & kartu rumah teman disembunyikan selama main */
export const BARENG_GAMES: Record<BarengGame, { name: string; min: number; max: number; places: ('house' | 'alun')[]; inviteMs: number; turnMs: number; maxMs: number; long?: boolean }> = {
  congklak: { name: 'Congklak', min: 2, max: 2, places: ['house'], inviteMs: 20_000, turnMs: 15_000, maxMs: 20 * 60_000 },
  // finis harus pas (kelebihan = mundur): 4 pemain rata-rata ±5 menit, sesekali sampai ±15 menit
  ular: { name: 'Ular Tangga Kampung', min: 2, max: 4, places: ['house', 'alun'], inviteMs: 20_000, turnMs: 10_000, maxMs: 15 * 60_000 },
  karung: { name: 'Balap Karung Live', min: 2, max: 5, places: ['alun'], inviteMs: 20_000, turnMs: 0, maxMs: 60_000 },
  // Catur Kilat 5+3: jam catur & batas lama permainan diatur di pengaturan catur (lihat apps/server/src/lib/catur-game.ts)
  catur: { name: 'Catur', min: 2, max: 2, places: ['house', 'alun'], inviteMs: 20_000, turnMs: 0, maxMs: 25 * 60_000, long: true },
  // Ludo: berdua 4 bidak, bertiga/berempat 2 bidak (±8–12 menit), batas 15 menit lalu diurutkan menurut langkah (lihat ludo.ts)
  ludo: { name: 'Ludo', min: 2, max: 4, places: ['house', 'alun'], inviteMs: 20_000, turnMs: 10_000, maxMs: 15 * 60_000, long: true },
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
export interface UlarStep {
  from: number; roll: number; to: number; via: 'tangga' | 'ular' | 'warung' | 'becek' | null; finish: boolean;
  /** kotak tempat bidak berhenti sebelum tangga/ular (sesudah mundur bila kelebihan) */
  land: number;
  /** kelebihan langkah dari kotak 36 (bidak memantul mundur sebanyak ini) */
  back: number;
}
/**
 * Satu lemparan. Finis harus pas di kotak 36: kelebihannya dipakai mundur (35 + 3 → 36 → 34),
 * lalu tangga / ular / warung / becek di kotak tempat berhenti tetap berlaku.
 */
export function ularMove(from: number, roll: number): UlarStep {
  const raw = from + roll;
  if (raw === ULAR_SIZE) return { from, roll, to: ULAR_SIZE, via: null, finish: true, land: ULAR_SIZE, back: 0 };
  const back = Math.max(0, raw - ULAR_SIZE);
  const land = back ? ULAR_SIZE - back : raw;
  let to = land;
  let via: UlarStep['via'] = null;
  if (ULAR_LADDERS[to]) { to = ULAR_LADDERS[to]; via = 'tangga'; }
  else if (ULAR_SNAKES[to]) { to = ULAR_SNAKES[to]; via = 'ular'; }
  else if (to === ULAR_WARUNG) { to += 2; via = 'warung'; }
  else if (to === ULAR_BECEK) via = 'becek';
  return { from, roll, to, via, finish: false, land, back };
}
/** posisi kotak n (1..36) di papan 6×6 berliku (1 di kiri bawah), dalam satuan kotak: [kolom, baris dari atas] */
export function ularCell(n: number): [number, number] {
  const r = Math.floor((n - 1) / 6), c = (n - 1) % 6;
  return [r % 2 ? 5 - c : c, 5 - r];
}

/* ---------------- Hadiah ---------------- */
/** pengali hadiah Ular Tangga menurut peringkat (× koin main bareng) */
export const ULAR_RANK = [1, 0.6, 0.4, 0.2];

/* ---------------- animasi langkah demi langkah ---------------- */
// Server menambahkan lama animasi ke batas giliran berikutnya, client memutar langkahnya satu per satu.

export const CONGKLAK_ANIM_MAX = 9000;
export interface CongklakFrame { board: number[]; at: number; hand: number; kind: 'pick' | 'drop' | 'capture' | 'store' | 'sweep'; ms: number }
/** Urutan bingkai satu giliran congklak (ambil biji, jatuhkan satu per satu, ambil lagi, tembak, sapu akhir). */
export function congklakFrames(board0: number[], p: 0 | 1, hole: number): CongklakFrame[] | null {
  if (!Number.isInteger(hole) || hole < 0 || hole > 6) return null;
  const board = board0.slice();
  let i = p === 0 ? hole : 8 + hole;
  if (!board[i]) return null;
  const mine = congklakStore(p), theirs = congklakStore(p === 0 ? 1 : 0);
  const out: CongklakFrame[] = [];
  const push = (at: number, hand: number, kind: CongklakFrame['kind']) => out.push({ board: board.slice(), at, hand, kind, ms: 0 });
  let seeds = board[i];
  board[i] = 0;
  push(i, seeds, 'pick');
  let laps = 0;
  for (;;) {
    while (seeds > 0) {
      i = (i + 1) % 16;
      if (i === theirs) continue;
      board[i]++; seeds--;
      push(i, seeds, 'drop');
    }
    if (i === mine) break;
    if (board[i] > 1 && laps < 40) { seeds = board[i]; board[i] = 0; laps++; push(i, seeds, 'pick'); continue; }
    if (board[i] === 1 && congklakSide(p, i)) {
      const o = 14 - i;
      if (board[o] > 0) {
        const got = board[o] + 1;
        board[o] = 0; board[i] = 0;
        push(o, got, 'capture');
        board[mine] += got;
        push(mine, 0, 'store');
      }
    }
    break;
  }
  const sideA = board.slice(0, 7).reduce((a, b) => a + b, 0), sideB = board.slice(8, 15).reduce((a, b) => a + b, 0);
  if (sideA === 0 || sideB === 0) {
    for (let k = 0; k < 7; k++) { board[7] += board[k]; board[k] = 0; board[15] += board[8 + k]; board[8 + k] = 0; }
    push(mine, 0, 'sweep');
  }
  // tempo: makin banyak biji makin cepat, total tetap wajar
  const drops = out.filter((f) => f.kind === 'drop').length || 1;
  const dropMs = Math.round(Math.max(75, Math.min(230, 6500 / drops)));
  for (const f of out) f.ms = f.kind === 'drop' ? dropMs : f.kind === 'pick' ? dropMs + 260 : f.kind === 'capture' ? 650 : f.kind === 'store' ? 550 : 800;
  // giliran yang sangat panjang (banyak ambil-lagi) dipercepat supaya tidak lebih dari ±9 detik
  const total = out.reduce((a, f) => a + f.ms, 0);
  if (total > CONGKLAK_ANIM_MAX) { const k = CONGKLAK_ANIM_MAX / total; for (const f of out) f.ms = Math.max(35, Math.round(f.ms * k)); }
  return out;
}

export interface UlarFrame { cell: number; kind: 'roll' | 'step' | 'back' | 'climb' | 'slide' | 'warung' | 'becek' | 'finish'; ms: number }
/** Urutan bingkai satu lemparan: dadu berputar, maju kotak demi kotak (mundur bila kelebihan), lalu tangga / ular / warung / becek. */
export function ularFrames(st: UlarStep): UlarFrame[] {
  const out: UlarFrame[] = [{ cell: st.from, kind: 'roll', ms: 700 }];
  // `land` tidak ada pada langkah lama (sebelum aturan mundur): sama dengan kotak tujuan langsung
  const end = st.land ?? Math.min(st.from + st.roll, ULAR_SIZE);
  for (let c = st.from + 1; c <= Math.min(st.from + st.roll, ULAR_SIZE); c++) out.push({ cell: c, kind: 'step', ms: 300 });
  // kelebihan: memantul mundur dari kotak 36
  for (let k = 1; k <= (st.back ?? 0); k++) out.push({ cell: ULAR_SIZE - k, kind: 'back', ms: k === 1 ? 420 : 300 });
  if (st.via === 'tangga') out.push({ cell: st.to, kind: 'climb', ms: 950 });
  else if (st.via === 'ular') out.push({ cell: st.to, kind: 'slide', ms: 1200 });
  else if (st.via === 'warung') { out.push({ cell: end + 1, kind: 'warung', ms: 320 }); out.push({ cell: end + 2, kind: 'warung', ms: 320 }); }
  else if (st.via === 'becek') out.push({ cell: end, kind: 'becek', ms: 600 });
  if (st.finish) out.push({ cell: ULAR_SIZE, kind: 'finish', ms: 600 });
  return out;
}
export const framesMs = (frames: { ms: number }[] | null) => (frames ?? []).reduce((a, f) => a + f.ms, 0);
