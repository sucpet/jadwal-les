import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { format, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function MonthSelector({ month, onChange }: { month: Date; onChange: (d: Date) => void }) {
  const [open, setOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(month.getFullYear());
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        pickerRef.current && !pickerRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 8, left: r.left + r.width / 2 });
    }
    setPickerYear(month.getFullYear());
    setOpen(v => !v);
  };

  const select = (m: number) => {
    onChange(new Date(pickerYear, m, 1));
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange(subMonths(month, 1))}
        className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <ChevronLeft size={16} />
      </button>

      <button
        ref={btnRef}
        onClick={handleOpen}
        className="font-semibold text-gray-900 dark:text-white capitalize min-w-36 text-center hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
      >
        {format(month, 'MMMM yyyy')}
      </button>

      <button
        onClick={() => onChange(addMonths(month, 1))}
        className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <ChevronRight size={16} />
      </button>

      {open && createPortal(
        <div
          ref={pickerRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, transform: 'translateX(-50%)', zIndex: 9999 }}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3 w-56"
        >
          <div className="flex items-center justify-between mb-2 px-1">
            <button onClick={() => setPickerYear(y => y - 1)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400">
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">{pickerYear}</span>
            <button onClick={() => setPickerYear(y => y + 1)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400">
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {MONTHS_SHORT.map((label, i) => {
              const active = pickerYear === month.getFullYear() && i === month.getMonth();
              return (
                <button
                  key={i}
                  onClick={() => select(i)}
                  className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    active
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
