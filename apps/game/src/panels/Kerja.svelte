<script lang="ts">
  // Papan Lowongan: kartu tiap tempat kerja (ikon, tempat, gaji per lama kerja, bonus, kemajuan pangkat, syarat,
  // seragam), pilih 1 / 3 / 8 jam lalu Berangkat. Ronda: jendela waktu mulai. Shift berjalan / amplop di atas.
  import { onMount, tick } from 'svelte';
  import Sheet from '../components/Sheet.svelte';
  import { kerjaIcon, itemIcon, AMPLOP_ICON, localHM, rondaOpen } from '@kb/shared';
  import { G, item, needsNow, serverNow } from '../lib/game.svelte';
  import { K, loadBoard, startJob, recall, working, gajiWaiting, shift, jamPulang, sisa, durText, markBoardSeen } from '../lib/kerja.svelte';
  import { tzMin } from '../lib/alun.svelte';
  import { COIN } from '../lib/icons';
  import { sfx } from '../lib/sfx';

  const want = G.sheetArg?.job as string | undefined;
  let pick = $state<Record<string, number>>({});
  let busy = $state('');
  onMount(async () => {
    markBoardSeen();
    await loadBoard();
    if (want) { await tick(); document.getElementById('job-' + want)?.scrollIntoView({ block: 'center' }); }
  });
  const b = $derived(K.board);
  const pet = $derived(G.me.pet);
  const needs = $derived(G.now > 0 ? needsNow() : needsNow());
  const s = $derived(shift());
  const used = $derived(G.me.kerja?.usedMinutes ?? 0);
  const max = $derived(G.me.kerja?.maxMinutes ?? b?.maxMinutes ?? 720);
  /** kenapa pet belum bisa berangkat (bukan soal tempat kerjanya) */
  const why = $derived.by(() => {
    if (!b) return '';
    if (pet.sleep) return `${pet.name} sedang tidur. Bangunkan dulu, ya.`;
    if (pet.sick) return `${pet.name} lagi kurang enak badan. Kasih jamu dulu, baru kerja.`;
    if (needs.energi < b.minEnergi) return `Energi ${pet.name} ${Math.floor(needs.energi)}, butuh paling sedikit ${b.minEnergi}. Tidur dulu, ya.`;
    if (needs.kenyang < b.minKenyang) return `Kenyang ${pet.name} ${Math.floor(needs.kenyang)}, butuh paling sedikit ${b.minKenyang}. Makan dulu, ya.`;
    return '';
  });
  const hh = (h: number) => `${String(h % 24).padStart(2, '0')}.00`;
  const rondaNow = (j: any) => !j.window || rondaOpen(localHM(serverNow(), tzMin()), j.window.fromHour, j.window.toHour);
  const sel = (j: any) => j.options.find((o: any) => o.minutes === pick[j.id]) ?? j.options[0];
  const costText = (c: any) => [c.energi && `energi −${-c.energi}`, c.kenyang && `kenyang −${-c.kenyang}`, c.bersih && `bersih −${-c.bersih}`].filter(Boolean).join(', ');
  function blockOf(j: any) {
    if (pet.level < j.minLevel) return `Terbuka di Lv ${j.minLevel}`;
    if (j.window && !rondaNow(j)) return `Buka pukul ${hh(j.window.fromHour)}`;
    const o = sel(j);
    if (o && used + o.minutes > max) return 'Jam kerja hari ini habis';
    return '';
  }
  async function go(j: any) {
    const o = sel(j);
    if (!o || busy) return;
    busy = j.id;
    sfx.tap();
    try { await startJob(j.id, o.minutes); } finally { busy = ''; }
  }
  function home() { sfx.tap(); G.sheet = null; G.view = 'home'; }
</script>

