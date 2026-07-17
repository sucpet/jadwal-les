import { useRef, useState, useEffect, useCallback } from 'react';
import { Upload, Download, Trash2, AlertTriangle, CheckCircle2, Database, Moon, Sun, Cloud, RefreshCw } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { useTheme } from '../store/ThemeContext';
import { supabase } from '../lib/supabase';

export default function Settings() {
  const { data } = useApp();
  const { isDark, toggle } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const [backupFiles, setBackupFiles] = useState<Array<{ name: string }>>([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupSetupNeeded, setBackupSetupNeeded] = useState(false);
  const [manualBacking, setManualBacking] = useState(false);
  const lastBackupDate = localStorage.getItem('jadwal-les-last-backup');

  const loadBackupFiles = useCallback(async () => {
    setBackupLoading(true);
    const { data: files, error } = await supabase.storage
      .from('backups')
      .list('', { sortBy: { column: 'name', order: 'desc' } });
    setBackupLoading(false);
    if (error) { setBackupSetupNeeded(true); return; }
    setBackupSetupNeeded(false);
    setBackupFiles((files ?? []).filter(f => f.name.endsWith('.json')));
  }, []);

  useEffect(() => { loadBackupFiles(); }, [loadBackupFiles]);

  const handleManualBackup = async () => {
    setManualBacking(true);
    const today = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const { error } = await supabase.storage
      .from('backups')
      .upload(`backup_${today}.json`, blob, { upsert: true });
    setManualBacking(false);
    if (error) { setStatus({ type: 'error', msg: `Gagal backup: ${error.message}` }); return; }
    localStorage.setItem('jadwal-les-last-backup', today);
    setStatus({ type: 'success', msg: 'Backup berhasil disimpan ke cloud.' });
    loadBackupFiles();
  };

  const handleDownloadBackup = async (filename: string) => {
    const { data: blob, error } = await supabase.storage.from('backups').download(filename);
    if (error || !blob) { setStatus({ type: 'error', msg: 'Gagal download backup.' }); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        if (!Array.isArray(json.teachers) || !Array.isArray(json.students) || !Array.isArray(json.sessions) || !Array.isArray(json.packages)) {
          throw new Error('Format file tidak valid (teachers/students/sessions/packages harus ada)');
        }
        localStorage.setItem('jadwal-les-data', JSON.stringify(json));
        setStatus({ type: 'success', msg: `Berhasil import: ${json.teachers.length} laoshi, ${json.students.length} murid, ${json.packages.length} paket, ${json.sessions.length} sesi. Halaman akan reload...` });
        setTimeout(() => window.location.reload(), 1500);
      } catch (err) {
        setStatus({ type: 'error', msg: `Gagal import: ${(err as Error).message}` });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jadwal-les-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleMigrateFromLocalStorage = async () => {
    try {
      const raw = localStorage.getItem('jadwal-les-data');
      if (!raw) { setStatus({ type: 'error', msg: 'Tidak ada data di localStorage.' }); return; }
      const d = JSON.parse(raw);
      if (!d.teachers || !d.students || !d.packages || !d.sessions) {
        setStatus({ type: 'error', msg: 'Format data tidak valid.' }); return;
      }

      setStatus({ type: 'success', msg: 'Mengupload data...' });

      // Upload dalam urutan yang benar (foreign key: teachers → students → packages/sessions)
      const teachers = d.teachers.map((t: any) => ({ id: t.id, name: t.name, color: t.color, created_at: t.createdAt }));
      const students = d.students.map((s: any) => ({ id: s.id, teacher_id: s.teacherId, name: s.name, billing_type: s.billingType, rate_per_session: s.ratePerSession, group: s.group ?? 'xuyuan', notes: s.notes ?? null, created_at: s.createdAt }));
      const packages = d.packages.map((p: any) => ({ id: p.id, student_id: p.studentId, teacher_id: p.teacherId, total_sessions: p.totalSessions, pricing_type: p.pricingType ?? 'per-session', price_per_session: p.pricePerSession, package_price: p.packagePrice ?? null, start_date: p.startDate, notes: p.notes ?? null, created_at: p.createdAt }));
      const sessions = d.sessions.map((s: any) => ({ id: s.id, student_id: s.studentId, teacher_id: s.teacherId, date: s.date, start_time: s.startTime, end_time: s.endTime, status: s.status, notes: s.notes ?? null, created_at: s.createdAt }));

      // Upsert semua (aman dijalankan berulang kali)
      const { error: e1 } = await supabase.from('teachers').upsert(teachers);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('students').upsert(students);
      if (e2) throw e2;
      const { error: e3 } = await supabase.from('packages').upsert(packages);
      if (e3) throw e3;

      // Upload sessions dalam batch 100 supaya tidak timeout
      for (let i = 0; i < sessions.length; i += 100) {
        const { error } = await supabase.from('sessions').upsert(sessions.slice(i, i + 100));
        if (error) throw error;
      }

      setStatus({ type: 'success', msg: `Migrasi berhasil! ${teachers.length} laoshi, ${students.length} murid, ${packages.length} paket, ${sessions.length} sesi. Halaman akan reload...` });
      setTimeout(() => window.location.reload(), 2000);
    } catch (err: any) {
      setStatus({ type: 'error', msg: `Gagal migrasi: ${err.message ?? JSON.stringify(err)}` });
    }
  };

  const handleClearData = () => {
    if (!confirm('Yakin hapus SEMUA data? Ini tidak bisa dibatalkan.')) return;
    if (!confirm('Benar-benar yakin? Semua laoshi, murid, dan jadwal akan dihapus.')) return;
    localStorage.removeItem('jadwal-les-data');
    window.location.reload();
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pengaturan</h1>

      {status && (
        <div className={`flex items-start gap-3 p-4 rounded-xl border ${
          status.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
        }`}>
          {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span className="text-sm">{status.msg}</span>
        </div>
      )}

      {/* Stats */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Ringkasan Data</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Laoshi</span><span className="font-medium dark:text-gray-200">{data.teachers.length}</span></div>
          <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Murid</span><span className="font-medium dark:text-gray-200">{data.students.length}</span></div>
          <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Paket aktif</span><span className="font-medium dark:text-gray-200">{data.packages.length}</span></div>
          <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Total sesi</span><span className="font-medium dark:text-gray-200">{data.sessions.length}</span></div>
        </div>
      </div>

      {/* Tampilan */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Tampilan</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            {isDark ? <Moon size={16} /> : <Sun size={16} />}
            <span>{isDark ? 'Mode Gelap' : 'Mode Terang'}</span>
          </div>
          <button
            onClick={toggle}
            className={`relative w-11 h-6 rounded-full transition-colors ${isDark ? 'bg-indigo-600' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isDark ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>

      {/* Backup cloud */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Cloud size={16} /> Backup Otomatis
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {lastBackupDate ? `Terakhir: ${lastBackupDate}` : 'Belum pernah backup hari ini'}
            </p>
          </div>
          <button
            onClick={handleManualBackup}
            disabled={manualBacking}
            className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex-shrink-0"
          >
            <Cloud size={15} /> {manualBacking ? 'Menyimpan...' : 'Backup Sekarang'}
          </button>
        </div>

        {backupSetupNeeded ? (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-300 space-y-1">
            <p className="font-medium">Bucket belum dibuat.</p>
            <p>Buka Supabase Dashboard → Storage → New bucket → nama: <code className="bg-amber-100 dark:bg-amber-800/40 px-1 rounded">backups</code> → Save. Lalu tambahkan policy INSERT &amp; SELECT untuk user.</p>
            <button onClick={loadBackupFiles} className="flex items-center gap-1 text-xs mt-2 text-amber-700 dark:text-amber-400 hover:underline">
              <RefreshCw size={12} /> Coba lagi
            </button>
          </div>
        ) : backupLoading ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">Memuat daftar backup...</p>
        ) : backupFiles.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-1">Belum ada backup tersimpan.</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {backupFiles.map(f => (
              <div key={f.name} className="flex items-center justify-between py-2.5">
                <span className="text-sm text-gray-700 dark:text-gray-300">{f.name.replace('backup_', '').replace('.json', '')}</span>
                <button
                  onClick={() => handleDownloadBackup(f.name)}
                  className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <Download size={13} /> Download
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Migrasi localStorage → Supabase */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
        <h2 className="font-semibold text-indigo-900 mb-1">Migrasi Data ke Supabase</h2>
        <p className="text-sm text-indigo-700 mb-4">
          Upload data lama dari browser ini ke Supabase agar bisa diakses dari mana saja.
        </p>
        <button
          onClick={handleMigrateFromLocalStorage}
          className="flex items-center gap-2 bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700"
        >
          <Database size={16} /> Upload ke Supabase
        </button>
      </div>

      {/* Import */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Import Data</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Upload file JSON untuk mengganti semua data yang ada.
          Data lama akan diganti sepenuhnya.
        </p>
        <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700"
        >
          <Upload size={16} /> Pilih File JSON
        </button>
      </div>

      {/* Export */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Export / Backup</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Download semua data sebagai file JSON. Simpan sebagai backup atau untuk dipindahkan ke browser lain.
        </p>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <Download size={16} /> Export Data
        </button>
      </div>

      {/* Danger zone */}
      <div className="bg-white dark:bg-gray-800 border border-red-200 dark:border-red-900 rounded-xl p-5">
        <h2 className="font-semibold text-red-700 dark:text-red-400 mb-1">Zona Berbahaya</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Hapus semua data. Tidak bisa dibatalkan.</p>
        <button
          onClick={handleClearData}
          className="flex items-center gap-2 bg-red-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-red-700"
        >
          <Trash2 size={16} /> Hapus Semua Data
        </button>
      </div>
    </div>
  );
}
