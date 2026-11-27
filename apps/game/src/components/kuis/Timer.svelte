<script lang="ts">
  // Lingkar hitung mundur soal kuis (waktu dari server: deadline & jam server). Habis → onexpire sekali.
  // Gerak dikurangi: lingkar berubah per detik tanpa transisi halus & tanpa denyut.
  import { onDestroy } from 'svelte';
  import { reducedMotion } from '../../lib/motion';
  let { deadline, total, now, stopped = false, onexpire, size = 52 }: {
    deadline: number; total: number; now: () => number; stopped?: boolean; onexpire?: () => void; size?: number;
  } = $props();
  const less = reducedMotion();
  let left = $state(Math.max(0, deadline - now()));
  let fired = false;
  const iv = setInterval(() => {
    if (stopped) return;
    left = Math.max(0, deadline - now());
    if (left <= 0 && !fired) { fired = true; onexpire?.(); }
  }, less ? 1000 : 150);
  onDestroy(() => clearInterval(iv));
  $effect(() => { void deadline; fired = false; left = Math.max(0, deadline - now()); });
  const secs = $derived(Math.ceil(left / 1000));
  const frac = $derived(total > 0 ? Math.max(0, Math.min(1, (less ? secs * 1000 : left) / total)) : 0);
  const R = 20, CIRC = 2 * Math.PI * R;
  const tone = $derived(secs <= 3 ? 'low' : secs <= Math.ceil(total / 3000) ? 'mid' : 'ok');
</script>

<div class="timer {tone}" class:stopped class:less style="width:{size}px;height:{size}px" role="timer" aria-live="off" aria-label="Sisa waktu {secs} detik">
  <svg viewBox="0 0 48 48" aria-hidden="true">
    <circle cx="24" cy="24" r={R} class="track" />
    <circle cx="24" cy="24" r={R} class="bar" stroke-dasharray={CIRC} stroke-dashoffset={CIRC * (1 - frac)} transform="rotate(-90 24 24)" />
  </svg>
  <b>{secs}</b>
</div>

<style>
  .timer { position: relative; display: grid; place-items: center; flex: none; background: var(--paper); border-radius: 50%; border: 2.5px solid var(--ink); box-shadow: 0 3px 0 var(--ink); }
  svg { position: absolute; inset: 2px; width: calc(100% - 4px); height: calc(100% - 4px); }
  .track { fill: none; stroke: var(--track); stroke-width: 6; }
  .bar { fill: none; stroke: var(--ok); stroke-width: 6; stroke-linecap: round; transition: stroke-dashoffset .15s linear, stroke .3s; }
  .mid .bar { stroke: var(--warn); }
  .low .bar { stroke: var(--low); }
  b { position: relative; font-size: 18px; font-weight: 800; line-height: 1; }
  .low b { color: #B23A24; }
  .low:not(.stopped) { animation: kz-beat 1s ease-in-out infinite; }
  .stopped { opacity: .6; }
  .less .bar { transition: none; }
  .less.low { animation: none; }
  @keyframes kz-beat { 50% { transform: scale(1.08); } }
  @media (prefers-reduced-motion: reduce) { .bar { transition: none; } .low:not(.stopped) { animation: none; } }
  :global(:root.reduce-motion) .bar { transition: none; }
  :global(:root.reduce-motion) .low:not(.stopped) { animation: none; }
</style>
