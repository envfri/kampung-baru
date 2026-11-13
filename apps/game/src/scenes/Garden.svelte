<script lang="ts">
  // Kebun: petak bertambah per tingkat (3 kolom, baris baru di bawah), tanaman digambar per jenis.
  // Ketuk petak kosong → Pilih bibit; tanaman tumbuh → Siram / Pupuk; siap → panen.
  import { onMount, untrack } from 'svelte';
  import { basketIcon, gardenState, GARDEN_PERK_LEVEL, kebunDrop, KEBUN_ICONS, plotTimeText } from '@kb/shared';
  import { G, item, run, post, toast, serverNow, settings, owned, canBuy } from '../lib/game.svelte';
  import { gardenScene, plotView } from '../lib/kebun';
  import { sfx } from '../lib/sfx';
  import { I, COIN } from '../lib/icons';

  const g = $derived(gardenState(settings().garden, G.me.gardenLevel));
  const plots = $derived(Object.fromEntries((G.me.garden ?? []).map((p: any) => [p.slot, p])));
  // petak di atas batas (admin mengurangi tingkat) tetap tampil sampai dipanen
  const n = $derived(Math.max(g.slots, ...(G.me.garden ?? []).map((p: any) => (p.slot + 3) - ((p.slot + 3) % 3))));
  const views = $derived((G.now, Array.from({ length: n }, (_, i) => (plots[i] ? plotView(plots[i], serverNow(), item) : null))));
  const ready = $derived(views.filter((v) => v && v.prog >= 1).length);
  const toWater = $derived(views.filter((v) => v && v.prog < 1 && !v.watered).length);

  let sw = $state(0), sh = $state(0), bh = $state(96);
  const wide = $derived(sw >= 700 && sw > sh * 1.15);
  const owner = $derived(G.me.pet?.name ?? 'Bupi');
  let fontsOk = $state(0);
  let fresh = $state(999);
  const sc = $derived((fontsOk, gardenScene({ level: g.level, n, plots: views, ghost: !!g.next, wide, owner })));
  // skala: muat di layar; di HP sempit jangan terlalu kecil (digulir saja)
  const k = $derived.by(() => {
    if (!sw || !sh) return 1;
    const fit = Math.min(sw / sc.W, sh / sc.H);
    return Math.min(1.5, Math.max(fit, Math.min(sw / sc.W, 0.8)));
  });
  const bw = $derived(sc.W * k), bhgt = $derived(sc.H * k);
  const ox = $derived(Math.max(0, (sw - bw) / 2)), oy = $derived(Math.max(0, (sh - bhgt) / 2));
  const px = (x: number) => ox + x * k, py = (y: number) => oy + (y - sc.y0) * k;

  let bubble = $state(-1);
  const bp = $derived(bubble >= 0 ? plots[bubble] : null);
  const bv = $derived(bubble >= 0 ? views[bubble] : null);
  const pupukN = $derived(owned('pupuk'));
  const pupukIt = $derived(item('pupuk'));
  const bubblePos = $derived.by(() => {
    if (bubble < 0) return null;
    const c = sc.L.cell(bubble);
    const w = Math.min(264, sw - 12);
    const cx = px(c.x + 46);
    const left = Math.min(Math.max(6, cx - w / 2), sw - w - 6);
    let top = py(c.y) - bh - 12, below = false;
    if (top < 4) { top = py(c.y + sc.L.plotH) + 10; below = true; }
    return { left, top, w, arrow: cx - left, below };
  });

  // tingkat naik saat layar terbuka: baris baru "tumbuh" + konfeti
  let prevSlots = untrack(() => g.slots);
  $effect(() => {
    const s = g.slots;
    if (s > prevSlots) { const from = prevSlots; fresh = from; setTimeout(() => { if (fresh === from) fresh = 999; }, 1800); }
    prevSlots = s;
  });
  const confetti = $derived.by(() => {
    if (fresh >= 999 || fresh >= n) return [];
    const a = sc.L.cell(fresh), b = sc.L.cell(Math.min(n - 1, fresh + 2));
    return Array.from({ length: 18 }, (_, i) => ({ x: px(a.x + ((b.x + 92 - a.x) * ((i * 37) % 100)) / 100), y: py(a.y + 20), c: ['#E0583F', '#F2B632', '#3FA06A', '#6FB7E0', '#E7A1C9'][i % 5], d: (i % 6) * 60, r: (i * 47) % 360, dx: ((i * 29) % 60) - 30 }));
  });

  onMount(() => {
    // papan nama diukur ulang setelah huruf Baloo selesai dimuat
    document.fonts?.ready.then(() => fontsOk++).catch(() => {});
  });

  const nameOf = (id?: string) => item(id)?.name ?? '';
  const seedOfPlot = (p: any) => item(p?.seed_id);

  async function tap(i: number) {
    const p = plots[i], v = views[i];
    if (!p) {
      bubble = -1;
      if (i >= g.slots) return;
      G.sheet = 'seed'; G.sheetArg = { slot: i }; sfx.tap();
      return;
    }
    if (v && v.prog < 1) { sfx.tap(); bubble = bubble === i ? -1 : i; return; }
    bubble = -1;
    const r: any = await run(() => post('/api/garden/harvest', { slot: i }));
    if (r) {
      sfx.coin();
      toast(`Panen ${r.harvested.qty} ${nameOf(r.harvested.itemId)}!${r.bonus ? ' (+1 dari orang-orangan sawah)' : ''}`, 'good');
      levelUp(r);
    }
  }
  function levelUp(r: any) {
    if (r?.levelUp) setTimeout(() => { sfx.level(); toast(`${G.me.pet.name} naik ke Lv ${r.levelUp}!`, 'good'); }, 2100);
  }

  async function harvestAll() {
    bubble = -1;
    const r: any = await run(() => post('/api/garden/harvest-all'));
    if (!r) return;
    sfx.coin();
    const list = r.items.map((x: any) => `+${x.qty} ${nameOf(x.itemId)}`);
    toast(`Panen ${r.count} tanaman: ${list.slice(0, 3).join(', ')}${list.length > 3 ? ', …' : ''}${r.bonus ? ` (${r.bonus}× bonus orang-orangan sawah)` : ''}`, 'good');
    levelUp(r);
  }
  async function water(all = false) {
    const slot = bubble;
    const r: any = await run(() => post('/api/garden/water', all ? { all: true } : { slot }));
    if (!r) return;
    sfx.pop();
    bubble = -1;
    toast(all ? `${r.watered} tanaman disiram. Tumbuh lebih cepat!` : `${seedOfPlot(plots[slot])?.name?.replace(/^Bibit /, '') ?? 'Tanaman'} disiram. Tumbuh lebih cepat!`, 'good');
  }
  async function fertilize() {
    const slot = bubble;
    const r: any = await run(() => post('/api/garden/fertilize', { slot, buy: pupukN < 1 }));
    if (!r) return;
    sfx.pop();
    bubble = -1;
    toast(r.bought ? `Pupuk dibeli & ditabur (−${pupukIt?.price_coin ?? 15} koin).` : 'Pupuk ditabur. Panen makin cepat!', 'good');
  }
  function openExpand() { bubble = -1; sfx.tap(); G.sheet = 'kebun'; }
  function bg(e: MouseEvent) { if (!(e.target as Element).closest('.plot, .bubble, .grow')) bubble = -1; }
  function key(e: KeyboardEvent, i: number) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(i); } }

  const label = (i: number) => {
    const p = plots[i], v = views[i];
    if (!p) return `Petak ${i + 1} kosong. Ketuk untuk menanam`;
    const nm = seedOfPlot(p)?.name?.replace(/^Bibit /, '') ?? 'Tanaman';
    return v && v.prog >= 1 ? `Petak ${i + 1}: ${nm} siap dipanen` : `Petak ${i + 1}: ${nm}, siap ${plotTimeText(new Date(p.ready_at).getTime() - serverNow())} lagi`;
  };
  const pupukIcon = (() => { const p = KEBUN_ICONS.pupuk; return `<svg viewBox="0 0 64 52" aria-hidden="true">${p.draw(p.colors)}</svg>`; })();
  const DROP = `<svg viewBox="-8 -9 16 18" aria-hidden="true">${kebunDrop(0, 0, 1.15)}</svg>`;
  const BASKET = `<svg viewBox="2 0 36 36" aria-hidden="true">${basketIcon()}</svg>`;
