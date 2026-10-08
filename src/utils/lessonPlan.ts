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

// ─── Halaman Lesson Plan (murid non-XuYuan) ───────────────────────────────────

// Murid yang punya halaman lesson plan di app: aktif dan bukan XuYuan (XuYuan mengisi di GSheet lembaga).
export const isLessonPlanStudent = (s: Student) => s.isActive && s.group !== 'xuyuan';

// Sesi murid yang sudah lewat (tanggal + jam selesai <= sekarang), terbaru dulu. Status sesi tidak dipakai.
export function pastSessions(sessions: LessonSession[], studentId: string, today: string, nowHHMM: string): LessonSession[] {
  return sessions
    .filter(s => s.studentId === studentId && (s.date < today || (s.date === today && s.endTime <= nowHHMM)))
    .sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime));
}

export const hasLessonPlan = (s: LessonSession) => !!s.lessonPlan?.trim();

// Ringkasan per murid untuk daftar: jumlah sesi lampau, berapa yang belum diisi, tanggal sesi terakhir.
export function lessonPlanSummary(past: LessonSession[]) {
  return { total: past.length, empty: past.filter(s => !hasLessonPlan(s)).length, lastDate: past[0]?.date };
}
