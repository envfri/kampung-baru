<script lang="ts">
  import { onMount } from 'svelte';
  import { api, qs } from '../lib/api';
  import { A, err, toast, ask, num, dt, setQuery } from '../lib/store.svelte';
  import { type FDef, readFilters, filterParams } from '../lib/filters';
  import { I } from '../lib/icons';
  import PageHead from '../components/ui/PageHead.svelte';
  import FilterBar from '../components/ui/FilterBar.svelte';
  import DataTable, { type Col, type TState } from '../components/ui/DataTable.svelte';
  import Tabs from '../components/ui/Tabs.svelte';
  import Ago from '../components/ui/Ago.svelte';
  import Empty from '../components/ui/Empty.svelte';

  const TABS = ['laporan', 'alun', 'rumah', 'kata'];
  let tab = $state(TABS.includes(A.query.tab) ? A.query.tab : 'laporan');
  const FILTERS: Record<string, FDef[]> = {
    laporan: [{ key: 'status', label: 'Status', all: 'Belum ditangani', options: [['done', 'Sudah ditangani'], ['all', 'Semua laporan']] }, { key: 'at', label: 'Waktu', type: 'dates' }],
    alun: [{ key: 'inst', label: 'Alun-alun', all: 'Semua', options: Array.from({ length: 10 }, (_, i) => [String(i + 1), `Alun-alun ${i + 1}`] as [string, string]) }, { key: 'at', label: 'Waktu', type: 'dates' }],
    rumah: [{ key: 'at', label: 'Waktu', type: 'dates' }],
    kata: [],
  };
  let q = $state(A.query.q ?? '');
  let vals = $state<Record<string, any>>(readFilters(FILTERS[tab], A.query));
  let reports = $state<any[]>([]), open = $state(0), square = $state<any[]>([]), chats = $state<any[]>([]), words = $state<string[]>([]);
  let loading = $state(true), updated = $state(0), selected = $state<string[]>([]);
  let tsR = $state<TState>({ page: 0, size: 25, sort: '', dir: 'desc' }), tsA = $state<TState>({ page: 0, size: 50, sort: '', dir: 'desc' }), tsH = $state<TState>({ page: 0, size: 50, sort: '', dir: 'desc' });

  async function load() {
    loading = true;
    const p = { q, ...filterParams(FILTERS[tab], vals) };
    try {
      if (tab === 'laporan') { const r = await api.get('/api/admin/reports' + qs(p)); reports = r.reports; open = r.open; }
      else if (tab === 'alun') square = (await api.get('/api/admin/square-chat' + qs(p))).chats;
      else if (tab === 'rumah') chats = (await api.get('/api/admin/house-chat' + qs(p))).chats;
      if (!words.length || tab === 'kata') words = (await api.get('/api/admin/banned-words')).words;
      updated = Date.now();
    } catch (e) { err(e); }
    loading = false;
  }
  onMount(load);
  function switchTab(k: string) {
    q = ''; selected = [];
    vals = readFilters(FILTERS[k], {});
    setQuery({ tab: k, ...vals }); load();
  }

  // sorot kata terlarang di pesan
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  function hl(text: string) {
    let h = esc(text ?? '');
    for (const w of words) { if (w.length < 2) continue; h = h.replace(new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>'); }
    return h;
  }
  const isMuted = (r: any) => r.muted_until && new Date(r.muted_until).getTime() > Date.now();

  async function mute(id: string, name: string) {
    const r = await ask({ title: `Bisukan obrolan ${name}`, body: 'Pemain tidak bisa mengetik di Alun-alun dan saat berkunjung.', tone: 'warn', icon: 'mute',
      fields: [{ key: 'len', label: 'Lama', type: 'chips', options: ['30 menit', '2 jam', '24 jam', '7 hari'], value: '2 jam' }, { key: 'reason', label: 'Alasan', placeholder: 'mis. kata kasar ke pemain lain', min: 3 }], confirm: 'Bisukan' });
    if (!r) return;
    const minutes = ({ '30 menit': 30, '2 jam': 120, '24 jam': 1440, '7 hari': 10080 } as Record<string, number>)[r.len] ?? 120;
    try { await api.post(`/api/admin/players/${id}/mute`, { minutes, reason: r.reason }); toast(`Obrolan ${name} dibisukan`); load(); } catch (e) { err(e); }
  }
  async function unmute(id: string, name: string) {
    if (!(await ask({ title: `Buka bisu ${name}?`, tone: 'ok', icon: 'sound', confirm: 'Buka bisu' }))) return;
    try { await api.post(`/api/admin/players/${id}/unmute`); toast('Obrolan dibuka lagi'); load(); } catch (e) { err(e); }
  }
  async function ban(id: string, name: string) {
    const r = await ask({ title: `Blokir ${name}?`, body: `${name} tidak bisa masuk sampai blokir dibuka, dan semua sesinya dikeluarkan.`, tone: 'danger', icon: 'ban',
      fields: [{ key: 'why', label: 'Alasan', type: 'chips', options: ['Obrolan kasar berulang', 'Nama tidak pantas', 'Spam', 'Curang', 'Lainnya'], value: 'Obrolan kasar berulang' }, { key: 'note', label: 'Catatan', type: 'textarea' }],
      typeToConfirm: name, confirm: 'Blokir pemain' });
    if (!r) return;
    try { await api.post(`/api/admin/players/${id}/ban`, { reason: (r.note?.trim() ? `${r.why}: ${r.note.trim()}` : r.why).slice(0, 200) }); toast(`${name} diblokir`); load(); } catch (e) { err(e); }
  }
  async function handle(ids: string[]) {
    try { const r = await api.post('/api/admin/reports/handle', { ids: ids.map(Number) }); toast(`${r.count} laporan ditandai selesai`); selected = []; load(); A.badges = { ...A.badges, reports: Math.max(0, (A.badges.reports ?? 0) - r.count) }; } catch (e) { err(e); }
  }
  let w = $state(''), wq = $state('');
  async function addWord(e: Event) {
    e.preventDefault();
    const x = w.trim().toLowerCase();
    if (x.length < 2) return;
    try { await api.post('/api/admin/banned-words', { word: x }); w = ''; toast(`“${x}” ditambahkan`); words = (await api.get('/api/admin/banned-words')).words; } catch (e) { err(e); }
  }
  async function rmWord(x: string) {
    if (!(await ask({ title: `Hapus kata “${x}”?`, body: 'Nama dan pesan dengan kata ini tidak lagi ditolak / disensor.', tone: 'warn', icon: 'trash', confirm: 'Hapus kata' }))) return;
    try { await api.del(`/api/admin/banned-words/${encodeURIComponent(x)}`); toast(`“${x}” dihapus`); words = words.filter((y) => y !== x); } catch (e) { err(e); }
  }
  const shownWords = $derived(words.filter((x) => !wq || x.includes(wq.toLowerCase())));

  const RCOLS: Col[] = [
    { key: 'at', label: 'Waktu', snip: true, sort: true, text: (r) => r.created_at, card: 'title' },
    { key: 'target', label: 'Dilaporkan', snip: true, text: (r) => r.target_name },
    { key: 'by', label: 'Oleh', snip: true, text: (r) => r.reporter_name ?? '' },
    { key: 'reason', label: 'Alasan', text: (r) => r.reason ?? '—' },
    { key: 'ev', label: 'Obrolan terakhir', snip: true, text: (r) => (r.evidence ?? []).map((e: any) => e.text).join(' | ') },
    { key: 'place', label: 'Tempat', off: true, text: (r) => r.place ?? '' },
    { key: '_act', label: '', snip: true, req: true },
  ];
  const ACOLS: Col[] = [
    { key: 'at', label: 'Waktu', snip: true, sort: true, text: (c) => c.created_at, card: 'title' },
    { key: 'user', label: 'Pemain', snip: true, text: (c) => c.user_name },
    { key: 'inst', label: 'Alun-alun', text: (c) => c.inst, num: true },
    { key: 'text', label: 'Pesan', html: (c) => hl(c.text), text: (c) => c.text },
    { key: '_act', label: '', snip: true, req: true },
  ];
  const HCOLS: Col[] = [
    { key: 'at', label: 'Waktu', snip: true, sort: true, text: (c) => c.created_at, card: 'title' },
    { key: 'user', label: 'Pemain', snip: true, text: (c) => c.user_name },
    { key: 'host', label: 'Di rumah', snip: true, text: (c) => c.host_name },
    { key: 'text', label: 'Pesan', html: (c) => hl(c.text), text: (c) => c.text },
    { key: '_act', label: '', snip: true, req: true },
  ];
</script>

<PageHead title="Moderasi" {updated} onrefresh={load}>
  Laporan pemain, obrolan, dan kata terlarang
</PageHead>

<div class="tabsbar"><Tabs bind:active={tab} onchange={switchTab} tabs={[
  { k: 'laporan', label: 'Laporan', count: (tab === 'laporan' ? open : A.badges.reports ?? 0) || null, tone: 'no' },
  { k: 'alun', label: 'Obrolan alun-alun' },
  { k: 'rumah', label: 'Obrolan di rumah' },
  { k: 'kata', label: 'Kata terlarang', count: words.length || null },
]} /></div>

{#if tab === 'laporan'}
  <p class="help">Laporan hanya diterima dari pemain yang sedang bertemu di alun-alun yang sama. Tiga pelapor berbeda dalam satu jam otomatis membisukan obrolan 30 menit.</p>
  {#key tab}<FilterBar bind:q bind:values={vals} filters={FILTERS.laporan} placeholder="Cari nama pemain, pelapor, atau alasan" onchange={load} keep={{ tab }} count={reports.length} />{/key}
  <DataTable cols={RCOLS} rows={reports} bind:state={tsR} {loading} selectable bind:selected prefKey="mod-reports" csv="local" csvName="laporan" empty={!vals.status ? 'Tidak ada laporan baru' : 'Tidak ada laporan'} emptyText={!vals.status ? 'Semua laporan sudah ditangani.' : ''} emptyIcon="shield"
    rowClass={(r) => (r.handled_at ? 'done' : '')}>
    {#snippet cell(r, k)}
      {#if k === 'at'}<span class="tm"><Ago t={r.created_at} /><small class="muted">{dt(r.created_at)}</small></span>
      {:else if k === 'target'}
        <span class="tg"><a href="#/players/{r.target_id}"><b>{r.target_name}</b></a>
          <small class="muted">{r.week} pelapor / 7 hari</small>
          <span class="chips">{#if r.banned_at}<span class="chip no">diblokir</span>{/if}{#if isMuted(r)}<span class="chip warn">dibisukan s.d. {dt(r.muted_until)}</span>{/if}</span></span>
      {:else if k === 'by'}{#if r.reporter_id}<a href="#/players/{r.reporter_id}">{r.reporter_name}</a>{:else}—{/if}
      {:else if k === 'ev'}<span class="ev">{#each (r.evidence ?? []).slice(0, 3) as e}<span>“{@html hl(e.text)}”</span>{:else}<span class="muted">—</span>{/each}</span>
      {:else if k === '_act'}
        <span class="acts">
          {#if !r.banned_at}{#if isMuted(r)}<button class="btn sm" onclick={() => unmute(r.target_id, r.target_name)}>{@html I.sound}Buka bisu</button>{:else}<button class="btn sm" onclick={() => mute(r.target_id, r.target_name)}>{@html I.mute}Bisukan</button>{/if}
          <button class="btn sm danger" onclick={() => ban(r.target_id, r.target_name)}>{@html I.ban}Blokir</button>{/if}
          {#if r.handled_at}<small class="muted">selesai · {r.handled_by}</small>{:else}<button class="btn sm primary" onclick={() => handle([String(r.id)])}>{@html I.check}Selesai</button>{/if}
        </span>
      {/if}
    {/snippet}
    {#snippet bulk(ids)}<button class="btn sm" onclick={() => handle(ids)}>{@html I.check}Tandai selesai</button>{/snippet}
  </DataTable>
{:else if tab === 'alun'}
  <p class="help">300 pesan terakhir sesuai filter. Kata terlarang disorot. Matikan ketik bebas lewat Ekonomi &amp; fitur › Alun-alun › freeChat.</p>
  {#key tab}<FilterBar bind:q bind:values={vals} filters={FILTERS.alun} placeholder="Cari isi pesan atau nama pemain" onchange={load} keep={{ tab }} count={square.length} />{/key}
  <DataTable cols={ACOLS} rows={square} bind:state={tsA} {loading} prefKey="mod-square" csv="local" csvName="obrolan-alun-alun" empty="Belum ada obrolan" emptyIcon="chat">
    {#snippet cell(c, k)}
      {#if k === 'at'}<span class="tm"><Ago t={c.created_at} /><small class="muted">{dt(c.created_at)}</small></span>
      {:else if k === 'user'}<a href="#/players/{c.user_id}">{c.user_name}</a>{#if c.banned_at} <span class="chip no">diblokir</span>{:else if isMuted(c)} <span class="chip warn">dibisukan</span>{/if}
      {:else if k === '_act'}{#if !c.banned_at && !isMuted(c)}<button class="btn sm" onclick={() => mute(c.user_id, c.user_name)}>{@html I.mute}Bisukan</button>{/if}
      {/if}
    {/snippet}
  </DataTable>
{:else if tab === 'rumah'}
  <p class="help">Pesan saat kunjungan bareng (300 terakhir sesuai filter). Pesan dengan kata terlarang, tautan, akun, atau nomor sudah ditolak otomatis.</p>
  {#key tab}<FilterBar bind:q bind:values={vals} filters={FILTERS.rumah} placeholder="Cari isi pesan, pemain, atau tuan rumah" onchange={load} keep={{ tab }} count={chats.length} />{/key}
  <DataTable cols={HCOLS} rows={chats} bind:state={tsH} {loading} prefKey="mod-house" csv="local" csvName="obrolan-rumah" empty="Belum ada obrolan" emptyIcon="chat">
    {#snippet cell(c, k)}
      {#if k === 'at'}<span class="tm"><Ago t={c.created_at} /><small class="muted">{dt(c.created_at)}</small></span>
      {:else if k === 'user'}<a href="#/players/{c.user_id}">{c.user_name}</a>{#if c.banned_at} <span class="chip no">diblokir</span>{:else if isMuted(c)} <span class="chip warn">dibisukan</span>{/if}
      {:else if k === 'host'}<a href="#/players/{c.host_id}">{c.host_name}</a>
      {:else if k === '_act'}{#if !c.banned_at && !isMuted(c)}<button class="btn sm" onclick={() => mute(c.user_id, c.user_name)}>{@html I.mute}Bisukan</button>{/if}
      {/if}
    {/snippet}
  </DataTable>
{:else}
  <section class="card words">
    <p class="help">Nama pet/pemain yang mengandung kata ini ditolak (termasuk variasi angka seperti 4 → a). Di pesan hadiah dan obrolan, kata ini disensor menjadi ***.</p>
    <div class="row">
      <form class="row add" onsubmit={addWord}><input bind:value={w} placeholder="Tambah kata" aria-label="Kata baru" /><button class="btn primary" disabled={w.trim().length < 2}>{@html I.plus}Tambah</button></form>
      <input class="wq" type="search" bind:value={wq} placeholder="Cari di {num(words.length)} kata" aria-label="Cari kata" />
    </div>
    {#if shownWords.length}
      <div class="wl">{#each shownWords as x (x)}<span class="w">{x}<button aria-label="Hapus {x}" onclick={() => rmWord(x)}>{@html I.x}</button></span>{/each}</div>
    {:else}<Empty icon="shield" title={wq ? 'Tidak ada kata yang cocok' : 'Belum ada kata terlarang'} />{/if}
  </section>
{/if}

<style>
  .tabsbar { border-bottom: 1px solid var(--line); }
  .help { margin: 0; color: var(--muted); font-size: 13.5px; max-width: 100ch; }
  .tm { display: flex; flex-direction: column; } .tm small { font-size: 11.5px; }
  .tg { display: flex; flex-direction: column; gap: 2px; } .tg small { font-size: 12px; }
  .chips { display: flex; gap: 4px; flex-wrap: wrap; }
  .ev { display: flex; flex-direction: column; gap: 2px; font-size: 13px; max-width: 320px; }
  .acts { display: inline-flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; align-items: center; }
  :global(tr.done td) { opacity: .6; }
  .words { display: flex; flex-direction: column; gap: 12px; }
  .add { flex-wrap: nowrap; } .add input { width: 220px; }
  .wq { width: 220px; margin-left: auto; }
  .wl { display: flex; flex-wrap: wrap; gap: 8px; }
  .w { display: inline-flex; align-items: center; gap: 4px; background: #fff; border: 1px solid var(--line); border-radius: 999px; padding: 3px 4px 3px 12px; font-family: var(--mono); font-size: 13px; animation: pop .15s ease-out; }
  .w button { all: unset; cursor: pointer; display: grid; place-items: center; background: #F1F4F2; border-radius: 50%; width: 22px; height: 22px; color: var(--muted); }
  .w button:hover { background: var(--danger-soft); color: var(--danger); }
  .w button :global(svg) { width: 12px; height: 12px; }
  :global(mark) { background: #FFD9CF; color: #8E2F1F; }
  :global(.btn svg) { width: 14px; height: 14px; }
  @media (max-width: 760px) { .wq { margin-left: 0; width: 100%; } .add { width: 100%; } .add input { flex: 1; width: auto; } }
</style>
