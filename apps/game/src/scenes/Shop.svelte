<script lang="ts">
  // Di dalam toko: pet sudah berjalan ke sini dari peta. Yang dijual hanya barang toko ini.
  // Toko pakaian (Butik Benang): tab per bagian tubuh, manekin, "Coba" di pet sendiri & Kaca Pas (beli sekaligus).
  import { onMount } from 'svelte';
  import ItemCard from '../components/ItemCard.svelte';
  import { G, canBuy, effText, fmt, owned, hasItem, run, post, toast, switchRoom, settings, serverNow, fx, item as itemOf } from '../lib/game.svelte';
  import { footprint, itemIcon, renderPet, mannequinSVG, shade, PREMIUM_SETS, PREMIUM_SET_BY_KEY, bundlePrice, growText } from '@kb/shared';
  import { api } from '../lib/api';
  import { COIN, PEARL, I } from '../lib/icons';
  import { sfx } from '../lib/sfx';
  import ExpandRooms from '../components/ExpandRooms.svelte';

  const KEEPERS: Record<string, { name: string; look: any; greet: string; wear?: string[] }> = {
    pasar: { name: 'Bu Serabi', look: { color: '#F2EEE3', ear: 'kelinci', pattern: 'ujung', eyes: 'senyum' }, greet: 'Jajanan hangat, bibit segar! Mau beli apa hari ini?' },
    mebel: { name: 'Pak Jati', look: { color: '#B98A64', ear: 'anjing', pattern: 'totol', eyes: 'bulat' }, greet: 'Mebel kayu jati asli kampung. Pilih yang cocok buat rumahmu!' },
    butik: { name: 'Mbak Benang', look: { color: '#C9B6E8', ear: 'kucing', pattern: 'bintang', eyes: 'berbinar' }, greet: 'Ada model baru, lho. Coba yang mana?', wear: ['kebaya-kutubaru', 'konde-melati'] },
    mutiara: { name: 'Nyai Mutiara', look: { color: '#9FD0E8', ear: 'antena', pattern: 'polos', eyes: 'bintang' }, greet: 'Barang istimewa, khusus dibeli dengan Mutiara.' },
    jamu: { name: 'Mbok Jamu', look: { color: '#F4D58D', ear: 'kelinci', pattern: 'ujung', eyes: 'senyum' }, greet: 'Kurang enak badan? Minum jamu, besok segar lagi!' },
    bangunan: { name: 'Pak Tukang', look: { color: '#F4D58D', ear: 'tunas', pattern: 'belang', eyes: 'bulat' }, greet: 'Mau tambah ruangan, atau perluas ruangan yang ada? Pak Tukang siap!' },
  };
  const KIND_LABEL: Record<string, string> = { food: 'Makanan', seed: 'Bibit', furniture: 'Mebel', wallpaper: 'Dinding', floor: 'Lantai', wear: 'Pakaian', room: 'Ruangan', material: 'Lainnya', fish: 'Ikan' };
  /** bagian tubuh pakaian, urut seperti tab Butik */
  const SLOT_LABEL: Record<string, string> = { body: 'Baju', head: 'Kepala', face: 'Wajah', neck: 'Leher', back: 'Punggung', hand: 'Dibawa' };
  const SLOT_ORDER = Object.keys(SLOT_LABEL);
  /** celetukan penjaga saat barang dicoba (pendek supaya muat di gelembung) */
  const TRY_LINE: Record<string, string> = {
    body: 'Wah, cocok! Bajunya pas sekali.', head: 'Manis! Coba padukan dengan baju juga.', face: 'Makin bergaya! Mau coba yang lain?',
    neck: 'Serasi sekali di lehernya!', back: 'Keren dilihat dari belakang juga!', hand: 'Pas dibawa jalan-jalan!',
  };

  const loc = $derived((G.catalog?.locations ?? []).find((l: any) => l.id === G.shopId));
  const keeper = $derived(KEEPERS[loc?.id] ?? { name: 'Penjaga toko', look: { color: '#A8D8A0', ear: 'tunas' }, greet: `Selamat datang di ${loc?.name ?? 'toko'}!` });
  const all = $derived((G.catalog?.items ?? []).filter((i) => i.shop === loc?.id && canBuy(i)));
  const cats = $derived([...new Set(all.map((i) => i.kind))]);
  const slotOf = (it: any): string => it?.data?.slot ?? 'head';
  // jam kasar (per menit) supaya status "Baru" tidak memicu hitung ulang tiap detik
  const nowMin = $derived(Math.floor(serverNow() / 60_000));
  const isNew = (it: any) => (it?.new_until ?? 0) > nowMin * 60_000;
  // toko khusus pakaian: tab per bagian tubuh (bukan per jenis)
  const wearShop = $derived(all.length > 0 && all.every((i) => i.kind === 'wear'));
  const slots = $derived(wearShop ? SLOT_ORDER.filter((s) => all.some((i) => slotOf(i) === s)) : []);
  const newIn = (s: string) => all.filter((i) => slotOf(i) === s && isNew(i)).length;
  const anyNew = $derived(all.some(isNew));
  let cat = $state('');
  // koleksi baju baru: tab Baju langsung terbuka
  let slot = $state((G.catalog?.items ?? []).some((i) => i.shop === G.shopId && i.kind === 'wear' && slotOf(i) === 'body' && isNew(i)) ? 'body' : '');
  let confirm = $state('');
  const list = $derived.by(() => {
    if (cat === 'set') return [];
    const l = all.filter((i) => (!cat || i.kind === cat) && (!wearShop || !slot || slotOf(i) === slot));
    // Butik: koleksi baru tampil lebih dulu
    return wearShop ? [...l].sort((a, b) => Number(isNew(b)) - Number(isNew(a))) : l;
  });
  // set premium (Toko Mutiara): paket semua item yang belum dimiliki dengan diskon, bonus suasana di ruangan
  const sets = $derived(loc?.kind === 'pearl' ? PREMIUM_SETS.map((st) => {
    const its = st.items.map((id) => all.find((i) => i.id === id)).filter(Boolean) as any[];
    const left = its.filter((i) => !hasItem(i.id));
    return { st, its, left, bp: bundlePrice(left.map((i) => i.price_pearl), Number(settings().premium?.bundleDiscount ?? 20)) };
  }).filter((x) => x.its.length) : []);
  async function buySet(x: (typeof sets)[number]) {
    if (confirm !== 'set:' + x.st.key) { confirm = 'set:' + x.st.key; sfx.tap(); return; }
    confirm = '';
    const r: any = await run(() => post('/api/shop/bundle', { set: x.st.key, price: x.bp.price }));
    if (!r) return;
    sfx.level();
    toast(`${x.st.name}: ${r.items.length} item masuk Tas. Pasang 3 atau lebih di satu ruangan untuk suasananya!`, 'good');
  }
  const sellable = $derived(Object.entries(G.me.inventory ?? {}).map(([id, n]) => ({ it: itemOf(id), n: n as number })).filter((x) => x.it && x.it.sell_coin > 0));
  const eventIds = $derived(new Set((G.me.events ?? []).map((e: any) => e.id)));
  const rooms = $derived<any[]>(G.me.rooms ?? []);
  const maxRooms = $derived(settings().house?.maxRooms ?? 6);
  const body = $derived(loc?.style?.body ?? '#FDF1D6');
  const roof = $derived(loc?.style?.roof ?? '#3FA06A');

  onMount(() => { if (!loc?.sells_back) G.shopTab = 'buy'; });

  function sub(it: any) {
    if (it.kind === 'food') return (it.data?.cure ? 'Menyembuhkan · ' : '') + effText(it.data?.effects);
    const setName = PREMIUM_SET_BY_KEY[it.data?.set]?.name;
    if (it.kind === 'furniture') { const f = footprint(it); return `Ukuran ${f.w}×${f.d}${f.flat ? ' · karpet' : ''}${setName ? ` · ${setName}` : ''}`; }
    if ((it.kind === 'wallpaper' || it.kind === 'floor') && setName) return `${it.kind === 'floor' ? 'Lantai' : 'Dinding'} · ${setName}`;
    if (it.kind === 'seed') return seedLock(it) ? `Terbuka di Lv ${seedLock(it)}` : `Panen dalam ${growText(Number(it.data?.growMinutes) || 1)}`;
    if (it.kind === 'wear') return [SLOT_LABEL[slotOf(it)] ?? '', it.data?.outfit ? `Set ${it.data.outfit}` : ''].filter(Boolean).join(' · ');
    if (it.kind === 'wallpaper') return 'Dinding';
    if (it.kind === 'floor') return 'Lantai';
    if (it.kind === 'room') return `${it.data?.theme === 'luar' ? 'Halaman' : 'Ruangan'} ${it.data?.size ?? 6}×${it.data?.size ?? 6}`;
    return it.description ?? '';
  }
  const ownRoom = (id: string) => rooms.find((r) => r.item === id);
  /** bibit kebun yang belum terbuka untuk level pet sekarang: level yang dibutuhkan, atau 0 */
  const seedLock = (it: any) => (it.kind === 'seed' && Number(it.data?.minLevel) > (G.me.pet?.level ?? 1) ? Number(it.data.minLevel) : 0);

  async function buy(it: any, currency: 'coin' | 'pearl') {
    const price = currency === 'coin' ? it.price_coin : it.price_pearl;
    if ((currency === 'pearl' || price >= 150 || it.kind === 'room') && confirm !== it.id + currency) { confirm = it.id + currency; sfx.tap(); return; }
    confirm = '';
    const r: any = await run(() => post('/api/shop/buy', { itemId: it.id, currency }));
    if (!r) return;
    sfx.coin();
    if (it.kind === 'room') { sfx.level(); toast(`${it.name} sudah dibangun! Ketuk Lihat untuk masuk.`, 'good'); }
    else toast(`${it.name} masuk Tas`, 'good');
  }
  async function sell(it: any) {
    if (confirm !== 'sell:' + it.id) { confirm = 'sell:' + it.id; sfx.tap(); return; }
    confirm = '';
    const r: any = await run(() => post('/api/shop/sell', { itemId: it.id }));
    if (r) { sfx.coin(); toast(`Terjual +${r.earned} koin`, 'good'); }
  }
  function leave() { sfx.tap(); G.view = 'map'; }

  /* ---------- Coba & Kaca Pas: pakaian dicoba di pet sendiri (satu per bagian tubuh), dibeli sekaligus ---------- */
  let tried = $state<Record<string, string>>({});
  let lastTry = $state('');
  const triedItems = $derived(Object.values(tried).map((id) => itemOf(id)).filter(Boolean) as any[]);
  const toBuy = $derived(triedItems.filter((i) => !hasItem(i.id) && canBuy(i)));
  const total = $derived(toBuy.reduce((t, i) => (i.price_coin > 0 ? { ...t, coin: t.coin + i.price_coin } : { ...t, pearl: t.pearl + i.price_pearl }), { coin: 0, pearl: 0 }));
  const short = $derived(G.me.wallet.coin < total.coin || G.me.wallet.pearl < total.pearl);
  function tryOn(it: any) {
    const s = slotOf(it);
    const next = { ...tried };
    if (next[s] === it.id) delete next[s]; else { next[s] = it.id; lastTry = s; }
    tried = next;
    confirm = '';
    sfx.pop();
  }
  function untry(s: string) { const next = { ...tried }; delete next[s]; tried = next; confirm = ''; sfx.tap(); }
  function clearTried() { tried = {}; confirm = ''; sfx.tap(); }
  async function buyTried() {
    if (confirm !== 'kacapas') { confirm = 'kacapas'; sfx.tap(); return; }
    confirm = '';
    const n = toBuy.length;
    const r: any = await run(() => post('/api/shop/buy-many', { items: toBuy.map((i) => i.id), total }));
    if (!r) return;
    sfx.coin();
    toast(`${n} barang masuk Tas. Ketuk Pakai semua untuk langsung memakainya.`, 'good');
  }
  async function wearTried() {
    const r = await run(() => api.post('/api/pet/look', { wear: { ...tried } }));
    if (!r) return;
    sfx.pop(); fx('hearts');
    toast(`${G.me.pet.name} memakai ${triedItems.length} barang baru!`, 'good');
    tried = {};
  }
  // pakaian set padu-padan lengkap dicoba bersama → celetukan khusus
  const outfitDone = $derived.by(() => {
    const names = triedItems.map((i) => i.data?.outfit).filter(Boolean) as string[];
    return names.find((n) => names.filter((x) => x === n).length >= 2) ?? '';
  });
  const greet = $derived(
    triedItems.length ? (outfitDone ? `Set ${outfitDone}! Cocok sekali.` : TRY_LINE[lastTry] ?? TRY_LINE.body)
      : loc?.id === 'butik' && newIn('body') ? 'Koleksi baju baru sudah datang! Mau coba yang mana?' : keeper.greet,
  );
  const fitSvg = $derived.by(() => {
    if (!triedItems.length) return '';
    const p = G.me.pet;
    const wear = { ...(p.wear ?? {}), ...tried };
    return renderPet(p, Object.values(wear).map((id) => itemOf(id as string)).filter(Boolean) as any[], { mood: 'senang', chub: p.chub ?? 0 });
  });

  /** etalase: beberapa barang toko dipajang di rak (rak bawah hanya sisi kiri: tengah ada penjaga, kanan gelembung sapaan) */
  const SLOTS = [[62, 50], [120, 50], [178, 50], [236, 50], [294, 50], [62, 112], [120, 112]];
  const shelfIcon = (it: any, i: number) => itemIcon(it).replace('<svg ', `<svg x="${SLOTS[i][0]}" y="${SLOTS[i][1]}" width="50" height="40" `);
  // daftar id (string) dulu: gambar etalase hanya dibuat ulang bila isinya berubah, bukan tiap detik jam
  const shelfIds = $derived.by(() => {
    // Butik: rak atas memajang aksesori (baru lebih dulu); rak bawah diganti manekin
    if (wearShop) return all.filter((i) => slotOf(i) !== 'body').sort((a, b) => Number(isNew(b)) - Number(isNew(a))).slice(0, 5).map((i) => i.id).join(' ');
    // saat mencoba, rak bawah kiri dipakai pet
    return all.slice(0, triedItems.length ? 5 : SLOTS.length).map((i) => i.id).join(' ');
  });
  const shelf = $derived(shelfIds.split(' ').map((id) => itemOf(id)).filter(Boolean).map(shelfIcon).join(''));
  /** dua manekin memajang baju, bergiliran setiap hari (baru lebih dulu) */
  const dummyIds = $derived.by(() => {
    if (!wearShop) return '';
    const bodies = all.filter((i) => slotOf(i) === 'body');
    const fresh = bodies.filter(isNew);
    const pool = fresh.length >= 2 ? fresh : bodies;
    if (!pool.length) return '';
    const d = Math.floor(nowMin / 1440);
    return [pool[(d * 2) % pool.length], pool[(d * 2 + 1) % pool.length]].map((i) => i.id).join(' ');
  });
  const dummies = $derived(dummyIds ? dummyIds.split(' ').map((id) => itemOf(id)).filter(Boolean).map((it) => mannequinSVG(it!)) : []);
  const keeperSvg = $derived(renderPet(keeper.look, (keeper.wear ?? []).map((id) => itemOf(id)).filter(Boolean) as any[]));
