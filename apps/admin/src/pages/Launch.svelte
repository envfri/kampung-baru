<script lang="ts">
  // Persiapan peluncuran: ringkasan & daftar langkah dengan bar progres, tarik Mutiara uji (ketik TARIK),
  // dan cut-off supaya semua pemain mulai dari 0 (ketik RESET BUPI, dengan ringkasan Sebelum → Sesudah).
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { can, err, toast, ask, num, rp, dt } from '../lib/store.svelte';
  import { I } from '../lib/icons';
  import PageHead from '../components/ui/PageHead.svelte';
  import Stat from '../components/ui/Stat.svelte';
  import Section from '../components/ui/Section.svelte';
  import Switch from '../components/ui/Switch.svelte';
  import Bar from '../components/ui/Bar.svelte';
  import Ago from '../components/ui/Ago.svelte';

  let s = $state<any>(null), updated = $state(0);
  let revokeBusy = $state(false), resetBusy = $state(false);
  let mode = $state<'progress' | 'all'>('progress');
  let keepFriends = $state(true), analytics = $state(true), includeReal = $state(false), backup = $state(false);
  const PHRASE = 'RESET BUPI';
  const owner = $derived(can('owner'));

  async function load() { try { s = await api.get('/api/admin/launch'); updated = Date.now(); } catch (e) { err(e); } }
  onMount(load);

  const pay = $derived(s?.payment);
  const payLabel = $derived(!pay ? '' : pay.provider === 'mock' ? 'Simulasi' : pay.provider === 'zepay' ? `ZePay ${pay.mode === 'live' ? 'live' : pay.mode === 'test' ? 'uji' : ''}` : pay.provider);
  const realBlocked = $derived(!!s?.real?.payments && mode === 'all');
  const ready = $derived(backup && !realBlocked && (!s?.real?.payments || includeReal));

  // daftar langkah peluncuran (yang bisa dicek otomatis)
  const steps = $derived(!s ? [] : [
    { done: !s.demo.payments, t: 'Tarik Mutiara uji', d: s.demo.payments ? `${num(s.demo.pearls)} Mutiara dari ${s.demo.payments} pembayaran uji masih beredar` : 'Tidak ada Mutiara uji yang beredar', href: '#demo' },
    { done: !!s.cutoff, t: 'Cut-off peluncuran', d: s.cutoff ? `Selesai ${dt(s.cutoff.at)}` : 'Semua pemain mulai dari 0', href: '#cut' },
    { done: !!pay.production, t: 'Server mode produksi', d: pay.production ? 'NODE_ENV=production' : 'Jalankan dengan NODE_ENV=production', href: '' },
    { done: pay.provider === 'zepay' && pay.mode === 'live', t: 'Pembayaran live', d: pay.provider === 'zepay' && pay.mode === 'live' ? 'ZePay kunci live aktif' : 'Ganti ke kunci live ZePay, lalu daftarkan webhook di Pembayaran', href: '#/payments' },
  ]);
  const doneN = $derived(steps.filter((x) => x.done).length);
  function jump(href: string) {
    if (href.startsWith('#/')) { location.hash = href; return; }
    document.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function revoke() {
    const ok = await ask({
      title: 'Tarik Mutiara uji?', tone: 'danger', icon: 'gem',
      body: `Mutiara dari ${s.demo.payments} pembayaran uji milik ${s.demo.users} pemain ditarik kembali. Yang sudah terlanjur dibelanjakan tidak bisa ditarik (saldo tidak dibuat minus). Tercatat di log audit.`,
      diff: [
        { label: 'Mutiara uji beredar', before: num(s.demo.pearls), after: '0' },
        { label: 'Pembayaran uji aktif', before: String(s.demo.payments), after: '0 (ditandai ditarik)' },
        { label: 'Total Mutiara beredar', before: num(s.pearls), after: `± ${num(Math.max(0, s.pearls - s.demo.pearls))}` },
      ],
      typeToConfirm: 'TARIK', confirm: 'Tarik Mutiara',
    });
    if (!ok) return;
    revokeBusy = true;
    try {
      const r = await api.post('/api/admin/launch/revoke-demo');
      s = r.stats; updated = Date.now();
      toast(`${num(r.revoked)} Mutiara ditarik dari ${r.users} pemain${r.spent ? `; ${num(r.spent)} sudah terlanjur dipakai` : ''}.`);
    } catch (e) { err(e); } finally { revokeBusy = false; }
  }

  async function reset() {
    const all = mode === 'all';
    const diff = [
      { label: 'Akun pemain', before: `${num(s.players)} akun`, after: all ? '0 (semua dihapus)' : `${num(s.players)} akun, mulai dari 0` },
      { label: 'Pet', before: num(s.pets), after: '0 (dibuat ulang oleh pemain)' },
      { label: 'Koin beredar', before: num(s.coins), after: all ? '0' : 'modal awal per pemain' },
      { label: 'Mutiara beredar', before: num(s.pearls), after: all ? '0' : 'modal awal per pemain' },
      ...(all ? [] : [{ label: 'Daftar teman', before: 'ada', after: keepFriends ? 'tetap' : 'dihapus' }]),
      { label: 'Data analitik', before: 'ada', after: analytics ? 'dihapus (dasbor dari 0)' : 'tetap' },
      ...(s.real.payments ? [{ label: 'Pembayaran sungguhan', before: `${s.real.payments} (${rp(s.real.amount)})`, after: 'catatan tetap, Mutiara direset' }] : []),
    ];
    const ok = await ask({
      title: all ? 'Hapus semua pemain?' : 'Jalankan cut-off peluncuran?', tone: 'danger', icon: 'rocket',
      body: all ? 'Semua akun pemain dihapus; semua orang perlu daftar ulang. Konten & pengaturan admin tidak tersentuh.' : 'Semua pemain mulai dari 0: akun & cara masuk tetap, pet dibuat ulang, dompet & barang kembali ke modal awal. Konten & pengaturan admin tidak tersentuh.',
      diff, note: 'Tidak bisa dibatalkan. Pastikan cadangan database sudah dibuat.',
      typeToConfirm: PHRASE, confirm: all ? 'Hapus semua pemain' : 'Jalankan cut-off',
    });
    if (!ok) return;
    resetBusy = true;
    try {
      const r = await api.post('/api/admin/launch/reset', { mode, keepFriends, analytics, includeReal, confirm: PHRASE });
      s = r.stats; backup = false; includeReal = false; updated = Date.now();
      toast(`Cut-off selesai: ${num(r.cutoff.players)} pemain ${all ? 'dihapus' : 'mulai dari 0'}.`);
    } catch (e) { err(e); } finally { resetBusy = false; }
  }
</script>

<PageHead title="Peluncuran" updated={updated} onrefresh={load}>
  <span>Persiapan sebelum game dibuka untuk umum: Mutiara uji tidak boleh terbawa ke produksi, dan <b>cut-off</b> membuat semua pemain mulai dari 0</span>
</PageHead>

{#if !s}
  <div class="stats">{#each Array(4) as _}<div class="card sk"><span class="skel" style="width:40%"></span><span class="skel" style="width:70%"></span></div>{/each}</div>
  <div class="card sk tall"><span class="skel" style="width:30%"></span><span class="skel"></span></div>
{:else}
  <div class="stats">
    <Stat icon="card" value={payLabel} label={pay.provider === 'mock' ? (pay.locked ? 'Pembayaran · terkunci untuk pemain' : 'Pembayaran · pemain bisa beli gratis') : pay.mode === 'test' ? 'Pembayaran · QR uji' : 'Pembayaran'} tone={pay.provider === 'zepay' && pay.mode === 'live' ? 'ok' : 'warn'} />
    <Stat icon="users" value={num(s.players)} label={`Pemain · ${num(s.guests)} tamu · ${num(s.pets)} pet`} tone="blue" />
    <Stat icon="gem" value={num(s.pearls)} label={`Mutiara beredar · ${num(s.coins)} koin`} tone="blue" />
    <Stat icon="coin" value={rp(s.real.amount)} label={`${num(s.real.payments)} pembayaran sungguhan`} />
  </div>

  {#if pay.provider === 'mock' && !pay.production}
    <p class="alert warn"><span class="ic">{@html I.warn}</span><span>Server ini bukan mode produksi (NODE_ENV bukan production): pembelian simulasi terbuka untuk semua pemain, Mutiara gratis. Di server publik, jalankan dengan NODE_ENV=production supaya simulasi hanya bisa dipakai admin yang sedang login.</span></p>
  {:else if pay.provider === 'mock'}
    <p class="alert ok"><span class="ic">{@html I.info}</span><span>Pemain melihat "Pembelian Mutiara belum dibuka". Kamu (admin yang login di browser ini) tetap bisa mencoba alur beli di game; Mutiara-nya ditandai uji.</span></p>
  {/if}

  <section class="card prog">
    <div class="ph"><h2>Langkah peluncuran</h2><b>{doneN}/{steps.length} siap</b></div>
    <Bar value={doneN} max={steps.length} h={8} tone={doneN === steps.length ? 'ok' : 'blue'} label="Kesiapan peluncuran" />
    <ol class="steps">
      {#each steps as x}
        <li class:done={x.done}>
          <span class="ck">{@html x.done ? I.check : ''}</span>
          <span class="tx"><b>{x.t}</b><small>{x.d}</small></span>
          {#if !x.done && x.href}<button class="btn sm" onclick={() => jump(x.href)}>Buka{@html I.right}</button>{/if}
        </li>
      {/each}
    </ol>
    <p class="muted small">Urutan yang disarankan: cadangkan database → tarik Mutiara uji → cut-off → kunci live ZePay & restart → daftarkan webhook di Pembayaran → umumkan lewat <a href="#/announcements">Pengumuman</a> / <a href="#/broadcasts">Broadcast</a>.</p>
    {#if s.cutoff}
      <p class="alert ok"><span class="ic">{@html I.check}</span><span>Cut-off terakhir <b>{dt(s.cutoff.at)}</b> (<Ago t={s.cutoff.at} />) oleh {s.cutoff.by} · {s.cutoff.mode === 'all' ? 'semua pemain dihapus' : 'progres direset, akun tetap'} · {num(s.cutoff.players)} pemain{s.cutoff.version ? ` · v${s.cutoff.version}` : ''}</span></p>
    {/if}
  </section>

  <Section title="Mutiara dari pembayaran uji" id="demo" prefKey="launch:demo">
    {#snippet badge()}{#if s.demo.payments}<span class="chip warn">{num(s.demo.pearls)} Mutiara beredar</span>{:else}<span class="chip">bersih</span>{/if}{/snippet}
    <p class="muted small">Pembelian lewat halaman simulasi atau kunci uji ZePay (zpk_test_…) ditandai "uji". Tarik kembali Mutiara-nya tanpa mereset yang lain. Yang sudah dibelanjakan tidak bisa ditarik; cut-off di bawah membersihkan semuanya.</p>
    <div class="mini">
      <div><b>{num(s.demo.pearls)}</b><span>Mutiara uji</span></div>
      <div><b>{num(s.demo.payments)}</b><span>Pembayaran uji</span></div>
      <div><b>{num(s.demo.users)}</b><span>Pemain</span></div>
    </div>
    {#if owner}
      <div class="row"><button class="btn danger" disabled={!s.demo.payments} aria-busy={revokeBusy ? 'true' : undefined} onclick={revoke}>{@html I.gem}Tarik Mutiara uji…</button>
        {#if !s.demo.payments}<span class="muted small">Tidak ada yang perlu ditarik.</span>{/if}</div>
    {:else}<p class="muted small">Hanya pemilik yang bisa menarik Mutiara.</p>{/if}
  </Section>

  <div class="danger-wrap">
    <Section title="Cut-off peluncuran" id="cut" prefKey="launch:cut">
      {#snippet badge()}<span class="chip no">tidak bisa dibatalkan</span>{/snippet}
      <p>Semua pemain mulai dari nol supaya setara saat produksi dibuka.</p>
      <div class="lists">
        <div class="lst reset"><b>{@html I.undo}Yang direset</b>
          <ul><li>Pet (pemain membuat pet baru)</li><li>Koin & Mutiara (kembali ke modal awal)</li><li>Tas, rumah & ruangan, kebun, ikan, koleksi</li><li>Tugas, lencana, hadiah harian, event, duel, kunjungan, hadiah teman, suka rumah</li><li>Notifikasi di game & pesan yang belum terkirim</li><li>Pembayaran uji</li></ul>
        </div>
        <div class="lst keep"><b>{@html I.check}Yang tetap</b>
          <ul><li>Item, harga, event, tugas, peta, pengaturan, paket Mutiara, pengumuman, media</li><li>Akun admin, log audit, riwayat email/WA</li><li>Catatan pembayaran sungguhan (laporan keuangan)</li></ul>
        </div>
      </div>
      {#if owner}
        <fieldset class="modes">
          <legend>Cara cut-off</legend>
          <label class="ro" class:on={mode === 'progress'}><input type="radio" bind:group={mode} value="progress" /><span><b>Reset progres, akun tetap <em class="chip">disarankan</em></b><small>Pemain uji tetap bisa masuk dengan Google/email/akun tamunya, lalu membuat pet baru dari awal.</small></span></label>
          <label class="ro" class:on={mode === 'all'} class:blocked={!!s.real.payments}><input type="radio" bind:group={mode} value="all" /><span><b>Hapus semua pemain</b><small>Semua akun hilang; semua orang daftar ulang.{#if s.real.payments} Tidak bisa dipakai karena sudah ada pembayaran sungguhan.{/if}</small></span></label>
        </fieldset>
        <div class="sws">
          {#if mode === 'progress'}<Switch bind:checked={keepFriends} label="Pertahankan daftar teman" />{/if}
          <Switch bind:checked={analytics} label="Hapus data analitik masa uji" help="Dasbor mulai dari 0." />
        </div>
        {#if s.real.payments}
          <p class="alert warn"><span class="ic">{@html I.warn}</span><span>Sudah ada {s.real.payments} pembayaran sungguhan ({rp(s.real.amount)}, {num(s.real.pearls)} Mutiara). Catatannya tetap disimpan, tetapi Mutiara-nya ikut direset.</span></p>
          {#if mode === 'progress'}<label class="inline cb"><input type="checkbox" bind:checked={includeReal} /><span>Saya paham, Mutiara dari pembayaran sungguhan ikut direset</span></label>{/if}
        {/if}
        <label class="inline cb"><input type="checkbox" bind:checked={backup} /><span>Saya sudah membuat cadangan database (<span class="mono">./deploy/backup.sh</span> di server)</span></label>
        <div class="row">
          <button class="btn danger solid" disabled={!ready} aria-busy={resetBusy ? 'true' : undefined} onclick={reset}>{@html I.rocket}{mode === 'all' ? 'Hapus semua pemain…' : 'Jalankan cut-off…'}</button>
          {#if !ready}<span class="muted small">{realBlocked ? 'Pilih "Reset progres, akun tetap".' : !backup ? 'Centang konfirmasi cadangan dulu.' : 'Centang konfirmasi pembayaran sungguhan.'}</span>{:else}<span class="muted small">Ringkasan perubahan muncul dulu; ketik {PHRASE} untuk menjalankan.</span>{/if}
        </div>
      {:else}<p class="muted small">Hanya pemilik yang bisa menjalankan cut-off.</p>{/if}
    </Section>
  </div>
{/if}

<style>
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }
  .sk { display: flex; flex-direction: column; gap: 10px; padding: 16px; }
  .sk.tall { min-height: 140px; }
  .small { font-size: 13px; margin: 0; }
  p { margin: 0; }
  .alert { display: flex; gap: 8px; align-items: flex-start; border-radius: 10px; padding: 9px 12px; font-weight: 600; font-size: 13.5px; }
  .alert.warn { background: var(--warn-soft); color: var(--warn); }
  .alert.ok { background: var(--accent-soft); color: #1C5E4D; }
  .alert .ic { width: 17px; height: 17px; margin-top: 1px; }
  .prog { display: flex; flex-direction: column; gap: 12px; }
  .ph { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
  .ph h2 { font-size: 18px; }
  .ph b { font: 800 18px var(--display); color: var(--accent); }
  .steps { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr)); gap: 8px; }
  .steps li { display: flex; gap: 10px; align-items: center; border: 1px solid var(--line); border-radius: 12px; padding: 9px 10px; background: #FBFCFB; }
  .steps li.done { background: #F3FAF7; border-color: #C9E6DA; }
  .ck { width: 22px; height: 22px; border-radius: 50%; border: 2px solid #C5CDC8; display: grid; place-items: center; flex: none; padding: 3px; color: #fff; }
  .done .ck { background: var(--accent); border-color: var(--accent); }
  .ck :global(svg) { width: 100%; height: 100%; }
  .tx { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .tx small { color: var(--muted); font-size: 12.5px; }
  .steps .btn :global(svg) { width: 14px; height: 14px; }
  .mini { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; max-width: 520px; }
  .mini div { background: #F6F8F6; border-radius: 10px; padding: 8px 12px; }
  .mini b { font: 800 22px var(--display); display: block; } .mini span { font-size: 12px; color: var(--muted); font-weight: 600; }
  .danger-wrap :global(.sec) { border-color: #E2A99C; }
  .lists { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 10px; }
  .lst { border-radius: 12px; padding: 10px 12px; }
  .lst b { display: flex; gap: 6px; align-items: center; }
  .lst b :global(svg) { width: 15px; height: 15px; }
  .lst.reset { background: var(--danger-soft); } .lst.reset b { color: var(--danger); }
  .lst.keep { background: var(--accent-soft); } .lst.keep b { color: var(--accent); }
  ul { margin: 6px 0 0; padding-left: 18px; font-size: 13.5px; display: flex; flex-direction: column; gap: 2px; }
  .modes { gap: 6px; }
  .ro { flex-direction: row; align-items: flex-start; gap: 10px; padding: 8px 10px; border: 1.5px solid var(--line); border-radius: 10px; cursor: pointer; font-weight: 500; }
  .ro.on { border-color: var(--accent); background: #F3FAF7; }
  .ro.on.blocked { border-color: var(--danger); background: var(--danger-soft); }
  .ro input { width: 18px; height: 18px; min-height: 0; margin-top: 2px; accent-color: var(--accent); flex: none; }
  .ro span { display: flex; flex-direction: column; } .ro small { color: var(--muted); font-size: 12.5px; }
  .ro em { font-style: normal; margin-left: 4px; vertical-align: 1px; }
  .sws { display: flex; flex-wrap: wrap; gap: 12px 28px; }
  .cb { font-weight: 500; font-size: 14px; align-items: flex-start; }
  .cb input { margin-top: 1px; }
  .btn :global(svg) { width: 15px; height: 15px; }
  @media (max-width: 760px) {
    .stats { display: flex; overflow-x: auto; scrollbar-width: none; margin: 0 -14px; padding: 0 14px; }
    .stats > :global(.stat) { flex: none; min-width: 180px; }
  }
</style>
