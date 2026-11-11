-- Perluas ruangan: ukuran ruangan bisa diperbesar bertahap (mebel lama tetap di tempatnya,
-- lantai baru bertambah di sisi depan). null = ukuran bawaan dari jenis ruangan / pengaturan.
alter table rooms add column size int;
