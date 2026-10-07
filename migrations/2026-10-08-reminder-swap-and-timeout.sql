-- 1) Tukar ID pesan pengingat terakhir secara atomik, kembalikan ID lama.
--    Mencegah race saat dua pemanggilan lesson-plan-reminder tumpang tindih: keduanya membaca ID lama
--    yang sama lalu saling menimpa, sehingga tombol di salah satu pesan tidak pernah dihapus.
--    Dengan swap ber-lock, pemanggil yang belakangan selalu menerima ID pesan pemanggil sebelumnya.
--    Dua langkah (lock + baca, lalu update): versi CTE satu-statement selalu mengembalikan null karena
--    SELECT ... FOR UPDATE di CTE tidak melihat baris yang sedang diubah statement yang sama.
create or replace function swap_reminder_msg(p_teacher text, p_msg bigint) returns bigint
language plpgsql as $$
declare old_msg bigint;
begin
  select telegram_reminder_msg_id into old_msg from teachers where id = p_teacher for update;
  update teachers set telegram_reminder_msg_id = p_msg where id = p_teacher;
  return old_msg;
end;
$$;
revoke execute on function swap_reminder_msg(text, bigint) from public, anon, authenticated;

-- 2) pg_net default menunggu 5 detik; cold start Edge Function bisa lebih lama dan tercatat timeout palsu.
select cron.schedule(
  'lesson-plan-reminder',
  '*/5 14-16 * * *',
  $$
  select net.http_post(
    url     := 'https://vuyvfuthefgplmwfzzmt.supabase.co/functions/v1/lesson-plan-reminder',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'lesson_plan_cron_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
