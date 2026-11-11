<script lang="ts">
  // Duel dengan teman: buat tantangan, lihat yang perlu dimainkan, dan hasil duel.
  import { onMount } from 'svelte';
  import Sheet from '../components/Sheet.svelte';
  import { petSVG, GAMES } from '@kb/shared';
  import { G, wearItems, run, settings, toast, fail } from '../lib/game.svelte';
  import { api } from '../lib/api';
  import { GAME_ART } from '../lib/gameArt';
  import { COIN } from '../lib/icons';
  import { sfx } from '../lib/sfx';

  let data = $state<any>(null);
  let friends = $state<any[] | null>(null);
  let pick = $state<string | null>(G.sheetArg?.friendId ?? null);
  let game = $state<string>('bakiak');
  let formOpen = $state(!!G.sheetArg?.friendId);
  const cfg = $derived(settings().duel ?? {});

  async function load() {
    try {
      const [d, f] = await Promise.all([api.get('/api/duels'), api.get('/api/friends')]);
      data = d; friends = f.friends;
      G.me.duelsPending = d.duels.filter((x: any) => (x.status === 'open' || x.status === 'live') && !x.me.played).length;
    } catch (e) { fail(e); data = { duels: [], games: [], leftToday: 0 }; friends = []; }
  }
  onMount(load);

  const todo = $derived((data?.duels ?? []).filter((d: any) => (d.status === 'open' || d.status === 'live') && !d.me.played));
  const waiting = $derived((data?.duels ?? []).filter((d: any) => (d.status === 'open' || d.status === 'live') && d.me.played));
  const past = $derived((data?.duels ?? []).filter((d: any) => !['open', 'live'].includes(d.status)).slice(0, 12));

  function open(d: any) {
    sfx.tap();
    G.duel = { id: d.id, game: d.game, them: d.them };
    G.sheet = null; G.sheetArg = null;
    G.view = 'duel';
  }
  async function create() {
    if (!pick) return;
    try {
      const r = await api.post('/api/duels', { friendId: pick, game });
      sfx.level();
      toast(`Tantangan ${r.duel.gameName} dikirim ke ${r.duel.them.name}!`, 'good');
      open(r.duel);
    } catch (e: any) {
      // sudah ada duel dengan teman ini: langsung buka duel itu
      if (e?.code === 'duel_exists' && e?.data?.duelId) { const r = await api.get(`/api/duels/${e.data.duelId}`).catch(() => null); if (r) { toast(e.message); return open(r.duel); } }
      fail(e);
    }
  }
  async function decline(d: any) {
    const r = await run(() => api.post(`/api/duels/${d.id}/decline`));
    if (r) { toast('Tantangan ditolak.'); load(); }
  }
  async function forfeit(d: any) {
    const r: any = await run(() => api.post(`/api/duels/${d.id}/finish`, { forfeit: true }));
    if (r) { toast(r.duel.result ? `Duel selesai: ${r.duel.result}` : 'Skor 0 tercatat.'); load(); }
  }
  const ago = (t: number) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'baru saja' : m < 60 ? `${m} mnt lalu` : m < 1440 ? `${Math.round(m / 60)} jam lalu` : `${Math.round(m / 1440)} hari lalu`; };
  const until = (t: number) => { const h = Math.max(0, Math.round((t - Date.now()) / 3600000)); return h >= 1 ? `${h} jam lagi` : 'segera berakhir'; };
  const ava = (p: any) => (p ? petSVG(p, wearItems(p.wear)) : '');
</script>

