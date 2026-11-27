// Sahabat Mungil (game): sahabat milik pemain (G.me.sahabat dari server), aksi (anak ayam pertama, pipit, kunang-kunang,
// ajak / istirahatkan, nama, warna kerang, camilan, main, oleh-oleh, jalan di peta), dan lencana BARU Pondok Sahabat.
// Semua aturan & batas harian di server (routes/sahabat.ts); di sini hanya tampilan & panggilan API.
import { SAHABAT_INFO, SAHABAT_LEVELS, isSahabatSp, kunangOpen, localHM, tanggalWIB, tzOf, type SahabatSp } from '@kb/shared';
import { G, canBuy, item, post, run, serverNow, settings, toast, fx } from './game.svelte';
import { tzMin } from './alun.svelte';
import { sfx } from './sfx';

export type Buddy = { id: string; sp: SahabatSp; name: string; variant: string | null; points: number; lvl: number; level: string; next: string | null; need: number; pct: number; active: boolean; fedToday: boolean; playsLeft: number };
/** sahabat pemain lain (rumah teman, alun-alun, kartu profil) */
export type BuddyLook = { sp: SahabatSp; name: string; v?: string | null; lvl: number };

export const SB = $state({
  /** trik yang sedang dimainkan (Room memasang kelas .trk pada sahabat itu): kunci sahabat & nomor urut */
  trick: null as null | { key: string; n: number },
  /** gelembung kecil di atas sahabat (ciap!, +4 keakraban) */
  say: null as null | { key: string; text: string; n: number },
  /** ketukan main terakhir per sahabat (supaya tidak membanjiri server) */
  lastPlay: {} as Record<string, number>,
});

export const sahabatOn = () => settings().sahabat?.on !== false && G.me?.sahabat?.on !== false;
export const myBuddies = (): Buddy[] => (G.me?.sahabat?.list ?? []).filter((b: any) => isSahabatSp(b.sp));
export const activeBuddy = (): Buddy | null => myBuddies().find((b) => b.active) ?? null;
export const ownsSp = (sp: string) => myBuddies().some((b) => b.sp === sp);
export const spName = (sp: string) => (isSahabatSp(sp) ? item(SAHABAT_INFO[sp].item)?.name ?? SAHABAT_INFO[sp].name : 'Sahabat');
export const levelLabel = (lvl: number) => SAHABAT_LEVELS[Math.max(0, Math.min(2, lvl | 0))];
/** sahabat aktif pemain sendiri dalam bentuk yang sama dengan sahabat pemain lain */
export const myLook = (): BuddyLook | null => { const b = activeBuddy(); return b ? { sp: b.sp, name: b.name, v: b.variant, lvl: b.lvl } : null; };
/** sahabat edisi terbatas (Edisi Natal) yang masih dijual sekarang (masa jual = jadwal jual item-nya, dicek juga di server) */
export const edisiOnSale = (sp: SahabatSp) => { const it = item(SAHABAT_INFO[sp].item); return !!it && canBuy(it); };
/** batas jual sahabat edisi, untuk teks ("6 Januari"); '' bila tanpa batas */
export const edisiUntil = (sp: SahabatSp) => { const t = item(SAHABAT_INFO[sp].item)?.available_to; return t ? tanggalWIB(t) : ''; };
/** sudah malam untuk kunang-kunang (jam setempat, sama dengan aturan server) */
export function kunangNight() {
  const k = settings().sahabat?.kunang ?? { fromHour: 19, toHour: 4 };
  return kunangOpen(localHM(serverNow(), tzOf(tzMin())), k);
}
export const kunangWaiting = () => sahabatOn() && !ownsSp('kunang') && G.now > 0 && kunangNight();

