<script lang="ts">
  // Sahabat Mungil: Sahabatku (ajak / istirahatkan, camilan, main, nama, warna kerang, oleh-oleh), Pondok Sahabat
  // (adopsi dengan koin / Mutiara lewat jalur beli toko, Camilan Sahabat, sahabat Edisi Natal selama masa jualnya), Album
  // (siluet + petunjuk untuk yang belum dimiliki; bagian Edisi Natal: siluet hanya selama masih dijual), dan lembar beri
  // nama sahabat baru (anak ayam di pintu, burung pipit, kunang-kunang).
  import { onMount } from 'svelte';
  import Sheet from '../components/Sheet.svelte';
  import { SAHABAT_INFO, SAHABAT_SPECIES, SAHABAT_BIASA, SAHABAT_NAME_MAX, SAHABAT_CAMILAN, UMANG_COLORS, EDISI_NATAL, albumSections, buddyIcon, itemIcon, levelSub, sisaWaktu, type SahabatSp } from '@kb/shared';
  import { G, canBuy, fmt, item, owned, post, run, serverNow, toast } from '../lib/game.svelte';
  import { SB, activeBuddy, adopt, claimAyam, claimKunang, claimPipit, edisiOnSale, edisiUntil, feed, howText, markPondokSeen, myBuddies, play, rename, sahabatOn, setActive, setShell, spName, takeGift, type Buddy } from '../lib/sahabat.svelte';
  import { COIN, PEARL } from '../lib/icons';
  import { sfx } from '../lib/sfx';

  const arg = G.sheetArg ?? {};
  type Tab = 'saya' | 'pondok' | 'album';
  /** lembar beri nama sahabat baru (bukan tab) */
  const naming: '' | 'ayam' | 'pipit' | 'kunang' = ['ayam', 'pipit', 'kunang'].includes(arg.tab) ? arg.tab : '';
  let tab = $state<Tab>(arg.tab === 'pondok' || arg.tab === 'album' ? arg.tab : 'saya');
  onMount(() => { if (tab === 'pondok') markPondokSeen(); });
  $effect(() => { if (tab === 'pondok') markPondokSeen(); });

  const list = $derived(myBuddies());
  const pet = $derived(G.me.pet?.name ?? 'Pet-mu');
  const snack = $derived(owned(SAHABAT_CAMILAN));
  const gift = $derived(!!G.me.sahabat?.gift && !!activeBuddy());
  const pts = $derived(G.catalog?.settings?.sahabat ?? {});

  /* ---------- beri nama ---------- */
  const sug = $derived(naming ? SAHABAT_INFO[naming].nama : []);
  let nm = $state(naming ? SAHABAT_INFO[naming].nama[0] : '');
  let busy = $state(false);
  async function claim() {
    if (busy) return;
    busy = true;
    const name = nm.trim();
    const r = naming === 'ayam' ? await claimAyam(name) : naming === 'pipit' ? await claimPipit(name) : await claimKunang(name);
    busy = false;
    if (r) { G.sheet = null; G.sheetArg = null; }
  }

  /* ---------- Sahabatku ---------- */
  let editing = $state<string>(arg.rename ?? '');
  let newName = $state('');
  function startRename(b: Buddy) { sfx.tap(); editing = b.id; newName = b.name; }
  async function saveRename(b: Buddy) { if (await rename(b.id, newName.trim())) editing = ''; }
  async function buySnack(n = 1) {
    const r: any = await run(() => post('/api/shop/buy', { itemId: SAHABAT_CAMILAN, currency: 'coin', qty: n }));
    if (r) { sfx.coin(); toast(`${n} Camilan Sahabat masuk Tas`, 'good'); }
  }
  async function feedOne(b: Buddy) {
    if (!snack) { toast('Camilan Sahabat habis. Beli di Pondok Sahabat, ya.', 'error'); tab = 'pondok'; return; }
    await feed(b);
  }

  /* ---------- Pondok ---------- */
  // sahabat yang dijual: Edisi Natal (selama masa jualnya) lebih dulu, lalu sahabat koin & Mutiara biasa
  const shopSp = $derived(SAHABAT_SPECIES.filter((sp) => { const it = item(SAHABAT_INFO[sp].item); return !!it && canBuy(it) && ['koin', 'mutiara', 'edisi'].includes(SAHABAT_INFO[sp].how); })
    .sort((a, b) => Number(!!SAHABAT_INFO[b].edisi) - Number(!!SAHABAT_INFO[a].edisi)));
  const natalSale = $derived(shopSp.filter((sp) => SAHABAT_INFO[sp].edisi === 'natal'));
  // jam kasar (per menit) untuk hitung mundur Edisi Natal
  const nowMin = $derived(Math.floor(serverNow() / 60_000));
  const sisa = (sp: SahabatSp) => sisaWaktu(item(SAHABAT_INFO[sp].item)?.available_to, nowMin * 60_000);
  const snackItem = $derived(item(SAHABAT_CAMILAN));
  let confirm = $state('');
  async function adoptSp(sp: SahabatSp, cur: 'coin' | 'pearl') {
    const it = item(SAHABAT_INFO[sp].item);
    if (!it) return;
    if (confirm !== sp + cur) { confirm = sp + cur; sfx.tap(); return; }
    confirm = '';
    const r = await adopt(sp, cur);
    if (r) tab = 'saya';
  }
  const has = (sp: string) => list.some((b) => b.sp === sp);
  /** Album: sahabat biasa + bagian Edisi Natal (yang belum dimiliki hanya tampil selama masih dijual) */
  const album = $derived(albumSections((sp) => has(sp), edisiOnSale));
  const albumTotal = $derived(SAHABAT_BIASA.length + album.natal.length);

  const title = $derived(naming ? 'Sahabat baru!' : tab === 'pondok' ? 'Pondok Sahabat' : tab === 'album' ? 'Album Sahabat' : 'Sahabat Mungil');
  const trk = (key: string) => SB.trick?.key === key;
