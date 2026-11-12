<script lang="ts">
  // Papan congklak: 7 lubang per pemain + lumbung. Baris bawah = lubangmu (ketuk saat giliranmu).
  import { petSVG } from '@kb/shared';
  import { wearItems } from '../../lib/game.svelte';
  import { moveGame, serverNow } from '../../lib/bareng.svelte';
  import { sfx } from '../../lib/sfx';
  let { g, me }: { g: any; me: string } = $props();

  const p = $derived(Math.max(0, g.players.findIndex((x: any) => x.id === me)) as 0 | 1);
  const player = $derived(g.players.some((x: any) => x.id === me));
  const opp = $derived(g.players[p === 0 ? 1 : 0]);
  const self = $derived(g.players[p]);
  const myTurn = $derived(player && g.phase === 'main' && g.turn === me);
  const board: number[] = $derived(g.board?.length ? g.board : Array(16).fill(0));
  const myIdx = (k: number) => (p === 0 ? k : 8 + k);
  const oppIdx = (k: number) => (p === 0 ? 14 - k : 6 - k);
  const myStore = $derived(p === 0 ? 7 : 15), oppStore = $derived(p === 0 ? 15 : 7);
  /** posisi layar tiap lubang (untuk penanda yang berjalan saat biji dibagi) */
  function posOf(i: number): [number, number] {
    if (i === myStore) return [316, 84];
    if (i === oppStore) return [24, 84];
    for (let k = 0; k < 7; k++) { if (myIdx(k) === i) return [62 + k * 36, 110]; if (oppIdx(k) === i) return [62 + k * 36, 56]; }
    return [170, 84];
  }
  // animasi langkah terakhir: penanda menyusuri lubang yang diisi
  let mark = $state<[number, number] | null>(null);
  let seenSeq = 0;
  $effect(() => {
    const last = g.last, seq = g.seq;
    if (!last?.path?.length || seq === seenSeq) return;
    seenSeq = seq;
    const path: number[] = last.path;
    const dt = Math.max(22, Math.min(110, 2400 / path.length));
    let k = 0;
    const t = setInterval(() => {
      if (k >= path.length) { clearInterval(t); mark = null; return; }
      mark = posOf(path[k]); k++;
      if (k % 2) sfx.tap();
    }, dt);
    return () => clearInterval(t);
  });
  let tick = $state(0);
  $effect(() => { const t = setInterval(() => (tick = serverNow()), 500); return () => clearInterval(t); });
  const left = $derived((void tick, Math.max(0, Math.ceil((g.turnUntil - serverNow()) / 1000))));
  const ava = (x: any) => (x?.pet ? petSVG({ color: x.pet.color ?? '#F2EEE3', ear: x.pet.ear ?? 'tunas', pattern: x.pet.pattern, eyes: x.pet.eyes, tail: x.pet.tail }, wearItems(x.pet.wear ?? [])) : '');
  async function pick(k: number) {
    if (!myTurn || board[myIdx(k)] <= 0) return;
    sfx.pop();
    await moveGame(g.id, { hole: k });
  }
  /** biji di dalam lubang: spiral bunga matahari yang selalu muat di elips lubang (lebih dari `cap` biji cukup angkanya) */
  const seeds = (cx: number, cy: number, n: number, rx: number, ry: number, cap: number) => {
    const N = Math.min(n, cap), ix = Math.max(0, rx - 4.6), iy = Math.max(0, ry - 3.8);
    let o = '';
    for (let i = 0; i < N; i++) {
      const a = i * 2.39996, f = N === 1 ? 0 : Math.sqrt((i + 0.5) / N);
      o += `<ellipse cx="${(cx + Math.cos(a) * f * ix).toFixed(1)}" cy="${(cy + Math.sin(a) * f * iy).toFixed(1)}" rx="3.2" ry="2.4" fill="#FFF4DE" stroke="#2B2F4A" stroke-width=".9"/>`;
    }
    return o;
  };
</script>

