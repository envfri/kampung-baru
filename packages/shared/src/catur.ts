// Catur (2 pemain, rumah & alun-alun): aturan lengkap. Dipakai server (sumber kebenaran) dan game (titik langkah, animasi).
// Papan 64 kotak, indeks = baris × 8 + lajur (a1 = 0, h1 = 7, a8 = 56, h8 = 63).
// Bidak: huruf besar = Putih, kecil = Hitam, '.' = kosong (k Raja, q Menteri, r Benteng, b Gajah, n Kuda, p Pion).

export type CaturColor = 'w' | 'b';
export type CaturPromo = 'q' | 'r' | 'b' | 'n';
export interface CaturState {
  /** 64 kotak */
  b: string[];
  turn: CaturColor;
  /** hak rokade tersisa, mis. 'KQkq' ('' = tidak ada) */
  cast: string;
  /** kotak en passant (−1 = tidak ada) */
  ep: number;
  /** paruh langkah sejak makan / gerak pion terakhir (aturan 50 langkah) */
  half: number;
  /** nomor langkah penuh */
  full: number;
}
export interface CaturMove {
  from: number;
  to: number;
  promo?: CaturPromo;
  /** dbl = pion maju dua, ep = en passant, OO / OOO = rokade pendek / panjang */
  flag?: 'dbl' | 'ep' | 'OO' | 'OOO';
}

export const CATUR_START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
/** nama bidak dalam bahasa Indonesia */
export const CATUR_PIECES: Record<string, string> = { k: 'Raja', q: 'Menteri', r: 'Benteng', b: 'Gajah', n: 'Kuda', p: 'Pion' };
/** nilai bahan (untuk selisih "+n" di samping bidak termakan) */
export const CATUR_VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export const CATUR_PROMOS: CaturPromo[] = ['q', 'r', 'b', 'n'];

const FILES = 'abcdefgh';
export const caturSq = (i: number) => FILES[i % 8] + (Math.floor(i / 8) + 1);
export const caturIdx = (n: string) => {
  const f = FILES.indexOf(n?.[0] ?? ''), r = Number(n?.[1]) - 1;
  return n?.length === 2 && f >= 0 && r >= 0 && r < 8 ? r * 8 + f : -1;
};
export const caturColorOf = (p: string): CaturColor | null => (!p || p === '.' ? null : p === p.toUpperCase() ? 'w' : 'b');
export const caturOther = (c: CaturColor): CaturColor => (c === 'w' ? 'b' : 'w');
const on = (f: number, r: number) => f >= 0 && f < 8 && r >= 0 && r < 8;

export function caturFromFEN(fen: string): CaturState {
  const [pos, turn, cast, ep, half, full] = fen.trim().split(/\s+/);
  const b: string[] = Array(64).fill('.');
  pos.split('/').forEach((row, r) => {
    let f = 0;
    for (const ch of row) { if (/\d/.test(ch)) f += +ch; else { b[(7 - r) * 8 + f] = ch; f++; } }
  });
  return { b, turn: turn === 'b' ? 'b' : 'w', cast: !cast || cast === '-' ? '' : cast, ep: !ep || ep === '-' ? -1 : caturIdx(ep), half: Number(half) || 0, full: Number(full) || 1 };
}
export function caturFEN(st: CaturState) {
  let s = '';
  for (let r = 7; r >= 0; r--) {
    let e = 0;
    for (let f = 0; f < 8; f++) { const p = st.b[r * 8 + f]; if (p === '.') e++; else { if (e) s += e; e = 0; s += p; } }
    if (e) s += e;
    if (r) s += '/';
  }
  return `${s} ${st.turn} ${st.cast || '-'} ${st.ep < 0 ? '-' : caturSq(st.ep)} ${st.half} ${st.full}`;
}
export const caturStart = () => caturFromFEN(CATUR_START);

