<script lang="ts">
  import { onMount } from 'svelte';
  import { G, run, post, fx, toast, item, refreshMe, startEdit, settings, serverNow, track } from '../lib/game.svelte';
  import { api } from '../lib/api';
  import { I } from '../lib/icons';
  import { sfx } from '../lib/sfx';
  import Hud from '../components/Hud.svelte';
  import Needs from '../components/Needs.svelte';
  import Dock from '../components/Dock.svelte';
  import Room from '../scenes/Room.svelte';
  import MapScene from '../scenes/MapScene.svelte';
  import Garden from '../scenes/Garden.svelte';
  import Karung from '../scenes/Karung.svelte';
  import Fishing from '../scenes/Fishing.svelte';
  import Shop from '../panels/Shop.svelte';
  import Bag from '../panels/Bag.svelte';
  import Friends from '../panels/Friends.svelte';
  import Pearls from '../panels/Pearls.svelte';
  import Settings from '../panels/Settings.svelte';
  import Daily from '../panels/Daily.svelte';
  import News from '../panels/News.svelte';
  import Collection from '../panels/Collection.svelte';
  import Picker from '../panels/Picker.svelte';
  import Notifs from '../panels/Notifs.svelte';
  import Quests from '../panels/Quests.svelte';
  import Wardrobe from '../panels/Wardrobe.svelte';
  import Games from '../panels/Games.svelte';
  import EventPanel from '../panels/Event.svelte';
  import Panen from '../scenes/Panen.svelte';
  import Memori from '../scenes/Memori.svelte';
  import QuestChip from '../components/QuestChip.svelte';
  import PushPrompt from '../components/PushPrompt.svelte';
  import { syncPush } from '../lib/push';
  import { openLink } from '../lib/links';

  const ACTS = [
    { k: 'makan', label: 'Makan', icon: I.eat },
    { k: 'mandi', label: 'Mandi', icon: I.bath },
    { k: 'main', label: 'Main', icon: I.play },
    { k: 'tidur', label: 'Tidur', icon: I.sleep },
  ] as const;
  const FX: Record<string, 'bubbles' | 'coins' | 'zz'> = { mandi: 'bubbles', main: 'coins', tidur: 'zz' };
  let night = $state(false);

  const cdLeft = (k: string) => Math.max(0, Math.ceil(((G.cool[k] ?? 0) - Date.now()) / 1000));
  const fmtCd = (s: number) => (s >= 60 ? Math.ceil(s / 60) + 'm' : s + 'd');

  async function act(k: string) {
    if (k === 'makan') { G.sheet = 'feed'; return; }
    sfx.tap();
    fx(FX[k]);
    if (k === 'tidur') { night = true; setTimeout(() => (night = false), 1300); }
    const r: any = await run(() => post('/api/action', { type: k }));
    const cfg = settings().actions?.[k];
    if (r) {
      if (cfg?.cooldownSec) G.cool[k] = Date.now() + cfg.cooldownSec * 1000;
      if (r.result?.coins) { sfx.coin(); toast(`+${r.result.coins} koin dari bermain`, 'good'); }
      else if (k === 'mandi') toast(`${G.me.pet.name} wangi lagi`, 'good');
      else if (k === 'tidur') toast(`${G.me.pet.name} tidur nyenyak`, 'good');
      if (r.result?.levelUp) { sfx.level(); toast(`Naik ke Lv ${r.result.levelUp}!`, 'good'); }
    }
  }

  async function saveEdit() {
    if (!G.draft) return;
    const r = await run(() => api.post('/api/room', { layout: G.draft, version: G.me.room.version }));
    if (r) { G.edit = false; G.draft = null; G.sel = -1; sfx.pop(); toast('Ruangan disimpan', 'good'); }
  }
  function cancelEdit() { G.edit = false; G.draft = null; G.sel = -1; }
  function storeSel() {
    if (!G.draft || G.sel < 0) return;
    G.draft.splice(G.sel, 1);
    G.sel = -1;
    sfx.tap();
  }

  async function claimVisit() {
    const r: any = await run(() => api.post(`/api/visit/${G.visit.owner.id}/claim`));
    if (r) { G.visit.claimed = true; sfx.coin(); fx('coins'); toast(`+${r.coins} koin dan +${r.xp} XP`, 'good'); }
  }

  const event = $derived((G.me.events ?? [])[0]);
  const selItem = $derived(G.edit && G.draft && G.sel >= 0 ? item(G.draft[G.sel]?.i) : null);

  onMount(() => {
    track('session_start', { standalone: matchMedia('(display-mode: standalone)').matches });
    const seen = (() => { try { return JSON.parse(localStorage.getItem('kb-news-seen') ?? '[]'); } catch { return []; } })();
    syncPush();
    // dibuka dari notifikasi / tautan (mis. /#garden)
    const initialHash = location.hash;
    if (initialHash.length > 1) { history.replaceState(null, '', location.pathname + location.search); openLink('/' + initialHash); }
    const onSw = (e: MessageEvent) => { if (e.data?.type === 'navigate') openLink(e.data.url); refreshMe().catch(() => {}); };
    navigator.serviceWorker?.addEventListener('message', onSw);
    if (initialHash.length > 1) { /* sudah diarahkan */ }
    else if (!G.me.daily.claimedToday) G.sheet = 'daily';
    else if ((G.me.announcements ?? []).some((a: any) => !seen.includes(a.id))) G.sheet = 'news';
    // kembali dari halaman pembayaran
    const qs = new URLSearchParams(location.search);
    const pay = qs.get('payment');
    if (pay) {
      history.replaceState(null, '', '/');
      let tries = 0;
      const poll = async () => {
        try {
          const r = await api.get(`/api/payments/${pay}`);
          if (r.payment.status === 'paid') { G.me.wallet = r.wallet; sfx.level(); toast(`+${r.payment.pearls} Mutiara masuk. Terima kasih!`, 'good'); return; }
          if (r.payment.status !== 'pending') { toast('Pembayaran dibatalkan atau gagal.', 'error'); return; }
        } catch { /* coba lagi */ }
        if (++tries < 20) setTimeout(poll, 3000);
        else toast('Pembayaran masih diproses. Mutiara akan masuk otomatis.');
      };
      poll();
    }
    const orient = () => (G.portrait = window.innerHeight >= window.innerWidth);
    window.addEventListener('resize', orient);
    const refresh = setInterval(() => { if (document.visibilityState === 'visible') refreshMe().catch(() => {}); }, 120_000);
    return () => { window.removeEventListener('resize', orient); clearInterval(refresh); navigator.serviceWorker?.removeEventListener('message', onSw); };
  });
  void serverNow;
