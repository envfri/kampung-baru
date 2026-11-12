<script lang="ts">
  import type { Snippet } from 'svelte';
  import { I } from '../../lib/icons';
  let { icon = 'search', title, text = '', children }: { icon?: string; title: string; text?: string; children?: Snippet } = $props();
</script>
<div class="empty">
  <span class="ico">{@html (I as any)[icon] ?? I.search}</span>
  <b>{title}</b>{#if text}<p>{text}</p>{/if}
  {#if children}<div class="row">{@render children()}</div>{/if}
</div>
<style>
  .empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; padding: 34px 16px; color: var(--muted); }
  .ico { width: 48px; height: 48px; border-radius: 16px; background: #F1F4F2; display: grid; place-items: center; padding: 12px; color: #8A93A0; }
  .ico :global(svg) { width: 100%; height: 100%; }
  b { color: var(--ink); font-size: 15px; } p { margin: 0; max-width: 46ch; font-size: 13.5px; }
  .row { margin-top: 6px; justify-content: center; }
</style>
