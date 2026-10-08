-- Bucket backups: hanya user login yang boleh list/download/upload, dan boleh hapus (untuk retensi 5 hari).
-- Sebelumnya policy select & insert juga untuk anon: siapa pun dengan anon key (ada di bundle JS)
-- bisa list & download seluruh backup (data lengkap murid, jadwal, pembayaran).
drop policy if exists "backup select" on storage.objects;
drop policy if exists "backup insert" on storage.objects;
create policy "backup select" on storage.objects for select to authenticated using (bucket_id = 'backups');
create policy "backup insert" on storage.objects for insert to authenticated with check (bucket_id = 'backups');
create policy "backup delete" on storage.objects for delete to authenticated using (bucket_id = 'backups');
