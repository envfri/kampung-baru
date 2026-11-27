<script lang="ts">
  // Kuis (Cerdas Cermat Kampung): bank soal dengan saringan & statistik (tampil, % benar, laporan), tanda otomatis
  // (benar < 25 % setelah ≥ 30 jawaban, atau ≥ 3 laporan terbuka), tambah / ubah / nonaktifkan / hapus dengan validasi
  // langsung (validator yang sama dengan server & uji), pratinjau seperti di game, dan kotak laporan pemain.
  import { onMount, untrack } from 'svelte';
  import {
    KUIS_CATEGORIES, KUIS_CAT_IDS, KUIS_IMAGES, KUIS_IMAGE_NAMES, KUIS_LEVELS, KUIS_TYPES, KUIS_TYPE_IDS, KUIS_LIMITS, KUIS_SLOW,
    cleanQuestion, kuisImageSVG, validateQuestion,
  } from '@kb/shared';
  import { api, qs } from '../lib/api';
  import { A, can, err, toast, ask, num, dt, setQuery } from '../lib/store.svelte';
  import { type FDef, readFilters, filterParams } from '../lib/filters';
  import { I } from '../lib/icons';
  import PageHead from '../components/ui/PageHead.svelte';
  import FilterBar from '../components/ui/FilterBar.svelte';
  import DataTable, { type Col, type TState } from '../components/ui/DataTable.svelte';
  import Tabs from '../components/ui/Tabs.svelte';
  import Ago from '../components/ui/Ago.svelte';
  import Drawer from '../components/Drawer.svelte';

  const CAT_OPTS: [string, string][] = KUIS_CAT_IDS.map((c) => [c, KUIS_CATEGORIES[c].name]);
  const TYPE_OPTS: [string, string][] = KUIS_TYPE_IDS.map((t) => [t, KUIS_TYPES[t].name]);
  const REASON: Record<string, string> = { salah: 'Jawaban salah', bingung: 'Soal membingungkan', ketik: 'Salah ketik', lain: 'Lainnya' };
  const FQ: FDef[] = [
    { key: 'cat', label: 'Kategori', type: 'many', options: CAT_OPTS },
    { key: 'level', label: 'Level', type: 'many', options: [['1', 'Mudah'], ['2', 'Sedang'], ['3', 'Sulit']] },
    { key: 'type', label: 'Tipe', type: 'many', options: TYPE_OPTS },
    { key: 'status', label: 'Status', all: 'Aktif & nonaktif', options: [['active', 'Aktif'], ['disabled', 'Nonaktif'], ['deleted', 'Dihapus']] },
    { key: 'flagged', label: 'Tanda', all: 'Semua', options: [['true', 'Ditandai otomatis']] },
    { key: 'origin', label: 'Asal', all: 'Semua', options: [['bank', 'Bank resmi'], ['admin', 'Buatan admin']] },
  ];
  const FR: FDef[] = [{ key: 'status', label: 'Status', all: 'Belum ditangani', options: [['resolved', 'Sudah ditangani'], ['all', 'Semua laporan']] }];
  let tab = $state(A.query.tab === 'laporan' ? 'laporan' : 'soal');
  let q = $state(A.query.q ?? '');
  let vals = $state<Record<string, any>>(readFilters(tab === 'soal' ? FQ : FR, A.query));
  let rows = $state<any[]>([]), summary = $state<any>(null), reports = $state<any[]>([]), openN = $state(0);
  let loading = $state(true), updated = $state(0), selected = $state<string[]>([]);
  let tsQ = $state<TState>({ page: 0, size: 50, sort: '', dir: 'desc' }), tsR = $state<TState>({ page: 0, size: 50, sort: '', dir: 'desc' });
  const editable = $derived(can('admin'));

  async function load() {
    loading = true;
    try {
      if (tab === 'soal') { const r = await api.get('/api/admin/kuis/questions' + qs({ q, ...filterParams(FQ, vals) })); rows = r.questions; summary = r.summary; openN = r.summary.openReports; }
      else { const r = await api.get('/api/admin/kuis/reports' + qs({ status: vals.status })); reports = r.reports; openN = r.open; }
      A.badges = { ...A.badges, kuis: openN };
      updated = Date.now();
    } catch (e) { err(e); }
    loading = false;
  }
  onMount(load);
  // tautan #/kuis/<id> (juga dari kotak laporan / pindah tautan di halaman yang sama): buka soal itu
  $effect(() => { const a = A.arg; if (a && /^[a-z]{3}-\d{3}$/.test(a)) untrack(() => { if (ed?.id !== a) openQ(a); }); });
  // tautan #/kuis?tab=laporan di halaman yang sama (mis. dari dasbor / menu): ikut pindah tab
  $effect(() => {
    const t = A.query.tab === 'laporan' ? 'laporan' : 'soal';
    untrack(() => { if (t !== tab) { tab = t; q = ''; selected = []; vals = readFilters(t === 'soal' ? FQ : FR, A.query); load(); } });
  });
  function switchTab(k: string) { q = ''; selected = []; vals = readFilters(k === 'soal' ? FQ : FR, {}); setQuery({ tab: k }); load(); }

  const pct = (r: any) => (r.answered ? Math.round((r.correct / r.answered) * 100) : null);
  const esc = (s: string) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  const QCOLS: Col[] = [
    { key: 'id', label: 'ID', sort: true, text: (r) => r.id, w: '86px' },
    { key: 'q', label: 'Soal', snip: true, sort: true, text: (r) => r.data?.q, card: 'title' },
    { key: 'cat', label: 'Kategori', sort: true, text: (r) => KUIS_CATEGORIES[r.cat as keyof typeof KUIS_CATEGORIES]?.short ?? r.cat },
    { key: 'level', label: 'Level', sort: true, num: true, text: (r) => r.level },
    { key: 'type', label: 'Tipe', sort: true, text: (r) => KUIS_TYPES[r.type as keyof typeof KUIS_TYPES]?.name ?? r.type },
    { key: 'shown', label: 'Tampil', sort: true, num: true, text: (r) => r.shown },
    { key: 'pct', label: '% benar', sort: true, num: true, snip: true, text: (r) => pct(r) ?? -1 },
    { key: 'reports', label: 'Laporan', sort: true, num: true, snip: true, text: (r) => r.open_reports },
    { key: 'status', label: 'Status', snip: true, text: (r) => (r.deleted_at ? 'dihapus' : r.active ? 'aktif' : 'nonaktif') },
  ];
  const RCOLS: Col[] = [
    { key: 'at', label: 'Waktu', snip: true, sort: true, text: (r) => r.created_at, card: 'title' },
    { key: 'qid', label: 'Soal', snip: true, text: (r) => `${r.qid} ${r.qtext ?? ''}` },
    { key: 'reason', label: 'Alasan', text: (r) => REASON[r.reason] ?? r.reason },
    { key: 'note', label: 'Catatan', text: (r) => r.note ?? '—' },
    { key: 'by', label: 'Pelapor', snip: true, text: (r) => r.reporter ?? '' },
    { key: '_act', label: '', snip: true, req: true },
  ];
  async function resolve(ids: string[]) {
    try { const r = await api.post('/api/admin/kuis/reports/resolve', { ids: ids.map(Number) }); toast(`${r.count} laporan ditandai selesai`); selected = []; load(); } catch (e) { err(e); }
  }

  /* ---------------- editor ---------------- */
  type Form = { cat: string; level: number; type: string; q: string; options: string[]; answer: number; order: string[]; pairs: string[][]; image: string; explain: string; source: string };
  const blank = (): Form => ({ cat: 'budaya', level: 1, type: 'pilihan', q: '', options: ['', '', '', ''], answer: 0, order: ['', '', ''], pairs: [['', ''], ['', ''], ['', '']], image: 'komodo', explain: '', source: '' });
  let ed = $state<null | { id: string | null; f: Form; row: any; reports: any[]; saved: string; serverErr: string[] }>(null);
  function toForm(d: any): Form {
    const f = blank();
    Object.assign(f, { cat: d.cat, level: d.level, type: d.type, q: d.q ?? '', explain: d.explain ?? '', source: d.source ?? '' });
    if (Array.isArray(d.options) && d.type !== 'benarsalah') f.options = [...d.options, '', '', '', ''].slice(0, 4);
    if (Number.isInteger(d.answer)) f.answer = d.answer;
    if (Array.isArray(d.order)) f.order = [...d.order];
    if (Array.isArray(d.pairs)) f.pairs = d.pairs.map((p: string[]) => [...p]);
    if (d.image) f.image = d.image;
    return f;
  }
  function build(f: Form) {
    const o: any = { cat: f.cat, level: Number(f.level), type: f.type, q: f.q };
    if (f.type === 'benarsalah') { o.options = ['Benar', 'Salah']; o.answer = Math.min(1, f.answer); }
    else if (['pilihan', 'gambar', 'peribahasa', 'hitung'].includes(f.type)) { o.options = f.options; o.answer = f.answer; }
    if (f.type === 'gambar') o.image = f.image;
    if (f.type === 'urutkan') o.order = f.order;
    if (f.type === 'cocokkan') o.pairs = f.pairs;
    o.explain = f.explain; o.source = f.source;
    return o;
  }
  const draftId = $derived(ed ? ed.id ?? `${KUIS_CATEGORIES[ed.f.cat as keyof typeof KUIS_CATEGORIES]?.prefix ?? 'xxx'}-900` : '');
  const built = $derived(ed ? cleanQuestion({ ...build(ed.f), id: draftId }) : null);
  const errors = $derived(built ? validateQuestion(built) : []);
  const dirty = $derived(!!ed && JSON.stringify(build(ed.f)) !== ed.saved);
  const qMax = $derived(ed && KUIS_SLOW.includes(ed.f.type as any) ? KUIS_LIMITS.qShort : KUIS_LIMITS.q);

  async function openQ(id: string) {
    try {
      const r = await api.get(`/api/admin/kuis/questions/${id}`);
      const f = toForm(r.question.data);
      ed = { id, f, row: r.question, reports: r.reports, saved: JSON.stringify(build(f)), serverErr: [] };
      if (A.arg !== id) { A.arg = id; setQuery({ tab, q, ...vals }); }
    } catch (e) { err(e); }
  }
  function newQ() { const f = blank(); ed = { id: null, f, row: null, reports: [], saved: JSON.stringify(build(f)), serverErr: [] }; }
  function closeEd() { ed = null; if (A.arg) { A.arg = ''; setQuery({ tab, q, ...vals }); } }
  async function save() {
    if (!ed || errors.length) return;
    try {
      const body = { question: build(ed.f) };
      const r = ed.id ? await api.put(`/api/admin/kuis/questions/${ed.id}`, body) : await api.post('/api/admin/kuis/questions', body);
      toast(ed.id ? `Soal ${ed.id} disimpan` : `Soal baru ${r.question.id} ditambahkan`);
      const id = r.question.id;
      await load();
      await openQ(id);
    } catch (e: any) { ed!.serverErr = [e?.message ?? 'Gagal menyimpan.']; err(e); }
  }
  async function setActive(on: boolean) {
    if (!ed?.id) return;
    try { await api.post(`/api/admin/kuis/questions/${ed.id}/active`, { active: on }); toast(on ? 'Soal diaktifkan' : 'Soal dinonaktifkan: tidak muncul lagi di kuis'); await load(); await openQ(ed.id); } catch (e) { err(e); }
  }
  async function remove() {
    if (!ed?.id) return;
    if (!(await ask({ title: `Hapus soal ${ed.id}?`, body: 'Soal tidak muncul lagi di kuis dan tidak akan ditambahkan kembali oleh pembaruan bank soal. Riwayat jawaban pemain tetap tersimpan; soal bisa dipulihkan dari saringan Status › Dihapus.', tone: 'danger', icon: 'trash', confirm: 'Hapus soal' }))) return;
    try { await api.del(`/api/admin/kuis/questions/${ed.id}`); toast('Soal dihapus'); ed = null; load(); } catch (e) { err(e); }
  }
  async function restore() {
    if (!ed?.id) return;
    try { await api.post(`/api/admin/kuis/questions/${ed.id}/restore`); toast('Soal dipulihkan (masih nonaktif)'); await load(); await openQ(ed.id); } catch (e) { err(e); }
  }
  const LET = ['A', 'B', 'C', 'D'];
  const catColor = (c: string) => KUIS_CATEGORIES[c as keyof typeof KUIS_CATEGORIES]?.color ?? '#888';
