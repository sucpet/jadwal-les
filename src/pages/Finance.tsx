import { useState } from 'react';
import { format, parseISO, subMonths } from 'date-fns';
import { Pencil, Check, X, Crown, ArrowRight, CalendarClock } from 'lucide-react';
import MonthSelector from '../components/MonthSelector';
import { Link } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { useLang } from '../store/LanguageContext';
import { formatCurrency, effectiveHonor, effectiveRate } from '../utils/helpers';
import { durationMinutes } from '../utils/xuyuan';

const RATE_PRIVATE    = 100_000;
const RATE_SEMI_GROUP = 135_000;
const WORKSHEET_PRICE =  20_000;

// Penyesuaian manual: 6,5 jam private + 0,5 jam semi-group di Mei yang tidak tercatat (siklus Jun 2026)
const XUYUAN_ADJ_2026_06 = Math.round(6.5 * RATE_PRIVATE + 0.5 * RATE_SEMI_GROUP); // 717_500

export default function Finance() {
  const { data, updateTeacher } = useApp();
  const { t, locale } = useLang();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [pendingHonorValue, setPendingHonorValue] = useState('');
  const [pendingDateValue, setPendingDateValue] = useState('');

  const monthStr = format(month, 'yyyy-MM');

  const startEdit = (teacher: typeof data.teachers[0]) => {
    setEditingId(teacher.id);
    setEditValue(String(teacher.honorPerSession));
    setPendingHonorValue(teacher.pendingHonor != null ? String(teacher.pendingHonor) : '');
    setPendingDateValue(teacher.pendingHonorEffectiveDate ?? '');
  };
  const saveEdit = (id: string) => {
    const val = Number(editValue.replace(/\D/g, ''));
    if (!(val > 0)) { setEditingId(null); return; }
    const ph = Number(pendingHonorValue.replace(/\D/g, ''));
    const hasPending = pendingHonorValue !== '' && pendingDateValue !== '' && ph > 0;
    updateTeacher(id, {
      honorPerSession: val,
      pendingHonor: hasPending ? ph : undefined,
      pendingHonorEffectiveDate: hasPending ? pendingDateValue : undefined,
    });
    setEditingId(null);
  };
  const cancelEdit = () => setEditingId(null);

  const owners    = data.teachers.filter(t => t.isOwner);
  const nonOwners = data.teachers.filter(t => !t.isOwner);

  const honorOf = (teacher: typeof data.teachers[0], sessions: typeof data.sessions) =>
    sessions.reduce((sum, s) => sum + (s.honorSnapshot ?? effectiveHonor(teacher, s.date)), 0);

  // Rincian honor guru untuk bulan ini: sesi normal bulan berjalan (kecuali murid deferred)
  // + murid dibayar-lembaga yang pembayaran PERTAMA-nya jatuh di bulan ini (seluruh honornya).
  const teacherHonorBreakdown = (teacher: typeof data.teachers[0]) => {
    const rows: { student: typeof data.students[0]; honor: number; deferred: boolean; count: number }[] = [];
    data.students.filter(st => st.teacherId === teacher.id && !st.deferredPayment).forEach(st => {
      // Postpaid: sesi selesai + terjadwal (scheduled ikut dihitung); lainnya hanya completed
      const postpaid = st.billingType === 'per-session';
      const ss = data.sessions.filter(s => s.studentId === st.id && s.date.startsWith(monthStr) &&
        (s.status === 'completed' || (postpaid && s.status === 'scheduled')));
      if (ss.length) rows.push({ student: st, honor: honorOf(teacher, ss), deferred: false, count: ss.length });
    });
    data.students.filter(st => st.teacherId === teacher.id && st.deferredPayment).forEach(st => {
      const pays = data.payments.filter(p => p.studentId === st.id).sort((a, b) => a.date.localeCompare(b.date));
      if (pays.length && pays[0].date.startsWith(monthStr)) {
        const ss = data.sessions.filter(s => s.studentId === st.id && s.status === 'completed');
        rows.push({ student: st, honor: honorOf(teacher, ss), deferred: true, count: ss.length });
      }
    });
    return rows.sort((a, b) => b.honor - a.honor);
  };
  const teacherHonorTotal = (teacher: typeof data.teachers[0]) =>
    teacherHonorBreakdown(teacher).reduce((s, r) => s + r.honor, 0);

  const totalPayroll = nonOwners.reduce((sum, teacher) => sum + teacherHonorTotal(teacher), 0);
  // Sembunyikan laoshi non-aktif yang tidak punya honor di bulan berjalan
  const visibleNonOwners = nonOwners.filter(te => te.isActive || teacherHonorBreakdown(te).length > 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('fin.title')}</h1>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{t('fin.subtitle')}</p>
      </div>

      <MonthSelector month={month} onChange={setMonth} />

      {/* ── Pemilik ── */}
      {owners.map(teacher => {
        const ownerStudentIds = new Set(
          data.students.filter(s => s.teacherId === teacher.id).map(s => s.id)
        );

        // XuYuan pakai siklus 26 bulan lalu – 25 bulan ini
        const prevMonthStr = format(subMonths(month, 1), 'yyyy-MM');
        const xyCycleStart = `${prevMonthStr}-26`;
        const xyCycleEnd   = `${monthStr}-25`;

        // Sesi XuYuan (siklus) vs non-XuYuan (bulan kalender)
        const xuyuanSessions = data.sessions.filter(s =>
          s.teacherId === teacher.id &&
          s.date >= xyCycleStart && s.date <= xyCycleEnd &&
          s.status === 'completed'
        );
        // Postpaid: sesi selesai + terjadwal bulan ini (scheduled ikut dihitung)
        const monthSessionsAll = data.sessions.filter(s =>
          s.teacherId === teacher.id &&
          s.date.startsWith(monthStr) &&
          (s.status === 'completed' || s.status === 'scheduled')
        );

        let incomeXuYuan = 0;
        let incomeWorksheet = 0;
        let incomePribadi = 0;
        let incomeWenwen = 0;

        // XuYuan: per jam, siklus 26–25
        xuyuanSessions.forEach(s => {
          const student = data.students.find(st => st.id === s.studentId);
          if (!student || student.group !== 'xuyuan') return;
          const rate = student.xuYuanType === 'semi-group' ? RATE_SEMI_GROUP : RATE_PRIVATE;
          incomeXuYuan += Math.round(durationMinutes(s) / 60 * rate);
        });
        if (monthStr === '2026-06') incomeXuYuan += XUYUAN_ADJ_2026_06;

        // Pribadi & WenWen: paket → harga paket penuh di bulan startDate; per-sesi → per sesi selesai
        data.students
          .filter(s => s.teacherId === teacher.id && s.group !== 'xuyuan')
          .forEach(student => {
            const add = (amount: number) => {
              if (student.group === 'pribadi') incomePribadi += amount;
              else if (student.group === 'wenwen_aizhongwen') incomeWenwen += amount;
            };
            // Dibayar lembaga: pendapatan = pembayaran yang diterima bulan ini
            if (student.deferredPayment) {
              const paid = data.payments
                .filter(p => p.studentId === student.id && p.date.startsWith(monthStr))
                .reduce((sum, p) => sum + p.amount, 0);
              if (paid > 0) add(paid);
              return;
            }
            if (student.billingType === 'package') {
              data.packages
                .filter(p => p.studentId === student.id && p.startDate.startsWith(monthStr))
                .forEach(pkg => {
                  add(pkg.packagePrice ?? pkg.totalSessions * pkg.pricePerSession);
                });
            } else {
              const studentSessions = monthSessionsAll.filter(s => s.studentId === student.id);
              const income = studentSessions.reduce(
                (sum, s) => sum + (s.rateSnapshot ?? effectiveRate(student, s.date)), 0
              );
              if (income > 0) add(income);
            }
          });

        // Worksheet: ikut siklus XuYuan
        incomeWorksheet = data.worksheets
          .filter(w => w.date >= xyCycleStart && w.date <= xyCycleEnd && ownerStudentIds.has(w.studentId))
          .reduce((sum, w) => sum + w.pages * WORKSHEET_PRICE, 0);

        // Margin laoshi: selisih rate murid - honor laoshi per sesi
        let incomeMarginRealized = 0;
        let incomeMarginScheduled = 0;
        nonOwners.forEach(laoshi => {
          data.students.filter(st => st.teacherId === laoshi.id).forEach(student => {
            const postpaid = student.billingType === 'per-session';
            data.sessions
              .filter(s =>
                s.studentId === student.id &&
                s.date.startsWith(monthStr) &&
                (s.status === 'completed' || (postpaid && s.status === 'scheduled'))
              )
              .forEach(s => {
                const m = (s.rateSnapshot ?? effectiveRate(student, s.date))
                        - (s.honorSnapshot ?? effectiveHonor(laoshi, s.date));
                if (s.status === 'completed') incomeMarginRealized  += m;
                else                          incomeMarginScheduled += m;
              });
          });
        });
        const incomeMargin = incomeMarginRealized + incomeMarginScheduled;

        const totalOwnerIncome = incomeXuYuan + incomeWorksheet + incomePribadi + incomeWenwen + incomeMarginRealized;

        const incomeRows = [
          { label: t('fin.rowXuYuan'), value: incomeXuYuan },
          { label: t('fin.rowWorksheet'), value: incomeWorksheet },
          { label: 'Pribadi', value: incomePribadi },
          { label: 'WenWen_AiZhongWen', value: incomeWenwen },
          { label: t('fin.rowMargin'), value: incomeMarginRealized, forecast: incomeMargin },
        ];

        return (
          <div key={teacher.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: teacher.color }} />
              <span className="font-semibold text-gray-900 dark:text-white">{teacher.name}</span>
              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full ml-1">
                <Crown size={11} /> OWNER
              </span>
              <Link
                to={`/finance/${teacher.id}`}
                className="ml-auto flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {t('fin.detail')} <ArrowRight size={11} />
              </Link>
            </div>

            <div className="space-y-2">
              {incomeRows.map(row => (
                <div
                  key={row.label}
                  className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <span className="text-sm text-gray-600 dark:text-gray-400">{row.label}</span>
                  <div className="text-right">
                    <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                      {row.value > 0 ? formatCurrency(row.value) : '—'}
                    </span>
                    {'forecast' in row && row.forecast > row.value && (
                      <span className="ml-1.5 text-xs tabular-nums text-blue-500">
                        → {formatCurrency(row.forecast)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {t('fin.total', { month: format(month, 'MMMM', { locale }) })}
              </span>
              <span className="text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">
                {formatCurrency(totalOwnerIncome)}
              </span>
            </div>
          </div>
        );
      })}

      {/* ── Non-owner teachers ── */}
      {visibleNonOwners.map(teacher => {
        const isEditing = editingId === teacher.id;
        const breakdown = teacherHonorBreakdown(teacher);
        const totalHonor = breakdown.reduce((s, r) => s + r.honor, 0);

        return (
          <div key={teacher.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: teacher.color }} />
              <span className="font-semibold text-gray-900 dark:text-white">{teacher.name}</span>
              {breakdown.length === 0 && (
                <span className="text-xs text-gray-400 dark:text-gray-500">{t('fin.noSessionMonth')}</span>
              )}
              <Link
                to={`/finance/${teacher.id}`}
                className="ml-auto flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {t('fin.detail')} <ArrowRight size={11} />
              </Link>
            </div>

            {/* Per-student breakdown */}
            {breakdown.length > 0 && (
              <div className="space-y-1.5 mb-4">
                {breakdown.map(({ student, honor, deferred, count }) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                      {student.name}
                      {deferred && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">{t('pay.badge')}</span>
                      )}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
                        {t('common.sessions_n', { n: count })}
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                        {formatCurrency(honor)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Footer: total + honor edit (with scheduled change) */}
            <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {t('fin.totalHonorMonth', { month: format(month, 'MMMM', { locale }) })}
                  </div>
                  <div className="text-xl font-bold tabular-nums text-indigo-700 dark:text-indigo-300">
                    {formatCurrency(totalHonor)}
                  </div>
                  {teacher.pendingHonor != null && teacher.pendingHonorEffectiveDate && (
                    <div className="text-xs text-blue-500 flex items-center gap-1 mt-0.5">
                      <CalendarClock size={11} />
                      {t('fin.honorFrom', { honor: formatCurrency(teacher.pendingHonor), date: format(parseISO(teacher.pendingHonorEffectiveDate), 'd MMM', { locale }) })}
                    </div>
                  )}
                </div>
                {!isEditing && (
                  <div className="flex items-center gap-2 text-sm flex-shrink-0">
                    <span className="text-gray-500 dark:text-gray-400">{t('fin.payPerSession')}</span>
                    <span className="font-medium tabular-nums text-gray-900 dark:text-white">{formatCurrency(teacher.honorPerSession)}</span>
                    <button
                      onClick={() => startEdit(teacher)}
                      className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <Pencil size={12} />
                    </button>
                  </div>
                )}
              </div>

              {isEditing && (
                <div className="mt-3 space-y-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg p-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('fin.payPerSession')} (Rp)</label>
                    <input
                      type="number" min="0" step="1000" autoFocus
                      value={editValue}
                      onChange={e => {
                        const v = e.target.value;
                        setEditValue(v);
                        // Edit langsung membatalkan jadwal (override), sama seperti murid
                        if (Number(v.replace(/\D/g, '')) !== teacher.honorPerSession && (pendingHonorValue || pendingDateValue)) {
                          setPendingHonorValue(''); setPendingDateValue('');
                        }
                      }}
                      onKeyDown={e => e.key === 'Escape' && cancelEdit()}
                      className="w-40 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm tabular-nums bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-3 bg-blue-50/60 dark:bg-blue-900/20 space-y-2">
                    <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5 uppercase tracking-wide">
                      <CalendarClock size={12} /> {t('fin.scheduleHonor')}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('fin.newHonor')}</label>
                        <input type="number" min="0" step="1000" onKeyDown={e => (e.key === '-' || e.key === 'e') && e.preventDefault()}
                          value={pendingHonorValue} onChange={e => setPendingHonorValue(e.target.value)} placeholder="120000"
                          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm tabular-nums bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('stu.effectiveDate')}</label>
                        <input type="date" value={pendingDateValue} onChange={e => setPendingDateValue(e.target.value)}
                          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(teacher.id)} className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-indigo-700"><Check size={14} /> {t('common.save')}</button>
                    <button onClick={cancelEdit} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"><X size={14} /> {t('common.cancel')}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Total payroll */}
      {visibleNonOwners.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-5 py-4 flex items-center justify-between">
          <span className="font-semibold text-gray-900 dark:text-white">
            {t('fin.totalPayroll', { month: format(month, 'MMMM', { locale }) })}
          </span>
          <span className="text-xl font-bold tabular-nums text-gray-900 dark:text-white">
            {formatCurrency(totalPayroll)}
          </span>
        </div>
      )}

      {data.teachers.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center text-gray-400 dark:text-gray-500">
          <p className="text-sm">{t('fin.noTeachers')}</p>
        </div>
      )}
    </div>
  );
}
