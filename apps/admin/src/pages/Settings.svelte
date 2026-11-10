<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { can, err, toast } from '../lib/store.svelte';
  let value = $state<any>(null), help = $state<any>({}), defaults = $state<any>({});
  let busy = $state(false);
  let jsonErr = $state<Record<string, string>>({});
  const editable = $derived(can('admin'));
  const TITLE: Record<string, string> = { economy: 'Ekonomi', needs: 'Kebutuhan pet', actions: 'Aksi di rumah', social: 'Sosial', daily: 'Hadiah harian', karung: 'Lomba Karung', fishing: 'Kolam Pancing', garden: 'Kebun', room: 'Ruangan', starter: 'Barang awal pemain baru', features: 'Fitur & login', notify: 'Notifikasi otomatis', quests: 'Tugas', email: 'Email notifikasi' };
  onMount(async () => { try { const r = await api.get('/api/admin/settings'); value = r.value; help = r.help; defaults = r.defaults; } catch (e) { err(e); } });

  // daftar field datar untuk satu bagian (angka/boolean), objek kompleks diedit sebagai JSON
  function entries(obj: any, prefix = ''): [string, any][] {
    const out: [string, any][] = [];
    for (const [k, v] of Object.entries(obj ?? {})) {
      const p = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v) && !(prefix === '' && k === 'inventory')) out.push(...entries(v, p));
      else out.push([p, v]);
    }
    return out;
  }
  const get = (o: any, p: string) => p.split('.').reduce((a, k) => a?.[k], o);
  function set(o: any, p: string, v: any) { const ks = p.split('.'); let c = o; for (const k of ks.slice(0, -1)) c = c[k]; c[ks[ks.length - 1]] = v; }
  function setJson(sec: string, path: string, text: string) {
    try { set(value[sec], path, JSON.parse(text)); delete jsonErr[sec + path]; } catch { jsonErr[sec + path] = 'JSON tidak valid'; }
  }
  async function save() {
    if (Object.keys(jsonErr).length) { toast('Perbaiki isian JSON yang merah dulu.', 'err'); return; }
    busy = true;
    try { const r = await api.put('/api/admin/settings', { value }); value = r.value; toast('Pengaturan tersimpan. Berlaku untuk pemain dalam ±15 detik.'); } catch (e) { err(e); } finally { busy = false; }
  }
  const label = (p: string) => p.replace(/\./g, ' › ');
</script>

<div class="head">
  <div><h1>Ekonomi & fitur</h1><p class="muted">Atur angka permainan tanpa deploy. Nilai kosong kembali ke bawaan.</p></div>
  {#if editable}<button class="btn primary" disabled={busy || !value} onclick={save}>Simpan semua</button>{/if}
</div>
{#if value}
  <div class="secs">
    {#each Object.keys(value) as sec}
      <section class="card">
        <h2>{TITLE[sec] ?? sec}</h2>
        {#if help[sec]}<p class="muted">{help[sec]}</p>{/if}
        <div class="fields">
          {#each entries(value[sec]) as [path, v]}
            {#if typeof v === 'boolean'}
              <label class="inline"><input type="checkbox" checked={v} disabled={!editable} onchange={(e) => set(value[sec], path, (e.target as HTMLInputElement).checked)} />{label(path)}</label>
            {:else if typeof v === 'number'}
              <label>{label(path)}<input type="number" step="any" value={v} disabled={!editable} oninput={(e) => set(value[sec], path, Number((e.target as HTMLInputElement).value))} /><span class="help">bawaan: {get(defaults[sec], path)}</span></label>
            {:else}
              <label class="wide">{label(path)}<textarea class="mono" class:bad={jsonErr[sec + path]} disabled={!editable} oninput={(e) => setJson(sec, path, (e.target as HTMLTextAreaElement).value)}>{JSON.stringify(v, null, 1)}</textarea>{#if jsonErr[sec + path]}<span class="help bad">{jsonErr[sec + path]}</span>{/if}</label>
            {/if}
          {/each}
        </div>
      </section>
    {/each}
  </div>
{/if}

<style>
  .head { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; position: sticky; top: 0; background: var(--bg); padding: 6px 0; z-index: 5; }
  .head p { margin: 4px 0 0; }
  .secs { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); gap: 14px; }
  section { display: flex; flex-direction: column; gap: 8px; }
  section p { margin: 0; }
  .fields { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; }
  .wide { grid-column: 1 / -1; }
  textarea.bad { border-color: var(--danger); } .bad { color: var(--danger); }
</style>
