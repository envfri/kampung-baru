<script lang="ts">
  // Perluas kebun: pratinjau sekarang → berikutnya, kegunaan baru, syarat (level pet & koin), tahapan Lv1–Lv5.
  import Sheet from '../components/Sheet.svelte';
  import { gardenPerks, gardenState, gentong, gubuk, orangOrangan, papanNama, basketIcon } from '@kb/shared';
  import { G, run, post, toast, fmt, settings, serverNow, item } from '../lib/game.svelte';
  import { gardenStatic, plotView } from '../lib/kebun';
  import { sfx } from '../lib/sfx';
  import { COIN } from '../lib/icons';

  const g = $derived(gardenState(settings().garden, G.me.gardenLevel));
  const perks = $derived(gardenPerks(settings().garden));
  const pet = $derived(G.me.pet);
  const coin = $derived(G.me.wallet?.coin ?? 0);
  const nx = $derived(g.next);
  const petOk = $derived(!!nx && pet.level >= nx.petLevel);
  const coinOk = $derived(!!nx && coin >= nx.coins);
  const views = $derived(Array.from({ length: g.slots }, (_, i) => {
    const p = (G.me.garden ?? []).find((x: any) => x.slot === i);
    return p ? plotView(p, serverNow(), item) : null;
  }));
  const owner = $derived(pet?.name ?? 'Bupi');
  const now = $derived(gardenStatic({ level: g.level, n: g.slots, plots: views, ghost: false, wide: false, owner, top: g.slots > 6 ? 8 : 84 }));
  const next = $derived(nx ? gardenStatic({ level: g.level + 1, n: nx.slots, plots: views, ghost: false, wide: false, owner, hi: g.slots, hiText: `+${nx.slots - g.slots} petak baru`, top: 8 }) : '');
  const PERK_ICON: Record<string, string> = {
    panen: `<svg viewBox="2 0 36 36" aria-hidden="true">${basketIcon()}</svg>`,
    orangan: `<svg viewBox="-30 -90 60 94" aria-hidden="true">${orangOrangan(0, 0, 1)}</svg>`,
    gentong: `<svg viewBox="-30 -66 60 72" aria-hidden="true">${gentong(0, 0, 1)}</svg>`,
    gubuk: `<svg viewBox="-62 -98 128 104" aria-hidden="true">${gubuk(0, 0, 1)}</svg>`,
    papan: `<svg viewBox="-50 -58 100 62" aria-hidden="true">${papanNama(0, 0, 'Kebun', 46)}</svg>`,
  };
  const perk = (lv: number) => perks[lv - 1];
  const CHECK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const LOCK = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="#fff"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="#fff" stroke-width="2.6"/></svg>`;
  const CROSS = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/></svg>`;

  async function expand() {
    if (!nx || !petOk || !coinOk) return;
    const to = g.level + 1;
    const r: any = await run(() => post('/api/garden/expand', { to }));
    if (!r) return;
    sfx.level();
    G.sheet = null;
    toast(`Kebun naik ke Lv ${r.level}! Sekarang ${r.slots} petak.`, 'good');
  }
</script>

