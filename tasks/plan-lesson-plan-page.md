# Plan: Halaman Lesson Plan (murid non-XuYuan)

Spec: `SPEC-lesson-plan-page.md`. (Plan/todo fitur Telegram sebelumnya ada di `tasks/plan.md` / `tasks/todo.md`, sudah selesai.)

## Komponen & dependensi

```
[1] Migrasi sessions.lesson_plan ──> [2] Type + mapper AppContext ──> [4] Halaman + nav + route
                                     [3] Helper murni + test ──────────┘
```

[2] dan [3] tidak saling bergantung. Halaman [4] butuh keduanya.

## Urutan

1. **Migrasi** `sessions.lesson_plan text`: additive dan nullable, jadi app lama tidak terpengaruh.
2. **Data layer**: `lessonPlan` di type, `DbSession`, `mapSession`, `toDbSession`, dan baris partial-update di `updateSession`. Tanpa log aktivitas.
3. **Helper + test**: `pastSessions`, `isLessonPlanStudent` (aktif, non-XuYuan), `lessonPlanSummary` (jumlah kosong, sesi terakhir). Logika dulu, UI belakangan.
4. **Halaman**: `LessonPlan.tsx` (daftar + detail, dua kolom di desktop, `?student=`), route, nav, dan i18n.
5. **Verifikasi**: screenshot iPhone 15 Pro + desktop, uji simpan di sesi `[TEST] sucpet` lalu kembalikan ke kosong.

## Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| Autosave menimpa ketikan perangkat lain | Last-write-wins (cukup untuk 2 owner). Textarea tidak di-reset oleh realtime saat sedang fokus. |
| Realtime update sesi lain me-reset draft yang sedang diketik | State draft lokal per textarea, sinkron dari props hanya saat tidak fokus |
| Daftar lambat (~700 sesi) | Hitung ringkasan sekali per render dengan satu pass group-by studentId |
| Bingung dengan flag XuYuan "Lesson plan" di Dashboard | Nama kolom & kunci i18n terpisah (`lesson_plan` / `lpn.*`); halaman hanya non-XuYuan |

## Checkpoint

- Setelah 1: kolom ada di `information_schema.columns`.
- Setelah 2–3: `npm test`, `tsc` lolos.
- Setelah 4: lint + build lolos, screenshot HP + desktop tanpa horizontal scroll, simpan di sesi `[TEST]` → reload → masih ada → dikosongkan lagi.
