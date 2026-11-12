// Game main bareng baru: Congklak (rumah, 2 pemain), Ular Tangga Kampung (rumah & alun-alun, 2–4),
// Balap Karung Live (alun-alun, 2–5). Sesi disimpan di memori per tempat (rumah / alun-alun); semua langkah,
// dadu, dan hasil dihitung di server. Keadaan sesi dikirim lewat sinkron rumah & alun-alun (`games`).
import type { FastifyInstance } from 'fastify';
import { randomInt, randomUUID } from 'node:crypto';
import {
  BARENG_GAMES, congklakStart, congklakPlay, congklakFrames, framesMs, ularFrames, congklakMoves, ularMove, ULAR_RANK, KARUNG_HOPS, KARUNG_MAX_TAPS_PER_SEC,
  applyNeedDelta, type BarengGame,
} from '@kb/shared';
import type { Db } from '../db/index';
import { bad, bumpCounter, coinMultiplier, counter, credit, forbidden, getCatalog, getSettings, notFound, track } from '../lib/core';
import { requireUser } from '../lib/auth';
import { lockPet, savePet, currentNeeds, isAsleep, isSick } from '../lib/state';
import { grantXp } from './game';
import { houseLive } from './house';
import { squareLiveOf, squareMembers } from './square';

type Player = { id: string; name: string; pet: any };
type Result = { id: string; name: string; rank: number; score?: number; timeMs?: number | null; coins: number; xp: number; capped: boolean; left?: boolean };
type Session = {
  id: string; game: BarengGame; place: string; phase: 'ajak' | 'siap' | 'main' | 'selesai';
  starter: string; players: Player[]; inviteUntil: number; createdAt: number;
  startedAt: number; endedAt: number; seq: number; moves: number; why: string;
  left: Set<string>; absentSince: Map<string, number>;
  turn: number; turnUntil: number; last: any; log: string[];
  // congklak
  board: number[];
  // ular
  pos: Record<string, number>; skip: Record<string, boolean>; finished: string[];
  // karung
  race: { startAt: number; endAt: number; prog: Record<string, number>; done: Record<string, number | null>; out: string[] } | null;
  results: Result[] | null; settled: boolean;
};

const SESSIONS = new Map<string, Session>();
const UUID = /^[0-9a-f-]{36}$/i;
/** pemain yang menghilang (tidak sinkron) lebih lama dari ini dianggap keluar */
const ABSENT_MS = 15_000;
const KARUNG_COUNTDOWN = 3500, KARUNG_LIMIT = 40_000;
let clock = () => Date.now();
/** Untuk uji: atur jam & kosongkan sesi. */
export function setBarengClock(fn: () => number) { clock = fn; }
export function resetBareng() { SESSIONS.clear(); }
let runTick: (() => Promise<void>) | null = null;
/** Untuk uji: jalankan pemeriksaan berkala sekarang (giliran otomatis, persiapan karung, hadiah). */
export const barengTick = () => runTick?.();

const live = (place: string) => (place.startsWith('h:') ? houseLive(place.slice(2)) : squareMembers(Number(place.slice(2))));
const isHere = (place: string, uid: string) => live(place).some((m) => m.id === uid);
const active = (s: Session) => s.players.filter((p) => !s.left.has(p.id));
const nameOf = (s: Session, id: string) => s.players.find((p) => p.id === id)?.name ?? 'Teman';

function view(s: Session) {
  const base = {
    id: s.id, game: s.game, phase: s.phase, starter: s.starter, seq: s.seq, players: s.players.map((p) => ({ ...p, left: s.left.has(p.id) })),
    min: BARENG_GAMES[s.game].min, max: BARENG_GAMES[s.game].max, inviteUntil: s.inviteUntil, startedAt: s.startedAt, endedAt: s.endedAt,
    turn: s.phase === 'main' && s.game !== 'karung' ? s.players[s.turn]?.id ?? null : null, turnUntil: s.turnUntil, last: s.last, log: s.log.slice(-4),
    results: s.results, why: s.why, serverNow: clock(),
  };
  if (s.game === 'congklak') return { ...base, board: s.board };
  if (s.game === 'ular') return { ...base, pos: s.pos, skip: s.skip, finished: s.finished };
  return { ...base, race: s.race ? { startAt: s.race.startAt, endAt: s.race.endAt, prog: s.race.prog, done: s.race.done, out: s.race.out } : null };
}
/** Sesi di satu tempat (untuk respons sinkron rumah / alun-alun). */
export function barengViews(place: string) {
  const now = clock();
  const out: any[] = [];
  for (const s of SESSIONS.values()) {
    if (s.place !== place) continue;
    tick(s, now);
    out.push(view(s));
  }
  return out;
}

