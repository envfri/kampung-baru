<script lang="ts">
  import { onMount } from 'svelte';
  import Sheet from '../components/Sheet.svelte';
  import { G, fail } from '../lib/game.svelte';
  import { api } from '../lib/api';
  import { pushStatus, enablePush, type PushStatus } from '../lib/push';
  import { openLink } from '../lib/links';
  let items = $state<any[] | null>(null);
  let st = $state<PushStatus>('off');
  import { I } from '../lib/icons';
  const ICON: Record<string, string> = { garden: I.bag, needs: I.smile, daily: I.calendar, social: I.friends, events: I.news, system: I.gift };
  onMount(async () => {
    st = await pushStatus();
    try {
      items = (await api.get('/api/notifications')).items;
      if (G.me.notificationsUnread) { await api.post('/api/notifications/read'); G.me.notificationsUnread = 0; }
    } catch (e) { fail(e); items = []; }
  });
  const ago = (t: string) => { const m = Math.round((Date.now() - new Date(t).getTime()) / 60000); return m < 1 ? 'baru saja' : m < 60 ? `${m} mnt lalu` : m < 1440 ? `${Math.round(m / 60)} jam lalu` : `${Math.round(m / 1440)} hari lalu`; };
  async function turnOn() { try { st = await enablePush(); } catch (e) { fail(e); } }
</script>

<Sheet title="Notifikasi">
  {#if st === 'off'}
    <div class="cta"><p>Aktifkan notifikasi supaya kamu tahu saat kebun siap panen, pet butuh perhatian, atau teman mengirim hadiah, walau game sedang ditutup.</p><button class="btn hot" onclick={turnOn}>Aktifkan notifikasi</button></div>
  {:else if st === 'ios-install'}
    <div class="cta"><p>Di iPhone/iPad, notifikasi bisa diterima setelah game dipasang: ketuk <b>Bagikan</b> di Safari, pilih <b>Tambah ke Layar Utama</b>, lalu buka BUPI dari ikon di layar utama.</p></div>
  {:else if st === 'denied'}
    <div class="cta"><p>Notifikasi diblokir di browser. Buka pengaturan situs di browser, izinkan Notifikasi, lalu muat ulang game.</p></div>
  {/if}
  {#if items === null}<p class="muted">Memuat…</p>
  {:else if items.length === 0}<p class="muted">Belum ada notifikasi.</p>{/if}
  <ul>
    {#each items ?? [] as n (n.id)}
      <li class:unread={!n.read_at}>
        <button onclick={() => openLink(n.url)}>
          <span class="ic" aria-hidden="true">{@html ICON[n.kind] ?? I.gift}</span>
          <span class="txt"><b>{n.title}</b><span>{n.body}</span><em>{ago(n.created_at)}</em></span>
        </button>
      </li>
    {/each}
  </ul>
</Sheet>

<style>
  .cta { display: flex; flex-direction: column; gap: 8px; background: var(--soft); border: 2px solid var(--ink); border-radius: 14px; padding: 12px; }
  .cta p { margin: 0; font-weight: 600; }
  .cta .btn { align-self: flex-start; }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  li button { width: 100%; display: flex; gap: 10px; align-items: flex-start; text-align: left; border: 2px solid var(--ink); border-radius: 14px; background: var(--card); padding: 10px; cursor: pointer; }
  li.unread button { background: #FFF8E2; }
  .ic { width: 34px; height: 34px; flex: none; border-radius: 10px; background: var(--tint); display: grid; place-items: center; }
  .ic :global(svg) { width: 20px; height: 20px; }
  .txt { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .txt b { font-size: 15.5px; } .txt span { font-weight: 600; font-size: 14px; } .txt em { font-style: normal; font-size: 12px; color: var(--muted); font-weight: 700; }
  .muted { margin: 0; font-weight: 600; }
</style>
