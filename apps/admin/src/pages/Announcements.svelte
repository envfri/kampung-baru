<script lang="ts">
  import CrudPage, { type CFilter, esc } from '../components/CrudPage.svelte';
  import { dt } from '../lib/store.svelte';
  // status tayang dihitung dari aktif + jendela waktu
  function status(r: any): [string, string, string] {
    const now = Date.now();
    if (!r.active) return ['off', 'Nonaktif', 'mute'];
    if (r.starts_at && new Date(r.starts_at).getTime() > now) return ['soon', 'Terjadwal', 'warn'];
    if (r.ends_at && new Date(r.ends_at).getTime() <= now) return ['done', 'Berakhir', 'mute'];
    return ['live', 'Tayang', ''];
  }
  const FILTERS: CFilter[] = [
    { key: 'status', label: 'Status', all: 'Semua', options: [['live', 'Tayang'], ['soon', 'Terjadwal'], ['done', 'Berakhir'], ['off', 'Nonaktif']], test: (r, v) => status(r)[0] === v },
    { key: 'starts_at', label: 'Mulai', type: 'dates' },
  ];
</script>
<CrudPage title="Pengumuman" noun="pengumuman" desc="Tampil di menu Kabar kampung dan muncul otomatis saat pemain membuka game. Untuk notifikasi ke HP, pakai Pusat notifikasi."
  endpoint="/api/admin/announcements" listKey="announcements" idOnCreate={false} filters={FILTERS} placeholder="Cari judul atau isi"
  confirmText={() => 'HAPUS'} deleteNote="Pengumuman hilang dari Kabar kampung semua pemain."
  rowClass={(r) => (status(r)[0] === 'live' ? '' : 'dim')}
  columns={[
    { key: 'title', label: 'Judul', text: (r) => r.title, fmt: (v, r) => `<b>${esc(v)}</b><span class="l2 clip">${esc(r.body)}</span>` },
    { key: 'status', label: 'Status', sort: false, text: (r) => status(r)[1], fmt: (_v, r) => { const s = status(r); return `<span class="chip ${s[2]}">${s[1]}</span>`; } },
    { key: 'starts_at', label: 'Mulai', fmt: dt },
    { key: 'ends_at', label: 'Selesai', fmt: (v) => (v ? dt(v) : '<span class="muted">Selamanya</span>') },
    { key: 'id', label: 'ID', num: true, off: true },
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
<style>
  :global(.clip) { display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; max-width: 60ch; font-size: 13px; }
</style>
