<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { A, err, toast, dt, num } from '../lib/store.svelte';
  let d = $state<any>(null), busy = $state(false), to = $state(''), filter = $state('');
  async function load() { try { d = await api.get('/api/admin/email'); } catch (e) { err(e); } }
  onMount(() => { to = A.me?.admin?.email ?? ''; load(); });

  const KIND: Record<string, string> = { otp: 'Kode masuk', test: 'Uji', system: 'Sistem & pembayaran', events: 'Event & broadcast', social: 'Teman', garden: 'Kebun', needs: 'Pet', daily: 'Harian' };
  const ST: Record<string, string> = { queued: '<span class="chip warn">Antre</span>', sending: '<span class="chip warn">Mengirim</span>', sent: '<span class="chip">Terkirim</span>', failed: '<span class="chip no">Gagal</span>' };
  const rows = $derived((d?.recent ?? []).filter((r: any) => !filter || r.status === filter));

  async function test(e: Event) {
    e.preventDefault(); busy = true;
    try { await api.post('/api/admin/email/test', { to }); toast(`Email uji terkirim ke ${to}. Cek kotak masuk & folder spam.`); load(); } catch (x) { err(x); load(); }
    busy = false;
  }
  async function retry() {
    busy = true;
    try { const r = await api.post('/api/admin/email/retry'); toast(r.requeued ? `${r.requeued} email dikirim ulang sekarang` : 'Tidak ada email yang tertunda'); setTimeout(load, 1500); } catch (x) { err(x); }
    busy = false;
  }
  async function unsuppress(email: string) {
    try { await api.del(`/api/admin/email/suppressions/${encodeURIComponent(email)}`); toast('Alamat bisa dikirimi lagi'); load(); } catch (x) { err(x); }
  }
  async function copy(t: string) { try { await navigator.clipboard.writeText(t); toast('Disalin'); } catch { toast('Salin manual dari kotak di atas', 'err'); } }
</script>

<h1>Email</h1>
<p class="muted">Kode masuk dan notifikasi pemain dikirim lewat Mailketing (1 email = 1 kredit). Jenis notifikasi yang ikut ke email dan batas per hari diatur di <b>Ekonomi & fitur › Email notifikasi</b>; broadcast dipilih per kiriman di halaman Notifikasi.</p>

