<script lang="ts">
  import { onMount } from 'svelte';
  import Sheet from '../components/Sheet.svelte';
  import { petSVG } from '@kb/shared';
  import { G, item, wearItems, run, toast, fail, track } from '../lib/game.svelte';
  import { api } from '../lib/api';
  import { I } from '../lib/icons';
  import { sfx } from '../lib/sfx';

  let friends = $state<any[] | null>(null);
  let gifts = $state<any[]>([]);
  let code = $state('');
  let tab = $state<'list' | 'gifts'>(G.me.giftsUnread > 0 ? 'gifts' : 'list');
  const myCode = $derived(G.me.user.friend_code);
  const link = $derived(`${location.origin}/?undang=${myCode}`);

  async function load() {
    try {
      const [f, g] = await Promise.all([api.get('/api/friends'), api.get('/api/gifts')]);
      friends = f.friends;
      gifts = g.gifts;
    } catch (e) { fail(e); friends = []; }
  }
  onMount(load);

  async function add(e: Event) {
    e.preventDefault();
    const r: any = await run(() => api.post('/api/friends', { code }));
    if (r) { code = ''; sfx.pop(); toast(`Sekarang berteman dengan ${r.friend.display_name}`, 'good'); G.me.friendsCount++; load(); }
  }
  async function visit(f: any) {
    try {
      const v = await api.get(`/api/visit/${f.id}`);
      G.visit = v;
      G.view = 'visit';
      G.sheet = null;
      sfx.tap();
    } catch (e) { fail(e); }
  }
  async function share() {
    const text = `Main BUPI bareng aku! Kode temanku ${myCode}. ${link}`;
    track('share_invite');
    if (navigator.share) { try { await navigator.share({ title: 'BUPI', text, url: link }); return; } catch { /* batal */ } }
    try { await navigator.clipboard.writeText(text); toast('Link undangan disalin', 'good'); } catch { toast(link); }
  }
  const wa = $derived(`https://wa.me/?text=${encodeURIComponent(`Main BUPI bareng aku! Kode temanku ${myCode}. ${link}`)}`);
  async function open(g: any) {
    const r: any = await run(() => api.post(`/api/gifts/${g.id}/open`));
    if (r) { sfx.level(); toast(`Dapat ${item(r.itemId)?.name ?? 'hadiah'}!`, 'good'); g.opened_at = new Date().toISOString(); G.me.giftsUnread = Math.max(0, G.me.giftsUnread - 1); }
  }
  const ago = (t: string) => { const m = Math.round((Date.now() - new Date(t).getTime()) / 60000); return m < 1 ? 'baru saja' : m < 60 ? `${m} mnt lalu` : m < 1440 ? `${Math.round(m / 60)} jam lalu` : `${Math.round(m / 1440)} hari lalu`; };
</script>

