<script lang="ts">
  // Pusat notifikasi: pengaturan saluran (email & WhatsApp), lalu tiap jenis notifikasi per kelompok (bagian bisa dilipat)
  // dengan tombol geser Aktif + centang per saluran, cari/filter, dan laci editor teks + pratinjau + kirim uji.
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { A, can, err, toast, ask } from '../lib/store.svelte';
  import { type FDef, readFilters } from '../lib/filters';
  import { NOTIFY_CHANNELS, CHANNEL_LABEL, COMMON_VARS, unknownVars, resolveTemplate, type NotifyChannel, type NotifyEventDef } from '@kb/shared';
  import { I } from '../lib/icons';
  import PageHead from '../components/ui/PageHead.svelte';
  import Section from '../components/ui/Section.svelte';
  import Switch from '../components/ui/Switch.svelte';
  import FilterBar from '../components/ui/FilterBar.svelte';
  import Empty from '../components/ui/Empty.svelte';
  import Drawer from '../components/Drawer.svelte';

  let d = $state<any>(null), updated = $state(0);
  let ch = $state<any>(null), savedCh = $state('');
  let sel = $state<string | null>(null);
  let draft = $state<any>(null);
  let pv = $state<any>(null);
  let saveBusy = $state(false), chBusy = $state(false), testing = $state<'' | 'email' | 'whatsapp'>('');
  let testMail = $state(''), testPhone = $state('');
  let waTpls = $state<any[] | null>(null);
  let rev = $state(0);
  let lastField: HTMLInputElement | HTMLTextAreaElement | null = null;
  const editable = $derived(can('admin'));
  const chDirty = $derived(!!ch && JSON.stringify(ch) !== savedCh);

  async function load() {
    try {
      const r = await api.get('/api/admin/notify');
      if (!chDirty) ch = structuredClone(r.channels);
      savedCh = JSON.stringify(r.channels);
      d = r; updated = Date.now();
    } catch (e) { err(e); }
  }
  onMount(() => { testMail = A.me?.admin?.email ?? ''; load(); });

  /* ---------- daftar & filter ---------- */
  const FILTERS: FDef[] = [
    { key: 'show', label: 'Tampilkan', all: 'Semua', options: [['on', 'Yang aktif'], ['off', 'Yang mati'], ['changed', 'Teks/saluran diubah']] },
    { key: 'via', label: 'Saluran', all: 'Semua', options: NOTIFY_CHANNELS.map((c) => [c, `Lewat ${CHANNEL_LABEL[c].toLowerCase()}`] as [string, string]) },
  ];
  let q = $state(A.query.q ?? '');
  let vals = $state<Record<string, any>>(readFilters(FILTERS, A.query));
  const changed = (k: string) => !!d?.overrides?.[k] && Object.keys(d.overrides[k]).length > 0;
  const locked = (k: string) => !!d?.locked?.includes(k);
  function match(e: NotifyEventDef) {
    const t = d.templates[e.key];
    const s = q.trim().toLowerCase();
    if (s && !`${e.label} ${e.desc} ${e.group} ${e.key}`.toLowerCase().includes(s)) return false;
    if (vals.show === 'on' && !t.enabled) return false;
    if (vals.show === 'off' && t.enabled) return false;
    if (vals.show === 'changed' && !changed(e.key)) return false;
    if (vals.via && !(t.enabled && t.channels[vals.via])) return false;
    return true;
  }
  const filtering = $derived(!!(q.trim() || vals.show || vals.via));
  const groups = $derived.by(() => {
    const m = new Map<string, NotifyEventDef[]>();
    for (const e of (d?.events ?? []) as NotifyEventDef[]) if (match(e)) m.set(e.group, [...(m.get(e.group) ?? []), e]);
    return [...m];
  });
  const shown = $derived(groups.reduce((a, [, evs]) => a + evs.length, 0));
  const totals = $derived(d ? { all: d.events.length, on: d.events.filter((e: any) => d.templates[e.key].enabled).length, changed: d.events.filter((e: any) => changed(e.key)).length } : null);
  const providerOff = (c: NotifyChannel) => (c === 'email' && (!d?.providers.email || !d?.channels.email.enabled)) || (c === 'whatsapp' && (!d?.providers.whatsapp || !d?.channels.whatsapp.enabled));
  const official = $derived(ch?.whatsapp?.channel === 'whatsapp_official');

  /* ---------- ubah cepat dari daftar ---------- */
  async function quick(key: string, patch: any, what: string) {
    try {
      const r = await api.put(`/api/admin/notify/templates/${key}`, patch);
      d.templates[key] = r.template;
      d.overrides[key] = r.override;
      if (sel === key && draft) { draft.enabled = r.template.enabled; draft.channels = { ...r.template.channels }; }
      toast(what, 'info');
    } catch (e) { err(e); rev++; }
  }

  /* ---------- saluran ---------- */
  async function saveChannels() {
    chBusy = true;
    try { const r = await api.put('/api/admin/notify/channels', $state.snapshot(ch)); d.channels = r.channels; ch = structuredClone(r.channels); savedCh = JSON.stringify(r.channels); toast('Pengaturan saluran tersimpan'); } catch (e) { err(e); }
    chBusy = false;
  }

  /* ---------- editor ---------- */
  const def = $derived<NotifyEventDef | null>(sel ? d?.events.find((e: any) => e.key === sel) ?? null : null);
  const draftDirty = $derived(!!sel && !!draft && !!d && JSON.stringify(draft) !== JSON.stringify(d.templates[sel]));
  async function open(key: string) {
    sel = key;
    draft = $state.snapshot(d.templates[key]);
    pv = null;
    refresh();
    if (official && waTpls === null) {
      try { waTpls = ((await api.get('/api/admin/whatsapp')).templates ?? []).filter((t: any) => t.status === 'APPROVED'); } catch { waTpls = []; }
    }
  }
  function close() { sel = null; draft = null; pv = null; }
  function discard() { if (sel) { draft = $state.snapshot(d.templates[sel]); refresh(); } }

  let timer: any;
  function refresh() {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (!sel || !draft) return;
      try { pv = await api.post(`/api/admin/notify/preview/${sel}`, { draft: $state.snapshot(draft) }); } catch { /* biarkan */ }
    }, 300);
  }
  async function save() {
    if (!sel) return;
    saveBusy = true;
    try {
      const r = await api.put(`/api/admin/notify/templates/${sel}`, $state.snapshot(draft));
      d.templates[sel] = r.template; d.overrides[sel] = r.override; draft = structuredClone(r.template);
      toast('Tersimpan. Berlaku dalam ±10 detik.');
    } catch (e) { err(e); }
    saveBusy = false;
  }
  const short = (s: string) => (s ? (s.length > 90 ? s.slice(0, 90) + '…' : s) : '(kosong)');
  const onOff = (v: boolean) => (v ? 'Nyala' : 'Mati');
  function resetDiff(key: string, e: NotifyEventDef) {
    const cur = d.templates[key], base = resolveTemplate(e, null);
    const out: { label: string; before: string; after: string }[] = [];
    if (cur.enabled !== base.enabled) out.push({ label: 'Aktif', before: onOff(cur.enabled), after: onOff(base.enabled) });
    for (const c of NOTIFY_CHANNELS) if (cur.channels[c] !== base.channels[c]) out.push({ label: CHANNEL_LABEL[c], before: onOff(cur.channels[c]), after: onOff(base.channels[c]) });
    for (const [k, l] of [['title', 'Judul'], ['body', 'Isi'], ['wa', 'Teks WhatsApp'], ['waTemplate', 'Template Official'], ['waLanguage', 'Bahasa template']] as const)
      if (cur[k] !== base[k]) out.push({ label: l, before: short(cur[k]), after: short(base[k]) });
    const vs = (v: Record<string, string>) => Object.entries(v ?? {}).map(([k, x]) => `{{${k}}} = ${x}`).join(', ') || '(kosong)';
    if (JSON.stringify(cur.waVars ?? {}) !== JSON.stringify(base.waVars ?? {})) out.push({ label: 'Variabel template', before: short(vs(cur.waVars)), after: short(vs(base.waVars)) });
    return out;
  }
  async function reset() {
    if (!sel || !def) return;
    const key = sel, e = def;
    const ok = await ask({
      title: 'Kembalikan ke bawaan?', icon: 'undo', tone: 'warn',
      body: `Teks & saluran “${e.label}” yang sudah diubah hilang dan diganti bawaan.${draftDirty ? ' Perubahan yang belum disimpan juga ikut hilang.' : ''}`,
      diff: resetDiff(key, e), confirm: 'Kembalikan ke bawaan',
    });
    if (!ok) return;
    try {
      const r = await api.del(`/api/admin/notify/templates/${key}`);
      d.templates[key] = r.template; d.overrides[key] = {};
      if (sel === key) { draft = structuredClone(r.template); refresh(); }
      toast('Dikembalikan ke bawaan');
    } catch (x) { err(x); }
  }
  async function test(channel: 'email' | 'whatsapp') {
    testing = channel;
    try {
      const r = await api.post(`/api/admin/notify/test/${sel}`, { channel, to: channel === 'email' ? testMail : testPhone, draft: $state.snapshot(draft) });
      toast(`Pesan uji terkirim ke ${r.to}`);
    } catch (e) { err(e); }
    testing = '';
  }

  // sisipkan {variabel} di kolom yang terakhir disentuh
  function insert(v: string) {
    const el = lastField;
    if (!el || !draft) { toast('Klik dulu kolom Judul, Isi, atau Teks WhatsApp.', 'info'); return; }
    const field = el.dataset.f as 'title' | 'body' | 'wa';
    const s = el.selectionStart ?? el.value.length, e = el.selectionEnd ?? s;
    draft[field] = el.value.slice(0, s) + `{${v}}` + el.value.slice(e);
    refresh();
    queueMicrotask(() => { el.focus(); el.setSelectionRange(s + v.length + 2, s + v.length + 2); });
  }
  const track = (e: Event) => (lastField = e.currentTarget as any);

  const warn = $derived(def && draft ? unknownVars(def, `${draft.title} ${draft.body} ${draft.wa} ${Object.values(draft.waVars ?? {}).join(' ')}`) : []);
  const chosenTpl = $derived(waTpls?.find((t: any) => t.name === draft?.waTemplate) ?? null);
  const tplVars = $derived<string[]>(chosenTpl ? chosenTpl.variables.filter((v: any) => v.field === 'variables').map((v: any) => String(v.name)) : Object.keys(draft?.waVars ?? {}));
  function setVar(k: string, v: string) { draft.waVars = { ...(draft.waVars ?? {}), [k]: v }; refresh(); }
  async function addVar() {
    const r = await ask({ title: 'Tambah variabel template', icon: 'plus', tone: 'info', confirm: 'Tambah',
      fields: [{ key: 'name', label: 'Nama variabel', placeholder: 'mis. nama, atau 1 untuk {{1}}', min: 1, help: 'Sama persis dengan nama variabel di template WhatsApp Official.' }] });
    if (r && r.name.trim()) setVar(r.name.trim(), '');
  }
  function dropVar(k: string) { const v = { ...draft.waVars }; delete v[k]; draft.waVars = v; refresh(); }
  function pickTpl(name: string) {
    draft.waTemplate = name;
    const t = waTpls?.find((x: any) => x.name === name);
    if (t) {
      draft.waLanguage = t.language ?? '';
      const keep = draft.waVars ?? {};
      draft.waVars = Object.fromEntries(t.variables.filter((v: any) => v.field === 'variables').map((v: any) => [String(v.name), keep[v.name] ?? '']));
    }
    refresh();
  }
