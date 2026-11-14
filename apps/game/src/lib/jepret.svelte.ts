// Jepret & Bagikan ke Story (di HP pemain, tanpa server): adegan dari Room.svelte (kb-jepret) → kartu SVG mandiri
// (@kb/shared jepretCard, font Baloo 2 disisipkan base64) → <img> → satu kanvas → PNG → File → Web Share / unduh.
// Server hanya menerima catatan kecil (POST /api/share) untuk tugas harian "Bagikan 1 foto".
import {
  JEPRET_SIZES, fotoCaption, fotoPhoto, jepretCaption, jepretCard, jepretFileName, jepretLink, jepretPhoto, photoInner, placeLabels, skySVG, skyTime,
  type JepretFormat, type JepretLabel, type JepretPlace, type Measure, type SkyColors, type SkyTime,
} from '@kb/shared';
import font700 from '@fontsource/baloo-2/files/baloo-2-latin-700-normal.woff2?url';
import font800 from '@fontsource/baloo-2/files/baloo-2-latin-800-normal.woff2?url';
import { G, item, merge, settings, toast, wearItems } from './game.svelte';
import { api } from './api';
import { sfx } from './sfx';

type Rect = { x: number; y: number; w: number; h: number };
/** pet di layar (koordinat layar): titik label di bawah kaki & kotak badannya */
export type JepretPet = { id: string; name: string; self: boolean; x: number; y: number; box: Rect };
/** potret adegan dari Room.svelte saat tombol jepret ditekan */
export type JepretSnap = {
  vw: number; vh: number; frame: Rect;
  markup: string; viewBox: string; mirror: boolean;
  sky: { plain: boolean; night: boolean; hillsOn: boolean; colors: SkyColors; orb: Rect | null; hills: Rect | null; clouds: Rect[] };
  overlay: string; pets: JepretPet[];
  place: JepretPlace; host: string | null; pet: string; time: SkyTime;
};
export type JepretSrc = { kind: 'jepret'; snap: JepretSnap } | { kind: 'foto'; photo: any };

const load = (k: string, def: boolean) => { try { const v = localStorage.getItem(k); return v === null ? def : v === '1'; } catch { return def; } };
const keep = (k: string, v: boolean) => { try { localStorage.setItem(k, v ? '1' : '0'); } catch { /* penuh / diblokir */ } };

export const JP = $state({
  /** "Nama pet" (bawaan nyala) & "Kode temanku" (bawaan mati), diingat per perangkat */
  names: load('kb-jepret-names', true),
  code: load('kb-jepret-code', false),
  /** sudah pernah membuka Jepret di perangkat ini (label BARU hilang) */
  seen: load('kb-jepret-seen', false),
  /** bingkai foto di layar & pet di layar (diisi Room selama mode Jepret) */
  frame: null as Rect | null,
  pets: [] as JepretPet[],
  /** yang sedang dipratinjau (lembar "Fotomu siap!"): hasil Jepret atau Foto bareng */
  src: null as JepretSrc | null,
  /** dibuka lewat tautan /#jepret (tugas "Ke sana") */
  want: false,
  /** kilatan putih saat menjepret */
  flash: 0,
});
export const setNames = (v: boolean) => { JP.names = v; keep('kb-jepret-names', v); };
export const setCode = (v: boolean) => { JP.code = v; keep('kb-jepret-code', v); };
export const jepretOn = () => settings().features?.jepret !== false;

