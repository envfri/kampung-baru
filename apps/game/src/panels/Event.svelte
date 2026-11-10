<script lang="ts">
  import { onMount } from 'svelte';
  import Sheet from '../components/Sheet.svelte';
  import { EVENT_POINT_SOURCES, eventDropSVG, itemIcon } from '@kb/shared';
  import { G, item, run, fx, toast, fail, fmt } from '../lib/game.svelte';
  import { api } from '../lib/api';
  import { openLink } from '../lib/links';
  import { sfx } from '../lib/sfx';
  import { COIN, PEARL } from '../lib/icons';

  let events = $state<any[] | null>(null);
  const SRC = Object.fromEntries(EVENT_POINT_SOURCES);
  const LINK: Record<string, string> = { game_finish: '/#games', game_event_drop: '/#panen', race: '/#karung', fish: '/#fishing', visit: '/#friends', gift_sent: '/#friends', harvest: '/#garden', quest_claim: '/#quests', daily_claim: '/#daily', purchase: '/#shop' };
  onMount(async () => { try { events = (await api.get('/api/events')).events; } catch (e) { fail(e); events = []; } });

  function left(ev: any) {
    const ms = new Date(ev.running ? ev.ends_at : ev.starts_at).getTime() - G.now;
    const d = Math.floor(ms / 86_400_000), h = Math.floor((ms % 86_400_000) / 3_600_000);
    return d > 0 ? `${d} hari ${h} jam` : `${h} jam ${Math.floor((ms % 3_600_000) / 60_000)} mnt`;
  }
  async function claim(ev: any, m: any) {
    const r: any = await run(() => api.post(`/api/events/${ev.id}/claim`, { index: m.index }));
    if (!r) return;
    events = r.events;
    sfx.level(); fx('coins');
    toast(`Hadiah ${ev.tokenName} diambil!`, 'good');
  }
  const max = (ev: any) => Math.max(1, ...ev.milestones.map((m: any) => m.points));
</script>

