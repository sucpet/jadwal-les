# Jadwal Les

PWA manajemen les: jadwal sesi, guru (Laoshi), murid, paket prabayar, worksheet, pembayaran, honor & keuangan. Bilingual (English / Indonesia).

Stack: React 19 + TypeScript + Vite + Tailwind v4, Supabase (DB, auth, realtime, storage), deploy di Vercel.

## Setup

```bash
npm install
```

Buat `.env.local`:

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

## Perintah

```bash
npm run dev      # dev server
npm run build    # type-check + build production
npm run lint     # oxlint
npm test         # vitest
```

## Database

- `migrations/`: perubahan schema bertahap, dijalankan manual di Supabase SQL Editor sesuai urutan tanggal.
- Storage bucket `backups`: backup JSON harian otomatis dari aplikasi.
- Import data awal: `node scripts/seed-data.mjs` menghasilkan `scripts/import-data.json`, lalu import lewat halaman Settings.

## Dokumen

- `feature.md`, `future-feat.md`: backlog fitur
- `student-portal.md`: rencana portal murid + pembayaran Midtrans
- `CLAUDE.md`: panduan arsitektur untuk Claude Code
