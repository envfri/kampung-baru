// Aturan Catur (shared/catur.ts): perft dari posisi awal & posisi rumit yang terkenal, rokade, en passant (termasuk
// yang terpaku), promosi sambil makan, pat, bahan tidak cukup, pengulangan 3×, 50 langkah, SAN, dan bingkai animasi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  caturFromFEN, caturFEN, caturStart, caturMoves, caturApply, caturFind, caturPerft, caturStatus, caturInsufficient, caturCanMate,
  caturKey, caturSAN, caturFrames, caturIdx, caturSq, caturInCheck, framesMs, type CaturState,
} from '@kb/shared';

const sq = caturIdx;
/** jalankan daftar langkah 'e2e4' / 'e7e8q' (gagal bila tidak sah) */
function play(st: CaturState, list: string) {
  for (const u of list.split(/\s+/).filter(Boolean)) {
    const m = caturFind(st, sq(u.slice(0, 2)), sq(u.slice(2, 4)), u[4]);
    assert.ok(m, `langkah ${u} harus sah di ${caturFEN(st)}`);
    st = caturApply(st, m!).st;
  }
  return st;
}
const uci = (st: CaturState) => caturMoves(st).map((m) => caturSq(m.from) + caturSq(m.to) + (m.promo ?? '')).sort();

test('perft posisi awal: 20 / 400 / 8902', () => {
  const st = caturStart();
  assert.equal(caturFEN(st), 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  assert.equal(caturPerft(st, 1), 20);
  assert.equal(caturPerft(st, 2), 400);
  assert.equal(caturPerft(st, 3), 8902);
});

test('perft posisi rumit: Kiwipete 48 / 2039 / 97862, posisi 3 (en passant terpaku) 14 / 191 / 2812, posisi 4 & 5 (promosi, rokade)', () => {
  const kiwi = caturFromFEN('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
  assert.equal(caturPerft(kiwi, 1), 48);
  assert.equal(caturPerft(kiwi, 2), 2039);
  assert.equal(caturPerft(kiwi, 3), 97862);
  const p3 = caturFromFEN('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1');
  assert.equal(caturPerft(p3, 1), 14);
  assert.equal(caturPerft(p3, 2), 191);
  assert.equal(caturPerft(p3, 3), 2812);
  const p4 = caturFromFEN('r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1');
  assert.equal(caturPerft(p4, 1), 6);
  assert.equal(caturPerft(p4, 2), 264);
  assert.equal(caturPerft(p4, 3), 9467);
  const p5 = caturFromFEN('rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8');
  assert.equal(caturPerft(p5, 1), 44);
  assert.equal(caturPerft(p5, 2), 1486);
  assert.equal(caturPerft(p5, 3), 62379);
});

test('rokade: tidak boleh saat diskak, melewati kotak yang diserang, atau sesudah raja / benteng bergerak atau dimakan', () => {
  // f1 diserang Gajah hitam di c4: O-O tidak boleh, O-O-O boleh
  let st = caturFromFEN('r3k2r/8/8/8/2b5/8/8/R3K2R w KQkq - 0 1');
  assert.ok(!uci(st).includes('e1g1'), 'melewati f1 yang diserang');
  assert.ok(uci(st).includes('e1c1'));
  // b1 diserang tidak menghalangi O-O-O (raja hanya lewat d1 & c1)
  st = caturFromFEN('r3k2r/8/8/8/8/8/8/Rn2K2R w KQkq - 0 1');
  assert.ok(!uci(st).includes('e1c1'), 'b1 terisi kuda');
  st = caturFromFEN('r3k2r/8/8/8/8/8/1r6/R3K2R w KQkq - 0 1');
  assert.ok(uci(st).includes('e1c1'), 'b1 diserang tapi raja tidak lewat b1');
  // sedang diskak: tidak boleh rokade
  st = caturFromFEN('r3k2r/8/8/8/4r3/8/8/R3K2R w KQkq - 0 1');
  assert.ok(caturInCheck(st));
  assert.ok(!uci(st).some((u) => u === 'e1g1' || u === 'e1c1'));
  // mendarat di kotak yang diserang
  st = caturFromFEN('r3k2r/8/8/8/8/8/6r1/R3K2R w KQkq - 0 1');
  assert.ok(!uci(st).includes('e1g1'));
  // benteng dimakan di kotak asalnya: hak rokade sisi itu hilang
  st = caturFromFEN('r3k2r/8/8/8/8/8/6b1/R3K2R b KQkq - 0 1');
  st = play(st, 'g2h1');
  assert.equal(st.cast, 'Qkq');
  // raja bergerak lalu kembali: hak rokade tetap hilang
  st = play(caturFromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), 'e1e2 e8e7 e2e1 e7e8');
  assert.equal(st.cast, '');
  // benteng bergerak: hanya sisinya
  st = play(caturFromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), 'a1a2');
  assert.equal(st.cast, 'Kkq');
  // rokade memindah benteng
  st = play(caturFromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), 'e1g1 e8c8');
  assert.equal(st.b[sq('f1')], 'R'); assert.equal(st.b[sq('h1')], '.'); assert.equal(st.b[sq('d8')], 'r'); assert.equal(st.b[sq('a8')], '.');
});

