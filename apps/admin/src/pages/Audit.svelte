<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { err, dt } from '../lib/store.svelte';
  let rows = $state<any[]>([]), page = $state(0), open = $state<number | null>(null);
  async function load() { try { rows = (await api.get(`/api/admin/audit?page=${page}`)).audit; } catch (e) { err(e); } }
  onMount(load);
</script>
<h1>Log audit</h1>
<p class="muted">Semua perubahan oleh admin tercatat di sini.</p>
<div class="tbl"><table>
  <thead><tr><th>Waktu</th><th>Admin</th><th>Aksi</th><th>Target</th><th>Detail</th></tr></thead>
  <tbody>{#each rows as r (r.id)}<tr><td>{dt(r.created_at)}</td><td>{r.admin_email ?? '—'}</td><td class="mono">{r.action}</td><td class="mono">{r.target ?? ''}</td>
    <td>{#if r.detail}<button class="btn sm" onclick={() => (open = open === r.id ? null : r.id)}>{open === r.id ? 'Tutup' : 'Lihat'}</button>{#if open === r.id}<pre class="mono">{JSON.stringify(r.detail, null, 1)}</pre>{/if}{/if}</td></tr>{/each}</tbody>
</table></div>
<div class="row"><button class="btn sm" disabled={page === 0} onclick={() => { page--; load(); }}>Sebelumnya</button><button class="btn sm" disabled={rows.length < 100} onclick={() => { page++; load(); }}>Berikutnya</button></div>
<style>pre { white-space: pre-wrap; max-width: 420px; max-height: 240px; overflow: auto; background: #F6F8F6; padding: 8px; border-radius: 8px; }</style>