const KN = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const KG = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** kotak sq diserang bidak warna `by`? */
export function caturAttacked(b: string[], sq: number, by: CaturColor) {
  const f0 = sq % 8, r0 = sq >> 3;
  const is = (f: number, r: number, t: string) => { if (!on(f, r)) return false; const p = b[r * 8 + f]; return p !== '.' && caturColorOf(p) === by && t.includes(p.toLowerCase()); };
  // pion penyerang ada di baris belakang kotak (dari sudut pandang penyerang)
  const d = by === 'w' ? -1 : 1;
  if (is(f0 - 1, r0 + d, 'p') || is(f0 + 1, r0 + d, 'p')) return true;
  for (const [a, c] of KN) if (is(f0 + a, r0 + c, 'n')) return true;
  for (const [a, c] of KG) if (is(f0 + a, r0 + c, 'k')) return true;
  for (const [dirs, t] of [[DIAG, 'bq'], [ORTH, 'rq']] as const) {
    for (const [a, c] of dirs) {
      let f = f0 + a, r = r0 + c;
      while (on(f, r)) {
        const p = b[r * 8 + f];
        if (p !== '.') { if (caturColorOf(p) === by && t.includes(p.toLowerCase())) return true; break; }
        f += a; r += c;
      }
    }
  }
  return false;
}
export const caturKing = (b: string[], c: CaturColor) => b.indexOf(c === 'w' ? 'K' : 'k');
/** raja warna c sedang diskak? */
export function caturInCheck(st: CaturState, c: CaturColor = st.turn) {
  const k = caturKing(st.b, c);
  return k >= 0 && caturAttacked(st.b, k, caturOther(c));
}

/** langkah semu (belum diperiksa apakah raja sendiri jadi terskak) */
function pseudo(st: CaturState): CaturMove[] {
  const out: CaturMove[] = [], b = st.b, me = st.turn, op = caturOther(me);
  const add = (from: number, to: number, pawn: boolean, flag?: CaturMove['flag']) => {
    const r = to >> 3;
    if (pawn && (r === 0 || r === 7)) for (const q of CATUR_PROMOS) out.push({ from, to, promo: q });
    else out.push(flag ? { from, to, flag } : { from, to });
  };
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (p === '.' || caturColorOf(p) !== me) continue;
    const f0 = i % 8, r0 = i >> 3, t = p.toLowerCase();
    if (t === 'p') {
      const d = me === 'w' ? 1 : -1, start = me === 'w' ? 1 : 6;
      if (on(f0, r0 + d) && b[(r0 + d) * 8 + f0] === '.') {
        add(i, (r0 + d) * 8 + f0, true);
        if (r0 === start && b[(r0 + 2 * d) * 8 + f0] === '.') add(i, (r0 + 2 * d) * 8 + f0, true, 'dbl');
      }
      for (const a of [-1, 1]) {
        const f = f0 + a, r = r0 + d;
        if (!on(f, r)) continue;
        const j = r * 8 + f;
        if (b[j] !== '.' && caturColorOf(b[j]) === op) add(i, j, true);
        else if (j === st.ep && b[j] === '.') add(i, j, true, 'ep');
      }
    } else if (t === 'n' || t === 'k') {
      for (const [a, c] of t === 'n' ? KN : KG) {
        const f = f0 + a, r = r0 + c;
        if (on(f, r) && caturColorOf(b[r * 8 + f]) !== me) add(i, r * 8 + f, false);
      }
      if (t === 'k') {
        // rokade (FIDE): raja & benteng belum bergerak, kotak di antaranya kosong, raja tidak sedang diskak,
        // tidak melewati dan tidak berhenti di kotak yang diserang
        const R = me === 'w' ? 0 : 56, K = me === 'w' ? 'K' : 'k', Q = me === 'w' ? 'Q' : 'q', rook = me === 'w' ? 'R' : 'r';
        if (i === R + 4 && !caturAttacked(b, i, op)) {
          if (st.cast.includes(K) && b[R + 7] === rook && b[R + 5] === '.' && b[R + 6] === '.' && !caturAttacked(b, R + 5, op) && !caturAttacked(b, R + 6, op)) out.push({ from: i, to: R + 6, flag: 'OO' });
          if (st.cast.includes(Q) && b[R] === rook && b[R + 3] === '.' && b[R + 2] === '.' && b[R + 1] === '.' && !caturAttacked(b, R + 3, op) && !caturAttacked(b, R + 2, op)) out.push({ from: i, to: R + 2, flag: 'OOO' });
        }
      }
    } else {
      const dirs = t === 'b' ? DIAG : t === 'r' ? ORTH : [...DIAG, ...ORTH];
      for (const [a, c] of dirs) {
        let f = f0 + a, r = r0 + c;
        while (on(f, r)) {
          const q = b[r * 8 + f];
          if (q !== '.' && caturColorOf(q) === me) break;
          add(i, r * 8 + f, false);
          if (q !== '.') break;
          f += a; r += c;
        }
      }
    }
  }
  return out;
}

