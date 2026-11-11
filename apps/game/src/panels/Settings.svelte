<script lang="ts">
  import { onMount } from 'svelte';
  import Sheet from '../components/Sheet.svelte';
  import AuthOptions from '../components/AuthOptions.svelte';
  import TransferCode from '../components/TransferCode.svelte';
  import RedeemCode from '../components/RedeemCode.svelte';
  import { ask } from '../lib/account.svelte';
  import { G, run, toast, fail, track } from '../lib/game.svelte';
  import { api } from '../lib/api';
  import { getPrefs, setPref } from '../lib/sfx';
  import { APP_VERSION } from '@kb/shared';
  import { pushStatus, enablePush, disablePush, type PushStatus } from '../lib/push';

  let prefs = $state(getPrefs());
  let petName = $state(G.me.pet.name);
  let myName = $state(G.me.user.display_name);
  let del = $state('');
  let showDel = $state(false);
  let installEvt: any = $state((window as any).__kbInstall ?? null);
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const ids = $derived((G.me.user.identities ?? []).filter((i: any) => i.provider !== 'guest'));
  const P: Record<string, string> = { email: 'Email', google: 'Google', facebook: 'Facebook' };
  const linked = $derived(ids.map((i: any) => i.provider));
  const login = $derived(G.config?.login ?? {});
  // cara masuk yang masih bisa ditambahkan (mis. sudah email, belum Google)
  const canAdd = $derived((login.google && !linked.includes('google')) || (login.facebook && !linked.includes('facebook')) || (login.email !== false && !linked.includes('email')));
  let acc = $state<null | 'transfer' | 'redeem'>(null);

  let push = $state<PushStatus>('off');
  let nprefs = $state<Record<string, boolean>>({ garden: true, needs: true, daily: true, social: true, events: true, email: true, whatsapp: true, ...(G.me.notifyPrefs ?? {}) });
  const mailAddr = $derived((G.me.user.identities ?? []).find((i: any) => i.email)?.email as string | undefined);
  let waStep = $state<'idle' | 'code'>('idle'), waPhone = $state(''), waCode = $state(''), waBusy = $state(false), waSentTo = $state('');
  async function waStart(e: Event) {
    e.preventDefault(); waBusy = true;
    try { const r = await api.post('/api/wa/start', { phone: waPhone }); waSentTo = r.phone; waStep = 'code'; waCode = ''; toast('Kode dikirim ke WhatsApp', 'good'); } catch (x) { fail(x); }
    waBusy = false;
  }
  async function waVerify(e: Event) {
    e.preventDefault(); waBusy = true;
    try {
      const r = await api.post('/api/wa/verify', { code: waCode });
      G.me.user.wa = r.wa; G.me.notifyPrefs = r.prefs; nprefs.whatsapp = true; waStep = 'idle'; waPhone = '';
      toast('WhatsApp tersambung', 'good');
    } catch (x) { fail(x); }
    waBusy = false;
  }
  async function waRemove() {
    try { await api.post('/api/wa/remove'); G.me.user.wa = null; toast('Nomor WhatsApp diputus'); } catch (x) { fail(x); }
  }
  const NK: [string, string][] = [['garden', 'Kebun siap dipanen'], ['needs', 'Pet butuh perhatian'], ['daily', 'Pengingat hadiah harian'], ['social', 'Teman, kunjungan & hadiah'], ['events', 'Event & kabar kampung']];
  async function pushOn() { try { push = await enablePush(); if (push === 'on') toast('Notifikasi aktif', 'good'); else if (push === 'denied') toast('Notifikasi diblokir di browser.', 'error'); } catch (e) { fail(e); } }
  async function pushOff() { await disablePush(); push = await pushStatus(); toast('Notifikasi di perangkat ini dimatikan'); }
  async function pushTest() { try { const r = await api.post('/api/push/test'); toast(r.devices ? 'Notifikasi uji dikirim' : 'Belum ada perangkat terdaftar', r.devices ? 'good' : 'error'); } catch (e) { fail(e); } }
  async function setNotif(k: string, v: boolean) {
    nprefs[k] = v;
    try { const r = await api.post('/api/notify/prefs', { prefs: { [k]: v } }); G.me.notifyPrefs = r.prefs; } catch (e) { fail(e); }
  }
  onMount(() => {
    pushStatus().then((s) => (push = s));
    const h = (e: any) => { e.preventDefault(); installEvt = e; (window as any).__kbInstall = e; };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  });

  async function install() {
    if (!installEvt) return;
    installEvt.prompt();
    const c = await installEvt.userChoice.catch(() => null);
    track(c?.outcome === 'accepted' ? 'installed' : 'install_prompt');
    installEvt = null;
  }
  async function savePet(e: Event) {
    e.preventDefault();
    const r = await run(() => api.post('/api/pet/name', { name: petName }));
    if (r) toast('Nama pet diganti', 'good');
  }
  async function saveMe(e: Event) {
    e.preventDefault();
    try { const r = await api.post('/api/me/name', { name: myName }); G.me.user.display_name = r.displayName; toast('Namamu diganti', 'good'); } catch (e) { fail(e); }
  }
  async function logout() {
    if (G.me.user.is_guest && !(await ask({ title: 'Keluar dari akun tamu?', text: `${G.me.pet.name} belum disimpan ke Google/email. Setelah keluar, akun tamu ini tidak bisa dibuka lagi.`, yes: 'Tetap keluar', danger: true }))) return;
    await api.post('/api/auth/logout').catch(() => {});
    G.me = null;
    G.sheet = null;
    G.view = 'home';
  }
  async function deleteAccount() {
    try { await api.del('/api/me', { confirm: del }); G.me = null; G.sheet = null; toast('Akun dihapus.'); } catch (e) { fail(e); }
  }
  const toggle = (k: 'sound' | 'haptics') => { prefs[k] = !prefs[k]; setPref(k, prefs[k]); };
  let blocks = $state<any[] | null>(null);
  async function loadBlocks() { try { blocks = (await api.get('/api/blocks')).blocks; } catch (e) { fail(e); } }
  async function unblock(b: any) { try { await api.del(`/api/blocks/${b.id}`); toast(`Blokir ${b.name} dibuka.`); loadBlocks(); } catch (e) { fail(e); } }
  async function privacy(k: 'showOnline' | 'liveVisits', v: boolean) {
    try {
      const r = await api.post('/api/me/privacy', { [k]: v });
      G.me.user.show_online = r.showOnline; G.me.user.live_visits = r.liveVisits;
      toast('Disimpan', 'good');
    } catch (e) { fail(e); }
  }
