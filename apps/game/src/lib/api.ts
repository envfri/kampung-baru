import { MAINT } from './maint.svelte';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public data?: any) {
    super(message);
  }
}

export const rid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

async function call<T = any>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'content-type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'offline', 'Tidak ada koneksi. Periksa internet kamu.');
  }
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* bukan JSON */ }
  if (!res.ok) {
    const e = data?.error;
    // server sedang perawatan: tampilkan layar perawatan (App.svelte), apa pun permintaannya
    if (res.status === 503 && e?.code === 'maintenance') MAINT.info = { title: e.maintenance?.title ?? e.message ?? 'BUPI sedang perawatan', message: e.maintenance?.message ?? '', until: e.maintenance?.until ?? null };
    throw new ApiError(res.status, e?.code ?? 'error', e?.message ?? 'Terjadi kesalahan. Coba lagi.', e);
  }
  return data as T;
}

export const api = {
  get: <T = any>(u: string) => call<T>('GET', u),
  post: <T = any>(u: string, b: unknown = {}) => call<T>('POST', u, b),
  del: <T = any>(u: string, b?: unknown) => call<T>('DELETE', u, b),
};
