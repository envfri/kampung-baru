<script lang="ts">
  import { fits, renderRoom, footprint, ROOM_VIEWBOX } from '@kb/shared';
  import { G, items, item, wearItems, run, post, fx, toast } from '../lib/game.svelte';
  import { sfx } from '../lib/sfx';

  let { mode = 'home' }: { mode?: 'home' | 'visit' } = $props();
  let svgEl: SVGSVGElement | undefined = $state();
  let fxLayer: SVGGElement | undefined = $state();
  let lastTap = 0;

  const size = $derived(G.catalog?.settings?.room?.size ?? 6);
  const html = $derived.by(() => {
    const map: Record<string, any> = Object.fromEntries(items());
    if (mode === 'visit' && G.visit) {
      const r = G.visit.room ?? { layout: [] };
      return renderRoom({
        layout: r.layout ?? [], items: map, wall: item(r.wall), floor: item(r.floor), size,
        pet: G.visit.pet ? { look: G.visit.pet, wear: wearItems(G.visit.pet.wear) } : null,
      });
    }
    const room = G.me.room;
    const layout = G.edit && G.draft ? G.draft : room.layout ?? [];
    return renderRoom({
      layout, items: map, wall: item(room.wall), floor: item(room.floor), size,
      pet: { look: G.me.pet, wear: wearItems(G.me.pet.wear) },
      edit: G.edit, sel: G.sel,
    });
  });
  // potret: perbesar ruangan agar memenuhi layar HP
  const viewBox = $derived(G.portrait ? '172 -40 456 440' : ROOM_VIEWBOX);

  function click(e: MouseEvent) {
    const t = e.target as Element;
    if (t.closest('.pet')) return tapPet();
    if (!G.edit || mode !== 'home') return;
    const f = t.closest('.furn') as SVGElement | null;
    if (f) { G.sel = Number(f.dataset.i); sfx.tap(); return; }
    const tile = t.closest('.tile') as SVGElement | null;
    if (tile && G.sel >= 0 && G.draft) {
      const x = Number(tile.dataset.x), y = Number(tile.dataset.y);
      const p = G.draft[G.sel];
      const it = item(p?.i);
      if (!it) return;
      if (!fits(it, x, y, G.draft, Object.fromEntries(items()), size, G.sel)) { sfx.error(); toast('Tidak muat di situ.', 'error'); return; }
      G.draft[G.sel] = { ...p, x, y };
      sfx.pop();
    }
  }

  async function tapPet() {
    const now = Date.now();
    if (now - lastTap < 600) return;
    lastTap = now;
    fx('hearts');
    sfx.pop();
    if (mode === 'home' && !G.edit) await run(() => post('/api/action', { type: 'elus' }));
  }

  // efek melayang (hati, gelembung, koin, zzz) di atas kepala pet
  $effect(() => {
    const n = G.fx;
    if (!n || !svgEl || !fxLayer) return;
    const pet = svgEl.querySelector('.pet');
    if (!pet) return;
    const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(pet.getAttribute('transform') ?? '');
    if (!m) return;
    const x = +m[1], y = +m[2] - 74;
    const hop = pet.querySelector('.pet-hop');
    hop?.classList.remove('go');
    void (hop as any)?.getBBox?.();
    hop?.classList.add('go');
    const shapes: Record<string, () => string> = {
      hearts: () => '<path d="M0 4C-8 -4-14 2-7 9L0 15 7 9C14 2 8 -4 0 4Z" fill="#FF6B8A" stroke="#2B2F4A" stroke-width="2"/>',
      bubbles: () => `<circle r="${5 + Math.random() * 5}" fill="#DDF3FF" stroke="#2B2F4A" stroke-width="1.8"/>`,
      coins: () => '<circle r="8" fill="#F2B632" stroke="#2B2F4A" stroke-width="2"/><circle r="4" fill="none" stroke="#B9800F" stroke-width="1.6"/>',
      zz: () => '<text font-family="Baloo 2,sans-serif" font-weight="800" font-size="20" fill="#FFFDF7" stroke="#2B2F4A" stroke-width="1.2">Z</text>',
      food: () => '<circle r="5" fill="#F2C94C" stroke="#2B2F4A" stroke-width="1.6"/>',
    };
    const make = shapes[G.fxKind] ?? shapes.hearts;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    let h = '';
    for (let i = 0; i < 4; i++) {
      const dx = (i - 1.5) * 16 + (Math.random() * 8 - 4);
      h += `<g transform="translate(${(x + dx).toFixed(1)} ${(y - i * 4).toFixed(1)})"><g class="fx-up" style="animation-delay:${i * 110}ms">${make()}</g></g>`;
    }
    g.innerHTML = h;
    fxLayer.appendChild(g);
    setTimeout(() => g.remove(), 1600);
  });

  void footprint;
</script>

<svg bind:this={svgEl} class="room" {viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={mode === 'visit' ? 'Rumah teman' : 'Rumahmu'} onclick={click}>
  {@html html}
  <g bind:this={fxLayer} pointer-events="none"></g>
</svg>

<style>
  .room { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: manipulation; }
</style>
