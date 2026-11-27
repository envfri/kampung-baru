// Cerdas Cermat Bareng (main bareng 2–4 pemain di rumah teman & Panggung alun-alun): semua pemain melihat soal yang
// sama sekaligus dan menjawab dalam timerSec detik. Server menilai menurut URUTAN DITERIMA: yang pertama benar = 3 poin
// (lonceng), benar lainnya 2, salah 0. Setelah semua menjawab / waktu habis: jawaban & penjelasan tampil revealSec detik,
// lalu soal berikutnya. Timer server memajukan ronde walau ada pemain yang terputus. Sesi di memori (routes/bareng.ts).
import { KUIS_QUICK, kuisCheck, kuisPublic, kuisReveal, kuisTimeMs, parsePick, pickKuis, ULAR_RANK, type KuisQuestion } from '@kb/shared';
import { bad } from './core';

export interface KuisPick { pick: number; at: number; ok: boolean; pts: number; n: number }
export interface KuisRound { qid: string; cat: string; picks: Record<string, KuisPick>; bell: string | null }
export interface KuisBS {
  qs: KuisQuestion[];
  /** ronde sekarang (0..), tahap: tanya = soal tampil & boleh dijawab, jawab = kunci & penjelasan tampil */
  i: number; stage: 'tanya' | 'jawab';
  /** soal tampil (jawaban diterima) mulai `at` sampai `until`; tahap jawab sampai `revealUntil` */
  at: number; until: number; revealUntil: number;
  picks: Record<string, KuisPick>; bell: string | null;
  points: Record<string, number>; correct: Record<string, number>; answered: Record<string, number>;
  rounds: KuisRound[];
  cfg: { timerSec: number; revealMs: number; graceMs: number; leadMs: number };
}
type IO = { now: () => number; note: (l: string) => void; bump: () => void; end: (why: string) => void };
type S = { id: string; players: { id: string; name: string }[]; left: Set<string>; kuis?: KuisBS; moves: number };

/** jeda "Siap…" sebelum tiap soal, supaya semua HP (sinkron ±1 detik) melihat soal bersamaan */
export const KUIS_LEAD_MS = 2000;
/** pilih soal cepat (sekali ketuk) acak untuk satu sesi */
export function kuisBarengPick(pool: KuisQuestion[], n: number) {
  return pickKuis(`bareng:${Date.now()}:${Math.random()}`, pool, n, [3, 3, 1], new Set(), KUIS_QUICK) as KuisQuestion[];
}
const keyOf = (s: S, i: number) => `${s.id}:${i}`;
const active = (s: S) => s.players.filter((p) => !s.left.has(p.id));

export function kuisBegin(s: S, qs: KuisQuestion[], cfg: { timerSec: number; revealSec: number; graceSec: number }, io: IO) {
  const now = io.now();
  const z = Object.fromEntries(s.players.map((p) => [p.id, 0]));
  s.kuis = {
    qs, i: 0, stage: 'tanya', at: now + KUIS_LEAD_MS, until: 0, revealUntil: 0, picks: {}, bell: null,
    points: { ...z }, correct: { ...z }, answered: { ...z }, rounds: [],
    cfg: { timerSec: cfg.timerSec, revealMs: cfg.revealSec * 1000, graceMs: Math.min(2000, cfg.graceSec * 1000), leadMs: KUIS_LEAD_MS },
  };
  s.kuis.until = s.kuis.at + kuisTimeMs(qs[0].type, cfg.timerSec);
  io.note(`Cerdas Cermat dimulai: ${qs.length} soal. Siap-siap!`);
  io.bump();
}

/** jawaban pemain: dinilai menurut urutan diterima server */
export function kuisAct(s: S, uid: string, body: any, io: IO) {
  const k = s.kuis;
  if (!k || k.stage !== 'tanya') throw bad('too_late', 'Waktu menjawab sudah habis.');
  const now = io.now();
  if (now < k.at) throw bad('too_early', 'Tunggu soalnya muncul dulu, ya.');
  if (now > k.until + k.cfg.graceMs) throw bad('too_late', 'Waktu menjawab sudah habis.');
  if (k.picks[uid]) throw bad('answered', 'Kamu sudah menjawab soal ini.');
  const q = k.qs[k.i];
  const pick = parsePick(q, body?.pick);
  if (pick === null || Array.isArray(pick)) throw bad('invalid_pick', 'Jawaban tidak valid.');
  const ok = kuisCheck(q, keyOf(s, k.i), pick);
  const first = ok && k.bell === null;
  const pts = ok ? (first ? 3 : 2) : 0;
  if (first) k.bell = uid;
  k.picks[uid] = { pick, at: now, ok, pts, n: Object.keys(k.picks).length + 1 };
  k.points[uid] = (k.points[uid] ?? 0) + pts;
  k.answered[uid] = (k.answered[uid] ?? 0) + 1;
  if (ok) k.correct[uid] = (k.correct[uid] ?? 0) + 1;
  s.moves++;
  if (first) io.note(`${s.players.find((p) => p.id === uid)?.name ?? 'Teman'} membunyikan lonceng!`);
  if (active(s).every((p) => k.picks[p.id])) reveal(s, io);
  io.bump();
}

