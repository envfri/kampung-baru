<script lang="ts">
  // Bar kunjungan bareng: main dengan pet teman (saat berkunjung), obrolan, ekspresi, foto bareng, main bareng.
  // Di rumah sendiri bar ini muncul bila ada tamu yang sedang live.
  import { G, item, items, toast } from '../lib/game.svelte';
  import { H, say, emote, coop, takePhoto } from '../lib/house.svelte';
  import { ACT_ICON, EMOTE_ICON, EMOTE_LABEL } from '../lib/houseArt';
  import { itemIcon, PHOTO_POSES } from '@kb/shared';
  import { sfx } from '../lib/sfx';

  let { mode }: { mode: 'visit' | 'home' } = $props();
  let pop = $state<null | 'emote' | 'photo' | 'play' | 'snack'>(null);
  let text = $state('');
  let chatting = $state(false);
  let sending = $state(false);

  const together = $derived(G.visit?.together ?? { on: true, phrases: [], freeChat: true, left: 0, live: true, online: false });
  const phrases = $derived<string[]>((mode === 'visit' ? together.phrases : G.catalog?.settings?.visit?.phrases) ?? []);
  const freeChat = $derived(mode === 'visit' ? together.freeChat : G.catalog?.settings?.visit?.freeChat !== false);
  const here = $derived(H.members);
  const host = $derived(here.find((m) => m.host));
  const liveOn = $derived(H.live && !H.full);
  const foods = $derived(items().filter(([, it]) => it.kind === 'food' && (G.me.inventory?.[it.id] ?? 0) > 0).map(([, it]) => it));
  const hostName = $derived(G.visit?.pet?.name ?? 'pet teman');

  const status = $derived.by(() => {
    if (mode === 'home') return `Tamu di rumahmu: ${[...here, ...H.elsewhere.filter((e) => !e.host)].map((m) => m.name).join(', ')}. Ketuk petnya untuk pilihan.`;
    if (H.full) return 'Rumah sedang ramai (penuh). Kamu tetap bisa main dengan pet teman.';
    if (H.reason === 'host_off') return `${G.visit?.owner?.display_name} sedang tidak menerima tamu live. Kamu tetap bisa main dengan ${hostName}.`;
    const others = here.filter((m) => !m.host).map((m) => m.name);
    if (host) return `${host.name} ada di rumah!${others.length ? ` Juga di sini: ${others.join(', ')}.` : ''}`;
    if (others.length) return `${G.visit?.owner?.display_name} sedang keluar. Juga di sini: ${others.join(', ')}.`;
    return `${G.visit?.owner?.display_name} sedang keluar, tapi ${hostName} senang ditemani!`;
  });

  function act(kind: string, itemId?: string) {
    pop = null;
    sfx.tap();
    H.actReq = { kind, itemId };
  }
  async function send(t?: string) {
    const msg = (t ?? text).trim();
    if (!msg || sending) return;
    sending = true;
    if (await say(msg)) { text = ''; if (!t) chatting = false; }
    sending = false;
  }
  function onKey(e: KeyboardEvent) { if (e.key === 'Enter') { e.preventDefault(); send(); } if (e.key === 'Escape') chatting = false; }
  async function play(game: 'masak' | 'bola') {
    pop = null;
    if (here.length < 1) { toast('Butuh minimal 2 pet di rumah ini. Ajak teman main ke sini!'); return; }
    await coop({ action: 'start', game });
  }
  async function photo(pose: string) { pop = null; await takePhoto(pose); }
  function duel() {
    pop = null;
    const fid = mode === 'visit' ? G.visit?.owner?.id : here[0]?.id;
    G.sheetArg = { friendId: fid }; G.sheet = 'duels';
  }
  const toggle = (p: typeof pop) => { sfx.tap(); pop = pop === p ? null : p; };
</script>

