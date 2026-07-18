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

export function shiftDateByWeeks(dateStr: string, weeks: number): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const date = new Date(y, mo - 1, d + weeks * 7);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function dayOfWeek(dateStr: string): number {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(y, mo - 1, d).getDay(); // 0=Sun, 6=Sat
}
