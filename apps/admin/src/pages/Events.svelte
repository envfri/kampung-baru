<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { renderMap, eventDropSVG } from '@kb/shared';
  import { api } from '../lib/api';
  import { A, can, err, toast, ask, ago, dt, day, num, toLocal, fromLocal, setQuery } from '../lib/store.svelte';
  import { type FDef, readFilters, isActive, dateRange } from '../lib/filters';
  import { CLOCK } from '../lib/clock.svelte';
  import { I } from '../lib/icons';
  import PageHead from '../components/ui/PageHead.svelte';
  import FilterBar from '../components/ui/FilterBar.svelte';
  import DataTable, { type Col, type TState } from '../components/ui/DataTable.svelte';
  import Bar from '../components/ui/Bar.svelte';
  import Copy from '../components/ui/Copy.svelte';
  import Drawer from '../components/Drawer.svelte';

  let data = $state<any>(null);
  let loading = $state(true), updated = $state(0);
  const editable = $derived(can('admin'));
  const MINI_MAP = [
    { id: 'a', name: 'Pasar', kind: 'shop', x: 140, y: 205, enabled: true, style: { body: '#FDF1D6', roof: '#3FA06A' } },
    { id: 'b', name: 'Balai', kind: 'games', x: 330, y: 205, enabled: true, style: { body: '#E3F1DA', roof: '#E0583F' } },
  ];

  /* ---------- status & waktu ---------- */
  type St = 'run' | 'soon' | 'done' | 'off';
  const ST: Record<St, [string, string]> = { run: ['Berjalan', 'live'], soon: ['Terjadwal', 'warn'], done: ['Selesai', 'mute'], off: ['Nonaktif', 'mute'] };
  function status(e: any, now = CLOCK.now): St {
    const s = new Date(e.starts_at).getTime(), en = new Date(e.ends_at).getTime();
    if (!e.active) return 'off';
    if (now < s) return 'soon';
    if (now < en) return 'run';
    return 'done';
  }
  const elapsed = (e: any, now = CLOCK.now) => { const s = new Date(e.starts_at).getTime(), en = new Date(e.ends_at).getTime(); return en > s ? Math.max(0, Math.min(1, (now - s) / (en - s))) : 0; };
  const days = (e: any) => Math.max(1, Math.round((new Date(e.ends_at).getTime() - new Date(e.starts_at).getTime()) / 864e5));
  // event yang berlangsung (sebagian) dalam rentang tanggal filter
  function overlaps(v: string, e: any) {
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    const today = t0.getTime(), tomorrow = today + 864e5;
    let from = -Infinity, to = Infinity;
    if (v === 'today') { from = today; to = tomorrow; }
    else if (/^\d+$/.test(v)) { from = today - (Number(v) - 1) * 864e5; to = tomorrow; }
    else { const r = dateRange(v); if (r.from) from = new Date(r.from).getTime(); if (r.to) to = new Date(r.to).getTime(); }
    return new Date(e.starts_at).getTime() < to && new Date(e.ends_at).getTime() >= from;
  }

  /* ---------- daftar ---------- */
  const FILTERS: FDef[] = [
    { key: 'status', label: 'Status', all: 'Semua', options: [['run', 'Berjalan'], ['soon', 'Terjadwal'], ['done', 'Selesai'], ['off', 'Nonaktif']] },
    { key: 'when', label: 'Jadwal', type: 'dates' },
    { key: 'yearly', label: 'Berulang', all: 'Semua', options: [['yes', 'Tiap tahun'], ['no', 'Sekali saja']] },
  ];
  let q = $state(A.query.q ?? '');
  let vals = $state<Record<string, any>>(readFilters(FILTERS, A.query));
  let ts = $state<TState>({ page: 0, size: 25, sort: A.query.sort ?? '', dir: A.query.dir === 'asc' ? 'asc' : 'desc' });
  const keep = () => ({ sort: ts.sort, dir: ts.sort && ts.dir === 'asc' ? 'asc' : '' });
  const events = $derived<any[]>(data?.events ?? []);
  const decorName = (k: string) => data?.decor.find((d: any) => d[0] === k)?.[1] ?? '—';
  const shown = $derived.by(() => {
    const n = q.trim().toLowerCase(), v = vals;
    return events.filter((e) => (!n || `${e.name} ${e.id} ${e.description ?? ''} ${e.token_name ?? ''}`.toLowerCase().includes(n))
      && (!v.status || status(e) === v.status) && (!v.when || overlaps(v.when, e))
      && (!v.yearly || (v.yearly === 'yes') === !!e.repeat_yearly));
  });
  const running = $derived(events.filter((e) => status(e) === 'run'));
  const next = $derived(events.filter((e) => status(e) === 'soon').sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0]);
  const narrowed = $derived(!!q.trim() || FILTERS.some((f) => isActive(f, vals[f.key])));
  function resetFilters() { q = ''; for (const f of FILTERS) vals[f.key] = ''; ts.page = 0; setQuery({ ...keep() }); }
  const RANK: Record<St, number> = { run: 0, soon: 1, done: 2, off: 3 };
  const COLS: Col[] = [
    { key: 'who', label: 'Event', req: true, snip: true, card: 'title', sort: 'name', text: (e) => e.name },
    { key: 'status', label: 'Status', snip: true, sort: true, w: '190px', text: (e) => `${RANK[status(e)]} ${ST[status(e)][0]}` },
    { key: 'starts_at', label: 'Jadwal', sort: true, snip: true, text: (e) => e.starts_at },
    { key: 'ends_at', label: 'Selesai', sort: true, off: true, text: (e) => e.ends_at, html: (e) => dt(e.ends_at) },
    { key: 'decor', label: 'Dekorasi', sort: true, text: (e) => decorName(e.decor) },
    { key: 'mult', label: 'Pengali koin', num: true, sort: true, off: true, text: (e) => Number(e.bonus?.coinMultiplier ?? 1), html: (e) => `×${String(e.bonus?.coinMultiplier ?? 1).replace('.', ',')}` },
    { key: 'token_name', label: 'Nama poin', off: true },
    { key: 'participants', label: 'Peserta', num: true, sort: true, text: (e) => e.participants, html: (e) => num(e.participants) },
    { key: 'total_points', label: 'Total poin', num: true, sort: true, text: (e) => e.total_points, html: (e) => num(e.total_points) },
    { key: 'claims', label: 'Hadiah diambil', num: true, sort: true, text: (e) => e.claims, html: (e) => num(e.claims) },
  ];

  async function load() {
    loading = true;
    try {
      data = await api.get('/api/admin/events'); updated = Date.now();
      if (A.arg && !form) { const e = data.events.find((x: any) => x.id === A.arg); if (e) open(e); }
    } catch (e) { err(e); }
    loading = false;
  }
  onMount(load);

  /* ---------- laci ubah ---------- */
  let form = $state<any>(null), snap = $state(''), creating = $state(false), busy = $state(false);
  let tpl = $state('');
  function setArg(a: string) { if (A.arg !== a) { A.arg = a; setQuery({ q, ...vals, ...keep() }); } }
  async function open(e: any | null) {
    creating = !e; tpl = '';
    const f = JSON.parse(JSON.stringify(e ?? {
      id: '', name: '', description: '', starts_at: new Date().toISOString(), ends_at: new Date(Date.now() + 7 * 864e5).toISOString(),
      theme: { color: '#E0583F' }, bonus: { coinMultiplier: 1 }, active: true, decor: '', token_name: 'Poin event',
      points: { game_finish: 10, daily_claim: 10 }, milestones: [{ points: 50, coin: 100 }], repeat_yearly: false, notify_start: true,
    }));
    f.starts_at = toLocal(f.starts_at); f.ends_at = toLocal(f.ends_at);
    f.theme ??= { color: '#E0583F' }; f.bonus ??= { coinMultiplier: 1 }; f.points ??= {}; f.milestones ??= [];
    for (const m of f.milestones) m.item ??= '';
    form = f; snap = norm(f);
    setArg(e ? e.id : '');
    await tick(); if (form === f) snap = norm(form);
  }
  function close() { form = null; setArg(''); }
  // kosong (''/null/false/tidak ada) dianggap sama: isian centang & pilihan bisa mengisi nilai bawaan saat tampil
  const norm = (v: unknown) => JSON.stringify(v, (_k, x) => (x === '' || x === null || x === false ? undefined : x));
  const dirty = $derived(!!form && editable && norm(form) !== snap);
  function applyTemplate(key: string) {
    const t = data.templates.find((x: any) => x.key === key);
    if (!t || !form) return;
    const year = new Date().getFullYear();
    let start = new Date();
    if (t.start) { start = new Date(year, t.start[0] - 1, t.start[1], 0, 0); if (start.getTime() + t.days * 864e5 < Date.now()) start = new Date(year + 1, t.start[0] - 1, t.start[1]); }
    const end = new Date(start.getTime() + t.days * 864e5);
    Object.assign(form, {
      id: form.id || `${t.key}-${start.getFullYear()}`, name: t.name, description: t.description, decor: t.decor, token_name: t.tokenName,
      theme: { color: t.color }, bonus: { coinMultiplier: t.multiplier }, points: { ...t.points }, milestones: JSON.parse(JSON.stringify(t.milestones)).map((m: any) => ({ item: '', ...m })),
      repeat_yearly: t.repeatYearly, starts_at: toLocal(start.toISOString()), ends_at: toLocal(end.toISOString()),
    });
    toast(t.start ? 'Template diterapkan. Periksa tanggalnya.' : 'Template diterapkan. Tanggal hari raya ini berubah tiap tahun, jadi atur tanggalnya manual.', 'info');
  }
  async function save() {
    if (busy) return;
    busy = true;
    try {
      const body = { ...form, starts_at: fromLocal(form.starts_at), ends_at: fromLocal(form.ends_at), bonus: { coinMultiplier: Number(form.bonus.coinMultiplier) },
        milestones: form.milestones.map((m: any) => ({ points: Number(m.points), coin: Number(m.coin) || undefined, pearl: Number(m.pearl) || undefined, item: m.item || undefined, qty: m.item ? Number(m.qty) || 1 : undefined })) };
      // ID dari template ikut tahun tanggal mulai (mis. imlek-2027)
      if (creating && tpl && new RegExp(`^${tpl}-\\d{4}$`).test(body.id)) body.id = `${tpl}-${new Date(body.starts_at).getFullYear()}`;
      if (creating) await api.post('/api/admin/events', body); else await api.put(`/api/admin/events/${form.id}`, body);
      toast(creating ? `${form.name} dibuat. Pemain melihatnya dalam ±15 detik.` : 'Event tersimpan. Pemain melihatnya dalam ±15 detik.');
      close(); load();
    } catch (e) { err(e); } finally { busy = false; }
  }
  async function remove() {
    if (!form || busy) return;
    const ok = await ask({
      title: `Hapus event ${form.name}?`, tone: 'danger', icon: 'trash', typeToConfirm: form.id, confirm: 'Hapus event',
      body: 'Event hilang dari game beserta poin & hadiahnya. Item edisi event tetap ada, hanya dilepas dari event ini.',
      note: formSt === 'run' ? 'Event ini sedang berjalan: pemain langsung kehilangan dekorasi & poinnya.' : undefined,
    });
    if (!ok) return;
    busy = true;
    try { await api.del(`/api/admin/events/${form.id}`); toast(`${form.name} dihapus`); close(); load(); } catch (e) { err(e); } finally { busy = false; }
  }
  const setPoint = (k: string, v: string) => { const n = Number(v); if (n > 0) form.points[k] = n; else delete form.points[k]; };
  const itemName = (id: string) => data?.items.find((i: any) => i.id === id)?.name ?? id;
  const formSt = $derived(form && !creating ? status({ ...form, starts_at: fromLocal(form.starts_at), ends_at: fromLocal(form.ends_at) }) : null);
  const formLive = $derived(form ? { starts_at: fromLocal(form.starts_at), ends_at: fromLocal(form.ends_at) } : null);
