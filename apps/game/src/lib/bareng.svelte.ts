// Game main bareng (Congklak, Ular Tangga Kampung, Balap Karung Live, Catur): keadaan dari server lewat sinkron
// rumah / alun-alun (H.games) dan aksi pemain. Semua aturan & hadiah dihitung server.
import { BARENG_GAMES } from '@kb/shared';
import { api } from './api';
import { fail, toast } from './game.svelte';
import { H, SQUARE, poke } from './house.svelte';
import { sfx } from './sfx';

export const BG = $state({
  /** ajakan yang ditutup (Nanti) */
  dismissed: [] as string[],
  /** hasil yang sudah ditutup */
  closed: [] as string[],
  /** kartu main bareng (ajakan / ruang tunggu / hasil) sedang tampil di atas dock: bar & kartu bawah lain disembunyikan dulu */
  card: false,
  /** sesi yang sedang ditonton (bukan pemain) */
  watching: null as string | null,
  /** selisih jam server - jam perangkat (ms) */
  offset: 0,
  busy: false,
});
export const serverNow = () => Date.now() + BG.offset;

/** gabungkan sesi dari sinkron; sesi lebih baru (seq) menang */
export function syncGames(list: any[]) {
  const prev = new Map(H.games.map((g) => [g.id, g]));
  H.games = list.map((g) => { const p = prev.get(g.id); return p && p.seq > g.seq ? p : g; });
  if (list[0]?.serverNow) BG.offset = list[0].serverNow - Date.now();
}
export function mergeGame(v: any) {
  if (!v) return;
  const i = H.games.findIndex((g) => g.id === v.id);
  if (i < 0) H.games = [...H.games, v];
  else if ((H.games[i].seq ?? 0) <= v.seq) H.games[i] = v;
  if (v.serverNow) BG.offset = v.serverNow - Date.now();
}
async function act(fn: () => Promise<any>) {
  if (BG.busy) return null;
  BG.busy = true;
  try { const r = await fn(); if (r?.game) mergeGame(r.game); poke(); return r; }
  catch (e) { fail(e); return null; } finally { BG.busy = false; }
}
export const startGame = (game: string) => {
  sfx.tap();
  return act(() => api.post('/api/bareng/start', { game, hostId: H.hostId && H.hostId !== SQUARE ? H.hostId : undefined }));
};
export const joinGame = (id: string) => { sfx.tap(); return act(() => api.post(`/api/bareng/${id}/join`)); };
export const goGame = (id: string) => act(() => api.post(`/api/bareng/${id}/go`));
export async function leaveGame(id: string) {
  BG.closed = [...BG.closed, id];
  try { await api.post(`/api/bareng/${id}/leave`); poke(); } catch { /* sudah selesai */ }
}
/** langkah (congklak / ular): tanpa kunci busy supaya giliran terasa cepat */
export async function moveGame(id: string, body: Record<string, unknown>) {
  try { const r = await api.post(`/api/bareng/${id}/move`, body); mergeGame(r.game); return r.game; }
  catch (e: any) { if (e?.code !== 'not_turn') fail(e); return null; }
}
/** kemajuan balap karung (dikirim berkala, tanpa toast bila gagal sesaat) */
export async function raceGame(id: string, body: Record<string, unknown>) {
  try { const r = await api.post(`/api/bareng/${id}/move`, body); mergeGame(r.game); return r.game; } catch { return null; }
}
export const GAME_NAMES: Record<string, string> = { congklak: 'Congklak', ular: 'Ular Tangga Kampung', karung: 'Balap Karung Live', catur: 'Catur', ludo: 'Ludo' };
export function whyText(g: any) {
  if (g.catur?.result?.reason === 'batal') return 'Langkah pertama tidak dibuat dalam 30 detik. Permainan batal, tanpa hadiah.';
  return ({ batal: 'Ajakan dibatalkan.', sepi: 'Belum ada yang ikut, ajakan ditutup.', pergi: 'Pemain lain pergi.', waktu: 'Waktu habis.' } as Record<string, string>)[g.why] ?? '';
}
export function toastResult(g: any, me: string) {
  const r = g.results?.find((x: any) => x.id === me);
  if (!r) return;
  if (r.capped) toast('Jatah main bareng hari ini sudah habis, jadi tanpa koin.');
}

/** langkah catur, menyerah, tawar remis (tanpa kunci busy; galat tampil sebagai toast) */
export async function caturAct(id: string, body: Record<string, unknown>) {
  try { const r = await api.post(`/api/bareng/${id}/move`, body); mergeGame(r.game); return r.game; }
  catch (e: any) { fail(e); poke(); return null; }
}
/**
 * Papan game panjang (Catur, Ludo: BARENG_GAMES[..].long) sedang tampil, sebagai pemain atau penonton.
 * Di HP tombol aksi (Makan…Atur) & kartu rumah teman disembunyikan supaya papan muat di antara HUD & dok.
 */
export function longBoardNow() {
  return H.games.some((g: any) => (BARENG_GAMES as Record<string, { long?: boolean }>)[g.game]?.long && !BG.closed.includes(g.id) && (g.phase === 'main' || g.phase === 'selesai')
    && (g.players?.some((p: any) => p.id === H.me && !p.left) || BG.watching === g.id));
}

/** Sedang bermain (bukan menonton): kartu Sapa/Ngobrol di rumah & alun-alun disembunyikan supaya papan lebih luas. */
export function inGameNow() {
  return H.games.some((g: any) => (g.phase === 'main' || g.phase === 'siap') && !BG.closed.includes(g.id) && g.players?.some((p: any) => p.id === H.me && !p.left));
}
