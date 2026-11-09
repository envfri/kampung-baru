<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { can, err, toast, getPath, setPath, toLocal, fromLocal } from '../lib/store.svelte';
  import Drawer from './Drawer.svelte';

  export interface Field { key: string; label: string; type?: 'text' | 'textarea' | 'number' | 'checkbox' | 'select' | 'datetime' | 'color'; options?: [string, string][]; help?: string; step?: string; required?: boolean }
  export interface Col { key: string; label: string; fmt?: (v: any, row: any) => string; num?: boolean }

  let { title, desc = '', endpoint, listKey, idKey = 'id', idOnCreate = true, columns, fields, blank, editMin = 'admin', deleteLabel = 'Hapus', preview, extra }: {
    title: string; desc?: string; endpoint: string; listKey: string; idKey?: string; idOnCreate?: boolean;
    columns: Col[]; fields: Field[]; blank: () => any; editMin?: 'moderator' | 'admin' | 'owner'; deleteLabel?: string;
    preview?: Snippet<[any]>; extra?: Snippet<[any[]]>;
  } = $props();

  let rows = $state<any[]>([]);
  let form = $state<any>(null);
  let creating = $state(false);
  let busy = $state(false);
  const editable = $derived(can(editMin));

  async function load() { try { rows = (await api.get(endpoint))[listKey]; } catch (e) { err(e); } }
  onMount(load);

  function open(row: any | null) {
    creating = !row;
    form = JSON.parse(JSON.stringify(row ?? blank()));
    for (const f of fields) if (f.type === 'datetime') setPath(form, f.key, toLocal(getPath(form, f.key)));
  }
  async function save() {
    busy = true;
    try {
      const body = JSON.parse(JSON.stringify(form));
      for (const f of fields) {
        if (f.type === 'datetime') setPath(body, f.key, fromLocal(getPath(form, f.key)));
        if (f.type === 'number') { const v = getPath(form, f.key); setPath(body, f.key, v === '' || v == null ? null : Number(v)); }
      }
      if (creating) await api.post(endpoint, body);
      else await api.put(`${endpoint}/${encodeURIComponent(form[idKey])}`, body);
      toast('Tersimpan');
      form = null;
      load();
    } catch (e) { err(e); } finally { busy = false; }
  }
  async function remove() {
    if (!confirmDel) { confirmDel = true; return; }
    busy = true;
    try { const r = await api.del(`${endpoint}/${encodeURIComponent(form[idKey])}`); toast(r?.message ?? 'Dihapus'); form = null; load(); } catch (e) { err(e); } finally { busy = false; confirmDel = false; }
  }
  let confirmDel = $state(false);
</script>

<div class="head">
  <div><h1>{title}</h1>{#if desc}<p class="muted">{desc}</p>{/if}</div>
  {#if editable}<button class="btn primary" onclick={() => open(null)}>Tambah</button>{/if}
</div>
{#if extra}{@render extra(rows)}{/if}
<div class="tbl">
  <table>
    <thead><tr>{#each columns as c}<th class:num={c.num}>{c.label}</th>{/each}</tr></thead>
    <tbody>
      {#each rows as r (r[idKey])}
        <tr class="click" onclick={() => open(r)}>
          {#each columns as c}<td class:num={c.num}>{@html c.fmt ? c.fmt(getPath(r, c.key), r) : String(getPath(r, c.key) ?? '')}</td>{/each}
        </tr>
      {:else}<tr><td colspan={columns.length} class="muted">Belum ada data.</td></tr>{/each}
    </tbody>
  </table>
</div>

{#if form}
  <Drawer title={creating ? `${title}: baru` : `${title}: ${form[idKey]}`} onclose={() => { form = null; confirmDel = false; }}>
    {#if preview}{@render preview(form)}{/if}
    {#if creating && idOnCreate}
      <label>ID<input bind:value={form[idKey]} placeholder="huruf-kecil-dan-tanda-hubung" disabled={!editable} /><span class="help">Dipakai di kode & URL. Tidak bisa diubah setelah dibuat.</span></label>
    {/if}
    {#each fields as f}
      {#if f.type === 'checkbox'}
        <label class="inline"><input type="checkbox" checked={!!getPath(form, f.key)} onchange={(e) => setPath(form, f.key, (e.target as HTMLInputElement).checked)} disabled={!editable} />{f.label}</label>
      {:else}
        <label>{f.label}
          {#if f.type === 'textarea'}<textarea value={getPath(form, f.key) ?? ''} oninput={(e) => setPath(form, f.key, (e.target as HTMLTextAreaElement).value)} disabled={!editable}></textarea>
          {:else if f.type === 'select'}<select value={getPath(form, f.key) ?? ''} onchange={(e) => setPath(form, f.key, (e.target as HTMLSelectElement).value)} disabled={!editable}>{#each f.options ?? [] as [v, l]}<option value={v}>{l}</option>{/each}</select>
          {:else if f.type === 'color'}<span class="row"><input type="color" value={getPath(form, f.key) ?? '#000000'} oninput={(e) => setPath(form, f.key, (e.target as HTMLInputElement).value)} disabled={!editable} /><span class="mono">{getPath(form, f.key) ?? ''}</span></span>
          {:else}<input type={f.type === 'number' ? 'number' : f.type === 'datetime' ? 'datetime-local' : 'text'} step={f.step} value={getPath(form, f.key) ?? ''} oninput={(e) => setPath(form, f.key, (e.target as HTMLInputElement).value)} disabled={!editable} />{/if}
          {#if f.help}<span class="help">{f.help}</span>{/if}
        </label>
      {/if}
    {/each}
    {#snippet footer()}
      {#if editable}
        {#if !creating}<button class="btn danger" disabled={busy} onclick={remove}>{confirmDel ? 'Yakin?' : deleteLabel}</button>{/if}
        <button class="btn primary" disabled={busy} onclick={save}>Simpan</button>
      {:else}<span class="muted">Hanya bisa dilihat (peran kamu tidak bisa mengubah).</span>{/if}
    {/snippet}
  </Drawer>
{/if}

<style>
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
  .head p { margin: 4px 0 0; max-width: 70ch; }
</style>
