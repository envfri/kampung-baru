// Sahabat Mungil: anak ayam pertama (gratis), burung pipit di Halaman, kunang-kunang malam hari, ajak / istirahatkan,
// beri nama, warna kerang umang-umang, beri Camilan Sahabat (sekali sehari), main (beberapa kali sehari), oleh-oleh
// harian, dan jalan-jalan di peta. Sahabat yang dibeli lewat /api/shop/buy (item jenis 'sahabat', routes/game.ts);
// kura-kura dari Kolam Pancing (routes/activities.ts). Semua aturan & batas harian dicek di sini, di dalam transaksi.
import type { FastifyInstance } from 'fastify';
import {
  SAHABAT_CAMILAN, SAHABAT_INFO, SAHABAT_NAME_MAX, isSahabatSp, isUmangColor, kunangOpen, localHM, tzOf, type SahabatSp,
} from '@kb/shared';
import type { Db } from '../db/index';
import { addItem, bad, checkName, credit, getCatalog, getSettings, notFound, track } from '../lib/core';
import { requireUser } from '../lib/auth';
import {
  SB, addPoints, buddyView, grantBuddy, outing, pipitWaiting, sahabatClock, sahabatOf, sahabatRandom, sahabatState, takeDaily, type BuddyRow,
} from '../lib/sahabat';
import { reqId } from '../lib/validate';
import { once, patch } from './game';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hh = (h: number) => `${String(h % 24).padStart(2, '0')}.00`;

