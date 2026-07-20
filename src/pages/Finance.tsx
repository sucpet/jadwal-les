import { useState } from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Pencil, Check, X, Crown } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { formatCurrency, formatDate, getPackageStatus } from '../utils/helpers';
import { durationMinutes } from '../utils/xuyuan';

const RATE_PRIVATE    = 100_000;
const RATE_SEMI_GROUP = 135_000;
const WORKSHEET_PRICE =  20_000;

export default function Finance() {
  const { data, updateTeacher } = useApp();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const monthStr = format(month, 'yyyy-MM');

  const startEdit = (id: string, current: number) => {
    setEditingId(id);
    setEditValue(String(current));
  };
  const saveEdit = (id: string) => {
    const val = Number(editValue.replace(/\D/g, ''));
    if (val > 0) updateTeacher(id, { honorPerSession: val });
    setEditingId(null);
  };
  const cancelEdit = () => setEditingId(null);

  const owners    = data.teachers.filter(t => t.isOwner);
  const nonOwners = data.teachers.filter(t => !t.isOwner);

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Keuangan</h1>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">Pendapatan pemilik & honor laoshi</p>
      </div>

      {/* ── Pemilik ── */}
      {owners.map(teacher => {
        const ownerStudentIds = new Set(
          data.students.filter(s => s.teacherId === teacher.id).map(s => s.id)
        );

        const monthSessions = data.sessions.filter(s =>
          s.teacherId === teacher.id &&
          s.date.startsWith(monthStr) &&
          s.status === 'completed'
        );

        let incomeXuYuan = 0;
        let incomeWorksheet = 0;
        let incomePribadi = 0;
        let incomeWenwen = 0;

        monthSessions.forEach(s => {
          const student = data.students.find(st => st.id === s.studentId);
          if (!student) return;

          if (student.group === 'xuyuan') {
            const rate = student.xuYuanType === 'semi-group' ? RATE_SEMI_GROUP : RATE_PRIVATE;
            incomeXuYuan += Math.round(durationMinutes(s) / 60 * rate);
          } else {
            const studentPkgs = data.packages.filter(p => p.studentId === student.id);
            let sessionRate: number;
            if (student.billingType === 'per-session' || studentPkgs.length === 0) {
              sessionRate = student.ratePerSession;
            } else {
              const activePkg = [...studentPkgs].sort((a, b) =>
                b.startDate.localeCompare(a.startDate)
              )[0];
              sessionRate = activePkg?.pricePerSession ?? student.ratePerSession;
            }
            if (student.group === 'pribadi') incomePribadi += sessionRate;
            else if (student.group === 'wenwen_aizhongwen') incomeWenwen += sessionRate;
          }
        });

        incomeWorksheet = data.worksheets
          .filter(w => w.date.startsWith(monthStr) && ownerStudentIds.has(w.studentId))
          .reduce((sum, w) => sum + w.pages * WORKSHEET_PRICE, 0);

        const totalOwnerIncome = incomeXuYuan + incomeWorksheet + incomePribadi + incomeWenwen;

        const incomeRows = [
          { label: 'XuYuan (jam mengajar)', value: incomeXuYuan },
          { label: 'Worksheet XuYuan', value: incomeWorksheet },
          { label: 'Pribadi', value: incomePribadi },
          { label: 'WenWen / AiZhongWen', value: incomeWenwen },
        ];

        return (
          <div key={teacher.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: teacher.color }} />
              <span className="font-semibold text-gray-900 dark:text-white">{teacher.name}</span>
              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full ml-1">
                <Crown size={11} /> Pemilik
              </span>
              <button
                onClick={() => updateTeacher(teacher.id, { isOwner: false })}
                className="ml-auto text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                Ubah ke laoshi biasa
              </button>
            </div>

            {/* Month selector */}
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setMonth(m => subMonths(m, 1))}
                className="p-1 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize min-w-28 text-center">
                {format(month, 'MMMM yyyy', { locale: localeId })}
              </span>
              <button
                onClick={() => setMonth(m => addMonths(m, 1))}
                className="p-1 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Income breakdown */}
            <div className="space-y-2">
              {incomeRows.map(row => (
                <div
                  key={row.label}
                  className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <span className="text-sm text-gray-600 dark:text-gray-400">{row.label}</span>
                  <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                    {row.value > 0 ? formatCurrency(row.value) : '—'}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                Total {format(month, 'MMMM', { locale: localeId })}
              </span>
              <span className="text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">
                {formatCurrency(totalOwnerIncome)}
              </span>
            </div>
          </div>
        );
      })}

      {/* ── Non-owner teachers ── */}
      {nonOwners.map(teacher => {
        const isEditing = editingId === teacher.id;

        // Package-based students
        const teacherPkgs = data.packages.filter(p => p.teacherId === teacher.id);
        const pkgRows = teacherPkgs.map(pkg => {
          const studentPkgs = data.packages.filter(p => p.studentId === pkg.studentId);
          const studentSessions = data.sessions.filter(s => s.studentId === pkg.studentId);
          const status = getPackageStatus(pkg, studentPkgs, studentSessions);
          const student = data.students.find(s => s.id === pkg.studentId);
          return { status, student };
        }).sort((a, b) => {
          if (a.status.isExpired !== b.status.isExpired) return a.status.isExpired ? 1 : -1;
          return b.status.pkg.startDate.localeCompare(a.status.pkg.startDate);
        });

        // Per-session students (no packages linked to this teacher)
        const pkgStudentIds = new Set(teacherPkgs.map(p => p.studentId));
        const perSessionStudents = data.students.filter(
          s => s.teacherId === teacher.id && !pkgStudentIds.has(s.id)
        );
        const perSessionRows = perSessionStudents.map(student => {
          const completedSessions = data.sessions.filter(
            s => s.studentId === student.id && s.status === 'completed'
          ).length;
          return { student, completedSessions };
        });

        const honorFromPkgs = pkgRows.reduce(
          (sum, { status }) => sum + status.usedSessions * teacher.honorPerSession, 0
        );
        const honorFromPerSession = perSessionRows.reduce(
          (sum, r) => sum + r.completedSessions * teacher.honorPerSession, 0
        );
        const totalHonorEarned = honorFromPkgs + honorFromPerSession;
        const totalHonorCommitted = pkgRows.reduce(
          (sum, { status }) => sum + status.pkg.totalSessions * teacher.honorPerSession, 0
        );

        return (
          <div key={teacher.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: teacher.color }} />
              <span className="font-semibold text-gray-900 dark:text-white">{teacher.name}</span>
              <button
                onClick={() => updateTeacher(teacher.id, { isOwner: true })}
                className="ml-auto text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                Tandai sebagai pemilik
              </button>
            </div>

            {/* Package rows */}
            {pkgRows.length === 0 && perSessionRows.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 py-2">
                Belum ada murid terdaftar.
              </p>
            ) : (
              <div className="space-y-2 mb-4">
                {pkgRows.map(({ status, student }) => {
                  const honorEarned = status.usedSessions * teacher.honorPerSession;
                  const honorTotal  = status.pkg.totalSessions * teacher.honorPerSession;
                  const pct = status.pkg.totalSessions > 0
                    ? (status.usedSessions / status.pkg.totalSessions) * 100
                    : 0;

                  return (
                    <div
                      key={status.pkg.id}
                      className={`rounded-lg p-3 ${
                        status.isExpired
                          ? 'bg-gray-50 dark:bg-gray-700/30'
                          : 'bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {student?.name ?? '—'}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
                            {status.usedSessions}/{status.pkg.totalSessions} sesi
                          </span>
                          <span className={`text-sm font-semibold tabular-nums ${
                            status.isExpired
                              ? 'text-gray-500 dark:text-gray-400'
                              : 'text-indigo-700 dark:text-indigo-300'
                          }`}>
                            {formatCurrency(honorEarned)}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            status.isExpired ? 'bg-gray-400 dark:bg-gray-500' : 'bg-indigo-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {formatDate(status.pkg.startDate, 'd MMM yyyy')}
                          {status.isExpired && <span className="ml-1">· Selesai</span>}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
                          total paket {formatCurrency(honorTotal)}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {perSessionRows.map(({ student, completedSessions }) => {
                  const honorEarned = completedSessions * teacher.honorPerSession;
                  return (
                    <div
                      key={student.id}
                      className="rounded-lg p-3 bg-gray-50 dark:bg-gray-700/30"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {student.name}
                          </span>
                          <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">per sesi</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
                            {completedSessions} sesi selesai
                          </span>
                          <span className="text-sm font-semibold tabular-nums text-gray-700 dark:text-gray-300">
                            {formatCurrency(honorEarned)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer: total + edit rate */}
            <div className="flex items-center gap-4 pt-3 border-t border-gray-100 dark:border-gray-700">
              <div className="flex-1">
                <div className="text-xs text-gray-500 dark:text-gray-400">Honor terkumpul</div>
                <div className="text-xl font-bold tabular-nums text-indigo-700 dark:text-indigo-300">
                  {formatCurrency(totalHonorEarned)}
                </div>
                {totalHonorCommitted > totalHonorEarned && (
                  <div className="text-xs text-gray-400 dark:text-gray-500 tabular-nums mt-0.5">
                    dari total komitmen {formatCurrency(totalHonorCommitted)}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm flex-shrink-0">
                <span className="text-gray-500 dark:text-gray-400">Honor/sesi</span>
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">Rp</span>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveEdit(teacher.id);
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      autoFocus
                      className="w-24 border border-indigo-400 rounded-lg px-2 py-1 text-sm text-right tabular-nums bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      onClick={() => saveEdit(teacher.id)}
                      className="p-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                    >
                      <Check size={13} />
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="p-1 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="font-medium tabular-nums text-gray-900 dark:text-white">
                      {formatCurrency(teacher.honorPerSession)}
                    </span>
                    <button
                      onClick={() => startEdit(teacher.id, teacher.honorPerSession)}
                      className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <Pencil size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {data.teachers.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center text-gray-400 dark:text-gray-500">
          <p className="text-sm">Belum ada laoshi terdaftar.</p>
        </div>
      )}
    </div>
  );
}
