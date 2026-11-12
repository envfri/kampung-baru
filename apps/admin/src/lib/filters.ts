// Definisi & penerjemah filter tabel: nilai disimpan di tautan (#/halaman?kunci=nilai) dan dikirim ke server.
export interface FDef {
  key: string;
  label: string;
  /** one = pilih satu, many = pilih beberapa, dates = rentang tanggal, range = rentang angka */
  type?: 'one' | 'many' | 'dates' | 'range';
  options?: [string, string][];
  /** label untuk "semua" (pilih satu) */
  all?: string;
  /** rentang tanggal ke masa depan (mis. jadwal) */
  future?: boolean;
}
export const DATE_PRESETS: [string, string][] = [['today', 'Hari ini'], ['7', '7 hari terakhir'], ['30', '30 hari terakhir'], ['90', '90 hari terakhir']];

export function readFilters(defs: FDef[], query: Record<string, string>) {
  const v: Record<string, any> = {};
  for (const d of defs) {
    const raw = query[d.key];
    if (d.type === 'many') v[d.key] = raw ? raw.split(',').filter(Boolean) : [];
    else v[d.key] = raw ?? '';
  }
  return v;
}
export function isActive(d: FDef, v: any) { return d.type === 'many' ? Array.isArray(v) && v.length > 0 : v !== '' && v != null; }
export function activeCount(defs: FDef[], vals: Record<string, any>) { return defs.filter((d) => isActive(d, vals[d.key])).length; }
/** nilai rentang tanggal → { from, to } ISO (to eksklusif) */
export function dateRange(v: string): { from?: string; to?: string } {
  if (!v) return {};
  const start = (d: Date) => { d.setHours(0, 0, 0, 0); return d; };
  if (v === 'today') return { from: start(new Date()).toISOString() };
  if (/^\d+$/.test(v)) { const d = start(new Date()); d.setDate(d.getDate() - Number(v) + 1); return { from: d.toISOString() }; }
  const m = /^a:(\d{4}-\d{2}-\d{2})?:(\d{4}-\d{2}-\d{2})?$/.exec(v);
  if (!m) return {};
  const out: { from?: string; to?: string } = {};
  if (m[1]) out.from = new Date(m[1] + 'T00:00:00').toISOString();
  if (m[2]) { const d = new Date(m[2] + 'T00:00:00'); d.setDate(d.getDate() + 1); out.to = d.toISOString(); }
  return out;
}
export function rangeOf(v: string): { min?: number; max?: number } {
  const m = /^(-?\d*)-(-?\d*)$/.exec(v ?? '');
  if (!m) return {};
  return { min: m[1] === '' ? undefined : Number(m[1]), max: m[2] === '' ? undefined : Number(m[2]) };
}
/** parameter untuk server: dates → kunciFrom/kunciTo, range → kunciMin/kunciMax */
export function filterParams(defs: FDef[], vals: Record<string, any>) {
  const out: Record<string, unknown> = {};
  for (const d of defs) {
    const v = vals[d.key];
    if (!isActive(d, v)) continue;
    if (d.type === 'dates') { const r = dateRange(v); out[d.key + 'From'] = r.from; out[d.key + 'To'] = r.to; }
    else if (d.type === 'range') { const r = rangeOf(v); out[d.key + 'Min'] = r.min; out[d.key + 'Max'] = r.max; }
    else out[d.key] = v;
  }
  return out;
}
/** cocokkan baris lokal dengan rentang tanggal */
export function inDates(v: string, t: string | number | null | undefined) {
  if (!v) return true;
  if (!t) return false;
  const r = dateRange(v), x = new Date(t).getTime();
  return (!r.from || x >= new Date(r.from).getTime()) && (!r.to || x < new Date(r.to).getTime());
}
const fmtD = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
export function chipText(d: FDef, v: any): string {
  const lab = (x: string) => d.options?.find((o) => o[0] === x)?.[1] ?? x;
  if (d.type === 'many') return `${d.label}: ${(v as string[]).map(lab).join(', ')}`;
  if (d.type === 'dates') {
    const p = DATE_PRESETS.find((o) => o[0] === v);
    if (p) return `${d.label}: ${p[1].toLowerCase()}`;
    const m = /^a:([^:]*):(.*)$/.exec(v);
    return `${d.label}: ${m?.[1] ? fmtD(m[1]) : '…'} – ${m?.[2] ? fmtD(m[2]) : '…'}`;
  }
  if (d.type === 'range') {
    const r = rangeOf(v);
    if (r.min != null && r.max != null) return `${d.label} ${r.min}–${r.max}`;
    return r.min != null ? `${d.label} ≥ ${r.min}` : `${d.label} ≤ ${r.max}`;
  }
  return d.options ? `${d.label}: ${lab(v)}` : `${d.label}: ${v}`;
}
