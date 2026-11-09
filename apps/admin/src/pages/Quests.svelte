<script lang="ts">
  import CrudPage from '../components/CrudPage.svelte';
  import { QUEST_EVENTS, QUEST_LINKS } from '@kb/shared';
  import { num } from '../lib/store.svelte';
  const EV: [string, string][] = Object.entries(QUEST_EVENTS).map(([k, v]) => [k, v.label]);
</script>

<CrudPage title="Tugas" desc="Tugas pemula tampil berurutan untuk pemain baru. Tugas harian: setiap pemain mendapat beberapa tugas acak per hari (jumlahnya di Ekonomi & fitur › quests). Progres dihitung otomatis dari aksi pemain di server."
  endpoint="/api/admin/quests" listKey="quests" deleteLabel="Nonaktifkan"
  columns={[
    { key: 'kind', label: 'Jenis', fmt: (v) => (v === 'starter' ? '<span class="chip">Pemula</span>' : '<span class="chip warn">Harian</span>') },
    { key: 'title', label: 'Judul', fmt: (v, r) => `<b>${v}</b><br><span class="muted">${r.description}</span>` },
    { key: 'event', label: 'Syarat', fmt: (v, r) => `${QUEST_EVENTS[v]?.label ?? v} ×${r.target}${Object.keys(r.filter ?? {}).length ? ` <span class="mono">${JSON.stringify(r.filter)}</span>` : ''}` },
    { key: 'reward_coin', label: 'Hadiah', fmt: (v, r) => [v && `${v} koin`, r.reward_pearl && `${r.reward_pearl} Mutiara`, r.reward_xp && `${r.reward_xp} XP`].filter(Boolean).join(' · ') },
    { key: 'claimed_total', label: 'Diselesaikan', num: true, fmt: (v) => num(v ?? 0) },
    { key: 'active', label: 'Status', fmt: (v) => (v ? '<span class="chip">Aktif</span>' : '<span class="chip mute">Nonaktif</span>') },
  ]}
  fields={[
    { key: 'kind', label: 'Jenis', type: 'select', options: [['starter', 'Pemula (sekali, berurutan)'], ['daily', 'Harian (acak per hari)']] },
    { key: 'title', label: 'Judul' },
    { key: 'description', label: 'Petunjuk untuk pemain' },
    { key: 'event', label: 'Syarat (peristiwa)', type: 'select', options: EV },
    { key: 'filter', label: 'Filter (opsional)', type: 'json', help: 'Kosong {} = semua. Contoh: {"type":"mandi"} untuk aksi, {"rank":"1"} untuk juara lomba, {"kind":"furniture"} untuk beli mebel.' },
    { key: 'target', label: 'Berapa kali', type: 'number' },
    { key: 'reward_coin', label: 'Hadiah koin', type: 'number' },
    { key: 'reward_pearl', label: 'Hadiah Mutiara', type: 'number' },
    { key: 'reward_xp', label: 'Hadiah XP', type: 'number' },
    { key: 'url', label: 'Tombol "Ke sana" membuka', type: 'select', options: QUEST_LINKS },
    { key: 'sort', label: 'Urutan', type: 'number', help: 'Tugas pemula ditampilkan dari urutan terkecil.' },
    { key: 'active', label: 'Aktif', type: 'checkbox' },
  ]}
  blank={() => ({ id: '', kind: 'daily', title: '', description: '', event: 'action', filter: {}, target: 1, reward_coin: 20, reward_pearl: 0, reward_xp: 4, url: '/', sort: 200, active: true })}
>
  {#snippet extra()}
    <details class="card help">
      <summary>Daftar peristiwa & filter yang bisa dipakai</summary>
      <table><tbody>{#each Object.entries(QUEST_EVENTS) as [k, v]}<tr><td class="mono">{k}</td><td>{v.label}</td><td class="muted mono">{v.filters || '—'}</td></tr>{/each}</tbody></table>
    </details>
  {/snippet}
</CrudPage>
<style>
  .help summary { cursor: pointer; font-weight: 600; }
  .help table { margin-top: 10px; }
</style>
