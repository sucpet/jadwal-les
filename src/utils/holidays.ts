export interface Holiday {
  date: string;
  name: string;
  tentative?: boolean;
}

// Hari libur nasional Indonesia 2026.
// Tanggal berbasis kalender Hijriyah/Saka ditandai tentative — bisa bergeser 1-2 hari
// tergantung pengumuman pemerintah.
export const HOLIDAYS_2026: Holiday[] = [
  { date: '2026-01-01', name: 'Tahun Baru Masehi' },
  { date: '2026-01-16', name: 'Isra Miʼraj', tentative: true },
  { date: '2026-02-17', name: 'Tahun Baru Imlek' },
  { date: '2026-03-19', name: 'Hari Raya Nyepi', tentative: true },
  { date: '2026-03-20', name: 'Idul Fitri (1)', tentative: true },
  { date: '2026-03-21', name: 'Idul Fitri (2)', tentative: true },
  { date: '2026-04-03', name: 'Wafat Isa Al Masih' },
  { date: '2026-05-01', name: 'Hari Buruh' },
  { date: '2026-05-14', name: 'Kenaikan Isa Al Masih' },
  { date: '2026-05-23', name: 'Hari Raya Waisak', tentative: true },
  { date: '2026-05-27', name: 'Idul Adha', tentative: true },
  { date: '2026-06-01', name: 'Hari Lahir Pancasila' },
  { date: '2026-06-17', name: 'Tahun Baru Islam', tentative: true },
  { date: '2026-08-17', name: 'Hari Kemerdekaan RI' },
  { date: '2026-08-26', name: 'Maulid Nabi', tentative: true },
  { date: '2026-12-25', name: 'Hari Natal' },
];

export function getHoliday(date: string): Holiday | undefined {
  return HOLIDAYS_2026.find(h => h.date === date);
}
