<script lang="ts">
  // Kartu pembuka & hasil mini-game, plus hitung mundur. Mode duel: mulai otomatis & hasil menang/kalah.
  import { onMount, type Snippet } from 'svelte';
  import { petSVG } from '@kb/shared';
  import { G, wearItems } from '../lib/game.svelte';
  import { leaveDuel } from '../lib/minigame.svelte';
  import { maybeNudge } from '../lib/account.svelte';
  import { I, COIN } from '../lib/icons';
  let { run, title, left, info, intro, result }: { run: any; title: string; left: number; info: string; intro: Snippet; result?: Snippet } = $props();
  const back = () => {
    run.stop();
    if (run.st.duel || G.duel) { const won = run.st.result?.duel?.result === 'menang'; leaveDuel(); if (won) maybeNudge('duel', 'duels'); return; }
    G.view = 'map'; G.sheet = 'games';
  };
  const inDuel = $derived(!!G.duel || !!run.st.duel);
  const dv = $derived(run.st.result?.duel);
  onMount(() => {
    // dari ruang tunggu duel: langsung mulai (main bareng mulai bersamaan)
    if (G.duel?.autostart) { G.duel.autostart = false; run.start(); }
  });
</script>

{#if run.st.phase === 'count'}<div class="count">{run.st.count}</div>{/if}
{#if run.st.phase === 'intro' && inDuel}
  <div class="card"><h2>{title}</h2><p>Menyiapkan duel…</p><div class="row"><button class="btn" onclick={back}>{@html I.back} Duel</button></div></div>
{:else if run.st.phase === 'intro' || run.st.phase === 'done'}
  <div class="card">
    {#if run.st.phase === 'intro'}
      <h2>{title}</h2>
      {@render intro()}
      <p class="muted">Sisa main: <b>{left}</b> · {info}</p>
    {:else if dv}
      <h2 class:win={dv.result === 'menang'}>{dv.result === 'menang' ? 'Kamu menang!' : dv.result === 'kalah' ? 'Kalah tipis…' : dv.result === 'seri' ? 'Seri!' : 'Skormu tersimpan'}</h2>
      <div class="vs">
        <span class="side">{@html petSVG(G.me.pet, wearItems(G.me.pet.wear))}<b>Kamu</b><em>{dv.me.label}</em></span>
        <span class="x">VS</span>
        <span class="side">{#if dv.them.pet}{@html petSVG(dv.them.pet, wearItems(dv.them.pet.wear))}{/if}<b>{dv.them.name}</b><em>{dv.them.played ? dv.them.label : 'belum selesai'}</em></span>
      </div>
      {#if run.st.result.reward}<p class="reward">{@html COIN} +{run.st.result.reward} koin</p>{/if}
      {#if !dv.result}<p class="muted">Hasil keluar setelah {dv.them.name} selesai main. Kamu dapat notifikasi.</p>{/if}
    {:else if run.st.result}
      <h2>{run.st.result.error ? 'Permainan selesai' : `Skor ${run.st.result.score}`}</h2>
      {#if run.st.result.reward}<p class="reward">{@html COIN} +{run.st.result.reward} koin</p>{/if}
      {#if result && !run.st.result.error}{@render result()}{/if}
    {:else}<p>Menghitung hasil…</p>{/if}
    <div class="row">
      {#if inDuel}
        <button class="btn hot" disabled={run.st.busy} onclick={back}>{@html I.back} Kembali ke Duel</button>
      {:else}
        <button class="btn" onclick={back}>{@html I.back} Balai</button>
        <button class="btn hot" disabled={run.st.busy || left <= 0} onclick={run.start}>{run.st.phase === 'intro' ? 'Mulai' : `Main lagi (${left})`}</button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .count { position: absolute; z-index: 8; left: 50%; top: 38%; transform: translate(-50%, -50%); font-size: 120px; font-weight: 800; color: var(--paper); -webkit-text-stroke: 5px var(--ink); pointer-events: none; }
  .card { position: absolute; z-index: 8; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-b) + 86px); width: min(420px, calc(100vw - 20px)); background: var(--paper); border: 3px solid var(--ink); border-radius: 20px; box-shadow: 0 5px 0 var(--ink); padding: 16px; display: flex; flex-direction: column; gap: 8px; }
  h2 { margin: 0; font-size: 24px; font-weight: 800; }
  h2.win { color: #1E7A4C; }
  .card :global(p) { margin: 0; font-weight: 600; }
  .muted { color: var(--muted); font-size: 14px; }
  .reward { display: flex; align-items: center; gap: 6px; font-size: 20px; font-weight: 800; }
  .reward :global(svg) { width: 26px; height: 26px; }
  .vs { display: flex; align-items: center; justify-content: space-around; gap: 6px; }
  .side { display: flex; flex-direction: column; align-items: center; gap: 1px; min-width: 0; }
  .side :global(svg) { width: 62px; height: 62px; }
  .side b { font-size: 14px; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .side em { font-style: normal; font-weight: 800; font-size: 15px; }
  .x { font-weight: 800; font-size: 22px; color: var(--low); }
  .row { display: flex; gap: 8px; } .row .btn { flex: 1; }
</style>
