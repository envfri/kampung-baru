<script lang="ts">
  import { api } from '../lib/api';
  import { err } from '../lib/store.svelte';
  let { onlogin }: { onlogin: () => void } = $props();
  let email = $state(''), password = $state(''), busy = $state(false);
  async function submit(e: Event) {
    e.preventDefault(); busy = true;
    try { await api.post('/api/admin/login', { email, password }); onlogin(); } catch (e) { err(e); } finally { busy = false; }
  }
</script>
<main>
  <form class="card" onsubmit={submit}>
    <img src="/icons/favicon.svg" alt="" />
    <h1>Admin BUPI</h1>
    <label>Email<input type="email" autocomplete="username" required bind:value={email} /></label>
    <label>Password<input type="password" autocomplete="current-password" required bind:value={password} /></label>
    <button class="btn primary" disabled={busy}>Masuk</button>
    <p class="muted">Akun admin pertama dibuat dari ADMIN_EMAIL dan ADMIN_PASSWORD di file .env server.</p>
  </form>
</main>
<style>
  main { min-height: 100vh; display: grid; place-items: center; padding: 16px; }
  form { width: min(380px, 100%); display: flex; flex-direction: column; gap: 12px; }
  img { width: 56px; height: 56px; border-radius: 14px; }
  p { margin: 0; font-size: 12.5px; }
</style>
