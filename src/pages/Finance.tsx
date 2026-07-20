import { useState } from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Pencil, Check, X, ExternalLink, Crown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { formatCurrency } from '../utils/helpers';
import { durationMinutes } from '../utils/xuyuan';

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

  const teacherStats = data.teachers.map(teacher => {
    const sessions = data.sessions.filter(s =>
      s.teacherId === teacher.id &&
      s.date.startsWith(monthStr) &&
      s.status === 'completed'
    );
    const totalMinutes = sessions.reduce((sum, s) => sum + durationMinutes(s), 0);
    const totalHonor = sessions.length * teacher.honorPerSession;
    return { teacher, sessions, totalMinutes, totalHonor };
  });

  const totalPayroll = teacherStats.filter(t => !t.teacher.isOwner).reduce((sum, t) => sum + t.totalHonor, 0);
  const hasAny = teacherStats.some(t => !t.teacher.isOwner && t.sessions.length > 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Keuangan</h1>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">Honor laoshi per bulan</p>
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

      {/* Per-teacher cards */}
      <div className="space-y-3">
        {teacherStats.map(({ teacher, sessions, totalMinutes, totalHonor }) => {
          const isEditing = editingId === teacher.id;
          const hours = Math.floor(totalMinutes / 60);
          const mins  = totalMinutes % 60;
          const durationLabel = totalMinutes > 0
            ? (hours > 0 ? `${hours} jam${mins > 0 ? ` ${mins} mnt` : ''}` : `${mins} mnt`)
            : null;

          if (teacher.isOwner) {
            return (
              <div key={teacher.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <div className="flex items-center gap-2 mb-3">
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
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2.5">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Sesi bulan ini</div>
                    <div className="text-lg font-bold tabular-nums text-gray-900 dark:text-white">{sessions.length}</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2.5">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Total durasi</div>
                    <div className="text-lg font-bold tabular-nums text-gray-900 dark:text-white">{durationLabel ?? '—'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                  <span className="flex-1">Penghasilan dihitung dari jam mengajar</span>
                  <Link to="/hours" className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline text-xs">
                    Buka Jam Mengajar <ExternalLink size={11} />
                  </Link>
                </div>
              </div>
            );
          }

          return (
            <div
              key={teacher.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5"
            >
              {/* Header */}
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: teacher.color }} />
                <span className="font-semibold text-gray-900 dark:text-white">{teacher.name}</span>
                {sessions.length === 0 && (
                  <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">Tidak ada sesi bulan ini</span>
                )}
                <button
                  onClick={() => updateTeacher(teacher.id, { isOwner: true })}
                  className={`${sessions.length === 0 ? '' : 'ml-auto'} text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300`}
                >
                  Tandai sebagai pemilik
                </button>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2.5">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Sesi selesai</div>
                  <div className="text-lg font-bold tabular-nums text-gray-900 dark:text-white">{sessions.length}</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2.5">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Total durasi</div>
                  <div className="text-lg font-bold tabular-nums text-gray-900 dark:text-white">
                    {durationLabel ?? '—'}
                  </div>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg px-3 py-2.5">
                  <div className="text-xs text-indigo-600 dark:text-indigo-400 mb-0.5">Total honor</div>
                  <div className="text-lg font-bold tabular-nums text-indigo-700 dark:text-indigo-300">
                    {formatCurrency(totalHonor)}
                  </div>
                </div>
              </div>

              {/* Honor rate row */}
              <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-500 dark:text-gray-400 flex-1">Honor per sesi</span>
                {isEditing ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-gray-400">Rp</span>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(teacher.id); if (e.key === 'Escape') cancelEdit(); }}
                      autoFocus
                      className="w-28 border border-indigo-400 rounded-lg px-2 py-1 text-sm text-right tabular-nums bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button onClick={() => saveEdit(teacher.id)} className="p-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
                      <Check size={14} />
                    </button>
                    <button onClick={cancelEdit} className="p-1 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium tabular-nums text-gray-900 dark:text-white">
                      {formatCurrency(teacher.honorPerSession)}
                    </span>
                    <button
                      onClick={() => startEdit(teacher.id, teacher.honorPerSession)}
                      className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Total */}
      {hasAny && (
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
