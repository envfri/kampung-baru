<script lang="ts">
  // Tombol ajak berteman untuk pemain yang sedang ditemui (alun-alun / rumah teman).
  import { FR, askFriend, answerAsk } from '../lib/friends.svelte';
  let { id, name }: { id: string; name: string } = $props();
  const rel = $derived(FR.rel[id]);
</script>

{#if rel === 'friend'}<span class="tag ok">Teman</span>
{:else if rel === 'sent'}<span class="tag">Menunggu</span>
{:else if rel === 'incoming'}<button class="btn sm hot" onclick={() => answerAsk(FR.incoming[id], id, name, true)}>Terima ajakan</button>
{:else}<button class="btn sm hot" disabled={FR.busy === id} onclick={() => askFriend(id, name)} aria-label="Ajak {name} berteman">Ajak berteman</button>{/if}

<style>
  .tag { display: inline-flex; align-items: center; min-height: 30px; padding: 0 10px; border-radius: 999px; font-size: 12.5px; font-weight: 800; background: rgba(43, 47, 74, .08); color: var(--muted); white-space: nowrap; }
  .tag.ok { background: #DCEFE8; color: #1E7A63; }
</style>