test('en passant: hanya langkah berikutnya, dan tidak boleh bila pion terpaku (raja jadi terskak mendatar)', () => {
  let st = play(caturStart(), 'e2e4 a7a6 e4e5 d7d5');
  assert.ok(uci(st).includes('e5d6'));
  const after = play(st, 'e5d6');
  assert.equal(after.b[sq('d5')], '.', 'pion d5 dimakan');
  // tidak diambil sekarang = hilang
  st = play(st, 'a2a3 a6a5');
  assert.ok(!uci(st).includes('e5d6'));
  // terpaku mendatar: raja a5, pion b5, pion hitam c7-c5, benteng h5
  st = caturFromFEN('8/2p5/8/KP5r/8/8/8/7k b - - 0 1');
  st = play(st, 'c7c5');
  assert.ok(!uci(st).includes('b5c6'), 'en passant membuka baris ke raja');
  // kunci posisi: kotak en passant hanya dihitung bila benar-benar bisa dimakan
  assert.ok(caturKey(st).endsWith(' -'));
  const ep = play(caturStart(), 'e2e4 a7a6 e4e5 d7d5');
  assert.ok(caturKey(ep).endsWith(' d6'));
});

test('promosi sambil makan (4 pilihan, bawaan Menteri), menutup skak', () => {
  // posisi mockup: Benteng hitam di h8 memberi skak ke raja h2; gxh8 memakan sekaligus menutup
  const st = caturFromFEN('7r/2k3P1/p7/1p1R4/1P6/P4P2/7K/8 w - - 0 41');
  assert.ok(caturInCheck(st));
  const promos = caturMoves(st).filter((m) => m.from === sq('g7') && m.to === sq('h8')).map((m) => m.promo).sort();
  assert.deepEqual(promos, ['b', 'n', 'q', 'r']);
  assert.ok(!caturMoves(st).some((m) => m.from === sq('g7') && m.to === sq('g8')), 'g8 tidak menutup skak');
  const q = caturFind(st, sq('g7'), sq('h8'))!;
  assert.equal(q.promo, 'q', 'tanpa pilihan = Menteri');
  const { st: n, cap } = caturApply(st, caturFind(st, sq('g7'), sq('h8'), 'n')!);
  assert.equal(cap, 'r'); assert.equal(n.b[sq('h8')], 'N');
  assert.equal(caturSAN(st, q), 'gxh8=Q');
  assert.equal(caturFind(st, sq('g7'), sq('h8'), 'x')?.promo, undefined, 'pilihan tidak dikenal ditolak');
});

