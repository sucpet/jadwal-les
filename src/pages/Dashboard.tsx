import { format, parseISO, differenceInDays, addDays } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Clock, AlertTriangle, CheckCircle2, Calendar, TrendingUp, UserX, CalendarClock } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { getTodaySessions, getPackageStatus, getMonthlyRevenue, formatCurrency } from '../utils/helpers';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { data } = useApp();
  const today = new Date();
  const todaySessions = getTodaySessions(data.sessions);

  // Pendapatan bulan ini (non-XuYuan, semua guru digabung)
  const monthlyRevenue = data.teachers.reduce((sum, teacher) =>
    sum + getMonthlyRevenue(data.sessions, data.students, data.packages, teacher.id, today.getFullYear(), today.getMonth()), 0
  );

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
    };
  }).filter(t => t.sessions.length > 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {format(today, "EEEE, d MMMM yyyy", { locale: localeId })}
        </p>
      </div>

      {/* Alerts */}
      {(packageAlerts.length > 0 || churnRisk.length > 0) && (
        <div className="space-y-2">
          {churnRisk.map(student => (
            <div key={student.id} className="flex items-start gap-3 p-3 rounded-lg border bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">
              <UserX size={16} className="mt-0.5 flex-shrink-0 text-gray-400" />
              <div className="text-sm flex-1">
                <span className="font-medium">{student.name}</span>
                {' '}— belum ada sesi terjadwal sejak lebih dari 3 minggu.{' '}
                <Link to="/schedule" className="underline text-xs opacity-75 hover:opacity-100">
                  Jadwalkan →
                </Link>
              </div>
            </div>
          ))}
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
                  {isExpired
                    ? ' — paket habis! '
                    : ' — paket hampir habis, tinggal 1 sesi. '}
                  {teacher && <span className="text-xs opacity-75">({teacher.name})</span>}
                  {' '}
                  <Link to="/students" className="underline text-xs opacity-75 hover:opacity-100">
                    Perbarui paket →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Today's schedule */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Calendar size={18} />
            Jadwal Hari Ini
            {todaySessions.length > 0 && (
              <span className="text-xs font-normal text-gray-400 dark:text-gray-500">({todaySessions.length} sesi)</span>
            )}
          </h2>
          <Link to="/schedule" className="text-sm text-indigo-600 hover:underline">
            Lihat semua →
          </Link>
        </div>

        {todaySessions.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-400 dark:text-gray-500">
            <Calendar size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">Tidak ada jadwal hari ini</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sessionsByTeacher.map(({ teacher, sessions }) => (
              <div key={teacher.id}>
                <div
                  className="text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-2"
                  style={{ color: teacher.color }}
                >
                  <div className="w-2 h-2 rounded-full" style={{ background: teacher.color }} />
                  {teacher.name}
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
                          <span className="ml-2 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded">paket</span>
                        )}
                      </div>
                      <div className={`text-xs px-2 py-0.5 rounded-full ${
                        session.status === 'completed'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                      }`}>
                        {session.status === 'completed' ? 'Selesai' : 'Terjadwal'}
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
      {upcomingSessions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <CalendarClock size={18} />
              7 Hari ke Depan
              <span className="text-xs font-normal text-gray-400 dark:text-gray-500">({upcomingSessions.length} sesi)</span>
            </h2>
            <Link to="/schedule" className="text-sm text-indigo-600 hover:underline">Lihat semua →</Link>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
            {upcomingSessions.slice(0, 8).map(s => {
              const student = data.students.find(st => st.id === s.studentId);
              const teacher = data.teachers.find(t => t.id === s.teacherId);
              return (
                <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-xs text-gray-400 dark:text-gray-500 w-20 flex-shrink-0 tabular-nums">
                    {format(parseISO(s.date), 'EEE d MMM', { locale: localeId })}
                  </span>
                  <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ background: teacher?.color ?? '#6366f1' }} />
                  <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white truncate">{student?.name ?? '—'}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 tabular-nums">{s.startTime}–{s.endTime}</span>
                </div>
              );
            })}
            {upcomingSessions.length > 8 && (
              <div className="px-4 py-2 text-xs text-gray-400 dark:text-gray-500 text-center">
                +{upcomingSessions.length - 8} sesi lainnya
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Laoshi" value={data.teachers.length} />
        <StatCard label="Total Murid" value={data.students.length} />
        <StatCard label="Sesi Bulan Ini" value={getThisMonthSessions(data.sessions)} />
        <StatCard label="Murid Paket" value={data.students.filter(s => s.billingType === 'package').length} />
      </div>
      {monthlyRevenue > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
          <TrendingUp size={18} className="text-indigo-500 flex-shrink-0" />
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Pendapatan bulan ini</div>
            <div className="text-xl font-bold tabular-nums text-gray-900 dark:text-white">{formatCurrency(monthlyRevenue)}</div>
          </div>
        </div>
      )}

      {/* Per-teacher summary */}
      {data.teachers.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Ringkasan Per Laoshi</h2>
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
                    <div className="text-gray-500 dark:text-gray-400">Murid</div>
                    <div className="text-right font-medium dark:text-gray-200">{teacherStudents.length}</div>
                    <div className="text-gray-500 dark:text-gray-400">Sesi bulan ini</div>
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
          <p className="text-indigo-800 font-medium mb-1">Belum ada laoshi</p>
          <p className="text-indigo-600 text-sm mb-3">Mulai dengan menambahkan laoshi terlebih dahulu</p>
          <Link
            to="/teachers"
            className="inline-block bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700"
          >
            Tambah Laoshi
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
