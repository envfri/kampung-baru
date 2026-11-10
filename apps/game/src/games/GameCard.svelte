<script lang="ts">
  // Kartu pembuka & hasil mini-game, plus hitung mundur.
  import type { Snippet } from 'svelte';
  import { G } from '../lib/game.svelte';
  import { I, COIN } from '../lib/icons';
  let { run, title, left, info, intro, result }: { run: any; title: string; left: number; info: string; intro: Snippet; result?: Snippet } = $props();
  const back = () => { run.stop(); G.view = 'map'; G.sheet = 'games'; };
</script>

{#if run.st.phase === 'count'}<div class="count">{run.st.count}</div>{/if}
{#if run.st.phase === 'intro' || run.st.phase === 'done'}
  <div class="card">
    {#if run.st.phase === 'intro'}
      <h2>{title}</h2>
      {@render intro()}
      <p class="muted">Sisa main: <b>{left}</b> · {info}</p>
    {:else if run.st.result}
      <h2>{run.st.result.error ? 'Permainan selesai' : `Skor ${run.st.result.score}`}</h2>
      {#if run.st.result.reward}<p class="reward">{@html COIN} +{run.st.result.reward} koin</p>{/if}
      {#if result && !run.st.result.error}{@render result()}{/if}
    {:else}<p>Menghitung hasil…</p>{/if}
    <div class="row">
      <button class="btn" onclick={back}>{@html I.back} Balai</button>
      <button class="btn hot" disabled={run.st.busy || left <= 0} onclick={run.start}>{run.st.phase === 'intro' ? 'Mulai' : `Main lagi (${left})`}</button>
    </div>
  </div>
{/if}

<style>
  .count { position: absolute; z-index: 8; left: 50%; top: 38%; transform: translate(-50%, -50%); font-size: 120px; font-weight: 800; color: var(--paper); -webkit-text-stroke: 5px var(--ink); pointer-events: none; }
  .card { position: absolute; z-index: 8; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-b) + 86px); width: min(420px, calc(100vw - 20px)); background: var(--paper); border: 3px solid var(--ink); border-radius: 20px; box-shadow: 0 5px 0 var(--ink); padding: 16px; display: flex; flex-direction: column; gap: 8px; }
  h2 { margin: 0; font-size: 24px; font-weight: 800; }
  .card :global(p) { margin: 0; font-weight: 600; }
  .muted { color: var(--muted); font-size: 14px; }
  .reward { display: flex; align-items: center; gap: 6px; font-size: 20px; font-weight: 800; }
  .reward :global(svg) { width: 26px; height: 26px; }
  .row { display: flex; gap: 8px; } .row .btn { flex: 1; }
</style>
