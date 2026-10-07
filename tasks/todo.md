# Todo: Pengingat Lesson Plan XuYuan

- [x] 1. Migrasi DB
  - Acceptance: 3 kolom + tabel token + RLS ada di project asli; app lama tetap jalan
  - Verify: query columns/policies; buka app, data tampil normal
  - Files: migrations/2026-10-07-lesson-plan-reminder.sql, migrations/0000-base-schema.sql (refresh opsional)

- [x] 2. App: type/mapper, email guru, toggle Dashboard, helper + test
  - Acceptance: email guru bisa diisi di Laoshi; sesi XuYuan hari ini punya toggle; `pendingLessonPlans` teruji
  - Verify: npm test / lint / build; screenshot desktop + HP
  - Files: src/types/index.ts, src/store/AppContext.tsx, src/pages/Teachers.tsx, src/pages/Dashboard.tsx, src/utils/lessonPlan.ts (+ test), src/i18n/translations.ts

- [x] 3. Bot + secrets (developer)
  - Acceptance: bot ada; TELEGRAM_BOT_TOKEN + TELEGRAM_WEBHOOK_SECRET di Supabase secrets
  - Verify: `supabase secrets list` menampilkan nama (bukan nilai)
  - Files: —

- [x] 4. Fn telegram-webhook + setWebhook
  - Acceptance: /start <token valid> menyimpan chat_id; token palsu/kedaluwarsa ditolak; tanpa secret → 401; callback tombol set lesson_plan_done_at
  - Verify: curl tanpa secret → 401; uji /start dari Telegram
  - Files: supabase/functions/telegram-webhook/index.ts, supabase/config.toml

- [x] 5. App: Hubungkan Telegram di Settings
  - Acceptance: tombol membuat token & membuka bot; status "Terhubung" tampil setelah Start
  - Verify: alur manual dengan akun Claude (guru [TEST])
  - Files: src/pages/Settings.tsx, src/i18n/translations.ts

- [ ] 6. Fn lesson-plan-reminder + pg_cron
  - Acceptance: 21:00–23:59 WIB tiap 5 menit kirim ke guru dengan sesi pending; di luar jam → no-op
  - Verify: invoke manual dengan parameter waktu uji; cek cron.job
  - Files: supabase/functions/lesson-plan-reminder/index.ts, migrations/2026-10-07-lesson-plan-cron.sql

- [ ] 7. Uji end-to-end + bersihkan data [TEST]
  - Acceptance: pesan masuk, tombol menghentikan, data [TEST] terhapus
  - Verify: Telegram + query DB
  - Files: —
