// Alur mini-game Balai Main yang sama untuk semua permainan: mulai (server memberi seed) → hitung mundur
// → main → kirim langkah pemain → server menghitung ulang skor & hadiah.
// Mode duel: seed dari duel, lawan tampil sebagai "bayangan" (tantangan) atau progres langsung (main bareng).
import { ghostAt } from '@kb/shared';
import { G, merge, fail, toast, refreshMe } from './game.svelte';
import { api } from './api';
import { sfx } from './sfx';

export type Phase = 'intro' | 'count' | 'play' | 'done';

export function createRun(game: string, onPlay: (start: any) => void) {
  const st = $state({ phase: 'intro' as Phase, count: 3, busy: false, result: null as any, start: null as any, duel: null as any, oppLive: null as null | number, oppDone: false });
  let tick: any, lastSent = 0, t0 = 0, poll: any;
  const duel = () => (G.duel && G.duel.game === game ? G.duel : null);

  async function start() {
    if (st.busy) return;
    st.busy = true;
    try {
      const d = duel();
      const r = d ? await api.post(`/api/duels/${d.id}/start`) : await api.post(`/api/games/${game}/start`);
      merge(r);
      if (d) { r.runId = d.id; Object.assign(r, r.meta ?? {}); st.duel = { ...d, ghost: r.ghost, seed: r.seed, meta: r.meta }; st.oppLive = null; st.oppDone = !!r.ghost; }
      st.start = r;
      st.result = null;
      G.immersive = true;
      st.phase = 'count';
      st.count = 3;
      sfx.tap();
      clearInterval(tick);
      tick = setInterval(() => {
        st.count--;
        if (st.count > 0) sfx.tap();
        else { clearInterval(tick); st.phase = 'play'; t0 = performance.now(); sfx.level(); onPlay(r); }
      }, 1000);
    } catch (e) { fail(e); if (duel()) leaveDuel(); } finally { st.busy = false; }
  }

  async function finish(payload: Record<string, unknown>) {
    if (st.phase === 'done' || !st.start) return;
    st.phase = 'done';
    st.busy = true;
    try {
      if (st.duel) {
        const r = await api.post(`/api/duels/${st.duel.id}/finish`, { inputs: payload });
        merge(r);
        st.result = { score: r.duel.me.label, reward: r.reward, duel: r.duel };
        if (r.duel.result === 'menang') sfx.level(); else if (r.reward) sfx.coin();
        if (r.levelUp) toast(`Naik ke Lv ${r.levelUp}!`, 'good');
        // main bareng & lawan belum selesai: tunggu hasilnya sebentar
        if (!r.duel.result) waitResult(st.duel.id);
        refreshMe().catch(() => {});
      } else {
        const r = await api.post(`/api/games/${game}/finish`, { runId: st.start.runId, ...payload });
        merge(r);
        st.result = r;
        if (r.reward) sfx.coin();
        if (r.levelUp) toast(`Naik ke Lv ${r.levelUp}!`, 'good');
      }
    } catch (e) { fail(e); st.result = { error: true, reward: 0 }; } finally { st.busy = false; G.immersive = false; }
  }

  function waitResult(id: string) {
    let n = 0;
    clearInterval(poll);
    poll = setInterval(async () => {
      if (++n > 40) return clearInterval(poll);
      try {
        const r = await api.get(`/api/duels/${id}`);
        if (r.duel.result) { clearInterval(poll); st.result = { ...st.result, reward: r.duel.me.reward, duel: r.duel }; r.duel.result === 'menang' ? sfx.level() : sfx.coin(); refreshMe().catch(() => {}); }
      } catch { /* coba lagi */ }
    }, 2000);
  }

  /** Kirim progres sendiri saat main bareng (dibatasi ±0,7 detik), terima progres lawan. */
  async function report(p: number) {
    if (!st.duel || st.phase !== 'play' || st.duel.ghost) return;
    const now = performance.now();
    if (now - lastSent < 700) return;
    lastSent = now;
    try { const r = await api.post(`/api/duels/${st.duel.id}/progress`, { p }); st.oppLive = r.them; st.oppDone = r.themDone; } catch { /* sinyal lemah: abaikan */ }
  }

  /** Progres lawan sekarang: dari bayangan (tantangan) atau dari laporan langsung (main bareng). */
  function opp() {
    if (!st.duel) return null;
    if (st.duel.ghost) return ghostAt(game, st.duel.seed, st.duel.meta, st.duel.ghost, st.phase === 'play' ? performance.now() - t0 : 1e9);
    return st.oppLive;
  }

  function stop() { clearInterval(tick); clearInterval(poll); G.immersive = false; }
  return { st, start, finish, stop, report, opp };
}

export function leaveDuel(toSheet = true) {
  G.duel = null;
  G.view = 'map';
  if (toSheet) G.sheet = 'duels';
}
