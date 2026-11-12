<script lang="ts">
  // Akun saya: profil singkat + ganti password (tampil/sembunyi, ukuran kekuatan, cek ulang password).
  import { api } from '../lib/api';
  import { A, err, toast } from '../lib/store.svelte';
  import { I } from '../lib/icons';
  import PageHead from '../components/ui/PageHead.svelte';
  import Bar from '../components/ui/Bar.svelte';
  import Copy from '../components/ui/Copy.svelte';

  const ROLE: Record<string, [string, string, string]> = {
    owner: ['Pemilik', 'warn', 'Semua akses, termasuk harga Mutiara, admin lain, dan peluncuran.'],
    admin: ['Admin', 'blue', 'Konten, ekonomi, notifikasi, pembayaran, dan dompet pemain.'],
    moderator: ['Moderator', 'mute', 'Lihat data, blokir & bisukan pemain, ganti nama, moderasi kata.'],
  };
  const me = $derived(A.me?.admin);
  const role = $derived(ROLE[me?.role ?? 'moderator'] ?? ROLE.moderator);

  let current = $state(''), next = $state(''), again = $state('');
  let show = $state({ current: false, next: false, again: false });
  let busy = $state(false);

  /** skor 0–5 sederhana: panjang, huruf besar-kecil, angka, simbol; pola umum dianggap lemah */
  function strength(p: string) {
    let s = 0;
    if (p.length >= 10) s++;
    if (p.length >= 14) s++;
    if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
    if (/\d/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    if (p.length < 10 || /^(.)\1+$/.test(p) || /(password|rahasia|qwerty|123456|admin|bupi)/i.test(p)) s = Math.min(s, 1);
    return s;
  }
  const score = $derived(strength(next));
  const level = $derived(!next ? null : score <= 1 ? { t: 'Lemah', tone: 'no' as const } : score <= 3 ? { t: 'Sedang', tone: 'warn' as const } : { t: 'Kuat', tone: 'ok' as const });
  const tooShort = $derived(next.length > 0 && next.length < 10);
  const same = $derived(!!next && next === current);
  const match = $derived(!!again && again === next);
  const ok = $derived(!!current && next.length >= 10 && match && !same);

  async function save(e: Event) {
    e.preventDefault();
    if (!ok || busy) return;
    busy = true;
    try {
      await api.post('/api/admin/password', { current, next });
      toast('Password diganti. Pakai password baru saat masuk berikutnya.');
      current = next = again = '';
      show = { current: false, next: false, again: false };
    } catch (x) { err(x); } finally { busy = false; }
  }
</script>

<PageHead title="Akun saya" sub="Profil dan keamanan akun admin kamu." />

<div class="cols">
  <section class="card prof">
    <div class="who">
      <span class="av">{(me?.name || me?.email || '?').slice(0, 2).toUpperCase()}</span>
      <div class="t"><h2>{me?.name || me?.email?.split('@')[0]}</h2><span class="chip {role[1]}">{role[0]}</span></div>
    </div>
    <dl class="kv">
      <dt>Email</dt><dd>{me?.email}<Copy text={me?.email ?? ''} label="Email disalin" /></dd>
      <dt>Peran</dt><dd>{role[0]}</dd>
      <dt>Bisa</dt><dd class="muted">{role[2]}</dd>
    </dl>
    <p class="help">Nama, email, dan peran diubah oleh Pemilik di menu Admin.</p>
  </section>

  <form class="card f" onsubmit={save}>
    <h2>Ganti password</h2>
    <label>Password lama
      <span class="pw">
        <input type={show.current ? 'text' : 'password'} required bind:value={current} autocomplete="current-password" />
        <button type="button" class="eye" aria-label={show.current ? 'Sembunyikan password lama' : 'Tampilkan password lama'} aria-pressed={show.current} onclick={() => (show.current = !show.current)}>{@html show.current ? I.eyeOff : I.eye}</button>
      </span>
    </label>
    <label>Password baru
      <span class="pw">
        <input type={show.next ? 'text' : 'password'} minlength="10" required bind:value={next} autocomplete="new-password" class:bad={tooShort || same} aria-describedby="pw-meter" />
        <button type="button" class="eye" aria-label={show.next ? 'Sembunyikan password baru' : 'Tampilkan password baru'} aria-pressed={show.next} onclick={() => (show.next = !show.next)}>{@html show.next ? I.eyeOff : I.eye}</button>
      </span>
      <span class="meter" id="pw-meter" aria-live="polite">
        <Bar value={next ? Math.max(1, score) : 0} max={5} tone={level?.tone ?? 'ok'} h={6} label="Kekuatan password" />
        <span class="lv {level?.tone ?? ''}">{level ? level.t : 'Min. 10 karakter'}</span>
      </span>
      {#if tooShort}<span class="help bad">Kurang {10 - next.length} karakter lagi.</span>
      {:else if same}<span class="help bad">Password baru sama dengan yang lama.</span>
      {:else if level && level.t !== 'Kuat'}<span class="help">Tips: lebih panjang, campur huruf besar-kecil, angka, dan simbol.</span>{/if}
    </label>
    <label>Ulangi password baru
      <span class="pw">
        <input type={show.again ? 'text' : 'password'} required bind:value={again} autocomplete="new-password" class:bad={!!again && !match} />
        <button type="button" class="eye" aria-label={show.again ? 'Sembunyikan' : 'Tampilkan'} aria-pressed={show.again} onclick={() => (show.again = !show.again)}>{@html show.again ? I.eyeOff : I.eye}</button>
      </span>
      {#if again}
        {#if match}<span class="help okt"><span class="ic">{@html I.check}</span>Password cocok</span>{:else}<span class="help bad">Belum sama dengan password baru.</span>{/if}
      {/if}
    </label>
    <div class="row"><button class="btn primary" disabled={!ok} aria-busy={busy ? 'true' : undefined}>{@html I.key}Simpan password</button></div>
  </form>
</div>

<style>
  .cols { display: grid; grid-template-columns: minmax(0, 360px) minmax(0, 440px); gap: 14px; align-items: start; }
  @media (max-width: 900px) { .cols { grid-template-columns: 1fr; } }
  .prof, .f { display: flex; flex-direction: column; gap: 12px; }
  .who { display: flex; gap: 12px; align-items: center; }
  .av { width: 48px; height: 48px; border-radius: 50%; background: var(--accent-2); color: #fff; display: grid; place-items: center; font-weight: 800; flex: none; }
  .t { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; min-width: 0; }
  .t h2 { font-size: 20px; overflow-wrap: anywhere; }
  .help { margin: 0; }
  .pw { position: relative; display: flex; align-items: center; }
  .pw input { padding-right: 42px; }
  .eye { all: unset; position: absolute; right: 6px; width: 30px; height: 30px; display: grid; place-items: center; border-radius: 8px; color: var(--muted); cursor: pointer; }
  .eye:hover { background: var(--hover); color: var(--ink); }
  .eye:focus-visible { outline: 3px solid #3F7FBF; }
  .eye :global(svg) { width: 18px; height: 18px; }
  .meter { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; margin-top: 2px; }
  .lv { font-size: 12.5px; font-weight: 700; color: var(--muted); min-width: 64px; text-align: right; }
  .lv.no { color: var(--danger); } .lv.warn { color: var(--warn); } .lv.ok { color: var(--accent); }
  .okt { color: var(--accent); font-weight: 600; display: inline-flex; gap: 4px; align-items: center; }
  .okt .ic { width: 14px; height: 14px; }
  .btn :global(svg) { width: 15px; height: 15px; }
</style>
