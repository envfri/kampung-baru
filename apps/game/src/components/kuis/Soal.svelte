<script lang="ts">
  // Satu soal kuis dalam 7 bentuk, semuanya cukup diketuk (tanpa seret), tombol besar:
  //  pilihan / gambar / peribahasa / hitung = 4 tombol (2×2 di HP); benarsalah = 2 tombol besar;
  //  urutkan = ketuk butir sesuai urutan (nomor), Batal satu / Ulang, lalu Kirim;
  //  cocokkan = ketuk kiri lalu kanan (pasangan berwarna + huruf), ketuk lagi untuk melepas, lalu Kirim.
  // reveal = kunci dari server (indeks tampil) SESUDAH menjawab; mine = jawaban sendiri.
  import { KUIS_CATEGORIES, KUIS_LEVELS, KUIS_TYPES, kuisImageSVG } from '@kb/shared';
  import { sfx } from '../../lib/sfx';
  let { q, reveal = null, mine = null, locked = false, onpick, compact = false, others = null }: {
    q: any; reveal?: any; mine?: any; locked?: boolean; onpick?: (p: number | number[]) => void; compact?: boolean;
    /** Bareng: siapa memilih apa (tampil saat jawaban dibuka) */
    others?: Record<number, string[]> | null;
  } = $props();

  const cat = $derived((KUIS_CATEGORIES as any)[q.cat] ?? { name: q.cat, color: '#5F6478' });
  const done = $derived(!!reveal);
  const isOpt = $derived(!!q.options);
  // urutkan
  let seq = $state<number[]>([]);
  // cocokkan: kiri → kanan (indeks tampil)
  let pairs = $state<Record<number, number>>({});
  let selL = $state<number | null>(null), selR = $state<number | null>(null);
  $effect(() => { void q.id; void q.q; seq = []; pairs = {}; selL = null; selR = null; });
  const PAIR = ['#FFD36B', '#9FD0E8', '#BFEBCB', '#F8C9BE', '#D9C7F2'];
  const LET = ['A', 'B', 'C', 'D', 'E'];
  const pairIdx = (l: number) => Object.keys(pairs).map(Number).sort((a, b) => a - b).indexOf(l);
  const leftOfRight = (r: number) => { const e = Object.entries(pairs).find(([, v]) => v === r); return e ? Number(e[0]) : null; };

  function pick(i: number) { if (locked || done) return; sfx.tap(); onpick?.(i); }
  function tapItem(i: number) {
    if (locked || done) return;
    const at = seq.indexOf(i);
    if (at >= 0) { if (at === seq.length - 1) { seq = seq.slice(0, -1); sfx.pop(); } return; }
    seq = [...seq, i]; sfx.tap();
  }
  function tapLeft(l: number) {
    if (locked || done) return;
    if (pairs[l] !== undefined) { const { [l]: _, ...rest } = pairs; pairs = rest; selL = null; sfx.pop(); return; }
    if (selR !== null) { pairs = { ...pairs, [l]: selR }; selR = null; selL = null; sfx.tap(); return; }
    selL = selL === l ? null : l; sfx.tap();
  }
  function tapRight(r: number) {
    if (locked || done) return;
    const owner = leftOfRight(r);
    if (owner !== null) { const { [owner]: _, ...rest } = pairs; pairs = rest; selR = null; sfx.pop(); return; }
    if (selL !== null) { pairs = { ...pairs, [selL]: r }; selL = null; selR = null; sfx.tap(); return; }
    selR = selR === r ? null : r; sfx.tap();
  }
  const seqFull = $derived(q.items && seq.length === q.items.length);
  const pairsFull = $derived(q.left && Object.keys(pairs).length === q.left.length);
  function kirim() {
    if (locked || done) return;
    if (q.type === 'urutkan' && seqFull) { sfx.tap(); onpick?.([...seq]); }
    if (q.type === 'cocokkan' && pairsFull) { sfx.tap(); onpick?.(q.left.map((_: string, l: number) => pairs[l])); }
  }
  // tampilan sesudah menjawab
  const optState = (i: number) => (!done ? (mine === i ? 'sel' : '') : i === reveal.answer ? 'ok' : mine === i ? 'no' : 'dim');
  const myOrder = $derived(Array.isArray(mine) && q.type === 'urutkan' ? mine : seq);
  const myPairs = $derived(Array.isArray(mine) && q.type === 'cocokkan' ? Object.fromEntries(mine.map((r: number, l: number) => [l, r])) : pairs);
  // peribahasa: kalimat dengan bagian kosong yang disorot
  const parts = $derived(q.type === 'peribahasa' ? String(q.q).split('___') : null);
  const blankWord = $derived(done && reveal?.answer !== undefined ? q.options[reveal.answer] : null);
