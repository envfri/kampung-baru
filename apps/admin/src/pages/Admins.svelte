<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { A, err, toast, dt } from '../lib/store.svelte';
  let rows = $state<any[]>([]);
  let f = $state({ email: '', name: '', password: '', role: 'moderator' });
  async function load() { try { rows = (await api.get('/api/admin/admins')).admins; } catch (e) { err(e); } }
  onMount(load);
  async function add(e: Event) { e.preventDefault(); try { await api.post('/api/admin/admins', f); toast('Admin ditambahkan'); f = { email: '', name: '', password: '', role: 'moderator' }; load(); } catch (e) { err(e); } }
  async function role(id: string, r: string) { try { await api.put(`/api/admin/admins/${id}`, { role: r }); toast('Peran diubah'); load(); } catch (e) { err(e); load(); } }
  async function rm(id: string) { try { await api.del(`/api/admin/admins/${id}`); toast('Admin dihapus'); load(); } catch (e) { err(e); } }
</script>
<h1>Admin</h1>
<p class="muted"><b>Pemilik</b>: semua akses, termasuk harga Mutiara dan admin. <b>Admin</b>: konten, ekonomi, notifikasi, dompet pemain. <b>Moderator</b>: lihat data, blokir, ganti nama, moderasi kata.</p>
<div class="tbl"><table>
  <thead><tr><th>Email</th><th>Nama</th><th>Peran</th><th>Login terakhir</th><th></th></tr></thead>
  <tbody>{#each rows as r (r.id)}<tr><td>{r.email}</td><td>{r.name}</td>
    <td><select value={r.role} onchange={(e) => role(r.id, (e.target as HTMLSelectElement).value)} disabled={r.id === A.me?.admin.id} style="max-width:150px"><option value="owner">Pemilik</option><option value="admin">Admin</option><option value="moderator">Moderator</option></select></td>
    <td>{dt(r.last_login_at)}</td><td>{#if r.id !== A.me?.admin.id}<button class="btn sm danger" onclick={() => rm(r.id)}>Hapus</button>{/if}</td></tr>{/each}</tbody>
</table></div>
<form class="card add" onsubmit={add}>
  <h3>Tambah admin</h3>
  <div class="grid2">
    <label>Email<input type="email" required bind:value={f.email} /></label>
    <label>Nama<input bind:value={f.name} /></label>
    <label>Password awal (min. 10 karakter)<input type="password" minlength="10" required bind:value={f.password} autocomplete="new-password" /></label>
    <label>Peran<select bind:value={f.role}><option value="moderator">Moderator</option><option value="admin">Admin</option><option value="owner">Pemilik</option></select></label>
  </div>
  <button class="btn primary">Tambah</button>
</form>
<style>.add { display: flex; flex-direction: column; gap: 10px; max-width: 640px; } .add .btn { align-self: flex-start; }</style>
