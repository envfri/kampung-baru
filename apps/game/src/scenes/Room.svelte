<script lang="ts">
  // Rumah tersambung: semua ruangan (kamar, ruang tamu, dapur, kamar mandi, halaman, ...) tampil sekaligus sebagai satu rumah.
  // Pet berjalan antarruangan lewat pintu; kamera mengikuti ruangan pet, bisa digeser/dicubit, atau melihat seluruh rumah.
  import { onDestroy, onMount, untrack } from 'svelte';
  import { roomMood, PREMIUM_SET_BY_KEY, HOUSE_WALL_H, fits, occupied, petSpot, footprint, ROOM_SPOTS, ACTIVITY_ANIMS, ACTIVITY_SPOTS, activityFits, mulberry32, photoScene, ALUN_ITEMS, ALUN_LAYOUT, ALUN_ROOM, ALUN_SIZE, SQUARE_ACTS, SQUARE_SNACKS, squareShow, houseLayout, houseLayers, houseCrumbs, houseDraws, houseDrawOrder, houseBounds, houseIso, houseYardSVG, houseYardBounds, skyTime, petMarkup, HOUSE_PET_SCALE, HOUSE_T, type RoomSpot, type HouseRoomArt, type HouseDraw, type HousePlan } from '@kb/shared';
  import { H, enterHouse, leaveHouse, bubble as hbubble, emote as hemote, ACT_SAY, SQUARE, takePhoto } from '../lib/house.svelte';
  import { startGame, inGameNow } from '../lib/bareng.svelte';
  import { EMOTE_ICON } from '../lib/houseArt';
  import { api } from '../lib/api';
  import { G, items, item, wearItems, run, post, fx, toast, activeDecor, curRoom, effText, petLook, isSleeping, setSleep, sayLine, settings, serverNow, movePlanRoom, setMirror } from '../lib/game.svelte';
  import { sfx } from '../lib/sfx';

  let { mode = 'home' }: { mode?: 'home' | 'visit' | 'square' } = $props();
  /** alun-alun: lapangan bersama semua pemain (pet sendiri jalan-jalan, pemain lain live) */
  const square = untrack(() => mode === 'square');
  const ALUN_FLOOR: any = { id: 'alun-rumput', kind: 'floor', name: 'Rumput', art: { type: 'builtin', key: 'rumput', colors: { main: '#8CC56E', accent: '#7FB862' } } };
  let svgEl: SVGSVGElement | undefined = $state();
  let wrapEl: HTMLDivElement | undefined = $state();
  let fxLayer: SVGGElement | undefined = $state();
  let foamLayer: SVGGElement | undefined = $state();
  let lastTap = 0;

  /* ---------------- denah rumah ---------------- */
  const defSize = () => G.catalog?.settings?.room?.size ?? 6;
  const rooms = $derived.by<any[]>(() => {
    if (square) return [{ id: ALUN_ROOM, name: 'Alun-alun', size: ALUN_SIZE, theme: 'luar', layout: ALUN_LAYOUT, floorItem: ALUN_FLOOR }];
    if (mode === 'visit') return G.visit?.rooms?.length ? G.visit.rooms : G.visit?.room ? [{ id: '', name: 'Kamar', ...G.visit.room }] : [];
    if (G.me?.rooms?.length) return G.me.rooms;
    const c = curRoom();
    return c ? [c] : [];
  });
  const itemMap = $derived<Record<string, any>>(square ? { ...Object.fromEntries(items()), ...ALUN_ITEMS } : Object.fromEntries(items()));
  const itemOf = (id: string | undefined) => (id ? itemMap[id] ?? item(id) : undefined);
  /** ruangan yang sedang diatur (mode Atur) */
  const editId = $derived<string | null>(mode === 'home' && G.edit ? curRoom()?.id ?? '' : null);
  const roomOf = (id: string) => rooms.find((r) => r.id === id);
  const layoutOf = (r: any): any[] => (r && r.id === editId && G.draft ? G.draft : r?.layout ?? []);
  const occ = $derived(new Map<string, Set<string>>(rooms.map((r) => [r.id, occupied(layoutOf(r), itemMap)])));
  /** mode Atur denah: letak ruangan diambil dari yang sedang diatur, persis apa adanya */
  const planning = $derived(mode === 'home' && !!G.plan);
  const plan = $derived(houseLayout(
    rooms.map((r) => ({ id: r.id, size: r.size ?? defSize(), theme: r.theme, gx: planning ? G.plan!.pos[r.id]?.gx : r.gx, gy: planning ? G.plan!.pos[r.id]?.gy : r.gy })),
    (id) => occ.get(id), { strict: planning },
  ));
  /** berubah hanya bila letak/ukuran ruangan berubah (bukan setiap denah dibuat ulang) */
  const planSig = $derived(plan.sig);
  /** naik setiap denah berubah: aktivitas / jalan ke kasur yang masih berjalan berhenti (koordinatnya sudah usang) */
  let planGen = 0;
  /** petak yang tertutup mebel (koordinat rumah) */
  const blocked = $derived.by(() => {
    const s = new Set<string>();
    for (const r of plan.rooms) for (const k of occ.get(r.id) ?? []) { const [x, y] = k.split(',').map(Number); s.add(`${x + r.gx},${y + r.gy}`); }
    return s;
  });
  const roomAt = (p: [number, number] | null | undefined) => (p ? plan.at(p[0], p[1]) : undefined);
  /** posisi di dalam ruangan (koordinat ruangan) → koordinat rumah */
  function toHouse(roomId: string, x: number, y: number): [number, number] {
    const r = plan.byId.get(roomId) ?? plan.rooms[0];
    if (!r) return [x, y];
    const c = (v: number) => Math.max(0.5, Math.min(r.size - 0.5, v));
    return [r.gx + c(x), r.gy + c(y)];
  }
  /** petak kosong di satu ruangan (koordinat rumah) */
  function freeIn(roomId: string | undefined): [number, number][] {
    const r = roomId !== undefined ? plan.byId.get(roomId) : undefined;
    if (!r) return [];
    const out: [number, number][] = [];
    for (let x = r.gx; x < r.gx + r.size; x++) for (let y = r.gy; y < r.gy + r.size; y++) if (!blocked.has(`${x},${y}`)) out.push([x, y]);
    return out;
  }
  /** tempat berdiri pet di tengah ruangan */
  function spotIn(roomId: string): [number, number] {
    const r = plan.byId.get(roomId) ?? plan.rooms[0];
    if (!r) return [0.5, 0.5];
    const p = petSpot(layoutOf(roomOf(r.id)), itemMap, r.size);
    return [r.gx + p[0], r.gy + p[1]];
  }

  /** alun-alun: masuk lewat gerbang depan (petak kosong acak dekat jalan utama) */
  function entrySpot(): [number, number] {
    // sedikit masuk ke lapangan (bukan di tepi) supaya alun-alun terlihat luas sejak datang
    const near = freeIn(ALUN_ROOM).filter(([x, y]) => y >= ALUN_SIZE - 6 && y <= ALUN_SIZE - 4 && Math.abs(x - 10) <= 3);
    const t = near[Math.floor(Math.random() * near.length)] ?? [10, ALUN_SIZE - 1];
    return [t[0] + 0.5, t[1] + 0.5];
  }
  // ruangan yang difokuskan: di rumah sendiri = ruangan aktif (ikut pet), saat berkunjung = ruangan pet sendiri
  let visitFocus = $state('');
  const focusId = $derived(square ? ALUN_ROOM : mode === 'home' ? (curRoom()?.id ?? plan.rooms[0]?.id ?? '') : plan.byId.has(visitFocus) ? visitFocus : (plan.rooms[0]?.id ?? ''));

  const petData = $derived<any>(mode === 'visit' ? G.visit?.pet : G.me.pet);
  const asleep = $derived(!!petData && G.now > 0 && isSleeping(petData));
  const homeLive = $derived((mode === 'home' || square) && !G.edit);
  // berkunjung saat tuan rumah juga ada di rumahnya: pet tuan rumah digerakkan pemiliknya (dari sinkron)
  const hostMember = $derived(mode === 'visit' ? H.members.find((m) => m.host) ?? null : null);
  const hideMain = $derived(!!hostMember);

  /* ---------------- pet berjalan ---------------- */
  // `pos` dipakai untuk urutan kedalaman (diperbarui saat pet pindah petak);
  // `live` diperbarui setiap frame dan langsung menggeser elemen pet. Semua dalam koordinat rumah.
  let pos = $state<[number, number] | null>(null);
  let flip = $state(false);
  let walking = $state(false);
  /** pose saat beraktivitas / tidur (tidur di kasur, membaca, ...) */
  let pose = $state<{ pose: string; prop?: string; lift: number } | null>(null);
  let acting = $state(false);
  let live: [number, number] | null = null;
  let path: [number, number][] = [];
  let speed = 1.3;
  let raf = 0;
  let idleTimer: any;
  let last = 0;
  let arrived: (() => void) | null = null;
  let bedSpot: [number, number] | null = null;
  const SPEED = 1.3; // petak per detik
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tileOf = (p: [number, number]) => `${Math.floor(p[0])},${Math.floor(p[1])}`;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, reduced ? Math.min(ms, 400) : ms));
  const petRoomId = $derived(roomAt(pos)?.id ?? '');
  const liftPx = (l: number) => (l * HOUSE_T) / 32;

  // denah berubah (ruangan baru / diperluas / rumah lain) atau pet tertimpa mebel: tempatkan ulang pet
  let placedSig = '';
  let lastPlan: HousePlan | null = null;
  $effect(() => {
    const p = plan, b = blocked;
    untrack(() => {
      const cur = live ?? pos;
      if (p.sig !== placedSig) {
        // posisi pet di dalam ruangannya tetap sama walau letak ruangan di denah bergeser
        const oldR = cur && lastPlan ? lastPlan.at(cur[0], cur[1]) : undefined;
        const nr = oldR ? p.byId.get(oldR.id) : undefined;
        let at: [number, number] | null = cur && oldR && nr ? [cur[0] - oldR.gx + nr.gx, cur[1] - oldR.gy + nr.gy] : null;
        placedSig = p.sig;
        planGen++;
        halt();
        pose = null; acting = false; menu = null; bedSpot = null;
        if (!at || b.has(tileOf(at)) || !p.at(at[0], at[1])) at = square ? entrySpot() : spotIn(nr?.id ?? (mode === 'home' ? focusId : p.rooms[0]?.id ?? ''));
        pos = [...at];
        live = [...at];
        for (const c of comps.values()) {
          const o = lastPlan?.at(c.live[0], c.live[1]), n = o ? p.byId.get(o.id) : undefined;
          if (o && n) c.live = [c.live[0] - o.gx + n.gx, c.live[1] - o.gy + n.gy];
          c.path = []; c.tile = tileOf(c.live); c.target = '';
        }
        compVer++;
        lastPlan = p;
        if (asleep) queueMicrotask(() => goToBed(true));
        queueMicrotask(place);
        return;
      }
      lastPlan = p;
      if (cur && !acting && !bedSpot && b.has(tileOf(cur))) {
        // mebel dipasang di tempat pet berdiri: geser ke petak kosong terdekat di ruangan yang sama
        halt();
        const r = p.at(cur[0], cur[1]);
        const free = freeIn(r?.id).sort((a, q) => Math.hypot(a[0] + 0.5 - cur[0], a[1] + 0.5 - cur[1]) - Math.hypot(q[0] + 0.5 - cur[0], q[1] + 0.5 - cur[1]));
        const t: [number, number] = free[0] ? [free[0][0] + 0.5, free[0][1] + 0.5] : spotIn(r?.id ?? '');
        pos = [...t]; live = [...t];
        queueMicrotask(place);
      }
    });
  });

  // keadaan tubuh yang digambar: wajah sesuai kebutuhan, noda kotor (berkurang saat digosok), gembul
  const look = $derived.by(() => {
    const l = petLook(petData);
    if (!l) return undefined;
    if (mode === 'home' && G.bath) return { ...l, dirt: l.dirt * (1 - G.bath.scrub) };
    return l;
  });

  /* ---------------- remah & bulu rontok (di ruangan tempat pet berada) ---------------- */
  let swept = $state<Set<number>>(new Set());
  const crumbCount = $derived.by(() => {
    const c = settings().crumbs;
    const at = G.me?.pet?.crumbsAt;
    if (mode !== 'home' || !c || !at) return 0;
    return Math.max(0, Math.min(c.max, Math.floor((serverNow() - at) / (c.everyMinutes * 60_000))));
  });
  const crumbRoom = $derived(mode === 'home' ? petRoomId || focusId : '');
  const crumbs = $derived.by(() => {
    const r = plan.byId.get(crumbRoom);
    if (!crumbCount || G.edit || !r) return [];
    const rnd = mulberry32(Math.floor((G.me.pet.crumbsAt ?? 0) / 1000) ^ r.size);
    const lo = occ.get(r.id) ?? new Set<string>();
    const free: [number, number][] = [];
    for (let x = 0; x < r.size; x++) for (let y = 0; y < r.size; y++) if (!lo.has(`${x},${y}`)) free.push([x, y]);
    const out: { x: number; y: number; k: string; c?: string; i: number }[] = [];
    for (let i = 0; i < crumbCount && free.length; i++) {
      const [x, y] = free.splice(Math.floor(rnd() * free.length), 1)[0];
      const k = r.outdoor ? (rnd() < 0.5 ? 'daun' : 'bulu') : rnd() < 0.55 ? 'remah' : 'bulu';
      out.push({ x: x + 0.3 + rnd() * 0.4, y: y + 0.3 + rnd() * 0.4, k, c: G.me.pet.color, i });
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

  // foto bareng yang dipajang di lukisan dinding (ruangan pertama yang punya lukisan)
  const photoRoom = $derived(plan.rooms.find((r) => r.painting)?.id ?? '');
  const photoSvg = $derived.by(() => {
    const ph = mode === 'visit' ? G.visit?.photo : G.me?.photo;
    if (!ph?.members?.length) return '';
    return photoScene(ph.members.filter((m: any) => m.pet).map((m: any) => ({ look: m.pet, wear: wearItems(m.pet.wear), state: m.pet.state })), ph.pose);
  });

  /* ---------------- gambar rumah ---------------- */
  const art = $derived.by(() => {
    const out: Record<string, HouseRoomArt> = {};
    for (const r of rooms)
      out[r.id] = {
        layout: layoutOf(r), wall: item(r.wall), floor: r.floorItem ?? item(r.floor),
        edit: r.id === editId, dim: editId !== null && r.id !== editId, sel: r.id === editId ? G.sel : -1,
        photo: r.id === photoRoom ? photoSvg : '',
        // alun-alun: jalan batu bagian dari lantai (ketukan diteruskan ke petak di bawahnya)
        inertFlats: square,
      };
    return out;
  });
  // lapisan bawah dipotong per ruangan (hanya ruangan yang berubah digambar ulang); remah di lapisan sendiri
  const layers = $derived(houseLayers(plan, art, itemMap, activeDecor()));
  /* ---------------- pekarangan & langit (ikut jam pemain) ---------------- */
  let sky = $state(skyTime(new Date().getHours()));
  onMount(() => { const t = setInterval(() => { sky = skyTime(new Date().getHours()); }, 60_000); return () => clearInterval(t); });
  /** pekarangan tampil di rumah sendiri & rumah teman (tidak saat mengatur denah: ruangan bisa terpisah-pisah) */
  const showYard = $derived(!square && !planning);
  // satu string SVG: dibuat ulang hanya bila letak ruangan berubah atau siang ↔ malam
  let yardKey = '', yardStr = '';
  const yardHtml = $derived.by(() => {
    if (!showYard) return '';
    const k = `${plan.sig}|${sky === 'malam'}`;
    if (k !== yardKey) { yardKey = k; yardStr = houseYardSVG(plan, sky === 'malam'); }
    return yardStr;
  });
  /** batas pandang kamera: pekarangan (bila tampil) atau rumah saja */
  const viewBounds = () => (showYard ? houseYardBounds(plan) : houseBounds(plan));
  const crumbsHtml = $derived(G.edit ? '' : houseCrumbs(plan, crumbRoom, crumbs));
  const fixedDraws = $derived(houseDraws(plan, art, itemMap));
  type Draw = HouseDraw & { pet?: { cls: string; tf: string; o?: string } };
  const tf = (p: [number, number], lift = 0) => { const [x, y] = houseIso(p[0], p[1]); return `translate(${x.toFixed(1)} ${(y - liftPx(lift)).toFixed(1)}) scale(${HOUSE_PET_SCALE})`; };
  const mainMarkup = $derived(petData && !hideMain && !planning ? petMarkup({ look: petData, wear: wearItems(petData.wear), state: look, flip, prop: mode === 'home' && G.bath ? 'baskom' : pose?.prop }) : '');
  /** gambar pet lain disimpan per pet: hanya dibuat ulang bila tampilannya berubah (bukan setiap ada yang pindah petak) */
  const markupCache = new Map<string, { k: string; h: string }>();
  function compMarkup(c: Comp) {
    const k = JSON.stringify([c.look?.color, c.look?.ear, c.look?.pattern, c.look?.eyes, c.look?.tail, c.wear?.map((w: any) => w.id), c.state, c.flip]);
    const hit = markupCache.get(c.id);
    if (hit && hit.k === k) return hit.h;
    const h = petMarkup({ look: c.look, wear: c.wear, state: c.state, flip: c.flip });
    markupCache.set(c.id, { k, h });
    return h;
  }
  const petDraws = $derived.by(() => {
    void compVer;
    const out: Draw[] = [];
    if (mainMarkup && pos) out.push({ key: 'pet', d: pos[0] + pos[1] + 0.01, h: mainMarkup, pet: { cls: `pet${pose?.pose ? ' pose-' + pose.pose : ''}`, tf: tf(pos, pose?.lift ?? 0) } });
    if (!(mode === 'home' && (G.edit || G.plan)))
      for (const c of comps.values())
        out.push({ key: 'o:' + c.id, d: c.live[0] + c.live[1] + 0.005, h: compMarkup(c), pet: { cls: `opet${c.pose ? ' pose-' + c.pose : ''}`, tf: tf(c.live), o: c.id } });
    return out;
  });
  const draws = $derived<Draw[]>([...fixedDraws, ...petDraws, ...npcDraws].sort(houseDrawOrder));

  const petEl = () => svgEl?.querySelector('.pet') as SVGGElement | null;
  function place() {
    const el = petEl();
    if (!el || !live) return;
    el.setAttribute('transform', tf(live, pose?.lift ?? 0));
  }

  /** Jalur terpendek (BFS) dari petak pet ke salah satu petak tujuan; pindah ruangan hanya lewat pintu. */
  function routeToAny(goals: [number, number][]) {
    return live ? routeFrom(live, goals) : null;
  }
  function routeFrom(at: [number, number], goals: [number, number][]) {
    const key = (x: number, y: number) => `${x},${y}`;
    const want = new Set(goals.filter(([x, y]) => !!plan.at(x, y) && !blocked.has(key(x, y))).map(([x, y]) => key(x, y)));
    if (!want.size) return null;
    const from: [number, number] = [Math.floor(at[0]), Math.floor(at[1])];
    const prev = new Map<string, [number, number] | null>([[key(...from), null]]);
    const queue: [number, number][] = [from];
    let end: [number, number] | null = null;
    for (let qi = 0; qi < queue.length; qi++) {
      const [x, y] = queue[qi];
      if (want.has(key(x, y))) { end = [x, y]; break; }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = key(nx, ny);
        if (prev.has(k) || blocked.has(k) || !plan.pass(x, y, nx, ny)) continue;
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
      // tetap berjalan walau sistem meminta animasi dikurangi (jalan = gerak permainan, bukan hiasan);
      // yang dimatikan hanya goyangan langkah (CSS prefers-reduced-motion)
      arrived?.();
      arrived = resolve;
      path = p;
      // jalan jauh (pindah ruangan) dipercepat supaya tidak lama menunggu
      speed = Math.max(SPEED, p.length / 4.5);
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
    const d = Math.hypot(dx, dy), step = speed * dt;
    const sx = dx - dy; // arah horizontal di layar
    if (Math.abs(sx) > 0.01 && sx < 0 !== flip) flip = sx < 0;
    const before = tileOf(live);
    if (d <= step) { live = [tx, ty]; path.shift(); }
    else live = [live[0] + (dx / d) * step, live[1] + (dy / d) * step];
    if (tileOf(live) !== before || !path.length) pos = [...live];
    place();
    if (mode === 'home') follow(dt);
    if (path.length) raf = requestAnimationFrame(tick);
    else stopWalk();
  }

  function halt() {
    cancelAnimationFrame(raf);
    raf = 0;
    path = [];
    roomGoal = '';
    walking = false;
    clearTimeout(idleTimer);
    const a = arrived;
    arrived = null;
    a?.();
  }
  function stopWalk() {
    halt();
    if (live) pos = [...live];
    if (G.cam === 'near' && mode === 'home' && !santaiOn) { const t = nearCam(); if (t) aim(t, false, 400); }
  }
  function scheduleIdle() {
    clearTimeout(idleTimer);
    // animasi dikurangi: pet tetap jalan-jalan sendiri, tapi lebih jarang
    idleTimer = setTimeout(wander, (reduced ? 2.5 : 1) * (2500 + Math.random() * 5000));
  }
  function wander() {
    if (!live || walking || hideMain || G.edit || G.plan || acting || menu || asleep || G.bath || G.feedDrag || document.hidden || G.sheet === 'feed') return scheduleIdle();
    const cx = Math.floor(live[0]), cy = Math.floor(live[1]);
    // jalan-jalan kecil di dalam ruangan yang sama
    const options = freeIn(roomAt(live)?.id).filter(([x, y]) => { const m = Math.abs(x - cx) + Math.abs(y - cy); return m > 0 && m <= 3; });
    const pick = options[Math.floor(Math.random() * options.length)];
    if (!pick || !walkTo(pick[0], pick[1])) scheduleIdle();
  }

  /** Pet berjalan ke ruangan lain (dipilih dari Rumahku); tanpa jalan (pintu tertutup mebel) langsung pindah. */
  /** ruangan tujuan jalan yang sedang berlangsung (supaya tidak diulang) */
  let roomGoal = '';
  function goRoom(id: string) {
    if (!live) return;
    halt();
    menu = null;
    roomGoal = id;
    const sp = spotIn(id);
    const p = routeFrom(live, [[Math.floor(sp[0]), Math.floor(sp[1])]]) ?? routeFrom(live, freeIn(id));
    if (p && p.length) { walkPath(p).then(() => { if (!acting) scheduleIdle(); }); return; }
    live = [...sp]; pos = [...sp];
    queueMicrotask(place);
    scheduleIdle();
  }

  // mode atur & mandi: pet diam supaya mudah ditata / digosok
  $effect(() => {
    if (G.edit || G.bath || G.plan) { halt(); untrack(() => (menu = null)); }
    else untrack(() => scheduleIdle());
  });

  // pet masuk ke ruangan lain: ruangan itu jadi ruangan aktif (kamera ikut, tombol Atur mengatur ruangan itu)
  let followed = '';
  $effect(() => {
    const r = petRoomId;
    if (mode !== 'home' || !r || G.edit || G.plan) return;
    untrack(() => { if ((curRoom()?.id ?? '') !== r) { followed = r; G.roomId = r; } });
  });
  // ruangan dipilih pemain (Rumahku / toko): pet berjalan ke sana — langsung, atau setelah selesai mandi/beraktivitas/tidur
  $effect(() => {
    const f = focusId, busy = acting || asleep || !!G.bath || G.edit || !!G.plan;
    void petRoomId;
    if (mode !== 'home' || !f) return;
    untrack(() => {
      if (f === followed) { followed = ''; return; }
      if (busy || !live || !placedSig || petRoomId === f || roomGoal === f) return;
      goRoom(f);
    });
  });

  onMount(() => scheduleIdle());
  onDestroy(() => { halt(); clearInterval(talkTimer); cancelAnimationFrame(bubbleRaf); cancelAnimationFrame(camRaf); });

  /* ---------------- kamera: ikuti ruangan, lihat seluruh rumah, geser & cubit ---------------- */
  let vw = $state(0), vh = $state(0);
  let cam = $state({ x: 0, y: 120, k: 1 });
  let camReady = false, camRaf = 0;
  const wide = $derived(vw >= 900 && vw >= vh);
  // panel tamu di rumah sendiri (menutup bagian bawah layar)
  const guestBar = $derived(mode === 'home' && !G.edit && !G.bath && !G.plan && (H.members.length > 0 || H.elsewhere.some((e) => !e.host)));
  /** ruang layar yang tertutup tombol & panel (px) */
  function insets() {
    if (square) return wide ? { t: 92, b: 110, l: 24, r: 340 } : vw > vh ? { t: 64, b: 120, l: 16, r: 16 } : { t: Math.min(vh * 0.2, 175), b: Math.min(vh * 0.34, 310), l: 8, r: 8 };
    if (planning) return wide ? { t: 92, b: 230, l: 24, r: 24 } : vw > vh ? { t: 64, b: 150, l: 16, r: 16 } : { t: Math.min(vh * 0.17, 140), b: Math.min(vh * 0.36, 320), l: 8, r: 8 };
    // desktop: bawah = dock + kartu tugas, kanan = tombol aksi (+ panel tamu), supaya rumah tidak tertutup menu
    if (wide) return mode === 'visit' ? { t: 200, b: 110, l: 24, r: 340 } : { t: 92, b: 150, l: 24, r: guestBar ? 520 : 170 };
    if (vw > vh) return { t: 64, b: 84, l: 16, r: 16 };
    if (mode === 'visit') return { t: Math.min(vh * 0.3, 270), b: Math.min(vh * 0.27, 250), l: 8, r: 8 };
    return { t: Math.min(vh * 0.26, 225), b: guestBar ? Math.min(vh * 0.42, 390) : G.edit ? Math.min(vh * 0.27, 240) : Math.min(vh * 0.25, 230), l: 8, r: 8 };
  }
  function fitRaw(b: { x: number; y: number; w: number; h: number }) {
    const i = insets();
    const k = Math.min(Math.max(60, vw - i.l - i.r) / b.w, Math.max(60, vh - i.t - i.b) / b.h);
    return { k, x: b.x + b.w / 2 - (i.l - i.r) / 2 / k, y: b.y + b.h / 2 - (i.t - i.b) / 2 / k };
  }
  const kRange = () => [Math.min(fitRaw(viewBounds()).k, 0.5) * 0.85, wide ? 4.4 : 2.6];
  /** skala ruangan 6×6 (408 × 354): ruangan yang lebih kecil tidak diperbesar lagi, jadi ukuran pet tetap saat pindah ruangan */
  const kRoom = () => fitRaw({ x: 0, y: 0, w: 408, h: 354 }).k;
  function fit(b: { x: number; y: number; w: number; h: number }, cap = false) {
    const [lo, hi] = kRange();
    const r = fitRaw(b);
    const k = Math.max(lo, Math.min(hi, cap ? kRoom() : Infinity, r.k));
    if (k === r.k) return r;
    const i = insets();
    return { k, x: b.x + b.w / 2 - (i.l - i.r) / 2 / k, y: b.y + b.h / 2 - (i.t - i.b) / 2 / k };
  }
  function clampCam(c = cam) {
    const b = viewBounds(), [lo, hi] = kRange();
    const k = Math.max(lo, Math.min(hi, c.k));
    return { k, x: Math.max(b.x - b.w * 0.1, Math.min(b.x + b.w * 1.1, c.x)), y: Math.max(b.y - 40, Math.min(b.y + b.h + 40, c.y)) };
  }
  /** gerak kamera halus; lite = ±30 fps (mode santai, supaya ringan) */
  function aim(t: { x: number; y: number; k: number }, instant = false, dur = 520, lite = false) {
    cancelAnimationFrame(camRaf);
    if (instant || reduced || !camReady) { cam = t; camReady = true; return; }
    const from = { ...cam }, t0 = performance.now();
    let lastF = 0;
    const step = (now: number) => {
      if (lite && now - lastF < 32 && now - t0 < dur) { camRaf = requestAnimationFrame(step); return; }
      lastF = now;
      const p = Math.min(1, (now - t0) / dur), e = lite ? 0.5 - Math.cos(p * Math.PI) / 2 : 1 - (1 - p) ** 3;
      cam = { x: from.x + (t.x - from.x) * e, y: from.y + (t.y - from.y) * e, k: from.k * Math.pow(t.k / from.k, e) };
      if (p < 1) camRaf = requestAnimationFrame(step);
    };
    camRaf = requestAnimationFrame(step);
  }
  onMount(() => { G.cam = 'room'; });
  $effect(() => {
    const m = G.cam, f = focusId, w = vw, h = vh, pl = planning;
    // saat mengatur denah kamera tidak ikut bergeser setiap ruangan dipindah
    if (!pl) void planSig;
    void editId; void guestBar;
    if (!w || !h) return;
    untrack(() => {
      if (!plan.rooms.length) return;
      if (m === 'free') { cam = clampCam(); return; }
      if (square && m === 'room') { const t = petCam(); if (t) aim(t); return; }
      if (m === 'near' && !square) { const t = nearCam(); if (t) aim(t); return; }
      if (m === 'yard' && !square) { aim(fit(viewBounds())); return; }
      if (m === 'house') {
        const b = houseBounds(plan);
        // ruang kosong di sekeliling rumah untuk memindah ruangan
        aim(fit(pl ? { x: b.x - b.w * 0.15, y: b.y - b.h * 0.1, w: b.w * 1.3, h: b.h * 1.2 } : b));
      } else aim(fit(houseBounds(plan, f), true));
    });
  });
  /* ---------------- kamera Dekat: zoom ke pet & ikut saat berjalan ---------------- */
  /** pembesaran tambahan mode Dekat (tombol −/+ saat Dekat tidak keluar dari mode ini) */
  let nearMul = 1;
  function nearPos(): [number, number] | null {
    if (mode === 'visit') { const c = comps.get(SELF); return c ? c.live : null; }
    return live ?? pos;
  }
  function nearCam() {
    const p = nearPos();
    if (!p || !vw) return null;
    const [x, y] = houseIso(p[0], p[1]);
    const [lo, hi] = kRange(), i = insets();
    const k = Math.max(lo, Math.min(hi, kRoom() * 1.7 * nearMul));
    return { k, x: x - (i.l - i.r) / 2 / k, y: y - 44 - (i.t - i.b) / 2 / k };
  }
  /** dipanggil setiap frame saat pet berjalan: kamera menyusul pelan (tanpa animasi terpisah) */
  function follow(dt: number) {
    if (G.cam !== 'near' || santaiOn) return;
    const t = nearCam();
    if (!t) return;
    cancelAnimationFrame(camRaf);
    const e = 1 - Math.exp(-dt * 4.5);
    cam = { k: cam.k + (t.k - cam.k) * e, x: cam.x + (t.x - cam.x) * e, y: cam.y + (t.y - cam.y) * e };
  }
  /** tombol −/+ dan pintasan keyboard: zoom di tengah layar */
  function zoomBy(f: number) {
    if (G.cam === 'near') { nearMul = Math.max(0.6, Math.min(1.6, nearMul * f)); const t = nearCam(); if (t) aim(t, false, 260); return; }
    const [lo, hi] = kRange();
    aim(clampCam({ ...cam, k: Math.max(lo, Math.min(hi, cam.k * f)) }), false, 260);
    if (G.cam !== 'free') G.cam = 'free';
  }
  $effect(() => {
    if (square) return;
    const onCmd = (e: Event) => { const d = (e as CustomEvent).detail ?? {}; wake(); if (d.zoom) zoomBy(d.zoom); };
    addEventListener('kb-cam', onCmd);
    return () => removeEventListener('kb-cam', onCmd);
  });
  $effect(() => { if (G.cam !== 'near') nearMul = 1; });

  /** alun-alun: kamera mengikuti pet sendiri dengan zoom senyaman ruangan 9×9 */
  function petCam() {
    const p = live ?? pos;
    if (!p || !vw) return null;
    const [x, y] = houseIso(p[0], p[1]);
    const [lo, hi] = kRange(), i = insets();
    const k = Math.max(lo, Math.min(hi, fitRaw({ x: 0, y: 0, w: 612, h: 420 }).k));
    return { k, x: x - (i.l - i.r) / 2 / k, y: y - 50 - (i.t - i.b) / 2 / k };
  }
  $effect(() => { void pos; if (square && G.cam === 'room') untrack(() => { const t = petCam(); if (t) aim(t); }); });
  // mulai mandi, makan, atau atur: kamera kembali ke ruangan (sesudahnya pemain tetap boleh menggeser)
  let careOn = false;
  $effect(() => {
    const on = !!(G.bath || G.feeding || G.edit);
    if (on && !careOn) untrack(() => { if (G.cam !== 'room') G.cam = 'room'; });
    careOn = on;
  });
  const viewBox = $derived(vw && vh ? `${(cam.x - vw / 2 / cam.k).toFixed(1)} ${(cam.y - vh / 2 / cam.k).toFixed(1)} ${(vw / cam.k).toFixed(1)} ${(vh / cam.k).toFixed(1)}` : '-260 -170 520 500');

  const ptrs = new Map<number, { x: number; y: number }>();
  let drag: null | { x: number; y: number; lx: number; ly: number; moved: boolean; id: number } = null;
  let pinch: null | { d: number; k: number; wx: number; wy: number } = null;
  let suppressAt = 0;
  /** lihat dari sisi seberang (cermin, lewat CSS): hanya desktop (tombolnya ada di panel kamera), tidak saat mengatur ruangan / denah */
  const mirrored = $derived(!square && G.mirror && wide && !G.edit && !G.plan);
  /** jarak mendatar dari tengah layar (px), dibalik saat cermin */
  const offX = (sx: number, r: DOMRect) => (mirrored ? -1 : 1) * (sx - r.left - vw / 2);
  const world = (sx: number, sy: number, c = cam) => {
    const r = wrapEl!.getBoundingClientRect();
    return [c.x + offX(sx, r) / c.k, c.y + (sy - r.top - vh / 2) / c.k];
  };
  /** mode Atur denah: ruangan yang sedang digeser */
  let roomDrag: null | { id: string; pid: number; x0: number; y0: number; lx: number; ly: number; gx0: number; gy0: number; moved: boolean } = null;
  function down(e: PointerEvent) {
    if (G.bath && mode === 'home') return bathDown(e);
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (planning && G.plan) {
      // jari kedua saat menyeret ruangan: batalkan seretan (ruangan kembali) lalu cubit untuk zoom
      if (roomDrag) {
        movePlanRoom(roomDrag.id, roomDrag.gx0, roomDrag.gy0);
        ptrs.set(roomDrag.pid, { x: roomDrag.lx, y: roomDrag.ly });
        roomDrag = null;
      } else if (!ptrs.size) {
        // hanya ruangan yang sudah dipilih yang bisa diseret; ruangan lain diketuk dulu (seret di tempat lain = geser kamera)
        const el = (e.target as Element).closest('[data-r]') as SVGElement | null;
        const id = el?.dataset.r;
        const at = id !== undefined ? G.plan.pos[id] : undefined;
        if (id !== undefined && at && G.plan.sel === id) {
          roomDrag = { id, pid: e.pointerId, x0: e.clientX, y0: e.clientY, lx: e.clientX, ly: e.clientY, gx0: at.gx, gy0: at.gy, moved: false };
          try { svgEl?.setPointerCapture(e.pointerId); } catch { /* tidak apa */ }
          return;
        }
      }
    }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, id: e.pointerId };
    else if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      const [wx, wy] = world((a.x + b.x) / 2, (a.y + b.y) / 2);
      pinch = { d: Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), k: cam.k, wx, wy };
      drag = null;
    }
  }
  function panMove(e: PointerEvent) {
    if (roomDrag && roomDrag.pid === e.pointerId) {
      roomDrag.lx = e.clientX; roomDrag.ly = e.clientY;
      // geser layar → geser petak (kebalikan proyeksi isometrik), lompat ke letak terdekat yang tidak bertumpuk
      const dx = (e.clientX - roomDrag.x0) / cam.k, dy = (e.clientY - roomDrag.y0) / cam.k;
      if (!roomDrag.moved && Math.hypot(e.clientX - roomDrag.x0, e.clientY - roomDrag.y0) > 8) roomDrag.moved = true;
      if (!roomDrag.moved) return;
      const ux = Math.round((dx / HOUSE_T + dy / (HOUSE_T / 2)) / 2), uy = Math.round((dy / (HOUSE_T / 2) - dx / HOUSE_T) / 2);
      movePlanRoom(roomDrag.id, roomDrag.gx0 + ux, roomDrag.gy0 + uy);
      return;
    }
    if (!ptrs.has(e.pointerId) || (G.bath && mode === 'home')) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()];
      const [lo, hi] = kRange();
      const k = Math.max(lo, Math.min(hi, (pinch.k * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.d));
      const r = wrapEl!.getBoundingClientRect();
      const mx = offX((a.x + b.x) / 2, r), my = (a.y + b.y) / 2 - r.top - vh / 2;
      cancelAnimationFrame(camRaf);
      cam = clampCam({ k, x: pinch.wx - mx / k, y: pinch.wy - my / k });
      if (G.cam !== 'free') G.cam = 'free';
      return;
    }
    if (!drag || drag.id !== e.pointerId) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 9) {
      drag.moved = true;
      menu = null;
      cancelAnimationFrame(camRaf);
      try { svgEl?.setPointerCapture(e.pointerId); } catch { /* sudah dilepas */ }
    }
    if (drag.moved) {
      cam = clampCam({ ...cam, x: cam.x - ((mirrored ? -1 : 1) * (e.clientX - drag.lx)) / cam.k, y: cam.y - (e.clientY - drag.ly) / cam.k });
      if (G.cam !== 'free') G.cam = 'free';
    }
    drag.lx = e.clientX; drag.ly = e.clientY;
  }
  function panUp(e: PointerEvent) {
    if (roomDrag && roomDrag.pid === e.pointerId) { if (roomDrag.moved) suppressAt = Date.now(); roomDrag = null; return; }
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (drag?.moved || pinch) suppressAt = Date.now();
    if (!ptrs.size) { drag = null; pinch = null; }
    else if (ptrs.size === 1) { const [[id, p]] = [...ptrs.entries()]; pinch = null; drag = { x: p.x, y: p.y, lx: p.x, ly: p.y, moved: true, id }; }
  }
  $effect(() => {
    const el = svgEl;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (G.bath && mode === 'home') return;
      e.preventDefault();
      wake();
      const [lo, hi] = kRange();
      const k = Math.max(lo, Math.min(hi, cam.k * Math.exp(-e.deltaY * 0.0015)));
      const [wx, wy] = world(e.clientX, e.clientY);
      const r = wrapEl!.getBoundingClientRect();
      cancelAnimationFrame(camRaf);
      cam = clampCam({ k, x: wx - offX(e.clientX, r) / k, y: wy - (e.clientY - r.top - vh / 2) / k });
      menu = null;
      if (G.cam !== 'free') G.cam = 'free';
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  });

  /* ---------------- pet lain di rumah: tamu yang sedang live & pet sendiri saat berkunjung ---------------- */
  type Comp = { id: string; name: string; look: any; wear: any[]; state?: any; live: [number, number]; tile: string; path: [number, number][]; speed: number; flip: boolean; pose?: string; target: string; self?: boolean };
  const SELF = '__me';
  const comps = new Map<string, Comp>();
  const missing = new Map<string, number>();
  let compVer = $state(0);
  let compRaf = 0, compLast = 0;
  let selfBusy = false;

  function placeComp(c: Comp) {
    const el = svgEl?.querySelector(`[data-o="${c.id}"]`) as SVGGElement | null;
    if (!el) return;
    el.setAttribute('transform', tf(c.live));
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
      if (tk !== c.tile) {
        c.tile = tk; retile = true;
        // kamera saat berkunjung mengikuti ruangan pet sendiri
        if (c.self) { const r = roomAt(c.live); if (r && r.id !== visitFocus) visitFocus = r.id; }
      }
      placeComp(c);
      if (c.self && mode === 'visit') follow(dt);
    }
    if (retile) compVer++;
    compRaf = moving ? requestAnimationFrame(compTick) : 0;
    if (!moving) for (const c of comps.values()) placeComp(c);
  }
  function compGo() { if (!compRaf) { compLast = performance.now(); compRaf = requestAnimationFrame(compTick); } }
  function compWalk(c: Comp, goals: [number, number][], sp = 1.6) {
    const p = routeFrom(c.live, goals);
    if (!p || !p.length) return Promise.resolve(false);
    c.path = p; c.speed = Math.max(sp, p.length / 4);
    compGo();
    return new Promise<boolean>((res) => { const t0 = Date.now(); const chk = () => (c.path.length && Date.now() - t0 < 12000 ? setTimeout(chk, 90) : res(true)); chk(); });
  }
  /** petak yang sedang ditempati pet lain (supaya tidak bertumpuk) */
  const takenTiles = (except: string, gap = false) => {
    const t = new Set<string>();
    const mark = (p: [number, number]) => {
      const x = Math.floor(p[0]), y = Math.floor(p[1]);
      t.add(`${x},${y}`);
      // jarak antarpet: petak di sekelilingnya juga dihindari (pet lebih lebar dari satu petak)
      if (gap) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) t.add(`${x + dx},${y + dy}`);
    };
    for (const c of comps.values()) if (c.id !== except) { mark(c.live); if (c.path.length) mark(c.path[c.path.length - 1]); }
    if (live && !hideMain) mark(live);
    return t;
  };
  /** angka acak tetap per pemain (supaya tiap tamu memilih petak berbeda walau belum saling melihat) */
  const hashOf = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  /** petak kosong di sekitar pet tuan rumah, di ruangan yang sama (jarak 1–3, lebih jauh di ruangan besar) */
  function spotNearHost(except: string, min = 1, max?: number, seed?: string) {
    const h = hostAt();
    const hr = roomAt(h) ?? plan.rooms[0];
    if (!hr) return null;
    const mx = max ?? Math.max(3, Math.round(hr.size / 3));
    const tiles = freeIn(hr.id);
    const pick = (taken: Set<string>) => tiles.filter(([x, y]) => {
      if (taken.has(`${x},${y}`)) return false;
      if (!h) return true;
      const d = Math.abs(x + 0.5 - h[0]) + Math.abs(y + 0.5 - h[1]);
      return d >= min && d <= mx;
    });
    const loose = takenTiles(except);
    let near = pick(takenTiles(except, true));
    if (!near.length) near = pick(loose);
    const pool = near.length ? near : tiles.filter(([x, y]) => !loose.has(`${x},${y}`));
    if (seed && pool.length) return [...pool].sort((a, b) => hashOf(seed + a.join(',')) - hashOf(seed + b.join(',')))[0];
    return pool[Math.floor(Math.random() * pool.length)] ?? null;
  }
  /** posisi pet tuan rumah (dari sinkron bila ia sedang di rumah, selain itu pet utama) */
  const hostAt = (): [number, number] | null => (hostMember ? comps.get(hostMember.id)?.live ?? null : live);

  // pet sendiri ikut berkunjung
  function ensureSelf() {
    if (mode !== 'visit' || !G.me?.pet || comps.has(SELF) || !plan.rooms.length) return;
    const t = spotNearHost(SELF, 1, undefined, G.me.user.id);
    const at: [number, number] = t ? [t[0] + 0.5, t[1] + 0.5] : spotIn(plan.rooms[0].id);
    comps.set(SELF, { id: SELF, name: G.me.pet.name, look: G.me.pet, wear: wearItems(G.me.pet.wear), state: petLook(G.me.pet), live: at, tile: tileOf(at), path: [], speed: 1.6, flip: true, target: '', self: true });
    visitFocus = roomAt(at)?.id ?? '';
    compVer++;
  }
  $effect(() => { void G.visit?.owner?.id; void planSig; untrack(() => { if (mode === 'visit') { comps.delete(SELF); ensureSelf(); } }); });
  // tamu (atau tuan rumah) yang sedang live: posisinya dikirim per ruangan lalu dipetakan ke denah
  $effect(() => {
    const ms = H.members;
    void planSig;
    untrack(() => {
      let changed = false;
      const keep = new Set([SELF]);
      for (const m of ms) {
        if (!m.pet) continue;
        keep.add(m.id);
        const tgt = toHouse((m as any).roomId ?? '', m.x, m.y);
        let c = comps.get(m.id);
        if (!c) { c = { id: m.id, name: m.name, look: m.pet, wear: wearItems(m.pet.wear), state: m.pet.state, live: [...tgt], tile: tileOf(tgt), path: [], speed: 1.7, flip: m.flip, target: '' }; comps.set(m.id, c); changed = true; }
        else { c.look = m.pet; c.state = m.pet.state; c.name = m.name; c.wear = wearItems(m.pet.wear); }
        const pz = m.act === 'duduk' ? 'duduk' : m.act === 'joget' ? 'joget' : undefined;
        if (pz !== c.pose) { c.pose = pz; changed = true; }
        const tk = `${tgt[0].toFixed(2)},${tgt[1].toFixed(2)}`;
        if (tk !== c.target) {
          c.target = tk;
          const d = Math.hypot(tgt[0] - c.live[0], tgt[1] - c.live[1]);
          if (d > 16) { c.live = [...tgt]; c.path = []; c.tile = tileOf(tgt); changed = true; }
          else if (d > 1.5) {
            // jauh: jalan menyusuri jalur (tidak menembus benda), cukup cepat supaya sampai sebelum sinkron berikutnya
            const route = routeFrom(c.live, [[Math.floor(tgt[0]), Math.floor(tgt[1])]]);
            c.path = route && route.length ? [...route.slice(0, -1), tgt] : [tgt];
            const len = c.path.reduce((acc, q, i) => acc + Math.hypot(q[0] - (i ? c.path[i - 1][0] : c.live[0]), q[1] - (i ? c.path[i - 1][1] : c.live[1])), 0);
            c.speed = Math.max(1.7, len / 1.1);
            compGo();
          }
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
      const pick = spotNearHost(SELF, 1);
      if (pick) compWalk(me, [pick]);
    }, 4500);
    // tamu yang sudah pergi dihapus walau sinkron berikutnya masih lama (tuan rumah sendirian dicek tiap 8 detik)
    const sweep = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [id, since] of missing) if (now - since > 2500) { comps.delete(id); missing.delete(id); changed = true; }
      if (changed) compVer++;
    }, 1000);
    // laporkan posisi pet ke rumah live (ruangan + posisi di dalam ruangan itu)
    const rep = setInterval(reportPos, 200);
    return () => { clearInterval(selfWander); clearInterval(rep); clearInterval(sweep); cancelAnimationFrame(compRaf); };
  });
  function reportPos() {
      const me = comps.get(SELF);
      const at = mode === 'visit' ? me?.live : live;
      if (!at) return;
      const r = roomAt(at) ?? plan.rooms[0];
      H.roomId = r?.id ?? '';
      H.pos.x = +(at[0] - (r?.gx ?? 0)).toFixed(2);
      H.pos.y = +(at[1] - (r?.gy ?? 0)).toFixed(2);
      if (mode === 'visit' && me) { H.pos.flip = me.flip; H.pos.act = me.pose ?? (me.path.length ? 'jalan' : H.pos.act === 'jalan' ? null : H.pos.act); }
      else { H.pos.flip = flip; H.pos.act = pose?.pose === 'duduk' || pose?.pose === 'naik' || pose?.pose === 'ayun' ? 'duduk' : pose?.pose === 'joget' ? 'joget' : pose?.pose === 'lihat' ? 'lihat' : walking ? 'jalan' : null; }
  }
  // masuk rumah live (tamu: rumah teman; tuan rumah: rumah sendiri)
  let entered = '';
  $effect(() => {
    const hid = square ? SQUARE : mode === 'visit' ? G.visit?.owner?.id : G.me?.user?.id;
    if (!hid || (mode === 'visit' && G.visit?.together && !G.visit.together.on)) return;
    // posisi sekarang dikirim di sinkron pertama (bukan posisi dari tempat sebelumnya)
    untrack(() => { H.pos.act = null; reportPos(); enterHouse(hid, focusId); entered = hid; });
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
      const around: [number, number][] = [[hx + 1, hy], [hx, hy + 1], [hx - 1, hy], [hx, hy - 1]];
      const side = around.filter(([x, y]) => !taken.has(`${x},${y}`) && plan.pass(hx, hy, x, y));
      await compWalk(me, side.length ? side : around);
      const sx = (h[0] - me.live[0]) - (h[1] - me.live[1]);
      if (Math.abs(sx) > 0.01) { me.flip = sx < 0; placeComp(me); }
    }
    H.pos.act = kind;
    hbubble(H.me || 'me', { text: ACT_SAY[kind] ?? 'Halo!' }, 2600);
    if (kind === 'kejar') {
      for (let i = 0; i < 3; i++) {
        const mine = freeIn(roomAt(me.live)?.id);
        const far = mine.filter(([x, y]) => Math.abs(x + 0.5 - me.live[0]) + Math.abs(y + 0.5 - me.live[1]) >= 2);
        const pick = far[Math.floor(Math.random() * far.length)];
        if (!hideMain && pick && live) { const hostTiles = freeIn(roomAt(live)?.id); const t2 = hostTiles[Math.floor(Math.random() * hostTiles.length)]; if (t2) walkTo(t2[0], t2[1]); }
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
  $effect(() => {
    const q = H.actReq;
    if (!q) return;
    untrack(() => {
      H.actReq = null;
      if (!square) return doVisitAct(q.kind, q.itemId);
      if (q.kind === 'joget') return doJoget();
      // dari daftar Main di bar alun-alun: "<aksi>@<indeks benda>"
      const [act, idx] = String(q.kind).split('@');
      const t: Target = { room: ALUN_ROOM, index: Number(idx) };
      const a = activitiesFor(t).find((x: any) => x.id === act);
      if (a && !a.off) doSquareAct(a, t); else if (a?.off) toast(a.note);
    });
  });

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
      // tidak ada pet lain & gelembung: tidak perlu menghitung posisi
      if (document.hidden || (!comps.size && !H.bubbles.length && !square)) { if (tags.length) tags = []; return; }
      const w = wrapEl?.getBoundingClientRect();
      if (!w) return;
      const bp: Record<string, { x: number; y: number }> = {};
      for (const b of H.bubbles) {
        const r = rectOf(b.who);
        if (r) bp[b.who] = { x: Math.max(70, Math.min(w.width - 70, r.left + r.width / 2 - w.left)), y: Math.max(48, r.top - w.top + 6) };
      }
      bpos = bp;
      let tg: (typeof tags[number] & { far: number })[] = [];
      const meAt = square ? live : null;
      // di alun-alun: label pet sendiri juga, dan yang sedang bicara selalu diberi label
      const talking = new Set(H.bubbles.map((b) => b.who));
      const list: { id: string; el: Element | null | undefined; name: string; self: boolean; at: [number, number] }[] = [...comps.values()].map((c) => ({ id: c.id, el: svgEl?.querySelector(`[data-o="${c.id}"]`), name: c.self ? `${c.name} (kamu)` : c.name, self: !!c.self, at: c.live }));
      if (square && live && G.me?.pet) list.push({ id: SELF, el: petEl(), name: `${G.me.pet.name} (kamu)`, self: true, at: live });
      for (const c of list) {
        const r = c.el?.getBoundingClientRect();
        if (r && r.bottom > w.top && r.top < w.bottom && r.right > w.left && r.left < w.right) tg.push({ id: c.id, x: r.left + r.width / 2 - w.left, y: r.bottom - w.top + 2, name: c.name, self: c.self, far: c.self || talking.has(c.id) ? -1 : meAt ? Math.hypot(c.at[0] - meAt[0], c.at[1] - meAt[1]) : 0 });
      }
      // ramai (alun-alun): label hanya untuk diri sendiri, yang bicara, dan pet terdekat; saat melihat seluruh alun-alun lebih sedikit
      if (square) tg = tg.sort((a, b) => a.far - b.far).slice(0, G.cam === 'house' ? 4 : 8);
      // label yang bertumpuk digeser sedikit (paling banyak 2 baris); yang masih bertumpuk disembunyikan
      tg.sort((a, b) => (a.self === b.self ? a.y - b.y : a.self ? -1 : 1));
      const out: typeof tags = [];
      for (const t of tg) {
        for (let k = 0; k < 3; k++) {
          const y = t.y + k * 19;
          if (out.some((o) => Math.abs(o.x - t.x) < 76 && Math.abs(o.y - y) < 19)) continue;
          out.push({ id: t.id, x: t.x, y, name: t.name, self: t.self });
          break;
        }
      }
      tags = out;
    }, square ? 120 : 80);
    return () => clearInterval(t);
  });

  /* ---------------- tidur dengan lampu mati ---------------- */

  /** Pet berjalan ke kasur (di ruangan ini dulu, lalu ruangan lain) lalu tidur; tanpa kasur tidur di lantai. */
  async function goToBed(instant = false) {
    if (!live) return;
    const gen = planGen;
    halt();
    menu = null;
    const here = roomAt(live)?.id;
    const order = [...plan.rooms].sort((a, b) => (a.id === here ? -1 : b.id === here ? 1 : a.i - b.i));
    let bed: { r: (typeof plan.rooms)[number]; p: any; it: any } | null = null;
    for (const r of order) {
      const lay = layoutOf(roomOf(r.id));
      const p = lay.find((q) => { const it = item(q.i); return it?.art?.type === 'builtin' && it.art.key === 'kasur'; });
      if (p) { bed = { r, p, it: item(p.i) }; break; }
    }
    if (bed) {
      const { r, p } = bed;
      const f = footprint(bed.it);
      const goals: [number, number][] = [];
      for (let a = 0; a < f.w; a++) goals.push([p.x + a, p.y - 1], [p.x + a, p.y + f.d]);
      for (let b = 0; b < f.d; b++) goals.push([p.x - 1, p.y + b], [p.x + f.w, p.y + b]);
      const g = goals.filter(([x, y]) => x >= 0 && y >= 0 && x < r.size && y < r.size).map(([x, y]) => [x + r.gx, y + r.gy] as [number, number]);
      if (!instant) { const q = routeToAny(g); if (q) await walkPath(q); }
      if (!untrack(() => asleep) || gen !== planGen) return;
      if (!bedSpot) bedSpot = live ? [...live] as [number, number] : null;
      const c: [number, number] = [r.gx + p.x + f.w / 2, r.gy + p.y + f.d / 2];
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
  // keadaan awal saat rumah dibuka sudah ditangani penempatan pet (langsung di kasur); ini hanya untuk perubahan
  let wasAsleep: boolean | null = null;
  $effect(() => {
    const a = asleep;
    if (wasAsleep === null || a === wasAsleep) { wasAsleep = a; return; }
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

  type Target = { room: string; index?: number; spot?: RoomSpot };
  let menu = $state<null | { x: number; y: number; title: string; acts: any[]; target: Target }>(null);
  const SLEEP_ACT = { id: '__sleep', name: 'Tidur sampai segar', effects: {}, cooldown_sec: 0, note: 'Matikan lampu' };
  const placedAt = (t: Target) => layoutOf(roomOf(t.room))[t.index ?? -1];

  function activitiesFor(t: Target) {
    const list = G.catalog?.activities ?? [];
    if (t.spot) return plan.byId.get(t.room)?.outdoor ? [] : list.filter((a: any) => activityFits(a.targets, null, t.spot));
    const it = itemOf(placedAt(t)?.i);
    if (square) {
      // alun-alun: aksi tetap per benda (lihat SQUARE_ACTS)
      const key = it?.art?.type === 'builtin' ? it.art.key : '';
      return (SQUARE_ACTS[key] ?? []).map((a) => {
        if (a.id === 'jajan' && it && SQUARE_SNACKS[it.id]) return { ...a, name: `Jajan ${SQUARE_SNACKS[it.id].name}`, note: `${SQUARE_SNACKS[it.id].coins} koin`, item: it.id };
        if (a.id === 'nonton' && show && !show.playing) return { ...a, off: true, note: `${show.next.name} mulai ${Math.max(1, Math.ceil((show.until - serverNow()) / 1000))} dtk lagi` };
        if (a.id === 'nonton' && show) return { ...a, note: `Sedang tampil: ${show.name}` };
        return { ...a, note: a.id === 'foto' ? 'Bersama pet di dekatmu' : '' };
      });
    }
    const acts = list.filter((a: any) => activityFits(a.targets, it as any));
    // kasur & lampu: matikan lampu untuk tidur sungguhan
    const key = it?.art?.type === 'builtin' ? it.art.key : '';
    return key === 'kasur' || key === 'lampu' ? [SLEEP_ACT, ...acts] : acts;
  }

  function goalsFor(t: Target): { goals: [number, number][]; center: [number, number] | null; faceTo: [number, number] | null; flipTo: boolean | null } {
    const r = plan.byId.get(t.room);
    if (!r) return { goals: [], center: null, faceTo: null, flipTo: null };
    // tujuan hanya di dalam ruangan itu (tidak dari balik dinding)
    const inRoom = (g: [number, number][]) => g.filter(([x, y]) => x >= 0 && y >= 0 && x < r.size && y < r.size).map(([x, y]) => [x + r.gx, y + r.gy] as [number, number]);
    if (t.spot) return { goals: inRoom([...ROOM_SPOTS[t.spot].tiles(r.size)]), center: null, faceTo: null, flipTo: ROOM_SPOTS[t.spot].flip };
    const p = placedAt(t);
    if (!p) return { goals: [], center: null, faceTo: null, flipTo: null };
    const f = footprint(itemOf(p.i));
    const goals: [number, number][] = [];
    for (let a = 0; a < f.w; a++) goals.push([p.x + a, p.y - 1], [p.x + a, p.y + f.d]);
    for (let b = 0; b < f.d; b++) goals.push([p.x - 1, p.y + b], [p.x + f.w, p.y + b]);
    if (f.flat) for (let a = 0; a < f.w; a++) for (let b = 0; b < f.d; b++) goals.push([p.x + a, p.y + b]);
    const center: [number, number] = [r.gx + p.x + f.w / 2, r.gy + p.y + f.d / 2];
    return { goals: inRoom(goals), center, faceTo: center, flipTo: null };
  }

  function openMenu(e: MouseEvent, t: Target) {
    if (acting) return;
    const acts = activitiesFor(t);
    const title = t.spot ? ACTIVITY_SPOTS[t.spot] : itemOf(placedAt(t)?.i)?.name ?? 'Mebel';
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
    if (square) return doSquareAct(a, t);
    menu = null;
    if (acting || G.busy) return;
    if (a.id === '__sleep') { await setSleep(true); return; }
    if ((a.min_level ?? 1) > G.me.pet.level) { sfx.error(); toast(`Terbuka di Lv ${a.min_level}.`, 'error'); return; }
    const anim = ACTIVITY_ANIMS[a.anim] ?? ACTIVITY_ANIMS.lihat;
    const g = goalsFor(t);
    acting = true;
    clearTimeout(idleTimer);
    // permintaan ke server berjalan bersamaan dengan pet berjalan, supaya terasa cepat
    const gen = planGen;
    const req = run(() => post('/api/activity', { activityId: a.id, roomId: t.room || undefined, ...(t.spot ? { spot: t.spot } : { index: t.index }) }));
    const p = routeToAny(g.goals);
    if (p) await walkPath(p);
    const r: any = await req;
    // denah berubah selama berjalan (ruangan diperluas / denah diatur): koordinat tujuan sudah usang
    if (gen !== planGen) { if (r) G.cool['act:' + a.id] = Date.now() + (r.result?.cooldownSec ?? a.cooldown_sec ?? 0) * 1000; return; }
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
    if (gen !== planGen) return;
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

  /* ---------------- alun-alun: main di benda, joget, panggung ---------------- */

  /** acara panggung sekarang (dari jam server: semua orang melihat yang sama) */
  const show = $derived(square ? squareShow(serverNow()) : null);
  // jam berubah tiap detik: yang bergantung pada acara cukup memakai kunci ini (tidak dihitung ulang tiap detik)
  const showKey = $derived(show ? `${show.key}|${show.playing}` : '');
  const music = $derived(!!show?.music);
  /** komponen masih tampil (aktivitas yang masih berjalan berhenti diam-diam setelah keluar) */
  let alive = true;
  onDestroy(() => { alive = false; });

  async function doSquareAct(a: any, t: Target) {
    menu = null;
    if (acting || G.busy) return;
    const g = goalsFor(t);
    const gen = planGen;
    acting = true;
    clearTimeout(idleTimer);
    const p = routeToAny(g.goals);
    if (p) await walkPath(p);
    if (gen !== planGen || !alive) return;
    if (g.faceTo && live) { const sx = (g.faceTo[0] - live[0]) - (g.faceTo[1] - live[1]); if (Math.abs(sx) > 0.01) flip = sx < 0; }
    if (a.id === 'ular' || a.id === 'karung') {
      // tikar ular tangga / garis start: ajak main bareng orang di alun-alun
      acting = false; scheduleIdle();
      await startGame(a.id);
      return;
    }
    if (a.id === 'foto') {
      // foto bareng dengan pet di sekitar (pratinjau foto muncul sendiri)
      pose = { pose: 'lihat', lift: 0 };
      await takePhoto('senyum');
      pose = null; acting = false; scheduleIdle();
      return;
    }
    const r: any = await run(() => api.post('/api/square/act', { kind: a.id, item: a.item }));
    if (!alive) return;
    if (!r) { acting = false; scheduleIdle(); return; }
    const anim = ACTIVITY_ANIMS[a.anim] ?? ACTIVITY_ANIMS.lihat;
    const standAt: [number, number] | null = live ? [...live] : null;
    // naik komidi putar: duduk di pinggir piringan (bukan di tiang tengah); ayunan & bangku: di tengahnya
    const seat: [number, number] | null = anim.on && g.center ? (a.id === 'naik' ? [g.center[0] + 0.85, g.center[1] + 0.85] : g.center) : null;
    if (seat) { live = [...seat]; pos = [...seat]; }
    pose = { pose: a.id === 'naik' || a.id === 'ayun' ? a.id : a.anim, lift: anim.on ? anim.lift : 0 };
    queueMicrotask(place);
    if (r.kind === 'jajan') { sfx.eat(); fx('food'); } else sfx.pop();
    const beats = Math.max(2, Math.round(anim.ms / 700));
    for (let i = 0; i < beats; i++) { if (!alive) return; fx((r.kind === 'jajan' ? 'food' : a.id === 'nonton' ? 'notes' : anim.fx) as any); await sleep(anim.ms / beats + 200); }
    if (gen !== planGen || !alive) return;
    pose = null;
    if (seat && standAt) { live = standAt; pos = [...standAt]; }
    queueMicrotask(place);
    if (r.kind === 'jajan') toast(`Nyam, ${r.snack}! ${G.me.pet.name} kenyang & ceria.`, 'good');
    else toast(r.rewarded ? `+${r.coins} koin${r.xp ? `, +${r.xp} XP` : ''} · sisa main berhadiah hari ini ${r.left}` : `${G.me.pet.name} senang! (hadiah main hari ini sudah habis)`, 'good');
    if (r.coins) sfx.coin();
    if (r.levelUp) { sfx.level(); toast(`Naik ke Lv ${r.levelUp}!`, 'good'); }
    acting = false;
    scheduleIdle();
  }

  /** Joget saat musik di panggung: pet joget 6 detik; makin banyak yang joget bareng, makin ceria. */
  async function doJoget() {
    if (!square || !live) return;
    if (acting || G.busy) { toast(`${G.me.pet.name} masih asyik. Joget sebentar lagi, ya.`); return; }
    if (!show?.music) { toast('Joget saat ada musik di panggung, ya.'); return; }
    halt();
    acting = true;
    pose = { pose: 'joget', lift: 0 };
    queueMicrotask(place);
    const r: any = await run(() => api.post('/api/square/act', { kind: 'joget' }));
    for (let i = 0; i < 4; i++) { if (!alive) return; fx('notes'); await sleep(1500); }
    if (!alive) return;
    pose = null;
    queueMicrotask(place);
    acting = false;
    scheduleIdle();
    if (r) {
      toast(`${r.crowd >= 3 ? `Joget bareng ${r.crowd} pet! ` : ''}${r.rewarded ? `+${r.coins} koin` : 'Asyik!'}`, 'good');
      if (r.coins) sfx.coin();
    }
  }

  // pengisi acara di panggung (pet kampung) sesuai acara yang sedang tampil
  const NPC_LOOKS = [{ color: '#F2C94C', ear: 'kucing', eyes: 'bulat' }, { color: '#9FD3C2', ear: 'kelinci' }, { color: '#E7A6C8', ear: 'tunas' }];
  const SHOW_PROPS: Record<string, (string | undefined)[]> = { orkes: ['gitar', 'kendang', 'gitar'], wayang: ['wayang', undefined, 'wayang'], tari: ['payungtari', 'payungtari', 'payungtari'], sulap: [undefined, 'topi', undefined] };
  const NPC_AT: [number, number][] = [[8.9, 1.25], [10, 1.35], [11.1, 1.25]];
  const npcDraws = $derived.by(() => {
    const [key, playing] = showKey.split('|');
    if (!square || playing !== 'true') return [] as Draw[];
    const props = SHOW_PROPS[key] ?? [];
    const dance = key === 'tari';
    return NPC_AT.map((p, i) => {
      const at = key === 'sulap' && i !== 1 ? null : p;
      if (!at) return null;
      return { key: `npc:${i}`, d: at[0] + at[1] + 0.03, h: petMarkup({ look: NPC_LOOKS[i] as any, wear: [], flip: i === 2, prop: props[i] }), pet: { cls: `npc ${dance ? 'pose-joget' : 'pose-tampil'}`, tf: tf(at, 22.6) } } as Draw;
    }).filter(Boolean) as Draw[];
  });
  // not musik melayang dari panggung saat musik dimainkan
  $effect(() => {
    if (!square || !music) return;
    const t = setInterval(() => { const [x, y] = houseIso(10, 1); spawn(x, y - 110, 'notes'); }, 1800);
    return () => clearInterval(t);
  });

  /* ---------------- mandi: gosok sabun lalu bilas ---------------- */

  let scrubbing = false, lastPt: [number, number] | null = null, foamN = 0;
  // titik layar → koordinat SVG (lewat kamera, jadi cermin ikut terhitung)
  function toSvg(cx: number, cy: number) {
    if (!svgEl || !wrapEl || !vw) return null;
    return world(cx, cy) as [number, number];
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

  /** petak lantai yang diketuk → koordinat rumah */
  function tileAt(el: SVGElement): [number, number] | null {
    const r = plan.byId.get(el.dataset.r ?? '');
    if (!r) return null;
    return [r.gx + Number(el.dataset.x), r.gy + Number(el.dataset.y)];
  }
  /** mode atur: ketuk ruangan lain untuk mengatur ruangan itu (bila belum ada perubahan) */
  function switchEdit(rid: string) {
    const cur = curRoom();
    const r = roomOf(rid);
    if (!r || !G.draft) return;
    if (JSON.stringify(cur?.layout ?? []) !== JSON.stringify(G.draft)) { sfx.error(); toast(`Simpan dulu perubahan di ${cur?.name ?? 'ruangan ini'} (tombol Selesai), lalu atur ruangan lain.`, 'error'); return; }
    G.roomId = rid;
    G.draft = (r.layout ?? []).map((p: any) => ({ ...p }));
    G.sel = -1;
    G.cam = 'room';
    sfx.tap();
  }

  function click(e: MouseEvent) {
    if (Date.now() - suppressAt < 300) return;
    const t = e.target as Element;
    if (G.bath && mode === 'home') return;
    if (planning && G.plan) {
      // ketuk ruangan untuk memilih; ketuk di luar rumah untuk melepas pilihan
      const r = t.closest('[data-r]') as SVGElement | null;
      G.plan.sel = r?.dataset.r ?? null;
      if (r) sfx.tap();
      return;
    }
    if (menu) { menu = null; if (!t.closest('.furn, .spot')) return; }
    const cr = t.closest('.crumb') as SVGElement | null;
    if (cr && homeLive) return sweepCrumb(Number(cr.dataset.c), e);
    if (t.closest('.pet')) return tapPet();
    const op = t.closest('.opet') as SVGElement | null;
    if (op) {
      const id = op.dataset.o!;
      // pet pemain lain: buka kartu profil (ajak berteman, kirim hati, laporkan / blokir / antar pulang)
      if (id !== SELF && H.members.some((m) => m.id === id)) { H.card = id; sfx.tap(); return; }
      fxAtComp(id, 'hearts'); sfx.pop(); if (id !== SELF) hemote('hati');
      return;
    }
    if (mode === 'home' && G.edit) {
      const f = t.closest('.furn') as SVGElement | null;
      if (f) { G.sel = Number(f.dataset.i); sfx.tap(); return; }
      const tile = t.closest('.tile') as SVGElement | null;
      if (tile && G.sel >= 0 && G.draft) {
        const x = Number(tile.dataset.x), y = Number(tile.dataset.y);
        const p = G.draft[G.sel];
        const it = item(p?.i);
        const size = plan.byId.get(editId ?? '')?.size ?? defSize();
        if (!it) return;
        if (!fits(it, x, y, G.draft, itemMap, size, G.sel)) { sfx.error(); toast('Tidak muat di situ.', 'error'); return; }
        G.draft[G.sel] = { ...p, x, y };
        sfx.pop();
        return;
      }
      const other = t.closest('[data-r]') as SVGElement | null;
      if (!tile && other && other.dataset.r !== undefined && other.dataset.r !== editId) switchEdit(other.dataset.r);
      return;
    }
    // pet tuan rumah yang tidur / beraktivitas tidak menghalangi tamu berjalan
    if ((mode === 'home' || square) && acting) return;
    if (mode === 'home' && asleep) { toast(`Ssst… ${petData.name} lagi tidur.`); return; }
    if (mode === 'home' || square) {
      const f = t.closest('.furn') as SVGElement | null;
      if (f) return openMenu(e, { room: f.dataset.r ?? '', index: Number(f.dataset.i) });
      const sp = t.closest('.spot') as SVGElement | null;
      if (sp && sp.dataset.spot && sp.dataset.spot in ROOM_SPOTS) return openMenu(e, { room: sp.dataset.r ?? '', spot: sp.dataset.spot as RoomSpot });
    }
    // ketuk lantai: pet berjalan ke sana, juga ke ruangan lain lewat pintu (saat berkunjung: pet sendiri)
    const fl = t.closest('.fl') as SVGElement | null;
    const at = fl ? tileAt(fl) : null;
    if (!at) return;
    if (mode === 'visit') { const me = comps.get(SELF); if (me && !selfBusy) { compWalk(me, [at]); sfx.tap(); } return; }
    if (walkTo(at[0], at[1])) sfx.tap();
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

  // tombol Kirim hati di kartu profil: efek hati di pet pemain itu
  $effect(() => { const r = H.fxReq; if (r) untrack(() => { fxAtComp(r.id, r.kind); sfx.pop(); }); });

  function key(e: KeyboardEvent) {
    wake();
    if (e.key === 'Escape') { if (menu) menu = null; else if (G.bath) G.bath = null; return; }
    // pintasan kamera (bukan saat mengetik, membuka panel, mengatur, mandi, atau main bareng)
    const t = e.target as HTMLElement | null;
    if (square || e.ctrlKey || e.metaKey || e.altKey || (t && (t.closest('input, textarea, select, [contenteditable]')))) return;
    if (G.sheet || G.edit || G.plan || G.bath || inGameNow()) return;
    const k = e.key.toLowerCase();
    if (k === '1') G.cam = 'near';
    else if (k === '2') G.cam = 'room';
    else if (k === '3') G.cam = 'yard';
    else if (k === '+' || k === '=') zoomBy(1.25);
    else if (k === '-' || k === '_') zoomBy(0.8);
    else if (k === 'r') setMirror(!G.mirror);
    else return;
    e.preventDefault();
  }

  /* ---------------- mode santai: lama tidak disentuh → kamera bergerak pelan di sekitar pet ---------------- */
  // ringan: hanya desktop, mulai setelah 30 detik diam, satu gerakan pelan (±30 fps) tiap 12 detik, berhenti sendiri setelah 3 menit
  let idleSince = performance.now();
  let santaiOn = false, santaiStep = 0;
  function wake() {
    idleSince = performance.now();
    if (santaiOn) { santaiOn = false; recam(); }
  }
  /** kembalikan kamera ke mode yang dipilih */
  function recam() {
    const m = G.cam;
    if (m === 'near') { const t = nearCam(); if (t) aim(t, false, 700); }
    else if (m === 'yard') aim(fit(viewBounds()), false, 700);
    else if (m === 'house') aim(fit(houseBounds(plan)), false, 700);
    else if (m === 'room') aim(fit(houseBounds(plan, focusId), true), false, 700);
  }
  $effect(() => {
    if (square || reduced) return;
    const t = setInterval(() => {
      const idle = performance.now() - idleSince;
      const ok = G.santai && wide && !document.hidden && !G.sheet && !G.edit && !G.plan && !G.bath && !G.feeding && !menu && !inGameNow() && G.cam !== 'free';
      if (!ok || idle < 30_000) { if (santaiOn && !ok) { santaiOn = false; recam(); } return; }
      if (idle > 180_000) { if (santaiOn) { santaiOn = false; recam(); } return; }
      santaiOn = true;
      const p = nearPos();
      if (!p) return;
      const [x, y] = houseIso(p[0], p[1]), i = insets(), [lo, hi] = kRange();
      // bergantian: dekat ke pet (agak dari kiri / kanan), lalu ruangan agak lebar
      const shots = [
        { k: kRoom() * 1.9, dx: -40 }, { k: kRoom() * 1.05, dx: 0 }, { k: kRoom() * 1.6, dx: 46 }, { k: kRoom() * 0.8, dx: 0 },
      ];
      const sh = shots[santaiStep++ % shots.length], k = Math.max(lo, Math.min(hi, sh.k));
      aim({ k, x: x + sh.dx - (i.l - i.r) / 2 / k, y: y - 40 - (i.t - i.b) / 2 / k }, false, 4000, true);
    }, 12_000);
    return () => clearInterval(t);
  });

  /* ---------------- mata mengikuti jari / mouse ---------------- */
  function lookAt(cx: number, cy: number) {
    const r = petEl()?.getBoundingClientRect();
    if (!r || !svgEl || asleep) return;
    const dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height * 0.4);
    const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 160);
    svgEl.style.setProperty('--lx', `${((dx / d) * 4.5 * k * (flip ? -1 : 1) * (mirrored ? -1 : 1)).toFixed(2)}px`);
    svgEl.style.setProperty('--ly', `${((dy / d) * 3 * k).toFixed(2)}px`);
  }
  function onPointer(e: PointerEvent) {
    wake();
    lookAt(e.clientX, e.clientY);
    bathMove(e);
    panMove(e);
  }
  function onUp(e: PointerEvent) { bathUp(); panUp(e); }
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

  const menuStyle = $derived.by(() => {
    if (!menu || !wrapEl) return '';
    const w = wrapEl.clientWidth, h = wrapEl.clientHeight;
    // tidak menimpa HUD atas, tombol aksi kanan (desktop) & bar bawah (aksi / alun-alun / tamu)
    const i = insets(), minTop = wide ? 92 : 100;
    const left = Math.max(8, Math.min(w - (wide ? i.r : 8) - 240, menu.x - 120));
    const tall = 64 * menu.acts.length + 40, bottom = h - Math.max(90, i.b);
    const down = menu.y + 18;
    const top = menu.y > h * 0.55 || down + tall > bottom ? Math.max(minTop, menu.y - 18 - tall) : Math.max(minTop, down);
    return `left:${left}px;top:${top}px`;
  });
  /* ---------------- mode Atur denah: garis ruangan terpilih, ruangan terpisah, nama ruangan ---------------- */
  /* ---------------- suasana set premium (≥ bonusMin item berbeda dari set yang sama dalam satu ruangan) ---------------- */
  const moodHtml = $derived.by(() => {
    if (square || planning) return '';
    const min = Number(settings().premium?.bonusMin ?? 3);
    const setOf = (id: string) => item(id)?.data?.set as string | undefined;
    let out = '';
    for (const r of rooms) {
      const pr = plan.byId.get(r.id);
      if (!pr) continue;
      const k = roomMood([...layoutOf(r).map((p: any) => p.i), r.wall, r.floor], setOf, min);
      if (k) out += moodSvg(k, pr);
    }
    return out;
  });
  function moodSvg(key: string, r: { gx: number; gy: number; size: number; outdoor?: boolean }) {
    const at = (u: number, v: number, up = 0) => { const p = houseIso(r.gx + u * r.size, r.gy + v * r.size); return [p[0], p[1] - up]; };
    const fl = [at(0, 0), at(1, 0), at(1, 1), at(0, 1)].map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ');
    const fr = (k: number, m: number) => ((k * m) % 1 + 1) % 1;
    const pts = (n: number, hi: number) => Array.from({ length: n }, (_, k) => at(0.1 + fr(k, 0.618) * 0.8, 0.1 + fr(k, 0.382) * 0.8, 12 + fr(k, 0.271) * hi));
    const blink = (k: number) => `class="blink" style="animation-delay:-${((k * 0.37) % 1.7).toFixed(2)}s"`;
    let o = '';
    if (key === 'tamanmalam') {
      o += `<polygon points="${fl}" fill="#2B3A6B" fill-opacity=".16"/>`;
      pts(9, 70).forEach(([x, y], k) => (o += `<g ${blink(k)}><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="#EFFF7A" fill-opacity=".28"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.4" fill="#EFFF7A"/></g>`));
    } else if (key === 'keraton') {
      o += `<polygon points="${fl}" fill="#FFD27A" fill-opacity=".12"/>`;
      pts(7, HOUSE_WALL_H * 0.7).forEach(([x, y], k) => (o += `<path ${blink(k)} transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" d="M0 -6L1.6 -1.6 6 0 1.6 1.6 0 6-1.6 1.6-6 0-1.6-1.6Z" fill="#FFE27A"/>`));
    } else if (key === 'kafe') {
      o += `<polygon points="${fl}" fill="#F2994A" fill-opacity=".1"/>`;
      pts(4, 40).forEach(([x, y], k) => (o += `<circle ${blink(k)} cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="22" fill="#FFE7A0" fill-opacity=".16"/>`));
    } else if (key === 'pantai') {
      const top = at(0, 0, HOUSE_WALL_H);
      for (let k = 0; k < 4; k++) { const a = at(0.15 + k * 0.2, 1), b = at(0.3 + k * 0.2, 1); o += `<polygon points="${(top[0] + 30 + k * 26).toFixed(1)},${top[1].toFixed(1)} ${a[0].toFixed(1)},${a[1].toFixed(1)} ${b[0].toFixed(1)},${b[1].toFixed(1)}" fill="#FFF6C8" fill-opacity=".13"/>`; }
    } else if (key === 'bintang') {
      o += `<polygon points="${fl}" fill="#1B2350" fill-opacity=".14"/>`;
      pts(12, HOUSE_WALL_H * 0.8).forEach(([x, y], k) => (o += `<circle ${blink(k)} cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(1.6 + (k % 3) * 0.7).toFixed(1)}" fill="#FFF6C8"/>`));
    }
    // label suasana di atas sudut belakang ruangan
    const set = PREMIUM_SET_BY_KEY[key];
    const lb = at(0.5, 0, r.outdoor ? 34 : HOUSE_WALL_H + 14);
    const text = `✦ Suasana ${set?.name.replace(/^Set /, '') ?? key}`;
    const w = text.length * 6.4 + 18;
    o += `<g transform="translate(${lb[0].toFixed(1)} ${lb[1].toFixed(1)})"><rect x="${(-w / 2).toFixed(1)}" y="-11" width="${w.toFixed(1)}" height="20" rx="10" fill="${set?.color ?? '#2B2F4A'}" stroke="#2B2F4A" stroke-width="1.6"/><text y="4" text-anchor="middle" font-size="11.5" font-weight="800" fill="#FFF4C2" style="font-family:var(--font)">${text}</text></g>`;
    return o;
  }

  /* ---------------- pohon tidak menutupi: kanopi tembus pandang bila ada pet / benda di belakangnya ---------------- */
  $effect(() => {
    const t = setInterval(() => {
      if (document.hidden || !svgEl) return;
      const cans = svgEl.querySelectorAll<SVGGElement>('.draws .canopy');
      if (!cans.length) return;
      const behind = [...svgEl.querySelectorAll<SVGGElement>('.draws .pet, .draws .opet, .draws .npc, .draws .furn')].filter((e) => !e.querySelector('.canopy'));
      const rects = behind.map((e) => e.getBoundingClientRect());
      // pet/orang cukup tertutup 25%; benda diam (bangku, air mancur) baru dihitung bila tertutup separuh, supaya pohon tidak pudar terus
      const need = behind.map((e) => (e.classList.contains('furn') ? 0.5 : 0.25));
      for (const c of cans) {
        const r = c.getBoundingClientRect();
        let hide = false;
        for (let i = 0; i < behind.length && !hide; i++) {
          const q = rects[i];
          const ix = Math.min(q.right, r.right) - Math.max(q.left, r.left), iy = Math.min(q.bottom, r.bottom) - Math.max(q.top, r.top);
          // tertutup cukup banyak dan digambar sebelum pohon (= di belakangnya)
          if (ix <= 0 || iy <= 0 || ix * iy < need[i] * q.width * q.height) continue;
          if (behind[i].compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING) hide = true;
        }
        c.classList.toggle('seethru', hide);
      }
    }, 220);
    return () => clearInterval(t);
  });

  const roomPoly = (r: { gx: number; gy: number; size: number }) => [houseIso(r.gx, r.gy), houseIso(r.gx + r.size, r.gy), houseIso(r.gx + r.size, r.gy + r.size), houseIso(r.gx, r.gy + r.size)].map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ');
  /** ruangan yang tidak tersambung (lewat pintu) ke ruangan pertama */
  const apart = $derived.by(() => {
    if (!planning || !plan.rooms.length) return new Set<string>();
    const seen = new Set([plan.rooms[0].id]), q = [plan.rooms[0].id];
    for (let k = 0; k < q.length; k++)
      for (const d of plan.doors) {
        const o = d.a === q[k] ? d.b : d.b === q[k] ? d.a : null;
        if (o && !seen.has(o)) { seen.add(o); q.push(o); }
      }
    return new Set(plan.rooms.filter((r) => !seen.has(r.id)).map((r) => r.id));
  });
  const planLabels = $derived.by(() => {
    if (!planning || !vw) return [];
    return plan.rooms.map((r) => {
      const [x, y] = houseIso(r.gx + r.size / 2, r.gy + r.size / 2);
      return { id: r.id, name: roomOf(r.id)?.name ?? 'Ruangan', x: (x - cam.x) * cam.k + vw / 2, y: (y - cam.y) * cam.k + vh / 2, sel: G.plan?.sel === r.id, apart: apart.has(r.id) };
    });
  });

  const label = $derived(square ? 'Alun-alun kampung' : mode === 'visit' ? `Rumah ${G.visit?.owner?.display_name ?? 'teman'}` : `Rumahmu${rooms.length > 1 ? `, ${rooms.length} ruangan` : ''}`);
</script>

<svelte:window onkeydown={key} onpointermove={onPointer} onpointerup={onUp} onpointercancel={onUp} />
<div class="roomwrap" class:sky={!square} data-sky={sky} bind:this={wrapEl} bind:clientWidth={vw} bind:clientHeight={vh}>
  {#if !square}<div class="hills" aria-hidden="true"></div><div class="orb" aria-hidden="true"></div><div class="cloud c1" aria-hidden="true"></div><div class="cloud c2" aria-hidden="true"></div>{/if}
  <svg bind:this={svgEl} class="room" class:mirror={mirrored} class:walking class:acting={!!pose} class:home={homeLive} class:bathing={mode === 'home' && !!G.bath} class:soap={G.bath?.tool === 'sabun'} class:scoop={G.bath?.tool === 'gayung'}
    class:mangap={mouthOpen || chewing} class:chew={chewing} class:asleep class:editing={mode === 'home' && G.edit}
    {viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={label} onclick={click} onpointerdown={down}>
    {@html yardHtml}
    {@html layers.shadow}
    {#each layers.back as l (l.key)}<g>{@html l.h}</g>{/each}
    {#each layers.floor as l (l.key)}<g>{@html l.h}</g>{/each}
    {@html layers.mats}
    {#each layers.flats as l (l.key)}<g>{@html l.h}</g>{/each}
    <g>{@html crumbsHtml}</g>
    <g class="draws">
    {#each draws as d (d.key)}
      {#if d.pet}<g class={d.pet.cls} data-o={d.pet.o} transform={d.pet.tf}>{@html d.h}</g>{:else}<g>{@html d.h}</g>{/if}
    {/each}
    </g>
    {#if moodHtml}<g class="moods" pointer-events="none">{@html moodHtml}</g>{/if}
    {#if planning}
      <g class="planmarks" pointer-events="none">
        {#each plan.rooms as r (r.id)}
          {#if apart.has(r.id)}<polygon class="apart" points={roomPoly(r)} />{/if}
          {#if G.plan?.sel === r.id}<polygon class="selroom" points={roomPoly(r)} />{/if}
        {/each}
      </g>
    {/if}
    <g bind:this={foamLayer} pointer-events="none"></g>
    <g bind:this={fxLayer} pointer-events="none"></g>
  </svg>
  {#each tags as t (t.id)}
    {#if t.self || !H.members.some((m) => m.id === t.id)}<span class="tag" class:self={t.self} style="left:{t.x}px;top:{t.y}px">{t.name}</span>
    {:else}<button class="tag tap" style="left:{t.x}px;top:{t.y}px" aria-label="Lihat profil {t.name}" onclick={() => { H.card = t.id; sfx.tap(); }}>{t.name}</button>{/if}
  {/each}
  {#each planLabels as l (l.id)}<span class="plabel" class:sel={l.sel} class:apart={l.apart} style="left:{l.x}px;top:{l.y}px">{l.name}</span>{/each}
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
        <button class="btn sm" class:hot={a.id === '__sleep'} role="menuitem" disabled={cd > 0 || lock || G.busy || a.off} onclick={() => doActivity(a, menu!.target)}>
          <span class="nm">{a.name}</span>
          <span class="ef">{a.note ?? (lock ? `Lv ${a.min_level}` : cd > 0 ? fmtCd(cd) : effText(a.effects) || (a.coins ? `+${a.coins} koin` : ''))}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .roomwrap { position: absolute; inset: 0; overflow: hidden; }
  /* langit di belakang pekarangan: gradasi + bukit + matahari/bulan + 2 awan (CSS saja, tanpa gambar) */
  .roomwrap.sky { --s1: #A9DDF5; --s2: #CDEBF6; --s3: #E4F4EA; --h1: #B9DDB0; --h2: #A6D29B; --orb: #FFF1C2; --glow: rgba(255, 236, 170, .5); --cl: .9;
    background: linear-gradient(180deg, var(--s1) 0%, var(--s2) 58%, var(--s3) 100%); }
  .roomwrap.sky[data-sky='pagi'] { --s1: #F9D6B5; --s2: #F6E7CF; --s3: #E6F2E4; --h1: #BFDDB4; --h2: #AACFA0; --orb: #FFE3A3; --glow: rgba(255, 210, 150, .5); }
  .roomwrap.sky[data-sky='sore'] { --s1: #F3A77E; --s2: #F8CFA0; --s3: #F1E3C4; --h1: #A9C99A; --h2: #93B98A; --orb: #FFC27A; --glow: rgba(255, 170, 100, .45); }
  .roomwrap.sky[data-sky='malam'] { --s1: #1F2D4F; --s2: #33507A; --s3: #46648A; --h1: #324866; --h2: #283B57; --orb: #FFF4C8; --glow: rgba(255, 244, 200, .18); --cl: .22;
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='160'%3E%3Cg fill='%23FFF6D8'%3E%3Ccircle cx='20' cy='30' r='1.6'/%3E%3Ccircle cx='90' cy='12' r='1.2'/%3E%3Ccircle cx='150' cy='60' r='1.8'/%3E%3Ccircle cx='200' cy='22' r='1.1'/%3E%3Ccircle cx='60' cy='100' r='1.3'/%3E%3Ccircle cx='180' cy='120' r='1.5'/%3E%3Ccircle cx='120' cy='140' r='1'/%3E%3C/g%3E%3C/svg%3E") 0 0 / 220px 160px repeat, linear-gradient(180deg, var(--s1) 0%, var(--s2) 58%, var(--s3) 100%); }
  .sky .hills { position: absolute; left: 0; right: 0; bottom: 0; height: 40%; pointer-events: none; background: linear-gradient(180deg, var(--h1), var(--h2));
    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 300' preserveAspectRatio='none'%3E%3Cpath d='M0 120 C200 40 380 70 560 100 S900 20 1100 70 S1450 50 1600 90 V300 H0Z'/%3E%3C/svg%3E") 0 0 / 100% 100% no-repeat;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 300' preserveAspectRatio='none'%3E%3Cpath d='M0 120 C200 40 380 70 560 100 S900 20 1100 70 S1450 50 1600 90 V300 H0Z'/%3E%3C/svg%3E") 0 0 / 100% 100% no-repeat; }
  .sky .orb { position: absolute; top: 11%; right: 13%; width: 84px; height: 84px; border-radius: 50%; background: var(--orb); box-shadow: 0 0 0 22px var(--glow), 0 0 90px 46px var(--glow); pointer-events: none; }
  .roomwrap.sky[data-sky='pagi'] .orb { top: 20%; right: auto; left: 12%; }
  .roomwrap.sky[data-sky='sore'] .orb { top: 26%; right: 9%; }
  .roomwrap.sky[data-sky='malam'] .orb { width: 62px; height: 62px; top: 10%; }
  .sky .cloud { position: absolute; left: -230px; width: 190px; height: 60px; opacity: var(--cl); pointer-events: none; will-change: transform; animation: cloud 90s linear infinite;
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 190 60'%3E%3Cpath d='M20 52a18 18 0 0 1 6-34a26 26 0 0 1 48-8a22 22 0 0 1 38 4a20 20 0 0 1 34 10a17 17 0 0 1 22 28Z' fill='%23FFFFFF'/%3E%3C/svg%3E") center / contain no-repeat; }
  .sky .cloud.c1 { top: 8%; animation-delay: -30s; }
  .sky .cloud.c2 { top: 19%; width: 130px; height: 42px; animation-duration: 120s; animation-delay: -80s; }
  @keyframes cloud { to { transform: translateX(calc(100vw + 460px)); } }
  @media (max-width: 700px) { .sky .orb { width: 56px; height: 56px; top: 16%; } .sky .hills { height: 30%; } }
  @media (prefers-reduced-motion: reduce) { .sky .cloud { animation: none; left: 24%; } .sky .cloud.c2 { left: 64%; } }
  /* lihat dari sisi seberang: seluruh gambar dicermin, tulisan dibalik lagi supaya tetap terbaca */
  .room.mirror { transform: scaleX(-1); }
  .room.mirror :global(text) { transform-box: fill-box; transform-origin: center; transform: scaleX(-1); }
  /* geser & cubit untuk menggerakkan kamera, jadi gerakan bawaan browser dimatikan */
  .room { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; user-select: none; -webkit-user-select: none; }
  .room.soap { cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='32'%3E%3Crect x='3' y='6' width='34' height='20' rx='9' fill='%23F7A8C4' stroke='%232B2F4A' stroke-width='2.5'/%3E%3Ccircle cx='30' cy='8' r='4' fill='%23DDF3FF' stroke='%232B2F4A' stroke-width='1.5'/%3E%3C/svg%3E") 20 16, pointer; }
  .room.scoop { cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='36'%3E%3Cpath d='M4 10h22l-3 18H7Z' fill='%237FC4E8' stroke='%232B2F4A' stroke-width='2.5' stroke-linejoin='round'/%3E%3Cpath d='M25 14h11' stroke='%232B2F4A' stroke-width='4' stroke-linecap='round'/%3E%3C/svg%3E") 16 18, pointer; }
  .room :global(.fl) { cursor: pointer; }
  .room.home :global(.furn), .room.home :global(.spot), .room.home :global(.crumb) { cursor: pointer; }
  .room.home :global(.furn:hover), .room.home :global(.spot:hover) { filter: brightness(1.06); }
  .room :global(.dim) { opacity: .4; }
  .room.editing :global(.dim) { cursor: pointer; }
  .room :global(.crumb) { animation: crumbIn .4s ease-out; }
  .room.walking :global(.pet-bob), .room :global(.opet.moving .pet-bob) { animation: waddle 0.3s ease-in-out infinite alternate; }
  .room :global(.opet) { cursor: pointer; }
  /* alun-alun: air mancur, kuda komidi putar, ayunan, pengisi acara, joget */
  .room :global(.water) { animation: water 0.8s linear infinite; }
  .room :global(.ride) { animation: ride 1.6s ease-in-out infinite alternate; }
  .room :global(.swing) { animation: swing 2.2s ease-in-out infinite alternate; }
  .room :global(.npc.pose-tampil .pet-bob) { animation: tampil 0.9s ease-in-out infinite alternate; }
  .room :global(.pose-joget .pet-bob) { animation: joget 0.45s ease-in-out infinite alternate; }
  .room :global(.pet.pose-naik .pet-bob) { animation: ride 1.6s ease-in-out infinite alternate; }
  .room :global(.pet.pose-ayun .pet-bob) { animation: swingpet 2.2s ease-in-out infinite alternate; }
  .room :global(.dove) { animation: ride 1.2s ease-in-out infinite alternate; }
  .room :global(.blink) { animation: blink 1.7s ease-in-out infinite alternate; }
  .room :global(.flicker) { animation: flicker .45s ease-in-out infinite alternate; }
  .room :global(.swim) { animation: swim 9s linear infinite; }
  .room :global(.canopy) { transition: opacity .25s; }
  .room :global(.canopy.seethru) { opacity: .32; }
  @keyframes blink { from { opacity: .3; } to { opacity: 1; } }
  @keyframes flicker { from { transform: scale(1, 1); } to { transform: scale(.86, 1.1); } }
  @keyframes swim { to { transform: rotate(360deg); } }
  @keyframes water { to { stroke-dashoffset: -22; } }
  @keyframes ride { from { transform: translateY(0); } to { transform: translateY(-9px); } }
  @keyframes swing { from { rotate: -14deg; } to { rotate: 14deg; } }
  @keyframes swingpet { from { transform: rotate(-10deg) translateX(-6px); } to { transform: rotate(10deg) translateX(6px); } }
  @keyframes tampil { from { transform: translateY(0) rotate(-3deg); } to { transform: translateY(-6px) rotate(3deg); } }
  @keyframes joget { from { transform: rotate(-12deg) translateY(0); } to { transform: rotate(12deg) translateY(-8px); } }
  .tag { position: absolute; z-index: 10; transform: translateX(-50%); background: rgba(255, 253, 247, .92); border: 1.5px solid var(--ink); border-radius: 999px; padding: 0 7px; font-size: 11.5px; font-weight: 800; white-space: nowrap; pointer-events: none; max-width: 40vw; overflow: hidden; text-overflow: ellipsis; }
  .tag.self { background: #FFE8A3; z-index: 11; }
  .tag.tap { pointer-events: auto; cursor: pointer; font-family: inherit; color: var(--ink); line-height: 1.45; }
  .tag.tap:focus-visible { outline: 3px solid #3F7FBF; outline-offset: 2px; }
  .room :global(.planmarks polygon) { fill: none; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
  .room :global(.planmarks .selroom) { stroke: #F2B632; stroke-width: 5; fill: rgba(242, 182, 50, .16); }
  .room :global(.planmarks .apart) { stroke: #D9534F; stroke-width: 3.5; stroke-dasharray: 9 6; fill: rgba(217, 83, 79, .12); }
  .plabel { position: absolute; z-index: 9; transform: translate(-50%, -50%); background: rgba(255, 253, 247, .94); border: 2px solid var(--ink); border-radius: 999px; padding: 1px 9px; font-size: 13px; font-weight: 800; white-space: nowrap; pointer-events: none; box-shadow: 0 2px 0 var(--ink); }
  .plabel.sel { background: #FFE8A3; }
  .plabel.apart { background: #FBE1DF; color: #A93A27; }
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
  .menu { position: absolute; z-index: 20; width: 240px; display: flex; flex-direction: column; gap: 6px; background: var(--paper); border: 2.5px solid var(--ink); border-radius: 16px; box-shadow: 0 4px 0 var(--ink); padding: 8px; animation: pop .18s ease-out; }
  .menu b { font-size: 15px; padding: 0 4px; }
  .menu .btn { justify-content: space-between; width: 100%; gap: 8px; }
  .menu .nm { font-weight: 800; }
  .menu .ef { font-size: 12px; font-weight: 700; color: var(--muted); white-space: normal; text-align: right; }
  @media (prefers-reduced-motion: reduce) { .room.walking :global(.pet-bob), .room :global(.water), .room :global(.ride), .room :global(.swing), .room :global(.blink), .room :global(.flicker), .room :global(.swim), .room :global(.npc .pet-bob), .room :global(.pose-joget .pet-bob) { animation: none; } .bubble { animation: none; } }
</style>
