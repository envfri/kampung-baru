<script lang="ts">
  // Di dalam toko: pet sudah berjalan ke sini dari peta. Yang dijual hanya barang toko ini.
  import { onMount } from 'svelte';
  import ItemCard from '../components/ItemCard.svelte';
  import { G, canBuy, effText, fmt, owned, run, post, toast, switchRoom, settings, item as itemOf } from '../lib/game.svelte';
  import { footprint, itemIcon, renderPet, shade } from '@kb/shared';
  import { COIN, PEARL, I } from '../lib/icons';
  import { sfx } from '../lib/sfx';

  const KEEPERS: Record<string, { name: string; look: any; greet: string }> = {
    pasar: { name: 'Bu Serabi', look: { color: '#F2EEE3', ear: 'kelinci', pattern: 'ujung', eyes: 'senyum' }, greet: 'Jajanan hangat, bibit segar! Mau beli apa hari ini?' },
    mebel: { name: 'Pak Jati', look: { color: '#B98A64', ear: 'anjing', pattern: 'totol', eyes: 'bulat' }, greet: 'Mebel kayu jati asli kampung. Pilih yang cocok buat rumahmu!' },
    butik: { name: 'Mbak Benang', look: { color: '#C9B6E8', ear: 'kucing', pattern: 'bintang', eyes: 'berbinar' }, greet: 'Ada model baru, lho. Coba yang mana?' },
    mutiara: { name: 'Nyai Mutiara', look: { color: '#9FD0E8', ear: 'antena', pattern: 'polos', eyes: 'bintang' }, greet: 'Barang istimewa, khusus dibeli dengan Mutiara.' },
    bangunan: { name: 'Pak Tukang', look: { color: '#F4D58D', ear: 'tunas', pattern: 'belang', eyes: 'bulat' }, greet: 'Mau tambah ruangan atau halaman? Pak Tukang siap bangun!' },
  };
  const KIND_LABEL: Record<string, string> = { food: 'Makanan', seed: 'Bibit', furniture: 'Mebel', wallpaper: 'Dinding', floor: 'Lantai', wear: 'Pakaian', room: 'Ruangan', material: 'Lainnya', fish: 'Ikan' };

  const loc = $derived((G.catalog?.locations ?? []).find((l: any) => l.id === G.shopId));
  const keeper = $derived(KEEPERS[loc?.id] ?? { name: 'Penjaga toko', look: { color: '#A8D8A0', ear: 'tunas' }, greet: `Selamat datang di ${loc?.name ?? 'toko'}!` });
  const all = $derived((G.catalog?.items ?? []).filter((i) => i.shop === loc?.id && canBuy(i)));
  const cats = $derived([...new Set(all.map((i) => i.kind))]);
  let cat = $state('');
  let confirm = $state('');
  const list = $derived(all.filter((i) => !cat || i.kind === cat));
  const sellable = $derived(Object.entries(G.me.inventory ?? {}).map(([id, n]) => ({ it: itemOf(id), n: n as number })).filter((x) => x.it && x.it.sell_coin > 0));
  const eventIds = $derived(new Set((G.me.events ?? []).map((e: any) => e.id)));
  const rooms = $derived<any[]>(G.me.rooms ?? []);
  const maxRooms = $derived(settings().house?.maxRooms ?? 6);
  const body = $derived(loc?.style?.body ?? '#FDF1D6');
  const roof = $derived(loc?.style?.roof ?? '#3FA06A');

  onMount(() => { if (!loc?.sells_back) G.shopTab = 'buy'; });

  function sub(it: any) {
    if (it.kind === 'food') return effText(it.data?.effects);
    if (it.kind === 'furniture') { const f = footprint(it); return `Ukuran ${f.w}×${f.d}${f.flat ? ' · karpet' : ''}`; }
    if (it.kind === 'seed') return `Panen dalam ${it.data?.growMinutes} mnt`;
    if (it.kind === 'wear') return { head: 'Kepala', face: 'Wajah', neck: 'Leher', back: 'Punggung' }[it.data?.slot as 'head'] ?? '';
    if (it.kind === 'wallpaper') return 'Dinding';
    if (it.kind === 'floor') return 'Lantai';
    if (it.kind === 'room') return `${it.data?.theme === 'luar' ? 'Halaman' : 'Ruangan'} ${it.data?.size ?? 6}×${it.data?.size ?? 6}`;
    return it.description ?? '';
  }
  const ownRoom = (id: string) => rooms.find((r) => r.item === id);

  async function buy(it: any, currency: 'coin' | 'pearl') {
    const price = currency === 'coin' ? it.price_coin : it.price_pearl;
    if ((currency === 'pearl' || price >= 150 || it.kind === 'room') && confirm !== it.id + currency) { confirm = it.id + currency; sfx.tap(); return; }
    confirm = '';
    const r: any = await run(() => post('/api/shop/buy', { itemId: it.id, currency }));
    if (!r) return;
    sfx.coin();
    if (it.kind === 'room') { sfx.level(); toast(`${it.name} sudah dibangun! Ketuk Lihat untuk masuk.`, 'good'); }
    else toast(`${it.name} masuk Tas`, 'good');
  }
  async function sell(it: any) {
    if (confirm !== 'sell:' + it.id) { confirm = 'sell:' + it.id; sfx.tap(); return; }
    confirm = '';
    const r: any = await run(() => post('/api/shop/sell', { itemId: it.id }));
    if (r) { sfx.coin(); toast(`Terjual +${r.earned} koin`, 'good'); }
  }
  function leave() { sfx.tap(); G.view = 'map'; }

  /** etalase: beberapa barang toko dipajang di rak (rak bawah hanya sisi kiri: tengah ada penjaga, kanan gelembung sapaan) */
  const SLOTS = [[62, 50], [120, 50], [178, 50], [236, 50], [294, 50], [62, 112], [120, 112]];
  const shelf = $derived.by(() => all.slice(0, SLOTS.length).map((it, i) => itemIcon(it).replace('<svg ', `<svg x="${SLOTS[i][0]}" y="${SLOTS[i][1]}" width="50" height="40" `)).join(''));
  const keeperSvg = $derived(renderPet(keeper.look, []));
