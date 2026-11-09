<script lang="ts">
  import { NEED_KEYS, NEED_LABEL } from '@kb/shared';
  import { needsNow } from '../lib/game.svelte';
  import { I } from '../lib/icons';
  const ICON: Record<string, string> = { kenyang: I.eat, bersih: I.bath, ceria: I.smile, energi: I.bolt };
  const n = $derived(needsNow());
</script>

<div class="needs" aria-label="Kebutuhan pet">
  {#each NEED_KEYS as k}
    {@const v = Math.round(n[k])}
    <div class="need" style="--v:{v};--c:{v >= 50 ? '#3FA06A' : v >= 25 ? '#E8A33A' : '#E0583F'}" title="{NEED_LABEL[k]} {v}%">
      <div class="ring"><span>{@html ICON[k]}</span></div>
      <em>{NEED_LABEL[k]} {v}</em>
    </div>
  {/each}
</div>

<style>
  .needs { position: absolute; z-index: 5; top: calc(var(--safe-t) + 112px); left: max(10px, var(--safe-l)); right: max(10px, var(--safe-r)); display: flex; justify-content: space-between; pointer-events: none; }
  .need { display: flex; flex-direction: column; align-items: center; gap: 3px; font-weight: 700; font-size: 12px; }
  .ring { width: 44px; height: 44px; border-radius: 50%; border: 2.5px solid var(--ink); background: conic-gradient(var(--c) calc(var(--v) * 1%), var(--track) 0); display: grid; place-items: center; box-shadow: 0 2px 0 var(--ink); }
  .ring span { width: 29px; height: 29px; border-radius: 50%; background: var(--paper); border: 2px solid var(--ink); display: grid; place-items: center; }
  .ring :global(svg) { width: 16px; height: 16px; }
  em { font-style: normal; background: rgba(255,253,247,.9); border: 2px solid var(--ink); border-radius: 9px; padding: 0 6px; font-variant-numeric: tabular-nums; white-space: nowrap; }
  @media (min-width: 900px) and (min-aspect-ratio: 1/1) {
    .needs { top: calc(var(--safe-t) + 120px); right: auto; flex-direction: column; gap: 10px; }
    .need { flex-direction: row; gap: 8px; font-size: 13.5px; }
  }
</style>
