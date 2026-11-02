-- Ongkos jalan kakak-adik satu rumah: kalau murid ini les di hari yang sama dengan
-- transport_payer_id, tarifnya dipotong transport_fee (lihat effectiveRate).
alter table students add column if not exists transport_payer_id text; -- tanpa FK: restore insert murid dalam urutan bebas
alter table students add column if not exists transport_fee integer;
