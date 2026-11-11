<script lang="ts">
  // Dialog ya/tidak (lihat ask() di lib/account.svelte.ts).
  import { G } from '../lib/game.svelte';
  const c = $derived(G.confirm);
  function key(e: KeyboardEvent) { if (c && e.key === 'Escape') c.resolve(false); }
</script>

<svelte:window onkeydown={key} />
{#if c}
  <div class="back" role="presentation" onclick={() => c.resolve(false)}></div>
  <div class="box" role="alertdialog" aria-modal="true" aria-labelledby="cf-t" aria-describedby="cf-d">
    <h2 id="cf-t">{c.title}</h2>
    <p id="cf-d">{c.text}</p>
    <div class="row">
      <button class="btn" onclick={() => c.resolve(false)}>{c.no}</button>
      <button class="btn" class:hot={!c.danger} class:danger={c.danger} onclick={() => c.resolve(true)}>{c.yes}</button>
    </div>
  </div>
{/if}

<style>
  .back { position: fixed; inset: 0; z-index: 90; background: rgba(43, 47, 74, .4); animation: fade .15s; }
  .box { position: fixed; z-index: 91; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(400px, calc(100vw - 32px)); background: var(--paper); border: 3px solid var(--ink); border-radius: 20px; box-shadow: 0 5px 0 var(--ink); padding: 16px; display: flex; flex-direction: column; gap: 10px; animation: pop .18s ease-out; }
  h2 { margin: 0; font-size: 20px; font-weight: 800; }
  p { margin: 0; font-weight: 600; font-size: 15px; line-height: 1.4; }
  .row { display: flex; gap: 8px; } .row .btn { flex: 1; }
</style>