/** cara mendapat sahabat (Album: petunjuk di bawah siluet), dengan harga dari katalog */
export function howText(sp: SahabatSp) {
  const it = item(SAHABAT_INFO[sp].item);
  const k = settings().sahabat?.kunang ?? { fromHour: 19, toHour: 4 };
  const hh = (h: number) => `${String(h % 24).padStart(2, '0')}.00`;
  switch (SAHABAT_INFO[sp].how) {
    case 'gratis': return 'Gratis! Ada anak ayam menunggu di depan pintu rumahmu.';
    case 'koin': return `Adopsi di Pondok Sahabat${it?.price_coin ? ` · ${it.price_coin} koin` : ''}.`;
    case 'mutiara': return `Adopsi di Pondok Sahabat atau Toko Mutiara${it?.price_pearl ? ` · ${it.price_pearl} Mutiara` : ''}.`;
    case 'mancing': return 'Kadang ikut tersangkut kail di Kolam Pancing. Langka!';
    case 'pipit': return 'Pasang Tempat Minum Burung atau Sangkar Burung di Halaman. Pipit akan mampir sendiri.';
    case 'kunang': return `Muncul di halaman rumahmu pukul ${hh(k.fromHour)}–${hh(k.toHour)}. Ketuk untuk menangkapnya.`;
    case 'edisi': { const until = edisiUntil(sp); return `Edisi terbatas di Toko Mutiara${until ? ` sampai ${until}` : ''}.`; }
  }
}

function levelUp(r: any) {
  if (!r?.up) return;
  sfx.level();
  fx('sparkle');
  const pet = G.me?.pet?.name ?? 'pet-mu';
  // sahabat besar Edisi Natal tidak duduk di kepala pet: beruang jadi bantal, rusa berdiri di samping pet
  const akrab = r.sp === 'beruang' ? `jadi bantal empuk saat ${pet} tidur` : r.sp === 'rusa' ? `menemani di samping ${pet} saat duduk atau tidur` : `suka duduk di kepala ${pet}`;
  setTimeout(() => toast(r.up >= 2 ? `${r.name} jadi Sahabat Sejati! Kalung emasnya berkilau.` : `${r.name} sekarang Akrab! Ia punya trik & ${akrab}.`, 'good', 4200), 700);
}

/** sahabat pertama: anak ayam di depan pintu */
export async function claimAyam(name: string) {
  const r: any = await run(() => post('/api/sahabat/ayam', { name }));
  if (r) { sfx.level(); fx('hearts'); toast(`${r.buddy.name} jadi sahabat ${G.me.pet.name}! Ia akan mengikuti ke mana pun.`, 'good', 3600); }
  return r;
}
export async function claimPipit(name: string) {
  const r: any = await run(() => post('/api/sahabat/pipit', { name }));
  if (r) { sfx.level(); fx('hearts'); toast(`${r.buddy.name} si burung pipit mau jadi sahabatmu!`, 'good', 3600); }
  return r;
}
export async function claimKunang(name: string) {
  const r: any = await run(() => post('/api/sahabat/kunang', { name, tz: tzMin() }));
  if (r) { sfx.level(); fx('sparkle'); toast(`${r.buddy.name} si kunang-kunang menemanimu malam ini!`, 'good', 3600); }
  return r;
}
/** adopsi lewat jalur beli toko (koin di Pondok, Mutiara di Pondok / Toko Mutiara) */
export async function adopt(sp: SahabatSp, currency: 'coin' | 'pearl', name?: string) {
  const r: any = await run(() => post('/api/shop/buy', { itemId: SAHABAT_INFO[sp].item, currency, name: name || undefined }));
  if (r) { sfx.level(); fx('hearts'); toast(`${r.buddy.name} si ${spName(sp)} sekarang sahabatmu!`, 'good', 3200); }
  return r;
}
export async function setActive(id: string | null) {
  const r: any = await run(() => post('/api/sahabat/aktif', { id }));
  if (r) { sfx.pop(); const b = myBuddies().find((x) => x.id === id); toast(b ? `${b.name} ikut ${G.me.pet.name} jalan-jalan.` : 'Semua sahabat istirahat di rumah.', 'good'); }
  return r;
}
export async function rename(id: string, name: string) {
  const r: any = await run(() => post('/api/sahabat/nama', { id, name }));
  if (r) { sfx.pop(); toast(`Namanya sekarang ${r.name}.`, 'good'); }
  return r;
}
export async function setShell(id: string, variant: string) {
  const r: any = await run(() => post('/api/sahabat/warna', { id, variant }));
  if (r) sfx.pop();
  return r;
}
export async function feed(b: Buddy) {
  const r: any = await run(() => post('/api/sahabat/makan', { id: b.id }));
  if (r) {
    sfx.eat();
    SB.trick = { key: b.id, n: (SB.trick?.n ?? 0) + 1 };
    toast(`${b.name} makan camilan. Nyam! +${r.result.gain} keakraban`, 'good');
    levelUp(r.result);
  }
  return r;
}
/**
 * Ketuk sahabat: trik langsung dimainkan; keakraban dihitung server (mainPerDay kali sehari). Ketukan cepat berturut-turut
 * hanya dikirim sekali per 1,5 detik, dan tidak dikirim lagi bila jatah hari ini sudah habis.
 */
