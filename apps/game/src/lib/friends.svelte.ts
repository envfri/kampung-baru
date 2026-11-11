// Ajakan berteman untuk pemain yang ditemui di alun-alun / rumah teman (harus diterima penerima).
// Kode teman tetap langsung menjadikan berteman (menu Teman).
import { api } from './api';
import { G, toast, fail } from './game.svelte';
import { sfx } from './sfx';

export interface FriendAsk { id: string; from: string; name: string; pet?: any; place?: string }
type Rel = 'friend' | 'sent' | 'incoming' | 'closed';
export const FR = $state({
  /** hubungan dengan pemain yang sedang terlihat */
  rel: {} as Record<string, Rel>,
  /** id ajakan masuk per pengirim (untuk tombol Terima di daftar orang) */
  incoming: {} as Record<string, string>,
  /** ajakan yang baru datang saat live (kartu di layar) */
  asks: [] as FriendAsk[],
  busy: '',
});

/** Muat status Teman / Menunggu / Ajakan masuk untuk daftar pemain. */
export async function loadRelations(ids: string[]) {
  const want = [...new Set(ids.filter(Boolean))].slice(0, 40);
  if (!want.length) return;
  try {
    const r = await api.get(`/api/friends/relations?ids=${want.join(',')}`);
    for (const id of want) { delete FR.rel[id]; delete FR.incoming[id]; }
    for (const id of r.closed ?? []) FR.rel[id] = 'closed';
    for (const id of r.sent ?? []) FR.rel[id] = 'sent';
    for (const x of r.incoming ?? []) { FR.rel[x.from] = 'incoming'; FR.incoming[x.from] = x.id; }
    for (const id of r.friends ?? []) FR.rel[id] = 'friend';
  } catch { /* tombol tetap bisa dipakai, server memeriksa ulang */ }
}

export async function askFriend(id: string, name: string) {
  if (FR.busy) return;
  FR.busy = id;
  try {
    const r = await api.post('/api/friends/requests', { userId: id });
    if (r.status === 'friends') { FR.rel[id] = 'friend'; sfx.level(); toast(`Kamu sekarang berteman dengan ${name}!`, 'good'); G.me.friendsCount = (G.me.friendsCount ?? 0) + 1; }
    else { FR.rel[id] = 'sent'; sfx.pop(); toast(`Ajakan berteman dikirim ke ${name}. Tunggu dia menerimanya, ya.`, 'good'); }
  } catch (e) { fail(e); if ((e as any)?.status === 403) FR.rel[id] = 'closed'; } finally { FR.busy = ''; }
}

/** Jawab ajakan berteman (Terima / Tolak). Penolakan tidak diberitahukan ke pengajak. */
export async function answerAsk(reqId: string, fromId: string, name: string, accept: boolean) {
  FR.asks = FR.asks.filter((a) => a.id !== reqId);
  try {
    await api.post(`/api/friends/requests/${reqId}/${accept ? 'accept' : 'decline'}`);
    if (accept) { FR.rel[fromId] = 'friend'; sfx.level(); toast(`Kamu sekarang berteman dengan ${name}!`, 'good'); G.me.friendsCount = (G.me.friendsCount ?? 0) + 1; }
    else delete FR.rel[fromId];
    delete FR.incoming[fromId];
    G.me.friendAsks = Math.max(0, (G.me.friendAsks ?? 1) - 1);
    return true;
  } catch (e) { fail(e); return false; }
}

/** Kabar live dari respons sinkron alun-alun / rumah. */
export function onPings(pings: any[] | undefined) {
  for (const p of pings ?? []) {
    if (p.kind === 'friend_ask' && p.id && !FR.asks.some((a) => a.id === p.id)) {
      FR.asks = [...FR.asks, { id: p.id, from: p.from, name: p.name, pet: p.pet }];
      FR.rel[p.from] = 'incoming'; FR.incoming[p.from] = p.id;
      G.me.friendAsks = (G.me.friendAsks ?? 0) + 1;
      sfx.pop();
    } else if (p.kind === 'friend_ok') {
      FR.rel[p.from] = 'friend';
      G.me.friendsCount = (G.me.friendsCount ?? 0) + 1;
      sfx.level();
      toast(`${p.name} menerima ajakan berteman. Kalian sekarang berteman!`, 'good');
    }
  }
}
