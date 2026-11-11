<script lang="ts">
  import { onDestroy } from 'svelte';
  import { renderPet, KARUNG_HOPS } from '@kb/shared';
  import { G, merge, fail, toast, wearItems, settings, item } from '../lib/game.svelte';
  import { api } from '../lib/api';
  import { sfx, buzz } from '../lib/sfx';
  import { I, COIN } from '../lib/icons';

  type Phase = 'intro' | 'count' | 'race' | 'finale' | 'done';
  let phase = $state<Phase>('intro');
  let count = $state(3);
  let rivals = $state<any[]>([]);
  let raceId = '';
  let hops = $state(0);
  let taps = 0;
  let last: 'L' | 'R' | null = null;
  let stunUntil = 0;
  let t0 = 0;
  let elapsed = $state(0);
  let result = $state<any>(null);
  let raf = 0;
  let busy = $state(false);
  const cfg = $derived(settings().karung ?? {});
  // LINE = garis finis yang digambar. Pet tepat di garis pada lompatan terakhir, lalu melompat melewatinya (END).
  const START = 40, LINE = 340, END = 370;
  const laneY = (i: number) => 150 + i * 92;
  const trackX = (p: number) => (p >= 1 ? END : START + p * (LINE - START));
  let playerX = $state(START);
  const rivalX = (r: any) => trackX(elapsed / r.timeMs);

  function sackPet(look: any, wear: any[], x: number, y: number, hopping: boolean, scale = 0.42) {
    const lift = hopping ? -10 : 0;
    return `<g transform="translate(${x.toFixed(1)} ${(y + lift).toFixed(1)}) scale(${scale})">${renderPet(look, wear)}<path d="M-50 -40Q-52 4 -40 6H40Q52 4 50 -40Q0 -30 -50 -40Z" fill="#C8955A" stroke="#2B2F4A" stroke-width="4" stroke-linejoin="round"/><path d="M-50 -40Q0 -30 50 -40" fill="none" stroke="#8A5A36" stroke-width="5"/><path d="M-30 -18l8 6M10 -22l8 6" stroke="#8A5A36" stroke-width="3"/></g>`;
  }

  const scene = $derived.by(() => {
    let s = `<rect x="-200" y="-200" width="800" height="1000" fill="#8CC56E"/>`;
    for (let i = 0; i < 4; i++) {
      const y = laneY(i);
      s += `<rect x="16" y="${y - 70}" width="368" height="84" rx="10" fill="${i % 2 ? '#9CD07E' : '#93CB74'}"/>`;
      s += `<path d="M24 ${y + 14}H376" stroke="#FFFDF7" stroke-width="3" stroke-dasharray="8 8"/>`;
    }
    s += `<rect x="${LINE - 5}" y="70" width="10" height="${4 * 92}" fill="#FFFDF7" stroke="#2B2F4A" stroke-width="2"/>`;
    for (let k = 0; k < 18; k++) s += `<rect x="${LINE - 5}" y="${70 + k * 20.4}" width="10" height="10.2" fill="#2B2F4A"/>`;
    let fl = '';
    for (let i = 0; i < 12; i++) fl += `<path d="M${20 + i * 32} 40l14 0-7 14z" fill="${i % 2 ? '#FFFFFF' : '#E0583F'}" stroke="#2B2F4A" stroke-width="1.2"/>`;
    s += `<path d="M10 40H390" stroke="#2B2F4A" stroke-width="1.5"/>${fl}`;
    const t = elapsed;
    rivals.forEach((r, i) => {
      const x = rivalX(r);
      const hopping = (phase === 'race' || phase === 'finale') && x < END - 1 && Math.floor(t / 180 + i) % 2 === 0;
      s += sackPet(r, [], x, laneY(i), hopping);
      s += `<text x="${Math.min(x, 352).toFixed(1)}" y="${laneY(i) - 52}" text-anchor="middle" class="nm">${r.name}</text>`;
    });
    const me = G.me.pet;
    const meHop = phase === 'finale' && playerX < END - 1 ? Math.floor(t / 150) % 2 === 0 : hopAnim;
    s += sackPet(me, wearItems(me.wear).filter((w) => w.data?.slot !== 'back'), playerX, laneY(3), meHop);
    s += `<text x="${Math.min(playerX, 352).toFixed(1)}" y="${laneY(3) - 52}" text-anchor="middle" class="nm me">${me.name}</text>`;
    return s;
  });
  let hopAnim = $state(false);

  async function start() {
    busy = true;
    try {
      const r = await api.post('/api/karung/start');
      merge(r);
      rivals = r.rivals.slice(0, 3);
      raceId = r.raceId;
      hops = 0; taps = 0; last = null; elapsed = 0; result = null; playerX = START; banner = '';
      phase = 'count';
      G.immersive = true;
      count = 3;
      sfx.tap();
      const tick = setInterval(() => {
        count--;
        if (count > 0) sfx.tap();
        else { clearInterval(tick); phase = 'race'; sfx.level(); t0 = performance.now(); loop(); }
      }, 1000);
    } catch (e) { fail(e); } finally { busy = false; }
  }

  // batas waktu: semua lawan sudah finis + 8 detik. Tanpa ini pemain yang berhenti mengetuk terjebak di layar penuh.
  const limitMs = () => Math.max(0, ...rivals.map((r) => r.timeMs)) + 8000;
  function timeUp() {
    phase = 'finale';
    banner = 'Waktu habis!';
    sfx.pop();
    setTimeout(() => {
      phase = 'done'; cancelAnimationFrame(raf);
      result = { timeout: true, rank: rivals.length + 1, reward: 0, timeMs: elapsed };
      G.immersive = false;
    }, 1100);
  }
  function loop() {
    elapsed = performance.now() - t0;
    if (phase === 'race' && elapsed > limitMs()) timeUp();
    playerX += (trackX(Math.min(hops, KARUNG_HOPS) / KARUNG_HOPS) - playerX) * (hops >= KARUNG_HOPS ? 0.12 : 0.35);
    if (phase === 'race' || phase === 'finale') raf = requestAnimationFrame(loop);
  }
  let banner = $state('');

  function press(side: 'L' | 'R') {
    if (phase !== 'race') return;
    const now = performance.now();
    taps++;
    if (now < stunUntil) return;
    if (side === last) { stunUntil = now + 350; buzz(40); sfx.error(); return; }
    last = side;
    hops++;
    hopAnim = true; setTimeout(() => (hopAnim = false), 120);
    sfx.hop(); buzz(8);
    if (hops >= KARUNG_HOPS) finish(now - t0);
  }

  async function finish(timeMs: number) {
    // pet melompati garis finis & lawan masih berlomba sebentar; hasil dikirim bersamaan
    phase = 'finale';
    banner = 'Finis!';
    sfx.level();
    busy = true;
    const held = new Promise((ok) => setTimeout(ok, 1500));
    try {
      const r = await api.post('/api/karung/finish', { raceId, timeMs: Math.round(timeMs), taps });
      await held;
      phase = 'done'; cancelAnimationFrame(raf);
      merge(r);
      result = { ...r, timeMs };
      if (r.reward) sfx.coin();
      if (r.levelUp) { sfx.level(); toast(`Naik ke Lv ${r.levelUp}!`, 'good'); }
    } catch (e: any) {
      await held;
      phase = 'done'; cancelAnimationFrame(raf);
      if (e?.code === 'invalid_run') { sfx.error(); result = { invalid: true, timeMs }; }
      else { fail(e); result = { rank: 0, reward: 0, timeMs, error: true }; }
    } finally { busy = false; G.immersive = false; }
  }

  function key(e: KeyboardEvent) {
    if (e.repeat) return;
    if (['ArrowLeft', 'a', 'A'].includes(e.key)) press('L');
    if (['ArrowRight', 'd', 'D'].includes(e.key)) press('R');
  }
  onDestroy(() => { cancelAnimationFrame(raf); G.immersive = false; });
  const left = $derived(G.me.limits?.karungLeft ?? cfg.playsPerDay);
  void item;
