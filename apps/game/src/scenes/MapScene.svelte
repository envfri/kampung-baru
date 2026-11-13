<script lang="ts">
  // Peta kampung: pet berjalan menyusuri jalan ke tempat yang diketuk (toko, kebun, kolam, ...), lalu masuk.
  import { onDestroy, onMount, untrack } from 'svelte';
  import { renderMap, renderPet, MAP_VIEWBOX } from '@kb/shared';
  import { G, toast, activeDecor, wearItems, isSleeping } from '../lib/game.svelte';
  import { sfx } from '../lib/sfx';
  import { api } from '../lib/api';

  let wrap: HTMLDivElement | undefined = $state();
  let svgEl: SVGSVGElement | undefined = $state();
  const locs = $derived<any[]>(G.catalog?.locations ?? []);
  const html = $derived(renderMap(locs, activeDecor()));
  const f = $derived(G.catalog?.settings?.features ?? {});
  const petHtml = $derived(renderPet(G.me.pet, wearItems(G.me.pet.wear)));

  /* ---------- alun-alun: berapa orang sedang di sana (tampil di peta supaya yang lain tertarik datang) ---------- */
  let sq = $state<{ max: number; squares: { id: number; count: number }[] } | null>(null);
  async function loadSquare() { try { const r = await api.get('/api/square'); sq = { max: r.max, squares: r.squares ?? [] }; } catch { /* abaikan */ } }
  onMount(() => { loadSquare(); const t = setInterval(() => { if (!document.hidden) loadSquare(); }, 30_000); return () => clearInterval(t); });
  const alunLoc = $derived(locs.find((l) => l.kind === 'square' && l.enabled !== false));
  const alunPeople = $derived(sq ? sq.squares.reduce((a, x) => a + (x.count ?? 0), 0) : 0);
  /** alun-alun tersibuk: "12/20" */
  const alunBusiest = $derived(sq?.squares.length ? sq.squares.reduce((a, x) => (x.count > a.count ? x : a), sq.squares[0]) : null);
  const alunHot = $derived(!!alunBusiest && !!sq && alunBusiest.count >= Math.max(3, sq.max * 0.6));
  const alunLabel = $derived(alunPeople ? `${alunPeople} orang di sini` : 'Belum ada orang');
  const alunSub = $derived(alunBusiest && sq ? `Alun-alun ${alunBusiest.id} · ${alunBusiest.count}/${sq.max}${sq.squares.length > 1 ? ` (+${sq.squares.length - 1} lagi)` : ''}` : 'Ayo jadi yang pertama!');
  // lebar kartu diukur dari teks sungguhan (font bisa beda tiap perangkat) supaya teks tidak keluar dari kotak
  let tMain: SVGTextElement | undefined = $state(), tSub: SVGTextElement | undefined = $state();
  let tw = $state({ main: 0, sub: 0 });
  $effect(() => {
    void alunLabel; void alunSub; void alunHot;
    if (!tMain || !tSub) return;
    const m = () => { try { tw = { main: tMain!.getComputedTextLength(), sub: tSub!.getComputedTextLength() }; } catch { /* belum tergambar */ } };
    m(); document.fonts?.ready.then(m);
  });
  const alunW = $derived(Math.ceil(Math.max((tw.main || alunLabel.length * 8) + 42 + (alunHot ? 58 : 0), (tw.sub || alunSub.length * 6.8) + 26)));

  const ROAD = 240; // jalan utama di peta (lihat renderMap)
  const SPEED = 240; // satuan peta per detik
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** titik masuk: bangunan di atas jalan → depan pintunya; tempat di bawah jalan → tepi atasnya. */
  function door(l: any): [number, number] {
    if (!l) return [80, ROAD];
    if (l.y <= ROAD + 10) return [l.x, Math.min(ROAD - 6, l.y + 8)];
    const top = l.kind === 'race' ? l.y - 104 : l.kind === 'square' ? l.y - 140 : l.y - 92;
    return [l.x, Math.max(ROAD + 20, top)];
  }
  const home = () => locs.find((l) => l.id === G.mapAt) ?? locs.find((l) => l.kind === 'home');
  let at = $state<[number, number]>(untrack(() => door(home())));
  let flip = $state(false);
  let walking = $state(false);
  let entering = $state(false);
  let target: any = null;
  let pts: [number, number][] = [];
  let raf = 0, last = 0, timer: any;

  function closed(l: any) {
    const shut: Record<string, [string, string]> = { garden: ['garden', 'Kebun'], race: ['karung', 'Lapangan Lomba'], pond: ['fishing', 'Kolam Pancing'], games: ['minigames', 'Balai Main'] };
    const s = shut[l.kind];
    if (l.kind === 'square' && G.catalog?.settings?.square?.enabled === false) return 'Alun-alun sedang ditutup.';
    return s && f[s[0]] === false ? `${s[1]} sedang ditutup.` : '';
  }

  function open(l: any) {
    switch (l.kind) {
      case 'home': G.view = 'home'; break;
      case 'shop': case 'pearl': G.shopId = l.id; G.view = 'shop'; break;
      case 'social': G.sheet = 'friends'; break;
      case 'garden': G.view = 'garden'; break;
      case 'race': G.view = 'karung'; break;
      case 'pond': G.view = 'fishing'; break;
      case 'games': G.sheet = 'games'; break;
      case 'square':
        if (isSleeping()) { toast(`${G.me.pet.name} sedang tidur. Bangunkan dulu, ya.`); break; }
        G.view = 'alun';
        break;
    }
  }

  function arrive(l: any) {
    walking = false;
    G.mapAt = l.id;
    sfx.pop();
    entering = true;
    timer = setTimeout(() => { entering = false; open(l); }, 280);
  }

  function go(id: string) {
    const l = locs.find((x) => x.id === id);
    if (!l || entering) return;
    const why = closed(l);
    if (why) { toast(why); return; }
    // ketuk tujuan yang sama saat masih berjalan: langsung sampai
    if (walking && target?.id === id) { cancelAnimationFrame(raf); at = door(l); pts = []; return arrive(l); }
    target = l;
    sfx.tap();
    const d = door(l);
    const p: [number, number][] = [];
    if (Math.abs(at[1] - ROAD) > 1 && Math.abs(at[0] - d[0]) > 1) p.push([at[0], ROAD]);
    if (Math.abs(at[0] - d[0]) > 1 && Math.abs(d[1] - ROAD) > 1) p.push([d[0], ROAD]);
    p.push(d);
    if (Math.hypot(at[0] - d[0], at[1] - d[1]) < 4) { at = d; return arrive(l); }
    pts = p;
    walking = true;
    cancelAnimationFrame(raf);
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }

  function tick(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    let step = SPEED * dt;
    let [x, y] = at;
    while (step > 0 && pts.length) {
      const [tx, ty] = pts[0];
      const dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy);
      if (Math.abs(dx) > 0.5) flip = dx < 0;
      if (d <= step) { x = tx; y = ty; pts.shift(); step -= d; }
      else { x += (dx / d) * step; y += (dy / d) * step; step = 0; }
    }
    at = [x, y];
    follow();
    if (pts.length) raf = requestAnimationFrame(tick);
    else if (target) arrive(target);
  }

  /** di HP potret peta lebih lebar dari layar: geser mengikuti pet */
  function follow(instant = false) {
    if (!wrap || !svgEl || wrap.scrollWidth <= wrap.clientWidth + 2) return;
    const ctm = svgEl.getScreenCTM();
    if (!ctm) return;
    const pt = svgEl.createSVGPoint();
    pt.x = at[0]; pt.y = at[1];
    const sx = pt.matrixTransform(ctm).x - wrap.getBoundingClientRect().left;
    const w = wrap.clientWidth;
    if (instant) wrap.scrollLeft += sx - w / 2;
    else if (sx < w * 0.3 || sx > w * 0.7) wrap.scrollLeft += (sx - w / 2) * 0.12;
  }

  function click(e: MouseEvent) {
    const l = (e.target as Element).closest('.loc') as SVGElement | null;
    if (l) go(l.dataset.loc!);
  }
  function key(e: KeyboardEvent) {
    const l = (e.target as Element).closest?.('.loc') as SVGElement | null;
    if (l && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); go(l.dataset.loc!); }
  }

  // tujuan dari luar peta (mis. "Jalan ke Pasar Pagi" di Tas)
  $effect(() => {
    const goal = G.mapGoal;
    if (!goal) return;
    untrack(() => { G.mapGoal = null; timer = setTimeout(() => go(goal), 380); });
  });

  onMount(() => requestAnimationFrame(() => follow(true)));
  onDestroy(() => { cancelAnimationFrame(raf); clearTimeout(timer); });
