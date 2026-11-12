<script lang="ts">
  import { onMount } from 'svelte';
  import { petSVG, NEED_KEYS, NEED_LABEL } from '@kb/shared';
  import { api, qs, downloadCsv } from '../lib/api';
  import { A, can, err, toast, ask, num, rp, dt, day, setQuery } from '../lib/store.svelte';
  import { type FDef, readFilters, filterParams } from '../lib/filters';
  import { I } from '../lib/icons';
  import PageHead from '../components/ui/PageHead.svelte';
  import FilterBar from '../components/ui/FilterBar.svelte';
  import DataTable, { type Col, type TState } from '../components/ui/DataTable.svelte';
  import Stat from '../components/ui/Stat.svelte';
  import Drawer from '../components/Drawer.svelte';
  import Tabs from '../components/ui/Tabs.svelte';
  import Bar from '../components/ui/Bar.svelte';
  import Copy from '../components/ui/Copy.svelte';
  import Ago from '../components/ui/Ago.svelte';
  import Modal from '../components/ui/Modal.svelte';
  import Empty from '../components/ui/Empty.svelte';

  const FILTERS: FDef[] = [
    { key: 'status', label: 'Status', all: 'Semua', options: [['akun', 'Akun'], ['tamu', 'Tamu'], ['muted', 'Dibisukan'], ['banned', 'Diblokir']] },
    { key: 'active', label: 'Aktif', all: 'Kapan saja', options: [['online', 'Sedang online'], ['today', 'Hari ini'], ['7', '7 hari terakhir'], ['30', '30 hari terakhir'], ['idle30', 'Tidak aktif > 30 hari']] },
    { key: 'login', label: 'Login', type: 'many', options: [['google', 'Google'], ['email', 'Email'], ['facebook', 'Facebook'], ['guest', 'Tamu']] },
    { key: 'lv', label: 'Level', type: 'range' },
    { key: 'joined', label: 'Tanggal daftar', type: 'dates' },
    { key: 'payer', label: 'Pembayaran', all: 'Semua', options: [['yes', 'Pernah bayar'], ['no', 'Belum pernah']] },
  ];
  const COLS: Col[] = [
    { key: 'who', label: 'Pemain', req: true, snip: true, card: 'title', sort: 'name', text: (r) => r.display_name },
    { key: 'pet', label: 'Pet & level', snip: true, sort: 'level', text: (r) => r.level },
    { key: 'coin', label: 'Koin', num: true, sort: true, text: (r) => r.coin, html: (r) => num(r.coin) },
    { key: 'pearl', label: 'Mutiara', num: true, sort: true, text: (r) => r.pearl, html: (r) => num(r.pearl) },
    { key: 'spent', label: 'Total belanja', num: true, sort: true, text: (r) => r.spent, html: (r) => (r.spent ? rp(r.spent) : '<span class="muted">—</span>') },
    { key: 'login', label: 'Login', snip: true, text: (r) => (r.providers?.join(' ') || (r.is_guest ? 'tamu' : '')) },
    { key: 'email', label: 'Email', off: true, text: (r) => r.email ?? '' },
    { key: 'friends', label: 'Teman', num: true, off: true, text: (r) => r.friends },
    { key: 'joined', label: 'Daftar', sort: true, off: true, snip: true, text: (r) => r.created_at },
    { key: 'seen', label: 'Terakhir aktif', sort: true, snip: true, text: (r) => r.last_seen_at },
    { key: 'status', label: 'Status', snip: true, text: (r) => statusText(r) },
  ];
  let q = $state(A.query.q ?? '');
  let vals = $state<Record<string, any>>(readFilters(FILTERS, A.query));
  let ts = $state<TState>({ page: Number(A.query.page) || 0, size: 25, sort: A.query.sort || 'seen', dir: A.query.dir === 'asc' ? 'asc' : 'desc' });
  let rows = $state<any[]>([]), total = $state(0), loading = $state(true), updated = $state(0);
  let sum = $state<any>(null);
  let selected = $state<string[]>([]);
  let items = $state<any[]>([]);

  const params = () => ({ q, ...filterParams(FILTERS, vals), page: ts.page, size: ts.size, sort: ts.sort, dir: ts.dir });
  const keep = () => ({ page: ts.page || '', sort: ts.sort === 'seen' ? '' : ts.sort, dir: ts.dir === 'desc' ? '' : ts.dir });
  async function load() {
    loading = true;
    try { const r = await api.get('/api/admin/players' + qs(params())); rows = r.players; total = r.total; updated = Date.now(); } catch (e) { err(e); }
    loading = false;
  }
  async function loadSum() { try { sum = (await api.quiet('/api/admin/players-summary')).summary; } catch { /* abaikan */ } }
  function refresh() { load(); loadSum(); if (d) open(d.user.id, tab); }
  function onFilter() { ts.page = 0; selected = []; load(); }
  function onState() { setQuery({ q, ...vals, ...keep() }); load(); }
  function quick(k: string, v: string) {
    const cur = vals[k];
    for (const f of FILTERS) vals[f.key] = f.type === 'many' ? [] : '';
    if (cur !== v) vals[k] = v;
    setQuery({ q, ...vals }); onFilter();
  }
  onMount(() => {
    load(); loadSum();
    if (/^[0-9a-f-]{36}$/i.test(A.arg)) open(A.arg);
    if (can('admin')) api.quiet('/api/admin/items').then((r) => (items = r.items)).catch(() => {});
  });

  const statusText = (r: any) => (r.banned_at ? 'Diblokir' : r.chat_muted_until && new Date(r.chat_muted_until).getTime() > Date.now() ? 'Dibisukan' : r.is_guest ? 'Tamu' : 'Akun');
  const WHERE: Record<string, string> = { alun: 'di Alun-alun', visit: 'berkunjung', home: 'di rumah', game: 'di game' };
  const ava = (r: any) => (r?.color || r?.pet ? petSVG({ color: r.color ?? r.pet?.color ?? '#F2EEE3', ear: r.ear ?? r.pet?.ear ?? 'tunas', pattern: r.pattern ?? r.pet?.pattern, eyes: r.eyes ?? r.pet?.eyes, tail: r.tail ?? r.pet?.tail } as any, []) : '');
  const PROV: Record<string, string> = { google: 'Google', email: 'Email', facebook: 'Facebook', guest: 'Tamu' };

  /* ---------- aksi massal ---------- */
  async function bulkNotify(ids: string[]) {
    const r = await ask({ title: `Kirim notifikasi ke ${ids.length} pemain`, body: 'Pesan masuk ke kotak notifikasi game, juga lewat push / email / WhatsApp sesuai pengaturan Pusat notifikasi.', icon: 'send', tone: 'info',
      fields: [{ key: 'title', label: 'Judul', placeholder: 'mis. Hadiah kompensasi sudah dikirim', min: 2 }, { key: 'body', label: 'Isi', type: 'textarea', placeholder: 'Maksimal 160 karakter', min: 2 }], confirm: 'Kirim' });
    if (!r) return;
    try { const x = await api.post('/api/admin/players/bulk-notify', { ids, title: r.title.slice(0, 60), body: r.body.slice(0, 160) }); toast(`Notifikasi terkirim ke ${x.sent} pemain`); selected = []; } catch (e) { err(e); }
  }
  let gift = $state<null | { ids: string[]; kind: 'coin' | 'pearl' | 'item'; amount: number; itemId: string; reason: string; typed: string; busy: boolean }>(null);
  async function sendGift() {
    if (!gift) return;
    gift.busy = true;
    try {
      const x = await api.post('/api/admin/players/bulk-gift', { ids: gift.ids, kind: gift.kind, amount: gift.amount, itemId: gift.itemId, reason: gift.reason });
      toast(`Hadiah dikirim ke ${x.count} pemain`); gift = null; selected = []; load();
    } catch (e) { err(e); if (gift) gift.busy = false; }
  }
  const giftWord = $derived(gift ? `${gift.ids.length} PEMAIN` : '');
  const giftOk = $derived(!!gift && gift.amount > 0 && gift.reason.trim().length >= 3 && (gift.kind !== 'item' || !!gift.itemId) && gift.typed.trim().toUpperCase() === giftWord);

  /* ---------- detail pemain ---------- */
  let d = $state<any>(null), x = $state<any>(null), tab = $state('ring');
  let wallet = $state({ currency: 'coin', delta: 0, reason: '' });
  let give = $state({ itemId: '', qty: 1 });
  let rename = $state({ petName: '', displayName: '' });
  let invQ = $state('');
  let busy = $state(false);
  async function open(id: string, keepTab = 'ring') {
    try {
      const [a, b] = await Promise.all([api.get(`/api/admin/players/${id}`), api.get(`/api/admin/players/${id}/extra`)]);
      d = a; x = b; tab = keepTab;
      rename = { petName: d.pet?.name ?? '', displayName: d.user.display_name };
      if (A.arg !== id) { A.arg = id; setQuery({ q, ...vals, ...keep() }); }
    } catch (e) { err(e); }
  }
  function close() { d = null; x = null; A.arg = ''; setQuery({ q, ...vals, ...keep() }); }
  async function act(fn: () => Promise<any>, msg: string) {
    busy = true;
    try { await fn(); toast(msg); await open(d.user.id, tab); load(); loadSum(); } catch (e) { err(e); } finally { busy = false; }
  }
  const muted = $derived(!!d?.user.chat_muted_until && new Date(d.user.chat_muted_until).getTime() > Date.now());
  const name = $derived(d ? d.user.display_name : '');

  async function doBan() {
    const r = await ask({ title: `Blokir ${name}?`, body: `${name} tidak bisa masuk sampai blokir dibuka, dan semua sesinya dikeluarkan. Dompet & tas tetap tersimpan.`, tone: 'danger', icon: 'ban',
      fields: [{ key: 'why', label: 'Alasan', type: 'chips', options: ['Nama tidak pantas', 'Obrolan kasar berulang', 'Curang', 'Spam', 'Lainnya'], value: 'Obrolan kasar berulang' },
        { key: 'note', label: 'Catatan (masuk log audit)', type: 'textarea', placeholder: 'mis. 3 laporan dalam 1 jam di Alun-alun 1' }],
      typeToConfirm: name, confirm: 'Blokir pemain' });
    if (!r) return;
    const reason = (r.note?.trim() ? `${r.why}: ${r.note.trim()}` : r.why).slice(0, 200);
    act(() => api.post(`/api/admin/players/${d.user.id}/ban`, { reason }), `${name} diblokir`);
  }
  async function doUnban() {
    if (!(await ask({ title: `Buka blokir ${name}?`, body: 'Pemain bisa masuk dan main lagi.', tone: 'ok', icon: 'check', confirm: 'Buka blokir' }))) return;
    act(() => api.post(`/api/admin/players/${d.user.id}/unban`), 'Blokir dibuka');
  }
  async function doMute() {
    const r = await ask({ title: `Bisukan obrolan ${name}`, body: 'Pemain tidak bisa mengetik di Alun-alun dan saat berkunjung. Frasa siap pakai juga ditutup.', tone: 'warn', icon: 'mute',
      fields: [{ key: 'len', label: 'Lama', type: 'chips', options: ['30 menit', '2 jam', '24 jam', '7 hari'], value: '2 jam' }, { key: 'reason', label: 'Alasan', placeholder: 'mis. kata kasar ke pemain lain', min: 3 }],
      confirm: 'Bisukan' });
    if (!r) return;
    const minutes = { '30 menit': 30, '2 jam': 120, '24 jam': 1440, '7 hari': 10080 }[r.len] ?? 120;
    act(() => api.post(`/api/admin/players/${d.user.id}/mute`, { minutes, reason: r.reason }), `Obrolan ${name} dibisukan`);
  }
  async function doUnmute() {
    if (!(await ask({ title: 'Buka bisu obrolan?', body: `${name} bisa mengobrol lagi sekarang.`, tone: 'ok', icon: 'sound', confirm: 'Buka bisu' }))) return;
    act(() => api.post(`/api/admin/players/${d.user.id}/unmute`), 'Obrolan dibuka');
  }
  async function doLogout() {
    if (!(await ask({ title: 'Keluarkan dari semua perangkat?', body: `${x?.sessions ?? 0} sesi aktif akan diakhiri. Pemain perlu masuk lagi (akun tamu tanpa kode pindah perangkat bisa kehilangan akses).`, tone: 'warn', icon: 'logout', confirm: 'Keluarkan' }))) return;
    act(() => api.post(`/api/admin/players/${d.user.id}/logout`), 'Semua sesi dikeluarkan');
  }
  async function doRename() {
    const diff = [];
    if (rename.displayName !== d.user.display_name) diff.push({ label: 'Nama pemain', before: d.user.display_name, after: rename.displayName });
    if (d.pet && rename.petName !== d.pet.name) diff.push({ label: 'Nama pet', before: d.pet.name, after: rename.petName });
    if (!diff.length) { toast('Tidak ada nama yang berubah.', 'info'); return; }
    if (!(await ask({ title: 'Ganti nama?', diff, tone: 'warn', icon: 'edit', confirm: 'Ganti nama' }))) return;
    act(() => api.post(`/api/admin/players/${d.user.id}/rename`, rename), 'Nama diganti');
  }
  async function doWallet() {
    const cur = wallet.currency === 'coin' ? 'koin' : 'Mutiara';
    const bal = Number(d.wallet?.[wallet.currency] ?? 0), delta = Number(wallet.delta);
    const big = Math.abs(delta) > (wallet.currency === 'coin' ? 1000 : 100);
    if (!(await ask({ title: `${delta > 0 ? 'Tambah' : 'Kurangi'} ${num(Math.abs(delta))} ${cur}?`, body: `Tercatat di riwayat dompet ${name} dan log audit dengan alasan: “${wallet.reason}”.`,
      diff: [{ label: `Saldo ${cur}`, before: num(bal), after: num(bal + delta) }], tone: big ? 'danger' : 'warn', icon: 'coin',
      typeToConfirm: big ? name : undefined, note: big ? `Perubahan besar (lebih dari ${wallet.currency === 'coin' ? '1.000 koin' : '100 Mutiara'}): ketik nama pemain untuk memastikan.` : undefined, confirm: 'Ubah saldo' }))) return;
    act(() => api.post(`/api/admin/players/${d.user.id}/wallet`, { ...wallet, delta }), 'Saldo diubah').then(() => (wallet = { currency: wallet.currency, delta: 0, reason: '' }));
  }
  async function doGive() {
    const it = items.find((i) => i.id === give.itemId);
    const have = d.inventory.find((i: any) => i.item_id === give.itemId)?.qty ?? 0;
    if (!(await ask({ title: `${give.qty > 0 ? 'Tambah' : 'Kurangi'} ${it?.name ?? give.itemId}?`, diff: [{ label: it?.name ?? give.itemId, before: `${have}×`, after: `${Math.max(0, have + Number(give.qty))}×` }], tone: 'warn', icon: 'gift', confirm: 'Ubah isi tas' }))) return;
    act(() => api.post(`/api/admin/players/${d.user.id}/items`, give), 'Tas pemain diubah');
  }
  async function doNotify() {
    const r = await ask({ title: `Kirim notifikasi ke ${name}`, icon: 'send', tone: 'info',
      fields: [{ key: 'title', label: 'Judul', min: 2 }, { key: 'body', label: 'Isi', type: 'textarea', min: 2, placeholder: 'Maksimal 160 karakter' }], confirm: 'Kirim' });
    if (r) act(() => api.post(`/api/admin/players/${d.user.id}/notify`, { title: r.title.slice(0, 60), body: r.body.slice(0, 160) }), 'Notifikasi dikirim');
  }
  const COUNTERS: Record<string, string> = { coop: 'Main bareng', karung: 'Lomba karung', fishing: 'Memancing', photo: 'Foto bareng', gifts: 'Hadiah dikirim', duel: 'Duel', friend_ask: 'Ajakan berteman', square_play: 'Main di alun-alun', square_snack: 'Jajan di alun-alun', sweep: 'Sapu remah', report: 'Laporan dibuat' };
  const itemName = (id: string) => items.find((i) => i.id === id)?.name ?? id;
  const inv = $derived((d?.inventory ?? []).filter((i: any) => !invQ || (i.item_id + ' ' + itemName(i.item_id)).toLowerCase().includes(invQ.toLowerCase())));
  let ledgerCur = $state(''), ledgerTs = $state<TState>({ page: 0, size: 25, sort: '', dir: 'desc' });
  const ledger = $derived((d?.ledger ?? []).filter((l: any) => !ledgerCur || l.currency === ledgerCur));
  const LEDGER_COLS: Col[] = [
    { key: 'created_at', label: 'Waktu', sort: true, html: (l) => dt(l.created_at), card: 'title' },
    { key: 'currency', label: 'Mata uang', html: (l) => (l.currency === 'coin' ? 'Koin' : 'Mutiara') },
    { key: 'delta', label: 'Perubahan', num: true, sort: true, html: (l) => `<b style="color:${l.delta < 0 ? 'var(--danger)' : 'var(--accent)'}">${l.delta > 0 ? '+' : ''}${num(l.delta)}</b>` },
    { key: 'balance_after', label: 'Saldo', num: true, html: (l) => num(l.balance_after) },
    { key: 'reason', label: 'Alasan', text: (l) => `${l.reason}${l.ref ? ' · ' + l.ref : ''}` },
  ];
  const PAY_ST: Record<string, string> = { pending: '<span class="chip warn">Menunggu</span>', paid: '<span class="chip">Lunas</span>', failed: '<span class="chip no">Gagal</span>', expired: '<span class="chip mute">Kedaluwarsa</span>' };
  const PAYCOLS: Col[] = [
    { key: 'created_at', label: 'Waktu', html: (p) => dt(p.created_at), card: 'title' },
    { key: 'package_id', label: 'Paket' }, { key: 'pearls', label: 'Mutiara', num: true },
    { key: 'amount_idr', label: 'Nominal', num: true, html: (p) => rp(p.amount_idr) },
    { key: 'status', label: 'Status', html: (p) => PAY_ST[p.status] ?? p.status },
  ];
