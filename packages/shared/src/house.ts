// Denah rumah tersambung: semua ruangan disusun otomatis jadi satu rumah isometrik.
// Ruangan dalam (kamar, ruang tamu, dapur, ...) dirapatkan supaya rumahnya kotak & padat; halaman di depan rumah.
// Dua ruangan yang bersebelahan dipisah dinding rendah dengan satu pintu. Dinding tinggi (berjendela & berlukisan)
// hanya di sisi belakang rumah, supaya tidak menutupi ruangan lain.

export interface HouseRoomIn { id: string; size: number; theme?: string | null }
/** jenis tiap petak dinding belakang ruangan */
export type WallKind = 'tall' | 'low' | 'part' | 'door';
export interface WallSeg { k: WallKind; by?: string }
export interface HouseRoom {
  id: string;
  /** urutan asli ruangan */
  i: number;
  gx: number;
  gy: number;
  size: number;
  outdoor: boolean;
  /** dinding kiri-belakang (bidang x = gx) & kanan-belakang (bidang y = gy), satu entri per petak */
  L: WallSeg[];
  R: WallSeg[];
  window: boolean;
  painting: boolean;
}
/** pintu di dinding antara ruangan `a` (belakang) dan `b` (depan); axis x: dinding di bidang x = line, petak y = at */
export interface HouseDoor { a: string; b: string; axis: 'x' | 'y'; line: number; at: number }
export interface HousePlan {
  rooms: HouseRoom[];
  doors: HouseDoor[];
  /** ukuran denah (petak) */
  W: number;
  D: number;
  /** berubah bila letak/ukuran ruangan berubah (bukan karena pintu bergeser) */
  sig: string;
  byId: Map<string, HouseRoom>;
  /** ruangan di petak (x, y) */
  at(x: number, y: number): HouseRoom | undefined;
  /** boleh melangkah dari petak a ke petak b yang bersebelahan (pindah ruangan hanya lewat pintu) */
  pass(ax: number, ay: number, bx: number, by: number): boolean;
}

/** dinding tinggi (150 px) menutupi ±4,4 petak di belakangnya */
const WALL_REACH = 4.5;
const MIN_SIZE = 3, MAX_SIZE = 16;

type Rect = { id: string; i: number; gx: number; gy: number; s: number; outdoor: boolean };
const overlaps = (a: Rect, b: { gx: number; gy: number; s: number }) => a.gx < b.gx + b.s && b.gx < a.gx + a.s && a.gy < b.gy + b.s && b.gy < a.gy + a.s;
/** sisi bersama bila `b` menempel di depan `a` */
function sharedEdge(a: { gx: number; gy: number; s: number }, b: { gx: number; gy: number; s: number }) {
  if (b.gx === a.gx + a.s) { const f = Math.max(a.gy, b.gy), t = Math.min(a.gy + a.s, b.gy + b.s); if (t > f) return { axis: 'x' as const, line: b.gx, from: f, to: t }; }
  if (b.gy === a.gy + a.s) { const f = Math.max(a.gx, b.gx), t = Math.min(a.gx + a.s, b.gx + b.s); if (t > f) return { axis: 'y' as const, line: b.gy, from: f, to: t }; }
  return null;
}
const touches = (a: Rect, b: { gx: number; gy: number; s: number }) => !!(sharedEdge(a, b) ?? sharedEdge(b, a));

