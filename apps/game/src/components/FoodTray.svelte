<script lang="ts">
  // Nampan makanan: seret makanan ke mulut pet (atau ketuk untuk langsung menyuapi).
  import { itemIcon } from '@kb/shared';
  import { G, item, effText, run, post, fx, toast, goTo } from '../lib/game.svelte';
  import { sfx } from '../lib/sfx';

  const foods = $derived(
    Object.entries(G.me.inventory ?? {})
      .map(([id, n]) => ({ it: item(id), n: n as number }))
      .filter((x) => x.it?.kind === 'food' && x.n > 0)
      .sort((a, b) => Number(!!b.it!.data?.cure && G.me.pet.sick) - Number(!!a.it!.data?.cure && G.me.pet.sick) || a.it!.name.localeCompare(b.it!.name)),
  );
  // Geser ke samping = menggulir nampan (jari: digulir browser sendiri lewat touch-action pan-x; mouse: digulir di sini),
  // seret ke atas = membawa makanan ke mulut pet, ketuk = langsung menyuapi.
  let start: { x: number; y: number; id: string; touch: boolean; sl: number } | null = null;
  let mode: null | 'drag' | 'scroll' = null;
  let listEl = $state<HTMLElement | null>(null);
  let canL = $state(false), canR = $state(false);
  const edges = () => { const l = listEl; if (!l) return; canL = l.scrollLeft > 2; canR = l.scrollLeft + l.clientWidth < l.scrollWidth - 2; };
  $effect(() => {
    const l = listEl; if (!l) return;
    edges();
    const ro = new ResizeObserver(edges); ro.observe(l);
    // roda mouse naik/turun → nampan bergeser ke samping
    const wheel = (e: WheelEvent) => {
      if (l.scrollWidth <= l.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault(); l.scrollLeft += e.deltaY;
    };
    l.addEventListener('wheel', wheel, { passive: false });
    return () => { ro.disconnect(); l.removeEventListener('wheel', wheel); };
  });
  $effect(() => { void foods.length; queueMicrotask(edges); });

  function down(e: PointerEvent, id: string) {
    if (G.busy) return;
    start = { x: e.clientX, y: e.clientY, id, touch: e.pointerType === 'touch', sl: listEl?.scrollLeft ?? 0 };
    mode = null;
  }
  function move(e: PointerEvent) {
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (!mode) {
      if (Math.hypot(dx, dy) < 8) return;
      // lebih ke samping daripada ke atas → menggulir; selain itu → menyeret makanan
      mode = Math.abs(dx) > Math.abs(dy) ? 'scroll' : 'drag';
    }
    if (mode === 'scroll') { if (!start.touch && listEl) listEl.scrollLeft = start.sl - dx; return; }
    G.feedDrag = { x: e.clientX, y: e.clientY, id: start.id };
  }
  function cancel() { start = null; mode = null; G.feedDrag = null; }
  function up(e: PointerEvent) {
    if (!start) return;
    const id = start.id, m = mode;
    const drag = G.feedDrag;
    cancel();
    if (!m) return feed(id);
    if (m !== 'drag') return;
    // dilepas di dekat mulut pet?
    const r = document.querySelector('.room .pet')?.getBoundingClientRect();
    if (r && drag && Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height * 0.55)) < Math.max(120, r.width)) feed(id);
  }

  async function feed(id: string) {
    const it = item(id);
    const r: any = await run(() => post('/api/action', { type: 'makan', itemId: id }));
    if (!r) return;
    G.chewing = Date.now();
    sfx.eat();
    setTimeout(() => sfx.eat(), 380);
    fx('food');
    setTimeout(() => fx('hearts'), 700);
    toast(r.result?.cured ? `${G.me.pet.name} minum ${it?.name} dan sembuh!` : `${G.me.pet.name} makan ${it?.name}`, 'good');
    if (r.result?.levelUp) { sfx.level(); toast(`Naik ke Lv ${r.result.levelUp}!`, 'good'); }
  }
  const dragIt = $derived(G.feedDrag ? item(G.feedDrag.id) : null);
</script>

