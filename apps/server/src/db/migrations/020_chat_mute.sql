-- Bisukan obrolan sementara (dari laporan pemain atau admin); tersimpan supaya bertahan saat server restart
-- dan terlihat/bisa dibuka moderator.
alter table users add column chat_muted_until timestamptz;
