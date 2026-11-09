// Tugas pemula & harian. Progres dihitung dari peristiwa yang sudah dicatat server (track),
// jadi pemain tidak bisa memalsukannya dari client.
import type { Db } from '../db/index';
import { addXp } from '@kb/shared';
import { bad, credit, getSettings, notFound, today, track } from './core';

export interface QuestDef {
  id: string; kind: 'starter' | 'daily'; title: string; description: string; event: string;
  filter: Record<string, string | number>; target: number; reward_coin: number; reward_pearl: number; reward_xp: number;
  url: string; sort: number; active: boolean;
}

let cache: { at: number; list: QuestDef[] } | null = null;
export async function getQuests(db: Db) {
  if (cache && Date.now() - cache.at < 15_000) return cache.list;
  const list = await db.query<QuestDef>(`select * from quests where active order by kind, sort, id`);
  cache = { at: Date.now(), list };
  return list;
}
export const invalidateQuests = () => { cache = null; };

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Tugas harian pemain untuk hari tertentu: acak tapi tetap sama sepanjang hari. */
export function dailyFor(userId: string, day: string, pool: QuestDef[], n: number) {
  return [...pool].sort((a, b) => hash(userId + day + a.id) - hash(userId + day + b.id)).slice(0, Math.max(0, n));
}

const matches = (filter: Record<string, unknown>, props: Record<string, unknown> | undefined) =>
  Object.entries(filter ?? {}).every(([k, v]) => String(props?.[k]) === String(v));

/** Dipanggil setiap ada peristiwa (lewat track). Menambah progres tugas yang cocok. */
export async function questEvent(db: Db, userId: string | null, name: string, props?: Record<string, unknown>) {
  if (!userId) return;
  const qs = await getQuests(db);
  const cands = qs.filter((q) => q.event === name && matches(q.filter, props));
  if (!cands.length) return;
  const s = await getSettings(db);
  if (!s.features.quests) return;
  const day = today();
  const daily = new Set(dailyFor(userId, day, qs.filter((q) => q.kind === 'daily'), s.quests.dailyCount).map((q) => q.id));
  for (const q of cands) {
    if (q.kind === 'daily' && !daily.has(q.id)) continue;
    await db.query(
      `insert into quest_progress (user_id, quest_id, period, progress, completed_at)
       values ($1, $2, $3, 1, case when 1 >= $4 then now() end)
       on conflict (user_id, quest_id, period) do update
         set progress = least($4, quest_progress.progress + 1),
             completed_at = coalesce(quest_progress.completed_at, case when quest_progress.progress + 1 >= $4 then now() end)
         where quest_progress.completed_at is null`,
      [userId, q.id, q.kind === 'starter' ? 'starter' : day, q.target],
    );
  }
}

export async function questList(db: Db, userId: string) {
  const s = await getSettings(db);
  const qs = await getQuests(db);
  const day = today();
  const daily = dailyFor(userId, day, qs.filter((q) => q.kind === 'daily'), s.quests.dailyCount);
  const rows = await db.query<{ quest_id: string; period: string; progress: number; completed_at: Date | null; claimed_at: Date | null }>(
    `select quest_id, period, progress, completed_at, claimed_at from quest_progress where user_id = $1 and (period = 'starter' or period = $2)`,
    [userId, day],
  );
  const prog = new Map(rows.map((r) => [`${r.quest_id}|${r.period}`, r]));
  const view = (q: QuestDef, period: string) => {
    const r = prog.get(`${q.id}|${period}`);
    return {
      id: q.id, kind: q.kind, title: q.title, description: q.description, target: q.target, url: q.url,
      reward: { coin: q.reward_coin, pearl: q.reward_pearl, xp: q.reward_xp },
      progress: Math.min(q.target, r?.progress ?? 0), done: !!r?.completed_at, claimed: !!r?.claimed_at,
    };
  };
  const starter = qs.filter((q) => q.kind === 'starter').map((q) => view(q, 'starter'));
  const dailyList = daily.map((q) => view(q, day));
  const all = [...starter, ...dailyList];
  const next = starter.find((q) => !q.claimed) ?? null;
  // tengah malam WIB berikutnya
  const now = Date.now() + 7 * 3600_000;
  const resetAt = new Date(Math.floor(now / 86_400_000 + 1) * 86_400_000 - 7 * 3600_000).toISOString();
  return {
    enabled: s.features.quests,
    starter,
    daily: dailyList,
    dailyResetAt: resetAt,
    summary: {
      ready: s.features.quests ? all.filter((q) => q.done && !q.claimed).length : 0,
      next: s.features.quests ? next : null,
      dailyDone: dailyList.filter((q) => q.claimed).length,
      dailyTotal: dailyList.length,
      starterLeft: starter.filter((q) => !q.claimed).length,
    },
  };
}

