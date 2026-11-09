<script lang="ts">
  import CrudPage from '../components/CrudPage.svelte';
  import { dt } from '../lib/store.svelte';
</script>
<CrudPage title="Pengumuman" desc="Tampil di menu Kabar kampung dan muncul otomatis saat pemain membuka game. Untuk notifikasi ke HP, pakai menu Notifikasi."
  endpoint="/api/admin/announcements" listKey="announcements" idOnCreate={false}
  columns={[
    { key: 'title', label: 'Judul' },
    { key: 'starts_at', label: 'Mulai', fmt: dt },
    { key: 'ends_at', label: 'Selesai', fmt: dt },
    { key: 'active', label: 'Status', fmt: (v) => (v ? '<span class="chip">Aktif</span>' : '<span class="chip mute">Nonaktif</span>') },
  ]}
  fields={[
    { key: 'title', label: 'Judul' },
    { key: 'body', label: 'Isi', type: 'textarea' },
    { key: 'starts_at', label: 'Mulai tampil', type: 'datetime' },
    { key: 'ends_at', label: 'Berhenti tampil (kosongkan = selamanya)', type: 'datetime' },
    { key: 'active', label: 'Aktif', type: 'checkbox' },
  ]}
  blank={() => ({ title: '', body: '', starts_at: new Date().toISOString(), ends_at: null, active: true })}
/>
