<script lang="ts">
  // Kartu hasil mancing: ikan (warna tingkat), ikan rahasia (versi emas), harta karun (ketuk 3×), botol pesan, temuan.
  import { FISH_TIERS, FIND_LABEL, pondIcon, secretIcon, chestIcon, fmtGrams, type FishTier } from '@kb/shared';
  import { COIN, PEARL, I } from '../../lib/icons';
  import { sfx } from '../../lib/sfx';

  let { res, onclose, onagain, onbook }: { res: any; onclose: () => void; onagain: () => void; onbook?: () => void } = $props();

  const it = $derived(res.item);
  const kind: string = $derived(res.kind);
  const fish = $derived(kind === 'fish');
  const T = $derived(fish ? FISH_TIERS[(res.tier ?? 'biasa') as FishTier] : null);
  const gold = $derived(fish && res.secret && res.firstCatch);
  const cm = (v: number) => String(v).replace('.', ',');
  let taps = $state(0);
  const open = $derived(kind !== 'treasure' || taps >= 3);
  const capped = $derived((res.pearlWanted ?? 0) > (res.pearl ?? 0));

  const RIB: Record<string, { col: string; bg: string; label: string }> = {
    junk: { col: '#7A8290', bg: '#ECEFF2', label: 'Temuan · Sampah' },
    bottle: { col: '#3E9C8C', bg: '#DFF3EE', label: 'Temuan · Botol berisi pesan' },
    treasure: { col: '#A0603A', bg: '#FFF3CF', label: 'Temuan · Harta karun' },
    decor: { col: '#B5683E', bg: '#F8E6D8', label: 'Temuan · Hiasan rumah' },
    wear: { col: '#8A6FC0', bg: '#EEE8FA', label: 'Temuan · Aksesori' },
  };
  const rib = $derived(fish ? { col: T!.col, bg: T!.bg, label: T!.label } : RIB[kind] ?? RIB.junk);

  function rays(col: string, bg: string) {
    let s = `<rect x="-200" y="-150" width="400" height="300" fill="${bg}"/><g class="spin">`;
    for (let i = 0; i < 18; i++) {
      const a = (i * 20 * Math.PI) / 180, b = ((i * 20 + 10) * Math.PI) / 180;
      s += `<path d="M0 0L${(Math.cos(a) * 320).toFixed(0)} ${(Math.sin(a) * 320).toFixed(0)}L${(Math.cos(b) * 320).toFixed(0)} ${(Math.sin(b) * 320).toFixed(0)}Z" fill="${col}" opacity=".16"/>`;
    }
    return s + `</g><circle r="90" fill="#FFFFFF" opacity=".55"/>`;
  }

  function knock() {
    if (open) return;
    taps++;
    if (taps >= 3) sfx.coin(); else sfx.pop();
  }
  const flav = $derived.by(() => {
    if (kind === 'junk') return `Yah, bukan ikan… tapi kolam jadi bersih! ${it.description ?? ''}`.trim();
    if (kind === 'treasure') return open ? 'Tarikannya berat tapi tenang… ternyata peti!' : 'Ketuk peti 3 kali untuk membukanya.';
    if (kind === 'decor') return `${it.description ?? ''} Pasang dari Tas › Mebel.`.trim();
    if (kind === 'wear') return `${it.description ?? ''} Pakai dari Lemari.`.trim();
    const secret = gold && res.secretOf ? ` Rahasia ${res.secretOf.got} dari ${res.secretOf.total}!` : '';
    if (res.released) return `${it.description ?? ''}${secret} Sudah dicatat di Buku, lalu dilepas lagi ke kolam.`.trim();
    return `${it.description ?? ''}${secret}`.trim();
  });
</script>

