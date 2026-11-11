<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { A, can, err, toast, rp, dt } from '../lib/store.svelte';
  let rows = $state<any[]>([]), status = $state(''), reason = $state(''), sel = $state<string | null>(null);
  let z = $state<any>(null), zBusy = $state(false), rowBusy = $state<string | null>(null);
  const isZepay = $derived(A.me?.paymentProvider === 'zepay');

  async function load() { try { rows = (await api.get(`/api/admin/payments?status=${status}`)).payments; } catch (e) { err(e); } }
  async function loadZ() { try { z = await api.get('/api/admin/zepay'); } catch (e) { err(e); } }
  onMount(() => { load(); if (A.me?.paymentProvider === 'zepay') loadZ(); });

  const ST: Record<string, string> = { pending: '<span class="chip warn">Menunggu</span>', paid: '<span class="chip">Lunas</span>', failed: '<span class="chip no">Gagal</span>', expired: '<span class="chip mute">Kedaluwarsa</span>' };
  const RES: Record<string, string> = { paid: 'Lunas, Mutiara dikirim', failed: 'Gagal/dibatalkan', expired: 'Kedaluwarsa', pending: 'Masih menunggu pembayaran', ignored: 'Diabaikan (nominal/mode tidak cocok)' };

  async function markPaid(id: string) {
    try { const r = await api.post(`/api/admin/payments/${id}/mark-paid`, { reason }); toast(r.credited ? 'Ditandai lunas dan Mutiara dikirim' : 'Sudah lunas sebelumnya'); sel = null; reason = ''; load(); } catch (e) { err(e); }
  }
  async function sync(id: string) {
    rowBusy = id;
    try { const r = await api.post(`/api/admin/payments/${id}/sync`); toast('Status ZePay: ' + (RES[r.result] ?? r.result)); load(); } catch (e) { err(e); }
    rowBusy = null;
  }
  async function simulate(id: string) {
    rowBusy = id;
    try { const r = await api.post(`/api/admin/payments/${id}/simulate`, { status: 'SUCCESS' }); toast('Simulasi: ' + (RES[r.result] ?? r.result)); load(); } catch (e) { err(e); }
    rowBusy = null;
  }
  async function registerHook() {
    zBusy = true;
    try {
      const r = await api.post('/api/admin/zepay/webhook');
      toast(r.rotated ? 'Webhook sudah ada; secret dirotasi dan disimpan. Event uji dikirim.' : 'Webhook terdaftar dan secret disimpan. Event uji dikirim.');
      setTimeout(loadZ, 2500);
      loadZ();
    } catch (e) { err(e); }
    zBusy = false;
  }
  async function testHook() {
    zBusy = true;
    try { await api.post('/api/admin/zepay/test'); toast('Event uji dikirim. Muat ulang beberapa detik lagi.'); setTimeout(loadZ, 2500); } catch (e) { err(e); }
    zBusy = false;
  }
  const ourHook = $derived(z?.endpoints?.find((e: any) => e.ours));
</script>

<h1>Pembayaran</h1>

