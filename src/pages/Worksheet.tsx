import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Plus, Trash2, FileText, X, Check } from 'lucide-react';
import { useApp } from '../store/AppContext';

const WORKSHEET_PRICE = 20_000;

function cycleStart(dateStr: string): string {
  const d = parseISO(dateStr);
  const day = d.getDate();
  const start = day >= 26
    ? new Date(d.getFullYear(), d.getMonth(), 26)
    : new Date(d.getFullYear(), d.getMonth() - 1, 26);
  return format(start, 'yyyy-MM-dd');
}

function cycleLabel(startKey: string): string {
  const start = parseISO(startKey);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 25);
  return `${format(start, 'd MMM', { locale: localeId })} – ${format(end, 'd MMM yyyy', { locale: localeId })}`;
}

function formatRp(n: number): string {
  return 'Rp ' + n.toLocaleString('id-ID');
}

export default function WorksheetPage() {
  const { data, addWorksheet, deleteWorksheet } = useApp();

  const xuYuanStudents = data.students.filter(s => s.group === 'xuyuan' && s.isActive);
  const today = new Date().toISOString().slice(0, 10);

  const [showForm, setShowForm] = useState(false);
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

  const remove = (id: string) => {
    if (confirm('Hapus entri worksheet ini?')) deleteWorksheet(id);
  };

  // Group by cycle
  const sorted = [...data.worksheets].sort((a, b) => b.date.localeCompare(a.date));
  const cycleMap = new Map<string, typeof sorted>();
  for (const w of sorted) {
    const key = cycleStart(w.date);
    if (!cycleMap.has(key)) cycleMap.set(key, []);
    cycleMap.get(key)!.push(w);
  }
  const cycles = [...cycleMap.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const currentCycle = cycleStart(today);

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Worksheet</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">XuYuan · {formatRp(WORKSHEET_PRICE)}/halaman</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setShowErrors(false); }}
          className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-indigo-700"
        >
          <Plus size={16} /> Tambah
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">Tambah Worksheet</h3>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X size={18} />
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Murid</label>
            <select
              value={form.studentId}
              onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))}
              className={`w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${showErrors && !form.studentId ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}`}
            >
              <option value="">Pilih murid</option>
              {[...xuYuanStudents].sort((a, b) => a.name.localeCompare(b.name, 'id')).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {showErrors && !form.studentId && <p className="text-xs text-red-500 mt-1">Murid wajib dipilih</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Tanggal</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Jumlah Halaman</label>
              <input
                type="number"
                min="1"
                value={form.pages}
                onChange={e => setForm(f => ({ ...f, pages: e.target.value }))}
                onKeyDown={e => (e.key === '-' || e.key === 'e') && e.preventDefault()}
                placeholder="0"
                className={`w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${showErrors && pagesNum < 1 ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}`}
              />
              {showErrors && pagesNum < 1 && <p className="text-xs text-red-500 mt-1">Minimal 1 halaman</p>}
            </div>
          </div>

          {pagesNum > 0 && (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg px-4 py-2.5 flex items-center justify-between">
              <span className="text-sm text-indigo-700 dark:text-indigo-300">{pagesNum} hal × {formatRp(WORKSHEET_PRICE)}</span>
              <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">{formatRp(cost)}</span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={save} className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700">
              <Check size={16} /> Simpan
            </button>
            <button onClick={() => setShowForm(false)} className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">
              <X size={16} /> Batal
            </button>
          </div>
        </div>
      )}

      {/* No data */}
      {data.worksheets.length === 0 && !showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center text-gray-400 dark:text-gray-500">
          <FileText size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Belum ada worksheet dicatat.</p>
        </div>
      )}

      {/* Cycles */}
      {cycles.map(([key, entries]) => {
        const totalPages = entries.reduce((sum, w) => sum + w.pages, 0);
        const totalCost = totalPages * WORKSHEET_PRICE;
        const isCurrent = key === currentCycle;
        return (
          <div key={key} className={`rounded-xl border overflow-hidden ${isCurrent ? 'border-indigo-300 dark:border-indigo-600' : 'border-gray-200 dark:border-gray-700'}`}>
            <div className={`px-5 py-3.5 flex items-center justify-between ${isCurrent ? 'bg-indigo-600' : 'bg-white dark:bg-gray-800'}`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`font-semibold text-sm ${isCurrent ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{cycleLabel(key)}</span>
                  {isCurrent && <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">Berjalan</span>}
                </div>
                <div className={`text-xs mt-0.5 ${isCurrent ? 'text-indigo-200' : 'text-gray-500 dark:text-gray-400'}`}>
                  {totalPages} halaman · {entries.length} entri
                </div>
              </div>
              <div className={`text-xl font-bold tabular-nums ${isCurrent ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                {formatRp(totalCost)}
              </div>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {entries.map(w => {
                const student = data.students.find(s => s.id === w.studentId);
                return (
                  <div key={w.id} className="px-4 py-3 bg-white dark:bg-gray-800 flex items-center gap-2">
                    <span className="text-xs text-gray-400 dark:text-gray-500 w-[4.5rem] flex-shrink-0 tabular-nums">
                      {format(parseISO(w.date), 'd MMM yy', { locale: localeId })}
                    </span>
                    <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white truncate min-w-0">
                      {student?.name ?? '—'}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                      <FileText size={12} className="text-gray-400" />
                      {w.pages} hal
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums flex-shrink-0">
                      {formatRp(w.pages * WORKSHEET_PRICE)}
                    </span>
                    <button
                      onClick={() => remove(w.id)}
                      className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 flex-shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
