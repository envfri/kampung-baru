<script lang="ts">
  // Kerja sambilan di rumah sendiri:
  //  - pet sedang kerja → catatan di pintu "Mochi sedang jaga warung · pulang 14.30" + Panggil pulang (pet tidak ada di rumah);
  //  - pet pulang membawa amplop → kartu "Terima gaji": koin, XP, bonus, cerita lucu, kemajuan pangkat & seragam baru;
  //  - setelah diterima: seragam baru bisa langsung dipakai.
  import { itemIcon, kerjaIcon, AMPLOP_ICON, KERJA_RANK_LABEL } from '@kb/shared';
  import { G, item, fx, serverNow, startEdit, goTo } from '../lib/game.svelte';
  import { K, shift, working, gajiWaiting, recall, claim, wearUniform, jamPulang, sisa, durText, watchShift, workLoc } from '../lib/kerja.svelte';
  import { COIN } from '../lib/icons';
  import { sfx } from '../lib/sfx';

  let { side = false, height = $bindable(0) }: { side?: boolean; height?: number } = $props();
  const s = $derived(shift());
  const pet = $derived(G.me.pet);
  const on = $derived(G.now > 0 && working());
  const done = $derived(G.now > 0 && gajiWaiting() && !!s?.done);
  const res = $derived(K.result);
  // waktu kerja habis selagi layar terbuka: muat ulang (gaji, bonus, cerita)
  $effect(() => { void G.now; watchShift(); });
  const pct = $derived(s && on ? Math.max(0, Math.min(1, (serverNow() - s.startedAt) / Math.max(1, s.endsAt - s.startedAt))) : 0);
  let opening = $state(false);
  async function open() {
    if (opening) return;
    opening = true;
    const r = await claim();
    opening = false;
    if (r) { fx('coins'); if (!r.uniform?.length) setTimeout(() => { if (K.result === r) K.result = null; }, 6000); }
  }
  function close() { sfx.tap(); K.result = null; }
  async function pakai(ids: string[]) { if (await wearUniform(ids)) K.result = null; }
  const names = (ids: string[]) => ids.map((id) => item(id)?.name ?? id).join(' & ');
</script>

