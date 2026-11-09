<script lang="ts">
  import { onMount } from 'svelte';
  import Sheet from '../components/Sheet.svelte';
  import AuthOptions from '../components/AuthOptions.svelte';
  import { G, fail, track } from '../lib/game.svelte';
  import { api } from '../lib/api';
  import { PEARL } from '../lib/icons';

  let data = $state<any>(null);
  let busy = $state(false);
  const rp = (n: number) => 'Rp' + n.toLocaleString('id-ID');
  const ST: Record<string, string> = { pending: 'Menunggu', paid: 'Berhasil', failed: 'Gagal', expired: 'Kedaluwarsa' };
  onMount(async () => {
    track('open_pearls');
    try { data = await api.get('/api/pearls'); } catch (e) { fail(e); }
  });
  async function buy(id: string) {
    busy = true;
    try {
      const r = await api.post('/api/pearls/checkout', { packageId: id });
      location.href = r.redirectUrl;
    } catch (e) { fail(e); busy = false; }
  }
</script>

<Sheet title="Mutiara">
  <p class="intro">Mutiara dipakai untuk barang kosmetik di Toko Mutiara. Tidak ada barang yang membuat pemain lebih kuat.</p>
  {#if G.catalog?.settings?.features?.payments === false}
    <p class="muted">Pembelian Mutiara sedang ditutup.</p>
  {:else if G.me.user.is_guest}
    <div class="guest">
      <b>Simpan progres dulu</b>
      <p>Supaya Mutiara yang dibeli tidak hilang, sambungkan akun Google atau email.</p>
      <AuthOptions guest={false} />
    </div>
  {:else if !data}
    <p class="muted">Memuat…</p>
  {:else}
    <div class="packs">
      {#each data.packages as p (p.id)}
        <button class="pack" disabled={busy} onclick={() => buy(p.id)}>
          <span class="ic">{@html PEARL}</span>
          <span class="n">{p.pearls}{#if p.bonus}<em>+{p.bonus}</em>{/if}</span>
          <span class="nm">{p.name}</span>
          <span class="price">{rp(p.price_idr)}</span>
        </button>
      {/each}
    </div>
    <p class="muted small">Bayar dengan QRIS, e-wallet, atau transfer bank. Mutiara masuk otomatis setelah pembayaran berhasil.</p>
    {#if data.history?.length}
      <h3>Riwayat</h3>
      <ul class="hist">
        {#each data.history as h}<li><span>{h.pearls} Mutiara · {rp(h.amount_idr)}</span><b class={h.status}>{ST[h.status] ?? h.status}</b></li>{/each}
      </ul>
    {/if}
  {/if}
</Sheet>

<style>
  .intro { margin: 0; font-weight: 600; }
  .packs { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; }
  .pack { display: flex; flex-direction: column; align-items: center; gap: 2px; border: 2.5px solid var(--ink); border-radius: 16px; box-shadow: 0 3px 0 var(--ink); background: #F4F0FB; padding: 12px 8px; cursor: pointer; }
  .pack:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--ink); }
  .ic :global(svg) { width: 40px; height: 40px; }
  .n { font-size: 26px; font-weight: 800; }
  .n em { font-style: normal; font-size: 15px; color: #1E7A4C; margin-left: 3px; }
  .nm { font-size: 13px; font-weight: 700; color: var(--muted); }
  .price { margin-top: 4px; background: var(--coin); border: 2px solid var(--ink); border-radius: 10px; padding: 2px 10px; font-weight: 800; }
  .guest { display: flex; flex-direction: column; gap: 8px; border: 2px dashed var(--ink); border-radius: 14px; padding: 12px; }
  .guest p { margin: 0; font-weight: 600; }
  .muted { margin: 0; font-weight: 600; } .small { font-size: 13px; }
  h3 { margin: 4px 0 0; font-size: 17px; }
  .hist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; font-weight: 600; font-size: 14px; }
  .hist li { display: flex; justify-content: space-between; border-bottom: 1px dashed #CFC9B8; padding: 4px 0; }
  .paid { color: #1E7A4C; } .failed, .expired { color: #A93A27; } .pending { color: #9C6A07; }
</style>
