<script lang="ts">
  // Masukkan kode pindah perangkat dari HP/browser lama.
  import { fail } from '../lib/game.svelte';
  import { api } from '../lib/api';
  import { withSwitch, afterAuth } from '../lib/account.svelte';
  let { ondone }: { ondone?: () => void } = $props();
  let code = $state(''), busy = $state(false);
  const clean = $derived(code.toUpperCase().replace(/[^A-Z0-9]/g, ''));
  async function go(e: Event) {
    e.preventDefault();
    busy = true;
    try {
      const r = await withSwitch((x) => api.post('/api/auth/transfer/redeem', { code, ...x }));
      if (r) { afterAuth(r); ondone?.(); }
    } catch (x) { fail(x); } finally { busy = false; }
  }
</script>

<form onsubmit={go}>
  <label for="kb-transfer">Kode pindah perangkat</label>
  <input id="kb-transfer" class="input code" maxlength="9" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="XXXX-XXXX" bind:value={code} />
  <button class="btn hot block" disabled={busy || clean.length !== 8}>Buka akunku</button>
  <p class="hint">Buat kodenya di perangkat lama: Pengaturan › Akun › Buat kode pindah perangkat.</p>
</form>

<style>
  form { display: flex; flex-direction: column; gap: 8px; }
  label { font-weight: 700; font-size: 15px; }
  .code { text-align: center; letter-spacing: 4px; font-size: 22px; text-transform: uppercase; }
  .code::placeholder { letter-spacing: 4px; }
  .hint { margin: 0; font-size: 13px; color: var(--muted); font-weight: 600; text-align: center; }
</style>
