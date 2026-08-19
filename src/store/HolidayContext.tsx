import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { fetchHolidaysForYear } from '../utils/holidays';
import type { Holiday } from '../utils/holidays';

interface HolidayContextValue {
  getHoliday: (date: string) => Holiday | undefined;
}

const HolidayContext = createContext<HolidayContextValue>({ getHoliday: () => undefined });

export function HolidayProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<Map<string, Holiday>>(new Map());

  useEffect(() => {
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear + 1];
    Promise.all(years.map(y => fetchHolidaysForYear(y))).then(results => {
      const m = new Map<string, Holiday>();
      results.flat().forEach(h => m.set(h.date, h));
      setMap(m);
    });
  }, []);

  const getHoliday = (date: string) => map.get(date);

  return (
    <HolidayContext.Provider value={{ getHoliday }}>
      {children}
    </HolidayContext.Provider>
  );
}

export const useHolidays = () => useContext(HolidayContext);
