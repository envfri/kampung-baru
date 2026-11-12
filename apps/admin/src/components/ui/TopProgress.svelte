<script lang="ts">
  // Bar progres tipis di atas layar selama ada permintaan ke server.
  import { NET } from '../../lib/net.svelte';
  let w = $state(0), show = $state(false);
  let t: ReturnType<typeof setInterval> | undefined, h: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    if (NET.n > 0) {
      clearTimeout(h);
      if (!show) { show = true; w = 8; }
      clearInterval(t);
      t = setInterval(() => { w = Math.min(90, w + (90 - w) * 0.12); }, 120);
    } else if (show) {
      clearInterval(t);
      w = 100;
      h = setTimeout(() => { show = false; w = 0; }, 260);
    }
  });
</script>
<div class="tp" class:show style="width:{w}%" aria-hidden="true"></div>
<style>
  .tp { position: fixed; z-index: 200; left: 0; top: 0; height: 3px; background: linear-gradient(90deg, var(--accent), var(--accent-2)); box-shadow: 0 0 8px var(--accent-2); border-radius: 0 3px 3px 0; opacity: 0; transition: width .2s ease-out, opacity .25s; pointer-events: none; }
  .tp.show { opacity: 1; }
</style>
