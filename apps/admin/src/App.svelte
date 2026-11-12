<script lang="ts">
  import { onMount } from 'svelte';
  import { A, can, err, parseHash, pref, savePref } from './lib/store.svelte';
  import { api } from './lib/api';
  import { I } from './lib/icons';
  import TopProgress from './components/ui/TopProgress.svelte';
  import Toasts from './components/ui/Toasts.svelte';
  import AskHost from './components/ui/AskHost.svelte';
  import CommandPalette from './components/ui/CommandPalette.svelte';
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
  import Site from './pages/Site.svelte';
  import { APP_VERSION } from '@kb/shared';

  const NAV = [
    { group: 'Ringkasan', items: [{ k: 'dashboard', label: 'Dasbor', icon: 'dash', min: 'moderator', C: Dashboard }] },
    { group: 'Konten game', items: [
      { k: 'items', label: 'Item & harga', icon: 'box', min: 'moderator', C: Items },
      { k: 'events', label: 'Event', icon: 'cal', min: 'moderator', C: Events },
      { k: 'quests', label: 'Tugas', icon: 'quest', min: 'moderator', C: Quests },
      { k: 'activities', label: 'Aktivitas di rumah', icon: 'spark', min: 'moderator', C: Activities },
      { k: 'locations', label: 'Peta & toko', icon: 'map', min: 'moderator', C: Locations },
      { k: 'settings', label: 'Ekonomi & fitur', icon: 'sliders', min: 'moderator', C: Settings },
      { k: 'media', label: 'Media', icon: 'image', min: 'moderator', C: Media },
    ] },
    { group: 'Komunikasi', items: [
      { k: 'notifcenter', label: 'Pusat notifikasi', icon: 'bell', min: 'moderator', C: NotifyCenter },
      { k: 'broadcasts', label: 'Broadcast', icon: 'mega', min: 'admin', C: Broadcasts },
      { k: 'email', label: 'Email', icon: 'mail', min: 'admin', C: Email },
      { k: 'whatsapp', label: 'WhatsApp', icon: 'chat', min: 'admin', C: WhatsApp },
      { k: 'announcements', label: 'Pengumuman', icon: 'pin', min: 'moderator', C: Announcements },
    ] },
    { group: 'Pemain & uang', items: [
      { k: 'players', label: 'Pemain', icon: 'users', min: 'moderator', C: Players },
      { k: 'moderation', label: 'Moderasi', icon: 'shield', min: 'moderator', C: Moderation, badge: 'reports' },
      { k: 'payments', label: 'Pembayaran', icon: 'card', min: 'admin', C: Payments, badge: 'payments', amber: true },
      { k: 'packages', label: 'Paket Mutiara', icon: 'gem', min: 'moderator', C: Packages },
      { k: 'launch', label: 'Peluncuran', icon: 'rocket', min: 'admin', C: Launch },
    ] },
    { group: 'Sistem', items: [
      { k: 'audit', label: 'Log audit', icon: 'list', min: 'admin', C: Audit },
      { k: 'site', label: 'Situs & SEO', icon: 'globe', min: 'moderator', C: Site },
      { k: 'integrations', label: 'Integrasi & URL', icon: 'plug', min: 'admin', C: Integrations },
      { k: 'versions', label: 'Versi & changelog', icon: 'tag', min: 'moderator', C: Versions },
      { k: 'admins', label: 'Admin', icon: 'key', min: 'owner', C: Admins },
      { k: 'account', label: 'Akun saya', icon: 'user', min: 'moderator', C: Account },
    ] },
  ] as const;
  const flat = NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.group })));
  const visible = $derived(flat.filter((p) => can(p.min as any)));
  let loading = $state(true);
  let menu = $state(false);
  let folded = $state<string[]>([]);
  const page = $derived(visible.find((p) => p.k === A.route) ?? visible[0] ?? flat[0]);

  function route() { const h = parseHash(); A.route = h.route; A.arg = h.arg; A.query = h.query; menu = false; }
  // penanda merah di semua halaman admin selama mode perawatan aktif (supaya tidak lupa dimatikan)
  async function checkMaint() { try { A.maint = !!(await api.quiet('/api/site')).maintenance?.on; } catch { /* abaikan */ } }
  async function badges() { try { A.badges = (await api.quiet('/api/admin/badges')).badges ?? {}; } catch { /* abaikan */ } }
  async function load() {
    try { A.me = await api.get('/api/admin/me'); } catch { A.me = null; }
    loading = false;
    if (A.me) { folded = pref('nav:folded', []); checkMaint(); badges(); }
  }
  async function logout() { await api.post('/api/admin/logout').catch(err); A.me = null; }
  function fold(g: string) { folded = folded.includes(g) ? folded.filter((x) => x !== g) : [...folded, g]; savePref('nav:folded', folded); }
  onMount(() => {
    route(); load(); addEventListener('hashchange', route);
    const t = setInterval(() => { if (A.me && !document.hidden) { checkMaint(); badges(); } }, 45_000);
    return () => { removeEventListener('hashchange', route); clearInterval(t); };
  });
  $effect(() => { void A.route; if (A.me) { checkMaint(); badges(); } });
  $effect(() => { document.title = A.me ? `${page.label} · Admin BUPI` : 'Admin BUPI'; });
  function keys(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && A.me) { e.preventDefault(); A.palette = !A.palette; }
  }
