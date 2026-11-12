<script lang="ts">
  // Email (Mailketing): kredit & angka 24 jam, kirim uji, kirim ulang yang tertunda, webhook bounce,
  // riwayat email dengan cari/filter/urut/CSV, dan daftar alamat yang tidak dikirimi (bisa diizinkan lagi).
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { A, err, toast, ask, dt, num, setQuery } from '../lib/store.svelte';
  import { type FDef, readFilters, inDates } from '../lib/filters';
  import { NOTIFY_EVENT_BY_KEY } from '@kb/shared';
  import { I } from '../lib/icons';
  import PageHead from '../components/ui/PageHead.svelte';
  import Stat from '../components/ui/Stat.svelte';
  import Section from '../components/ui/Section.svelte';
  import FilterBar from '../components/ui/FilterBar.svelte';
  import DataTable, { type Col, type TState } from '../components/ui/DataTable.svelte';
  import Ago from '../components/ui/Ago.svelte';
  import Copy from '../components/ui/Copy.svelte';

  let d = $state<any>(null), updated = $state(0);
  let to = $state(''), testBusy = $state(false), retryBusy = $state(false);
  async function load() { try { d = await api.get('/api/admin/email'); updated = Date.now(); } catch (e) { err(e); } }
  onMount(() => { to = A.me?.admin?.email ?? ''; load(); });

  const kindLabel = (k: string) => NOTIFY_EVENT_BY_KEY[k]?.label ?? (k === 'test' ? 'Uji' : k);
  const ST: Record<string, [string, string]> = { queued: ['Antre', 'warn'], sending: ['Mengirim', 'warn'], sent: ['Terkirim', ''], failed: ['Gagal', 'no'] };
  const DLV: Record<string, string> = { delivered: 'sampai', bounce: 'bounce', bounced: 'bounce', opened: 'dibuka', unsubscribe: 'berhenti langganan' };
  async function cp(t: string, msg: string) { try { await navigator.clipboard.writeText(t); toast(msg, 'info'); } catch { toast('Tidak bisa menyalin otomatis; salin manual dari kotaknya.', 'err'); } }

  async function test(e: Event) {
    e.preventDefault();
    if (testBusy) return;
    testBusy = true;
    try { await api.post('/api/admin/email/test', { to }); toast(`Email uji terkirim ke ${to}. Cek kotak masuk & folder spam.`); load(); } catch (x) { err(x); load(); }
    testBusy = false;
  }
  async function retry() {
    const n = d?.stats.queued ?? 0;
    const ok = await ask({ title: 'Kirim ulang email yang tertunda?', body: `${num(n)} email di antrean dicoba kirim sekarang, mis. setelah kredit Mailketing diisi. Tiap email memakai 1 kredit.`, tone: 'info', icon: 'refresh', confirm: 'Kirim ulang' });
    if (!ok) return;
    retryBusy = true;
    try { const r = await api.post('/api/admin/email/retry'); toast(r.requeued ? `${r.requeued} email dikirim ulang sekarang` : 'Tidak ada email yang tertunda', r.requeued ? 'ok' : 'info'); setTimeout(load, 1500); } catch (x) { err(x); }
    retryBusy = false;
  }

  /* ---------- riwayat email ---------- */
  const kinds = $derived([...new Set<string>((d?.recent ?? []).map((r: any) => r.kind))].map((k) => [k, kindLabel(k)] as [string, string]));
  const FILTERS = $derived<FDef[]>([
    { key: 'status', label: 'Status', all: 'Semua', options: Object.entries(ST).map(([k, v]) => [k, v[0]]) },
    { key: 'kind', label: 'Jenis', all: 'Semua', options: kinds },
    { key: 'when', label: 'Waktu', type: 'dates' },
  ]);
  let q = $state(A.query.q ?? '');
  let vals = $state<Record<string, any>>(readFilters([{ key: 'status' }, { key: 'kind' }, { key: 'when', type: 'dates' }] as FDef[], A.query));
  let ts = $state<TState>({ page: 0, size: 25, sort: '', dir: 'desc' });
  const rows = $derived((d?.recent ?? []).filter((r: any) => {
    const s = q.trim().toLowerCase();
    if (s && !`${r.to_addr} ${r.subject ?? ''}`.toLowerCase().includes(s)) return false;
    if (vals.status && r.status !== vals.status) return false;
    if (vals.kind && r.kind !== vals.kind) return false;
    return inDates(vals.when, r.sent_at ?? r.created_at);
  }));
  const COLS: Col[] = [
    { key: 'to_addr', label: 'Kepada', req: true, card: 'title', sort: true, snip: true, text: (r) => r.to_addr },
    { key: 'subject', label: 'Judul', sort: true, text: (r) => r.subject ?? '' },
    { key: 'kind', label: 'Jenis', sort: true, text: (r) => kindLabel(r.kind) },
    { key: 'status', label: 'Status', sort: true, snip: true, text: (r) => ST[r.status]?.[0] ?? r.status },
    { key: 'at', label: 'Waktu', sort: true, snip: true, text: (r) => r.sent_at ?? r.created_at },
    { key: 'info', label: 'Keterangan', snip: true, text: (r) => r.error ?? (r.attempts > 1 ? `${r.attempts}× coba` : '') },
    { key: 'attempts', label: 'Percobaan', num: true, off: true, sort: true, text: (r) => r.attempts },
  ];
  function quick(k: string, v: string) { vals = { status: '', kind: '', when: '', [k]: vals[k] === v ? '' : v }; setQuery({ q, ...vals }); document.getElementById('log-h')?.scrollIntoView({ behavior: 'smooth' }); }

  /* ---------- alamat yang tidak dikirimi ---------- */
  const SUP_F: FDef[] = [{ key: 'reason', label: 'Sebab', all: 'Semua', options: [['bounce', 'Bounce'], ['unsubscribe', 'Berhenti langganan']] }];
  const REASON: Record<string, [string, string]> = { bounce: ['Bounce', 'no'], unsubscribe: ['Berhenti langganan', 'warn'] };
  let sq = $state(''), svals = $state<Record<string, any>>({ reason: '' }), sts = $state<TState>({ page: 0, size: 25, sort: '', dir: 'desc' });
  let selected = $state<string[]>([]);
  let supOpen = $state(true);
  const sups = $derived((d?.suppressions ?? []).filter((x: any) => (!sq.trim() || `${x.email} ${x.detail ?? ''}`.toLowerCase().includes(sq.trim().toLowerCase())) && (!svals.reason || x.reason === svals.reason)));
  const SUP_COLS: Col[] = [
    { key: 'email', label: 'Email', req: true, card: 'title', sort: true, snip: true, text: (x) => x.email },
    { key: 'reason', label: 'Sebab', sort: true, snip: true, text: (x) => REASON[x.reason]?.[0] ?? x.reason },
    { key: 'detail', label: 'Keterangan', text: (x) => x.detail ?? '' },
    { key: 'created_at', label: 'Sejak', sort: true, snip: true, text: (x) => x.created_at },
    { key: '_act', label: '', req: true, snip: true },
  ];
  async function unsuppress(emails: string[]) {
    const one = emails.length === 1;
    const ok = await ask({
      title: one ? `Kirim lagi ke ${emails[0]}?` : `Izinkan lagi ${emails.length} alamat?`,
      body: `${one ? 'Alamat ini' : 'Alamat-alamat ini'} keluar dari daftar dan bisa menerima email lagi. Kalau alamatnya memang tidak aktif, email akan bounce lagi dan kreditnya terbuang.`,
      tone: 'info', icon: 'mail', confirm: 'Izinkan lagi',
    });
    if (!ok) return;
    let done = 0;
    for (const e of emails) { try { await api.del(`/api/admin/email/suppressions/${encodeURIComponent(e)}`); done++; } catch (x) { err(x); } }
    if (done) toast(one ? 'Alamat bisa dikirimi lagi' : `${done} alamat bisa dikirimi lagi`);
    selected = []; load();
  }
  function showSup() { supOpen = true; setTimeout(() => document.getElementById('sup')?.scrollIntoView({ behavior: 'smooth' }), 50); }