<Sheet title="Duel Teman">
  <p class="lead">Adu skor mini-game dengan soal yang sama persis. <b>Main bareng</b> kalau sama-sama online, atau kirim <b>tantangan</b>: temanmu nanti melawan bayangan permainanmu.</p>
  <p class="prize">{@html COIN} Menang {cfg.winCoins ?? 30} · seri {cfg.drawCoins ?? 20} · kalah {cfg.loseCoins ?? 10} koin{#if data}{' · '}sisa duel hari ini <b>{data.leftToday}</b>{/if}</p>

  {#if !formOpen}
    <button class="btn hot block" onclick={() => (formOpen = true)}>Tantang teman</button>
  {:else}
    <div class="new">
      <b class="h">1. Pilih teman</b>
      {#if friends === null}<p class="muted">Memuat…</p>
      {:else if !friends.length}<p class="muted">Belum ada teman. Tambah teman dulu lewat menu Teman.</p>
      {:else}
        <div class="friends" role="radiogroup" aria-label="Teman">
          {#each friends as f (f.id)}
            <button role="radio" aria-checked={pick === f.id} class:on={pick === f.id} onclick={() => (pick = f.id)}>
              <span class="ava">{@html petSVG({ color: f.color ?? '#F2EEE3', ear: f.ear ?? 'tunas', pattern: f.pattern, eyes: f.eyes, tail: f.tail }, wearItems(f.wear))}</span>
              <span class="nm">{f.display_name}</span>
            </button>
          {/each}
        </div>
      {/if}
      <b class="h">2. Pilih permainan</b>
      <div class="games" role="radiogroup" aria-label="Permainan">
        {#each data?.games ?? ['bakiak', 'gasing', 'layangan'] as g}
          <button role="radio" aria-checked={game === g} class:on={game === g} onclick={() => (game = g)}>
            <span class="art">{@html GAME_ART[g]}</span><span class="nm">{(GAMES as any)[g]?.name}</span>
          </button>
        {/each}
      </div>
      <div class="row">
        <button class="btn" onclick={() => (formOpen = false)}>Batal</button>
        <button class="btn hot" disabled={!pick || G.busy} onclick={create}>Tantang!</button>
      </div>
    </div>
  {/if}

  {#if data === null}<p class="muted">Memuat duel…</p>{/if}

  {#if todo.length}
    <h3>Giliranmu</h3>
    {#each todo as d (d.id)}
      <div class="duel hot">
        <span class="ava">{@html ava(d.them.pet)}</span>
        <div class="info">
          <b>{d.gameName} vs {d.them.name}</b>
          {#if d.me.started}<span>Kamu sudah mulai tapi belum selesai.</span>
          {:else if d.them.played}<span>{d.them.name} sudah main: <b>{d.them.label}</b>. Kalahkan!</span>
          {:else if d.them.ready}<span class="live">{d.them.name} menunggu di ruang duel!</span>
          {:else}<span>{d.role === 'opponent' ? `${d.them.name} menantangmu` : 'Tantanganmu'} · {ago(d.createdAt)}</span>{/if}
          <em>Berakhir {until(d.expiresAt)}</em>
        </div>
        <div class="btns">
          {#if d.me.started}
            <button class="btn sm" disabled={G.busy} onclick={() => forfeit(d)}>Akhiri</button>
          {:else}
            <button class="btn sm hot" onclick={() => open(d)}>{d.them.played ? 'Main' : 'Buka'}</button>
            {#if d.role === 'opponent' && d.status === 'open'}<button class="btn sm" disabled={G.busy} onclick={() => decline(d)}>Tolak</button>{/if}
          {/if}
        </div>
      </div>
    {/each}
  {/if}

  {#if waiting.length}
    <h3>Menunggu teman</h3>
    {#each waiting as d (d.id)}
      <div class="duel">
        <span class="ava">{@html ava(d.them.pet)}</span>
        <div class="info">
          <b>{d.gameName} vs {d.them.name}</b>
          <span>Skormu <b>{d.me.label}</b> · {d.them.started ? `${d.them.name} sedang main…` : `menunggu ${d.them.name} main`}</span>
          <em>Berakhir {until(d.expiresAt)}</em>
        </div>
      </div>
    {/each}
  {/if}

  {#if past.length}
    <h3>Riwayat</h3>
    {#each past as d (d.id)}
      <div class="duel past">
        <span class="ava">{@html ava(d.them.pet)}</span>
        <div class="info">
          <b>{d.gameName} vs {d.them.name}</b>
          {#if d.status === 'done'}<span>{d.me.label} vs {d.them.label}{#if d.me.reward}{' · '}+{d.me.reward} koin{/if}</span>
          {:else}<span>{d.status === 'declined' ? 'Ditolak' : 'Kedaluwarsa'}</span>{/if}
        </div>
        {#if d.result}<i class="res {d.result}">{d.result === 'menang' ? 'Menang' : d.result === 'kalah' ? 'Kalah' : 'Seri'}</i>{/if}
      </div>
    {/each}
  {/if}

  {#if data && !data.duels.length && !formOpen}<p class="muted">Belum ada duel. Tantang temanmu dan lihat siapa jagoan kampung!</p>{/if}
</Sheet>

<style>
  .lead, .prize { margin: 0; font-weight: 600; font-size: 14.5px; }
  .prize { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; font-size: 13.5px; background: #FFF4D6; border-radius: 10px; padding: 5px 10px; }
  .prize :global(svg) { width: 17px; height: 17px; }
  .new { display: flex; flex-direction: column; gap: 8px; border: 2.5px solid var(--ink); border-radius: 16px; background: var(--soft); padding: 10px; }
  .h { font-size: 14.5px; }
  .friends, .games { display: flex; gap: 8px; overflow-x: auto; padding: 2px 2px 6px; scrollbar-width: thin; }
  .friends button, .games button { flex: none; display: flex; flex-direction: column; align-items: center; gap: 2px; width: 84px; border: 2px solid var(--ink); border-radius: 14px; background: var(--paper); padding: 6px 4px; cursor: pointer; font-weight: 700; }
  .games button { width: 104px; }
  .friends button.on, .games button.on { background: var(--coin); box-shadow: 0 3px 0 var(--ink); }
  .friends .ava { width: 48px; height: 48px; }
  .nm { font-size: 12.5px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .art { width: 58px; height: 46px; display: grid; place-items: center; }
  .art :global(svg) { width: 56px; height: 44px; }
  .row { display: flex; gap: 8px; } .row .btn { flex: 1; }
  h3 { margin: 6px 0 0; font-size: 16px; }
  .duel { display: flex; align-items: center; gap: 10px; border: 2px solid var(--ink); border-radius: 14px; padding: 8px; background: var(--card); }
  .duel.hot { background: #FFF8E2; }
  .duel.past { opacity: .92; }
  .ava { width: 52px; height: 52px; flex: none; background: var(--tint); border-radius: 12px; display: grid; place-items: center; overflow: hidden; }
  .ava :global(svg) { width: 100%; height: 100%; }
  .info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
  .info > b { font-size: 15.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .info span { font-size: 13px; color: var(--muted); font-weight: 600; }
  .info span b { color: var(--ink); }
  .info .live { color: #1E7A4C; font-weight: 800; }
  .info em { font-style: normal; font-size: 12px; font-weight: 700; color: var(--muted); }
  .btns { display: flex; flex-direction: column; gap: 4px; }
  .res { font-style: normal; font-weight: 800; font-size: 13px; border: 2px solid var(--ink); border-radius: 999px; padding: 1px 10px; background: var(--paper); }
  .res.menang { background: #BFEBCB; }
  .res.kalah { background: #F8C9BE; }
  .res.seri { background: #FFE8A3; }
  .muted { margin: 0; font-weight: 600; color: var(--muted); }
</style>
