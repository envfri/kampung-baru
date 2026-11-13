// Paket konten 11: Kolam Pancing v32 — 25 ikan dalam 4 tingkat (7 lama + 18 baru), 3 ikan rahasia,
// dan temuan (sampah, botol pesan, peti harta, Kendi Antik, Kalung Kerang Mutiara).
// ID ikan lama tetap sama supaya fish_collection pemain utuh; ikan lama hanya mendapat data kolam baru
// (tingkat, tarikan, waktu, jarak) dan 4 di antaranya gambar baru. Sandal Jepit pindah ke Temuan.
import type { Db } from './index';

const b = (key: string, colors?: Record<string, string>, params?: Record<string, number>) => ({ type: 'builtin', key, ...(colors ? { colors } : {}), ...(params ? { params } : {}) });
const ONLY = (sky: 'pagi' | 'siang' | 'sore' | 'malam') => ({ pagi: 0, siang: 0, sore: 0, malam: 0, [sky]: 1 });

type PondItem = {
  id: string; kind: string; name: string; description: string; sell: number;
  art: any; data: Record<string, any>; old?: boolean; oldDesc?: string[];
};

/** Urutan = urutan di Buku Ikan. old = item lama (hanya data/gambar yang diperbarui). */
export const POND_ITEMS_V11: PondItem[] = [
  // ---- Biasa
  { id: 'ikan-mas', old: true, kind: 'fish', name: 'Ikan Mas', description: 'Ikan kolam paling akrab.', sell: 8, art: null, data: { fishWeight: 90, minCm: 12, maxCm: 30, tier: 'biasa', pull: 1 } },
  { id: 'ikan-nila', old: true, kind: 'fish', name: 'Ikan Nila', description: 'Belang samar di badan.', sell: 10, art: null, data: { fishWeight: 80, minCm: 15, maxCm: 35, tier: 'biasa', pull: 1 } },
  { id: 'ikan-mujair', kind: 'fish', name: 'Ikan Mujair', description: 'Sirip punggung bertepi merah.', sell: 7, art: b('ikanpipih', { main: '#8E9C86', accent: '#66735F', edge: '#E0583F' }, { edge: 1 }), data: { fishWeight: 70, minCm: 10, maxCm: 25, tier: 'biasa', pull: 1 } },
  { id: 'ikan-lele', old: true, kind: 'fish', name: 'Ikan Lele', description: 'Kumis peka; lebih aktif malam.', sell: 14, art: b('ikankumis', { main: '#6B6255', accent: '#4A4339' }), data: { fishWeight: 55, minCm: 20, maxCm: 45, tier: 'biasa', pull: 2, time: { malam: 1.5 } } },
  { id: 'ikan-sapu', old: true, kind: 'fish', name: 'Ikan Sapu-sapu', description: 'Suka nempel di batu tepi.', sell: 5, art: b('ikansapu', { main: '#6B6255', spot: '#D9C79A' }), data: { fishWeight: 45, minCm: 10, maxCm: 25, tier: 'biasa', pull: 1, near: 1.3 } },
  { id: 'ikan-tawes', kind: 'fish', name: 'Ikan Tawes', description: 'Sisik perak, sirip kuning.', sell: 6, art: b('ikanramping', { main: '#D5DBE0', accent: '#F2B65A' }, { deep: 1 }), data: { fishWeight: 60, minCm: 10, maxCm: 25, tier: 'biasa', pull: 1 } },
  { id: 'ikan-wader', kind: 'fish', name: 'Ikan Wader', description: 'Kecil & gesit; ramai di pagi hari.', sell: 4, art: b('ikanramping', { main: '#E4E8EC', accent: '#F2994A' }, { stripe: 1 }), data: { fishWeight: 50, minCm: 5, maxCm: 12, tier: 'biasa', pull: 1, time: { pagi: 2 } } },
  { id: 'ikan-sepat', kind: 'fish', name: 'Ikan Sepat', description: 'Dua totol hitam; suka di tepi teduh.', sell: 5, art: b('ikanpipih', { main: '#A3B9C9', accent: '#7E97AB' }, { spots: 1, feeler: 1 }), data: { fishWeight: 50, minCm: 8, maxCm: 18, tier: 'biasa', pull: 1, near: 1.5 } },
  { id: 'ikan-betok', kind: 'fish', name: 'Ikan Betok', description: 'Sirip berduri; sentakannya kecil tapi sering.', sell: 6, art: b('ikanpipih', { main: '#98A462', accent: '#6E7A45' }, { spines: 1, gillspot: 1 }), data: { fishWeight: 45, minCm: 8, maxCm: 20, tier: 'biasa', pull: 2, jerk: true } },
  { id: 'ikan-nilem', kind: 'fish', name: 'Ikan Nilem', description: 'Pemakan lumut, berbintik sebaris.', sell: 7, art: b('ikanramping', { main: '#A2B48E', accent: '#C97C6A' }, { dots: 1 }), data: { fishWeight: 55, minCm: 12, maxCm: 28, tier: 'biasa', pull: 1 } },
  // ---- Jarang
  { id: 'ikan-gurame', old: true, kind: 'fish', name: 'Ikan Gurame', description: 'Sirip perut panjang seperti benang.', sell: 25, art: b('ikanpipih', { main: '#C9B48A', accent: '#8C7A55' }, { stripes: 1, feeler: 1 }), data: { fishWeight: 40, minCm: 25, maxCm: 50, tier: 'jarang', pull: 3 } },
  { id: 'ikan-patin', kind: 'fish', name: 'Ikan Patin', description: 'Licin keperakan; menarik ke dasar.', sell: 22, art: b('ikankumis', { main: '#AEB9C6', accent: '#7D8899' }, { fork: 1 }), data: { fishWeight: 35, minCm: 30, maxCm: 70, tier: 'jarang', pull: 3 } },
  { id: 'ikan-gabus', kind: 'fish', name: 'Ikan Gabus', description: 'Galak! Sering menyentak tiba-tiba.', sell: 28, art: b('ikangabus', { main: '#7A7560', accent: '#5A5642' }), data: { fishWeight: 30, minCm: 30, maxCm: 60, tier: 'jarang', pull: 3, jerk: true } },
  { id: 'ikan-bawal', kind: 'fish', name: 'Ikan Bawal', description: 'Bulat lebar, perutnya jingga.', sell: 20, art: b('ikanpipih', { main: '#A3ADB7', accent: '#7D8792', belly: '#E8704E' }, { deep: 1, belly: 1 }), data: { fishWeight: 35, minCm: 20, maxCm: 40, tier: 'jarang', pull: 2 } },
  { id: 'ikan-tambakan', kind: 'fish', name: 'Ikan Tambakan', description: 'Bibir monyong, seperti mau cium.', sell: 18, art: b('ikanpipih', { main: '#EBC9C2', accent: '#D69A93' }, { lips: 1 }), data: { fishWeight: 35, minCm: 15, maxCm: 30, tier: 'jarang', pull: 2 } },
  { id: 'belut', kind: 'fish', name: 'Belut', description: 'Licin! Jangan biarkan tali kendur.', sell: 24, art: b('ikanbelut', { main: '#B08A4A', accent: '#8A6A35', belly: '#E8CF8E' }), data: { fishWeight: 25, minCm: 30, maxCm: 70, tier: 'jarang', pull: 2, time: { malam: 2 }, slick: true } },
  // ---- Langka
  { id: 'ikan-cupang', old: true, oldDesc: ['Langka! Siripnya berkibar.'], kind: 'fish', name: 'Ikan Cupang', description: 'Kecil, siripnya berkibar.', sell: 60, art: b('ikancupang', { main: '#3F5FBF', accent: '#E0583F' }), data: { fishWeight: 12, minCm: 4, maxCm: 7, tier: 'langka', pull: 2 } },
  { id: 'ikan-koi', old: true, oldDesc: ['Langka! Bercak jingga di sisik putih.'], kind: 'fish', name: 'Ikan Koi', description: 'Bercak jingga di sisik putih.', sell: 45, art: null, data: { fishWeight: 15, minCm: 20, maxCm: 40, tier: 'langka', pull: 3 } },
  { id: 'ikan-betutu', kind: 'fish', name: 'Ikan Betutu', description: 'Pemalas: lama mengicip umpan dulu.', sell: 55, art: b('ikanbetutu', { main: '#A08463', accent: '#6E5640' }), data: { fishWeight: 12, minCm: 20, maxCm: 45, tier: 'langka', pull: 3, time: { malam: 2 }, nibbleMin: 2, nibbleMax: 4 } },
  { id: 'ikan-sidat', kind: 'fish', name: 'Ikan Sidat', description: 'Hanya malam. Sangat licin.', sell: 70, art: b('ikanbelut', { main: '#5E6B4A', accent: '#8C9A72', belly: '#DAD7B5' }, { sidat: 1 }), data: { fishWeight: 10, minCm: 40, maxCm: 90, tier: 'langka', pull: 4, time: ONLY('malam'), slick: true } },
  { id: 'gurame-porselen', kind: 'fish', name: 'Gurame Porselen', description: 'Putih kemerahan mengilap; senang pagi.', sell: 65, art: b('ikanpipih', { main: '#F6E2DA', accent: '#EFA59E' }, { feeler: 1, pearl: 1 }), data: { fishWeight: 11, minCm: 30, maxCm: 55, tier: 'langka', pull: 3, time: { pagi: 2 } } },
  // ---- Legenda
  { id: 'ikan-toman', kind: 'fish', name: 'Ikan Toman', description: 'Raja Kolam. Tarikannya paling kuat.', sell: 150, art: b('ikangabus', { main: '#3D4C5E', accent: '#2E3A48', stripe: '#F2994A' }, { toman: 1 }), data: { fishWeight: 2, minCm: 50, maxCm: 100, tier: 'legenda', pull: 5, time: { malam: 2 }, jerk: true } },
  { id: 'arwana-emas', kind: 'fish', name: 'Arwana Emas', description: 'Sisik emasnya berkilau di terik siang.', sell: 400, art: b('arwana'), data: { fishWeight: 1.2, minCm: 60, maxCm: 90, tier: 'legenda', pull: 5, time: ONLY('siang'), secret: true, hint: 'Di bawah terik matahari siang, ada kilau emas di ujung kolam.' } },
  { id: 'koi-naga', kind: 'fish', name: 'Koi Naga', description: 'Berkumis naga, menari saat senja.', sell: 350, art: b('koinaga'), data: { fishWeight: 1, minCm: 50, maxCm: 80, tier: 'legenda', pull: 5, time: ONLY('sore'), secret: true, hint: 'Waktu langit jingga, ada yang berkumis panjang menari di air.' } },
  { id: 'ikan-dewa', kind: 'fish', name: 'Ikan Dewa', description: 'Ikan keramat pagi berkabut.', sell: 0, art: b('ikandewa'), data: { fishWeight: 0.8, minCm: 40, maxCm: 80, tier: 'legenda', pull: 4, time: ONLY('pagi'), secret: true, release: true, hint: 'Saat kabut pagi turun, ada sisik perak yang bercahaya…' } },
  // ---- Temuan
  { id: 'sandal-jepit', old: true, kind: 'material', name: 'Sandal Jepit', description: 'Siapa yang buang sandal ke kolam?', sell: 1, art: null, data: { fishWeight: 40, find: 'junk', near: 1.2 } },
  { id: 'kaleng-bekas', kind: 'material', name: 'Kaleng Bekas', description: 'Bekas minuman yang dibuang sembarangan.', sell: 2, art: b('kaleng'), data: { fishWeight: 25, find: 'junk', near: 1.2 } },
  { id: 'botol-pesan', kind: 'material', name: 'Botol Berisi Pesan', description: 'Langsung dibuka: ada koin & pesan di dalamnya.', sell: 0, art: b('botolpesan'), data: { fishWeight: 15, find: 'bottle' } },
  { id: 'peti-harta', kind: 'material', name: 'Peti Harta Karun', description: 'Tarikan berat tapi tenang — itu tandanya!', sell: 0, art: b('petiharta'), data: { fishWeight: 6, find: 'treasure', far: 2, near: 0.5 } },
  { id: 'kendi-antik', kind: 'furniture', name: 'Kendi Antik', description: 'Kendi tanah liat zaman dulu. Hanya dari kolam.', sell: 40, art: b('kendi'), data: { w: 1, d: 1, fishWeight: 2.5, find: 'decor', far: 1.5 } },
  { id: 'kalung-kerang-mutiara', kind: 'wear', name: 'Kalung Kerang Mutiara', description: 'Kalung kerang berwarna mutiara. Hanya dari kolam.', sell: 40, art: b('kalungkerang', { main: '#FFF7F0', accent: '#B9A6E0' }), data: { slot: 'neck', fishWeight: 2.5, find: 'wear', far: 1.5 } },
];

