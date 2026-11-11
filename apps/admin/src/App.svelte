<script lang="ts">
  import { onMount } from 'svelte';
  import { A, can, err } from './lib/store.svelte';
  import { api } from './lib/api';
  import Toast from './components/Toast.svelte';
  import Login from './pages/Login.svelte';
  import Dashboard from './pages/Dashboard.svelte';
  import Items from './pages/Items.svelte';
  import Events from './pages/Events.svelte';
  import Locations from './pages/Locations.svelte';
  import Settings from './pages/Settings.svelte';
  import Packages from './pages/Packages.svelte';
  import Announcements from './pages/Announcements.svelte';
  import Broadcasts from './pages/Broadcasts.svelte';
  import Players from './pages/Players.svelte';
  import Payments from './pages/Payments.svelte';
  import Moderation from './pages/Moderation.svelte';
  import Media from './pages/Media.svelte';
  import Audit from './pages/Audit.svelte';
  import Admins from './pages/Admins.svelte';
  import Account from './pages/Account.svelte';
  import Quests from './pages/Quests.svelte';
  import Activities from './pages/Activities.svelte';
  import Email from './pages/Email.svelte';
  import NotifyCenter from './pages/NotifyCenter.svelte';
  import WhatsApp from './pages/WhatsApp.svelte';
  import Versions from './pages/Versions.svelte';
  import Integrations from './pages/Integrations.svelte';
  import Launch from './pages/Launch.svelte';
  import { APP_VERSION } from '@kb/shared';

  const NAV = [
    { group: 'Ringkasan', items: [{ k: 'dashboard', label: 'Dasbor', min: 'moderator', C: Dashboard }] },
    { group: 'Konten game', items: [
      { k: 'items', label: 'Item & harga', min: 'moderator', C: Items },
      { k: 'events', label: 'Event', min: 'moderator', C: Events },
      { k: 'quests', label: 'Tugas', min: 'moderator', C: Quests },
      { k: 'activities', label: 'Aktivitas di rumah', min: 'moderator', C: Activities },
      { k: 'locations', label: 'Peta & toko', min: 'moderator', C: Locations },
      { k: 'settings', label: 'Ekonomi & fitur', min: 'moderator', C: Settings },
      { k: 'media', label: 'Media', min: 'moderator', C: Media },
    ] },
    { group: 'Komunikasi', items: [
      { k: 'notifcenter', label: 'Pusat notifikasi', min: 'moderator', C: NotifyCenter },
      { k: 'broadcasts', label: 'Broadcast', min: 'admin', C: Broadcasts },
      { k: 'email', label: 'Email', min: 'admin', C: Email },
      { k: 'whatsapp', label: 'WhatsApp', min: 'admin', C: WhatsApp },
      { k: 'announcements', label: 'Pengumuman', min: 'moderator', C: Announcements },
    ] },
    { group: 'Pemain & uang', items: [
      { k: 'players', label: 'Pemain', min: 'moderator', C: Players },
      { k: 'moderation', label: 'Moderasi kata', min: 'moderator', C: Moderation },
      { k: 'payments', label: 'Pembayaran', min: 'admin', C: Payments },
      { k: 'packages', label: 'Paket Mutiara', min: 'moderator', C: Packages },
      { k: 'launch', label: 'Peluncuran', min: 'admin', C: Launch },
    ] },
    { group: 'Sistem', items: [
      { k: 'audit', label: 'Log audit', min: 'admin', C: Audit },
      { k: 'integrations', label: 'Integrasi & URL', min: 'admin', C: Integrations },
      { k: 'versions', label: 'Versi & changelog', min: 'moderator', C: Versions },
      { k: 'admins', label: 'Admin', min: 'owner', C: Admins },
      { k: 'account', label: 'Akun saya', min: 'moderator', C: Account },
    ] },
  ] as const;
  const flat = NAV.flatMap((g) => g.items);
  let loading = $state(true);
  let menu = $state(false);
  const page = $derived(flat.find((p) => p.k === A.route && can(p.min as any)) ?? flat[0]);

  // tautan langsung: #/players/<id> membuka detail pemain
  function route() { const [r, ...rest] = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('/'); A.route = r; A.arg = rest.join('/'); menu = false; }
  async function load() {
    try { A.me = await api.get('/api/admin/me'); } catch { A.me = null; }
    loading = false;
  }
  async function logout() { await api.post('/api/admin/logout').catch(err); A.me = null; }
  onMount(() => { route(); load(); addEventListener('hashchange', route); return () => removeEventListener('hashchange', route); });
