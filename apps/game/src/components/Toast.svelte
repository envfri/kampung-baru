<script lang="ts">
  import { G } from '../lib/game.svelte';
  let show = $state(false);
  let timer: any;
  $effect(() => {
    if (G.toast.n === 0) return;
    show = true;
    clearTimeout(timer);
    timer = setTimeout(() => (show = false), G.toast.kind === 'error' ? 2800 : 2000);
  });
</script>

<div class="toast {G.toast.kind}" class:show role="status" aria-live="polite">{G.toast.text}</div>

<style>
  .toast { position: fixed; left: 50%; top: calc(var(--safe-t) + 98px); transform: translate(-50%, -12px); z-index: 80; max-width: min(92vw, 440px); text-align: center; background: var(--ink); color: var(--paper); font-weight: 700; font-size: 15.5px; border-radius: 14px; padding: 9px 16px; opacity: 0; pointer-events: none; transition: opacity .2s, transform .2s; }
  .toast.show { opacity: 1; transform: translate(-50%, 0); }
  .toast.error { background: #A93A27; }
  .toast.good { background: #1E7A4C; }
</style>
