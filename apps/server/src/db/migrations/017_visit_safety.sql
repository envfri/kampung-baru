-- Hasil audit kunjungan bareng: blokir permanen & pilihan "jangan pajang foto".
create table blocks (
  user_id uuid not null references users(id) on delete cascade,
  blocked_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked_id)
);
create index blocks_blocked on blocks (blocked_id);
alter table users add column photo_off boolean not null default false;
