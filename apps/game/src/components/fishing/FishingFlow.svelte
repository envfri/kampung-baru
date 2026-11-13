<script lang="ts">
  // Alur mancing bertahap (±12–25 dtk): lempar (bar kekuatan) → ulur & tunggu (bayangan ikan) → ngicip/sambar
  // → tarik-ulur (tegangan & jarak) → kartu hasil. Semua hasil diputuskan server lewat `api`; komponen ini hanya
  // menampilkan petunjuk dari server, jadi bisa dipakai ulang (mis. Lomba Mancing alun-alun) dengan api lain.
  import { onDestroy, onMount, type Snippet } from 'svelte';
  import { renderPet, pondSky as skyAt, DIST_LABEL, SKY_LABEL, type SkyTime } from '@kb/shared';
  import { G, fail, toast, wearItems, petLook, serverNow, needsNow } from '../../lib/game.svelte';
  import { sfx } from '../../lib/sfx';
  import { I } from '../../lib/icons';
  import { VIEW, SPOT, TIP, DOCK, pondBase, skyLayer, pondRings, shadowSvg, bobberSvg, splashSvg, rodSvg, sweatSvg, bubbleSvg, lineD, skyBg, type Dist, type FishApi, type RodPose } from './pond';
  import CatchCard from './CatchCard.svelte';

  // extra: baris tambahan di atas panel (mis. papan skor ringkas Lomba Mancing alun-alun)
  let { api, left = 0, costs = {}, title = 'Kolam Pancing', exitLabel = 'Kampung', onexit, onbook, extra }: {
    api: FishApi; left?: number; costs?: Partial<Record<Dist, number>>; title?: string; exitLabel?: string; onexit?: () => void; onbook?: () => void; extra?: Snippet;
  } = $props();

  type Phase = 'idle' | 'aim' | 'cast' | 'wait' | 'bite' | 'hooking' | 'fight' | 'landing' | 'result' | 'fail';
  let phase = $state<Phase>('idle');
  let cast = $state<any>(null);
  let res = $state<any>(null);
  let why = $state('');
  // ?langit=malam hanya untuk pratinjau tampilan (peluang ikan tetap memakai waktu server)
  const wantSky = (() => { try { const v = new URLSearchParams(location.search).get('langit'); return ['pagi', 'siang', 'sore', 'malam'].includes(v ?? '') ? (v as SkyTime) : null; } catch { return null; } })();
  const nowSky = () => wantSky ?? skyAt(serverNow());
  let sky = $state<SkyTime>(nowSky());
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- lempar: jarum bolak-balik 1,1 dtk sekali jalan ---------- */
  const ZONES: { k: Dist; w: number; hint: string; bg: string }[] = [
    { k: 'dekat', w: 40, hint: 'cepat dapat', bg: '#CDEBD0' },
    { k: 'sedang', w: 35, hint: 'seimbang', bg: '#F9E3A0' },
    { k: 'jauh', w: 25, hint: 'besar & langka', bg: '#F6B48A' },
  ];
  const zoneAt = (v: number): Dist => (v < 0.4 ? 'dekat' : v < 0.75 ? 'sedang' : 'jauh');
  let aim = $state(0);
  let aimDir = 1;
  const aimZone = $derived<Dist | null>(phase === 'aim' ? zoneAt(aim) : null);

  /* ---------- pelampung, bayangan, gelembung ---------- */
  let dist = $state<Dist>('sedang');
  let bob = $state({ x: SPOT.sedang[0], y: SPOT.sedang[1] });
  let bobOn = $state(false);
  let bobState = $state<'float' | 'nibble' | 'dunk'>('float');
  let spin = $state(false);
  let bubble = $state('');
  type Shadow = { id: number; x: number; y: number; size: string; glow: boolean; real: boolean; ang: number; ms: number; gone: boolean };
  let shadows = $state<Shadow[]>([]);

  /* ---------- tarik-ulur ---------- */
  let T = $state(0.3);
  let D = $state(1);
  let holding = $state(false);
  let fish = $state({ x: 0, y: 0 });
  let jerkN = $state(0);
  let snapAt = $state<null | { x: number; y: number }>(null);
  let fightStart = 0, redMs = 0, slackMs = 0, last = 0, raf = 0;
  let timers: ReturnType<typeof setTimeout>[] = [];
  const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
  function clearAll() { timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(raf); raf = 0; }

  const active = $derived(['cast', 'wait', 'bite', 'hooking', 'fight', 'landing'].includes(phase));
  $effect(() => { G.dimNav = active; });

  let tipsN = $state((() => { try { return Number(localStorage.getItem('kb-mancing-n') ?? 0) || 0; } catch { return 0; } })());
  const showTips = $derived(tipsN < 3);

  /* ---------- gambar ---------- */
  const base = $derived(pondBase(sky));
  const skyTop = $derived(skyLayer(sky));
  const mood = $derived(phase === 'result' ? 'senang' : phase === 'fail' ? 'bosan' : undefined);
  const petHtml = $derived.by(() => {
    const me = G.me?.pet;
    if (!me) return '';
    const st = petLook(me) ?? {};
    return renderPet(me, wearItems(me.wear), mood ? { ...st, mood } : st);
  });
  const pose = $derived<RodPose>(phase === 'aim' ? 'back' : phase === 'fight' && holding ? 'bent' : 'fwd');
  const lineOn = $derived(bobOn || phase === 'fight' || phase === 'landing');
  const linePath = $derived(phase === 'fight' || phase === 'landing' ? lineD(pose, fish.x, fish.y, T < 0.1 ? 0.5 : 0) : lineD(pose, bob.x, bob.y, phase === 'bite' ? 0.35 : 1));
  const SKY_IC: Record<SkyTime, string> = {
    pagi: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16a7 7 0 0 1 14 0Z" fill="#FFD27A" stroke="#2B2F4A" stroke-width="2" stroke-linejoin="round"/><path d="M2 19h20M12 4v3M4.5 8l2 2M19.5 8l-2 2" stroke="#2B2F4A" stroke-width="2" stroke-linecap="round"/></svg>`,
    siang: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5" fill="#F2B632" stroke="#2B2F4A" stroke-width="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" stroke="#2B2F4A" stroke-width="2" stroke-linecap="round"/></svg>`,
    sore: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 17a7 7 0 0 1 14 0Z" fill="#F3A77E" stroke="#2B2F4A" stroke-width="2" stroke-linejoin="round"/><path d="M2 17h20M6 21h12" stroke="#2B2F4A" stroke-width="2" stroke-linecap="round"/></svg>`,
    malam: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3a9 9 0 1 0 6 13A7 7 0 0 1 15 3Z" fill="#FFF4C8" stroke="#2B2F4A" stroke-width="2" stroke-linejoin="round"/></svg>`,
  };
  const REEL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.4"/><path d="M12 4v2M20 12h-2M12 20v-2M4 12h2"/><path d="M17 3.5a10 10 0 0 1 3.5 3.5"/></svg>`;
  const miniShadow = (size: string, glow = false) => `<svg viewBox="${size === 'box' ? '-20 -14 40 26' : '-30 -13 60 26'}" aria-hidden="true">${shadowSvg(size, glow)}</svg>`;
  const miniBob = (st: 'float' | 'nibble' | 'dunk') => `<svg viewBox="-30 -46 60 66" aria-hidden="true"><rect x="-30" y="4" width="60" height="16" fill="#6EB7D6"/><path d="M-30 4h60" stroke="#2B2F4A" stroke-width="2"/><g transform="translate(0 4)">${bobberSvg(st)}</g></svg>`;
  const SIZES: [string, string][] = [['S', '<15'], ['M', '15–35'], ['L', '35–60'], ['XL', '60+ cm'], ['box', 'diam = barang']];
  const METERS: Record<Dist, number> = { dekat: 6, sedang: 12, jauh: 18 };

  const waitHint = $derived.by(() => {
    if (!cast) return '';
    if (phase === 'bite') return 'Sekarang! Pelampung tenggelam, tarik!';
    const sh = cast.shadow ?? {};
    const what = sh.size === 'box' ? 'Ada bayangan <b>kotak yang diam</b>… sepertinya bukan ikan.' :
      `Ada bayangan <b>${({ S: 'kecil', M: 'sedang', L: 'besar', XL: 'sangat besar' } as Record<string, string>)[sh.size] ?? 'ikan'}${sh.glow ? ' & berkilau' : ''}</b> mendekati pelampung.`;
    return `${what} Sabar, jangan tarik dulu!`;
  });
  const status = $derived(T < 0.1 ? 'Kendur! Tahan tombol' : T < 0.7 ? 'Aman' : T < 0.9 ? 'Awas!' : 'Lepas sebentar!');
  const pull = $derived(cast?.fight?.calm ? 'Berat tapi tenang' : (cast?.fight?.power ?? 1) >= 4 ? 'Tarikan kuat' : (cast?.fight?.power ?? 1) >= 3 ? 'Tarikan sedang' : 'Tarikan ringan');
  const FAIL: Record<string, [string, string]> = {
    early: ['Kecepetan!', 'Itu baru ngicip (tuk…). Tunggu pelampung tenggelam dan tanda ! dulu, baru tarik.'],
    late: ['Telat menarik', 'Pelampung sudah tenggelam tadi. Tekan TARIK begitu tanda ! muncul.'],
    putus: ['Yah, tali putus!', 'Tegangan terlalu lama di merah. Lain kali lepas tombol sebentar saat jarum masuk merah.'],
    kendur: ['Ikannya lepas', 'Tali kendur terlalu lama. Tahan tombol supaya tali tetap tegang.'],
  };
  const failText = $derived(FAIL[why] ?? ['Ikannya lepas', 'Ikannya berhasil kabur. Coba lagi, ya!']);
  const SKY_NOTE: Record<SkyTime, string> = {
    pagi: 'Pagi: kabut tipis di kolam · Wader & Gurame Porselen lebih sering.',
    siang: 'Siang: air tenang · cocok untuk lempar jauh.',
    sore: 'Sore: langit jingga · siapa tahu ada kejutan.',
    malam: 'Malam: pelampung menyala · Lele, Belut, Betutu & Toman lebih sering.',
  };

  /* ---------- alur ---------- */
  function startAim(e?: Event) {
    e?.preventDefault();
    if (phase !== 'idle' && phase !== 'fail') return;
    if (left <= 0) { sfx.error(); toast('Jatah memancing hari ini habis. Besok lagi, ya!', 'error'); return; }
    sky = nowSky();
    why = ''; snapAt = null; shadows = []; bobOn = false; bubble = '';
    phase = 'aim'; aim = 0; aimDir = 1; last = performance.now();
    sfx.tap();
    const step = (now: number) => {
      if (phase !== 'aim') return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      aim += (aimDir * dt) / 1.1;
      if (aim >= 1) { aim = 1; aimDir = -1; } else if (aim <= 0) { aim = 0; aimDir = 1; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  function releaseAim() {
    if (phase !== 'aim') return;
    cancelAnimationFrame(raf);
    doCast(zoneAt(aim));
  }
  /** pilih zona langsung (ketuk/klik zona di bar) */
  function pickZone(z: Dist) {
    if (phase !== 'idle' && phase !== 'fail') return;
    if (left <= 0) { sfx.error(); toast('Jatah memancing hari ini habis. Besok lagi, ya!', 'error'); return; }
    aim = z === 'dekat' ? 0.2 : z === 'sedang' ? 0.57 : 0.88;
    doCast(z);
  }

  async function doCast(d: Dist) {
    clearAll();
    phase = 'cast'; dist = d; res = null; why = ''; snapAt = null; shadows = [];
    let r: any;
    try { r = await api.cast(d); } catch (e) { fail(e); phase = 'idle'; return; }
    if (phase !== 'cast') return;
    cast = r; sky = wantSky ?? r.sky ?? sky;
    try { tipsN++; localStorage.setItem('kb-mancing-n', String(tipsN)); } catch { /* abaikan */ }
    const spot = SPOT[d];
    // pelampung melayang 0,6 dtk dari ujung joran ke titik jatuh
    bobOn = true; bobState = 'float'; phase = 'wait';
    const t0 = performance.now(), from = TIP.back;
    const fly = (now: number) => {
      const k = Math.min(1, (now - t0) / 600);
      const cx = (from[0] + spot[0]) / 2 - 10, cy = Math.min(from[1], spot[1]) - 120;
      bob = { x: (1 - k) ** 2 * from[0] + 2 * (1 - k) * k * cx + k * k * spot[0], y: (1 - k) ** 2 * from[1] + 2 * (1 - k) * k * cy + k * k * spot[1] };
      if (k < 1 && (phase === 'wait' || phase === 'bite')) raf = requestAnimationFrame(fly);
    };
    raf = requestAnimationFrame(fly);
    later(600, () => { sfx.splash(); spin = true; bubble = 'sst…'; startShadows(r, spot); });
    later(r.leadMs ?? 1400, () => { spin = false; });
    for (const at of r.nibbles ?? []) {
      later(at, () => { if (phase !== 'wait') return; bobState = 'nibble'; bubble = 'tuk…'; sfx.tuk(); });
      later(at + 360, () => { if (phase === 'wait') bobState = 'float'; });
    }
    later(r.biteInMs, () => {
      if (phase !== 'wait') return;
      phase = 'bite'; bobState = 'dunk'; bubble = ''; sfx.bite();
      shadows = shadows.map((s) => (s.real ? s : { ...s, gone: true, ms: 600 }));
    });
    // tidak menarik sama sekali: tanya server (hasilnya "telat")
    later(r.biteInMs + r.windowMs + 900, () => { if (phase === 'bite') doHook(); });
  }

  let sid = 0;
  function startShadows(r: any, spot: [number, number]) {
    const sh = r.shadow ?? { size: 'M' };
    const a = Math.random() * Math.PI * 2;
    const start = { x: spot[0] + Math.cos(a) * 70, y: spot[1] + Math.abs(Math.sin(a)) * 34 + 10 };
    const end = { x: spot[0] + 8, y: spot[1] + 12 };
    const ang = sh.size === 'box' ? 0 : (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI - 180;
    const list: Shadow[] = [{ id: ++sid, ...start, size: sh.size, glow: !!sh.glow, real: true, ang, ms: 0, gone: false }];
    // bayangan pengecoh: hanya satu yang asli
    const n = Math.random() < 0.5 ? 1 : 2;
    for (let k = 0; k < n; k++) {
      const b = a + 2 + k * 1.7;
      list.push({ id: ++sid, x: spot[0] + Math.cos(b) * 58, y: spot[1] + Math.abs(Math.sin(b)) * 40 + 8, size: Math.random() < 0.5 ? 'S' : 'M', glow: false, real: false, ang: Math.random() < 0.5 ? 0 : 180, ms: 0, gone: false });
    }
    shadows = list;
    const dur = Math.max(400, r.biteInMs - 700);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      shadows = shadows.map((s) => (s.real ? { ...s, ...end, ms: dur } : s));
    }));
  }

  async function doHook() {
    if (phase !== 'wait' && phase !== 'bite') return;
    clearAll();
    phase = 'hooking';
    let r: any;
    try { r = await api.hook(cast.castId); } catch (e) { fail(e); phase = 'idle'; bobOn = false; shadows = []; return; }
    if (r.result === 'hooked') startFight();
    else lose(r.result === 'early' ? 'early' : 'late', false);
  }

  function startFight() {
    phase = 'fight'; bobOn = false; bubble = ''; shadows = [];
    T = 0.3; D = 1; holding = false; redMs = 0; slackMs = 0; jerkN = 0;
    const spot = SPOT[dist];
    fish = { x: spot[0], y: spot[1] };
    fightStart = last = performance.now();
    const F = cast.fight ?? { power: 1, minMs: 3000, slackMs: 2500 };
    const minMs = Math.max(500, F.minMs), p = F.power ?? 1;
    const tick = (now: number) => {
      if (phase !== 'fight') return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const el = now - fightStart;
      // tegangan: naik saat menggulung (ikan kuat lebih cepat), turun saat dilepas
      let t = T + (holding ? 0.15 + 0.11 * p : -0.55) * dt;
      let d = D;
      const rate = F.calm ? 0 : (0.22 + 0.08 * p) * (F.jerk ? 1.8 : 1);
      if (Math.random() < rate * dt) { jerkN++; if (holding) t += 0.12 + 0.03 * p; else d += 0.04; }
      t = Math.max(0, Math.min(1, t));
      // jarak: tidak bisa lebih cepat dari lama tarik-ulur minimal (patokan server)
      const floor = Math.max(0, 1 - el / minMs);
      d += holding ? -((t < 0.1 ? 1.1 : 2.2) / (minMs / 1000)) * dt : (0.12 / (minMs / 1000)) * dt;
      d = Math.max(floor, Math.min(1, d));
      T = t; D = d;
      redMs = t >= 0.9 ? redMs + dt * 1000 : 0;
      slackMs = t < 0.1 ? slackMs + dt * 1000 : 0;
      const wob = reduced ? 0 : Math.sin(now / 90) * (1 + p * 0.6);
      fish = { x: DOCK[0] + (spot[0] - DOCK[0]) * d + wob, y: DOCK[1] + (spot[1] - DOCK[1]) * d + (reduced ? 0 : Math.cos(now / 130) * 2) };
      if (redMs > 500) return lose('putus', true);
      if (slackMs > (F.slackMs ?? 2500)) return lose('kendur', true);
      if (d <= 0.001 && el >= minMs + 150) return land();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  async function lose(reason: string, report: boolean) {
    clearAll();
    holding = false;
    const id = cast?.castId;
    why = reason; phase = 'fail';
    if (reason === 'putus') { sfx.snap(); snapAt = { ...fish }; } else sfx.error();
    // bayangan kabur menjauh: gagal terasa "hampir dapat"
    const from = reason === 'putus' || reason === 'kendur' ? fish : { x: bob.x, y: bob.y };
    bobOn = false;
    shadows = [{ id: ++sid, x: from.x, y: from.y + 6, size: cast?.shadow?.size ?? 'M', glow: false, real: true, ang: 180, ms: 0, gone: false }];
    requestAnimationFrame(() => requestAnimationFrame(() => { shadows = shadows.map((s) => ({ ...s, x: s.x + 120, y: s.y + 50, ms: 1200, gone: true })); }));
    if (report && id) api.lost(id, reason as 'putus' | 'kendur').catch(() => {});
  }

  async function land() {
    clearAll();
    holding = false;
    phase = 'landing';
    const jump = new Promise((r) => setTimeout(r, reduced ? 0 : 700));
    let r: any;
    try { r = await api.land(cast.castId); } catch (e) { fail(e); phase = 'idle'; return; }
    await jump;
    if (r.result !== 'caught') { lose(r.reason ?? 'lepas', false); return; }
    res = r; phase = 'result';
    if (r.kind === 'treasure') sfx.pop(); else sfx.level();
    if (r.levelUp) setTimeout(() => toast(`Naik ke Lv ${r.levelUp}!`, 'good'), 900);
  }

  function again() { res = null; phase = 'idle'; why = ''; snapAt = null; shadows = []; bobOn = false; }
  function hold(on: boolean, e?: Event) {
    e?.preventDefault();
    if (phase !== 'fight') { holding = false; return; }
    holding = on;
  }

  // keyboard (desktop): Spasi = tahan/lepas, sesuai tahap
  const mine = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement;
    return e.code === 'Space' && !G.sheet && !el?.closest?.('input, textarea, select') && !(el?.closest?.('button') && !el.closest('.fishing'));
  };
  function keydown(e: KeyboardEvent) {
    if (!mine(e) || e.repeat) return;
    if (phase === 'idle' || phase === 'fail') startAim();
    else if (phase === 'wait' || phase === 'bite') doHook();
    else if (phase === 'fight') holding = true;
    else return;
    e.preventDefault();
  }
  function keyup(e: KeyboardEvent) {
    if (!mine(e)) return;
    if (phase === 'aim') releaseAim();
    else if (phase === 'fight') holding = false;
    else return;
    e.preventDefault();
  }

  onMount(() => {
    const t = setInterval(() => { if (phase === 'idle') sky = nowSky(); }, 60_000);
    return () => clearInterval(t);
  });
  onDestroy(() => {
    const id = cast?.castId;
    if (id && ['wait', 'bite', 'hooking', 'fight'].includes(phase)) api.lost(id, 'batal').catch(() => {});
    clearAll();
    G.dimNav = false;
  });

  let panelH = $state(260);
  const energi = $derived(needsNow().energi);
</script>

<svelte:window onkeydown={keydown} onkeyup={keyup} />
<div class="fishing" style="--bgc:{skyBg(sky)}; --panel-h:{panelH}px" data-sky={sky}>
  <svg class="pond" viewBox={VIEW} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Kolam pancing, {SKY_LABEL[sky].toLowerCase()}">
    {@html base}
    {#if phase === 'idle' || phase === 'aim'}{@html pondRings(aimZone)}{/if}
    {#each shadows as s (s.id)}
      <g class="sh" class:gone={s.gone} style="transform: translate({s.x}px, {s.y}px); transition-duration: {s.ms}ms">
        <g class:swim={!s.real && !reduced} style="--a:{s.ang}deg; transform: rotate({s.ang}deg)">{@html shadowSvg(s.size, s.glow)}</g>
      </g>
    {/each}
    <g transform="translate(70 180)"><g class="petg" class:lean={phase === 'fight' && holding} class:back={phase === 'aim'}><g transform="scale(.62)">{@html petHtml}</g></g></g>
    {#if phase === 'fight' && T >= 0.7}{@html sweatSvg}{/if}
    {#if lineOn}<path d={linePath} fill="none" stroke="#2B2F4A" stroke-width={phase === 'fight' ? 2.2 : 1.6}/>{/if}
    {@html rodSvg(pose, spin)}
    {#if bobOn}<g transform="translate({bob.x.toFixed(1)} {bob.y.toFixed(1)}) scale(1.3)"><g class="bob {bobState}">{@html bobberSvg(bobState, sky === 'malam')}</g></g>{/if}
    {#if phase === 'fight' || phase === 'landing'}
      <g transform="translate({fish.x.toFixed(1)} {fish.y.toFixed(1)})"><g class="fishfx" class:jump={phase === 'landing'}>{#key jerkN}<g class="jk">{@html splashSvg(!!cast?.fight?.calm)}</g>{/key}</g></g>
    {/if}
    {#if snapAt}
      <g transform="translate({snapAt.x.toFixed(0)} {snapAt.y.toFixed(0)})" class="snap"><g stroke="#FFF4B8" stroke-width="3.2" stroke-linecap="round"><path d="M-12 -12l-7 -7M0 -16v-10M12 -12l7 -7M16 0h9M-16 0h-9"/></g><text y="-34" text-anchor="middle" font-family="'Baloo 2',ui-rounded,sans-serif" font-weight="800" font-size="20" fill="#FFF4B8" stroke="#2B2F4A" stroke-width="1">PUTUS!</text></g>
    {/if}
    {#if bubble}{@html bubbleSvg(bubble)}{/if}
    {@html skyTop}
  </svg>

  {#if phase === 'result' && res}
    <CatchCard {res} onclose={again} onagain={again} onbook={() => { again(); onbook?.(); }} />
  {:else}
    <div class="panel" class:under={!!G.sheet && !active} bind:clientHeight={panelH} data-phase={phase} data-tension={T.toFixed(2)} data-dist={D.toFixed(2)}>
      {#if extra}{@render extra()}{/if}
      {#if phase === 'idle' || phase === 'aim'}
        <div class="ttl"><h2>{title}</h2><span class="chip">{@html SKY_IC[sky]} {SKY_LABEL[sky]}</span><span class="chip">Jatah {left}</span></div>
        <div>
          <div class="mlab"><b>Kekuatan lempar</b><span class="muted">tahan, lepas di zona</span></div>
          <div class="bar3" role="group" aria-label="Pilih jarak lempar">
            {#each ZONES as z}
              <button class="zone" class:on={aimZone === z.k} style="flex:{z.w}; --zc:{z.bg}" onclick={() => pickZone(z.k)} aria-label="Lempar {DIST_LABEL[z.k].toLowerCase()} ({costs[z.k] ?? '?'} energi)">{DIST_LABEL[z.k]}</button>
            {/each}
            {#if phase === 'aim'}<span class="needle" style="left:{(aim * 100).toFixed(1)}%"></span>{/if}
          </div>
          <div class="hints3">{#each ZONES as z}<span style="flex:{z.w}">{z.hint}</span>{/each}</div>
        </div>
        <button class="btn hot big press-btn" disabled={left <= 0} onpointerdown={startAim} onpointerup={releaseAim} onpointercancel={releaseAim} onpointerleave={releaseAim} oncontextmenu={(e) => e.preventDefault()}>
          {left <= 0 ? 'Jatah hari ini habis' : phase === 'aim' ? `Lepas di ${DIST_LABEL[zoneAt(aim)]}!` : 'Tahan… lalu lepas!'}
        </button>
        <p class="note">Energi per lempar: dekat {costs.dekat ?? '?'} · sedang {costs.sedang ?? '?'} · jauh {costs.jauh ?? '?'}{#if energi < (costs.dekat ?? 0)} · <b class="warn">energi {G.me?.pet?.name} kurang</b>{/if}</p>
        <div class="row">
          {#if onexit}<button class="btn sm" onclick={onexit}>{@html I.back} {exitLabel}</button>{/if}
          {#if onbook}<button class="btn sm" onclick={onbook}>{@html I.book} Buku Ikan</button>{/if}
        </div>
      {:else if phase === 'cast' || phase === 'wait' || phase === 'bite' || phase === 'hooking'}
        <div class="ttl"><h2>{phase === 'bite' ? 'Sambar!' : 'Ulur… tunggu'}</h2><span class="chip">{DIST_LABEL[dist]}</span><span class="chip">{@html SKY_IC[sky]} {SKY_LABEL[sky]}</span></div>
        {#if cast}<p class="hint">{@html waitHint}</p>{:else}<p class="hint">Melempar kail…</p>{/if}
        {#if showTips}
          <div class="seq" aria-label="Urutan: ngapung, ngicip, sambar">
            <div class="st" class:on={phase === 'wait' && bobState === 'float'}>{@html miniBob('float')}<b>ngapung</b><small>tunggu</small></div><span class="ar">›</span>
            <div class="st" class:on={bobState === 'nibble'}>{@html miniBob('nibble')}<b>tuk…</b><small>jangan tarik</small></div><span class="ar">›</span>
            <div class="st hot" class:on={phase === 'bite'}>{@html miniBob('dunk')}<b>BLUP!</b><small>tarik!</small></div>
          </div>
        {:else if cast}
          <div class="leg">{#each SIZES as [k, t]}<span class:on={cast.shadow?.size === k}>{@html miniShadow(k, k === cast.shadow?.size && cast.shadow?.glow)}{t}</span>{/each}</div>
        {/if}
        <button class="btn pull" class:hot={phase === 'bite'} disabled={phase === 'cast' || phase === 'hooking'} onpointerdown={(e) => { e.preventDefault(); doHook(); }} onclick={(e) => { if (e.detail === 0) doHook(); }}>{phase === 'bite' ? 'TARIK!' : phase === 'hooking' ? 'Menarik…' : 'Tunggu…'}</button>
        {#if phase === 'bite'}<p class="note center">Tekan dalam {((cast?.windowMs ?? 1200) / 1000).toFixed(1).replace('.', ',')} detik!</p>{/if}
      {:else if phase === 'fight' || phase === 'landing'}
        <div class="ttl"><h2>{phase === 'landing' ? 'Hampir…' : 'Tarik-ulur!'}</h2><span class="chip warmc">{pull}</span></div>
        <div>
          <div class="mlab"><b>Tegangan tali</b><span class="st-t" class:bad={T >= 0.7 || T < 0.1}>{status}</span></div>
          <div class="bar3 tens" aria-hidden="true"><i style="flex:10;background:#DDE3EA"></i><i style="flex:60;background:#CDEBD0">aman</i><i style="flex:20;background:#F9E3A0"></i><i style="flex:10;background:#F29C86"></i><span class="needle" style="left:{(T * 100).toFixed(1)}%"></span></div>
          <div class="hints2"><span>kendur</span><span>putus</span></div>
        </div>
        <div>
          <div class="mlab"><b>Jarak ke dermaga</b><span class="muted">tinggal {Math.max(0, Math.round(D * METERS[dist]))} m</span></div>
          <div class="dist" aria-hidden="true"><span class="pier"></span><span class="tr" style="width:calc({(D * 100).toFixed(1)}% - {(D * 50).toFixed(0)}px)"></span><span class="fz" style="left:calc(34px + {(D * 100).toFixed(1)}% - {(D * 62).toFixed(0)}px)">{@html miniShadow(cast?.shadow?.size === 'box' ? 'box' : 'M')}</span></div>
        </div>
        <button class="btn hot big hold" class:press={holding} disabled={phase === 'landing'} onpointerdown={(e) => hold(true, e)} onpointerup={() => hold(false)} onpointercancel={() => hold(false)} onpointerleave={() => hold(false)} oncontextmenu={(e) => e.preventDefault()}>{@html REEL} Tahan = gulung</button>
      {:else if phase === 'fail'}
        <div class="ttl"><h2>{failText[0]}</h2><span class="chip">{@html SKY_IC[sky]} {SKY_LABEL[sky]}</span></div>
        <p class="hint">{failText[1]}</p>
        <div class="fails">{#each [['putus', 'Tali putus'], ['kendur', 'Kendur → lepas'], ['early', 'Kecepetan (ngicip)'], ['late', 'Telat menarik']] as [k, t]}<span class:on={why === k}>{t}</span>{/each}</div>
        <p class="note">{SKY_NOTE[sky]}</p>
        <div class="row">
          {#if onexit}<button class="btn sm" onclick={onexit}>{@html I.back} {exitLabel}</button>{/if}
          {#if onbook}<button class="btn sm" onclick={onbook}>{@html I.book} Buku</button>{/if}
          <button class="btn sm hot" disabled={left <= 0} onclick={again}>Lempar lagi</button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .fishing { position: absolute; inset: 0; background: var(--bgc, #A9D18A); transition: background .6s; }
  /* bagian atas adegan hanya rumput, jadi boleh sedikit di bawah HUD & panel supaya kolam sebesar mungkin */
  .pond { position: absolute; left: 0; right: 0; top: calc(var(--safe-t) + 56px); width: 100%; height: calc(100% - var(--safe-t) - var(--safe-b) - 56px - 86px - var(--panel-h) + 30px); overflow: visible; }
  .pond :global(.sh) { transition-property: transform, opacity; transition-timing-function: linear; }
  .pond :global(.sh.gone) { opacity: 0; }
  .pond :global(.swim) { animation: swim 3.2s ease-in-out infinite; }
  .pond :global(.bob.float) { animation: float 1.2s ease-in-out infinite; }
  .pond :global(.bob.nibble) { animation: nib .36s ease-out; }
  .pond :global(.reel.spin) { animation: spin .4s linear infinite; }
  .pond :global(.petg) { transition: transform .25s; }
  .pond :global(.petg.lean) { transform: rotate(-7deg); }
  .pond :global(.petg.back) { transform: rotate(5deg); }
  .pond :global(.jk) { animation: jerk .3s ease-out; }
  .pond :global(.fishfx.jump) { animation: jump .7s ease-out forwards; }
  .pond :global(.fly) { animation: blinkfly 2.6s ease-in-out infinite; }
  .pond :global(.fly.f1) { animation-delay: .9s; } .pond :global(.fly.f2) { animation-delay: 1.7s; }
  .pond :global(.mist) { animation: mist 9s ease-in-out infinite alternate; }
  .pond :global(.mist.m2) { animation-duration: 12s; }
  .pond :global(.snap) { animation: pop .4s; }
  .panel { position: absolute; z-index: 8; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-b) + 86px); width: min(440px, calc(100vw - 20px)); background: var(--paper); border: 3px solid var(--ink); border-radius: 20px; box-shadow: 0 5px 0 var(--ink); padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 9px; }
  /* panel lain (mis. Buku Ikan) sedang terbuka: panel mancing tidak mengintip di sampingnya */
  .panel.under { visibility: hidden; }
  h2 { margin: 0; font-size: 22px; font-weight: 800; line-height: 1.1; }
  .ttl { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .ttl h2 { margin-right: auto; }
  .chip { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 800; line-height: 1.4; padding: 2px 9px; border-radius: 999px; background: rgba(43, 47, 74, .08); color: #4A4F66; white-space: nowrap; }
  .chip :global(svg) { width: 15px; height: 15px; flex: none; }
  .chip.warmc { background: #FBE0D6; color: var(--ink); }
  .row { display: flex; gap: 6px; }
  .row .btn { flex: 1 1 0; }
  .big { min-height: 58px; font-size: 20px; width: 100%; font-weight: 800; touch-action: none; }
  .pull { min-height: 78px; font-size: 27px; width: 100%; font-weight: 800; touch-action: none; }
  .hold.press, .press-btn:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--ink); background: #FFD36B; }
  .note { margin: 0; font-size: 13.5px; font-weight: 600; color: var(--muted); }
  .note.center { text-align: center; }
  .warn { color: #A93A27; }
  .hint { margin: 0; font-size: 15px; font-weight: 600; }
  .mlab { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 0 8px; font-size: 14px; font-weight: 700; margin-bottom: 8px; }
  .mlab b { font-weight: 800; }
  .st-t { font-weight: 800; color: var(--ok); }
  .st-t.bad { color: #C0392B; }
  .bar3 { position: relative; display: flex; height: 34px; border: 2.5px solid var(--ink); border-radius: 12px; background: #fff; }
  .bar3 > i, .zone { display: flex; align-items: center; justify-content: center; min-width: 0; font-style: normal; font-size: 13px; font-weight: 800; border: 0; border-right: 2px solid rgba(43, 47, 74, .35); padding: 0; }
  .zone { background: var(--zc); cursor: pointer; font-family: var(--font); color: var(--ink); }
  .zone.on { box-shadow: inset 0 0 0 3px var(--ink); }
  .bar3 > :first-child { border-radius: 9px 0 0 9px; }
  .bar3 > .zone:nth-child(3), .bar3 > i:last-of-type { border-right: 0; border-radius: 0 9px 9px 0; }
  .needle { position: absolute; top: -6px; bottom: -6px; width: 6px; margin-left: -3px; background: var(--ink); border-radius: 3px; box-shadow: 0 0 0 2px #fff; pointer-events: none; }
  .needle::before { content: ''; position: absolute; left: -6px; top: -4px; border: 9px solid transparent; border-top: 10px solid var(--ink); border-bottom: 0; }
  .hints3, .hints2 { display: flex; font-size: 12px; font-weight: 700; color: var(--muted); margin-top: 4px; line-height: 1.1; }
  .hints3 span { text-align: center; min-width: 0; padding: 0 2px; }
  .hints2 { justify-content: space-between; }
  .leg { display: flex; gap: 5px; flex-wrap: wrap; background: #DCEFF7; border: 2px solid var(--ink); border-radius: 14px; padding: 6px 8px; }
  .leg span { display: flex; align-items: center; gap: 2px; font-size: 12.5px; font-weight: 800; background: rgba(255, 255, 255, .55); border-radius: 9px; padding: 0 6px 0 2px; white-space: nowrap; }
  .leg span :global(svg) { width: 34px; height: 15px; }
  .leg span.on { background: #FFF3CF; box-shadow: 0 0 0 2px var(--ink); }
  .seq { display: flex; align-items: flex-end; justify-content: space-between; background: #DCEFF7; border: 2px solid var(--ink); border-radius: 14px; padding: 4px 6px 5px; }
  .seq .st { display: flex; flex-direction: column; align-items: center; flex: 1 1 0; min-width: 0; border-radius: 10px; padding: 2px 0; text-align: center; }
  .seq .st :global(svg) { width: 50px; height: 54px; }
  .seq b { font-size: 14px; font-weight: 800; line-height: 1; }
  .seq small { font-size: 11.5px; font-weight: 700; color: var(--muted); line-height: 1.1; }
  .seq .st.on { background: #FFF3CF; box-shadow: 0 0 0 2.5px var(--low); }
  .seq .st.hot.on b { color: #C0392B; }
  .seq .ar { font-size: 20px; font-weight: 800; color: var(--muted); padding-bottom: 22px; flex: none; }
  .dist { position: relative; height: 30px; border: 2.5px solid var(--ink); border-radius: 12px; background: #BFE3F2; overflow: hidden; }
  .dist .pier { position: absolute; left: 0; top: 0; bottom: 0; width: 30px; background: #B98B4E; border-right: 2.5px solid var(--ink); }
  .dist .tr { position: absolute; top: 50%; left: 34px; height: 0; border-top: 2.5px dashed var(--ink); opacity: .45; }
  .dist .fz { position: absolute; top: 1px; width: 46px; height: 24px; }
  .dist .fz :global(svg) { width: 46px; height: 24px; }
  .fails { display: flex; gap: 5px; flex-wrap: wrap; }
  .fails span { font-size: 12.5px; font-weight: 800; padding: 1px 8px 0; border-radius: 999px; background: rgba(43, 47, 74, .07); color: var(--muted); border: 1.5px solid rgba(43, 47, 74, .2); }
  .fails span.on { background: #F8C9BE; color: var(--ink); border-color: var(--ink); }
  @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(2.5px); } }
  @keyframes nib { 0% { transform: translateY(0); } 40% { transform: translateY(4px); } 100% { transform: translateY(0); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes swim { 0%, 100% { transform: rotate(var(--a)) translateX(0); } 50% { transform: rotate(var(--a)) translateX(-22px); } }
  @keyframes jerk { 0% { transform: translate(-6px, -3px) scale(1.08); } 100% { transform: none; } }
  @keyframes jump { 0% { transform: translate(0, 0); } 45% { transform: translate(-30px, -70px) rotate(-25deg); } 100% { transform: translate(-60px, -20px) scale(.6); opacity: 0; } }
  @keyframes blinkfly { 0%, 100% { opacity: .25; } 50% { opacity: 1; } }
  @keyframes mist { from { transform: translateX(-14px); } to { transform: translateX(14px); } }
  /* layar lebar: panel di kanan, kolam besar di kiri */
  /* HP pendek: panel lebih ringkas supaya kolam tetap terlihat besar */
  @media (max-height: 720px) and (max-width: 899px) {
    .panel { padding: 9px 11px 11px; gap: 6px; }
    h2 { font-size: 20px; }
    .big { min-height: 48px; font-size: 18px; }
    .pull { min-height: 60px; font-size: 24px; }
    .hint { font-size: 14px; }
    .seq .st :global(svg) { width: 40px; height: 42px; }
    .seq .ar { padding-bottom: 16px; }
    .mlab { margin-bottom: 5px; }
  }
  @media (min-width: 900px) and (min-aspect-ratio: 1/1) {
    .pond { top: calc(var(--safe-t) + 40px); left: 0; right: 480px; width: calc(100% - 480px); height: calc(100% - var(--safe-t) - 40px - 76px); }
    .panel { left: auto; right: 24px; transform: none; bottom: 24px; width: 440px; padding: 16px 18px 18px; gap: 11px; }
    h2 { font-size: 26px; }
    .hint { font-size: 16px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .pond :global(.swim), .pond :global(.bob.float), .pond :global(.reel.spin), .pond :global(.fly), .pond :global(.mist), .pond :global(.jk), .pond :global(.rays) { animation: none; }
  }
</style>
