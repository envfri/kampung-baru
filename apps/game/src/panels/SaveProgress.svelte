<script lang="ts">
  // Ajakan untuk pemain tamu: simpan progres ke Google/email supaya bisa dibuka di HP atau browser lain.
  import Sheet from '../components/Sheet.svelte';
  import AuthOptions from '../components/AuthOptions.svelte';
  import TransferCode from '../components/TransferCode.svelte';
  import { petSVG } from '@kb/shared';
  import { G, wearItems, settings } from '../lib/game.svelte';
  import { snoozeNudge, accountAgeDays } from '../lib/account.svelte';

  const reason = G.sheetArg?.reason ?? 'open';
  const pet = $derived(G.me.pet);
  const days = Math.max(1, Math.floor(accountAgeDays()) + 1);
  const a = $derived(settings().account ?? {});
  const lead = $derived(
    reason === 'duel' ? `Selamat menang duel! ${pet.name} makin jago.`
    : reason === 'friend' ? `Asyik, ${pet.name} sudah punya teman!`
    : reason === 'level' || (accountAgeDays() < (a.nudgeDays ?? 2) && pet.level >= (a.nudgeLevel ?? 3)) ? `${pet.name} sudah Lv ${pet.level}!`
    : accountAgeDays() < (a.nudgeDays ?? 2) ? `${pet.name} sudah punya ${G.me.friendsCount} teman di kampung!`
    : `Sudah ${days} hari kamu merawat ${pet.name}.`,
  );
  const google = $derived(!!G.config?.login?.google);
  let showCode = $state(false);
  // kembali ke lembar sebelumnya (mis. daftar duel setelah menang)
  function later() { snoozeNudge(); const back = G.sheetArg?.back ?? null; G.sheet = back as any; G.sheetArg = null; }
</script>

<Sheet title="Simpan progres" onclose={later}>
  <div class="hero">
    <span class="pet">{@html petSVG(pet, wearItems(pet.wear))}</span>
    <div>
      <b>{lead}</b>
      <p>Saat ini akunmu akun <b>tamu</b>: hanya bisa dibuka dari browser ini. Kalau ganti HP, pakai browser lain, atau data browser terhapus, {pet.name} tidak bisa dibuka lagi.</p>
    </div>
  </div>
  <p class="step">{google ? 'Simpan dengan Google (paling mudah). Nanti di HP lain cukup masuk dengan Google yang sama:' : 'Simpan dengan email. Nanti di HP lain cukup masuk dengan email yang sama:'}</p>
  <AuthOptions guest={false} />
  <div class="or"><span>atau</span></div>
  {#if showCode}
    <TransferCode />
  {:else}
    <button class="btn block" onclick={() => (showCode = true)}>Pindah sekarang pakai kode</button>
    <p class="small">Untuk membuka akun ini di HP/browser lain sekarang juga, tanpa Google atau email.</p>
  {/if}
  <button class="link" onclick={later}>Nanti saja</button>
</Sheet>

<style>
  .hero { display: flex; gap: 12px; align-items: center; background: #FFF4D6; border: 2px solid var(--ink); border-radius: 16px; padding: 10px; }
  .pet { width: 76px; height: 76px; flex: none; }
  .pet :global(svg) { width: 100%; height: 100%; }
  .hero b { font-size: 16.5px; }
  .hero p { margin: 4px 0 0; font-size: 14px; font-weight: 600; line-height: 1.4; }
  .step { margin: 0; font-weight: 700; font-size: 14.5px; }
  .or { display: flex; align-items: center; gap: 8px; color: var(--muted); font-weight: 700; font-size: 13px; }
  .or::before, .or::after { content: ''; flex: 1; height: 2px; background: #D9D2BF; }
  .small { margin: -2px 0 0; font-size: 13px; color: var(--muted); font-weight: 600; text-align: center; }
  .link { background: none; border: 0; font-weight: 700; color: var(--muted); text-decoration: underline; cursor: pointer; padding: 8px; font-size: 15px; }
</style>
