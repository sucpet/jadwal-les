import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Check, Trash2, Clock, AlertTriangle, RefreshCw, ListChecks, CalendarClock, Search, Copy } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { addWeeks, subWeeks, startOfWeek, addDays, subDays, isSameDay, parseISO, format, startOfMonth, addMonths, subMonths, isSameMonth } from 'date-fns';
import { useApp } from '../store/AppContext';
import { useLang } from '../store/LanguageContext';
import { useConfirm } from '../store/ConfirmContext';
import { useToast } from '../store/ToastContext';
import type { LessonSession } from '../types';
import { formatCurrency, getPackageStatus, effectiveRate, GROUP_COLORS } from '../utils/helpers';
import { ROW_H, timeToPixels, computeDayLayout, addOneHour, shiftDateByWeeks, dayOfWeek, diffMinutes, addMinutes } from '../utils/calendar';
import { getHoliday } from '../utils/holidays';

const TIME_SLOTS = Array.from({ length: 28 }, (_, i) => {
  const hour = Math.floor(i / 2) + 8;
  const min = i % 2 === 0 ? '00' : '30';
  return `${String(hour).padStart(2, '0')}:${min}`;
});

const DAY_LABELS_ID = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const DAY_LABELS_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function Schedule() {
  const { data, addSession, updateSession, deleteSession } = useApp();
  const { t, locale, lang } = useLang();
  const confirm = useConfirm();
  const toast = useToast();
  const DAY_LABELS = lang === 'en' ? DAY_LABELS_EN : DAY_LABELS_ID;
  const [searchParams] = useSearchParams();
  const [currentWeek, setCurrentWeek] = useState(() => {
    const d = searchParams.get('date');
    return d ? parseISO(d) : new Date();
  });
  const [filterTeacher, setFilterTeacher] = useState(searchParams.get('teacher') ?? 'all');
  const [showForm, setShowForm] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [recurring, setRecurring] = useState(false);
  const [recurringCount, setRecurringCount] = useState('1');
  const [editSession, setEditSession] = useState<LessonSession | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rescheduleWeeks, setRescheduleWeeks] = useState('1');
  const [bulkConfirm, setBulkConfirm] = useState<'cancel' | 'reschedule' | 'copy' | null>(null);
  const [copyWeeks, setCopyWeeks] = useState('1');
  const [copyIsRecurring, setCopyIsRecurring] = useState(false);
  const [copyCount, setCopyCount] = useState('4');
  const [bulkStudentFilter, setBulkStudentFilter] = useState('');
  const [bulkMonth, setBulkMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [viewMode, setViewMode] = useState<'week' | 'month' | 'day'>('day');
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [currentDay, setCurrentDay] = useState(() => new Date());
  const [dayPanel, setDayPanel] = useState<string | null>(null);
  const [form, setForm] = useState({
    teacherId: data.teachers.find(te => te.isActive)?.id ?? '',
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

  // Month view grid — always 6 rows × 7 cols = 42 days
  const monthGridStart = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
  const monthGridDays = Array.from({ length: 42 }, (_, i) => addDays(monthGridStart, i));
  const monthGridWeeks = Array.from({ length: 6 }, (_, w) => monthGridDays.slice(w * 7, (w + 1) * 7));

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
      teacherId: filterTeacher !== 'all' ? filterTeacher : (data.teachers.find(te => te.isActive)?.id ?? ''),
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

  const remove = async (id: string) => {
    if (await confirm({ message: t('sch.deleteSessionConfirm'), danger: true })) { deleteSession(id); toast.success(t('common.deleted')); }
  };

  // ─── Quick reschedule (satu sesi) ─────────────────────────────────────────
  const rescheduleTo = (session: LessonSession, date: string, startTime: string, endTime: string) => {
    updateSession(session.id, { date, startTime, endTime, status: resolveStatus(date, endTime) });
    toast.success(t('sch.rescheduled'));
  };

  // Konfirmasi pindah sesi — dipakai oleh +1mgg (A) dan drag & drop (C)
  const [pendingMove, setPendingMove] = useState<{ session: LessonSession; date: string; startTime: string; endTime: string } | null>(null);
  // Feature A — geser satu sesi N minggu, jam tetap
  const shiftSessionWeeks = (session: LessonSession, weeks: number) => {
    setPendingMove({ session, date: shiftDateByWeeks(session.date, weeks), startTime: session.startTime, endTime: session.endTime });
  };
  const applyMove = () => {
    if (!pendingMove) return;
    const { session, date, startTime, endTime } = pendingMove;
    rescheduleTo(session, date, startTime, endTime);
    setPendingMove(null);
  };

  // Feature B — mini-popover jadwal ulang
  const [quickTarget, setQuickTarget] = useState<LessonSession | null>(null);
  const [quickForm, setQuickForm] = useState({ date: '', startTime: '', endTime: '' });
  const openQuick = (s: LessonSession) => {
    setQuickTarget(s);
    setQuickForm({ date: s.date, startTime: s.startTime, endTime: s.endTime });
  };
  const saveQuick = () => {
    if (!quickTarget) return;
    rescheduleTo(quickTarget, quickForm.date, quickForm.startTime, quickForm.endTime);
    setQuickTarget(null);
  };

  // Feature C — drag & drop di grid desktop
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  const dropOnCell = (dayStr: string, time: string) => {
    const s = data.sessions.find(x => x.id === draggingId);
    setDraggingId(null);
    setDragOverCell(null);
    if (!s) return;
    if (s.date === dayStr && s.startTime === time) return;
    setPendingMove({ session: s, date: dayStr, startTime: time, endTime: addMinutes(time, diffMinutes(s.startTime, s.endTime)) });
  };

  const exitBulkMode = () => {
    setBulkMode(false);
    setSelectedIds(new Set());
    setBulkConfirm(null);
    setBulkStudentFilter('');
    setBulkMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const bulkMonthStr = format(bulkMonth, 'yyyy-MM');

  const bulkSessions = [...filteredSessions]
    .filter(s => {
      if (!s.date.startsWith(bulkMonthStr)) return false;
      if (!bulkStudentFilter.trim()) return true;
      const student = data.students.find(st => st.id === s.studentId);
      return student?.name.toLowerCase().includes(bulkStudentFilter.toLowerCase());
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  const selectAll = () => setSelectedIds(new Set(bulkSessions.map(s => s.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const bulkCancel = () => {
    const n = selectedIds.size;
    selectedIds.forEach(id => deleteSession(id));
    exitBulkMode();
    toast.success(t('sch.bulkCancelled', { n }));
  };

  const bulkReschedule = () => {
    const weeks = Math.max(1, Math.min(52, Number(rescheduleWeeks) || 1));
    const n = selectedIds.size;
    selectedIds.forEach(id => {
      const s = data.sessions.find(s => s.id === id);
      if (!s) return;
      const newDate = shiftDateByWeeks(s.date, weeks);
      updateSession(id, { ...s, date: newDate, status: resolveStatus(newDate, s.endTime) });
    });
    exitBulkMode();
    toast.success(t('sch.bulkRescheduled', { n }));
  };

  const bulkCopy = () => {
    const offset = Math.max(1, Math.min(52, Number(copyWeeks) || 1));
    const count = copyIsRecurring ? Math.max(1, Math.min(13, Number(copyCount) || 1)) : 1;
    const n = selectedIds.size;
    selectedIds.forEach(id => {
      const s = data.sessions.find(s => s.id === id);
      if (!s) return;
      for (let i = 0; i < count; i++) {
        const newDate = shiftDateByWeeks(s.date, offset + i);
        addSession({
          teacherId: s.teacherId,
          studentId: s.studentId,
          date: newDate,
          startTime: s.startTime,
          endTime: s.endTime,
          status: resolveStatus(newDate, s.endTime),
          notes: s.notes,
          worksheetPages: s.worksheetPages ?? 0,
        });
      }
    });
    exitBulkMode();
    toast.success(t('sch.bulkCopied', { n: n * count }));
  };

  // Group bulk sessions by date (already filtered to one week)
  const bulkByDate = bulkSessions.reduce<{ date: string; sessions: LessonSession[] }[]>((acc, s) => {
    const last = acc[acc.length - 1];
    if (last && last.date === s.date) last.sessions.push(s);
    else acc.push({ date: s.date, sessions: [s] });
    return acc;
  }, []);

  const availableStudents = form.teacherId
    ? data.students.filter(s => s.teacherId === form.teacherId && s.isActive)
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
      // Saat edit, kecualikan sesi yang sedang diedit dari hitungan slot paket
      const sessionsForCount = editSession
        ? data.sessions.filter(s => s.id !== editSession.id)
        : data.sessions;
      remainingPkgSessions = getPackageStatus(currentPkg, studentPkgs, sessionsForCount).remainingSessions;
    }
  }

  // Saat edit sesi yang sudah ada, tidak perlu cek over-limit (reschedule, bukan tambah baru)
  const prepaidOverLimit = !editSession && isPrepaid && remainingPkgSessions !== null && (
    recurring ? recurringCountNum > remainingPkgSessions : remainingPkgSessions === 0
  );

  const weekendSessionDates = isXuYuan
    ? recurringDates.filter(d => { const day = dayOfWeek(d); return day === 0 || day === 6; })
    : [];
  const hasWeekendWarning = weekendSessionDates.length > 0;

  // Libur nasional
  const holidayHits = recurringDates
    .map(d => ({ date: d, holiday: getHoliday(d) }))
    .filter(x => x.holiday !== undefined) as { date: string; holiday: NonNullable<ReturnType<typeof getHoliday>> }[];

  // Konflik jadwal: sesi lain dari laoshi yang sama yang waktunya overlap
  const teacherConflicts = (form.teacherId && form.date && form.startTime && form.endTime)
    ? recurringDates.flatMap(date =>
        data.sessions.filter(s =>
          s.teacherId === form.teacherId &&
          s.date === date &&
          s.id !== editSession?.id &&
          s.startTime < form.endTime &&
          form.startTime < s.endTime
        ).map(s => ({ ...s, date }))
      )
    : [];

  // Konflik untuk mini-popover jadwal ulang
  const quickConflicts = quickTarget
    ? data.sessions.filter(s =>
        s.teacherId === quickTarget.teacherId &&
        s.date === quickForm.date &&
        s.id !== quickTarget.id &&
        s.startTime < quickForm.endTime &&
        quickForm.startTime < s.endTime
      )
    : [];

  return (
    <div className="space-y-4 pb-32">
      <div className="flex items-center justify-between">
        {bulkMode ? (
          <button
            onClick={exitBulkMode}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ChevronLeft size={16} /> {t('sch.back')}
          </button>
        ) : (
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('sch.title')}</h1>
        )}
        <div className="flex gap-2">
          {!bulkMode && (
            <>
              <button
                onClick={() => { setBulkMode(true); setSelectedIds(new Set()); setBulkConfirm(null); }}
                className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <ListChecks size={16} /> {t('sch.selectSessions')}
              </button>
              <button
                onClick={() => openAdd()}
                className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-indigo-700"
              >
                <Plus size={16} /> {t('sch.addSession')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Teacher filter */}
      {data.teachers.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterTeacher('all')}
            className={`text-sm px-3 py-1.5 rounded-lg border ${filterTeacher === 'all' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'}`}
          >{t('stu.all')}</button>
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
              placeholder={t('sch.searchStudentPh')}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {bulkStudentFilter && (
              <button onClick={() => setBulkStudentFilter('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Month navigation */}
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2">
            <button onClick={() => setBulkMonth(m => subMonths(m, 1))} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded dark:text-gray-300">
              <ChevronLeft size={18} />
            </button>
            <span className="flex-1 text-center text-sm font-medium dark:text-gray-200 capitalize">
              {format(bulkMonth, 'MMMM yyyy', { locale })}
            </span>
            <button onClick={() => setBulkMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline px-1">
              {t('sch.today')}
            </button>
            <button onClick={() => setBulkMonth(m => addMonths(m, 1))} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded dark:text-gray-300">
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Select all bar */}
          <div className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {selectedIds.size > 0 ? t('sch.sessionsSelected', { n: selectedIds.size }) : t('sch.selectPrompt')}
              {selectedIds.size > 0 && bulkSessions.filter(s => selectedIds.has(s.id)).length < selectedIds.size && (
                <span className="ml-1 text-xs text-indigo-500 dark:text-indigo-400">(dari beberapa minggu)</span>
              )}
            </span>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">{t('sch.selectAll')}</button>
              <span className="text-gray-300 dark:text-gray-600">·</span>
              <button onClick={deselectAll} className="text-xs text-gray-500 dark:text-gray-400 hover:underline">{t('sch.clearSelection')}</button>
            </div>
          </div>

          {bulkSessions.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-400 dark:text-gray-500 text-sm">
              {t('sch.noSessions')}
            </div>
          ) : (
            <div className="space-y-3">
              {bulkByDate.map(({ date, sessions: daySessions }) => (
                <div key={date}>
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 px-1">
                    {format(parseISO(date), 'EEEE, d MMMM yyyy', { locale })}
                  </div>
                  <div className="space-y-1">
                    {daySessions.map(s => {
                      const student = data.students.find(st => st.id === s.studentId);
                      const teacher = data.teachers.find(t => t.id === s.teacherId);
                      const checked = selectedIds.has(s.id);
                      const groupColor = student ? GROUP_COLORS[student.group] : '#6366f1';
                      return (
                        <div
                          key={s.id}
                          onClick={() => toggleSelect(s.id)}
                          style={checked ? undefined : { background: `${groupColor}22` }}
                          className={`flex items-center gap-3 border rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${checked ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}
                        >
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checked ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 dark:border-gray-600'}`}>
                            {checked && <Check size={12} className="text-white" />}
                          </div>
                          <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: teacher?.color ?? '#6366f1' }} />
                          <span className="text-sm text-gray-500 dark:text-gray-400 w-24 flex-shrink-0">{s.startTime}–{s.endTime}</span>
                          <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white truncate">{student?.name ?? '—'}</span>
                          {filterTeacher === 'all' && (
                            <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{teacher?.name}</span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                            s.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                          }`}>
                            {s.status === 'completed' ? t('status.completed') : t('status.scheduled')}
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

      {/* Navigation — hidden in bulk mode */}
      <div className={`flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 ${bulkMode ? 'hidden' : ''}`}>
        <button
          onClick={() => {
            if (viewMode === 'day') setCurrentDay(d => subDays(d, 1));
            else if (viewMode === 'week') setCurrentWeek(w => subWeeks(w, 1));
            else setCurrentMonth(m => subMonths(m, 1));
          }}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded dark:text-gray-300"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="flex-1 text-center text-sm font-medium dark:text-gray-200 capitalize">
          {viewMode === 'day'
            ? format(currentDay, 'EEEE, d MMMM yyyy', { locale })
            : viewMode === 'week'
            ? `${format(weekStart, 'd MMMM', { locale })} – ${format(addDays(weekStart, 6), 'd MMMM yyyy', { locale })}`
            : format(currentMonth, 'MMMM yyyy', { locale })}
        </span>
        <button
          onClick={() => { setCurrentWeek(new Date()); setCurrentMonth(new Date()); setCurrentDay(new Date()); }}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline px-1"
        >
          {t('sch.today')}
        </button>
        <button
          onClick={() => {
            if (viewMode === 'day') setCurrentDay(d => addDays(d, 1));
            else if (viewMode === 'week') setCurrentWeek(w => addWeeks(w, 1));
            else setCurrentMonth(m => addMonths(m, 1));
          }}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded dark:text-gray-300"
        >
          <ChevronRight size={18} />
        </button>
        {/* View mode toggle — mobile: Hari | Bulan, desktop: Minggu | Bulan */}
        <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5 ml-1 md:hidden">
          <button
            onClick={() => setViewMode('day')}
            className={`text-xs px-2.5 py-1 rounded transition-colors ${viewMode === 'day' ? 'bg-white dark:bg-gray-600 text-gray-800 dark:text-white shadow-sm font-medium' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            {t('sch.day')}
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={`text-xs px-2.5 py-1 rounded transition-colors ${viewMode === 'month' ? 'bg-white dark:bg-gray-600 text-gray-800 dark:text-white shadow-sm font-medium' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            {t('sch.month')}
          </button>
        </div>
        <div className="hidden md:flex items-center gap-0.5 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5 ml-1">
          <button
            onClick={() => setViewMode('week')}
            className={`text-xs px-2.5 py-1 rounded transition-colors ${viewMode === 'week' ? 'bg-white dark:bg-gray-600 text-gray-800 dark:text-white shadow-sm font-medium' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            {t('sch.week')}
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={`text-xs px-2.5 py-1 rounded transition-colors ${viewMode === 'month' ? 'bg-white dark:bg-gray-600 text-gray-800 dark:text-white shadow-sm font-medium' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            {t('sch.month')}
          </button>
        </div>
      </div>

      {/* Mobile day view — single-day time grid (mirrors desktop week grid, 1 column) */}
      {!bulkMode && viewMode === 'day' && (() => {
        const dayStr = format(currentDay, 'yyyy-MM-dd');
        const isToday = isSameDay(currentDay, today);
        const daySessions = filteredSessions.filter(s => isSameDay(parseISO(s.date), currentDay));
        const layout = computeDayLayout(daySessions);
        return (
          <div className="md:hidden border border-gray-200 dark:border-gray-700 rounded-xl overflow-clip">
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(100svh - 210px)' }}>
              <div
                className="bg-white dark:bg-gray-800 relative"
                style={{
                  display: 'grid',
                  gridTemplateRows: `repeat(${TIME_SLOTS.length}, ${ROW_H}px)`,
                  gridTemplateColumns: '48px 1fr',
                }}
              >
                {/* Time labels */}
                {TIME_SLOTS.map((time, i) => (
                  <div
                    key={time}
                    style={{ gridRow: i + 1, gridColumn: 1 }}
                    className={`px-1.5 py-1 text-[11px] text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-900/50 flex items-start border-r border-gray-100 dark:border-gray-700${i < TIME_SLOTS.length - 1 ? ' border-b' : ''}`}
                  >
                    {time}
                  </div>
                ))}

                {/* Background cells — tap to add */}
                {TIME_SLOTS.map((time, i) => (
                  <div
                    key={time}
                    style={{ gridRow: i + 1, gridColumn: 2 }}
                    className={`cursor-pointer border-gray-100 dark:border-gray-700${isToday ? ' bg-indigo-50/30 dark:bg-indigo-900/10' : ''}${i < TIME_SLOTS.length - 1 ? ' border-b' : ''}`}
                    onClick={() => openAdd(dayStr, time)}
                  />
                ))}

                {/* Session overlay */}
                <div
                  style={{
                    gridRow: `1 / ${TIME_SLOTS.length + 1}`,
                    gridColumn: 2,
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
                    const groupColor = student ? GROUP_COLORS[student.group] : color;
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
                          background: `${groupColor}80`,
                          color: '#fff',
                          borderLeft: `4px solid ${color}`,
                          opacity: s.status === 'completed' ? 0.6 : 1,
                        }}
                        className="rounded text-xs px-1 py-0.5 overflow-hidden active:opacity-70"
                        onClick={e => { e.stopPropagation(); openEdit(s); }}
                      >
                        <div className="font-medium truncate">{student?.name}</div>
                        <div className="opacity-70 truncate">{s.startTime}–{s.endTime}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Mobile week list — visible only on small screens, hidden in bulk/month/day mode */}
      <div className={`md:hidden space-y-2 ${bulkMode || viewMode !== 'week' ? 'hidden' : ''}`}>
        {weekDays.map((day, di) => {
          const dayStr = format(day, 'yyyy-MM-dd');
          const daySessions = filteredSessions
            .filter(s => s.date === dayStr)
            .sort((a, b) => a.startTime.localeCompare(b.startTime));
          const isToday = isSameDay(day, today);
          return (
            <div key={di} className={`rounded-xl border overflow-hidden ${isToday ? 'border-indigo-300 dark:border-indigo-600' : 'border-gray-200 dark:border-gray-700'}`}>
              <div className={`px-4 py-2.5 flex items-center gap-2 ${isToday ? 'bg-indigo-600' : 'bg-gray-50 dark:bg-gray-800/60'}`}>
                <span className={`flex-1 text-sm font-medium ${isToday ? 'text-white' : 'text-gray-700 dark:text-gray-200'}`}>
                  {DAY_LABELS[di]}, {format(day, 'd MMM', { locale })}
                </span>
                {daySessions.length > 0 && (
                  <span className={`text-xs ${isToday ? 'text-indigo-200' : 'text-gray-400 dark:text-gray-500'}`}>
                    {daySessions.length} sesi
                  </span>
                )}
                <button
                  onClick={() => openAdd(dayStr)}
                  className={`p-1 rounded-lg ${isToday ? 'text-indigo-200 hover:bg-white/10' : 'text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                >
                  <Plus size={15} />
                </button>
              </div>
              {daySessions.length > 0 ? (
                <div className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
                  {daySessions.map(s => {
                    const student = data.students.find(st => st.id === s.studentId);
                    const teacher = data.teachers.find(t => t.id === s.teacherId);
                    const groupColor = student ? GROUP_COLORS[student.group] : '#6366f1';
                    return (
                      <div
                        key={s.id}
                        onClick={() => openEdit(s)}
                        style={{ background: `${groupColor}22` }}
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer active:bg-gray-50 dark:active:bg-gray-700/50"
                      >
                        <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: teacher?.color ?? '#6366f1' }} />
                        <span className="text-xs text-gray-500 dark:text-gray-400 w-[4.5rem] flex-shrink-0 tabular-nums">
                          {s.startTime}–{s.endTime}
                        </span>
                        <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white truncate min-w-0">
                          {student?.name ?? '—'}
                        </span>
                        <button
                          onClick={e => { e.stopPropagation(); shiftSessionWeeks(s, 1); }}
                          title={t('sch.reschedTitle')}
                          className="flex-shrink-0 text-[11px] font-medium px-1.5 py-1 rounded text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                        >
                          {t('sch.plus1wkShort')}
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); openQuick(s); }}
                          title={t('sch.reschedule')}
                          className="flex-shrink-0 p-1 rounded text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                        >
                          <CalendarClock size={15} />
                        </button>
                        <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                          s.status === 'completed'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                        }`}>
                          {s.status === 'completed' ? t('status.completed') : t('status.scheduled')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="px-4 py-2.5 bg-white dark:bg-gray-800 text-xs text-gray-400 dark:text-gray-500 text-center italic">
              {t('sch.noSessions')}
            </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Calendar grid — desktop only, hidden in bulk/month mode */}
      {/* overflow-clip: clips border-radius without creating a scroll container (so sticky header works) */}
      <div className={`border border-gray-200 dark:border-gray-700 rounded-xl overflow-clip ${bulkMode || viewMode === 'month' || viewMode === 'day' ? 'hidden' : 'hidden md:block'}`}>
        {/* Single scroll container — header + body share the same width so columns always align */}
        <div className="overflow-y-auto max-h-[748px]">
          {/* Sticky header */}
          <div
            className="sticky top-0 z-10 grid border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
            style={{ gridTemplateColumns: '64px repeat(7, 1fr)' }}
          >
            <div className="border-r border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50" />
            {weekDays.map((day, i) => {
              const isToday = isSameDay(day, today);
              return (
                <div key={i} className={`text-center py-2 border-r border-gray-100 dark:border-gray-700 last:border-r-0 ${isToday ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}>
                  <div className={`text-xs font-medium ${isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}>{DAY_LABELS[i]}</div>
                  <div className={`text-sm font-semibold ${isToday ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-800 dark:text-gray-200'}`}>
                    {format(day, 'd', { locale })}
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
            className="bg-white dark:bg-gray-800"
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
            weekDays.map((day, di) => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const cellKey = `${dayStr}-${time}`;
              const isDropTarget = draggingId !== null && dragOverCell === cellKey;
              return (
                <div
                  key={`${time}-${di}`}
                  style={{ gridRow: i + 1, gridColumn: di + 2 }}
                  className={`cursor-pointer transition-colors border-gray-100 dark:border-gray-700${isDropTarget ? ' bg-indigo-200/60 dark:bg-indigo-500/30 ring-1 ring-inset ring-indigo-400' : ' hover:bg-gray-50 dark:hover:bg-gray-700/30'}${isSameDay(day, today) && !isDropTarget ? ' bg-indigo-50/30 dark:bg-indigo-900/10' : ''}${i < TIME_SLOTS.length - 1 ? ' border-b' : ''}${di < 6 ? ' border-r' : ''}`}
                  onClick={() => openAdd(dayStr, time)}
                  onDragOver={draggingId ? (e => { e.preventDefault(); if (dragOverCell !== cellKey) setDragOverCell(cellKey); }) : undefined}
                  onDrop={draggingId ? (e => { e.preventDefault(); dropOnCell(dayStr, time); }) : undefined}
                />
              );
            })
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
                  const groupColor = student ? GROUP_COLORS[student.group] : color;
                  const isDragging = draggingId === s.id;
                  return (
                    <div
                      key={s.id}
                      draggable
                      style={{
                        position: 'absolute',
                        top: `${topPx + 1}px`,
                        height: `${heightPx}px`,
                        left: `calc(${leftPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                        pointerEvents: 'auto',
                        background: `${groupColor}80`,
                        color: '#fff',
                        borderLeft: `5px solid ${color}`,
                        opacity: isDragging ? 0.4 : (s.status === 'completed' ? 0.6 : 1),
                      }}
                      className="group relative rounded text-xs px-1 py-0.5 cursor-grab active:cursor-grabbing hover:opacity-80 overflow-hidden"
                      onClick={e => { e.stopPropagation(); openEdit(s); }}
                      onDragStart={e => { setDraggingId(s.id); e.dataTransfer.effectAllowed = 'move'; }}
                      onDragEnd={() => { setDraggingId(null); setDragOverCell(null); }}
                      title={`${student?.name} (${s.startTime}–${s.endTime}) — seret untuk jadwal ulang`}
                    >
                      <div className="font-medium truncate pr-4">{student?.name}</div>
                      <div className="opacity-60 truncate">{s.startTime}–{s.endTime}</div>
                      <button
                        draggable={false}
                        onDragStart={e => e.preventDefault()}
                        onClick={e => { e.stopPropagation(); openQuick(s); }}
                        title={t('sch.reschedule')}
                        className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/20 hover:bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <CalendarClock size={12} className="text-white" />
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}
          </div>
        </div>
      </div>

      {/* Month view grid */}
      {!bulkMode && viewMode === 'month' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          {/* Day name headers */}
          <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
            {DAY_LABELS.map(label => (
              <div key={label} className="py-2 text-center text-xs font-semibold text-gray-500 dark:text-gray-400">
                <span className="hidden sm:inline">{label.slice(0, 3)}</span>
                <span className="sm:hidden">{label.slice(0, 1)}</span>
              </div>
            ))}
          </div>
          {/* Weeks */}
          <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {monthGridWeeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 divide-x divide-gray-100 dark:divide-gray-700/50">
                {week.map((day, di) => {
                  const dayStr = format(day, 'yyyy-MM-dd');
                  const inMonth = isSameMonth(day, currentMonth);
                  const isToday = isSameDay(day, today);
                  const daySessions = filteredSessions
                    .filter(s => s.date === dayStr)
                    .sort((a, b) => a.startTime.localeCompare(b.startTime));
                  const visibleSessions = daySessions.slice(0, 3);
                  const overflow = daySessions.length - 3;
                  return (
                    <div
                      key={di}
                      onClick={() => setDayPanel(dayStr)}
                      className={`min-h-[72px] sm:min-h-[100px] p-1 cursor-pointer transition-colors select-none
                        ${inMonth ? 'hover:bg-gray-50 dark:hover:bg-gray-700/30' : 'bg-gray-50/60 dark:bg-gray-900/20'}`}
                    >
                      {/* Date number */}
                      <div className="flex justify-end mb-0.5">
                        <span className={`text-xs font-semibold flex items-center justify-center rounded-full w-5 h-5 sm:w-6 sm:h-6
                          ${isToday ? 'bg-indigo-600 text-white' : inMonth ? 'text-gray-700 dark:text-gray-200' : 'text-gray-300 dark:text-gray-600'}`}>
                          {format(day, 'd')}
                        </span>
                      </div>
                      {/* Session indicators — visual only, detail via panel */}
                      <div className="space-y-0.5">
                        {visibleSessions.map(s => {
                          const teacher = data.teachers.find(t => t.id === s.teacherId);
                          const color = teacher?.color ?? '#6366f1';
                          const student = data.students.find(st => st.id === s.studentId);
                          const groupColor = student ? GROUP_COLORS[student.group] : color;
                          return (
                            <div
                              key={s.id}
                              className={`w-full block rounded overflow-hidden leading-tight pointer-events-none ${s.status === 'completed' ? 'opacity-55' : ''}`}
                              style={{ backgroundColor: groupColor, borderLeft: `2px solid ${color}` }}
                            >
                              <span className="sm:hidden flex items-center justify-center py-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-white/80 inline-block" />
                              </span>
                              <span className="hidden sm:block text-xs text-white px-1.5 py-0.5 truncate">{student?.name ?? '—'}</span>
                            </div>
                          );
                        })}
                        {overflow > 0 && (
                          <div className="text-xs text-gray-400 dark:text-gray-500 px-0.5 font-medium">+{overflow}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Day detail panel (month view) */}
      {dayPanel && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setDayPanel(null)}>
          <div
            className="bg-white dark:bg-gray-800 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[80vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
              <div>
                <div className="font-semibold text-gray-900 dark:text-white capitalize">
                  {format(parseISO(dayPanel), 'EEEE', { locale })}
                </div>
                <div className="text-sm text-gray-400 dark:text-gray-500">
                  {format(parseISO(dayPanel), 'd MMMM yyyy', { locale })}
                </div>
              </div>
              <button onClick={() => setDayPanel(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg dark:text-gray-400">
                <X size={18} />
              </button>
            </div>

            {/* Session list */}
            <div className="overflow-y-auto flex-1">
              {(() => {
                const daySessions = filteredSessions
                  .filter(s => s.date === dayPanel)
                  .sort((a, b) => a.startTime.localeCompare(b.startTime));
                if (daySessions.length === 0) {
                  return (
                    <div className="px-5 py-8 text-center text-sm text-gray-400 dark:text-gray-500 italic">
              {t('sch.noSessions')}
            </div>
                  );
                }
                return (
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {daySessions.map(s => {
                      const student = data.students.find(st => st.id === s.studentId);
                      const teacher = data.teachers.find(t => t.id === s.teacherId);
                      const groupColor = student ? GROUP_COLORS[student.group] : '#6366f1';
                      return (
                        <div
                          key={s.id}
                          onClick={() => { setDayPanel(null); openEdit(s); }}
                          style={{ background: `${groupColor}22` }}
                          className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/40 text-left transition-colors cursor-pointer"
                        >
                          <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: teacher?.color ?? '#6366f1' }} />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{student?.name ?? '—'}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Clock size={11} className="text-gray-400 flex-shrink-0" />
                              <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{s.startTime} – {s.endTime}</span>
                              {filterTeacher === 'all' && (
                                <span className="text-xs text-gray-400 dark:text-gray-500">· {teacher?.name}</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); shiftSessionWeeks(s, 1); }}
                            title={t('sch.reschedTitle')}
                            className="flex-shrink-0 text-[11px] font-medium px-1.5 py-1 rounded text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                          >
                            {t('sch.plus1wkShort')}
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setDayPanel(null); openQuick(s); }}
                            title={t('sch.reschedule')}
                            className="flex-shrink-0 p-1 rounded text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                          >
                            <CalendarClock size={15} />
                          </button>
                          <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                            s.status === 'completed'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                          }`}>
                            {s.status === 'completed' ? t('status.completed') : t('status.scheduled')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Footer — add session */}
            <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
              <button
                onClick={() => { setDayPanel(null); openAdd(dayPanel); }}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white text-sm px-4 py-2.5 rounded-xl hover:bg-indigo-700"
              >
                <Plus size={16} /> {t('sch.addSession')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {bulkMode && selectedIds.size > 0 && (
        <div className="fixed bottom-20 md:bottom-6 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl p-4 w-full max-w-lg pointer-events-auto space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{t('sch.sessionsSelected', { n: selectedIds.size })}</span>
              <button onClick={() => { deselectAll(); setBulkConfirm(null); }} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={16} />
              </button>
            </div>

            {bulkConfirm === null && (
              <div className="flex gap-2">
                <button
                  onClick={() => setBulkConfirm('cancel')}
                  className="flex-1 flex items-center justify-center gap-1.5 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 size={15} /> {t('sch.deleteSchedule')}
                </button>
                <button
                  onClick={() => setBulkConfirm('copy')}
                  className="flex-1 flex items-center justify-center gap-1.5 border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 text-sm px-3 py-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                >
                  <Copy size={15} /> {t('sch.copy')}
                </button>
                <button
                  onClick={() => setBulkConfirm('reschedule')}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-indigo-700"
                >
                  <CalendarClock size={15} /> {t('sch.reschedule')}
                </button>
              </div>
            )}

            {bulkConfirm === 'cancel' && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('sch.bulkDeleteConfirm', { n: selectedIds.size })}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setBulkConfirm(null)} className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">
                    {t('sch.back')}
                  </button>
                  <button onClick={bulkCancel} className="flex-1 flex items-center justify-center gap-1.5 bg-red-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-red-700">
                    <Trash2 size={15} /> {t('sch.yesDelete')}
                  </button>
                </div>
              </div>
            )}

            {bulkConfirm === 'reschedule' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{t('sch.shift')}</span>
                  <input
                    type="number"
                    min="1"
                    max="52"
                    value={rescheduleWeeks}
                    onChange={e => setRescheduleWeeks(e.target.value)}
                    onKeyDown={e => (e.key === '-' || e.key === 'e') && e.preventDefault()}
                    className="w-16 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">{t('sch.weeksAhead')}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setBulkConfirm(null)} className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">
                    {t('sch.back')}
                  </button>
                  <button onClick={bulkReschedule} className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-indigo-700">
                    <CalendarClock size={15} /> {t('sch.reschedule')}
                  </button>
                </div>
              </div>
            )}

            {bulkConfirm === 'copy' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{t('sch.copyStartAt')}</span>
                  <input
                    type="number"
                    min="1"
                    max="52"
                    value={copyWeeks}
                    onChange={e => setCopyWeeks(e.target.value)}
                    onKeyDown={e => (e.key === '-' || e.key === 'e') && e.preventDefault()}
                    className="w-16 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">{t('sch.weeksAhead')}</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={copyIsRecurring}
                    onChange={e => setCopyIsRecurring(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600"
                  />
                  <RefreshCw size={13} className="text-gray-400 dark:text-gray-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{t('sch.copyRepeat')}</span>
                </label>
                {copyIsRecurring && (
                  <div className="flex items-center gap-2 pl-6">
                    <input
                      type="number"
                      min="1"
                      max="13"
                      value={copyCount}
                      onChange={e => setCopyCount(e.target.value)}
                      onKeyDown={e => (e.key === '-' || e.key === 'e') && e.preventDefault()}
                      className="w-16 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('sch.copyTimes')}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{t('sch.maxWeeks')}</span>
                  </div>
                )}
                {(() => {
                  const offset = Math.max(1, Number(copyWeeks) || 1);
                  const count = copyIsRecurring ? Math.max(1, Math.min(13, Number(copyCount) || 1)) : 1;
                  const total = selectedIds.size * count;
                  return (
                    <p className="text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg px-3 py-2">
                      +{offset} mgg{copyIsRecurring && count > 1 ? ` s/d +${offset + count - 1} mgg` : ''} · <strong>{total} sesi</strong> baru
                    </p>
                  );
                })()}
                <div className="flex gap-2">
                  <button onClick={() => setBulkConfirm(null)} className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">
                    {t('sch.back')}
                  </button>
                  <button onClick={bulkCopy} className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-indigo-700">
                    <Copy size={15} /> {t('sch.copy')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirm reschedule (+1mgg / drag & drop) */}
      {pendingMove && (() => {
        const { session, date, startTime, endTime } = pendingMove;
        const student = data.students.find(s => s.id === session.studentId);
        const sameDay = session.date === date;
        return (
          <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setPendingMove(null)}>
            <div className="bg-white dark:bg-gray-800 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-2">
                <CalendarClock size={18} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                <h3 className="font-semibold text-gray-900 dark:text-white">{t('sch.rescheduleQ')}</h3>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <div className="font-medium text-gray-900 dark:text-white">{student?.name ?? '—'}</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-gray-500 dark:text-gray-400">{format(parseISO(session.date), 'EEE, d MMM', { locale })} {session.startTime}</span>
                  <span className="text-gray-400">→</span>
                  <span className="font-medium text-indigo-700 dark:text-indigo-300">{format(parseISO(date), 'EEE, d MMM yyyy', { locale })} {startTime}{sameDay && startTime !== session.startTime ? `–${endTime}` : ''}</span>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setPendingMove(null)} className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">
                  {t('common.cancel')}
                </button>
                <button onClick={applyMove} className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-indigo-700">
                  <Check size={15} /> {t('sch.yesReschedule')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Quick reschedule popover */}
      {quickTarget && (() => {
        const student = data.students.find(s => s.id === quickTarget.studentId);
        return (
          <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setQuickTarget(null)}>
            <div className="bg-white dark:bg-gray-800 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <CalendarClock size={18} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">{t('sch.reschedule')}</h3>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                      {student?.name ?? '—'} · {t('sch.fromDate', { date: format(parseISO(quickTarget.date), 'd MMM', { locale }), time: quickTarget.startTime })}
                    </p>
                  </div>
                </div>
                <button onClick={() => setQuickTarget(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-400 rounded flex-shrink-0">
                  <X size={18} />
                </button>
              </div>

              {/* Quick nudges — langsung minta konfirmasi (geser dari tanggal asli sesi) */}
              <div className="flex gap-2">
                {([[t('sch.minus1wk'), -7], [t('sch.plus1day'), 1], [t('sch.plus1wk'), 7]] as [string, number][]).map(([label, days]) => (
                  <button
                    key={label}
                    onClick={() => {
                      const s = quickTarget;
                      if (!s) return;
                      setQuickTarget(null);
                      setPendingMove({ session: s, date: format(addDays(parseISO(s.date), days), 'yyyy-MM-dd'), startTime: s.startTime, endTime: s.endTime });
                    }}
                    className="flex-1 text-xs font-medium py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('common.date')}</label>
                <input
                  type="date"
                  value={quickForm.date}
                  onChange={e => setQuickForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('sch.start')}</label>
                  <input
                    type="time"
                    value={quickForm.startTime}
                    onChange={e => setQuickForm(f => ({ ...f, startTime: e.target.value }))}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('sch.end')}</label>
                  <input
                    type="time"
                    value={quickForm.endTime}
                    onChange={e => setQuickForm(f => ({ ...f, endTime: e.target.value }))}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {quickForm.date && (
                <div className="text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg px-3 py-2">
                  → {format(parseISO(quickForm.date), 'EEEE, d MMM yyyy', { locale })} · {quickForm.startTime}–{quickForm.endTime}
                </div>
              )}

              {quickConflicts.length > 0 && (
                <div className="flex items-start gap-1.5 text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg px-3 py-2">
                  <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                  <span>
                    {t('sch.conflict')}{' '}
                    {quickConflicts.map((s, i) => {
                      const st = data.students.find(x => x.id === s.studentId);
                      return (
                        <span key={s.id}>
                          {i > 0 && ', '}
                          <strong>{st?.name ?? '—'}</strong> ({s.startTime}–{s.endTime})
                        </span>
                      );
                    })}
                  </span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setQuickTarget(null)} className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">
                  {t('common.cancel')}
                </button>
                <button onClick={saveQuick} className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-indigo-700">
                  <Check size={15} /> {t('common.save')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Session Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">{editSession ? t('sch.editSession') : t('sch.addSession')}</h3>
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
                    {[...data.teachers].filter(te => te.isActive || te.id === form.teacherId).sort((a, b) => a.name.localeCompare(b.name, 'id')).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('common.student')}</label>
                  <select
                    value={form.studentId}
                    onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))}
                    className={`w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${showErrors && !form.studentId ? 'border-red-400 bg-red-50 dark:bg-red-900/20' : 'border-gray-300 dark:border-gray-600'}`}
                  >
                    <option value="">{t('common.selectStudent')}</option>
                    {[...availableStudents].sort((a, b) => a.name.localeCompare(b.name, 'id')).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {showErrors && !form.studentId && (
                    <p className="text-xs text-red-500 mt-1">{t('sch.studentRequired')}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('common.date')}</label>
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
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('sch.start')}</label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('sch.end')}</label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('sch.status')}</label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as LessonSession['status'] }))}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="scheduled">{t('status.scheduled')}</option>
                  <option value="completed" disabled={form.date > todayStr}>{t('status.completed')}</option>
                </select>
              </div>

              {form.studentId && selectedStudent && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-sm flex items-center gap-2">
                  <Clock size={14} className="text-gray-400 dark:text-gray-500" />
                  <span className="text-gray-600 dark:text-gray-300">
                    {t('sch.cost')}: <strong>{formatCurrency(selectedStudent.billingType === 'per-session' && form.date ? effectiveRate(selectedStudent, form.date) : selectedStudent.ratePerSession)}</strong>
                    {selectedStudent.billingType === 'package' && t('sch.pkgSuffix')}
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
                    <span className="text-sm text-gray-700 dark:text-gray-300">{t('sch.repeatWeekly')}</span>
                  </label>

                  {recurring && (
                    <div className="space-y-2 pl-6">
                      <div className="flex items-center gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('sch.howMany')}</label>
                          <input
                            type="number" min="1" max="13" onKeyDown={e => (e.key === '-' || e.key === 'e') && e.preventDefault()}
                            value={recurringCount}
                            onChange={e => setRecurringCount(e.target.value)}
                            className="w-20 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 pt-4">{t('sch.maxWeeks')}</p>
                      </div>

                      {form.date && lastRecurringDate && (
                        <div className="text-xs text-indigo-700 bg-indigo-50 rounded-lg px-3 py-2">
                          {format(parseISO(form.date), 'd MMM', { locale })}
                          {recurringCountNum > 1 && <> → {format(parseISO(lastRecurringDate), 'd MMM yyyy', { locale })}</>}
                          {' '}· <strong>{t('common.sessions_n', { n: recurringCountNum })}</strong>
                        </div>
                      )}

                      {prepaidOverLimit && (
                        <div className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                          <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                          {recurring
                            ? <span>{t('sch.pkgNotEnough', { remaining: remainingPkgSessions ?? 0, count: recurringCountNum })}</span>
                            : <span>{t('sch.pkgEmpty')}</span>
                          }
                        </div>
                      )}

                      {isPrepaid && remainingPkgSessions !== null && !prepaidOverLimit && (
                        <p className="text-xs text-gray-400 dark:text-gray-500">{t('sch.pkgRemaining', { n: remainingPkgSessions ?? 0 })}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* XuYuan weekend warning */}
              {hasWeekendWarning && (
                <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                  <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                  <span>
                    {weekendSessionDates.length === 1
                      ? t('sch.weekend1', { date: format(parseISO(weekendSessionDates[0]), 'EEE d MMM', { locale }) })
                      : t('sch.weekendN', { n: weekendSessionDates.length })}
                  </span>
                </div>
              )}

              {/* Libur nasional */}
              {holidayHits.length > 0 && (
                <div className="flex items-start gap-1.5 text-xs text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg px-3 py-2">
                  <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                  <span>
                    {holidayHits.map((h, i) => (
                      <span key={h.date}>
                        {i > 0 && ', '}
                        <strong>{h.holiday.name}</strong>
                        {h.holiday.tentative && ' *'}
                        {recurringDates.length > 1 && ` (${format(parseISO(h.date), 'd MMM', { locale })})`}
                      </span>
                    ))}
                    {holidayHits.some(h => h.holiday.tentative) && <span className="opacity-60">{t('sch.holidayTentative')}</span>}
                  </span>
                </div>
              )}

              {/* Konflik jadwal */}
              {teacherConflicts.length > 0 && (
                <div className="flex items-start gap-1.5 text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg px-3 py-2">
                  <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                  <span>
                    {t('sch.conflict')}{' '}
                    {teacherConflicts.map((s, i) => {
                      const st = data.students.find(x => x.id === s.studentId);
                      return (
                        <span key={s.id}>
                          {i > 0 && ', '}
                          <strong>{st?.name ?? '—'}</strong> ({s.startTime}–{s.endTime}
                          {recurringDates.length > 1 ? ` · ${format(parseISO(s.date), 'd MMM', { locale })}` : ''})
                        </span>
                      );
                    })}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('stu.notes')}</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder={t('sch.notesPh')}
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
                <Check size={16} /> {t('common.save')}
              </button>
              {editSession && (
                <button
                  onClick={() => { remove(editSession.id); setShowForm(false); }}
                  className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
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
