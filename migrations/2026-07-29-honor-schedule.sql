-- Perubahan honor guru terjadwal (mirror perubahan harga sesi murid) + snapshot honor per sesi.
alter table teachers add column if not exists pending_honor numeric;
alter table teachers add column if not exists pending_honor_effective_date date;
alter table sessions add column if not exists honor_snapshot numeric;
