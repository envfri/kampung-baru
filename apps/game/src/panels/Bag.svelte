<script lang="ts">
  import Sheet from '../components/Sheet.svelte';
  import ItemCard from '../components/ItemCard.svelte';
  import { G, item, effText, run, post, fx, toast, startEdit, draftAvail, items } from '../lib/game.svelte';
  import { api } from '../lib/api';
  import { fits } from '@kb/shared';
  import { sfx } from '../lib/sfx';

  const TABS = [
    { k: 'food', label: 'Makanan', kinds: ['food'] },
    { k: 'furniture', label: 'Mebel', kinds: ['furniture'] },
    { k: 'decor', label: 'Dekor', kinds: ['wallpaper', 'floor'] },
    { k: 'wear', label: 'Pakaian', kinds: ['wear'] },
    { k: 'seed', label: 'Bibit', kinds: ['seed'] },
    { k: 'other', label: 'Lainnya', kinds: ['fish', 'material'] },
  ];
  const feedOnly = G.sheet === 'feed';
  if (feedOnly) G.bagTab = 'food';
  const tab = $derived(TABS.find((t) => t.k === G.bagTab) ?? TABS[0]);
  const list = $derived(
    Object.entries(G.me.inventory ?? {})
      .map(([id, n]) => ({ it: item(id), n: n as number }))
      .filter((x) => x.it && tab.kinds.includes(x.it.kind) && (x.n > 0))
      .sort((a, b) => a.it!.name.localeCompare(b.it!.name)),
  );

  async function feed(id: string) {
    fx('food');
    const r: any = await run(() => post('/api/action', { type: 'makan', itemId: id }));
    if (r) { sfx.eat(); fx('hearts'); toast(`${G.me.pet.name} makan ${item(id)?.name}`, 'good'); if (r.result?.levelUp) { sfx.level(); toast(`Naik ke Lv ${r.result.levelUp}!`, 'good'); } }
  }

  function place(id: string) {
    const it = item(id);
    if (!it) return;
    if (!G.edit) startEdit();
    if (draftAvail(id) <= 0) { toast('Semua sudah terpasang.', 'error'); return; }
    const size = G.catalog?.settings?.room?.size ?? 6;
    const map = Object.fromEntries(items());
    for (let s = 0; s < size * 2; s++)
      for (let x = 0; x < size; x++) {
        const y = s - x;
        if (y < 0 || y >= size) continue;
        if (fits(it, x, y, G.draft!, map, size)) {
          G.draft!.push({ i: id, x, y });
          G.sel = G.draft!.length - 1;
          G.sheet = null;
          sfx.pop();
          toast('Ketuk lantai untuk memindah, lalu Selesai.');
          return;
        }
      }
    toast('Ruangan penuh. Simpan barang lain ke Tas dulu.', 'error');
  }

  async function decor(id: string) {
    const it = item(id)!;
    const key = it.kind === 'wallpaper' ? 'wall' : 'floor';
    const layout = G.edit && G.draft ? G.draft : G.me.room.layout;
    const r = await run(() => api.post('/api/room', { layout, version: G.me.room.version, [key]: id }));
    if (r) { if (G.edit) { G.edit = false; G.draft = null; } sfx.pop(); toast(`${it.name} dipasang`, 'good'); }
  }

  async function wear(id: string) {
    const it = item(id)!;
    const slot = it.data?.slot ?? 'head';
    const on = G.me.pet.wear?.[slot] === id;
    const r = await run(() => api.post('/api/pet/look', { wear: { [slot]: on ? null : id } }));
    if (r) { sfx.pop(); fx('hearts'); }
  }
</script>

<Sheet title={feedOnly ? `Beri makan ${G.me.pet.name}` : 'Tas'}>
  {#if !feedOnly}
    <div class="tabs" role="tablist">
      {#each TABS as t}<button role="tab" aria-selected={G.bagTab === t.k} class:on={G.bagTab === t.k} onclick={() => (G.bagTab = t.k)}>{t.label}</button>{/each}
    </div>
  {/if}

  {#if tab.k === 'wear'}
    <button class="btn block wardrobe" onclick={() => (G.sheet = 'wardrobe')}>Buka Lemari: ubah warna, telinga, motif, mata, ekor</button>
  {/if}

  {#if list.length === 0}
    <p class="empty">
      {#if tab.k === 'food'}Tas makanan kosong. Beli di Pasar Pagi atau panen dari Kebun.
      {:else if tab.k === 'furniture'}Semua mebel sudah terpasang. Beli lagi di Mebel Jati.
      {:else if tab.k === 'seed'}Belum ada bibit. Beli di Pasar Pagi.
      {:else}Belum ada barang di sini.{/if}
    </p>
    {#if tab.k === 'food' || tab.k === 'seed'}<button class="btn hot" onclick={() => { G.shopId = 'pasar'; G.sheet = 'shop'; }}>Ke Pasar Pagi</button>{/if}
  {/if}

  <div class="grid">
    {#each list as { it, n } (it!.id)}
      {@const i = it!}
      {#if i.kind === 'food'}
        <ItemCard it={i} sub={effText(i.data?.effects)} badge="×{n}"><button class="btn sm hot" disabled={G.busy} onclick={() => feed(i.id)}>Beri</button></ItemCard>
      {:else if i.kind === 'furniture'}
        {@const avail = G.edit ? draftAvail(i.id) : n}
        {#if avail > 0}<ItemCard it={i} sub="Ukuran {i.data?.w ?? 1}×{i.data?.d ?? 1}" badge="×{avail}"><button class="btn sm" onclick={() => place(i.id)}>Pasang</button></ItemCard>{/if}
      {:else if i.kind === 'wallpaper' || i.kind === 'floor'}
        {@const on = G.me.room[i.kind === 'wallpaper' ? 'wall' : 'floor'] === i.id}
        <ItemCard it={i} sub={i.kind === 'wallpaper' ? 'Dinding' : 'Lantai'}><button class="btn sm" class:on disabled={on || G.busy} onclick={() => decor(i.id)}>{on ? 'Terpasang' : 'Pakai'}</button></ItemCard>
      {:else if i.kind === 'wear'}
        {@const on = G.me.pet.wear?.[i.data?.slot ?? 'head'] === i.id}
        <ItemCard it={i} sub={on ? 'Dipakai' : ''}><button class="btn sm" class:on disabled={G.busy} onclick={() => wear(i.id)}>{on ? 'Lepas' : 'Pakai'}</button></ItemCard>
      {:else if i.kind === 'seed'}
        <ItemCard it={i} sub="{i.data?.growMinutes} mnt" badge="×{n}"><button class="btn sm" onclick={() => { G.sheet = null; G.view = 'garden'; }}>Ke Kebun</button></ItemCard>
      {:else}
        <ItemCard it={i} sub={i.sell_coin ? `Jual ${i.sell_coin} koin` : ''} badge="×{n}"><button class="btn sm" onclick={() => { G.shopId = 'pasar'; G.sheet = 'shop'; }}>Jual</button></ItemCard>
      {/if}
    {/each}
  </div>
</Sheet>

<style>
  .tabs { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding: 2px; }
  .tabs button { flex: none; border: 2px solid var(--ink); background: var(--paper); border-radius: 12px; padding: 5px 12px; font-weight: 700; font-size: 14.5px; cursor: pointer; min-height: 38px; }
  .tabs button.on { background: var(--ink); color: var(--paper); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 10px; }
  .empty { margin: 0; font-weight: 600; color: var(--muted); }
  .wardrobe { background: #ECE6F6; }
</style>
