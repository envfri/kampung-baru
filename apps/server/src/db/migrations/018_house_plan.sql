-- Atur denah sendiri: letak ruangan di denah rumah tersambung (petak). null = disusun otomatis
-- (ruangan baru dibeli, atau denah dikembalikan ke susunan otomatis).
alter table rooms add column gx int;
alter table rooms add column gy int;
