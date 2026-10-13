import type { LessonSession } from '../types';

export const ROW_H = 36; // px per 30-min slot

export function timeToPixels(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return ((h - 8) * 60 + m) / 30 * ROW_H;
}

export function computeDayLayout(sessions: LessonSession[]): Array<{
  session: LessonSession;
  colIndex: number;
  totalCols: number;
}> {
  if (sessions.length === 0) return [];
  const sorted = [...sessions].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const laneEnds: string[] = [];
  const laneOf: number[] = [];

  for (const s of sorted) {
    const free = laneEnds.findIndex(et => et <= s.startTime);
    const lane = free === -1 ? laneEnds.length : free;
    laneEnds[lane] = s.endTime;
    laneOf.push(lane);
  }

  return sorted.map((session, i) => {
    let maxLane = laneOf[i];
    for (let j = 0; j < sorted.length; j++) {
      if (j !== i &&
          sorted[j].startTime < session.endTime &&
          session.startTime < sorted[j].endTime) {
        maxLane = Math.max(maxLane, laneOf[j]);
      }
    }
    return { session, colIndex: laneOf[i], totalCols: maxLane + 1 };
  });
}

export function addOneHour(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + 60;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function diffMinutes(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

export function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = Math.max(0, Math.min(24 * 60 - 1, h * 60 + m + mins));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function shiftDateByWeeks(dateStr: string, weeks: number): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const date = new Date(y, mo - 1, d + weeks * 7);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function dayOfWeek(dateStr: string): number {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(y, mo - 1, d).getDay(); // 0=Sun, 6=Sat
}

export function shiftDateByDays(dateStr: string, days: number): string {
  return shiftDateByWeeks(dateStr, days / 7);
}

export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

export type SessionMove = { id: string; date: string; startTime: string; endTime: string };

// "Ubah seluruh jadwal": sesi scheduled murid yang sama setelah `session`, di hari & jam mulai yang sama,
// digeser dengan selisih hari & jam yang sama. Durasi ikut durasi baru sesi yang dipindah.
export function seriesMoves(sessions: LessonSession[], session: LessonSession, date: string, startTime: string, endTime: string): SessionMove[] {
  const dayDelta = daysBetween(session.date, date);
  const minDelta = diffMinutes(session.startTime, startTime);
  const duration = diffMinutes(startTime, endTime);
  return sessions
    .filter(s => s.id !== session.id && s.studentId === session.studentId && s.status === 'scheduled' &&
      s.date > session.date && dayOfWeek(s.date) === dayOfWeek(session.date) && s.startTime === session.startTime)
    .map(s => {
      const st = addMinutes(s.startTime, minDelta);
      return { id: s.id, date: shiftDateByDays(s.date, dayDelta), startTime: st, endTime: addMinutes(st, duration) };
    });
}

// Bulk reschedule: pindah ke hari `weekday` (1=Sen … 7=Min, null = hari tetap) di minggu yang sama (mulai Senin).
export function moveToWeekday(dateStr: string, weekday: number | null): string {
  if (weekday === null) return dateStr;
  const monIdx = (dayOfWeek(dateStr) + 6) % 7; // 0=Sen
  return shiftDateByDays(dateStr, weekday - 1 - monIdx);
}
