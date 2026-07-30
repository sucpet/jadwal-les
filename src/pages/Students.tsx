import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, X, Check, ChevronDown, ChevronUp, Package, AlertTriangle, Clock, CalendarDays, CalendarClock, StickyNote, PowerOff, RotateCcw, Search, Wallet } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useApp } from '../store/AppContext';
import { useLang } from '../store/LanguageContext';
import { useConfirm } from '../store/ConfirmContext';
import { formatCurrency, getPackageStatus, formatDate } from '../utils/helpers';
import { groupByMonth, groupByXuYuanCycle, totalDurationLabel, getPackageAttributedSessions } from '../utils/student-groups';
import type { BillingType, Student, StudentGroup, SessionPackage, PackagePricingType, LessonSession } from '../types';
import { STUDENT_GROUPS } from '../types';

// Reusable date chips row
function SessionDateChips({ sessions }: { sessions: LessonSession[] }) {
  const { t, locale } = useLang();
  if (sessions.length === 0) return <span className="text-xs text-gray-400 italic">{t('stu.noSessionChips')}</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {sessions.map(s => (
        <span key={s.id} className={`text-xs px-1.5 py-0.5 rounded ${
          s.status === 'scheduled'
            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-500 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
        }`}>
          {format(parseISO(s.date), 'd MMM', { locale })}
        </span>
      ))}
    </div>
  );
}

// ─── Student Form ─────────────────────────────────────────────────────────────

type InitialPackageData = Omit<SessionPackage, 'id' | 'createdAt' | 'studentId' | 'teacherId'>;

interface StudentFormProps {
  initial?: Student;
  teachers: ReturnType<typeof useApp>['data']['teachers'];
  onSave: (data: Omit<Student, 'id' | 'createdAt' | 'isActive'>, initialPackage?: InitialPackageData) => void;
  onCancel: () => void;
}

