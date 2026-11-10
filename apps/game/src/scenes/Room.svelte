<script lang="ts">
  import { onDestroy, onMount, untrack } from 'svelte';
  import { fits, renderRoom, ROOM_VIEWBOX, occupied, petSpot, roomGeom } from '@kb/shared';
  import { G, items, item, wearItems, run, post, fx, toast, activeDecor } from '../lib/game.svelte';
  import { sfx } from '../lib/sfx';

  let { mode = 'home' }: { mode?: 'home' | 'visit' } = $props();
  let svgEl: SVGSVGElement | undefined = $state();
  let fxLayer: SVGGElement | undefined = $state();
  let lastTap = 0;

  const size = $derived(G.catalog?.settings?.room?.size ?? 6);
  const geom = $derived(roomGeom(size));
  const itemMap = $derived(Object.fromEntries(items()));
  const layout = $derived(mode === 'visit' ? (G.visit?.room?.layout ?? []) : G.edit && G.draft ? G.draft : (G.me.room.layout ?? []));
  const blocked = $derived(occupied(layout, itemMap));

  /* ---------------- pet berjalan ---------------- */
  // `pos` dipakai saat menggambar ulang ruangan (hanya saat pet pindah petak, untuk urutan kedalaman);
  // `live` diperbarui setiap frame dan langsung menggeser elemen pet.
  let pos = $state<[number, number] | null>(null);
  let flip = $state(false);
  let walking = $state(false);
  let live: [number, number] | null = null;
  let path: [number, number][] = [];
  let raf = 0;
  let idleTimer: any;
  let last = 0;
  const SPEED = 1.3; // petak per detik
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tileOf = (p: [number, number]) => `${Math.floor(p[0])},${Math.floor(p[1])}`;

  // pastikan pet selalu di petak kosong (mis. setelah mebel dipindah ke tempatnya)
  $effect(() => {
    const b = blocked, sz = size, lay = layout;
    const cur = untrack(() => pos);
    if (!cur || cur[0] >= sz || cur[1] >= sz || b.has(tileOf(cur))) {
      halt();
      const spot = petSpot(lay, itemMap, sz);
      pos = spot;
      live = [...spot];
    }
  });

  const html = $derived.by(() => {
    const p = pos ?? undefined;
    if (mode === 'visit' && G.visit) {
      const r = G.visit.room ?? { layout: [] };
      return renderRoom({
        layout: r.layout ?? [], items: itemMap, wall: item(r.wall), floor: item(r.floor), size,
        pet: G.visit.pet ? { look: G.visit.pet, wear: wearItems(G.visit.pet.wear), pos: p, flip } : null,
        decor: activeDecor(),
      });
    }
    const room = G.me.room;
    return renderRoom({
      layout, items: itemMap, wall: item(room.wall), floor: item(room.floor), size,
      pet: { look: G.me.pet, wear: wearItems(G.me.pet.wear), pos: p, flip },
      edit: G.edit, sel: G.sel, decor: activeDecor(),
    });
  });

  const petEl = () => svgEl?.querySelector('.pet') as SVGGElement | null;
  function place() {
    const el = petEl();
    if (!el || !live) return;
    const [x, y] = geom.point(live[0], live[1]);
    el.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${geom.petScale})`);
  }

  // jalur terpendek antar petak (BFS), menghindari mebel
  function route(from: [number, number], to: [number, number]) {
    const key = (x: number, y: number) => `${x},${y}`;
    const prev = new Map<string, [number, number] | null>([[key(...from), null]]);
    const queue: [number, number][] = [from];
    while (queue.length) {
      const [x, y] = queue.shift()!;
      if (x === to[0] && y === to[1]) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = key(nx, ny);
        if (nx < 0 || ny < 0 || nx >= size || ny >= size || prev.has(k) || blocked.has(k)) continue;
        prev.set(k, [x, y]);
        queue.push([nx, ny]);
      }
    }
    if (!prev.has(key(...to))) return null;
    const out: [number, number][] = [];
    for (let c: [number, number] | null = to; c; c = prev.get(key(...c)) ?? null) out.unshift(c);
    return out.slice(1).map(([x, y]) => [x + 0.5, y + 0.5] as [number, number]);
  }

  function walkTo(tx: number, ty: number) {
    if (!live || blocked.has(`${tx},${ty}`)) return false;
    const p = route([Math.floor(live[0]), Math.floor(live[1])], [tx, ty]);
    if (!p || !p.length) return false;
    clearTimeout(idleTimer);
    if (reduced) {
      live = [...p[p.length - 1]];
      pos = [...live];
      scheduleIdle();
      return true;
    }
    path = p;
    walking = true;
    cancelAnimationFrame(raf);
    last = performance.now();
    raf = requestAnimationFrame(tick);
    return true;
  }

  function tick(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!live || !path.length) return stopWalk();
    const [tx, ty] = path[0];
    const dx = tx - live[0], dy = ty - live[1];
    const d = Math.hypot(dx, dy), step = SPEED * dt;
    const sx = dx - dy; // arah horizontal di layar
    if (Math.abs(sx) > 0.01 && sx < 0 !== flip) flip = sx < 0;
    const before = tileOf(live);
    if (d <= step) { live = [tx, ty]; path.shift(); }
    else live = [live[0] + (dx / d) * step, live[1] + (dy / d) * step];
    if (tileOf(live) !== before || !path.length) pos = [...live];
    place();
    if (path.length) raf = requestAnimationFrame(tick);
    else stopWalk();
  }

  function halt() {
    cancelAnimationFrame(raf);
    raf = 0;
    path = [];
    walking = false;
    clearTimeout(idleTimer);
  }
  function stopWalk() {
    halt();
    if (live) pos = [...live];
    scheduleIdle();
  }
  function scheduleIdle() {
    clearTimeout(idleTimer);
    if (reduced) return;
    idleTimer = setTimeout(wander, 2500 + Math.random() * 5000);
  }
  function wander() {
    if (!live || G.edit || document.hidden || G.sheet === 'feed') return scheduleIdle();
    const cx = Math.floor(live[0]), cy = Math.floor(live[1]);
    const options: [number, number][] = [];
    for (let x = 0; x < size; x++)
      for (let y = 0; y < size; y++) {
        const m = Math.abs(x - cx) + Math.abs(y - cy);
        if (m > 0 && m <= 3 && !blocked.has(`${x},${y}`)) options.push([x, y]);
      }
    const pick = options[Math.floor(Math.random() * options.length)];
    if (!pick || !walkTo(pick[0], pick[1])) scheduleIdle();
  }

  // mode atur: pet diam supaya mudah menata barang
  $effect(() => {
    if (G.edit) halt();
    else untrack(() => scheduleIdle());
  });

  onMount(() => scheduleIdle());
  onDestroy(() => halt());

  /* ---------------- interaksi ---------------- */

  function click(e: MouseEvent) {
    const t = e.target as Element;
    if (t.closest('.pet')) return tapPet();
    if (G.edit && mode === 'home') {
      const f = t.closest('.furn') as SVGElement | null;
      if (f) { G.sel = Number(f.dataset.i); sfx.tap(); return; }
      const tile = t.closest('.tile') as SVGElement | null;
      if (tile && G.sel >= 0 && G.draft) {
        const x = Number(tile.dataset.x), y = Number(tile.dataset.y);
        const p = G.draft[G.sel];
        const it = item(p?.i);
        if (!it) return;
        if (!fits(it, x, y, G.draft, itemMap, size, G.sel)) { sfx.error(); toast('Tidak muat di situ.', 'error'); return; }
        G.draft[G.sel] = { ...p, x, y };
        sfx.pop();
      }
      return;
    }
    // ketuk lantai: pet berjalan ke sana
    const fl = t.closest('.fl') as SVGElement | null;
    if (fl && walkTo(Number(fl.dataset.x), Number(fl.dataset.y))) sfx.tap();
  }

  async function tapPet() {
    const now = Date.now();
    if (now - lastTap < 600) return;
    lastTap = now;
    if (walking) stopWalk();
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

  // potret: perbesar ruangan agar memenuhi layar HP
  const viewBox = $derived(G.portrait ? '172 -40 456 440' : ROOM_VIEWBOX);
</script>

<svg bind:this={svgEl} class="room" class:walking {viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={mode === 'visit' ? 'Rumah teman' : 'Rumahmu'} onclick={click}>
  {@html html}
  <g bind:this={fxLayer} pointer-events="none"></g>
</svg>

<style>
  .room { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: manipulation; }
  .room :global(.fl) { cursor: pointer; }
  .room.walking :global(.pet-bob) { animation: waddle 0.3s ease-in-out infinite alternate; }
  @keyframes waddle {
    from { transform: rotate(-6deg) translateY(0); }
    to { transform: rotate(6deg) translateY(-4px); }
  }
  @media (prefers-reduced-motion: reduce) { .room.walking :global(.pet-bob) { animation: none; } }
</style>
