// Alur mini-game Balai Main yang sama untuk semua permainan: mulai (server memberi seed) → hitung mundur
// → main → kirim langkah pemain → server menghitung ulang skor & hadiah.
import { G, merge, fail, toast } from './game.svelte';
import { api } from './api';
import { sfx } from './sfx';

export type Phase = 'intro' | 'count' | 'play' | 'done';

export function createRun(game: string, onPlay: (start: any) => void) {
  const st = $state({ phase: 'intro' as Phase, count: 3, busy: false, result: null as any, start: null as any });
  let tick: any;
  async function start() {
    if (st.busy) return;
    st.busy = true;
    try {
      const r = await api.post(`/api/games/${game}/start`);
      merge(r);
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
        else { clearInterval(tick); st.phase = 'play'; sfx.level(); onPlay(r); }
      }, 1000);
    } catch (e) { fail(e); } finally { st.busy = false; }
  }
  async function finish(payload: Record<string, unknown>) {
    if (st.phase === 'done' || !st.start) return;
    st.phase = 'done';
    st.busy = true;
    try {
      const r = await api.post(`/api/games/${game}/finish`, { runId: st.start.runId, ...payload });
      merge(r);
      st.result = r;
      if (r.reward) sfx.coin();
      if (r.levelUp) toast(`Naik ke Lv ${r.levelUp}!`, 'good');
    } catch (e) { fail(e); st.result = { error: true, reward: 0 }; } finally { st.busy = false; G.immersive = false; }
  }
  function stop() { clearInterval(tick); G.immersive = false; }
  return { st, start, finish, stop };
}
