<script lang="ts">
  // Pilih bibit: semua bibit tampil. Punya → Tanam; belum punya → beli & tanam sekali ketuk;
  // terkunci level pet → "Lv N"; bibit event di luar event → abu-abu.
  import Sheet from '../components/Sheet.svelte';
  import { gardenState, GARDEN_PERK_LEVEL, growText, itemIcon, KEBUN_ICONS } from '@kb/shared';
  import { G, run, post, toast, goTo, owned, canBuy, settings, serverNow, fmt, type CatalogItem } from '../lib/game.svelte';
  import { ask } from '../lib/account.svelte';
  import { sfx } from '../lib/sfx';
  import { COIN } from '../lib/icons';

  const slot: number = G.sheetArg?.slot ?? 0;
  const g = $derived(gardenState(settings().garden, G.me.gardenLevel));
  const petLv = $derived(G.me.pet?.level ?? 1);
  const taken = $derived(new Set((G.me.garden ?? []).map((p: any) => p.slot)));
  const empties = $derived(Array.from({ length: g.slots }, (_, i) => i).filter((i) => !taken.has(i)).length);
  const canAll = $derived(g.level >= GARDEN_PERK_LEVEL.plantAll && empties > 1);
  let all = $state(false);
  const E = $derived(all && canAll ? empties : 1);

  type St = 'own' | 'buy' | 'lock' | 'off';
  const EV_NAME: Record<string, string> = { ramadan: 'Ramadan', 'pekan-ceria': 'Pekan Ceria' };
  const evOf = (it: CatalogItem) => (G.catalog?.events ?? []).find((e: any) => e.id === it.event_id);
  const cards = $derived.by(() => {
    const rank: Record<St, number> = { own: 0, buy: 1, lock: 2, off: 3 };
    const out: { it: CatalogItem; st: St; n: number; need: number; mins: number }[] = [];
    for (const it of G.catalog?.items ?? []) {
      if (it.kind !== 'seed' || !(Number(it.data?.growMinutes) > 0)) continue;
      const n = owned(it.id), need = Math.max(1, Number(it.data?.minLevel) || 1), buy = canBuy(it) && it.price_coin > 0;
      const locked = need > petLv;
      const st: St | null = n > 0 && !locked ? 'own' : it.event_id && !buy && !n ? 'off' : locked ? 'lock' : buy ? 'buy' : null;
      if (st) out.push({ it, st, n, need, mins: Number(it.data.growMinutes) });
    }
    return out.sort((a, b) => rank[a.st] - rank[b.st] || (a.st === 'lock' ? a.need - b.need : 0) || a.mins - b.mins || a.it.name.localeCompare(b.it.name));
  });
  const TABS = [['semua', 'Semua'], ['punya', 'Punya'], ['sayur', 'Sayur'], ['buah', 'Buah'], ['bunga', 'Bunga'], ['event', 'Event']] as const;
  let tab = $state<(typeof TABS)[number][0]>('semua');
  const shown = $derived(cards.filter((c) => tab === 'semua' || (tab === 'punya' ? c.st === 'own' : c.it.data?.cat === tab)));
  const tabs = $derived(TABS.filter(([k]) => k === 'semua' || k === 'punya' || cards.some((c) => c.it.data?.cat === k)));
  const nm = (it: CatalogItem) => it.name.replace(/^Bibit /, '');

  /** Biaya koin bila ditanam sekarang (bibit di tas dipakai dulu). */
  const cost = (c: (typeof cards)[number]) => Math.max(0, E - c.n) * c.it.price_coin;
  const plantable = (c: (typeof cards)[number]) => c.st === 'own' || c.st === 'buy';

  async function pick(c: (typeof cards)[number]) {
    const price = canBuy(c.it) ? cost(c) : 0;
    if (price > (G.me.wallet?.coin ?? 0)) { sfx.error(); toast(`Koin belum cukup (butuh ${fmt(price)}).`, 'error'); return; }
    if (price >= 150 && !(await ask({ title: `Beli ${E - c.n} ${nm(c.it)}?`, text: `${fmt(price)} koin untuk ${E - c.n} bibit, langsung ditanam di ${E} petak.`, yes: `Beli & tanam` }))) return;
    const r: any = await run(() => post('/api/garden/plant', { slot, seedId: c.it.id, all: E > 1, buy: price > 0 }));
    if (!r) return;
    sfx.pop();
    G.sheet = null; G.sheetArg = null;
    toast(`${nm(c.it)} ditanam${r.planted > 1 ? ` di ${r.planted} petak` : ''}${r.bought ? ` (beli ${r.bought} bibit, −${fmt(r.cost)} koin)` : ''}`, 'good');
  }
  function daysLeft(it: CatalogItem) {
    const ev = evOf(it);
    if (!ev) return '';
    const d = Math.ceil((new Date(ev.ends_at).getTime() - serverNow()) / 86_400_000);
    return d > 1 ? `${d} hari lagi` : 'Hari terakhir';
  }
  const evName = (it: CatalogItem) => evOf(it)?.name ?? EV_NAME[it.event_id ?? ''] ?? 'event';
  const pupukIcon = (() => { const p = KEBUN_ICONS.pupuk; return `<svg viewBox="0 0 64 52" aria-hidden="true">${p.draw(p.colors)}</svg>`; })();
