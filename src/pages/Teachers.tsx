import { useState } from 'react';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { TEACHER_COLORS } from '../utils/helpers';

export default function Teachers() {
  const { data, addTeacher, updateTeacher, deleteTeacher } = useApp();
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

  const remove = (id: string) => {
    const teacher = data.teachers.find(t => t.id === id);
    const studentCount = data.students.filter(s => s.teacherId === id).length;
    const msg = studentCount > 0
      ? `Hapus laoshi "${teacher?.name}"? Ini juga akan menghapus ${studentCount} murid dan semua jadwalnya.`
      : `Hapus laoshi "${teacher?.name}"?`;
    if (confirm(msg)) deleteTeacher(id);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Laoshi</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-indigo-700"
        >
          <Plus size={16} /> Tambah Laoshi
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">{editId ? 'Edit Laoshi' : 'Tambah Laoshi Baru'}</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Laoshi</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && save()}
              placeholder="Contoh: WenWen"
              className={`w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${showErrors && !name.trim() ? 'border-red-400 bg-red-50 dark:bg-red-900/20' : 'border-gray-300 dark:border-gray-600'}`}
            />
            {showErrors && !name.trim() && (
              <p className="text-xs text-red-500 mt-1">Nama laoshi wajib diisi</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Warna</label>
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
              <Check size={16} /> Simpan
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <X size={16} /> Batal
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {data.teachers.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center text-gray-400 dark:text-gray-500">
          <p className="text-sm">Belum ada laoshi. Tambahkan laoshi pertama.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.teachers.map(teacher => {
            const studentCount = data.students.filter(s => s.teacherId === teacher.id).length;
            const sessionCount = data.sessions.filter(s => s.teacherId === teacher.id).length;
            return (
              <div key={teacher.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex-shrink-0" style={{ background: teacher.color }} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white">{teacher.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {studentCount} murid · {sessionCount} sesi tercatat
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(teacher.id)}
                    className="p-2 text-gray-400 dark:text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => remove(teacher.id)}
                    className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
