import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { FileText, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../store/AppContext';
import type { LessonSession, Student } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────
const RATE_PRIVATE    = 100_000; // IDR/hour
const RATE_SEMI_GROUP = 135_000; // IDR/hour
const WORKSHEET_PRICE =  20_000; // IDR/page

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

function formatRp(n: number): string {
  return 'Rp ' + n.toLocaleString('id-ID');
}

function exportCycleToExcel(cycle: CycleEntry) {
  const rows: (string | number)[][] = [];

  // Title
  rows.push([`Rekap XuYuan – ${cycle.label}`]);
  rows.push([]);

  // Header
  rows.push(['Murid', 'Tanggal', 'Durasi (jam)', 'Jumlah Halaman Worksheet']);

  for (const { student, rows: sessions } of cycle.studentGroups) {
    for (const { session: s, minutes } of sessions) {
      rows.push([
        student?.name ?? '—',
        format(parseISO(s.date), 'd MMM yyyy', { locale: localeId }),
        Math.round((minutes / 60) * 100) / 100,
        s.worksheetPages ?? 0,
      ]);
    }
    rows.push([]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  ws['!cols'] = [{ wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 26 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rekap');
  XLSX.writeFile(wb, `XuYuan_${cycle.label.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
}

function sessionEarning(s: LessonSession, student: Student | undefined): number {
  const mins = durationMinutes(s);
  const rate = student?.xuYuanType === 'semi-group' ? RATE_SEMI_GROUP : RATE_PRIVATE;
  const lessonFee = (mins / 60) * rate;
  const worksheetFee = (s.worksheetPages ?? 0) * WORKSHEET_PRICE;
  return Math.round(lessonFee + worksheetFee);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionRow {
  session: LessonSession;
  minutes: number;
  earning: number;
}

interface StudentGroup {
  student: Student | undefined;
  rows: SessionRow[];
  minutes: number;
  earning: number;
}

interface CycleEntry {
  key: string;
  label: string;
  isCurrent: boolean;
  totalSessions: number;
  totalMinutes: number;
  totalEarning: number;
  studentGroups: StudentGroup[];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Hours() {
  const { data } = useApp();

  const xuYuanStudents = data.students.filter(s => s.group === 'xuyuan');
  const xuYuanIds = new Set(xuYuanStudents.map(s => s.id));

  const completedSessions = data.sessions.filter(
    s => xuYuanIds.has(s.studentId) && s.status === 'completed'
  );

  const cycleMap = new Map<string, LessonSession[]>();
  for (const s of completedSessions) {
    const key = cycleStart(s.date);
    if (!cycleMap.has(key)) cycleMap.set(key, []);
    cycleMap.get(key)!.push(s);
  }

  const thisCycle = currentCycleKey();

  const cycles: CycleEntry[] = [...cycleMap.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, sessions]) => {
      // Group by student
      const studentMap = new Map<string, LessonSession[]>();
      for (const s of sessions) {
        if (!studentMap.has(s.studentId)) studentMap.set(s.studentId, []);
        studentMap.get(s.studentId)!.push(s);
      }

      const studentGroups: StudentGroup[] = [...studentMap.entries()]
        .map(([studentId, ss]) => {
          const student = data.students.find(st => st.id === studentId);
          const rows: SessionRow[] = ss
            .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
            .map(s => ({ session: s, minutes: durationMinutes(s), earning: sessionEarning(s, student) }));
          return {
            student,
            rows,
            minutes: rows.reduce((sum, r) => sum + r.minutes, 0),
            earning: rows.reduce((sum, r) => sum + r.earning, 0),
          };
        })
        .sort((a, b) => (a.student?.name ?? '').localeCompare(b.student?.name ?? ''));

      return {
        key,
        label: cycleLabel(key),
        isCurrent: key === thisCycle,
        totalSessions: sessions.length,
        totalMinutes: sessions.reduce((sum, s) => sum + durationMinutes(s), 0),
        totalEarning: studentGroups.reduce((sum, g) => sum + g.earning, 0),
        studentGroups,
      };
    });

  if (!cycleMap.has(thisCycle)) {
    cycles.unshift({
      key: thisCycle,
      label: cycleLabel(thisCycle),
      isCurrent: true,
      totalSessions: 0,
      totalMinutes: 0,
      totalEarning: 0,
      studentGroups: [],
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rekap Jam Mengajar</h1>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">XuYuan · siklus 26–25</p>
      </div>

      {cycles.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center text-gray-400 dark:text-gray-500 text-sm">
          Belum ada sesi XuYuan yang selesai.
        </div>
      )}

      {cycles.map(cycle => (
        <div
          key={cycle.key}
          className={`rounded-xl border overflow-hidden ${
            cycle.isCurrent ? 'border-indigo-300 dark:border-indigo-600' : 'border-gray-200 dark:border-gray-700'
          }`}
        >
          {/* Cycle header */}
          <div className={`px-5 py-4 ${cycle.isCurrent ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800'}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`font-semibold ${cycle.isCurrent ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                    {cycle.label}
                  </span>
                  {cycle.isCurrent && (
                    <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">Berjalan</span>
                  )}
                </div>
                <div className={`text-sm mt-0.5 ${cycle.isCurrent ? 'text-indigo-200' : 'text-gray-500 dark:text-gray-400'}`}>
                  {cycle.totalSessions} sesi · {formatDuration(cycle.totalMinutes)}
                </div>
              </div>
              <div className="flex items-start gap-3">
                {cycle.studentGroups.length > 0 && (
                  <button
                    onClick={() => exportCycleToExcel(cycle)}
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors mt-0.5 ${
                      cycle.isCurrent
                        ? 'border-white/30 text-white hover:bg-white/10'
                        : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Download size={13} /> Excel
                  </button>
                )}
                <div className="text-right">
                  <div className={`text-2xl font-bold tabular-nums ${cycle.isCurrent ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                    {formatRp(cycle.totalEarning)}
                  </div>
                  <div className={`text-xs mt-0.5 ${cycle.isCurrent ? 'text-indigo-200' : 'text-gray-400 dark:text-gray-500'}`}>
                    total
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Per-student breakdown */}
          {cycle.studentGroups.length > 0 && (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {cycle.studentGroups.map(({ student, rows, minutes: stuMins, earning: stuEarn }) => (
                <div key={student?.id ?? 'unknown'} className="px-5 py-4 bg-white dark:bg-gray-800">
                  {/* Student header */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="flex-1 text-sm font-semibold text-gray-800 dark:text-gray-200">{student?.name ?? '—'}</span>
                    {student?.xuYuanType === 'semi-group' && (
                      <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded">semi</span>
                    )}
                    <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">{rows.length} sesi · {formatDuration(stuMins)}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">{formatRp(stuEarn)}</span>
                  </div>
                  {/* Session list */}
                  <div className="space-y-1 pl-2 border-l-2 border-gray-100 dark:border-gray-700">
                    {rows.map(({ session: s, minutes: sMins, earning: sEarn }) => (
                      <div key={s.id} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className="w-16 flex-shrink-0 tabular-nums">{format(parseISO(s.date), 'd MMM', { locale: localeId })}</span>
                        <span className="w-24 flex-shrink-0 tabular-nums">{s.startTime}–{s.endTime}</span>
                        <span className="flex-1 text-gray-400 dark:text-gray-500 tabular-nums">{formatDuration(sMins)}</span>
                        {(s.worksheetPages ?? 0) > 0 && (
                          <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                            <FileText size={11} /> {s.worksheetPages} hal
                          </span>
                        )}
                        <span className="tabular-nums text-gray-600 dark:text-gray-300">{formatRp(sEarn)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {cycle.studentGroups.length === 0 && (
            <div className="px-5 py-4 bg-white dark:bg-gray-800 text-sm text-gray-400 dark:text-gray-500 text-center">
              Belum ada sesi di periode ini.
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
