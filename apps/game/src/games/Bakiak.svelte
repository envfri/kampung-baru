<script lang="ts">
  // Balap Bakiak: tim tiga pet di satu bakiak panjang. Ketuk kaki sesuai aba-aba; salah = tersandung.
  import { onDestroy } from 'svelte';
  import { bakiakPrompts, BAKIAK, renderPet, KARUNG_RIVALS, type Foot } from '@kb/shared';
  import { G, settings, wearItems } from '../lib/game.svelte';
  import { createRun } from '../lib/minigame.svelte';
  import { sfx, buzz } from '../lib/sfx';
  import GameCard from './GameCard.svelte';

  const cfg = $derived(settings().games?.bakiak ?? {});
  const left = $derived(G.me.limits?.games?.bakiak ?? cfg.playsPerDay ?? 0);
  let prompts = $state<Foot[]>([]);
  let taps: [number, Foot][] = [];
  let t0 = 0, duration = 20000, lockUntil = 0, last = -1e9, raf = 0;
  let steps = $state(0), stumbles = $state(0), now = $state(0), shake = $state(false);

  const run = createRun('bakiak', (r) => {
    prompts = bakiakPrompts(r.seed);
    duration = r.durationMs ?? cfg.durationMs ?? 20000;
    taps = []; steps = 0; stumbles = 0; lockUntil = 0; last = -1e9;
    t0 = performance.now();
    loop();
  });
  function loop() {
    now = performance.now() - t0;
    if (now >= duration || steps >= BAKIAK.finish) return end();
    raf = requestAnimationFrame(loop);
  }
  function end() { cancelAnimationFrame(raf); run.finish({ taps }); }

  function tap(f: Foot) {
    if (run.st.phase !== 'play') return;
    const t = Math.round(performance.now() - t0);
    if (t - last < BAKIAK.minGapMs) return; // terlalu rapat: diabaikan (server juga menolak)
    last = t;
    taps.push([t, f]);
    if (t < lockUntil) return;
    if (f === prompts[steps]) { steps++; sfx.tap(); buzz(8); }
    else { stumbles++; lockUntil = t + BAKIAK.stumbleMs; sfx.error(); buzz(60); shake = true; setTimeout(() => (shake = false), BAKIAK.stumbleMs); }
  }
  function key(e: KeyboardEvent) {
    if (['ArrowLeft', 'a', 'A'].includes(e.key)) { e.preventDefault(); tap('L'); }
    if (['ArrowRight', 'd', 'D'].includes(e.key)) { e.preventDefault(); tap('R'); }
  }
  onDestroy(() => { cancelAnimationFrame(raf); run.stop(); });

  const team = $derived([renderPet(G.me.pet, wearItems(G.me.pet.wear).filter((w) => w.data?.slot !== 'back')), renderPet(KARUNG_RIVALS[0] as any), renderPet(KARUNG_RIVALS[1] as any)]);
  const x = $derived(50 + Math.min(1, steps / BAKIAK.finish) * 270);
  const timeLeft = $derived(Math.max(0, Math.ceil((duration - now) / 1000)));
  const label = (f?: Foot) => (f === 'L' ? 'KIRI' : f === 'R' ? 'KANAN' : '');
</script>

<svelte:window onkeydown={key} />
<div class="game-bg bakiak">
  <svg viewBox="0 0 400 560" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Balap Bakiak">
    <rect x="-300" y="-100" width="1000" height="800" fill="#BFE3F5" />
    <rect x="-300" y="330" width="1000" height="400" fill="#8CC56E" />
    <path d="M-300 330H700" stroke="#2B2F4A" stroke-width="2.5" />
    <rect x="-300" y="380" width="1000" height="60" fill="#E9D9AE" stroke="#2B2F4A" stroke-width="2.5" />
    {#each Array(9) as _, i}<path d="M{20 + i * 45} 410h22" stroke="#C9B582" stroke-width="3" />{/each}
    <!-- garis finis -->
    <path d="M352 300V440" stroke="#2B2F4A" stroke-width="4" />
    <path d="M354 300h34v12h-34zM354 312h34v12h-34z" fill="#E0583F" stroke="#2B2F4A" stroke-width="2" /><path d="M354 312h34" stroke="#FFFFFF" stroke-width="12" opacity=".9" />
    <g transform="translate({x.toFixed(1)} 404)" class:shake>
      <g transform="rotate({steps % 2 ? 3 : -3})">
        {#each team as t, i}<g transform="translate({(i - 1) * 34} -6) scale(.36)">{@html t}</g>{/each}
        <rect x="-70" y="-6" width="140" height="10" rx="4" fill="#B98B4E" stroke="#2B2F4A" stroke-width="2.5" />
      </g>
    </g>
  </svg>

  {#if run.st.phase === 'play' || run.st.phase === 'count'}
    <div class="top"><span>{steps}/{BAKIAK.finish} langkah</span><span>{timeLeft} d</span></div>
    {#if run.st.phase === 'play'}
      <div class="prompt" class:bad={shake}>{shake ? 'Tersandung!' : label(prompts[steps])}<small>lalu {label(prompts[steps + 1])}</small></div>
      <div class="pads">
        <button class="btn pad" onpointerdown={(e) => { e.preventDefault(); tap('L'); }}>← Kiri</button>
        <button class="btn pad" onpointerdown={(e) => { e.preventDefault(); tap('R'); }}>Kanan →</button>
      </div>
    {/if}
  {/if}
  <GameCard {run} title="Balap Bakiak" {left} info="{cfg.energiCost} energi · {cfg.coinPerStep} koin per langkah (maks {cfg.maxCoins})">
    {#snippet intro()}<p>Ketuk <b>Kiri</b> atau <b>Kanan</b> sesuai aba-aba di atas. Salah langkah, timmu tersandung sebentar. Sampai garis finis dalam {Math.round((cfg.durationMs ?? 20000) / 1000)} detik!</p>{/snippet}
    {#snippet result()}<p>{run.st.result.finished ? 'Sampai finis!' : `${run.st.result.steps} langkah`} · tersandung {run.st.result.stumbles}×</p>{/snippet}
  </GameCard>
</div>

<style>
  .shake { animation: wobble .18s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: 50% 100%; }
  @keyframes wobble { from { rotate: -9deg; } to { rotate: 9deg; } }
  .prompt { position: absolute; z-index: 5; left: 50%; top: calc(var(--safe-t) + 64px); transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; background: var(--paper); border: 3px solid var(--ink); border-radius: 18px; box-shadow: 0 4px 0 var(--ink); padding: 6px 22px; font-size: 34px; font-weight: 800; }
  .prompt small { font-size: 13px; color: var(--muted); }
  .prompt.bad { background: #F8C9BE; }
  .pads { position: absolute; z-index: 5; left: 12px; right: 12px; bottom: calc(var(--safe-b) + 20px); display: flex; gap: 12px; }
  .pad { flex: 1; min-height: 96px; font-size: 22px; touch-action: none; }
</style>
