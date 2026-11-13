-- Kebun bisa diperluas: tingkat kebun per pemain (mulai Lv1 = 6 petak seperti sebelumnya),
-- lama tumbuh tersimpan per petak (untuk siram & pupuk), dan tanda sudah disiram / dipupuk.
alter table users add column if not exists garden_level smallint not null default 1;
alter table garden_plots add column if not exists grow_sec int;
alter table garden_plots add column if not exists watered_at timestamptz;
alter table garden_plots add column if not exists fertilized_at timestamptz;
-- tanaman yang sudah ada: lama tumbuh dihitung dari waktu tanam sampai siap
update garden_plots set grow_sec = greatest(1, extract(epoch from (ready_at - planted_at))::int) where grow_sec is null;
