<script lang="ts">
  // Bar alun-alun: siapa saja di sini, acara panggung, obrolan & ekspresi, joget saat musik, foto bareng,
  // daftar orang (blokir / laporkan), dan pulang ke peta kampung.
  import { G, serverNow, settings } from '../lib/game.svelte';
  import { H, say, emote, block, report, takePhoto } from '../lib/house.svelte';
  import { ask } from '../lib/account.svelte';
  import { EMOTE_ICON, EMOTE_LABEL } from '../lib/houseArt';
  import { squareShow, PHOTO_POSES } from '@kb/shared';
  import { sfx } from '../lib/sfx';

  let pop = $state<null | 'emote' | 'photo' | 'people'>(null);
  let text = $state('');
  let chatting = $state(false);
  let sending = $state(false);
  let reporting = $state<null | { id: string; name: string }>(null);
  let reason = $state('');

  const cfg = $derived(settings().square ?? {});
  const phrases = $derived<string[]>(cfg.phrases ?? []);
  const freeChat = $derived(cfg.freeChat !== false);
  const show = $derived(squareShow(serverNow()));
  const secs = $derived(Math.max(1, Math.ceil((show.until - serverNow()) / 1000)));
  const people = $derived(H.members);

  async function send(t?: string) {
    const msg = (t ?? text).trim();
    if (!msg || sending) return;
    sending = true;
    if (await say(msg)) { text = ''; if (!t) chatting = false; }
    sending = false;
  }
  function onKey(e: KeyboardEvent) { if (e.key === 'Enter') { e.preventDefault(); send(); } if (e.key === 'Escape') chatting = false; }
  const toggle = (p: typeof pop) => { sfx.tap(); pop = pop === p ? null : p; };
  function joget() { pop = null; sfx.tap(); H.actReq = { kind: 'joget' }; }
  async function photo(pose: string) { pop = null; await takePhoto(pose); }
  function home() { sfx.tap(); G.mapAt = 'alun'; G.view = 'map'; }
  async function sendReport() {
    const r = reporting;
    if (!r) return;
    if (await report(r.id, r.name, reason)) { reporting = null; reason = ''; pop = null; }
  }
</script>

