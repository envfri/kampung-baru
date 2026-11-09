export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
async function call<T = any>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method, credentials: 'same-origin', headers: body !== undefined ? { 'content-type': 'application/json' } : {}, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* bukan JSON */ }
  if (!res.ok) throw new ApiError(res.status, data?.error?.code ?? 'error', data?.error?.message ?? `Gagal (${res.status})`);
  return data;
}
export const api = {
  get: <T = any>(u: string) => call<T>('GET', u),
  post: <T = any>(u: string, b: unknown = {}) => call<T>('POST', u, b),
  put: <T = any>(u: string, b: unknown = {}) => call<T>('PUT', u, b),
  del: <T = any>(u: string) => call<T>('DELETE', u),
};