export function openJepret() {
  if (!jepretOn() || G.jepret) return;
  sfx.tap();
  G.sheet = null;
  G.jepret = 'frame';
  if (!JP.seen) { JP.seen = true; keep('kb-jepret-seen', true); }
}
export function closeJepret() {
  G.jepret = null;
  JP.src = null;
  JP.frame = null;
  JP.pets = [];
}
/** perintah ke Room.svelte (kamera Pet-ku / Semua / zoom, potret adegan) */
export function roomCmd(op: 'pet' | 'all' | 'zoom' | 'snap' | 'enter', extra: Record<string, unknown> = {}) {
  return new Promise<any>((resolve) => {
    const ev = new CustomEvent('kb-jepret', { detail: { op, frame: JP.frame, reply: resolve, ...extra } });
    dispatchEvent(ev);
    // tidak ada Room yang menjawab (mis. sudah pindah layar)
    setTimeout(() => resolve(null), 1500);
  });
}
/** tombol jepret: kilatan + "cekrek", lalu lembar Fotomu siap! */
export async function shoot() {
  if (G.jepret !== 'frame' || !JP.frame) return;
  JP.flash++;
  sfx.cekrek();
  const snap: JepretSnap | null = await roomCmd('snap');
  if (!snap) { toast('Gambarnya belum siap, coba lagi.', 'error'); return; }
  JP.src = { kind: 'jepret', snap };
  G.jepret = 'preview';
}
/** Foto bareng (PhotoPreview / album) → lembar yang sama */
export function shareFoto(photo: any) {
  if (!jepretOn()) return;
  sfx.tap();
  JP.src = { kind: 'foto', photo };
}

/* ---------------- ukuran teks, font, kanvas ---------------- */

let mctx: CanvasRenderingContext2D | null = null;
/** lebar teks asli (Baloo 2 sudah dimuat game) */
export const measure: Measure = (t, w, s) => {
  mctx ??= document.createElement('canvas').getContext('2d');
  if (!mctx) return t.length * s * 0.6;
  mctx.font = `${w} ${s}px "Baloo 2"`;
  return mctx.measureText(t).width;
};

let fontP: Promise<string> | null = null;
const toDataUrl = (b: Blob) => new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = () => rej(fr.error); fr.readAsDataURL(b); });
/** @font-face Baloo 2 700 & 800 sebagai base64 (±52 KB), disimpan di memori; file woff2-nya sudah di-cache Service Worker */
export function fontCss() {
  fontP ??= Promise.all([[700, font700], [800, font800]].map(async ([w, url]) => {
    const r = await fetch(String(url));
    if (!r.ok) throw new Error('font');
    const d = (await toDataUrl(await r.blob())).replace(/^data:[^;,]*/, 'data:font/woff2');
    return `@font-face{font-family:'Baloo 2';font-weight:${w};font-style:normal;src:url(${d}) format('woff2')}`;
  })).then((a) => a.join('')).catch((e) => { fontP = null; throw e; });
  return fontP;
}