/** Jalankan langkah (dianggap sah): keadaan baru & bidak yang dimakan (null bila tidak ada). */
export function caturApply(st: CaturState, m: CaturMove): { st: CaturState; cap: string | null } {
  const b = st.b.slice(), me = st.turn, p = b[m.from], t = p.toLowerCase();
  let cap: string | null = b[m.to] !== '.' ? b[m.to] : null;
  b[m.to] = m.promo ? (me === 'w' ? m.promo.toUpperCase() : m.promo) : p;
  b[m.from] = '.';
  if (m.flag === 'ep') { const k = m.to + (me === 'w' ? -8 : 8); cap = b[k]; b[k] = '.'; }
  const R = me === 'w' ? 0 : 56;
  if (m.flag === 'OO') { b[R + 5] = b[R + 7]; b[R + 7] = '.'; }
  if (m.flag === 'OOO') { b[R + 3] = b[R]; b[R] = '.'; }
  // hak rokade hilang bila raja bergerak, atau benteng bergerak / dimakan di kotak asalnya
  let cast = st.cast;
  if (t === 'k') cast = cast.replace(me === 'w' ? /[KQ]/g : /[kq]/g, '');
  for (const [sq, c] of [[0, 'Q'], [7, 'K'], [56, 'q'], [63, 'k']] as const) if (m.from === sq || m.to === sq) cast = cast.replace(c, '');
  return {
    st: { b, turn: caturOther(me), cast, ep: m.flag === 'dbl' ? (m.from + m.to) / 2 : -1, half: t === 'p' || cap ? 0 : st.half + 1, full: st.full + (me === 'b' ? 1 : 0) },
    cap,
  };
}

/** Semua langkah sah untuk pihak yang jalan (langkah yang membuat raja sendiri terskak tidak ada). */
export function caturMoves(st: CaturState): CaturMove[] {
  return pseudo(st).filter((m) => !caturInCheck(caturApply(st, m).st, st.turn));
}
/** langkah sah dari `from` ke `to` (promosi: bawaan Menteri) */
export function caturFind(st: CaturState, from: number, to: number, promo?: string): CaturMove | null {
  const want = promo ?? 'q';
  return caturMoves(st).find((m) => m.from === from && m.to === to && (!m.promo || m.promo === want)) ?? null;
}
/** jumlah posisi daun pada kedalaman `depth` (uji generator langkah) */
export function caturPerft(st: CaturState, depth: number): number {
  if (depth <= 0) return 1;
  const ms = caturMoves(st);
  if (depth === 1) return ms.length;
  let n = 0;
  for (const m of ms) n += caturPerft(caturApply(st, m).st, depth - 1);
  return n;
}

const sqColor = (i: number) => ((i % 8) + (i >> 3)) % 2;
/**
 * Bahan tidak cukup untuk skakmat (remis otomatis): R v R, R+G v R, R+K v R,
 * dan Raja + Gajah-gajah lawan Raja + Gajah-gajah yang semuanya di warna kotak yang sama.
 */
export function caturInsufficient(b: string[]) {
  const rest: { p: string; i: number }[] = [];
  for (let i = 0; i < 64; i++) if (b[i] !== '.' && b[i].toLowerCase() !== 'k') rest.push({ p: b[i].toLowerCase(), i });
  if (rest.length === 0) return true;
  if (rest.length === 1 && (rest[0].p === 'b' || rest[0].p === 'n')) return true;
  return rest.every((x) => x.p === 'b') && new Set(rest.map((x) => sqColor(x.i))).size === 1;
}
/** Bahan warna c cukup untuk (mungkin) memberi skakmat? Hanya Raja, Raja + Gajah, atau Raja + Kuda = tidak. */
export function caturCanMate(b: string[], c: CaturColor) {
  const mine = b.filter((p) => p !== '.' && caturColorOf(p) === c && p.toLowerCase() !== 'k').map((p) => p.toLowerCase());
  return !(mine.length === 0 || (mine.length === 1 && (mine[0] === 'b' || mine[0] === 'n')));
}

