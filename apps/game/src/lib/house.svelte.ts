// Rumah "live": siapa saja yang sedang ada di rumah yang sama (tuan rumah + tamu, di ruangan mana pun), obrolan, ekspresi,
// main bareng, dan foto. Disinkronkan lewat polling (tamu ±0,9 detik; tuan rumah yang sendirian lebih jarang).
import { G, toast, fail, refreshMe } from './game.svelte';
import { api, ApiError } from './api';
import { sfx } from './sfx';

export type Bubble = { id: number; who: string; text?: string; emote?: string; until: number };
/** posisi (x, y) di dalam ruangan `roomId`; layar rumah memetakannya ke denah */
export type LiveMember = { id: string; name: string; pet: any; roomId?: string; x: number; y: number; flip: boolean; act: string | null; host: boolean };

export const H = $state({
  hostId: null as string | null,
  roomId: '',
  live: false,
  full: false,
  reason: '' as string,
  me: '' as string,
  members: [] as LiveMember[],
  elsewhere: [] as { id: string; name: string; host: boolean }[],
  coop: null as any,
  coopSeen: '' as string,
  bubbles: [] as Bubble[],
  /** ruangan & posisi pet di dalamnya yang dilaporkan (diisi Room 5× per detik) */
  pos: { x: 0, y: 0, flip: false, act: null as string | null },
  photo: null as any,
  /** permintaan aksi ke pet teman dari bar kunjungan (dijalankan Room: pet berjalan, beraksi, kirim ke server) */
  actReq: null as null | { kind: string; itemId?: string },
});

let timer: any = null, seq = 0, boot = '', busy = false, pendingEmote: string | null = null, bubbleId = 0, gen = 0;
const others = () => H.members.length + H.elsewhere.length;

export function bubble(who: string, b: { text?: string; emote?: string }, ms = 4200) {
  const id = ++bubbleId;
  H.bubbles = [...H.bubbles.filter((x) => x.who !== who && x.until > Date.now()), { id, who, ...b, until: Date.now() + ms }];
  setTimeout(() => { H.bubbles = H.bubbles.filter((x) => x.id !== id); }, ms + 50);
}
const nameOf = (id: string) => H.members.find((m) => m.id === id)?.name ?? H.elsewhere.find((m) => m.id === id)?.name ?? 'Teman';

async function tick(myGen: number) {
  if (myGen !== gen || !H.hostId) return;
  if (busy || document.hidden) return schedule(myGen);
  busy = true;
  try {
    // ekspresi yang ditekan selama permintaan berjalan tetap terkirim di sinkron berikutnya
    const sending = pendingEmote;
    const r = await api.post(`/api/house/${H.hostId}/sync`, { roomId: H.roomId, x: H.pos.x, y: H.pos.y, flip: H.pos.flip, act: H.pos.act, emote: sending ?? undefined, since: seq });
    if (pendingEmote === sending) pendingEmote = null;
    if (myGen !== gen) return;
    // server baru restart: nomor urut kejadian mulai lagi dari awal
    if (r.boot && r.boot !== boot) { if (boot) seq = 0; boot = r.boot; }
    H.live = !!r.live; H.full = !!r.full; H.reason = r.reason ?? '';
    if (r.reason === 'kicked') { leaveHouse(); if (G.view === 'visit') { G.view = 'home'; G.visit = null; } toast('Tuan rumah mengantarmu pulang.'); return; }
    if (r.live) {
      H.me = r.me;
      H.members = r.members ?? [];
      H.elsewhere = r.elsewhere ?? [];
      H.coop = r.coop;
      for (const e of r.events ?? []) handle(e);
      seq = Math.max(seq, r.seq ?? 0);
    } else { H.members = []; H.elsewhere = []; H.coop = null; }
  } catch (e) {
    // tidak boleh lagi di rumah ini (diblokir / tidak berteman lagi): pulang
    if (e instanceof ApiError && e.status === 403 && H.hostId !== G.me?.user?.id) {
      busy = false;
      leaveHouse();
      if (G.view === 'visit') { G.view = 'home'; G.visit = null; }
      toast('Kamu tidak bisa berada di rumah itu lagi.');
      return;
    }
    /* sinyal lemah: coba lagi */
  } finally { busy = false; }
  schedule(myGen);
}
function schedule(myGen: number) {
  clearTimeout(timer);
  if (myGen !== gen || !H.hostId) return;
  // tuan rumah tanpa tamu cukup sesekali (supaya tamu yang datang terlihat); rumah yang tidak live jarang dicek; selain itu ±0,9 detik
  const alone = H.hostId === G.me?.user?.id && others() === 0 && !H.coop;
  timer = setTimeout(() => tick(myGen), !H.live && H.reason ? 15000 : alone ? 8000 : 900);
}

