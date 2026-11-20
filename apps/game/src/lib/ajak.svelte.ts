// Pet ngajak ke Alun-alun: catatan jeda & batas per hari (di HP), cek alun-alun, tampil / Ayo! / Nanti.
// Aturan & kalimat: @kb/shared ajak.ts; pengaturan admin: settings.ajakAlun & features.ajakAlun.
import { AJAK_MEMO0, ajakAllowed, ajakNote, ajakPick, ajakText, type AjakMemo } from '@kb/shared';
import { api } from './api';
import { G, goTo, serverNow, settings, track } from './game.svelte';
import { H } from './house.svelte';
import { localNow } from './alun.svelte';
import { sfx } from './sfx';
import { kerjaAjakDone } from './kerja.svelte';

const KEY = 'kb-ajak';
const day = () => new Date().toLocaleDateString('en-CA');
function load(): AjakMemo {
  try { return { ...AJAK_MEMO0, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return { ...AJAK_MEMO0 }; }
}
function save(m: AjakMemo) { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* tidak apa */ } }

export const ajakOn = () => G.catalog?.settings?.features?.ajakAlun !== false && G.catalog?.settings?.square?.enabled !== false;
const rules = () => {
  const a = settings().ajakAlun ?? {};
  return { firstSec: Number(a.firstSec ?? 60), gapMin: Number(a.gapMin ?? 15), perDay: Number(a.perDay ?? 4), minPeople: Number(a.minPeople ?? 1), ramaiFrom: Number(a.ramaiFrom ?? 5), lines: a.lines };
};

/** sedang / baru saja di alun-alun: 10 menit tidak diajak ke sana lagi */
export function ajakLeftAlun() { const m = load(); m.alunAt = Date.now(); save(m); }

let fetchedAt = 0, data: { squares: { id: number; count: number }[]; friends: { name: string; alun: number }[]; enabled: boolean } | null = null;

/** Cek (dipanggil berkala saat di rumah): tampilkan ajakan bila boleh, tidak sibuk & ada orang di alun-alun. */
export async function ajakCheck(homeSince: number, busy: () => boolean) {
  if (G.ajak || !ajakOn() || document.hidden || busy()) return;
  const r = rules(), now = Date.now();
  if (!ajakAllowed(load(), r, now, day(), homeSince)) return;
  // data alun-alun paling lama 2 menit (ringan: hitungan di memori server)
  if (!data || now - fetchedAt > 120_000) {
    fetchedAt = now;
    try { data = await api.get('/api/square'); } catch { data = null; return; }
  }
  // (pemain bisa jadi sibuk selama data dimuat)
  if (!data?.enabled || G.ajak || G.view !== 'home' || busy() || document.hidden) return;
  // tunggu pet berhenti berjalan (gelembung & tombolnya tidak bergerak)
  if (document.querySelector('svg.room.walking')) return;
  const pick = ajakPick({ now: serverNow(), hm: localNow(), squares: data.squares ?? [], friends: data.friends ?? [], minPeople: r.minPeople, ramaiFrom: r.ramaiFrom });
  if (!pick) return;
  const t = ajakText(pick, { pet: G.me?.pet?.name, lines: r.lines });
  save(ajakNote(load(), 'tampil', Date.now(), day()));
  G.speech = null;
  G.ajak = { text: t.text, sub: t.sub, alun: pick.alun, reason: pick.reason, down: false };
  sfx.pop();
}

/** Ayo! / Nanti / hilang sendiri */
export function ajakDone(choice: 'ayo' | 'nanti' | 'lewat') {
  const a = G.ajak;
  if (!a) return;
  // ajakan sekali ke Papan Lowongan (kerja sambilan) memakai gelembung yang sama
  if (a.kind === 'kerja') return kerjaAjakDone(choice);
  G.ajak = null;
  save(ajakNote(load(), choice, Date.now(), day()));
  track('ajak_alun', { reason: a.reason, choice });
  if (choice === 'ayo') { sfx.tap(); H.want = a.alun; goTo('alun'); }
}
