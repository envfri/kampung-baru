<script lang="ts">
  // Mancing di dermaga Kolam Pemancingan Bareng alun-alun: alur mancing yang sama dengan Kolam Pancing (FishingFlow) lewat
  // /api/square/fish/*. Di luar lomba: jatah lempar harian bersama & hadiah kolam. Saat Lomba Mancing: jatah lomba,
  // papan skor ringkas di atas, tangkapan dicatat lalu dilepas lagi. Semua hasil & skor diputuskan server.
  import FishingFlow from './fishing/FishingFlow.svelte';
  import type { Dist, FishApi } from './fishing/pond';
  import { G, merge, post, settings, serverNow } from '../lib/game.svelte';
  import { ALUN } from '../lib/alun.svelte';
  import { fmtGrams } from '@kb/shared';

  const cfg = $derived(settings().fishing ?? {});
  const lc = $derived(settings().square?.lomba ?? {});
  const L = $derived(ALUN.lomba);
  /** lemparan berikutnya dihitung untuk lomba (selama jatah lomba masih ada) */
  const inLomba = $derived(L?.phase === 'lomba' && (L.left ?? 0) > 0);
  const left = $derived(inLomba ? L!.left : G.me.limits?.fishingLeft ?? cfg.castsPerDay ?? 0);
  // energi lomba: sekali saat mulai ikut (belum ada di papan), sesudahnya gratis
  const costs = $derived.by(() => {
    if (!inLomba) return cfg.energi ?? {};
    const e = L?.me ? 0 : Number(lc.entryEnergi ?? 6);
    return { dekat: e, sedang: e, jauh: e };
  });
  const call = async (url: string, body: any) => { const r = await post(url, body); merge(r); return r; };
  const api: FishApi = {
    cast: (distance: Dist) => call('/api/square/fish/cast', { distance }),
    hook: (castId) => call('/api/square/fish/hook', { castId }),
    land: (castId) => call('/api/square/fish/land', { castId }),
    lost: (castId, reason) => call('/api/square/fish/lost', { castId, reason }),
  };
  const mmss = (ms: number) => { const v = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`; };
  const now = $derived(serverNow());
  const top = $derived((L?.phase === 'hasil' && L.results ? L.results : L?.board ?? []).slice(0, 3));
  /** papan skor lomba tampil (sebelum, saat & sesudah lomba); selain itu baris bonus Ramai-ramai */
  const showL = $derived(!!L && (L.phase === 'lomba' || L.phase === 'hasil' || L.phase === 'daftar'));
  const R = $derived(ALUN.ramai);
  const ramaiOn = $derived(!!R && R.anglers >= R.need);
</script>

<div class="alunfish">
  <FishingFlow {api} {left} {costs} title={inLomba ? 'Lomba Mancing' : 'Mancing Bareng'} exitLabel="Berdiri" onexit={() => (ALUN.fishing = null)} onbook={() => (G.sheet = 'collection')} extra={showL ? lstrip : R ? rstrip : undefined} />
</div>

<!-- bonus Ramai-ramai: makin banyak yang duduk di dermaga, ikan makin cepat datang (diputuskan server saat melempar) -->
{#snippet rstrip()}
  <section class="rstrip" class:on={ramaiOn} aria-live="polite" aria-label="Bonus Ramai-ramai">
    <p class="lh">
      <b>{ramaiOn ? 'Ramai-ramai!' : 'Bonus Ramai-ramai'}</b>
      <span class="cnt">{ramaiOn ? `${R!.anglers} pemancing` : `${R!.anglers}/${R!.need} pemancing`}</span>
    </p>
    <p class="ln">
      {#if ramaiOn}Ikan lebih cepat datang{R!.xp > 0 ? ` · +${R!.xp} XP tiap tangkapan` : ''}
      {:else}Ajak {R!.need - R!.anglers} lagi: ikan lebih cepat datang{R!.xp > 0 ? ` & +${R!.xp} XP` : ''}{/if}
    </p>
  </section>
{/snippet}

<!-- papan skor ringkas di dalam panel mancing (tidak menutupi kolam) -->
{#snippet lstrip()}
  <section class="lstrip" aria-live="polite" aria-label="Lomba Mancing">
    <p class="lh">
      <b>Lomba Mancing</b>
      {#if L!.phase === 'lomba'}<span class="time">{mmss(L!.end - now)}</span>
      {:else if L!.phase === 'daftar'}<span class="soon">mulai {mmss(L!.start - now)}</span>
      {:else}<span class="soon">{L!.results ? 'Hasil' : 'Menghitung…'}</span>{/if}
    </p>
    {#if L!.phase === 'daftar'}
      <p class="ln">Lemparanmu dihitung begitu lomba mulai. Skor = total berat ikan.</p>
    {:else if L!.phase === 'hasil' && L!.mine}
      <p class="ln win">{L!.mine.rank ? `Kamu juara ${L!.mine.rank}!` : 'Terima kasih sudah ikut!'}{L!.mine.coins ? ` +${L!.mine.coins} koin` : ''}{L!.mine.xp ? `, +${L!.mine.xp} XP` : ''}</p>
    {:else if top.length}
      <p class="lead"><span class="nm">#1 {top[0].name}{top[0].me ? ' (kamu)' : ''}</span><span class="kg">{fmtGrams(top[0].grams)}</span></p>
      {#if L!.me && !top[0].me}<p class="lead me"><span class="nm">#{L!.me.pos} kamu</span><span class="kg">{fmtGrams(L!.me.grams)}</span></p>{/if}
    {:else}
      <p class="ln">Belum ada ikan. Ayo lempar!</p>
    {/if}
    {#if L!.phase === 'lomba' && !inLomba}<p class="ln warn">Jatah lomba hari ini habis · lemparan ini mancing santai</p>{/if}
  </section>
{/snippet}

<style>
  /* di atas alun-alun, di bawah HUD (z 10) & dock (z 20) */
  .alunfish { position: absolute; inset: 0; z-index: 9; }
  .lstrip { background: #FFF4D6; border: 2px solid var(--ink); border-radius: 12px; padding: 4px 2px; display: flex; flex-direction: column; gap: 2px; }
  .lh { margin: 0; display: flex; align-items: center; gap: 8px; font-size: 14px; }
  .lh b { margin-right: auto; font-weight: 800; }
  .time, .soon { font-weight: 800; font-size: 13px; border: 2px solid var(--ink); border-radius: 999px; padding: 0 9px; white-space: nowrap; }
  .time { background: #E0583F; color: #FFFDF7; }
  .soon { background: #FFFDF7; }
  .lead { margin: 0; display: flex; gap: 8px; font-size: 13.5px; font-weight: 700; padding: 0 7px; line-height: 1.6; }
  .lead.me { background: #FFE8A3; border-radius: 6px; }
  .lstrip .lh, .lstrip .ln { padding: 0 7px; }
  .nm { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .kg { flex: none; font-weight: 800; }
  .ln { margin: 0; font-size: 12.5px; font-weight: 700; color: var(--muted); line-height: 1.25; }
  .ln.win { color: #1E7A4C; font-weight: 800; }
  .ln.warn { color: #A93A27; }
  .rstrip { background: #FFFDF7; border: 2px solid var(--ink); border-radius: 12px; padding: 4px 7px; display: flex; flex-direction: column; gap: 2px; }
  .rstrip.on { background: #FFE3CF; }
  .rstrip .lh { padding: 0; }
  .cnt { font-weight: 800; font-size: 13px; border: 2px solid var(--ink); border-radius: 999px; padding: 0 9px; white-space: nowrap; background: #FFFDF7; }
  .rstrip.on .cnt { background: #E0583F; color: #FFFDF7; }
  /* bonus Ramai-ramai hanya sebelum melempar; saat menunggu & tarik-ulur kolamnya lebih penting */
  :global(.panel[data-phase]:not([data-phase="idle"]):not([data-phase="aim"])) .rstrip { display: none; }
  /* layar pendek: cukup judul & jumlah pemancing supaya kolam tetap terlihat */
  @media (max-height: 680px) { .rstrip .ln { display: none; } }
</style>
