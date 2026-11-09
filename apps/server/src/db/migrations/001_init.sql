-- Kampung Bulu: skema awal

create table users (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  friend_code text not null unique,
  is_guest boolean not null default true,
  banned_at timestamptz,
  ban_reason text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table auth_identities (
  provider text not null,              -- guest | email | google | facebook
  provider_uid text not null,
  user_id uuid not null references users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  primary key (provider, provider_uid)
);
create index auth_identities_user on auth_identities(user_id);

create table sessions (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index sessions_user on sessions(user_id);

create table email_otps (
  email text primary key,
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table pets (
  user_id uuid primary key references users(id) on delete cascade,
  name text not null,
  color text not null,
  ear text not null,
  wear jsonb not null default '{}',     -- { head?: itemId, face?: itemId, neck?: itemId }
  level int not null default 1,
  xp int not null default 0,
  kenyang real not null,
  bersih real not null,
  ceria real not null,
  energi real not null,
  needs_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table items (
  id text primary key,
  kind text not null check (kind in ('food','furniture','wear','wallpaper','floor','seed','fish','material')),
  name text not null,
  description text not null default '',
  price_coin int not null default 0 check (price_coin >= 0),
  price_pearl int not null default 0 check (price_pearl >= 0),
  sell_coin int not null default 0 check (sell_coin >= 0),
  shop text,                             -- id lokasi yang menjual item ini (null = tidak dijual)
  art jsonb not null,
  data jsonb not null default '{}',
  event_id text,
  available_from timestamptz,
  available_to timestamptz,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table inventory (
  user_id uuid not null references users(id) on delete cascade,
  item_id text not null references items(id) on delete cascade,
  qty int not null check (qty >= 0),
  primary key (user_id, item_id)
);

create table rooms (
  user_id uuid primary key references users(id) on delete cascade,
  layout jsonb not null default '[]',    -- [{ i: itemId, x, y }]
  wall text,
  floor text,
  version int not null default 1,
  updated_at timestamptz not null default now()
);

create table wallets (
  user_id uuid primary key references users(id) on delete cascade,
  coin int not null default 0 check (coin >= 0),
  pearl int not null default 0 check (pearl >= 0)
);

create table wallet_ledger (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  currency text not null check (currency in ('coin','pearl')),
  delta int not null,
  balance_after int not null,
  reason text not null,
  ref text,
  created_at timestamptz not null default now()
);
create index wallet_ledger_user on wallet_ledger(user_id, id desc);

create table idempotency (
  user_id uuid not null,
  request_id text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);

create table cooldowns (
  user_id uuid not null references users(id) on delete cascade,
  key text not null,
  until timestamptz not null,
  primary key (user_id, key)
);

create table daily_counters (
  user_id uuid not null references users(id) on delete cascade,
  key text not null,
  day date not null,
  count int not null default 0,
  primary key (user_id, key, day)
);

create table daily_claims (
  user_id uuid not null references users(id) on delete cascade,
  day date not null,
  streak int not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

create table friendships (
  user_id uuid not null references users(id) on delete cascade,
  friend_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id)
);

create table visits (
  visitor_id uuid not null references users(id) on delete cascade,
  host_id uuid not null references users(id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (visitor_id, host_id, day)
);
create index visits_host on visits(host_id, created_at desc);

create table gifts (
  id bigserial primary key,
  from_id uuid references users(id) on delete set null,
  to_id uuid not null references users(id) on delete cascade,
  item_id text not null references items(id) on delete cascade,
  qty int not null default 1,
  message text not null default '',
  created_at timestamptz not null default now(),
  opened_at timestamptz
);
create index gifts_to on gifts(to_id, opened_at);

create table garden_plots (
  user_id uuid not null references users(id) on delete cascade,
  slot int not null,
  seed_id text not null references items(id) on delete cascade,
  planted_at timestamptz not null default now(),
  ready_at timestamptz not null,
  primary key (user_id, slot)
);

create table races (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  seed int not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  time_ms int,
  rank int,
  reward int
);
create index races_user on races(user_id, started_at desc);

create table fishing_casts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  fish_id text not null references items(id) on delete cascade,
  cast_at timestamptz not null default now(),
  bite_at timestamptz not null,
  window_ms int not null,
  result text                            -- null | caught | missed
);

create table fish_collection (
  user_id uuid not null references users(id) on delete cascade,
  fish_id text not null references items(id) on delete cascade,
  count int not null default 0,
  best_cm real not null default 0,
  first_at timestamptz not null default now(),
  primary key (user_id, fish_id)
);

create table events (
  id text primary key,
  name text not null,
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  theme jsonb not null default '{}',     -- { color, emoji? }
  bonus jsonb not null default '{}',     -- { coinMultiplier }
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table locations (
  id text primary key,
  name text not null,
  kind text not null check (kind in ('home','shop','social','garden','race','pond','pearl')),
  x int not null,
  y int not null,
  style jsonb not null default '{}',
  enabled boolean not null default true,
  sort int not null default 0,
  sells_back boolean not null default false
);

create table settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table announcements (
  id serial primary key,
  title text not null,
  body text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table pearl_packages (
  id text primary key,
  name text not null,
  pearls int not null check (pearls > 0),
  bonus int not null default 0,
  price_idr int not null check (price_idr > 0),
  active boolean not null default true,
  sort int not null default 0
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  package_id text not null,
  pearls int not null,
  amount_idr int not null,
  provider text not null,
  provider_ref text,
  status text not null default 'pending' check (status in ('pending','paid','failed','expired')),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  raw jsonb
);
create index payments_user on payments(user_id, created_at desc);

create table media (
  id text primary key,
  filename text not null,
  mime text not null,
  bytes bytea not null,
  size int not null,
  created_at timestamptz not null default now()
);

create table banned_words (
  word text primary key,
  created_at timestamptz not null default now()
);

create table admins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null default '',
  password_hash text not null,
  role text not null check (role in ('owner','admin','moderator')),
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table admin_sessions (
  token_hash text primary key,
  admin_id uuid not null references admins(id) on delete cascade,
  expires_at timestamptz not null
);

create table admin_audit (
  id bigserial primary key,
  admin_id uuid references admins(id) on delete set null,
  admin_email text,
  action text not null,
  target text,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_time on admin_audit(created_at desc);

create table analytics_events (
  id bigserial primary key,
  user_id uuid,
  name text not null,
  props jsonb,
  created_at timestamptz not null default now()
);
create index analytics_name_time on analytics_events(name, created_at desc);
create index analytics_user_time on analytics_events(user_id, created_at desc);
