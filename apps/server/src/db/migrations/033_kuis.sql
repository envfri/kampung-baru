-- Cerdas Cermat Kampung (paket konten 25): kuis bersama Pak Kancil.
-- kuis_questions = bank soal (diisi dari kuis-soal.json, diubah admin). Soal yang dihapus admin disimpan dengan
-- deleted_at supaya sinkron bank tidak pernah menambahkannya lagi. Statistik (tampil / dijawab / benar) untuk admin.
create table if not exists kuis_questions (
  id text primary key,
  cat text not null,
  level int not null,
  type text not null,
  -- soal lengkap dalam bentuk kontrak bank (lihat @kb/shared kuis.ts)
  data jsonb not null,
  -- teks soal dinormalkan (cek soal kembar)
  qnorm text not null,
  active boolean not null default true,
  -- bank = dari kuis-soal.json, admin = dibuat di panel admin
  origin text not null default 'bank',
  deleted_at timestamptz,
  shown int not null default 0,
  answered int not null default 0,
  correct int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);
create index if not exists kuis_questions_pool on kuis_questions (cat, level) where active and deleted_at is null;

-- Satu permainan seorang pemain: Kuis Harian (satu per hari WIB) atau Tantang Teman (satu per pemain per tantangan, tabel duels).
create table if not exists kuis_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('harian', 'tantang')),
  -- hari WIB (YYYY-MM-DD) & Senin minggu itu (papan peringkat mingguan)
  day text not null,
  week text not null,
  duel_id uuid references duels(id) on delete cascade,
  qids text[] not null,
  timer_sec int not null,
  grace_sec int not null,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  correct int not null default 0,
  -- poin papan peringkat (Kuis Harian)
  score int not null default 0,
  total_ms int not null default 0,
  coins int not null default 0,
  xp int not null default 0,
  bonus jsonb
);
create unique index if not exists kuis_runs_harian on kuis_runs (user_id, day) where kind = 'harian';
create unique index if not exists kuis_runs_tantang on kuis_runs (duel_id, user_id) where kind = 'tantang';
create index if not exists kuis_runs_week on kuis_runs (week, user_id) where kind = 'harian';
create index if not exists kuis_runs_user on kuis_runs (user_id, created_at desc);

-- Tiap soal dalam satu permainan: kapan dikirim server (batas waktu dihitung dari sini) & jawaban pemain.
create table if not exists kuis_answers (
  run_id uuid not null references kuis_runs(id) on delete cascade,
  idx int not null,
  qid text not null,
  served_at timestamptz not null,
  answered_at timestamptz,
  pick jsonb,
  correct boolean,
  timed_out boolean not null default false,
  ms int,
  points int not null default 0,
  coins int not null default 0,
  xp int not null default 0,
  primary key (run_id, idx)
);

-- Soal yang pernah dilihat pemain (dihindari di Kuis Harian selama kuis.seenDays hari).
create table if not exists kuis_seen (
  user_id uuid not null references users(id) on delete cascade,
  qid text not null,
  seen_at timestamptz not null default now(),
  primary key (user_id, qid)
);

-- Beruntun Kuis Harian (hari berturut-turut menyelesaikan kuis).
create table if not exists kuis_streaks (
  user_id uuid primary key references users(id) on delete cascade,
  streak int not null default 0,
  best int not null default 0,
  last_day text
);

-- "Laporkan soal" dari pemain.
create table if not exists kuis_reports (
  id bigserial primary key,
  qid text not null,
  user_id uuid not null references users(id) on delete cascade,
  reason text not null check (reason in ('salah', 'bingung', 'ketik', 'lain')),
  note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text
);
create index if not exists kuis_reports_open on kuis_reports (qid) where resolved_at is null;
create unique index if not exists kuis_reports_once on kuis_reports (qid, user_id) where resolved_at is null;
create index if not exists kuis_reports_time on kuis_reports (created_at desc);
