-- Sahabat Mungil: hewan kecil yang menemani pet (paket konten 23).
-- pet_buddies = sahabat milik pemain (satu per jenis), keakraban, dan yang sedang aktif (mengikuti pet).
create table if not exists pet_buddies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  -- jenis: ayam | umang | bebek | kura | pipit | kunang | kelinci | hamster | landak (lihat @kb/shared sahabat.ts)
  species text not null,
  name text not null,
  -- warna rumah kerang umang-umang (dipilih pemain), jenis lain null
  variant text,
  -- keakraban (Kenal → Akrab → Sahabat Sejati menurut pengaturan sahabat.akrabAt / sejatiAt)
  points int not null default 0,
  -- tingkat tertinggi yang pernah dicapai (untuk kabar "naik tingkat" & lencana, sekali saja)
  lvl int not null default 0,
  -- satu sahabat aktif per pemain (mengikuti pet); sisanya istirahat di rumah
  active boolean not null default false,
  -- cara didapat: gratis | beli | mancing | pipit | kunang
  source text not null default 'gratis',
  created_at timestamptz not null default now(),
  unique (user_id, species)
);
create unique index if not exists pet_buddies_active on pet_buddies (user_id) where active;

-- jenis item baru: sahabat (harga & toko diatur admin seperti item lain), lokasi baru: Pondok Sahabat
alter table items drop constraint if exists items_kind_check;
alter table items add constraint items_kind_check
  check (kind in ('food','furniture','wear','wallpaper','floor','seed','fish','material','room','sahabat'));
alter table locations drop constraint if exists locations_kind_check;
alter table locations add constraint locations_kind_check check (kind in ('home','shop','social','garden','race','pond','pearl','games','square','jobs','ronda','sahabat'));
