<script lang="ts">
  // Kolam Pancing di kampung: alur mancing bertahap memakai /api/fish/* (jatah & hadiah kolam).
  import FishingFlow from '../components/fishing/FishingFlow.svelte';
  import type { Dist, FishApi } from '../components/fishing/pond';
  import { G, merge, post, settings } from '../lib/game.svelte';

  const cfg = $derived(settings().fishing ?? {});
  const left = $derived(G.me.limits?.fishingLeft ?? cfg.castsPerDay ?? 0);
  const call = async (url: string, body: any) => { const r = await post(url, body); merge(r); return r; };
  const kolam: FishApi = {
    cast: (distance: Dist) => call('/api/fish/cast', { distance }),
    hook: (castId) => call('/api/fish/hook', { castId }),
    land: (castId) => call('/api/fish/land', { castId }),
    lost: (castId, reason) => call('/api/fish/lost', { castId, reason }),
  };
</script>

<FishingFlow api={kolam} {left} costs={cfg.energi ?? {}} onexit={() => (G.view = 'map')} onbook={() => (G.sheet = 'collection')} />
