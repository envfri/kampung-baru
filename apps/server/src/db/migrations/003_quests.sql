-- Tugas pemula (berurutan, sekali seumur akun) dan tugas harian (dipilih acak per hari)
create table quests (
  id text primary key,
  kind text not null check (kind in ('starter','daily')),
  title text not null,
  description text not null default '',
  event text not null,
  filter jsonb not null default '{}',
  target int not null default 1 check (target > 0),
  reward_coin int not null default 0 check (reward_coin >= 0),
  reward_pearl int not null default 0 check (reward_pearl >= 0),
  reward_xp int not null default 0 check (reward_xp >= 0),
  url text not null default '/',
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table quest_progress (
  user_id uuid not null references users(id) on delete cascade,
  quest_id text not null references quests(id) on delete cascade,
  period text not null,                  -- 'starter' atau tanggal (YYYY-MM-DD) untuk tugas harian
  progress int not null default 0,
  completed_at timestamptz,
  claimed_at timestamptz,
  primary key (user_id, quest_id, period)
);
