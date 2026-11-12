<script lang="ts">
  let { checked = $bindable(false), disabled = false, label = '', help = '', ariaLabel = '', onchange }: { checked?: boolean; disabled?: boolean; label?: string; help?: string; ariaLabel?: string; onchange?: (v: boolean) => void } = $props();
</script>
<label class="sw" class:disabled>
  <input type="checkbox" role="switch" bind:checked {disabled} aria-label={ariaLabel || undefined} onchange={() => onchange?.(checked)} />
  <span class="track" aria-hidden="true"></span>
  {#if label || help}<span class="txt">{#if label}<b>{label}</b>{/if}{#if help}<small>{help}</small>{/if}</span>{/if}
</label>
<style>
  .sw { flex-direction: row; align-items: flex-start; gap: 10px; cursor: pointer; font-weight: 600; }
  .sw.disabled { opacity: .55; cursor: not-allowed; }
  input { position: absolute; opacity: 0; width: 1px; height: 1px; }
  .track { width: 38px; height: 22px; border-radius: 99px; background: #C5CDC8; position: relative; flex: none; transition: background .18s; margin-top: 1px; }
  .track::after { content: ''; position: absolute; left: 3px; top: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.25); transition: left .18s; }
  input:checked + .track { background: var(--accent); }
  input:checked + .track::after { left: 19px; }
  input:focus-visible + .track { outline: 3px solid #3F7FBF; outline-offset: 2px; }
  .txt { display: flex; flex-direction: column; gap: 1px; } .txt b { font-size: 13.5px; } .txt small { font-weight: 400; color: var(--muted); font-size: 12.5px; }
</style>
