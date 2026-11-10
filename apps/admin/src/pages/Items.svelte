<script lang="ts">
  import { onMount } from 'svelte';
  import { itemIcon, renderRoom, renderPet, ROOM_VIEWBOX } from '@kb/shared';
  import { api } from '../lib/api';
  import { A, can, err, toast, num, toLocal, fromLocal } from '../lib/store.svelte';
  import Drawer from '../components/Drawer.svelte';
  import ArtEditor from '../components/ArtEditor.svelte';

  const KIND: Record<string, string> = { food: 'Makanan', furniture: 'Mebel', wear: 'Pakaian', wallpaper: 'Dinding', floor: 'Lantai', seed: 'Bibit', fish: 'Ikan', material: 'Bahan/lainnya', room: 'Ruangan rumah' };
  let items = $state<any[]>([]);
  let locs = $state<any[]>([]);
  let events = $state<any[]>([]);
  let q = $state(''), fKind = $state(''), fShop = $state(''), showOff = $state(true);
  let form = $state<any>(null), creating = $state(false), busy = $state(false), confirmDel = $state(false);
  const editable = $derived(can('admin'));

  async function load() {
    try {
      const [i, l, e] = await Promise.all([api.get('/api/admin/items'), api.get('/api/admin/locations'), api.get('/api/admin/events')]);
      items = i.items; locs = l.locations; events = e.events;
    } catch (e) { err(e); }
  }
  onMount(load);

  const shown = $derived(items.filter((i) => (!q || (i.name + ' ' + i.id).toLowerCase().includes(q.toLowerCase())) && (!fKind || i.kind === fKind) && (!fShop || (fShop === '-' ? !i.shop : i.shop === fShop)) && (showOff || i.active)));
  const shopName = (id: string | null) => locs.find((l) => l.id === id)?.name ?? '—';

  function blank() {
    return { id: '', kind: 'food', name: '', description: '', price_coin: 10, price_pearl: 0, sell_coin: 0, shop: 'pasar', art: { type: 'builtin', key: 'mangkuk', colors: {} }, data: { effects: { kenyang: 10 } }, event_id: '', available_from: '', available_to: '', active: true, sort: 1000 };
  }
  function open(row: any | null) {
    creating = !row; confirmDel = false;
    const f = JSON.parse(JSON.stringify(row ?? blank()));
    f.available_from = toLocal(f.available_from); f.available_to = toLocal(f.available_to);
    f.event_id ??= ''; f.shop ??= '';
    f.data ??= {}; if (f.kind === 'food') f.data.effects ??= {};
    form = f;
  }
  function changeKind(k: string) {
    form.kind = k;
    const b = A.me?.builtins?.[k]?.[0];
    form.art = { type: 'builtin', key: b?.key ?? 'kotak', colors: { ...(b?.colors ?? {}) } };
    form.data = k === 'food' ? { effects: { kenyang: 10 } } : k === 'furniture' ? { w: 1, d: 1 } : k === 'wear' ? { slot: b?.slot ?? 'head' } : k === 'seed' ? { growMinutes: 30, yieldItem: 'tomat', yieldQty: 3 } : k === 'room' ? { size: 6, theme: b?.key === 'luar' ? 'luar' : 'dalam' } : {};
  }
  async function save() {
    busy = true;
    try {
      const body = { ...form, available_from: fromLocal(form.available_from), available_to: fromLocal(form.available_to), shop: form.shop || null, event_id: form.event_id || null };
      if (creating) await api.post('/api/admin/items', body); else await api.put(`/api/admin/items/${form.id}`, body);
      toast('Item tersimpan. Pemain melihat perubahan dalam ±15 detik.');
      form = null; load();
    } catch (e) { err(e); } finally { busy = false; }
  }
  async function remove() {
    if (!confirmDel) { confirmDel = true; return; }
    busy = true;
    try { const r = await api.del(`/api/admin/items/${form.id}`); toast(r.message ?? 'Item dihapus'); form = null; load(); } catch (e) { err(e); } finally { busy = false; }
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
      return renderRoom({ layout: [], items: {}, size: Math.max(4, Math.min(10, Number(it.data?.size) || 6)), theme: it.data?.theme, wall: byId(it.data?.wall), floor: byId(it.data?.floor) });
    }
    return '';
  });
