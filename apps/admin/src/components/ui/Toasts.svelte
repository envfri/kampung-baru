<script lang="ts">
  // Notifikasi kecil bertumpuk: ikon, teks, tombol aksi, tombol tutup, garis sisa waktu.
  import { A, dismiss } from '../../lib/store.svelte';
  import Icon from './Icon.svelte';
</script>
<div class="stack" role="status" aria-live="polite">
  {#each A.toasts as t (t.id)}
    <div class="toast {t.kind}">
      <span class="ico"><Icon name={t.kind === 'err' ? 'warn' : t.kind === 'info' ? 'info' : 'check'} size={14} /></span>
      <span class="txt">{t.text}</span>
      {#if t.action}<button class="act" onclick={() => { t.action!.run(); dismiss(t.id); }}>{t.action.label}</button>{/if}
      <button class="x" aria-label="Tutup" onclick={() => dismiss(t.id)}><Icon name="x" size={14} /></button>
      <i class="line" style="animation-duration:{t.ms}ms"></i>
    </div>
  {/each}
</div>
<style>
  .stack { position: fixed; z-index: 150; right: 18px; bottom: 18px; display: flex; flex-direction: column; gap: 8px; align-items: flex-end; pointer-events: none; }
  .toast { pointer-events: auto; position: relative; overflow: hidden; display: flex; align-items: center; gap: 10px; min-width: 260px; max-width: min(440px, calc(100vw - 24px)); background: var(--ink); color: #fff; padding: 10px 10px 12px 12px; border-radius: 12px; font-weight: 600; font-size: 14px; box-shadow: 0 10px 30px rgba(0,0,0,.25); animation: slideup .22s ease-out; }
  .ico { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; background: #2FA36B; flex: none; }
  .err .ico { background: #E0583F; } .info .ico { background: #3F7FBF; }
  .txt { flex: 1; line-height: 1.35; }
  .act { background: none; border: 0; color: #F7C548; font: 700 13.5px var(--body); cursor: pointer; padding: 2px 4px; }
  .x { background: none; border: 0; color: #B9C0D6; cursor: pointer; padding: 2px; display: grid; }
  .line { position: absolute; left: 0; bottom: 0; height: 3px; width: 100%; background: var(--accent-2); transform-origin: left; animation: shrink linear forwards; }
  .err .line { background: #F08A73; } .info .line { background: #7DB2E8; }
  @keyframes shrink { to { transform: scaleX(0); } }
  @media (max-width: 760px) { .stack { left: 12px; right: 12px; bottom: auto; top: 10px; align-items: stretch; } .toast { min-width: 0; max-width: none; } }
</style>
