<script lang="ts">
  // Lapisan game main bareng di rumah & alun-alun: kartu ajakan, ruang tunggu, papan permainan, hasil.
  import { petSVG } from '@kb/shared';
  import { G, wearItems, settings } from '../../lib/game.svelte';
  import { RULE_CHIPS, CLOCK_ICON } from '../../lib/barengTiles';
  import { H } from '../../lib/house.svelte';
  import { BG, GAME_NAMES, serverNow, joinGame, goGame, leaveGame, startGame, whyText } from '../../lib/bareng.svelte';
  import CongklakBoard from './CongklakBoard.svelte';
  import UlarBoard from './UlarBoard.svelte';
  import KarungLive from './KarungLive.svelte';
  import CaturBoard from './CaturBoard.svelte';
  import LudoBoard from './LudoBoard.svelte';
  /** game dengan kartu hasil sendiri di papannya (kartu hasil umum tidak dipakai) */
  const OWN_RESULT = new Set(['catur', 'ludo']);
  /** papan catur sendiri sampai hasil (batal tetap memakai kartu umum) */
  const ownBoard = (g: any) => g.game === 'catur' && !!g.catur && g.catur.result?.reason !== 'batal';
  /** papan dengan tombol "Berhenti menonton" sendiri */
  const ownStop = (g: any) => ownBoard(g) || g.game === 'ludo';

  const me = $derived(H.me);
  const isMine = (g: any) => g.players.some((p: any) => p.id === me && !p.left);
  const mine = $derived(H.games.find((g) => isMine(g) && !BG.closed.includes(g.id)) ?? null);
  const watch = $derived(!mine && BG.watching ? H.games.find((g) => g.id === BG.watching) ?? null : null);
  const invite = $derived(mine ? null : H.games.find((g) => g.phase === 'ajak' && !isMine(g) && !BG.dismissed.includes(g.id) && g.players.length < g.max) ?? null);
  const running = $derived(mine || watch || invite ? null : H.games.find((g) => g.phase === 'main' && !isMine(g)) ?? null);
  let tick = $state(0);
  $effect(() => { const t = setInterval(() => (tick = serverNow()), 500); return () => clearInterval(t); });
  const secs = (until: number) => { void tick; return Math.max(0, Math.ceil((until - serverNow()) / 1000)); };
  const ava = (p: any) => (p.pet ? petSVG({ color: p.pet.color ?? '#F2EEE3', ear: p.pet.ear ?? 'tunas', pattern: p.pet.pattern, eyes: p.pet.eyes, tail: p.pet.tail }, wearItems(p.pet.wear ?? [])) : '');
  const starterName = (g: any) => g.players.find((p: any) => p.id === g.starter)?.name ?? 'Teman';
  const resultOf = (g: any) => g.results?.find((r: any) => r.id === me);
  /** kartu hasil muncul setelah langkah terakhir selesai dimainkan di papan */
  // kartu di atas dock: selama tampil, panel tamu/alun-alun, tombol aksi & kartu tugas disembunyikan (tidak saling menutupi)
  const showCard = $derived(mine ? mine.phase === 'ajak' || mine.phase === 'siap' || mine.phase === 'selesai' : !!watch || !!invite);
  $effect(() => { BG.card = showCard; return () => { BG.card = false; }; });
  const resultsReady = (g: any) => !g.last?.anim || serverNow() >= (g.last.at ?? 0) + g.last.anim + 600;
</script>