{#if res}
  <div class="kcard gaji" class:side bind:offsetHeight={height} role="dialog" aria-label="Gaji diterima">
    <div class="head">
      <span class="ic">{@html kerjaIcon(res.job)}</span>
      <div><b>Gaji diterima!</b><span>{res.place}</span></div>
    </div>
    <div class="got">
      <span class="pill">{@html COIN}+{res.pay}</span>
      <span class="pill xp">+{res.xp} XP</span>
      {#if res.bonus && item(res.bonus)}<span class="pill it"><i>{@html itemIcon(item(res.bonus)!)}</i>{item(res.bonus)!.name}</span>{/if}
    </div>
    {#if res.rank.up}<p class="up">Naik pangkat jadi <b>{res.rank.label}</b>! Gaji di sini sekarang lebih besar.</p>{/if}
    {#if res.uniform?.length}
      <div class="uni">
        <span class="icons">{#each res.uniform as id}{@const it = item(id)}{#if it}<i>{@html itemIcon(it)}</i>{/if}{/each}</span>
        <p><b>Seragam baru: {names(res.uniform)}</b><span>Sudah masuk Tas › Pakaian.</span></p>
      </div>
      <div class="row">
        <button class="btn sm" onclick={close}>Nanti</button>
        <button class="btn sm hot" disabled={G.busy} onclick={() => pakai(res.uniform)}>Pakai sekarang</button>
      </div>
    {:else}
      <div class="row"><button class="btn sm" onclick={close}>Tutup</button></div>
    {/if}
  </div>
{:else if done && s}
  <div class="kcard gaji" class:side bind:offsetHeight={height} role="region" aria-label="Terima gaji">
    <div class="head">
      <span class="ic amp">{@html AMPLOP_ICON}</span>
      <div><b>{pet.name} pulang kerja!</b><span>{s.title} {durText(s.minutes)} · {s.place}</span></div>
    </div>
    {#if s.story}<p class="story"><span>“{s.story}”</span></p>{/if}
    <div class="got">
      <span class="pill">{@html COIN}+{s.pay}</span>
      <span class="pill xp">+{s.xp} XP</span>
      {#if s.bonus && item(s.bonus)}<span class="pill it"><i>{@html itemIcon(item(s.bonus)!)}</i>{item(s.bonus)!.name}</span>{/if}
    </div>
    {#if s.rank}
      <div class="prog">
        <div class="bar"><i style="width:{s.rank.up ? 100 : Math.round((s.rank.pct ?? 0) * 100)}%"></i></div>
        <small>{#if s.rank.up}Naik pangkat: <b>{s.rank.label}</b>!{:else}{KERJA_RANK_LABEL[s.rank.after as keyof typeof KERJA_RANK_LABEL] ?? s.rank.label}{/if}{#if s.rank.next}{' · '}{s.rank.shifts}/{s.rank.next.at} shift menuju {s.rank.next.label}{:else}{' · '}pangkat tertinggi{/if}</small>
      </div>
    {/if}
    {#if s.uniform?.length}
      <div class="uni">
        <span class="icons">{#each s.uniform as id}{@const it = item(id)}{#if it}<i>{@html itemIcon(it)}</i>{/if}{/each}</span>
        <p><b>Dapat seragam: {names(s.uniform)}</b><span class="why">Hadiah jadi Karyawan.</span></p>
      </div>
    {/if}
    <button class="btn hot block" disabled={G.busy || opening} onclick={open}>{@html COIN} Terima gaji</button>
  </div>
{:else if on && s}
  <div class="kcard note" class:side bind:offsetHeight={height} role="region" aria-label="Catatan di pintu">
    <span class="tape" aria-hidden="true"></span>
    <div class="head">
      <span class="ic">{@html kerjaIcon(s.job)}</span>
      <div><b>{pet.name} sedang {s.doing}</b><span>di {s.place} · pulang {jamPulang(s.endsAt - G.offset)}</span></div>
    </div>
    <div class="prog" aria-label="Sisa waktu kerja">
      <div class="bar"><i style="width:{Math.round(pct * 100)}%"></i></div>
      <small>{sisa(s.endsAt - serverNow())} lagi. Selama kerja kebutuhan {pet.name} tidak turun.</small>
    </div>
    <div class="row">
      <button class="btn sm" onclick={() => { sfx.tap(); startEdit(); }}>Atur rumah</button>
      <button class="btn sm" onclick={() => { sfx.tap(); goTo(workLoc(s.job)); }}>Lihat di peta</button>
      <button class="btn sm hot" disabled={G.busy} onclick={() => recall()}>Panggil pulang</button>
    </div>
  </div>
{/if}

<style>
  .kcard { position: absolute; z-index: 15; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-b) + 86px); width: min(500px, calc(100vw - 20px)); background: var(--paper); border: 2.5px solid var(--ink); border-radius: 18px; box-shadow: 0 4px 0 var(--ink); padding: 10px 12px; display: flex; flex-direction: column; gap: 7px; animation: pop .2s ease-out; }
  .kcard.note { background: #FFF6D8; border-radius: 6px 18px 18px 18px; }
  .tape { position: absolute; top: -9px; left: 22px; width: 54px; height: 16px; background: rgba(242, 201, 76, .75); border: 1.5px solid rgba(43, 47, 74, .35); transform: rotate(-6deg); border-radius: 2px; }
  .head { display: flex; gap: 10px; align-items: center; }
  .ic { width: 52px; height: 44px; flex: none; background: var(--tint); border-radius: 12px; display: grid; place-items: center; }
  .ic :global(svg) { width: 48px; height: 40px; }
  .ic.amp { background: #FDE6D6; }
  .head div { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .head b { font-size: 16.5px; line-height: 1.2; }
  .head span { font-size: 13.5px; font-weight: 600; color: var(--muted); }
  .story { margin: 0; font-weight: 700; font-size: 14.5px; line-height: 1.3; background: #F4F1EA; border-radius: 12px; padding: 6px 10px; }
  .got { display: flex; flex-wrap: wrap; gap: 6px; }
  .pill { display: inline-flex; align-items: center; gap: 4px; border: 2px solid var(--ink); border-radius: 999px; padding: 1px 10px 1px 6px; font-weight: 800; font-size: 14.5px; background: #FFF3CF; }
  .pill :global(.coin-ic) { width: 18px; height: 18px; }
  .pill.xp { background: #E3F1DA; padding-left: 10px; }
  .pill.it { background: var(--card); }
  .pill i, .icons i { display: inline-grid; place-items: center; width: 26px; height: 22px; }
  .pill i :global(svg), .icons i :global(svg) { width: 26px; height: 22px; }
  .prog { display: flex; flex-direction: column; gap: 2px; }
  .bar { height: 10px; border: 2px solid var(--ink); border-radius: 7px; background: var(--track); overflow: hidden; }
  .bar i { display: block; height: 100%; background: var(--ok); transition: width .6s; }
  .prog small { font-size: 12.5px; font-weight: 700; color: var(--muted); }
  .prog small b { color: var(--ink); }
  .uni { display: flex; align-items: center; gap: 8px; background: #EFF6F2; border-radius: 12px; padding: 5px 8px; }
  .uni .icons { display: inline-flex; gap: 2px; flex: none; }
  .uni .icons i { width: 34px; height: 30px; }
  .uni .icons i :global(svg) { width: 34px; height: 30px; }
  .uni p { margin: 0; display: flex; flex-direction: column; font-size: 13.5px; line-height: 1.2; }
  .uni p span { font-size: 12.5px; font-weight: 600; color: var(--muted); }
  .up { margin: 0; font-weight: 700; font-size: 14px; color: #1E7A4C; }
  .row { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
  @media (max-width: 359px) {
    .row .btn { flex: 1 1 auto; padding: 4px 8px; }
    .head b { font-size: 15.5px; }
  }
  @media (min-width: 900px) and (min-aspect-ratio: 1/1) {
    /* desktop: di kanan bawah, tempat tombol aksi (pet di tengah rumah tetap terlihat); panel tamu di kanan bawah: geser ke kirinya */
    .kcard { left: auto; right: max(14px, var(--safe-r)); transform: none; bottom: calc(var(--safe-b) + 96px); width: min(430px, calc(100vw - 40px)); }
    .kcard.side { left: auto; right: calc(max(150px, var(--safe-r)) + 348px); transform: none; width: min(500px, calc(100vw - 660px)); }
  }
  /* HP pendek (≤ 700 px): kartu diringkas supaya pet yang memegang amplop tetap terlihat di atasnya */
  @media (max-height: 700px) and (max-aspect-ratio: 1/1) {
    .kcard { padding: 7px 10px; gap: 5px; }
    .ic { width: 40px; height: 34px; } .ic :global(svg) { width: 38px; height: 32px; }
    .head b { font-size: 15px; } .head span { font-size: 12.5px; }
    .story { font-size: 13px; padding: 4px 8px; }
    .story span { display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    .got { gap: 4px; }
    .pill { font-size: 13px; padding: 0 8px 0 5px; }
    .pill i { width: 22px; height: 19px; } .pill i :global(svg) { width: 22px; height: 19px; }
    .uni { padding: 3px 6px; } .uni .icons i, .uni .icons i :global(svg) { width: 26px; height: 22px; }
    .uni p { font-size: 12.5px; } .uni .why { display: none; }
    .kcard :global(.btn.block) { min-height: 40px; padding: 4px 10px; }
  }
  @media (prefers-reduced-motion: reduce) { .kcard { animation: none; } .bar i { transition: none; } }
  /* Pengaturan › Kurangi animasi (pilihan di game) */
  :global(:root.reduce-motion) .kcard { animation: none; }
  :global(:root.reduce-motion) .kcard .bar i { transition: none; }
</style>
