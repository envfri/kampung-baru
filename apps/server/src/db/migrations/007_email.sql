-- Email lewat Mailketing: antrean kirim (dengan percobaan ulang), alamat yang tidak boleh dikirimi lagi,
-- dan pilihan broadcast admin untuk ikut dikirim ke email.

create table email_outbox (
  id bigserial primary key,
  user_id uuid references users(id) on delete cascade,
  to_email text not null,
  kind text not null,                   -- otp | test | system | events | social | garden | needs | daily
  subject text not null,
  html text,                            -- dikosongkan setelah terkirim
  status text not null default 'queued' check (status in ('queued','sending','sent','failed')),
  attempts int not null default 0,
  next_at timestamptz not null default now(),
  message_id text,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index email_outbox_queue on email_outbox(next_at) where status in ('queued','sending');
create index email_outbox_user on email_outbox(user_id, created_at desc);
create index email_outbox_msg on email_outbox(message_id) where message_id is not null;
create index email_outbox_created on email_outbox(created_at desc);

create table email_suppressions (
  email text primary key,               -- huruf kecil
  reason text not null,                 -- bounce | unsubscribe | manual
  detail text,
  created_at timestamptz not null default now()
);

alter table broadcasts add column email boolean not null default false;
alter table broadcasts add column emailed int;
