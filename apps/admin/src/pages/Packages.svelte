<script lang="ts">
  import CrudPage, { type CFilter } from '../components/CrudPage.svelte';
  import { num, rp } from '../lib/store.svelte';
  const FILTERS: CFilter[] = [{ key: 'active', label: 'Status', all: 'Semua', options: [['true', 'Aktif'], ['false', 'Nonaktif']] }];
  const per = (r: any) => (r.pearls + (r.bonus || 0) > 0 ? Math.round(r.price_idr / (r.pearls + (r.bonus || 0))) : 0);
</script>
<CrudPage title="Paket Mutiara" noun="paket" desc="Paket yang bisa dibeli pemain (QRIS, e-wallet, transfer bank). Hanya pemilik yang bisa mengubah harga."
  endpoint="/api/admin/packages" listKey="packages" editMin="owner" deleteLabel="Nonaktifkan" deleteSoft filters={FILTERS} placeholder="Cari nama atau ID paket"
  deleteNote="Paket tidak dijual lagi. Pembelian yang sudah terjadi tetap tercatat, dan paket bisa diaktifkan lagi."
  rowClass={(r) => (r.active ? '' : 'dim')}
  columns={[
    { key: 'name', label: 'Nama' },
    { key: 'pearls', label: 'Mutiara', num: true, fmt: (v) => num(v) },
    { key: 'bonus', label: 'Bonus', num: true, fmt: (v) => (v ? `+${num(v)}` : '<span class="muted">—</span>') },
    { key: 'price_idr', label: 'Harga', num: true, fmt: (v) => rp(v) },
    { key: 'per', label: 'Per Mutiara', num: true, off: true, text: per, fmt: (_v, r) => rp(per(r)) },
    { key: 'sort', label: 'Urutan', num: true, off: true },
    { key: 'id', label: 'ID', off: true, fmt: (v) => `<span class="mono">${v}</span>` },
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
