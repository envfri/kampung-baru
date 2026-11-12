<script lang="ts">
  // Desktop: pilihan kamera rumah (Dekat / Ruangan / Pekarangan), zoom, putar sudut, mode santai.
  // Layar 900–1499 px: cukup ikon (label jadi tooltip) supaya tidak menabrak menu bawah.
  import { G, setMirror, setSantai } from '../lib/game.svelte';
  import { sfx } from '../lib/sfx';

  const MODES: { k: 'near' | 'room' | 'yard'; l: string; key: string; ic: string }[] = [
    { k: 'near', l: 'Dekat', key: '1', ic: '<circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="12" cy="12" r="2.6" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>' },
    { k: 'room', l: 'Ruangan', key: '2', ic: '<path d="M4 9.5 12 5l8 4.5v9L12 23l-8-4.5Z" transform="translate(0 -2)" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M12 8v8.5M4.5 8.2 12 12.5l7.5-4.3" transform="translate(0 -1.5)" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' },
    { k: 'yard', l: 'Pekarangan', key: '3', ic: '<path d="M2 17l10 5 10-5-10-5Z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M8 13V8l4-3 4 3v5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><circle cx="19" cy="9" r="2.6" fill="currentColor"/>' },
  ];
  const zoom = (f: number) => { sfx.tap(); dispatchEvent(new CustomEvent('kb-cam', { detail: { zoom: f } })); };
</script>

<div class="cam" role="toolbar" aria-label="Kamera rumah">
  <div class="seg" role="group" aria-label="Sudut kamera">
    {#each MODES as m (m.k)}
      <button class:on={G.cam === m.k} aria-pressed={G.cam === m.k} title="{m.l} (tombol {m.key})" aria-label={m.l} onclick={() => { sfx.tap(); G.cam = m.k; }}>
        <svg viewBox="0 0 24 24" aria-hidden="true">{@html m.ic}</svg><span>{m.l}</span>
      </button>
    {/each}
  </div>
  <button class="ib" title="Perkecil (tombol −)" aria-label="Perkecil" onclick={() => zoom(0.8)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg></button>
  <button class="ib" title="Perbesar (tombol +)" aria-label="Perbesar" onclick={() => zoom(1.25)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12M12 6v12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg></button>
  <button class="ib pill" class:on={G.mirror} aria-pressed={G.mirror} title="Putar sudut: lihat dari sisi seberang (tombol R)" aria-label="Putar sudut" onclick={() => { sfx.tap(); setMirror(!G.mirror); }}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M18.5 2.5v4.5H14M5.5 21.5V17H10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Putar sudut</span>
  </button>
  <button class="ib pill" class:on={G.santai} aria-pressed={G.santai} title="Mode santai: kamera bergerak pelan saat lama tidak disentuh" aria-label="Mode santai" onclick={() => { sfx.tap(); setSantai(!G.santai); }}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" fill="currentColor"/></svg><span>Mode santai</span>
  </button>
</div>

<style>
  .cam { position: absolute; z-index: 6; left: max(14px, var(--safe-l)); bottom: calc(var(--safe-b) + 14px); display: flex; align-items: center; gap: 6px; }
  .seg { display: flex; gap: 2px; background: var(--paper); border: 2.5px solid var(--ink); border-radius: 16px; box-shadow: 0 3px 0 var(--ink); padding: 3px; }
  .seg button { display: flex; align-items: center; gap: 5px; border: 0; background: none; border-radius: 12px; padding: 5px 10px; font: 800 14px var(--font); color: var(--ink); cursor: pointer; }
  .seg button:hover { background: var(--soft); }
  .seg button.on { background: var(--coin); }
  .ib { display: flex; align-items: center; justify-content: center; gap: 5px; min-width: 42px; height: 42px; padding: 0 8px; background: var(--paper); border: 2.5px solid var(--ink); border-radius: 14px; box-shadow: 0 3px 0 var(--ink); font: 800 14px var(--font); color: var(--ink); cursor: pointer; }
  .ib:hover { background: var(--soft); }
  .ib:active, .seg button:active { transform: translateY(1px); }
  .pill { padding: 0 11px; }
  .pill.on { background: #DFF3E4; }
  svg { width: 20px; height: 20px; flex: none; }
  /* laptop: cukup ikon */
  @media (max-width: 1499px) {
    span { display: none; }
    .seg button { padding: 5px 8px; }
    .pill { padding: 0 8px; }
  }
</style>
