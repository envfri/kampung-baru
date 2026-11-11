<script lang="ts">
  // Kartu profil pemain lain: muncul saat pet atau label namanya diketuk (alun-alun, rumah teman, rumahku).
  // Ajak berteman / menunggu / terima ajakan / kunjungi rumahnya, kirim hati, dan laporkan · blokir · antar pulang.
  import { untrack } from 'svelte';
  import { petSVG } from '@kb/shared';
  import { G, wearItems, fail } from '../lib/game.svelte';
  import { H, SQUARE, block, kick, report, sendHeart } from '../lib/house.svelte';
  import { FR, askFriend, answerAsk, loadRelations } from '../lib/friends.svelte';
  import { ask } from '../lib/account.svelte';
  import { api } from '../lib/api';
  import { sfx } from '../lib/sfx';

  let { mode }: { mode: 'home' | 'visit' | 'alun' } = $props();
  const m = $derived(H.card ? H.members.find((x) => x.id === H.card) ?? null : null);
  const rel = $derived(m ? FR.rel[m.id] : undefined);
  const square = $derived(H.hostId === SQUARE);
  let reporting = $state(false), reason = $state(''), busy = $state(false);

  // kartu dibuka untuk pemain lain: muat status pertemanan; pemain pergi dari sini = kartu tertutup
  $effect(() => { const id = H.card; untrack(() => { reporting = false; reason = ''; if (id) loadRelations([id]); }); });
  $effect(() => { if (H.card && !m) H.card = null; });

  const close = () => { H.card = null; };
  const petName = $derived(m?.pet?.name ?? m?.name ?? '');
  const where = $derived(square ? `Di Alun-alun${H.inst > 1 ? ` ${H.inst}` : ' 1'}` : '');

  async function visitHome() {
    if (!m || busy) return;
    busy = true;
    try {
      const v = await api.get(`/api/visit/${m.id}`);
      close();
      G.visit = v; G.view = 'visit'; G.sheet = null;
      sfx.tap();
    } catch (e) { fail(e); } finally { busy = false; }
  }
  function heart() { if (!m) return; sendHeart(m.id); }
  async function doBlock() {
    if (!m) return;
    const t = m;
    close();
    const text = mode === 'home'
      ? `${t.name} akan diantar pulang, berhenti berteman denganmu, dan tidak bisa menambahkanmu atau berkunjung lagi. Bisa dibuka lagi di Pengaturan.`
      : square ? 'Kalian tidak akan saling melihat atau mendengar di alun-alun, dan tidak bisa berteman atau berkunjung. Bisa dibuka lagi di Pengaturan.'
      : 'Kalian berhenti berteman dan tidak bisa saling berkunjung. Bisa dibuka lagi di Pengaturan.';
    if (!(await ask({ title: `Blokir ${t.name}?`, text, yes: 'Blokir', danger: true }))) return;
    await block(t.id, t.name);
    // memblokir tuan rumah saat berkunjung: pulang
    if (mode === 'visit' && t.host) { G.visit = null; G.view = 'home'; }
  }
  async function sendReport() {
    if (!m || busy) return;
    busy = true;
    if (await report(m.id, m.name, reason)) close();
    busy = false;
  }
  function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && H.card) { e.stopPropagation(); close(); } }
</script>