</script>

<div class="soal t-{q.type}" class:compact>
  <div class="meta">
    <span class="cat" style="--c:{cat.color}">{cat.name}</span>
    <span class="lvl" title="Tingkat {KUIS_LEVELS[q.level] ?? ''}">{'★'.repeat(q.level)}<i>{'★'.repeat(3 - q.level)}</i><span class="sr">{KUIS_LEVELS[q.level] ?? ''}</span></span>
    <span class="hint">{(KUIS_TYPES as any)[q.type]?.name}</span>
  </div>

  {#if q.type === 'gambar' && q.image}<div class="pic">{@html kuisImageSVG(q.image, 'Gambar soal tebak gambar')}</div>{/if}

  {#if parts}
    <p class="q peri">{parts[0]}<span class="blank" class:filled={!!blankWord}>{blankWord ?? '?'}</span>{parts.slice(1).join('___')}</p>
  {:else}
    <p class="q" class:big={q.type === 'hitung'}>{q.q}</p>
  {/if}

  {#if q.type === 'benarsalah'}
    <div class="bs">
      {#each q.options as o, i}
        <button class="opt {optState(i)} {i === 0 ? 'yes' : 'nope'}" disabled={locked && !done} onclick={() => pick(i)} aria-pressed={mine === i}>
          <span class="ic" aria-hidden="true">{i === 0 ? '✓' : '✗'}</span>{o}
          {#if done && i === reveal.answer}<span class="tag ok">Jawaban benar</span>{:else if done && mine === i}<span class="tag no">Pilihanmu</span>{/if}
        </button>
      {/each}
    </div>
  {:else if isOpt}
    <div class="grid" class:long={q.options.some((o: string) => o.length > 22)}>
      {#each q.options as o, i}
        <button class="opt {optState(i)}" disabled={locked && !done} onclick={() => pick(i)} aria-pressed={mine === i}>
          <span class="k" aria-hidden="true">{LET[i]}</span><span class="tx">{o}</span>
          {#if done && i === reveal.answer}<span class="mk" aria-label="jawaban benar">✓</span>{:else if done && mine === i}<span class="mk" aria-label="pilihanmu, belum tepat">✗</span>{/if}
          {#if others?.[i]?.length}<span class="who">{others[i].join(', ')}</span>{/if}
        </button>
      {/each}
    </div>
  {:else if q.type === 'urutkan'}
    {#if !done}
      <p class="tip">Ketuk butir dari yang <b>pertama</b>. Ketuk nomor terakhir untuk membatalkannya.</p>
      <div class="items">
        {#each q.items as it, i}
          {@const n = seq.indexOf(i)}
          <button class="item" class:on={n >= 0} disabled={locked} onclick={() => tapItem(i)} aria-label="{it}{n >= 0 ? `, urutan ${n + 1}` : ''}">
            <span class="num">{n >= 0 ? n + 1 : ''}</span><span class="tx">{it}</span>
          </button>
        {/each}
      </div>
      <div class="ctl">
        <button class="btn sm" disabled={locked || !seq.length} onclick={() => { seq = seq.slice(0, -1); sfx.pop(); }}>Batal satu</button>
        <button class="btn sm" disabled={locked || !seq.length} onclick={() => { seq = []; sfx.pop(); }}>Ulang</button>
        <button class="btn hot kirim" disabled={locked || !seqFull} onclick={kirim}>Kirim</button>
      </div>
    {:else}
      <ol class="items rev">
        {#each reveal.order as d, k}
          <li class="item" class:ok={myOrder[k] === d} class:no={myOrder.length > 0 && myOrder[k] !== d}>
            <span class="num">{k + 1}</span><span class="tx">{q.items[d]}</span><span class="mk">{myOrder.length ? (myOrder[k] === d ? '✓' : '✗') : ''}</span>
          </li>
        {/each}
      </ol>
    {/if}
  {:else if q.type === 'cocokkan'}
    {#if !done}
      <p class="tip">Ketuk satu di <b>kiri</b>, lalu pasangannya di <b>kanan</b>. Ketuk lagi untuk melepas.</p>
      <div class="match">
        <div class="col">
          {#each q.left as l, i}
            {@const p = pairs[i] !== undefined ? pairIdx(i) : -1}
            <button class="pair" class:sel={selL === i} class:paired={p >= 0} style={p >= 0 ? `--pc:${PAIR[p]}` : ''} disabled={locked} onclick={() => tapLeft(i)} aria-pressed={selL === i}>
              {#if p >= 0}<span class="tag">{LET[p]}</span>{/if}<span class="tx">{l}</span>
            </button>
          {/each}
        </div>
        <div class="col">
          {#each q.right as r, j}
            {@const owner = leftOfRight(j)}
            {@const p = owner !== null ? pairIdx(owner) : -1}
            <button class="pair r" class:sel={selR === j} class:paired={p >= 0} style={p >= 0 ? `--pc:${PAIR[p]}` : ''} disabled={locked} onclick={() => tapRight(j)} aria-pressed={selR === j}>
              {#if p >= 0}<span class="tag">{LET[p]}</span>{/if}<span class="tx">{r}</span>
            </button>
          {/each}
        </div>
      </div>
      <div class="ctl">
        <button class="btn sm" disabled={locked || !Object.keys(pairs).length} onclick={() => { pairs = {}; selL = null; selR = null; sfx.pop(); }}>Ulang</button>
        <button class="btn hot kirim" disabled={locked || !pairsFull} onclick={kirim}>Kirim</button>
      </div>
    {:else}
      <div class="items rev">
        {#each q.left as l, i}
          {@const ok = myPairs[i] === reveal.pairs[i]}
          <div class="item pr" class:ok={ok} class:no={Object.keys(myPairs).length > 0 && !ok}>
            <span class="tx"><b>{l}</b> <span class="arrow" aria-hidden="true">↔</span> {q.right[reveal.pairs[i]]}</span><span class="mk">{Object.keys(myPairs).length ? (ok ? '✓' : '✗') : ''}</span>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .soal { display: flex; flex-direction: column; gap: 10px; width: 100%; }
  .meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 12.5px; font-weight: 800; }
  .cat { background: var(--c); color: #fff; border: 2px solid var(--ink); border-radius: 999px; padding: 1px 10px; text-shadow: 0 1px 0 rgba(0,0,0,.25); }
  .lvl { color: #D99A0B; letter-spacing: 1px; } .lvl i { font-style: normal; color: #D8D2C2; }
  .hint { color: var(--muted); margin-left: auto; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .pic { align-self: center; width: min(100%, 300px, calc((100dvh - 430px) * 1.33)); min-width: 180px; border: 3px solid var(--ink); border-radius: 18px; overflow: hidden; background: #FFF8E6; box-shadow: 0 4px 0 var(--ink); }
  .pic :global(svg) { display: block; width: 100%; height: auto; }
  .q { margin: 0; font-size: 19px; font-weight: 800; line-height: 1.3; text-wrap: balance; }
  .q.big { font-size: 22px; text-align: center; background: #FFF4D6; border: 2.5px dashed #D9B55F; border-radius: 16px; padding: 10px 12px; }
  .peri { font-size: 21px; text-align: center; line-height: 1.6; }
  .blank { display: inline-block; min-width: 3.4em; margin: 0 4px; padding: 0 10px; border-radius: 10px; background: #FFE08A; border: 2.5px solid var(--ink); box-shadow: 0 2px 0 var(--ink); line-height: 1.35; color: #8E6A00; }
  .blank.filled { background: #BFEBCB; color: #1E6B42; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .grid.long { grid-template-columns: 1fr; }
  .opt { position: relative; display: flex; align-items: center; gap: 8px; min-height: 60px; padding: 8px 12px 8px 8px; border: 2.5px solid var(--ink); border-radius: 16px; background: var(--paper); box-shadow: 0 4px 0 var(--ink); font: 700 16.5px/1.2 var(--font); color: var(--ink); text-align: left; cursor: pointer; transition: transform .08s; }
  .opt:active:not(:disabled) { transform: translateY(3px); box-shadow: 0 1px 0 var(--ink); }
  .opt .k { flex: none; width: 28px; height: 28px; border-radius: 9px; display: grid; place-items: center; background: #FFF4D6; border: 2px solid var(--ink); font-size: 14px; }
  .opt .tx { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  .opt .mk { font-size: 22px; font-weight: 900; }
  .opt .who { position: absolute; right: 8px; bottom: -11px; font-size: 11px; font-weight: 800; background: var(--ink); color: #fff; border-radius: 999px; padding: 0 7px; max-width: 80%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .opt.sel { background: #FFE8A3; }
  .opt.ok { background: #BFEBCB; }
  .opt.ok .mk { color: #1E7A4C; }
  .opt.no { background: #F8C9BE; }
  .opt.no .mk { color: #B23A24; }
  .opt.dim { opacity: .55; }
  .opt:disabled { cursor: default; }
  .bs { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .bs .opt { min-height: 84px; justify-content: center; font-size: 22px; flex-direction: column; gap: 2px; padding: 8px; text-align: center; }
  .bs .ic { font-size: 26px; line-height: 1; }
  .bs .tag { font-size: 12px; font-weight: 800; border-radius: 999px; padding: 0 8px; border: 2px solid var(--ink); background: var(--paper); }
  .bs .tag.ok { color: #1E7A4C; } .bs .tag.no { color: #B23A24; }
  .bs .yes:not(.no):not(.dim) .ic { color: #1E7A4C; }
  .bs .nope:not(.ok):not(.dim) .ic { color: #B23A24; }
  .tip { margin: 0; font-size: 13.5px; font-weight: 600; color: var(--muted); }
  .items { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
  .item { display: flex; align-items: center; gap: 10px; min-height: 52px; padding: 6px 12px 6px 6px; border: 2.5px solid var(--ink); border-radius: 14px; background: var(--paper); box-shadow: 0 3px 0 var(--ink); font: 700 16px/1.25 var(--font); color: var(--ink); text-align: left; cursor: pointer; }
  .item .num { flex: none; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; border: 2.5px dashed #B8B2A2; font-weight: 900; font-size: 17px; }
  .item.on { background: #FFF4D6; }
  .item.on .num { background: var(--coin); border: 2.5px solid var(--ink); }
  .item .tx { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  .item .mk { font-weight: 900; font-size: 20px; }
  .rev .item { cursor: default; }
  .rev .item .num { background: #FFF4D6; border-style: solid; border-color: var(--ink); }
  .rev .item.ok { background: #E3F5E8; } .rev .item.ok .mk { color: #1E7A4C; }
  .rev .item.no { background: #FDE8E3; } .rev .item.no .mk { color: #B23A24; }
  .item.pr { padding-left: 12px; }
  .arrow { color: var(--muted); margin: 0 2px; }
  .ctl { display: flex; gap: 8px; align-items: center; }
  .ctl .kirim { margin-left: auto; min-width: 110px; min-height: 48px; font-size: 18px; }
  .match { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .col { display: flex; flex-direction: column; gap: 8px; }
  .pair { position: relative; display: flex; align-items: center; gap: 6px; min-height: 56px; padding: 6px 10px; border: 2.5px solid var(--ink); border-radius: 14px; background: var(--paper); box-shadow: 0 3px 0 var(--ink); font: 700 15px/1.2 var(--font); color: var(--ink); cursor: pointer; text-align: left; }
  .pair.r { background: #F4F7FB; }
  .pair .tx { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  .pair.sel { outline: 4px solid #3F7FBF; outline-offset: 1px; background: #E2EEFA; }
  .pair.paired { background: var(--pc); }
  .pair .tag { flex: none; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; background: var(--paper); border: 2px solid var(--ink); font-size: 13px; font-weight: 900; }
  .compact .q { font-size: 17px; }
  .compact .opt { min-height: 54px; font-size: 15.5px; }
  .compact .pic { width: min(100%, 220px, calc((100dvh - 470px) * 1.33)); min-width: 140px; }
  @media (max-width: 359px) {
    .q { font-size: 17.5px; } .peri { font-size: 19px; }
    .opt { font-size: 15px; padding: 6px 8px 6px 6px; gap: 6px; min-height: 56px; } .opt .k { width: 24px; height: 24px; font-size: 13px; }
    .pair { font-size: 13.5px; padding: 5px 6px; } .match { gap: 6px; }
    .item { font-size: 15px; }
  }
  @media (min-width: 700px) { .q { font-size: 22px; } .opt { font-size: 18px; min-height: 66px; } }
  @media (prefers-reduced-motion: reduce) { .opt { transition: none; } }
  :global(:root.reduce-motion) .opt { transition: none; }
</style>
