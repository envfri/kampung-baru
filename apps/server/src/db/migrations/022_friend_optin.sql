-- "Terima ajakan berteman dari orang yang ditemui" bawaannya MATI (pemain menyalakannya sendiri);
-- friend_prompt_at = kapan pemain menjawab ajakan sekali saja "Mau punya teman baru?" di alun-alun.
alter table users alter column friend_requests set default false;
update users set friend_requests = false;
alter table users add column friend_prompt_at timestamptz;
