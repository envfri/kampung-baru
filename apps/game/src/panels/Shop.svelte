<script lang="ts">
  import Sheet from '../components/Sheet.svelte';
  import ItemCard from '../components/ItemCard.svelte';
  import { G, canBuy, effText, fmt, owned, run, post, toast } from '../lib/game.svelte';
  import { footprint } from '@kb/shared';
  import { COIN, PEARL } from '../lib/icons';
  import { sfx } from '../lib/sfx';

  const shops = $derived((G.catalog?.locations ?? []).filter((l) => l.kind === 'shop' || l.kind === 'pearl'));
  const cur = $derived(shops.find((s) => s.id === G.shopId) ?? shops[0]);
  let tab = $state<'buy' | 'sell'>('buy');
  let confirm = $state('');
  const list = $derived((G.catalog?.items ?? []).filter((i) => i.shop === cur?.id && canBuy(i)));
  const sellable = $derived(Object.entries(G.me.inventory ?? {}).map(([id, n]) => ({ it: G.catalog?.items.find((i) => i.id === id), n: n as number })).filter((x) => x.it && x.it.sell_coin > 0));
  const eventIds = $derived(new Set((G.me.events ?? []).map((e: any) => e.id)));

  function sub(it: any) {
    if (it.kind === 'food') return effText(it.data?.effects);
    if (it.kind === 'furniture') { const f = footprint(it); return `Ukuran ${f.w}×${f.d}${f.flat ? ' · karpet' : ''}`; }
    if (it.kind === 'seed') return `Panen dalam ${it.data?.growMinutes} mnt`;
    if (it.kind === 'wear') return { head: 'Kepala', face: 'Wajah', neck: 'Leher' }[it.data?.slot as 'head'] ?? '';
    if (it.kind === 'wallpaper') return 'Dinding';
    if (it.kind === 'floor') return 'Lantai';
    return it.description ?? '';
  }

  async function buy(it: any, currency: 'coin' | 'pearl') {
    const price = currency === 'coin' ? it.price_coin : it.price_pearl;
    if ((currency === 'pearl' || price >= 150) && confirm !== it.id) { confirm = it.id; sfx.tap(); return; }
    confirm = '';
    const r = await run(() => post('/api/shop/buy', { itemId: it.id, currency }));
    if (r) { sfx.coin(); toast(`${it.name} masuk Tas`, 'good'); }
  }
  async function sell(it: any) {
    if (confirm !== 'sell:' + it.id) { confirm = 'sell:' + it.id; sfx.tap(); return; }
    confirm = '';
    const r: any = await run(() => post('/api/shop/sell', { itemId: it.id }));
    if (r) { sfx.coin(); toast(`Terjual +${r.earned} koin`, 'good'); }
  }
</script>

<Sheet title={cur?.name ?? 'Toko'}>
  <div class="tabs" role="tablist">
    {#each shops as s}
      <button role="tab" aria-selected={s.id === cur?.id} class:on={s.id === cur?.id} onclick={() => { G.shopId = s.id; tab = 'buy'; confirm = ''; }}>{s.name}</button>
    {/each}
  </div>
  {#if cur?.sells_back}
    <div class="seg">
      <button class:on={tab === 'buy'} onclick={() => (tab = 'buy')}>Beli</button>
      <button class:on={tab === 'sell'} onclick={() => (tab = 'sell')}>Jual</button>
    </div>
  {/if}
  {#if cur?.kind === 'pearl'}
    <button class="btn block pearlbuy" onclick={() => (G.sheet = 'pearls')}>{@html PEARL} Tambah Mutiara</button>
  {/if}

  {#if tab === 'buy'}
    {#if list.length === 0}<p class="muted">Belum ada barang di toko ini.</p>{/if}
    <div class="grid">
      {#each list as it (it.id)}
        <ItemCard {it} sub={sub(it)} badge={it.event_id && eventIds.has(it.event_id) ? 'Event' : owned(it.id) ? `×${owned(it.id)}` : ''}>
          {#if it.price_coin > 0}
            <button class="btn sm" class:hot={confirm === it.id} disabled={G.busy || G.me.wallet.coin < it.price_coin} onclick={() => buy(it, 'coin')}>
              {#if confirm === it.id}Yakin?{:else}{@html COIN}{fmt(it.price_coin)}{/if}
            </button>
          {/if}
          {#if it.price_pearl > 0}
            <button class="btn sm" class:hot={confirm === it.id} disabled={G.busy || G.me.wallet.pearl < it.price_pearl} onclick={() => buy(it, 'pearl')}>
              {#if confirm === it.id}Yakin?{:else}{@html PEARL}{fmt(it.price_pearl)}{/if}
            </button>
          {/if}
        </ItemCard>
      {/each}
    </div>
  {:else}
    {#if sellable.length === 0}<p class="muted">Tidak ada barang yang bisa dijual. Hasil kebun, ikan, dan barang bekas bisa dijual di sini.</p>{/if}
    <div class="grid">
      {#each sellable as { it, n } (it.id)}
        <ItemCard {it} sub="Punya {n}">
          <button class="btn sm" class:hot={confirm === 'sell:' + it.id} disabled={G.busy} onclick={() => sell(it)}>
            {#if confirm === 'sell:' + it.id}Jual?{:else}+{@html COIN}{it.sell_coin}{/if}
          </button>
        </ItemCard>
      {/each}
    </div>
  {/if}
</Sheet>

<style>
  .tabs { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; margin: 0 -2px; padding: 2px; }
  .tabs button { flex: none; border: 2px solid var(--ink); background: var(--paper); border-radius: 12px; padding: 5px 12px; font-weight: 700; font-size: 14.5px; cursor: pointer; min-height: 38px; }
  .tabs button.on { background: var(--ink); color: var(--paper); }
  .seg { display: flex; border: 2.5px solid var(--ink); border-radius: 12px; overflow: hidden; }
  .seg button { flex: 1; border: 0; background: var(--paper); font-weight: 800; font-size: 15px; min-height: 38px; cursor: pointer; }
  .seg button.on { background: var(--coin); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 10px; }
  .pearlbuy { background: #ECE6F6; }
  .muted { margin: 0; }
</style>