function reveal(s: S, io: IO) {
  const k = s.kuis!;
  const now = io.now();
  k.stage = 'jawab';
  k.revealUntil = now + k.cfg.revealMs;
  const q = k.qs[k.i];
  k.rounds.push({ qid: q.id, cat: q.cat, picks: { ...k.picks }, bell: k.bell });
  io.bump();
}

/** pemeriksaan berkala: waktu habis → tampilkan jawaban; tahap jawab habis → soal berikutnya / selesai */
export function kuisTick(s: S, now: number, io: IO) {
  const k = s.kuis;
  if (!k) return;
  if (active(s).length < 2) { if (k.stage === 'tanya' && Object.keys(k.picks).length) reveal(s, io); return io.end('pergi'); }
  if (k.stage === 'tanya') {
    if (now > k.until + k.cfg.graceMs || (now >= k.at && active(s).every((p) => k.picks[p.id]))) reveal(s, io);
    return;
  }
  if (now < k.revealUntil) return;
  if (k.i + 1 >= k.qs.length) return io.end('selesai');
  k.i++;
  k.stage = 'tanya';
  k.picks = {}; k.bell = null;
  k.at = now + k.cfg.leadMs;
  k.until = k.at + kuisTimeMs(k.qs[k.i].type, k.cfg.timerSec);
  io.bump();
}

/** keadaan untuk semua yang ada di tempat itu (pemain & penonton). Kunci jawaban HANYA saat tahap jawab. */
export function kuisView(s: S) {
  const k = s.kuis;
  if (!k) return null;
  const q = k.qs[k.i];
  const base = {
    round: k.i, total: k.qs.length, stage: k.stage, at: k.at, until: k.until, revealUntil: k.revealUntil, timerSec: k.cfg.timerSec,
    q: kuisPublic(q, keyOf(s, k.i)),
    answered: Object.keys(k.picks),
    points: k.points, correct: k.correct,
  };
  if (k.stage === 'tanya') return base;
  const rv = kuisReveal(q, keyOf(s, k.i));
  return { ...base, answer: rv.answer, explain: rv.explain, picks: Object.fromEntries(Object.entries(k.picks).map(([id, p]) => [id, { pick: p.pick, ok: p.ok, pts: p.pts, n: p.n }])), bell: k.bell };
}

/** syarat hadiah: menjawab paling tidak 3 soal (atau semua soal bila kurang dari 3) */
export const kuisGate = (s: S, uid: string) => (s.kuis?.answered[uid] ?? 0) >= Math.min(3, s.kuis?.qs.length ?? 3);

/** peringkat menurut poin (seri = peringkat sama), faktor hadiah main bareng 100/60/40/20% */
export function kuisRanked(s: S) {
  const k = s.kuis;
  const pts = (id: string) => k?.points[id] ?? 0;
  const order = [...s.players].sort((a, b) => pts(b.id) - pts(a.id) || (k?.correct[b.id] ?? 0) - (k?.correct[a.id] ?? 0));
  const out: { p: any; rank: number; score: number; factor: number; left: boolean }[] = [];
  let rank = 0, prev = -1;
  order.forEach((p, i) => {
    if (pts(p.id) !== prev) { rank = i + 1; prev = pts(p.id); }
    const left = s.left.has(p.id);
    out.push({ p, rank, score: pts(p.id), factor: left ? 0 : ULAR_RANK[rank - 1] ?? 0.2, left });
  });
  return out;
}

/** jawaban benar per kategori seorang pemain (untuk lencana Si Pintar) */
export function kuisCorrectCats(s: S, uid: string) {
  return (s.kuis?.rounds ?? []).filter((r) => r.picks[uid]?.ok).map((r) => r.cat);
}
