<script lang="ts">
  let { tabs, active = $bindable(), onchange }: { tabs: { k: string; label: string; count?: number | null; tone?: 'warn' | 'no' | '' }[]; active: string; onchange?: (k: string) => void } = $props();
</script>
<div class="tabs" role="tablist">
  {#each tabs as t (t.k)}
    <button role="tab" aria-selected={active === t.k} class:on={active === t.k} onclick={() => { active = t.k; onchange?.(t.k); }}>
      {t.label}{#if t.count != null}<em class={t.tone ?? ''}>{t.count}</em>{/if}
    </button>
  {/each}
</div>
<style>
  .tabs { display: flex; gap: 2px; overflow-x: auto; scrollbar-width: none; }
  button { all: unset; cursor: pointer; padding: 9px 12px 8px; font-weight: 600; font-size: 14px; color: var(--muted); border-bottom: 2.5px solid transparent; display: inline-flex; gap: 6px; align-items: center; white-space: nowrap; transition: color .15s, border-color .15s; }
  button:hover { color: var(--ink); }
  button.on { color: var(--ink); border-color: var(--accent); }
  button:focus-visible { outline: 3px solid #3F7FBF; outline-offset: -3px; border-radius: 6px; }
  em { font-style: normal; font-size: 11.5px; font-weight: 700; background: #ECEFEC; border-radius: 99px; padding: 0 7px; color: var(--muted); }
  .on em { background: var(--accent-soft); color: var(--accent); }
  em.warn { background: var(--warn-soft); color: var(--warn); } em.no { background: var(--danger-soft); color: var(--danger); }
</style>
