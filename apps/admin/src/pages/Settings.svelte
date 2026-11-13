<script lang="ts">
  import { onMount } from 'svelte';
  import { diffPaths } from '@kb/shared';
  import { api } from '../lib/api';
  import { can, err, toast, ask } from '../lib/store.svelte';
  import { I } from '../lib/icons';
  import PageHead from '../components/ui/PageHead.svelte';
  import Section from '../components/ui/Section.svelte';
  import Switch from '../components/ui/Switch.svelte';

  let value = $state<any>(null), saved = $state<any>(null), help = $state<any>({}), defaults = $state<any>({});
  let busy = $state(false), q = $state(''), onlyChanged = $state(false);
  let jsonErr = $state<Record<string, string>>({});
  let openAll = $state<Record<string, boolean>>({});
  const editable = $derived(can('admin'));
  const TITLE: Record<string, string> = {
    economy: 'Ekonomi', needs: 'Kebutuhan pet', actions: 'Aksi di rumah', social: 'Sosial', daily: 'Hadiah harian', karung: 'Lomba Karung', fishing: 'Kolam Pancing',
    garden: 'Kebun', room: 'Ruangan', house: 'Rumah', visit: 'Kunjungan bareng', premium: 'Set premium', square: 'Alun-alun', account: 'Akun & pindah perangkat',
    duel: 'Duel teman', sleep: 'Tidur', health: 'Kesehatan (sakit ringan)', weight: 'Berat badan', crumbs: 'Remah & bulu rontok', speech: 'Celetukan pet',
    quests: 'Tugas', games: 'Mini-game Balai Main', starter: 'Barang awal pemain baru', notify: 'Waktu notifikasi otomatis', features: 'Fitur & login',
  };
  const isTextList = (v: any) => Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'string');
  const isNumList = (v: any) => Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'number');
  /** daftar baris berisi angka (mis. tingkat kebun): tampil sebagai tabel */
  const isNumTable = (v: any) => Array.isArray(v) && v.length > 0 && v.every((x) => x && typeof x === 'object' && !Array.isArray(x) && Object.values(x).every((n) => typeof n === 'number'));
  const tableCols = (v: any[]) => [...new Set(v.flatMap((x) => Object.keys(x)))];
  const COL_LABEL: Record<string, string> = { slots: 'Petak', coins: 'Harga (koin)', petLevel: 'Level pet' };
  const rowLabel = (path: string, i: number) => (path.endsWith('levels') ? `Lv ${i + 1}` : `#${i + 1}`);
  function setCell(sec: string, path: string, i: number, c: string, raw: string) {
    if (raw === '') return;
    const rows = clone(get(value[sec], path));
    rows[i] = { ...rows[i], [c]: Number(raw) };
    set(value[sec], path, rows);
  }
  const clone = (x: any) => JSON.parse(JSON.stringify(x));
  async function load() {
    try {
      const r = await api.get('/api/admin/settings');
      openAll = Object.fromEntries(Object.keys(r.value).map((k) => [k, openAll[k] ?? true]));
      value = r.value; saved = clone(r.value); help = r.help; defaults = r.defaults; jsonErr = {};
    } catch (e) { err(e); }
  }
  onMount(() => {
    load();
    const warn = (e: BeforeUnloadEvent) => { if (changes.length) { e.preventDefault(); e.returnValue = ''; } };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  });

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
    try { set(value[sec], path, JSON.parse(text)); delete jsonErr[sec + path]; } catch { jsonErr[sec + path] = 'Format JSON tidak valid'; }
  }
  /** label manusiawi: energiCost → energi cost, a.b → a › b */
  const label = (p: string) => p.split('.').map((x) => x.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()).join(' › ');
  const fmt = (v: unknown) => (Array.isArray(v) ? (v.every((x) => typeof x !== 'object') ? v.join(' · ') : isNumTable(v) ? v.map((x) => Object.values(x).join('/')).join(' · ') : JSON.stringify(v)) : typeof v === 'boolean' ? (v ? 'aktif' : 'mati') : v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const changed = (sec: string, p: string) => !same(get(value?.[sec], p), get(defaults?.[sec], p));
  const dirtyField = (sec: string, p: string) => !same(get(value?.[sec], p), get(saved?.[sec], p));
  function reset(sec: string, p: string) { set(value[sec], p, clone(get(defaults[sec], p))); delete jsonErr[sec + p]; }

  // pencarian & saringan
  const norm = (s: string) => s.toLowerCase();
  const fieldMatch = (sec: string, p: string) => !q || norm(label(p)).includes(norm(q)) || norm(p).includes(norm(q));
  const secMatch = (sec: string) => !q || norm(TITLE[sec] ?? sec).includes(norm(q)) || norm(help[sec] ?? '').includes(norm(q));
  const visibleFields = (sec: string) => entries(value[sec]).filter(([p]) => (secMatch(sec) || fieldMatch(sec, p)) && (!onlyChanged || changed(sec, p)));
  const changes = $derived(value && saved ? diffPaths(saved, value) : []);
  const secs = $derived(value ? Object.keys(value).map((sec) => ({ sec, n: visibleFields(sec).length, def: entries(value[sec]).filter(([p]) => changed(sec, p)).length, dirty: changes.filter((c) => c.path.split('.')[0] === sec).length })) : []);
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
  const mark = (s: string) => (q ? esc(s).replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>') : esc(s));

  async function save() {
    if (Object.keys(jsonErr).length) { toast('Perbaiki isian JSON yang merah dulu.', 'err'); return; }
    const diff = changes.slice(0, 30).map((c) => ({ label: `${TITLE[c.path.split('.')[0]] ?? c.path.split('.')[0]} › ${label(c.path.split('.').slice(1).join('.'))}`, before: fmt(c.before), after: fmt(c.after) }));
    if (!(await ask({ title: 'Tinjau perubahan', body: `Berlaku untuk semua pemain dalam ±15 detik setelah disimpan dan tercatat di log audit.${changes.length > 30 ? ` (${changes.length - 30} perubahan lain tidak ditampilkan)` : ''}`, icon: 'eye', tone: 'warn', diff, confirm: `Simpan ${changes.length} perubahan` }))) return;
    busy = true;
    try { const r = await api.put('/api/admin/settings', { value }); value = r.value; saved = clone(r.value); toast('Pengaturan tersimpan. Berlaku untuk pemain dalam ±15 detik.'); } catch (e) { err(e); } finally { busy = false; }
  }
  async function discard() {
    if (!(await ask({ title: 'Batalkan semua perubahan?', body: `${changes.length} perubahan yang belum disimpan akan hilang.`, tone: 'warn', icon: 'undo', confirm: 'Batalkan perubahan', cancel: 'Kembali' }))) return;
    value = clone(saved); jsonErr = {};
  }
  function go(sec: string) { openAll[sec] = true; setTimeout(() => document.getElementById('sec-' + sec)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30); }
</script>

<PageHead title="Ekonomi & fitur" sub="Atur angka permainan tanpa deploy · berlaku untuk pemain dalam ±15 detik" onrefresh={() => (changes.length ? discard() : load())}>
  {#snippet actions()}<a class="btn" href="#/audit?q=settings_update">{@html I.list}Riwayat perubahan</a>{/snippet}
</PageHead>

{#if !value}
  <div class="card"><span class="skel" style="width:40%"></span><br /><span class="skel" style="width:70%"></span></div>
{:else}
  <div class="lay">
    <aside class="idx">
      <label class="srch"><span class="ic">{@html I.search}</span><input type="search" bind:value={q} placeholder="Cari pengaturan (mis. energi)" aria-label="Cari pengaturan" /></label>
      <Switch bind:checked={onlyChanged} label="Hanya yang beda dari bawaan" />
      <nav class="card list" aria-label="Bagian pengaturan">
        {#each secs as s (s.sec)}
          <button class:dim={!s.n} onclick={() => go(s.sec)}>
            <span>{TITLE[s.sec] ?? s.sec}</span>
            {#if q && s.n}<small>{s.n} cocok</small>{/if}
            {#if s.dirty}<em class="b dirty" title="Belum disimpan">{s.dirty}</em>{:else if s.def}<em class="b" title="Beda dari bawaan">{s.def}</em>{/if}
          </button>
        {/each}
      </nav>
    </aside>
    <div class="secs">
      {#each secs.filter((s) => s.n) as s (s.sec)}
        {@const sec = s.sec}
        <Section id="sec-{sec}" title={TITLE[sec] ?? sec} prefKey="set-{sec}" bind:open={openAll[sec]}>
          {#snippet badge()}
            {#if s.dirty}<span class="chip warn">{s.dirty} belum disimpan</span>{:else if s.def}<span class="chip mute">{s.def} beda dari bawaan</span>{/if}
          {/snippet}
          {#if help[sec]}<p class="muted hp">{@html mark(help[sec])}</p>{/if}
          <div class="fields">
            {#each visibleFields(sec) as [path, v] (path)}
              {@const ch = changed(sec, path)}
              {@const dirty = dirtyField(sec, path)}
              <div class="f" class:ch class:dirty class:wide={typeof v !== 'boolean' && typeof v !== 'number'}>
                {#if typeof v === 'boolean'}
                  <Switch checked={v} disabled={!editable} label={label(path)} help={ch ? `bawaan: ${fmt(get(defaults[sec], path))}` : ''} onchange={(x) => set(value[sec], path, x)} />
                {:else}
                  <span class="lb">{@html mark(label(path))}{#if dirty}<span class="chip warn">belum disimpan</span>{:else if ch}<span class="chip mute">diubah</span>{/if}</span>
                  {#if typeof v === 'number'}
                    <input type="number" step="any" value={v} disabled={!editable} oninput={(e) => { const n = (e.target as HTMLInputElement).value; if (n !== '') set(value[sec], path, Number(n)); }} />
                  {:else if isNumList(v)}
                    <div class="nl">
                      {#each v as n, i}<label class="ni"><span>#{i + 1}</span><input type="number" step="any" value={n} disabled={!editable} oninput={(e) => { const arr = [...get(value[sec], path)]; arr[i] = Number((e.target as HTMLInputElement).value); set(value[sec], path, arr); }} /></label>{/each}
                      {#if editable}
                        <button class="btn sm" onclick={() => set(value[sec], path, [...v, v[v.length - 1]])}>{@html I.plus}Tambah</button>
                        {#if v.length > 1}<button class="btn sm ghost" onclick={() => set(value[sec], path, v.slice(0, -1))}>{@html I.x}Buang terakhir</button>{/if}
                      {/if}
                    </div>
                  {:else if isNumTable(v)}
                    <div class="tw">
                      <table class="ntab">
                        <thead><tr><th></th>{#each tableCols(v) as c}<th>{COL_LABEL[c] ?? label(c)}</th>{/each}</tr></thead>
                        <tbody>
                          {#each v as row, i}
                            <tr><th>{rowLabel(path, i)}</th>{#each tableCols(v) as c}<td><input type="number" step="1" value={row[c]} disabled={!editable || (path.endsWith('levels') && i === 0 && c !== 'slots')} aria-label="{rowLabel(path, i)} {COL_LABEL[c] ?? label(c)}" oninput={(e) => setCell(sec, path, i, c, (e.target as HTMLInputElement).value)} /></td>{/each}</tr>
                          {/each}
                        </tbody>
                      </table>
                    </div>
                    {#if editable}
                      <div class="nl">
                        <button class="btn sm" onclick={() => set(value[sec], path, [...v, { ...v[v.length - 1] }])}>{@html I.plus}Tambah baris</button>
                        {#if v.length > 1}<button class="btn sm ghost" onclick={() => set(value[sec], path, v.slice(0, -1))}>{@html I.x}Buang baris terakhir</button>{/if}
                      </div>
                    {/if}
                  {:else if isTextList(v)}
                    <textarea rows={Math.min(8, v.length + 1)} disabled={!editable} oninput={(e) => set(value[sec], path, (e.target as HTMLTextAreaElement).value.split('\n').map((x) => x.trim()).filter(Boolean))}>{v.join('\n')}</textarea>
                    <span class="help">satu baris = satu kalimat · {v.length} baris</span>
                  {:else}
                    <textarea class="mono" class:bad={jsonErr[sec + path]} disabled={!editable} oninput={(e) => setJson(sec, path, (e.target as HTMLTextAreaElement).value)}>{JSON.stringify(v, null, 1)}</textarea>
                    {#if jsonErr[sec + path]}<span class="help bad">{jsonErr[sec + path]}</span>{/if}
                  {/if}
                  <span class="help">bawaan: {fmt(get(defaults[sec], path))}{#if ch && editable} · <button class="link" onclick={() => reset(sec, path)}>{@html I.undo}kembalikan</button>{/if}</span>
                {/if}
              </div>
            {/each}
          </div>
        </Section>
      {:else}
        <div class="card empty">Tidak ada pengaturan yang cocok dengan “{q}”{onlyChanged ? ' (yang beda dari bawaan)' : ''}. <button class="link" onclick={() => { q = ''; onlyChanged = false; }}>Hapus pencarian</button></div>
      {/each}
    </div>
  </div>

  {#if editable && changes.length}
    <div class="savebar fade" role="region" aria-label="Perubahan belum disimpan">
      <span class="dot amber"></span><b>{changes.length} perubahan belum disimpan</b>
      <span class="sp"></span>
      <button class="btn sm" onclick={discard}>{@html I.undo}Batalkan</button>
      <button class="btn sm primary" aria-busy={busy ? 'true' : undefined} onclick={save}>{@html I.eye}Tinjau & simpan</button>
    </div>
  {/if}
{/if}

<style>
  .lay { display: grid; grid-template-columns: 230px minmax(0, 1fr); gap: 16px; align-items: start; }
  .idx { position: sticky; top: 12px; display: flex; flex-direction: column; gap: 10px; max-height: calc(100vh - 24px); overflow-y: auto; }
  .srch { position: relative; flex-direction: row; align-items: center; font-weight: 400; }
  .srch .ic { position: absolute; left: 10px; color: var(--muted); }
  .srch input { padding-left: 32px; }
  .list { padding: 6px; display: flex; flex-direction: column; }
  .list button { all: unset; cursor: pointer; display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-radius: 8px; font-size: 13.5px; font-weight: 500; }
  .list button:hover { background: var(--hover); }
  .list button.dim { opacity: .4; }
  .list button:focus-visible { outline: 2px solid #3F7FBF; }
  .list small { color: var(--muted); font-size: 11.5px; }
  .b { margin-left: auto; font-style: normal; font-size: 11px; font-weight: 700; min-width: 18px; height: 18px; border-radius: 99px; display: grid; place-items: center; padding: 0 5px; background: #ECEFEC; color: var(--muted); }
  .b.dirty { background: #F2B632; color: var(--ink); }
  .secs { display: flex; flex-direction: column; gap: 12px; min-width: 0; padding-bottom: 70px; }
  .hp { margin: 0; font-size: 13.5px; line-height: 1.5; }
  .fields { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 14px 16px; }
  .f { display: flex; flex-direction: column; gap: 5px; min-width: 0; font-size: 13.5px; padding-left: 10px; border-left: 3px solid transparent; transition: border-color .2s; }
  .f.ch { border-left-color: #C5CDC8; }
  .f.dirty { border-left-color: #E3A21A; }
  .f.wide { grid-column: 1 / -1; }
  .lb { font-weight: 600; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .help :global(svg) { width: 12px; height: 12px; vertical-align: -1px; }
  .nl { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .ni { flex-direction: row; align-items: center; gap: 0; width: 120px; position: relative; font-weight: 400; }
  .ni span { position: absolute; left: 9px; color: var(--muted); font-size: 12px; }
  .ni input { padding-left: 30px; }
  .empty { color: var(--muted); }
  .tw { overflow-x: auto; }
  .ntab { border-collapse: collapse; font-size: 13.5px; }
  .ntab th { text-align: left; font-weight: 600; color: var(--muted); padding: 2px 8px 4px 0; white-space: nowrap; }
  .ntab tbody th { color: inherit; font-weight: 700; }
  .ntab td { padding: 2px 8px 2px 0; }
  .ntab input { width: 110px; }
  textarea.bad { border-color: var(--danger); }
  .savebar { position: fixed; z-index: 35; left: calc(244px + 28px); right: 28px; bottom: 16px; display: flex; align-items: center; gap: 10px; background: var(--ink); color: #fff; border-radius: 14px; padding: 10px 12px 10px 16px; box-shadow: 0 10px 30px rgba(0,0,0,.25); animation: slideup .2s ease-out; }
  .savebar .sp { flex: 1; }
  .savebar .btn:not(.primary) { background: transparent; color: #fff; border-color: rgba(255,255,255,.35); }
  .savebar .btn.primary { background: var(--accent-2); border-color: var(--accent-2); }
  .savebar :global(svg), .list :global(svg) { width: 14px; height: 14px; }
  @media (max-width: 1000px) { .lay { grid-template-columns: 1fr; } .idx { position: static; max-height: none; } .list { display: none; } }
  @media (max-width: 860px) { .savebar { left: 12px; right: 12px; bottom: 10px; } .savebar b { font-size: 13px; } .fields { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); } }
</style>
