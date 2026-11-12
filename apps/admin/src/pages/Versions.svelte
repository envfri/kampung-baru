<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { A, err, dt, num } from '../lib/store.svelte';
  import { type FDef, readFilters } from '../lib/filters';
  import { APP_VERSION, CHANGELOG, CHANGE_KIND_LABEL, REPO_URL, type ChangeKind } from '@kb/shared';
  import PageHead from '../components/ui/PageHead.svelte';
  import FilterBar from '../components/ui/FilterBar.svelte';
  import DataTable, { type Col, type TState } from '../components/ui/DataTable.svelte';
  import Section from '../components/ui/Section.svelte';
  import Copy from '../components/ui/Copy.svelte';
  import Ago from '../components/ui/Ago.svelte';
  import Empty from '../components/ui/Empty.svelte';

  let sys = $state<any>(null), updated = $state(0);
  async function load() { try { sys = await api.get('/api/admin/system'); updated = Date.now(); } catch (e) { err(e); } }
  onMount(load);

  const KINDS: ChangeKind[] = ['baru', 'ubah', 'perbaikan', 'keamanan'];
  const counts = Object.fromEntries(KINDS.map((k) => [k, CHANGELOG.reduce((n, r) => n + r.items.filter((i) => i.kind === k).length, 0)]));
  const FILTERS: FDef[] = [
    { key: 'for', label: 'Untuk', all: 'Semua perubahan', options: [['player', 'Pemain saja']] },
    { key: 'kind', label: 'Jenis', all: 'Semua jenis', options: KINDS.map((k): [string, string] => [k, `${CHANGE_KIND_LABEL[k]} (${counts[k]})`]) },
  ];
  let q = $state(A.query.q ?? '');
  let vals = $state<Record<string, any>>(readFilters(FILTERS, A.query));
  const running = $derived(sys?.build?.version ?? null);
  const releases = $derived.by(() => {
    const needle = q.trim().toLowerCase(), only = vals.for, kind = vals.kind as ChangeKind | '';
    return CHANGELOG.map((r) => ({
      ...r,
      items: r.items.filter((i) => (!only || i.player) && (!kind || i.kind === kind) && (!needle || `${r.version} ${r.title} ${i.text}`.toLowerCase().includes(needle))),
    })).filter((r) => r.items.length > 0 || (!kind && !only && needle && `${r.version} ${r.title}`.toLowerCase().includes(needle)));
  });
  function uptime(s: number) {
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    return d ? `${d} hari ${h} jam` : h ? `${h} jam ${m} menit` : `${m} menit`;
  }
  const commitUrl = (c: string) => (c && c !== 'dev' ? `${REPO_URL}/commit/${c}` : null);

  /* ---------- riwayat deploy ---------- */
  let ts = $state<TState>({ page: 0, size: 25, sort: '', dir: 'desc' });
  // lama berjalan = sampai deploy berikutnya dimulai (yang terbaru: sampai sekarang)
  const deploys = $derived((sys?.deploys ?? []).map((d: any, i: number, all: any[]) => {
    const end = i === 0 ? Date.now() : new Date(all[i - 1].started_at).getTime();
    return { ...d, cur: i === 0, ran: Math.max(0, Math.round((end - new Date(d.started_at).getTime()) / 1000)) };
  }));
  const DCOLS: Col[] = [
    { key: 'version', label: 'Versi', req: true, snip: true, card: 'title', sort: true, text: (d) => d.version },
    { key: 'commit', label: 'Commit', snip: true, text: (d) => d.commit },
    { key: 'built_at', label: 'Dibuild', sort: true, text: (d) => d.built_at ?? '', html: (d) => (d.built_at ? dt(d.built_at) : '<span class="muted">—</span>') },
    { key: 'started_at', label: 'Mulai berjalan', sort: true, snip: true, text: (d) => d.started_at },
    { key: 'ran', label: 'Lama berjalan', num: true, sort: true, text: (d) => d.ran, html: (d) => uptime(d.ran) + (d.cur ? ' <span class="muted">(masih)</span>' : '') },
  ];
</script>

