-- Alun-alun: catatan obrolan (moderasi) & laporan pemain.
create table square_chat (
  id bigserial primary key,
  inst int not null,
  user_id uuid not null references users(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);
create index square_chat_created on square_chat (created_at desc);
create index square_chat_user on square_chat (user_id, created_at desc);

create table reports (
  id bigserial primary key,
  reporter_id uuid references users(id) on delete set null,
  target_id uuid not null references users(id) on delete cascade,
  place text not null,
  reason text,
  evidence jsonb not null default '[]',
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by text
);
create index reports_open on reports (handled_at, created_at desc);
create index reports_target on reports (target_id, created_at desc);

-- lokasi baru di peta: alun-alun
alter table locations drop constraint locations_kind_check;
alter table locations add constraint locations_kind_check check (kind in ('home','shop','social','garden','race','pond','pearl','games','square'));
