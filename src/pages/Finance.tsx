import { useState } from 'react';
import { ChevronLeft, ChevronRight, TrendingUp, Package, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { useApp } from '../store/AppContext';
import { formatCurrency, getPackageStatus } from '../utils/helpers';

export default function Finance() {
  const { data } = useApp();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [filterTeacher, setFilterTeacher] = useState('all');

  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  // Sessions this month
  const monthSessions = data.sessions.filter(
    s => s.date.startsWith(monthStr) && s.status === 'completed'
  );

  const teacherFilter = (teacherId: string) =>
    filterTeacher === 'all' || filterTeacher === teacherId;

  // Per-student breakdown
  const studentBreakdown = data.students
    .filter(s => teacherFilter(s.teacherId))
    .map(student => {
      const teacher = data.teachers.find(t => t.id === student.teacherId);
      const pkg = data.packages.find(p => p.studentId === student.id);
      const sessions = monthSessions.filter(s => s.studentId === student.id);
      const rate = pkg?.pricePerSession ?? student.ratePerSession;
      const total = sessions.length * rate;
      return { student, teacher, sessions, rate, total, pkg };
    })
    .filter(r => r.sessions.length > 0 || r.pkg);

  const grandTotal = studentBreakdown.reduce((sum, r) => sum + r.total, 0);

  // Package status overview
  const allPackageStatuses = data.packages
    .filter(p => teacherFilter(p.teacherId))
    .map(pkg => {
      const student = data.students.find(s => s.id === pkg.studentId);
      const teacher = data.teachers.find(t => t.id === pkg.teacherId);
      const studentPkgs = data.packages.filter(p => p.studentId === pkg.studentId);
      return { ...getPackageStatus(pkg, studentPkgs, data.sessions), student, teacher };
    });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Keuangan</h1>
      </div>

      {/* Teacher filter */}
      {data.teachers.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterTeacher('all')}
            className={`text-sm px-3 py-1.5 rounded-lg border ${filterTeacher === 'all' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600'}`}
          >Semua</button>
          {data.teachers.map(t => (
            <button key={t.id} onClick={() => setFilterTeacher(t.id)}
              className={`text-sm px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${filterTeacher === t.id ? 'text-white' : 'border-gray-300 text-gray-600'}`}
              style={filterTeacher === t.id ? { background: t.color, borderColor: t.color } : {}}
            >
              <div className="w-2 h-2 rounded-full" style={{ background: filterTeacher === t.id ? 'white' : t.color }} />
              {t.name}
            </button>
          ))}
        </div>
      )}

      {/* Month selector */}
      <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-2">
        <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded"><ChevronLeft size={18} /></button>
        <span className="flex-1 text-center text-sm font-medium capitalize">
          {format(new Date(year, month, 1), 'MMMM yyyy', { locale: localeId })}
        </span>
        <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded"><ChevronRight size={18} /></button>
      </div>

      {/* Summary card */}
      <div className="bg-indigo-600 text-white rounded-2xl p-6">
        <div className="flex items-center gap-2 text-indigo-200 text-sm mb-1">
          <TrendingUp size={16} />
          Total Pendapatan {format(new Date(year, month, 1), 'MMMM yyyy', { locale: localeId })}
        </div>
        <div className="text-3xl font-bold">{formatCurrency(grandTotal)}</div>
        <div className="text-indigo-200 text-sm mt-1">
          dari {studentBreakdown.reduce((s, r) => s + r.sessions.length, 0)} sesi selesai
        </div>
      </div>

      {/* Per-teacher breakdown */}
      {filterTeacher === 'all' && data.teachers.length > 1 && (
        <div className="grid gap-3 md:grid-cols-2">
          {data.teachers.map(teacher => {
            const teacherTotal = studentBreakdown
              .filter(r => r.teacher?.id === teacher.id)
              .reduce((s, r) => s + r.total, 0);
            const teacherSessions = studentBreakdown
              .filter(r => r.teacher?.id === teacher.id)
              .reduce((s, r) => s + r.sessions.length, 0);
            return (
              <div key={teacher.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: teacher.color }} />
                  <span className="font-medium text-gray-900">{teacher.name}</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{formatCurrency(teacherTotal)}</div>
                <div className="text-xs text-gray-500 mt-0.5">{teacherSessions} sesi selesai</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Per-student breakdown */}
      <div>
        <h2 className="font-semibold text-gray-900 mb-3">Detail Per Murid</h2>
        {studentBreakdown.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">
            Belum ada sesi selesai bulan ini
          </div>
        ) : (
          <div className="space-y-2">
            {studentBreakdown.filter(r => r.sessions.length > 0).map(({ student, teacher, sessions, rate, total }) => (
              <div key={student.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: teacher?.color }} />
                      <span className="font-medium text-gray-900">{student.name}</span>
                      {student.billingType === 'package' && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">paket</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {teacher?.name} · {sessions.length} sesi × {formatCurrency(rate)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {sessions.map(s => format(parseISO(s.date), 'd MMM', { locale: localeId })).join(', ')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">{formatCurrency(total)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Package status */}
      {allPackageStatuses.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Package size={16} /> Status Paket
          </h2>
          <div className="space-y-2">
            {allPackageStatuses.map(({ pkg, student, teacher, usedSessions, remainingSessions, estimatedEndDate, isExpired, isExpiringSoon }) => (
              <div
                key={pkg.id}
                className={`bg-white border rounded-xl p-4 ${
                  isExpired ? 'border-red-200' : isExpiringSoon ? 'border-amber-200' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: teacher?.color }} />
                      <span className="font-medium text-gray-900">{student?.name}</span>
                      {isExpired && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">HABIS</span>}
                      {isExpiringSoon && !isExpired && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Hampir habis</span>}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{teacher?.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">{usedSessions}/{pkg.totalSessions} sesi</div>
                    <div className="text-xs text-gray-500">sisa {remainingSessions}</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3 bg-gray-100 rounded-full h-1.5">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (usedSessions / pkg.totalSessions) * 100)}%`,
                      background: isExpired ? '#ef4444' : isExpiringSoon ? '#f59e0b' : teacher?.color ?? '#6366f1',
                    }}
                  />
                </div>

                {estimatedEndDate && !isExpired && (
                  <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                    <Clock size={11} />
                    Estimasi habis: {format(estimatedEndDate, 'd MMMM yyyy', { locale: localeId })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