</script>

{#if loading}
  <p class="loading">Memuat…</p>
{:else if !A.me}
  <Login onlogin={load} />
{:else}
  <div class="shell">
    <aside class:open={menu}>
      <div class="brand"><img src="/icons/favicon.svg" alt="" /><div><b>BUPI</b><span>Admin</span></div></div>
      <nav>
        {#each NAV as g}
          {@const vis = g.items.filter((i) => can(i.min as any))}
          {#if vis.length}
            <p class="grp">{g.group}</p>
            {#each vis as it}<a href="#/{it.k}" class:on={page.k === it.k}>{it.label}</a>{/each}
          {/if}
        {/each}
      </nav>
      <div class="me">
        <span>{A.me.admin.email}</span>
        <span class="chip mute">{A.me.admin.role}</span>
        <a class="ver" href="#versions" title="Versi & changelog">v{APP_VERSION}</a>
        <button class="btn sm" onclick={logout}>Keluar</button>
      </div>
    </aside>
    <main>
      <header class="mobile"><button class="btn sm" onclick={() => (menu = !menu)} aria-expanded={menu}>Menu</button><b>{page.label}</b><a class="btn sm" href="/" target="_blank" rel="noopener">Buka game</a></header>
      {#key page.k}<page.C />{/key}
    </main>
  </div>
{/if}
<Toast />

<style>
  .loading { padding: 40px; text-align: center; }
  .shell { display: grid; grid-template-columns: 236px 1fr; min-height: 100vh; }
  aside { background: var(--ink); color: #E9ECF5; display: flex; flex-direction: column; gap: 10px; padding: 16px 12px; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
  .brand { display: flex; gap: 10px; align-items: center; padding: 4px 6px 10px; }
  .brand img { width: 38px; height: 38px; border-radius: 10px; }
  .brand div { display: flex; flex-direction: column; } .brand b { font-family: var(--display); font-size: 18px; } .brand span { font-size: 12px; opacity: .7; }
  nav { display: flex; flex-direction: column; gap: 2px; flex: 1; }
  .grp { margin: 10px 8px 4px; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; opacity: .55; }
  nav a { color: #E9ECF5; text-decoration: none; padding: 7px 10px; border-radius: 8px; font-weight: 500; }
  nav a:hover { background: rgba(255,255,255,.08); }
  nav a.on { background: #F2B632; color: var(--ink); font-weight: 700; }
  .me { display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; border-top: 1px solid rgba(255,255,255,.15); padding-top: 10px; word-break: break-all; }
  .me .btn { background: transparent; color: #E9ECF5; border-color: rgba(255,255,255,.4); }
  main { padding: 24px 28px 60px; min-width: 0; display: flex; flex-direction: column; gap: 18px; }
  .mobile { display: none; }
  @media (max-width: 860px) {
    .shell { grid-template-columns: 1fr; }
    aside { position: fixed; z-index: 30; left: 0; top: 0; width: 260px; transform: translateX(-100%); transition: transform .2s; }
    aside.open { transform: none; box-shadow: 10px 0 30px rgba(0,0,0,.2); }
    main { padding: 12px 14px 60px; }
    .mobile { display: flex; justify-content: space-between; align-items: center; gap: 10px; position: sticky; top: 0; z-index: 10; background: var(--bg); padding: 6px 0; }
  }
  .me .ver { color: #B9C0D6; font: 600 12px var(--mono); text-decoration: none; }
  .me .ver:hover { color: #fff; text-decoration: underline; }
</style>
