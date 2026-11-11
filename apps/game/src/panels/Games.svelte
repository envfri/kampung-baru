<script lang="ts">
  import Sheet from '../components/Sheet.svelte';
  import { GAMES, eventDropSVG } from '@kb/shared';
  import { G, settings, activeDecor } from '../lib/game.svelte';
  import { sfx } from '../lib/sfx';
  import { COIN } from '../lib/icons';
  import { GAME_ART as art } from '../lib/gameArt';
  const cfg = $derived(settings().games ?? {});
  const left = $derived(G.me.limits?.games ?? {});
  const decor = $derived(activeDecor());
  const eventOn = (decor: string) => (G.me.events ?? []).some((e: any) => e.decor === decor);
  const reward = (k: string, c: any) =>
    k === 'panen' || k === 'layangan' ? `Hadiah sampai ${c.maxCoins}` : k === 'memori' ? `Hadiah ${(c.rewards ?? []).join(' / ')} untuk 1–3 bintang`
      : k === 'bakiak' ? `${c.coinPerStep} per langkah, maks ${c.maxCoins}` : k === 'gasing' ? `${c.coinPerSec} per detik berputar, maks ${c.maxCoins}`
      : `Hadiah ${(c.rewards ?? []).join(' / ')}`;
  function play(k: string) { sfx.tap(); G.sheet = null; G.duel = null; G.view = k as any; }
</script>

<Sheet title="Balai Main">
  <p class="lead">Mini-game harian untuk koin, XP, dan poin event. Jatah main direset setiap hari.</p>
  {#each Object.entries(GAMES) as [k, g]}
    {@const c = cfg[k] ?? {}}
    {@const ev = (g as any).event}
    {@const locked = ev && !eventOn(ev)}
    <div class="gm" class:locked>
      <span class="art">{@html art[k]}</span>
      <div class="info">
        <b>{g.name}</b>
        <span>{g.desc}</span>
        <em>{@html COIN} {reward(k, c)} · {c.energiCost} energi · sisa {left[k] ?? c.playsPerDay}×</em>
        {#if locked}<span class="ev">Khusus event Agustusan (dekorasi bendera)</span>{/if}
        {#if k === 'panen' && decor}<span class="ev"><svg viewBox="-16 -16 32 32">{@html eventDropSVG(decor)}</svg> Benda event muncul selama event!</span>{/if}
      </div>
      <button class="btn hot" disabled={locked || (left[k] ?? 1) <= 0} onclick={() => play(k)}>Main</button>
    </div>
  {/each}
  <button class="btn block hot" onclick={() => { sfx.tap(); G.sheetArg = null; G.sheet = 'duels'; }}>Duel dengan teman{#if G.me.duelsPending}{' '}({G.me.duelsPending}){/if}</button>
  <button class="btn block" onclick={() => { G.sheet = null; G.view = 'karung'; }}>Ke Lomba Karung</button>
</Sheet>

<style>
  .lead { margin: 0; font-weight: 600; }
  .gm { display: flex; gap: 10px; align-items: center; border: 2px solid var(--ink); border-radius: 16px; background: var(--card); padding: 10px; }
  .art { width: 64px; height: 56px; flex: none; background: var(--tint); border-radius: 12px; display: grid; place-items: center; }
  .art :global(svg) { width: 58px; height: 48px; }
  .info { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
  .info b { font-size: 17px; }
  .info > span { font-size: 13.5px; font-weight: 600; color: var(--muted); }
  em { font-style: normal; font-size: 12.5px; font-weight: 700; display: block; line-height: 1.35; }
  em :global(svg) { width: 15px; height: 15px; display: inline-block; vertical-align: -3px; }
  .ev { display: flex; align-items: center; gap: 4px; font-size: 12.5px; font-weight: 800; color: #1E7A4C; }
  .ev svg { width: 18px; height: 18px; }
  .gm.locked { opacity: .7; }
  @media (max-width: 359px) {
    .gm { flex-wrap: wrap; }
    .art { width: 52px; height: 48px; }
    .art :global(svg) { width: 46px; height: 40px; }
    .gm .btn { flex: 1 1 100%; }
  }
</style>
