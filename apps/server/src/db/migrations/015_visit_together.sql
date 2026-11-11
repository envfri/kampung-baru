-- Kunjungan bareng: pet ikut berkunjung, bermain dengan pet teman, obrolan, main bareng, foto bareng.

-- interaksi tamu di rumah teman (juga isi buku tamu)
create table visit_acts (
  id bigserial primary key,
  host_id uuid not null references users(id) on delete cascade,
  visitor_id uuid not null references users(id) on delete cascade,
  kind text not null,
  item_id text,
  rewarded boolean not null default false,
  created_at timestamptz not null default now()
);
create index visit_acts_host on visit_acts (host_id, created_at desc);
create index visit_acts_pair on visit_acts (visitor_id, host_id, created_at desc);

-- obrolan di rumah (disimpan untuk moderasi)
create table house_chat (
  id bigserial primary key,
  host_id uuid not null references users(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);
create index house_chat_created on house_chat (created_at desc);

-- foto bareng (masuk album semua yang ada di foto)
create table photos (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references users(id) on delete cascade,
  taken_by uuid references users(id) on delete set null,
  pose text not null default 'senyum',
  members jsonb not null,
  scene jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table photo_members (
  photo_id uuid not null references photos(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  primary key (photo_id, user_id)
);
create index photo_members_user on photo_members (user_id);

alter table users add column show_online boolean not null default true;
alter table users add column live_visits boolean not null default true;
alter table users add column featured_photo uuid references photos(id) on delete set null;
alter table users add column guestbook_seen_at timestamptz not null default now();
