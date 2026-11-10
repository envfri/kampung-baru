<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { err, dt, num } from '../lib/store.svelte';
  import { APP_VERSION, CHANGELOG, CHANGE_KIND_LABEL, REPO_URL, type ChangeKind } from '@kb/shared';

  let sys = $state<any>(null);
  let q = $state(''), only = $state<'all' | 'player'>('all'), kind = $state<ChangeKind | ''>('');
  onMount(async () => { try { sys = await api.get('/api/admin/system'); } catch (e) { err(e); } });

  const KINDS: ChangeKind[] = ['baru', 'ubah', 'perbaikan', 'keamanan'];
  const running = $derived(sys?.build?.version ?? null);
  const releases = $derived.by(() => {
    const needle = q.trim().toLowerCase();
    return CHANGELOG.map((r) => ({
      ...r,
      items: r.items.filter((i) => (only === 'all' || i.player) && (!kind || i.kind === kind) && (!needle || `${r.version} ${r.title} ${i.text}`.toLowerCase().includes(needle))),
    })).filter((r) => r.items.length > 0 || (!kind && only === 'all' && needle && `${r.version} ${r.title}`.toLowerCase().includes(needle)));
  });
  const counts = $derived(Object.fromEntries(KINDS.map((k) => [k, CHANGELOG.reduce((n, r) => n + r.items.filter((i) => i.kind === k).length, 0)])));
  function uptime(s: number) {
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    return d ? `${d} hari ${h} jam` : h ? `${h} jam ${m} menit` : `${m} menit`;
  }
  const commitUrl = (c: string) => (c && c !== 'dev' ? `${REPO_URL}/commit/${c}` : null);
</script>

<h1>Versi & changelog</h1>
<p class="muted">Versi yang sedang berjalan di server, riwayat deploy, dan semua perubahan per versi. Changelog yang sama ada di <a href={`${REPO_URL}/blob/main/CHANGELOG.md`} target="_blank" rel="noopener">CHANGELOG.md</a>; item bertanda <span class="chip pl">pemain</span> juga tampil di menu "Apa yang baru" di game.</p>

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

  <h2>Riwayat deploy</h2>
  <div class="tbl"><table>
    <thead><tr><th>Versi</th><th>Commit</th><th>Dibuild</th><th>Mulai berjalan</th></tr></thead>
    <tbody>{#each sys.deploys as d, i (d.id)}<tr>
      <td><b>v{d.version}</b>{#if i === 0} <span class="chip">sekarang</span>{/if}</td>
      <td class="mono">{#if commitUrl(d.commit)}<a href={commitUrl(d.commit)} target="_blank" rel="noopener">{d.commit}</a>{:else}{d.commit}{/if}</td>
      <td>{d.built_at ? dt(d.built_at) : '—'}</td><td>{dt(d.started_at)}</td>
    </tr>{/each}</tbody>
  </table></div>
  <details class="mig"><summary>Migrasi database ({sys.migrations.length})</summary>
    <ul>{#each sys.migrations as m}<li><span class="mono">{m.name}</span> <span class="muted">· {dt(m.applied_at)}</span></li>{/each}</ul>
  </details>
{:else}
  <p class="muted">Memuat…</p>
{/if}

<div class="row between clh">
  <h2>Changelog</h2>
  <div class="row filters">
    <input type="search" placeholder="Cari perubahan…" bind:value={q} aria-label="Cari perubahan" />
    <select bind:value={only} aria-label="Untuk siapa"><option value="all">Semua perubahan</option><option value="player">Untuk pemain saja</option></select>
    <select bind:value={kind} aria-label="Jenis perubahan"><option value="">Semua jenis</option>{#each KINDS as k}<option value={k}>{CHANGE_KIND_LABEL[k]} ({counts[k]})</option>{/each}</select>
  </div>
</div>

<div class="rels">
  {#each releases as r (r.version)}
    <article class="card rel" class:cur={r.version === running}>
      <header>
        <span class="v">v{r.version}</span>
        <div class="tt"><h3>{r.title}</h3><span class="muted small">{r.date}{#if r.version === running} · <b class="ok">terpasang di server</b>{/if}</span></div>
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
    <p class="muted">Tidak ada perubahan yang cocok.</p>
  {/each}
</div>
<p class="muted small">Total {CHANGELOG.length} versi · {num(CHANGELOG.reduce((n, r) => n + r.items.length, 0))} perubahan.</p>

<style>
  .top { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 12px; margin: 14px 0 6px; }
  .lbl { font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
  .now .ver { font-family: var(--display); font-size: 40px; font-weight: 800; line-height: 1.1; margin: 4px 0 8px; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; margin: 10px 0 0; font-size: 14px; }
  dt { color: var(--muted); font-weight: 600; } dd { margin: 0; word-break: break-word; }
  h2 { font-size: 19px; margin: 22px 0 8px; }
  .warnbox { background: var(--warn-soft); color: var(--warn); border-radius: 10px; padding: 8px 12px; font-weight: 600; margin: 12px 0 0; }
  .mig { margin-top: 10px; } .mig summary { cursor: pointer; font-weight: 600; } .mig ul { margin: 8px 0 0; padding-left: 20px; }
  .between { justify-content: space-between; align-items: flex-end; }
  .clh { margin-top: 10px; } .clh h2 { margin-bottom: 0; }
  .filters input { width: 220px; } .filters select { width: auto; }
  .rels { display: flex; flex-direction: column; gap: 12px; margin-top: 12px; }
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
  @media (max-width: 600px) { .grp { grid-template-columns: 1fr; } .filters input { width: 100%; } }
</style>
