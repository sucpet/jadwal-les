import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Check, Trash2, Clock, AlertTriangle, RefreshCw, ListChecks, CalendarClock, Search } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { addWeeks, subWeeks, startOfWeek, addDays, isSameDay, parseISO, format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { useApp } from '../store/AppContext';
import type { LessonSession } from '../types';
import { formatCurrency, getPackageStatus } from '../utils/helpers';

const TIME_SLOTS = Array.from({ length: 28 }, (_, i) => {
  const hour = Math.floor(i / 2) + 8;
  const min = i % 2 === 0 ? '00' : '30';
  return `${String(hour).padStart(2, '0')}:${min}`;
});

const DAY_LABELS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const ROW_H = 36; // px per 30-min slot

// Convert HH:MM to exact pixel offset from grid top (08:00), no slot snapping
function timeToPixels(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return ((h - 8) * 60 + m) / 30 * ROW_H;
}

// Greedy column assignment for overlapping sessions within one day column.
// Returns colIndex (0-based lane) and totalCols (width denominator) per session.
function computeDayLayout(sessions: LessonSession[]): Array<{
  session: LessonSession;
  colIndex: number;
  totalCols: number;
}> {
  if (sessions.length === 0) return [];
  const sorted = [...sessions].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const laneEnds: string[] = []; // laneEnds[i] = endTime of last session assigned to lane i
  const laneOf: number[] = [];

  for (const s of sorted) {
    const free = laneEnds.findIndex(et => et <= s.startTime);
    const lane = free === -1 ? laneEnds.length : free;
    laneEnds[lane] = s.endTime;
    laneOf.push(lane);
  }

  return sorted.map((session, i) => {
    // totalCols = widest lane index among all sessions overlapping this one, + 1
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

function addOneHour(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + 60;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function shiftDateByWeeks(dateStr: string, weeks: number): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const date = new Date(y, mo - 1, d + weeks * 7);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dayOfWeek(dateStr: string): number {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(y, mo - 1, d).getDay(); // 0=Sun, 6=Sat
}

export default function Schedule() {
  const { data, addSession, updateSession, deleteSession } = useApp();
  const [searchParams] = useSearchParams();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [filterTeacher, setFilterTeacher] = useState(searchParams.get('teacher') ?? 'all');
  const [showForm, setShowForm] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [recurring, setRecurring] = useState(false);
  const [recurringCount, setRecurringCount] = useState('1');
  const [editSession, setEditSession] = useState<LessonSession | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rescheduleWeeks, setRescheduleWeeks] = useState('1');
  const [bulkConfirm, setBulkConfirm] = useState<'cancel' | 'reschedule' | null>(null);
  const [bulkStudentFilter, setBulkStudentFilter] = useState('');
  const [form, setForm] = useState({
    teacherId: data.teachers[0]?.id ?? '',
    studentId: '',
    date: new Date().toISOString().slice(0, 10),
    startTime: '09:00',
    endTime: '10:00',
    status: 'scheduled' as LessonSession['status'],
    notes: '',
    worksheetPages: 0,
  });

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const filteredSessions = filterTeacher === 'all'
    ? data.sessions
    : data.sessions.filter(s => s.teacherId === filterTeacher);

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const nowTimeStr = format(today, 'HH:mm');

  const resolveStatus = (date: string, endTime: string): LessonSession['status'] => {
    if (date > todayStr) return 'scheduled';
    if (date < todayStr) return 'completed';
    if (date === todayStr && endTime <= nowTimeStr) return 'completed';
    return 'scheduled';
  };

  const openAdd = (date?: string, time?: string) => {
    setShowErrors(false);
    setRecurring(false);
    setRecurringCount('1');
    setEditSession(null);
    const d = date ?? todayStr;
    setForm({
      teacherId: filterTeacher !== 'all' ? filterTeacher : (data.teachers[0]?.id ?? ''),
      studentId: '',
      date: d,
      startTime: time ?? '09:00',
      endTime: time ? addOneHour(time) : '10:00',
      status: (d < todayStr || (d === todayStr && addOneHour(time ?? '09:00') <= nowTimeStr)) ? 'completed' : 'scheduled',
      notes: '',
      worksheetPages: 0,
    });
    setShowForm(true);
  };

  const openEdit = (session: LessonSession) => {
    setShowErrors(false);
    setRecurring(false);
    setRecurringCount('1');
    setEditSession(session);
    setForm({
      teacherId: session.teacherId,
      studentId: session.studentId,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,
      notes: session.notes ?? '',
      worksheetPages: session.worksheetPages ?? 0,
    });
    setShowForm(true);
  };

  const save = () => {
    if (!form.teacherId || !form.studentId || !form.date) { setShowErrors(true); return; }
    if (prepaidOverLimit) return;
    if (editSession) {
      updateSession(editSession.id, {
        teacherId: form.teacherId,
        studentId: form.studentId,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        status: resolveStatus(form.date, form.endTime),
        notes: form.notes,
        worksheetPages: form.worksheetPages,
      });
    } else {
      const dates = recurring
        ? Array.from({ length: recurringCountNum }, (_, i) => shiftDateByWeeks(form.date, i))
        : [form.date];
      for (const date of dates) {
        addSession({
          teacherId: form.teacherId,
          studentId: form.studentId,
          date,
          startTime: form.startTime,
          endTime: form.endTime,
          status: resolveStatus(date, form.endTime),
          notes: form.notes,
          worksheetPages: form.worksheetPages,
        });
      }
    }
    setShowForm(false);
  };

  const remove = (id: string) => {
    if (confirm('Hapus sesi ini?')) deleteSession(id);
  };

  const exitBulkMode = () => {
    setBulkMode(false);
    setSelectedIds(new Set());
    setBulkConfirm(null);
    setBulkStudentFilter('');
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const bulkSessions = [...filteredSessions]
    .filter(s => {
      if (!bulkStudentFilter.trim()) return true;
      const student = data.students.find(st => st.id === s.studentId);
      return student?.name.toLowerCase().includes(bulkStudentFilter.toLowerCase());
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  const selectAll = () => setSelectedIds(new Set(bulkSessions.map(s => s.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const bulkCancel = () => {
    selectedIds.forEach(id => deleteSession(id));
    exitBulkMode();
  };

  const bulkReschedule = () => {
    const weeks = Math.max(1, Math.min(52, Number(rescheduleWeeks) || 1));
    selectedIds.forEach(id => {
      const s = data.sessions.find(s => s.id === id);
      if (!s) return;
      const newDate = shiftDateByWeeks(s.date, weeks);
      updateSession(id, { ...s, date: newDate, status: resolveStatus(newDate, s.endTime) });
    });
    exitBulkMode();
  };

  // Group bulk sessions by date
  const bulkByDate = bulkSessions.reduce<{ date: string; sessions: LessonSession[] }[]>((acc, s) => {
    const last = acc[acc.length - 1];
    if (last && last.date === s.date) { last.sessions.push(s); }
    else acc.push({ date: s.date, sessions: [s] });
    return acc;
  }, []);

  const availableStudents = form.teacherId
    ? data.students.filter(s => s.teacherId === form.teacherId)
    : [];

  // ─── Recurring derived values ────────────────────────────────────────────────
  const selectedStudent = data.students.find(s => s.id === form.studentId);
  const isPrepaid = selectedStudent?.billingType === 'package';
  const isXuYuan = selectedStudent?.group === 'xuyuan';
  const recurringCountNum = Math.max(1, Math.min(13, Number(recurringCount) || 1));
  const recurringDates = form.date
    ? Array.from({ length: recurring ? recurringCountNum : 1 }, (_, i) => shiftDateByWeeks(form.date, i))
    : [];
  const lastRecurringDate = recurringDates[recurringDates.length - 1];

  let remainingPkgSessions: number | null = null;
  if (isPrepaid && form.studentId) {
    const studentPkgs = data.packages.filter(p => p.studentId === form.studentId);
    if (studentPkgs.length > 0) {
      const currentPkg = [...studentPkgs].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
      remainingPkgSessions = getPackageStatus(currentPkg, studentPkgs, data.sessions).remainingSessions;
    }
  }

  const prepaidOverLimit = recurring && isPrepaid && remainingPkgSessions !== null && recurringCountNum > remainingPkgSessions;

  const weekendSessionDates = isXuYuan
    ? recurringDates.filter(d => { const day = dayOfWeek(d); return day === 0 || day === 6; })
    : [];
  const hasWeekendWarning = weekendSessionDates.length > 0;

  return (
    <div className="space-y-4 pb-32">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Jadwal</h1>
        <div className="flex gap-2">
          <button
            onClick={() => { setBulkMode(b => !b); setSelectedIds(new Set()); setBulkConfirm(null); }}
            className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border transition-colors ${bulkMode ? 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
            <ListChecks size={16} /> Pilih Sesi
          </button>
          {!bulkMode && (
            <button
              onClick={() => openAdd()}
              className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-indigo-700"
            >
              <Plus size={16} /> Tambah Sesi
            </button>
          )}
        </div>
      </div>

      {/* Teacher filter */}
      {data.teachers.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterTeacher('all')}
            className={`text-sm px-3 py-1.5 rounded-lg border ${filterTeacher === 'all' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'}`}
          >Semua</button>
          {data.teachers.map(t => (
            <button key={t.id} onClick={() => setFilterTeacher(t.id)}
              className={`text-sm px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${filterTeacher === t.id ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'}`}
            >
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.color }} />
              {t.name}
            </button>
          ))}
        </div>
      )}

      {/* Bulk list view */}
      {bulkMode && (
        <div className="space-y-3">
          {/* Student filter */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={bulkStudentFilter}
              onChange={e => setBulkStudentFilter(e.target.value)}
              placeholder="Cari nama murid..."
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {bulkStudentFilter && (
              <button onClick={() => setBulkStudentFilter('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Select all bar */}
          <div className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {selectedIds.size > 0 ? `${selectedIds.size} sesi dipilih` : 'Pilih sesi yang ingin diubah'}
            </span>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">Pilih Semua</button>
              <span className="text-gray-300 dark:text-gray-600">·</span>
              <button onClick={deselectAll} className="text-xs text-gray-500 dark:text-gray-400 hover:underline">Hapus Pilihan</button>
            </div>
          </div>

          {bulkSessions.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-400 dark:text-gray-500 text-sm">
              Tidak ada sesi
            </div>
          ) : (
            <div className="space-y-3">
              {bulkByDate.map(({ date, sessions: daySessions }) => (
                <div key={date}>
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 px-1">
                    {format(parseISO(date), 'EEEE, d MMMM yyyy', { locale: localeId })}
                  </div>
                  <div className="space-y-1">
                    {daySessions.map(s => {
                      const student = data.students.find(st => st.id === s.studentId);
                      const teacher = data.teachers.find(t => t.id === s.teacherId);
                      const checked = selectedIds.has(s.id);
                      return (
                        <div
                          key={s.id}
                          onClick={() => toggleSelect(s.id)}
                          className={`flex items-center gap-3 bg-white dark:bg-gray-800 border rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${checked ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}
                        >
                          {/* Checkbox */}
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checked ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 dark:border-gray-600'}`}>
                            {checked && <Check size={12} className="text-white" />}
                          </div>
                          {/* Color dot */}
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: teacher?.color ?? '#6366f1' }} />
                          {/* Time */}
                          <span className="text-sm text-gray-500 dark:text-gray-400 w-24 flex-shrink-0">{s.startTime}–{s.endTime}</span>
                          {/* Student */}
                          <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white truncate">{student?.name ?? '—'}</span>
                          {/* Teacher */}
                          {filterTeacher === 'all' && (
                            <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{teacher?.name}</span>
                          )}
                          {/* Status */}
                          <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                            s.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                          }`}>
                            {s.status === 'completed' ? 'Selesai' : 'Terjadwal'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Week navigation — hidden in bulk mode */}
      <div className={`flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 ${bulkMode ? 'hidden' : ''}`}>
        <button onClick={() => setCurrentWeek(w => subWeeks(w, 1))} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded dark:text-gray-300">
          <ChevronLeft size={18} />
        </button>
        <span className="flex-1 text-center text-sm font-medium dark:text-gray-200">
          {format(weekStart, 'd MMMM', { locale: localeId })} – {format(addDays(weekStart, 6), 'd MMMM yyyy', { locale: localeId })}
        </span>
        <button onClick={() => setCurrentWeek(new Date())} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline px-2">
          Hari ini
        </button>
        <button onClick={() => setCurrentWeek(w => addWeeks(w, 1))} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded dark:text-gray-300">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Calendar grid — hidden in bulk mode */}
      <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden ${bulkMode ? 'hidden' : ''}`}>
        {/* Header */}
        <div className="grid border-b border-gray-200 dark:border-gray-700" style={{ gridTemplateColumns: '64px repeat(7, 1fr)' }}>
          <div className="border-r border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50" />
          {weekDays.map((day, i) => {
            const isToday = isSameDay(day, today);
            return (
              <div key={i} className={`text-center py-2 border-r border-gray-100 dark:border-gray-700 last:border-r-0 ${isToday ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}>
                <div className={`text-xs font-medium ${isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}>{DAY_LABELS[i]}</div>
                <div className={`text-sm font-semibold ${isToday ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-800 dark:text-gray-200'}`}>
                  {format(day, 'd', { locale: localeId })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Time grid
            Layout: one CSS grid with 28 fixed-height rows.
            - Time labels: column 1, one per row.
            - Background cells: columns 2-8, one per row — click targets + grid lines.
            - Day wrappers: columns 2-8, spanning ALL rows — position:relative so sessions
              can be absolutely positioned, pointer-events:none so clicks fall through
              to background cells when no session is hit.
        */}
        <div
          className="overflow-y-auto max-h-[700px]"
          style={{
            display: 'grid',
            gridTemplateRows: `repeat(${TIME_SLOTS.length}, ${ROW_H}px)`,
            gridTemplateColumns: '64px repeat(7, 1fr)',
          }}
        >
          {/* Time labels */}
          {TIME_SLOTS.map((time, i) => (
            <div
              key={time}
              style={{ gridRow: i + 1, gridColumn: 1 }}
              className={`px-2 py-1 text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-900/50 flex items-start border-r border-gray-100 dark:border-gray-700${i < TIME_SLOTS.length - 1 ? ' border-b' : ''}`}
            >
              {time}
            </div>
          ))}

          {/* Background cells */}
          {TIME_SLOTS.map((time, i) =>
            weekDays.map((day, di) => (
              <div
                key={`${time}-${di}`}
                style={{ gridRow: i + 1, gridColumn: di + 2 }}
                className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors border-gray-100 dark:border-gray-700${isSameDay(day, today) ? ' bg-indigo-50/30 dark:bg-indigo-900/10' : ''}${i < TIME_SLOTS.length - 1 ? ' border-b' : ''}${di < 6 ? ' border-r' : ''}`}
                onClick={() => openAdd(format(day, 'yyyy-MM-dd'), time)}
              />
            ))
          )}

          {/* Day column overlays — sessions are absolutely positioned inside */}
          {weekDays.map((day, di) => {
            const daySessions = filteredSessions.filter(s => isSameDay(parseISO(s.date), day));
            const layout = computeDayLayout(daySessions);
            return (
              <div
                key={`overlay-${di}`}
                style={{
                  gridRow: `1 / ${TIME_SLOTS.length + 1}`,
                  gridColumn: di + 2,
                  position: 'relative',
                  zIndex: 5,
                  pointerEvents: 'none',
                }}
              >
                {layout.map(({ session: s, colIndex, totalCols }) => {
                  const topPx = Math.max(0, timeToPixels(s.startTime));
                  const heightPx = Math.max(ROW_H / 2, timeToPixels(s.endTime) - timeToPixels(s.startTime) - 2);
                  const widthPct = 100 / totalCols;
                  const leftPct = (colIndex / totalCols) * 100;
                  const student = data.students.find(st => st.id === s.studentId);
                  const teacher = data.teachers.find(t => t.id === s.teacherId);
                  const color = teacher?.color ?? '#6366f1';
                  return (
                    <div
                      key={s.id}
                      style={{
                        position: 'absolute',
                        top: `${topPx + 1}px`,
                        height: `${heightPx}px`,
                        left: `calc(${leftPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                        pointerEvents: 'auto',
                        background: `${color}20`,
                        color,
                        borderLeft: `2px solid ${color}`,
                      }}
                      className="rounded text-xs px-1 py-0.5 cursor-pointer hover:opacity-80 overflow-hidden"
                      onClick={e => { e.stopPropagation(); openEdit(s); }}
                      title={`${student?.name} (${s.startTime}–${s.endTime})`}
                    >
                      <div className="font-medium truncate">{student?.name}</div>
                      <div className="opacity-60 truncate">{s.startTime}–{s.endTime}</div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bulk action bar */}
      {bulkMode && selectedIds.size > 0 && (
        <div className="fixed bottom-20 md:bottom-6 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl p-4 w-full max-w-lg pointer-events-auto space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{selectedIds.size} sesi dipilih</span>
              <button onClick={() => setBulkConfirm(null)} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={16} />
              </button>
            </div>

            {bulkConfirm === null && (
              <div className="flex gap-2">
                <button
                  onClick={() => setBulkConfirm('cancel')}
                  className="flex-1 flex items-center justify-center gap-1.5 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 size={15} /> Hapus Jadwal
                </button>
                <button
                  onClick={() => setBulkConfirm('reschedule')}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-indigo-700"
                >
                  <CalendarClock size={15} /> Jadwal Ulang
                </button>
              </div>
            )}

            {bulkConfirm === 'cancel' && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Hapus <strong>{selectedIds.size}</strong> jadwal? Tindakan ini tidak bisa dibatalkan.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setBulkConfirm(null)} className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">
                    Kembali
                  </button>
                  <button onClick={bulkCancel} className="flex-1 flex items-center justify-center gap-1.5 bg-red-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-red-700">
                    <Trash2 size={15} /> Ya, Hapus
                  </button>
                </div>
              </div>
            )}

            {bulkConfirm === 'reschedule' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Geser</span>
                  <input
                    type="number"
                    min="1"
                    max="52"
                    value={rescheduleWeeks}
                    onChange={e => setRescheduleWeeks(e.target.value)}
                    onKeyDown={e => (e.key === '-' || e.key === 'e') && e.preventDefault()}
                    className="w-16 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">minggu ke depan</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setBulkConfirm(null)} className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">
                    Kembali
                  </button>
                  <button onClick={bulkReschedule} className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-indigo-700">
                    <CalendarClock size={15} /> Jadwal Ulang
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Session Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">{editSession ? 'Edit Sesi' : 'Tambah Sesi'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-400 rounded">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Laoshi</label>
                  <select
                    value={form.teacherId}
                    onChange={e => setForm(f => ({ ...f, teacherId: e.target.value, studentId: '' }))}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {[...data.teachers].sort((a, b) => a.name.localeCompare(b.name, 'id')).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Murid</label>
                  <select
                    value={form.studentId}
                    onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))}
                    className={`w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${showErrors && !form.studentId ? 'border-red-400 bg-red-50 dark:bg-red-900/20' : 'border-gray-300 dark:border-gray-600'}`}
                  >
                    <option value="">Pilih murid</option>
                    {[...availableStudents].sort((a, b) => a.name.localeCompare(b.name, 'id')).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {showErrors && !form.studentId && (
                    <p className="text-xs text-red-500 mt-1">Murid wajib dipilih</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Tanggal</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => {
                    const d = e.target.value;
                    setForm(f => ({
                      ...f,
                      date: d,
                      status: resolveStatus(d, f.endTime),
                    }));
                  }}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Mulai</label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Selesai</label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as LessonSession['status'] }))}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="scheduled">Terjadwal</option>
                  <option value="completed" disabled={form.date > todayStr}>Selesai</option>
                </select>
              </div>

              {form.studentId && selectedStudent && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-sm flex items-center gap-2">
                  <Clock size={14} className="text-gray-400 dark:text-gray-500" />
                  <span className="text-gray-600 dark:text-gray-300">
                    Biaya: <strong>{formatCurrency(selectedStudent.ratePerSession)}</strong>
                    {selectedStudent.billingType === 'package' && ' (paket)'}
                  </span>
                </div>
              )}

              {/* Recurring — hanya untuk sesi baru */}
              {!editSession && (
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={recurring}
                      onChange={e => setRecurring(e.target.checked)}
                      className="w-4 h-4 accent-indigo-600"
                    />
                    <RefreshCw size={14} className="text-gray-400 dark:text-gray-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Ulangi setiap minggu</span>
                  </label>

                  {recurring && (
                    <div className="space-y-2 pl-6">
                      <div className="flex items-center gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Berapa kali?</label>
                          <input
                            type="number" min="1" max="13" onKeyDown={e => (e.key === '-' || e.key === 'e') && e.preventDefault()}
                            value={recurringCount}
                            onChange={e => setRecurringCount(e.target.value)}
                            className="w-20 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 pt-4">maks. 13 (~3 bln)</p>
                      </div>

                      {form.date && lastRecurringDate && (
                        <div className="text-xs text-indigo-700 bg-indigo-50 rounded-lg px-3 py-2">
                          {format(parseISO(form.date), 'd MMM', { locale: localeId })}
                          {recurringCountNum > 1 && <> → {format(parseISO(lastRecurringDate), 'd MMM yyyy', { locale: localeId })}</>}
                          {' '}· <strong>{recurringCountNum} sesi</strong>
                        </div>
                      )}

                      {prepaidOverLimit && (
                        <div className="flex items-start gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                          <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                          <span>Paket tersisa <strong>{remainingPkgSessions}</strong> sesi, tidak cukup untuk <strong>{recurringCountNum}</strong> kali</span>
                        </div>
                      )}

                      {isPrepaid && remainingPkgSessions !== null && !prepaidOverLimit && (
                        <p className="text-xs text-gray-400 dark:text-gray-500">Sisa paket: {remainingPkgSessions} sesi</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* XuYuan weekend warning */}
              {hasWeekendWarning && (
                <div className="flex items-start gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                  <span>
                    {weekendSessionDates.length === 1
                      ? `${format(parseISO(weekendSessionDates[0]), 'EEE d MMM', { locale: localeId })} adalah hari weekend`
                      : `${weekendSessionDates.length} sesi jatuh di hari weekend`}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Catatan (opsional)</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Topik, materi, dll"
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={save}
                disabled={prepaidOverLimit}
                className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check size={16} /> Simpan
              </button>
              {editSession && (
                <button
                  onClick={() => { remove(editSession.id); setShowForm(false); }}
                  className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
