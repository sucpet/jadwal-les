-- Perubahan harga terjadwal untuk murid postpaid (per-session).
-- pending_rate berlaku otomatis mulai pending_rate_effective_date;
-- setelah tanggal itu lewat, app mempromosikannya jadi rate_per_session
-- dan mengosongkan kedua kolom ini.
alter table students add column if not exists pending_rate numeric;
alter table students add column if not exists pending_rate_effective_date date;
