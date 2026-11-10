<script lang="ts">
  import { mood, xpToNext, petSVG } from '@kb/shared';
  import { G, needsNow, wearItems, fmt, settings } from '../lib/game.svelte';
  import { I, COIN, PEARL } from '../lib/icons';
  const pet = $derived(G.me.pet);
  const need = $derived(xpToNext(pet.level, settings().economy ?? { xpBase: 40, xpStep: 20 }));
  const ava = $derived(petSVG(pet, wearItems(pet.wear)));
</script>

<div class="hud">
  <button class="card" onclick={() => (G.sheet = 'wardrobe')} aria-label="Lemari: ubah penampilan {pet.name}">
    <span class="ava">{@html ava}</span>
    <span class="id">
      <span class="name"><span class="nm">{pet.name}</span><span class="lv">Lv {pet.level}</span></span>
      <span class="xp" title="{pet.xp}/{need} XP"><i style="width:{Math.min(100, (pet.xp / need) * 100)}%"></i></span>
      <span class="mood">{mood(pet.name, needsNow())}</span>
    </span>
  </button>
  <div class="right">
    <div class="wallet">
      <span class="pill" title="Koin">{@html COIN}<b>{fmt(G.me.wallet.coin)}</b></span>
      <button class="pill" title="Mutiara" onclick={() => (G.sheet = 'pearls')}>{@html PEARL}<b>{fmt(G.me.wallet.pearl)}</b><span class="plus">+</span></button>
    </div>
    <div class="tools">
      <button class="tool" onclick={() => (G.sheet = 'notifs')} aria-label="Notifikasi{G.me.notificationsUnread ? `, ${G.me.notificationsUnread} belum dibaca` : ''}">{@html I.bell}{#if G.me.notificationsUnread}<span class="cnt">{G.me.notificationsUnread > 9 ? '9+' : G.me.notificationsUnread}</span>{/if}</button>
      <button class="tool" onclick={() => (G.sheet = 'news')} aria-label="Kabar kampung">{@html I.news}</button>
      <button class="tool" onclick={() => (G.sheet = 'daily')} aria-label="Hadiah harian">{@html I.calendar}{#if !G.me.daily.claimedToday}<span class="dot"></span>{/if}</button>
      <button class="tool" onclick={() => (G.sheet = 'settings')} aria-label={G.whatsNew ? 'Pengaturan, ada yang baru' : 'Pengaturan'}>{@html I.gear}{#if G.whatsNew}<span class="dot"></span>{/if}</button>
    </div>
  </div>
</div>

<style>
  .hud { position: absolute; top: calc(var(--safe-t) + 8px); left: max(10px, var(--safe-l)); right: max(10px, var(--safe-r)); display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; z-index: 10; pointer-events: none; }
  .hud > * { pointer-events: auto; }
  .card { display: flex; align-items: center; gap: 8px; background: var(--paper); border: 2.5px solid var(--ink); border-radius: 18px; box-shadow: 0 3px 0 var(--ink); padding: 5px 12px 5px 5px; min-width: 0; max-width: 60vw; cursor: pointer; text-align: left; }
  .ava { width: 48px; height: 48px; flex: none; background: #E5F2EC; border: 2px solid var(--ink); border-radius: 13px; overflow: hidden; }
  .ava :global(svg) { width: 100%; height: 100%; }
  .id { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .name { font-weight: 800; font-size: 17px; display: flex; align-items: center; gap: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .nm { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  /* HP kecil: level jadi lencana di pojok avatar supaya nama tetap terbaca */
  @media (max-width: 359px) {
    .card { position: relative; }
    .lv { position: absolute; left: 4px; bottom: 3px; font-size: 10.5px; padding: 0 5px; border: 1.5px solid var(--paper); }
  }
  .lv { flex: none; font-size: 12px; font-weight: 700; background: var(--ink); color: var(--paper); border-radius: 8px; padding: 1px 7px; white-space: nowrap; }
  .xp { display: block; width: 120px; max-width: 100%; height: 9px; border: 2px solid var(--ink); border-radius: 6px; background: var(--track); overflow: hidden; }
  .xp i { display: block; height: 100%; background: var(--sky); transition: width .4s; }
  .mood { font-size: 12.5px; font-weight: 600; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
  .wallet { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
  .pill { display: flex; align-items: center; gap: 5px; background: var(--paper); border: 2.5px solid var(--ink); border-radius: 999px; box-shadow: 0 3px 0 var(--ink); padding: 3px 8px 3px 5px; font-weight: 800; font-size: 16px; font-variant-numeric: tabular-nums; min-height: 36px; cursor: default; }
  button.pill { cursor: pointer; padding-right: 4px; }
  .pill :global(svg) { width: 22px; height: 22px; }
  .plus { width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--ink); background: var(--ok); color: #fff; display: grid; place-items: center; font-size: 15px; line-height: 1; }
  .tools { display: flex; gap: 6px; }
  .tool { position: relative; width: 38px; height: 38px; border-radius: 12px; border: 2.5px solid var(--ink); background: var(--paper); box-shadow: 0 2px 0 var(--ink); display: grid; place-items: center; padding: 0; cursor: pointer; }
  .tool :global(svg) { width: 20px; height: 20px; }
  .cnt { position: absolute; top: -7px; right: -7px; min-width: 19px; height: 19px; border-radius: 10px; background: var(--low); color: #fff; border: 2px solid var(--ink); font-size: 11px; font-weight: 800; display: grid; place-items: center; padding: 0 3px; }
  .dot { position: absolute; top: -4px; right: -4px; width: 12px; height: 12px; border-radius: 50%; background: var(--low); border: 2px solid var(--ink); }
  @media (max-width: 380px) { .xp { width: 84px; } .mood { display: none; } .pill { font-size: 14.5px; } }
</style>
