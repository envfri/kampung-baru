<script lang="ts">
  import Sheet from '../components/Sheet.svelte';
  import { G, run, fx, toast } from '../lib/game.svelte';
  import { api } from '../lib/api';
  import { sfx } from '../lib/sfx';
  import { COIN, PEARL } from '../lib/icons';

  const cfg = $derived(G.catalog?.settings?.daily ?? { coins: [20, 25, 30, 35, 40, 50, 80], day7Pearls: 2 });
  const len = $derived(cfg.coins.length || 7);
  // hari ke berapa dalam siklus yang akan/ sudah diambil hari ini
  const yesterdayKey = new Date(Date.now() + 7 * 3600_000 - 86_400_000).toISOString().slice(0, 10);
  const nextStreak = $derived(G.me.daily.claimedToday ? G.me.daily.streak : G.me.daily.lastDay === yesterdayKey ? G.me.daily.streak + 1 : 1);
  const todayIdx = $derived((nextStreak - 1) % len);

  async function claim() {
    const r: any = await run(() => api.post('/api/daily'));
    if (r) { G.me.daily = r.daily; sfx.level(); fx('coins'); toast(`+${r.coins} koin${r.pearls ? ` dan +${r.pearls} Mutiara` : ''}!`, 'good'); setTimeout(() => (G.sheet = null), 900); }
  }
</script>

<Sheet title="Hadiah harian">
  <p class="lead">Masuk setiap hari untuk hadiah yang makin besar. Hari ke-{len} ada bonus Mutiara.</p>
  <div class="days">
    {#each cfg.coins as c, i}
      <div class="day" class:done={i < todayIdx || (i === todayIdx && G.me.daily.claimedToday)} class:today={i === todayIdx}>
        <span class="d">Hari {i + 1}</span>
        <span class="v">{@html COIN}{c}</span>
        {#if i === len - 1 && cfg.day7Pearls}<span class="v">{@html PEARL}{cfg.day7Pearls}</span>{/if}
      </div>
    {/each}
  </div>
  <button class="btn hot block big" disabled={G.me.daily.claimedToday || G.busy} onclick={claim}>{G.me.daily.claimedToday ? 'Sudah diambil. Sampai besok!' : 'Ambil hadiah'}</button>
</Sheet>

<style>
  .lead { margin: 0; font-weight: 600; }
  .days { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 8px; }
  .day { display: flex; flex-direction: column; align-items: center; gap: 2px; border: 2px solid var(--ink); border-radius: 14px; padding: 8px 4px; background: var(--card); font-weight: 800; }
  .day.today { background: var(--soft); box-shadow: 0 0 0 3px var(--coin); }
  .day.done { opacity: .5; }
  .d { font-size: 12.5px; color: var(--muted); }
  .v { display: flex; align-items: center; gap: 3px; font-size: 16px; }
  .big { min-height: 52px; font-size: 18px; }
</style>