<Sheet title="Teman">
  <div class="mycode">
    <div><span class="lbl">Kode temanmu</span><b>{myCode}</b></div>
    <div class="row">
      <a class="btn sm wa" href={wa} target="_blank" rel="noopener" onclick={() => track('share_invite', { via: 'wa' })}>WhatsApp</a>
      <button class="btn sm" onclick={share}>{@html I.share} Bagikan</button>
    </div>
  </div>
  <form class="add" onsubmit={add}>
    <input class="input" placeholder="Kode teman, mis. KB-7Q4M2X" bind:value={code} maxlength="12" autocapitalize="characters" aria-label="Kode teman" />
    <button class="btn hot" disabled={G.busy || code.trim().length < 6}>Tambah</button>
  </form>

  <div class="seg">
    <button class:on={tab === 'list'} onclick={() => (tab = 'list')}>Daftar teman</button>
    <button class:on={tab === 'gifts'} onclick={() => (tab = 'gifts')}>Kotak hadiah {#if G.me.giftsUnread}<i>{G.me.giftsUnread}</i>{/if}</button>
  </div>

  {#if tab === 'list'}
    {#if G.me.visitors?.length}
      <p class="visitors">Baru mampir: {G.me.visitors.map((v: any) => v.name).slice(0, 5).join(', ')}</p>
    {/if}
    {#if friends === null}<p class="muted">Memuat…</p>
    {:else if friends.length === 0}<p class="muted">Belum ada teman. Bagikan kode temanmu lewat WhatsApp, atau masukkan kode teman di atas.</p>{/if}
    <div class="list">
      {#each friends ?? [] as f (f.id)}
        <div class="friend">
          <span class="ava">{@html petSVG({ color: f.color ?? '#F2EEE3', ear: f.ear ?? 'tunas', pattern: f.pattern, eyes: f.eyes, tail: f.tail }, wearItems(f.wear))}</span>
          <div class="info">
            <b>{f.display_name}</b>
            <span>{f.pet_name ?? 'Belum punya pet'}{f.level ? ` · Lv ${f.level}` : ''}</span>
            <em class:hot={!f.visited_today}>{f.visited_today ? 'Sudah dikunjungi hari ini' : 'Hadiah kunjungan tersedia'}</em>
          </div>
          <div class="btns">
            <button class="btn sm" onclick={() => visit(f)}>Kunjungi</button>
            <button class="btn sm" aria-label="Kirim hadiah ke {f.display_name}" onclick={() => { G.sheet = 'gift'; G.sheetArg = { to: f.id, name: f.display_name }; }}>{@html I.gift}</button>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    {#if gifts.length === 0}<p class="muted">Belum ada hadiah. Teman bisa mengirimimu barang dari tas mereka.</p>{/if}
    <div class="list">
      {#each gifts as g (g.id)}
        {@const it = item(g.item_id)}
        <div class="friend">
          <span class="ava gift">{@html I.gift}</span>
          <div class="info">
            <b>{g.opened_at ? it?.name ?? 'Hadiah' : 'Hadiah misteri'}</b>
            <span>dari {g.from_name ?? 'seseorang'} · {ago(g.created_at)}</span>
            {#if g.message}<em>“{g.message}”</em>{/if}
          </div>
          <button class="btn sm" class:hot={!g.opened_at} disabled={!!g.opened_at || G.busy} onclick={() => open(g)}>{g.opened_at ? 'Dibuka' : 'Buka'}</button>
        </div>
      {/each}
    </div>
  {/if}
</Sheet>

<style>
  .mycode { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; background: var(--soft); border: 2px solid var(--ink); border-radius: 14px; padding: 10px 12px; }
  .mycode div:first-child { display: flex; flex-direction: column; }
  .lbl { font-size: 13px; font-weight: 700; color: var(--muted); }
  .mycode b { font-size: 22px; letter-spacing: 1px; -webkit-user-select: text; user-select: text; }
  .row { display: flex; gap: 6px; }
  .wa { background: #BFEBCB; text-decoration: none; color: var(--ink); }
  .add { display: flex; gap: 8px; }
  .add .input { flex: 1; min-width: 0; text-transform: uppercase; }
  .add .input::placeholder { text-transform: none; }
  .seg { display: flex; border: 2.5px solid var(--ink); border-radius: 12px; overflow: hidden; }
  .seg button { flex: 1; border: 0; background: var(--paper); font-weight: 800; font-size: 14.5px; min-height: 40px; cursor: pointer; }
  .seg button.on { background: var(--coin); }
  .seg i { font-style: normal; background: var(--low); color: #fff; border-radius: 9px; padding: 0 6px; font-size: 12px; }
  .list { display: flex; flex-direction: column; gap: 8px; }
  .friend { display: flex; align-items: center; gap: 10px; border: 2px solid var(--ink); border-radius: 14px; padding: 8px; background: var(--card); }
  .ava { width: 54px; height: 54px; flex: none; background: var(--tint); border-radius: 12px; display: grid; place-items: center; overflow: hidden; }
  .ava :global(svg) { width: 100%; height: 100%; }
  .ava.gift :global(svg) { width: 30px; height: 30px; }
  .info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
  .info b { font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .info span { font-size: 13px; color: var(--muted); font-weight: 600; }
  .info em { font-style: normal; font-size: 12.5px; font-weight: 700; color: var(--muted); }
  .info em.hot { color: #1E7A4C; }
  .btns { display: flex; gap: 4px; }
  @media (max-width: 359px) {
    .friend { flex-wrap: wrap; }
    .btns { flex: 1 1 100%; justify-content: flex-end; }
  }
  .visitors { margin: 0; font-size: 14px; font-weight: 600; background: #E6F3EC; border-radius: 10px; padding: 6px 10px; }
  .muted { margin: 0; font-weight: 600; }
</style>
