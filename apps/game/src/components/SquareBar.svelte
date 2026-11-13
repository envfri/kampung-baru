<script lang="ts">
  // Bar alun-alun: siapa saja di sini, acara panggung, kabar acara (arak-arakan, wahana, malam), obrolan & ekspresi, joget saat musik, foto bareng,
  // dan pulang ke peta kampung. Ketuk pet orang lain untuk kartu profilnya (ajak berteman, laporkan, blokir).
  import { G, serverNow, settings } from '../lib/game.svelte';
  import { H, say, emote, takePhoto } from '../lib/house.svelte';
  import { EMOTE_ICON, EMOTE_LABEL } from '../lib/houseArt';
  import { squareShow, PHOTO_POSES, ALUN_LAYOUT, SQUARE_SNACKS, paradeAt, lombaAt, LOMBA_SIAP, fmtGrams } from '@kb/shared';
  import { ALUN, PREVIEW, nightNow } from '../lib/alun.svelte';
  import { BG } from '../lib/bareng.svelte';
  import { barengTiles, playersOf, tileIndex } from '../lib/barengTiles';
  import { sfx } from '../lib/sfx';

  let pop = $state<null | 'emote' | 'photo' | 'play'>(null);
  let text = $state('');
  let chatting = $state(false);
  let sending = $state(false);

  const cfg = $derived(settings().square ?? {});
  const phrases = $derived<string[]>(cfg.phrases ?? []);
  const freeChat = $derived(cfg.freeChat !== false);
  const show = $derived(squareShow(serverNow()));
  const secs = $derived(Math.max(1, Math.ceil((show.until - serverNow()) / 1000)));
  /* kabar acara: wahana pet sendiri, arak-arakan, kembang api, layar tancap (jam setempat), lomba mancing (bila sudah siap) */
  const now = $derived(serverNow());
  const night = $derived.by(() => { void G.now; return nightNow(); });
  const parade = $derived(paradeAt(now));
  const lomba = $derived(lombaAt(now));
  const lombaOn = LOMBA_SIAP || PREVIEW.lomba;
  const mmss = (ms: number) => { const v = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`; };
  const mins = (ms: number) => Math.max(1, Math.ceil(ms / 60_000));
  const RIDE_NAME: Record<string, string> = { bianglala: 'Naik bianglala', kereta: 'Naik kereta', arak: 'Ikut arak-arakan' };
  /** satu kabar paling penting saat ini; join = tombol Ikut, cancel = tombol Batal */
  const ev = $derived.by((): { t: string; hot?: boolean; join?: boolean; cancel?: boolean; fish?: boolean; papan?: boolean } => {
    const LV = ALUN.lomba;
    const r = ALUN.ride;
    if (r) return r.phase === 'tunggu'
      ? { t: r.kind === 'kereta' ? `Kereta datang ${mmss(r.at - now)}` : r.kind === 'bianglala' ? `Gondola datang ${mmss(r.at - now)}` : `Arak-arakan mulai ${mmss(r.at - now)}`, cancel: true }
      : { t: `${RIDE_NAME[r.kind]} · ${mmss(r.until - now)}`, hot: true };
    if (parade.on) return { t: 'Ondel-ondel lewat!', hot: true, join: parade.joinable };
    if (night.kembangApi) return { t: 'Kembang api!', hot: true };
    // Lomba Mancing: papan skor dari server (pemimpin sementara), hitung mundur, hasil
    if (lombaOn && LV?.phase === 'lomba') { const lead = LV.board?.[0]; return { t: `Lomba Mancing ${mmss(LV.end - now)}${lead ? ` · #1 ${lead.name} ${fmtGrams(lead.grams)}` : ''}`, hot: true, fish: true, papan: true }; }
    if (lombaOn && lomba.phase === 'lomba') return { t: `Lomba Mancing ${mmss(lomba.leftMs)}`, hot: true, fish: true, papan: true };
    if (lombaOn && lomba.phase === 'daftar') return { t: `Lomba Mancing ${mmss(lomba.inMs)} lagi`, hot: true, fish: true };
    if (lombaOn && LV?.phase === 'hasil' && LV.results?.length) { const w = LV.results.find((r) => r.rank === 1); return { t: w ? `Juara Lomba Mancing: ${w.name}` : 'Lomba Mancing selesai', papan: true }; }
    if (parade.start - now <= 120_000) return { t: `Arak-arakan ${mmss(parade.start - now)} lagi`, join: parade.joinable };
    if (night.layar) return { t: 'Layar tancap diputar' };
    if (lombaOn && lomba.inMs < parade.start - now) return { t: `Lomba Mancing ${mins(lomba.inMs)} mnt lagi` };
    return { t: `Arak-arakan ${mins(parade.start - now)} mnt lagi` };
  });

  async function send(t?: string) {
    const msg = (t ?? text).trim();
    if (!msg || sending) return;
    sending = true;
    // frasa siap pakai tidak menghapus ketikan yang belum dikirim
    if (await say(msg) && !t) { text = ''; chatting = false; }
    sending = false;
  }
  // daftar main (bisa juga dengan mengetuk bendanya di lapangan): aksi@indeks benda di ALUN_LAYOUT
  const at = (id: string) => ALUN_LAYOUT.findIndex((p) => p.i === id);
  const PLAY = [
    { k: `nonton@${at('alun-panggung')}`, l: 'Nonton pertunjukan', show: true },
    { k: `naik@${at('alun-komidi')}`, l: 'Naik komidi putar' },
    { k: `ayun@${at('alun-ayunan')}`, l: 'Main ayunan' },
    { k: `teduh@${at('alun-beringin')}`, l: 'Berteduh di bawah beringin' },
    { k: `duduk@${at('alun-bangku')}`, l: 'Duduk santai di bangku' },
    ...['alun-dawet', 'alun-bakso', 'alun-arummanis'].map((id) => ({ k: `jajan@${at(id)}`, l: `Jajan ${SQUARE_SNACKS[id].name} (${SQUARE_SNACKS[id].coins} koin)` })),
    // Pojok Wahana
    { k: `bianglala@${at('alun-bianglala')}`, l: 'Naik bianglala' },
    { k: `kereta@${at('alun-halte')}`, l: 'Naik Kereta Kelinci' },
    { k: `gelang@${at('alun-gelang')}`, l: 'Lempar gelang' },
    { k: `arak@${at('alun-ondel')}`, l: 'Ikut arak-arakan', arak: true },
    { k: `mancing@${at('alun-kolam')}`, l: 'Mancing bareng di kolam' },
    { k: `layar@${at('alun-layar')}`, l: 'Nonton layar tancap', night: true },
  ] as { k: string; l: string; show?: boolean; arak?: boolean; night?: boolean }[];
  function play(k: string) { pop = null; sfx.tap(); H.actReq = { kind: k }; }
  /* main bareng: ubin dari BARENG_GAMES (benda tempat mainnya harus ada di alun-alun) */
  const tiles = $derived(barengTiles('alun', settings().features));
  /** permainan yang sedang berjalan di benda itu (bisa ditonton) */
  const runningOf = (key: string) => (key === 'karung' ? null : H.games.find((g: any) => g.game === key && g.phase === 'main') ?? null);
  const vsText = (g: any) => (g.players.length === 2 ? `${g.players[0].name} vs ${g.players[1].name} · Tonton` : 'Sedang main · Tonton');
  function tile(t: (typeof tiles)[number]) {
    const g = runningOf(t.key);
    if (g) { pop = null; sfx.tap(); BG.watching = g.id; return; }
    play(`${t.key}@${tileIndex(t)}`);
  }
  /** tinggi maksimal menu: ruang antara HUD dan bar ini */
  let barEl = $state<HTMLElement | null>(null);
  let popMax = $state(0);
  $effect(() => {
    if (pop !== 'play' || !barEl) return;
    const fit = () => { const hud = document.querySelector('.hud')?.getBoundingClientRect().bottom ?? 88; popMax = Math.max(160, barEl!.getBoundingClientRect().top - hud - 16); };
    fit();
    addEventListener('resize', fit);
    return () => removeEventListener('resize', fit);
  });
  function onWinKey(e: KeyboardEvent) { if (e.key === 'Escape' && pop) pop = null; }
  function onKey(e: KeyboardEvent) { if (e.key === 'Enter') { e.preventDefault(); send(); } if (e.key === 'Escape') chatting = false; }
  const toggle = (p: typeof pop) => { sfx.tap(); pop = pop === p ? null : p; };
  function joget() { pop = null; sfx.tap(); H.actReq = { kind: 'joget' }; }
  async function photo(pose: string) { pop = null; await takePhoto(pose); }
  function home() { sfx.tap(); G.mapAt = 'alun'; G.view = 'map'; }
</script>

<svelte:window onkeydown={onWinKey} />
<div class="sbar" bind:this={barEl}>
  <p class="status">
    <b>Alun-alun {H.inst || ''}</b><span>{H.live ? `${H.count}/${H.max} orang` : 'Menyambung…'}</span>
    <span class="show" class:on={show.playing}>{show.playing ? `Panggung: ${show.name}` : `${show.next.name} mulai ${secs} dtk lagi`}</span>
  </p>
  <p class="ev" class:on={ev.hot} role="status">
    <span>{ev.t}</span>
    {#if ev.join && !ALUN.ride}<button class="mini" disabled={!H.live} onclick={() => play(`arak@${at('alun-ondel')}`)}>Ikut</button>{/if}
    {#if ev.cancel}<button class="mini" onclick={() => { sfx.tap(); ALUN.cancel++; }}>Batal</button>{/if}
    {#if ev.fish && !ALUN.ride}<button class="mini" disabled={!H.live} onclick={() => play(`mancing@${at('alun-kolam')}`)}>Ikut</button>{/if}
    {#if ev.papan}<button class="mini" onclick={() => { sfx.tap(); ALUN.board = true; }}>Papan</button>{/if}
  </p>

  {#if chatting}
    <p class="tip">Jangan bagikan kode akun, kode pindah perangkat, nomor, atau alamat. Tim BUPI tidak pernah memintanya.</p>
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
      <button class="btn sm" disabled={!H.live} onclick={() => toggle('play')} aria-haspopup="dialog">Main</button>
      <button class="btn sm" class:hot={show.music} disabled={!show.music || !H.live} onclick={joget} title={show.music ? 'Joget bareng di depan panggung' : 'Joget saat ada musik'}>Joget</button>
      <button class="btn sm" disabled={!H.live} onclick={() => toggle('photo')}>Foto</button>
      <button class="btn sm" onclick={home}>Pulang</button>
    </div>
  {/if}

  {#if pop === 'play'}
    <div class="pop col" role="dialog" aria-label="Main di alun-alun" style={popMax ? `max-height:${popMax}px` : ''}>
      <b>Main di alun-alun</b>
      <span class="sec">MAIN BARENG · GANTIAN JALAN</span>
      <div class="games">
        {#each tiles as t (t.key)}
          {@const run = runningOf(t.key)}
          <button class="btn g" class:busy={!!run} disabled={!H.live || (!run && !!ALUN.ride)} onclick={() => tile(t)}>{@html t.icon}<span><b>{t.label}</b><small>{run ? vsText(run) : `${playersOf(t.key)} · ${t.where}`}</small></span>{#if t.isNew}<em>BARU</em>{/if}</button>
        {/each}
      </div>
      <span class="sec">JALAN-JALAN & JAJAN</span>
      {#each PLAY.filter((a) => !a.night || night.layar) as a (a.k)}
        {@const off = (a.show && !show.playing) || (a.arak && !parade.joinable) || !!ALUN.ride}
        <button class="btn sm" disabled={off} onclick={() => play(a.k)}>{a.l}{a.show && !show.playing ? ` · mulai ${secs} dtk lagi` : a.arak && !parade.joinable ? ` · mulai ${mins(parade.start - now)} mnt lagi` : ''}</button>
      {/each}
      <small>Bisa juga mengetuk bendanya langsung di lapangan.</small>
    </div>
  {:else if pop === 'emote'}
    <div class="pop" role="menu">
      {#each Object.keys(EMOTE_ICON) as k}<button class="em" role="menuitem" onclick={() => { emote(k); pop = null; }} aria-label={EMOTE_LABEL[k]}>{@html EMOTE_ICON[k]}<span>{EMOTE_LABEL[k]}</span></button>{/each}
    </div>
  {:else if pop === 'photo'}
    <div class="pop col" role="dialog" aria-label="Foto bareng">
      <b>Foto bareng: pilih gaya</b>
      {#each Object.entries(PHOTO_POSES) as [k, l]}<button class="btn sm" role="menuitem" onclick={() => photo(k)}>{l}</button>{/each}
      <small>Pet yang ada di dekatmu ikut berfoto. Foto masuk albummu dan album temanmu yang ikut difoto.</small>
    </div>
  {/if}
</div>

<style>
  .sbar { position: absolute; z-index: 14; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-b) + 86px); width: min(560px, calc(100vw - 16px)); background: var(--paper); border: 2.5px solid var(--ink); border-radius: 18px; box-shadow: 0 4px 0 var(--ink); padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; }
  .tip { margin: 0; font-size: 12px; font-weight: 700; color: #8A5A00; background: #FFF4D6; border-radius: 8px; padding: 2px 8px; }
  .status { margin: 0; font-size: 13px; font-weight: 700; color: var(--muted); display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; }
  .status b { color: var(--ink); font-size: 15px; }
  .show { margin-left: auto; background: #FFF4D6; border: 2px solid var(--ink); border-radius: 999px; padding: 0 8px; color: var(--ink); }
  .show.on { background: #FFE0D6; }
  .ev { margin: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; font-size: 13px; font-weight: 800; color: var(--ink); background: #E7F4EC; border: 2px solid var(--ink); border-radius: 12px; padding: 2px 4px 2px 10px; min-height: 30px; }
  .ev.on { background: #FFE8A3; }
  .ev span { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
  .ev .mini { flex: none; border: 2px solid var(--ink); border-radius: 9px; background: var(--paper); font: inherit; font-size: 13px; font-weight: 800; color: var(--ink); padding: 1px 10px; min-height: 26px; cursor: pointer; box-shadow: 0 2px 0 var(--ink); }
  .ev .mini:disabled { opacity: .5; cursor: not-allowed; }
  .social { display: flex; gap: 6px; flex-wrap: wrap; }
  .social .btn { flex: 1 1 auto; }
  .chat { display: flex; gap: 6px; }
  .chat .input { flex: 1; min-width: 0; min-height: 38px; font-size: 15px; }
  .phr { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: thin; }
  .chip { flex: none; border: 2px solid var(--ink); border-radius: 999px; background: #FFF4D6; font-weight: 800; font-size: 13.5px; padding: 4px 10px; cursor: pointer; }
  .pop { position: absolute; bottom: calc(100% + 8px); left: 0; right: 0; max-height: 50vh; overflow-y: auto; background: var(--paper); border: 2.5px solid var(--ink); border-radius: 16px; box-shadow: 0 4px 0 var(--ink); padding: 8px; display: flex; flex-wrap: wrap; gap: 6px; animation: pop .18s ease-out; }
  .pop.col { flex-direction: column; flex-wrap: nowrap; }
  .sec { font-size: 11.5px; font-weight: 800; color: var(--muted); letter-spacing: .02em; margin-top: 2px; }
  .games { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding-top: 6px; flex: none; }
  .g { position: relative; justify-content: flex-start; text-align: left; gap: 7px; padding: 5px 8px 5px 6px; min-height: 52px; border-radius: 12px; font-size: 14px; }
  .g :global(svg) { width: 30px; height: 30px; flex: none; }
  .g span { display: flex; flex-direction: column; min-width: 0; line-height: 1.15; }
  .g b { font-size: 14.5px; font-weight: 800; }
  .g small { font-size: 11.5px; font-weight: 700; color: var(--muted); }
  .g.busy small { color: #1E7A4C; }
  .g em { position: absolute; top: -8px; right: 6px; font-style: normal; background: #E0583F; color: #FFFDF7; font-size: 10.5px; font-weight: 800; border: 2px solid var(--ink); border-radius: 999px; padding: 0 6px; line-height: 1.35; }
  @media (max-width: 359px) { .g { min-height: 46px; } }
  .pop b { font-size: 14.5px; }
  .pop small { font-size: 12.5px; font-weight: 600; color: var(--muted); }
  .em { flex: 1 1 70px; display: flex; flex-direction: column; align-items: center; gap: 2px; border: 2px solid var(--ink); border-radius: 12px; background: var(--card); padding: 6px 4px; font-weight: 700; font-size: 12px; cursor: pointer; }
  .em :global(svg) { width: 34px; height: 34px; }
  .gb { display: flex; gap: 4px; justify-content: flex-end; }
  @media (min-width: 900px) and (min-aspect-ratio: 1/1) {
    .sbar { left: auto; right: max(14px, var(--safe-r)); transform: none; bottom: calc(var(--safe-b) + 96px); width: 320px; }
  }
</style>
