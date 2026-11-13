<script lang="ts">
  // Buku Ikan: ikan per tingkat (siluet + petunjuk untuk yang belum tertangkap, "???" untuk ikan rahasia),
  // tab Temuan (sampah, botol, peti, hiasan, aksesori) dan Rekor. Ikan rahasia baru tampil setelah tertangkap.
  import { onDestroy, onMount } from 'svelte';
  import Sheet from '../components/Sheet.svelte';
  import { FISH_TIERS, FISH_TIER_KEYS, FIND_LABEL, pondKind, fishTier, fishWhere, pondIcon, secretIcon, type FishTier, type PondFind } from '@kb/shared';
  import { fail, items } from '../lib/game.svelte';
  import { api } from '../lib/api';
  import { COIN } from '../lib/icons';
  import { sfx } from '../lib/sfx';

  let book = $state<any>(null);
  let tab = $state<'ikan' | 'temuan' | 'rekor'>('ikan');
  let pick = $state<null | { secret?: any; it?: any }>(null);
  const seen = (() => { try { return new Set<string>(JSON.parse(localStorage.getItem('kb-buku-seen') ?? '[]')); } catch { return new Set<string>(); } })();
  onMount(async () => {
    try { book = await api.get('/api/fish/collection'); } catch (e) { fail(e); }
  });
  // titik "Baru" hilang setelah Buku dilihat
  onDestroy(() => { if (book) try { localStorage.setItem('kb-buku-seen', JSON.stringify([...seen, ...book.collection.map((c: any) => c.fish_id)].slice(-300))); } catch { /* abaikan */ } });

  const rows = $derived<Record<string, any>>(Object.fromEntries((book?.collection ?? []).map((c: any) => [c.fish_id, c])));
  const all = $derived.by(() => { const m = new Map(items()); for (const r of book?.revealed ?? []) if (!m.has(r.id)) m.set(r.id, r); return [...m.values()]; });
  const fish = $derived(all.filter((i) => pondKind(i) === 'fish'));
  const finds = $derived(all.filter((i) => { const k = pondKind(i); return !!k && k !== 'fish'; }));
  const secrets = $derived<any[]>(book?.secrets ?? []);
  const tiers = $derived(FISH_TIER_KEYS.map((t) => {
    const list = fish.filter((f) => fishTier(f.data) === t);
    const sec = secrets.filter((s) => s.tier === t);
    return { t, list, sec, got: list.filter((f) => rows[f.id]).length, of: list.length + sec.length };
  }));
  const fishGot = $derived(fish.filter((f) => rows[f.id]).length);
  const fishAll = $derived(fish.length + secrets.length);
  const findGot = $derived(finds.filter((f) => rows[f.id]).length);
  const records = $derived(fish.filter((f) => rows[f.id]).sort((a, b) => rows[b.id].best_cm - rows[a.id].best_cm));
  const totalCatch = $derived(Object.values(rows).reduce((a: number, r: any) => a + (r.count ?? 0), 0));
  const short = (n: string) => n.replace(/^Ikan /, '');
  const cm = (v: number) => (Math.round(v * 10) / 10).toLocaleString('id-ID');
  const stars = (t: FishTier) => '★'.repeat(FISH_TIERS[t].stars);
  function open(p: typeof pick) { sfx.tap(); pick = p; }
</script>

