-- Pengingat lesson plan XuYuan via Telegram (SPEC-lesson-plan-reminder.md).
-- Semua kolom nullable, jadi app yang sedang berjalan tidak terpengaruh.

-- Email akun login guru, dicocokkan dengan auth.email() untuk "Hubungkan Telegram".
alter table teachers add column if not exists email text unique;
-- Chat Telegram guru. Hanya ditulis Edge Function (service role) setelah /start <token> valid.
alter table teachers add column if not exists telegram_chat_id bigint;
-- Waktu lesson plan ditandai sudah diisi. null berarti belum diisi.
alter table sessions add column if not exists lesson_plan_done_at timestamptz;

-- Token sekali pakai untuk menghubungkan chat Telegram ke guru.
create table if not exists telegram_link_tokens (
  token      text primary key,
  teacher_id text not null references teachers(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '15 minutes'
);
alter table telegram_link_tokens enable row level security;
revoke all on telegram_link_tokens from anon;
-- Guru hanya boleh membuat token untuk dirinya sendiri, dicocokkan lewat email.
-- Tidak ada policy select, update, atau delete. Membaca dan menghapus token hanya lewat service role.
create policy link_token_insert_own on telegram_link_tokens for insert to authenticated
  with check (teacher_id in (select id from teachers where email = auth.email()));

-- ponytail: telegram_chat_id tidak dikunci per kolom. Semua user yang login sudah bisa
-- membaca dan menulis seluruh data (policy auth_all), jadi kunci kolom tidak menambah
-- keamanan. Upgrade path: kalau nanti ada role guru dengan akses terbatas, tambahkan
-- trigger yang menolak perubahan kolom ini selain dari service_role.
