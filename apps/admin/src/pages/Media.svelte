<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { can, err, toast, dt } from '../lib/store.svelte';
  import { uploadFile } from '../lib/upload';
  let media = $state<any[]>([]);
  async function load() { try { media = (await api.get('/api/admin/media')).media; } catch (e) { err(e); } }
  onMount(load);
  async function up(e: Event) {
    for (const f of Array.from((e.target as HTMLInputElement).files ?? [])) { try { await uploadFile(f); } catch (x) { err(x); } }
    toast('Upload selesai'); load();
  }
  async function copy(id: string) { try { await navigator.clipboard.writeText(`/media/${id}`); toast('URL disalin'); } catch { toast(`/media/${id}`); } }
  async function rm(id: string) { try { await api.del(`/api/admin/media/${id}`); load(); } catch (e) { err(e); } }
</script>
<h1>Media</h1>
<p class="muted">Gambar untuk item, dinding, atau aksesori. PNG/WebP transparan paling bagus. Maksimal 512 KB per file. SVG yang berisi script ditolak.</p>
{#if can('admin')}<label>Unggah gambar<input type="file" multiple accept="image/png,image/webp,image/jpeg,image/svg+xml" onchange={up} style="max-width:360px" /></label>{/if}
<div class="grid">
  {#each media as m (m.id)}
    <figure>
      <img src="/media/{m.id}" alt={m.filename} loading="lazy" />
      <figcaption><b>{m.filename}</b><span>{Math.round(m.size / 1024)} KB · {dt(m.created_at)}</span>
        <span class="row"><button class="btn sm" onclick={() => copy(m.id)}>Salin URL</button>{#if can('admin')}<button class="btn sm danger" onclick={() => rm(m.id)}>Hapus</button>{/if}</span></figcaption>
    </figure>
  {:else}<p class="muted">Belum ada gambar.</p>{/each}
</div>
<style>
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; }
  figure { margin: 0; background: #fff; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; }
  img { width: 100%; height: 120px; object-fit: contain; background: repeating-conic-gradient(#EEF1EE 0 25%, #fff 0 50%) 0 0 / 16px 16px; }
  figcaption { padding: 8px; display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; word-break: break-all; }
  figcaption span { color: var(--muted); }
</style>