function bump(s: Session) { s.seq++; }
function note(s: Session, line: string) { s.log.push(line); if (s.log.length > 12) s.log.shift(); }

function end(s: Session, why: string) {
  if (s.phase === 'selesai') return;
  s.phase = 'selesai'; s.endedAt = clock(); s.why = why;
  bump(s);
}
function nextTurn(s: Session) {
  const n = s.players.length;
  for (let k = 1; k <= n; k++) {
    const i = (s.turn + k) % n, p = s.players[i];
    if (s.left.has(p.id) || (s.game === 'ular' && s.finished.includes(p.id))) continue;
    s.turn = i;
    s.turnUntil = clock() + BARENG_GAMES[s.game].turnMs;
    return;
  }
}
function begin(s: Session) {
  const now = clock();
  s.phase = 'main'; s.startedAt = now; s.turn = 0;
  if (s.game === 'congklak') {
    s.board = congklakStart();
    s.turn = randomInt(0, 2);
    note(s, `${s.players[s.turn].name} jalan duluan.`);
  } else if (s.game === 'ular') {
    for (const p of s.players) s.pos[p.id] = 0;
    note(s, `${s.players[0].name} melempar dadu duluan.`);
  }
  s.turnUntil = now + BARENG_GAMES[s.game].turnMs;
  bump(s);
}

/* ---------------- langkah ---------------- */

function congklakMove(s: Session, hole: number, auto = false) {
  const p = s.turn as 0 | 1;
  const r = congklakPlay(s.board, p, hole);
  if (!r) throw bad('invalid_move', 'Lubang itu kosong. Pilih lubang lain di barismu.');
  // lama animasi biji dibagi satu per satu: ditambahkan ke batas giliran berikutnya
  const anim = framesMs(congklakFrames(s.board, p, hole));
  s.board = r.board; s.moves++;
  s.last = { by: s.players[p].id, hole, path: r.path.slice(0, 400), capture: r.capture, again: r.again, auto, at: clock(), anim };
  if (r.capture !== null) note(s, `${s.players[p].name} menembak biji lawan!`);
  if (r.over) {
    const [a, b] = [s.board[7], s.board[15]];
    note(s, a === b ? 'Seri!' : `${s.players[a > b ? 0 : 1].name} menang ${Math.max(a, b)}–${Math.min(a, b)}.`);
    end(s, 'selesai');
    return;
  }
  if (r.again) { s.turnUntil = clock() + BARENG_GAMES.congklak.turnMs; note(s, `${s.players[p].name} jalan lagi.`); }
  else nextTurn(s);
  s.turnUntil += anim;
  bump(s);
}
function ularRoll(s: Session, auto = false) {
  const me = s.players[s.turn];
  const roll = randomInt(1, 7);
  const st = ularMove(s.pos[me.id] ?? 0, roll);
  const anim = framesMs(ularFrames(st));
  s.pos[me.id] = st.to; s.moves++;
  s.last = { by: me.id, ...st, auto, at: clock(), anim };
  const say: Record<string, string> = { tangga: `naik tangga bambu! ${st.from + st.roll} → ${st.to}`, ular: `digigit ular sawah, turun ${st.from + st.roll} → ${st.to}`, warung: 'mampir warung, maju 2 kotak', becek: 'masuk becek, diam sekali' };
  note(s, `${me.name} dapat ${roll}${st.via ? `, ${say[st.via]}` : ''}.`);
  if (st.via === 'becek') s.skip[me.id] = true;
  if (st.finish) { s.finished.push(me.id); note(s, `${me.name} sampai finis! Juara ${s.finished.length}.`); }
  const left = active(s).filter((p) => !s.finished.includes(p.id));
  if (left.length <= 1) { end(s, 'selesai'); return; }
  // giliran berikutnya; yang kena becek dilewati sekali
  for (let guard = 0; guard < 8; guard++) {
    nextTurn(s);
    const p = s.players[s.turn];
    if (!s.skip[p.id]) break;
    s.skip[p.id] = false;
    note(s, `${p.name} masih membersihkan becek, giliran dilewati.`);
  }
  // pemain berikutnya tidak kehilangan waktu selama bidak sebelumnya berjalan
  s.turnUntil += anim;
  bump(s);
}

