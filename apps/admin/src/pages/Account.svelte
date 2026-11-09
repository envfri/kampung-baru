<script lang="ts">
  import { api } from '../lib/api';
  import { A, err, toast } from '../lib/store.svelte';
  let current = $state(''), next = $state('');
  async function save(e: Event) { e.preventDefault(); try { await api.post('/api/admin/password', { current, next }); toast('Password diganti'); current = next = ''; } catch (e) { err(e); } }
</script>
<h1>Akun saya</h1>
<p>{A.me?.admin.email} · peran <b>{A.me?.admin.role}</b></p>
<form class="card f" onsubmit={save}>
  <h3>Ganti password</h3>
  <label>Password lama<input type="password" required bind:value={current} autocomplete="current-password" /></label>
  <label>Password baru (min. 10 karakter)<input type="password" minlength="10" required bind:value={next} autocomplete="new-password" /></label>
  <button class="btn primary">Simpan</button>
</form>
<style>.f { display: flex; flex-direction: column; gap: 10px; max-width: 420px; } .f .btn { align-self: flex-start; } p { margin: 0; }</style>
