<script lang="ts">
  // Kartu yang bisa dilipat (show/hide). Status buka/tutup diingat per admin bila prefKey diisi.
  import type { Snippet } from 'svelte';
  import { pref, savePref } from '../../lib/store.svelte';
  import { I } from '../../lib/icons';
  let { title, sub = '', open = $bindable(true), prefKey = '', badge, actions, children, id = '', dim = false }: {
    title: string; sub?: string; open?: boolean; prefKey?: string; badge?: Snippet; actions?: Snippet; children: Snippet; id?: string; dim?: boolean;
  } = $props();
  if (prefKey) open = pref(`sec:${prefKey}`, open);
  function toggle() { open = !open; if (prefKey) savePref(`sec:${prefKey}`, open); }
</script>
<section class="sec card" class:closed={!open} class:dim {id}>
  <header>
    <button class="hd" aria-expanded={open} onclick={toggle}>
      <h2>{title}</h2>{#if badge}{@render badge()}{/if}
      <span class="chev" class:open>{@html I.down}</span>
    </button>
    {#if actions}<div class="acts">{@render actions()}</div>{/if}
  </header>
  {#if open}<div class="in fade">{#if sub}<p class="muted sub">{sub}</p>{/if}{@render children()}</div>{/if}
</section>
<style>
  .sec { padding: 0; display: flex; flex-direction: column; transition: opacity .2s; }
  .sec.dim { opacity: .45; }
  header { display: flex; align-items: center; gap: 8px; padding: 4px 8px 4px 4px; }
  .hd { all: unset; flex: 1; display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 10px 12px; border-radius: 12px; min-width: 0; }
  .hd:focus-visible { outline: 3px solid #3F7FBF; }
  .hd h2 { font-size: 18px; }
  .chev { margin-left: auto; width: 18px; height: 18px; color: var(--muted); transition: transform .2s; transform: rotate(-90deg); }
  .chev.open { transform: none; }
  .chev :global(svg) { width: 100%; height: 100%; }
  .acts { display: flex; gap: 6px; }
  .in { padding: 0 16px 16px; display: flex; flex-direction: column; gap: 12px; }
  .sub { margin: 0; font-size: 13.5px; }
</style>
