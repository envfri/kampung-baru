<script lang="ts">
  import { onMount } from 'svelte';
  import { renderMap } from '@kb/shared';
  import { G, toast } from '../lib/game.svelte';
  import { sfx } from '../lib/sfx';
  let wrap: HTMLDivElement | undefined = $state();
  const locs = $derived(G.catalog?.locations ?? []);
  const html = $derived(renderMap(locs));
  const f = $derived(G.catalog?.settings?.features ?? {});

  function open(id: string) {
    const l = locs.find((x) => x.id === id);
    if (!l) return;
    sfx.tap();
    switch (l.kind) {
      case 'home': G.view = 'home'; break;
      case 'shop': G.shopId = l.id; G.sheet = 'shop'; break;
      case 'pearl': G.shopId = l.id; G.sheet = 'shop'; break;
      case 'social': G.sheet = 'friends'; break;
      case 'garden': if (f.garden === false) return toast('Kebun sedang ditutup.'); G.view = 'garden'; break;
      case 'race': if (f.karung === false) return toast('Lapangan Lomba sedang ditutup.'); G.view = 'karung'; break;
      case 'pond': if (f.fishing === false) return toast('Kolam Pancing sedang ditutup.'); G.view = 'fishing'; break;
    }
  }
  function click(e: MouseEvent) {
    const l = (e.target as Element).closest('.loc') as SVGElement | null;
    if (l) open(l.dataset.loc!);
  }
  function key(e: KeyboardEvent) {
    const l = (e.target as Element).closest?.('.loc') as SVGElement | null;
    if (l && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(l.dataset.loc!); }
  }
  onMount(() => {
    // di HP potret, peta lebih lebar dari layar: mulai dari tengah, geser untuk melihat
    if (wrap) wrap.scrollLeft = (wrap.scrollWidth - wrap.clientWidth) / 2;
  });
</script>

<div class="wrap" bind:this={wrap}>
  <svg class="map" viewBox="0 -40 800 520" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Peta Kampung" onclick={click} onkeydown={key}>
    {@html html}
  </svg>
</div>
<p class="hint">Geser peta, lalu ketuk tempat yang ingin dikunjungi</p>

<style>
  .wrap { position: absolute; inset: 0; overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
  .wrap::-webkit-scrollbar { display: none; }
  .map { display: block; height: 100%; width: 100%; min-width: calc(100dvh * 1.5385 * .78); }
  .hint { position: absolute; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-b) + 84px); margin: 0; background: rgba(255,253,247,.92); border: 2px solid var(--ink); border-radius: 12px; padding: 3px 10px; font-weight: 700; font-size: 13px; white-space: nowrap; pointer-events: none; }
  @media (min-aspect-ratio: 1/1) { .map { min-width: 0; } .hint { display: none; } }
</style>
