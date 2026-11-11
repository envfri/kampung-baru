// Alun-alun: tempat berkumpul semua pemain (bukan hanya teman), maksimal 20 orang per alun-alun;
// bila penuh otomatis dibuka Alun-alun 2, 3, ... Polling seperti rumah live (±1 detik), keadaan di memori.
//  - obrolan tersaring (frasa siap pakai + ketik bebas bila diizinkan admin), dicatat untuk moderasi;
//  - pemain yang saling memblokir tidak saling melihat sama sekali; laporkan pemain (3 laporan/jam = dibisukan 30 menit);
//  - hiburan: panggung terjadwal, komidi putar, ayunan, beringin, bangku, joget bareng saat musik, jajanan, foto bareng.
import type { FastifyInstance } from 'fastify';
import { ALUN_ROOM, ALUN_SIZE, applyNeedDelta, petLookState, SQUARE_PLAY, SQUARE_SNACKS, squareShow, type Needs } from '@kb/shared';
import type { Db } from '../db/index';
import { bad, bumpCounter, checkChat, coinMultiplier, counter, credit, forbidden, getCatalog, getSettings, track } from '../lib/core';
import { requireUser } from '../lib/auth';
import { currentNeeds, isAsleep, lockPet, petView, savePet } from '../lib/state';
import { grantXp, patch } from './game';
import { EMOTES, markPresence } from './house';

const LIVE_MS = 10_000;
const ACTS_LIVE = new Set(['jalan', 'duduk', 'lihat', 'joget', 'naik', 'ayun']);
type Member = { id: string; name: string; pet: any; x: number; y: number; flip: boolean; act: string | null; seenAt: number; petAt: number; emoteAt: number; jogetAt: number };
type Ev = { seq: number; at: number; kind: string; from?: string; [k: string]: unknown };
type Square = { id: number; members: Map<string, Member>; events: Ev[]; seq: number };

const SQUARES = new Map<number, Square>();
/** alun-alun tempat tiap pemain berada */
const WHERE = new Map<string, number>();
const SAID = new Map<string, number>();
/** pemain yang dibisukan sementara karena banyak dilaporkan */
const MUTED = new Map<string, number>();
/** cache daftar blokir per pemain (dua arah) */
const BLOCKS = new Map<string, { at: number; ids: Set<string> }>();
const BOOT = Math.random().toString(36).slice(2, 10);
const fresh = (m: Member, now = Date.now()) => now - m.seenAt < LIVE_MS;

function squareOf(id: number) {
  let q = SQUARES.get(id);
  if (!q) { q = { id, members: new Map(), events: [], seq: 0 }; SQUARES.set(id, q); }
  return q;
}
function push(q: Square, ev: Omit<Ev, 'seq' | 'at'>) {
  q.seq++;
  q.events.push({ ...ev, seq: q.seq, at: Date.now() } as Ev);
  const cut = Date.now() - 60_000;
  while (q.events.length > 200 || (q.events.length && q.events[0].at < cut)) q.events.shift();
}
function prune(q: Square) {
  const now = Date.now();
  for (const m of q.members.values()) if (!fresh(m, now)) { q.members.delete(m.id); if (WHERE.get(m.id) === q.id) WHERE.delete(m.id); push(q, { kind: 'leave', from: m.id, name: m.name }); }
}
const count = (q: Square) => { const now = Date.now(); let n = 0; for (const m of q.members.values()) if (fresh(m, now)) n++; return n; };
setInterval(() => {
  const now = Date.now();
  for (const [id, q] of SQUARES) { prune(q); if (!q.members.size) SQUARES.delete(id); }
  for (const [k, v] of SAID) if (now - v > 60_000) SAID.delete(k);
  for (const [k, v] of MUTED) if (v < now) MUTED.delete(k);
  for (const [k, v] of BLOCKS) if (now - v.at > 120_000) BLOCKS.delete(k);
}, 60_000).unref?.();

