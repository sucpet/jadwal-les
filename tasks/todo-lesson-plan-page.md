# Todo: Halaman Lesson Plan

- [x] 1. Migrasi `sessions.lesson_plan`
  - Acceptance: kolom text nullable ada di project asli
  - Verify: query information_schema
  - Files: migrations/2026-10-08-session-lesson-plan.sql

- [x] 2. Data layer
  - Acceptance: `lessonPlan` terbaca dari DB, tersimpan lewat `updateSession`, ikut realtime
  - Verify: tsc
  - Files: src/types/index.ts, src/store/AppContext.tsx

- [x] 3. Helper + test
  - Acceptance: `pastSessions`, `isLessonPlanStudent`, `lessonPlanSummary` teruji (murid lain, sesi besok, sesi hari ini belum selesai, urutan, teks spasi = kosong, XuYuan & non-aktif dikecualikan)
  - Verify: npx vitest run src/utils/__tests__/lessonPlan.test.ts
  - Files: src/utils/lessonPlan.ts, src/utils/__tests__/lessonPlan.test.ts

- [x] 4. Halaman + route + nav + i18n
  - Acceptance: sesuai acceptance criteria di spec (daftar, detail, autosave, dua kolom desktop, ?student=)
  - Verify: lint, build, screenshot iPhone 15 Pro + desktop
  - Files: src/pages/LessonPlan.tsx, src/App.tsx, src/components/Layout.tsx, src/i18n/translations.ts

- [x] 5. Uji simpan end-to-end di sesi [TEST], kembalikan ke kosong
  - Acceptance: tersimpan, bertahan setelah reload, badge berubah
  - Verify: Playwright + query DB
  - Files: —
