<script lang="ts">
  import CrudPage, { type CFilter } from '../components/CrudPage.svelte';
  import Section from '../components/ui/Section.svelte';
  import { renderMap, MAP_VIEWBOX } from '@kb/shared';
  const KIND: [string, string][] = [['shop', 'Toko'], ['pearl', 'Toko Mutiara'], ['social', 'Tempat nongkrong (teman)'], ['garden', 'Kebun'], ['race', 'Lapangan lomba'], ['pond', 'Kolam pancing'], ['games', 'Balai Main'], ['square', 'Alun-alun (tempat berkumpul semua pemain)'], ['home', 'Rumah']];
  const label = Object.fromEntries(KIND);
  const short = (k: string) => (label[k] ?? k).replace(/ \(.*\)$/, '');
  const FILTERS: CFilter[] = [
    { key: 'kind', label: 'Jenis', type: 'many', options: KIND.map(([k]) => [k, short(k)]) },
    { key: 'enabled', label: 'Status', all: 'Semua', options: [['true', 'Tampil'], ['false', 'Disembunyikan']] },
    { key: 'sells_back', label: 'Beli barang pemain', all: 'Semua', options: [['true', 'Ya'], ['false', 'Tidak']] },
  ];
</script>
<CrudPage title="Peta & toko" noun="lokasi" desc="Lokasi di Peta Kampung. Toko menjual item yang kolom Toko-nya berisi ID lokasi ini. Atur posisi X (40–1220) dan Y (120–420) untuk menata peta."
  endpoint="/api/admin/locations" listKey="locations" filters={FILTERS} placeholder="Cari nama atau ID lokasi"
  deleteNote="Lokasi hilang dari peta. Item yang dijual di sini jadi tidak dijual di mana pun sampai dipindah ke toko lain."
  rowClass={(r) => (r.enabled ? '' : 'dim')}
  columns={[
    { key: 'name', label: 'Nama', fmt: (v, r) => `<span class="swatch" style="background:${r.style?.roof ?? '#ccc'}"></span><b>${v}</b>` , text: (r) => r.name },
    { key: 'id', label: 'ID', fmt: (v) => `<span class="mono">${v}</span>` },
    { key: 'kind', label: 'Jenis', text: (r) => short(r.kind) },
    { key: 'x', label: 'X', num: true, off: true },
    { key: 'y', label: 'Y', num: true, off: true },
    { key: 'sort', label: 'Urutan', num: true, off: true },
    { key: 'sells_back', label: 'Beli barang pemain', fmt: (v) => (v ? 'Ya' : '<span class="muted">—</span>') },
    { key: 'enabled', label: 'Status', fmt: (v) => (v ? '<span class="chip">Tampil</span>' : '<span class="chip mute">Disembunyikan</span>') },
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
    <div class="map"><svg viewBox={MAP_VIEWBOX}>{@html renderMap([{ ...form, x: Number(form.x), y: Number(form.y), enabled: true, style: { ...form.style, w: Number(form.style?.w) || undefined } }])}</svg></div>
  {/snippet}
  {#snippet extra(rows)}
    <Section title="Peta kampung" prefKey="locations-map">
      {#if rows.length}<div class="map big"><svg viewBox={MAP_VIEWBOX}>{@html renderMap(rows)}</svg></div>
      {:else}<div class="map big skel" style="aspect-ratio:3.2"></div>{/if}
    </Section>
  {/snippet}
</CrudPage>
<style>
  .map { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: #A9D18A; }
  .map svg { display: block; width: 100%; }
  .big { max-width: 900px; }
  :global(.swatch) { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 7px; vertical-align: 0; border: 1px solid #0002; }
</style>