{#if isZepay}
  <section class="card zp" aria-labelledby="zp-h">
    <div class="row between">
      <h2 id="zp-h">QRIS · ZePay</h2>
      {#if z?.mode === 'test'}<span class="chip warn">Mode uji</span>{:else if z?.mode === 'live'}<span class="chip">Live</span>{/if}
    </div>
    {#if !z}
      <p class="muted">Memuat status ZePay…</p>
    {:else if !z.configured}
      <p>Kunci API belum diisi. Tambahkan ke <span class="mono">.env</span> di server lalu restart:</p>
      <pre class="mono">PAYMENT_PROVIDER=zepay
ZEPAY_KEY_ID=zpk_live_…
ZEPAY_SECRET=zsk_live_…</pre>
      <p class="muted">Kunci API diminta ke tim ZePay. Pakai <span class="mono">zpk_test_…</span> dulu untuk mencoba tanpa uang sungguhan.</p>
    {:else}
      {#if z.error}<p class="bad">Tidak bisa terhubung ke ZePay: {z.error}</p>{/if}
      <div class="grid2">
        <div>
          <div class="lbl">Merchant</div>
          <div><b>{z.merchant?.name ?? '—'}</b> {#if z.merchant?.status && z.merchant.status !== 'active'}<span class="chip no">{z.merchant.status}</span>{/if}</div>
        </div>
        <div>
          <div class="lbl">Kanal QRIS</div>
          {#if z.merchant?.qris?.enabled && z.merchant.qris.channel}
            {@const c = z.merchant.qris.channel}
            <div>Aktif · biaya ±{c.fee_percent}%{c.fee_fixed ? ` + ${rp(c.fee_fixed)}` : ''} ({c.fee_paid_by === 'customer' ? 'dibayar pemain' : 'ditanggung merchant'}) · {rp(c.min_amount)}–{rp(c.max_amount)}</div>
          {:else if z.merchant}<div class="bad">QRIS belum aktif untuk merchant ini. Hubungi tim ZePay.</div>{:else}<div>—</div>{/if}
        </div>
        <div>
          <div class="lbl">Masa berlaku QR</div>
          <div>{z.expiresMinutes} menit <span class="muted">(ZEPAY_EXPIRES_MINUTES)</span></div>
        </div>
        <div>
          <div class="lbl">Event webhook terakhir</div>
          <div>{#if z.lastEvent}{z.lastEvent.type} · {dt(z.lastEvent.at)}{:else}<span class="muted">Belum pernah diterima</span>{/if}</div>
        </div>
      </div>

      <div class="lbl">Webhook</div>
      <p class="mono">{z.webhookUrl}</p>
      {#if ourHook}
        <p>Terdaftar di ZePay · <span class="chip {ourHook.status === 'enabled' ? '' : 'no'}">{ourHook.status === 'enabled' ? 'aktif' : 'nonaktif'}</span> · secret …{ourHook.secret_last4}
          {#if z.secretSource === 'env'}(dibaca dari ZEPAY_WEBHOOK_SECRET){:else if z.secretSource === 'db'}(tersimpan di database){:else}<span class="bad">secret belum tersimpan di server, klik Daftarkan ulang</span>{/if}</p>
      {:else if z.endpointsError}
        <p class="bad">Daftar webhook tidak bisa dibaca: {z.endpointsError}</p>
      {:else}
        <p class="bad">Belum terdaftar. Tanpa webhook, status tetap dicek saat pemain menunggu di layar QR, tapi pembayaran yang selesai setelah aplikasi ditutup baru masuk setelah QR kedaluwarsa.</p>
      {/if}
      {#if !z.webhookUrl.startsWith('https://')}<p class="bad">PUBLIC_URL harus https:// supaya webhook bisa didaftarkan.</p>{/if}
      <div class="row">
        {#if can('owner')}<button class="btn primary" disabled={zBusy || !z.webhookUrl.startsWith('https://')} onclick={registerHook}>{ourHook ? 'Daftarkan ulang (rotasi secret)' : 'Daftarkan webhook'}</button>{/if}
        {#if ourHook}<button class="btn" disabled={zBusy} onclick={testHook}>Kirim event uji</button>{/if}
        <button class="btn" disabled={zBusy} onclick={loadZ}>Muat ulang</button>
      </div>
    {/if}
  </section>
{:else}
  <p class="muted">Penyedia aktif: <b>{A.me?.paymentProvider}</b>.
    {#if A.me?.paymentProvider === 'midtrans'}Status diperbarui dari notifikasi Midtrans. Atur URL notifikasi di dashboard Midtrans ke <span class="mono">{location.origin}/api/payments/midtrans/notify</span>.
    {:else if A.me?.paymentProvider === 'mock'}Pembayaran hanya simulasi. Isi <span class="mono">PAYMENT_PROVIDER=zepay</span> dan kunci ZePay untuk menerima QRIS sungguhan.{/if}</p>
{/if}

<div class="row"><select bind:value={status} onchange={load} style="max-width:200px" aria-label="Status"><option value="">Semua status</option><option value="pending">Menunggu</option><option value="paid">Lunas</option><option value="failed">Gagal</option><option value="expired">Kedaluwarsa</option></select></div>
<div class="tbl"><table>
  <thead><tr><th>Waktu</th><th>Pemain</th><th>Paket</th><th class="num">Mutiara</th><th class="num">Nominal</th><th>Invoice</th><th>Status</th><th></th></tr></thead>
  <tbody>
    {#each rows as p (p.id)}
      <tr>
        <td>{dt(p.created_at)}</td><td>{p.display_name}</td><td>{p.package_id}</td><td class="num">{p.pearls}</td><td class="num">{rp(p.amount_idr)}</td>
        <td class="mono">{p.invoice ?? '—'}</td><td>{@html ST[p.status] ?? p.status}{#if p.test} <span class="chip warn" title="Pembayaran uji: simulasi atau kunci uji ZePay">uji</span>{/if}{#if p.revoked_at} <span class="chip mute" title="Mutiara-nya sudah ditarik / direset">ditarik</span>{/if}</td>
        <td><span class="row acts">
          {#if p.provider === 'zepay' && p.provider_ref && p.status !== 'paid'}
            <button class="btn sm" disabled={rowBusy === p.id} onclick={() => sync(p.id)}>Cek status</button>
            {#if z?.mode === 'test' && can('owner')}<button class="btn sm" disabled={rowBusy === p.id} onclick={() => simulate(p.id)}>Simulasi lunas</button>{/if}
          {/if}
          {#if can('owner') && p.status !== 'paid'}
            {#if sel === p.id}<input placeholder="Alasan (bukti transfer, dll.)" bind:value={reason} style="max-width:220px" aria-label="Alasan tandai lunas" /><button class="btn sm primary" disabled={reason.length < 3} onclick={() => markPaid(p.id)}>Tandai lunas</button>
            {:else}<button class="btn sm" onclick={() => (sel = p.id)}>Tandai lunas…</button>{/if}
          {/if}
        </span></td>
      </tr>
    {:else}<tr><td colspan="8" class="muted">Belum ada pembayaran.</td></tr>{/each}
  </tbody>
</table></div>

<style>
  .zp { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
  .zp h2 { margin: 0; font-size: 17px; }
  .zp p { margin: 0; }
  .between { justify-content: space-between; align-items: center; }
  .lbl { font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 2px; }
  .bad { color: var(--danger); }
  pre { margin: 0; background: #F3F5F3; border-radius: 10px; padding: 10px 12px; white-space: pre-wrap; }
  .acts { flex-wrap: nowrap; gap: 6px; }
</style>