</script>

<svelte:window onkeydown={keys} />
<TopProgress />
{#if loading}
  <div class="loading"><span class="skel" style="width:180px;height:14px"></span></div>
{:else if !A.me}
  <Login onlogin={load} />
{:else}
  <div class="shell">
    <aside class:open={menu}>
      <div class="brand"><img src="/icons/favicon.svg" alt="" /><div><b>BUPI</b><span>Admin · v{APP_VERSION}</span></div></div>
      <button class="msearch" onclick={() => (A.palette = true)}><span class="ic">{@html I.search}</span>Cari menu / pemain<kbd>Ctrl K</kbd></button>
      <nav aria-label="Menu admin">
        {#each NAV as g}
          {@const vis = g.items.filter((i) => can(i.min as any))}
          {#if vis.length}
            {@const sum = vis.reduce((a, i: any) => a + (i.badge ? A.badges[i.badge] ?? 0 : 0), 0)}
            <button class="grp" aria-expanded={!folded.includes(g.group)} onclick={() => fold(g.group)}>
              {g.group}{#if folded.includes(g.group) && sum}<span class="badge sm">{sum}</span>{/if}<span class="ic" class:shut={folded.includes(g.group)}>{@html I.down}</span>
            </button>
            {#if !folded.includes(g.group) || vis.some((i) => i.k === page.k)}
              {#each vis.filter((i) => !folded.includes(g.group) || i.k === page.k) as it (it.k)}
                {@const b = 'badge' in it ? A.badges[it.badge] ?? 0 : 0}
                <a href="#/{it.k}" class:on={page.k === it.k} aria-current={page.k === it.k ? 'page' : undefined}>
                  <span class="ic">{@html I[it.icon]}</span>{it.label}{#if b}<span class="badge" class:amber={'amber' in it}>{b > 99 ? '99+' : b}</span>{/if}
                </a>
              {/each}
            {/if}
          {/if}
        {/each}
      </nav>
      <div class="me">
        <span class="av">{(A.me.admin.name || A.me.admin.email).slice(0, 2).toUpperCase()}</span>
        <div class="who"><b>{A.me.admin.name || A.me.admin.email.split('@')[0]}</b><small>{A.me.admin.role} · <a href="#/versions">v{APP_VERSION}</a></small></div>
        <button class="btn sm icon out" title="Keluar" aria-label="Keluar" onclick={logout}>{@html I.logout}</button>
      </div>
    </aside>
    {#if menu}<div class="scrim" onclick={() => (menu = false)} role="presentation"></div>{/if}
    <main>
      <header class="mobile">
        <button class="btn sm icon" onclick={() => (menu = !menu)} aria-expanded={menu} aria-label="Menu">{@html I.menu}</button>
        <b>{page.label}</b>
        <button class="btn sm icon" onclick={() => (A.palette = true)} aria-label="Cari">{@html I.search}</button>
        <a class="btn sm icon" href="/" target="_blank" rel="noopener" aria-label="Buka game">{@html I.ext}</a>
      </header>
      {#if A.maint}<a class="maintbar" href="#/site"><span class="ic">{@html I.warn}</span>Mode perawatan AKTIF: pemain sedang tidak bisa main. Buka Situs &amp; SEO untuk mematikan.</a>{/if}
      {#key page.k}<div class="page fade"><page.C /></div>{/key}
    </main>
  </div>
  <CommandPalette pages={visible.map((p) => ({ k: p.k, label: p.label, icon: p.icon, group: p.group }))} />
{/if}
<Toasts />
<AskHost />

<style>
  .loading { min-height: 100vh; display: grid; place-items: center; }
  .maintbar { display: flex; gap: 8px; align-items: center; background: var(--danger); color: #fff; font-weight: 700; text-decoration: none; padding: 9px 14px; border-radius: 10px; animation: pulse 2.4s ease-in-out infinite; }
  @keyframes pulse { 50% { box-shadow: 0 0 0 4px var(--danger-soft); } }
  .shell { display: grid; grid-template-columns: 244px 1fr; min-height: 100vh; }
  aside { background: var(--ink); color: #E9ECF5; display: flex; flex-direction: column; gap: 8px; padding: 14px 10px 12px; position: sticky; top: 0; height: 100vh; overflow-y: auto; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.2) transparent; }
  .brand { display: flex; gap: 10px; align-items: center; padding: 2px 6px 4px; }
  .brand img { width: 36px; height: 36px; border-radius: 10px; }
  .brand div { display: flex; flex-direction: column; } .brand b { font-family: var(--display); font-size: 18px; line-height: 1.1; } .brand span { font-size: 11.5px; opacity: .7; }
  .msearch { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.14); border-radius: 9px; padding: 7px 9px; color: #B9C0D6; font-size: 13px; cursor: pointer; white-space: nowrap; }
  .msearch:hover { background: rgba(255,255,255,.12); }
  .msearch:focus-visible { outline: 3px solid #7DB2E8; }
  .msearch kbd { margin-left: auto; font: 10.5px var(--mono); border: 1px solid rgba(255,255,255,.25); border-radius: 5px; padding: 0 5px; }
  nav { display: flex; flex-direction: column; gap: 1px; flex: 1; }
  .grp { all: unset; display: flex; align-items: center; gap: 6px; margin: 8px 8px 2px; font-size: 10.5px; text-transform: uppercase; letter-spacing: .08em; color: rgba(233,236,245,.55); font-weight: 700; cursor: pointer; }
  .grp:hover { color: #fff; } .grp:focus-visible { outline: 2px solid #7DB2E8; }
  .grp .ic { margin-left: auto; width: 12px; height: 12px; transition: transform .2s; } .grp .ic.shut { transform: rotate(-90deg); }
  nav a { display: flex; align-items: center; gap: 10px; color: #E9ECF5; text-decoration: none; padding: 6px 10px; border-radius: 8px; font-weight: 500; font-size: 13.5px; transition: background .12s; }
  nav a .ic { opacity: .75; }
  nav a:hover { background: rgba(255,255,255,.08); }
  nav a.on { background: #F2B632; color: var(--ink); font-weight: 700; } nav a.on .ic { opacity: 1; }
  .badge { margin-left: auto; min-width: 20px; height: 20px; border-radius: 999px; background: #E0583F; color: #fff; font: 700 11.5px var(--body); display: grid; place-items: center; padding: 0 6px; }
  .badge.amber { background: #F2B632; color: var(--ink); }
  nav a.on .badge { background: var(--ink); color: #fff; }
  .badge.sm { min-width: 16px; height: 16px; font-size: 10px; margin-left: 4px; }
  .me { display: flex; align-items: center; gap: 9px; border-top: 1px solid rgba(255,255,255,.15); padding: 10px 4px 0; font-size: 12.5px; }
  .av { width: 32px; height: 32px; border-radius: 50%; background: var(--accent-2); color: #fff; display: grid; place-items: center; font-weight: 800; font-size: 12px; flex: none; }
  .who { flex: 1; min-width: 0; display: flex; flex-direction: column; } .who b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .who small { opacity: .7; } .who a { color: #B9C0D6; font-family: var(--mono); }
  .out { background: transparent; color: #E9ECF5; border-color: rgba(255,255,255,.3); }
  .out:hover:not(:disabled) { background: rgba(255,255,255,.1) !important; }
  .out :global(svg) { width: 15px; height: 15px; }
  main { padding: 22px 28px 70px; min-width: 0; display: flex; flex-direction: column; gap: 16px; }
  .page { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
  .mobile { display: none; }
  .scrim { display: none; }
  @media (max-width: 860px) {
    .shell { grid-template-columns: 1fr; }
    aside { position: fixed; z-index: 70; left: 0; top: 0; width: 264px; transform: translateX(-100%); transition: transform .22s ease-out; }
    aside.open { transform: none; box-shadow: 10px 0 30px rgba(0,0,0,.25); }
    .scrim { display: block; position: fixed; inset: 0; z-index: 69; background: rgba(43,47,74,.4); animation: fadein .15s; }
    main { padding: 10px 14px 70px; gap: 14px; }
    .mobile { display: flex; align-items: center; gap: 8px; position: sticky; top: 0; z-index: 30; background: var(--bg); padding: 6px 0; }
    .mobile b { flex: 1; font-family: var(--display); font-size: 18px; }
    .mobile :global(svg) { width: 17px; height: 17px; }
  }
</style>
