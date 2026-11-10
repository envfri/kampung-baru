-- Hidup pet: tidur dengan lampu mati, sakit ringan, berat badan, remah di lantai.
alter table pets add column sleep_from timestamptz;          -- sedang tidur sejak (= needs_at saat mulai tidur)
alter table pets add column sick_at timestamptz;             -- mulai sakit; null = sehat
alter table pets add column weight real not null default 0;  -- 0..100, turun sendiri relatif terhadap needs_at
alter table pets add column crumbs_at timestamptz not null default now(); -- dasar hitungan remah yang muncul

-- Lencana: tugas jenis 'badge' (sekali seumur akun, semua aktif bersamaan)
alter table quests drop constraint if exists quests_kind_check;
alter table quests add constraint quests_kind_check check (kind in ('starter', 'daily', 'badge'));

-- Suka rumah teman: sekali per teman per minggu (week = tanggal Senin, WIB)
create table house_likes (
  liker_id uuid not null references users(id) on delete cascade,
  host_id uuid not null references users(id) on delete cascade,
  week text not null,
  created_at timestamptz not null default now(),
  primary key (liker_id, host_id, week)
);
create index house_likes_week on house_likes (week, host_id);
