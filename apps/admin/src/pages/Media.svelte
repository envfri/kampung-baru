<script lang="ts">
  // Media: gambar untuk item, dinding, aksesori. Cari, saring jenis/ukuran/tanggal, salin URL, unggah (bisa seret & lepas), hapus.
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { A, can, err, toast, ask, num, dt, setQuery } from '../lib/store.svelte';
  import { type FDef, readFilters, isActive, inDates } from '../lib/filters';
  import { uploadFile } from '../lib/upload';
  import { I } from '../lib/icons';
  import PageHead from '../components/ui/PageHead.svelte';
  import FilterBar from '../components/ui/FilterBar.svelte';
  import Copy from '../components/ui/Copy.svelte';
  import Ago from '../components/ui/Ago.svelte';
  import Empty from '../components/ui/Empty.svelte';
  import Bar from '../components/ui/Bar.svelte';

  const TYPE: Record<string, string> = { 'image/png': 'PNG', 'image/webp': 'WebP', 'image/jpeg': 'JPG', 'image/svg+xml': 'SVG' };
  const FILTERS: FDef[] = [
    { key: 'type', label: 'Jenis file', type: 'many', options: Object.entries(TYPE) },
    { key: 'size', label: 'Ukuran', all: 'Semua', options: [['s', 'Kecil (< 50 KB)'], ['m', 'Sedang (50–200 KB)'], ['l', 'Besar (> 200 KB)']] },
    { key: 'used', label: 'Dipakai', all: 'Semua', options: [['yes', 'Dipakai item'], ['no', 'Belum dipakai']] },
    { key: 'date', label: 'Diunggah', type: 'dates' },
  ];
  const SORTS: [string, string][] = [['new', 'Terbaru'], ['old', 'Terlama'], ['big', 'Terbesar'], ['small', 'Terkecil'], ['name', 'Nama A–Z']];
  let media = $state<any[]>([]), items = $state<any[]>([]);
  let loading = $state(true), updated = $state(0);
  let q = $state(A.query.q ?? '');
  let vals = $state<Record<string, any>>(readFilters(FILTERS, A.query));
  let sort = $state(SORTS.some((s) => s[0] === A.query.sort) ? A.query.sort : 'new');
  let limit = $state(48);
  const editable = $derived(can('admin'));

  async function load() {
    loading = true;
    try {
      const [m, i] = await Promise.all([api.get('/api/admin/media'), api.quiet('/api/admin/items').catch(() => ({ items: [] }))]);
      media = m.media; items = i.items ?? []; updated = Date.now();
    } catch (e) { err(e); }
    loading = false;
  }
  onMount(load);

  // item yang memakai gambar ini (art.url = /media/<id>)
  const usage = $derived.by(() => {
    const u: Record<string, string[]> = {};
    for (const it of items) { const m = /^\/media\/(.+)$/.exec(it.art?.url ?? ''); if (it.art?.type === 'image' && m) (u[m[1]] ??= []).push(it.name); }
    return u;
  });
  const kb = (b: number) => (b >= 1024 * 100 ? `${num(b / 1024)} KB` : `${(b / 1024).toFixed(1).replace('.', ',')} KB`);
  const shown = $derived.by(() => {
    const n = q.trim().toLowerCase(), v = vals;
    const out = media.filter((m) => (!n || `${m.filename} ${m.id}`.toLowerCase().includes(n))
      && (!v.type?.length || v.type.includes(m.mime))
      && (!v.size || (v.size === 's' ? m.size < 50 * 1024 : v.size === 'm' ? m.size >= 50 * 1024 && m.size <= 200 * 1024 : m.size > 200 * 1024))
      && (!v.used || (v.used === 'yes') === !!usage[m.id])
      && inDates(v.date, m.created_at));
    const t = (m: any) => new Date(m.created_at).getTime();
    const cmp: Record<string, (a: any, b: any) => number> = { new: (a, b) => t(b) - t(a), old: (a, b) => t(a) - t(b), big: (a, b) => b.size - a.size, small: (a, b) => a.size - b.size, name: (a, b) => a.filename.localeCompare(b.filename, 'id') };
    return out.sort(cmp[sort] ?? cmp.new);
  });
  const total = $derived(media.reduce((a, m) => a + (m.size || 0), 0));
  const narrowed = $derived(!!q.trim() || FILTERS.some((f) => isActive(f, vals[f.key])));
  function resetFilters() { q = ''; for (const f of FILTERS) vals[f.key] = f.type === 'many' ? [] : ''; setQuery({ sort: sort === 'new' ? '' : sort }); }
  function setSort(s: string) { sort = s; limit = 48; setQuery({ q, ...vals, sort: s === 'new' ? '' : s }); }

  /* ---------- unggah ---------- */
  let up = $state<null | { done: number; total: number; name: string }>(null);
  let drag = $state(false);
  let picker = $state<HTMLInputElement>();
  async function upload(files: File[]) {
    if (!editable || up || !files.length) return;
    const ok = files.filter((f) => TYPE[f.type]);
    if (ok.length < files.length) toast(`${files.length - ok.length} file dilewati: hanya PNG, WebP, JPG, atau SVG.`, 'err');
    if (!ok.length) return;
    up = { done: 0, total: ok.length, name: ok[0].name };
    let n = 0;
    for (const f of ok) {
      up = { done: up!.done, total: ok.length, name: f.name };
      try { await uploadFile(f); n++; } catch (x) { toast(`${f.name}: ${x instanceof Error ? x.message : 'gagal diunggah'}`, 'err'); }
      up = { done: up!.done + 1, total: ok.length, name: f.name };
    }
    up = null;
    if (picker) picker.value = '';
    if (n) toast(n === 1 ? 'Gambar diunggah' : `${n} gambar diunggah`);
    load();
  }
  function dropped(e: DragEvent) { e.preventDefault(); drag = false; upload(Array.from(e.dataTransfer?.files ?? [])); }

  /* ---------- hapus ---------- */
  let busyId = $state('');
  async function rm(m: any) {
    const used = usage[m.id] ?? [];
    const ok = await ask({
      title: `Hapus ${m.filename}?`, tone: 'danger', icon: 'trash', typeToConfirm: m.filename, confirm: 'Hapus gambar',
      body: 'Gambar dihapus permanen. Tautan /media/… yang sudah dipakai akan rusak.',
      note: used.length ? `Masih dipakai ${used.length} item: ${used.slice(0, 3).join(', ')}${used.length > 3 ? ', …' : ''}. Ganti gambarnya dulu supaya tidak kosong di game.` : undefined,
    });
    if (!ok) return;
    busyId = m.id;
    try { await api.del(`/api/admin/media/${m.id}`); toast(`${m.filename} dihapus`); media = media.filter((x) => x.id !== m.id); } catch (e) { err(e); } finally { busyId = ''; }
  }
