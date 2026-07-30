import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format, parseISO, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import type { Locale } from 'date-fns';
import { useApp } from '../store/AppContext';
import { useLang } from '../store/LanguageContext';
import { formatCurrency, formatDate, effectiveHonor, effectiveRate } from '../utils/helpers';
import { durationMinutes, formatDuration } from '../utils/xuyuan';
import type { LessonSession } from '../types';

const RATE_PRIVATE    = 100_000;
const RATE_SEMI_GROUP = 135_000;
const WORKSHEET_PRICE =  20_000;

// Penyesuaian manual: 6,5 jam private + 0,5 jam semi-group di Mei yang tidak tercatat (siklus Jun 2026)
const XUYUAN_ADJ_2026_06 = Math.round(6.5 * RATE_PRIVATE + 0.5 * RATE_SEMI_GROUP); // 717_500

export default function FinanceDetail() {
  const { teacherId } = useParams<{ teacherId: string }>();
  const { data } = useApp();
  const { t, locale, lang } = useLang();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const monthStr = format(month, 'yyyy-MM');
  const teacher = data.teachers.find(t => t.id === teacherId);

  if (!teacher) {
    return (
      <div className="max-w-2xl mx-auto">
        <p className="text-gray-400 dark:text-gray-500">{t('fd.notFound')}</p>
        <Link to="/finance" className="text-indigo-600 dark:text-indigo-400 text-sm hover:underline">
          {t('fd.back')}
        </Link>
      </div>
    );
  }

  // XuYuan pakai siklus 26 bulan lalu – 25 bulan ini
  const prevMonthStr = format(subMonths(month, 1), 'yyyy-MM');
  const xyCycleStart = `${prevMonthStr}-26`;
  const xyCycleEnd   = `${monthStr}-25`;

  const xuyuanSessions = data.sessions.filter(s =>
    s.teacherId === teacher.id &&
    s.date >= xyCycleStart && s.date <= xyCycleEnd &&
    s.status === 'completed'
  );
  const monthSessions = data.sessions.filter(s =>
    s.teacherId === teacher.id &&
    s.date.startsWith(monthStr) &&
    s.status === 'completed'
  );
  // Untuk murid postpaid: sesi selesai + terjadwal bulan ini (scheduled ikut dihitung)
  const monthSessionsAll = data.sessions.filter(s =>
    s.teacherId === teacher.id &&
    s.date.startsWith(monthStr) &&
    (s.status === 'completed' || s.status === 'scheduled')
  );

  // ── Owner breakdown ──────────────────────────────────────────────────────────
  if (teacher.isOwner) {
    const ownerStudentIds = new Set(
      data.students.filter(s => s.teacherId === teacher.id).map(s => s.id)
    );

    // XuYuan per student — siklus 26–25
    const xuyuanStudents = data.students.filter(
      s => s.teacherId === teacher.id && s.group === 'xuyuan'
    );
    const xuyuanRows = xuyuanStudents.map(student => {
      const sessions = xuyuanSessions.filter(s => s.studentId === student.id);
      const totalMins = sessions.reduce((sum, s) => sum + durationMinutes(s), 0);
      const rate = student.xuYuanType === 'semi-group' ? RATE_SEMI_GROUP : RATE_PRIVATE;
      const income = Math.round(totalMins / 60 * rate);
      return { student, sessions, totalMins, income };
    }).filter(r => r.sessions.length > 0);

    // Worksheet per student — ikut siklus XuYuan
    const worksheetRows = data.students
      .filter(s => ownerStudentIds.has(s.id))
      .map(student => {
        const pages = data.worksheets
          .filter(w => w.date >= xyCycleStart && w.date <= xyCycleEnd && w.studentId === student.id)
          .reduce((sum, w) => sum + w.pages, 0);
        return { student, pages, income: pages * WORKSHEET_PRICE };
      })
      .filter(r => r.pages > 0);

    // Non-XuYuan students: split by billing type
    const nonXuYuanStudents = data.students.filter(
      s => s.teacherId === teacher.id && s.group !== 'xuyuan'
    );

    // Prepaid: packages starting this month
    type PrepaidRow = { student: typeof nonXuYuanStudents[0]; packagePrice: number; totalSessions: number; startDate: string };
    const prepaidRows: PrepaidRow[] = [];
    nonXuYuanStudents.forEach(student => {
      if (student.billingType !== 'package' || student.deferredPayment) return;
      data.packages
        .filter(p => p.studentId === student.id && p.startDate.startsWith(monthStr))
        .forEach(pkg => {
          prepaidRows.push({
            student,
            packagePrice: pkg.packagePrice ?? pkg.totalSessions * pkg.pricePerSession,
            totalSessions: pkg.totalSessions,
            startDate: pkg.startDate,
          });
        });
    });

    // Postpaid: per-session selesai + terjadwal bulan ini (scheduled ikut dihitung)
    const postpaidRows = nonXuYuanStudents
      .filter(s => s.billingType === 'per-session' && !s.deferredPayment)
      .map(student => {
        const sessions = monthSessionsAll.filter(s => s.studentId === student.id);
        const income = sessions.reduce(
          (sum, s) => sum + (s.rateSnapshot ?? effectiveRate(student, s.date)), 0
        );
        return { student, sessions, income };
      })
      .filter(r => r.sessions.length > 0);

    // Dibayar lembaga: pembayaran diterima bulan ini (flatten per pembayaran)
    const paymentRows = nonXuYuanStudents
      .filter(s => s.deferredPayment)
      .flatMap(student =>
        data.payments
          .filter(p => p.studentId === student.id && p.date.startsWith(monthStr))
          .map(p => ({ student, payment: p }))
      )
      .sort((a, b) => a.payment.date.localeCompare(b.payment.date));

    const xuyuanAdj     = monthStr === '2026-06' ? XUYUAN_ADJ_2026_06 : 0;
    const totalXuYuan   = xuyuanRows.reduce((s, r) => s + r.income, 0) + xuyuanAdj;
    const totalWorksheet = worksheetRows.reduce((s, r) => s + r.income, 0);
    const totalPrepaid  = prepaidRows.reduce((s, r) => s + r.packagePrice, 0);
    const totalPostpaid = postpaidRows.reduce((s, r) => s + r.income, 0);
    const totalPayments = paymentRows.reduce((s, r) => s + r.payment.amount, 0);
    const grandTotal    = totalXuYuan + totalWorksheet + totalPrepaid + totalPostpaid + totalPayments;

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/finance" className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
            <ArrowLeft size={16} />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: teacher.color }} />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{teacher.name}</h1>
          </div>
        </div>

        {/* Month selector */}
        <div className="flex items-center gap-3">
          <button onClick={() => setMonth(m => subMonths(m, 1))} className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
            <ChevronLeft size={16} />
          </button>
          <span className="font-semibold text-gray-900 dark:text-white capitalize min-w-36 text-center">
            {format(month, 'MMMM yyyy', { locale })}
          </span>
          <button onClick={() => setMonth(m => addMonths(m, 1))} className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
            <ChevronRight size={16} />
          </button>
        </div>

        {/* XuYuan */}
        {xuyuanRows.length > 0 && (
          <Section title={t('fin.sectionXuYuan')} total={totalXuYuan}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left pb-2 font-medium">{t('fin.colStudent')}</th>
                  <th className="text-right pb-2 font-medium">{t('fin.colSessions')}</th>
                  <th className="text-right pb-2 font-medium">{t('fin.colDuration')}</th>
                  <th className="text-right pb-2 font-medium">{t('fin.colIncome')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {xuyuanRows.map(({ student, sessions, totalMins, income }) => (
                  <tr key={student.id}>
                    <td className="py-2 text-gray-800 dark:text-gray-200">{student.name}</td>
                    <td className="py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{sessions.length}</td>
                    <td className="py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{formatDuration(totalMins, lang)}</td>
                    <td className="py-2 text-right tabular-nums font-medium text-gray-900 dark:text-white">{formatCurrency(income)}</td>
                  </tr>
                ))}
                {xuyuanAdj > 0 && (
                  <tr>
                    <td className="py-2 text-gray-400 dark:text-gray-500 italic">{t('fd.adjMayShort')}</td>
                    <td className="py-2 text-right text-gray-400 dark:text-gray-500">—</td>
                    <td className="py-2 text-right text-gray-400 dark:text-gray-500">{t('fd.adjDur7')}</td>
                    <td className="py-2 text-right tabular-nums font-medium text-gray-900 dark:text-white">{formatCurrency(xuyuanAdj)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </Section>
        )}

        {/* Worksheet */}
        {worksheetRows.length > 0 && (
          <Section title={t('fin.rowWorksheet')} total={totalWorksheet}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left pb-2 font-medium">{t('fin.colStudent')}</th>
                  <th className="text-right pb-2 font-medium">{t('fin.colPages')}</th>
                  <th className="text-right pb-2 font-medium">{t('fin.colIncome')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {worksheetRows.map(({ student, pages, income }) => (
                  <tr key={student.id}>
                    <td className="py-2 text-gray-800 dark:text-gray-200">{student.name}</td>
                    <td className="py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{pages}</td>
                    <td className="py-2 text-right tabular-nums font-medium text-gray-900 dark:text-white">{formatCurrency(income)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* Prepaid packages */}
        {prepaidRows.length > 0 && (
          <Section title={t('fd.sectionPrepaid')} total={totalPrepaid}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left pb-2 font-medium">{t('fin.colStudent')}</th>
                  <th className="text-right pb-2 font-medium">{t('fin.colSessions')}</th>
                  <th className="text-right pb-2 font-medium">{t('fin.colPackagePrice')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {prepaidRows.map((r, i) => (
                  <tr key={i}>
                    <td className="py-2 text-gray-800 dark:text-gray-200">
                      {r.student.name}
                      <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">{formatDate(r.startDate, 'd MMM')}</span>
                    </td>
                    <td className="py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{r.totalSessions}</td>
                    <td className="py-2 text-right tabular-nums font-medium text-gray-900 dark:text-white">{formatCurrency(r.packagePrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* Postpaid */}
        {postpaidRows.length > 0 && (
          <Section title={t('fd.sectionPostpaid')} total={totalPostpaid}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left pb-2 font-medium">{t('fin.colStudent')}</th>
                  <th className="text-right pb-2 font-medium">{t('fin.colSessions')}</th>
                  <th className="text-right pb-2 font-medium">{t('fin.colIncome')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {postpaidRows.map(({ student, sessions, income }) => (
                  <tr key={student.id}>
                    <td className="py-2 text-gray-800 dark:text-gray-200 align-top">
                      {student.name}
                      <SessionDates sessions={sessions} locale={locale} />
                    </td>
                    <td className="py-2 text-right tabular-nums text-gray-500 dark:text-gray-400 align-top">{sessions.length}</td>
                    <td className="py-2 text-right tabular-nums font-medium text-gray-900 dark:text-white align-top">{formatCurrency(income)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* Dibayar lembaga */}
        {paymentRows.length > 0 && (
          <Section title={t('fd.sectionPayments')} total={totalPayments}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left pb-2 font-medium">{t('fin.colStudent')}</th>
                  <th className="text-left pb-2 font-medium">{t('common.date')}</th>
                  <th className="text-left pb-2 font-medium">{t('fin.colNote')}</th>
                  <th className="text-right pb-2 font-medium">{t('fin.colIncome')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {paymentRows.map(({ student, payment }) => (
                  <tr key={payment.id}>
                    <td className="py-2 text-gray-800 dark:text-gray-200">{student.name}</td>
                    <td className="py-2 text-gray-500 dark:text-gray-400 tabular-nums">{formatDate(payment.date, 'd MMM', locale)}</td>
                    <td className="py-2 text-gray-400 dark:text-gray-500 text-xs italic">{payment.note ?? ''}</td>
                    <td className="py-2 text-right tabular-nums font-medium text-gray-900 dark:text-white">{formatCurrency(payment.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {xuyuanRows.length === 0 && worksheetRows.length === 0 && prepaidRows.length === 0 && postpaidRows.length === 0 && paymentRows.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center text-gray-400 dark:text-gray-500 text-sm">
            {t('fd.noIncome')}
          </div>
        )}

        {/* Grand total */}
        {grandTotal > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-5 py-4 flex items-center justify-between">
            <span className="font-semibold text-gray-900 dark:text-white">
              {t('fin.total', { month: format(month, 'MMMM', { locale }) })}
            </span>
            <span className="text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {formatCurrency(grandTotal)}
            </span>
          </div>
        )}
      </div>
    );
  }

  // ── Non-owner breakdown ──────────────────────────────────────────────────────
  const honorOf = (sessions: typeof data.sessions) =>
    sessions.reduce((sum, s) => sum + (s.honorSnapshot ?? effectiveHonor(teacher, s.date)), 0);

  type HonorRow = { student: typeof data.students[0]; count: number; honor: number; deferred: boolean; sessions: LessonSession[]; postpaid: boolean };
  const studentRows: HonorRow[] = [];
  data.students.filter(s => s.teacherId === teacher.id && !s.deferredPayment).forEach(student => {
    // Postpaid: sesi selesai + terjadwal (scheduled ikut dihitung); lainnya hanya completed
    const postpaid = student.billingType === 'per-session';
    const pool = postpaid ? monthSessionsAll : monthSessions;
    const sessions = pool.filter(s => s.studentId === student.id);
    if (sessions.length) studentRows.push({ student, count: sessions.length, honor: honorOf(sessions), deferred: false, sessions, postpaid });
  });
  data.students.filter(s => s.teacherId === teacher.id && s.deferredPayment).forEach(student => {
    const pays = data.payments.filter(p => p.studentId === student.id).sort((a, b) => a.date.localeCompare(b.date));
    if (pays.length && pays[0].date.startsWith(monthStr)) {
      const sessions = data.sessions.filter(s => s.studentId === student.id && s.status === 'completed');
      studentRows.push({ student, count: sessions.length, honor: honorOf(sessions), deferred: true, sessions, postpaid: false });
    }
  });
  studentRows.sort((a, b) => b.honor - a.honor);

  const totalHonor = studentRows.reduce((sum, r) => sum + r.honor, 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/finance" className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: teacher.color }} />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{teacher.name}</h1>
        </div>
      </div>

      {/* Month selector */}
      <div className="flex items-center gap-3">
        <button onClick={() => setMonth(m => subMonths(m, 1))} className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
          <ChevronLeft size={16} />
        </button>
        <span className="font-semibold text-gray-900 dark:text-white capitalize min-w-36 text-center">
          {format(month, 'MMMM yyyy', { locale })}
        </span>
        <button onClick={() => setMonth(m => addMonths(m, 1))} className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
          <ChevronRight size={16} />
        </button>
      </div>

      <Section title={t('fd.sectionHonor')} total={totalHonor}>
        {studentRows.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 py-2">{t('fin.noSessionMonth')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700">
                <th className="text-left pb-2 font-medium">{t('fin.colStudent')}</th>
                <th className="text-right pb-2 font-medium">{t('fin.colSessions')}</th>
                <th className="text-right pb-2 font-medium">{t('fin.colRate')}</th>
                <th className="text-right pb-2 font-medium">{t('fin.colPay')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {studentRows.map(({ student, count, honor, deferred, sessions, postpaid }) => (
                <tr key={student.id}>
                  <td className="py-2 text-gray-800 dark:text-gray-200 align-top">
                    {student.name}
                    {deferred && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">{t('pay.badge')}</span>}
                    {postpaid && <SessionDates sessions={sessions} locale={locale} />}
                  </td>
                  <td className="py-2 text-right tabular-nums text-gray-500 dark:text-gray-400 align-top">{count}</td>
                  <td className="py-2 text-right tabular-nums text-gray-500 dark:text-gray-400 align-top">{count > 0 ? formatCurrency(Math.round(honor / count)) : '—'}</td>
                  <td className="py-2 text-right tabular-nums font-medium text-gray-900 dark:text-white align-top">{formatCurrency(honor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// Chip tanggal sesi di bawah nama murid: abu-abu = selesai, biru = terjadwal
function SessionDates({ sessions, locale }: { sessions: LessonSession[]; locale: Locale }) {
  if (!sessions.length) return null;
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {sorted.map(s => (
        <span key={s.id} className={`text-[10px] px-1.5 py-0.5 rounded ${
          s.status === 'scheduled'
            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-500 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300'
        }`}>
          {format(parseISO(s.date), 'd MMM', { locale })}
        </span>
      ))}
    </div>
  );
}

function Section({
  title, total, children,
}: {
  title: string;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h2>
        <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">
          {formatCurrency(total)}
        </span>
      </div>
      {children}
    </div>
  );
}
