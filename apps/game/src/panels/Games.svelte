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
    bakiak: `<svg viewBox="0 0 64 52"><rect x="6" y="36" width="52" height="7" rx="3" fill="#B98B4E" stroke="#2B2F4A" stroke-width="2.4"/><circle cx="18" cy="26" r="8" fill="#F6B7A8" stroke="#2B2F4A" stroke-width="2.2"/><circle cx="32" cy="24" r="8" fill="#B98A64" stroke="#2B2F4A" stroke-width="2.2"/><circle cx="46" cy="26" r="8" fill="#C9B6E8" stroke="#2B2F4A" stroke-width="2.2"/></svg>`,
    gasing: `<svg viewBox="0 0 64 52"><path d="M32 46L16 24Q14 14 32 12Q50 14 48 24Z" fill="#E0583F" stroke="#2B2F4A" stroke-width="2.5" stroke-linejoin="round"/><path d="M18 22Q32 28 46 22" fill="none" stroke="#F2B632" stroke-width="3.5"/><rect x="29" y="4" width="6" height="10" rx="2" fill="#8A5A36" stroke="#2B2F4A" stroke-width="2"/></svg>`,
    layangan: `<svg viewBox="0 0 64 52"><path d="M32 4L48 22L32 42L16 22Z" fill="#3F7FBF" stroke="#2B2F4A" stroke-width="2.5" stroke-linejoin="round"/><path d="M32 4V42M16 22H48" stroke="#2B2F4A" stroke-width="1.4" opacity=".6"/><path d="M32 42q-6 5 0 8" fill="none" stroke="#2B2F4A" stroke-width="1.8"/></svg>`,
    pinang: `<svg viewBox="0 0 64 52"><rect x="28" y="8" width="8" height="42" fill="#9C6B45" stroke="#2B2F4A" stroke-width="2.2"/><ellipse cx="32" cy="8" rx="20" ry="4" fill="none" stroke="#2B2F4A" stroke-width="2.4"/><rect x="12" y="12" width="9" height="8" rx="2" fill="#E0583F" stroke="#2B2F4A" stroke-width="1.6"/><rect x="43" y="12" width="9" height="8" rx="2" fill="#F2B632" stroke="#2B2F4A" stroke-width="1.6"/><circle cx="32" cy="34" r="6" fill="#F6B7A8" stroke="#2B2F4A" stroke-width="2"/></svg>`,
  };
  const eventOn = (decor: string) => (G.me.events ?? []).some((e: any) => e.decor === decor);
  const reward = (k: string, c: any) =>
    k === 'panen' || k === 'layangan' ? `Hadiah sampai ${c.maxCoins}` : k === 'memori' ? `Hadiah ${(c.rewards ?? []).join(' / ')} untuk 1–3 bintang`
      : k === 'bakiak' ? `${c.coinPerStep} per langkah, maks ${c.maxCoins}` : k === 'gasing' ? `${c.coinPerSec} per detik berputar, maks ${c.maxCoins}`
      : `Hadiah ${(c.rewards ?? []).join(' / ')}`;
  function play(k: string) { sfx.tap(); G.sheet = null; G.view = k as any; }
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