<PageHead title="Versi & changelog" updated={updated} onrefresh={load}>
  {#if running}Server menjalankan v{running} · {CHANGELOG.length} versi di changelog{:else}Versi yang berjalan, riwayat deploy, dan semua perubahan per versi{/if}
</PageHead>

{#if sys}
  {#if running && running !== APP_VERSION}
    <p class="warnbox">Halaman admin ini versi {APP_VERSION}, sedangkan server menjalankan {running}. Muat ulang halaman (Ctrl+Shift+R) setelah update.</p>
  {/if}
  <div class="top">
    <section class="card now" aria-labelledby="run-h">
      <span class="lbl" id="run-h">Versi yang berjalan</span>
      <div class="ver">v{sys.build.version}</div>
      <div class="row">
        {#if commitUrl(sys.build.commit)}<a class="chip mono" href={commitUrl(sys.build.commit)} target="_blank" rel="noopener">commit {sys.build.commit}</a>
        {:else}<span class="chip mute mono">commit {sys.build.commit}</span>{/if}
        <span class="chip {sys.env === 'production' ? '' : 'warn'}">{sys.env}</span>
      </div>
      <dl>
        <dt>Dibuild</dt><dd>{sys.build.builtAt ? dt(sys.build.builtAt) : '—'}</dd>
        <dt>Server mulai</dt><dd>{dt(sys.build.startedAt)} · {uptime(sys.uptimeSec)}</dd>
      </dl>
    </section>
    <section class="card" aria-labelledby="sys-h">
      <span class="lbl" id="sys-h">Sistem</span>
      <dl>
        <dt>Database</dt><dd>{sys.database.kind} {sys.database.version}</dd>
        <dt>Migrasi</dt><dd>{sys.migrations.length} terpasang · terakhir <span class="mono">{sys.migrations.at(-1)?.name ?? '—'}</span></dd>
        <dt>Node.js</dt><dd class="mono">{sys.node}</dd>
        <dt>Alamat</dt><dd class="mono">{sys.publicUrl}</dd>
      </dl>
    </section>
    <section class="card" aria-labelledby="prov-h">
      <span class="lbl" id="prov-h">Penyedia</span>
      <dl>
        <dt>Pembayaran</dt><dd>{sys.providers.payments}{#if sys.providers.payments === 'mock'} <span class="chip warn">simulasi</span>{/if}</dd>
        <dt>Email</dt><dd>{sys.providers.email ?? '—'}</dd>
        <dt>WhatsApp</dt><dd>{sys.providers.whatsapp ?? '—'}</dd>
        <dt>Push</dt><dd>{sys.providers.push ? 'aktif' : '—'}</dd>
      </dl>
    </section>
  </div>
{:else}
  <div class="top">{#each Array(3) as _}<div class="card sk"><span class="skel" style="width:40%"></span><span class="skel" style="width:70%;height:26px"></span><span class="skel" style="width:85%"></span><span class="skel" style="width:60%"></span></div>{/each}</div>
{/if}

<Section title="Riwayat deploy" prefKey="versions-deploys">
  {#snippet badge()}{#if sys}<span class="chip mute">{sys.deploys.length}</span>{/if}{/snippet}
  <DataTable cols={DCOLS} rows={deploys} bind:state={ts} loading={!sys} prefKey="deploys" csv="local" csvName="deploy" sizes={[10, 25, 50]}
    empty="Belum ada riwayat deploy" emptyIcon="rocket" rowClass={(d) => (d.cur ? 'cur' : '')}>
    {#snippet cell(d, k)}
      {#if k === 'version'}<span class="vv"><b>v{d.version}</b>{#if d.cur}<span class="chip">sekarang</span>{/if}</span>
      {:else if k === 'commit'}
        {#if commitUrl(d.commit)}<span class="cm"><a class="mono" href={commitUrl(d.commit)} target="_blank" rel="noopener">{d.commit}</a><Copy text={d.commit} label="Commit disalin" /></span>{:else}<span class="mono muted">{d.commit}</span>{/if}
      {:else if k === 'started_at'}<span title={dt(d.started_at)}>{dt(d.started_at)} <small class="muted">· <Ago t={d.started_at} /></small></span>
      {/if}
    {/snippet}
  </DataTable>
</Section>

{#if sys}
  <Section title="Migrasi database" open={false} prefKey="versions-mig">
    {#snippet badge()}<span class="chip mute">{sys.migrations.length}</span>{/snippet}
    <ul class="mig">{#each sys.migrations as m}<li><span class="mono">{m.name}</span> <span class="muted">· {dt(m.applied_at)}</span></li>{/each}</ul>
  </Section>
{/if}

<div class="clh">
  <h2>Changelog</h2>
  <p class="muted">Sama dengan <a href={`${REPO_URL}/blob/main/CHANGELOG.md`} target="_blank" rel="noopener">CHANGELOG.md</a>. Item bertanda <span class="chip pl">pemain</span> juga tampil di menu "Apa yang baru" di game.</p>
</div>
<FilterBar bind:q bind:values={vals} filters={FILTERS} placeholder="Cari perubahan…" count={releases.reduce((n, r) => n + r.items.length, 0)} />

<div class="rels">
  {#each releases as r (r.version)}
    <article class="card rel" class:cur={r.version === running}>
      <header>
        <span class="v">v{r.version}</span>
        <div class="tt"><h3>{r.title}</h3><span class="muted small">{r.date}{#if r.version === running}{' · '}<b class="ok">terpasang di server</b>{/if}</span></div>
      </header>
      {#if r.summary}<p class="sum">{r.summary}</p>{/if}
      {#each KINDS as k}
        {@const items = r.items.filter((i) => i.kind === k)}
        {#if items.length}
          <div class="grp"><span class="kind k-{k}">{CHANGE_KIND_LABEL[k]}</span>
            <ul>{#each items as i}<li>{i.text}{#if i.player} <span class="chip pl">pemain</span>{/if}</li>{/each}</ul>
          </div>
        {/if}
      {/each}
      {#if r.commits?.length}<p class="muted small">Commit: {#each r.commits as c, j}{j ? ', ' : ''}<a class="mono" href={`${REPO_URL}/commit/${c}`} target="_blank" rel="noopener">{c}</a>{/each}</p>{/if}
    </article>
  {:else}
    <div class="card"><Empty icon="search" title="Tidak ada perubahan yang cocok" text="Coba kata kunci lain atau hapus filter." /></div>
  {/each}
</div>
<p class="muted small">Total {CHANGELOG.length} versi · {num(CHANGELOG.reduce((n, r) => n + r.items.length, 0))} perubahan.</p>

<style>
  .top { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 12px; }
  .sk { display: flex; flex-direction: column; gap: 10px; }
  .lbl { font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
  .now .ver { font-family: var(--display); font-size: 40px; font-weight: 800; line-height: 1.1; margin: 4px 0 8px; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; margin: 10px 0 0; font-size: 14px; }
  dt { color: var(--muted); font-weight: 600; } dd { margin: 0; word-break: break-word; }
  .warnbox { background: var(--warn-soft); color: var(--warn); border-radius: 10px; padding: 8px 12px; font-weight: 600; margin: 0; }
  .vv { display: inline-flex; gap: 8px; align-items: center; }
  .cm { display: inline-flex; gap: 6px; align-items: center; }
  :global(.dt tr.cur td) { background: #F3FAF7; }
  .mig { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 2px; font-size: 13.5px; }
  .clh { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
  .clh h2 { font-size: 21px; } .clh p { margin: 0; font-size: 13.5px; }
  .rels { display: flex; flex-direction: column; gap: 12px; }
  .rel { display: flex; flex-direction: column; gap: 10px; }
  .rel.cur { border: 2px solid var(--accent); }
  .rel header { display: flex; gap: 12px; align-items: center; }
  .v { font-family: var(--display); font-weight: 800; font-size: 17px; background: var(--ink); color: #fff; border-radius: 10px; padding: 3px 10px; white-space: nowrap; }
  .tt h3 { margin: 0; font-size: 17px; }
  .sum { margin: 0; font-style: italic; color: var(--muted); }
  .grp { display: grid; grid-template-columns: 96px 1fr; gap: 8px; align-items: start; }
  .grp ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 3px; }
  .kind { font-size: 12px; font-weight: 700; border-radius: 999px; padding: 2px 9px; text-align: center; }
  .k-baru { background: var(--accent-soft); color: var(--accent); }
  .k-ubah { background: #E2ECF8; color: #2C5A8A; }
  .k-perbaikan { background: var(--warn-soft); color: var(--warn); }
  .k-keamanan { background: var(--danger-soft); color: var(--danger); }
  .chip.pl { background: #F1E6FA; color: #6B3D93; }
  .ok { color: var(--accent); }
  .small { font-size: 12.5px; }
  @media (max-width: 600px) { .grp { grid-template-columns: 1fr; } .grp .kind { justify-self: start; } }
</style>