/** Pemeriksaan berkala: ajakan habis, giliran habis (langkah otomatis), pemain menghilang, batas waktu. */
function tick(s: Session, now = clock()) {
  if (s.phase === 'selesai') {
    if (s.settled && now - s.endedAt > 30_000) SESSIONS.delete(s.id);
    return;
  }
  const here = new Set(live(s.place).map((m) => m.id));
  for (const p of s.players) {
    if (s.left.has(p.id)) continue;
    if (here.has(p.id)) { s.absentSince.delete(p.id); continue; }
    const since = s.absentSince.get(p.id) ?? now;
    s.absentSince.set(p.id, since);
    if (now - since > ABSENT_MS) { s.left.add(p.id); note(s, `${p.name} pergi.`); bump(s); }
  }
  const g = BARENG_GAMES[s.game];
  if (s.phase === 'ajak') {
    if (s.left.has(s.starter)) return end(s, 'batal');
    s.players = s.players.filter((p) => !s.left.has(p.id));
    if (now >= s.inviteUntil) { if (s.players.length >= g.min) start(s); else end(s, 'sepi'); }
    return;
  }
  if (s.phase === 'siap') return;
  if (now - s.startedAt > g.maxMs + (s.game === 'karung' ? KARUNG_COUNTDOWN : 0)) return end(s, 'waktu');
  if (s.game === 'karung') {
    const r = s.race!;
    const racing = active(s).filter((p) => !r.out.includes(p.id));
    if (now >= r.endAt || racing.every((p) => p.id in r.done)) end(s, 'selesai');
    return;
  }
  if (active(s).length < 2 && s.game === 'congklak') return end(s, 'pergi');
  if (s.game === 'ular' && active(s).filter((p) => !s.finished.includes(p.id)).length <= 1) return end(s, 'pergi');
  const cur = s.players[s.turn];
  if (s.left.has(cur.id)) { nextTurn(s); bump(s); return; }
  if (now >= s.turnUntil) {
    if (s.game === 'congklak') { const mv = congklakMoves(s.board, s.turn as 0 | 1); congklakMove(s, mv[randomInt(0, mv.length)], true); }
    else ularRoll(s, true);
  }
}
/** ajakan selesai: mulai (karung perlu persiapan di server: energi & jatah harian) */
function start(s: Session) {
  if (s.game === 'karung') { s.phase = 'siap'; bump(s); return; }
  begin(s);
}

/* ---------------- rute ---------------- */