</script>

<div class="shop" style="--body:{body};--roof:{roof};--roofdk:{shade(roof, -0.25)}">
  <div class="front">
    <svg class="scene" viewBox="0 0 400 260" preserveAspectRatio="xMidYMax meet" role="img" aria-label="Di dalam {loc?.name}">
      <rect x="0" y="0" width="400" height="260" fill="var(--body)" />
      <rect x="0" y="196" width="400" height="64" fill={shade(body, -0.18)} />
      <!-- rak barang -->
      {#each [92, 154] as y}<rect x="50" y={y} width="300" height="9" rx="3" fill="#B98B4E" stroke="#2B2F4A" stroke-width="2.5" />{/each}
      {@html shelf}
      <!-- tenda/kanopi -->
      <path d="M0 0H400V26H0Z" fill="var(--roof)" stroke="#2B2F4A" stroke-width="3" />
      {#each Array(10) as _, i}<path d="M{i * 40} 24q20 22 40 0Z" fill={i % 2 ? '#FFFDF7' : roof} stroke="#2B2F4A" stroke-width="2.5" stroke-linejoin="round" />{/each}
      <!-- penjaga di balik meja -->
      <g transform="translate(200 192) scale(.82)"><g class="pet-bob">{@html keeperSvg}</g></g>
      <rect x="96" y="196" width="208" height="56" rx="8" fill="#C8955A" stroke="#2B2F4A" stroke-width="3" />
      <rect x="96" y="196" width="208" height="12" rx="6" fill="#E3B370" stroke="#2B2F4A" stroke-width="3" />
      <rect x="150" y="222" width="100" height="22" rx="11" fill="#FFFDF7" stroke="#2B2F4A" stroke-width="2.5" />
      <text x="200" y="238" text-anchor="middle" font-family="'Baloo 2',system-ui,sans-serif" font-weight="800" font-size="13.5" fill="#2B2F4A">{keeper.name}</text>
      <!-- gelembung sapaan di samping penjaga -->
      <path d="M252 132l-14 8 16 2Z" fill="#FFFDF7" stroke="#2B2F4A" stroke-width="2.5" stroke-linejoin="round" />
      <foreignObject x="250" y="98" width="144" height="74"><p class="bubble" xmlns="http://www.w3.org/1999/xhtml">{keeper.greet}</p></foreignObject>
    </svg>
    <button class="btn sm back" onclick={leave}>{@html I.back} Keluar</button>
  </div>

  <section class="panel" aria-label="Barang di {loc?.name}">
    <header>
      <h2>{loc?.name ?? 'Toko'}</h2>
      <span class="wallet"><span>{@html COIN}<b>{fmt(G.me.wallet.coin)}</b></span><span>{@html PEARL}<b>{fmt(G.me.wallet.pearl)}</b></span></span>
    </header>
    {#if loc?.sells_back}
      <div class="seg">
        <button class:on={G.shopTab === 'buy'} onclick={() => (G.shopTab = 'buy')}>Beli</button>
        <button class:on={G.shopTab === 'sell'} onclick={() => (G.shopTab = 'sell')}>Jual</button>
      </div>
    {/if}
    {#if loc?.kind === 'pearl'}
      <button class="btn block pearlbuy" onclick={() => (G.sheet = 'pearls')}>{@html PEARL} Tambah Mutiara</button>
    {/if}

    {#if G.shopTab === 'buy' || !loc?.sells_back}
      {#if cats.length > 1}
        <div class="tabbar" role="tablist">
          <button role="tab" aria-selected={!cat} class:on={!cat} onclick={() => (cat = '')}>Semua</button>
          {#each cats as k}<button role="tab" aria-selected={cat === k} class:on={cat === k} onclick={() => (cat = k)}>{KIND_LABEL[k] ?? k}</button>{/each}
        </div>
      {/if}
      {#if list.length === 0}<p class="muted">Belum ada barang di toko ini.</p>{/if}
      {#if list.some((i) => i.kind === 'room')}<p class="hint">Ruangan baru langsung jadi bagian rumahmu ({rooms.length}/{maxRooms} ruangan). Pindah ruangan lewat tombol nama ruangan di Rumah.</p>{/if}
      <div class="grid">
        {#each list as it (it.id)}
          {@const mine = it.kind === 'room' ? ownRoom(it.id) : null}
          <ItemCard {it} sub={sub(it)} badge={it.event_id && eventIds.has(it.event_id) ? 'Event' : mine ? 'Punya' : owned(it.id) ? `×${owned(it.id)}` : ''}>
            {#if mine}
              <button class="btn sm" onclick={() => { switchRoom(mine.id); G.view = 'home'; }}>Lihat</button>
            {:else if it.kind === 'room' && rooms.length >= maxRooms}
              <button class="btn sm" disabled>Rumah penuh</button>
            {:else}
              {#if it.price_coin > 0}
                <button class="btn sm" class:hot={confirm === it.id + 'coin'} disabled={G.busy || G.me.wallet.coin < it.price_coin} onclick={() => buy(it, 'coin')}>
                  {#if confirm === it.id + 'coin'}Yakin?{:else}{@html COIN}{fmt(it.price_coin)}{/if}
                </button>
              {/if}
              {#if it.price_pearl > 0}
                <button class="btn sm" class:hot={confirm === it.id + 'pearl'} disabled={G.busy || G.me.wallet.pearl < it.price_pearl} onclick={() => buy(it, 'pearl')}>
                  {#if confirm === it.id + 'pearl'}Yakin?{:else}{@html PEARL}{fmt(it.price_pearl)}{/if}
                </button>
              {/if}
            {/if}
          </ItemCard>
        {/each}
      </div>
    {:else}
      {#if sellable.length === 0}<p class="muted">Tidak ada barang yang bisa dijual. Hasil kebun, ikan, dan barang bekas bisa dijual di sini.</p>{/if}
      <div class="grid">
        {#each sellable as { it, n } (it!.id)}
          <ItemCard it={it!} sub="Punya {n}">
            <button class="btn sm" class:hot={confirm === 'sell:' + it!.id} disabled={G.busy} onclick={() => sell(it)}>
              {#if confirm === 'sell:' + it!.id}Jual?{:else}+{@html COIN}{it!.sell_coin}{/if}
            </button>
          </ItemCard>
        {/each}
      </div>
    {/if}
  </section>
</div>

<style>
  .shop { position: absolute; inset: 0; display: flex; flex-direction: column; background: var(--body); }
  .front { position: relative; flex: 0 0 auto; height: min(44dvh, 380px); padding-top: calc(var(--safe-t) + 100px); }
  .scene { display: block; width: 100%; height: 100%; }
  .bubble { margin: 0; box-sizing: border-box; max-height: 72px; overflow: hidden; background: var(--paper); border: 2px solid var(--ink); border-radius: 12px; padding: 4px 8px; font-weight: 700; font-size: 11.5px; line-height: 1.2; text-align: left; color: var(--ink); font-family: var(--font); }
  .back { position: absolute; left: max(10px, var(--safe-l)); bottom: 10px; }
  .panel { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; display: flex; flex-direction: column; gap: 12px; background: var(--paper); border-top: 3px solid var(--ink); border-radius: 24px 24px 0 0; padding: 14px max(14px, var(--safe-r)) calc(var(--safe-b) + 96px) max(14px, var(--safe-l)); }
  .panel > :global(*) { flex-shrink: 0; }
  header { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
  h2 { margin: 0; font-size: 22px; font-weight: 800; }
  .wallet { display: flex; gap: 6px; }
  .wallet span { display: inline-flex; align-items: center; gap: 4px; border: 2px solid var(--ink); border-radius: 999px; padding: 1px 8px 1px 4px; font-weight: 800; font-size: 15px; background: var(--soft); }
  .wallet :global(svg) { width: 20px; height: 20px; }
  .seg { display: flex; border: 2.5px solid var(--ink); border-radius: 12px; overflow: hidden; }
  .seg button { flex: 1; border: 0; background: var(--paper); font-weight: 800; font-size: 15px; min-height: 38px; cursor: pointer; }
  .seg button.on { background: var(--coin); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 10px; }
  .pearlbuy { background: #ECE6F6; }
  .hint { margin: 0; font-size: 13.5px; font-weight: 600; background: #E6F3EC; border-radius: 10px; padding: 6px 10px; }
  .muted { margin: 0; }
  @media (min-width: 900px) and (min-aspect-ratio: 1/1) {
    .shop { flex-direction: row; }
    .front { flex: 1; height: auto; padding: calc(var(--safe-t) + 96px) 0 96px; }
    .back { bottom: 110px; left: 20px; }
    .panel { flex: 0 0 460px; margin: calc(var(--safe-t) + 108px) 14px 96px 0; border: 3px solid var(--ink); border-radius: 22px; box-shadow: 0 5px 0 var(--ink); padding-bottom: 16px; }
  }
</style>
