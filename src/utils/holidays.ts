export interface Holiday {
  date: string;
  name: string;
  type?: 'holiday' | 'leave';
}

const API_BASE = 'https://tanggalmerah.upset.dev';
const CACHE_PREFIX = 'holidays_v1_';

// Fallback kalau API tidak bisa dijangkau
const FALLBACK: Holiday[] = [
  { date: '2026-01-01', name: 'Tahun Baru Masehi' },
  { date: '2026-01-16', name: 'Isra Miʼraj' },
  { date: '2026-02-17', name: 'Tahun Baru Imlek' },
  { date: '2026-03-19', name: 'Hari Raya Nyepi' },
  { date: '2026-03-20', name: 'Idul Fitri (1)' },
  { date: '2026-03-21', name: 'Idul Fitri (2)' },
  { date: '2026-04-03', name: 'Wafat Isa Al Masih' },
  { date: '2026-05-01', name: 'Hari Buruh' },
  { date: '2026-05-14', name: 'Kenaikan Isa Al Masih' },
  { date: '2026-05-23', name: 'Hari Raya Waisak' },
  { date: '2026-05-27', name: 'Idul Adha' },
  { date: '2026-06-01', name: 'Hari Lahir Pancasila' },
  { date: '2026-06-17', name: 'Tahun Baru Islam' },
  { date: '2026-08-17', name: 'Hari Kemerdekaan RI' },
  { date: '2026-08-26', name: 'Maulid Nabi' },
  { date: '2026-12-25', name: 'Hari Natal' },
];

export async function fetchHolidaysForYear(year: number): Promise<Holiday[]> {
  const cacheKey = CACHE_PREFIX + year;
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached) as Holiday[];
  } catch { /* ignore */ }

  try {
    const res = await fetch(`${API_BASE}/api/holidays?year=${year}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as { success: boolean; data: { date: string; name: string; type: string }[] };
    if (!json.success) throw new Error('API error');
    const holidays: Holiday[] = json.data.map(h => ({ date: h.date, name: h.name, type: h.type as Holiday['type'] }));
    try { sessionStorage.setItem(cacheKey, JSON.stringify(holidays)); } catch { /* ignore */ }
    return holidays;
  } catch {
    return year === 2026 ? FALLBACK : [];
  }
}
