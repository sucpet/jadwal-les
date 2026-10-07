import type { LessonSession, Student } from '../types';

// Sesi XuYuan hari `today` (YYYY-MM-DD) yang sudah selesai (endTime <= nowHHMM) dan lesson plan-nya belum diisi.
// Logika yang sama disalin di supabase/functions/lesson-plan-reminder — ubah keduanya bersamaan.
export function pendingLessonPlans(sessions: LessonSession[], students: Student[], today: string, nowHHMM: string): LessonSession[] {
  const xuyuan = new Set(students.filter(s => s.group === 'xuyuan').map(s => s.id));
  return sessions.filter(s =>
    xuyuan.has(s.studentId) && s.date === today && s.endTime <= nowHHMM && !s.lessonPlanDoneAt);
}

export const isXuYuanSession = (s: LessonSession, students: Student[]) =>
  students.find(st => st.id === s.studentId)?.group === 'xuyuan';
