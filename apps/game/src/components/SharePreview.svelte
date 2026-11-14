<script lang="ts">
  // Lembar "Fotomu siap!" (Jepret & Foto bareng): pilih Story 9:16 / Feed 4:5, Nama pet, Kode temanku (bawaan mati),
  // lalu Bagikan (lembar bagikan HP + link tersalin), Simpan ke galeri, atau di desktop Unduh gambar + Salin link.
  // Browser di dalam aplikasi (tidak bisa berbagi file): panel "Simpan dulu, ya" (tekan lama gambar + Salin link).
  import { onDestroy } from 'svelte';
  import type { JepretFormat } from '@kb/shared';
  import { G, toast } from '../lib/game.svelte';
  import { I } from '../lib/icons';
  import { sfx } from '../lib/sfx';
  import { JP, buildFile, captionOf, closeJepret, copyLink, hasOthers, report, saveFile, setCode, setNames, shareCaps, shareLink, shareNow } from '../lib/jepret.svelte';

  let { wide = false }: { wide?: boolean } = $props();
  let fmt = $state<JepretFormat>('story');
  let file = $state<File | null>(null);
  let url = $state('');
  let busy = $state(true);
  let failed = $state(false);
  let caps = $state(shareCaps(null));
  let panel = $state<'main' | 'fallback'>('main');
  let clipFail = $state(false);
  let shared = $state(false);
  let vw = $state(typeof window === 'undefined' ? 390 : window.innerWidth);

  const src = $derived(JP.src);
  const isFoto = $derived(src?.kind === 'foto');
  const kind = $derived<'jepret' | 'foto'>(src?.kind ?? 'jepret');
  const showNames = $derived(!!src && hasOthers(src));
  const link = $derived(shareLink(JP.code));
  const linkShown = $derived(link.replace(/^https?:\/\//, ''));
  const desk = $derived(caps.desktop);

  // kartu dibuat begitu lembar terbuka & dibuat ulang (sebentar ditunda) saat ukuran / pilihan berubah
  let gen = 0;
  $effect(() => {
    const s = JP.src, f = fmt, n = JP.names, c = JP.code;
    if (!s) return;
    const my = ++gen;
    busy = true;
    const t = setTimeout(async () => {
      try {
        const fl = await buildFile(s, f, n, c);
        if (my !== gen) return;
        const old = url;
        file = fl;
        url = URL.createObjectURL(fl);
        if (old) URL.revokeObjectURL(old);
        caps = shareCaps(fl);
        failed = false;
      } catch {
        if (my === gen) { failed = true; file = null; }
      } finally {
        if (my === gen) busy = false;
      }
    }, 120);
    return () => clearTimeout(t);
  });
  onDestroy(() => { gen++; if (url) URL.revokeObjectURL(url); file = null; });

  function close() { sfx.tap(); if (isFoto) JP.src = null; else closeJepret(); }
  function back() {
    sfx.tap();
    if (panel === 'fallback') { panel = 'main'; return; }
    // Jepret: Ulangi = kembali ke jendela bidik; Foto bareng: Kembali = ke foto yang tadi
    const foto = isFoto;
    JP.src = null;
    if (!foto) G.jepret = 'frame';
  }
  function notReady() { toast('Gambarnya belum siap, coba lagi.', 'error'); }
  /** Bagikan: File sudah ada, jadi salin link + share() langsung dalam ketukan yang sama */
  function bagikan() {
    if (!file || busy) return notReady();
    if (!caps.fileShare) { sfx.tap(); panel = 'fallback'; return; }
    const k = kind, f = fmt;
    shared = true;
    shareNow(file, link, () => (clipFail = true)).then((r) => {
      if (r === 'ok') report(k, 'share', f);
      else if (r === 'fail') { toast('Menu bagikan tidak bisa dibuka. Simpan dulu gambarnya, ya.', 'error'); panel = 'fallback'; }
    });
  }
  function simpan() {
    if (!file || busy) return notReady();
    sfx.tap();
    const k = kind, f = fmt, c = caps;
    saveFile(file, c).then((ok) => { if (ok) report(k, c.desktop ? 'download' : 'save', f); });
  }
  function salin(inapp = false) {
    sfx.tap();
    const ok = copyLink(link, () => { clipFail = true; toast('Salin manual dari kotak link, ya.'); });
    if (ok) toast('Link BUPI tersalin — tempel lewat stiker Link di Story', 'good', 4000);
    if (inapp) report(kind, 'inapp', fmt);
  }
  function key(e: KeyboardEvent) { if (e.key === 'Escape') { e.preventDefault(); if (panel === 'fallback') panel = 'main'; else close(); } }
  const pick = (f: JepretFormat) => { if (fmt !== f) { sfx.tap(); fmt = f; } };

  const RETAKE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4 4.5v4h4"/></svg>';
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const LINK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4.2 4.2 0 0 0 6 0l3-3a4.2 4.2 0 0 0-6-6l-1 1"/><path d="M14 10a4.2 4.2 0 0 0-6 0l-3 3a4.2 4.2 0 0 0 6 6l1-1"/></svg>';
  const ALBUM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="M3.5 15.5l4.5-4 4 3.5 2.5-2 6 4.5"/><circle cx="15.5" cy="9.3" r="1.7"/></svg>';
  const alt = $derived(src ? `Pratinjau gambar ${fmt === 'story' ? 'Story' : 'Feed'}: ${captionOf(src, JP.names).join(', ')}${JP.code ? ` · Kode teman ${G.me?.user?.friend_code ?? ''}` : ''}` : '');
</script>

<svelte:window onkeydown={key} bind:innerWidth={vw} />

{#snippet options()}
  <div class="seg" role="radiogroup" aria-label="Ukuran gambar">
    <button role="radio" aria-checked={fmt === 'story'} class:on={fmt === 'story'} onclick={() => pick('story')}>Story <small>9:16</small></button>
    <button role="radio" aria-checked={fmt === 'feed'} class:on={fmt === 'feed'} onclick={() => pick('feed')}>Feed <small>4:5</small></button>
  </div>
  <div class="chips">
    {#if showNames}<button class="chk" class:on={JP.names} role="checkbox" aria-checked={JP.names} onclick={() => { sfx.tap(); setNames(!JP.names); }}><i>{#if JP.names}{@html CHECK}{/if}</i>Nama pet</button>{/if}
    <button class="chk" class:on={JP.code} role="checkbox" aria-checked={JP.code} onclick={() => { sfx.tap(); setCode(!JP.code); }}><i>{#if JP.code}{@html CHECK}{/if}</i>Kode temanku</button>
  </div>
  {#if JP.code}<p class="warn">Siapa pun yang melihat bisa langsung berteman denganmu.</p>{/if}
{/snippet}

{#snippet linkBox()}
  <div class="lk"><input class="input" readonly value={linkShown} aria-label="Link untuk stiker Link" onfocus={(e) => (e.target as HTMLInputElement).select()} /><button class="btn" onclick={() => salin()}>{@html LINK}Salin link</button></div>
{/snippet}

{#snippet actions()}
  {#if desk}
    <button class="btn hot block big" disabled={busy || failed} onclick={simpan}>{@html I.down}{busy ? 'Menyiapkan…' : 'Unduh gambar'}</button>
    <p class="lbl">LINK UNDANGAN (UNTUK STIKER LINK)</p>
    {@render linkBox()}
    {#if isFoto}<p class="note">{@html ALBUM}<span>Foto bareng ini sudah ada di album (Teman › Album).</span></p>{/if}
    <div class="steps"><b>Mau dipasang di Instagram Story?</b><ol><li>Kirim gambar ini ke HP-mu (atau buka BUPI di HP lalu Jepret dari sana).</li><li>Buat Story dari gambar itu.</li><li>Tempel link lewat stiker <b>Link</b>.</li></ol></div>
  {:else}
    <button class="btn hot block big" disabled={busy || failed} onclick={bagikan}>{@html I.share}{busy ? 'Menyiapkan…' : 'Bagikan'}</button>
    <div class="row2"><button class="btn" disabled={busy || failed} onclick={simpan}>{@html I.down}Simpan ke galeri</button></div>
    {#if clipFail}{@render linkBox()}{/if}
    {#if isFoto}<p class="note">{@html ALBUM}<span>Foto bareng ini sudah ada di album (Teman › Album).</span></p>{/if}
    <p class="note">{@html LINK}<span>{#if shared}Link BUPI tersalin — tempel lewat stiker Link di Story.{:else if vw < 360}Link BUPI ikut tersalin. Di Story, tempel lewat stiker <b>Link</b>.{:else}Saat kamu ketuk <b>Bagikan</b>, link BUPI ikut tersalin. Di Story, pilih stiker <b>Link</b> lalu tempel.{/if}</span></p>
  {/if}
  {#if failed}<p class="warn" role="alert">Gambarnya belum siap, coba lagi.</p>{/if}
{/snippet}

{#if src}
  <div class="backdrop" role="presentation" onclick={close}></div>
  {#if panel === 'fallback'}
    <div class="sheet full" role="dialog" aria-modal="true" aria-label="Simpan dulu, ya">
      <header><span class="grip" aria-hidden="true"></span><button class="btn back" onclick={back}>{@html RETAKE}Kembali</button><h2>Simpan dulu, ya</h2><button class="x" onclick={close} aria-label="Tutup">{@html I.close}</button></header>
      <div class="body">
        <div class="prev big">{#if url}<img class="save" src={url} alt="{alt}. Tekan lama untuk menyimpan." /><span class="press" aria-hidden="true"></span>{/if}</div>
        <p class="lead">Tekan lama gambar untuk menyimpan, lalu buka Instagram.</p>
        <p class="sub">Di Story, tempel link lewat stiker Link.</p>
        <button class="btn hot block big" onclick={() => salin(true)}>{@html LINK}Salin link</button>
        {#if caps.inApp}<p class="tip"><b>Lebih gampang:</b> ketuk ⋯ di pojok kanan atas, pilih <b>Buka di browser</b>. Dari sana tombol Bagikan langsung jalan.</p>
        {:else}<button class="btn block" disabled={busy} onclick={simpan}>{@html I.down}Simpan ke galeri</button>{/if}
        {#if clipFail}{@render linkBox()}{/if}
      </div>
    </div>
  {:else if wide}
    <div class="dlg" role="dialog" aria-modal="true" aria-label="Fotomu siap!">
      <div class="pv"><div class="prev">{#if url}<img src={url} {alt} />{:else}<span class="wait">Menyiapkan…</span>{/if}</div></div>
      <div class="col">
        <div class="hd"><button class="btn back" onclick={back}>{@html RETAKE}{isFoto ? 'Kembali' : 'Ulangi'}</button><h2>Fotomu siap!</h2><button class="x" onclick={close} aria-label="Tutup">{@html I.close}</button></div>
        {@render options()}
        {@render actions()}
      </div>
    </div>
  {:else}
    <div class="sheet full" role="dialog" aria-modal="true" aria-label="Fotomu siap!">
      <header><span class="grip" aria-hidden="true"></span><button class="btn back" onclick={back}>{@html RETAKE}{isFoto ? 'Kembali' : 'Ulangi'}</button><h2>Fotomu siap!</h2><button class="x" onclick={close} aria-label="Tutup">{@html I.close}</button></header>
      <div class="body">
        <div class="prev">{#if url}<img src={url} {alt} />{:else}<span class="wait">Menyiapkan…</span>{/if}</div>
        {@render options()}
        {@render actions()}
      </div>
    </div>
  {/if}
{/if}

<style>
  .backdrop { position: fixed; inset: 0; z-index: 46; background: rgba(43, 47, 74, .45); animation: fade .2s; }
  .sheet { position: fixed; left: 0; right: 0; bottom: 0; top: calc(var(--safe-t) + 6px); z-index: 47; display: flex; flex-direction: column; background: var(--paper); border: 3px solid var(--ink); border-bottom: 0; border-radius: 24px 24px 0 0; animation: up .25s ease-out; padding-bottom: var(--safe-b); }
  header { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 14px 10px 10px; border-bottom: 2.5px solid var(--ink); background: var(--soft); border-radius: 21px 21px 0 0; }
  .grip { position: absolute; top: 5px; left: 50%; transform: translateX(-50%); width: 42px; height: 5px; border-radius: 3px; background: rgba(43, 47, 74, .3); }
  h2 { margin: 0; font-size: 20px; font-weight: 800; flex: 1; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .x { width: 44px; height: 44px; border-radius: 12px; border: 2.5px solid var(--ink); background: var(--paper); display: grid; place-items: center; padding: 0; flex: none; cursor: pointer; }
  .x :global(svg) { width: 20px; height: 20px; }
  .back { min-height: 44px; padding: 4px 10px 4px 8px; font-size: 14px; flex: none; }
  .body { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 10px; padding: 12px max(14px, var(--safe-r)) 14px max(14px, var(--safe-l)); overflow-y: auto; }
  .body > :not(.prev) { flex: none; }
  .prev { flex: 1 1 0; min-height: 120px; display: flex; justify-content: center; align-items: center; position: relative; margin-bottom: 4px; }
  /* gambar diperkecil utuh (perbandingan Story 9:16 / Feed 4:5 tetap) di tengah ruang yang tersisa */
  .prev img { position: absolute; inset: 0; margin: auto; display: block; max-width: 100%; max-height: 100%; width: auto; height: auto; border: 2.5px solid var(--ink); border-radius: 14px; box-shadow: 0 4px 0 var(--ink); background: #fff; }
  .prev.big img.save { -webkit-touch-callout: default; -webkit-user-select: auto; user-select: auto; pointer-events: auto; }
  .wait { font-weight: 800; color: var(--muted); }
  .press { position: absolute; left: 50%; top: 46%; width: 64px; height: 64px; border-radius: 50%; border: 3px solid #FFFDF7; background: rgba(43, 47, 74, .35); box-shadow: 0 0 0 8px rgba(255, 253, 247, .35), 0 0 0 16px rgba(255, 253, 247, .18); transform: translate(-50%, -50%); pointer-events: none; }
  .seg { display: flex; border: 2.5px solid var(--ink); border-radius: 12px; overflow: hidden; }
  .seg button { flex: 1; border: 0; background: var(--paper); font: 800 15px var(--font); color: var(--ink); min-height: 44px; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 0 6px; cursor: pointer; }
  .seg button + button { border-left: 2.5px solid var(--ink); }
  .seg button.on { background: var(--coin); }
  .seg small { font-size: 12px; font-weight: 700; color: var(--muted); }
  .seg button.on small { color: var(--ink); }
  .chips { display: flex; gap: 8px; }
  .chk { flex: 1; display: flex; align-items: center; gap: 7px; min-height: 44px; border: 2.5px solid var(--ink); border-radius: 12px; background: var(--paper); font: 800 14px/1.1 var(--font); color: var(--ink); padding: 4px 9px; text-align: left; cursor: pointer; }
  .chk i { width: 24px; height: 24px; border-radius: 7px; border: 2.5px solid var(--ink); background: #fff; display: grid; place-items: center; flex: none; }
  .chk i :global(svg) { width: 15px; height: 15px; }
  .chk.on { background: #E6F5EC; }
  .chk.on i { background: var(--ok); color: #fff; }
  .warn { margin: -4px 0 0; font-size: 13px; font-weight: 700; color: #A93A27; line-height: 1.3; }
  .big { min-height: 52px; font-size: 18px; font-weight: 800; }
  .big :global(svg) { width: 22px; height: 22px; }
  .row2 { display: flex; gap: 8px; }
  .row2 .btn { flex: 1; padding: 6px 8px; font-size: 15px; }
  .note { margin: 0; display: flex; gap: 7px; align-items: flex-start; font-size: 13px; font-weight: 700; color: var(--muted); line-height: 1.3; }
  .note :global(svg) { width: 17px; height: 17px; flex: none; margin-top: 1px; color: #1E7A4C; }
  .note b { color: var(--ink); }
  .lk { display: flex; gap: 8px; }
  .lk .input { flex: 1; min-width: 0; font-size: 15px; min-height: 44px; padding: 6px 10px; }
  .lk .btn { flex: none; }
  .lbl { margin: 0; font-size: 12.5px; font-weight: 800; color: var(--muted); letter-spacing: .02em; }
  .steps { border: 2px dashed rgba(43, 47, 74, .35); border-radius: 14px; padding: 8px 12px; font-size: 13.5px; font-weight: 600; color: var(--muted); line-height: 1.35; }
  .steps b { color: var(--ink); font-weight: 800; }
  .steps ol { margin: 4px 0 0; padding-left: 20px; }
  .lead { margin: 0; font-size: 16.5px; font-weight: 800; line-height: 1.25; text-align: center; }
  .sub { margin: -4px 0 0; font-size: 13.5px; font-weight: 700; color: var(--muted); text-align: center; }
  .tip { margin: 0; border: 2px dashed rgba(43, 47, 74, .35); border-radius: 14px; padding: 7px 11px; font-size: 13px; font-weight: 600; color: var(--muted); line-height: 1.3; }
  .tip b { color: var(--ink); }
  /* desktop: jendela tengah, gambar di kiri */
  .dlg { position: fixed; z-index: 47; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(880px, calc(100vw - 40px)); height: min(650px, calc(100dvh - 40px)); background: var(--paper); border: 3px solid var(--ink); border-radius: 24px; box-shadow: 0 6px 0 var(--ink); display: flex; overflow: hidden; animation: pop .22s ease-out; }
  .dlg .pv { flex: 0 0 44%; background: #EAF3EE; border-right: 2.5px solid var(--ink); display: flex; padding: 20px; min-width: 0; }
  .dlg .pv .prev { flex: 1; min-height: 0; }
  .dlg .col { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 12px; padding: 16px 18px 18px; overflow-y: auto; }
  .dlg .hd { display: flex; align-items: center; gap: 8px; }
  .dlg h2 { font-size: 24px; }
  @media (max-width: 359px) { .row2 .btn :global(svg) { display: none; } .row2 .btn { font-size: 14.5px; } h2 { font-size: 18px; } }
  @keyframes up { from { transform: translateY(40%); opacity: .4; } to { transform: none; opacity: 1; } }
  @keyframes fade { from { opacity: 0; } }
</style>
