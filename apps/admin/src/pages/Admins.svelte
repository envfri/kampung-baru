<script lang="ts">
  // Admin (khusus Pemilik): daftar admin dengan cari/filter/urut/CSV, tambah admin di modal,
  // ubah peran dengan ringkasan Sebelum → Sesudah, hapus dengan mengetik email admin.
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { A, err, toast, ask, setQuery } from '../lib/store.svelte';
  import { type FDef, readFilters } from '../lib/filters';
  import { I } from '../lib/icons';
  import PageHead from '../components/ui/PageHead.svelte';
  import FilterBar from '../components/ui/FilterBar.svelte';
  import DataTable, { type Col, type TState } from '../components/ui/DataTable.svelte';
  import Modal from '../components/ui/Modal.svelte';
  import Ago from '../components/ui/Ago.svelte';
  import Copy from '../components/ui/Copy.svelte';

  const ROLE: Record<string, { t: string; tone: string; can: string }> = {
    owner: { t: 'Pemilik', tone: 'warn', can: 'Semua akses, termasuk harga Mutiara, admin lain, dan peluncuran.' },
    admin: { t: 'Admin', tone: 'blue', can: 'Konten, ekonomi, notifikasi, pembayaran, dan dompet pemain.' },
    moderator: { t: 'Moderator', tone: 'mute', can: 'Lihat data, blokir & bisukan pemain, ganti nama, moderasi kata.' },
  };
  const RANK: Record<string, number> = { moderator: 1, admin: 2, owner: 3 };
  const FILTERS: FDef[] = [
    { key: 'role', label: 'Peran', all: 'Semua', options: [['owner', 'Pemilik'], ['admin', 'Admin'], ['moderator', 'Moderator']] },
    { key: 'login', label: 'Login', all: 'Kapan saja', options: [['7', '7 hari terakhir'], ['30', '30 hari terakhir'], ['idle', 'Belum login > 30 hari']] },
  ];
  const COLS: Col[] = [
    { key: 'email', label: 'Email', req: true, card: 'title', sort: true, snip: true, text: (r) => r.email },
    { key: 'name', label: 'Nama', sort: true, text: (r) => r.name || '' },
    { key: 'role', label: 'Peran', sort: true, snip: true, text: (r) => ROLE[r.role]?.t ?? r.role },
    { key: 'last_login_at', label: 'Login terakhir', sort: true, snip: true, text: (r) => r.last_login_at },
    { key: 'created_at', label: 'Ditambahkan', sort: true, off: true, snip: true, text: (r) => r.created_at },
    { key: '_act', label: '', req: true, snip: true },
  ];

  let rows = $state<any[]>([]), loading = $state(true), updated = $state(0);
  let q = $state(A.query.q ?? '');
  let vals = $state<Record<string, any>>(readFilters(FILTERS, A.query));
  let ts = $state<TState>({ page: 0, size: 25, sort: '', dir: 'desc' });
  const myId = $derived(A.me?.admin.id);

  async function load() {
    loading = true;
    try { rows = (await api.get('/api/admin/admins')).admins; updated = Date.now(); } catch (e) { err(e); }
    loading = false;
  }
  onMount(load);

  const DAY = 86_400_000;
  const view = $derived(rows.filter((r) => {
    const s = q.trim().toLowerCase();
    if (s && !`${r.email} ${r.name ?? ''}`.toLowerCase().includes(s)) return false;
    if (vals.role && r.role !== vals.role) return false;
    const last = r.last_login_at ? new Date(r.last_login_at).getTime() : 0;
    if (vals.login === '7' && Date.now() - last > 7 * DAY) return false;
    if (vals.login === '30' && Date.now() - last > 30 * DAY) return false;
    if (vals.login === 'idle' && last && Date.now() - last <= 30 * DAY) return false;
    return true;
  }));
  const counts = $derived(Object.fromEntries(Object.keys(ROLE).map((k) => [k, rows.filter((r) => r.role === k).length])));

  /* ---------- ubah peran ---------- */
  async function changeRole(r: any, next: string, el: HTMLSelectElement) {
    if (next === r.role) return;
    const who = r.name || r.email;
    const res = await ask({
      title: `Ubah peran ${who}?`,
      body: `Berlaku langsung di permintaan berikutnya. Sekarang ${who} bisa: ${ROLE[next].can.charAt(0).toLowerCase() + ROLE[next].can.slice(1)}`,
      diff: [{ label: 'Peran', before: ROLE[r.role]?.t ?? r.role, after: ROLE[next].t }],
      tone: next === 'owner' || r.role === 'owner' ? 'warn' : 'info', icon: 'key',
      note: next === 'owner' ? 'Pemilik bisa menambah & menghapus admin lain, termasuk kamu.' : RANK[next] < RANK[r.role] ? `${who} kehilangan sebagian akses.` : undefined,
      confirm: 'Ubah peran',
    });
    if (!res) { el.value = r.role; return; }
    try { await api.put(`/api/admin/admins/${r.id}`, { role: next }); toast(`Peran ${who} jadi ${ROLE[next].t}`); load(); }
    catch (e) { err(e); el.value = r.role; }
  }

  /* ---------- hapus ---------- */
  async function remove(r: any) {
    const res = await ask({
      title: `Hapus admin ${r.name || r.email}?`,
      body: 'Akun ini tidak bisa masuk ke panel admin lagi. Riwayatnya di log audit tetap tersimpan.',
      tone: 'danger', icon: 'trash', typeToConfirm: r.email, confirm: 'Hapus admin',
    });
    if (!res) return;
    try { await api.del(`/api/admin/admins/${r.id}`); toast(`${r.email} dihapus`); load(); } catch (e) { err(e); }
  }

  /* ---------- tambah ---------- */
  let add = $state<null | { email: string; name: string; password: string; role: string; show: boolean; busy: boolean; tried: boolean }>(null);
  const emailOk = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
  const addOk = $derived(!!add && emailOk(add.email) && add.password.length >= 10);
  function openAdd() { add = { email: '', name: '', password: '', role: 'moderator', show: false, busy: false, tried: false }; }
  function genPw() {
    if (!add) return;
    const cs = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%*-_';
    const b = new Uint32Array(16); crypto.getRandomValues(b);
    add.password = Array.from(b, (n) => cs[n % cs.length]).join('');
    add.show = true;
  }
  async function submitAdd(e?: Event) {
    e?.preventDefault();
    if (!add) return;
    add.tried = true;
    if (!addOk) return;
    add.busy = true;
    try {
      await api.post('/api/admin/admins', { email: add.email.trim(), name: add.name.trim(), password: add.password, role: add.role });
      toast(`${add.email.trim()} ditambahkan sebagai ${ROLE[add.role].t}. Kirim password awalnya lewat jalur aman.`);
      add = null; load();
    } catch (x) { err(x); if (add) add.busy = false; }
  }