</script>

<svelte:window onkeydown={key} />
<div class="karung">
  <svg viewBox="0 0 400 460" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Lomba karung">{@html scene}</svg>

  {#if phase === 'intro'}
    <div class="card">
      <h2>Lomba Karung</h2>
      <p>Ketuk <b>KIRI</b> dan <b>KANAN</b> bergantian secepatnya. Ketuk sisi yang sama dua kali, kamu tersandung.</p>
      <ul>
        <li>Jatah hari ini: <b>{left}</b> kali</li>
        <li>Butuh <b>{cfg.energiCost}</b> energi</li>
        <li>Hadiah juara 1–4: {(cfg.rewards ?? []).join(' · ')} koin</li>
      </ul>
      <div class="row">
        <button class="btn" onclick={() => (G.view = 'map')}>{@html I.back} Kampung</button>
        <button class="btn hot" disabled={busy || left <= 0} onclick={start}>Mulai lomba</button>
      </div>
    </div>
  {:else if phase === 'count'}
    <div class="count">{count}</div>
  {:else if phase === 'finale'}
    <div class="banner" role="status">{banner}</div>
  {:else if phase === 'done'}
    <div class="card">
      {#if result?.timeout}
        <h2>Belum sampai finis</h2>
        <p>Semua lawan sudah finis. Ketuk <b>KIRI</b> dan <b>KANAN</b> bergantian lebih cepat, ya!</p>
      {:else if result?.invalid}
        <h2>Hasil tidak sah</h2>
        <p>Ketukanmu terlalu cepat untuk dihitung ({(result.timeMs / 1000).toFixed(2)} detik). Coba lagi dengan ritme kiri-kanan yang wajar.</p>
      {:else if result?.error}
        <h2>Lomba selesai</h2>
        <p>Hasil belum tersimpan karena koneksi bermasalah.</p>
      {:else if result}
        <h2>{result.rank === 1 ? 'Juara 1!' : result.rank ? `Juara ${result.rank}` : 'Lomba selesai'}</h2>
        <p>Waktumu <b>{(result.timeMs / 1000).toFixed(2)} detik</b></p>
        <ol class="board">
          {#each [...rivals.map((r) => ({ name: r.name, t: r.timeMs })), { name: G.me.pet.name + ' (kamu)', t: result.timeMs, me: true }].sort((a, b) => a.t - b.t) as r}
            <li class:me={r.me}>{r.name} <span>{(r.t / 1000).toFixed(2)} d</span></li>
          {/each}
        </ol>
        {#if result.reward}<p class="reward">{@html COIN} +{result.reward} koin</p>{/if}
      {:else}
        <p>Menghitung hasil…</p>
      {/if}
      <div class="row">
        <button class="btn" onclick={() => (G.view = 'map')}>{@html I.back} Kampung</button>
        <button class="btn hot" disabled={busy || left <= 0} onclick={start}>Main lagi ({left})</button>
      </div>
    </div>
  {/if}

  {#if phase === 'race' || phase === 'count'}
    <div class="pads">
      <button class="pad" onpointerdown={(e) => { e.preventDefault(); press('L'); }}>KIRI</button>
      <div class="meter"><i style="height:{(Math.min(hops, KARUNG_HOPS) / KARUNG_HOPS) * 100}%"></i></div>
      <button class="pad" onpointerdown={(e) => { e.preventDefault(); press('R'); }}>KANAN</button>
    </div>
  {/if}
</div>

<style>
  .karung { position: absolute; inset: 0; background: #8CC56E; }
  svg { position: absolute; left: 0; right: 0; top: calc(var(--safe-t) + 70px); width: 100%; height: calc(100% - var(--safe-t) - var(--safe-b) - 250px); }
  svg :global(.nm) { font: 800 15px var(--font); fill: var(--ink); paint-order: stroke; stroke: #FFFDF7; stroke-width: 4px; }
  svg :global(.nm.me) { fill: #1E5FA0; }
  .card { position: absolute; z-index: 8; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-b) + 86px); width: min(420px, calc(100vw - 20px)); background: var(--paper); border: 3px solid var(--ink); border-radius: 20px; box-shadow: 0 5px 0 var(--ink); padding: 16px; display: flex; flex-direction: column; gap: 8px; animation: pop .3s; }
  h2 { margin: 0; font-size: 24px; font-weight: 800; }
  p { margin: 0; font-weight: 600; }
  ul { margin: 0; padding-left: 20px; font-weight: 600; font-size: 14.5px; }
  .row { display: flex; gap: 8px; justify-content: space-between; margin-top: 6px; }
  .row .btn { flex: 1 1 auto; }
  .count { position: absolute; z-index: 8; left: 50%; top: 40%; transform: translate(-50%, -50%); font-size: 120px; font-weight: 800; color: var(--paper); -webkit-text-stroke: 5px var(--ink); animation: pop .5s; }
  .banner { position: absolute; z-index: 8; left: 50%; top: 34%; transform: translate(-50%, -50%); white-space: nowrap; font-size: clamp(44px, 13vw, 76px); font-weight: 800; color: #FFE27A; -webkit-text-stroke: 4px var(--ink); paint-order: stroke fill; text-shadow: 0 5px 0 var(--ink); pointer-events: none; animation: pop .45s; }
  .pads { position: absolute; z-index: 8; left: 0; right: 0; bottom: calc(var(--safe-b) + 12px); display: flex; gap: 10px; padding: 0 max(12px, var(--safe-r)) 0 max(12px, var(--safe-l)); align-items: stretch; }
  .pad { flex: 1; height: 150px; border: 3px solid var(--ink); border-radius: 24px; background: var(--coin); box-shadow: 0 6px 0 var(--ink); font-size: 28px; font-weight: 800; touch-action: none; cursor: pointer; }
  .pad:active { transform: translateY(4px); box-shadow: 0 2px 0 var(--ink); background: #FFD36B; }
  .meter { width: 18px; border: 2.5px solid var(--ink); border-radius: 10px; background: var(--track); display: flex; align-items: flex-end; overflow: hidden; }
  .meter i { display: block; width: 100%; background: var(--ok); }
  .board { margin: 4px 0; padding-left: 22px; font-weight: 700; }
  .board li { display: flex; justify-content: space-between; } .board span { color: var(--muted); font-variant-numeric: tabular-nums; }
  .board li.me { color: #1E5FA0; }
  .reward { display: flex; align-items: center; gap: 6px; font-size: 20px; font-weight: 800; }
  .reward :global(svg) { width: 26px; height: 26px; }
</style>
