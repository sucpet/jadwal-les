import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ArrowLeft, Search, ChevronRight, AlertTriangle, CheckCircle2, NotebookPen } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { useLang } from '../store/LanguageContext';
import { STUDENT_GROUPS } from '../types';
import type { LessonSession, Student } from '../types';
import { isLessonPlanStudent, pastSessions, lessonPlanSummary, needsLessonPlan } from '../utils/lessonPlan';

// Lesson plan murid non-XuYuan: catatan "apa yang dipelajari" per sesi (SPEC-lesson-plan-page.md).
// HP: daftar murid → detail (?student=<id>). Desktop: dua kolom.

const GROUP_BADGE: Record<string, string> = {
  pribadi:           'text-blue-500 bg-blue-100',
  wenwen_aizhongwen: 'text-purple-500 bg-purple-100',
};
const GROUP_DIVIDER: Record<string, string> = {
  pribadi:           'bg-blue-100',
  wenwen_aizhongwen: 'bg-purple-100',
};

function nowParts() {
  const d = new Date();
  return [format(d, 'yyyy-MM-dd'), format(d, 'HH:mm')] as const;
}

export default function LessonPlan() {
  const { data } = useApp();
  const { t, locale } = useLang();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('student');
  const [filterTeacher, setFilterTeacher] = useState('all');
  const [query, setQuery] = useState('');
  const [today, nowHHMM] = nowParts();

  // Sesi lampau per murid, dihitung sekali per render.
  const byStudent = new Map<string, LessonSession[]>();
  for (const s of data.sessions) {
    const list = byStudent.get(s.studentId);
    if (list) list.push(s); else byStudent.set(s.studentId, [s]);
  }
  const rows = data.students
    .filter(isLessonPlanStudent)
    .map(student => {
      const past = pastSessions(byStudent.get(student.id) ?? [], student.id, today, nowHHMM);
      return { student, past, summary: lessonPlanSummary(past) };
    })
    .filter(r => r.summary.total > 0);

  const visible = rows
    .filter(r => filterTeacher === 'all' || r.student.teacherId === filterTeacher)
    .filter(r => !query.trim() || r.student.name.toLowerCase().includes(query.trim().toLowerCase()));
  const totalEmpty = visible.reduce((n, r) => n + r.summary.empty, 0);
  const selected = rows.find(r => r.student.id === selectedId);
  const teachers = data.teachers.filter(te => rows.some(r => r.student.teacherId === te.id));

  const open = (id: string | null) => setParams(id ? { student: id } : {});

  const list = (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('lpn.title')}</h1>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{t('lpn.subtitle', { n: visible.length, m: totalEmpty })}</p>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('stu.searchPh')}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {teachers.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterTeacher('all')}
            className={`text-sm px-3 py-1.5 rounded-lg border ${filterTeacher === 'all' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'}`}
          >{t('stu.all')}</button>
          {teachers.map(te => (
            <button key={te.id} onClick={() => setFilterTeacher(te.id)}
              className={`text-sm px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${filterTeacher === te.id ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'}`}
            >
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: te.color }} />
              {te.name}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">{t('lpn.noStudents')}</p>
      )}

      {STUDENT_GROUPS.filter(g => g.value !== 'xuyuan').map(({ value, label }) => {
        const group = visible
          .filter(r => r.student.group === value)
          .sort((a, b) => Number(b.summary.empty > 0) - Number(a.summary.empty > 0) || a.student.name.localeCompare(b.student.name, 'id'));
        if (!group.length) return null;
        return (
          <section key={value} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${GROUP_BADGE[value]}`}>{label}</span>
              <div className={`flex-1 h-px ${GROUP_DIVIDER[value]}`} />
              <span className="text-xs text-gray-400">{t('stu.studentCount', { n: group.length })}</span>
            </div>
            {group.map(({ student, summary }) => {
              const teacher = data.teachers.find(te => te.id === student.teacherId);
              const active = student.id === selectedId;
              return (
                <button
                  key={student.id}
                  onClick={() => open(student.id)}
                  className={`w-full text-left bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 border ${active ? 'border-indigo-400 dark:border-indigo-500' : 'border-gray-200 dark:border-gray-700'}`}
                >
                  <div className="w-1.5 self-stretch rounded-full flex-shrink-0" style={{ background: teacher?.color ?? '#9ca3af' }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white truncate">{student.name}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                      <span style={{ color: teacher?.color }}>{teacher?.name}</span>
                      {summary.lastDate && <> · {t('lpn.last', { date: format(parseISO(summary.lastDate), 'd MMM', { locale }) })}</>}
                    </div>
                    <div className="text-xs mt-1">
                      {summary.empty > 0 ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                          <AlertTriangle size={11} /> {t('lpn.emptyN', { n: summary.empty })}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 size={11} /> {t('lpn.allFilled')}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                </button>
              );
            })}
          </section>
        );
      })}
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto md:grid md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:gap-6 md:items-start">
      <div className={selected ? 'hidden md:block' : ''}>{list}</div>
      {selected ? (
        <StudentLessonPlan student={selected.student} past={selected.past} onBack={() => open(null)} />
      ) : (
        <div className="hidden md:flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl py-24 mt-14">
          <NotebookPen size={28} className="mb-2 opacity-60" />
          <p className="text-sm">{t('lpn.pick')}</p>
        </div>
      )}
    </div>
  );
}

function StudentLessonPlan({ student, past, onBack }: { student: Student; past: LessonSession[]; onBack: () => void }) {
  const { data } = useApp();
  const { t, locale } = useLang();
  const teacher = data.teachers.find(te => te.id === student.teacherId);
  const groupLabel = STUDENT_GROUPS.find(g => g.value === student.group)?.label;

  // Kelompokkan per bulan; `past` sudah urut terbaru dulu.
  const months: { key: string; sessions: LessonSession[] }[] = [];
  for (const s of past) {
    const key = s.date.slice(0, 7);
    const last = months[months.length - 1];
    if (last?.key === key) last.sessions.push(s); else months.push({ key, sessions: [s] });
  }

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex items-start gap-2">
        <button onClick={onBack} aria-label={t('lpn.back')}
          className="md:hidden p-1.5 -ml-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white break-words">{student.name}</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
            <span style={{ color: teacher?.color }}>{teacher?.name}</span> · {groupLabel} · {t('common.sessions_n', { n: past.length })}
          </p>
        </div>
      </div>

      {months.map(({ key, sessions }) => (
        <section key={key} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {format(parseISO(`${key}-01`), 'MMMM yyyy', { locale })}
          </h3>
          {sessions.map(s => <LessonPlanEntry key={s.id} session={s} />)}
        </section>
      ))}
    </div>
  );
}

// Textarea per sesi. Draft lokal; disimpan saat blur kalau berubah.
// Realtime dari perangkat lain hanya menimpa draft saat textarea tidak sedang difokus.
function LessonPlanEntry({ session }: { session: LessonSession }) {
  const { updateSession } = useApp();
  const { t, locale } = useLang();
  const saved = session.lessonPlan ?? '';
  const [draft, setDraft] = useState(saved);
  const [justSaved, setJustSaved] = useState(false);
  const focused = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => { if (!focused.current) setDraft(saved); }, [saved]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const save = () => {
    focused.current = false;
    const next = draft.trim();
    if (next === saved.trim()) return;
    updateSession(session.id, { lessonPlan: next || undefined });
    setJustSaved(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setJustSaved(false), 2000);
  };

  const empty = needsLessonPlan({ ...session, lessonPlan: draft });
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium text-gray-700 dark:text-gray-200">
          {format(parseISO(session.date), 'EEE, d MMM', { locale })} · <span className="tabular-nums">{session.startTime}–{session.endTime}</span>
        </span>
        {justSaved && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 flex-shrink-0">
            <CheckCircle2 size={12} /> {t('lpn.saved')}
          </span>
        )}
      </div>
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onFocus={() => { focused.current = true; }}
        onBlur={save}
        rows={3}
        placeholder={t('lpn.placeholder')}
        className={`w-full rounded-lg px-3 py-2 text-sm resize-y bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 border ${
          empty ? 'border-amber-300 dark:border-amber-700' : 'border-gray-300 dark:border-gray-600'
        }`}
      />
    </div>
  );
}
