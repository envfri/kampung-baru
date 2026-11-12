<script lang="ts">
  import { copy } from '../../lib/store.svelte';
  import { I } from '../../lib/icons';
  let { text, label = 'Disalin' }: { text: string; label?: string } = $props();
</script>
<button class="cp" type="button" title="Salin" aria-label="Salin {text}" onclick={(e) => { e.stopPropagation(); copy(text, label); }}>{@html I.copy}</button>
<style>
  .cp { all: unset; cursor: pointer; width: 14px; height: 14px; color: var(--muted); opacity: .7; display: inline-grid; vertical-align: -2px; border-radius: 4px; }
  .cp:hover { opacity: 1; color: var(--accent); }
  .cp:focus-visible { outline: 2px solid #3F7FBF; }
  .cp :global(svg) { width: 100%; height: 100%; }
</style>