</script>

<Sheet title="Pilih bibit">
  <div class="tabbar" role="tablist" aria-label="Kelompok bibit">
    {#each tabs as [k, t]}
      <button role="tab" aria-selected={tab === k} class:on={tab === k} onclick={() => { sfx.tap(); tab = k; }}>{t}{k === 'semua' ? ` ${cards.length}` : k === 'punya' ? ` ${cards.filter((c) => c.st === 'own').length}` : ''}</button>
    {/each}
  </div>
  <div class="ctx">
    <span><b>Petak {slot + 1}</b> · kosong</span>
    {#if canAll}
      <label class="tg"><input type="checkbox" bind:checked={all} /><i aria-hidden="true"></i>Isi semua petak kosong ({empties})</label>
    {/if}
  </div>
  {#if all && canAll}<p class="hint">Satu bibit untuk {empties} petak. Bibit di tas dipakai dulu, kekurangannya dibeli.</p>{/if}
  <div class="grid">
    {#each shown as c (c.it.id)}
      <div class="sc {c.st}">
        {#if c.it.event_id}<span class="rib">Event</span>{/if}
        {#if c.st === 'own'}<span class="bdg">×{c.n}</span>{/if}
        {#if c.st === 'lock'}<span class="lk"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.6"/></svg>Lv {c.need}</span>{/if}
        <div class="ic">{@html itemIcon(c.it)}</div>
        <div class="nm">{nm(c.it)}</div>
        {#if c.it.event_id && c.st === 'buy'}<span class="evt">{daysLeft(c.it)}</span>
        {:else}<span class="meta"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#fff" stroke="currentColor" stroke-width="2.4"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>{growText(c.mins)} · ×{c.it.data?.yieldQty ?? 1}</span>{/if}
        {#if plantable(c)}
          {@const p = canBuy(c.it) ? cost(c) : 0}
          <button class="btn sm" class:hot={c.st === 'own'} disabled={G.busy} aria-label="{c.st === 'own' && !p ? 'Tanam' : 'Beli & tanam'} {nm(c.it)}{E > 1 ? ` di ${E} petak` : ''}" onclick={() => pick(c)}>
            {#if !p}{E > 1 ? `Tanam ×${Math.min(E, c.n)}` : 'Tanam'}
            {:else}{#if E > 1}<span class="x">×{E}</span>{/if}{@html COIN}{fmt(p)}{/if}
          </button>
        {:else if c.st === 'lock'}<span class="why">Buka di Lv {c.need}</span>
        {:else}<span class="why">Saat {evName(c.it)}</span>{/if}
      </div>
    {:else}
      <p class="muted">Belum ada bibit di kelompok ini.</p>
    {/each}
  </div>
  <div class="foot">
    {#if owned('pupuk') > 0}
      <p class="pupuk">{@html pupukIcon}<span><b>Pupuk ×{owned('pupuk')}</b> di tas. Ketuk tanaman yang sedang tumbuh untuk memakai.</span></p>
    {/if}
    <button class="btn sm" onclick={() => goTo('pasar')}>Ke Pasar Pagi</button>
  </div>
</Sheet>

<style>
  .tabbar { display: flex; flex-wrap: wrap; gap: 6px; }
  .tabbar > button { flex: none; border: 2px solid var(--ink); background: var(--paper); border-radius: 12px; padding: 3px 10px; font-weight: 700; font-size: 14px; min-height: 34px; cursor: pointer; }
  .tabbar > button.on { background: var(--ink); color: var(--paper); }
  .ctx { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; font-size: 14px; font-weight: 600; color: #3B4060; }
  .tg { display: inline-flex; gap: 6px; align-items: center; font-weight: 700; font-size: 13.5px; border: 2px solid var(--ink); border-radius: 11px; padding: 3px 8px 3px 4px; background: #fff; cursor: pointer; line-height: 1.15; }
  .tg input { position: absolute; opacity: 0; width: 1px; height: 1px; }
  .tg i { flex: none; width: 32px; height: 20px; border-radius: 10px; background: #D8D2C0; border: 2px solid var(--ink); position: relative; transition: background .15s; }
  .tg i::after { content: ''; position: absolute; left: 1px; top: 1px; width: 13px; height: 13px; border-radius: 50%; background: #fff; border: 1.5px solid var(--ink); transition: left .15s; }
  .tg input:checked + i { background: var(--ok); }
  .tg input:checked + i::after { left: 13px; }
  .tg input:focus-visible + i { outline: 3px solid #3F7FBF; outline-offset: 2px; }
  .hint { margin: -6px 0 0; font-size: 13px; font-weight: 600; color: var(--muted); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 10px 8px; padding-top: 6px; }
  .sc { position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; border: 2px solid var(--ink); border-radius: 13px; background: #fff; padding: 5px 4px 6px; min-width: 0; text-align: center; }
  .sc .ic { width: 100%; height: 54px; display: grid; place-items: center; background: var(--tint); border-radius: 9px; }
  .sc .ic :global(svg) { height: 52px; width: auto; max-width: 100%; }
  .sc .nm { font-weight: 800; font-size: 13px; line-height: 1.08; min-height: 28px; display: flex; align-items: center; justify-content: center; overflow-wrap: anywhere; }
  .meta { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 2px; font-size: 11.5px; font-weight: 700; color: var(--muted); line-height: 1.15; }
  .meta svg { width: 11px; height: 11px; flex: none; }
  .evt { font-size: 12px; font-weight: 800; color: #C2412D; line-height: 1.15; }
  .sc .btn { width: 100%; margin-top: 3px; gap: 3px; min-height: 32px; padding: 2px 4px; font-size: 14px; flex-wrap: wrap; }
  .sc .btn :global(svg) { width: 16px; height: 16px; }
  .sc .btn .x { font-size: 12px; }
  .why { font-size: 12px; font-weight: 700; color: var(--muted); min-height: 34px; display: grid; place-items: center; line-height: 1.1; }
  .sc.lock, .sc.off { background: #F1EEE6; }
  .sc.lock .ic, .sc.off .ic { filter: grayscale(.85) opacity(.55); }
  .sc.lock .nm, .sc.off .nm { color: #6E7387; }
  .bdg { position: absolute; top: -9px; right: -6px; background: var(--low); color: #fff; border: 2px solid var(--ink); border-radius: 10px; font-size: 11.5px; font-weight: 800; padding: 0 6px; z-index: 1; }
  .lk { position: absolute; top: 20px; left: 50%; transform: translateX(-50%); width: max-content; display: flex; align-items: center; gap: 3px; background: var(--ink); color: #fff; border-radius: 10px; font-size: 12.5px; font-weight: 800; line-height: 1.2; padding: 3px 8px 3px 6px; z-index: 1; white-space: nowrap; }
  .lk svg { width: 12px; height: 12px; }
  .rib { position: absolute; top: -9px; left: -6px; background: #E0583F; color: #fff; border: 2px solid var(--ink); border-radius: 8px; font-size: 11px; font-weight: 800; padding: 0 5px; z-index: 1; box-shadow: inset 0 -4px 0 #fff; }
  .foot { display: flex; flex-direction: column; gap: 8px; align-items: stretch; }
  .foot .btn { align-self: center; }
  .pupuk { margin: 0; display: flex; align-items: center; gap: 8px; background: var(--tint); border: 2px dashed #9DB8A8; border-radius: 12px; padding: 6px 10px; font-size: 13px; font-weight: 600; line-height: 1.25; }
  .pupuk :global(svg) { width: 40px; height: 32px; flex: none; }
  .muted { grid-column: 1 / -1; margin: 0; font-weight: 600; color: var(--muted); }
</style>
