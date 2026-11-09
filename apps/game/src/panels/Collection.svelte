<script lang="ts">
  import { onMount } from 'svelte';
  import Sheet from '../components/Sheet.svelte';
  import { itemIcon } from '@kb/shared';
  import { G, fail } from '../lib/game.svelte';
  import { api } from '../lib/api';
  let rows = $state<Record<string, any>>({});
  const fish = $derived((G.catalog?.items ?? []).filter((i) => Number(i.data?.fishWeight) > 0));
  onMount(async () => {
    try { const r = await api.get('/api/fish/collection'); rows = Object.fromEntries(r.collection.map((c: any) => [c.fish_id, c])); } catch (e) { fail(e); }
  });
  const got = $derived(fish.filter((f) => rows[f.id]).length);
</script>

<Sheet title="Koleksi kolam">
  <p class="lead">Tertangkap {got} dari {fish.length} jenis.</p>
  <div class="grid">
    {#each fish as f (f.id)}
      {@const c = rows[f.id]}
      <div class="cell" class:unk={!c}>
        <div class="ic">{@html itemIcon(f)}</div>
        <b>{c ? f.name : '???'}</b>
        <span>{c ? `${c.count}× · rekor ${c.best_cm} cm` : 'Belum tertangkap'}</span>
      </div>
    {/each}
  </div>
</Sheet>

<style>
  .lead { margin: 0; font-weight: 700; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: 10px; }
  .cell { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 2px; border: 2px solid var(--ink); border-radius: 14px; padding: 8px; background: var(--card); }
  .ic { width: 100%; height: 60px; display: grid; place-items: center; background: var(--tint); border-radius: 10px; }
  .ic :global(svg) { height: 54px; width: auto; }
  .unk .ic { filter: brightness(0) opacity(.25); }
  b { font-size: 14.5px; } span { font-size: 12px; color: var(--muted); font-weight: 600; }
</style>
