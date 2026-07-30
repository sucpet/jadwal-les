import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { AppProvider } from './store/AppContext';
import { ThemeProvider } from './store/ThemeContext';
import { LanguageProvider } from './store/LanguageContext';
import { ConfirmProvider } from './store/ConfirmContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Teachers from './pages/Teachers';
import Students from './pages/Students';
import Schedule from './pages/Schedule';
import Settings from './pages/Settings';
import Hours from './pages/Hours';
import Worksheet from './pages/Worksheet';
import Finance from './pages/Finance';
import FinanceDetail from './pages/FinanceDetail';
import ActivityLog from './pages/ActivityLog';

const LOGIN_AT_KEY = 'jadwal-les-login-at';
const MAX_SESSION_MS = 5 * 60 * 60 * 1000; // force logout setelah 5 jam login

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

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

  return (
    <ThemeProvider>
      <LanguageProvider>
      <ConfirmProvider>
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
            </Layout>
          </BrowserRouter>
        </AppProvider>
      )}
      </ConfirmProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
