<script lang="ts">
  // Situs & SEO: mode perawatan (nyala wajib ketik PERAWATAN), tag SEO & pratinjau Google, gambar pratinjau tautan
  // (WhatsApp, Facebook, X), dan akun media sosial. Tiap bagian bisa dilipat; bar simpan muncul saat ada perubahan.
  import { onMount } from 'svelte';
  import { MAINT_CSS, SOCIALS, maintenanceHTML, socialLink, socialLinks } from '@kb/shared';
  import { api } from '../lib/api';
  import { A, can, err, toast, ask, dt, toLocal, fromLocal } from '../lib/store.svelte';
  import { I } from '../lib/icons';
  import PageHead from '../components/ui/PageHead.svelte';
  import Section from '../components/ui/Section.svelte';
  import Switch from '../components/ui/Switch.svelte';
  import Bar from '../components/ui/Bar.svelte';
  import Ago from '../components/ui/Ago.svelte';

  let data = $state<any>(null);
  let f = $state<any>(null);
  let saved = $state('');
  let media = $state<any[]>([]);
  let busy = $state(false), maintBusy = $state(false);
  let imgMode = $state<'default' | 'media' | 'url'>('default');
  let savedImgMode = $state<'default' | 'media' | 'url'>('default');
  let socOpen = $state(true);
  let updated = $state(0);
  const edit = $derived(can('admin'));
  const dirty = $derived(!!f && (JSON.stringify(f) !== saved || imgMode !== savedImgMode));
  const savedObj = $derived(saved ? JSON.parse(saved) : null);
  const secDirty = (k: 'maintenance' | 'seo' | 'social') => !!f && !!savedObj && JSON.stringify(f[k]) !== JSON.stringify(savedObj[k]);
  const imgDirty = $derived(!!f && !!savedObj && (f.seo.image !== savedObj.seo.image || f.seo.imageAlt !== savedObj.seo.imageAlt || imgMode !== savedImgMode));
  const seoDirty = $derived(!!f && !!savedObj && ['siteName', 'title', 'description', 'keywords', 'index', 'googleVerify', 'bingVerify'].some((k) => f.seo[k] !== savedObj.seo[k]));

  function take(r: any) {
    data = r;
    A.maint = !!r.site.maintenance.on;
    f = JSON.parse(JSON.stringify(r.site));
    f.maintenance.until = toLocal(f.maintenance.until);
    saved = JSON.stringify(f);
    imgMode = savedImgMode = !f.seo.image ? 'default' : f.seo.image.startsWith('/media/') ? 'media' : 'url';
    updated = Date.now();
  }
  async function load() {
    try {
      take(await api.get('/api/admin/site'));
      media = (await api.get('/api/admin/media')).media.filter((m: any) => m.mime !== 'image/svg+xml');
    } catch (e) { err(e); }
  }
  onMount(load);
  async function refresh() {
    if (dirty && !(await ask({ title: 'Muat ulang?', body: 'Perubahan yang belum disimpan akan hilang.', tone: 'warn', icon: 'warn', confirm: 'Muat ulang', cancel: 'Kembali' }))) return;
    load();
  }

  async function save(msg = 'Pengaturan situs disimpan') {
    busy = true;
    try {
      const body = JSON.parse(JSON.stringify(f));
      body.maintenance.until = fromLocal(body.maintenance.until) ?? '';
      if (imgMode === 'default') body.seo.image = '';
      take(await api.put('/api/admin/site', body));
      toast(msg);
      return true;
    } catch (e) { err(e); return false; } finally { busy = false; }
  }
  async function toggleMaint() {
    const on = !data.site.maintenance.on;
    const others = JSON.stringify({ ...f, maintenance: { ...f.maintenance, on: data.site.maintenance.on } }) !== saved || imgMode !== savedImgMode;
    const ok = on
      ? await ask({
        title: 'Aktifkan mode perawatan?', tone: 'danger', icon: 'warn',
        body: `Semua pemain langsung melihat halaman perawatan dan tidak bisa main sampai mode ini dimatikan. Panel admin, webhook, dan gambar tetap jalan.${f.maintenance.adminBypass ? ' Admin yang masuk di panel ini tetap bisa main.' : ''}`,
        diff: [
          { label: 'Mode perawatan', before: 'Mati (game terbuka)', after: 'AKTIF (pemain tidak bisa main)' },
          { label: 'Perkiraan selesai', before: savedObj?.maintenance.until ? dt(fromLocal(savedObj.maintenance.until)) : '—', after: f.maintenance.until ? dt(fromLocal(f.maintenance.until)) : 'tidak ditampilkan' },
        ],
        note: others ? 'Perubahan lain yang belum disimpan di halaman ini ikut tersimpan.' : undefined,
        typeToConfirm: 'PERAWATAN', confirm: 'Aktifkan perawatan',
      })
      : await ask({
        title: 'Matikan mode perawatan?', tone: 'ok', icon: 'check',
        body: 'Game langsung terbuka lagi. Pemain yang sedang di layar perawatan kembali ke game sendiri.',
        note: others ? 'Perubahan lain yang belum disimpan di halaman ini ikut tersimpan.' : undefined,
        confirm: 'Matikan perawatan',
      });
    if (!ok) return;
    maintBusy = true;
    f.maintenance.on = on;
    const done = await save(on ? 'Mode perawatan AKTIF. Pemain melihat halaman perawatan.' : 'Mode perawatan dimatikan. Game terbuka lagi.');
    if (!done && f) f.maintenance.on = !on;
    maintBusy = false;
  }
  function addTime(min: number) {
    const base = f.maintenance.until ? new Date(f.maintenance.until).getTime() : Date.now();
    f.maintenance.until = toLocal(new Date(Math.max(base, Date.now()) + min * 60_000).toISOString());
  }
  function reset(path: 'seo' | 'social' | 'maintenance' | 'image') {
    if (path === 'image') { imgMode = 'default'; f.seo.image = ''; f.seo.imageAlt = data.defaults.seo.imageAlt; toast('Gambar bawaan dipilih (belum disimpan)', 'info'); return; }
    const d = JSON.parse(JSON.stringify(data.defaults[path]));
    if (path === 'maintenance') { d.on = f.maintenance.on; d.until = ''; }
    if (path === 'seo') { d.image = f.seo.image; d.imageAlt = f.seo.imageAlt; }
    f[path] = d;
    toast('Isi bawaan dipakai (belum disimpan)', 'info');
  }
  function discard() { take(data); }
  function goSocial() { socOpen = true; setTimeout(() => document.getElementById('soc')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }

  const L = $derived(data?.limits ?? { title: 60, description: 160 });
  const host = $derived(data ? new URL(data.info.publicUrl).host : '');
  const imgUrl = $derived(!f ? '' : imgMode === 'default' || !f.seo.image ? '/og/bupi.jpg' : f.seo.image);
  const links = $derived(f ? socialLinks(f.social) : []);
  const draftInfo = $derived(f ? { title: f.maintenance.title, message: f.maintenance.message, until: fromLocal(f.maintenance.until) } : null);
  const mtPreview = $derived(draftInfo ? maintenanceHTML(draftInfo, links) : '');
  const enc = (u: string) => encodeURIComponent(u);
  const pickedMedia = $derived(imgMode === 'media' ? media.find((m) => `/media/${m.id}` === f?.seo.image) : null);
  const urlBad = $derived(imgMode === 'url' && !!f?.seo.image && !/^https:\/\/\S{4,}$/.test(f.seo.image));
  const socCount = $derived(f ? SOCIALS.filter((s) => socialLink(s.key, f.social[s.key])).length : 0);
  const socBad = $derived(f ? SOCIALS.filter((s) => f.social[s.key] && !socialLink(s.key, f.social[s.key])).length : 0);
</script>

<svelte:head>{@html `<style>${MAINT_CSS}</style>`}</svelte:head>

<PageHead title="Situs & SEO" updated={updated} onrefresh={refresh}>
  <span>Mode perawatan, tampilan di Google & saat tautan dibagikan, dan akun media sosial · langsung berlaku</span>
</PageHead>

{#if !f}
  {#each Array(3) as _}<div class="card sk"><span class="skel" style="width:25%"></span><span class="skel"></span><span class="skel" style="width:70%"></span></div>{/each}
{:else}
  {#if !edit}<p class="alert info"><span class="ic">{@html I.info}</span><span>Kamu bisa melihat halaman ini, tetapi hanya peran admin atau pemilik yang bisa mengubahnya.</span></p>{/if}

  <!-- ---------------- mode perawatan ---------------- -->
  <div class="wrap" class:live={data.site.maintenance.on}>
    <Section title="Mode perawatan" id="mt-h" prefKey="site:mt">
      {#snippet badge()}
        {#if data.site.maintenance.on}<span class="chip no"><span class="dot red"></span>AKTIF · pemain tidak bisa main</span>{:else}<span class="chip">mati · game terbuka</span>{/if}
        {#if secDirty('maintenance')}<span class="chip warn">belum disimpan</span>{/if}
      {/snippet}
      {#snippet actions()}
        {#if edit && data.site.maintenance.on}<button class="btn primary" aria-busy={maintBusy ? 'true' : undefined} disabled={busy} onclick={toggleMaint}>{@html I.check}<span>Matikan mode perawatan</span></button>{/if}
      {/snippet}
      {#if data.site.maintenance.on}
        <div class="live-box">
          <span class="ic">{@html I.warn}</span>
          <div><b>Pemain sedang melihat halaman perawatan.</b>
            <span>{#if data.site.maintenance.until}Perkiraan selesai {dt(data.site.maintenance.until)} (<Ago t={data.site.maintenance.until} />).{:else}Belum ada perkiraan selesai.{/if}</span></div>
        </div>
      {/if}
      <p class="muted small">Saat aktif, semua pemain melihat halaman perawatan beranimasi (HTTP 503, jadi peringkat Google tidak turun). Panel admin, webhook pembayaran/email/WhatsApp, dan file gambar tetap jalan. Pemain yang sedang main dialihkan ke layar perawatan dan kembali ke game sendiri begitu perawatan dimatikan.</p>
      <div class="cols">
        <div class="form">
          <label>Judul <input bind:value={f.maintenance.title} maxlength={L.maintTitle} disabled={!edit} /></label>
          <label>Pesan <textarea bind:value={f.maintenance.message} maxlength={L.maintMessage} rows="3" disabled={!edit}></textarea></label>
          <label><span>Perkiraan selesai <small class="help">waktu di perangkatmu; kosongkan bila belum tahu. Pemain melihatnya dalam WIB dengan hitung mundur.</small></span>
            <input type="datetime-local" bind:value={f.maintenance.until} disabled={!edit} /></label>
          {#if edit}<div class="row qt">
            <button class="btn sm" onclick={() => addTime(30)}>+30 menit</button>
            <button class="btn sm" onclick={() => addTime(60)}>+1 jam</button>
            <button class="btn sm" onclick={() => addTime(180)}>+3 jam</button>
            {#if f.maintenance.until}<button class="btn sm ghost" onclick={() => (f.maintenance.until = '')}>{@html I.x}Kosongkan</button>{/if}
          </div>{/if}
          <Switch bind:checked={f.maintenance.adminBypass} disabled={!edit} label="Admin tetap bisa main" help="Admin yang sedang masuk di panel ini tetap bisa membuka game untuk mengecek sebelum dibuka." />
          <p class="help">Akun media sosial di halaman perawatan diatur di bagian <button class="link" onclick={goSocial}>Media sosial</button>.</p>
          {#if edit}
            <div class="row acts">
              {#if !data.site.maintenance.on}<button class="btn danger" aria-busy={maintBusy ? 'true' : undefined} disabled={busy} onclick={toggleMaint}>{@html I.warn}Aktifkan mode perawatan</button>{/if}
              <button class="btn sm ghost" onclick={() => reset('maintenance')}>{@html I.undo}Teks bawaan</button>
            </div>
          {/if}
          <a class="ext" href="/api/admin/site/maintenance-preview" target="_blank" rel="noopener">{@html I.ext}Buka halaman perawatan (versi tersimpan)</a>
        </div>
        <div class="phone" aria-label="Pratinjau halaman perawatan">
          <div class="screen">{@html mtPreview}</div>
        </div>
      </div>
    </Section>
  </div>

  <!-- ---------------- SEO ---------------- -->
  <Section title="SEO & hasil Google" id="seo-h" prefKey="site:seo">
    {#snippet badge()}
      {#if data.info.indexable}<span class="chip">bisa diindeks Google</span>{:else}<span class="chip warn">tidak diindeks</span>{/if}
      {#if seoDirty}<span class="chip warn">belum disimpan</span>{/if}
    {/snippet}
    {#if !data.info.indexable}
      <p class="alert warn"><span class="ic">{@html I.info}</span><span>Mesin pencari diminta tidak mengindeks situs ini: {data.info.why.join(' ')}{#if data.info.why.length === 1 && !f.seo.index} Nyalakan "Izinkan mesin pencari" bila sudah siap.{/if}</span></p>
    {/if}
    <div class="cols">
      <div class="form">
        <label>Nama situs <input bind:value={f.seo.siteName} maxlength="40" disabled={!edit} /></label>
        <label>Judul halaman
          <input bind:value={f.seo.title} maxlength="120" disabled={!edit} class:warnb={f.seo.title.length > L.title} />
          <span class="meter"><Bar value={f.seo.title.length} max={L.title} tone={f.seo.title.length > L.title ? 'no' : f.seo.title.length > L.title * 0.85 ? 'warn' : 'ok'} h={4} label="Panjang judul" />
            <span class="help" class:over={f.seo.title.length > L.title}>{f.seo.title.length}/{L.title}</span></span>
          <span class="help">Lebih dari {L.title} karakter biasanya terpotong di Google.</span>
        </label>
        <label>Deskripsi
          <textarea bind:value={f.seo.description} maxlength="320" rows="3" disabled={!edit} class:warnb={f.seo.description.length > L.description}></textarea>
          <span class="meter"><Bar value={f.seo.description.length} max={L.description} tone={f.seo.description.length > L.description ? 'no' : f.seo.description.length > L.description * 0.85 ? 'warn' : 'ok'} h={4} label="Panjang deskripsi" />
            <span class="help" class:over={f.seo.description.length > L.description}>{f.seo.description.length}/{L.description}</span></span>
          <span class="help">Tampil di bawah judul di Google dan di kartu tautan.</span>
        </label>
        <label><span>Kata kunci <small class="help">dipisah koma; Google hampir tidak memakainya</small></span>
          <input bind:value={f.seo.keywords} maxlength={L.keywords} disabled={!edit} /></label>
        <Switch bind:checked={f.seo.index} disabled={!edit} label="Izinkan mesin pencari mengindeks" help="Berlaku di server produksi ber-HTTPS." />
        <label><span>Verifikasi Google Search Console <small class="help">opsional, metode "Tag HTML"</small></span>
          <input bind:value={f.seo.googleVerify} placeholder={'<meta name="google-site-verification" content="…" />'} disabled={!edit} /></label>
        <label><span>Verifikasi Bing Webmaster <small class="help">opsional</small></span>
          <input bind:value={f.seo.bingVerify} disabled={!edit} /></label>
        {#if edit}<div class="row"><button class="btn sm ghost" onclick={() => reset('seo')}>{@html I.undo}Isi bawaan</button></div>{/if}
      </div>
      <div class="previews">
        <div>
          <span class="lbl">Di hasil Google</span>
          <div class="g">
            <div class="g-site"><img src="/icons/icon-192.png" alt="" /><span><b>{f.seo.siteName}</b><small>{host}</small></span></div>
            <div class="g-title">{f.seo.title}</div>
            <div class="g-desc">{f.seo.description}</div>
          </div>
        </div>
        <div class="tools">
          <span class="lbl">Cek & alat</span>
          <a href={data.info.robots} target="_blank" rel="noopener">{@html I.ext}robots.txt</a>
          <a href={data.info.sitemap} target="_blank" rel="noopener">{@html I.ext}sitemap.xml</a>
          <a href="https://search.google.com/search-console" target="_blank" rel="noopener">{@html I.ext}Google Search Console</a><span class="help">daftarkan domain, lalu kirim sitemap.xml</span>
          <a href="https://search.google.com/test/rich-results?url={enc(data.info.publicUrl + '/')}" target="_blank" rel="noopener">{@html I.ext}Tes data terstruktur (Rich Results)</a>
        </div>
      </div>
    </div>
  </Section>

  <!-- ---------------- gambar pratinjau ---------------- -->
  <Section title="Gambar pratinjau tautan" id="img-h" prefKey="site:img">
    {#snippet badge()}
      <span class="chip mute">{imgMode === 'default' ? 'bawaan' : imgMode === 'media' ? 'dari Media' : 'URL'}</span>
      {#if imgDirty}<span class="chip warn">belum disimpan</span>{/if}
    {/snippet}
    <div class="cols">
      <div class="form">
        <fieldset disabled={!edit} class="modes">
          <legend>Sumber gambar</legend>
          <label class="ro" class:on={imgMode === 'default'}><input type="radio" bind:group={imgMode} value="default" /><span><b>Bawaan</b><small>Ilustrasi BUPI 1200×630</small></span></label>
          <label class="ro" class:on={imgMode === 'media'}><input type="radio" bind:group={imgMode} value="media" /><span><b>Dari menu Media</b><small>Ideal 1200×630, JPEG/PNG di bawah 300 KB</small></span></label>
          <label class="ro" class:on={imgMode === 'url'}><input type="radio" bind:group={imgMode} value="url" /><span><b>URL lain</b><small>Harus https://</small></span></label>
        </fieldset>
        {#if imgMode === 'media'}
          {#if media.length}
            <div class="pick" role="radiogroup" aria-label="Pilih gambar dari Media">
              {#each media as m (m.id)}
                <button class="th" class:on={f.seo.image === `/media/${m.id}`} role="radio" aria-checked={f.seo.image === `/media/${m.id}`} disabled={!edit} onclick={() => (f.seo.image = `/media/${m.id}`)} title={m.filename}>
                  <img src="/media/{m.id}" alt={m.filename} loading="lazy" /><small>{Math.round(m.size / 1024)} KB</small>
                </button>
              {/each}
            </div>
            {#if !f.seo.image}<span class="help over">Pilih salah satu gambar.</span>{/if}
            {#if pickedMedia && pickedMedia.size > 300 * 1024}<span class="help over">Gambar ini {Math.round(pickedMedia.size / 1024)} KB; di atas 300 KB sering tidak muncul di WhatsApp.</span>{/if}
          {:else}<p class="help">Belum ada gambar. Unggah dulu di <a href="#/media">Media</a>.</p>{/if}
        {:else if imgMode === 'url'}
          <label>URL gambar<input bind:value={f.seo.image} placeholder="https://…/gambar.jpg" disabled={!edit} class:bad={urlBad} />{#if urlBad}<span class="help over">Harus diawali https://</span>{/if}</label>
        {/if}
        <label>Teks alternatif gambar <input bind:value={f.seo.imageAlt} maxlength={L.imageAlt} disabled={!edit} /></label>
        {#if edit}<div class="row"><button class="btn sm ghost" onclick={() => reset('image')}>{@html I.undo}Pakai bawaan</button></div>{/if}
      </div>
      <div class="previews">
        <div>
          <span class="lbl">Saat dibagikan (WhatsApp, Facebook, X)</span>
          <div class="share">
            <img src={imgUrl} alt={f.seo.imageAlt} />
            <div><small>{host.toUpperCase()}</small><b>{f.seo.title}</b><span>{f.seo.description}</span></div>
          </div>
        </div>
        <div>
          <span class="lbl">Tautan undangan pemain (otomatis)</span>
          <div class="share small">
            <div><small>{host.toUpperCase()}</small><b>Mochi ngajak kamu main {f.seo.siteName}!</b><span>Masukkan kode teman KB-XXXXXX biar langsung berteman. …</span></div>
          </div>
          <span class="help">Dipakai otomatis untuk tautan dari tombol Undang teman (…/?undang=KODE).</span>
        </div>
        <a class="ext" href="https://developers.facebook.com/tools/debug/?q={enc(data.info.publicUrl + '/')}" target="_blank" rel="noopener">{@html I.ext}Facebook Sharing Debugger</a>
        <span class="help">Klik "Scrape Again" setelah mengganti gambar/judul; WhatsApp ikut memakai pratinjau baru setelah beberapa waktu.</span>
      </div>
    </div>
  </Section>

  <!-- ---------------- media sosial ---------------- -->
  <Section title="Media sosial" id="soc" prefKey="site:soc" bind:open={socOpen} sub="Tampil di halaman perawatan, layar masuk game, Pengaturan game, dan data terstruktur Google (sameAs). Isi nama akun (mis. @playbupi) atau URL profil; kosongkan bila tidak dipakai.">
    {#snippet badge()}
      <span class="chip {socCount ? '' : 'mute'}">{socCount} terisi</span>
      {#if socBad}<span class="chip no">{socBad} tidak valid</span>{/if}
      {#if secDirty('social')}<span class="chip warn">belum disimpan</span>{/if}
    {/snippet}
    <div class="grid2">
      {#each SOCIALS as s (s.key)}
        {@const l = socialLink(s.key, f.social[s.key])}
        <label>{s.label}
          <input bind:value={f.social[s.key]} placeholder={s.key === 'instagram' ? '@playbupi' : '@akun'} disabled={!edit} class:bad={!!f.social[s.key] && !l} />
          {#if f.social[s.key] && !l}<span class="help over">Tidak valid: isi nama akun atau URL {s.hosts[0]}</span>
          {:else if l}<a class="help" href={l.url} target="_blank" rel="noopener">{l.url}</a>{/if}
        </label>
      {/each}
    </div>
  </Section>

  {#if edit}
    <div class="savebar" class:show={dirty} aria-hidden={!dirty}>
      <span><span class="dot amber"></span>Ada perubahan belum disimpan</span>
      <button class="btn" onclick={discard} tabindex={dirty ? 0 : -1}>{@html I.undo}Batal</button>
      <button class="btn primary" aria-busy={busy ? 'true' : undefined} onclick={() => save()} tabindex={dirty ? 0 : -1}>Simpan</button>
    </div>
  {/if}
{/if}

<style>
  .sk { display: flex; flex-direction: column; gap: 10px; padding: 16px; }
  .small { font-size: 13px; margin: 0; }
  .wrap.live :global(.sec) { border: 2px solid var(--danger); box-shadow: 0 0 0 4px var(--danger-soft); }
  .live-box { display: flex; gap: 12px; align-items: center; background: var(--danger-soft); color: var(--danger); border-radius: 12px; padding: 10px 12px; flex-wrap: wrap; }
  .live-box > .ic { width: 22px; height: 22px; flex: none; }
  .live-box div { flex: 1; min-width: 200px; display: flex; flex-direction: column; font-size: 13.5px; }
  .cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 18px; align-items: start; }
  @media (max-width: 900px) { .cols { grid-template-columns: 1fr; } }
  .form { display: flex; flex-direction: column; gap: 12px; }
  .qt { gap: 6px; }
  .acts { gap: 8px; }
  .help { margin: 0; }
  .help.over { color: var(--danger); font-weight: 600; }
  .meter { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; }
  input.warnb, textarea.warnb { border-color: #E3A21A; }
  .alert { margin: 0; display: flex; gap: 8px; align-items: flex-start; border-radius: 10px; padding: 9px 12px; font-weight: 600; font-size: 13.5px; }
  .alert.warn { background: var(--warn-soft); color: var(--warn); }
  .alert.info { background: var(--info-soft); color: var(--info); }
  .alert .ic { width: 17px; height: 17px; margin-top: 1px; }
  .ext { display: inline-flex; gap: 6px; align-items: center; font-weight: 600; font-size: 13.5px; }
  .ext :global(svg) { width: 14px; height: 14px; }
  .modes { gap: 6px; }
  .ro { flex-direction: row; align-items: flex-start; gap: 10px; padding: 8px 10px; border: 1.5px solid var(--line); border-radius: 10px; cursor: pointer; font-weight: 500; }
  .ro.on { border-color: var(--accent); background: #F3FAF7; }
  .ro input { width: 18px; height: 18px; min-height: 0; margin-top: 2px; accent-color: var(--accent); flex: none; }
  .ro span { display: flex; flex-direction: column; } .ro small { color: var(--muted); font-size: 12.5px; }
  .pick { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; max-height: 260px; overflow-y: auto; padding: 2px; }
  .th { all: unset; box-sizing: border-box; cursor: pointer; border: 2px solid var(--line); border-radius: 10px; overflow: hidden; background: #fff; display: flex; flex-direction: column; }
  .th img { width: 100%; aspect-ratio: 1200 / 630; object-fit: cover; background: #EEF1EE; display: block; }
  .th small { font-size: 11px; color: var(--muted); padding: 2px 6px; }
  .th.on { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
  .th:focus-visible { outline: 3px solid #3F7FBF; }
  .phone { justify-self: center; width: 300px; height: 600px; border: 10px solid var(--ink); border-radius: 34px; overflow: hidden; background: #B7D7CA; box-shadow: 0 8px 24px rgba(43, 47, 74, .18); }
  .screen { width: 375px; height: 750px; transform: scale(.8); transform-origin: 0 0; overflow-y: auto; }
  .screen :global(.mt) { min-height: 750px; }
  .previews { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
  .lbl { display: block; font-size: 12.5px; font-weight: 600; color: var(--muted); margin-bottom: 4px; }
  .g { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; font-family: Arial, sans-serif; }
  .g-site { display: flex; align-items: center; gap: 8px; }
  .g-site img { width: 26px; height: 26px; border-radius: 50%; border: 1px solid #ECEFEC; }
  .g-site span { display: flex; flex-direction: column; line-height: 1.2; font-size: 13px; color: #202124; }
  .g-site small { color: #4D5156; font-size: 12px; }
  .g-title { color: #1A0DAB; font-size: 19px; margin: 6px 0 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .g-desc { color: #4D5156; font-size: 13.5px; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .share { background: #fff; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; max-width: 460px; }
  .share img { display: block; width: 100%; aspect-ratio: 1200 / 630; object-fit: cover; background: #EEF1EE; }
  .share div { display: flex; flex-direction: column; gap: 2px; padding: 8px 12px 10px; background: #F0F2F5; }
  .share small { color: #65676B; font-size: 12px; }
  .share b { font-size: 15px; line-height: 1.25; }
  .share span { color: #65676B; font-size: 13px; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .tools { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; }
  .tools a { display: inline-flex; gap: 6px; align-items: center; font-weight: 600; font-size: 13.5px; }
  .tools a :global(svg) { width: 14px; height: 14px; }
  .savebar { position: sticky; bottom: 12px; z-index: 20; display: flex; align-items: center; gap: 10px; justify-content: flex-end; background: var(--ink); color: #fff; padding: 10px 12px 10px 16px; border-radius: 14px; box-shadow: 0 8px 24px rgba(0, 0, 0, .22); transform: translateY(20px); opacity: 0; pointer-events: none; transition: transform .2s, opacity .2s; }
  .savebar.show { transform: none; opacity: 1; pointer-events: auto; }
  .savebar > span { margin-right: auto; font-weight: 600; display: inline-flex; gap: 8px; align-items: center; }
  .savebar .btn:not(.primary) { background: transparent; color: #fff; border-color: rgba(255,255,255,.35); }
  .savebar .btn:not(.primary):hover { background: rgba(255,255,255,.1); }
  .btn :global(svg) { width: 15px; height: 15px; }
  @media (max-width: 760px) {
    .phone { width: 260px; height: 520px; }
    .screen { transform: scale(.693); }
    .savebar { bottom: 8px; }
  }
</style>
