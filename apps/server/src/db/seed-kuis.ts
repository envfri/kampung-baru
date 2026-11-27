// Paket konten 25: Cerdas Cermat Kampung (kuis bersama Pak Kancil, kartu Kuis di Balai Main).
// - Bank soal dari kuis-soal.json (dibundel esbuild). Soal yang tidak sah dilewati & dicatat di log.
// - Tugas harian "Jawab Kuis Harian", lencana Si Pintar <Kategori> (8 kategori, N jawaban benar; N = kuis.badgeAt)
//   & Juara Cerdas Cermat (menang Cerdas Cermat Bareng).
// Soal, tugas & lencana yang sudah ada tidak ditimpa (on conflict do nothing), jadi ubahan admin tetap.
//
// Sinkron bank (syncKuisBank) berjalan di SETIAP start server: hanya menambahkan ID yang belum ada sama sekali di
// database. Tidak pernah mengubah / mengaktifkan lagi soal yang sudah ada, dan soal yang dihapus admin tetap
// tersimpan (deleted_at) sehingga tidak ditambahkan lagi. Jadi rilis berikutnya cukup memperbarui kuis-soal.json.
import type { Db } from './index';
import bank from './kuis-soal.json' with { type: 'json' };
import { DEFAULT_SETTINGS, KUIS_CATEGORIES, KUIS_CAT_IDS, normKuis, splitBank, type KuisQuestion } from '@kb/shared';
import { invalidateQuests } from '../lib/quests';

export const KUIS_BANK = bank as unknown as KuisQuestion[];

type Q = { id: string; kind: 'daily' | 'badge'; title: string; description: string; event: string; filter: Record<string, string>; target: number; coin: number; pearl: number; xp: number; sort: number };
const N = DEFAULT_SETTINGS.kuis.badgeAt;
export const KUIS_QUESTS: Q[] = [
  { id: 'h-kuis', kind: 'daily', title: 'Jawab Kuis Harian', description: 'Selesaikan Kuis Harian bersama Pak Kancil hari ini.', event: 'kuis_harian', filter: {}, target: 1, coin: 15, pearl: 0, xp: 4, sort: 180 },
  ...KUIS_CAT_IDS.map((c, i): Q => ({
    id: `b-kuis-${c}`, kind: 'badge', title: `Si Pintar ${KUIS_CATEGORIES[c].short}`, description: `Jawab benar ${N} soal kategori ${KUIS_CATEGORIES[c].name}.`,
    event: 'kuis_benar', filter: { cat: c }, target: N, coin: 50, pearl: 0, xp: 15, sort: 760 + i,
  })),
  { id: 'b-kuis-juara', kind: 'badge', title: 'Juara Cerdas Cermat', description: 'Menang Cerdas Cermat Bareng bersama teman.', event: 'kuis_juara', filter: {}, target: 1, coin: 0, pearl: 2, xp: 20, sort: 770 },
];

/** Tambahkan soal bank yang ID-nya belum pernah ada di database. Dipanggil tiap start. */
export async function syncKuisBank(db: Db, list: unknown = KUIS_BANK, log?: { warn: (o: any, m: string) => void; info?: (o: any, m: string) => void }) {
  const { ok, bad } = splitBank(list);
  if (bad.length) log?.warn({ invalid: bad.slice(0, 20), count: bad.length }, 'bank soal kuis: soal tidak sah dilewati');
  const rows = await db.query<{ id: string; qnorm: string; live: boolean }>(`select id, qnorm, (deleted_at is null) live from kuis_questions`);
  const known = new Set(rows.map((r) => r.id));
  const texts = new Set(rows.filter((r) => r.live).map((r) => r.qnorm));
  let added = 0;
  const dup: string[] = [];
  for (const q of ok) {
    if (known.has(q.id)) continue;
    const norm = normKuis(q.q);
    // teks sama dengan soal lain yang masih ada (mis. buatan admin): dilewati supaya tidak kembar
    if (texts.has(norm)) { dup.push(q.id); continue; }
    const r = await db.query(
      `insert into kuis_questions (id, cat, level, type, data, qnorm, origin) values ($1,$2,$3,$4,$5::text::jsonb,$6,'bank') on conflict (id) do nothing returning id`,
      [q.id, q.cat, q.level, q.type, JSON.stringify(q), norm]);
    if (r.length) { added++; texts.add(norm); }
  }
  if (dup.length) log?.warn({ ids: dup }, 'bank soal kuis: teks soal kembar dengan soal yang sudah ada, dilewati');
  return { added, invalid: bad.length, duplicate: dup.length };
}

export async function seedPackV25(db: Db) {
  if (await db.one(`select 1 from settings where key = 'pack_kuis'`)) return false;
  await db.tx(async (t) => {
    for (const q of KUIS_QUESTS) {
      await t.query(
        `insert into quests (id, kind, title, description, event, filter, target, reward_coin, reward_pearl, reward_xp, url, sort)
         values ($1,$2,$3,$4,$5,$6::text::jsonb,$7,$8,$9,$10,'/#kuis',$11) on conflict (id) do nothing`,
        [q.id, q.kind, q.title, q.description, q.event, JSON.stringify(q.filter), q.target, q.coin, q.pearl, q.xp, q.sort],
      );
    }
    await syncKuisBank(t);
    await t.query(`insert into settings (key, value) values ('catalog_version', to_jsonb(1)) on conflict (key) do update set value = to_jsonb((settings.value)::text::int + 1), updated_at = now()`);
    await t.query(`insert into settings (key, value) values ('pack_kuis', 'true'::jsonb) on conflict (key) do nothing`);
    await t.query(`insert into settings (key, value) values ('content_pack', '25'::jsonb) on conflict (key) do update set value = to_jsonb(greatest((settings.value)::text::int, 25))`);
  });
  invalidateQuests();
  return true;
}
