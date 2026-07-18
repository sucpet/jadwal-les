import { describe, it, expect } from 'vitest';
import { ROW_H, timeToPixels, computeDayLayout, addOneHour, shiftDateByWeeks, dayOfWeek } from '../calendar';
import { xuYuanCycleStart, xuYuanCycleLabel, durationMinutes, formatDuration, formatRp } from '../xuyuan';
import { groupByMonth, groupByXuYuanCycle, totalDurationLabel, getPackageAttributedSessions } from '../student-groups';
import { getPackageStatus, getMonthlyRevenue } from '../helpers';
import type { LessonSession, SessionPackage, Student } from '../../types';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<LessonSession> = {}): LessonSession {
  return {
    id: 's1',
    studentId: 'stu1',
    teacherId: 'tea1',
    date: '2026-01-10',
    startTime: '09:00',
    endTime: '10:00',
    status: 'completed',
    createdAt: '2026-01-10T00:00:00Z',
    ...overrides,
  };
}

function makePackage(overrides: Partial<SessionPackage> = {}): SessionPackage {
  return {
    id: 'pkg1',
    studentId: 'stu1',
    teacherId: 'tea1',
    totalSessions: 8,
    pricingType: 'per-session',
    pricePerSession: 145_000,
    startDate: '2026-01-01',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeStudent(overrides: Partial<Student> = {}): Student {
  return {
    id: 'stu1',
    teacherId: 'tea1',
    name: 'Test Student',
    billingType: 'package',
    ratePerSession: 150_000,
    group: 'pribadi',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ─── calendar.ts ─────────────────────────────────────────────────────────────

describe('timeToPixels', () => {
  it('08:00 → 0 (grid start)', () => {
    expect(timeToPixels('08:00')).toBe(0);
  });

  it('08:30 → ROW_H (one slot)', () => {
    expect(timeToPixels('08:30')).toBe(ROW_H);
  });

  it('09:00 → 2 * ROW_H', () => {
    expect(timeToPixels('09:00')).toBe(2 * ROW_H);
  });

  it('10:15 → 4.5 slots', () => {
    expect(timeToPixels('10:15')).toBe(4.5 * ROW_H);
  });

  it('21:30 → last slot (27 slots from 08:00)', () => {
    expect(timeToPixels('21:30')).toBe(27 * ROW_H);
  });
});

describe('addOneHour', () => {
  it('09:00 → 10:00', () => expect(addOneHour('09:00')).toBe('10:00'));
  it('09:30 → 10:30', () => expect(addOneHour('09:30')).toBe('10:30'));
  it('21:00 → 22:00', () => expect(addOneHour('21:00')).toBe('22:00'));
  it('23:30 → 00:30 (wraps past midnight)', () => expect(addOneHour('23:30')).toBe('00:30'));
});

describe('shiftDateByWeeks', () => {
  it('0 weeks → same date', () => {
    expect(shiftDateByWeeks('2026-07-19', 0)).toBe('2026-07-19');
  });

  it('+1 week', () => {
    expect(shiftDateByWeeks('2026-07-19', 1)).toBe('2026-07-26');
  });

  it('-1 week', () => {
    expect(shiftDateByWeeks('2026-07-19', -1)).toBe('2026-07-12');
  });

  it('crosses month boundary', () => {
    expect(shiftDateByWeeks('2026-07-28', 1)).toBe('2026-08-04');
  });

  it('crosses year boundary', () => {
    expect(shiftDateByWeeks('2026-12-28', 1)).toBe('2027-01-04');
  });

  it('+4 weeks = 28 days', () => {
    expect(shiftDateByWeeks('2026-01-01', 4)).toBe('2026-01-29');
  });
});

describe('dayOfWeek', () => {
  it('2026-07-19 = Sunday (0)', () => expect(dayOfWeek('2026-07-19')).toBe(0));
  it('2026-07-20 = Monday (1)', () => expect(dayOfWeek('2026-07-20')).toBe(1));
  it('2026-07-25 = Saturday (6)', () => expect(dayOfWeek('2026-07-25')).toBe(6));
  it('2026-01-01 = Thursday (4)', () => expect(dayOfWeek('2026-01-01')).toBe(4));
});

describe('computeDayLayout', () => {
  it('empty → []', () => {
    expect(computeDayLayout([])).toEqual([]);
  });

  it('single session → colIndex=0, totalCols=1', () => {
    const result = computeDayLayout([makeSession({ startTime: '09:00', endTime: '10:00' })]);
    expect(result).toHaveLength(1);
    expect(result[0].colIndex).toBe(0);
    expect(result[0].totalCols).toBe(1);
  });

  it('two non-overlapping sessions → each gets colIndex=0, totalCols=1', () => {
    const sessions = [
      makeSession({ id: 'a', startTime: '09:00', endTime: '10:00' }),
      makeSession({ id: 'b', startTime: '10:00', endTime: '11:00' }), // adjacent, not overlapping
    ];
    const result = computeDayLayout(sessions);
    const byId = Object.fromEntries(result.map(r => [r.session.id, r]));
    expect(byId['a'].colIndex).toBe(0);
    expect(byId['a'].totalCols).toBe(1);
    expect(byId['b'].colIndex).toBe(0);
    expect(byId['b'].totalCols).toBe(1);
  });

  it('two overlapping sessions → colIndex=0 and 1, totalCols=2 each', () => {
    const sessions = [
      makeSession({ id: 'a', startTime: '09:00', endTime: '10:30' }),
      makeSession({ id: 'b', startTime: '09:30', endTime: '10:30' }),
    ];
    const result = computeDayLayout(sessions);
    const byId = Object.fromEntries(result.map(r => [r.session.id, r]));
    expect(byId['a'].colIndex).toBe(0);
    expect(byId['b'].colIndex).toBe(1);
    expect(byId['a'].totalCols).toBe(2);
    expect(byId['b'].totalCols).toBe(2);
  });

  it('three overlapping → three lanes', () => {
    const sessions = [
      makeSession({ id: 'a', startTime: '09:00', endTime: '10:30' }),
      makeSession({ id: 'b', startTime: '09:00', endTime: '10:30' }),
      makeSession({ id: 'c', startTime: '09:00', endTime: '10:30' }),
    ];
    const result = computeDayLayout(sessions);
    const cols = result.map(r => r.totalCols);
    expect(cols.every(c => c === 3)).toBe(true);
    const indices = new Set(result.map(r => r.colIndex));
    expect(indices).toEqual(new Set([0, 1, 2]));
  });

  it('A overlaps B, B overlaps C, A does not overlap C → A and C can share lane 0', () => {
    // A: 09:00-10:00, B: 09:30-10:30, C: 10:00-11:00
    // A and B overlap. B and C overlap. A and C are adjacent (not overlapping).
    const sessions = [
      makeSession({ id: 'a', startTime: '09:00', endTime: '10:00' }),
      makeSession({ id: 'b', startTime: '09:30', endTime: '10:30' }),
      makeSession({ id: 'c', startTime: '10:00', endTime: '11:00' }),
    ];
    const result = computeDayLayout(sessions);
    const byId = Object.fromEntries(result.map(r => [r.session.id, r]));
    // A takes lane 0, B takes lane 1, C can reuse lane 0 (A ends at 10:00 = C starts)
    expect(byId['a'].colIndex).toBe(0);
    expect(byId['b'].colIndex).toBe(1);
    expect(byId['c'].colIndex).toBe(0);
    // totalCols for each: A overlaps B → max lane among overlapping = 1, totalCols=2
    // B overlaps A and C → max lane = 1, totalCols=2
    // C overlaps B → max lane = 1, totalCols=2
    expect(byId['a'].totalCols).toBe(2);
    expect(byId['b'].totalCols).toBe(2);
    expect(byId['c'].totalCols).toBe(2);
  });
});

// ─── xuyuan.ts ───────────────────────────────────────────────────────────────

describe('xuYuanCycleStart', () => {
  it('day >= 26 → same month 26th', () => {
    expect(xuYuanCycleStart('2026-01-26')).toBe('2026-01-26');
    expect(xuYuanCycleStart('2026-01-31')).toBe('2026-01-26');
  });

  it('day < 26 → previous month 26th', () => {
    expect(xuYuanCycleStart('2026-01-25')).toBe('2025-12-26');
    expect(xuYuanCycleStart('2026-01-01')).toBe('2025-12-26');
    expect(xuYuanCycleStart('2026-07-19')).toBe('2026-06-26');
  });

  it('day = 26 exactly → current month', () => {
    expect(xuYuanCycleStart('2026-07-26')).toBe('2026-07-26');
  });

  it('January 25 → December 26 of previous year', () => {
    expect(xuYuanCycleStart('2026-01-25')).toBe('2025-12-26');
  });
});

describe('xuYuanCycleLabel', () => {
  it('formats range from 26th to 25th next month', () => {
    // 26 Jun → 25 Jul 2026
    const label = xuYuanCycleLabel('2026-06-26');
    expect(label).toContain('26');
    expect(label).toContain('Jun');
    expect(label).toContain('25');
    expect(label).toContain('Jul');
    expect(label).toContain('2026');
  });

  it('contains separator between start and end', () => {
    const label = xuYuanCycleLabel('2026-06-26');
    expect(label).toContain('–');
  });
});

describe('durationMinutes', () => {
  it('1 hour session = 60 min', () => {
    expect(durationMinutes(makeSession({ startTime: '09:00', endTime: '10:00' }))).toBe(60);
  });

  it('1.5 hour session = 90 min', () => {
    expect(durationMinutes(makeSession({ startTime: '09:00', endTime: '10:30' }))).toBe(90);
  });

  it('30 min session', () => {
    expect(durationMinutes(makeSession({ startTime: '09:00', endTime: '09:30' }))).toBe(30);
  });

  it('crosses hour boundary correctly', () => {
    expect(durationMinutes(makeSession({ startTime: '09:45', endTime: '10:15' }))).toBe(30);
  });
});

describe('formatDuration', () => {
  it('exactly hours → "X jam"', () => {
    expect(formatDuration(60)).toBe('1 jam');
    expect(formatDuration(120)).toBe('2 jam');
  });

  it('less than 1 hour → "X mnt"', () => {
    expect(formatDuration(30)).toBe('30 mnt');
    expect(formatDuration(45)).toBe('45 mnt');
  });

  it('hours and minutes → "X jam Y mnt"', () => {
    expect(formatDuration(90)).toBe('1 jam 30 mnt');
    expect(formatDuration(75)).toBe('1 jam 15 mnt');
  });

  it('0 minutes → "0 mnt"', () => {
    expect(formatDuration(0)).toBe('0 mnt');
  });
});

describe('formatRp', () => {
  it('formats with Rp prefix', () => {
    expect(formatRp(0)).toBe('Rp 0');
  });

  it('formats thousands with dot separator (id-ID locale)', () => {
    const result = formatRp(100_000);
    expect(result).toMatch(/^Rp /);
    expect(result).toContain('100');
  });

  it('negative number still formats', () => {
    const result = formatRp(-50_000);
    expect(result).toMatch(/^Rp /);
  });
});

// ─── student-groups.ts ───────────────────────────────────────────────────────

describe('groupByMonth', () => {
  it('empty → []', () => {
    expect(groupByMonth([])).toEqual([]);
  });

  it('sessions in same month → one group', () => {
    const sessions = [
      makeSession({ id: 'a', date: '2026-01-05' }),
      makeSession({ id: 'b', date: '2026-01-20' }),
    ];
    const groups = groupByMonth(sessions);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('2026-01');
    expect(groups[0].sessions).toHaveLength(2);
  });

  it('sessions in different months → sorted descending by month', () => {
    const sessions = [
      makeSession({ id: 'a', date: '2026-01-05' }),
      makeSession({ id: 'b', date: '2026-03-10' }),
      makeSession({ id: 'c', date: '2026-02-15' }),
    ];
    const groups = groupByMonth(sessions);
    expect(groups).toHaveLength(3);
    expect(groups[0].key).toBe('2026-03'); // newest first
    expect(groups[1].key).toBe('2026-02');
    expect(groups[2].key).toBe('2026-01');
  });

  it('sessions within a month are sorted ascending by date', () => {
    const sessions = [
      makeSession({ id: 'a', date: '2026-01-20' }),
      makeSession({ id: 'b', date: '2026-01-05' }),
      makeSession({ id: 'c', date: '2026-01-15' }),
    ];
    const groups = groupByMonth(sessions);
    expect(groups[0].sessions.map(s => s.date)).toEqual(['2026-01-05', '2026-01-15', '2026-01-20']);
  });

  it('label is formatted in Indonesian', () => {
    const sessions = [makeSession({ date: '2026-07-10' })];
    const groups = groupByMonth(sessions);
    expect(groups[0].label).toContain('Juli');
    expect(groups[0].label).toContain('2026');
  });
});

describe('groupByXuYuanCycle', () => {
  it('empty → []', () => {
    expect(groupByXuYuanCycle([])).toEqual([]);
  });

  it('sessions in same cycle → one group', () => {
    const sessions = [
      makeSession({ id: 'a', date: '2026-06-26' }),
      makeSession({ id: 'b', date: '2026-07-10' }),
      makeSession({ id: 'c', date: '2026-07-25' }),
    ];
    const groups = groupByXuYuanCycle(sessions);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('2026-06-26');
  });

  it('sessions straddling cycle boundary → two groups', () => {
    const sessions = [
      makeSession({ id: 'a', date: '2026-07-25' }), // cycle 2026-06-26
      makeSession({ id: 'b', date: '2026-07-26' }), // cycle 2026-07-26
    ];
    const groups = groupByXuYuanCycle(sessions);
    expect(groups).toHaveLength(2);
    expect(groups[0].key).toBe('2026-07-26'); // newest first
    expect(groups[1].key).toBe('2026-06-26');
  });

  it('label contains date range with –', () => {
    const sessions = [makeSession({ date: '2026-07-10' })];
    const groups = groupByXuYuanCycle(sessions);
    expect(groups[0].label).toContain('–');
  });
});

describe('totalDurationLabel', () => {
  it('empty → "0 mnt"', () => {
    expect(totalDurationLabel([])).toBe('0 mnt');
  });

  it('single 1h session → "1 jam"', () => {
    expect(totalDurationLabel([makeSession({ startTime: '09:00', endTime: '10:00' })])).toBe('1 jam');
  });

  it('two 1h sessions → "2 jam"', () => {
    const sessions = [
      makeSession({ id: 'a', startTime: '09:00', endTime: '10:00' }),
      makeSession({ id: 'b', startTime: '10:00', endTime: '11:00' }),
    ];
    expect(totalDurationLabel(sessions)).toBe('2 jam');
  });

  it('90 min total → "1 jam 30 mnt"', () => {
    const sessions = [
      makeSession({ id: 'a', startTime: '09:00', endTime: '10:30' }),
    ];
    expect(totalDurationLabel(sessions)).toBe('1 jam 30 mnt');
  });

  it('45 min total → "45 mnt"', () => {
    expect(totalDurationLabel([makeSession({ startTime: '09:00', endTime: '09:45' })])).toBe('45 mnt');
  });
});

describe('getPackageAttributedSessions', () => {
  it('single package → all student sessions attributed', () => {
    const pkg = makePackage({ totalSessions: 3 });
    const sessions = [
      makeSession({ id: 'a', date: '2026-01-01' }),
      makeSession({ id: 'b', date: '2026-01-05' }),
      makeSession({ id: 'c', date: '2026-01-10' }),
      makeSession({ id: 'd', date: '2026-01-15' }), // beyond totalSessions
    ];
    const result = getPackageAttributedSessions(pkg, [pkg], sessions);
    expect(result).toHaveLength(3);
    expect(result.map(s => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('second package starts where first ended', () => {
    const pkg1 = makePackage({ id: 'pkg1', totalSessions: 3, startDate: '2026-01-01' });
    const pkg2 = makePackage({ id: 'pkg2', totalSessions: 3, startDate: '2026-02-01' });
    const sessions = [
      makeSession({ id: 'a', date: '2026-01-01' }),
      makeSession({ id: 'b', date: '2026-01-05' }),
      makeSession({ id: 'c', date: '2026-01-10' }),
      makeSession({ id: 'd', date: '2026-02-01' }),
      makeSession({ id: 'e', date: '2026-02-05' }),
      makeSession({ id: 'f', date: '2026-02-10' }),
    ];
    const result1 = getPackageAttributedSessions(pkg1, [pkg1, pkg2], sessions);
    const result2 = getPackageAttributedSessions(pkg2, [pkg1, pkg2], sessions);
    expect(result1.map(s => s.id)).toEqual(['a', 'b', 'c']);
    expect(result2.map(s => s.id)).toEqual(['d', 'e', 'f']);
  });

  it('filters to only student sessions (not other students)', () => {
    const pkg = makePackage({ studentId: 'stu1', totalSessions: 2 });
    const sessions = [
      makeSession({ id: 'a', studentId: 'stu1', date: '2026-01-01' }),
      makeSession({ id: 'b', studentId: 'stu2', date: '2026-01-01' }), // different student
      makeSession({ id: 'c', studentId: 'stu1', date: '2026-01-05' }),
    ];
    const result = getPackageAttributedSessions(pkg, [pkg], sessions);
    expect(result.every(s => s.studentId === 'stu1')).toBe(true);
    expect(result).toHaveLength(2);
  });
});

// ─── helpers.ts — getPackageStatus ───────────────────────────────────────────

describe('getPackageStatus — isExpiringSoon', () => {
  it('1 remaining, 0 scheduled → isExpiringSoon = true', () => {
    const pkg = makePackage({ totalSessions: 8 });
    const sessions = Array.from({ length: 7 }, (_, i) =>
      makeSession({ id: `s${i}`, date: `2026-01-${String(i + 1).padStart(2, '0')}`, status: 'completed' })
    );
    const { isExpiringSoon, remainingSessions } = getPackageStatus(pkg, [pkg], sessions);
    expect(remainingSessions).toBe(1);
    expect(isExpiringSoon).toBe(true);
  });

  it('1 scheduled, 0 remaining → isExpiringSoon = true (last slot scheduled)', () => {
    const pkg = makePackage({ totalSessions: 8 });
    const sessions = [
      ...Array.from({ length: 7 }, (_, i) =>
        makeSession({ id: `s${i}`, date: `2026-01-${String(i + 1).padStart(2, '0')}`, status: 'completed' })
      ),
      makeSession({ id: 'sch', date: '2026-02-01', status: 'scheduled' }),
    ];
    const { isExpiringSoon, remainingSessions, scheduledSessions } = getPackageStatus(pkg, [pkg], sessions);
    expect(remainingSessions).toBe(0);
    expect(scheduledSessions).toBe(1);
    expect(isExpiringSoon).toBe(true);
  });

  it('2 remaining → isExpiringSoon = false', () => {
    const pkg = makePackage({ totalSessions: 8 });
    const sessions = Array.from({ length: 6 }, (_, i) =>
      makeSession({ id: `s${i}`, date: `2026-01-${String(i + 1).padStart(2, '0')}`, status: 'completed' })
    );
    const { isExpiringSoon } = getPackageStatus(pkg, [pkg], sessions);
    expect(isExpiringSoon).toBe(false);
  });

  it('not current package → isExpiringSoon always false', () => {
    const pkg1 = makePackage({ id: 'pkg1', totalSessions: 2, startDate: '2026-01-01' });
    const pkg2 = makePackage({ id: 'pkg2', totalSessions: 8, startDate: '2026-02-01' });
    const sessions = [
      makeSession({ id: 'a', date: '2026-01-01', status: 'completed' }),
      // pkg1 has 1/2 used, 1 remaining — but pkg1 is NOT current
    ];
    const { isExpiringSoon } = getPackageStatus(pkg1, [pkg1, pkg2], sessions);
    expect(isExpiringSoon).toBe(false);
  });
});

// ─── helpers.ts — getMonthlyRevenue ──────────────────────────────────────────

describe('getMonthlyRevenue', () => {
  it('per-session student → uses ratePerSession', () => {
    const student = makeStudent({ billingType: 'per-session', ratePerSession: 200_000 });
    const sessions = [
      makeSession({ date: '2026-01-10', status: 'completed' }),
      makeSession({ id: 's2', date: '2026-01-15', status: 'completed' }),
    ];
    const revenue = getMonthlyRevenue(sessions, [student], [], 'tea1', 2026, 0);
    expect(revenue).toBe(400_000);
  });

  it('only completed sessions count', () => {
    const student = makeStudent({ billingType: 'per-session', ratePerSession: 200_000 });
    const sessions = [
      makeSession({ id: 'a', date: '2026-01-10', status: 'completed' }),
      makeSession({ id: 'b', date: '2026-01-15', status: 'scheduled' }), // not counted
    ];
    const revenue = getMonthlyRevenue(sessions, [student], [], 'tea1', 2026, 0);
    expect(revenue).toBe(200_000);
  });

  it('wrong month sessions are excluded', () => {
    const student = makeStudent({ billingType: 'per-session', ratePerSession: 200_000 });
    const sessions = [
      makeSession({ id: 'a', date: '2026-01-10', status: 'completed' }), // Jan
      makeSession({ id: 'b', date: '2026-02-10', status: 'completed' }), // Feb — excluded
    ];
    const revenue = getMonthlyRevenue(sessions, [student], [], 'tea1', 2026, 0); // month=0 = January
    expect(revenue).toBe(200_000);
  });

  it('different teacher sessions are excluded', () => {
    const student = makeStudent({ billingType: 'per-session', ratePerSession: 200_000 });
    const sessions = [
      makeSession({ id: 'a', date: '2026-01-10', status: 'completed', teacherId: 'tea1' }),
      makeSession({ id: 'b', date: '2026-01-15', status: 'completed', teacherId: 'tea2' }),
    ];
    const revenue = getMonthlyRevenue(sessions, [student], [], 'tea1', 2026, 0);
    expect(revenue).toBe(200_000);
  });

  it('package student uses pricePerSession from package', () => {
    const student = makeStudent({ billingType: 'package', ratePerSession: 150_000 });
    const pkg = makePackage({ pricePerSession: 145_000 });
    const sessions = [makeSession({ date: '2026-01-10', status: 'completed' })];
    const revenue = getMonthlyRevenue(sessions, [student], [pkg], 'tea1', 2026, 0);
    expect(revenue).toBe(145_000);
  });

  it('unknown student → 0 contribution', () => {
    const sessions = [makeSession({ date: '2026-01-10', status: 'completed', studentId: 'unknown' })];
    const revenue = getMonthlyRevenue(sessions, [], [], 'tea1', 2026, 0);
    expect(revenue).toBe(0);
  });
});
