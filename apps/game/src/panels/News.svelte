<script lang="ts">
  import Sheet from '../components/Sheet.svelte';
  import { G } from '../lib/game.svelte';
  const list = $derived(G.me.announcements ?? []);
  const events = $derived(G.me.events ?? []);
  $effect(() => { try { localStorage.setItem('kb-news-seen', JSON.stringify(list.map((a: any) => a.id))); } catch { /* abaikan */ } });
  const date = (t: string) => new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' });
</script>

<Sheet title="Kabar kampung">
  {#each events as e}
    <article class="ev" style="--ev:{e.theme?.color ?? '#E0583F'}">
      <b>{e.name}</b>
      <p>{e.description}</p>
      <span>Sampai {date(e.ends_at)}{#if e.bonus?.coinMultiplier > 1}{' · '}hadiah koin ×{e.bonus.coinMultiplier}{/if}</span>
    </article>
  {/each}
  {#each list as a (a.id)}
    <article><b>{a.title}</b><p>{a.body}</p><span>{date(a.starts_at)}</span></article>
  {/each}
  {#if !list.length && !events.length}<p>Belum ada kabar baru.</p>{/if}
</Sheet>

<style>
  article { border: 2px solid var(--ink); border-radius: 14px; padding: 10px 12px; background: var(--card); display: flex; flex-direction: column; gap: 4px; }
  article.ev { border-left: 8px solid var(--ev); }
  b { font-size: 17px; } p { margin: 0; font-weight: 600; white-space: pre-line; } span { font-size: 13px; color: var(--muted); font-weight: 700; }
</style>
