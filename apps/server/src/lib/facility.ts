// Perabot yang sedang dipakai di sebuah rumah: satu pet per perabot untuk pose "naik ke mebel" (tidur, duduk, berendam,
// gowes, ...), baik pet tuan rumah sendiri maupun pet tamu. Hanya di memori server: habis sendiri setelah waktu berjalan
// ke sana + lama animasi aktivitas + sedikit jeda. Aktivitas di dekat mebel (lihat, musik, siram, ...) boleh bersamaan.

type Use = { uid: string; pet: string; until: number };
/** rumah (id tuan rumah) → perabot (`<ruangan>:<indeks>` / `<ruangan>:s:<bagian ruangan>`) → pemakainya */
const USE = new Map<string, Map<string, Use>>();

/** batas waktu berjalan ke perabot yang dihitung (client mengirim perkiraannya, dibatasi di sini) */
export const OCC_WALK_MAX_MS = 5000;
/** jeda setelah animasi selesai (sinkron & pet turun dari mebel) */
export const OCC_MARGIN_MS = 1500;

function prune(houseId: string, now: number) {
  const m = USE.get(houseId);
  if (!m) return null;
  for (const [k, u] of m) if (u.until <= now) m.delete(k);
  if (!m.size) { USE.delete(houseId); return null; }
  return m;
}

/** Lama perabot ditandai dipakai: perkiraan jalan (0–5 detik; tanpa perkiraan = 5 detik) + animasi + jeda. */
export function occupyMs(animMs: number, etaMs?: unknown) {
  const eta = etaMs === undefined || etaMs === null || etaMs === '' ? OCC_WALK_MAX_MS : Math.max(0, Math.min(OCC_WALK_MAX_MS, Math.round(Number(etaMs) || 0)));
  return eta + Math.max(0, animMs) + OCC_MARGIN_MS;
}

/**
 * Tandai perabot dipakai pet `uid`, sekaligus memeriksa (tanpa jeda di antaranya, jadi dua permintaan bersamaan tidak
 * bisa sama-sama lolos). Ditolak bila sedang dipakai pet lain. Pemain yang sama berpindah perabot: tanda lamanya dilepas.
 */
export function claimFurniture(houseId: string, key: string, uid: string, pet: string, ms: number, now = Date.now()) {
  const m = prune(houseId, now) ?? new Map<string, Use>();
  const cur = m.get(key);
  if (cur && cur.uid !== uid) return { ok: false as const, by: cur.pet };
  for (const [k, u] of m) if (u.uid === uid && k !== key) m.delete(k);
  const use: Use = { uid, pet, until: now + ms };
  m.set(key, use);
  USE.set(houseId, m);
  // dilepas lagi bila aktivitasnya gagal (cooldown, batas harian, ...): hanya tanda milik permintaan ini
  const release = () => { const mm = USE.get(houseId); if (mm?.get(key) === use) { mm.delete(key); if (!mm.size) USE.delete(houseId); } };
  return { ok: true as const, release };
}

/** Siapa yang sedang memakai perabot ini (null = kosong). */
export function furnitureUser(houseId: string, key: string, now = Date.now()) {
  return prune(houseId, now)?.get(key) ?? null;
}

// sapu berkala: rumah yang semua tandanya sudah habis
setInterval(() => { const now = Date.now(); for (const id of [...USE.keys()]) prune(id, now); }, 60_000).unref?.();

/** Untuk uji: kosongkan semua tanda. */
export function resetFurniture() { USE.clear(); }
/** Untuk uji: majukan waktu (semua tanda jadi lebih cepat habis). */
export function ageFurniture(ms: number) { for (const m of USE.values()) for (const u of m.values()) u.until -= ms; }