<div class="sheet" role="dialog" aria-label="Papan congklak">
  <div class="who"><span class="ava">{@html ava(opp)}</span><b>{opp?.name ?? 'Lawan'}</b>{#if g.phase === 'main' && g.turn === opp?.id}<span class="turn">gilirannya</span>{/if}</div>
  <svg viewBox="0 0 340 168" class="board" role="group" aria-label="Lubang congklak">
    <defs><linearGradient id="ckayu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C98B55" /><stop offset="1" stop-color="#9C6338" /></linearGradient></defs>
    <path d="M30 20h280a26 26 0 0 1 26 26v76a26 26 0 0 1-26 26H30A26 26 0 0 1 4 122V46A26 26 0 0 1 30 20Z" fill="url(#ckayu)" stroke="#2B2F4A" stroke-width="3" />
    <ellipse cx="24" cy="84" rx="15" ry="40" fill="#5E3A1F" stroke="#2B2F4A" stroke-width="2" />{@html seeds(24, 84, board[oppStore], 15, 40, 26)}
    <text x="24" y="140" class="n">{board[oppStore]}</text>
    <ellipse cx="316" cy="84" rx="15" ry="40" fill="#5E3A1F" stroke="#F2B632" stroke-width="3" />{@html seeds(316, 84, board[myStore], 15, 40, 26)}
    <text x="316" y="140" class="n me">{board[myStore]}</text>
    {#each Array(7) as _, k}
      {@const cx = 62 + k * 36}
      <ellipse {cx} cy="56" rx="14" ry="11" fill="#5E3A1F" stroke="#2B2F4A" stroke-width="2" />{@html seeds(cx, 56, board[oppIdx(k)], 14, 11, 10)}
      <text x={cx} y="40" class="n">{board[oppIdx(k)]}</text>
      <g class="hole" class:can={myTurn && board[myIdx(k)] > 0} role="button" tabindex={myTurn && board[myIdx(k)] > 0 ? 0 : -1} aria-label="Lubang {k + 1}, {board[myIdx(k)]} biji"
        onclick={() => pick(k)} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(k); } }}>
        <ellipse {cx} cy="110" rx="15" ry="12" fill="#5E3A1F" stroke={myTurn && board[myIdx(k)] > 0 ? '#F2B632' : '#2B2F4A'} stroke-width={myTurn && board[myIdx(k)] > 0 ? 3.4 : 2} />
        {@html seeds(cx, 110, board[myIdx(k)], 15, 12, 11)}
      </g>
      <text x={cx} y="138" class="n me">{board[myIdx(k)]}</text>
    {/each}
    {#if mark}<circle cx={mark[0]} cy={mark[1]} r="10" fill="#F7C548" fill-opacity=".55" stroke="#F2B632" stroke-width="2" />{/if}
  </svg>
  <div class="who"><span class="ava">{@html ava(self)}</span><b>{self?.name}{player ? ' (kamu)' : ''}</b>
    {#if g.phase === 'main'}<span class="ring" class:hot={myTurn}>{left}</span>{/if}</div>
  <p class="msg">{g.phase === 'main' ? (myTurn ? 'Giliranmu! Ketuk lubang di barismu.' : player ? `Menunggu ${opp?.name ?? 'lawan'}…` : 'Kamu menonton.') : g.log?.at(-1) ?? ''}</p>
  {#if g.log?.length && g.phase === 'main'}<p class="log">{g.log.at(-1)}</p>{/if}
  <p class="note">Biji jatuh terakhir di lumbungmu = jalan lagi. Di lubang berisi = ambil dan bagi lagi. Di lubang kosongmu = tembak biji lawan di seberangnya.</p>
</div>

<style>
  .sheet { position: fixed; z-index: 60; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-b) + 10px); width: min(420px, calc(100% - 16px)); display: flex; flex-direction: column; gap: 4px; background: var(--paper); border: 3px solid var(--ink); border-radius: 20px; box-shadow: 0 5px 0 var(--ink); padding: 10px 12px; }
  .who { display: flex; align-items: center; gap: 8px; font-size: 15px; }
  .ava { width: 34px; height: 36px; display: inline-block; }
  .ava :global(svg) { width: 100%; height: 100%; }
  .turn { margin-left: auto; font-size: 12px; font-weight: 800; background: #FFF4D6; border-radius: 999px; padding: 1px 8px; }
  .ring { margin-left: auto; width: 32px; height: 32px; border-radius: 50%; border: 3.5px solid #C9C2B0; display: grid; place-items: center; font-weight: 800; font-size: 13px; }
  .ring.hot { border-color: #F2B632; }
  .board { width: 100%; height: auto; display: block; }
  .board .n { font-size: 12px; font-weight: 800; fill: #FFE9C7; text-anchor: middle; font-family: var(--font); }
  .board .n.me { fill: #FFFDF7; }
  .hole { outline: none; }
  .hole.can { cursor: pointer; }
  .hole.can:focus-visible ellipse { stroke: #3F7FBF; }
  .msg { margin: 0; text-align: center; font-weight: 800; font-size: 14.5px; }
  .log { margin: 0; text-align: center; font-size: 12.5px; font-weight: 700; color: var(--muted); }
  .note { margin: 0; font-size: 11.5px; font-weight: 600; color: var(--muted); line-height: 1.25; }
</style>
