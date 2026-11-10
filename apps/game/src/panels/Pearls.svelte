<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import Sheet from '../components/Sheet.svelte';
  import AuthOptions from '../components/AuthOptions.svelte';
  import { G, fail, fx, toast, track } from '../lib/game.svelte';
  import { api } from '../lib/api';
  import { sfx } from '../lib/sfx';
  import { PEARL } from '../lib/icons';

  type Qris = { paymentId: string; amount: number; pearls: number; invoice: string | null; expiresAt: string; image: string; test: boolean; packageId?: string };

  let data = $state<any>(null);
  let busy = $state(false);
  let qris = $state<Qris | null>(null);
  let now = $state(Date.now());
  let pollTimer: any, clock: any, checking = false;

  const rp = (n: number) => 'Rp' + n.toLocaleString('id-ID');
  const ST: Record<string, string> = { pending: 'Menunggu', paid: 'Berhasil', failed: 'Gagal', expired: 'Kedaluwarsa' };
  const left = $derived(qris ? Math.max(0, Math.floor((Date.parse(qris.expiresAt) - now) / 1000)) : 0);
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  async function load() {
    try { data = await api.get('/api/pearls'); } catch (e) { fail(e); }
  }
  onMount(() => {
    track('open_pearls');
    load();
    clock = setInterval(() => (now = Date.now()), 1000);
    document.addEventListener('visibilitychange', onVisible);
  });
  onDestroy(() => {
    clearInterval(clock);
    clearTimeout(pollTimer);
    document.removeEventListener('visibilitychange', onVisible);
  });
  // kembali dari aplikasi bank/e-wallet: langsung cek
  function onVisible() { if (!document.hidden && qris) check(); }

  function show(q: Qris, packageId?: string) {
    qris = { ...q, packageId: packageId ?? q.packageId };
    schedule(4000);
  }
  function schedule(ms = 3000) {
    clearTimeout(pollTimer);
    pollTimer = setTimeout(check, ms);
  }
  async function check() {
    if (!qris || checking) return;
    checking = true;
    const id = qris.paymentId;
    try {
      const r = await api.get(`/api/payments/${id}`);
      if (qris?.paymentId !== id) return;
      if (r.payment.status === 'paid') {
        G.me.wallet = r.wallet;
        qris = null;
        sfx.level();
        fx('coins');
        toast(`+${r.payment.pearls} Mutiara masuk. Terima kasih!`, 'good');
        load();
        return;
      }
      if (r.payment.status !== 'pending') {
        qris = null;
        toast(r.payment.status === 'expired' ? 'QRIS kedaluwarsa. Buat QR baru untuk membayar.' : 'Pembayaran dibatalkan.', 'error');
        load();
        return;
      }
    } catch { /* jaringan putus sebentar: coba lagi */ }
    finally { checking = false; }
    // setelah kedaluwarsa tetap cek sebentar (pembayaran bisa masuk terlambat), lalu pelan-pelan
    if (qris) schedule(left > 0 ? 3000 : 10000);
  }

  async function buy(id: string) {
    busy = true;
    try {
      const r = await api.post('/api/pearls/checkout', { packageId: id });
      if (r.qris) { show(r.qris, id); busy = false; return; }
      location.href = r.redirectUrl;
    } catch (e) { fail(e); busy = false; }
  }
  async function resume(h: any) {
    busy = true;
    try {
      const r = await api.get(`/api/payments/${h.id}`);
      if (r.qris) show(r.qris, h.package_id);
      else load();
    } catch (e) { fail(e); }
    busy = false;
  }
  async function cancel() {
    if (!qris) return;
    const id = qris.paymentId;
    busy = true;
    try {
      const r = await api.post(`/api/payments/${id}/cancel`);
      clearTimeout(pollTimer);
      if (r.status === 'paid') { G.me.wallet = r.wallet; sfx.level(); toast('Pembayaran sudah masuk, Mutiara ditambahkan.', 'good'); }
      qris = null;
      load();
    } catch (e) { fail(e); }
    busy = false;
  }
  function back() {
    // tagihan tetap berlaku; bisa dilanjutkan dari riwayat
    clearTimeout(pollTimer);
    qris = null;
    load();
  }
