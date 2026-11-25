import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toJpeg } from 'html-to-image';
import { format, parseISO } from 'date-fns';
import { Download, X, FileArchive } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { useLang } from '../store/LanguageContext';
import { useToast } from '../store/ToastContext';
import { formatCurrency, getMonthlyInvoices } from '../utils/helpers';

type MonthlyInvoice = ReturnType<typeof getMonthlyInvoices>[number];

// ─── Kartu invoice (selalu terang agar hasil PDF sama di light/dark mode) ────────

function InvoiceCard({ inv, month, ref }: { inv: MonthlyInvoice; month: Date; ref?: (el: HTMLDivElement | null) => void }) {
  const { t, locale } = useLang();
  const isFamily = inv.members.length > 1;
  const sessionCount = inv.groups.reduce((n, g) => n + g.lines.length, 0);
  return (
    <div ref={ref} className="w-96 bg-white rounded-2xl p-6 font-sans">
      <div className="text-center border-b border-gray-200 pb-4 mb-4">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">INVOICE</h2>
        {isFamily && <p className="text-[10px] uppercase tracking-wider text-gray-400 mt-1">{t('inv.family')}</p>}
        <p className={`text-sm text-gray-700 font-medium ${isFamily ? '' : 'mt-1'}`}>{inv.title}</p>
        <p className="text-sm text-gray-500">{format(month, 'MMMM yyyy', { locale })}</p>
      </div>
      <table className="w-full text-sm mb-4">
        <thead>
          <tr className="text-xs text-gray-400 border-b border-gray-100">
            <th className="text-left pb-2 font-medium">{t('common.date')}</th>
            <th className="text-left pb-2 font-medium">{t('inv.time')}</th>
            <th className="text-right pb-2 font-medium">{t('inv.amount')}</th>
          </tr>
        </thead>
        {inv.groups.map(g => (
          <tbody key={g.student.id}>
            {isFamily && (
              <tr>
                <td colSpan={3} className="pt-3 pb-1 text-xs font-semibold text-gray-700">{g.student.name}</td>
              </tr>
            )}
            {g.lines.map(({ session, amount }) => (
              <tr key={session.id} className="border-b border-gray-50">
                <td className="py-2 text-gray-800">{format(parseISO(session.date), 'EEE, d MMM', { locale })}</td>
                <td className="py-2 text-gray-500 tabular-nums">{session.startTime}–{session.endTime}</td>
                <td className="py-2 text-right tabular-nums text-gray-900">{formatCurrency(amount)}</td>
              </tr>
            ))}
            {isFamily && (
              <tr>
                <td colSpan={2} className="py-1.5 text-xs text-gray-500">{t('inv.subtotal', { n: g.lines.length })}</td>
                <td className="py-1.5 text-right text-xs tabular-nums font-medium text-gray-700">{formatCurrency(g.subtotal)}</td>
              </tr>
            )}
          </tbody>
        ))}
      </table>
      <div className="border-t border-gray-200 pt-3 space-y-1">
        <div className="flex justify-between text-sm text-gray-500">
          <span>{t('inv.sessions')}</span>
          <span className="tabular-nums font-medium text-gray-700">{sessionCount}</span>
        </div>
        <div className="flex justify-between text-base font-bold text-gray-900">
          <span>Total</span>
          <span className="tabular-nums">{formatCurrency(inv.total)}</span>
        </div>
      </div>
      <p className="text-[10px] text-gray-300 text-center mt-5">{format(new Date(), 'd MMMM yyyy', { locale })}</p>
    </div>
  );
}

// ─── PDF / ZIP ───────────────────────────────────────────────────────────────

// PDF satu halaman panjang setinggi kartu: gambar tinggi terpotong di pratinjau WhatsApp, PDF tidak.
async function cardToPdf(el: HTMLElement) {
  // JPEG, bukan PNG: PNG tak terkompres di PDF jadi 2–4 MB per invoice
  const [img, { jsPDF }] = await Promise.all([
    toJpeg(el, { pixelRatio: 2, quality: 0.92, backgroundColor: '#ffffff' }),
    import('jspdf'),
  ]);
  const w = el.offsetWidth, h = el.offsetHeight; // px CSS → unit 'px' jsPDF
  const pdf = new jsPDF({ unit: 'px', format: [w, h], orientation: w > h ? 'landscape' : 'portrait', hotfixes: ['px_scaling'] });
  pdf.addImage(img, 'JPEG', 0, 0, w, h);
  return pdf;
}

