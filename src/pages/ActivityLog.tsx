import { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { RefreshCw, Trash2, Plus, CalendarClock, X, History, RotateCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LogRow {
  id: string;
  action: 'create' | 'reschedule' | 'delete' | 'restore';
  description: string;
  created_at: string;
}

const ACTION_META: Record<LogRow['action'], { label: string; icon: typeof Plus; cls: string }> = {
  create:     { label: 'Tambah',     icon: Plus,          cls: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
  reschedule: { label: 'Reschedule', icon: CalendarClock, cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
  delete:     { label: 'Hapus',      icon: X,             cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
  restore:    { label: 'Restore',    icon: RotateCcw,     cls: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' },
};

export default function ActivityLog() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300);
    setRows((data ?? []) as LogRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const clearAll = async () => {
    if (!confirm('Hapus semua log aktivitas? Tindakan ini tidak bisa dibatalkan.')) return;
    await supabase.from('activity_log').delete().neq('id', '');
    setRows([]);
  };

  // Group by calendar day
  const groups = rows.reduce<{ day: string; items: LogRow[] }[]>((acc, r) => {
    const day = r.created_at.slice(0, 10);
    const last = acc[acc.length - 1];
    if (last && last.day === day) last.items.push(r);
    else acc.push({ day, items: [r] });
    return acc;
  }, []);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <History size={22} /> Log Aktivitas
          </h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">Perubahan jadwal: tambah, reschedule, hapus</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Muat Ulang
          </button>
          {rows.length > 0 && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 size={15} /> Bersihkan
            </button>
          )}
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center text-gray-400 dark:text-gray-500 text-sm">
          Memuat…
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center text-gray-400 dark:text-gray-500 text-sm">
          Belum ada aktivitas tercatat.
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(({ day, items }) => (
            <div key={day}>
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 px-1">
                {format(parseISO(day), 'EEEE, d MMMM yyyy', { locale: localeId })}
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                {items.map(r => {
                  const meta = ACTION_META[r.action] ?? ACTION_META.reschedule;
                  const Icon = meta.icon;
                  return (
                    <div key={r.id} className="flex items-start gap-3 px-4 py-3">
                      <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium ${meta.cls}`}>
                        <Icon size={11} /> {meta.label}
                      </span>
                      <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 min-w-0 break-words">{r.description}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums flex-shrink-0">
                        {format(parseISO(r.created_at), 'HH:mm')}
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
  );
}
