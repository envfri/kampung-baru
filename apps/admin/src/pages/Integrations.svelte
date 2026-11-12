<script lang="ts">
  // Integrasi & URL: semua alamat yang perlu didaftarkan di layanan luar, per layanan dalam bagian yang bisa dilipat,
  // dengan chip status, tombol salin untuk URL & nama variabel .env, dan ringkasan untuk dibagikan ke tim.
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { err, toast } from '../lib/store.svelte';
  import { I } from '../lib/icons';
  import PageHead from '../components/ui/PageHead.svelte';
  import Section from '../components/ui/Section.svelte';
  import Stat from '../components/ui/Stat.svelte';
  import Ago from '../components/ui/Ago.svelte';
  import Empty from '../components/ui/Empty.svelte';

  let d = $state<any>(null), updated = $state(0);
  let only = $state('');
  async function load() { try { d = await api.get('/api/admin/integrations'); updated = Date.now(); } catch (e) { err(e); } }
  onMount(load);

  const ST: Record<string, [string, string, string]> = {
    ok: ['Aktif', '', 'check'], missing: ['Belum diisi', 'warn', 'clock'], warn: ['Perlu dicek', 'no', 'warn'], off: ['Tidak dipakai', 'mute', 'x'], info: ['Info', 'mute', 'info'],
  };
  const TONE: Record<string, 'ok' | 'warn' | 'no' | 'blue'> = { ok: 'ok', missing: 'warn', warn: 'no', off: 'blue' };
  const counts = $derived(Object.fromEntries(Object.keys(ST).map((k) => [k, (d?.items ?? []).filter((it: any) => it.status === k).length])));
  const items = $derived((d?.items ?? []).filter((it: any) => !only || it.status === only));

  async function cp(t: string, msg: string) {
    try { await navigator.clipboard.writeText(t); toast(msg, 'info'); } catch { toast('Tidak bisa menyalin otomatis; salin manual dari kotaknya.', 'err'); }
  }
  /** nama variabel .env tanpa keterangan, mis. "ZEPAY_WEBHOOK_SECRET (opsional)" → "ZEPAY_WEBHOOK_SECRET" */
  const envName = (e: string) => e.replace(/\s*\(.*\)\s*$/, '').trim();
  /** ringkasan teks untuk dibagikan ke tim (tanpa URL rahasia) */
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

