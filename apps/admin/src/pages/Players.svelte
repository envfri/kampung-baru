<script lang="ts">
  import { onMount } from 'svelte';
  import { petSVG } from '@kb/shared';
  import { api } from '../lib/api';
  import { can, err, toast, num, dt, rp } from '../lib/store.svelte';
  import Drawer from '../components/Drawer.svelte';
  let q = $state(''), filter = $state(''), page = $state(0);
  let rows = $state<any[]>([]);
  let d = $state<any>(null);
  let busy = $state(false);
  let wallet = $state({ currency: 'coin', delta: 0, reason: '' });
  let give = $state({ itemId: '', qty: 1 });
  let ban = $state(''), rename = $state({ petName: '', displayName: '' }), note = $state({ title: '', body: '' });
  let items = $state<any[]>([]);

  async function load() { try { rows = (await api.get(`/api/admin/players?q=${encodeURIComponent(q)}&filter=${filter}&page=${page}`)).players; } catch (e) { err(e); } }
  onMount(async () => { load(); try { items = (await api.get('/api/admin/items')).items; } catch { /* moderator boleh tidak melihat */ } });
  let t: any;
  const search = () => { clearTimeout(t); t = setTimeout(() => { page = 0; load(); }, 300); };
  async function open(id: string) { try { d = await api.get(`/api/admin/players/${id}`); rename = { petName: d.pet?.name ?? '', displayName: d.user.display_name }; } catch (e) { err(e); } }
  async function act(fn: () => Promise<any>, msg: string) {
    busy = true;
    try { await fn(); toast(msg); await open(d.user.id); load(); } catch (e) { err(e); } finally { busy = false; }
  }
  const P: Record<string, string> = { email: 'Email', google: 'Google', facebook: 'Facebook', guest: 'Tamu' };
</script>

<h1>Pemain</h1>
<div class="row">
  <input placeholder="Cari nama, nama pet, kode teman, email, atau ID" bind:value={q} oninput={search} style="max-width:380px" aria-label="Cari pemain" />
  <select bind:value={filter} onchange={() => { page = 0; load(); }} style="max-width:200px" aria-label="Filter">
    <option value="">Semua</option><option value="guest">Tamu</option><option value="payer">Pernah membayar</option><option value="banned">Diblokir</option>
  </select>
