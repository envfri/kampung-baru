<script lang="ts">
  // Balap Karung Live: lawan pemain sungguhan di alun-alun yang sama. Cara main sama dengan Lomba Karung
  // (ketuk KIRI & KANAN bergantian); kemajuan dikirim berkala, waktu finis divalidasi server.
  import { onDestroy } from 'svelte';
  import { renderPet, KARUNG_HOPS } from '@kb/shared';
  import { wearItems } from '../../lib/game.svelte';
  import { raceGame, serverNow, BG } from '../../lib/bareng.svelte';
  import { sfx, buzz } from '../../lib/sfx';
  let { g, me }: { g: any; me: string } = $props();

  const START = 40, LINE = 340, END = 370;
  const racers = $derived(g.players.filter((p: any) => g.race && p.id in g.race.prog));
  const out = $derived(!!g.race?.out?.includes(me) || (g.race && !(me in g.race.prog)));
  const laneY = (i: number) => 150 + i * 88;
  const trackX = (p: number) => (p >= 1 ? END : START + p * (LINE - START));
  let hops = $state(0);
  let taps = 0, last: 'L' | 'R' | null = null, stunUntil = 0, t0 = 0, finished = false;
  let now = $state(serverNow());
  let raf = 0;
  const shown: Record<string, number> = {};
  function loop() { now = serverNow(); raf = requestAnimationFrame(loop); }
  raf = requestAnimationFrame(loop);
  const count = $derived(g.race ? Math.ceil((g.race.startAt - now) / 1000) : 3);
  const racing = $derived(g.phase === 'main' && g.race && now >= g.race.startAt && !finished && !out);
  // mulai menghitung waktu sendiri tepat saat lomba mulai
  $effect(() => { if (racing && !t0) { t0 = performance.now(); sfx.level(); } });
  // kemajuan dikirim 4× per detik
  const iv = setInterval(() => { if (racing && hops > 0) raceGame(g.id, { hops }); }, 250);
  onDestroy(() => { clearInterval(iv); cancelAnimationFrame(raf); });

  function press(side: 'L' | 'R') {
    if (!racing) return;
    const t = performance.now();
    taps++;
    if (t < stunUntil) return;
    if (side === last) { stunUntil = t + 350; buzz(40); sfx.error(); return; }
    last = side;
    hops++;
    sfx.hop(); buzz(8);
    if (hops >= KARUNG_HOPS) { finished = true; raceGame(g.id, { hops: KARUNG_HOPS, taps, timeMs: Math.round(t - t0) }); sfx.level(); }
  }
  function onKey(e: KeyboardEvent) {
    if (['ArrowLeft', 'a', 'A'].includes(e.key)) press('L');
    if (['ArrowRight', 'd', 'D'].includes(e.key)) press('R');
  }
  function sackPet(look: any, wear: any[], x: number, y: number, hop: boolean) {
    return `<g transform="translate(${x.toFixed(1)} ${(y + (hop ? -10 : 0)).toFixed(1)}) scale(.42)">${renderPet(look, wear)}<path d="M-50 -40Q-52 4 -40 6H40Q52 4 50 -40Q0 -30 -50 -40Z" fill="#C8955A" stroke="#2B2F4A" stroke-width="4" stroke-linejoin="round"/><path d="M-50 -40Q0 -30 50 -40" fill="none" stroke="#8A5A36" stroke-width="5"/></g>`;
  }
  const scene = $derived.by(() => {
    const n = racers.length;
    let s = `<rect x="-200" y="-200" width="800" height="1400" fill="#8CC56E"/>`;
    for (let i = 0; i < n; i++) { const y = laneY(i); s += `<rect x="16" y="${y - 70}" width="368" height="80" rx="10" fill="${racers[i].id === me ? '#B4E39A' : i % 2 ? '#9CD07E' : '#93CB74'}"/><path d="M24 ${y + 12}H376" stroke="#FFFDF7" stroke-width="3" stroke-dasharray="8 8"/>`; }
    s += `<rect x="${LINE - 5}" y="72" width="10" height="${n * 88}" fill="#FFFDF7" stroke="#2B2F4A" stroke-width="2"/>`;
    for (let k = 0; k < n * 88 / 10; k++) s += `<rect x="${LINE - 5}" y="${72 + k * 10}" width="10" height="5" fill="#2B2F4A"/>`;
    let fl = '';
    for (let i = 0; i < 12; i++) fl += `<path d="M${20 + i * 32} 40l14 0-7 14z" fill="${i % 2 ? '#FFFFFF' : '#E0583F'}" stroke="#2B2F4A" stroke-width="1.2"/>`;
    s += `<path d="M10 40H390" stroke="#2B2F4A" stroke-width="1.5"/>${fl}`;
    racers.forEach((p: any, i: number) => {
      const doneT = g.race.done?.[p.id];
      const target = p.id === me ? trackX(Math.min(hops, KARUNG_HOPS) / KARUNG_HOPS) : typeof doneT === 'number' ? END : trackX(Math.min(g.race.prog[p.id] ?? 0, KARUNG_HOPS) / KARUNG_HOPS);
      shown[p.id] = (shown[p.id] ?? START) + (target - (shown[p.id] ?? START)) * 0.25;
      const x = shown[p.id];
      const hop = now > g.race.startAt && x < END - 1 && Math.floor(now / 170 + i) % 2 === 0;
      s += sackPet(p.pet ?? { color: '#F2EEE3', ear: 'tunas' }, wearItems(p.pet?.wear ?? []).filter((x: any) => !['back', 'hand', 'body'].includes(x.data?.slot)), x, laneY(i), hop);
      s += `<text x="${Math.min(Math.max(x, 40), 340).toFixed(1)}" y="${laneY(i) - 52}" text-anchor="middle" class="nm${p.id === me ? ' me' : ''}">${p.name}${p.id === me ? ' (kamu)' : ''}</text>`;
    });
    return s;
  });
  const place = $derived.by(() => {
    if (!g.race) return 0;
    const pos = (id: string) => (typeof g.race.done?.[id] === 'number' ? 1e6 - g.race.done[id] : id === me ? hops : g.race.prog[id] ?? 0);
    return 1 + racers.filter((p: any) => p.id !== me && pos(p.id) > pos(me)).length;
  });
  const elapsed = $derived(g.race ? Math.max(0, (now - g.race.startAt) / 1000) : 0);