</script>

<div class="wrap" bind:this={wrap}>
  <svg bind:this={svgEl} class="map" viewBox={MAP_VIEWBOX} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Peta Kampung" onclick={click} onkeydown={key}>
    {@html html}
    {#if alunLoc && sq}
      {@const w = alunW}
      <g class="sqlive" class:on={alunPeople > 0} pointer-events="none" transform="translate({alunLoc.x - 24} {alunLoc.y - 104})">
        <rect x={-w / 2} y="-22" width={w} height="44" rx="14" fill="#FFFDF7" stroke="#2B2F4A" stroke-width="2.5" />
        <path d="M-7 21l7 9 7-9Z" fill="#FFFDF7" stroke="#2B2F4A" stroke-width="2.5" stroke-linejoin="round" /><path d="M-8.5 20h17" stroke="#FFFDF7" stroke-width="4" />
        <circle class="dot" cx={-w / 2 + 18} cy="-6" r="5" fill={alunPeople ? '#2FA36B' : '#9AA49F'} />
        <text bind:this={tMain} x={-w / 2 + 29} y="-1.5" class="t">{alunLabel}</text>
        {#if alunHot}<g transform="translate({w / 2 - 36} -6)"><rect x="-25" y="-10" width="50" height="20" rx="10" fill="#E0583F" /><text x="0" y="4.5" text-anchor="middle" class="hot">Ramai!</text></g>{/if}
        <text bind:this={tSub} x={-w / 2 + 13} y="15" class="sub">{alunSub}</text>
      </g>
    {/if}
    <g class="walker" class:walking class:entering pointer-events="none" transform="translate({at[0].toFixed(1)} {at[1].toFixed(1)})">
      <ellipse cx="0" cy="1" rx="20" ry="6" fill="#2B2F4A" opacity=".18" />
      <g class="body"><g transform="scale(.42)"><g transform={flip ? 'scale(-1 1)' : ''}><g class="pet-bob">{@html petHtml}</g></g></g></g>
    </g>
  </svg>
</div>
<p class="hint">Ketuk tempat yang ingin dikunjungi, {G.me.pet.name} akan berjalan ke sana</p>

<style>
  .wrap { position: absolute; inset: 0; overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
  .wrap::-webkit-scrollbar { display: none; }
  .map { display: block; height: 100%; width: 100%; min-width: calc(100dvh * 2.077 * .78); }
  .walker .body { transition: transform .28s ease-in, opacity .28s ease-in; transform-box: fill-box; transform-origin: 50% 100%; }
  .walker.entering .body { transform: translateY(-10px) scale(.4); opacity: 0; }
  .walker.walking .pet-bob { animation: mapwaddle .26s ease-in-out infinite alternate; }
  @keyframes mapwaddle { from { transform: rotate(-7deg) translateY(0); } to { transform: rotate(7deg) translateY(-6px); } }
  .sqlive .t { font: 800 14px var(--font); fill: #2B2F4A; }
  .sqlive .hot { font: 800 11.5px var(--font); fill: #FFFDF7; }
  .sqlive .sub { font: 700 11.5px var(--font); fill: #5F6478; }
  .sqlive.on .dot { animation: livedot 1.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
  @keyframes livedot { 50% { opacity: .35; } }
  .hint { position: absolute; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-b) + 84px); margin: 0; background: rgba(255,253,247,.92); border: 2px solid var(--ink); border-radius: 12px; padding: 3px 10px; font-weight: 700; font-size: 13px; line-height: 1.3; text-align: center; width: max-content; max-width: calc(100vw - 24px); pointer-events: none; }
  @media (min-aspect-ratio: 1/1) { .map { min-width: 0; } }
  @media (prefers-reduced-motion: reduce) { .walker.walking .pet-bob { animation: none; } }
</style>
