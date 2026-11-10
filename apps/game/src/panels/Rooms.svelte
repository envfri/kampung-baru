<script lang="ts">
  // Daftar ruangan rumah: pindah ruangan, dan jalan ke Toko Bangunan untuk menambah ruangan.
  import Sheet from '../components/Sheet.svelte';
  import { itemIcon } from '@kb/shared';
  import { G, item, curRoom, switchRoom, goTo, settings } from '../lib/game.svelte';
  import { sfx } from '../lib/sfx';

  const rooms = $derived<any[]>(G.me.rooms ?? []);
  const cur = $derived(curRoom());
  const max = $derived(settings().house?.maxRooms ?? 6);
  const builder = $derived((G.catalog?.locations ?? []).find((l: any) => l.id === 'bangunan'));
  const forSale = $derived((G.catalog?.items ?? []).filter((i) => i.kind === 'room' && i.shop && !rooms.some((r) => r.item === i.id)));
  const shopName = (id: string | null) => (G.catalog?.locations ?? []).find((l: any) => l.id === id)?.name ?? '';
  const otherShops = $derived([...new Set(forSale.filter((i) => i.shop !== 'bangunan').map((i) => i.shop))]);
  const icon = (r: any) => itemIcon((r.item && item(r.item)) || ({ id: 'kamar', kind: 'room', name: r.name, art: { type: 'builtin', key: 'dalam' }, data: { theme: r.theme } } as any));

  function pick(r: any) {
    sfx.tap();
    switchRoom(r.id);
    G.sheet = null;
  }
</script>

<Sheet title="Rumahku">
  <p class="muted">Ketuk ruangan untuk pindah. Atur mebel tiap ruangan dengan tombol Atur.{#if G.me.likesWeek} Rumahmu disukai <b>{G.me.likesWeek}</b> kali minggu ini.{/if}</p>
  <div class="list">
    {#each rooms as r (r.id)}
      <button class="room" class:on={r.id === cur?.id} onclick={() => pick(r)} aria-current={r.id === cur?.id}>
        <span class="ic">{@html icon(r)}</span>
        <span class="txt"><b>{r.name}</b><small>{r.theme === 'luar' ? 'Halaman' : 'Ruangan'} {r.size}×{r.size} · {r.layout.length} barang</small></span>
        {#if r.id === cur?.id}<i>Di sini</i>{/if}
      </button>
    {/each}
  </div>
  {#if builder}
    <div class="add">
      <p><b>{rooms.length}/{max} ruangan.</b> {rooms.length >= max ? 'Rumahmu sudah penuh.' : forSale.length ? `Masih bisa dibangun: ${forSale.map((i) => i.name).join(', ')}.` : 'Semua jenis ruangan sudah kamu punya.'}</p>
      {#if rooms.length < max && forSale.some((i) => i.shop === 'bangunan')}<button class="btn hot block" onclick={() => goTo('bangunan')}>Jalan ke {builder.name}</button>{/if}
      {#if rooms.length < max}{#each otherShops as id}<button class="btn block" onclick={() => goTo(id!)}>Jalan ke {shopName(id)}</button>{/each}{/if}
    </div>
  {/if}
</Sheet>

<style>
  .muted { margin: 0; font-weight: 600; }
  .list { display: flex; flex-direction: column; gap: 8px; }
  .room { display: flex; align-items: center; gap: 10px; border: 2px solid var(--ink); border-radius: 14px; padding: 6px 10px 6px 6px; background: var(--card); cursor: pointer; text-align: left; min-height: 64px; }
  .room.on { background: var(--soft); box-shadow: 0 3px 0 var(--ink); }
  .ic { width: 64px; height: 52px; flex: none; background: var(--tint); border-radius: 10px; display: grid; place-items: center; overflow: hidden; }
  .ic :global(svg) { width: 60px; height: 50px; }
  .txt { display: flex; flex-direction: column; flex: 1; min-width: 0; }
  .txt b { font-size: 16px; }
  .txt small { font-size: 13px; font-weight: 600; color: var(--muted); }
  .room i { font-style: normal; font-size: 12px; font-weight: 800; background: var(--ink); color: var(--paper); border-radius: 8px; padding: 1px 7px; }
  .add { display: flex; flex-direction: column; gap: 8px; background: #E6F3EC; border-radius: 14px; padding: 10px 12px; }
  .add p { margin: 0; font-size: 14px; font-weight: 600; }
</style>
