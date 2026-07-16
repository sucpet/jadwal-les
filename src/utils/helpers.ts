import { format, addDays, parseISO, isSameDay, isBefore, differenceInDays } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import type { LessonSession, SessionPackage, Student } from '../types';

export function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function formatDate(date: string | Date, fmt = 'd MMM yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, fmt, { locale: localeId });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
}


export interface PackageStatus {
  pkg: SessionPackage;
  usedSessions: number;        // sesi selesai (completed)
  scheduledSessions: number;   // sesi terjadwal yang sudah menempati slot paket ini
  remainingSessions: number;   // slot kosong = total - completed - scheduled
  estimatedEndDate: Date | null;
  isExpiringSoon: boolean;     // sisa slot <= 2
  isExpired: boolean;          // semua sesi selesai (usedSessions >= totalSessions)
  isCurrent: boolean;
}

/**
 * Atribusikan sesi ke paket secara kumulatif berdasarkan urutan tanggal.
 * Paket ke-i mendapat slot [slotStart, slotEnd) dari semua sesi student (urut tanggal),
 * bukan berdasarkan rentang tanggal kalender — sehingga sisa slot paket lama
 * tetap dapat dikonsumsi oleh sesi-sesi di bulan berikutnya.
 */
export function getPackageStatus(
  pkg: SessionPackage,
  allStudentPackages: SessionPackage[],
  sessions: LessonSession[]
): PackageStatus {
  const sorted = [...allStudentPackages].sort(
    (a, b) => a.startDate.localeCompare(b.startDate)
  );
  const idx = sorted.findIndex(p => p.id === pkg.id);
  const isCurrent = idx === sorted.length - 1;

  // Slot kumulatif: paket ini menempati posisi [slotStart, slotEnd)
  const slotStart = sorted.slice(0, idx).reduce((sum, p) => sum + p.totalSessions, 0);
  const slotEnd = slotStart + pkg.totalSessions;

  // Semua sesi aktif (non-cancelled) student, urut tanggal
  const activeSessions = sessions
    .filter(s => s.studentId === pkg.studentId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  const attributed = activeSessions.slice(slotStart, slotEnd);
  const usedSessions = attributed.filter(s => s.status === 'completed').length;
  const scheduledSessions = attributed.filter(s => s.status === 'scheduled').length;
  const remainingSessions = Math.max(0, pkg.totalSessions - usedSessions - scheduledSessions);
  const isExpired = usedSessions >= pkg.totalSessions;

  let estimatedEndDate: Date | null = null;
  if (!isExpired && isCurrent) {
    const completedDates = sessions
      .filter(s => s.studentId === pkg.studentId && s.status === 'completed')
      .map(s => parseISO(s.date))
      .sort((a, b) => a.getTime() - b.getTime());

    if (completedDates.length >= 2) {
      const span = differenceInDays(
        completedDates[completedDates.length - 1],
        completedDates[0]
      ) || 1;
      const sessionsPerDay = completedDates.length / span;
      const toComplete = pkg.totalSessions - usedSessions;
      estimatedEndDate = addDays(new Date(), toComplete / sessionsPerDay);
    }
  }

  return {
    pkg,
    usedSessions,
    scheduledSessions,
    remainingSessions,
    estimatedEndDate,
    isExpiringSoon: isCurrent && (scheduledSessions + remainingSessions === 1),
    isExpired,
    isCurrent,
  };
}

export function getTodaySessions(sessions: LessonSession[]): LessonSession[] {
  const today = new Date();
  return sessions
    .filter(s => isSameDay(parseISO(s.date), today))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function getMonthlyRevenue(
  sessions: LessonSession[],
  students: Student[],
  packages: SessionPackage[],
  teacherId: string,
  year: number,
  month: number // 0-indexed
): number {
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  const teacherSessions = sessions.filter(
    s => s.teacherId === teacherId && s.date.startsWith(monthStr) && s.status === 'completed'
  );

  return teacherSessions.reduce((total, session) => {
    const student = students.find(s => s.id === session.studentId);
    if (!student) return total;

    if (student.billingType === 'per-session') {
      return total + student.ratePerSession;
    }

    // For package students, use the package rate
    const pkg = packages.find(p => p.studentId === student.id);
    return total + (pkg?.pricePerSession ?? student.ratePerSession);
  }, 0);
}

export const TEACHER_COLORS = [
  '#6366f1', // indigo
  '#ec4899', // pink
  '#10b981', // emerald
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#14b8a6', // teal
  '#f97316', // orange
];

export { isBefore, isSameDay, parseISO, format };
