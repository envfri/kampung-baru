-- Notifikasi: push (Web Push) + kotak notifikasi di dalam game

create table push_subscriptions (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz,
  fail_count int not null default 0
);
create index push_subscriptions_user on push_subscriptions(user_id);

create table notifications (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  url text not null default '/',
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_user on notifications(user_id, id desc);

create table broadcasts (
  id serial primary key,
  title text not null,
  body text not null,
  url text not null default '/',
  segment text not null default 'all',
  send_at timestamptz not null default now(),
  status text not null default 'scheduled' check (status in ('scheduled','sending','sent','cancelled')),
  recipients int,
  pushed int,
  created_by text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table users add column notify_prefs jsonb not null default '{}';
alter table garden_plots add column notified_at timestamptz;
alter table pets add column needs_notified_at timestamptz;
