import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import type { LessonSession, SessionPackage } from '../types';
import { xuYuanCycleStart } from './xuyuan';

export function groupByMonth(sessions: LessonSession[]) {
  const map = new Map<string, LessonSession[]>();
  for (const s of sessions) {
    const key = s.date.slice(0, 7);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, list]) => ({
      key,
      label: format(parseISO(key + '-01'), 'MMMM yyyy', { locale: localeId }),
      sessions: list.sort((a, b) => a.date.localeCompare(b.date)),
    }));
}

export function groupByXuYuanCycle(sessions: LessonSession[]) {
  const map = new Map<string, LessonSession[]>();
  for (const s of sessions) {
    const key = xuYuanCycleStart(s.date);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, list]) => {
      const start = parseISO(key);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 25);
      return {
        key,
        label: `${format(start, 'd MMM', { locale: localeId })} – ${format(end, 'd MMM yyyy', { locale: localeId })}`,
        sessions: list.sort((a, b) => a.date.localeCompare(b.date)),
      };
    });
}

export function totalDurationLabel(sessions: LessonSession[]): string {
  const minutes = sessions.reduce((sum, s) => {
    const [sh, sm] = s.startTime.split(':').map(Number);
    const [eh, em] = s.endTime.split(':').map(Number);
    return sum + (eh * 60 + em) - (sh * 60 + sm);
  }, 0);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} mnt`;
  if (mins === 0) return `${hours} jam`;
  return `${hours} jam ${mins} mnt`;
}

export function getPackageAttributedSessions(
  pkg: SessionPackage,
  allStudentPackages: SessionPackage[],
  allSessions: LessonSession[]
): LessonSession[] {
  const sorted = [...allStudentPackages].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const idx = sorted.findIndex(p => p.id === pkg.id);
  const slotStart = sorted.slice(0, idx).reduce((sum, p) => sum + p.totalSessions, 0);
  const slotEnd = slotStart + pkg.totalSessions;
  return allSessions
    .filter(s => s.studentId === pkg.studentId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
    .slice(slotStart, slotEnd);
}
