<script lang="ts">
  import { onDestroy } from 'svelte';
  import { renderPet, itemIcon } from '@kb/shared';
  import { G, merge, fail, item, wearItems, settings } from '../lib/game.svelte';
  import { api } from '../lib/api';
  import { sfx } from '../lib/sfx';
  import { I } from '../lib/icons';

  type Phase = 'idle' | 'wait' | 'bite' | 'result';
  let phase = $state<Phase>('idle');
  let castId = '';
  let timers: any[] = [];
  let result = $state<any>(null);
  let busy = $state(false);
  const cfg = $derived(settings().fishing ?? {});
  const left = $derived(G.me.limits?.fishingLeft ?? cfg.castsPerDay);

  const scene = $derived.by(() => {
    const me = G.me.pet;
    const bobY = phase === 'bite' ? 300 : 290;
    let s = `<rect x="-200" y="-200" width="800" height="1000" fill="#A9D18A"/>`;
    s += `<ellipse cx="220" cy="300" rx="190" ry="120" fill="#6EB7D6" stroke="#2B2F4A" stroke-width="3"/>`;
    s += `<path d="M120 280q10 -6 20 0M260 340q10 -6 20 0M300 260q8 -5 16 0M170 360q8 -5 16 0" stroke="#FFFFFF" stroke-width="2.5" fill="none" opacity=".8"/>`;
    s += `<ellipse cx="90" cy="200" rx="40" ry="16" fill="#5DA05A" stroke="#2B2F4A" stroke-width="2.5"/>`;
    s += `<rect x="0" y="176" width="120" height="22" fill="#B98B4E" stroke="#2B2F4A" stroke-width="2.5"/><path d="M20 198v40M60 198v44M100 198v40" stroke="#8A5A36" stroke-width="6"/>`;
    s += `<g transform="translate(70 180) scale(.62)">${renderPet(me, wearItems(me.wear))}</g>`;
    if (phase !== 'idle') {
      s += `<path d="M96 140Q200 60 250 ${bobY - 8}" fill="none" stroke="#2B2F4A" stroke-width="1.6"/>`;
      s += `<g class="bob ${phase}"><ellipse cx="250" cy="${bobY}" rx="9" ry="6" fill="#FFFFFF" stroke="#2B2F4A" stroke-width="2"/><path d="M241 ${bobY}h18" stroke="#E0583F" stroke-width="5"/><path d="M250 ${bobY - 6}v-8" stroke="#2B2F4A" stroke-width="2"/></g>`;
      if (phase === 'bite') s += `<circle cx="250" cy="${bobY + 4}" r="20" fill="none" stroke="#FFFFFF" stroke-width="2.5" class="ripple"/><text x="250" y="${bobY - 26}" text-anchor="middle" class="bang">!</text>`;
    }
    s += `<path d="M96 140L60 196" stroke="#8A5A36" stroke-width="4" stroke-linecap="round"/>`;
    return s;
  });

  function clear() { timers.forEach(clearTimeout); timers = []; }

  async function cast() {
    busy = true;
    try {
      const r = await api.post('/api/fish/cast');
      merge(r);
      castId = r.castId;
      phase = 'wait';
      result = null;
      sfx.splash();
      clear();
      timers.push(setTimeout(() => { phase = 'bite'; sfx.bite(); }, r.biteInMs));
      timers.push(setTimeout(() => { if (phase === 'bite' || phase === 'wait') reel(); }, r.biteInMs + r.windowMs + 900));
    } catch (e) { fail(e); } finally { busy = false; }
  }

  async function reel() {
    if (phase !== 'wait' && phase !== 'bite') return;
    clear();
    phase = 'result';
    busy = true;
    try {
      const r = await api.post('/api/fish/reel', { castId });
      merge(r);
      result = r;
      if (r.result === 'caught') sfx.level(); else sfx.error();
    } catch (e) { fail(e); result = { result: 'missed', reason: 'error' }; } finally { busy = false; }
  }
  onDestroy(clear);
</script>