</script>

<div class="head">
  <div><h1>Item & harga</h1><p class="muted">Semua barang di game: makanan, mebel, pakaian, dekorasi, bibit, ikan. Perubahan langsung berlaku tanpa deploy.</p></div>
  {#if editable}<button class="btn primary" onclick={() => open(null)}>Item baru</button>{/if}
</div>
<div class="row filters">
  <input placeholder="Cari nama atau ID" bind:value={q} aria-label="Cari item" />
  <select bind:value={fKind} aria-label="Jenis"><option value="">Semua jenis</option>{#each Object.entries(KIND) as [k, l]}<option value={k}>{l}</option>{/each}</select>
  <select bind:value={fShop} aria-label="Toko"><option value="">Semua toko</option><option value="-">Tidak dijual</option>{#each locs.filter((l) => l.kind === 'shop' || l.kind === 'pearl') as l}<option value={l.id}>{l.name}</option>{/each}</select>
  <label class="inline"><input type="checkbox" bind:checked={showOff} />Tampilkan nonaktif</label>
  <span class="muted">{shown.length} item</span>
</div>
<div class="tbl">
  <table>
    <thead><tr><th></th><th>Nama</th><th>Jenis</th><th>Toko</th><th class="num">Koin</th><th class="num">Mutiara</th><th class="num">Jual</th><th>Event</th><th class="num">Dimiliki</th><th>Status</th></tr></thead>
    <tbody>
      {#each shown as i (i.id)}
        <tr class="click" onclick={() => open(i)}>
          <td class="ic">{@html itemIcon(i)}</td>
          <td><b>{i.name}</b><br /><span class="mono muted">{i.id}</span></td>
          <td>{KIND[i.kind]}</td>
          <td>{shopName(i.shop)}</td>
          <td class="num">{i.price_coin ? num(i.price_coin) : '—'}</td>
          <td class="num">{i.price_pearl || '—'}</td>
          <td class="num">{i.sell_coin || '—'}</td>
          <td>{i.event_id ? events.find((e) => e.id === i.event_id)?.name ?? i.event_id : ''}</td>
          <td class="num">{num(i.owned)}</td>
          <td>{#if i.active}<span class="chip">Aktif</span>{:else}<span class="chip mute">Nonaktif</span>{/if}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

{#if form}
  <Drawer wide title={creating ? 'Item baru' : form.name} onclose={() => (form = null)}>
    <div class="cols">
      <div class="formcol">
        {#if creating}<label>ID<input bind:value={form.id} placeholder="mis. es-dawet" /><span class="help">Huruf kecil, angka, tanda hubung. Tidak bisa diubah.</span></label>{/if}
        <div class="grid2">
          <label>Nama<input bind:value={form.name} /></label>
          <label>Jenis<select value={form.kind} onchange={(e) => changeKind((e.target as HTMLSelectElement).value)} disabled={!creating}>{#each Object.entries(KIND) as [k, l]}<option value={k}>{l}</option>{/each}</select></label>
        </div>
        <label>Deskripsi<input bind:value={form.description} maxlength="200" /></label>
        <ArtEditor kind={form.kind} bind:art={form.art} />
        <fieldset>
          <legend>Harga & toko</legend>
          <div class="grid2">
            <label>Dijual di<select bind:value={form.shop}><option value="">Tidak dijual</option>{#each locs.filter((l) => l.kind === 'shop' || l.kind === 'pearl') as l}<option value={l.id}>{l.name}</option>{/each}</select></label>
            <label>Urutan<input type="number" bind:value={form.sort} /></label>
            <label>Harga koin<input type="number" min="0" bind:value={form.price_coin} /></label>
            <label>Harga Mutiara<input type="number" min="0" bind:value={form.price_pearl} /></label>
            <label>Harga jual ke Pasar<input type="number" min="0" bind:value={form.sell_coin} /><span class="help">0 = tidak bisa dijual</span></label>
            <label>Event<select bind:value={form.event_id}><option value="">Bukan item event</option>{#each events as e}<option value={e.id}>{e.name}</option>{/each}</select></label>
            <label>Mulai dijual<input type="datetime-local" bind:value={form.available_from} /></label>
            <label>Berhenti dijual<input type="datetime-local" bind:value={form.available_to} /></label>
          </div>
          <span class="help">Item event hanya dijual selama event berjalan. Item Mutiara sebaiknya kosmetik saja.</span>
        </fieldset>
        <fieldset>
          <legend>Detail {KIND[form.kind].toLowerCase()}</legend>
          {#if form.kind === 'food'}
            <div class="grid2">
              {#each ['kenyang', 'bersih', 'ceria', 'energi'] as k}<label>Efek {k}<input type="number" min="-100" max="100" bind:value={form.data.effects[k]} /></label>{/each}
            </div>
          {:else if form.kind === 'furniture'}
            <div class="grid2">
              <label>Lebar (petak)<input type="number" min="1" max="4" bind:value={form.data.w} /></label>
              <label>Panjang (petak)<input type="number" min="1" max="4" bind:value={form.data.d} /></label>
            </div>
            <label class="inline"><input type="checkbox" bind:checked={form.data.flat} />Barang datar (karpet): bisa dilewati & ditumpuki</label>
          {:else if form.kind === 'wear'}
            <label>Dipakai di<select bind:value={form.data.slot}><option value="head">Kepala</option><option value="face">Wajah</option><option value="neck">Leher</option><option value="back">Punggung (di belakang badan)</option></select></label>
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
            <span class="help">Ruangan tidak masuk tas: setelah dibeli langsung jadi ruangan baru di rumah pemain (maksimal per pemain diatur di Ekonomi & Fitur → house). Jual di Toko Bangunan atau toko lain.</span>
          {:else}
            <p class="muted">Tidak ada detail tambahan.</p>
          {/if}
        </fieldset>
        <label class="inline"><input type="checkbox" bind:checked={form.active} />Aktif (tampil di game)</label>
      </div>
      <div class="prevcol">
        <h3>Pratinjau</h3>
        <div class="icon">{@html itemIcon(previewItem)}</div>
        {#if roomPreview}<div class="room"><svg viewBox={ROOM_VIEWBOX}>{@html roomPreview}</svg></div>{/if}
        {#if form.kind === 'wear'}<div class="pet"><svg viewBox="-70 -124 140 130">{@html renderPet({ color: '#F6B7A8', ear: 'tunas' }, [previewItem])}</svg></div>{/if}
        {#if !creating}<p class="muted">Dimiliki pemain: <b>{num(form.owned ?? 0)}</b></p>{/if}
      </div>
    </div>
    {#snippet footer()}
      {#if editable}
        {#if !creating}<button class="btn danger" disabled={busy} onclick={remove}>{confirmDel ? 'Yakin hapus?' : 'Hapus'}</button>{/if}
        <button class="btn primary" disabled={busy} onclick={save}>Simpan</button>
      {:else}<span class="muted">Hanya bisa dilihat.</span>{/if}
    {/snippet}
  </Drawer>
{/if}

<style>
  .head { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: flex-start; }
  .head p { margin: 4px 0 0; }
  .filters input { max-width: 240px; } .filters select { max-width: 190px; }
  .ic { width: 64px; } .ic :global(svg) { width: 54px; height: 44px; display: block; }
  .cols { display: grid; grid-template-columns: 1fr 260px; gap: 18px; }
  .formcol { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
  fieldset { border: 1px solid var(--line); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 10px; margin: 0; }
  legend { font-weight: 700; padding: 0 6px; }
  .prevcol { display: flex; flex-direction: column; gap: 10px; position: sticky; top: 0; align-self: start; }
  .icon { background: #EFF6F2; border-radius: 12px; display: grid; place-items: center; height: 130px; }
  .icon :global(svg) { height: 116px; width: auto; max-width: 100%; }
  .room, .pet { background: linear-gradient(#D3E9DF, #B7D7CA); border-radius: 12px; }
  .room svg, .pet svg { display: block; width: 100%; }
  .pet svg { height: 170px; }
  @media (max-width: 760px) { .cols { grid-template-columns: 1fr; } .prevcol { position: static; } }
</style>