</script>

<svelte:window ondragover={(e) => { if (editable && e.dataTransfer?.types.includes('Files')) { e.preventDefault(); drag = true; } }} ondragleave={(e) => { if (!e.relatedTarget) drag = false; }} ondrop={(e) => { if (e.dataTransfer?.types.includes('Files')) e.preventDefault(); drag = false; }} />

<PageHead title="Media" updated={updated} onrefresh={load}>
  {#if media.length}{num(media.length)} gambar · total {kb(total)} · maks 512 KB per file{:else}Gambar untuk item, dinding, atau aksesori. PNG/WebP transparan paling bagus{/if}
  {#snippet actions()}
    {#if editable}
      <label class="btn primary upl" aria-busy={up ? 'true' : undefined}>{@html I.plus}Unggah gambar<input bind:this={picker} type="file" multiple accept="image/png,image/webp,image/jpeg,image/svg+xml" onchange={(e) => upload(Array.from((e.target as HTMLInputElement).files ?? []))} disabled={!!up} /></label>
    {/if}
  {/snippet}
</PageHead>

{#if up}
  <div class="card prog fade" role="status">
    <div class="pl"><b>Mengunggah {up.done + 1 > up.total ? up.total : up.done + 1} dari {up.total}</b><span class="muted">{up.name}</span></div>
    <Bar value={up.done} max={up.total} h={8} label="Kemajuan unggah" />
  </div>
{/if}

<FilterBar bind:q bind:values={vals} filters={FILTERS} placeholder="Cari nama file atau ID" count={shown.length} keep={{ sort: sort === 'new' ? '' : sort }} onchange={() => (limit = 48)}>
  {#snippet extra()}
    <label class="srt"><span class="muted">Urutkan</span><select value={sort} onchange={(e) => setSort((e.target as HTMLSelectElement).value)}>{#each SORTS as [k, l]}<option value={k}>{l}</option>{/each}</select></label>
  {/snippet}
</FilterBar>

{#if loading && !media.length}
  <div class="grid">{#each Array(8) as _}<div class="fig sk"><span class="skel ph"></span><span class="skel" style="width:70%"></span><span class="skel" style="width:40%"></span></div>{/each}</div>
{:else if !shown.length}
  <div class="card">
    {#if narrowed}<Empty icon="search" title="Tidak ada gambar yang cocok" text="Coba kata kunci lain atau hapus beberapa filter."><button class="btn" onclick={resetFilters}>{@html I.x}Hapus filter</button></Empty>
    {:else}<Empty icon="image" title="Belum ada gambar" text={editable ? 'Seret gambar ke sini atau pakai tombol Unggah. PNG/WebP transparan paling bagus, maksimal 512 KB.' : ''}>{#if editable}<button class="btn primary" onclick={() => picker?.click()}>{@html I.plus}Unggah gambar</button>{/if}</Empty>{/if}
  </div>
{:else}
  <div class="grid">
    {#each shown.slice(0, limit) as m (m.id)}
      {@const used = usage[m.id] ?? []}
      <figure class="fig">
        <a class="pv" href="/media/{m.id}" target="_blank" rel="noopener" title="Buka gambar ukuran asli"><img src="/media/{m.id}" alt={m.filename} loading="lazy" /></a>
        {#if editable}<button class="btn sm icon ghost del" title="Hapus" aria-label="Hapus {m.filename}" disabled={busyId === m.id} aria-busy={busyId === m.id ? 'true' : undefined} onclick={() => rm(m)}>{@html I.trash}</button>{/if}
        <figcaption>
          <b title={m.filename}>{m.filename}</b>
          <span class="meta"><span class="chip mute">{TYPE[m.mime] ?? m.mime}</span><span class:big={m.size > 200 * 1024}>{kb(m.size)}</span>·<span title={dt(m.created_at)}><Ago t={m.created_at} /></span></span>
          {#if used.length}<span class="use" title={used.join(', ')}>Dipakai {used.length} item: {used.slice(0, 2).join(', ')}{used.length > 2 ? ', …' : ''}</span>{/if}
          <span class="url"><code>/media/{m.id}</code><Copy text={`/media/${m.id}`} label="URL disalin" /></span>
        </figcaption>
      </figure>
    {/each}
  </div>
  {#if shown.length > limit}
    <div class="more"><button class="btn" onclick={() => (limit += 48)}>Tampilkan lebih banyak ({num(shown.length - limit)} lagi)</button></div>
  {/if}
{/if}

{#if drag}
  <div class="drop fade" ondrop={dropped} ondragover={(e) => e.preventDefault()} role="presentation">
    <div class="dz">{@html I.image}<b>Lepas untuk mengunggah</b><span>PNG, WebP, JPG, SVG · maks 512 KB per file</span></div>
  </div>
{/if}

<style>
  .upl { cursor: pointer; flex-direction: row; }
  .upl input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
  .upl :global(svg) { width: 15px; height: 15px; }
  .prog { display: flex; flex-direction: column; gap: 8px; padding: 12px 16px; }
  .pl { display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; font-size: 13.5px; }
  .pl span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1; }
  .srt { flex-direction: row; align-items: center; gap: 6px; font-weight: 500; }
  .srt select { width: auto; min-height: 36px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
  .fig { margin: 0; background: #fff; border: 1px solid var(--line); border-radius: 14px; overflow: hidden; display: flex; flex-direction: column; position: relative; transition: box-shadow .15s, border-color .15s; }
  .fig:hover { border-color: #C5CDC8; box-shadow: 0 4px 14px rgba(43,47,74,.08); }
  .fig.sk { padding: 10px; gap: 8px; } .fig.sk .ph { height: 120px; border-radius: 10px; }
  .pv { display: block; background: repeating-conic-gradient(#EEF1EE 0 25%, #fff 0 50%) 0 0 / 16px 16px; }
  img { display: block; width: 100%; height: 130px; object-fit: contain; padding: 8px; }
  figcaption { padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 5px; font-size: 12.5px; min-width: 0; }
  figcaption b { font-size: 13.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .meta { display: flex; gap: 6px; align-items: center; color: var(--muted); flex-wrap: wrap; }
  .meta .big { color: var(--warn); font-weight: 700; }
  .use { color: var(--accent); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .url { display: flex; gap: 6px; align-items: center; min-width: 0; }
  .url code { font-family: var(--mono); font-size: 11.5px; background: #F1F4F2; border-radius: 5px; padding: 1px 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .del { position: absolute; top: 6px; right: 6px; background: rgba(255,255,255,.92); color: var(--danger); opacity: 0; transition: opacity .15s; }
  .fig:hover .del, .del:focus-visible { opacity: 1; }
  .del :global(svg) { width: 15px; height: 15px; }
  .more { display: flex; justify-content: center; }
  .drop { position: fixed; inset: 0; z-index: 70; background: rgba(30, 122, 99, .16); display: grid; place-items: center; padding: 20px; }
  .dz { background: #fff; border: 3px dashed var(--accent); border-radius: 22px; padding: 34px 40px; display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; color: var(--muted); pointer-events: none; }
  .dz :global(svg) { width: 40px; height: 40px; color: var(--accent); }
  .dz b { color: var(--ink); font-size: 17px; }
  @media (hover: none) { .del { opacity: 1; } }
  @media (max-width: 760px) {
    .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    img { height: 110px; }
    .srt span { display: none; }
    .srt select { max-width: 116px; }
  }
</style>
