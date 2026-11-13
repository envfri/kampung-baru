// Kolam Pancing: lempar → tunggu/ngicip → sambar (kail) → tarik-ulur → hasil.
// Server memilih tangkapan saat lempar (jarak × waktu WIB × tingkat) dan hanya mengirim petunjuk animasi
// (ukuran bayangan, tarikan, ngicip, lama duel). Identitas ikan baru dikirim saat mendarat.
// Dibuat umum (place) supaya Lomba Mancing di alun-alun nanti bisa memakai logika yang sama dengan
// jatah & hadiahnya sendiri (tangkap-lepas): cukup memanggil castFish/hookFish/landFish dengan reward lain.
import { randomInt } from 'node:crypto';
import { applyNeedDelta, fishTier, pondKind, pondSky, shadowSize, type FishDist, type FishTier, type PondFind, type Settings, type SkyTime } from '@kb/shared';
import type { Db } from '../db/index';
import { addItem, bad, bumpCounter, coinMultiplier, credit, notFound, today, track, type Catalog, type CatalogItem } from './core';
import { assertAwake, currentNeeds, lockPet, publicItem, revealedItems, savePet } from './state';
import { grantXp } from '../routes/game';

export type FishPlace = 'kolam' | 'alun';
export type CatchKind = 'fish' | PondFind;
/** pelampung melayang 0,6 dtk + tali mengulur 0,8 dtk sebelum masa tunggu dimulai */
export const FISH_LEAD_MS = 1400;
/** toleransi jaringan saat menarik: sebelum sambar & sesudah jendela */
export const HOOK_EARLY_MS = 350;
export const HOOK_LATE_MS = 700;
/** toleransi & batas waktu tarik-ulur di server */
export const LAND_EARLY_MS = 300;
export const LAND_MAX_EXTRA_MS = 60_000;

const rnd = () => randomInt(0, 1_000_000) / 1_000_000;
const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);
/** [min, maks] dari pengaturan, aman bila admin mengisi aneh */
function span(v: unknown, d: [number, number]): [number, number] {
  const a = Array.isArray(v) ? v.map(Number) : d;
  const lo = Math.max(0, num(a[0], d[0])), hi = Math.max(lo, num(a[1], d[1]));
  return [Math.round(lo), Math.round(hi)];
}
const between = ([lo, hi]: [number, number]) => (hi > lo ? randomInt(lo, hi + 1) : lo);

/** Isi kolam yang bisa tertangkap sekarang (aktif, bobot > 0, item event hanya saat event berjalan). */
export function pondPool(cat: Catalog, now = Date.now()) {
  return cat.items.filter((i) => {
    if (!i.active || !pondKind(i)) return false;
    if (!i.event_id) return true;
    const ev = cat.events.find((e) => e.id === i.event_id);
    return !!ev && ev.active && new Date(ev.starts_at).getTime() <= now && new Date(ev.ends_at).getTime() > now;
  });
}

/** Bobot efektif satu entri: bobot × pengali tingkat (jarak) × pengali waktu × pengali dekat/jauh di item. */
export function pondWeight(it: { kind?: string; data?: any }, dist: FishDist, sky: SkyTime, s: Settings) {
  const d = it.data;
  let w = num(d?.fishWeight, 0);
  if (!(w > 0)) return 0;
  if (pondKind(it) === 'fish') w *= Math.max(0, num((s.fishing.tierMult as any)?.[dist]?.[fishTier(d)], 1));
  const t = d?.time?.[sky];
  if (t !== undefined && t !== null && t !== '') w *= Math.max(0, num(t, 1));
  if (dist === 'dekat' && d?.near !== undefined && d?.near !== '') w *= Math.max(0, num(d.near, 1));
  if (dist === 'jauh' && d?.far !== undefined && d?.far !== '') w *= Math.max(0, num(d.far, 1));
  return w;
}

/** Peluang tiap entri (0..1) untuk jarak & waktu tertentu — untuk uji & admin. */
export function pondOdds(pool: CatalogItem[], dist: FishDist, sky: SkyTime, s: Settings) {
  const ws = pool.map((i) => pondWeight(i, dist, sky, s));
  const total = ws.reduce((a, b) => a + b, 0) || 1;
  return pool.map((i, k) => ({ item: i, p: ws[k] / total }));
}

