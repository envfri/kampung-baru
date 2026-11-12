import { ApiError } from './api';

export type Role = 'owner' | 'admin' | 'moderator';
export interface Toast { id: number; text: string; kind: 'ok' | 'err' | 'info'; action?: { label: string; run: () => void }; ms: number }
export interface AskOpts {
  title: string;
  body?: string;
  tone?: 'danger' | 'warn' | 'info' | 'ok';
  icon?: string;
  confirm?: string;
  cancel?: string;
  /** wajib mengetik teks ini (huruf besar/kecil diabaikan) sebelum tombol aktif */
  typeToConfirm?: string;
  /** isian tambahan; hasilnya dikembalikan sebagai objek */
  fields?: { key: string; label: string; type?: 'text' | 'textarea' | 'chips' | 'number'; options?: string[]; placeholder?: string; min?: number; value?: string; help?: string }[];
  /** ringkasan Sebelum → Sesudah */
  diff?: { label: string; before: string; after: string }[];
  note?: string;
}
export const A = $state({
  me: null as null | { admin: { id: string; email: string; name: string; role: Role }; builtins: any; kinds: string[]; locationKinds: string[]; settingsHelp: any; paymentProvider: string },
  toasts: [] as Toast[],
  route: 'dashboard',
  /** bagian setelah halaman di tautan (#/players/<id>) */
  arg: '' as string,
  /** query di tautan (#/players?status=akun) */
  query: {} as Record<string, string>,
  /** mode perawatan sedang aktif (penanda merah di semua halaman admin) */
  maint: false,
  /** angka di menu samping */
  badges: {} as Record<string, number>,
  /** modal konfirmasi yang sedang terbuka */
  ask: null as null | (AskOpts & { resolve: (v: false | Record<string, string>) => void }),
  palette: false,
});
const RANK = { moderator: 1, admin: 2, owner: 3 } as const;
export const can = (min: keyof typeof RANK) => !!A.me && RANK[A.me.admin.role] >= RANK[min];

let tid = 0;
export function toast(text: string, kind: Toast['kind'] = 'ok', action?: Toast['action']) {
  const t: Toast = { id: ++tid, text, kind, action, ms: kind === 'err' ? 6000 : action ? 6000 : 3200 };
  A.toasts = [...A.toasts.slice(-3), t];
  setTimeout(() => dismiss(t.id), t.ms);
}
export const dismiss = (id: number) => { A.toasts = A.toasts.filter((t) => t.id !== id); };
export function err(e: unknown) {
  if (e instanceof ApiError && e.status === 401) A.me = null;
  toast(e instanceof Error ? e.message : 'Terjadi kesalahan', 'err');
}
/** modal konfirmasi; hasil false bila dibatalkan, atau objek isian bila disetujui */
export function ask(o: AskOpts): Promise<false | Record<string, string>> {
  return new Promise((resolve) => { A.ask = { ...o, resolve }; });
}

export const rp = (n: number) => 'Rp' + Math.round(n || 0).toLocaleString('id-ID');
export const num = (n: number) => Math.round(n || 0).toLocaleString('id-ID');
/** angka ringkas: 1,2 rb · 3,4 jt */
export function short(n: number) {
  const a = Math.abs(n || 0);
  if (a >= 1e9) return (n / 1e9).toFixed(1).replace('.', ',').replace(',0', '') + ' M';
  if (a >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, '').replace('.', ',') + ' jt';
  if (a >= 1e4) return (n / 1e3).toFixed(1).replace(/\.0$/, '').replace('.', ',') + ' rb';
  return num(n);
}
export const rpShort = (n: number) => 'Rp' + short(n);
export const dt = (t: string | number | null | undefined) => (t ? new Date(t).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
export const day = (t: string | number | null | undefined) => (t ? new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
/** waktu relatif: "baru saja", "5 mnt lalu", "kemarin", "3 hari lalu"; selebihnya tanggal */
export function ago(t: string | number | null | undefined, now = Date.now()) {
  if (!t) return '—';
  const ms = now - new Date(t).getTime();
  const fut = ms < 0, s = Math.abs(ms) / 1000;
  const f = (v: string) => (fut ? `${v} lagi` : `${v} lalu`);
  if (s < 45) return fut ? 'sebentar lagi' : 'baru saja';
  if (s < 3600) return f(`${Math.max(1, Math.round(s / 60))} mnt`);
  if (s < 86400) return f(`${Math.round(s / 3600)} jam`);
  if (!fut && s < 172800) return 'kemarin';
  if (s < 30 * 86400) return f(`${Math.round(s / 86400)} hari`);
  return day(t);
}
/** ISO → nilai untuk <input type="datetime-local"> (waktu lokal) */
export const toLocal = (t: string | null | undefined) => { if (!t) return ''; const d = new Date(t); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
export const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);
export const getPath = (o: any, p: string) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
export function setPath(o: any, p: string, v: any) { const ks = p.split('.'); let cur = o; for (const k of ks.slice(0, -1)) cur = cur[k] ??= {}; cur[ks[ks.length - 1]] = v; }

export async function copy(text: string, label = 'Disalin') {
  try { await navigator.clipboard.writeText(text); toast(`${label}: ${text.length > 40 ? text.slice(0, 40) + '…' : text}`, 'info'); }
  catch { toast('Tidak bisa menyalin di browser ini.', 'err'); }
}

/* ---------- tautan: #/halaman/arg?kunci=nilai ---------- */
export function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, q = ''] = h.split('?');
  const [r, ...rest] = (path || 'dashboard').split('/');
  return { route: r || 'dashboard', arg: rest.join('/'), query: Object.fromEntries(new URLSearchParams(q)) };
}
/** perbarui query di tautan tanpa memicu pindah halaman (filter bisa dibagikan, tombol Kembali tetap jalan) */
export function setQuery(q: Record<string, unknown>, push = false) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null || v === '' || v === false || (Array.isArray(v) && !v.length)) continue;
    p.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const s = p.toString();
  const url = `#/${A.route}${A.arg ? '/' + A.arg : ''}${s ? '?' + s : ''}`;
  if (url === location.hash) return;
  A.query = Object.fromEntries(p);
  history[push ? 'pushState' : 'replaceState'](null, '', url);
}

/* ---------- preferensi per admin (kolom tabel, bagian terlipat) ---------- */
export function pref<T>(key: string, def: T): T {
  try { const v = localStorage.getItem(`kb-admin:${A.me?.admin.id ?? ''}:${key}`); return v ? (JSON.parse(v) as T) : def; } catch { return def; }
}
export function savePref(key: string, v: unknown) {
  try { localStorage.setItem(`kb-admin:${A.me?.admin.id ?? ''}:${key}`, JSON.stringify(v)); } catch { /* abaikan */ }
}
