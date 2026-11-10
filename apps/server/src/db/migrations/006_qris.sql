-- Pembayaran QRIS lewat ZePay: simpan isi QR, batas waktu, dan nomor invoice dari gateway.

alter table payments add column qr_string text;
alter table payments add column expires_at timestamptz;
alter table payments add column invoice text;
alter table payments add column synced_at timestamptz;
create index payments_provider_ref on payments(provider, provider_ref);
create index payments_pending on payments(status, expires_at) where status = 'pending';
