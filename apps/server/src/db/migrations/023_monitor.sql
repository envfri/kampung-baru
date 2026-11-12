-- Pemantauan server (admin → Server): rata-rata tiap 5 menit, disimpan 30 hari, dan riwayat peringatan.
create table server_metrics (
  at timestamptz primary key,
  cpu real, mem real, disk real, disk_used bigint, disk_total bigint,
  loop_p99 real, rpm real, err real, rt_p95 real, online int, db_ms real
);
create table server_alerts (
  id bigserial primary key,
  kind text not null,
  message text not null,
  value real,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  notified boolean not null default false
);
create index server_alerts_started on server_alerts(started_at desc);
