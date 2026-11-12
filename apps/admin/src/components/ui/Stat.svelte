<script lang="ts">
  import { I } from '../../lib/icons';
  let { icon, value, label, tone = 'ok', onclick, active = false }: { icon: string; value: string | number; label: string; tone?: 'ok' | 'warn' | 'no' | 'blue'; onclick?: () => void; active?: boolean } = $props();
</script>
{#if onclick}
  <button class="stat {tone}" class:active {onclick}><span class="sic">{@html (I as any)[icon]}</span><span><b>{value}</b><small>{label}</small></span></button>
{:else}
  <div class="stat {tone}"><span class="sic">{@html (I as any)[icon]}</span><span><b>{value}</b><small>{label}</small></span></div>
{/if}
<style>
  .stat { all: unset; box-sizing: border-box; background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 10px 14px; display: flex; align-items: center; gap: 12px; min-width: 0; transition: border-color .15s, box-shadow .15s; }
  button.stat { cursor: pointer; } button.stat:hover { border-color: #AEB8B2; } button.stat:focus-visible { outline: 3px solid #3F7FBF; }
  .stat.active { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
  .sic { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; padding: 9px; flex: none; background: var(--accent-soft); color: var(--accent); }
  .sic :global(svg) { width: 100%; height: 100%; }
  .warn .sic { background: var(--warn-soft); color: var(--warn); } .no .sic { background: var(--danger-soft); color: var(--danger); } .blue .sic { background: var(--info-soft); color: var(--info); }
  b { font: 800 22px var(--display); display: block; line-height: 1.05; font-variant-numeric: tabular-nums; }
  small { font-size: 12px; color: var(--muted); font-weight: 600; }
</style>
