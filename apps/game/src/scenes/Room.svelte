<script lang="ts">
  import { onDestroy, onMount, untrack } from 'svelte';
  import { fits, renderRoom, ROOM_VIEWBOX, occupied, petSpot, roomGeom, footprint, ROOM_SPOTS, ACTIVITY_ANIMS, ACTIVITY_SPOTS, activityFits, mulberry32, photoScene, type RoomSpot } from '@kb/shared';
  import { H, enterHouse, leaveHouse, bubble as hbubble, emote as hemote, ACT_SAY } from '../lib/house.svelte';
  import { EMOTE_ICON } from '../lib/houseArt';
  import { api } from '../lib/api';
  import { G, items, item, wearItems, run, post, fx, toast, activeDecor, curRoom, effText, petLook, isSleeping, setSleep, sayLine, settings, serverNow } from '../lib/game.svelte';
  import { sfx } from '../lib/sfx';

  let { mode = 'home' }: { mode?: 'home' | 'visit' } = $props();
  let svgEl: SVGSVGElement | undefined = $state();
  let wrapEl: HTMLDivElement | undefined = $state();
  let fxLayer: SVGGElement | undefined = $state();
  let foamLayer: SVGGElement | undefined = $state();
  let lastTap = 0;

  const room = $derived<any>(mode === 'visit' ? (G.visit?.rooms?.[G.visitRoom] ?? G.visit?.room ?? { layout: [] }) : curRoom());
  const size = $derived<number>(room?.size ?? G.catalog?.settings?.room?.size ?? 6);
  const theme = $derived<string>(room?.theme ?? 'dalam');
  const geom = $derived(roomGeom(size));
  const itemMap = $derived(Object.fromEntries(items()));
  const layout = $derived<any[]>(mode === 'visit' ? (room?.layout ?? []) : G.edit && G.draft ? G.draft : (room?.layout ?? []));
  const blocked = $derived(occupied(layout, itemMap));
  const petData = $derived<any>(mode === 'visit' ? G.visit?.pet : G.me.pet);
  const asleep = $derived(!!petData && G.now > 0 && isSleeping(petData));
  const homeLive = $derived(mode === 'home' && !G.edit);
  // berkunjung saat tuan rumah juga ada di rumahnya: pet tuan rumah digerakkan pemiliknya (dari sinkron)
  const hostMember = $derived(mode === 'visit' ? H.members.find((m) => m.host) ?? null : null);
  const hideMain = $derived(!!hostMember);

  /* ---------------- pet berjalan ---------------- */
  // `pos` dipakai saat menggambar ulang ruangan (hanya saat pet pindah petak, untuk urutan kedalaman);
  // `live` diperbarui setiap frame dan langsung menggeser elemen pet.
  let pos = $state<[number, number] | null>(null);
  let flip = $state(false);
  let walking = $state(false);
  /** pose saat beraktivitas / tidur (tidur di kasur, membaca, ...) */
  let pose = $state<{ pose: string; prop?: string; lift: number } | null>(null);
  let acting = $state(false);
  let live: [number, number] | null = null;
  let path: [number, number][] = [];
  let raf = 0;
  let idleTimer: any;
  let last = 0;
  let arrived: (() => void) | null = null;
  let shownRoom = '';
  let bedSpot: [number, number] | null = null;
  const SPEED = 1.3; // petak per detik
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tileOf = (p: [number, number]) => `${Math.floor(p[0])},${Math.floor(p[1])}`;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, reduced ? Math.min(ms, 400) : ms));

  // pastikan pet selalu di petak kosong (mis. setelah mebel dipindah ke tempatnya, atau pindah ruangan)
  $effect(() => {
    const b = blocked, sz = size, lay = layout, rid = room?.id ?? '';
    const cur = untrack(() => pos);
    const moved = rid !== shownRoom;
    if (moved || (!untrack(() => acting) && !untrack(() => bedSpot) && (!cur || cur[0] >= sz || cur[1] >= sz || b.has(tileOf(cur))))) {
      shownRoom = rid;
      halt();
      untrack(() => { pose = null; acting = false; menu = null; bedSpot = null; });
      const spot = petSpot(lay, itemMap, sz);
      pos = spot;
      live = [...spot];
      if (untrack(() => asleep)) queueMicrotask(() => goToBed(true));
    }
  });

  // keadaan tubuh yang digambar: wajah sesuai kebutuhan, noda kotor (berkurang saat digosok), gembul
  const look = $derived.by(() => {
    const l = petLook(petData);
    if (!l) return undefined;
    if (mode === 'home' && G.bath) return { ...l, dirt: l.dirt * (1 - G.bath.scrub) };
    return l;
  });

  /* ---------------- remah & bulu rontok ---------------- */
  let swept = $state<Set<number>>(new Set());
  const crumbCount = $derived.by(() => {
    const c = settings().crumbs;
    const at = G.me?.pet?.crumbsAt;
    if (mode !== 'home' || !c || !at) return 0;
    return Math.max(0, Math.min(c.max, Math.floor((serverNow() - at) / (c.everyMinutes * 60_000))));
  });
  const crumbs = $derived.by(() => {
    if (!crumbCount || G.edit) return [];
    const r = mulberry32(Math.floor((G.me.pet.crumbsAt ?? 0) / 1000) ^ size);
    const free: [number, number][] = [];
    for (let x = 0; x < size; x++) for (let y = 0; y < size; y++) if (!blocked.has(`${x},${y}`)) free.push([x, y]);
    const out: { x: number; y: number; k: string; c?: string; i: number }[] = [];
    for (let i = 0; i < crumbCount && free.length; i++) {
      const [x, y] = free.splice(Math.floor(r() * free.length), 1)[0];
      const k = theme === 'luar' ? (r() < 0.5 ? 'daun' : 'bulu') : r() < 0.55 ? 'remah' : 'bulu';
      out.push({ x: x + 0.3 + r() * 0.4, y: y + 0.3 + r() * 0.4, k, c: G.me.pet.color, i });
    }
    return out.filter((c) => !swept.has(c.i));
  });
  $effect(() => { void G.me?.pet?.crumbsAt; untrack(() => (swept = new Set())); });

  async function sweepCrumb(i: number, e: MouseEvent) {
    if (swept.has(i)) return;
    swept = new Set([...swept, i]);
    sfx.tap();
    spawnAt(e.clientX, e.clientY, 'sparkle');
    const r: any = await run(() => post('/api/sweep'));
    if (r) toast(r.coins ? `Lantai bersih! +${r.coins} koin` : 'Lantai bersih!', 'good');
    if (r?.coins) sfx.coin();
  }

  // foto bareng yang dipajang di lukisan dinding
  const photoSvg = $derived.by(() => {
    const ph = mode === 'visit' ? G.visit?.photo : G.me?.photo;
    if (!ph?.members?.length || theme === 'luar') return '';
    return photoScene(ph.members.filter((m: any) => m.pet).map((m: any) => ({ look: m.pet, wear: wearItems(m.pet.wear), state: m.pet.state })), ph.pose);
  });
  const html = $derived.by(() => {
    const p = pos ?? undefined;
    void compVer;
    return renderRoom({
      layout, items: itemMap, wall: item(room?.wall), floor: item(room?.floor), size, theme,
      pet: petData && !hideMain ? { look: petData, wear: wearItems(petData.wear), pos: p, flip, lift: pose?.lift, pose: pose?.pose, prop: mode === 'home' && G.bath ? 'baskom' : pose?.prop, state: look } : null,
      edit: mode === 'home' && G.edit, sel: G.sel, decor: activeDecor(), crumbs, photo: photoSvg,
      others: [...comps.values()].map((c) => ({ id: c.id, look: c.look, wear: c.wear, pos: c.live, flip: c.flip, pose: c.pose, state: c.state })),
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
    return live ? routeFrom(live, goals) : null;
  }
  function routeFrom(at: [number, number], goals: [number, number][]) {
    const key = (x: number, y: number) => `${x},${y}`;
    const want = new Set(goals.filter(([x, y]) => x >= 0 && y >= 0 && x < size && y < size && !blocked.has(key(x, y))).map(([x, y]) => key(x, y)));
    if (!want.size) return null;
    const from: [number, number] = [Math.floor(at[0]), Math.floor(at[1])];
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
    if (!live || hideMain || G.edit || acting || menu || asleep || G.bath || G.feedDrag || document.hidden || G.sheet === 'feed') return scheduleIdle();
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

  // mode atur & mandi: pet diam supaya mudah ditata / digosok
  $effect(() => {
    if (G.edit || G.bath) { halt(); untrack(() => (menu = null)); }
    else untrack(() => scheduleIdle());
  });

  onMount(() => scheduleIdle());
  onDestroy(() => { halt(); clearInterval(talkTimer); cancelAnimationFrame(bubbleRaf); });

  /* ---------------- pet lain di ruangan: tamu yang sedang live & pet sendiri saat berkunjung ---------------- */
  type Comp = { id: string; name: string; look: any; wear: any[]; state?: any; live: [number, number]; tile: string; path: [number, number][]; speed: number; flip: boolean; pose?: string; target: string; self?: boolean };
  const SELF = '__me';
  const comps = new Map<string, Comp>();
  const missing = new Map<string, number>();
  let compVer = $state(0);
  let compRaf = 0, compLast = 0;
  let selfBusy = false;
  const clampT = (v: number) => Math.max(0.5, Math.min(size - 0.5, v));

  function placeComp(c: Comp) {
    const el = svgEl?.querySelector(`[data-o="${c.id}"]`) as SVGGElement | null;
    if (!el) return;
    const [x, y] = geom.point(c.live[0], c.live[1]);
    el.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${geom.petScale})`);
    el.querySelector('.pet-face')?.setAttribute('transform', c.flip ? 'scale(-1 1)' : '');
    el.classList.toggle('moving', c.path.length > 0);
  }
  function compTick(now: number) {
    const dt = Math.min(0.05, (now - compLast) / 1000);
    compLast = now;
    let moving = false, retile = false;
    for (const c of comps.values()) {
      if (!c.path.length) continue;
      moving = true;
      const [tx, ty] = c.path[0];
      const dx = tx - c.live[0], dy = ty - c.live[1], d = Math.hypot(dx, dy), step = c.speed * dt;
      const sx = dx - dy;
      if (Math.abs(sx) > 0.01) c.flip = sx < 0;
      if (d <= step) { c.live = [tx, ty]; c.path.shift(); } else c.live = [c.live[0] + (dx / d) * step, c.live[1] + (dy / d) * step];
      const tk = tileOf(c.live);
      if (tk !== c.tile) { c.tile = tk; retile = true; }
      placeComp(c);
    }
    if (retile) compVer++;
    compRaf = moving ? requestAnimationFrame(compTick) : 0;
    if (!moving) for (const c of comps.values()) placeComp(c);
  }
  function compGo() { if (!compRaf) { compLast = performance.now(); compRaf = requestAnimationFrame(compTick); } }
  function compWalk(c: Comp, goals: [number, number][], speed = 1.6) {
    const p = routeFrom(c.live, goals);
    if (!p || !p.length) return Promise.resolve(false);
    c.path = p; c.speed = speed;
    compGo();
    return new Promise<boolean>((res) => { const t0 = Date.now(); const chk = () => (c.path.length && Date.now() - t0 < 8000 ? setTimeout(chk, 90) : res(true)); chk(); });
  }
  const freeTiles = () => { const out: [number, number][] = []; for (let x = 0; x < size; x++) for (let y = 0; y < size; y++) if (!blocked.has(`${x},${y}`)) out.push([x, y]); return out; };
  /** petak yang sedang ditempati pet lain (supaya tidak bertumpuk) */
  const takenTiles = (except: string) => { const t = new Set<string>(); for (const c of comps.values()) if (c.id !== except) { t.add(tileOf(c.live)); if (c.path.length) t.add(tileOf(c.path[c.path.length - 1])); } if (live && !hideMain) t.add(tileOf(live)); return t; };
  /** petak kosong di sekitar pet tuan rumah (jarak 1–3), acak */
  function spotNearHost(except: string, min = 1, max = 3) {
    const h = hostAt();
    const taken = takenTiles(except);
    const near = freeTiles().filter(([x, y]) => {
      if (taken.has(`${x},${y}`)) return false;
      if (!h) return true;
      const d = Math.abs(x + 0.5 - h[0]) + Math.abs(y + 0.5 - h[1]);
      return d >= min && d <= max;
    });
    const pool = near.length ? near : freeTiles().filter(([x, y]) => !taken.has(`${x},${y}`));
    return pool[Math.floor(Math.random() * pool.length)] ?? null;
  }
  /** posisi pet tuan rumah (dari sinkron bila ia sedang di rumah, selain itu pet utama) */
  const hostAt = (): [number, number] | null => (hostMember ? comps.get(hostMember.id)?.live ?? null : live);

  // pet sendiri ikut berkunjung
  function ensureSelf() {
    if (mode !== 'visit' || !G.me?.pet || comps.has(SELF)) return;
    const t = spotNearHost(SELF, 1, 3) ?? [size - 1, size - 1];
    const at: [number, number] = [t[0] + 0.5, t[1] + 0.5];
    comps.set(SELF, { id: SELF, name: G.me.pet.name, look: G.me.pet, wear: wearItems(G.me.pet.wear), state: petLook(G.me.pet), live: at, tile: tileOf(at), path: [], speed: 1.6, flip: true, target: '', self: true });
    compVer++;
  }
  $effect(() => { void G.visit?.owner?.id; void size; untrack(() => { if (mode === 'visit') { comps.delete(SELF); ensureSelf(); } }); });
  // tamu (atau tuan rumah) yang sedang live
  $effect(() => {
    const ms = H.members;
    void size;
    untrack(() => {
      let changed = false;
      const keep = new Set([SELF]);
      for (const m of ms) {
        if (!m.pet) continue;
        keep.add(m.id);
        const tgt: [number, number] = [clampT(m.x), clampT(m.y)];
        let c = comps.get(m.id);
        if (!c) { c = { id: m.id, name: m.name, look: m.pet, wear: wearItems(m.pet.wear), state: m.pet.state, live: [...tgt], tile: tileOf(tgt), path: [], speed: 1.7, flip: m.flip, target: '' }; comps.set(m.id, c); changed = true; }
        else { c.look = m.pet; c.state = m.pet.state; c.name = m.name; c.wear = wearItems(m.pet.wear); }
        const pz = m.act === 'duduk' ? 'duduk' : undefined;
        if (pz !== c.pose) { c.pose = pz; changed = true; }
        const tk = `${tgt[0].toFixed(2)},${tgt[1].toFixed(2)}`;
        if (tk !== c.target) {
          c.target = tk;
          const d = Math.hypot(tgt[0] - c.live[0], tgt[1] - c.live[1]);
          if (d > 5) { c.live = [...tgt]; c.path = []; c.tile = tileOf(tgt); changed = true; }
          else if (d > 0.05) { c.path = [tgt]; c.speed = Math.max(1.7, d / 0.9); compGo(); }
          else if (!c.path.length) c.flip = m.flip;
        }
      }
      // yang tidak muncul di satu-dua sinkron jangan langsung dihapus (sinyal lemah); baru setelah ±2,5 detik
      const now = Date.now();
      for (const id of keep) missing.delete(id);
      for (const id of [...comps.keys()]) {
        if (keep.has(id)) continue;
        const since = missing.get(id) ?? now;
        missing.set(id, since);
        if (now - since > 2500) { comps.delete(id); missing.delete(id); changed = true; }
      }
      if (changed) compVer++;
    });
  });
  // pet sendiri jalan-jalan di dekat pet teman saat diam
  let selfWander: any;
  onMount(() => {
    selfWander = setInterval(() => {
      const me = comps.get(SELF);
      if (!me || selfBusy || me.path.length || document.hidden || Math.random() < 0.4) return;
      const pick = spotNearHost(SELF, 1, 3);
      if (pick) compWalk(me, [pick]);
    }, 4500);
    // laporkan posisi pet ke rumah live
    const rep = setInterval(() => {
      const me = comps.get(SELF);
      if (mode === 'visit' && me) { H.pos.x = +me.live[0].toFixed(2); H.pos.y = +me.live[1].toFixed(2); H.pos.flip = me.flip; H.pos.act = me.pose ?? (me.path.length ? 'jalan' : H.pos.act === 'jalan' ? null : H.pos.act); }
      else if (mode === 'home' && live) { H.pos.x = +live[0].toFixed(2); H.pos.y = +live[1].toFixed(2); H.pos.flip = flip; H.pos.act = pose?.pose === 'duduk' ? 'duduk' : walking ? 'jalan' : null; }
    }, 200);
    return () => { clearInterval(selfWander); clearInterval(rep); cancelAnimationFrame(compRaf); };
  });
  // masuk rumah live (tamu: rumah teman; tuan rumah: rumah sendiri)
  let entered = '';
  $effect(() => {
    const hid = mode === 'visit' ? G.visit?.owner?.id : G.me?.user?.id;
    const rid = room?.id ?? '';
    if (!hid || (mode === 'visit' && G.visit?.together && !G.visit.together.on)) return;
    untrack(() => { enterHouse(hid, rid); entered = hid; });
  });
  onDestroy(() => { if (entered && H.hostId === entered) leaveHouse(); });

  function fxAtComp(id: string, kind: string, hop = true) {
    const el = svgEl?.querySelector(`[data-o="${id}"]`);
    const m = el && /translate\(([-\d.]+) ([-\d.]+)\)/.exec(el.getAttribute('transform') ?? '');
    if (m) spawn(+m[1], +m[2] - 74, kind);
    if (hop) { const h = el?.querySelector('.pet-hop'); h?.classList.remove('go'); void (h as any)?.getBBox?.(); h?.classList.add('go'); }
  }
  const hostFx = (kind: string) => (hostMember ? fxAtComp(hostMember.id, kind) : fx(kind as any));
  const hostWho = () => (G.visit?.owner?.id ?? 'host');

  /** Main dengan pet teman: pet sendiri menghampiri, beraksi, lalu hasilnya dari server. */
  async function doVisitAct(kind: string, itemId?: string) {
    const me = comps.get(SELF);
    if (mode !== 'visit' || !me || selfBusy || !G.visit) return;
    selfBusy = true;
    const req = run(() => api.post(`/api/visit/${G.visit.owner.id}/act`, { kind, itemId }));
    const h = hostAt();
    if (h) {
      const hx = Math.floor(h[0]), hy = Math.floor(h[1]);
      const taken = takenTiles(SELF);
      const side = ([[hx + 1, hy], [hx, hy + 1], [hx - 1, hy], [hx, hy - 1]] as [number, number][]).filter(([x, y]) => !taken.has(`${x},${y}`));
      await compWalk(me, side.length ? side : [[hx + 1, hy], [hx, hy + 1], [hx - 1, hy], [hx, hy - 1]]);
      const sx = (h[0] - me.live[0]) - (h[1] - me.live[1]);
      if (Math.abs(sx) > 0.01) { me.flip = sx < 0; placeComp(me); }
    }
    H.pos.act = kind;
    hbubble(H.me || 'me', { text: ACT_SAY[kind] ?? 'Halo!' }, 2600);
    if (kind === 'kejar') {
      for (let i = 0; i < 3; i++) {
        const far = freeTiles().filter(([x, y]) => Math.abs(x + 0.5 - me.live[0]) + Math.abs(y + 0.5 - me.live[1]) >= 2);
        const pick = far[Math.floor(Math.random() * far.length)];
        if (!hideMain && pick) { const t2 = freeTiles()[Math.floor(Math.random() * freeTiles().length)]; if (t2) walkTo(t2[0], t2[1]); }
        if (pick) await compWalk(me, [pick], 2.8);
      }
    } else if (kind === 'duduk') {
      me.pose = 'duduk'; compVer++;
      await sleep(2400);
      me.pose = undefined; compVer++;
    } else await sleep(500);
    fxAtComp(SELF, kind === 'camilan' ? 'food' : 'hearts');
    const r: any = await req;
    if (r) {
      if (r.hostPet && G.visit) G.visit.pet = r.hostPet;
      if (G.visit?.together) G.visit.together.left = r.left;
      hostFx(kind === 'camilan' ? 'food' : 'hearts');
      const say: Record<string, string> = { sapa: `Halo, ${G.me.pet.name}!`, peluk: 'Hehe, hangat!', camilan: 'Nyam! Makasih!', kejar: 'Hahaha, capek!', duduk: 'Enak ya, santai.' };
      setTimeout(() => hbubble(hostWho(), { text: say[kind] ?? 'Hehe!' }, 2800), 300);
      sfx.pop();
      toast(r.rewarded ? `+${r.coins} koin${r.xp ? `, +${r.xp} XP` : ''} · sisa main berhadiah ${r.left}` : 'Seru! Hadiah main dengan teman ini sudah habis hari ini.', 'good');
      if (r.coins) sfx.coin();
      if (r.levelUp) { sfx.level(); toast(`Naik ke Lv ${r.levelUp}!`, 'good'); }
    }
    H.pos.act = null;
    selfBusy = false;
  }
  $effect(() => { const q = H.actReq; if (q) untrack(() => { H.actReq = null; doVisitAct(q.kind, q.itemId); }); });

  /* ---------------- gelembung obrolan & label nama di atas pet ---------------- */
  let tags = $state<{ id: string; x: number; y: number; name: string; self: boolean }[]>([]);
  let bpos = $state<Record<string, { x: number; y: number }>>({});
  function rectOf(who: string) {
    const meId = H.me || 'me';
    let el: Element | null | undefined = null;
    if (who === meId || who === 'me') el = mode === 'visit' ? svgEl?.querySelector(`[data-o="${SELF}"]`) : petEl();
    else if (mode === 'visit' && (who === G.visit?.owner?.id || who === 'host')) el = hostMember ? svgEl?.querySelector(`[data-o="${hostMember.id}"]`) : petEl();
    else el = svgEl?.querySelector(`[data-o="${who}"]`);
    return el?.getBoundingClientRect() ?? null;
  }
  $effect(() => {
    const t = setInterval(() => {
      const w = wrapEl?.getBoundingClientRect();
      if (!w) return;
      const bp: Record<string, { x: number; y: number }> = {};
      for (const b of H.bubbles) {
        const r = rectOf(b.who);
        if (r) bp[b.who] = { x: Math.max(70, Math.min(w.width - 70, r.left + r.width / 2 - w.left)), y: Math.max(48, r.top - w.top + 6) };
      }
      bpos = bp;
      const tg: typeof tags = [];
      for (const c of comps.values()) {
        const el = svgEl?.querySelector(`[data-o="${c.id}"]`);
        const r = el?.getBoundingClientRect();
        if (r) tg.push({ id: c.id, x: r.left + r.width / 2 - w.left, y: r.bottom - w.top + 2, name: c.self ? `${c.name} (kamu)` : c.name, self: !!c.self });
      }
      // label nama yang bertumpuk digeser ke bawah supaya tetap terbaca
      tg.sort((a, b) => a.y - b.y);
      for (let i = 1; i < tg.length; i++) for (let j = 0; j < i; j++) if (Math.abs(tg[i].x - tg[j].x) < 76 && Math.abs(tg[i].y - tg[j].y) < 19) tg[i].y = tg[j].y + 19;
      tags = tg;
    }, 80);
    return () => clearInterval(t);
  });

  /* ---------------- tidur dengan lampu mati ---------------- */

  /** Pet naik ke kasur di ruangan ini (bila ada) lalu tidur; tanpa kasur tidur di lantai. */
  async function goToBed(instant = false) {
    if (!live) return;
    halt();
    menu = null;
    const bed = layout.map((p, i) => ({ p, i, it: item(p.i) })).find((e) => e.it?.art?.type === 'builtin' && e.it.art.key === 'kasur');
    if (bed) {
      const f = footprint(bed.it);
      const goals: [number, number][] = [];
      for (let a = 0; a < f.w; a++) goals.push([bed.p.x + a, bed.p.y - 1], [bed.p.x + a, bed.p.y + f.d]);
      for (let b = 0; b < f.d; b++) goals.push([bed.p.x - 1, bed.p.y + b], [bed.p.x + f.w, bed.p.y + b]);
      if (!instant) { const p = routeToAny(goals); if (p) await walkPath(p); }
      if (!untrack(() => asleep)) return;
      bedSpot = live ? [...live] as [number, number] : null;
      const c: [number, number] = [bed.p.x + f.w / 2, bed.p.y + f.d / 2];
      live = [...c]; pos = [...c];
      pose = { pose: 'tidur', lift: ACTIVITY_ANIMS.tidur.lift };
    } else pose = { pose: 'tidur', lift: 0 };
    queueMicrotask(place);
  }
  function wakeUp() {
    pose = null;
    if (bedSpot) { live = [...bedSpot]; pos = [...bedSpot]; bedSpot = null; }
    queueMicrotask(place);
    scheduleIdle();
  }
  let wasAsleep = false;
  $effect(() => {
    const a = asleep;
    if (a === wasAsleep) return;
    wasAsleep = a;
    untrack(() => (a ? goToBed() : wakeUp()));
  });
  // dengkur halus selama tidur
  $effect(() => {
    if (!asleep) return;
    const t = setInterval(() => fx('zz'), 2600);
    return () => clearInterval(t);
  });

  /* ---------------- aktivitas di rumah ---------------- */

  type Target = { index?: number; spot?: RoomSpot };
  let menu = $state<null | { x: number; y: number; title: string; acts: any[]; target: Target }>(null);
  const SLEEP_ACT = { id: '__sleep', name: 'Tidur sampai segar', effects: {}, cooldown_sec: 0, note: 'Matikan lampu' };

  function activitiesFor(t: Target) {
    const list = G.catalog?.activities ?? [];
    if (t.spot) return theme === 'luar' ? [] : list.filter((a: any) => activityFits(a.targets, null, t.spot));
    const it = item(layout[t.index!]?.i);
    const acts = list.filter((a: any) => activityFits(a.targets, it as any));
    // kasur & lampu: matikan lampu untuk tidur sungguhan
    const key = it?.art?.type === 'builtin' ? it.art.key : '';
    return key === 'kasur' || key === 'lampu' ? [SLEEP_ACT, ...acts] : acts;
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
    if (a.id === '__sleep') { await setSleep(true); return; }
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

  /* ---------------- mandi: gosok sabun lalu bilas ---------------- */

  let scrubbing = false, lastPt: [number, number] | null = null, foamN = 0;
  function toSvg(cx: number, cy: number) {
    const ctm = svgEl?.getScreenCTM();
    if (!svgEl || !ctm) return null;
    const pt = svgEl.createSVGPoint();
    pt.x = cx; pt.y = cy;
    const q = pt.matrixTransform(ctm.inverse());
    return [q.x, q.y] as [number, number];
  }
  function overPet(cx: number, cy: number, pad = 14) {
    const r = petEl()?.getBoundingClientRect();
    return !!r && cx >= r.left - pad && cx <= r.right + pad && cy >= r.top - pad && cy <= r.bottom + pad;
  }
  function foamAt(cx: number, cy: number) {
    const q = toSvg(cx, cy);
    if (!q || !foamLayer || foamN > 60) return;
    foamN++;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    g.setAttribute('cx', (q[0] + (Math.random() * 10 - 5)).toFixed(1));
    g.setAttribute('cy', (q[1] + (Math.random() * 10 - 5)).toFixed(1));
    g.setAttribute('r', (4 + Math.random() * 6).toFixed(1));
    g.setAttribute('class', 'foam');
    foamLayer.appendChild(g);
  }
  function bathDown(e: PointerEvent) {
    if (!G.bath || mode !== 'home') return;
    if (G.bath.tool === 'gayung') { if (overPet(e.clientX, e.clientY, 30)) rinse(); return; }
    scrubbing = true;
    lastPt = [e.clientX, e.clientY];
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  }
  function bathMove(e: PointerEvent) {
    if (!G.bath || !scrubbing || G.bath.tool !== 'sabun' || !lastPt) return;
    const d = Math.hypot(e.clientX - lastPt[0], e.clientY - lastPt[1]);
    lastPt = [e.clientX, e.clientY];
    if (!overPet(e.clientX, e.clientY)) return;
    G.bath.scrub = Math.min(1, G.bath.scrub + d / 900);
    if (Math.random() < 0.45) foamAt(e.clientX, e.clientY);
    if (Math.random() < 0.08) sfx.tap();
    if (G.bath.scrub >= 1 && G.bath.tool === 'sabun') { G.bath.tool = 'gayung'; toast('Sudah berbusa! Sekarang bilas pakai gayung.'); }
  }
  function bathUp() { scrubbing = false; lastPt = null; }
  async function rinse() {
    if (!G.bath || G.bath.rinsing) return;
    G.bath.rinsing = true;
    for (let i = 0; i < 3; i++) setTimeout(() => fx('drops'), i * 250);
    sfx.pop();
    const r: any = await run(() => post('/api/action', { type: 'mandi' }));
    setTimeout(() => { if (foamLayer) foamLayer.innerHTML = ''; foamN = 0; }, 500);
    if (r) {
      G.cool.mandi = Date.now() + (settings().actions?.mandi?.cooldownSec ?? 0) * 1000;
      fx('bubbles');
      toast(`${G.me.pet.name} wangi lagi`, 'good');
      if (r.result?.levelUp) { sfx.level(); toast(`Naik ke Lv ${r.result.levelUp}!`, 'good'); }
    }
    G.bath = null;
  }
  $effect(() => { if (!G.bath && foamLayer) untrack(() => { foamLayer!.innerHTML = ''; foamN = 0; }); });

  /* ---------------- interaksi ---------------- */

  function click(e: MouseEvent) {
    const t = e.target as Element;
    if (G.bath) return;
    if (menu) { menu = null; if (!t.closest('.furn, .spot')) return; }
    const cr = t.closest('.crumb') as SVGElement | null;
    if (cr && homeLive) return sweepCrumb(Number(cr.dataset.c), e);
    if (t.closest('.pet')) return tapPet();
    const op = t.closest('.opet') as SVGElement | null;
    if (op) { const id = op.dataset.o!; fxAtComp(id, 'hearts'); sfx.pop(); if (id !== SELF) hemote('hati'); return; }
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
    if (asleep) { toast(`Ssst… ${petData.name} lagi tidur.`); return; }
    if (mode === 'home') {
      const f = t.closest('.furn') as SVGElement | null;
      if (f) return openMenu(e, { index: Number(f.dataset.i) });
      const sp = t.closest('.spot') as SVGElement | null;
      if (sp && sp.dataset.spot && sp.dataset.spot in ROOM_SPOTS) return openMenu(e, { spot: sp.dataset.spot as RoomSpot });
    }
    // ketuk lantai: pet berjalan ke sana (saat berkunjung: pet sendiri)
    const fl = t.closest('.fl') as SVGElement | null;
    if (fl && mode === 'visit') { const me = comps.get(SELF); if (me && !selfBusy) { compWalk(me, [[Number(fl.dataset.x), Number(fl.dataset.y)]]); sfx.tap(); } return; }
    if (fl && walkTo(Number(fl.dataset.x), Number(fl.dataset.y))) sfx.tap();
  }

  async function tapPet() {
    const now = Date.now();
    if (now - lastTap < 600 || acting) return;
    lastTap = now;
    if (walking) { stopWalk(); scheduleIdle(); }
    fx('hearts');
    sfx.pop();
    if (mode !== 'home' || G.edit) return;
    if (asleep) sayLine('tidur');
    else if (Math.random() < 0.5) sayLine('elus');
    await run(() => post('/api/action', { type: 'elus' }));
  }

  function key(e: KeyboardEvent) { if (e.key === 'Escape') { if (menu) menu = null; else if (G.bath) G.bath = null; } }

  /* ---------------- mata mengikuti jari / mouse ---------------- */
  function lookAt(cx: number, cy: number) {
    const r = petEl()?.getBoundingClientRect();
    if (!r || !svgEl || asleep) return;
    const dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height * 0.4);
    const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 160);
    svgEl.style.setProperty('--lx', `${((dx / d) * 4.5 * k * (flip ? -1 : 1)).toFixed(2)}px`);
    svgEl.style.setProperty('--ly', `${((dy / d) * 3 * k).toFixed(2)}px`);
  }
  function onPointer(e: PointerEvent) {
    lookAt(e.clientX, e.clientY);
    bathMove(e);
  }
  // makanan didekatkan ke mulut: pet mangap
  const mouthOpen = $derived.by(() => {
    const d = G.feedDrag;
    if (!d || mode !== 'home') return false;
    void G.now;
    const r = petEl()?.getBoundingClientRect();
    if (!r) return false;
    return Math.hypot(d.x - (r.left + r.width / 2), d.y - (r.top + r.height * 0.55)) < Math.max(110, r.width);
  });
  $effect(() => { const d = G.feedDrag; if (d) untrack(() => lookAt(d.x, d.y)); });
  const chewing = $derived(G.now - G.chewing < 1300 && G.chewing > 0);

  /* ---------------- celetukan pet ---------------- */
  let talkTimer: any;
  let bubble = $state<{ x: number; y: number } | null>(null);
  let bubbleRaf = 0;
  const mood = $derived(look?.mood ?? 'biasa');
  let lastMood = '';
  function scheduleTalk() {
    clearInterval(talkTimer);
    const every = Math.max(10, Number(settings().speech?.everySec ?? 35));
    talkTimer = setInterval(() => {
      if (mode !== 'home' || G.edit || G.sheet || document.hidden) return;
      if (Math.random() < 0.7) sayLine(look?.chub && look.chub > 0.3 && Math.random() < 0.4 ? 'gembul' : mood);
    }, every * 1000);
  }
  onMount(scheduleTalk);
  $effect(() => {
    const m = mood;
    if (mode !== 'home' || m === lastMood) return;
    const first = !lastMood;
    lastMood = m;
    // saat suasana hati berubah (lapar, capek, sakit, ...) pet langsung bilang
    if (!first && m !== 'biasa') untrack(() => sayLine(m));
  });
  $effect(() => {
    const sp = G.speech;
    if (!sp || mode !== 'home') return;
    const follow = () => {
      const r = petEl()?.getBoundingClientRect(), w = wrapEl?.getBoundingClientRect();
      // tetap di dalam layar (gelembung maks ±240px)
      if (r && w) bubble = { x: Math.max(128, Math.min(w.width - 128, r.left + r.width / 2 - w.left)), y: Math.max(56, r.top - w.top) };
      bubbleRaf = requestAnimationFrame(follow);
    };
    follow();
    const t = setTimeout(() => { if (G.speech?.n === sp.n) G.speech = null; }, 3800);
    return () => { cancelAnimationFrame(bubbleRaf); clearTimeout(t); bubble = null; };
  });

  // efek melayang (hati, gelembung, koin, zzz, ...) di atas kepala pet
  const SHAPES: Record<string, () => string> = {
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
  function spawn(x: number, y: number, kind: string) {
    if (!fxLayer) return;
    const make = SHAPES[kind] ?? SHAPES.hearts;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    let h = '';
    for (let i = 0; i < 4; i++) {
      const dx = (i - 1.5) * 16 + (Math.random() * 8 - 4);
      h += `<g transform="translate(${(x + dx).toFixed(1)} ${(y - i * 4).toFixed(1)})"><g class="fx-up" style="animation-delay:${i * 110}ms">${make()}</g></g>`;
    }
    g.innerHTML = h;
    fxLayer.appendChild(g);
    setTimeout(() => g.remove(), 1600);
  }
  function spawnAt(cx: number, cy: number, kind: string) { const q = toSvg(cx, cy); if (q) spawn(q[0], q[1] - 10, kind); }
  $effect(() => {
    const n = G.fx;
    if (!n || !svgEl || !fxLayer) return;
    const pet = svgEl.querySelector('.pet');
    if (!pet) return;
    const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(pet.getAttribute('transform') ?? '');
    if (!m) return;
    const hop = pet.querySelector('.pet-hop');
    if (!untrack(() => pose) && !untrack(() => G.bath)) {
      hop?.classList.remove('go');
      void (hop as any)?.getBBox?.();
      hop?.classList.add('go');
    }
    spawn(+m[1], +m[2] - 74, G.fxKind);
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

<svelte:window onkeydown={key} onpointermove={onPointer} onpointerup={bathUp} />
<div class="roomwrap" bind:this={wrapEl}>
  <svg bind:this={svgEl} class="room" class:walking class:acting={!!pose} class:home={homeLive} class:bathing={mode === 'home' && !!G.bath} class:soap={G.bath?.tool === 'sabun'} class:scoop={G.bath?.tool === 'gayung'}
    class:mangap={mouthOpen || chewing} class:chew={chewing} class:asleep
    {viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={mode === 'visit' ? 'Rumah teman' : `Rumahmu: ${room?.name ?? 'Kamar'}`} onclick={click} onpointerdown={bathDown}>
    {@html html}
    <g bind:this={foamLayer} pointer-events="none"></g>
    <g bind:this={fxLayer} pointer-events="none"></g>
  </svg>
  {#each tags as t (t.id)}<span class="tag" class:self={t.self} style="left:{t.x}px;top:{t.y}px">{t.name}</span>{/each}
  {#each H.bubbles as b (b.id)}
    {@const at = bpos[b.who]}
    {#if at}<p class="bubble hb" class:emo={!!b.emote} style="left:{at.x}px;top:{at.y}px" role="status">{#if b.emote}{@html EMOTE_ICON[b.emote] ?? ''}{:else}{b.text}{/if}</p>{/if}
  {/each}
  {#if bubble && G.speech && mode === 'home'}
    {#key G.speech.n}<p class="bubble" style="left:{bubble.x}px;top:{bubble.y}px" role="status">{G.speech.text}</p>{/key}
  {/if}
  {#if menu}
    <div class="menu" style={menuStyle} role="menu" aria-label="Aktivitas {menu.title}">
      <b>{menu.title}</b>
      {#each menu.acts as a (a.id)}
        {@const cd = cdLeft(a.id)}
        {@const lock = (a.min_level ?? 1) > G.me.pet.level}
        <button class="btn sm" class:hot={a.id === '__sleep'} role="menuitem" disabled={cd > 0 || lock || G.busy} onclick={() => doActivity(a, menu!.target)}>
          <span class="nm">{a.name}</span>
          <span class="ef">{a.note ?? (lock ? `Lv ${a.min_level}` : cd > 0 ? fmtCd(cd) : effText(a.effects) || (a.coins ? `+${a.coins} koin` : ''))}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .roomwrap { position: absolute; inset: 0; }
  .room { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: manipulation; }
  .room.bathing { touch-action: none; }
  .room.soap { cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='32'%3E%3Crect x='3' y='6' width='34' height='20' rx='9' fill='%23F7A8C4' stroke='%232B2F4A' stroke-width='2.5'/%3E%3Ccircle cx='30' cy='8' r='4' fill='%23DDF3FF' stroke='%232B2F4A' stroke-width='1.5'/%3E%3C/svg%3E") 20 16, pointer; }
  .room.scoop { cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='36'%3E%3Cpath d='M4 10h22l-3 18H7Z' fill='%237FC4E8' stroke='%232B2F4A' stroke-width='2.5' stroke-linejoin='round'/%3E%3Cpath d='M25 14h11' stroke='%232B2F4A' stroke-width='4' stroke-linecap='round'/%3E%3C/svg%3E") 16 18, pointer; }
  .room :global(.fl) { cursor: pointer; }
  .room.home :global(.furn), .room.home :global(.spot), .room.home :global(.crumb) { cursor: pointer; }
  .room.home :global(.furn:hover), .room.home :global(.spot:hover) { filter: brightness(1.06); }
  .room :global(.crumb) { animation: crumbIn .4s ease-out; }
  .room.walking :global(.pet-bob), .room :global(.opet.moving .pet-bob) { animation: waddle 0.3s ease-in-out infinite alternate; }
  .room :global(.opet) { cursor: pointer; }
  .tag { position: absolute; z-index: 10; transform: translateX(-50%); background: rgba(255, 253, 247, .92); border: 1.5px solid var(--ink); border-radius: 999px; padding: 0 7px; font-size: 11.5px; font-weight: 800; white-space: nowrap; pointer-events: none; max-width: 40vw; overflow: hidden; text-overflow: ellipsis; }
  .tag.self { background: #FFE8A3; z-index: 11; }
  .bubble.hb { z-index: 12; }
  .bubble.hb.emo { padding: 3px 6px; z-index: 10; }
  .bubble.hb.emo :global(svg) { width: 30px; height: 30px; display: block; }
  .room :global(.foam) { fill: #FFFFFF; stroke: #9FD0E8; stroke-width: 1.4; opacity: .95; animation: pop .25s ease-out; }
  @keyframes waddle {
    from { transform: rotate(-6deg) translateY(0); }
    to { transform: rotate(6deg) translateY(-4px); }
  }
  @keyframes crumbIn { from { opacity: 0; transform: scale(.4); } }
  .bubble { position: absolute; z-index: 11; transform: translate(-50%, calc(-100% - 10px)); margin: 0; width: max-content; max-width: min(240px, 70vw); background: var(--paper); border: 2.5px solid var(--ink); border-radius: 16px; box-shadow: 0 3px 0 var(--ink); padding: 5px 12px; font-weight: 800; font-size: 14.5px; line-height: 1.2; pointer-events: none; animation: talk 3.8s ease-out forwards; }
  .bubble::after { content: ''; position: absolute; left: 50%; bottom: -9px; width: 14px; height: 14px; background: var(--paper); border-right: 2.5px solid var(--ink); border-bottom: 2.5px solid var(--ink); transform: translateX(-50%) rotate(45deg); }
  @keyframes talk { 0% { opacity: 0; transform: translate(-50%, calc(-100% - 2px)) scale(.8); } 8%, 88% { opacity: 1; transform: translate(-50%, calc(-100% - 10px)) scale(1); } 100% { opacity: 0; transform: translate(-50%, calc(-100% - 14px)); } }
  .menu { position: absolute; z-index: 12; width: 240px; display: flex; flex-direction: column; gap: 6px; background: var(--paper); border: 2.5px solid var(--ink); border-radius: 16px; box-shadow: 0 4px 0 var(--ink); padding: 8px; animation: pop .18s ease-out; }
  .menu b { font-size: 15px; padding: 0 4px; }
  .menu .btn { justify-content: space-between; width: 100%; gap: 8px; }
  .menu .nm { font-weight: 800; }
  .menu .ef { font-size: 12px; font-weight: 700; color: var(--muted); white-space: normal; text-align: right; }
  @media (prefers-reduced-motion: reduce) { .room.walking :global(.pet-bob) { animation: none; } .bubble { animation: none; } }
</style>