<PageHead title="Integrasi & URL" updated={updated} onrefresh={load}>
  <span>Alamat yang perlu didaftarkan di layanan luar (webhook pembayaran, WhatsApp, email, login), dibuat dari <span class="mono">PUBLIC_URL</span> · daftar yang sama ada di <span class="mono">INTEGRASI.md</span></span>
  {#snippet actions()}{#if d}<button class="btn" onclick={() => cp(asText(false), 'Ringkasan disalin (tanpa URL rahasia)')}>{@html I.copy}Salin ringkasan</button>{/if}{/snippet}
</PageHead>

{#if !d}
  <div class="stats">{#each Array(4) as _}<div class="card sk"><span class="skel" style="width:40%"></span><span class="skel" style="width:70%"></span></div>{/each}</div>
  {#each Array(3) as _}<div class="card sk"><span class="skel" style="width:25%"></span><span class="skel"></span></div>{/each}
{:else}
  {#if !d.https}<p class="alert"><span class="ic">{@html I.warn}</span><span>PUBLIC_URL belum memakai https:// ({d.publicUrl}). Webhook, notifikasi push, dan login Google butuh HTTPS. Di VPS, install.sh mengisi PUBLIC_URL=https://domain otomatis.</span></p>{/if}

  <div class="stats">
    {#each ['ok', 'missing', 'warn', 'off'] as k}
      <Stat icon={ST[k][2]} value={counts[k] ?? 0} label={ST[k][0]} tone={TONE[k]} onclick={() => (only = only === k ? '' : k)} active={only === k} />
    {/each}
  </div>
  {#if only}<p class="flt muted small">Hanya yang <b>{ST[only][0].toLowerCase()}</b> · <button class="link" onclick={() => (only = '')}>tampilkan semua</button></p>{/if}

  <div class="grid">
    {#each items as it (it.key)}
      <Section title={it.name} id={`int-${it.key}`} prefKey={`int:${it.key}`} open={it.status !== 'off'} dim={it.status === 'off'}>
        {#snippet badge()}<span class="chip {ST[it.status]?.[1] ?? ''}">{#if it.status === 'ok'}<span class="dot"></span>{/if}{ST[it.status]?.[0] ?? it.status}</span>{/snippet}
        {#if it.note}<p class="muted small">{it.note}</p>{/if}
        {#each it.urls as x}
          <div class="url">
            <span class="lbl">{x.label}{#if x.secret}<span class="chip no">rahasia</span>{/if}</span>
            <div class="cp">
              <input class="mono" readonly value={x.url} aria-label={x.label} onfocus={(e) => (e.target as HTMLInputElement).select()} />
              <button class="btn" onclick={() => cp(x.url, x.secret ? `${x.label} disalin (rahasia, jangan dibagikan)` : `${x.label} disalin`)}>{@html I.copy}<span class="hide-s">Salin</span></button>
              {#if !x.secret && /^https?:\/\//.test(x.url) && !/webhook/i.test(x.label) && !/[/=]:\w/.test(x.url)}<a class="btn icon" href={x.url} target="_blank" rel="noopener" aria-label="Buka {x.label}" title="Buka">{@html I.ext}</a>{/if}
            </div>
          </div>
        {/each}
        {#if it.where}<div class="where"><span class="ic">{@html I.pin}</span><span><b>Tempel di:</b> {it.where}</span></div>{/if}
        {#if it.env.length}
          <div class="env"><span class="lbl">Variabel .env</span>
            <span class="envs">
              {#each it.env as e}<button class="ev" onclick={() => cp(envName(e), `${envName(e)} disalin`)} title="Salin nama variabel"><code>{e}</code><span class="ic">{@html I.copy}</span></button>{/each}
            </span>
          </div>
        {/if}
        {#if it.lastEvent}<p class="muted small last"><span class="ic">{@html I.clock}</span>Terakhir diterima: {it.lastEvent.type ?? '—'} · <Ago t={it.lastEvent.at} /></p>{/if}
      </Section>
    {:else}
      <div class="card"><Empty title="Tidak ada integrasi dengan status ini" icon="plug" /></div>
    {/each}
  </div>
{/if}

<style>
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; }
  .sk { display: flex; flex-direction: column; gap: 10px; padding: 16px; }
  .small { font-size: 13px; margin: 0; }
  .flt { margin: -6px 0 0; }
  .alert { margin: 0; display: flex; gap: 8px; align-items: flex-start; background: var(--danger-soft); color: var(--danger); border-radius: 10px; padding: 9px 12px; font-weight: 600; font-size: 13.5px; }
  .alert .ic { width: 17px; height: 17px; margin-top: 1px; }
  .grid { columns: 2 440px; column-gap: 12px; }
  .grid > :global(*) { break-inside: avoid; margin-bottom: 12px; }
  .url { display: flex; flex-direction: column; gap: 4px; }
  .lbl { font-size: 12.5px; font-weight: 600; color: var(--muted); display: inline-flex; gap: 6px; align-items: center; }
  .cp { display: flex; gap: 6px; }
  .cp input { flex: 1; min-width: 0; font-size: 12.5px; }
  .where { display: flex; gap: 8px; align-items: flex-start; background: #F6F8F6; border-radius: 10px; padding: 8px 10px; font-size: 13.5px; }
  .where .ic { width: 15px; height: 15px; margin-top: 2px; color: var(--muted); }
  .env { display: flex; flex-direction: column; gap: 4px; }
  .envs { display: flex; flex-wrap: wrap; gap: 6px; }
  .ev { all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; background: #F1F4F2; border: 1px solid var(--line-soft); border-radius: 7px; padding: 2px 4px 2px 0; transition: border-color .15s, background .15s; }
  .ev:hover { border-color: var(--accent); background: var(--accent-soft); }
  .ev:focus-visible { outline: 3px solid #3F7FBF; }
  .ev .ic { width: 13px; height: 13px; color: var(--muted); }
  code { font: 12.5px var(--mono); padding: 1px 6px; }
  .last { display: flex; align-items: center; gap: 6px; }
  .last .ic { width: 14px; height: 14px; }
  .btn :global(svg) { width: 15px; height: 15px; }
  @media (max-width: 760px) {
    .stats { display: flex; overflow-x: auto; scrollbar-width: none; margin: 0 -14px; padding: 0 14px; }
    .stats > :global(.stat) { flex: none; min-width: 150px; }
    .hide-s { display: none; }
  }
</style>
