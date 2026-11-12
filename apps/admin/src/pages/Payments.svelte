<script lang="ts">
  import { onMount } from 'svelte';
  import { api, qs, downloadCsv } from '../lib/api';
  import { A, can, err, toast, ask, rp, rpShort, num, dt, ago, setQuery } from '../lib/store.svelte';
  import { CLOCK } from '../lib/clock.svelte';
  import { type FDef, readFilters, filterParams } from '../lib/filters';
  import { I } from '../lib/icons';
  import PageHead from '../components/ui/PageHead.svelte';
  import FilterBar from '../components/ui/FilterBar.svelte';
  import DataTable, { type Col, type TState } from '../components/ui/DataTable.svelte';
  import Stat from '../components/ui/Stat.svelte';
  import Section from '../components/ui/Section.svelte';
  import Bar from '../components/ui/Bar.svelte';
  import Copy from '../components/ui/Copy.svelte';
  import Ago from '../components/ui/Ago.svelte';
  import Drawer from '../components/Drawer.svelte';

  let packages = $state<any[]>([]);
  const FILTERS = $derived<FDef[]>([
    { key: 'status', label: 'Status', type: 'many', options: [['pending', 'Menunggu'], ['paid', 'Lunas'], ['failed', 'Gagal'], ['expired', 'Kedaluwarsa']] },
    { key: 'at', label: 'Waktu', type: 'dates' },
    { key: 'pkg', label: 'Paket', type: 'many', options: packages.map((p) => [p.id, `${p.name} · ${p.pearls}`] as [string, string]) },
    { key: 'mode', label: 'Mode', all: 'Live & uji', options: [['live', 'Live'], ['test', 'Uji']] },
  ]);
  const BASEF: FDef[] = [{ key: 'status', label: '', type: 'many' }, { key: 'at', label: '', type: 'dates' }, { key: 'pkg', label: '', type: 'many' }, { key: 'mode', label: '' }];
  let q = $state(A.query.q ?? '');
  let vals = $state<Record<string, any>>(readFilters(BASEF, A.query));
  let ts = $state<TState>({ page: 0, size: 25, sort: A.query.sort || 'created', dir: A.query.dir === 'asc' ? 'asc' : 'desc' });
  let rows = $state<any[]>([]), total = $state(0), amount = $state(0), sum = $state<any>(null), loading = $state(true), updated = $state(0);
  let z = $state<any>(null), zBusy = $state(false), rowBusy = $state<string | null>(null);
  const isZepay = $derived(A.me?.paymentProvider === 'zepay');

  const params = () => ({ q, ...filterParams(FILTERS, vals), page: ts.page, size: ts.size, sort: ts.sort, dir: ts.dir });
  async function load(quiet = false) {
    if (!quiet) loading = true;
    try {
      const r = await (quiet ? api.quiet : api.get)('/api/admin/payments' + qs(params()));
      rows = r.payments; total = r.total; amount = r.amount; sum = r.summary; packages = r.packages; updated = Date.now();
      if (sel) sel = rows.find((x) => x.id === sel!.id) ?? sel;
    } catch (e) { if (!quiet) err(e); }
    loading = false;
  }
  async function loadZ() { try { z = await api.get('/api/admin/zepay'); } catch (e) { err(e); } }
  onMount(() => {
    load(); if (isZepay) loadZ();
    // pembayaran menunggu diperbarui sendiri tiap 20 detik
    const t = setInterval(() => { if (!document.hidden && rows.some((r) => r.status === 'pending')) load(true); }, 20_000);
    return () => clearInterval(t);
  });
  function onFilter() { ts.page = 0; load(); }
  function quick(k: string, v: any) { for (const f of BASEF) vals[f.key] = f.type === 'many' ? [] : ''; vals[k] = v; if (k === 'status' && v[0] === 'failed') vals.at = 'today'; setQuery({ q, ...vals }); onFilter(); }

  const STATUS: Record<string, [string, string]> = { pending: ['warn', 'Menunggu'], paid: ['', 'Lunas'], failed: ['no', 'Gagal'], expired: ['mute', 'Kedaluwarsa'] };
  const RES: Record<string, string> = { paid: 'Lunas, Mutiara dikirim', failed: 'Gagal/dibatalkan', expired: 'Kedaluwarsa', pending: 'Masih menunggu pembayaran', ignored: 'Diabaikan (nominal/mode tidak cocok)' };
  const pkgName = (id: string) => packages.find((p) => p.id === id)?.name ?? id;
  const left = (p: any) => (p.expires_at ? new Date(p.expires_at).getTime() - CLOCK.now : 0);
  const mmss = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const live = (p: any) => p.status === 'pending' && left(p) > 0;

  const COLS: Col[] = [
    { key: 'created', label: 'Waktu', sort: 'created', snip: true, text: (p) => p.created_at, card: 'title' },
    { key: 'player', label: 'Pemain', snip: true, text: (p) => p.display_name },
    { key: 'pkg', label: 'Paket', text: (p) => `${pkgName(p.package_id)} · ${p.pearls}`, html: (p) => `${pkgName(p.package_id)} <span class="muted">· ${p.pearls} Mutiara</span>` },
    { key: 'amount', label: 'Nominal', num: true, sort: 'amount', text: (p) => p.amount_idr, html: (p) => `<b>${rp(p.amount_idr)}</b>` },
    { key: 'status', label: 'Status', sort: 'status', snip: true, text: (p) => STATUS[p.status]?.[1] ?? p.status },
    { key: 'invoice', label: 'Invoice', snip: true, text: (p) => p.invoice ?? '' },
    { key: 'paid', label: 'Dibayar', sort: 'paid', off: true, text: (p) => p.paid_at, html: (p) => (p.paid_at ? dt(p.paid_at) : '—') },
    { key: 'provider', label: 'Penyedia', off: true, text: (p) => p.provider },
    { key: '_act', label: '', snip: true, req: true },
  ];

  async function markPaid(p: any) {
    const r = await ask({ title: `Tandai lunas ${rp(p.amount_idr)}?`, body: `${p.pearls} Mutiara langsung masuk ke dompet ${p.display_name}. Pakai hanya bila ada bukti pembayaran (mis. mutasi rekening).`,
      tone: 'danger', icon: 'card', diff: [{ label: 'Status', before: STATUS[p.status]?.[1] ?? p.status, after: 'Lunas' }, { label: `Mutiara ${p.display_name}`, before: '—', after: `+${p.pearls}` }],
      fields: [{ key: 'reason', label: 'Alasan / bukti', placeholder: 'mis. transfer manual BCA 12/11 14:05', min: 3 }], typeToConfirm: 'LUNAS', confirm: 'Tandai lunas' });
    if (!r) return;
    rowBusy = p.id;
    try { const x = await api.post(`/api/admin/payments/${p.id}/mark-paid`, { reason: r.reason }); toast(x.credited ? 'Ditandai lunas, Mutiara dikirim' : 'Sudah lunas sebelumnya'); load(); } catch (e) { err(e); }
    rowBusy = null;
  }
  async function sync(p: any) {
    rowBusy = p.id;
    try { const r = await api.post(`/api/admin/payments/${p.id}/sync`); toast('Status ZePay: ' + (RES[r.result] ?? r.result), r.result === 'paid' ? 'ok' : 'info'); load(); } catch (e) { err(e); }
    rowBusy = null;
  }
  async function simulate(p: any) {
    if (!(await ask({ title: 'Simulasikan pembayaran lunas?', body: 'Hanya untuk kunci uji ZePay: webhook palsu dikirim dan Mutiara uji masuk ke pemain (ditandai "uji").', tone: 'warn', icon: 'play', confirm: 'Simulasi lunas' }))) return;
    rowBusy = p.id;
    try { const r = await api.post(`/api/admin/payments/${p.id}/simulate`, { status: 'SUCCESS' }); toast('Simulasi: ' + (RES[r.result] ?? r.result)); load(); } catch (e) { err(e); }
    rowBusy = null;
  }
  async function registerHook() {
    if (ourHook && !(await ask({ title: 'Daftarkan ulang webhook?', body: 'Secret webhook lama diganti yang baru. Event yang sedang dikirim ZePay dengan secret lama akan ditolak.', tone: 'warn', icon: 'refresh', confirm: 'Daftarkan ulang' }))) return;
    zBusy = true;
    try {
      const r = await api.post('/api/admin/zepay/webhook');
      toast(r.rotated ? 'Webhook sudah ada; secret dirotasi dan disimpan. Event uji dikirim.' : 'Webhook terdaftar dan secret disimpan. Event uji dikirim.');
      setTimeout(loadZ, 2500); loadZ();
    } catch (e) { err(e); }
    zBusy = false;
  }
  async function testHook() {
    zBusy = true;
    try { await api.post('/api/admin/zepay/test'); toast('Event uji dikirim. Status diperbarui beberapa detik lagi.', 'info'); setTimeout(loadZ, 2500); } catch (e) { err(e); }
    zBusy = false;
  }
  const ourHook = $derived(z?.endpoints?.find((e: any) => e.ours));
  const zOk = $derived(!!z?.configured && !z?.error && !!ourHook && ourHook.status === 'enabled');
  let sel = $state<any>(null);
  const steps = (p: any) => {
    const out: { t: string; at?: string | null; on: boolean; tone?: string }[] = [{ t: 'Dibuat', at: p.created_at, on: true }];
    if (p.provider === 'zepay') out.push({ t: p.expires_at ? `QR berlaku sampai ${dt(p.expires_at)}` : 'QR dibuat', on: true });
    if (p.status === 'paid') { out.push({ t: 'Dibayar', at: p.paid_at, on: true }); out.push({ t: p.revoked_at ? 'Mutiara ditarik (reset peluncuran)' : `${p.pearls} Mutiara terkirim`, on: true, tone: p.revoked_at ? 'mute' : 'ok' }); }
    else if (p.status === 'pending') out.push({ t: live(p) ? 'Menunggu pemain membayar' : 'QR sudah habis, menunggu status akhir', on: false, tone: 'warn' });
    else out.push({ t: p.status === 'failed' ? 'Gagal / dibatalkan' : 'Kedaluwarsa tanpa pembayaran', on: true, tone: p.status === 'failed' ? 'no' : 'mute' });
    return out;
  };
