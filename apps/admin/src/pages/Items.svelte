<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import { itemIcon, renderRoom, renderPet, ROOM_VIEWBOX, PREMIUM_SETS, PREMIUM_SET_BY_KEY } from '@kb/shared';
  import { api } from '../lib/api';
  import { A, can, err, toast, ask, num, dt, toLocal, fromLocal, setQuery } from '../lib/store.svelte';
  import { type FDef, readFilters, isActive } from '../lib/filters';
  import { I } from '../lib/icons';
  import PageHead from '../components/ui/PageHead.svelte';
  import FilterBar from '../components/ui/FilterBar.svelte';
  import DataTable, { type Col, type TState } from '../components/ui/DataTable.svelte';
  import Stat from '../components/ui/Stat.svelte';
  import Copy from '../components/ui/Copy.svelte';
  import Drawer from '../components/Drawer.svelte';
  import ArtEditor from '../components/ArtEditor.svelte';

  const KIND: Record<string, string> = { food: 'Makanan', furniture: 'Mebel', wear: 'Pakaian', wallpaper: 'Dinding', floor: 'Lantai', seed: 'Bibit', fish: 'Ikan', material: 'Bahan/lainnya', room: 'Ruangan rumah' };
  let items = $state<any[]>([]);
  let locs = $state<any[]>([]);
  let events = $state<any[]>([]);
  let loading = $state(true), updated = $state(0);
  const editable = $derived(can('admin'));
  const shops = $derived(locs.filter((l) => l.kind === 'shop' || l.kind === 'pearl'));

  /* ---------- daftar: filter, urut, pilih ---------- */
  const FILTERS = $derived<FDef[]>([
    { key: 'kind', label: 'Jenis', type: 'many', options: Object.entries(KIND) },
    { key: 'shop', label: 'Toko', all: 'Semua toko', options: [['-', 'Tidak dijual'], ...shops.map((l): [string, string] => [l.id, l.name])] },
    { key: 'status', label: 'Status', all: 'Semua', options: [['on', 'Aktif'], ['off', 'Nonaktif']] },
    { key: 'cur', label: 'Harga', all: 'Semua', options: [['coin', 'Pakai koin'], ['pearl', 'Pakai Mutiara'], ['free', 'Gratis / 0']] },
    { key: 'set', label: 'Set premium', all: 'Semua', options: [['any', 'Semua set premium'], ...PREMIUM_SETS.map((s): [string, string] => [s.key, s.name]), ['none', 'Bukan set']] },
    { key: 'event', label: 'Event', all: 'Semua', options: [['any', 'Item event'], ['-', 'Bukan item event'], ...events.map((e): [string, string] => [e.id, e.name])] },
  ]);
  let q = $state(A.query.q ?? '');
  let vals = $state<Record<string, any>>(readFilters(untrack(() => FILTERS), A.query));
  let ts = $state<TState>({ page: 0, size: 25, sort: A.query.sort ?? '', dir: A.query.dir === 'asc' ? 'asc' : 'desc' });
  let selected = $state<string[]>([]);
  const keep = () => ({ sort: ts.sort, dir: ts.sort && ts.dir === 'asc' ? 'asc' : '' });

  const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  const shopName = (id: string | null) => (id ? locs.find((l) => l.id === id)?.name ?? id : '');
  const eventName = (id: string | null) => (id ? events.find((e) => e.id === id)?.name ?? id : '');
  const setOf = (i: any) => (i?.data?.set ? PREMIUM_SET_BY_KEY[i.data.set] : undefined);
  function pass(i: any) {
    const v = vals;
    if (v.kind?.length && !v.kind.includes(i.kind)) return false;
    if (v.shop && (v.shop === '-' ? !!i.shop : i.shop !== v.shop)) return false;
    if (v.status && (v.status === 'on') !== !!i.active) return false;
    if (v.cur === 'coin' && !(i.price_coin > 0)) return false;
    if (v.cur === 'pearl' && !(i.price_pearl > 0)) return false;
    if (v.cur === 'free' && (i.price_coin > 0 || i.price_pearl > 0)) return false;
    if (v.set && (v.set === 'any' ? !i.data?.set : v.set === 'none' ? !!i.data?.set : i.data?.set !== v.set)) return false;
    if (v.event && (v.event === 'any' ? !i.event_id : v.event === '-' ? !!i.event_id : i.event_id !== v.event)) return false;
    return true;
  }
  const shown = $derived.by(() => {
    const n = q.trim().toLowerCase();
    return items.filter((i) => (!n || `${i.name} ${i.id} ${i.description ?? ''}`.toLowerCase().includes(n)) && pass(i));
  });
  const narrowed = $derived(!!q.trim() || FILTERS.some((f) => isActive(f, vals[f.key])));
  const counts = $derived({
    on: items.filter((i) => i.active).length, off: items.filter((i) => !i.active).length,
    pearl: items.filter((i) => i.price_pearl > 0).length, event: items.filter((i) => i.event_id).length,
  });
  function quick(k: string, v: string) {
    const cur = vals[k];
    for (const f of FILTERS) vals[f.key] = f.type === 'many' ? [] : '';
    if (cur !== v) vals[k] = v;
    ts.page = 0; selected = [];
    setQuery({ q, ...vals, ...keep() });
  }
  function resetFilters() { q = ''; for (const f of FILTERS) vals[f.key] = f.type === 'many' ? [] : ''; ts.page = 0; setQuery({ ...keep() }); }

  const COLS: Col[] = [
    { key: 'who', label: 'Item', req: true, snip: true, card: 'title', sort: 'name', text: (r) => r.name },
    { key: 'kind', label: 'Jenis', sort: true, text: (r) => KIND[r.kind] ?? r.kind },
    { key: 'shop', label: 'Toko', sort: true, text: (r) => shopName(r.shop), html: (r) => (r.shop ? esc(shopName(r.shop)) : '<span class="muted">Tidak dijual</span>') },
    { key: 'price_coin', label: 'Koin', num: true, sort: true, text: (r) => r.price_coin, html: (r) => (r.price_coin ? num(r.price_coin) : '<span class="muted">—</span>') },
    { key: 'price_pearl', label: 'Mutiara', num: true, sort: true, text: (r) => r.price_pearl, html: (r) => (r.price_pearl ? num(r.price_pearl) : '<span class="muted">—</span>') },
    { key: 'sell_coin', label: 'Harga jual', num: true, sort: true, off: true, text: (r) => r.sell_coin, html: (r) => (r.sell_coin ? num(r.sell_coin) : '<span class="muted">—</span>') },
    { key: 'event', label: 'Event', sort: true, text: (r) => eventName(r.event_id), html: (r) => (r.event_id ? `<span class="chip warn">${esc(eventName(r.event_id))}</span>` : '') },
    { key: 'set', label: 'Set premium', sort: true, off: true, snip: true, text: (r) => setOf(r)?.name ?? '' },
    { key: 'owned', label: 'Dimiliki', num: true, sort: true, text: (r) => r.owned, html: (r) => num(r.owned) },
    { key: 'sort', label: 'Urutan', num: true, sort: true, off: true, text: (r) => r.sort },
    { key: 'avail', label: 'Jadwal jual', off: true, text: (r) => [r.available_from, r.available_to].filter(Boolean).join(' – '),
      html: (r) => (r.available_from || r.available_to ? `${r.available_from ? dt(r.available_from) : '…'} – ${r.available_to ? dt(r.available_to) : '…'}` : '<span class="muted">Selalu</span>') },
    { key: 'status', label: 'Status', sort: true, text: (r) => (r.active ? 'Aktif' : 'Nonaktif'), html: (r) => (r.active ? '<span class="chip">Aktif</span>' : '<span class="chip mute">Nonaktif</span>') },
  ];

  async function load() {
    loading = true;
    try {
      const [i, l, e] = await Promise.all([api.get('/api/admin/items'), api.get('/api/admin/locations'), api.get('/api/admin/events')]);
      items = i.items; locs = l.locations; events = e.events; updated = Date.now();
      selected = selected.filter((id) => items.some((x) => x.id === id));
      if (A.arg && !form) { const it = items.find((x) => x.id === A.arg); if (it) open(it); }
    } catch (e) { err(e); }
    loading = false;
  }
  onMount(load);

  /* ---------- aktif / nonaktif massal ---------- */
  let bulkBusy = $state('');
  async function bulkActive(ids: string[], active: boolean, undo = false) {
    const list = [...ids];
    if (!undo) {
      const same = items.filter((i) => list.includes(i.id) && !!i.active === active).length;
      const ok = await ask({
        title: `${active ? 'Aktifkan' : 'Nonaktifkan'} ${list.length} item?`,
        body: active ? 'Item tampil lagi di toko & game (sesuai jadwal jualnya). Pemain melihat perubahan dalam ±15 detik.' : 'Item hilang dari toko dan tidak bisa dibeli lagi. Item yang sudah dimiliki pemain tetap ada di tas.',
        tone: active ? 'ok' : 'warn', icon: active ? 'eye' : 'eyeOff', confirm: active ? 'Aktifkan' : 'Nonaktifkan',
        note: same ? `${same} item sudah ${active ? 'aktif' : 'nonaktif'}, jadi tidak berubah.` : undefined,
      });
      if (!ok) return;
    }
    bulkBusy = active ? 'on' : 'off';
    try {
      const r = await api.post('/api/admin/items/bulk-active', { ids: list, active });
      if (!undo) selected = [];
      toast(r.count ? `${r.count} item ${active ? 'diaktifkan' : 'dinonaktifkan'}` : 'Tidak ada item yang berubah', r.count ? 'ok' : 'info',
        r.count && !undo ? { label: 'Urungkan', run: () => bulkActive(r.ids, !active, true) } : undefined);
      load();
    } catch (e) { err(e); } finally { bulkBusy = ''; }
  }

  /* ---------- laci ubah ---------- */
  let form = $state<any>(null), snap = $state(''), creating = $state(false), busy = $state(false);
  function blank() {
    return { id: '', kind: 'food', name: '', description: '', price_coin: 10, price_pearl: 0, sell_coin: 0, shop: 'pasar', art: { type: 'builtin', key: 'mangkuk', colors: {} }, data: { effects: { kenyang: 10 } }, event_id: '', available_from: '', available_to: '', active: true, sort: 1000 };
  }
  function setArg(a: string) { if (A.arg !== a) { A.arg = a; setQuery({ q, ...vals, ...keep() }); } }
  async function open(row: any | null) {
    creating = !row;
    const f = JSON.parse(JSON.stringify(row ?? blank()));
    f.available_from = toLocal(f.available_from); f.available_to = toLocal(f.available_to);
    f.event_id ??= ''; f.shop ??= '';
    f.data ??= {}; if (f.kind === 'food') f.data.effects ??= {};
    f.data.set ??= '';
    form = f; snap = norm(f);
    setArg(row ? row.id : '');
    // isian pilihan bisa menormalkan nilai saat tampil; ambil patokan "belum berubah" sesudahnya
    await tick(); if (form === f) snap = norm(form);
  }
  function close() { form = null; setArg(''); }
  // kosong (''/null/false/tidak ada) dianggap sama: isian centang & pilihan bisa mengisi nilai bawaan saat tampil
  const norm = (v: unknown) => JSON.stringify(v, (_k, x) => (x === '' || x === null || x === false ? undefined : x));
  const dirty = $derived(!!form && editable && norm(form) !== snap);
  function changeKind(k: string) {
    const set = form.data?.set ?? '';
    form.kind = k;
    const b = A.me?.builtins?.[k]?.[0];
    form.art = { type: 'builtin', key: b?.key ?? 'kotak', colors: { ...(b?.colors ?? {}) } };
    form.data = k === 'food' ? { effects: { kenyang: 10 } } : k === 'furniture' ? { w: 1, d: 1 } : k === 'wear' ? { slot: b?.slot ?? 'head' } : k === 'seed' ? { growMinutes: 30, yieldItem: 'tomat', yieldQty: 3 } : k === 'room' ? { size: 6, theme: b?.key === 'luar' ? 'luar' : 'dalam' } : {};
    form.data.set = set;
  }
  async function save() {
    if (busy) return;
    busy = true;
    try {
      const { set, ...rest } = form.data ?? {};
      const data = set ? { ...rest, set } : rest;
      const body = { ...form, data, available_from: fromLocal(form.available_from), available_to: fromLocal(form.available_to), shop: form.shop || null, event_id: form.event_id || null };
      if (creating) await api.post('/api/admin/items', body); else await api.put(`/api/admin/items/${form.id}`, body);
      toast(creating ? `${form.name} ditambahkan. Pemain melihatnya dalam ±15 detik.` : 'Item tersimpan. Pemain melihat perubahan dalam ±15 detik.');
      close(); load();
    } catch (e) { err(e); } finally { busy = false; }
  }
  async function remove() {
    if (!form || busy) return;
    const owned = Number(form.owned ?? 0);
    const ok = await ask({
      title: `Hapus ${form.name}?`, tone: 'danger', icon: 'trash', typeToConfirm: form.id, confirm: 'Hapus item',
      body: owned > 0 ? `Item ini dimiliki pemain (${num(owned)}), jadi hanya dinonaktifkan supaya tas & rumah pemain tidak rusak.` : 'Item dihapus permanen dari katalog. Belum ada pemain yang memilikinya.',
    });
    if (!ok) return;
    busy = true;
    try { const r = await api.del(`/api/admin/items/${form.id}`); toast(r.message ?? `${form.name} dihapus`); close(); load(); } catch (e) { err(e); } finally { busy = false; }
  }

  const previewItem = $derived(form ? { ...form, data: form.data } : null);
  const roomPreview = $derived.by(() => {
    if (!previewItem) return '';
    const it = previewItem;
    const map: any = { [it.id || 'x']: { ...it, id: it.id || 'x' } };
    if (it.kind === 'furniture') return renderRoom({ layout: [{ i: it.id || 'x', x: 2, y: 2 }], items: map, size: 6 });
    if (it.kind === 'wallpaper') return renderRoom({ layout: [], items: {}, wall: it, size: 6 });
    if (it.kind === 'floor') return renderRoom({ layout: [], items: {}, floor: it, size: 6 });
    if (it.kind === 'room') {
      const byId = (id: string) => items.find((i) => i.id === id);
      return renderRoom({ layout: [], items: {}, size: Math.max(4, Math.min(14, Number(it.data?.size) || 6)), theme: it.data?.theme, wall: byId(it.data?.wall), floor: byId(it.data?.floor) });
    }
    return '';
  });
