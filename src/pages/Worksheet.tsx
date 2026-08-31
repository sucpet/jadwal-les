import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Plus, Trash2, FileText, X, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { useLang } from '../store/LanguageContext';
import { useConfirm } from '../store/ConfirmContext';
import { useToast } from '../store/ToastContext';
import { xuYuanCycleStart as cycleStart, xuYuanCycleLabel as cycleLabel, formatRp } from '../utils/xuyuan';

const WORKSHEET_PRICE = 20_000;

export default function WorksheetPage() {
  const { data, addWorksheet, deleteWorksheet } = useApp();
  const { t, locale } = useLang();
  const confirm = useConfirm();
  const toast = useToast();

  const xuYuanStudents = data.students.filter(s => s.group === 'xuyuan' && s.isActive);
  const today = new Date().toISOString().slice(0, 10);

  const [showForm, setShowForm] = useState(false);
  const [cycleIndex, setCycleIndex] = useState(0); // 0 = siklus terbaru
  const [form, setForm] = useState({
    studentId: xuYuanStudents[0]?.id ?? '',
    date: today,
    pages: '',
  });
  const [showErrors, setShowErrors] = useState(false);

  const pagesNum = Math.max(0, Number(form.pages) || 0);
  const cost = pagesNum * WORKSHEET_PRICE;

  const save = () => {
    if (!form.studentId || !form.date || pagesNum < 1) { setShowErrors(true); return; }
    addWorksheet({ studentId: form.studentId, date: form.date, pages: pagesNum });
    setShowForm(false);
    setForm({ studentId: xuYuanStudents[0]?.id ?? '', date: today, pages: '' });
    setShowErrors(false);
  };

  const remove = async (id: string) => {
    if (await confirm({ message: t('ws.deleteConfirm'), danger: true })) { deleteWorksheet(id); toast.success(t('common.deleted')); }
  };

  // Group by cycle
  const sorted = [...data.worksheets].sort((a, b) => b.date.localeCompare(a.date));
  const cycleMap = new Map<string, typeof sorted>();
  for (const w of sorted) {
    const key = cycleStart(w.date);
    if (!cycleMap.has(key)) cycleMap.set(key, []);
    cycleMap.get(key)!.push(w);
  }
  const currentCycle = cycleStart(today);
  if (!cycleMap.has(currentCycle)) cycleMap.set(currentCycle, []);
  const cycles = [...cycleMap.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const cycle = cycles[cycleIndex] ?? cycles[0];

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Worksheet</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{t('ws.subtitle', { price: formatRp(WORKSHEET_PRICE) })}</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setShowErrors(false); }}
          className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-indigo-700"
        >
          <Plus size={16} /> {t('common.add')}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">{t('ws.addTitle')}</h3>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X size={18} />
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('common.student')}</label>
            <select
              value={form.studentId}
              onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))}
              className={`w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${showErrors && !form.studentId ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}`}
            >
              <option value="">{t('common.selectStudent')}</option>
              {[...xuYuanStudents].sort((a, b) => a.name.localeCompare(b.name, 'id')).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {showErrors && !form.studentId && <p className="text-xs text-red-500 mt-1">{t('ws.studentRequired')}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('common.date')}</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('ws.pages')}</label>
              <input
                type="number"
                min="1"
                value={form.pages}
                onChange={e => setForm(f => ({ ...f, pages: e.target.value }))}
                onKeyDown={e => (e.key === '-' || e.key === 'e') && e.preventDefault()}
                placeholder="0"
                className={`w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${showErrors && pagesNum < 1 ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}`}
              />
              {showErrors && pagesNum < 1 && <p className="text-xs text-red-500 mt-1">{t('ws.minPage')}</p>}
            </div>
          </div>

          {pagesNum > 0 && (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg px-4 py-2.5 flex items-center justify-between">
              <span className="text-sm text-indigo-700 dark:text-indigo-300">{t('ws.perPage', { n: pagesNum, price: formatRp(WORKSHEET_PRICE) })}</span>
              <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">{formatRp(cost)}</span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={save} className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700">
              <Check size={16} /> {t('common.save')}
            </button>
            <button onClick={() => setShowForm(false)} className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">
              <X size={16} /> {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Cycle navigator */}
      {cycles.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCycleIndex(i => Math.min(i + 1, cycles.length - 1))}
            disabled={cycleIndex >= cycles.length - 1}
            className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="font-semibold text-gray-900 dark:text-white min-w-48 text-center">
            {cycle ? cycleLabel(cycle[0], locale) : '—'}
            {cycle?.[0] === currentCycle && (
              <span className="ml-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">{t('common.running')}</span>
            )}
          </span>
          <button
            onClick={() => setCycleIndex(i => Math.max(i - 1, 0))}
            disabled={cycleIndex === 0}
            className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Current cycle */}
      {cycle && (() => {
        const [key, entries] = cycle;
        const isCurrent = key === currentCycle;
        const totalPages = entries.reduce((sum, w) => sum + w.pages, 0);
        const totalCost = totalPages * WORKSHEET_PRICE;

        // Group by student
        const studentMap = new Map<string, typeof entries>();
        for (const w of entries) {
          if (!studentMap.has(w.studentId)) studentMap.set(w.studentId, []);
          studentMap.get(w.studentId)!.push(w);
        }
        const studentGroups = [...studentMap.entries()]
          .map(([studentId, ws]) => ({
            student: data.students.find(s => s.id === studentId),
            ws: ws.sort((a, b) => b.date.localeCompare(a.date)),
            totalPages: ws.reduce((sum, w) => sum + w.pages, 0),
          }))
          .sort((a, b) => (a.student?.name ?? '').localeCompare(b.student?.name ?? '', 'id'));

        return (
          <div className={`rounded-xl border overflow-hidden ${isCurrent ? 'border-indigo-300 dark:border-indigo-600' : 'border-gray-200 dark:border-gray-700'}`}>
            <div className={`px-5 py-3.5 flex items-center justify-between ${isCurrent ? 'bg-indigo-600' : 'bg-white dark:bg-gray-800'}`}>
              <div className={`text-sm ${isCurrent ? 'text-indigo-200' : 'text-gray-500 dark:text-gray-400'}`}>
                {t('ws.cyclePages', { pages: totalPages, entries: entries.length })}
              </div>
              <div className={`text-xl font-bold tabular-nums ${isCurrent ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                {formatRp(totalCost)}
              </div>
            </div>

            {studentGroups.length > 0 ? (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {studentGroups.map(({ student, ws, totalPages: stuPages }) => (
                  <div key={student?.id ?? 'unknown'} className="px-4 py-3 bg-white dark:bg-gray-800">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex-1 text-sm font-semibold text-gray-800 dark:text-gray-200">{student?.name ?? '—'}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
                        {t('ws.pagesUnit', { n: stuPages })} · {formatRp(stuPages * WORKSHEET_PRICE)}
                      </span>
                    </div>
                    <div className="space-y-1 pl-2 border-l-2 border-gray-100 dark:border-gray-700">
                      {ws.map(w => (
                        <div key={w.id} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <span className="w-16 flex-shrink-0 tabular-nums">
                            {format(parseISO(w.date), 'd MMM yy', { locale })}
                          </span>
                          <span className="flex items-center gap-1 flex-1">
                            <FileText size={11} className="text-gray-400 flex-shrink-0" />
                            {t('ws.pagesUnit', { n: w.pages })}
                          </span>
                          <span className="tabular-nums font-medium text-gray-700 dark:text-gray-300">
                            {formatRp(w.pages * WORKSHEET_PRICE)}
                          </span>
                          <button onClick={() => remove(w.id)} className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 flex-shrink-0">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-5 py-4 bg-white dark:bg-gray-800 text-sm text-gray-400 dark:text-gray-500 text-center">
                {t('ws.empty')}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
