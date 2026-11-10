<script lang="ts">
  // Aktivitas di rumah: pet memakai mebel (tidur di kasur, duduk di sofa, siram tanaman, ...) atau melihat
  // jendela/lukisan. Admin bisa menambah aktivitas baru, mengubah efek & jeda, atau mematikannya.
  import { onMount } from 'svelte';
  import { ACTIVITY_ANIMS, renderRoom, ROOM_VIEWBOX } from '@kb/shared';
  import { api } from '../lib/api';
  import { A, can, err, toast } from '../lib/store.svelte';
  import Drawer from '../components/Drawer.svelte';

  const NEEDS = ['kenyang', 'bersih', 'ceria', 'energi', 'berat'] as const;
  let list = $state<any[]>([]);
  let anims = $state<Record<string, string>>({});
  let spots = $state<Record<string, string>>({});
  let items = $state<any[]>([]);
  let form = $state<any>(null), creating = $state(false), busy = $state(false), confirmDel = $state(false);
  let addItem = $state('');
  const editable = $derived(can('admin'));
  const shapes = $derived<{ key: string; label: string }[]>(A.me?.builtins?.furniture ?? []);
  const furniture = $derived(items.filter((i) => i.kind === 'furniture'));

  async function load() {
    try {
      const [a, i] = await Promise.all([api.get('/api/admin/activities'), api.get('/api/admin/items')]);
      list = a.activities; anims = a.anims; spots = a.spots; items = i.items;
    } catch (e) { err(e); }
  }
  onMount(load);

  const label = (t: string) => {
    const [k, v] = t.split(':');
    if (k === 'spot') return spots[v] ?? v;
    if (k === 'item') return items.find((i) => i.id === v)?.name ?? v;
    return `Semua ${shapes.find((s) => s.key === v)?.label.toLowerCase() ?? v}`;
  };
  const eff = (e: Record<string, number>) => Object.entries(e ?? {}).map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${k}`).join(', ');
  const cd = (s: number) => (s >= 3600 ? `${Math.round(s / 360) / 10} jam` : s >= 60 ? `${Math.round(s / 6) / 10} mnt` : `${s} dtk`);

  function open(row: any | null) {
    creating = !row; confirmDel = false; addItem = '';
    const f = JSON.parse(JSON.stringify(row ?? { id: '', name: '', description: '', targets: [], anim: 'lihat', effects: { ceria: 5 }, xp: 1, coins: 0, reward_item: '', cooldown_sec: 300, daily_limit: 0, min_level: 1, message: '{pet} ... {item}.', active: true, sort: 1000 }));
    f.reward_item ??= '';
    for (const k of NEEDS) f.effects[k] ??= '';
    form = f;
  }
  function toggle(t: string) {
    form.targets = form.targets.includes(t) ? form.targets.filter((x: string) => x !== t) : [...form.targets, t];
  }
  async function save() {
    busy = true;
    try {
      const body = { ...form, reward_item: form.reward_item || null, effects: Object.fromEntries(Object.entries(form.effects).filter(([, v]) => v !== '' && v !== null && Number(v) !== 0).map(([k, v]) => [k, Number(v)])) };
      if (creating) await api.post('/api/admin/activities', body); else await api.put(`/api/admin/activities/${form.id}`, body);
      toast('Aktivitas tersimpan. Pemain melihat perubahan dalam ±15 detik.');
      form = null; load();
    } catch (e) { err(e); } finally { busy = false; }
  }
  async function remove() {
    if (!confirmDel) { confirmDel = true; return; }
    busy = true;
    try { await api.del(`/api/admin/activities/${form.id}`); toast('Aktivitas dihapus'); form = null; load(); } catch (e) { err(e); } finally { busy = false; }
  }

  // pratinjau: mebel target pertama + pet dalam pose aktivitasnya
  const preview = $derived.by(() => {
    if (!form) return '';
    const t: string | undefined = form.targets.find((x: string) => !x.startsWith('spot:'));
    const a = ACTIVITY_ANIMS[form.anim] ?? ACTIVITY_ANIMS.lihat;
    let it: any = null;
    if (t?.startsWith('item:')) it = items.find((i) => i.id === t.slice(5));
    else if (t?.startsWith('art:')) it = furniture.find((i) => i.art?.key === t.slice(4)) ?? { id: 'x', kind: 'furniture', name: '', art: { type: 'builtin', key: t.slice(4) }, data: { w: 1, d: 1 } };
    const w = Math.max(1, Number(it?.data?.w) || 1), d = Math.max(1, Number(it?.data?.d) || 1);
    const layout = it ? [{ i: it.id, x: 1, y: 1 }] : [];
    const pos: [number, number] = it && a.on ? [1 + w / 2, 1 + d / 2] : it ? [1 + w + 0.5, 1 + d / 2] : [1.5, 0.5];
    return renderRoom({ layout, items: it ? { [it.id]: it } : {}, size: 4, pet: { look: { color: '#F6B7A8', ear: 'tunas' }, wear: [], pos, lift: a.on ? a.lift : 0, pose: form.anim, prop: a.prop, flip: !it } });
  });
</script>

<div class="head">
  <div><h1>Aktivitas di rumah</h1><p class="muted">Pemain mengetuk mebel (atau jendela/lukisan), pet berjalan ke sana lalu beraktivitas. Atur mebel mana yang bisa dipakai, efeknya ke kebutuhan pet, hadiah, dan jeda antar pemakaian.</p></div>
  {#if editable}<button class="btn primary" onclick={() => open(null)}>Aktivitas baru</button>{/if}
</div>
<div class="tbl">
  <table>
    <thead><tr><th>Aktivitas</th><th>Dipakai di</th><th>Animasi</th><th>Efek & hadiah</th><th>Jeda</th><th>Status</th></tr></thead>
    <tbody>
      {#each list as a (a.id)}
        <tr class="click" onclick={() => open(a)}>
          <td><b>{a.name}</b><br /><span class="mono muted">{a.id}</span></td>
          <td>{a.targets.map(label).join(', ')}</td>
          <td>{anims[a.anim] ?? a.anim}</td>
          <td>{[eff(a.effects), a.xp && `${a.xp} XP`, a.coins && `${a.coins} koin`, a.reward_item && `+1 ${items.find((i) => i.id === a.reward_item)?.name ?? a.reward_item}`].filter(Boolean).join(' · ')}</td>
          <td>{cd(a.cooldown_sec)}{a.daily_limit ? ` · maks ${a.daily_limit}×/hari` : ''}</td>
          <td>{#if a.active}<span class="chip">Aktif</span>{:else}<span class="chip mute">Nonaktif</span>{/if}</td>
        </tr>
      {:else}<tr><td colspan="6" class="muted">Belum ada aktivitas.</td></tr>{/each}
    </tbody>
  </table>
</div>

{#if form}
  <Drawer wide title={creating ? 'Aktivitas baru' : form.name} onclose={() => (form = null)}>
    <div class="cols">
      <div class="formcol">
        {#if creating}<label>ID<input bind:value={form.id} placeholder="mis. main-gitar" /><span class="help">Huruf kecil, angka, tanda hubung. Tidak bisa diubah.</span></label>{/if}
        <div class="grid2">
          <label>Nama tombol<input bind:value={form.name} maxlength="30" placeholder="mis. Tidur" /></label>
          <label>Animasi<select bind:value={form.anim}>{#each Object.entries(anims) as [k, l]}<option value={k}>{l}</option>{/each}</select></label>
        </div>
        <fieldset>
          <legend>Bisa dilakukan di</legend>
          <span class="help">Pilih bentuk mebel (semua item dengan bentuk itu ikut), mebel tertentu, atau bagian ruangan.</span>
          <div class="chips">
            {#each Object.entries(spots) as [k, l]}<label class="pick"><input type="checkbox" checked={form.targets.includes('spot:' + k)} onchange={() => toggle('spot:' + k)} />{l}</label>{/each}
          </div>
          <div class="chips">
            {#each shapes as s}<label class="pick"><input type="checkbox" checked={form.targets.includes('art:' + s.key)} onchange={() => toggle('art:' + s.key)} />{s.label}</label>{/each}
          </div>
          <div class="row">
            <select bind:value={addItem} aria-label="Mebel tertentu"><option value="">+ Mebel tertentu…</option>{#each furniture as i}<option value={i.id}>{i.name}</option>{/each}</select>
            <button class="btn sm" type="button" disabled={!addItem} onclick={() => { if (!form.targets.includes('item:' + addItem)) form.targets = [...form.targets, 'item:' + addItem]; addItem = ''; }}>Tambah</button>
          </div>
          {#if form.targets.some((t: string) => t.startsWith('item:'))}
            <div class="chips">{#each form.targets.filter((t: string) => t.startsWith('item:')) as t}<span class="chip">{label(t)} <button type="button" class="x" onclick={() => toggle(t)} aria-label="Hapus">×</button></span>{/each}</div>
          {/if}
        </fieldset>
        <fieldset>
          <legend>Efek & hadiah</legend>
          <div class="grid4">{#each NEEDS as k}<label>{k}<input type="number" min="-100" max="100" bind:value={form.effects[k]} /></label>{/each}</div>
          <span class="help">berat negatif = olahraga (menurunkan berat badan pet yang gembul).</span>
          <div class="grid3">
            <label>XP<input type="number" min="0" bind:value={form.xp} /></label>
            <label>Koin<input type="number" min="0" bind:value={form.coins} /></label>
            <label>Hadiah barang<select bind:value={form.reward_item}><option value="">Tidak ada</option>{#each items.filter((i) => i.kind !== 'room') as i}<option value={i.id}>{i.name}</option>{/each}</select></label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Batas</legend>
          <div class="grid3">
            <label>Jeda (detik)<input type="number" min="0" bind:value={form.cooldown_sec} /><span class="help">{cd(Number(form.cooldown_sec) || 0)}</span></label>
            <label>Maks per hari<input type="number" min="0" bind:value={form.daily_limit} /><span class="help">0 = tanpa batas</span></label>
            <label>Level minimal<input type="number" min="1" bind:value={form.min_level} /></label>
          </div>
        </fieldset>
        <label>Pesan setelah selesai<input bind:value={form.message} maxlength="120" /><span class="help">{'{pet}'} = nama pet, {'{item}'} = nama mebel. Contoh: {'{pet}'} tidur nyenyak di {'{item}'}.</span></label>
        <div class="grid2">
          <label>Urutan<input type="number" bind:value={form.sort} /></label>
          <label class="inline"><input type="checkbox" bind:checked={form.active} />Aktif</label>
        </div>
      </div>
      <div class="prevcol">
        <h3>Pratinjau</h3>
        <div class="room"><svg viewBox={ROOM_VIEWBOX}>{@html preview}</svg></div>
        <p class="muted small">Tombol <b>{form.name || '…'}</b> muncul saat pemain mengetuk {form.targets.length ? form.targets.map(label).join(', ') : 'mebel yang dipilih'}.</p>
      </div>
    </div>
    {#snippet footer()}
      {#if editable}
        {#if !creating}<button class="btn danger" disabled={busy} onclick={remove}>{confirmDel ? 'Yakin hapus?' : 'Hapus'}</button>{/if}
        <button class="btn primary" disabled={busy} onclick={save}>Simpan</button>
      {:else}<span class="muted">Hanya bisa dilihat.</span>{/if}
    {/snippet}
  </Drawer>
{/if}

<style>
  .head { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: flex-start; }
  .head p { margin: 4px 0 0; max-width: 760px; }
  .cols { display: grid; grid-template-columns: 1fr 260px; gap: 18px; }
  @media (max-width: 760px) { .cols { grid-template-columns: 1fr; } }
  .formcol { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
  fieldset { border: 1px solid var(--line); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 10px; margin: 0; }
  legend { font-weight: 700; padding: 0 6px; }
  .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .grid4 { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
  @media (max-width: 560px) { .grid3, .grid4 { grid-template-columns: 1fr 1fr; } }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .pick { display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--line); border-radius: 999px; padding: 3px 10px; font-size: 13.5px; cursor: pointer; flex-direction: row; font-weight: 600; }
  .pick input { width: auto; margin: 0; }
  .x { border: 0; background: none; cursor: pointer; font-size: 15px; padding: 0 2px; }
  .prevcol { display: flex; flex-direction: column; gap: 10px; position: sticky; top: 0; align-self: start; }
  .room { background: linear-gradient(#D3E9DF, #B7D7CA); border-radius: 12px; }
  .room svg { display: block; width: 100%; }
  .small { font-size: 12.5px; }
</style>