export async function questSummary(db: Db, userId: string) {
  return (await questList(db, userId)).summary;
}

/** Ambil hadiah tugas yang sudah selesai (sekali saja). */
export async function claimQuest(db: Db, userId: string, questId: string) {
  const qs = await getQuests(db);
  const q = qs.find((x) => x.id === questId);
  if (!q) throw notFound('Tugas tidak ditemukan.');
  const period = q.kind === 'starter' ? 'starter' : today();
  const row = await db.one(
    `update quest_progress set claimed_at = now() where user_id = $1 and quest_id = $2 and period = $3 and completed_at is not null and claimed_at is null returning 1 as ok`,
    [userId, q.id, period],
  );
  if (!row) throw bad('not_ready', 'Tugas ini belum selesai atau hadiahnya sudah diambil.');
  if (q.reward_coin) await credit(db, userId, 'coin', q.reward_coin, 'quest', q.id);
  if (q.reward_pearl) await credit(db, userId, 'pearl', q.reward_pearl, 'quest', q.id);
  let levelUp: number | null = null;
  if (q.reward_xp) {
    const pet = await db.one<{ level: number; xp: number }>(`select level, xp from pets where user_id = $1 for update`, [userId]);
    if (pet) {
      const s = await getSettings(db);
      const r = addXp(pet.level, pet.xp, q.reward_xp, s.economy);
      if (r.levelsGained > 0 && s.economy.levelUpCoins > 0) await credit(db, userId, 'coin', s.economy.levelUpCoins * r.levelsGained, 'level_up', String(r.level));
      await db.query(`update pets set level = $2, xp = $3 where user_id = $1`, [userId, r.level, r.xp]);
      if (r.levelsGained) levelUp = r.level;
    }
  }
  await track(db, userId, 'quest_claim', { questId: q.id, kind: q.kind });
  return { reward: { coin: q.reward_coin, pearl: q.reward_pearl, xp: q.reward_xp }, levelUp };
}

