<script lang="ts" module>
  import type { FDef } from '../lib/filters';
  export interface Field { key: string; label: string; type?: 'text' | 'textarea' | 'number' | 'checkbox' | 'select' | 'datetime' | 'color' | 'json'; options?: [string, string][]; help?: string; step?: string; required?: boolean }
  export interface Col {
    key: string; label: string; fmt?: (v: any, row: any) => string; num?: boolean;
    /** nilai untuk urutan, pencarian & CSV (bawaan: nilai mentah / teks dari fmt) */
    text?: (row: any) => string | number | null | undefined;
    /** false = tidak bisa diurutkan */
    sort?: boolean;
    /** tersembunyi bawaan (bisa dimunculkan lewat menu Kolom) */
    off?: boolean;
    /** di HP: 'title' = judul kartu, 'hide' = tidak tampil */
    card?: 'title' | 'hide';
  }
  /** filter tabel; test = cocokkan satu baris (bawaan: nilai kolom `key` sama dengan pilihan) */
  export type CFilter = FDef & { test?: (row: any, v: any) => boolean };
</script>

<script lang="ts">
  // Halaman daftar + laci ubah untuk konten sederhana (tugas, lokasi, paket, pengumuman):
  // cari, filter, urut, halaman, kolom, CSV, konfirmasi hapus dengan mengetik ID, peringatan perubahan belum disimpan.
  import type { Snippet } from 'svelte';
  import { onMount, untrack } from 'svelte';
  import { api } from '../lib/api';
  import { A, can, err, toast, ask, getPath, setPath, toLocal, fromLocal, setQuery } from '../lib/store.svelte';
  import { readFilters, isActive, inDates, rangeOf } from '../lib/filters';
  import { I } from '../lib/icons';
  import Drawer from './Drawer.svelte';
  import PageHead from './ui/PageHead.svelte';
  import FilterBar from './ui/FilterBar.svelte';
  import DataTable, { type Col as DCol, type TState } from './ui/DataTable.svelte';
  import Switch from './ui/Switch.svelte';
  import Copy from './ui/Copy.svelte';

  let {
    title, desc = '', endpoint, listKey, idKey = 'id', idOnCreate = true, columns, fields, blank, editMin = 'admin', deleteLabel = 'Hapus',
    deleteSoft = false, deleteNote = '', confirmText, noun = '', filters = [], match, placeholder = '', rowClass, preview, extra,
  }: {
    title: string; desc?: string; endpoint: string; listKey: string; idKey?: string; idOnCreate?: boolean;
    columns: Col[]; fields: Field[]; blank: () => any; editMin?: 'moderator' | 'admin' | 'owner'; deleteLabel?: string;
    /** tombol hapus sebenarnya menonaktifkan (bisa dibalik): konfirmasi biasa tanpa mengetik ID */
    deleteSoft?: boolean;
    /** keterangan di modal konfirmasi hapus */
    deleteNote?: string;
    /** teks yang harus diketik untuk konfirmasi hapus (bawaan: ID baris) */
    confirmText?: (row: any) => string;
    /** sebutan satu baris, huruf kecil (mis. "tugas", "lokasi") */
    noun?: string;
    filters?: CFilter[];
    /** pencocok filter sendiri (menggantikan pencocok bawaan per filter) */
    match?: (row: any, vals: Record<string, any>) => boolean;
    placeholder?: string;
    rowClass?: (r: any) => string;
    preview?: Snippet<[any]>; extra?: Snippet<[any[]]>;
  } = $props();

  const word = $derived(noun || title.toLowerCase());
  const pk = $derived('crud:' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  let rows = $state<any[]>([]), loading = $state(true), more = $state(false);
  let form = $state<any>(null), snap = $state(''), creating = $state(false), busy = $state(false);
  const editable = $derived(can(editMin));

  /* ---------- daftar: cari, filter, urut ---------- */
  let q = $state(A.query.q ?? '');
  let vals = $state<Record<string, any>>(readFilters(untrack(() => filters), A.query));
  let ts = $state<TState>({ page: 0, size: 25, sort: A.query.sort ?? '', dir: A.query.dir === 'asc' ? 'asc' : 'desc' });
  const keep = () => ({ sort: ts.sort, dir: ts.sort && ts.dir === 'asc' ? 'asc' : '' });

  const strip = (h: string) => h.replace(/<br\s*\/?>/gi, ' · ').replace(/<\/?(span|b|i|em|small)[^>]*>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  // nilai sel: angka & tanggal mentah (supaya urutan benar), selain itu teks yang tampil
  function textOf(c: Col, r: any): string | number {
    if (c.text) return c.text(r) ?? '';
    const raw = getPath(r, c.key);
    if (raw == null || raw === '') return '';
    if (typeof raw === 'number' || (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(raw))) return raw;
    if (c.fmt) return strip(String(c.fmt(raw, r) ?? ''));
    if (typeof raw === 'boolean') return raw ? 'ya' : 'tidak';
    return typeof raw === 'object' ? JSON.stringify(raw) : raw;
  }
  const titleKey = $derived(columns.find((c) => c.card === 'title')?.key ?? columns.find((c) => c.key === 'name' || c.key === 'title')?.key ?? columns[0]?.key);
  const cols = $derived<DCol[]>(columns.map((c) => ({
    key: c.key, label: c.label, num: c.num, off: c.off, req: c.key === titleKey, sort: c.sort !== false,
    card: c.card ?? (c.key === titleKey ? 'title' : undefined),
    text: (r: any) => textOf(c, r),
    html: c.fmt ? (r: any) => c.fmt!(getPath(r, c.key), r) : undefined,
  })));

  function hay(r: any) {
    const parts = [String(r[idKey] ?? '')];
    for (const c of columns) {
      const raw = getPath(r, c.key);
      if (raw != null && typeof raw !== 'object') parts.push(String(raw));
      if (c.text) parts.push(String(c.text(r) ?? ''));
      if (c.fmt) parts.push(strip(String(c.fmt(raw, r) ?? '')));
    }
    return parts.join(' ').toLowerCase();
  }
  function testOne(f: CFilter, r: any, v: any) {
    if (f.test) return f.test(r, v);
    const x = getPath(r, f.key);
    if (f.type === 'many') return (v as string[]).includes(String(x));
    if (f.type === 'dates') return inDates(v, x);
    if (f.type === 'range') { const g = rangeOf(v), n = Number(x); return (g.min == null || n >= g.min) && (g.max == null || n <= g.max); }
    return String(x ?? '') === String(v);
  }
  const pass = (r: any) => (match ? match(r, vals) : filters.every((f) => !isActive(f, vals[f.key]) || testOne(f, r, vals[f.key])));
  const shown = $derived.by(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => (!needle || hay(r).includes(needle)) && pass(r));
  });
  const narrowed = $derived(!!q.trim() || filters.some((f) => isActive(f, vals[f.key])));
  function resetFilters() {
    q = '';
    for (const f of filters) vals[f.key] = f.type === 'many' ? [] : '';
    ts.page = 0; setQuery({ ...keep() });
  }

  async function load() {
    loading = true;
    try {
      rows = (await api.get(endpoint))[listKey] ?? [];
      // buka langsung dari tautan (#/halaman/<id>)
      if (A.arg && !form) { const r = rows.find((x) => String(x[idKey]) === A.arg); if (r) open(r); }
    } catch (e) { err(e); }
    loading = false;
  }
  onMount(load);

  /* ---------- laci ubah ---------- */
  const nameOf = (r: any) => String(r?.name || r?.title || r?.[idKey] || '');
  function setArg(a: string) { if (A.arg !== a) { A.arg = a; setQuery({ q, ...vals, ...keep() }); } }
  function open(row: any | null) {
    creating = !row;
    const f = JSON.parse(JSON.stringify(row ?? blank()));
    for (const fl of fields) {
      const v = getPath(f, fl.key);
      if (fl.type === 'datetime') setPath(f, fl.key, toLocal(v));
      if (fl.type === 'json') setPath(f, fl.key, JSON.stringify(v ?? {}));
      // isian angka disimpan sebagai teks, supaya mengetik ulang nilai yang sama tidak dianggap berubah
      if (fl.type === 'number') setPath(f, fl.key, v == null ? '' : String(v));
    }
    form = f; snap = JSON.stringify(f);
    setArg(row ? String(row[idKey]) : '');
  }
  function close() { form = null; setArg(''); }
  const dirty = $derived(!!form && editable && JSON.stringify(form) !== snap);

  async function save() {
    if (busy) return;
    busy = true;
    try {
      const body = JSON.parse(JSON.stringify(form));
      for (const f of fields) {
        if (f.type === 'datetime') setPath(body, f.key, fromLocal(getPath(form, f.key)));
        if (f.type === 'number') { const v = getPath(form, f.key); setPath(body, f.key, v === '' || v == null ? null : Number(v)); }
        if (f.type === 'json') {
          try { setPath(body, f.key, JSON.parse(getPath(form, f.key) || '{}')); }
          catch { throw new Error(`${f.label}: format JSON tidak valid, contoh {"type":"mandi"}`); }
        }
      }
      if (creating) await api.post(endpoint, body);
      else await api.put(`${endpoint}/${encodeURIComponent(form[idKey])}`, body);
      toast(creating ? `${nameOf(body) || 'Data'} ditambahkan` : 'Perubahan tersimpan');
      close();
      load();
    } catch (e) { err(e); } finally { busy = false; }
  }
  async function remove() {
    if (!form || busy) return;
    const id = String(form[idKey]), name = nameOf(form);
    const ok = await ask(deleteSoft
      ? { title: `${deleteLabel} ${name}?`, body: deleteNote || 'Tidak tampil lagi untuk pemain, tapi datanya tetap tersimpan dan bisa diaktifkan lagi.', tone: 'warn', icon: 'eyeOff', confirm: deleteLabel }
      : { title: `${deleteLabel} ${name}?`, body: deleteNote || 'Data ini dihapus permanen dan tidak bisa dikembalikan.', tone: 'danger', icon: 'trash', typeToConfirm: confirmText ? confirmText(form) : id, confirm: deleteLabel });
    if (!ok) return;
    busy = true;
    try {
      const r = await api.del(`${endpoint}/${encodeURIComponent(id)}`);
      toast(r?.message ?? (deleteSoft ? `${name} dinonaktifkan` : `${name} dihapus`));
      close(); load();
    } catch (e) { err(e); } finally { busy = false; }
  }
  const wide = (f: Field) => !f.type || f.type === 'text' || f.type === 'textarea' || f.type === 'json' || f.type === 'select' || f.type === 'checkbox';
  const val = (e: Event) => (e.target as HTMLInputElement).value;
