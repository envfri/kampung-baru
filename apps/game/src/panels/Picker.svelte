<script lang="ts">
  import Sheet from '../components/Sheet.svelte';
  import ItemCard from '../components/ItemCard.svelte';
  import { G, item, run, post, toast } from '../lib/game.svelte';
  import { api } from '../lib/api';
  import { sfx } from '../lib/sfx';

  const mode = G.sheet as 'seed' | 'gift';
  const arg = G.sheetArg ?? {};
  let message = $state('');
  const list = $derived(
    Object.entries(G.me.inventory ?? {})
      .map(([id, n]) => ({ it: item(id), n: n as number }))
      .filter((x) => x.it && x.n > 0 && (mode === 'seed' ? x.it.kind === 'seed' : !['wallpaper', 'floor'].includes(x.it.kind)))
      .sort((a, b) => a.it!.name.localeCompare(b.it!.name)),
  );

  async function pick(id: string) {
    if (mode === 'seed') {
      const r = await run(() => post('/api/garden/plant', { slot: arg.slot, seedId: id }));
      if (r) { sfx.pop(); toast(`${item(id)?.name} ditanam`, 'good'); G.sheet = null; }
    } else {
      const r = await run(() => api.post('/api/gifts', { to: arg.to, itemId: id, message }));
      if (r) { sfx.level(); toast(`Hadiah terkirim ke ${arg.name}`, 'good'); G.sheet = null; }
    }
  }
</script>

<Sheet title={mode === 'seed' ? 'Pilih bibit' : `Kirim hadiah ke ${arg.name ?? 'teman'}`}>
  {#if mode === 'gift'}
    <input class="input" maxlength="80" placeholder="Pesan singkat (opsional)" bind:value={message} aria-label="Pesan" />
    <p class="muted">Pilih satu barang dari tas. Maksimal {G.catalog?.settings?.social?.giftsPerDay ?? 5} hadiah per hari.</p>
  {/if}
  {#if list.length === 0}
    <p class="muted">{mode === 'seed' ? 'Belum punya bibit. Beli di Pasar Pagi.' : 'Tas kosong.'}</p>
    {#if mode === 'seed'}<button class="btn hot" onclick={() => { G.shopId = 'pasar'; G.sheet = 'shop'; }}>Ke Pasar Pagi</button>{/if}
  {/if}
  <div class="grid">
    {#each list as { it, n } (it!.id)}
      <ItemCard it={it!} badge="×{n}" sub={mode === 'seed' ? `${it!.data?.growMinutes} mnt` : ''}>
        <button class="btn sm hot" disabled={G.busy} onclick={() => pick(it!.id)}>{mode === 'seed' ? 'Tanam' : 'Kirim'}</button>
      </ItemCard>
    {/each}
  </div>
</Sheet>

<style>
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 10px; }
  .muted { margin: 0; font-weight: 600; }
</style>