export const SEED_QUESTS: Omit<QuestDef, 'active'>[] = [
  // tugas pemula: mengenalkan semua fitur, berurutan
  { id: 'p-elus', kind: 'starter', title: 'Kenalan dulu', description: 'Ketuk pet-mu 3 kali untuk mengelusnya.', event: 'action', filter: { type: 'elus' }, target: 3, reward_coin: 20, reward_pearl: 0, reward_xp: 5, url: '/', sort: 10 },
  { id: 'p-makan', kind: 'starter', title: 'Waktunya makan', description: 'Beri makan pet lewat tombol Makan.', event: 'action', filter: { type: 'makan' }, target: 1, reward_coin: 25, reward_pearl: 0, reward_xp: 5, url: '/', sort: 20 },
  { id: 'p-mandi', kind: 'starter', title: 'Wangi lagi', description: 'Mandikan pet-mu.', event: 'action', filter: { type: 'mandi' }, target: 1, reward_coin: 20, reward_pearl: 0, reward_xp: 5, url: '/', sort: 30 },
  { id: 'p-belanja', kind: 'starter', title: 'Belanja pertama', description: 'Beli satu barang di toko mana saja.', event: 'purchase', filter: {}, target: 1, reward_coin: 30, reward_pearl: 0, reward_xp: 5, url: '/#shop', sort: 40 },
  { id: 'p-atur', kind: 'starter', title: 'Tata rumah', description: 'Tekan Atur, pindahkan barang, lalu Selesai.', event: 'room_save', filter: {}, target: 1, reward_coin: 40, reward_pearl: 0, reward_xp: 8, url: '/', sort: 50 },
  { id: 'p-baju', kind: 'starter', title: 'Gaya baru', description: 'Pakaikan satu aksesori ke pet lewat Tas › Pakaian.', event: 'wear', filter: {}, target: 1, reward_coin: 30, reward_pearl: 0, reward_xp: 5, url: '/#bag', sort: 60 },
  { id: 'p-tanam', kind: 'starter', title: 'Petani muda', description: 'Tanam satu bibit di Kebun.', event: 'plant', filter: {}, target: 1, reward_coin: 30, reward_pearl: 0, reward_xp: 5, url: '/#garden', sort: 70 },
  { id: 'p-lomba', kind: 'starter', title: 'Lomba pertama', description: 'Ikut Lomba Karung di Lapangan Lomba.', event: 'race', filter: {}, target: 1, reward_coin: 40, reward_pearl: 0, reward_xp: 8, url: '/#karung', sort: 80 },
  { id: 'p-mancing', kind: 'starter', title: 'Pemancing pemula', description: 'Tangkap satu ikan di Kolam Pancing.', event: 'fish', filter: {}, target: 1, reward_coin: 40, reward_pearl: 0, reward_xp: 8, url: '/#fishing', sort: 90 },
  { id: 'p-teman', kind: 'starter', title: 'Teman sekampung', description: 'Tambahkan satu teman lewat kode teman.', event: 'friend_added', filter: {}, target: 1, reward_coin: 50, reward_pearl: 2, reward_xp: 10, url: '/#friends', sort: 100 },
  { id: 'p-tamu', kind: 'starter', title: 'Bertamu', description: 'Kunjungi rumah teman dan ambil hadiah kunjungan.', event: 'visit', filter: {}, target: 1, reward_coin: 40, reward_pearl: 0, reward_xp: 8, url: '/#friends', sort: 110 },
  { id: 'p-panen', kind: 'starter', title: 'Panen perdana', description: 'Panen tanaman pertamamu di Kebun.', event: 'harvest', filter: {}, target: 1, reward_coin: 50, reward_pearl: 2, reward_xp: 10, url: '/#garden', sort: 120 },
  // kumpulan tugas harian (3 dipilih acak per pemain per hari)
  { id: 'h-elus', kind: 'daily', title: 'Sayang pet', description: 'Elus pet 5 kali.', event: 'action', filter: { type: 'elus' }, target: 5, reward_coin: 15, reward_pearl: 0, reward_xp: 4, url: '/', sort: 10 },
  { id: 'h-makan', kind: 'daily', title: 'Perut kenyang', description: 'Beri makan pet 2 kali.', event: 'action', filter: { type: 'makan' }, target: 2, reward_coin: 20, reward_pearl: 0, reward_xp: 4, url: '/', sort: 20 },
  { id: 'h-mandi', kind: 'daily', title: 'Bersih berkilau', description: 'Mandikan pet.', event: 'action', filter: { type: 'mandi' }, target: 1, reward_coin: 15, reward_pearl: 0, reward_xp: 4, url: '/', sort: 30 },
  { id: 'h-main', kind: 'daily', title: 'Main bareng', description: 'Ajak pet bermain 2 kali.', event: 'action', filter: { type: 'main' }, target: 2, reward_coin: 20, reward_pearl: 0, reward_xp: 4, url: '/', sort: 40 },
  { id: 'h-lomba', kind: 'daily', title: 'Atlet kampung', description: 'Ikut Lomba Karung 2 kali.', event: 'race', filter: {}, target: 2, reward_coin: 30, reward_pearl: 0, reward_xp: 6, url: '/#karung', sort: 50 },
  { id: 'h-juara', kind: 'daily', title: 'Juara satu', description: 'Menang juara 1 di Lomba Karung.', event: 'race', filter: { rank: 1 }, target: 1, reward_coin: 40, reward_pearl: 0, reward_xp: 8, url: '/#karung', sort: 60 },
  { id: 'h-ikan', kind: 'daily', title: 'Ikan untuk hari ini', description: 'Tangkap 3 ikan.', event: 'fish', filter: {}, target: 3, reward_coin: 30, reward_pearl: 0, reward_xp: 6, url: '/#fishing', sort: 70 },
  { id: 'h-tamu', kind: 'daily', title: 'Silaturahmi', description: 'Kunjungi 2 rumah teman.', event: 'visit', filter: {}, target: 2, reward_coin: 30, reward_pearl: 0, reward_xp: 6, url: '/#friends', sort: 80 },
  { id: 'h-hadiah', kind: 'daily', title: 'Berbagi', description: 'Kirim satu hadiah ke teman.', event: 'gift_sent', filter: {}, target: 1, reward_coin: 25, reward_pearl: 0, reward_xp: 5, url: '/#friends', sort: 90 },
  { id: 'h-panen', kind: 'daily', title: 'Hasil kebun', description: 'Panen kebun sekali.', event: 'harvest', filter: {}, target: 1, reward_coin: 25, reward_pearl: 0, reward_xp: 5, url: '/#garden', sort: 100 },
  { id: 'h-belanja', kind: 'daily', title: 'Ke pasar', description: 'Beli satu barang di toko.', event: 'purchase', filter: {}, target: 1, reward_coin: 15, reward_pearl: 0, reward_xp: 3, url: '/#shop', sort: 110 },
];

export async function seedQuests(db: Db) {
  const n = (await db.one<{ c: number }>('select count(*)::int c from quests'))!.c;
  if (n > 0) return false;
  for (const q of SEED_QUESTS) {
    await db.query(
      `insert into quests (id, kind, title, description, event, filter, target, reward_coin, reward_pearl, reward_xp, url, sort)
       values ($1,$2,$3,$4,$5,$6::text::jsonb,$7,$8,$9,$10,$11,$12)`,
      [q.id, q.kind, q.title, q.description, q.event, JSON.stringify(q.filter), q.target, q.reward_coin, q.reward_pearl, q.reward_xp, q.url, q.sort],
    );
  }
  return true;
}
