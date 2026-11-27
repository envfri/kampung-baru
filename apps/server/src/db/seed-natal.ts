// Paket konten 24: Sahabat Edisi Natal — Beruang Es & Rusa Kutup.
// - Dua sahabat besar (±1,6× sahabat biasa) sebagai item jenis 'sahabat', 25 Mutiara, dijual di Toko Mutiara (tab
//   "✦ Edisi Spesial", ditandai data.edisi = 2 & data.edisiNama "Edisi Natal") dan juga ditawarkan di Pondok Sahabat.
// - Edisi terbatas: dijual sejak paket ini dipasang sampai 6 Januari 2027 pukul 23.59 WIB (available_to item; admin bisa
//   mengubahnya di Item & harga › Mulai / Berhenti dijual). Sesudahnya hilang dari toko & Album bagi yang belum punya;
//   pemiliknya tetap menyimpannya selamanya dengan semua efeknya (server menolak pembelian di luar masa jual).
// - Lencana Kawan Satwa III: keterangannya jadi "Punya 9 sahabat mungil." (sahabat Edisi Natal ikut dihitung), hanya bila
//   belum diubah admin.
// Item, tugas, dan ubahan admin yang sudah ada tidak ditimpa (on conflict do nothing).
import type { Db } from './index';
import { EDISI_NATAL, SAHABAT_INFO, SAHABAT_NATAL, type SahabatSp } from '@kb/shared';
import { invalidateQuests } from '../lib/quests';

const DESC: Partial<Record<SahabatSp, string>> = {
  beruang: 'Beruang kutub mungil berselendang rajut merah-hijau. Butiran salju menari di sekitarnya, dan ia suka meluncur di perut. Edisi Natal.',
  rusa: 'Rusa kutub dengan lampu kerlap-kerlip di tanduknya dan lonceng emas di kalungnya. Lompatannya meninggalkan bintang. Edisi Natal.',
};
/** harga bawaan (Mutiara) */
export const NATAL_PRICE = 25;

export const NATAL_ITEMS = SAHABAT_NATAL.map((sp) => ({
  id: SAHABAT_INFO[sp].item, kind: 'sahabat' as const, name: SAHABAT_INFO[sp].name, description: DESC[sp] ?? SAHABAT_INFO[sp].sifat,
  price_pearl: NATAL_PRICE, shop: 'mutiara', art: { type: 'builtin', key: `sahabat${sp}` },
  data: { sp, how: SAHABAT_INFO[sp].how, edisi: 2, edisiNama: EDISI_NATAL.name },
  available_to: EDISI_NATAL.until,
}));

export async function seedPackV24(db: Db) {
  if (await db.one(`select 1 from settings where key = 'pack_natal'`)) return false;
  await db.tx(async (t) => {
    let sort = (await t.one<{ m: number }>('select coalesce(max(sort), 0)::int m from items'))!.m;
    for (const it of NATAL_ITEMS) {
      await t.query(
        `insert into items (id, kind, name, description, price_coin, price_pearl, sell_coin, shop, art, data, available_to, sort)
         values ($1,$2,$3,$4,0,$5,0,$6,$7::text::jsonb,$8::text::jsonb,$9,$10) on conflict (id) do nothing`,
        [it.id, it.kind, it.name, it.description, it.price_pearl, it.shop, JSON.stringify(it.art), JSON.stringify(it.data), it.available_to, (sort += 10)],
      );
    }
    await t.query(`update quests set description = 'Punya 9 sahabat mungil.' where id = 'b-sahabat-9' and description = 'Punya kesembilan sahabat mungil.'`);
    // katalog berubah (dua sahabat baru): PWA yang menyimpan katalog lama memuat ulang
    await t.query(`insert into settings (key, value) values ('catalog_version', to_jsonb(1)) on conflict (key) do update set value = to_jsonb((settings.value)::text::int + 1), updated_at = now()`);
    await t.query(`insert into settings (key, value) values ('pack_natal', 'true'::jsonb) on conflict (key) do nothing`);
    await t.query(`insert into settings (key, value) values ('content_pack', '24'::jsonb) on conflict (key) do update set value = to_jsonb(greatest((settings.value)::text::int, 24))`);
  });
  invalidateQuests();
  return true;
}
