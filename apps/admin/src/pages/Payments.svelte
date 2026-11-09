<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { A, can, err, toast, rp, dt } from '../lib/store.svelte';
  let rows = $state<any[]>([]), status = $state(''), reason = $state(''), sel = $state<string | null>(null);
  async function load() { try { rows = (await api.get(`/api/admin/payments?status=${status}`)).payments; } catch (e) { err(e); } }
  onMount(load);
  const ST: Record<string, string> = { pending: '<span class="chip warn">Menunggu</span>', paid: '<span class="chip">Lunas</span>', failed: '<span class="chip no">Gagal</span>', expired: '<span class="chip mute">Kedaluwarsa</span>' };
  async function markPaid(id: string) {
    try { const r = await api.post(`/api/admin/payments/${id}/mark-paid`, { reason }); toast(r.credited ? 'Ditandai lunas dan Mutiara dikirim' : 'Sudah lunas sebelumnya'); sel = null; reason = ''; load(); } catch (e) { err(e); }
  }
</script>
<h1>Pembayaran</h1>
<p class="muted">Penyedia aktif: <b>{A.me?.paymentProvider}</b>. Status diperbarui otomatis dari notifikasi Midtrans. Atur URL notifikasi di dashboard Midtrans ke <span class="mono">{location.origin}/api/payments/midtrans/notify</span>.</p>
<div class="row"><select bind:value={status} onchange={load} style="max-width:200px" aria-label="Status"><option value="">Semua status</option><option value="pending">Menunggu</option><option value="paid">Lunas</option><option value="failed">Gagal</option><option value="expired">Kedaluwarsa</option></select></div>
<div class="tbl"><table>
  <thead><tr><th>Waktu</th><th>Pemain</th><th>Paket</th><th class="num">Mutiara</th><th class="num">Nominal</th><th>Status</th><th></th></tr></thead>
  <tbody>
    {#each rows as p (p.id)}
      <tr>
        <td>{dt(p.created_at)}</td><td>{p.display_name}</td><td>{p.package_id}</td><td class="num">{p.pearls}</td><td class="num">{rp(p.amount_idr)}</td><td>{@html ST[p.status] ?? p.status}</td>
        <td>{#if can('owner') && p.status !== 'paid'}
          {#if sel === p.id}<span class="row"><input placeholder="Alasan (bukti transfer, dll.)" bind:value={reason} style="max-width:220px" /><button class="btn sm primary" disabled={reason.length < 3} onclick={() => markPaid(p.id)}>Tandai lunas</button></span>
          {:else}<button class="btn sm" onclick={() => (sel = p.id)}>Tandai lunas…</button>{/if}
        {/if}</td>
      </tr>
    {:else}<tr><td colspan="7" class="muted">Belum ada pembayaran.</td></tr>{/each}
  </tbody>
</table></div>
