<script lang="ts">
  // Main bareng di rumah: Masak bareng (bergiliran memilih bahan sesuai resep) & Lempar bola (oper tepat waktu).
  import { onDestroy } from 'svelte';
  import { G, item, serverNow } from '../lib/game.svelte';
  import { H, coop } from '../lib/house.svelte';
  import { INGREDIENT } from '../lib/houseArt';
  import { itemIcon } from '@kb/shared';
  import { sfx, buzz } from '../lib/sfx';
  import { COIN } from '../lib/icons';

  const c = $derived(H.coop);
  const mine = $derived(!!c && c.players?.some((p: any) => p.id === H.me));
  // hasil hanya untuk yang ikut main sejak berjalan (bukan setelah muat ulang halaman)
  const watched = new Set<string>();
  $effect(() => { if (c && !c.done && mine) watched.add(c.id); });
  const show = $derived(!!c && mine && (!c.done || (H.coopSeen !== c.id && watched.has(c.id))));
  const nameOf = (id: string) => c?.players?.find((p: any) => p.id === id)?.name ?? 'Teman';
  let now = $state(Date.now());
  const clock = setInterval(() => (now = Date.now()), 100);
  onDestroy(() => clearInterval(clock));
  const left = $derived(c ? Math.max(0, Math.ceil((c.endsAt - serverNow()) / 1000)) : 0);
  let busy = $state(false);

  async function pick(p: string) {
    if (busy) return;
    busy = true;
    const before = c.step;
    const r = await coop({ action: 'pick', coopId: c.id, pick: p });
    if (r) { if (r.step > before || r.done) { sfx.pop(); buzz(10); } else { sfx.error(); buzz(50); } }
    busy = false;
  }

  // Lempar bola: lingkaran mengecil berulang; tekan Oper! saat pas di lingkaran sasaran
  const PERIOD = 1400;
  let t0 = performance.now();
  $effect(() => { void c?.holder; t0 = performance.now(); });
  const ring = $derived.by(() => { void now; const ph = ((performance.now() - t0) % PERIOD) / PERIOD; return 1 - ph * 0.8; });
  const TARGET = 0.5;
  async function pass() {
    if (busy) return;
    busy = true;
    const hit = Math.abs(ring - TARGET) <= 0.11;
    hit ? sfx.pop() : sfx.error();
    buzz(hit ? 10 : 50);
    await coop({ action: 'pass', coopId: c.id, hit });
    busy = false;
  }
  function close() { if (c) H.coopSeen = c.id; }
  async function quit() { await coop({ action: 'quit', coopId: c.id }); }
  const myResult = $derived(c?.results?.find((r: any) => r.id === H.me));
</script>