export async function play(b: Buddy, key = b.id) {
  SB.trick = { key, n: (SB.trick?.n ?? 0) + 1 };
  SB.say = { key, text: SAHABAT_INFO[b.sp].say, n: (SB.say?.n ?? 0) + 1 };
  sfx.pop();
  const now = Date.now();
  if (now - (SB.lastPlay[b.id] ?? 0) < 1500 || b.playsLeft <= 0 || !sahabatOn()) return null;
  SB.lastPlay[b.id] = now;
  const r: any = await run(() => post('/api/sahabat/main', { id: b.id }));
  if (r?.result?.counted) {
    setTimeout(() => { SB.say = { key, text: `+${r.result.gain} keakraban`, n: (SB.say?.n ?? 0) + 1 }; }, 900);
    levelUp(r.result);
  }
  return r;
}
/** oleh-oleh harian dari sahabat aktif */
export async function takeGift() {
  const b = activeBuddy();
  const r: any = await run(() => post('/api/sahabat/oleh'));
  if (r) {
    sfx.coin(); fx('sparkle');
    const g = r.result;
    toast(g.item ? `${g.name} membawa oleh-oleh: ${g.itemName}! Sudah masuk Tas.` : `${g.name} membawa oleh-oleh: ${g.coins} koin!`, 'good', 3600);
    if (b) SB.trick = { key: b.id, n: (SB.trick?.n ?? 0) + 1 };
  }
  return r;
}
/** jalan di peta bersama sahabat aktif: keakraban sekali sehari (server) */
let jalanAt = '';
export async function jalanPeta() {
  if (!activeBuddy() || !sahabatOn() || G.me?.sahabat?.jalan?.peta) return;
  const day = new Date(serverNow() + 7 * 3600_000).toISOString().slice(0, 10);
  if (jalanAt === day) return;
  jalanAt = day;
  try {
    const r: any = await post('/api/sahabat/jalan', { kind: 'peta' });
    if (r?.sahabat && G.me) G.me.sahabat = r.sahabat;
    if (r?.result) { toast(`${r.result.name} senang diajak jalan-jalan keliling kampung! +${r.result.gain} keakraban`, 'good'); levelUp(r.result); }
  } catch { jalanAt = ''; }
}
/** kabar dari sinkron rumah teman / alun-alun: keakraban jalan-jalan bareng (sekali sehari per tempat) */
export function onJalan(j: any) {
  if (!j || !G.me?.sahabat) return;
  const b = G.me.sahabat.list?.find((x: any) => x.id === j.id);
  if (b) { b.points = j.points; b.lvl = j.lvl; b.level = j.level; }
  G.me.sahabat.jalan = { ...(G.me.sahabat.jalan ?? {}), [j.kind]: true };
  setTimeout(() => toast(j.kind === 'alun' ? `${j.name} ikut ke alun-alun. Seru! +${j.gain} keakraban` : `${j.name} ikut berkunjung. +${j.gain} keakraban`, 'good'), 1200);
  levelUp(j);
}

/* ---------- lencana BARU Pondok Sahabat di peta (sampai panelnya dibuka di HP ini) ---------- */
const SEEN = 'kb-pondok-seen';
let seen = $state((() => { try { return localStorage.getItem(SEEN) === '1'; } catch { return false; } })());
export const pondokSeen = () => seen;
export function markPondokSeen() { seen = true; try { localStorage.setItem(SEEN, '1'); } catch { /* tidak apa */ } }

/** buka panel sahabat (tab sahabatku / pondok / album; nama = beri nama sahabat baru) */
export function openSahabat(tab: 'saya' | 'pondok' | 'album' | 'ayam' | 'pipit' | 'kunang' = 'saya', extra: Record<string, unknown> = {}) {
  G.sheetArg = { tab, ...extra };
  G.sheet = 'sahabat';
}
