import { describe, it, expect } from 'vitest';
import { pendingLessonPlans, pastSessions, lessonPlanSummary, isLessonPlanStudent, LESSON_PLAN_START, isRecentMonth } from '../lessonPlan';
import type { LessonSession, Student } from '../../types';

const stu = (id: string, group: Student['group']): Student =>
  ({ id, teacherId: 't1', name: id, billingType: 'per-session', ratePerSession: 0, group, isActive: true, createdAt: '' });
const ses = (id: string, o: Partial<LessonSession>): LessonSession =>
  ({ id, studentId: 'xy', teacherId: 't1', date: '2026-10-07', startTime: '19:00', endTime: '20:00', status: 'completed', createdAt: '', ...o });

describe('pendingLessonPlans', () => {
  const students = [stu('xy', 'xuyuan'), stu('pr', 'pribadi')];
  const sessions = [
    ses('due', {}),                                                  // ✓ XuYuan, hari ini, selesai, belum diisi
    ses('done', { lessonPlanDoneAt: '2026-10-07T13:00:00Z' }),       // sudah ditandai
    ses('pribadi', { studentId: 'pr' }),                             // bukan XuYuan
    ses('tomorrow', { date: '2026-10-08' }),                         // beda hari
    ses('running', { startTime: '20:30', endTime: '21:30', status: 'scheduled' }), // belum selesai pada 21:00
  ];

  it('only finished, unmarked XuYuan sessions of today', () => {
    expect(pendingLessonPlans(sessions, students, '2026-10-07', '21:00').map(s => s.id)).toEqual(['due']);
  });

  it('session ending after 21:00 becomes due once its end time passes', () => {
    expect(pendingLessonPlans(sessions, students, '2026-10-07', '21:30').map(s => s.id)).toEqual(['due', 'running']);
  });
});

describe('lesson plan page helpers', () => {
  const sessions = [
    ses('old', { date: '2026-10-01', startTime: '10:00', endTime: '11:00', lessonPlan: 'HSK 2 bab 4' }),
    ses('blank', { date: '2026-10-05', startTime: '10:00', endTime: '11:00', lessonPlan: '   ' }),
    ses('todayDone', { date: '2026-10-07', startTime: '09:00', endTime: '10:00' }),
    ses('todayLater', { date: '2026-10-07', startTime: '19:00', endTime: '20:00', status: 'scheduled' }),
    ses('tomorrow', { date: '2026-10-08' }),
    ses('other', { studentId: 'someone-else', date: '2026-10-02' }),
  ];

  it('pastSessions: own student, already ended, newest first', () => {
    expect(pastSessions(sessions, 'xy', '2026-10-07', '12:00').map(s => s.id)).toEqual(['todayDone', 'blank', 'old']);
  });

  it('lessonPlanSummary: only sessions from LESSON_PLAN_START count as empty; whitespace = empty', () => {
    expect(LESSON_PLAN_START).toBe('2026-10-08');
    // Semua sesi fixture sebelum tanggal mulai → tidak ada yang dihitung belum diisi.
    expect(lessonPlanSummary(pastSessions(sessions, 'xy', '2026-10-07', '12:00'))).toEqual({ total: 3, empty: 0, lastDate: '2026-10-07' });
    const after = [
      ses('a', { date: '2026-10-08', lessonPlan: '  ' }),
      ses('b', { date: '2026-10-09', lessonPlan: 'bab 5' }),
      ses('c', { date: '2026-10-10' }),
    ];
    expect(lessonPlanSummary(pastSessions(after, 'xy', '2026-10-11', '00:00'))).toEqual({ total: 3, empty: 2, lastDate: '2026-10-10' });
    expect(lessonPlanSummary([])).toEqual({ total: 0, empty: 0, lastDate: undefined });
  });

  it('isLessonPlanStudent: active non-XuYuan only', () => {
    expect(isLessonPlanStudent(stu('a', 'pribadi'))).toBe(true);
    expect(isLessonPlanStudent(stu('b', 'wenwen_aizhongwen'))).toBe(true);
    expect(isLessonPlanStudent(stu('c', 'xuyuan'))).toBe(false);
    expect(isLessonPlanStudent({ ...stu('d', 'pribadi'), isActive: false })).toBe(false);
  });
});

describe('isRecentMonth', () => {
  it('current and previous month open, older closed', () => {
    expect(isRecentMonth('2026-10', '2026-10-08')).toBe(true);
    expect(isRecentMonth('2026-09', '2026-10-08')).toBe(true);
    expect(isRecentMonth('2026-08', '2026-10-08')).toBe(false);
  });
  it('January wraps to previous December', () => {
    expect(isRecentMonth('2026-12', '2027-01-03')).toBe(true);
    expect(isRecentMonth('2026-11', '2027-01-03')).toBe(false);
  });
});
