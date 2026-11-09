import { bad } from './core';

export const str = (v: unknown, name: string, opts: { min?: number; max?: number; optional?: boolean } = {}) => {
  if (v === undefined || v === null || v === '') {
    if (opts.optional) return undefined;
    throw bad('invalid', `${name} wajib diisi.`);
  }
  if (typeof v !== 'string') throw bad('invalid', `${name} tidak valid.`);
  const s = v.trim();
  if (opts.min !== undefined && s.length < opts.min) throw bad('invalid', `${name} minimal ${opts.min} karakter.`);
  if (opts.max !== undefined && s.length > opts.max) throw bad('invalid', `${name} maksimal ${opts.max} karakter.`);
  return s;
};

export const int = (v: unknown, name: string, opts: { min?: number; max?: number; def?: number } = {}) => {
  if ((v === undefined || v === null || v === '') && opts.def !== undefined) return opts.def;
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isInteger(n)) throw bad('invalid', `${name} harus bilangan bulat.`);
  if (opts.min !== undefined && n < opts.min) throw bad('invalid', `${name} minimal ${opts.min}.`);
  if (opts.max !== undefined && n > opts.max) throw bad('invalid', `${name} maksimal ${opts.max}.`);
  return n;
};

export const bool = (v: unknown, def = false) => (v === undefined || v === null ? def : v === true || v === 'true' || v === 1);

export const oneOf = <T extends string>(v: unknown, name: string, list: readonly T[]) => {
  if (!list.includes(v as T)) throw bad('invalid', `${name} tidak valid.`);
  return v as T;
};

export const obj = (v: unknown, name: string): Record<string, any> => {
  if (v === undefined || v === null) return {};
  if (typeof v !== 'object' || Array.isArray(v)) throw bad('invalid', `${name} harus objek.`);
  return v as Record<string, any>;
};

export const reqId = (v: unknown) => (typeof v === 'string' && /^[\w-]{8,64}$/.test(v) ? v : undefined);

export const email = (v: unknown) => {
  const s = str(v, 'Email', { max: 160 })!.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw bad('invalid_email', 'Format email tidak valid.');
  return s;
};

export const isoDate = (v: unknown, name: string, optional = false) => {
  if (v === undefined || v === null || v === '') {
    if (optional) return null;
    throw bad('invalid', `${name} wajib diisi.`);
  }
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw bad('invalid', `${name} bukan tanggal yang valid.`);
  return d;
};
