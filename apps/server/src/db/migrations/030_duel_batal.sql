-- Duel: tantangan bisa dibatalkan oleh yang menantang (status 'cancelled'), dan tantangan yang tidak didatangi teman
-- batal otomatis lebih cepat: 48 jam -> 6 jam (hanya bila admin belum mengubah angkanya).
alter table duels drop constraint if exists duels_status_check;
alter table duels add constraint duels_status_check check (status in ('open', 'live', 'done', 'declined', 'expired', 'cancelled'));

update settings set value = jsonb_set(value, '{duel,expireHours}', '6'::jsonb), updated_at = now()
  where key = 'game' and value #>> '{duel,expireHours}' = '48';

-- tantangan yang sedang menunggu mengikuti batas baru (bila batasnya memang 6 jam / bawaan)
update duels set expires_at = least(expires_at, created_at + interval '6 hours')
  where status in ('open', 'live')
    and coalesce((select value #>> '{duel,expireHours}' from settings where key = 'game'), '6') = '6';
