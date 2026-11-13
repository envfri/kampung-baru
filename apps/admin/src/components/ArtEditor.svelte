<script lang="ts">
  import { onMount } from 'svelte';
  import { SEED_PICS, builtinCatalog } from '@kb/shared';
  import { api } from '../lib/api';
  import { A, err, toast } from '../lib/store.svelte';
  import { uploadFile } from '../lib/upload';
  // nama gambar hasil panen untuk jendela bungkus bibit
  const PIC_NAME = Object.fromEntries(['food', 'material'].flatMap((k) => (builtinCatalog() as any)[k] as any[]).map((b: any) => [b.key, b.label]));
  const picLabel = (k: string) => PIC_NAME[k] ?? k;
  let { kind, art = $bindable() }: { kind: string; art: any } = $props();
  const list = $derived((A.me?.builtins?.[kind] ?? []) as { key: string; label: string; colors: Record<string, string> }[]);
  const def = $derived(list.find((b) => b.key === art?.key));
  let media = $state<any[]>([]);
  onMount(async () => { try { media = (await api.get('/api/admin/media')).media; } catch { /* abaikan */ } });

  function setType(t: 'builtin' | 'image') {
    if (t === 'builtin') art = { type: 'builtin', key: list[0]?.key ?? 'kotak', colors: { ...(list[0]?.colors ?? {}) } };
    else art = { type: 'image', url: media[0] ? `/media/${media[0].id}` : '' };
  }
  function pick(key: string) {
    const b = list.find((x) => x.key === key);
    art = { type: 'builtin', key, colors: { ...(b?.colors ?? {}) }, ...(art.params ? { params: art.params } : {}) };
  }
  async function upload(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try { const r = await uploadFile(f); media = [{ id: r.id, filename: f.name }, ...media]; art = { ...art, type: 'image', url: r.url }; toast('Gambar diunggah'); } catch (e) { err(e); }
  }
  const LABEL: Record<string, string> = {
    main: 'Warna utama', accent: 'Warna aksen',
    // warna tambahan baju (Butik Benang)
    mid: 'Warna tengah bunga', pipe: 'Warna lis', line: 'Warna garis', shirt: 'Warna kemeja', leaf: 'Warna daun', jarik: 'Warna jarik', spike: 'Warna duri', inner: 'Warna dalam',
  };
</script>

<fieldset>
  <legend>Gambar</legend>
  <div class="seg">
    <button type="button" class:on={art?.type !== 'image'} onclick={() => setType('builtin')}>Bentuk bawaan</button>
    <button type="button" class:on={art?.type === 'image'} onclick={() => setType('image')}>Gambar upload</button>
  </div>
  {#if art?.type === 'image'}
    <label>URL gambar<input value={art.url} oninput={(e) => (art = { ...art, url: (e.target as HTMLInputElement).value })} placeholder="/media/abc.png" /></label>
    <label>Unggah gambar baru (PNG, WebP, JPG, SVG, maks 512 KB)<input type="file" accept="image/png,image/webp,image/jpeg,image/svg+xml" onchange={upload} /></label>
    {#if media.length}
      <div class="thumbs">
        {#each media.slice(0, 18) as m}<button type="button" class:on={art.url === `/media/${m.id}`} onclick={() => (art = { ...art, url: `/media/${m.id}` })} title={m.filename}><img src="/media/{m.id}" alt={m.filename} /></button>{/each}
      </div>
    {/if}
    {#if kind === 'furniture'}
      <div class="grid2">
        <label>Lebar tampil (px)<input type="number" value={art.w ?? ''} oninput={(e) => (art = { ...art, w: Number((e.target as HTMLInputElement).value) || undefined })} /></label>
        <label>Tinggi tampil (px)<input type="number" value={art.h ?? ''} oninput={(e) => (art = { ...art, h: Number((e.target as HTMLInputElement).value) || undefined })} /></label>
      </div>
      <span class="help">Gambar diletakkan dengan bagian bawah di sudut depan petak. Kosongkan untuk ukuran otomatis.</span>
    {/if}
  {:else}
    <label>Bentuk<select value={art?.key} onchange={(e) => pick((e.target as HTMLSelectElement).value)}>{#each list as b}<option value={b.key}>{b.label}</option>{/each}</select></label>
    <div class="colors">
      {#each Object.keys(def?.colors ?? {}) as c}
        <label class="inline"><input type="color" value={art.colors?.[c] ?? def?.colors[c]} oninput={(e) => (art = { ...art, colors: { ...art.colors, [c]: (e.target as HTMLInputElement).value } })} />{LABEL[c] ?? c}</label>
      {/each}
    </div>
    {#if art?.key === 'kotak'}
      <label>Tinggi kotak<input type="number" min="4" max="120" value={art.params?.height ?? 30} oninput={(e) => (art = { ...art, params: { ...art.params, height: Number((e.target as HTMLInputElement).value) } })} /></label>
    {/if}
    {#if art?.key === 'bibit'}
      <label>Gambar di bungkus<select value={art.params?.pic ?? 0} onchange={(e) => (art = { ...art, params: { ...art.params, pic: Number((e.target as HTMLSelectElement).value) } })}>{#each SEED_PICS as k, i}<option value={i}>{i ? (picLabel(k)) : 'Tunas (lama)'}</option>{/each}</select></label>
    {/if}
    {#if art?.key === 'ikan'}
      <label class="inline"><input type="checkbox" checked={!!art.params?.stripes} onchange={(e) => (art = { ...art, params: { ...art.params, stripes: (e.target as HTMLInputElement).checked ? 1 : 0 } })} />Bergaris</label>
    {/if}
  {/if}
</fieldset>

<style>
  fieldset { border: 1px solid var(--line); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 10px; margin: 0; }
  legend { font-weight: 700; padding: 0 6px; }
  .seg { display: flex; border: 1.5px solid var(--ink); border-radius: 9px; overflow: hidden; }
  .seg button { flex: 1; border: 0; background: #fff; padding: 7px; font-weight: 600; cursor: pointer; }
  .seg button.on { background: var(--ink); color: #fff; }
  .colors { display: flex; gap: 16px; flex-wrap: wrap; }
  .thumbs { display: grid; grid-template-columns: repeat(auto-fill, minmax(56px, 1fr)); gap: 6px; }
  .thumbs button { border: 1.5px solid var(--line); background: #F6F8F6; border-radius: 8px; padding: 3px; cursor: pointer; aspect-ratio: 1; }
  .thumbs button.on { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-soft); }
  .thumbs img { width: 100%; height: 100%; object-fit: contain; }
</style>
