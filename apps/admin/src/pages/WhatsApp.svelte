<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { can, err, toast, dt, num } from '../lib/store.svelte';
  import { NOTIFY_EVENT_BY_KEY } from '@kb/shared';
  let d = $state<any>(null), cfg = $state<any>(null), busy = $state(false), phone = $state(''), filter = $state('');
  async function load() { try { d = await api.get('/api/admin/whatsapp'); cfg = $state.snapshot(d.config); } catch (e) { err(e); } }
  onMount(load);

  const ST: Record<string, string> = { queued: '<span class="chip warn">Antre</span>', sending: '<span class="chip warn">Mengirim</span>', sent: '<span class="chip">Terkirim</span>', failed: '<span class="chip no">Gagal</span>' };
  const DLV: Record<string, string> = { delivered: 'sampai', read: 'dibaca', failed: 'gagal', sent: 'terkirim' };
  const label = (k: string) => NOTIFY_EVENT_BY_KEY[k]?.label ?? (k === 'test' ? 'Uji' : k);
  const rows = $derived((d?.recent ?? []).filter((r: any) => !filter || r.status === filter));
  const authTpls = $derived((d?.templates ?? []).filter((t: any) => t.category === 'AUTHENTICATION' && t.status === 'APPROVED'));

  async function saveCfg() {
    busy = true;
    try { await api.put('/api/admin/notify/channels', { whatsapp: $state.snapshot(cfg) }); toast('Pengaturan WhatsApp tersimpan'); load(); } catch (e) { err(e); }
    busy = false;
  }
  async function hook() {
    busy = true;
    try { const r = await api.post('/api/admin/whatsapp/webhook'); toast(r.tested ? 'Webhook terdaftar, event uji dikirim' : 'Webhook terdaftar'); setTimeout(load, 2000); } catch (e) { err(e); }
    busy = false;
  }
  async function test() {
    busy = true;
    try { const r = await api.post('/api/admin/notify/test/admin_message', { channel: 'whatsapp', to: phone }); toast(`Pesan uji terkirim ke ${r.to}`); load(); } catch (e) { err(e); load(); }
    busy = false;
  }
  async function retry() {
    try { const r = await api.post('/api/admin/whatsapp/retry'); toast(r.requeued ? `${r.requeued} pesan dicoba kirim lagi` : 'Tidak ada pesan tertunda'); setTimeout(load, 1500); } catch (e) { err(e); }
  }
  async function copy(t: string) { try { await navigator.clipboard.writeText(t); toast('Disalin'); } catch { toast('Salin manual', 'err'); } }
</script>

<h1>WhatsApp</h1>
<p class="muted">Notifikasi WhatsApp dikirim lewat Klik Flow ke pemain yang sudah menyambungkan dan memverifikasi nomornya di Pengaturan game. Jenis notifikasi dan teksnya diatur di <b>Pusat notifikasi</b>. Pemain bisa membalas <b>STOP</b> untuk berhenti atau <b>MULAI</b> untuk menyalakan lagi.</p>