</script>

<PageHead title="Item & harga" updated={updated} onrefresh={load}>
  {#if items.length}{num(items.length)} item · {num(counts.on)} aktif · perubahan berlaku tanpa deploy{:else}Semua barang di game: makanan, mebel, pakaian, dekorasi, bibit, ikan{/if}
  {#snippet actions()}{#if editable}<button class="btn primary" onclick={() => open(null)}>{@html I.plus}Item baru</button>{/if}{/snippet}
</PageHead>

<div class="stats">
  <Stat icon="box" value={loading && !items.length ? '…' : num(counts.on)} label="Item aktif" onclick={() => quick('status', 'on')} active={vals.status === 'on'} />
  <Stat icon="eyeOff" value={loading && !items.length ? '…' : num(counts.off)} label="Nonaktif" tone="no" onclick={() => quick('status', 'off')} active={vals.status === 'off'} />
  <Stat icon="gem" value={loading && !items.length ? '…' : num(counts.pearl)} label="Dijual pakai Mutiara" tone="blue" onclick={() => quick('cur', 'pearl')} active={vals.cur === 'pearl'} />
  <Stat icon="cal" value={loading && !items.length ? '…' : num(counts.event)} label="Item event" tone="warn" onclick={() => quick('event', 'any')} active={vals.event === 'any'} />
</div>

<FilterBar bind:q bind:values={vals} filters={FILTERS} placeholder="Cari nama, ID, deskripsi" count={shown.length} keep={keep()} onchange={() => { ts.page = 0; selected = []; }} />

<DataTable cols={COLS} rows={shown} bind:state={ts} onstate={() => setQuery({ q, ...vals, ...keep() })} {loading} selectable={editable} bind:selected prefKey="items"
  csv="local" csvName="item" onrow={open} rowClass={(r) => (r.active ? '' : 'dim')} emptyIcon={narrowed ? 'search' : 'box'}
  empty={narrowed ? 'Tidak ada item yang cocok' : 'Belum ada item'} emptyText={narrowed ? 'Coba kata kunci lain atau hapus beberapa filter.' : ''}>
  {#snippet emptyActions()}
    {#if narrowed}<button class="btn" onclick={resetFilters}>{@html I.x}Hapus filter</button>
    {:else if editable}<button class="btn primary" onclick={() => open(null)}>{@html I.plus}Item baru</button>{/if}
  {/snippet}
  {#snippet cell(r, k)}
    {#if k === 'who'}
      <div class="who"><span class="thumb">{@html itemIcon(r)}</span><span class="nm"><b>{r.name}</b><small class="mono">{r.id}</small></span></div>
    {:else if k === 'set'}
      {#if setOf(r)}<span class="setchip" style="--c:{setOf(r)?.color}">{setOf(r)?.name.replace(/^Set /, '')}</span>{/if}
    {/if}
  {/snippet}
  {#snippet bulk(ids)}
    <button class="btn sm" disabled={!!bulkBusy} aria-busy={bulkBusy === 'on' ? 'true' : undefined} onclick={() => bulkActive(ids, true)}>{@html I.eye}Aktifkan</button>
    <button class="btn sm" disabled={!!bulkBusy} aria-busy={bulkBusy === 'off' ? 'true' : undefined} onclick={() => bulkActive(ids, false)}>{@html I.eyeOff}Nonaktifkan</button>
  {/snippet}
</DataTable>

{#if form}
  <Drawer wide title={creating ? 'Item baru' : form.name} onclose={close} {dirty}>
    {#snippet head()}
      <div class="dh">
        <span class="bigthumb">{@html itemIcon(previewItem)}</span>
        <div class="t">
          <h2>{creating ? 'Item baru' : form.name || '…'}</h2>
          <p>
            <span class="chip blue">{KIND[form.kind]}</span>
            {#if form.active}<span class="chip">Aktif</span>{:else}<span class="chip mute">Nonaktif</span>{/if}
            {#if setOf(form)}<span class="setchip" style="--c:{setOf(form)?.color}">{setOf(form)?.name}</span>{/if}
            {#if form.event_id}<span class="chip warn">{eventName(form.event_id)}</span>{/if}
            {#if !creating}<span class="mono">{form.id}</span><Copy text={form.id} label="ID disalin" />{/if}
            {#if dirty}<span class="chip warn">Belum disimpan</span>{/if}
          </p>
        </div>
      </div>
    {/snippet}
    <div class="cols">
      <div class="formcol">
        {#if creating}<label>ID<input bind:value={form.id} placeholder="mis. es-dawet" autocomplete="off" /><span class="help">Huruf kecil, angka, tanda hubung. Tidak bisa diubah.</span></label>{/if}
        <div class="grid2">
          <label>Nama<input bind:value={form.name} disabled={!editable} /></label>
          <label>Jenis<select value={form.kind} onchange={(e) => changeKind((e.target as HTMLSelectElement).value)} disabled={!creating}>{#each Object.entries(KIND) as [k, l]}<option value={k}>{l}</option>{/each}</select></label>
        </div>
        <label>Deskripsi<input bind:value={form.description} maxlength="200" disabled={!editable} /></label>
        <ArtEditor kind={form.kind} bind:art={form.art} />
        <fieldset disabled={!editable}>
          <legend>Harga & toko</legend>
          <div class="grid2">
            <label>Dijual di<select bind:value={form.shop}><option value="">Tidak dijual</option>{#each shops as l}<option value={l.id}>{l.name}</option>{/each}</select></label>
            <label>Urutan<input type="number" bind:value={form.sort} /></label>
            <label>Harga koin<input type="number" min="0" bind:value={form.price_coin} /></label>
            <label>Harga Mutiara<input type="number" min="0" bind:value={form.price_pearl} /></label>
            <label>Harga jual ke Pasar<input type="number" min="0" bind:value={form.sell_coin} /><span class="help">0 = tidak bisa dijual</span></label>
            <label>Event<select bind:value={form.event_id}><option value="">Bukan item event</option>{#each events as e}<option value={e.id}>{e.name}</option>{/each}</select></label>
            <label>Mulai dijual<input type="datetime-local" bind:value={form.available_from} /></label>
            <label>Berhenti dijual<input type="datetime-local" bind:value={form.available_to} /></label>
            <label>Set premium<select bind:value={form.data.set}><option value="">Bukan set</option>{#each PREMIUM_SETS as s}<option value={s.key}>{s.name}</option>{/each}</select><span class="help">3+ item set yang sama di satu ruangan memberi suasana khusus.</span></label>
          </div>
          <span class="help">Item event hanya dijual selama event berjalan. Item Mutiara sebaiknya kosmetik saja.</span>
        </fieldset>
        <fieldset disabled={!editable}>
          <legend>Detail {KIND[form.kind].toLowerCase()}</legend>
          {#if form.kind === 'food'}
            <div class="grid4">
              {#each ['kenyang', 'bersih', 'ceria', 'energi'] as k}<label>Efek {k}<input type="number" min="-100" max="100" bind:value={form.data.effects[k]} /></label>{/each}
            </div>
            <label class="inline"><input type="checkbox" bind:checked={form.data.cure} />Menyembuhkan pet yang sakit (jamu/obat)</label>
          {:else if form.kind === 'furniture'}
            <div class="grid2">
              <label>Lebar (petak)<input type="number" min="1" max="4" bind:value={form.data.w} /></label>
              <label>Panjang (petak)<input type="number" min="1" max="4" bind:value={form.data.d} /></label>
            </div>
            <label class="inline"><input type="checkbox" bind:checked={form.data.flat} />Barang datar (karpet): bisa dilewati & ditumpuki</label>
          {:else if form.kind === 'wear'}
            <label>Dipakai di<select bind:value={form.data.slot}><option value="head">Kepala</option><option value="face">Wajah</option><option value="neck">Leher</option><option value="back">Punggung (di belakang badan)</option><option value="hand">Dibawa (di samping pet)</option></select></label>
          {:else if form.kind === 'seed'}
            <div class="grid2">
              <label>Lama tumbuh (menit)<input type="number" min="1" bind:value={form.data.growMinutes} /></label>
              <label>Jumlah panen<input type="number" min="1" bind:value={form.data.yieldQty} /></label>
            </div>
            <label>Hasil panen<select bind:value={form.data.yieldItem}>{#each items.filter((i) => i.kind === 'food' || i.kind === 'material') as i}<option value={i.id}>{i.name}</option>{/each}</select></label>
          {:else if form.kind === 'fish' || form.kind === 'material'}
            <div class="grid2">
              <label>Peluang muncul di kolam<input type="number" min="0" bind:value={form.data.fishWeight} /><span class="help">Bobot relatif. 0/kosong = tidak muncul.</span></label>
              <label>Ukuran min (cm)<input type="number" min="1" bind:value={form.data.minCm} /></label>
              <label>Ukuran maks (cm)<input type="number" min="1" bind:value={form.data.maxCm} /></label>
            </div>
          {:else if form.kind === 'room'}
            <div class="grid2">
              <label>Ukuran (petak)<input type="number" min="4" max="10" bind:value={form.data.size} /><span class="help">4–10; ruangan berbentuk persegi.</span></label>
              <label>Jenis<select bind:value={form.data.theme}><option value="dalam">Ruangan dalam (dinding, jendela, lukisan)</option><option value="luar">Halaman terbuka (pagar & rumput)</option></select></label>
              <label>Dinding awal<select bind:value={form.data.wall}><option value={undefined}>Bawaan</option>{#each items.filter((i) => i.kind === 'wallpaper') as i}<option value={i.id}>{i.name}</option>{/each}</select></label>
              <label>Lantai awal<select bind:value={form.data.floor}><option value={undefined}>Bawaan</option>{#each items.filter((i) => i.kind === 'floor') as i}<option value={i.id}>{i.name}</option>{/each}</select></label>
            </div>
            <span class="help">Ruangan tidak masuk tas: setelah dibeli langsung jadi ruangan baru di rumah pemain (maksimal per pemain diatur di Ekonomi & fitur › house). Jual di Toko Bangunan atau toko lain.</span>
          {:else}
            <p class="muted">Tidak ada detail tambahan.</p>
          {/if}
        </fieldset>
        <label class="inline"><input type="checkbox" bind:checked={form.active} disabled={!editable} />Aktif (tampil di game)</label>
      </div>
      <div class="prevcol">
        <h3>Pratinjau</h3>
        <div class="icon">{@html itemIcon(previewItem)}</div>
        {#if roomPreview}<div class="room"><svg viewBox={ROOM_VIEWBOX}>{@html roomPreview}</svg></div>{/if}
        {#if form.kind === 'wear'}<div class="pet"><svg viewBox="-70 -124 140 130">{@html renderPet({ color: '#F6B7A8', ear: 'tunas' }, [previewItem])}</svg></div>{/if}
        {#if !creating}
          <dl class="kv">
            <dt>Dimiliki</dt><dd><b>{num(form.owned ?? 0)}</b> pemain/buah</dd>
            {#if form.updated_at}<dt>Diubah</dt><dd>{dt(form.updated_at)}</dd>{/if}
          </dl>
        {/if}
      </div>
    </div>
    {#snippet footer()}
      {#if editable}
        {#if !creating}<button class="btn danger" disabled={busy} onclick={remove}>{@html I.trash}Hapus…</button>{/if}
        <span class="sp"></span>
        <button class="btn primary" disabled={busy || (!creating && !dirty)} aria-busy={busy ? 'true' : undefined} onclick={save}>{@html I.check}{creating ? 'Tambah item' : 'Simpan'}</button>
      {:else}<span class="muted">Hanya bisa dilihat: peran kamu tidak bisa mengubah item.</span>{/if}
    {/snippet}
  </Drawer>
{/if}

<style>
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; }
  .who { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .thumb { width: 46px; height: 40px; border-radius: 10px; background: #EFF6F2; flex: none; display: grid; place-items: center; padding: 2px; }
  .thumb :global(svg), .bigthumb :global(svg) { width: 100%; height: 100%; display: block; }
  .nm { display: flex; flex-direction: column; min-width: 0; }
  .nm b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .nm small { color: var(--muted); }
  .setchip { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 700; padding: 1px 8px 1px 6px; border-radius: 999px; background: #F1EEF8; color: #4B3F7A; white-space: nowrap; line-height: 1.6; }
  .setchip::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: var(--c); }
  :global(.dt tr.dim td:not(.cbc)) { opacity: .62; }
  .dh { display: flex; gap: 14px; align-items: center; }
  .bigthumb { width: 60px; height: 54px; border-radius: 14px; background: #EFF6F2; flex: none; padding: 4px; }
  .dh .t { flex: 1; min-width: 0; }
  .dh h2 { font-size: 22px; overflow-wrap: anywhere; }
  .dh p { margin: 5px 0 0; color: var(--muted); font-size: 13px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .cols { display: grid; grid-template-columns: 1fr 260px; gap: 18px; }
  .formcol { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
  fieldset { gap: 10px; }
  fieldset:disabled { opacity: .75; }
  .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .prevcol { display: flex; flex-direction: column; gap: 10px; position: sticky; top: 0; align-self: start; }
  .icon { background: #EFF6F2; border-radius: 12px; display: grid; place-items: center; height: 130px; }
  .icon :global(svg) { height: 116px; width: auto; max-width: 100%; }
  .room, .pet { background: linear-gradient(#D3E9DF, #B7D7CA); border-radius: 12px; }
  .room svg, .pet svg { display: block; width: 100%; }
  .pet svg { height: 170px; }
  .sp { flex: 1; }
  .btn :global(svg) { width: 15px; height: 15px; }
  @media (max-width: 760px) {
    .stats { display: flex; overflow-x: auto; scrollbar-width: none; margin: 0 -14px; padding: 0 14px; }
    .stats > :global(.stat) { flex: none; min-width: 150px; }
    .cols { grid-template-columns: 1fr; } .prevcol { position: static; }
    .prevcol .icon { display: none; }
    .room, .pet { max-width: 340px; }
    .grid4 { grid-template-columns: 1fr 1fr; }
    .bigthumb { width: 48px; height: 44px; }
  }
</style>
