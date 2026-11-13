// Paket konten 13: kebun bisa diperluas (Kebun Lv1–Lv5), 14 bibit baru (total 18) beserta hasil
// panennya, pupuk, dan tugas kebun. Masuk sekali ke database baru maupun lama tanpa menimpa ubahan admin.
import { EVENT_TEMPLATES, SEED_PICS } from '@kb/shared';
import type { Db } from './index';

const b = (key: string, colors?: Record<string, string>, params?: Record<string, number>) => ({ type: 'builtin', key, ...(colors ? { colors } : {}), ...(params ? { params } : {}) });
const pic = (key: string) => SEED_PICS.indexOf(key);

type Cat = 'sayur' | 'buah' | 'bunga' | 'event';
interface Crop {
  seed: string; crop: string; name: string; desc: string; minutes: number; qty: number; price: number; minLevel: number; xp: number; cat: Cat;
  packet: { main: string; accent: string }; pic: string; event?: string;
  yieldId: string; yieldName: string; yieldKind: 'food' | 'material'; yieldDesc: string; sell: number; effects?: Record<string, number>;
}

/** 14 bibit baru. Harga & hasil dihitung supaya koin per jam seimbang (tanaman singkat untung kecil, tanaman lama untung besar). */
export const KEBUN_CROPS_V13: Crop[] = [
  { seed: 'bibit-kangkung', crop: 'kangkung', name: 'Bibit Kangkung', desc: 'Panen 2 ikat kangkung dalam 10 menit.', minutes: 10, qty: 2, price: 4, minLevel: 1, xp: 1, cat: 'sayur', packet: { main: '#6CC070', accent: '#3FA06A' }, pic: 'kangkung',
    yieldId: 'kangkung', yieldName: 'Seikat Kangkung', yieldKind: 'food', yieldDesc: 'Tumis kangkung kampung.', sell: 3, effects: { kenyang: 6 } },
  { seed: 'bibit-cabai', crop: 'cabai', name: 'Bibit Cabai Rawit', desc: 'Panen 5 cabai rawit dalam 20 menit.', minutes: 20, qty: 5, price: 6, minLevel: 2, xp: 1, cat: 'sayur', packet: { main: '#E0402F', accent: '#3FA06A' }, pic: 'cabai',
    yieldId: 'cabai', yieldName: 'Cabai Rawit', yieldKind: 'food', yieldDesc: 'Pedas! Bikin melek.', sell: 2, effects: { energi: 6, kenyang: 2 } },
  { seed: 'bibit-wortel', crop: 'wortel', name: 'Bibit Wortel', desc: 'Panen 3 wortel dalam 40 menit.', minutes: 40, qty: 3, price: 12, minLevel: 3, xp: 3, cat: 'sayur', packet: { main: '#F28C28', accent: '#5DB36A' }, pic: 'wortel',
    yieldId: 'wortel', yieldName: 'Wortel', yieldKind: 'food', yieldDesc: 'Renyah, manis, oranye.', sell: 7, effects: { kenyang: 10, ceria: 3 } },
  { seed: 'bibit-terong', crop: 'terong', name: 'Bibit Terong', desc: 'Panen 3 terong dalam 1 jam 30 menit.', minutes: 90, qty: 3, price: 16, minLevel: 4, xp: 4, cat: 'sayur', packet: { main: '#9A6FC0', accent: '#5DB36A' }, pic: 'terong',
    yieldId: 'terong', yieldName: 'Terong Ungu', yieldKind: 'food', yieldDesc: 'Enak dibalado.', sell: 10, effects: { kenyang: 15 } },
  { seed: 'bibit-matahari', crop: 'matahari', name: 'Bibit Bunga Matahari', desc: 'Panen 2 bunga matahari dalam 2 jam 30 menit.', minutes: 150, qty: 2, price: 22, minLevel: 5, xp: 4, cat: 'bunga', packet: { main: '#F2C230', accent: '#3FA06A' }, pic: 'matahari',
    yieldId: 'bunga-matahari', yieldName: 'Bunga Matahari', yieldKind: 'material', yieldDesc: 'Selalu menghadap matahari. Bisa dijual di Pasar Pagi.', sell: 22 },
  { seed: 'bibit-singkong', crop: 'singkong', name: 'Bibit Singkong', desc: 'Panen 3 singkong dalam 3 jam.', minutes: 180, qty: 3, price: 20, minLevel: 6, xp: 4, cat: 'sayur', packet: { main: '#B98B4E', accent: '#5DB36A' }, pic: 'singkong',
    yieldId: 'singkong', yieldName: 'Singkong', yieldKind: 'food', yieldDesc: 'Direbus, digoreng, mengenyangkan.', sell: 14, effects: { kenyang: 24 } },
  { seed: 'bibit-labu', crop: 'labu', name: 'Bibit Labu Kuning', desc: 'Panen 1 labu besar dalam 4 jam.', minutes: 240, qty: 1, price: 28, minLevel: 7, xp: 6, cat: 'buah', packet: { main: '#F2994A', accent: '#5DB36A' }, pic: 'labu',
    yieldId: 'labu', yieldName: 'Labu Kuning', yieldKind: 'food', yieldDesc: 'Besar! Cukup untuk sepanci kolak.', sell: 60, effects: { kenyang: 40 } },
  { seed: 'bibit-mawar', crop: 'mawar', name: 'Bibit Mawar', desc: 'Panen 2 bunga mawar dalam 4 jam 30 menit.', minutes: 270, qty: 2, price: 30, minLevel: 8, xp: 6, cat: 'bunga', packet: { main: '#E5506A', accent: '#3F9A58' }, pic: 'mawar',
    yieldId: 'mawar', yieldName: 'Bunga Mawar', yieldKind: 'material', yieldDesc: 'Wangi, hati-hati durinya. Bisa dijual di Pasar Pagi.', sell: 34 },
  { seed: 'bibit-semangka', crop: 'semangka', name: 'Bibit Semangka', desc: 'Panen 1 semangka dalam 5 jam.', minutes: 300, qty: 1, price: 32, minLevel: 9, xp: 6, cat: 'buah', packet: { main: '#4FA85F', accent: '#2B6E40' }, pic: 'semangka',
    yieldId: 'semangka', yieldName: 'Semangka', yieldKind: 'food', yieldDesc: 'Segar untuk siang terik.', sell: 70, effects: { kenyang: 20, ceria: 20 } },
  { seed: 'bibit-padi', crop: 'padi', name: 'Bibit Padi Ketan', desc: 'Panen 5 ikat padi ketan dalam 6 jam.', minutes: 360, qty: 5, price: 30, minLevel: 10, xp: 6, cat: 'sayur', packet: { main: '#E9C46A', accent: '#7CC57D' }, pic: 'padi',
    yieldId: 'padi-ketan', yieldName: 'Seikat Padi Ketan', yieldKind: 'material', yieldDesc: 'Bahan klepon dan lemper. Bisa dijual di Pasar Pagi.', sell: 16 },
  { seed: 'bibit-nanas', crop: 'nanas', name: 'Bibit Nanas', desc: 'Panen 1 nanas madu dalam 7 jam.', minutes: 420, qty: 1, price: 38, minLevel: 12, xp: 8, cat: 'buah', packet: { main: '#F2B632', accent: '#4C8A5E' }, pic: 'nanas',
    yieldId: 'nanas', yieldName: 'Nanas Madu', yieldKind: 'food', yieldDesc: 'Manis asam, mahkotanya hijau.', sell: 85, effects: { kenyang: 18, ceria: 18 } },
  { seed: 'bibit-anggrek', crop: 'anggrek', name: 'Bibit Anggrek Bulan', desc: 'Panen 1 anggrek bulan dalam 8 jam.', minutes: 480, qty: 1, price: 60, minLevel: 15, xp: 8, cat: 'bunga', packet: { main: '#D9C6F0', accent: '#5E7A55' }, pic: 'anggrek',
    yieldId: 'anggrek-bulan', yieldName: 'Anggrek Bulan', yieldKind: 'material', yieldDesc: 'Puspa langka. Mahal di Pasar Pagi.', sell: 140 },
  // bibit event: hanya dijual saat event-nya berjalan
  { seed: 'bibit-timunsuri', crop: 'timunsuri', name: 'Bibit Timun Suri', desc: 'Panen 2 timun suri dalam 45 menit. Hanya saat Ramadan.', minutes: 45, qty: 2, price: 12, minLevel: 1, xp: 3, cat: 'event', packet: { main: '#F2D16B', accent: '#5DB36A' }, pic: 'timunsuri', event: 'ramadan',
    yieldId: 'timun-suri', yieldName: 'Timun Suri', yieldKind: 'food', yieldDesc: 'Untuk es buah berbuka.', sell: 9, effects: { kenyang: 8, ceria: 12 } },
  { seed: 'bibit-merahputih', crop: 'merahputih', name: 'Bibit Kembang Merah Putih', desc: 'Panen 2 kembang dalam 2 jam. Hanya saat Pekan Ceria.', minutes: 120, qty: 2, price: 20, minLevel: 1, xp: 3, cat: 'event', packet: { main: '#FFFFFF', accent: '#E0583F' }, pic: 'merahputih', event: 'pekan-ceria',
    yieldId: 'kembang-merahputih', yieldName: 'Kembang Merah Putih', yieldKind: 'material', yieldDesc: 'Hiasan Agustusan. Bisa dijual di Pasar Pagi.', sell: 18 },
];

