import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { AppData, Teacher, Student, SessionPackage, LessonSession, Worksheet, Payment, BillingType, StudentGroup, PackagePricingType } from '../types';
import { generateId, effectiveRate, effectiveHonor, formatCurrency } from '../utils/helpers';
import { supabase } from '../lib/supabase';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

const fmtLogDate = (d: string) => format(parseISO(d), 'd MMM', { locale: localeId });

const defaultData: AppData = { teachers: [], students: [], packages: [], sessions: [], worksheets: [], payments: [] };

// ─── DB row types (snake_case) ────────────────────────────────────────────────
interface DbTeacher  { id: string; name: string; color: string; honor_per_session: number; pending_honor?: number | null; pending_honor_effective_date?: string | null; is_owner: boolean; is_active?: boolean | null; created_at: string; }
interface DbStudent  { id: string; teacher_id: string; name: string; billing_type: string; rate_per_session: number; pending_rate?: number | null; pending_rate_effective_date?: string | null; deferred_payment?: boolean | null; group: string; xu_yuan_type?: string; phone?: string | null; notes?: string; is_active: boolean; created_at: string; }
interface DbPackage  { id: string; student_id: string; teacher_id: string; total_sessions: number; pricing_type: string; price_per_session: number; package_price?: number; start_date: string; notes?: string; created_at: string; }
interface DbSession   { id: string; student_id: string; teacher_id: string; date: string; start_time: string; end_time: string; status: string; notes?: string; worksheet_pages?: number; rate_snapshot?: number | null; honor_snapshot?: number | null; created_at: string; }
interface DbWorksheet { id: string; student_id: string; date: string; pages: number; created_at: string; }
interface DbPayment   { id: string; student_id: string; date: string; amount: number; note?: string | null; created_at: string; }

// ─── Mappers DB → App ─────────────────────────────────────────────────────────
const mapTeacher  = (r: DbTeacher):  Teacher        => ({ id: r.id, name: r.name, color: r.color, honorPerSession: r.honor_per_session ?? 100000, pendingHonor: r.pending_honor ?? undefined, pendingHonorEffectiveDate: r.pending_honor_effective_date ?? undefined, isOwner: r.is_owner ?? false, isActive: r.is_active ?? true, createdAt: r.created_at });
const mapStudent  = (r: DbStudent):  Student        => ({ id: r.id, teacherId: r.teacher_id, name: r.name, billingType: r.billing_type as BillingType, ratePerSession: r.rate_per_session, pendingRate: r.pending_rate ?? undefined, pendingRateEffectiveDate: r.pending_rate_effective_date ?? undefined, deferredPayment: r.deferred_payment ?? false, group: r.group as StudentGroup, xuYuanType: (r.xu_yuan_type ?? 'private') as 'private' | 'semi-group', phone: r.phone ?? undefined, notes: r.notes, isActive: r.is_active ?? true, createdAt: r.created_at });
const mapPackage  = (r: DbPackage):  SessionPackage => ({ id: r.id, studentId: r.student_id, teacherId: r.teacher_id, totalSessions: r.total_sessions, pricingType: r.pricing_type as PackagePricingType, pricePerSession: r.price_per_session, packagePrice: r.package_price, startDate: r.start_date, notes: r.notes, createdAt: r.created_at });
const mapSession  = (r: DbSession):  LessonSession  => ({ id: r.id, studentId: r.student_id, teacherId: r.teacher_id, date: r.date, startTime: r.start_time, endTime: r.end_time, status: r.status as LessonSession['status'], notes: r.notes, worksheetPages: r.worksheet_pages ?? 0, rateSnapshot: r.rate_snapshot ?? undefined, honorSnapshot: r.honor_snapshot ?? undefined, createdAt: r.created_at });

