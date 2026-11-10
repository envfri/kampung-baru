-- Rumah bisa punya beberapa ruangan (kamar awal + ruangan yang dibeli: ruang tamu, dapur, halaman, ...).
-- Jenis ruangan dijual sebagai item kind 'room' (harga, ukuran, tema diatur di admin → Item).
alter table items drop constraint if exists items_kind_check;
alter table items add constraint items_kind_check
  check (kind in ('food','furniture','wear','wallpaper','floor','seed','fish','material','room'));

alter table rooms add column id uuid not null default gen_random_uuid();
alter table rooms add column room_item text;               -- item jenis 'room'; null = kamar awal
alter table rooms add column name text not null default 'Kamar';
alter table rooms add column sort int not null default 0;
alter table rooms drop constraint rooms_pkey;
alter table rooms add primary key (id);
create index rooms_user on rooms (user_id, sort);
create unique index rooms_user_item on rooms (user_id, room_item) where room_item is not null;

-- Aktivitas di rumah (pakai mebel, lihat jendela/lukisan). Diatur di admin → Aktivitas.
create table activities (
  id text primary key,
  name text not null,
  description text not null default '',
  targets jsonb not null default '[]',      -- ["art:kasur", "item:kasur-rotan", "spot:jendela"]
  anim text not null default 'lihat',
  effects jsonb not null default '{}',      -- {"energi": 30, "ceria": 5}
  xp int not null default 0,
  coins int not null default 0,
  reward_item text,
  cooldown_sec int not null default 300,
  daily_limit int not null default 0,       -- 0 = tanpa batas harian
  min_level int not null default 1,
  message text not null default '',         -- "{pet} tidur nyenyak di {item}."
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
