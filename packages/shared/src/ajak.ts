// Pet ngajak ke Alun-alun: saat pemain di rumahnya sendiri dan ada orang lain di alun-alun, pet sesekali mengajak
// lewat gelembung bicara ("Ke alun-alun yuk! Wajik lagi di sana."). Di sini: pilih alasan ajakan & susun kalimatnya
// (dipakai game, diuji di server). Jadwal acara memakai jadwal alun-alun yang sama (lomba, arak-arakan, kembang api).
import { cycleAt, lombaAt, PARADE } from './square';

export type AjakReason = 'teman' | 'kembangApi' | 'lomba' | 'arak' | 'sedikit' | 'ramai';

export interface AjakInput {
  /** waktu server (ms) untuk jadwal lomba & arak-arakan */
  now: number;
  /** jam & menit setempat pemain (kembang api 20.00 & 21.00) */
  hm: { h: number; m: number };
  /** jumlah orang tiap alun-alun (dari GET /api/square) */
  squares: { id: number; count: number }[];
  /** teman yang sedang di alun-alun (nama pet, nomor alun-alun) */
  friends?: { name: string; alun: number }[];
  /** paling sedikit sekian orang lain baru mengajak */
  minPeople?: number;
  /** mulai sekian orang disebut "ramai" */
  ramaiFrom?: number;
}

export interface AjakPick {
  reason: AjakReason;
  /** alun-alun tujuan (tempat teman, atau yang paling ramai) */
  alun: number;
  /** orang di alun-alun tujuan */
  count: number;
  /** semua orang di semua alun-alun */
  total: number;
  /** nama pet teman di alun-alun (maks 3) */
  friends: string[];
  /** menit sampai acara mulai (kembang api, lomba, arak-arakan) */
  menit?: number;
}

/** Kembang api ≤ 5 menit lagi (19.55–19.59 & 20.55–20.59 waktu setempat): sisa menit, atau null. */
export function kembangApiSoon(hm: { h: number; m: number }) {
  if ((hm.h === 19 || hm.h === 20) && hm.m >= 55) return 60 - hm.m;
  return null;
}

/** Pilih alasan ajakan yang paling menarik (kembang api, lomba, arak-arakan yang segera mulai → teman di sana → keramaian);
 *  null bila tidak ada orang lain (cukup) di alun-alun. */
export function ajakPick(i: AjakInput): AjakPick | null {
  const squares = (i.squares ?? []).filter((q) => q.count > 0);
  const total = squares.reduce((a, q) => a + q.count, 0);
  const friends = (i.friends ?? []).filter((f) => f && f.name);
  const min = Math.max(1, i.minPeople ?? 1);
  if (!friends.length && total < min) return null;
  const busiest = squares.reduce<{ id: number; count: number } | null>((a, q) => (!a || q.count > a.count ? q : a), null);
  const at = (id: number) => squares.find((q) => q.id === id)?.count ?? 0;
  const names = friends.map((f) => f.name).slice(0, 3);
  // tujuan: alun-alun tempat teman (yang paling banyak temannya), atau yang paling ramai
  let alun = busiest?.id ?? 1;
  if (friends.length) {
    const per = new Map<number, number>();
    for (const f of friends) per.set(f.alun || 1, (per.get(f.alun || 1) ?? 0) + 1);
    alun = [...per.entries()].sort((a, b) => b[1] - a[1] || at(b[0]) - at(a[0]) || a[0] - b[0])[0][0];
  }
  const base = { alun, count: Math.max(at(alun), friends.filter((f) => (f.alun || 1) === alun).length), total: Math.max(total, friends.length), friends: names };
  // acara yang segera mulai lebih dulu (teman yang ada di sana disebut di keterangan), lalu teman, lalu keramaian
  const kembang = kembangApiSoon(i.hm);
  if (kembang !== null) return { reason: 'kembangApi', ...base, menit: kembang };
  const l = lombaAt(i.now);
  if (l.phase !== 'lomba' && l.inMs > 0 && l.inMs <= 3 * 60_000) return { reason: 'lomba', ...base, menit: Math.max(1, Math.ceil(l.inMs / 60_000)) };
  const p = cycleAt(i.now, PARADE.everyMs, PARADE.offsetMs, PARADE.durMs);
  if (!p.on && p.start - i.now <= 2 * 60_000) return { reason: 'arak', ...base, menit: Math.max(1, Math.ceil((p.start - i.now) / 60_000)) };
  if (friends.length) return { reason: 'teman', ...base };
  return { reason: total >= (i.ramaiFrom ?? 5) ? 'ramai' : 'sedikit', ...base };
}

/** "Wajik", "Wajik & Putu", "Wajik, Putu & 2 lainnya" (maks 2 nama, sisanya dihitung) */
export function ajakNames(names: string[], more = 0, word = 'lainnya') {
  const n = names.filter(Boolean).slice(0, 2);
  const extra = more + Math.max(0, names.filter(Boolean).length - 2);
  if (!n.length) return '';
  if (extra <= 0) return n.length === 1 ? n[0] : `${n[0]} & ${n[1]}`;
  return `${n.join(', ')} & ${extra} ${word}`;
}