</script>

<div class="shop" class:wide={wearShop} style="--body:{body};--roof:{roof};--roofdk:{shade(roof, -0.25)}">
  <div class="front">
    <svg class="scene" viewBox="0 0 400 260" preserveAspectRatio="xMidYMax meet" role="img" aria-label="Di dalam {loc?.name}">
      <rect x="0" y="0" width="400" height="260" fill="var(--body)" />
      <rect x="0" y="196" width="400" height="64" fill={shade(body, -0.18)} />
      <!-- rak barang -->
      <!-- Butik: rak bawah diganti manekin; saat mencoba, rak bawah kiri memberi tempat untuk pet -->
      {#each wearShop ? [92] : [92, 154] as y}{@const cut = y === 154 && !!fitSvg}<rect x={cut ? 140 : 50} y={y} width={cut ? 210 : 300} height="9" rx="3" fill="#B98B4E" stroke="#2B2F4A" stroke-width="2.5" />{/each}
      {@html shelf}
      {#if fitSvg}
        <!-- pet sendiri memakai barang yang sedang dicoba -->
        <g transform="translate(66 197) scale(.66)"><g class="pet-bob">{@html fitSvg}</g></g>
        <g transform="translate(66 106)"><rect x="-36" y="-10" width="72" height="19" rx="9.5" fill="#8FD3A7" stroke="#2B2F4A" stroke-width="2" /><text x="0" y="4" text-anchor="middle" font-family="'Baloo 2',system-ui,sans-serif" font-weight="800" font-size="11" fill="#2B2F4A">Lagi dicoba</text></g>
        {#each [[24, 130], [108, 122], [112, 160]] as [x, y]}<path class="twinkle" d="M{x} {y - 5}l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5Z" fill="#F2C94C" stroke="#2B2F4A" stroke-width="1" />{/each}
      {:else if dummies[0]}
        <g transform="translate(60 198) scale(.56)">{@html dummies[0]}</g>
      {/if}
      {#if dummies[1]}<g transform="translate(122 198) scale(.56)">{@html dummies[1]}</g>{/if}
      <!-- tenda/kanopi -->
      <path d="M0 0H400V26H0Z" fill="var(--roof)" stroke="#2B2F4A" stroke-width="3" />
      {#each Array(10) as _, i}<path d="M{i * 40} 24q20 22 40 0Z" fill={i % 2 ? '#FFFDF7' : roof} stroke="#2B2F4A" stroke-width="2.5" stroke-linejoin="round" />{/each}
      <!-- penjaga di balik meja -->
      <g transform="translate(200 192) scale(.82)"><g class="pet-bob">{@html keeperSvg}</g></g>
      <rect x="96" y="196" width="208" height="56" rx="8" fill="#C8955A" stroke="#2B2F4A" stroke-width="3" />
      <rect x="96" y="196" width="208" height="12" rx="6" fill="#E3B370" stroke="#2B2F4A" stroke-width="3" />
      <rect x="150" y="222" width="100" height="22" rx="11" fill="#FFFDF7" stroke="#2B2F4A" stroke-width="2.5" />
      <text x="200" y="238" text-anchor="middle" font-family="'Baloo 2',system-ui,sans-serif" font-weight="800" font-size="13.5" fill="#2B2F4A">{keeper.name}</text>
      <!-- gelembung sapaan di samping penjaga -->
      <path d="M252 132l-14 8 16 2Z" fill="#FFFDF7" stroke="#2B2F4A" stroke-width="2.5" stroke-linejoin="round" />
      <foreignObject x="250" y="98" width="144" height="74"><p class="bubble" xmlns="http://www.w3.org/1999/xhtml">{greet}</p></foreignObject>
      {#if anyNew}
        <!-- pita BARU! di pojok etalase selama ada barang baru -->
        <g class="ribbon"><path d="M0 40L40 0H70L0 70Z" fill="#E0583F" stroke="#2B2F4A" stroke-width="2.5" stroke-linejoin="round" /><path d="M0 46L46 0M0 64L64 0" stroke="#FFFDF7" stroke-width="1.4" stroke-dasharray="3 3" />
          <text transform="translate(27 31) rotate(-45)" text-anchor="middle" font-family="'Baloo 2',system-ui,sans-serif" font-weight="800" font-size="14" fill="#FFFDF7" stroke="#2B2F4A" stroke-width="3" paint-order="stroke">BARU!</text></g>
      {/if}
    </svg>
    <button class="btn sm back" onclick={leave}>{@html I.back} Keluar</button>
  </div>

  <section class="panel" aria-label="Barang di {loc?.name}">
    {#if triedItems.length && (G.shopTab === 'buy' || !loc?.sells_back)}
      <!-- Kaca Pas: bilah lengket berisi barang yang dicoba -->
      <div class="fit" role="region" aria-label="Kaca Pas">
        <div class="fh"><b>Kaca Pas</b><span>{triedItems.length} dicoba</span><button class="clear" onclick={clearTried}>Lepas semua</button></div>
        <div class="tchips">
          {#each SLOT_ORDER.filter((s) => tried[s]) as s (s)}
            {@const it = itemOf(tried[s])}
            {#if it}<span class="tchip"><span class="tci">{@html itemIcon(it)}</span><span class="tn">{it.name}</span>{#if hasItem(it.id)}<i class="own">Punya</i>{/if}<button class="tx" aria-label="Lepas {it.name}" onclick={() => untry(s)}>×</button></span>{/if}
          {/each}
        </div>
        {#if toBuy.length}
          <button class="btn sm hot buyall" disabled={G.busy || short} onclick={buyTried}>
            {confirm === 'kacapas' ? 'Yakin? Beli' : 'Beli'} {toBuy.length} item ·{#if total.coin}<span class="amt">{@html COIN}{fmt(total.coin)}</span>{/if}{#if total.pearl}<span class="amt">{@html PEARL}{fmt(total.pearl)}</span>{/if}
          </button>
          {#if short}<p class="fnote">{total.coin > G.me.wallet.coin ? 'Koin' : 'Mutiara'} belum cukup untuk semuanya. Lepas beberapa dulu.</p>{/if}
        {:else}
          <button class="btn sm green buyall" disabled={G.busy} onclick={wearTried}>Pakai semua</button>
        {/if}
      </div>
    {/if}
    <header>
      <h2>{loc?.name ?? 'Toko'}</h2>
      <span class="wallet"><span>{@html COIN}<b>{fmt(G.me.wallet.coin)}</b></span><span>{@html PEARL}<b>{fmt(G.me.wallet.pearl)}</b></span></span>
    </header>
    {#if loc?.sells_back}
      <div class="seg">
        <button class:on={G.shopTab === 'buy'} onclick={() => (G.shopTab = 'buy')}>Beli</button>
        <button class:on={G.shopTab === 'sell'} onclick={() => (G.shopTab = 'sell')}>Jual</button>
      </div>
    {/if}
    {#if loc?.kind === 'pearl'}
      <button class="btn block pearlbuy" onclick={() => (G.sheet = 'pearls')}>{@html PEARL} Tambah Mutiara</button>
    {/if}

    {#if G.shopTab === 'buy' || !loc?.sells_back}
      {#if wearShop && slots.length > 1}
        <div class="tabbar slots" role="tablist">
          <button role="tab" aria-selected={!slot} class:on={!slot} onclick={() => (slot = '')}>Semua</button>
          {#each slots as s}<button role="tab" aria-selected={slot === s} class:on={slot === s} onclick={() => (slot = s)}>{SLOT_LABEL[s]}{#if newIn(s) && s === 'body'}<i class="nb">Baru!</i>{/if}</button>{/each}
        </div>
      {:else if cats.length > 1}
        <div class="tabbar" role="tablist">
          <button role="tab" aria-selected={!cat} class:on={!cat} onclick={() => (cat = '')}>Semua</button>
          {#if sets.length}<button role="tab" aria-selected={cat === 'set'} class:on={cat === 'set'} onclick={() => (cat = 'set')}>Set ✦</button>{/if}
          {#each cats as k}<button role="tab" aria-selected={cat === k} class:on={cat === k} onclick={() => (cat = k)}>{KIND_LABEL[k] ?? k}</button>{/each}
        </div>
      {/if}
      {#if wearShop && !triedItems.length}
        {@const n = list.filter(isNew).length}
        <p class="hint">{n ? `${n} ${slot === 'body' ? 'baju' : 'barang'} baru! ` : ''}Ketuk <b>Coba</b> untuk melihatnya di {G.me.pet.name} sebelum membeli.</p>
      {/if}
      {#if cat === 'set'}
        <p class="hint">Paket berisi semua item set yang belum kamu punya, hemat {settings().premium?.bundleDiscount ?? 20}%. Pasang {settings().premium?.bonusMin ?? 3} item atau lebih dari set yang sama di satu ruangan untuk efek suasana.</p>
        {#each sets as x (x.st.key)}
          <div class="set" style="--sc:{x.st.color}">
            <div class="sh"><b>{x.st.name}</b><span>{x.its.length - x.left.length}/{x.its.length} dimiliki</span></div>
            <p class="sd">{x.st.desc}</p>
            <div class="sicons">{#each x.its as i (i.id)}<span class:own={hasItem(i.id)} title={i.name}>{@html itemIcon(i)}</span>{/each}</div>
            <p class="sb">✦ Suasana: {x.st.bonus}</p>
            {#if x.left.length}
              <button class="btn hot sbuy" class:sure={confirm === 'set:' + x.st.key} disabled={G.busy || G.me.wallet.pearl < x.bp.price} onclick={() => buySet(x)}>
                {#if confirm === 'set:' + x.st.key}Yakin? {@html PEARL}{x.bp.price}{:else}Beli paket {x.left.length} item · {@html PEARL}{x.bp.price}{#if x.bp.total > x.bp.price}<s>{x.bp.total}</s>{/if}{/if}
              </button>
            {:else}<span class="chip done">Set lengkap ✓</span>{/if}
          </div>
        {/each}
      {:else if list.length === 0}<p class="muted">Belum ada barang di toko ini.</p>{/if}
      {#if loc?.id === 'bangunan' && !cat}
        <div class="expand"><b>Perluas ruangan</b><ExpandRooms /></div>
      {/if}
      {#if list.some((i) => i.kind === 'room')}<p class="hint">Ruangan baru langsung jadi bagian rumahmu ({rooms.length}/{maxRooms} ruangan). Pindah ruangan lewat tombol nama ruangan di Rumah.</p>{/if}
      <div class="grid">
        {#each list as it (it.id)}
          {@const mine = it.kind === 'room' ? ownRoom(it.id) : null}
          {@const on = it.kind === 'wear' && tried[slotOf(it)] === it.id}
          <ItemCard {it} sub={sub(it)} tried={on} badge={it.event_id && eventIds.has(it.event_id) ? 'Event' : mine ? 'Punya' : owned(it.id) ? `×${owned(it.id)}` : isNew(it) ? 'Baru' : ''}>
            <div class="acts">
              {#if it.kind === 'wear'}
                <button class="btn sm try" class:on aria-pressed={on} onclick={() => tryOn(it)}>{#if on}✓ Dicoba{:else}{@html I.hanger}Coba{/if}</button>
              {/if}
              {#if mine}
                <button class="btn sm" onclick={() => { switchRoom(mine.id); G.view = 'home'; }}>Lihat</button>
              {:else if it.kind === 'room' && rooms.length >= maxRooms}
                <button class="btn sm" disabled>Rumah penuh</button>
              {:else if seedLock(it)}
                <button class="btn sm" disabled>Lv {seedLock(it)}</button>
              {:else}
                {#if it.price_coin > 0}
                  <button class="btn sm" class:hot={confirm === it.id + 'coin'} disabled={G.busy || G.me.wallet.coin < it.price_coin} onclick={() => buy(it, 'coin')}>
                    {#if confirm === it.id + 'coin'}Yakin?{:else}{@html COIN}{fmt(it.price_coin)}{/if}
                  </button>
                {/if}
                {#if it.price_pearl > 0}
                  <button class="btn sm" class:hot={confirm === it.id + 'pearl'} disabled={G.busy || G.me.wallet.pearl < it.price_pearl} onclick={() => buy(it, 'pearl')}>
                    {#if confirm === it.id + 'pearl'}Yakin?{:else}{@html PEARL}{fmt(it.price_pearl)}{/if}
                  </button>
                {/if}
              {/if}
            </div>
          </ItemCard>
        {/each}
      </div>
    {:else}
      {#if sellable.length === 0}<p class="muted">Tidak ada barang yang bisa dijual. Hasil kebun, ikan, dan barang bekas bisa dijual di sini.</p>{/if}
      <div class="grid">
        {#each sellable as { it, n } (it!.id)}
          <ItemCard it={it!} sub="Punya {n}">
            <button class="btn sm" class:hot={confirm === 'sell:' + it!.id} disabled={G.busy} onclick={() => sell(it)}>
              {#if confirm === 'sell:' + it!.id}Jual?{:else}+{@html COIN}{it!.sell_coin}{/if}
            </button>
          </ItemCard>
        {/each}
      </div>
    {/if}
  </section>
</div>

<style>
  .set { display: flex; flex-direction: column; gap: 6px; border: 2.5px solid var(--ink); border-radius: 18px; padding: 10px 12px; background: var(--paper); box-shadow: 0 3px 0 var(--ink); border-top: 8px solid var(--sc); }
  .sh { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .sh b { font-size: 17px; font-weight: 800; }
  .sh span { font-size: 13px; font-weight: 700; color: var(--muted); }
  .sd, .sb { margin: 0; font-size: 13px; font-weight: 600; color: var(--muted); }
  .sb { color: var(--ink); }
  .sicons { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; }
  .sicons span { aspect-ratio: 1; border-radius: 10px; background: var(--soft); display: grid; place-items: center; opacity: .55; }
  .sicons span.own { opacity: 1; box-shadow: inset 0 0 0 2px #3FA06A; }
  .sicons :global(svg) { width: 100%; height: 100%; }
  .sbuy { gap: 4px; }
  .sbuy :global(svg) { width: 18px; height: 18px; }
  .sbuy s { margin-left: 4px; opacity: .6; font-weight: 700; }
  .chip.done { align-self: flex-start; background: #DCEFE8; color: #1E7A63; font-weight: 800; border-radius: 999px; padding: 2px 10px; }
  .shop { position: absolute; inset: 0; display: flex; flex-direction: column; background: var(--body); }
  .front { position: relative; flex: 0 0 auto; height: min(44dvh, 380px); padding-top: calc(var(--safe-t) + 100px); }
  .scene { display: block; width: 100%; height: 100%; }
  .bubble { margin: 0; box-sizing: border-box; max-height: 72px; overflow: hidden; background: var(--paper); border: 2px solid var(--ink); border-radius: 12px; padding: 4px 8px; font-weight: 700; font-size: 11.5px; line-height: 1.2; text-align: left; color: var(--ink); font-family: var(--font); }
  .back { position: absolute; left: max(10px, var(--safe-l)); bottom: 10px; }
  .panel { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; display: flex; flex-direction: column; gap: 12px; background: var(--paper); border-top: 3px solid var(--ink); border-radius: 24px 24px 0 0; padding: 14px max(14px, var(--safe-r)) calc(var(--safe-b) + 96px) max(14px, var(--safe-l)); }
  .panel > :global(*) { flex-shrink: 0; }
  header { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
  h2 { margin: 0; font-size: 22px; font-weight: 800; }
  .wallet { display: flex; gap: 6px; }
  .wallet span { display: inline-flex; align-items: center; gap: 4px; border: 2px solid var(--ink); border-radius: 999px; padding: 1px 8px 1px 4px; font-weight: 800; font-size: 15px; background: var(--soft); }
  .wallet :global(svg) { width: 20px; height: 20px; }
  .seg { display: flex; border: 2.5px solid var(--ink); border-radius: 12px; overflow: hidden; }
  .seg button { flex: 1; border: 0; background: var(--paper); font-weight: 800; font-size: 15px; min-height: 38px; cursor: pointer; }
  .seg button.on { background: var(--coin); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 10px; }
  .pearlbuy { background: #ECE6F6; }
  .hint { margin: 0; font-size: 13.5px; font-weight: 600; background: #E6F3EC; border-radius: 10px; padding: 6px 10px; overflow-wrap: anywhere; }
  .muted { margin: 0; }
  /* tombol di kartu: Coba + harga, turun ke baris baru bila kartu sempit */
  .acts { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; margin-top: 2px; }
  .try { background: #fff; gap: 4px; padding: 4px 8px; }
  .try.on { background: #8FD3A7; }
  .try :global(svg) { width: 18px; height: 18px; }
  @media (max-width: 380px) { .try :global(svg) { display: none; } }
  /* lencana "Baru!" di tab Baju */
  .slots > button { position: relative; }
  .nb { position: absolute; top: -9px; right: -9px; font-style: normal; background: var(--low); color: #fff; border: 2px solid var(--ink); border-radius: 9px; font-size: 10.5px; font-weight: 800; padding: 0 5px; line-height: 15px; transform: rotate(8deg); white-space: nowrap; }
  .slots { padding-top: 8px; }
  /* Kaca Pas: lengket di atas panel saat digulir */
  .fit { position: sticky; top: 0; z-index: 3; display: flex; flex-direction: column; gap: 6px; background: #E6F3EC; border: 2.5px solid var(--ink); border-radius: 16px; padding: 8px 10px; box-shadow: 0 3px 0 var(--ink); }
  /* tutup celah padding di atas bilah supaya kartu yang digulir tidak terlihat di atasnya */
  .fit::before { content: ''; position: absolute; left: -20px; right: -20px; top: -17px; height: 14.5px; background: var(--paper); }
  .fh { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
  .fh b { font-size: 17px; font-weight: 800; }
  .fh span { font-size: 13px; font-weight: 700; color: var(--muted); }
  .clear { margin-left: auto; border: 0; background: none; padding: 2px 0; font: 700 13px var(--font); color: #A93A27; text-decoration: underline; cursor: pointer; min-height: 28px; }
  .tchips { display: flex; gap: 6px; flex-wrap: wrap; }
  .tchip { display: inline-flex; align-items: center; gap: 4px; min-width: 0; max-width: 100%; background: #fff; border: 2px solid var(--ink); border-radius: 10px; padding: 1px 2px; font-weight: 700; font-size: 13px; line-height: 1.15; }
  .tn { min-width: 0; overflow-wrap: anywhere; }
  .tci { width: 34px; height: 22px; background: var(--tint); border-radius: 6px; display: grid; place-items: center; }
  .tci :global(svg) { width: 32px; height: 21px; }
  .own { font-style: normal; font-size: 11px; font-weight: 800; color: #1E7A4C; }
  .tx { border: 0; background: none; font: 800 16px var(--font); color: var(--muted); width: 26px; height: 26px; padding: 0; cursor: pointer; }
  .buyall { align-self: stretch; gap: 5px; flex-wrap: wrap; }
  .buyall .amt { display: inline-flex; align-items: center; gap: 3px; }
  .buyall :global(svg) { width: 18px; height: 18px; }
  .fnote { margin: 0; font-size: 12.5px; font-weight: 700; color: #A93A27; }
  /* layar pendek: Kaca Pas lebih ringkas supaya kartu tetap terlihat */
  @media (max-height: 700px) {
    .fit { padding: 5px 8px; gap: 4px; }
    .fh b { font-size: 15px; }
    .tci { display: none; }
    .tchip { padding: 1px 2px 1px 7px; }
    .buyall { min-height: 32px; }
  }
  .twinkle { animation: twinkle 1.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
  .twinkle:nth-of-type(2n) { animation-delay: -.8s; }
  @keyframes twinkle { 50% { opacity: .35; transform: scale(.7); } }
  @media (prefers-reduced-motion: reduce) { .twinkle { animation: none; } }
  @media (min-width: 900px) and (min-aspect-ratio: 1/1) {
    .shop { flex-direction: row; }
    .front { flex: 1; height: auto; padding: calc(var(--safe-t) + 96px) 0 96px; }
    .back { bottom: 110px; left: 20px; }
    .panel { flex: 0 0 460px; margin: calc(var(--safe-t) + 108px) 14px 96px 0; border: 3px solid var(--ink); border-radius: 22px; box-shadow: 0 5px 0 var(--ink); padding-bottom: 16px; }
    /* Butik: panel lebih lebar; kartu cukup lebar untuk Coba + harga dalam satu baris */
    .wide .panel { flex-basis: min(800px, 54vw); }
    .wide .grid { grid-template-columns: repeat(auto-fill, minmax(166px, 1fr)); }
    .wide .acts { gap: 5px; }
    .wide .acts .btn.sm { padding: 4px 8px; }
  }
  .expand { display: flex; flex-direction: column; gap: 6px; background: #FFF4D6; border: 2px solid var(--ink); border-radius: 14px; padding: 8px 10px; margin-bottom: 8px; }
  .expand b { font-size: 15px; }
</style>
