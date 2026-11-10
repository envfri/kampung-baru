<script lang="ts">
  import { onMount } from 'svelte';
  import { renderMap, eventDropSVG } from '@kb/shared';
  import { api } from '../lib/api';
  import { can, err, toast, dt, num, toLocal, fromLocal } from '../lib/store.svelte';
  import Drawer from '../components/Drawer.svelte';

  let data = $state<any>(null);
  let form = $state<any>(null);
  let creating = $state(false);
  let busy = $state(false);
  let confirmDel = $state(false);
  let tpl = $state('');
  const editable = $derived(can('admin'));
  const MINI_MAP = [
    { id: 'a', name: 'Pasar', kind: 'shop', x: 140, y: 205, enabled: true, style: { body: '#FDF1D6', roof: '#3FA06A' } },
    { id: 'b', name: 'Balai', kind: 'games', x: 330, y: 205, enabled: true, style: { body: '#E3F1DA', roof: '#E0583F' } },
  ];

  async function load() { try { data = await api.get('/api/admin/events'); } catch (e) { err(e); } }
  onMount(load);

  const now = Date.now();
  function status(e: any) {
    const s = new Date(e.starts_at).getTime(), en = new Date(e.ends_at).getTime();
    if (!e.active) return ['Nonaktif', 'mute'];
    if (now < s) return ['Terjadwal', 'warn'];
    if (now < en) return ['Berjalan', ''];
    return ['Selesai', 'mute'];
  }
  function open(e: any | null) {
    creating = !e; confirmDel = false; tpl = '';
    const f = JSON.parse(JSON.stringify(e ?? {
      id: '', name: '', description: '', starts_at: new Date().toISOString(), ends_at: new Date(Date.now() + 7 * 864e5).toISOString(),
      theme: { color: '#E0583F' }, bonus: { coinMultiplier: 1 }, active: true, decor: '', token_name: 'Poin event',
      points: { game_finish: 10, daily_claim: 10 }, milestones: [{ points: 50, coin: 100 }], repeat_yearly: false, notify_start: true,
    }));
    f.starts_at = toLocal(f.starts_at); f.ends_at = toLocal(f.ends_at);
    f.theme ??= { color: '#E0583F' }; f.bonus ??= { coinMultiplier: 1 }; f.points ??= {}; f.milestones ??= [];
    form = f;
  }
  function applyTemplate(key: string) {
    const t = data.templates.find((x: any) => x.key === key);
    if (!t || !form) return;
    const year = new Date().getFullYear();
    let start = new Date();
    if (t.start) { start = new Date(year, t.start[0] - 1, t.start[1], 0, 0); if (start.getTime() + t.days * 864e5 < Date.now()) start = new Date(year + 1, t.start[0] - 1, t.start[1]); }
    const end = new Date(start.getTime() + t.days * 864e5);
    Object.assign(form, {
      id: form.id || `${t.key}-${start.getFullYear()}`, name: t.name, description: t.description, decor: t.decor, token_name: t.tokenName,
      theme: { color: t.color }, bonus: { coinMultiplier: t.multiplier }, points: { ...t.points }, milestones: JSON.parse(JSON.stringify(t.milestones)),
      repeat_yearly: t.repeatYearly, starts_at: toLocal(start.toISOString()), ends_at: toLocal(end.toISOString()),
    });
    toast(t.start ? 'Template diterapkan. Periksa tanggalnya.' : 'Template diterapkan. Tanggal hari raya ini berubah tiap tahun, jadi atur tanggalnya manual.');
  }
  async function save() {
    busy = true;
    try {
      const body = { ...form, starts_at: fromLocal(form.starts_at), ends_at: fromLocal(form.ends_at), bonus: { coinMultiplier: Number(form.bonus.coinMultiplier) },
        milestones: form.milestones.map((m: any) => ({ points: Number(m.points), coin: Number(m.coin) || undefined, pearl: Number(m.pearl) || undefined, item: m.item || undefined, qty: m.item ? Number(m.qty) || 1 : undefined })) };
      // ID dari template ikut tahun tanggal mulai (mis. imlek-2027)
      if (creating && tpl && new RegExp(`^${tpl}-\\d{4}$`).test(body.id)) body.id = `${tpl}-${new Date(body.starts_at).getFullYear()}`;
      if (creating) await api.post('/api/admin/events', body); else await api.put(`/api/admin/events/${form.id}`, body);
      toast('Event tersimpan. Pemain melihatnya dalam ±15 detik.');
      form = null; load();
    } catch (e) { err(e); } finally { busy = false; }
  }
  async function remove() {
    if (!confirmDel) { confirmDel = true; return; }
    try { await api.del(`/api/admin/events/${form.id}`); toast('Event dihapus'); form = null; load(); } catch (e) { err(e); }
  }
  const setPoint = (k: string, v: string) => { const n = Number(v); if (n > 0) form.points[k] = n; else delete form.points[k]; };
  const itemName = (id: string) => data?.items.find((i: any) => i.id === id)?.name ?? id;
