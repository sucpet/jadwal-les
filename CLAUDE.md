# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Jadwal Les: a single-user/admin PWA for running a tutoring business. It tracks teachers ("Laoshi"), students, lesson sessions, packages, worksheets, payments, and finance/honor. Built with React 19, TypeScript, Vite, Tailwind v4, and Supabase. Deployed on Vercel as an SPA (`vercel.json` rewrites everything to `index.html`). Code comments and domain terms are mostly Indonesian.

## Commands

```bash
npm run dev        # Vite dev server
npm run build      # tsc -b && vite build (type errors fail the build)
npm run lint       # oxlint (.oxlintrc.json)
npm test           # vitest run (node environment)
npx vitest run src/utils/__tests__/whatsapp.test.ts   # single file
npx vitest run -t "effectiveRate"                     # filter by test name
```

Needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the env (`src/lib/supabase.ts`).

Tests only cover the pure functions in `src/utils/`. There are no component tests.

## Architecture

**Data layer: `src/store/AppContext.tsx` is the core of the app.**
- On mount it loads every table in full (`teachers`, `students`, `packages`, `sessions`, `worksheets`, `payments`, `schedule_notes`) into a single `AppData` object held in React state. Pages read from `useApp().data` and filter in memory. Pages never query Supabase directly for these tables.
- Mutations are optimistic. `setData` runs first, then a fire-and-forget Supabase write goes through the `db()` helper, which only logs errors. Failed writes are not rolled back.
- DB rows are snake_case and app types are camelCase. Each table has `mapX` (DB → app) and `toDbX` (app → DB) mappers in the same file. A new column needs: the `Db*` interface, both mappers, the partial-update row building in `updateX`, the type in `src/types/index.ts`, and a SQL file in `migrations/`.
- A Supabase realtime channel subscribes to `postgres_changes` on every table and merges changes into state. INSERT handlers de-dupe by id because optimistic inserts already exist locally.
- Mutations call `logActivity(...)`, which writes to the `activity_log` table shown on `/log`.
- Timers run in the client:
  - Sessions whose end time has passed are auto-marked `completed`. This check runs every :00 and :30.
  - When a session completes, `rateSnapshot` (postpaid students only) and `honorSnapshot` are frozen.
  - `pendingRate` and `pendingHonor` are promoted once their effective date arrives.
  - `autoBackup` uploads a JSON dump to the Supabase storage bucket `backups` once per day.

**Pricing rules (`src/utils/helpers.ts`)**
- `effectiveRate` and `effectiveHonor` resolve scheduled price changes by date. Finance code should use the snapshots on completed sessions, falling back to these functions.
- `billingType` is either `per-session` (postpaid) or `package` (prepaid, via `SessionPackage`). `getPackageStatus` and `student-groups.ts` decide which sessions count against which package.
- `deferredPayment` students are paid by an institution. Their revenue is recognized when a `Payment` is recorded, not when a session completes (see `pages/Finance.tsx`).
- The `xuyuan` student group bills on a cycle from the 26th to the 25th (`utils/xuyuan.ts`). Other groups bill by calendar month.

**App shell (`src/App.tsx`)**
- Supabase auth gate. After 5 hours the user is force-logged-out (`jadwal-les-login-at` in localStorage).
- Provider order: Theme → Language → Confirm → Toast → Holiday → (after login) AppProvider → Router → Layout.
- Pages are lazy-loaded through the `load` map and prefetched when the browser is idle. A new page needs entries in `load`, `lazy(...)`, `<Route>`, and the nav in `components/Layout.tsx`.

**Other contexts**
- `useLang().t(key, vars)` is the i18n helper, backed by `src/i18n/translations.ts`. It covers `id` and `en`, defaults to `en`, falls back to `id`, then to the key itself, and interpolates `{var}`. All UI strings go through `t()`. Add each new key to both languages. Keep the terms Laoshi, XuYuan, and WenWen untranslated.
- `useConfirm()` and `useToast()` replace `window.confirm` and alerts.
- `useHolidays()` provides national holidays for schedule warnings.

**Large pages**
- `pages/Schedule.tsx`: week/day calendar grid with drag-and-drop reschedule, conflict detection, and schedule notes overlay. Grid math lives in `utils/calendar.ts` (`ROW_H` = one 30-minute slot).
- `pages/Students.tsx`

**Database**
- `migrations/0000-base-schema.sql` is a `pg_dump --schema-only` snapshot of the `public` schema: tables, RLS policies, and grants. The other `migrations/*.sql` files are incremental `alter`s, dated by filename. All of them are applied manually to Supabase because the repo has no migration runner. After changing the schema, refresh the snapshot by re-running `pg_dump` against the Session pooler URI (the direct host is IPv6-only).

**Scripts**
- `scripts/seed-data.mjs` generates `scripts/import-data.json`. That file is imported through the Settings page (restore/import JSON).

## Docs in repo

- `feature.md` and `future-feat.md`: feature backlog with done, planned, and rejected items (Indonesian).
- `student-portal.md`: plan for a future student portal with Midtrans payments.
