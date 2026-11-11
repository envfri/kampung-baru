// Kabar singkat untuk pemain yang sedang live (alun-alun / rumah): diantar lewat respons sinkron berikutnya.
// Dipakai untuk ajakan berteman (muncul langsung di layar) dan kabar ajakan diterima. Catatan tetap ada di
// kotak notifikasi, jadi kabar yang tidak sempat terambil (pemain sedang tidak live) tidak hilang.
export type Ping = { kind: 'friend_ask' | 'friend_ok'; id?: string; from: string; name: string; pet?: any; at: number };
const PINGS = new Map<string, Ping[]>();
const TTL = 5 * 60_000;

export function ping(uid: string, p: Omit<Ping, 'at'>) {
  const list = (PINGS.get(uid) ?? []).filter((x) => Date.now() - x.at < TTL && !(x.kind === p.kind && x.from === p.from));
  list.push({ ...p, at: Date.now() });
  PINGS.set(uid, list.slice(-10));
}
export function takePings(uid: string): Ping[] {
  const list = PINGS.get(uid);
  if (!list) return [];
  PINGS.delete(uid);
  return list.filter((x) => Date.now() - x.at < TTL);
}
export function resetPings() { PINGS.clear(); }
setInterval(() => { const now = Date.now(); for (const [k, v] of PINGS) if (!v.some((x) => now - x.at < TTL)) PINGS.delete(k); }, 60_000).unref?.();
