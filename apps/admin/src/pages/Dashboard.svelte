<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { err, num, rp } from '../lib/store.svelte';
  let s = $state<any>(null);
  onMount(async () => { try { s = await api.get('/api/admin/stats'); } catch (e) { err(e); } });
  const FUNNEL: [string, string][] = [['signup', 'Daftar'], ['pet_created', 'Buat pet'], ['action', 'Rawat pet'], ['purchase', 'Belanja'], ['visit', 'Kunjungi teman'], ['race', 'Lomba karung'], ['fish', 'Memancing'], ['payment_paid', 'Beli Mutiara']];
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) + '%' : '—');
  // grafik batang sederhana untuk 14 hari terakhir
  function bars(series: any[], key: string) {
    const max = Math.max(1, ...series.map((d) => d[key]));
    const W = 560, H = 140, bw = W / series.length;
    let out = '';
    series.forEach((d, i) => {
      const h = (d[key] / max) * (H - 24);
      out += `<rect x="${i * bw + 3}" y="${H - 18 - h}" width="${bw - 6}" height="${Math.max(h, 1)}" rx="3" fill="#1E7A63"/>`;
      if (i % 2 === 0 || i === series.length - 1) out += `<text x="${i * bw + bw / 2}" y="${H - 4}" text-anchor="middle" font-size="10" fill="#5F6478">${d.day.slice(8)}/${d.day.slice(5, 7)}</text>`;
    });
    out += `<text x="0" y="10" font-size="10" fill="#5F6478">maks ${num(max)}</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" role="img">${out}</svg>`;
  }
</script>

<h1>Dasbor</h1>
{#if !s}<p class="muted">Memuat…</p>{:else}
  <div class="kpis">
    <div class="kpi"><span>Pemain aktif hari ini</span><b>{num(s.dau)}</b><em>{num(s.wau)} dalam 7 hari</em></div>
    <div class="kpi"><span>Total pemain</span><b>{num(s.users)}</b><em>{num(s.guests)} tamu · +{num(s.newToday)} hari ini</em></div>
    <div class="kpi"><span>Retensi hari ke-1</span><b>{pct(s.d1.back, s.d1.cohort)}</b><em>{s.d1.back} dari {s.d1.cohort} pendaftar kemarin</em></div>
    <div class="kpi"><span>Pendapatan 30 hari</span><b>{rp(s.revenue30)}</b><em>total {rp(s.revenue)} · {num(s.paidCount)} transaksi</em></div>
    <div class="kpi"><span>Koin beredar</span><b>{num(s.coins)}</b><em>{num(s.pearls)} Mutiara di dompet pemain</em></div>
  </div>
  <div class="grid2 charts">
    <div class="card"><h3>Pemain aktif per hari</h3>{@html bars(s.series, 'dau')}</div>
    <div class="card"><h3>Pendaftar baru per hari</h3>{@html bars(s.series, 'signups')}</div>
  </div>
  <div class="grid2">
    <div class="card">
      <h3>Funnel 30 hari (pemain unik)</h3>
      <table class="funnel">
        <tbody>
          {#each FUNNEL as [k, l]}
            {@const v = s.funnel[k] ?? 0}
            <tr><td>{l}</td><td class="bar"><i style="width:{s.funnel.signup ? (v / s.funnel.signup) * 100 : 0}%"></i></td><td class="num">{num(v)}</td><td class="num muted">{pct(v, s.funnel.signup ?? 0)}</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
    <div class="card">
      <h3>Item terlaris 7 hari</h3>
      {#if s.topItems.length}<ol>{#each s.topItems as t}<li><span class="mono">{t.item}</span> <b>{num(t.n)}×</b></li>{/each}</ol>{:else}<p class="muted">Belum ada pembelian.</p>{/if}
    </div>
  </div>
{/if}

<style>
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; }
  .kpi { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 14px 16px; display: flex; flex-direction: column; gap: 2px; }
  .kpi span { font-size: 12.5px; color: var(--muted); font-weight: 600; }
  .kpi b { font-family: var(--display); font-size: 30px; font-variant-numeric: tabular-nums; line-height: 1.1; }
  .kpi em { font-style: normal; font-size: 12.5px; color: var(--muted); }
  .card { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  .card :global(svg) { width: 100%; height: auto; display: block; }
  .funnel { width: 100%; } .funnel td { border: 0; padding: 4px 6px; }
  .bar { width: 50%; } .bar i { display: block; height: 12px; background: var(--accent); border-radius: 6px; min-width: 2px; }
  ol { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px; }
  ol li { display: flex; justify-content: space-between; }
</style>