// ─── Mappers App → DB ─────────────────────────────────────────────────────────
const toDbTeacher = (t: Teacher)        => ({ id: t.id, name: t.name, color: t.color, honor_per_session: t.honorPerSession, pending_honor: t.pendingHonor ?? null, pending_honor_effective_date: t.pendingHonorEffectiveDate ?? null, is_owner: t.isOwner, is_active: t.isActive, created_at: t.createdAt });
const toDbStudent = (s: Student)        => ({ id: s.id, teacher_id: s.teacherId, name: s.name, billing_type: s.billingType, rate_per_session: s.ratePerSession, pending_rate: s.pendingRate ?? null, pending_rate_effective_date: s.pendingRateEffectiveDate ?? null, deferred_payment: s.deferredPayment ?? false, group: s.group, xu_yuan_type: s.xuYuanType ?? 'private', phone: s.phone ?? null, notes: s.notes ?? null, is_active: s.isActive, created_at: s.createdAt });
const toDbPackage = (p: SessionPackage) => ({ id: p.id, student_id: p.studentId, teacher_id: p.teacherId, total_sessions: p.totalSessions, pricing_type: p.pricingType, price_per_session: p.pricePerSession, package_price: p.packagePrice ?? null, start_date: p.startDate, notes: p.notes ?? null, created_at: p.createdAt });
const toDbSession = (s: LessonSession)  => ({ id: s.id, student_id: s.studentId, teacher_id: s.teacherId, date: s.date, start_time: s.startTime, end_time: s.endTime, status: s.status, notes: s.notes ?? null, worksheet_pages: s.worksheetPages ?? 0, rate_snapshot: s.rateSnapshot ?? null, honor_snapshot: s.honorSnapshot ?? null, created_at: s.createdAt });
const mapWorksheet  = (r: DbWorksheet): Worksheet => ({ id: r.id, studentId: r.student_id, date: r.date, pages: r.pages, createdAt: r.created_at });
const toDbWorksheet = (w: Worksheet) => ({ id: w.id, student_id: w.studentId, date: w.date, pages: w.pages, created_at: w.createdAt });
const mapPayment  = (r: DbPayment): Payment => ({ id: r.id, studentId: r.student_id, date: r.date, amount: r.amount, note: r.note ?? undefined, createdAt: r.created_at });
const toDbPayment = (p: Payment) => ({ id: p.id, student_id: p.studentId, date: p.date, amount: p.amount, note: p.note ?? null, created_at: p.createdAt });

// ─── Context type ─────────────────────────────────────────────────────────────
interface AppContextType {
  data: AppData;
  loading: boolean;
  addTeacher:    (name: string, color: string) => Teacher;
  updateTeacher: (id: string, updates: Partial<Teacher>) => void;
  deactivateTeacher: (id: string) => void;
  deleteTeacher: (id: string) => void;
  addStudent:    (student: Omit<Student, 'id' | 'createdAt' | 'isActive'>) => Student;
  updateStudent: (id: string, updates: Partial<Student>) => void;
  deactivateStudent: (id: string) => void;
  deleteStudent: (id: string) => void;
  addPackage:    (pkg: Omit<SessionPackage, 'id' | 'createdAt'>) => SessionPackage;
  updatePackage: (id: string, updates: Partial<SessionPackage>) => void;
  deletePackage: (id: string) => void;
  addSession:    (session: Omit<LessonSession, 'id' | 'createdAt'>) => LessonSession;
  updateSession: (id: string, updates: Partial<LessonSession>) => void;
  deleteSession: (id: string) => void;
  addWorksheet:    (w: Omit<Worksheet, 'id' | 'createdAt'>) => Worksheet;
  updateWorksheet: (id: string, updates: Partial<Worksheet>) => void;
  deleteWorksheet: (id: string) => void;
  addPayment:    (p: Omit<Payment, 'id' | 'createdAt'>) => Payment;
  deletePayment: (id: string) => void;
}

// Force lazy Supabase query to execute and log any error
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(query: PromiseLike<{ error: any }>) {
  query.then(({ error }) => { if (error) console.error('Supabase error:', error); });
}

function logActivity(action: 'create' | 'reschedule' | 'delete' | 'update', description: string) {
  db(supabase.from('activity_log').insert({ id: generateId(), action, description, created_at: new Date().toISOString() }));
}

const BACKUP_KEY = 'jadwal-les-last-backup';