<div class="dim" role="presentation"></div>
<div class="reveal" class:gold role="dialog" aria-modal="true" aria-label="Hasil mancing: {it.name}" data-kind={kind}>
  <div class="rib" style="--rc:{gold ? '#D9961A' : rib.col}">
    {#if gold}RAHASIA TERBUKA!{:else}{rib.label}{/if}
    {#if fish && T}<span class="stars" aria-label="{T.stars} bintang">{'★'.repeat(T.stars)}<i>{'★'.repeat(4 - T.stars)}</i></span>{/if}
  </div>
  {#if kind === 'bottle'}
    <div class="stage note-stage">
      <div class="paper"><i class="pin"></i><p>“{res.message}”</p><small>— pesan dalam botol</small></div>
    </div>
  {:else}
    <button class="stage" class:tap={kind === 'treasure' && !open} onclick={knock} disabled={kind !== 'treasure' || open} aria-label={kind === 'treasure' && !open ? `Ketuk peti (${taps}/3)` : it.name}>
      <svg class="rays" viewBox="-180 -125 360 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true">{@html rays(gold ? '#F2B632' : rib.col, gold ? '#FFF1C9' : rib.bg)}</svg>
      {#if kind === 'treasure'}
        <span class="art" class:shake={taps > 0 && !open}>{@html chestIcon(open)}</span>
        {#if open}
          <span class="burst" aria-hidden="true">{#each [[-120, -70, -20], [-80, -95, 15], [80, -90, 30], [120, -60, -10], [-140, -10, 40], [140, 0, 10]] as [x, y, r], i}<i style="--x:{x}px;--y:{y}px;--r:{r}deg;--d:{i * 40}ms">{@html COIN}</i>{/each}{#if res.pearl > 0}<i class="pe" style="--x:-30px;--y:-110px;--r:0deg;--d:120ms">{@html PEARL}</i><i class="pe" style="--x:40px;--y:-115px;--r:0deg;--d:180ms">{@html PEARL}</i>{/if}</span>
        {:else}
          <span class="badge knock">{taps}/3 ketuk</span>
        {/if}
      {:else}
        <span class="art">{@html pondIcon(it)}</span>
      {/if}
      {#if res.firstCatch && kind !== 'treasure'}<span class="badge new">Baru!</span>{:else if res.newRecord}<span class="badge rec">Rekor!</span>{/if}
      {#if gold}<span class="was" aria-hidden="true">{@html secretIcon()}<b>???</b><i>→</i></span>{/if}
    </button>
  {/if}
  <div class="rbody">
    <h2>{kind === 'treasure' ? 'Peti Harta Karun!' : it.name}</h2>
    {#if fish && res.cm}<div class="size">{cm(res.cm)} cm <small>· {res.newRecord ? 'terpanjang kamu' : T?.label}</small></div>{/if}
    {#if kind === 'treasure' && open}
      <div class="loot">
        <span class="lc">{@html COIN}+{res.coins}</span>
        {#if res.pearl > 0}<span class="lc">{@html PEARL}+{res.pearl}<small>bonus</small></span>{/if}
      </div>
      {#if capped}<p class="cap">Mutiara dari kolam hari ini sudah penuh. Besok lagi, ya!</p>{/if}
    {/if}
    {#if flav}<p class="flav">{flav}</p>{/if}
    <div class="rew">
      {#if fish && !res.released && it.sell_coin > 0}<span class="chip">{@html COIN} laku {it.sell_coin}</span>{/if}
      {#if res.lomba}
        <!-- Lomba Mancing alun-alun: tangkap-lepas, skor = berat ikan -->
        <span class="chip">{res.late ? 'Waktu lomba habis · tidak dihitung' : `Lomba +${fmtGrams(res.grams ?? 0)}`}</span>
      {:else if res.released}
        {#if res.pearl > 0}<span class="chip">{@html PEARL} berkah +{res.pearl}</span>{:else if capped}<span class="chip">Mutiara kolam hari ini penuh</span>{/if}
        <span class="chip">Ceria +{res.ceria ?? 20}</span>
      {/if}
      {#if kind === 'bottle' && res.coins > 0}<span class="chip">{@html COIN} +{res.coins} koin</span>{/if}
      {#if kind === 'bottle' && res.hint}<span class="chip hint">Petunjuk rahasia tersimpan di Buku Ikan</span>{/if}
      {#if (kind === 'junk' || kind === 'decor' || kind === 'wear')}<span class="chip">masuk Tas{#if it.sell_coin > 0}{' · '}jual {it.sell_coin}{/if}</span>{/if}
      {#if res.xp > 0 && open}<span class="chip">+{res.xp} XP</span>{/if}
      {#if fish && res.book}<span class="chip">{@html I.book} Buku {res.book.got}/{res.book.total}</span>{/if}
    </div>
    <div class="row">
      {#if kind === 'treasure'}
        {#if open}<button class="btn hot" onclick={onclose}>Ambil semua</button>{:else}<button class="btn hot" onclick={knock}>Ketuk peti ({taps}/3)</button>{/if}
      {:else if gold || res.released}
        <button class="btn" onclick={() => onbook?.()}>{@html I.book} Lihat di Buku</button>
        <button class="btn hot" onclick={onagain}>Lempar lagi</button>
      {:else if kind === 'bottle'}
        <button class="btn" onclick={onclose}>Tutup</button>
        <button class="btn hot" onclick={onagain}>Lempar lagi</button>
      {:else}
        <button class="btn" onclick={onclose}>Simpan ke Tas</button>
        <button class="btn hot" onclick={onagain}>Lempar lagi</button>
      {/if}
    </div>
  </div>
</div>

<style>
  .dim { position: absolute; inset: -200px 0 0 0; z-index: 15; background: rgba(43, 47, 74, .5); animation: fade .25s; }
  .reveal { position: absolute; z-index: 16; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-b) + 86px); width: min(440px, calc(100vw - 24px)); max-height: calc(100% - var(--safe-b) - 96px - var(--safe-t)); overflow-y: auto; background: var(--paper); border: 3px solid var(--ink); border-radius: 24px; box-shadow: 0 6px 0 var(--ink); display: flex; flex-direction: column; animation: pop .35s ease-out; }
  .reveal.gold { box-shadow: 0 6px 0 var(--ink), 0 0 0 5px #FFE7A3; }
  .rib { flex: none; display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 4px 8px; font-weight: 800; font-size: 17px; line-height: 1.15; padding: 5px 10px 4px; color: #fff; text-align: center; background: var(--rc); border-bottom: 3px solid var(--ink); text-shadow: 0 2px 0 rgba(43, 47, 74, .45); }
  .gold .rib { background: linear-gradient(90deg, #D9961A, #F2B632, #D9961A); }
  .stars { color: #FFF4B8; font-size: 15px; letter-spacing: 1px; -webkit-text-stroke: .6px var(--ink); white-space: nowrap; }
  .stars i { font-style: normal; color: rgba(255, 255, 255, .35); -webkit-text-stroke: 0; }
  .stage { flex: none; position: relative; display: block; width: 100%; height: clamp(140px, 30dvh, 260px); padding: 0; margin: 0; border: 0; border-bottom: 2.5px solid var(--ink); overflow: hidden; background: transparent; cursor: default; font: inherit; }
  .stage.tap { cursor: pointer; }
  .stage:disabled { opacity: 1; }
  .rays { position: absolute; inset: 0; width: 100%; height: 100%; }
  .rays :global(.spin) { animation: rays 30s linear infinite; transform-origin: 0 0; }
  .art { position: absolute; left: 50%; top: 50%; width: min(300px, 78%); height: 82%; transform: translate(-50%, -50%); display: grid; place-items: center; }
  .art :global(svg) { width: 100%; height: 100%; overflow: visible; }
  .art.shake { animation: shake .3s; }
  .badge { position: absolute; font-weight: 800; font-size: 17px; color: #fff; padding: 2px 11px 0; border: 2.5px solid var(--ink); border-radius: 12px; box-shadow: 0 3px 0 var(--ink); text-shadow: 0 2px 0 rgba(43, 47, 74, .4); white-space: nowrap; }
  .badge.new { background: var(--low); right: 14px; top: 14px; transform: rotate(8deg); }
  .badge.rec { background: #3F7FBF; right: 14px; top: 14px; transform: rotate(8deg); }
  .badge.knock { background: #3FA06A; left: 14px; bottom: 12px; transform: rotate(-6deg); font-size: 15px; }
  .was { position: absolute; left: 10px; bottom: 10px; display: flex; align-items: center; gap: 4px; background: #2E3352; border: 2px solid var(--ink); border-radius: 12px; padding: 2px 8px 2px 4px; color: #F2B632; font-weight: 800; }
  .was :global(svg) { width: 40px; height: 32px; }
  .was i { font-style: normal; color: #fff; font-size: 18px; }
  .burst i { position: absolute; left: 50%; top: 52%; width: 30px; height: 30px; margin: -15px 0 0 -15px; animation: burst .7s ease-out both; animation-delay: var(--d); }
  .burst i :global(svg) { width: 30px; height: 30px; }
  .note-stage { background: #DCEFF7; display: grid; place-items: center; padding: 14px; }
  .paper { position: relative; max-width: 340px; background: #FFF8E6; border: 2.5px solid var(--ink); border-radius: 6px; box-shadow: 4px 5px 0 rgba(43, 47, 74, .18); padding: 14px 16px 8px; transform: rotate(-2deg); text-align: center; }
  .paper p { margin: 0; font-weight: 700; font-size: 17px; line-height: 1.3; }
  .paper small { display: block; text-align: right; margin-top: 4px; font-weight: 700; font-size: 12.5px; color: var(--muted); }
  .pin { position: absolute; top: -8px; left: 50%; width: 14px; height: 14px; margin-left: -7px; border-radius: 50%; background: var(--low); border: 2px solid var(--ink); }
  .rbody { padding: 10px 14px 14px; display: flex; flex-direction: column; gap: 7px; }
  h2 { margin: 0; font-size: clamp(23px, 7vw, 30px); font-weight: 800; line-height: 1.05; text-align: center; overflow-wrap: anywhere; }
  .size { display: flex; justify-content: center; align-items: baseline; flex-wrap: wrap; gap: 0 8px; font-weight: 800; font-size: 24px; }
  .size small { font-size: 14px; color: var(--muted); font-weight: 700; }
  .flav { margin: 0; text-align: center; font-weight: 600; font-size: 14.5px; color: var(--muted); }
  .cap { margin: 0; text-align: center; font-weight: 700; font-size: 13.5px; color: #8A5A1A; }
  .rew { display: flex; justify-content: center; gap: 6px; flex-wrap: wrap; }
  .chip { display: inline-flex; align-items: center; gap: 4px; font-size: 14px; font-weight: 800; padding: 2px 10px 1px; border-radius: 999px; background: var(--soft); border: 2px solid var(--ink); text-align: center; }
  .chip.hint { background: #E9E2FA; }
  .chip :global(svg) { width: 16px; height: 16px; flex: none; }
  .loot { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }
  .lc { display: inline-flex; align-items: center; gap: 6px; font-size: 26px; font-weight: 800; background: var(--soft); border: 2.5px solid var(--ink); border-radius: 16px; box-shadow: 0 3px 0 var(--ink); padding: 3px 14px 1px 10px; animation: pop .4s; }
  .lc :global(svg) { width: 28px; height: 28px; }
  .lc small { font-size: 12px; color: var(--muted); align-self: flex-end; margin-bottom: 4px; }
  .row { display: flex; gap: 8px; margin-top: 2px; }
  .row .btn { flex: 1 1 0; }
  @keyframes rays { to { transform: rotate(360deg); } }
  @keyframes shake { 0%, 100% { transform: translate(-50%, -50%) rotate(0); } 25% { transform: translate(-50%, -50%) rotate(-6deg); } 75% { transform: translate(-50%, -50%) rotate(6deg); } }
  @keyframes burst { from { transform: translate(0, 0) scale(.4); opacity: 0; } 30% { opacity: 1; } to { transform: translate(var(--x), var(--y)) rotate(var(--r)) scale(1); opacity: 1; } }
  @keyframes fade { from { opacity: 0; } }
  /* layar lebar: kartu menempati panel samping kanan, adegan tetap terlihat */
  @media (min-width: 900px) and (min-aspect-ratio: 1/1) {
    .dim { background: rgba(43, 47, 74, .18); }
    .reveal { left: auto; right: 24px; transform: none; bottom: 24px; width: 440px; max-height: calc(100% - var(--safe-t) - 130px); }
    .stage { height: 250px; }
  }
  @media (prefers-reduced-motion: reduce) { .rays :global(.spin), .burst i, .art.shake { animation: none; } .burst i { transform: translate(var(--x), var(--y)); } }
</style>
