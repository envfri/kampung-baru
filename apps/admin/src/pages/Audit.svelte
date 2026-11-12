<script lang="ts">
  import { onMount } from 'svelte';
  import { AUDIT_CATS, AUDIT_DANGER, AUDIT_LABEL, auditCat, diffPaths } from '@kb/shared';
  import { api, qs, downloadCsv } from '../lib/api';
  import { A, err, num, dt, copy, setQuery } from '../lib/store.svelte';
  import { type FDef, readFilters, filterParams } from '../lib/filters';
  import { I } from '../lib/icons';
  import PageHead from '../components/ui/PageHead.svelte';
  import FilterBar from '../components/ui/FilterBar.svelte';
  import DataTable, { type Col, type TState } from '../components/ui/DataTable.svelte';
  import Modal from '../components/ui/Modal.svelte';
  import Ago from '../components/ui/Ago.svelte';

  let admins = $state<string[]>([]);
  const FILTERS = $derived<FDef[]>([
    { key: 'admin', label: 'Admin', type: 'many', options: admins.map((a) => [a, a] as [string, string]) },
    { key: 'cat', label: 'Jenis aksi', type: 'many', options: AUDIT_CATS.map((c) => [c.key, c.label] as [string, string]) },
    { key: 'at', label: 'Waktu', type: 'dates' },
  ]);
  const BASEF: FDef[] = [{ key: 'admin', label: '', type: 'many' }, { key: 'cat', label: '', type: 'many' }, { key: 'at', label: '', type: 'dates' }];
  let q = $state(A.query.q ?? '');
  let vals = $state<Record<string, any>>(readFilters(BASEF, A.query));
  let ts = $state<TState>({ page: 0, size: 25, sort: 'at', dir: A.query.dir === 'asc' ? 'asc' : 'desc' });
  let rows = $state<any[]>([]), total = $state(0), loading = $state(true), updated = $state(0);
  async function load() {
    loading = true;
    try { const r = await api.get('/api/admin/audit' + qs({ q, ...filterParams(FILTERS, vals), page: ts.page, size: ts.size, sort: 'at', dir: ts.dir })); rows = r.audit; total = r.total; admins = r.admins; updated = Date.now(); } catch (e) { err(e); }
    loading = false;
  }
  onMount(load);
  function onFilter() { ts.page = 0; load(); }

  const TONE: Record<string, string> = { pemain: 'blue', uang: 'warn', konten: '', pesan: 'mute', sistem: 'mute' };
  const tone = (a: string) => (AUDIT_DANGER.test(a) ? 'no' : TONE[auditCat(a)] ?? '');
  const label = (a: string) => AUDIT_LABEL[a] ?? a.replace(/_/g, ' ');
  const UUID = /^[0-9a-f-]{36}$/i;
  const COLS: Col[] = [
    { key: 'at', label: 'Waktu', sort: 'at', snip: true, text: (r) => r.created_at, card: 'title' },
    { key: 'admin', label: 'Admin', text: (r) => r.admin_email ?? '—' },
    { key: 'action', label: 'Aksi', snip: true, text: (r) => r.action },
    { key: 'target', label: 'Target', snip: true, text: (r) => r.target ?? '' },
    { key: 'sum', label: 'Ringkasan', snip: true, text: (r) => summary(r) },
    { key: '_act', label: '', snip: true, req: true },
  ];
  /** ringkasan singkat isi detail */
  function summary(r: any) {
    const d = r.detail;
    if (!d) return '';
    if (Array.isArray(d.changes)) return `${d.changes.length} nilai diubah`;
    if (r.action === 'player_wallet') return `${d.delta > 0 ? '+' : ''}${num(d.delta)} ${d.currency === 'coin' ? 'koin' : 'Mutiara'} · ${d.reason ?? ''}`;
    if (r.action === 'player_ban' || r.action === 'player_mute') return d.reason ?? '';
    if (d.reason) return String(d.reason);
    if (d.title) return String(d.title);
    const keys = Object.keys(d);
    return keys.length ? keys.slice(0, 3).join(', ') : '';
  }
  // detail: perbedaan Sebelum → Sesudah bila ada
  let sel = $state<any>(null), view = $state<'diff' | 'json'>('diff');
  const fmtV = (v: unknown) => (v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));
  const diff = $derived.by(() => {
    const d = sel?.detail;
    if (!d) return null;
    if (Array.isArray(d.changes)) return d.changes as { path: string; before: unknown; after: unknown }[];
    if (d.before !== undefined && d.after !== undefined) return diffPaths(d.before, d.after);
    return null;
  });
  const flat = $derived(sel?.detail && !diff ? Object.entries(sel.detail).filter(([k]) => k !== 'ids') : []);
</script>

