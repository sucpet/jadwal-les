import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { id as idLocale, enUS } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import { translations } from '../i18n/translations';
import type { Lang } from '../i18n/translations';

const STORAGE_KEY = 'jadwal-les-lang';

interface LangContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: Locale;
}

const LanguageContext = createContext<LangContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'en' || saved === 'id' ? saved : 'en';
  });

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const t = useCallback((key: string, vars?: Record<string, string | number>) => {
    let s = translations[lang][key] ?? translations.id[key] ?? key;
    if (vars) {
      for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]));
    }
    return s;
  }, [lang]);

  const locale = lang === 'en' ? enUS : idLocale;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, locale }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used within LanguageProvider');
  return ctx;
}