/** gambar mebel unggahan admin (<image href>) tidak dimuat di dalam gambar SVG: disisipkan sebagai data URL dulu */
async function inlineImages(svg: string) {
  const urls = [...new Set([...svg.matchAll(/<image\b[^>]*?\s(?:xlink:)?href="([^"#][^"]*)"/g)].map((m) => m[1]).filter((u) => !u.startsWith('data:')))];
  for (const u of urls) {
    try {
      const d = await toDataUrl(await (await fetch(u.replace(/&amp;/g, '&'))).blob());
      svg = svg.split(`"${u}"`).join(`"${d}"`);
    } catch { svg = svg.split(`"${u}"`).join('""'); }
  }
  return svg;
}

let canvas: HTMLCanvasElement | null = null;
let queue: Promise<unknown> = Promise.resolve();
/** SVG → PNG di satu kanvas yang dipakai ulang (bergiliran); memori kanvas dilepas setelah encode (iOS) */
export function rasterize(svg: string, W: number, H: number): Promise<Blob> {
  const run = queue.then(() => draw(svg, W, H));
  queue = run.catch(() => {});
  return run;
}
async function draw(svg: string, W: number, H: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    canvas ??= document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.drawImage(img, 0, 0, W, H);
    const blob = await new Promise<Blob | null>((r) => canvas!.toBlob(r, 'image/png'));
    if (!blob) throw new Error('encode');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
    if (canvas) { canvas.width = 0; canvas.height = 0; }
  }
}

/* ---------------- kartu dari Jepret / Foto bareng ---------------- */

const inside = (p: { x: number; y: number }, f: Rect) => p.x >= f.x && p.x <= f.x + f.w && p.y >= f.y && p.y <= f.y + f.h;
const center = (b: Rect) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
/** pet yang ada di dalam bingkai (titik tengah badannya) */
export const petsIn = (pets: JepretPet[], f: Rect) => pets.filter((p) => inside(center(p.box), f));
/** nama pet lain di dalam bingkai (bukan pet sendiri) */
export const othersIn = (pets: JepretPet[], f: Rect) => petsIn(pets, f).filter((p) => !p.self).map((p) => p.name);
/** label nama di bingkai: hanya bila ada pet lain (foto sendirian tidak berlabel, namanya sudah di keterangan) */
export function labelsFor(pets: JepretPet[], f: Rect, names: boolean): JepretLabel[] {
  const inn = petsIn(pets, f);
  if (!names || !inn.some((p) => !p.self)) return [];
  return placeLabels(inn.map((p) => ({ id: p.id, name: p.name, x: p.x, y: p.y, self: p.self })), { measure, bounds: f });
}
/** host situs untuk kartu (sama dengan link yang disalin) */
export const domain = () => location.host.replace(/^www\./, '');
export const shareLink = (code: boolean) => jepretLink(location.origin, code ? G.me?.user?.friend_code : null);
export const hasOthers = (src: JepretSrc) => (src.kind === 'foto' ? true : othersIn(src.snap.pets, src.snap.frame).length > 0);

function fotoParts(photo: any, names: boolean) {
  const members = (photo.members ?? []).filter((m: any) => m.pet);
  const inner = photoInner(members.map((m: any) => ({ look: m.pet, wear: wearItems(m.pet.wear), state: m.pet.state })), photo.pose, item(photo.scene?.wall), item(photo.scene?.floor), photo.scene?.theme);
  const me = members.find((m: any) => m.id === G.me?.user?.id)?.pet?.name ?? null;
  const host = photo.scene?.theme === 'alun' ? 'alun' : members.find((m: any) => m.id === photo.hostId)?.pet?.name ?? null;
  const time = skyTime(new Date(photo.createdAt ?? Date.now()).getHours());
  return { inner, caption: fotoCaption({ pets: members.map((m: any) => m.pet.name), me, host, time, names }), time, me };
}

/** string SVG kartu (tanpa font; dipakai juga untuk uji) */
export function cardSvg(src: JepretSrc, fmt: JepretFormat, names: boolean, code: boolean, fontCss = '') {
  const friend = code ? G.me?.user?.friend_code ?? null : null;
  if (src.kind === 'foto') {
    const f = fotoParts(src.photo, names);
    return jepretCard({ kind: fmt, photo: fotoPhoto(f.inner), aspect: 100 / 136, caption: f.caption, code: friend, night: f.time === 'malam', domain: domain(), fontCss, measure });
  }
  const s = src.snap;
  const others = othersIn(s.pets, s.frame);
  const photo = jepretPhoto({
    frame: s.frame, vw: s.vw, vh: s.vh,
    sky: skySVG({ vw: s.vw, vh: s.vh, plain: s.sky.plain, night: s.sky.night, hillsOn: s.sky.hillsOn, colors: s.sky.colors, orb: s.sky.orb, hills: s.sky.hills, clouds: s.sky.clouds }),
    scene: { markup: s.markup, viewBox: s.viewBox, mirror: s.mirror },
    overlay: s.overlay,
    labels: labelsFor(s.pets, s.frame, names),
  });
  const caption = jepretCaption({ pet: s.pet, place: s.place, host: s.host, time: s.time, others, names });
  return jepretCard({ kind: fmt, photo, caption, code: friend, night: s.time === 'malam', domain: domain(), fontCss, measure });
}

/** keterangan kartu (juga teks alternatif pratinjau) */
export function captionOf(src: JepretSrc, names: boolean): string[] {
  if (src.kind === 'foto') return fotoParts(src.photo, names).caption;
  const s = src.snap;
  return jepretCaption({ pet: s.pet, place: s.place, host: s.host, time: s.time, others: othersIn(s.pets, s.frame), names }).filter(Boolean) as string[];
}

export function fileNameOf(src: JepretSrc) {
  if (src.kind === 'foto') return jepretFileName(fotoParts(src.photo, true).me ?? G.me?.pet?.name ?? 'pet', 'foto');
  return jepretFileName(src.snap.pet, src.snap.place);
}

/** kartu → File PNG (dibuat sebelum ketukan Bagikan, supaya share() langsung jalan) */
export async function buildFile(src: JepretSrc, fmt: JepretFormat, names: boolean, code: boolean) {
  await document.fonts?.load?.('800 20px "Baloo 2"').catch(() => {});
  const css = await fontCss().catch(() => '');
  const svg = await inlineImages(cardSvg(src, fmt, names, code, css));
  const { W, H } = JEPRET_SIZES[fmt];
  const blob = await rasterize(svg, W, H);
  return new File([blob], fileNameOf(src), { type: 'image/png' });
}

/* ---------------- berbagi ---------------- */

/** kemampuan perangkat: berbagi file, browser di dalam aplikasi, desktop, iOS */
export function shareCaps(file?: File | null) {
  const ua = navigator.userAgent || '';
  const inApp = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|TikTok|musical_ly|Line\//i.test(ua);
  let fileShare = false;
  try { fileShare = !!file && typeof navigator.share === 'function' && !!navigator.canShare?.({ files: [file] }); } catch { fileShare = false; }
  const fine = typeof matchMedia !== 'undefined' && matchMedia('(pointer: fine)').matches;
  const touch = (navigator.maxTouchPoints ?? 0) > 0 || (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches);
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1);
  return { fileShare: fileShare && !inApp, inApp, desktop: fine && !touch, ios };
}

/** catatan bagikan ke server (tugas harian); tidak menghalangi pemain bila gagal */
export function report(kind: 'jepret' | 'foto', via: 'share' | 'save' | 'download' | 'inapp', fmt: JepretFormat) {
  api.post('/api/share', { kind, via, fmt }).then((r) => merge(r)).catch(() => {});
}
/** salin link tanpa menunggu (supaya share() masih dalam ketukan yang sama) */
export function copyLink(link: string, onFail?: () => void) {
  try {
    const p = navigator.clipboard?.writeText(link);
    if (!p) { onFail?.(); return false; }
    p.catch(() => onFail?.());
    return true;
  } catch { onFail?.(); return false; }
}
/**
 * Ketukan Bagikan: link disalin, toast, lalu lembar bagikan HP dengan gambar terlampir (tanpa text/url di panggilan yang sama).
 * Tidak ada await sebelum share(): File sudah dibuat sebelumnya.
 */
export function shareNow(file: File, link: string, onClipFail?: () => void): Promise<'ok' | 'abort' | 'fail'> {
  copyLink(link, onClipFail);
  toast('Link BUPI tersalin — tempel lewat stiker Link di Story', 'good', 4000);
  let p: Promise<void>;
  try { p = navigator.share({ files: [file], title: 'BUPI' }); } catch { return Promise.resolve('fail'); }
  return p.then(() => 'ok' as const, (e: any) => (e?.name === 'AbortError' ? 'abort' as const : 'fail' as const));
}
/** Simpan ke galeri / Unduh gambar: iOS lewat lembar bagikan (unduhan iOS masuk Files, bukan Foto), selain itu unduhan biasa */
export function saveFile(file: File, caps: ReturnType<typeof shareCaps>): Promise<boolean> {
  if (caps.ios && caps.fileShare) {
    toast('Pilih Simpan Gambar, ya.');
    try { return navigator.share({ files: [file] }).then(() => true, () => false); } catch { /* lanjut unduh */ }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = file.name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  toast('Tersimpan di folder Download.', 'good');
  return Promise.resolve(true);
}
