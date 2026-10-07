# Plan: Pengingat Lesson Plan XuYuan via Telegram

Spec: `SPEC-lesson-plan-reminder.md`. Deploy lewat Supabase CLI (developer sudah login; project `vuyvfuthefgplmwfzzmt`).

## Komponen & dependensi

```
[1] Migrasi DB ──┬──> [2] App: email guru + toggle Dashboard ──> [3] App: tombol Hubungkan Telegram
                 └──> [4] Fn telegram-webhook ──> [5] Fn lesson-plan-reminder + cron
[0] Bot @BotFather + secrets (developer) ──> [4], [5]
```

## Urutan (vertical slice, tiap langkah bisa dicek sendiri)

1. **Migrasi DB.** Kolom `teachers.email`, `teachers.telegram_chat_id`, `sessions.lesson_plan_done_at`, tabel `telegram_link_tokens` beserta RLS. Kolom yang additive dan nullable tidak merusak app yang sedang jalan.
2. **App: data & toggle.** Mapper dan type, field email di halaman Laoshi, toggle "Lesson plan sudah diisi" di Dashboard, dan `pendingLessonPlans` beserta test. Fitur ini sudah berguna tanpa Telegram.
3. **Bot & secrets** (developer, dipandu Claude): @BotFather, `supabase secrets set`.
4. **Fn `telegram-webhook`.** Menangani `/start <token>` dan callback tombol. Deploy, lalu daftarkan dengan `setWebhook`.
5. **App: Hubungkan Telegram.** Tombol di Settings membuat token, membuka `t.me/<bot>?start=<token>`, lalu menampilkan status.
6. **Fn `lesson-plan-reminder` + pg_cron** setiap 5 menit. Function hanya bekerja di 21:00–23:59 WIB, dicek di dalam function.
7. **Uji end-to-end** dengan data `[TEST]`, lalu bersihkan.

## Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| Webhook dipanggil pihak lain | Verifikasi header `X-Telegram-Bot-Api-Secret-Token`; `--no-verify-jwt` hanya untuk fungsi ini |
| Orang asing /start bot | Chat hanya di-link via token sekali pakai, kedaluwarsa 15 menit |
| Cron function dipanggil publik | Butuh JWT service role (default verify-jwt) |
| Spam berlipat kalau cron dobel | Satu job cron, nama unik, `cron.schedule` idempotent by name |
| Timezone salah | Hitung tanggal/jam WIB di function via `Intl` `Asia/Jakarta`, bukan UTC server |
| Realtime: kolom baru tak sampai ke app lain | Tabel sudah di publication realtime; update kolom ikut terkirim |

## Checkpoint verifikasi

- Setelah langkah 1: query `information_schema.columns` dan `pg_policies` menunjukkan kolom dan policy baru.
- Setelah langkah 2: `npm test`, `npm run lint`, `npm run build` lolos, dan screenshot toggle di Dashboard.
- Setelah langkah 4: `/start` dengan token palsu ditolak. Request tanpa secret mendapat 401.
- Setelah langkah 6: invoke manual mengirim pesan, tombol menghentikan pesan, lalu data `[TEST]` dihapus.
