<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { A, can, err, num, rp, rpShort, short, ago, pref, savePref } from '../lib/store.svelte';
  import { CLOCK } from '../lib/clock.svelte';
  import { I } from '../lib/icons';
  import PageHead from '../components/ui/PageHead.svelte';
  import Bar from '../components/ui/Bar.svelte';
  import Empty from '../components/ui/Empty.svelte';

  let s = $state<any>(null), updated = $state(0), days = $state(14), auto = $state(true);
  async function load(quiet = false) {
    try { s = await (quiet ? api.quiet : api.get)(`/api/admin/dashboard?days=${days}`); updated = Date.now(); } catch (e) { if (!quiet) err(e); }
  }
  onMount(() => {
    days = pref('dash:days', 14); auto = pref('dash:auto', true);
    load();
    const t = setInterval(() => { if (auto && !document.hidden) load(true); }, 60_000);
    return () => clearInterval(t);
  });
  function setDays(n: number) { days = n; savePref('dash:days', n); load(); }

  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  /** tren: persen perubahan; null bila pembanding 0 */
  const trend = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : a ? null : 0);
  function spark(vals: number[], col: string) {
    if (vals.length < 2) return '';
    const max = Math.max(...vals), min = Math.min(...vals);
    const pts = vals.map((v, i) => `${((i * 100) / (vals.length - 1)).toFixed(1)},${(28 - ((v - min) / (max - min || 1)) * 24).toFixed(1)}`).join(' ');
    return `<svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
  }
  const kpis = $derived.by(() => {
    if (!s) return [];
    const k = s.k, ser = s.series as any[];
    const d1 = pct(s.d1.back, s.d1.cohort), d1p = pct(s.d1prev.back, s.d1prev.cohort);
    const flow = (s.coinFlow as any[]).map((x) => x.net);
    const out = [
      { l: 'Pemain aktif hari ini', v: num(k.dau), t: trend(k.dau, k.dau_yday), unit: '%', sub: `vs kemarin ${num(k.dau_yday)} · 7 hari ${num(k.wau)}`, sp: spark(ser.map((x) => x.dau), '#1E7A63'), href: '#/players?active=today' },
      { l: 'Pendaftar baru', v: num(k.new_today), t: trend(k.new_today, k.new_yday), unit: '%', sub: `vs kemarin ${num(k.new_yday)} · ${pct(k.pets_today, k.new_today)}% buat pet`, sp: spark(ser.map((x) => x.signups), '#E3A21A'), href: '#/players?joined=today' },
      { l: 'Retensi hari ke-1', v: s.d1.cohort ? d1 + '%' : '—', t: s.d1.cohort && s.d1prev.cohort ? d1 - d1p : null, unit: ' poin', sub: s.d1.cohort ? `${s.d1.back} dari ${s.d1.cohort} pendaftar kemarin` : 'Belum ada pendaftar kemarin', bar: d1 },
      { l: `Pendapatan ${days === 1 ? 'hari ini' : days + ' hari'}`, v: rpShort(s.money.rev), t: trend(s.money.rev, s.money.rev_prev), unit: '%', sub: `${num(s.money.n)} transaksi${s.money.n ? ' · rata-rata ' + rp(s.money.rev / s.money.n) : ''}`, sp: spark(ser.map((x) => x.revenue), '#9A6FC0'), href: can('admin') ? '#/payments?status=paid' : '' },
      { l: 'Koin beredar', v: short(k.coins), t: flow.length > 1 ? trend(flow[flow.length - 1], flow[flow.length - 2]) : null, unit: '%', sub: `${num(k.pearls)} Mutiara di dompet pemain`, sp: spark(flow, '#E0583F'), note: 'koin bersih masuk per hari' },
    ];
    return out;
  });

  // grafik: pemain aktif (garis) + pendaftar (batang), tooltip saat kursor
  const W = 640, H = 210, PADL = 34, PADB = 24;
  let hover = $state<number | null>(null);
  const chart = $derived.by(() => {
    if (!s) return null;
    const ser = s.series as any[], n = ser.length;
    const maxA = Math.max(10, ...ser.map((x) => x.dau)), maxS = Math.max(5, ...ser.map((x) => x.signups));
    const step = niceStep(maxA);
    const top = Math.ceil(maxA / step) * step;
    const x = (i: number) => PADL + 8 + (i * (W - PADL - 20)) / Math.max(1, n - 1);
    const y = (v: number) => H - PADB - (v / top) * (H - PADB - 14);
    const yb = (v: number) => (v / maxS) * (H - PADB - 14) * 0.45;
    const line = ser.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.dau).toFixed(1)}`).join('');
    const ticks = [0, 1, 2, 3, 4].map((i) => i * step).filter((v) => v <= top);
    const every = Math.ceil(n / 8);
    return { ser, n, x, y, yb, line, ticks, every, bw: Math.max(4, Math.min(16, (W - PADL) / n - 6)) };
  });
  function niceStep(max: number) { const raw = max / 4, p = Math.pow(10, Math.floor(Math.log10(raw))); const m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }
  const label = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return `${dd}/${m}`; };
  const dayName = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });
  function move(e: MouseEvent) {
    if (!chart) return;
    const r = (e.currentTarget as SVGElement).getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0, bd = 1e9;
    for (let i = 0; i < chart.n; i++) { const d = Math.abs(chart.x(i) - px); if (d < bd) { bd = d; best = i; } }
    hover = best;
  }

  const attention = $derived.by(() => {
    if (!s) return [];
    const a = s.attention, out: any[] = [];
    if (s.server.maintenance) out.push({ tone: 'danger', icon: 'warn', t: 'Mode perawatan aktif', sub: 'Pemain tidak bisa main sampai dimatikan', go: '#/site', act: 'Buka' });
    if (a.reports.c) out.push({ tone: 'danger', icon: 'shield', t: `${a.reports.c} laporan pemain belum ditangani`, sub: `Terlama ${ago(a.reports.oldest, CLOCK.now)}`, go: '#/moderation?tab=laporan', act: 'Tinjau' });
    if (can('admin') && a.pending.c) out.push({ tone: 'warn', icon: 'card', t: `${a.pending.c} pembayaran menunggu > 10 menit`, sub: `${rp(a.pending.amount)}${a.pending.expires ? ' · QR habis ' + ago(a.pending.expires, CLOCK.now) : ''}`, go: '#/payments?status=pending', act: 'Cek' });
    if (can('admin') && a.mailFailed) out.push({ tone: 'info', icon: 'mail', t: `${a.mailFailed} email gagal terkirim (24 jam)`, sub: 'Periksa alamat yang ditolak atau saldo Mailketing', go: '#/email', act: 'Lihat' });
    for (const e of a.events) {
      const st = new Date(e.starts_at).getTime(), en = new Date(e.ends_at).getTime();
      out.push({ tone: 'ok', icon: 'cal', t: `Event “${e.name}” berjalan`, sub: `Berakhir ${ago(e.ends_at, CLOCK.now)} · ${num(e.players)} peserta`, go: '#/events', act: 'Buka', bar: ((CLOCK.now - st) / (en - st)) * 100 });
    }
    return out;
  });
  const PLAYED: Record<string, string> = { coop: 'Masak & lempar bola', bareng_start: 'Congklak, ular tangga, karung live', race: 'Lomba karung', fish: 'Memancing', square_act: 'Aktivitas alun-alun', game_finish: 'Mini-game Balai Main', duel: 'Duel', visit_play: 'Main di rumah teman', photo: 'Foto bareng', harvest: 'Panen kebun' };
  const FUNNEL: [string, string][] = [['signup', 'Daftar'], ['pet_created', 'Buat pet'], ['action', 'Rawat pet'], ['purchase', 'Belanja'], ['visit', 'Kunjungi teman'], ['bareng_start', 'Main bareng'], ['race', 'Lomba karung'], ['fish', 'Memancing'], ['payment_paid', 'Beli Mutiara']];
  const up = (sec: number) => (sec < 3600 ? `${Math.max(1, Math.round(sec / 60))} menit` : sec < 86400 ? `${Math.floor(sec / 3600)} jam ${Math.round((sec % 3600) / 60)} menit` : `${Math.floor(sec / 86400)} hari ${Math.floor((sec % 86400) / 3600)} jam`);