export default async function barengRoutes(app: FastifyInstance, { db }: { db: Db }) {
  const auth = { preHandler: requireUser(db) };

  async function blockedAmong(uid: string, ids: string[]) {
    const list = ids.filter((x) => x !== uid);
    if (!list.length) return false;
    return !!(await db.one(`select 1 from blocks where (user_id = $1 and blocked_id = any($2::uuid[])) or (blocked_id = $1 and user_id = any($2::uuid[])) limit 1`, [uid, list]));
  }
  /** Balap karung memakai energi & jatah Lomba Karung seperti lomba biasa. */
  async function karungReady(uid: string) {
    const s = await getSettings(db);
    if (!s.features.karung) throw forbidden('Lomba karung sedang ditutup.');
    const pet = await db.one<any>(`select * from pets where user_id = $1`, [uid]);
    if (!pet) throw bad('no_pet', 'Buat pet dulu.');
    if (isAsleep(pet, s)) throw bad('asleep', `${pet.name} sedang tidur.`);
    if (isSick(pet, s)) throw bad('sick', `${pet.name} sedang sakit. Minum jamu dulu, ya.`);
    if (currentNeeds(pet, s).energi < s.karung.energiCost) throw bad('tired', `${pet.name} terlalu capek untuk lomba. Tidur dulu.`);
    if ((await counter(db, uid, 'karung')) >= s.karung.playsPerDay) throw bad('daily_limit', 'Jatah lomba karung hari ini sudah habis.');
  }
  function placeOf(uid: string, b: any, game: BarengGame) {
    const g = BARENG_GAMES[game];
    if (b.hostId) {
      const host = String(b.hostId);
      if (!UUID.test(host)) throw bad('invalid', 'Rumah tidak valid.');
      if (!g.places.includes('house')) throw bad('wrong_place', `${g.name} dimainkan di Alun-alun.`);
      if (!isHere(`h:${host}`, uid)) throw bad('not_here', 'Masuk ke rumah itu dulu, ya.');
      return `h:${host}`;
    }
    if (!g.places.includes('alun')) throw bad('wrong_place', `${g.name} dimainkan di rumah.`);
    const sq = squareLiveOf(uid);
    if (!sq) throw bad('not_here', 'Masuk ke Alun-alun dulu, ya.');
    return `a:${sq.inst}`;
  }
  const me = (place: string, uid: string) => live(place).find((m) => m.id === uid);

  /** Mulai ajakan main (yang lain di tempat itu melihat ajakan & memilih Ikut). */
  app.post('/api/bareng/start', { ...auth, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req: any) => {
    const uid = req.user!.id;
    const game = String(req.body?.game ?? '') as BarengGame;
    if (!(game in BARENG_GAMES)) throw bad('invalid', 'Permainan tidak dikenal.');
    const place = placeOf(uid, req.body ?? {}, game);
    for (const s of SESSIONS.values()) {
      if (s.place !== place || s.game !== game || s.phase === 'selesai') continue;
      tick(s);
      if (s.phase === 'ajak') return join(s, uid, req);
      throw bad('busy', `Masih ada yang main ${BARENG_GAMES[game].name} di sini. Tunggu selesai, ya.`);
    }
    if (game === 'karung') await karungReady(uid);
    const p = me(place, uid)!;
    const now = clock();
    const s: Session = {
      id: randomUUID(), game, place, phase: 'ajak', starter: uid, players: [p], inviteUntil: now + BARENG_GAMES[game].inviteMs, createdAt: now,
      startedAt: 0, endedAt: 0, seq: 1, moves: 0, why: '', left: new Set(), absentSince: new Map(), turn: 0, turnUntil: 0, last: null, log: [],
      board: [], pos: {}, skip: {}, finished: [], race: null, results: null, settled: false,
    };
    SESSIONS.set(s.id, s);
    await track(db, uid, 'bareng_start', { game, place: place[0] });
    return { ok: true, game: view(s) };
  });

  async function join(s: Session, uid: string, req: any) {
    if (s.players.some((p) => p.id === uid)) return { ok: true, game: view(s) };
    if (s.phase !== 'ajak') throw bad('started', 'Permainannya sudah dimulai.');
    const g = BARENG_GAMES[s.game];
    if (s.players.length >= g.max) throw bad('full', 'Pemainnya sudah penuh. Kamu bisa menonton.');
    const p = me(s.place, uid);
    if (!p) throw bad('not_here', 'Kamu harus ada di sini untuk ikut.');
    if (await blockedAmong(uid, s.players.map((x) => x.id))) throw forbidden('Kamu tidak bisa ikut permainan ini.');
    if (s.game === 'karung') await karungReady(uid);
    s.players.push(p);
    note(s, `${p.name} ikut main.`);
    bump(s);
    if (s.players.length >= g.max) start(s);
    void req;
    return { ok: true, game: view(s) };
  }
  const sessionOf = (id: string) => {
    const s = SESSIONS.get(id);
    if (!s) throw notFound('Permainan ini sudah selesai.');
    tick(s);
    return s;
  };

  app.post('/api/bareng/:id/join', { ...auth, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req: any) => join(sessionOf(String(req.params.id)), req.user!.id, req));

  /** Yang mengajak boleh mulai lebih awal bila pemainnya sudah cukup. */
  app.post('/api/bareng/:id/go', auth, async (req: any) => {
    const s = sessionOf(String(req.params.id));
    if (s.starter !== req.user!.id) throw forbidden('Hanya yang mengajak yang bisa memulai.');
    if (s.phase !== 'ajak') return { ok: true, game: view(s) };
    if (s.players.length < BARENG_GAMES[s.game].min) throw bad('alone', 'Tunggu ada yang ikut dulu.');
    start(s);
    return { ok: true, game: view(s) };
  });

  app.post('/api/bareng/:id/leave', auth, async (req: any) => {
    const s = sessionOf(String(req.params.id));
    const uid = req.user!.id;
    if (!s.players.some((p) => p.id === uid) || s.left.has(uid)) return { ok: true };
    if (s.phase === 'ajak') {
      if (uid === s.starter) end(s, 'batal');
      else { s.players = s.players.filter((p) => p.id !== uid); bump(s); }
    } else if (s.phase !== 'selesai') {
      s.left.add(uid);
      note(s, `${nameOf(s, uid)} keluar.`);
      if (s.race) s.race.out.push(uid);
      bump(s);
      tick(s);
    }
    return { ok: true, game: view(s) };
  });

  /** Langkah: congklak {hole}, ular {roll:true}, karung {hops, taps, timeMs?} (dikirim berkala selama lomba). */
  app.post('/api/bareng/:id/move', { ...auth, config: { rateLimit: { max: 600, timeWindow: '1 minute' } } }, async (req: any) => {
    const s = sessionOf(String(req.params.id));
    const uid = req.user!.id;
    const b = req.body ?? {};
    const i = s.players.findIndex((p) => p.id === uid);
    if (i < 0 || s.left.has(uid)) throw bad('not_player', 'Kamu tidak ikut permainan ini.');
    if (s.phase !== 'main') return { ok: true, game: view(s) };
    if (s.game === 'karung') return { ok: true, game: view(karungStep(s, uid, b)) };
    if (s.turn !== i) throw bad('not_turn', 'Belum giliranmu.');
    if (s.game === 'congklak') congklakMove(s, Number(b.hole));
    else ularRoll(s);
    return { ok: true, game: view(s) };
  });

  let kcfg: any = null;
  function karungStep(s: Session, uid: string, b: any) {
    const r = s.race!;
    const now = clock();
    if (now < r.startAt || r.out.includes(uid) || uid in r.done) return s;
    const t = now - r.startAt;
    // kemajuan dibatasi kecepatan jari manusia
    const cap = Math.floor((t / 1000) * KARUNG_MAX_TAPS_PER_SEC) + 2;
    const hops = Math.max(r.prog[uid] ?? 0, Math.min(KARUNG_HOPS, cap, Math.floor(Number(b.hops) || 0)));
    r.prog[uid] = hops;
    if (hops >= KARUNG_HOPS && b.timeMs !== undefined) {
      const timeMs = Math.floor(Number(b.timeMs)), taps = Math.floor(Number(b.taps));
      const ok = Number.isFinite(timeMs) && timeMs >= (kcfg?.minTimeMs ?? 3000) && timeMs <= t + 500 && taps >= KARUNG_HOPS && taps / (timeMs / 1000) <= KARUNG_MAX_TAPS_PER_SEC;
      r.done[uid] = ok ? timeMs : null;
      note(s, ok ? `${nameOf(s, uid)} sampai finis!` : `${nameOf(s, uid)} tersandung karungnya.`);
      if (!ok) req_warn(uid, timeMs, taps, t);
    }
    bump(s);
    return s;
  }
  function req_warn(uid: string, timeMs: number, taps: number, t: number) { app.log.warn({ userId: uid, timeMs, taps, t }, 'balap karung live: hasil tidak wajar'); }

  /* ---------------- persiapan karung & hadiah (berkala) ---------------- */

  async function prepareKarung(s: Session) {
    s.phase = 'main'; // dicegah dijalankan dua kali
    const cfg = await getSettings(db);
    kcfg = cfg.karung;
    const racers: Player[] = [];
    for (const p of s.players) {
      const ok = await db.tx(async (t) => {
        const pet = await lockPet(t, p.id);
        if (!pet || isAsleep(pet, cfg) || isSick(pet, cfg)) return false;
        const needs = currentNeeds(pet, cfg);
        if (needs.energi < cfg.karung.energiCost) return false;
        await bumpCounter(t, p.id, 'karung', cfg.karung.playsPerDay);
        await savePet(t, p.id, { needs: applyNeedDelta(needs, { energi: -cfg.karung.energiCost }) });
        return true;
      }).catch(() => false);
      if (ok) racers.push(p); else { s.left.add(p.id); note(s, `${p.name} tidak bisa ikut (capek / jatah habis).`); }
    }
    if (racers.length < 2) { end(s, 'sepi'); s.moves = 0; return; }
    const now = clock();
    s.startedAt = now;
    s.race = { startAt: now + KARUNG_COUNTDOWN, endAt: now + KARUNG_COUNTDOWN + KARUNG_LIMIT, prog: Object.fromEntries(racers.map((p) => [p.id, 0])), done: {}, out: [...s.left] };
    s.moves = 1;
    bump(s);
  }

  async function settle(s: Session) {
    if (s.settled) return;
    s.settled = true;
    const [cfg, cat] = await Promise.all([getSettings(db), getCatalog(db)]);
    const mult = coinMultiplier(cat);
    const ranked: { p: Player; rank: number; score?: number; timeMs?: number | null; factor: number; left: boolean }[] = [];
    if (s.game === 'congklak') {
      const [a, b] = [s.board[7] ?? 0, s.board[15] ?? 0];
      const quit = s.players.find((p) => s.left.has(p.id));
      s.players.forEach((p, k) => {
        const mine = k === 0 ? a : b, theirs = k === 0 ? b : a;
        const won = quit ? !s.left.has(p.id) : mine > theirs;
        const tie = !quit && mine === theirs;
        ranked.push({ p, rank: won || tie ? 1 : 2, score: mine, factor: tie ? 0.6 : won ? 1 : 0.4, left: s.left.has(p.id) });
      });
    } else if (s.game === 'ular') {
      const order = [...s.finished, ...s.players.filter((p) => !s.finished.includes(p.id) && !s.left.has(p.id)).sort((x, y) => (s.pos[y.id] ?? 0) - (s.pos[x.id] ?? 0)).map((p) => p.id)];
      order.forEach((id, k) => ranked.push({ p: s.players.find((p) => p.id === id)!, rank: k + 1, score: s.pos[id], factor: ULAR_RANK[k] ?? 0.2, left: false }));
      for (const p of s.players) if (s.left.has(p.id) && !order.includes(p.id)) ranked.push({ p, rank: order.length + 1, factor: 0, left: true });
    } else {
      const r = s.race;
      const fin = s.players.filter((p) => r && typeof r.done[p.id] === 'number').sort((x, y) => (r!.done[x.id]! - r!.done[y.id]!));
      fin.forEach((p, k) => ranked.push({ p, rank: k + 1, timeMs: r!.done[p.id], factor: 1, left: false }));
      for (const p of s.players) if (!fin.includes(p)) ranked.push({ p, rank: fin.length + 1, timeMs: null, factor: 0, left: s.left.has(p.id) });
    }
    const results: Result[] = [];
    for (const x of ranked) {
      const base: Result = { id: x.p.id, name: x.p.name, rank: x.rank, score: x.score, timeMs: x.timeMs, coins: 0, xp: 0, capped: false, left: x.left };
      // tanpa satu langkah pun / keluar / tidak finis: tanpa hadiah dan tidak memakai jatah
      if (!s.moves || x.left || x.factor <= 0) { results.push(base); continue; }
      const r = await db.tx(async (t) => {
        let coins: number, xp: number;
        if (s.game === 'karung') {
          const table = [...(cfg.karung.rewards ?? [40, 25, 15, 8]), 5];
          coins = Math.round((table[x.rank - 1] ?? 0) * mult);
          xp = cfg.karung.xp ?? 0;
        } else {
          await bumpCounter(t, x.p.id, 'coop', cfg.visit.coopPerDay);
          coins = Math.round(cfg.visit.coopCoins * x.factor * mult);
          xp = Math.max(1, Math.round((cfg.visit.coopXp ?? 0) * (0.5 + x.factor / 2)));
        }
        if (coins) await credit(t, x.p.id, 'coin', coins, `bareng:${s.game}`, s.id);
        const pet = await lockPet(t, x.p.id);
        if (pet && xp) { const lv = await grantXp(t, x.p.id, pet, xp); await savePet(t, x.p.id, { level: lv.level, xp: lv.xp }); }
        if (s.game === 'karung') await track(t, x.p.id, 'race', { rank: x.rank, timeMs: x.timeMs, live: true });
        else await track(t, x.p.id, 'coop', { game: s.game, rank: x.rank });
        return { ...base, coins, xp };
      }).catch((e: any) => ({ ...base, capped: e?.code === 'daily_limit' }));
      results.push(r);
    }
    s.results = results.sort((a, b) => a.rank - b.rank);
    bump(s);
  }

  // pemeriksaan berkala (giliran otomatis, ajakan habis, persiapan karung, hadiah)
  let running = false;
  const loop = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      for (const s of [...SESSIONS.values()]) {
        tick(s);
        if (s.phase === 'siap') await prepareKarung(s);
        if (s.phase === 'selesai' && !s.settled) await settle(s);
      }
    } catch (e) { app.log.error(e); } finally { running = false; }
  }, 1000);
  loop.unref?.();
  app.addHook('onClose', async () => clearInterval(loop));

  runTick = async () => {
    for (const s of [...SESSIONS.values()]) {
      tick(s);
      if (s.phase === 'siap') await prepareKarung(s);
      if (s.phase === 'selesai' && !s.settled) await settle(s);
    }
  };
}
