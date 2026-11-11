<script lang="ts">
  // Situs & SEO: mode perawatan, tag SEO & pratinjau tautan (Google, WhatsApp, Facebook, X), dan akun media sosial.
  import { onMount } from 'svelte';
  import { MAINT_CSS, SOCIALS, maintenanceHTML, socialLink, socialLinks } from '@kb/shared';
  import { api } from '../lib/api';
  import { A, can, err, toast, toLocal, fromLocal } from '../lib/store.svelte';

  let data = $state<any>(null);
  let f = $state<any>(null);
  let saved = $state('');
  let media = $state<any[]>([]);
  let busy = $state(false);
  let imgMode = $state<'default' | 'media' | 'url'>('default');
  const edit = $derived(can('admin'));
  const dirty = $derived(!!f && JSON.stringify(f) !== saved);

  function take(r: any) {
    data = r;
    A.maint = !!r.site.maintenance.on;
    f = JSON.parse(JSON.stringify(r.site));
    f.maintenance.until = toLocal(f.maintenance.until);
    saved = JSON.stringify(f);
    imgMode = !f.seo.image ? 'default' : f.seo.image.startsWith('/media/') ? 'media' : 'url';
  }
  async function load() {
    try {
      take(await api.get('/api/admin/site'));
      media = (await api.get('/api/admin/media')).media.filter((m: any) => m.mime !== 'image/svg+xml');
    } catch (e) { err(e); }
  }
  onMount(load);

  async function save(msg = 'Pengaturan situs disimpan') {
    busy = true;
    try {
      const body = JSON.parse(JSON.stringify(f));
      body.maintenance.until = fromLocal(body.maintenance.until) ?? '';
      if (imgMode === 'default') body.seo.image = '';
      take(await api.put('/api/admin/site', body));
      toast(msg);
    } catch (e) { err(e); } finally { busy = false; }
  }
  async function toggleMaint() {
    const on = !data.site.maintenance.on;
    if (on && !window.confirm('Aktifkan mode perawatan sekarang? Semua pemain langsung melihat halaman perawatan dan tidak bisa main sampai dimatikan lagi.')) return;
    f.maintenance.on = on;
    await save(on ? 'Mode perawatan AKTIF. Pemain melihat halaman perawatan.' : 'Mode perawatan dimatikan. Game terbuka lagi.');
  }
  function addTime(min: number) {
    const base = f.maintenance.until ? new Date(f.maintenance.until).getTime() : Date.now();
    f.maintenance.until = toLocal(new Date(Math.max(base, Date.now()) + min * 60_000).toISOString());
  }
  function reset(path: 'seo' | 'social' | 'maintenance') {
    const d = JSON.parse(JSON.stringify(data.defaults[path]));
    if (path === 'maintenance') { d.on = f.maintenance.on; d.until = ''; }
    f[path] = d;
    if (path === 'seo') imgMode = 'default';
  }

  const L = $derived(data?.limits ?? { title: 60, description: 160 });
  const host = $derived(data ? new URL(data.info.publicUrl).host : '');
  const imgUrl = $derived(!f ? '' : imgMode === 'default' || !f.seo.image ? '/og/bupi.jpg' : f.seo.image);
  const links = $derived(f ? socialLinks(f.social) : []);
  const draftInfo = $derived(f ? { title: f.maintenance.title, message: f.maintenance.message, until: fromLocal(f.maintenance.until) } : null);
  const mtPreview = $derived(draftInfo ? maintenanceHTML(draftInfo, links) : '');
  const enc = (u: string) => encodeURIComponent(u);
</script>

<svelte:head>{@html `<style>${MAINT_CSS}</style>`}</svelte:head>

<h1>Situs &amp; SEO</h1>
<p class="muted">Mode perawatan, tampilan BUPI di Google dan saat tautannya dibagikan (WhatsApp, Facebook, X, Telegram), serta akun media sosial. Perubahan langsung berlaku tanpa deploy ulang.</p>

