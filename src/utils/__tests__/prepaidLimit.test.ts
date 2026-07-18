import { describe, it, expect } from 'vitest';
import { getPackageStatus } from '../helpers';
import type { SessionPackage, LessonSession } from '../../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePkg(overrides: Partial<SessionPackage> = {}): SessionPackage {
  return {
    id: 'pkg1',
    studentId: 'student1',
    teacherId: 'teacher1',
    totalSessions: 8,
    pricingType: 'per-session',
    pricePerSession: 145000,
    startDate: '2026-01-01',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeSession(overrides: Partial<LessonSession> = {}): LessonSession {
  return {
    id: Math.random().toString(36).slice(2),
    studentId: 'student1',
    teacherId: 'teacher1',
    date: '2026-01-10',
    startTime: '09:00',
    endTime: '10:00',
    status: 'completed',
    createdAt: '2026-01-10T00:00:00Z',
    ...overrides,
  };
}

function makeSessions(count: number, status: 'completed' | 'scheduled' = 'completed'): LessonSession[] {
  return Array.from({ length: count }, (_, i) =>
    makeSession({
      id: `s${i}`,
      date: `2026-01-${String(10 + i).padStart(2, '0')}`,
      status,
    })
  );
}

// ─── getPackageStatus — remainingSessions ─────────────────────────────────────

describe('getPackageStatus — remainingSessions', () => {
  it('paket belum terpakai: remaining = totalSessions', () => {
    const pkg = makePkg({ totalSessions: 8 });
    const { remainingSessions } = getPackageStatus(pkg, [pkg], []);
    expect(remainingSessions).toBe(8);
  });

  it('paket sebagian terpakai: remaining berkurang', () => {
    const pkg = makePkg({ totalSessions: 8 });
    const sessions = makeSessions(5, 'completed');
    const { remainingSessions } = getPackageStatus(pkg, [pkg], sessions);
    expect(remainingSessions).toBe(3);
  });

  it('paket habis (semua completed): remaining = 0', () => {
    const pkg = makePkg({ totalSessions: 8 });
    const sessions = makeSessions(8, 'completed');
    const { remainingSessions, isExpired } = getPackageStatus(pkg, [pkg], sessions);
    expect(remainingSessions).toBe(0);
    expect(isExpired).toBe(true);
  });

  it('scheduled sessions juga menempati slot: remaining berkurang', () => {
    const pkg = makePkg({ totalSessions: 8 });
    const sessions = [
      ...makeSessions(5, 'completed'),
      ...makeSessions(2, 'scheduled').map((s, i) => ({ ...s, id: `sch${i}`, date: `2026-02-0${i + 1}` })),
    ];
    const { remainingSessions, scheduledSessions } = getPackageStatus(pkg, [pkg], sessions);
    expect(scheduledSessions).toBe(2);
    expect(remainingSessions).toBe(1); // 8 - 5 completed - 2 scheduled = 1
  });

  it('paket penuh (completed + scheduled = total): remaining = 0', () => {
    const pkg = makePkg({ totalSessions: 8 });
    const sessions = [
      ...makeSessions(6, 'completed'),
      ...makeSessions(2, 'scheduled').map((s, i) => ({ ...s, id: `sch${i}`, date: `2026-02-0${i + 1}` })),
    ];
    const { remainingSessions } = getPackageStatus(pkg, [pkg], sessions);
    expect(remainingSessions).toBe(0);
  });
});

// ─── prepaidOverLimit — logika di Schedule.tsx ────────────────────────────────

/**
 * Replika logika Schedule.tsx setelah fix:
 *   const prepaidOverLimit = isPrepaid && remainingPkgSessions !== null && (
 *     recurring ? recurringCountNum > remainingPkgSessions : remainingPkgSessions === 0
 *   );
 */
function calcPrepaidOverLimit(
  isPrepaid: boolean,
  remainingPkgSessions: number | null,
  recurring: boolean,
  recurringCountNum: number,
): boolean {
  return isPrepaid && remainingPkgSessions !== null && (
    recurring ? recurringCountNum > remainingPkgSessions : remainingPkgSessions === 0
  );
}

describe('prepaidOverLimit — single session', () => {
  it('paket habis → blocked', () => {
    expect(calcPrepaidOverLimit(true, 0, false, 1)).toBe(true);
  });

  it('paket masih ada sesi → tidak blocked', () => {
    expect(calcPrepaidOverLimit(true, 3, false, 1)).toBe(false);
  });

  it('postpaid student → tidak blocked', () => {
    expect(calcPrepaidOverLimit(false, 0, false, 1)).toBe(false);
  });

  it('remainingPkgSessions null (belum ada paket) → tidak blocked', () => {
    expect(calcPrepaidOverLimit(true, null, false, 1)).toBe(false);
  });
});

describe('prepaidOverLimit — recurring', () => {
  it('recurring 5x, sisa 3 → blocked', () => {
    expect(calcPrepaidOverLimit(true, 3, true, 5)).toBe(true);
  });

  it('recurring 3x, sisa 3 → tidak blocked (pas)', () => {
    expect(calcPrepaidOverLimit(true, 3, true, 3)).toBe(false);
  });

  it('recurring 2x, sisa 3 → tidak blocked', () => {
    expect(calcPrepaidOverLimit(true, 3, true, 2)).toBe(false);
  });

  it('recurring 1x, paket habis (sisa 0) → blocked', () => {
    expect(calcPrepaidOverLimit(true, 0, true, 1)).toBe(true);
  });
});

// ─── Skenario bug: editSession mempengaruhi remaining? ───────────────────────

describe('getPackageStatus saat edit sesi yang ada di paket', () => {
  it('sesi yang sedang diedit masih terhitung dalam remaining — bisa jadi false negative', () => {
    const pkg = makePkg({ totalSessions: 8 });
    const sessions = makeSessions(8, 'completed');
    const { remainingSessions } = getPackageStatus(pkg, [pkg], sessions);
    expect(remainingSessions).toBe(0);
  });
});

// ─── Integration: mirror kode Schedule.tsx ───────────────────────────────────

/**
 * Replika persis logika Schedule.tsx:
 *   - currentPkg = pkg terbaru (sort descending startDate → [0])
 *   - remainingPkgSessions = getPackageStatus(currentPkg, studentPkgs, sessions).remainingSessions
 *   - prepaidOverLimit = isPrepaid && remaining !== null && (recurring ? count > remaining : remaining === 0)
 */
function scheduleCanSave(opts: {
  billingType: 'per-session' | 'package';
  packages: SessionPackage[];
  sessions: LessonSession[];
  recurring: boolean;
  recurringCountNum: number;
}): boolean {
  const { billingType, packages, sessions, recurring, recurringCountNum } = opts;
  const isPrepaid = billingType === 'package';

  let remainingPkgSessions: number | null = null;
  if (isPrepaid && packages.length > 0) {
    const currentPkg = [...packages].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
    remainingPkgSessions = getPackageStatus(currentPkg, packages, sessions).remainingSessions;
  }

  const prepaidOverLimit = isPrepaid && remainingPkgSessions !== null && (
    recurring ? recurringCountNum > remainingPkgSessions : remainingPkgSessions === 0
  );

  return !prepaidOverLimit;
}

describe('scheduleCanSave — integration mirror Schedule.tsx', () => {
  it('postpaid student: selalu bisa tambah', () => {
    expect(scheduleCanSave({ billingType: 'per-session', packages: [], sessions: [], recurring: false, recurringCountNum: 1 })).toBe(true);
  });

  it('prepaid, paket habis, single session: TIDAK bisa tambah', () => {
    const pkg = makePkg({ totalSessions: 8 });
    const sessions = makeSessions(8, 'completed');
    expect(scheduleCanSave({ billingType: 'package', packages: [pkg], sessions, recurring: false, recurringCountNum: 1 })).toBe(false);
  });

  it('prepaid, paket habis, recurring 1x: TIDAK bisa tambah', () => {
    const pkg = makePkg({ totalSessions: 8 });
    const sessions = makeSessions(8, 'completed');
    expect(scheduleCanSave({ billingType: 'package', packages: [pkg], sessions, recurring: true, recurringCountNum: 1 })).toBe(false);
  });

  it('prepaid, sisa 2, single session: bisa tambah', () => {
    const pkg = makePkg({ totalSessions: 8 });
    const sessions = makeSessions(6, 'completed');
    expect(scheduleCanSave({ billingType: 'package', packages: [pkg], sessions, recurring: false, recurringCountNum: 1 })).toBe(true);
  });

  it('prepaid, 2 paket: paket lama habis, paket baru masih ada slot', () => {
    const pkgOld = makePkg({ id: 'pkg1', totalSessions: 8, startDate: '2026-01-01' });
    const pkgNew = makePkg({ id: 'pkg2', totalSessions: 8, startDate: '2026-07-01' });
    const sessions = makeSessions(8, 'completed'); // semua slot pkgOld terpakai
    // currentPkg = pkgNew (terbaru), slotnya belum terpakai → remaining = 8
    expect(scheduleCanSave({ billingType: 'package', packages: [pkgOld, pkgNew], sessions, recurring: false, recurringCountNum: 1 })).toBe(true);
  });

  it('prepaid, paket penuh (scheduled bukan completed): TIDAK bisa tambah', () => {
    const pkg = makePkg({ totalSessions: 8 });
    const sessions = [
      ...makeSessions(6, 'completed'),
      ...makeSessions(2, 'scheduled').map((s, i) => ({ ...s, id: `sch${i}`, date: `2026-03-0${i + 1}` })),
    ];
    // 6 completed + 2 scheduled = 8 = full, remaining = 0
    expect(scheduleCanSave({ billingType: 'package', packages: [pkg], sessions, recurring: false, recurringCountNum: 1 })).toBe(false);
  });

  it('prepaid, belum punya paket (packages kosong): remaining = null → bisa tambah', () => {
    // Kasus edge: student punya billingType package tapi belum ada paket sama sekali
    expect(scheduleCanSave({ billingType: 'package', packages: [], sessions: [], recurring: false, recurringCountNum: 1 })).toBe(true);
  });
});