<Sheet title="Event">
  {#if events === null}<p class="muted">Memuat…</p>
  {:else if events.length === 0}<p class="muted">Belum ada event. Nantikan event musiman berikutnya!</p>{/if}
  {#each events ?? [] as ev (ev.id)}
    <section style="--ev:{ev.color}">
      <header>
        <span class="tok"><svg viewBox="-16 -16 32 32">{@html eventDropSVG(ev.decor)}</svg></span>
        <div>
          <h3>{ev.name}</h3>
          <span class="when">{ev.running ? `Berakhir dalam ${left(ev)}` : `Mulai dalam ${left(ev)}`}{#if ev.multiplier > 1} · koin ×{ev.multiplier}{/if}</span>
        </div>
      </header>
      {#if ev.description}<p class="desc">{ev.description}</p>{/if}
      {#if ev.running && ev.milestones.length}
        <div class="pts"><b>{fmt(ev.myPoints)}</b> {ev.tokenName}</div>
        <div class="track">
          <i style="width:{Math.min(100, (ev.myPoints / max(ev)) * 100)}%"></i>
          {#each ev.milestones as m}<span class="mk" class:got={ev.myPoints >= m.points} style="left:{(m.points / max(ev)) * 100}%"></span>{/each}
        </div>
        <ol class="ms">
          {#each ev.milestones as m (m.index)}
            {@const it = item(m.item)}
            <li class:claimed={m.claimed} class:ready={m.ready}>
              <span class="need">{fmt(m.points)}</span>
              <span class="rw">
                {#if it}<span class="ic">{@html itemIcon(it)}</span>{it.name}{m.qty > 1 ? ` ×${m.qty}` : ''}{/if}
                {#if m.coin}<span class="c">{@html COIN}{fmt(m.coin)}</span>{/if}
                {#if m.pearl}<span class="c">{@html PEARL}{m.pearl}</span>{/if}
              </span>
              {#if m.claimed}<span class="ok">✓</span>
              {:else}<button class="btn sm" class:hot={m.ready} disabled={!m.ready || G.busy} onclick={() => claim(ev, m)}>Ambil</button>{/if}
            </li>
          {/each}
        </ol>
        <h4>Cara dapat {ev.tokenName}</h4>
        <ul class="src">
          {#each Object.entries(ev.points) as [k, v]}
            {@const key = k.split(':')[0]}
            <li><button onclick={() => openLink(LINK[key] ?? '/')}><span>{SRC[key] ?? k}</span><b>+{v}</b></button></li>
          {/each}
        </ul>
      {/if}
      {#if ev.items.length}
        <h4>Barang edisi terbatas</h4>
        <div class="items">
          {#each ev.items as id}{@const it = item(id)}{#if it}<button class="ei" onclick={() => { G.shopId = it.shop ?? 'pasar'; G.sheet = 'shop'; }}><span class="ic">{@html itemIcon(it)}</span><span>{it.name}</span></button>{/if}{/each}
        </div>
      {/if}
    </section>
  {/each}
</Sheet>

<style>
  section { display: flex; flex-direction: column; gap: 10px; border: 2.5px solid var(--ink); border-radius: 18px; padding: 12px; background: var(--card); border-top: 8px solid var(--ev); }
  header { display: flex; gap: 10px; align-items: center; }
  .tok { width: 46px; height: 46px; flex: none; border-radius: 14px; background: var(--tint); border: 2px solid var(--ink); display: grid; place-items: center; }
  .tok svg { width: 34px; height: 34px; }
  h3 { margin: 0; font-size: 20px; font-weight: 800; }
  .when { font-size: 13px; font-weight: 700; color: var(--muted); }
  .desc { margin: 0; font-weight: 600; }
  .pts { font-weight: 700; } .pts b { font-size: 26px; }
  .track { position: relative; height: 14px; border: 2px solid var(--ink); border-radius: 8px; background: var(--track); }
  .track i { position: absolute; inset: 0 auto 0 0; background: var(--ev); border-radius: 6px; }
  .mk { position: absolute; top: -5px; width: 10px; height: 20px; margin-left: -5px; border: 2px solid var(--ink); border-radius: 5px; background: var(--paper); }
  .mk.got { background: var(--coin); }
  .ms { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .ms li { display: flex; align-items: center; gap: 8px; border: 2px solid var(--ink); border-radius: 12px; padding: 6px 8px; }
  .ms li.ready { background: #FFF8E2; box-shadow: 0 0 0 3px var(--coin); }
  .ms li.claimed { opacity: .55; }
  .need { min-width: 44px; font-weight: 800; font-size: 15px; }
  .rw { flex: 1; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-weight: 700; font-size: 14px; }
  .rw .ic { width: 34px; height: 30px; display: grid; place-items: center; background: var(--tint); border-radius: 8px; }
  .rw .ic :global(svg) { width: 32px; height: 28px; }
  .c { display: inline-flex; align-items: center; gap: 2px; } .c :global(svg) { width: 17px; height: 17px; }
  .ok { width: 30px; height: 30px; border-radius: 50%; background: var(--ok); color: #fff; display: grid; place-items: center; font-weight: 800; border: 2px solid var(--ink); }
  h4 { margin: 2px 0 0; font-size: 15px; font-weight: 800; }
  .src { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .src button { width: 100%; display: flex; justify-content: space-between; gap: 8px; border: 0; border-bottom: 1px dashed #D9D2BF; background: none; padding: 6px 2px; font-weight: 600; font-size: 14px; cursor: pointer; text-align: left; }
  .src b { color: #1E7A4C; }
  .items { display: flex; gap: 8px; flex-wrap: wrap; }
  .ei { display: flex; flex-direction: column; align-items: center; gap: 2px; width: 92px; border: 2px solid var(--ink); border-radius: 12px; background: var(--paper); padding: 6px; font-weight: 700; font-size: 12.5px; cursor: pointer; }
  .ei .ic { width: 60px; height: 48px; display: grid; place-items: center; }
  .ei .ic :global(svg) { height: 46px; width: auto; }
  .muted { margin: 0; font-weight: 600; color: var(--muted); }
</style>
