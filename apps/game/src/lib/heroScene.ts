// Adegan halaman depan: rumah dua ruangan di atas pekarangan dengan tiga pet acak (gambar orisinal BUPI, satu SVG).
// Dibuat dari kode game yang sudah termuat (tanpa unduhan gambar); pet diacak tiap kunjungan dari `seed`.
import {
  houseLayout, houseLayers, houseDraws, houseDrawOrder, houseYardSVG, houseYardBounds, houseBounds, houseIso, petMarkup,
  HOUSE_PET_SCALE, PET_COLORS, PET_PARTS, mulberry32, type ItemLike, type HouseRoomArt, type HouseDraw,
} from '@kb/shared';

const it = (id: string, kind: any, key: string, data: any = {}, colors?: Record<string, string>): ItemLike =>
  ({ id, kind, name: id, art: { type: 'builtin', key, ...(colors ? { colors } : {}) } as any, data });
const ITEMS: Record<string, ItemLike> = Object.fromEntries([
  it('kasur', 'furniture', 'kasur', { w: 2, d: 1 }), it('rak', 'furniture', 'rak', { w: 1, d: 2 }), it('tanaman', 'furniture', 'tanaman'),
  it('karpet', 'furniture', 'karpet', { w: 2, d: 2, flat: true }), it('lampu', 'furniture', 'lampu'), it('sofa', 'furniture', 'sofa', { w: 2, d: 1 }),
  it('tv', 'furniture', 'tv'), it('akuarium', 'furniture', 'akuarium', { w: 2, d: 1 }), it('kaktus', 'furniture', 'kaktus'),
  it('karpet2', 'furniture', 'karpet', { w: 2, d: 1, flat: true }, { main: '#B9452F', accent: '#F3E3B5' }),
  it('wp1', 'wallpaper', 'garis'), it('wp2', 'wallpaper', 'polos', {}, { main: '#E3F1DA', accent: '#D6E9CB' }),
  it('fl1', 'floor', 'papan'), it('fl2', 'floor', 'tegel'),
].map((x) => [x.id, x]));

/** aksesori per slot (gambar bawaan) */
const WEAR_POOL: Record<string, string[]> = {
  head: ['caping', 'peci', 'kupluk', 'blangkon', 'topipesta', 'pita', 'headphone', 'baret', 'bandomatahari', 'mahkotadaun', 'topiember', 'udeng'],
  face: ['kacamata', 'kacamatahitam', 'kacamatabintang', 'kacamatahati'],
  neck: ['syal', 'dasikupu', 'kalungbunga', 'lonceng', 'syalrajut'],
  back: ['ransel', 'jubah', 'sayapkupu', 'jubahbatik'],
  hand: ['balon', 'lampion', 'kincir'],
};
const wearItem = (slot: string, key: string): ItemLike => ({ id: key, kind: 'wear', name: key, art: { type: 'builtin', key } as any, data: { slot } });

export interface HeroPet { look: { color: string; ear: string; pattern: string; eyes: string; tail: string }; wear: ItemLike[] }
/** tiga pet acak dengan warna berbeda; pet di pekarangan selalu membawa sesuatu (balon / lampion / kincir) */
export function randomPets(seed: number): HeroPet[] {
  const r = mulberry32(seed >>> 0);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const colors = [...PET_COLORS].sort(() => r() - 0.5).slice(0, 3);
  return colors.map((color, i) => {
    const wear: ItemLike[] = [];
    const slots = i === 2 ? ['hand', pick(['head', 'neck', 'face'])] : r() < 0.85 ? [pick(['head', 'head', 'face', 'neck', 'back'])] : [];
    for (const s of slots) wear.push(wearItem(s, pick(WEAR_POOL[s])));
    return {
      look: { color, ear: pick(PET_PARTS.ear)[0], pattern: pick(PET_PARTS.pattern.slice(0, 3))[0], eyes: pick(PET_PARTS.eyes.slice(0, 3))[0], tail: pick(PET_PARTS.tail)[0] },
      wear,
    };
  });
}
/** tempat ketiga pet: di karpet kamar, di ruang tamu, dan di jalan batu pekarangan */
const SPOTS: { at: [number, number]; flip: boolean }[] = [{ at: [2.5, 3.4], flip: false }, { at: [8.6, 2.9], flip: true }, { at: [11.4, 7.6], flip: true }];

const PLAN = () => houseLayout([{ id: 'kamar', size: 6, gx: 0, gy: 0 }, { id: 'tamu', size: 5, gx: 6, gy: 0 }] as any, () => undefined, { strict: true });
const ART: Record<string, HouseRoomArt> = {
  kamar: { wall: ITEMS.wp1, floor: ITEMS.fl1, layout: [{ i: 'kasur', x: 4, y: 0 }, { i: 'rak', x: 0, y: 0 }, { i: 'karpet', x: 2, y: 2 }, { i: 'tanaman', x: 0, y: 5 }, { i: 'lampu', x: 5, y: 2 }] },
  tamu: { wall: ITEMS.wp2, floor: ITEMS.fl2, layout: [{ i: 'sofa', x: 1, y: 0 }, { i: 'tv', x: 0, y: 3 }, { i: 'karpet2', x: 1, y: 2 }, { i: 'akuarium', x: 3, y: 0 }, { i: 'kaktus', x: 4, y: 4 }] },
};

