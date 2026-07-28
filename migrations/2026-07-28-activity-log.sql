-- Log aktivitas perubahan sesi (tambah / reschedule / hapus).
-- Dipakai untuk menelusuri perubahan jadwal, termasuk yang tidak sengaja.
create table if not exists activity_log (
  id          text primary key,
  action      text not null,          -- 'create' | 'reschedule' | 'delete'
  description text not null,
  created_at  timestamptz not null default now()
);

alter table activity_log enable row level security;

-- App memakai anon key setelah login; buat policy permisif untuk select/insert/delete.
drop policy if exists "activity_log_select" on activity_log;
drop policy if exists "activity_log_insert" on activity_log;
drop policy if exists "activity_log_delete" on activity_log;
create policy "activity_log_select" on activity_log for select using (true);
create policy "activity_log_insert" on activity_log for insert with check (true);
create policy "activity_log_delete" on activity_log for delete using (true);

create index if not exists activity_log_created_at_idx on activity_log (created_at desc);
