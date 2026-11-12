<script lang="ts">
  // Papan Ular Tangga Kampung: 36 kotak, tangga bambu naik, ular sawah turun, Warung (+2), Becek (diam sekali).
  import { untrack } from 'svelte';
  import { petSVG, ularCell, ularFrames, ULAR_LADDERS, ULAR_SNAKES, ULAR_WARUNG, ULAR_BECEK, ULAR_SIZE } from '@kb/shared';
  import { moveGame, serverNow } from '../../lib/bareng.svelte';
  import { sfx } from '../../lib/sfx';
  let { g, me }: { g: any; me: string } = $props();

  const S = 54, W = S * 6;
  const COLS = ['#E0583F', '#3F7FBF', '#F2B632', '#9A6FC0'];
  const center = (n: number) => { const [c, r] = ularCell(Math.max(1, Math.min(ULAR_SIZE, n))); return [c * S + S / 2, r * S + S / 2]; };
  const player = $derived(g.players.some((x: any) => x.id === me));
  let tick = $state(0);
  $effect(() => { const t = setInterval(() => (tick = serverNow()), 500); return () => clearInterval(t); });
  const left = $derived((void tick, Math.max(0, Math.ceil((g.turnUntil - serverNow()) / 1000))));
  const PIPS: Record<number, number[][]> = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
  const petInner = (x: any) => (x?.pet ? petSVG({ color: x.pet.color ?? '#F2EEE3', ear: x.pet.ear ?? 'tunas', pattern: x.pet.pattern, eyes: x.pet.eyes, tail: x.pet.tail }, []).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '') : '');

  /* ---- langkah demi langkah: dadu berputar, bidak melompat kotak demi kotak, naik tangga / meluncur di ular ---- */
  let shownPos = $state<Record<string, number>>({ ...(g.pos ?? {}) });
  let glideXY = $state<Record<string, [number, number]>>({});
  let hop = $state<Record<string, number>>({});
  let wob = $state<string | null>(null);
  let rolling = $state(false), playing = $state(false), asking = $state(false);
  let face = $state<number>(g.last?.roll ?? 1);
  let actor = $state('');
  let lastAt = g.last?.at ?? 0, gen = 0;
  const myTurn = $derived(player && g.phase === 'main' && g.turn === me && !playing && !asking);
  const wait = (ms: number, my: number) => new Promise<boolean>((r) => setTimeout(() => r(my === gen), ms));
  const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
  /** titik di lengkung ular (sama dengan yang digambar) */
  function snakeAt(a: number, b: number, t: number): [number, number] {
    const [x1, y1] = center(a), [x2, y2] = center(b);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1;
    const c1 = [mx + dy * 0.45, my - dx * 0.2], c2 = [mx - dy * 0.45, my + dx * 0.2], u = 1 - t;
    return [u ** 3 * x1 + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t ** 3 * x2, u ** 3 * y1 + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t ** 3 * y2];
  }
  function glide(id: string, fn: (t: number) => [number, number], ms: number, my: number) {
    return new Promise<boolean>((res) => {
      const t0 = performance.now();
      const f = (now: number) => {
        if (my !== gen) { delete glideXY[id]; return res(false); }
        const t = Math.min(1, (now - t0) / ms);
        glideXY[id] = fn(ease(t));
        if (t < 1) requestAnimationFrame(f); else { delete glideXY[id]; res(true); }
      };
      requestAnimationFrame(f);
    });
  }
  async function animate(last: any, my: number) {
    playing = true; actor = g.players.find((x: any) => x.id === last.by)?.name ?? '';
    const id = last.by, end = Math.min(last.from + last.roll, ULAR_SIZE);
    rolling = true;
    for (let k = 0; k < 8; k++) { face = 1 + ((face + 1 + Math.floor(Math.random() * 4)) % 6); if (!(await wait(85, my))) return; }
    face = last.roll; rolling = false; sfx.pop();
    for (const f of ularFrames(last).slice(1)) {
      if (f.kind === 'step' || f.kind === 'warung' || f.kind === 'finish') {
        if (f.kind !== 'finish') shownPos[id] = f.cell;
        hop[id] = (hop[id] ?? 0) + 1;
        if (f.kind === 'finish') sfx.level(); else sfx.tap();
        if (!(await wait(f.ms, my))) return;
      } else if (f.kind === 'climb') {
        sfx.level();
        const a = center(end), b = center(f.cell);
        if (!(await glide(id, (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], f.ms, my))) return;
        shownPos[id] = f.cell;
      } else if (f.kind === 'slide') {
        sfx.error();
        if (!(await glide(id, (t) => snakeAt(end, f.cell, t), f.ms, my))) return;
        shownPos[id] = f.cell;
      } else if (f.kind === 'becek') {
        wob = id;
        if (!(await wait(f.ms, my))) return;
        wob = null;
      }
    }
    if (my === gen) playing = false;
  }
  $effect(() => {
    const last = g.last, pos = g.pos;
    untrack(() => {
      if (!last || last.at === lastAt) { if (!playing) shownPos = { ...(pos ?? {}) }; return; }
      lastAt = last.at;
      const my = ++gen;
      glideXY = {}; wob = null; rolling = false;
      const late = serverNow() - (last.at ?? 0);
      if (late > (last.anim ?? 0) + 800) { shownPos = { ...(pos ?? {}) }; face = last.roll ?? face; playing = false; return; }
      shownPos = { ...(pos ?? {}), [last.by]: last.from };
      animate(last, my).then(() => { if (my === gen) shownPos = { ...(g.pos ?? {}) }; });
    });
  });
  async function roll() {
    if (!myTurn) return;
    asking = true; sfx.tap();
    await moveGame(g.id, { roll: true });
    asking = false;
  }
  // papan statis (kotak, tangga, ular) digambar sekali
  const boardSvg = (() => {
    let s = '';
    const fills = ['#FFF4D6', '#DDF0E7', '#FFE1D6', '#E2ECFA'];
    for (let n = 1; n <= ULAR_SIZE; n++) {
      const [x, y] = center(n);
      s += `<rect x="${x - S / 2 + 1}" y="${y - S / 2 + 1}" width="${S - 2}" height="${S - 2}" rx="7" fill="${fills[(n + Math.floor((n - 1) / 6)) % 4]}"/><text x="${x - S / 2 + 6}" y="${y - S / 2 + 15}" font-size="12" font-weight="800" fill="#8A8FA3">${n}</text>`;
    }
    for (const [a, b] of Object.entries(ULAR_LADDERS)) {
      const [x1, y1] = center(+a), [x2, y2] = center(b);
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), nx = (-dy / L) * 7, ny = (dx / L) * 7;
      for (const k of [-1, 1]) s += `<line x1="${x1 + nx * k}" y1="${y1 + ny * k}" x2="${x2 + nx * k}" y2="${y2 + ny * k}" stroke="#2B2F4A" stroke-width="7" stroke-linecap="round"/><line x1="${x1 + nx * k}" y1="${y1 + ny * k}" x2="${x2 + nx * k}" y2="${y2 + ny * k}" stroke="#D9C26A" stroke-width="4" stroke-linecap="round"/>`;
      for (let t = 0.15; t < 0.9; t += 0.15) s += `<line x1="${x1 + dx * t - nx}" y1="${y1 + dy * t - ny}" x2="${x1 + dx * t + nx}" y2="${y1 + dy * t + ny}" stroke="#A88B3A" stroke-width="3"/>`;
    }
    for (const [a, b] of Object.entries(ULAR_SNAKES)) {
      const [x1, y1] = center(+a), [x2, y2] = center(b);
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1;
      const d = `M${x1} ${y1}C${mx + dy * 0.45} ${my - dx * 0.2} ${mx - dy * 0.45} ${my + dx * 0.2} ${x2} ${y2}`;
      s += `<path d="${d}" fill="none" stroke="#2B2F4A" stroke-width="11" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#5FB36A" stroke-width="7" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#FFF4C2" stroke-width="2" stroke-dasharray="3 7" stroke-linecap="round"/><circle cx="${x1}" cy="${y1}" r="8" fill="#5FB36A" stroke="#2B2F4A" stroke-width="2"/><circle cx="${x1 - 3}" cy="${y1 - 2}" r="1.8" fill="#2B2F4A"/><circle cx="${x1 + 3}" cy="${y1 - 2}" r="1.8" fill="#2B2F4A"/>`;
    }
    // label Warung & Becek digambar paling atas supaya tidak tertutup tangga / ular
    const tag = (n: number, label: string, col: string) => { const [x, y] = center(n); return `<rect x="${x - 24}" y="${y + 5}" width="48" height="17" rx="8.5" fill="${col}" stroke="#2B2F4A" stroke-width="2"/><text x="${x}" y="${y + 17.5}" text-anchor="middle" font-size="10" font-weight="800" fill="#fff">${label}</text>`; };
    s += tag(ULAR_WARUNG, 'Warung +2', '#E0583F') + tag(ULAR_BECEK, 'Becek', '#8A6A3A');
    const [fx, fy] = center(ULAR_SIZE);
    return s + `<text x="${fx}" y="${fy + 20}" text-anchor="middle" font-size="11" font-weight="800" fill="#2B2F4A">FINIS</text>`;
  })();