</script>

<PageHead title="Admin" updated={updated} onrefresh={load}>
  {rows.length} akun dengan akses panel admin
  {#snippet actions()}<button class="btn primary" onclick={openAdd}>{@html I.plus}Tambah admin</button>{/snippet}
</PageHead>

<div class="roles">
  {#each Object.entries(ROLE) as [k, r] (k)}
    <button class="rl" class:on={vals.role === k} onclick={() => { vals.role = vals.role === k ? '' : k; setQuery({ q, ...vals }); }} aria-pressed={vals.role === k}>
      <span class="rh"><span class="chip {r.tone}">{r.t}</span><b>{counts[k] ?? 0}</b></span><small>{r.can}</small>
    </button>
  {/each}
</div>

<FilterBar bind:q bind:values={vals} filters={FILTERS} placeholder="Cari email atau nama" count={view.length} />

<DataTable cols={COLS} rows={view} bind:state={ts} {loading} prefKey="admins" csv="local" csvName="admin"
  empty={rows.length ? 'Tidak ada admin yang cocok' : 'Belum ada admin'} emptyText={rows.length ? 'Coba ubah kata kunci atau hapus filter.' : ''} emptyIcon="key"
  rowClass={(r) => (r.id === myId ? 'me' : '')}>
  {#snippet cell(r, k)}
    {#if k === 'email'}
      <span class="em"><b>{r.email}</b><Copy text={r.email} label="Email disalin" />{#if r.id === myId}<span class="chip blue">Kamu</span>{/if}</span>
    {:else if k === 'role'}
      <span class="chip {ROLE[r.role]?.tone ?? ''}">{ROLE[r.role]?.t ?? r.role}</span>
    {:else if k === 'last_login_at'}
      {#if r.last_login_at}<Ago t={r.last_login_at} />{:else}<span class="muted">Belum pernah</span>{/if}
    {:else if k === 'created_at'}<Ago t={r.created_at} />
    {:else if k === '_act'}
      {#if r.id !== myId}
        <span class="acts">
          <select class="rsel" value={r.role} aria-label="Ubah peran {r.email}" onchange={(e) => changeRole(r, (e.target as HTMLSelectElement).value, e.target as HTMLSelectElement)}>
            <option value="owner">Pemilik</option><option value="admin">Admin</option><option value="moderator">Moderator</option>
          </select>
          <button class="btn sm danger" onclick={() => remove(r)} aria-label="Hapus {r.email}">{@html I.trash}<span class="hide-s">Hapus</span></button>
        </span>
      {:else}<span class="muted small">akunmu</span>{/if}
    {/if}
  {/snippet}
  {#snippet emptyActions()}{#if !rows.length}<button class="btn primary" onclick={openAdd}>{@html I.plus}Tambah admin</button>{/if}{/snippet}
</DataTable>

{#if add}
  <Modal title="Tambah admin" sub="Admin baru bisa langsung masuk dengan email & password awal ini." icon="key" tone="ok" onclose={() => (add = null)}>
    <form class="af" id="add-admin" novalidate onsubmit={submitAdd}>
      <label>Email<input type="email" required bind:value={add.email} autocomplete="off" class:bad={add.tried && !emailOk(add.email)} />
        {#if add.tried && !emailOk(add.email)}<span class="help bad">Isi alamat email yang valid.</span>{/if}</label>
      <label><span>Nama <small class="help">opsional</small></span><input bind:value={add.name} maxlength="60" placeholder="mis. Rina (CS)" /></label>
      <label>Password awal
        <span class="pw">
          <input type={add.show ? 'text' : 'password'} minlength="10" required bind:value={add.password} autocomplete="new-password" class:bad={add.tried && add.password.length < 10} />
          <button type="button" class="eye" aria-label={add.show ? 'Sembunyikan password' : 'Tampilkan password'} aria-pressed={add.show} onclick={() => add && (add.show = !add.show)}>{@html add.show ? I.eyeOff : I.eye}</button>
        </span>
        <span class="pwh">
          <span class="help" class:bad={add.tried && add.password.length < 10}>{add.password.length < 10 ? `Min. 10 karakter (${add.password.length}/10)` : 'Panjang cukup'}</span>
          <span class="row">
            {#if add.password && add.show}<Copy text={add.password} label="Password disalin" />{/if}
            <button type="button" class="link" onclick={genPw}>Buat acak</button>
          </span>
        </span>
      </label>
      <fieldset class="rp">
        <legend>Peran</legend>
        {#each ['moderator', 'admin', 'owner'] as k}
          <label class="ro" class:on={add.role === k}><input type="radio" bind:group={add.role} value={k} /><span><b>{ROLE[k].t}</b><small>{ROLE[k].can}</small></span></label>
        {/each}
      </fieldset>
    </form>
    {#snippet footer()}
      <button class="btn" onclick={() => (add = null)}>Batal</button>
      <button class="btn primary" form="add-admin" aria-busy={add?.busy ? 'true' : undefined}>{@html I.plus}Tambah admin</button>
    {/snippet}
  </Modal>
{/if}

<style>
  .roles { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr)); gap: 8px; }
  .rl { all: unset; box-sizing: border-box; cursor: pointer; background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 9px 12px; display: flex; flex-direction: column; gap: 4px; align-items: flex-start; transition: border-color .15s, box-shadow .15s; }
  .rl:hover { border-color: #AEB8B2; }
  .rl.on { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
  .rl:focus-visible { outline: 3px solid #3F7FBF; }
  .rl small { color: var(--muted); font-size: 12.5px; line-height: 1.35; }
  .em { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; min-width: 0; }
  .em b { overflow-wrap: anywhere; }
  .acts { display: inline-flex; gap: 6px; align-items: center; justify-content: flex-end; }
  .rsel { width: auto; min-height: 30px; padding: 3px 8px; font-size: 13px; }
  .small { font-size: 12.5px; }
  .rh { display: flex; justify-content: space-between; align-items: center; width: 100%; }
  .rh b { font: 800 18px var(--display); line-height: 1; }
  @media (min-width: 761px) { :global(tr.me td) { background: #FBFCF7; } }
  .af { display: flex; flex-direction: column; gap: 12px; }
  .pw { position: relative; display: flex; align-items: center; }
  .pw input { padding-right: 42px; }
  .eye { all: unset; position: absolute; right: 6px; width: 30px; height: 30px; display: grid; place-items: center; border-radius: 8px; color: var(--muted); cursor: pointer; }
  .eye:hover { background: var(--hover); color: var(--ink); }
  .eye:focus-visible { outline: 3px solid #3F7FBF; }
  .eye :global(svg) { width: 18px; height: 18px; }
  .pwh { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .pwh .row { gap: 8px; }
  .rp { gap: 6px; }
  .ro { flex-direction: row; align-items: flex-start; gap: 10px; padding: 8px 10px; border: 1.5px solid var(--line); border-radius: 10px; cursor: pointer; font-weight: 500; }
  .ro.on { border-color: var(--accent); background: #F3FAF7; }
  .ro input { width: 18px; height: 18px; min-height: 0; margin-top: 2px; accent-color: var(--accent); flex: none; }
  .ro span { display: flex; flex-direction: column; } .ro small { color: var(--muted); font-size: 12.5px; }
  .btn :global(svg) { width: 15px; height: 15px; }
  @media (max-width: 760px) {
    .hide-s { display: none; } .acts { justify-content: flex-start; }
    .roles { display: flex; overflow-x: auto; scrollbar-width: none; margin: 0 -14px; padding: 2px 14px; }
    .rl { flex: none; width: 210px; }
  }
</style>
