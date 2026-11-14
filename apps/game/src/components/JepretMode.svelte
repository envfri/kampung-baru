<script lang="ts">
  // Mode Jepret (jendela bidik): UI game disembunyikan, bingkai 4:5 (luar bingkai digelapkan), kamera tetap bisa digeser,
  // dicubit & digulir. Label nama pet di bingkai tampil persis seperti di foto. Tombol: tutup, Nama pet (bila ada pet lain),
  // jepret, Pet-ku, Semua (+ zoom di desktop). Tombol keyboard: Spasi jepret, Esc / J tutup, N nama pet, + / − zoom.
  import { labelSVG } from '@kb/shared';
  import { G } from '../lib/game.svelte';
  import { JP, closeJepret, shoot, roomCmd, labelsFor, othersIn, setNames } from '../lib/jepret.svelte';
  import { sfx } from '../lib/sfx';

  let { wide = false }: { wide?: boolean } = $props();
  let vw = $state(typeof window === 'undefined' ? 390 : window.innerWidth), vh = $state(typeof window === 'undefined' ? 844 : window.innerHeight);
  const safeB = () => { try { return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-b')) || 0; } catch { return 0; } };
  /** letak bingkai & tombol (sama dengan rancangan: HP lebar layar − 32, desktop tinggi 540) */
  const L = $derived.by(() => {
    if (wide) {
      const fh = Math.max(240, Math.min(540, vh - 228)), fw = Math.round(fh * 0.8), fx = Math.round((vw - fw) / 2), fy = 60;
      return { f: { x: fx, y: fy, w: fw, h: fh }, ctl: fy + fh + 62, side: 0 };
    }
    const ctl = vh - 16 - 80 - (vh > 700 ? 24 : 0) - safeB();
    const a0 = 72, a1 = ctl - 12;
    let fw = vw - 32, fh = Math.round(fw * 1.25);
    if (fh + 36 > a1 - a0) { fh = Math.max(160, a1 - a0 - 40); fw = Math.round(fh * 0.8); }
    const fy = Math.round(a0 + (a1 - a0 - (fh + 36)) / 2);
    return { f: { x: Math.round((vw - fw) / 2), y: fy, w: fw, h: fh }, ctl, side: vw < 360 ? 100 : 112 };
  });
  $effect(() => { JP.frame = L.f; });
  // pet sendiri dimasukkan ke bingkai saat mode Jepret dibuka (bila tadinya di luar)
  $effect(() => { const t = setTimeout(() => roomCmd('enter'), 60); return () => clearTimeout(t); });
  const others = $derived(othersIn(JP.pets, L.f));
  const labels = $derived(labelsFor(JP.pets, L.f, JP.names));
  const hint = $derived(wide ? 'Seret untuk geser · gulir untuk zoom · Spasi untuk jepret · Esc untuk tutup' : vw < 360 ? 'Geser & cubit untuk atur' : 'Geser untuk pindah · cubit untuk zoom');

  function close() { sfx.tap(); closeJepret(); }
  const cam = (op: 'pet' | 'all') => { sfx.tap(); roomCmd(op); };
  const zoom = (f: number) => { sfx.tap(); roomCmd('zoom', { f }); };
  function toggleNames() { sfx.tap(); setNames(!JP.names); }
  function key(e: KeyboardEvent) {
    if (G.jepret !== 'frame' || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement | null;
    if (t?.closest?.('input, textarea, select, [contenteditable]')) return;
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'spacebar') { e.preventDefault(); shoot(); }
    else if (k === 'escape' || k === 'j') { e.preventDefault(); close(); }
    else if (k === 'n' && others.length) { e.preventDefault(); toggleNames(); }
    else if (k === '+' || k === '=') { e.preventDefault(); zoom(1.25); }
    else if (k === '-' || k === '_') { e.preventDefault(); zoom(0.8); }
  }
  const CAM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8.5h3.2L8.8 6h6.4l1.6 2.5H20V19H4z"/><circle cx="12" cy="13.3" r="3.6"/></svg>';
  const X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  const TAG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 12.5V5.5a2 2 0 0 1 2-2h7l8 8-9 9z"/><circle cx="8" cy="8" r="1.6"/></svg>';
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const XS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  const TARGET = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.6" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>';
  const ALL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><path d="M8 12.5 12 9l4 3.5V16H8Z" fill="currentColor"/></svg>';
  const MINUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 12h12"/></svg>';
  const PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 12h12M12 6v12"/></svg>';
  const allLabel = $derived(G.view === 'alun' ? 'Lihat seluruh alun-alun' : 'Lihat seluruh rumah');
</script>

<svelte:window bind:innerWidth={vw} bind:innerHeight={vh} onkeydown={key} />

<div class="jp" class:wide role="region" aria-label="Mode Jepret">
  <div class="vf" style="left:{L.f.x}px;top:{L.f.y}px;width:{L.f.w}px;height:{L.f.h}px" aria-hidden="true">
    <i class="g" style="left:33.33%;top:0;width:1px;height:100%"></i><i class="g" style="left:66.66%;top:0;width:1px;height:100%"></i>
    <i class="g" style="top:33.33%;left:0;height:1px;width:100%"></i><i class="g" style="top:66.66%;left:0;height:1px;width:100%"></i>
    <i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i>
  </div>
  <!-- label nama pet: sama persis dengan yang tergambar di foto -->
  {#if labels.length}<svg class="jl" viewBox="0 0 {vw} {vh}" width={vw} height={vh} aria-hidden="true">{@html labels.map((l) => labelSVG(l)).join('')}</svg>{/if}

  <button class="rbtn x" style={wide ? 'left:24px;top:18px' : ''} onclick={close} aria-label="Tutup Jepret">{@html X}</button>
  {#if wide}<p class="vtitle">{@html CAM}Jepret</p>{/if}
  {#if others.length}
    <button class="tgl" class:on={JP.names} role="switch" aria-checked={JP.names} aria-label="Nama pet di foto" style={wide ? 'right:24px' : ''} onclick={toggleNames}>
      {@html TAG}<span class="lb">Nama pet<small>{JP.names ? 'tampil di foto' : 'disembunyikan'}</small></span><i class="sw"><b>{@html JP.names ? CHECK : XS}</b></i>
    </button>
  {/if}
  <p class="hint" style="top:{L.f.y + L.f.h + 10}px">{hint}</p>

  {#if wide}
    <button class="btn pill" style="left:{L.f.x}px;top:{L.ctl + 17}px" onclick={() => cam('pet')} aria-label="Pusatkan ke pet-ku">{@html TARGET}Pet-ku</button>
    <button class="rbtn" style="left:{vw / 2 - 40 - 16 - 46}px;top:{L.ctl + 17}px" onclick={() => zoom(0.8)} aria-label="Perkecil">{@html MINUS}</button>
    <button class="shut" style="left:{vw / 2 - 40}px;top:{L.ctl}px" onclick={shoot} aria-label="Jepret!"><i>{@html CAM}</i></button>
    <button class="rbtn" style="left:{vw / 2 + 40 + 16}px;top:{L.ctl + 17}px" onclick={() => zoom(1.25)} aria-label="Perbesar">{@html PLUS}</button>
    <button class="btn pill" style="left:{L.f.x + L.f.w - 112}px;top:{L.ctl + 17}px" onclick={() => cam('all')} aria-label={allLabel}>{@html ALL}Semua</button>
  {:else}
    <button class="vfb" style="left:{vw / 2 - L.side}px;top:{L.ctl + 4}px" onclick={() => cam('pet')} aria-label="Pusatkan ke pet-ku"><span class="rb">{@html TARGET}</span><span class="t">Pet-ku</span></button>
    <button class="shut" style="left:{vw / 2 - 40}px;top:{L.ctl}px" onclick={shoot} aria-label="Jepret!"><i>{@html CAM}</i></button>
    <button class="vfb" style="left:{vw / 2 + L.side}px;top:{L.ctl + 4}px" onclick={() => cam('all')} aria-label={allLabel}><span class="rb">{@html ALL}</span><span class="t">Semua</span></button>
  {/if}
</div>

<style>
  .jp { position: fixed; inset: 0; z-index: 30; pointer-events: none; }
  .jp > :global(button), .jp > button { pointer-events: auto; }
  .vf { position: fixed; border-radius: 6px; box-shadow: 0 0 0 4000px rgba(18, 24, 46, .62); outline: 2px solid rgba(255, 253, 247, .9); pointer-events: none; }
  .vf .g { position: absolute; background: rgba(255, 253, 247, .28); }
  .vf .c { position: absolute; width: 26px; height: 26px; border: 0 solid #FFFDF7; }
  .vf .c.tl { left: -5px; top: -5px; border-left-width: 5px; border-top-width: 5px; border-top-left-radius: 9px; }
  .vf .c.tr { right: -5px; top: -5px; border-right-width: 5px; border-top-width: 5px; border-top-right-radius: 9px; }
  .vf .c.bl { left: -5px; bottom: -5px; border-left-width: 5px; border-bottom-width: 5px; border-bottom-left-radius: 9px; }
  .vf .c.br { right: -5px; bottom: -5px; border-right-width: 5px; border-bottom-width: 5px; border-bottom-right-radius: 9px; }
  .jl { position: fixed; left: 0; top: 0; pointer-events: none; overflow: visible; }
  button { font-family: var(--font); color: var(--ink); cursor: pointer; }
  .rbtn { position: fixed; width: 46px; height: 46px; border-radius: 50%; background: var(--paper); border: 2.5px solid var(--ink); box-shadow: 0 3px 0 var(--ink); display: grid; place-items: center; padding: 0; }
  .rbtn.x { left: max(14px, var(--safe-l)); top: calc(var(--safe-t) + 14px); }
  .rbtn :global(svg) { width: 22px; height: 22px; }
  .vtitle { position: fixed; left: 50%; top: 12px; transform: translateX(-50%); margin: 0; background: var(--ink); color: #FFFDF7; font-weight: 800; font-size: 15px; border-radius: 999px; padding: 4px 14px 3px; display: flex; align-items: center; gap: 6px; white-space: nowrap; pointer-events: none; }
  .vtitle :global(svg) { width: 18px; height: 18px; }
  .tgl { position: fixed; right: max(14px, var(--safe-r)); top: calc(var(--safe-t) + 14px); display: flex; align-items: center; gap: 7px; height: 46px; padding: 0 8px 0 10px; background: var(--paper); border: 2.5px solid var(--ink); border-radius: 999px; box-shadow: 0 3px 0 var(--ink); font: 800 14px/1.1 var(--font); }
  .tgl > :global(svg) { width: 19px; height: 19px; flex: none; }
  .tgl .lb { display: flex; flex-direction: column; align-items: flex-start; }
  .tgl .lb small { font-size: 11px; font-weight: 700; color: var(--muted); }
  .sw { position: relative; width: 44px; height: 26px; border-radius: 999px; border: 2px solid var(--ink); background: #C9C2B0; flex: none; transition: background .15s; }
  .sw b { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #FFFDF7; border: 2px solid var(--ink); display: grid; place-items: center; transition: left .15s; }
  .sw b :global(svg) { width: 11px; height: 11px; }
  .tgl.on .sw { background: var(--ok); }
  .tgl.on .sw b { left: 20px; }
  .hint { position: fixed; left: 50%; transform: translateX(-50%); margin: 0; background: rgba(43, 47, 74, .86); color: #FFFDF7; font-size: 13px; font-weight: 700; border-radius: 999px; padding: 4px 12px 3px; white-space: nowrap; max-width: calc(100vw - 16px); overflow: hidden; text-overflow: ellipsis; pointer-events: none; }
  .shut { position: fixed; width: 80px; height: 80px; border-radius: 50%; background: var(--paper); border: 3px solid var(--ink); box-shadow: 0 4px 0 var(--ink); display: grid; place-items: center; padding: 0; }
  .shut i { width: 62px; height: 62px; border-radius: 50%; background: var(--coin); border: 2.5px solid var(--ink); display: grid; place-items: center; }
  .shut :global(svg) { width: 30px; height: 30px; stroke-width: 2.2; }
  .shut:active, .rbtn:active, .vfb:active .rb { transform: translateY(2px); }
  .vfb { position: fixed; display: flex; flex-direction: column; align-items: center; gap: 4px; transform: translateX(-50%); background: none; border: 0; padding: 0; }
  .vfb .rb { width: 50px; height: 50px; border-radius: 50%; background: var(--paper); border: 2.5px solid var(--ink); box-shadow: 0 3px 0 var(--ink); display: grid; place-items: center; }
  .vfb .rb :global(svg) { width: 22px; height: 22px; }
  .vfb .t { font-size: 12.5px; font-weight: 800; color: #FFFDF7; text-shadow: 0 1px 0 rgba(0, 0, 0, .4); white-space: nowrap; }
  .pill { position: fixed; min-height: 46px; }
</style>
