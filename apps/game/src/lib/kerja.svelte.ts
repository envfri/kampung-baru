// Kerja Sambilan (game): papan lowongan, berangkat ke tempat kerja di peta, catatan di pintu, panggil pulang,
// amplop gaji, aksi yang ditolak selama pet kerja (dialog dengan "Panggil pulang"), dan ajakan sekali dari pet.
// Aturan & angka dari server (GET /api/kerja, /api/me › kerja); lihat @kb/shared kerja.ts.
import { KERJA_INFO, kerjaDur, type KerjaJob } from '@kb/shared';
import { api } from './api';
import { G, fail, goTo, item, post, refreshMe, run, serverNow, setWorkingHook, settings, toast, track } from './game.svelte';
import { ask } from './account.svelte';
import { tzMin } from './alun.svelte';
import { sfx } from './sfx';

export const K = $state({
  board: null as any,
  loading: false,
  /** hasil "Terima gaji" yang sedang ditampilkan (kartu setelah amplop dibuka) */
  result: null as any,
  /** sedang berangkat ke tempat kerja (peta: pet berjalan ke sana, tidak masuk tempatnya) & sejak kapan */
  going: null as null | string,
  goingAt: 0,
});

export const kerjaOn = () => settings().kerja?.on !== false;
export const shift = (): any => G.me?.kerja?.shift ?? null;
/** pet sedang kerja (waktunya belum habis) */
export const working = () => { const s = shift(); return !!s && G.now > 0 && s.endsAt > serverNow(); };
/** pulang kerja, amplop gaji belum diterima */
export const gajiWaiting = () => { const s = shift(); return !!s && G.now > 0 && s.endsAt <= serverNow(); };
export const infoOf = (job: string) => KERJA_INFO[job as KerjaJob] ?? KERJA_INFO.warung;
export const durText = kerjaDur;
/** "14.30" (jam setempat HP) */
export const jamPulang = (ms: number) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`; };
/** "2 j 15 mnt" / "4 mnt" / "30 dtk" sisa waktu */
export function sisa(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${s} dtk`;
  const m = Math.ceil(s / 60);
  if (m < 60) return `${m} mnt`;
  return `${Math.floor(m / 60)} j ${m % 60} mnt`;
}
/** id lokasi tempat kerja di peta (bila lokasinya dimatikan admin: Papan Lowongan) */
export function workLoc(job: string) {
  const locs: any[] = G.catalog?.locations ?? [];
  const want = infoOf(job).loc;
  return locs.some((l) => l.id === want && l.enabled !== false) ? want : (locs.find((l) => l.kind === 'jobs')?.id ?? 'rumah');
}
/** seragam tempat kerja (dipakai di peta selama kerja walau belum dimiliki) */
export function uniformWear(job: string, wear: Record<string, string> = {}) {
  const out = { ...wear };
  for (const id of infoOf(job).uniform) { const it = item(id); if (it?.data?.slot) out[it.data.slot] = id; }
  return out;
}

export async function loadBoard() {
  K.loading = true;
  try {
    const r = await api.get('/api/kerja');
    K.board = r;
    if (G.me && r.state) G.me.kerja = r.state;
    if (r.serverNow) G.offset = r.serverNow - Date.now();
  } catch (e) { fail(e); } finally { K.loading = false; }
}

/** Berangkat: server memulai shift, lalu pet berjalan di peta ke tempat kerja. */
export async function startJob(job: string, minutes: number) {
  const r: any = await run(() => post('/api/kerja/start', { job, minutes, tz: tzMin() }));
  if (!r) return false;
  sfx.level();
  const loc = workLoc(job);
  K.going = loc;
  K.goingAt = Date.now();
  G.sheet = null;
  G.sheetArg = null;
  goTo(loc);
  toast(`${G.me.pet.name} berangkat ${infoOf(job).doing}. Pulang pukul ${jamPulang(r.kerja.shift.endsAt - G.offset)}.`, 'good', 3200);
  return true;
}

/** Panggil pulang lebih awal (gaji sebanding lama kerja, tanpa bonus, tidak dihitung pangkat). */
export async function recall(confirmFirst = true) {
  const s = shift();
  if (!s) return false;
  if (confirmFirst) {
    const ok = await ask({ title: `Panggil ${G.me.pet.name} pulang?`, text: recallText(s), yes: 'Panggil pulang', no: 'Biarkan kerja' });
    if (!ok) return false;
  }
  const r: any = await run(() => post('/api/kerja/recall'));
  if (!r) { refreshMe().catch(() => {}); return false; }
  sfx.coin();
  K.going = null;
  const res = r.result;
  toast(`${G.me.pet.name} pulang dari ${res.place}. Gaji ${res.paid} koin untuk ${durText(res.workedMinutes)} kerja${res.xp ? `, +${res.xp} XP` : ''}.`, 'good', 3600);
  if (res.levelUp) setTimeout(() => toast(`Naik ke Lv ${res.levelUp}!`, 'good'), 1400);
  if (G.view === 'map' || G.view === 'shop') { G.view = 'home'; }
  if (K.board) loadBoard();
  return true;
}
function recallText(s: any) {
  const done = Math.max(0, serverNow() - s.startedAt), total = Math.max(1, s.endsAt - s.startedAt);
  return `${G.me.pet.name} sudah kerja ${durText(Math.floor(done / 60_000))} dari ${durText(s.minutes)}. Kalau pulang sekarang, gajinya dihitung sesuai lama kerja (${Math.round((done / total) * 100)}%), tanpa barang bonus, dan tidak dihitung untuk naik pangkat.`;
}

