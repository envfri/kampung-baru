<script lang="ts">
  import { onMount } from 'svelte';
  import Sheet from '../components/Sheet.svelte';
  import { G, run, fx, toast, fail } from '../lib/game.svelte';
  import { api } from '../lib/api';
  import { openLink } from '../lib/links';
  import { sfx } from '../lib/sfx';
  import { COIN, PEARL } from '../lib/icons';

  let data = $state<any>(null);
  let tab = $state<'starter' | 'daily' | 'badges'>(G.sheetArg?.tab === 'badges' ? 'badges' : 'starter');
  onMount(async () => {
    try {
      data = await api.get('/api/quests');
      if (tab === 'starter' && !data.starter.some((q: any) => !q.claimed)) tab = readyIn('badges') ? 'badges' : 'daily';
    } catch (e) { fail(e); }
  });
  const list = $derived(data ? (tab === 'starter' ? data.starter : tab === 'daily' ? data.daily : []) : []);
  const badges = $derived<any[]>(data?.badges ?? []);
  const starterLeft = $derived(data ? data.starter.filter((q: any) => !q.claimed).length : 0);
  const readyIn = (k: 'starter' | 'daily' | 'badges') => (data ? (data[k] ?? []).filter((q: any) => q.done && !q.claimed).length : 0);
  // medali: warna dari besar target (perunggu / perak / emas)
  const medal = (q: any) => (q.target >= 25 ? ['#F2B632', '#B9800F'] : q.target >= 10 ? ['#D7DDE4', '#8C97A6'] : ['#E0A06A', '#A86B3C']);
  const resetIn = $derived.by(() => {
    if (!data) return '';
    const ms = new Date(data.dailyResetAt).getTime() - G.now;
    const h = Math.floor(ms / 3_600_000), m = Math.floor((ms % 3_600_000) / 60_000);
    return h > 0 ? `${h} jam ${m} mnt` : `${m} mnt`;
  });

  async function claim(q: any) {
    const r: any = await run(() => api.post(`/api/quests/${q.id}/claim`));
    if (!r) return;
    data = r.list;
    sfx.level();
    fx('coins');
    const parts = [r.reward.coin && `+${r.reward.coin} koin`, r.reward.pearl && `+${r.reward.pearl} Mutiara`, r.reward.xp && `+${r.reward.xp} XP`].filter(Boolean);
    toast(`${q.title} selesai! ${parts.join(', ')}`, 'good');
    if (r.levelUp) setTimeout(() => toast(`Naik ke Lv ${r.levelUp}!`, 'good'), 1200);
  }
  function go(q: any) { sfx.tap(); openLink(q.url); }
</script>

