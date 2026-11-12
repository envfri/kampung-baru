<script lang="ts">
  // Halaman masuk admin: tampil/sembunyi password, putaran di tombol, pesan salah langsung di bawah form, peringatan Caps Lock.
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { I } from '../lib/icons';
  let { onlogin }: { onlogin: () => void } = $props();
  let email = $state(''), password = $state(''), busy = $state(false), show = $state(false), caps = $state(false);
  let msg = $state('');
  let emailEl: HTMLInputElement, pwEl: HTMLInputElement;
  onMount(() => emailEl?.focus());

  async function submit(e: Event) {
    e.preventDefault();
    if (busy) return;
    busy = true; msg = '';
    try { await api.post('/api/admin/login', { email: email.trim(), password }); onlogin(); }
    catch (x) {
      msg = x instanceof Error && x.message ? x.message : 'Gagal masuk. Coba lagi sebentar lagi.';
      setTimeout(() => pwEl?.select(), 0);
    } finally { busy = false; }
  }
  const capsCheck = (e: KeyboardEvent) => (caps = !!e.getModifierState?.('CapsLock'));
</script>

<main>
  <form class="card" onsubmit={submit} aria-describedby={msg ? 'login-msg' : undefined}>
    <div class="top">
      <img src="/icons/favicon.svg" alt="" />
      <div><h1>Admin BUPI</h1><p class="muted">Masuk untuk mengelola Kampung Bupi.</p></div>
    </div>
    <label>Email
      <input bind:this={emailEl} type="email" autocomplete="username" required bind:value={email} oninput={() => (msg = '')} class:bad={!!msg} />
    </label>
    <label>Password
      <span class="pw">
        <input bind:this={pwEl} type={show ? 'text' : 'password'} autocomplete="current-password" required bind:value={password}
          oninput={() => (msg = '')} onkeydown={capsCheck} onkeyup={capsCheck} class:bad={!!msg} />
        <button type="button" class="eye" aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'} aria-pressed={show} onclick={() => (show = !show)}>{@html show ? I.eyeOff : I.eye}</button>
      </span>
      {#if caps}<span class="help warn">Caps Lock menyala</span>{/if}
    </label>
    <button class="btn primary big" aria-busy={busy ? 'true' : undefined}>Masuk</button>
    {#if msg}<p class="msg fade" id="login-msg" role="alert"><span class="ic">{@html I.warn}</span>{msg}</p>{/if}
  </form>
</main>

<style>
  main { min-height: 100vh; display: grid; place-items: center; padding: 16px; background: radial-gradient(circle at 20% 10%, #DCEFE8, transparent 45%), var(--bg); }
  form { width: min(380px, 100%); display: flex; flex-direction: column; gap: 14px; padding: 24px 22px; box-shadow: 0 12px 34px rgba(43, 47, 74, .1); }
  .top { display: flex; gap: 12px; align-items: center; margin-bottom: 2px; }
  .top p { margin: 3px 0 0; font-size: 13.5px; }
  img { width: 52px; height: 52px; border-radius: 14px; flex: none; }
  .pw { position: relative; display: flex; align-items: center; }
  .pw input { padding-right: 42px; }
  .eye { all: unset; position: absolute; right: 6px; width: 30px; height: 30px; display: grid; place-items: center; border-radius: 8px; color: var(--muted); cursor: pointer; }
  .eye:hover { background: var(--hover); color: var(--ink); }
  .eye:focus-visible { outline: 3px solid #3F7FBF; }
  .eye :global(svg) { width: 18px; height: 18px; }
  .help.warn { color: var(--warn); font-weight: 600; }
  .big { min-height: 42px; font-size: 15px; }
  .msg { margin: 0; display: flex; gap: 8px; align-items: flex-start; background: var(--danger-soft); color: var(--danger); border-radius: 10px; padding: 9px 11px; font-size: 13.5px; font-weight: 600; }
  .msg .ic { width: 17px; height: 17px; flex: none; margin-top: 1px; }
</style>
