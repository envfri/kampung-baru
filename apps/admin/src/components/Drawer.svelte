<script lang="ts">
  // Laci dari kanan untuk detail / form. Bila ada perubahan belum disimpan (dirty), menutup minta konfirmasi dulu.
  import type { Snippet } from 'svelte';
  import { ask } from '../lib/store.svelte';
  import { I } from '../lib/icons';
  let { title, children, footer, head, tabs, onclose, wide = false, dirty = false }: {
    title: string; children: Snippet; footer?: Snippet; head?: Snippet; tabs?: Snippet; onclose: () => void; wide?: boolean; dirty?: boolean;
  } = $props();
  async function close() {
    if (dirty && !(await ask({ title: 'Buang perubahan?', body: 'Ada perubahan yang belum disimpan. Kalau ditutup sekarang, perubahannya hilang.', tone: 'warn', icon: 'warn', confirm: 'Buang perubahan', cancel: 'Kembali' }))) return;
    onclose();
  }
</script>
<svelte:window onkeydown={(e) => { if (e.key === 'Escape' && !document.querySelector('.modal')) close(); }} />
<div class="bd" onclick={close} role="presentation"></div>
<section class="drawer" class:wide role="dialog" aria-modal="true" aria-label={title}>
  <header>
    {#if head}{@render head()}{:else}<h2>{title}</h2>{/if}
    <button class="btn ghost icon" aria-label="Tutup" onclick={close}>{@html I.x}</button>
  </header>
  {#if tabs}<nav class="tabsrow">{@render tabs()}</nav>{/if}
  <div class="body">{@render children()}</div>
  {#if footer}<footer>{@render footer()}</footer>{/if}
</section>
<style>
  .bd { position: fixed; inset: 0; background: rgba(43,47,74,.3); z-index: 40; animation: fadein .15s; }
  .drawer { position: fixed; z-index: 41; top: 0; right: 0; bottom: 0; width: min(580px, 100vw); background: var(--paper); display: flex; flex-direction: column; box-shadow: -10px 0 30px rgba(0,0,0,.15); animation: in .22s ease-out; }
  .drawer.wide { width: min(880px, 100vw); }
  header { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; padding: 14px 14px 12px 20px; background: #fff; }
  header :global(> :first-child) { flex: 1; min-width: 0; }
  .tabsrow { background: #fff; border-bottom: 1px solid var(--line); padding: 0 16px; overflow-x: auto; }
  header:not(:has(+ .tabsrow)) { border-bottom: 1px solid var(--line); }
  .body { flex: 1; overflow-y: auto; padding: 16px 20px 24px; display: flex; flex-direction: column; gap: 14px; }
  footer { display: flex; gap: 8px; justify-content: flex-end; padding: 12px 18px; border-top: 1px solid var(--line); background: #fff; flex-wrap: wrap; }
  @keyframes in { from { transform: translateX(40px); opacity: .5; } }
</style>
