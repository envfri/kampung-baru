<script lang="ts">
  // Papan Lomba Mancing (ketuk papan di Pojok Wahana): papan skor langsung, hasil lomba terakhir, atau jadwal berikutnya.
  // Muncul sendiri sekali saat hasil lomba yang kamu ikuti sudah dihitung server.
  import { ALUN_LAYOUT, fmtGrams, lombaAt } from '@kb/shared';
  import { G, serverNow, settings } from '../lib/game.svelte';
  import { H } from '../lib/house.svelte';
  import { ALUN, lombaCardOpen } from '../lib/alun.svelte';
  import { sfx } from '../lib/sfx';

  const L = $derived(ALUN.lomba);
  const now = $derived(serverNow());
  const lc = $derived(settings().square?.lomba ?? {});
  const prizes = $derived<number[]>(lc.prizes ?? [40, 25, 15]);
  const next = $derived(lombaAt(now));
  const mmss = (ms: number) => { const v = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`; };
  const result = $derived(L?.phase === 'hasil' && !!L.results);
  const rows = $derived((result ? L!.results : L?.phase === 'lomba' || L?.phase === 'hasil' ? L?.board : null) ?? []);
  const clock = (ms: number) => new Date(ms).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  function close() { sfx.tap(); if (L?.phase === 'hasil' && L.id) ALUN.seen = L.id; ALUN.board = false; }
  function join() { close(); if (ALUN.fishing) return; H.actReq = { kind: `mancing@${ALUN_LAYOUT.findIndex((p) => p.i === 'alun-kolam')}` }; }
  function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && lombaCardOpen()) close(); }
</script>

<svelte:window onkeydown={onKey} />
{#if lombaCardOpen() && !ALUN.fishing}
  <section class="lomba" role="dialog" aria-modal="false" aria-labelledby="lomba-t">
    <header>
      <h2 id="lomba-t">{result ? 'Hasil Lomba Mancing' : 'Lomba Mancing'}</h2>
      {#if L?.phase === 'lomba'}<span class="pill hot">{mmss(L.end - now)}</span>
      {:else if result}<span class="pill">selesai</span>
      {:else}<span class="pill">mulai {mmss(next.inMs)}</span>{/if}
    </header>
    {#if result && L?.mine}
      <p class="me" class:win={L.mine.rank > 0}>{L.mine.rank ? `Kamu juara ${L.mine.rank}!` : 'Terima kasih sudah ikut!'}{L.mine.coins ? ` +${L.mine.coins} koin` : ''}{L.mine.xp ? `, +${L.mine.xp} XP` : ''}{!L.mine.coins && !L.mine.xp ? ' (hadiah lomba hari ini sudah habis)' : ''}</p>
    {/if}
    {#if rows.length}
      <ol>
        {#each rows.slice(0, 6) as r, i}
          <li class:me={r.me}><span class="rk" class:gold={(r.rank ?? i + 1) === 1}>{result ? (r.rank || '–') : i + 1}</span><span class="nm">{r.name}{r.me ? ' (kamu)' : ''}</span><span class="fi">{r.fish} ikan</span><span class="kg">{fmtGrams(r.grams)}</span></li>
        {/each}
      </ol>
    {:else if L?.phase === 'lomba'}
      <p class="note">Belum ada ikan tertangkap. Ayo duduk di dermaga!</p>
    {:else if L?.phase === 'hasil'}
      <p class="note">Menghitung hasil…</p>
    {:else}
      <p class="note">Lomba berikutnya pukul {clock(next.start)} (tiap 20 menit, 3 menit). Duduk di dermaga kolam lalu lempar kail.</p>
    {/if}
    <p class="note">Skor = total berat ikan. Hadiah juara: {prizes.join(' · ')} koin. Ikan lomba dicatat di Buku Ikan lalu dilepas lagi.</p>
    <div class="row">
      <button class="btn" onclick={close}>Tutup</button>
      {#if !result && H.live}<button class="btn hot" onclick={join}>Mancing di dermaga</button>{/if}
    </div>
  </section>
{/if}

<style>
  /* HP: di tempat bar alun-alun (bar disembunyikan selama kartu terbuka), di atas dock */
  .lomba { position: absolute; z-index: 30; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-b) + 86px); width: min(380px, calc(100% - 20px)); max-height: calc(100dvh - var(--safe-t) - var(--safe-b) - 196px - var(--hud-x, 0px)); overflow-y: auto; display: flex; flex-direction: column; gap: 8px; background: var(--paper); border: 3px solid var(--ink); border-radius: 20px; box-shadow: 0 5px 0 var(--ink); padding: 12px 14px; animation: pop .25s ease-out; }
  header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  h2 { margin: 0 auto 0 0; font-size: 19px; font-weight: 800; line-height: 1.15; }
  .pill { font-weight: 800; font-size: 13.5px; border: 2px solid var(--ink); border-radius: 999px; padding: 0 10px; background: #FFF4D6; white-space: nowrap; }
  .pill.hot { background: #E0583F; color: #FFFDF7; }
  .me { margin: 0; font-weight: 800; font-size: 15px; background: #EEF2F6; border-radius: 10px; padding: 4px 10px; }
  .me.win { background: #D7F0DF; color: #1E5A3A; }
  ol { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
  li { display: flex; align-items: center; gap: 8px; border: 2px solid var(--ink); border-radius: 12px; padding: 3px 8px; font-weight: 700; font-size: 14px; background: #FFFDF7; }
  li.me { background: #FFE8A3; }
  .rk { flex: none; width: 24px; height: 24px; border-radius: 50%; border: 2px solid var(--ink); background: #EEF2F6; display: grid; place-items: center; font-size: 13px; font-weight: 800; }
  .rk.gold { background: #F2B632; }
  .nm { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fi { flex: none; font-size: 12.5px; color: var(--muted); }
  .kg { flex: none; font-weight: 800; }
  .note { margin: 0; font-size: 13px; font-weight: 600; color: var(--muted); line-height: 1.3; }
  .row { display: flex; gap: 8px; }
  .row .btn { flex: 1 1 0; }
  @media (min-width: 900px) and (min-aspect-ratio: 1/1) { .lomba { bottom: auto; top: calc(var(--safe-t) + var(--prompt-top, 214px)); max-height: calc(100dvh - var(--safe-t) - var(--prompt-top, 214px) - 110px); } }
</style>