</script>

<PageHead title="Kuis" {updated} onrefresh={load}>
  {#snippet actions()}{#if editable && tab === 'soal'}<button class="btn primary" onclick={newQ}>{@html I.plus}Tambah soal</button>{/if}{/snippet}
  Bank soal Cerdas Cermat Kampung, statistik jawaban, dan laporan pemain
</PageHead>

{#if summary && tab === 'soal'}
  <div class="sum">
    <span><b>{num(summary.active)}</b> aktif</span><span><b>{num(summary.disabled)}</b> nonaktif</span><span><b>{num(summary.deleted)}</b> dihapus</span>
    <button class="chip warn" onclick={() => { vals = { ...vals, flagged: 'true' }; setQuery({ tab, q, ...vals }); load(); }}><b>{summary.flagged}</b> ditandai otomatis</button>
    <button class="chip no" onclick={() => { tab = 'laporan'; switchTab('laporan'); }}><b>{summary.openReports}</b> laporan terbuka</button>
  </div>
{/if}

<div class="tabsbar"><Tabs bind:active={tab} onchange={switchTab} tabs={[{ k: 'soal', label: 'Soal' }, { k: 'laporan', label: 'Laporan pemain', count: openN || null, tone: 'no' }]} /></div>

{#if tab === 'soal'}
  <p class="help">Ditandai otomatis: benar &lt; 25 % setelah paling tidak 30 jawaban, atau ≥ 3 laporan terbuka. Soal buatan admin memakai nomor 900–999. Menghapus soal menyimpannya sebagai “dihapus” supaya pembaruan bank tidak menambahkannya lagi.</p>
  {#key tab}<FilterBar bind:q bind:values={vals} filters={FQ} placeholder="Cari teks soal, pilihan, penjelasan, atau ID" onchange={load} keep={{ tab }} count={rows.length} />{/key}
  <DataTable cols={QCOLS} rows={rows} bind:state={tsQ} {loading} prefKey="kuis-soal" csv="local" csvName="soal-kuis" empty="Tidak ada soal yang cocok" emptyIcon="quest"
    onrow={(r) => openQ(r.id)} rowClass={(r) => (r.deleted_at || !r.active ? 'dim' : r.flagged ? 'flag' : '')}>
    {#snippet cell(r, k)}
      {#if k === 'q'}<span class="qt"><span class="dot" style="background:{catColor(r.cat)}"></span>{r.data?.q}{#if r.type === 'gambar'}<em class="img">{KUIS_IMAGE_NAMES[r.data.image as keyof typeof KUIS_IMAGE_NAMES] ?? r.data.image}</em>{/if}</span>
      {:else if k === 'pct'}{#if pct(r) === null}<span class="muted">—</span>{:else}<span class:low={pct(r)! < 25 && r.answered >= 30}>{pct(r)}%</span> <small class="muted">/{r.answered}</small>{/if}
      {:else if k === 'reports'}{#if r.open_reports}<span class="chip no">{r.open_reports} terbuka</span>{:else if r.reports}<span class="muted">{r.reports}</span>{:else}<span class="muted">—</span>{/if}
      {:else if k === 'status'}
        {#if r.deleted_at}<span class="chip mute">dihapus</span>{:else if !r.active}<span class="chip mute">nonaktif</span>{:else}<span class="chip">aktif</span>{/if}
        {#if r.flagged}<span class="chip warn" title="Ditandai otomatis">ditandai</span>{/if}
      {/if}
    {/snippet}
  </DataTable>
{:else}
  <p class="help">Laporan “Laporkan soal” dari pemain (Jawaban salah, Soal membingungkan, Salah ketik, Lainnya). Buka soalnya untuk memperbaiki, lalu tandai laporan selesai.</p>
  {#key tab}<FilterBar bind:q bind:values={vals} filters={FR} placeholder="Cari" onchange={load} keep={{ tab }} count={reports.length} />{/key}
  <DataTable cols={RCOLS} rows={reports.filter((r) => !q || `${r.qid} ${r.qtext} ${r.note ?? ''} ${r.reporter ?? ''}`.toLowerCase().includes(q.toLowerCase()))} bind:state={tsR} {loading} selectable bind:selected prefKey="kuis-lapor" csv="local" csvName="laporan-kuis"
    empty={!vals.status ? 'Tidak ada laporan baru' : 'Tidak ada laporan'} emptyText={!vals.status ? 'Semua laporan soal sudah ditangani.' : ''} emptyIcon="shield" rowClass={(r) => (r.resolved_at ? 'done' : '')}>
    {#snippet cell(r, k)}
      {#if k === 'at'}<span class="tm"><Ago t={r.created_at} /><small class="muted">{dt(r.created_at)}</small></span>
      {:else if k === 'qid'}<button class="link qlink" onclick={() => openQ(r.qid)}><b>{r.qid}</b> {r.qtext ?? ''}</button>{#if r.open_for_q >= 3}<span class="chip warn">{r.open_for_q} laporan</span>{/if}
      {:else if k === 'by'}{#if r.user_id}<a href="#/players/{r.user_id}">{r.reporter}</a>{:else}—{/if}
      {:else if k === '_act'}
        <span class="acts"><button class="btn sm" onclick={() => openQ(r.qid)}>{@html I.edit}Buka soal</button>
          {#if r.resolved_at}<small class="muted">selesai · {r.resolved_by}</small>{:else}<button class="btn sm primary" onclick={() => resolve([String(r.id)])}>{@html I.check}Selesai</button>{/if}</span>
      {/if}
    {/snippet}
    {#snippet bulk(ids)}<button class="btn sm" onclick={() => resolve(ids)}>{@html I.check}Tandai selesai</button>{/snippet}
  </DataTable>
{/if}

{#if ed}
  {@const f = ed.f}
  <Drawer title={ed.id ? `Soal ${ed.id}` : 'Soal baru'} onclose={closeEd} wide dirty={dirty}>
    <div class="ed">
      <div class="form">
        {#if ed.row}
          <div class="stats">
            <span><b>{num(ed.row.shown)}</b> tampil</span><span><b>{num(ed.row.answered)}</b> dijawab</span>
            <span><b>{pct(ed.row) ?? '—'}{pct(ed.row) !== null ? '%' : ''}</b> benar</span><span><b>{ed.row.open_reports}</b> laporan terbuka</span>
            {#if ed.row.flagged}<span class="chip warn">ditandai otomatis</span>{/if}
            {#if ed.row.deleted_at}<span class="chip mute">dihapus</span>{:else if !ed.row.active}<span class="chip mute">nonaktif</span>{/if}
            <span class="muted">{ed.row.origin === 'bank' ? 'bank resmi' : 'buatan admin'}{#if ed.row.updated_by}{' '}· diubah {ed.row.updated_by}{/if}</span>
          </div>
        {/if}
        <div class="g3">
          <label>Kategori<select bind:value={f.cat} disabled={!!ed.id || !editable}>{#each CAT_OPTS as [k, l]}<option value={k}>{l}</option>{/each}</select></label>
          <label>Level<select bind:value={f.level} disabled={!editable}>{#each [1, 2, 3] as l}<option value={l}>{l} · {KUIS_LEVELS[l]}</option>{/each}</select></label>
          <label>Tipe<select bind:value={f.type} disabled={!editable}>{#each TYPE_OPTS as [k, l]}<option value={k}>{l}</option>{/each}</select></label>
        </div>
        <label>Teks soal <small class:bad={f.q.length > qMax}>{f.q.length}/{qMax}</small>
          <textarea rows="2" bind:value={f.q} disabled={!editable} placeholder={f.type === 'peribahasa' ? 'Lengkapi peribahasa: Bagai air di daun ___.' : f.type === 'gambar' ? 'Hewan di gambar ini … Apa namanya? (jangan sebut jawabannya)' : 'Tulis soal'}></textarea></label>
        {#if f.type === 'gambar'}
          <label>Gambar<select bind:value={f.image} disabled={!editable}>{#each KUIS_IMAGES as k}<option value={k}>{KUIS_IMAGE_NAMES[k]} ({k})</option>{/each}</select></label>
        {/if}
        {#if f.type === 'benarsalah'}
          <fieldset><legend>Jawaban benar</legend>
            <div class="rad">{#each ['Benar', 'Salah'] as o, i}<label class="r"><input type="radio" name="ans" checked={f.answer === i} disabled={!editable} onchange={() => (f.answer = i)} />{o}</label>{/each}</div>
          </fieldset>
        {:else if ['pilihan', 'gambar', 'peribahasa', 'hitung'].includes(f.type)}
          <fieldset><legend>Pilihan jawaban (pilih yang benar){f.type === 'hitung' ? ' · berupa angka' : ''}</legend>
            {#each f.options as _, i}
              <div class="opt"><input type="radio" name="ans" checked={f.answer === i} disabled={!editable} onchange={() => (f.answer = i)} aria-label="Pilihan {LET[i]} benar" /><b>{LET[i]}</b><input bind:value={f.options[i]} disabled={!editable} placeholder="Pilihan {LET[i]}" /></div>
            {/each}
          </fieldset>
        {:else if f.type === 'urutkan'}
          <fieldset><legend>Butir dalam urutan BENAR (3–5; game mengacaknya)</legend>
            {#each f.order as _, i}<div class="opt"><b>{i + 1}</b><input bind:value={f.order[i]} disabled={!editable} placeholder="Butir ke-{i + 1}" />{#if editable && f.order.length > 3}<button class="btn sm ghost" aria-label="Hapus butir" onclick={() => (f.order = f.order.filter((_, j) => j !== i))}>{@html I.x}</button>{/if}</div>{/each}
            {#if editable && f.order.length < 5}<button class="btn sm" onclick={() => (f.order = [...f.order, ''])}>{@html I.plus}Tambah butir</button>{/if}
          </fieldset>
        {:else if f.type === 'cocokkan'}
          <fieldset><legend>Pasangan BENAR (3–4; game mengacak sisi kanan)</legend>
            {#each f.pairs as _, i}<div class="opt pr"><input bind:value={f.pairs[i][0]} disabled={!editable} placeholder="Kiri" /><span>↔</span><input bind:value={f.pairs[i][1]} disabled={!editable} placeholder="Kanan" />{#if editable && f.pairs.length > 3}<button class="btn sm ghost" aria-label="Hapus pasangan" onclick={() => (f.pairs = f.pairs.filter((_, j) => j !== i))}>{@html I.x}</button>{/if}</div>{/each}
            {#if editable && f.pairs.length < 4}<button class="btn sm" onclick={() => (f.pairs = [...f.pairs, ['', '']])}>{@html I.plus}Tambah pasangan</button>{/if}
          </fieldset>
        {/if}
        <label>Penjelasan (tampil sebagai “Tahukah kamu? …”) <small class:bad={f.explain.length > KUIS_LIMITS.explain}>{f.explain.length}/{KUIS_LIMITS.explain}</small>
          <textarea rows="3" bind:value={f.explain} disabled={!editable} placeholder="1–2 kalimat. Jangan diawali “Tahukah kamu”."></textarea></label>
        <label>Sumber (hanya untuk admin)<input bind:value={f.source} disabled={!editable} placeholder="mis. KBBI: entri gotong royong" /></label>
        {#if errors.length || ed.serverErr.length}
          <ul class="errs" role="alert">{#each [...errors, ...ed.serverErr.filter((e) => !errors.includes(e))] as e}<li>{e}</li>{/each}</ul>
        {:else}<p class="okv">{@html I.check} Soal lolos semua aturan bank soal.</p>{/if}
        {#if ed.reports.length}
          <div class="reps"><b>Laporan pemain</b>
            {#each ed.reports as r (r.id)}<div class="rep" class:done={r.resolved_at}><span class="chip {r.resolved_at ? 'mute' : 'no'}">{REASON[r.reason] ?? r.reason}</span><span>{r.note ?? ''}</span><small class="muted">{r.reporter ?? '—'} · {dt(r.created_at)}</small></div>{/each}
            {#if ed.reports.some((r) => !r.resolved_at)}<button class="btn sm" onclick={async () => { await resolve(ed!.reports.filter((r) => !r.resolved_at).map((r) => String(r.id))); if (ed?.id) openQ(ed.id); }}>{@html I.check}Tandai semua laporan selesai</button>{/if}
          </div>
        {/if}
      </div>
      <aside class="prev" aria-label="Pratinjau">
        <b class="ph">Pratinjau di game</b>
        {#if built}
          <div class="pv">
            <div class="meta"><span class="cat" style="background:{catColor(f.cat)}">{KUIS_CATEGORIES[f.cat as keyof typeof KUIS_CATEGORIES]?.name}</span><span class="lv">{'★'.repeat(f.level)}</span><span class="tp">{KUIS_TYPES[f.type as keyof typeof KUIS_TYPES]?.name}</span></div>
            {#if f.type === 'gambar'}<div class="pic">{@html kuisImageSVG(f.image)}</div>{/if}
            <p class="pq">{#if f.type === 'peribahasa'}{@html esc(f.q || '…').replace('___', '<span class="blank">?</span>')}{:else}{f.q || '…'}{/if}</p>
            {#if built.options}
              <div class="po" class:two={f.type !== 'benarsalah'}>{#each built.options as o, i}<span class:ok={i === built.answer}>{f.type !== 'benarsalah' ? `${LET[i]}. ` : ''}{o || '…'}{#if i === built.answer}{' '}✓{/if}</span>{/each}</div>
            {:else if f.type === 'urutkan'}
              <ol class="pl">{#each f.order as o}<li>{o || '…'}</li>{/each}</ol><small class="muted">Pemain melihat butir dalam urutan acak.</small>
            {:else if f.type === 'cocokkan'}
              <div class="pp">{#each f.pairs as p}<span>{p[0] || '…'}</span><span>↔ {p[1] || '…'}</span>{/each}</div><small class="muted">Sisi kanan diacak di game.</small>
            {/if}
            <p class="tk"><b>Tahukah kamu?</b> {f.explain || '…'}</p>
          </div>
        {/if}
      </aside>
    </div>
    {#snippet footer()}
      {#if editable}
        {#if ed.id && ed.row && !ed.row.deleted_at}
          <button class="btn danger" onclick={remove}>{@html I.trash}Hapus</button>
          <button class="btn" onclick={() => setActive(!ed!.row.active)}>{ed.row.active ? 'Nonaktifkan' : 'Aktifkan'}</button>
        {:else if ed.row?.deleted_at}<button class="btn" onclick={restore}>{@html I.undo}Pulihkan</button>{/if}
        <span class="sp"></span>
        <button class="btn" onclick={closeEd}>Batal</button>
        <button class="btn primary" disabled={!!errors.length || (!dirty && !!ed.id)} onclick={save}>{ed.id ? 'Simpan perubahan' : 'Tambah soal'}</button>
      {:else}<button class="btn" onclick={closeEd}>Tutup</button>{/if}
    {/snippet}
  </Drawer>
{/if}

<style>
  .help { margin: 0; color: var(--muted); font-size: 13.5px; max-width: 110ch; }
  .tabsbar { border-bottom: 1px solid var(--line); }
  .sum { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; font-size: 13.5px; }
  .sum > span { background: #fff; border: 1px solid var(--line); border-radius: 999px; padding: 3px 10px; }
  .sum button.chip { cursor: pointer; border: 0; font: inherit; }
  .qt { display: inline-flex; gap: 6px; align-items: baseline; }
  .qt .dot { width: 9px; height: 9px; border-radius: 50%; flex: none; display: inline-block; }
  .img { font-style: normal; font-size: 11.5px; background: #FFF4D6; border-radius: 6px; padding: 0 5px; color: #8E6A00; white-space: nowrap; }
  .low { color: var(--danger); font-weight: 700; }
  :global(tr.dim td) { opacity: .55; }
  :global(tr.flag td:first-child) { box-shadow: inset 3px 0 0 #E3A21A; }
  :global(tr.done td) { opacity: .6; }
  .tm { display: flex; flex-direction: column; } .tm small { font-size: 11.5px; }
  .qlink { text-align: left; max-width: 380px; }
  .acts { display: inline-flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; align-items: center; }
  .ed { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 18px; align-items: start; }
  .form { display: flex; flex-direction: column; gap: 12px; }
  .form label { display: flex; flex-direction: column; gap: 4px; font-weight: 600; font-size: 13.5px; }
  .form small { font-weight: 500; color: var(--muted); } .form small.bad { color: var(--danger); font-weight: 700; }
  .g3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  fieldset { border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 6px; }
  legend { font-weight: 600; font-size: 13px; padding: 0 4px; }
  .opt { display: flex; align-items: center; gap: 8px; } .opt input:not([type=radio]) { flex: 1; } .opt b { width: 16px; }
  .opt.pr span { color: var(--muted); }
  .rad { display: flex; gap: 16px; } .r { flex-direction: row !important; align-items: center; gap: 6px !important; }
  .stats { display: flex; gap: 6px 12px; flex-wrap: wrap; align-items: center; font-size: 13px; background: #F7F8F6; border: 1px solid var(--line); border-radius: 10px; padding: 6px 10px; }
  .errs { margin: 0; padding: 8px 10px 8px 26px; background: var(--danger-soft, #FDECEA); color: #8E2F1F; border-radius: 10px; font-size: 13px; display: flex; flex-direction: column; gap: 2px; }
  .okv { margin: 0; color: #1E7A4C; font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 6px; }
  .okv :global(svg) { width: 14px; height: 14px; }
  .reps { display: flex; flex-direction: column; gap: 6px; border-top: 1px solid var(--line); padding-top: 8px; }
  .rep { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 13px; } .rep.done { opacity: .6; }
  .prev { position: sticky; top: 0; display: flex; flex-direction: column; gap: 6px; }
  .ph { font-size: 13px; color: var(--muted); }
  .pv { background: #F6E3B4; border: 3px solid #2B2F4A; border-radius: 18px; padding: 10px; display: flex; flex-direction: column; gap: 8px; color: #2B2F4A; font-family: 'Baloo 2', ui-rounded, system-ui, sans-serif; }
  .meta { display: flex; gap: 6px; align-items: center; font-size: 11.5px; font-weight: 800; flex-wrap: wrap; }
  .cat { color: #fff; border: 2px solid #2B2F4A; border-radius: 999px; padding: 0 8px; }
  .lv { color: #D99A0B; } .tp { margin-left: auto; color: #5F6478; }
  .pic { border: 2.5px solid #2B2F4A; border-radius: 14px; overflow: hidden; background: #FFF8E6; }
  .pic :global(svg) { display: block; width: 100%; height: auto; }
  .pq { margin: 0; font-weight: 800; font-size: 15.5px; line-height: 1.3; }
  .pq :global(.blank) { background: #FFE08A; border: 2px solid #2B2F4A; border-radius: 8px; padding: 0 10px; }
  .po { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; } .po:not(.two) { grid-template-columns: 1fr 1fr; }
  .po span { background: #FFFDF7; border: 2px solid #2B2F4A; border-radius: 10px; padding: 5px 7px; font-weight: 700; font-size: 13px; }
  .po span.ok { background: #BFEBCB; }
  .pl { margin: 0; padding-left: 20px; font-weight: 700; font-size: 13.5px; }
  .pp { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 8px; font-weight: 700; font-size: 13px; }
  .tk { margin: 0; font-size: 12.5px; font-weight: 600; background: #FFFDF7; border-radius: 10px; padding: 6px 8px; } .tk b { color: #B9800F; }
  .sp { flex: 1; }
  :global(.btn svg) { width: 14px; height: 14px; }
  @media (max-width: 860px) { .ed { grid-template-columns: 1fr; } .prev { position: static; } .g3 { grid-template-columns: 1fr 1fr; } }
</style>
