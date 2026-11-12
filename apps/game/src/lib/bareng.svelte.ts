// Game main bareng (Congklak, Ular Tangga Kampung, Balap Karung Live): keadaan dari server lewat sinkron
// rumah / alun-alun (H.games) dan aksi pemain. Semua aturan & hadiah dihitung server.
import { api } from './api';
import { fail, toast } from './game.svelte';
import { H, SQUARE, poke } from './house.svelte';
import { sfx } from './sfx';

export const BG = $state({
  /** ajakan yang ditutup (Nanti) */
  dismissed: [] as string[],
  /** hasil yang sudah ditutup */
  closed: [] as string[],
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
export const startGame = (game: 'congklak' | 'ular' | 'karung') => {
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
export const GAME_NAMES: Record<string, string> = { congklak: 'Congklak', ular: 'Ular Tangga Kampung', karung: 'Balap Karung Live' };
export function whyText(g: any) {
  return ({ batal: 'Ajakan dibatalkan.', sepi: 'Belum ada yang ikut, ajakan ditutup.', pergi: 'Pemain lain pergi.', waktu: 'Waktu habis.' } as Record<string, string>)[g.why] ?? '';
}
export function toastResult(g: any, me: string) {
  const r = g.results?.find((x: any) => x.id === me);
  if (!r) return;
  if (r.capped) toast('Jatah main bareng hari ini sudah habis, jadi tanpa koin.');
}