export function pickCatch(pool: CatalogItem[], dist: FishDist, sky: SkyTime, s: Settings, r = rnd()) {
  const ws = pool.map((i) => pondWeight(i, dist, sky, s));
  const total = ws.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return null;
  let x = r * total;
  for (let k = 0; k < pool.length; k++) { x -= ws[k]; if (ws[k] > 0 && x <= 0) return pool[k]; }
  return pool[ws.findLastIndex((w) => w > 0)];
}

/** Rencana satu lemparan: semua angka acak ditentukan di sini dan disimpan di server. */
export function planCast(item: CatalogItem, dist: FishDist, s: Settings, cat: Catalog, waitPct = 100) {
  const F = s.fishing as any;
  const kind = pondKind(item) as CatchKind;
  const d = item.data ?? {};
  const tier: FishTier = fishTier(d);
  const fish = kind === 'fish';
  const minCm = Math.max(1, num(d.minCm, 5)), maxCm = Math.max(minCm, num(d.maxCm, minCm));
  const cm = fish ? Math.round((minCm + rnd() * (maxCm - minCm)) * 10) / 10 : null;
  // ngicip (pelampung turun sedikit) sebelum sambar; peti tenang tanpa ngicip
  const nMax = fish ? Math.max(0, Math.round(num(d.nibbleMax, num(F.nibbleMax, 3)))) : kind === 'junk' ? 1 : 0;
  const nMin = fish ? Math.min(nMax, Math.max(0, Math.round(num(d.nibbleMin, 0)))) : 0;
  const nCount = nMax > nMin ? randomInt(nMin, nMax + 1) : nMin;
  const gap = span(F.nibbleGapMs, [600, 1400]);
  // waitPct < 100: ikan lebih cepat datang (bonus Ramai-ramai kolam alun-alun)
  let t = FISH_LEAD_MS + Math.round(between(span(F.waitMs?.[dist], [3000, 6000])) * Math.min(100, Math.max(10, waitPct)) / 100);
  const nibbles: number[] = [];
  for (let k = 0; k < nCount; k++) { nibbles.push(t); t += between(gap); }
  const biteInMs = t;
  const windowMs = Math.max(400, Math.round(num(F.windowMs?.[fish ? tier : 'biasa'], 1200)));
  const fightKey = fish ? tier : kind === 'treasure' || kind === 'decor' ? 'harta' : 'sampah';
  const fightMs = between(span(F.fightMs?.[fightKey], fish ? [3000, 5000] : [1500, 2500]));
  const power = fish ? Math.min(5, Math.max(1, Math.round(num(d.pull, 1)))) : kind === 'treasure' ? 3 : kind === 'decor' ? 2 : 1;
  const payload: Record<string, unknown> = {};
  if (kind === 'bottle') {
    const b = F.bottle ?? {};
    const [lo, hi] = span([b.coinMin, b.coinMax], [5, 20]);
    payload.coin = between([lo, hi]);
    // pesan acak; petunjuk ikan rahasia (data.hint) ikut diundi bersama pesan biasa
    const msgs: { text: string; fish?: string }[] = (Array.isArray(b.messages) ? b.messages : []).filter((m: unknown) => typeof m === 'string' && m.trim()).map((text: string) => ({ text }));
    for (const i of cat.items) if (i.active && i.data?.secret && typeof i.data?.hint === 'string' && i.data.hint.trim()) msgs.push({ text: i.data.hint.trim(), fish: i.id });
    const m = msgs.length ? msgs[randomInt(0, msgs.length)] : { text: 'Botolnya kosong… hanya ada koin.' };
    payload.msg = m.text;
    if (m.fish) payload.hintFish = m.fish;
  } else if (kind === 'treasure') {
    const tr = F.treasure ?? {};
    const bands: number[] = (Array.isArray(tr.bandMax) ? tr.bandMax : [120, 200, 300]).map(Number).filter((x: number) => x > 0);
    const odds: number[] = (Array.isArray(tr.bandOdds) ? tr.bandOdds : [60, 30, 10]).map((x: unknown) => Math.max(0, Number(x) || 0));
    const total = bands.reduce((a, _b, k) => a + (odds[k] ?? 0), 0);
    let x = rnd() * (total || 1), band = 0;
    for (let k = 0; k < bands.length; k++) { x -= odds[k] ?? 0; if (x <= 0) { band = k; break; } band = k; }
    const lo = band === 0 ? Math.max(0, num(tr.coinMin, 50)) : bands[band - 1];
    payload.coin = bands.length ? between([Math.round(lo), Math.round(Math.max(lo, bands[band]))]) : Math.round(num(tr.coinMin, 50));
    if (rnd() * 100 < num(tr.pearlChance, 15)) payload.pearl = between(span([tr.pearlMin, tr.pearlMax], [1, 3]));
  }
  return {
    item, kind, tier, cm, nibbles, biteInMs, windowMs, fightMs, payload,
    shadow: { size: fish ? shadowSize(cm!) : 'box', glow: fish && (tier === 'langka' || tier === 'legenda') },
    fight: { power, minMs: fightMs, slackMs: d.slick ? 1500 : 2500, jerk: !!d.jerk, calm: kind === 'treasure' },
  };
}

