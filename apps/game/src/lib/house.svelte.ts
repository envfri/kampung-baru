// Rumah "live": siapa saja yang sedang ada di rumah yang sama (tuan rumah + tamu, di ruangan mana pun), obrolan, ekspresi,
// main bareng, dan foto. Disinkronkan lewat polling (tamu ±0,9 detik; tuan rumah yang sendirian lebih jarang).
import { G, toast, fail, refreshMe, merge } from './game.svelte';
import { api, ApiError } from './api';
import { onPings } from './friends.svelte';
import { syncGames } from './bareng.svelte';
import { sfx } from './sfx';
import { ALUN, previewLomba } from './alun.svelte';

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
  /** alun-alun: nomor alun-alun, jumlah orang, alun-alun lain yang ramai, pemain yang disembunyikan (diblokir) */
  inst: 0,
  /** alun-alun yang ingin disusul (teman di sana); dipakai sekali saat masuk */
  want: 0,
  count: 0,
  max: 20,
  others: [] as { id: number; count: number }[],
  hidden: [] as string[],
  /** game main bareng di tempat ini (Congklak, Ular Tangga, Balap Karung Live) dari sinkron */
  games: [] as any[],
  /** kartu profil pemain yang diketuk (id pemain) */
  card: null as string | null,
  /** efek di pet pemain lain yang diminta dari luar Room (mis. tombol Kirim hati di kartu profil) */
  fxReq: null as null | { id: string; kind: string; n: number },
});
/** id tempat live untuk alun-alun (rumah memakai id tuan rumah) */
export const SQUARE = 'alun';
const base = () => (H.hostId === SQUARE ? '/api/square' : `/api/house/${H.hostId}`);

let timer: any = null, seq = 0, boot = '', busy = false, pendingEmote: string | null = null, bubbleId = 0, gen = 0, fails = 0;
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
    const r = await api.post(`${base()}/sync`, { roomId: H.roomId, x: H.pos.x, y: H.pos.y, flip: H.pos.flip, act: H.pos.act, emote: sending ?? undefined, since: seq, inst: H.inst || H.want || undefined });
    fails = 0;
    if (pendingEmote === sending) pendingEmote = null;
    if (myGen !== gen) return;
    // server baru restart: nomor urut kejadian mulai lagi dari awal
    if (r.boot && r.boot !== boot) { if (boot) seq = 0; boot = r.boot; }
    H.live = !!r.live; H.full = !!r.full; H.reason = r.reason ?? '';
    if (H.hostId === SQUARE && r.live) {
      // pindah ke alun-alun lain (mis. penuh): nomor urut kejadian mulai lagi
      if (H.inst && r.inst !== H.inst) seq = 0;
      // menyusul teman tapi alun-alunnya sudah penuh
      if (H.want && r.inst !== H.want) toast(`Alun-alun ${H.want} sudah penuh, kamu masuk Alun-alun ${r.inst}.`);
      H.want = 0;
      H.inst = r.inst; H.count = r.count; H.max = r.max; H.others = r.others ?? [];
      if (r.welcome) { merge(r.welcome); toast(`Selamat datang di Alun-alun! +${r.welcome.coins} koin`, 'good'); }
      // Lomba Mancing (papan skor / hasil) untuk bar & papan alun-alun
      ALUN.lomba = previewLomba(r.serverNow ?? Date.now()) ?? r.lomba ?? null;
    }
    if (H.hostId === SQUARE && !r.live && r.reason) {
      // alun-alun ditutup admin / pet tertidur: kembali ke peta kampung
      leaveHouse();
      if (G.view === 'alun') { G.view = 'map'; G.mapAt = 'alun'; }
      toast(r.reason === 'asleep' ? `${G.me?.pet?.name ?? 'Pet'} sedang tidur. Bangunkan dulu, ya.` : 'Alun-alun sedang ditutup.');
      return;
    }
    if (r.reason === 'kicked') { leaveHouse(); if (G.view === 'visit') { G.view = 'home'; G.visit = null; } toast('Tuan rumah mengantarmu pulang.'); return; }
    if (r.live) {
      H.me = r.me;
      H.members = (r.members ?? []).filter((m: LiveMember) => !H.hidden.includes(m.id));
      H.elsewhere = r.elsewhere ?? [];
      H.coop = r.coop;
      for (const e of r.events ?? []) handle(e);
      seq = Math.max(seq, r.seq ?? 0);
      onPings(r.pings);
      if (Array.isArray(r.games)) syncGames(r.games);
    } else { H.members = []; H.elsewhere = []; H.coop = null; }
  } catch (e) {
    // alun-alun menolak (mis. belum punya pet): jangan mencoba terus, kembali ke peta
    if (e instanceof ApiError && H.hostId === SQUARE && e.status >= 400 && e.status < 500 && e.status !== 429) {
      busy = false;
      leaveHouse();
      if (G.view === 'alun') { G.view = 'map'; G.mapAt = 'alun'; }
      toast(e.message || 'Alun-alun sedang tidak bisa dimasuki.');
      return;
    }
    // tidak boleh lagi di rumah ini (diblokir / tidak berteman lagi): pulang
    if (e instanceof ApiError && e.status === 403 && H.hostId !== G.me?.user?.id) {
      busy = false;
      leaveHouse();
      if (G.view === 'visit') { G.view = 'home'; G.visit = null; }
      toast('Kamu tidak bisa berada di rumah itu lagi.');
      return;
    }
    // sinyal lemah: coba lagi; setelah beberapa kali gagal tampilkan "menyambung" & bekukan daftar orang
    if (++fails >= 3) { H.live = false; H.members = []; }
  } finally { busy = false; }
  schedule(myGen);
}
function schedule(myGen: number) {
  clearTimeout(timer);
  if (myGen !== gen || !H.hostId) return;
  // tuan rumah tanpa tamu cukup sesekali (supaya tamu yang datang terlihat); rumah yang tidak live jarang dicek; selain itu ±0,9 detik
  const alone = H.hostId === G.me?.user?.id && others() === 0 && !H.coop;
  // sendirian di alun-alun: cukup tiap 3 detik
  const lonely = H.hostId === SQUARE && H.live && H.count <= 1;
  timer = setTimeout(() => tick(myGen), !H.live && H.reason ? 15000 : alone ? 8000 : lonely ? 3000 : fails >= 3 ? 3000 : 900);
}

