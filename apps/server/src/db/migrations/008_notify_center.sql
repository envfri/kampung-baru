-- Pusat notifikasi (teks & saluran per jenis bisa diubah admin) dan WhatsApp lewat Klik Flow.

-- bagian template yang diubah admin; sisanya bawaan dari kode
create table notify_templates (
  key text primary key,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by text
);

-- antrean email menjadi antrean semua saluran keluar (email & WhatsApp)
alter table email_outbox rename to outbox;
alter table outbox rename column to_email to to_addr;
alter table outbox rename column html to body;
alter table outbox add column channel text not null default 'email' check (channel in ('email','whatsapp'));
alter table outbox add column delivery text;   -- status dari penyedia: delivered, read, failed
create index outbox_channel on outbox(channel, created_at desc);

-- nomor WhatsApp pemain (hanya dipakai setelah diverifikasi dengan kode)
alter table users add column wa_phone text;
alter table users add column wa_verified_at timestamptz;
create unique index users_wa_phone on users(wa_phone) where wa_verified_at is not null;

create table wa_otps (
  user_id uuid primary key references users(id) on delete cascade,
  phone text not null,
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- event webhook yang sudah diproses (penyedia bisa mengirim ulang event yang sama)
create table webhook_events (
  id text primary key,
  source text not null,
  created_at timestamptz not null default now()
);

alter table broadcasts add column whatsapp boolean not null default false;
alter table broadcasts add column whatsapped int;