<Sheet title="Buku Ikan">
  <div class="tabbar" role="tablist">
    <button role="tab" aria-selected={tab === 'ikan'} class:on={tab === 'ikan'} onclick={() => { tab = 'ikan'; pick = null; }}>Ikan · {fishGot}/{fishAll}</button>
    <button role="tab" aria-selected={tab === 'temuan'} class:on={tab === 'temuan'} onclick={() => { tab = 'temuan'; pick = null; }}>Temuan · {findGot}/{finds.length}</button>
    <button role="tab" aria-selected={tab === 'rekor'} class:on={tab === 'rekor'} onclick={() => { tab = 'rekor'; pick = null; }}>Rekor</button>
  </div>

  {#if !book}
    <p class="muted">Membuka Buku Ikan…</p>
  {:else if tab === 'ikan'}
    <div class="prog">
      <div class="pt"><b>Tertangkap {fishGot} dari {fishAll} jenis</b>{#if secrets.length}<span>{secrets.length} rahasia</span>{/if}</div>
      <div class="pb">{#each tiers as g}<i style="flex:{Math.max(1, g.of)}"><u style="width:{g.of ? (g.got / g.of) * 100 : 0}%;background:{FISH_TIERS[g.t].col}"></u></i>{/each}</div>
    </div>
    {#each tiers as g (g.t)}
      {#if g.of}
        {@const T = FISH_TIERS[g.t]}
        <section class="tier" style="--tc:{T.col};--tb:{T.bg}">
          <div class="sh"><span class="bar"></span><b>{T.label}</b><span class="stars">{stars(g.t)}<i>{'★'.repeat(4 - T.stars)}</i></span><em>{g.got}/{g.of}</em></div>
          <div class="grid">
            {#each g.list as f (f.id)}
              {@const c = rows[f.id]}
              <button class="cell" class:unk={!c} onclick={() => open({ it: f })}>
                {#if c && !seen.has(f.id)}<i class="dot">Baru</i>{/if}
                <span class="ic">{@html pondIcon(f)}</span>
                <b>{short(f.name)}</b>
                <span class="sub">{c ? `${c.count}× · ${cm(c.best_cm)} cm` : fishWhere(f.data)}</span>
              </button>
            {/each}
            {#each g.sec as s (s.key)}
              <button class="cell sec" onclick={() => open({ secret: s })} aria-label="Ikan rahasia {T.label}">
                <span class="ic">{@html secretIcon()}</span>
                <b>???</b>
                <span class="sub">{#if s.hint}<em>ada petunjuk</em>{:else}rahasia{/if}</span>
              </button>
            {/each}
          </div>
        </section>
      {/if}
    {/each}
  {:else if tab === 'temuan'}
    <div class="prog"><div class="pt"><b>Ditemukan {findGot} dari {finds.length} jenis</b></div></div>
    <p class="lead">Selain ikan, kail bisa menyangkut barang. Peti harta lebih sering di lemparan jauh.</p>
    <div class="grid big">
      {#each finds as f (f.id)}
        {@const c = rows[f.id]}
        <button class="cell" class:unk={!c} style="--tc:#A0603A;--tb:#F6EBDD" onclick={() => open({ it: f })}>
          {#if c && !seen.has(f.id)}<i class="dot">Baru</i>{/if}
          <span class="ic">{@html pondIcon(f)}</span>
          <b>{f.name}</b>
          <span class="sub">{FIND_LABEL[pondKind(f) as PondFind]}{c ? ` · ${c.count}×` : ''}</span>
        </button>
      {/each}
    </div>
  {:else}
    <p class="lead">Total tangkapan: <b>{totalCatch}</b> · ikan terpanjang yang pernah kamu dapat.</p>
    {#if !records.length}<p class="muted">Belum ada ikan. Ayo ke Kolam Pancing!</p>{/if}
    <ol class="rek">
      {#each records as f, i (f.id)}
        {@const T = FISH_TIERS[fishTier(f.data)]}
        <li style="--tc:{T.col};--tb:{T.bg}">
          <span class="no">{i + 1}</span>
          <span class="ic">{@html pondIcon(f)}</span>
          <span class="nm"><b>{f.name}</b><small>{T.label} · {rows[f.id].count}×</small></span>
          <span class="len">{cm(rows[f.id].best_cm)} cm</span>
        </li>
      {/each}
    </ol>
  {/if}

  {#if pick}
    <div class="pop" role="dialog" aria-label="Detail">
      <button class="x" onclick={() => (pick = null)} aria-label="Tutup detail">×</button>
      {#if pick.secret}
        {@const T = FISH_TIERS[pick.secret.tier as FishTier]}
        <div class="ph"><span class="pic sec">{@html secretIcon()}</span><div><b>Ikan rahasia</b><span>{T.label} {stars(pick.secret.tier)} · belum pernah tertangkap</span></div></div>
        {#if pick.secret.hint}<p class="quote">“{pick.secret.hint}”</p><small>Petunjuk dari Botol Berisi Pesan</small>
        {:else}<p class="quote none">Belum ada petunjuk.</p><small>Petunjuk bisa ditemukan di Botol Berisi Pesan dari kolam.</small>{/if}
      {:else if pick.it}
        {@const f = pick.it}
        {@const c = rows[f.id]}
        {@const k = pondKind(f)}
        <div class="ph"><span class="pic" class:unk={!c}>{@html pondIcon(f)}</span><div><b>{f.name}</b><span>{k === 'fish' ? `${FISH_TIERS[fishTier(f.data)].label} ${stars(fishTier(f.data))}` : FIND_LABEL[k as PondFind]}</span></div></div>
        {#if f.description}<p class="desc">{f.description}</p>{/if}
        <p class="facts">
          {#if c}{k === 'fish' ? `Tertangkap ${c.count}× · rekor ${cm(c.best_cm)} cm` : `Ditemukan ${c.count}×`}{:else}{k === 'fish' ? `Belum tertangkap · ${fishWhere(f.data)}` : 'Belum ditemukan'}{/if}
          {#if f.sell_coin > 0}<span class="sell">{@html COIN} laku {f.sell_coin}</span>{/if}
        </p>
      {/if}
    </div>
  {/if}
</Sheet>

<style>
  .lead { margin: 0; font-weight: 600; font-size: 14px; }
  .prog .pt { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 0 8px; font-size: 14px; font-weight: 700; }
  .prog .pt b { font-weight: 800; }
  .prog .pt span { color: var(--muted); }
  .pb { display: flex; gap: 3px; height: 12px; margin-top: 3px; }
  .pb i { background: var(--track); border-radius: 4px; overflow: hidden; border: 1.5px solid var(--ink); }
  .pb u { display: block; height: 100%; }
  .tier { display: flex; flex-direction: column; gap: 6px; }
  .sh { display: flex; align-items: center; gap: 6px; font-size: 16px; }
  .sh b { font-weight: 800; color: var(--tc); }
  .sh .bar { width: 6px; height: 18px; border-radius: 3px; background: var(--tc); }
  .sh em { font-style: normal; font-size: 13px; font-weight: 800; color: var(--muted); margin-left: auto; }
  .stars { color: #F2B632; font-size: 13px; letter-spacing: 1px; -webkit-text-stroke: .6px var(--ink); white-space: nowrap; }
  .stars i { font-style: normal; color: rgba(43, 47, 74, .14); -webkit-text-stroke: 0; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(68px, 1fr)); gap: 6px; }
  .grid.big { grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); }
  .cell { position: relative; display: flex; flex-direction: column; align-items: stretch; padding: 0 0 4px; border: 2px solid var(--ink); border-top: 6px solid var(--tc); border-radius: 12px; background: #fff; overflow: hidden; text-align: center; cursor: pointer; font-family: var(--font); color: var(--ink); min-width: 0; }
  .cell .ic { height: 48px; background: var(--tb); display: grid; place-items: center; }
  .big .cell .ic { height: 64px; }
  .cell .ic :global(svg) { width: 62px; height: 46px; }
  .big .cell .ic :global(svg) { width: 76px; height: 60px; }
  .cell b { display: block; font-size: 12px; line-height: 1.05; padding: 3px 3px 0; font-weight: 800; }
  .cell .sub { display: block; font-size: 10.5px; color: var(--muted); font-weight: 700; padding: 1px 3px 0; line-height: 1.15; }
  .cell.unk .ic :global(svg) { filter: brightness(0) opacity(.22); }
  .cell.unk b { color: var(--muted); }
  .cell.sec { border: 2px dashed #B7790C; border-top: 6px solid #D9961A; background: #2E3352; }
  .cell.sec .ic { background: #2E3352; }
  .cell.sec b { color: #F2B632; font-size: 15px; }
  .cell.sec .sub { color: #C9CDE0; }
  .cell.sec em { font-style: normal; color: #F2B632; }
  .dot { position: absolute; right: 3px; top: 3px; font-style: normal; font-size: 9.5px; font-weight: 800; background: var(--low); color: #fff; border-radius: 6px; padding: 0 4px; border: 1.5px solid var(--ink); z-index: 2; }
  .rek { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .rek li { display: flex; align-items: center; gap: 8px; border: 2px solid var(--ink); border-left: 6px solid var(--tc); border-radius: 12px; background: #fff; padding: 4px 10px 4px 6px; }
  .rek .no { flex: none; width: 22px; font-weight: 800; color: var(--muted); text-align: center; }
  .rek .ic { flex: none; width: 54px; height: 42px; background: var(--tb); border-radius: 8px; display: grid; place-items: center; }
  .rek .ic :global(svg) { width: 52px; height: 40px; }
  .rek .nm { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .rek .nm b { font-size: 15px; line-height: 1.1; }
  .rek .nm small { font-size: 12px; font-weight: 700; color: var(--muted); }
  .rek .len { flex: none; font-weight: 800; font-size: 16px; }
  .pop { position: sticky; bottom: 0; z-index: 3; background: var(--paper); border: 3px solid var(--ink); border-radius: 18px; box-shadow: 0 5px 0 var(--ink); padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; animation: pop .25s; }
  .pop .x { position: absolute; right: 8px; top: 6px; width: 32px; height: 32px; border-radius: 10px; border: 2px solid var(--ink); background: var(--paper); font-size: 20px; font-weight: 800; line-height: 1; cursor: pointer; }
  .ph { display: flex; gap: 10px; align-items: center; padding-right: 34px; }
  .pic { flex: none; width: 70px; height: 56px; border-radius: 10px; border: 2px solid var(--ink); background: var(--tint); display: grid; place-items: center; }
  .pic.sec { background: #2E3352; }
  .pic.unk :global(svg) { filter: brightness(0) opacity(.22); }
  .pic :global(svg) { width: 64px; height: 50px; }
  .ph b { display: block; font-size: 18px; font-weight: 800; line-height: 1.1; }
  .ph span { font-size: 13px; font-weight: 700; color: var(--muted); }
  .quote { margin: 0; font-size: 16px; font-weight: 700; background: #FFF8E6; border: 2px dashed rgba(43, 47, 74, .3); border-radius: 10px; padding: 6px 10px; }
  .quote.none { color: var(--muted); }
  .pop small { font-size: 12.5px; font-weight: 700; color: var(--muted); }
  .desc { margin: 0; font-weight: 600; font-size: 14.5px; }
  .facts { margin: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; font-weight: 700; font-size: 13.5px; color: var(--muted); }
  .sell { display: inline-flex; align-items: center; gap: 3px; color: var(--ink); }
  .sell :global(svg) { width: 16px; height: 16px; }
</style>