/** Terima gaji: amplop dibuka, hasilnya ditampilkan di kartu. */
export async function claim() {
  const r: any = await run(() => post('/api/kerja/claim'));
  if (!r) { refreshMe().catch(() => {}); return null; }
  sfx.coin();
  K.result = r.result;
  K.going = null;
  if (r.result.levelUp) setTimeout(() => toast(`Naik ke Lv ${r.result.levelUp}!`, 'good'), 1600);
  if (K.board) loadBoard();
  return r.result;
}

/** pakai seragam yang baru didapat */
export async function wearUniform(ids: string[]) {
  const wear: Record<string, string> = {};
  for (const id of ids) { const it = item(id); if (it?.data?.slot) wear[it.data.slot] = id; }
  const r = await run(() => api.post('/api/pet/look', { wear }));
  if (r) { sfx.pop(); toast('Seragam dipakai. Gagah!', 'good'); }
  return !!r;
}

/** Aksi yang butuh pet saat pet kerja: pesan ramah + pilihan Panggil pulang. */
export async function kerjaBlocked(msg?: string) {
  const s = shift();
  const pet = G.me?.pet?.name ?? 'Pet-mu';
  if (!s || !working()) { if (msg) toast(msg, 'error'); refreshMe().catch(() => {}); return; }
  const text = msg ?? `${pet} sedang ${s.doing} di ${s.place} sampai pukul ${jamPulang(s.endsAt - G.offset)}. Tunggu ${pet} pulang, atau panggil pulang dulu.`;
  const ok = await ask({ title: `${pet} lagi kerja`, text, yes: 'Panggil pulang', no: 'Nanti saja' });
  if (ok) await recall(false);
}
setWorkingHook((msg) => { void kerjaBlocked(msg); });

/** sebelum aksi yang butuh pet (dari UI): false = ditolak & dialog ditampilkan */
export function petFree(what?: string) {
  if (!working()) return true;
  const s = shift(), pet = G.me?.pet?.name ?? 'Pet-mu';
  void kerjaBlocked(`${pet} sedang ${s.doing} di ${s.place} sampai pukul ${jamPulang(s.endsAt - G.offset)}. ${what ? `${what} bisa lagi setelah ${pet} pulang` : `Tunggu ${pet} pulang`}, atau panggil pulang dulu.`);
  return false;
}

/** waktu kerja habis di layar: muat ulang keadaan (gaji, bonus, cerita) sekali */
let refreshedFor = '';
export function watchShift() {
  const s = shift();
  if (s && !s.done && G.now > 0 && s.endsAt <= serverNow() && refreshedFor !== s.id) {
    refreshedFor = s.id;
    setTimeout(() => refreshMe().catch(() => { refreshedFor = ''; }), 600);
  }
}

/* ---------------- ajakan sekali dari pet: "Aku mau cari kerja sambilan, yuk!" ---------------- */

const AJAK_KEY = 'kb-kerja-ajak';
const ajakDoneBefore = () => { try { return localStorage.getItem(AJAK_KEY) === '1'; } catch { return true; } };
const ajakMark = () => { try { localStorage.setItem(AJAK_KEY, '1'); } catch { /* tidak apa */ } };
/** Papan Lowongan sudah pernah dibuka di HP ini (lencana BARU di peta hilang) */
const SEEN_KEY = 'kb-kerja-seen';
export const boardSeen = () => { try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; } };
export const markBoardSeen = () => { try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* tidak apa */ } };

/** Tampilkan ajakan bila: belum pernah, sudah ±40 detik di rumah, tidak sibuk, belum pernah kerja, pet sehat & tidak tidur. */
export function kerjaAjakCheck(homeSince: number, busy: () => boolean) {
  if (G.ajak || !kerjaOn() || ajakDoneBefore() || busy() || document.hidden || G.view !== 'home') return false;
  if (Date.now() - homeSince < 40_000) return false;
  const k = G.me?.kerja;
  if (!k || k.shift || k.shiftsEver > 0 || G.me?.pet?.sick || G.me?.pet?.sleep) return false;
  if (document.querySelector('svg.room.walking')) return false;
  ajakMark();
  G.speech = null;
  G.ajak = { kind: 'kerja', text: 'Aku mau cari kerja sambilan, yuk!', sub: 'Ada lowongan baru di Papan Lowongan.', alun: 0, reason: 'kerja', down: false, go: 'Lihat lowongan' };
  sfx.pop();
  return true;
}
export function kerjaAjakDone(choice: 'ayo' | 'nanti' | 'lewat') {
  G.ajak = null;
  track('kerja_ajak', { choice });
  if (choice === 'ayo') { sfx.tap(); goTo(G.catalog?.locations?.find((l: any) => l.kind === 'jobs')?.id ?? 'lowongan'); }
}
