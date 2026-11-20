-- Kerja Sambilan: pet kerja paruh waktu di tempat kampung (Papan Lowongan di peta).
-- pet_jobs = catatan tiap shift; pet_job_progress = jumlah shift selesai per tempat (pangkat & seragam).
create table if not exists pet_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  job text not null,
  minutes int not null,
  -- hari permainan (WIB) saat mulai: untuk batas jam kerja per hari
  day date not null,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  -- working = belum diterima (termasuk yang waktunya sudah habis), claimed = gaji diterima, recalled = dipanggil pulang
  status text not null default 'working' check (status in ('working', 'claimed', 'recalled')),
  -- ditentukan saat mulai (gaji dengan bonus pangkat saat itu, XP, barang bonus, cerita), dibayar saat diterima
  pay int not null default 0,
  xp int not null default 0,
  bonus_item text,
  story text,
  rank text,
  -- biaya kebutuhan saat pulang (negatif), lihat pets.work_cost
  cost jsonb not null default '{}',
  -- dipanggil pulang: kapan, berapa menit kerja, gaji sebanding
  ended_at timestamptz,
  worked_minutes int,
  paid int,
  claimed_at timestamptz,
  -- notifikasi "sudah pulang kerja" (sekali per shift, dari pekerjaan latar)
  notified_at timestamptz
);
-- satu shift terbuka per pemain
create unique index if not exists pet_jobs_open on pet_jobs (user_id) where status = 'working';
create index if not exists pet_jobs_due on pet_jobs (ends_at) where status = 'working' and notified_at is null;
create index if not exists pet_jobs_user_day on pet_jobs (user_id, day);

create table if not exists pet_job_progress (
  user_id uuid not null references users(id) on delete cascade,
  job text not null,
  shifts int not null default 0,
  uniform_at timestamptz,
  primary key (user_id, job)
);

-- tubuh pet selama kerja: kebutuhan dibekukan sampai work_until, lalu work_cost dikenakan sekali
alter table pets add column if not exists work_until timestamptz;
alter table pets add column if not exists work_cost jsonb;
alter table pets add column if not exists work_job text;

-- tempat baru di peta: Papan Lowongan (jobs) & Pos Ronda (ronda)
alter table locations drop constraint if exists locations_kind_check;
alter table locations add constraint locations_kind_check check (kind in ('home','shop','social','garden','race','pond','pearl','games','square','jobs','ronda'));