type CastRow = {
  id: string; fish_id: string; bite_at: Date; window_ms: number; result: string | null; place: string; distance: string | null; sky: string | null;
  catch_kind: string | null; cm: number | null; hooked_at: Date | null; fight_min_ms: number | null; payload: any; cast_at: Date;
};
const castSql = `select id, fish_id, bite_at, window_ms, result, place, distance, sky, catch_kind, cm, hooked_at, fight_min_ms, payload, cast_at
  from fishing_casts where id = $1 and user_id = $2 for update`;

/** Lemparan lain yang masih berjalan dianggap lepas (satu kail per pemain). */
export async function closeOpenCasts(t: Db, uid: string) {
  await t.query(`update fishing_casts set result = 'lepas', reason = 'ditinggal', resolved_at = now() where user_id = $1 and result is null`, [uid]);
}

/**
 * Lempar kail: cek pet & energi, potong jatah & energi, pilih tangkapan, simpan rencana.
 * Kembalian hanya berisi petunjuk animasi — tanpa id/nama/gambar ikan.
 */
export async function castFish(t: Db, uid: string, o: { place: FishPlace; dist: FishDist; s: Settings; cat: Catalog; energi: number; quota: { key: string; limit: number }; now?: number; ramai?: { waitPct: number; xp: number } }) {
  const pet = await lockPet(t, uid);
  if (!pet) throw bad('no_pet', 'Buat pet dulu.');
  assertAwake(pet, o.s);
  const needs = currentNeeds(pet, o.s);
  if (needs.energi < o.energi) throw bad('tired', `${pet.name} terlalu capek untuk memancing.`);
  const now = o.now ?? Date.now();
  const sky = pondSky(now);
  const pool = pondPool(o.cat, now);
  const item = pickCatch(pool, o.dist, sky, o.s);
  if (!item) throw bad('empty_pond', 'Kolam sedang kosong.');
  await closeOpenCasts(t, uid);
  await bumpCounter(t, uid, o.quota.key, o.quota.limit);
  if (o.energi > 0) await savePet(t, uid, { needs: applyNeedDelta(needs, { energi: -o.energi }) });
  const plan = planCast(item, o.dist, o.s, o.cat, o.ramai?.waitPct ?? 100);
  // bonus Ramai-ramai dicatat di lemparan; XP tambahannya diberikan saat tangkapan didaratkan
  if (o.ramai && o.ramai.xp > 0) plan.payload.ramaiXp = o.ramai.xp;
  const c = (await t.one<{ id: string }>(
    `insert into fishing_casts (user_id, fish_id, cast_at, bite_at, window_ms, place, distance, sky, catch_kind, cm, fight_min_ms, payload)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::text::jsonb) returning id`,
    [uid, item.id, new Date(now), new Date(now + plan.biteInMs), plan.windowMs, o.place, o.dist, sky, plan.kind, plan.cm, plan.fightMs, JSON.stringify(plan.payload)],
  ))!;
  return { castId: c.id, place: o.place, dist: o.dist, sky, leadMs: FISH_LEAD_MS, biteInMs: plan.biteInMs, nibbles: plan.nibbles, windowMs: plan.windowMs, shadow: plan.shadow, fight: plan.fight, ...(o.ramai ? { ramai: true } : {}) };
}

