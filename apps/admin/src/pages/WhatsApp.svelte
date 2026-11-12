<script lang="ts">
  // WhatsApp (Klik Flow): pengaturan kirim (dengan penanda belum disimpan), webhook, kirim uji, riwayat pesan dengan
  // cari/filter/urut/CSV, nomor pemain yang tersambung (bisa diputuskan), dan template WhatsApp Official.
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { A, can, err, toast, ask, dt, num, setQuery } from '../lib/store.svelte';
  import { type FDef, readFilters, inDates } from '../lib/filters';
  import { NOTIFY_EVENT_BY_KEY } from '@kb/shared';
  import { I } from '../lib/icons';
  import PageHead from '../components/ui/PageHead.svelte';
  import Stat from '../components/ui/Stat.svelte';
  import Section from '../components/ui/Section.svelte';
  import Switch from '../components/ui/Switch.svelte';
  import FilterBar from '../components/ui/FilterBar.svelte';
  import DataTable, { type Col, type TState } from '../components/ui/DataTable.svelte';
  import Ago from '../components/ui/Ago.svelte';
  import Copy from '../components/ui/Copy.svelte';

  let d = $state<any>(null), cfg = $state<any>(null), savedCfg = $state(''), updated = $state(0);
  let nums = $state<any[] | null>(null);
  let phone = $state('');
  let saveBusy = $state(false), hookBusy = $state(false), testBusy = $state(false), retryBusy = $state(false);
  const edit = $derived(can('admin'));
  const dirty = $derived(!!cfg && JSON.stringify(cfg) !== savedCfg);

  async function load(force = false) {
    try {
      const r = await api.get('/api/admin/whatsapp');
      if (force || !dirty) cfg = structuredClone(r.config);
      savedCfg = JSON.stringify(r.config);
      d = r; updated = Date.now();
      if (r.enabled) loadNums();
    } catch (e) { err(e); }
  }
  async function loadNums() { try { nums = (await api.quiet('/api/admin/whatsapp/numbers')).numbers; } catch { nums = []; } }
  onMount(() => load(true));

  const ST: Record<string, [string, string]> = { queued: ['Antre', 'warn'], sending: ['Mengirim', 'warn'], sent: ['Terkirim', ''], failed: ['Gagal', 'no'] };
  const DLV: Record<string, string> = { delivered: 'sampai', read: 'dibaca', failed: 'gagal', sent: 'terkirim' };
  const label = (k: string) => NOTIFY_EVENT_BY_KEY[k]?.label ?? (k === 'test' ? 'Uji' : k);
  const authTpls = $derived((d?.templates ?? []).filter((t: any) => t.category === 'AUTHENTICATION' && t.status === 'APPROVED'));
  async function cp(t: string, msg: string) { try { await navigator.clipboard.writeText(t); toast(msg, 'info'); } catch { toast('Tidak bisa menyalin otomatis; salin manual dari kotaknya.', 'err'); } }

  /* ---------- aksi ---------- */
  async function saveCfg() {
    saveBusy = true;
    try { await api.put('/api/admin/notify/channels', { whatsapp: $state.snapshot(cfg) }); toast('Pengaturan WhatsApp tersimpan'); await load(true); } catch (e) { err(e); }
    saveBusy = false;
  }
  async function hook() {
    const again = !!d.secretSource;
    const ok = await ask({
      title: again ? 'Daftarkan ulang webhook?' : 'Daftarkan webhook di Klik Flow?',
      body: again ? 'Webhook lama di Klik Flow dihapus lalu dibuat baru dengan secret baru. Selama beberapa detik, status pesan bisa terlewat.' : 'Klik Flow akan mengirim status pesan (sampai, dibaca, gagal) dan balasan STOP/MULAI ke server ini. Secret disimpan otomatis.',
      tone: again ? 'warn' : 'info', icon: 'plug', confirm: again ? 'Daftarkan ulang' : 'Daftarkan',
    });
    if (!ok) return;
    hookBusy = true;
    try { const r = await api.post('/api/admin/whatsapp/webhook'); toast(r.tested ? 'Webhook terdaftar, event uji dikirim' : 'Webhook terdaftar'); setTimeout(() => load(), 2000); } catch (e) { err(e); }
    hookBusy = false;
  }
  async function test(e: Event) {
    e.preventDefault();
    if (!phone || testBusy) return;
    testBusy = true;
    try { const r = await api.post('/api/admin/notify/test/admin_message', { channel: 'whatsapp', to: phone }); toast(`Pesan uji terkirim ke ${r.to}`); load(); } catch (x) { err(x); load(); }
    testBusy = false;
  }
  async function retry() {
    const ok = await ask({ title: 'Coba kirim lagi pesan yang tertunda?', body: 'Pesan WhatsApp yang tertunda karena gagal (mis. kuota habis atau nomor pengirim terputus) dicoba kirim sekarang. Jam tenang tetap berlaku.', tone: 'info', icon: 'refresh', confirm: 'Coba kirim lagi' });
    if (!ok) return;
    retryBusy = true;
    try { const r = await api.post('/api/admin/whatsapp/retry'); toast(r.requeued ? `${r.requeued} pesan dicoba kirim lagi` : 'Tidak ada pesan tertunda', r.requeued ? 'ok' : 'info'); setTimeout(() => load(), 1500); } catch (e) { err(e); }
    retryBusy = false;
  }
  async function unlink(n: any) {
    const ok = await ask({
      title: `Putuskan WhatsApp ${n.display_name}?`,
      body: `Nomor ${n.phone} dilepas dari akun ini. ${n.display_name} tidak menerima WhatsApp lagi sampai menyambungkan & memverifikasi nomornya lagi di Pengaturan game.`,
      tone: 'warn', icon: 'chat', confirm: 'Putuskan',
    });
    if (!ok) return;
    try { await api.post(`/api/admin/whatsapp/unlink/${n.id}`); toast(`WhatsApp ${n.display_name} diputuskan`); load(); } catch (e) { err(e); }
  }

  /* ---------- riwayat pesan ---------- */
  const kinds = $derived([...new Set<string>((d?.recent ?? []).map((r: any) => r.kind))].map((k) => [k, label(k)] as [string, string]));
  const FILTERS = $derived<FDef[]>([
    { key: 'status', label: 'Status', all: 'Semua', options: Object.entries(ST).map(([k, v]) => [k, v[0]]) },
    { key: 'kind', label: 'Jenis', all: 'Semua', options: kinds },
    { key: 'dlv', label: 'Laporan', all: 'Semua', options: [['delivered', 'Sampai'], ['read', 'Dibaca'], ['none', 'Belum ada kabar']] },
    { key: 'when', label: 'Waktu', type: 'dates' },
  ]);
  let q = $state(A.query.q ?? '');
  let vals = $state<Record<string, any>>(readFilters([{ key: 'status' }, { key: 'kind' }, { key: 'dlv' }, { key: 'when', type: 'dates' }] as FDef[], A.query));
  let ts = $state<TState>({ page: 0, size: 25, sort: '', dir: 'desc' });
  const rows = $derived((d?.recent ?? []).filter((r: any) => {
    const s = q.trim().toLowerCase();
    if (s && !`${r.to_addr ?? ''} ${r.subject ?? ''}`.toLowerCase().includes(s)) return false;
    if (vals.status && r.status !== vals.status) return false;
    if (vals.kind && r.kind !== vals.kind) return false;
    if (vals.dlv && (vals.dlv === 'none' ? !!r.delivery : r.delivery !== vals.dlv)) return false;
    return inDates(vals.when, r.sent_at ?? r.created_at);
  }));
  const later = (r: any) => r.status === 'queued' && r.next_at && new Date(r.next_at) > new Date();
  const COLS: Col[] = [
    { key: 'to_addr', label: 'Ke', req: true, card: 'title', sort: true, snip: true, text: (r) => r.to_addr },
    { key: 'subject', label: 'Judul', sort: true, text: (r) => r.subject ?? '' },
    { key: 'kind', label: 'Jenis', sort: true, text: (r) => label(r.kind) },
    { key: 'status', label: 'Status', sort: true, snip: true, text: (r) => `${ST[r.status]?.[0] ?? r.status}${r.delivery ? ' · ' + (DLV[r.delivery] ?? r.delivery) : ''}` },
    { key: 'at', label: 'Waktu', sort: true, snip: true, text: (r) => r.sent_at ?? r.created_at },
    { key: 'info', label: 'Keterangan', snip: true, text: (r) => r.error ?? (later(r) ? `dijadwalkan ${dt(r.next_at)}` : '') },
    { key: 'attempts', label: 'Percobaan', num: true, off: true, sort: true, text: (r) => r.attempts },
  ];
  function quick(k: string, v: string) { vals = { status: '', kind: '', dlv: '', when: '', [k]: vals[k] === v ? '' : v }; setQuery({ q, ...vals }); document.getElementById('log-h')?.scrollIntoView({ behavior: 'smooth' }); }

  /* ---------- nomor tersambung ---------- */
  const NUM_F: FDef[] = [{ key: 'st', label: 'Status', all: 'Semua', options: [['on', 'Aktif'], ['stop', 'Membalas STOP'], ['ban', 'Diblokir']] }];
  let nq = $state(''), nvals = $state<Record<string, any>>({ st: '' }), nts = $state<TState>({ page: 0, size: 25, sort: '', dir: 'desc' });
  let numOpen = $state(true);
  const numStatus = (n: any) => (n.banned_at ? 'ban' : n.opted_out ? 'stop' : 'on');
  const NUM_ST: Record<string, [string, string]> = { on: ['Aktif', ''], stop: ['Membalas STOP', 'mute'], ban: ['Diblokir', 'no'] };
  const numRows = $derived((nums ?? []).filter((n) => (!nq.trim() || `${n.display_name} ${n.friend_code} ${n.phone}`.toLowerCase().includes(nq.trim().toLowerCase())) && (!nvals.st || numStatus(n) === nvals.st)));
  const NUM_COLS: Col[] = [
    { key: 'who', label: 'Pemain', req: true, card: 'title', sort: true, snip: true, text: (n) => n.display_name },
    { key: 'phone', label: 'Nomor', snip: true, text: (n) => n.phone },
    { key: 'wa_verified_at', label: 'Tersambung', sort: true, snip: true, text: (n) => n.wa_verified_at },
    { key: 'st', label: 'Status', sort: true, snip: true, text: (n) => NUM_ST[numStatus(n)][0] },
    { key: 'last_seen_at', label: 'Terakhir aktif', sort: true, off: true, snip: true, text: (n) => n.last_seen_at },
    { key: '_act', label: '', req: true, snip: true },
  ];
  function showNums() { numOpen = true; setTimeout(() => document.getElementById('wa-num')?.scrollIntoView({ behavior: 'smooth' }), 50); }

  /* ---------- template Official ---------- */
  const TPL_ST: Record<string, [string, string]> = { APPROVED: ['Disetujui', ''], PENDING: ['Menunggu', 'warn'], REJECTED: ['Ditolak', 'no'] };
  const cats = $derived([...new Set<string>((d?.templates ?? []).map((t: any) => t.category))].map((c) => [c, c] as [string, string]));
  const TPL_F = $derived<FDef[]>([
    { key: 'cat', label: 'Kategori', all: 'Semua', options: cats },
    { key: 'st', label: 'Status', all: 'Semua', options: Object.entries(TPL_ST).map(([k, v]) => [k, v[0]]) },
  ]);
  let tq = $state(''), tvals = $state<Record<string, any>>({ cat: '', st: '' }), tts = $state<TState>({ page: 0, size: 25, sort: '', dir: 'desc' });
  const tplRows = $derived((d?.templates ?? []).filter((t: any) => (!tq.trim() || `${t.name} ${t.body ?? ''}`.toLowerCase().includes(tq.trim().toLowerCase())) && (!tvals.cat || t.category === tvals.cat) && (!tvals.st || t.status === tvals.st)));
  const TPL_COLS: Col[] = [
    { key: 'name', label: 'Nama', req: true, card: 'title', sort: true, snip: true, text: (t) => `${t.name} (${t.language})` },
    { key: 'category', label: 'Kategori', sort: true, text: (t) => t.category },
    { key: 'status', label: 'Status', sort: true, snip: true, text: (t) => TPL_ST[t.status]?.[0] ?? t.status },
    { key: 'body', label: 'Isi', snip: true, text: (t) => t.body ?? '' },
    { key: 'vars', label: 'Variabel', num: true, off: true, text: (t) => (t.variables ?? []).filter((v: any) => v.field === 'variables').length },
  ];
