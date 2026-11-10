<script lang="ts">
  // Gasing: tenaga naik-turun; lepas saat penunjuk di zona hijau supaya gasing berputar lama. 5 ronde.
  import { onDestroy } from 'svelte';
  import { gasingRounds, gasingMeter, gasingSpin, type GasingRound } from '@kb/shared';
  import { G, settings } from '../lib/game.svelte';
  import { createRun } from '../lib/minigame.svelte';
  import { sfx, buzz } from '../lib/sfx';
  import GameCard from './GameCard.svelte';

  const cfg = $derived(settings().games?.gasing ?? {});
  const left = $derived(G.me.limits?.games?.gasing ?? cfg.playsPerDay ?? 0);
  let rounds = $state<GasingRound[]>([]);
  let idx = $state(0), meter = $state(0), mode = $state<'aim' | 'spin'>('aim');
  let spins = $state<number[]>([]);
  let releases: number[] = [];
  let roundStart = 0, raf = 0, timer: any;

  const run = createRun('gasing', (r) => {
    rounds = gasingRounds(r.seed, r.rounds ?? cfg.rounds ?? 5);
    idx = 0; spins = []; releases = [];
    startRound();
  });
  function startRound() {
    mode = 'aim';
    roundStart = performance.now();
    cancelAnimationFrame(raf);
    const loop = () => { meter = gasingMeter(performance.now() - roundStart, rounds[idx].speed); raf = requestAnimationFrame(loop); };
    loop();
  }
  function release() {
    if (run.st.phase !== 'play' || mode !== 'aim') return;
    const t = Math.round(performance.now() - roundStart);
    if (t < 160) return;
    cancelAnimationFrame(raf);
    releases.push(t);
    const s = gasingSpin(rounds[idx], t);
    spins = [...spins, s];
    mode = 'spin';
    s >= 10 ? sfx.level() : s >= 6 ? sfx.coin() : sfx.pop();
    buzz(s >= 10 ? [20, 40, 20] : 15);
    timer = setTimeout(() => {
      if (idx + 1 >= rounds.length) run.finish({ releases });
      else { idx++; startRound(); }
    }, 1700);
  }
  function key(e: KeyboardEvent) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); release(); } }
  onDestroy(() => { cancelAnimationFrame(raf); clearTimeout(timer); run.stop(); });

  const r = $derived(rounds[idx]);
  const total = $derived(Math.round(spins.reduce((a, b) => a + b, 0) * 10) / 10);
  const last = $derived(spins[spins.length - 1] ?? 0);
  const BAR_T = 120, BAR_H = 300;
</script>

<svelte:window onkeydown={key} />
<div class="game-bg gasing">
  <svg viewBox="0 0 400 560" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Gasing">
    <rect x="-300" y="-100" width="1000" height="800" fill="#F3E3C2" />
    <ellipse cx="170" cy="430" rx="150" ry="40" fill="#C8955A" stroke="#2B2F4A" stroke-width="3" />
    <ellipse cx="170" cy="424" rx="132" ry="32" fill="#D9AE73" />
    <!-- gasing -->
    <g transform="translate(170 {mode === 'spin' ? 392 : 360})">
      <g class="gs" class:spin={mode === 'spin'} style="--dur:{Math.max(0.12, 0.5 - last * 0.03)}s">
        <path d="M0 40L-34 -2Q-38 -20 0 -24Q38 -20 34 -2Z" fill="#E0583F" stroke="#2B2F4A" stroke-width="3" stroke-linejoin="round" />
        <path d="M-30 -6Q0 4 30 -6" fill="none" stroke="#F2B632" stroke-width="5" />
        <path d="M-22 -16Q0 -8 22 -16" fill="none" stroke="#FFFDF7" stroke-width="3" />
        <rect x="-4" y="-40" width="8" height="18" rx="3" fill="#8A5A36" stroke="#2B2F4A" stroke-width="2.4" />
      </g>
      {#if mode === 'aim'}<path d="M6 -36q40 -30 70 -10" fill="none" stroke="#F4EEE2" stroke-width="3" stroke-dasharray="4 4" />{/if}
    </g>
    {#if mode === 'spin'}<text x="170" y="300" text-anchor="middle" class="flash" class:bad={last < 6}>{last.toFixed(1)} detik!</text>{/if}
    <!-- penunjuk tenaga -->
    {#if r}
      <g transform="translate(340 0)">
        <rect x="-18" y={BAR_T} width="36" height={BAR_H} rx="10" fill="#FFFDF7" stroke="#2B2F4A" stroke-width="3" />
        <rect x="-15" y={BAR_T + (1 - r.zone - r.width) * BAR_H} width="30" height={r.width * 2 * BAR_H} fill="#8FD3A7" />
        <rect x="-15" y={BAR_T + (1 - r.zone - r.width / 3) * BAR_H} width="30" height={(r.width * 2 * BAR_H) / 3} fill="#3FA06A" />
        <path d="M-26 {BAR_T + (1 - meter) * BAR_H}h52" stroke="#2B2F4A" stroke-width="5" stroke-linecap="round" />
        <text x="0" y={BAR_T - 12} text-anchor="middle" font-family="'Baloo 2',sans-serif" font-weight="800" font-size="15" fill="#2B2F4A">Tenaga</text>
      </g>
    {/if}
  </svg>

  {#if run.st.phase === 'play' || run.st.phase === 'count'}
    <div class="top"><span>Ronde {Math.min(idx + 1, rounds.length || 5)}/{rounds.length || cfg.rounds}</span><span>{total.toFixed(1)} d</span></div>
    {#if run.st.phase === 'play'}
      <div class="pads"><button class="btn hot pad" disabled={mode !== 'aim'} onpointerdown={(e) => { e.preventDefault(); release(); }}>Lepas gasing!</button></div>
    {/if}
  {/if}
  <GameCard {run} title="Gasing" {left} info="{cfg.energiCost} energi · {cfg.coinPerSec} koin per detik berputar (maks {cfg.maxCoins})">
    {#snippet intro()}<p>Penunjuk tenaga naik-turun. Tekan <b>Lepas gasing!</b> saat penunjuk ada di zona hijau (paling tengah = paling lama). {cfg.rounds} ronde, makin lama makin cepat.</p>{/snippet}
    {#snippet result()}<p>Total berputar {run.st.result.total?.toFixed?.(1) ?? run.st.result.score} detik ({(run.st.result.spins ?? []).map((x: number) => x.toFixed(1)).join(' · ')})</p>{/snippet}
  </GameCard>
</div>

<style>
  .gs { transform-box: fill-box; transform-origin: 50% 100%; }
  .gs.spin { animation: spinTop var(--dur) linear infinite; }
  @keyframes spinTop { 0% { transform: scaleX(1) rotate(-3deg); } 50% { transform: scaleX(-1) rotate(3deg); } 100% { transform: scaleX(1) rotate(-3deg); } }
  .pads { position: absolute; z-index: 5; left: 12px; right: 12px; bottom: calc(var(--safe-b) + 20px); display: flex; }
  .pad { flex: 1; min-height: 88px; font-size: 22px; touch-action: none; }
  @media (prefers-reduced-motion: reduce) { .gs.spin { animation: none; } }
</style>