/** Tekan TARIK: kail menyangkut bila tepat waktu (bukan saat ngicip, tidak terlambat). */
export async function hookFish(t: Db, uid: string, castId: string, now = Date.now()) {
  const c = await t.one<CastRow>(castSql, [castId, uid]);
  if (!c) throw notFound('Lemparan tidak ditemukan.');
  if (c.result) throw bad('resolved', 'Lemparan ini sudah selesai.');
  if (c.hooked_at) return { result: 'hooked' as const, fight: fightOf(c) };
  const bite = new Date(c.bite_at).getTime();
  const reason = now < bite - HOOK_EARLY_MS ? 'early' : now > bite + c.window_ms + HOOK_LATE_MS ? 'late' : null;
  if (reason) {
    await t.query(`update fishing_casts set result = $2, reason = $2, resolved_at = now() where id = $1`, [castId, reason]);
    return { result: reason as 'early' | 'late', shadow: shadowOf(c) };
  }
  await t.query(`update fishing_casts set hooked_at = $2 where id = $1`, [castId, new Date(now)]);
  return { result: 'hooked' as const, fight: fightOf(c) };
}

function shadowOf(c: CastRow) {
  return { size: c.catch_kind === 'fish' ? shadowSize(Number(c.cm) || 0) : 'box' };
}
function fightOf(c: CastRow) {
  return { minMs: c.fight_min_ms ?? 0 };
}

/** Ikan lepas di tengah tarik-ulur (tali putus / kendur) atau pemain pergi. */
export async function loseFish(t: Db, uid: string, castId: string, reason: 'putus' | 'kendur' | 'batal') {
  const c = await t.one<CastRow>(castSql, [castId, uid]);
  if (!c) throw notFound('Lemparan tidak ditemukan.');
  if (c.result) return { result: c.result, reason };
  await t.query(`update fishing_casts set result = 'lepas', reason = $2, resolved_at = now() where id = $1`, [castId, reason]);
  return { result: 'lepas' as const, reason, shadow: shadowOf(c) };
}

export type LandCtx = { cast: CastRow; item: CatalogItem; kind: CatchKind; tier: FishTier; cm: number | null; payload: any };

/**
 * Ikan sampai di dermaga: wajib sudah kena kail dan tarik-ulur tidak lebih cepat dari lama minimal.
 * Hadiah ditentukan oleh `reward` (kolam: masuk Tas, koin peti/botol, Mutiara dengan batas harian, XP).
 */
export async function landFish<R extends object>(t: Db, uid: string, castId: string, cat: Catalog, reward: (ctx: LandCtx) => Promise<R>, now = Date.now()) {
  const c = await t.one<CastRow>(castSql, [castId, uid]);
  if (!c) throw notFound('Lemparan tidak ditemukan.');
  if (c.result) throw bad('resolved', 'Lemparan ini sudah selesai.');
  if (!c.hooked_at) throw bad('not_hooked', 'Kailnya belum menyangkut.');
  const elapsed = now - new Date(c.hooked_at).getTime();
  const min = c.fight_min_ms ?? 0;
  if (elapsed < min - LAND_EARLY_MS || elapsed > min + LAND_MAX_EXTRA_MS) {
    const reason = elapsed < min ? 'cepat' : 'lama';
    await t.query(`update fishing_casts set result = 'lepas', reason = $2, resolved_at = now() where id = $1`, [castId, reason]);
    return { result: 'lepas' as const, reason, suspicious: reason === 'cepat', elapsed, min, shadow: shadowOf(c) };
  }
  const item = cat.byId.get(c.fish_id);
  if (!item) {
    await t.query(`update fishing_casts set result = 'lepas', reason = 'hilang', resolved_at = now() where id = $1`, [castId]);
    return { result: 'lepas' as const, reason: 'hilang', shadow: shadowOf(c) };
  }
  await t.query(`update fishing_casts set result = 'caught', resolved_at = now() where id = $1`, [castId]);
  const kind = (c.catch_kind ?? pondKind(item) ?? 'fish') as CatchKind;
  const out = await reward({ cast: c, item, kind, tier: fishTier(item.data), cm: c.cm === null ? null : Number(c.cm), payload: c.payload ?? {} });
  return { result: 'caught' as const, ...out };
}