</script>

<PageHead title="Event musiman" updated={updated} onrefresh={load}>
  {#if running.length}Sedang berjalan: {running.map((e) => e.name).join(', ')}{:else if next}Berikutnya: {next.name}, mulai {ago(next.starts_at, CLOCK.now)}{:else}Agustusan, Ramadan, Lebaran, Imlek, Tahun Baru: dekorasi, pengali koin, poin & hadiah bertingkat{/if}
  {#snippet actions()}{#if editable}<button class="btn primary" onclick={() => open(null)}>{@html I.plus}Event baru</button>{/if}{/snippet}
</PageHead>

{#if running.length}
  <div class="running">
    {#each running as e (e.id)}
      <button class="card lv" style="--c:{e.theme?.color ?? '#E0583F'}" onclick={() => open(e)}>
        <span class="lh"><span class="cd"></span><b>{e.name}</b><span class="chip live"><span class="dot"></span>Berjalan</span></span>
        <Bar value={elapsed(e) * 100} h={8} label="Waktu event berjalan" />
        <span class="ls"><span>Hari ke-{Math.min(days(e), Math.floor(elapsed(e) * days(e)) + 1)} dari {days(e)}</span><span>berakhir {ago(e.ends_at, CLOCK.now)}</span></span>
        <span class="lm"><span><b>{num(e.participants)}</b> peserta</span><span><b>{num(e.total_points)}</b> {e.token_name || 'poin'}</span><span><b>{num(e.claims)}</b> hadiah diambil</span></span>
      </button>
    {/each}
  </div>
{/if}

<FilterBar bind:q bind:values={vals} filters={FILTERS} placeholder="Cari nama event, ID, nama poin" count={shown.length} keep={keep()} onchange={() => (ts.page = 0)} />

<DataTable cols={COLS} rows={shown} bind:state={ts} onstate={() => setQuery({ q, ...vals, ...keep() })} {loading} prefKey="events" csv="local" csvName="event"
  onrow={open} rowClass={(e) => (status(e) === 'off' || status(e) === 'done' ? 'dim' : '')} emptyIcon={narrowed ? 'search' : 'cal'}
  empty={narrowed ? 'Tidak ada event yang cocok' : 'Belum ada event'} emptyText={narrowed ? 'Coba kata kunci lain atau hapus beberapa filter.' : 'Mulai dari template Agustusan, Ramadan, Imlek, dan lainnya.'}>
  {#snippet emptyActions()}
    {#if narrowed}<button class="btn" onclick={resetFilters}>{@html I.x}Hapus filter</button>
    {:else if editable}<button class="btn primary" onclick={() => open(null)}>{@html I.plus}Event baru</button>{/if}
  {/snippet}
  {#snippet cell(e, k)}
    {#if k === 'who'}
      <div class="who"><span class="cd" style="--c:{e.theme?.color ?? '#ccc'}"></span><span class="nm"><b>{e.name}</b><small><span class="mono">{e.id}</span>{[e.repeat_yearly && 'tiap tahun', Number(e.bonus?.coinMultiplier) > 1 && `koin ×${String(e.bonus.coinMultiplier).replace('.', ',')}`].filter(Boolean).map((x) => ` · ${x}`).join('')}</small></span></div>
    {:else if k === 'status'}
      {@const s = status(e)}
      <div class="stc">
        <span class="chip {ST[s][1]}">{#if s === 'run'}<span class="dot"></span>{/if}{ST[s][0]}</span>
        {#if s === 'run'}<Bar value={elapsed(e) * 100} h={6} label="Waktu event berjalan" /><small>berakhir {ago(e.ends_at, CLOCK.now)}</small>
        {:else if s === 'soon'}<small>mulai {ago(e.starts_at, CLOCK.now)}</small>{/if}
      </div>
    {:else if k === 'starts_at'}
      <span class="jd">{day(e.starts_at)} – {day(e.ends_at)}<small>{days(e)} hari</small></span>
    {/if}
  {/snippet}
</DataTable>

{#if form && data}
  <Drawer wide title={creating ? 'Event baru' : form.name} onclose={close} {dirty}>
    {#snippet head()}
      <div class="dh">
        <span class="bigcd" style="--c:{form.theme.color}"><svg viewBox="-16 -16 32 32">{@html eventDropSVG(form.decor)}</svg></span>
        <div class="t">
          <h2>{creating ? 'Event baru' : form.name || '…'}</h2>
          <p>
            {#if formSt}<span class="chip {ST[formSt][1]}">{ST[formSt][0]}</span>{/if}
            {#if !creating}<span class="mono">{form.id}</span><Copy text={form.id} label="ID disalin" />{/if}
            {#if dirty}<span class="chip warn">Belum disimpan</span>{/if}
          </p>
        </div>
      </div>
    {/snippet}
    {#if creating}
      <div class="grid2">
        <label>Mulai dari template
          <select bind:value={tpl} onchange={() => applyTemplate(tpl)}><option value="">Pilih template…</option>{#each data.templates as t}<option value={t.key}>{t.label}</option>{/each}</select>
        </label>
        <label>ID<input bind:value={form.id} placeholder="mis. agustusan-2027" autocomplete="off" /><span class="help">Huruf kecil, angka, tanda hubung.</span></label>
      </div>
    {/if}
    <div class="cols">
      <fieldset class="fcol" disabled={!editable}>
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
          <div class="msw">
            <table class="ms">
              <thead><tr><th>Poin</th><th>Koin</th><th>Mutiara</th><th>Item</th><th>Jml</th><th></th></tr></thead>
              <tbody>
                {#each form.milestones as m, i}
                  <tr>
                    <td><input type="number" min="1" bind:value={m.points} aria-label="Poin" /></td>
                    <td><input type="number" min="0" bind:value={m.coin} aria-label="Koin" /></td>
                    <td><input type="number" min="0" bind:value={m.pearl} aria-label="Mutiara" /></td>
                    <td><select bind:value={m.item} aria-label="Item"><option value="">—</option>{#each data.items as it}<option value={it.id}>{it.name}</option>{/each}</select></td>
                    <td><input type="number" min="1" bind:value={m.qty} disabled={!m.item} aria-label="Jumlah item" /></td>
                    <td><button class="btn sm icon ghost" onclick={() => form.milestones.splice(i, 1)} aria-label="Hapus hadiah" title="Hapus hadiah">{@html I.trash}</button></td>
                  </tr>
                {:else}<tr><td colspan="6" class="muted">Belum ada hadiah.</td></tr>{/each}
              </tbody>
            </table>
          </div>
          <div><button class="btn sm" onclick={() => form.milestones.push({ points: (form.milestones.at(-1)?.points ?? 0) + 100, coin: 50, item: '' })}>{@html I.plus}Tambah hadiah</button></div>
        </fieldset>
      </fieldset>
      <div class="pcol">
        <h3>Pratinjau</h3>
        <div class="map"><svg viewBox="0 -40 480 300">{@html renderMap(MINI_MAP, form.decor)}</svg></div>
        <div class="chipprev" style="background:{form.theme.color}">{form.name || 'Nama event'}{Number(form.bonus.coinMultiplier) > 1 ? ` · koin ×${form.bonus.coinMultiplier}` : ''}</div>
        <div class="tokprev"><svg viewBox="-16 -16 32 32">{@html eventDropSVG(form.decor)}</svg><span>{form.token_name}</span></div>
        {#if formSt === 'run' && formLive}
          <div class="prog">
            <div class="ls"><b>Berjalan</b><span>{Math.round(elapsed(formLive) * 100)}%</span></div>
            <Bar value={elapsed(formLive) * 100} h={8} label="Waktu event berjalan" />
            <small class="muted">berakhir {ago(formLive.ends_at, CLOCK.now)}</small>
          </div>
        {/if}
        <ol class="ladder">{#each [...form.milestones].sort((a, b) => a.points - b.points) as m}<li><b>{m.points}</b> → {[m.coin && `${m.coin} koin`, m.pearl && `${m.pearl} Mutiara`, m.item && `${itemName(m.item)}${m.qty > 1 ? ` ×${m.qty}` : ''}`].filter(Boolean).join(', ') || '—'}</li>{/each}</ol>
        {#if !creating}<p class="muted">Peserta musim ini: <b>{num(form.participants ?? 0)}</b> · hadiah diambil: <b>{num(form.claims ?? 0)}</b></p>{/if}
      </div>
    </div>
    {#snippet footer()}
      {#if editable}
        {#if !creating}<button class="btn danger" disabled={busy} onclick={remove}>{@html I.trash}Hapus…</button>{/if}
        <span class="sp"></span>
        <button class="btn primary" disabled={busy || (!creating && !dirty)} aria-busy={busy ? 'true' : undefined} onclick={save}>{@html I.check}{creating ? 'Buat event' : 'Simpan'}</button>
      {:else}<span class="muted">Hanya bisa dilihat: peran kamu tidak bisa mengubah event.</span>{/if}
    {/snippet}
  </Drawer>
{/if}

<style>
  .running { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: 10px; }
  .lv { all: unset; box-sizing: border-box; cursor: pointer; background: #fff; border: 1px solid var(--line); border-left: 5px solid var(--c); border-radius: 14px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; transition: border-color .15s, box-shadow .15s; }
  .lv:hover { box-shadow: 0 4px 14px rgba(43,47,74,.08); }
  .lv:focus-visible { outline: 3px solid #3F7FBF; }
  .lh { display: flex; align-items: center; gap: 8px; } .lh b { font: 700 17px var(--display); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ls { display: flex; justify-content: space-between; gap: 8px; font-size: 12.5px; color: var(--muted); }
  .lm { display: flex; gap: 14px; flex-wrap: wrap; font-size: 13px; color: var(--muted); } .lm b { color: var(--ink); }
  .cd { width: 12px; height: 12px; border-radius: 50%; background: var(--c); border: 1px solid #0003; flex: none; display: inline-block; }
  .lv .cd { width: 14px; height: 14px; }
  .who { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .nm { display: flex; flex-direction: column; min-width: 0; } .nm b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .nm small { color: var(--muted); }
  .stc { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; width: 100%; max-width: 170px; }
  .stc small { color: var(--muted); font-size: 12px; }
  .jd { display: flex; flex-direction: column; white-space: nowrap; } .jd small { color: var(--muted); font-size: 12px; }
  :global(.dt tr.dim td:not(.cbc)) { opacity: .62; }
  .dh { display: flex; gap: 14px; align-items: center; }
  .bigcd { width: 54px; height: 54px; border-radius: 14px; background: color-mix(in srgb, var(--c) 18%, #fff); border: 2px solid var(--c); flex: none; display: grid; place-items: center; padding: 8px; }
  .bigcd svg { width: 100%; height: 100%; }
  .dh .t { flex: 1; min-width: 0; }
  .dh h2 { font-size: 22px; overflow-wrap: anywhere; }
  .dh p { margin: 5px 0 0; color: var(--muted); font-size: 13px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .cols { display: grid; grid-template-columns: 1fr 280px; gap: 18px; }
  .fcol { border: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
  .fcol:disabled { opacity: .8; }
  .pts { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 6px 12px; }
  .pt { flex-direction: row; align-items: center; justify-content: space-between; gap: 8px; font-weight: 500; }
  .pt input { width: 80px; flex: none; }
  .msw { overflow-x: auto; }
  .ms { font-size: 13px; } .ms td, .ms th { padding: 4px; border: 0; background: none; } .ms input { min-width: 64px; } .ms select { min-width: 140px; }
  .pcol { display: flex; flex-direction: column; gap: 10px; position: sticky; top: 0; align-self: start; }
  .map { border-radius: 12px; overflow: hidden; background: #A9D18A; border: 1px solid var(--line); }
  .map svg { display: block; width: 100%; }
  .chipprev { align-self: center; color: #fff; border: 2.5px solid #2B2F4A; border-radius: 999px; padding: 3px 14px; font-weight: 800; font-family: var(--display); }
  .tokprev { display: flex; align-items: center; gap: 8px; font-weight: 700; }
  .tokprev svg { width: 36px; height: 36px; }
  .prog { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; }
  .prog .ls { color: var(--ink); }
  .ladder { margin: 0; padding-left: 18px; font-size: 13.5px; display: flex; flex-direction: column; gap: 3px; }
  .sp { flex: 1; }
  .btn :global(svg) { width: 15px; height: 15px; }
  @media (max-width: 860px) { .cols { grid-template-columns: 1fr; } .pcol { position: static; } }
  @media (max-width: 760px) { .stc { max-width: none; } }
</style>
