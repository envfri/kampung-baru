<script lang="ts">
  // Bar progres. tone 'auto' = merah bila rendah, kuning bila sedang (untuk kebutuhan pet), 'full' = kuning saat penuh (jatah habis).
  let { value = 0, max = 100, tone = 'ok', h = 6, label = '' }: { value?: number; max?: number; tone?: 'ok' | 'auto' | 'warn' | 'no' | 'blue' | 'full'; h?: number; label?: string } = $props();
  const pct = $derived(Math.max(0, Math.min(100, max ? (value / max) * 100 : 0)));
  const t = $derived(tone === 'auto' ? (pct < 25 ? 'no' : pct < 50 ? 'warn' : 'ok') : tone === 'full' ? (pct >= 100 ? 'warn' : 'blue') : tone);
</script>
<div class="bar" style="height:{h}px" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max} aria-label={label || undefined}><i class={t} style="width:{pct}%"></i></div>
<style>
  .bar { background: #E8ECE9; border-radius: 99px; overflow: hidden; width: 100%; }
  i { display: block; height: 100%; border-radius: 99px; background: var(--accent); transition: width .5s cubic-bezier(.2,.8,.2,1); }
  i.warn { background: #E3A21A; } i.no { background: #D4553A; } i.blue { background: #3F7FBF; }
</style>
