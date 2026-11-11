<script lang="ts">
  // Akun media sosial BUPI (diatur di admin › Situs & SEO), dipakai di layar masuk & Pengaturan.
  import { SOCIAL_ICONS, type SocialLink } from '@kb/shared';
  let { links = [] }: { links?: SocialLink[] } = $props();
</script>

{#if links.length}
  <div class="soc">
    {#each links as l (l.key)}
      <a class="s" class:ig={l.key === 'instagram'} href={l.url} target="_blank" rel="noopener" aria-label="{l.label} @{l.handle}">
        {@html SOCIAL_ICONS[l.key]}<span>{l.key === 'instagram' ? '@' + l.handle : l.label}</span>
      </a>
    {/each}
  </div>
{/if}

<style>
  .soc { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
  .s { display: inline-flex; align-items: center; gap: 6px; min-height: 38px; padding: 4px 12px; border: 2px solid var(--ink); border-radius: 12px; background: var(--paper); color: var(--ink); font-weight: 800; font-size: 14.5px; text-decoration: none; box-shadow: 0 2px 0 var(--ink); }
  .s :global(svg) { width: 18px; height: 18px; flex: none; }
  .s.ig { color: #fff; background: linear-gradient(45deg, #F9A13A 0%, #E1306C 50%, #8A3AB9 100%); }
  .s:active { transform: translateY(2px); box-shadow: none; }
</style>
