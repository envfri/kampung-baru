-- Kode pindah perangkat: kode sekali pakai yang membuka akun yang sama di HP/browser lain
-- (berguna untuk akun tamu yang belum menyambungkan Google/email).
create table transfer_codes (
  code_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_ip text
);
create index transfer_codes_user on transfer_codes (user_id, created_at desc);