/** Jumlah orang di tiap alun-alun (untuk peta & daftar teman). */
export function squareCounts() {
  return [...SQUARES.values()].map((q) => ({ id: q.id, count: count(q) })).filter((x) => x.count > 0).sort((a, b) => a.id - b.id);
}
/** Daftar blokir berubah: lupakan cache supaya langsung berlaku di alun-alun. */
export function forgetBlocks(a: string, b: string) { BLOCKS.delete(a); BLOCKS.delete(b); }
export function resetSquares() { SQUARES.clear(); WHERE.clear(); SAID.clear(); MUTED.clear(); BLOCKS.clear(); }

export default async function squareRoutes(app: FastifyInstance, { db }: { db: Db }) {
  const auth = { preHandler: requireUser(db) };
  const fast = { ...auth, config: { rateLimit: { max: 400, timeWindow: '1 minute' } } };

  async function settings() {
    const s: any = await getSettings(db);
    return { s, a: s.square ?? {} };
  }
  async function blocksOf(uid: string) {
    const c = BLOCKS.get(uid);
    if (c && Date.now() - c.at < 60_000) return c.ids;
    const rows = await db.query<{ other: string }>(`select case when user_id = $1 then blocked_id else user_id end as other from blocks where user_id = $1 or blocked_id = $1`, [uid]);
    const ids = new Set(rows.map((r) => r.other));
    BLOCKS.set(uid, { at: Date.now(), ids });
    return ids;
  }
  async function memberInfo(uid: string) {
    const s = await getSettings(db);
    const r = await db.one<any>(`select u.display_name, p.* from users u left join pets p on p.user_id = u.id where u.id = $1`, [uid]);
    if (!r?.name) return { name: r?.display_name ?? 'Pemain', pet: null, asleep: false };
    const v = petView({ ...r, user_id: uid }, s);
    return { name: r.display_name, asleep: !!v.sleep, pet: { name: v.name, color: v.color, ear: v.ear, pattern: v.pattern, eyes: v.eyes, tail: v.tail, wear: v.wear, level: v.level, state: petLookState(v.needs, { sleeping: !!v.sleep, sick: v.sick, chub: v.chub }) } };
  }
  const view = (m: Member) => ({ id: m.id, name: m.name, pet: m.pet, roomId: ALUN_ROOM, x: m.x, y: m.y, flip: m.flip, act: m.act, host: false });
  /** alun-alun pemain ini sekarang (atau undefined bila belum masuk) */
  const here = (uid: string) => { const id = WHERE.get(uid); const q = id ? SQUARES.get(id) : undefined; const m = q?.members.get(uid); return q && m && fresh(m) ? { q, m } : null; };

  /** Pilih alun-alun: tetap di tempat sekarang, susul teman (want) bila masih muat, selain itu yang terisi paling awal & belum penuh. */
  function assign(uid: string, want: number, max: number) {
    const cur = WHERE.get(uid);
    if (cur && SQUARES.get(cur)?.members.has(uid)) return cur;
    if (want && SQUARES.has(want) && count(SQUARES.get(want)!) < max) return want;
    const ids = [...SQUARES.keys()].sort((a, b) => a - b);
    for (const id of ids) if (count(SQUARES.get(id)!) < max) return id;
    let id = 1;
    while (SQUARES.has(id)) id++;
    return id;
  }

  app.post('/api/square/sync', fast, async (req: any) => {
    const { a } = await settings();
    const uid = req.user!.id;
    if (a.enabled === false) return { live: false, reason: 'off' };
    const b = req.body ?? {};
    const since = Math.max(0, Number(b.since) || 0);
    const max = Math.max(2, Math.min(50, Number(a.max) || 20));
    const num = (v: unknown) => Math.max(0.5, Math.min(ALUN_SIZE - 0.5, Number(v) || 0));
    let id = assign(uid, Number(b.inst) || 0, max);
    let q = squareOf(id);
    prune(q);
    let m = q.members.get(uid);
    let joined = false;
    if (!m) {
      const info = await memberInfo(uid);
      if (!info.pet) throw bad('no_pet', 'Buat pet dulu, ya.');
      if (info.asleep) return { live: false, reason: 'asleep' };
      // permintaan lain bisa sudah mengisi alun-alun ini selama menunggu data pet
      id = assign(uid, id, max);
      q = squareOf(id);
      m = q.members.get(uid);
      if (!m) {
        m = { id: uid, name: info.name, pet: info.pet, x: num(b.x), y: num(b.y), flip: !!b.flip, act: null, seenAt: Date.now(), petAt: Date.now(), emoteAt: 0, jogetAt: 0 };
        q.members.set(uid, m);
        // pindah dari alun-alun lain
        const old = WHERE.get(uid);
        if (old && old !== id) { const oq = SQUARES.get(old); const om = oq?.members.get(uid); if (oq && om) { oq.members.delete(uid); push(oq, { kind: 'leave', from: uid, name: om.name }); } }
        WHERE.set(uid, id);
        push(q, { kind: 'join', from: uid, name: m.name });
        joined = true;
      }
    }
    m.x = num(b.x); m.y = num(b.y); m.flip = !!b.flip; m.seenAt = Date.now();
    m.act = typeof b.act === 'string' && ACTS_LIVE.has(b.act) ? b.act : null;
    if (m.act === 'joget') m.jogetAt = Date.now();
    if (typeof b.emote === 'string' && (EMOTES as readonly string[]).includes(b.emote) && Date.now() - m.emoteAt > 600) {
      m.emoteAt = Date.now();
      push(q, { kind: 'emote', from: uid, emote: b.emote });
    }
    if (Date.now() - m.petAt > 45_000) { m.petAt = Date.now(); const info = await memberInfo(uid); if (info.pet) m.pet = info.pet; m.name = info.name; }
    markPresence(uid, 'alun', String(id));
    // hadiah kunjungan pertama hari ini
    let welcome: any = null;
    if (joined && Number(a.dailyCoins) > 0) {
      // katalog dimuat di luar transaksi (PGlite: query lewat db di dalam tx = macet)
      const cat = await getCatalog(db);
      welcome = await db.tx(async (t) => {
        const used = await counter(t, uid, 'square_visit');
        if (used >= 1) return null;
        await bumpCounter(t, uid, 'square_visit', 1);
        const coins = Math.round(Number(a.dailyCoins) * coinMultiplier(cat));
        await credit(t, uid, 'coin', coins, 'square', 'kunjungan');
        await track(t, uid, 'square_visit', {});
        return { coins, ...(await patch(t, uid, ['wallet'])) };
      }).catch(() => null);
    }
    const now = Date.now();
    const blocked = await blocksOf(uid);
    const all = [...q.members.values()].filter((x) => fresh(x, now) && x.id !== uid && !blocked.has(x.id));
    return {
      live: true, me: uid, inst: id, count: count(q), max, boot: BOOT, seq: q.seq,
      members: all.map(view), elsewhere: [],
      // kejadian dari pemain yang saling memblokir tidak dikirim
      events: q.events.filter((e) => e.seq > since && !(e.from && blocked.has(e.from))),
      show: squareShow(now), coop: null, welcome, serverNow: now,
      others: squareCounts().filter((x) => x.id !== id),
    };
  });

  app.post('/api/square/leave', auth, async (req: any) => {
    const uid = req.user!.id;
    const h = here(uid);
    if (h) { h.q.members.delete(uid); push(h.q, { kind: 'leave', from: uid, name: h.m.name }); }
    WHERE.delete(uid);
    return { ok: true };
  });

  app.post('/api/square/say', { ...auth, config: { rateLimit: { max: 40, timeWindow: '1 minute' } } }, async (req: any) => {
    const { a } = await settings();
    const uid = req.user!.id;
    const h = here(uid);
    if (!h) throw bad('not_here', 'Masuk ke alun-alun dulu.');
    if ((MUTED.get(uid) ?? 0) > Date.now()) throw forbidden('Obrolanmu sedang dibatasi sementara karena laporan pemain lain.');
    if (Date.now() - (SAID.get(uid) ?? 0) < 1500) throw bad('too_fast', 'Pelan-pelan, ya.');
    const text = String(req.body?.text ?? '').replace(/\s+/g, ' ').trim();
    const max = Math.max(10, Math.min(200, Number(a.chatMax) || 80));
    if (!text) throw bad('empty', 'Tulis pesan dulu.');
    if (text.length > max) throw bad('too_long', `Pesan maksimal ${max} huruf.`);
    const preset = (a.phrases ?? []).includes(text);
    if (!preset) {
      if (!a.freeChat) throw bad('preset_only', 'Di alun-alun pilih salah satu frasa yang tersedia.');
      await checkChat(db, text);
    }
    SAID.set(uid, Date.now());
    await db.query(`insert into square_chat (inst, user_id, text) values ($1,$2,$3)`, [h.q.id, uid, text]);
    push(h.q, { kind: 'say', from: uid, text });
    return { ok: true, seq: h.q.seq };
  });

  /** Main di alun-alun: nonton, naik komidi putar, ayunan, berteduh, duduk, joget (hadiah harian terbatas) dan jajan. */
  app.post('/api/square/act', { ...auth, config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req: any) => {
    const { s, a } = await settings();
    const uid = req.user!.id;
    const h = here(uid);
    if (!h) throw bad('not_here', 'Masuk ke alun-alun dulu.');
    const kind = String(req.body?.kind ?? '');
    const cat = await getCatalog(db);
    if (kind === 'jajan') {
      const snackId = String(req.body?.item ?? '');
      const snack = SQUARE_SNACKS[snackId];
      if (!snack) throw bad('invalid', 'Jajanan tidak dikenal.');
      return db.tx(async (t) => {
        await bumpCounter(t, uid, 'square_snack', Math.max(1, Number(a.snacksPerDay) || 5));
        await credit(t, uid, 'coin', -snack.coins, 'square_snack', snackId);
        const pet = await lockPet(t, uid);
        if (!pet) throw bad('no_pet', 'Buat pet dulu.');
        if (isAsleep(pet, s)) throw bad('asleep', 'Pet sedang tidur.');
        await savePet(t, uid, { needs: applyNeedDelta(currentNeeds(pet, s), { kenyang: snack.kenyang, ceria: snack.ceria } as Partial<Needs>) });
        await track(t, uid, 'square_act', { kind: 'jajan', item: snackId });
        return { ok: true, kind, snack: snack.name, ...(await patch(t, uid, ['pet', 'wallet'])) };
      });
    }
    if (!(SQUARE_PLAY as readonly string[]).includes(kind)) throw bad('invalid', 'Aksi tidak dikenal.');
    const show = squareShow(Date.now());
    if (kind === 'nonton' && !show.playing) throw bad('show_break', `Pertunjukan berikutnya, ${show.next.name}, mulai sebentar lagi.`);
    if (kind === 'joget' && !show.music) throw bad('no_music', 'Joget saat ada musik di panggung, ya.');
    // joget bareng: makin ramai yang joget, makin ceria
    const dancers = kind === 'joget' ? [...h.q.members.values()].filter((m) => fresh(m) && Date.now() - m.jogetAt < 8000).length : 0;
    const res = await db.tx(async (t) => {
      const used = await counter(t, uid, 'square_play');
      const cap = Math.max(0, Number(a.actsPerDay) || 10);
      const rewarded = used < cap;
      if (rewarded) await bumpCounter(t, uid, 'square_play', cap);
      const pet = await lockPet(t, uid);
      if (!pet) throw bad('no_pet', 'Buat pet dulu.');
      if (isAsleep(pet, s)) throw bad('asleep', 'Pet sedang tidur.');
      const ceria = (Number(a.ceria) || 6) + (dancers >= 3 ? 4 : 0);
      let coins = 0, xp = 0, levelUp: number | null = null;
      if (rewarded) {
        coins = Math.round((Number(a.actCoins) || 0) * coinMultiplier(cat));
        if (coins) await credit(t, uid, 'coin', coins, 'square_play', kind);
        xp = Number(a.actXp) || 0;
      }
      const lv = xp ? await grantXp(t, uid, pet, xp) : null;
      if (lv && lv.levelsGained > 0) levelUp = lv.level;
      await savePet(t, uid, { needs: applyNeedDelta(currentNeeds(pet, s), { ceria } as Partial<Needs>), ...(lv ? { level: lv.level, xp: lv.xp } : {}) });
      await track(t, uid, 'square_act', { kind });
      return { rewarded, coins, xp, levelUp, ceria, left: Math.max(0, cap - used - (rewarded ? 1 : 0)), out: await patch(t, uid, ['pet', 'wallet']) };
    });
    push(h.q, { kind: 'act', from: uid, act: kind });
    return { ok: true, kind, rewarded: res.rewarded, coins: res.coins, xp: res.xp, levelUp: res.levelUp, ceria: res.ceria, left: res.left, crowd: dancers, ...res.out };
  });

  /** Foto bareng di alun-alun: pet di sekitar yang memotret (radius 4 petak), tanpa pemain yang saling memblokir. */
  app.post('/api/square/photo', auth, async (req: any) => {
    const { s, a } = await settings();
    const uid = req.user!.id;
    const h = here(uid);
    if (!h) throw bad('not_here', 'Masuk ke alun-alun dulu.');
    const pose = ['senyum', 'lompat', 'peluk'].includes(req.body?.pose) ? req.body.pose : 'senyum';
    const blocked = await blocksOf(uid);
    const near = [...h.q.members.values()]
      .filter((m) => m.id !== uid && fresh(m) && !blocked.has(m.id) && Math.hypot(m.x - h.m.x, m.y - h.m.y) <= 4)
      .sort((p, q2) => Math.hypot(p.x - h.m.x, p.y - h.m.y) - Math.hypot(q2.x - h.m.x, q2.y - h.m.y));
    const ids = [uid];
    for (const m of near) {
      if (ids.length >= 6) break;
      // dua orang lain yang saling memblokir tidak difoto bersama
      if ([...(await blocksOf(m.id))].some((o) => ids.includes(o))) continue;
      ids.push(m.id);
    }
    if (ids.length < 2) throw bad('photo_alone', 'Ajak pet lain mendekat dulu supaya bisa foto bareng.');
    const members: any[] = [];
    for (const id of ids) { const info = await memberInfo(id); if (info.pet) members.push({ id, name: info.name, pet: info.pet }); }
    const photo = await db.tx(async (t) => {
      await bumpCounter(t, uid, 'photo', (s as any).visit?.photoPerDay ?? 6);
      const p = (await t.one<any>(
        `insert into photos (host_id, taken_by, pose, members, scene) values ($1,$2,$3,$4::text::jsonb,$5::text::jsonb) returning id, host_id, pose, members, scene, created_at`,
        [uid, uid, pose, JSON.stringify(members), JSON.stringify({ theme: 'alun', floor: null, wall: null })],
      ))!;
      for (const m of members) await t.query(`insert into photo_members (photo_id, user_id) values ($1,$2) on conflict do nothing`, [p.id, m.id]);
      await track(t, uid, 'photo', { place: 'alun' });
      return p;
    });
    push(h.q, { kind: 'photo', from: uid, photoId: photo.id });
    void a;
    return { ok: true, photo };
  });

  /** Laporkan pemain (obrolan / perilaku). Tiga pelapor berbeda dalam satu jam = obrolannya dibisukan 30 menit. */
  app.post('/api/square/report', { ...auth, config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (req: any) => {
    const uid = req.user!.id;
    const target = String(req.body?.userId ?? '');
    const reason = String(req.body?.reason ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!/^[0-9a-f-]{36}$/i.test(target) || target === uid) throw bad('invalid', 'Pemain tidak valid.');
    const today = await counter(db, uid, 'report');
    if (today >= 20) throw bad('daily_limit', 'Laporanmu hari ini sudah banyak. Terima kasih, admin akan memeriksa.');
    await bumpCounter(db, uid, 'report', 20);
    const said = await db.query<{ text: string; created_at: string }>(`select text, created_at from square_chat where user_id = $1 order by created_at desc limit 5`, [target]);
    await db.query(`insert into reports (reporter_id, target_id, place, reason, evidence) values ($1,$2,'alun',$3,$4::text::jsonb)`, [uid, target, reason || null, JSON.stringify(said)]);
    const n = await db.one<{ c: number }>(`select count(distinct reporter_id)::int c from reports where target_id = $1 and created_at > now() - interval '1 hour'`, [target]);
    if ((n?.c ?? 0) >= 3) MUTED.set(target, Date.now() + 30 * 60_000);
    return { ok: true };
  });

  /** Ketersediaan alun-alun untuk peta (jumlah orang). */
  app.get('/api/square', auth, async () => {
    const { a } = await settings();
    return { enabled: a.enabled !== false, max: Number(a.max) || 20, squares: squareCounts(), show: squareShow(Date.now()) };
  });

}
