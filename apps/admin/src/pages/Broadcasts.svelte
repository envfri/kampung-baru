<script lang="ts">
  // Broadcast: kirim notifikasi ke banyak pemain (push + kotak masuk, opsional email & WhatsApp) dengan pratinjau langsung,
  // ringkasan sebelum kirim (ketik KIRIM bila ke semua pemain sekarang), dan riwayat dengan cari/filter/urut/CSV + bar jangkauan.
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { A, err, toast, ask, dt, num, toLocal, fromLocal, setQuery } from '../lib/store.svelte';
  import { type FDef, readFilters, inDates } from '../lib/filters';
  import { I } from '../lib/icons';
  import PageHead from '../components/ui/PageHead.svelte';
  import Stat from '../components/ui/Stat.svelte';
  import FilterBar from '../components/ui/FilterBar.svelte';
  import DataTable, { type Col, type TState } from '../components/ui/DataTable.svelte';
  import Switch from '../components/ui/Switch.svelte';
  import Bar from '../components/ui/Bar.svelte';
  import Ago from '../components/ui/Ago.svelte';

  const SEG: [string, string][] = [['all', 'Semua pemain'], ['active7', 'Aktif 7 hari terakhir'], ['inactive7', 'Tidak aktif lebih dari 7 hari'], ['payers', 'Pernah membeli Mutiara'], ['guests', 'Masih tamu (belum simpan progres)']];
  const URLS: [string, string][] = [['/', 'Rumah'], ['/#map', 'Peta Kampung'], ['/#shop', 'Toko'], ['/#friends', 'Teman'], ['/#daily', 'Hadiah harian'], ['/#news', 'Kabar kampung'], ['/#pearls', 'Toko Mutiara']];
  const ST: Record<string, [string, string]> = { scheduled: ['Terjadwal', 'blue'], sending: ['Mengirim', 'warn'], sent: ['Terkirim', ''], cancelled: ['Dibatalkan', 'mute'] };
  const segLabel = (k: string) => SEG.find((s) => s[0] === k)?.[1] ?? k;

  let data = $state<any>(null), loading = $state(true), updated = $state(0);
  const blank = () => ({ title: '', body: '', url: '/', segment: 'all', sendAt: '', email: false, whatsapp: false });
  let f = $state(blank());
  let later = $state(false);
  let busy = $state(false), tried = $state(false);

  async function load(quiet = false) {
    if (!quiet) loading = true;
    try { data = await (quiet ? api.quiet('/api/admin/broadcasts') : api.get('/api/admin/broadcasts')); updated = Date.now(); } catch (e) { if (!quiet) err(e); }
    loading = false;
  }
  onMount(() => load());
  // selama ada yang sedang dikirim / segera jalan, perbarui diam-diam tiap 5 detik
  $effect(() => {
    const soon = (data?.broadcasts ?? []).some((b: any) => b.status === 'sending' || (b.status === 'scheduled' && Math.abs(new Date(b.send_at).getTime() - Date.now()) < 10 * 60_000));
    if (!soon) return;
    const t = setTimeout(() => load(true), 5000);
    return () => clearTimeout(t);
  });

  /* ---------- form ---------- */
  const at = $derived(later && f.sendAt ? new Date(f.sendAt) : null);
  const past = $derived(!!at && at.getTime() < Date.now() - 60_000);
  const problems = $derived([
    f.title.trim().length < 2 && 'Judul minimal 2 karakter',
    f.body.trim().length < 2 && 'Isi minimal 2 karakter',
    later && !f.sendAt && 'Pilih waktu kirim',
  ].filter(Boolean) as string[]);
  function quickTime(kind: '1h' | 'pagi' | 'malam') {
    const d = new Date();
    if (kind === '1h') d.setTime(Date.now() + 3600_000);
    else { d.setDate(d.getDate() + 1); d.setHours(kind === 'pagi' ? 9 : 19, 0, 0, 0); }
    f.sendAt = toLocal(d.toISOString());
  }
  const channels = $derived(['Push & kotak masuk', f.email && 'Email', f.whatsapp && 'WhatsApp'].filter(Boolean) as string[]);

  async function send(e: Event) {
    e.preventDefault();
    tried = true;
    if (problems.length || busy) return;
    const now = !later;
    const everyone = f.segment === 'all' && now;
    const cost = [
      f.email && data?.stats.emailEnabled && `email maks. ±${num(data.stats.emailUsers)} kredit Mailketing`,
      f.whatsapp && data?.stats.waEnabled && `WhatsApp maks. ±${num(data.stats.waUsers)} pesan (kuota Klik Flow)`,
    ].filter(Boolean);
    const ok = await ask({
      title: now ? 'Kirim broadcast sekarang?' : 'Jadwalkan broadcast?',
      body: `“${f.title.trim()}” ${now ? 'dikirim sekarang' : `dikirim ${dt(fromLocal(f.sendAt))}`} ke ${segLabel(f.segment).toLowerCase()} lewat ${channels.join(', ').toLowerCase()}. Setelah terkirim tidak bisa ditarik.`,
      tone: everyone ? 'warn' : 'info', icon: 'send',
      note: cost.length ? `Biaya: ${cost.join('; ')}.` : everyone ? 'Semua pemain menerima notifikasi ini.' : undefined,
      typeToConfirm: everyone ? 'KIRIM' : undefined,
      confirm: now ? 'Kirim sekarang' : 'Jadwalkan',
    });
    if (!ok) return;
    busy = true;
    try {
      await api.post('/api/admin/broadcasts', { ...f, title: f.title.trim(), body: f.body.trim(), sendAt: later ? fromLocal(f.sendAt) : null });
      toast(later ? 'Broadcast dijadwalkan' : 'Broadcast sedang dikirim');
      f = blank(); later = false; tried = false; load();
    } catch (x) { err(x); } finally { busy = false; }
  }
  function reuse(b: any) {
    f = { title: b.title, body: b.body, url: b.url ?? '/', segment: b.segment, sendAt: '', email: !!b.email && !!data?.stats.emailEnabled, whatsapp: !!b.whatsapp && !!data?.stats.waEnabled };
    later = false;
    document.getElementById('bc-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast('Isi broadcast disalin ke form. Periksa lalu kirim.', 'info');
  }
  async function cancel(b: any) {
    const ok = await ask({ title: 'Batalkan broadcast terjadwal?', body: `“${b.title}” tidak jadi dikirim ${dt(b.send_at)}. Kamu bisa membuatnya lagi kapan saja.`, tone: 'warn', icon: 'x', confirm: 'Batalkan broadcast', cancel: 'Kembali' });
    if (!ok) return;
    try { await api.del(`/api/admin/broadcasts/${b.id}`); toast('Broadcast dibatalkan'); load(); } catch (e) { err(e); }
  }

  /* ---------- riwayat ---------- */
  const FILTERS: FDef[] = [
    { key: 'status', label: 'Status', all: 'Semua', options: Object.entries(ST).map(([k, v]) => [k, v[0]]) },
    { key: 'segment', label: 'Penerima', all: 'Semua', options: SEG },
    { key: 'channel', label: 'Saluran', all: 'Semua', options: [['email', 'Dengan email'], ['whatsapp', 'Dengan WhatsApp']] },
    { key: 'made', label: 'Dibuat', type: 'dates' },
  ];
  let q = $state(A.query.q ?? '');
  let vals = $state<Record<string, any>>(readFilters(FILTERS, A.query));
  let ts = $state<TState>({ page: 0, size: 25, sort: '', dir: 'desc' });
  const rows = $derived((data?.broadcasts ?? []).filter((b: any) => {
    const s = q.trim().toLowerCase();
    if (s && !`${b.title} ${b.body} ${b.created_by ?? ''}`.toLowerCase().includes(s)) return false;
    if (vals.status && b.status !== vals.status) return false;
    if (vals.segment && b.segment !== vals.segment) return false;
    if (vals.channel && !b[vals.channel]) return false;
    return inDates(vals.made, b.created_at);
  }));
  const reach = (b: any) => (b.recipients ? Math.min(100, Math.round(((b.pushed ?? 0) / b.recipients) * 100)) : 0);
  const COLS: Col[] = [
    { key: 'title', label: 'Broadcast', req: true, card: 'title', snip: true, sort: true, text: (b) => b.title },
    { key: 'created_at', label: 'Dibuat', sort: true, snip: true, text: (b) => b.created_at },
    { key: 'segment', label: 'Penerima', sort: true, text: (b) => segLabel(b.segment) },
    { key: 'ch', label: 'Saluran', snip: true, text: (b) => ['push', b.email && 'email', b.whatsapp && 'whatsapp'].filter(Boolean).join(' ') },
    { key: 'send_at', label: 'Jadwal', sort: true, snip: true, text: (b) => b.send_at },
    { key: 'status', label: 'Status', sort: true, snip: true, text: (b) => ST[b.status]?.[0] ?? b.status },
    { key: 'reach', label: 'Jangkauan push', snip: true, sort: true, w: '170px', text: (b) => (b.status === 'sent' ? reach(b) : null) },
    { key: 'recipients', label: 'Pemain', num: true, sort: true, text: (b) => b.recipients, html: (b) => (b.recipients == null ? '<span class="muted">—</span>' : num(b.recipients)) },
    { key: 'pushed', label: 'Push sampai', num: true, sort: true, off: true, text: (b) => b.pushed },
    { key: 'emailed', label: 'Email', num: true, off: true, text: (b) => (b.email ? b.emailed : null), html: (b) => (!b.email ? '<span class="muted">—</span>' : b.emailed == null ? 'ya' : num(b.emailed)) },
    { key: 'whatsapped', label: 'WhatsApp', num: true, off: true, text: (b) => (b.whatsapp ? b.whatsapped : null), html: (b) => (!b.whatsapp ? '<span class="muted">—</span>' : b.whatsapped == null ? 'ya' : num(b.whatsapped)) },
    { key: 'created_by', label: 'Oleh', off: true, text: (b) => b.created_by ?? '' },
    { key: '_act', label: '', req: true, snip: true },
  ];
  const counts = $derived({
    scheduled: (data?.broadcasts ?? []).filter((b: any) => b.status === 'scheduled').length,
    sending: (data?.broadcasts ?? []).filter((b: any) => b.status === 'sending').length,
  });
</script>

<PageHead title="Broadcast" updated={updated} onrefresh={() => load()}>
  Kirim notifikasi ke HP pemain (muncul walau game tertutup) dan kotak notifikasi game · notifikasi otomatis diatur di <a href="#/notifcenter">Pusat notifikasi</a>
</PageHead>

<div class="stats">
  <Stat icon="bell" value={data ? num(data.stats.devices) : '…'} label="Perangkat berlangganan push" />
  <Stat icon="users" value={data ? num(data.stats.users) : '…'} label="Pemain dengan push aktif" tone="blue" />
  <Stat icon="send" value={data ? num(data.stats.sent7) : '…'} label="Push terkirim 7 hari" />
  {#if data?.stats.emailEnabled}<Stat icon="mail" value={num(data.stats.emailUsers)} label="Bisa dikirimi email" tone="blue" />{/if}
  {#if data?.stats.waEnabled}<Stat icon="chat" value={num(data.stats.waUsers)} label="Pemain dengan WhatsApp" tone="blue" />{/if}
  {#if counts.scheduled}<Stat icon="clock" value={counts.scheduled} label="Terjadwal" tone="warn" onclick={() => { vals.status = vals.status === 'scheduled' ? '' : 'scheduled'; setQuery({ q, ...vals }); }} active={vals.status === 'scheduled'} />{/if}
</div>

<div class="cols" id="bc-form">
  <form class="card f" onsubmit={send} novalidate>
    <div class="fh"><h2>Kirim notifikasi</h2>{#if f.title || f.body}<button type="button" class="link" onclick={() => { f = blank(); later = false; tried = false; }}>Kosongkan</button>{/if}</div>
    <label>Judul
      <input maxlength="60" bind:value={f.title} placeholder="mis. Pekan Ceria dimulai!" class:bad={tried && f.title.trim().length < 2} />
      <span class="help cnt" class:over={f.title.length >= 55}>{f.title.length}/60</span>
    </label>
    <label>Isi
      <textarea maxlength="160" rows="3" bind:value={f.body} placeholder="mis. Hadiah koin +20% dan kupluk merah putih edisi terbatas." class:bad={tried && f.body.trim().length < 2}></textarea>
      <span class="help cnt" class:over={f.body.length >= 150}>{f.body.length}/160</span>
    </label>
    <div class="grid2">
      <label>Penerima<select bind:value={f.segment}>{#each SEG as [v, l]}<option value={v}>{l}</option>{/each}</select></label>
      <label>Saat diketuk, buka<select bind:value={f.url}>{#each URLS as [v, l]}<option value={v}>{l}</option>{/each}</select></label>
    </div>

    <div class="when">
      <span class="lbl">Waktu kirim</span>
      <span class="seg" role="radiogroup" aria-label="Waktu kirim">
        <button type="button" role="radio" aria-checked={!later} class:on={!later} onclick={() => (later = false)}>Sekarang</button>
        <button type="button" role="radio" aria-checked={later} class:on={later} onclick={() => { later = true; if (!f.sendAt) quickTime('1h'); }}>Jadwalkan</button>
      </span>
    </div>
    {#if later}
      <div class="fade sched">
        <input type="datetime-local" bind:value={f.sendAt} aria-label="Jadwal kirim" class:bad={tried && !f.sendAt} />
        <span class="row qt">
          <button type="button" class="btn sm" onclick={() => quickTime('1h')}>+1 jam</button>
          <button type="button" class="btn sm" onclick={() => quickTime('pagi')}>Besok 09.00</button>
          <button type="button" class="btn sm" onclick={() => quickTime('malam')}>Besok 19.00</button>
        </span>
        {#if past}<span class="help bad">Waktu ini sudah lewat, jadi langsung dikirim.</span>{:else if at}<span class="help">Dikirim {dt(at.getTime())} (waktu perangkatmu).</span>{/if}
      </div>
    {/if}

    {#if data?.stats.emailEnabled || data?.stats.waEnabled}
      <div class="chs">
        <span class="lbl">Saluran tambahan</span>
        {#if data.stats.emailEnabled}
          <Switch bind:checked={f.email} label="Email (Mailketing)" help={`Maks. ±${num(data.stats.emailUsers)} email = ±${num(data.stats.emailUsers)} kredit. Tamu, yang mematikan email, dan alamat bounce dilewati.`} />
        {/if}
        {#if data.stats.waEnabled}
          <Switch bind:checked={f.whatsapp} label="WhatsApp (Klik Flow)" help={`Maks. ±${num(data.stats.waUsers)} pesan dari kuota Klik Flow. Hanya nomor terverifikasi; jam tenang tetap berlaku. WhatsApp Official memakai template "Broadcast" di Pusat notifikasi.`} />
        {/if}
      </div>
    {/if}

    {#if tried && problems.length}<p class="help bad" role="alert">{problems.join(' · ')}</p>{/if}
    <div class="row">
      <button class="btn primary" aria-busy={busy ? 'true' : undefined}>{@html later ? I.clock : I.send}{later ? 'Jadwalkan…' : 'Kirim sekarang…'}</button>
      <span class="muted small">Ringkasan muncul dulu sebelum dikirim.</span>
    </div>
  </form>

  <aside class="pvw" aria-label="Pratinjau notifikasi">
    <div class="phone">
      <span class="clock">{new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
      <div class="note"><img src="/icons/icon-192.png" alt="" /><div><span class="app">BUPI · sekarang</span><b>{f.title || 'Judul notifikasi'}</b><p>{f.body || 'Isi notifikasi muncul di sini.'}</p></div></div>
      <span class="cap">Pratinjau di layar kunci Android</span>
    </div>
    <dl class="kv sum">
      <dt>Penerima</dt><dd>{segLabel(f.segment)}</dd>
      <dt>Saluran</dt><dd>{#each channels as c}<span class="chip blue">{c}</span>{/each}</dd>
      <dt>Buka</dt><dd>{URLS.find((u) => u[0] === f.url)?.[1]}</dd>
      <dt>Waktu</dt><dd>{later ? (f.sendAt ? dt(fromLocal(f.sendAt)) : '—') : 'Sekarang'}</dd>
    </dl>
  </aside>
</div>

<h2 class="hh">Riwayat</h2>
<FilterBar bind:q bind:values={vals} filters={FILTERS} placeholder="Cari judul, isi, atau pembuat" count={rows.length} />
<DataTable cols={COLS} {rows} bind:state={ts} loading={loading && !data} prefKey="broadcasts" csv="local" csvName="broadcast"
  empty={data?.broadcasts?.length ? 'Tidak ada broadcast yang cocok' : 'Belum ada broadcast'} emptyIcon="mega"
  emptyText={data?.broadcasts?.length ? 'Coba ubah kata kunci atau hapus filter.' : 'Broadcast yang kamu kirim atau jadwalkan muncul di sini.'}
  rowClass={(b) => (b.status === 'cancelled' ? 'dim' : '')}>
  {#snippet cell(b, k)}
    {#if k === 'title'}
      <span class="tt"><b>{b.title}</b><small>{b.body}</small></span>
    {:else if k === 'created_at'}<Ago t={b.created_at} />
    {:else if k === 'ch'}
      <span class="chl"><span class="chip mute">Push</span>{#if b.email}<span class="chip mute">Email</span>{/if}{#if b.whatsapp}<span class="chip mute">WA</span>{/if}</span>
    {:else if k === 'send_at'}
      {#if b.status === 'scheduled'}<span class="sa"><span>{dt(b.send_at)}</span><small class="muted"><Ago t={b.send_at} /></small></span>{:else}{dt(b.sent_at ?? b.send_at)}{/if}
    {:else if k === 'status'}
      <span class="chip {ST[b.status]?.[1] ?? ''}">{#if b.status === 'sending'}<span class="dot amber"></span>{/if}{ST[b.status]?.[0] ?? b.status}</span>
    {:else if k === 'reach'}
      {#if b.status === 'sent'}
        <span class="rc"><Bar value={b.pushed ?? 0} max={Math.max(1, b.recipients ?? 0)} tone={reach(b) < 20 ? 'warn' : 'ok'} label="Jangkauan push" /><small>{num(b.pushed ?? 0)} push · {num(b.recipients ?? 0)} pemain ({reach(b)}%)</small></span>
      {:else if b.status === 'sending'}<span class="rc"><Bar value={50} tone="blue" label="Sedang dikirim" /><small>sedang dikirim…</small></span>
      {:else}<span class="muted">—</span>{/if}
    {:else if k === '_act'}
      <span class="acts">
        {#if b.status === 'scheduled'}<button class="btn sm danger" onclick={() => cancel(b)}>{@html I.x}Batalkan</button>{/if}
        <button class="btn sm" onclick={() => reuse(b)} title="Salin isi ke form">{@html I.copy}<span class="hide-s">Pakai lagi</span></button>
      </span>
    {/if}
  {/snippet}
</DataTable>

<style>
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; }
  .cols { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 16px; align-items: start; scroll-margin-top: 16px; }
  @media (max-width: 980px) { .cols { grid-template-columns: 1fr; } }
  .f { display: flex; flex-direction: column; gap: 12px; }
  .fh { display: flex; justify-content: space-between; align-items: center; }
  .fh h2 { font-size: 19px; }
  .cnt { align-self: flex-end; } .cnt.over { color: var(--warn); font-weight: 600; }
  .lbl { font-weight: 600; font-size: 13.5px; }
  .when { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .seg { display: inline-flex; background: #E6EBE8; border-radius: 9px; padding: 3px; gap: 2px; }
  .seg button { all: unset; cursor: pointer; padding: 4px 12px; border-radius: 7px; font-weight: 600; font-size: 13.5px; color: var(--muted); }
  .seg button.on { background: #fff; color: var(--ink); box-shadow: 0 1px 3px rgba(0,0,0,.12); }
  .seg button:focus-visible { outline: 3px solid #3F7FBF; }
  .sched { display: flex; flex-direction: column; gap: 8px; }
  .sched input { max-width: 260px; }
  .qt { gap: 6px; }
  .chs { display: flex; flex-direction: column; gap: 10px; border-top: 1px solid var(--line-soft); padding-top: 12px; }
  .small { font-size: 12.5px; }
  .pvw { display: flex; flex-direction: column; gap: 12px; position: sticky; top: 16px; }
  .phone { background: linear-gradient(160deg, #2B2F4A, #3E5A7A); border-radius: 26px; padding: 18px 14px 14px; display: flex; flex-direction: column; gap: 12px; min-height: 230px; }
  .clock { color: #fff; font: 800 40px var(--display); text-align: center; letter-spacing: .02em; opacity: .92; }
  .note { display: flex; gap: 10px; background: rgba(255,255,255,.94); border-radius: 16px; padding: 10px 12px; animation: pop .2s ease-out; }
  .note img { width: 36px; height: 36px; border-radius: 9px; flex: none; }
  .note div { min-width: 0; display: flex; flex-direction: column; }
  .app { font-size: 11px; color: #6B7085; }
  .note b { font-size: 14px; overflow-wrap: anywhere; } .note p { margin: 2px 0 0; font-size: 13px; color: #3B3F55; overflow-wrap: anywhere; }
  .cap { color: #C8CFE0; font-size: 12px; text-align: center; margin-top: auto; }
  .sum { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; grid-template-columns: 80px 1fr; }
  .hh { font-size: 19px; margin-top: 4px; }
  .tt { display: flex; flex-direction: column; min-width: 0; max-width: 360px; }
  .tt small { color: var(--muted); font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
  .chl { display: inline-flex; gap: 4px; flex-wrap: wrap; }
  .sa { display: flex; flex-direction: column; }
  .rc { display: flex; flex-direction: column; gap: 4px; min-width: 140px; width: 100%; }
  .rc small { color: var(--muted); font-size: 12px; white-space: nowrap; }
  .acts { display: inline-flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap; }
  :global(tr.dim td) { opacity: .6; }
  .btn :global(svg) { width: 15px; height: 15px; }
  @media (max-width: 760px) {
    .stats { display: flex; overflow-x: auto; scrollbar-width: none; margin: 0 -14px; padding: 0 14px; }
    .stats > :global(.stat) { flex: none; min-width: 160px; }
    .pvw { position: static; }
    .phone { min-height: 0; }
    .clock { font-size: 30px; }
    .hide-s { display: none; }
    .tt { max-width: none; }
  }
</style>
