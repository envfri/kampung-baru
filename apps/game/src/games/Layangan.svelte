<script lang="ts">
  // Tangkap Layangan: layangan putus melayang turun. Ketuk sebelum jatuh; yang sobek jangan diambil.
  import { onDestroy } from 'svelte';
  import { layanganSchedule, kitePos, LAYANGAN_FALL_MS, type Kite } from '@kb/shared';
  import { G, settings } from '../lib/game.svelte';
  import { createRun } from '../lib/minigame.svelte';
  import { sfx, buzz } from '../lib/sfx';
  import GameCard from './GameCard.svelte';
  import VsBar from './VsBar.svelte';

  const cfg = $derived(settings().games?.layangan ?? {});
  const left = $derived(G.me.limits?.games?.layangan ?? cfg.playsPerDay ?? 0);
  let sched: Kite[] = [];
  let caught: [number, number][] = [];
  let taken = $state<Set<number>>(new Set());
  let t0 = 0, duration = 25000, raf = 0;
  let now = $state(0), score = $state(0);
  let flash = $state<{ x: number; y: number; text: string; good: boolean; n: number } | null>(null);
  const COLORS = ['#E0583F', '#3F7FBF', '#F2B632', '#3FA06A', '#9A6FC0'];
  const W = 400, H = 560;

  const run = createRun('layangan', (r) => {
    duration = r.durationMs ?? cfg.durationMs ?? 25000;
    sched = layanganSchedule(r.seed, duration);
    caught = []; taken = new Set(); score = 0;
    t0 = performance.now();
    loop();
  });
  function loop() {
    now = performance.now() - t0;
    if (now >= duration) { cancelAnimationFrame(raf); run.finish({ caught }, { banner: 'Waktu habis!', good: false, hold: 1000 }); return; }
    raf = requestAnimationFrame(loop);
  }
  const visible = $derived(run.st.phase === 'play' ? sched.map((k, i) => ({ k, i })).filter(({ k, i }) => !taken.has(i) && now >= k.t && now <= k.t + LAYANGAN_FALL_MS) : []);
  function grab(i: number) {
    if (run.st.phase !== 'play' || taken.has(i)) return;
    const k = sched[i];
    const t = Math.round(performance.now() - t0);
    if (t < k.t || t > k.t + LAYANGAN_FALL_MS) return;
    caught.push([i, t]);
    taken = new Set([...taken, i]);
    score = Math.max(0, score + k.value);
    const p = kitePos(k, t);
    flash = { x: 30 + p.x * (W - 60), y: 40 + p.y * 440, text: k.value > 0 ? `+${k.value}` : `${k.value}`, good: k.value > 0, n: (flash?.n ?? 0) + 1 };
    if (k.value > 0) { k.kind === 'emas' ? sfx.coin() : sfx.pop(); buzz(10); } else { sfx.error(); buzz(50); }
  }
  onDestroy(() => { cancelAnimationFrame(raf); run.stop(); });
  const timeLeft = $derived(Math.max(0, Math.ceil((duration - now) / 1000)));
  const kiteArt = (k: Kite) => {
    const c = k.kind === 'emas' ? '#F2B632' : k.kind === 'sobek' ? '#B8B2A6' : COLORS[k.color % COLORS.length];
    const torn = k.kind === 'sobek';
    return `<path d="M0 -26L20 0L0 30L-20 0Z" fill="${c}" stroke="#2B2F4A" stroke-width="2.6" stroke-linejoin="round"/>` +
      (torn ? `<path d="M6 -18L20 0L10 4L14 -6Z" fill="#BFE3F5" stroke="#2B2F4A" stroke-width="1.8" stroke-linejoin="round"/><path d="M-8 6l6 6" stroke="#2B2F4A" stroke-width="2"/>`
        : `<path d="M0 -26V30M-20 0H20" stroke="#2B2F4A" stroke-width="1.6" opacity=".6"/>`) +
      (k.kind === 'emas' ? `<path d="M-6 -6l12 12M6 -6l-12 12" stroke="#FFFDF7" stroke-width="2.4" stroke-linecap="round"/>` : '') +
      `<path d="M0 30q-8 10 0 18t0 18" fill="none" stroke="#2B2F4A" stroke-width="1.8"/><path d="M-4 42l8 2M-4 54l8 2" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`;
  };
</script>

<div class="game-bg layangan">
  <svg viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Tangkap Layangan">
    <rect x="-300" y="-100" width="1000" height="800" fill="#BFE3F5" />
    <ellipse cx="80" cy="90" rx="46" ry="16" fill="#FFFFFF" opacity=".9" /><ellipse cx="300" cy="150" rx="56" ry="18" fill="#FFFFFF" opacity=".85" />
    <rect x="-300" y="500" width="1000" height="200" fill="#8CC56E" />
    <path d="M-300 500H700" stroke="#2B2F4A" stroke-width="2.5" />
    {#each visible as { k, i } (i)}
      {@const p = kitePos(k, now)}
      <g class="kite" transform="translate({(30 + p.x * (W - 60)).toFixed(1)} {(40 + p.y * 440).toFixed(1)}) rotate({(Math.sin((now - k.t) / 420) * 14).toFixed(1)})" onpointerdown={(e) => { e.preventDefault(); grab(i); }} role="button" tabindex="-1" aria-label="Layangan {k.kind}">
        <circle r="36" fill="#FFFFFF" opacity="0" />{@html kiteArt(k)}
      </g>
    {/each}
    {#if flash}{#key flash.n}<text x={flash.x} y={flash.y - 30} text-anchor="middle" class="flash" class:bad={!flash.good}>{flash.text}</text>{/key}{/if}
  </svg>
  {#if run.st.phase === 'play' || run.st.phase === 'count' || run.st.phase === 'finale'}
    <div class="top"><span>{score} poin</span><span>{timeLeft} d</span></div>
  {/if}
  <VsBar {run} mine={score} fmt={(v) => `${v} poin`} />
  <GameCard {run} title="Tangkap Layangan" {left} info="{cfg.energiCost} energi · {cfg.coinPerPoint} koin per poin (maks {cfg.maxCoins})">
    {#snippet intro()}<p>Ketuk layangan putus sebelum jatuh ke tanah. Layangan emas +3, layangan biasa +1. Layangan <b>sobek</b> (abu-abu) jangan diambil: −1!</p>{/snippet}
  </GameCard>
</div>

<style>
  .kite { cursor: pointer; }
</style>
