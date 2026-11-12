<script lang="ts">
  // Bar filter: kotak cari + tombol dropdown per filter, chip filter aktif (hapus satu-satu / reset semua),
  // nilai disimpan di tautan. Di HP filter dibuka sebagai lembar dari bawah.
  import type { Snippet } from 'svelte';
  import { setQuery, num } from '../../lib/store.svelte';
  import { type FDef, DATE_PRESETS, isActive, activeCount, chipText, rangeOf } from '../../lib/filters';
  import { I } from '../../lib/icons';
  import Dropdown from './Dropdown.svelte';

  let { q = $bindable(''), placeholder = 'Cari…', filters = [], values = $bindable({}), onchange, count = null, sync = true, extra, keep = {} }: {
    q?: string; placeholder?: string; filters?: FDef[]; values?: Record<string, any>; onchange?: () => void; count?: number | null; sync?: boolean; extra?: Snippet;
    /** kunci lain yang ikut disimpan di tautan (mis. tab) */
    keep?: Record<string, unknown>;
  } = $props();

  let open = $state<Record<string, boolean>>(Object.fromEntries(filters.map((f) => [f.key, false])));
  let t: ReturnType<typeof setTimeout> | undefined;
  function changed(now = true) {
    if (sync) setQuery({ ...keep, q, ...values });
    if (now) onchange?.();
  }
  function typed() { clearTimeout(t); t = setTimeout(() => changed(), 300); }
  function setOne(d: FDef, v: string) { values[d.key] = v; open[d.key] = false; changed(); }
  function toggleMany(d: FDef, v: string) { const cur: string[] = values[d.key] ?? []; values[d.key] = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]; changed(); }
  function clear(d: FDef) { values[d.key] = d.type === 'many' ? [] : ''; changed(); }
  function resetAll() { for (const d of filters) values[d.key] = d.type === 'many' ? [] : ''; q = ''; changed(); }
  const n = $derived(activeCount(filters, values));
  const shown = (d: FDef) => {
    const v = values[d.key];
    if (!isActive(d, v)) return d.type === 'one' && d.all ? d.all : '';
    if (d.type === 'many') return (v as string[]).length === 1 ? d.options?.find((o) => o[0] === v[0])?.[1] ?? v[0] : `${(v as string[]).length} dipilih`;
    return chipText(d, v).replace(`${d.label}: `, '').replace(d.label + ' ', '');
  };
  // rentang tanggal manual & angka
  let custom = $state<Record<string, { a: string; b: string }>>({});
  function applyCustom(d: FDef) {
    const c = custom[d.key] ?? { a: '', b: '' };
    if (d.type === 'dates') values[d.key] = c.a || c.b ? `a:${c.a}:${c.b}` : '';
    else values[d.key] = c.a !== '' || c.b !== '' ? `${c.a}-${c.b}` : '';
    open[d.key] = false; changed();
  }
  function initCustom(d: FDef) {
    const v = values[d.key] ?? '';
    if (d.type === 'dates') { const m = /^a:([^:]*):(.*)$/.exec(v); custom[d.key] = { a: m?.[1] ?? '', b: m?.[2] ?? '' }; }
    else { const r = rangeOf(v); custom[d.key] = { a: r.min != null ? String(r.min) : '', b: r.max != null ? String(r.max) : '' }; }
  }
  // isian manual disiapkan saat dropdown dibuka, dibuang saat ditutup
  $effect(() => {
    for (const d of filters) {
      if (d.type !== 'dates' && d.type !== 'range') continue;
      if (open[d.key]) { if (!custom[d.key]) initCustom(d); } else if (custom[d.key]) delete custom[d.key];
    }
  });
  // lembar filter di HP
  let sheet = $state(false);
  let draft = $state<Record<string, any>>({});
  function openSheet() { draft = JSON.parse(JSON.stringify(values)); sheet = true; }
  function applySheet() { for (const k of Object.keys(draft)) values[k] = draft[k]; sheet = false; changed(); }
</script>

