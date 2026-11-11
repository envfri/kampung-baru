-- Pembayaran uji (simulasi mock / kunci uji ZePay) ditandai supaya Mutiara-nya bisa ditarik sebelum peluncuran
-- dan tidak terhitung sebagai pembayaran sungguhan.
alter table payments add column test boolean not null default false;
alter table payments add column revoked_at timestamptz;
update payments set test = true
 where provider = 'mock'
    or raw->'payment'->>'livemode' = 'false'
    or raw->>'livemode' = 'false';
create index payments_test_paid on payments (user_id) where test and status = 'paid' and revoked_at is null;
