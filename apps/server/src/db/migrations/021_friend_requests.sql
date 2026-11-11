-- Ajakan berteman untuk pemain yang bertemu di alun-alun atau di rumah teman (harus disetujui penerima).
create table friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references users(id) on delete cascade,
  to_id uuid not null references users(id) on delete cascade,
  place text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  answered_at timestamptz
);
create unique index friend_requests_pending on friend_requests (from_id, to_id) where status = 'pending';
create index friend_requests_to on friend_requests (to_id, status, created_at desc);
-- pemain bisa menolak semua ajakan berteman dari orang yang ditemui (Pengaturan › Privasi)
alter table users add column friend_requests boolean not null default true;
