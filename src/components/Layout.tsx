import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, BookOpen, GraduationCap, Settings, Timer, LogOut } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { supabase } from '../lib/supabase';
import { useApp } from '../store/AppContext';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/teachers', icon: GraduationCap, label: 'Laoshi' },
  { to: '/students', icon: Users, label: 'Murid' },
  { to: '/schedule', icon: BookOpen, label: 'Jadwal' },
  { to: '/hours', icon: Timer, label: 'Jam Mengajar' },
  { to: '/settings', icon: Settings, label: 'Pengaturan' },
];

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="text-right leading-tight">
      <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
        {format(now, 'EEEE, d MMMM yyyy', { locale: localeId })}
      </div>
      <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 tabular-nums">
        {format(now, 'HH:mm:ss')}
      </div>
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { loading } = useApp();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center gap-3">
        <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-500 dark:text-gray-400">Memuat data...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Top bar */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
          <BookOpen size={16} className="text-white" />
        </div>
        <span className="font-semibold text-gray-900 dark:text-white">Jadwal Les</span>
        <div className="ml-auto flex items-center gap-3">
          <LiveClock />
          <button
            onClick={() => supabase.auth.signOut()}
            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            title="Keluar"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <nav className="w-52 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-3 flex-shrink-0 hidden md:block">
          <div className="space-y-1">
            {navItems.map(({ to, icon: Icon, label }) => {
              const active = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Main content */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
      </div>

      {/* Bottom nav mobile */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex">
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs font-medium ${
                active ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <Icon size={20} />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