</script>

<Sheet {title}>
  {#if naming}
    <div class="newb">
      <span class="big wiggle">{@html buddyIcon(naming)}</span>
      <p class="lead">
        {#if naming === 'ayam'}{pet} menemukan anak ayam kecil di depan pintu! Ia terus mengikuti {pet} sambil berciap. Mau jadi sahabat?
        {:else if naming === 'pipit'}Seekor burung pipit mampir minum di Halaman. Ia hinggap dan bersiul ke {pet}. Mau jadi sahabat?
        {:else}Kunang-kunang kecil berkelip di halaman malam ini. Ia terbang mengelilingi {pet}. Mau jadi sahabat?{/if}
      </p>
    </div>
    <label class="nm">Kasih nama<input bind:value={nm} maxlength={SAHABAT_NAME_MAX} autocomplete="off" aria-label="Nama sahabat" /></label>
    <div class="chips" role="group" aria-label="Saran nama">
      {#each sug as s}<button class="chip" class:on={nm === s} onclick={() => { sfx.tap(); nm = s; }}>{s}</button>{/each}
    </div>
    <p class="note">{SAHABAT_INFO[naming].sifat} Nama bisa diganti kapan saja.</p>
    <button class="btn hot block" disabled={busy || G.busy || nm.trim().length < 2} onclick={claim}>{busy ? 'Sebentar…' : `Jadikan sahabat ${pet}`}</button>
  {:else}
    <div class="tabbar" role="tablist">
      <button role="tab" aria-selected={tab === 'saya'} class:on={tab === 'saya'} onclick={() => (tab = 'saya')}>Sahabatku · {list.length}</button>
      <button role="tab" aria-selected={tab === 'pondok'} class:on={tab === 'pondok'} onclick={() => (tab = 'pondok')}>Pondok</button>
      <button role="tab" aria-selected={tab === 'album'} class:on={tab === 'album'} onclick={() => (tab = 'album')}>Album · {list.length}/{albumTotal}</button>
    </div>
    {#if !sahabatOn()}<p class="warn" role="status">Pondok Sahabat sedang tutup. Sahabatmu tetap menemani {pet}, kegiatan bisa lagi nanti.</p>{/if}

    {#if tab === 'saya'}
      {#if gift}
        {@const b = activeBuddy()!}
        <div class="gift" role="status">
          <span class="gic">{@html buddyIcon(b.sp, { variant: b.variant, lvl: b.lvl })}</span>
          <div><b>{b.name} membawa oleh-oleh!</b><span>Temuan kecil hari ini. Besok bawa lagi.</span></div>
          <button class="btn sm hot" disabled={G.busy} onclick={takeGift}>Terima</button>
        </div>
      {/if}
      {#if !list.length}
        <p class="lead">Belum ada sahabat. {G.me.sahabat?.ayam ? `Ada anak ayam yang menunggu di depan pintu rumah. Ketuk ia di rumah, ya!` : 'Adopsi di Pondok Sahabat.'}</p>
        {#if G.me.sahabat?.ayam}<button class="btn hot block" onclick={() => { G.sheet = null; G.view = 'home'; }}>Ke rumah</button>{/if}
      {/if}
      {#each list as b (b.id)}
        <section class="bud" class:act={b.active} aria-labelledby="bn-{b.id}">
          <div class="top">
            <button class="art" class:trk={trk(b.id)} onclick={() => play(b)} aria-label="Main dengan {b.name}">
              {#key SB.trick?.n}{@html buddyIcon(b.sp, { variant: b.variant, lvl: b.lvl, trick: trk(b.id) && b.lvl >= 1 })}{/key}
            </button>
            <div class="info">
              {#if editing === b.id}
                <div class="ren"><input bind:value={newName} maxlength={SAHABAT_NAME_MAX} aria-label="Nama baru {b.name}" /><button class="btn sm hot" disabled={G.busy || newName.trim().length < 2} onclick={() => saveRename(b)}>Simpan</button><button class="btn sm" onclick={() => (editing = '')}>Batal</button></div>
              {:else}
                <b id="bn-{b.id}">{b.name}{#if b.lvl >= 2}<i class="gold" title="Kalung emas Sahabat Sejati">✦</i>{/if}</b>
              {/if}
              <span>{spName(b.sp)}{#if SAHABAT_INFO[b.sp].edisi} <i class="ednat">✦ {EDISI_NATAL.name}</i>{/if} · {b.active ? `ikut ${pet}` : 'istirahat di rumah'}</span>
            </div>
            <span class="lvl l{b.lvl}">{b.level}</span>
          </div>
          <div class="prog" aria-label="Keakraban">
            <div class="bar"><i style="width:{Math.round(b.pct * 100)}%"></i></div>
            <small>{#if b.next}{b.points} keakraban · {b.need} lagi menuju {b.next}{:else}{b.points} keakraban · Sahabat Sejati!{/if}</small>
          </div>
          <p class="sub">{levelSub(b.sp, b.lvl)}</p>
          {#if b.sp === 'umang'}
            <div class="shells" role="radiogroup" aria-label="Warna rumah kerang {b.name}">
              {#each Object.entries(UMANG_COLORS) as [k, c]}
                <button class="shell" role="radio" aria-checked={(b.variant ?? 'merah') === k} class:on={(b.variant ?? 'merah') === k} style="--c:{c.main}" title={c.label} aria-label={c.label} disabled={G.busy} onclick={() => setShell(b.id, k)}></button>
              {/each}
            </div>
          {/if}
          <div class="acts">
            {#if b.active}<button class="btn sm" disabled={G.busy} onclick={() => setActive(null)}>Istirahatkan</button>
            {:else}<button class="btn sm hot" disabled={G.busy} onclick={() => setActive(b.id)}>Ajak jalan-jalan</button>{/if}
            <button class="btn sm" disabled={G.busy || b.fedToday || !sahabatOn()} onclick={() => feedOne(b)}>{b.fedToday ? 'Sudah makan' : `Beri camilan (${snack})`}</button>
            <button class="btn sm" disabled={!sahabatOn()} onclick={() => play(b)}>Main{b.playsLeft ? ` · ${b.playsLeft}×` : ''}</button>
            {#if editing !== b.id}<button class="btn sm" onclick={() => startRename(b)}>Ganti nama</button>{/if}
          </div>
        </section>
      {/each}
      {#if list.length}<p class="note">Keakraban naik lewat camilan (sekali sehari, +{pts.points?.makan ?? 10}), main ({pts.mainPerDay ?? 3}× sehari, +{pts.points?.main ?? 4}), dan jalan-jalan bareng ke rumah teman, alun-alun, atau keliling kampung (+{pts.points?.jalan ?? 4}). Sahabat tidak pernah sakit atau pergi. Satu sahabat ikut {pet}; yang lain istirahat di rumah.</p>{/if}

    {:else if tab === 'pondok'}
      <p class="lead">Selamat datang di Pondok Sahabat! Adopsi sahabat mungil untuk menemani {pet}, atau beli camilan untuk mereka.</p>
      {#if snackItem}
        <div class="snack">
          <span class="sic">{@html itemIcon(snackItem)}</span>
          <div><b>{snackItem.name}</b><span>{snackItem.price_coin} koin · punya {snack}. Sekali sehari per sahabat.</span></div>
          <div class="sb">
            <button class="btn sm" disabled={G.busy || !canBuy(snackItem) || G.me.wallet.coin < snackItem.price_coin} onclick={() => buySnack(1)}>{@html COIN}{snackItem.price_coin}</button>
            <button class="btn sm" disabled={G.busy || !canBuy(snackItem) || G.me.wallet.coin < snackItem.price_coin * 5} onclick={() => buySnack(5)}>5× {@html COIN}{snackItem.price_coin * 5}</button>
          </div>
        </div>
      {/if}
      {#if natalSale.length}
        <div class="natban" role="note">
          <b>✦ {EDISI_NATAL.name}</b>
          <p>{natalSale.map((sp) => spName(sp)).join(' & ')}: sahabat besar musim dingin, {item(SAHABAT_INFO[natalSale[0]].item)?.price_pearl ?? 25} Mutiara. Dijual terbatas{edisiUntil(natalSale[0]) ? ` sampai ${edisiUntil(natalSale[0])}` : ''}; yang sudah diadopsi menemanimu selamanya.</p>
        </div>
      {/if}
      <div class="grid">
        {#each shopSp as sp (sp)}
          {@const it = item(SAHABAT_INFO[sp].item)!}
          {@const nat = SAHABAT_INFO[sp].edisi === 'natal'}
          <div class="card" class:own={has(sp)} class:natal={nat}>
            {#if nat}<span class="ribbon">✦ {EDISI_NATAL.name}</span>{/if}
            {#if has(sp)}<span class="badge">Punya</span>{/if}
            <span class="ic" class:edfx={nat}>{@html buddyIcon(sp)}</span>
            <b>{it.name}</b>
            <small>{SAHABAT_INFO[sp].sifat}</small>
            {#if nat && sisa(sp)}<span class="cd" title="Edisi terbatas">⏳ {sisa(sp)}</span>{/if}
            {#if has(sp)}<button class="btn sm" onclick={() => (tab = 'saya')}>Lihat</button>
            {:else}
              {#if it.price_coin > 0}<button class="btn sm" class:hot={confirm === sp + 'coin'} disabled={G.busy || !sahabatOn() || G.me.wallet.coin < it.price_coin} onclick={() => adoptSp(sp, 'coin')}>{#if confirm === sp + 'coin'}Yakin?{:else}{@html COIN}{fmt(it.price_coin)}{/if}</button>{/if}
              {#if it.price_pearl > 0}<button class="btn sm" class:hot={confirm === sp + 'pearl'} disabled={G.busy || !sahabatOn() || G.me.wallet.pearl < it.price_pearl} onclick={() => adoptSp(sp, 'pearl')}>{#if confirm === sp + 'pearl'}Yakin?{:else}{@html PEARL}{fmt(it.price_pearl)}{/if}</button>{/if}
            {/if}
          </div>
        {/each}
      </div>
      <p class="note">Kura-kura, burung pipit, dan kunang-kunang tidak dijual: cari mereka sendiri! Petunjuknya ada di Album.</p>
      <button class="btn block" onclick={() => (tab = 'album')}>Buka Album Sahabat</button>

    {:else}
      <div class="album biasa">
        {#each album.biasa as { sp } (sp)}
          {@const b = list.find((x) => x.sp === sp)}
          <div class="cell" class:unk={!b}>
            <span class="ic">{@html buddyIcon(sp, b ? { variant: b.variant, lvl: b.lvl } : { sil: true })}</span>
            <b>{b ? b.name : spName(sp)}</b>
            {#if b}<small>{spName(sp)} · {b.level}</small>{:else}<small class="hint">{howText(sp)}</small>{/if}
          </div>
        {/each}
      </div>
      {#if album.natal.length}
        <!-- Edisi Natal: yang dimiliki selalu tampil; siluet hanya selama masih dijual -->
        <section class="alnat" aria-labelledby="al-natal">
          <h3 id="al-natal">✦ {EDISI_NATAL.name}</h3>
          <div class="album natal">
            {#each album.natal as { sp } (sp)}
              {@const b = list.find((x) => x.sp === sp)}
              <div class="cell" class:unk={!b}>
                <span class="ic">{@html buddyIcon(sp, b ? { variant: b.variant, lvl: b.lvl } : { sil: true })}</span>
                <b>{b ? b.name : spName(sp)}</b>
                {#if b}<small>{spName(sp)} · {b.level}</small>{:else}<small class="hint">{howText(sp)}</small>{/if}
              </div>
            {/each}
          </div>
        </section>
      {/if}
    {/if}
  {/if}
</Sheet>

<style>
  .lead { margin: 0; font-weight: 600; }
  .note { margin: 0; font-size: 12.5px; font-weight: 600; color: var(--muted); }
  .warn { margin: 0; background: #FFF3CF; border: 2px solid #B98B12; border-radius: 12px; padding: 6px 10px; font-weight: 700; font-size: 14px; }
  .newb { display: flex; align-items: center; gap: 12px; }
  .newb .big { width: 96px; height: 88px; flex: none; background: var(--tint); border-radius: 18px; display: grid; place-items: center; border: 2.5px solid var(--ink); }
  .newb .big :global(svg) { width: 84px; height: 78px; }
  .nm { display: flex; flex-direction: column; gap: 4px; font-weight: 800; }
  .nm input, .ren input { font: inherit; font-size: 17px; font-weight: 700; border: 2.5px solid var(--ink); border-radius: 12px; padding: 8px 12px; background: var(--paper); color: var(--ink); min-width: 0; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { border: 2px solid var(--ink); border-radius: 999px; background: var(--paper); padding: 3px 12px; font: inherit; font-weight: 800; font-size: 14px; cursor: pointer; min-height: 34px; color: var(--ink); }
  .chip.on { background: #FFE8A3; }
  .block { width: 100%; }
  .gift { display: flex; align-items: center; gap: 10px; border: 2.5px solid var(--ink); border-radius: 16px; background: #FFF3CF; padding: 8px 10px; box-shadow: 0 3px 0 var(--ink); }
  .gic { width: 52px; height: 46px; flex: none; }
  .gic :global(svg) { width: 100%; height: 100%; }
  .gift div { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .gift b { font-size: 15px; line-height: 1.2; }
  .gift span { font-size: 13px; font-weight: 600; color: var(--muted); }
  .bud { border: 2.5px solid var(--ink); border-radius: 18px; background: var(--card); padding: 10px; display: flex; flex-direction: column; gap: 7px; }
  .bud.act { background: linear-gradient(180deg, #FFF6DC, var(--card) 60%); box-shadow: inset 0 0 0 2px #F2C94C; }
  .top { display: flex; gap: 10px; align-items: center; }
  .art { width: 66px; height: 58px; flex: none; background: var(--tint); border-radius: 14px; display: grid; place-items: center; border: 0; padding: 0; cursor: pointer; }
  .art :global(svg) { width: 62px; height: 56px; }
  .art.trk :global(svg) { animation: budbounce .5s ease-out; }
  .info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .info b { font-size: 17px; line-height: 1.15; }
  .info b .gold { font-style: normal; color: #C9930F; margin-left: 4px; }
  .info span { font-size: 13px; font-weight: 600; color: var(--muted); }
  .ren { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; }
  .ren input { width: 9em; padding: 4px 8px; font-size: 15px; }
  .lvl { flex: none; align-self: flex-start; border: 2px solid var(--ink); border-radius: 999px; padding: 0 9px; font-weight: 800; font-size: 12.5px; background: #E9E4D6; white-space: nowrap; }
  .lvl.l1 { background: #CDE8D6; } .lvl.l2 { background: #F2C94C; }
  .prog { display: flex; flex-direction: column; gap: 2px; }
  .bar { height: 10px; border: 2px solid var(--ink); border-radius: 7px; background: var(--track); overflow: hidden; }
  .bar i { display: block; height: 100%; background: #F08AA0; }
  .prog small { font-size: 12.5px; font-weight: 700; color: var(--muted); }
  .sub { margin: 0; font-size: 12.5px; font-weight: 600; color: var(--muted); }
  .shells { display: flex; gap: 6px; flex-wrap: wrap; }
  .shell { width: 32px; height: 32px; border-radius: 50%; border: 2.5px solid var(--ink); background: var(--c); cursor: pointer; padding: 0; }
  .shell.on { box-shadow: 0 0 0 3px #FFFDF7, 0 0 0 5.5px var(--ink); }
  .acts { display: flex; flex-wrap: wrap; gap: 6px; }
  .snack { display: flex; align-items: center; gap: 10px; border: 2.5px solid var(--ink); border-radius: 16px; background: var(--card); padding: 8px 10px; flex-wrap: wrap; }
  .sic { width: 54px; height: 46px; flex: none; background: var(--tint); border-radius: 12px; display: grid; place-items: center; }
  .sic :global(svg) { width: 50px; height: 42px; }
  .snack > div:not(.sb) { flex: 1 1 140px; min-width: 0; display: flex; flex-direction: column; }
  .snack b { font-size: 15.5px; }
  .snack span { font-size: 12.5px; font-weight: 600; color: var(--muted); }
  .sb { display: flex; gap: 6px; }
  .sb :global(svg), .card :global(.btn svg) { width: 16px; height: 16px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); gap: 10px; }
  .card { position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; border: 2px solid var(--ink); border-radius: 14px; padding: 8px 6px 10px; background: var(--card); min-width: 0; }
  .card .ic { width: 100%; height: 72px; display: grid; place-items: center; background: var(--tint); border-radius: 10px; }
  .card .ic :global(svg) { height: 66px; width: auto; }
  .card b { font-size: 14.5px; line-height: 1.12; }
  .card small { font-size: 12px; font-weight: 600; color: var(--muted); line-height: 1.2; }
  .card .badge { position: absolute; top: -8px; right: -6px; background: #3FA06A; color: #fff; border: 2px solid var(--ink); border-radius: 10px; font-size: 11.5px; font-weight: 800; padding: 0 6px; }
  .album { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  /* Edisi Natal: spanduk Pondok, kartu berpita & bagian Album sendiri (hijau cemara, merah, emas, salju) */
  .natban { display: flex; flex-direction: column; gap: 2px; border: 2.5px solid var(--ink); border-radius: 16px; padding: 8px 12px 10px; color: #FFFDF7; box-shadow: 0 3px 0 var(--ink);
    background: radial-gradient(circle at 88% 22%, rgba(255, 255, 255, .55) 0 2px, transparent 3px), radial-gradient(circle at 72% 70%, rgba(255, 255, 255, .45) 0 1.6px, transparent 2.6px), radial-gradient(circle at 95% 78%, rgba(255, 255, 255, .5) 0 2px, transparent 3px), linear-gradient(120deg, #1F5A3D, #2E7A50 55%, #A8322A); }
  .natban b { font-size: 16px; font-weight: 800; color: #FFE27A; }
  .natban p { margin: 0; font-size: 13px; font-weight: 600; line-height: 1.3; overflow-wrap: anywhere; }
  .card.natal { background: linear-gradient(180deg, #EAF6EE, var(--card) 55%); box-shadow: inset 0 0 0 2px #F2C94C; padding-top: 12px; }
  .card.natal .ic { background: radial-gradient(120% 90% at 50% 30%, #FFFFFF 0%, #E3F1F8 62%, #CFE4F0 100%); }
  .card .ribbon { position: absolute; top: -9px; left: -6px; z-index: 1; background: #1F5A3D; color: #FFE27A; border: 2px solid var(--ink); border-radius: 10px; font-size: 10.5px; font-weight: 800; padding: 0 6px; line-height: 16px; white-space: nowrap; }
  .cd { font-size: 12px; font-weight: 800; color: #8E2A1E; background: #FFE9D6; border: 1.5px solid #E0583F; border-radius: 999px; padding: 0 8px; }
  .ednat { font-style: normal; font-weight: 800; font-size: 11.5px; color: #1F5A3D; white-space: nowrap; }
  .alnat { display: flex; flex-direction: column; gap: 6px; border: 2.5px solid var(--ink); border-radius: 16px; padding: 8px; background: linear-gradient(180deg, #E4F2E9, #F6FBF7); }
  .alnat h3 { margin: 0; font-size: 15px; font-weight: 800; color: #1F5A3D; }
  .album.natal { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .album.natal .cell { border-color: #1F5A3D; }
  .album.natal .cell:not(.unk) { background: #FFFDF7; box-shadow: inset 0 0 0 2px #F2C94C; }
  .album.natal .cell.unk { background: #EEF5F0; }
  .cell { display: flex; flex-direction: column; align-items: center; gap: 2px; text-align: center; border: 2px solid var(--ink); border-radius: 14px; padding: 6px 4px 8px; background: var(--card); min-width: 0; }
  .cell.unk { background: #F1EEE6; border-style: dashed; }
  .cell .ic { width: 100%; height: 64px; display: grid; place-items: center; }
  .cell .ic :global(svg) { height: 60px; width: auto; max-width: 100%; }
  .cell b { font-size: 13.5px; line-height: 1.1; overflow-wrap: anywhere; }
  .cell small { font-size: 11.5px; font-weight: 600; color: var(--muted); line-height: 1.2; }
  .cell small.hint { font-size: 11px; }
  .wiggle :global(svg) { animation: budbounce 1.6s ease-in-out infinite; transform-origin: 50% 100%; }
  @keyframes budbounce { 0%, 100% { transform: translateY(0); } 30% { transform: translateY(-6px) rotate(-4deg); } 60% { transform: translateY(0) rotate(3deg); } }
  @media (max-width: 359px) { .album { grid-template-columns: repeat(2, minmax(0, 1fr)); } .newb .big { width: 76px; height: 70px; } }
  @media (prefers-reduced-motion: reduce) { .wiggle :global(svg), .art.trk :global(svg) { animation: none; } }
  :global(:root.reduce-motion) .wiggle :global(svg), :global(:root.reduce-motion) .art.trk :global(svg) { animation: none; }
</style>
