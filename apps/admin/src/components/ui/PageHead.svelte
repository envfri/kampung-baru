<script lang="ts">
  // Judul halaman standar: judul, keterangan, "diperbarui … lalu" + muat ulang, tombol aksi.
  import type { Snippet } from 'svelte';
  import { ago } from '../../lib/store.svelte';
  import { CLOCK } from '../../lib/clock.svelte';
  import { NET } from '../../lib/net.svelte';
  import { I } from '../../lib/icons';
  let { title, sub = '', updated = 0, onrefresh, actions, live = false, children }: {
    title: string; sub?: string; updated?: number; onrefresh?: () => void; actions?: Snippet; live?: boolean; children?: Snippet;
  } = $props();
</script>
<div class="ph">
  <div class="t">
    <h1>{title}</h1>
    {#if sub || updated || children}
      <p>{#if live}<span class="dot"></span>{/if}{#if children}{@render children()}{:else}{sub}{/if}{#if updated}<span class="upd">{sub || children ? ' · ' : ''}diperbarui {ago(updated, CLOCK.now)}</span>{/if}</p>
    {/if}
  </div>
  <div class="acts">
    {#if actions}{@render actions()}{/if}
    {#if onrefresh}<button class="btn icon" title="Muat ulang" aria-label="Muat ulang" aria-busy={NET.n > 0 ? 'true' : undefined} onclick={onrefresh}>{@html I.refresh}</button>{/if}
  </div>
</div>
<style>
  .ph { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .t { min-width: 0; }
  p { margin: 5px 0 0; color: var(--muted); font-size: 13.5px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; max-width: 90ch; }
  .acts { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .acts :global(.btn .ic), .acts :global(.btn svg) { width: 15px; height: 15px; }
  .btn.icon :global(svg) { width: 16px; height: 16px; }
  @media (max-width: 860px) { h1 { display: none; } .ph { align-items: center; } p { margin: 0; } }
</style>
