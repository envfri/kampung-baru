// Kelompok aksi di log audit admin (dipakai server untuk filter & panel admin untuk warna/label).
export const AUDIT_CATS: { key: string; label: string; re: string }[] = [
  { key: 'pemain', label: 'Pemain', re: '^(player_(ban|unban|rename|logout|mute|unmute|export)|report_|banned_)' },
  { key: 'uang', label: 'Uang & Mutiara', re: '^(payment_|package_|launch_|zepay_|player_(wallet|items|bulk_gift))' },
  { key: 'konten', label: 'Konten & pengaturan', re: '^(item_|event_|quest_|activity_|location_|media_|announcement_|settings_|site_|cache_)' },
  { key: 'pesan', label: 'Pesan & notifikasi', re: '^(broadcast_|email_|wa_|notify_|player_(notify|bulk_notify))' },
  { key: 'sistem', label: 'Admin & akun', re: '^(admin_|password_|login|logout)' },
];
/** aksi yang ditandai merah (berbahaya / sulit dibatalkan) */
export const AUDIT_DANGER = /^(player_ban|launch_revoke_demo|admin_delete|.*_delete|site_maintenance_on)$/;
export function auditCat(action: string) { return AUDIT_CATS.find((c) => new RegExp(c.re).test(action))?.key ?? 'sistem'; }
/** label manusiawi untuk aksi audit */
export const AUDIT_LABEL: Record<string, string> = {
  player_ban: 'Blokir pemain', player_unban: 'Buka blokir', player_rename: 'Ganti nama pemain', player_logout: 'Keluarkan sesi pemain',
  player_mute: 'Bisukan obrolan', player_unmute: 'Buka bisu', player_wallet: 'Ubah saldo pemain', player_items: 'Ubah isi tas pemain',
  player_notify: 'Kirim notifikasi ke pemain', player_bulk_notify: 'Notifikasi massal', player_bulk_gift: 'Hadiah massal',
  report_handle: 'Laporan ditangani', banned_add: 'Tambah kata terlarang', banned_remove: 'Hapus kata terlarang',
  payment_mark_paid: 'Tandai lunas', payment_sync: 'Cek status pembayaran', payment_simulate: 'Simulasi pembayaran',
  settings_update: 'Ubah ekonomi & fitur', site_update: 'Ubah situs & SEO', admin_create: 'Tambah admin', admin_update: 'Ubah admin', admin_delete: 'Hapus admin',
  password_change: 'Ganti password', login: 'Masuk panel admin', logout: 'Keluar panel admin', player_export: 'Ekspor data pemain', payment_export: 'Ekspor pembayaran', broadcast_create: 'Buat broadcast', broadcast_cancel: 'Batalkan broadcast',
};
/** perbedaan dua objek: daftar jalur yang berubah (untuk log audit Sebelum → Sesudah) */
export function diffPaths(before: unknown, after: unknown, path = '', out: { path: string; before: unknown; after: unknown }[] = [], limit = 200) {
  if (out.length >= limit) return out;
  const isObj = (v: unknown) => v !== null && typeof v === 'object' && !Array.isArray(v);
  if (isObj(before) && isObj(after)) {
    const keys = new Set([...Object.keys(before as object), ...Object.keys(after as object)]);
    for (const k of keys) diffPaths((before as any)[k], (after as any)[k], path ? `${path}.${k}` : k, out, limit);
    return out;
  }
  if (JSON.stringify(before) !== JSON.stringify(after)) out.push({ path, before: before ?? null, after: after ?? null });
  return out;
}
