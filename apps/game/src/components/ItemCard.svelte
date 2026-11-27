<script lang="ts">
  import type { Snippet } from 'svelte';
  import { itemIcon, isEdisi, edisiBadge } from '@kb/shared';
  let { it, sub = '', badge = '', tried = false, children }: { it: any; sub?: string; badge?: string; tried?: boolean; children?: Snippet } = $props();
  // Edisi Spesial: pita khusus & pratinjau bergerak (kelas .edfx menyalakan animasi ed-* / nt-* di app.css);
  // edisi 2 = Edisi Natal (sahabat besar): pita hijau cemara & panggung salju
  const ed = $derived(isEdisi(it));
  const winter = $derived(ed && Number(it?.data?.edisi) === 2);
</script>

<div class="card" class:tried class:edisi={ed} class:winter>
  {#if ed}<span class="ribbon">{edisiBadge(it)}</span>{/if}
  {#if badge}<span class="badge">{badge}</span>{/if}
  <div class="ic" class:edfx={ed}>{@html itemIcon(it)}</div>
  <div class="name">{it.name}</div>
  <div class="sub">{sub}</div>
  {#if children}{@render children()}{/if}
</div>

<style>
  .card { position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; border: 2px solid var(--ink); border-radius: 14px; padding: 8px 6px 10px; background: var(--card); min-width: 0; }
  /* sedang dicoba di Kaca Pas (Butik) */
  .card.tried { border-color: #1E7A4C; box-shadow: 0 0 0 3px #3FA06A; }
  .ic { width: 100%; height: 66px; display: grid; place-items: center; background: var(--tint); border-radius: 10px; }
  .ic :global(svg) { height: 60px; width: auto; max-width: 100%; }
  .name { font-weight: 800; font-size: 14.5px; line-height: 1.12; }
  .sub { font-size: 12.5px; font-weight: 600; color: var(--muted); line-height: 1.2; min-height: 15px; }
  .badge { position: absolute; top: -8px; right: -6px; background: var(--low); color: #fff; border: 2px solid var(--ink); border-radius: 10px; font-size: 11.5px; font-weight: 800; padding: 0 6px; z-index: 1; }
  /* Edisi Spesial: bingkai emas, panggung pratinjau lebih tinggi (efeknya terlihat bergerak) */
  .card.edisi { background: linear-gradient(180deg, #FFF6DC, var(--card) 55%); box-shadow: inset 0 0 0 2px #F2C94C; padding-top: 12px; }
  .card.edisi .ic { height: 88px; background: radial-gradient(120% 90% at 50% 30%, #FFFFFF 0%, #ECE5FB 62%, #DCD3F5 100%); box-shadow: inset 0 0 0 1.5px #CBBDF0; }
  .card.edisi .ic :global(svg) { height: 82px; }
  .card.winter { background: linear-gradient(180deg, #EAF6EE, var(--card) 55%); }
  .card.winter .ic { background: radial-gradient(120% 90% at 50% 30%, #FFFFFF 0%, #E3F1F8 62%, #CFE4F0 100%); box-shadow: inset 0 0 0 1.5px #A9CDE6; }
  .card.winter .ribbon { background: #1F5A3D; }
  .ribbon { position: absolute; top: -9px; left: -6px; z-index: 1; background: #2B3A6B; color: #FFE27A; border: 2px solid var(--ink); border-radius: 10px; font-size: 10.5px; font-weight: 800; padding: 0 6px; line-height: 16px; white-space: nowrap; }
</style>
