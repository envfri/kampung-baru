<script lang="ts">
  import { onMount } from 'svelte';
  import Sheet from '../components/Sheet.svelte';
  import { APP_VERSION, compareVersion, playerReleases } from '@kb/shared';
  import { G } from '../lib/game.svelte';
  import { markWhatsNewSeen } from '../lib/whatsnew';

  const since = G.whatsNew;
  const releases = playerReleases();
  const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  onMount(markWhatsNewSeen);
</script>

<Sheet title="Apa yang baru">
  <p class="intro">Kampung Bulu versi <b>{APP_VERSION}</b></p>
  <ol class="rels">
    {#each releases as r (r.version)}
      {@const fresh = since && compareVersion(r.version, since) > 0}
      <li class="rel" class:fresh>
        <div class="head">
          <span class="v">v{r.version}</span>
          <div><b>{r.title}</b><span class="date">{fmt(r.date)}</span></div>
          {#if fresh}<span class="new">Baru</span>{/if}
        </div>
        {#if r.summary}<p class="sum">{r.summary}</p>{/if}
        <ul>{#each r.items as i}<li>{i.text}</li>{/each}</ul>
      </li>
    {/each}
  </ol>
</Sheet>

<style>
  .intro { margin: 0; font-weight: 600; }
  .rels { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
  .rel { border: 2.5px solid var(--ink); border-radius: 16px; padding: 12px; background: var(--paper); box-shadow: 0 3px 0 var(--ink); }
  .rel.fresh { background: #FFF6DC; }
  .head { display: flex; align-items: center; gap: 10px; }
  .head > div { display: flex; flex-direction: column; flex: 1; min-width: 0; }
  .head b { font-size: 16.5px; }
  .date { font-size: 13px; font-weight: 600; color: var(--muted); }
  .v { background: var(--ink); color: var(--paper); font-weight: 800; font-size: 13px; border-radius: 9px; padding: 2px 8px; white-space: nowrap; }
  .new { background: var(--coin); border: 2px solid var(--ink); border-radius: 999px; font-weight: 800; font-size: 12px; padding: 0 8px; }
  .sum { margin: 8px 0 0; font-weight: 600; }
  ul { margin: 8px 0 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px; font-weight: 600; font-size: 14.5px; }
</style>
