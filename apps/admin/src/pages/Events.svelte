<script lang="ts">
  import CrudPage from '../components/CrudPage.svelte';
  import { dt } from '../lib/store.svelte';
  const now = Date.now();
  const status = (_: any, r: any) => { const s = new Date(r.starts_at).getTime(), e = new Date(r.ends_at).getTime(); return !r.active ? '<span class="chip mute">Nonaktif</span>' : now < s ? '<span class="chip warn">Terjadwal</span>' : now < e ? '<span class="chip">Berjalan</span>' : '<span class="chip mute">Selesai</span>'; };
</script>
<CrudPage title="Event" desc="Event musiman memberi pengali hadiah koin dan membuka item edisi terbatas. Item dihubungkan ke event lewat menu Item (kolom Event)."
  endpoint="/api/admin/events" listKey="events"
  columns={[
    { key: 'name', label: 'Nama' },
    { key: 'active', label: 'Status', fmt: status },
    { key: 'starts_at', label: 'Mulai', fmt: dt },
    { key: 'ends_at', label: 'Selesai', fmt: dt },
    { key: 'bonus.coinMultiplier', label: 'Koin ×', num: true },
  ]}
  fields={[
    { key: 'name', label: 'Nama event' },
    { key: 'description', label: 'Deskripsi (tampil di Kabar kampung)', type: 'textarea' },
    { key: 'starts_at', label: 'Mulai', type: 'datetime' },
    { key: 'ends_at', label: 'Selesai', type: 'datetime' },
    { key: 'bonus.coinMultiplier', label: 'Pengali hadiah koin', type: 'number', step: '0.05', help: '1 = normal, 1.2 = +20%. Maksimal 5.' },
    { key: 'theme.color', label: 'Warna tema', type: 'color' },
    { key: 'active', label: 'Aktif', type: 'checkbox' },
  ]}
  blank={() => ({ id: '', name: '', description: '', starts_at: new Date().toISOString(), ends_at: new Date(Date.now() + 7 * 864e5).toISOString(), theme: { color: '#E0583F' }, bonus: { coinMultiplier: 1 }, active: true })}
/>
