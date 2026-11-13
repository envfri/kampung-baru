<script lang="ts">
  // Papan Catur Kilat 5+3: sisimu di bawah (penonton: Putih di bawah, bisa diputar). Ketuk bidak → titik langkah sah → ketuk tujuan.
  // Langkah terakhir & skak disorot, bidak termakan di samping nama, dua jam (yang berjalan disorot, merah < 30 dtk),
  // pilihan promosi (10 dtk = Menteri), tawar remis, menyerah (konfirmasi), kartu hasil. Semua aturan & jam dari server.
  import { untrack } from 'svelte';
  import {
    petSVG, caturMoves, caturInCheck, caturKing, caturIdx, caturSq, caturPieceInner, CATUR_PIECES, CATUR_VAL,
    type CaturState, type CaturMove,
  } from '@kb/shared';
  import { wearItems } from '../../lib/game.svelte';
  import { BG, caturAct, serverNow, startGame } from '../../lib/bareng.svelte';
  import { sfx } from '../../lib/sfx';
  let { g, me }: { g: any; me: string } = $props();

  const N = 50, W = N * 8;
  const c = $derived(g.catur ?? {});
  const myColor = $derived<'w' | 'b' | null>(me === c.white ? 'w' : me === c.black ? 'b' : null);
  const player = $derived(!!myColor && g.players.some((p: any) => p.id === me && !p.left));
  /** penonton boleh memutar papan */
  let spin = $state(false);
  const flip = $derived(player ? myColor === 'b' : spin);
  const st = $derived<CaturState>({ b: String(c.board ?? '').padEnd(64, '.').split(''), turn: c.turn ?? 'w', cast: c.cast ?? '', ep: c.ep ?? -1, half: c.half ?? 0, full: c.full ?? 1 });
  const legal = $derived(caturMoves(st));
  const done = $derived(g.phase === 'selesai' || !!c.result);
  const myTurn = $derived(player && !done && st.turn === myColor);
  const pOf = (col: 'w' | 'b') => g.players.find((p: any) => p.id === (col === 'w' ? c.white : c.black)) ?? { name: col === 'w' ? 'Putih' : 'Hitam' };
  const bottom = $derived<'w' | 'b'>(flip ? 'b' : 'w');
  const top = $derived<'w' | 'b'>(flip ? 'w' : 'b');
  const ava = (x: any) => (x?.pet ? petSVG({ color: x.pet.color ?? '#F2EEE3', ear: x.pet.ear ?? 'tunas', pattern: x.pet.pattern, eyes: x.pet.eyes, tail: x.pet.tail }, wearItems(x.pet.wear ?? [])) : '');

  /* ---- jam ---- */
  let tick = $state(serverNow());
  $effect(() => { if (done) return; const t = setInterval(() => (tick = serverNow()), 250); return () => clearInterval(t); });
  function clockOf(col: 'w' | 'b') {
    void tick;
    const base = c.clocks?.[col] ?? 0;
    return c.running === col && !done ? Math.max(0, base - Math.max(0, serverNow() - (c.runFrom ?? 0))) : Math.max(0, base);
  }
  const fmt = (ms: number) => { const s = Math.ceil(ms / 1000); return ms < 10_000 && ms > 0 ? `0:0${(ms / 1000).toFixed(1).replace('.', ',')}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const secsTo = (t: number | null | undefined) => { void tick; return t ? Math.max(0, Math.ceil((t - serverNow()) / 1000)) : 0; };

  /* ---- bidak termakan & selisih bahan (dari papan, termasuk promosi) ---- */
  const caps = (col: 'w' | 'b') => {
    const cnt: Record<string, number> = {};
    for (const p of c.captured?.[col] ?? []) cnt[p] = (cnt[p] ?? 0) + 1;
    return 'qrbnp'.split('').map((t) => { const k = col === 'w' ? t : t.toUpperCase(); return { p: k, n: cnt[k] ?? 0 }; }).filter((x) => x.n > 0);
  };
  const lead = $derived.by(() => { let d = 0; for (const p of st.b) if (p !== '.') d += (p === p.toUpperCase() ? 1 : -1) * (CATUR_VAL[p.toLowerCase()] ?? 0); return d; });
  const leadOf = (col: 'w' | 'b') => (col === 'w' ? lead : -lead);

  /* ---- pilih & jalan ---- */
  let sel = $state<number | null>(null);
  let promo = $state<{ from: number; to: number } | null>(null);
  let sending = $state(false);
  let confirmResign = $state(false);
  const dots = $derived(sel === null ? [] : legal.filter((m) => m.from === sel));
  const dotSq = $derived(new Set(dots.map((m) => m.to)));
  $effect(() => { if (!myTurn) { sel = null; promo = null; } });
  async function send(m: { from: number; to: number; promo?: string }) {
    sending = true; sel = null; promo = null;
    sfx.pop();
    await caturAct(g.id, { from: caturSq(m.from), to: caturSq(m.to), ...(m.promo ? { promo: m.promo } : {}) });
    sending = false;
  }
  function tap(i: number) {
    if (!myTurn || sending || promo) return;
    if (sel !== null && dotSq.has(i)) {
      const ms = dots.filter((m) => m.to === i);
      if (ms.some((m: CaturMove) => m.promo)) { promo = { from: sel, to: i }; sfx.tap(); return; }
      send(ms[0]);
      return;
    }
    const p = st.b[i];
    if (p !== '.' && (p === p.toUpperCase() ? 'w' : 'b') === myColor && legal.some((m) => m.from === i)) { sel = sel === i ? null : i; sfx.tap(); return; }
    if (sel !== null) sel = null;
  }
  // promosi: 10 dtk tanpa pilihan = Menteri (jam tetap berjalan)
  $effect(() => {
    if (!promo) return;
    const p = promo, ms = untrack(() => c.promoAutoMs ?? 10_000);
    const t = setTimeout(() => { if (promo === p) send({ ...p, promo: 'q' }); }, ms);
    return () => clearTimeout(t);
  });
  const act = (body: Record<string, unknown>) => { sfx.tap(); return caturAct(g.id, body); };

  /* ---- animasi langkah terakhir (geser, rokade, en passant, promosi) ---- */
  type Anim = { k: number; slides: Map<number, [number, number]>; ms: number; ghosts: { sq: number; p: string; delay: number; dx?: number; dy?: number }[]; pop: number | null };
  let anim = $state<Anim | null>(null);
  let lastAt = untrack(() => g.last?.at ?? 0), animK = 0;
  const xy = (i: number): [number, number] => { const f = i % 8, r = i >> 3; return flip ? [(7 - f) * N, r * N] : [f * N, (7 - r) * N]; };
  $effect(() => {
    const L = g.last;
    untrack(() => {
      if (!L || L.at === lastAt) return;
      lastAt = L.at;
      if (serverNow() - L.at > (L.anim ?? 0) + 800) { anim = null; return; }
      const from = caturIdx(L.from), to = caturIdx(L.to);
      if (from < 0 || to < 0) return;
      const off = (a: number, b: number): [number, number] => { const [x1, y1] = xy(a), [x2, y2] = xy(b); return [x1 - x2, y1 - y2]; };
      const slides = new Map<number, [number, number]>();
      const ghosts: Anim['ghosts'] = [];
      let ms = 220, pop: number | null = null;
      const R = from - (from % 8);
      if (L.flag === 'OO') { slides.set(to, off(from, to)); slides.set(R + 5, off(R + 7, R + 5)); ms = 300; }
      else if (L.flag === 'OOO') { slides.set(to, off(from, to)); slides.set(R + 3, off(R, R + 3)); ms = 300; }
      else if (L.promo) {
        const pawn = st.b[to] === st.b[to].toUpperCase() ? 'P' : 'p';
        const [dx, dy] = off(from, to);
        ghosts.push({ sq: to, p: pawn, delay: 0, dx, dy });
        pop = to;
        if (L.cap) ghosts.push({ sq: to, p: L.cap, delay: 0 });
      } else {
        slides.set(to, off(from, to));
        if (L.flag === 'ep' && L.cap) { ms = 200; ghosts.push({ sq: to + (to > from ? -8 : 8), p: L.cap, delay: 200 }); }
        else if (L.cap) ghosts.push({ sq: to, p: L.cap, delay: 0 });
      }
      anim = { k: ++animK, slides, ms, ghosts, pop };
      if (L.check) setTimeout(() => sfx.error(), ms); else setTimeout(() => sfx.tuk(), ms);
    });
  });

  /* ---- sorotan ---- */
  const lastSq = $derived(g.last ? [caturIdx(g.last.from), caturIdx(g.last.to)] : []);
  const checkSq = $derived(caturInCheck(st) ? caturKing(st.b, st.turn) : -1);
  const mate = $derived(c.result?.reason === 'mat');
  const piecesOnBoard = $derived(st.b.map((p, i) => ({ p, i })).filter((x) => x.p !== '.' && !(promo && x.i === promo.from)));
  const nameOfPiece = (p: string) => CATUR_PIECES[p.toLowerCase()] ?? '';

  /* ---- status & hasil ---- */
  const turnName = $derived(pOf(st.turn).name);
  const offer = $derived(c.drawOffer);
  const offerToMe = $derived(player && offer && offer.by !== me);
  const idleWarn = $derived((void tick, !done && c.idleWarnAt && serverNow() >= c.idleWarnAt));
  const status = $derived.by(() => {
    void tick;
    if (done) return '';
    if (c.firstUntil) {
      const s = secsTo(c.firstUntil);
      if (myTurn) return `Giliranmu · langkah pertama, ${s} dtk lagi`;
      return player ? `Menunggu ${turnName} melangkah pertama · ${s} dtk` : `Kamu menonton · giliran ${turnName}`;
    }
    if (idleWarn) return myTurn ? `Ayo jalan! ${secsTo(c.idleUntil)} dtk lagi atau kalah waktu.` : `${turnName} belum jalan · ${secsTo(c.idleUntil)} dtk lagi`;
    if (offerToMe) return `${pOf(myColor === 'w' ? 'b' : 'w').name} menawarkan remis.`;
    if (!player) return `Kamu menonton · giliran ${turnName}`;
    if (myTurn) return sel !== null ? `Giliranmu · ${nameOfPiece(st.b[sel])} dipilih` : 'Giliranmu · ketuk bidakmu';
    return offer?.by === me ? `Remis ditawarkan · menunggu ${turnName}` : `Menunggu ${turnName}…`;
  });
  const fmtDur = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)} mnt ${s % 60} dtk`; };
  const REASON: Record<string, string> = { mat: 'Skakmat', menyerah: 'Menyerah', waktu: 'Waktu habis', diam: 'Kelamaan diam', pergi: 'Lawan pergi', pat: 'Pat', bidak: 'Bidak kurang', ulang: 'Posisi sama 3×', '50': '50 langkah', sepakat: 'Sepakat', batas: 'Batas waktu', 'waktu-remis': 'Waktu habis' };
  const res = $derived(c.result);
  const loserName = $derived(res?.winner ? pOf(res.winner === 'w' ? 'b' : 'w').name : pOf(st.turn).name);
  const whyLine = $derived.by(() => {
    if (!res) return '';
    const mover = g.last?.san ? (/^[KQRBN]/.test(g.last.san) ? nameOfPiece(g.last.san[0]) : g.last.san.startsWith('O-') ? 'Raja' : 'Pion') : '';
    const t: Record<string, string> = {
      mat: `Skakmat dengan ${mover}`, menyerah: `${loserName} menyerah`, waktu: `Waktu ${loserName} habis`, diam: `${loserName} kelamaan diam`, pergi: `${loserName} pergi`,
      pat: `Pat: ${pOf(st.turn).name} tidak diskak, tapi tidak punya langkah sah`, bidak: 'Bidak tidak cukup untuk skakmat', ulang: 'Posisi yang sama 3 kali',
      '50': '50 langkah tanpa makan atau gerak pion', sepakat: 'Sepakat remis', batas: 'Batas lama permainan tercapai', 'waktu-remis': `Waktu ${loserName} habis, tapi lawan tidak bisa skakmat`,
    };
    return `${t[res.reason] ?? ''} · ${Math.ceil((c.plies ?? 0) / 2)} langkah · ${fmtDur((g.endedAt || serverNow()) - (c.startedAt ?? g.startedAt))}`;
  });
  const score = $derived(!res ? '' : res.winner === 'w' ? '1 – 0' : res.winner === 'b' ? '0 – 1' : '½ – ½');
  const myRes = $derived(g.results?.find((r: any) => r.id === me));
  const headline = $derived(!res ? '' : !res.winner ? 'Remis!' : player ? (res.winner === myColor ? 'Kamu menang!' : 'Kamu kalah') : `${pOf(res.winner).name} menang!`);
  /** kartu hasil muncul setelah animasi langkah terakhir (dan cap Skakmat) selesai */
  const showResult = $derived((void tick, done && !!res && serverNow() >= (g.last?.at ?? 0) + (g.last?.anim ?? 0) + (mate ? 1300 : 400)));
  $effect(() => { if (done) { const t = setInterval(() => (tick = serverNow()), 300); setTimeout(() => clearInterval(t), 3000); return () => clearInterval(t); } });
  $effect(() => { if (showResult && player && res?.winner === myColor) untrack(() => sfx.level()); });
  /** pemenang di atas (remis: Putih dulu) */
  const resOrder = $derived(res?.winner === 'b' ? [c.black, c.white] : [c.white, c.black]);
  const sideText = (id: string) => { const col = id === c.white ? 'w' : 'b'; return `${col === 'w' ? 'Putih' : 'Hitam'} · ${!res?.winner ? 'remis' : res.winner === col ? 'menang' : 'kalah'}`; };
  function close() { if (player) BG.closed = [...BG.closed, g.id]; else BG.watching = null; }
  function again() { BG.closed = [...BG.closed, g.id]; startGame('catur'); }

  /* ---- daftar langkah (desktop): figurin + petak ---- */
  const rows = $derived.by(() => {
    const mv: string[] = c.moves ?? [];
    const first = Math.max(0, (c.plies ?? mv.length) - mv.length);
    const out: { n: number; w?: string; b?: string; wl?: boolean; bl?: boolean }[] = [];
    for (let k = 0; k < mv.length; k++) {
      const ply = first + k, n = Math.floor(ply / 2) + 1;
      if (ply % 2 === 0 || !out.length) out.push({ n });
      const row = out[out.length - 1];
      if (ply % 2 === 0) { row.w = mv[k]; row.wl = k === mv.length - 1; } else { row.b = mv[k]; row.bl = k === mv.length - 1; }
    }
    return out;
  });
  const fig = (san: string | undefined, col: 'w' | 'b') => {
    if (!san) return '';
    const m = /^([KQRBN])(.*)$/.exec(san);
    return m ? `<svg viewBox="0 0 45 45" aria-hidden="true">${caturPieceInner(col === 'w' ? m[1] : m[1].toLowerCase())}</svg>${m[2]}` : san;
  };
  let movesEl = $state<HTMLElement | null>(null);
  $effect(() => { void rows.length; if (movesEl) movesEl.scrollTop = movesEl.scrollHeight; });
  const CLK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8.5" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M12 8.5V13l3 2M9.5 2.8h5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';
  /** tinggi kartu hasil di HP (papan diperkecil supaya keduanya muat di antara HUD & dok) */
  let resH = $state(0);
