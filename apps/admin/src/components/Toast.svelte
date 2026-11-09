<script lang="ts">
  import { A } from '../lib/store.svelte';
  let show = $state(false);
  let t: any;
  $effect(() => { if (!A.toast.n) return; show = true; clearTimeout(t); t = setTimeout(() => (show = false), A.toast.kind === 'err' ? 4000 : 2200); });
</script>
<div class="toast {A.toast.kind}" class:show role="status" aria-live="polite">{A.toast.text}</div>
<style>
  .toast { position: fixed; right: 18px; bottom: 18px; z-index: 100; max-width: min(420px, 90vw); background: var(--ink); color: #fff; padding: 10px 14px; border-radius: 10px; font-weight: 600; opacity: 0; transform: translateY(8px); transition: .2s; pointer-events: none; }
  .toast.show { opacity: 1; transform: none; }
  .toast.err { background: var(--danger); }
</style>