{#if !d}
  <p class="muted">Memuat…</p>
{:else if !d.enabled}
  <section class="card s">
    <h2>Klik Flow belum disambungkan</h2>
    <p>Buat kunci di Klik Flow → Pengaturan › API &amp; Webhook (izin <b>messages:send</b>, dan <b>business:read</b> + <b>templates:read</b> untuk halaman ini), lalu tambahkan ke <span class="mono">.env</span> dan restart:</p>
    <pre class="mono">KLIKFLOW_API_KEY=kf_test_…</pre>
    <p class="muted">Mulai dengan kunci tes: pesan hanya terkirim ke nomor uji (maks. 5) yang didaftarkan di Klik Flow. Ganti ke <span class="mono">kf_live_…</span> saat siap.</p>
  </section>
{:else}
  {#if d.error}<p class="bad">Klik Flow menolak kunci: {d.error}</p>{/if}
  <div class="kpis">
    <div class="kpi"><span>Mode kunci</span><b>{d.mode === 'live' ? 'Live' : d.mode === 'test' ? 'Tes' : '—'}</b>{#if d.key}<small class="muted">{d.key.name} · {d.key.prefix}…</small>{/if}</div>
    <div class="kpi"><span>Terkirim 24 jam</span><b>{num(d.stats.sent24)}</b></div>
    <div class="kpi"><span>Gagal 24 jam</span><b>{num(d.stats.failed24)}</b></div>
    <div class="kpi"><span>Antrean</span><b>{num(d.stats.queued)}</b></div>
    <div class="kpi"><span>Nomor tersambung</span><b>{num(d.stats.verified)}</b><small class="muted">{num(d.stats.optedout)} membalas STOP</small></div>
  </div>
  {#if d.mode === 'test'}<p class="warnbox">Mode tes: pesan hanya sampai ke nomor uji di Klik Flow (Pengaturan › API &amp; Webhook › Nomor uji). Pemain lain akan gagal menerima kode verifikasi.</p>{/if}
  {#if d.last && !d.last.ok}<p class="bad">Pengiriman terakhir gagal ({dt(d.last.at)}): {d.last.error}</p>{/if}

  <div class="cols">
    <section class="card s">
      <h2>Pengiriman</h2>
      <label class="inline"><input type="checkbox" bind:checked={cfg.enabled} disabled={!can('admin')} /> Kirim notifikasi lewat WhatsApp</label>
      <label>Saluran<select bind:value={cfg.channel} disabled={!can('admin')}>
        <option value="whatsapp_qr">WhatsApp (scan QR): teks bebas</option>
        <option value="whatsapp_official">WhatsApp Official: template yang disetujui</option></select></label>
      <label>Nomor pengirim<select bind:value={cfg.from} disabled={!can('admin')}>
        <option value="">Otomatis (nomor pertama yang boleh dipakai kunci)</option>
        {#each (d.channels ?? []).filter((c: any) => c.channel === cfg.channel) as c}<option value={String(c.from)}>{c.name}{c.connected ? '' : ' (terputus)'}</option>{/each}
      </select>{#if d.channelsError}<span class="help bad">{d.channelsError}</span>{/if}</label>
      {#if cfg.channel === 'whatsapp_official'}
        <label>Template kode verifikasi (Autentikasi)<select bind:value={cfg.verifyTemplate} disabled={!can('admin')}>
          <option value="">— pilih —</option>
          {#each authTpls as t}<option value={t.name}>{t.name}</option>{/each}
          {#if cfg.verifyTemplate && !authTpls.some((t: any) => t.name === cfg.verifyTemplate)}<option value={cfg.verifyTemplate}>{cfg.verifyTemplate}</option>{/if}
        </select><span class="help">Dipakai saat pemain menyambungkan nomor. Notifikasi lain butuh template per jenis di Pusat notifikasi.</span></label>
      {:else}
        <p class="help">Scan QR: chat pertama ke nomor baru butuh izin <b>messages:new</b> dan dibatasi 50 nomor baru per kunci per hari oleh Klik Flow.</p>
      {/if}
      <div class="grid3">
        <label>Maks./hari<input type="number" min="0" max="50" bind:value={cfg.maxPerDay} disabled={!can('admin')} /></label>
        <label>Jam tenang mulai<input type="number" min="0" max="23" bind:value={cfg.quietStart} disabled={!can('admin')} /></label>
        <label>sampai (WIB)<input type="number" min="0" max="23" bind:value={cfg.quietEnd} disabled={!can('admin')} /></label>
      </div>
      {#if can('admin')}<div class="row"><button class="btn primary" disabled={busy} onclick={saveCfg}>Simpan</button></div>{/if}
    </section>

    <section class="card s">
      <h2>Webhook</h2>
      <p>Status pesan (sampai, dibaca, gagal) dan balasan STOP/MULAI diterima lewat webhook.</p>
      <div class="row nowrap"><input class="mono" readonly value={d.webhookUrl} aria-label="URL webhook" /><button class="btn" onclick={() => copy(d.webhookUrl)}>Salin</button></div>
      <p>{#if d.secretSource}<span class="chip">Secret tersimpan ({d.secretSource === 'env' ? 'KLIKFLOW_WEBHOOK_SECRET' : 'database'})</span>{:else}<span class="chip mute">Belum didaftarkan</span>{/if}
        {#if d.lastEvent} · event terakhir: {d.lastEvent.type} · {dt(d.lastEvent.at)}{/if}</p>
      {#if can('owner')}<div class="row"><button class="btn primary" disabled={busy || !d.webhookUrl.startsWith('https://')} onclick={hook}>{d.secretSource ? 'Daftarkan ulang' : 'Daftarkan webhook'}</button></div>{/if}
      <p class="help">Butuh kunci live. Dengan kunci tes, isi URL di atas manual di Klik Flow lalu salin secret-nya ke <span class="mono">KLIKFLOW_WEBHOOK_SECRET</span>.</p>

      <h2 class="mt">Kirim uji</h2>
      <div class="row nowrap"><input type="tel" bind:value={phone} placeholder="0812…" aria-label="Nomor tujuan uji" /><button class="btn" disabled={busy || !phone} onclick={test}>Kirim</button></div>
      <p class="help">Memakai teks "Pesan ke satu pemain" dari Pusat notifikasi.</p>
    </section>
  </div>

  {#if d.templates?.length}
    <h2 class="mt">Template WhatsApp Official</h2>
    <div class="tbl"><table>
      <thead><tr><th>Nama</th><th>Kategori</th><th>Status</th><th>Isi</th></tr></thead>
      <tbody>{#each d.templates as t (t.name + t.language)}<tr>
        <td class="mono">{t.name} <span class="muted">({t.language})</span></td><td>{t.category}</td>
        <td>{#if t.status === 'APPROVED'}<span class="chip">Disetujui</span>{:else}<span class="chip warn">{t.status}</span>{/if}</td>
        <td class="muted">{t.body}</td>
      </tr>{/each}</tbody>
    </table></div>
  {/if}

  <div class="row between mt"><h2>Pesan terakhir</h2>
    <span class="row"><select bind:value={filter} style="max-width:170px" aria-label="Filter status"><option value="">Semua status</option><option value="sent">Terkirim</option><option value="queued">Antre</option><option value="failed">Gagal</option></select>
      <button class="btn" onclick={retry}>Kirim ulang yang tertunda</button></span></div>
  <div class="tbl"><table>
    <thead><tr><th>Waktu</th><th>Ke</th><th>Jenis</th><th>Judul</th><th>Status</th><th>Keterangan</th></tr></thead>
    <tbody>{#each rows as r (r.id)}<tr>
      <td>{dt(r.sent_at ?? r.created_at)}</td><td class="mono">{r.to_addr}</td><td>{label(r.kind)}</td><td>{r.subject}</td>
      <td>{@html ST[r.status] ?? r.status}{#if r.delivery} <span class="muted small">{DLV[r.delivery] ?? r.delivery}</span>{/if}</td>
      <td class="muted small">{r.error ?? (r.status === 'queued' && new Date(r.next_at) > new Date() ? `dijadwalkan ${dt(r.next_at)}` : '')}</td>
    </tr>{:else}<tr><td colspan="6" class="muted">Belum ada pesan.</td></tr>{/each}</tbody>
  </table></div>
{/if}

<style>
  .s { display: flex; flex-direction: column; gap: 10px; }
  .s h2 { font-size: 17px; }
  .s p { margin: 0; }
  pre { margin: 0; background: #F3F5F3; border-radius: 10px; padding: 10px 12px; white-space: pre-wrap; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin: 12px 0; }
  .kpi { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 12px 16px; display: flex; flex-direction: column; }
  .kpi span { font-size: 12.5px; color: var(--muted); font-weight: 600; } .kpi b { font-family: var(--display); font-size: 28px; }
  .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr)); gap: 12px; }
  .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .bad { color: var(--danger); }
  .warnbox { background: var(--warn-soft); color: var(--warn); border-radius: 10px; padding: 8px 12px; margin: 0 0 12px; font-weight: 600; }
  .between { justify-content: space-between; align-items: flex-end; }
  .nowrap { flex-wrap: nowrap; } .nowrap input { flex: 1; min-width: 0; }
  .mt { margin-top: 18px; }
  .small { font-size: 12.5px; }
  h2 { font-size: 18px; margin-bottom: 8px; }
</style>