{#if !d}
  <p class="muted">Memuat…</p>
{:else if !d.enabled}
  <section class="card s">
    <h2>Mailketing belum disambungkan</h2>
    <p>Tambahkan ke <span class="mono">.env</span> di server, lalu restart:</p>
    <pre class="mono">MAILKETING_API_TOKEN=token_dari_menu_Integrasi_Email_Application_API
MAIL_FROM=Kampung Bulu &lt;noreply@domainmu&gt;</pre>
    <p class="muted">Domain pengirim harus aktif dulu di Mailketing → Setup Domain. Sampai token diisi, kode masuk hanya muncul di log server (mode pengembangan) dan notifikasi tidak dikirim ke email.</p>
  </section>
{:else}
  <div class="kpis">
    <div class="kpi"><span>Sisa kredit Mailketing</span><b class:low={d.credits !== undefined && d.credits < 100}>{d.credits !== undefined ? num(d.credits) : '—'}</b>{#if d.creditsError}<small class="bad">{d.creditsError}</small>{/if}</div>
    <div class="kpi"><span>Terkirim 24 jam</span><b>{num(d.stats.sent24)}</b></div>
    <div class="kpi"><span>Gagal 24 jam</span><b>{num(d.stats.failed24)}</b></div>
    <div class="kpi"><span>Antrean</span><b>{num(d.stats.queued)}</b></div>
    <div class="kpi"><span>Alamat diblokir</span><b>{num(d.stats.suppressed)}</b></div>
  </div>
  {#if d.last && !d.last.ok}<p class="bad">Pengiriman terakhir gagal ({dt(d.last.at)}): {d.last.error}. {#if d.last.status === 402}Isi kredit Mailketing, lalu klik Kirim ulang yang tertunda.{:else if d.last.status === 403}Pastikan domain di MAIL_FROM sudah aktif di Mailketing → Setup Domain.{:else if d.last.status === 401}Periksa MAILKETING_API_TOKEN (token lama tidak berlaku setelah Generate Token Baru).{/if}</p>{/if}

  <div class="cols">
    <form class="card s" onsubmit={test}>
      <h2>Pengirim</h2>
      <p><b>{d.from.name}</b> &lt;<span class="mono">{d.from.email}</span>&gt;</p>
      <label>Kirim email uji ke<input type="email" required bind:value={to} /></label>
      <div class="row"><button class="btn primary" disabled={busy}>Kirim email uji</button><button type="button" class="btn" disabled={busy || !d.stats.queued} onclick={retry}>Kirim ulang yang tertunda</button></div>
    </form>
    <section class="card s">
      <h2>Webhook bounce</h2>
      <p>Tempel URL ini di Mailketing → Integrasi → WebHook, kolom <b>Bounce Webhook</b> dan <b>Unsubscribe Webhook</b>. Alamat yang bounce otomatis tidak dikirimi lagi supaya kredit tidak terbuang.</p>
      <div class="row"><input class="mono" readonly value={d.webhookUrl} aria-label="URL webhook" /><button class="btn" onclick={() => copy(d.webhookUrl)}>Salin</button></div>
      <p class="muted small">URL ini mengandung kunci rahasia; jangan dibagikan.</p>
    </section>
  </div>

  <div class="row between"><h2>Email terakhir</h2>
    <select bind:value={filter} style="max-width:180px" aria-label="Filter status"><option value="">Semua status</option><option value="sent">Terkirim</option><option value="queued">Antre</option><option value="failed">Gagal</option></select></div>
  <div class="tbl"><table>
    <thead><tr><th>Waktu</th><th>Kepada</th><th>Jenis</th><th>Judul</th><th>Status</th><th>Keterangan</th></tr></thead>
    <tbody>{#each rows as r (r.id)}<tr>
      <td>{dt(r.sent_at ?? r.created_at)}</td><td class="mono">{r.to_email}</td><td>{KIND[r.kind] ?? r.kind}</td><td>{r.subject}</td>
      <td>{@html ST[r.status] ?? r.status}</td><td class="muted">{r.error ?? (r.attempts > 1 ? `${r.attempts}× coba` : '')}</td>
    </tr>{:else}<tr><td colspan="6" class="muted">Belum ada email.</td></tr>{/each}</tbody>
  </table></div>

  {#if d.suppressions.length}
    <h2>Alamat yang tidak dikirimi</h2>
    <div class="tbl"><table>
      <thead><tr><th>Email</th><th>Sebab</th><th>Keterangan</th><th>Sejak</th><th></th></tr></thead>
      <tbody>{#each d.suppressions as x (x.email)}<tr>
        <td class="mono">{x.email}</td><td>{x.reason === 'bounce' ? 'Bounce' : x.reason === 'unsubscribe' ? 'Berhenti langganan' : x.reason}</td><td class="muted">{x.detail ?? ''}</td><td>{dt(x.created_at)}</td>
        <td><button class="btn sm" onclick={() => unsuppress(x.email)}>Izinkan lagi</button></td>
      </tr>{/each}</tbody>
    </table></div>
  {/if}
{/if}

<style>
  .s { display: flex; flex-direction: column; gap: 10px; }
  .s h2, h2 { margin: 0; font-size: 17px; }
  .s p { margin: 0; }
  h2 { margin-top: 18px; }
  .s h2 { margin-top: 0; }
  pre { margin: 0; background: #F3F5F3; border-radius: 10px; padding: 10px 12px; white-space: pre-wrap; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 12px; }
  .kpi { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 12px 16px; display: flex; flex-direction: column; }
  .kpi span { font-size: 12.5px; color: var(--muted); font-weight: 600; } .kpi b { font-family: var(--display); font-size: 28px; }
  .kpi b.low { color: var(--danger); }
  .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: 12px; }
  .bad { color: var(--danger); }
  .small { font-size: 12.5px; }
  .between { justify-content: space-between; align-items: flex-end; }
  .row input { flex: 1; min-width: 0; }
</style>
