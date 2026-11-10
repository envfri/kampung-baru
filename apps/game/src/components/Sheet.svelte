<script lang="ts">
  import type { Snippet } from 'svelte';
  import { G } from '../lib/game.svelte';
  import { I } from '../lib/icons';
  let { title, children, actions, onclose }: { title: string; children: Snippet; actions?: Snippet; onclose?: () => void } = $props();
  const close = () => (onclose ? onclose() : ((G.sheet = null), (G.sheetArg = null)));
  let startY = 0, dy = $state(0), dragging = $state(false);
  function down(e: PointerEvent) { startY = e.clientY; dragging = true; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }
  function move(e: PointerEvent) { if (dragging) dy = Math.max(0, e.clientY - startY); }
  function up() { if (!dragging) return; dragging = false; if (dy > 90) close(); dy = 0; }
  function key(e: KeyboardEvent) { if (e.key === 'Escape') close(); }
</script>

<svelte:window onkeydown={key} />
<div class="backdrop" onclick={close} role="presentation"></div>
<section class="sheet" role="dialog" aria-modal="true" aria-label={title} style="transform: translateY({dy}px)" class:dragging>
  <header onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}>
    <span class="grip" aria-hidden="true"></span>
    <h2>{title}</h2>
    <div class="acts">
      {#if actions}{@render actions()}{/if}
      <button class="x" onclick={close} aria-label="Tutup">{@html I.close}</button>
    </div>
  </header>
  <div class="body">{@render children()}</div>
</section>

<style>
  .backdrop { position: fixed; inset: 0; background: rgba(43, 47, 74, .28); z-index: 40; animation: fade .2s; }
  .sheet { position: fixed; left: 0; right: 0; bottom: 0; z-index: 41; max-height: 84dvh; display: flex; flex-direction: column; background: var(--paper); border: 3px solid var(--ink); border-bottom: 0; border-radius: 24px 24px 0 0; box-shadow: 0 -4px 0 rgba(43,47,74,.15); animation: up .25s ease-out; padding-bottom: var(--safe-b); transition: transform .2s; }
  .sheet.dragging { transition: none; }
  header { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 16px 12px 10px 18px; border-bottom: 2.5px solid var(--ink); background: var(--soft); border-radius: 21px 21px 0 0; touch-action: none; cursor: grab; }
  .grip { position: absolute; top: 6px; left: 50%; transform: translateX(-50%); width: 42px; height: 5px; border-radius: 3px; background: rgba(43,47,74,.3); }
  h2 { margin: 0; font-size: 22px; font-weight: 800; }
  .acts { display: flex; gap: 6px; align-items: center; }
  .x { width: 40px; height: 40px; border-radius: 12px; border: 2.5px solid var(--ink); background: var(--paper); display: grid; place-items: center; cursor: pointer; padding: 0; }
  .x :global(svg) { width: 20px; height: 20px; }
  .body > :global(*) { flex-shrink: 0; }
  .body { overflow-y: auto; padding: 14px 14px 20px; display: flex; flex-direction: column; gap: 14px; overscroll-behavior: contain; padding-left: max(14px, var(--safe-l)); padding-right: max(14px, var(--safe-r)); }
  @media (min-width: 900px) and (min-aspect-ratio: 1/1) {
    /* mulai di bawah HUD supaya koin & Mutiara tetap terlihat saat panel terbuka */
    .sheet { left: auto; right: 14px; top: calc(var(--safe-t) + 108px); bottom: 14px; width: 440px; max-height: none; border: 3px solid var(--ink); border-radius: 22px; box-shadow: 0 5px 0 var(--ink); animation: slide .25s ease-out; padding-bottom: 0; }
    header { border-radius: 19px 19px 0 0; cursor: default; }
    .grip { display: none; }
    .backdrop { background: rgba(43, 47, 74, .12); }
  }
  @keyframes up { from { transform: translateY(40%); opacity: .4; } to { transform: none; opacity: 1; } }
  @keyframes slide { from { transform: translateX(30px); opacity: .4; } to { transform: none; opacity: 1; } }
  @keyframes fade { from { opacity: 0; } }
</style>
