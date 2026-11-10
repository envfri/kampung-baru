<script lang="ts">
  import { onMount } from 'svelte';
  import Sheet from '../components/Sheet.svelte';
  import { G, run, fx, toast, fail } from '../lib/game.svelte';
  import { api } from '../lib/api';
  import { openLink } from '../lib/links';
  import { sfx } from '../lib/sfx';
  import { COIN, PEARL } from '../lib/icons';

  let data = $state<any>(null);
  let tab = $state<'starter' | 'daily'>('starter');
  onMount(async () => {
    try {
      data = await api.get('/api/quests');
      if (!data.starter.some((q: any) => !q.claimed)) tab = 'daily';
    } catch (e) { fail(e); }
  });
  const list = $derived(data ? (tab === 'starter' ? data.starter : data.daily) : []);
  const starterLeft = $derived(data ? data.starter.filter((q: any) => !q.claimed).length : 0);
  const readyIn = (k: 'starter' | 'daily') => (data ? data[k].filter((q: any) => q.done && !q.claimed).length : 0);
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
    </div>
    {#if tab === 'starter'}
      <p class="lead">{starterLeft ? `Selesaikan tugas berurutan untuk mengenal BUPI. Tersisa ${starterLeft}.` : 'Semua tugas pemula selesai. Lanjutkan dengan tugas harian!'}</p>
    {:else}
      <p class="lead">Tiga tugas baru setiap hari. Berganti dalam {resetIn}.</p>
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
  .ok { width: 36px; height: 36px; border-radius: 50%; background: var(--ok); color: #fff; display: grid; place-items: center; font-weight: 800; border: 2px solid var(--ink); flex: none; }
</style>
