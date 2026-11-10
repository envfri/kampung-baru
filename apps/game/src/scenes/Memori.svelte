<script lang="ts">
  import { onDestroy } from 'svelte';
  import { memoriLayout, memoriStars, MEMORI_FACES, itemIcon } from '@kb/shared';
  import { G, merge, fail, toast, settings } from '../lib/game.svelte';
  import { api } from '../lib/api';
  import { sfx } from '../lib/sfx';
  import { I, COIN } from '../lib/icons';

  type Phase = 'intro' | 'play' | 'done';
  let phase = $state<Phase>('intro');
  let busy = $state(false);
  let runId = '';
  let layout = $state<number[]>([]);
  let open = $state<number[]>([]);
  let matched = $state<Set<number>>(new Set());
  let flips: [number, number][] = [];
  let moves = $state(0);
  let t0 = 0;
  let elapsed = $state(0);
  let timer: any;
  let lock = false;
  let result = $state<any>(null);
  const cfg = $derived(settings().games?.memori ?? {});
  const left = $derived(G.me.limits?.games?.memori ?? cfg.playsPerDay);
  const face = (v: number) => itemIcon({ id: 'f', kind: 'food', name: '', art: { type: 'builtin', key: MEMORI_FACES[v] }, data: {} } as any);

  async function start() {
    busy = true;
    try {
      const r = await api.post('/api/games/memori/start');
      merge(r);
      runId = r.runId;
      layout = memoriLayout(r.seed);
      open = []; matched = new Set(); flips = []; moves = 0; result = null; lock = false;
      phase = 'play';
      t0 = performance.now();
      clearInterval(timer);
      timer = setInterval(() => (elapsed = performance.now() - t0), 200);
      sfx.level();
    } catch (e) { fail(e); } finally { busy = false; }
  }

  function flip(i: number) {
    if (phase !== 'play' || lock || matched.has(i) || open.includes(i)) return;
    sfx.tap();
    open = [...open, i];
    if (open.length < 2) return;
    const [a, b] = open;
    flips.push([a, b]);
    moves = flips.length;
    if (layout[a] === layout[b]) {
      matched = new Set([...matched, a, b]);
      open = [];
      sfx.pop();
      if (matched.size === layout.length) finish();
    } else {
      lock = true;
      setTimeout(() => { open = []; lock = false; }, 700);
    }
  }

  async function finish() {
    phase = 'done';
    clearInterval(timer);
    const timeMs = Math.round(performance.now() - t0);
    busy = true;
    try {
      const r = await api.post('/api/games/memori/finish', { runId, flips, timeMs });
      merge(r);
      result = { ...r, timeMs };
      sfx.level();
      if (r.levelUp) toast(`Naik ke Lv ${r.levelUp}!`, 'good');
    } catch (e) { fail(e); result = { error: true, timeMs }; } finally { busy = false; }
  }
  onDestroy(() => clearInterval(timer));
  const back = () => { G.view = 'map'; G.sheet = 'games'; };
  const preview = $derived(memoriStars(moves || 1));
</script>

<div class="memori">
  {#if phase === 'play' || phase === 'done'}
    <div class="top"><span>{moves} langkah</span><span>{'★'.repeat(preview)}{'☆'.repeat(3 - preview)}</span><span>{(elapsed / 1000).toFixed(0)} d</span></div>
    <div class="grid">
      {#each layout as v, i}
        {@const up = open.includes(i) || matched.has(i)}
        <button class="card-m" class:up class:ok={matched.has(i)} onclick={() => flip(i)} aria-label={up ? 'Kartu terbuka' : `Kartu ${i + 1}`}>
          {#if up}<span class="face">{@html face(v)}</span>{:else}<span class="back"></span>{/if}
        </button>
      {/each}
    </div>
  {/if}
  {#if phase !== 'play'}
    <div class="panel">
      {#if phase === 'intro'}
        <h2>Ingat Jajanan</h2>
        <p>Buka dua kartu sekaligus dan temukan 8 pasang jajanan. Makin sedikit langkah, makin banyak bintang.</p>
        <p class="muted">≤12 langkah ★★★ · ≤18 ★★ · lebih dari itu ★ · sisa main <b>{left}</b> · {cfg.energiCost} energi</p>
      {:else if result}
        <h2>{result.error ? 'Permainan selesai' : `${'★'.repeat(result.stars)}${'☆'.repeat(3 - result.stars)}`}</h2>
        <p>{moves} langkah · {(result.timeMs / 1000).toFixed(1)} detik</p>
        {#if result.reward}<p class="reward">{@html COIN} +{result.reward} koin</p>{/if}
      {:else}<p>Menghitung hasil…</p>{/if}
      <div class="row">
        <button class="btn" onclick={back}>{@html I.back} Balai</button>
        <button class="btn hot" disabled={busy || left <= 0} onclick={start}>{phase === 'intro' ? 'Mulai' : `Main lagi (${left})`}</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .memori { position: absolute; inset: 0; background: linear-gradient(180deg, #FFF3CF, #F3DFB8); display: flex; flex-direction: column; align-items: center; padding: calc(var(--safe-t) + 84px) 12px calc(var(--safe-b) + 12px); gap: 12px; }
  .top { display: flex; gap: 10px; }
  .top span { background: var(--paper); border: 2.5px solid var(--ink); border-radius: 999px; padding: 3px 12px; font-weight: 800; font-size: 16px; box-shadow: 0 2px 0 var(--ink); color: #B9800F; }
  .top span:first-child, .top span:last-child { color: var(--ink); }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; width: min(420px, 100%); }
  .card-m { aspect-ratio: 3 / 4; border: 2.5px solid var(--ink); border-radius: 14px; box-shadow: 0 3px 0 var(--ink); padding: 0; cursor: pointer; overflow: hidden; background: var(--paper); transition: transform .15s; }
  .card-m:active { transform: translateY(2px); }
  .card-m.ok { background: #E6F5EC; }
  .back { display: block; width: 100%; height: 100%; background: repeating-linear-gradient(45deg, #3F7FBF 0 10px, #4F8FCF 10px 20px); }
  .face { display: grid; place-items: center; width: 100%; height: 100%; animation: pop .25s; }
  .face :global(svg) { width: 86%; height: auto; }
  .panel { position: absolute; z-index: 8; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-b) + 86px); width: min(420px, calc(100vw - 20px)); background: var(--paper); border: 3px solid var(--ink); border-radius: 20px; box-shadow: 0 5px 0 var(--ink); padding: 16px; display: flex; flex-direction: column; gap: 8px; }
  h2 { margin: 0; font-size: 24px; font-weight: 800; color: #B9800F; }
  p { margin: 0; font-weight: 600; } .muted { color: var(--muted); font-size: 14px; }
  .reward { display: flex; align-items: center; gap: 6px; font-size: 20px; font-weight: 800; }
  .reward :global(svg) { width: 26px; height: 26px; }
  .row { display: flex; gap: 8px; } .row .btn { flex: 1; }
</style>
