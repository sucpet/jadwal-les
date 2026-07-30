import { describe, it, expect } from 'vitest';
import { normalizePhone, isValidPhone, waLink } from '../whatsapp';

describe('normalizePhone', () => {
  it('converts leading 0 to 62', () => {
    expect(normalizePhone('081234567890')).toBe('6281234567890');
  });
  it('strips separators (spaces, dashes)', () => {
    expect(normalizePhone('0812-3456-7890')).toBe('6281234567890');
    expect(normalizePhone('0812 3456 7890')).toBe('6281234567890');
  });
  it('handles +62 prefix', () => {
    expect(normalizePhone('+62 812 3456 7890')).toBe('6281234567890');
  });
  it('keeps existing 62 prefix', () => {
    expect(normalizePhone('6281234567890')).toBe('6281234567890');
  });
  it('prepends 62 for number starting with 8 (no leading 0)', () => {
    expect(normalizePhone('81234567890')).toBe('6281234567890');
  });
  it('returns empty for blank/nullish', () => {
    expect(normalizePhone('')).toBe('');
    expect(normalizePhone(undefined)).toBe('');
    expect(normalizePhone(null)).toBe('');
  });
});

describe('isValidPhone', () => {
  it('accepts a normal Indonesian number', () => {
    expect(isValidPhone('081234567890')).toBe(true);
  });
  it('rejects too-short and empty', () => {
    expect(isValidPhone('0812')).toBe(false);
    expect(isValidPhone('')).toBe(false);
  });
});

describe('waLink', () => {
  it('builds an encoded wa.me link', () => {
    const link = waLink('081234567890', 'Halo Steven');
    expect(link).toBe('https://wa.me/6281234567890?text=Halo%20Steven');
  });
  it('returns empty string for invalid phone', () => {
    expect(waLink('123', 'hi')).toBe('');
  });
});
