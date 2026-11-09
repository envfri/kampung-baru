<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { err, toast } from '../lib/store.svelte';
  let words = $state<string[]>([]), w = $state('');
  async function load() { try { words = (await api.get('/api/admin/banned-words')).words; } catch (e) { err(e); } }
  onMount(load);
  async function add(e: Event) { e.preventDefault(); try { await api.post('/api/admin/banned-words', { word: w }); w = ''; toast('Kata ditambahkan'); load(); } catch (e) { err(e); } }
  async function rm(x: string) { try { await api.del(`/api/admin/banned-words/${encodeURIComponent(x)}`); load(); } catch (e) { err(e); } }
</script>
<h1>Moderasi kata</h1>
<p class="muted">Nama pet/pemain yang mengandung kata ini ditolak (termasuk variasi angka seperti 4 → a). Di pesan hadiah, kata ini disensor menjadi ***.</p>
<form class="row" onsubmit={add}><input bind:value={w} placeholder="Tambah kata" style="max-width:260px" aria-label="Kata" /><button class="btn primary" disabled={w.length < 2}>Tambah</button></form>
<div class="words">{#each words as x}<span class="w">{x}<button aria-label="Hapus {x}" onclick={() => rm(x)}>×</button></span>{/each}</div>
<style>
  .words { display: flex; flex-wrap: wrap; gap: 8px; }
  .w { display: inline-flex; align-items: center; gap: 4px; background: #fff; border: 1px solid var(--line); border-radius: 999px; padding: 3px 4px 3px 12px; font-family: var(--mono); font-size: 13px; }
  .w button { border: 0; background: #F1F4F2; border-radius: 50%; width: 22px; height: 22px; cursor: pointer; }
</style>
