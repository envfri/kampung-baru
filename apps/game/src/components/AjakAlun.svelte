<script lang="ts">
  // Gelembung ajakan pet ke alun-alun: kalimat, keterangan kecil, tombol Ayo! (jalan ke alun-alun) & Nanti.
  // Di atas kepala pet; bila tidak muat (HP kecil) di bawah pet dengan ekor ke atas (kartu tugas disembunyikan sementara).
  import { onMount } from 'svelte';
  import { G } from '../lib/game.svelte';
  import { ajakCheck, ajakDone, ajakOn } from '../lib/ajak.svelte';
  import { kerjaAjakCheck } from '../lib/kerja.svelte';

  let { quiet = false }: { quiet?: boolean } = $props();

  const homeSince = Date.now();
  onMount(() => {
    // cek ringan tiap 5 detik (data alun-alun dari server paling sering tiap 2 menit)
    // ajakan sekali ke Papan Lowongan (kerja sambilan) lebih dulu; selain itu ajakan ke alun-alun
    const t = setInterval(() => { if (!kerjaAjakCheck(homeSince, () => quiet) && ajakOn()) ajakCheck(homeSince, () => quiet); }, 5000);
    return () => { clearInterval(t); if (G.ajak) ajakDone('lewat'); };
  });
  // jadi sibuk (lembar, Atur, mandi, makan, Jepret, main bareng, tidur, ...) → ajakan hilang
  $effect(() => { if (quiet && G.ajak) ajakDone('lewat'); });
  // hilang sendiri setelah 12 detik
  $effect(() => {
    const a = G.ajak;
    if (!a) return;
    const t = setTimeout(() => { if (G.ajak === a) ajakDone('lewat'); }, 12_000);
    return () => clearTimeout(t);
  });

  let el = $state<HTMLElement | null>(null);
  let pos = $state<{ x: number; y: number; down: boolean } | null>(null);
  /** tombol & panel HUD yang tidak boleh tertutup */
  const OBSTACLES = '.hud, .roombar, .needs, .event, .jbtn, .acts, .pp, .fp';
  $effect(() => {
    if (!G.ajak || !el) { pos = null; return; }
    let raf = 0;
    const place = () => {
      const pet = document.querySelector('.room .pet')?.getBoundingClientRect();
      const b = el?.getBoundingClientRect();
      if (pet && b && pet.width) {
        const w = b.width, h = b.height;
        const x = Math.max(w / 2 + 8, Math.min(innerWidth - w / 2 - 8, pet.left + pet.width / 2));
        const L = x - w / 2, R = x + w / 2;
        const obs = [...document.querySelectorAll(OBSTACLES)].map((e) => e.getBoundingClientRect()).filter((r) => r.width && r.height && r.right > L && r.left < R);
        const top = pet.top - 12 - h;
        const clash = (y0: number, y1: number) => obs.some((r) => r.bottom > y0 && r.top < y1);
        let down = top < 8 || clash(top, pet.top - 12);
        let y = pet.top;
        if (down) {
          // di bawah pet (sedikit menimpa kaki), tidak sampai ke tombol aksi
          y = pet.bottom - pet.height * 0.08;
          const below = obs.filter((r) => r.top >= pet.top).map((r) => r.top);
          const limit = below.length ? Math.min(...below) - 6 : innerHeight - 8;
          if (y + 12 + h > limit) y = Math.max(pet.top, limit - h - 12);
        }
        // ikut bergeser hanya bila pet/kamera benar-benar pindah (> 4 px), bukan karena pet bernapas: tombol tetap diam
        if (!pos || pos.down !== down || Math.abs(pos.x - x) > 4 || Math.abs(pos.y - y) > 4) pos = { x: Math.round(x), y: Math.round(y), down };
        if (G.ajak && G.ajak.down !== down) G.ajak.down = down;
      }
      raf = requestAnimationFrame(place);
    };
    place();
    return () => cancelAnimationFrame(raf);
  });
</script>

{#if G.ajak}
  <div class="ajak" class:down={pos?.down} class:ready={!!pos} bind:this={el} style={pos ? `left:${pos.x}px;top:${pos.y}px` : ''} role="dialog" aria-label={G.ajak.kind === 'kerja' ? 'Ajakan kerja sambilan' : 'Ajakan ke alun-alun'}>
    <p role="status">{G.ajak.text}{#if G.ajak.sub}<small>{G.ajak.sub}</small>{/if}</p>
    <div class="row">
      <button class="go" onclick={() => ajakDone('ayo')}>
        {#if G.ajak.kind === 'kerja'}
          <!-- papan lowongan -->
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 21V9M18 21V9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="3" y="5" width="18" height="11" rx="1.5" fill="#D6A76A" stroke="currentColor" stroke-width="2"/><rect x="6" y="7.5" width="5" height="6" fill="#FFFDF7" stroke="currentColor" stroke-width="1.2"/><rect x="13" y="7.5" width="5" height="4" fill="#DDEFFB" stroke="currentColor" stroke-width="1.2"/></svg>
        {:else}
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M3 20h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M6 20V11M18 20V11" stroke="currentColor" stroke-width="2"/><path d="M4 11l8-6 8 6z" fill="#E86A4F" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="15" r="2.4" fill="#F2B632" stroke="currentColor" stroke-width="1.6"/></svg>
        {/if}
        {G.ajak.go ?? 'Ayo!'}
      </button>
      <button class="no" onclick={() => ajakDone('nanti')}>Nanti</button>
    </div>
  </div>
{/if}

<style>
  .ajak { position: fixed; z-index: 13; left: 50%; top: 40%; transform: translate(-50%, calc(-100% - 12px)); width: max-content; max-width: min(250px, 74vw); background: var(--paper); border: 2.5px solid var(--ink); border-radius: 18px; box-shadow: 0 3px 0 var(--ink); padding: 8px 10px 9px 12px; color: var(--ink); visibility: hidden; }
  .ajak.ready { visibility: visible; animation: in .22s ease-out; }
  .ajak.down { transform: translate(-50%, 12px); }
  .ajak::after { content: ''; position: absolute; left: 50%; bottom: -9px; width: 14px; height: 14px; background: var(--paper); border-right: 2.5px solid var(--ink); border-bottom: 2.5px solid var(--ink); transform: translateX(-50%) rotate(45deg); }
  .ajak.down::after { top: -9px; bottom: auto; transform: translateX(-50%) rotate(225deg); }
  p { margin: 0; font-weight: 800; font-size: 15px; line-height: 1.22; overflow-wrap: anywhere; }
  small { display: block; font-weight: 700; font-size: 12.5px; color: var(--muted); margin-top: 2px; }
  .row { display: flex; gap: 6px; margin-top: 7px; align-items: center; }
  button { font: 800 13.5px var(--font); border: 2px solid var(--ink); border-radius: 999px; padding: 3px 12px; min-height: 36px; display: inline-flex; align-items: center; gap: 5px; color: var(--ink); background: var(--paper); cursor: pointer; }
  .go { background: var(--coin); box-shadow: 0 2px 0 var(--ink); }
  .go:active { transform: translateY(2px); box-shadow: none; }
  @keyframes in { from { opacity: 0; margin-top: 6px; } to { opacity: 1; margin-top: 0; } }
  @media (prefers-reduced-motion: reduce) { .ajak.ready { animation: none; } }
  /* Pengaturan › Kurangi animasi (pilihan di game) */
  :global(:root.reduce-motion) .ajak.ready { animation: none; }
</style>
