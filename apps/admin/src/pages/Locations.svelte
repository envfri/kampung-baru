<script lang="ts">
  import CrudPage from '../components/CrudPage.svelte';
  import { renderMap } from '@kb/shared';
  const KIND: [string, string][] = [['shop', 'Toko'], ['pearl', 'Toko Mutiara'], ['social', 'Tempat nongkrong (teman)'], ['garden', 'Kebun'], ['race', 'Lapangan lomba'], ['pond', 'Kolam pancing'], ['home', 'Rumah']];
  const label = Object.fromEntries(KIND);
</script>
<CrudPage title="Peta & toko" desc="Lokasi di Peta Kampung. Toko menjual item yang kolom Toko-nya berisi ID lokasi ini. Geser posisi X (40–760) dan Y (120–420) untuk menata peta."
  endpoint="/api/admin/locations" listKey="locations"
  columns={[
    { key: 'name', label: 'Nama' },
    { key: 'id', label: 'ID', fmt: (v) => `<span class="mono">${v}</span>` },
    { key: 'kind', label: 'Jenis', fmt: (v) => label[v] ?? v },
    { key: 'enabled', label: 'Status', fmt: (v) => (v ? '<span class="chip">Tampil</span>' : '<span class="chip mute">Disembunyikan</span>') },
    { key: 'sells_back', label: 'Beli barang pemain', fmt: (v) => (v ? 'Ya' : '—') },
  ]}
  fields={[
    { key: 'name', label: 'Nama di peta' },
    { key: 'kind', label: 'Jenis', type: 'select', options: KIND },
    { key: 'x', label: 'Posisi X', type: 'number' },
    { key: 'y', label: 'Posisi Y', type: 'number' },
    { key: 'style.body', label: 'Warna dinding bangunan', type: 'color' },
    { key: 'style.roof', label: 'Warna atap', type: 'color' },
    { key: 'style.w', label: 'Lebar bangunan (70–140)', type: 'number' },
    { key: 'sort', label: 'Urutan', type: 'number' },
    { key: 'sells_back', label: 'Pemain bisa menjual barang di sini', type: 'checkbox' },
    { key: 'enabled', label: 'Tampil di peta', type: 'checkbox' },
  ]}
  blank={() => ({ id: '', name: '', kind: 'shop', x: 400, y: 205, style: { body: '#FDF1D6', roof: '#3FA06A', w: 104 }, sort: 10, sells_back: false, enabled: true })}
>
  {#snippet preview(form)}
    <div class="map"><svg viewBox="0 -40 800 520">{@html renderMap([{ ...form, x: Number(form.x), y: Number(form.y), enabled: true, style: { ...form.style, w: Number(form.style?.w) || undefined } }])}</svg></div>
  {/snippet}
  {#snippet extra(rows)}
    <div class="map big"><svg viewBox="0 -40 800 520">{@html renderMap(rows)}</svg></div>
  {/snippet}
</CrudPage>
<style>
  .map { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: #A9D18A; }
  .map svg { display: block; width: 100%; }
  .big { max-width: 760px; }
</style>
