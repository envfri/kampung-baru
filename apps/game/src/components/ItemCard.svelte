<script lang="ts">
  import type { Snippet } from 'svelte';
  import { itemIcon } from '@kb/shared';
  let { it, sub = '', badge = '', tried = false, children }: { it: any; sub?: string; badge?: string; tried?: boolean; children?: Snippet } = $props();
</script>

<div class="card" class:tried>
  {#if badge}<span class="badge">{badge}</span>{/if}
  <div class="ic">{@html itemIcon(it)}</div>
  <div class="name">{it.name}</div>
  <div class="sub">{sub}</div>
  {#if children}{@render children()}{/if}
</div>

<style>
  .card { position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; border: 2px solid var(--ink); border-radius: 14px; padding: 8px 6px 10px; background: var(--card); min-width: 0; }
  /* sedang dicoba di Kaca Pas (Butik) */
  .card.tried { border-color: #1E7A4C; box-shadow: 0 0 0 3px #3FA06A; }
  .ic { width: 100%; height: 66px; display: grid; place-items: center; background: var(--tint); border-radius: 10px; }
  .ic :global(svg) { height: 60px; width: auto; max-width: 100%; }
  .name { font-weight: 800; font-size: 14.5px; line-height: 1.12; }
  .sub { font-size: 12.5px; font-weight: 600; color: var(--muted); line-height: 1.2; min-height: 15px; }
  .badge { position: absolute; top: -8px; right: -6px; background: var(--low); color: #fff; border: 2px solid var(--ink); border-radius: 10px; font-size: 11.5px; font-weight: 800; padding: 0 6px; z-index: 1; }
</style>