</script>

<PageHead title={title} onrefresh={load}>
  {#if desc}<span class="desc" class:more>{desc}</span>{#if !more}<button class="link morebtn" onclick={() => (more = true)}>Selengkapnya</button>{/if}{/if}
  {#snippet actions()}
    {#if editable}<button class="btn primary" onclick={() => open(null)}>{@html I.plus}Tambah {word}</button>{/if}
  {/snippet}
</PageHead>

{#if extra}{@render extra(rows)}{/if}

<FilterBar bind:q bind:values={vals} {filters} placeholder={placeholder || `Cari ${word}…`} count={shown.length} keep={keep()} onchange={() => (ts.page = 0)} />

<DataTable {cols} rows={shown} bind:state={ts} onstate={() => setQuery({ q, ...vals, ...keep() })} {loading} idKey={idKey} prefKey={pk} csv="local" csvName={pk.slice(5)}
  onrow={open} {rowClass} emptyIcon={narrowed ? 'search' : 'box'}
  empty={narrowed ? `Tidak ada ${word} yang cocok` : `Belum ada ${word}`}
  emptyText={narrowed ? 'Coba kata kunci lain atau hapus beberapa filter.' : editable ? 'Tambahkan yang pertama lewat tombol di bawah.' : ''}>
  {#snippet emptyActions()}
    {#if narrowed}<button class="btn" onclick={resetFilters}>{@html I.x}Hapus filter</button>
    {:else if editable}<button class="btn primary" onclick={() => open(null)}>{@html I.plus}Tambah {word}</button>{/if}
  {/snippet}
</DataTable>

{#if form}
  <Drawer title={creating ? `Tambah ${word}` : nameOf(form)} onclose={close} {dirty}>
    {#snippet head()}
      <div class="dh">
        <h2>{creating ? `Tambah ${word}` : nameOf(form) || '…'}</h2>
        {#if !creating}<p><span class="mono">{form[idKey]}</span><Copy text={String(form[idKey])} label="ID disalin" />{#if dirty}<span class="chip warn">Belum disimpan</span>{/if}</p>{/if}
      </div>
    {/snippet}
    {#if preview}{@render preview(form)}{/if}
    <div class="fgrid">
      {#if creating && idOnCreate}
        <label class="w">ID<input bind:value={form[idKey]} placeholder="huruf-kecil-dan-tanda-hubung" disabled={!editable} autocomplete="off" /><span class="help">Dipakai di kode & tautan. Tidak bisa diubah setelah dibuat.</span></label>
      {/if}
      {#each fields as f (f.key)}
        {#if f.type === 'checkbox'}
          <div class="w sw"><Switch checked={!!getPath(form, f.key)} onchange={(v) => setPath(form, f.key, v)} disabled={!editable} label={f.label} help={f.help ?? ''} /></div>
        {:else}
          <label class:w={wide(f)}>{f.label}
            {#if f.type === 'json'}<input class="mono" value={getPath(form, f.key) ?? '{}'} oninput={(e) => setPath(form, f.key, val(e))} disabled={!editable} spellcheck="false" />
            {:else if f.type === 'textarea'}<textarea value={getPath(form, f.key) ?? ''} oninput={(e) => setPath(form, f.key, val(e))} disabled={!editable}></textarea>
            {:else if f.type === 'select'}<select value={getPath(form, f.key) ?? ''} onchange={(e) => setPath(form, f.key, val(e))} disabled={!editable}>{#each f.options ?? [] as [v, l]}<option value={v}>{l}</option>{/each}</select>
            {:else if f.type === 'color'}<span class="row"><input type="color" value={getPath(form, f.key) ?? '#000000'} oninput={(e) => setPath(form, f.key, val(e))} disabled={!editable} /><span class="mono">{getPath(form, f.key) ?? ''}</span></span>
            {:else}<input type={f.type === 'number' ? 'number' : f.type === 'datetime' ? 'datetime-local' : 'text'} step={f.step} value={getPath(form, f.key) ?? ''} oninput={(e) => setPath(form, f.key, val(e))} disabled={!editable} />{/if}
            {#if f.help}<span class="help">{f.help}</span>{/if}
          </label>
        {/if}
      {/each}
    </div>
    {#snippet footer()}
      {#if editable}
        {#if !creating}<button class="btn danger" disabled={busy} onclick={remove}>{@html deleteSoft ? I.eyeOff : I.trash}{deleteLabel}…</button>{/if}
        <span class="sp"></span>
        <button class="btn" onclick={() => (dirty ? open(creating ? null : rows.find((r) => String(r[idKey]) === String(form[idKey])) ?? null) : close())} disabled={busy}>{dirty ? 'Batalkan perubahan' : 'Tutup'}</button>
        <button class="btn primary" disabled={busy || (!creating && !dirty)} aria-busy={busy ? 'true' : undefined} onclick={save}>{@html I.check}{creating ? 'Tambah' : 'Simpan'}</button>
      {:else}<span class="muted">Hanya bisa dilihat: peran kamu tidak bisa mengubah.</span>{/if}
    {/snippet}
  </Drawer>
{/if}

<style>
  .dh { min-width: 0; }
  .dh h2 { font-size: 22px; overflow-wrap: anywhere; }
  .dh p { margin: 4px 0 0; color: var(--muted); font-size: 13px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .fgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .fgrid > .w { grid-column: 1 / -1; }
  .sw { padding: 2px 0; }
  .sp { flex: 1; }
  .morebtn { display: none; font-size: 13px; }
  :global(.dt .l2) { display: block; font-size: 13px; color: var(--muted); font-weight: 400; }
  @media (max-width: 760px) {
    .desc:not(.more) { display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .morebtn { display: inline; }
  }
  .btn :global(svg) { width: 15px; height: 15px; }
  :global(.dt tr.dim td:not(.cbc)) { opacity: .62; }
  @media (max-width: 520px) { .fgrid { grid-template-columns: 1fr; } }
</style>
