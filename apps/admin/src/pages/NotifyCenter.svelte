<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { A, can, err, toast } from '../lib/store.svelte';
  import { NOTIFY_CHANNELS, CHANNEL_LABEL, COMMON_VARS, unknownVars, type NotifyChannel, type NotifyEventDef } from '@kb/shared';

  let d = $state<any>(null);
  let ch = $state<any>(null);
  let sel = $state<string | null>(null);
  let draft = $state<any>(null);
  let pv = $state<any>(null);
  let busy = $state(false);
  let testMail = $state(''), testPhone = $state('');
  let waTpls = $state<any[] | null>(null);
  let lastField: HTMLInputElement | HTMLTextAreaElement | null = null;
  const editable = $derived(can('admin'));

  async function load() {
    try { d = await api.get('/api/admin/notify'); ch = $state.snapshot(d.channels); } catch (e) { err(e); }
  }
  onMount(() => { testMail = A.me?.admin?.email ?? ''; load(); });

  const groups = $derived.by(() => {
    const m = new Map<string, NotifyEventDef[]>();
    for (const e of (d?.events ?? []) as NotifyEventDef[]) m.set(e.group, [...(m.get(e.group) ?? []), e]);
    return [...m];
  });
  const def = $derived<NotifyEventDef | null>(sel ? d?.events.find((e: any) => e.key === sel) ?? null : null);
  const locked = (k: string) => d?.locked?.includes(k);
  const official = $derived(ch?.whatsapp?.channel === 'whatsapp_official');
  const providerOff = (c: NotifyChannel) => (c === 'email' && (!d?.providers.email || !d?.channels.email.enabled)) || (c === 'whatsapp' && (!d?.providers.whatsapp || !d?.channels.whatsapp.enabled));

  async function quick(key: string, patch: any) {
    try {
      const r = await api.put(`/api/admin/notify/templates/${key}`, patch);
      d.templates[key] = r.template;
      d.overrides[key] = r.override;
      if (sel === key && draft) { draft.enabled = r.template.enabled; draft.channels = { ...r.template.channels }; }
    } catch (e) { err(e); }
  }

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
    busy = true;
    try {
      const r = await api.put(`/api/admin/notify/templates/${sel}`, $state.snapshot(draft));
      d.templates[sel] = r.template; d.overrides[sel] = r.override; draft = structuredClone(r.template);
      toast('Tersimpan. Berlaku dalam ±10 detik.');
    } catch (e) { err(e); }
    busy = false;
  }
  async function reset() {
    if (!sel || !confirm('Kembalikan teks dan saluran notifikasi ini ke bawaan?')) return;
    try {
      const r = await api.del(`/api/admin/notify/templates/${sel}`);
      d.templates[sel] = r.template; d.overrides[sel] = {}; draft = structuredClone(r.template); refresh();
      toast('Dikembalikan ke bawaan');
    } catch (e) { err(e); }
  }
  async function test(channel: 'email' | 'whatsapp') {
    busy = true;
    try {
      const r = await api.post(`/api/admin/notify/test/${sel}`, { channel, to: channel === 'email' ? testMail : testPhone, draft: $state.snapshot(draft) });
      toast(`Pesan uji terkirim ke ${r.to}`);
    } catch (e) { err(e); }
    busy = false;
  }
  async function saveChannels() {
    busy = true;
    try { const r = await api.put('/api/admin/notify/channels', $state.snapshot(ch)); d.channels = r.channels; ch = structuredClone(r.channels); toast('Pengaturan saluran tersimpan'); } catch (e) { err(e); }
    busy = false;
  }

  // sisipkan {variabel} di kolom yang terakhir disentuh
  function insert(v: string) {
    const el = lastField;
    if (!el || !draft) return;
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
  function addVar() { const k = prompt('Nama variabel template (mis. nama, atau 1 untuk {{1}}):'); if (k) setVar(k.trim(), ''); }
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
  const changed = (k: string) => d?.overrides?.[k] && Object.keys(d.overrides[k]).length > 0;
</script>

<div class="head">
  <div>
    <h1>Pusat notifikasi</h1>
    <p class="muted">Semua notifikasi game di satu tempat: nyalakan/matikan per jenis dan per saluran, lalu ubah teksnya dengan {'{variabel}'}. Pemain tetap bisa mematikan kategori tertentu, email, atau WhatsApp di Pengaturan game.</p>
  </div>
</div>

{#if !d}
  <p class="muted">Memuat…</p>
{:else}
  <section class="card chs" aria-labelledby="ch-h">
    <h2 id="ch-h">Saluran</h2>
    <div class="grid2">
      <div class="chbox">
        <div class="row between"><b>Email</b>{#if d.providers.email}<span class="chip">Mailketing tersambung</span>{:else}<span class="chip mute">Belum disambungkan</span>{/if}</div>
        <label class="inline"><input type="checkbox" bind:checked={ch.email.enabled} disabled={!editable} /> Kirim notifikasi ke email</label>
        <label>Maks. email per pemain per hari<input type="number" min="0" max="50" bind:value={ch.email.maxPerDay} disabled={!editable} /><span class="help">Di luar notifikasi penting (pembayaran, pesan admin, kode).</span></label>
      </div>
      <div class="chbox">
        <div class="row between"><b>WhatsApp</b>{#if d.providers.whatsapp}<span class="chip">Klik Flow tersambung</span>{:else}<span class="chip mute">Belum disambungkan</span>{/if}</div>
        <label class="inline"><input type="checkbox" bind:checked={ch.whatsapp.enabled} disabled={!editable} /> Kirim notifikasi ke WhatsApp</label>
        <label>Saluran<select bind:value={ch.whatsapp.channel} disabled={!editable}><option value="whatsapp_qr">WhatsApp (scan QR): teks bebas</option><option value="whatsapp_official">WhatsApp Official: wajib template disetujui</option></select></label>
        <div class="grid3">
          <label>Maks./hari<input type="number" min="0" max="50" bind:value={ch.whatsapp.maxPerDay} disabled={!editable} /></label>
          <label>Jam tenang mulai<input type="number" min="0" max="23" bind:value={ch.whatsapp.quietStart} disabled={!editable} /></label>
          <label>sampai (WIB)<input type="number" min="0" max="23" bind:value={ch.whatsapp.quietEnd} disabled={!editable} /></label>
        </div>
        <span class="help">Selama jam tenang, WhatsApp biasa ditunda sampai pagi; yang penting tetap langsung. Samakan kedua jam untuk mematikan jam tenang. Nomor pengirim & template verifikasi diatur di halaman WhatsApp.</span>
      </div>
    </div>
    {#if editable}<div><button class="btn primary" disabled={busy} onclick={saveChannels}>Simpan pengaturan saluran</button></div>{/if}
  </section>

  {#each groups as [g, evs] (g)}
    <h2 class="gh">{g}</h2>
    <div class="tbl"><table>
      <thead><tr><th>Notifikasi</th><th class="c">Aktif</th>{#each NOTIFY_CHANNELS as c}<th class="c">{CHANNEL_LABEL[c]}</th>{/each}<th></th></tr></thead>
      <tbody>
        {#each evs as e (e.key)}
          {@const t = d.templates[e.key]}
          <tr class:off={!t.enabled}>
            <td class="nm"><b>{e.label}</b>{#if changed(e.key)} <span class="chip warn">diubah</span>{/if}{#if e.critical} <span class="chip mute">penting</span>{/if}<br /><span class="muted small">{e.desc}</span></td>
            <td class="c"><input type="checkbox" aria-label={`${e.label}: aktif`} checked={t.enabled} disabled={!editable || locked(e.key)} onchange={(ev) => quick(e.key, { enabled: (ev.target as HTMLInputElement).checked })} /></td>
            {#each NOTIFY_CHANNELS as c}
              <td class="c">
                {#if e.allowed.includes(c)}
                  <input type="checkbox" aria-label={`${e.label}: ${CHANNEL_LABEL[c]}`} checked={t.channels[c]} disabled={!editable || !t.enabled || locked(e.key)}
                    title={providerOff(c) ? 'Saluran ini belum aktif (lihat Saluran di atas)' : ''}
                    onchange={(ev) => quick(e.key, { channels: { [c]: (ev.target as HTMLInputElement).checked } })} />
                  {#if t.channels[c] && providerOff(c)}<span class="dot" title="Saluran belum aktif, notifikasi ini belum terkirim lewat sini"></span>{/if}
                {:else}<span class="muted">—</span>{/if}
              </td>
            {/each}
            <td><button class="btn sm" onclick={() => open(e.key)}>{editable ? 'Ubah teks' : 'Lihat'}</button></td>
          </tr>
        {/each}
      </tbody>
    </table></div>
  {/each}
{/if}

{#if sel && draft && def}
  <div class="scrim" onclick={close} aria-hidden="true"></div>
  <div class="drawer" role="dialog" aria-modal="true" aria-labelledby="ed-h">
    <div class="dh">
      <div><h2 id="ed-h">{def.label}</h2><p class="muted small">{def.desc}</p></div>
      <button class="btn sm" onclick={close} aria-label="Tutup">Tutup</button>
    </div>
    <div class="db">
      <div class="row">
        <label class="inline"><input type="checkbox" bind:checked={draft.enabled} disabled={!editable || locked(def.key)} /> Aktif</label>
        {#each def.allowed as c}<label class="inline"><input type="checkbox" bind:checked={draft.channels[c]} disabled={!editable || locked(def.key)} /> {CHANNEL_LABEL[c]}</label>{/each}
      </div>
      {#if locked(def.key)}<p class="muted small">Notifikasi ini dibutuhkan untuk login/verifikasi, jadi selalu menyala. Teksnya tetap bisa diubah.</p>{/if}

      <div class="vars">
        <span class="muted small">Variabel (klik untuk menyisipkan ke kolom yang terakhir diklik):</span>
        <div class="row">
          {#each Object.entries({ ...COMMON_VARS, ...def.vars }) as [k, desc]}<button class="var" title={desc} onclick={() => insert(k)} disabled={!editable}>{`{${k}}`}</button>{/each}
        </div>
      </div>

      {#if def.allowed.some((c) => c !== 'whatsapp')}
        <label>Judul <span class="help">kotak masuk, push, dan subjek email</span>
          <input data-f="title" bind:value={draft.title} oninput={refresh} onfocus={track} maxlength="120" disabled={!editable} /></label>
        <label>Isi <span class="help">kotak masuk, push, dan email</span>
          <textarea data-f="body" bind:value={draft.body} oninput={refresh} onfocus={track} maxlength="600" rows="3" disabled={!editable}></textarea></label>
      {/if}
      {#if def.allowed.includes('whatsapp')}
        <label>Teks WhatsApp <span class="help">dipakai di saluran scan QR; *tebal*, _miring_, emoji boleh</span>
          <textarea data-f="wa" bind:value={draft.wa} oninput={refresh} onfocus={track} maxlength="2000" rows="4" disabled={!editable}></textarea></label>
        {#if official && def.key !== 'wa_verify'}
          <div class="off-box">
            <b>WhatsApp Official</b>
            <p class="muted small">Di luar 24 jam sejak pemain terakhir menulis, WhatsApp Official hanya boleh mengirim template yang sudah disetujui. Pilih template dan isi variabelnya.</p>
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
                <label>{`{{${k}}}`}<span class="row nowrap"><input value={draft.waVars?.[k] ?? ''} oninput={(e) => setVar(k, (e.target as HTMLInputElement).value)} placeholder="mis. {'{nama}'}" disabled={!editable} />
                  {#if !chosenTpl}<button class="btn sm" onclick={() => dropVar(k)} aria-label={`Hapus variabel ${k}`}>×</button>{/if}</span></label>
              {/each}
              {#if !chosenTpl && editable}<button class="btn sm" onclick={addVar}>+ Variabel template</button>{/if}
            {/if}
          </div>
        {:else if official && def.key === 'wa_verify'}
          <p class="muted small">Saluran Official mengirim kode lewat template Autentikasi yang diatur di halaman WhatsApp; teks di atas dipakai untuk saluran scan QR.</p>
        {/if}
      {/if}
      {#if warn.length}<p class="bad small">Variabel tidak dikenal: {warn.map((w) => `{${w}}`).join(', ')}. Teks itu akan tampil apa adanya.</p>{/if}

      <h3>Pratinjau <span class="help">dengan contoh isian</span></h3>
      {#if pv}
        <div class="pvs">
          {#if draft.channels.push || draft.channels.inbox}
            <div class="pv"><span class="lbl">Push / kotak masuk</span>
              <div class="note"><img src="/icons/icon-192.png" alt="" /><div><b>{pv.title}</b><p>{pv.body}</p></div></div></div>
          {/if}
          {#if draft.channels.whatsapp}
            <div class="pv"><span class="lbl">WhatsApp</span>
              {#if official && pv.waPayload?.type === 'template'}
                <div class="bubble"><b>Template {pv.waPayload.template.name}</b><pre class="mono">{JSON.stringify(pv.waPayload.template.variables ?? {}, null, 1)}</pre></div>
              {:else if official && pv.waError}
                <p class="bad small">{pv.waError}</p>
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
      {:else}<p class="muted">Menyiapkan pratinjau…</p>{/if}

      {#if editable && (def.allowed.includes('email') || def.allowed.includes('whatsapp'))}
        <h3>Kirim uji</h3>
        {#if def.allowed.includes('email')}
          <div class="row nowrap"><input type="email" bind:value={testMail} placeholder="email@contoh.id" aria-label="Email tujuan uji" /><button class="btn" disabled={busy || !d.providers.email} onclick={() => test('email')}>Kirim email uji</button></div>
        {/if}
        {#if def.allowed.includes('whatsapp')}
          <div class="row nowrap"><input type="tel" bind:value={testPhone} placeholder="0812…" aria-label="Nomor WhatsApp tujuan uji" /><button class="btn" disabled={busy || !d.providers.whatsapp || !testPhone} onclick={() => test('whatsapp')}>Kirim WhatsApp uji</button></div>
          <p class="help">Dengan kunci tes Klik Flow, hanya nomor uji yang terdaftar di Klik Flow yang menerima.</p>
        {/if}
      {/if}
    </div>
    {#if editable}
      <div class="df">
        {#if changed(sel)}<button class="btn" onclick={reset}>Kembalikan ke bawaan</button>{/if}
        <span class="sp"></span>
        <button class="btn primary" disabled={busy} onclick={save}>Simpan</button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .head { margin-bottom: 14px; }
  .head p { max-width: 780px; margin: 6px 0 0; }
  .chs { display: flex; flex-direction: column; gap: 12px; margin-bottom: 8px; }
  .chbox { display: flex; flex-direction: column; gap: 10px; border: 1px solid var(--line); border-radius: 12px; padding: 12px; }
  .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .between { justify-content: space-between; }
  .gh { margin: 20px 0 8px; font-size: 18px; }
  .c { text-align: center; width: 92px; position: relative; }
  .nm { min-width: 260px; }
  .small { font-size: 12.5px; }
  tr.off td.nm b { color: var(--muted); text-decoration: line-through; }
  .dot { position: absolute; top: 10px; right: 26px; width: 8px; height: 8px; border-radius: 50%; background: var(--coin); }
  .bad { color: var(--danger); }
  .scrim { position: fixed; inset: 0; background: rgba(43, 47, 74, .35); z-index: 40; }
  .drawer { position: fixed; top: 0; right: 0; bottom: 0; width: min(100%, 620px); background: var(--bg); z-index: 41; display: flex; flex-direction: column; box-shadow: -8px 0 30px rgba(0, 0, 0, .15); }
  .dh { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; padding: 16px 18px; background: #fff; border-bottom: 1px solid var(--line); }
  .dh p { margin: 4px 0 0; }
  .db { flex: 1; overflow-y: auto; padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; }
  .df { display: flex; gap: 8px; padding: 12px 18px; background: #fff; border-top: 1px solid var(--line); }
  .sp { flex: 1; }
  .vars { display: flex; flex-direction: column; gap: 6px; }
  .var { font: 600 12.5px var(--mono); background: var(--accent-soft); color: var(--accent); border: 0; border-radius: 999px; padding: 3px 9px; cursor: pointer; }
  .var:disabled { cursor: default; }
  .off-box { display: flex; flex-direction: column; gap: 8px; border: 1px dashed #9FB3A8; border-radius: 12px; padding: 12px; background: #fff; }
  .off-box p { margin: 0; }
  .tplbody { margin: 0; background: #F3F5F3; border-radius: 8px; padding: 8px 10px; font-size: 13px; white-space: pre-wrap; }
  .nowrap { flex-wrap: nowrap; }
  .nowrap input { flex: 1; min-width: 0; }
  h3 { margin-top: 6px; }
  .pvs { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 10px; }
  .pv { display: flex; flex-direction: column; gap: 6px; }
  .lbl { font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
  .note { display: flex; gap: 10px; background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 10px 12px; }
  .note img { width: 32px; height: 32px; border-radius: 8px; }
  .note p { margin: 2px 0 0; font-size: 13px; }
  .bubble { align-self: flex-start; max-width: 100%; background: #DCF8C6; border-radius: 12px 12px 12px 2px; padding: 9px 11px; font-size: 13.5px; white-space: pre-wrap; box-shadow: 0 1px 0 rgba(0,0,0,.08); }
  .bubble pre { margin: 4px 0 0; white-space: pre-wrap; }
  iframe { width: 100%; height: 440px; border: 1px solid var(--line); border-radius: 12px; background: #EEF3F0; }
</style>
