import { useState } from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Pencil, Check, X, Crown } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { formatCurrency } from '../utils/helpers';
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

  const totalPayroll = nonOwners.reduce((sum, teacher) => {
    const sessions = data.sessions.filter(s =>
      s.teacherId === teacher.id &&
      s.date.startsWith(monthStr) &&
      s.status === 'completed'
    );
    return sum + sessions.length * teacher.honorPerSession;
  }, 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Keuangan</h1>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">Pendapatan pemilik & honor laoshi</p>
      </div>

      {/* Month selector */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMonth(m => subMonths(m, 1))}
          className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="font-semibold text-gray-900 dark:text-white capitalize min-w-36 text-center">
          {format(month, 'MMMM yyyy', { locale: localeId })}
        </span>
        <button
          onClick={() => setMonth(m => addMonths(m, 1))}
          className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <ChevronRight size={16} />
        </button>
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

        // XuYuan: per jam sesi selesai bulan ini
        monthSessions.forEach(s => {
          const student = data.students.find(st => st.id === s.studentId);
          if (!student || student.group !== 'xuyuan') return;
          const rate = student.xuYuanType === 'semi-group' ? RATE_SEMI_GROUP : RATE_PRIVATE;
          incomeXuYuan += Math.round(durationMinutes(s) / 60 * rate);
        });

        // Pribadi & WenWen: paket → harga paket penuh di bulan startDate; per-sesi → per sesi selesai
        data.students
          .filter(s => s.teacherId === teacher.id && s.group !== 'xuyuan')
          .forEach(student => {
            const add = (amount: number) => {
              if (student.group === 'pribadi') incomePribadi += amount;
              else if (student.group === 'wenwen_aizhongwen') incomeWenwen += amount;
            };
            if (student.billingType === 'package') {
              // Hitung paket yang dimulai bulan ini
              data.packages
                .filter(p => p.studentId === student.id && p.startDate.startsWith(monthStr))
                .forEach(pkg => {
                  add(pkg.packagePrice ?? pkg.totalSessions * pkg.pricePerSession);
                });
            } else {
              // Per-sesi: hitung sesi selesai bulan ini
              const count = monthSessions.filter(s => s.studentId === student.id).length;
              if (count > 0) add(count * student.ratePerSession);
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

        const monthSessions = data.sessions.filter(s =>
          s.teacherId === teacher.id &&
          s.date.startsWith(monthStr) &&
          s.status === 'completed'
        );

        const studentBreakdown = data.students
          .filter(s => s.teacherId === teacher.id)
          .map(student => {
            const count = monthSessions.filter(s => s.studentId === student.id).length;
            return { student, count };
          })
          .filter(r => r.count > 0)
          .sort((a, b) => b.count - a.count);

        const totalHonor = monthSessions.length * teacher.honorPerSession;

        return (
          <div key={teacher.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: teacher.color }} />
              <span className="font-semibold text-gray-900 dark:text-white">{teacher.name}</span>
              {monthSessions.length === 0 && (
                <span className="text-xs text-gray-400 dark:text-gray-500">Tidak ada sesi bulan ini</span>
              )}
              <button
                onClick={() => updateTeacher(teacher.id, { isOwner: true })}
                className="ml-auto text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                Tandai sebagai pemilik
              </button>
            </div>

            {/* Per-student breakdown */}
            {studentBreakdown.length > 0 && (
              <div className="space-y-1.5 mb-4">
                {studentBreakdown.map(({ student, count }) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">{student.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
                        {count} sesi
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                        {formatCurrency(count * teacher.honorPerSession)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Footer: total + edit rate */}
            <div className="flex items-center gap-4 pt-3 border-t border-gray-100 dark:border-gray-700">
              <div className="flex-1">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Total honor {format(month, 'MMMM', { locale: localeId })}
                </div>
                <div className="text-xl font-bold tabular-nums text-indigo-700 dark:text-indigo-300">
                  {formatCurrency(totalHonor)}
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 tabular-nums mt-0.5">
                  {monthSessions.length} sesi × {formatCurrency(teacher.honorPerSession)}
                </div>
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

      {/* Total payroll */}
      {nonOwners.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-5 py-4 flex items-center justify-between">
          <span className="font-semibold text-gray-900 dark:text-white">
            Total Honor {format(month, 'MMMM', { locale: localeId })}
          </span>
          <span className="text-xl font-bold tabular-nums text-gray-900 dark:text-white">
            {formatCurrency(totalPayroll)}
          </span>
        </div>
      )}

      {data.teachers.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center text-gray-400 dark:text-gray-500">
          <p className="text-sm">Belum ada laoshi terdaftar.</p>
        </div>
      )}
    </div>
  );
}
