import { useState } from 'react';
import { Plus, Pencil, Trash2, X, Check, PowerOff, RotateCcw } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { useLang } from '../store/LanguageContext';
import { useConfirm } from '../store/ConfirmContext';
import { useToast } from '../store/ToastContext';
import { TEACHER_COLORS } from '../utils/helpers';

export default function Teachers() {
  const { data, addTeacher, updateTeacher, deactivateTeacher, deleteTeacher } = useApp();
  const { t } = useLang();
  const confirm = useConfirm();
  const toast = useToast();
  const [showInactive, setShowInactive] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(TEACHER_COLORS[0]);
  const [showErrors, setShowErrors] = useState(false);

  const openAdd = () => {
    setEditId(null);
    setName('');
    setColor(TEACHER_COLORS[data.teachers.length % TEACHER_COLORS.length]);
    setShowErrors(false);
    setShowForm(true);
  };

  const openEdit = (id: string) => {
    const t = data.teachers.find(t => t.id === id);
    if (!t) return;
    setEditId(id);
    setName(t.name);
    setColor(t.color);
    setShowErrors(false);
    setShowForm(true);
  };

  const save = () => {
    if (!name.trim()) { setShowErrors(true); return; }
    if (editId) {
      updateTeacher(editId, { name: name.trim(), color });
    } else {
      addTeacher(name.trim(), color);
    }
    setShowForm(false);
  };

  const remove = async (id: string) => {
    const teacher = data.teachers.find(t => t.id === id);
    const studentCount = data.students.filter(s => s.teacherId === id).length;
    const msg = studentCount > 0
      ? t('teach.deleteConfirmCascade', { name: teacher?.name ?? '', count: studentCount })
      : t('teach.deleteConfirm', { name: teacher?.name ?? '' });
    if (await confirm({ message: msg, danger: true })) { deleteTeacher(id); toast.success(t('common.deleted')); }
  };

  const deactivate = async (id: string) => {
    const teacher = data.teachers.find(t => t.id === id);
    const upcoming = data.sessions.filter(s => s.teacherId === id && s.status === 'scheduled').length;
    const msg = upcoming > 0
      ? t('teach.deactivateConfirm', { name: teacher?.name ?? '', n: upcoming })
      : t('teach.deactivateConfirmNoSessions', { name: teacher?.name ?? '' });
    if (await confirm({ message: msg, danger: true })) { deactivateTeacher(id); toast.success(t('teach.deactivate')); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('teach.title')}</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-indigo-700"
        >
          <Plus size={16} /> {t('teach.add')}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">{editId ? t('teach.editTitle') : t('teach.addTitle')}</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('teach.name')}</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && save()}
              placeholder={t('teach.namePlaceholder')}
              className={`w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${showErrors && !name.trim() ? 'border-red-400 bg-red-50 dark:bg-red-900/20' : 'border-gray-300 dark:border-gray-600'}`}
            />
            {showErrors && !name.trim() && (
              <p className="text-xs text-red-500 mt-1">{t('teach.nameRequired')}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('teach.color')}</label>
            <div className="flex gap-2 flex-wrap">
              {TEACHER_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    background: c,
                    borderColor: color === c ? '#1e1b4b' : 'transparent',
                  }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={save}
              className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700"
            >
              <Check size={16} /> {t('common.save')}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <X size={16} /> {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {data.teachers.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center text-gray-400 dark:text-gray-500">
          <p className="text-sm">{t('teach.empty')}</p>
        </div>
      ) : (() => {
        const activeTeachers = data.teachers.filter(te => te.isActive);
        const inactiveTeachers = data.teachers.filter(te => !te.isActive);

        const row = (teacher: typeof data.teachers[0], dimmed?: boolean) => {
          const studentCount = data.students.filter(s => s.teacherId === teacher.id).length;
          const sessionCount = data.sessions.filter(s => s.teacherId === teacher.id).length;
          return (
            <div key={teacher.id} className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex items-center gap-3 ${dimmed ? 'opacity-60' : ''}`}>
              <div className="w-10 h-10 rounded-full flex-shrink-0" style={{ background: teacher.color }} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  {teacher.name}
                  {!teacher.isActive && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">{t('stu.inactive')}</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {t('teach.studentsSessions', { students: studentCount, sessions: sessionCount })}
                </div>
              </div>
              <div className="flex gap-1 items-center">
                {teacher.isActive ? (
                  <>
                    <button onClick={() => openEdit(teacher.id)} className="p-2 text-gray-400 dark:text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors">
                      <Pencil size={15} />
                    </button>
                    {!teacher.isOwner && (
                      <button onClick={() => deactivate(teacher.id)} title={t('teach.deactivate')} className="p-2 text-gray-400 dark:text-gray-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors">
                        <PowerOff size={15} />
                      </button>
                    )}
                  </>
                ) : (
                  <button onClick={() => updateTeacher(teacher.id, { isActive: true })} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors font-medium">
                    <RotateCcw size={12} /> {t('stu.activate')}
                  </button>
                )}
                <button onClick={() => remove(teacher.id)} className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          );
        };

        return (
          <>
            <div className="space-y-2">
              {activeTeachers.map(te => row(te))}
            </div>
            {inactiveTeachers.length > 0 && (
              <div className="pt-2 space-y-2">
                <button onClick={() => setShowInactive(v => !v)} className="w-full flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors py-1">
                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                  <span className="whitespace-nowrap">
                    {showInactive ? t('stu.hideInactive') : t('teach.inactiveCount', { n: inactiveTeachers.length })}
                  </span>
                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                </button>
                {showInactive && inactiveTeachers.map(te => row(te, true))}
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}
