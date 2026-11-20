-- Fasilitas rumah teman: tamu boleh memakai perabot tuan rumah (sofa, kasur, bak mandi, jendela, ...).
-- Tuan rumah bisa melarangnya di Pengaturan › Teman boleh memakai perabot di rumahku (bawaan: boleh).
alter table users add column if not exists facility_visits boolean not null default true;
-- buku tamu: aktivitas yang dipakai tamu (kind = 'perabot', item_id = perabot atau 'spot:jendela' / 'spot:lukisan')
alter table visit_acts add column if not exists activity_id text;
