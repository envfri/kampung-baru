<script lang="ts">
  import { onMount } from 'svelte';
  import { G, loadCatalog, refreshMe } from './lib/game.svelte';
  import { api, ApiError } from './lib/api';
  import { petSVG } from '@kb/shared';
  import Login from './screens/Login.svelte';
  import Setup from './screens/Setup.svelte';
  import Game from './screens/Game.svelte';
  import Toast from './components/Toast.svelte';

  let error = $state('');

  async function boot() {
    error = '';
    try {
      G.config = await api.get('/api/config').catch(() => G.config ?? { login: { guest: true, email: true } });
      await loadCatalog();
      try {
        await refreshMe();
      } catch (e) {
        if (!(e instanceof ApiError) || (e.status !== 401 && e.status !== 403)) throw e;
        if (e.status === 403) error = e.message;
      }
    } catch (e: any) {
      error = e?.message ?? 'Gagal memuat game.';
    }
    G.booted = true;
  }

  onMount(() => {
    const qs = new URLSearchParams(location.search);
    const inv = qs.get('undang');
    if (inv) try { localStorage.setItem('kb-invite', inv.toUpperCase()); } catch { /* abaikan */ }
    boot();
    const t = setInterval(() => (G.now = Date.now()), 1000);
    const vis = () => { if (document.visibilityState === 'visible' && G.me) refreshMe().catch(() => {}); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  });
</script>

{#if !G.booted}
  <div class="splash">
    <div class="pet">{@html petSVG({ color: '#F6B7A8', ear: 'tunas' })}</div>
    <p>Memuat BUPI…</p>
  </div>
{:else if error && !G.me}
  <div class="splash">
    <div class="pet">{@html petSVG({ color: '#9FD0E8', ear: 'kelinci' })}</div>
    <p>{error}</p>
    <button class="btn hot" onclick={boot}>Coba lagi</button>
  </div>
{:else if !G.me}
  <Login />
{:else if !G.me.pet}
  <Setup />
{:else}
  <Game />
{/if}
<Toast />

<div class="rotate" aria-hidden="true">
  <div class="pet">{@html petSVG({ color: '#F6B7A8', ear: 'tunas' })}</div>
  <p>Putar HP ke posisi tegak untuk bermain</p>
</div>

{#if G.update}
  <div class="update">
    <span>Versi baru tersedia</span>
    <button class="btn sm hot" onclick={() => navigator.serviceWorker.getRegistration().then((r) => r?.waiting?.postMessage('SKIP_WAITING'))}>Muat ulang</button>
  </div>
{/if}

<style>
  .splash { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 24px; text-align: center; background: linear-gradient(180deg, var(--bg1), var(--bg2)); font-weight: 700; font-size: 18px; }
  .pet { width: 120px; height: 126px; animation: pop .5s ease-out; }
  .pet :global(svg) { width: 100%; height: 100%; }
  .rotate { display: none; }
  @media (orientation: landscape) and (max-height: 520px) and (pointer: coarse) {
    .rotate { display: flex; position: fixed; inset: 0; z-index: 200; flex-direction: column; align-items: center; justify-content: center; gap: 10px; background: linear-gradient(180deg, var(--bg1), var(--bg2)); text-align: center; padding: 20px; }
    .rotate .pet { width: 90px; height: 95px; transform: rotate(-90deg); animation: none; }
    .rotate p { margin: 0; font-size: 19px; font-weight: 800; }
  }
  .update { position: fixed; left: 50%; transform: translateX(-50%); top: calc(var(--safe-t) + 104px); z-index: 60; display: flex; gap: 10px; align-items: center; background: var(--paper); border: 2.5px solid var(--ink); border-radius: 16px; box-shadow: 0 3px 0 var(--ink); padding: 6px 6px 6px 14px; font-weight: 700; white-space: nowrap; }
</style>
