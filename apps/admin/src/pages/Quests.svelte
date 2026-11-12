<script lang="ts">
  import CrudPage, { type CFilter, esc } from '../components/CrudPage.svelte';
  import Section from '../components/ui/Section.svelte';
  import { QUEST_EVENTS, QUEST_LINKS } from '@kb/shared';
  import { num } from '../lib/store.svelte';
  const EV: [string, string][] = Object.entries(QUEST_EVENTS).map(([k, v]) => [k, v.label]);
  const KIND: Record<string, string> = { starter: 'Pemula', daily: 'Harian', badge: 'Lencana' };
  const FILTERS: CFilter[] = [
    { key: 'kind', label: 'Jenis', type: 'many', options: [['starter', 'Pemula'], ['daily', 'Harian'], ['badge', 'Lencana']] },
    { key: 'active', label: 'Status', all: 'Semua', options: [['true', 'Aktif'], ['false', 'Nonaktif']] },
    { key: 'event', label: 'Syarat', all: 'Semua', options: EV },
  ];
</script>

<CrudPage title="Tugas & lencana" noun="tugas" desc="Tugas pemula tampil berurutan untuk pemain baru. Tugas harian: tiap pemain dapat beberapa tugas acak per hari (jumlahnya di Ekonomi & fitur › quests). Lencana: pencapaian sekali seumur akun. Progres dihitung otomatis di server."
  endpoint="/api/admin/quests" listKey="quests" deleteLabel="Nonaktifkan" deleteSoft filters={FILTERS} placeholder="Cari judul, petunjuk, ID"
  deleteNote="Tugas tidak muncul lagi untuk pemain. Riwayat progres pemain tetap tersimpan, dan tugas bisa diaktifkan lagi."
  rowClass={(r) => (r.active ? '' : 'dim')}
  columns={[
    { key: 'title', label: 'Judul', card: 'title', text: (r) => r.title, fmt: (v, r) => `<b>${esc(v)}</b><span class="l2">${esc(r.description)}</span>` },
    { key: 'kind', label: 'Jenis', text: (r) => KIND[r.kind] ?? r.kind, fmt: (v) => (v === 'starter' ? '<span class="chip">Pemula</span>' : v === 'badge' ? '<span class="chip blue">Lencana</span>' : '<span class="chip warn">Harian</span>') },
    { key: 'event', label: 'Syarat', fmt: (v, r) => `${QUEST_EVENTS[v]?.label ?? v} ×${r.target}${Object.keys(r.filter ?? {}).length ? ` <span class="mono">${esc(JSON.stringify(r.filter))}</span>` : ''}` },
    { key: 'reward_coin', label: 'Hadiah', text: (r) => r.reward_coin, fmt: (v, r) => [v && `${v} koin`, r.reward_pearl && `${r.reward_pearl} Mutiara`, r.reward_xp && `${r.reward_xp} XP`].filter(Boolean).join(' · ') || '<span class="muted">—</span>' },
    { key: 'claimed_total', label: 'Diselesaikan', num: true, fmt: (v) => num(v ?? 0) },
    { key: 'sort', label: 'Urutan', num: true, off: true },
    { key: 'id', label: 'ID', off: true, fmt: (v) => `<span class="mono">${v}</span>` },
    { key: 'active', label: 'Status', fmt: (v) => (v ? '<span class="chip">Aktif</span>' : '<span class="chip mute">Nonaktif</span>') },
  ]}
  fields={[
    { key: 'kind', label: 'Jenis', type: 'select', options: [['starter', 'Pemula (sekali, berurutan)'], ['daily', 'Harian (acak per hari)'], ['badge', 'Lencana (sekali, semua tampil)']] },
    { key: 'title', label: 'Judul' },
    { key: 'description', label: 'Petunjuk untuk pemain' },
    { key: 'event', label: 'Syarat (peristiwa)', type: 'select', options: EV },
    { key: 'filter', label: 'Filter (opsional)', type: 'json', help: 'Kosong {} = semua. Contoh: {"type":"mandi"} untuk aksi, {"rank":"1"} untuk juara lomba, {"kind":"furniture"} untuk beli mebel.' },
    { key: 'target', label: 'Berapa kali', type: 'number' },
    { key: 'sort', label: 'Urutan', type: 'number', help: 'Tugas pemula tampil dari urutan terkecil.' },
    { key: 'reward_coin', label: 'Hadiah koin', type: 'number' },
    { key: 'reward_pearl', label: 'Hadiah Mutiara', type: 'number' },
    { key: 'reward_xp', label: 'Hadiah XP', type: 'number' },
    { key: 'url', label: 'Tombol "Ke sana" membuka', type: 'select', options: QUEST_LINKS },
    { key: 'active', label: 'Aktif', type: 'checkbox' },
  ]}
  blank={() => ({ id: '', kind: 'daily', title: '', description: '', event: 'action', filter: {}, target: 1, reward_coin: 20, reward_pearl: 0, reward_xp: 4, url: '/', sort: 200, active: true })}
>
  {#snippet extra()}
    <Section title="Peristiwa & filter yang bisa dipakai" open={false} prefKey="quests-help">
      <div class="tbl"><table>
        <thead><tr><th>Peristiwa</th><th>Arti</th><th>Filter</th></tr></thead>
        <tbody>{#each Object.entries(QUEST_EVENTS) as [k, v]}<tr><td class="mono">{k}</td><td>{v.label}</td><td class="muted mono">{v.filters || '—'}</td></tr>{/each}</tbody>
      </table></div>
    </Section>
  {/snippet}
</CrudPage>
