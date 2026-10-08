-- Catatan lesson plan per sesi untuk murid non-XuYuan ("apa yang dipelajari hari ini").
-- Terpisah dari sessions.notes (catatan umum form sesi) dan sessions.lesson_plan_done_at (flag XuYuan).
alter table sessions add column if not exists lesson_plan text;
