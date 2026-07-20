import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format, addMonths, subMonths } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { formatCurrency, formatDate } from '../utils/helpers';
import { durationMinutes } from '../utils/xuyuan';

const RATE_PRIVATE    = 100_000;
const RATE_SEMI_GROUP = 135_000;
const WORKSHEET_PRICE =  20_000;

// Penyesuaian manual: 6,5 jam private + 0,5 jam semi-group di Mei yang tidak tercatat (siklus Jun 2026)
const XUYUAN_ADJ_2026_06 = Math.round(6.5 * RATE_PRIVATE + 0.5 * RATE_SEMI_GROUP); // 717_500

export default function FinanceDetail() {
  const { teacherId } = useParams<{ teacherId: string }>();
  const { data } = useApp();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const monthStr = format(month, 'yyyy-MM');
  const teacher = data.teachers.find(t => t.id === teacherId);

  if (!teacher) {
    return (
      <div className="max-w-2xl mx-auto">
        <p className="text-gray-400 dark:text-gray-500">Laoshi tidak ditemukan.</p>
        <Link to="/finance" className="text-indigo-600 dark:text-indigo-400 text-sm hover:underline">
          ← Kembali
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
      if (student.billingType !== 'package') return;
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

    // Postpaid: per-session completed this month
    const postpaidRows = nonXuYuanStudents
      .filter(s => s.billingType === 'per-session')
      .map(student => {
        const sessions = monthSessions.filter(s => s.studentId === student.id);
        const income = sessions.reduce(
          (sum, s) => sum + (s.rateSnapshot ?? student.ratePerSession), 0
        );
        return { student, sessions, income };
      })
      .filter(r => r.sessions.length > 0);

    const xuyuanAdj     = monthStr === '2026-06' ? XUYUAN_ADJ_2026_06 : 0;
    const totalXuYuan   = xuyuanRows.reduce((s, r) => s + r.income, 0) + xuyuanAdj;
    const totalWorksheet = worksheetRows.reduce((s, r) => s + r.income, 0);
    const totalPrepaid  = prepaidRows.reduce((s, r) => s + r.packagePrice, 0);
    const totalPostpaid = postpaidRows.reduce((s, r) => s + r.income, 0);
    const grandTotal    = totalXuYuan + totalWorksheet + totalPrepaid + totalPostpaid;

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
            {format(month, 'MMMM yyyy', { locale: localeId })}
          </span>
          <button onClick={() => setMonth(m => addMonths(m, 1))} className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
            <ChevronRight size={16} />
          </button>
        </div>

        {/* XuYuan */}
        {xuyuanRows.length > 0 && (
          <Section title="XuYuan — Jam Mengajar" total={totalXuYuan}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left pb-2 font-medium">Murid</th>
                  <th className="text-right pb-2 font-medium">Sesi</th>
                  <th className="text-right pb-2 font-medium">Durasi</th>
                  <th className="text-right pb-2 font-medium">Pendapatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {xuyuanRows.map(({ student, sessions, totalMins, income }) => (
                  <tr key={student.id}>
                    <td className="py-2 text-gray-800 dark:text-gray-200">{student.name}</td>
                    <td className="py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{sessions.length}</td>
                    <td className="py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{formatMins(totalMins)}</td>
                    <td className="py-2 text-right tabular-nums font-medium text-gray-900 dark:text-white">{formatCurrency(income)}</td>
                  </tr>
                ))}
                {xuyuanAdj > 0 && (
                  <tr>
                    <td className="py-2 text-gray-400 dark:text-gray-500 italic">Penyesuaian Mei (6,5j private + 0,5j semi)</td>
                    <td className="py-2 text-right text-gray-400 dark:text-gray-500">—</td>
                    <td className="py-2 text-right text-gray-400 dark:text-gray-500">7 jam</td>
                    <td className="py-2 text-right tabular-nums font-medium text-gray-900 dark:text-white">{formatCurrency(xuyuanAdj)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </Section>
        )}

        {/* Worksheet */}
        {worksheetRows.length > 0 && (
          <Section title="Worksheet XuYuan" total={totalWorksheet}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left pb-2 font-medium">Murid</th>
                  <th className="text-right pb-2 font-medium">Halaman</th>
                  <th className="text-right pb-2 font-medium">Pendapatan</th>
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
          <Section title="Prepaid — Paket Dimulai Bulan Ini" total={totalPrepaid}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left pb-2 font-medium">Murid</th>
                  <th className="text-right pb-2 font-medium">Sesi</th>
                  <th className="text-right pb-2 font-medium">Harga Paket</th>
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
          <Section title="Postpaid — Per Sesi" total={totalPostpaid}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left pb-2 font-medium">Murid</th>
                  <th className="text-right pb-2 font-medium">Sesi</th>
                  <th className="text-right pb-2 font-medium">Pendapatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {postpaidRows.map(({ student, sessions, income }) => (
                  <tr key={student.id}>
                    <td className="py-2 text-gray-800 dark:text-gray-200">{student.name}</td>
                    <td className="py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{sessions.length}</td>
                    <td className="py-2 text-right tabular-nums font-medium text-gray-900 dark:text-white">{formatCurrency(income)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {xuyuanRows.length === 0 && worksheetRows.length === 0 && prepaidRows.length === 0 && postpaidRows.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center text-gray-400 dark:text-gray-500 text-sm">
            Tidak ada pendapatan bulan ini.
          </div>
        )}

        {/* Grand total */}
        {grandTotal > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-5 py-4 flex items-center justify-between">
            <span className="font-semibold text-gray-900 dark:text-white">
              Total {format(month, 'MMMM', { locale: localeId })}
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
  const studentRows = data.students
    .filter(s => s.teacherId === teacher.id)
    .map(student => {
      const sessions = monthSessions.filter(s => s.studentId === student.id);
      const honor = sessions.length * teacher.honorPerSession;
      return { student, sessions, honor };
    })
    .filter(r => r.sessions.length > 0);

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
          {format(month, 'MMMM yyyy', { locale: localeId })}
        </span>
        <button onClick={() => setMonth(m => addMonths(m, 1))} className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
          <ChevronRight size={16} />
        </button>
      </div>

      <Section title="Honor per Murid" total={totalHonor}>
        {studentRows.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 py-2">Tidak ada sesi bulan ini.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700">
                <th className="text-left pb-2 font-medium">Murid</th>
                <th className="text-right pb-2 font-medium">Sesi</th>
                <th className="text-right pb-2 font-medium">Rate/sesi</th>
                <th className="text-right pb-2 font-medium">Honor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {studentRows.map(({ student, sessions, honor }) => (
                <tr key={student.id}>
                  <td className="py-2 text-gray-800 dark:text-gray-200">{student.name}</td>
                  <td className="py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{sessions.length}</td>
                  <td className="py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{formatCurrency(teacher.honorPerSession)}</td>
                  <td className="py-2 text-right tabular-nums font-medium text-gray-900 dark:text-white">{formatCurrency(honor)}</td>
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

function formatMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h} jam${m > 0 ? ` ${m} mnt` : ''}` : `${m} mnt`;
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
