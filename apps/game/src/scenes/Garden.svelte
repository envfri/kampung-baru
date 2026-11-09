<script lang="ts">
  import { G, item, run, toast, fx, timeLeft, serverNow, settings } from '../lib/game.svelte';
  import { api } from '../lib/api';
  import { sfx } from '../lib/sfx';
  import { I } from '../lib/icons';

  const slots = $derived(settings().garden?.slots ?? 6);
  const plots = $derived(Object.fromEntries((G.me.garden ?? []).map((p: any) => [p.slot, p])));
  const cols = 3;
  const cell = (i: number) => ({ x: 40 + (i % cols) * 112, y: 150 + Math.floor(i / cols) * 128 });

  function progress(p: any) {
    const a = new Date(p.planted_at).getTime(), b = new Date(p.ready_at).getTime();
    return Math.max(0, Math.min(1, (serverNow() - a) / Math.max(1, b - a)));
  }
  function plantSVG(p: any, prog: number, x: number, y: number) {
    const seed = item(p.seed_id);
    const yieldIt = item(seed?.data?.yieldItem);
    const fruit = (yieldIt?.art as any)?.colors?.main ?? '#E0583F';
    const cx = x + 46, base = y + 52;
    if (prog < 0.34) return `<path d="M${cx} ${base}v-12" stroke="#3E8E4E" stroke-width="4" stroke-linecap="round"/><ellipse cx="${cx - 7}" cy="${base - 14}" rx="7" ry="4" fill="#7CC57D" stroke="#2B2F4A" stroke-width="2"/><ellipse cx="${cx + 7}" cy="${base - 15}" rx="7" ry="4" fill="#5DB36A" stroke="#2B2F4A" stroke-width="2"/>`;
    const h = prog < 0.75 ? 30 : 42;
    let s = `<path d="M${cx} ${base}v-${h}" stroke="#3E8E4E" stroke-width="5" stroke-linecap="round"/>`;
    for (const [dx, dy, r] of [[-14, -h * 0.45, -30], [14, -h * 0.6, 30], [-12, -h * 0.85, -20], [12, -h, 25]]) s += `<ellipse cx="${cx + dx}" cy="${base + dy}" rx="11" ry="6" transform="rotate(${r} ${cx + dx} ${base + dy})" fill="#56B36F" stroke="#2B2F4A" stroke-width="2"/>`;
    if (prog >= 1) for (const [dx, dy] of [[-10, -h * 0.55], [10, -h * 0.75], [0, -h - 4]]) s += `<circle cx="${cx + dx}" cy="${base + dy}" r="7" fill="${fruit}" stroke="#2B2F4A" stroke-width="2"/>`;
    return s;
  }

  async function tap(i: number) {
    const p = plots[i];
    if (!p) { G.sheet = 'seed'; G.sheetArg = { slot: i }; sfx.tap(); return; }
    if (progress(p) < 1) { toast(`Siap dipanen ${timeLeft(new Date(p.ready_at).getTime() - serverNow())} lagi.`); return; }
    const r: any = await run(() => api.post('/api/garden/harvest', { slot: i }));
    if (r) { sfx.coin(); toast(`Panen ${r.harvested.qty} ${item(r.harvested.itemId)?.name ?? ''}!`, 'good'); }
  }
  void fx;
</script>

<div class="garden">
  <svg viewBox="0 0 400 520" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Kebun">
    <rect x="-200" y="-200" width="800" height="1000" fill="#A9D18A"/>
    <rect x="20" y="126" width="360" height="{Math.ceil(slots / cols) * 128 + 20}" rx="18" fill="#C9A16E" stroke="#2B2F4A" stroke-width="3"/>
    <path d="M10 118H390" stroke="#8A5A36" stroke-width="6" stroke-dasharray="4 14" stroke-linecap="round"/>
    {#each Array(slots) as _, i}
      {@const c = cell(i)}
      {@const p = plots[i]}
      {@const prog = p ? (G.now, progress(p)) : 0}
      <g class="plot" role="button" tabindex="0" aria-label="Petak {i + 1}" onclick={() => tap(i)} onkeydown={(e) => e.key === 'Enter' && tap(i)}>
        <rect x={c.x} y={c.y} width="92" height="78" rx="12" fill="#8C5A2B" stroke="#2B2F4A" stroke-width="2.5"/>
        <path d="M{c.x + 10} {c.y + 26}h72M{c.x + 10} {c.y + 46}h72M{c.x + 10} {c.y + 66}h72" stroke="#6E4520" stroke-width="2"/>
        {#if p}
          {@html plantSVG(p, prog, c.x, c.y)}
          <rect x={c.x + 6} y={c.y + 84} width="80" height="12" rx="6" fill="#E9E4D6" stroke="#2B2F4A" stroke-width="2"/>
          <rect x={c.x + 8} y={c.y + 86} width={76 * prog} height="8" rx="4" fill={prog >= 1 ? '#3FA06A' : '#E8A33A'}/>
          {#if prog >= 1}<text x={c.x + 46} y={c.y + 120} text-anchor="middle" class="lbl ready">Panen!</text>
          {:else}<text x={c.x + 46} y={c.y + 120} text-anchor="middle" class="lbl">{timeLeft(new Date(p.ready_at).getTime() - serverNow())}</text>{/if}
        {:else}
          <text x={c.x + 46} y={c.y + 46} text-anchor="middle" class="plus">+</text>
          <text x={c.x + 46} y={c.y + 120} text-anchor="middle" class="lbl">Tanam</text>
        {/if}
      </g>
    {/each}
  </svg>
  <div class="bar">
    <button class="btn" onclick={() => (G.view = 'map')}>{@html I.back} Kampung</button>
    <button class="btn" onclick={() => { G.shopId = 'pasar'; G.sheet = 'shop'; }}>Beli bibit</button>
  </div>
</div>

<style>
  .garden { position: absolute; inset: 0; }
  svg { position: absolute; inset: calc(var(--safe-t) + 70px) 0 calc(var(--safe-b) + 140px); width: 100%; height: calc(100% - var(--safe-t) - var(--safe-b) - 210px); }
  .plot { cursor: pointer; }
  .plot:hover rect:first-child { fill: #9C6A38; }
  .lbl { font: 700 14px var(--font); fill: var(--ink); }
  .ready { fill: #1E7A4C; font-size: 16px; }
  .plus { font: 800 34px var(--font); fill: #F3E3B5; }
  .bar { position: absolute; z-index: 6; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-b) + 86px); display: flex; gap: 8px; }
</style>