/** SVG adegan (viewBox pas dengan pekarangan); malam = lampu taman menyala */
export function heroScene(night = false, pets: HeroPet[] = randomPets(1)) {
  const plan = PLAN();
  const L = houseLayers(plan, ART, ITEMS);
  const draws: HouseDraw[] = [...houseDraws(plan, ART, ITEMS)];
  pets.slice(0, SPOTS.length).forEach((p, i) => {
    const s = SPOTS[i], [x, y] = houseIso(s.at[0], s.at[1]);
    const m = petMarkup({ look: p.look as any, wear: p.wear, state: { mood: 'senang' } as any, flip: s.flip });
    draws.push({ key: 'pet' + i, d: s.at[0] + s.at[1] + 0.01, h: `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${HOUSE_PET_SCALE})"><g class="hop" style="animation-delay:-${(i * 0.8).toFixed(1)}s">${m}</g></g>` });
  });
  draws.sort(houseDrawOrder);
  const b = houseYardBounds(plan), pad = 10;
  return `<svg viewBox="${(b.x - pad).toFixed(0)} ${(b.y - pad).toFixed(0)} ${(b.w + pad * 2).toFixed(0)} ${(b.h + pad * 2).toFixed(0)}" role="img" aria-label="Rumah BUPI dengan pekarangan dan tiga pet">`
    + houseYardSVG(plan, night) + L.shadow + L.back.map((x) => x.h).join('') + L.floor.map((x) => x.h).join('') + L.mats + L.flats.map((x) => x.h).join('')
    + draws.map((d) => d.h).join('') + `</svg>`;
}

/** Ruangan kecil (kartu "Hias rumah sendiri") */
export function miniRoom() {
  const plan = houseLayout([{ id: 'r', size: 3, gx: 0, gy: 0 }] as any, () => undefined, { strict: true });
  const art: Record<string, HouseRoomArt> = { r: { wall: ITEMS.wp2, floor: ITEMS.fl1, layout: [{ i: 'sofa', x: 1, y: 0 }, { i: 'tanaman', x: 0, y: 0 }, { i: 'karpet2', x: 1, y: 1 }, { i: 'lampu', x: 0, y: 2 }] } };
  const L = houseLayers(plan, art, ITEMS);
  const draws = [...houseDraws(plan, art, ITEMS)].sort(houseDrawOrder);
  const b = houseBounds(plan);
  return `<svg viewBox="${(b.x - 4).toFixed(0)} ${(b.y - 4).toFixed(0)} ${(b.w + 8).toFixed(0)} ${(b.h + 14).toFixed(0)}" aria-hidden="true">` + L.shadow + L.back.map((x) => x.h).join('') + L.floor.map((x) => x.h).join('') + L.mats + L.flats.map((x) => x.h).join('') + draws.map((d) => d.h).join('') + `</svg>`;
}

/** Gasing & layangan (kartu "Mini-game Nusantara") */
export const MINIGAME_ART = `<svg viewBox="0 0 120 92" aria-hidden="true"><g transform="translate(84 6) rotate(14)"><path d="M0 0L18 22L0 50L-18 22Z" fill="#E0583F" stroke="#2B2F4A" stroke-width="2.5" stroke-linejoin="round"/><path d="M0 0V50M-18 22H18" stroke="#2B2F4A" stroke-width="1.6"/><path d="M0 50q-7 10 4 16t-2 16" fill="none" stroke="#2B2F4A" stroke-width="1.6"/><path d="M-4 59l7 3-7 3zM-2 71l7 3-7 3z" fill="#F2B632" stroke="#2B2F4A" stroke-width="1"/></g><g transform="translate(42 50)"><ellipse cx="0" cy="33" rx="26" ry="6" fill="#2B2F4A" opacity=".12"/><path d="M-25 2h50l-25 30z" fill="#F2B632" stroke="#2B2F4A" stroke-width="2.5" stroke-linejoin="round"/><ellipse cx="0" cy="2" rx="25" ry="9" fill="#E0583F" stroke="#2B2F4A" stroke-width="2.5"/><path d="M-14 5q14 6 28 0" fill="none" stroke="#FFFDF7" stroke-width="2.4" stroke-linecap="round"/><rect x="-3.5" y="-17" width="7" height="15" rx="2.5" fill="#8A5A36" stroke="#2B2F4A" stroke-width="2"/><path d="M-34 -2q-7 6-2 13M34 -2q7 6 2 13" stroke="#2B2F4A" stroke-width="2" fill="none" stroke-linecap="round" opacity=".45"/></g></svg>`;
