<script lang="ts">
  import { reducedMotion } from '../lib/motion';
  // Peta kampung: pet berjalan menyusuri jalan ke tempat yang diketuk (toko, kebun, kolam, ...), lalu masuk.
  import { onDestroy, onMount, untrack } from 'svelte';
  import { renderMap, renderPet, MAP_VIEWBOX } from '@kb/shared';
  import { G, toast, activeDecor, wearItems, isSleeping, serverNow } from '../lib/game.svelte';
  import { sfx } from '../lib/sfx';
  import { api } from '../lib/api';
  import { K, working, shift, petFree, uniformWear, workLoc, sisa, boardSeen } from '../lib/kerja.svelte';
  import { buddyMarkup, SAHABAT_INFO } from '@kb/shared';
  import { myLook, pondokSeen, jalanPeta, openSahabat, sahabatOn } from '../lib/sahabat.svelte';

  let wrap: HTMLDivElement | undefined = $state();
  let svgEl: SVGSVGElement | undefined = $state();
  const locs = $derived<any[]>(G.catalog?.locations ?? []);
  const html = $derived(renderMap(locs, activeDecor()));
  const f = $derived(G.catalog?.settings?.features ?? {});
  /* ---------- kerja sambilan: pet di tempat kerja (berseragam) dengan hitung mundur ---------- */
  const job = $derived(G.now > 0 && (working() || K.going) ? shift()?.job ?? null : null);
  const jobLoc = $derived(job ? locs.find((l) => l.id === workLoc(job)) ?? null : null);
  const petHtml = $derived(renderPet(G.me.pet, wearItems(job ? uniformWear(job, G.me.pet.wear) : G.me.pet.wear)));
  /** tempat berdiri pet saat bekerja (di depan pintu toko, di antara bedeng, di dermaga, di bale pos ronda, ...) */
  function workSpot(l: any): [number, number] {
    switch (l.kind) {
      case 'garden': return [l.x - 4, l.y - 32];
      case 'pond': return [l.x - 45, l.y - 34];
      case 'ronda': return [l.x - 12, l.y - 30];
      case 'race': return [l.x, l.y - 30];
      case 'square': return [l.x - 40, l.y - 40];
      case 'jobs': return [l.x - 22, l.y + 6];
      default: return [l.x + 26, l.y + 5];
    }
  }
  /** Papan Lowongan baru: lencana BARU sampai papannya pernah dibuka di HP ini */
  const lowongan = $derived(locs.find((l) => l.kind === 'jobs' && l.enabled !== false));
  const baru = $derived(!!lowongan && G.catalog?.settings?.kerja?.on !== false && !boardSeen() && G.sheet !== 'kerja');
  /** Pondok Sahabat baru: lencana BARU sampai panelnya pernah dibuka di HP ini */
  const pondok = $derived(locs.find((l) => l.kind === 'sahabat' && l.enabled !== false));
  const baruP = $derived(!!pondok && sahabatOn() && !pondokSeen() && G.sheet !== 'sahabat');
  let atWork = $state(false);
  const workLeft = $derived(job && atWork && G.now > 0 ? sisa((shift()?.endsAt ?? 0) - serverNow()) : '');

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
  const reduced = reducedMotion();

  /** titik masuk: bangunan di atas jalan → depan pintunya; tempat di bawah jalan → tepi atasnya. */
  function door(l: any): [number, number] {
    if (!l) return [80, ROAD];
    if (l.y <= ROAD + 10) return [l.x, Math.min(ROAD - 6, l.y + 8)];
    const top = l.kind === 'race' ? l.y - 104 : l.kind === 'square' ? l.y - 140 : l.y - 92;
    return [l.x, Math.max(ROAD + 20, top)];
  }
  const home = () => locs.find((l) => l.id === G.mapAt) ?? locs.find((l) => l.kind === 'home');
  // pet yang sedang kerja (bukan baru berangkat) langsung tampil di tempat kerjanya
  untrack(() => { if (K.going && Date.now() - K.goingAt > 8000) K.going = null; });
  const startAtWork = untrack(() => !!jobLoc && !K.going);
  let at = $state<[number, number]>(untrack(() => (startAtWork && jobLoc ? workSpot(jobLoc) : door(home()))));
  atWork = startAtWork;
  let flip = $state(false);
  let walking = $state(false);
  let entering = $state(false);
  let target: any = null;
  let after: (() => void) | null = null;
  let pts: [number, number][] = [];
  let raf = 0, last = 0, timer: any;

  function closed(l: any) {
    const shut: Record<string, [string, string]> = { garden: ['garden', 'Kebun'], race: ['karung', 'Lapangan Lomba'], pond: ['fishing', 'Kolam Pancing'], games: ['minigames', 'Balai Main'] };
    const s = shut[l.kind];
    if (l.kind === 'square' && G.catalog?.settings?.square?.enabled === false) return 'Alun-alun sedang ditutup.';
    return s && f[s[0]] === false ? `${s[1]} sedang ditutup.` : '';
  }

  /** tempat yang butuh pet (lomba, kolam, Balai Main, alun-alun) saat pet sedang kerja sambilan */
  const NEEDS_PET: Record<string, string> = { race: 'Ikut lomba', pond: 'Mancing', games: 'Main di Balai Main', square: 'Main di alun-alun' };
  function open(l: any) {
    if (NEEDS_PET[l.kind] && !petFree(NEEDS_PET[l.kind])) return;
    switch (l.kind) {
      case 'jobs': G.sheetArg = null; G.sheet = 'kerja'; break;
      case 'ronda': G.sheetArg = { job: 'ronda' }; G.sheet = 'kerja'; break;
      case 'home': G.view = 'home'; break;
      case 'shop': case 'pearl': G.shopId = l.id; G.view = 'shop'; break;
      case 'social': G.sheet = 'friends'; break;
      case 'garden': G.view = 'garden'; break;
      case 'race': G.view = 'karung'; break;
      case 'pond': G.view = 'fishing'; break;
      case 'games': G.sheet = 'games'; break;
      case 'sahabat': openSahabat('pondok'); break;
      case 'square':
        if (isSleeping()) { toast(`${G.me.pet.name} sedang tidur. Bangunkan dulu, ya.`); break; }
        G.view = 'alun';
        break;
    }
  }

  function arrive(l: any) {
    walking = false;
    G.mapAt = l.id;
    // jalan-jalan keliling kampung bareng sahabat aktif: keakraban sekali sehari (dicek server)
    if (buddy && l.kind !== 'home') void jalanPeta();
    // berangkat kerja: jalan sedikit ke tempat kerjanya lalu mulai bekerja (tempatnya tidak dibuka)
    if (K.going === l.id) {
      K.going = null;
      target = null;
      pts = [workSpot(l)];
      after = () => { walking = false; atWork = true; sfx.pop(); };
      walking = true;
      cancelAnimationFrame(raf);
      last = performance.now();
      raf = requestAnimationFrame(tick);
      return;
    }
    sfx.pop();
    entering = true;
    timer = setTimeout(() => { entering = false; open(l); }, 280);
  }

  function go(id: string) {
    const l = locs.find((x) => x.id === id);
    if (!l || entering) return;
    const why = closed(l);
    if (why) { toast(why); return; }
    // pet sedang kerja: pet tetap di tempat kerja (yang masih berjalan ke sana langsung sampai), pemain mampir sendiri
    // (tempat yang butuh pet ditolak di open)
    if (job && K.going !== id) {
      if (!atWork) { cancelAnimationFrame(raf); pts = []; target = null; after = null; walking = false; K.going = null; if (jobLoc) at = workSpot(jobLoc); atWork = true; }
      sfx.tap(); open(l); return;
    }
    atWork = false;
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
    trailPush(at);
    budGo();
    follow();
    if (pts.length) raf = requestAnimationFrame(tick);
    else if (target) arrive(target);
    else if (after) { const f = after; after = null; f(); }
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
  onDestroy(() => { cancelAnimationFrame(raf); cancelAnimationFrame(bRaf); clearTimeout(timer); });

  /* ---------- Sahabat Mungil: sahabat aktif berjalan di belakang pet menyusuri jejaknya ---------- */
  const buddy = $derived(myLook());
  const BI = $derived(buddy ? SAHABAT_INFO[buddy.sp] : null);
  /** jejak pet (titik peta) & jarak kumulatifnya; sahabat berada `bd` satuan dari awal jejak */
  let trail: [number, number][] = [];
  let tlen: number[] = [];
  let bd = 0, bRaf = 0, bLast = 0;
  let bpos = $state<[number, number]>([0, 0]);
  let bflip = $state(false);
  let bmove = $state(false);
  /** jarak ikut di belakang pet (satuan peta) & kecepatan; kura-kura pelan, yang lain bisa menyusul */
  const lagOf = () => (BI ? 26 + BI.lag * 14 : 30);
  const spdOf = () => (BI ? (BI.speed < 1.5 ? 150 : 320) : 320);
  function trailPush(p: [number, number]) {
    const n = trail.length;
    if (!n) { trail = [[p[0], p[1]]]; tlen = [0]; return; }
    const d = Math.hypot(p[0] - trail[n - 1][0], p[1] - trail[n - 1][1]);
    if (d < 0.5) return;
    trail.push([p[0], p[1]]);
    tlen.push(tlen[n - 1] + d);
  }
  function trailAt(dist: number): [number, number] {
    if (!trail.length) return [at[0], at[1]];
    if (dist <= 0) return [...trail[0]] as [number, number];
    for (let i = 1; i < trail.length; i++) {
      if (tlen[i] >= dist) { const f = (dist - tlen[i - 1]) / Math.max(0.001, tlen[i] - tlen[i - 1]); return [trail[i - 1][0] + (trail[i][0] - trail[i - 1][0]) * f, trail[i - 1][1] + (trail[i][1] - trail[i - 1][1]) * f]; }
    }
    return [...trail[trail.length - 1]] as [number, number];
  }
  /** mulai: sahabat di samping pet (belakang arah hadapnya), jejak berawal dari situ */
  function budReset() {
    const s = flip ? 1 : -1;
    trail = [[at[0] + s * lagOf(), at[1]], [at[0], at[1]]];
    tlen = [0, lagOf()];
    bd = 0;
    bpos = [trail[0][0], trail[0][1]];
    bflip = flip;
  }
  untrack(() => budReset());
  function bTick(now: number) {
    const dt = Math.min(0.05, (now - bLast) / 1000);
    bLast = now;
    const goal = tlen[tlen.length - 1] - lagOf();
    if (goal - bd > 0.5) {
      const prev = bpos;
      bd += Math.min(spdOf() * (goal - bd > 160 ? 2 : 1) * dt, goal - bd);
      bpos = trailAt(bd);
      if (Math.abs(bpos[0] - prev[0]) > 0.3) bflip = bpos[0] < prev[0];
      bmove = true;
      bRaf = requestAnimationFrame(bTick);
    } else { bmove = false; bRaf = 0; }
  }
  function budGo() { if (!bRaf && buddy) { bLast = performance.now(); bRaf = requestAnimationFrame(bTick); } }
  /** burung pipit hinggap di kepala pet saat pet diam */
  const perched = $derived(!!buddy && buddy.sp === 'pipit' && !walking && !bmove);
  const budHtml = $derived(buddy ? buddyMarkup(buddy.sp, { variant: buddy.v, lvl: buddy.lvl, perch: perched }) : '');
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
    {#if baru && lowongan}
      <g class="baru" pointer-events="none" transform="translate({lowongan.x + 40} {lowongan.y - 104})">
        <rect x="-24" y="-11" width="48" height="22" rx="11" fill="#E0583F" stroke="#2B2F4A" stroke-width="2.2" />
        <text x="0" y="5" text-anchor="middle" class="bt">BARU</text>
      </g>
    {/if}
    {#if baruP && pondok}
      <g class="pbaru" pointer-events="none" transform="translate({pondok.x + 54} {pondok.y - 84})">
        <rect x="-24" y="-11" width="48" height="22" rx="11" fill="#E0583F" stroke="#2B2F4A" stroke-width="2.2" />
        <text x="0" y="5" text-anchor="middle" class="bt">BARU</text>
      </g>
    {/if}
    {#if buddy && budHtml && !perched && !(job && atWork)}
      <g class="mapbud bud sp-{buddy.sp}" class:mv={bmove} class:entering pointer-events="none" transform="translate({bpos[0].toFixed(1)} {bpos[1].toFixed(1)})">
        <g class="bbody"><g transform="scale(.42)"><g transform={bflip ? 'scale(-1 1)' : ''}>{@html budHtml}</g></g></g>
      </g>
    {/if}
    <g class="walker" class:walking class:entering class:atwork={atWork && !!job} pointer-events="none" transform="translate({at[0].toFixed(1)} {at[1].toFixed(1)})">
      <ellipse cx="0" cy="1" rx="20" ry="6" fill="#2B2F4A" opacity=".18" />
      <g class="body"><g transform="scale(.42)"><g transform={flip ? 'scale(-1 1)' : ''}><g class="pet-bob">{@html petHtml}</g></g></g></g>
      {#if perched && budHtml && !(job && atWork)}<g class="mapbud bud sp-pipit" pointer-events="none" transform="translate(1 -31) scale(.42)">{@html budHtml}</g>{/if}
      {#if workLeft}
        {@const w = workLeft.length * 7 + 46}
        <g class="workpill" transform="translate(0 -70)">
          <rect x={-w / 2} y="-12" width={w} height="24" rx="12" fill="#FFFDF7" stroke="#2B2F4A" stroke-width="2.2" />
          <circle cx={-w / 2 + 13} cy="0" r="6.5" fill="#F2B632" stroke="#2B2F4A" stroke-width="1.6" /><path d="M{-w / 2 + 13} -3.5V0l2.6 1.8" stroke="#2B2F4A" stroke-width="1.5" fill="none" stroke-linecap="round" />
          <text x={-w / 2 + 25} y="4.5" class="wt">{workLeft}</text>
        </g>
      {/if}
    </g>
  </svg>
</div>
<p class="hint">{#if job && atWork}{G.me.pet.name} sedang {shift()?.doing} di {shift()?.place}. Ketuk tempat lain untuk mampir sendiri.{:else}Ketuk tempat yang ingin dikunjungi, {G.me.pet.name} akan berjalan ke sana{/if}</p>

<style>
  .wrap { position: absolute; inset: 0; overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
  .wrap::-webkit-scrollbar { display: none; }
  .map { display: block; height: 100%; width: 100%; min-width: calc(100dvh * 2.077 * .78); }
  .walker .body { transition: transform .28s ease-in, opacity .28s ease-in; transform-box: fill-box; transform-origin: 50% 100%; }
  .walker.entering .body { transform: translateY(-10px) scale(.4); opacity: 0; }
  .mapbud .bbody { transition: opacity .28s ease-in; }
  .mapbud.entering .bbody { opacity: 0; }
  .walker.walking .pet-bob { animation: mapwaddle .26s ease-in-out infinite alternate; }
  @keyframes mapwaddle { from { transform: rotate(-7deg) translateY(0); } to { transform: rotate(7deg) translateY(-6px); } }
  .sqlive .t { font: 800 14px var(--font); fill: #2B2F4A; }
  .baru .bt, .pbaru .bt { font: 800 12px var(--font); fill: #FFFDF7; letter-spacing: .5px; }
  .baru, .pbaru { animation: baru 1.4s ease-in-out infinite; transform-box: fill-box; }
  @keyframes baru { 50% { opacity: .55; } }
  .workpill .wt { font: 800 12.5px var(--font); fill: #2B2F4A; }
  /* pet bekerja: sibuk bergoyang kecil */
  .walker.atwork .pet-bob { animation: workbusy 1.1s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 100%; }
  @keyframes workbusy { 0%, 100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg) translateY(-3px); } }
  .sqlive .hot { font: 800 11.5px var(--font); fill: #FFFDF7; }
  .sqlive .sub { font: 700 11.5px var(--font); fill: #5F6478; }
  .sqlive.on .dot { animation: livedot 1.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
  @keyframes livedot { 50% { opacity: .35; } }
  .hint { position: absolute; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-b) + 84px); margin: 0; background: rgba(255,253,247,.92); border: 2px solid var(--ink); border-radius: 12px; padding: 3px 10px; font-weight: 700; font-size: 13px; line-height: 1.3; text-align: center; width: max-content; max-width: calc(100vw - 24px); pointer-events: none; }
  @media (min-aspect-ratio: 1/1) { .map { min-width: 0; } }
  @media (prefers-reduced-motion: reduce) { .walker.walking .pet-bob, .walker.atwork .pet-bob, .baru, .pbaru { animation: none; } }
  /* Pengaturan › Kurangi animasi (pilihan di game) */
  :global(:root.reduce-motion) .walker.walking .pet-bob, :global(:root.reduce-motion) .walker.atwork .pet-bob, :global(:root.reduce-motion) .baru, :global(:root.reduce-motion) .pbaru { animation: none; }
</style>
