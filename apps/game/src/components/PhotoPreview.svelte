<script lang="ts">
  // Foto bareng yang baru diambil: tampilkan, lalu pajang di lukisan rumah atau simpan di album saja.
  // Baris berbagi (Jepret & Bagikan): Bagikan → lembar "Fotomu siap!" dengan kartu Foto bareng, Simpan ke galeri → kartu Story.
  import { onDestroy } from 'svelte';
  import { renderPhoto } from '@kb/shared';
  import { G, item, wearItems, toast, fail, refreshMe } from '../lib/game.svelte';
  import { H } from '../lib/house.svelte';
  import { api } from '../lib/api';
  import { sfx } from '../lib/sfx';
  import { I } from '../lib/icons';
  import { JP, buildFile, jepretOn, report, saveFile, shareCaps, shareFoto } from '../lib/jepret.svelte';
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
  // gambar Story untuk "Simpan ke galeri" dibuat lebih dulu (di iPhone menyimpan lewat lembar bagikan, perlu File yang siap)
  const shareOn = $derived(jepretOn());
  let file = $state<File | null>(null);
  let gen = 0;
  $effect(() => {
    const ph = p, on = shareOn, n = JP.names, c = JP.code;
    file = null;
    if (!ph || !on) return;
    const my = ++gen;
    const t = setTimeout(() => { buildFile({ kind: 'foto', photo: ph }, 'story', n, c).then((f) => { if (my === gen) file = f; }).catch(() => {}); }, 250);
    return () => clearTimeout(t);
  });
  onDestroy(() => { gen++; file = null; });
  function save() {
    if (!file) { toast('Gambarnya belum siap, coba lagi.', 'error'); return; }
    sfx.tap();
    const caps = shareCaps(file);
    saveFile(file, caps).then((ok) => { if (ok) report('foto', caps.desktop ? 'download' : 'save', 'story'); });
  }
  function share() { shareFoto(p); }
</script>

{#if p}
  <div class="back" role="presentation" onclick={close}></div>
  <div class="ph" role="dialog" aria-label="Foto bareng">
    <div class="pic">{@html svg}</div>
    <p>{p.members.map((m: any) => m.pet?.name).filter(Boolean).join(', ')}</p>
    <small>Tersimpan di album semua yang ada di foto (Teman › Album).</small>
    {#if shareOn}
      <div class="share">
        <button class="btn" onclick={share}>{@html I.share}Bagikan{#if !JP.seen}<em>BARU</em>{/if}</button>
        <button class="btn" disabled={!file} onclick={save}>{@html I.down}{file ? 'Simpan ke galeri' : 'Menyiapkan…'}</button>
      </div>
    {/if}
    <div class="row">
      {#if isMine && G.me.photo?.id !== p.id}<button class="btn hot" onclick={feature}>Pajang di rumahku</button>{/if}
      <button class="btn" onclick={close}>Tutup</button>
    </div>
    {#if isMine}<button class="link" onclick={remove}>Hapus dari albumku</button>{/if}
  </div>
{/if}

<style>
  .back { position: fixed; inset: 0; z-index: 44; background: rgba(43, 47, 74, .35); }
  .ph { position: fixed; z-index: 45; left: 50%; top: 50%; transform: translate(-50%, -50%) rotate(-2deg); width: min(340px, calc(100vw - 32px)); max-height: calc(100dvh - 24px); overflow-y: auto; background: var(--paper); border: 3px solid var(--ink); border-radius: 20px; box-shadow: 0 5px 0 var(--ink); padding: 12px; display: flex; flex-direction: column; gap: 6px; animation: pop .25s ease-out; }
  .pic :global(svg) { width: 100%; height: auto; display: block; }
  p { margin: 0; font-weight: 800; text-align: center; }
  small { text-align: center; font-weight: 600; color: var(--muted); font-size: 12.5px; }
  .row { display: flex; gap: 8px; } .row .btn { flex: 1; }
  /* baris berbagi: sedikit terpisah dari baris lama */
  .share { display: flex; gap: 8px; padding-top: 6px; }
  .share .btn { flex: 1; font-size: 14px; padding: 6px 6px; gap: 5px; position: relative; }
  .share .btn :global(svg) { width: 18px; height: 18px; }
  .share em { position: absolute; top: -10px; right: 6px; font-style: normal; background: #E0583F; color: #FFFDF7; font-size: 10.5px; font-weight: 800; border: 2px solid var(--ink); border-radius: 999px; padding: 0 6px; line-height: 1.35; }
  @media (max-width: 359px) { .share .btn :global(svg) { display: none; } }
  .link { background: none; border: 0; color: var(--muted); font-weight: 700; text-decoration: underline; cursor: pointer; align-self: center; font-size: 13.5px; }
</style>
