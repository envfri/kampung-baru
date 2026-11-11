<script lang="ts">
  // Papan skor duel di atas layar: aku vs lawan (bayangan atau langsung). Sekaligus mengirim progresku saat main bareng.
  import { onDestroy } from 'svelte';
  import { petSVG } from '@kb/shared';
  import { G, wearItems } from '../lib/game.svelte';
  let { run, mine, fmt }: { run: any; mine: number; fmt: (v: number) => string } = $props();
  const them = $derived(run.st.duel?.them);
  let opp = $state<number | null>(null);
  const tick = setInterval(() => {
    if (!run.st.duel || run.st.phase !== 'play') return;
    run.report(mine);
    opp = run.opp();
  }, 150);
  onDestroy(() => clearInterval(tick));
  const lead = $derived(opp === null ? 0 : Math.sign(mine - opp));
</script>

{#if run.st.duel && (run.st.phase === 'play' || run.st.phase === 'count')}
  <div class="vsbar" aria-label="Skor duel">
    <span class="me" class:lead={lead > 0}>{@html petSVG(G.me.pet, wearItems(G.me.pet.wear))}<b>{fmt(mine)}</b></span>
    <i>VS</i>
    <span class="them" class:lead={lead < 0}><b>{opp === null ? '…' : fmt(opp)}</b>{#if them?.pet}{@html petSVG(them.pet, wearItems(them.pet.wear))}{/if}</span>
    <small>{run.st.duel.ghost ? `bayangan ${them?.name ?? ''}` : run.st.oppDone ? `${them?.name ?? 'Lawan'} sudah selesai` : `${them?.name ?? 'Lawan'} main bareng`}</small>
  </div>
{/if}

<style>
  .vsbar { position: absolute; z-index: 6; left: 50%; transform: translateX(-50%); top: calc(var(--safe-t) + 50px); display: grid; grid-template-columns: auto auto auto; align-items: center; gap: 0 8px; background: var(--paper); border: 2.5px solid var(--ink); border-radius: 16px; box-shadow: 0 3px 0 var(--ink); padding: 3px 10px 2px; pointer-events: none; white-space: nowrap; }
  span { display: flex; align-items: center; gap: 4px; border-radius: 10px; padding: 0 4px; }
  span.lead { background: #D8F0DF; }
  span :global(svg) { width: 32px; height: 32px; }
  b { font-size: 16px; font-weight: 800; font-variant-numeric: tabular-nums; }
  i { font-style: normal; font-weight: 800; color: var(--low); }
  small { grid-column: 1 / -1; text-align: center; font-size: 11.5px; font-weight: 700; color: var(--muted); max-width: 240px; overflow: hidden; text-overflow: ellipsis; }
</style>
