<script lang="ts">
  import { onMount } from 'svelte';
  import { G, run, post, fx, toast, item, refreshMe, startEdit, settings, serverNow, track, curRoom, isSleeping, setSleep, needsNow } from '../lib/game.svelte';
  import FoodTray from '../components/FoodTray.svelte';
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
  import ShopScene from '../scenes/Shop.svelte';
  import Rooms from '../panels/Rooms.svelte';
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
  import WhatsNew from '../panels/WhatsNew.svelte';
  import { checkWhatsNew } from '../lib/whatsnew';
  import Panen from '../scenes/Panen.svelte';
  import Memori from '../scenes/Memori.svelte';
  import Bakiak from '../games/Bakiak.svelte';
  import Gasing from '../games/Gasing.svelte';
  import Layangan from '../games/Layangan.svelte';
  import Pinang from '../games/Pinang.svelte';
  import DuelLobby from '../scenes/DuelLobby.svelte';
  import Duels from '../panels/Duels.svelte';
  import SaveProgress from '../panels/SaveProgress.svelte';
  import HouseBar from '../components/HouseBar.svelte';
  import CoopPanel from '../components/CoopPanel.svelte';
  import PhotoPreview from '../components/PhotoPreview.svelte';
  import { H } from '../lib/house.svelte';
  import { maybeNudge } from '../lib/account.svelte';
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
  const cdLeft = (k: string) => Math.max(0, Math.ceil(((G.cool[k] ?? 0) - Date.now()) / 1000));
  const fmtCd = (s: number) => (s >= 60 ? Math.ceil(s / 60) + 'm' : s + 'd');
  const sleeping = $derived(G.now > 0 && isSleeping());
  const wakeIn = $derived(sleeping ? Math.max(1, Math.ceil((G.me.pet.sleep.wakeAt - serverNow()) / 60_000)) : 0);

  async function act(k: string) {
    // rawat dengan sentuhan: makan lewat nampan (seret ke mulut), mandi gosok-bilas, tidur matikan lampu
    if (k === 'makan') { sfx.tap(); G.bath = null; G.feeding = !G.feeding; return; }
    if (k === 'mandi') {
      const cd = cdLeft('mandi');
      if (cd > 0) { sfx.error(); toast(`${G.me.pet.name} masih wangi. Mandi lagi ${fmtCd(cd)} lagi.`, 'error'); return; }
      sfx.tap(); G.feeding = false; G.bath = { scrub: 0, tool: 'sabun', rinsing: false };
      return;
    }
    if (k === 'tidur') {
      if (needsNow().energi >= (settings().sleep?.maxEnergiToSleep ?? 95)) { toast(`${G.me.pet.name} belum ngantuk. Main dulu, yuk!`); return; }
      G.feeding = false; G.bath = null;
      await setSleep(true);
      return;
    }
    sfx.tap();
    fx('coins');
    const r: any = await run(() => post('/api/action', { type: k }));
    const cfg = settings().actions?.[k];
    if (r) {
      if (cfg?.cooldownSec) G.cool[k] = Date.now() + cfg.cooldownSec * 1000;
      if (r.result?.coins) { sfx.coin(); toast(`+${r.result.coins} koin dari bermain`, 'good'); }
      if (r.result?.levelUp) { sfx.level(); toast(`Naik ke Lv ${r.result.levelUp}!`, 'good'); }
    }
  }

  async function saveEdit() {
    if (!G.draft) return;
    const room = curRoom();
    const r = await run(() => api.post('/api/room', { roomId: room.id || undefined, layout: G.draft, version: room.version }));
    if (r) { G.edit = false; G.draft = null; G.sel = -1; sfx.pop(); toast('Ruangan disimpan', 'good'); }
  }
  function cancelEdit() { G.edit = false; G.draft = null; G.sel = -1; }
  function storeSel() {
    if (!G.draft || G.sel < 0) return;
    G.draft.splice(G.sel, 1);
    G.sel = -1;
    sfx.tap();
  }

  async function likeHouse() {
    const r: any = await run(() => api.post(`/api/visit/${G.visit.owner.id}/like`));
    if (r) { G.visit.likes = r.likes; sfx.pop(); fx('hearts'); toast(r.already ? 'Kamu sudah menyukai rumah ini minggu ini.' : `Kamu menyukai rumah ${G.visit.owner.display_name}!`, 'good'); }
  }

  async function claimVisit() {
    const r: any = await run(() => api.post(`/api/visit/${G.visit.owner.id}/claim`));
    if (r) { G.visit.claimed = true; sfx.coin(); fx('coins'); toast(`+${r.coins} koin dan +${r.xp} XP`, 'good'); }
  }

  const event = $derived((G.me.events ?? [])[0]);
  const room = $derived(curRoom());
  const visitRooms = $derived<any[]>(G.visit?.rooms ?? []);
  const selItem = $derived(G.edit && G.draft && G.sel >= 0 ? item(G.draft[G.sel]?.i) : null);

  onMount(() => {
    track('session_start', { standalone: matchMedia('(display-mode: standalone)').matches });
    const seen = (() => { try { return JSON.parse(localStorage.getItem('kb-news-seen') ?? '[]'); } catch { return []; } })();
    syncPush();
    checkWhatsNew();
    // dibuka dari notifikasi / tautan (mis. /#garden)
    const initialHash = location.hash;
    if (initialHash.length > 1) { history.replaceState(null, '', location.pathname + location.search); openLink('/' + initialHash); }
    const onSw = (e: MessageEvent) => { if (e.data?.type === 'navigate') openLink(e.data.url); refreshMe().catch(() => {}); };
    navigator.serviceWorker?.addEventListener('message', onSw);
    if (initialHash.length > 1) { /* sudah diarahkan */ }
    else if (!G.me.daily.claimedToday) G.sheet = 'daily';
    else if ((G.me.announcements ?? []).some((a: any) => !seen.includes(a.id))) G.sheet = 'news';
    // tamu yang sudah beberapa hari main: ajak simpan progres (setelah hadiah harian/kabar ditutup)
    if (!initialHash || initialHash.length <= 1) nudgeAfterSheet = true;
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
    // status online untuk teman (di rumah / berkunjung / di kampung)
    const beat = () => { if (document.visibilityState === 'visible') api.post('/api/presence', { where: G.view === 'home' ? 'home' : G.view === 'visit' ? 'visit' : 'map', host: G.view === 'visit' ? G.visit?.owner?.id : undefined }).catch(() => {}); };
    beat();
    const presence = setInterval(beat, 45_000);
    return () => { window.removeEventListener('resize', orient); clearInterval(refresh); clearInterval(presence); navigator.serviceWorker?.removeEventListener('message', onSw); };
  });
  void serverNow;
  let nudgeAfterSheet = false;
  $effect(() => {
    if (G.sheet === null && nudgeAfterSheet) { nudgeAfterSheet = false; setTimeout(() => { if (!G.sheet && G.view === 'home') maybeNudge('open'); }, 700); }
  });
  // naik ke level ajakan simpan progres (mis. Lv 3) saat main sebagai tamu
  let lastLevel = G.me.pet.level;
  $effect(() => {
    const lv = G.me?.pet?.level ?? 1, at = settings().account?.nudgeLevel ?? 3;
    if (lv > lastLevel && lv >= at && lastLevel < at) setTimeout(() => maybeNudge('level'), 1500);
    lastLevel = lv;
  });
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
    {:else if G.view === 'shop'}<ShopScene />
    {:else if G.view === 'bakiak'}<Bakiak />
    {:else if G.view === 'gasing'}<Gasing />
    {:else if G.view === 'layangan'}<Layangan />
    {:else if G.view === 'pinang'}<Pinang />
    {:else if G.view === 'duel' && G.duel}<DuelLobby />
    {/if}
  </div>
  <!-- lampu mati saat pet tidur -->
  <div class="night" class:on={sleeping && G.view === 'home'}></div>

  {#if !G.immersive}<Hud />{/if}

  {#if G.view === 'home' && !G.edit}
    <button class="roompill" onclick={() => { sfx.tap(); G.sheet = 'rooms'; }} aria-label="Ruangan: {room?.name ?? 'Kamar'}. Ketuk untuk pindah ruangan">
      {@html I.home}<b>{room?.name ?? 'Kamar'}</b>{#if (G.me.rooms?.length ?? 1) > 1}<span class="n">{G.me.rooms.length}</span>{/if}<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <Needs />
    {#if event}
      <button class="event" style="--ev:{event.theme?.color ?? '#E0583F'}" onclick={() => (G.sheet = 'event')}>
        {event.name}{#if event.bonus?.coinMultiplier > 1}{' · '}koin ×{event.bonus.coinMultiplier}{/if}
      </button>
    {/if}
    {#if !G.feeding && !G.bath && !sleeping}<QuestChip />{/if}
    {#if sleeping}
      <div class="sleepbar">
        <p><b>{G.me.pet.name} tidur…</b> Energi terisi pelan-pelan, bangun sendiri ±{wakeIn >= 60 ? `${Math.floor(wakeIn / 60)} j ${wakeIn % 60} mnt` : `${wakeIn} mnt`} lagi.</p>
        <button class="btn hot" disabled={G.busy} onclick={() => setSleep(false)}>{@html I.sleep} Nyalakan lampu & bangunkan</button>
      </div>
    {:else if G.bath}
      <div class="bathbar">
        <p>{G.bath.tool === 'sabun' ? `Gosok badan ${G.me.pet.name} dengan sabun sampai berbusa.` : `Sekarang bilas: ketuk ${G.me.pet.name} dengan gayung.`}</p>
        <div class="meter" aria-label="Busa {Math.round(G.bath.scrub * 100)}%"><i style="width:{G.bath.scrub * 100}%"></i></div>
        <div class="row">
          <button class="btn sm" class:on={G.bath.tool === 'sabun'} onclick={() => (G.bath!.tool = 'sabun')}>Sabun</button>
          <button class="btn sm" class:on={G.bath.tool === 'gayung'} disabled={G.bath.scrub < 0.35} onclick={() => (G.bath!.tool = 'gayung')}>Gayung</button>
          <button class="btn sm" onclick={() => (G.bath = null)}>Batal</button>
        </div>
      </div>
    {:else}
      {#if G.feeding}<FoodTray />{/if}
      <div class="acts">
        {#each ACTS as a}
          {@const cd = G.now && cdLeft(a.k)}
          <button class="btn act" class:on={a.k === 'makan' && G.feeding} disabled={G.busy} onclick={() => act(a.k)}>
            {@html a.icon}<span>{a.label}</span>{#if cd > 0 && a.k !== 'makan'}<i class="cd">{fmtCd(cd)}</i>{/if}
          </button>
        {/each}
        <button class="btn act" onclick={startEdit}>{@html I.edit}<span>Atur</span></button>
      </div>
    {/if}
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

  {#if G.view === 'home' && !G.edit && !G.bath && H.members.length > 0}<HouseBar mode="home" />{/if}
  {#if G.view === 'visit' && G.visit}<HouseBar mode="visit" />{/if}
  {#if G.view === 'home' || G.view === 'visit'}<CoopPanel /><PhotoPreview />{/if}

  {#if G.view === 'visit' && G.visit}
    <div class="visit">
      <div class="who"><b>Rumah {G.visit.owner.display_name}</b>{#if G.visit.pet}<span>{G.visit.pet.name} · Lv {G.visit.pet.level}{#if G.visit.guestbook?.[0]}{' · '}terakhir mampir: {G.visit.guestbook[0].name}{/if}</span>{/if}</div>
      {#if visitRooms.length > 1}
        <div class="tabbar" role="tablist" aria-label="Ruangan di rumah teman">
          {#each visitRooms as r, i (r.id)}<button role="tab" aria-selected={G.visitRoom === i} class:on={G.visitRoom === i} onclick={() => { G.visitRoom = i; sfx.tap(); }}>{r.name}</button>{/each}
        </div>
      {/if}
      <div class="row">
        <button class="btn sm {G.visit.claimed ? '' : 'hot'}" disabled={G.visit.claimed || G.busy} onclick={claimVisit}>{G.visit.claimed ? 'Hadiah sudah diambil' : `Ambil +${settings().social?.visitCoins ?? 20} koin`}</button>
        <button class="btn sm" class:on={G.visit.likes?.liked} disabled={G.busy} onclick={likeHouse} aria-label="Suka rumah ini">♥ {G.visit.likes?.liked ? 'Disukai' : 'Suka'}{G.visit.likes?.count ? ` · ${G.visit.likes.count}` : ''}</button>
        <button class="btn sm" onclick={() => { G.sheet = 'gift'; G.sheetArg = { to: G.visit.owner.id, name: G.visit.owner.display_name }; }}>{@html I.gift} Hadiah</button>
        <button class="btn sm" onclick={() => { G.view = 'home'; G.visit = null; }}>Pulang</button>
      </div>
    </div>
  {/if}

  <PushPrompt />
  {#if !G.online}<div class="offline">Kamu sedang offline. Beberapa aksi butuh internet.</div>{/if}

  {#if !G.immersive && !G.edit}<Dock />{/if}

  {#if G.sheet === 'rooms'}<Rooms />
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
  {:else if G.sheet === 'duels'}<Duels />
  {:else if G.sheet === 'save'}<SaveProgress />
  {:else if G.sheet === 'event'}<EventPanel />
  {:else if G.sheet === 'whatsnew'}<WhatsNew />
  {/if}
</div>

<style>
  .game { position: fixed; inset: 0; overflow: hidden; background: linear-gradient(180deg, var(--bg1), var(--bg2)); }
  .game[data-view='map'] { background: #A9D18A; }
  .scene { position: absolute; inset: 0; }
  .night { position: absolute; inset: 0; background: #1B2340; opacity: 0; pointer-events: none; transition: opacity .5s; z-index: 2; }
  .night.on { opacity: .5; }
  .acts { position: absolute; z-index: 6; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-b) + 86px); display: flex; gap: 6px; }
  .act { position: relative; flex-direction: column; gap: 0; width: 62px; min-height: 56px; padding: 4px 2px; font-size: 13px; }
  .act :global(svg) { width: 22px; height: 22px; }
  .roompill { position: absolute; z-index: 6; top: calc(var(--safe-t) + 186px); left: max(10px, var(--safe-l)); display: inline-flex; align-items: center; gap: 5px; max-width: 46vw; background: var(--paper); border: 2.5px solid var(--ink); border-radius: 999px; box-shadow: 0 2px 0 var(--ink); padding: 3px 8px 3px 6px; font-weight: 800; font-size: 14px; cursor: pointer; }
  .roompill b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .roompill :global(svg) { width: 18px; height: 18px; flex: none; }
  .roompill .n { flex: none; min-width: 18px; height: 18px; border-radius: 9px; background: var(--ok); color: #fff; font-size: 11.5px; display: grid; place-items: center; padding: 0 4px; }
  .cd { position: absolute; top: -9px; right: -6px; background: var(--ink); color: var(--paper); font-style: normal; font-size: 11px; border-radius: 8px; padding: 0 5px; }
  .event { position: absolute; z-index: 6; top: calc(var(--safe-t) + 186px); right: max(10px, var(--safe-r)); max-width: calc(52vw - 30px); background: var(--ev); color: #fff; border: 2.5px solid var(--ink); border-radius: 999px; padding: 3px 14px; font-weight: 800; font-size: 13.5px; box-shadow: 0 2px 0 var(--ink); cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sleepbar, .bathbar { position: absolute; z-index: 15; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-b) + 86px); width: min(520px, calc(100vw - 20px)); background: var(--paper); border: 2.5px solid var(--ink); border-radius: 18px; box-shadow: 0 4px 0 var(--ink); padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; animation: pop .2s ease-out; }
  .sleepbar p, .bathbar p { margin: 0; font-weight: 700; font-size: 14.5px; }
  .meter { height: 12px; border: 2px solid var(--ink); border-radius: 8px; background: var(--track); overflow: hidden; }
  .meter i { display: block; height: 100%; background: #9FD3EC; transition: width .15s; }
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
    .event { top: calc(var(--safe-t) + 14px); right: auto; left: 50%; transform: translateX(-50%); max-width: 46vw; }
    .roompill { top: calc(var(--safe-t) + 52px); left: 50%; transform: translateX(-50%); max-width: 30vw; }
    .visit { top: calc(var(--safe-t) + 84px); }
  }
</style>
