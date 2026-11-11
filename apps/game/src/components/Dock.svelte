<script lang="ts">
  import { G, track } from '../lib/game.svelte';
  import { I } from '../lib/icons';
  import { sfx } from '../lib/sfx';
  const tabs = [
    { k: 'home', label: 'Rumah', icon: I.home },
    { k: 'map', label: 'Kampung', icon: I.map },
    { k: 'bag', label: 'Tas', icon: I.bag },
    { k: 'quests', label: 'Tugas', icon: I.quest },
    { k: 'friends', label: 'Teman', icon: I.friends },
  ] as const;
  function go(k: (typeof tabs)[number]['k']) {
    sfx.tap();
    if (k === 'home' || k === 'map') {
      if (G.edit) return;
      G.duel = null;
      G.sheet = null;
      if (k === 'map' && (G.view === 'home' || G.view === 'visit')) G.mapAt = 'rumah';
      G.view = k;
      G.visit = null;
      if (k === 'map') track('open_map');
    } else {
      G.sheet = G.sheet === k ? null : k;
    }
  }
  // toko kini didatangi lewat peta: berada di dalam toko = tab Kampung aktif
  const active = (k: string) => (G.sheet ? G.sheet === k : G.view === k || (k === 'map' && ['garden', 'karung', 'fishing', 'panen', 'memori', 'shop', 'bakiak', 'gasing', 'layangan', 'pinang'].includes(G.view)) || (k === 'friends' && (G.view === 'visit' || G.view === 'duel')));
</script>

<nav class="dock" aria-label="Navigasi">
  {#each tabs as t}
    <button class:on={active(t.k)} aria-pressed={active(t.k)} onclick={() => go(t.k)}>
      {@html t.icon}<span>{t.label}</span>
      {#if t.k === 'friends' && (G.me.giftsUnread ?? 0) + (G.me.duelsPending ?? 0) + (G.me.guestbookUnread ?? 0) > 0}<i class="badge">{(G.me.giftsUnread ?? 0) + (G.me.duelsPending ?? 0) + (G.me.guestbookUnread ?? 0)}</i>{/if}
      {#if t.k === 'quests' && G.me.quests?.ready > 0}<i class="badge">{G.me.quests.ready}</i>{/if}
    </button>
  {/each}
</nav>

<style>
  .dock { position: absolute; z-index: 20; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-b) + 8px); display: flex; gap: 2px; background: var(--paper); border: 2.5px solid var(--ink); border-radius: 22px; box-shadow: 0 4px 0 var(--ink); padding: 5px; max-width: calc(100vw - 16px); }
  button { position: relative; width: 64px; height: 58px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; border: 2px solid transparent; border-radius: 16px; background: transparent; font-weight: 700; font-size: 12.5px; cursor: pointer; padding: 0; }
  button :global(svg) { width: 25px; height: 25px; }
  button.on { background: var(--coin); border-color: var(--ink); }
  .badge { position: absolute; top: 2px; right: 6px; min-width: 18px; height: 18px; border-radius: 9px; background: var(--low); color: #fff; font-style: normal; font-size: 11.5px; font-weight: 800; display: grid; place-items: center; border: 2px solid var(--ink); padding: 0 3px; }
  @media (max-width: 360px) { button { width: 56px; font-size: 11.5px; } }
</style>
