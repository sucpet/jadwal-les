-- Non-aktifkan laoshi (arsip): honor & histori tetap, sesi terjadwal mendatang dihapus.
alter table teachers add column if not exists is_active boolean not null default true;
