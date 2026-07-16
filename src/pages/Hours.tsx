import { format, parseISO, startOfWeek, addDays } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Timer } from 'lucide-react';
import { useApp } from '../store/AppContext';
import type { LessonSession } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cycleStart(dateStr: string): string {
  const d = parseISO(dateStr);
  const day = d.getDate();
  const start = day >= 26
    ? new Date(d.getFullYear(), d.getMonth(), 26)
    : new Date(d.getFullYear(), d.getMonth() - 1, 26);
  return format(start, 'yyyy-MM-dd');
}

function cycleLabel(startKey: string): string {
  const start = parseISO(startKey);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 25);
  return `${format(start, 'd MMM', { locale: localeId })} – ${format(end, 'd MMM yyyy', { locale: localeId })}`;
}

function currentCycleKey(): string {
  return cycleStart(format(new Date(), 'yyyy-MM-dd'));
}

function durationMinutes(s: LessonSession): number {
  const [sh, sm] = s.startTime.split(':').map(Number);
  const [eh, em] = s.endTime.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} mnt`;
  if (m === 0) return `${h} jam`;
  return `${h} jam ${m} mnt`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeekEntry {
  key: string;    // Monday date "YYYY-MM-DD"
  label: string;  // "30 Jun – 6 Jul"
  sessions: LessonSession[];
  minutes: number;
}

interface CycleEntry {
  key: string;
  label: string;
  isCurrent: boolean;
  totalSessions: number;
  totalMinutes: number;
  weeks: WeekEntry[];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Hours() {
  const { data } = useApp();

  const xuYuanStudents = data.students.filter(s => s.group === 'xuyuan');
  const xuYuanIds = new Set(xuYuanStudents.map(s => s.id));

  const completedSessions = data.sessions.filter(
    s => xuYuanIds.has(s.studentId) && s.status === 'completed'
  );

  // Group sessions by cycle
  const cycleMap = new Map<string, LessonSession[]>();
  for (const s of completedSessions) {
    const key = cycleStart(s.date);
    if (!cycleMap.has(key)) cycleMap.set(key, []);
    cycleMap.get(key)!.push(s);
  }

  const thisCycle = currentCycleKey();

  // Build sorted cycle entries (newest first)
  const cycles: CycleEntry[] = [...cycleMap.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, sessions]) => {
      // Group by week (Monday as start)
      const weekMap = new Map<string, LessonSession[]>();
      for (const s of sessions) {
        const monday = startOfWeek(parseISO(s.date), { weekStartsOn: 1 });
        const wKey = format(monday, 'yyyy-MM-dd');
        if (!weekMap.has(wKey)) weekMap.set(wKey, []);
        weekMap.get(wKey)!.push(s);
      }
      const weeks: WeekEntry[] = [...weekMap.entries()]
        .sort((a, b) => b[0].localeCompare(a[0])) // newest first
        .map(([wKey, ss]) => {
          const monday = parseISO(wKey);
          const sunday = addDays(monday, 6);
          return {
            key: wKey,
            label: `${format(monday, 'd MMM', { locale: localeId })} – ${format(sunday, 'd MMM', { locale: localeId })}`,
            sessions: ss.sort((a, b) => a.date.localeCompare(b.date)),
            minutes: ss.reduce((sum, s) => sum + durationMinutes(s), 0),
          };
        });

      return {
        key,
        label: cycleLabel(key),
        isCurrent: key === thisCycle,
        totalSessions: sessions.length,
        totalMinutes: sessions.reduce((sum, s) => sum + durationMinutes(s), 0),
        weeks,
      };
    });

  // If current cycle has no data yet, still show it as empty
  if (!cycleMap.has(thisCycle)) {
    cycles.unshift({
      key: thisCycle,
      label: cycleLabel(thisCycle),
      isCurrent: true,
      totalSessions: 0,
      totalMinutes: 0,
      weeks: [],
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Rekap Jam Mengajar</h1>
        <p className="text-sm text-gray-400 mt-0.5">XuYuan · siklus 26–25</p>
      </div>

      {cycles.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400 text-sm">
          Belum ada sesi XuYuan yang selesai.
        </div>
      )}

      {cycles.map(cycle => (
        <div
          key={cycle.key}
          className={`rounded-xl border overflow-hidden ${
            cycle.isCurrent ? 'border-indigo-300' : 'border-gray-200'
          }`}
        >
          {/* Cycle header */}
          <div className={`px-5 py-4 flex items-center justify-between ${
            cycle.isCurrent ? 'bg-indigo-600 text-white' : 'bg-white'
          }`}>
            <div>
              <div className="flex items-center gap-2">
                <span className={`font-semibold ${cycle.isCurrent ? 'text-white' : 'text-gray-900'}`}>
                  {cycle.label}
                </span>
                {cycle.isCurrent && (
                  <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">
                    Berjalan
                  </span>
                )}
              </div>
              <div className={`text-sm mt-0.5 ${cycle.isCurrent ? 'text-indigo-200' : 'text-gray-500'}`}>
                {cycle.totalSessions} sesi
              </div>
            </div>
            <div className="text-right">
              <div className={`text-2xl font-bold tabular-nums ${cycle.isCurrent ? 'text-white' : 'text-gray-900'}`}>
                {formatDuration(cycle.totalMinutes)}
              </div>
              <div className={`text-xs mt-0.5 ${cycle.isCurrent ? 'text-indigo-200' : 'text-gray-400'} flex items-center gap-1 justify-end`}>
                <Timer size={11} /> total durasi
              </div>
            </div>
          </div>

          {/* Per-week breakdown */}
          {cycle.weeks.length > 0 && (
            <div className="divide-y divide-gray-100">
              {cycle.weeks.map(({ key, label, sessions, minutes }) => {
                const pct = cycle.totalMinutes > 0 ? (minutes / cycle.totalMinutes) * 100 : 0;
                return (
                  <div key={key} className="px-5 py-3 bg-white">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-700">{label}</span>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-gray-900 tabular-nums">
                          {formatDuration(minutes)}
                        </span>
                        <span className="text-xs text-gray-400 ml-2">
                          {sessions.length} sesi
                        </span>
                      </div>
                    </div>
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full rounded-full transition-all bg-indigo-400"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {sessions.map(s => (
                        <span key={s.id} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded tabular-nums">
                          {format(parseISO(s.date), 'd MMM', { locale: localeId })}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {cycle.weeks.length === 0 && (
            <div className="px-5 py-4 bg-white text-sm text-gray-400 text-center">
              Belum ada sesi di periode ini.
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
