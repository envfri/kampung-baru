<script lang="ts">
  // Buat kode pindah perangkat (sekali pakai, berlaku beberapa menit) untuk membuka akun ini di HP/browser lain.
  import { onDestroy } from 'svelte';
  import { toast, fail } from '../lib/game.svelte';
  import { api } from '../lib/api';
  import { sfx } from '../lib/sfx';
  let code = $state<string | null>(null), expiresAt = 0, left = $state(0), busy = $state(false);
  let tick: any;
  async function make() {
    busy = true;
    try {
      const r = await api.post('/api/auth/transfer');
      code = r.code; expiresAt = r.expiresAt; sfx.pop();
      clearInterval(tick);
      const upd = () => { left = Math.max(0, Math.round((expiresAt - Date.now()) / 1000)); if (!left) { clearInterval(tick); code = null; } };
      upd(); tick = setInterval(upd, 1000);
    } catch (e) { fail(e); } finally { busy = false; }
  }
  async function copy() { try { await navigator.clipboard.writeText(code!); toast('Kode disalin', 'good'); } catch { toast('Salin manual: ' + code); } }
  onDestroy(() => clearInterval(tick));
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
</script>

{#if code}
  <div class="code">
    <span class="lbl">Kode pindah perangkat</span>
    <b aria-live="polite">{code}</b>
    <span class="exp">Berlaku {mmss(left)} lagi · sekali pakai</span>
    <div class="row"><button class="btn sm" onclick={copy}>Salin</button><button class="btn sm" disabled={busy} onclick={make}>Kode baru</button></div>
  </div>
  <ol class="how">
    <li>Di HP/browser baru, buka BUPI.</li>
    <li>Ketuk <b>Punya kode pindah perangkat?</b> (atau Pengaturan › Akun bila sudah masuk).</li>
    <li>Ketik kode di atas. Pet, rumah, dan temanmu langsung muncul.</li>
  </ol>
  <p class="warn">Jangan berikan kode ini ke siapa pun: siapa saja yang memegangnya bisa membuka akunmu.</p>
{:else}
  <button class="btn block" disabled={busy} onclick={make}>Buat kode pindah perangkat</button>
{/if}

<style>
  .code { display: flex; flex-direction: column; align-items: center; gap: 2px; border: 2.5px dashed var(--ink); border-radius: 16px; background: #FFF8E2; padding: 10px; }
  .lbl { font-size: 13px; font-weight: 700; color: var(--muted); }
  .code b { font-size: 32px; letter-spacing: 3px; font-variant-numeric: tabular-nums; -webkit-user-select: all; user-select: all; }
  .exp { font-size: 13px; font-weight: 700; color: #1E7A4C; }
  .row { display: flex; gap: 6px; margin-top: 6px; }
  .how { margin: 0; padding-left: 20px; font-size: 14px; font-weight: 600; display: flex; flex-direction: column; gap: 2px; }
  .warn { margin: 0; font-size: 13px; font-weight: 700; color: #A93A27; }
</style>
