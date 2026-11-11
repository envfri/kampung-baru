<script lang="ts">
  // Foto bareng yang baru diambil: tampilkan, lalu pajang di lukisan rumah atau simpan di album saja.
  import { renderPhoto } from '@kb/shared';
  import { G, item, wearItems, toast, fail, refreshMe } from '../lib/game.svelte';
  import { H } from '../lib/house.svelte';
  import { api } from '../lib/api';
  import { sfx } from '../lib/sfx';
  let { photo = null, onclose }: { photo?: any; onclose?: () => void } = $props();
  const p = $derived(photo ?? H.photo);
  const svg = $derived(p ? renderPhoto(p.members.filter((m: any) => m.pet).map((m: any) => ({ look: m.pet, wear: wearItems(m.pet.wear), state: m.pet.state })), p.pose, item(p.scene?.wall), item(p.scene?.floor), p.scene?.theme) : '');
  const isMine = $derived(!!p && p.members.some((m: any) => m.id === G.me.user.id));
  function close() { H.photo = null; onclose?.(); }
  async function remove() {
    try { await api.del(`/api/photos/${p.id}`); toast('Foto dihapus dari albummu.'); await refreshMe(); close(); } catch (e) { fail(e); }
  }
  async function feature() {
    try {
      await api.post(`/api/photos/${p.id}/feature`);
      sfx.pop();
      toast('Foto dipajang di lukisan rumahmu!', 'good');
      await refreshMe();
      close();
    } catch (e) { fail(e); }
  }
</script>

{#if p}
  <div class="back" role="presentation" onclick={close}></div>
  <div class="ph" role="dialog" aria-label="Foto bareng">
    <div class="pic">{@html svg}</div>
    <p>{p.members.map((m: any) => m.pet?.name).filter(Boolean).join(', ')}</p>
    <small>Tersimpan di album semua yang ada di foto (Teman › Album).</small>
    <div class="row">
      {#if isMine && G.me.photo?.id !== p.id}<button class="btn hot" onclick={feature}>Pajang di rumahku</button>{/if}
      <button class="btn" onclick={close}>Tutup</button>
    </div>
    {#if isMine}<button class="link" onclick={remove}>Hapus dari albumku</button>{/if}
  </div>
{/if}

<style>
  .back { position: fixed; inset: 0; z-index: 44; background: rgba(43, 47, 74, .35); }
  .ph { position: fixed; z-index: 45; left: 50%; top: 50%; transform: translate(-50%, -50%) rotate(-2deg); width: min(340px, calc(100vw - 32px)); background: var(--paper); border: 3px solid var(--ink); border-radius: 20px; box-shadow: 0 5px 0 var(--ink); padding: 12px; display: flex; flex-direction: column; gap: 6px; animation: pop .25s ease-out; }
  .pic :global(svg) { width: 100%; height: auto; display: block; }
  p { margin: 0; font-weight: 800; text-align: center; }
  small { text-align: center; font-weight: 600; color: var(--muted); font-size: 12.5px; }
  .row { display: flex; gap: 8px; } .row .btn { flex: 1; }
  .link { background: none; border: 0; color: var(--muted); font-weight: 700; text-decoration: underline; cursor: pointer; align-self: center; font-size: 13.5px; }
</style>