/** Kunci posisi untuk pengulangan 3×: papan, giliran, hak rokade, dan kotak en passant (hanya bila benar-benar bisa dimakan). */
export function caturKey(st: CaturState) {
  const ep = st.ep >= 0 && caturMoves(st).some((m) => m.flag === 'ep') ? caturSq(st.ep) : '-';
  return `${st.b.join('')} ${st.turn} ${st.cast || '-'} ${ep}`;
}

/** Keadaan sesudah langkah: skak, dan akhir otomatis (skakmat, pat, bahan tidak cukup, 50 langkah). */
export function caturStatus(st: CaturState, fiftyAt = 100): { check: boolean; end: 'mat' | 'pat' | 'bidak' | '50' | null } {
  const check = caturInCheck(st);
  const none = caturMoves(st).length === 0;
  if (none) return { check, end: check ? 'mat' : 'pat' };
  if (caturInsufficient(st.b)) return { check, end: 'bidak' };
  if (fiftyAt > 0 && st.half >= fiftyAt) return { check, end: '50' };
  return { check, end: null };
}

/** Notasi SAN (Nf3, exd5, O-O, e8=Q+, Rxh1#) untuk daftar langkah. */
export function caturSAN(st: CaturState, m: CaturMove) {
  let s: string;
  if (m.flag === 'OO') s = 'O-O';
  else if (m.flag === 'OOO') s = 'O-O-O';
  else {
    const p = st.b[m.from], t = p.toLowerCase(), cap = st.b[m.to] !== '.' || m.flag === 'ep';
    if (t === 'p') s = (cap ? caturSq(m.from)[0] + 'x' : '') + caturSq(m.to) + (m.promo ? '=' + m.promo.toUpperCase() : '');
    else {
      s = t.toUpperCase();
      const twins = caturMoves(st).filter((x) => x.to === m.to && x.from !== m.from && st.b[x.from] === p);
      if (twins.length) {
        const sameFile = twins.some((x) => x.from % 8 === m.from % 8), sameRank = twins.some((x) => x.from >> 3 === m.from >> 3);
        s += !sameFile ? caturSq(m.from)[0] : !sameRank ? caturSq(m.from)[1] : caturSq(m.from);
      }
      s += (cap ? 'x' : '') + caturSq(m.to);
    }
  }
  const n = caturApply(st, m).st;
  return s + (caturInCheck(n) ? (caturMoves(n).length ? '+' : '#') : '');
}

/* ---------------- animasi ---------------- */
// Server menambahkan lama animasi sebelum jam lawan mulai berjalan; client memutar bingkainya.
export interface CaturFrame {
  kind: 'slide' | 'fade' | 'morph';
  ms: number;
  /** slide: pasangan [dari, ke] yang bergerak bersamaan (rokade: raja & benteng) */
  moves?: [number, number][];
  /** fade: kotak bidak yang hilang (pion en passant); morph: kotak pion yang naik pangkat */
  sq?: number;
  /** morph: bidak baru */
  piece?: string;
}
/** Bingkai satu langkah: geser 220 ms; rokade 300 ms; en passant geser lalu pion pudar (300 ms); promosi geser lalu berubah (350 ms). */
export function caturFrames(st: CaturState, m: CaturMove): CaturFrame[] {
  const R = st.turn === 'w' ? 0 : 56;
  if (m.flag === 'OO') return [{ kind: 'slide', ms: 300, moves: [[m.from, m.to], [R + 7, R + 5]] }];
  if (m.flag === 'OOO') return [{ kind: 'slide', ms: 300, moves: [[m.from, m.to], [R, R + 3]] }];
  if (m.flag === 'ep') return [{ kind: 'slide', ms: 200, moves: [[m.from, m.to]] }, { kind: 'fade', ms: 100, sq: m.to + (st.turn === 'w' ? -8 : 8) }];
  if (m.promo) return [{ kind: 'slide', ms: 220, moves: [[m.from, m.to]] }, { kind: 'morph', ms: 130, sq: m.to, piece: st.turn === 'w' ? m.promo.toUpperCase() : m.promo }];
  return [{ kind: 'slide', ms: 220, moves: [[m.from, m.to]] }];
}

/** jumlah nilai bahan dari daftar bidak termakan */
export const caturMaterial = (caps: string[]) => caps.reduce((a, p) => a + (CATUR_VAL[p.toLowerCase()] ?? 0), 0);