</script>

<div class="garden">
  <div class="stage" bind:clientWidth={sw} bind:clientHeight={sh} onclick={bg} role="presentation">
    <div class="inner" style="height:{Math.max(sh, bhgt + oy * 2)}px">
      <svg viewBox="0 {sc.y0} {sc.W} {sc.H}" width={bw} height={bhgt} style="left:{ox}px;top:{oy}px" role="group" aria-label="Kebun Lv {g.level}, {g.slots} petak">
        {@html sc.back}
        {#each views as _, i (i)}
          {#if plots[i] || i < g.slots}
            <g class="plot" class:sprout={i >= fresh} role="button" tabindex="0" aria-label={label(i)} onclick={() => tap(i)} onkeydown={(e) => key(e, i)}>{@html sc.plot(i)}</g>
          {/if}
        {/each}
        {@html sc.ghost}
      </svg>
      {#if sc.L.ghost}
        {@const gh = sc.L.ghost}
        <div class="grow" style="left:{px(gh.x + gh.w / 2)}px;top:{py(gh.y + gh.h / 2)}px"><button class="btn hot" onclick={openExpand}>Perluas kebun · +{(g.next?.slots ?? g.slots) - g.slots} petak</button></div>
      {/if}
      {#each confetti as c}<i class="conf" style="left:{c.x}px;top:{c.y}px;background:{c.c};animation-delay:{c.d}ms;--r:{c.r}deg;--dx:{c.dx}px"></i>{/each}
      {#if bubble >= 0 && bp && bv && bv.prog < 1 && bubblePos}
        {@const wet = !!bp.watered_at}
        {@const fed = !!bp.fertilized_at}
        <div class="bubble" class:below={bubblePos.below} bind:offsetHeight={bh} style="left:{bubblePos.left}px;top:{bubblePos.top}px;width:{bubblePos.w}px;--ax:{bubblePos.arrow}px" role="dialog" aria-label="Rawat tanaman">
          <p><b>{seedOfPlot(bp)?.name?.replace(/^Bibit /, '') ?? 'Tanaman'}</b> · siap {plotTimeText(new Date(bp.ready_at).getTime() - serverNow())} lagi</p>
          <div class="acts">
            <button class="btn sm water" disabled={wet || G.busy} onclick={() => water()}>{@html wet ? '✓' : DROP}<span>{wet ? 'Disiram' : 'Siram'}</span></button>
            <button class="btn sm pupuk" disabled={fed || G.busy || (pupukN < 1 && !(pupukIt && canBuy(pupukIt)))} onclick={fertilize}>
              {#if fed}✓<span>Dipupuk</span>
              {:else if pupukN > 0}{@html pupukIcon}<span>Pupuk ×{pupukN}</span>
              {:else}<span>Pupuk</span>{@html COIN}<span>{pupukIt?.price_coin ?? 15}</span>{/if}
            </button>
          </div>
          <small>Siram gratis −{settings().garden?.waterPct ?? 10}% waktu · pupuk −{settings().garden?.fertilizerPct ?? 25}%</small>
        </div>
      {/if}
    </div>
  </div>
  <div class="bar" class:three={g.level >= GARDEN_PERK_LEVEL.waterAll}>
    <button class="btn back" onclick={() => (G.view = 'map')} aria-label="Kembali ke Kampung">{@html I.back}<span class="lbl">Kampung</span></button>
    {#if g.level >= GARDEN_PERK_LEVEL.waterAll}
      <button class="btn waterall" disabled={!toWater || G.busy} onclick={() => water(true)}>{@html DROP}<span>Siram</span><span class="w">semua</span>{#if toWater}<b class="cnt">{toWater}</b>{/if}</button>
    {/if}
    <button class="btn hot" disabled={!ready || G.busy} onclick={harvestAll}>{@html BASKET}<span>Panen</span><span class="w">semua</span>{#if ready}<b class="cnt ok">{ready}</b>{/if}</button>
  </div>
</div>

<style>
  .garden { position: absolute; inset: 0; background: #A9D18A; }
  .stage { position: absolute; left: 0; right: 0; top: calc(var(--safe-t) + 70px); bottom: calc(var(--safe-b) + 140px); overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; }
  @media (min-width: 900px) and (min-aspect-ratio: 1/1) { .stage { top: calc(var(--safe-t) + 94px); } }
  .inner { position: relative; width: 100%; }
  svg { position: absolute; display: block; }
  .plot { cursor: pointer; outline: none; }
  .plot:hover :global(rect:first-child) { fill: #9C6A38; }
  .plot:focus-visible :global(rect:first-child) { stroke: #3F7FBF; stroke-width: 4; }
  .plot.sprout { animation: sprout .8s cubic-bezier(.3, 1.4, .5, 1) both; transform-box: fill-box; transform-origin: 50% 100%; }
  .plot :global(.twinkle) { animation: twinkle 1.6s ease-in-out infinite; }
  @keyframes sprout { from { transform: scale(.4, .1); opacity: 0; } to { transform: none; opacity: 1; } }
  @keyframes twinkle { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
  .grow { position: absolute; transform: translate(-50%, -50%); z-index: 2; }
  .grow .btn { white-space: nowrap; font-size: 16px; }
  .conf { position: absolute; z-index: 3; width: 8px; height: 12px; border-radius: 2px; border: 1.5px solid var(--ink); pointer-events: none; animation: conf 1.4s ease-out both; }
  @keyframes conf { 0% { transform: translate(0, 0) rotate(0); opacity: 1; } 100% { transform: translate(var(--dx), -90px) rotate(var(--r)); opacity: 0; } }
  .bubble { position: absolute; z-index: 5; background: var(--paper); border: 2.5px solid var(--ink); border-radius: 16px; box-shadow: 0 3px 0 var(--ink); padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; animation: pop .18s ease-out; }
  .bubble::after { content: ''; position: absolute; left: calc(var(--ax) - 9px); bottom: -11px; width: 16px; height: 16px; background: var(--paper); border-right: 2.5px solid var(--ink); border-bottom: 2.5px solid var(--ink); transform: rotate(45deg); }
  .bubble.below::after { bottom: auto; top: -11px; transform: rotate(225deg); }
  .bubble p { margin: 0; font-size: 14px; font-weight: 600; color: var(--muted); text-align: center; line-height: 1.2; }
  .bubble p b { color: var(--ink); }
  .bubble small { font-size: 12px; font-weight: 600; color: var(--muted); text-align: center; line-height: 1.2; }
  .acts { display: flex; gap: 6px; }
  .acts .btn { flex: 1 1 0; min-width: 0; gap: 4px; white-space: normal; line-height: 1.1; padding: 4px 6px; }
  .acts .btn :global(svg) { width: 18px; height: 18px; }
  .water { background: #BFE3F5; }
  .pupuk { background: #D7EDB8; }
  .bar { position: absolute; z-index: 6; left: 0; right: 0; bottom: calc(var(--safe-b) + 86px); display: flex; gap: 8px; justify-content: center; padding: 0 12px; }
  .bar .btn { position: relative; white-space: nowrap; gap: 5px; }
  .bar .btn .w { margin-left: -1px; }
  .bar .btn :global(svg) { width: 24px; height: 24px; }
  .waterall { background: #BFE3F5; }
  .cnt { position: absolute; top: -10px; right: -8px; min-width: 22px; height: 22px; border-radius: 11px; background: var(--low); color: #fff; border: 2px solid var(--ink); font-size: 12.5px; font-weight: 800; display: grid; place-items: center; padding: 0 5px; }
  .cnt.ok { background: var(--ok); }
  /* Lv3+: tombol kembali jadi ikon saja di layar sempit */
  @media (max-width: 559px) {
    .bar.three .back { padding: 8px 10px; }
    .bar.three .back .lbl { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  }
  @media (max-width: 359px) { .bar .w { display: none; } .bar { gap: 6px; } .bar .btn { padding-left: 10px; padding-right: 10px; } }
  @media (prefers-reduced-motion: reduce) { .plot.sprout, .plot :global(.twinkle), .bubble { animation: none; } .conf { display: none; } }
</style>