</script>

{#snippet row(col: 'w' | 'b', pos: string)}
  {@const p = pOf(col)}
  {@const ms = clockOf(col)}
  {@const on = c.running === col && !done}
  <div class="pl {pos}">
    <span class="av">{@html ava(p)}</span>
    <span class="nm"><b><span class="n">{p.name}{p.id === me ? ' (kamu)' : ''}</span></b>
      <span class="caps"><span class="side {col}">{col === 'w' ? 'Putih' : 'Hitam'}</span>{#each caps(col) as x (x.p)}<span class="cp"><svg viewBox="0 0 45 45" aria-hidden="true">{@html caturPieceInner(x.p)}</svg>{#if x.n > 1}<u>{x.n}</u>{/if}</span>{/each}{#if leadOf(col) > 0}<em>+{leadOf(col)}</em>{/if}</span>
    </span>
    <span class="clock" class:on class:low={on && ms < 30_000} role="timer" aria-label="Jam {p.name}: {fmt(ms)}">{@html CLK}{fmt(ms)}</span>
  </div>
{/snippet}

{#snippet board()}
  <div class="frame">
    <svg viewBox="0 0 {W} {W}" class="cboard" role="group" aria-label="Papan catur{flip ? ', Hitam di bawah' : ''}">
      <defs><radialGradient id="cchk"><stop offset="0" stop-color="#FF4A2E" stop-opacity=".95" /><stop offset=".55" stop-color="#E0583F" stop-opacity=".7" /><stop offset="1" stop-color="#E0583F" stop-opacity="0" /></radialGradient></defs>
      {#each Array(64) as _, i}
        {@const q = xy(i)}
        {@const dark = ((i % 8) + (i >> 3)) % 2 === 0}
        <rect x={q[0]} y={q[1]} width={N} height={N} fill={dark ? '#C49563' : '#F2DFB6'} />
        {#if lastSq.includes(i)}<rect x={q[0]} y={q[1]} width={N} height={N} fill="#F7D35B" opacity={dark ? 0.62 : 0.55} />{/if}
        {#if sel === i}<rect x={q[0]} y={q[1]} width={N} height={N} fill="#F2B632" opacity=".55" /><rect x={q[0] + 2} y={q[1] + 2} width={N - 4} height={N - 4} rx="3" fill="none" stroke="#2B2F4A" stroke-width="3" />{/if}
        {#if checkSq === i}<rect x={q[0]} y={q[1]} width={N} height={N} fill="url(#cchk)" class="chk" />{/if}
      {/each}
      {#each Array(8) as _, k}
        {@const fi = flip ? 7 - k : k}
        {@const ri = flip ? k : 7 - k}
        <text x={k * N + N - 3} y={W - 3} text-anchor="end" class="co" fill={(fi + (flip ? 7 : 0)) % 2 === 0 ? '#FFF1D6' : '#9C6B3D'}>{'abcdefgh'[fi]}</text>
        <text x="3" y={k * N + 11} class="co" fill={((flip ? 7 : 0) + ri) % 2 === 0 ? '#FFF1D6' : '#9C6B3D'}>{ri + 1}</text>
      {/each}
      {#key anim?.k ?? 0}
        {#each piecesOnBoard as x (x.i)}
          {@const q = xy(x.i)}
          {@const sl = anim?.slides.get(x.i)}
          <g class="pc" class:mv={!!sl} class:pop={anim?.pop === x.i} style={sl ? `--dx:${sl[0]}px;--dy:${sl[1]}px;--ms:${anim?.ms}ms` : ''}>
            <svg x={q[0] + 3} y={q[1] + 1.8} width={N - 6} height={N - 6} viewBox="0 0 45 45">{@html caturPieceInner(x.p)}</svg>
          </g>
        {/each}
        {#each anim?.ghosts ?? [] as gh}
          {@const q = xy(gh.sq)}
          <g class="ghost" class:mv={gh.dx !== undefined} style="--dx:{gh.dx ?? 0}px;--dy:{gh.dy ?? 0}px;--ms:{anim?.ms}ms;--delay:{gh.delay}ms">
            <svg x={q[0] + 3} y={q[1] + 1.8} width={N - 6} height={N - 6} viewBox="0 0 45 45">{@html caturPieceInner(gh.p)}</svg>
          </g>
        {/each}
        {#if anim?.pop != null}{@const q = xy(anim.pop)}<g class="spark" style="transform-origin:{q[0] + N / 2}px {q[1] + N / 2}px">{#each [0, 60, 120, 180, 240, 300] as a}<circle cx={q[0] + N / 2 + Math.cos((a * Math.PI) / 180) * 21} cy={q[1] + N / 2 + Math.sin((a * Math.PI) / 180) * 21} r="3" fill="#F7D35B" stroke="#2B2F4A" stroke-width="1" />{/each}</g>{/if}
      {/key}
      {#if promo}
        {@const q = xy(promo.to)}
        <rect x={q[0]} y={q[1]} width={N} height={N} fill="#F7D35B" opacity=".6" />
        <svg x={q[0] + 3} y={q[1] + 1.8} width={N - 6} height={N - 6} viewBox="0 0 45 45" opacity=".5">{@html caturPieceInner(myColor === 'w' ? 'P' : 'p')}</svg>
        <circle cx={q[0] + N * 0.8} cy={q[1] + N * 0.2} r={N * 0.17} fill="#2B2F4A" /><text x={q[0] + N * 0.8} y={q[1] + N * 0.28} text-anchor="middle" class="qm">?</text>
      {/if}
      {#each dots as m (m.to + (m.promo ?? ''))}
        {@const q = xy(m.to)}
        {#if st.b[m.to] !== '.' || m.flag === 'ep'}<circle cx={q[0] + N / 2} cy={q[1] + N / 2} r={N * 0.42} fill="none" stroke="#2B2F4A" stroke-opacity=".42" stroke-width={N * 0.09} />
        {:else}<circle cx={q[0] + N / 2} cy={q[1] + N / 2} r={N * 0.15} fill="#2B2F4A" fill-opacity=".38" />{/if}
      {/each}
      {#if myTurn && !promo}
        {#each Array(64) as _, i}
          {@const can = dotSq.has(i) || legal.some((m) => m.from === i)}
          {#if can}
            {@const q = xy(i)}
            <rect x={q[0]} y={q[1]} width={N} height={N} fill="transparent" class="hit" role="button" tabindex="0" aria-label="{caturSq(i)}{st.b[i] !== '.' ? `, ${nameOfPiece(st.b[i])}` : ''}{dotSq.has(i) ? ', tujuan' : ''}"
              onclick={() => tap(i)} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(i); } }} />
          {/if}
        {/each}
      {/if}
      {#if mate && done}<g class="stamp"><rect x={W / 2 - 112} y={W / 2 - 34} width="224" height="68" rx="16" fill="#E0583F" stroke="#2B2F4A" stroke-width="4" /><text x={W / 2} y={W / 2 + 13} text-anchor="middle" class="st">Skakmat!</text></g>{/if}
    </svg>
  </div>
{/snippet}

<div class="cwrap" class:fin={done && showResult} style="--resh:{resH}px">
  <div class="cw" class:done={done && showResult} class:picking={!!promo} role="dialog" aria-label="Papan catur{player ? '' : ' (menonton)'}">
    {#if done && showResult}
      <div class="vs"><i>{@html ava(pOf('w'))}</i><span class="n">{pOf('w').name}</span><span class="sc">{score} · {REASON[res.reason] ?? ''}</span><span class="n">{pOf('b').name}</span><i>{@html ava(pOf('b'))}</i></div>
    {:else}
      {@render row(top, 'top')}
    {/if}
    <div class="moves" bind:this={movesEl}>
        <h4>{c.plies ? `Langkah · ${c.plies} paruh langkah` : 'Belum ada langkah'}</h4>
        {#each rows as r (r.n)}<div class="mv"><i>{r.n}.</i><span class:last={r.wl}>{@html fig(r.w, 'w')}</span><span class:last={r.bl}>{@html fig(r.b, 'b')}</span></div>{/each}
    </div>
    {@render board()}
    {#if !(done && showResult)}
      {@render row(bottom, 'bot')}
      {#if promo}
        <div class="promo" role="group" aria-label="Pilih bidak baru">
          <b>Pion naik pangkat! Pilih bidak baru:</b>
          <div class="opts">
            {#each ['q', 'r', 'b', 'n'] as k, i}<button class="btn opt" class:hot={i === 0} disabled={sending} onclick={() => promo && send({ ...promo, promo: k })}><svg viewBox="0 0 45 45" aria-hidden="true">{@html caturPieceInner(myColor === 'w' ? k.toUpperCase() : k)}</svg>{CATUR_PIECES[k]}</button>{/each}
          </div>
          <small>Jam tetap jalan; {Math.round((c.promoAutoMs ?? 10_000) / 1000)} dtk tanpa pilihan = Menteri.</small>
        </div>
      {:else}
        <p class="stat" class:chk={checkSq >= 0 && !done} class:warn={idleWarn}>{#if checkSq >= 0 && !done}<span class="tag">Skak!</span>{/if}<span>{done ? 'Permainan selesai.' : status}</span></p>
        {#if done}
          <!-- kartu hasil menyusul setelah animasi -->
        {:else if !player}
          <div class="ctl"><button class="btn sm" onclick={() => { sfx.tap(); spin = !spin; }}>Putar papan</button><button class="btn sm" onclick={() => (BG.watching = null)}>Berhenti menonton</button></div>
        {:else if confirmResign}
          <div class="ctl"><button class="btn sm" onclick={() => (confirmResign = false)}>Batal</button><button class="btn sm danger" onclick={() => { confirmResign = false; act({ resign: true }); }}>Ya, menyerah</button></div>
        {:else if offerToMe}
          <div class="ctl"><button class="btn sm" onclick={() => act({ draw: 'decline' })}>Tolak remis</button><button class="btn sm hot" onclick={() => act({ draw: 'accept' })}>Terima remis</button></div>
        {:else}
          <div class="ctl">
            <button class="btn sm" disabled={!!offer || (c.plies ?? 0) < (c.drawFrom ?? 20) || (c.offersLeft?.[me] ?? 0) <= 0} title={(c.plies ?? 0) < (c.drawFrom ?? 20) ? `Boleh setelah ${c.drawFrom ?? 20} paruh langkah` : ''} onclick={() => act({ draw: 'offer' })}>{offer?.by === me ? 'Remis ditawarkan' : 'Tawar remis'}</button>
            <button class="btn sm" onclick={() => { sfx.tap(); confirmResign = true; }}>Menyerah</button>
          </div>
        {/if}
      {/if}
    {/if}
    {#if done && showResult}
      <div class="res" role="dialog" aria-label="Hasil Catur" bind:clientHeight={resH}>
        <h2>{headline}{#if !res.winner}<span class="chip">{REASON[res.reason]}</span>{/if}</h2>
        <p class="why">{whyLine}</p>
        {#each resOrder as id (id)}
          {@const p = g.players.find((x: any) => x.id === id) ?? {}}
          {@const r = g.results?.find((x: any) => x.id === id)}
          <div class="rk" class:me={id === me}><b>{r?.rank ?? (res.winner ? (res.winner === (id === c.white ? 'w' : 'b') ? 1 : 2) : 1)}</b><i>{@html ava(p)}</i><span class="n">{p.name}{id === me ? ' (kamu)' : ''}</span><em>{sideText(id)}</em></div>
        {/each}
        {#if player}
          {#if !g.results}<p class="gain muted">Menghitung hadiah…</p>
          {:else if myRes?.short}<p class="small">Kurang dari {c.minPlies ?? 20} paruh langkah: tanpa hadiah & tidak memakai jatah main bareng.</p>
          {:else if myRes?.capped}<p class="small">Jatah main bareng hari ini sudah habis, jadi tanpa koin.</p>
          {:else if myRes?.coins || myRes?.xp}<p class="gain">+{myRes.coins} koin · +{myRes.xp} XP</p>
          {:else}<p class="small">Tanpa hadiah kali ini.</p>{/if}
          <p class="small">Main lagi = warna ditukar.</p>
        {/if}
        <div class="btns">
          <button class="btn" onclick={close}>Tutup</button>
          {#if player}<button class="btn hot" disabled={BG.busy} onclick={again}>Main lagi</button>{/if}
        </div>
      </div>
    {/if}
  </div>
</div>


<style>
  /* HP: kartu papan di antara HUD dan dok (tombol aksi & kartu rumah teman disembunyikan selama main) */
  .cwrap { position: fixed; z-index: 60; left: 0; right: 0; top: calc(var(--safe-t) + 92px + var(--hud-x, 0px)); bottom: calc(var(--safe-b) + 84px); display: flex; align-items: center; justify-content: center; pointer-events: none; }
  .cw { pointer-events: auto; width: min(420px, calc(100% - 16px)); max-height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; background: var(--paper); border: 3px solid var(--ink); border-radius: 20px; box-shadow: 0 5px 0 var(--ink); padding: 8px 10px; --bh: calc(100dvh - var(--safe-t) - var(--safe-b) - var(--hud-x, 0px) - 176px - 214px); }
  /* pilihan promosi lebih tinggi dari status + tombol: papan sedikit mengecil */
  .cw.picking { --bh: calc(100dvh - var(--safe-t) - var(--safe-b) - var(--hud-x, 0px) - 176px - 300px); }
  .pl { display: flex; align-items: center; gap: 8px; min-height: 40px; }
  .av { width: 34px; height: 36px; flex: none; }
  .av :global(svg), .vs i :global(svg), .rk i :global(svg) { width: 100%; height: 100%; }
  .nm { display: flex; flex-direction: column; min-width: 0; flex: 1; gap: 1px; }
  .nm b { font-size: 15px; font-weight: 800; display: flex; min-width: 0; }
  .n { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .side { flex: none; font-size: 11px; font-weight: 800; border: 2px solid var(--ink); border-radius: 999px; padding: 0 7px; background: #FFF6E2; line-height: 1.35; margin-right: 5px; }
  .side.b { background: #3A3F5E; color: #FFFDF7; }
  .caps { display: flex; align-items: center; min-height: 17px; flex-wrap: wrap; row-gap: 2px; }
  .cp { display: inline-flex; align-items: flex-end; margin-right: 1px; }
  .cp svg { width: 17px; height: 17px; flex: none; }
  .cp u { text-decoration: none; font-size: 10.5px; font-weight: 800; color: var(--muted); margin: 0 2px 0 -3px; line-height: 1; }
  .caps em { font-style: normal; font-size: 12px; font-weight: 800; color: var(--muted); margin-left: 6px; }
  .clock { margin-left: auto; flex: none; font-size: 19px; font-weight: 800; min-width: 80px; justify-content: center; padding: 1px 9px; border: 2.5px solid var(--ink); border-radius: 12px; background: #EFEADC; color: #7D8296; font-variant-numeric: tabular-nums; display: flex; align-items: center; gap: 4px; }
  .clock :global(svg) { width: 15px; height: 15px; flex: none; }
  .clock.on { background: var(--coin); color: var(--ink); box-shadow: 0 3px 0 var(--ink); }
  .clock.low { background: #E0583F; color: #FFFDF7; box-shadow: 0 3px 0 var(--ink); }
  .frame { position: relative; align-self: center; width: min(100%, var(--bh)); min-width: 160px; background: #8A5A36; border: 2.5px solid var(--ink); border-radius: 11px; padding: 5px; box-shadow: inset 0 0 0 2px #A8743F; }
  .cboard { display: block; width: 100%; height: auto; border-radius: 3px; font-family: var(--font); touch-action: manipulation; }
  .co { font-size: 10px; font-weight: 800; pointer-events: none; }
  .qm { font-size: 12px; font-weight: 800; fill: #FFE08A; font-family: var(--font); }
  .hit { cursor: pointer; outline: none; }
  .hit:focus-visible { stroke: #3F7FBF; stroke-width: 4; }
  .pc, .ghost { pointer-events: none; }
  .pc.mv { animation: slide var(--ms) cubic-bezier(.3, .8, .4, 1); }
  .pc.pop { animation: morph .13s ease-out .22s both; transform-box: fill-box; transform-origin: center; }
  .ghost { animation: fade .1s linear var(--delay, 0ms) forwards; }
  .ghost.mv { animation: slide .22s cubic-bezier(.3, .8, .4, 1), fade .13s linear .22s forwards; }
  .spark { animation: spark .5s ease-out .2s both; pointer-events: none; }
  .chk { animation: chk 1s ease-in-out infinite alternate; }
  .stamp { animation: stamp 1.2s ease-out forwards; transform-box: fill-box; transform-origin: center; pointer-events: none; }
  .st { font-size: 40px; font-weight: 800; fill: #FFFDF7; font-family: var(--font); }
  @keyframes slide { from { transform: translate(var(--dx), var(--dy)); } to { transform: none; } }
  @keyframes fade { to { opacity: 0; } }
  @keyframes morph { from { transform: scale(.4); opacity: 0; } to { transform: none; opacity: 1; } }
  @keyframes spark { from { opacity: 1; transform: scale(.6); } to { opacity: 0; transform: scale(1.4); } }
  @keyframes chk { from { opacity: .65; } to { opacity: 1; } }
  @keyframes stamp { 0% { transform: scale(2); opacity: 0; } 18% { transform: scale(1); opacity: 1; } 75% { transform: scale(1); opacity: 1; } 100% { transform: scale(.4) translateY(-300px); opacity: 0; } }
  .stat { margin: 0; min-height: 30px; background: var(--soft); border-radius: 12px; padding: 4px 10px; font-size: 14px; font-weight: 800; display: flex; align-items: center; gap: 6px; line-height: 1.2; }
  .stat.chk { background: #FFE0D6; color: #A8321C; }
  .stat.warn { background: #FFE0D6; color: #A8321C; }
  .stat .tag { flex: none; font-size: 11.5px; font-weight: 800; background: #E0583F; color: #fff; border-radius: 999px; padding: 2px 8px 1px; line-height: 1.35; }
  .ctl { display: flex; gap: 8px; }
  .ctl .btn { flex: 1; }
  .moves { display: none; }
  .promo { display: flex; flex-direction: column; gap: 6px; background: #FFF4D6; border: 2.5px solid var(--ink); border-radius: 14px; padding: 8px; }
  .promo b { font-size: 15px; font-weight: 800; }
  .opts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .opt { flex-direction: column; gap: 0; padding: 4px 2px 6px; min-height: 0; font-size: 13px; border-radius: 12px; }
  .opt svg { width: 40px; height: 40px; }
  .promo small { font-size: 12px; font-weight: 700; color: var(--muted); }
  /* selesai (HP): papan mengecil di bawah HUD, kartu hasil di bawahnya (tidak saling menutupi) */
  .cwrap.fin { align-items: flex-start; bottom: calc(var(--safe-b) + 92px + var(--resh, 0px)); }
  .cw.done { width: min(318px, calc(100% - 16px)); padding: 8px; gap: 6px; --bh: calc(100dvh - var(--safe-t) - var(--safe-b) - var(--hud-x, 0px) - 92px - 92px - var(--resh, 300px) - 74px); }
  .cw.done .frame { min-width: 0; width: min(100%, max(96px, var(--bh))); }
  .vs { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 800; min-height: 34px; }
  .vs i { width: 28px; height: 30px; display: inline-block; flex: none; }
  .vs .n { flex: 0 1 auto; }
  .vs .sc { margin: 0 auto; font-size: 14px; background: var(--ink); color: #FFE08A; border-radius: 999px; padding: 2px 10px; line-height: 1.4; text-align: center; }
  .res { position: fixed; z-index: 70; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-b) + 92px); width: min(400px, calc(100% - 20px)); display: flex; flex-direction: column; gap: 6px; background: var(--paper); border: 3px solid var(--ink); border-radius: 20px; box-shadow: 0 5px 0 var(--ink); padding: 10px 14px; animation: pop .25s ease-out; }
  .res h2 { margin: 0; font-size: 24px; font-weight: 800; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .chip { font-size: 13px; font-weight: 800; background: #3F7FBF; color: #fff; border-radius: 999px; padding: 2px 10px 1px; line-height: 1.35; }
  .why { margin: 0; font-size: 13.5px; font-weight: 700; color: var(--muted); }
  .rk { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; min-height: 32px; }
  .rk b { width: 16px; flex: none; }
  .rk i { width: 28px; height: 30px; display: inline-block; flex: none; }
  .rk em { margin-left: auto; font-style: normal; font-weight: 800; flex: none; }
  .rk.me { color: #2A6FB0; }
  .gain { margin: 0; font-weight: 800; font-size: 16px; }
  .small { margin: 0; font-size: 12.5px; font-weight: 600; color: var(--muted); }
  .btns { display: flex; gap: 8px; }
  .btns .btn { flex: 1; min-height: 42px; }
  @media (prefers-reduced-motion: reduce) { .pc.mv, .pc.pop, .ghost, .ghost.mv, .spark, .chk, .stamp { animation: none; } .ghost { opacity: 0; } .stamp { opacity: 0; } }
  /* desktop: papan di kiri setinggi layar, panel kanan berisi pemain, daftar langkah, status & tombol (selesai: hasil) */
  @media (min-width: 900px) and (min-height: 520px) {
    .cwrap, .cwrap.fin { top: calc(var(--safe-t) + 84px); bottom: calc(var(--safe-b) + 88px); align-items: center; }
    .cw, .cw.done { --bs: min(calc(100dvh - var(--safe-t) - var(--safe-b) - 200px), calc(100vw - 460px), 640px); width: auto; display: grid; grid-template-columns: var(--bs) 316px; grid-template-rows: auto minmax(0, 1fr) auto auto auto; gap: 10px 18px; padding: 14px 18px; border-radius: 24px; overflow: visible; }
    .cw .frame, .cw.done .frame { grid-column: 1; grid-row: 1 / -1; align-self: center; width: var(--bs); padding: 7px; }
    .cw .pl.top, .cw .vs { grid-column: 2; grid-row: 1; }
    .cw .moves { grid-column: 2; grid-row: 2; }
    .cw .pl.bot { grid-column: 2; grid-row: 3; }
    .cw .stat, .cw .promo { grid-column: 2; grid-row: 4; }
    .cw .ctl { grid-column: 2; grid-row: 5; }
    .pl { display: grid; grid-template-columns: 46px minmax(0, 1fr) auto; grid-template-rows: auto auto; gap: 2px 10px; align-items: center; }
    .av { width: 46px; height: 48px; grid-row: 1 / 3; }
    .nm { display: contents; }
    .nm b { font-size: 18px; grid-column: 2; grid-row: 1; }
    .caps { grid-column: 2 / 4; grid-row: 2; }
    .pl .clock { grid-column: 3; grid-row: 1; }
    .side { font-size: 12.5px; }
    .clock { font-size: 26px; min-width: 104px; border-radius: 14px; padding: 2px 10px; }
    .clock :global(svg) { width: 19px; height: 19px; }
    .cp svg { width: 20px; height: 20px; }
    .moves { display: flex; flex-direction: column; min-height: 120px; background: #FFF8E8; border: 2px solid #E3D6B8; border-radius: 14px; padding: 6px 8px; overflow-y: auto; scrollbar-width: thin; }
    .moves h4 { margin: 0 0 2px; font-size: 13px; font-weight: 800; color: var(--muted); }
    .mv { display: grid; grid-template-columns: 34px 1fr 1fr; align-items: center; font-size: 15px; font-weight: 700; min-height: 25px; font-variant-numeric: tabular-nums; }
    .mv i { font-style: normal; color: #8A8FA3; font-weight: 800; font-size: 13px; }
    .mv span { display: inline-flex; align-items: center; gap: 1px; padding: 2px 7px 2px 4px; min-height: 25px; border-radius: 7px; justify-self: start; white-space: nowrap; }
    .mv span :global(svg) { width: 19px; height: 19px; flex: none; }
    .mv span.last { background: #F7D35B; }
    .stat { font-size: 15.5px; padding: 8px 12px; }
    .ctl .btn { min-height: 44px; }
    .opt svg { width: 46px; height: 46px; }
    .opt { font-size: 14px; }
    .vs { align-self: start; font-size: 16px; }
    /* hasil menggantikan baris pemain bawah, status & tombol di panel kanan */
    .res { position: static; grid-column: 2; grid-row: 3 / -1; align-self: end; transform: none; width: auto; border-radius: 18px; box-shadow: 0 4px 0 var(--ink); padding: 12px 14px; gap: 8px; }
    .res h2 { font-size: 26px; }
  }
</style>