<div class="hbar" class:home={mode === 'home'}>
  <p class="status" class:live={!!host || here.length > 0}>{#if here.length}<i class="dot"></i>{/if}{status}</p>

  {#if mode === 'visit' && together.on}
    <div class="acts" role="group" aria-label="Main dengan {hostName}">
      {#each [['sapa', 'Sapa'], ['peluk', 'Peluk'], ['camilan', 'Camilan'], ['kejar', 'Kejar'], ['duduk', 'Duduk']] as [k, l]}
        <button class="btn act" disabled={G.busy} onclick={() => (k === 'camilan' ? toggle('snack') : act(k))}>{@html ACT_ICON[k]}<span>{l}</span></button>
      {/each}
    </div>
    <p class="left">Main berhadiah tersisa hari ini: <b>{together.left}</b></p>
  {/if}

  {#if chatting}
    <div class="phr" role="group" aria-label="Frasa siap pakai">
      {#each phrases as p}<button class="chip" disabled={sending} onclick={() => send(p)}>{p}</button>{/each}
    </div>
    {#if freeChat}
      <form class="chat" onsubmit={(e) => { e.preventDefault(); send(); }}>
        <input class="input" bind:value={text} maxlength="80" placeholder="Ketik pesan…" aria-label="Pesan" onkeydown={onKey} autocomplete="off" />
        <button class="btn hot sm" disabled={sending || !text.trim()}>Kirim</button>
        <button type="button" class="btn sm" onclick={() => (chatting = false)} aria-label="Tutup obrolan">Tutup</button>
      </form>
    {:else}
      <button class="btn sm" onclick={() => (chatting = false)}>Tutup</button>
    {/if}
  {:else}
    <div class="social">
      <button class="btn sm" disabled={!liveOn && mode === 'visit'} onclick={() => { chatting = true; sfx.tap(); }}>Ngobrol</button>
      <button class="btn sm" disabled={!liveOn && mode === 'visit'} onclick={() => toggle('emote')}>Ekspresi</button>
      <button class="btn sm" onclick={() => toggle('photo')}>Foto</button>
      <button class="btn sm" onclick={() => toggle('play')}>Main bareng</button>
    </div>
  {/if}

  {#if pop === 'emote'}
    <div class="pop" role="menu">
      {#each Object.keys(EMOTE_ICON) as k}<button class="em" role="menuitem" onclick={() => { emote(k); pop = null; }} aria-label={EMOTE_LABEL[k]}>{@html EMOTE_ICON[k]}<span>{EMOTE_LABEL[k]}</span></button>{/each}
    </div>
  {:else if pop === 'photo'}
    <div class="pop col" role="menu">
      <b>Foto bareng: pilih gaya</b>
      {#each Object.entries(PHOTO_POSES) as [k, l]}<button class="btn sm" role="menuitem" onclick={() => photo(k)}>{l}</button>{/each}
      <small>Pet yang sedang satu ruangan denganmu ikut berfoto (juga pet tuan rumah). Fotonya masuk album semua yang ada di foto.</small>
    </div>
  {:else if pop === 'play'}
    <div class="pop col" role="menu">
      <b>Main bareng di rumah</b>
      <button class="btn sm" role="menuitem" disabled={!liveOn || here.length < 1} onclick={() => play('masak')}>Masak bareng</button>
      <button class="btn sm" role="menuitem" disabled={!liveOn || here.length < 1} onclick={() => play('bola')}>Lempar bola</button>
      <button class="btn sm" role="menuitem" onclick={duel}>Tantang duel</button>
      {#if here.length < 1}<small>Masak bareng & Lempar bola butuh minimal 2 pemain yang sedang di rumah ini.</small>{:else}<small>Yang lain mendapat ajakan dan memilih sendiri mau ikut atau tidak.</small>{/if}
    </div>
  {:else if pop === 'snack'}
    <div class="pop" role="menu" aria-label="Pilih camilan">
      {#if !foods.length}<small>Tasmu belum ada makanan. Beli di Pasar Pagi dulu, ya.</small>{/if}
      {#each foods.slice(0, 8) as f (f.id)}
        <button class="em" role="menuitem" onclick={() => act('camilan', f.id)}>{@html itemIcon(f)}<span>{f.name} ×{G.me.inventory[f.id]}</span></button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .hbar { position: absolute; z-index: 14; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-b) + 86px); width: min(560px, calc(100vw - 16px)); background: var(--paper); border: 2.5px solid var(--ink); border-radius: 18px; box-shadow: 0 4px 0 var(--ink); padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; }
  .hbar.home { bottom: calc(var(--safe-b) + 150px); }
  .status { margin: 0; font-size: 13px; font-weight: 700; color: var(--muted); display: flex; align-items: center; gap: 6px; }
  .status.live { color: #1E7A4C; }
  .dot { width: 9px; height: 9px; border-radius: 50%; background: #3FA06A; flex: none; box-shadow: 0 0 0 3px #CDEBD8; }
  .acts { display: flex; gap: 6px; }
  .act { flex: 1; flex-direction: column; gap: 0; min-height: 52px; padding: 4px 2px; font-size: 12.5px; }
  .act :global(svg) { width: 24px; height: 24px; }
  .left { margin: -2px 0 0; font-size: 12px; font-weight: 700; color: var(--muted); text-align: right; }
  .social { display: flex; gap: 6px; flex-wrap: wrap; }
  .social .btn { flex: 1 1 auto; }
  .chat { display: flex; gap: 6px; }
  .chat .input { flex: 1; min-width: 0; min-height: 38px; font-size: 15px; }
  .phr { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: thin; }
  .chip { flex: none; border: 2px solid var(--ink); border-radius: 999px; background: #FFF4D6; font-weight: 800; font-size: 13.5px; padding: 4px 10px; cursor: pointer; }
  .pop { position: absolute; bottom: calc(100% + 8px); left: 0; right: 0; background: var(--paper); border: 2.5px solid var(--ink); border-radius: 16px; box-shadow: 0 4px 0 var(--ink); padding: 8px; display: flex; flex-wrap: wrap; gap: 6px; animation: pop .18s ease-out; }
  .pop.col { flex-direction: column; }
  .pop b { font-size: 14.5px; }
  .pop small { font-size: 12.5px; font-weight: 600; color: var(--muted); }
  .em { flex: 1 1 70px; display: flex; flex-direction: column; align-items: center; gap: 2px; border: 2px solid var(--ink); border-radius: 12px; background: var(--card); padding: 6px 4px; font-weight: 700; font-size: 12px; cursor: pointer; }
  .em :global(svg) { width: 34px; height: 34px; }
  @media (min-width: 900px) and (min-aspect-ratio: 1/1) {
    /* layar lebar: bar di sisi kanan supaya lantai ruangan tidak tertutup */
    .hbar { left: auto; right: max(14px, var(--safe-r)); transform: none; bottom: calc(var(--safe-b) + 96px); width: 300px; }
    .hbar.home { right: max(150px, var(--safe-r)); width: 340px; }
    .acts { flex-wrap: wrap; }
    .act { flex: 1 1 28%; }
  }
</style>
