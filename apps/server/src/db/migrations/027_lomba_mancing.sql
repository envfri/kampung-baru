-- Lomba Mancing di Kolam Pemancingan Bareng alun-alun (v32): lemparan lomba ditandai id lomba ('<alun-alun>:<mulai ms>'),
-- hasil tiap lomba disimpan sekali saat diselesaikan server (hadiah tidak dibayar dua kali).
alter table fishing_casts add column if not exists contest text;
create index if not exists fishing_casts_contest on fishing_casts(contest) where contest is not null;
create table if not exists square_contests (
  id text primary key,
  inst int not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  settled_at timestamptz,
  results jsonb not null default '[]'::jsonb
);
create index if not exists square_contests_open on square_contests(ends_at) where settled_at is null;