</script>

<Sheet title={qris ? 'Bayar dengan QRIS' : 'Mutiara'}>
  {#if qris}
    <div class="qris">
      {#if qris.test}<p class="mock">Mode uji ZePay: QR ini contoh dan tidak bisa dibayar sungguhan.</p>{/if}
      <div class="bill"><span class="ic sm">{@html PEARL}</span><span>{qris.pearls} Mutiara</span><b>{rp(qris.amount)}</b></div>
      <figure class="card" class:off={left === 0}>
        <div class="brand"><b>QRIS</b><span>Pindai dengan aplikasi apa pun</span></div>
        <img src={qris.image} alt={`Kode QRIS untuk membayar ${rp(qris.amount)}`} width="240" height="240" />
        {#if qris.invoice}<figcaption>{qris.invoice}</figcaption>{/if}
      </figure>
      {#if left > 0}
        <p class="timer" class:low={left < 120} role="timer" aria-live="off">Berlaku <b>{mmss(left)}</b> lagi</p>
        <p class="wait" aria-live="polite"><span class="dot" aria-hidden="true"></span>Menunggu pembayaran…</p>
      {:else}
        <p class="timer low">QR sudah kedaluwarsa.</p>
      {/if}
      <ol class="steps">
        <li>Buka aplikasi bank atau e-wallet: GoPay, OVO, DANA, ShopeePay, atau m-banking.</li>
        <li>Pindai QR. Main di HP ini? Simpan QR, lalu pilih gambar dari galeri di menu pindai.</li>
        <li>Setelah bayar, Mutiara masuk otomatis.</li>
      </ol>
      <div class="acts">
        {#if left > 0}
          <a class="btn hot" href={qris.image} download={`QRIS-${qris.invoice ?? qris.paymentId}.png`}>Simpan QR</a>
          <button class="btn" disabled={busy} onclick={check}>Sudah bayar</button>
        {:else if qris.packageId}
          <button class="btn hot" disabled={busy} onclick={() => qris?.packageId && buy(qris.packageId)}>Buat QR baru</button>
        {/if}
      </div>
      <div class="acts">
        <button class="btn sm" onclick={back}>Kembali</button>
        {#if left > 0}<button class="btn sm danger" disabled={busy} onclick={cancel}>Batalkan</button>{/if}
      </div>
    </div>
  {:else}
    <p class="intro">Mutiara dipakai untuk barang kosmetik di Toko Mutiara. Tidak ada barang yang membuat pemain lebih kuat.</p>
    {#if G.catalog?.settings?.features?.payments === false}
      <p class="muted">Pembelian Mutiara sedang ditutup.</p>
    {:else if G.me.user.is_guest && G.config?.payments !== 'mock'}
      <div class="guest">
        <b>Simpan progres dulu</b>
        <p>Supaya Mutiara yang dibeli tidak hilang, sambungkan akun Google atau email.</p>
        <AuthOptions guest={false} />
      </div>
    {:else if !data}
      <p class="muted">Memuat…</p>
    {:else}
      {#if G.config?.payments === 'mock'}<p class="mock">Mode uji: pembayaran hanya simulasi, tidak ada uang sungguhan.</p>
      {:else if data.test}<p class="mock">Mode uji ZePay: QR yang muncul tidak bisa dibayar sungguhan.</p>{/if}
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
      <p class="muted small">
        {#if data.provider === 'zepay'}Bayar dengan QRIS dari aplikasi bank atau e-wallet apa pun. Mutiara masuk otomatis setelah pembayaran berhasil.
        {:else}Bayar dengan QRIS, e-wallet, atau transfer bank. Mutiara masuk otomatis setelah pembayaran berhasil.{/if}
      </p>
      {#if data.history?.length}
        <h3>Riwayat</h3>
        <ul class="hist">
          {#each data.history as h (h.id)}
            <li>
              <span>{h.pearls} Mutiara · {rp(h.amount_idr)}</span>
              {#if h.resumable}<button class="btn sm hot" disabled={busy} onclick={() => resume(h)}>Lanjutkan bayar</button>
              {:else}<b class={h.status}>{ST[h.status] ?? h.status}</b>{/if}
            </li>
          {/each}
        </ul>
      {/if}
    {/if}
  {/if}
</Sheet>

<style>
  .intro { margin: 0; font-weight: 600; }
  .mock { margin: 0; font-weight: 700; font-size: 13.5px; background: #FBEFD2; border-radius: 10px; padding: 6px 10px; }
  .packs { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; }
  .pack { display: flex; flex-direction: column; align-items: center; gap: 2px; border: 2.5px solid var(--ink); border-radius: 16px; box-shadow: 0 3px 0 var(--ink); background: #F4F0FB; padding: 12px 8px; cursor: pointer; }
  .pack:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--ink); }
  .ic :global(svg) { width: 40px; height: 40px; }
  .ic.sm :global(svg) { width: 26px; height: 26px; }
  .n { font-size: 26px; font-weight: 800; }
  .n em { font-style: normal; font-size: 15px; color: #1E7A4C; margin-left: 3px; }
  .nm { font-size: 13px; font-weight: 700; color: var(--muted); }
  .price { margin-top: 4px; background: var(--coin); border: 2px solid var(--ink); border-radius: 10px; padding: 2px 10px; font-weight: 800; }
  .guest { display: flex; flex-direction: column; gap: 8px; border: 2px dashed var(--ink); border-radius: 14px; padding: 12px; }
  .guest p { margin: 0; font-weight: 600; }
  .muted { margin: 0; font-weight: 600; } .small { font-size: 13px; }
  h3 { margin: 4px 0 0; font-size: 17px; }
  .hist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; font-weight: 600; font-size: 14px; }
  .hist li { display: flex; justify-content: space-between; align-items: center; gap: 8px; border-bottom: 1px dashed #CFC9B8; padding: 4px 0; min-height: 36px; }
  .paid { color: #1E7A4C; } .failed, .expired { color: #A93A27; } .pending { color: #9C6A07; }

  .qris { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; }
  .bill { display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 16px; }
  .bill b { background: var(--coin); border: 2px solid var(--ink); border-radius: 10px; padding: 2px 10px; font-size: 18px; margin-left: 4px; }
  .card { margin: 0; background: #fff; border: 3px solid var(--ink); border-radius: 18px; box-shadow: 0 4px 0 var(--ink); padding: 10px 10px 8px; display: flex; flex-direction: column; align-items: center; gap: 4px; width: min(100%, 280px); }
  .card.off img { opacity: .25; filter: grayscale(1); }
  .brand { display: flex; align-items: baseline; gap: 8px; }
  .brand b { font-size: 20px; letter-spacing: .06em; }
  .brand span { font-size: 12.5px; font-weight: 700; color: var(--muted); }
  .card img { width: 100%; max-width: 240px; height: auto; aspect-ratio: 1; image-rendering: pixelated; display: block; }
  figcaption { font: 600 12px ui-monospace, Menlo, monospace; color: var(--muted); word-break: break-all; }
  .timer { margin: 0; font-weight: 700; }
  .timer.low { color: #A93A27; }
  .wait { margin: 0; display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; color: var(--muted); }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: #1E7A4C; animation: pulse 1.2s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: .25; transform: scale(.7); } }
  @media (prefers-reduced-motion: reduce) { .dot { animation: none; } }
  .steps { margin: 0; padding-left: 22px; text-align: left; font-weight: 600; font-size: 14px; display: flex; flex-direction: column; gap: 4px; max-width: 360px; }
  .acts { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .acts .btn { text-decoration: none; color: inherit; }
</style>
