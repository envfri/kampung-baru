-- Kolam Pancing v32: lemparan bertahap (lempar → tunggu/ngicip → sambar → tarik-ulur → hasil).
-- Server memilih tangkapan saat lempar; client hanya menerima petunjuk (ukuran bayangan, tarikan, ngicip).
-- result: null (berjalan) | caught | missed (lama) | early | late | lepas
alter table fishing_casts add column if not exists place text not null default 'kolam';
alter table fishing_casts add column if not exists distance text;
alter table fishing_casts add column if not exists sky text;
alter table fishing_casts add column if not exists catch_kind text;
alter table fishing_casts add column if not exists cm real;
alter table fishing_casts add column if not exists hooked_at timestamptz;
alter table fishing_casts add column if not exists fight_min_ms int;
alter table fishing_casts add column if not exists payload jsonb not null default '{}';
alter table fishing_casts add column if not exists reason text;
alter table fishing_casts add column if not exists resolved_at timestamptz;
create index if not exists fishing_casts_open on fishing_casts(user_id) where result is null;
create index if not exists fishing_casts_user on fishing_casts(user_id, cast_at desc);

-- petunjuk ikan rahasia yang sudah dibaca pemain dari Botol Berisi Pesan
create table if not exists fish_hints (
  user_id uuid not null references users(id) on delete cascade,
  fish_id text not null references items(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, fish_id)
);
