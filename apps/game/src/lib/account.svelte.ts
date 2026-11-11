// Akun tamu & pindah perangkat: konfirmasi pindah akun, ajakan "Simpan progres", hasil login/tautkan.
import { G, setState, toast, settings, track } from './game.svelte';
import { ApiError } from './api';
import { sfx } from './sfx';

const PROVIDER: Record<string, string> = { google: 'Google', email: 'email', facebook: 'Facebook' };

/** Dialog ya/tidak di dalam game. */
export function ask(o: { title: string; text: string; yes: string; no?: string; danger?: boolean }) {
  return new Promise<boolean>((resolve) => { G.confirm = { no: 'Batal', ...o, resolve: (ok) => { G.confirm = null; resolve(ok); } }; });
}

const who = (s: any) => (s?.pet ? `${s.pet} (Lv ${s.level})${s.name && s.name !== s.pet && s.name !== 'Tamu' ? ` milik ${s.name}` : ''}` : s?.name ?? 'akun lain');

/**
 * Jalankan login/tautkan/tebus kode. Bila server bilang ini akun BUPI lain, tanya dulu sebelum pindah,
 * lalu ulangi dengan { switch: true }.
 */
export async function withSwitch(call: (extra: Record<string, unknown>) => Promise<any>, via = '') {
  try { return await call({}); }
  catch (e) {
    if (!(e instanceof ApiError) || !['identity_in_use', 'transfer_confirm'].includes(e.code)) throw e;
    const d = e.data ?? {};
    const lead = e.code === 'identity_in_use' ? `Akun ${PROVIDER[via] ?? via} ini sudah tersambung ke ${who(d.other)}.` : `Kode ini membuka ${who(d.other)}.`;
    const tail = d.guest
      ? `Akun tamu di perangkat ini, ${who(d.current)}, akan ditinggal dan tidak bisa dibuka lagi.`
      : 'Kamu bisa kembali ke akun yang sekarang dengan masuk lagi memakai Google/email-nya.';
    const ok = await ask({ title: 'Pindah ke akun itu?', text: `${lead} ${tail}`, yes: 'Ya, pindah', danger: !!d.guest });
    if (!ok) return null;
    return call({ switch: true });
  }
}

/** Setelah login / tautkan / tebus kode berhasil. */
export function afterAuth(r: any) {
  if (!r) return;
  const wasIn = !!G.me;
  if (r.state) setState(r.state);
  if (r.transferred) toast(r.switched ? 'Pindah ke akunmu berhasil.' : 'Selamat datang kembali! Akunmu sudah terbuka di perangkat ini.', 'good');
  else if (r.switched) toast('Masuk ke akun yang sudah ada.', 'good');
  else if (r.linked) toast('Progres tersimpan! Sekarang bisa dibuka di HP atau browser lain.', 'good');
  sfx.pop();
  if (wasIn && (r.switched || r.transferred)) { G.sheet = null; G.sheetArg = null; G.duel = null; G.visit = null; G.view = 'home'; }
  else if (r.linked && G.sheet === 'save') { const back = G.sheetArg?.back ?? null; G.sheet = back as any; G.sheetArg = null; }
}

/* ---------------- ajakan "Simpan progres" untuk tamu ---------------- */

const SNOOZE = 'kb-save-snooze';
const snoozedUntil = () => { try { return Number(localStorage.getItem(SNOOZE) ?? 0); } catch { return 0; } };
export function snoozeNudge() {
  const days = settings().account?.nudgeSnoozeDays ?? 3;
  try { localStorage.setItem(SNOOZE, String(Date.now() + days * 86_400_000)); } catch { /* mode privat */ }
  track('save_nudge_later');
}
export const accountAgeDays = () => (G.me?.user?.created_at ? (Date.now() - new Date(G.me.user.created_at).getTime()) / 86_400_000 : 0);

/** Pemain tamu yang sudah cukup lama/jauh main: perlu diingatkan (titik di ikon Pengaturan). */
export function needsSaving() {
  if (!G.me?.user?.is_guest) return false;
  const a = settings().account ?? {};
  return accountAgeDays() >= (a.nudgeDays ?? 2) || (G.me.pet?.level ?? 1) >= (a.nudgeLevel ?? 3) || (G.me.friendsCount ?? 0) >= 1;
}

export type NudgeReason = 'open' | 'level' | 'friend' | 'duel';
/** Tampilkan lembar "Simpan progres" bila pantas (hanya tamu, tidak sedang ditunda). */
export function maybeNudge(reason: NudgeReason, back: string | null = null) {
  if (!G.me?.user?.is_guest || snoozedUntil() > Date.now()) return false;
  if (reason === 'open' && (G.sheet || !needsSaving())) return false;
  if (reason === 'level' && G.sheet) return false;
  G.sheet = 'save';
  G.sheetArg = { reason, back };
  track('save_nudge', { reason });
  return true;
}
