-- Event musiman yang bisa diatur + mini-game Balai Main

alter table events add column decor text not null default '';
alter table events add column points jsonb not null default '{}';
alter table events add column milestones jsonb not null default '[]';
alter table events add column token_name text not null default 'Poin event';
alter table events add column repeat_yearly boolean not null default false;
alter table events add column notify_start boolean not null default true;
alter table events add column announced_season text;

create table event_progress (
  user_id uuid not null references users(id) on delete cascade,
  event_id text not null references events(id) on delete cascade,
  season text not null,                 -- tanggal mulai event (berganti tiap tahun untuk event berulang)
  points int not null default 0,
  claimed jsonb not null default '[]',  -- indeks hadiah bertingkat yang sudah diambil
  updated_at timestamptz not null default now(),
  primary key (user_id, event_id, season)
);

create table game_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  game text not null,
  seed int not null,
  meta jsonb not null default '{}',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  score int,
  reward int
);
create index game_runs_user on game_runs(user_id, started_at desc);

alter table locations drop constraint locations_kind_check;
alter table locations add constraint locations_kind_check check (kind in ('home','shop','social','garden','race','pond','pearl','games'));
