<script lang="ts">
  import { onMount } from 'svelte';
  import Sheet from '../components/Sheet.svelte';
  import { petSVG, renderPhoto } from '@kb/shared';
  import PhotoPreview from '../components/PhotoPreview.svelte';
  import { G, item, wearItems, run, toast, fail, track, goTo } from '../lib/game.svelte';
  import { H } from '../lib/house.svelte';
  import { api } from '../lib/api';
  import { I } from '../lib/icons';
  import { sfx } from '../lib/sfx';
  import { maybeNudge } from '../lib/account.svelte';
  import { answerAsk } from '../lib/friends.svelte';

  let friends = $state<any[] | null>(null);
  let gifts = $state<any[]>([]);
  let code = $state('');
  let tab = $state<'list' | 'gifts' | 'top' | 'book' | 'album'>(G.sheetArg?.tab ?? (G.me.giftsUnread > 0 ? 'gifts' : (G.me.guestbookUnread ?? 0) > 0 ? 'book' : 'list'));
  // buku tamu (siapa yang main ke rumahmu) & album foto bareng
  let book = $state<any[] | null>(null);
  let album = $state<{ photos: any[]; featured: string | null } | null>(null);
  let viewing = $state<any>(null);
  async function loadBook() { tab = 'book'; try { book = (await api.get('/api/guestbook')).entries; G.me.guestbookUnread = 0; } catch (e) { fail(e); book = []; } }
  async function loadAlbum() { tab = 'album'; try { album = await api.get('/api/photos'); } catch (e) { fail(e); album = { photos: [], featured: null }; } }
  $effect(() => { if (tab === 'book' && book === null) loadBook(); if (tab === 'album' && album === null) loadAlbum(); });
  const BOOK: Record<string, string> = { sapa: 'menyapa', peluk: 'memeluk', camilan: 'memberi camilan untuk', kejar: 'main kejar-kejaran dengan', duduk: 'duduk santai bareng' };
  const photoSvg = (p: any) => renderPhoto(p.members.filter((m: any) => m.pet).map((m: any) => ({ look: m.pet, wear: wearItems(m.pet.wear), state: m.pet.state })), p.pose, item(p.scene?.wall), item(p.scene?.floor), p.scene?.theme);
  const whereText = (f: any) => (f.where === 'home' ? 'di rumah' : f.where === 'visit' ? (f.at ? `main ke rumah ${f.at}` : 'sedang berkunjung') : f.where === 'alun' ? `di Alun-alun${f.alun > 1 ? ` ${f.alun}` : ''}` : 'di kampung');
  /** susul teman ke alun-alun yang sama (bila masih muat) */
  function joinSquare(f: any) { sfx.tap(); H.want = f.alun || 0; G.sheet = null; goTo('alun'); }
  let top = $state<any>(null);
  async function loadTop() { tab = 'top'; try { top = await api.get('/api/houses/top'); } catch (e) { fail(e); top = { top: [], mine: 0 }; } }
  const myCode = $derived(G.me.user.friend_code);
  const link = $derived(`${location.origin}/?undang=${myCode}`);

  // ajakan berteman dari orang yang ditemui di alun-alun / rumah teman
  let asks = $state<any[]>([]);
  const PLACE: Record<string, string> = { alun: 'alun-alun', visit: 'rumah teman' };
  async function load() {
    try {
      const [f, g, r] = await Promise.all([api.get('/api/friends'), api.get('/api/gifts'), api.get('/api/friends/requests')]);
      friends = f.friends;
      gifts = g.gifts;
      asks = r.incoming ?? [];
      G.me.friendAsks = asks.length;
    } catch (e) { fail(e); friends = friends ?? []; }
  }
  async function answer(a: any, ok: boolean) {
    asks = asks.filter((x) => x.id !== a.id);
    if (await answerAsk(a.id, a.from.id, a.from.name, ok) && ok) load();
  }
  onMount(load);

  async function add(e: Event) {
    e.preventDefault();
    const r: any = await run(() => api.post('/api/friends', { code }));
    if (r) { code = ''; sfx.pop(); toast(`Sekarang berteman dengan ${r.friend.display_name}`, 'good'); G.me.friendsCount++; load(); if (G.me.friendsCount === 1) setTimeout(() => maybeNudge('friend'), 1200); }
  }
  async function visit(f: any) {
    try {
      const v = await api.get(`/api/visit/${f.id}`);
      G.visit = v;
      G.view = 'visit';
      G.sheet = null;
      sfx.tap();
    } catch (e) { fail(e); }
  }
  const inviteText = $derived(`Main BUPI bareng aku! Kode temanku ${myCode}. ${link}`);
  // Di HP pakai menu bagikan bawaan. Link ditaruh di dalam teks (bukan field url terpisah) karena beberapa
  // aplikasi/OS hanya menyalin salah satunya; di desktop langsung salin teks + link lengkap.
  const touch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  let linkEl: HTMLInputElement | undefined = $state();
  async function copy(text: string, msg: string) {
    try { await navigator.clipboard.writeText(text); toast(msg, 'good'); }
    catch { linkEl?.focus(); linkEl?.select(); toast('Salin manual dari kotak link di atas.'); }
  }
  async function share() {
    track('share_invite');
    if (touch && navigator.share) {
      try { await navigator.share({ title: 'BUPI', text: inviteText }); return; }
      catch (e) { if ((e as any)?.name === 'AbortError') return; }
    }
    await copy(inviteText, 'Ajakan + link undangan disalin. Tinggal tempel ke teman.');
  }
  const wa = $derived(`https://wa.me/?text=${encodeURIComponent(inviteText)}`);
  async function open(g: any) {
    const r: any = await run(() => api.post(`/api/gifts/${g.id}/open`));
    if (r) { sfx.level(); toast(`Dapat ${item(r.itemId)?.name ?? 'hadiah'}!`, 'good'); g.opened_at = new Date().toISOString(); G.me.giftsUnread = Math.max(0, G.me.giftsUnread - 1); }
  }
  const ago = (t: string) => { const m = Math.round((Date.now() - new Date(t).getTime()) / 60000); return m < 1 ? 'baru saja' : m < 60 ? `${m} mnt lalu` : m < 1440 ? `${Math.round(m / 60)} jam lalu` : `${Math.round(m / 1440)} hari lalu`; };
