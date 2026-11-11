-- Duel dengan teman: kedua pemain memainkan mini-game dengan seed yang sama.
-- Main bareng (live) bila keduanya siap di ruang tunggu, atau bergantian (lawan melawan "bayangan").
create table duels (
  id uuid primary key default gen_random_uuid(),
  game text not null,
  seed int not null,
  meta jsonb not null default '{}',
  challenger_id uuid not null references users(id) on delete cascade,
  opponent_id uuid not null references users(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'live', 'done', 'declined', 'expired')),
  live_start timestamptz,
  c_ready_at timestamptz, o_ready_at timestamptz,
  c_started_at timestamptz, o_started_at timestamptz,
  c_score int, o_score int,
  c_inputs jsonb, o_inputs jsonb,
  c_finished_at timestamptz, o_finished_at timestamptz,
  c_reward int, o_reward int,
  winner_id uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index duels_challenger on duels (challenger_id, created_at desc);
create index duels_opponent on duels (opponent_id, created_at desc);