test('skakmat, pat, bahan tidak cukup, 50 langkah', () => {
  const mate = play(caturStart(), 'f2f3 e7e5 g2g4 d8h4');
  assert.deepEqual(caturStatus(mate), { check: true, end: 'mat' });
  const pat = caturFromFEN('k7/2Q5/1K6/8/8/8/8/8 b - - 0 1');
  assert.deepEqual(caturStatus(pat), { check: false, end: 'pat' });
  for (const fen of ['8/8/4k3/8/8/2K5/8/8 w - - 0 1', '8/8/4k3/8/8/2KB4/8/8 w - - 0 1', '8/8/4k3/8/8/2KN4/8/8 w - - 0 1', '8/2b5/4k3/8/8/2K1B3/8/8 w - - 0 1']) assert.ok(caturInsufficient(caturFromFEN(fen).b), fen);
  // gajah di warna kotak berbeda, dua kuda, pion, benteng: masih bisa
  for (const fen of ['8/3b4/4k3/8/8/2K1B3/8/8 w - - 0 1', '8/8/4k3/8/8/2KNN3/8/8 w - - 0 1', '8/8/4k3/8/8/2KP4/8/8 w - - 0 1', '8/8/4k3/8/8/2KR4/8/8 w - - 0 1']) assert.ok(!caturInsufficient(caturFromFEN(fen).b), fen);
  assert.equal(caturStatus(caturFromFEN('8/8/4k3/8/8/2KB4/8/8 b - - 0 1')).end, 'bidak');
  // waktu habis melawan raja sendirian / R+G / R+K = remis
  assert.equal(caturCanMate(caturFromFEN('8/8/4k3/8/8/2KB4/8/8 w - - 0 1').b, 'b'), false);
  assert.equal(caturCanMate(caturFromFEN('8/8/4k3/8/8/2KB4/8/8 w - - 0 1').b, 'w'), false);
  assert.equal(caturCanMate(caturFromFEN('8/8/4k3/8/8/2KQ4/8/8 w - - 0 1').b, 'w'), true);
  // 50 langkah: 100 paruh langkah tanpa makan / gerak pion
  const fifty = caturFromFEN('8/8/4k3/8/8/2KR4/8/8 w - - 99 80');
  const n = caturApply(fifty, caturFind(fifty, sq('d3'), sq('d4'))!).st;
  assert.equal(n.half, 100);
  assert.equal(caturStatus(n).end, '50');
  assert.equal(caturStatus(n, 0).end, null, 'aturan 50 bisa dimatikan');
  // makan / gerak pion mengulang hitungan
  assert.equal(caturApply(fifty, caturFind(fifty, sq('c3'), sq('c4'))!).st.half, 100);
  const pw = caturFromFEN('8/8/4k3/8/8/2KR4/P7/8 w - - 99 80');
  assert.equal(caturApply(pw, caturFind(pw, sq('a2'), sq('a3'))!).st.half, 0);
});

test('pengulangan: kunci posisi sama setelah kuda bolak-balik dua kali (posisi ke-3)', () => {
  let st = caturStart();
  const seen = new Map<string, number>([[caturKey(st), 1]]);
  for (const u of 'g1f3 g8f6 f3g1 f6g8 g1f3 g8f6 f3g1 f6g8'.split(' ')) {
    st = play(st, u);
    seen.set(caturKey(st), (seen.get(caturKey(st)) ?? 0) + 1);
  }
  assert.equal(seen.get(caturKey(caturStart())), 3);
  // setelah 1.e4 hak rokade sama tapi kotak en passant tidak bisa dimakan → tidak dihitung
  const e4 = play(caturStart(), 'e2e4');
  assert.ok(caturKey(e4).endsWith(' -'));
});

test('SAN & bingkai animasi (geser 220, rokade 300, en passant 300, promosi 350; maks 600 ms)', () => {
  let st = caturStart();
  assert.equal(caturSAN(st, caturFind(st, sq('g1'), sq('f3'))!), 'Nf3');
  // kuda kembar: Nbd2 / N1...
  st = caturFromFEN('4k3/8/8/8/8/5N2/8/1N2K3 w - - 0 1');
  assert.equal(caturSAN(st, caturFind(st, sq('b1'), sq('d2'))!), 'Nbd2');
  st = caturFromFEN('4k3/8/8/8/8/1N6/8/1N2K3 w - - 0 1');
  assert.equal(caturSAN(st, caturFind(st, sq('b1'), sq('d2'))!), 'N1d2');
  const mate = play(caturStart(), 'f2f3 e7e5 g2g4');
  assert.equal(caturSAN(mate, caturFind(mate, sq('d8'), sq('h4'))!), 'Qh4#');
  const oo = caturFromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  assert.equal(caturSAN(oo, caturFind(oo, sq('e1'), sq('g1'))!), 'O-O');
  const f = caturFrames(oo, caturFind(oo, sq('e1'), sq('c1'))!);
  assert.deepEqual(f[0].moves, [[sq('e1'), sq('c1')], [sq('a1'), sq('d1')]]);
  assert.equal(framesMs(f), 300);
  const ep = play(caturStart(), 'e2e4 a7a6 e4e5 d7d5');
  const fe = caturFrames(ep, caturFind(ep, sq('e5'), sq('d6'))!);
  assert.equal(fe[1].kind, 'fade'); assert.equal(fe[1].sq, sq('d5')); assert.equal(framesMs(fe), 300);
  const pr = caturFromFEN('8/2k3P1/8/8/8/8/7K/8 w - - 0 1');
  const fp = caturFrames(pr, caturFind(pr, sq('g7'), sq('g8'), 'r')!);
  assert.equal(fp[1].piece, 'R'); assert.equal(framesMs(fp), 350);
  assert.equal(framesMs(caturFrames(caturStart(), caturFind(caturStart(), sq('e2'), sq('e4'))!)), 220);
});
