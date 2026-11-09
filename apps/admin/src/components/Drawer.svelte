<script lang="ts">
  import type { Snippet } from 'svelte';
  let { title, children, footer, onclose, wide = false }: { title: string; children: Snippet; footer?: Snippet; onclose: () => void; wide?: boolean } = $props();
</script>
<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />
<div class="bd" onclick={onclose} role="presentation"></div>
<section class="drawer" class:wide role="dialog" aria-modal="true" aria-label={title}>
  <header><h2>{title}</h2><button class="btn sm" onclick={onclose}>Tutup</button></header>
  <div class="body">{@render children()}</div>
  {#if footer}<footer>{@render footer()}</footer>{/if}
</section>
<style>
  .bd { position: fixed; inset: 0; background: rgba(43,47,74,.3); z-index: 40; }
  .drawer { position: fixed; z-index: 41; top: 0; right: 0; bottom: 0; width: min(560px, 100vw); background: var(--paper); display: flex; flex-direction: column; box-shadow: -10px 0 30px rgba(0,0,0,.15); animation: in .2s ease-out; }
  .drawer.wide { width: min(860px, 100vw); }
  header { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 14px 18px; border-bottom: 1px solid var(--line); }
  .body { flex: 1; overflow-y: auto; padding: 16px 18px 24px; display: flex; flex-direction: column; gap: 14px; }
  footer { display: flex; gap: 8px; justify-content: flex-end; padding: 12px 18px; border-top: 1px solid var(--line); background: #fff; flex-wrap: wrap; }
  @keyframes in { from { transform: translateX(40px); opacity: .5; } }
</style>
