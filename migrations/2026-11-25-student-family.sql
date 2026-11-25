-- Keluarga: anggota menunjuk ke murid kepala keluarga lewat family_head_id.
-- Invoice bulanan digabung untuk kepala + semua anggota (lihat getFamilyInvoice).
alter table students add column if not exists family_head_id text; -- tanpa FK: restore insert murid dalam urutan bebas