/** Mutiara dari kolam dengan batas harian (peti + ikan yang dilepas). */
export async function pondPearls(t: Db, uid: string, want: number, cap: number, reason: string, ref: string) {
  if (!(want > 0) || !(cap > 0)) return 0;
  const day = today();
  await t.query(`insert into daily_counters (user_id, key, day, count) values ($1, 'fish_pearl', $2, 0) on conflict (user_id, key, day) do nothing`, [uid, day]);
  const r = await t.one<{ count: number }>(`select count from daily_counters where user_id = $1 and key = 'fish_pearl' and day = $2 for update`, [uid, day]);
  const n = Math.max(0, Math.min(Math.round(want), Math.round(cap) - (r?.count ?? 0)));
  if (n <= 0) return 0;
  await t.query(`update daily_counters set count = count + $3 where user_id = $1 and key = 'fish_pearl' and day = $2`, [uid, day, n]);
  await credit(t, uid, 'pearl', n, reason, ref);
  return n;
}

/** Progres Buku Ikan: jumlah jenis ikan tertangkap dari semua ikan aktif (termasuk rahasia). */
export async function bookProgress(q: Db, uid: string, cat: Catalog) {
  const fish = cat.items.filter((i) => i.active && pondKind(i) === 'fish').map((i) => i.id);
  const r = await q.one<{ c: number }>(`select count(*)::int c from fish_collection where user_id = $1 and count > 0 and fish_id = any($2::text[])`, [uid, fish]);
  return { got: r?.c ?? 0, total: fish.length };
}

