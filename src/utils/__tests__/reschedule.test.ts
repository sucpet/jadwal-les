import { describe, it, expect } from 'vitest';
import { seriesMoves, moveToWeekday, daysBetween } from '../calendar';
import type { LessonSession } from '../../types';

const mk = (id: string, date: string, startTime = '15:00', endTime = '16:00', extra: Partial<LessonSession> = {}): LessonSession =>
  ({ id, teacherId: 't', studentId: 'a', date, startTime, endTime, status: 'scheduled', ...extra } as LessonSession);

describe('seriesMoves', () => {
  // Selasa 15:00 → Kamis 16:00
  const base = mk('s1', '2026-10-13');
  const sessions = [
    base,
    mk('s2', '2026-10-20'),                                  // ikut
    mk('s3', '2026-10-27'),                                  // ikut
    mk('old', '2026-10-06'),                                 // sebelum → tidak
    mk('sat', '2026-10-17'),                                 // hari lain → tidak
    mk('jam', '2026-10-20', '17:00', '18:00'),               // jam lain → tidak
    mk('done', '2026-11-03', '15:00', '16:00', { status: 'completed' }),
    mk('other', '2026-10-20', '15:00', '16:00', { studentId: 'b' }),
  ];
  it('geser hanya slot yang sama ke depan', () => {
    expect(seriesMoves(sessions, base, '2026-10-15', '16:00', '17:00')).toEqual([
      { id: 's2', date: '2026-10-22', startTime: '16:00', endTime: '17:00' },
      { id: 's3', date: '2026-10-29', startTime: '16:00', endTime: '17:00' },
    ]);
  });
  it('lintas bulan', () => {
    expect(seriesMoves([base, mk('x', '2026-10-27')], base, '2026-10-16', '15:00', '16:30')[0])
      .toEqual({ id: 'x', date: '2026-10-30', startTime: '15:00', endTime: '16:30' });
  });
});

describe('moveToWeekday', () => {
  it('pindah dalam minggu yang sama (Senin awal minggu)', () => {
    expect(moveToWeekday('2026-10-14', 4)).toBe('2026-10-15'); // Rabu → Kamis
    expect(moveToWeekday('2026-10-18', 1)).toBe('2026-10-12'); // Minggu → Senin minggu itu
    expect(moveToWeekday('2026-10-12', 7)).toBe('2026-10-18'); // Senin → Minggu
    expect(moveToWeekday('2026-10-14', null)).toBe('2026-10-14');
  });
  it('daysBetween', () => expect(daysBetween('2026-10-30', '2026-11-02')).toBe(3));
});