{#if mine}
  {#if mine.phase === 'ajak'}
    <div class="card" role="dialog" aria-label="Menunggu pemain {GAME_NAMES[mine.game]}">
      <h3>{GAME_NAMES[mine.game]} <span class="chip">mulai {secs(mine.inviteUntil)} dtk</span></h3>
      <div class="who">
        {#each mine.players as p (p.id)}<span><i>{@html ava(p)}</i>{p.id === me ? `${p.name} (kamu)` : p.name}</span>{/each}
        {#each Array(Math.max(0, mine.max - mine.players.length)) as _}<span class="empty">kursi kosong</span>{/each}
      </div>
      <p class="note">{mine.starter === me ? 'Yang lain di sini mendapat ajakan. Mulai otomatis saat kursi penuh atau hitung mundur habis.' : `Menunggu ${starterName(mine)} memulai.`}</p>
      {#if mine.game === 'ular'}<p class="note">Aturan: finis harus pas di kotak 36. Kelebihan langkah = bidak mundur.</p>{/if}
      {@render rules(mine.game)}
      <div class="btns">
        <button class="btn" onclick={() => leaveGame(mine.id)}>{mine.starter === me ? 'Batal' : 'Keluar'}</button>
        {#if mine.starter === me}<button class="btn hot" disabled={mine.players.length < mine.min || BG.busy} onclick={() => goGame(mine.id)}>Mulai sekarang</button>{/if}
      </div>
    </div>
  {:else if mine.phase === 'siap'}
    <div class="card"><h3>{GAME_NAMES[mine.game]}</h3><p class="note">Menyiapkan lomba…</p></div>
  {:else if ownBoard(mine)}<CaturBoard g={mine} me={me} />
  {:else if mine.phase === 'selesai' && !mine.results?.length && mine.why}
    <div class="card"><h3>{GAME_NAMES[mine.game]}</h3><p class="note">{whyText(mine)}</p><div class="btns"><button class="btn" onclick={() => (BG.closed = [...BG.closed, mine.id])}>Tutup</button></div></div>
  {:else if mine.game === 'congklak'}<CongklakBoard g={mine} me={me} />
  {:else if mine.game === 'ular'}<UlarBoard g={mine} me={me} />
  {:else if mine.game === 'ludo'}<LudoBoard g={mine} me={me} />
  {:else}<KarungLive g={mine} me={me} />{/if}

  {#if mine.phase === 'selesai' && mine.results?.length && !OWN_RESULT.has(mine.game) && (void tick, resultsReady(mine))}
    {@const r = resultOf(mine)}
    <div class="card res" role="dialog" aria-label="Hasil {GAME_NAMES[mine.game]}">
      <h2>{r?.rank === 1 ? (mine.game === 'congklak' && mine.results.every((x: any) => x.rank === 1) ? 'Seri!' : 'Kamu menang!') : r ? `Juara ${r.rank}` : 'Selesai'}</h2>
      {#each mine.results as x (x.id)}
        <div class="rk" class:me={x.id === me}><b>{x.rank}</b><i>{@html ava(mine.players.find((p: any) => p.id === x.id) ?? {})}</i><span>{x.name}{x.id === me ? ' (kamu)' : ''}</span>
          <em>{mine.game === 'congklak' ? `${x.score ?? 0} biji` : mine.game === 'karung' ? (x.timeMs ? `${(x.timeMs / 1000).toFixed(2).replace('.', ',')} d` : 'tidak finis') : `kotak ${x.score ?? 36}`}</em></div>
      {/each}
      {#if r}<p class="gain">{#if r.coins}+{r.coins} koin{/if}{#if r.xp} · +{r.xp} XP{/if}{#if r.capped} Jatah hari ini sudah habis, tanpa koin.{:else if !r.coins && !r.xp} Tanpa hadiah kali ini.{/if}</p>{/if}
      <div class="btns">
        <button class="btn" onclick={() => (BG.closed = [...BG.closed, mine.id])}>Tutup</button>
        <button class="btn hot" disabled={BG.busy} onclick={() => { BG.closed = [...BG.closed, mine.id]; startGame(mine.game); }}>Main lagi</button>
      </div>
    </div>
  {/if}
{:else if watch}
  {#if watch.game === 'congklak'}<CongklakBoard g={watch} me={me} />{:else if watch.game === 'ular'}<UlarBoard g={watch} me={me} />{:else if watch.game === 'ludo'}<LudoBoard g={watch} me={me} />{:else if ownBoard(watch)}<CaturBoard g={watch} me={me} />{/if}
  {#if !ownStop(watch)}<button class="btn sm stopwatch" onclick={() => (BG.watching = null)}>Berhenti menonton</button>{/if}
{:else if invite}
  <div class="card" role="dialog" aria-label="Ajakan main {GAME_NAMES[invite.game]}">
    <h3>{GAME_NAMES[invite.game]} <span class="chip">ajakan · {secs(invite.inviteUntil)} dtk</span></h3>
    <div class="who">
      {#each invite.players as p (p.id)}<span><i>{@html ava(p)}</i>{p.name}</span>{/each}
      <span class="empty">+{invite.max - invite.players.length} kursi</span>
    </div>
    <p class="note">{starterName(invite)} mengajak main {GAME_NAMES[invite.game]}.{invite.game === 'karung' ? ' Memakai energi & jatah Lomba Karung.' : ''}</p>
    {@render rules(invite.game)}
    <div class="btns">
      <button class="btn" onclick={() => (BG.dismissed = [...BG.dismissed, invite.id])}>Nanti</button>
      <button class="btn hot" disabled={BG.busy} onclick={() => joinGame(invite.id)}>{invite.game === 'karung' ? 'Ikut lomba' : 'Ikut main'}</button>
    </div>
  </div>
{:else if running && running.game !== 'karung'}
  <button class="watch" onclick={() => (BG.watching = running.id)}>{GAME_NAMES[running.game]} sedang dimainkan · <b>Tonton</b></button>
{/if}

{#snippet rules(game: string)}
  {#if RULE_CHIPS[game]}<div class="rules">{#each RULE_CHIPS[game](settings()) as r (r.t)}<span>{#if r.clock}{@html CLOCK_ICON}{/if}{r.t}</span>{/each}</div>{/if}
{/snippet}

<style>
  .card { position: fixed; z-index: 62; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-b) + 92px); width: min(400px, calc(100% - 20px)); display: flex; flex-direction: column; gap: 8px; background: var(--paper); border: 3px solid var(--ink); border-radius: 20px; box-shadow: 0 5px 0 var(--ink); padding: 12px 14px; animation: pop .25s ease-out; }
  .card h3 { margin: 0; font-size: 18px; font-weight: 800; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .chip { font-size: 11.5px; font-weight: 800; padding: 2px 8px 1px; line-height: 1.3; border-radius: 999px; background: var(--ink); color: #F7C548; }
  .who { display: flex; gap: 6px; flex-wrap: wrap; }
  .who span { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 800; border: 2px solid var(--ink); border-radius: 999px; padding: 0 9px 0 2px; background: #fff; min-height: 30px; }
  .who i { width: 24px; height: 26px; display: inline-block; }
  .who i :global(svg), .rk i :global(svg) { width: 100%; height: 100%; }
  .who .empty { border-style: dashed; color: var(--muted); padding: 0 10px; }
  .note { margin: 0; font-size: 13px; font-weight: 600; color: var(--muted); line-height: 1.3; }
  .btns { display: flex; gap: 8px; }
  .btns .btn { flex: 1; min-height: 42px; }
  .res { z-index: 70; }
  .res h2 { margin: 0; font-size: 24px; font-weight: 800; }
  .rk { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; }
  .rk b { width: 20px; }
  .rk i { width: 28px; height: 30px; display: inline-block; }
  .rk em { margin-left: auto; font-style: normal; font-weight: 800; }
  .rk.me { color: #2A6FB0; }
  .gain { margin: 0; font-weight: 800; font-size: 16px; }
  /* di bawah bar alun-alun / tamu (z 14) supaya menu Main yang dibuka tidak tertutup */
  .watch { position: fixed; z-index: 13; left: 50%; transform: translateX(-50%); top: min(calc(var(--safe-t) + var(--prompt-top, 226px)), calc(100dvh - 200px)); border: 2.5px solid var(--ink); border-radius: 999px; background: var(--paper); box-shadow: 0 3px 0 var(--ink); padding: 4px 14px; font: inherit; font-weight: 700; font-size: 13.5px; color: var(--ink); cursor: pointer; }
  .rules { display: flex; flex-wrap: wrap; gap: 5px; }
  .rules span { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 800; background: #FFF4D6; border: 2px solid #E7D29A; border-radius: 999px; padding: 1px 9px; line-height: 1.3; }
  .rules :global(svg) { width: 14px; height: 14px; flex: none; }
  .stopwatch { position: fixed; z-index: 66; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-b) + 86px); }
</style>
