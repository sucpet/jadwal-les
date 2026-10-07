import { describe, it, expect } from 'vitest';
import { pendingLessonPlans } from '../lessonPlan';
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
