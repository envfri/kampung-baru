<script lang="ts">
  // Persiapan peluncuran: status pembayaran, tarik Mutiara uji, dan cut-off (semua pemain mulai dari 0).
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { A, can, err, toast, num, rp, dt } from '../lib/store.svelte';

  let s = $state<any>(null);
  let busy = $state(false);
  let mode = $state<'progress' | 'all'>('progress');
  let keepFriends = $state(true), analytics = $state(true), includeReal = $state(false), backup = $state(false);
  let confirm = $state('');
  const PHRASE = 'RESET BUPI';
  const owner = $derived(can('owner'));

  async function load() { try { s = await api.get('/api/admin/launch'); } catch (e) { err(e); } }
  onMount(load);

  async function revoke() {
    if (!window.confirm(`Tarik ${num(s.demo.pearls)} Mutiara dari ${s.demo.payments} pembayaran uji milik ${s.demo.users} pemain?`)) return;
    busy = true;
    try {
      const r = await api.post('/api/admin/launch/revoke-demo');
      s = r.stats;
      toast(`${num(r.revoked)} Mutiara ditarik dari ${r.users} pemain${r.spent ? `; ${num(r.spent)} sudah terlanjur dipakai` : ''}.`);
    } catch (e) { err(e); } finally { busy = false; }
  }
  async function reset() {
    busy = true;
    try {
      const r = await api.post('/api/admin/launch/reset', { mode, keepFriends, analytics, includeReal, confirm });
      s = r.stats; confirm = ''; backup = false;
      toast(`Cut-off selesai: ${num(r.cutoff.players)} pemain ${mode === 'all' ? 'dihapus' : 'mulai dari 0'}.`);
    } catch (e) { err(e); } finally { busy = false; }
  }
  const pay = $derived(s?.payment);
  const payLabel = $derived(!pay ? '' : pay.provider === 'mock' ? 'Simulasi (mock)' : pay.provider === 'zepay' ? `ZePay ${pay.mode === 'live' ? 'live' : pay.mode === 'test' ? 'mode uji' : ''}` : pay.provider);
  const ready = $derived(confirm.trim() === PHRASE && backup && (!s?.real?.payments || (mode === 'progress' && includeReal)));
</script>

<h1>Peluncuran</h1>
<p class="muted">Persiapan sebelum game dibuka untuk umum. Selama masa uji, Mutiara dari pembelian simulasi tidak boleh terbawa ke produksi. Saat peluncuran, lakukan <b>cut-off</b> supaya semua pemain mulai dari 0 dan setara.</p>