</script>

<Sheet title="Pengaturan">
  <section>
    <h3>Akun</h3>
    {#if G.me.user.is_guest}
      <p class="warn">Kamu main sebagai <b>tamu</b>. Progresmu aman di server, tapi hanya bisa dibuka dari browser ini. Simpan ke akun supaya bisa main di HP atau browser lain dan tidak hilang saat data browser terhapus.</p>
      <b class="sub">Simpan progres & tautkan akun</b>
      {#if login.google}<p class="muted small">Ketuk tombol Google: akun tamu ini langsung tersambung. Di HP lain, cukup masuk dengan Google yang sama.</p>{/if}
      <AuthOptions guest={false} />
      {#if !login.google}<p class="muted small">Masuk dengan Google akan muncul di sini setelah pengelola game mengaktifkannya.</p>{/if}
    {:else}
      <p class="ok">Tersimpan ke {ids.map((i: any) => `${P[i.provider] ?? i.provider}${i.email ? ' (' + i.email + ')' : ''}`).join(', ')}. Di HP atau browser lain, masuk dengan cara yang sama.</p>
      {#if canAdd}
        <b class="sub">Tambah cara masuk</b>
        <AuthOptions guest={false} exclude={linked} />
      {/if}
    {/if}
    {#if login.transfer !== false}
      <b class="sub">Pindah perangkat</b>
      {#if acc === 'transfer'}
        <TransferCode />
        <button class="link" onclick={() => (acc = null)}>Tutup</button>
      {:else if acc === 'redeem'}
        <RedeemCode ondone={() => (acc = null)} />
        <button class="link" onclick={() => (acc = null)}>Batal</button>
      {:else}
        <p class="muted small">Buka akun ini di HP/browser lain dengan kode sekali pakai, tanpa Google atau email.</p>
        <div class="row">
          <button class="btn sm" onclick={() => (acc = 'transfer')}>Buat kode pindah</button>
          <button class="btn sm" onclick={() => (acc = 'redeem')}>Punya kode dari perangkat lain?</button>
        </div>
      {/if}
    {/if}
    <p class="muted">Kode teman: <b>{G.me.user.friend_code}</b></p>
  </section>

  <section>
    <h3>Nama</h3>
    <form onsubmit={savePet}><label for="s-pet">Nama pet</label><div class="row"><input id="s-pet" class="input" maxlength="16" bind:value={petName} /><button class="btn" disabled={G.busy}>Simpan</button></div></form>
    <form onsubmit={saveMe}><label for="s-me">Nama kamu</label><div class="row"><input id="s-me" class="input" maxlength="16" bind:value={myName} /><button class="btn">Simpan</button></div></form>
  </section>

  <section>
    <h3>Teman & tamu</h3>
    <label class="tg"><input type="checkbox" checked={G.me.user.show_online !== false} onchange={(e) => privacy('showOnline', (e.target as HTMLInputElement).checked)} /> Tampilkan status online ke teman</label>
    <label class="tg"><input type="checkbox" checked={G.me.user.live_visits !== false} onchange={(e) => privacy('liveVisits', (e.target as HTMLInputElement).checked)} /> Teman bisa langsung main bareng di rumahku</label>
    <p class="muted small">Bila dimatikan, teman tetap bisa berkunjung dan main dengan pet-mu, tapi tidak tampil bersamaan secara langsung.</p>
    {#if blocks === null}<button class="link" onclick={loadBlocks}>Pemain yang diblokir</button>
    {:else}
      {#if !blocks.length}<p class="muted small">Belum ada pemain yang diblokir.</p>{/if}
      {#each blocks as b (b.id)}<div class="row blk"><span>{b.name}</span><button class="btn sm" onclick={() => unblock(b)}>Buka blokir</button></div>{/each}
    {/if}
  </section>

  <section>
    <h3>Notifikasi</h3>
    {#if push === 'on'}
      <p>Notifikasi aktif di perangkat ini.</p>
      <div class="row"><button class="btn sm" onclick={pushTest}>Kirim notifikasi uji</button><button class="btn sm" onclick={pushOff}>Matikan di perangkat ini</button></div>
    {:else if push === 'off'}
      <p class="muted">Dapat kabar saat game ditutup: kebun siap panen, pet butuh perhatian, hadiah teman.</p>
      <button class="btn hot" onclick={pushOn}>Aktifkan notifikasi</button>
    {:else if push === 'ios-install'}
      <p class="muted">Di iPhone/iPad (iOS 16.4+), pasang game ke Layar Utama dulu, lalu buka dari ikonnya untuk mengaktifkan notifikasi.</p>
    {:else if push === 'denied'}
      <p class="muted">Notifikasi diblokir. Izinkan lewat pengaturan situs di browser, lalu muat ulang.</p>
    {:else}
      <p class="muted">Browser ini belum mendukung notifikasi push. Kabar tetap muncul di ikon lonceng di dalam game.</p>
    {/if}
    {#each NK as [k, l]}
      <label class="tg"><input type="checkbox" checked={nprefs[k] !== false} onchange={(e) => setNotif(k, (e.target as HTMLInputElement).checked)} /> {l}</label>
    {/each}
    {#if G.config?.email}
      {#if mailAddr}
        <label class="tg"><input type="checkbox" checked={nprefs.email !== false} onchange={(e) => setNotif('email', (e.target as HTMLInputElement).checked)} /> Kirim kabar penting ke email</label>
        <p class="muted small">Ke {mailAddr}: bukti pembelian Mutiara, event, dan pesan dari pengelola.</p>
      {:else}
        <p class="muted small">Sambungkan email atau Google supaya kabar penting juga dikirim ke email.</p>
      {/if}
    {/if}
    {#if G.config?.whatsapp}
      <div class="wa">
        <b>WhatsApp</b>
        {#if G.me.user.wa}
          <label class="tg"><input type="checkbox" checked={nprefs.whatsapp !== false} onchange={(e) => setNotif('whatsapp', (e.target as HTMLInputElement).checked)} /> Kirim kabar ke WhatsApp</label>
          <p class="muted small">Tersambung ke {G.me.user.wa.phone}. Balas STOP di WhatsApp kapan saja untuk berhenti.</p>
          <button class="link" onclick={waRemove}>Putuskan nomor</button>
        {:else if G.me.user.is_guest}
          <p class="muted small">Simpan progres dulu (Google atau email, di atas) untuk menyambungkan WhatsApp.</p>
        {:else if waStep === 'code'}
          <form class="row" onsubmit={waVerify}>
            <input class="input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6 angka" bind:value={waCode} aria-label="Kode dari WhatsApp" />
            <button class="btn hot" disabled={waBusy || waCode.length < 6}>Verifikasi</button>
          </form>
          <p class="muted small">Kode dikirim ke {waSentTo}. <button class="link" onclick={() => (waStep = 'idle')}>Ganti nomor</button></p>
        {:else}
          <form class="row" onsubmit={waStart}>
            <input class="input" type="tel" inputmode="tel" autocomplete="tel" placeholder="0812 3456 7890" bind:value={waPhone} aria-label="Nomor WhatsApp" />
            <button class="btn" disabled={waBusy || waPhone.replace(/\D/g, '').length < 9}>Kirim kode</button>
          </form>
          <p class="muted small">Dapat kabar penting (bukti pembelian, event) lewat WhatsApp. Kami kirim kode untuk memastikan nomornya milikmu.</p>
        {/if}
      </div>
    {/if}
  </section>

  <section>
    <h3>Aplikasi</h3>
    <label class="tg"><input type="checkbox" checked={prefs.sound} onchange={() => toggle('sound')} /> Suara</label>
    <label class="tg"><input type="checkbox" checked={prefs.haptics} onchange={() => toggle('haptics')} /> Getar</label>
    {#if !standalone}
      {#if installEvt}<button class="btn hot" onclick={install}>Pasang di layar utama</button>
      {:else if ios}<p class="muted">Pasang di iPhone: ketuk tombol <b>Bagikan</b> di Safari, lalu <b>Tambah ke Layar Utama</b>.</p>
      {:else}<p class="muted">Pasang di HP: buka menu browser, lalu pilih <b>Instal aplikasi</b> atau <b>Tambahkan ke layar utama</b>.</p>{/if}
    {/if}
  </section>

  <section>
    <h3>Tentang</h3>
    <p class="muted">BUPI versi {APP_VERSION}</p>
    <button class="btn" class:hot={!!G.whatsNew} onclick={() => (G.sheet = 'whatsnew')}>Apa yang baru{#if G.whatsNew} <span class="newdot" aria-label="ada pembaruan"></span>{/if}</button>
  </section>

  <section>
    <button class="btn block" onclick={logout}>Keluar</button>
    {#if G.me.user.is_guest}<p class="muted small">Keluar dari akun tamu akan menghilangkan progres. Sambungkan akun dulu.</p>{/if}
    <button class="link" onclick={() => (showDel = !showDel)}>Hapus akun</button>
    {#if showDel}
      <div class="del">
        <p>Semua data (pet, rumah, barang, teman) akan dihapus permanen. Ketik <b>HAPUS</b> untuk konfirmasi.</p>
        <div class="row"><input class="input" bind:value={del} aria-label="Konfirmasi hapus" /><button class="btn danger" disabled={del !== 'HAPUS'} onclick={deleteAccount}>Hapus</button></div>
      </div>
    {/if}
  </section>
</Sheet>

<style>
  section { display: flex; flex-direction: column; gap: 8px; border-bottom: 2px dashed #D9D2BF; padding-bottom: 14px; }
  section:last-child { border: 0; }
  h3 { margin: 0; font-size: 18px; font-weight: 800; }
  p { margin: 0; font-weight: 600; }
  .warn { background: #FBEFD2; border-radius: 10px; padding: 8px 10px; font-size: 14.5px; }
  .blk { justify-content: space-between; align-items: center; font-weight: 700; }
  .ok { background: #E6F3EC; border-radius: 10px; padding: 8px 10px; font-size: 14.5px; }
  .sub { font-size: 15px; margin-top: 4px; }
  .row { flex-wrap: wrap; }
  .muted { color: var(--muted); } .small { font-size: 13px; }
  .newdot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #E0583F; margin-left: 4px; }
  .wa { display: flex; flex-direction: column; gap: 6px; margin-top: 4px; }
  .wa .row input { flex: 1; min-width: 0; }
  form { display: flex; flex-direction: column; gap: 4px; }
  label { font-weight: 700; font-size: 14px; }
  .row { display: flex; gap: 8px; } .row .input { flex: 1; min-width: 0; }
  .tg { display: flex; align-items: center; gap: 10px; font-size: 16px; min-height: 40px; }
  .tg input { width: 22px; height: 22px; accent-color: #3FA06A; }
  .link { background: none; border: 0; color: #A93A27; font-weight: 700; text-decoration: underline; cursor: pointer; align-self: flex-start; padding: 6px 0; font-size: 14px; }
  .del { display: flex; flex-direction: column; gap: 8px; background: #F8E1DB; border-radius: 12px; padding: 10px; }
</style>