</div>
<div class="tbl">
  <table>
    <thead><tr><th>Pemain</th><th>Pet</th><th class="num">Lv</th><th class="num">Koin</th><th class="num">Mutiara</th><th>Terakhir aktif</th><th>Status</th></tr></thead>
    <tbody>
      {#each rows as r (r.id)}
        <tr class="click" onclick={() => open(r.id)}>
          <td><b>{r.display_name}</b><br /><span class="mono muted">{r.friend_code}</span></td>
          <td>{r.pet_name ?? '—'}</td><td class="num">{r.level ?? '—'}</td>
          <td class="num">{num(r.coin ?? 0)}</td><td class="num">{num(r.pearl ?? 0)}</td>
          <td>{dt(r.last_seen_at)}</td>
          <td>{#if r.banned_at}<span class="chip no">Diblokir</span>{:else if r.is_guest}<span class="chip mute">Tamu</span>{:else}<span class="chip">Akun</span>{/if}</td>
        </tr>
      {:else}<tr><td colspan="7" class="muted">Tidak ada pemain.</td></tr>{/each}
    </tbody>
  </table>
</div>
<div class="row">
  <button class="btn sm" disabled={page === 0} onclick={() => { page--; load(); }}>Sebelumnya</button>
  <span class="muted">Halaman {page + 1}</span>
  <button class="btn sm" disabled={rows.length < 50} onclick={() => { page++; load(); }}>Berikutnya</button>
</div>

{#if d}
  <Drawer wide title={d.user.display_name} onclose={() => (d = null)}>
    <div class="top">
      {#if d.pet}<div class="pet">{@html petSVG({ color: d.pet.color, ear: d.pet.ear }, [])}</div>{/if}
      <div class="info">
        <p><b>{d.pet?.name ?? 'Belum punya pet'}</b>{#if d.pet} · Lv {d.pet.level}{/if}</p>
        <p class="mono">{d.user.id}</p>
        <p>Kode teman <b>{d.user.friend_code}</b> · {d.friends} teman · {d.giftsSent} hadiah terkirim</p>
        <p>Login: {d.identities.map((i: any) => P[i.provider] + (i.email ? ` (${i.email})` : '')).join(', ')}</p>
        <p>Daftar {dt(d.user.created_at)} · aktif {dt(d.user.last_seen_at)}</p>
        <p>Dompet: <b>{num(d.wallet?.coin ?? 0)}</b> koin · <b>{num(d.wallet?.pearl ?? 0)}</b> Mutiara</p>
        {#if d.user.banned_at}<p class="chip no">Diblokir: {d.user.ban_reason}</p>{/if}
      </div>
    </div>

    <div class="grid2">
      <fieldset>
        <legend>Moderasi</legend>
        <label>Nama pet<input bind:value={rename.petName} /></label>
        <label>Nama pemain<input bind:value={rename.displayName} /></label>
        <button class="btn" disabled={busy} onclick={() => act(() => api.post(`/api/admin/players/${d.user.id}/rename`, rename), 'Nama diganti')}>Ganti nama</button>
        {#if d.user.banned_at}
          <button class="btn" disabled={busy} onclick={() => act(() => api.post(`/api/admin/players/${d.user.id}/unban`), 'Blokir dibuka')}>Buka blokir</button>
        {:else}
          <label>Alasan blokir<input bind:value={ban} placeholder="mis. nama tidak pantas berulang" /></label>
          <button class="btn danger" disabled={busy || ban.length < 3} onclick={() => act(() => api.post(`/api/admin/players/${d.user.id}/ban`, { reason: ban }), 'Pemain diblokir')}>Blokir</button>
        {/if}
        <button class="btn sm" disabled={busy} onclick={() => act(() => api.post(`/api/admin/players/${d.user.id}/logout`), 'Semua sesi dikeluarkan')}>Keluarkan dari semua perangkat</button>
      </fieldset>
      {#if can('admin')}
        <fieldset>
          <legend>Dompet & barang</legend>
          <div class="grid2">
            <label>Mata uang<select bind:value={wallet.currency}><option value="coin">Koin</option><option value="pearl">Mutiara</option></select></label>
            <label>Jumlah (+/−)<input type="number" bind:value={wallet.delta} /></label>
          </div>
          <label>Alasan (masuk ke ledger)<input bind:value={wallet.reason} placeholder="mis. kompensasi gangguan server" /></label>
          <button class="btn" disabled={busy || !wallet.delta || wallet.reason.length < 3} onclick={() => act(() => api.post(`/api/admin/players/${d.user.id}/wallet`, wallet), 'Saldo diubah')}>Ubah saldo</button>
          <div class="grid2">
            <label>Item<select bind:value={give.itemId}><option value="">Pilih item</option>{#each items as i}<option value={i.id}>{i.name}</option>{/each}</select></label>
            <label>Jumlah (+/−)<input type="number" bind:value={give.qty} /></label>
          </div>
          <button class="btn" disabled={busy || !give.itemId || !give.qty} onclick={() => act(() => api.post(`/api/admin/players/${d.user.id}/items`, give), 'Tas pemain diubah')}>Ubah isi tas</button>
        </fieldset>
        <fieldset>
          <legend>Kirim notifikasi ke pemain ini</legend>
          <label>Judul<input bind:value={note.title} maxlength="60" /></label>
          <label>Isi<input bind:value={note.body} maxlength="160" /></label>
          <button class="btn" disabled={busy || note.title.length < 2 || note.body.length < 2} onclick={() => act(() => api.post(`/api/admin/players/${d.user.id}/notify`, note), 'Notifikasi dikirim')}>Kirim</button>
        </fieldset>
      {/if}
    </div>

    <h3>Isi tas</h3>
    <p class="inv">{d.inventory.map((i: any) => `${i.item_id} ×${i.qty}`).join(' · ') || 'Kosong'}</p>
    <h3>Riwayat dompet (60 terakhir)</h3>
    <div class="tbl"><table>
      <thead><tr><th>Waktu</th><th>Mata uang</th><th class="num">Perubahan</th><th class="num">Saldo</th><th>Alasan</th></tr></thead>
      <tbody>{#each d.ledger as l}<tr><td>{dt(l.created_at)}</td><td>{l.currency === 'coin' ? 'Koin' : 'Mutiara'}</td><td class="num" class:neg={l.delta < 0}>{l.delta > 0 ? '+' : ''}{num(l.delta)}</td><td class="num">{num(l.balance_after)}</td><td>{l.reason}{l.ref ? ` · ${l.ref}` : ''}</td></tr>{/each}</tbody>
    </table></div>
    {#if d.payments.length}
      <h3>Pembayaran</h3>
      <div class="tbl"><table><tbody>{#each d.payments as p}<tr><td>{dt(p.created_at)}</td><td>{p.package_id}</td><td class="num">{rp(p.amount_idr)}</td><td>{p.status}</td></tr>{/each}</tbody></table></div>
    {/if}
  </Drawer>
{/if}

<style>
  .top { display: flex; gap: 16px; align-items: flex-start; }
  .pet { width: 110px; height: 116px; flex: none; background: linear-gradient(#D3E9DF, #B7D7CA); border-radius: 14px; }
  .pet :global(svg) { width: 100%; height: 100%; }
  .info p { margin: 0 0 3px; }
  fieldset { border: 1px solid var(--line); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 8px; margin: 0; }
  legend { font-weight: 700; padding: 0 6px; }
  .inv { margin: 0; font-family: var(--mono); font-size: 12.5px; }
  .neg { color: var(--danger); }
</style>
