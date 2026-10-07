# Spec: Pengingat Lesson Plan XuYuan via Telegram

Status: **SELESAI** (2026-10-07). Deploy lewat Supabase CLI (`--use-api`).

## Objective

Guru XuYuan harus mengisi lesson plan di GSheet milik XuYuan pada hari yang sama dengan sesi. Kalau lupa, poin KPI guru dipotong. Fitur ini mengirim pengingat lewat bot Telegram sampai guru menandai lesson plan sudah diisi.

**Pengguna:** setiap guru (laoshi) yang mengajar murid grup `xuyuan`. Setiap guru punya akun login sendiri.

**Alur:**
1. Developer mengisi email setiap guru di halaman Laoshi (sekali saja).
2. Guru login, lalu menekan **Hubungkan Telegram** di Settings. Bot terbuka lewat link `t.me/<bot>?start=<token>`, lalu guru menekan Start. Chat Telegram itu tersimpan sebagai milik guru tersebut.
3. Mulai pukul 21:00 WIB sampai 23:59 WIB, setiap 5 menit: untuk setiap guru yang punya sesi XuYuan hari ini yang jam selesainya sudah lewat dan belum ditandai, bot mengirim satu pesan berisi daftar sesi itu. Setiap sesi punya tombol **Sudah diisi**.
4. Guru menekan tombol di Telegram atau toggle di Dashboard. Sesi itu tidak diingatkan lagi.
5. Hanya pesan pengingat terakhir yang punya tombol. Saat pesan baru terkirim, tombol di pesan sebelumnya dihapus (`teachers.telegram_reminder_msg_id`). Kalau semua sesi sudah ditandai, tombol di pesan terakhir juga dihapus.

## Tech Stack

- Frontend yang sudah ada: React 19, TypeScript, Vite, Supabase JS.
- Baru: Supabase Edge Functions (Deno), `pg_cron` + `pg_net` untuk jadwal, Telegram Bot API (HTTP, tanpa library).

## Commands

```
Dev:      npm run dev
Test:     npm test
Lint:     npm run lint
Build:    npm run build
Deploy fn (oleh developer): supabase functions deploy telegram-webhook --no-verify-jwt
                            supabase functions deploy lesson-plan-reminder
Secrets (oleh developer):   supabase secrets set TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=...
```

## Project Structure

```
migrations/2026-10-XX-lesson-plan-reminder.sql   → kolom & tabel baru, RLS, pg_cron job
supabase/functions/telegram-webhook/index.ts     → /start <token> + tombol "Sudah diisi"
supabase/functions/lesson-plan-reminder/index.ts → dipanggil cron tiap 5 menit, kirim pesan
src/utils/lessonPlan.ts                          → logika murni: sesi mana yang perlu diingatkan
src/utils/__tests__/lessonPlan.test.ts           → test logika murni
src/pages/Teachers.tsx                           → field email guru
src/pages/Settings.tsx                           → tombol Hubungkan Telegram + status
src/pages/Dashboard.tsx                          → toggle "Lesson plan sudah diisi" di sesi XuYuan hari ini
src/store/AppContext.tsx, src/types/index.ts     → kolom baru (pola mapper yang sudah ada)
```

## Data Model (perubahan schema, perlu persetujuan)

- `teachers.email text unique`: dicocokkan dengan email akun login.
- `teachers.telegram_chat_id bigint`: diisi oleh webhook saat guru menekan Start.
- `sessions.lesson_plan_done_at timestamptz`: null berarti belum diisi.
- Tabel `telegram_link_tokens (token text pk, teacher_id text, expires_at timestamptz)`: token sekali pakai, berlaku 15 menit.
- RLS:
  - `authenticated` boleh membuat token hanya untuk guru yang `email`-nya sama dengan `auth.email()`.
  - Hanya service role (Edge Function) yang boleh membaca token dan menulis `telegram_chat_id`.

## Code Style

Ikuti pola yang sudah ada. Logika murni ada di `src/utils/` dan diuji dengan vitest, sedangkan page memanggil helper:

```ts
// src/utils/lessonPlan.ts
export function pendingLessonPlans(sessions: LessonSession[], students: Student[], today: string, nowHHMM: string) {
  const xuyuan = new Set(students.filter(s => s.group === 'xuyuan').map(s => s.id));
  return sessions.filter(s =>
    xuyuan.has(s.studentId) && s.date === today && s.endTime <= nowHHMM && !s.lessonPlanDoneAt);
}
```

Edge Function memakai logika yang sama, disalin dan bukan diimpor, karena Deno dan Vite tidak berbagi build. Ini dicatat dengan komentar `ponytail:`.

## Testing Strategy

- **Unit (vitest):** `pendingLessonPlans` untuk kasus: sesi bukan XuYuan, sesi besok, sesi yang belum selesai, sesi yang sudah ditandai, dan guru yang berbeda.
- **Manual (Telegram):** hubungkan akun test, buat sesi `[TEST]` XuYuan hari ini, jalankan function reminder secara manual, terima pesan, tekan tombol, lalu jalankan lagi dan pastikan tidak ada pesan.
- **Keamanan:** kirim `/start` dengan token palsu atau kedaluwarsa, lalu pastikan bot menolak dan tidak menyimpan chat. Panggil webhook tanpa header secret, lalu pastikan mendapat 401.

## Boundaries

- **Always:**
  - Token bot dan secret webhook hanya ada di Supabase secrets.
  - Webhook memverifikasi header `X-Telegram-Bot-Api-Secret-Token`.
  - Bot hanya mengirim pesan ke `telegram_chat_id` yang sudah terhubung.
  - Data test diberi awalan `[TEST]` dan dihapus setelah dipakai.
- **Ask first:** menjalankan migrasi di project asli, deploy Edge Function, dan mendaftarkan webhook ke Telegram.
- **Never:**
  - Menyimpan token bot di repo atau di `.env.local` yang ikut ke bundle.
  - Mengirim nama murid ke chat yang tidak terverifikasi.
  - Mengubah data guru, murid, atau sesi yang sudah ada saat testing.

## Success Criteria

1. Guru dengan email terisi bisa menghubungkan Telegram dalam kurang dari 1 menit, dan Settings menampilkan "Terhubung".
2. Pukul 21:00 WIB, guru dengan sesi XuYuan yang belum ditandai menerima pesan. Pesan diulang setiap 5 menit sampai 23:55.
3. Menekan **Sudah diisi** di Telegram atau Dashboard menghentikan pengingat untuk sesi itu dalam satu siklus berikutnya.
4. Guru tanpa sesi XuYuan, atau yang semua sesinya sudah ditandai, tidak menerima pesan.
5. Token palsu dan request webhook tanpa secret ditolak.
6. `npm test`, `npm run lint`, dan `npm run build` lolos.

## Out of Scope

- Notifikasi tepat setelah sesi selesai.
- Integrasi ke GSheet XuYuan.
- Murid selain grup `xuyuan`.
- WhatsApp dan push notification PWA.
- Jam pengingat yang bisa diatur per guru.

## Keputusan

1. Semua guru di zona WIB (Asia/Jakarta).
2. Sesi yang selesai setelah pukul 21:00 diingatkan begitu jam selesainya lewat.
3. Toggle "Sudah diisi" di app cukup ada di Dashboard, di sesi XuYuan hari ini.

## Open Questions

1. **Cara deploy Edge Function:** lewat Supabase Dashboard (copy-paste kode di browser) atau lewat Supabase CLI yang dijalankan Claude setelah developer login sekali.
