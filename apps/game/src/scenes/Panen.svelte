<script lang="ts">
  import { onDestroy } from 'svelte';
  import { panenSchedule, PANEN_LANES, PANEN_FALL_MS, renderPet, eventDropSVG, type Drop } from '@kb/shared';
  import { G, merge, fail, toast, wearItems, settings } from '../lib/game.svelte';
  import { api } from '../lib/api';
  import { sfx, buzz } from '../lib/sfx';
  import { I, COIN } from '../lib/icons';

  type Phase = 'intro' | 'count' | 'play' | 'finale' | 'done';
  let phase = $state<Phase>('intro');
  let count = $state(3);
  let busy = $state(false);
  let runId = '';
  let schedule: Drop[] = [];
  let decor = '';
  let duration = 30000;
  let t0 = 0;
  let now = $state(0);
  let basket = $state(200);
  let caught: number[] = [];
  let resolved = new Set<number>();
  let score = $state(0);
  let flash = $state<{ x: number; text: string; good: boolean; n: number } | null>(null);
  let result = $state<any>(null);
  let raf = 0;
  let svgEl: SVGSVGElement | undefined = $state();
  const cfg = $derived(settings().games?.panen ?? {});
  const left = $derived(G.me.limits?.games?.panen ?? cfg.playsPerDay);
  const W = 400, TOP = 70, CATCH = 470;
  const laneX = (l: number) => 50 + l * ((W - 100) / (PANEN_LANES - 1));

  const visible = $derived(phase === 'play' ? schedule.map((d, i) => ({ d, i })).filter(({ d, i }) => !resolved.has(i) && now >= d.t && now <= d.t + PANEN_FALL_MS + 120) : []);
  const dropArt = (d: Drop) => {
    if (d.kind === 'kerikil') return `<ellipse rx="13" ry="10" fill="#9AA7B8" stroke="#2B2F4A" stroke-width="2.4"/><path d="M-5 -3q3 -3 7 -1" stroke="#fff" stroke-width="2" fill="none" opacity=".6"/>`;
    if (d.kind === 'emas') return `<circle r="13" fill="#F2B632" stroke="#2B2F4A" stroke-width="2.4"/><path d="M0 -13q4 -7 10 -6q-2 6 -10 6Z" fill="#3FA06A" stroke="#2B2F4A" stroke-width="1.6"/><path d="M-4 -4l2 2" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`;
    if (d.kind === 'event') return eventDropSVG(decor);
    const c = ['#E0583F', '#F2994A', '#9A6FC0'][(d.t >> 3) % 3];
    return `<circle r="12" fill="${c}" stroke="#2B2F4A" stroke-width="2.4"/><path d="M0 -12q4 -7 10 -6q-2 6 -10 6Z" fill="#3FA06A" stroke="#2B2F4A" stroke-width="1.6"/><ellipse cx="-4" cy="-4" rx="3" ry="2" fill="#fff" opacity=".6"/>`;
  };

  async function start() {
    busy = true;
    try {
      const r = await api.post('/api/games/panen/start');
      merge(r);
      runId = r.runId; duration = r.durationMs; decor = r.decor ?? '';
      schedule = panenSchedule(r.seed, duration, !!r.eventDrops);
      caught = []; resolved = new Set(); score = 0; result = null; basket = W / 2;
      G.immersive = true;
      phase = 'count'; count = 3; sfx.tap();
      const tick = setInterval(() => {
        count--;
        if (count > 0) sfx.tap();
        else { clearInterval(tick); phase = 'play'; t0 = performance.now(); sfx.level(); loop(); }
      }, 1000);
    } catch (e) { fail(e); } finally { busy = false; }
  }

  function loop() {
    now = performance.now() - t0;
    schedule.forEach((d, i) => {
      if (resolved.has(i) || now < d.t + PANEN_FALL_MS) return;
      resolved.add(i);
      const hit = Math.abs(basket - laneX(d.lane)) < 46;
      if (!hit) return;
      caught.push(i);
      score = Math.max(0, score + d.value);
      flash = { x: laneX(d.lane), text: d.value > 0 ? `+${d.value}` : `${d.value}`, good: d.value > 0, n: (flash?.n ?? 0) + 1 };
      if (d.value > 0) { d.kind === 'buah' ? sfx.pop() : sfx.coin(); buzz(10); } else { sfx.error(); buzz(60); }
    });
    if (now >= duration) return finish();
    raf = requestAnimationFrame(loop);
  }

  async function finish() {
    // "Waktu habis!" tampil sebentar (skor terakhir masih terlihat) sebelum kartu hasil
    phase = 'finale';
    cancelAnimationFrame(raf);
    sfx.pop();
    busy = true;
    const held = new Promise((ok) => setTimeout(ok, 1000));
    try {
      const r = await api.post('/api/games/panen/finish', { runId, caught });
      await held; phase = 'done';
      merge(r);
      result = r;
      if (r.reward) sfx.coin();
      if (r.levelUp) toast(`Naik ke Lv ${r.levelUp}!`, 'good');
    } catch (e: any) { await held; phase = 'done'; fail(e); result = { score, reward: 0, error: true }; } finally { busy = false; G.immersive = false; }
  }

  function moveTo(clientX: number) {
    if (!svgEl || phase !== 'play') return;
    const r = svgEl.getBoundingClientRect();
    const scale = Math.min(r.width / W, r.height / 560);
    const offX = (r.width - W * scale) / 2;
    basket = Math.max(30, Math.min(W - 30, (clientX - r.left - offX) / scale));
  }
  function key(e: KeyboardEvent) {
    if (phase !== 'play') return;
    if (['ArrowLeft', 'a', 'A'].includes(e.key)) basket = Math.max(30, basket - 40);
    if (['ArrowRight', 'd', 'D'].includes(e.key)) basket = Math.min(W - 30, basket + 40);
  }
  onDestroy(() => { cancelAnimationFrame(raf); G.immersive = false; });
  const timeLeft = $derived(Math.max(0, Math.ceil((duration - now) / 1000)));
  const back = () => { G.view = 'map'; G.sheet = 'games'; };
