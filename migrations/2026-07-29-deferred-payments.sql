-- Murid "dibayar lembaga" (deferred): pendapatan diakui saat pembayaran dicatat,
-- bukan otomatis di bulan paket/sesi.
alter table students add column if not exists deferred_payment boolean not null default false;

create table if not exists payments (
  id          text primary key,
  student_id  text not null,
  date        date not null,           -- tanggal uang diterima
  amount      numeric not null,
  note        text,
  created_at  timestamptz not null default now()
);

alter table payments enable row level security;
drop policy if exists "payments_select" on payments;
drop policy if exists "payments_insert" on payments;
drop policy if exists "payments_delete" on payments;
create policy "payments_select" on payments for select using (true);
create policy "payments_insert" on payments for insert with check (true);
create policy "payments_delete" on payments for delete using (true);

create index if not exists payments_student_idx on payments (student_id);
create index if not exists payments_date_idx on payments (date);