export const AJAK_LINES: Record<AjakReason, string[]> = {
  teman: ['Ke alun-alun yuk! {teman} lagi di sana.', '{teman} lagi di alun-alun, susul yuk!'],
  kembangApi: ['Sebentar lagi ada kembang api! Nonton bareng yuk?', 'Kembang api {menit} menit lagi! Ke alun-alun yuk?'],
  lomba: ['Lomba Mancing mulai {menit} menit lagi. Ikut yuk!'],
  arak: ['Arak-arakan ondel-ondel mau lewat! Ikut yuk?'],
  sedikit: ['Ada {jumlah} orang di alun-alun, samperin yuk?', 'Di alun-alun ada {jumlah} orang. Main ke sana yuk?'],
  ramai: ['Alun-alun lagi ramai, {jumlah} orang! Main ke sana yuk?', 'Wah, alun-alun ramai banget! Ke sana yuk?'],
};

/** Kalimat ajakan + keterangan kecil. `lines` = kalimat dari admin (kosong → bawaan); `rand` untuk uji. */
export function ajakText(p: AjakPick, o: { pet?: string; lines?: Partial<Record<AjakReason, string[]>>; rand?: () => number } = {}) {
  const pool = (o.lines?.[p.reason]?.filter((s) => s && s.trim()).length ? o.lines![p.reason]! : AJAK_LINES[p.reason]).filter((s) => s && s.trim());
  const r = o.rand ?? Math.random;
  const tmpl = pool[Math.floor(r() * pool.length) % pool.length] ?? AJAK_LINES[p.reason][0];
  const teman = ajakNames(p.friends, 0, 'teman lain');
  const text = tmpl
    .replace(/\{teman\}/g, teman || 'Temanmu')
    .replace(/\{jumlah\}/g, String(p.total))
    .replace(/\{menit\}/g, String(p.menit ?? 1))
    .replace(/\{pet\}/g, o.pet ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  const others = Math.max(0, p.count - p.friends.length);
  const where = `Alun-alun ${p.alun} · ${p.count} orang`;
  const sub = p.reason === 'teman' ? where
    : p.reason === 'sedikit' || p.reason === 'ramai' ? ''
    : p.friends.length ? `${ajakNames(p.friends, others)} di sana`
    : where;
  return { text, sub };
}

/* ---------------- jeda & batas per hari (disimpan di HP pemain) ---------------- */

export interface AjakMemo { day: string; n: number; last: number; nanti: number; mute: boolean; alunAt: number }
export const AJAK_MEMO0: AjakMemo = { day: '', n: 0, last: 0, nanti: 0, mute: false, alunAt: 0 };
export interface AjakRules { firstSec: number; gapMin: number; perDay: number }

/** Boleh mengajak sekarang? homeSince = sejak kapan pemain di rumah (ms). */
export function ajakAllowed(memo: AjakMemo, rules: AjakRules, now: number, day: string, homeSince: number) {
  const m = memo.day === day ? memo : { ...AJAK_MEMO0, alunAt: memo.alunAt };
  if (m.mute) return false;
  if (m.n >= rules.perDay) return false;
  if (now - homeSince < rules.firstSec * 1000) return false;
  if (m.last && now - m.last < rules.gapMin * 60_000) return false;
  if (m.alunAt && now - m.alunAt < 10 * 60_000) return false;
  return true;
}
/** Catat hasil ajakan: 'tampil' saat muncul, lalu 'ayo' / 'nanti' / 'lewat' (hilang sendiri). */
export function ajakNote(memo: AjakMemo, ev: 'tampil' | 'ayo' | 'nanti' | 'lewat', now: number, day: string): AjakMemo {
  const m: AjakMemo = memo.day === day ? { ...memo } : { ...AJAK_MEMO0, alunAt: memo.alunAt, day };
  if (ev === 'tampil') { m.n += 1; m.last = now; }
  else if (ev === 'nanti') { m.nanti += 1; if (m.nanti >= 2) m.mute = true; }
  else if (ev === 'ayo') m.nanti = 0;
  return m;
}

/** Cek pengaturan ajakAlun dari admin (fail dipanggil dengan pesan yang bisa dibaca admin). */
export function checkAjakAlun(a: any, fail: (msg: string) => void) {
  const int = (v: unknown, lo: number, hi: number) => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;
  if (!a || typeof a !== 'object') return fail('Ajakan ke Alun-alun: pengaturan tidak valid.');
  if (!int(a.firstSec, 5, 600)) return fail('Ajakan ke Alun-alun: firstSec harus bilangan bulat 5–600 detik.');
  if (!int(a.gapMin, 1, 240)) return fail('Ajakan ke Alun-alun: gapMin harus bilangan bulat 1–240 menit.');
  if (!int(a.perDay, 0, 20)) return fail('Ajakan ke Alun-alun: perDay harus bilangan bulat 0–20.');
  if (!int(a.minPeople, 1, 20)) return fail('Ajakan ke Alun-alun: minPeople harus bilangan bulat 1–20.');
  if (!int(a.ramaiFrom, 2, 50)) return fail('Ajakan ke Alun-alun: ramaiFrom harus bilangan bulat 2–50.');
  for (const k of Object.keys(AJAK_LINES)) {
    const l = a.lines?.[k];
    if (!Array.isArray(l) || l.length > 12 || l.some((x: unknown) => typeof x !== 'string' || x.length > 120)) return fail(`Ajakan ke Alun-alun: kalimat "${k}" harus daftar teks (maks 12 baris, tiap baris maks 120 huruf).`);
  }
}
