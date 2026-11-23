-- Paket konten 22: enam ruangan Mutiara baru, jadi batas ruangan per rumah naik 6 -> 12 (kamar + 4 ruangan Toko Bangunan
-- + Loteng Bintang + 6 ruangan baru). Hanya bila pengaturan yang tersimpan masih memakai bawaan lama (6); angka lain yang
-- sudah diatur admin tetap.
update settings set value = jsonb_set(value, '{house,maxRooms}', '12'::jsonb), updated_at = now()
  where key = 'game' and value #>> '{house,maxRooms}' = '6';
