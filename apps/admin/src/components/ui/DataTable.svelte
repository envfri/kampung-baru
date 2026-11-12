<script lang="ts" module>
  export interface Col {
    key: string;
    label: string;
    /** bisa diurutkan; string = nama kunci urut di server */
    sort?: boolean | string;
    num?: boolean;
    /** tersembunyi bawaan (bisa dimunculkan lewat menu Kolom) */
    off?: boolean;
    /** wajib tampil */
    req?: boolean;
    /** isi sel sebagai HTML */
    html?: (r: any) => string;
    /** nilai teks (untuk urutan lokal & ekspor CSV) */
    text?: (r: any) => string | number | null | undefined;
    /** isi sel lewat snippet `cell` halaman */
    snip?: boolean;
    w?: string;
    /** di HP: 'title' = judul kartu (tanpa label), 'hide' = tidak tampil */
    card?: 'title' | 'hide';
  }
  export interface TState { page: number; size: number; sort: string; dir: 'asc' | 'desc' }
</script>

<script lang="ts">
  // Tabel lengkap: urutkan, halaman & jumlah per halaman, kolom tampil/sembunyi/urut ulang (diingat per admin),
  // pilih banyak + bar aksi massal, kerangka saat memuat, keadaan kosong, ekspor CSV, dan jadi kartu di HP.
  import type { Snippet } from 'svelte';
  import { getPath, num, pref, savePref, toast } from '../../lib/store.svelte';
  import { I } from '../../lib/icons';
  import Dropdown from './Dropdown.svelte';
  import Empty from './Empty.svelte';

  let {
    cols, rows, total = null, state: st = $bindable({ page: 0, size: 25, sort: '', dir: 'desc' }), onstate, loading = false,
    idKey = 'id', selectable = false, selected = $bindable([]), bulk, onrow, cell, prefKey = '', empty = 'Belum ada data.',
    emptyText = '', emptyIcon = 'search', emptyActions, toolbar, tools, sizes = [25, 50, 100], rowClass, csv, csvName = 'data',
  }: {
    cols: Col[]; rows: any[]; total?: number | null; state?: TState; onstate?: () => void; loading?: boolean;
    idKey?: string; selectable?: boolean; selected?: string[]; bulk?: Snippet<[string[]]>; onrow?: (r: any) => void;
    cell?: Snippet<[any, string]>; prefKey?: string; empty?: string; emptyText?: string; emptyIcon?: string; emptyActions?: Snippet;
    toolbar?: Snippet; tools?: Snippet; sizes?: number[]; rowClass?: (r: any) => string; csv?: (() => void) | 'local'; csvName?: string;
  } = $props();

  const server = $derived(total !== null && total !== undefined);
  // urutan & kolom tersembunyi (preferensi admin)
  const saved = prefKey ? pref<{ order: string[]; hidden: string[] } | null>(`tbl:${prefKey}`, null) : null;
  let order = $state<string[]>(saved?.order ?? []);
  let hidden = $state<string[]>(saved?.hidden ?? cols.filter((c) => c.off).map((c) => c.key));
  if (prefKey && saved) st.size = pref(`size:${prefKey}`, st.size);
  const ordered = $derived([...cols].sort((a, b) => {
    const ia = order.indexOf(a.key), ib = order.indexOf(b.key);
    return (ia < 0 ? cols.indexOf(a) + 1000 : ia) - (ib < 0 ? cols.indexOf(b) + 1000 : ib);
  }));
  const vis = $derived(ordered.filter((c) => c.req || !hidden.includes(c.key)));
  function savePrefs() { if (prefKey) savePref(`tbl:${prefKey}`, { order: ordered.map((c) => c.key), hidden }); }
  function toggleCol(k: string) { hidden = hidden.includes(k) ? hidden.filter((x) => x !== k) : [...hidden, k]; savePrefs(); }
  function resetCols() { order = []; hidden = cols.filter((c) => c.off).map((c) => c.key); savePrefs(); }
  let drag = $state<string | null>(null);
  function dropOn(k: string) {
    if (!drag || drag === k) return;
    const keys = ordered.map((c) => c.key).filter((x) => x !== drag);
    keys.splice(keys.indexOf(k), 0, drag);
    order = keys; drag = null; savePrefs();
  }

  // urutan & halaman lokal (bila total tidak diisi)
  const valOf = (r: any, c: Col) => (c.text ? c.text(r) : getPath(r, c.key));
  const sorted = $derived.by(() => {
    if (server || !st.sort) return rows;
    const c = cols.find((x) => x.key === st.sort);
    if (!c) return rows;
    const m = st.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = valOf(a, c), y = valOf(b, c);
      if (x == null || x === '') return 1; if (y == null || y === '') return -1;
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'id', { numeric: true })) * m;
    });
  });
  const count = $derived(server ? (total as number) : rows.length);
  const pages = $derived(Math.max(1, Math.ceil(count / st.size)));
  $effect(() => { if (!server && st.page > pages - 1) st.page = pages - 1; });
  const view = $derived(server ? rows : sorted.slice(st.page * st.size, st.page * st.size + st.size));

  function sortBy(c: Col) {
    if (!c.sort) return;
    const k = typeof c.sort === 'string' ? c.sort : c.key;
    if (st.sort === k) st.dir = st.dir === 'asc' ? 'desc' : 'asc';
    else { st.sort = k; st.dir = c.num ? 'desc' : 'asc'; }
    st.page = 0; onstate?.();
  }
  const sortKey = (c: Col) => (typeof c.sort === 'string' ? c.sort : c.key);
  function go(p: number) { st.page = Math.max(0, Math.min(pages - 1, p)); onstate?.(); }
  function setSize(n: number) { st.size = n; st.page = 0; if (prefKey) savePref(`size:${prefKey}`, n); onstate?.(); }
  const pageList = $derived.by(() => {
    const p = st.page, out: (number | null)[] = [];
    for (let i = 0; i < pages; i++) if (i === 0 || i === pages - 1 || Math.abs(i - p) <= 1) out.push(i); else if (out[out.length - 1] !== null) out.push(null);
    return out;
  });

  // pilih banyak
  const ids = $derived(view.map((r) => String(r[idKey])));
  const allOn = $derived(ids.length > 0 && ids.every((i) => selected.includes(i)));
  const someOn = $derived(!allOn && ids.some((i) => selected.includes(i)));
  let headCb = $state<HTMLInputElement>();
  $effect(() => { if (headCb) headCb.indeterminate = someOn; });
  function toggleAll() { selected = allOn ? selected.filter((i) => !ids.includes(i)) : [...new Set([...selected, ...ids])]; }
  function toggleOne(id: string) { selected = selected.includes(id) ? selected.filter((i) => i !== id) : [...selected, id]; }

  function exportLocal() {
    const esc = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const cs = vis.filter((c) => c.key !== '_act');
    const lines = [cs.map((c) => esc(c.label)).join(','), ...sorted.map((r) => cs.map((c) => esc(valOf(r, c))).join(','))];
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `${csvName}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast(`${num(sorted.length)} baris diekspor`, 'info');
  }
  let colsOpen = $state(false);
</script>

<div class="dt">
  <div class="bar">
    <div class="left">{#if toolbar}{@render toolbar()}{:else}<span class="muted">{loading && !rows.length ? 'Memuat…' : `${num(count)} hasil`}</span>{/if}</div>
    <div class="right">
      {#if tools}{@render tools()}{/if}
      {#if csv}<button class="btn sm" onclick={() => (csv === 'local' ? exportLocal() : (csv as () => void)())}>{@html I.download}<span class="hide-s">Ekspor CSV</span></button>{/if}
      {#if cols.some((c) => !c.req)}
        <Dropdown bind:open={colsOpen} align="right" width={250} label="Atur kolom">
          {#snippet button()}<span class="btn sm">{@html I.cols}<span class="hide-s">Kolom</span></span>{/snippet}
          <p class="ph">Tampilkan kolom <small>seret untuk urutkan</small></p>
          {#each ordered as c (c.key)}
            <div class="opt" class:over={drag && drag !== c.key} draggable="true" role="listitem"
              ondragstart={() => (drag = c.key)} ondragover={(e) => e.preventDefault()} ondrop={() => dropOn(c.key)}>
              <span class="grip" aria-hidden="true">⋮⋮</span>
              <label class="inline"><input type="checkbox" checked={c.req || !hidden.includes(c.key)} disabled={c.req} onchange={() => toggleCol(c.key)} />{c.label || '(aksi)'}</label>
              {#if c.req}<small>wajib</small>{/if}
            </div>
          {/each}
          <div class="pf"><button class="link" onclick={resetCols}>Kembalikan bawaan</button><small class="muted">tersimpan otomatis</small></div>
        </Dropdown>
      {/if}
    </div>
  </div>

  {#if selectable && selected.length}
    <div class="bulk fade">
      <span>{selected.length} dipilih</span>
      <span class="sp"></span>
      {#if bulk}{@render bulk(selected)}{/if}
      <button class="btn sm" onclick={() => (selected = [])}>{@html I.x}Batal pilih</button>
    </div>
  {/if}

  <div class="tbl">
    <table>
      <thead><tr>
        {#if selectable}<th class="cbc"><input type="checkbox" bind:this={headCb} checked={allOn} onchange={toggleAll} aria-label="Pilih semua di halaman ini" /></th>{/if}
        {#each vis as c (c.key)}
          <th class:num={c.num} class:sorted={st.sort === sortKey(c) && !!c.sort} style={c.w ? `width:${c.w}` : ''} aria-sort={c.sort && st.sort === sortKey(c) ? (st.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
            {#if c.sort}<button class="sh" onclick={() => sortBy(c)}>{c.label}<span class="si">{@html st.sort === sortKey(c) ? (st.dir === 'asc' ? I.arrowUp : I.arrowDown) : I.sort}</span></button>{:else}{c.label}{/if}
          </th>
        {/each}
      </tr></thead>
      <tbody>
        {#if loading && !rows.length}
          {#each Array(6) as _, i}<tr class="sk">{#if selectable}<td></td>{/if}{#each vis as c, j}<td><span class="skel" style="width:{40 + ((i * 7 + j * 13) % 50)}%"></span></td>{/each}</tr>{/each}
        {:else}
          {#each view as r, ri (String(r[idKey] ?? ri))}
            {@const id = String(r[idKey])}
            <tr class="{onrow ? 'click' : ''} {rowClass?.(r) ?? ''}" class:sel={selected.includes(id)} onclick={(e) => { if (onrow && !(e.target as HTMLElement).closest('button, a, input, label, select')) onrow(r); }}>
              {#if selectable}<td class="cbc"><input type="checkbox" checked={selected.includes(id)} onchange={() => toggleOne(id)} aria-label="Pilih baris" /></td>{/if}
              {#each vis as c (c.key)}
                <td class:num={c.num} class:ttl={c.card === 'title'} class:hidec={c.card === 'hide'} data-label={c.label}>
                  {#if c.snip && cell}{@render cell(r, c.key)}{:else if c.html}{@html c.html(r)}{:else}{valOf(r, c) ?? ''}{/if}
                </td>
              {/each}
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
    {#if !loading && !rows.length}
      <Empty title={empty} text={emptyText} icon={emptyIcon}>{#if emptyActions}{@render emptyActions()}{/if}</Empty>
    {/if}
    {#if count > sizes[0] || st.page > 0}
      <div class="foot">
        <span>Menampilkan <b>{num(Math.min(count, st.page * st.size + 1))}–{num(Math.min(count, (st.page + 1) * st.size))}</b> dari <b>{num(count)}</b></span>
        <span class="pgw">
          <select value={st.size} onchange={(e) => setSize(Number((e.target as HTMLSelectElement).value))} aria-label="Baris per halaman">{#each sizes as n}<option value={n}>{n} per halaman</option>{/each}</select>
          <span class="pg">
            <button class="btn sm icon" disabled={st.page === 0} onclick={() => go(st.page - 1)} aria-label="Halaman sebelumnya">{@html I.left}</button>
            {#each pageList as p}{#if p === null}<span class="gap">…</span>{:else}<button class="btn sm" class:on={p === st.page} onclick={() => go(p)} aria-current={p === st.page ? 'page' : undefined}>{p + 1}</button>{/if}{/each}
            <button class="btn sm icon" disabled={st.page >= pages - 1} onclick={() => go(st.page + 1)} aria-label="Halaman berikutnya">{@html I.right}</button>
          </span>
        </span>
      </div>
    {/if}
  </div>
</div>

<style>
  .dt { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .bar { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; min-height: 30px; }
  .left { font-size: 13.5px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .right { display: flex; gap: 6px; align-items: center; }
  .right :global(.btn svg) { width: 14px; height: 14px; }
  .ph { margin: 4px 8px 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); font-weight: 700; display: flex; justify-content: space-between; }
  .ph small { text-transform: none; letter-spacing: 0; font-weight: 500; }
  .opt { display: flex; align-items: center; gap: 6px; padding: 4px 6px; border-radius: 8px; cursor: grab; }
  .opt:hover { background: var(--hover); } .opt.over:hover { box-shadow: inset 0 2px 0 var(--accent); }
  .opt label { flex: 1; font-weight: 500; cursor: pointer; } .opt small { color: var(--muted); font-size: 11.5px; }
  .grip { color: #B9C0C5; font-size: 12px; letter-spacing: -2px; }
  .pf { border-top: 1px solid var(--line); margin-top: 6px; padding: 8px 6px 2px; display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
  .bulk { display: flex; align-items: center; gap: 8px; background: var(--ink); color: #fff; border-radius: 12px; padding: 7px 8px 7px 14px; font-weight: 600; font-size: 14px; flex-wrap: wrap; }
  .bulk .sp { flex: 1; }
  .bulk :global(.btn) { background: transparent; color: #fff; border-color: rgba(255,255,255,.35); }
  .bulk :global(.btn:hover:not(:disabled)) { background: rgba(255,255,255,.1); }
  .bulk :global(.btn svg) { width: 14px; height: 14px; }
  .tbl { position: relative; }
  th { position: sticky; top: 0; z-index: 1; }
  th.sorted { color: var(--accent); }
  .sh { all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; }
  .sh:focus-visible { outline: 2px solid #3F7FBF; border-radius: 4px; }
  .si { width: 12px; height: 12px; opacity: .45; display: inline-grid; } .sorted .si { opacity: 1; }
  .si :global(svg) { width: 100%; height: 100%; }
  th.num .sh { flex-direction: row-reverse; }
  .cbc { width: 38px; padding-right: 0; }
  tr.sel td { background: #F3FAF7; }
  tr.sk td { padding-top: 14px; padding-bottom: 14px; }
  .foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 12px; font-size: 13px; color: var(--muted); background: #FBFCFB; border-top: 1px solid var(--line-soft); flex-wrap: wrap; }
  .foot b { color: var(--ink); }
  .pgw { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .pgw select { width: auto; min-height: 30px; padding: 3px 8px; font-size: 13px; }
  .pg { display: flex; gap: 4px; align-items: center; }
  .pg .btn { min-width: 30px; padding: 3px 7px; }
  .pg .btn.on { background: var(--ink); color: #fff; border-color: var(--ink); }
  .pg :global(svg) { width: 14px; height: 14px; }
  .gap { padding: 0 2px; }
  @media (max-width: 760px) {
    .hide-s { display: none; }
    .tbl { background: transparent; border: 0; overflow: visible; }
    table, tbody { display: block; }
    thead { display: none; }
    tr { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 10px 12px; margin-bottom: 10px; position: relative; }
    tr.sk { display: block; }
    td { border: 0; padding: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 1px; min-width: 0; font-size: 13.5px; text-align: left !important; }
    td::before { content: attr(data-label); font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
    td.ttl { grid-column: 1 / -1; padding-right: 30px; } td.ttl::before { display: none; }
    td.hidec { display: none; }
    td[data-label='']::before { display: none; }
    td.cbc { position: absolute; right: 10px; top: 12px; width: auto; }
    td.cbc::before { display: none; }
    .foot { border-radius: 12px; border: 1px solid var(--line); }
  }
</style>