</script>

<svelte:window onkeydown={onKey} />
<div class="race" role="dialog" aria-label="Balap Karung Live">
  <div class="top"><span>{out ? 'Kamu tidak ikut lomba ini' : `Kamu ke-${place}`}</span><span class="live">LIVE</span><span>{elapsed.toFixed(1).replace('.', ',')} d</span></div>
  <svg viewBox="0 0 400 {racers.length * 88 + 90}" class="scene" preserveAspectRatio="xMidYMid meet">{@html scene}</svg>
  {#if g.phase === 'main' && count > 0}<div class="count">{count}</div>{/if}
  {#if out}
    <p class="msg">Kamu tidak ikut lomba ini (energi kurang atau jatah lomba karung habis).</p>
    <button class="btn" onclick={() => (BG.closed = [...BG.closed, g.id])}>Tutup</button>
  {:else if finished && g.phase === 'main'}
    <p class="msg">Finis! Menunggu yang lain…</p>
  {:else if g.phase === 'main'}
    <div class="pads">
      <button class="pad" onpointerdown={(e) => { e.preventDefault(); press('L'); }}>KIRI</button>
      <button class="pad" onpointerdown={(e) => { e.preventDefault(); press('R'); }}>KANAN</button>
    </div>
  {/if}
</div>

<style>
  .race { position: fixed; z-index: 61; inset: 0; display: flex; flex-direction: column; background: #8CC56E; padding: calc(var(--safe-t) + 8px) max(10px, var(--safe-r)) calc(var(--safe-b) + 12px) max(10px, var(--safe-l)); gap: 8px; }
  .top { display: flex; justify-content: space-between; align-items: center; background: var(--paper); border: 2.5px solid var(--ink); border-radius: 14px; padding: 4px 12px; font-weight: 800; }
  .live { background: #E0583F; color: #fff; border-radius: 999px; padding: 0 8px; font-size: 12px; }
  .scene { flex: 1; min-height: 0; width: 100%; }
  .scene :global(.nm) { font: 800 13px var(--font); fill: var(--ink); paint-order: stroke; stroke: #FFFDF7; stroke-width: 3px; }
  .scene :global(.nm.me) { fill: #1E5FA0; }
  .count { position: absolute; left: 50%; top: 40%; transform: translate(-50%, -50%); font-size: 96px; font-weight: 800; color: var(--paper); text-shadow: 0 5px 0 var(--ink); }
  .msg { margin: 0; text-align: center; font-weight: 800; background: var(--paper); border: 2.5px solid var(--ink); border-radius: 14px; padding: 8px; }
  .pads { display: flex; gap: 10px; }
  .pad { flex: 1; height: 130px; border: 3px solid var(--ink); border-radius: 24px; background: var(--coin); box-shadow: 0 6px 0 var(--ink); font: 800 28px var(--font); color: var(--ink); touch-action: none; cursor: pointer; }
  .pad:active { transform: translateY(4px); box-shadow: 0 2px 0 var(--ink); background: #FFD36B; }
</style>
