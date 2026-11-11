<script lang="ts">
  // Sekali saja saat pertama masuk alun-alun: "Terima ajakan berteman" bawaannya mati, jadi pemain ditanya
  // apakah mau menyalakannya. Jawaban (Ya / Nanti) disimpan; bisa diubah kapan saja di Pengaturan › Privasi.
  import { petSVG } from '@kb/shared';
  import { G, fail, toast } from '../lib/game.svelte';
  import { api } from '../lib/api';
  import { sfx } from '../lib/sfx';
  let busy = $state(false);
  async function answer(yes: boolean) {
    busy = true;
    try {
      const r = await api.post('/api/me/privacy', yes ? { friendRequests: true } : { friendPrompt: 'later' });
      G.me.user.friend_requests = r.friendRequests;
      G.me.user.friend_prompt_at = r.friendPromptAt ?? new Date().toISOString();
      sfx.tap();
      if (yes) toast('Sip! Orang yang kamu temui sekarang bisa mengajakmu berteman.', 'good');
    } catch (e) { fail(e); } finally { busy = false; }
  }
</script>

<div class="fp" role="dialog" aria-labelledby="fp-t" aria-describedby="fp-d">
  <div class="top">
    <span class="ava">{@html petSVG({ color: G.me.pet?.color ?? '#F6B7A8', ear: G.me.pet?.ear ?? 'tunas', pattern: G.me.pet?.pattern, eyes: G.me.pet?.eyes, tail: G.me.pet?.tail })}</span>
    <div><b id="fp-t">Mau punya teman baru?</b><p id="fp-d">Orang yang kamu temui di alun-alun &amp; rumah teman bisa mengajakmu berteman. Kamu tetap pilih Terima atau Tolak.</p></div>
  </div>
  <div class="row"><button class="btn" disabled={busy} onclick={() => answer(false)}>Nanti</button><button class="btn hot" disabled={busy} onclick={() => answer(true)}>Ya, boleh</button></div>
  <small>Bisa diubah kapan saja di Pengaturan › Privasi</small>
</div>

<style>
  .fp { position: fixed; z-index: 58; left: 50%; top: calc(var(--safe-t) + 74px); transform: translateX(-50%); width: min(380px, calc(100% - 20px)); display: flex; flex-direction: column; gap: 10px; background: var(--paper); border: 3px solid var(--ink); border-radius: 20px; box-shadow: 0 5px 0 var(--ink); padding: 12px 14px 10px; animation: pop .3s ease-out; }
  .top { display: flex; gap: 12px; align-items: center; }
  .ava { flex: none; width: 64px; height: 68px; background: #FFF4D6; border: 2.5px solid var(--ink); border-radius: 16px; display: grid; place-items: center; }
  .ava :global(svg) { width: 56px; height: 60px; }
  b { font-size: 17px; font-weight: 800; }
  p { margin: 2px 0 0; font-size: 13.5px; font-weight: 600; color: var(--muted); line-height: 1.3; }
  .row { display: flex; gap: 8px; }
  .row .btn { flex: 1; min-height: 42px; }
  small { text-align: center; font-size: 12px; font-weight: 600; color: var(--muted); }
</style>
