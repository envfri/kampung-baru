// Jam bersama untuk waktu relatif & hitung mundur (satu interval untuk semua komponen).
export const CLOCK = $state({ now: Date.now() });
setInterval(() => (CLOCK.now = Date.now()), 1000);