<svelte:window onpointermove={move} onpointerup={up} onpointercancel={cancel} />
<div class="tray" role="region" aria-label="Nampan makanan">
  <div class="head">
    <b>Seret makanan ke mulut {G.me.pet.name}</b>
    <button class="btn sm" onclick={() => (G.feeding = false)}>Tutup</button>
  </div>
  {#if foods.length}
    <div class="wrap" class:l={canL} class:r={canR}>
    <div class="list" bind:this={listEl} onscroll={edges}>
      {#each foods as { it, n } (it!.id)}
        <button class="food" class:cure={it!.data?.cure} onpointerdown={(e) => down(e, it!.id)} aria-label="Beri {it!.name} ({n})" title={effText(it!.data?.effects)}>
          <span class="ic">{@html itemIcon(it!)}</span>
          <span class="nm">{it!.name}</span>
          <i>×{n}</i>
        </button>
      {/each}
    </div>
    </div>
  {:else}
    <p class="empty">Tas makanan kosong. <button class="btn sm hot" onclick={() => { G.feeding = false; goTo('pasar'); }}>Jalan ke Pasar Pagi</button></p>
  {/if}
</div>
{#if G.feedDrag && dragIt}
  <div class="ghost" style="left:{G.feedDrag.x}px;top:{G.feedDrag.y}px" aria-hidden="true">{@html itemIcon(dragIt)}</div>
{/if}

<style>
  .tray { position: absolute; z-index: 14; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-b) + 150px); width: min(560px, calc(100vw - 16px)); background: var(--paper); border: 2.5px solid var(--ink); border-radius: 18px; box-shadow: 0 4px 0 var(--ink); padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; animation: pop .2s ease-out; }
  .head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .head b { font-size: 14.5px; }
  .wrap { position: relative; min-width: 0; }
  /* bayangan tepi: tanda masih ada makanan lain bila digeser */
  .wrap::before, .wrap::after { content: ''; position: absolute; z-index: 1; top: 0; bottom: 4px; width: 22px; pointer-events: none; opacity: 0; transition: opacity .15s; }
  .wrap::before { left: 0; background: linear-gradient(90deg, var(--paper), transparent); }
  .wrap::after { right: 0; background: linear-gradient(270deg, var(--paper), transparent); }
  .wrap.l::before, .wrap.r::after { opacity: 1; }
  .list { display: flex; gap: 6px; overflow-x: auto; overscroll-behavior-x: contain; scrollbar-width: none; padding: 8px 6px 4px 2px; touch-action: pan-x; }
  /* pan-x: geser ke samping tetap menggulir nampan walau jari mulai di atas makanan; gerakan ke atas diteruskan ke seret */
  .food { flex: none; position: relative; width: 74px; display: flex; flex-direction: column; align-items: center; gap: 1px; border: 2px solid var(--ink); border-radius: 12px; background: var(--card); padding: 4px 2px; cursor: grab; touch-action: pan-x; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
  @media (pointer: fine) { .list { scrollbar-width: thin; } }
  .food.cure { background: #FFF3CF; }
  .ic { width: 54px; height: 44px; display: grid; place-items: center; pointer-events: none; }
  .ic :global(svg) { width: 52px; height: 42px; }
  .nm { font-size: 11.5px; font-weight: 700; line-height: 1.1; text-align: center; max-height: 2.3em; overflow: hidden; pointer-events: none; }
  i { position: absolute; top: -6px; right: -4px; font-style: normal; background: var(--ink); color: var(--paper); font-size: 11px; font-weight: 800; border-radius: 8px; padding: 0 5px; }
  .empty { margin: 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-weight: 600; }
  .ghost { position: fixed; z-index: 60; width: 64px; height: 54px; transform: translate(-50%, -70%) rotate(-8deg); pointer-events: none; filter: drop-shadow(0 4px 0 rgba(43,47,74,.25)); }
  .ghost :global(svg) { width: 100%; height: 100%; }
  @media (min-width: 900px) and (min-aspect-ratio: 1/1) { .tray { bottom: calc(var(--safe-b) + 96px); } }
</style>
