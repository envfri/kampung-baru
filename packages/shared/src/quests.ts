// Peristiwa yang bisa dipakai sebagai syarat tugas, beserta filter yang didukung.
// Dipakai server (validasi) dan halaman admin (pilihan).
export const QUEST_EVENTS: Record<string, { label: string; filters: string }> = {
  action: { label: 'Aksi di rumah', filters: 'type: elus | makan | mandi | main | tidur' },
  purchase: { label: 'Beli barang di toko', filters: 'kind: food | furniture | wear | wallpaper | floor | seed | room · currency: coin | pearl' },
  activity: { label: 'Aktivitas di rumah (pakai mebel, lihat jendela, ...)', filters: 'id: id aktivitas · anim: tidur | duduk | lihat | siram | baca | masak | main | mandi | olahraga | gowes' },
  sleep: { label: 'Tidur dengan lampu mati sampai bangun', filters: '' },
  cure: { label: 'Menyembuhkan pet yang sakit (jamu)', filters: 'itemId: id jamu' },
  sweep: { label: 'Menyapu remah / bulu rontok', filters: '' },
  like: { label: 'Menyukai rumah teman', filters: '' },
  liked: { label: 'Rumah disukai teman', filters: '' },
  game_finish: { label: 'Selesai main mini-game Balai Main', filters: 'game: panen | memori | bakiak | gasing | layangan | pinang' },
  exercise: { label: 'Olahraga (aktivitas yang menurunkan berat)', filters: 'id: id aktivitas' },
  pinang_top: { label: 'Sampai puncak Panjat Pinang', filters: '' },
  duel: { label: 'Selesai duel dengan teman', filters: 'game: bakiak | gasing | layangan' },
  duel_win: { label: 'Menang duel melawan teman', filters: 'game: bakiak | gasing | layangan' },
  sell: { label: 'Jual barang di Pasar', filters: '' },
  room_save: { label: 'Simpan susunan ruangan', filters: '' },
  wear: { label: 'Ganti pakaian pet', filters: '' },
  plant: { label: 'Tanam bibit', filters: 'seedId: id bibit' },
  harvest: { label: 'Panen kebun', filters: 'seedId: id bibit' },
  race: { label: 'Ikut Lomba Karung', filters: 'rank: 1 | 2 | 3 | 4' },
  fish: { label: 'Tangkap ikan', filters: 'fishId: id ikan' },
  visit: { label: 'Kunjungi rumah teman', filters: '' },
  gift_sent: { label: 'Kirim hadiah ke teman', filters: 'itemId: id item' },
  friend_added: { label: 'Tambah teman', filters: '' },
  daily_claim: { label: 'Ambil hadiah harian', filters: '' },
  level_up: { label: 'Naik level', filters: 'level: angka' },
};

export const QUEST_LINKS: [string, string][] = [
  ['/', 'Rumah'], ['/#map', 'Peta Kampung'], ['/#shop', 'Toko (lewat peta)'], ['/#bag', 'Tas'], ['/#friends', 'Teman'],
  ['/#garden', 'Kebun'], ['/#karung', 'Lomba Karung'], ['/#fishing', 'Kolam Pancing'], ['/#daily', 'Hadiah harian'], ['/#duels', 'Duel teman'],
];
