import { ApiError } from './api';
export const A = $state({
  me: null as null | { admin: { id: string; email: string; name: string; role: 'owner' | 'admin' | 'moderator' }; builtins: any; kinds: string[]; locationKinds: string[]; settingsHelp: any; paymentProvider: string },
  toast: { text: '', kind: 'ok' as 'ok' | 'err', n: 0 },
  route: 'dashboard',
});
const RANK = { moderator: 1, admin: 2, owner: 3 } as const;
export const can = (min: keyof typeof RANK) => !!A.me && RANK[A.me.admin.role] >= RANK[min];
export function toast(text: string, kind: 'ok' | 'err' = 'ok') { A.toast = { text, kind, n: A.toast.n + 1 }; }
export function err(e: unknown) {
  if (e instanceof ApiError && e.status === 401) A.me = null;
  toast(e instanceof Error ? e.message : 'Terjadi kesalahan', 'err');
}
export const rp = (n: number) => 'Rp' + Math.round(n).toLocaleString('id-ID');
export const num = (n: number) => Math.round(n).toLocaleString('id-ID');
export const dt = (t: string | null | undefined) => (t ? new Date(t).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
/** ISO → nilai untuk <input type="datetime-local"> (waktu lokal) */
export const toLocal = (t: string | null | undefined) => { if (!t) return ''; const d = new Date(t); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
export const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);
export const getPath = (o: any, p: string) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
export function setPath(o: any, p: string, v: any) { const ks = p.split('.'); let cur = o; for (const k of ks.slice(0, -1)) cur = cur[k] ??= {}; cur[ks[ks.length - 1]] = v; }
