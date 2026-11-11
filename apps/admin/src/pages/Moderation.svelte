<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { err, toast, dt } from '../lib/store.svelte';
  let words = $state<string[]>([]), w = $state('');
  let chats = $state<any[]>([]), square = $state<any[]>([]), reports = $state<any[]>([]);
  let allReports = $state(false);
  async function load() {
    try {
      words = (await api.get('/api/admin/banned-words')).words;
      chats = (await api.get('/api/admin/house-chat')).chats;
      square = (await api.get('/api/admin/square-chat')).chats;
      reports = (await api.get(`/api/admin/reports${allReports ? '?all=1' : ''}`)).reports;
    } catch (e) { err(e); }
  }
  async function handle(r: any) { try { await api.post(`/api/admin/reports/${r.id}/handle`); toast('Laporan ditandai selesai'); load(); } catch (e) { err(e); } }
  onMount(load);
  async function add(e: Event) { e.preventDefault(); try { await api.post('/api/admin/banned-words', { word: w }); w = ''; toast('Kata ditambahkan'); load(); } catch (e) { err(e); } }
  async function rm(x: string) { try { await api.del(`/api/admin/banned-words/${encodeURIComponent(x)}`); load(); } catch (e) { err(e); } }
</script>
<h1>Moderasi kata</h1>
<p class="muted">Nama pet/pemain yang mengandung kata ini ditolak (termasuk variasi angka seperti 4 → a). Di pesan hadiah, kata ini disensor menjadi ***.</p>
<form class="row" onsubmit={add}><input bind:value={w} placeholder="Tambah kata" style="max-width:260px" aria-label="Kata" /><button class="btn primary" disabled={w.length < 2}>Tambah</button></form>
<div class="words">{#each words as x}<span class="w">{x}<button aria-label="Hapus {x}" onclick={() => rm(x)}>×</button></span>{/each}</div>

<h2>Laporan pemain</h2>
<p class="muted">Laporan dari Alun-alun (tempat semua pemain bertemu). Tiga pelapor berbeda dalam satu jam otomatis membisukan obrolan pemain itu 30 menit. Blokir akun lewat menu Pemain bila perlu.</p>
<label class="chk"><input type="checkbox" bind:checked={allReports} onchange={load} /> Tampilkan juga yang sudah ditangani</label>
<table class="tbl">
  <thead><tr><th>Waktu</th><th>Dilaporkan</th><th>Oleh</th><th>Alasan</th><th>Obrolan terakhir</th><th></th></tr></thead>
  <tbody>
    {#each reports as r (r.id)}
      <tr>
        <td>{dt(r.created_at)}</td>
        <td><a href="#/players/{r.target_id}">{r.target_name}</a>{#if r.banned_at} <span class="chip">diblokir</span>{/if}<br /><small class="muted">{r.week} laporan / 7 hari</small></td>
        <td>{r.reporter_name ?? '-'}</td>
        <td>{r.reason ?? '-'}</td>
        <td class="ev">{#each r.evidence ?? [] as e}<div>“{e.text}”</div>{:else}<span class="muted">-</span>{/each}</td>
        <td>{#if r.handled_at}<small class="muted">selesai ({r.handled_by})</small>{:else}<button class="btn" onclick={() => handle(r)}>Selesai</button>{/if}</td>
      </tr>
    {:else}<tr><td colspan="6" class="muted">Tidak ada laporan.</td></tr>{/each}
  </tbody>
</table>

<h2>Obrolan terbaru di Alun-alun</h2>
<p class="muted">200 pesan terakhir. Matikan ketik bebas (hanya frasa siap pakai) lewat Ekonomi &amp; fitur › Alun-alun › freeChat, atau tutup alun-alun dengan enabled.</p>
<table class="tbl">
  <thead><tr><th>Waktu</th><th>Pemain</th><th>Alun-alun</th><th>Pesan</th></tr></thead>
  <tbody>
    {#each square as c (c.id)}<tr><td>{dt(c.created_at)}</td><td><a href="#/players/{c.user_id}">{c.user_name}</a></td><td>{c.inst}</td><td>{c.text}</td></tr>
    {:else}<tr><td colspan="4" class="muted">Belum ada obrolan.</td></tr>{/each}
  </tbody>
</table>

<h2>Obrolan terbaru di rumah pemain</h2>
<p class="muted">Pesan saat kunjungan bareng (150 terakhir). Pesan dengan kata terlarang, tautan, akun, atau nomor sudah ditolak otomatis. Pemain yang bermasalah bisa diblokir di menu Pemain; matikan ketik bebas lewat Ekonomi &amp; fitur › Kunjungan bareng › freeChat.</p>
<table class="tbl">
  <thead><tr><th>Waktu</th><th>Pemain</th><th>Di rumah</th><th>Pesan</th></tr></thead>
  <tbody>
    {#each chats as c (c.id)}<tr><td>{dt(c.created_at)}</td><td>{c.user_name}</td><td>{c.host_name}</td><td>{c.text}</td></tr>
    {:else}<tr><td colspan="4" class="muted">Belum ada obrolan.</td></tr>{/each}
  </tbody>
</table>
<style>
  h2 { margin: 24px 0 4px; font-size: 18px; }
  .chk { display: flex; align-items: center; gap: 6px; font-size: 14px; margin: 6px 0; }
  .chk input { width: 16px; height: 16px; min-height: 0; }
  .ev div { font-size: 13px; }
  .chip { font-size: 11.5px; background: var(--warn-soft); color: var(--warn); border-radius: 8px; padding: 0 6px; }
  .words { display: flex; flex-wrap: wrap; gap: 8px; }
  .w { display: inline-flex; align-items: center; gap: 4px; background: #fff; border: 1px solid var(--line); border-radius: 999px; padding: 3px 4px 3px 12px; font-family: var(--mono); font-size: 13px; }
  .w button { border: 0; background: #F1F4F2; border-radius: 50%; width: 22px; height: 22px; cursor: pointer; }
</style>
