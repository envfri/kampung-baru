<script lang="ts">
  import Sheet from '../components/Sheet.svelte';
  import { PET_COLORS, PET_PARTS, petSVG, itemIcon } from '@kb/shared';
  import { G, item, run, toast, fx, wearItems, owned, goTo } from '../lib/game.svelte';
  import { api } from '../lib/api';
  import { sfx } from '../lib/sfx';

  type Tab = 'color' | 'ear' | 'pattern' | 'eyes' | 'tail' | 'wear';
  const TABS: [Tab, string][] = [['color', 'Warna'], ['ear', 'Telinga'], ['pattern', 'Motif'], ['eyes', 'Mata'], ['tail', 'Ekor'], ['wear', 'Aksesori']];
  const SLOTS: [string, string][] = [['head', 'Kepala'], ['face', 'Wajah'], ['neck', 'Leher'], ['back', 'Punggung'], ['hand', 'Dibawa']];
  let tab = $state<Tab>('color');
  const pet = $derived(G.me.pet);
  const look = $derived({ color: pet.color, ear: pet.ear, pattern: pet.pattern, eyes: pet.eyes, tail: pet.tail });
  const preview = $derived(petSVG(look, wearItems(pet.wear), 'pet-bob'));
  const myWear = $derived(
    Object.entries(G.me.inventory ?? {})
      .map(([id]) => item(id))
      .filter((i) => i && i.kind === 'wear' && owned(i.id) > 0) as any[],
  );

  async function save(patch: Record<string, unknown>) {
    const r = await run(() => api.post('/api/pet/look', patch));
    if (r) { sfx.pop(); fx('hearts'); }
  }
  function pick(kind: Exclude<Tab, 'color' | 'wear'>, key: string, lv: number) {
    if (pet.level < lv) { sfx.error(); toast(`Terbuka di Lv ${lv}. Naikkan level dengan merawat pet dan menyelesaikan tugas.`, 'error'); return; }
    if ((look as any)[kind] === key) return;
    save({ [kind]: key });
  }
  function toggleWear(it: any) {
    const slot = it.data?.slot ?? 'head';
    save({ wear: { [slot]: pet.wear?.[slot] === it.id ? null : it.id } });
  }
</script>

<Sheet title="Lemari">
  <div class="stage">
    <div class="pv">{@html preview}</div>
    <div class="who"><b>{pet.name}</b><span>Lv {pet.level}</span></div>
  </div>

  <div class="tabbar" role="tablist">
    {#each TABS as [k, l]}<button role="tab" aria-selected={tab === k} class:on={tab === k} onclick={() => (tab = k)}>{l}</button>{/each}
  </div>

  {#if tab === 'color'}
    <div class="swatches">
      {#each PET_COLORS as c}
        <button class="sw" class:on={pet.color === c} style="--c:{c}" aria-label="Warna {c}" disabled={G.busy} onclick={() => pet.color !== c && save({ color: c })}></button>
      {/each}
    </div>
  {:else if tab === 'wear'}
    {#if myWear.length === 0}
      <p class="muted">Belum punya aksesori. Beli di Butik Benang atau Toko Mutiara.</p>
    {/if}
    {#each SLOTS as [slot, label]}
      {@const list = myWear.filter((i) => (i.data?.slot ?? 'head') === slot)}
      {#if list.length}
        <h3>{label}</h3>
        <div class="grid">
          {#each list as it (it.id)}
            {@const on = pet.wear?.[slot] === it.id}
            <button class="opt acc" class:on disabled={G.busy} onclick={() => toggleWear(it)} aria-pressed={on}>
              <span class="ic">{@html itemIcon(it)}</span>
              <span class="nm">{it.name}</span>
              <span class="st">{on ? 'Dipakai' : 'Pakai'}</span>
            </button>
          {/each}
        </div>
      {/if}
    {/each}
    <div class="row">
      <button class="btn sm" onclick={() => goTo('butik')}>Ke Butik Benang</button>
      <button class="btn sm" onclick={() => goTo('mutiara')}>Ke Toko Mutiara</button>
    </div>
  {:else}
    <div class="grid">
      {#each PET_PARTS[tab] as [key, label, lv] (key)}
        {@const locked = pet.level < lv}
        <button class="opt" class:on={(look as any)[tab] === key} class:locked disabled={G.busy} onclick={() => pick(tab as any, key, lv)} aria-label="{label}{locked ? `, terbuka di Lv ${lv}` : ''}">
          <span class="mini">{@html petSVG({ ...look, [tab]: key })}</span>
          <span class="nm">{label}</span>
          {#if locked}<span class="lock">Lv {lv}</span>{/if}
        </button>
      {/each}
    </div>
    <p class="hint">Bagian baru terbuka saat {pet.name} naik level.</p>
  {/if}
</Sheet>

<style>
  .stage { display: flex; align-items: center; gap: 14px; background: linear-gradient(180deg, var(--bg1), var(--bg2)); border: 2px solid var(--ink); border-radius: 16px; padding: 8px 14px; }
  .pv { width: 120px; height: 118px; flex: none; }
  .pv :global(svg) { width: 100%; height: 100%; overflow: visible; }
  .who { display: flex; flex-direction: column; }
  .who b { font-size: 22px; } .who span { font-weight: 700; color: var(--muted); }
  .swatches { display: flex; flex-wrap: wrap; gap: 12px; }
  .sw { width: 42px; height: 42px; border-radius: 50%; border: 2.5px solid var(--ink); background: var(--c); cursor: pointer; padding: 0; }
  .sw.on { box-shadow: 0 0 0 3px var(--paper), 0 0 0 6px var(--ink); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 10px; }
  .opt { position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; border: 2px solid var(--ink); border-radius: 14px; background: var(--card); padding: 6px 4px 8px; cursor: pointer; }
  .opt.on { background: var(--soft); box-shadow: 0 0 0 3px var(--coin); }
  .opt.locked .mini { filter: grayscale(1) opacity(.45); }
  .mini { width: 74px; height: 72px; }
  .mini :global(svg) { width: 100%; height: 100%; }
  .nm { font-weight: 800; font-size: 13.5px; text-align: center; line-height: 1.1; }
  .lock { position: absolute; top: 6px; right: 6px; background: var(--ink); color: var(--paper); font-size: 11.5px; font-weight: 800; border-radius: 8px; padding: 1px 6px; }
  .acc .ic { width: 100%; height: 56px; display: grid; place-items: center; background: var(--tint); border-radius: 10px; }
  .acc .ic :global(svg) { height: 50px; width: auto; max-width: 100%; }
  .st { font-size: 12px; font-weight: 700; color: var(--muted); }
  .acc.on .st { color: #1E7A4C; }
  h3 { margin: 4px 0 0; font-size: 16px; font-weight: 800; }
  .row { display: flex; gap: 8px; flex-wrap: wrap; }
  .muted, .hint { margin: 0; font-weight: 600; color: var(--muted); font-size: 13.5px; }
</style>