{#if show}
  <div class="coop" role="dialog" aria-label={c.game === 'masak' ? 'Masak bareng' : 'Lempar bola'}>
    {#if !c.done}
      <header><b>{c.game === 'masak' ? `Masak ${item(c.dish)?.name ?? 'bareng'}` : 'Lempar bola'}</b><span class="time">{left} d</span></header>
      {#if c.game === 'masak'}
        <div class="recipe" aria-label="Resep">
          {#each Array(c.steps) as _, i}
            <span class="step" class:done={i < c.step} class:now={i === c.step} title={INGREDIENT[c.recipe?.[i]]?.name}>{@html INGREDIENT[c.recipe?.[i]]?.svg ?? i + 1}</span>
          {/each}
        </div>
        <p class="turn">{c.active === H.me ? 'Giliranmu! Pilih bahan berikutnya:' : `Giliran ${nameOf(c.active)}…`} <span class="miss">Salah {c.mistakes}/3</span></p>
        <div class="opts">
          {#each c.options as o}
            <button class="opt" disabled={c.active !== H.me || busy} onclick={() => pick(o)}>{@html INGREDIENT[o]?.svg ?? ''}<span>{INGREDIENT[o]?.name ?? o}</span></button>
          {/each}
        </div>
        <p class="hint">Ikuti resep di atas (kotak kuning = langkah sekarang). Pemain bergiliran memilih bahan; salah 3 kali, masakannya gosong.</p>
      {:else}
        <div class="ball">
          <div class="ring-wrap"><span class="target"></span>{#if c.holder === H.me}<span class="ring" style="transform:scale({ring})"></span>{/if}<span class="b"></span></div>
          <div class="info">
            <p class="turn">{c.holder === H.me ? 'Bola di kamu! Tekan saat lingkaran pas.' : `Bola di ${nameOf(c.holder)}…`}</p>
            <p>Oper <b>{c.passes}</b>/{c.goal} · Nyawa {'♥'.repeat(Math.max(0, c.lives))}</p>
            <button class="btn hot" disabled={c.holder !== H.me || busy} onclick={pass}>Oper!</button>
          </div>
        </div>
      {/if}
      <button class="link" onclick={quit}>Berhenti</button>
    {:else}
      <header><b>{c.ok ? (c.game === 'masak' ? `${item(c.dish)?.name ?? 'Masakan'} jadi!` : 'Kerja sama hebat!') : 'Belum berhasil'}</b></header>
      {#if c.game === 'masak' && c.ok && item(c.dish)}<span class="dish">{@html itemIcon(item(c.dish)!)}</span>{/if}
      <ul class="res">
        {#each c.results ?? [] as r (r.id)}
          <li class:me={r.id === H.me}><span>{r.name}{r.id === H.me ? ' (kamu)' : ''}</span><span>{#if r.capped}jatah hadiah habis{:else}{@html COIN} +{r.coins}{r.item ? ` · +1 ${item(r.item)?.name ?? ''}` : ''}{/if}</span></li>
        {/each}
      </ul>
      {#if myResult && !myResult.capped}<p class="hint">Pet-mu juga makin ceria.</p>{/if}
      <button class="btn hot" onclick={close}>Tutup</button>
    {/if}
  </div>
{/if}

<style>
  .coop { position: absolute; z-index: 30; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(400px, calc(100vw - 20px)); background: var(--paper); border: 3px solid var(--ink); border-radius: 20px; box-shadow: 0 5px 0 var(--ink); padding: 12px; display: flex; flex-direction: column; gap: 8px; animation: pop .2s ease-out; }
  header { display: flex; justify-content: space-between; align-items: center; }
  header b { font-size: 19px; }
  .time { font-weight: 800; background: var(--soft); border: 2px solid var(--ink); border-radius: 999px; padding: 0 10px; }
  .recipe { display: flex; gap: 6px; justify-content: center; }
  .step { width: 40px; height: 40px; border: 2px solid var(--ink); border-radius: 10px; display: grid; place-items: center; font-weight: 800; background: var(--card); }
  .step.done { background: #D8F0DF; opacity: .7; }
  .step.now { background: #FFE8A3; box-shadow: 0 0 0 3px #F2B632; }
  .step :global(svg) { width: 30px; height: 30px; }
  .turn { margin: 0; font-weight: 800; display: flex; justify-content: space-between; gap: 8px; }
  .miss { color: var(--muted); font-size: 13px; }
  .opts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .opt { display: flex; flex-direction: column; align-items: center; gap: 2px; border: 2px solid var(--ink); border-radius: 12px; background: var(--card); padding: 6px 2px; font-weight: 700; font-size: 12px; cursor: pointer; }
  .opt:disabled { opacity: .55; cursor: default; }
  .opt :global(svg) { width: 38px; height: 38px; }
  .hint { margin: 0; font-size: 12.5px; color: var(--muted); font-weight: 600; }
  .ball { display: flex; gap: 12px; align-items: center; }
  .ring-wrap { position: relative; width: 120px; height: 120px; flex: none; display: grid; place-items: center; }
  .target, .ring { position: absolute; inset: 0; border-radius: 50%; }
  .target { inset: 30px; border: 4px dashed #3FA06A; }
  .ring { border: 4px solid #E0583F; }
  .b { width: 34px; height: 34px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #fff, #F2B632 45%, #E0583F); border: 2.5px solid var(--ink); }
  .info { display: flex; flex-direction: column; gap: 6px; }
  .info p { margin: 0; font-weight: 700; }
  .res { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
  .res li { display: flex; justify-content: space-between; font-weight: 700; }
  .res li.me { color: #1E5FA0; }
  .res :global(svg) { width: 16px; height: 16px; vertical-align: -3px; }
  .dish { align-self: center; }
  .dish :global(svg) { width: 64px; height: 64px; }
  .link { background: none; border: 0; color: var(--muted); font-weight: 700; text-decoration: underline; cursor: pointer; align-self: center; }
</style>
