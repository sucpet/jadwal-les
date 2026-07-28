import { useState, useEffect, useCallback } from 'react';
import { Download, Trash2, AlertTriangle, CheckCircle2, Database, Moon, Sun, Cloud, RefreshCw, RotateCcw } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { useTheme } from '../store/ThemeContext';
import { supabase } from '../lib/supabase';

export default function Settings() {
  const { data } = useApp();
  const { isDark, toggle } = useTheme();
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const [backupFiles, setBackupFiles] = useState<Array<{ name: string }>>([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupSetupNeeded, setBackupSetupNeeded] = useState(false);
  const [manualBacking, setManualBacking] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
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
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const { error } = await supabase.storage
      .from('backups')
      .upload(`backup_${dateStr}_${timeStr}.json`, blob);
    setManualBacking(false);
    if (error) { setStatus({ type: 'error', msg: `Gagal backup: ${error.message}` }); return; }
    localStorage.setItem('jadwal-les-last-backup', dateStr);
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

  // Pulihkan seluruh data dari isi backup (full replace: hapus semua lalu insert)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyBackup = async (json: any) => {
    if (!Array.isArray(json.teachers) || !Array.isArray(json.students) || !Array.isArray(json.sessions) || !Array.isArray(json.packages)) {
      throw new Error('Format backup tidak valid (teachers/students/sessions/packages harus ada).');
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const teachers   = json.teachers.map((t: any)  => ({ id: t.id, name: t.name, color: t.color, honor_per_session: t.honorPerSession ?? 100000, is_owner: t.isOwner ?? false, created_at: t.createdAt }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const students   = json.students.map((s: any)  => ({ id: s.id, teacher_id: s.teacherId, name: s.name, billing_type: s.billingType, rate_per_session: s.ratePerSession, pending_rate: s.pendingRate ?? null, pending_rate_effective_date: s.pendingRateEffectiveDate ?? null, group: s.group ?? 'xuyuan', xu_yuan_type: s.xuYuanType ?? 'private', is_active: s.isActive ?? true, notes: s.notes ?? null, created_at: s.createdAt }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const packages   = json.packages.map((p: any)  => ({ id: p.id, student_id: p.studentId, teacher_id: p.teacherId, total_sessions: p.totalSessions, pricing_type: p.pricingType ?? 'per-session', price_per_session: p.pricePerSession, package_price: p.packagePrice ?? null, start_date: p.startDate, notes: p.notes ?? null, created_at: p.createdAt }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessions   = json.sessions.map((s: any)  => ({ id: s.id, student_id: s.studentId, teacher_id: s.teacherId, date: s.date, start_time: s.startTime, end_time: s.endTime, status: s.status, notes: s.notes ?? null, worksheet_pages: s.worksheetPages ?? 0, rate_snapshot: s.rateSnapshot ?? null, created_at: s.createdAt }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const worksheets = (json.worksheets ?? []).map((w: any) => ({ id: w.id, student_id: w.studentId, date: w.date, pages: w.pages, created_at: w.createdAt }));

    // Hapus semua (reverse FK)
    for (const t of ['worksheets', 'sessions', 'packages', 'students', 'teachers']) {
      const { error } = await supabase.from(t).delete().not('id', 'is', null);
      if (error) throw error;
    }
    // Insert (FK order)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ins = async (table: string, rows: any[]) => {
      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await supabase.from(table).insert(rows.slice(i, i + 100));
        if (error) throw error;
      }
    };
    await ins('teachers', teachers);
    await ins('students', students);
    await ins('packages', packages);
    await ins('sessions', sessions);
    await ins('worksheets', worksheets);
    return { teachers, students, packages, sessions };
  };

  const handleRestore = async (filename: string) => {
    const label = filename.replace('backup_', '').replace('.json', '');
    if (!confirm(`Pulihkan data dari backup "${label}"?\n\nSEMUA data saat ini akan diganti dengan isi backup ini. Tidak bisa dibatalkan.`)) return;
    setRestoring(filename);
    setStatus({ type: 'success', msg: 'Memulihkan data dari backup...' });
    try {
      const { data: blob, error } = await supabase.storage.from('backups').download(filename);
      if (error || !blob) throw new Error('Gagal mengunduh file backup.');
      const json = JSON.parse(await blob.text());
      const res = await applyBackup(json);
      setStatus({ type: 'success', msg: `Berhasil pulihkan: ${res.teachers.length} laoshi, ${res.students.length} murid, ${res.packages.length} paket, ${res.sessions.length} sesi. Halaman akan reload...` });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setRestoring(null);
      setStatus({ type: 'error', msg: `Gagal pulihkan: ${(err as Error).message}` });
    }
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

  const handleClearData = async () => {
    if (!confirm('Yakin hapus SEMUA data? Ini tidak bisa dibatalkan.')) return;
    if (!confirm('Benar-benar yakin? Semua laoshi, murid, dan jadwal akan dihapus.')) return;
    // Delete in reverse FK order
    await supabase.from('worksheets').delete().not('id', 'is', null);
    await supabase.from('sessions').delete().not('id', 'is', null);
    await supabase.from('packages').delete().not('id', 'is', null);
    await supabase.from('students').delete().not('id', 'is', null);
    await supabase.from('teachers').delete().not('id', 'is', null);
    localStorage.removeItem('jadwal-les-data');
    localStorage.removeItem('jadwal-les-last-backup');
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
              <div key={f.name} className="flex items-center justify-between gap-2 py-2.5">
                <span className="text-sm text-gray-700 dark:text-gray-300 min-w-0 truncate">{f.name.replace('backup_', '').replace('.json', '')}</span>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <button
                    onClick={() => handleDownloadBackup(f.name)}
                    className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:underline"
                  >
                    <Download size={13} /> Download
                  </button>
                  <button
                    onClick={() => handleRestore(f.name)}
                    disabled={restoring !== null}
                    className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RotateCcw size={13} /> {restoring === f.name ? 'Memulihkan…' : 'Pulihkan'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-400 dark:text-gray-500 pt-1">
          <strong>Pulihkan</strong> mengganti seluruh data saat ini dengan isi backup yang dipilih.
        </p>
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