function handle(e: any) {
  const mine = e.from === H.me;
  switch (e.kind) {
    case 'join': if (!mine && seq) { toast(e.host ? `${e.name} pulang ke rumah. Halo!` : `${e.name} datang main!`, 'good'); sfx.pop(); } break;
    case 'leave': if (!mine && seq) toast(`${e.name} pulang.`); break;
    case 'say': if (!mine) { bubble(e.from, { text: e.text }); sfx.tap(); } break;
    case 'emote': if (!mine) bubble(e.from, { emote: e.emote }, 2600); break;
    case 'act': if (!mine) bubble(e.from, { text: ACT_SAY[e.act] ?? 'Main yuk!' }, 3000); break;
    case 'kick': if (e.target !== H.me && seq) toast(`${e.name} diantar pulang.`); break;
    case 'coop_start': if (!mine && seq) { sfx.pop(); H.coopSeen = ''; } break;
    case 'coop_join': if (!mine && seq && H.coop?.starter === H.me) sfx.pop(); break;
    case 'coop_go': if (seq && H.coop?.players?.some((p: any) => p.id === H.me)) { sfx.level(); toast(e.game === 'masak' ? 'Ayo masak bareng!' : 'Ayo lempar bola!', 'good'); } break;
    case 'coop_end':
      if (!seq) break;
      // ajakan yang tidak diikuti siapa pun
      if (e.why === 'sepi' && H.coop?.starter === H.me) { toast('Belum ada yang ikut main. Coba ajak lagi nanti, ya.'); break; }
      { const me = (e.results ?? []).find((x: any) => x.id === H.me); if (me && !me.none) { e.ok ? sfx.level() : sfx.pop(); refreshMe().catch(() => {}); } }
      break;
    case 'photo': if (!mine && seq) { sfx.coin(); toast(`${nameOf(e.from)} mengambil foto bareng! Lihat di album.`, 'good'); } break;
  }
}
export const ACT_SAY: Record<string, string> = { sapa: 'Halo!', peluk: 'Peluk!', camilan: 'Ini camilan!', kejar: 'Kejar aku!', duduk: 'Duduk bareng, yuk' };

/** Masuk ke rumah (tamu atau tuan rumah). Aman dipanggil berulang. */
export function enterHouse(hostId: string, roomId: string) {
  if (H.hostId === hostId) { if (H.roomId !== roomId) { H.roomId = roomId; poke(); } return; }
  leaveHouse();
  gen++;
  H.hostId = hostId; H.roomId = roomId; seq = 0;
  H.members = []; H.elsewhere = []; H.coop = null; H.bubbles = []; H.live = false; H.full = false;
  tick(gen);
}
export function poke() { clearTimeout(timer); tick(gen); }
export function leaveHouse() {
  const h = H.hostId;
  gen++;
  clearTimeout(timer);
  H.hostId = null; H.members = []; H.elsewhere = []; H.coop = null; H.live = false;
  if (h) api.post(`/api/house/${h}/leave`).catch(() => {});
}

export async function say(text: string) {
  if (!H.hostId) return false;
  try {
    await api.post(`/api/house/${H.hostId}/say`, { text });
    bubble(H.me || 'me', { text });
    poke();
    return true;
  } catch (e) { fail(e); return false; }
}
export function emote(kind: string) { pendingEmote = kind; bubble(H.me || 'me', { emote: kind }, 2600); poke(); }

export async function coop(body: Record<string, unknown>) {
  if (!H.hostId) return null;
  try {
    const r = await api.post(`/api/house/${H.hostId}/coop`, body);
    H.coop = r.coop;
    poke();
    return r.coop;
  } catch (e) {
    if (e instanceof ApiError && e.code === 'coop_over') { poke(); return null; }
    fail(e); return null;
  }
}

export async function takePhoto(pose: string) {
  if (!H.hostId) return null;
  try {
    const r = await api.post(`/api/house/${H.hostId}/photo`, { roomId: H.roomId, pose });
    sfx.coin();
    H.photo = r.photo;
    poke();
    return r.photo;
  } catch (e) { fail(e); return null; }
}

export async function kick(userId: string) {
  if (!H.hostId) return;
  try { await api.post(`/api/house/${H.hostId}/kick`, { userId }); poke(); } catch (e) { fail(e); }
}
/** Blokir: putus pertemanan & tidak bisa berkunjung lagi. */
export async function block(userId: string, name: string) {
  try { await api.post('/api/blocks', { userId }); toast(`${name} diblokir. Kalian tidak berteman lagi.`); poke(); } catch (e) { fail(e); }
}
