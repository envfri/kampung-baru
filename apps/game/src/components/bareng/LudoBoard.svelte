<script lang="ts">
  // Papan Ludo (2–4 pemain): papan 15×15 diputar supaya kandangmu di kiri bawah, tiap kandang menampilkan pet pemiliknya.
  // Bidak yang bisa jalan menyala (ketuk untuk jalan), bidak berjalan kotak demi kotak, yang dimakan terbang pulang ke kandang.
  // Kepala bidak beda bentuk per warna (bulat, kotak, belah ketupat, segitiga) supaya tidak hanya dibedakan warnanya.
  import { onDestroy, untrack } from 'svelte';
  import {
    renderPet, shade, textW, INK, LUDO_BASES, LUDO_COLORS, LUDO_COLOR_NAMES, LUDO_HOME, LUDO_LANE, LUDO_LANES, LUDO_PATH, LUDO_SAFE,
    ludoCell, ludoFrames, ludoHomeCount, ludoPlan, ludoProgress, ludoTarget,
  } from '@kb/shared';
  import { BG, moveGame, serverNow, startGame } from '../../lib/bareng.svelte';
  import { wearItems } from '../../lib/game.svelte';
  import { sfx } from '../../lib/sfx';
  let { g, me }: { g: any; me: string } = $props();

  const N = 24, W = N * 15;
  const L = $derived(g?.ludo ?? { seat: {}, tok: {}, perSeat: 2, movable: [], finished: [], phase: 'roll', roll: null, cfg: {} });
  const player = $derived(g.players.some((x: any) => x.id === me && !x.left));
  /** kursi yang diputar ke kiri bawah (penonton: tanpa putaran, merah di kiri bawah) */
  const mySeat = $derived(player ? L.seat?.[me] ?? 3 : 3);
  const rot = $derived((3 - mySeat + 4) % 4);
  const seatOf = (id: string): number => L.seat?.[id] ?? 0;
  const nameOf = (id: string) => g.players.find((x: any) => x.id === id)?.name ?? 'Teman';
  const who = (id: string) => (id === me ? 'Kamu' : nameOf(id));
  // putar searah jarum jam: kotak (c, r) → (14 - r, c); titik (x, y) → (15 - y, x)
  const rc = (c: number, r: number): [number, number] => { let x = c, y = r; for (let k = 0; k < rot; k++) [x, y] = [14 - y, x]; return [x, y]; };
  const rp = (x0: number, y0: number): [number, number] => { let x = x0, y = y0; for (let k = 0; k < rot; k++) [x, y] = [15 - y, x]; return [x, y]; };
  const f1 = (v: number) => Math.round(v * 10) / 10;
  /** pojok kiri atas kandang di layar (satuan kotak) */
  const baseXY = (s: number): [number, number] => { const [c0, r0] = LUDO_BASES[s], a = rp(c0, r0), b = rp(c0 + 6, r0 + 6); return [Math.min(a[0], b[0]), Math.min(a[1], b[1])]; };
  /** tempat bidak di kandang (satuan kotak, relatif pojok kandang) */
  const spots = (n: number): [number, number][] => n <= 1 ? [[3, 4.05]] : n === 2 ? [[2.05, 4.05], [3.95, 4.05]] : n === 3 ? [[1.6, 4.05], [3, 4.05], [4.4, 4.05]] : [[1.45, 4.05], [2.52, 4.05], [3.58, 4.05], [4.65, 4.05]];
  /** segitiga rumah tiap kursi (titik tengah) */
  const HOME_AT: [number, number][] = [[6.75, 7.5], [7.5, 6.75], [8.25, 7.5], [7.5, 8.25]];
  /** titik pijak bidak (px papan) dan kunci kotaknya (untuk bidak bertumpuk) */
  function spot(s: number, r: number, k: number): { x: number; y: number; key: string } {
    if (r < 0) { const [bx, by] = baseXY(s), sp = spots(L.perSeat)[k] ?? [3, 4.05]; return { x: (bx + sp[0]) * N, y: (by + sp[1]) * N, key: `b${s}:${k}` }; }
    if (r >= LUDO_HOME) { const [x, y] = rp(...HOME_AT[s]); return { x: x * N, y: y * N, key: `h${s}` }; }
    const [c, rr] = rc(...(ludoCell(s, r) as [number, number]));
    return { x: c * N + N / 2, y: rr * N + N / 2, key: `c${c},${rr}` };
  }

  /* ---------------- gambar bidak & papan statis ---------------- */
  const HEAD = [
    `<circle cx="12" cy="8.4" r="4.9"/>`,
    `<rect x="7.4" y="3.8" width="9.2" height="9.2" rx="2"/>`,
    `<path d="M12 2.6 17.6 8.4 12 14.2 6.4 8.4Z"/>`,
    `<path d="M12 2.8 17.4 12.8H6.6Z"/>`,
  ];
  /** bidak (kotak 24×24, titik pijak di 12,21) */
  const tokenSVG = (s: number) => {
    const col = LUDO_COLORS[s];
    return `<path d="M5.2 20.2C5.6 15.2 8.4 13.4 9.6 11.8h4.8C15.6 13.4 18.4 15.2 18.8 20.2Q12 22.6 5.2 20.2Z" fill="${col}" stroke="${INK}" stroke-width="1.7" stroke-linejoin="round"/>`
      + `<g fill="${col}" stroke="${INK}" stroke-width="1.7" stroke-linejoin="round">${HEAD[s]}</g>`
      + `<ellipse cx="10.4" cy="7.2" rx="1.5" ry="1" fill="#FFFFFF" opacity=".75"/><path d="M8 17.4q4 1.2 8 0" stroke="#FFFFFF" stroke-opacity=".55" stroke-width="1.3" fill="none" stroke-linecap="round"/>`;
  };
  const petInner = (x: any) => (x?.pet ? renderPet({ color: x.pet.color ?? '#F2EEE3', ear: x.pet.ear ?? 'tunas', pattern: x.pet.pattern, eyes: x.pet.eyes, tail: x.pet.tail } as any, wearItems(x.pet.wear ?? [])) : '');
  const star = (cx: number, cy: number, R: number, fill: string) => {
    let d = '';
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? R * 0.45 : R; d += `${k ? 'L' : 'M'}${f1(cx + Math.cos(a) * rr)} ${f1(cy + Math.sin(a) * rr)}`; }
    return `<path d="${d}Z" fill="${fill}" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>`;
  };
  const used = $derived(new Set(Object.values(L.seat ?? {}) as number[]));
  const colOf = (s: number) => (used.has(s) ? LUDO_COLORS[s] : '#C9C4B6');
  /** papan statis digambar ulang hanya bila putaran, kursi, jumlah bidak, atau pet pemain berubah */
  const boardKey = $derived(JSON.stringify([rot, L.perSeat, L.seat, g.players.map((p: any) => [p.id, p.left, p.pet])]));
  const boardSvg = $derived.by(() => { void boardKey; return untrack(drawBoard); });
  function drawBoard() {
    const cellRect = (c: number, r: number, fill: string) => { const [x, y] = rc(c, r); return `<rect x="${x * N}" y="${y * N}" width="${N}" height="${N}" fill="${fill}" stroke="${INK}" stroke-opacity=".55" stroke-width="1"/>`; };
    // bingkai tikar anyaman
    let s = `<rect x="-5" y="-5" width="${W + 10}" height="${W + 10}" rx="10" fill="#D9B77A" stroke="${INK}" stroke-width="2.5"/>`
      + `<rect x="-2.4" y="-2.4" width="${W + 4.8}" height="${W + 4.8}" rx="7" fill="none" stroke="#B88E4E" stroke-width="1.6" stroke-dasharray="4 3"/>`
      + `<rect x="0" y="0" width="${W}" height="${W}" fill="#FFFDF7"/>`;
    for (let k = 0; k < 4; k++) {
      const [bx, by] = baseXY(k), x = bx * N, y = by * N, col = colOf(k);
      s += `<rect x="${x}" y="${y}" width="${6 * N}" height="${6 * N}" fill="${col}" stroke="${INK}" stroke-width="2"/>`;
      s += `<rect x="${x + 0.55 * N}" y="${y + 0.55 * N}" width="${4.9 * N}" height="${4.9 * N}" rx="${0.7 * N}" fill="${used.has(k) ? '#FFF8E6' : '#EFECE4'}" stroke="${INK}" stroke-width="1.6"/>`;
      for (const [a, b] of spots(L.perSeat || 2)) s += `<circle cx="${f1(x + a * N)}" cy="${f1(y + b * N)}" r="${0.42 * N}" fill="${shade(col, 0.55)}" stroke="${INK}" stroke-opacity=".5" stroke-width="1.2"/>`;
      const owner = g.players.find((p: any) => L.seat?.[p.id] === k);
      if (owner?.pet) s += `<svg x="${f1(x + 1.85 * N)}" y="${f1(y + 0.8 * N)}" width="${2.3 * N}" height="${2.3 * N}" viewBox="-66 -124 132 130" opacity="${owner.left ? 0.35 : 1}">${petInner(owner)}</svg>`;
      else if (!used.has(k)) s += `<text x="${x + 3 * N}" y="${y + 2.4 * N}" text-anchor="middle" font-size="${0.62 * N}" font-weight="800" fill="#6F7489">kosong</text>`;
    }
    LUDO_PATH.forEach(([c, r], i) => {
      const st = [0, 13, 26, 39].indexOf(i);
      s += cellRect(c, r, st >= 0 ? colOf(st) : '#FFFDF7');
      if (LUDO_SAFE.includes(i)) { const [x, y] = rc(c, r); s += star(x * N + N / 2, y * N + N / 2, N * 0.34, st >= 0 ? '#FFFDF7' : '#FFE9A8'); }
    });
    for (let k = 0; k < 4; k++) LUDO_LANES[k].forEach(([c, r]) => (s += cellRect(c, r, shade(colOf(k), 0.18))));
    // tengah: 4 segitiga rumah (atas = kuning, kanan = biru, bawah = merah, kiri = hijau)
    const tri: [number, number][][] = [[[6, 6], [9, 6], [7.5, 7.5]], [[9, 6], [9, 9], [7.5, 7.5]], [[9, 9], [6, 9], [7.5, 7.5]], [[6, 9], [6, 6], [7.5, 7.5]]];
    [1, 2, 3, 0].forEach((seat, i) => { s += `<polygon points="${tri[i].map(([c, r]) => rp(c, r)).map(([x, y]) => `${f1(x * N)},${f1(y * N)}`).join(' ')}" fill="${colOf(seat)}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`; });
    const [cx, cy] = rp(7.5, 7.5);
    s += `<circle cx="${cx * N}" cy="${cy * N}" r="${0.62 * N}" fill="#FFFDF7" stroke="${INK}" stroke-width="1.6"/>`;
    s += `<path d="M${f1(cx * N - 0.36 * N)} ${f1(cy * N + 0.05 * N)}l${f1(0.36 * N)} ${f1(-0.3 * N)}l${f1(0.36 * N)} ${f1(0.3 * N)}v${f1(0.3 * N)}h${f1(-0.72 * N)}Z" fill="#E0583F" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`;
    return s + `<rect x="0" y="0" width="${W}" height="${W}" fill="none" stroke="${INK}" stroke-width="2.4"/>`;
  }

  /* ---------------- langkah demi langkah ---------------- */
  const clone = (t: Record<string, number[]>) => Object.fromEntries(Object.entries(t ?? {}).map(([id, l]) => [id, [...l]]));
  let shown = $state<Record<string, number[]>>(untrack(() => clone(g.ludo?.tok ?? {})));
  let hop = $state<Record<string, number>>({});
  let flying = $state<Record<string, boolean>>({});
  let burst = $state<{ x: number; y: number } | null>(null);
  let face = $state<number>(untrack(() => g.last?.roll ?? 6));
  let rolling = $state(false), playing = $state(false), asking = $state(false);
  /** momen yang sedang diputar (untuk baris keterangan) */
  let moment = $state<'' | 'roll' | 'walk' | 'pass' | 'capture' | 'home'>('');
  let actor = $state('');
  let lastAt = untrack(() => g.last?.at ?? 0), gen = 0;
  // papan ditutup (keluar / selesai): animasi yang masih berjalan berhenti
  onDestroy(() => { gen++; });
  const wait = (ms: number, my: number) => new Promise<boolean>((r) => setTimeout(() => r(my === gen), ms));
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  async function animate(last: any, my: number) {
    playing = true; actor = last.by;
    const frames = last.pick ? [{ kind: 'roll', r: 0, ms: 700 }] : ludoFrames(last, { dice: !!last.dice, wait: !!last.dice && last.token !== null, stepMs: L.cfg?.stepMs });
    const key = `${last.by}:${last.token}`;
    for (const f of frames) {
      if (f.kind === 'roll') {
        moment = 'roll'; rolling = true;
        for (let k = 0; k < 8; k++) { face = 1 + ((face + 1 + Math.floor(Math.random() * 4)) % 6); if (!(await wait(f.ms / 8, my))) return; }
        face = last.roll; rolling = false; sfx.pop();
        continue;
      }
      if (f.kind === 'wait') { if (!(await wait(f.ms, my))) return; continue; }
      if (f.kind === 'pass') { moment = 'pass'; sfx.error(); if (!(await wait(f.ms, my))) return; continue; }
      if (f.kind === 'out' || f.kind === 'step') {
        moment = 'walk';
        if (shown[last.by]) shown[last.by][last.token] = f.r;
        hop[key] = (hop[key] ?? 0) + 1;
        sfx.tap();
      } else if (f.kind === 'capture') {
        moment = 'capture';
        burst = spot(seatOf(last.by), last.to, 0);
        for (const c of last.capture ?? []) { flying[`${c.id}:${c.k}`] = true; if (shown[c.id]) shown[c.id][c.k] = -1; }
        sfx.bite();
      } else if (f.kind === 'home') {
        moment = 'home';
        if (shown[last.by]) shown[last.by][last.token] = LUDO_HOME;
        sfx.level();
      }
      if (!(await wait(f.ms, my))) return;
      burst = null;
    }
    if (my === gen) { playing = false; moment = ''; flying = {}; }
  }
  $effect(() => {
    if (!g) return;
    const last = g.last, tok = g.ludo?.tok ?? {};
    untrack(() => {
      if (!last || last.at === lastAt) { if (!playing) shown = clone(tok); if (!rolling && L.roll) face = L.roll; return; }
      lastAt = last.at;
      const my = ++gen;
      burst = null; flying = {}; rolling = false;
      const late = serverNow() - (last.at ?? 0);
      if (reduced || late > (last.anim ?? 0) + 800) { shown = clone(tok); face = last.roll ?? face; playing = false; moment = ''; return; }
      // keadaan sebelum langkah: bidak yang jalan di tempat asal, bidak yang dimakan masih di kotak tujuan
      const before = clone(tok);
      if (last.token !== null && last.token !== undefined && before[last.by]) before[last.by][last.token] = last.from;
      for (const c of last.capture ?? []) if (before[c.id]) before[c.id][c.k] = c.from;
      shown = before;
      animate(last, my).then(() => { if (my === gen && g) shown = clone(g.ludo?.tok ?? {}); });
    });
  });

  /* ---------------- giliran, waktu, pilihan ---------------- */
  let tick = $state(0);
  $effect(() => { const t = setInterval(() => (tick = serverNow()), 250); return () => clearInterval(t); });
  const myTurn = $derived(player && g.phase === 'main' && g.turn === me);
  const canRoll = $derived(myTurn && L.phase === 'roll' && !playing && !asking);
  const canPick = $derived(myTurn && L.phase === 'pick' && !playing && !asking);
  const movable = $derived(canPick ? new Set<number>(L.movable ?? []) : new Set<number>());
  const totalMs = $derived(L.phase === 'pick' ? L.cfg?.pickMs ?? 8000 : L.cfg?.rollMs ?? 10_000);
  const leftMs = $derived((void tick, Math.max(0, Math.min(totalMs, g.turnUntil - serverNow()))));
  const secs = $derived(Math.ceil(leftMs / 1000));
  async function roll() {
    if (!canRoll) return;
    asking = true; sfx.tap();
    await moveGame(g.id, { roll: true });
    asking = false;
  }
  async function pick(k: number) {
    if (!movable.has(k)) return;
    asking = true; sfx.tap();
    await moveGame(g.id, { token: k });
    asking = false;
  }
  /** pratinjau tujuan bidak yang menyala: Makan! · Aman · Pulang! pas N */
  const previews = $derived.by(() => {
    if (!canPick || L.roll === null) return [];
    const out: { x: number; y: number; ring: 'cap' | 'safe' | 'home'; label: string; col: string; tx: number; ty: number }[] = [];
    for (const k of L.movable ?? []) {
      const m = ludoPlan(L.tok, L.seat, me, k, L.roll);
      if (!m) continue;
      const d = spot(mySeat, m.to, 0);
      if (m.capture.length) out.push({ x: d.x, y: d.y, ring: 'cap', label: 'Makan!', col: '#E0583F', tx: d.x, ty: d.y - N * 0.55 });
      else if (m.home) { const from = spot(mySeat, m.from, k); out.push({ x: d.x, y: d.y, ring: 'home', label: `Pulang! pas ${L.roll}`, col: '#2E8A57', tx: from.x, ty: from.y - N * 0.95 }); }
      else if (m.safe && m.to < LUDO_LANE && m.from >= 0) out.push({ x: d.x, y: d.y, ring: 'safe', label: 'Aman', col: '#2E8A57', tx: d.x, ty: d.y - N * 0.55 });
    }
    return out;
  });
  /** bidakku di dekat rumah yang tidak bisa jalan dengan dadu terakhir: "butuh N" */
  const needs = $derived.by(() => {
    const last = g.last;
    if (!player || !last || last.by !== me) return [];
    // saat memilih bidak (dadu sekarang) atau sesudah giliranku lewat karena tidak ada yang bisa jalan
    const r0 = canPick ? L.roll : last.pass && (!playing || moment === 'pass') ? last.roll : null;
    if (!r0) return [];
    return (L.tok?.[me] ?? []).map((r: number, k: number) => ({ r, k })).filter((t: any) => t.r >= 50 && t.r < LUDO_HOME && ludoTarget(t.r, r0) === null).map((t: any) => ({ ...spot(mySeat, t.r, t.k), need: LUDO_HOME - t.r, k: t.k }));
  });
  const tagW = (txt: string, fs: number) => textW(txt, fs) + 16;
  const FS = 13;
  /** kotak label selalu di dalam papan */
  const tagAt = (x: number, y: number, txt: string) => { const w = tagW(txt, FS), h = FS * 1.6 + 2; return { x: Math.max(w / 2 + 1, Math.min(W - w / 2 - 1, x)), y: Math.max(h + 1, y), w, h }; };

  /* ---------------- bidak yang digambar (bertumpuk rapi per kotak) ---------------- */
  const pieces = $derived.by(() => {
    const groups = new Map<string, { x: number; y: number; list: { id: string; k: number; s: number; r: number }[] }>();
    for (const p of g.players) {
      const list = shown[p.id];
      if (!list || p.left && !L.finished?.includes(p.id)) continue;
      list.forEach((r, k) => {
        const s = seatOf(p.id), at = spot(s, r, k);
        if (!groups.has(at.key)) groups.set(at.key, { x: at.x, y: at.y, list: [] });
        groups.get(at.key)!.list.push({ id: p.id, k, s, r });
      });
    }
    const out: { id: string; k: number; s: number; x: number; y: number; sc: number; home: boolean; base: boolean }[] = [];
    for (const gr of groups.values()) {
      const n = gr.list.length;
      gr.list.forEach((t, i) => {
        const home = t.r >= LUDO_HOME, base = t.r < 0;
        const off = n > 1 && !base ? (i - (n - 1) / 2) * N * (home ? 0.42 : 0.34) : 0;
        const sc = (home ? 0.62 : n > 1 && !base ? 0.82 : 1) * 1.3;
        out.push({ id: t.id, k: t.k, s: t.s, x: gr.x + off, y: gr.y - 1.5 + (n > 1 && !base ? -Math.abs(off) * 0.15 : 0), sc, home, base });
      });
    }
    // yang jalan & yang menyala digambar paling atas
    return out.sort((a, b) => a.y - b.y);
  });

  /* ---------------- teks ---------------- */
  const capNames = (last: any) => [...new Set((last?.capture ?? []).map((c: any) => nameOf(c.id)))].join(' & ');
  const log = $derived.by((): { t: string; hot?: boolean } => {
    const last = g.last;
    if (g.phase !== 'main') return { t: g.log?.at(-1) ?? '' };
    if (playing && last) {
      if (moment === 'roll') return { t: `${who(actor)} melempar dadu…` };
      if (moment === 'pass') {
        if (last.void) return { t: `${who(actor)} dapat 6 tiga kali: lemparannya hangus!`, hot: true };
        const need = actor === me ? needs[0]?.need : 0;
        return { t: need ? `Dapat ${last.roll}, padahal bidakmu butuh ${need} untuk pulang. Giliran lewat.` : `${who(actor)} dapat ${last.roll}, tidak ada bidak yang bisa jalan.`, hot: true };
      }
      if (moment === 'capture') {
        if (actor === me) return { t: `Kamu memakan bidak ${capNames(last)}!`, hot: true };
        const mine = (last.capture ?? []).some((c: any) => c.id === me);
        return { t: mine ? `${nameOf(actor)} memakan bidakmu! Bidakmu pulang ke kandang.` : `${nameOf(actor)} memakan bidak ${capNames(last)}!`, hot: true };
      }
      if (moment === 'home') return { t: `Bidak ${actor === me ? 'kamu' : nameOf(actor)} sampai di rumah!` };
      return { t: `${who(actor)} dapat ${last.roll}, jalan…` };
    }
    if (canPick) return { t: `Kamu dapat ${L.roll}! Ketuk bidak yang menyala.` };
    if (myTurn && L.phase === 'roll') {
      if (last?.by === me && last.again && last.capture?.length) return { t: `Kamu memakan bidak ${capNames(last)}! Lempar lagi!`, hot: true };
      if (last?.by === me && last.again) return { t: 'Dapat 6, lempar lagi!' };
      return { t: 'Giliranmu! Lempar dadu.' };
    }
    return { t: g.log?.at(-1) ?? '' };
  });
  const btnText = $derived(!player ? 'Kamu menonton' : playing ? 'Bidak jalan…' : canRoll ? (g.last?.by === me && g.last?.again ? 'Lempar lagi' : 'Lempar dadu') : myTurn && L.phase === 'pick' ? 'Pilih bidak' : `Giliran ${nameOf(g.turn)}…`);
  const homes = (id: string) => ludoHomeCount(L.tok?.[id] ?? []);
  const PIPS: Record<number, number[][]> = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
  const avaSvg = (p: any) => (p.pet ? `<svg viewBox="-66 -124 132 130">${petInner(p)}</svg>` : '');

  /* ---------------- hasil ---------------- */
  const done = $derived(g.phase === 'selesai');
  const ready = $derived(done && !!g.results?.length && (void tick, !g.last?.anim || serverNow() >= (g.last.at ?? 0) + g.last.anim + 600));
  const res = $derived(g.results?.find((r: any) => r.id === me));
  const mmss = (ms: number) => { const v = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(v / 60)} mnt ${v % 60} dtk`; };
  const why = $derived.by(() => {
    if (!done) return '';
    const n = g.results?.filter((r: any) => !r.left).length ?? 0;
    const t = g.why === 'waktu' ? `Waktu ${Math.round((L.cfg?.maxMs ?? 900_000) / 60_000)} menit habis. Yang belum pulang semua diurutkan menurut langkah bidak.`
      : g.why === 'pergi' ? 'Pemain lain pergi.'
      : L.finished?.length ? `${L.finished[0] === me ? 'Semua bidakmu' : `Semua bidak ${nameOf(L.finished[0])}`} pulang paling dulu · ${mmss((g.endedAt ?? 0) - (g.startedAt ?? 0))}.` : '';
    return `${t}${L.paid === false && n ? ` Tanpa hadiah: permainan berhenti sebelum ${Math.round((L.cfg?.minMs ?? 300_000) / 60_000)} menit.` : ''}`;
  });
  let resH = $state(0), winW = $state(390), winH = $state(844);
  /** HP: papan mengecil di bawah HUD supaya kartu hasil tidak menutupinya (tidak muat = papan disembunyikan) */
  const doneW = $derived(Math.min(296, winW - 16, winH - resH - 92 - 94 - 30));
  const gainText = (r: any) => [r.coins ? `+${r.coins} koin` : '', r.xp ? `+${r.xp} XP` : ''].filter(Boolean).join(' · ') + (r.capped ? ' Jatah main bareng hari ini sudah habis, tanpa koin.' : !r.coins && !r.xp ? 'Tanpa hadiah kali ini.' : '');
  function closeRes() { BG.closed = [...BG.closed, g.id]; }
  function again() { BG.closed = [...BG.closed, g.id]; startGame('ludo'); }
</script>

<svelte:window bind:innerWidth={winW} bind:innerHeight={winH} />

{#snippet result(cls: string)}
  <div class="res {cls}" role="dialog" aria-label="Hasil Ludo">
    <h2>{res?.rank === 1 ? 'Kamu juara 1!' : res ? `Juara ${res.rank}!` : 'Selesai'}</h2>
    {#if why}<p class="why">{why}</p>{/if}
    {#each g.results as x (x.id)}
      {@const p = g.players.find((q: any) => q.id === x.id)}
      <div class="rk" class:me={x.id === me}>
        <b>{x.rank}</b><i style="--c:{LUDO_COLORS[seatOf(x.id)]}">{@html p ? avaSvg(p) : ''}</i><span class="nm">{x.name}</span>{#if x.id === me}<span class="you">(kamu)</span>{/if}
        <em>{#if x.left}keluar{:else}pulang {homes(x.id)}/{L.perSeat}{#if homes(x.id) < L.perSeat}<small>{x.score ?? ludoProgress(L.tok?.[x.id] ?? [])} langkah</small>{/if}{/if}</em>
      </div>
    {/each}
    {#if res}<p class="gain">{gainText(res)}</p>{/if}
    <div class="btns">
      <button class="btn" onclick={closeRes}>Tutup</button>
      {#if player || res}<button class="btn hot" disabled={BG.busy} onclick={again}>Main lagi</button>{/if}
    </div>
  </div>
{/snippet}

<div class="lw" class:done class:gone={done && ready && doneW < 110} role="dialog" aria-label="Papan Ludo" style={done && ready ? `--dw:${Math.max(110, doneW)}px` : ''}>
  <div class="turns" class:hideph={done && ready}>
    {#each g.players as x (x.id)}
      {@const s = seatOf(x.id)}
      <span class:on={g.phase === 'main' && g.turn === x.id} class:out={x.left} style="--c:{LUDO_COLORS[s]}" title="{x.name} · {LUDO_COLOR_NAMES[s]}">
        <i>{@html avaSvg(x)}<svg class="tk" viewBox="0 0 24 24" aria-hidden="true">{@html tokenSVG(s)}</svg></i>
        <b class="nm">{x.name}</b>{#if x.id === me}<b class="you">(kamu)</b>{/if}
        <small aria-label="pulang {homes(x.id)} dari {L.perSeat}"><em class="lbl">pulang&nbsp;</em>{homes(x.id)}/{L.perSeat}</small>
      </span>
    {/each}
  </div>

  <svg viewBox="-6 -6 {W + 12} {W + 12}" class="lboard" role="img" aria-label="Papan Ludo">
    {@html boardSvg}
    <!-- tanda di bawah bidak: tujuan makan / aman / pulang -->
    {#each previews as p}
      {#if p.ring === 'cap'}<circle cx={p.x} cy={p.y} r={N * 0.47} fill="#E0583F" fill-opacity=".22" stroke="#E0583F" stroke-width="2.4" />
      {:else if p.ring === 'safe'}<circle cx={p.x} cy={p.y} r={N * 0.47} fill={INK} fill-opacity=".12" stroke={INK} stroke-width="2" stroke-dasharray="3 3" />
      {:else}<circle cx={p.x} cy={p.y} r={N * 0.5} fill="#3FA06A" fill-opacity=".25" stroke="#2E8A57" stroke-width="2.4" stroke-dasharray="4 3" />{/if}
    {/each}
    {#if burst}
      <g transform="translate({burst.x} {burst.y})"><path class="burst" d="M0 -19L4.4 -9.7 14.8 -12 10.2 -2.2 18 4.4 7.7 6.8 6.3 17.3 0 9.6 -6.3 17.3 -7.7 6.8 -18 4.4 -10.2 -2.2 -14.8 -12 -4.4 -9.7Z" fill="#FFE08A" stroke={INK} stroke-width="1.6" stroke-linejoin="round" /></g>
    {/if}
    {#each pieces as t (`${t.id}:${t.k}`)}
      {@const mov = t.id === me && movable.has(t.k)}
      {@const key = `${t.id}:${t.k}`}
      <g class="tok" class:fly={flying[key]} class:home={t.home} data-p={t.id} data-k={t.k} style="transform:translate({f1(t.x - 12 * t.sc)}px,{f1(t.y - 13 * t.sc)}px) scale({f1(t.sc * 100) / 100})">
        {#key hop[key] ?? 0}
          <g class="hopper" class:arc={flying[key]}>
            {#if mov}
              <g class="pick" role="button" tabindex="0" aria-label="Jalankan bidak {t.k + 1}" onclick={() => pick(t.k)} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), pick(t.k))}>
                <circle cx="12" cy="13" r="15" fill="transparent" />
                <circle class="glow" cx="12" cy="13" r="10.6" fill="#FFE08A" fill-opacity=".6" stroke="#F2B632" stroke-width="2.2" />
                <circle cx="12" cy="13" r="12.4" fill="none" stroke={INK} stroke-width="1.2" stroke-dasharray="2.6 2.2" />
                <ellipse cx="12" cy="21" rx="7.6" ry="2.6" fill={INK} opacity=".22" />
                <g class="lift">{@html tokenSVG(t.s)}</g>
              </g>
            {:else}
              <ellipse cx="12" cy="21" rx="7.6" ry="2.6" fill={INK} opacity=".22" />
              {@html tokenSVG(t.s)}
            {/if}
          </g>
        {/key}
      </g>
    {/each}
    <!-- label di atas semua bidak -->
    {#each previews as p}
      {@const b = tagAt(p.tx, p.ty, p.label)}
      <g class="tag" data-tbox="1" transform="translate({f1(b.x)} {f1(b.y)})"><rect data-box="1" x={-b.w / 2} y={-b.h} width={b.w} height={b.h} rx={b.h / 2} fill={p.col} stroke={INK} stroke-width="1.6" /><text x="0" y={-b.h / 2} dominant-baseline="central" text-anchor="middle" font-size={FS} font-weight="800" fill="#FFFFFF">{p.label}</text></g>
    {/each}
    {#each needs as n (n.k)}
      {@const b = tagAt(n.x, n.y - N * 0.75, `butuh ${n.need}`)}
      <g class="tag" data-tbox="1" transform="translate({f1(b.x)} {f1(b.y)})"><rect data-box="1" x={-b.w / 2} y={-b.h} width={b.w} height={b.h} rx={b.h / 2} fill={INK} stroke={INK} stroke-width="1.6" /><text x="0" y={-b.h / 2} dominant-baseline="central" text-anchor="middle" font-size={FS} font-weight="800" fill="#FFE08A">butuh {n.need}</text></g>
    {/each}
  </svg>

  {#if !done}
    <p class="log" class:hot={log.hot} role="status"><span>{log.t}</span></p>
    <p class="rules"><b>Ludo · {g.players.length} pemain, {L.perSeat} bidak.</b> Angka 6 untuk keluar kandang & lempar lagi (tiga 6 berturut-turut hangus). Makan bidak lawan = bidak itu pulang ke kandang & kamu lempar lagi. Kotak bintang aman. Masuk rumah harus angka pas.</p>
    <div class="ctrl">
      <button class="die" class:spin={rolling} disabled={!canRoll} onclick={roll} aria-label={canRoll ? 'Lempar dadu' : `Dadu: ${face}`}>
        <svg viewBox="-24 -24 48 48"><rect x="-21" y="-21" width="42" height="42" rx="10" fill="#FFFDF7" stroke={INK} stroke-width="3" />{#each PIPS[face] ?? [] as [x, y]}<circle cx={x * 10} cy={y * 10} r="4" fill={face === 6 ? '#E0583F' : INK} />{/each}</svg>
      </button>
      {#if player}
        <button class="btn big" class:hot={canRoll || (myTurn && L.phase === 'pick')} class:off={myTurn && L.phase === 'pick'} disabled={!canRoll} onclick={roll}>{btnText}</button>
      {:else}
        <button class="btn big" onclick={() => (BG.watching = null)}>Berhenti menonton</button>
      {/if}
      <span class="ring" class:hot={myTurn} role="timer" aria-label="Sisa waktu {secs} detik">
        <svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="none" stroke="#E4DECD" stroke-width="4" /><circle cx="20" cy="20" r="17" fill="none" stroke={myTurn ? (secs <= 3 ? '#E0583F' : '#F2B632') : '#B5AE9C'} stroke-width="4" stroke-linecap="round" stroke-dasharray="106.8" stroke-dashoffset={f1(106.8 * (1 - leftMs / totalMs))} transform="rotate(-90 20 20)" /></svg>
        <b>{secs}</b>
      </span>
    </div>
  {:else if ready}
    {@render result('dk')}
  {/if}
</div>
{#if ready}<div class="resph" bind:clientHeight={resH}>{@render result('ph')}</div>{/if}

<style>
  .lw { position: fixed; z-index: 60; left: 0; right: 0; top: 8px; bottom: 0; margin: auto; height: fit-content; width: min(420px, calc(100% - 16px)); max-height: calc(100dvh - var(--safe-t) - var(--safe-b) - 170px); overflow-y: auto; display: flex; flex-direction: column; gap: 6px; background: var(--paper); border: 3px solid var(--ink); border-radius: 20px; box-shadow: 0 5px 0 var(--ink); padding: 8px 10px; }
  .turns { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; }
  .turns > span { display: inline-flex; align-items: center; gap: 3px; border: 2.5px solid transparent; border-radius: 999px; padding: 0 7px 0 1px; font-size: 12.5px; font-weight: 800; min-height: 30px; max-width: 100%; }
  .turns > span.on { border-color: var(--c); background: #FFF4D6; }
  .turns > span.out { opacity: .45; text-decoration: line-through; }
  .turns i { position: relative; width: 26px; height: 26px; display: inline-grid; place-items: center; border-radius: 50%; background: var(--c); flex: none; }
  .turns i :global(svg:first-child) { width: 21px; height: 22px; }
  .turns i .tk { position: absolute; right: -5px; bottom: -4px; width: 14px; height: 14px; }
  .turns .nm { font-weight: 800; max-width: 9.5ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .turns .you { font-weight: 700; color: var(--muted); }
  .turns small { font-size: 11.5px; font-weight: 800; color: var(--muted); margin-left: 2px; }
  .turns .lbl { display: none; font-style: normal; }
  .lboard { width: min(100%, calc(100dvh - var(--safe-t) - var(--safe-b) - 364px)); min-width: 200px; height: auto; display: block; margin: 0 auto; font-family: var(--font); flex: none; }
  .tok { transition: transform .18s ease-out; }
  .tok.fly { transition: transform .62s cubic-bezier(.4, 0, .3, 1); }
  .tok.home { transition: transform .5s ease-in-out; }
  .hopper { animation: hop .19s ease-out; }
  .hopper.arc { animation: arc .62s ease-out; }
  .pick { cursor: pointer; outline: none; }
  .pick .lift { transform: translateY(-2.5px); }
  .pick .glow { animation: glow 1s ease-in-out infinite; }
  .pick:focus-visible .glow { stroke: #3F7FBF; stroke-width: 3; }
  .burst { animation: burst .7s ease-out both; transform-box: fill-box; transform-origin: center; }
  .tag { pointer-events: none; }
  @keyframes hop { 0% { transform: translateY(0); } 45% { transform: translateY(-6px); } 100% { transform: translateY(0); } }
  @keyframes arc { 0% { transform: translateY(0) rotate(0); } 45% { transform: translateY(-38px) rotate(-25deg); } 100% { transform: translateY(0) rotate(0); } }
  @keyframes glow { 0%, 100% { fill-opacity: .35; } 50% { fill-opacity: .8; } }
  @keyframes burst { 0% { transform: scale(.3); opacity: 0; } 30% { opacity: 1; } 100% { transform: scale(1.25); opacity: 0; } }
  /* keterangan paling banyak 2 baris di HP supaya tinggi kartu tetap (papan tidak menutupi HUD / dock) */
  .log { margin: 0; min-height: 40px; background: var(--soft); border-radius: 12px; padding: 3px 10px; font-size: 13.5px; font-weight: 700; line-height: 1.25; display: flex; align-items: center; flex: none; }
  .log span { display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .log.hot { background: #FFE0D6; }
  .rules { display: none; }
  .ctrl { display: flex; align-items: center; gap: 10px; }
  .die { width: 48px; height: 48px; flex: none; padding: 0; border: 0; background: none; cursor: pointer; }
  .die:disabled { cursor: default; }
  .die svg { width: 100%; height: 100%; display: block; }
  .die.spin svg { animation: spin .35s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .big { flex: 1; min-height: 48px; font-size: 17px; }
  .big.off:disabled { opacity: .55; }
  .ring { position: relative; width: 38px; height: 38px; flex: none; display: grid; place-items: center; }
  .ring svg { position: absolute; inset: 0; width: 100%; height: 100%; }
  .ring b { position: relative; font-size: 13px; font-weight: 800; }
  /* hasil */
  .res { display: flex; flex-direction: column; gap: 6px; }
  .res h2 { margin: 0; font-size: 24px; font-weight: 800; }
  .res .why { margin: 0; font-size: 13px; font-weight: 700; color: var(--muted); line-height: 1.3; }
  .rk { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; min-height: 30px; }
  .rk b { width: 16px; flex: none; }
  .rk i { width: 28px; height: 28px; border-radius: 50%; background: var(--c); display: inline-grid; place-items: center; flex: none; }
  .rk i :global(svg) { width: 23px; height: 24px; }
  .rk .nm { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rk .you { flex: none; margin-left: -4px; }
  .rk em { margin-left: auto; font-style: normal; font-weight: 800; text-align: right; flex: none; display: flex; flex-direction: column; align-items: flex-end; line-height: 1.1; }
  .rk em small { font-size: 12px; color: var(--muted); font-weight: 700; }
  .rk.me { color: #2A6FB0; }
  .gain { margin: 0; font-weight: 800; font-size: 16px; }
  .btns { display: flex; gap: 8px; }
  .btns .btn { flex: 1; min-height: 42px; }
  .res.dk { display: none; }
  .resph { position: fixed; z-index: 70; left: 0; right: 0; margin: 0 auto; bottom: calc(var(--safe-b) + 92px); width: min(400px, calc(100% - 20px)); background: var(--paper); border: 3px solid var(--ink); border-radius: 20px; box-shadow: 0 5px 0 var(--ink); padding: 12px 14px; animation: pop .25s ease-out; }
  /* HP, sesudah selesai: papan kecil di bawah HUD, kartu hasil di atas dock */
  .lw.done { top: calc(var(--safe-t) + 94px); bottom: auto; width: var(--dw, min(296px, calc(100% - 16px))); padding: 6px; }
  .lw.done .lboard { width: 100%; min-width: 0; }
  .lw.gone { display: none; }
  .hideph { display: none; }
  @media (prefers-reduced-motion: reduce) {
    .tok, .tok.fly, .tok.home { transition: none; }
    .hopper, .hopper.arc, .pick .glow, .die.spin svg, .burst { animation: none; }
  }
  /* desktop: papan setinggi layar di kiri, pemain + keterangan + dadu (atau hasil) di panel kanan */
  @media (min-width: 900px) and (min-aspect-ratio: 1/1) and (min-height: 520px) {
    .lw, .lw.done { --bs: min(calc(100dvh - var(--safe-t) - var(--safe-b) - 214px), calc(100vw - 440px), 820px); top: 8px; bottom: 0; margin: auto; width: fit-content; max-height: none; overflow: visible; display: grid; grid-template-columns: var(--bs) 300px; grid-template-rows: auto auto minmax(0, 1fr) auto; gap: 12px 18px; padding: 14px 18px; border-radius: 24px; }
    .lw.gone { display: grid; }
    .lboard, .lw.done .lboard { grid-column: 1; grid-row: 1 / -1; width: var(--bs); min-width: 0; align-self: center; }
    .turns, .hideph { grid-column: 2; grid-row: 1; display: flex; flex-direction: column; align-items: stretch; gap: 6px; }
    .turns > span { font-size: 16px; padding: 2px 12px 2px 3px; gap: 7px; min-height: 40px; }
    .turns i { width: 34px; height: 34px; }
    .turns i :global(svg:first-child) { width: 28px; height: 29px; }
    .turns i .tk { width: 17px; height: 17px; }
    .turns .nm { max-width: 13ch; }
    .turns small { margin-left: auto; font-size: 13px; }
    .turns .lbl { display: inline; }
    .log { grid-column: 2; grid-row: 2; font-size: 15.5px; padding: 8px 12px; }
    .log span { -webkit-line-clamp: unset; line-clamp: unset; }
    .rules { grid-column: 2; grid-row: 3; align-self: end; display: block; margin: 0; padding: 8px 12px; background: #F3F7F1; border: 2px solid #D3E4D7; border-radius: 14px; font-size: 13px; font-weight: 700; color: #3D5A48; line-height: 1.35; }
    .rules b { color: var(--ink); }
    .ctrl { grid-column: 2; grid-row: 4; flex-wrap: wrap; justify-content: space-between; gap: 12px; }
    .die { width: 68px; height: 68px; }
    .ring { width: 48px; height: 48px; }
    .ring b { font-size: 17px; }
    .big { flex: 1 0 100%; order: 3; min-height: 58px; font-size: 19px; }
    .resph { display: none; }
    .res.dk { grid-column: 2; grid-row: 2 / -1; display: flex; align-self: end; background: #FFFDF7; border: 3px solid var(--ink); border-radius: 18px; box-shadow: 0 4px 0 var(--ink); padding: 12px 14px; }
    .res.dk h2 { font-size: 26px; }
  }
</style>
