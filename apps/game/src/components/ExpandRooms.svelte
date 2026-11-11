<script lang="ts">
  // Perluas ruangan: lantai bertambah di sisi depan, mebel yang sudah ada tetap di tempatnya.
  import { G, run, fmt, toast, curRoom } from '../lib/game.svelte';
  import { api } from '../lib/api';
  import { sfx } from '../lib/sfx';
  import { COIN } from '../lib/icons';
  let { only = null }: { only?: string | null } = $props();
  const rooms = $derived<any[]>((G.me.rooms ?? []).filter((r: any) => !only || r.id === only));
  let confirm = $state('');
  async function expand(r: any) {
    if (confirm !== r.id) { confirm = r.id; sfx.tap(); return; }
    confirm = '';
    const res: any = await run(() => api.post('/api/room/expand', { roomId: r.id }));
    if (res) {
      sfx.level();
      toast(`${r.name} sekarang ${res.size}×${res.size}. Lebih lega untuk main bareng teman!`, 'good');
      // ruangan yang membesar menabrak ruangan lain di denah buatanmu: denah kembali tersusun otomatis
      if (res.planReset) setTimeout(() => toast('Denah rumah kembali tersusun otomatis karena ruangannya membesar. Atur lagi di Rumahku › Atur denah.'), 2600);
    }
  }
</script>

<div class="exp">
  {#each rooms as r (r.id)}
    <div class="row" class:cur={r.id === curRoom()?.id}>
      <div class="txt">
        <b>{r.name}</b>
        <small>{r.size}×{r.size}{r.expand ? ` → ${r.expand.size}×${r.expand.size}` : ' · sudah paling luas'}</small>
      </div>
      {#if r.expand}
        <button class="btn sm" class:hot={confirm === r.id} disabled={G.busy || G.me.wallet.coin < r.expand.coins} onclick={() => expand(r)}>
          {#if confirm === r.id}Yakin perluas?{:else}{@html COIN}{fmt(r.expand.coins)}{/if}
        </button>
      {/if}
    </div>
  {/each}
</div>

<style>
  .exp { display: flex; flex-direction: column; gap: 6px; }
  .row { display: flex; align-items: center; gap: 8px; border: 2px solid var(--ink); border-radius: 12px; padding: 6px 8px; background: var(--card); }
  .row.cur { background: #FFF8E2; }
  .txt { display: flex; flex-direction: column; flex: 1; min-width: 0; }
  .txt b { font-size: 15px; }
  .txt small { font-size: 12.5px; font-weight: 700; color: var(--muted); }
  .row :global(svg) { width: 16px; height: 16px; vertical-align: -3px; }
</style>
