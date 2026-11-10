<script lang="ts">
  import { onDestroy, onMount, untrack } from 'svelte';
  import { fits, renderRoom, ROOM_VIEWBOX, occupied, petSpot, roomGeom, footprint, ROOM_SPOTS, ACTIVITY_ANIMS, ACTIVITY_SPOTS, activityFits, type RoomSpot } from '@kb/shared';
  import { G, items, item, wearItems, run, post, fx, toast, activeDecor, curRoom, effText } from '../lib/game.svelte';
  import { sfx } from '../lib/sfx';

  let { mode = 'home' }: { mode?: 'home' | 'visit' } = $props();
  let svgEl: SVGSVGElement | undefined = $state();
  let wrapEl: HTMLDivElement | undefined = $state();
  let fxLayer: SVGGElement | undefined = $state();
  let lastTap = 0;

  const room = $derived<any>(mode === 'visit' ? (G.visit?.rooms?.[G.visitRoom] ?? G.visit?.room ?? { layout: [] }) : curRoom());
  const size = $derived<number>(room?.size ?? G.catalog?.settings?.room?.size ?? 6);
  const theme = $derived<string>(room?.theme ?? 'dalam');
  const geom = $derived(roomGeom(size));
  const itemMap = $derived(Object.fromEntries(items()));
  const layout = $derived<any[]>(mode === 'visit' ? (room?.layout ?? []) : G.edit && G.draft ? G.draft : (room?.layout ?? []));
  const blocked = $derived(occupied(layout, itemMap));

  /* ---------------- pet berjalan ---------------- */
  // `pos` dipakai saat menggambar ulang ruangan (hanya saat pet pindah petak, untuk urutan kedalaman);
  // `live` diperbarui setiap frame dan langsung menggeser elemen pet.
  let pos = $state<[number, number] | null>(null);
  let flip = $state(false);
  let walking = $state(false);
  /** pose saat beraktivitas (tidur di kasur, membaca, ...) */
  let pose = $state<{ pose: string; prop?: string; lift: number } | null>(null);
  let acting = $state(false);
  let live: [number, number] | null = null;
  let path: [number, number][] = [];
  let raf = 0;
  let idleTimer: any;
  let last = 0;
  let arrived: (() => void) | null = null;
  let shownRoom = '';
  const SPEED = 1.3; // petak per detik
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tileOf = (p: [number, number]) => `${Math.floor(p[0])},${Math.floor(p[1])}`;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, reduced ? Math.min(ms, 400) : ms));

  // pastikan pet selalu di petak kosong (mis. setelah mebel dipindah ke tempatnya, atau pindah ruangan)
  $effect(() => {
    const b = blocked, sz = size, lay = layout, rid = room?.id ?? '';
    const cur = untrack(() => pos);
    const moved = rid !== shownRoom;
    if (moved || (!untrack(() => acting) && (!cur || cur[0] >= sz || cur[1] >= sz || b.has(tileOf(cur))))) {
      shownRoom = rid;
      halt();
      untrack(() => { pose = null; acting = false; menu = null; });
      const spot = petSpot(lay, itemMap, sz);
      pos = spot;
      live = [...spot];
    }
  });

  const html = $derived.by(() => {
    const p = pos ?? undefined;
    const pet = mode === 'visit' ? G.visit?.pet : G.me.pet;
    return renderRoom({
      layout, items: itemMap, wall: item(room?.wall), floor: item(room?.floor), size, theme,
      pet: pet ? { look: pet, wear: wearItems(pet.wear), pos: p, flip, lift: pose?.lift, pose: pose?.pose, prop: pose?.prop } : null,
      edit: mode === 'home' && G.edit, sel: G.sel, decor: activeDecor(),
    });
  });

  const petEl = () => svgEl?.querySelector('.pet') as SVGGElement | null;
  function place() {
    const el = petEl();
    if (!el || !live) return;
    const [x, y] = geom.point(live[0], live[1]);
    el.setAttribute('transform', `translate(${x.toFixed(1)} ${(y - (pose?.lift ?? 0) * geom.s).toFixed(1)}) scale(${geom.petScale})`);
  }

  /** Jalur terpendek (BFS) dari petak pet ke salah satu petak tujuan, menghindari mebel. */
  function routeToAny(goals: [number, number][]) {
    if (!live) return null;
    const key = (x: number, y: number) => `${x},${y}`;
    const want = new Set(goals.filter(([x, y]) => x >= 0 && y >= 0 && x < size && y < size && !blocked.has(key(x, y))).map(([x, y]) => key(x, y)));
    if (!want.size) return null;
    const from: [number, number] = [Math.floor(live[0]), Math.floor(live[1])];
    const prev = new Map<string, [number, number] | null>([[key(...from), null]]);
    const queue: [number, number][] = [from];
    let end: [number, number] | null = null;
    while (queue.length) {
      const [x, y] = queue.shift()!;
      if (want.has(key(x, y))) { end = [x, y]; break; }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = key(nx, ny);
        if (nx < 0 || ny < 0 || nx >= size || ny >= size || prev.has(k) || blocked.has(k)) continue;
        prev.set(k, [x, y]);
        queue.push([nx, ny]);
      }
    }
    if (!end) return null;
    const out: [number, number][] = [];
    for (let c: [number, number] | null = end; c; c = prev.get(key(...c)) ?? null) out.unshift(c);
    return out.slice(1).map(([x, y]) => [x + 0.5, y + 0.5] as [number, number]);
  }

  function walkPath(p: [number, number][]) {
    return new Promise<void>((resolve) => {
      clearTimeout(idleTimer);
      if (!p.length) return resolve();
      if (reduced) {
        live = [...p[p.length - 1]];
        pos = [...live];
        return resolve();
      }
      arrived?.();
      arrived = resolve;
      path = p;
      walking = true;
      cancelAnimationFrame(raf);
      last = performance.now();
      raf = requestAnimationFrame(tick);
    });
  }

  function walkTo(tx: number, ty: number) {
    if (!live || blocked.has(`${tx},${ty}`)) return false;
    const p = routeToAny([[tx, ty]]);
    if (!p || !p.length) return false;
    walkPath(p).then(() => { if (!acting) scheduleIdle(); });
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
    const a = arrived;
    arrived = null;
    a?.();
  }
  function stopWalk() {
    halt();
    if (live) pos = [...live];
  }
  function scheduleIdle() {
    clearTimeout(idleTimer);
    if (reduced) return;
    idleTimer = setTimeout(wander, 2500 + Math.random() * 5000);
  }
  function wander() {
    if (!live || G.edit || acting || menu || document.hidden || G.sheet === 'feed') return scheduleIdle();
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
    if (G.edit) { halt(); untrack(() => (menu = null)); }
    else untrack(() => scheduleIdle());
  });

  onMount(() => scheduleIdle());
  onDestroy(() => halt());

  /* ---------------- aktivitas di rumah ---------------- */

  type Target = { index?: number; spot?: RoomSpot };
  let menu = $state<null | { x: number; y: number; title: string; acts: any[]; target: Target }>(null);

  function activitiesFor(t: Target) {
    const list = G.catalog?.activities ?? [];
    if (t.spot) return theme === 'luar' ? [] : list.filter((a: any) => activityFits(a.targets, null, t.spot));
    const it = item(layout[t.index!]?.i);
    return list.filter((a: any) => activityFits(a.targets, it as any));
  }

  function goalsFor(t: Target): { goals: [number, number][]; center: [number, number] | null; faceTo: [number, number] | null; flipTo: boolean | null } {
    if (t.spot) return { goals: [...ROOM_SPOTS[t.spot].tiles(size)], center: null, faceTo: null, flipTo: ROOM_SPOTS[t.spot].flip };
    const p = layout[t.index!];
    const f = footprint(item(p?.i));
    const goals: [number, number][] = [];
    for (let a = 0; a < f.w; a++) goals.push([p.x + a, p.y - 1], [p.x + a, p.y + f.d]);
    for (let b = 0; b < f.d; b++) goals.push([p.x - 1, p.y + b], [p.x + f.w, p.y + b]);
    if (f.flat) for (let a = 0; a < f.w; a++) for (let b = 0; b < f.d; b++) goals.push([p.x + a, p.y + b]);
    const center: [number, number] = [p.x + f.w / 2, p.y + f.d / 2];
    return { goals, center, faceTo: center, flipTo: null };
  }

  function openMenu(e: MouseEvent, t: Target) {
    if (acting) return;
    const acts = activitiesFor(t);
    const title = t.spot ? ACTIVITY_SPOTS[t.spot] : item(layout[t.index!]?.i)?.name ?? 'Mebel';
    if (!acts.length) {
      // belum ada aktivitas untuk mebel ini: pet tetap menghampirinya
      const g = goalsFor(t);
      const p = routeToAny(g.goals);
      if (p) { sfx.tap(); walkPath(p).then(() => !acting && scheduleIdle()); }
      return;
    }
    sfx.tap();
    const r = wrapEl!.getBoundingClientRect();
    menu = { x: e.clientX - r.left, y: e.clientY - r.top, title, acts, target: t };
  }

  const cdLeft = (id: string) => Math.max(0, Math.ceil(((G.cool['act:' + id] ?? 0) - G.now) / 1000));
  const fmtCd = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)} j ${Math.ceil((s % 3600) / 60)} mnt` : s >= 60 ? `${Math.ceil(s / 60)} mnt` : `${s} dtk`);

  async function doActivity(a: any, t: Target) {
    menu = null;
    if (acting || G.busy) return;
    if ((a.min_level ?? 1) > G.me.pet.level) { sfx.error(); toast(`Terbuka di Lv ${a.min_level}.`, 'error'); return; }
    const anim = ACTIVITY_ANIMS[a.anim] ?? ACTIVITY_ANIMS.lihat;
    const g = goalsFor(t);
    acting = true;
    clearTimeout(idleTimer);
    // permintaan ke server berjalan bersamaan dengan pet berjalan, supaya terasa cepat
    const req = run(() => post('/api/activity', { activityId: a.id, roomId: room?.id || undefined, ...(t.spot ? { spot: t.spot } : { index: t.index }) }));
    const p = routeToAny(g.goals);
    if (p) await walkPath(p);
    const r: any = await req;
    if (!r) { acting = false; scheduleIdle(); return; }
    G.cool['act:' + a.id] = Date.now() + (r.result?.cooldownSec ?? a.cooldown_sec ?? 0) * 1000;
    const standAt: [number, number] | null = live ? [...live] : null;
    if (g.faceTo && live) { const sx = (g.faceTo[0] - live[0]) - (g.faceTo[1] - live[1]); if (Math.abs(sx) > 0.01) flip = sx < 0; }
    if (g.flipTo !== null) flip = g.flipTo;
    if (anim.on && g.center) { live = [...g.center]; pos = [...g.center]; }
    pose = { pose: a.anim, prop: anim.prop, lift: anim.on ? anim.lift : 0 };
    queueMicrotask(place);
    const beats = Math.max(1, Math.round(anim.ms / 800));
    for (let i = 0; i < beats; i++) { fx(anim.fx as any); if (i === 0) (a.anim === 'tidur' ? sfx.tap : sfx.pop)(); await sleep(anim.ms / beats); }
    pose = null;
    if (anim.on && standAt) { live = standAt; pos = [...standAt]; }
    queueMicrotask(place);
    const res = r.result ?? {};
    const extra = [res.coins ? `+${res.coins} koin` : '', res.item ? `dapat ${item(res.item)?.name ?? 'barang'}` : ''].filter(Boolean).join(', ');
    toast(`${res.message ?? a.name}${extra ? ` (${extra})` : ''}`, 'good');
    if (res.coins) sfx.coin();
    if (res.levelUp) { sfx.level(); toast(`Naik ke Lv ${res.levelUp}!`, 'good'); }
    acting = false;
    scheduleIdle();
  }

  /* ---------------- interaksi ---------------- */

  function click(e: MouseEvent) {
    const t = e.target as Element;
    if (menu) { menu = null; if (!t.closest('.furn, .spot')) return; }
    if (t.closest('.pet')) return tapPet();
    if (mode === 'home' && G.edit) {
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
    if (acting) return;
    if (mode === 'home') {
      const f = t.closest('.furn') as SVGElement | null;
      if (f) return openMenu(e, { index: Number(f.dataset.i) });
      const sp = t.closest('.spot') as SVGElement | null;
      if (sp && sp.dataset.spot && sp.dataset.spot in ROOM_SPOTS) return openMenu(e, { spot: sp.dataset.spot as RoomSpot });
    }
    // ketuk lantai: pet berjalan ke sana
    const fl = t.closest('.fl') as SVGElement | null;
    if (fl && walkTo(Number(fl.dataset.x), Number(fl.dataset.y))) sfx.tap();
  }

  async function tapPet() {
    const now = Date.now();
    if (now - lastTap < 600 || acting) return;
    lastTap = now;
    if (walking) { stopWalk(); scheduleIdle(); }
    fx('hearts');
    sfx.pop();
    if (mode === 'home' && !G.edit) await run(() => post('/api/action', { type: 'elus' }));
  }

  function key(e: KeyboardEvent) { if (e.key === 'Escape' && menu) menu = null; }

  // efek melayang (hati, gelembung, koin, zzz, ...) di atas kepala pet
  $effect(() => {
    const n = G.fx;
    if (!n || !svgEl || !fxLayer) return;
    const pet = svgEl.querySelector('.pet');
    if (!pet) return;
    const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(pet.getAttribute('transform') ?? '');
    if (!m) return;
    const x = +m[1], y = +m[2] - 74;
    const hop = pet.querySelector('.pet-hop');
    if (!untrack(() => pose)) {
      hop?.classList.remove('go');
      void (hop as any)?.getBBox?.();
      hop?.classList.add('go');
    }
    const shapes: Record<string, () => string> = {
      hearts: () => '<path d="M0 4C-8 -4-14 2-7 9L0 15 7 9C14 2 8 -4 0 4Z" fill="#FF6B8A" stroke="#2B2F4A" stroke-width="2"/>',
      bubbles: () => `<circle r="${5 + Math.random() * 5}" fill="#DDF3FF" stroke="#2B2F4A" stroke-width="1.8"/>`,
      coins: () => '<circle r="8" fill="#F2B632" stroke="#2B2F4A" stroke-width="2"/><circle r="4" fill="none" stroke="#B9800F" stroke-width="1.6"/>',
      zz: () => '<text font-family="Baloo 2,sans-serif" font-weight="800" font-size="20" fill="#FFFDF7" stroke="#2B2F4A" stroke-width="1.2">Z</text>',
      food: () => '<circle r="5" fill="#F2C94C" stroke="#2B2F4A" stroke-width="1.6"/>',
      sparkle: () => '<path d="M0 -9L2.4 -2.4 9 0 2.4 2.4 0 9-2.4 2.4-9 0-2.4 -2.4Z" fill="#FFE07A" stroke="#2B2F4A" stroke-width="1.6" stroke-linejoin="round"/>',
      drops: () => '<path d="M0 -8C4 -2 6 2 6 5A6 6 0 0 1 -6 5C-6 2 -4 -2 0 -8Z" fill="#7FC4E8" stroke="#2B2F4A" stroke-width="1.6"/>',
      notes: () => '<path d="M-3 6V-8L7 -10V4" fill="none" stroke="#2B2F4A" stroke-width="2.2"/><ellipse cx="-6" cy="6" rx="4" ry="3" fill="#9A6FC0" stroke="#2B2F4A" stroke-width="1.6"/><ellipse cx="4" cy="4" rx="4" ry="3" fill="#9A6FC0" stroke="#2B2F4A" stroke-width="1.6"/>',
      steam: () => '<path d="M0 8q-6 -6 0 -12t0 -12" fill="none" stroke="#FFFDF7" stroke-width="4" stroke-linecap="round"/><path d="M0 8q-6 -6 0 -12t0 -12" fill="none" stroke="#9AA7B8" stroke-width="2" stroke-linecap="round"/>',
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

  // potret: perbesar ruangan agar memenuhi layar HP (ruangan kecil diperbesar, halaman besar diperkecil)
  const viewBox = $derived(G.portrait ? '172 -40 456 440' : ROOM_VIEWBOX);
  const menuStyle = $derived.by(() => {
    if (!menu || !wrapEl) return '';
    const w = wrapEl.clientWidth, h = wrapEl.clientHeight;
    const left = Math.max(8, Math.min(w - 248, menu.x - 120));
    const top = menu.y > h * 0.55 ? Math.max(8, menu.y - 18 - 64 * menu.acts.length - 40) : Math.min(h - 80, menu.y + 18);
    return `left:${left}px;top:${top}px`;
  });
</script>

<svelte:window onkeydown={key} />
<div class="roomwrap" bind:this={wrapEl}>
  <svg bind:this={svgEl} class="room" class:walking class:acting={!!pose} class:home={mode === 'home' && !G.edit} {viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={mode === 'visit' ? 'Rumah teman' : `Rumahmu: ${room?.name ?? 'Kamar'}`} onclick={click}>
    {@html html}
    <g bind:this={fxLayer} pointer-events="none"></g>
  </svg>
  {#if menu}
    <div class="menu" style={menuStyle} role="menu" aria-label="Aktivitas {menu.title}">
      <b>{menu.title}</b>
      {#each menu.acts as a (a.id)}
        {@const cd = cdLeft(a.id)}
        {@const lock = (a.min_level ?? 1) > G.me.pet.level}
        <button class="btn sm" role="menuitem" disabled={cd > 0 || lock || G.busy} onclick={() => doActivity(a, menu!.target)}>
          <span class="nm">{a.name}</span>
          <span class="ef">{lock ? `Lv ${a.min_level}` : cd > 0 ? fmtCd(cd) : effText(a.effects) || (a.coins ? `+${a.coins} koin` : '')}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .roomwrap { position: absolute; inset: 0; }
  .room { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: manipulation; }
  .room :global(.fl) { cursor: pointer; }
  .room.home :global(.furn), .room.home :global(.spot) { cursor: pointer; }
  .room.home :global(.furn:hover), .room.home :global(.spot:hover) { filter: brightness(1.06); }
  .room.walking :global(.pet-bob) { animation: waddle 0.3s ease-in-out infinite alternate; }
  @keyframes waddle {
    from { transform: rotate(-6deg) translateY(0); }
    to { transform: rotate(6deg) translateY(-4px); }
  }
  .menu { position: absolute; z-index: 12; width: 240px; display: flex; flex-direction: column; gap: 6px; background: var(--paper); border: 2.5px solid var(--ink); border-radius: 16px; box-shadow: 0 4px 0 var(--ink); padding: 8px; animation: pop .18s ease-out; }
  .menu b { font-size: 15px; padding: 0 4px; }
  .menu .btn { justify-content: space-between; width: 100%; gap: 8px; }
  .menu .nm { font-weight: 800; }
  .menu .ef { font-size: 12px; font-weight: 700; color: var(--muted); white-space: normal; text-align: right; }
  @media (prefers-reduced-motion: reduce) { .room.walking :global(.pet-bob) { animation: none; } }
</style>
