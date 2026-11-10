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
  let start: { x: number; y: number; id: string } | null = null;
  let moved = false;

  function down(e: PointerEvent, id: string) {
    if (G.busy) return;
    start = { x: e.clientX, y: e.clientY, id };
    moved = false;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (!start) return;
    if (!moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 8) return;
    moved = true;
    G.feedDrag = { x: e.clientX, y: e.clientY, id: start.id };
  }
  function up(e: PointerEvent) {
    if (!start) return;
    const id = start.id;
    start = null;
    const drag = G.feedDrag;
    G.feedDrag = null;
    if (!moved) return feed(id);
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

<svelte:window onpointermove={move} onpointerup={up} onpointercancel={() => { start = null; G.feedDrag = null; }} />
<div class="tray" role="region" aria-label="Nampan makanan">
  <div class="head">
    <b>Seret makanan ke mulut {G.me.pet.name}</b>
    <button class="btn sm" onclick={() => (G.feeding = false)}>Tutup</button>
  </div>
  {#if foods.length}
    <div class="list">
      {#each foods as { it, n } (it!.id)}
        <button class="food" class:cure={it!.data?.cure} onpointerdown={(e) => down(e, it!.id)} aria-label="Beri {it!.name} ({n})" title={effText(it!.data?.effects)}>
          <span class="ic">{@html itemIcon(it!)}</span>
          <span class="nm">{it!.name}</span>
          <i>×{n}</i>
        </button>
      {/each}
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
  .list { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding: 2px 2px 4px; touch-action: pan-x; }
  .food { flex: none; position: relative; width: 74px; display: flex; flex-direction: column; align-items: center; gap: 1px; border: 2px solid var(--ink); border-radius: 12px; background: var(--card); padding: 4px 2px; cursor: grab; touch-action: none; user-select: none; }
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