<Sheet title="Perluas kebun">
  {#if nx}
    <div class="pv">
      <figure><figcaption>Sekarang</figcaption><div class="mini">{@html now}</div><span>Lv {g.level} · {g.slots} petak</span></figure>
      <span class="arr" aria-hidden="true">→</span>
      <figure class="nx"><figcaption>Berikutnya</figcaption><div class="mini">{@html next}</div><b>Lv {g.level + 1} · {nx.slots} petak</b></figure>
    </div>
    <ul class="new">
      <li><span class="ni">+</span><span><b>{nx.slots - g.slots} petak baru</b> di baris bawah (petak lama tidak pindah)</span></li>
      {#if perk(g.level + 1)}
        {@const pk = perk(g.level + 1)}
        <li><span class="ni">{@html PERK_ICON[pk.key] ?? ''}</span><span><b>{pk.adds}</b>: {pk.effect}</span></li>
      {/if}
    </ul>
    <div class="req">
      <span class="chip" class:ok={petOk}>{@html petOk ? CHECK : CROSS}<span>Pet Lv {nx.petLevel}<small>{petOk ? `${pet.name} Lv ${pet.level}` : `${pet.name} Lv ${pet.level}, kurang ${nx.petLevel - pet.level} level`}</small></span></span>
      <span class="chip" class:ok={coinOk}>{@html coinOk ? CHECK : CROSS}<span>{fmt(nx.coins)} koin<small>{coinOk ? `Saldo ${fmt(coin)}` : `Koin kurang ${fmt(nx.coins - coin)}`}</small></span></span>
    </div>
    <button class="btn big" class:hot={petOk && coinOk} disabled={!petOk || !coinOk || G.busy} onclick={expand}>
      {#if petOk && coinOk}Perluas kebun · {@html COIN}{fmt(nx.coins)}{:else}Belum bisa{/if}
    </button>
  {:else}
    <div class="pv done"><div class="mini wide">{@html now}</div></div>
    <p class="max"><b>Kebunmu sudah paling luas: {g.slots} petak.</b> Semua benda kebun sudah lengkap.</p>
  {/if}
  <ol class="steps" aria-label="Tahapan kebun">
    {#each g.levels as l, i}
      {@const lv = i + 1}
      {@const st = lv <= g.level ? 'done' : lv === g.level + 1 ? 'next' : 'lock'}
      <li class="stp {st}"><i>{@html st === 'done' ? CHECK : st === 'lock' ? LOCK : lv}</i><b>Lv {lv}</b><small>{l.slots} petak</small></li>
    {/each}
  </ol>
  <div class="ladder">
    {#each g.levels as l, i}
      {@const lv = i + 1}
      {@const pk = perk(lv)}
      <div class="lad" class:cur={lv === g.level} class:lock={lv > g.level}>
        <span class="lvn">Lv {lv}</span>
        <span class="lt">{pk ? `${pk.adds}: ${pk.effect}` : `+${l.slots - (g.levels[i - 1]?.slots ?? 0)} petak`}</span>
        <span class="lr">{#if i === 0}Awal{:else}{@html COIN}{fmt(l.coins)} · Pet Lv {l.petLevel}{/if}</span>
      </div>
    {/each}
  </div>
</Sheet>

<style>
  .pv { display: flex; align-items: flex-end; gap: 6px; background: var(--tint); border: 2px solid var(--ink); border-radius: 16px; padding: 8px; }
  .pv.done { justify-content: center; }
  figure { margin: 0; flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 3px; font-size: 14px; font-weight: 700; text-align: center; }
  figcaption { font-size: 12px; font-weight: 800; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
  .mini { width: 100%; border-radius: 12px; overflow: hidden; border: 2px solid var(--ink); background: #A9D18A; line-height: 0; }
  .mini.wide { max-width: 240px; }
  .mini :global(svg) { width: 100%; height: auto; display: block; }
  .nx .mini { border-color: #E8A33A; box-shadow: 0 0 0 3px #F2B632; }
  .arr { font-size: 24px; font-weight: 800; align-self: center; }
  .new { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .new li { display: flex; gap: 8px; align-items: center; font-size: 14px; font-weight: 600; line-height: 1.25; }
  .ni { flex: none; width: 36px; height: 36px; border-radius: 10px; border: 2px solid var(--ink); background: var(--soft); display: grid; place-items: center; font-weight: 800; font-size: 20px; overflow: hidden; }
  .ni :global(svg) { width: 30px; height: 30px; }
  .req { display: flex; gap: 8px; flex-wrap: wrap; }
  .chip { flex: 1 1 140px; display: flex; gap: 7px; align-items: center; border: 2px solid var(--ink); border-radius: 12px; padding: 5px 9px; font-weight: 800; font-size: 14.5px; line-height: 1.1; background: #F8D3CA; }
  .chip.ok { background: #D6F0DF; }
  .chip small { display: block; font-weight: 600; font-size: 12.5px; color: #3B4060; }
  .chip > :global(svg) { width: 22px; height: 22px; flex: none; border-radius: 50%; padding: 2px; border: 2px solid var(--ink); background: #C0392B; }
  .chip.ok > :global(svg) { background: var(--ok); }
  .big { width: 100%; min-height: 50px; font-size: 17px; flex-wrap: wrap; }
  .big :global(svg) { width: 20px; height: 20px; }
  .btn.big:disabled { background: #D8D6CF; opacity: 1; color: #6E7387; }
  .max { margin: 0; font-size: 14.5px; font-weight: 600; text-align: center; }
  .steps { list-style: none; margin: 4px 0 0; padding: 0 4px; display: flex; justify-content: space-between; position: relative; }
  .steps::before { content: ''; position: absolute; left: 30px; right: 30px; top: 14px; height: 4px; background: #D8D2C0; border-radius: 2px; }
  .stp { position: relative; display: flex; flex-direction: column; align-items: center; font-size: 13px; flex: 1 1 0; min-width: 0; }
  .stp i { width: 32px; height: 32px; border-radius: 50%; border: 2.5px solid var(--ink); display: grid; place-items: center; font-style: normal; font-weight: 800; font-size: 14px; background: #9AA0B4; margin-bottom: 2px; color: var(--ink); }
  .stp i :global(svg) { width: 16px; height: 16px; }
  .stp.done i { background: var(--ok); }
  .stp.next i { background: var(--coin); box-shadow: 0 0 0 4px #FFE7A0; }
  .stp small { font-weight: 600; color: var(--muted); font-size: 11.5px; white-space: nowrap; }
  .stp.lock { color: #6E7387; }
  .ladder { display: flex; flex-direction: column; border: 2px solid var(--ink); border-radius: 14px; overflow: hidden; }
  .lad { display: grid; grid-template-columns: 42px minmax(0, 1fr); gap: 2px 8px; padding: 6px 10px; font-size: 13.5px; font-weight: 600; border-top: 1.5px solid #E2DCCB; background: #fff; line-height: 1.2; }
  .lad:first-child { border-top: 0; }
  .lad.cur { background: var(--soft); }
  .lad.lock { color: #5F6478; }
  .lvn { font-weight: 800; grid-row: span 2; }
  .lr { font-size: 12.5px; color: var(--muted); display: flex; align-items: center; gap: 3px; flex-wrap: wrap; }
  .lr :global(svg) { width: 14px; height: 14px; }
</style>