function StudentForm({ initial, teachers, onSave, onCancel }: StudentFormProps) {
  const { t, locale } = useLang();
  const isNew = !initial;

  const [form, setForm] = useState({
    teacherId: initial?.teacherId ?? teachers.find(te => te.isActive)?.id ?? '',
    name: initial?.name ?? '',
    billingType: initial?.billingType ?? ('per-session' as BillingType),
    group: initial?.group ?? ('xuyuan' as StudentGroup),
    ratePerSession: initial?.ratePerSession != null ? String(initial.ratePerSession) : '',
    notes: initial?.notes ?? '',
  });

  const [xuYuanType, setXuYuanType] = useState<'private' | 'semi-group'>(
    initial?.xuYuanType ?? 'private'
  );

  // Perubahan harga terjadwal (postpaid, edit only)
  const [pendingRate, setPendingRate] = useState(initial?.pendingRate != null ? String(initial.pendingRate) : '');
  const [pendingDate, setPendingDate] = useState(initial?.pendingRateEffectiveDate ?? '');
  const [pendingCancelledNote, setPendingCancelledNote] = useState(false);

  // Dibayar lembaga (deferred revenue)
  const [deferredPayment, setDeferredPayment] = useState(initial?.deferredPayment ?? false);

  // Package fields — only relevant for new prepaid students
  const [showErrors, setShowErrors] = useState(false);
  const [pricingType, setPricingType] = useState<PackagePricingType>('per-session');
  const [pkg, setPkg] = useState({
    totalSessions: '',
    pricePerSession: '',
    packagePrice: '',
    startDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const isXuYuan = form.group === 'xuyuan';
  const isPrepaid = !isXuYuan && form.billingType === 'package';
  const isPostpaidEdit = !isNew && !isXuYuan && !isPrepaid;
  const pkgSessions = Number(pkg.totalSessions);

  // Perubahan harga terjadwal: harus isi keduanya atau kosongkan keduanya
  const pendingRateNum = Number(pendingRate);
  const hasPending = pendingRate !== '' && pendingDate !== '';
  const pendingPartial = (pendingRate !== '') !== (pendingDate !== '');
  const pendingInvalid = pendingPartial || (pendingRate !== '' && pendingRateNum <= 0);

  const effectivePerSession = pricingType === 'per-session'
    ? Number(pkg.pricePerSession)
    : pkgSessions > 0 ? Math.round(Number(pkg.packagePrice) / pkgSessions) : 0;

  const effectiveTotal = pricingType === 'per-session'
    ? pkgSessions * Number(pkg.pricePerSession)
    : Number(pkg.packagePrice);

  const pkgValid = !isNew || !isPrepaid || (
    pkg.totalSessions &&
    pkg.startDate &&
    (pricingType === 'per-session' ? pkg.pricePerSession : pkg.packagePrice)
  );

  // XuYuan & prepaid-new tidak perlu rate manual
  const rateValid = isXuYuan || (isPrepaid && isNew) ? true : form.ratePerSession;
  const valid = form.name.trim() && form.teacherId && rateValid && pkgValid && !pendingInvalid;

  const handleSave = () => {
    if (!valid) { setShowErrors(true); return; }
    const ratePerSession = isXuYuan ? 0 : isPrepaid && isNew ? effectivePerSession : Number(form.ratePerSession);
    const billingType: BillingType = isXuYuan ? 'per-session' : form.billingType;
    const studentData = {
      ...form, billingType, ratePerSession, notes: form.notes, xuYuanType,
      pendingRate: hasPending ? pendingRateNum : undefined,
      pendingRateEffectiveDate: hasPending ? pendingDate : undefined,
      deferredPayment: isXuYuan ? false : deferredPayment,
    };
    const pkgData: InitialPackageData | undefined = (isNew && isPrepaid) ? {
      totalSessions: pkgSessions,
      pricingType,
      pricePerSession: effectivePerSession,
      packagePrice: pricingType === 'per-package' ? Number(pkg.packagePrice) : undefined,
      startDate: pkg.startDate,
      notes: pkg.notes,
    } : undefined;
    onSave(studentData, pkgData);
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4">
      <h3 className="font-semibold text-gray-900 dark:text-white">{initial ? t('stu.editTitle') : t('stu.addTitle')}</h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Laoshi</label>
          <select value={form.teacherId} onChange={e => setForm(f => ({ ...f, teacherId: e.target.value }))}
            className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white">
            {[...teachers].filter(te => te.isActive || te.id === form.teacherId).sort((a, b) => a.name.localeCompare(b.name, 'id')).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('stu.studentName')}</label>
          <input autoFocus type="text" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder={t('stu.studentNamePh')} className={`input w-full ${showErrors && !form.name.trim() ? 'input-error' : ''}`} />
          {showErrors && !form.name.trim() && (
            <p className="text-xs text-red-500 mt-1">{t('stu.nameRequired')}</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">{t('stu.group')}</label>
        <div className="flex gap-2">
          {STUDENT_GROUPS.map(({ value, label }) => (
            <button key={value} type="button"
              onClick={() => setForm(f => ({
                ...f,
                group: value,
                // reset billing ke per-session saat pindah ke/dari xuyuan
                billingType: value === 'xuyuan' ? 'per-session' : f.billingType,
                ratePerSession: value === 'xuyuan' ? '' : f.ratePerSession,
              }))}
              className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                form.group === value
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-400 text-indigo-700 dark:text-indigo-300'
                  : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {isXuYuan && (
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('stu.sessionType')}</label>
          <div className="flex gap-2">
            {(['private', 'semi-group'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setXuYuanType(t)}
                className={`flex-1 text-sm py-1.5 rounded-lg border transition-colors ${xuYuanType === t ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'}`}
              >
                {t === 'private' ? 'Private' : 'Semi Group'}
              </button>
            ))}
          </div>
        </div>
      )}

      {!isXuYuan && (
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('stu.billingSystem')}</label>
          <div className="grid grid-cols-2 gap-2">
            {([['per-session', t('stu.postpaid'), t('stu.postpaidDesc')], ['package', t('stu.prepaid'), t('stu.prepaidDesc')]] as [BillingType, string, string][]).map(([val, label, desc]) => (
              <button key={val} type="button"
                onClick={() => setForm(f => ({ ...f, billingType: val }))}
                className={`py-2.5 px-3 rounded-lg border text-left transition-colors ${
                  form.billingType === val
                    ? val === 'per-session'
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-400 text-blue-800 dark:text-blue-300'
                      : 'bg-purple-50 dark:bg-purple-900/30 border-purple-400 text-purple-800 dark:text-purple-300'
                    : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}>
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs opacity-70 mt-0.5">{desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Postpaid: isi rate manual */}
      {!isXuYuan && !isPrepaid && (
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('stu.rate')}</label>
          <input type="number" min="0" onKeyDown={e => (e.key === '-' || e.key === 'e') && e.preventDefault()} value={form.ratePerSession}
            onChange={e => {
              const v = e.target.value;
              setForm(f => ({ ...f, ratePerSession: v }));
              // Edit-behavior B: mengubah harga langsung membatalkan perubahan terjadwal
              if (isPostpaidEdit && Number(v) !== initial?.ratePerSession && (pendingRate || pendingDate)) {
                setPendingRate('');
                setPendingDate('');
                if (initial?.pendingRate != null) setPendingCancelledNote(true);
              }
            }}
            placeholder="150000" className={`input w-full ${showErrors && !form.ratePerSession ? 'input-error' : ''}`} />
          {showErrors && !form.ratePerSession && (
            <p className="text-xs text-red-500 mt-1">{t('stu.rateRequired')}</p>
          )}
          {pendingCancelledNote && (
            <p className="text-xs text-amber-600 mt-1">{t('stu.pendingCancelled')}</p>
          )}
        </div>
      )}

      {/* Postpaid edit: jadwalkan perubahan harga untuk periode berikutnya */}
      {isPostpaidEdit && (
        <div className="border border-blue-200 dark:border-blue-800 rounded-xl p-4 space-y-3 bg-blue-50/60 dark:bg-blue-900/20">
          <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5 uppercase tracking-wide">
            <CalendarClock size={13} /> {t('stu.scheduleChange')}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('stu.scheduleChangeDesc')}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('stu.newRate')}</label>
              <input type="number" min="0" onKeyDown={e => (e.key === '-' || e.key === 'e') && e.preventDefault()} value={pendingRate}
                onChange={e => { setPendingRate(e.target.value); setPendingCancelledNote(false); }}
                placeholder="175000" className={`input w-full ${showErrors && pendingInvalid ? 'input-error' : ''}`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('stu.effectiveDate')}</label>
              <input type="date" value={pendingDate}
                onChange={e => { setPendingDate(e.target.value); setPendingCancelledNote(false); }}
                className={`input w-full ${showErrors && pendingInvalid ? 'input-error' : ''}`} />
            </div>
          </div>
          {showErrors && pendingInvalid && (
            <p className="text-xs text-red-500">{t('stu.pendingInvalid')}</p>
          )}
          {hasPending && pendingRateNum > 0 && (
            <div className="bg-blue-100 dark:bg-blue-900/40 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
              <span className="text-xs text-blue-800 dark:text-blue-200">
                {t('stu.from')} {formatDate(pendingDate, 'd MMM yyyy', locale)}: <span className="font-semibold">{formatCurrency(pendingRateNum)}</span>{t('stu.perSesi')}
              </span>
              <button type="button" onClick={() => { setPendingRate(''); setPendingDate(''); }}
                className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 flex-shrink-0">
                <X size={12} /> {t('common.delete')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Prepaid + murid baru: isi paket pertama langsung */}
      {isPrepaid && isNew && (
        <div className="border border-purple-200 dark:border-purple-800 rounded-xl p-4 space-y-3 bg-purple-50/60 dark:bg-purple-900/20">
          <div className="text-xs font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-1.5 uppercase tracking-wide">
            <Package size={13} /> {t('stu.firstPackage')}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('stu.numSessions')}</label>
              <input type="number" min="0" onKeyDown={e => (e.key === '-' || e.key === 'e') && e.preventDefault()} value={pkg.totalSessions}
                onChange={e => setPkg(p => ({ ...p, totalSessions: e.target.value }))}
                placeholder="8" className={`input w-full ${showErrors && !pkg.totalSessions ? 'input-error' : ''}`} />
              {showErrors && !pkg.totalSessions && (
                <p className="text-xs text-red-500 mt-1">{t('stu.numSessionsRequired')}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('stu.startDate')}</label>
              <input type="date" value={pkg.startDate}
                onChange={e => setPkg(p => ({ ...p, startDate: e.target.value }))}
                className="input w-full" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">{t('stu.pricingMethod')}</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                ['per-session', t('stu.perSessionLabel'), t('stu.perSessionDesc')],
                ['per-package', t('stu.perPackageLabel'), t('stu.perPackageDesc')],
              ] as [PackagePricingType, string, string][]).map(([val, label, desc]) => (
                <button key={val} type="button"
                  onClick={() => setPricingType(val)}
                  className={`py-2.5 px-3 rounded-lg border text-left transition-colors ${
                    pricingType === val
                      ? 'bg-purple-100 dark:bg-purple-900/40 border-purple-400 dark:border-purple-500 text-purple-800 dark:text-purple-200'
                      : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}>
                  <div className="text-sm font-medium">{label}</div>
                  <div className="text-xs opacity-70 mt-0.5">{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {pricingType === 'per-session' ? (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('stu.pricePerSession')}</label>
              <input type="number" min="0" onKeyDown={e => (e.key === '-' || e.key === 'e') && e.preventDefault()} value={pkg.pricePerSession}
                onChange={e => setPkg(p => ({ ...p, pricePerSession: e.target.value }))}
                placeholder="145000" className={`input w-full ${showErrors && !pkg.pricePerSession ? 'input-error' : ''}`} />
              {showErrors && !pkg.pricePerSession && (
                <p className="text-xs text-red-500 mt-1">{t('stu.priceRequired')}</p>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('stu.packageTotal')}</label>
              <input type="number" min="0" onKeyDown={e => (e.key === '-' || e.key === 'e') && e.preventDefault()} value={pkg.packagePrice}
                onChange={e => setPkg(p => ({ ...p, packagePrice: e.target.value }))}
                placeholder="1160000" className={`input w-full ${showErrors && !pkg.packagePrice ? 'input-error' : ''}`} />
              {showErrors && !pkg.packagePrice && (
                <p className="text-xs text-red-500 mt-1">{t('stu.packageTotalRequired')}</p>
              )}
            </div>
          )}

          {pkgSessions > 0 && effectiveTotal > 0 && (
            <div className="bg-purple-100 dark:bg-purple-900/40 rounded-lg px-3 py-2.5 space-y-0.5">
              {pricingType === 'per-session' ? (
                <>
                  <div className="text-xs text-purple-700 dark:text-purple-300">
                    {t('stu.meetingsTimes', { n: pkgSessions, price: formatCurrency(Number(pkg.pricePerSession)) })}
                  </div>
                  <div className="text-sm font-semibold text-purple-900 dark:text-purple-100">
                    {t('stu.totalColon', { x: formatCurrency(effectiveTotal) })}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-xs text-purple-700 dark:text-purple-300">
                    {t('stu.divideMeetings', { price: formatCurrency(effectiveTotal), n: pkgSessions })}
                  </div>
                  <div className="text-sm font-semibold text-purple-900 dark:text-purple-100">
                    {t('stu.perMeetingResult', { price: formatCurrency(effectivePerSession) })}
                  </div>
                </>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('stu.pkgNotes')}</label>
            <input type="text" value={pkg.notes}
              onChange={e => setPkg(p => ({ ...p, notes: e.target.value }))}
              placeholder={t('stu.pkgNotesPh')} className="input w-full" />
          </div>
        </div>
      )}

      {/* Prepaid edit: rate hanya display info */}
      {!isXuYuan && isPrepaid && !isNew && (
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('stu.rate')}</label>
          <input type="number" min="0" onKeyDown={e => (e.key === '-' || e.key === 'e') && e.preventDefault()} value={form.ratePerSession}
            onChange={e => setForm(f => ({ ...f, ratePerSession: e.target.value }))}
            placeholder="145000" className="input w-full" />
          <p className="text-xs text-gray-400 mt-1">{t('stu.pkgManaged')}</p>
        </div>
      )}

      {!isXuYuan && (
        <label className="flex items-start gap-3 border border-gray-300 dark:border-gray-600 rounded-xl p-3 cursor-pointer bg-gray-50 dark:bg-gray-700/40">
          <input type="checkbox" checked={deferredPayment}
            onChange={e => setDeferredPayment(e.target.checked)}
            className="w-4 h-4 mt-0.5 accent-indigo-600 flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{t('pay.deferredToggle')}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('pay.deferredDesc')}</div>
          </div>
        </label>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('stu.notes')}</label>
        <input type="text" value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder={t('stu.notesPh')} className="input w-full" />
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={handleSave}
          className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700">
          <Check size={15} /> {t('common.save')}
        </button>
        <button onClick={onCancel}
          className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
          <X size={15} /> {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}

// ─── Package Form ─────────────────────────────────────────────────────────────

interface PackageFormProps {
  studentId: string;
  teacherId: string;
  defaultRate: number;
  existingPackages: SessionPackage[];
  initial?: SessionPackage;
  onSave: (pkg: Omit<SessionPackage, 'id' | 'createdAt'>) => void;
  onCancel: () => void;
}

function PackageForm({ studentId, teacherId, defaultRate, existingPackages, initial, onSave, onCancel }: PackageFormProps) {
  const { t } = useLang();
  const lastPkg = [...existingPackages]
    .filter(p => !initial || p.id !== initial.id)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];

  const defaultStart = (() => {
    if (initial) return initial.startDate;
    if (!lastPkg) return new Date().toISOString().slice(0, 10);
    const d = new Date(lastPkg.startDate);
    d.setMonth(d.getMonth() + 1);
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  })();

  const [pricingType, setPricingType] = useState<PackagePricingType>(initial?.pricingType ?? 'per-session');
  const [showErrors, setShowErrors] = useState(false);
  const [form, setForm] = useState({
    totalSessions: initial ? String(initial.totalSessions) : '',
    pricePerSession: initial
      ? String(initial.pricingType === 'per-package' ? (initial.packagePrice ?? 0) / initial.totalSessions : initial.pricePerSession)
      : defaultRate ? String(defaultRate) : '',
    packagePrice: initial?.packagePrice ? String(initial.packagePrice) : '',
    startDate: defaultStart,
    notes: initial?.notes ?? '',
  });

  const sessions = Number(form.totalSessions);

  // Derived values
  const effectivePerSession = pricingType === 'per-session'
    ? Number(form.pricePerSession)
    : sessions > 0 ? Math.round(Number(form.packagePrice) / sessions) : 0;
  const effectiveTotal = pricingType === 'per-session'
    ? sessions * Number(form.pricePerSession)
    : Number(form.packagePrice);

  const valid = form.totalSessions &&
    form.startDate &&
    (pricingType === 'per-session' ? form.pricePerSession : form.packagePrice);

  const handleSave = () => {
    if (!valid) { setShowErrors(true); return; }
    onSave({
      studentId,
      teacherId,
      totalSessions: sessions,
      pricingType,
      pricePerSession: effectivePerSession,
      packagePrice: pricingType === 'per-package' ? Number(form.packagePrice) : undefined,
      startDate: form.startDate,
      notes: form.notes,
    });
  };

  return (
    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4 space-y-3">
      <div className="text-sm font-semibold text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
        <Package size={14} /> {initial ? t('stu.editPkg') : t('stu.addPkg')}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('stu.numSessions')}</label>
          <input type="number" min="0" onKeyDown={e => (e.key === '-' || e.key === 'e') && e.preventDefault()} value={form.totalSessions}
            onChange={e => setForm(f => ({ ...f, totalSessions: e.target.value }))}
            placeholder="8" className={`input w-full ${showErrors && !form.totalSessions ? 'input-error' : ''}`} />
          {showErrors && !form.totalSessions && (
            <p className="text-xs text-red-500 mt-1">{t('stu.numSessionsRequired')}</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('stu.startDate')}</label>
          <input type="date" value={form.startDate}
            onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
            className="input w-full" />
        </div>
      </div>

      {/* Pricing type toggle */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">{t('stu.pricingMethod')}</label>
        <div className="grid grid-cols-2 gap-2">
          {([
            ['per-session', t('stu.perSessionLabel'), t('stu.perSessionDesc')],
            ['per-package', t('stu.perPackageLabel'), t('stu.perPackageDesc')],
          ] as [PackagePricingType, string, string][]).map(([val, label, desc]) => (
            <button key={val} type="button"
              onClick={() => setPricingType(val)}
              className={`py-2.5 px-3 rounded-lg border text-left transition-colors ${
                pricingType === val
                  ? 'bg-purple-100 dark:bg-purple-900/40 border-purple-400 dark:border-purple-500 text-purple-800 dark:text-purple-200'
                  : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}>
              <div className="text-sm font-medium">{label}</div>
              <div className="text-xs opacity-70 mt-0.5">{desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Price input — berubah tergantung pricingType */}
      {pricingType === 'per-session' ? (
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('stu.pricePerSession')}</label>
          <input type="number" min="0" onKeyDown={e => (e.key === '-' || e.key === 'e') && e.preventDefault()} value={form.pricePerSession}
            onChange={e => setForm(f => ({ ...f, pricePerSession: e.target.value }))}
            placeholder="145000" className={`input w-full ${showErrors && !form.pricePerSession ? 'input-error' : ''}`} />
          {showErrors && !form.pricePerSession && (
            <p className="text-xs text-red-500 mt-1">{t('stu.priceRequired')}</p>
          )}
        </div>
      ) : (
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('stu.packageTotal')}</label>
          <input type="number" min="0" onKeyDown={e => (e.key === '-' || e.key === 'e') && e.preventDefault()} value={form.packagePrice}
            onChange={e => setForm(f => ({ ...f, packagePrice: e.target.value }))}
            placeholder="1160000" className={`input w-full ${showErrors && !form.packagePrice ? 'input-error' : ''}`} />
          {showErrors && !form.packagePrice && (
            <p className="text-xs text-red-500 mt-1">{t('stu.packageTotalRequired')}</p>
          )}
        </div>
      )}

      {/* Summary */}
      {valid && sessions > 0 && effectiveTotal > 0 && (
        <div className="bg-purple-100 dark:bg-purple-900/40 rounded-lg px-3 py-2.5 space-y-0.5">
          {pricingType === 'per-session' ? (
            <>
              <div className="text-xs text-purple-700 dark:text-purple-300">
                {t('stu.meetingsTimes', { n: sessions, price: formatCurrency(Number(form.pricePerSession)) })}
              </div>
              <div className="text-sm font-semibold text-purple-900 dark:text-purple-100">
                {t('stu.totalColon', { x: formatCurrency(effectiveTotal) })}
              </div>
            </>
          ) : (
            <>
              <div className="text-xs text-purple-700 dark:text-purple-300">
                {t('stu.divideMeetings', { price: formatCurrency(effectiveTotal), n: sessions })}
              </div>
              <div className="text-sm font-semibold text-purple-900 dark:text-purple-100">
                {t('stu.perMeetingResult', { price: formatCurrency(effectivePerSession) })}
              </div>
            </>
          )}
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('stu.notes')}</label>
        <input type="text" value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder={t('stu.pkgNotesPh')} className="input w-full" />
      </div>

      <div className="flex gap-2">
        <button onClick={handleSave}
          className="flex items-center gap-1.5 bg-purple-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-purple-700">
          <Check size={14} /> {t('common.save')}
        </button>
        <button onClick={onCancel}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600">
          <X size={14} /> {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}

// ─── Package Card ─────────────────────────────────────────────────────────────

function PackageCard({
  status,
  allStudentPackages,
  attributedSessions,
  teacherColor,
  onEdit,
  onDelete,
}: {
  status: ReturnType<typeof getPackageStatus>;
  allStudentPackages: SessionPackage[];
  attributedSessions?: LessonSession[];
  teacherColor: string;
  onEdit: (updates: Omit<SessionPackage, 'id' | 'createdAt'>) => void;
  onDelete: () => void;
}) {
  const { t, locale } = useLang();
  const { pkg, usedSessions, scheduledSessions, remainingSessions, estimatedEndDate, isExpired, isExpiringSoon, isCurrent } = status;
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <PackageForm
        studentId={pkg.studentId}
        teacherId={pkg.teacherId}
        defaultRate={pkg.pricePerSession}
        existingPackages={allStudentPackages}
        initial={pkg}
        onSave={data => { onEdit(data); setEditing(false); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${
      isCurrent
        ? isExpired ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20' : isExpiringSoon ? 'border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20' : 'border-purple-200 dark:border-purple-700 bg-white dark:bg-gray-800'
        : 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {t('stu.pkgStart', { date: formatDate(pkg.startDate, 'd MMM yyyy', locale) })}
            </span>
            {isCurrent && !isExpired && (
              <span className="text-xs bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded-full font-medium">{t('stu.active')}</span>
            )}
            {isExpired && isCurrent && (
              <span className="text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded-full font-medium">{t('status.completed')}</span>
            )}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {t('stu.meetings', { n: pkg.totalSessions })}
            {pkg.pricingType === 'per-package'
              ? <> · <span className="font-medium">{formatCurrency(pkg.packagePrice ?? pkg.pricePerSession * pkg.totalSessions)}</span> {t('stu.perPackageUnit')} <span className="text-gray-400">({formatCurrency(pkg.pricePerSession)}{t('stu.perMeetingUnit')})</span></>
              : <> · {formatCurrency(pkg.pricePerSession)}{t('stu.perMeetingUnit')} · {t('stu.totalWord')} {formatCurrency(pkg.pricePerSession * pkg.totalSessions)}</>
            }
          </div>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button onClick={() => setEditing(true)}
            className="p-1 text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg">
            <Pencil size={13} />
          </button>
          <button onClick={onDelete}
            className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="flex items-center gap-2 flex-wrap">
            <span className={`flex items-center gap-1 ${isExpired ? 'text-green-700 font-medium' : 'text-gray-500'}`}>
              <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{
                background: isExpired ? '#10b981' : isExpiringSoon ? '#f59e0b' : teacherColor,
              }} />
              {t('stu.doneN', { n: usedSessions })}
            </span>
            {scheduledSessions > 0 && (
              <span className="flex items-center gap-1 text-blue-500">
                <span className="w-2 h-2 rounded-sm flex-shrink-0 bg-blue-400" />
                {t('stu.scheduledN', { n: scheduledSessions })}
              </span>
            )}
            <span className="text-gray-400">/ {pkg.totalSessions}</span>
          </span>
          <span className={`font-medium ${isExpired ? 'text-green-700' : isExpiringSoon ? 'text-amber-600' : remainingSessions === 0 ? 'text-gray-500' : 'text-gray-700'}`}>
            {isExpired ? t('status.completed') : remainingSessions === 0 ? t('stu.full') : t('stu.remainingN', { n: remainingSessions })}
          </span>
        </div>
        <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex">
          <div className="h-full transition-all" style={{
            width: `${(usedSessions / pkg.totalSessions) * 100}%`,
            background: isExpired ? '#10b981' : isExpiringSoon ? '#f59e0b' : teacherColor,
          }} />
          {scheduledSessions > 0 && (
            <div className="h-full bg-blue-400 transition-all" style={{
              width: `${(scheduledSessions / pkg.totalSessions) * 100}%`,
            }} />
          )}
        </div>
      </div>

      {estimatedEndDate && !isExpired && isCurrent && (
        <div className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
          <Clock size={11} /> {t('stu.estEnd', { date: formatDate(estimatedEndDate, 'd MMM yyyy', locale) })}
        </div>
      )}

      {pkg.notes && (
        <div className="text-xs text-gray-400 dark:text-gray-500 italic">{pkg.notes}</div>
      )}

      {attributedSessions !== undefined && (
        <div className="pt-1 border-t border-gray-100 dark:border-gray-700 space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
              <CalendarDays size={11} /> {t('stu.lessonDates', { n: attributedSessions.length })}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
              <span className="flex items-center gap-1">
                <span className="px-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 text-[10px]">{t('stu.dateAbbr')}</span> {t('stu.legendDone')}
              </span>
              <span className="flex items-center gap-1">
                <span className="px-1 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-400 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[10px]">{t('stu.dateAbbr')}</span> {t('stu.legendScheduled')}
              </span>
            </div>
          </div>
          <SessionDateChips sessions={attributedSessions} />
        </div>
      )}
    </div>
  );
}

// ─── Payment Panel (murid dibayar lembaga) ─────────────────────────────────────

function PaymentPanel({ student, billedAmount }: { student: Student; billedAmount: number }) {
  const { data, addPayment, deletePayment } = useApp();
  const { t, locale } = useLang();
  const confirm = useConfirm();
  const today = new Date().toISOString().slice(0, 10);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ date: today, amount: billedAmount ? String(billedAmount) : '', note: '' });

  const payments = data.payments
    .filter(p => p.studentId === student.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const received = payments.reduce((s, p) => s + p.amount, 0);
  const outstanding = billedAmount - received;

  const save = () => {
    const amt = Number(form.amount);
    if (!form.date || !(amt > 0)) return;
    addPayment({ studentId: student.id, date: form.date, amount: amt, note: form.note.trim() || undefined });
    setForm({ date: today, amount: billedAmount ? String(billedAmount) : '', note: '' });
    setAdding(false);
  };
  const remove = async (id: string) => { if (await confirm({ message: t('pay.deleteConfirm'), danger: true })) deletePayment(id); };

  return (
    <div className="border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 space-y-3 bg-emerald-50/50 dark:bg-emerald-900/15">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide flex items-center gap-1.5">
          <Wallet size={13} /> {t('pay.section')}
        </span>
        {!adding && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300 hover:underline font-medium">
            <Plus size={13} /> {t('pay.record')}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 dark:text-gray-400">
        <span>{t('pay.received')}: <span className="font-semibold text-emerald-700 dark:text-emerald-300">{formatCurrency(received)}</span></span>
        {billedAmount > 0 && (
          <>
            <span className="text-gray-400">·</span>
            <span>{t('pay.billed')}: <span className="font-medium text-gray-700 dark:text-gray-300">{formatCurrency(billedAmount)}</span></span>
            {outstanding > 0 && (
              <>
                <span className="text-gray-400">·</span>
                <span>{t('pay.outstanding')}: <span className="font-medium text-amber-600 dark:text-amber-400">{formatCurrency(outstanding)}</span></span>
              </>
            )}
          </>
        )}
      </div>

      {adding && (
        <div className="space-y-2 bg-white dark:bg-gray-800 rounded-lg p-3 border border-emerald-200 dark:border-emerald-800">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('common.date')}</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('pay.amount')}</label>
              <input type="number" min="0" onKeyDown={e => (e.key === '-' || e.key === 'e') && e.preventDefault()} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="input w-full" />
            </div>
          </div>
          <input type="text" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder={t('pay.notePh')} className="input w-full" />
          <div className="flex gap-2">
            <button onClick={save} className="flex items-center gap-1.5 bg-emerald-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-emerald-700"><Check size={14} /> {t('common.save')}</button>
            <button onClick={() => setAdding(false)} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"><X size={14} /> {t('common.cancel')}</button>
          </div>
        </div>
      )}

      {payments.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500">{t('pay.none')}</p>
      ) : (
        <div className="divide-y divide-emerald-100 dark:divide-emerald-800/50">
          {payments.map(p => (
            <div key={p.id} className="flex items-center gap-2 py-2 text-sm">
              <span className="text-xs text-gray-500 dark:text-gray-400 w-20 flex-shrink-0 tabular-nums">{formatDate(p.date, 'd MMM yy', locale)}</span>
              <span className="flex-1 min-w-0 truncate text-xs italic text-gray-500 dark:text-gray-400">{p.note ?? ''}</span>
              <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">{formatCurrency(p.amount)}</span>
              <button onClick={() => remove(p.id)} className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 flex-shrink-0"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Student Card ─────────────────────────────────────────────────────────────

function StudentCard({ student, dimmed, highlight }: { student: Student; dimmed?: boolean; highlight?: boolean }) {
  const { data, updateStudent, deactivateStudent, deleteStudent, addPackage, updatePackage, deletePackage } = useApp();
  const { t, locale, lang } = useLang();
  const confirm = useConfirm();
  const [expanded, setExpanded] = useState(highlight ?? false);
  const [editing, setEditing] = useState(false);
  const [addingPackage, setAddingPackage] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlight && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlight]);

  const teacher = data.teachers.find(t => t.id === student.teacherId);
  const studentPkgs = data.packages
    .filter(p => p.studentId === student.id)
    .sort((a, b) => b.startDate.localeCompare(a.startDate)); // newest first

  const studentSessions = data.sessions.filter(
    s => s.studentId === student.id && s.status === 'completed'
  );
  const studentActiveSessions = data.sessions.filter(
    s => s.studentId === student.id
  );

  const currentPkg = studentPkgs[0];
  const currentStatus = currentPkg
    ? getPackageStatus(currentPkg, studentPkgs, data.sessions)
    : null;

  const isPostpaid = student.billingType === 'per-session';

  const handleSave = (updates: Omit<Student, 'id' | 'createdAt' | 'isActive'>) => {
    updateStudent(student.id, updates);
    setEditing(false);
  };

  const handleDelete = async () => {
    const msg = t('stu.deleteConfirm', { name: student.name });
    if (await confirm({ message: msg, danger: true })) deleteStudent(student.id);
  };

  const handleReactivate = () => {
    updateStudent(student.id, { isActive: true });
  };
  const handleDeactivate = async () => {
    const upcoming = data.sessions.filter(s => s.studentId === student.id && s.status === 'scheduled').length;
    const msg = upcoming > 0
      ? t('stu.deactivateConfirm', { name: student.name, n: upcoming })
      : t('stu.deactivateConfirmNoSessions', { name: student.name });
    if (await confirm({ message: msg, danger: true })) deactivateStudent(student.id);
  };

  const handleEditPkg = (pkgId: string, updates: Omit<SessionPackage, 'id' | 'createdAt'>) => {
    updatePackage(pkgId, updates);
  };

  const handleDeletePkg = async (pkgId: string) => {
    const pkg = studentPkgs.find(p => p.id === pkgId);
    const msg = pkg
      ? t('stu.deletePkgConfirmDetail', {
          n: pkg.totalSessions,
          price: formatCurrency(pkg.packagePrice ?? pkg.pricePerSession * pkg.totalSessions),
          name: student.name,
        })
      : t('stu.deletePkgConfirm');
    if (await confirm({ message: msg, danger: true })) deletePackage(pkgId);
  };

  if (editing) {
    return (
      <StudentForm
        initial={student}
        teachers={data.teachers}
        onSave={handleSave}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div ref={cardRef} className={`bg-white dark:bg-gray-800 rounded-xl overflow-hidden scroll-mt-4 ${highlight ? 'border-2 border-indigo-400 dark:border-indigo-500' : 'border border-gray-200 dark:border-gray-700'} ${dimmed ? 'opacity-50' : ''}`}>
      {/* Header row */}
      <div className="flex items-center gap-3 p-4">
        <div className="w-1.5 self-stretch rounded-full flex-shrink-0"
          style={{ background: teacher?.color ?? '#9ca3af' }} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900 dark:text-white">{student.name}</span>
            {!student.isActive ? (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                {t('stu.inactive')}
              </span>
            ) : (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                isPostpaid
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
              }`}>
                {isPostpaid ? t('stu.postpaid') : t('stu.prepaid')}
              </span>
            )}
            {student.isActive && student.deferredPayment && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                {t('pay.badge')}
              </span>
            )}
            {/* Alert untuk paket aktif — hanya saat masih aktif */}
            {student.isActive && currentStatus?.isCurrent && currentStatus?.isExpiringSoon && (
              <span className="flex items-center gap-0.5 text-xs text-amber-600 font-medium">
                <AlertTriangle size={11} /> {t('stu.pkgAlmostOut')}
              </span>
            )}
            {student.isActive && currentStatus?.isCurrent && currentStatus?.isExpired && (
              <span className="flex items-center gap-0.5 text-xs text-green-600">
                {t('stu.pkgFinished')}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-2">
            <span style={{ color: teacher?.color }}>{teacher?.name}</span>
            {student.group !== 'xuyuan' && (
              <>
                <span>·</span>
                <span>{formatCurrency(student.ratePerSession)}{t('stu.perSesi')}</span>
              </>
            )}
            {isPostpaid && student.pendingRate != null && student.pendingRateEffectiveDate && (
              <span className="flex items-center gap-1 text-blue-500">
                <CalendarClock size={11} />
                {t('stu.pendingBadge', { price: formatCurrency(student.pendingRate), date: formatDate(student.pendingRateEffectiveDate, 'd MMM', locale) })}
              </span>
            )}
            {!isPostpaid && currentStatus && !currentStatus.isExpired && (
              <>
                <span>·</span>
                <span className="text-gray-500">
                  {t('stu.usedTotal', { used: currentStatus.usedSessions, total: currentStatus.pkg.totalSessions })}
                </span>
              </>
            )}
          </div>
          {student.notes && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic flex items-start gap-1">
              <StickyNote size={11} className="mt-0.5 flex-shrink-0 text-gray-400" />
              <span className="min-w-0 break-words">{student.notes}</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-1">
          {student.isActive ? (
            <button onClick={() => setEditing(true)}
              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
              <Pencil size={14} />
            </button>
          ) : (
            <button
              onClick={handleReactivate}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors font-medium"
            >
              <RotateCcw size={12} /> {t('stu.activate')}
            </button>
          )}
          <button onClick={handleDelete}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 size={14} />
          </button>
          {student.isActive && (
            <button onClick={() => setExpanded(e => !e)}
              className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors ml-1">
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
        </div>
      </div>

      {/* Expanded section — isi berbeda per group */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-3 bg-gray-50/50 dark:bg-gray-700/20">

          {student.deferredPayment && (
            <PaymentPanel
              student={student}
              billedAmount={currentPkg ? (currentPkg.packagePrice ?? currentPkg.pricePerSession * currentPkg.totalSessions) : 0}
            />
          )}

          {/* ── Prepaid (paket): riwayat paket — semua group kecuali xuyuan ── */}
          {student.billingType === 'package' && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('stu.pkgHistory')}</span>
                <button onClick={() => setAddingPackage(true)}
                  className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 font-medium">
                  <Plus size={13} /> {t('stu.addPkgLink')}
                </button>
              </div>
              {addingPackage && (
                <PackageForm
                  studentId={student.id}
                  teacherId={student.teacherId}
                  defaultRate={student.ratePerSession}
                  existingPackages={studentPkgs}
                  onSave={pkg => { addPackage(pkg); setAddingPackage(false); }}
                  onCancel={() => setAddingPackage(false)}
                />
              )}
              {studentPkgs.length === 0 && !addingPackage && (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">{t('stu.noPkg')}</p>
              )}
              {studentPkgs.map(pkg => (
                <PackageCard
                  key={pkg.id}
                  status={getPackageStatus(pkg, studentPkgs, data.sessions)}
                  allStudentPackages={studentPkgs}
                  attributedSessions={getPackageAttributedSessions(pkg, studentPkgs, studentActiveSessions)}
                  teacherColor={teacher?.color ?? '#6366f1'}
                  onEdit={updates => handleEditPkg(pkg.id, updates)}
                  onDelete={() => handleDeletePkg(pkg.id)}
                />
              ))}
            </>
          )}

          {/* ── Pribadi: riwayat sesi dikelompokkan per bulan ── */}
          {student.group === 'pribadi' && (
            <>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                <CalendarDays size={13} /> {t('stu.lessonHistory')}
              </span>
              {studentSessions.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">{t('stu.noSessionsRecorded')}</p>
              ) : (
                groupByMonth(studentSessions, locale).map(({ key, label, sessions }) => (
                  <div key={key}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-semibold text-gray-600 capitalize">{label}</span>
                      <span className="text-xs text-gray-400">({t('common.sessions_n', { n: sessions.length })})</span>
                    </div>
                    <SessionDateChips sessions={sessions} />
                  </div>
                ))
              )}
            </>
          )}

          {/* ── XuYuan: riwayat sesi dikelompokkan per siklus 26-25 ── */}
          {student.group === 'xuyuan' && (
            <>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                <CalendarDays size={13} /> {t('stu.lessonHistory')}
              </span>
              {studentSessions.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">{t('stu.noSessionsRecorded')}</p>
              ) : (
                groupByXuYuanCycle(studentSessions, locale).map(({ key, label, sessions }) => (
                  <div key={key} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-600">{label}</span>
                      <span className="text-xs text-gray-400 tabular-nums">
                        {t('hours.sessionsDur', { n: sessions.length, dur: totalDurationLabel(sessions, lang) })}
                      </span>
                    </div>
                    <SessionDateChips sessions={sessions} />
                  </div>
                ))
              )}
            </>
          )}

          {/* Tombol non-aktifkan — hanya untuk murid aktif */}
          {student.isActive && (
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={handleDeactivate}
                className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 px-2 py-1.5 rounded-lg transition-colors"
              >
                <PowerOff size={13} /> {t('stu.deactivateThis')}
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Students() {
  const { data, addStudent, addPackage } = useApp();
  const { t } = useLang();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('student') ?? null;
  const [showForm, setShowForm] = useState(false);
  const [filterTeacher, setFilterTeacher] = useState('all');

  const handleAdd = (studentData: Omit<Student, 'id' | 'createdAt' | 'isActive'>, initialPackage?: Omit<SessionPackage, 'id' | 'createdAt' | 'studentId' | 'teacherId'>) => {
    const student = addStudent(studentData);
    if (initialPackage) {
      addPackage({ ...initialPackage, studentId: student.id, teacherId: student.teacherId });
    }
    setShowForm(false);
  };

  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const byTeacher = filterTeacher === 'all'
    ? data.students
    : data.students.filter(s => s.teacherId === filterTeacher);

  const matchesSearch = (name: string) =>
    !searchQuery.trim() || name.toLowerCase().includes(searchQuery.toLowerCase());

  const filteredStudents = byTeacher
    .filter(s => s.isActive && matchesSearch(s.name))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'id'));

  const inactiveStudents = byTeacher
    .filter(s => !s.isActive && matchesSearch(s.name))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'id'));

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('stu.title')}</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{t('stu.activeCount', { n: filteredStudents.length })}</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-indigo-700">
          <Plus size={16} /> {t('stu.addStudent')}
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={t('stu.searchPh')}
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Filter laoshi */}
      {data.teachers.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilterTeacher('all')}
            className={`text-sm px-3 py-1.5 rounded-lg border ${filterTeacher === 'all' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'}`}>
            {t('stu.all')}
          </button>
          {data.teachers.map(t => (
            <button key={t.id} onClick={() => setFilterTeacher(t.id)}
              className={`text-sm px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${filterTeacher === t.id ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'}`}>
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.color }} />
              {t.name}
            </button>
          ))}
        </div>
      )}

      {/* Form tambah murid */}
      {showForm && (
        <StudentForm
          teachers={data.teachers}
          onSave={handleAdd}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* List */}
      {filteredStudents.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center text-gray-400 dark:text-gray-500">
          <p className="text-sm">
            {data.teachers.length === 0
              ? t('stu.needLaoshi')
              : t('stu.noActive')}
          </p>
        </div>
      ) : (
        <>
          {STUDENT_GROUPS.map(({ value, label }) => {
            const group = filteredStudents.filter(s => s.group === value);
            if (group.length === 0) return null;
            const hasPrepaid = group.some(s => s.billingType === 'package');
            const colors: Record<string, string> = {
              pribadi:           'text-blue-500 bg-blue-100',
              wenwen_aizhongwen: 'text-purple-500 bg-purple-100',
              xuyuan:            'text-emerald-500 bg-emerald-100',
            };
            const dividers: Record<string, string> = {
              pribadi:           'bg-blue-100',
              wenwen_aizhongwen: 'bg-purple-100',
              xuyuan:            'bg-emerald-100',
            };
            return (
              <section key={value} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${colors[value]}`}>
                    {label}
                  </span>
                  <div className={`flex-1 h-px ${dividers[value]}`} />
                  <span className="text-xs text-gray-400">{t('stu.studentCount', { n: group.length })}</span>
                </div>
                {hasPrepaid && (
                  <p className="text-xs text-gray-400 pl-1">{t('stu.clickManage')}</p>
                )}
                {group.map(s => <StudentCard key={s.id} student={s} highlight={s.id === highlightId} />)}
              </section>
            );
          })}
        </>
      )}

      {/* Murid non-aktif */}
      {inactiveStudents.length > 0 && (
        <div className="pt-2 space-y-2">
          <button
            onClick={() => setShowInactive(v => !v)}
            className="w-full flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors py-1"
          >
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
            <span className="whitespace-nowrap">
              {showInactive ? t('stu.hideInactive') : t('stu.inactiveCount', { n: inactiveStudents.length })}
            </span>
            {showInactive ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          </button>
          {showInactive && inactiveStudents.map(s => <StudentCard key={s.id} student={s} dimmed highlight={s.id === highlightId} />)}
        </div>
      )}
    </div>
  );
}
