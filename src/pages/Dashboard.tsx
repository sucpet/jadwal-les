import { useState } from 'react';
import { format, parseISO, differenceInDays, addDays } from 'date-fns';
import { Clock, AlertTriangle, CheckCircle2, Calendar, UserX, CalendarClock, ChevronLeft, ChevronRight, CalendarX, MessageCircle } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { useLang } from '../store/LanguageContext';
import { getTodaySessions, getPackageStatus } from '../utils/helpers';
import { waLink, isValidPhone } from '../utils/whatsapp';
import { getHoliday } from '../utils/holidays';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { data } = useApp();
  const { t, locale } = useLang();
  const today = new Date();
  const todayStr    = format(today, 'yyyy-MM-dd');
  const todaySessions = getTodaySessions(data.sessions);

  const [upcomingPage, setUpcomingPage] = useState(0);
  const UPCOMING_PAGE_SIZE = 10;

  // Sesi 7 hari ke depan (kecuali hari ini)
  const tomorrowStr = format(addDays(today, 1), 'yyyy-MM-dd');
  const in7DaysStr  = format(addDays(today, 7), 'yyyy-MM-dd');
  const upcomingSessions = data.sessions
    .filter(s => s.status === 'scheduled' && s.date >= tomorrowStr && s.date <= in7DaysStr)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  // Murid berisiko churn: aktif, tidak ada sesi scheduled, sesi terakhir >= 21 hari lalu
  const churnRisk = data.students.filter(student => {
    if (!student.isActive) return false;
    const studentSessions = data.sessions.filter(s => s.studentId === student.id);
    if (studentSessions.some(s => s.status === 'scheduled')) return false;
    const lastCompleted = [...studentSessions]
      .filter(s => s.status === 'completed')
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!lastCompleted) return false;
    return differenceInDays(today, parseISO(lastCompleted.date)) >= 21;
  });

  // Package alerts — hanya paket aktif (terbaru per murid) yang hampir/sudah habis, dan murid masih aktif
  const packageAlerts = data.packages
    .map(pkg => {
      const studentPkgs = data.packages.filter(p => p.studentId === pkg.studentId);
      return getPackageStatus(pkg, studentPkgs, data.sessions);
    })
    .filter(s => {
      const student = data.students.find(st => st.id === s.pkg.studentId);
      return student?.isActive && s.isCurrent && (s.isExpiringSoon || s.isExpired);
    });

  // ── Alert #1: Sesi terjadwal di hari libur nasional ──────────────────────
  const holidayAlerts = (() => {
    const map = new Map<string, { name: string; date: string; count: number; tentative?: boolean }>();
    data.sessions.forEach(s => {
      if (s.status !== 'scheduled' || s.date < todayStr) return;
      const h = getHoliday(s.date);
      if (!h) return;
      if (!map.has(s.date)) map.set(s.date, { name: h.name, date: s.date, count: 0, tentative: h.tentative });
      map.get(s.date)!.count++;
    });
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  })();

  // ── Alert #2: Paket aktif tapi 0 sesi scheduled ──────────────────────────
  const packageAlertIds = new Set(packageAlerts.map(a => a.pkg.studentId));
  const packageNoSchedule = data.students.filter(student => {
    if (!student.isActive || student.billingType !== 'package') return false;
    if (packageAlertIds.has(student.id)) return false;
    const pkgs = data.packages.filter(p => p.studentId === student.id);
    if (!pkgs.length) return false;
    const latest = [...pkgs].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
    const st = getPackageStatus(latest, pkgs, data.sessions);
    if (!st.isCurrent || (st.remainingSessions !== null && st.remainingSessions <= 0)) return false;
    return !data.sessions.some(s => s.studentId === student.id && s.status === 'scheduled');
  });

  // ── Alert #3: Murid prepaid tanpa paket sama sekali ──────────────────────
  const prepaidNoPackage = data.students.filter(student => {
    if (!student.isActive || student.billingType !== 'package') return false;
    return data.packages.filter(p => p.studentId === student.id).length === 0;
  });

  // ── Alert #4: Laoshi non-owner tanpa jadwal 7 hari ke depan ──────────────
  const teacherNoSchedule = data.teachers.filter(teacher => {
    if (teacher.isOwner || !teacher.isActive) return false;
    const hasActiveStudents = data.students.some(s => s.teacherId === teacher.id && s.isActive);
    if (!hasActiveStudents) return false;
    return !data.sessions.some(s =>
      s.teacherId === teacher.id &&
      s.status === 'scheduled' &&
      s.date >= tomorrowStr &&
      s.date <= in7DaysStr
    );
  });


  // Group by teacher, each teacher gets max 1 completed (most recent) + 3 next scheduled
  const sessionsByTeacher = data.teachers.map(teacher => {
    const teacherSessions = todaySessions.filter(s => s.teacherId === teacher.id);
    const completed = teacherSessions.filter(s => s.status === 'completed');
    const scheduled = teacherSessions.filter(s => s.status === 'scheduled');
    const display = [...completed.slice(-1), ...scheduled.slice(0, 3)];
    return {
      teacher,
      sessions: display
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .map(s => ({
          session: s,
          student: data.students.find(st => st.id === s.studentId),
        })),
      totalCount: teacherSessions.length,
      completedCount: completed.length,
      leftCount: scheduled.length,
    };
  }).filter(t => t.sessions.length > 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {format(today, "EEEE, d MMMM yyyy", { locale })}
        </p>
      </div>

      {/* Alerts */}
      {(packageAlerts.length > 0 || churnRisk.length > 0 ||
        holidayAlerts.length > 0 || packageNoSchedule.length > 0 ||
        prepaidNoPackage.length > 0 || teacherNoSchedule.length > 0) && (
        <div className="space-y-2">

          {/* #1 Sesi di hari libur nasional */}
          {holidayAlerts.map(h => (
            <div key={h.date} className="flex items-start gap-3 p-3 rounded-lg border bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-300">
              <CalendarX size={16} className="mt-0.5 flex-shrink-0" />
              <div className="text-sm flex-1">
                {t('dash.holidayPrefix', { count: h.count })}{' '}
                <span className="font-medium">{h.name}</span>
                {h.tentative && <span className="text-xs opacity-75"> {t('common.tentativeDate')}</span>}
                {' '}— {format(parseISO(h.date), 'd MMMM yyyy', { locale })}.{' '}
                <Link to={`/schedule?date=${h.date}`} className="underline text-xs opacity-75 hover:opacity-100">
                  {t('dash.checkSchedule')}
                </Link>
              </div>
            </div>
          ))}

          {/* #2 Paket aktif tapi 0 sesi scheduled */}
          {packageNoSchedule.map(student => (
            <div key={student.id} className="flex items-start gap-3 p-3 rounded-lg border bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300">
              <CalendarClock size={16} className="mt-0.5 flex-shrink-0" />
              <div className="text-sm flex-1">
                <span className="font-medium">{student.name}</span>
                {' '}{t('dash.pkgNoSchedule')}{' '}
                <Link to="/schedule" className="underline text-xs opacity-75 hover:opacity-100">
                  {t('dash.scheduleVerb')}
                </Link>
              </div>
            </div>
          ))}

          {/* #3 Prepaid tanpa paket sama sekali */}
          {prepaidNoPackage.map(student => (
            <div key={student.id} className="flex items-start gap-3 p-3 rounded-lg border bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              <div className="text-sm flex-1">
                <span className="font-medium">{student.name}</span>
                {' '}{t('dash.noPackage')}{' '}
                <Link to={`/students?student=${student.id}`} className="underline text-xs opacity-75 hover:opacity-100">
                  {t('dash.createPackage')}
                </Link>
              </div>
            </div>
          ))}

          {/* Existing: churn risk */}
          {churnRisk.map(student => (
            <div key={student.id} className="flex items-start gap-3 p-3 rounded-lg border bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">
              <UserX size={16} className="mt-0.5 flex-shrink-0 text-gray-400" />
              <div className="text-sm flex-1">
                <span className="font-medium">{student.name}</span>
                {' '}{t('dash.churn')}{' '}
                <Link to="/schedule" className="underline text-xs opacity-75 hover:opacity-100">
                  {t('dash.scheduleVerb')}
                </Link>
              </div>
            </div>
          ))}

          {/* Existing: package expiry */}
          {packageAlerts.map(({ pkg, isExpired }) => {
            const student = data.students.find(s => s.id === pkg.studentId);
            const teacher = data.teachers.find(t => t.id === pkg.teacherId);
            return (
              <div
                key={pkg.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  isExpired
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
                    : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                }`}
              >
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                <div className="text-sm flex-1">
                  <span className="font-medium">{student?.name}</span>
                  {isExpired ? t('dash.pkgExpired') : t('dash.pkgSoon')}
                  {teacher && <span className="text-xs opacity-75">({teacher.name})</span>}
                  {' '}
                  <Link to={`/students?student=${pkg.studentId}`} className="underline text-xs opacity-75 hover:opacity-100">
                    {t('dash.renewPackage')}
                  </Link>
                </div>
              </div>
            );
          })}

          {/* #4 Laoshi tanpa jadwal 7 hari ke depan */}
          {teacherNoSchedule.map(teacher => (
            <div key={teacher.id} className="flex items-start gap-3 p-3 rounded-lg border bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">
              <Clock size={16} className="mt-0.5 flex-shrink-0 text-gray-400" />
              <div className="text-sm flex-1">
                <span className="font-medium">{teacher.name}</span>
                {' '}{t('dash.teacherNoSchedule')}{' '}
                <Link to={`/schedule?teacher=${teacher.id}`} className="underline text-xs opacity-75 hover:opacity-100">
                  {t('dash.viewSchedule')}
                </Link>
              </div>
            </div>
          ))}


        </div>
      )}

      {/* Today's schedule */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Calendar size={18} />
            {t('dash.todaySchedule')}
          </h2>
          <Link to="/schedule" className="text-sm text-indigo-600 hover:underline">
            {t('dash.seeAll')}
          </Link>
        </div>

        {todaySessions.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-400 dark:text-gray-500">
            <Calendar size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">{t('dash.noToday')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sessionsByTeacher.map(({ teacher, sessions, completedCount, leftCount }) => (
              <div key={teacher.id}>
                <div className="mb-2 flex items-center gap-2">
                  <div
                    className="text-xs font-semibold uppercase tracking-wide flex items-center gap-2"
                    style={{ color: teacher.color }}
                  >
                    <div className="w-2 h-2 rounded-full" style={{ background: teacher.color }} />
                    {teacher.name}
                  </div>
                  <span className="text-xs font-normal text-gray-400 dark:text-gray-500">
                    · {t('dash.doneCount', { n: completedCount })} · {t('dash.leftCount', { n: leftCount })}
                  </span>
                </div>
                <div className="space-y-2">
                  {sessions.map(({ session, student }) => (
                    <div
                      key={session.id}
                      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 flex items-center gap-3"
                    >
                      <div
                        className="w-1 self-stretch rounded-full"
                        style={{ background: teacher.color }}
                      />
                      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
                        <Clock size={14} />
                        <span>{session.startTime}–{session.endTime}</span>
                      </div>
                      <div className="flex-1">
                        <span className="font-medium text-gray-900 dark:text-white">{student?.name ?? '—'}</span>
                        {student?.billingType === 'package' && (
                          <span className="ml-2 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded">{t('common.package')}</span>
                        )}
                      </div>
                      {session.status !== 'completed' && student && isValidPhone(student.phone) && (
                        <a
                          href={waLink(student.phone, t('wa.reminderMsg', {
                            name: student.name,
                            time: `${session.startTime}–${session.endTime}`,
                          }))}
                          target="_blank" rel="noopener noreferrer"
                          title={t('wa.remind')}
                          className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 px-1.5 py-1 rounded-md flex-shrink-0"
                        >
                          <MessageCircle size={14} />
                        </a>
                      )}
                      <div className={`text-xs px-2 py-0.5 rounded-full ${
                        session.status === 'completed'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                      }`}>
                        {session.status === 'completed' ? t('status.completed') : t('status.scheduled')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming 7 days */}
      {upcomingSessions.length > 0 && (() => {
        const pageCount = Math.ceil(upcomingSessions.length / UPCOMING_PAGE_SIZE);
        const pageItems = upcomingSessions.slice(upcomingPage * UPCOMING_PAGE_SIZE, (upcomingPage + 1) * UPCOMING_PAGE_SIZE);
        const groupedByDate = pageItems.reduce<{ date: string; sessions: typeof pageItems }[]>((acc, s) => {
          const last = acc[acc.length - 1];
          if (last?.date === s.date) last.sessions.push(s);
          else acc.push({ date: s.date, sessions: [s] });
          return acc;
        }, []);
        return (
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
              <CalendarClock size={18} />
              {t('dash.next7')}
              <span className="text-xs font-normal text-gray-400 dark:text-gray-500">({t('common.sessions_n', { n: upcomingSessions.length })})</span>
            </h2>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {groupedByDate.map(({ date, sessions }, groupIdx) => (
                <div key={date} className={groupIdx > 0 ? 'border-t border-gray-200 dark:border-gray-700' : ''}>
                  <div className="px-4 py-1.5 bg-gray-50 dark:bg-gray-700/50 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    {format(parseISO(date), 'EEEE, d MMMM', { locale })}
                  </div>
                  {sessions.map(s => {
                    const student = data.students.find(st => st.id === s.studentId);
                    const teacher = data.teachers.find(t => t.id === s.teacherId);
                    return (
                      <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 border-t border-gray-100 dark:border-gray-700/60">
                        <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white truncate">{student?.name ?? '—'}</span>
                        <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 tabular-nums">{s.startTime}–{s.endTime}</span>
                        {teacher && (
                          <span className="flex items-center gap-1 text-xs flex-shrink-0 w-24 justify-end" style={{ color: teacher.color }}>
                            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: teacher.color }} />
                            {teacher.name}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
              {pageCount > 1 && (
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setUpcomingPage(p => p - 1)}
                    disabled={upcomingPage === 0}
                    className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={13} /> {t('dash.prev')}
                  </button>
                  <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
                    {upcomingPage + 1} / {pageCount}
                  </span>
                  <button
                    onClick={() => setUpcomingPage(p => p + 1)}
                    disabled={upcomingPage === pageCount - 1}
                    className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {t('dash.next')} <ChevronRight size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={t('dash.statTeachers')} value={data.teachers.length} />
        <StatCard label={t('dash.statStudents')} value={data.students.length} />
        <StatCard label={t('dash.statMonth')} value={getThisMonthSessions(data.sessions)} />
        <StatCard label={t('dash.statPkgStudents')} value={data.students.filter(s => s.billingType === 'package').length} />
      </div>
      {/* Per-teacher summary */}
      {data.teachers.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3">{t('dash.perTeacher')}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {data.teachers.map(teacher => {
              const teacherStudents = data.students.filter(s => s.teacherId === teacher.id);
              const thisMonthSessions = getThisMonthSessions(
                data.sessions.filter(s => s.teacherId === teacher.id)
              );
              return (
                <Link
                  key={teacher.id}
                  to={`/schedule?teacher=${teacher.id}`}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full" style={{ background: teacher.color }} />
                    <span className="font-medium text-gray-900 dark:text-white">{teacher.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-gray-500 dark:text-gray-400">{t('dash.students')}</div>
                    <div className="text-right font-medium dark:text-gray-200">{teacherStudents.length}</div>
                    <div className="text-gray-500 dark:text-gray-400">{t('dash.monthSessions')}</div>
                    <div className="text-right font-medium dark:text-gray-200">{thisMonthSessions}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {data.teachers.length === 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6 text-center">
          <GraduationCapIcon />
          <p className="text-indigo-800 font-medium mb-1">{t('dash.noTeachers')}</p>
          <p className="text-indigo-600 text-sm mb-3">{t('dash.noTeachersDesc')}</p>
          <Link
            to="/teachers"
            className="inline-block bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700"
          >
            {t('dash.addTeacher')}
          </Link>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</div>
    </div>
  );
}

function GraduationCapIcon() {
  return (
    <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
      <CheckCircle2 size={24} className="text-indigo-600" />
    </div>
  );
}

function getThisMonthSessions(sessions: { date: string; status: string }[]) {
  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return sessions.filter(s => s.date?.startsWith(monthStr) && s.status === 'completed').length;
}
