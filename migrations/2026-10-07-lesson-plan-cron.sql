-- Jadwal pengingat lesson plan: panggil Edge Function lesson-plan-reminder tiap 5 menit
-- pukul 21:00–23:55 WIB (= 14:00–16:55 UTC; pg_cron memakai UTC).
-- Prasyarat (sekali): secret Vault 'lesson_plan_cron_secret' = secret function LESSON_PLAN_CRON_SECRET.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'lesson-plan-reminder',           -- nama unik; schedule ulang menimpa job yang sama
  '*/5 14-16 * * *',
  $$
  select net.http_post(
    url     := 'https://vuyvfuthefgplmwfzzmt.supabase.co/functions/v1/lesson-plan-reminder',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'lesson_plan_cron_secret')
    ),
    body    := '{}'::jsonb
  );
  $$
);
