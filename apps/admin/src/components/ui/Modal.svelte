<script lang="ts">
  // Modal di tengah layar: ikon bernada (bahaya/peringatan/info), isi, kaki tombol. Esc / klik latar = tutup.
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';
  import { I } from '../../lib/icons';
  let { title, sub = '', icon = '', tone = 'info', wide = false, onclose, children, footer }: {
    title: string; sub?: string; icon?: string; tone?: 'danger' | 'warn' | 'info' | 'ok'; wide?: boolean;
    onclose: () => void; children: Snippet; footer?: Snippet;
  } = $props();
  let box: HTMLElement;
  onMount(() => {
    const prev = document.activeElement as HTMLElement | null;
    setTimeout(() => (box?.querySelector('input:not([type=checkbox]), textarea, select') as HTMLElement | null)?.focus(), 30);
    return () => prev?.focus?.();
  });
</script>
<svelte:window onkeydown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onclose(); } }} />
<div class="bd" onclick={onclose} role="presentation"></div>
<section class="modal" class:wide role="dialog" aria-modal="true" aria-label={title} bind:this={box}>
  <header>
    {#if icon}<span class="wi {tone}">{@html (I as any)[icon] ?? ''}</span>{/if}
    <div class="t"><h2>{title}</h2>{#if sub}<p>{sub}</p>{/if}</div>
    <button class="btn ghost sm icon" aria-label="Tutup" onclick={onclose}>{@html I.x}</button>
  </header>
  <div class="body">{@render children()}</div>
  {#if footer}<footer>{@render footer()}</footer>{/if}
</section>
<style>
  .bd { position: fixed; inset: 0; background: rgba(43, 47, 74, .38); z-index: 90; animation: fadein .15s; }
  .modal { position: fixed; z-index: 91; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(480px, calc(100vw - 24px)); max-height: calc(100vh - 32px); display: flex; flex-direction: column; background: #fff; border-radius: 18px; box-shadow: 0 30px 80px rgba(0, 0, 0, .3); overflow: hidden; animation: mpop .18s ease-out; }
  .modal.wide { width: min(680px, calc(100vw - 24px)); }
  @keyframes mpop { from { transform: translate(-50%, -48%) scale(.97); opacity: 0; } }
  header { display: flex; gap: 12px; align-items: flex-start; padding: 18px 16px 6px 20px; }
  .t { flex: 1; min-width: 0; } .t h2 { font-size: 21px; } .t p { margin: 4px 0 0; color: var(--muted); font-size: 13.5px; line-height: 1.45; }
  .wi { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; flex: none; padding: 9px; }
  .wi :global(svg) { width: 100%; height: 100%; }
  .wi.danger { background: var(--danger-soft); color: var(--danger); } .wi.warn { background: var(--warn-soft); color: var(--warn); }
  .wi.info { background: var(--info-soft); color: var(--info); } .wi.ok { background: var(--accent-soft); color: var(--accent); }
  .body { padding: 8px 20px 16px; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; }
  footer { padding: 12px 20px; background: #F8FAF8; border-top: 1px solid var(--line); display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
  @media (max-width: 760px) {
    .modal { left: 0; right: 0; top: auto; bottom: 0; transform: none; width: 100%; border-radius: 20px 20px 0 0; max-height: 92vh; animation: slideup .2s ease-out; }
    footer :global(.btn) { flex: 1; }
  }
</style>