async function autoBackup(data: AppData): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem(BACKUP_KEY) === today) return;
  try {
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const { error } = await supabase.storage
      .from('backups')
      .upload(`backup_${today}.json`, blob);
    if (!error) localStorage.setItem(BACKUP_KEY, today);
  } catch { /* best-effort, silently ignore */ }
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(defaultData);
  const [loading, setLoading] = useState(true);

  // ─── Initial load + real-time subscriptions ──────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      const [t, s, p, se, ws, pay] = await Promise.all([
        supabase.from('teachers').select('*').order('created_at'),
        supabase.from('students').select('*').order('created_at'),
        supabase.from('packages').select('*').order('created_at'),
        supabase.from('sessions').select('*').order('created_at'),
        supabase.from('worksheets').select('*').order('created_at'),
        supabase.from('payments').select('*').order('created_at'),
      ]);
      if (cancelled) return;
      const loaded: AppData = {
        teachers: (t.data ?? []).map(mapTeacher),
        students: (s.data ?? []).map(mapStudent),
        packages: (p.data ?? []).map(mapPackage),
        sessions: (se.data ?? []).map(mapSession),
        worksheets: (ws.data ?? []).map(mapWorksheet),
        payments: (pay.data ?? []).map(mapPayment),
      };
      setData(loaded);
      setLoading(false);
      autoBackup(loaded);
    }

    loadAll();

    const channel = supabase.channel('db-changes')
      // teachers
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'teachers' },
        ({ new: r }) => setData(d => ({ ...d, teachers: [...d.teachers.filter(t => t.id !== (r as DbTeacher).id), mapTeacher(r as DbTeacher)] })))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'teachers' },
        ({ new: r }) => setData(d => ({ ...d, teachers: d.teachers.map(t => t.id === (r as DbTeacher).id ? mapTeacher(r as DbTeacher) : t) })))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'teachers' },
        ({ old: r }) => setData(d => ({ ...d, teachers: d.teachers.filter(t => t.id !== (r as DbTeacher).id) })))
      // students
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'students' },
        ({ new: r }) => setData(d => ({ ...d, students: [...d.students.filter(s => s.id !== (r as DbStudent).id), mapStudent(r as DbStudent)] })))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'students' },
        ({ new: r }) => setData(d => ({ ...d, students: d.students.map(s => s.id === (r as DbStudent).id ? mapStudent(r as DbStudent) : s) })))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'students' },
        ({ old: r }) => setData(d => ({ ...d, students: d.students.filter(s => s.id !== (r as DbStudent).id) })))
      // packages
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'packages' },
        ({ new: r }) => setData(d => ({ ...d, packages: [...d.packages.filter(p => p.id !== (r as DbPackage).id), mapPackage(r as DbPackage)] })))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'packages' },
        ({ new: r }) => setData(d => ({ ...d, packages: d.packages.map(p => p.id === (r as DbPackage).id ? mapPackage(r as DbPackage) : p) })))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'packages' },
        ({ old: r }) => setData(d => ({ ...d, packages: d.packages.filter(p => p.id !== (r as DbPackage).id) })))
      // sessions
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sessions' },
        ({ new: r }) => setData(d => ({ ...d, sessions: [...d.sessions.filter(s => s.id !== (r as DbSession).id), mapSession(r as DbSession)] })))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions' },
        ({ new: r }) => setData(d => ({ ...d, sessions: d.sessions.map(s => s.id === (r as DbSession).id ? mapSession(r as DbSession) : s) })))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'sessions' },
        ({ old: r }) => setData(d => ({ ...d, sessions: d.sessions.filter(s => s.id !== (r as DbSession).id) })))
      // worksheets
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'worksheets' },
        ({ new: r }) => setData(d => ({ ...d, worksheets: [...d.worksheets.filter(w => w.id !== (r as DbWorksheet).id), mapWorksheet(r as DbWorksheet)] })))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'worksheets' },
        ({ new: r }) => setData(d => ({ ...d, worksheets: d.worksheets.map(w => w.id === (r as DbWorksheet).id ? mapWorksheet(r as DbWorksheet) : w) })))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'worksheets' },
        ({ old: r }) => setData(d => ({ ...d, worksheets: d.worksheets.filter(w => w.id !== (r as DbWorksheet).id) })))
      // payments
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'payments' },
        ({ new: r }) => setData(d => ({ ...d, payments: [...d.payments.filter(p => p.id !== (r as DbPayment).id), mapPayment(r as DbPayment)] })))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'payments' },
        ({ old: r }) => setData(d => ({ ...d, payments: d.payments.filter(p => p.id !== (r as DbPayment).id) })))
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  // ─── Auto-complete past sessions ─────────────────────────────────────────
  useEffect(() => {
    if (loading) return; // wait until data is loaded before checking

    const markCompleted = () => {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const nowTime  = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      setData(d => {
        const toComplete = d.sessions.filter(s =>
          s.status === 'scheduled' &&
          (s.date < todayStr || (s.date === todayStr && s.endTime <= nowTime))
        );
        if (!toComplete.length) return d;

        // Push updates to Supabase (freeze rate/honor snapshot at completion)
        toComplete.forEach(s => {
          const student = d.students.find(st => st.id === s.studentId);
          const teacher = d.teachers.find(te => te.id === s.teacherId);
          const rateSnap  = (student?.billingType === 'per-session' && s.rateSnapshot == null) ? effectiveRate(student, s.date) : undefined;
          const honorSnap = (teacher && s.honorSnapshot == null) ? effectiveHonor(teacher, s.date) : undefined;
          supabase.from('sessions')
            .update({ status: 'completed', ...(rateSnap != null ? { rate_snapshot: rateSnap } : {}), ...(honorSnap != null ? { honor_snapshot: honorSnap } : {}) })
            .eq('id', s.id)
            .then(({ error }) => { if (error) console.error('Auto-complete error:', error); });
        });

        return {
          ...d,
          sessions: d.sessions.map(s => {
            const match = toComplete.find(c => c.id === s.id);
            if (!match) return s;
            const student = d.students.find(st => st.id === s.studentId);
            const teacher = d.teachers.find(te => te.id === s.teacherId);
            const rateSnap = (student?.billingType === 'per-session' && s.rateSnapshot == null) ? effectiveRate(student, s.date) : s.rateSnapshot;
            const honorSnap = (teacher && s.honorSnapshot == null) ? effectiveHonor(teacher, s.date) : s.honorSnapshot;
            return { ...s, status: 'completed' as const, rateSnapshot: rateSnap, honorSnapshot: honorSnap };
          }),
        };
      });
    };

    const msUntilNext30 = () => {
      const now = new Date();
      const min = now.getMinutes();
      const sec = now.getSeconds();
      const ms  = now.getMilliseconds();
      const minLeft = min < 30 ? 30 - min : 60 - min;
      return (minLeft * 60 - sec) * 1000 - ms;
    };

    markCompleted();
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const timeoutId = setTimeout(() => {
      markCompleted();
      intervalId = setInterval(markCompleted, 30 * 60_000);
    }, msUntilNext30());

    return () => {
      clearTimeout(timeoutId);
      if (intervalId !== undefined) clearInterval(intervalId);
    };
  }, [loading]);

  // ─── Promote pending rate once its effective date has arrived ────────────
  useEffect(() => {
    if (loading) return;
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    setData(d => {
      const due = d.students.filter(s =>
        s.pendingRate != null &&
        s.pendingRateEffectiveDate != null &&
        s.pendingRateEffectiveDate <= todayStr
      );
      if (!due.length) return d;

      due.forEach(s => {
        supabase.from('students')
          .update({ rate_per_session: s.pendingRate, pending_rate: null, pending_rate_effective_date: null })
          .eq('id', s.id)
          .then(({ error }) => { if (error) console.error('Promote rate error:', error); });
      });

      return {
        ...d,
        students: d.students.map(s =>
          due.some(x => x.id === s.id)
            ? { ...s, ratePerSession: s.pendingRate!, pendingRate: undefined, pendingRateEffectiveDate: undefined }
            : s
        ),
      };
    });

    // Promote pending honor for teachers whose effective date has arrived
    setData(d => {
      const due = d.teachers.filter(te =>
        te.pendingHonor != null &&
        te.pendingHonorEffectiveDate != null &&
        te.pendingHonorEffectiveDate <= todayStr
      );
      if (!due.length) return d;
      due.forEach(te => {
        supabase.from('teachers')
          .update({ honor_per_session: te.pendingHonor, pending_honor: null, pending_honor_effective_date: null })
          .eq('id', te.id)
          .then(({ error }) => { if (error) console.error('Promote honor error:', error); });
      });
      return {
        ...d,
        teachers: d.teachers.map(te =>
          due.some(x => x.id === te.id)
            ? { ...te, honorPerSession: te.pendingHonor!, pendingHonor: undefined, pendingHonorEffectiveDate: undefined }
            : te
        ),
      };
    });
  }, [loading]);

  // ─── Teachers ─────────────────────────────────────────────────────────────
  const addTeacher = (name: string, color: string): Teacher => {
    const teacher: Teacher = { id: generateId(), name, color, honorPerSession: 100000, isOwner: false, isActive: true, createdAt: new Date().toISOString() };
    setData(d => ({ ...d, teachers: [...d.teachers, teacher] }));
    db(supabase.from('teachers').insert(toDbTeacher(teacher)));
    logActivity('create', `Tambah laoshi — ${name}`);
    return teacher;
  };
  const updateTeacher = (id: string, updates: Partial<Teacher>) => {
    const old = data.teachers.find(t => t.id === id);
    setData(d => ({ ...d, teachers: d.teachers.map(t => t.id === id ? { ...t, ...updates } : t) }));
    const row: Partial<DbTeacher> = {};
    if (updates.name             !== undefined) row.name              = updates.name;
    if (updates.color            !== undefined) row.color             = updates.color;
    if (updates.honorPerSession  !== undefined) row.honor_per_session = updates.honorPerSession;
    if ('pendingHonor' in updates)              row.pending_honor                = updates.pendingHonor ?? null;
    if ('pendingHonorEffectiveDate' in updates) row.pending_honor_effective_date = updates.pendingHonorEffectiveDate ?? null;
    if (updates.isOwner          !== undefined) row.is_owner          = updates.isOwner;
    if (updates.isActive         !== undefined) row.is_active         = updates.isActive;
    db(supabase.from('teachers').update(row).eq('id', id));
    if (old) {
      let desc = '';
      if ('pendingHonor' in updates && updates.pendingHonor != null && updates.pendingHonorEffectiveDate) {
        desc = `Jadwalkan honor ${old.name}: ${formatCurrency(updates.pendingHonor)} mulai ${fmtLogDate(updates.pendingHonorEffectiveDate)}`;
      } else if (updates.honorPerSession !== undefined && updates.honorPerSession !== old.honorPerSession) {
        desc = `Ubah honor ${old.name}: ${formatCurrency(old.honorPerSession)} → ${formatCurrency(updates.honorPerSession)}`;
      } else if (updates.name !== undefined && updates.name !== old.name) {
        desc = `Ubah nama laoshi: ${old.name} → ${updates.name}`;
      } else if (updates.color !== undefined && updates.color !== old.color) {
        desc = `Ubah warna laoshi — ${old.name}`;
      }
      if (desc) logActivity('update', desc);
    }
  };
  // Non-aktifkan laoshi (arsip): honor & histori tetap, hanya hapus sesi terjadwal mendatang.
  const deactivateTeacher = (id: string) => {
    const teacher = data.teachers.find(t => t.id === id);
    const upcoming = data.sessions.filter(s => s.teacherId === id && s.status === 'scheduled');
    setData(d => ({
      ...d,
      teachers: d.teachers.map(t => t.id === id ? { ...t, isActive: false } : t),
      sessions: d.sessions.filter(s => !(s.teacherId === id && s.status === 'scheduled')),
    }));
    if (upcoming.length) db(supabase.from('sessions').delete().eq('teacher_id', id).eq('status', 'scheduled'));
    db(supabase.from('teachers').update({ is_active: false }).eq('id', id));
    if (teacher) logActivity('update', `Non-aktifkan laoshi — ${teacher.name}${upcoming.length ? ` (hapus ${upcoming.length} sesi mendatang)` : ''}`);
  };
  const deleteTeacher = (id: string) => {
    const old = data.teachers.find(t => t.id === id);
    const studentIds = data.students.filter(s => s.teacherId === id).map(s => s.id);
    setData(d => ({
      ...d,
      teachers: d.teachers.filter(t => t.id !== id),
      students: d.students.filter(s => s.teacherId !== id),
      packages: d.packages.filter(p => p.teacherId !== id),
      sessions: d.sessions.filter(s => s.teacherId !== id),
      worksheets: d.worksheets.filter(w => !studentIds.includes(w.studentId)),
      payments: d.payments.filter(p => !studentIds.includes(p.studentId)),
    }));
    // worksheets & payments hanya punya student_id → hapus per student milik laoshi ini
    if (studentIds.length) {
      db(supabase.from('worksheets').delete().in('student_id', studentIds));
      db(supabase.from('payments').delete().in('student_id', studentIds));
    }
    db(supabase.from('sessions').delete().eq('teacher_id', id));
    db(supabase.from('packages').delete().eq('teacher_id', id));
    db(supabase.from('students').delete().eq('teacher_id', id));
    db(supabase.from('teachers').delete().eq('id', id));
    if (old) logActivity('delete', `Hapus laoshi — ${old.name}${studentIds.length ? ` (+${studentIds.length} murid)` : ''}`);
  };

  // ─── Students ─────────────────────────────────────────────────────────────
  const addStudent = (student: Omit<Student, 'id' | 'createdAt' | 'isActive'>): Student => {
    const s: Student = { ...student, isActive: true, id: generateId(), createdAt: new Date().toISOString() };
    setData(d => ({ ...d, students: [...d.students, s] }));
    db(supabase.from('students').insert(toDbStudent(s)));
    logActivity('create', `Tambah murid — ${s.name}`);
    return s;
  };
  const updateStudent = (id: string, updates: Partial<Student>) => {
    const oldStudent = data.students.find(s => s.id === id);
    setData(d => ({ ...d, students: d.students.map(s => s.id === id ? { ...s, ...updates } : s) }));
    const row: Partial<DbStudent> = {};
    if (updates.name           !== undefined) row.name            = updates.name;
    if (updates.teacherId      !== undefined) row.teacher_id      = updates.teacherId;
    if (updates.billingType    !== undefined) row.billing_type    = updates.billingType;
    if (updates.ratePerSession !== undefined) row.rate_per_session = updates.ratePerSession;
    if ('pendingRate' in updates)                row.pending_rate                = updates.pendingRate ?? null;
    if ('pendingRateEffectiveDate' in updates)   row.pending_rate_effective_date = updates.pendingRateEffectiveDate ?? null;
    if (updates.deferredPayment    !== undefined) row.deferred_payment = updates.deferredPayment;
    if (updates.group          !== undefined) row.group           = updates.group;
    if (updates.xuYuanType     !== undefined) row.xu_yuan_type    = updates.xuYuanType;
    if (updates.phone          !== undefined) row.phone           = updates.phone ?? null;
    if (updates.notes          !== undefined) row.notes           = updates.notes;
    if (updates.isActive       !== undefined) row.is_active       = updates.isActive;
    db(supabase.from('students').update(row).eq('id', id));
    if (oldStudent) {
      const n = updates.name ?? oldStudent.name;
      if (updates.isActive !== undefined && updates.isActive !== oldStudent.isActive) {
        logActivity('update', updates.isActive ? `Aktifkan murid — ${n}` : `Non-aktifkan murid — ${n}`);
      } else if ('pendingRate' in updates && updates.pendingRate != null && updates.pendingRateEffectiveDate) {
        logActivity('update', `Jadwalkan harga ${n}: ${formatCurrency(updates.pendingRate)} mulai ${fmtLogDate(updates.pendingRateEffectiveDate)}`);
      } else {
        const changes: string[] = [];
        if (updates.name          !== undefined && updates.name          !== oldStudent.name)
          changes.push(`nama "${oldStudent.name}" → "${updates.name}"`);
        if (updates.ratePerSession !== undefined && updates.ratePerSession !== oldStudent.ratePerSession)
          changes.push(`harga ${formatCurrency(oldStudent.ratePerSession)} → ${formatCurrency(updates.ratePerSession)}`);
        if (updates.billingType   !== undefined && updates.billingType   !== oldStudent.billingType)
          changes.push(`billing ${oldStudent.billingType} → ${updates.billingType}`);
        if (updates.group         !== undefined && updates.group         !== oldStudent.group)
          changes.push(`grup ${oldStudent.group} → ${updates.group}`);
        if (updates.xuYuanType    !== undefined && updates.xuYuanType    !== oldStudent.xuYuanType)
          changes.push(`tipe XuYuan ${oldStudent.xuYuanType ?? 'private'} → ${updates.xuYuanType}`);
        if (updates.teacherId     !== undefined && updates.teacherId     !== oldStudent.teacherId) {
          const oldT = data.teachers.find(t => t.id === oldStudent.teacherId)?.name ?? '—';
          const newT = data.teachers.find(t => t.id === updates.teacherId)?.name    ?? '—';
          changes.push(`laoshi ${oldT} → ${newT}`);
        }
        if (updates.deferredPayment !== undefined && updates.deferredPayment !== oldStudent.deferredPayment)
          changes.push(updates.deferredPayment ? 'set dibayar lembaga' : 'batal dibayar lembaga');
        if (updates.notes !== undefined && updates.notes !== oldStudent.notes)
          changes.push('catatan diubah');
        if (changes.length) logActivity('update', `Ubah murid ${n}: ${changes.join(', ')}`);
      }
    }
  };
  // Non-aktifkan murid: simpan semua histori (sesi selesai, paket, worksheet, pembayaran),
  // hanya hapus sesi TERJADWAL (mendatang) agar tidak nyangkut di kalender.
  const deactivateStudent = (id: string) => {
    const student = data.students.find(s => s.id === id);
    const upcoming = data.sessions.filter(s => s.studentId === id && s.status === 'scheduled');
    setData(d => ({
      ...d,
      students: d.students.map(s => s.id === id ? { ...s, isActive: false } : s),
      sessions: d.sessions.filter(s => !(s.studentId === id && s.status === 'scheduled')),
    }));
    if (upcoming.length) db(supabase.from('sessions').delete().eq('student_id', id).eq('status', 'scheduled'));
    db(supabase.from('students').update({ is_active: false }).eq('id', id));
    if (student) logActivity('update', `Non-aktifkan murid — ${student.name}${upcoming.length ? ` (hapus ${upcoming.length} sesi mendatang)` : ''}`);
  };
  const deleteStudent = (id: string) => {
    const oldStudent = data.students.find(s => s.id === id);
    setData(d => ({
      ...d,
      students: d.students.filter(s => s.id !== id),
      packages: d.packages.filter(p => p.studentId !== id),
      sessions: d.sessions.filter(s => s.studentId !== id),
      worksheets: d.worksheets.filter(w => w.studentId !== id),
      payments: d.payments.filter(p => p.studentId !== id),
    }));
    // Hapus semua anak secara eksplisit (tidak bergantung FK cascade) agar tidak jadi yatim
    db(supabase.from('worksheets').delete().eq('student_id', id));
    db(supabase.from('payments').delete().eq('student_id', id));
    db(supabase.from('sessions').delete().eq('student_id', id));
    db(supabase.from('packages').delete().eq('student_id', id));
    db(supabase.from('students').delete().eq('id', id));
    if (oldStudent) logActivity('delete', `Hapus murid — ${oldStudent.name}`);
  };

  // ─── Packages ─────────────────────────────────────────────────────────────
  const pkgTotal = (p: { packagePrice?: number; pricePerSession: number; totalSessions: number }) =>
    p.packagePrice ?? p.pricePerSession * p.totalSessions;
  const addPackage = (pkg: Omit<SessionPackage, 'id' | 'createdAt'>): SessionPackage => {
    const p: SessionPackage = { ...pkg, id: generateId(), createdAt: new Date().toISOString() };
    setData(d => ({ ...d, packages: [...d.packages, p] }));
    db(supabase.from('packages').insert(toDbPackage(p)));
    const student = data.students.find(s => s.id === p.studentId);
    logActivity('create', `Tambah paket — ${student?.name ?? '—'}, ${p.totalSessions} sesi, ${formatCurrency(pkgTotal(p))}`);
    return p;
  };
  const updatePackage = (id: string, updates: Partial<SessionPackage>) => {
    const old = data.packages.find(p => p.id === id);
    setData(d => ({ ...d, packages: d.packages.map(p => p.id === id ? { ...p, ...updates } : p) }));
    const row: Partial<DbPackage> = {};
    if (updates.totalSessions   !== undefined) row.total_sessions   = updates.totalSessions;
    if (updates.pricingType     !== undefined) row.pricing_type     = updates.pricingType;
    if (updates.pricePerSession !== undefined) row.price_per_session = updates.pricePerSession;
    if (updates.packagePrice    !== undefined) row.package_price    = updates.packagePrice;
    if (updates.startDate       !== undefined) row.start_date       = updates.startDate;
    if (updates.notes           !== undefined) row.notes            = updates.notes;
    db(supabase.from('packages').update(row).eq('id', id));
    if (old) {
      const student = data.students.find(s => s.id === old.studentId);
      logActivity('update', `Ubah paket — ${student?.name ?? '—'}, ${updates.totalSessions ?? old.totalSessions} sesi`);
    }
  };
  const deletePackage = (id: string) => {
    const old = data.packages.find(p => p.id === id);
    setData(d => ({ ...d, packages: d.packages.filter(p => p.id !== id) }));
    db(supabase.from('packages').delete().eq('id', id));
    if (old) {
      const student = data.students.find(s => s.id === old.studentId);
      logActivity('delete', `Hapus paket — ${student?.name ?? '—'}, ${old.totalSessions} sesi, ${formatCurrency(pkgTotal(old))}`);
    }
  };

  // ─── Sessions ─────────────────────────────────────────────────────────────
  const addSession = (session: Omit<LessonSession, 'id' | 'createdAt'>): LessonSession => {
    const s: LessonSession = { ...session, id: generateId(), createdAt: new Date().toISOString() };
    setData(d => ({ ...d, sessions: [...d.sessions, s] }));
    db(supabase.from('sessions').insert(toDbSession(s)));
    const student = data.students.find(st => st.id === s.studentId);
    logActivity('create', `Tambah sesi — ${student?.name ?? '—'}, ${fmtLogDate(s.date)} ${s.startTime}–${s.endTime}`);
    return s;
  };
  const updateSession = (id: string, updates: Partial<LessonSession>) => {
    // Capture rate/honor snapshot when marking a session as completed
    let finalUpdates = updates;
    if (updates.status === 'completed') {
      const session = data.sessions.find(s => s.id === id);
      if (session) {
        const student = data.students.find(s => s.id === session.studentId);
        const teacher = data.teachers.find(te => te.id === session.teacherId);
        if (session.rateSnapshot == null && student && student.billingType === 'per-session') {
          finalUpdates = { ...finalUpdates, rateSnapshot: effectiveRate(student, session.date) };
        }
        if (session.honorSnapshot == null && teacher) {
          finalUpdates = { ...finalUpdates, honorSnapshot: effectiveHonor(teacher, session.date) };
        }
      }
    }
    setData(d => ({ ...d, sessions: d.sessions.map(s => s.id === id ? { ...s, ...finalUpdates } : s) }));
    const row: Partial<DbSession> = {};
    if (finalUpdates.teacherId     !== undefined) row.teacher_id    = finalUpdates.teacherId;
    if (finalUpdates.studentId     !== undefined) row.student_id    = finalUpdates.studentId;
    if (finalUpdates.date          !== undefined) row.date          = finalUpdates.date;
    if (finalUpdates.startTime     !== undefined) row.start_time    = finalUpdates.startTime;
    if (finalUpdates.endTime       !== undefined) row.end_time      = finalUpdates.endTime;
    if (finalUpdates.status        !== undefined) row.status        = finalUpdates.status;
    if (finalUpdates.notes          !== undefined) row.notes           = finalUpdates.notes;
    if (finalUpdates.worksheetPages !== undefined) row.worksheet_pages = finalUpdates.worksheetPages ?? null;
    if (finalUpdates.rateSnapshot   !== undefined) row.rate_snapshot   = finalUpdates.rateSnapshot;
    if (finalUpdates.honorSnapshot  !== undefined) row.honor_snapshot  = finalUpdates.honorSnapshot;
    db(supabase.from('sessions').update(row).eq('id', id));

    // Log reschedule (perubahan tanggal/jam)
    const old = data.sessions.find(s => s.id === id);
    if (old) {
      const newDate  = finalUpdates.date      ?? old.date;
      const newStart = finalUpdates.startTime ?? old.startTime;
      const newEnd   = finalUpdates.endTime   ?? old.endTime;
      if (newDate !== old.date || newStart !== old.startTime || newEnd !== old.endTime) {
        const student = data.students.find(st => st.id === old.studentId);
        logActivity('reschedule', `Reschedule — ${student?.name ?? '—'}: ${fmtLogDate(old.date)} ${old.startTime} → ${fmtLogDate(newDate)} ${newStart}`);
      }
    }
  };
  const deleteSession = (id: string) => {
    const old = data.sessions.find(s => s.id === id);
    setData(d => ({ ...d, sessions: d.sessions.filter(s => s.id !== id) }));
    db(supabase.from('sessions').delete().eq('id', id));
    if (old) {
      const student = data.students.find(st => st.id === old.studentId);
      logActivity('delete', `Hapus sesi — ${student?.name ?? '—'}, ${fmtLogDate(old.date)} ${old.startTime}–${old.endTime}`);
    }
  };

  // ─── Worksheets ───────────────────────────────────────────────────────────
  const addWorksheet = (w: Omit<Worksheet, 'id' | 'createdAt'>): Worksheet => {
    const now = new Date().toISOString();
    const newW: Worksheet = { ...w, id: generateId(), createdAt: now };
    setData(d => ({ ...d, worksheets: [...d.worksheets, newW] }));
    db(supabase.from('worksheets').insert(toDbWorksheet(newW)));
    const student = data.students.find(s => s.id === newW.studentId);
    logActivity('create', `Tambah worksheet — ${student?.name ?? '—'}, ${newW.pages} hal, ${fmtLogDate(newW.date)}`);
    return newW;
  };
  const updateWorksheet = (id: string, updates: Partial<Worksheet>) => {
    setData(d => ({ ...d, worksheets: d.worksheets.map(w => w.id === id ? { ...w, ...updates } : w) }));
    const old = data.worksheets.find(w => w.id === id)!;
    db(supabase.from('worksheets').update(toDbWorksheet({ ...old, ...updates })).eq('id', id));
    const student = data.students.find(s => s.id === old.studentId);
    logActivity('update', `Ubah worksheet — ${student?.name ?? '—'}, ${updates.pages ?? old.pages} hal`);
  };
  const deleteWorksheet = (id: string) => {
    const old = data.worksheets.find(w => w.id === id);
    setData(d => ({ ...d, worksheets: d.worksheets.filter(w => w.id !== id) }));
    db(supabase.from('worksheets').delete().eq('id', id));
    if (old) {
      const student = data.students.find(s => s.id === old.studentId);
      logActivity('delete', `Hapus worksheet — ${student?.name ?? '—'}, ${old.pages} hal, ${fmtLogDate(old.date)}`);
    }
  };

  // ─── Payments (murid dibayar lembaga) ─────────────────────────────────────
  const addPayment = (p: Omit<Payment, 'id' | 'createdAt'>): Payment => {
    const payment: Payment = { ...p, id: generateId(), createdAt: new Date().toISOString() };
    setData(d => ({ ...d, payments: [...d.payments, payment] }));
    db(supabase.from('payments').insert(toDbPayment(payment)));
    const student = data.students.find(s => s.id === payment.studentId);
    logActivity('create', `Catat pembayaran — ${student?.name ?? '—'}, ${formatCurrency(payment.amount)}, ${fmtLogDate(payment.date)}`);
    return payment;
  };
  const deletePayment = (id: string) => {
    const old = data.payments.find(p => p.id === id);
    setData(d => ({ ...d, payments: d.payments.filter(p => p.id !== id) }));
    db(supabase.from('payments').delete().eq('id', id));
    if (old) {
      const student = data.students.find(s => s.id === old.studentId);
      logActivity('delete', `Hapus pembayaran — ${student?.name ?? '—'}, ${formatCurrency(old.amount)}`);
    }
  };

  return (
    <AppContext.Provider value={{
      data, loading,
      addTeacher, updateTeacher, deactivateTeacher, deleteTeacher,
      addStudent, updateStudent, deactivateStudent, deleteStudent,
      addPackage, updatePackage, deletePackage,
      addSession, updateSession, deleteSession,
      addWorksheet, updateWorksheet, deleteWorksheet,
      addPayment, deletePayment,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
