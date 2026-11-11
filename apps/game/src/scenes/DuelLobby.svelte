<script lang="ts">
  // Ruang duel: dua pet berhadapan. Kalau keduanya ada di sini, permainan mulai bersamaan (main bareng).
  // Kalau teman belum datang, pemain bisa main duluan; temannya nanti melawan bayangan permainannya.
  import { onDestroy, onMount } from 'svelte';
  import { petSVG, GAMES } from '@kb/shared';
  import { G, wearItems, fail, settings } from '../lib/game.svelte';
  import { leaveDuel } from '../lib/minigame.svelte';
  import { api } from '../lib/api';
  import { GAME_ART } from '../lib/gameArt';
  import { I } from '../lib/icons';
  import { sfx } from '../lib/sfx';

  const id = G.duel!.id;
  let d = $state<any>(null);
  let offset = 0, going = false, beats = 0;
  let now = $state(Date.now());
  let hb: any, tick: any;

  const canLive = $derived(!!d && (d.status === 'open' || d.status === 'live') && !d.me.started && !d.them.started);
  const sNow = $derived(now + offset);
  const startIn = $derived(d?.liveStart ? Math.max(0, Math.ceil((d.liveStart - 3000 - sNow) / 1000)) : null);

  async function ping() {
    try {
      const r = !d || canLive ? await api.post(`/api/duels/${id}/ready`) : await api.get(`/api/duels/${id}`);
      offset = r.serverNow - Date.now();
      const before = d?.them?.ready;
      d = r.duel;
      if (G.duel) G.duel.them = d.them;
      if (!before && d.them.ready && beats > 0) sfx.pop();
      beats++;
    } catch (e) { fail(e); leaveDuel(); }
  }
  function go(live: boolean) {
    if (going || !d || !G.duel) return;
    going = true;
    sfx.tap();
    G.duel = { ...G.duel, autostart: true, live };
    G.view = d.game;
  }
  onMount(() => {
    ping();
    hb = setInterval(() => { if (!d || canLive || (d.status !== 'done' && !d.me.played)) ping(); }, 1500);
    tick = setInterval(() => {
      now = Date.now();
      // main bareng: masuk ke permainan 3 detik sebelum waktu mulai (hitung mundur 3-2-1 di dalam game)
      if (d?.liveStart && !d.me.started && !d.me.played && now + offset >= d.liveStart - 3000) go(true);
    }, 150);
  });
  onDestroy(() => { clearInterval(hb); clearInterval(tick); });

  const them = $derived(d?.them ?? G.duel?.them);
  const gname = $derived((GAMES as any)[G.duel?.game ?? d?.game]?.name ?? 'Duel');
  const wa = $derived(`https://wa.me/?text=${encodeURIComponent(`Ayo duel ${gname} sama aku di BUPI! Buka sekarang, aku tunggu di ruang duel: ${location.origin}/#duels`)}`);
  const cost = $derived(settings().games?.[G.duel?.game ?? '']?.energiCost ?? 0);
</script>

<div class="lobby">
  <svg class="bg" viewBox="0 0 400 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="400" height="560" fill="#BFE3F5" />
    <ellipse cx="70" cy="80" rx="44" ry="15" fill="#FFFFFF" opacity=".9" /><ellipse cx="320" cy="130" rx="52" ry="17" fill="#FFFFFF" opacity=".85" />
    <path d="M-10 60Q100 92 200 66T410 60" fill="none" stroke="#2B2F4A" stroke-width="1.5" />
    {#each Array(12) as _, i}<path d="M{i * 36 - 4} {66 + Math.sin(i) * 6}l10 0-5 12z" fill={['#E0583F', '#F2B632', '#3F7FBF', '#3FA06A'][i % 4]} stroke="#2B2F4A" stroke-width="1" />{/each}
    <rect y="330" width="400" height="230" fill="#8CC56E" />
    <path d="M0 330H400" stroke="#2B2F4A" stroke-width="2.5" />
    <ellipse cx="200" cy="378" rx="170" ry="34" fill="#A9D88A" stroke="#2B2F4A" stroke-width="2" stroke-dasharray="6 6" />
  </svg>

  <div class="head">
    <span class="art">{@html GAME_ART[G.duel?.game ?? 'bakiak']}</span>
    <div><small>Duel</small><b>{gname}</b></div>
  </div>

  <div class="stage">
    <div class="pet me">
      <span class="svg">{@html petSVG(G.me.pet, wearItems(G.me.pet.wear))}</span>
      <b>{G.me.pet.name}</b><small>Kamu</small>
      {#if canLive || d?.liveStart}<i class="tag ok">Siap</i>{/if}
    </div>
    <div class="vs">VS</div>
    <div class="pet them">
      {#if them?.pet}<span class="svg flip">{@html petSVG(them.pet, wearItems(them.pet.wear))}</span>{:else}<span class="svg empty">?</span>{/if}
      <b>{them?.pet?.name ?? them?.name ?? 'Teman'}</b>{#if them?.pet && them.name !== them.pet.name}<small>{them.name}</small>{/if}
      {#if d?.them.played}<i class="tag">{d.them.label}</i>
      {:else if d?.them.ready || d?.liveStart}<i class="tag ok">Siap</i>
      {:else if d && canLive}<i class="tag wait"><span class="dots"><i></i><i></i><i></i></span></i>{/if}
    </div>
  </div>

  <div class="card">
    {#if !d}
      <p>Masuk ke ruang duel…</p>
    {:else if d.me.played}
      <p>{d.result === 'menang' ? 'Kamu menang!' : d.result === 'kalah' ? 'Kamu kalah.' : d.result === 'seri' ? 'Seri!' : `Skormu ${d.me.label}. Tunggu ${d.them.name} main.`}</p>
      {#if d.result}<p class="sub">{d.me.label} vs {d.them.label}</p>{/if}
      <div class="row"><button class="btn hot" onclick={() => leaveDuel()}>{@html I.back} Daftar duel</button></div>
    {:else if d.status !== 'open' && d.status !== 'live'}
      <p>{d.status === 'declined' ? 'Tantangan ini ditolak.' : d.status === 'expired' ? 'Duel ini sudah kedaluwarsa.' : 'Duel sudah selesai.'}</p>
      <div class="row"><button class="btn hot" onclick={() => leaveDuel()}>{@html I.back} Daftar duel</button></div>
    {:else if d.me.started}
      <p>Kamu sudah mulai duel ini. Selesaikan dari daftar duel.</p>
      <div class="row"><button class="btn hot" onclick={() => leaveDuel()}>{@html I.back} Daftar duel</button></div>
    {:else if d.liveStart}
      <p class="big">Main bareng! Mulai dalam {startIn ?? 0}…</p>
      <p class="sub">Soal sama persis. Skor tertinggi menang.</p>
    {:else if d.them.played}
      <p><b>{d.them.name}</b> sudah main: <b>{d.them.label}</b>. Kalahkan skornya!</p>
      <p class="sub">Bayangan {d.them.name} ikut bertanding di layar. Butuh {cost} energi.</p>
      <div class="row">
        <button class="btn" onclick={() => leaveDuel()}>{@html I.back} Kembali</button>
        <button class="btn hot" onclick={() => go(false)}>Main sekarang</button>
      </div>
    {:else}
      <p>{d.them.started ? `${d.them.name} sedang main duel ini…` : `Menunggu ${d.them.name} masuk ruang duel…`}</p>
      <p class="sub">Kalau kalian sama-sama di sini, permainan mulai bersamaan. Tidak mau menunggu? Main duluan, nanti {d.them.name} melawan bayanganmu.</p>
      <div class="row">
        <a class="btn wa" href={wa} target="_blank" rel="noopener">Ajak lewat WA</a>
        <button class="btn hot" onclick={() => go(false)}>Main duluan</button>
      </div>
      <button class="btn ghost" onclick={() => leaveDuel()}>{@html I.back} Kembali</button>
    {/if}
  </div>
</div>

<style>
  .lobby { position: absolute; inset: 0; overflow: hidden; }
  .bg { position: absolute; inset: 0; width: 100%; height: 100%; }
  .head { position: absolute; z-index: 2; top: calc(var(--safe-t) + 104px); left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 8px; background: var(--paper); border: 2.5px solid var(--ink); border-radius: 18px; box-shadow: 0 3px 0 var(--ink); padding: 4px 14px 4px 6px; white-space: nowrap; }
  .head .art :global(svg) { width: 52px; height: 42px; display: block; }
  .head div { display: flex; flex-direction: column; line-height: 1.1; }
  .head small { font-size: 12px; font-weight: 800; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; }
  .head b { font-size: 20px; }
  .stage { position: absolute; z-index: 1; left: 50%; transform: translateX(-50%); top: 40%; width: min(560px, 100vw); display: flex; align-items: flex-end; justify-content: space-around; translate: 0 -50%; }
  .pet { position: relative; display: flex; flex-direction: column; align-items: center; min-width: 0; width: 40%; }
  .pet .svg { width: min(150px, 36vw); height: min(150px, 36vw); display: block; animation: hop 1.6s ease-in-out infinite; }
  .pet.them .svg { animation-delay: .8s; }
  .pet .svg :global(svg) { width: 100%; height: 100%; }
  .flip { transform: scaleX(-1); }
  .empty { display: grid !important; place-items: center; font: 800 60px var(--font); color: var(--muted); }
  .pet b { font-size: 17px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; background: var(--paper); border: 2px solid var(--ink); border-radius: 999px; padding: 0 10px; margin-top: -4px; }
  .pet small { font-size: 12.5px; font-weight: 700; color: var(--ink); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tag { position: absolute; top: -6px; font-style: normal; font-weight: 800; font-size: 12.5px; background: var(--paper); border: 2px solid var(--ink); border-radius: 999px; padding: 0 8px; }
  .tag.ok { background: #BFEBCB; }
  .tag.wait { padding: 2px 8px; }
  .dots { display: inline-flex; gap: 3px; }
  .dots i { width: 6px; height: 6px; border-radius: 50%; background: var(--ink); animation: blink 1.2s infinite; }
  .dots i:nth-child(2) { animation-delay: .2s; } .dots i:nth-child(3) { animation-delay: .4s; }
  .vs { align-self: center; font: 800 40px var(--font); color: #E0583F; -webkit-text-stroke: 2px var(--ink); }
  .card { position: absolute; z-index: 3; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-b) + 86px); width: min(440px, calc(100vw - 20px)); background: var(--paper); border: 3px solid var(--ink); border-radius: 20px; box-shadow: 0 5px 0 var(--ink); padding: 14px; display: flex; flex-direction: column; gap: 8px; }
  .card p { margin: 0; font-weight: 700; font-size: 15.5px; }
  .card .big { font-size: 22px; font-weight: 800; color: #1E7A4C; }
  .card .sub { font-size: 13.5px; color: var(--muted); font-weight: 600; }
  .row { display: flex; gap: 8px; } .row .btn { flex: 1; }
  .wa { background: #BFEBCB; text-decoration: none; color: var(--ink); }
  .ghost { background: transparent; box-shadow: none; border-color: transparent; min-height: 36px; }
  @keyframes hop { 0%, 100% { translate: 0 0; } 50% { translate: 0 -8px; } }
  @keyframes blink { 0%, 100% { opacity: .25; } 50% { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .pet .svg, .dots i { animation: none; } }
</style>