</script>

<PageHead title="Dasbor" {updated} onrefresh={() => load()} live={!!s}>
  {#if s}{num(s.k.online)} pemain online sekarang{/if}
  {#snippet actions()}
    <div class="seg" role="radiogroup" aria-label="Rentang waktu">
      {#each [[1, 'Hari ini'], [7, '7 hari'], [14, '14 hari'], [30, '30 hari'], [90, '90 hari']] as [n, l]}
        <button role="radio" aria-checked={days === n} class:on={days === n} onclick={() => setDays(n as number)}>{l}</button>
      {/each}
    </div>
    <label class="auto"><input type="checkbox" bind:checked={auto} onchange={() => savePref('dash:auto', auto)} />Auto 60 dtk</label>
  {/snippet}
</PageHead>

{#if !s}
  <div class="kpis">{#each Array(5) as _}<div class="card kpi"><span class="skel" style="width:60%"></span><span class="skel" style="width:40%;height:24px"></span><span class="skel" style="width:80%"></span></div>{/each}</div>
{:else}
  <div class="kpis">
    {#each kpis as k}
      <svelte:element this={k.href ? 'a' : 'div'} href={k.href || undefined} class="card kpi" class:lnk={!!k.href}>
        <span class="kl">{k.l}</span>
        <div class="kv2"><b>{k.v}</b>
          {#if k.t !== null && k.t !== undefined}<span class="chip {k.t > 0 ? '' : k.t < 0 ? 'no' : 'mute'}">{@html k.t > 0 ? I.arrowUp : k.t < 0 ? I.arrowDown : ''}{k.t === 0 ? 'tetap' : Math.abs(k.t) + k.unit}</span>{/if}
        </div>
        <span class="ks">{k.sub}</span>
        {#if k.sp}<span class="sp" title={k.note ?? ''}>{@html k.sp}</span>{:else if k.bar !== undefined}<Bar value={k.bar} tone="blue" h={8} label="Retensi" />{/if}
      </svelte:element>
    {/each}
  </div>

  <div class="row2">
    <section class="card chart">
      <h3>Pemain aktif & pendaftar <small>{chart?.n} hari terakhir</small><span class="lg"><i class="l1"></i>aktif<i class="l2"></i>daftar</span></h3>
      {#if chart}
        <svg viewBox="0 0 {W} {H}" role="img" aria-label="Grafik pemain aktif dan pendaftar per hari" onmousemove={move} onmouseleave={() => (hover = null)}>
          {#each chart.ticks as v}<line x1={PADL} x2={W - 8} y1={chart.y(v)} y2={chart.y(v)} stroke="#ECEFEC" /><text x={PADL - 6} y={chart.y(v) + 4} text-anchor="end" class="ax">{short(v)}</text>{/each}
          {#each chart.ser as p, i}<rect x={chart.x(i) - chart.bw / 2} y={H - PADB - chart.yb(p.signups)} width={chart.bw} height={Math.max(1, chart.yb(p.signups))} rx="3" fill="#F2B632" opacity={hover === i ? 1 : 0.8} />{/each}
          <path d="{chart.line}L{chart.x(chart.n - 1)} {H - PADB}L{chart.x(0)} {H - PADB}z" fill="#1E7A63" opacity=".08" />
          <path d={chart.line} fill="none" stroke="#1E7A63" stroke-width="2.5" stroke-linejoin="round" />
          {#each chart.ser as p, i}<circle cx={chart.x(i)} cy={chart.y(p.dau)} r={hover === i ? 5 : 2.6} fill={hover === i ? '#fff' : '#1E7A63'} stroke="#1E7A63" stroke-width="2" />
            {#if i % chart.every === 0 || i === chart.n - 1}<text x={chart.x(i)} y={H - 6} text-anchor="middle" class="ax">{label(p.day)}</text>{/if}{/each}
          {#if hover !== null}
            {@const p = chart.ser[hover]}
            {@const tx = Math.min(W - 160, Math.max(PADL, chart.x(hover) - 75))}
            <line x1={chart.x(hover)} x2={chart.x(hover)} y1="10" y2={H - PADB} stroke="#2B2F4A" stroke-dasharray="3 3" opacity=".35" />
            <g transform="translate({tx},{Math.max(4, Math.min(H - PADB - 76, chart.y(p.dau) + 12))})" class="tip">
              <rect width="152" height={p.revenue ? 72 : 58} rx="9" fill="#2B2F4A" />
              <text x="10" y="18" fill="#B9C0D6" font-size="11">{dayName(p.day)}</text>
              <text x="10" y="35" fill="#fff" font-size="12.5" font-weight="700">{num(p.dau)} pemain aktif</text>
              <text x="10" y="50" fill="#F7C548" font-size="11.5">{num(p.signups)} pendaftar baru</text>
              {#if p.revenue}<text x="10" y="64" fill="#C9B6E8" font-size="11.5">{rp(p.revenue)}</text>{/if}
            </g>
          {/if}
        </svg>
      {/if}
    </section>
    <section class="card att">
      <h3>Perlu perhatian {#if attention.filter((x) => x.tone !== 'ok').length}<span class="chip no">{attention.filter((x) => x.tone !== 'ok').length}</span>{/if}</h3>
      {#each attention as a}
        <a class="ai" href={a.go}>
          <span class="aic {a.tone}">{@html (I as any)[a.icon]}</span>
          <span class="at"><b>{a.t}</b><small>{a.sub}</small>{#if a.bar !== undefined}<Bar value={a.bar} h={6} label="Waktu event berjalan" />{/if}</span>
          <span class="btn sm">{a.act}{@html I.right}</span>
        </a>
      {:else}<Empty icon="check" title="Semua aman" text="Tidak ada laporan, pembayaran macet, atau masalah lain saat ini." />{/each}
    </section>
  </div>

  <div class="row3">
    <section class="card">
      <h3>Funnel 30 hari <small>pemain unik</small></h3>
      {#each FUNNEL as [k, l]}
        {@const v = s.funnel[k] ?? 0}
        <div class="fr"><span>{l}</span><Bar value={v} max={Math.max(1, s.funnel.signup ?? 0)} h={10} label={l} /><b>{num(v)} <small>{pct(v, s.funnel.signup ?? 0)}%</small></b></div>
      {/each}
    </section>
    <section class="card">
      <h3>Paling dimainkan hari ini</h3>
      {#each s.played as p}
        <div class="fr"><span>{PLAYED[p.name] ?? p.name}</span><Bar value={p.n} max={s.played[0].n} tone="blue" h={10} label={p.name} /><b>{num(p.n)}</b></div>
      {:else}<Empty icon="play" title="Belum ada permainan hari ini" />{/each}
    </section>
    <section class="card">
      <h3>Server</h3>
      <dl class="kv">
        <dt>Versi</dt><dd><b>{s.server.version}</b>{#if s.server.commit}<span class="mono muted">{s.server.commit}</span>{/if}</dd>
        <dt>Berjalan</dt><dd>{up(s.server.uptimeSec)}</dd>
        <dt>Database</dt><dd><span class="chip">{s.server.dbMs < 200 ? 'Sehat' : 'Lambat'}</span>{s.server.dbMs} ms</dd>
        <dt>Alun-alun live</dt><dd>{s.server.square.instances} alun-alun · {num(s.server.square.people)} orang</dd>
        <dt>Total pemain</dt><dd>{num(s.k.users)} ({num(s.k.guests)} tamu)</dd>
        <dt>Mode perawatan</dt><dd>{#if s.server.maintenance}<span class="chip no">Aktif</span>{:else}<span class="chip mute">Mati</span>{/if}<a href="#/site">Atur</a></dd>
      </dl>
    </section>
  </div>
{/if}

<style>
  .seg { display: inline-flex; background: #E6EBE8; border-radius: 10px; padding: 3px; gap: 2px; flex-wrap: wrap; }
  .seg button { all: unset; cursor: pointer; padding: 5px 11px; border-radius: 8px; font-weight: 600; font-size: 13px; color: var(--muted); }
  .seg button.on { background: #fff; color: var(--ink); box-shadow: 0 1px 3px rgba(0,0,0,.12); }
  .seg button:focus-visible { outline: 2px solid #3F7FBF; }
  .auto { flex-direction: row; align-items: center; gap: 6px; font-weight: 600; font-size: 12.5px; color: var(--muted); }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; }
  .kpi { display: flex; flex-direction: column; gap: 4px; padding: 13px 15px; text-decoration: none; color: inherit; min-width: 0; transition: border-color .15s, box-shadow .15s, transform .15s; }
  .kpi.lnk:hover { border-color: #AEB8B2; box-shadow: 0 6px 16px rgba(43,47,74,.08); transform: translateY(-1px); }
  .kl { font-size: 12.5px; color: var(--muted); font-weight: 700; }
  .kv2 { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
  .kv2 b { font: 800 28px var(--display); line-height: 1.05; font-variant-numeric: tabular-nums; }
  .kv2 .chip :global(svg) { width: 11px; height: 11px; }
  .ks { font-size: 12.5px; color: var(--muted); }
  .sp { display: block; height: 30px; margin-top: 2px; } .sp :global(svg) { width: 100%; height: 100%; display: block; }
  .row2 { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr); gap: 12px; }
  .row3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .card { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  h3 { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  h3 small { font: 500 12.5px var(--body); color: var(--muted); }
  .lg { margin-left: auto; display: flex; align-items: center; gap: 6px; font: 600 12px var(--body); color: var(--muted); }
  .lg i { display: inline-block; } .lg .l1 { width: 12px; height: 3px; background: #1E7A63; } .lg .l2 { width: 10px; height: 10px; border-radius: 2px; background: #F2B632; margin-left: 6px; }
  .chart svg { width: 100%; height: auto; display: block; cursor: crosshair; }
  .ax { font-size: 10.5px; fill: #8A8FA3; }
  .tip { pointer-events: none; }
  .att { gap: 0; }
  .att h3 { margin-bottom: 4px; }
  .ai { display: flex; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--line-soft); color: inherit; text-decoration: none; }
  .ai:last-child { border-bottom: 0; }
  .ai:hover b { color: var(--accent); }
  .aic { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; padding: 8px; flex: none; }
  .aic :global(svg) { width: 100%; height: 100%; }
  .aic.danger { background: var(--danger-soft); color: var(--danger); } .aic.warn { background: var(--warn-soft); color: var(--warn); } .aic.info { background: var(--info-soft); color: var(--info); } .aic.ok { background: var(--accent-soft); color: var(--accent); }
  .at { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; } .at b { font-size: 14px; } .at small { color: var(--muted); font-size: 12.5px; }
  .ai .btn :global(svg) { width: 13px; height: 13px; }
  .fr { display: grid; grid-template-columns: minmax(80px, 34%) 1fr auto; gap: 10px; align-items: center; font-size: 13.5px; }
  .fr b { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; } .fr small { color: var(--muted); font-weight: 500; }
  .kv dd a { font-size: 13px; }
  @media (max-width: 1100px) { .row2, .row3 { grid-template-columns: 1fr; } }
  @media (max-width: 760px) { .kpis { grid-template-columns: 1fr 1fr; } .kv2 b { font-size: 23px; } }
</style>