<div class="fb">
  <div class="line">
    <label class="search">
      <span class="si">{@html I.search}</span>
      <input type="search" {placeholder} bind:value={q} oninput={typed} aria-label={placeholder} />
      {#if q}<button class="clr" aria-label="Hapus pencarian" onclick={() => { q = ''; changed(); }}>{@html I.x}</button>{/if}
    </label>
    {#each filters as d (d.key)}
      <span class="desk">
        <Dropdown bind:open={open[d.key]} width={d.type === 'dates' || d.type === 'range' ? 260 : 0}>
          {#snippet button()}<span class="dd" class:set={isActive(d, values[d.key])}>{d.label}{#if shown(d)}: <b>{shown(d)}</b>{/if}{@html I.down}</span>{/snippet}
          {#if d.type === 'many'}
            {#each d.options ?? [] as [v, l]}<label class="opt"><input type="checkbox" checked={(values[d.key] ?? []).includes(v)} onchange={() => toggleMany(d, v)} />{l}</label>{/each}
            {#if isActive(d, values[d.key])}<button class="link clrl" onclick={() => clear(d)}>Hapus pilihan</button>{/if}
          {:else if d.type === 'dates'}
            <button class="opt" class:on={!values[d.key]} onclick={() => setOne(d, '')}>Kapan saja</button>
            {#each DATE_PRESETS as [v, l]}<button class="opt" class:on={values[d.key] === v} onclick={() => setOne(d, v)}>{l}</button>{/each}
            <div class="cust" role="group" aria-label="Pilih tanggal">
              {#if custom[d.key]}
                <label>Dari<input type="date" bind:value={custom[d.key].a} /></label>
                <label>Sampai<input type="date" bind:value={custom[d.key].b} /></label>
                <button class="btn sm primary" onclick={() => applyCustom(d)}>Terapkan</button>
              {/if}
            </div>
          {:else if d.type === 'range'}
            <div class="cust">
              {#if custom[d.key]}
                <label>Minimal<input type="number" bind:value={custom[d.key].a} /></label>
                <label>Maksimal<input type="number" bind:value={custom[d.key].b} /></label>
                <button class="btn sm primary" onclick={() => applyCustom(d)}>Terapkan</button>
              {/if}
            </div>
          {:else}
            <button class="opt" class:on={!values[d.key]} onclick={() => setOne(d, '')}>{d.all ?? 'Semua'}</button>
            {#each d.options ?? [] as [v, l]}<button class="opt" class:on={values[d.key] === v} onclick={() => setOne(d, v)}>{l}</button>{/each}
          {/if}
        </Dropdown>
      </span>
    {/each}
    {#if filters.length}<button class="btn mob" class:set={n > 0} onclick={openSheet}>{@html I.filter}Filter{#if n}<em>{n}</em>{/if}</button>{/if}
    {#if extra}{@render extra()}{/if}
  </div>
  {#if n || q}
    <div class="chips fade">
      <span class="muted">Filter aktif:</span>
      {#if q}<span class="fchip">Cari: “{q}”<button aria-label="Hapus pencarian" onclick={() => { q = ''; changed(); }}>{@html I.x}</button></span>{/if}
      {#each filters as d (d.key)}{#if isActive(d, values[d.key])}<span class="fchip">{chipText(d, values[d.key])}<button aria-label="Hapus filter {d.label}" onclick={() => clear(d)}>{@html I.x}</button></span>{/if}{/each}
      <button class="link" onclick={resetAll}>Reset semua</button>
      {#if count !== null}<span class="muted">· {num(count)} hasil</span>{/if}
    </div>
  {/if}
</div>

{#if sheet}
  <div class="sbd" onclick={() => (sheet = false)} role="presentation"></div>
  <div class="sheet" role="dialog" aria-modal="true" aria-label="Filter">
    <div class="grab"></div>
    <div class="sh"><h2>Filter</h2><button class="link" onclick={() => { for (const d of filters) draft[d.key] = d.type === 'many' ? [] : ''; }}>Reset</button></div>
    {#each filters as d (d.key)}
      <div class="grp"><b>{d.label}</b>
        <div class="rch">
          {#if d.type === 'many'}
            {#each d.options ?? [] as [v, l]}<button class:on={(draft[d.key] ?? []).includes(v)} onclick={() => { const c = draft[d.key] ?? []; draft[d.key] = c.includes(v) ? c.filter((x: string) => x !== v) : [...c, v]; }}>{l}</button>{/each}
          {:else if d.type === 'dates'}
            <button class:on={!draft[d.key]} onclick={() => (draft[d.key] = '')}>Kapan saja</button>
            {#each DATE_PRESETS as [v, l]}<button class:on={draft[d.key] === v} onclick={() => (draft[d.key] = v)}>{l}</button>{/each}
          {:else if d.type === 'range'}
            <input type="number" placeholder="min" value={rangeOf(draft[d.key]).min ?? ''} oninput={(e) => { const r = rangeOf(draft[d.key]); const a = (e.target as HTMLInputElement).value; draft[d.key] = a === '' && r.max == null ? '' : `${a}-${r.max ?? ''}`; }} />
            <input type="number" placeholder="maks" value={rangeOf(draft[d.key]).max ?? ''} oninput={(e) => { const r = rangeOf(draft[d.key]); const b = (e.target as HTMLInputElement).value; draft[d.key] = b === '' && r.min == null ? '' : `${r.min ?? ''}-${b}`; }} />
          {:else}
            <button class:on={!draft[d.key]} onclick={() => (draft[d.key] = '')}>{d.all ?? 'Semua'}</button>
            {#each d.options ?? [] as [v, l]}<button class:on={draft[d.key] === v} onclick={() => (draft[d.key] = v)}>{l}</button>{/each}
          {/if}
        </div>
      </div>
    {/each}
    <div class="sf"><button class="btn" onclick={() => (sheet = false)}>Batal</button><button class="btn primary" onclick={applySheet}>Terapkan</button></div>
  </div>
{/if}

<style>
  .fb { display: flex; flex-direction: column; gap: 8px; }
  .line { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .search { position: relative; flex-direction: row; align-items: center; width: min(300px, 100%); font-weight: 400; }
  .search input { padding-left: 34px; padding-right: 30px; }
  .search input::-webkit-search-cancel-button { display: none; }
  .si { position: absolute; left: 10px; width: 16px; height: 16px; color: var(--muted); pointer-events: none; }
  .si :global(svg), .clr :global(svg) { width: 100%; height: 100%; }
  .clr { all: unset; position: absolute; right: 8px; width: 16px; height: 16px; color: var(--muted); cursor: pointer; }
  .dd { display: inline-flex; align-items: center; gap: 6px; background: #fff; border: 1.5px solid #C5CDC8; border-radius: 10px; padding: 6px 10px; min-height: 36px; font-weight: 600; font-size: 13.5px; white-space: nowrap; transition: border-color .15s, background .15s; }
  .dd:hover { border-color: #AEB8B2; }
  .dd b { color: var(--accent); max-width: 160px; overflow: hidden; text-overflow: ellipsis; }
  .dd.set { border-color: var(--accent); background: #F3FAF7; }
  .dd :global(svg) { width: 14px; height: 14px; }
  .opt { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 9px; width: 100%; padding: 7px 9px; border-radius: 8px; font-size: 14px; cursor: pointer; font-weight: 500; }
  .opt:hover { background: var(--hover); }
  .opt.on { background: var(--accent-soft); color: var(--accent); font-weight: 700; }
  label.opt { flex-direction: row; }
  .clrl { margin: 6px 9px 2px; font-size: 13px; }
  .cust { display: flex; flex-direction: column; gap: 8px; padding: 8px 6px 4px; border-top: 1px solid var(--line-soft); margin-top: 4px; }
  .cust label { font-size: 12.5px; }
  .chips { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; font-size: 13px; }
  .fchip { display: inline-flex; align-items: center; gap: 6px; background: var(--accent-soft); color: var(--accent); font-weight: 600; border-radius: 999px; padding: 3px 5px 3px 11px; }
  .fchip button { all: unset; cursor: pointer; width: 16px; height: 16px; background: #fff; border-radius: 50%; padding: 3px; box-sizing: border-box; display: grid; }
  .fchip button :global(svg) { width: 100%; height: 100%; }
  .mob { display: none; }
  .mob.set { border-color: var(--accent); color: var(--accent); }
  .mob em { font-style: normal; background: var(--accent); color: #fff; border-radius: 99px; min-width: 20px; height: 20px; display: grid; place-items: center; font-size: 12px; }
  .mob :global(svg) { width: 15px; height: 15px; }
  .sbd { position: fixed; inset: 0; background: rgba(43,47,74,.38); z-index: 80; animation: fadein .15s; }
  .sheet { position: fixed; left: 0; right: 0; bottom: 0; z-index: 81; max-height: 88vh; overflow-y: auto; background: var(--paper); border-radius: 22px 22px 0 0; padding: 8px 16px 16px; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 -10px 30px rgba(0,0,0,.2); animation: slideup .22s ease-out; }
  .grab { width: 44px; height: 5px; border-radius: 99px; background: #C5CDC8; margin: 0 auto; }
  .sh { display: flex; justify-content: space-between; align-items: center; }
  .grp { display: flex; flex-direction: column; gap: 6px; font-size: 13.5px; }
  .rch { display: flex; flex-wrap: wrap; gap: 6px; }
  .rch button { border: 1.5px solid #C5CDC8; border-radius: 999px; padding: 6px 12px; font: 600 13px var(--body); background: #fff; color: var(--ink); cursor: pointer; }
  .rch button.on { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
  .rch input { width: calc(50% - 3px); }
  .sf { display: flex; gap: 8px; position: sticky; bottom: 0; background: var(--paper); padding-top: 4px; }
  .sf .btn { flex: 1; } .sf .primary { flex: 2; }
  @media (max-width: 760px) {
    .desk { display: none; }
    .mob { display: inline-flex; }
    .search { flex: 1; width: auto; }
  }
</style>
