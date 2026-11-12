import { NET } from './net.svelte';
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
async function call<T = any>(method: string, url: string, body?: unknown, quiet = false): Promise<T> {
  if (!quiet) NET.n++;
  try {
    const res = await fetch(url, { method, credentials: 'same-origin', headers: body !== undefined ? { 'content-type': 'application/json' } : {}, body: body !== undefined ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* bukan JSON */ }
    if (!res.ok) throw new ApiError(res.status, data?.error?.code ?? 'error', data?.error?.message ?? `Gagal (${res.status})`);
    return data;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, 'network', 'Tidak bisa terhubung ke server. Periksa koneksi lalu coba lagi.');
  } finally { if (!quiet) NET.n = Math.max(0, NET.n - 1); }
}
export const api = {
  get: <T = any>(u: string) => call<T>('GET', u),
  post: <T = any>(u: string, b: unknown = {}) => call<T>('POST', u, b),
  put: <T = any>(u: string, b: unknown = {}) => call<T>('PUT', u, b),
  del: <T = any>(u: string) => call<T>('DELETE', u),
  /** tanpa bar progres (untuk pembaruan latar belakang) */
  quiet: <T = any>(u: string) => call<T>('GET', u, undefined, true),
};
/** susun query string dari objek (nilai kosong dilewati, array digabung koma) */
export function qs(o: Record<string, unknown>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue;
    p.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const s = p.toString();
  return s ? '?' + s : '';
}
/** unduh CSV dari endpoint admin (file ditangani browser, sesi ikut terkirim) */
export function downloadCsv(url: string) {
  const a = document.createElement('a');
  a.href = url; a.rel = 'noopener'; a.download = '';
  document.body.appendChild(a); a.click(); a.remove();
}