export default async function sahabatRoutes(app: FastifyInstance, { db }: { db: Db }) {
  const auth = { preHandler: requireUser(db) };

  async function nameOf(raw: unknown, sp: SahabatSp) {
    if (raw === undefined || raw === null || String(raw).trim() === '') return SAHABAT_INFO[sp].nama[0];
    const n = await checkName(db, String(raw).slice(0, 40));
    if (n.length > SAHABAT_NAME_MAX) throw bad('name_length', `Nama sahabat paling panjang ${SAHABAT_NAME_MAX} huruf.`);
    return n;
  }
  const on = async () => {
    const s = await getSettings(db);
    if (sahabatOf(s).on === false) throw bad('sahabat_off', 'Pondok Sahabat sedang tutup. Coba lagi nanti, ya.');
    return s;
  };
  const idOf = (v: unknown) => { const id = String(v ?? ''); if (!UUID.test(id)) throw bad('invalid', 'Sahabat tidak ditemukan.'); return id; };
  async function mine(t: Db, uid: string, id: string) {
    const b = await t.one<BuddyRow>(`select * from pet_buddies where id = $1 and user_id = $2 for update`, [id, uid]);
    if (!b || !isSahabatSp(b.species)) throw notFound('Sahabat tidak ditemukan.');
    return b;
  }
  /** keadaan sahabat terbaru + bagian state lain yang berubah */
  const out = async (t: Db, uid: string, parts: Parameters<typeof patch>[2] = []) => ({ sahabat: await sahabatState(t, uid, await getSettings(t)), ...(await patch(t, uid, parts)) });

  app.get('/api/sahabat', auth, async (req: any) => {
    const uid = req.user!.id;
    const s = await getSettings(db);
    return { sahabat: await sahabatState(db, uid, s), serverNow: Date.now() };
  });

  /* ---------------- dapat sahabat ---------------- */

  /** sahabat pertama: anak ayam yang menunggu di depan pintu */
  app.post('/api/sahabat/ayam', auth, async (req: any) => {
    const uid = req.user!.id;
    await on();
    const name = await nameOf(req.body?.name, 'ayam');
    return once(db, uid, reqId(req.body?.requestId), async (t) => {
      if (!(await t.one(`select 1 from pets where user_id = $1`, [uid]))) throw bad('no_pet', 'Buat pet dulu.');
      const b = await grantBuddy(t, uid, 'ayam', name, 'gratis');
      return { ok: true, buddy: buddyView(b, sahabatOf(await getSettings(t))), ...(await out(t, uid)) };
    });
  });

  /** burung pipit yang mampir ke Tempat Minum Burung / Sangkar Burung di Halaman */
  app.post('/api/sahabat/pipit', auth, async (req: any) => {
    const uid = req.user!.id;
    await on();
    const name = await nameOf(req.body?.name, 'pipit');
    const cat = await getCatalog(db);
    return once(db, uid, reqId(req.body?.requestId), async (t) => {
      if (!(await pipitWaiting(t, uid, cat))) {
        if (await t.one(`select 1 from pet_buddies where user_id = $1 and species = 'pipit'`, [uid])) throw bad('owned', 'Burung pipit sudah jadi sahabatmu.');
        throw bad('no_pipit', 'Burung pipit belum mampir. Pasang Tempat Minum Burung atau Sangkar Burung di Halaman dulu, ya.');
      }
      const b = await grantBuddy(t, uid, 'pipit', name, 'pipit');
      return { ok: true, buddy: buddyView(b, sahabatOf(await getSettings(t))), ...(await out(t, uid)) };
    });
  });

  /** kunang-kunang di halaman pada malam hari (jam setempat pemain, bawaan WIB) */
  app.post('/api/sahabat/kunang', auth, async (req: any) => {
    const uid = req.user!.id;
    const s = await on();
    const k = sahabatOf(s);
    if (!kunangOpen(localHM(sahabatClock(), tzOf(req.body?.tz)), k.kunang)) {
      throw bad('not_night', `Kunang-kunang hanya muncul malam hari, pukul ${hh(k.kunang.fromHour)}–${hh(k.kunang.toHour)}. Tunggu malam, ya.`);
    }
    const name = await nameOf(req.body?.name, 'kunang');
    return once(db, uid, reqId(req.body?.requestId), async (t) => {
      const b = await grantBuddy(t, uid, 'kunang', name, 'kunang');
      return { ok: true, buddy: buddyView(b, k), ...(await out(t, uid)) };
    });
  });

  /* ---------------- atur sahabat ---------------- */

  /** ajak jalan-jalan (jadi sahabat aktif, yang lain istirahat) atau istirahatkan semua (id kosong) */
  app.post('/api/sahabat/aktif', auth, async (req: any) => {
    const uid = req.user!.id;
    const id = req.body?.id ? idOf(req.body.id) : null;
    return once(db, uid, reqId(req.body?.requestId), async (t) => {
      if (id) await mine(t, uid, id);
      await t.query(`update pet_buddies set active = false where user_id = $1 and active and ($2::uuid is null or id <> $2::uuid)`, [uid, id]);
      if (id) await t.query(`update pet_buddies set active = true where id = $1`, [id]);
      await track(t, uid, 'sahabat_aktif', { id });
      return { ok: true, ...(await out(t, uid)) };
    });
  });

  app.post('/api/sahabat/nama', auth, async (req: any) => {
    const uid = req.user!.id;
    const id = idOf(req.body?.id);
    const b0 = await db.one<BuddyRow>(`select species from pet_buddies where id = $1 and user_id = $2`, [id, uid]);
    if (!b0 || !isSahabatSp(b0.species)) throw notFound('Sahabat tidak ditemukan.');
    if (!String(req.body?.name ?? '').trim()) throw bad('name_length', 'Tulis nama sahabatmu dulu, ya.');
    const name = await nameOf(req.body?.name, b0.species);
    return once(db, uid, reqId(req.body?.requestId), async (t) => {
      await mine(t, uid, id);
      await t.query(`update pet_buddies set name = $2 where id = $1`, [id, name]);
      return { ok: true, name, ...(await out(t, uid)) };
    });
  });

  /** warna rumah kerang umang-umang */
  app.post('/api/sahabat/warna', auth, async (req: any) => {
    const uid = req.user!.id;
    const id = idOf(req.body?.id);
    if (!isUmangColor(req.body?.variant)) throw bad('invalid', 'Warna kerang tidak dikenal.');
    return once(db, uid, reqId(req.body?.requestId), async (t) => {
      const b = await mine(t, uid, id);
      if (b.species !== 'umang') throw bad('invalid', 'Hanya rumah kerang umang-umang yang bisa diganti warnanya.');
      await t.query(`update pet_buddies set variant = $2 where id = $1`, [id, req.body.variant]);
      return { ok: true, ...(await out(t, uid)) };
    });
  });

  /* ---------------- keakraban ---------------- */

  /** beri Camilan Sahabat: keakraban dihitung sekali sehari per sahabat (camilan hanya dipakai bila dihitung) */
  app.post('/api/sahabat/makan', auth, async (req: any) => {
    const uid = req.user!.id;
    const s = await on();
    const k = sahabatOf(s);
    const id = idOf(req.body?.id);
    return once(db, uid, reqId(req.body?.requestId), async (t) => {
      const b = await mine(t, uid, id);
      if (!(await takeDaily(t, uid, SB.makan(b.id), 1))) throw bad('fed_today', `${b.name} sudah makan camilan hari ini. Besok lagi, ya!`);
      const have = await t.one<{ qty: number }>(`select qty from inventory where user_id = $1 and item_id = $2`, [uid, SAHABAT_CAMILAN]);
      if (!have || have.qty < 1) throw bad('no_snack', 'Camilan Sahabat habis. Beli di Pondok Sahabat, ya.');
      await addItem(t, uid, SAHABAT_CAMILAN, -1);
      const r = await addPoints(t, uid, b, k.points.makan, k);
      await track(t, uid, 'sahabat_makan', { sp: b.species });
      return { ok: true, result: { name: b.name, sp: b.species, ...r }, ...(await out(t, uid, ['inventory'])) };
    });
  });

  /** main (ketuk sahabat): keakraban dihitung mainPerDay kali sehari per sahabat; sesudahnya tetap boleh main tanpa poin */
  app.post('/api/sahabat/main', auth, async (req: any) => {
    const uid = req.user!.id;
    const s = await on();
    const k = sahabatOf(s);
    const id = idOf(req.body?.id);
    return once(db, uid, reqId(req.body?.requestId), async (t) => {
      const b = await mine(t, uid, id);
      const counted = await takeDaily(t, uid, SB.main(b.id), k.mainPerDay);
      const r = counted ? await addPoints(t, uid, b, k.points.main, k) : null;
      if (counted) await track(t, uid, 'sahabat_main', { sp: b.species });
      return { ok: true, result: { name: b.name, sp: b.species, counted, ...(r ?? { gain: 0, points: b.points, lvl: b.lvl, up: null }) }, ...(await out(t, uid)) };
    });
  });

  /** oleh-oleh harian dari sahabat aktif: koin atau barang sesuai jenisnya, sekali sehari */
  app.post('/api/sahabat/oleh', auth, async (req: any) => {
    const uid = req.user!.id;
    const s = await on();
    const k = sahabatOf(s);
    const cat = await getCatalog(db);
    return once(db, uid, reqId(req.body?.requestId), async (t) => {
      const b = await t.one<BuddyRow>(`select * from pet_buddies where user_id = $1 and active for update`, [uid]);
      if (!b || !isSahabatSp(b.species)) throw bad('no_buddy', 'Ajak salah satu sahabat dulu, nanti ia membawa oleh-oleh.');
      if (!(await takeDaily(t, uid, SB.oleh, 1))) throw bad('gift_taken', `Oleh-oleh hari ini sudah diterima. Besok ${b.name} bawa lagi, ya!`);
      const pool = (k.gifts?.[b.species] ?? []).filter((id) => id === 'koin' || (cat.byId.get(id)?.active && cat.byId.get(id)?.kind !== 'sahabat'));
      const pick = pool.length ? pool[Math.floor(sahabatRandom() * pool.length) % pool.length] : 'koin';
      let gift: { coins: number; item: string | null; itemName: string | null };
      if (pick === 'koin') {
        const [lo, hi] = [Math.min(k.giftCoins[0], k.giftCoins[1]), Math.max(k.giftCoins[0], k.giftCoins[1])];
        const coins = Math.max(1, lo + Math.floor(sahabatRandom() * (hi - lo + 1)));
        await credit(t, uid, 'coin', coins, 'sahabat_oleh', b.id);
        gift = { coins, item: null, itemName: null };
      } else {
        await addItem(t, uid, pick, 1);
        gift = { coins: 0, item: pick, itemName: cat.byId.get(pick)?.name ?? pick };
      }
      await track(t, uid, 'sahabat_oleh', { sp: b.species, item: gift.item ?? 'koin' });
      return { ok: true, result: { name: b.name, sp: b.species, ...gift }, ...(await out(t, uid, ['wallet', 'inventory'])) };
    });
  });

  /** jalan di peta bersama sahabat aktif: keakraban sekali sehari (berkunjung & alun-alun dihitung di sinkron masing-masing) */
  app.post('/api/sahabat/jalan', { ...auth, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req: any) => {
    const uid = req.user!.id;
    await on();
    const r = await outing(db, uid, 'peta');
    return { ok: true, result: r, sahabat: await sahabatState(db, uid, await getSettings(db)) };
  });
}
