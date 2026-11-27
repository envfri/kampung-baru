<script lang="ts">
  // Cerdas Cermat Bareng (rumah teman & Panggung alun-alun): soal sama untuk semua, dijawab bersamaan. Server menilai
  // menurut urutan diterima: pertama benar = lonceng +3, benar lainnya +2. Jawaban & "Tahukah kamu?" tampil untuk semua.
  // Penonton melihat hal yang sama tanpa tombol jawab. Hasil: podium.
  import { kancilSVG, petSVG, BELL_SVG } from '@kb/shared';
  import { wearItems } from '../../lib/game.svelte';
  import { BG, moveGame, serverNow, startGame } from '../../lib/bareng.svelte';
  import { reducedMotion } from '../../lib/motion';
  import { sfx } from '../../lib/sfx';
  import Soal from '../kuis/Soal.svelte';
  import Timer from '../kuis/Timer.svelte';
  let { g, me }: { g: any; me: string } = $props();

  const k = $derived(g.kuis);
  const player = $derived(g.players.some((p: any) => p.id === me && !p.left));
  let tick = $state(serverNow());
  $effect(() => { const t = setInterval(() => (tick = serverNow()), 250); return () => clearInterval(t); });
  const lead = $derived(k && k.stage === 'tanya' && tick < k.at);
  const leadSecs = $derived(k ? Math.max(1, Math.ceil((k.at - tick) / 1000)) : 0);
  // jawabanku untuk ronde ini (lokal sampai server membalas)
  let myPick = $state<{ round: number; pick: number } | null>(null);
  const mine = $derived(k?.stage === 'jawab' ? k.picks?.[me]?.pick ?? null : myPick && myPick.round === k?.round ? myPick.pick : null);
  const answered = $derived(!!k && (k.answered?.includes(me) || (myPick?.round === k.round)));
  async function pick(p: number | number[]) {
    if (!k || !player || answered || typeof p !== 'number') return;
    myPick = { round: k.round, pick: p };
    await moveGame(g.id, { pick: p });
  }
  const reveal = $derived(k?.stage === 'jawab' ? { answer: k.answer } : null);
  const others = $derived.by(() => {
    if (k?.stage !== 'jawab') return null;
    const out: Record<number, string[]> = {};
    for (const [id, p] of Object.entries(k.picks ?? {}) as [string, any][]) (out[p.pick] ??= []).push(id === me ? 'kamu' : nameOf(id));
    return out;
  });
  const nameOf = (id: string) => g.players.find((p: any) => p.id === id)?.name ?? 'Teman';
  const ava = (p: any) => (p?.pet ? petSVG({ color: p.pet.color ?? '#F2EEE3', ear: p.pet.ear ?? 'tunas', pattern: p.pet.pattern, eyes: p.pet.eyes, tail: p.pet.tail }, wearItems(p.pet.wear ?? [])) : '');
  // lonceng & suara saat jawaban dibuka
  let rang = -1;
  $effect(() => {
    if (!k || k.stage !== 'jawab' || rang === k.round) return;
    rang = k.round;
    if (k.bell === me) sfx.level(); else if (k.picks?.[me]?.ok) sfx.coin(); else if (k.picks?.[me]) sfx.error(); else sfx.pop();
  });
  const standings = $derived([...g.players].sort((a: any, b: any) => (k?.points?.[b.id] ?? 0) - (k?.points?.[a.id] ?? 0)));
  const res = $derived(g.phase === 'selesai' ? g.results ?? [] : []);
  const myRes = $derived(res.find((r: any) => r.id === me));
  const pod = $derived([res.find((r: any) => r.rank === 2 && r !== res[0]) ?? res[1], res[0], res[2]].filter(Boolean));
  const less = reducedMotion();
  // id dibaca dulu: begitu BG.closed berubah, prop g (sesi dari BarengLayer) langsung jadi null
  function close() { const id = g.id; if (BG.watching === id) BG.watching = null; BG.closed = [...BG.closed, id]; }
</script>

