import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { AppData, Teacher, Student, SessionPackage, LessonSession, BillingType, StudentGroup, PackagePricingType } from '../types';
import { generateId } from '../utils/helpers';
import { supabase } from '../lib/supabase';

const defaultData: AppData = { teachers: [], students: [], packages: [], sessions: [] };

// ─── DB row types (snake_case) ────────────────────────────────────────────────
interface DbTeacher  { id: string; name: string; color: string; created_at: string; }
interface DbStudent  { id: string; teacher_id: string; name: string; billing_type: string; rate_per_session: number; group: string; notes?: string; created_at: string; }
interface DbPackage  { id: string; student_id: string; teacher_id: string; total_sessions: number; pricing_type: string; price_per_session: number; package_price?: number; start_date: string; notes?: string; created_at: string; }
interface DbSession  { id: string; student_id: string; teacher_id: string; date: string; start_time: string; end_time: string; status: string; notes?: string; created_at: string; }

// ─── Mappers DB → App ─────────────────────────────────────────────────────────
const mapTeacher  = (r: DbTeacher):  Teacher        => ({ id: r.id, name: r.name, color: r.color, createdAt: r.created_at });
const mapStudent  = (r: DbStudent):  Student        => ({ id: r.id, teacherId: r.teacher_id, name: r.name, billingType: r.billing_type as BillingType, ratePerSession: r.rate_per_session, group: r.group as StudentGroup, notes: r.notes, createdAt: r.created_at });
const mapPackage  = (r: DbPackage):  SessionPackage => ({ id: r.id, studentId: r.student_id, teacherId: r.teacher_id, totalSessions: r.total_sessions, pricingType: r.pricing_type as PackagePricingType, pricePerSession: r.price_per_session, packagePrice: r.package_price, startDate: r.start_date, notes: r.notes, createdAt: r.created_at });
const mapSession  = (r: DbSession):  LessonSession  => ({ id: r.id, studentId: r.student_id, teacherId: r.teacher_id, date: r.date, startTime: r.start_time, endTime: r.end_time, status: r.status as LessonSession['status'], notes: r.notes, createdAt: r.created_at });

// ─── Mappers App → DB ─────────────────────────────────────────────────────────
const toDbTeacher = (t: Teacher)        => ({ id: t.id, name: t.name, color: t.color, created_at: t.createdAt });
const toDbStudent = (s: Student)        => ({ id: s.id, teacher_id: s.teacherId, name: s.name, billing_type: s.billingType, rate_per_session: s.ratePerSession, group: s.group, notes: s.notes ?? null, created_at: s.createdAt });
const toDbPackage = (p: SessionPackage) => ({ id: p.id, student_id: p.studentId, teacher_id: p.teacherId, total_sessions: p.totalSessions, pricing_type: p.pricingType, price_per_session: p.pricePerSession, package_price: p.packagePrice ?? null, start_date: p.startDate, notes: p.notes ?? null, created_at: p.createdAt });
const toDbSession = (s: LessonSession)  => ({ id: s.id, student_id: s.studentId, teacher_id: s.teacherId, date: s.date, start_time: s.startTime, end_time: s.endTime, status: s.status, notes: s.notes ?? null, created_at: s.createdAt });

// ─── Context type ─────────────────────────────────────────────────────────────
interface AppContextType {
  data: AppData;
  loading: boolean;
  addTeacher:    (name: string, color: string) => Teacher;
  updateTeacher: (id: string, updates: Partial<Teacher>) => void;
  deleteTeacher: (id: string) => void;
  addStudent:    (student: Omit<Student, 'id' | 'createdAt'>) => Student;
  updateStudent: (id: string, updates: Partial<Student>) => void;
  deleteStudent: (id: string) => void;
  addPackage:    (pkg: Omit<SessionPackage, 'id' | 'createdAt'>) => SessionPackage;
  updatePackage: (id: string, updates: Partial<SessionPackage>) => void;
  deletePackage: (id: string) => void;
  addSession:    (session: Omit<LessonSession, 'id' | 'createdAt'>) => LessonSession;
  updateSession: (id: string, updates: Partial<LessonSession>) => void;
  deleteSession: (id: string) => void;
}