<Sheet title="Papan Lowongan">
  {#if s && working()}
    <div class="now" role="status">
      <span class="ic">{@html kerjaIcon(s.job)}</span>
      <div><b>{pet.name} sedang {s.doing}</b><span>di {s.place} · pulang {jamPulang(s.endsAt - G.offset)} ({sisa(s.endsAt - serverNow())} lagi)</span></div>
      <button class="btn sm" disabled={G.busy} onclick={() => recall()}>Panggil pulang</button>
    </div>
  {:else if s && gajiWaiting()}
    <div class="now gaji" role="status">
      <span class="ic">{@html AMPLOP_ICON}</span>
      <div><b>{pet.name} sudah pulang bawa amplop!</b><span>Terima gajinya di rumah dulu, baru berangkat lagi.</span></div>
      <button class="btn sm hot" onclick={home}>Ke rumah</button>
    </div>
  {:else}
    <p class="lead">Pilih tempat kerja untuk {pet.name}. Pulangnya bawa gaji, XP, kadang barang bonus, dan cerita seru!</p>
  {/if}
  {#if !b}
    <p class="muted">{K.loading ? 'Memuat lowongan…' : 'Lowongan belum bisa dimuat.'}</p>
  {:else if !b.on}
    <p class="muted">Papan Lowongan sedang tutup. Coba lagi nanti, ya.</p>
  {:else}
    <div class="meta">
      <span>Jam kerja hari ini: {#if used}<b>{durText(used)}</b> dari {durText(max)}{:else}belum ada (batas {durText(max)} sehari){/if}</span>
      <span>Selama kerja kebutuhan {pet.name} tidak turun; dipotong sekali saat pulang.</span>
    </div>
    {#if why && !s}<p class="warn" role="alert">{why}</p>{/if}
    {#each b.jobs as j (j.id)}
      {@const o = sel(j)}
      {@const block = blockOf(j)}
      {@const locked = pet.level < j.minLevel}
      <section class="job" class:locked id="job-{j.id}" aria-labelledby="jt-{j.id}">
        <div class="top">
          <span class="art">{@html kerjaIcon(j.id)}</span>
          <div class="info">
            <b id="jt-{j.id}">{j.title}</b>
            <span>{j.place} · Lv {j.minLevel}{j.kotor ? ' · bikin kotor' : ''}</span>
          </div>
          <span class="rank r{j.rank.idx}">{j.rank.label}</span>
        </div>
        {#if j.window}<p class="win">Ronda malam: mulai pukul {hh(j.window.fromHour)}–{hh(j.window.toHour)}, {durText(j.options[0].minutes)}, pulang pagi agak mengantuk.</p>{/if}
        <div class="prog" aria-label="Kemajuan pangkat">
          <div class="bar"><i style="width:{Math.round(j.rank.pct * 100)}%"></i></div>
          <small>{#if j.rank.next}{j.rank.shifts}/{j.rank.next.at} shift menuju {j.rank.next.label} (gaji +{(j.rank.idx + 1) * b.rankBonusPct}%){:else}Pangkat tertinggi! Gaji +{j.rank.bonusPct}%{/if}{#if j.rank.bonusPct && j.rank.next}{' · '}sekarang +{j.rank.bonusPct}%{/if}</small>
        </div>
        <div class="row2">
          {#if j.bonusItems.length}
            <span class="bonus" title="Peluang barang bonus">Bonus {j.bonusPct}%:{#each j.bonusItems.slice(0, 4) as id}{@const it = item(id)}{#if it}<i class="mini">{@html itemIcon(it)}</i>{/if}{/each}{#if j.bonusItems.length > 4}<em>+{j.bonusItems.length - 4}</em>{/if}</span>
          {/if}
          <span class="uni" title="Seragam tempat kerja">{#each j.uniform.items as id}{@const it = item(id)}{#if it}<i class="mini">{@html itemIcon(it)}</i>{/if}{/each}<small>{j.uniform.got ? 'Seragam didapat' : 'Seragam saat Karyawan'}</small></span>
        </div>
        {#if j.options.length > 1}
          <div class="opts" role="radiogroup" aria-label="Lama kerja di {j.place}">
            {#each j.options as op}
              <button class="opt" role="radio" aria-checked={o === op} class:on={o === op} disabled={locked} onclick={() => { sfx.tap(); pick[j.id] = op.minutes; }}>
                <b>{durText(op.minutes)}</b><span>{@html COIN}{op.pay}</span><small>+{op.xp} XP</small>
              </button>
            {/each}
          </div>
        {:else if o}
          <div class="opts one"><span class="opt on"><b>{durText(o.minutes)}</b><span>{@html COIN}{o.pay}</span><small>+{o.xp} XP</small></span></div>
        {/if}
        {#if o}<p class="cost">Saat pulang: {costText(o.cost)}.</p>{/if}
        <button class="btn hot go" disabled={!!block || !!s || !!why || G.busy || !!busy} onclick={() => go(j)}>
          {busy === j.id ? 'Berangkat…' : block || (s ? `${pet.name} sedang kerja` : `Berangkat ${o ? durText(o.minutes) : ''}`)}
        </button>
      </section>
    {/each}
    <p class="note">Naik pangkat tiap {b.rankAt.karyawan}, {b.rankAt.senior}, dan {b.rankAt.kepala} shift selesai di tempat yang sama: Karyawan dapat seragam, gaji +{b.rankBonusPct}% tiap pangkat. Dipanggil pulang lebih awal: gaji sesuai lama kerja, tanpa bonus, tidak dihitung untuk pangkat.</p>
  {/if}
</Sheet>

<style>
  .lead { margin: 0; font-weight: 600; }
  .now { display: flex; align-items: center; gap: 10px; border: 2.5px solid var(--ink); border-radius: 16px; background: #FFF3CF; padding: 8px 10px; box-shadow: 0 3px 0 var(--ink); }
  .now.gaji { background: #FDE6D6; }
  .now .ic { width: 50px; height: 42px; flex: none; }
  .now .ic :global(svg) { width: 100%; height: 100%; }
  .now div { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .now b { font-size: 15.5px; line-height: 1.2; }
  .now span { font-size: 13px; font-weight: 600; color: var(--muted); }
  .meta { display: flex; flex-direction: column; gap: 2px; font-size: 13px; font-weight: 600; color: var(--muted); }
  .meta b { color: var(--ink); }
  .warn { margin: 0; background: #FDE2DA; border: 2px solid #A93A27; color: #7C2A1B; border-radius: 12px; padding: 6px 10px; font-weight: 700; font-size: 14px; }
  .job { border: 2.5px solid var(--ink); border-radius: 18px; background: var(--card); padding: 10px; display: flex; flex-direction: column; gap: 7px; scroll-margin: 12px; }
  .job.locked { background: #F4F1EA; }
  .top { display: flex; gap: 10px; align-items: center; }
  .art { width: 60px; height: 50px; flex: none; background: var(--tint); border-radius: 12px; display: grid; place-items: center; }
  .art :global(svg) { width: 54px; height: 44px; }
  .job.locked .art { filter: grayscale(.7); }
  .info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .info b { font-size: 16.5px; line-height: 1.15; }
  .info span { font-size: 13px; font-weight: 600; color: var(--muted); }
  .rank { flex: none; align-self: flex-start; border: 2px solid var(--ink); border-radius: 999px; padding: 0 9px; font-weight: 800; font-size: 12.5px; background: #E9E4D6; }
  .rank.r1 { background: #CDE8D6; } .rank.r2 { background: #CFE3F5; } .rank.r3 { background: #F2C94C; }
  .win { margin: 0; font-size: 13px; font-weight: 700; color: #2E3A5E; background: #E4E8F5; border-radius: 10px; padding: 4px 8px; }
  .prog { display: flex; flex-direction: column; gap: 2px; }
  .bar { height: 10px; border: 2px solid var(--ink); border-radius: 7px; background: var(--track); overflow: hidden; }
  .bar i { display: block; height: 100%; background: var(--ok); }
  .prog small { font-size: 12.5px; font-weight: 700; color: var(--muted); }
  .row2 { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: center; font-size: 12.5px; font-weight: 700; }
  .bonus, .uni { display: inline-flex; align-items: center; gap: 2px; flex-wrap: wrap; }
  .uni small { font-size: 12px; color: var(--muted); margin-left: 2px; }
  .mini { display: inline-grid; place-items: center; width: 26px; height: 24px; background: var(--tint); border-radius: 7px; margin-left: 2px; }
  .mini :global(svg) { width: 24px; height: 22px; }
  .bonus em { font-style: normal; color: var(--muted); margin-left: 3px; }
  .opts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .opts.one { grid-template-columns: minmax(0, 1fr); }
  .opt { display: flex; flex-direction: column; align-items: center; gap: 0; border: 2px solid var(--ink); border-radius: 12px; background: var(--paper); padding: 4px 2px; cursor: pointer; min-height: 56px; font: inherit; }
  .opt b { font-size: 14.5px; }
  .opt span { display: inline-flex; align-items: center; gap: 2px; font-weight: 800; font-size: 14px; }
  .opt span :global(svg) { width: 15px; height: 15px; }
  .opt small { font-size: 11.5px; font-weight: 700; color: var(--muted); }
  .opt.on { background: #FFE8A3; box-shadow: 0 2px 0 var(--ink); }
  .opt:disabled { opacity: .55; cursor: not-allowed; }
  .cost { margin: 0; font-size: 12.5px; font-weight: 600; color: var(--muted); }
  .go { width: 100%; }
  .note { margin: 0; font-size: 12.5px; font-weight: 600; color: var(--muted); }
</style>