</script>

<div class="game" data-view={G.view}>
  <div class="scene">
    {#if G.view === 'home'}<Room mode="home" />
    {:else if G.view === 'visit' && G.visit}<Room mode="visit" />
    {:else if G.view === 'map'}<MapScene />
    {:else if G.view === 'garden'}<Garden />
    {:else if G.view === 'karung'}<Karung />
    {:else if G.view === 'fishing'}<Fishing />
    {:else if G.view === 'panen'}<Panen />
    {:else if G.view === 'memori'}<Memori />
    {/if}
  </div>
  <div class="night" class:on={night}></div>

  {#if !G.immersive}<Hud />{/if}

  {#if G.view === 'home' && !G.edit}
    <Needs />
    {#if event}
      <button class="event" style="--ev:{event.theme?.color ?? '#E0583F'}" onclick={() => (G.sheet = 'event')}>
        {event.name}{#if event.bonus?.coinMultiplier > 1} · koin ×{event.bonus.coinMultiplier}{/if}
      </button>
    {/if}
    <QuestChip />
    <div class="acts">
      {#each ACTS as a}
        {@const cd = G.now && cdLeft(a.k)}
        <button class="btn act" disabled={G.busy} onclick={() => act(a.k)}>
          {@html a.icon}<span>{a.label}</span>{#if cd > 0}<i class="cd">{fmtCd(cd)}</i>{/if}
        </button>
      {/each}
      <button class="btn act" onclick={startEdit}>{@html I.edit}<span>Atur</span></button>
    </div>
  {/if}

  {#if G.edit}
    <div class="editbar">
      <p>{selItem ? `${selItem.name} dipilih. Ketuk lantai untuk memindah.` : 'Ketuk barang, lalu ketuk lantai untuk memindah. Tambah barang dari Tas.'}</p>
      <div class="row">
        {#if selItem}<button class="btn sm" onclick={storeSel}>Simpan ke Tas</button>{/if}
        <button class="btn sm" onclick={() => { G.sheet = 'bag'; G.bagTab = 'furniture'; }}>{@html I.bag} Tas</button>
        <button class="btn sm" onclick={cancelEdit}>Batal</button>
        <button class="btn sm hot" disabled={G.busy} onclick={saveEdit}>Selesai</button>
      </div>
    </div>
  {/if}

  {#if G.view === 'visit' && G.visit}
    <div class="visit">
      <div class="who"><b>Rumah {G.visit.owner.display_name}</b>{#if G.visit.pet}<span>{G.visit.pet.name} · Lv {G.visit.pet.level}</span>{/if}</div>
      <div class="row">
        <button class="btn sm {G.visit.claimed ? '' : 'hot'}" disabled={G.visit.claimed || G.busy} onclick={claimVisit}>{G.visit.claimed ? 'Hadiah sudah diambil' : `Ambil +${settings().social?.visitCoins ?? 20} koin`}</button>
        <button class="btn sm" onclick={() => { G.sheet = 'gift'; G.sheetArg = { to: G.visit.owner.id, name: G.visit.owner.display_name }; }}>{@html I.gift} Hadiah</button>
        <button class="btn sm" onclick={() => { G.view = 'home'; G.visit = null; }}>Pulang</button>
      </div>
    </div>
  {/if}

  <PushPrompt />
  {#if !G.online}<div class="offline">Kamu sedang offline. Beberapa aksi butuh internet.</div>{/if}

  {#if !G.immersive && !G.edit}<Dock />{/if}

  {#if G.sheet === 'shop'}<Shop />
  {:else if G.sheet === 'bag' || G.sheet === 'feed'}<Bag />
  {:else if G.sheet === 'friends'}<Friends />
  {:else if G.sheet === 'pearls'}<Pearls />
  {:else if G.sheet === 'settings'}<Settings />
  {:else if G.sheet === 'daily'}<Daily />
  {:else if G.sheet === 'news'}<News />
  {:else if G.sheet === 'collection'}<Collection />
  {:else if G.sheet === 'seed' || G.sheet === 'gift'}<Picker />
  {:else if G.sheet === 'notifs'}<Notifs />
  {:else if G.sheet === 'quests'}<Quests />
  {:else if G.sheet === 'wardrobe'}<Wardrobe />
  {:else if G.sheet === 'games'}<Games />
  {:else if G.sheet === 'event'}<EventPanel />
  {/if}
</div>

<style>
  .game { position: fixed; inset: 0; overflow: hidden; background: linear-gradient(180deg, var(--bg1), var(--bg2)); }
  .game[data-view='map'] { background: #A9D18A; }
  .scene { position: absolute; inset: 0; }
  .night { position: absolute; inset: 0; background: #1B2340; opacity: 0; pointer-events: none; transition: opacity .5s; z-index: 2; }
  .night.on { opacity: .55; }
  .acts { position: absolute; z-index: 6; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-b) + 86px); display: flex; gap: 6px; }
  .act { position: relative; flex-direction: column; gap: 0; width: 62px; min-height: 56px; padding: 4px 2px; font-size: 13px; }
  .act :global(svg) { width: 22px; height: 22px; }
  .cd { position: absolute; top: -9px; right: -6px; background: var(--ink); color: var(--paper); font-style: normal; font-size: 11px; border-radius: 8px; padding: 0 5px; }
  .event { position: absolute; z-index: 6; top: calc(var(--safe-t) + 176px); left: 50%; transform: translateX(-50%); background: var(--ev); color: #fff; border: 2.5px solid var(--ink); border-radius: 999px; padding: 3px 14px; font-weight: 800; font-size: 13.5px; box-shadow: 0 2px 0 var(--ink); cursor: pointer; white-space: nowrap; max-width: 92vw; overflow: hidden; text-overflow: ellipsis; }
  .editbar, .visit { position: absolute; z-index: 15; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-b) + 12px); width: min(560px, calc(100vw - 20px)); background: var(--paper); border: 2.5px solid var(--ink); border-radius: 18px; box-shadow: 0 4px 0 var(--ink); padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
  .visit { top: calc(var(--safe-t) + 118px); bottom: auto; flex-direction: column; }
  .editbar p { margin: 0; font-weight: 700; font-size: 14.5px; }
  .row { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
  .who { display: flex; flex-direction: column; }
  .who b { font-size: 18px; } .who span { font-size: 13.5px; color: var(--muted); font-weight: 600; }
  .offline { position: absolute; z-index: 30; top: calc(var(--safe-t) + 4px); left: 50%; transform: translateX(-50%); background: #A93A27; color: #fff; font-weight: 700; font-size: 13px; border-radius: 10px; padding: 3px 10px; white-space: nowrap; }
  /* HP kecil (lebar 320–360 px): lima tombol aksi tetap muat dalam layar */
  @media (max-width: 359px) {
    .acts { gap: 4px; }
    .act { width: 56px; font-size: 12px; }
  }
  @media (min-width: 900px) and (min-aspect-ratio: 1/1) {
    .acts { left: auto; right: max(14px, var(--safe-r)); transform: none; bottom: calc(var(--safe-b) + 96px); flex-direction: column; }
    .act { flex-direction: row; width: auto; min-width: 116px; justify-content: flex-start; gap: 8px; padding: 6px 12px; font-size: 15px; min-height: 46px; }
    .event { top: calc(var(--safe-t) + 14px); }
    .visit { top: calc(var(--safe-t) + 84px); }
  }
</style>
