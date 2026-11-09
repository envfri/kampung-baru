<script lang="ts">
  import CrudPage from '../components/CrudPage.svelte';
  import { rp } from '../lib/store.svelte';
</script>
<CrudPage title="Paket Mutiara" desc="Paket yang bisa dibeli pemain (QRIS, e-wallet, transfer bank lewat Midtrans). Hanya peran pemilik yang bisa mengubah harga."
  endpoint="/api/admin/packages" listKey="packages" editMin="owner" deleteLabel="Nonaktifkan"
  columns={[
    { key: 'name', label: 'Nama' },
    { key: 'pearls', label: 'Mutiara', num: true },
    { key: 'bonus', label: 'Bonus', num: true },
    { key: 'price_idr', label: 'Harga', num: true, fmt: (v) => rp(v) },
    { key: 'active', label: 'Status', fmt: (v) => (v ? '<span class="chip">Aktif</span>' : '<span class="chip mute">Nonaktif</span>') },
  ]}
  fields={[
    { key: 'name', label: 'Nama paket' },
    { key: 'pearls', label: 'Jumlah Mutiara', type: 'number' },
    { key: 'bonus', label: 'Bonus Mutiara', type: 'number' },
    { key: 'price_idr', label: 'Harga (Rp)', type: 'number', help: 'Minimal Rp1.000.' },
    { key: 'sort', label: 'Urutan tampil', type: 'number' },
    { key: 'active', label: 'Aktif', type: 'checkbox' },
  ]}
  blank={() => ({ id: '', name: '', pearls: 10, bonus: 0, price_idr: 15000, sort: 0, active: true })}
/>
