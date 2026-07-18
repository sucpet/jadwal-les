import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import type { LessonSession } from '../types';

export function xuYuanCycleStart(dateStr: string): string {
  const d = parseISO(dateStr);
  const day = d.getDate();
  const start = day >= 26
    ? new Date(d.getFullYear(), d.getMonth(), 26)
    : new Date(d.getFullYear(), d.getMonth() - 1, 26);
  return format(start, 'yyyy-MM-dd');
}

export function xuYuanCycleLabel(startKey: string): string {
  const start = parseISO(startKey);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 25);
  return `${format(start, 'd MMM', { locale: localeId })} – ${format(end, 'd MMM yyyy', { locale: localeId })}`;
}

export function durationMinutes(s: LessonSession): number {
  const [sh, sm] = s.startTime.split(':').map(Number);
  const [eh, em] = s.endTime.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} mnt`;
  if (m === 0) return `${h} jam`;
  return `${h} jam ${m} mnt`;
}

export function formatRp(n: number): string {
  return 'Rp ' + n.toLocaleString('id-ID');
}
