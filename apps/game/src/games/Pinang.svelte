<script lang="ts">
  // Panjat Pinang (khusus event Agustusan): ketuk berirama untuk memanjat tiang licin.
  // Terlalu cepat = melorot; diam = melorot pelan. Hadiah di tiap seperempat tiang.
  import { onDestroy } from 'svelte';
  import { PINANG, pinangGrease, renderPet } from '@kb/shared';
  import { G, settings, wearItems } from '../lib/game.svelte';
  import { createRun } from '../lib/minigame.svelte';
  import { sfx, buzz } from '../lib/sfx';
  import GameCard from './GameCard.svelte';

  const cfg = $derived(settings().games?.pinang ?? {});
  const left = $derived(G.me.limits?.games?.pinang ?? cfg.playsPerDay ?? 0);
  let taps: number[] = [];
  let t0 = 0, duration = 20000, raf = 0, grease = 1, last = -1e9, prev = 0;
  let h = $state(0), maxH = $state(0), now = $state(0), slip = $state(false);

  const run = createRun('pinang', (r) => {
    duration = r.durationMs ?? cfg.durationMs ?? 20000;
    grease = pinangGrease(r.seed);
    taps = []; h = 0; maxH = 0; last = -1e9; prev = 0;
    t0 = performance.now();
    loop();
  });
  function loop() {
    now = performance.now() - t0;
    if (now >= duration || maxH >= PINANG.top) return end();
    raf = requestAnimationFrame(loop);
  }
  // sampai puncak: pet bertahan di atas sebentar sambil merayakan, baru kartu hasil
  function end() {
    cancelAnimationFrame(raf);
    const top = maxH >= PINANG.top;
    run.finish({ taps }, top ? { banner: 'Sampai puncak!', hold: 1600 } : { banner: 'Waktu habis!', good: false, hold: 1000 });
  }
  // sama persis dengan hitungan server (pinangReplay)
  function climb() {
    if (run.st.phase !== 'play') return;
    const t = Math.round(performance.now() - t0);
    if (t - last < PINANG.minGapMs) return;
    taps.push(t);
    h = Math.max(0, h - (PINANG.slipPerSec * grease * (t - prev)) / 1000);
    if (t - last < PINANG.rhythmMs) { h = Math.max(0, h - PINANG.slipFast * grease); slip = true; sfx.error(); buzz(40); setTimeout(() => (slip = false), 400); }
    else { const before = maxH; h = Math.min(PINANG.top, h + PINANG.climb); sfx.tap(); buzz(6); if (PINANG.prizes.some((p) => before < p && h >= p)) sfx.coin(); }
    prev = t; last = t;
    maxH = Math.max(maxH, h);
  }
  function key(e: KeyboardEvent) { if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); climb(); } }
  onDestroy(() => { cancelAnimationFrame(raf); run.stop(); });

  // tinggi yang tampak: melorot pelan sejak ketukan terakhir
  const shown = $derived(run.st.phase === 'play' ? Math.max(0, h - (PINANG.slipPerSec * grease * Math.max(0, now - prev)) / 1000) : h);
  const TOP = 90, BOT = 500;
  const y = $derived(BOT - (shown / PINANG.top) * (BOT - TOP - 40));
  const pet = $derived(renderPet(G.me.pet, wearItems(G.me.pet.wear).filter((x: any) => x.data?.slot !== 'back' && x.data?.slot !== 'hand')));
  const timeLeft = $derived(Math.max(0, Math.ceil((duration - now) / 1000)));
</script>