export function houseLayout(input: HouseRoomIn[], blockedOf?: (id: string) => Set<string> | undefined): HousePlan {
  const list: Rect[] = input.map((r, i) => ({ id: r.id, i, gx: 0, gy: 0, s: Math.max(MIN_SIZE, Math.min(MAX_SIZE, Math.round(Number(r.size) || 6))), outdoor: r.theme === 'luar' }));
  const order = [...list.filter((r) => !r.outdoor), ...list.filter((r) => r.outdoor)];
  const placed: Rect[] = [];
  const bbox = (extra?: { gx: number; gy: number; s: number }) => {
    const all = extra ? [...placed, extra] : placed;
    const x0 = Math.min(...all.map((r) => r.gx)), y0 = Math.min(...all.map((r) => r.gy));
    const x1 = Math.max(...all.map((r) => r.gx + r.s)), y1 = Math.max(...all.map((r) => r.gy + r.s));
    return { W: x1 - x0, D: y1 - y0 };
  };
  for (const r of order) {
    if (!placed.length) { placed.push(r); continue; }
    const inside = placed.filter((p) => !p.outdoor);
    const pool = r.outdoor ? placed : inside;
    const cands: { gx: number; gy: number }[] = [];
    for (const p of pool) {
      const al = [p.gy, p.gy + p.s - r.s, p.gy + Math.floor((p.s - r.s) / 2)];
      for (const gy of al) cands.push({ gx: p.gx + p.s, gy });
      const ax = [p.gx, p.gx + p.s - r.s, p.gx + Math.floor((p.s - r.s) / 2)];
      for (const gx of ax) cands.push({ gx, gy: p.gy + p.s });
    }
    let Win = 0, Din = 0;
    if (r.outdoor && inside.length) {
      Win = Math.max(...inside.map((p) => p.gx + p.s)); Din = Math.max(...inside.map((p) => p.gy + p.s));
      // halaman di tengah depan rumah
      cands.push({ gx: Math.floor((Win - r.s) / 2), gy: Din }, { gx: Win, gy: Math.floor((Din - r.s) / 2) });
    }
    let best: { gx: number; gy: number; score: number[] } | null = null;
    for (const c of cands) {
      const rect = { gx: c.gx, gy: c.gy, s: r.s };
      if (!r.outdoor && (c.gx < 0 || c.gy < 0)) continue;
      if (placed.some((p) => overlaps(p, rect))) continue;
      if (!placed.some((p) => touches(p, rect))) continue;
      let centre = c.gx + c.gy;
      if (r.outdoor && inside.length) {
        // halaman harus di depan rumah (tidak di belakang / di sela ruangan dalam)
        const frontY = inside.every((p) => !(p.gx < c.gx + r.s && c.gx < p.gx + p.s) || p.gy + p.s <= c.gy);
        const frontX = inside.every((p) => !(p.gy < c.gy + r.s && c.gy < p.gy + p.s) || p.gx + p.s <= c.gx);
        if (!frontY && !frontX) continue;
        centre = frontY ? Math.abs(c.gx + r.s / 2 - Win / 2) : Math.abs(c.gy + r.s / 2 - Din / 2);
      }
      const b = bbox(rect);
      const score = [Math.max(b.W, b.D), b.W + b.D, centre];
      if (!best || lexLess(score, best.score)) best = { gx: c.gx, gy: c.gy, score };
    }
    if (!best) {
      // tidak ada tempat menempel (seharusnya tidak terjadi): taruh di kanan rumah
      const b = bbox();
      best = { gx: b.W, gy: 0, score: [] };
    }
    r.gx = best.gx; r.gy = best.gy;
    placed.push(r);
  }
  // geser supaya koordinat mulai dari 0
  const x0 = Math.min(...placed.map((r) => r.gx)), y0 = Math.min(...placed.map((r) => r.gy));
  for (const r of placed) { r.gx -= x0; r.gy -= y0; }
  const W = placed.length ? Math.max(...placed.map((r) => r.gx + r.s)) : 0;
  const D = placed.length ? Math.max(...placed.map((r) => r.gy + r.s)) : 0;

  // petak → ruangan
  const grid: (Rect | undefined)[] = new Array(W * D);
  for (const r of placed) for (let x = r.gx; x < r.gx + r.s; x++) for (let y = r.gy; y < r.gy + r.s; y++) grid[y * W + x] = r;
  const cell = (x: number, y: number) => (x >= 0 && y >= 0 && x < W && y < D ? grid[Math.floor(y) * W + Math.floor(x)] : undefined);
  const inHouse = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < D && !!grid[Math.floor(y) * W + Math.floor(x)];

  // pintu: satu per pasangan ruangan yang bersebelahan, di petak kosong paling dekat ke tengah sisi bersama
  const doors: HouseDoor[] = [];
  const doorKeys = new Set<string>();
  for (const a of placed)
    for (const b of placed) {
      if (a === b) continue;
      const e = sharedEdge(a, b);
      if (!e) continue;
      const ba = blockedOf?.(a.id), bb = blockedOf?.(b.id);
      const free = (k: number) => {
        const [ax, ay, bx, by] = e.axis === 'x' ? [e.line - 1 - a.gx, k - a.gy, 0, k - b.gy] : [k - a.gx, e.line - 1 - a.gy, k - b.gx, 0];
        return !ba?.has(`${ax},${ay}`) && !bb?.has(`${bx},${by}`);
      };
      const mid = (e.from + e.to - 1) / 2;
      const ks: number[] = [];
      for (let k = e.from; k < e.to; k++) ks.push(k);
      ks.sort((p, q) => Math.abs(p - mid) - Math.abs(q - mid) || p - q);
      const at = ks.find(free) ?? ks[0];
      doors.push({ a: a.id, b: b.id, axis: e.axis, line: e.line, at });
      doorKeys.add(e.axis === 'x' ? `${e.line - 1},${at}|${e.line},${at}` : `${at},${e.line - 1}|${at},${e.line}`);
    }

  // dinding tinggi hanya bila di belakangnya (sejauh tinggi dinding) tidak ada ruangan
  const tallOk = (axis: 'x' | 'y', line: number, k: number) => {
    for (let u = 0.25; u <= WALL_REACH; u += 0.25)
      for (const f of [0.05, 0.5, 0.95]) {
        const [x, y] = axis === 'x' ? [line - u, k + f - u] : [k + f - u, line - u];
        if (inHouse(x, y)) return false;
      }
    return true;
  };
  const doorAt = (axis: 'x' | 'y', line: number, k: number) => doors.some((d) => d.axis === axis && d.line === line && d.at === k);
  const rooms: HouseRoom[] = placed.map((r) => {
    const L: WallSeg[] = [], R: WallSeg[] = [];
    for (let k = 0; k < r.s; k++) {
      const y = r.gy + k, behindL = cell(r.gx - 1, y);
      L.push(behindL ? { k: doorAt('x', r.gx, y) ? 'door' : 'part', by: behindL.id } : { k: tallOk('x', r.gx, y) ? 'tall' : 'low' });
      const x = r.gx + k, behindR = cell(x, r.gy - 1);
      R.push(behindR ? { k: doorAt('y', r.gy, x) ? 'door' : 'part', by: behindR.id } : { k: tallOk('y', r.gy, x) ? 'tall' : 'low' });
    }
    const span = (a: number, b: number) => { const out: number[] = []; for (let k = Math.max(0, Math.floor(a)); k < Math.min(r.s, Math.ceil(b)); k++) out.push(k); return out; };
    const win = !r.outdoor && span(r.s / 2 - 1.2, r.s / 2 + 1.2).every((k) => R[k].k === 'tall');
    const pic = !r.outdoor && span(r.s / 2 + 0.35, r.s / 2 + 1.65).every((k) => L[k].k === 'tall');
    return { id: r.id, i: r.i, gx: r.gx, gy: r.gy, size: r.s, outdoor: r.outdoor, L, R, window: win, painting: pic };
  });
  rooms.sort((a, b) => a.i - b.i);
  const byId = new Map(rooms.map((r) => [r.id, r]));
  const roomAt = (x: number, y: number) => { const c = cell(x, y); return c ? byId.get(c.id) : undefined; };
  return {
    rooms, doors, W, D, byId,
    sig: rooms.map((r) => `${r.id}@${r.gx},${r.gy}/${r.size}`).join(';'),
    at: roomAt,
    pass(ax, ay, bx, by) {
      const A = cell(ax, ay), B = cell(bx, by);
      if (!A || !B) return false;
      if (A === B) return true;
      const k1 = `${ax},${ay}|${bx},${by}`, k2 = `${bx},${by}|${ax},${ay}`;
      return doorKeys.has(k1) || doorKeys.has(k2);
    },
  };
}

function lexLess(a: number[], b: number[]) {
  for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return a[k] < b[k];
  return false;
}