const pdfName = (inv: MonthlyInvoice, monthStr: string) =>
  `invoice-${inv.members.map(m => m.name).join('-').replace(/[\s/\\]+/g, '-')}-${monthStr}.pdf`;

function saveBlob(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

// ─── Popup: daftar invoice postpaid bulan ini ────────────────────────────────

export default function PostpaidInvoicesModal({ month, onClose }: { month: Date; onClose: () => void }) {
  const { data } = useApp();
  const { t, locale } = useLang();
  const toast = useToast();
  const monthStr = format(month, 'yyyy-MM');
  const invoices = getMonthlyInvoices(data.students, data.sessions, monthStr);
  const cards = useRef(new Map<string, HTMLDivElement>());
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [zipProgress, setZipProgress] = useState<number | null>(null);
  const busy = busyKey !== null || zipProgress !== null;

  const downloadOne = async (inv: MonthlyInvoice) => {
    const el = cards.current.get(inv.key);
    if (!el) return;
    setBusyKey(inv.key);
    try {
      (await cardToPdf(el)).save(pdfName(inv, monthStr));
    } catch {
      toast.error(t('inv.downloadFail'));
    } finally {
      setBusyKey(null);
    }
  };

  const downloadAll = async () => {
    setZipProgress(0);
    try {
      const files: Record<string, Uint8Array> = {};
      for (const [i, inv] of invoices.entries()) {
        const el = cards.current.get(inv.key);
        if (!el) continue;
        const pdf = await cardToPdf(el);
        let name = pdfName(inv, monthStr);
        for (let n = 2; files[name]; n++) name = pdfName(inv, monthStr).replace(/\.pdf$/, `-${n}.pdf`); // nama kembar
        files[name] = new Uint8Array(pdf.output('arraybuffer'));
        setZipProgress(i + 1);
      }
      const { zipSync } = await import('fflate');
      const zip = zipSync(files, { level: 0 }); // PDF sudah terkompres
      saveBlob(new Blob([zip.buffer as ArrayBuffer], { type: 'application/zip' }), `invoice-postpaid-${monthStr}.zip`);
    } catch {
      toast.error(t('inv.downloadFail'));
    } finally {
      setZipProgress(null);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={busy ? undefined : onClose}>
      <div className="w-full max-w-md flex flex-col max-h-[calc(100dvh-2rem)] bg-white dark:bg-gray-800 rounded-2xl shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('inv.button')}</h2>
            <p className="text-xs text-gray-400 capitalize">{format(month, 'MMMM yyyy', { locale })}</p>
          </div>
          <button onClick={onClose} disabled={busy} title={t('inv.close')}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg disabled:opacity-40">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto overscroll-contain px-2 py-2">
          {invoices.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">{t('inv.empty')}</p>
          ) : invoices.map(inv => (
            <div key={inv.key} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/40">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{inv.title}</p>
                <p className="text-xs text-gray-400 tabular-nums">
                  {t('common.sessions_n', { n: inv.groups.reduce((n, g) => n + g.lines.length, 0) })} · {formatCurrency(inv.total)}
                </p>
              </div>
              <button onClick={() => downloadOne(inv)} disabled={busy} title={t('set.download')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-40">
                <Download size={14} /> {busyKey === inv.key ? t('inv.saving') : 'PDF'}
              </button>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 shrink-0">
          <button onClick={downloadAll} disabled={busy || invoices.length === 0}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-60">
            <FileArchive size={15} />
            {zipProgress !== null ? t('inv.zipping', { n: zipProgress, total: invoices.length }) : t('inv.downloadAll', { n: invoices.length })}
          </button>
        </div>
      </div>

      {/* Kartu dirender di luar layar untuk ditangkap jadi PDF */}
      <div aria-hidden className="fixed top-0 left-[-10000px] pointer-events-none">
        {invoices.map(inv => (
          <InvoiceCard key={inv.key} inv={inv} month={month}
            ref={el => { if (el) cards.current.set(inv.key, el); else cards.current.delete(inv.key); }} />
        ))}
      </div>
    </div>,
    document.body,
  );
}
