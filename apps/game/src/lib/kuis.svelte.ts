// Cerdas Cermat Kampung (game): beranda Kuis, Kuis Harian & Tantang Teman. Soal datang dari server TANPA kunci;
// jawaban dikirim ke server yang menilai, mencatat waktu, dan membalas kunci + penjelasan ("Tahukah kamu?").
import { api, ApiError } from './api';
import { G, fail, merge, settings, toast } from './game.svelte';
import { sfx } from './sfx';

export type KuisPage = 'home' | 'play' | 'end' | 'pick';
export const KZ = $state({
  page: 'home' as KuisPage,
  home: null as any,
  /** permainan yang sedang dibuka (Kuis Harian / Tantang Teman) */
  run: null as any,
  /** hasil jawaban soal terakhir (kunci & penjelasan) */
  reveal: null as any,
  /** jawaban yang sedang dikirim (soal dikunci) */
  sending: false,
  /** tantangan kuis (duel) untuk permainan Tantang Teman */
  duel: null as any,
  duels: [] as any[],
  /** lembar "Laporkan soal" */
  report: null as null | { qid: string; text: string },
  busy: false,
  /** selisih jam server - jam perangkat */
  offset: 0,
  /** dibuka dari tautan / daftar duel: buka tantangan ini */
  want: null as null | { duel?: string; pick?: string },
});
export const kuisNow = () => Date.now() + KZ.offset;
export const kuisOn = () => settings().kuis?.on !== false;

function takeRun(r: any) {
  if (r?.run) { KZ.run = r.run; if (r.run.serverNow) KZ.offset = r.run.serverNow - Date.now(); }
  merge(r);
}

/** buka layar Kuis (dari kartu Balai Main, tautan /#kuis, atau daftar duel) */
export function openKuis(want: { duel?: string; pick?: string } | null = null) {
  sfx.tap();
  G.sheet = null; G.sheetArg = null; G.duel = null;
  KZ.page = 'home'; KZ.reveal = null; KZ.run = null; KZ.want = want;
  G.view = 'kuis';
}

export async function loadHome() {
  try {
    const [h, d] = await Promise.all([api.get('/api/kuis'), api.get('/api/duels').catch(() => ({ duels: [] }))]);
    KZ.home = h;
    KZ.duels = (d.duels ?? []).filter((x: any) => x.game === 'kuis');
    if (h.serverNow) KZ.offset = h.serverNow - Date.now();
  } catch (e) { fail(e); }
}

/** Kuis Harian: mulai / lanjutkan (soal tetap sepanjang hari) */
export async function startHarian() {
  if (KZ.busy) return;
  KZ.busy = true;
  try {
    const r = await api.post('/api/kuis/harian');
    takeRun(r);
    KZ.duel = null; KZ.reveal = null;
    G.immersive = true;
    KZ.page = r.run.done ? 'end' : 'play';
    sfx.level();
  } catch (e) { fail(e); } finally { KZ.busy = false; }
}

/** Tantang Teman: mulai / lanjutkan giliran sendiri */
export async function startTantang(duel: any) {
  if (KZ.busy) return;
  KZ.busy = true;
  try {
    const r = await api.post(`/api/kuis/tantang/${duel.id}/start`);
    takeRun(r);
    KZ.duel = duel; KZ.reveal = null;
    G.immersive = true;
    KZ.page = r.run.done ? 'end' : 'play';
    sfx.level();
  } catch (e) { fail(e); } finally { KZ.busy = false; }
}

/** buat tantangan untuk teman lalu langsung main duluan */
export async function createTantang(friendId: string) {
  if (KZ.busy) return;
  KZ.busy = true;
  let duel: any = null;
  try {
    duel = (await api.post('/api/duels', { friendId, game: 'kuis' })).duel;
    toast(`Tantangan kuis dikirim ke ${duel.them.name}! Kamu main duluan.`, 'good');
  } catch (e: any) {
    if (e instanceof ApiError && e.code === 'duel_exists' && e.data?.duelId) {
      const r = await api.get(`/api/duels/${e.data.duelId}`).catch(() => null);
      if (r?.duel?.game === 'kuis') { toast(e.message); duel = r.duel; } else fail(e);
    } else fail(e);
  } finally { KZ.busy = false; }
  if (duel) await startTantang(duel);
}

/** jawab soal yang sedang berjalan (pick null = waktu habis) */
export async function answer(pick: number | number[] | null) {
  const cur = KZ.run?.current;
  if (!cur || KZ.sending || KZ.reveal) return;
  KZ.sending = true;
  try {
    const r = await api.post(`/api/kuis/runs/${KZ.run.id}/answer`, { idx: cur.idx, pick });
    KZ.reveal = { ...r.result, q: cur.q, pick };
    takeRun(r);
    if (r.result.correct) { sfx.coin(); } else if (r.result.timedOut) sfx.pop(); else sfx.error();
    if (r.result.levelUp) toast(`Naik ke Lv ${r.result.levelUp}!`, 'good');
  } catch (e: any) {
    // sudah dijawab (mis. dikirim dua kali di sinyal lemah): ambil keadaan terbaru
    if (e instanceof ApiError && (e.code === 'answered' || e.code === 'not_served')) await refreshRun(true);
    else fail(e);
  } finally { KZ.sending = false; }
}

/** ambil keadaan permainan terbaru (mis. setelah kembali ke aplikasi) */
export async function refreshRun(showLast = false) {
  if (!KZ.run) return;
  try {
    const r = await api.get(`/api/kuis/runs/${KZ.run.id}`);
    takeRun(r);
    if (showLast && !r.run.current && r.run.answers.length && !r.run.done) {
      const a = r.run.answers[r.run.answers.length - 1];
      KZ.reveal = { ...a, ...a.reveal, q: a.q };
    }
    if (r.run.done) { KZ.reveal = null; KZ.page = 'end'; }
  } catch (e) { fail(e); }
}

/** lanjut ke soal berikutnya (server mengirim soal & mulai menghitung waktunya sekarang) */
export async function next() {
  if (!KZ.run || KZ.busy) return;
  if (KZ.run.done) { KZ.reveal = null; KZ.page = 'end'; G.immersive = false; sfx.level(); return; }
  KZ.busy = true;
  try {
    const r = await api.post(`/api/kuis/runs/${KZ.run.id}/next`);
    takeRun(r);
    KZ.reveal = null;
    if (r.run.done) { KZ.page = 'end'; G.immersive = false; }
    sfx.tap();
  } catch (e) { fail(e); } finally { KZ.busy = false; }
}

/** akhiri sekarang (soal yang tersisa dihitung waktu habis) */
export async function akhiri(runId: string) {
  try {
    const r = await api.post(`/api/kuis/runs/${runId}/akhiri`);
    takeRun(r);
    return r.run;
  } catch (e) { fail(e); return null; }
}

export async function sendReport(qid: string, reason: string, note: string) {
  try {
    const r = await api.post('/api/kuis/report', { qid, reason, note });
    if (KZ.home && !r.already) KZ.home.reportsLeft = Math.max(0, (KZ.home.reportsLeft ?? 1) - 1);
    toast(r.already ? 'Soal ini sudah kamu laporkan. Terima kasih!' : 'Terima kasih! Laporanmu terkirim.', 'good');
    return true;
  } catch (e) { fail(e); return false; }
}

export function leaveKuis() {
  G.immersive = false;
  KZ.page = 'home'; KZ.run = null; KZ.reveal = null; KZ.report = null;
  G.view = 'map'; G.sheet = 'games';
}