<svelte:window onkeydown={key} />
<div class="game-bg pinang">
  <svg viewBox="0 0 400 560" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Panjat Pinang">
    <rect x="-300" y="-100" width="1000" height="800" fill="#BFE3F5" />
    <rect x="-300" y="500" width="1000" height="200" fill="#8CC56E" />
    <path d="M-300 500H700" stroke="#2B2F4A" stroke-width="2.5" />
    <!-- bendera-bendera kecil -->
    <path d="M-10 40Q100 70 200 46T410 40" fill="none" stroke="#2B2F4A" stroke-width="1.5" />
    {#each Array(12) as _, i}<path d="M{i * 36 - 6} {46 + Math.sin(i) * 6}l10 0-5 12z" fill={i % 2 ? '#FFFFFF' : '#E0583F'} stroke="#2B2F4A" stroke-width="1" />{/each}
    <!-- tiang licin -->
    <rect x="186" y={TOP} width="28" height={BOT - TOP} fill="#9C6B45" stroke="#2B2F4A" stroke-width="3" />
    {#each Array(16) as _, i}<path d="M188 {TOP + 20 + i * 26}l24 -10" stroke="#6E4A2E" stroke-width="3" opacity=".5" />{/each}
    <rect x="192" y={TOP} width="5" height={BOT - TOP} fill="#FFFFFF" opacity=".35" />
    <!-- roda hadiah di puncak -->
    <ellipse cx="200" cy={TOP} rx="78" ry="14" fill="none" stroke="#2B2F4A" stroke-width="4" />
    {#each [-60, -30, 30, 60] as dx, i}
      <path d="M{200 + dx} {TOP + 6}v{18 + (i % 2) * 8}" stroke="#2B2F4A" stroke-width="1.6" />
      <rect x={200 + dx - 11} y={TOP + 22 + (i % 2) * 8} width="22" height="18" rx="3" fill={['#E0583F', '#F2B632', '#3F7FBF', '#3FA06A'][i]} stroke="#2B2F4A" stroke-width="2.2" />
    {/each}
    <!-- penanda hadiah tiap seperempat -->
    {#each PINANG.prizes as p, i}
      {@const py = BOT - (p / PINANG.top) * (BOT - TOP - 40)}
      <path d="M214 {py}h26" stroke="#2B2F4A" stroke-width="2" /><rect x="240" y={py - 11} width="54" height="22" rx="11" fill={maxH >= p ? '#8FD3A7' : '#FFFDF7'} stroke="#2B2F4A" stroke-width="2" />
      <text x="267" y={py + 5} text-anchor="middle" font-family="'Baloo 2',sans-serif" font-weight="800" font-size="13" fill="#2B2F4A">{cfg.rewards?.[i] ?? ''} koin</text>
    {/each}
    <g transform="translate(200 {y.toFixed(1)})" class:slip class:cheer={run.st.phase === 'finale' && maxH >= PINANG.top}><g transform="scale(.4)">{@html pet}</g></g>
    {#if slip}<text x="120" y={y - 30} text-anchor="middle" class="flash bad">Licin!</text>{/if}
  </svg>
  {#if run.st.phase === 'play' || run.st.phase === 'count' || run.st.phase === 'finale'}
    <div class="top"><span>{Math.round(shown)}% tiang</span><span>{timeLeft} d</span></div>
    {#if run.st.phase === 'play'}
      <div class="pads"><button class="btn hot pad" onpointerdown={(e) => { e.preventDefault(); climb(); }}>Panjat!</button></div>
    {/if}
  {/if}
  <GameCard {run} title="Panjat Pinang" {left} info="{cfg.energiCost} energi · hadiah {(cfg.rewards ?? []).join(' / ')} koin">
    {#snippet intro()}<p>Ketuk <b>Panjat!</b> dengan irama tenang. Terlalu cepat malah melorot, diam juga melorot pelan. Ada hadiah di tiap seperempat tiang. Sampai puncak dalam {Math.round((cfg.durationMs ?? 20000) / 1000)} detik!</p>{/snippet}
    {#snippet result()}<p>Tertinggi {run.st.result.height}% tiang{run.st.result.tiers >= 4 ? ' — sampai puncak!' : ''}</p>{/snippet}
  </GameCard>
</div>

<style>
  .slip { animation: slipShake .12s ease-in-out infinite alternate; }
  .cheer { animation: cheer .35s ease-in-out infinite alternate; }
  @keyframes cheer { from { translate: 0 0; } to { translate: 0 -10px; } }
  @media (prefers-reduced-motion: reduce) { .cheer { animation: none; } }
  @keyframes slipShake { from { translate: -3px 0; } to { translate: 3px 0; } }
  .pads { position: absolute; z-index: 5; left: 50%; transform: translateX(-50%); width: min(720px, calc(100vw - 24px)); bottom: calc(var(--safe-b) + 20px); display: flex; }
  .pad { flex: 1; min-height: 96px; font-size: 24px; touch-action: none; }
</style>