</script>

<div class="head">
  <div>
    <h1>Event musiman</h1>
    <p class="muted">Atur event seperti Agustusan, Ramadan, Lebaran, Imlek, atau Tahun Baru: dekorasi kampung, pengali koin, poin event dari aktivitas pemain, hadiah bertingkat, dan barang edisi terbatas (hubungkan item lewat menu Item › kolom Event).</p>
  </div>
  {#if editable}<button class="btn primary" onclick={() => open(null)}>Event baru</button>{/if}
</div>

{#if data}
  <div class="tbl"><table>
    <thead><tr><th>Event</th><th>Status</th><th>Jadwal</th><th>Dekorasi</th><th class="num">Peserta</th><th class="num">Total poin</th><th class="num">Hadiah diambil</th></tr></thead>
    <tbody>
      {#each data.events as e (e.id)}
        {@const st = status(e)}
        <tr class="click" onclick={() => open(e)}>
          <td><span class="dot" style="background:{e.theme?.color}"></span><b>{e.name}</b><br /><span class="mono muted">{e.id}{e.repeat_yearly ? ' · tiap tahun' : ''}</span></td>
          <td><span class="chip {st[1]}">{st[0]}</span></td>
          <td>{dt(e.starts_at)}<br /><span class="muted">s/d {dt(e.ends_at)}</span></td>
          <td>{data.decor.find((d: any) => d[0] === e.decor)?.[1] ?? '—'}</td>
          <td class="num">{num(e.participants)}</td><td class="num">{num(e.total_points)}</td><td class="num">{num(e.claims)}</td>
        </tr>
      {:else}<tr><td colspan="7" class="muted">Belum ada event.</td></tr>{/each}
    </tbody>
  </table></div>
{/if}

{#if form && data}
  <Drawer wide title={creating ? 'Event baru' : form.name} onclose={() => (form = null)}>
    {#if creating}
      <label>Mulai dari template
        <select bind:value={tpl} onchange={() => applyTemplate(tpl)}><option value="">Pilih template…</option>{#each data.templates as t}<option value={t.key}>{t.label}</option>{/each}</select>
      </label>
      <label>ID<input bind:value={form.id} placeholder="mis. agustusan-2027" /><span class="help">Huruf kecil, angka, tanda hubung.</span></label>
    {/if}
    <div class="cols">
      <div class="fcol">
        <div class="grid2">
          <label>Nama event<input bind:value={form.name} /></label>
          <label>Nama poin<input bind:value={form.token_name} placeholder="mis. Bendera, Ketupat, Angpau" /></label>
        </div>
        <label>Deskripsi<textarea bind:value={form.description} maxlength="300"></textarea></label>
        <div class="grid2">
          <label>Mulai<input type="datetime-local" bind:value={form.starts_at} /></label>
          <label>Selesai<input type="datetime-local" bind:value={form.ends_at} /></label>
          <label>Dekorasi kampung<select bind:value={form.decor}>{#each data.decor as [k, l]}<option value={k}>{l}</option>{/each}</select></label>
          <label>Warna tema<span class="row"><input type="color" bind:value={form.theme.color} /><span class="mono">{form.theme.color}</span></span></label>
          <label>Pengali hadiah koin<input type="number" step="0.05" min="1" max="5" bind:value={form.bonus.coinMultiplier} /></label>
        </div>
        <label class="inline"><input type="checkbox" bind:checked={form.repeat_yearly} />Ulangi otomatis tiap tahun (tanggal yang sama)</label>
        <label class="inline"><input type="checkbox" bind:checked={form.notify_start} />Kirim notifikasi ke pemain saat event dimulai</label>
        <label class="inline"><input type="checkbox" bind:checked={form.active} />Aktif</label>

        <fieldset>
          <legend>Poin event per aktivitas</legend>
          <p class="help">Kosongkan atau isi 0 untuk aktivitas yang tidak memberi poin.</p>
          <div class="pts">
            {#each data.sources as [k, l]}
              <label class="pt"><span>{l}</span><input type="number" min="0" value={form.points[k] ?? ''} oninput={(e) => setPoint(k, (e.target as HTMLInputElement).value)} /></label>
            {/each}
          </div>
        </fieldset>

        <fieldset>
          <legend>Hadiah bertingkat</legend>
          <table class="ms">
            <thead><tr><th>Poin</th><th>Koin</th><th>Mutiara</th><th>Item</th><th>Jml</th><th></th></tr></thead>
            <tbody>
              {#each form.milestones as m, i}
                <tr>
                  <td><input type="number" min="1" bind:value={m.points} /></td>
                  <td><input type="number" min="0" bind:value={m.coin} /></td>
                  <td><input type="number" min="0" bind:value={m.pearl} /></td>
                  <td><select bind:value={m.item}><option value="">—</option>{#each data.items as it}<option value={it.id}>{it.name}</option>{/each}</select></td>
                  <td><input type="number" min="1" bind:value={m.qty} disabled={!m.item} /></td>
                  <td><button class="btn sm" onclick={() => form.milestones.splice(i, 1)} aria-label="Hapus hadiah">×</button></td>
                </tr>
              {/each}
            </tbody>
          </table>
          <button class="btn sm" onclick={() => form.milestones.push({ points: (form.milestones.at(-1)?.points ?? 0) + 100, coin: 50 })}>Tambah hadiah</button>
        </fieldset>
      </div>
      <div class="pcol">
        <h3>Pratinjau</h3>
        <div class="map" style="--c:{form.theme.color}"><svg viewBox="0 -40 480 300">{@html renderMap(MINI_MAP, form.decor)}</svg></div>
        <div class="chipprev" style="background:{form.theme.color}">{form.name || 'Nama event'}{Number(form.bonus.coinMultiplier) > 1 ? ` · koin ×${form.bonus.coinMultiplier}` : ''}</div>
        <div class="tokprev"><svg viewBox="-16 -16 32 32">{@html eventDropSVG(form.decor)}</svg><span>{form.token_name}</span></div>
        <ol class="ladder">{#each [...form.milestones].sort((a, b) => a.points - b.points) as m}<li><b>{m.points}</b> → {[m.coin && `${m.coin} koin`, m.pearl && `${m.pearl} Mutiara`, m.item && `${itemName(m.item)}${m.qty > 1 ? ` ×${m.qty}` : ''}`].filter(Boolean).join(', ') || '—'}</li>{/each}</ol>
        {#if !creating}<p class="muted">Peserta musim ini: <b>{num(form.participants ?? 0)}</b> · hadiah diambil: <b>{num(form.claims ?? 0)}</b></p>{/if}
      </div>
    </div>
    {#snippet footer()}
      {#if editable}
        {#if !creating}<button class="btn danger" onclick={remove}>{confirmDel ? 'Yakin hapus?' : 'Hapus'}</button>{/if}
        <button class="btn primary" disabled={busy} onclick={save}>Simpan</button>
      {:else}<span class="muted">Hanya bisa dilihat.</span>{/if}
    {/snippet}
  </Drawer>
{/if}

<style>
  .head { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: flex-start; }
  .head p { margin: 4px 0 0; max-width: 80ch; }
  .dot { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 6px; vertical-align: -1px; border: 1px solid #0003; }
  .cols { display: grid; grid-template-columns: 1fr 280px; gap: 18px; }
  .fcol { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
  fieldset { border: 1px solid var(--line); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 8px; margin: 0; }
  legend { font-weight: 700; padding: 0 6px; }
  .pts { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 6px 12px; }
  .pt { flex-direction: row; align-items: center; justify-content: space-between; gap: 8px; font-weight: 500; }
  .pt input { width: 80px; flex: none; }
  .ms { font-size: 13px; } .ms td, .ms th { padding: 4px; border: 0; } .ms input { min-width: 60px; } .ms select { min-width: 140px; }
  .pcol { display: flex; flex-direction: column; gap: 10px; position: sticky; top: 0; align-self: start; }
  .map { border-radius: 12px; overflow: hidden; background: #A9D18A; border: 1px solid var(--line); }
  .map svg { display: block; width: 100%; }
  .chipprev { align-self: center; color: #fff; border: 2.5px solid #2B2F4A; border-radius: 999px; padding: 3px 14px; font-weight: 800; font-family: var(--display); }
  .tokprev { display: flex; align-items: center; gap: 8px; font-weight: 700; }
  .tokprev svg { width: 36px; height: 36px; }
  .ladder { margin: 0; padding-left: 18px; font-size: 13.5px; display: flex; flex-direction: column; gap: 3px; }
  @media (max-width: 860px) { .cols { grid-template-columns: 1fr; } .pcol { position: static; } }
</style>