/** Hadiah Kolam Pancing (rumah): ikan & temuan masuk Tas, koin botol/peti, Mutiara berbatas, XP, ceria. */
export function kolamReward(t: Db, uid: string, s: Settings, cat: Catalog) {
  const F = s.fishing as any;
  return async ({ cast, item, kind, tier, cm, payload }: LandCtx) => {
    const fish = kind === 'fish';
    const out: Record<string, any> = { kind, tier: fish ? tier : null, cm, item: publicItem(item), coins: 0, pearl: 0, xp: 0 };
    const prev = await t.one<{ best_cm: number; count: number }>(`select best_cm, count from fish_collection where user_id = $1 and fish_id = $2`, [uid, item.id]);
    await t.query(
      `insert into fish_collection (user_id, fish_id, count, best_cm) values ($1,$2,1,$3)
       on conflict (user_id, fish_id) do update set count = fish_collection.count + 1, best_cm = greatest(fish_collection.best_cm, excluded.best_cm)`,
      [uid, item.id, cm ?? 0],
    );
    out.firstCatch = !prev || !(prev.count > 0);
    out.newRecord = fish && !!prev && prev.count > 0 && (cm ?? 0) > prev.best_cm;
    out.bestCm = Math.max(prev?.best_cm ?? 0, cm ?? 0);
    let ceria = 0;
    const mult = coinMultiplier(cat);
    if (fish) {
      out.secret = !!item.data?.secret;
      if (item.data?.release) {
        // ikan keramat dicatat lalu dilepas lagi: berkah Mutiara (berbatas harian) & ceria
        out.released = true;
        out.pearlWanted = Math.max(0, Math.round(num(F.release?.pearl, 1)));
        out.pearl = await pondPearls(t, uid, out.pearlWanted, num(F.pearlDailyCap, 3), 'fish-release', cast.id);
        ceria = Math.max(0, num(F.release?.ceria, 20));
        out.ceria = ceria;
      } else await addItem(t, uid, item.id, 1);
      out.xp = Math.max(0, Math.round(num(F.xp?.[tier], 3)));
      await track(t, uid, 'fish', { fishId: item.id, tier, cm });
    } else {
      if (kind === 'junk' || kind === 'decor' || kind === 'wear') await addItem(t, uid, item.id, 1);
      if (kind === 'bottle') {
        out.coins = Math.round(num(payload.coin, 0) * mult);
        out.message = String(payload.msg ?? '');
        if (payload.hintFish && cat.byId.get(payload.hintFish)) {
          const h = await t.one(`insert into fish_hints (user_id, fish_id) values ($1,$2) on conflict do nothing returning fish_id`, [uid, payload.hintFish]);
          out.hint = true;
          out.hintNew = !!h;
        }
      }
      if (kind === 'treasure') {
        out.coins = Math.round(num(payload.coin, 0) * mult);
        out.pearlWanted = Math.max(0, Math.round(num(payload.pearl, 0)));
        out.pearl = await pondPearls(t, uid, out.pearlWanted, num(F.pearlDailyCap, 3), 'fish-treasure', cast.id);
      }
      if (out.coins > 0) await credit(t, uid, 'coin', out.coins, 'fish-' + kind, cast.id);
      out.xp = Math.max(0, Math.round(num(F.xp?.temuan, 1)));
      await track(t, uid, 'fish_find', { itemId: item.id, find: kind });
    }
    // bonus Ramai-ramai (mancing santai bersama di kolam alun-alun): XP tambahan, tanpa koin
    const ramaiXp = Math.max(0, Math.round(num(payload?.ramaiXp, 0)));
    if (ramaiXp > 0) { out.xp += ramaiXp; out.ramaiXp = ramaiXp; }
    const pet = await lockPet(t, uid);
    if (pet && (out.xp > 0 || ceria > 0)) {
      const lv = out.xp > 0 ? await grantXp(t, uid, pet, out.xp) : null;
      await savePet(t, uid, { ...(lv ? { level: lv.level, xp: lv.xp } : {}), ...(ceria > 0 ? { needs: applyNeedDelta(currentNeeds(pet, s), { ceria }) } : {}) });
      if (lv?.levelsGained) out.levelUp = lv.level;
    }
    out.book = await bookProgress(t, uid, cat);
    if (out.secret) {
      out.revealed = await revealedItems(t, uid, cat);
      const sec = cat.items.filter((i) => i.active && i.data?.secret).map((i) => i.id);
      const n = await t.one<{ c: number }>(`select count(*)::int c from fish_collection where user_id = $1 and count > 0 and fish_id = any($2::text[])`, [uid, sec]);
      out.secretOf = { got: n?.c ?? 0, total: sec.length };
    }
    return out;
  };
}

/** Isi Buku Ikan untuk pemain: tangkapan, ikan rahasia ("???" + petunjuk yang sudah dibaca), dan yang sudah terbuka. */
export async function fishBook(q: Db, uid: string, cat: Catalog) {
  const [rows, hints] = await Promise.all([
    q.query<{ fish_id: string; count: number; best_cm: number; first_at: Date }>(`select fish_id, count, best_cm, first_at from fish_collection where user_id = $1 and count > 0`, [uid]),
    q.query<{ fish_id: string }>(`select fish_id from fish_hints where user_id = $1`, [uid]),
  ]);
  const caught = new Set(rows.map((r) => r.fish_id));
  const read = new Set(hints.map((h) => h.fish_id));
  const secrets = cat.items.filter((i) => i.active && i.data?.secret && pondKind(i) === 'fish');
  return {
    collection: rows,
    // rahasia yang belum tertangkap: hanya tingkat & petunjuk yang sudah dibaca (tanpa id/nama/gambar)
    secrets: secrets.filter((i) => !caught.has(i.id)).map((i, k) => ({ key: 's' + (k + 1), tier: fishTier(i.data), hint: read.has(i.id) && typeof i.data?.hint === 'string' ? i.data.hint : null })),
    revealed: await revealedItems(q, uid, cat),
    book: await bookProgress(q, uid, cat),
  };
}