{#if !f}
  <p class="muted">Memuat…</p>
{:else}
  {#if !edit}<p class="warnbox">Kamu bisa melihat halaman ini, tetapi hanya peran admin atau owner yang bisa mengubahnya.</p>{/if}

  <!-- ---------------- mode perawatan ---------------- -->
  <section class="card" class:live={data.site.maintenance.on} aria-labelledby="mt-h">
    <div class="head">
      <h2 id="mt-h">Mode perawatan</h2>
      {#if data.site.maintenance.on}<span class="chip no">AKTIF · pemain tidak bisa main</span>{:else}<span class="chip">mati · game terbuka</span>{/if}
    </div>
    <p class="muted">Saat aktif, semua pemain melihat halaman perawatan beranimasi (HTTP 503, jadi peringkat Google tidak turun). Panel admin, webhook pembayaran/email/WhatsApp, dan file gambar tetap jalan. Pemain yang sedang main langsung dialihkan ke layar perawatan dan kembali ke game sendiri begitu perawatan dimatikan.</p>
    <div class="cols">
      <div class="form">
        <label>Judul <input bind:value={f.maintenance.title} maxlength={L.maintTitle} disabled={!edit} /></label>
        <label>Pesan <textarea bind:value={f.maintenance.message} maxlength={L.maintMessage} rows="3" disabled={!edit}></textarea></label>
        <label>Perkiraan selesai <span class="help">waktu di perangkatmu; kosongkan bila belum tahu. Ditampilkan ke pemain dalam WIB dengan hitung mundur.</span>
          <input type="datetime-local" bind:value={f.maintenance.until} disabled={!edit} /></label>
        {#if edit}<div class="row">
          <button class="btn sm" onclick={() => addTime(30)}>+30 menit</button>
          <button class="btn sm" onclick={() => addTime(60)}>+1 jam</button>
          <button class="btn sm" onclick={() => addTime(180)}>+3 jam</button>
          {#if f.maintenance.until}<button class="btn sm" onclick={() => (f.maintenance.until = '')}>Kosongkan</button>{/if}
        </div>{/if}
        <label class="inline"><input type="checkbox" bind:checked={f.maintenance.adminBypass} disabled={!edit} /> Admin yang sedang masuk di panel ini tetap bisa main (untuk mengecek sebelum dibuka)</label>
        <p class="help">Akun media sosial yang tampil di halaman perawatan diatur di bagian <a href="#soc-h">Media sosial</a> di bawah.</p>
        {#if edit}<div class="row">
          <button class="btn {data.site.maintenance.on ? 'primary' : 'danger'}" disabled={busy} onclick={toggleMaint}>{data.site.maintenance.on ? 'Matikan mode perawatan' : 'Aktifkan mode perawatan'}</button>
          {#if dirty}<button class="btn" disabled={busy} onclick={() => save()}>Simpan teks saja</button>{/if}
          <button class="btn sm" onclick={() => reset('maintenance')}>Teks bawaan</button>
        </div>{/if}
        <a href="/api/admin/site/maintenance-preview" target="_blank" rel="noopener">Buka halaman perawatan (versi tersimpan) di tab baru</a>
      </div>
      <div class="phone" aria-label="Pratinjau halaman perawatan">
        <div class="screen">{@html mtPreview}</div>
      </div>
    </div>
  </section>

  <!-- ---------------- SEO ---------------- -->
  <section class="card" aria-labelledby="seo-h">
    <div class="head">
      <h2 id="seo-h">SEO &amp; pratinjau tautan</h2>
      {#if data.info.indexable}<span class="chip">bisa diindeks Google</span>{:else}<span class="chip warn">tidak diindeks</span>{/if}
    </div>
    {#if !data.info.indexable}
      <p class="warnbox">Mesin pencari diminta tidak mengindeks situs ini: {data.info.why.join(' ')}{#if data.info.why.length === 1 && !f.seo.index} Nyalakan "Izinkan mesin pencari" bila sudah siap.{/if}</p>
    {/if}
    <div class="cols">
      <div class="form">
        <label>Nama situs <input bind:value={f.seo.siteName} maxlength="40" disabled={!edit} /></label>
        <label>Judul halaman <span class="help" class:over={f.seo.title.length > L.title}>{f.seo.title.length}/{L.title} karakter. Lebih dari itu biasanya terpotong di Google.</span>
          <input bind:value={f.seo.title} maxlength="120" disabled={!edit} /></label>
        <label>Deskripsi <span class="help" class:over={f.seo.description.length > L.description}>{f.seo.description.length}/{L.description} karakter. Tampil di bawah judul di Google dan di kartu tautan.</span>
          <textarea bind:value={f.seo.description} maxlength="320" rows="3" disabled={!edit}></textarea></label>
        <label>Kata kunci <span class="help">dipisah koma. Google hampir tidak memakainya, tetapi sebagian mesin pencari lain masih membacanya.</span>
          <input bind:value={f.seo.keywords} maxlength={L.keywords} disabled={!edit} /></label>
        <fieldset disabled={!edit}>
          <legend>Gambar pratinjau</legend>
          <label class="inline"><input type="radio" bind:group={imgMode} value="default" /> Bawaan (ilustrasi BUPI 1200×630)</label>
          <label class="inline"><input type="radio" bind:group={imgMode} value="media" /> Dari menu Media</label>
          {#if imgMode === 'media'}
            <select bind:value={f.seo.image}>
              <option value="">Pilih gambar…</option>
              {#each media as m (m.id)}<option value="/media/{m.id}">{m.filename} ({Math.round(m.size / 1024)} KB)</option>{/each}
            </select>
            <span class="help">Ukuran ideal 1200×630 piksel (JPEG/PNG, di bawah 300 KB supaya muncul di WhatsApp). Unggah dulu di menu Media.</span>
          {/if}
          <label class="inline"><input type="radio" bind:group={imgMode} value="url" /> URL lain (https)</label>
          {#if imgMode === 'url'}<input bind:value={f.seo.image} placeholder="https://…/gambar.jpg" />{/if}
          <label>Teks alternatif gambar <input bind:value={f.seo.imageAlt} maxlength={L.imageAlt} /></label>
        </fieldset>
        <label class="inline"><input type="checkbox" bind:checked={f.seo.index} disabled={!edit} /> Izinkan mesin pencari mengindeks (berlaku di server produksi ber-HTTPS)</label>
        <label>Verifikasi Google Search Console <span class="help">opsional. Pilih metode "Tag HTML", lalu tempel tag meta-nya di sini.</span>
          <input bind:value={f.seo.googleVerify} placeholder={'<meta name="google-site-verification" content="…" />'} disabled={!edit} /></label>
        <label>Verifikasi Bing Webmaster <span class="help">opsional, sama seperti di atas.</span>
          <input bind:value={f.seo.bingVerify} disabled={!edit} /></label>
        {#if edit}<div class="row"><button class="btn sm" onclick={() => reset('seo')}>Isi bawaan</button></div>{/if}
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
          <span class="help">Judul ini dipakai otomatis untuk tautan dari tombol Undang teman (…/?undang=KODE).</span>
        </div>
        <div class="tools">
          <span class="lbl">Cek & alat</span>
          <a href={data.info.robots} target="_blank" rel="noopener">robots.txt</a>
          <a href={data.info.sitemap} target="_blank" rel="noopener">sitemap.xml</a>
          <a href="https://search.google.com/search-console" target="_blank" rel="noopener">Google Search Console</a> <span class="help">daftarkan domain, lalu kirim sitemap.xml</span>
          <a href="https://search.google.com/test/rich-results?url={enc(data.info.publicUrl + '/')}" target="_blank" rel="noopener">Tes data terstruktur (Rich Results)</a>
          <a href="https://developers.facebook.com/tools/debug/?q={enc(data.info.publicUrl + '/')}" target="_blank" rel="noopener">Facebook Sharing Debugger</a> <span class="help">klik "Scrape Again" setelah mengganti gambar/judul; WhatsApp ikut memakai pratinjau baru setelah beberapa waktu</span>
        </div>
      </div>
    </div>
  </section>

  <!-- ---------------- media sosial ---------------- -->
  <section class="card" aria-labelledby="soc-h">
    <div class="head"><h2 id="soc-h">Media sosial</h2></div>
    <p class="muted">Tampil di halaman perawatan, layar masuk game, Pengaturan game, dan data terstruktur Google (sameAs). Isi nama akun (mis. <b>@playbudi</b>) atau URL profil; kosongkan bila tidak dipakai.</p>
    <div class="grid2">
      {#each SOCIALS as s (s.key)}
        {@const l = socialLink(s.key, f.social[s.key])}
        <label>{s.label}
          <input bind:value={f.social[s.key]} placeholder={s.key === 'instagram' ? '@playbudi' : '@akun'} disabled={!edit} />
          {#if f.social[s.key] && !l}<span class="help over">Tidak valid: isi nama akun atau URL {s.hosts[0]}</span>
          {:else if l}<a class="help" href={l.url} target="_blank" rel="noopener">{l.url}</a>{/if}
        </label>
      {/each}
    </div>
  </section>

  {#if edit}
    <div class="savebar" class:show={dirty}>
      <span>Ada perubahan yang belum disimpan</span>
      <button class="btn" onclick={() => take(data)}>Batal</button>
      <button class="btn primary" disabled={busy} onclick={() => save()}>Simpan</button>
    </div>
  {/if}
{/if}

<style>
  h2 { font-size: 19px; }
  .card { margin-top: 14px; display: flex; flex-direction: column; gap: 10px; }
  .card.live { border: 2px solid var(--danger); }
  .card p { margin: 0; }
  .head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 18px; align-items: start; }
  @media (max-width: 900px) { .cols { grid-template-columns: 1fr; } }
  .form { display: flex; flex-direction: column; gap: 10px; }
  .help.over { color: var(--danger); font-weight: 600; }
  .warnbox { background: var(--warn-soft); color: var(--warn); border-radius: 10px; padding: 8px 12px; font-weight: 600; }
  fieldset { border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; margin: 0; }
  legend { font-weight: 700; padding: 0 4px; }
  input[type=radio] { width: 16px; height: 16px; min-height: 0; accent-color: var(--accent); }
  .phone { justify-self: center; width: 300px; height: 600px; border: 10px solid var(--ink); border-radius: 34px; overflow: hidden; background: #B7D7CA; box-shadow: 0 8px 24px rgba(43, 47, 74, .18); }
  .screen { width: 375px; height: 750px; transform: scale(.8); transform-origin: 0 0; overflow-y: auto; }
  .screen :global(.mt) { min-height: 750px; }
  .previews { display: flex; flex-direction: column; gap: 14px; }
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
  .savebar { position: sticky; bottom: 10px; margin-top: 14px; display: none; align-items: center; gap: 10px; justify-content: flex-end; background: var(--ink); color: #fff; padding: 10px 14px; border-radius: 12px; box-shadow: 0 6px 18px rgba(0, 0, 0, .2); }
  .savebar.show { display: flex; }
  .savebar span { margin-right: auto; font-weight: 600; }
</style>