{#if !s}
  <p class="muted">Memuat…</p>
{:else}
  <section class="card" aria-labelledby="st-h">
    <h2 id="st-h">Status</h2>
    <div class="grid">
      <div><span class="lbl">Pembayaran</span><b>{payLabel}</b>
        {#if pay.provider === 'mock' && pay.locked}<span class="chip">terkunci untuk pemain</span>
        {:else if pay.provider === 'mock'}<span class="chip warn">pemain bisa beli gratis</span>
        {:else if pay.mode === 'test'}<span class="chip warn">QR uji, tidak bisa dibayar sungguhan</span>{/if}
      </div>
      <div><span class="lbl">Pemain</span><b>{num(s.players)}</b><small>{num(s.guests)} tamu · {num(s.pets)} pet</small></div>
      <div><span class="lbl">Beredar</span><b>{num(s.pearls)} Mutiara</b><small>{num(s.coins)} koin</small></div>
      <div><span class="lbl">Pembayaran sungguhan</span><b>{num(s.real.payments)}</b><small>{rp(s.real.amount)}</small></div>
    </div>
    {#if pay.provider === 'mock' && !pay.production}
      <p class="warnbox">Server ini bukan mode produksi (NODE_ENV bukan production): pembelian simulasi terbuka untuk semua pemain, Mutiara gratis. Di server publik, jalankan dengan NODE_ENV=production supaya simulasi hanya bisa dipakai admin yang sedang login.</p>
    {:else if pay.provider === 'mock'}
      <p class="okbox">Pemain melihat "Pembelian Mutiara belum dibuka". Kamu (admin yang login di browser ini) tetap bisa mencoba alur beli di game; Mutiara-nya ditandai uji.</p>
    {/if}
    {#if s.cutoff}
      <p class="okbox">Cut-off terakhir: <b>{dt(s.cutoff.at)}</b> oleh {s.cutoff.by} · {s.cutoff.mode === 'all' ? 'semua pemain dihapus' : 'progres direset, akun tetap'} · {num(s.cutoff.players)} pemain{s.cutoff.version ? ` · v${s.cutoff.version}` : ''}</p>
    {/if}
  </section>

  <section class="card" aria-labelledby="demo-h">
    <h2 id="demo-h">Mutiara dari pembayaran uji</h2>
    <p class="muted">Pembelian lewat halaman simulasi atau kunci uji ZePay (zpk_test_…) ditandai "uji". Tarik kembali Mutiara-nya tanpa mereset yang lain. Mutiara yang sudah terlanjur dibelanjakan tidak bisa ditarik (saldo tidak dibuat minus); cut-off di bawah membersihkan semuanya.</p>
    <p><b>{num(s.demo.pearls)}</b> Mutiara dari <b>{s.demo.payments}</b> pembayaran uji, milik <b>{s.demo.users}</b> pemain.</p>
    {#if owner}
      <div><button class="btn" disabled={busy || !s.demo.payments} onclick={revoke}>Tarik Mutiara uji</button></div>
    {:else}<p class="muted">Hanya pemilik (owner) yang bisa menarik Mutiara.</p>{/if}
  </section>

  <section class="card danger" aria-labelledby="cut-h">
    <h2 id="cut-h">Cut-off peluncuran</h2>
    <p>Semua pemain mulai dari nol supaya setara saat produksi dibuka. <b>Tidak bisa dibatalkan.</b></p>
    <div class="cols">
      <div>
        <b>Yang direset</b>
        <ul><li>Pet (pemain membuat pet baru)</li><li>Koin & Mutiara (kembali ke modal awal)</li><li>Tas, rumah & ruangan, kebun, ikan, koleksi</li><li>Tugas, lencana, hadiah harian, event, duel, kunjungan, hadiah teman, suka rumah</li><li>Notifikasi di game & pesan yang belum terkirim</li><li>Pembayaran uji</li></ul>
      </div>
      <div>
        <b>Yang tetap</b>
        <ul><li>Item, harga, event, tugas, peta, pengaturan, paket Mutiara, pengumuman, media</li><li>Akun admin, log audit, riwayat email/WA</li><li>Catatan pembayaran sungguhan (laporan keuangan)</li></ul>
      </div>
    </div>
    {#if owner}
      <fieldset>
        <legend>Pilihan</legend>
        <label class="opt"><input type="radio" bind:group={mode} value="progress" /> <span><b>Reset progres, akun tetap</b> (disarankan). Pemain uji tetap bisa masuk dengan Google/email/akun tamunya, lalu membuat pet baru dari awal.</span></label>
        <label class="opt"><input type="radio" bind:group={mode} value="all" /> <span><b>Hapus semua pemain.</b> Semua akun hilang; semua orang daftar ulang.</span></label>
        {#if mode === 'progress'}<label class="opt"><input type="checkbox" bind:checked={keepFriends} /> <span>Pertahankan daftar teman</span></label>{/if}
        <label class="opt"><input type="checkbox" bind:checked={analytics} /> <span>Hapus juga data analitik masa uji (dasbor mulai dari 0)</span></label>
        {#if s.real.payments}
          <p class="warnbox">Sudah ada {s.real.payments} pembayaran sungguhan ({rp(s.real.amount)}, {num(s.real.pearls)} Mutiara). Catatannya tetap disimpan, tetapi Mutiara-nya ikut direset.{mode === 'all' ? ' "Hapus semua pemain" tidak bisa dipakai.' : ''}</p>
          {#if mode === 'progress'}<label class="opt"><input type="checkbox" bind:checked={includeReal} /> <span>Saya paham, Mutiara dari pembayaran sungguhan ikut direset</span></label>{/if}
        {/if}
        <label class="opt"><input type="checkbox" bind:checked={backup} /> <span>Saya sudah membuat cadangan database (<span class="mono">./deploy/backup.sh</span> di server)</span></label>
        <label class="cflbl" for="cf">Ketik <b class="mono">{PHRASE}</b> untuk konfirmasi</label>
        <div class="row">
          <input id="cf" class="mono" bind:value={confirm} autocomplete="off" placeholder={PHRASE} />
          <button class="btn danger" disabled={busy || !ready} onclick={reset}>Jalankan cut-off</button>
        </div>
      </fieldset>
      <p class="muted small">Urutan yang disarankan saat peluncuran: cadangkan database → cut-off → ganti ke kunci live ZePay & restart → daftarkan webhook di Pembayaran → umumkan peluncuran (Pengumuman/Broadcast).</p>
    {:else}<p class="muted">Hanya pemilik (owner) yang bisa menjalankan cut-off.</p>{/if}
  </section>
{/if}

<style>
  h2 { margin: 0 0 8px; font-size: 18px; }
  .card { margin-top: 14px; display: flex; flex-direction: column; gap: 8px; }
  .card p { margin: 0; }
  .card.danger { border-color: var(--danger); }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
  .grid > div { display: flex; flex-direction: column; gap: 2px; align-items: flex-start; }
  .lbl { font-size: 12.5px; color: var(--muted); font-weight: 600; }
  .grid b { font-size: 18px; }
  .grid small { color: var(--muted); }
  .warnbox { background: var(--warn-soft); color: var(--warn); border-radius: 10px; padding: 8px 12px; font-weight: 600; }
  .okbox { background: var(--accent-soft); border-radius: 10px; padding: 8px 12px; font-weight: 600; }
  .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
  ul { margin: 4px 0 0; padding-left: 18px; }
  fieldset { border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
  legend { font-weight: 700; padding: 0 4px; }
  .opt { flex-direction: row; gap: 8px; align-items: flex-start; font-weight: 500; font-size: 14px; }
  .opt input { flex: none; width: 18px; height: 18px; min-height: 0; padding: 0; margin: 2px 0 0; accent-color: var(--accent); }
  .opt span { flex: 1; }
  .cflbl { display: block; font-size: 14px; }
  .row { display: flex; gap: 8px; flex-wrap: wrap; }
  .row input { flex: 1; min-width: 180px; width: auto; }
  .small { font-size: 13px; }
</style>
