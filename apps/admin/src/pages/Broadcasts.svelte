<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { err, toast, dt, num, fromLocal } from '../lib/store.svelte';
  let data = $state<any>(null);
  let f = $state({ title: '', body: '', url: '/', segment: 'all', sendAt: '' });
  let busy = $state(false);
  const SEG: [string, string][] = [['all', 'Semua pemain'], ['active7', 'Aktif 7 hari terakhir'], ['inactive7', 'Tidak aktif lebih dari 7 hari'], ['payers', 'Pernah membeli Mutiara'], ['guests', 'Masih tamu (belum simpan progres)']];
  const URLS: [string, string][] = [['/', 'Rumah'], ['/#map', 'Peta Kampung'], ['/#shop', 'Toko'], ['/#friends', 'Teman'], ['/#daily', 'Hadiah harian'], ['/#news', 'Kabar kampung'], ['/#pearls', 'Toko Mutiara']];
  const ST: Record<string, string> = { scheduled: 'Terjadwal', sending: 'Mengirim', sent: 'Terkirim', cancelled: 'Dibatalkan' };
  async function load() { try { data = await api.get('/api/admin/broadcasts'); } catch (e) { err(e); } }
  onMount(load);
  async function send(e: Event) {
    e.preventDefault(); busy = true;
    try {
      await api.post('/api/admin/broadcasts', { ...f, sendAt: fromLocal(f.sendAt) });
      toast(f.sendAt ? 'Notifikasi dijadwalkan' : 'Notifikasi sedang dikirim');
      f = { title: '', body: '', url: '/', segment: 'all', sendAt: '' }; load();
    } catch (e) { err(e); } finally { busy = false; }
  }
  async function cancel(id: number) { try { await api.del(`/api/admin/broadcasts/${id}`); toast('Dibatalkan'); load(); } catch (e) { err(e); } }
</script>

<h1>Notifikasi</h1>
<p class="muted">Kirim notifikasi push ke HP pemain (muncul walau game tertutup) dan ke kotak notifikasi di dalam game. Notifikasi otomatis (kebun siap panen, pet lapar, hadiah teman, pengingat hadiah harian) diatur di menu Ekonomi & fitur › Notifikasi otomatis.</p>
{#if data}
  <div class="kpis">
    <div class="kpi"><span>Perangkat berlangganan push</span><b>{num(data.stats.devices)}</b></div>
    <div class="kpi"><span>Pemain dengan push aktif</span><b>{num(data.stats.users)}</b></div>
    <div class="kpi"><span>Push terkirim 7 hari</span><b>{num(data.stats.sent7)}</b></div>
  </div>
{/if}
<div class="cols">
  <form class="card f" onsubmit={send}>
    <h3>Kirim notifikasi</h3>
    <label>Judul<input required maxlength="60" bind:value={f.title} placeholder="mis. Pekan Ceria dimulai!" /></label>
    <label>Isi<textarea required maxlength="160" bind:value={f.body} placeholder="mis. Hadiah koin +20% dan kupluk merah putih edisi terbatas."></textarea><span class="help">{f.body.length}/160</span></label>
    <div class="grid2">
      <label>Penerima<select bind:value={f.segment}>{#each SEG as [v, l]}<option value={v}>{l}</option>{/each}</select></label>
      <label>Saat diketuk, buka<select bind:value={f.url}>{#each URLS as [v, l]}<option value={v}>{l}</option>{/each}</select></label>
    </div>
    <label>Jadwalkan (kosongkan = kirim sekarang)<input type="datetime-local" bind:value={f.sendAt} /></label>
    <button class="btn primary" disabled={busy}>{f.sendAt ? 'Jadwalkan' : 'Kirim sekarang'}</button>
  </form>
  <div class="phone" aria-label="Pratinjau notifikasi">
    <div class="note"><img src="/icons/icon-192.png" alt="" /><div><b>{f.title || 'Judul notifikasi'}</b><p>{f.body || 'Isi notifikasi muncul di sini.'}</p></div></div>
    <span class="muted">Pratinjau di layar kunci Android</span>
  </div>
</div>
{#if data}
  <h2>Riwayat</h2>
  <div class="tbl"><table>
    <thead><tr><th>Dibuat</th><th>Judul</th><th>Penerima</th><th>Jadwal</th><th>Status</th><th class="num">Pemain</th><th class="num">Push OK</th><th></th></tr></thead>
    <tbody>{#each data.broadcasts as b (b.id)}<tr>
      <td>{dt(b.created_at)}</td><td><b>{b.title}</b><br /><span class="muted">{b.body}</span></td><td>{SEG.find((s) => s[0] === b.segment)?.[1] ?? b.segment}</td>
      <td>{dt(b.send_at)}</td><td>{ST[b.status] ?? b.status}</td><td class="num">{num(b.recipients ?? 0)}</td><td class="num">{num(b.pushed ?? 0)}</td>
      <td>{#if b.status === 'scheduled'}<button class="btn sm danger" onclick={() => cancel(b.id)}>Batalkan</button>{/if}</td>
    </tr>{:else}<tr><td colspan="8" class="muted">Belum ada notifikasi terkirim.</td></tr>{/each}</tbody>
  </table></div>
{/if}

<style>
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
  .kpi { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 12px 16px; display: flex; flex-direction: column; }
  .kpi span { font-size: 12.5px; color: var(--muted); font-weight: 600; } .kpi b { font-family: var(--display); font-size: 28px; }
  .cols { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 16px; align-items: start; }
  .f { display: flex; flex-direction: column; gap: 10px; } .f .btn { align-self: flex-start; }
  .phone { background: linear-gradient(160deg, #2B2F4A, #3E5A7A); border-radius: 22px; padding: 18px 14px; display: flex; flex-direction: column; gap: 10px; }
  .phone .muted { color: #C8CFE0; font-size: 12px; text-align: center; }
  .note { display: flex; gap: 10px; background: rgba(255,255,255,.92); border-radius: 14px; padding: 10px; }
  .note img { width: 36px; height: 36px; border-radius: 9px; }
  .note b { font-size: 14px; } .note p { margin: 2px 0 0; font-size: 13px; color: #3B3F55; }
  @media (max-width: 900px) { .cols { grid-template-columns: 1fr; } }
</style>
