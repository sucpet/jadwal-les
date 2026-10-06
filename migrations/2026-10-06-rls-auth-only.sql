-- Tutup akses anon: policy payments & activity_log sebelumnya USING (true) tanpa role,
-- jadi siapa pun dengan anon key (ada di bundle JS) bisa baca/tulis/hapus tanpa login.
alter policy payments_select     on payments     to authenticated;
alter policy payments_insert     on payments     to authenticated;
alter policy payments_delete     on payments     to authenticated;
alter policy activity_log_select on activity_log to authenticated;
alter policy activity_log_insert on activity_log to authenticated;
alter policy activity_log_delete on activity_log to authenticated;
