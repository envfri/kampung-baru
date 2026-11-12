<script lang="ts">
  // Kartu ajakan berteman yang baru datang saat bertemu di alun-alun / rumah teman.
  import { petSVG } from '@kb/shared';
  import { FR, answerAsk } from '../lib/friends.svelte';
  const a = $derived(FR.asks[0]);
  let busy = $state(false);
  async function answer(ok: boolean) { if (!a || busy) return; busy = true; await answerAsk(a.id, a.from, a.name, ok); busy = false; }
  /** Nanti: simpan di menu Teman › Ajakan berteman */
  const later = () => { if (a) FR.asks = FR.asks.filter((x) => x.id !== a.id); };
</script>

{#if a}
  <div class="ask" role="alertdialog" aria-labelledby="ask-t">
    {#if a.pet}<span class="ava">{@html petSVG({ color: a.pet.color ?? '#F2EEE3', ear: a.pet.ear ?? 'tunas', pattern: a.pet.pattern, eyes: a.pet.eyes, tail: a.pet.tail })}</span>{/if}
    <div class="txt">
      <b id="ask-t">{a.name} ngajak kamu berteman</b>
      <span>Kalau berteman, kalian bisa saling berkunjung dan main bareng.</span>
      <div class="row">
        <button class="btn sm" disabled={busy} onclick={() => answer(false)}>Tolak</button>
        <button class="btn sm hot" disabled={busy} onclick={() => answer(true)}>Terima</button>
      </div>
    </div>
    <button class="x" aria-label="Nanti saja (ajakan tetap ada di menu Teman)" onclick={later}>×</button>
  </div>
{/if}

<style>
  .ask { position: fixed; z-index: 60; left: 50%; top: min(calc(var(--safe-t) + var(--prompt-top, 226px)), calc(100dvh - 330px)); transform: translateX(-50%); width: min(380px, calc(100% - 20px)); display: flex; gap: 10px; align-items: flex-start; background: var(--paper); border: 3px solid var(--ink); border-radius: 18px; box-shadow: 0 5px 0 var(--ink); padding: 10px 12px; animation: pop .3s ease-out; }
  .ava { flex: none; width: 54px; height: 58px; }
  .ava :global(svg) { width: 100%; height: 100%; }
  .txt { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .txt b { font-size: 15.5px; line-height: 1.2; }
  .txt span { font-size: 13px; color: var(--muted); font-weight: 600; line-height: 1.3; }
  .row { display: flex; gap: 8px; justify-content: flex-end; margin-top: 2px; }
  .x { flex: none; border: 0; background: none; font-size: 24px; line-height: 1; padding: 0 2px; cursor: pointer; color: var(--muted); min-width: 32px; min-height: 32px; }
</style>
