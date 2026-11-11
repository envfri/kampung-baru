<script lang="ts">
  // Layar perawatan di dalam game (desain sama dengan halaman 503 dari server, lihat @kb/shared site.ts).
  // Cek ulang tiap 20 detik; begitu perawatan selesai (atau kamu admin yang boleh lewat) game dimuat ulang.
  import { onMount } from 'svelte';
  import { MAINT_CSS, etaText, maintenanceHTML, type SocialLink } from '@kb/shared';
  import { MAINT } from '../lib/maint.svelte';
  import { G } from '../lib/game.svelte';

  let social = $state<SocialLink[]>(G.config?.social ?? []);
  const info = $derived(MAINT.info!);
  const html = $derived(maintenanceHTML(info, social));
  let root: HTMLDivElement | undefined = $state();

  async function check() {
    try {
      const r = await fetch('/api/site', { cache: 'no-store', credentials: 'same-origin' });
      const s = await r.json();
      const m = s?.maintenance;
      if (!m?.on || m.bypass) { location.reload(); return; }
      if (JSON.stringify(s.social ?? []) !== JSON.stringify(social)) social = s.social ?? [];
      if (m.title !== info.title || m.message !== info.message || (m.until ?? null) !== info.until) MAINT.info = { title: m.title, message: m.message, until: m.until ?? null };
    } catch { /* masih belum bisa dihubungi: coba lagi nanti */ }
  }

  onMount(() => {
    const tick = () => {
      const el = root?.querySelector('[data-mt-left]');
      const e = etaText(MAINT.info?.until);
      if (el && e) el.textContent = e.left;
    };
    const onClick = (ev: Event) => {
      const b = (ev.target as HTMLElement).closest('[data-mt-check]') as HTMLButtonElement | null;
      if (!b) return;
      b.disabled = true; b.textContent = 'Mengecek…';
      check().finally(() => setTimeout(() => { b.disabled = false; b.textContent = 'Cek lagi'; }, 1500));
    };
    root?.addEventListener('click', onClick);
    const t1 = setInterval(tick, 30_000), t2 = setInterval(check, 20_000);
    check();
    return () => { clearInterval(t1); clearInterval(t2); root?.removeEventListener('click', onClick); };
  });
</script>

<svelte:head>{@html `<style>${MAINT_CSS}</style>`}</svelte:head>
<div class="maint" bind:this={root}>{@html html}</div>

<style>
  .maint { position: fixed; inset: 0; z-index: 900; overflow-y: auto; -webkit-overflow-scrolling: touch; background: var(--bg2); }
</style>
