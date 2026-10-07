-- Pesan pengingat terakhir per guru, supaya tombolnya bisa dihapus saat pengingat baru dikirim
-- (atau saat semua sesi sudah ditandai). Hanya dipakai Edge Function lesson-plan-reminder.
alter table teachers add column if not exists telegram_reminder_msg_id bigint;
