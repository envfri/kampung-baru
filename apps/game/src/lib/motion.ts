// Kurangi animasi: pengaturan HP (prefers-reduced-motion) ATAU pilihan di Pengaturan game (disimpan di perangkat ini).
// Pilihan game memasang <html class="reduce-motion">; tiap aturan CSS @media (prefers-reduced-motion: reduce)
// punya kembaran :root.reduce-motion, jadi hasilnya sama persis dengan pengaturan HP.
const KEY = 'kb-motion';
let less = (() => { try { return localStorage.getItem(KEY) === 'kurang'; } catch { return false; } })();

/** pasang / lepas kelas reduce-motion di <html> sesuai pilihan */
export function applyMotion() {
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('reduce-motion', less);
}
/** pilihan "Kurangi animasi" di game (bukan pengaturan HP) */
export const lessMotionPref = () => less;
export function setLessMotion(on: boolean) {
  less = on;
  try { localStorage.setItem(KEY, on ? 'kurang' : 'normal'); } catch { /* tidak apa */ }
  applyMotion();
}
/** animasi dikurangi (pilihan game atau pengaturan HP) */
export const reducedMotion = () => less || (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
