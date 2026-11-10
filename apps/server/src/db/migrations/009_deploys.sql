-- Riwayat deploy: dicatat setiap server berjalan dengan versi/commit yang baru.
create table deploys (
  id serial primary key,
  version text not null,
  commit text not null,
  built_at timestamptz,
  started_at timestamptz not null default now()
);