</script>

<PageHead title="WhatsApp" updated={updated} onrefresh={() => load()}>
  <span>Notifikasi lewat Klik Flow ke pemain yang memverifikasi nomornya · pemain membalas <b>STOP</b> untuk berhenti, <b>MULAI</b> untuk menyalakan lagi</span>
</PageHead>

{#if !d}
  <div class="stats">{#each Array(4) as _}<div class="card sk"><span class="skel" style="width:40%"></span><span class="skel" style="width:70%"></span></div>{/each}</div>
  <div class="card sk tall"><span class="skel" style="width:30%"></span><span class="skel"></span><span class="skel" style="width:80%"></span></div>
{:else if !d.enabled}
  <Section title="Sambungkan Klik Flow" prefKey="wa:setup">
    {#snippet badge()}<span class="chip mute">Belum tersambung</span>{/snippet}
    <ol class="steps">
      <li>Buat kunci di Klik Flow → <b>Pengaturan › API &amp; Webhook</b> dengan izin <b>messages:send</b>, plus <b>business:read</b> &amp; <b>templates:read</b> untuk halaman ini.</li>
      <li>Tambahkan ke <span class="mono">.env</span> di server, lalu restart:</li>
    </ol>
    <div class="pre"><pre class="mono">KLIKFLOW_API_KEY=kf_test_…</pre><button class="btn sm" onclick={() => cp('KLIKFLOW_API_KEY=', 'Contoh .env disalin')}>{@html I.copy}Salin</button></div>
    <p class="muted small">Mulai dengan kunci tes: pesan hanya sampai ke nomor uji (maks. 5) yang didaftarkan di Klik Flow. Ganti ke <span class="mono">kf_live_…</span> saat siap.</p>
  </Section>
{:else}
  {#if d.error}<p class="alert"><span class="ic">{@html I.warn}</span><span>Klik Flow menolak kunci: {d.error}</span></p>{/if}
  <div class="stats">
    <Stat icon="key" value={d.mode === 'live' ? 'Live' : d.mode === 'test' ? 'Tes' : '—'} label={d.key ? `Kunci ${d.key.name} · ${d.key.prefix}…` : 'Mode kunci'} tone={d.mode === 'live' ? 'ok' : 'warn'} />
    <Stat icon="check" value={num(d.stats.sent24)} label="Terkirim 24 jam" onclick={() => quick('status', 'sent')} active={vals.status === 'sent'} />
    <Stat icon="warn" value={num(d.stats.failed24)} label="Gagal 24 jam" tone={d.stats.failed24 ? 'no' : 'blue'} onclick={() => quick('status', 'failed')} active={vals.status === 'failed'} />
    <Stat icon="clock" value={num(d.stats.queued)} label="Antrean" tone={d.stats.queued ? 'warn' : 'blue'} onclick={() => quick('status', 'queued')} active={vals.status === 'queued'} />
    <Stat icon="users" value={num(d.stats.verified)} label={`Nomor tersambung · ${num(d.stats.optedout)} STOP`} tone="blue" onclick={showNums} />
  </div>
  {#if d.mode === 'test'}<p class="alert warn"><span class="ic">{@html I.info}</span><span>Mode tes: pesan hanya sampai ke nomor uji di Klik Flow (Pengaturan › API &amp; Webhook › Nomor uji). Pemain lain gagal menerima kode verifikasi.</span></p>{/if}
  {#if d.last && !d.last.ok}<p class="alert"><span class="ic">{@html I.warn}</span><span>Pengiriman terakhir gagal (<Ago t={d.last.at} />): {d.last.error}</span></p>{/if}

  <div class="cols">
    <Section title="Pengiriman" prefKey="wa:send">
      {#snippet badge()}{#if cfg.enabled}<span class="chip">Nyala</span>{:else}<span class="chip mute">Mati</span>{/if}{#if dirty}<span class="chip warn">belum disimpan</span>{/if}{/snippet}
      <Switch bind:checked={cfg.enabled} disabled={!edit} label="Kirim notifikasi lewat WhatsApp" help="Jenis notifikasi yang ikut WhatsApp diatur di Pusat notifikasi." />
      <label>Saluran<select bind:value={cfg.channel} disabled={!edit}>
        <option value="whatsapp_qr">WhatsApp (scan QR): teks bebas</option>
        <option value="whatsapp_official">WhatsApp Official: template yang disetujui</option></select></label>
      <label>Nomor pengirim<select bind:value={cfg.from} disabled={!edit}>
        <option value="">Otomatis (nomor pertama yang boleh dipakai kunci)</option>
        {#each (d.channels ?? []).filter((c: any) => c.channel === cfg.channel) as c}<option value={String(c.from)}>{c.name}{c.connected ? '' : ' (terputus)'}</option>{/each}
      </select>{#if d.channelsError}<span class="help bad">{d.channelsError}</span>{/if}</label>
      {#if cfg.channel === 'whatsapp_official'}
        <label>Template kode verifikasi (Autentikasi)<select bind:value={cfg.verifyTemplate} disabled={!edit}>
          <option value="">— pilih —</option>
          {#each authTpls as t}<option value={t.name}>{t.name}</option>{/each}
          {#if cfg.verifyTemplate && !authTpls.some((t: any) => t.name === cfg.verifyTemplate)}<option value={cfg.verifyTemplate}>{cfg.verifyTemplate}</option>{/if}
        </select><span class="help">Dipakai saat pemain menyambungkan nomor. Notifikasi lain butuh template per jenis di Pusat notifikasi.</span></label>
      {:else}
        <p class="help">Scan QR: chat pertama ke nomor baru butuh izin <b>messages:new</b> dan dibatasi 50 nomor baru per kunci per hari oleh Klik Flow.</p>
      {/if}
      <div class="grid3">
        <label>Maks./hari<input type="number" min="0" max="50" bind:value={cfg.maxPerDay} disabled={!edit} /></label>
        <label>Jam tenang mulai<input type="number" min="0" max="23" bind:value={cfg.quietStart} disabled={!edit} /></label>
        <label>sampai (WIB)<input type="number" min="0" max="23" bind:value={cfg.quietEnd} disabled={!edit} /></label>
      </div>
      <label>Maks. kode verifikasi per hari (semua pemain)<input type="number" min="0" max="5000" bind:value={cfg.verifyPerDay} disabled={!edit} />
        <span class="help">Melindungi kuota & biaya dari penyalahgunaan. Satu nomor dibatasi 3 kode per 24 jam, dan hanya akun tersimpan (bukan tamu) yang bisa meminta kode.</span></label>
      {#if edit}
        <div class="savebar" class:on={dirty}>
          <span class="muted small">{#if dirty}<span class="dot amber"></span> Ada perubahan belum disimpan{:else}Semua tersimpan{/if}</span>
          {#if dirty}<button class="btn" onclick={() => (cfg = JSON.parse(savedCfg))}>{@html I.undo}Batalkan</button>{/if}
          <button class="btn primary" disabled={!dirty} aria-busy={saveBusy ? 'true' : undefined} onclick={saveCfg}>Simpan</button>
        </div>
      {/if}
    </Section>

    <div class="stack">
      <Section title="Webhook" prefKey="wa:hook">
        {#snippet badge()}{#if d.secretSource}<span class="chip">Terdaftar</span>{:else}<span class="chip warn">Belum didaftarkan</span>{/if}{/snippet}
        <p class="small">Status pesan (sampai, dibaca, gagal) dan balasan STOP/MULAI diterima lewat webhook.</p>
        <div class="cp"><input class="mono" readonly value={d.webhookUrl} aria-label="URL webhook" onfocus={(e) => (e.target as HTMLInputElement).select()} /><button class="btn" onclick={() => cp(d.webhookUrl, 'URL webhook disalin')}>{@html I.copy}Salin</button></div>
        <dl class="kv">
          <dt>Secret</dt><dd>{#if d.secretSource}{d.secretSource === 'env' ? 'dari KLIKFLOW_WEBHOOK_SECRET' : 'tersimpan di database'}{:else}<span class="muted">belum ada</span>{/if}</dd>
          <dt>Event terakhir</dt><dd>{#if d.lastEvent}{d.lastEvent.type} · <Ago t={d.lastEvent.at} />{:else}<span class="muted">belum ada</span>{/if}</dd>
        </dl>
        {#if can('owner')}
          <div class="row"><button class="btn primary" disabled={!d.webhookUrl.startsWith('https://')} aria-busy={hookBusy ? 'true' : undefined} onclick={hook}>{@html I.plug}{d.secretSource ? 'Daftarkan ulang' : 'Daftarkan webhook'}</button>
            {#if !d.webhookUrl.startsWith('https://')}<span class="help">Butuh PUBLIC_URL https://</span>{/if}</div>
        {/if}
        <p class="help">Butuh kunci live. Dengan kunci tes, isi URL di atas manual di Klik Flow lalu salin secret-nya ke <span class="mono">KLIKFLOW_WEBHOOK_SECRET</span>.</p>
      </Section>
      <form class="card s" onsubmit={test}>
        <h2>Kirim uji</h2>
        <div class="cp"><input type="tel" bind:value={phone} placeholder="0812…" aria-label="Nomor tujuan uji" /><button class="btn" disabled={!phone} aria-busy={testBusy ? 'true' : undefined}>{@html I.send}Kirim</button></div>
        <p class="help">Memakai teks "Pesan ke satu pemain" dari Pusat notifikasi.</p>
      </form>
    </div>
  </div>

  <h2 class="hh" id="log-h">Pesan terakhir <small class="muted">50 terbaru, nomor disamarkan</small></h2>
  <FilterBar bind:q bind:values={vals} filters={FILTERS} placeholder="Cari nomor atau judul" count={rows.length} />
  <DataTable cols={COLS} {rows} bind:state={ts} prefKey="wa-log" csv="local" csvName="whatsapp"
    empty={d.recent.length ? 'Tidak ada pesan yang cocok' : 'Belum ada pesan'} emptyIcon="chat"
    emptyText={d.recent.length ? 'Coba ubah kata kunci atau hapus filter.' : 'Kirim pesan uji untuk mengecek sambungan.'}
    rowClass={(r) => (r.status === 'failed' ? 'fail' : '')}>
    {#snippet tools()}<button class="btn sm" aria-busy={retryBusy ? 'true' : undefined} onclick={retry}>{@html I.refresh}<span class="hide-s">Kirim ulang tertunda</span></button>{/snippet}
    {#snippet cell(r, k)}
      {#if k === 'to_addr'}<span class="mono">{r.to_addr}</span>
      {:else if k === 'status'}<span class="chip {ST[r.status]?.[1] ?? 'mute'}">{ST[r.status]?.[0] ?? r.status}</span>{#if r.delivery} <small class="dl {r.delivery}">{DLV[r.delivery] ?? r.delivery}</small>{/if}
      {:else if k === 'at'}<Ago t={r.sent_at ?? r.created_at} />
      {:else if k === 'info'}
        {#if r.error}<span class="er">{r.error}</span>{:else if later(r)}<span class="muted">dijadwalkan {dt(r.next_at)}</span>{:else}<span class="muted">—</span>{/if}
      {/if}
    {/snippet}
  </DataTable>

  <Section title="Nomor tersambung" id="wa-num" prefKey="wa:num" bind:open={numOpen} sub="Pemain yang sudah memverifikasi nomornya. Putuskan bila nomornya salah, hilang, atau diminta pemain.">
    {#snippet badge()}<span class="chip blue">{num(d.stats.verified)}</span>{/snippet}
    <FilterBar bind:q={nq} bind:values={nvals} filters={NUM_F} sync={false} placeholder="Cari nama, kode teman, nomor" count={numRows.length} />
    <DataTable cols={NUM_COLS} rows={numRows} bind:state={nts} loading={nums === null} prefKey="wa-num" csv="local" csvName="whatsapp-nomor"
      empty={nums?.length ? 'Tidak ada nomor yang cocok' : 'Belum ada nomor tersambung'} emptyIcon="chat"
      emptyText={nums?.length ? '' : 'Pemain menyambungkan nomor dari Pengaturan di game.'}>
      {#snippet cell(n, k)}
        {#if k === 'who'}<span class="who"><a href="#/players/{n.id}"><b>{n.display_name}</b></a><small class="mono">{n.friend_code} <Copy text={n.friend_code} label="Kode teman disalin" /></small></span>
        {:else if k === 'phone'}<span class="mono">{n.phone}</span>
        {:else if k === 'wa_verified_at'}<Ago t={n.wa_verified_at} />
        {:else if k === 'last_seen_at'}<Ago t={n.last_seen_at} />
        {:else if k === 'st'}<span class="chip {NUM_ST[numStatus(n)][1]}">{NUM_ST[numStatus(n)][0]}</span>
        {:else if k === '_act'}{#if edit}<button class="btn sm danger" onclick={() => unlink(n)}>{@html I.x}Putuskan</button>{/if}
        {/if}
      {/snippet}
    </DataTable>
  </Section>

  {#if d.templates?.length || d.templatesError}
    <Section title="Template WhatsApp Official" prefKey="wa:tpl" open={false} sub="Template dari Klik Flow. Pilih template per jenis notifikasi di Pusat notifikasi.">
      {#snippet badge()}<span class="chip mute">{num(d.templates?.length ?? 0)}</span>{/snippet}
      {#if d.templatesError}<p class="alert warn"><span class="ic">{@html I.warn}</span><span>Template tidak terbaca: {d.templatesError}</span></p>{/if}
      <FilterBar bind:q={tq} bind:values={tvals} filters={TPL_F} sync={false} placeholder="Cari nama atau isi template" count={tplRows.length} />
      <DataTable cols={TPL_COLS} rows={tplRows} bind:state={tts} idKey="name" prefKey="wa-tpl" csv="local" csvName="whatsapp-template" empty="Tidak ada template yang cocok" emptyIcon="chat">
        {#snippet cell(t, k)}
          {#if k === 'name'}<span><span class="mono">{t.name}</span> <small class="muted">({t.language})</small></span>
          {:else if k === 'status'}<span class="chip {TPL_ST[t.status]?.[1] ?? 'mute'}">{TPL_ST[t.status]?.[0] ?? t.status}</span>
          {:else if k === 'body'}<span class="tb">{t.body}</span>
          {/if}
        {/snippet}
      </DataTable>
    </Section>
  {/if}
{/if}

<style>
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; }
  .sk { display: flex; flex-direction: column; gap: 10px; padding: 16px; }
  .sk.tall { min-height: 160px; }
  .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr)); gap: 12px; align-items: start; }
  .stack { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
  .s { display: flex; flex-direction: column; gap: 10px; }
  .s h2 { font-size: 18px; }
  .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; align-items: end; }
  .small { font-size: 13px; margin: 0; }
  .help { margin: 0; }
  .cp { display: flex; gap: 8px; }
  .cp input { flex: 1; min-width: 0; }
  .cp input.mono { font-size: 12.5px; }
  .savebar { display: flex; align-items: center; gap: 8px; justify-content: flex-end; flex-wrap: wrap; border-top: 1px solid var(--line-soft); padding-top: 12px; }
  .savebar > span { margin-right: auto; display: inline-flex; align-items: center; gap: 8px; }
  .savebar.on > span { color: var(--warn); font-weight: 600; }
  .alert { margin: 0; display: flex; gap: 8px; align-items: flex-start; background: var(--danger-soft); color: var(--danger); border-radius: 10px; padding: 9px 12px; font-weight: 600; font-size: 13.5px; }
  .alert.warn { background: var(--warn-soft); color: var(--warn); }
  .alert .ic { width: 17px; height: 17px; margin-top: 1px; }
  .hh { font-size: 19px; display: flex; align-items: baseline; gap: 8px; scroll-margin-top: 16px; flex-wrap: wrap; }
  .hh small { font: 500 13px var(--body); }
  .er { color: var(--danger); font-size: 13px; }
  .dl { font-size: 12px; font-weight: 600; color: var(--muted); }
  .dl.read, .dl.delivered { color: var(--accent); } .dl.failed { color: var(--danger); }
  .who { display: flex; flex-direction: column; min-width: 0; }
  .who a { color: var(--ink); text-decoration: none; } .who a:hover { color: var(--accent); text-decoration: underline; }
  .who small { color: var(--muted); display: inline-flex; gap: 4px; align-items: center; }
  .tb { color: var(--muted); font-size: 13px; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; max-width: 460px; }
  .steps { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px; font-size: 14px; }
  .pre { display: flex; gap: 8px; align-items: flex-start; }
  pre { flex: 1; margin: 0; background: #F3F5F3; border-radius: 10px; padding: 10px 12px; white-space: pre-wrap; overflow-wrap: anywhere; }
  .btn :global(svg) { width: 15px; height: 15px; }
  @media (min-width: 761px) { :global(tr.fail td:first-child) { box-shadow: inset 3px 0 0 var(--danger); } }
  @media (max-width: 760px) {
    .stats { display: flex; overflow-x: auto; scrollbar-width: none; margin: 0 -14px; padding: 0 14px; }
    .stats > :global(.stat) { flex: none; min-width: 160px; }
    .pre { flex-direction: column; }
    .hide-s { display: none; }
  }
</style>
