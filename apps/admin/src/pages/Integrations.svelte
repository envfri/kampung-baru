<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { err, toast, dt } from '../lib/store.svelte';
  let d = $state<any>(null);
  onMount(async () => { try { d = await api.get('/api/admin/integrations'); } catch (e) { err(e); } });

  const ST: Record<string, [string, string]> = {
    ok: ['Aktif', ''], missing: ['Belum diisi', 'warn'], off: ['Tidak dipakai', 'mute'], warn: ['Perlu dicek', 'no'], info: ['Info', 'mute'],
  };
  async function copy(t: string, what = 'URL') {
    try { await navigator.clipboard.writeText(t); toast(`${what} disalin`); } catch { toast('Tidak bisa menyalin otomatis; salin manual dari kotaknya.', 'err'); }
  }
  /** Ringkasan teks untuk dibagikan ke tim (tanpa URL rahasia). */
  function asText(withSecret: boolean) {
    const lines = [`Integrasi & URL BUPI — ${d.publicUrl}`, ''];
    for (const it of d.items) {
      lines.push(`## ${it.name} [${ST[it.status]?.[0] ?? it.status}]`);
      for (const x of it.urls) lines.push(`- ${x.label}: ${x.secret && !withSecret ? '(rahasia — lihat admin → Integrasi & URL)' : x.url}`);
      if (it.where) lines.push(`  Tempel di: ${it.where}`);
      if (it.env.length) lines.push(`  .env: ${it.env.join(', ')}`);
      lines.push('');
    }
    return lines.join('\n');
  }
</script>

<div class="head">
  <div>
    <h1>Integrasi & URL</h1>
    <p class="muted">Semua alamat yang perlu didaftarkan di layanan luar (webhook pembayaran, WhatsApp, email, login), dibuat dari <span class="mono">PUBLIC_URL</span>. Klik untuk menyalin. Daftar yang sama untuk domain produksi ada di <span class="mono">INTEGRASI.md</span> di repo.</p>
  </div>
  {#if d}
    <div class="row">
      <button class="btn" onclick={() => copy(asText(false), 'Ringkasan')}>Salin ringkasan (tanpa rahasia)</button>
    </div>
  {/if}
</div>

{#if !d}
  <p class="muted">Memuat…</p>
{:else}
  {#if !d.https}<p class="warnbox">PUBLIC_URL belum memakai https:// ({d.publicUrl}). Webhook, notifikasi push, dan login Google butuh HTTPS. Di VPS, install.sh mengisi PUBLIC_URL=https://domain secara otomatis.</p>{/if}
  <div class="grid">
    {#each d.items as it (it.key)}
      <section class="card it" aria-labelledby={`h-${it.key}`}>
        <div class="row between">
          <h2 id={`h-${it.key}`}>{it.name}</h2>
          <span class="chip {ST[it.status]?.[1] ?? ''}">{ST[it.status]?.[0] ?? it.status}</span>
        </div>
        {#if it.note}<p class="muted small">{it.note}</p>{/if}
        {#each it.urls as x}
          <div class="url">
            <span class="lbl">{x.label}{#if x.secret} <span class="chip no">rahasia</span>{/if}</span>
            <div class="row nowrap">
              <input class="mono" readonly value={x.url} aria-label={x.label} onfocus={(e) => (e.target as HTMLInputElement).select()} />
              <button class="btn sm" onclick={() => copy(x.url)}>Salin</button>
            </div>
          </div>
        {/each}
        {#if it.where}<p class="where"><b>Tempel di:</b> {it.where}</p>{/if}
        {#if it.env.length}<p class="env"><b>.env:</b> {#each it.env as e, i}{i ? ' ' : ''}<code>{e}</code>{/each}</p>{/if}
        {#if it.lastEvent}<p class="muted small">Terakhir diterima: {it.lastEvent.type ?? '—'} · {dt(it.lastEvent.at)}</p>{/if}
      </section>
    {/each}
  </div>
{/if}

<style>
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 12px; }
  .head p { max-width: 760px; margin: 6px 0 0; }
  .warnbox { background: var(--danger-soft); color: var(--danger); border-radius: 10px; padding: 8px 12px; font-weight: 600; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 440px), 1fr)); gap: 12px; }
  .it { display: flex; flex-direction: column; gap: 10px; }
  .it h2 { font-size: 17px; }
  .it p { margin: 0; }
  .between { justify-content: space-between; }
  .url { display: flex; flex-direction: column; gap: 4px; }
  .lbl { font-size: 12.5px; font-weight: 600; color: var(--muted); }
  .nowrap { flex-wrap: nowrap; } .nowrap input { flex: 1; min-width: 0; }
  .where, .env { font-size: 13.5px; }
  code { font: 12.5px var(--mono); background: #F1F4F2; border-radius: 6px; padding: 1px 6px; display: inline-block; margin: 2px 0; }
  .small { font-size: 12.5px; }
</style>
