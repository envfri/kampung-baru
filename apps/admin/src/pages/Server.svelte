<script lang="ts">
  // Server: pemakaian CPU, memori, penyimpanan & database, aplikasi, pemain live, riwayat, dan peringatan ke owner.
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { err, toast, num, dt, ago, pref, savePref } from '../lib/store.svelte';
  import { CLOCK } from '../lib/clock.svelte';
  import { I } from '../lib/icons';
  import PageHead from '../components/ui/PageHead.svelte';
  import Section from '../components/ui/Section.svelte';
  import Bar from '../components/ui/Bar.svelte';
  import Tabs from '../components/ui/Tabs.svelte';
  import Switch from '../components/ui/Switch.svelte';
  import Empty from '../components/ui/Empty.svelte';

  let s = $state<any>(null), updated = $state(0), every = $state(10), range = $state('24j');
  let hist = $state<any[]>([]), histRange = '';
  let form = $state<any>(null), start = '', saving = $state(false), testing = $state(false);

  async function load(quiet = false) {
    try {
      s = await (quiet ? api.quiet : api.get)('/api/admin/server');
      updated = Date.now();
      if (!form || JSON.stringify(form) === start) { form = JSON.parse(JSON.stringify(s.settings)); start = JSON.stringify(form); }
      if (range === '1j') hist = s.recent; else if (histRange !== range || Date.now() - histAt > 60_000) loadHist();
    } catch (e) { if (!quiet) err(e); }
  }
  let histAt = 0;
  async function loadHist() {
    if (range === '1j') { hist = s?.recent ?? []; histRange = range; return; }
    try { const r = await api.quiet(`/api/admin/server/history?range=${range}`); hist = r.points; histRange = range; histAt = Date.now(); } catch (e) { err(e); }
  }
  onMount(() => {
    every = pref('srv:every', 10); range = pref('srv:range', '24j');
    load();
    const t = setInterval(() => { if (every && !document.hidden && Date.now() - updated >= every * 1000 - 300) load(true); }, 1000);
    return () => clearInterval(t);
  });
  function setEvery(v: number) { every = v; savePref('srv:every', v); }
  function setRange(k: string) { range = k; savePref('srv:range', k); loadHist(); }

  /* ---------- format ---------- */
  const dec = (v: number, d = 1) => (Math.round(v * 10 ** d) / 10 ** d).toLocaleString('id-ID');
  function bytes(b: number | null | undefined) {
    if (b == null || !isFinite(b)) return '—';
    const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0, v = b;
    while (v >= 1000 && i < u.length - 1) { v /= 1024; i++; }
    return `${dec(v, v < 10 && i >= 2 ? 1 : 0)} ${u[i]}`;
  }
  function dur(sec: number) {
    const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
    return d ? `${d} hari ${h} jam` : h ? `${h} jam ${m} menit` : `${m} menit`;
  }
  const tone = (v: number, warn: number, bad: number) => (v >= bad ? 'no' : v >= warn ? 'warn' : 'ok');
  const col = (t: string) => (t === 'no' ? '#D4553A' : t === 'warn' ? '#E3A21A' : '#1E7A63');
  function ring(v: number, c: string) {
    const r = 26, L = 2 * Math.PI * r, p = Math.max(0, Math.min(100, v));
    return `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="${r}" fill="none" stroke="#E8ECE9" stroke-width="7"/><circle cx="32" cy="32" r="${r}" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${((L * p) / 100).toFixed(1)} ${L.toFixed(1)}" transform="rotate(-90 32 32)"/></svg>`;
  }
  function spark(vals: number[], c: string) {
    if (vals.length < 2) return '';
    const max = Math.max(...vals), min = Math.min(...vals);
    const pts = vals.map((v, i) => `${((i * 100) / (vals.length - 1)).toFixed(1)},${(30 - ((v - min) / (max - min || 1)) * 26).toFixed(1)}`).join(' ');
    return `<svg viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true"><polyline points="0,32 ${pts} 100,32" fill="${c}" fill-opacity=".1"/><polyline points="${pts}" fill="none" stroke="${c}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
  }

  /* ---------- kartu utama ---------- */
  const gauges = $derived.by(() => {
    if (!s) return [];
    const R = s.settings.rules, rec = s.recent as any[];
    const dbPct = s.db.conns != null && s.db.maxConns ? (s.db.conns / s.db.maxConns) * 100 : 0;
    const cpuT = tone(s.cpu.pct, R.cpu.pct - 15, R.cpu.pct), memT = tone(s.mem.pct, R.mem.pct - 15, R.mem.pct), diskT = tone(s.disk.pct, R.disk.pct - 15, R.disk.pct);
    const dbT = s.db.ms >= R.db.ms ? 'no' : s.db.ms >= R.db.ms / 2 ? 'warn' : 'ok';
    return [
      { k: 'cpu', icon: 'cpu', t: 'CPU', pct: s.cpu.pct, ring: `${Math.round(s.cpu.pct)}%`, big: `${dec(s.cpu.pct)}%`, tone: cpuT,
        sub: [`${s.cpu.cores} inti${s.cpu.limited ? ' (batas container)' : ''} · beban ${s.cpu.load.map((x: number) => dec(x, 2)).join(' / ')}`, `Proses BUPI ${dec(s.cpu.proc)}%`], sp: spark(rec.map((x) => x.cpu), '#1E7A63') },
      { k: 'mem', icon: 'mem', t: 'Memori', pct: s.mem.pct, ring: `${Math.round(s.mem.pct)}%`, big: `${bytes(s.mem.used)} / ${bytes(s.mem.total)}`, tone: memT,
        sub: [`Tersedia ${bytes(s.mem.total - s.mem.used)}${s.mem.limited ? ' (batas container)' : ''}`, `Proses BUPI ${bytes(s.mem.rss)} (heap ${bytes(s.mem.heapUsed)})`], sp: spark(rec.map((x) => x.mem), '#3F7FBF') },
      { k: 'disk', icon: 'disk', t: 'Penyimpanan', pct: s.disk.pct, ring: `${Math.round(s.disk.pct)}%`, big: `${bytes(s.disk.used)} / ${bytes(s.disk.total)}`, tone: diskT,
        sub: [`Sisa ${bytes(s.disk.total - s.disk.used)}`, s.disk.daysLeft != null ? `Cukup ±${s.disk.daysLeft > 60 ? `${Math.round(s.disk.daysLeft / 30)} bulan` : `${s.disk.daysLeft} hari`} lagi (laju 7 hari)` : 'Perkiraan sisa waktu muncul setelah ±1 hari data'], sp: spark(rec.map((x) => x.disk), '#E3A21A') },
      { k: 'db', icon: 'db', t: 'Database', pct: dbPct, ring: s.db.conns != null && s.db.maxConns ? `${Math.round(dbPct)}%` : `${Math.round(s.db.ms)}ms`, big: bytes(s.db.size), tone: dbT,
        sub: [`${s.db.kind}${s.db.version ? ' ' + String(s.db.version).split(' ')[0] : ''}${s.db.conns != null && s.db.maxConns ? ` · ${s.db.conns}/${s.db.maxConns} koneksi` : ''}`, `Kueri ${dec(s.db.ms)} ms${s.db.cacheHit != null ? ` · cache ${dec(s.db.cacheHit * 100)}%` : ''}`], sp: spark(rec.map((x) => x.dbMs ?? 0), '#8A5CC0') },
    ];
  });
  const APP = $derived.by(() => {
    if (!s) return [];
    const a = s.app;
    return [
      { l: 'Jeda event loop', v: `${dec(a.loop50)} ms`, sub: `p99 ${dec(a.loop99)} ms`, bar: Math.min(100, a.loop99), t: a.loop99 > 200 ? 'no' : a.loop99 > 80 ? 'warn' : 'ok' },
      { l: 'Permintaan', v: `${num(a.rpm)} / menit`, sub: `puncak 24 jam: ${num(a.rpmPeak)} / menit`, bar: a.rpmPeak ? (a.rpm / a.rpmPeak) * 100 : 0, t: 'blue' },
      { l: 'Waktu respons', v: `${num(a.rt50)} ms`, sub: `p95 ${num(a.rt95)} ms (5 menit)`, bar: Math.min(100, a.rt95 / 10), t: a.rt95 > 1000 ? 'no' : a.rt95 > 300 ? 'warn' : 'ok' },
      { l: 'Error 5xx', v: `${dec(a.errPct, 2)}%`, sub: `${num(a.err1h)} dari ${num(a.req1h)} permintaan (1 jam)`, bar: Math.min(100, a.errPct * 10), t: a.errPct >= s.settings.rules.err.pct ? 'no' : a.errPct > 0.5 ? 'warn' : 'ok' },
      { l: 'Pemain live', v: num(s.players.live), sub: `sinkron di ${num(s.players.houses)} rumah & ${num(s.players.squares)} alun-alun`, bar: 0, t: 'blue' },
      { l: 'Menyala', v: dur(a.uptimeSec), sub: `sejak ${dt(a.startedAt)} · v${a.version}${a.commit ? ' · ' + String(a.commit).slice(0, 7) : ''}`, bar: 0, t: 'ok' },
    ];
  });
  const WHERE = $derived(s ? [
    { l: 'Rumah', n: s.players.where.home, c: '#1E7A63' }, { l: 'Berkunjung', n: s.players.where.visit, c: '#46B18F' },
    { l: 'Alun-alun', n: s.players.where.alun, c: '#E3A21A' }, { l: 'Peta & toko', n: s.players.where.map, c: '#3F7FBF' }, { l: 'Mini-game', n: s.players.where.game, c: '#8A5CC0' },
  ] : []);
  const whereSum = $derived(WHERE.reduce((a, w) => a + w.n, 0));

  /* ---------- grafik riwayat ---------- */
  const W = 1000, H = 180;
  const chart = $derived.by(() => {
    const pts = hist ?? [];
    if (pts.length < 2) return null;
    const t0 = pts[0].t, t1 = pts[pts.length - 1].t, span = t1 - t0 || 1;
    const x = (t: number) => ((t - t0) / span) * W;
    const y = (v: number, max: number) => H - (Math.max(0, v) / (max || 1)) * (H - 12);
    const maxOn = Math.max(5, ...pts.map((p: any) => p.online));
    const line = (k: string, max: number) => pts.map((p: any) => `${x(p.t).toFixed(1)},${y(p[k], max).toFixed(1)}`).join(' ');
    const fmt = (t: number) => {
      const d = new Date(t);
      return span > 2 * 86400_000 ? d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    };
    const ticks = Array.from({ length: 6 }, (_, i) => ({ x: (i * W) / 5, l: fmt(t0 + (span * i) / 5) }));
    const peak = pts.reduce((a: any, p: any) => (p.online > a.online ? p : a), pts[0]);
    const peakCpu = pts.reduce((a: any, p: any) => (p.cpu > a.cpu ? p : a), pts[0]);
    return { cpu: line('cpu', 100), mem: line('mem', 100), on: line('online', maxOn), maxOn, ticks, thr: y(s?.settings.rules.cpu.pct ?? 85, 100), peak, peakCpu, fmt };
  });

  /* ---------- peringatan ---------- */
  const dirty = $derived(!!form && JSON.stringify(form) !== start);
  async function save() {
    saving = true;
    try { const r = await api.put('/api/admin/server/settings', form); form = JSON.parse(JSON.stringify(r.settings)); start = JSON.stringify(form); s.settings = r.settings; toast('Pengaturan peringatan disimpan'); }
    catch (e) { err(e); } finally { saving = false; }
  }
  async function sendTest() {
    testing = true;
    try {
      const r = await api.post('/api/admin/server/test', {});
      if (r.email || r.whatsapp) toast(`Pesan uji diantrekan: ${r.email} email${r.whatsapp ? ' + WhatsApp' : ''}`);
      else toast(r.note || 'Belum ada saluran yang siap (email/WhatsApp belum diatur atau penerima kosong).', 'info');
    } catch (e) { err(e); } finally { testing = false; }
  }
  const KIND: Record<string, string> = { cpu: 'CPU tinggi', mem: 'Memori hampir penuh', disk: 'Penyimpanan hampir penuh', db: 'Database lambat', err: 'Banyak error', restart: 'Server menyala ulang' };
</script>

<PageHead title="Server" sub="Pemakaian CPU, memori, penyimpanan & database. Diperbarui otomatis." {updated} onrefresh={() => load()} live={!!every}>
  {#snippet actions()}
    <select class="sel" aria-label="Perbarui otomatis" value={every} onchange={(e) => setEvery(Number((e.target as HTMLSelectElement).value))}>
      <option value={10}>Tiap 10 detik</option><option value={30}>Tiap 30 detik</option><option value={0}>Jangan perbarui</option>
    </select>
    <a class="btn" href="/api/admin/server/report" download>{@html I.download} Unduh laporan</a>
  {/snippet}
</PageHead>

{#if !s}
  <div class="gauges">{#each Array(4) as _}<div class="card gauge"><span class="skel" style="width:60%"></span><span class="skel"></span><span class="skel" style="width:80%"></span></div>{/each}</div>
{:else}
  {#if s.active.length}
    <div class="bar warnbar" role="alert"><span class="ic">{@html I.warn}</span><div><b>{s.active.length} peringatan menyala</b>{#each s.active as a}<span>{a.message} · sejak {ago(a.since, CLOCK.now)}</span>{/each}</div></div>
  {:else}
    <div class="bar okbar"><span class="dot"></span><b>Semua normal</b><span>Tidak ada peringatan aktif · menyala {dur(s.app.uptimeSec)} · host <span class="mono">{s.sys.host}</span></span></div>
  {/if}

  <div class="gauges">
    {#each gauges as g (g.k)}
      <div class="card gauge">
        <div class="gh">
          <span class="ring">{@html ring(g.pct, col(g.tone))}<i>{g.ring}</i></span>
          <div class="gt"><small>{@html (I as any)[g.icon]} {g.t}</small><b>{g.big}</b></div>
        </div>
        <Bar value={g.pct} tone={g.tone as any} h={7} label={g.t} />
        <ul>{#each g.sub as x}<li>{x}</li>{/each}</ul>
        <div class="spark" title="1 jam terakhir">{@html g.sp}</div>
      </div>
    {/each}
  </div>

  <div class="cols">
    <Section title="Aplikasi" sub="Proses Node.js yang menjalankan game" prefKey="srv-app">
      <div class="app">
        {#each APP as a (a.l)}
          <div class="am"><small>{a.l}</small><b>{a.v}</b><span>{a.sub}</span>{#if a.bar}<Bar value={a.bar} tone={a.t as any} h={4} label={a.l} />{/if}</div>
        {/each}
      </div>
    </Section>
    <Section title="Pemain saat ini" sub="Online = membuka game dalam 2,5 menit terakhir" prefKey="srv-players">
      <div class="now"><b>{num(s.players.online)}</b><span>online · puncak 24 jam {num(s.players.peak)}</span></div>
      {#if whereSum}
        <div class="seg" aria-label="Sebaran pemain">{#each WHERE as w}{#if w.n}<i style="flex:{w.n};background:{w.c}" title="{w.l} {w.n}"></i>{/if}{/each}</div>
      {:else}<div class="seg"><i style="flex:1;background:#E8ECE9"></i></div>{/if}
      <ul class="leg">{#each WHERE as w}<li><i style="background:{w.c}"></i>{w.l} <b>{num(w.n)}</b></li>{/each}</ul>
      <div class="kv2">
        <span>Main bareng berjalan</span><b>{num(s.players.bareng.playing)} sesi{s.players.bareng.open > s.players.bareng.playing ? ` (+${s.players.bareng.open - s.players.bareng.playing} menunggu)` : ''}</b>
        <span>Alun-alun terisi</span><b>{num(s.players.squares)} lapangan</b>
        <span>Antrean email / WhatsApp</span><b>{num(s.players.queue.email ?? 0)} / {num(s.players.queue.whatsapp ?? 0)}</b>
      </div>
    </Section>
  </div>

  <Section title="Riwayat" sub="CPU, memori & pemain online" prefKey="srv-hist">
    {#snippet actions()}<Tabs tabs={[{ k: '1j', label: '1 jam' }, { k: '24j', label: '24 jam' }, { k: '7h', label: '7 hari' }, { k: '30h', label: '30 hari' }]} active={range} onchange={setRange} />{/snippet}
    {#if chart}
      <div class="chart">
        <svg viewBox="0 0 {W} {H}" preserveAspectRatio="none" role="img" aria-label="Grafik riwayat CPU, memori dan pemain online">
          {#each [0.25, 0.5, 0.75, 1] as f}<line x1="0" x2={W} y1={H - f * (H - 12)} y2={H - f * (H - 12)} stroke="#ECEFEC" vector-effect="non-scaling-stroke" />{/each}
          <line x1="0" x2={W} y1={chart.thr} y2={chart.thr} stroke="#D4553A" stroke-dasharray="6 6" stroke-opacity=".6" vector-effect="non-scaling-stroke" />
          <polyline points={chart.mem} fill="none" stroke="#3F7FBF" stroke-width="2.2" vector-effect="non-scaling-stroke" />
          <polyline points={chart.cpu} fill="none" stroke="#1E7A63" stroke-width="2.2" vector-effect="non-scaling-stroke" />
          <polyline points={chart.on} fill="none" stroke="#E3A21A" stroke-width="2.2" vector-effect="non-scaling-stroke" />
        </svg>
        <div class="thr" style="top:{(chart.thr / H) * 100}%">batas CPU {s.settings.rules.cpu.pct}%</div>
        <div class="ticks">{#each chart.ticks as t}<span>{t.l}</span>{/each}</div>
      </div>
      <ul class="leg">
        <li><i style="background:#1E7A63"></i>CPU (%)</li><li><i style="background:#3F7FBF"></i>Memori (%)</li><li><i style="background:#E3A21A"></i>Pemain online (skala 0–{chart.maxOn})</li>
        <li class="muted">Puncak pemain {chart.fmt(chart.peak.t)} · {num(chart.peak.online)} · CPU tertinggi {dec(chart.peakCpu.cpu)}%</li>
      </ul>
    {:else}
      <Empty icon="clock" title="Riwayat belum cukup" text={range === '7h' || range === '30h' ? 'Rata-rata 5 menit disimpan ke database; grafik 7 & 30 hari terisi seiring waktu.' : 'Sampel diambil tiap 10 detik; tunggu sebentar.'} />
    {/if}
  </Section>

  <div class="cols">
    <Section title="Penyimpanan" sub="Disk server {bytes(s.disk.total)}" prefKey="srv-disk">
      <div class="seg big" aria-label="Pemakaian disk"><i style="flex:{s.disk.used};background:{col(gauges[2]?.tone ?? 'ok')}" title="Terpakai {bytes(s.disk.used)}"></i><i style="flex:{Math.max(0, s.disk.total - s.disk.used)};background:#E8ECE9"></i></div>
      <ul class="leg"><li><i style="background:{col(gauges[2]?.tone ?? 'ok')}"></i>Terpakai <b>{bytes(s.disk.used)}</b></li><li><i style="background:#E8ECE9;border:1px solid #CBD3CE"></i>Sisa <b>{bytes(s.disk.total - s.disk.used)}</b></li>
        <li><i style="background:#8A5CC0"></i>Database <b>{bytes(s.db.size)}</b></li><li><i style="background:#E3A21A"></i>Media unggahan <b>{bytes(s.db.media)}</b></li></ul>
      <h4>Tabel database terbesar</h4>
      <div class="tbl"><table><thead><tr><th>Tabel</th><th class="num">Ukuran</th><th class="num" title="Perkiraan">Baris</th></tr></thead>
        <tbody>{#each s.db.tables as r (r.name)}<tr><td class="mono">{r.name}</td><td class="num">{bytes(r.bytes)}</td><td class="num">{num(r.rows)}</td></tr>{/each}</tbody></table></div>
    </Section>
    <Section title="Endpoint paling lambat" sub="1 jam terakhir, urut p95" prefKey="srv-slow">
      {#if s.slow.length}
        <div class="tbl"><table><thead><tr><th>Endpoint</th><th class="num">Permintaan</th><th class="num">p95</th><th class="num">Error</th></tr></thead>
          <tbody>{#each s.slow as r (r.route)}<tr><td class="mono route">{r.route}</td><td class="num">{num(r.n)}</td><td class="num"><span class="chip {r.p95 > 1000 ? 'no' : r.p95 > 300 ? 'warn' : ''}">{num(r.p95)} ms</span></td><td class="num">{num(r.err)}</td></tr>{/each}</tbody></table></div>
      {:else}<p class="muted">Belum ada permintaan tercatat sejak server menyala.</p>{/if}
      {#if s.errors.length}
        <h4>Error terakhir</h4>
        <ul class="errs">{#each s.errors.slice(0, 5) as e}<li><span class="chip no">{e.status}</span><span class="mono">{e.method} {e.route}</span>{#if e.msg}<span class="muted">{e.msg}</span>{/if}<small>{ago(e.at, CLOCK.now)}</small></li>{/each}</ul>
      {/if}
    </Section>
  </div>

  <Section title="Peringatan" sub="Dikirim ke owner bila ambang terlewati (jeda 30 menit per jenis)" prefKey="srv-alerts">
    {#snippet actions()}
      <button class="btn sm" onclick={sendTest} aria-busy={testing}>{@html I.send} Kirim tes</button>
      {#if dirty}<button class="btn sm" onclick={() => { form = JSON.parse(start); }}>Batal</button>{/if}
      <button class="btn sm primary" disabled={!dirty} aria-busy={saving} onclick={save}>Simpan</button>
    {/snippet}
    {#if form}
      <div class="cols in">
        <div class="rules">
          <div class="rule"><div><b>CPU tinggi</b><small>di atas <input type="number" min="30" max="100" bind:value={form.rules.cpu.pct} aria-label="Batas CPU (%)" />% selama <input type="number" min="1" max="60" bind:value={form.rules.cpu.mins} aria-label="Lama (menit)" /> menit</small></div><Switch bind:checked={form.rules.cpu.on} ariaLabel="CPU tinggi" /></div>
          <div class="rule"><div><b>Memori hampir penuh</b><small>di atas <input type="number" min="30" max="100" bind:value={form.rules.mem.pct} aria-label="Batas memori (%)" />%</small></div><Switch bind:checked={form.rules.mem.on} ariaLabel="Memori hampir penuh" /></div>
          <div class="rule"><div><b>Penyimpanan hampir penuh</b><small>di atas <input type="number" min="30" max="100" bind:value={form.rules.disk.pct} aria-label="Batas penyimpanan (%)" />%</small></div><Switch bind:checked={form.rules.disk.on} ariaLabel="Penyimpanan hampir penuh" /></div>
          <div class="rule"><div><b>Database lambat</b><small>kueri di atas <input type="number" min="20" max="10000" bind:value={form.rules.db.ms} aria-label="Batas kueri (ms)" /> ms</small></div><Switch bind:checked={form.rules.db.on} ariaLabel="Database lambat" /></div>
          <div class="rule"><div><b>Banyak error</b><small>error 5xx di atas <input type="number" min="0.1" max="100" step="0.1" bind:value={form.rules.err.pct} aria-label="Batas error (%)" />% dalam <input type="number" min="1" max="60" bind:value={form.rules.err.mins} aria-label="Lama (menit)" /> menit</small></div><Switch bind:checked={form.rules.err.on} ariaLabel="Banyak error" /></div>
          <div class="rule"><div><b>Server menyala ulang</b><small>kirim kabar setiap server restart / deploy</small></div><Switch bind:checked={form.rules.restart.on} ariaLabel="Server menyala ulang" /></div>
        </div>
        <div class="to">
          <h4>Kirim ke owner lewat</h4>
          <label class="inline"><input type="checkbox" bind:checked={form.send.email} /> Email {#if !s.recipients.emailReady}<span class="chip warn">email belum diatur</span>{/if}</label>
          <input class="in" type="email" placeholder="Kosong = semua owner ({s.recipients.owners.join(', ')})" bind:value={form.to.email} aria-label="Email penerima" />
          <label class="inline"><input type="checkbox" bind:checked={form.send.whatsapp} /> WhatsApp {#if !s.recipients.waReady}<span class="chip warn">WhatsApp belum diatur</span>{/if}</label>
          <input class="in" type="tel" placeholder="Nomor WhatsApp, mis. 0812xxxx" bind:value={form.to.wa} aria-label="Nomor WhatsApp penerima" />
          <label class="inline"><input type="checkbox" bind:checked={form.send.bell} /> Lonceng admin (angka merah di menu Server)</label>
          {#if !s.recipients.templateOn}<p class="help bad-text">Notifikasi "Peringatan server" dimatikan di Pusat notifikasi.</p>
          {:else}<p class="help">Teks & template WhatsApp Official diatur di <a href="#/notifcenter">Pusat notifikasi → Admin → Peringatan server</a>.</p>{/if}
          <h4>Riwayat peringatan</h4>
          {#if s.alerts.length}
            <ul class="hist">{#each s.alerts.slice(0, 8) as h (h.id)}<li class:on={!h.ended_at} class:blue={h.kind === 'restart'}><i></i><div><b>{h.message}</b><small>{KIND[h.kind] ?? h.kind} · {dt(h.started_at)}{h.ended_at && h.kind !== 'restart' ? ` · pulih ${dt(h.ended_at)}` : !h.ended_at ? ' · masih menyala' : ''}{h.notified ? ' · terkirim' : ''}</small></div></li>{/each}</ul>
          {:else}<p class="muted">Belum pernah ada peringatan.</p>{/if}
        </div>
      </div>
    {/if}
  </Section>

  <Section title="Info sistem" open={false} prefKey="srv-info">
    <dl class="kv">
      <dt>Host</dt><dd class="mono">{s.sys.host}</dd>
      <dt>Sistem operasi</dt><dd>{s.sys.os} · {s.sys.kernel} ({s.sys.arch})</dd>
      <dt>CPU & memori fisik</dt><dd>{s.sys.cores} inti · {bytes(s.sys.memTotalHost)}</dd>
      <dt>Batas container</dt><dd>{s.sys.limits.cpu ? `${dec(s.sys.limits.cpu)} CPU` : 'tanpa batas CPU'} · {s.sys.limits.mem ? bytes(s.sys.limits.mem) : 'tanpa batas memori'}</dd>
      <dt>Node.js</dt><dd>{s.sys.node} · PID {s.sys.pid} · {s.sys.env}</dd>
      <dt>Zona waktu</dt><dd>{s.sys.tz} · jam server {new Date(s.sys.time).toLocaleTimeString('id-ID')}</dd>
      <dt>Sistem menyala</dt><dd>{dur(s.sys.sysUptimeSec)}</dd>
      {#if s.sys.dataDir}<dt>Direktori data</dt><dd class="mono">{s.sys.dataDir}</dd>{/if}
    </dl>
  </Section>
{/if}

<style>
  .sel { width: auto; min-height: 36px; }
  .bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; border-radius: 12px; padding: 9px 14px; font-size: 13.5px; margin-bottom: 14px; }
  .okbar { background: #DFF5E8; border: 1px solid #B9E3CB; color: #1F6B46; }
  .okbar .dot { width: 10px; height: 10px; border-radius: 50%; background: #2FA36B; box-shadow: 0 0 0 4px #BFE8D2; flex: none; }
  .okbar > span { color: #2F7A55; }
  .warnbar { background: var(--warn-soft); border: 1px solid #EBCB85; color: var(--warn); align-items: flex-start; }
  .warnbar .ic { width: 20px; height: 20px; margin-top: 1px; }
  .warnbar div { display: flex; flex-direction: column; gap: 2px; } .warnbar span { color: #6E4C06; }
  .gauges { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 12px; margin-bottom: 14px; }
  .gauge { display: flex; flex-direction: column; gap: 9px; padding: 14px 16px; min-width: 0; }
  .gh { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .ring { position: relative; width: 58px; height: 58px; flex: none; }
  .ring :global(svg) { width: 100%; height: 100%; }
  .ring i { position: absolute; inset: 0; display: grid; place-items: center; font: 800 13px var(--display); font-style: normal; }
  .gt { display: flex; flex-direction: column; min-width: 0; }
  .gt small { display: flex; align-items: center; gap: 6px; color: var(--muted); font-weight: 700; font-size: 12.5px; text-transform: uppercase; letter-spacing: .04em; }
  .gt small :global(svg) { width: 15px; height: 15px; }
  .gt b { font: 800 22px var(--display); line-height: 1.1; overflow-wrap: anywhere; }
  .gauge ul { margin: 0; padding: 0; list-style: none; font-size: 12.5px; color: var(--muted); display: flex; flex-direction: column; gap: 2px; }
  .spark { height: 34px; } .spark :global(svg) { width: 100%; height: 100%; display: block; }
  .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); gap: 14px; margin-bottom: 14px; align-items: start; }
  .cols.in { margin: 0; }
  .app { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
  .am { display: flex; flex-direction: column; gap: 3px; background: #F8FAF8; border: 1px solid var(--line-soft); border-radius: 10px; padding: 9px 11px; min-width: 0; }
  .am small { font-size: 12px; color: var(--muted); font-weight: 700; } .am b { font: 800 19px var(--display); } .am span { font-size: 12px; color: var(--muted); }
  .now { display: flex; align-items: baseline; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; } .now b { font: 800 34px var(--display); color: var(--accent); } .now span { color: var(--muted); font-size: 13px; }
  .seg { display: flex; height: 12px; border-radius: 99px; overflow: hidden; gap: 2px; } .seg.big { height: 16px; }
  .seg i { display: block; min-width: 3px; }
  .leg { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 13px; }
  .leg li { display: flex; align-items: center; gap: 6px; } .leg i { width: 10px; height: 10px; border-radius: 3px; display: inline-block; flex: none; }
  .kv2 { display: grid; grid-template-columns: 1fr auto; gap: 6px 12px; margin-top: 14px; font-size: 13.5px; border-top: 1px solid var(--line-soft); padding-top: 10px; } .kv2 span { color: var(--muted); } .kv2 b { text-align: right; }
  .chart { position: relative; }
  .chart svg { width: 100%; height: 200px; display: block; }
  .chart .thr { position: absolute; right: 0; transform: translateY(-120%); font-size: 12px; color: #A93A27; background: rgba(255,255,255,.85); padding: 0 4px; border-radius: 4px; }
  .ticks { display: flex; justify-content: space-between; font-size: 12px; color: var(--muted); margin-top: 4px; }
  h4 { margin: 14px 0 6px; font-size: 12.5px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
  .tbl table { font-size: 13.5px; } td.mono { font-size: 12.5px; } td.route { white-space: nowrap; }
  .errs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; font-size: 13px; }
  .errs li { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; } .errs small { color: var(--muted); margin-left: auto; }
  .rules { display: flex; flex-direction: column; }
  .rule { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--line-soft); }
  .rule div { display: flex; flex-direction: column; gap: 2px; min-width: 0; } .rule small { color: var(--muted); font-size: 12.5px; display: flex; align-items: center; flex-wrap: wrap; gap: 4px; }
  .rule input { width: 68px; min-height: 28px; padding: 2px 6px; font-size: 13px; }
  .to { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .to h4 { margin-top: 0; } .to h4 ~ h4 { margin-top: 12px; }
  .to .in { max-width: 420px; }
  .hist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .hist li { display: flex; gap: 10px; align-items: flex-start; background: #F8FAF8; border: 1px solid var(--line-soft); border-radius: 10px; padding: 9px 11px; }
  .hist li i { width: 10px; height: 10px; border-radius: 50%; margin-top: 5px; flex: none; background: #9AA49F; }
  .hist li.on i { background: #E3A21A; box-shadow: 0 0 0 3px #F6E3B5; } .hist li.blue i { background: #3F7FBF; }
  .hist div { display: flex; flex-direction: column; min-width: 0; } .hist small { color: var(--muted); font-size: 12.5px; }
</style>
