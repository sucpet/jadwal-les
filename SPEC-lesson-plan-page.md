# Spec: Halaman Lesson Plan (murid non-XuYuan)

Status: **DISETUJUI** (2026-10-08)

## Objective

Murid non-XuYuan (grup `pribadi` dan `wenwen_aizhongwen`) tidak punya GSheet lembaga untuk lesson plan. Kolom Notes per sesi juga tersebar dan sulit dibaca berurutan. Halaman ini menyediakan satu tempat untuk mencatat **apa yang dipelajari di setiap sesi**, dan membacanya berurutan per murid sebelum les berikutnya.

**Pengguna:** owner (Calvin, WenWen). Keduanya melihat semua murid. Peran guru dengan akses terbatas di luar cakupan (backlog #4 di `feature.md`).

**Alur:**
1. More (HP) / sidebar (desktop) → **Lesson Plan** → daftar murid non-XuYuan.
2. Ketuk nama murid → semua sesi yang sudah lewat, terbaru di atas, dikelompokkan per bulan.
3. Setiap sesi punya kotak teks. Catatan tersimpan otomatis saat kotak ditinggalkan (blur).

### Acceptance criteria

- **Daftar murid**
  - Hanya murid aktif dengan grup `pribadi` / `wenwen_aizhongwen` yang punya minimal satu sesi yang sudah lewat.
  - Dikelompokkan per grup, seperti halaman Murid.
  - Setiap kartu menampilkan nama, warna dan nama Laoshi, tanggal sesi terakhir, dan badge **⚠ N belum diisi** atau **✓ semua terisi**.
  - Dalam satu grup, murid dengan sesi belum diisi tampil di atas, sisanya urut nama.
  - Ada pencarian nama murid dan filter chip per Laoshi (All / per guru).
- **Detail murid**
  - Header: nama, Laoshi, grup, jumlah sesi.
  - Sesi dikelompokkan per bulan, terbaru di atas.
  - Setiap sesi: label `EEE, d MMM · HH:MM–HH:MM` dan textarea.
  - Textarea kosong diberi border kuning.
  - Setelah tersimpan, muncul "✓ Tersimpan" sebentar.
- **Layout**
  - HP: dua layar (daftar → detail), dengan tombol ← kembali.
  - Desktop (≥ md): dua kolom, daftar di kiri dan detail murid terpilih di kanan.
  - URL `/lesson-plan?student=<id>` membuka detail langsung.
- **Simpan**
  - `updateSession(id, { lessonPlan })` saat blur, hanya kalau teks berubah.
  - Teks kosong disimpan sebagai `null`.
  - Perubahan dari perangkat lain masuk lewat realtime yang sudah ada.

## Tech Stack

React 19, TypeScript, Vite, Tailwind v4, Supabase (pola `AppContext` yang sudah ada). Tidak ada dependency baru.

## Commands

```
Dev:    npm run dev
Test:   npm test
Single: npx vitest run src/utils/__tests__/lessonPlan.test.ts
Lint:   npm run lint
Build:  npm run build
```

## Project Structure

```
migrations/2026-10-08-session-lesson-plan.sql → sessions.lesson_plan text
src/types/index.ts                            → LessonSession.lessonPlan?: string
src/store/AppContext.tsx                      → DbSession, mapSession, toDbSession, updateSession row
src/utils/lessonPlan.ts                       → helper murni (lihat Code Style)
src/utils/__tests__/lessonPlan.test.ts        → test helper
src/pages/LessonPlan.tsx                      → halaman baru
src/App.tsx                                   → load map, lazy, <Route path="/lesson-plan">
src/components/Layout.tsx                     → navItems (setelah Schedule → otomatis di "More" di HP)
src/i18n/translations.ts                      → kunci `lpn.*` (id + en)
```

## Data Model (perubahan schema, perlu persetujuan)

- `sessions.lesson_plan text` (nullable). Isi catatan "apa yang dipelajari".
  - Terpisah dari `sessions.notes`, yang tetap dipakai form sesi.
  - Terpisah dari `sessions.lesson_plan_done_at`, yaitu flag XuYuan untuk pengingat Telegram.
- Tidak ada perubahan RLS. Tabel `sessions` sudah `auth_all` untuk `authenticated`.

## Code Style

Logika murni di `src/utils/` diuji dengan vitest, dan halaman hanya merangkai helper:

```ts
// src/utils/lessonPlan.ts
// Sesi yang sudah lewat (tanggal+jam selesai <= sekarang), terbaru dulu.
export function pastSessions(sessions: LessonSession[], studentId: string, today: string, nowHHMM: string) {
  return sessions
    .filter(s => s.studentId === studentId && (s.date < today || (s.date === today && s.endTime <= nowHHMM)))
    .sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime));
}
```

Ikuti pola yang ada: string UI lewat `t()`, `formatDate`/`date-fns` dengan `locale`, dark mode via kelas `dark:`, dan mobile mengikuti `--nav-h`.

## Testing Strategy

- **Unit (vitest)** di `src/utils/__tests__/lessonPlan.test.ts`:
  - `pastSessions`: murid lain, sesi besok, sesi hari ini yang belum selesai, dan urutan.
  - Ringkasan per murid (jumlah belum diisi, sesi terakhir): teks hanya spasi dihitung belum diisi.
  - Filter grup: XuYuan dikecualikan.
- **Manual (Playwright, ukuran iPhone 15 Pro dan desktop 1920×1080), read-only:**
  - Daftar, detail, tombol kembali, filter, dan pencarian.
  - Uji simpan hanya di sesi milik guru `[TEST] sucpet` (data test milik user), lalu kembalikan ke kosong.
- `npm test`, `npm run lint`, `npm run build` lolos.

## Boundaries

- **Always:**
  - Kunci i18n untuk `id` dan `en`.
  - Data asli tidak diubah saat pengujian. Uji simpan hanya di sesi `[TEST]`.
  - Tidak ada horizontal scroll di 393px.
- **Ask first:**
  - Menjalankan migrasi di project asli.
  - Push ke `master` (memicu deploy Vercel).
- **Never:**
  - Memakai atau memindahkan isi `sessions.notes`.
  - Mengubah perilaku pengingat XuYuan.
  - Membatasi akses per guru (itu backlog #4).

## Success Criteria

1. Dari halaman Lesson Plan, owner bisa membuka murid non-XuYuan mana pun dan membaca semua catatan sesi lampau berurutan, terbaru di atas.
2. Catatan yang diketik tersimpan setelah textarea ditinggalkan, tetap ada setelah reload, dan tampil di perangkat lain tanpa reload (realtime).
3. Badge "N belum diisi" sesuai jumlah sesi lampau yang catatannya kosong, dan langsung berubah setelah diisi.
4. Murid XuYuan tidak muncul di halaman ini.
5. Tampil rapi di iPhone 15 Pro (tidak melebar, tidak tertutup nav) dan di desktop (dua kolom).
6. Test, lint, dan build lolos.

## Out of Scope

- Murid XuYuan.
- Peran guru dan pembatasan akses.
- Pengingat Telegram untuk lesson plan ini.
- Membagikan catatan ke orang tua.
- Memindahkan isi kolom Notes lama.
- Catatan untuk sesi yang belum terjadi.

## Keputusan

1. Murid non-aktif disembunyikan.
2. Pengisian lesson plan tidak dicatat di Log Aktivitas.
3. Hanya sesi mulai **2026-10-08** (hari fitur dirilis) yang dihitung "belum diisi" dan diberi garis kuning (`LESSON_PLAN_START`). Sesi lama tetap tampil dan bisa diisi.