/** Data tambahan untuk 4 bibit lama (gambar tanaman, kelompok, XP panen, gambar di bungkus). Harga & hasil tidak diubah. */
export const KEBUN_OLD_SEEDS: [string, { crop: string; cat: Cat; harvestXp: number }, string][] = [
  ['bibit-tomat', { crop: 'tomat', cat: 'buah', harvestXp: 3 }, 'buah'],
  ['bibit-jagung', { crop: 'jagung', cat: 'sayur', harvestXp: 3 }, 'jagung'],
  ['bibit-melati', { crop: 'melati', cat: 'bunga', harvestXp: 3 }, 'bunga'],
  ['bibit-stroberi', { crop: 'stroberi', cat: 'buah', harvestXp: 3 }, 'stroberi'],
];

export const PUPUK_ITEM = { id: 'pupuk', kind: 'material', name: 'Pupuk Kompos', description: 'Tabur di tanaman yang sedang tumbuh supaya lebih cepat panen. Sekali per tanam.', price_coin: 15, sell_coin: 5, shop: 'pasar', art: b('pupuk') };

export async function seedPackV13(db: Db) {
  // penanda sendiri per paket (bukan hanya angka content_pack), jadi urutan rilis paket 11–14 tidak saling melewatkan
  if (await db.one(`select 1 from settings where key = 'pack_kebun'`)) return false;
  await db.tx(async (t) => {
    let sort = (await t.one<{ m: number }>('select coalesce(max(sort), 0)::int m from items'))!.m;
    const ins = (it: any) => t.query(
      `insert into items (id, kind, name, description, price_coin, price_pearl, sell_coin, shop, art, data, event_id, sort)
       values ($1,$2,$3,$4,$5,0,$6,$7,$8::text::jsonb,$9::text::jsonb,$10,$11) on conflict (id) do nothing`,
      [it.id, it.kind, it.name, it.description ?? '', it.price_coin ?? 0, it.sell_coin ?? 0, it.shop ?? null, JSON.stringify(it.art), JSON.stringify(it.data ?? {}), it.event_id ?? null, (sort += 10)],
    );
    // event Ramadan disiapkan nonaktif (bibit timun suri ikut dijual saat admin menyalakannya)
    const tpl = EVENT_TEMPLATES.find((e) => e.key === 'ramadan');
    if (tpl) {
      await t.query(
        `insert into events (id, name, description, starts_at, ends_at, theme, bonus, active, decor, points, milestones, token_name, repeat_yearly)
         values ('ramadan', $1, $2, '2027-02-08T00:00:00+07:00', '2027-03-10T00:00:00+07:00', $3::text::jsonb, $4::text::jsonb, false, $5, $6::text::jsonb, $7::text::jsonb, $8, false)
         on conflict (id) do nothing`,
        [tpl.name, tpl.description, JSON.stringify({ color: tpl.color }), JSON.stringify({ coinMultiplier: tpl.multiplier }), tpl.decor, JSON.stringify({ ...tpl.points, harvest: 4 }), JSON.stringify(tpl.milestones), tpl.tokenName],
      );
    }
    for (const c of KEBUN_CROPS_V13) {
      await ins({ id: c.yieldId, kind: c.yieldKind, name: c.yieldName, description: c.yieldDesc, sell_coin: c.sell, art: b(c.crop), data: c.effects ? { effects: c.effects } : {} });
    }
    for (const c of KEBUN_CROPS_V13) {
      await ins({
        id: c.seed, kind: 'seed', name: c.name, description: c.desc, price_coin: c.price, shop: 'pasar', event_id: c.event ?? null,
        art: b('bibit', c.packet, { pic: pic(c.pic) }),
        data: { growMinutes: c.minutes, yieldItem: c.yieldId, yieldQty: c.qty, crop: c.crop, cat: c.cat, harvestXp: c.xp, ...(c.minLevel > 1 ? { minLevel: c.minLevel } : {}) },
      });
    }
    await ins(PUPUK_ITEM);
    // bibit lama: tambah data baru tanpa menyentuh harga, lama tumbuh & hasil yang mungkin sudah diubah admin
    for (const [id, data, p] of KEBUN_OLD_SEEDS) {
      await t.query(`update items set data = $2::text::jsonb || data where id = $1 and kind = 'seed'`, [id, JSON.stringify(data)]);
      await t.query(
        `update items set art = jsonb_set(art, '{params}', coalesce(art->'params', '{}'::jsonb) || $2::text::jsonb)
          where id = $1 and art->>'type' = 'builtin' and art->>'key' = 'bibit' and not coalesce(art->'params', '{}'::jsonb) ? 'pic'`,
        [id, JSON.stringify({ pic: pic(p) })],
      );
    }
    // tugas & lencana kebun
    const q = (id: string, kind: string, title: string, desc: string, event: string, target: number, coin: number, pearl: number, xp: number, sortQ: number) =>
      t.query(
        `insert into quests (id, kind, title, description, event, filter, target, reward_coin, reward_pearl, reward_xp, url, sort)
         values ($1,$2,$3,$4,$5,'{}'::jsonb,$6,$7,$8,$9,'/#garden',$10) on conflict (id) do nothing`,
        [id, kind, title, desc, event, target, coin, pearl, xp, sortQ],
      );
    await q('h-siram', 'daily', 'Siram kebun', 'Siram 3 tanaman yang sedang tumbuh di Kebun.', 'water', 3, 15, 0, 4, 158);
    await q('b-kebun', 'badge', 'Juragan Kebun', 'Perluas kebun sampai Lv 3.', 'garden_expand', 2, 0, 2, 20, 720);
    // pengaturan lama "garden.slots" (1–12) diganti tingkat kebun. Bila admin pernah menaikkannya,
    // pemain langsung dapat tingkat yang petaknya cukup supaya petak yang sudah ada tidak hilang.
    const game = await t.one<{ value: any }>(`select value from settings where key = 'game'`);
    const legacy = Math.round(Number(game?.value?.garden?.slots));
    if (legacy > 6) {
      const levels: { slots: number }[] = Array.isArray(game?.value?.garden?.levels) ? game!.value.garden.levels : [{ slots: 6 }, { slots: 9 }, { slots: 12 }, { slots: 15 }, { slots: 18 }];
      const lv = levels.findIndex((l) => Number(l.slots) >= legacy);
      await t.query(`update users set garden_level = greatest(garden_level, $1)`, [lv >= 0 ? lv + 1 : levels.length]);
    }
    if (game?.value?.garden && 'slots' in game.value.garden) await t.query(`update settings set value = value #- '{garden,slots}' where key = 'game'`);
    await t.query(`insert into settings (key, value) values ('catalog_version', to_jsonb(1)) on conflict (key) do update set value = to_jsonb((settings.value)::text::int + 1), updated_at = now()`);
    await t.query(`insert into settings (key, value) values ('pack_kebun', 'true'::jsonb) on conflict (key) do nothing`);
    await t.query(`insert into settings (key, value) values ('content_pack', '13'::jsonb) on conflict (key) do update set value = to_jsonb(greatest((settings.value)::text::int, 13))`);
  });
  return true;
}
