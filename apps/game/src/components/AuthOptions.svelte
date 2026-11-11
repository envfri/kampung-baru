<script lang="ts">
  import { onMount } from 'svelte';
  import { G, toast, fail } from '../lib/game.svelte';
  import { api } from '../lib/api';
  import { withSwitch, afterAuth } from '../lib/account.svelte';
  import RedeemCode from './RedeemCode.svelte';

  // guest = layar masuk (ada "Main sekarang" & kode pindah); di dalam game dipakai untuk menautkan akun.
  // exclude = cara masuk yang sudah tersambung (tidak ditampilkan lagi).
  let { guest = true, exclude = [], ondone }: { guest?: boolean; exclude?: string[]; ondone?: (r: any) => void } = $props();
  let mode = $state<'pick' | 'email' | 'code' | 'transfer'>('pick');
  let email = $state('');
  let code = $state('');
  let busy = $state(false);
  let googleEl: HTMLDivElement | undefined = $state();
  const login = $derived(G.config?.login ?? {});

  function loadScript(src: string) {
    return new Promise<void>((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) return res();
      const s = document.createElement('script');
      s.src = src; s.async = true; s.onload = () => res(); s.onerror = () => rej(new Error('gagal memuat'));
      document.head.appendChild(s);
    });
  }

  function finish(r: any) {
    if (!r) return;
    afterAuth(r);
    ondone?.(r);
  }
  /** login/tautkan dengan konfirmasi bila identitas itu milik akun BUPI lain */
  async function auth(url: string, body: Record<string, unknown>, via: string) {
    busy = true;
    try { finish(await withSwitch((x) => api.post(url, { ...body, ...x }), via)); } catch (e) { fail(e); } finally { busy = false; }
  }

  async function doGuest() {
    busy = true;
    try { finish(await api.post('/api/auth/guest')); } catch (e) { fail(e); } finally { busy = false; }
  }
  async function sendCode(e: Event) {
    e.preventDefault();
    busy = true;
    try {
      const r = await api.post('/api/auth/email/start', { email });
      mode = 'code';
      if (r.devCode) { code = r.devCode; toast(`Mode pengembangan: kode ${r.devCode}`); }
      else toast('Kode dikirim ke email kamu.', 'good');
    } catch (e) { fail(e); } finally { busy = false; }
  }
  async function verify(e: Event) {
    e.preventDefault();
    await auth('/api/auth/email/verify', { email, code }, 'email');
  }
  async function facebook() {
    try {
      await loadScript('https://connect.facebook.net/id_ID/sdk.js');
      const FB = (window as any).FB;
      FB.init({ appId: login.facebook, version: 'v19.0', cookie: false, xfbml: false });
      FB.login(async (resp: any) => {
        if (!resp?.authResponse?.accessToken) return;
        await auth('/api/auth/facebook', { accessToken: resp.authResponse.accessToken }, 'facebook');
      }, { scope: 'public_profile,email' });
    } catch { toast('Login Facebook tidak bisa dimuat.', 'error'); }
  }

  onMount(async () => {
    if (!login.google || !googleEl) return;
    try {
      await loadScript('https://accounts.google.com/gsi/client?hl=id');
      const g = (window as any).google;
      g.accounts.id.initialize({
        client_id: login.google,
        callback: (resp: any) => auth('/api/auth/google', { credential: resp.credential }, 'google'),
      });
      g.accounts.id.renderButton(googleEl, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', locale: 'id', width: Math.min(320, googleEl.clientWidth || 300) });
    } catch { /* tombol google tidak tampil */ }
  });
</script>

<div class="auth">
  {#if mode === 'pick'}
    {#if guest && login.guest !== false}
      <button class="btn hot block big" disabled={busy} onclick={doGuest}>Main sekarang</button>
      <p class="hint">Tanpa daftar. Progres bisa disimpan ke akun kapan saja.</p>
    {/if}
    {#if login.google && !exclude.includes('google')}<div class="google" bind:this={googleEl}></div>{/if}
    {#if login.facebook && !exclude.includes('facebook')}<button class="btn block fb" disabled={busy} onclick={facebook}>Lanjut dengan Facebook</button>{/if}
    {#if login.email !== false && !exclude.includes('email')}<button class="btn block" disabled={busy} onclick={() => (mode = 'email')}>{guest ? 'Masuk dengan email' : 'Simpan dengan email'}</button>{/if}
    {#if guest && login.transfer !== false}<button type="button" class="link" onclick={() => (mode = 'transfer')}>Punya kode pindah perangkat?</button>{/if}
  {:else if mode === 'transfer'}
    <RedeemCode ondone={() => ondone?.(null)} />
    <button type="button" class="link" onclick={() => (mode = 'pick')}>Kembali</button>
  {:else if mode === 'email'}
    <form onsubmit={sendCode}>
      <label for="kb-email">Email</label>
      <input id="kb-email" class="input" type="email" inputmode="email" autocomplete="email" required bind:value={email} placeholder="nama@email.com" />
      <button class="btn hot block" disabled={busy || !email}>Kirim kode</button>
      <button type="button" class="link" onclick={() => (mode = 'pick')}>Kembali</button>
    </form>
  {:else}
    <form onsubmit={verify}>
      <label for="kb-code">Kode 6 angka dari email</label>
      <input id="kb-code" class="input code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required bind:value={code} placeholder="000000" />
      <button class="btn hot block" disabled={busy || code.length !== 6}>Masuk</button>
      <button type="button" class="link" onclick={() => (mode = 'email')}>Ganti email</button>
    </form>
  {/if}
</div>

<style>
  .auth { display: flex; flex-direction: column; gap: 10px; width: 100%; }
  .big { font-size: 20px; min-height: 54px; }
  .hint { margin: -2px 0 6px; text-align: center; font-size: 13.5px; color: var(--muted); font-weight: 600; }
  .google { display: flex; justify-content: center; min-height: 44px; }
  .fb { background: #E3ECFB; }
  form { display: flex; flex-direction: column; gap: 10px; }
  label { font-weight: 700; font-size: 15px; }
  .code { text-align: center; letter-spacing: 8px; font-size: 24px; }
  .link { background: none; border: 0; font-weight: 700; color: var(--muted); text-decoration: underline; cursor: pointer; padding: 6px; font-size: 15px; }
</style>