export async function seedPackV11(db: Db) {
  // penanda sendiri per paket (bukan hanya angka content_pack), jadi urutan rilis paket 11–14 tidak saling melewatkan
  if (await db.one(`select 1 from settings where key = 'pack_ikan'`)) return false;
  await db.tx(async (t) => {
    let sort = (await t.one<{ m: number }>('select coalesce(max(sort), 0)::int m from items'))!.m;
    for (const it of POND_ITEMS_V11) {
      sort += 10;
      if (it.old) {
        // item lama: id, nama, harga & status dari admin tetap; data kolam digabung, gambar diganti bila ada yang baru
        await t.query(
          `update items set data = data || $2::text::jsonb, sort = $3,
                  art = coalesce($4::text::jsonb, art),
                  description = case when description = '' or description = any($5::text[]) then $6 else description end
            where id = $1`,
          [it.id, JSON.stringify(it.data), sort, it.art ? JSON.stringify(it.art) : null, it.oldDesc ?? [], it.description],
        );
        continue;
      }
      await t.query(
        `insert into items (id, kind, name, description, price_coin, price_pearl, sell_coin, shop, art, data, sort)
         values ($1,$2,$3,$4,0,0,$5,null,$6::text::jsonb,$7::text::jsonb,$8) on conflict (id) do nothing`,
        [it.id, it.kind, it.name, it.description, it.sell, JSON.stringify(it.art), JSON.stringify(it.data), sort],
      );
    }
    await t.query(`insert into settings (key, value) values ('pack_ikan', 'true'::jsonb) on conflict (key) do nothing`);
    await t.query(`insert into settings (key, value) values ('content_pack', '11'::jsonb) on conflict (key) do update set value = to_jsonb(greatest((settings.value)::text::int, 11))`);
    // katalog di perangkat pemain ikut diperbarui (gambar ikan lama berubah)
    await t.query(`insert into settings (key, value) values ('catalog_version', to_jsonb(1)) on conflict (key) do update set value = to_jsonb((settings.value)::text::int + 1), updated_at = now()`);
  });
  return true;
}