<div class="fishing">
  <svg viewBox="0 0 420 440" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Kolam pancing">{@html scene}</svg>

  <div class="panel">
    {#if phase === 'idle'}
      <h2>Kolam Pancing</h2>
      <p>Lempar kail, tunggu pelampung tenggelam, lalu tarik secepatnya.</p>
      <p class="muted">Jatah hari ini: <b>{left}</b> · {cfg.energiCost} energi per lemparan</p>
      <div class="row">
        <button class="btn" onclick={() => (G.view = 'map')}>{@html I.back} Kampung</button>
        <button class="btn" onclick={() => (G.sheet = 'collection')}>{@html I.book} Koleksi</button>
        <button class="btn hot" disabled={busy || left <= 0} onclick={cast}>Lempar</button>
      </div>
    {:else if phase === 'wait' || phase === 'bite'}
      <button class="btn pull" class:hot={phase === 'bite'} onpointerdown={(e) => { e.preventDefault(); reel(); }}>{phase === 'bite' ? 'TARIK!' : 'Tunggu…'}</button>
    {:else}
      {#if result?.result === 'caught'}
        {@const f = item(result.fishId)}
        <div class="catch">
          {#if f}<div class="ic">{@html itemIcon(f)}</div>{/if}
          <div>
            <h2>{f?.name ?? 'Ikan'}{#if result.firstCatch}<span class="tag">Baru!</span>{:else if result.newRecord}<span class="tag">Rekor!</span>{/if}</h2>
            <p>{result.cm} cm · masuk ke Tas{#if f?.sell_coin}, laku {f.sell_coin} koin di Pasar{/if}</p>
          </div>
        </div>
      {:else if result}
        <h2>Ikannya lepas</h2>
        <p>{result.reason === 'early' ? 'Terlalu cepat menarik. Tunggu pelampung tenggelam.' : 'Terlambat menarik. Coba lebih cepat.'}</p>
      {:else}
        <p>Menarik kail…</p>
      {/if}
      <div class="row">
        <button class="btn" onclick={() => (G.view = 'map')}>{@html I.back} Kampung</button>
        <button class="btn" onclick={() => (G.sheet = 'collection')}>{@html I.book} Koleksi</button>
        <button class="btn hot" disabled={busy || left <= 0} onclick={cast}>Lempar lagi</button>
      </div>
    {/if}
  </div>
</div>

<style>
  .fishing { position: absolute; inset: 0; background: #A9D18A; }
  svg { position: absolute; left: 0; right: 0; top: calc(var(--safe-t) + 70px); width: 100%; height: calc(100% - var(--safe-t) - var(--safe-b) - 300px); }
  svg :global(.bob.wait) { animation: float 1.2s ease-in-out infinite; }
  svg :global(.bob.bite) { animation: dip .25s ease-in-out infinite; }
  svg :global(.ripple) { animation: ripple .8s ease-out infinite; transform-box: fill-box; transform-origin: center; }
  svg :global(.bang) { font: 800 34px var(--font); fill: #E0583F; stroke: #2B2F4A; stroke-width: 1.5px; }
  .panel { position: absolute; z-index: 8; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-b) + 86px); width: min(440px, calc(100vw - 20px)); background: var(--paper); border: 3px solid var(--ink); border-radius: 20px; box-shadow: 0 5px 0 var(--ink); padding: 14px; display: flex; flex-direction: column; gap: 8px; }
  h2 { margin: 0; font-size: 22px; font-weight: 800; display: flex; align-items: center; gap: 8px; }
  p { margin: 0; font-weight: 600; }
  .row { display: flex; gap: 6px; flex-wrap: wrap; justify-content: space-between; }
  .row .btn { flex: 1 1 auto; }
  .pull { min-height: 96px; font-size: 30px; width: 100%; touch-action: none; }
  .catch { display: flex; gap: 12px; align-items: center; animation: pop .35s; }
  .ic { width: 84px; height: 70px; background: var(--tint); border-radius: 12px; border: 2px solid var(--ink); display: grid; place-items: center; flex: none; }
  .ic :global(svg) { width: 76px; height: 62px; }
  .tag { background: var(--low); color: #fff; border: 2px solid var(--ink); border-radius: 9px; font-size: 13px; padding: 0 7px; }
  @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(3px); } }
  @keyframes dip { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(8px); } }
  @keyframes ripple { from { transform: scale(.5); opacity: 1; } to { transform: scale(1.6); opacity: 0; } }
</style>