</script>

<svelte:window onkeydown={key} />
<div class="panen">
  <svg bind:this={svgEl} viewBox="0 0 {W} 560" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Panen Buah"
    onpointerdown={(e) => moveTo(e.clientX)} onpointermove={(e) => (e.buttons || e.pointerType !== 'mouse') && moveTo(e.clientX)}>
    <rect x="-300" y="-100" width="1000" height="800" fill="#BFE3F5"/>
    <rect x="-300" y={CATCH + 30} width="1000" height="200" fill="#8CC56E"/>
    <path d="M-300 {CATCH + 30}H700" stroke="#2B2F4A" stroke-width="2.5"/>
    {#each [0, 1, 2, 3, 4] as l}<path d="M{laneX(l)} {TOP}V{CATCH}" stroke="#FFFFFF" stroke-width="2" stroke-dasharray="4 10" opacity=".6"/>{/each}
    <path d="M-20 {TOP - 10}Q100 {TOP - 40} 200 {TOP - 14}T420 {TOP - 10}V{TOP - 80}H-20Z" fill="#5DA05A" stroke="#2B2F4A" stroke-width="2.5"/>
    {#each visible as { d, i } (i)}
      {@const y = TOP + ((now - d.t) / PANEN_FALL_MS) * (CATCH - TOP)}
      <g transform="translate({laneX(d.lane)} {y.toFixed(1)})">{@html dropArt(d)}</g>
    {/each}
    <g transform="translate({basket.toFixed(1)} {CATCH + 26})">
      <g transform="translate(0 -18) scale(.5)">{@html renderPet(G.me.pet, wearItems(G.me.pet.wear).filter((w) => w.data?.slot !== 'back'))}</g>
      <path d="M-34 -24h68l-8 26h-52Z" fill="#C8955A" stroke="#2B2F4A" stroke-width="3" stroke-linejoin="round"/>
      <path d="M-30 -14h60M-28 -5h56" stroke="#8A5A36" stroke-width="2"/>
    </g>
    {#if flash}
      {#key flash.n}<text x={flash.x} y={CATCH - 40} text-anchor="middle" class="flash" class:bad={!flash.good}>{flash.text}</text>{/key}
    {/if}
  </svg>

  {#if phase === 'play' || phase === 'count' || phase === 'finale'}
    <div class="top"><span>{@html COIN} {score} poin</span><span>{timeLeft} d</span></div>
    {#if phase === 'count'}<div class="count">{count}</div>{/if}
    {#if phase === 'finale'}<div class="banner" role="status">Waktu habis!</div>{:else}<p class="hint">Geser jari ke kiri-kanan</p>{/if}
  {:else}
    <div class="card">
      {#if phase === 'intro'}
        <h2>Panen Buah</h2>
        <p>Geser keranjang untuk menangkap buah. Buah emas +3, kerikil −2.{#if decor} Benda event memberi poin event!{/if}</p>
        <p class="muted">Sisa main: <b>{left}</b> · {cfg.energiCost} energi · hadiah sampai {cfg.maxCoins} koin</p>
      {:else if result}
        <h2>{result.error ? 'Permainan selesai' : `Skor ${result.score}`}</h2>
        {#if result.reward}<p class="reward">{@html COIN} +{result.reward} koin</p>{/if}
        {#if result.eventDrops}<p>Benda event tertangkap: <b>{result.eventDrops}</b></p>{/if}
      {:else}<p>Menghitung hasil…</p>{/if}
      <div class="row">
        <button class="btn" onclick={back}>{@html I.back} Balai</button>
        <button class="btn hot" disabled={busy || left <= 0} onclick={start}>{phase === 'intro' ? 'Mulai' : `Main lagi (${left})`}</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .panen { position: absolute; inset: 0; background: #BFE3F5; touch-action: none; }
  svg { position: absolute; left: 0; right: 0; top: calc(var(--safe-t) + 10px); width: 100%; height: calc(100% - var(--safe-t) - var(--safe-b) - 20px); touch-action: none; }
  .flash { font: 800 26px var(--font); fill: #1E7A4C; stroke: #FFFDF7; stroke-width: 4px; paint-order: stroke; animation: fxUp .8s ease-out forwards; }
  .flash.bad { fill: #A93A27; }
  .top { position: absolute; top: calc(var(--safe-t) + 10px); left: 12px; right: 12px; display: flex; justify-content: space-between; z-index: 5; }
  .top span { display: flex; align-items: center; gap: 4px; background: var(--paper); border: 2.5px solid var(--ink); border-radius: 999px; padding: 3px 12px; font-weight: 800; font-size: 17px; box-shadow: 0 2px 0 var(--ink); }
  .top :global(svg) { width: 20px; height: 20px; }
  .banner { position: absolute; z-index: 8; left: 50%; top: 34%; transform: translate(-50%, -50%); white-space: nowrap; font-size: clamp(44px, 13vw, 76px); font-weight: 800; color: #FFFDF7; -webkit-text-stroke: 4px var(--ink); paint-order: stroke fill; text-shadow: 0 5px 0 var(--ink); pointer-events: none; animation: pop .45s; }
  .count { position: absolute; z-index: 8; left: 50%; top: 38%; transform: translate(-50%, -50%); font-size: 120px; font-weight: 800; color: var(--paper); -webkit-text-stroke: 5px var(--ink); }
  .hint { position: absolute; bottom: calc(var(--safe-b) + 14px); left: 50%; transform: translateX(-50%); margin: 0; background: rgba(255,253,247,.9); border: 2px solid var(--ink); border-radius: 12px; padding: 2px 10px; font-weight: 700; font-size: 13px; pointer-events: none; }
  .card { position: absolute; z-index: 8; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-b) + 86px); width: min(420px, calc(100vw - 20px)); background: var(--paper); border: 3px solid var(--ink); border-radius: 20px; box-shadow: 0 5px 0 var(--ink); padding: 16px; display: flex; flex-direction: column; gap: 8px; }
  h2 { margin: 0; font-size: 24px; font-weight: 800; }
  p { margin: 0; font-weight: 600; } .muted { color: var(--muted); font-size: 14px; }
  .reward { display: flex; align-items: center; gap: 6px; font-size: 20px; font-weight: 800; }
  .reward :global(svg) { width: 26px; height: 26px; }
  .row { display: flex; gap: 8px; } .row .btn { flex: 1; }
</style>
