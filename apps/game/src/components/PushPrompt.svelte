<script lang="ts">
  // Ajakan lembut untuk mengaktifkan notifikasi, muncul setelah pemain mulai bermain (bukan saat pertama buka).
  import { onMount } from 'svelte';
  import { G, toast, fail } from '../lib/game.svelte';
  import { pushStatus, enablePush } from '../lib/push';
  import { sfx } from '../lib/sfx';
  let show = $state(false);
  let ios = $state(false);
  onMount(async () => {
    let seen = 0;
    try { seen = Number(localStorage.getItem('kb-push-asked') ?? 0); } catch { /* abaikan */ }
    if (Date.now() - seen < 3 * 86_400_000) return;
    const st = await pushStatus();
    const played = (G.me.garden?.length ?? 0) > 0 || G.me.pet.level >= 2 || G.me.friendsCount > 0;
    if (!played) return;
    if (st === 'off') show = true;
    if (st === 'ios-install') { ios = true; show = true; }
  });
  function later() { show = false; try { localStorage.setItem('kb-push-asked', String(Date.now())); } catch { /* abaikan */ } }
  async function yes() {
    try {
      const st = await enablePush();
      if (st === 'on') { sfx.level(); toast('Notifikasi aktif', 'good'); }
      else if (st === 'denied') toast('Notifikasi diblokir di browser. Bisa diaktifkan lewat pengaturan situs.', 'error');
    } catch (e) { fail(e); }
    later();
  }
</script>

{#if show && !G.sheet && G.view === 'home' && !G.edit}
  <div class="pp" role="dialog" aria-label="Aktifkan notifikasi">
    {#if ios}
      <p><b>Mau dikabari saat kebun siap panen?</b> Pasang game ke Layar Utama dulu: ketuk Bagikan di Safari, lalu Tambah ke Layar Utama.</p>
      <div class="row"><button class="btn sm" onclick={later}>Oke</button></div>
    {:else}
      <p><b>Mau dikabari saat kebun siap panen?</b> Kami juga mengabari kalau {G.me.pet.name} lapar atau ada hadiah dari teman.</p>
      <div class="row"><button class="btn sm" onclick={later}>Nanti</button><button class="btn sm hot" onclick={yes}>Aktifkan</button></div>
    {/if}
  </div>
{/if}

<style>
  .pp { position: absolute; z-index: 25; left: 50%; transform: translateX(-50%); top: calc(var(--safe-t) + 176px); width: min(420px, calc(100vw - 20px)); background: var(--paper); border: 2.5px solid var(--ink); border-radius: 16px; box-shadow: 0 4px 0 var(--ink); padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; animation: pop .3s; }
  p { margin: 0; font-weight: 600; font-size: 14.5px; }
  .row { display: flex; gap: 6px; justify-content: flex-end; }
</style>
