<script lang="ts">
  // Aktivitas di rumah: pet memakai mebel (tidur di kasur, duduk di sofa, siram tanaman, ...) atau melihat
  // jendela/lukisan. Admin bisa menambah aktivitas baru, mengubah efek & jeda, atau mematikannya.
  import { onMount, tick, untrack } from 'svelte';
  import { ACTIVITY_ANIMS, renderRoom, ROOM_VIEWBOX } from '@kb/shared';
  import { api } from '../lib/api';
  import { A, can, err, toast, ask, num, setQuery } from '../lib/store.svelte';
  import { type FDef, readFilters, isActive } from '../lib/filters';
  import { I } from '../lib/icons';
  import PageHead from '../components/ui/PageHead.svelte';
  import FilterBar from '../components/ui/FilterBar.svelte';
  import DataTable, { type Col, type TState } from '../components/ui/DataTable.svelte';
  import Copy from '../components/ui/Copy.svelte';
  import Drawer from '../components/Drawer.svelte';

  const NEEDS = ['kenyang', 'bersih', 'ceria', 'energi', 'berat'] as const;
  let list = $state<any[]>([]);
  let anims = $state<Record<string, string>>({});
  let spots = $state<Record<string, string>>({});
  let items = $state<any[]>([]);
  let loading = $state(true), updated = $state(0);
  let addItem = $state('');
  const editable = $derived(can('admin'));
  const shapes = $derived<{ key: string; label: string }[]>(A.me?.builtins?.furniture ?? []);
  const furniture = $derived(items.filter((i) => i.kind === 'furniture'));

  const label = (t: string) => {
    const [k, v] = t.split(':');
    if (k === 'spot') return spots[v] ?? v;
    if (k === 'item') return items.find((i) => i.id === v)?.name ?? v;
    return `Semua ${shapes.find((s) => s.key === v)?.label.toLowerCase() ?? v}`;
  };
  const eff = (e: Record<string, number>) => Object.entries(e ?? {}).map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${k}`).join(', ');
  const cd = (s: number) => (s >= 3600 ? `${Math.round(s / 360) / 10} jam` : s >= 60 ? `${Math.round(s / 6) / 10} mnt` : `${s} dtk`);
  const reward = (a: any) => [eff(a.effects), a.xp && `${a.xp} XP`, a.coins && `${a.coins} koin`, a.reward_item && `+1 ${items.find((i) => i.id === a.reward_item)?.name ?? a.reward_item}`].filter(Boolean).join(' · ');

  /* ---------- daftar ---------- */
  const FILTERS = $derived<FDef[]>([
    { key: 'status', label: 'Status', all: 'Semua', options: [['on', 'Aktif'], ['off', 'Nonaktif']] },
    { key: 'place', label: 'Dipakai di', type: 'many', options: [['art', 'Bentuk mebel'], ['item', 'Mebel tertentu'], ['spot', 'Bagian ruangan']] },
    { key: 'anim', label: 'Animasi', all: 'Semua', options: Object.entries(anims).map(([k, l]): [string, string] => [k, l.replace(/ \(.*\)$/, '')]) },
    { key: 'gift', label: 'Hadiah', all: 'Semua', options: [['coin', 'Ada koin'], ['item', 'Ada barang'], ['xp', 'Ada XP'], ['none', 'Tanpa hadiah']] },
    { key: 'limit', label: 'Batas harian', all: 'Semua', options: [['yes', 'Ada batas'], ['no', 'Tanpa batas']] },
  ]);
  let q = $state(A.query.q ?? '');
  let vals = $state<Record<string, any>>(readFilters(untrack(() => FILTERS), A.query));
  let ts = $state<TState>({ page: 0, size: 25, sort: A.query.sort ?? '', dir: A.query.dir === 'asc' ? 'asc' : 'desc' });
  const keep = () => ({ sort: ts.sort, dir: ts.sort && ts.dir === 'asc' ? 'asc' : '' });
  function pass(a: any) {
    const v = vals;
    if (v.status && (v.status === 'on') !== !!a.active) return false;
    if (v.place?.length && !a.targets.some((t: string) => v.place.includes(t.split(':')[0]))) return false;
    if (v.anim && a.anim !== v.anim) return false;
    if (v.gift === 'coin' && !(a.coins > 0)) return false;
    if (v.gift === 'item' && !a.reward_item) return false;
    if (v.gift === 'xp' && !(a.xp > 0)) return false;
    if (v.gift === 'none' && (a.coins > 0 || a.reward_item || a.xp > 0)) return false;
    if (v.limit && (v.limit === 'yes') !== a.daily_limit > 0) return false;
    return true;
  }
  const shown = $derived.by(() => {
    const n = q.trim().toLowerCase();
    return list.filter((a) => (!n || `${a.name} ${a.id} ${a.message ?? ''} ${a.targets.map(label).join(' ')}`.toLowerCase().includes(n)) && pass(a));
  });
  const narrowed = $derived(!!q.trim() || FILTERS.some((f) => isActive(f, vals[f.key])));
  function resetFilters() { q = ''; for (const f of FILTERS) vals[f.key] = f.type === 'many' ? [] : ''; ts.page = 0; setQuery({ ...keep() }); }
  const COLS: Col[] = [
    { key: 'who', label: 'Aktivitas', req: true, snip: true, card: 'title', sort: 'name', text: (a) => a.name },
    { key: 'targets', label: 'Dipakai di', text: (a) => a.targets.map(label).join(', ') },
    { key: 'anim', label: 'Animasi', sort: true, text: (a) => (anims[a.anim] ?? a.anim).replace(/ \(.*\)$/, '') },
    { key: 'reward', label: 'Efek & hadiah', text: reward },
    { key: 'cooldown_sec', label: 'Jeda', num: true, sort: true, text: (a) => a.cooldown_sec, html: (a) => cd(a.cooldown_sec) },
    { key: 'daily_limit', label: 'Maks/hari', num: true, sort: true, text: (a) => a.daily_limit, html: (a) => (a.daily_limit ? `${a.daily_limit}×` : '<span class="muted">—</span>') },
    { key: 'min_level', label: 'Level min', num: true, sort: true, off: true, text: (a) => a.min_level },
    { key: 'xp', label: 'XP', num: true, sort: true, off: true, text: (a) => a.xp },
    { key: 'coins', label: 'Koin', num: true, sort: true, off: true, text: (a) => a.coins },
    { key: 'sort', label: 'Urutan', num: true, sort: true, off: true, text: (a) => a.sort },
    { key: 'status', label: 'Status', sort: true, text: (a) => (a.active ? 'Aktif' : 'Nonaktif'), html: (a) => (a.active ? '<span class="chip">Aktif</span>' : '<span class="chip mute">Nonaktif</span>') },
  ];

  async function load() {
    loading = true;
    try {
      const [a, i] = await Promise.all([api.get('/api/admin/activities'), api.get('/api/admin/items')]);
      list = a.activities; anims = a.anims; spots = a.spots; items = i.items; updated = Date.now();
      if (A.arg && !form) { const r = list.find((x) => x.id === A.arg); if (r) open(r); }
    } catch (e) { err(e); }
    loading = false;
  }
  onMount(load);

  /* ---------- laci ubah ---------- */
  let form = $state<any>(null), snap = $state(''), creating = $state(false), busy = $state(false);
  function setArg(x: string) { if (A.arg !== x) { A.arg = x; setQuery({ q, ...vals, ...keep() }); } }
  async function open(row: any | null) {
    creating = !row; addItem = '';
    const f = JSON.parse(JSON.stringify(row ?? { id: '', name: '', description: '', targets: [], anim: 'lihat', effects: { ceria: 5 }, xp: 1, coins: 0, reward_item: '', cooldown_sec: 300, daily_limit: 0, min_level: 1, message: '{pet} ... {item}.', active: true, sort: 1000 }));
    f.reward_item ??= '';
    for (const k of NEEDS) f.effects[k] ??= '';
    form = f; snap = norm(f);
    setArg(row ? row.id : '');
    await tick(); if (form === f) snap = norm(form);
  }
  function close() { form = null; setArg(''); }
  // kosong (''/null/false/tidak ada) dianggap sama: isian centang & pilihan bisa mengisi nilai bawaan saat tampil
  const norm = (v: unknown) => JSON.stringify(v, (_k, x) => (x === '' || x === null || x === false ? undefined : x));
  const dirty = $derived(!!form && editable && norm(form) !== snap);
  function toggle(t: string) {
    form.targets = form.targets.includes(t) ? form.targets.filter((x: string) => x !== t) : [...form.targets, t];
  }
  async function save() {
    if (busy) return;
    busy = true;
    try {
      const body = { ...form, reward_item: form.reward_item || null, effects: Object.fromEntries(Object.entries(form.effects).filter(([, v]) => v !== '' && v !== null && Number(v) !== 0).map(([k, v]) => [k, Number(v)])) };
      if (creating) await api.post('/api/admin/activities', body); else await api.put(`/api/admin/activities/${form.id}`, body);
      toast(creating ? `${form.name} ditambahkan. Pemain melihatnya dalam ±15 detik.` : 'Aktivitas tersimpan. Pemain melihat perubahan dalam ±15 detik.');
      close(); load();
    } catch (e) { err(e); } finally { busy = false; }
  }
  async function remove() {
    if (!form || busy) return;
    const ok = await ask({
      title: `Hapus aktivitas ${form.name}?`, tone: 'danger', icon: 'trash', typeToConfirm: form.id, confirm: 'Hapus aktivitas',
      body: `Tombol "${form.name}" hilang dari mebel di rumah semua pemain. Kalau hanya ingin istirahat sebentar, matikan saja (Aktif).`,
    });
    if (!ok) return;
    busy = true;
    try { await api.del(`/api/admin/activities/${form.id}`); toast(`${form.name} dihapus`); close(); load(); } catch (e) { err(e); } finally { busy = false; }
  }

  // pratinjau: mebel target pertama + pet dalam pose aktivitasnya
  const preview = $derived.by(() => {
    if (!form) return '';
    const t: string | undefined = form.targets.find((x: string) => !x.startsWith('spot:'));
    const a = ACTIVITY_ANIMS[form.anim] ?? ACTIVITY_ANIMS.lihat;
    let it: any = null;
    if (t?.startsWith('item:')) it = items.find((i) => i.id === t.slice(5));
    else if (t?.startsWith('art:')) it = furniture.find((i) => i.art?.key === t.slice(4)) ?? { id: 'x', kind: 'furniture', name: '', art: { type: 'builtin', key: t.slice(4) }, data: { w: 1, d: 1 } };
    const w = Math.max(1, Number(it?.data?.w) || 1), d = Math.max(1, Number(it?.data?.d) || 1);
    const layout = it ? [{ i: it.id, x: 1, y: 1 }] : [];
    const pos: [number, number] = it && a.on ? [1 + w / 2, 1 + d / 2] : it ? [1 + w + 0.5, 1 + d / 2] : [1.5, 0.5];
    return renderRoom({ layout, items: it ? { [it.id]: it } : {}, size: 4, pet: { look: { color: '#F6B7A8', ear: 'tunas' }, wear: [], pos, lift: a.on ? a.lift : 0, pose: form.anim, prop: a.prop, flip: !it } });
  });
</script>

<PageHead title="Aktivitas di rumah" updated={updated} onrefresh={load}>
  {#if list.length}{num(list.length)} aktivitas · {num(list.filter((a) => a.active).length)} aktif · pemain mengetuk mebel, pet beraktivitas{:else}Pemain mengetuk mebel (atau jendela/lukisan), pet berjalan ke sana lalu beraktivitas{/if}
  {#snippet actions()}{#if editable}<button class="btn primary" onclick={() => open(null)}>{@html I.plus}Aktivitas baru</button>{/if}{/snippet}
</PageHead>

<FilterBar bind:q bind:values={vals} filters={FILTERS} placeholder="Cari nama, ID, mebel" count={shown.length} keep={keep()} onchange={() => (ts.page = 0)} />

<DataTable cols={COLS} rows={shown} bind:state={ts} onstate={() => setQuery({ q, ...vals, ...keep() })} {loading} prefKey="activities" csv="local" csvName="aktivitas"
  onrow={open} rowClass={(a) => (a.active ? '' : 'dim')} emptyIcon={narrowed ? 'search' : 'spark'}
  empty={narrowed ? 'Tidak ada aktivitas yang cocok' : 'Belum ada aktivitas'} emptyText={narrowed ? 'Coba kata kunci lain atau hapus beberapa filter.' : ''}>
  {#snippet emptyActions()}
    {#if narrowed}<button class="btn" onclick={resetFilters}>{@html I.x}Hapus filter</button>
    {:else if editable}<button class="btn primary" onclick={() => open(null)}>{@html I.plus}Aktivitas baru</button>{/if}
  {/snippet}
  {#snippet cell(a, k)}
    {#if k === 'who'}<span class="nm"><b>{a.name}</b><small class="mono">{a.id}</small></span>{/if}
  {/snippet}
</DataTable>

{#if form}
  <Drawer wide title={creating ? 'Aktivitas baru' : form.name} onclose={close} {dirty}>
    {#snippet head()}
      <div class="dh">
        <h2>{creating ? 'Aktivitas baru' : form.name || '…'}</h2>
        <p>
          {#if form.active}<span class="chip">Aktif</span>{:else}<span class="chip mute">Nonaktif</span>{/if}
          {#if !creating}<span class="mono">{form.id}</span><Copy text={form.id} label="ID disalin" />{/if}
          {#if dirty}<span class="chip warn">Belum disimpan</span>{/if}
        </p>
      </div>
    {/snippet}
    <div class="cols">
      <fieldset class="formcol" disabled={!editable}>
        {#if creating}<label>ID<input bind:value={form.id} placeholder="mis. main-gitar" autocomplete="off" /><span class="help">Huruf kecil, angka, tanda hubung. Tidak bisa diubah.</span></label>{/if}
        <div class="grid2">
          <label>Nama tombol<input bind:value={form.name} maxlength="30" placeholder="mis. Tidur" /></label>
          <label>Animasi<select bind:value={form.anim}>{#each Object.entries(anims) as [k, l]}<option value={k}>{l}</option>{/each}</select></label>
        </div>
        <fieldset>
          <legend>Bisa dilakukan di {#if form.targets.length}<span class="chip blue">{form.targets.length} dipilih</span>{/if}</legend>
          <span class="help">Pilih bentuk mebel (semua item dengan bentuk itu ikut), mebel tertentu, atau bagian ruangan.</span>
          <div class="chips">
            {#each Object.entries(spots) as [k, l]}<label class="pick" class:on={form.targets.includes('spot:' + k)}><input type="checkbox" checked={form.targets.includes('spot:' + k)} onchange={() => toggle('spot:' + k)} />{l}</label>{/each}
          </div>
          <div class="chips">
            {#each shapes as s}<label class="pick" class:on={form.targets.includes('art:' + s.key)}><input type="checkbox" checked={form.targets.includes('art:' + s.key)} onchange={() => toggle('art:' + s.key)} />{s.label}</label>{/each}
          </div>
          <div class="row">
            <select bind:value={addItem} aria-label="Mebel tertentu" class="addsel"><option value="">+ Mebel tertentu…</option>{#each furniture as i}<option value={i.id}>{i.name}</option>{/each}</select>
            <button class="btn sm" type="button" disabled={!addItem} onclick={() => { if (!form.targets.includes('item:' + addItem)) form.targets = [...form.targets, 'item:' + addItem]; addItem = ''; }}>{@html I.plus}Tambah</button>
          </div>
          {#if form.targets.some((t: string) => t.startsWith('item:'))}
            <div class="chips">{#each form.targets.filter((t: string) => t.startsWith('item:')) as t}<span class="chip">{label(t)} <button type="button" class="x" onclick={() => toggle(t)} aria-label="Hapus {label(t)}">{@html I.x}</button></span>{/each}</div>
          {/if}
        </fieldset>
        <fieldset>
          <legend>Efek & hadiah</legend>
          <div class="grid5">{#each NEEDS as k}<label>{k}<input type="number" min="-100" max="100" bind:value={form.effects[k]} /></label>{/each}</div>
          <span class="help">berat negatif = olahraga (menurunkan berat badan pet yang gembul).</span>
          <div class="grid3">
            <label>XP<input type="number" min="0" bind:value={form.xp} /></label>
            <label>Koin<input type="number" min="0" bind:value={form.coins} /></label>
            <label>Hadiah barang<select bind:value={form.reward_item}><option value="">Tidak ada</option>{#each items.filter((i) => i.kind !== 'room') as i}<option value={i.id}>{i.name}</option>{/each}</select></label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Batas</legend>
          <div class="grid3">
            <label>Jeda (detik)<input type="number" min="0" bind:value={form.cooldown_sec} /><span class="help">{cd(Number(form.cooldown_sec) || 0)}</span></label>
            <label>Maks per hari<input type="number" min="0" bind:value={form.daily_limit} /><span class="help">0 = tanpa batas</span></label>
            <label>Level minimal<input type="number" min="1" bind:value={form.min_level} /></label>
          </div>
        </fieldset>
        <label>Pesan setelah selesai<input bind:value={form.message} maxlength="120" /><span class="help">{'{pet}'} = nama pet, {'{item}'} = nama mebel. Contoh: {'{pet}'} tidur nyenyak di {'{item}'}.</span></label>
        <div class="grid2">
          <label>Urutan<input type="number" bind:value={form.sort} /></label>
          <label class="inline act"><input type="checkbox" bind:checked={form.active} />Aktif</label>
        </div>
      </fieldset>
      <div class="prevcol">
        <h3>Pratinjau</h3>
        <div class="room"><svg viewBox={ROOM_VIEWBOX}>{@html preview}</svg></div>
        <p class="muted small">Tombol <b>{form.name || '…'}</b> muncul saat pemain mengetuk {form.targets.length ? form.targets.map(label).join(', ') : 'mebel yang dipilih'}.</p>
      </div>
    </div>
    {#snippet footer()}
      {#if editable}
        {#if !creating}<button class="btn danger" disabled={busy} onclick={remove}>{@html I.trash}Hapus…</button>{/if}
        <span class="sp"></span>
        <button class="btn primary" disabled={busy || (!creating && !dirty)} aria-busy={busy ? 'true' : undefined} onclick={save}>{@html I.check}{creating ? 'Tambah aktivitas' : 'Simpan'}</button>
      {:else}<span class="muted">Hanya bisa dilihat: peran kamu tidak bisa mengubah aktivitas.</span>{/if}
    {/snippet}
  </Drawer>
{/if}

<style>
  .nm { display: flex; flex-direction: column; min-width: 0; } .nm small { color: var(--muted); }
  :global(.dt tr.dim td:not(.cbc)) { opacity: .62; }
  .dh h2 { font-size: 22px; overflow-wrap: anywhere; }
  .dh p { margin: 5px 0 0; color: var(--muted); font-size: 13px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .cols { display: grid; grid-template-columns: 1fr 260px; gap: 18px; }
  .formcol { border: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
  .formcol:disabled { opacity: .8; }
  fieldset { gap: 10px; }
  legend { display: inline-flex; gap: 6px; align-items: center; }
  .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .grid5 { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .pick { display: inline-flex; align-items: center; gap: 5px; border: 1.5px solid var(--line); border-radius: 999px; padding: 3px 10px; font-size: 13.5px; cursor: pointer; flex-direction: row; font-weight: 600; background: #fff; transition: border-color .15s, background .15s; }
  .pick.on { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
  .pick input { width: auto; margin: 0; }
  .addsel { width: auto; max-width: 260px; }
  .x { border: 0; background: none; cursor: pointer; padding: 0; width: 14px; height: 14px; display: inline-grid; color: inherit; }
  .x :global(svg) { width: 100%; height: 100%; }
  .act { align-self: end; min-height: 36px; }
  .prevcol { display: flex; flex-direction: column; gap: 10px; position: sticky; top: 0; align-self: start; }
  .room { background: linear-gradient(#D3E9DF, #B7D7CA); border-radius: 12px; }
  .room svg { display: block; width: 100%; }
  .small { font-size: 12.5px; }
  .sp { flex: 1; }
  .btn :global(svg) { width: 15px; height: 15px; }
  @media (max-width: 760px) { .cols { grid-template-columns: 1fr; } .prevcol { position: static; order: -1; } .prevcol h3 { display: none; } .room { max-width: 240px; } }
  @media (max-width: 560px) { .grid3, .grid5 { grid-template-columns: 1fr 1fr; } }
</style>
