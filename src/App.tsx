import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { AppProvider } from './store/AppContext';
import { ThemeProvider } from './store/ThemeContext';
import { LanguageProvider } from './store/LanguageContext';
import { ConfirmProvider } from './store/ConfirmContext';
import { ToastProvider } from './store/ToastContext';
import { HolidayProvider } from './store/HolidayContext';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import Login from './pages/Login';

// Code-splitting: tiap halaman dimuat terpisah (bundle awal ringan).
// Thunk disimpan agar bisa dipakai lazy() sekaligus di-prefetch di background.
const load = {
  dashboard: () => import('./pages/Dashboard'),
  teachers: () => import('./pages/Teachers'),
  students: () => import('./pages/Students'),
  schedule: () => import('./pages/Schedule'),
  hours: () => import('./pages/Hours'),
  worksheet: () => import('./pages/Worksheet'),
  finance: () => import('./pages/Finance'),
  financeDetail: () => import('./pages/FinanceDetail'),
  log: () => import('./pages/ActivityLog'),
  settings: () => import('./pages/Settings'),
};
const Dashboard = lazy(load.dashboard);
const Teachers = lazy(load.teachers);
const Students = lazy(load.students);
const Schedule = lazy(load.schedule);
const Settings = lazy(load.settings);
const Hours = lazy(load.hours);
const Worksheet = lazy(load.worksheet);
const Finance = lazy(load.finance);
const FinanceDetail = lazy(load.financeDetail);
const ActivityLog = lazy(load.log);

const LOGIN_AT_KEY = 'jadwal-les-login-at';
const MAX_SESSION_MS = 5 * 60 * 60 * 1000; // force logout setelah 5 jam login

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    // Clear chunk-reload flag setelah app berhasil mount
    sessionStorage.removeItem('chunk-reload');
  }, []);

  useEffect(() => {
    const sessionExpired = () => {
      const loginAt = Number(localStorage.getItem(LOGIN_AT_KEY) || 0);
      return loginAt > 0 && Date.now() - loginAt > MAX_SESSION_MS;
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && sessionExpired()) {
        localStorage.removeItem(LOGIN_AT_KEY);
        supabase.auth.signOut();
        setSession(null);
        setAuthLoading(false);
        return;
      }
      if (session && !localStorage.getItem(LOGIN_AT_KEY)) {
        localStorage.setItem(LOGIN_AT_KEY, String(Date.now()));
      }
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === 'SIGNED_IN' && !localStorage.getItem(LOGIN_AT_KEY)) {
        localStorage.setItem(LOGIN_AT_KEY, String(Date.now()));
      }
      if (event === 'SIGNED_OUT' || !session) {
        localStorage.removeItem(LOGIN_AT_KEY);
      }
    });

    // Force logout begitu umur sesi lewat 5 jam (dicek berkala + saat tab fokus)
    const checkExpiry = () => {
      if (sessionExpired()) {
        localStorage.removeItem(LOGIN_AT_KEY);
        supabase.auth.signOut();
      }
    };
    const expiryTimer = setInterval(checkExpiry, 60 * 1000);
    window.addEventListener('focus', checkExpiry);

    return () => {
      subscription.unsubscribe();
      clearInterval(expiryTimer);
      window.removeEventListener('focus', checkExpiry);
    };
  }, []);

  // Prefetch: setelah login, muat chunk halaman lain di background saat idle
  // agar pindah halaman terasa instan (file di-cache oleh service worker).
  useEffect(() => {
    if (!session) return;
    const prefetch = () => Object.values(load).forEach(fn => fn());
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    const id = ric ? ric(prefetch) : window.setTimeout(prefetch, 2000);
    return () => {
      const cic = (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
      if (ric && cic) cic(id); else clearTimeout(id);
    };
  }, [session]);

  return (
    <ErrorBoundary>
    <ThemeProvider>
      <LanguageProvider>
      <ConfirmProvider>
      <ToastProvider>
      <HolidayProvider>
      {authLoading ? (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !session ? (
        <Login />
      ) : (
        <AppProvider>
          <BrowserRouter>
            <Layout>
              <Suspense fallback={
                <div className="flex items-center justify-center py-20">
                  <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                </div>
              }>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/teachers" element={<Teachers />} />
                  <Route path="/students" element={<Students />} />
                  <Route path="/schedule" element={<Schedule />} />
                  <Route path="/hours" element={<Hours />} />
                  <Route path="/worksheet" element={<Worksheet />} />
                  <Route path="/finance" element={<Finance />} />
                  <Route path="/finance/:teacherId" element={<FinanceDetail />} />
                  <Route path="/log" element={<ActivityLog />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </Suspense>
            </Layout>
          </BrowserRouter>
        </AppProvider>
      )}
      </HolidayProvider>
      </ToastProvider>
      </ConfirmProvider>
      </LanguageProvider>
    </ThemeProvider>
    </ErrorBoundary>
  );
}