</script>

<PageHead title="Pemain" updated={updated} onrefresh={refresh} live={!!sum}>
  {#if sum}{num(sum.total)} pemain · {num(sum.online)} sedang online{/if}
  {#snippet actions()}{#if can('admin')}<button class="btn" onclick={() => downloadCsv('/api/admin/export/players.csv' + qs({ q, ...filterParams(FILTERS, vals), sort: ts.sort, dir: ts.dir }))}>{@html I.download}Ekspor CSV</button>{/if}{/snippet}
</PageHead>

<div class="stats">
  <Stat icon="users" value={sum ? num(sum.online) : '…'} label="Sedang online" onclick={() => quick('active', 'online')} active={vals.active === 'online'} />
  <Stat icon="clock" value={sum ? num(sum.active_today) : '…'} label="Aktif hari ini" tone="blue" onclick={() => quick('active', 'today')} active={vals.active === 'today'} />
  <Stat icon="user" value={sum ? '+' + num(sum.new_today) : '…'} label="Daftar hari ini" tone="blue" onclick={() => quick('joined', 'today')} active={vals.joined === 'today'} />
  <Stat icon="mute" value={sum ? num(sum.muted) : '…'} label="Obrolan dibisukan" tone="warn" onclick={() => quick('status', 'muted')} active={vals.status === 'muted'} />
  <Stat icon="ban" value={sum ? num(sum.banned) : '…'} label="Diblokir" tone="no" onclick={() => quick('status', 'banned')} active={vals.status === 'banned'} />
</div>

<FilterBar bind:q bind:values={vals} filters={FILTERS} placeholder="Cari nama, pet, kode teman, email, ID" onchange={onFilter} count={total} keep={keep()} />

<DataTable cols={COLS} {rows} {total} bind:state={ts} onstate={onState} {loading} selectable={can('admin')} bind:selected prefKey="players"
  onrow={(r) => open(r.id)} rowClass={(r) => (r.banned_at ? 'banned' : '')} empty="Tidak ada pemain yang cocok" emptyText="Coba ubah kata kunci atau hapus beberapa filter." emptyIcon="users">
  {#snippet cell(r, k)}
    {#if k === 'who'}
      <div class="who"><span class="pv">{@html ava(r)}</span><span class="nm"><b>{r.display_name}</b><small class="mono">{r.friend_code} <Copy text={r.friend_code} label="Kode teman disalin" /></small></span></div>
    {:else if k === 'pet'}
      {#if r.pet_name}<div class="lv"><span>{r.pet_name} · <b>Lv {r.level}</b></span></div>{:else}<span class="muted">Belum punya pet</span>{/if}
    {:else if k === 'login'}
      <span class="prov">{#each r.providers.filter((p: string) => p !== 'guest') as p}<i title={PROV[p] ?? p}>{@html p === 'google' ? I.google : p === 'facebook' ? I.facebook : I.mail}</i>{/each}{#if r.is_guest}<i title="Tamu" class="m">{@html I.user}</i>{/if}</span>
    {:else if k === 'joined'}<Ago t={r.created_at} />
    {:else if k === 'seen'}
      {#if r.online}<span class="on"><span class="dot"></span>Online</span><small class="muted">{WHERE[r.where] ?? ''}</small>{:else}<Ago t={r.last_seen_at} />{/if}
    {:else if k === 'status'}
      {#if r.banned_at}<span class="chip no">Diblokir</span>{:else if r.chat_muted_until && new Date(r.chat_muted_until).getTime() > Date.now()}<span class="chip warn">Dibisukan</span>{:else if r.is_guest}<span class="chip mute">Tamu</span>{:else}<span class="chip">Akun</span>{/if}
    {/if}
  {/snippet}
  {#snippet bulk(ids)}
    <button class="btn sm" onclick={() => bulkNotify(ids)}>{@html I.send}Kirim notifikasi</button>
    {#if can('owner')}<button class="btn sm" onclick={() => (gift = { ids: [...ids], kind: 'coin', amount: 100, itemId: '', reason: '', typed: '', busy: false })}>{@html I.gift}Beri hadiah</button>{/if}
  {/snippet}
</DataTable>

{#if gift}
  <Modal title="Beri hadiah ke {gift.ids.length} pemain" sub="Hadiah langsung masuk ke dompet / tas tiap pemain dan tercatat di log audit." icon="gift" tone="warn" onclose={() => (gift = null)}>
    <div class="grid2">
      <label>Jenis<select bind:value={gift.kind}><option value="coin">Koin</option><option value="pearl">Mutiara</option><option value="item">Item</option></select></label>
      <label>Jumlah per pemain<input type="number" min="1" bind:value={gift.amount} /></label>
    </div>
    {#if gift.kind === 'item'}<label>Item<select bind:value={gift.itemId}><option value="">Pilih item</option>{#each items.filter((i) => i.kind !== 'room') as i}<option value={i.id}>{i.name}</option>{/each}</select></label>{/if}
    <label>Alasan (masuk riwayat dompet & log audit)<input bind:value={gift.reason} placeholder="mis. kompensasi gangguan server 12 Nov" /></label>
    <p class="note">Total: <b>{num(gift.amount * gift.ids.length)} {gift.kind === 'coin' ? 'koin' : gift.kind === 'pearl' ? 'Mutiara' : '× item'}</b> untuk {gift.ids.length} pemain.</p>
    <label><span>Ketik <code>{giftWord}</code> untuk konfirmasi</span><input bind:value={gift.typed} autocomplete="off" /></label>
    {#snippet footer()}
      <button class="btn" onclick={() => (gift = null)}>Batal</button>
      <button class="btn primary" disabled={!giftOk} aria-busy={gift?.busy ? 'true' : undefined} onclick={sendGift}>{@html I.gift}Kirim hadiah</button>
    {/snippet}
  </Modal>
{/if}

{#if d}
  <Drawer wide title={d.user.display_name} onclose={close}>
    {#snippet head()}
      <div class="dh">
        <span class="bigpv">{@html ava(d.pet ? { pet: d.pet } : null)}</span>
        <div class="t">
          <h2>{d.user.display_name}
            {#if d.user.banned_at}<span class="chip no">Diblokir</span>{:else if d.user.is_guest}<span class="chip mute">Tamu</span>{:else}<span class="chip">Akun</span>{/if}
            {#each d.identities.filter((i: any) => i.provider !== 'guest') as i}<span class="chip blue">{PROV[i.provider] ?? i.provider}</span>{/each}
            {#if x?.presence}<span class="chip live"><span class="dot"></span>Online · {WHERE[x.presence.where] ?? x.presence.where}{x.presence.where === 'alun' && x.presence.host ? ' ' + x.presence.host : ''}</span>{/if}
            {#if muted}<span class="chip warn">Dibisukan</span>{/if}
          </h2>
          <p><span class="mono">{d.user.friend_code}</span><Copy text={d.user.friend_code} label="Kode teman disalin" /> · daftar {day(d.user.created_at)} · aktif <Ago t={d.user.last_seen_at} /></p>
        </div>
        {#if can('admin')}<button class="btn" onclick={doNotify}>{@html I.send}<span class="hide-s">Kirim notifikasi</span></button>{/if}
      </div>
    {/snippet}
    {#snippet tabs()}
      <Tabs bind:active={tab} tabs={[
        { k: 'ring', label: 'Ringkasan' },
        { k: 'dompet', label: 'Dompet', count: d.ledger.length || null },
        { k: 'tas', label: 'Tas', count: d.inventory.length || null },
        { k: 'bayar', label: 'Pembayaran', count: d.payments.length || null },
        { k: 'mod', label: 'Moderasi', count: (x?.reports30 ?? 0) || null, tone: x?.reports30 ? 'warn' : '' },
      ]} />
    {/snippet}

    {#if tab === 'ring'}
      <div class="g2">
        <section class="card c">
          <h3>Pet: {d.pet?.name ?? '—'} {#if d.pet}<span class="chip {d.pet.sick ? 'no' : ''}">{d.pet.sick ? 'Sakit' : d.pet.sleep ? 'Tidur' : 'Sehat'}</span>{/if}</h3>
          {#if d.pet}
            <div class="petrow">
              <span class="bigpv lg">{@html ava({ pet: d.pet })}</span>
              <div class="lvb">
                <div class="sp"><b>Level {d.pet.level}</b>{#if x?.xpNext}<span class="muted">{num(d.pet.xp)} / {num(x.xpNext)} XP</span>{/if}</div>
                <Bar value={d.pet.xp} max={x?.xpNext ?? 100} h={9} label="XP" />
                {#if d.pet.weight > 0}<small class="muted">Berat {String(d.pet.weight).replace('.', ',')} kg</small>{/if}
              </div>
            </div>
            {#each NEED_KEYS as k}
              <div class="need"><span>{NEED_LABEL[k]}</span><Bar value={d.pet.needs[k]} tone="auto" label={NEED_LABEL[k]} /><b>{Math.round(d.pet.needs[k])}</b></div>
            {/each}
          {:else}<Empty icon="heart" title="Belum punya pet" text="Pemain ini belum menyelesaikan pembuatan pet." />{/if}
        </section>
        <section class="card c">
          <h3>Dompet & aktivitas</h3>
          <div class="mini">
            <div><b>{num(d.wallet?.coin ?? 0)}</b><span>Koin</span></div>
            <div><b>{num(d.wallet?.pearl ?? 0)}</b><span>Mutiara</span></div>
            <div><b>{num(d.friends)}</b><span>Teman</span></div>
            <div><b>{num(d.giftsSent)}</b><span>Hadiah kirim</span></div>
          </div>
          <h4>Hari ini</h4>
          {#each (x?.counters ?? []).filter((c: any) => COUNTERS[c.key]) as c}
            <div class="cnt"><span>{COUNTERS[c.key]}</span><b>{c.count}{c.limit ? ` / ${c.limit}` : ''}</b></div>
            {#if c.limit}<Bar value={c.count} max={c.limit} tone="full" label={COUNTERS[c.key]} />{/if}
          {:else}<p class="muted sm">Belum ada aktivitas berjatah hari ini.</p>{/each}
        </section>
      </div>
      <details class="card c tech">
        <summary><h3>Info akun</h3><span class="muted">ID, login, sesi, privasi</span></summary>
        <dl class="kv">
          <dt>ID</dt><dd class="mono">{d.user.id}<Copy text={d.user.id} label="ID disalin" /></dd>
          <dt>Login</dt><dd>{d.identities.map((i: any) => (PROV[i.provider] ?? i.provider) + (i.email ? ` (${i.email})` : '')).join(', ') || 'Tamu (tanpa login)'}</dd>
          <dt>Sesi aktif</dt><dd>{x?.sessions ?? 0} sesi{#if x?.lastSession} · terakhir masuk <Ago t={x.lastSession} />{/if}</dd>
          <dt>Privasi</dt><dd>Status online {x?.privacy.showOnline ? 'tampil' : 'disembunyikan'} · kunjungan live {x?.privacy.liveVisits === false ? 'mati' : 'aktif'} · ajakan berteman {x?.privacy.friendRequests ? 'aktif' : 'mati'}</dd>
          <dt>Ruangan</dt><dd>{d.rooms.length} ruangan</dd>
        </dl>
      </details>
    {:else if tab === 'dompet'}
      {#if can('admin')}
        <fieldset>
          <legend>Ubah saldo</legend>
          <div class="grid3">
            <label>Mata uang<select bind:value={wallet.currency}><option value="coin">Koin ({num(d.wallet?.coin ?? 0)})</option><option value="pearl">Mutiara ({num(d.wallet?.pearl ?? 0)})</option></select></label>
            <label>Jumlah (+/−)<input type="number" bind:value={wallet.delta} /></label>
            <label>Alasan<input bind:value={wallet.reason} placeholder="mis. kompensasi gangguan" /></label>
          </div>
          <div class="row"><button class="btn primary" disabled={busy || !Number(wallet.delta) || wallet.reason.trim().length < 3} onclick={doWallet}>{@html I.coin}Ubah saldo…</button>
            {#if Number(wallet.delta)}<span class="muted">Saldo jadi <b>{num(Number(d.wallet?.[wallet.currency] ?? 0) + Number(wallet.delta))}</b></span>{/if}</div>
        </fieldset>
      {/if}
      <DataTable cols={LEDGER_COLS} rows={ledger} bind:state={ledgerTs} idKey="id" empty="Belum ada riwayat dompet" csv="local" csvName="dompet-{d.user.friend_code}">
        {#snippet toolbar()}
          <span class="seg"><button class:on={!ledgerCur} onclick={() => (ledgerCur = '')}>Semua</button><button class:on={ledgerCur === 'coin'} onclick={() => (ledgerCur = 'coin')}>Koin</button><button class:on={ledgerCur === 'pearl'} onclick={() => (ledgerCur = 'pearl')}>Mutiara</button></span>
          <span class="muted">60 catatan terakhir</span>
        {/snippet}
      </DataTable>
    {:else if tab === 'tas'}
      {#if can('admin')}
        <fieldset>
          <legend>Ubah isi tas</legend>
          <div class="grid3">
            <label>Item<select bind:value={give.itemId}><option value="">Pilih item</option>{#each items.filter((i) => i.kind !== 'room') as i}<option value={i.id}>{i.name}</option>{/each}</select></label>
            <label>Jumlah (+/−)<input type="number" bind:value={give.qty} /></label>
            <div class="end"><button class="btn primary" disabled={busy || !give.itemId || !Number(give.qty)} onclick={doGive}>{@html I.gift}Ubah isi tas…</button></div>
          </div>
        </fieldset>
      {/if}
      <label class="srch"><input type="search" placeholder="Cari item di tas" bind:value={invQ} /></label>
      {#if inv.length}
        <div class="inv">{#each inv as i}<span class="it"><b>{itemName(i.item_id)}</b><small class="mono">{i.item_id}</small><em>×{i.qty}</em></span>{/each}</div>
      {:else}<Empty icon="bag" title={invQ ? 'Tidak ada item yang cocok' : 'Tas kosong'} />{/if}
    {:else if tab === 'bayar'}
      <DataTable cols={PAYCOLS} rows={d.payments} empty="Belum pernah membeli Mutiara" emptyIcon="card" />
    {:else if tab === 'mod'}
      <div class="g2">
        <section class="card c">
          <h3>Obrolan & akun</h3>
          <dl class="kv">
            <dt>Dilaporkan</dt><dd>{x?.reports30 ?? 0}× dalam 30 hari{#if x?.lastReport} · terakhir <Ago t={x.lastReport} />{/if}{#if x?.reports30}<a href="#/moderation?tab=laporan&q={encodeURIComponent(name)}">Lihat laporan</a>{/if}</dd>
            <dt>Diblokir pemain</dt><dd>{x?.blockedBy ?? 0} pemain memblokirnya</dd>
            <dt>Melaporkan</dt><dd>{x?.reportsMade30 ?? 0} laporan dalam 30 hari</dd>
            <dt>Obrolan</dt><dd>{#if muted}<span class="chip warn">Dibisukan sampai {dt(d.user.chat_muted_until)}</span>{:else}Normal{/if}</dd>
            {#if d.user.banned_at}<dt>Blokir</dt><dd><span class="chip no">{d.user.ban_reason}</span> sejak {dt(d.user.banned_at)}</dd>{/if}
          </dl>
          <div class="row">
            {#if muted}<button class="btn" disabled={busy} onclick={doUnmute}>{@html I.sound}Buka bisu</button>{:else}<button class="btn" disabled={busy} onclick={doMute}>{@html I.mute}Bisukan obrolan…</button>{/if}
            <button class="btn" disabled={busy} onclick={doLogout}>{@html I.logout}Keluarkan semua sesi…</button>
          </div>
        </section>
        <section class="card c">
          <h3>Ganti nama</h3>
          <label>Nama pemain<input bind:value={rename.displayName} maxlength="24" /></label>
          {#if d.pet}<label>Nama pet<input bind:value={rename.petName} maxlength="16" /></label>{/if}
          <div class="row"><button class="btn" disabled={busy} onclick={doRename}>{@html I.edit}Ganti nama…</button></div>
        </section>
      </div>
      <section class="card c danger">
        <h3>Blokir akun</h3>
        {#if d.user.banned_at}
          <p class="muted">Diblokir sejak {dt(d.user.banned_at)}: {d.user.ban_reason}</p>
          <div class="row"><button class="btn" disabled={busy} onclick={doUnban}>{@html I.check}Buka blokir…</button></div>
        {:else}
          <p class="muted">Pemain tidak bisa masuk sampai blokir dibuka. Untuk kata kasar sesekali, bisukan obrolan saja.</p>
          <div class="row"><button class="btn danger" disabled={busy} onclick={doBan}>{@html I.ban}Blokir pemain…</button></div>
        {/if}
      </section>
    {/if}
  </Drawer>
{/if}

<style>
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; }
  .who { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .pv { width: 32px; height: 34px; border-radius: 10px; background: linear-gradient(#D3E9DF, #B7D7CA); flex: none; padding: 2px; }
  .pv :global(svg), .bigpv :global(svg) { width: 100%; height: 100%; display: block; }
  .nm { display: flex; flex-direction: column; min-width: 0; } .nm b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .nm small { color: var(--muted); display: inline-flex; gap: 4px; align-items: center; }
  .lv span { font-size: 13.5px; white-space: nowrap; }
  .prov { display: inline-flex; gap: 4px; }
  .prov i { width: 22px; height: 22px; border-radius: 6px; border: 1px solid var(--line); display: grid; place-items: center; background: #fff; padding: 3px; color: var(--muted); }
  .prov i :global(svg) { width: 100%; height: 100%; }
  .on { color: #1F8A55; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; }
  :global(tr.banned td) { opacity: .65; }
  .dh { display: flex; gap: 14px; align-items: center; }
  .bigpv { width: 60px; height: 64px; border-radius: 14px; background: linear-gradient(#D3E9DF, #B7D7CA); padding: 3px; flex: none; }
  .bigpv.lg { width: 84px; height: 88px; }
  .dh .t { flex: 1; min-width: 0; }
  .dh h2 { font-size: 23px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .dh p { margin: 4px 0 0; color: var(--muted); font-size: 13px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .dh :global(.btn svg) { width: 15px; height: 15px; }
  .g2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: 12px; }
  .c { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; }
  .c h3 { display: flex; align-items: center; gap: 8px; justify-content: space-between; }
  .c h4 { margin: 4px 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); }
  .petrow { display: flex; gap: 14px; align-items: center; }
  .lvb { flex: 1; display: flex; flex-direction: column; gap: 6px; }
  .sp { display: flex; justify-content: space-between; font-size: 13.5px; }
  .need { display: grid; grid-template-columns: 70px 1fr 34px; gap: 8px; align-items: center; font-size: 13px; } .need b { text-align: right; font-variant-numeric: tabular-nums; }
  .mini { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .mini div { background: #F6F8F6; border-radius: 10px; padding: 8px 10px; min-width: 0; }
  .mini b { font: 800 19px var(--display); display: block; } .mini span { font-size: 11.5px; color: var(--muted); font-weight: 600; }
  .cnt { display: flex; justify-content: space-between; font-size: 13px; margin-top: 2px; }
  .sm { font-size: 13px; margin: 0; }
  .tech summary { display: flex; align-items: center; gap: 10px; cursor: pointer; list-style: none; }
  .tech summary::-webkit-details-marker { display: none; }
  .tech summary::after { content: '▾'; margin-left: auto; color: var(--muted); transition: transform .2s; }
  .tech[open] summary::after { transform: rotate(180deg); }
  .grid3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 160px), 1fr)); gap: 10px; align-items: end; }
  .end { display: flex; align-items: flex-end; }
  .seg { display: inline-flex; background: #E6EBE8; border-radius: 9px; padding: 3px; gap: 2px; }
  .seg button { all: unset; cursor: pointer; padding: 3px 10px; border-radius: 7px; font-weight: 600; font-size: 13px; color: var(--muted); }
  .seg button.on { background: #fff; color: var(--ink); box-shadow: 0 1px 3px rgba(0,0,0,.12); }
  .srch { max-width: 320px; }
  .inv { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 8px; }
  .it { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 8px 10px; display: grid; grid-template-columns: 1fr auto; gap: 0 6px; }
  .it b { font-size: 13.5px; } .it small { color: var(--muted); grid-column: 1; } .it em { grid-row: 1 / 3; grid-column: 2; align-self: center; font: 800 18px var(--display); font-style: normal; color: var(--accent); }
  .danger { border-color: #EBC6BD; }
  .note { margin: 0; background: var(--warn-soft); color: var(--warn); border-radius: 10px; padding: 8px 10px; font-size: 13.5px; }
  code { font-family: var(--mono); background: #F1F4F2; padding: 0 6px; border-radius: 5px; }
  :global(.btn svg) { width: 15px; height: 15px; }
  @media (max-width: 760px) { .stats { display: flex; overflow-x: auto; scrollbar-width: none; margin: 0 -14px; padding: 0 14px; } .stats > :global(.stat) { flex: none; min-width: 150px; } .hide-s { display: none; } .mini { grid-template-columns: repeat(2, 1fr); } .bigpv { width: 48px; height: 52px; } }
</style>
