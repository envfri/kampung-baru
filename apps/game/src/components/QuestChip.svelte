<script lang="ts">
  import { G } from '../lib/game.svelte';
  import { I } from '../lib/icons';
  import { sfx } from '../lib/sfx';
  const q = $derived(G.me.quests);
  const next = $derived(q?.next);
  const show = $derived(!!q && (q.ready > 0 || !!next || q.dailyDone < q.dailyTotal));
</script>

{#if show}
  <button class="chip" class:ready={q.ready > 0} onclick={() => { sfx.tap(); G.sheet = 'quests'; }} aria-label="Buka daftar tugas">
    <span class="ic">{@html I.quest}</span>
    {#if q.ready > 0}
      <span class="txt"><b>Hadiah tugas siap!</b><em>{q.ready} tugas selesai, ketuk untuk ambil</em></span>
    {:else if next}
      <span class="txt"><b>{next.title}</b><em>{next.description}</em></span>
      <span class="bar" aria-label="{next.progress} dari {next.target}"><i style="width:{(next.progress / next.target) * 100}%"></i><small>{next.progress}/{next.target}</small></span>
    {:else}
      <span class="txt"><b>Tugas harian</b><em>{q.dailyDone} dari {q.dailyTotal} selesai hari ini</em></span>
    {/if}
  </button>
{/if}

<style>
  .chip { position: absolute; z-index: 6; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-b) + 150px); display: flex; align-items: center; gap: 8px; width: min(400px, calc(100vw - 20px)); background: var(--paper); border: 2.5px solid var(--ink); border-radius: 16px; box-shadow: 0 3px 0 var(--ink); padding: 6px 10px 6px 6px; text-align: left; cursor: pointer; }
  .chip.ready { background: #FFF1C2; animation: nudge 1.6s ease-in-out infinite; }
  .ic { width: 34px; height: 34px; flex: none; border-radius: 10px; background: var(--coin); border: 2px solid var(--ink); display: grid; place-items: center; }
  .ic :global(svg) { width: 20px; height: 20px; }
  .txt { display: flex; flex-direction: column; min-width: 0; flex: 1; }
  .txt b { font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .txt em { font-style: normal; font-size: 12.5px; font-weight: 600; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bar { position: relative; width: 62px; height: 20px; flex: none; border: 2px solid var(--ink); border-radius: 10px; background: var(--track); overflow: hidden; }
  .bar i { position: absolute; inset: 0 auto 0 0; background: var(--ok); }
  .bar small { position: relative; display: block; text-align: center; font-size: 12px; font-weight: 800; line-height: 16px; }
  @keyframes nudge { 0%, 100% { transform: translateX(-50%); } 50% { transform: translateX(-50%) translateY(-3px); } }
  @media (min-width: 900px) and (min-aspect-ratio: 1/1) { .chip { bottom: calc(var(--safe-b) + 90px); } }
  @media (prefers-reduced-motion: reduce) { .chip.ready { animation: none; } }
</style>