</script>

<PageHead title="Pembayaran" {updated} onrefresh={() => { load(); if (isZepay) loadZ(); }}>
  Penyedia: <b>{A.me?.paymentProvider}</b>{#if z?.mode} · <span class="chip {z.mode === 'test' ? 'warn' : ''}">{z.mode === 'test' ? 'mode uji' : 'live'}</span>{/if}
  {#snippet actions()}<button class="btn" onclick={() => downloadCsv('/api/admin/export/payments.csv' + qs({ q, ...filterParams(FILTERS, vals) }))}>{@html I.download}Ekspor CSV</button>{/snippet}
</PageHead>

<div class="stats">
  <Stat icon="check" value={sum ? rpShort(sum.paid_today) : '…'} label="Lunas hari ini · {sum?.paid_today_n ?? 0} transaksi" onclick={() => quick('at', 'today')} active={vals.at === 'today' && !vals.status.length} />
  <Stat icon="clock" value={sum ? num(sum.pending) : '…'} label="Menunggu dibayar" tone="warn" onclick={() => quick('status', ['pending'])} active={vals.status.length === 1 && vals.status[0] === 'pending'} />
  <Stat icon="warn" value={sum ? num(sum.failed_today) : '…'} label="Gagal hari ini" tone="no" onclick={() => quick('status', ['failed'])} active={vals.status.length === 1 && vals.status[0] === 'failed'} />
  <Stat icon="coin" value={sum ? rpShort(sum.paid_30) : '…'} label="Pendapatan 30 hari" tone="blue" />
</div>

{#if isZepay}
  <Section title="QRIS · ZePay" prefKey="pay-zepay" open={!zOk}>
    {#snippet badge()}{#if !z}<span class="chip mute">memuat…</span>{:else if zOk}<span class="chip">Tersambung</span>{:else}<span class="chip no">Perlu dicek</span>{/if}{/snippet}
    {#if !z}<p class="muted">Memuat status ZePay…</p>
    {:else if !z.configured}
      <p>Kunci API ZePay belum diisi di server. Minta kunci ke tim ZePay lalu pasang di konfigurasi server (lihat panduan deploy), kemudian jalankan ulang server.</p>
    {:else}
      {#if z.error}<p class="bad">Tidak bisa terhubung ke ZePay: {z.error}</p>{/if}
      <dl class="kv">
        <dt>Merchant</dt><dd><b>{z.merchant?.name ?? '—'}</b>{#if z.merchant?.status && z.merchant.status !== 'active'}<span class="chip no">{z.merchant.status}</span>{/if}</dd>
        <dt>Kanal QRIS</dt><dd>{#if z.merchant?.qris?.enabled && z.merchant.qris.channel}{@const c = z.merchant.qris.channel}Aktif · biaya ±{c.fee_percent}%{c.fee_fixed ? ` + ${rp(c.fee_fixed)}` : ''} ({c.fee_paid_by === 'customer' ? 'dibayar pemain' : 'ditanggung merchant'}) · {rp(c.min_amount)}–{rp(c.max_amount)}{:else if z.merchant}<span class="bad">QRIS belum aktif untuk merchant ini. Hubungi tim ZePay.</span>{:else}—{/if}</dd>
        <dt>Masa berlaku QR</dt><dd>{z.expiresMinutes} menit</dd>
        <dt>Event webhook terakhir</dt><dd>{#if z.lastEvent}{z.lastEvent.type} · <Ago t={z.lastEvent.at} />{:else}<span class="muted">Belum pernah diterima</span>{/if}</dd>
        <dt>Webhook</dt><dd><span class="mono">{z.webhookUrl}</span><Copy text={z.webhookUrl} label="URL webhook disalin" /></dd>
        <dt>Status webhook</dt><dd>
          {#if ourHook}<span class="chip {ourHook.status === 'enabled' ? '' : 'no'}">{ourHook.status === 'enabled' ? 'aktif' : 'nonaktif'}</span> secret …{ourHook.secret_last4}
            {#if z.secretSource === 'db'}<span class="muted">(tersimpan di database)</span>{:else if z.secretSource === 'env'}<span class="muted">(dari konfigurasi server)</span>{:else}<span class="bad">secret belum tersimpan, klik Daftarkan ulang</span>{/if}
          {:else if z.endpointsError}<span class="bad">Daftar webhook tidak bisa dibaca: {z.endpointsError}</span>
          {:else}<span class="bad">Belum terdaftar. Tanpa webhook, pembayaran yang selesai setelah aplikasi ditutup baru masuk setelah QR kedaluwarsa.</span>{/if}
        </dd>
      </dl>
      {#if !z.webhookUrl.startsWith('https://')}<p class="bad">Alamat publik server harus https:// supaya webhook bisa didaftarkan.</p>{/if}
      <div class="row">
        {#if can('owner')}<button class="btn primary" disabled={!z.webhookUrl.startsWith('https://')} aria-busy={zBusy ? 'true' : undefined} onclick={registerHook}>{ourHook ? 'Daftarkan ulang (rotasi secret)' : 'Daftarkan webhook'}</button>{/if}
        {#if ourHook}<button class="btn" disabled={zBusy} onclick={testHook}>{@html I.send}Kirim event uji</button>{/if}
        <button class="btn" disabled={zBusy} onclick={loadZ}>{@html I.refresh}Muat ulang status</button>
      </div>
    {/if}
  </Section>
{:else if A.me?.paymentProvider === 'mock'}
  <p class="info">{@html I.info}<span>Pembayaran masih <b>simulasi</b>. Pasang penyedia ZePay di konfigurasi server untuk menerima QRIS sungguhan.</span></p>
{:else if A.me?.paymentProvider === 'midtrans'}
  <p class="info">{@html I.info}<span>Status diperbarui dari notifikasi Midtrans. URL notifikasi: <span class="mono">{location.origin}/api/payments/midtrans/notify</span> <Copy text="{location.origin}/api/payments/midtrans/notify" /></span></p>
{/if}

<FilterBar bind:q bind:values={vals} filters={FILTERS} placeholder="Cari pemain, invoice, atau ref" onchange={onFilter} count={total} keep={{ sort: ts.sort === 'created' ? '' : ts.sort, dir: ts.dir === 'desc' ? '' : ts.dir }} />

<DataTable cols={COLS} {rows} {total} bind:state={ts} onstate={() => { setQuery({ q, ...vals, sort: ts.sort === 'created' ? '' : ts.sort, dir: ts.dir === 'desc' ? '' : ts.dir }); load(); }} {loading} prefKey="payments"
  onrow={(p) => (sel = p)} empty="Belum ada pembayaran yang cocok" emptyIcon="card" rowClass={(p) => (live(p) ? 'pend' : '')}>
  {#snippet toolbar()}<span class="muted">{num(total)} pembayaran{#if amount}{` · lunas ${rp(amount)}`}{/if}</span>{/snippet}
  {#snippet cell(p, k)}
    {#if k === 'created'}<span class="tm"><Ago t={p.created_at} /><small class="muted">{dt(p.created_at)}</small></span>
    {:else if k === 'player'}<a href="#/players/{p.user_id}">{p.display_name}</a>
    {:else if k === 'status'}
      <span class="st"><span class="chip {STATUS[p.status]?.[0] ?? ''}">{STATUS[p.status]?.[1] ?? p.status}</span>{#if p.test}<span class="chip warn" title="Pembayaran uji">uji</span>{/if}{#if p.revoked_at}<span class="chip mute" title="Mutiara sudah ditarik">ditarik</span>{/if}</span>
      {#if live(p)}<span class="cd"><small>QR {mmss(left(p))} lagi</small><Bar value={left(p)} max={Math.max(1, new Date(p.expires_at).getTime() - new Date(p.created_at).getTime())} tone="warn" h={4} label="Sisa waktu QR" /></span>{/if}
    {:else if k === 'invoice'}{#if p.invoice}<span class="mono">{p.invoice}</span> <Copy text={p.invoice} label="Invoice disalin" />{:else}<span class="muted">—</span>{/if}
    {:else if k === '_act'}
      <span class="acts">
        {#if p.provider === 'zepay' && p.provider_ref && p.status !== 'paid'}
          <button class="btn sm" aria-busy={rowBusy === p.id ? 'true' : undefined} onclick={() => sync(p)}>{@html I.refresh}Cek status</button>
          {#if z?.mode === 'test' && can('owner')}<button class="btn sm" disabled={rowBusy === p.id} onclick={() => simulate(p)}>Simulasi lunas</button>{/if}
        {/if}
        {#if can('owner') && p.status !== 'paid'}<button class="btn sm" disabled={rowBusy === p.id} onclick={() => markPaid(p)}>Tandai lunas…</button>{/if}
      </span>
    {/if}
  {/snippet}
</DataTable>

{#if sel}
  <Drawer title="Pembayaran {rp(sel.amount_idr)}" onclose={() => (sel = null)}>
    {#snippet head()}
      <div class="dh"><h2>{rp(sel.amount_idr)} <span class="chip {STATUS[sel.status]?.[0] ?? ''}">{STATUS[sel.status]?.[1]}</span>{#if sel.test}<span class="chip warn">uji</span>{/if}</h2>
        <p>{pkgName(sel.package_id)} · {sel.pearls} Mutiara · <a href="#/players/{sel.user_id}">{sel.display_name}</a></p></div>
    {/snippet}
    <ol class="tl">
      {#each steps(sel) as st}<li class={st.tone ?? ''} class:on={st.on}><i></i><span><b>{st.t}</b>{#if st.at}<small>{dt(st.at)} · {ago(st.at, CLOCK.now)}</small>{/if}</span></li>{/each}
    </ol>
    {#if live(sel)}<div class="cdb"><span>QR berlaku <b>{mmss(left(sel))}</b> lagi</span><Bar value={left(sel)} max={Math.max(1, new Date(sel.expires_at).getTime() - new Date(sel.created_at).getTime())} tone="warn" h={8} label="Sisa waktu QR" /></div>{/if}
    <dl class="kv">
      <dt>ID</dt><dd class="mono">{sel.id}<Copy text={sel.id} /></dd>
      <dt>Invoice</dt><dd>{#if sel.invoice}<span class="mono">{sel.invoice}</span><Copy text={sel.invoice} />{:else}—{/if}</dd>
      <dt>Ref penyedia</dt><dd>{#if sel.provider_ref}<span class="mono">{sel.provider_ref}</span><Copy text={sel.provider_ref} />{:else}—{/if}</dd>
      <dt>Penyedia</dt><dd>{sel.provider}</dd>
      {#if sel.synced_at}<dt>Terakhir dicek</dt><dd><Ago t={sel.synced_at} /></dd>{/if}
    </dl>
    {#snippet footer()}
      {#if sel.provider === 'zepay' && sel.provider_ref && sel.status !== 'paid'}<button class="btn" aria-busy={rowBusy === sel.id ? 'true' : undefined} onclick={() => sync(sel)}>{@html I.refresh}Cek status</button>{/if}
      {#if can('owner') && sel.status !== 'paid'}<button class="btn primary" onclick={() => markPaid(sel)}>Tandai lunas…</button>{/if}
      <button class="btn" onclick={() => (sel = null)}>Tutup</button>
    {/snippet}
  </Drawer>
{/if}

<style>
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; }
  .bad { color: var(--danger); margin: 0; }
  .info { margin: 0; display: flex; gap: 8px; align-items: flex-start; background: var(--info-soft); color: var(--info); border-radius: 12px; padding: 10px 12px; font-size: 13.5px; }
  .info :global(svg) { width: 16px; height: 16px; flex: none; margin-top: 2px; }
  .tm { display: flex; flex-direction: column; } .tm small { font-size: 11.5px; }
  .st { display: inline-flex; gap: 4px; flex-wrap: wrap; }
  .cd { display: flex; flex-direction: column; gap: 2px; margin-top: 4px; min-width: 90px; } .cd small { color: var(--warn); font-weight: 700; font-size: 11.5px; }
  .acts { display: inline-flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
  :global(tr.pend td) { background: #FFFCF2; }
  .dh h2 { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-size: 24px; }
  .dh p { margin: 4px 0 0; color: var(--muted); }
  .tl { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .tl li { display: flex; gap: 12px; position: relative; padding-bottom: 14px; }
  .tl li:not(:last-child)::before { content: ''; position: absolute; left: 7px; top: 18px; bottom: 0; width: 2px; background: var(--line); }
  .tl i { width: 16px; height: 16px; border-radius: 50%; border: 2.5px solid #C5CDC8; background: #fff; flex: none; margin-top: 2px; }
  .tl li.on i { border-color: var(--accent); background: var(--accent); }
  .tl li.warn i { border-color: #E3A21A; background: #fff; animation: blink 1.4s infinite; }
  .tl li.no i { border-color: var(--danger); background: var(--danger); } .tl li.mute i { border-color: #9AA49F; background: #9AA49F; }
  @keyframes blink { 50% { box-shadow: 0 0 0 4px #F6E3B5; } }
  .tl span { display: flex; flex-direction: column; } .tl small { color: var(--muted); font-size: 12.5px; }
  .cdb { display: flex; flex-direction: column; gap: 6px; background: var(--warn-soft); border-radius: 12px; padding: 10px 12px; color: var(--warn); font-size: 13.5px; }
  :global(.btn svg) { width: 14px; height: 14px; }
</style>