<div class="sbar">
  <p class="status">
    <b>Alun-alun {H.inst || ''}</b><span>{H.live ? `${H.count}/${H.max} orang` : 'Menyambung…'}</span>
    <span class="show" class:on={show.playing}>{show.playing ? `Panggung: ${show.name}` : `${show.next.name} mulai ${secs} dtk lagi`}</span>
  </p>

  {#if chatting}
    <div class="phr" role="group" aria-label="Frasa siap pakai">
      {#each phrases as p}<button class="chip" disabled={sending} onclick={() => send(p)}>{p}</button>{/each}
    </div>
    {#if freeChat}
      <form class="chat" onsubmit={(e) => { e.preventDefault(); send(); }}>
        <input class="input" bind:value={text} maxlength={cfg.chatMax ?? 80} placeholder="Ketik pesan… (jaga sopan santun, ya)" aria-label="Pesan" onkeydown={onKey} autocomplete="off" />
        <button class="btn hot sm" disabled={sending || !text.trim()}>Kirim</button>
        <button type="button" class="btn sm" onclick={() => (chatting = false)} aria-label="Tutup obrolan">Tutup</button>
      </form>
    {:else}
      <button class="btn sm" onclick={() => (chatting = false)}>Tutup</button>
    {/if}
  {:else}
    <div class="social">
      <button class="btn sm" disabled={!H.live} onclick={() => { chatting = true; sfx.tap(); }}>Ngobrol</button>
      <button class="btn sm" disabled={!H.live} onclick={() => toggle('emote')}>Ekspresi</button>
      <button class="btn sm" class:hot={show.music} disabled={!show.music || !H.live} onclick={joget} title={show.music ? 'Joget bareng di depan panggung' : 'Joget saat ada musik'}>Joget</button>
      <button class="btn sm" disabled={!H.live} onclick={() => toggle('photo')}>Foto</button>
      <button class="btn sm" onclick={() => toggle('people')}>Orang ({people.length})</button>
      <button class="btn sm" onclick={home}>Pulang</button>
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
      <small>Pet yang ada di dekatmu ikut berfoto. Fotonya masuk album semua yang ada di foto.</small>
    </div>
  {:else if pop === 'people'}
    <div class="pop col" role="menu">
      <b>Di alun-alun ini</b>
      {#if reporting}
        <p class="rep">Laporkan <b>{reporting.name}</b>? Admin akan memeriksa obrolannya.</p>
        <input class="input" bind:value={reason} maxlength="200" placeholder="Alasan (opsional): kata kasar, mengganggu, …" aria-label="Alasan laporan" />
        <div class="gb"><button class="btn sm" onclick={() => (reporting = null)}>Batal</button><button class="btn sm hot" onclick={sendReport}>Kirim laporan</button></div>
      {:else}
        {#each people as m (m.id)}
          <div class="guest"><span>{m.name}{m.pet ? ` · ${m.pet.name}` : ''}</span>
            <span class="gb">
              <button class="btn sm" onclick={() => { reporting = { id: m.id, name: m.name }; reason = ''; }}>Laporkan</button>
              <button class="btn sm" onclick={async () => { pop = null; if (await ask({ title: `Blokir ${m.name}?`, text: `Kalian tidak akan saling melihat atau mendengar di alun-alun, dan tidak bisa berteman atau berkunjung. Bisa dibuka lagi di Pengaturan.`, yes: 'Blokir', danger: true })) block(m.id, m.name); }}>Blokir</button>
            </span>
          </div>
        {:else}<small>Belum ada orang lain. Ajak teman ke alun-alun, yuk!</small>{/each}
        {#if H.others.length}<small>Alun-alun lain yang ramai: {H.others.map((o) => `Alun-alun ${o.id} (${o.count})`).join(', ')}</small>{/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .sbar { position: absolute; z-index: 14; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-b) + 86px); width: min(560px, calc(100vw - 16px)); background: var(--paper); border: 2.5px solid var(--ink); border-radius: 18px; box-shadow: 0 4px 0 var(--ink); padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; }
  .status { margin: 0; font-size: 13px; font-weight: 700; color: var(--muted); display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; }
  .status b { color: var(--ink); font-size: 15px; }
  .show { margin-left: auto; background: #FFF4D6; border: 2px solid var(--ink); border-radius: 999px; padding: 0 8px; color: var(--ink); }
  .show.on { background: #FFE0D6; }
  .social { display: flex; gap: 6px; flex-wrap: wrap; }
  .social .btn { flex: 1 1 auto; }
  .chat { display: flex; gap: 6px; }
  .chat .input { flex: 1; min-width: 0; min-height: 38px; font-size: 15px; }
  .phr { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: thin; }
  .chip { flex: none; border: 2px solid var(--ink); border-radius: 999px; background: #FFF4D6; font-weight: 800; font-size: 13.5px; padding: 4px 10px; cursor: pointer; }
  .pop { position: absolute; bottom: calc(100% + 8px); left: 0; right: 0; max-height: 50vh; overflow-y: auto; background: var(--paper); border: 2.5px solid var(--ink); border-radius: 16px; box-shadow: 0 4px 0 var(--ink); padding: 8px; display: flex; flex-wrap: wrap; gap: 6px; animation: pop .18s ease-out; }
  .pop.col { flex-direction: column; flex-wrap: nowrap; }
  .pop b { font-size: 14.5px; }
  .pop small { font-size: 12.5px; font-weight: 600; color: var(--muted); }
  .em { flex: 1 1 70px; display: flex; flex-direction: column; align-items: center; gap: 2px; border: 2px solid var(--ink); border-radius: 12px; background: var(--card); padding: 6px 4px; font-weight: 700; font-size: 12px; cursor: pointer; }
  .em :global(svg) { width: 34px; height: 34px; }
  .gb { display: flex; gap: 4px; justify-content: flex-end; }
  .guest { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; }
  .rep { margin: 0; font-size: 14px; font-weight: 600; }
  @media (min-width: 900px) and (min-aspect-ratio: 1/1) {
    .sbar { left: auto; right: max(14px, var(--safe-r)); transform: none; bottom: calc(var(--safe-b) + 96px); width: 320px; }
  }
</style>
