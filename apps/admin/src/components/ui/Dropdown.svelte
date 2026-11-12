<script lang="ts">
  // Tombol + kotak melayang. Tertutup saat klik di luar atau Esc.
  import type { Snippet } from 'svelte';
  let { button, children, open = $bindable(false), align = 'left', width = 0, label = '' }: {
    button: Snippet; children: Snippet; open?: boolean; align?: 'left' | 'right'; width?: number; label?: string;
  } = $props();
  let root: HTMLElement;
  function outside(e: MouseEvent) { if (open && root && !root.contains(e.target as Node)) open = false; }
</script>
<svelte:window onclick={outside} onkeydown={(e) => { if (e.key === 'Escape' && open) open = false; }} />
<div class="dd" bind:this={root}>
  <button type="button" class="trig" aria-expanded={open} aria-haspopup="true" aria-label={label || undefined} onclick={() => (open = !open)}>{@render button()}</button>
  {#if open}<div class="pop {align}" style={width ? `width:${width}px` : ''}>{@render children()}</div>{/if}
</div>
<style>
  .dd { position: relative; display: inline-flex; }
  .trig { all: unset; display: inline-flex; cursor: pointer; border-radius: 10px; }
  .trig:focus-visible { outline: 3px solid #3F7FBF; outline-offset: 2px; }
  .pop { position: absolute; top: calc(100% + 6px); z-index: 60; min-width: 220px; max-height: min(420px, 70vh); overflow-y: auto; background: #fff; border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow); padding: 6px; animation: pop .14s ease-out; transform-origin: top; }
  .pop.left { left: 0; } .pop.right { right: 0; }
</style>