<Sheet title="Tugas">
  {#if !data}
    <p class="muted">Memuat…</p>
  {:else if !data.enabled}
    <p class="muted">Tugas sedang tidak tersedia.</p>
  {:else}
    <div class="seg">
      <button class:on={tab === 'starter'} onclick={() => (tab = 'starter')}>Pemula {#if readyIn('starter')}<i>{readyIn('starter')}</i>{/if}</button>
      <button class:on={tab === 'daily'} onclick={() => (tab = 'daily')}>Harian {#if readyIn('daily')}<i>{readyIn('daily')}</i>{/if}</button>
      {#if badges.length}<button class:on={tab === 'badges'} onclick={() => (tab = 'badges')}>Lencana {#if readyIn('badges')}<i>{readyIn('badges')}</i>{/if}</button>{/if}
    </div>
    {#if tab === 'starter'}
      <p class="lead">{starterLeft ? `Selesaikan tugas berurutan untuk mengenal BUPI. Tersisa ${starterLeft}.` : 'Semua tugas pemula selesai. Lanjutkan dengan tugas harian!'}</p>
    {:else if tab === 'daily'}
      <p class="lead">Tiga tugas baru setiap hari. Berganti dalam {resetIn}.</p>
    {:else}
      <p class="lead">Pencapaian sekali seumur akun. Sudah {badges.filter((b) => b.claimed).length} dari {badges.length} lencana.</p>
      <div class="badges">
        {#each badges as b (b.id)}
          {@const [c1, c2] = medal(b)}
          <div class="badge" class:earned={b.claimed} class:done={b.done && !b.claimed}>
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <path d="M20 4h10l4 16-10 4ZM44 4H34l-4 16 10 4Z" fill={b.claimed || b.done ? '#E0583F' : '#C9C2B0'} stroke="#2B2F4A" stroke-width="2"/>
              <circle cx="32" cy="38" r="20" fill={b.claimed || b.done ? c1 : '#E9E4D6'} stroke="#2B2F4A" stroke-width="3"/>
              <circle cx="32" cy="38" r="13" fill="none" stroke={b.claimed || b.done ? c2 : '#C9C2B0'} stroke-width="2.4"/>
              {#if b.claimed}<path d="M24 38l6 6 11-12" fill="none" stroke="#2B2F4A" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
              {:else}<text x="32" y="44" text-anchor="middle" font-family="'Baloo 2',sans-serif" font-weight="800" font-size="15" fill="#2B2F4A">{Math.floor((b.progress / b.target) * 100)}%</text>{/if}
            </svg>
            <b>{b.title}</b>
            <span>{b.description}</span>
            <span class="rw">
              {#if b.reward.coin}<span>{@html COIN}{b.reward.coin}</span>{/if}
              {#if b.reward.pearl}<span>{@html PEARL}{b.reward.pearl}</span>{/if}
              {#if b.reward.xp}<span class="xp">+{b.reward.xp} XP</span>{/if}
            </span>
            {#if b.done && !b.claimed}<button class="btn sm hot" disabled={G.busy} onclick={() => claim(b)}>Ambil</button>
            {:else if !b.claimed}<small>{b.progress}/{b.target}</small>{/if}
          </div>
        {/each}
      </div>
    {/if}
    <ol class="list">
      {#each list as q, i (q.id)}
        {@const current = tab === 'starter' && !q.claimed && list.slice(0, i).every((x: any) => x.claimed)}
        <li class:claimed={q.claimed} class:current class:done={q.done && !q.claimed}>
          <div class="txt">
            <b>{q.title}</b>
            <span>{q.description}</span>
            <div class="row">
              <span class="bar"><i style="width:{(q.progress / q.target) * 100}%"></i><small>{q.progress}/{q.target}</small></span>
              <span class="rw">
                {#if q.reward.coin}<span>{@html COIN}{q.reward.coin}</span>{/if}
                {#if q.reward.pearl}<span>{@html PEARL}{q.reward.pearl}</span>{/if}
                {#if q.reward.xp}<span class="xp">+{q.reward.xp} XP</span>{/if}
              </span>
            </div>
          </div>
          {#if q.claimed}<span class="ok" aria-label="Selesai">✓</span>
          {:else if q.done}<button class="btn sm hot" disabled={G.busy} onclick={() => claim(q)}>Ambil</button>
          {:else}<button class="btn sm" onclick={() => go(q)}>Ke sana</button>{/if}
        </li>
      {/each}
    </ol>
  {/if}
</Sheet>

<style>
  .seg { display: flex; border: 2.5px solid var(--ink); border-radius: 12px; overflow: hidden; }
  .seg button { flex: 1; border: 0; background: var(--paper); font-weight: 800; font-size: 15px; min-height: 40px; cursor: pointer; }
  .seg button.on { background: var(--coin); }
  .seg i { font-style: normal; background: var(--low); color: #fff; border-radius: 9px; padding: 0 6px; font-size: 12px; margin-left: 4px; }
  .lead { margin: 0; font-weight: 600; }
  .muted { margin: 0; font-weight: 600; color: var(--muted); }
  .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  li { display: flex; align-items: center; gap: 10px; border: 2px solid var(--ink); border-radius: 14px; background: var(--card); padding: 10px; }
  li.current { background: #FFF8E2; box-shadow: 0 0 0 3px var(--coin); }
  li.done { background: #E6F5EC; }
  li.claimed { opacity: .55; }
  .txt { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; }
  .txt b { font-size: 16px; }
  .txt > span { font-size: 13.5px; font-weight: 600; color: var(--muted); }
  .row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 2px; }
  .bar { position: relative; width: 90px; height: 18px; border: 2px solid var(--ink); border-radius: 9px; background: var(--track); overflow: hidden; }
  .bar i { position: absolute; inset: 0 auto 0 0; background: var(--ok); }
  .bar small { position: relative; display: block; text-align: center; font-size: 11.5px; font-weight: 800; line-height: 14px; }
  .rw { display: flex; gap: 8px; font-weight: 800; font-size: 13.5px; align-items: center; }
  .rw span { display: inline-flex; align-items: center; gap: 2px; }
  .rw :global(svg) { width: 16px; height: 16px; }
  .xp { color: #1E5FA0; }
  .badges { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
  .badge { display: flex; flex-direction: column; align-items: center; gap: 3px; text-align: center; border: 2px solid var(--ink); border-radius: 14px; background: var(--card); padding: 8px 8px 10px; }
  .badge svg { width: 60px; height: 60px; }
  .badge b { font-size: 14.5px; line-height: 1.1; }
  .badge > span { font-size: 12px; font-weight: 600; color: var(--muted); line-height: 1.2; }
  .badge small { font-weight: 800; color: var(--muted); }
  .badge.done { background: #E6F5EC; box-shadow: 0 0 0 3px var(--ok); }
  .badge.earned { background: #FFF8E2; }
  .badge:not(.earned):not(.done) svg { filter: saturate(.4); }
  .ok { width: 36px; height: 36px; border-radius: 50%; background: var(--ok); color: #fff; display: grid; place-items: center; font-weight: 800; border: 2px solid var(--ink); flex: none; }
</style>