<PageHead title="Log audit" {updated} onrefresh={load}>
  Semua perubahan oleh admin tercatat di sini · {num(total)} catatan
  {#snippet actions()}<button class="btn" onclick={() => downloadCsv('/api/admin/export/audit.csv' + qs({ q, ...filterParams(FILTERS, vals) }))}>{@html I.download}Ekspor CSV</button>{/snippet}
</PageHead>

<FilterBar bind:q bind:values={vals} filters={FILTERS} placeholder="Cari target, aksi, atau isi detail" onchange={onFilter} count={total} />

<DataTable cols={COLS} {rows} {total} bind:state={ts} onstate={() => { setQuery({ q, ...vals, dir: ts.dir === 'desc' ? '' : ts.dir }); load(); }} {loading} prefKey="audit"
  onrow={(r) => { if (r.detail) { sel = r; view = 'diff'; } }} empty="Belum ada catatan yang cocok" emptyIcon="list">
  {#snippet cell(r, k)}
    {#if k === 'at'}<span class="tm"><Ago t={r.created_at} /><small class="muted">{dt(r.created_at)}</small></span>
    {:else if k === 'action'}<span class="act"><span class="chip {tone(r.action)}">{label(r.action)}</span><small class="mono muted">{r.action}</small></span>
    {:else if k === 'target'}{#if r.target && UUID.test(r.target) && r.action.startsWith('player_')}<a class="mono" href="#/players/{r.target}">{r.target.slice(0, 8)}…</a>{:else}<span class="tg">{r.target ?? '—'}</span>{/if}
    {:else if k === 'sum'}<span class="sm">{summary(r)}</span>
    {:else if k === '_act'}{#if r.detail}<button class="btn sm">{@html I.eye}Detail</button>{/if}
    {/if}
  {/snippet}
</DataTable>

{#if sel}
  <Modal title={label(sel.action)} sub="{sel.admin_email ?? 'sistem'} · {dt(sel.created_at)}{sel.target ? ' · ' + sel.target : ''}" icon="list" tone={tone(sel.action) === 'no' ? 'danger' : tone(sel.action) === 'warn' ? 'warn' : 'info'} wide onclose={() => (sel = null)}>
    {#if sel.detail}
      <div class="seg"><button class:on={view === 'diff'} onclick={() => (view = 'diff')}>{diff ? 'Perbedaan' : 'Ringkasan'}</button><button class:on={view === 'json'} onclick={() => (view = 'json')}>JSON lengkap</button></div>
      {#if view === 'diff'}
        {#if diff}
          {#if diff.length}
            <div class="diff">
              {#each diff as c}<div class="dp">{c.path}</div><div class="minus">−  {fmtV(c.before)}</div><div class="plus">+  {fmtV(c.after)}</div>{/each}
            </div>
          {:else}<p class="muted">Disimpan tanpa perubahan nilai.</p>{/if}
        {:else}
          <dl class="kv">{#each flat as [k, v]}<dt>{k}</dt><dd>{fmtV(v)}</dd>{/each}</dl>
          <p class="muted sm">Catatan lama tidak menyimpan nilai sebelumnya. Mulai versi ini, perubahan pengaturan dicatat Sebelum → Sesudah.</p>
        {/if}
      {:else}<pre>{JSON.stringify(sel.detail, null, 2)}</pre>{/if}
    {:else}<p class="muted">Tidak ada detail.</p>{/if}
    {#snippet footer()}
      {#if sel.detail}<button class="btn" onclick={() => copy(JSON.stringify(sel.detail, null, 2), 'JSON disalin')}>{@html I.copy}Salin JSON</button>{/if}
      <button class="btn" onclick={() => (sel = null)}>Tutup</button>
    {/snippet}
  </Modal>
{/if}

<style>
  .tm { display: flex; flex-direction: column; } .tm small { font-size: 11.5px; }
  .act { display: flex; flex-direction: column; gap: 2px; align-items: flex-start; } .act small { font-size: 11px; }
  .tg { max-width: 260px; display: inline-block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: bottom; }
  .sm { font-size: 13px; color: var(--muted); max-width: 320px; display: inline-block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: bottom; }
  .seg { display: inline-flex; background: #E6EBE8; border-radius: 10px; padding: 3px; gap: 2px; width: max-content; }
  .seg button { all: unset; cursor: pointer; padding: 5px 12px; border-radius: 8px; font-weight: 600; font-size: 13px; color: var(--muted); }
  .seg button.on { background: #fff; color: var(--ink); box-shadow: 0 1px 3px rgba(0,0,0,.12); }
  .diff { font: 12.5px/1.7 var(--mono); background: #F8FAF8; border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; max-height: 50vh; overflow: auto; display: flex; flex-direction: column; gap: 2px; }
  .dp { color: var(--muted); margin-top: 6px; } .dp:first-child { margin-top: 0; }
  .minus { background: #FBE5E0; color: #A93A27; padding: 0 6px; border-radius: 4px; white-space: pre-wrap; word-break: break-word; }
  .plus { background: #DDF2E8; color: #1E7A63; padding: 0 6px; border-radius: 4px; white-space: pre-wrap; word-break: break-word; }
  pre { margin: 0; white-space: pre-wrap; word-break: break-word; max-height: 50vh; overflow: auto; background: #F6F8F6; padding: 10px 12px; border-radius: 10px; font: 12.5px var(--mono); }
  :global(.btn svg) { width: 14px; height: 14px; }
</style>
