<script lang="ts">
  // Ctrl K: cari halaman admin dan pemain (nama, nama pet, kode teman, email).
  import { A } from '../../lib/store.svelte';
  import { api } from '../../lib/api';
  import { I } from '../../lib/icons';
  let { pages }: { pages: { k: string; label: string; icon: string; group: string }[] } = $props();
  let q = $state(''), sel = $state(0), players = $state<any[]>([]), input = $state<HTMLInputElement>();
  let t: ReturnType<typeof setTimeout> | undefined;
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const pageHits = $derived(q ? pages.filter((p) => norm(p.label + ' ' + p.group).includes(norm(q))).slice(0, 7) : pages.slice(0, 7));
  const items = $derived([
    ...pageHits.map((p) => ({ kind: 'page' as const, id: p.k, label: p.label, sub: p.group, icon: p.icon })),
    ...players.map((p) => ({ kind: 'player' as const, id: p.id, label: p.display_name, sub: `${p.pet_name ?? 'tanpa pet'} · ${p.friend_code}`, icon: 'user' })),
  ]);
  $effect(() => { if (A.palette) { q = ''; players = []; sel = 0; setTimeout(() => input?.focus(), 20); } });
  function search() {
    sel = 0; clearTimeout(t);
    if (q.trim().length < 2) { players = []; return; }
    t = setTimeout(async () => { try { players = (await api.quiet(`/api/admin/players?q=${encodeURIComponent(q.trim())}&size=5`)).players ?? []; } catch { players = []; } }, 220);
  }
  function pick(i: number) {
    const it = items[i]; if (!it) return;
    A.palette = false;
    location.hash = it.kind === 'page' ? `#/${it.id}` : `#/players/${it.id}`;
  }
  function key(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(sel); }
    else if (e.key === 'Escape') A.palette = false;
  }
</script>
{#if A.palette}
  <div class="bd" onclick={() => (A.palette = false)} role="presentation"></div>
  <div class="pal" role="dialog" aria-modal="true" aria-label="Cari menu atau pemain">
    <label class="in"><span class="ic">{@html I.search}</span><input bind:this={input} bind:value={q} oninput={search} onkeydown={key} placeholder="Cari menu, atau nama / kode pemain…" aria-label="Cari" /><kbd>Esc</kbd></label>
    <ul role="listbox">
      {#each items as it, i (it.kind + it.id)}
        {#if i === 0 || items[i - 1].kind !== it.kind}<li class="gh">{it.kind === 'page' ? 'Halaman' : 'Pemain'}</li>{/if}
        <li role="option" aria-selected={sel === i}><button class:on={sel === i} onmouseenter={() => (sel = i)} onclick={() => pick(i)}>
          <span class="ic">{@html (I as any)[it.icon]}</span><span class="l">{it.label}</span><small>{it.sub}</small>{#if sel === i}<span class="ent">↵</span>{/if}
        </button></li>
      {:else}<li class="none">Tidak ada yang cocok.</li>{/each}
    </ul>
    <p class="ft"><kbd>↑</kbd><kbd>↓</kbd> pilih · <kbd>↵</kbd> buka · ketik minimal 2 huruf untuk mencari pemain</p>
  </div>
{/if}
<style>
  .bd { position: fixed; inset: 0; z-index: 120; background: rgba(43,47,74,.35); animation: fadein .12s; }
  .pal { position: fixed; z-index: 121; left: 50%; top: 12vh; transform: translateX(-50%); width: min(560px, calc(100vw - 20px)); background: #fff; border-radius: 16px; box-shadow: 0 30px 80px rgba(0,0,0,.3); overflow: hidden; animation: pop .15s ease-out; }
  .in { flex-direction: row; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--line); }
  .in input { border: 0; box-shadow: none !important; padding: 4px 0; font-size: 16px; }
  .in .ic { width: 18px; height: 18px; color: var(--muted); }
  kbd { font: 11px var(--mono); border: 1px solid var(--line); border-bottom-width: 2px; border-radius: 5px; padding: 0 5px; color: var(--muted); background: #FAFBFA; }
  ul { list-style: none; margin: 0; padding: 6px; max-height: 50vh; overflow-y: auto; }
  .gh { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); font-weight: 700; padding: 8px 10px 4px; }
  li button { all: unset; box-sizing: border-box; width: 100%; display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 9px; cursor: pointer; }
  li button.on { background: var(--accent-soft); }
  li button .ic { color: var(--muted); } li button.on .ic { color: var(--accent); }
  .l { font-weight: 600; } small { color: var(--muted); margin-left: auto; font-size: 12.5px; text-align: right; }
  .ent { color: var(--accent); font-weight: 700; }
  .none { padding: 16px; color: var(--muted); text-align: center; }
  .ft { margin: 0; padding: 8px 14px; border-top: 1px solid var(--line-soft); font-size: 12px; color: var(--muted); background: #FAFBFA; display: flex; gap: 4px; align-items: center; flex-wrap: wrap; }
  @media (max-width: 760px) { .pal { top: 8px; } .ft { display: none; } }
</style>