</script>

<PageHead title="Email" updated={updated} onrefresh={load}>
  <span>Kode masuk & notifikasi pemain lewat Mailketing (1 email = 1 kredit) · jenis & teks diatur di <a href="#/notifcenter">Pusat notifikasi</a></span>
</PageHead>

{#if !d}
  <div class="stats">{#each Array(4) as _}<div class="card sk"><span class="skel" style="width:40%"></span><span class="skel" style="width:70%"></span></div>{/each}</div>
  <div class="card sk tall"><span class="skel" style="width:30%"></span><span class="skel"></span><span class="skel" style="width:80%"></span></div>
{:else if !d.enabled}
  <Section title="Sambungkan Mailketing" prefKey="email:setup">
    {#snippet badge()}<span class="chip mute">Belum tersambung</span>{/snippet}
    <ol class="steps">
      <li>Aktifkan domain pengirim di Mailketing → <b>Setup Domain</b>.</li>
      <li>Buat token di Mailketing → <b>Integrasi → Email Application API</b>.</li>
      <li>Tambahkan ke <span class="mono">.env</span> di server, lalu restart:</li>
    </ol>
    <div class="pre"><pre class="mono">MAILKETING_API_TOKEN=token_dari_menu_Integrasi_Email_Application_API
MAIL_FROM=BUPI &lt;noreply@domainmu&gt;</pre><button class="btn sm" onclick={() => cp('MAILKETING_API_TOKEN=\nMAIL_FROM=BUPI <noreply@domainmu>', 'Contoh .env disalin')}>{@html I.copy}Salin</button></div>
    <p class="muted small">Sampai token diisi, kode masuk hanya muncul di log server (mode pengembangan) dan notifikasi tidak dikirim ke email.</p>
  </Section>
{:else}
  <div class="stats">
    <Stat icon="coin" value={d.credits !== undefined ? num(d.credits) : '—'} label="Sisa kredit Mailketing" tone={d.credits !== undefined && d.credits < 100 ? 'no' : 'ok'} />
    <Stat icon="check" value={num(d.stats.sent24)} label="Terkirim 24 jam" onclick={() => quick('status', 'sent')} active={vals.status === 'sent'} />
    <Stat icon="warn" value={num(d.stats.failed24)} label="Gagal 24 jam" tone={d.stats.failed24 ? 'no' : 'blue'} onclick={() => quick('status', 'failed')} active={vals.status === 'failed'} />
    <Stat icon="clock" value={num(d.stats.queued)} label="Antrean" tone={d.stats.queued ? 'warn' : 'blue'} onclick={() => quick('status', 'queued')} active={vals.status === 'queued'} />
    <Stat icon="ban" value={num(d.stats.suppressed)} label="Alamat tidak dikirimi" tone="blue" onclick={showSup} />
  </div>
  {#if d.creditsError}<p class="alert warn"><span class="ic">{@html I.warn}</span><span>Sisa kredit tidak terbaca: {d.creditsError}</span></p>{/if}
  {#if d.last && !d.last.ok}
    <p class="alert"><span class="ic">{@html I.warn}</span><span>Pengiriman terakhir gagal (<Ago t={d.last.at} />): {d.last.error}.
      {#if d.last.status === 402}Isi kredit Mailketing, lalu klik <b>Kirim ulang tertunda</b>.{:else if d.last.status === 403}Pastikan domain di MAIL_FROM sudah aktif di Mailketing → Setup Domain.{:else if d.last.status === 401}Periksa MAILKETING_API_TOKEN (token lama tidak berlaku setelah Generate Token Baru).{/if}</span></p>
  {/if}

  <div class="cols">
    <form class="card s" onsubmit={test}>
      <h2>Pengirim</h2>
      <p class="from"><span class="av">{@html I.mail}</span><span><b>{d.from.name}</b><span class="mono">{d.from.email}</span></span></p>
      <label>Kirim email uji ke<input type="email" required bind:value={to} /></label>
      <div class="row">
        <button class="btn primary" aria-busy={testBusy ? 'true' : undefined}>{@html I.send}Kirim email uji</button>
        <button type="button" class="btn" disabled={!d.stats.queued} aria-busy={retryBusy ? 'true' : undefined} onclick={retry}>{@html I.refresh}Kirim ulang tertunda{#if d.stats.queued} ({num(d.stats.queued)}){/if}</button>
      </div>
    </form>
    <Section title="Webhook bounce" prefKey="email:hook">
      {#snippet badge()}<span class="chip no">rahasia</span>{/snippet}
      <p class="small">Tempel di Mailketing → Integrasi → WebHook, kolom <b>Bounce Webhook</b> dan <b>Unsubscribe Webhook</b>. Alamat yang bounce otomatis tidak dikirimi lagi supaya kredit tidak terbuang.</p>
      <div class="cp"><input class="mono" readonly value={d.webhookUrl} aria-label="URL webhook" onfocus={(e) => (e.target as HTMLInputElement).select()} /><button class="btn" onclick={() => cp(d.webhookUrl, 'URL webhook disalin')}>{@html I.copy}Salin</button></div>
      <p class="muted small">URL ini memuat kunci rahasia; jangan dibagikan.</p>
    </Section>
  </div>

  <h2 class="hh" id="log-h">Email terakhir <small class="muted">50 terbaru</small></h2>
  <FilterBar bind:q bind:values={vals} filters={FILTERS} placeholder="Cari alamat penerima atau judul" count={rows.length} />
  <DataTable cols={COLS} {rows} bind:state={ts} prefKey="email-log" csv="local" csvName="email"
    empty={d.recent.length ? 'Tidak ada email yang cocok' : 'Belum ada email'} emptyIcon="mail"
    emptyText={d.recent.length ? 'Coba ubah kata kunci atau hapus filter.' : 'Kirim email uji untuk mengecek sambungan.'}
    rowClass={(r) => (r.status === 'failed' ? 'fail' : '')}>
    {#snippet cell(r, k)}
      {#if k === 'to_addr'}<span class="to"><span class="mono">{r.to_addr}</span><Copy text={r.to_addr} label="Alamat disalin" /></span>
      {:else if k === 'status'}<span class="chip {ST[r.status]?.[1] ?? 'mute'}">{ST[r.status]?.[0] ?? r.status}</span>{#if r.delivery} <small class="muted">{DLV[r.delivery] ?? r.delivery}</small>{/if}
      {:else if k === 'at'}<Ago t={r.sent_at ?? r.created_at} />
      {:else if k === 'info'}
        {#if r.error}<span class="er">{r.error}</span>{:else if r.attempts > 1}<span class="muted">{r.attempts}× coba</span>{:else}<span class="muted">—</span>{/if}
      {/if}
    {/snippet}
  </DataTable>

  <Section title="Alamat yang tidak dikirimi" id="sup" prefKey="email:sup" bind:open={supOpen}
    sub="Alamat yang bounce atau berhenti langganan dilewati supaya kredit tidak terbuang. Izinkan lagi bila pemain sudah memperbaiki alamatnya.">
    {#snippet badge()}<span class="chip {d.suppressions.length ? 'warn' : 'mute'}">{num(d.suppressions.length)}</span>{/snippet}
    <FilterBar bind:q={sq} bind:values={svals} filters={SUP_F} sync={false} placeholder="Cari alamat" count={sups.length} />
    <DataTable cols={SUP_COLS} rows={sups} bind:state={sts} idKey="email" selectable bind:selected prefKey="email-sup" csv="local" csvName="email-diblokir"
      empty={d.suppressions.length ? 'Tidak ada alamat yang cocok' : 'Belum ada alamat yang diblokir'} emptyIcon="check"
      emptyText={d.suppressions.length ? '' : 'Semua alamat pemain masih bisa dikirimi.'}>
      {#snippet cell(x, k)}
        {#if k === 'email'}<span class="to"><span class="mono">{x.email}</span><Copy text={x.email} label="Alamat disalin" /></span>
        {:else if k === 'reason'}<span class="chip {REASON[x.reason]?.[1] ?? 'mute'}">{REASON[x.reason]?.[0] ?? x.reason}</span>
        {:else if k === 'created_at'}<Ago t={x.created_at} />
        {:else if k === '_act'}<button class="btn sm" onclick={() => unsuppress([x.email])}>{@html I.undo}Izinkan lagi</button>
        {/if}
      {/snippet}
      {#snippet bulk(ids)}<button class="btn sm" onclick={() => unsuppress([...ids])}>{@html I.undo}Izinkan lagi</button>{/snippet}
    </DataTable>
  </Section>
{/if}

<style>
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; }
  .sk { display: flex; flex-direction: column; gap: 10px; padding: 16px; }
  .sk.tall { min-height: 160px; }
  .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr)); gap: 12px; align-items: start; }
  .s { display: flex; flex-direction: column; gap: 12px; }
  .s h2 { font-size: 18px; }
  .from { margin: 0; display: flex; gap: 10px; align-items: center; }
  .from .av { width: 36px; height: 36px; border-radius: 10px; background: var(--accent-soft); color: var(--accent); display: grid; place-items: center; padding: 9px; flex: none; }
  .from .av :global(svg) { width: 100%; height: 100%; }
  .from > span:last-child { display: flex; flex-direction: column; min-width: 0; overflow-wrap: anywhere; }
  .small { font-size: 13px; margin: 0; }
  .cp { display: flex; gap: 8px; }
  .cp input { flex: 1; min-width: 0; font-size: 12.5px; }
  .alert { margin: 0; display: flex; gap: 8px; align-items: flex-start; background: var(--danger-soft); color: var(--danger); border-radius: 10px; padding: 9px 12px; font-weight: 600; font-size: 13.5px; }
  .alert.warn { background: var(--warn-soft); color: var(--warn); }
  .alert .ic { width: 17px; height: 17px; margin-top: 1px; }
  .hh { font-size: 19px; display: flex; align-items: baseline; gap: 8px; scroll-margin-top: 16px; }
  .hh small { font: 500 13px var(--body); }
  .to { display: inline-flex; align-items: center; gap: 6px; min-width: 0; overflow-wrap: anywhere; }
  .er { color: var(--danger); font-size: 13px; }
  @media (min-width: 761px) { :global(tr.fail td:first-child) { box-shadow: inset 3px 0 0 var(--danger); } }
  .steps { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px; font-size: 14px; }
  .pre { display: flex; gap: 8px; align-items: flex-start; }
  pre { flex: 1; margin: 0; background: #F3F5F3; border-radius: 10px; padding: 10px 12px; white-space: pre-wrap; overflow-wrap: anywhere; }
  .btn :global(svg) { width: 15px; height: 15px; }
  @media (max-width: 760px) {
    .stats { display: flex; overflow-x: auto; scrollbar-width: none; margin: 0 -14px; padding: 0 14px; }
    .stats > :global(.stat) { flex: none; min-width: 150px; }
    .pre { flex-direction: column; }
  }
</style>
