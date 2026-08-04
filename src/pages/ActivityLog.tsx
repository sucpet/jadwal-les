import { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { RefreshCw, Trash2, Plus, Pencil, CalendarClock, X, History, RotateCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLang } from '../store/LanguageContext';
import { useConfirm } from '../store/ConfirmContext';

interface LogRow {
  id: string;
  action: 'create' | 'reschedule' | 'delete' | 'restore' | 'update';
  description: string;
  user_name?: string | null;
  created_at: string;
}

const ACTION_META: Record<LogRow['action'], { icon: typeof Plus; cls: string }> = {
  create:     { icon: Plus,          cls: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
  update:     { icon: Pencil,        cls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
  reschedule: { icon: CalendarClock, cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
  delete:     { icon: X,             cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
  restore:    { icon: RotateCcw,     cls: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' },
};

export default function ActivityLog() {
  const { t, locale } = useLang();
  const confirm = useConfirm();
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
    if (!(await confirm({ message: t('log.clearConfirm'), danger: true }))) return;
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
            <History size={22} /> {t('log.title')}
          </h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{t('log.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> {t('log.reload')}
          </button>
          {rows.length > 0 && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 size={15} /> {t('log.clear')}
            </button>
          )}
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center text-gray-400 dark:text-gray-500 text-sm">
          {t('log.loading')}
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center text-gray-400 dark:text-gray-500 text-sm">
          {t('log.empty')}
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(({ day, items }) => (
            <div key={day}>
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 px-1">
                {format(parseISO(day), 'EEEE, d MMMM yyyy', { locale })}
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                {items.map(r => {
                  const meta = ACTION_META[r.action] ?? ACTION_META.reschedule;
                  const Icon = meta.icon;
                  return (
                    <div key={r.id} className="flex items-start gap-3 px-4 py-3">
                      <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium ${meta.cls}`}>
                        <Icon size={11} /> {t(`log.action.${r.action}`)}
                      </span>
                      <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 min-w-0 break-words">{r.description}</span>
                      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                        <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
                          {format(parseISO(r.created_at), 'HH:mm')}
                        </span>
                        {r.user_name && (
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">{r.user_name}</span>
                        )}
                      </div>
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