<svelte:window onkeydown={onKey} />
{#if m}
  <button class="back" tabindex="-1" aria-label="Tutup kartu" onclick={close}></button>
  <div class="pcard" role="dialog" aria-modal="true" aria-labelledby="pc-name">
    <button class="x" aria-label="Tutup" onclick={close}>×</button>
    <div class="top">
      <span class="ava">{#if m.pet}{@html petSVG({ color: m.pet.color ?? '#F2EEE3', ear: m.pet.ear ?? 'tunas', pattern: m.pet.pattern, eyes: m.pet.eyes, tail: m.pet.tail }, wearItems(m.pet.wear))}{/if}</span>
      <div class="who">
        <b id="pc-name">{petName}</b>
        <span>Pemilik: {m.name}</span>
        <div class="chips">
          {#if m.pet?.level}<span class="chip lv">Lv {m.pet.level}</span>{/if}
          {#if rel === 'friend' || mode === 'home'}<span class="chip ok">Teman</span>{/if}
          {#if mode === 'home'}<span class="chip">Tamu</span>{:else if m.host}<span class="chip">Tuan rumah</span>{:else if where}<span class="chip">{where}</span>{/if}
        </div>
      </div>
    </div>

    {#if reporting}
      <p class="ask">Laporkan {m.name}?</p>
      <p class="note">Admin akan memeriksa obrolannya di alun-alun ini.</p>
      <input class="input" bind:value={reason} maxlength="200" placeholder="Alasan (opsional): kata kasar, mengganggu, …" aria-label="Alasan laporan" />
      <div class="row"><button class="btn" onclick={() => (reporting = false)}>Batal</button><button class="btn hot" disabled={busy} onclick={sendReport}>Kirim laporan</button></div>
    {:else}
      {#if mode !== 'home'}
        {#if rel === 'friend'}
          {#if !m.host}<button class="btn hot" disabled={busy} onclick={visitHome}>Kunjungi rumahnya</button>{/if}
        {:else if rel === 'incoming'}
          <p class="ask">{m.name} mengajakmu berteman</p>
          <div class="row">
            <button class="btn" onclick={() => answerAsk(FR.incoming[m.id], m.id, m.name, false)}>Tolak</button>
            <button class="btn hot" onclick={() => answerAsk(FR.incoming[m.id], m.id, m.name, true)}>Terima</button>
          </div>
        {:else if rel === 'sent'}
          <button class="btn off" disabled>Ajakan terkirim · menunggu jawaban</button>
        {:else if rel === 'closed'}
          <button class="btn off" disabled>Belum menerima ajakan berteman</button>
          <p class="note">{m.name} belum menyalakan "Terima ajakan berteman". Kalian tetap bisa ngobrol &amp; main bareng di sini.</p>
        {:else}
          <button class="btn hot" disabled={FR.busy === m.id} onclick={() => askFriend(m.id, m.name)}>Ajak berteman</button>
        {/if}
      {/if}
      <button class="btn" onclick={heart}><span class="hrt" aria-hidden="true">♥</span> Kirim hati</button>
      <div class="foot">
        {#if mode === 'home'}<button onclick={() => { const id = m.id; close(); kick(id); }}>Antar pulang</button>
        {:else if square}<button onclick={() => (reporting = true)}>Laporkan</button>{/if}
        <button class="d" onclick={doBlock}>Blokir</button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .back { position: fixed; inset: 0; z-index: 55; background: rgba(43, 47, 74, .28); border: 0; padding: 0; margin: 0; cursor: default; }
  .pcard { position: fixed; z-index: 56; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-b) + 12px); width: min(400px, calc(100% - 20px)); display: flex; flex-direction: column; gap: 10px; background: var(--paper); border: 3px solid var(--ink); border-radius: 22px; box-shadow: 0 5px 0 var(--ink); padding: 14px 14px 10px; animation: up .22s ease-out; }
  @keyframes up { from { transform: translate(-50%, 24px); opacity: 0; } }
  .x { position: absolute; right: 8px; top: 4px; border: 0; background: none; font-size: 26px; line-height: 1; color: var(--muted); cursor: pointer; min-width: 36px; min-height: 36px; }
  .top { display: flex; gap: 12px; align-items: center; padding-right: 26px; }
  .ava { width: 74px; height: 78px; flex: none; background: #E6F3EC; border: 2.5px solid var(--ink); border-radius: 18px; display: grid; place-items: center; overflow: hidden; }
  .ava :global(svg) { width: 66px; height: 70px; }
  .who { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .who b { font-size: 20px; line-height: 1.1; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .who span { font-size: 14px; font-weight: 600; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 3px; }
  .chip { font-size: 12px; font-weight: 800; padding: 1px 9px 0; border-radius: 999px; background: rgba(43, 47, 74, .08); color: var(--muted); }
  .chip.ok { background: #DCEFE8; color: #1E7A63; }
  .chip.lv { background: var(--ink); color: #F7C548; }
  .pcard > .btn { width: 100%; min-height: 44px; font-size: 16px; }
  .btn.off { box-shadow: none; border-style: dashed; color: var(--muted); background: #F3F1EA; opacity: 1; }
  .row { display: flex; gap: 8px; }
  .row .btn { flex: 1; min-height: 44px; }
  .ask { margin: 0; font-size: 15px; font-weight: 800; }
  .note { margin: 0; font-size: 13.5px; font-weight: 600; color: var(--muted); line-height: 1.3; }
  .hrt { color: #E0583F; }
  .foot { display: flex; justify-content: center; gap: 18px; border-top: 1.5px dashed rgba(43, 47, 74, .2); padding-top: 4px; }
  .foot button { border: 0; background: none; font: inherit; font-size: 14px; font-weight: 700; color: var(--muted); min-height: 36px; padding: 0 6px; cursor: pointer; }
  .foot .d { color: #A93A27; }
</style>