</script>

<Sheet title="Teman">
  <div class="mycode">
    <div><span class="lbl">Kode temanmu</span><b>{myCode}</b></div>
    <div class="row">
      <a class="btn sm wa" href={wa} target="_blank" rel="noopener" onclick={() => track('share_invite', { via: 'wa' })}>WhatsApp</a>
      <button class="btn sm" onclick={share}>{@html I.share} Bagikan</button>
    </div>
    <div class="link">
      <input class="input" readonly value={link} bind:this={linkEl} aria-label="Link undangan" onfocus={(e) => (e.target as HTMLInputElement).select()} />
      <button class="btn sm" onclick={() => copy(link, 'Link undangan disalin')}>Salin link</button>
    </div>
  </div>
  <form class="add" onsubmit={add}>
    <input class="input" placeholder="Kode teman, mis. KB-7Q4M2X" bind:value={code} maxlength="12" autocapitalize="characters" aria-label="Kode teman" />
    <button class="btn hot" disabled={G.busy || code.trim().length < 6}>Tambah</button>
  </form>

  {#if asks.length}
    <section class="asks" aria-labelledby="asks-h">
      <h3 id="asks-h">Ajakan berteman <i>{asks.length}</i></h3>
      {#each asks as a (a.id)}
        <div class="friend">
          <span class="ava">{@html petSVG({ color: a.from.pet?.color ?? '#F2EEE3', ear: a.from.pet?.ear ?? 'tunas', pattern: a.from.pet?.pattern, eyes: a.from.pet?.eyes, tail: a.from.pet?.tail })}</span>
          <div class="info">
            <b>{a.from.name}</b>
            <span>{a.from.pet?.name ?? 'Belum punya pet'}</span>
            <em>Ditemui di {PLACE[a.place] ?? 'kampung'} · {ago(a.created_at)}</em>
          </div>
          <div class="btns">
            <button class="btn sm" onclick={() => answer(a, false)}>Tolak</button>
            <button class="btn sm hot" onclick={() => answer(a, true)}>Terima</button>
          </div>
        </div>
      {/each}
    </section>
  {/if}

  <button class="duelbar" onclick={() => { sfx.tap(); G.sheetArg = null; G.sheet = 'duels'; }}>
    <span class="vs">VS</span>
    <span class="t"><b>Duel Teman</b><small>Main bareng atau kirim tantangan mini-game</small></span>
    {#if G.me.duelsPending}<i>{G.me.duelsPending}</i>{/if}
  </button>

  <div class="seg" role="tablist">
    <button role="tab" aria-selected={tab === 'list'} class:on={tab === 'list'} onclick={() => (tab = 'list')}>Teman</button>
    <button role="tab" aria-selected={tab === 'gifts'} class:on={tab === 'gifts'} onclick={() => (tab = 'gifts')}>Hadiah {#if G.me.giftsUnread}<i>{G.me.giftsUnread}</i>{/if}</button>
    <button role="tab" aria-selected={tab === 'book'} class:on={tab === 'book'} onclick={loadBook}>Buku tamu {#if G.me.guestbookUnread}<i>{G.me.guestbookUnread}</i>{/if}</button>
    <button role="tab" aria-selected={tab === 'album'} class:on={tab === 'album'} onclick={loadAlbum}>Album</button>
    <button role="tab" aria-selected={tab === 'top'} class:on={tab === 'top'} onclick={loadTop}>Favorit</button>
  </div>

  {#if tab === 'list'}
    {#if G.me.visitors?.length}
      <p class="visitors">Baru mampir: {G.me.visitors.map((v: any) => v.name).slice(0, 5).join(', ')}</p>
    {/if}
    {#if friends === null}<p class="muted">Memuat…</p>
    {:else if friends.length === 0}<p class="muted">Belum ada teman. Bagikan kode temanmu lewat WhatsApp, masukkan kode teman di atas, atau ajak berteman orang yang kamu temui di Alun-alun.</p>{/if}
    <div class="list">
      {#each friends ?? [] as f (f.id)}
        <div class="friend">
          <span class="ava">{@html petSVG({ color: f.color ?? '#F2EEE3', ear: f.ear ?? 'tunas', pattern: f.pattern, eyes: f.eyes, tail: f.tail }, wearItems(f.wear))}</span>
          <div class="info">
            <b>{#if f.online}<i class="on" aria-label="online"></i>{/if}{f.display_name}</b>
            <span>{f.pet_name ?? 'Belum punya pet'}{f.level ? ` · Lv ${f.level}` : ''}</span>
            {#if f.online}<em class="hot">Online · {whereText(f)}{f.guests ? ` · ramai ${f.guests} tamu` : ''}</em>
            {:else}<em class:hot={!f.visited_today}>{f.visited_today ? 'Sudah dikunjungi hari ini' : 'Hadiah kunjungan tersedia'}</em>{/if}
          </div>
          <div class="btns">
            <button class="btn sm" class:hot={f.online && f.where === 'home'} onclick={() => visit(f)}>{f.online && (f.where === 'home' || f.guests) ? 'Main bareng' : 'Kunjungi'}</button>
            <button class="btn sm" aria-label="Tantang {f.display_name} duel" onclick={() => { sfx.tap(); G.sheetArg = { friendId: f.id }; G.sheet = 'duels'; }}>Duel</button>
            <button class="btn sm" aria-label="Kirim hadiah ke {f.display_name}" onclick={() => { G.sheet = 'gift'; G.sheetArg = { to: f.id, name: f.display_name }; }}>{@html I.gift}</button>
          </div>
          {#if f.online && f.where === 'alun'}<button class="btn sm hot go" onclick={() => joinSquare(f)}>Susul ke Alun-alun{f.alun > 1 ? ` ${f.alun}` : ''}</button>{/if}
        </div>
      {/each}
    </div>
  {:else if tab === 'book'}
    <p class="visitors">Teman yang main ke rumahmu dan apa yang mereka lakukan dengan {G.me.pet.name}.</p>
    {#if book === null}<p class="muted">Memuat…</p>
    {:else if !book.length}<p class="muted">Belum ada tamu. Bagikan kode temanmu supaya teman bisa main ke rumahmu!</p>{/if}
    <div class="list">
      {#each book ?? [] as e, i (i)}
        <div class="friend" class:me={e.unread}>
          <span class="ava">{@html petSVG({ color: e.color ?? '#F2EEE3', ear: e.ear ?? 'tunas', pattern: e.pattern, eyes: e.eyes, tail: e.tail }, wearItems(e.wear))}</span>
          <div class="info">
            <b>{e.name}</b>
            <span>{e.pet_name ?? 'Pet-nya'} {BOOK[e.kind] ?? 'main dengan'} {G.me.pet.name}{e.item_id ? ` (${item(e.item_id)?.name ?? 'camilan'})` : ''}</span>
            <em>{ago(new Date(e.created_at).toISOString())}</em>
          </div>
        </div>
      {/each}
    </div>
  {:else if tab === 'album'}
    <p class="visitors">Foto bareng dari kunjungan. Pilih satu untuk dipajang di lukisan rumahmu.</p>
    {#if album === null}<p class="muted">Memuat…</p>
    {:else if !album.photos.length}<p class="muted">Belum ada foto. Berkunjunglah ke rumah teman lalu ketuk Foto!</p>{/if}
    <div class="album">
      {#each album?.photos ?? [] as p (p.id)}
        <button class="pol" class:feat={album?.featured === p.id} onclick={() => (viewing = p)} aria-label="Foto bareng {p.members.map((m: any) => m.pet?.name).join(', ')}">
          {@html photoSvg(p)}
          {#if album?.featured === p.id}<i>Dipajang</i>{/if}
        </button>
      {/each}
    </div>
    {#if viewing}<PhotoPreview photo={viewing} onclose={() => { viewing = null; loadAlbum(); }} />{/if}
  {:else if tab === 'top'}
    <p class="visitors">Rumah yang paling banyak disukai minggu ini. Sukai rumah teman saat berkunjung (sekali seminggu per teman).{#if top}{' '}Rumahmu: <b>{top.mine}</b> suka.{/if}</p>
    {#if top === null}<p class="muted">Memuat…</p>
    {:else if !top.top.length}<p class="muted">Belum ada rumah yang disukai minggu ini. Jadi yang pertama!</p>{/if}
    <div class="list">
      {#each top?.top ?? [] as h (h.id)}
        <div class="friend" class:me={h.me}>
          <span class="rank" class:gold={h.rank === 1}>{h.rank}</span>
          <span class="ava">{@html petSVG({ color: h.color ?? '#F2EEE3', ear: h.ear ?? 'tunas', pattern: h.pattern, eyes: h.eyes, tail: h.tail }, wearItems(h.wear))}</span>
          <div class="info">
            <b>Rumah {h.display_name}{h.me ? ' (kamu)' : ''}</b>
            <span>{h.pet_name ?? ''}{h.level ? ` · Lv ${h.level}` : ''}</span>
            <em class="hot">♥ {h.likes} suka</em>
          </div>
          {#if h.friend}<button class="btn sm" onclick={() => visit(h)}>Kunjungi</button>{/if}
        </div>
      {/each}
    </div>
  {:else}
    {#if gifts.length === 0}<p class="muted">Belum ada hadiah. Teman bisa mengirimimu barang dari tas mereka.</p>{/if}
    <div class="list">
      {#each gifts as g (g.id)}
        {@const it = item(g.item_id)}
        <div class="friend">
          <span class="ava gift">{@html I.gift}</span>
          <div class="info">
            <b>{g.opened_at ? it?.name ?? 'Hadiah' : 'Hadiah misteri'}</b>
            <span>dari {g.from_name ?? 'seseorang'} · {ago(g.created_at)}</span>
            {#if g.message}<em>“{g.message}”</em>{/if}
          </div>
          <button class="btn sm" class:hot={!g.opened_at} disabled={!!g.opened_at || G.busy} onclick={() => open(g)}>{g.opened_at ? 'Dibuka' : 'Buka'}</button>
        </div>
      {/each}
    </div>
  {/if}
</Sheet>

<style>
  .mycode { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; background: var(--soft); border: 2px solid var(--ink); border-radius: 14px; padding: 10px 12px; }
  .mycode div:first-child { display: flex; flex-direction: column; }
  .lbl { font-size: 13px; font-weight: 700; color: var(--muted); }
  .mycode b { font-size: 22px; letter-spacing: 1px; -webkit-user-select: text; user-select: text; }
  .row { display: flex; gap: 6px; }
  .wa { background: #BFEBCB; text-decoration: none; color: var(--ink); }
  .link { flex: 1 1 100%; display: flex; gap: 6px; }
  .link .input { flex: 1; min-width: 0; font-size: 13.5px; min-height: 36px; padding: 4px 10px; border-width: 2px; background: var(--paper); }
  .add { display: flex; gap: 8px; }
  .add .input { flex: 1; min-width: 0; text-transform: uppercase; }
  .add .input::placeholder { text-transform: none; }
  .asks { display: flex; flex-direction: column; gap: 8px; background: #FFF4D6; border: 2.5px solid var(--ink); border-radius: 16px; padding: 10px; }
  .asks h3 { margin: 0; font-size: 16px; display: flex; align-items: center; gap: 6px; }
  .asks h3 i { font-style: normal; background: var(--low); color: #fff; border-radius: 999px; font-size: 12px; padding: 0 7px; border: 2px solid var(--ink); }
  .duelbar { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; border: 2.5px solid var(--ink); border-radius: 14px; background: #FFE8A3; box-shadow: 0 3px 0 var(--ink); padding: 8px 10px; cursor: pointer; font: inherit; color: var(--ink); }
  .duelbar .vs { flex: none; width: 42px; height: 42px; border-radius: 50%; background: #E0583F; color: #fff; border: 2.5px solid var(--ink); display: grid; place-items: center; font-weight: 800; font-size: 15px; }
  .duelbar .t { display: flex; flex-direction: column; flex: 1; min-width: 0; }
  .duelbar b { font-size: 16px; } .duelbar small { font-size: 13px; font-weight: 600; color: var(--muted); }
  .duelbar i { font-style: normal; background: var(--low); color: #fff; border-radius: 10px; padding: 0 7px; font-weight: 800; font-size: 13px; border: 2px solid var(--ink); }
  .seg { display: flex; border: 2.5px solid var(--ink); border-radius: 12px; overflow-x: auto; scrollbar-width: none; }
  .seg button { flex: 1 1 auto; min-width: max-content; border: 0; background: var(--paper); font-weight: 800; font-size: 13.5px; min-height: 40px; cursor: pointer; padding: 0 9px; white-space: nowrap; }
  .on { display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #3FA06A; margin-right: 6px; vertical-align: 1px; box-shadow: 0 0 0 2px #CDEBD8; }
  .album { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
  .pol { position: relative; border: 0; background: none; padding: 0; cursor: pointer; transform: rotate(-1.5deg); }
  .pol:nth-child(even) { transform: rotate(1.5deg); }
  .pol :global(svg) { width: 100%; height: auto; display: block; filter: drop-shadow(0 3px 0 rgba(43,47,74,.25)); }
  .pol i { position: absolute; top: 6px; right: 6px; font-style: normal; font-size: 11px; font-weight: 800; background: var(--coin); border: 2px solid var(--ink); border-radius: 999px; padding: 0 6px; }
  .pol.feat :global(svg) { filter: drop-shadow(0 0 0 #F2B632) drop-shadow(0 3px 0 rgba(43,47,74,.25)); }
  .seg button.on { background: var(--coin); }
  .seg i { font-style: normal; background: var(--low); color: #fff; border-radius: 9px; padding: 0 6px; font-size: 12px; }
  .list { display: flex; flex-direction: column; gap: 8px; }
  .friend { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; border: 2px solid var(--ink); border-radius: 14px; padding: 8px; background: var(--card); min-width: 0; }
  .ava { width: 54px; height: 54px; flex: none; background: var(--tint); border-radius: 12px; display: grid; place-items: center; overflow: hidden; }
  .ava :global(svg) { width: 100%; height: 100%; }
  .ava.gift :global(svg) { width: 30px; height: 30px; }
  .info { display: flex; flex-direction: column; flex: 1 1 140px; min-width: 0; }
  .info b { font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .info span { font-size: 13px; color: var(--muted); font-weight: 600; }
  .info em { font-style: normal; font-size: 12.5px; font-weight: 700; color: var(--muted); }
  .info em.hot { color: #1E7A4C; }
  /* tombol pindah ke baris bawah bila tidak muat di samping nama (HP) */
  .btns { display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; margin-left: auto; max-width: 100%; }
  .info em { overflow-wrap: anywhere; }
  .go { flex: 1 1 100%; min-height: 40px; }
  .rank { width: 30px; height: 30px; flex: none; border-radius: 50%; border: 2px solid var(--ink); display: grid; place-items: center; font-weight: 800; background: var(--paper); }
  .rank.gold { background: var(--coin); }
  .friend.me { background: #FFF8E2; }
  .visitors { margin: 0; font-size: 14px; font-weight: 600; background: #E6F3EC; border-radius: 10px; padding: 6px 10px; }
  .muted { margin: 0; font-weight: 600; }
</style>