</script>

<div class="wrap" role="dialog" aria-label="Papan Ular Tangga">
  <div class="turns">
    {#each g.players as x, i (x.id)}
      <span class:on={g.turn === x.id} class:out={x.left} style="--c:{COLS[i % 4]}"><i>{@html x.pet ? `<svg viewBox="-66 -124 132 130">${petInner(x)}</svg>` : ''}</i>{x.name}{g.finished?.includes(x.id) ? ` · juara ${g.finished.indexOf(x.id) + 1}` : ''}{g.skip?.[x.id] ? ' · becek' : ''}</span>
    {/each}
  </div>
  <svg viewBox="-4 -4 {W + 8} {W + 8}" class="board">
    <rect x="-2" y="-2" width={W + 4} height={W + 4} rx="12" fill="#2B2F4A" />
    {@html boardSvg}
    {#each g.players as x, i (x.id)}
      {#if (shownPos[x.id] ?? 0) > 0 || glideXY[x.id]}
        {@const c = glideXY[x.id] ?? center(shownPos[x.id])}
        <g class="tok" class:free={!!glideXY[x.id]} class:front={actor && x.name === actor} style="transform:translate({c[0] - 18 + (i % 2) * 12}px,{c[1] - 26 + Math.floor(i / 2) * 8}px)">
          {#key hop[x.id] ?? 0}
            <g class="hopper" class:wob={wob === x.id}>
              <circle cx="16" cy="20" r="15" fill="#fff" stroke={COLS[i % 4]} stroke-width="4" />
              <svg x="2" y="4" width="28" height="30" viewBox="-66 -124 132 130">{@html petInner(x)}</svg>
            </g>
          {/key}
        </g>
      {/if}
    {/each}
  </svg>
  <p class="log">{playing ? (rolling ? `${actor} melempar dadu…` : `${actor} dapat ${face}, jalan…`) : g.log?.at(-1) ?? ''}</p>
  {#if g.phase === 'main'}
    <div class="ctrl">
      <svg viewBox="-24 -24 48 48" class="die" class:spin={rolling}><rect x="-21" y="-21" width="42" height="42" rx="10" fill="#FFFDF7" stroke="#2B2F4A" stroke-width="3" />{#each PIPS[face] ?? [] as [x, y]}<circle cx={x * 10} cy={y * 10} r="4" fill="#2B2F4A" />{/each}</svg>
      <button class="btn hot big" disabled={!myTurn} onclick={roll}>{playing ? 'Bidak sedang jalan…' : myTurn ? 'Lempar dadu' : player ? `Giliran ${g.players.find((x: any) => x.id === g.turn)?.name ?? ''}` : 'Kamu menonton'}</button>
      <span class="ring" class:hot={myTurn}>{left}</span>
    </div>
  {/if}
</div>

<style>
  .wrap { position: fixed; z-index: 60; left: 50%; top: 50%; transform: translate(-50%, -50%); max-height: calc(100dvh - var(--safe-t) - var(--safe-b) - 24px); width: min(420px, calc(100% - 16px)); display: flex; flex-direction: column; gap: 6px; background: var(--paper); border: 3px solid var(--ink); border-radius: 20px; box-shadow: 0 5px 0 var(--ink); padding: 8px 10px; overflow-y: auto; }
  .turns { display: flex; flex-wrap: wrap; gap: 4px; }
  .turns span { display: inline-flex; align-items: center; gap: 3px; border: 2.5px solid transparent; border-radius: 999px; padding: 0 8px 0 1px; font-size: 12.5px; font-weight: 800; }
  .turns span.on { border-color: var(--c); background: #FFF4D6; }
  .turns span.out { opacity: .45; text-decoration: line-through; }
  .turns i { width: 22px; height: 24px; display: inline-block; }
  .turns i :global(svg) { width: 100%; height: 100%; }
  .board { width: 100%; height: auto; display: block; font-family: var(--font); }
  .tok { transition: transform .26s cubic-bezier(.3, 1.3, .5, 1); }
  .tok.free { transition: none; }
  .hopper { animation: hop .3s ease-out; }
  .hopper.wob { animation: wob .2s ease-in-out 3; }
  @keyframes hop { 0% { transform: translateY(0); } 40% { transform: translateY(-11px); } 100% { transform: translateY(0); } }
  @keyframes wob { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-3px) rotate(-6deg); } 75% { transform: translateX(3px) rotate(6deg); } }
  .log { margin: 0; min-height: 20px; background: var(--soft); border-radius: 12px; padding: 4px 10px; font-size: 13.5px; font-weight: 700; }
  .ctrl { display: flex; align-items: center; gap: 10px; }
  .die { width: 48px; height: 48px; flex: none; }
  .die.spin { animation: spin .5s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .big { flex: 1; min-height: 48px; font-size: 17px; }
  .ring { width: 34px; height: 34px; border-radius: 50%; border: 3.5px solid #C9C2B0; display: grid; place-items: center; font-weight: 800; font-size: 13px; flex: none; }
  .ring.hot { border-color: #F2B632; }
</style>