function handle(e: any) {
  const mine = e.from === H.me;
  const square = H.hostId === SQUARE;
  // sinkron pertama berisi kejadian ±1 menit terakhir: tidak diputar ulang
  if (!seq && ['say', 'emote', 'act', 'photo'].includes(e.kind)) return;
  // di alun-alun orang datang & pergi terus: tidak perlu diberitahu satu per satu
  if (square && (e.kind === 'join' || e.kind === 'leave')) return;
  switch (e.kind) {
    case 'join': if (!mine && seq) { toast(e.host ? `${e.name} pulang ke rumah. Halo!` : `${e.name} datang main!`, 'good'); sfx.pop(); } break;
    case 'leave': if (!mine && seq) toast(`${e.name} pulang.`); break;
    case 'say': if (!mine && !H.hidden.includes(e.from)) { bubble(e.from, { text: e.text }); sfx.tap(); } break;
    case 'emote': if (!mine) bubble(e.from, { emote: e.emote }, 2600); break;
    case 'act': if (!mine && !H.hidden.includes(e.from)) bubble(e.from, { text: ACT_SAY[e.act] ?? 'Main yuk!' }, 3000); break;
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
    case 'photo':
      // hanya bila kamu ikut difoto (di alun-alun foto orang asing tidak masuk albummu)
      if (!mine && seq && (!e.members || e.members.includes(H.me)) && !square) { sfx.coin(); toast(`${nameOf(e.from)} mengambil foto bareng! Lihat di album.`, 'good'); }
      else if (!mine && seq && square && e.members?.includes(H.me)) { sfx.coin(); toast(`${nameOf(e.from)} memotretmu di foto bareng!`, 'good'); }
      break;
  }
}
export const ACT_SAY: Record<string, string> = { sapa: 'Halo!', peluk: 'Peluk!', camilan: 'Ini camilan!', kejar: 'Kejar aku!', duduk: 'Duduk bareng, yuk', nonton: 'Seru!', naik: 'Wiii!', ayun: 'Hore!', joget: 'Joget!', teduh: 'Adem…' };

/** Masuk ke rumah (tamu atau tuan rumah). Aman dipanggil berulang. */
export function enterHouse(hostId: string, roomId: string) {
  if (H.hostId === hostId) { if (H.roomId !== roomId) { H.roomId = roomId; poke(); } return; }
  leaveHouse();
  gen++;
  H.hostId = hostId; H.roomId = roomId; seq = 0;
  H.members = []; H.elsewhere = []; H.coop = null; H.bubbles = []; H.live = false; H.full = false;
  H.inst = 0; H.count = 0; H.others = []; H.card = null; H.games = []; pendingEmote = null; fails = 0;
  if (hostId !== SQUARE) H.want = 0;
  tick(gen);
}
export function poke() { clearTimeout(timer); tick(gen); }
export function leaveHouse() {
  const h = H.hostId;
  gen++;
  clearTimeout(timer);
  H.hostId = null; H.members = []; H.elsewhere = []; H.coop = null; H.live = false;
  H.inst = 0; H.count = 0; H.others = []; pendingEmote = null;
  if (h) api.post(h === SQUARE ? '/api/square/leave' : `/api/house/${h}/leave`).catch(() => {});
}

export async function say(text: string) {
  if (!H.hostId) return false;
  try {
    await api.post(`${base()}/say`, { text });
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
    // posisi terbaru ikut dikirim (sinkron bisa tertinggal ±1 detik)
    const r = await api.post(`${base()}/photo`, { roomId: H.roomId, pose, x: H.pos.x, y: H.pos.y });
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
  try {
    await api.post('/api/blocks', { userId });
    // langsung hilang dari layar (tanpa menunggu sinkron berikutnya)
    H.hidden = [...H.hidden, userId];
    H.members = H.members.filter((m) => m.id !== userId);
    toast(H.hostId === SQUARE ? `${name} diblokir. Kalian tidak akan saling melihat lagi.` : `${name} diblokir. Kalian tidak berteman lagi.`);
    poke();
  } catch (e) { fail(e); }
}
/** Kirim hati ke pet pemain lain: efek hati di pet itu + ekspresi hati (terlihat semua yang ada di sini). */
export function sendHeart(userId: string) { H.fxReq = { id: userId, kind: 'hearts', n: (H.fxReq?.n ?? 0) + 1 }; emote('hati'); }
/** Blokir dibuka (Pengaturan): tampilkan lagi pemain itu. */
export function unhide(userId: string) { H.hidden = H.hidden.filter((x) => x !== userId); }
/** Laporkan pemain di alun-alun (obrolan / perilaku tidak sopan). */
export async function report(userId: string, name: string, reason: string) {
  try { await api.post('/api/square/report', { userId, reason }); toast(`Laporan tentang ${name} terkirim. Terima kasih!`, 'good'); return true; } catch (e) { fail(e); return false; }
}