// Force lazy Supabase query to execute and log any error
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(query: PromiseLike<{ error: any }>) {
  query.then(({ error }) => { if (error) console.error('Supabase error:', error); });
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(defaultData);
  const [loading, setLoading] = useState(true);

  // ─── Initial load + real-time subscriptions ──────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      const [t, s, p, se] = await Promise.all([
        supabase.from('teachers').select('*').order('created_at'),
        supabase.from('students').select('*').order('created_at'),
        supabase.from('packages').select('*').order('created_at'),
        supabase.from('sessions').select('*').order('created_at'),
      ]);
      if (cancelled) return;
      setData({
        teachers: (t.data ?? []).map(mapTeacher),
        students: (s.data ?? []).map(mapStudent),
        packages: (p.data ?? []).map(mapPackage),
        sessions: (se.data ?? []).map(mapSession),
      });
      setLoading(false);
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
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  // ─── Auto-complete past sessions ─────────────────────────────────────────
  useEffect(() => {
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

        // Push updates to Supabase in background
        Promise.all(toComplete.map(s =>
          supabase.from('sessions').update({ status: 'completed' }).eq('id', s.id)
        ));

        return {
          ...d,
          sessions: d.sessions.map(s =>
            toComplete.find(c => c.id === s.id) ? { ...s, status: 'completed' as const } : s
          ),
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
  }, []);

  // ─── Teachers ─────────────────────────────────────────────────────────────
  const addTeacher = (name: string, color: string): Teacher => {
    const teacher: Teacher = { id: generateId(), name, color, createdAt: new Date().toISOString() };
    setData(d => ({ ...d, teachers: [...d.teachers, teacher] }));
    db(supabase.from('teachers').insert(toDbTeacher(teacher)));
    return teacher;
  };
  const updateTeacher = (id: string, updates: Partial<Teacher>) => {
    setData(d => ({ ...d, teachers: d.teachers.map(t => t.id === id ? { ...t, ...updates } : t) }));
    const row: Partial<DbTeacher> = {};
    if (updates.name  !== undefined) row.name  = updates.name;
    if (updates.color !== undefined) row.color = updates.color;
    db(supabase.from('teachers').update(row).eq('id', id));
  };
  const deleteTeacher = (id: string) => {
    setData(d => ({
      ...d,
      teachers: d.teachers.filter(t => t.id !== id),
      students: d.students.filter(s => s.teacherId !== id),
      packages: d.packages.filter(p => p.teacherId !== id),
      sessions: d.sessions.filter(s => s.teacherId !== id),
    }));
    db(supabase.from('teachers').delete().eq('id', id));
  };

  // ─── Students ─────────────────────────────────────────────────────────────
  const addStudent = (student: Omit<Student, 'id' | 'createdAt'>): Student => {
    const s: Student = { ...student, id: generateId(), createdAt: new Date().toISOString() };
    setData(d => ({ ...d, students: [...d.students, s] }));
    db(supabase.from('students').insert(toDbStudent(s)));
    return s;
  };
  const updateStudent = (id: string, updates: Partial<Student>) => {
    setData(d => ({ ...d, students: d.students.map(s => s.id === id ? { ...s, ...updates } : s) }));
    const row: Partial<DbStudent> = {};
    if (updates.name           !== undefined) row.name            = updates.name;
    if (updates.teacherId      !== undefined) row.teacher_id      = updates.teacherId;
    if (updates.billingType    !== undefined) row.billing_type    = updates.billingType;
    if (updates.ratePerSession !== undefined) row.rate_per_session = updates.ratePerSession;
    if (updates.group          !== undefined) row.group           = updates.group;
    if (updates.notes          !== undefined) row.notes           = updates.notes;
    db(supabase.from('students').update(row).eq('id', id));
  };
  const deleteStudent = (id: string) => {
    setData(d => ({
      ...d,
      students: d.students.filter(s => s.id !== id),
      packages: d.packages.filter(p => p.studentId !== id),
      sessions: d.sessions.filter(s => s.studentId !== id),
    }));
    db(supabase.from('students').delete().eq('id', id));
  };

  // ─── Packages ─────────────────────────────────────────────────────────────
  const addPackage = (pkg: Omit<SessionPackage, 'id' | 'createdAt'>): SessionPackage => {
    const p: SessionPackage = { ...pkg, id: generateId(), createdAt: new Date().toISOString() };
    setData(d => ({ ...d, packages: [...d.packages, p] }));
    db(supabase.from('packages').insert(toDbPackage(p)));
    return p;
  };
  const updatePackage = (id: string, updates: Partial<SessionPackage>) => {
    setData(d => ({ ...d, packages: d.packages.map(p => p.id === id ? { ...p, ...updates } : p) }));
    const row: Partial<DbPackage> = {};
    if (updates.totalSessions   !== undefined) row.total_sessions   = updates.totalSessions;
    if (updates.pricingType     !== undefined) row.pricing_type     = updates.pricingType;
    if (updates.pricePerSession !== undefined) row.price_per_session = updates.pricePerSession;
    if (updates.packagePrice    !== undefined) row.package_price    = updates.packagePrice;
    if (updates.startDate       !== undefined) row.start_date       = updates.startDate;
    if (updates.notes           !== undefined) row.notes            = updates.notes;
    db(supabase.from('packages').update(row).eq('id', id));
  };
  const deletePackage = (id: string) => {
    setData(d => ({ ...d, packages: d.packages.filter(p => p.id !== id) }));
    db(supabase.from('packages').delete().eq('id', id));
  };

  // ─── Sessions ─────────────────────────────────────────────────────────────
  const addSession = (session: Omit<LessonSession, 'id' | 'createdAt'>): LessonSession => {
    const s: LessonSession = { ...session, id: generateId(), createdAt: new Date().toISOString() };
    setData(d => ({ ...d, sessions: [...d.sessions, s] }));
    db(supabase.from('sessions').insert(toDbSession(s)));
    return s;
  };
  const updateSession = (id: string, updates: Partial<LessonSession>) => {
    setData(d => ({ ...d, sessions: d.sessions.map(s => s.id === id ? { ...s, ...updates } : s) }));
    const row: Partial<DbSession> = {};
    if (updates.teacherId  !== undefined) row.teacher_id = updates.teacherId;
    if (updates.studentId  !== undefined) row.student_id = updates.studentId;
    if (updates.date       !== undefined) row.date       = updates.date;
    if (updates.startTime  !== undefined) row.start_time = updates.startTime;
    if (updates.endTime    !== undefined) row.end_time   = updates.endTime;
    if (updates.status     !== undefined) row.status     = updates.status;
    if (updates.notes      !== undefined) row.notes      = updates.notes;
    db(supabase.from('sessions').update(row).eq('id', id));
  };
  const deleteSession = (id: string) => {
    setData(d => ({ ...d, sessions: d.sessions.filter(s => s.id !== id) }));
    db(supabase.from('sessions').delete().eq('id', id));
  };

  return (
    <AppContext.Provider value={{
      data, loading,
      addTeacher, updateTeacher, deleteTeacher,
      addStudent, updateStudent, deleteStudent,
      addPackage, updatePackage, deletePackage,
      addSession, updateSession, deleteSession,
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