</script>

<PageHead title="Pusat notifikasi" updated={updated} onrefresh={load}>
  <span>Nyalakan/matikan tiap jenis & saluran, lalu ubah teksnya dengan {'{variabel}'} · pemain tetap bisa mematikan kategori, email, atau WhatsApp di Pengaturan game</span>
</PageHead>

{#if !d}
  {#each Array(3) as _}<div class="card sk"><span class="skel" style="width:25%"></span><span class="skel"></span><span class="skel" style="width:70%"></span></div>{/each}
{:else}
  <Section title="Saluran" prefKey="nc:ch">
    {#snippet badge()}
      <span class="chip {ch.email.enabled && d.providers.email ? '' : 'mute'}">Email {ch.email.enabled && d.providers.email ? 'nyala' : 'mati'}</span>
      <span class="chip {ch.whatsapp.enabled && d.providers.whatsapp ? '' : 'mute'}">WhatsApp {ch.whatsapp.enabled && d.providers.whatsapp ? 'nyala' : 'mati'}</span>
      {#if chDirty}<span class="chip warn">belum disimpan</span>{/if}
    {/snippet}
    <div class="grid2">
      <div class="chbox">
        <div class="cbh"><b>Email</b>{#if d.providers.email}<span class="chip">Mailketing tersambung</span>{:else}<a class="chip mute" href="#/email">Belum disambungkan</a>{/if}</div>
        <Switch bind:checked={ch.email.enabled} disabled={!editable} label="Kirim notifikasi ke email" help={d.providers.email ? '' : 'Belum terkirim sampai Mailketing disambungkan.'} />
        <label>Maks. email per pemain per hari<input type="number" min="0" max="50" bind:value={ch.email.maxPerDay} disabled={!editable} /><span class="help">Di luar notifikasi penting (pembayaran, pesan admin, kode).</span></label>
      </div>
      <div class="chbox">
        <div class="cbh"><b>WhatsApp</b>{#if d.providers.whatsapp}<span class="chip">Klik Flow tersambung</span>{:else}<a class="chip mute" href="#/whatsapp">Belum disambungkan</a>{/if}</div>
        <Switch bind:checked={ch.whatsapp.enabled} disabled={!editable} label="Kirim notifikasi ke WhatsApp" help={d.providers.whatsapp ? '' : 'Belum terkirim sampai Klik Flow disambungkan.'} />
        <label>Saluran<select bind:value={ch.whatsapp.channel} disabled={!editable}><option value="whatsapp_qr">WhatsApp (scan QR): teks bebas</option><option value="whatsapp_official">WhatsApp Official: wajib template disetujui</option></select></label>
        <div class="grid3">
          <label>Maks./hari<input type="number" min="0" max="50" bind:value={ch.whatsapp.maxPerDay} disabled={!editable} /></label>
          <label>Jam tenang mulai<input type="number" min="0" max="23" bind:value={ch.whatsapp.quietStart} disabled={!editable} /></label>
          <label>sampai (WIB)<input type="number" min="0" max="23" bind:value={ch.whatsapp.quietEnd} disabled={!editable} /></label>
        </div>
        <span class="help">Selama jam tenang, WhatsApp biasa ditunda sampai pagi; yang penting tetap langsung. Samakan kedua jam untuk mematikan jam tenang. Nomor pengirim & template verifikasi ada di halaman <a href="#/whatsapp">WhatsApp</a>.</span>
      </div>
    </div>
    {#if editable}
      <div class="savebar" class:on={chDirty}>
        <span class="small">{#if chDirty}<span class="dot amber"></span> Ada perubahan belum disimpan{:else}<span class="muted">Semua tersimpan</span>{/if}</span>
        {#if chDirty}<button class="btn" onclick={() => (ch = JSON.parse(savedCh))}>{@html I.undo}Batalkan</button>{/if}
        <button class="btn primary" disabled={!chDirty} aria-busy={chBusy ? 'true' : undefined} onclick={saveChannels}>Simpan saluran</button>
      </div>
    {/if}
  </Section>

  <div class="lh">
    <h2>Jenis notifikasi</h2>
    {#if totals}<span class="muted small">{totals.all} jenis · {totals.on} aktif{#if totals.changed} · {totals.changed} diubah{/if}</span>{/if}
  </div>
  <FilterBar bind:q bind:values={vals} filters={FILTERS} placeholder="Cari notifikasi, mis. kebun, Mutiara" count={shown} />

  {#key `${rev}:${filtering}`}
    {#each groups as [g, evs] (g)}
      {@const on = evs.filter((e) => d.templates[e.key].enabled).length}
      {@const ed = evs.filter((e) => changed(e.key)).length}
      <Section title={g} prefKey={filtering ? '' : `nc:g:${g}`}>
        {#snippet badge()}<span class="chip {on ? '' : 'mute'}">{on}/{evs.length} aktif</span>{#if ed}<span class="chip warn">{ed} diubah</span>{/if}{/snippet}
        <div class="mx" role="table" aria-label="Notifikasi {g}">
          <div class="mh" role="row">
            <span role="columnheader">Notifikasi</span><span role="columnheader" class="c">Aktif</span>
            {#each NOTIFY_CHANNELS as c}<span role="columnheader" class="c">{CHANNEL_LABEL[c]}</span>{/each}<span role="columnheader"></span>
          </div>
          {#each evs as e (e.key)}
            {@const t = d.templates[e.key]}
            <div class="mr" class:off={!t.enabled} role="row">
              <span class="nm" role="cell">
                <b>{e.label}</b>{#if changed(e.key)}<span class="chip warn">diubah</span>{/if}{#if e.critical}<span class="chip mute">penting</span>{/if}{#if locked(e.key)}<span class="chip blue">selalu nyala</span>{/if}
                <small>{e.desc}</small>
              </span>
              <span class="c en" role="cell">
                <Switch checked={t.enabled} disabled={!editable || locked(e.key)} label={t.enabled ? 'Nyala' : 'Mati'}
                  onchange={(v) => quick(e.key, { enabled: v }, `${e.label} ${v ? 'dinyalakan' : 'dimatikan'}`)} />
              </span>
              {#each NOTIFY_CHANNELS as c}
                <span class="c cc" role="cell">
                  {#if e.allowed.includes(c)}
                    <label class="ck" title={providerOff(c) ? 'Saluran ini belum aktif (lihat Saluran di atas)' : ''}>
                      <input type="checkbox" aria-label={`${e.label}: ${CHANNEL_LABEL[c]}`} checked={t.channels[c]} disabled={!editable || !t.enabled || locked(e.key)}
                        onchange={(ev) => { const v = (ev.target as HTMLInputElement).checked; quick(e.key, { channels: { [c]: v } }, `${e.label}: ${CHANNEL_LABEL[c].toLowerCase()} ${v ? 'nyala' : 'mati'}`); }} />
                      <span class="ml">{CHANNEL_LABEL[c]}</span>
                      {#if t.channels[c] && providerOff(c)}<span class="pdot" title="Saluran belum aktif, notifikasi ini belum terkirim lewat sini"></span>{/if}
                    </label>
                  {:else}<span class="na" aria-label="Tidak tersedia">—</span>{/if}
                </span>
              {/each}
              <span class="act" role="cell"><button class="btn sm" onclick={() => open(e.key)}>{@html editable ? I.edit : I.eye}{editable ? 'Ubah teks' : 'Lihat'}</button></span>
            </div>
          {/each}
        </div>
      </Section>
    {:else}
      <div class="card"><Empty title="Tidak ada notifikasi yang cocok" text="Coba kata kunci lain atau hapus filter." icon="bell" /></div>
    {/each}
  {/key}
  <p class="muted small legend"><span class="pdot"></span> = saluran dicentang tetapi belum aktif di bagian Saluran, jadi belum terkirim lewat situ.</p>
{/if}

{#if sel && draft && def}
  <Drawer title={def.label} onclose={close} dirty={draftDirty}>
    {#snippet head()}
      <div class="dh">
        <h2>{def.label}</h2>
        <p class="muted small">{def.desc}</p>
        <span class="row tags">{#if changed(def.key)}<span class="chip warn">diubah dari bawaan</span>{/if}{#if def.critical}<span class="chip mute">penting: tidak kena batas harian & jam tenang</span>{/if}</span>
      </div>
    {/snippet}

    <div class="sws">
      <Switch bind:checked={draft.enabled} disabled={!editable || locked(def.key)} label="Aktif" />
      {#each def.allowed as c}<Switch bind:checked={draft.channels[c]} disabled={!editable || locked(def.key) || !draft.enabled} label={CHANNEL_LABEL[c]} help={providerOff(c) ? 'belum aktif' : ''} />{/each}
    </div>
    {#if locked(def.key)}<p class="note">Notifikasi ini dibutuhkan untuk login/verifikasi, jadi selalu menyala. Teksnya tetap bisa diubah.</p>{/if}

    <div class="vars">
      <span class="muted small">Variabel (klik untuk menyisipkan ke kolom yang terakhir diklik):</span>
      <div class="row vr">
        {#each Object.entries({ ...COMMON_VARS, ...def.vars }) as [k, desc]}<button class="var" title={desc} onclick={() => insert(k)} disabled={!editable}>{`{${k}}`}</button>{/each}
      </div>
    </div>

    {#if def.allowed.some((c) => c !== 'whatsapp')}
      <label><span>Judul <small class="help">kotak masuk, push, dan subjek email</small></span>
        <input data-f="title" bind:value={draft.title} oninput={refresh} onfocus={track} maxlength="120" disabled={!editable} /></label>
      <label><span>Isi <small class="help">kotak masuk, push, dan email</small></span>
        <textarea data-f="body" bind:value={draft.body} oninput={refresh} onfocus={track} maxlength="600" rows="3" disabled={!editable}></textarea></label>
    {/if}
    {#if def.allowed.includes('whatsapp')}
      <label><span>Teks WhatsApp <small class="help">saluran scan QR; *tebal*, _miring_, emoji boleh</small></span>
        <textarea data-f="wa" bind:value={draft.wa} oninput={refresh} onfocus={track} maxlength="2000" rows="4" disabled={!editable}></textarea></label>
      {#if official && def.key !== 'wa_verify'}
        <div class="off-box">
          <b>WhatsApp Official</b>
          <p class="muted small">Di luar 24 jam sejak pemain terakhir menulis, WhatsApp Official hanya boleh mengirim template yang disetujui. Pilih template dan isi variabelnya.</p>
          {#if waTpls && waTpls.length}
            <label>Template<select value={draft.waTemplate} onchange={(e) => pickTpl((e.target as HTMLSelectElement).value)} disabled={!editable}>
              <option value="">— tidak dikirim lewat Official —</option>
              {#each waTpls as t}<option value={t.name}>{t.name} ({t.language}, {t.category})</option>{/each}
            </select></label>
            {#if chosenTpl}<p class="tplbody">{chosenTpl.body}</p>{/if}
          {:else}
            <label>Nama template<input bind:value={draft.waTemplate} oninput={refresh} placeholder="mis. mutiara_masuk" disabled={!editable} /></label>
            <label>Bahasa<input bind:value={draft.waLanguage} oninput={refresh} placeholder="id" disabled={!editable} /></label>
          {/if}
          {#if draft.waTemplate}
            {#each tplVars as k (k)}
              <label>{`{{${k}}}`}<span class="nowrap"><input value={draft.waVars?.[k] ?? ''} oninput={(e) => setVar(k, (e.target as HTMLInputElement).value)} placeholder="mis. {'{nama}'}" disabled={!editable} />
                {#if !chosenTpl && editable}<button class="btn sm icon" onclick={() => dropVar(k)} aria-label={`Hapus variabel ${k}`}>{@html I.x}</button>{/if}</span></label>
            {/each}
            {#if !chosenTpl && editable}<button class="btn sm add" onclick={addVar}>{@html I.plus}Variabel template</button>{/if}
          {/if}
        </div>
      {:else if official && def.key === 'wa_verify'}
        <p class="muted small">Saluran Official mengirim kode lewat template Autentikasi yang diatur di halaman WhatsApp; teks di atas dipakai untuk saluran scan QR.</p>
      {/if}
    {/if}
    {#if warn.length}<p class="bad-text small">Variabel tidak dikenal: {warn.map((w) => `{${w}}`).join(', ')}. Teks itu tampil apa adanya.</p>{/if}

    <h3>Pratinjau <small class="help">dengan contoh isian</small></h3>
    {#if pv}
      <div class="pvs">
        {#if draft.channels.push || draft.channels.inbox}
          <div class="pv"><span class="lbl">Push / kotak masuk</span>
            <div class="note2"><img src="/icons/icon-192.png" alt="" /><div><b>{pv.title}</b><p>{pv.body}</p></div></div></div>
        {/if}
        {#if draft.channels.whatsapp}
          <div class="pv"><span class="lbl">WhatsApp</span>
            {#if official && pv.waPayload?.type === 'template'}
              <div class="bubble"><b>Template {pv.waPayload.template.name}</b><pre class="mono">{JSON.stringify(pv.waPayload.template.variables ?? {}, null, 1)}</pre></div>
            {:else if official && pv.waError}
              <p class="bad-text small">{pv.waError}</p>
            {:else}
              <div class="bubble">{pv.waText}</div>
            {/if}
          </div>
        {/if}
      </div>
      {#if draft.channels.email}
        <div class="pv"><span class="lbl">Email · {pv.emailSubject}</span>
          <iframe title="Pratinjau email" srcdoc={pv.emailHtml} sandbox=""></iframe></div>
      {/if}
      {#if !draft.channels.push && !draft.channels.inbox && !draft.channels.whatsapp && !draft.channels.email}<p class="muted small">Semua saluran mati, jadi tidak ada yang dikirim.</p>{/if}
    {:else}<div class="skel" style="height:70px"></div>{/if}

    {#if editable && (def.allowed.includes('email') || def.allowed.includes('whatsapp'))}
      <h3>Kirim uji</h3>
      {#if def.allowed.includes('email')}
        <div class="nowrap"><input type="email" bind:value={testMail} placeholder="email@contoh.id" aria-label="Email tujuan uji" />
          <button class="btn" disabled={!d.providers.email || !testMail || (!!testing && testing !== 'email')} aria-busy={testing === 'email' ? 'true' : undefined} onclick={() => test('email')}>{@html I.mail}Kirim email uji</button></div>
        {#if !d.providers.email}<p class="help">Mailketing belum disambungkan.</p>{/if}
      {/if}
      {#if def.allowed.includes('whatsapp')}
        <div class="nowrap"><input type="tel" bind:value={testPhone} placeholder="0812…" aria-label="Nomor WhatsApp tujuan uji" />
          <button class="btn" disabled={!d.providers.whatsapp || !testPhone || (!!testing && testing !== 'whatsapp')} aria-busy={testing === 'whatsapp' ? 'true' : undefined} onclick={() => test('whatsapp')}>{@html I.chat}Kirim WhatsApp uji</button></div>
        <p class="help">{d.providers.whatsapp ? 'Dengan kunci tes Klik Flow, hanya nomor uji yang terdaftar di Klik Flow yang menerima.' : 'Klik Flow belum disambungkan.'}</p>
      {/if}
    {/if}

    {#snippet footer()}
      {#if editable}
        {#if changed(def.key)}<button class="btn" onclick={reset}>{@html I.undo}Kembalikan ke bawaan…</button>{/if}
        <span class="sp">{#if draftDirty}<span class="dot amber"></span><span class="dtx">Belum disimpan</span>{/if}</span>
        {#if draftDirty}<button class="btn ghost" onclick={discard}>Batalkan</button>{/if}
        <button class="btn primary" disabled={!draftDirty} aria-busy={saveBusy ? 'true' : undefined} onclick={save}>Simpan</button>
      {:else}<span class="muted small">Hanya admin yang bisa mengubah.</span>{/if}
    {/snippet}
  </Drawer>
{/if}

<style>
  .sk { display: flex; flex-direction: column; gap: 10px; padding: 16px; }
  .small { font-size: 12.5px; }
  .chbox { display: flex; flex-direction: column; gap: 12px; border: 1px solid var(--line); border-radius: 12px; padding: 12px; }
  .cbh { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  a.chip { text-decoration: none; }
  .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; align-items: end; }
  .savebar { display: flex; align-items: center; gap: 8px; justify-content: flex-end; flex-wrap: wrap; border-top: 1px solid var(--line-soft); padding-top: 12px; }
  .savebar > span { margin-right: auto; display: inline-flex; align-items: center; gap: 8px; }
  .savebar.on > span { color: var(--warn); font-weight: 600; }
  .lh { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-top: 4px; }
  .lh h2 { font-size: 19px; }

  /* matriks notifikasi × saluran (jadi kartu di HP) */
  .mx { display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
  .mh, .mr { display: grid; grid-template-columns: minmax(220px, 1fr) 104px repeat(4, 86px) 116px; align-items: center; gap: 0 4px; padding: 8px 12px; }
  .mh { background: #F8FAF8; font-size: 11.5px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); font-weight: 700; border-bottom: 1px solid var(--line-soft); }
  .mr { border-bottom: 1px solid var(--line-soft); transition: background .12s; }
  .mr:last-child { border-bottom: 0; }
  .mr:hover { background: var(--hover); }
  .c { text-align: center; display: flex; justify-content: center; }
  .nm { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; min-width: 0; }
  .nm small { flex-basis: 100%; color: var(--muted); font-size: 12.5px; }
  .mr.off .nm b { color: var(--muted); }
  .en :global(.sw) { align-items: center; }
  .en :global(.txt b) { font-size: 12.5px; min-width: 34px; text-align: left; }
  .ck { flex-direction: row; align-items: center; gap: 6px; position: relative; cursor: pointer; padding: 4px; }
  .ml { display: none; font-weight: 600; font-size: 13px; }
  .na { color: #B9C0C5; }
  .pdot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--coin); box-shadow: 0 0 0 2px #FBEFD2; }
  .ck .pdot { position: absolute; top: 0; right: -4px; }
  .act { display: flex; justify-content: flex-end; }
  .legend { margin: 0; display: flex; gap: 6px; align-items: center; }

  /* laci editor */
  .dh { display: flex; flex-direction: column; gap: 4px; }
  .dh h2 { font-size: 22px; }
  .dh p { margin: 0; }
  .tags { gap: 6px; }
  .sws { display: flex; flex-wrap: wrap; gap: 12px 22px; background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 12px; }
  .note { margin: 0; background: var(--info-soft); color: var(--info); border-radius: 10px; padding: 8px 10px; font-size: 13px; font-weight: 600; }
  .vars { display: flex; flex-direction: column; gap: 6px; }
  .vr { gap: 6px; }
  .var { font: 600 12.5px var(--mono); background: var(--accent-soft); color: var(--accent); border: 0; border-radius: 999px; padding: 3px 9px; cursor: pointer; }
  .var:hover:not(:disabled) { background: #C9E6DA; }
  .var:disabled { cursor: default; opacity: .7; }
  .off-box { display: flex; flex-direction: column; gap: 8px; border: 1px dashed #9FB3A8; border-radius: 12px; padding: 12px; background: #fff; }
  .off-box p { margin: 0; }
  .add { align-self: flex-start; }
  .tplbody { margin: 0; background: #F3F5F3; border-radius: 8px; padding: 8px 10px; font-size: 13px; white-space: pre-wrap; }
  .nowrap { display: flex; gap: 8px; align-items: center; }
  .nowrap input { flex: 1; min-width: 0; }
  h3 { margin-top: 6px; display: flex; align-items: baseline; gap: 8px; }
  .help { margin: 0; }
  .pvs { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 10px; }
  .pv { display: flex; flex-direction: column; gap: 6px; }
  .lbl { font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
  .note2 { display: flex; gap: 10px; background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 10px 12px; }
  .note2 img { width: 32px; height: 32px; border-radius: 8px; }
  .note2 p { margin: 2px 0 0; font-size: 13px; }
  .bubble { align-self: flex-start; max-width: 100%; background: #DCF8C6; border-radius: 12px 12px 12px 2px; padding: 9px 11px; font-size: 13.5px; white-space: pre-wrap; box-shadow: 0 1px 0 rgba(0,0,0,.08); }
  .bubble pre { margin: 4px 0 0; white-space: pre-wrap; }
  iframe { width: 100%; height: 440px; border: 1px solid var(--line); border-radius: 12px; background: #EEF3F0; }
  .sp { flex: 1; display: inline-flex; align-items: center; gap: 6px; }
  .dtx { color: var(--warn); font-weight: 600; font-size: 13px; }
  .btn :global(svg) { width: 15px; height: 15px; }

  @media (max-width: 760px) {
    .mx { border: 0; border-radius: 0; gap: 10px; overflow: visible; }
    .mh { display: none; }
    .mr { position: relative; grid-template-columns: 1fr 1fr; gap: 6px 10px; background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 10px 12px; }
    .mr:last-child { border-bottom: 1px solid var(--line); }
    .mr:hover { background: #fff; }
    .nm { grid-column: 1 / -1; padding-right: 96px; }
    .en { position: absolute; top: 10px; right: 12px; }
    .cc { justify-content: flex-start; }
    .cc:has(.na) { display: none; }
    .ml { display: inline; }
    .ck .pdot { position: static; }
    .act { grid-column: 1 / -1; }
    .act .btn { flex: 1; }
  }
</style>
