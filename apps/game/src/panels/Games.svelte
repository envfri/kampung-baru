<script lang="ts">
  import Sheet from '../components/Sheet.svelte';
  import { GAMES, eventDropSVG } from '@kb/shared';
  import { G, settings, activeDecor } from '../lib/game.svelte';
  import { sfx } from '../lib/sfx';
  import { COIN } from '../lib/icons';
  const cfg = $derived(settings().games ?? {});
  const left = $derived(G.me.limits?.games ?? {});
  const decor = $derived(activeDecor());
  const art: Record<string, string> = {
    panen: `<svg viewBox="0 0 64 52"><path d="M14 34h36l-5 14H19Z" fill="#C8955A" stroke="#2B2F4A" stroke-width="2.5" stroke-linejoin="round"/><path d="M18 40h28" stroke="#8A5A36" stroke-width="2"/><circle cx="24" cy="16" r="7" fill="#E0583F" stroke="#2B2F4A" stroke-width="2.2"/><circle cx="42" cy="10" r="6" fill="#F2B632" stroke="#2B2F4A" stroke-width="2.2"/><circle cx="34" cy="26" r="6" fill="#F2994A" stroke="#2B2F4A" stroke-width="2.2"/></svg>`,
    memori: `<svg viewBox="0 0 64 52"><rect x="8" y="8" width="20" height="26" rx="4" fill="#3F7FBF" stroke="#2B2F4A" stroke-width="2.5" transform="rotate(-8 18 21)"/><rect x="34" y="12" width="20" height="26" rx="4" fill="#FFFDF7" stroke="#2B2F4A" stroke-width="2.5" transform="rotate(8 44 25)"/><circle cx="44" cy="25" r="6" fill="#58A55C" stroke="#2B2F4A" stroke-width="2"/></svg>`,
  };
  function play(k: 'panen' | 'memori') { sfx.tap(); G.sheet = null; G.view = k; }
</script>

<Sheet title="Balai Main">
  <p class="lead">Mini-game harian untuk koin, XP, dan poin event. Jatah main direset setiap hari.</p>
  {#each Object.entries(GAMES) as [k, g]}
    {@const c = cfg[k] ?? {}}
    <div class="gm">
      <span class="art">{@html art[k]}</span>
      <div class="info">
        <b>{g.name}</b>
        <span>{g.desc}</span>
        <em>
          {#if k === 'panen'}Hadiah sampai {@html COIN}{c.maxCoins}{:else}Hadiah {@html COIN}{(c.rewards ?? []).join(' / ')} untuk 1–3 bintang{/if}
          · {c.energiCost} energi · sisa {left[k] ?? c.playsPerDay}×
        </em>
        {#if k === 'panen' && decor}<span class="ev"><svg viewBox="-16 -16 32 32">{@html eventDropSVG(decor)}</svg> Benda event muncul selama event!</span>{/if}
      </div>
      <button class="btn hot" disabled={(left[k] ?? 1) <= 0} onclick={() => play(k as any)}>Main</button>
    </div>
  {/each}
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
  em { font-style: normal; font-size: 12.5px; font-weight: 700; display: flex; align-items: center; gap: 3px; flex-wrap: wrap; }
  em :global(svg) { width: 15px; height: 15px; }
  .ev { display: flex; align-items: center; gap: 4px; font-size: 12.5px; font-weight: 800; color: #1E7A4C; }
  .ev svg { width: 18px; height: 18px; }
</style>