<div class="kb" role="dialog" aria-label="Cerdas Cermat">
  {#if g.phase === 'main' && k}
    <div class="hd">
      <b>Cerdas Cermat</b><span class="rd">Soal {k.round + 1}/{k.total}</span>
      {#if k.stage === 'tanya' && !lead}<Timer deadline={k.until} total={k.until - k.at} now={serverNow} stopped={answered} size={44} />{:else}<span class="tsp"></span>{/if}
    </div>
    <div class="score" role="list" aria-label="Poin pemain">
      {#each standings as p (p.id)}
        {@const bell = k.stage === 'jawab' && k.bell === p.id}
        {@const got = k.stage === 'jawab' ? k.picks?.[p.id] : null}
        <div class="pl" class:me={p.id === me} class:left={p.left} class:bell role="listitem">
          <i class="av">{@html ava(p)}</i>
          <span class="nm">{p.id === me ? 'Kamu' : p.name}</span>
          <b class="pt">{k.points?.[p.id] ?? 0}</b>
          {#if bell}<span class="belli" class:ring={!less} aria-label="pertama benar">{@html BELL_SVG}</span>{/if}
          {#if got}<em class="gain" class:zero={!got.pts}>{got.pts ? `+${got.pts}` : '0'}</em>
          {:else if k.stage === 'tanya' && k.answered?.includes(p.id)}<em class="sudah">sudah</em>{/if}
        </div>
      {/each}
    </div>
    <div class="body">
      {#if lead}
        <div class="lead">
          <div class="host">{@html kancilSVG('netral', { podium: true })}</div>
          <p>Soal {k.round + 1} sebentar lagi…</p><b class="cnt">{leadSecs}</b>
        </div>
      {:else}
        <Soal q={k.q} {reveal} {mine} locked={!player || answered || k.stage !== 'tanya'} onpick={pick} compact {others} />
        {#if k.stage === 'tanya'}
          <p class="st">{!player ? 'Kamu menonton. Ikut menebak dalam hati, ya!' : answered ? 'Jawaban terkirim. Menunggu yang lain…' : 'Cepat! Yang pertama benar membunyikan lonceng (+3).'}</p>
        {:else}
          <div class="rev" class:good={!!k.picks?.[me]?.ok}>
            <div class="bellhost">{@html kancilSVG(k.bell ? 'sorak' : 'hmm', { podium: true, ring: !!k.bell && !less })}</div>
            <div class="rt">
              <b>{k.bell ? `${k.bell === me ? 'Kamu' : nameOf(k.bell)} membunyikan lonceng!` : 'Belum ada yang benar.'}</b>
              <p><b>Tahukah kamu?</b> {k.explain}</p>
            </div>
          </div>
        {/if}
      {/if}
    </div>
    {#if !player}<button class="btn sm stop" onclick={() => (BG.watching = null)}>Berhenti menonton</button>{/if}
  {:else if g.phase === 'selesai'}
    <h2>{myRes?.rank === 1 ? 'Juara Cerdas Cermat!' : myRes ? `Juara ${myRes.rank}` : 'Cerdas Cermat selesai'}</h2>
    <div class="podium">
      {#each pod as r (r.id)}
        {@const p = g.players.find((x: any) => x.id === r.id)}
        <div class="pod r{r.rank}" class:me={r.id === me}>
          <i class="av">{@html ava(p)}</i>
          <span class="nm">{r.id === me ? 'Kamu' : r.name}</span>
          <div class="step"><b>{r.rank}</b><span>{r.score ?? 0} poin</span></div>
        </div>
      {/each}
    </div>
    {#each res.slice(3) as r (r.id)}<p class="extra">{r.rank}. {r.id === me ? 'Kamu' : r.name} · {r.score ?? 0} poin</p>{/each}
    {#if myRes}<p class="gainr">{[myRes.coins ? `+${myRes.coins} koin` : '', myRes.xp ? `+${myRes.xp} XP` : ''].filter(Boolean).join(' · ')}{#if myRes.capped}{' '}Jatah main bareng hari ini sudah habis, tanpa koin.{:else if !myRes.coins && !myRes.xp}Tanpa hadiah kali ini (jawab paling tidak 3 soal).{/if}</p>{/if}
    <div class="btns">
      <button class="btn" onclick={close}>Tutup</button>
      {#if player}<button class="btn hot" disabled={BG.busy} onclick={() => { close(); startGame('kuis'); }}>Main lagi</button>{/if}
    </div>
  {/if}
</div>

<style>
  .kb { position: fixed; z-index: 61; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-b) + 8px); max-height: calc(100dvh - var(--safe-t) - var(--safe-b) - 16px); width: min(560px, calc(100% - 16px)); display: flex; flex-direction: column; gap: 8px; background: linear-gradient(180deg, #FFF8E2, #F6E3B4); border: 3px solid var(--ink); border-radius: 22px; box-shadow: 0 5px 0 var(--ink); padding: 10px 12px; overflow: hidden; }
  .hd { display: flex; align-items: center; gap: 8px; }
  .hd b { font-size: 19px; } .rd { font-weight: 800; font-size: 13.5px; background: var(--ink); color: #F7C548; border-radius: 999px; padding: 1px 9px; margin-right: auto; }
  .tsp { width: 44px; height: 44px; }
  .score { display: flex; gap: 6px; overflow-x: auto; padding: 2px 2px 6px; flex: none; }
  .pl { position: relative; flex: 1 0 74px; max-width: 130px; display: flex; flex-direction: column; align-items: center; background: var(--paper); border: 2.5px solid var(--ink); border-radius: 14px; padding: 4px 4px 3px; }
  .pl.me { background: #E2EEFA; }
  .pl.left { opacity: .5; }
  .pl.bell { background: #FFE08A; box-shadow: 0 0 0 3px #F2B632; }
  .av { width: 34px; height: 36px; display: block; }
  .av :global(svg) { width: 100%; height: 100%; }
  .nm { font-size: 12px; font-weight: 800; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pt { font-size: 18px; line-height: 1; }
  .belli { position: absolute; top: -8px; left: -6px; width: 26px; height: 26px; transform-origin: 50% 10%; }
  .belli :global(svg) { width: 100%; height: 100%; }
  .belli.ring { animation: kz-ring .5s ease-in-out 4; }
  .gain { position: absolute; top: -8px; right: -6px; font-style: normal; font-weight: 900; font-size: 13px; background: #3FA06A; color: #fff; border: 2px solid var(--ink); border-radius: 999px; padding: 0 6px; }
  .gain.zero { background: #9AA0A8; }
  .sudah { position: absolute; top: -8px; right: -6px; font-style: normal; font-weight: 800; font-size: 10.5px; background: var(--ink); color: #fff; border-radius: 999px; padding: 0 6px; }
  .body { flex: 0 1 auto; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding: 6px 2px 2px; }
  .lead { min-height: 260px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
  .lead .host { width: 120px; } .lead .host :global(svg) { width: 100%; height: auto; }
  .lead p { margin: 0; font-weight: 800; font-size: 17px; }
  .cnt { font-size: 54px; line-height: 1; }
  .st { margin: 0; text-align: center; font-size: 13.5px; font-weight: 700; color: var(--muted); }
  .rev { display: flex; gap: 8px; align-items: flex-end; background: #FDE8E3; border: 2.5px solid var(--ink); border-radius: 16px; padding: 6px 10px; }
  .rev.good { background: #E3F5E8; }
  .bellhost { width: 70px; flex: none; } .bellhost :global(svg) { width: 100%; height: auto; }
  .rt { flex: 1; } .rt > b { font-size: 16px; } .rt p { margin: 2px 0 0; font-size: 13.5px; font-weight: 600; line-height: 1.35; } .rt p b { color: #B9800F; }
  .stop { align-self: center; }
  h2 { margin: 6px 0 0; text-align: center; font-size: 24px; }
  .podium { display: flex; align-items: flex-end; justify-content: center; gap: 8px; margin-top: 8px; }
  .pod { display: flex; flex-direction: column; align-items: center; gap: 2px; width: 30%; max-width: 140px; }
  .pod .av { width: 52px; height: 56px; }
  .pod .step { width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding-top: 6px; border: 3px solid var(--ink); border-bottom: 0; border-radius: 12px 12px 0 0; background: #C9D3E0; }
  .pod.r1 .step { height: 110px; background: #F2C94C; }
  .pod.r2 .step { height: 80px; background: #D7DCE3; }
  .pod.r3 .step { height: 60px; background: #E0A66B; }
  .pod.r4 .step { height: 44px; }
  .pod .step b { font-size: 26px; line-height: 1; } .pod .step span { font-size: 12px; font-weight: 800; }
  .pod.me .nm { color: #1E5FA0; }
  .extra { margin: 0; text-align: center; font-weight: 700; }
  .gainr { margin: 0; text-align: center; font-weight: 800; font-size: 16px; }
  .btns { display: flex; gap: 8px; margin-top: 6px; } .btns .btn { flex: 1; min-height: 46px; }
  @keyframes kz-ring { 0%, 100% { transform: rotate(0); } 25% { transform: rotate(-18deg); } 75% { transform: rotate(18deg); } }
  :global(.kc-bell.ring) { transform-origin: 90px 96px; animation: kz-ring .5s ease-in-out 4; }
  @media (prefers-reduced-motion: reduce) { .belli.ring, :global(.kc-bell.ring) { animation: none; } }
  :global(:root.reduce-motion) .belli.ring, :global(:root.reduce-motion .kc-bell.ring) { animation: none; }
  @media (min-width: 900px) { .kb { bottom: calc(var(--safe-b) + 20px); max-height: calc(100dvh - var(--safe-t) - 100px); } }
</style>
