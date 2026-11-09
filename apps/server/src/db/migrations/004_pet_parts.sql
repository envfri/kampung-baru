-- Jenis pet: motif tubuh, gaya mata, ekor
alter table pets add column pattern text not null default 'polos';
alter table pets add column eyes text not null default 'bulat';
alter table pets add column tail text not null default 'bulat';
