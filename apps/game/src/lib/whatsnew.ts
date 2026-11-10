// "Apa yang baru": catat versi terakhir yang dilihat pemain, beri tanda setelah game diperbarui.
import { APP_VERSION, compareVersion, playerReleases } from '@kb/shared';
import { G, toast } from './game.svelte';

const KEY = 'kb-seen-version';
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = (v: string) => { try { localStorage.setItem(KEY, v); } catch { /* mode privat */ } };

/** Dipanggil saat game dibuka. Pemain baru tidak perlu changelog; pemain lama dapat kabar sekali. */
export function checkWhatsNew() {
  const seen = read();
  if (!seen) { write(APP_VERSION); return; }
  if (compareVersion(APP_VERSION, seen) <= 0) return;
  if (!playerReleases(seen).length) { write(APP_VERSION); return; }
  G.whatsNew = seen;
  setTimeout(() => toast(`BUPI diperbarui ke v${APP_VERSION}. Lihat yang baru di Pengaturan.`, 'good'), 1500);
}

/** Pemain sudah membuka "Apa yang baru". */
export function markWhatsNewSeen() {
  write(APP_VERSION);
  G.whatsNew = null;
}
